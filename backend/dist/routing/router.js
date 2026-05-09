"use strict";
/**
 * Water-only routing for the Strait of Hormuz fleet simulator.
 *
 * Strategy:
 * 1. Build a static base graph at module load time using a 0.1 degree grid
 *    filtered to the navigableWater polygon + polygon vertices + ports +
 *    curated strait waypoints.
 * 2. Pre-compute adjacency list between nearby nodes that pass segment-in-water
 *    validation (no zones at build time).
 * 3. For each route query, inject start + destination + zone detour offsets as
 *    temporary nodes and run Dijkstra, skipping edges that cross active zones.
 * 4. Simplify the resulting path greedily.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeRoute = computeRoute;
exports.isRouteValid = isRouteValid;
exports.routeDistanceKm = routeDistanceKm;
exports.isInsideNavigableWater = isInsideNavigableWater;
const fleetLoader_1 = require("../data/fleetLoader");
const geometry_1 = require("../simulator/geometry");
const geometry_2 = require("./geometry");
// ─── tuning ───────────────────────────────────────────────────────────────────
const GRID_STEP_DEGREES = 0.15; // ~11 km per step — fine enough for the narrow strait
const MAX_EDGE_KM = 35; // max segment length; keeps edges from skipping the peninsula
const SAMPLE_STEP_KM = 2; // sample density for in-water validation
const NEIGHBOR_COUNT = 12; // k-nearest considered per base node
const ZONE_MARGIN_DEG = 0.12; // offset around zone bounding boxes for detour seeds
// Visual landmasks for coastline areas that the provided navigableWater polygon
// includes too broadly. These keep demo routes off obvious Mapbox land while the
// hackathon-provided polygon remains the primary operating boundary.
const STATIC_LAND_EXCLUSIONS = [
    [
        [26.44, 56.20],
        [26.34, 56.46],
        [26.08, 56.56],
        [25.70, 56.48],
        [25.28, 56.08],
        [25.08, 55.70],
        [25.32, 55.52],
        [25.78, 55.72],
        [26.15, 55.96],
    ],
];
const BASE_NODES = buildBaseNodes();
const BASE_EDGES = buildBaseEdges(BASE_NODES);
console.log(`[Router] Base graph ready: ${BASE_NODES.length} nodes, ` +
    `${BASE_EDGES.reduce((s, e) => s + e.length, 0)} edges`);
function computeRoute(ship, zones) {
    const start = { lat: ship.lat, lng: ship.lng };
    const dest = { lat: ship.destination.lat, lng: ship.destination.lng };
    // Snap start to water if slightly outside (e.g. port position rounding)
    const effectiveStart = isLegalWaterPoint(start) ? start : snapToNearestWaterNode(start);
    if (!effectiveStart)
        return null;
    if (!isLegalWaterPoint(dest))
        return null;
    if (zones.some(z => (0, geometry_2.pointInPolygon)(dest, z.coordinates)))
        return null;
    const directDistance = (0, geometry_2.distanceKm)(effectiveStart, dest);
    // Fast path only for short final hops; longer voyages should use the graph so
    // they do not visually cut across the Musandam coastline.
    if (directDistance <= MAX_EDGE_KM && isSegmentLegal(effectiveStart, dest, zones)) {
        return { route: [], distanceKm: (0, geometry_2.distanceKm)(effectiveStart, dest) };
    }
    const path = dijkstra(effectiveStart, dest, zones);
    if (!path)
        return null;
    // Waypoints are everything between start and dest
    const waypoints = path.slice(1, -1);
    return {
        route: waypoints,
        distanceKm: pathKm([effectiveStart, ...waypoints, dest]),
    };
}
function isRouteValid(ship, zones) {
    const pts = routePoints(ship);
    if (pts.length < 2)
        return false;
    return pts.every(p => isLegalWaterPoint(p)) &&
        pts.slice(0, -1).every((p, i) => isSegmentLegal(p, pts[i + 1], zones));
}
function routeDistanceKm(ship) {
    return pathKm(routePoints(ship));
}
function isInsideNavigableWater(p) {
    return (0, geometry_2.pointInPolygon)(p, fleetLoader_1.navigableWater);
}
// ─── Dijkstra ─────────────────────────────────────────────────────────────────
function dijkstra(start, dest, zones) {
    // Extra nodes for this query: start, dest, zone offset seeds
    const extra = [
        start,
        dest,
        ...zones.flatMap(zoneOffsetSeeds).filter(p => isPointLegal(p, zones)),
    ];
    const baseLen = BASE_NODES.length;
    const startIdx = baseLen; // index of start in combined array
    const destIdx = baseLen + 1; // index of dest in combined array
    const total = baseLen + extra.length;
    const dist = new Float64Array(total).fill(Infinity);
    const prev = new Int32Array(total).fill(-1);
    const visited = new Uint8Array(total);
    dist[startIdx] = 0;
    function nodePos(i) {
        return i < baseLen ? BASE_NODES[i] : extra[i - baseLen];
    }
    for (let iter = 0; iter < total; iter++) {
        // Pick cheapest unvisited
        let u = -1, best = Infinity;
        for (let i = 0; i < total; i++) {
            if (!visited[i] && dist[i] < best) {
                best = dist[i];
                u = i;
            }
        }
        if (u < 0 || u === destIdx)
            break;
        visited[u] = 1;
        const uPos = nodePos(u);
        // Edges from the pre-built base graph (base-to-base)
        if (u < baseLen) {
            for (const e of BASE_EDGES[u]) {
                if (visited[e.to])
                    continue;
                const vPos = nodePos(e.to);
                // Re-check against runtime zones (base edges were built zone-free)
                if (!segmentClearsZones(uPos, vPos, zones))
                    continue;
                const nd = dist[u] + e.km;
                if (nd < dist[e.to]) {
                    dist[e.to] = nd;
                    prev[e.to] = u;
                }
            }
        }
        // Edges from/to extra nodes — check against all neighbours
        const uIsExtra = u >= baseLen;
        for (let v = 0; v < total; v++) {
            if (v === u || visited[v])
                continue;
            // Skip base-to-base (handled above)
            if (u < baseLen && v < baseLen)
                continue;
            const vPos = nodePos(v);
            const km = (0, geometry_2.distanceKm)(uPos, vPos);
            if (km > MAX_EDGE_KM)
                continue;
            if (!isSegmentLegal(uPos, vPos, zones))
                continue;
            const nd = dist[u] + km;
            if (nd < dist[v]) {
                dist[v] = nd;
                prev[v] = u;
            }
        }
    }
    if (!Number.isFinite(dist[destIdx]))
        return null;
    const path = [];
    for (let at = destIdx; at !== -1; at = prev[at]) {
        path.unshift(nodePos(at));
        if (at === startIdx)
            break;
    }
    return path.length >= 2 ? simplifyPath(path, zones) : null;
}
// ─── segment legality ─────────────────────────────────────────────────────────
/** Full check: water + zone avoidance. Used at query time. */
function isSegmentLegal(from, to, zones) {
    if (!isLegalWaterPoint(from) || !isLegalWaterPoint(to))
        return false;
    if ((0, geometry_2.distanceKm)(from, to) > MAX_EDGE_KM)
        return false;
    if (!segmentClearsZones(from, to, zones))
        return false;
    return segmentInWater(from, to);
}
/** Water-only check (no zone check). Used at graph build time. */
function isSegmentLegalNoZones(from, to) {
    if (!isLegalWaterPoint(from) || !isLegalWaterPoint(to))
        return false;
    if ((0, geometry_2.distanceKm)(from, to) > MAX_EDGE_KM)
        return false;
    return segmentInWater(from, to);
}
/** Sample segment points and verify each is inside navigableWater. */
function segmentInWater(from, to) {
    const km = (0, geometry_2.distanceKm)(from, to);
    const samples = Math.max(3, Math.ceil(km / SAMPLE_STEP_KM));
    for (let i = 1; i <= samples; i++) {
        const t = i / samples;
        const p = {
            lat: from.lat + (to.lat - from.lat) * t,
            lng: from.lng + (to.lng - from.lng) * t,
        };
        if (!isLegalWaterPoint(p))
            return false;
    }
    return true;
}
/** Check segment does not intersect or pass through any restricted zone. */
function segmentClearsZones(from, to, zones) {
    if (zones.length === 0)
        return true;
    const zCoords = zones.map(z => z.coordinates);
    if (zones.some(z => (0, geometry_2.routeIntersectsPolygon)(from, to, z.coordinates)))
        return false;
    const km = (0, geometry_2.distanceKm)(from, to);
    const samples = Math.max(2, Math.ceil(km / SAMPLE_STEP_KM));
    for (let i = 1; i < samples; i++) {
        const t = i / samples;
        const p = {
            lat: from.lat + (to.lat - from.lat) * t,
            lng: from.lng + (to.lng - from.lng) * t,
        };
        if ((0, geometry_2.isPointInAnyPolygon)(p, zCoords))
            return false;
    }
    return true;
}
function isPointLegal(p, zones) {
    return isLegalWaterPoint(p) && !zones.some(z => (0, geometry_2.pointInPolygon)(p, z.coordinates));
}
// ─── path helpers ─────────────────────────────────────────────────────────────
function simplifyPath(path, zones) {
    if (path.length <= 2)
        return path;
    const result = [path[0]];
    let anchor = 0;
    while (anchor < path.length - 1) {
        let next = path.length - 1;
        while (next > anchor + 1 && !isSegmentLegal(path[anchor], path[next], zones)) {
            next--;
        }
        result.push(path[next]);
        anchor = next;
    }
    return result;
}
function pathKm(path) {
    return path.slice(0, -1).reduce((total, p, i) => total + (0, geometry_1.haversineDistance)(p.lat, p.lng, path[i + 1].lat, path[i + 1].lng), 0);
}
function routePoints(ship) {
    return [
        { lat: ship.lat, lng: ship.lng },
        ...ship.route,
        { lat: ship.destination.lat, lng: ship.destination.lng },
    ];
}
// ─── graph construction ───────────────────────────────────────────────────────
function buildBaseNodes() {
    const bounds = (0, geometry_2.polygonBounds)(fleetLoader_1.navigableWater);
    const grid = [];
    for (let lat = bounds.south; lat <= bounds.north; lat += GRID_STEP_DEGREES) {
        for (let lng = bounds.west; lng <= bounds.east; lng += GRID_STEP_DEGREES) {
            const p = { lat: snap(lat), lng: snap(lng) };
            if (isLegalWaterPoint(p))
                grid.push(p);
        }
    }
    // Guaranteed-valid seeds for critical areas
    const seeds = [
        // Polygon vertices
        ...fleetLoader_1.navigableWater.map(([lat, lng]) => ({ lat, lng })),
        // All ports
        ...Object.values(fleetLoader_1.ports).map(p => ({ lat: p.lat, lng: p.lng })),
        // Strait of Hormuz threading waypoints
        { lat: 26.45, lng: 55.60 }, { lat: 26.40, lng: 55.70 },
        { lat: 26.35, lng: 55.80 }, { lat: 26.30, lng: 55.90 },
        { lat: 26.25, lng: 56.00 }, { lat: 26.20, lng: 56.10 },
        { lat: 26.15, lng: 56.15 }, { lat: 26.10, lng: 56.20 },
        { lat: 26.05, lng: 56.30 }, { lat: 26.00, lng: 56.40 },
        { lat: 26.00, lng: 56.50 }, { lat: 26.00, lng: 56.60 },
        { lat: 25.90, lng: 56.70 }, { lat: 25.80, lng: 56.80 },
        { lat: 25.70, lng: 56.90 }, { lat: 25.60, lng: 57.00 },
        { lat: 25.50, lng: 57.10 }, { lat: 25.40, lng: 57.20 },
        // Gulf interior relay
        { lat: 26.50, lng: 51.00 }, { lat: 26.00, lng: 52.00 },
        { lat: 25.50, lng: 52.50 }, { lat: 25.20, lng: 53.50 },
        { lat: 25.30, lng: 54.50 }, { lat: 25.50, lng: 55.50 },
        { lat: 26.00, lng: 55.00 }, { lat: 26.30, lng: 55.00 },
        { lat: 26.50, lng: 55.70 }, { lat: 26.50, lng: 55.90 },
        // Gulf of Oman
        { lat: 25.00, lng: 57.50 }, { lat: 24.50, lng: 57.80 },
        { lat: 24.00, lng: 58.20 }, { lat: 23.50, lng: 58.80 },
        { lat: 23.00, lng: 59.20 }, { lat: 22.50, lng: 59.60 },
    ];
    // Merge, filter to water, deduplicate
    const allSeeds = seeds.filter(p => isLegalWaterPoint(p));
    return dedupeNodes([...grid, ...allSeeds]);
}
function buildBaseEdges(nodes) {
    const n = nodes.length;
    const adj = Array.from({ length: n }, () => []);
    for (let i = 0; i < n; i++) {
        // Collect candidates within MAX_EDGE_KM
        const candidates = [];
        for (let j = 0; j < n; j++) {
            if (j === i)
                continue;
            const km = (0, geometry_2.distanceKm)(nodes[i], nodes[j]);
            if (km <= MAX_EDGE_KM)
                candidates.push({ j, km });
        }
        candidates.sort((a, b) => a.km - b.km);
        for (const { j, km } of candidates.slice(0, NEIGHBOR_COUNT)) {
            if (isSegmentLegalNoZones(nodes[i], nodes[j])) {
                adj[i].push({ to: j, km });
            }
        }
    }
    return adj;
}
// ─── zone detour offsets ──────────────────────────────────────────────────────
function zoneOffsetSeeds(zone) {
    const b = (0, geometry_2.polygonBounds)(zone.coordinates);
    const m = ZONE_MARGIN_DEG;
    const cx = (b.north + b.south) / 2;
    const cy = (b.west + b.east) / 2;
    return [
        { lat: b.north + m, lng: cy },
        { lat: b.south - m, lng: cy },
        { lat: cx, lng: b.west - m },
        { lat: cx, lng: b.east + m },
        { lat: b.north + m, lng: b.west - m },
        { lat: b.north + m, lng: b.east + m },
        { lat: b.south - m, lng: b.west - m },
        { lat: b.south - m, lng: b.east + m },
    ].map(p => ({ lat: snap(p.lat), lng: snap(p.lng) }));
}
// ─── utilities ────────────────────────────────────────────────────────────────
function snapToNearestWaterNode(p) {
    let best = null;
    let bestKm = Infinity;
    for (const node of BASE_NODES) {
        const km = (0, geometry_2.distanceKm)(p, node);
        if (km < bestKm) {
            bestKm = km;
            best = node;
        }
    }
    return best;
}
function isLegalWaterPoint(p) {
    return isInsideNavigableWater(p) &&
        !STATIC_LAND_EXCLUSIONS.some(poly => (0, geometry_2.pointInPolygon)(p, poly));
}
function dedupeNodes(nodes) {
    const seen = new Set();
    const out = [];
    for (const n of nodes) {
        const key = `${snap(n.lat)},${snap(n.lng)}`;
        if (!seen.has(key)) {
            seen.add(key);
            out.push({ lat: snap(n.lat), lng: snap(n.lng) });
        }
    }
    return out;
}
function snap(v) {
    return Math.round(v * 10000) / 10000;
}
