import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import dotenv from 'dotenv'

import { initialFleet } from './data/fleetLoader'
import {
  initFleet,
  markDistressed,
  queueDirective,
  recomputeFleetRoutes,
  runImmediateGeofenceCheck,
  updateFleet,
  getFleet,
} from './simulator/tick'
import { acknowledgeAlert, createAlert, getAlerts } from './alerts/alertManager'
import { createZone, deleteZone, getZones, updateZone } from './zones/zoneStore'
import { getWeatherState, isAdverseWeather, refreshWeather } from './weather/weatherFetcher'
import { getPlaybackWindow, getSnapshot, maybeSaveSnapshot } from './playback/snapshotStore'
import { createDirective } from './directives/directiveHandler'
import { parseDistress } from './ai/distressParser'
import { saveDistress, saveZone } from './persistence/supabase'
import { Alert, FleetStatePayload } from './types'

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

function buildFleetState(timestamp = Date.now()): FleetStatePayload {
  return {
    ships: getFleet(),
    zones: getZones(),
    alerts: getAlerts(),
    weather: getWeatherState(),
    timestamp,
  }
}

function broadcastFleetState(timestamp = Date.now()): void {
  io.emit('fleet_state', buildFleetState(timestamp))
}

function broadcastAlerts(alerts: Alert[]): void {
  alerts.forEach((alert) => io.emit('alert_created', alert))
  if (alerts.length > 0) io.emit('alerts_state', { alerts: getAlerts() })
}

// Socket.IO connections
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`)

  // Send current fleet state immediately on connect
  socket.emit('fleet_state', buildFleetState())
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
    const result = runImmediateGeofenceCheck(getZones())
    const routeResult = recomputeFleetRoutes(getZones())
    broadcastAlerts([...result.alerts, ...routeResult.alerts])
    broadcastFleetState()
  })

  socket.on('update_zone', (payload: { id: string; coordinates: [number, number][] }) => {
    const zone = updateZone(payload) || createZone({ ...payload, label: 'Command restricted zone' })
    saveZone(zone)
    io.emit('zone_updated', { action: 'update', zone })
    const result = runImmediateGeofenceCheck(getZones())
    const routeResult = recomputeFleetRoutes(getZones())
    broadcastAlerts([...result.alerts, ...routeResult.alerts])
    broadcastFleetState()
  })

  socket.on('delete_zone', ({ id }: { id: string }) => {
    const zone = deleteZone(id)
    if (!zone) return
    io.emit('zone_updated', { action: 'delete', zone })
    const routeResult = recomputeFleetRoutes(getZones())
    broadcastAlerts(routeResult.alerts)
    broadcastFleetState()
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
      if (payload.directive?.type) {
        queueDirective({
          id: payload.directiveId,
          shipId: payload.shipId,
          fromCommand: true,
          type: payload.directive.type as 'CHANGE_DESTINATION' | 'HOLD_POSITION' | 'REROUTE_WAYPOINT',
          payload: payload.directive.payload || {},
          sentAt: Date.now(),
        })
      }
      io.emit('directive_response_broadcast', {
        directiveId: payload.directiveId,
        shipId: payload.shipId,
        response: payload.response,
        timestamp: Date.now(),
      })
      broadcastFleetState()
      return
    }

    markDistressed(payload.shipId)
    const distress = await parseDistress(payload.shipId, payload.distressMessage || 'Distress escalated without details')
    saveDistress(distress)
    const distressAlert = createAlert({
      type: 'DISTRESS',
      severity: distress.severity,
      shipId: payload.shipId,
      message: `Distress from ${payload.shipId}: ${distress.issueType}`,
      dedupeKey: `DISTRESS:${payload.shipId}:${payload.directiveId}`,
      metadata: {
        rawMessage: distress.raw,
        parsed: distress,
      },
    })
    io.emit('directive_response_broadcast', {
      directiveId: payload.directiveId,
      shipId: payload.shipId,
      response: payload.response,
      distress,
      timestamp: Date.now(),
    })
    io.emit('distress_parsed', {
      shipId: payload.shipId,
      raw: distress.raw,
      parsed: distress,
      alert: distressAlert,
      parsedAt: distress.parsedAt,
    })
    if (distressAlert) broadcastAlerts([distressAlert])
    broadcastFleetState()
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

  io.emit('fleet_state', buildFleetState(now))
  broadcastAlerts(result.alerts)
  io.emit('playback_window', getPlaybackWindow())
}, TICK_INTERVAL_MS)

// Start server
const PORT = parseInt(process.env.PORT || '4000', 10)
httpServer.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`)
  console.log(`Health check: http://localhost:${PORT}/health`)
  console.log(`Fleet state: http://localhost:${PORT}/fleet`)
})
