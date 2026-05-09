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
