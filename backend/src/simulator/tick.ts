import { Alert, AlertType, Directive, Position, Severity, Ship, WeatherState, Zone } from '../types'
import { advanceShip, BASE_FUEL_BURN_TONS_PER_KM } from './ships'
import { applyWeatherPenalty } from '../weather/weatherPenalty'
import { getWeatherAvoidanceZones } from '../weather/weatherFetcher'
import { checkGeofences } from '../alerts/geofence'
import { checkProximity } from '../alerts/proximity'
import { createAlert } from '../alerts/alertManager'
import { computeRoute, isRouteValid, routeDistanceKm } from '../routing/router'
import { createInsideZoneRerouteApprovals, approveRerouteApproval, holdRerouteApproval, getRerouteApprovals } from '../routing/rerouteApprovals'
import { maybeSaveSnapshot } from '../playback/snapshotStore'
import { saveAlert, saveSnapshot } from '../persistence/supabase'

let fleet: Ship[] = []
const pendingDirectives = new Map<string, Directive>()

export function initFleet(ships: Ship[]): void {
  fleet = ships.map((ship) => {
    const routeResult = computeRoute(ship, [], getWeatherAvoidanceZones())
    return routeResult ? { ...ship, route: routeResult.route } : { ...ship, status: 'stranded' as const, route: [] }
  })
  console.log(`Fleet initialized with ${fleet.length} ships`)
}

export function getFleet(): Ship[] {
  return fleet
}

export function updateFleet(deltaMs: number, zones: Zone[], weather: WeatherState): { ships: Ship[]; alerts: Alert[] } {
  applyPendingDirectives()

  fleet = fleet
    .map((ship) => applyWeatherPenalty(ship, weather))
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

export function createRerouteApprovalsForInsideZones(zones: Zone[]) {
  const result = createInsideZoneRerouteApprovals(fleet, zones)
  const pendingShipIds = new Set(result.approvals.map((approval) => approval.shipId))
  if (pendingShipIds.size > 0) {
    fleet = fleet.map((ship) =>
      pendingShipIds.has(ship.id) ? { ...ship, status: 'restricted_zone_breach' as const } : ship
    )
  }
  result.alerts.forEach(saveAlert)
  return result
}

export function getRerouteApprovalState() {
  return getRerouteApprovals()
}

export function approvePendingReroute(id: string): { ships: Ship[]; approval: ReturnType<typeof approveRerouteApproval> } {
  const approval = approveRerouteApproval(id)
  if (!approval) return { ships: fleet, approval }
  fleet = fleet.map((ship) =>
    ship.id === approval.shipId
      ? { ...ship, route: approval.proposedRoute, status: 'rerouting' as const }
      : ship
  )
  return { ships: fleet, approval }
}

export function holdPendingReroute(id: string): { ships: Ship[]; approval: ReturnType<typeof holdRerouteApproval> } {
  const approval = holdRerouteApproval(id)
  if (!approval) return { ships: fleet, approval }
  fleet = fleet.map((ship) =>
    ship.id === approval.shipId ? { ...ship, route: [], status: 'stopped' as const } : ship
  )
  return { ships: fleet, approval }
}

export function recomputeFleetRoutes(zones: Zone[]): { ships: Ship[]; alerts: Alert[] } {
  const alerts: Alert[] = []
  fleet = fleet.map((ship) => {
    const beforeStatus = ship.status
    const beforeRoute = JSON.stringify(ship.route)
    const updated = ensureValidRoute(ship, zones, true)
    if (updated.status === 'stranded' && beforeStatus !== 'stranded') {
      console.warn(`[Simulator] ${ship.id} stranded: no valid route to ${ship.destination.name}`)
      const alert = createAlert({
        type: 'STRANDED',
        severity: 'critical',
        shipId: ship.id,
        message: `${ship.name} has no valid water route to ${ship.destination.name}`,
        dedupeKey: `STRANDED:${ship.id}`,
      })
      if (alert) alerts.push(alert)
    }
    if (updated.status === 'rerouting' && beforeRoute !== JSON.stringify(updated.route)) {
      console.log(`[Simulator] ${ship.id} rerouted around active restricted zones`)
      const alert = createAlert({
        type: 'ROUTE_REROUTE',
        severity: 'medium',
        shipId: ship.id,
        message: `${ship.name} automatically rerouted around restricted zone`,
        dedupeKey: `ROUTE_REROUTE:${ship.id}:${Date.now()}`,
        metadata: {
          destination: ship.destination.name,
          waypointCount: updated.route.length,
          routeDistanceKm: Number(routeDistanceKm(updated).toFixed(2)),
        },
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

  const insideRestrictedZone = zones.some(zone => isShipInsideZone(ship, zone))
  if (insideRestrictedZone) {
    console.log(`[Simulator] ${ship.id} starts inside restricted zone; attempting escape route`)
  }

  const routeResult = computeRoute(ship, zones, getWeatherAvoidanceZones())
  if (!routeResult) {
    return { ...ship, status: 'stranded', route: [] }
  }

  const routeChanged = JSON.stringify(ship.route) !== JSON.stringify(routeResult.route)
  const nextStatus =
    insideRestrictedZone || ship.status === 'restricted_zone_breach'
      ? 'restricted_zone_breach'
      : routeChanged && ship.status !== 'insufficient_fuel'
        ? 'rerouting'
        : ship.status

  return {
    ...ship,
    route: routeResult.route,
    status: nextStatus,
  }
}

function applyFuelReachability(ship: Ship): Ship {
  if (!canNavigate(ship) || ship.status === 'out_of_fuel') {
    return {
      ...ship,
      fuelReachable: ship.status !== 'out_of_fuel',
      routeDistanceKm: routeDistanceKm(ship),
      estimatedFuelRequiredTons: 0,
      fuelShortfallTons: ship.status === 'out_of_fuel' ? 0 : undefined,
    }
  }

  const multiplier = ship.inAdverseWeather ? 1.3 : 1
  const distance = routeDistanceKm(ship)
  const requiredFuel = distance * BASE_FUEL_BURN_TONS_PER_KM * multiplier
  const fuelReachable = ship.fuel >= requiredFuel
  const fuelFields = {
    fuelReachable,
    routeDistanceKm: Number(distance.toFixed(2)),
    estimatedFuelRequiredTons: Number(requiredFuel.toFixed(2)),
    fuelShortfallTons: fuelReachable ? 0 : Number((requiredFuel - ship.fuel).toFixed(2)),
  }

  if (fuelReachable) return { ...ship, ...fuelFields }

  return ship.status === 'normal' || ship.status === 'rerouting'
    ? { ...ship, ...fuelFields, status: 'insufficient_fuel' }
    : { ...ship, ...fuelFields }
}

function canNavigate(ship: Ship): boolean {
  return !['arrived', 'stopped', 'stranded', 'out_of_fuel'].includes(ship.status)
}

function isShipInsideZone(ship: Ship, zone: Zone): boolean {
  let inside = false
  const x = ship.lng
  const y = ship.lat

  for (let i = 0, j = zone.coordinates.length - 1; i < zone.coordinates.length; j = i++) {
    const yi = zone.coordinates[i][0]
    const xi = zone.coordinates[i][1]
    const yj = zone.coordinates[j][0]
    const xj = zone.coordinates[j][1]
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }

  return inside
}
