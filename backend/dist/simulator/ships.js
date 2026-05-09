"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BASE_FUEL_BURN_TONS_PER_KM = void 0;
exports.advanceShip = advanceShip;
const geometry_1 = require("./geometry");
const WAYPOINT_ARRIVAL_RADIUS_KM = 0.5;
exports.BASE_FUEL_BURN_TONS_PER_KM = 0.004; // tons per km (realistic for cargo ships)
function advanceShip(ship, deltaMs) {
    if (ship.status === 'arrived' || ship.status === 'stopped' || ship.status === 'stranded') {
        return ship;
    }
    if (ship.fuel <= 0) {
        return { ...ship, status: 'out_of_fuel', fuel: 0 };
    }
    const deltaHours = deltaMs / 3600000;
    const speedKmh = ship.speed * 1.852;
    const distanceTraveledKm = speedKmh * deltaHours;
    const target = ship.route.length > 0 ? ship.route[0] : ship.destination;
    const bearing = (0, geometry_1.calculateBearing)(ship.lat, ship.lng, target.lat, target.lng);
    const newPos = (0, geometry_1.moveAlongBearing)(ship.lat, ship.lng, bearing, distanceTraveledKm);
    const distToTarget = (0, geometry_1.haversineDistance)(newPos.lat, newPos.lng, target.lat, target.lng);
    let updatedRoute = ship.route;
    if (distToTarget < WAYPOINT_ARRIVAL_RADIUS_KM && ship.route.length > 0) {
        updatedRoute = ship.route.slice(1);
    }
    const distToDest = (0, geometry_1.haversineDistance)(newPos.lat, newPos.lng, ship.destination.lat, ship.destination.lng);
    if (distToDest < WAYPOINT_ARRIVAL_RADIUS_KM) {
        return {
            ...ship,
            lat: ship.destination.lat,
            lng: ship.destination.lng,
            status: 'arrived',
            route: [],
            lastUpdated: Date.now(),
        };
    }
    // Fuel burn in tons
    const fuelMultiplier = ship.inAdverseWeather ? 1.3 : 1.0;
    const fuelBurned = distanceTraveledKm * exports.BASE_FUEL_BURN_TONS_PER_KM * fuelMultiplier;
    const newFuel = Math.max(0, ship.fuel - fuelBurned);
    // Fuel percentage for status check
    const fuelPercent = (newFuel / ship.maxFuel) * 100;
    let newStatus = ship.status;
    if (newFuel <= 0) {
        newStatus = 'out_of_fuel';
    }
    else if (fuelPercent < 15 && (ship.status === 'normal' || ship.status === 'rerouting')) {
        newStatus = 'insufficient_fuel';
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
    };
}
