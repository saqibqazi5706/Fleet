import { Position, Ship, Zone } from '../types'
import { polygonCenter, routeIntersectsPolygon, distanceKm } from './geometry'

// How far (degrees) to push a waypoint away from a zone center.
// ~0.25° ≈ 25 km – enough to clear any realistically sized drawn zone.
const OFFSET_DEG = 0.25

/**
 * Compute a list of waypoints that route `ship` to its destination while
 * avoiding all blocking restricted zones.
 *
 * Algorithm:
 *  1. Collect every zone whose polygon intersects the direct path.
 *  2. For each blocking zone, generate a candidate waypoint on each of the
 *     four cardinal offsets from the zone centre.
 *  3. Pick the candidate that minimises total path length (start→wp→dest)
 *     and does not itself pass through another blocking zone.
 *  4. Repeat with the chosen waypoint as the new "start" until no more
 *     intersecting zones remain or the iteration limit is reached.
 *
 * This handles multiple overlapping zones far better than the previous
 * single-offset approach.
 */
export function computeRoute(ship: Ship, zones: Zone[]): Position[] {
  const dest: Position = { lat: ship.destination.lat, lng: ship.destination.lng }
  const waypoints: Position[] = []

  let current: Position = { lat: ship.lat, lng: ship.lng }
  const MAX_ITERATIONS = zones.length + 2

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const blocking = zones.filter((z) =>
      routeIntersectsPolygon(current, dest, z.coordinates)
    )

    if (blocking.length === 0) break  // clear path – done

    // Find the closest blocking zone centre to the current position
    const zone = blocking.reduce((nearest, z) => {
      const c = polygonCenter(z.coordinates)
      return distanceKm(current, c) < distanceKm(current, polygonCenter(nearest.coordinates))
        ? z
        : nearest
    }, blocking[0])

    const center = polygonCenter(zone.coordinates)

    // Generate four candidate bypass waypoints (N/S/E/W of the zone centre)
    const candidates: Position[] = [
      { lat: center.lat + OFFSET_DEG, lng: center.lng },
      { lat: center.lat - OFFSET_DEG, lng: center.lng },
      { lat: center.lat, lng: center.lng + OFFSET_DEG },
      { lat: center.lat, lng: center.lng - OFFSET_DEG },
    ]

    // Score candidates: pick shortest path that doesn't enter any zone
    const otherZones = zones.filter((z) => z.id !== zone.id)
    const best = candidates
      .filter((wp) => !otherZones.some((z) => routeIntersectsPolygon(current, wp, z.coordinates)))
      .sort((a, b) => pathLength(current, a, dest) - pathLength(current, b, dest))[0]

    if (!best) {
      // All candidates blocked – fall back to the perpendicular-offset candidate
      // closest to the direct line (better than nothing)
      const fallback = candidates.sort(
        (a, b) => pathLength(current, a, dest) - pathLength(current, b, dest)
      )[0]
      waypoints.push(fallback)
      current = fallback
    } else {
      waypoints.push(best)
      current = best
    }
  }

  return waypoints
}

function pathLength(a: Position, via: Position, b: Position): number {
  return distanceKm(a, via) + distanceKm(via, b)
}