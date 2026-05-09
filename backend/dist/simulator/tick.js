"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initFleet = initFleet;
exports.getFleet = getFleet;
exports.updateFleet = updateFleet;
exports.runImmediateGeofenceCheck = runImmediateGeofenceCheck;
exports.createRerouteApprovalsForInsideZones = createRerouteApprovalsForInsideZones;
exports.getRerouteApprovalState = getRerouteApprovalState;
exports.approvePendingReroute = approvePendingReroute;
exports.holdPendingReroute = holdPendingReroute;
exports.recomputeFleetRoutes = recomputeFleetRoutes;
exports.queueDirective = queueDirective;
exports.setShipDestination = setShipDestination;
exports.setShipWaypoint = setShipWaypoint;
exports.holdShip = holdShip;
exports.markDistressed = markDistressed;
const ships_1 = require("./ships");
const weatherPenalty_1 = require("../weather/weatherPenalty");
const weatherFetcher_1 = require("../weather/weatherFetcher");
const geofence_1 = require("../alerts/geofence");
const proximity_1 = require("../alerts/proximity");
const alertManager_1 = require("../alerts/alertManager");
const router_1 = require("../routing/router");
const rerouteApprovals_1 = require("../routing/rerouteApprovals");
const snapshotStore_1 = require("../playback/snapshotStore");
const supabase_1 = require("../persistence/supabase");
let fleet = [];
const pendingDirectives = new Map();
function initFleet(ships) {
    fleet = ships.map((ship) => {
        const routeResult = (0, router_1.computeRoute)(ship, [], (0, weatherFetcher_1.getWeatherAvoidanceZones)());
        return routeResult ? { ...ship, route: routeResult.route } : { ...ship, status: 'stranded', route: [] };
    });
    console.log(`Fleet initialized with ${fleet.length} ships`);
}
function getFleet() {
    return fleet;
}
function updateFleet(deltaMs, zones, weather) {
    applyPendingDirectives();
    fleet = fleet
        .map((ship) => (0, weatherPenalty_1.applyWeatherPenalty)(ship, weather))
        .map((ship) => ensureValidRoute(ship, zones))
        .map((ship) => applyFuelReachability(ship))
        .map((ship) => (0, ships_1.advanceShip)(ship, deltaMs));
    const geofenceResult = (0, geofence_1.checkGeofences)(fleet, zones);
    fleet = geofenceResult.ships;
    const fuelAlerts = fleet.reduce((items, ship) => {
        if (ship.status === 'stranded') {
            items.push({
                type: 'STRANDED',
                severity: 'critical',
                shipId: ship.id,
                message: `${ship.name} has no valid water route to ${ship.destination.name}`,
                dedupeKey: `STRANDED:${ship.id}`,
            });
        }
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
            const multiplier = ship.inAdverseWeather ? 1.3 : 1;
            const distance = (0, router_1.routeDistanceKm)(ship);
            const requiredFuel = distance * ships_1.BASE_FUEL_BURN_TONS_PER_KM * multiplier;
            items.push({
                type: 'INSUFFICIENT_FUEL',
                severity: 'high',
                shipId: ship.id,
                message: `${ship.name} has insufficient fuel`,
                dedupeKey: `INSUFFICIENT_FUEL:${ship.id}`,
                metadata: {
                    fuelRemainingTons: ship.fuel,
                    estimatedFuelRequiredTons: Number(requiredFuel.toFixed(2)),
                    routeDistanceKm: Number(distance.toFixed(2)),
                },
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
function runImmediateGeofenceCheck(zones) {
    const geofenceResult = (0, geofence_1.checkGeofences)(fleet, zones);
    fleet = geofenceResult.ships;
    geofenceResult.alerts.forEach(supabase_1.saveAlert);
    return { ships: fleet, alerts: geofenceResult.alerts };
}
function createRerouteApprovalsForInsideZones(zones) {
    const result = (0, rerouteApprovals_1.createInsideZoneRerouteApprovals)(fleet, zones);
    const pendingShipIds = new Set(result.approvals.map((approval) => approval.shipId));
    if (pendingShipIds.size > 0) {
        fleet = fleet.map((ship) => pendingShipIds.has(ship.id) ? { ...ship, status: 'restricted_zone_breach' } : ship);
    }
    result.alerts.forEach(supabase_1.saveAlert);
    return result;
}
function getRerouteApprovalState() {
    return (0, rerouteApprovals_1.getRerouteApprovals)();
}
function approvePendingReroute(id) {
    const approval = (0, rerouteApprovals_1.approveRerouteApproval)(id);
    if (!approval)
        return { ships: fleet, approval };
    fleet = fleet.map((ship) => ship.id === approval.shipId
        ? { ...ship, route: approval.proposedRoute, status: 'rerouting' }
        : ship);
    return { ships: fleet, approval };
}
function holdPendingReroute(id) {
    const approval = (0, rerouteApprovals_1.holdRerouteApproval)(id);
    if (!approval)
        return { ships: fleet, approval };
    fleet = fleet.map((ship) => ship.id === approval.shipId ? { ...ship, route: [], status: 'stopped' } : ship);
    return { ships: fleet, approval };
}
function recomputeFleetRoutes(zones) {
    const alerts = [];
    fleet = fleet.map((ship) => {
        const beforeStatus = ship.status;
        const beforeRoute = JSON.stringify(ship.route);
        const updated = ensureValidRoute(ship, zones, true);
        if (updated.status === 'stranded' && beforeStatus !== 'stranded') {
            console.warn(`[Simulator] ${ship.id} stranded: no valid route to ${ship.destination.name}`);
            const alert = (0, alertManager_1.createAlert)({
                type: 'STRANDED',
                severity: 'critical',
                shipId: ship.id,
                message: `${ship.name} has no valid water route to ${ship.destination.name}`,
                dedupeKey: `STRANDED:${ship.id}`,
            });
            if (alert)
                alerts.push(alert);
        }
        if (updated.status === 'rerouting' && beforeRoute !== JSON.stringify(updated.route)) {
            console.log(`[Simulator] ${ship.id} rerouted around active restricted zones`);
            const alert = (0, alertManager_1.createAlert)({
                type: 'ROUTE_REROUTE',
                severity: 'medium',
                shipId: ship.id,
                message: `${ship.name} automatically rerouted around restricted zone`,
                dedupeKey: `ROUTE_REROUTE:${ship.id}:${Date.now()}`,
                metadata: {
                    destination: ship.destination.name,
                    waypointCount: updated.route.length,
                    routeDistanceKm: Number((0, router_1.routeDistanceKm)(updated).toFixed(2)),
                },
            });
            if (alert)
                alerts.push(alert);
        }
        return updated;
    });
    alerts.forEach(supabase_1.saveAlert);
    return { ships: fleet, alerts };
}
function queueDirective(directive) {
    pendingDirectives.set(directive.id, directive);
}
function applyPendingDirectives() {
    pendingDirectives.forEach((directive) => {
        if (directive.type === 'HOLD_POSITION') {
            holdShip(directive.shipId);
        }
        if (directive.type === 'CHANGE_DESTINATION' && directive.payload.destination) {
            setShipDestination(directive.shipId, directive.payload.destination);
        }
        if (directive.type === 'REROUTE_WAYPOINT' && directive.payload.waypoint) {
            setShipWaypoint(directive.shipId, directive.payload.waypoint);
        }
    });
    pendingDirectives.clear();
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
function ensureValidRoute(ship, zones, force = false) {
    if (!canNavigate(ship) && !(force && ship.status === 'stranded'))
        return ship;
    if (!force && (0, router_1.isRouteValid)(ship, zones))
        return ship;
    const insideRestrictedZone = zones.some(zone => isShipInsideZone(ship, zone));
    if (insideRestrictedZone) {
        console.log(`[Simulator] ${ship.id} starts inside restricted zone; attempting escape route`);
    }
    const routeResult = (0, router_1.computeRoute)(ship, zones, (0, weatherFetcher_1.getWeatherAvoidanceZones)());
    if (!routeResult) {
        return { ...ship, status: 'stranded', route: [] };
    }
    const routeChanged = JSON.stringify(ship.route) !== JSON.stringify(routeResult.route);
    const nextStatus = insideRestrictedZone || ship.status === 'restricted_zone_breach'
        ? 'restricted_zone_breach'
        : routeChanged && ship.status !== 'insufficient_fuel'
            ? 'rerouting'
            : ship.status;
    return {
        ...ship,
        route: routeResult.route,
        status: nextStatus,
    };
}
function applyFuelReachability(ship) {
    if (!canNavigate(ship) || ship.status === 'out_of_fuel') {
        return {
            ...ship,
            fuelReachable: ship.status !== 'out_of_fuel',
            routeDistanceKm: (0, router_1.routeDistanceKm)(ship),
            estimatedFuelRequiredTons: 0,
            fuelShortfallTons: ship.status === 'out_of_fuel' ? 0 : undefined,
        };
    }
    const multiplier = ship.inAdverseWeather ? 1.3 : 1;
    const distance = (0, router_1.routeDistanceKm)(ship);
    const requiredFuel = distance * ships_1.BASE_FUEL_BURN_TONS_PER_KM * multiplier;
    const fuelReachable = ship.fuel >= requiredFuel;
    const fuelFields = {
        fuelReachable,
        routeDistanceKm: Number(distance.toFixed(2)),
        estimatedFuelRequiredTons: Number(requiredFuel.toFixed(2)),
        fuelShortfallTons: fuelReachable ? 0 : Number((requiredFuel - ship.fuel).toFixed(2)),
    };
    if (fuelReachable)
        return { ...ship, ...fuelFields };
    return ship.status === 'normal' || ship.status === 'rerouting'
        ? { ...ship, ...fuelFields, status: 'insufficient_fuel' }
        : { ...ship, ...fuelFields };
}
function canNavigate(ship) {
    return !['arrived', 'stopped', 'stranded', 'out_of_fuel'].includes(ship.status);
}
function isShipInsideZone(ship, zone) {
    let inside = false;
    const x = ship.lng;
    const y = ship.lat;
    for (let i = 0, j = zone.coordinates.length - 1; i < zone.coordinates.length; j = i++) {
        const yi = zone.coordinates[i][0];
        const xi = zone.coordinates[i][1];
        const yj = zone.coordinates[j][0];
        const xj = zone.coordinates[j][1];
        const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
        if (intersects)
            inside = !inside;
    }
    return inside;
}
