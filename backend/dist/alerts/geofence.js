"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkGeofences = checkGeofences;
const alertManager_1 = require("./alertManager");
const geometry_1 = require("../routing/geometry");
function checkGeofences(ships, zones) {
    const alerts = [];
    const updatedShips = ships.map((ship) => {
        const zone = zones.find((candidate) => (0, geometry_1.pointInPolygon)({ lat: ship.lat, lng: ship.lng }, candidate.coordinates));
        if (!zone)
            return ship;
        const alert = (0, alertManager_1.createAlert)({
            type: 'GEOFENCE_BREACH',
            severity: 'critical',
            shipId: ship.id,
            message: `${ship.name} entered ${zone.label}`,
            dedupeKey: `GEOFENCE_BREACH:${ship.id}:${zone.id}`,
        });
        if (alert)
            alerts.push(alert);
        return ship.status === 'out_of_fuel' ? ship : { ...ship, status: 'rerouting' };
    });
    return { ships: updatedShips, alerts };
}
