'use client'

import { useEffect, useState } from 'react'
import { Ship } from '@/lib/types'
import { getSocket } from './socketClient'

export function usePlayback() {
  const [windowRange, setWindowRange] = useState({ start: 0, end: 0, count: 0 })
  const [snapshotShips, setSnapshotShips] = useState<Ship[] | null>(null)
  const [snapshotTimestamp, setSnapshotTimestamp] = useState<number | null>(null)

  useEffect(() => {
    const socket = getSocket()
    const handleWindow = (data: { start: number; end: number; count: number }) => setWindowRange(data)
    const handleSnapshot = (data: { requestId: string; snapshot: Ship[]; timestamp: number }) => {
      setSnapshotShips(data.snapshot)
      setSnapshotTimestamp(data.timestamp)
    }

    socket.on('playback_window', handleWindow)
    socket.on('snapshot_response', handleSnapshot)

    return () => {
      socket.off('playback_window', handleWindow)
      socket.off('snapshot_response', handleSnapshot)
    }
  }, [])

  const requestSnapshot = (timestamp: number) => {
    getSocket().emit('request_snapshot', { requestId: `snapshot:${Date.now()}`, timestamp })
  }

  const clearSnapshot = () => {
    setSnapshotShips(null)
    setSnapshotTimestamp(null)
  }

  return { windowRange, snapshotShips, snapshotTimestamp, requestSnapshot, clearSnapshot }
}
