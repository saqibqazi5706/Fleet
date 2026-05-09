import * as rawData from './fleet.json'
import { FleetScenario, Ship } from '../types'

const scenario = rawData as FleetScenario

validateScenario(scenario)

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

function validateScenario(config: FleetScenario): void {
  if (!Array.isArray(config.fleet) || config.fleet.length !== 15) {
    throw new Error(`fleet.json must contain exactly 15 ships; found ${config.fleet?.length ?? 0}`)
  }

  if (!Array.isArray(config.ports) || config.ports.length === 0) {
    throw new Error('fleet.json must contain at least one port')
  }

  if (!Array.isArray(config.navigableWater) || config.navigableWater.length < 3) {
    throw new Error('fleet.json must contain a valid navigableWater polygon')
  }

  const portIds = new Set(config.ports.map((port) => port.id))
  const shipIds = new Set<string>()

  config.fleet.forEach((ship, index) => {
    const label = ship.shipId || `ship at index ${index}`
    if (!ship.shipId || shipIds.has(ship.shipId)) throw new Error(`Invalid or duplicate shipId: ${label}`)
    shipIds.add(ship.shipId)
    if (!ship.name) throw new Error(`Missing name for ${label}`)
    if (!Array.isArray(ship.position) || ship.position.length !== 2) throw new Error(`Invalid position for ${label}`)
    if (!Number.isFinite(ship.position[0]) || !Number.isFinite(ship.position[1])) throw new Error(`Non-numeric position for ${label}`)
    if (!Number.isFinite(ship.speed)) throw new Error(`Invalid speed for ${label}`)
    if (!Number.isFinite(ship.heading)) throw new Error(`Invalid heading for ${label}`)
    if (!Number.isFinite(ship.fuel)) throw new Error(`Invalid fuel for ${label}`)
    if (!ship.cargo) throw new Error(`Missing cargo for ${label}`)
    if (!ship.status) throw new Error(`Missing status for ${label}`)
    if (!portIds.has(ship.destination)) throw new Error(`Unknown destination port ${ship.destination} for ${label}`)
  })
}
