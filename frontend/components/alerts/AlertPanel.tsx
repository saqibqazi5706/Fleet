'use client'

import { Alert } from '@/lib/types'

export function AlertPanel({
  alerts,
  onAcknowledge,
}: {
  alerts: Alert[]
  onAcknowledge: (alertId: string) => void
}) {
  const activeAlerts = alerts.filter((alert) => alert.active)

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#ff3355'
      case 'high': return '#fb923c'
      case 'medium': return '#ffb800'
      case 'low': return '#00d4ff'
      default: return '#94a3b8'
    }
  }

  return (
    <section className="panel glass-subtle">
      <div className="panelTitleRow">
        <h2 style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.18em', color: 'rgba(148,163,184,0.45)' }}>
          ALERT FEED
        </h2>
        <span style={{
          padding: '2px 8px',
          borderRadius: '999px',
          fontSize: '10px',
          fontWeight: 700,
          background: activeAlerts.length > 0 ? 'rgba(255,51,85,0.15)' : 'rgba(0,212,255,0.1)',
          color: activeAlerts.length > 0 ? '#ff3355' : '#00d4ff',
          border: `1px solid ${activeAlerts.length > 0 ? 'rgba(255,51,85,0.3)' : 'rgba(0,212,255,0.3)'}`,
          letterSpacing: '0.08em',
        }}>
          {activeAlerts.length} ACTIVE
        </span>
      </div>
      <div className="stack" style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {activeAlerts.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '32px 16px',
            color: 'rgba(148,163,184,0.5)',
            fontSize: '12px',
          }}>
            <div style={{ fontSize: '24px', marginBottom: 8, opacity: 0.4 }}>✓</div>
            All systems nominal<br />No active alerts
          </div>
        )}
        {activeAlerts.map((alert, idx) => (
          <article
            key={alert.id}
            className="alertItem"
            style={{
              borderLeftWidth: '3px',
              borderLeftStyle: 'solid',
              borderLeftColor: getSeverityColor(alert.severity),
              background: 'rgba(2,6,23,0.5)',
              borderRadius: '8px',
              padding: '12px',
              transition: 'all 0.2s ease',
              animation: `slideIn 0.3s ease ${idx * 50}ms both`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(2,6,23,0.7)'
              e.currentTarget.style.transform = 'translateX(4px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(2,6,23,0.5)'
              e.currentTarget.style.transform = 'translateX(0)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <strong style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: getSeverityColor(alert.severity),
                  marginBottom: 4,
                  letterSpacing: '0.06em',
                }}>
                  {alert.type.replaceAll('_', ' ')}
                </strong>
                <p style={{ fontSize: '12px', lineHeight: 1.5, color: 'rgba(148,163,184,0.8)', marginBottom: 6 }}>
                  {alert.message}
                </p>
                <span style={{ fontSize: '9px', color: 'rgba(148,163,184,0.4)', fontFamily: 'monospace', letterSpacing: '0.08em' }}>
                  {new Date(alert.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
              <button
                onClick={() => onAcknowledge(alert.id)}
                style={{
                  flexShrink: 0,
                  padding: '4px 8px',
                  background: 'rgba(0,212,255,0.12)',
                  border: '1px solid rgba(0,212,255,0.25)',
                  borderRadius: '4px',
                  color: '#00d4ff',
                  fontFamily: 'monospace',
                  fontSize: '9px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(0,212,255,0.2)'
                  e.currentTarget.style.borderColor = 'rgba(0,212,255,0.4)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(0,212,255,0.12)'
                  e.currentTarget.style.borderColor = 'rgba(0,212,255,0.25)'
                }}
              >
                ACK
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
