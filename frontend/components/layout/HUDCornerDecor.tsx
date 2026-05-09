'use client'

import { useMemo } from 'react'

export function HUDCornerDecor({ position = 'top-left' }: { position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' }) {
  const style = useMemo(() => {
    const styles = {
      'top-left': { top: 0, left: 0 },
      'top-right': { top: 0, right: 0 },
      'bottom-left': { bottom: 0, left: 0 },
      'bottom-right': { bottom: 0, right: 0 },
    }
    return styles[position]
  }, [position])

  return (
    <div
      style={{
        position: 'absolute',
        ...style,
        width: 120,
        height: 120,
        pointerEvents: 'none',
        opacity: 0.4,
        zIndex: 1,
      }}
    >
      <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
        {/* Top-left corner lines */}
        {position === 'top-left' && (
          <>
            <line x1="0" y1="20" x2="0" y2="80" stroke="rgba(0,212,255,0.3)" strokeWidth="1" />
            <line x1="20" y1="0" x2="80" y2="0" stroke="rgba(0,212,255,0.3)" strokeWidth="1" />
            <line x1="0" y1="100" x2="0" y2="120" stroke="rgba(0,212,255,0.15)" strokeWidth="1" />
            <line x1="100" y1="0" x2="120" y2="0" stroke="rgba(0,212,255,0.15)" strokeWidth="1" />
            <circle cx="0" cy="0" r="4" fill="rgba(0,212,255,0.4)" />
            <circle cx="0" cy="120" r="3" fill="rgba(0,212,255,0.2)" />
            <circle cx="120" cy="0" r="3" fill="rgba(0,212,255,0.2)" />
          </>
        )}

        {/* Top-right corner lines */}
        {position === 'top-right' && (
          <>
            <line x1="120" y1="20" x2="120" y2="80" stroke="rgba(0,212,255,0.3)" strokeWidth="1" />
            <line x1="40" y1="0" x2="100" y2="0" stroke="rgba(0,212,255,0.3)" strokeWidth="1" />
            <line x1="120" y1="100" x2="120" y2="120" stroke="rgba(0,212,255,0.15)" strokeWidth="1" />
            <line x1="20" y1="0" x2="0" y2="0" stroke="rgba(0,212,255,0.15)" strokeWidth="1" />
            <circle cx="120" cy="0" r="4" fill="rgba(0,212,255,0.4)" />
            <circle cx="0" cy="0" r="3" fill="rgba(0,212,255,0.2)" />
            <circle cx="120" cy="120" r="3" fill="rgba(0,212,255,0.2)" />
          </>
        )}

        {/* Bottom-left corner lines */}
        {position === 'bottom-left' && (
          <>
            <line x1="0" y1="40" x2="0" y2="100" stroke="rgba(0,212,255,0.3)" strokeWidth="1" />
            <line x1="20" y1="120" x2="80" y2="120" stroke="rgba(0,212,255,0.3)" strokeWidth="1" />
            <line x1="0" y1="20" x2="0" y2="0" stroke="rgba(0,212,255,0.15)" strokeWidth="1" />
            <line x1="100" y1="120" x2="120" y2="120" stroke="rgba(0,212,255,0.15)" strokeWidth="1" />
            <circle cx="0" cy="120" r="4" fill="rgba(0,212,255,0.4)" />
            <circle cx="0" cy="0" r="3" fill="rgba(0,212,255,0.2)" />
            <circle cx="120" cy="120" r="3" fill="rgba(0,212,255,0.2)" />
          </>
        )}

        {/* Bottom-right corner lines */}
        {position === 'bottom-right' && (
          <>
            <line x1="120" y1="40" x2="120" y2="100" stroke="rgba(0,212,255,0.3)" strokeWidth="1" />
            <line x1="40" y1="120" x2="100" y2="120" stroke="rgba(0,212,255,0.3)" strokeWidth="1" />
            <line x1="120" y1="20" x2="120" y2="0" stroke="rgba(0,212,255,0.15)" strokeWidth="1" />
            <line x1="20" y1="120" x2="0" y2="120" stroke="rgba(0,212,255,0.15)" strokeWidth="1" />
            <circle cx="120" cy="120" r="4" fill="rgba(0,212,255,0.4)" />
            <circle cx="0" cy="120" r="3" fill="rgba(0,212,255,0.2)" />
            <circle cx="120" cy="0" r="3" fill="rgba(0,212,255,0.2)" />
          </>
        )}
      </svg>
    </div>
  )
}
