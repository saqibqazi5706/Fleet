import { Alert, AlertType, Directive, Position, Severity, Ship, Zone } from '../types'
import { advanceShip, BASE_FUEL_BURN_TONS_PER_KM } from './ships'
import { applyWeatherPenalty } from '../weather/weatherPenalty'
import { checkGeofences } from '../alerts/geofence'
import { checkProximity } from '../alerts/proximity'
import { createAlert } from '../alerts/alertManager'
import { computeRoute, isRouteValid, routeDistanceKm } from '../routing/router'
import { maybeSaveSnapshot } from '../playback/snapshotStore'
import { saveAlert, saveSnapshot } from '../persistence/supabase'

let fleet: Ship[] = []
const pendingDirectives = new Map<string, Directive>()

export function initFleet(ships: Ship[]): void {
  fleet = ships.map((ship) => {
    const routeResult = computeRoute(ship, [])
    return routeResult ? { ...ship, route: routeResult.route } : { ...ship, status: 'stranded' as const, route: [] }
  })
  console.log(`Fleet initialized with ${fleet.length} ships`)
}

export function getFleet(): Ship[] {
  return fleet
}

export function updateFleet(deltaMs: number, zones: Zone[], adverseWeather: boolean): { ships: Ship[]; alerts: Alert[] } {
  applyPendingDirectives()

  fleet = fleet
    .map((ship) => applyWeatherPenalty(ship, adverseWeather))
    .map((ship) => ensureValidRoute(ship, zones))
    .map((ship) => applyFuelReachability(ship))
    .map((ship) => advanceShip(ship, deltaMs))

  const geofenceResult = checkGeofences(fleet, zones)
  fleet = geofenceResult.ships

  const fuelAlerts = fleet.reduce<Array<{
    type: AlertType
    severity: Severity
    shipId: string
    message: string
    dedupeKey: string
    metadata?: Record<string, unknown>
  }>>((items, ship) => {
    if (ship.status === 'stranded') {
      items.push({
        type: 'STRANDED' as const,
        severity: 'critical' as const,
        shipId: ship.id,
        message: `${ship.name} has no valid water route to ${ship.destination.name}`,
        dedupeKey: `STRANDED:${ship.id}`,
      })
    }
    if (ship.status === 'out_of_fuel') {
      items.push({
        type: 'OUT_OF_FUEL' as const,
        severity: 'critical' as const,
        shipId: ship.id,
        message: `${ship.name} is out of fuel`,
        dedupeKey: `OUT_OF_FUEL:${ship.id}`,
      })
    }
    if (ship.status === 'insufficient_fuel') {
      const multiplier = ship.inAdverseWeather ? 1.3 : 1
      const distance = routeDistanceKm(ship)
      const requiredFuel = distance * BASE_FUEL_BURN_TONS_PER_KM * multiplier
      items.push({
        type: 'INSUFFICIENT_FUEL' as const,
        severity: 'high' as const,
        shipId: ship.id,
        message: `${ship.name} has insufficient fuel`,
        dedupeKey: `INSUFFICIENT_FUEL:${ship.id}`,
        metadata: {
          fuelRemainingTons: ship.fuel,
          estimatedFuelRequiredTons: Number(requiredFuel.toFixed(2)),
          routeDistanceKm: Number(distance.toFixed(2)),
        },
      })
    }
    return items
  }, [])

  const createdFuelAlerts = fuelAlerts.flatMap((input) => {
    const alert = createAlert(input)
    return alert ? [alert] : []
  })

  const proximityAlerts = checkProximity(fleet)
  const snapshot = maybeSaveSnapshot(fleet)
  if (snapshot) saveSnapshot(snapshot)

  const alerts = [...geofenceResult.alerts, ...createdFuelAlerts, ...proximityAlerts]
  alerts.forEach(saveAlert)

  return { ships: fleet, alerts }
}

export function runImmediateGeofenceCheck(zones: Zone[]): { ships: Ship[]; alerts: Alert[] } {
  const geofenceResult = checkGeofences(fleet, zones)
  fleet = geofenceResult.ships
  geofenceResult.alerts.forEach(saveAlert)
  return { ships: fleet, alerts: geofenceResult.alerts }
}

export function recomputeFleetRoutes(zones: Zone[]): { ships: Ship[]; alerts: Alert[] } {
  const alerts: Alert[] = []
  fleet = fleet.map((ship) => {
    const beforeStatus = ship.status
    const updated = ensureValidRoute(ship, zones, true)
    if (updated.status === 'stranded' && beforeStatus !== 'stranded') {
      const alert = createAlert({
        type: 'STRANDED',
        severity: 'critical',
        shipId: ship.id,
        message: `${ship.name} has no valid water route to ${ship.destination.name}`,
        dedupeKey: `STRANDED:${ship.id}`,
      })
      if (alert) alerts.push(alert)
    }
    return updated
  })
  alerts.forEach(saveAlert)
  return { ships: fleet, alerts }
}

export function queueDirective(directive: Directive): void {
  pendingDirectives.set(directive.id, directive)
}

function applyPendingDirectives(): void {
  pendingDirectives.forEach((directive) => {
    if (directive.type === 'HOLD_POSITION') {
      holdShip(directive.shipId)
    }
    if (directive.type === 'CHANGE_DESTINATION' && directive.payload.destination) {
      setShipDestination(directive.shipId, directive.payload.destination)
    }
    if (directive.type === 'REROUTE_WAYPOINT' && directive.payload.waypoint) {
      setShipWaypoint(directive.shipId, directive.payload.waypoint)
    }
  })
  pendingDirectives.clear()
}

export function setShipDestination(shipId: string, destination: { lat: number; lng: number; name: string }): Ship | null {
  const ship = fleet.find((candidate) => candidate.id === shipId)
  if (!ship) return null

  fleet = fleet.map((candidate) =>
    candidate.id === shipId
      ? {
          ...candidate,
          destination: { portId: 'DIRECTIVE', ...destination },
          route: [],
          status: 'rerouting',
        }
      : candidate
  )

  return fleet.find((candidate) => candidate.id === shipId) || null
}

export function setShipWaypoint(shipId: string, waypoint: Position): Ship | null {
  fleet = fleet.map((ship) =>
    ship.id === shipId ? { ...ship, route: [waypoint], status: 'rerouting' } : ship
  )
  return fleet.find((ship) => ship.id === shipId) || null
}

export function holdShip(shipId: string): Ship | null {
  fleet = fleet.map((ship) => (ship.id === shipId ? { ...ship, status: 'stopped' } : ship))
  return fleet.find((ship) => ship.id === shipId) || null
}

export function markDistressed(shipId: string): Ship | null {
  fleet = fleet.map((ship) => (ship.id === shipId ? { ...ship, status: 'distressed' } : ship))
  return fleet.find((ship) => ship.id === shipId) || null
}

function ensureValidRoute(ship: Ship, zones: Zone[], force = false): Ship {
  if (!canNavigate(ship) && !(force && ship.status === 'stranded')) return ship
  if (!force && isRouteValid(ship, zones)) return ship

  const routeResult = computeRoute(ship, zones)
  if (!routeResult) {
    return { ...ship, status: 'stranded', route: [] }
  }

  const routeChanged = JSON.stringify(ship.route) !== JSON.stringify(routeResult.route)
  return {
    ...ship,
    route: routeResult.route,
    status: routeChanged && ship.status !== 'insufficient_fuel' ? 'rerouting' : ship.status,
  }
}

function applyFuelReachability(ship: Ship): Ship {
  if (!canNavigate(ship) || ship.status === 'out_of_fuel') return ship

  const multiplier = ship.inAdverseWeather ? 1.3 : 1
  const requiredFuel = routeDistanceKm(ship) * BASE_FUEL_BURN_TONS_PER_KM * multiplier
  if (ship.fuel >= requiredFuel) return ship

  return ship.status === 'normal' || ship.status === 'rerouting'
    ? { ...ship, status: 'insufficient_fuel' }
    : ship
}

function canNavigate(ship: Ship): boolean {
  return !['arrived', 'stopped', 'stranded', 'out_of_fuel'].includes(ship.status)
}
