export function TopBar({
  role,
  connected,
  shipCount,
  lastTimestamp,
}: {
  role: string
  connected: boolean
  shipCount: number
  lastTimestamp: number
}) {
  return (
    <header className="topBar">
      <div>
        <strong>{role}</strong>
        <span>Strait of Hormuz Crisis Operations</span>
      </div>
      <div className="topStats">
        <span className={connected ? 'liveDot on' : 'liveDot'}>{connected ? 'LIVE' : 'OFFLINE'}</span>
        <span>{shipCount} ships</span>
        <span>{lastTimestamp ? new Date(lastTimestamp).toLocaleTimeString() : '--:--:--'}</span>
      </div>
    </header>
  )
}
