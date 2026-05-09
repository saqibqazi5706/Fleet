"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WEATHER_FUEL_MULTIPLIER = void 0;
exports.isAdverseWeather = isAdverseWeather;
exports.getWeatherState = getWeatherState;
exports.getWeatherAvoidanceZones = getWeatherAvoidanceZones;
exports.refreshWeather = refreshWeather;
const axios_1 = __importDefault(require("axios"));
const HORMUZ_LAT = 26.5;
const HORMUZ_LNG = 56.5;
const WEATHER_REFRESH_TIMEOUT_MS = 5000;
exports.WEATHER_FUEL_MULTIPLIER = 1.3;
const adverseZone = {
    id: 'weather:hormuz-adverse-cell',
    label: 'Adverse weather cell',
    coordinates: [
        [26.85, 55.35],
        [26.65, 56.65],
        [25.85, 57.25],
        [25.00, 56.85],
        [25.10, 55.65],
        [25.85, 55.10],
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
};
let adverseWeather = true;
let weatherState = {
    adverse: true,
    windspeed10m: null,
    waveHeight: null,
    fuelPenaltyMultiplier: exports.WEATHER_FUEL_MULTIPLIER,
    adverseZone,
    updatedAt: Date.now(),
    source: 'fallback',
};
function isAdverseWeather() {
    return adverseWeather;
}
function getWeatherState() {
    return weatherState;
}
function getWeatherAvoidanceZones() {
    return weatherState.adverse && weatherState.adverseZone ? [weatherState.adverseZone] : [];
}
async function refreshWeather() {
    try {
        const [forecast, marine] = await Promise.all([
            axios_1.default.get(process.env.OPEN_METEO_URL || 'https://api.open-meteo.com/v1/forecast', {
                params: {
                    latitude: HORMUZ_LAT,
                    longitude: HORMUZ_LNG,
                    current: 'wind_speed_10m',
                    wind_speed_unit: 'kmh',
                },
                timeout: WEATHER_REFRESH_TIMEOUT_MS,
            }),
            axios_1.default.get(process.env.OPEN_METEO_MARINE_URL || 'https://marine-api.open-meteo.com/v1/marine', {
                params: {
                    latitude: HORMUZ_LAT,
                    longitude: HORMUZ_LNG,
                    current: 'wave_height',
                },
                timeout: WEATHER_REFRESH_TIMEOUT_MS,
            }),
        ]);
        const wind = normalizeNumber(forecast.data?.current?.wind_speed_10m);
        const wave = normalizeNumber(marine.data?.current?.wave_height);
        adverseWeather = wind > 15 || wave > 2.5;
        weatherState = {
            adverse: adverseWeather,
            windspeed10m: wind,
            waveHeight: wave,
            fuelPenaltyMultiplier: adverseWeather ? exports.WEATHER_FUEL_MULTIPLIER : 1,
            adverseZone: adverseWeather ? { ...adverseZone, updatedAt: Date.now() } : null,
            updatedAt: Date.now(),
            source: 'open-meteo',
        };
        console.log(`Weather updated: wind=${wind}, wave=${wave}, adverse=${adverseWeather}`);
    }
    catch (error) {
        adverseWeather = true;
        weatherState = {
            adverse: true,
            windspeed10m: null,
            waveHeight: null,
            fuelPenaltyMultiplier: exports.WEATHER_FUEL_MULTIPLIER,
            adverseZone: { ...adverseZone, updatedAt: Date.now() },
            updatedAt: Date.now(),
            source: 'fallback',
        };
        console.warn('Weather fetch failed; using adverse weather fallback');
    }
}
function normalizeNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}
