import { Alert, AlertType, Severity } from '../types'

const alerts = new Map<string, Alert>()

export function getAlerts(): Alert[] {
  return Array.from(alerts.values()).sort((a, b) => b.createdAt - a.createdAt)
}

export function createAlert(input: {
  type: AlertType
  severity: Severity
  shipId: string
  message: string
  dedupeKey?: string
}): Alert | null {
  const dedupeKey = input.dedupeKey || `${input.type}:${input.shipId}`
  const existing = alerts.get(dedupeKey)
  if (existing && existing.active && !existing.acknowledged) return null

  const alert: Alert = {
    id: `${dedupeKey}:${Date.now()}`,
    type: input.type,
    severity: input.severity,
    shipId: input.shipId,
    message: input.message,
    active: true,
    acknowledged: false,
    createdAt: Date.now(),
  }

  alerts.set(dedupeKey, alert)
  return alert
}

export function acknowledgeAlert(alertId: string): Alert | null {
  for (const [key, alert] of alerts.entries()) {
    if (alert.id === alertId) {
      const updated = { ...alert, acknowledged: true, active: false }
      alerts.set(key, updated)
      return updated
    }
  }

  return null
}
