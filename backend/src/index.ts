import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import dotenv from 'dotenv'

import { initialFleet } from './data/fleetLoader'
import { initFleet, updateFleet, getFleet } from './simulator/tick'

dotenv.config()

const app = express()
const httpServer = createServer(app)

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
})

app.use(cors())
app.use(express.json())

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    ships: getFleet().length,
    uptime: process.uptime(),
  })
})

// Debug endpoint — see full fleet state in browser
app.get('/fleet', (_req, res) => {
  res.json(getFleet())
})

// Socket.IO connections
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`)

  // Send current fleet state immediately on connect
  socket.emit('fleet_state', {
    ships: getFleet(),
    timestamp: Date.now(),
  })

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`)
  })
})

// Initialize fleet
initFleet(initialFleet)

// Tick loop — runs every 1 second
const TICK_INTERVAL_MS = 1000
let lastTickTime = Date.now()

setInterval(() => {
  const now = Date.now()
  const deltaMs = now - lastTickTime
  lastTickTime = now

  const updatedFleet = updateFleet(deltaMs)

  io.emit('fleet_state', {
    ships: updatedFleet,
    timestamp: now,
  })
}, TICK_INTERVAL_MS)

// Start server
const PORT = parseInt(process.env.PORT || '4000', 10)
httpServer.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`)
  console.log(`Health check: http://localhost:${PORT}/health`)
  console.log(`Fleet state: http://localhost:${PORT}/fleet`)
})
