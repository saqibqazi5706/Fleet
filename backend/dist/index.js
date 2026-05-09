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
app.get('/playback/window', (_req, res) => {
    res.json((0, snapshotStore_1.getPlaybackWindow)());
});
// Socket.IO connections
io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);
    // Send current fleet state immediately on connect
    socket.emit('fleet_state', {
        ships: (0, tick_1.getFleet)(),
        timestamp: Date.now(),
    });
    socket.emit('zones_state', { zones: (0, zoneStore_1.getZones)() });
    socket.emit('alerts_state', { alerts: (0, alertManager_1.getAlerts)() });
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
    });
    socket.on('update_zone', (payload) => {
        const zone = (0, zoneStore_1.updateZone)(payload);
        if (!zone)
            return;
        (0, supabase_1.saveZone)(zone);
        io.emit('zone_updated', { action: 'update', zone });
    });
    socket.on('delete_zone', ({ id }) => {
        const zone = (0, zoneStore_1.deleteZone)(id);
        if (!zone)
            return;
        io.emit('zone_updated', { action: 'delete', zone });
    });
    socket.on('send_directive', (payload) => {
        const directive = (0, directiveHandler_1.createDirective)(payload);
        io.to(`captain:${payload.shipId}`).emit('directive_received', directive);
        io.to('command').emit('directive_received', directive);
    });
    socket.on('directive_response', async (payload) => {
        if (payload.response === 'ACCEPT') {
            if (payload.directive?.type === 'HOLD_POSITION')
                (0, tick_1.holdShip)(payload.shipId);
            if (payload.directive?.type === 'CHANGE_DESTINATION' && payload.directive.payload?.destination) {
                (0, tick_1.setShipDestination)(payload.shipId, payload.directive.payload.destination);
            }
            if (payload.directive?.type === 'REROUTE_WAYPOINT' && payload.directive.payload?.waypoint) {
                (0, tick_1.setShipWaypoint)(payload.shipId, payload.directive.payload.waypoint);
            }
            io.emit('fleet_state', { ships: (0, tick_1.getFleet)(), timestamp: Date.now() });
            return;
        }
        (0, tick_1.markDistressed)(payload.shipId);
        const distress = await (0, distressParser_1.parseDistress)(payload.shipId, payload.distressMessage || 'Distress escalated without details');
        (0, supabase_1.saveDistress)(distress);
        io.emit('distress_parsed', distress);
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
let lastTickTime = Date.now();
setInterval(() => {
    const now = Date.now();
    const deltaMs = now - lastTickTime;
    lastTickTime = now;
    const result = (0, tick_1.updateFleet)(deltaMs, (0, zoneStore_1.getZones)(), (0, weatherFetcher_1.isAdverseWeather)());
    io.emit('fleet_state', {
        ships: result.ships,
        timestamp: now,
    });
    result.alerts.forEach((alert) => io.emit('alert_created', alert));
    io.emit('playback_window', (0, snapshotStore_1.getPlaybackWindow)());
}, TICK_INTERVAL_MS);
// Start server
const PORT = parseInt(process.env.PORT || '4000', 10);
httpServer.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Fleet state: http://localhost:${PORT}/fleet`);
});
