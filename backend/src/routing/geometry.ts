import { Position } from '../types'
import { haversineDistance } from '../simulator/geometry'

export function pointInPolygon(point: Position, polygon: [number, number][]): boolean {
  const x = point.lng
  const y = point.lat
  let inside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const yi = polygon[i][0]
    const xi = polygon[i][1]
    const yj = polygon[j][0]
    const xj = polygon[j][1]
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }

  return inside
}

export function routeIntersectsPolygon(from: Position, to: Position, polygon: [number, number][]): boolean {
  if (pointInPolygon(from, polygon) || pointInPolygon(to, polygon)) return true

  for (let i = 0; i < polygon.length; i++) {
    const a = toPosition(polygon[i])
    const b = toPosition(polygon[(i + 1) % polygon.length])
    if (segmentsIntersect(from, to, a, b)) return true
  }

  return false
}

export function polygonCenter(polygon: [number, number][]): Position {
  const total = polygon.reduce(
    (acc, coord) => ({ lat: acc.lat + coord[0], lng: acc.lng + coord[1] }),
    { lat: 0, lng: 0 }
  )

  return {
    lat: total.lat / polygon.length,
    lng: total.lng / polygon.length,
  }
}

export function distanceKm(a: Position, b: Position): number {
  return haversineDistance(a.lat, a.lng, b.lat, b.lng)
}

function toPosition(coord: [number, number]): Position {
  return { lat: coord[0], lng: coord[1] }
}

function segmentsIntersect(a: Position, b: Position, c: Position, d: Position): boolean {
  const det = (p: Position, q: Position, r: Position) =>
    (q.lng - p.lng) * (r.lat - p.lat) - (q.lat - p.lat) * (r.lng - p.lng)

  const d1 = det(a, b, c)
  const d2 = det(a, b, d)
  const d3 = det(c, d, a)
  const d4 = det(c, d, b)

  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
}
