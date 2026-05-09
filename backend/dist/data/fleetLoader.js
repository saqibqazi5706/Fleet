"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.initialFleet = exports.ports = exports.navigableWater = void 0;
const rawData = __importStar(require("./fleet.json"));
const scenario = rawData;
validateScenario(scenario);
const portMap = {};
scenario.ports.forEach((port) => {
    portMap[port.id] = {
        id: port.id,
        name: port.name,
        lat: port.position[0],
        lng: port.position[1],
    };
});
exports.navigableWater = scenario.navigableWater;
exports.ports = portMap;
exports.initialFleet = scenario.fleet.map((raw) => {
    const destination = portMap[raw.destination];
    if (!destination) {
        throw new Error(`Unknown destination port: ${raw.destination} for ship ${raw.shipId}`);
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
        status: raw.status,
        inAdverseWeather: false,
        route: [],
        lastUpdated: Date.now(),
    };
});
function validateScenario(config) {
    if (!Array.isArray(config.fleet) || config.fleet.length !== 15) {
        throw new Error(`fleet.json must contain exactly 15 ships; found ${config.fleet?.length ?? 0}`);
    }
    if (!Array.isArray(config.ports) || config.ports.length === 0) {
        throw new Error('fleet.json must contain at least one port');
    }
    if (!Array.isArray(config.navigableWater) || config.navigableWater.length < 3) {
        throw new Error('fleet.json must contain a valid navigableWater polygon');
    }
    const portIds = new Set(config.ports.map((port) => port.id));
    const shipIds = new Set();
    config.fleet.forEach((ship, index) => {
        const label = ship.shipId || `ship at index ${index}`;
        if (!ship.shipId || shipIds.has(ship.shipId))
            throw new Error(`Invalid or duplicate shipId: ${label}`);
        shipIds.add(ship.shipId);
        if (!ship.name)
            throw new Error(`Missing name for ${label}`);
        if (!Array.isArray(ship.position) || ship.position.length !== 2)
            throw new Error(`Invalid position for ${label}`);
        if (!Number.isFinite(ship.position[0]) || !Number.isFinite(ship.position[1]))
            throw new Error(`Non-numeric position for ${label}`);
        if (!Number.isFinite(ship.speed))
            throw new Error(`Invalid speed for ${label}`);
        if (!Number.isFinite(ship.heading))
            throw new Error(`Invalid heading for ${label}`);
        if (!Number.isFinite(ship.fuel))
            throw new Error(`Invalid fuel for ${label}`);
        if (!ship.cargo)
            throw new Error(`Missing cargo for ${label}`);
        if (!ship.status)
            throw new Error(`Missing status for ${label}`);
        if (!portIds.has(ship.destination))
            throw new Error(`Unknown destination port ${ship.destination} for ${label}`);
    });
}
