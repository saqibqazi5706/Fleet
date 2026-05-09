import { Alert, AlertType, Position, Severity, Ship, Zone } from '../types'
import { advanceShip } from './ships'
import { applyWeatherPenalty } from '../weather/weatherPenalty'
import { checkGeofences } from '../alerts/geofence'
import { checkProximity } from '../alerts/proximity'
import { createAlert } from '../alerts/alertManager'
import { computeRoute } from '../routing/router'
import { maybeSaveSnapshot } from '../playback/snapshotStore'
import { saveAlert, saveSnapshot } from '../persistence/supabase'
import { haversineDistance } from './geometry'

let fleet: Ship[] = []

export function initFleet(ships: Ship[]): void {
  fleet = ships.map(ship => ({ ...ship }))
  console.log(`Fleet initialized with ${fleet.length} ships`)
}

export function getFleet(): Ship[] {
  return fleet
}

// ── Fuel-to-destination sufficiency ──────────────────────────────────────────
// Warn when a ship's remaining fuel cannot cover the distance to its destination
// (accounting for weather penalty in the estimate).
const BASE_FUEL_BURN_TONS_PER_KM = 0.004

function estimateFuelRequired(ship: Ship): number {
  const remainingKm = haversineDistance(
    ship.lat, ship.lng,
    ship.destination.lat, ship.destination.lng,
  )
  const weatherMultiplier = ship.inAdverseWeather ? 1.3 : 1.0
  return remainingKm * BASE_FUEL_BURN_TONS_PER_KM * weatherMultiplier
}

export function updateFleet(deltaMs: number, zones: Zone[], adverseWeather: boolean): { ships: Ship[]; alerts: Alert[] } {
  fleet = fleet
    .map((ship) => applyWeatherPenalty(ship, adverseWeather))
    .map((ship) => {
      const routedShip = ship.status === 'normal' || ship.status === 'rerouting'
        ? { ...ship, route: computeRoute(ship, zones) }
        : ship
      return advanceShip(routedShip, deltaMs)
    })

  const geofenceResult = checkGeofences(fleet, zones)
  fleet = geofenceResult.ships

  const fuelAlerts = fleet.reduce<Array<{
    type: AlertType
    severity: Severity
    shipId: string
    message: string
    dedupeKey: string
  }>>((items, ship) => {
    // ── Stranded ────────────────────────────────────────────────────────────
    if (ship.status === 'stranded') {
      items.push({
        type: 'STRANDED' as const,
        severity: 'critical' as const,
        shipId: ship.id,
        message: `${ship.name} is stranded – immobilised with critically low fuel`,
        dedupeKey: `STRANDED:${ship.id}`,
      })
    }

    // ── Out of fuel ─────────────────────────────────────────────────────────
    if (ship.status === 'out_of_fuel') {
      items.push({
        type: 'OUT_OF_FUEL' as const,
        severity: 'critical' as const,
        shipId: ship.id,
        message: `${ship.name} is out of fuel`,
        dedupeKey: `OUT_OF_FUEL:${ship.id}`,
      })
    }

    // ── Insufficient fuel (below 15 %) ───────────────────────────────────
    if (ship.status === 'insufficient_fuel') {
      items.push({
        type: 'INSUFFICIENT_FUEL' as const,
        severity: 'high' as const,
        shipId: ship.id,
        message: `${ship.name} fuel below 15 % (${ship.fuel.toFixed(0)} t remaining)`,
        dedupeKey: `INSUFFICIENT_FUEL:${ship.id}`,
      })
    }

    // ── Predictive: fuel insufficient to reach destination ──────────────
    if (
      ship.status !== 'arrived' &&
      ship.status !== 'out_of_fuel' &&
      ship.status !== 'stranded' &&
      ship.status !== 'stopped'
    ) {
      const required = estimateFuelRequired(ship)
      if (required > ship.fuel && ship.fuel > 0) {
        items.push({
          type: 'INSUFFICIENT_FUEL' as const,
          severity: 'high' as const,
          shipId: ship.id,
          message: `${ship.name} may not reach ${ship.destination.name} – needs ~${required.toFixed(0)} t, has ${ship.fuel.toFixed(0)} t`,
          dedupeKey: `FUEL_SHORTFALL:${ship.id}`,
        })
      }
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