import * as rawData from './fleet.json'
import { FleetScenario, Ship } from '../types'

// fleet.json now carries `waterPolygons` (array of two polygons: Persian Gulf + Gulf of Oman)
// as well as the legacy `navigableWater` (Persian Gulf only, kept for backward compat).
const scenario = rawData as FleetScenario & { waterPolygons?: [number, number][][] }

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

/**
 * Two corrected water polygons covering:
 *   [0] Persian Gulf (including Hormuz north channel)
 *   [1] Gulf of Oman (including Hormuz east exit + Sohar/Muscat coast)
 *
 * Use `isInWater(lat, lng)` to test whether a point is in navigable water.
 */
export const waterPolygons: [number, number][][] =
  scenario.waterPolygons ?? [scenario.navigableWater]

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