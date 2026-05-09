'use client'

import { useState } from 'react'

export function DistressInput({
  shipId,
  onEscalate,
}: {
  shipId: string
  onEscalate: (shipId: string, message: string) => void
}) {
  const [message, setMessage] = useState('Engine fire in compartment 3, 2 crew injured, taking on water.')

  return (
    <section className="panel">
      <h2>Distress</h2>
      <div className="stack">
        <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={4} />
        <button className="dangerButton" onClick={() => onEscalate(shipId, message)}>Escalate Distress</button>
      </div>
    </section>
  )
}
