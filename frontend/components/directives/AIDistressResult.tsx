'use client'

import { DistressResult } from '@/lib/types'

export function AIDistressResult({ results }: { results: DistressResult[] }) {
  return (
    <section className="panel glass-subtle">
      <div className="panelTitleRow">
        <h2 style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.18em', color: 'rgba(148,163,184,0.45)' }}>
          AI DISTRESS ANALYSIS
        </h2>
        <span className="badge badge-danger">{results.length}</span>
      </div>
      <div className="stack">
        {results.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'rgba(148,163,184,0.5)', fontSize: '12px' }}>
            <div style={{ fontSize: '24px', marginBottom: 8, opacity: 0.5 }}>◇</div>
            <p>No distress messages<br />parsed yet</p>
          </div>
        )}
        {results.slice(0, 3).map((result, idx) => (
          <article
            key={`${result.shipId}:${result.parsedAt}`}
            className="alertItem"
            style={{
              borderLeftColor: result.severity === 'critical' ? '#ff3355' : result.severity === 'high' ? '#fb923c' : result.severity === 'medium' ? '#ffb800' : '#00d4ff',
              background: 'rgba(2,6,23,0.5)',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '8px',
              animation: `slideIn 0.3s ease ${idx * 80}ms both`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <strong style={{
                fontSize: '11px',
                fontWeight: 700,
                color: result.severity === 'critical' ? '#ff3355' : result.severity === 'high' ? '#fb923c' : result.severity === 'medium' ? '#ffb800' : '#00d4ff',
                letterSpacing: '0.08em',
                flex: 1
              }}>
                {result.severity.toUpperCase()} · {result.issueType}
              </strong>
              <span style={{ fontSize: '9px', color: 'rgba(148,163,184,0.4)', fontFamily: 'monospace' }}>
                {new Date(result.parsedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <p style={{ fontSize: '11px', lineHeight: 1.5, color: 'rgba(148,163,184,0.75)', marginBottom: 6 }}>
              {result.raw}
            </p>
            <div style={{ display: 'flex', gap: 12, fontSize: '10px', color: 'rgba(148,163,184,0.6)' }}>
              <span>Injuries: <strong style={{ color: result.injuries > 0 ? '#ff3355' : '#00ff88' }}>{result.injuries}</strong></span>
              <span>Damage: <strong>{result.damageEstimate}</strong></span>
            </div>
            <div style={{
              marginTop: 8,
              padding: '6px 8px',
              background: 'rgba(0,212,255,0.08)',
              borderRadius: '4px',
              border: '1px solid rgba(0,212,255,0.15)',
              color: 'rgba(148,163,184,0.8)',
              fontSize: '10px',
              lineHeight: 1.4,
            }}>
              <strong style={{ color: '#00d4ff', display: 'block', marginBottom: 2, fontSize: '9px' }}>▶ RECOMMENDED ACTION</strong>
              {result.recommendedAction}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
