"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAlerts = getAlerts;
exports.createAlert = createAlert;
exports.acknowledgeAlert = acknowledgeAlert;
exports.updateAlert = updateAlert;
const alerts = new Map();
function getAlerts() {
    return Array.from(alerts.values()).sort((a, b) => b.createdAt - a.createdAt);
}
function createAlert(input) {
    const dedupeKey = input.dedupeKey || `${input.type}:${input.shipId || 'fleet'}`;
    const existing = alerts.get(dedupeKey);
    if (existing && existing.active && !existing.acknowledged)
        return null;
    const alert = {
        id: `${dedupeKey}:${Date.now()}`,
        type: input.type,
        severity: input.severity,
        shipId: input.shipId,
        relatedShipId: input.relatedShipId,
        message: input.message,
        active: true,
        acknowledged: false,
        createdAt: Date.now(),
        metadata: input.metadata,
    };
    alerts.set(dedupeKey, alert);
    return alert;
}
function acknowledgeAlert(alertId) {
    for (const [key, alert] of alerts.entries()) {
        if (alert.id === alertId) {
            const updated = { ...alert, acknowledged: true, active: false };
            alerts.set(key, updated);
            return updated;
        }
    }
    return null;
}
function updateAlert(alertId, patch) {
    for (const [key, alert] of alerts.entries()) {
        if (alert.id === alertId) {
            const updated = { ...alert, ...patch };
            alerts.set(key, updated);
            return updated;
        }
    }
    return null;
}
