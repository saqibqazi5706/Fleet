'use client'

import { useEffect, useState } from 'react'
import { getSocket } from './socketClient'

export interface Position {
  lat: number
  lng: number
}

export interface Ship {
  id: string
  name: string
  lat: number
  lng: number
  speed: number
  heading: number
  destination: {
    portId: string
    name: string
    lat: number
    lng: number
  }
  fuel: number
  maxFuel: number
  cargo: string
  status: string
  inAdverseWeather: boolean
  route: Position[]
  lastUpdated: number
}

export function useFleetState() {
  const [ships, setShips] = useState<Ship[]>([])
  const [lastTimestamp, setLastTimestamp] = useState<number>(0)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const socket = getSocket()

    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))

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