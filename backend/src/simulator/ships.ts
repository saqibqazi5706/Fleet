import { Ship } from '../types'
import {
  calculateBearing,
  moveAlongBearing,
  haversineDistance,
} from './geometry'

const WAYPOINT_ARRIVAL_RADIUS_KM = 0.5
const BASE_FUEL_BURN_TONS_PER_KM = 0.004  // tons per kg (realistic for cargo ships)

// A ship is considered stranded when it has been stopped/distressed with less than
// this much fuel for this many consecutive ticks (each tick is ~1 s → 300 s = 5 min)
const STRANDED_FUEL_THRESHOLD_TONS = 50
const STRANDED_TICK_THRESHOLD = 300

// Per-ship tick counters for stranded detection (in-memory, resets on restart)
const strandedCounters: Record<string, number> = {}

export function advanceShip(ship: Ship, deltaMs: number): Ship {
  if (ship.status === 'arrived') {
    return ship
  }

  // ── Stranded detection ────────────────────────────────────────────────────
  // A ship is stranded when it has been immobilised (stopped / distressed /
  // out_of_fuel) with critically low fuel long enough that self-rescue is
  // implausible.
  if (
    (ship.status === 'stopped' ||
      ship.status === 'distressed' ||
      ship.status === 'out_of_fuel') &&
    ship.fuel < STRANDED_FUEL_THRESHOLD_TONS
  ) {
    strandedCounters[ship.id] = (strandedCounters[ship.id] ?? 0) + 1
    if (strandedCounters[ship.id] >= STRANDED_TICK_THRESHOLD) {
      return { ...ship, status: 'stranded', lastUpdated: Date.now() }
    }
  } else {
    // Reset counter when the condition clears (e.g. directive arrives, refuelled)
    strandedCounters[ship.id] = 0
  }

  if (ship.status === 'stopped' || ship.status === 'stranded') {
    return ship
  }

  if (ship.fuel <= 0) {
    return { ...ship, status: 'out_of_fuel', fuel: 0, lastUpdated: Date.now() }
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
    strandedCounters[ship.id] = 0
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
  if (newFuel === 0) {
    newStatus = 'out_of_fuel'
  } else if (fuelPercent < 15 && (ship.status === 'normal' || ship.status === 'rerouting')) {
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