"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.degreesToRadians = degreesToRadians;
exports.radiansToDegrees = radiansToDegrees;
exports.calculateBearing = calculateBearing;
exports.moveAlongBearing = moveAlongBearing;
exports.haversineDistance = haversineDistance;
const EARTH_RADIUS_KM = 6371;
function degreesToRadians(degrees) {
    return degrees * (Math.PI / 180);
}
function radiansToDegrees(radians) {
    return radians * (180 / Math.PI);
}
// Calculate bearing from point A to point B in degrees
function calculateBearing(lat1, lng1, lat2, lng2) {
    const dLng = degreesToRadians(lng2 - lng1);
    const lat1Rad = degreesToRadians(lat1);
    const lat2Rad = degreesToRadians(lat2);
    const y = Math.sin(dLng) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
        Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
    const bearing = radiansToDegrees(Math.atan2(y, x));
    return (bearing + 360) % 360;
}
// Move a point along a bearing by distanceKm
function moveAlongBearing(lat, lng, bearingDeg, distanceKm) {
    const bearingRad = degreesToRadians(bearingDeg);
    const latRad = degreesToRadians(lat);
    const lngRad = degreesToRadians(lng);
    const d = distanceKm / EARTH_RADIUS_KM;
    const newLatRad = Math.asin(Math.sin(latRad) * Math.cos(d) +
        Math.cos(latRad) * Math.sin(d) * Math.cos(bearingRad));
    const newLngRad = lngRad +
        Math.atan2(Math.sin(bearingRad) * Math.sin(d) * Math.cos(latRad), Math.cos(d) - Math.sin(latRad) * Math.sin(newLatRad));
    return {
        lat: radiansToDegrees(newLatRad),
        lng: radiansToDegrees(newLngRad),
    };
}
// Haversine distance between two points in km
function haversineDistance(lat1, lng1, lat2, lng2) {
    const dLat = degreesToRadians(lat2 - lat1);
    const dLng = degreesToRadians(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(degreesToRadians(lat1)) *
            Math.cos(degreesToRadians(lat2)) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_KM * c;
}
