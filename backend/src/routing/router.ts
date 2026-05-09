/**
 * Water-only routing for the Strait of Hormuz fleet simulator.
 *
 * Mapbox is only the basemap. The backend owns route decisions.
 * Rules:
 * - stay inside fleet.json navigableWater
 * - avoid restricted zones
 * - avoid obvious Mapbox land using static visual land masks
 * - use sea-lane corridor points around Strait of Hormuz
 * - allow first escape edge if ship starts inside a restricted zone
 */

import { navigableWater, ports } from '../data/fleetLoader'
import { Position, Ship, Zone } from '../types'
import { haversineDistance } from '../simulator/geometry'
import {
  distanceKm,
  isPointInAnyPolygon,
  pointInPolygon,
  polygonBounds,
  routeIntersectsPolygon,
} from './geometry'

const GRID_STEP_DEGREES = 0.09
const MAX_EDGE_KM = 15
const SAMPLE_STEP_KM = 0.6
const NEIGHBOR_COUNT = 34
const ZONE_MARGIN_DEG = 0.14
const STRAIT_CORRIDOR_RADIUS_KM = 42

interface GraphNode {
  lat: number
  lng: number
}

interface Edge {
  to: number
  km: number
}

const STATIC_LAND_EXCLUSIONS: [number, number][][] = [
  [
    [25.18, 53.35], [25.12, 54.35], [25.12, 55.18], [24.98, 55.96],
    [24.72, 56.52], [24.34, 56.78], [23.62, 57.08], [23.38, 56.10],
    [23.52, 54.62], [24.10, 53.52],
  ],
  [
    [25.42, 55.05], [25.10, 55.72], [24.75, 56.25], [24.45, 56.42],
    [24.23, 56.05], [24.30, 55.35], [24.66, 54.86], [25.12, 54.72],
  ],
  [
    [26.84, 56.30], [26.72, 56.55], [26.54, 56.56], [26.50, 56.42],
    [26.66, 56.18],
  ],
]

const SEA_LANE_POINTS: Position[] = [
  p(29.48, 48.34), p(29.10, 48.80), p(28.70, 49.25), p(28.25, 49.70),
  p(27.80, 50.15), p(27.32, 50.55), p(26.95, 50.92), p(26.58, 51.18),
  p(26.22, 51.55), p(25.88, 52.00), p(25.68, 52.48), p(25.55, 53.05),
  p(25.56, 53.62), p(25.70, 54.12), p(25.94, 54.62), p(26.15, 55.10),
  p(26.32, 55.48), p(26.48, 55.78), p(26.55, 56.02), p(26.48, 56.25),
  p(26.28, 56.47), p(26.02, 56.68), p(25.72, 56.92), p(25.38, 57.20),
  p(25.02, 57.55), p(24.66, 57.92), p(24.28, 58.28), p(23.92, 58.58),
  p(23.45, 58.88), p(22.95, 59.25), p(22.50, 59.65),

  p(25.22, 54.18), p(25.35, 54.45), p(25.50, 54.75), p(25.72, 55.08),
  p(25.98, 55.38), p(26.22, 55.62), p(26.42, 55.86),

  p(25.46, 51.95), p(25.72, 51.58), p(26.05, 51.10), p(26.40, 50.75),
  p(26.56, 50.30), p(26.50, 50.55),

  p(24.72, 57.02), p(24.92, 57.35), p(24.98, 57.75), p(24.72, 58.10),
  p(24.32, 58.40), p(23.92, 58.58),

  p(26.62, 56.11), p(26.50, 56.18), p(26.40, 56.34), p(26.22, 56.50),
]

const BASE_NODES: GraphNode[] = buildBaseNodes()
const BASE_EDGES: Edge[][] = buildBaseEdges(BASE_NODES)

console.log(
  `[Router] Base graph ready: ${BASE_NODES.length} nodes, ` +
  `${BASE_EDGES.reduce((s, e) => s + e.length, 0)} edges`
)

export interface RouteResult {
  route: Position[]
  distanceKm: number
  avoidedSoftZones?: boolean
}

export function computeRoute(ship: Ship, zones: Zone[], softAvoidZones: Zone[] = []): RouteResult | null {
  return computeRouteAttempt(ship, zones, softAvoidZones) || computeRouteAttempt(ship, zones, [])
}

function computeRouteAttempt(ship: Ship, zones: Zone[], softAvoidZones: Zone[]): RouteResult | null {
  const start: Position = { lat: ship.lat, lng: ship.lng }
  const dest: Position = { lat: ship.destination.lat, lng: ship.destination.lng }
  const routingZones = [...zones, ...softAvoidZones]

  const effectiveStart = isLegalWaterPoint(start) ? start : snapToNearestWaterNode(start)
  if (!effectiveStart) return null
  if (!isLegalWaterPoint(dest)) return null
  if (zones.some(z => pointInPolygon(dest, z.coordinates))) return null

  const startInsideZones = routingZones
    .filter(z => pointInPolygon(effectiveStart, z.coordinates))
    .map(z => z.id)

  const directDistance = distanceKm(effectiveStart, dest)

  if (
    directDistance <= MAX_EDGE_KM &&
    isSegmentLegalForQuery(effectiveStart, dest, routingZones, startInsideZones, true)
  ) {
    console.log(`[Router] Direct route ${ship.id} ${directDistance.toFixed(1)}km`)
    return { route: [], distanceKm: directDistance, avoidedSoftZones: softAvoidZones.length > 0 }
  }

  const path = dijkstra(effectiveStart, dest, routingZones, startInsideZones)
  if (!path) {
    console.warn(`[Router] Route rejected for ${ship.id} to ${ship.destination.name}`)
    return null
  }

  const waypoints = path.slice(1, -1)

  return {
    route: waypoints,
    distanceKm: pathKm([effectiveStart, ...waypoints, dest]),
    avoidedSoftZones: softAvoidZones.length > 0,
  }
}

export function getRouterGraphDebug() {
  return {
    nodeCount: BASE_NODES.length,
    edgeCount: BASE_EDGES.reduce((sum, edges) => sum + edges.length, 0),
    maxEdgeKm: MAX_EDGE_KM,
    sampleStepKm: SAMPLE_STEP_KM,
    gridStepDegrees: GRID_STEP_DEGREES,
    seaLanePointCount: SEA_LANE_POINTS.length,
    landMaskCount: STATIC_LAND_EXCLUSIONS.length,
  }
}

export function isRouteValid(ship: Ship, zones: Zone[]): boolean {
  const pts = routePoints(ship)
  if (pts.length < 2) return false
  const startInsideZones = zones
    .filter(zone => pointInPolygon(pts[0], zone.coordinates))
    .map(zone => zone.id)

  return pts.every(p => isLegalWaterPoint(p)) &&
    pts.slice(0, -1).every((p, i) => isSegmentLegalForQuery(p, pts[i + 1], zones, startInsideZones, i === 0))
}

export function routeDistanceKm(ship: Ship): number {
  return pathKm(routePoints(ship))
}

export function isInsideNavigableWater(p: Position): boolean {
  return pointInPolygon(p, navigableWater)
}

export function validateRouteSegments(
  ship: Ship,
  zones: Zone[]
): Array<{ from: Position; to: Position; reason: string }> {
  const pts = routePoints(ship)
  const errors: Array<{ from: Position; to: Position; reason: string }> = []
  const startInsideZones = zones
    .filter(zone => pointInPolygon(pts[0], zone.coordinates))
    .map(zone => zone.id)

  for (let i = 0; i < pts.length - 1; i++) {
    const from = pts[i]
    const to = pts[i + 1]

    const fromReason = pointFailureReason(from)
    const toReason = pointFailureReason(to)

    if (fromReason || toReason) {
      errors.push({ from, to, reason: fromReason || toReason || 'endpoint_outside_water' })
      continue
    }

    if (distanceKm(from, to) > MAX_EDGE_KM) {
      errors.push({ from, to, reason: 'segment_too_long' })
      continue
    }

    const segmentReason = segmentFailureReason(from, to)
    if (segmentReason) {
      errors.push({ from, to, reason: segmentReason })
      continue
    }

    const clearsZones = i === 0 && startInsideZones.length > 0
      ? segmentEscapesStartingZones(from, to, zones, startInsideZones)
      : segmentClearsZones(from, to, zones)

    if (!clearsZones) {
      errors.push({ from, to, reason: 'segment_crosses_restricted_zone' })
    }
  }

  return errors
}

function dijkstra(
  start: Position,
  dest: Position,
  zones: Zone[],
  startInsideZones: string[]
): Position[] | null {
  const extra: GraphNode[] = [
    start,
    dest,
    ...zones.flatMap(zoneOffsetSeeds).filter(p => isPointLegal(p, zones)),
  ]

  const baseLen = BASE_NODES.length
  const startIdx = baseLen
  const destIdx = baseLen + 1
  const total = baseLen + extra.length

  const dist = new Float64Array(total).fill(Infinity)
  const prev = new Int32Array(total).fill(-1)
  const visited = new Uint8Array(total)

  dist[startIdx] = 0

  function nodePos(i: number): Position {
    return i < baseLen ? BASE_NODES[i] : extra[i - baseLen]
  }

  for (let iter = 0; iter < total; iter++) {
    let u = -1
    let best = Infinity

    for (let i = 0; i < total; i++) {
      if (!visited[i] && dist[i] < best) {
        best = dist[i]
        u = i
      }
    }

    if (u < 0 || u === destIdx) break

    visited[u] = 1
    const uPos = nodePos(u)

    if (u < baseLen) {
      for (const e of BASE_EDGES[u]) {
        if (visited[e.to]) continue

        const vPos = nodePos(e.to)
        if (!segmentClearsZones(uPos, vPos, zones)) continue

        const nd = dist[u] + e.km

        if (nd < dist[e.to]) {
          dist[e.to] = nd
          prev[e.to] = u
        }
      }
    }

    for (let v = 0; v < total; v++) {
      if (v === u || visited[v]) continue
      if (u < baseLen && v < baseLen) continue

      const vPos = nodePos(v)
      const km = distanceKm(uPos, vPos)

      if (km > MAX_EDGE_KM) continue

      const isFirstEdge = u === startIdx

      if (!isSegmentLegalForQuery(uPos, vPos, zones, startInsideZones, isFirstEdge)) {
        continue
      }

      const nd = dist[u] + km

      if (nd < dist[v]) {
        dist[v] = nd
        prev[v] = u
      }
    }
  }

  if (!Number.isFinite(dist[destIdx])) return null

  const path: Position[] = []

  for (let at = destIdx; at !== -1; at = prev[at]) {
    path.unshift(nodePos(at))
    if (at === startIdx) break
  }

  return path.length >= 2 ? path : null
}

function isSegmentLegal(from: Position, to: Position, zones: Zone[]): boolean {
  return isSegmentLegalForQuery(from, to, zones, [], false)
}

function isSegmentLegalForQuery(
  from: Position,
  to: Position,
  zones: Zone[],
  startInsideZones: string[],
  isFirstEdge: boolean
): boolean {
  if (!isLegalWaterPoint(from) || !isLegalWaterPoint(to)) return false
  if (distanceKm(from, to) > MAX_EDGE_KM) return false

  const clearsZones = isFirstEdge && startInsideZones.length > 0
    ? segmentEscapesStartingZones(from, to, zones, startInsideZones)
    : segmentClearsZones(from, to, zones)

  return clearsZones && segmentInWaterAndCorridor(from, to)
}

function isSegmentLegalNoZones(from: Position, to: Position): boolean {
  return isLegalWaterPoint(from) &&
    isLegalWaterPoint(to) &&
    distanceKm(from, to) <= MAX_EDGE_KM &&
    segmentInWaterAndCorridor(from, to)
}

function segmentInWaterAndCorridor(from: Position, to: Position): boolean {
  const km = distanceKm(from, to)
  const samples = Math.max(4, Math.ceil(km / SAMPLE_STEP_KM))

  for (let i = 1; i <= samples; i++) {
    const t = i / samples

    const point: Position = {
      lat: from.lat + (to.lat - from.lat) * t,
      lng: from.lng + (to.lng - from.lng) * t,
    }

    if (!isLegalWaterPoint(point)) return false
    if (isInStraitPrecisionBox(point) && !isNearSeaLane(point)) return false
  }

  return true
}

function segmentClearsZones(from: Position, to: Position, zones: Zone[]): boolean {
  if (zones.length === 0) return true

  const zoneCoordinates = zones.map(z => z.coordinates)

  if (zones.some(z => routeIntersectsPolygon(from, to, z.coordinates))) {
    return false
  }

  const km = distanceKm(from, to)
  const samples = Math.max(3, Math.ceil(km / SAMPLE_STEP_KM))

  for (let i = 1; i < samples; i++) {
    const t = i / samples

    const point: Position = {
      lat: from.lat + (to.lat - from.lat) * t,
      lng: from.lng + (to.lng - from.lng) * t,
    }

    if (isPointInAnyPolygon(point, zoneCoordinates)) return false
  }

  return true
}

function segmentEscapesStartingZones(
  from: Position,
  to: Position,
  zones: Zone[],
  startInsideZoneIds: string[]
): boolean {
  if (startInsideZoneIds.length === 0) {
    return segmentClearsZones(from, to, zones)
  }

  const startingZones = new Set(startInsideZoneIds)
  const otherZones = zones.filter(zone => !startingZones.has(zone.id))

  if (!segmentClearsZones(from, to, otherZones)) return false

  const km = distanceKm(from, to)
  const samples = Math.max(6, Math.ceil(km / SAMPLE_STEP_KM))
  let escaped = false

  for (let i = 1; i <= samples; i++) {
    const t = i / samples

    const point: Position = {
      lat: from.lat + (to.lat - from.lat) * t,
      lng: from.lng + (to.lng - from.lng) * t,
    }

    const insideStartingZone = zones.some(zone =>
      startingZones.has(zone.id) && pointInPolygon(point, zone.coordinates)
    )

    if (!insideStartingZone) escaped = true
    if (escaped && insideStartingZone) return false
  }

  return escaped
}

function isPointLegal(point: Position, zones: Zone[]): boolean {
  return isLegalWaterPoint(point) && !zones.some(z => pointInPolygon(point, z.coordinates))
}

function pathKm(path: Position[]): number {
  return path.slice(0, -1).reduce(
    (total, point, i) =>
      total + haversineDistance(point.lat, point.lng, path[i + 1].lat, path[i + 1].lng),
    0
  )
}

function routePoints(ship: Ship): Position[] {
  return [
    { lat: ship.lat, lng: ship.lng },
    ...ship.route,
    { lat: ship.destination.lat, lng: ship.destination.lng },
  ]
}

function buildBaseNodes(): GraphNode[] {
  const bounds = polygonBounds(navigableWater)
  const grid: GraphNode[] = []

  for (let lat = bounds.south; lat <= bounds.north; lat += GRID_STEP_DEGREES) {
    for (let lng = bounds.west; lng <= bounds.east; lng += GRID_STEP_DEGREES) {
      const node: Position = { lat: snap(lat), lng: snap(lng) }

      if (isLegalWaterPoint(node) && (!isInStraitPrecisionBox(node) || isNearSeaLane(node))) {
        grid.push(node)
      }
    }
  }

  const seeds: Position[] = [
    ...navigableWater.map(([lat, lng]) => ({ lat, lng })),
    ...Object.values(ports).map(port => ({ lat: port.lat, lng: port.lng })),
    ...SEA_LANE_POINTS,
    ...interpolateSeaLaneSeeds(SEA_LANE_POINTS),
  ]

  return dedupeNodes([...grid, ...seeds.filter(isLegalWaterPoint)])
}

function buildBaseEdges(nodes: GraphNode[]): Edge[][] {
  const adj: Edge[][] = Array.from({ length: nodes.length }, () => [])

  for (let i = 0; i < nodes.length; i++) {
    const candidates: Array<{ j: number; km: number }> = []

    for (let j = 0; j < nodes.length; j++) {
      if (j === i) continue

      const km = distanceKm(nodes[i], nodes[j])

      if (km <= MAX_EDGE_KM) {
        candidates.push({ j, km })
      }
    }

    candidates.sort((a, b) => a.km - b.km)

    for (const { j, km } of candidates.slice(0, NEIGHBOR_COUNT)) {
      if (isSegmentLegalNoZones(nodes[i], nodes[j])) {
        adj[i].push({ to: j, km })
      }
    }
  }

  return adj
}

function zoneOffsetSeeds(zone: Zone): Position[] {
  const bounds = polygonBounds(zone.coordinates)
  const margin = ZONE_MARGIN_DEG

  const centerLat = (bounds.north + bounds.south) / 2
  const centerLng = (bounds.west + bounds.east) / 2

  return [
    { lat: bounds.north + margin, lng: centerLng },
    { lat: bounds.south - margin, lng: centerLng },
    { lat: centerLat, lng: bounds.west - margin },
    { lat: centerLat, lng: bounds.east + margin },
    { lat: bounds.north + margin, lng: bounds.west - margin },
    { lat: bounds.north + margin, lng: bounds.east + margin },
    { lat: bounds.south - margin, lng: bounds.west - margin },
    { lat: bounds.south - margin, lng: bounds.east + margin },
  ].map(point => ({
    lat: snap(point.lat),
    lng: snap(point.lng),
  }))
}

function isLegalWaterPoint(point: Position): boolean {
  return isInsideNavigableWater(point) &&
    !STATIC_LAND_EXCLUSIONS.some(poly => pointInPolygon(point, poly))
}

function pointFailureReason(point: Position): string | null {
  if (!isInsideNavigableWater(point)) return 'endpoint_outside_water'
  if (STATIC_LAND_EXCLUSIONS.some(poly => pointInPolygon(point, poly))) return 'endpoint_inside_land_mask'
  return null
}

function segmentFailureReason(from: Position, to: Position): string | null {
  const km = distanceKm(from, to)
  const samples = Math.max(4, Math.ceil(km / SAMPLE_STEP_KM))

  for (let i = 1; i <= samples; i++) {
    const t = i / samples
    const point: Position = {
      lat: from.lat + (to.lat - from.lat) * t,
      lng: from.lng + (to.lng - from.lng) * t,
    }

    if (!isInsideNavigableWater(point)) return 'segment_outside_water'
    if (STATIC_LAND_EXCLUSIONS.some(poly => pointInPolygon(point, poly))) return 'segment_crosses_land_mask'
    if (isInStraitPrecisionBox(point) && !isNearSeaLane(point)) return 'segment_crosses_land_mask'
  }

  return null
}

function isInStraitPrecisionBox(point: Position): boolean {
  return point.lat >= 24.45 &&
    point.lat <= 26.85 &&
    point.lng >= 54.55 &&
    point.lng <= 57.45
}

function isNearSeaLane(point: Position): boolean {
  return SEA_LANE_POINTS.some(lane => distanceKm(point, lane) <= STRAIT_CORRIDOR_RADIUS_KM)
}

function interpolateSeaLaneSeeds(points: Position[]): Position[] {
  const out: Position[] = []

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]

    const km = distanceKm(a, b)
    const pieces = Math.max(1, Math.ceil(km / 10))

    for (let step = 1; step < pieces; step++) {
      const t = step / pieces

      out.push({
        lat: snap(a.lat + (b.lat - a.lat) * t),
        lng: snap(a.lng + (b.lng - a.lng) * t),
      })
    }
  }

  return out
}

function snapToNearestWaterNode(point: Position): Position | null {
  let best: GraphNode | null = null
  let bestKm = Infinity

  for (const node of BASE_NODES) {
    const km = distanceKm(point, node)

    if (km < bestKm) {
      bestKm = km
      best = node
    }
  }

  return best
}

function dedupeNodes(nodes: GraphNode[]): GraphNode[] {
  const seen = new Set<string>()
  const out: GraphNode[] = []

  for (const node of nodes) {
    const key = `${snap(node.lat)},${snap(node.lng)}`

    if (!seen.has(key)) {
      seen.add(key)

      out.push({
        lat: snap(node.lat),
        lng: snap(node.lng),
      })
    }
  }

  return out
}

function p(lat: number, lng: number): Position {
  return { lat, lng }
}

function snap(value: number): number {
  return Math.round(value * 10000) / 10000
}
