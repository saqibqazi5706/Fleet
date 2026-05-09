"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyWeatherPenalty = applyWeatherPenalty;
const geometry_1 = require("../routing/geometry");
function applyWeatherPenalty(ship, weather) {
    const inAdverseWeather = Boolean(weather.adverse &&
        weather.adverseZone &&
        (0, geometry_1.pointInPolygon)({ lat: ship.lat, lng: ship.lng }, weather.adverseZone.coordinates));
    return { ...ship, inAdverseWeather };
}
