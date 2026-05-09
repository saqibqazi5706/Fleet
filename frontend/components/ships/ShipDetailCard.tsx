'use client'

import { Ship } from '@/lib/types'
import { ShipStatusBadge } from './ShipStatusBadge'

// Mirror the backend constant so the UI calculation matches
const BASE_FUEL_BURN_TONS_PER_KM = 0.004
const EARTH_RADIUS_KM = 6371

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function estimateFuelRequired(ship: Ship): number {
  const km = haversineDistance(ship.lat, ship.lng, ship.destination.lat, ship.destination.lng)
  const multiplier = ship.inAdverseWeather ? 1.3 : 1.0
  return km * BASE_FUEL_BURN_TONS_PER_KM * multiplier
}

export function ShipDetailCard({ ship, title = 'Selected Vessel' }: { ship?: Ship; title?: string }) {
  if (!ship) {
    return (
      <section className="panel glass-subtle">
        <div className="panelTitleRow">
          <h2 style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.15em', color: 'rgba(148,163,184,0.45)' }}>
            {title.toUpperCase()}
          </h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, gap: 12 }}>
          <div style={{ fontSize: '32px', opacity: 0.3 }}>◇</div>
          <p className="muted" style={{ fontSize: '13px' }}>Select a vessel marker<br />to inspect live ship state</p>
        </div>
      </section>
    )
  }

  const fuelPercent = Math.round((ship.fuel / ship.maxFuel) * 100)
  const fuelRequired = estimateFuelRequired(ship)
  const canReachDest = ship.fuel >= fuelRequired
  const fuelSufficiency = canReachDest
    ? `✓ ${((ship.fuel / fuelRequired) * 100).toFixed(0)}% margin`
    : `✗ Short ~${(fuelRequired - ship.fuel).toFixed(0)} t`
  const fuelSufficiencyTone = canReachDest ? 'good' : 'warn'

  return (
    <section className="panel glass-subtle">
      <div className="panelTitleRow" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#e8f7ff', margin: 0 }}>
            {ship.name}
          </h3>
          <span style={{ fontSize: '11px', color: 'rgba(148,163,184,0.5)', fontFamily: 'monospace' }}>
            {ship.id}
          </span>
        </div>
        <ShipStatusBadge status={ship.status} />
      </div>

      <div className="metricGrid" style={{ gap: '8px' }}>
        {[
          { label: 'CARGO', value: ship.cargo },
          { label: 'FUEL', value: `${ship.fuel.toFixed(0)}t`, tone: fuelPercent < 15 ? 'warn' : fuelPercent > 50 ? 'good' : undefined },
          { label: 'FUEL %', value: `${fuelPercent}%`, tone: fuelPercent < 15 ? 'warn' : fuelPercent > 50 ? 'good' : undefined },
          { label: 'TO DEST', value: fuelSufficiency, tone: fuelSufficiencyTone },
          { label: 'SPEED', value: `${ship.speed} kt` },
          { label: 'HEADING', value: `${Math.round(ship.heading)}°` },
          { label: 'DESTINATION', value: ship.destination.name },
          { label: 'WEATHER', value: ship.inAdverseWeather ? '⚠ ADVERSE' : '✓ CLEAR', tone: ship.inAdverseWeather ? 'warn' : 'good' },
          { label: 'UPDATED', value: new Date(ship.lastUpdated).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) },
        ].map((metric, i) => (
          <div key={i} className="metric" style={{ background: 'rgba(2,6,23,0.45)', padding: '10px', borderRadius: '6px' }}>
            <span style={{ fontSize: '10px', letterSpacing: '0.1em', color: 'rgba(148,163,184,0.5)' }}>
              {metric.label}
            </span>
            <strong style={{
              fontSize: '13px',
              color: metric.tone === 'warn' ? '#ffb800' : metric.tone === 'good' ? '#00ff88' : '#e8f7ff',
              fontFamily: 'monospace',
            }}>
              {metric.value}
            </strong>
          </div>
        ))}
      </div>
    </section>
  )
}