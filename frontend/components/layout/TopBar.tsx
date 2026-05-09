'use client'

import { useEffect, useState } from 'react'

interface TopBarProps {
  role: string
  connected: boolean
  shipCount: number
  lastTimestamp?: number | null
}

export function TopBar({ role, connected, shipCount, lastTimestamp }: TopBarProps) {
  const [time, setTime] = useState('')
  const [, setTick] = useState(false)

  useEffect(() => {
    const update = () => {
      const now = new Date()
      setTime(
        now.toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: 'UTC',
        }) + ' UTC'
      )
    }
    update()
    const id = setInterval(() => {
      update()
      setTick((t) => !t)
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const isCommand = role === 'Command Center'
  const lag = lastTimestamp ? Math.round((Date.now() - lastTimestamp) / 1000) : null
  const statusColor = connected ? 'text-success' : 'text-danger'
  const statusBg = connected ? 'bg-success' : 'bg-danger'

  return (
    <header className="topBar noise">
      {/* LEFT — Brand + Role */}
      <div className="topBar__left">
        <div className="topBar__logo" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <polygon points="14,2 26,8 26,20 14,26 2,20 2,8" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <polygon points="14,7 21,11 21,17 14,21 7,17 7,11" stroke="currentColor" strokeWidth="0.75" fill="rgba(0,200,255,0.12)" />
            <circle cx="14" cy="14" r="2.5" fill="currentColor" />
            <line x1="14" y1="2" x2="14" y2="7" stroke="currentColor" strokeWidth="0.75" />
            <line x1="26" y1="8" x2="21" y2="11" stroke="currentColor" strokeWidth="0.75" />
            <line x1="26" y1="20" x2="21" y2="17" stroke="currentColor" strokeWidth="0.75" />
            <line x1="14" y1="26" x2="14" y2="21" stroke="currentColor" strokeWidth="0.75" />
            <line x1="2" y1="20" x2="7" y2="17" stroke="currentColor" strokeWidth="0.75" />
            <line x1="2" y1="8" x2="7" y2="11" stroke="currentColor" strokeWidth="0.75" />
          </svg>
        </div>
        <div className="topBar__brand">
          <span className="topBar__title">FLEET COMMAND</span>
          <span className="topBar__subtitle">STRAIT OF HORMUZ</span>
        </div>
        <div className="topBar__divider" aria-hidden="true" />
        <div className="topBar__role">
          <span className="topBar__roleLabel">STATION</span>
          <span className="topBar__roleName">{role.toUpperCase()}</span>
        </div>
      </div>

      {/* CENTER — Scan line + coordinates */}
      <div className="topBar__center">
        <div className="topBar__scanLine" aria-hidden="true" />
        <div className="topBar__coordinates">
          <span>26°32′N</span>
          <span className="topBar__coordSep">·</span>
          <span>56°15′E</span>
        </div>
      </div>

      {/* RIGHT — Status metrics */}
      <div className="topBar__right">
        <div className="topBar__stat">
          <span className="topBar__statLabel">VESSELS</span>
          <span className="topBar__statValue">{String(shipCount).padStart(2, '0')}</span>
        </div>

        <div className="topBar__stat">
          <span className="topBar__statLabel">LATENCY</span>
          <span className={`topBar__statValue ${lag !== null && lag > 5 ? 'topBar__statValue--warn' : ''}`}>
            {lag !== null ? `${lag}s` : '--'}
          </span>
        </div>

        <div className="topBar__divider" aria-hidden="true" />

        <div className="topBar__time">{time}</div>

        <div className="topBar__divider" aria-hidden="true" />

        <div className={`topBar__status ${connected ? 'topBar__status--live' : 'topBar__status--dead'}`}>
          <span className={`topBar__statusDot ${statusBg}`} aria-hidden="true" />
          <span>{connected ? 'LIVE' : 'DISCONNECTED'}</span>
        </div>
      </div>
    </header>
  )
}