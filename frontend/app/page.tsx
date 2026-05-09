'use client'

import dynamic from 'next/dynamic'
import { useFleetState } from '@/lib/socket/useFleetState'

const FleetMap = dynamic(() => import('@/components/map/FleetMap'), {
  ssr: false,
  loading: () => (
    <div style={{
      width: '100%',
      height: '100vh',
      background: '#0a0a1a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#00C8FF',
      fontFamily: 'monospace',
      fontSize: '18px',
    }}>
      Loading fleet map...
    </div>
  ),
})

export default function HomePage() {
  const { ships, connected, lastTimestamp } = useFleetState()

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      position: 'relative',
      background: '#0a0a1a',
    }}>

      {/* Status bar top left */}
      <div style={{
        position: 'absolute',
        top: 12,
        left: 12,
        zIndex: 10,
        background: 'rgba(10,10,26,0.90)',
        border: '1px solid #00C8FF33',
        borderRadius: 8,
        padding: '8px 16px',
        fontFamily: 'monospace',
        fontSize: 13,
        color: '#fff',
        display: 'flex',
        gap: 16,
        alignItems: 'center',
      }}>
        <span style={{ color: connected ? '#00FF88' : '#FF4444' }}>
          ● {connected ? 'LIVE' : 'DISCONNECTED'}
        </span>
        <span style={{ color: '#555' }}>|</span>
        <span>
          Ships: <span style={{ color: '#00C8FF' }}>{ships.length}</span>
        </span>
        <span style={{ color: '#555' }}>|</span>
        <span style={{ color: '#444', fontSize: 11 }}>
          {lastTimestamp ? new Date(lastTimestamp).toLocaleTimeString() : '--:--:--'}
        </span>
      </div>

      {/* Legend bottom left */}
      <div style={{
        position: 'absolute',
        bottom: 32,
        left: 12,
        zIndex: 10,
        background: 'rgba(10,10,26,0.90)',
        border: '1px solid #00C8FF33',
        borderRadius: 8,
        padding: '10px 14px',
        fontFamily: 'monospace',
        fontSize: 11,
        color: '#888',
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
      }}>
        <div style={{ color: '#00C8FF', marginBottom: 4, fontSize: 12, letterSpacing: 1 }}>
          FLEET STATUS
        </div>
        {[
          { color: '#00C8FF', label: 'Normal' },
          { color: '#FFB800', label: 'Rerouting' },
          { color: '#FF8800', label: 'Low Fuel' },
          { color: '#FF4444', label: 'Distressed' },
          { color: '#00FF88', label: 'Arrived' },
          { color: '#FF0000', label: 'Critical' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: item.color,
              flexShrink: 0,
            }} />
            {item.label}
          </div>
        ))}
      </div>

      {/* Map fills entire screen */}
      <FleetMap ships={ships} />

    </div>
  )
}