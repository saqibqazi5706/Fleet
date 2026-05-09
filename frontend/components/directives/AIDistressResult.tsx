import { DistressResult } from '@/lib/types'

export function AIDistressResult({ results }: { results: DistressResult[] }) {
  return (
    <section className="panel">
      <div className="panelTitleRow">
        <h2>AI Distress</h2>
        <span className="countPill">{results.length}</span>
      </div>
      <div className="stack">
        {results.length === 0 && <p className="muted">No distress messages parsed yet.</p>}
        {results.slice(0, 3).map((result) => {
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
