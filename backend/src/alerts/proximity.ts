import { Alert, Ship } from '../types'
import { createAlert } from './alertManager'
import { haversineDistance } from '../simulator/geometry'

const PROXIMITY_THRESHOLD_KM = 2

export function checkProximity(ships: Ship[]): Alert[] {
  const alerts: Alert[] = []

  for (let i = 0; i < ships.length; i++) {
    for (let j = i + 1; j < ships.length; j++) {
      const a = ships[i]
      const b = ships[j]
      const distance = haversineDistance(a.lat, a.lng, b.lat, b.lng)
      if (distance >= PROXIMITY_THRESHOLD_KM) continue

      const alert = createAlert({
        type: 'PROXIMITY_WARNING',
        severity: distance < 1 ? 'high' : 'medium',
        shipId: a.id,
        relatedShipId: b.id,
        message: `${a.name} and ${b.name} are ${distance.toFixed(2)}km apart`,
        dedupeKey: `PROXIMITY_WARNING:${[a.id, b.id].sort().join(':')}`,
        metadata: {
          distressSignal: true,
          distanceKm: Number(distance.toFixed(3)),
          ships: [
            { id: a.id, name: a.name, lat: a.lat, lng: a.lng },
            { id: b.id, name: b.name, lat: b.lat, lng: b.lng },
          ],
        },
      })
      if (alert) alerts.push(alert)
    }
  }

  return alerts
}
