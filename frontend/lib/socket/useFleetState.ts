'use client'

import { useEffect, useState } from 'react'
import { getSocket } from './socketClient'
import { Ship } from '@/lib/types'

export function useFleetState() {
  const [ships, setShips] = useState<Ship[]>([])
  const [lastTimestamp, setLastTimestamp] = useState<number>(0)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const socket = getSocket()

    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))
    setConnected(socket.connected)

    socket.on('fleet_state', (data: { ships: Ship[]; timestamp: number }) => {
      setShips(data.ships)
      setLastTimestamp(data.timestamp)
    })

    return () => {
      socket.off('fleet_state')
      socket.off('connect')
      socket.off('disconnect')
    }
  }, [])

  return { ships, lastTimestamp, connected }
}
