"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeRoute = computeRoute;
const geometry_1 = require("./geometry");
function computeRoute(ship, zones) {
    const start = { lat: ship.lat, lng: ship.lng };
    const end = { lat: ship.destination.lat, lng: ship.destination.lng };
    const blockingZone = zones.find((zone) => (0, geometry_1.routeIntersectsPolygon)(start, end, zone.coordinates));
    if (!blockingZone)
        return [];
    const center = (0, geometry_1.polygonCenter)(blockingZone.coordinates);
    const offsetLat = start.lat >= center.lat ? 0.18 : -0.18;
    const offsetLng = start.lng >= center.lng ? 0.18 : -0.18;
    return [{ lat: center.lat + offsetLat, lng: center.lng + offsetLng }];
}
