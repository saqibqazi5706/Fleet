"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pointInPolygon = pointInPolygon;
exports.routeIntersectsPolygon = routeIntersectsPolygon;
exports.segmentIntersectsPolygon = segmentIntersectsPolygon;
exports.polygonCenter = polygonCenter;
exports.distanceKm = distanceKm;
exports.pointOnPolygonBoundary = pointOnPolygonBoundary;
exports.isPointInAnyPolygon = isPointInAnyPolygon;
exports.polygonBounds = polygonBounds;
exports.segmentsIntersect = segmentsIntersect;
const geometry_1 = require("../simulator/geometry");
function pointInPolygon(point, polygon) {
    if (pointOnPolygonBoundary(point, polygon))
        return true;
    const x = point.lng;
    const y = point.lat;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const yi = polygon[i][0];
        const xi = polygon[i][1];
        const yj = polygon[j][0];
        const xj = polygon[j][1];
        const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
        if (intersects)
            inside = !inside;
    }
    return inside;
}
function routeIntersectsPolygon(from, to, polygon) {
    if (pointInPolygon(from, polygon) || pointInPolygon(to, polygon))
        return true;
    for (let i = 0; i < polygon.length; i++) {
        const a = toPosition(polygon[i]);
        const b = toPosition(polygon[(i + 1) % polygon.length]);
        if (segmentsIntersect(from, to, a, b))
            return true;
    }
    return false;
}
function segmentIntersectsPolygon(from, to, polygon) {
    return routeIntersectsPolygon(from, to, polygon);
}
function polygonCenter(polygon) {
    const total = polygon.reduce((acc, coord) => ({ lat: acc.lat + coord[0], lng: acc.lng + coord[1] }), { lat: 0, lng: 0 });
    return {
        lat: total.lat / polygon.length,
        lng: total.lng / polygon.length,
    };
}
function distanceKm(a, b) {
    return (0, geometry_1.haversineDistance)(a.lat, a.lng, b.lat, b.lng);
}
function pointOnPolygonBoundary(point, polygon) {
    for (let i = 0; i < polygon.length; i++) {
        const a = toPosition(polygon[i]);
        const b = toPosition(polygon[(i + 1) % polygon.length]);
        if (pointOnSegment(point, a, b))
            return true;
    }
    return false;
}
function isPointInAnyPolygon(point, polygons) {
    return polygons.some((polygon) => pointInPolygon(point, polygon));
}
function polygonBounds(polygon) {
    return polygon.reduce((bounds, coord) => ({
        north: Math.max(bounds.north, coord[0]),
        south: Math.min(bounds.south, coord[0]),
        east: Math.max(bounds.east, coord[1]),
        west: Math.min(bounds.west, coord[1]),
    }), { north: -Infinity, south: Infinity, east: -Infinity, west: Infinity });
}
function toPosition(coord) {
    return { lat: coord[0], lng: coord[1] };
}
function segmentsIntersect(a, b, c, d) {
    const det = (p, q, r) => (q.lng - p.lng) * (r.lat - p.lat) - (q.lat - p.lat) * (r.lng - p.lng);
    const d1 = det(a, b, c);
    const d2 = det(a, b, d);
    const d3 = det(c, d, a);
    const d4 = det(c, d, b);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}
function pointOnSegment(point, a, b) {
    const cross = (point.lat - a.lat) * (b.lng - a.lng) - (point.lng - a.lng) * (b.lat - a.lat);
    if (Math.abs(cross) > 1e-9)
        return false;
    const dot = (point.lng - a.lng) * (b.lng - a.lng) + (point.lat - a.lat) * (b.lat - a.lat);
    if (dot < -1e-9)
        return false;
    const squaredLength = (b.lng - a.lng) ** 2 + (b.lat - a.lat) ** 2;
    return dot <= squaredLength + 1e-9;
}
