import { ShipStatus } from '@/lib/types'

const colors: Record<ShipStatus, string> = {
  normal: '#00d4ff',
  rerouting: '#ffb800',
  distressed: '#ff3355',
  stopped: '#9ca3af',
  stranded: '#ff0033',
  insufficient_fuel: '#ff8800',
  arrived: '#00ff88',
  out_of_fuel: '#ff0033',
}

export function ShipStatusBadge({ status }: { status: ShipStatus }) {
  return (
    <span
      className="badge"
      style={{
        borderColor: colors[status],
        color: colors[status],
        background: `${colors[status]}15`,
      }}
    >
      {status.replaceAll('_', ' ').toUpperCase()}
    </span>
  )
}
