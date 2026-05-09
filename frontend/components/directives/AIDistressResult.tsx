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
        {results.slice(0, 3).map((result) => (
          <article key={`${result.shipId}:${result.parsedAt}`} className={`alertItem severity-${result.severity}`}>
            <strong>{result.severity.toUpperCase()} · {result.issueType}</strong>
            <p>{result.raw}</p>
            <p>Injuries: {result.injuries} · Damage: {result.damageEstimate}</p>
            <p>{result.recommendedAction}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
