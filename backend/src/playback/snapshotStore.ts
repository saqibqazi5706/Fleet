import { Ship, Snapshot } from '../types'

const snapshots: Snapshot[] = []
const SNAPSHOT_INTERVAL_MS = 30_000
const MAX_SNAPSHOTS = 120
let lastSnapshotAt = 0

export function maybeSaveSnapshot(ships: Ship[], now = Date.now()): Snapshot | null {
  if (now - lastSnapshotAt < SNAPSHOT_INTERVAL_MS) return null
  lastSnapshotAt = now

  const snapshot = {
    timestamp: now,
    ships: JSON.parse(JSON.stringify(ships)) as Ship[],
  }
  snapshots.push(snapshot)
  if (snapshots.length > MAX_SNAPSHOTS) snapshots.shift()
  return snapshot
}

export function getSnapshot(timestamp: number): Snapshot | null {
  if (snapshots.length === 0) return null

  return snapshots.reduce((closest, snapshot) =>
    Math.abs(snapshot.timestamp - timestamp) < Math.abs(closest.timestamp - timestamp)
      ? snapshot
      : closest
  )
}

export function getPlaybackWindow(): { start: number; end: number; count: number } {
  const end = snapshots[snapshots.length - 1]?.timestamp || Date.now()
  const start = snapshots[0]?.timestamp || end
  return { start, end, count: snapshots.length }
}
