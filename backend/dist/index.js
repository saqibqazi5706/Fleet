"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const fleetLoader_1 = require("./data/fleetLoader");
const tick_1 = require("./simulator/tick");
const alertManager_1 = require("./alerts/alertManager");
const zoneStore_1 = require("./zones/zoneStore");
const weatherFetcher_1 = require("./weather/weatherFetcher");
const snapshotStore_1 = require("./playback/snapshotStore");
const directiveHandler_1 = require("./directives/directiveHandler");
const distressParser_1 = require("./ai/distressParser");
const supabase_1 = require("./persistence/supabase");
const router_1 = require("./routing/router");
dotenv_1.default.config();
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
    },
});
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Health check
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        ships: (0, tick_1.getFleet)().length,
        uptime: process.uptime(),
    });
});
// Debug endpoint — see full fleet state in browser
app.get('/fleet', (_req, res) => {
    res.json((0, tick_1.getFleet)());
});
app.get('/zones', (_req, res) => {
    res.json((0, zoneStore_1.getZones)());
});
app.get('/alerts', (_req, res) => {
    res.json((0, alertManager_1.getAlerts)());
});
app.get('/reroute-approvals', (_req, res) => {
    res.json((0, tick_1.getRerouteApprovalState)());
});
app.get('/debug/routes', (_req, res) => {
    const zones = (0, zoneStore_1.getZones)();
    res.json((0, tick_1.getFleet)().map((ship) => {
        const illegalSegments = (0, router_1.validateRouteSegments)(ship, zones);
        return {
            shipId: ship.id,
            name: ship.name,
            status: ship.status,
            currentPosition: { lat: ship.lat, lng: ship.lng },
            destination: ship.destination,
            routeValid: (0, router_1.isRouteValid)(ship, zones),
            waypointCount: ship.route.length,
            distanceKm: Number((0, router_1.routeDistanceKm)(ship).toFixed(2)),
            illegalSegments,
            fuelCanReachDestination: ship.fuelReachable !== false,
            estimatedFuelNeeded: ship.estimatedFuelRequiredTons ?? null,
            fuelRemaining: ship.fuel,
        };
    }));
});
app.get('/debug/router-graph', (_req, res) => {
    res.json((0, router_1.getRouterGraphDebug)());
});
app.get('/playback/window', (_req, res) => {
    res.json((0, snapshotStore_1.getPlaybackWindow)());
});
function buildFleetState(timestamp = Date.now()) {
    return {
        ships: (0, tick_1.getFleet)(),
        zones: (0, zoneStore_1.getZones)(),
        alerts: (0, alertManager_1.getAlerts)(),
        weather: (0, weatherFetcher_1.getWeatherState)(),
        demoTimeScale: DEMO_TIME_SCALE,
        timestamp,
    };
}
function broadcastFleetState(timestamp = Date.now()) {
    io.emit('fleet_state', buildFleetState(timestamp));
}
function broadcastAlerts(alerts) {
    alerts.forEach((alert) => {
        io.emit('alert_created', alert);
        if (alert.type === 'PROXIMITY_WARNING') {
            const involvedShipIds = [alert.shipId, alert.relatedShipId].filter(Boolean);
            involvedShipIds.forEach((shipId) => {
                io.to(`captain:${shipId}`).emit('proximity_distress_signal', alert);
            });
        }
    });
    if (alerts.length > 0)
        io.emit('alerts_state', { alerts: (0, alertManager_1.getAlerts)() });
}
function broadcastAlertUpdate(alert) {
    io.emit('alert_updated', alert);
    io.emit('alerts_state', { alerts: (0, alertManager_1.getAlerts)() });
}
function broadcastRerouteApprovals() {
    io.emit('reroute_approval_state', { approvals: (0, tick_1.getRerouteApprovalState)() });
}
function handleZoneImpact() {
    const geofenceResult = (0, tick_1.runImmediateGeofenceCheck)((0, zoneStore_1.getZones)());
    const routeResult = (0, tick_1.recomputeFleetRoutes)((0, zoneStore_1.getZones)());
    broadcastRerouteApprovals();
    return [...geofenceResult.alerts, ...routeResult.alerts];
}
// Socket.IO connections
io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);
    // Send current fleet state immediately on connect
    socket.emit('fleet_state', buildFleetState());
    socket.emit('zones_state', { zones: (0, zoneStore_1.getZones)() });
    socket.emit('alerts_state', { alerts: (0, alertManager_1.getAlerts)() });
    socket.emit('reroute_approval_state', { approvals: (0, tick_1.getRerouteApprovalState)() });
    socket.emit('playback_window', (0, snapshotStore_1.getPlaybackWindow)());
    socket.on('join_command_room', () => {
        socket.join('command');
    });
    socket.on('join_ship_room', ({ shipId }) => {
        socket.join(`captain:${shipId}`);
    });
    socket.on('create_zone', (payload) => {
        const zone = (0, zoneStore_1.createZone)(payload);
        (0, supabase_1.saveZone)(zone);
        io.emit('zone_updated', { action: 'create', zone });
        broadcastAlerts(handleZoneImpact());
        broadcastFleetState();
    });
    socket.on('update_zone', (payload) => {
        const zone = (0, zoneStore_1.updateZone)(payload) || (0, zoneStore_1.createZone)({ ...payload, label: 'Command restricted zone' });
        (0, supabase_1.saveZone)(zone);
        io.emit('zone_updated', { action: 'update', zone });
        broadcastAlerts(handleZoneImpact());
        broadcastFleetState();
    });
    socket.on('delete_zone', ({ id }) => {
        const zone = (0, zoneStore_1.deleteZone)(id);
        if (!zone)
            return;
        io.emit('zone_updated', { action: 'delete', zone });
        const routeResult = (0, tick_1.recomputeFleetRoutes)((0, zoneStore_1.getZones)());
        broadcastAlerts(routeResult.alerts);
        broadcastFleetState();
    });
    socket.on('send_directive', (payload) => {
        const directive = (0, directiveHandler_1.createDirective)(payload);
        io.to(`captain:${payload.shipId}`).emit('directive_received', directive);
        io.to('command').emit('directive_received', directive);
    });
    socket.on('command_hold_ship', ({ shipId }) => {
        const ship = (0, tick_1.holdShip)(shipId);
        if (!ship)
            return;
        io.emit('directive_response_broadcast', {
            directiveId: `command-hold:${shipId}:${Date.now()}`,
            shipId,
            response: 'ACCEPT',
            timestamp: Date.now(),
        });
        broadcastFleetState();
    });
    socket.on('command_reroute_strait_lane', ({ shipId }) => {
        const waypoint = { lat: 26.22, lng: 56.5 };
        const ship = (0, tick_1.setShipWaypoint)(shipId, waypoint);
        if (!ship)
            return;
        const routeResult = (0, tick_1.recomputeFleetRoutes)((0, zoneStore_1.getZones)());
        broadcastAlerts(routeResult.alerts);
        io.emit('directive_response_broadcast', {
            directiveId: `command-reroute:${shipId}:${Date.now()}`,
            shipId,
            response: 'ACCEPT',
            timestamp: Date.now(),
        });
        broadcastFleetState();
    });
    socket.on('directive_response', async (payload) => {
        if (payload.response === 'ACCEPT') {
            if (payload.directive?.type) {
                (0, tick_1.queueDirective)({
                    id: payload.directiveId,
                    shipId: payload.shipId,
                    fromCommand: true,
                    type: payload.directive.type,
                    payload: payload.directive.payload || {},
                    sentAt: Date.now(),
                });
            }
            io.emit('directive_response_broadcast', {
                directiveId: payload.directiveId,
                shipId: payload.shipId,
                response: payload.response,
                timestamp: Date.now(),
            });
            broadcastFleetState();
            return;
        }
        (0, tick_1.markDistressed)(payload.shipId);
        const rawMessage = payload.distressMessage || 'Distress escalated without details';
        const preliminaryAlert = (0, alertManager_1.createAlert)({
            type: 'DISTRESS',
            severity: 'high',
            shipId: payload.shipId,
            message: `New distress signal from ${payload.shipId}`,
            dedupeKey: `DISTRESS:${payload.shipId}:${payload.directiveId}`,
            metadata: {
                aiStatus: 'pending_ai_analysis',
                rawMessage,
            },
        });
        if (preliminaryAlert) {
            io.emit('distress_signal', {
                shipId: payload.shipId,
                raw: rawMessage,
                alert: preliminaryAlert,
                receivedAt: preliminaryAlert.createdAt,
            });
            broadcastAlerts([preliminaryAlert]);
            broadcastFleetState();
        }
        const distress = await (0, distressParser_1.parseDistress)(payload.shipId, rawMessage);
        (0, supabase_1.saveDistress)(distress);
        const distressAlert = preliminaryAlert
            ? (0, alertManager_1.updateAlert)(preliminaryAlert.id, {
                severity: distress.severity,
                message: `Distress from ${payload.shipId}: ${distress.issueType}`,
                metadata: {
                    aiStatus: 'analyzed',
                    rawMessage: distress.raw,
                    parsed: distress,
                },
            })
            : null;
        io.emit('directive_response_broadcast', {
            directiveId: payload.directiveId,
            shipId: payload.shipId,
            response: payload.response,
            distress,
            timestamp: Date.now(),
        });
        io.emit('distress_parsed', {
            shipId: payload.shipId,
            raw: distress.raw,
            parsed: distress,
            alert: distressAlert,
            parsedAt: distress.parsedAt,
        });
        if (distressAlert)
            broadcastAlertUpdate(distressAlert);
        broadcastFleetState();
    });
    socket.on('approve_reroute', ({ id }) => {
        const result = (0, tick_1.approvePendingReroute)(id);
        if (!result.approval)
            return;
        io.emit('reroute_approval_decided', result.approval);
        broadcastRerouteApprovals();
        broadcastFleetState();
    });
    socket.on('reject_reroute_or_hold', ({ id }) => {
        const result = (0, tick_1.holdPendingReroute)(id);
        if (!result.approval)
            return;
        io.emit('reroute_approval_decided', result.approval);
        broadcastRerouteApprovals();
        broadcastFleetState();
    });
    socket.on('request_snapshot', ({ requestId, timestamp }) => {
        const snapshot = (0, snapshotStore_1.getSnapshot)(timestamp) || (0, snapshotStore_1.maybeSaveSnapshot)((0, tick_1.getFleet)(), Date.now());
        socket.emit('snapshot_response', {
            requestId,
            snapshot: snapshot?.ships || (0, tick_1.getFleet)(),
            timestamp: snapshot?.timestamp || Date.now(),
        });
    });
    socket.on('acknowledge_alert', ({ alertId }) => {
        const alert = (0, alertManager_1.acknowledgeAlert)(alertId);
        if (alert)
            io.emit('alerts_state', { alerts: (0, alertManager_1.getAlerts)() });
    });
    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
    });
});
// Initialize fleet
(0, tick_1.initFleet)(fleetLoader_1.initialFleet);
(0, snapshotStore_1.maybeSaveSnapshot)((0, tick_1.getFleet)(), Date.now());
(0, weatherFetcher_1.refreshWeather)();
setInterval(weatherFetcher_1.refreshWeather, 5 * 60 * 1000);
// Tick loop — runs every 1 second
const TICK_INTERVAL_MS = 1000;
const DEMO_TIME_SCALE = Math.min(Math.max(Number(process.env.DEMO_TIME_SCALE || '1'), 1), 30);
let lastTickTime = Date.now();
setInterval(() => {
    const now = Date.now();
    const deltaMs = now - lastTickTime;
    lastTickTime = now;
    const result = (0, tick_1.updateFleet)(deltaMs * DEMO_TIME_SCALE, (0, zoneStore_1.getZones)(), (0, weatherFetcher_1.getWeatherState)());
    io.emit('fleet_state', buildFleetState(now));
    broadcastAlerts(result.alerts);
    io.emit('playback_window', (0, snapshotStore_1.getPlaybackWindow)());
}, TICK_INTERVAL_MS);
// Start server
const PORT = parseInt(process.env.PORT || '4000', 10);
httpServer.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
    console.log(`[Simulator] Demo time scale: ${DEMO_TIME_SCALE}x`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Fleet state: http://localhost:${PORT}/fleet`);
});
