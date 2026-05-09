import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import dotenv from 'dotenv'

import { initialFleet } from './data/fleetLoader'
import {
  holdShip,
  initFleet,
  markDistressed,
  setShipDestination,
  setShipWaypoint,
  updateFleet,
  getFleet,
} from './simulator/tick'
import { acknowledgeAlert, getAlerts } from './alerts/alertManager'
import { createZone, deleteZone, getZones, updateZone } from './zones/zoneStore'
import { isAdverseWeather, refreshWeather } from './weather/weatherFetcher'
import { getPlaybackWindow, getSnapshot, maybeSaveSnapshot } from './playback/snapshotStore'
import { createDirective } from './directives/directiveHandler'
import { parseDistress } from './ai/distressParser'
import { saveDistress, saveZone } from './persistence/supabase'

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

app.get('/zones', (_req, res) => {
  res.json(getZones())
})

app.get('/alerts', (_req, res) => {
  res.json(getAlerts())
})

app.get('/playback/window', (_req, res) => {
  res.json(getPlaybackWindow())
})

// Socket.IO connections
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`)

  // Send current fleet state immediately on connect
  socket.emit('fleet_state', {
    ships: getFleet(),
    timestamp: Date.now(),
  })
  socket.emit('zones_state', { zones: getZones() })
  socket.emit('alerts_state', { alerts: getAlerts() })
  socket.emit('playback_window', getPlaybackWindow())

  socket.on('join_command_room', () => {
    socket.join('command')
  })

  socket.on('join_ship_room', ({ shipId }: { shipId: string }) => {
    socket.join(`captain:${shipId}`)
  })

  socket.on('create_zone', (payload: { id: string; coordinates: [number, number][]; label: string }) => {
    const zone = createZone(payload)
    saveZone(zone)
    io.emit('zone_updated', { action: 'create', zone })
  })

  socket.on('update_zone', (payload: { id: string; coordinates: [number, number][] }) => {
    const zone = updateZone(payload)
    if (!zone) return
    saveZone(zone)
    io.emit('zone_updated', { action: 'update', zone })
  })

  socket.on('delete_zone', ({ id }: { id: string }) => {
    const zone = deleteZone(id)
    if (!zone) return
    io.emit('zone_updated', { action: 'delete', zone })
  })

  socket.on('send_directive', (payload: {
    shipId: string
    type: 'CHANGE_DESTINATION' | 'HOLD_POSITION' | 'REROUTE_WAYPOINT'
    payload: { destination?: { lat: number; lng: number; name: string }; waypoint?: { lat: number; lng: number } }
  }) => {
    const directive = createDirective(payload)
    io.to(`captain:${payload.shipId}`).emit('directive_received', directive)
    io.to('command').emit('directive_received', directive)
  })

  socket.on('directive_response', async (payload: {
    directiveId: string
    shipId: string
    response: 'ACCEPT' | 'ESCALATE_DISTRESS'
    distressMessage?: string
    directive?: { type: string; payload?: { destination?: { lat: number; lng: number; name: string }; waypoint?: { lat: number; lng: number } } }
  }) => {
    if (payload.response === 'ACCEPT') {
      if (payload.directive?.type === 'HOLD_POSITION') holdShip(payload.shipId)
      if (payload.directive?.type === 'CHANGE_DESTINATION' && payload.directive.payload?.destination) {
        setShipDestination(payload.shipId, payload.directive.payload.destination)
      }
      if (payload.directive?.type === 'REROUTE_WAYPOINT' && payload.directive.payload?.waypoint) {
        setShipWaypoint(payload.shipId, payload.directive.payload.waypoint)
      }
      io.emit('fleet_state', { ships: getFleet(), timestamp: Date.now() })
      return
    }

    markDistressed(payload.shipId)
    const distress = await parseDistress(payload.shipId, payload.distressMessage || 'Distress escalated without details')
    saveDistress(distress)
    io.emit('distress_parsed', distress)
  })

  socket.on('request_snapshot', ({ requestId, timestamp }: { requestId: string; timestamp: number }) => {
    const snapshot = getSnapshot(timestamp) || maybeSaveSnapshot(getFleet(), Date.now())
    socket.emit('snapshot_response', {
      requestId,
      snapshot: snapshot?.ships || getFleet(),
      timestamp: snapshot?.timestamp || Date.now(),
    })
  })

  socket.on('acknowledge_alert', ({ alertId }: { alertId: string }) => {
    const alert = acknowledgeAlert(alertId)
    if (alert) io.emit('alerts_state', { alerts: getAlerts() })
  })

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`)
  })
})

// Initialize fleet
initFleet(initialFleet)
maybeSaveSnapshot(getFleet(), Date.now())
refreshWeather()
setInterval(refreshWeather, 5 * 60 * 1000)

// Tick loop — runs every 1 second
const TICK_INTERVAL_MS = 1000
let lastTickTime = Date.now()

setInterval(() => {
  const now = Date.now()
  const deltaMs = now - lastTickTime
  lastTickTime = now

  const result = updateFleet(deltaMs, getZones(), isAdverseWeather())

  io.emit('fleet_state', {
    ships: result.ships,
    timestamp: now,
  })
  result.alerts.forEach((alert) => io.emit('alert_created', alert))
  io.emit('playback_window', getPlaybackWindow())
}, TICK_INTERVAL_MS)

// Start server
const PORT = parseInt(process.env.PORT || '4000', 10)
httpServer.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`)
  console.log(`Health check: http://localhost:${PORT}/health`)
  console.log(`Fleet state: http://localhost:${PORT}/fleet`)
})
