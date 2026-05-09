'use client'

import { useEffect, useState } from 'react'
import { getSocket } from './socketClient'
import { Alert, FleetStatePayload, Ship, WeatherState, Zone } from '@/lib/types'

export function useFleetState() {
  const [ships, setShips] = useState<Ship[]>([])
  const [lastTimestamp, setLastTimestamp] = useState<number>(0)
  const [connected, setConnected] = useState(false)
  const [zones, setZones] = useState<Zone[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [weather, setWeather] = useState<WeatherState | null>(null)

  useEffect(() => {
    const socket = getSocket()

    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))
    setConnected(socket.connected)

    socket.on('fleet_state', (data: FleetStatePayload | { ships: Ship[]; timestamp: number }) => {
      setShips(data.ships)
      setLastTimestamp(data.timestamp)
      if ('zones' in data) setZones(data.zones)
      if ('alerts' in data) setAlerts(data.alerts)
      if ('weather' in data) setWeather(data.weather)
    })

    return () => {
      socket.off('fleet_state')
      socket.off('connect')
      socket.off('disconnect')
    }
  }, [])

  return { ships, zones, alerts, weather, lastTimestamp, connected }
}
