'use client'

import { useState } from 'react'
import { Ship } from '@/lib/types'

export function DirectiveComposer({
  ship,
  onSend,
}: {
  ship?: Ship
  onSend: (directive: {
    shipId: string
    type: 'CHANGE_DESTINATION' | 'HOLD_POSITION' | 'REROUTE_WAYPOINT'
    payload: { destination?: { lat: number; lng: number; name: string }; waypoint?: { lat: number; lng: number } }
  }) => void
}) {
  const [mode, setMode] = useState<'CHANGE_DESTINATION' | 'HOLD_POSITION' | 'REROUTE_WAYPOINT'>('CHANGE_DESTINATION')
  const [lat, setLat] = useState('25.50')
  const [lng, setLng] = useState('54.75')
  const [name, setName] = useState('Jebel Ali')

  const send = () => {
    if (!ship) return
    if (mode === 'HOLD_POSITION') {
      onSend({ shipId: ship.id, type: mode, payload: {} })
      return
    }
    const point = { lat: Number(lat), lng: Number(lng) }
    onSend({
      shipId: ship.id,
      type: mode,
      payload: mode === 'CHANGE_DESTINATION'
        ? { destination: { ...point, name } }
        : { waypoint: point },
    })
  }

  return (
    <section className="panel">
      <h2>Directive</h2>
      {!ship && <p className="muted">Select a ship to issue a directive.</p>}
      {ship && (
        <div className="stack">
          <select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}>
            <option value="CHANGE_DESTINATION">Change destination</option>
            <option value="HOLD_POSITION">Hold position</option>
            <option value="REROUTE_WAYPOINT">Reroute waypoint</option>
          </select>
          {mode !== 'HOLD_POSITION' && (
            <div className="inputGrid">
              <input value={lat} onChange={(event) => setLat(event.target.value)} aria-label="Latitude" />
              <input value={lng} onChange={(event) => setLng(event.target.value)} aria-label="Longitude" />
              {mode === 'CHANGE_DESTINATION' && (
                <input value={name} onChange={(event) => setName(event.target.value)} aria-label="Destination name" />
              )}
            </div>
          )}
          <button className="primaryButton" onClick={send}>Send to {ship.id}</button>
        </div>
      )}
    </section>
  )
}
