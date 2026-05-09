import { Alert, DistressResult } from '@/lib/types'

export function AIDistressResult({ results, alerts = [] }: { results: DistressResult[]; alerts?: Alert[] }) {
  const pendingDistress = alerts
    .filter((alert) => alert.type === 'DISTRESS')
    .map((alert) => {
      const parsed = alert.metadata?.parsed as DistressResult | undefined
      if (parsed) return parsed
      return {
        shipId: alert.shipId || 'unknown',
        raw: String(alert.metadata?.rawMessage || alert.message || 'Distress signal received.'),
        severity: alert.severity,
        issueType: 'pending_ai_analysis',
        injuries: 0,
        damageEstimate: 'unknown',
        impact: 'AI analysis pending',
        recommendedAction: 'Emergency signal received. Command review required.',
        parsedAt: alert.createdAt,
      } as DistressResult
    })
  const visibleResults = results.length > 0 ? results : pendingDistress

  return (
    <section className="panel">
      <div className="panelTitleRow">
        <h2>AI Distress</h2>
        <span className="countPill">{Math.max(results.length, pendingDistress.length)}</span>
      </div>
      <div className="stack">
        {visibleResults.length === 0 && <p className="muted">No distress messages parsed yet.</p>}
        {visibleResults.slice(0, 3).map((result) => {
          const severity = result.severity || 'medium'
          return (
            <article
              key={`${result.shipId || 'unknown'}:${result.parsedAt || result.raw || Math.random()}`}
              className={`alertItem severity-${severity}`}
            >
              <strong>{severity.toUpperCase()} - {result.issueType || 'unknown'}</strong>
              <p>{result.raw || 'Distress message received.'}</p>
              <p>Injuries: {Number(result.injuries || 0)} - Damage: {result.damageEstimate || 'unknown'}</p>
              <p>{result.recommendedAction || 'Command review required.'}</p>
            </article>
          )
        })}
      </div>
    </section>
  )
}
