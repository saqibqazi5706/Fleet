import { Alert, AlertType, Position, Severity, Ship, Zone } from '../types'
import { advanceShip } from './ships'
import { applyWeatherPenalty } from '../weather/weatherPenalty'
import { checkGeofences } from '../alerts/geofence'
import { checkProximity } from '../alerts/proximity'
import { createAlert } from '../alerts/alertManager'
import { computeRoute } from '../routing/router'
import { maybeSaveSnapshot } from '../playback/snapshotStore'
import { saveAlert, saveSnapshot } from '../persistence/supabase'

let fleet: Ship[] = []

export function initFleet(ships: Ship[]): void {
  fleet = ships.map(ship => ({ ...ship }))
  console.log(`Fleet initialized with ${fleet.length} ships`)
}

export function getFleet(): Ship[] {
  return fleet
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
      items.push({
        type: 'INSUFFICIENT_FUEL' as const,
        severity: 'high' as const,
        shipId: ship.id,
        message: `${ship.name} has insufficient fuel`,
        dedupeKey: `INSUFFICIENT_FUEL:${ship.id}`,
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
