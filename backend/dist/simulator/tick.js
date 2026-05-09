"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initFleet = initFleet;
exports.getFleet = getFleet;
exports.updateFleet = updateFleet;
exports.setShipDestination = setShipDestination;
exports.setShipWaypoint = setShipWaypoint;
exports.holdShip = holdShip;
exports.markDistressed = markDistressed;
const ships_1 = require("./ships");
const weatherPenalty_1 = require("../weather/weatherPenalty");
const geofence_1 = require("../alerts/geofence");
const proximity_1 = require("../alerts/proximity");
const alertManager_1 = require("../alerts/alertManager");
const router_1 = require("../routing/router");
const snapshotStore_1 = require("../playback/snapshotStore");
const supabase_1 = require("../persistence/supabase");
let fleet = [];
function initFleet(ships) {
    fleet = ships.map(ship => ({ ...ship }));
    console.log(`Fleet initialized with ${fleet.length} ships`);
}
function getFleet() {
    return fleet;
}
function updateFleet(deltaMs, zones, adverseWeather) {
    fleet = fleet
        .map((ship) => (0, weatherPenalty_1.applyWeatherPenalty)(ship, adverseWeather))
        .map((ship) => {
        const routedShip = ship.status === 'normal' || ship.status === 'rerouting'
            ? { ...ship, route: (0, router_1.computeRoute)(ship, zones) }
            : ship;
        return (0, ships_1.advanceShip)(routedShip, deltaMs);
    });
    const geofenceResult = (0, geofence_1.checkGeofences)(fleet, zones);
    fleet = geofenceResult.ships;
    const fuelAlerts = fleet.reduce((items, ship) => {
        if (ship.status === 'out_of_fuel') {
            items.push({
                type: 'OUT_OF_FUEL',
                severity: 'critical',
                shipId: ship.id,
                message: `${ship.name} is out of fuel`,
                dedupeKey: `OUT_OF_FUEL:${ship.id}`,
            });
        }
        if (ship.status === 'insufficient_fuel') {
            items.push({
                type: 'INSUFFICIENT_FUEL',
                severity: 'high',
                shipId: ship.id,
                message: `${ship.name} has insufficient fuel`,
                dedupeKey: `INSUFFICIENT_FUEL:${ship.id}`,
            });
        }
        return items;
    }, []);
    const createdFuelAlerts = fuelAlerts.flatMap((input) => {
        const alert = (0, alertManager_1.createAlert)(input);
        return alert ? [alert] : [];
    });
    const proximityAlerts = (0, proximity_1.checkProximity)(fleet);
    const snapshot = (0, snapshotStore_1.maybeSaveSnapshot)(fleet);
    if (snapshot)
        (0, supabase_1.saveSnapshot)(snapshot);
    const alerts = [...geofenceResult.alerts, ...createdFuelAlerts, ...proximityAlerts];
    alerts.forEach(supabase_1.saveAlert);
    return { ships: fleet, alerts };
}
function setShipDestination(shipId, destination) {
    const ship = fleet.find((candidate) => candidate.id === shipId);
    if (!ship)
        return null;
    fleet = fleet.map((candidate) => candidate.id === shipId
        ? {
            ...candidate,
            destination: { portId: 'DIRECTIVE', ...destination },
            route: [],
            status: 'rerouting',
        }
        : candidate);
    return fleet.find((candidate) => candidate.id === shipId) || null;
}
function setShipWaypoint(shipId, waypoint) {
    fleet = fleet.map((ship) => ship.id === shipId ? { ...ship, route: [waypoint], status: 'rerouting' } : ship);
    return fleet.find((ship) => ship.id === shipId) || null;
}
function holdShip(shipId) {
    fleet = fleet.map((ship) => (ship.id === shipId ? { ...ship, status: 'stopped' } : ship));
    return fleet.find((ship) => ship.id === shipId) || null;
}
function markDistressed(shipId) {
    fleet = fleet.map((ship) => (ship.id === shipId ? { ...ship, status: 'distressed' } : ship));
    return fleet.find((ship) => ship.id === shipId) || null;
}
