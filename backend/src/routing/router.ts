import { Position, Ship, Zone } from '../types'
import { polygonCenter, routeIntersectsPolygon } from './geometry'

export function computeRoute(ship: Ship, zones: Zone[]): Position[] {
  const start = { lat: ship.lat, lng: ship.lng }
  const end = { lat: ship.destination.lat, lng: ship.destination.lng }
  const blockingZone = zones.find((zone) => routeIntersectsPolygon(start, end, zone.coordinates))

  if (!blockingZone) return []

  const center = polygonCenter(blockingZone.coordinates)
  const offsetLat = start.lat >= center.lat ? 0.18 : -0.18
  const offsetLng = start.lng >= center.lng ? 0.18 : -0.18

  return [{ lat: center.lat + offsetLat, lng: center.lng + offsetLng }]
}
