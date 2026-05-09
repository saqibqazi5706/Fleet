import { Ship } from '@/lib/types'
import { ShipStatusBadge } from './ShipStatusBadge'

export function ShipDetailCard({ ship, title = 'Selected Vessel' }: { ship?: Ship; title?: string }) {
  if (!ship) {
    return (
      <section className="panel">
        <h2>{title}</h2>
        <p className="muted">Select a vessel marker to inspect live ship state.</p>
      </section>
    )
  }

  const fuelPercent = Math.round((ship.fuel / ship.maxFuel) * 100)

  return (
    <section className="panel">
      <div className="panelTitleRow">
        <h2>{ship.name}</h2>
        <ShipStatusBadge status={ship.status} />
      </div>
      <div className="metricGrid">
        <Metric label="Ship ID" value={ship.id} />
        <Metric label="Cargo" value={ship.cargo} />
        <Metric label="Fuel" value={`${ship.fuel.toFixed(0)}t (${fuelPercent}%)`} tone={fuelPercent < 15 ? 'warn' : 'good'} />
        <Metric label="Speed" value={`${ship.speed} kt`} />
        <Metric label="Heading" value={`${Math.round(ship.heading)} deg`} />
        <Metric label="Destination" value={ship.destination.name} />
        <Metric label="Weather" value={ship.inAdverseWeather ? 'Adverse' : 'Clear'} tone={ship.inAdverseWeather ? 'warn' : 'good'} />
        <Metric label="Updated" value={new Date(ship.lastUpdated).toLocaleTimeString()} />
      </div>
    </section>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'warn' }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong className={tone ? `tone-${tone}` : ''}>{value}</strong>
    </div>
  )
}
