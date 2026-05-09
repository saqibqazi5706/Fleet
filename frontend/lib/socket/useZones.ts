'use client'

import { useEffect, useState } from 'react'
import { Zone } from '@/lib/types'
import { getSocket } from './socketClient'

export function useZones() {
  const [zones, setZones] = useState<Zone[]>([])

  useEffect(() => {
    const socket = getSocket()

    const handleState = (data: { zones: Zone[] }) => setZones(data.zones)
    const handleFleetState = (data: { zones?: Zone[] }) => {
      if (data.zones) setZones(data.zones)
    }
    const handleUpdate = (data: { action: 'create' | 'update' | 'delete'; zone: Zone }) => {
      setZones((current) => {
        if (data.action === 'delete') return current.filter((zone) => zone.id !== data.zone.id)
        const rest = current.filter((zone) => zone.id !== data.zone.id)
        return [...rest, data.zone]
      })
    }

    socket.on('zones_state', handleState)
    socket.on('zone_updated', handleUpdate)
    socket.on('fleet_state', handleFleetState)

    return () => {
      socket.off('zones_state', handleState)
      socket.off('zone_updated', handleUpdate)
      socket.off('fleet_state', handleFleetState)
    }
  }, [])

  return { zones }
}
