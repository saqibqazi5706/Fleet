import { Alert } from '@/lib/types'

export function AlertPanel({
  alerts,
  onAcknowledge,
}: {
  alerts: Alert[]
  onAcknowledge: (alertId: string) => void
}) {
  const activeAlerts = alerts.filter((alert) => alert.active)

  return (
    <section className="panel alertPanel">
      <div className="panelTitleRow">
        <h2>Alerts</h2>
        <span className="countPill">{activeAlerts.length}</span>
      </div>
      <div className="stack">
        {activeAlerts.length === 0 && <p className="muted">No active alerts.</p>}
        {activeAlerts.map((alert) => (
          <article key={alert.id} className={`alertItem severity-${alert.severity}`}>
            <div>
              <strong>{alert.type.replaceAll('_', ' ')}</strong>
              <p>{alert.message}</p>
              <span>{new Date(alert.createdAt).toLocaleTimeString()}</span>
            </div>
            <button className="iconButton wide" onClick={() => onAcknowledge(alert.id)}>Ack</button>
          </article>
        ))}
      </div>
    </section>
  )
}
