import { ShipStatus } from '@/lib/types'

const colors: Record<ShipStatus, string> = {
  normal: '#00c8ff',
  rerouting: '#ffb800',
  distressed: '#ff4444',
  stopped: '#9ca3af',
  stranded: '#ff0033',
  insufficient_fuel: '#ff8800',
  arrived: '#00ff88',
  out_of_fuel: '#ff0033',
  restricted_zone_breach: '#ff0033',
}

export function ShipStatusBadge({ status }: { status: ShipStatus }) {
  return (
    <span className="statusBadge" style={{ borderColor: colors[status], color: colors[status] }}>
      {status.replaceAll('_', ' ').toUpperCase()}
    </span>
  )
}
