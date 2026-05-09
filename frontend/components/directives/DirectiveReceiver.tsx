'use client'

import { useState } from 'react'
import { Directive } from '@/lib/types'

export function DirectiveReceiver({
  directives,
  onAccept,
  onEscalate,
}: {
  directives: Directive[]
  onAccept: (directive: Directive) => void
  onEscalate: (directive: Directive, message: string) => void
}) {
  const [message, setMessage] = useState('Engine fire in compartment 3, 2 crew injured, taking on water.')

  return (
    <section className="panel glass-subtle">
      <div className="panelTitleRow">
        <h2 style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.18em', color: 'rgba(148,163,184,0.45)' }}>
          INCOMING DIRECTIVES
        </h2>
        <span className="badge badge-warning">{directives.length}</span>
      </div>
      <div className="stack">
        {directives.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'rgba(148,163,184,0.5)', fontSize: '12px' }}>
            <div style={{ fontSize: '24px', marginBottom: 8, opacity: 0.5 }}>◇</div>
            No pending directives
          </div>
        )}
        {directives.map((directive) => (
          <article className="directiveItem" key={directive.id} style={{ borderLeftColor: '#00d4ff' }}>
            <div>
              <strong style={{ fontSize: '12px', fontWeight: 700, color: '#00d4ff' }}>
                {directive.type.replaceAll('_', ' ')}
              </strong>
              <p style={{ fontSize: '12px', lineHeight: 1.5, color: 'rgba(148,163,184,0.8)', margin: '6px 0' }}>
                {formatDirective(directive)}
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={3}
                placeholder="Escalation message..."
                style={{ fontFamily: 'monospace', fontSize: '11px', background: 'rgba(2,6,23,0.6)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '6px', padding: '8px', color: '#e8f7ff', resize: 'vertical' }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="button button-primary"
                  onClick={() => onAccept(directive)}
                  style={{ flex: 1 }}
                >
                  ✓ ACCEPT
                </button>
                <button
                  className="button button-secondary"
                  onClick={() => onEscalate(directive, message)}
                  style={{ flex: 1 }}
                >
                  ⚠ ESCALATE
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function formatDirective(directive: Directive) {
  if (directive.type === 'HOLD_POSITION') return 'Hold current position until command clears movement.'
  const point = directive.payload.destination || directive.payload.waypoint
  if (!point) return 'Command directive received.'
  const label = directive.payload.destination?.name || 'Waypoint'
  return `${label} at ${point.lat.toFixed(2)}, ${point.lng.toFixed(2)}`
}
