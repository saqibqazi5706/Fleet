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
    <section className="panel">
      <div className="panelTitleRow">
        <h2>Directives</h2>
        <span className="countPill">{directives.length}</span>
      </div>
      <div className="stack">
        {directives.length === 0 && <p className="muted">No pending directives.</p>}
        {directives.map((directive) => (
          <article className="directiveItem" key={directive.id}>
            <strong>{directive.type.replaceAll('_', ' ')}</strong>
            <p>{formatDirective(directive)}</p>
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={3} />
            <div className="buttonRow">
              <button className="primaryButton" onClick={() => onAccept(directive)}>Accept</button>
              <button className="dangerButton" onClick={() => onEscalate(directive, message)}>Escalate</button>
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
