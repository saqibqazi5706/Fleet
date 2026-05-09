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
  getRerouteApprovalState,
  approvePendingReroute,
  holdPendingReroute,
  holdShip,
  setShipWaypoint,
} from './simulator/tick'
import { acknowledgeAlert, createAlert, getAlerts, updateAlert } from './alerts/alertManager'
import { createZone, deleteZone, getZones, updateZone } from './zones/zoneStore'
import { getWeatherState, refreshWeather } from './weather/weatherFetcher'
import { getPlaybackWindow, getSnapshot, maybeSaveSnapshot } from './playback/snapshotStore'
import { createDirective } from './directives/directiveHandler'
import { parseDistress } from './ai/distressParser'
import { saveDistress, saveZone } from './persistence/supabase'
import { Alert, FleetStatePayload } from './types'
import { getRouterGraphDebug, isRouteValid, routeDistanceKm, validateRouteSegments } from './routing/router'

dotenv.config()

const app = express()
const httpServer = createServer(app)

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'

const corsOptions = {
  origin: FRONTEND_URL,
  methods: ['GET', 'POST'],
  credentials: true,
}

const io = new Server(httpServer, {
  cors: corsOptions,
})

app.use(cors(corsOptions))
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

app.get('/reroute-approvals', (_req, res) => {
  res.json(getRerouteApprovalState())
})

app.get('/debug/routes', (_req, res) => {
  const zones = getZones()

  res.json(getFleet().map((ship) => {
    const illegalSegments = validateRouteSegments(ship, zones)

    return {
      shipId: ship.id,
      name: ship.name,
      status: ship.status,
      currentPosition: { lat: ship.lat, lng: ship.lng },
      destination: ship.destination,
      routeValid: isRouteValid(ship, zones),
      waypointCount: ship.route.length,
      distanceKm: Number(routeDistanceKm(ship).toFixed(2)),
      illegalSegments,
      fuelCanReachDestination: ship.fuelReachable !== false,
      estimatedFuelNeeded: ship.estimatedFuelRequiredTons ?? null,
      fuelRemaining: ship.fuel,
    }
  }))
})

app.get('/debug/router-graph', (_req, res) => {
  res.json(getRouterGraphDebug())
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
    demoTimeScale: DEMO_TIME_SCALE,
    timestamp,
  }
}

function broadcastFleetState(timestamp = Date.now()): void {
  io.emit('fleet_state', buildFleetState(timestamp))
}

function broadcastAlerts(alerts: Alert[]): void {
  alerts.forEach((alert) => {
    io.emit('alert_created', alert)

    if (alert.type === 'PROXIMITY_WARNING') {
      const involvedShipIds = [alert.shipId, alert.relatedShipId].filter(Boolean) as string[]
      involvedShipIds.forEach((shipId) => {
        io.to(`captain:${shipId}`).emit('proximity_distress_signal', alert)
      })
    }
  })
  if (alerts.length > 0) io.emit('alerts_state', { alerts: getAlerts() })
}

function broadcastAlertUpdate(alert: Alert): void {
  io.emit('alert_updated', alert)
  io.emit('alerts_state', { alerts: getAlerts() })
}

function broadcastRerouteApprovals(): void {
  io.emit('reroute_approval_state', { approvals: getRerouteApprovalState() })
}

function handleZoneImpact(): Alert[] {
  const geofenceResult = runImmediateGeofenceCheck(getZones())
  const routeResult = recomputeFleetRoutes(getZones())
  broadcastRerouteApprovals()
  return [...geofenceResult.alerts, ...routeResult.alerts]
}

// Socket.IO connections
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`)

  // Send current fleet state immediately on connect
  socket.emit('fleet_state', buildFleetState())
  socket.emit('zones_state', { zones: getZones() })
  socket.emit('alerts_state', { alerts: getAlerts() })
  socket.emit('reroute_approval_state', { approvals: getRerouteApprovalState() })
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
    broadcastAlerts(handleZoneImpact())
    broadcastFleetState()
  })

  socket.on('update_zone', (payload: { id: string; coordinates: [number, number][] }) => {
    const zone = updateZone(payload) || createZone({ ...payload, label: 'Command restricted zone' })
    saveZone(zone)
    io.emit('zone_updated', { action: 'update', zone })
    broadcastAlerts(handleZoneImpact())
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

  socket.on('command_hold_ship', ({ shipId }: { shipId: string }) => {
    const ship = holdShip(shipId)
    if (!ship) return
    io.emit('directive_response_broadcast', {
      directiveId: `command-hold:${shipId}:${Date.now()}`,
      shipId,
      response: 'ACCEPT',
      timestamp: Date.now(),
    })
    broadcastFleetState()
  })

  socket.on('command_reroute_strait_lane', ({ shipId }: { shipId: string }) => {
    const waypoint = { lat: 26.22, lng: 56.5 }
    const ship = setShipWaypoint(shipId, waypoint)
    if (!ship) return
    const routeResult = recomputeFleetRoutes(getZones())
    broadcastAlerts(routeResult.alerts)
    io.emit('directive_response_broadcast', {
      directiveId: `command-reroute:${shipId}:${Date.now()}`,
      shipId,
      response: 'ACCEPT',
      timestamp: Date.now(),
    })
    broadcastFleetState()
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
    const rawMessage = payload.distressMessage || 'Distress escalated without details'
    const preliminaryAlert = createAlert({
      type: 'DISTRESS',
      severity: 'high',
      shipId: payload.shipId,
      message: `New distress signal from ${payload.shipId}`,
      dedupeKey: `DISTRESS:${payload.shipId}:${payload.directiveId}`,
      metadata: {
        aiStatus: 'pending_ai_analysis',
        rawMessage,
      },
    })

    if (preliminaryAlert) {
      io.emit('distress_signal', {
        shipId: payload.shipId,
        raw: rawMessage,
        alert: preliminaryAlert,
        receivedAt: preliminaryAlert.createdAt,
      })
      broadcastAlerts([preliminaryAlert])
      broadcastFleetState()
    }

    const distress = await parseDistress(payload.shipId, rawMessage)
    saveDistress(distress)
    const distressAlert = preliminaryAlert
      ? updateAlert(preliminaryAlert.id, {
          severity: distress.severity,
          message: `Distress from ${payload.shipId}: ${distress.issueType}`,
          metadata: {
            aiStatus: 'analyzed',
            rawMessage: distress.raw,
            parsed: distress,
          },
        })
      : null
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
    if (distressAlert) broadcastAlertUpdate(distressAlert)
    broadcastFleetState()
  })

  socket.on('approve_reroute', ({ id }: { id: string }) => {
    const result = approvePendingReroute(id)
    if (!result.approval) return
    io.emit('reroute_approval_decided', result.approval)
    broadcastRerouteApprovals()
    broadcastFleetState()
  })

  socket.on('reject_reroute_or_hold', ({ id }: { id: string }) => {
    const result = holdPendingReroute(id)
    if (!result.approval) return
    io.emit('reroute_approval_decided', result.approval)
    broadcastRerouteApprovals()
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
const DEMO_TIME_SCALE = Math.min(
  Math.max(Number(process.env.DEMO_TIME_SCALE || '1'), 1),
  30
)
let lastTickTime = Date.now()

setInterval(() => {
  const now = Date.now()
  const deltaMs = now - lastTickTime
  lastTickTime = now

  const result = updateFleet(deltaMs * DEMO_TIME_SCALE, getZones(), getWeatherState())

  io.emit('fleet_state', buildFleetState(now))
  broadcastAlerts(result.alerts)
  io.emit('playback_window', getPlaybackWindow())
}, TICK_INTERVAL_MS)

// Start server
const PORT = parseInt(process.env.PORT || '4000', 10)
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend running on port ${PORT}`)
  console.log(`[Simulator] Demo time scale: ${DEMO_TIME_SCALE}x`)
  console.log(`Health check: /health`)
  console.log(`Fleet state: /fleet`)
})
