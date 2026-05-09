import { Ship } from '../types'
import { advanceShip } from './ships'

let fleet: Ship[] = []

export function initFleet(ships: Ship[]): void {
  fleet = ships.map(ship => ({ ...ship }))
  console.log(`Fleet initialized with ${fleet.length} ships`)
}

export function getFleet(): Ship[] {
  return fleet
}

export function updateFleet(deltaMs: number): Ship[] {
  fleet = fleet.map(ship => advanceShip(ship, deltaMs))
  return fleet
}