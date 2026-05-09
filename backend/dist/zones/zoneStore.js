"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getZones = getZones;
exports.createZone = createZone;
exports.updateZone = updateZone;
exports.deleteZone = deleteZone;
const zones = new Map();
function getZones() {
    return Array.from(zones.values());
}
function createZone(input) {
    const zone = {
        id: input.id,
        coordinates: input.coordinates,
        label: input.label || 'Restricted zone',
        createdAt: Date.now(),
    };
    zones.set(zone.id, zone);
    return zone;
}
function updateZone(input) {
    const existing = zones.get(input.id);
    if (!existing)
        return null;
    const updated = { ...existing, coordinates: input.coordinates };
    zones.set(updated.id, updated);
    return updated;
}
function deleteZone(id) {
    const existing = zones.get(id);
    if (!existing)
        return null;
    zones.delete(id);
    return existing;
}
