'use client'

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
  const min = start || 0
  const max = end || min || 1
  const currentValue = activeTimestamp || (end || max)

  return (
    <section className="panel playbackPanel">
      <div className="panelTitleRow">
        <h2>Playback</h2>
        <span className="countPill">{count}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={30_000}
        value={currentValue}
        onChange={(event) => onRequest(Number(event.target.value))}
      />
      <div className="playbackTimes">
        <span>{min ? new Date(min).toLocaleTimeString() : '--:--:--'}</span>
        <span>{activeTimestamp ? new Date(activeTimestamp).toLocaleTimeString() : 'Live'}</span>
      </div>
      <button className="iconButton wide" onClick={onClear}>Return live</button>
    </section>
  )
}
