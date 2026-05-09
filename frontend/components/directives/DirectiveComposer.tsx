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
    <section className="panel glass-subtle">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.18em', color: 'rgba(148,163,184,0.45)', margin: 0 }}>
          DIRECTIVE COMPOSER
        </h2>
        {ship && <span className="badge badge-info">{ship.id}</span>}
      </div>

      {!ship ? (
        <p className="muted" style={{ fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>
          Select a vessel to issue a directive
        </p>
      ) : (
        <div className="directiveComposer">
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value as typeof mode)}
            className="directiveSelect"
            style={{ background: 'rgba(2,6,23,0.7)' }}
          >
            <option value="CHANGE_DESTINATION">✈ Change Destination</option>
            <option value="HOLD_POSITION">⏸ Hold Position</option>
            <option value="REROUTE_WAYPOINT">⎈ Reroute Waypoint</option>
          </select>

          {mode !== 'HOLD_POSITION' && (
            <div className="inputGrid" style={{ gap: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: '10px', color: 'rgba(148,163,184,0.5)', letterSpacing: '0.08em' }}>LATITUDE</label>
                <input
                  value={lat}
                  onChange={(event) => setLat(event.target.value)}
                  placeholder="25.50"
                  style={{ fontFamily: 'monospace' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: '10px', color: 'rgba(148,163,184,0.5)', letterSpacing: '0.08em' }}>LONGITUDE</label>
                <input
                  value={lng}
                  onChange={(event) => setLng(event.target.value)}
                  placeholder="54.75"
                  style={{ fontFamily: 'monospace' }}
                />
              </div>
              {mode === 'CHANGE_DESTINATION' && (
                <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: '10px', color: 'rgba(148,163,184,0.5)', letterSpacing: '0.08em' }}>DESTINATION NAME</label>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Port name..."
                    style={{ fontFamily: 'monospace' }}
                  />
                </div>
              )}
            </div>
          )}

          <button
            className="button button-primary"
            onClick={send}
            style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
            TRANSMIT TO {ship.id}
          </button>
        </div>
      )}
    </section>
  )
}
