import { Alert, Ship, Zone } from '../types'
import { createAlert } from './alertManager'
import { pointInPolygon } from '../routing/geometry'

export function checkGeofences(ships: Ship[], zones: Zone[]): { ships: Ship[]; alerts: Alert[] } {
  const alerts: Alert[] = []

  const updatedShips = ships.map((ship) => {
    const zone = zones.find((candidate) =>
      pointInPolygon({ lat: ship.lat, lng: ship.lng }, candidate.coordinates)
    )

    if (!zone) return ship

    const alert = createAlert({
      type: 'GEOFENCE_BREACH',
      severity: 'critical',
      shipId: ship.id,
      message: `${ship.name} entered ${zone.label}`,
      dedupeKey: `GEOFENCE_BREACH:${ship.id}:${zone.id}`,
    })
    if (alert) alerts.push(alert)

    return ship.status === 'out_of_fuel' ? ship : { ...ship, status: 'rerouting' as const }
  })

  return { ships: updatedShips, alerts }
}
