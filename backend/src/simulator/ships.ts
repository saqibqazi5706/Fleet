import { Ship } from '../types'
import {
  calculateBearing,
  moveAlongBearing,
  haversineDistance,
} from './geometry'

const WAYPOINT_ARRIVAL_RADIUS_KM = 0.5
const BASE_FUEL_BURN_TONS_PER_KM = 0.004  // tons per km (realistic for cargo ships)

export function advanceShip(ship: Ship, deltaMs: number): Ship {
  if (ship.status === 'arrived' || ship.status === 'stopped') {
    return ship
  }

  if (ship.fuel <= 0) {
    return { ...ship, status: 'out_of_fuel', fuel: 0 }
  }

  const deltaHours = deltaMs / 3_600_000
  const speedKmh = ship.speed * 1.852
  const distanceTraveledKm = speedKmh * deltaHours

  const target =
    ship.route.length > 0 ? ship.route[0] : ship.destination

  const bearing = calculateBearing(
    ship.lat, ship.lng,
    target.lat, target.lng
  )

  const newPos = moveAlongBearing(
    ship.lat, ship.lng,
    bearing, distanceTraveledKm
  )

  const distToTarget = haversineDistance(
    newPos.lat, newPos.lng,
    target.lat, target.lng
  )

  let updatedRoute = ship.route
  if (distToTarget < WAYPOINT_ARRIVAL_RADIUS_KM && ship.route.length > 0) {
    updatedRoute = ship.route.slice(1)
  }

  const distToDest = haversineDistance(
    newPos.lat, newPos.lng,
    ship.destination.lat, ship.destination.lng
  )

  if (distToDest < WAYPOINT_ARRIVAL_RADIUS_KM) {
    return {
      ...ship,
      lat: ship.destination.lat,
      lng: ship.destination.lng,
      status: 'arrived',
      route: [],
      lastUpdated: Date.now(),
    }
  }

  // Fuel burn in tons
  const fuelMultiplier = ship.inAdverseWeather ? 1.3 : 1.0
  const fuelBurned = distanceTraveledKm * BASE_FUEL_BURN_TONS_PER_KM * fuelMultiplier
  const newFuel = Math.max(0, ship.fuel - fuelBurned)

  // Fuel percentage for status check
  const fuelPercent = (newFuel / ship.maxFuel) * 100

  let newStatus = ship.status
  if (fuelPercent < 15 && ship.status === 'normal') {
    newStatus = 'insufficient_fuel'
  }

  return {
    ...ship,
    lat: newPos.lat,
    lng: newPos.lng,
    heading: bearing,
    fuel: parseFloat(newFuel.toFixed(2)),
    status: newStatus,
    route: updatedRoute,
    lastUpdated: Date.now(),
  }
}