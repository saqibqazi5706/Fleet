"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRerouteApprovals = getRerouteApprovals;
exports.getPendingRerouteApprovals = getPendingRerouteApprovals;
exports.createInsideZoneRerouteApprovals = createInsideZoneRerouteApprovals;
exports.approveRerouteApproval = approveRerouteApproval;
exports.holdRerouteApproval = holdRerouteApproval;
const alertManager_1 = require("../alerts/alertManager");
const geometry_1 = require("./geometry");
const router_1 = require("./router");
const approvals = new Map();
function getRerouteApprovals() {
    return Array.from(approvals.values()).sort((a, b) => b.createdAt - a.createdAt);
}
function getPendingRerouteApprovals() {
    return getRerouteApprovals().filter((approval) => approval.status === 'pending');
}
function createInsideZoneRerouteApprovals(ships, zones) {
    const created = [];
    const alerts = [];
    ships.forEach((ship) => {
        const insideZones = zones.filter((zone) => (0, geometry_1.pointInPolygon)({ lat: ship.lat, lng: ship.lng }, zone.coordinates));
        if (insideZones.length === 0)
            return;
        const id = `${ship.id}:${insideZones.map((zone) => zone.id).sort().join('|')}`;
        const existing = approvals.get(id);
        if (existing?.status === 'pending')
            return;
        const routeResult = (0, router_1.computeRoute)(ship, zones);
        const approval = {
            id,
            shipId: ship.id,
            shipName: ship.name,
            reason: `Ship inside restricted zone: ${insideZones.map((zone) => zone.label || zone.id).join(', ')}`,
            proposedRoute: routeResult?.route || [],
            proposedDistanceKm: routeResult ? Number(routeResult.distanceKm.toFixed(2)) : null,
            status: routeResult ? 'pending' : 'failed',
            createdAt: Date.now(),
            message: routeResult ? undefined : 'No valid escape route exists.',
        };
        approvals.set(id, approval);
        created.push(approval);
        const alert = (0, alertManager_1.createAlert)({
            type: routeResult ? 'GEOFENCE_BREACH' : 'STRANDED',
            severity: 'critical',
            shipId: ship.id,
            message: routeResult
                ? `${ship.name} is inside a restricted zone. Command approval required before reroute.`
                : `${ship.name} is trapped inside a restricted zone with no valid escape route.`,
            dedupeKey: `${routeResult ? 'REROUTE_APPROVAL' : 'TRAPPED'}:${id}`,
            metadata: { approval },
        });
        if (alert)
            alerts.push(alert);
    });
    return { approvals: created, alerts };
}
function approveRerouteApproval(id) {
    const approval = approvals.get(id);
    if (!approval || approval.status !== 'pending')
        return null;
    const updated = { ...approval, status: 'approved', decidedAt: Date.now() };
    approvals.set(id, updated);
    return updated;
}
function holdRerouteApproval(id) {
    const approval = approvals.get(id);
    if (!approval || approval.status !== 'pending')
        return null;
    const updated = { ...approval, status: 'held', decidedAt: Date.now(), message: 'Command selected hold position.' };
    approvals.set(id, updated);
    return updated;
}
