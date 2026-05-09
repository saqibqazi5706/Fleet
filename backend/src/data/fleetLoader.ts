import * as rawData from './fleet.json'
import { FleetScenario, Ship } from '../types'

const scenario = rawData as FleetScenario

const portMap: Record<string, { id: string; name: string; lat: number; lng: number }> = {}

scenario.ports.forEach((port) => {
  portMap[port.id] = {
    id: port.id,
    name: port.name,
    lat: port.position[0],
    lng: port.position[1],
  }
})

export const navigableWater: [number, number][] = scenario.navigableWater
export const ports = portMap

export const initialFleet: Ship[] = scenario.fleet.map((raw) => {
  const destination = portMap[raw.destination]
  if (!destination) {
    throw new Error(`Unknown destination port: ${raw.destination} for ship ${raw.shipId}`)
  }

  return {
    id: raw.shipId,
    name: raw.name,
    lat: raw.position[0],
    lng: raw.position[1],
    speed: raw.speed,
    heading: raw.heading,
    destination: {
      portId: destination.id,
      name: destination.name,
      lat: destination.lat,
      lng: destination.lng,
    },
    fuel: raw.fuel,
    maxFuel: raw.fuel,
    cargo: raw.cargo,
    status: raw.status as Ship['status'],
    inAdverseWeather: false,
    route: [],
    lastUpdated: Date.now(),
  }
})
