"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkProximity = checkProximity;
const alertManager_1 = require("./alertManager");
const geometry_1 = require("../simulator/geometry");
const PROXIMITY_THRESHOLD_KM = 2;
function checkProximity(ships) {
    const alerts = [];
    for (let i = 0; i < ships.length; i++) {
        for (let j = i + 1; j < ships.length; j++) {
            const a = ships[i];
            const b = ships[j];
            const distance = (0, geometry_1.haversineDistance)(a.lat, a.lng, b.lat, b.lng);
            if (distance >= PROXIMITY_THRESHOLD_KM)
                continue;
            const alert = (0, alertManager_1.createAlert)({
                type: 'PROXIMITY_WARNING',
                severity: distance < 1 ? 'high' : 'medium',
                shipId: a.id,
                message: `${a.name} and ${b.name} are ${distance.toFixed(2)}km apart`,
                dedupeKey: `PROXIMITY_WARNING:${[a.id, b.id].sort().join(':')}`,
            });
            if (alert)
                alerts.push(alert);
        }
    }
    return alerts;
}
