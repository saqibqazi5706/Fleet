import { Alert, Position, Ship, Zone } from '../types'
import { createAlert } from '../alerts/alertManager'
import { pointInPolygon } from './geometry'
import { computeRoute, RouteResult } from './router'

export type RerouteApprovalStatus = 'pending' | 'approved' | 'held' | 'failed'

export interface RerouteApproval {
  id: string
  shipId: string
  shipName: string
  reason: string
  proposedRoute: Position[]
  proposedDistanceKm: number | null
  status: RerouteApprovalStatus
  createdAt: number
  decidedAt?: number
  message?: string
}

const approvals = new Map<string, RerouteApproval>()

export function getRerouteApprovals(): RerouteApproval[] {
  return Array.from(approvals.values()).sort((a, b) => b.createdAt - a.createdAt)
}

export function getPendingRerouteApprovals(): RerouteApproval[] {
  return getRerouteApprovals().filter((approval) => approval.status === 'pending')
}

export function createInsideZoneRerouteApprovals(
  ships: Ship[],
  zones: Zone[]
): { approvals: RerouteApproval[]; alerts: Alert[] } {
  const created: RerouteApproval[] = []
  const alerts: Alert[] = []

  ships.forEach((ship) => {
    const insideZones = zones.filter((zone) => pointInPolygon({ lat: ship.lat, lng: ship.lng }, zone.coordinates))
    if (insideZones.length === 0) return

    const id = `${ship.id}:${insideZones.map((zone) => zone.id).sort().join('|')}`
    const existing = approvals.get(id)
    if (existing?.status === 'pending') return

    const routeResult: RouteResult | null = computeRoute(ship, zones)
    const approval: RerouteApproval = {
      id,
      shipId: ship.id,
      shipName: ship.name,
      reason: `Ship inside restricted zone: ${insideZones.map((zone) => zone.label || zone.id).join(', ')}`,
      proposedRoute: routeResult?.route || [],
      proposedDistanceKm: routeResult ? Number(routeResult.distanceKm.toFixed(2)) : null,
      status: routeResult ? 'pending' : 'failed',
      createdAt: Date.now(),
      message: routeResult ? undefined : 'No valid escape route exists.',
    }
    approvals.set(id, approval)
    created.push(approval)

    const alert = createAlert({
      type: routeResult ? 'GEOFENCE_BREACH' : 'STRANDED',
      severity: 'critical',
      shipId: ship.id,
      message: routeResult
        ? `${ship.name} is inside a restricted zone. Command approval required before reroute.`
        : `${ship.name} is trapped inside a restricted zone with no valid escape route.`,
      dedupeKey: `${routeResult ? 'REROUTE_APPROVAL' : 'TRAPPED'}:${id}`,
      metadata: { approval },
    })
    if (alert) alerts.push(alert)
  })

  return { approvals: created, alerts }
}

export function approveRerouteApproval(id: string): RerouteApproval | null {
  const approval = approvals.get(id)
  if (!approval || approval.status !== 'pending') return null
  const updated = { ...approval, status: 'approved' as const, decidedAt: Date.now() }
  approvals.set(id, updated)
  return updated
}

export function holdRerouteApproval(id: string): RerouteApproval | null {
  const approval = approvals.get(id)
  if (!approval || approval.status !== 'pending') return null
  const updated = { ...approval, status: 'held' as const, decidedAt: Date.now(), message: 'Command selected hold position.' }
  approvals.set(id, updated)
  return updated
}
