"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAlerts = getAlerts;
exports.createAlert = createAlert;
exports.acknowledgeAlert = acknowledgeAlert;
const alerts = new Map();
function getAlerts() {
    return Array.from(alerts.values()).sort((a, b) => b.createdAt - a.createdAt);
}
function createAlert(input) {
    const dedupeKey = input.dedupeKey || `${input.type}:${input.shipId}`;
    const existing = alerts.get(dedupeKey);
    if (existing && existing.active && !existing.acknowledged)
        return null;
    const alert = {
        id: `${dedupeKey}:${Date.now()}`,
        type: input.type,
        severity: input.severity,
        shipId: input.shipId,
        message: input.message,
        active: true,
        acknowledged: false,
        createdAt: Date.now(),
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
