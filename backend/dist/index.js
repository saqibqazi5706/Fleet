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
// Socket.IO connections
io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);
    // Send current fleet state immediately on connect
    socket.emit('fleet_state', {
        ships: (0, tick_1.getFleet)(),
        timestamp: Date.now(),
    });
    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
    });
});
// Initialize fleet
(0, tick_1.initFleet)(fleetLoader_1.initialFleet);
// Tick loop — runs every 1 second
const TICK_INTERVAL_MS = 1000;
let lastTickTime = Date.now();
setInterval(() => {
    const now = Date.now();
    const deltaMs = now - lastTickTime;
    lastTickTime = now;
    const updatedFleet = (0, tick_1.updateFleet)(deltaMs);
    io.emit('fleet_state', {
        ships: updatedFleet,
        timestamp: now,
    });
}, TICK_INTERVAL_MS);
// Start server
const PORT = parseInt(process.env.PORT || '4000', 10);
httpServer.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Fleet state: http://localhost:${PORT}/fleet`);
});
