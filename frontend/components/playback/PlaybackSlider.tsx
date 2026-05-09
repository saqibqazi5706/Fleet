'use client'

import { useRef, useState } from 'react'

export function PlaybackSlider({
  start,
  end,
  count,
  activeTimestamp,
  onRequest,
  onClear,
}: {
  start: number
  end: number
  count: number
  activeTimestamp: number | null
  onRequest: (timestamp: number) => void
  onClear: () => void
}) {
  const [isDragging, setIsDragging] = useState(false)
  const sliderRef = useRef<HTMLInputElement>(null)

  const min = start || 0
  const max = end || min || 1
  const currentValue = activeTimestamp || (end || max)

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <section className="panel glass-subtle" style={{ marginTop: 16 }}>
      <div className="panelTitleRow">
        <h2 style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.18em', color: 'rgba(148,163,184,0.45)' }}>
          PLAYBACK ENGINE
        </h2>
        <span className="badge badge-warning">{count} SNAPSHOTS</span>
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '10px',
          color: 'rgba(148,163,184,0.5)',
          marginBottom: 6,
          fontFamily: 'monospace',
          letterSpacing: '0.08em',
        }}>
          <span>{formatTime(min)}</span>
          <span style={{ color: activeTimestamp ? '#00d4ff' : 'rgba(148,163,184,0.5)' }}>
            {activeTimestamp ? `▶ PLAYBACK ${formatTime(activeTimestamp)}` : '● LIVE FEED'}
          </span>
        </div>

        {/* Range slider */}
        <div style={{ position: 'relative', height: '6px' }}>
          <input
            ref={sliderRef}
            type="range"
            min={min}
            max={max}
            step={30_000}
            value={currentValue}
            onChange={(event) => onRequest(Number(event.target.value))}
            onMouseDown={() => setIsDragging(true)}
            onMouseUp={() => setIsDragging(false)}
            onTouchStart={() => setIsDragging(true)}
            onTouchEnd={() => setIsDragging(false)}
            style={{
              width: '100%',
              height: '6px',
              borderRadius: '3px',
              background: 'rgba(148,163,184,0.15)',
              outline: 'none',
              cursor: 'pointer',
              WebkitAppearance: 'none',
              appearance: 'none',
            } as React.CSSProperties}
          />
          {/* Custom thumb styling */}
          <style jsx global>{`
            input[type='range']::-webkit-slider-thumb {
              -webkit-appearance: none;
              width: 16px;
              height: 16px;
              border-radius: 50%;
              background: #00d4ff;
              border: 2px solid #fff;
              box-shadow: 0 0 12px rgba(0, 212, 255, 0.6);
              cursor: pointer;
              transition: all 0.2s ease;
              margin-top: 0;
            }
            input[type='range']::-webkit-slider-thumb:hover {
              transform: scale(1.2);
              box-shadow: 0 0 20px rgba(0, 212, 255, 0.9);
            }
            input[type='range']::-moz-range-thumb {
              width: 16px;
              height: 16px;
              border-radius: 50%;
              background: #00d4ff;
              border: 2px solid #fff;
              box-shadow: 0 0 12px rgba(0, 212, 255, 0.6);
              cursor: pointer;
              transition: all 0.2s ease;
            }
          `}</style>
        </div>
      </div>

      <button
        className="button button-ghost"
        onClick={onClear}
        disabled={!activeTimestamp}
        style={{
          width: '100%',
          justifyContent: 'center',
          marginTop: 12,
          padding: '8px 12px',
          fontSize: '11px',
          opacity: !activeTimestamp ? 0.4 : 1,
          cursor: !activeTimestamp ? 'not-allowed' : 'pointer',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 6 }}>
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9v-2h2v2zm0-4H9V7h2v5z" />
        </svg>
        RETURN TO LIVE
      </button>
    </section>
  )
}
