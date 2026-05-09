"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAdverseWeather = isAdverseWeather;
exports.refreshWeather = refreshWeather;
const axios_1 = __importDefault(require("axios"));
const HORMUZ_LAT = 26.5;
const HORMUZ_LNG = 56.5;
let adverseWeather = true;
function isAdverseWeather() {
    return adverseWeather;
}
async function refreshWeather() {
    try {
        const url = process.env.OPEN_METEO_URL || 'https://api.open-meteo.com/v1/forecast';
        const response = await axios_1.default.get(url, {
            params: {
                latitude: HORMUZ_LAT,
                longitude: HORMUZ_LNG,
                hourly: 'windspeed_10m,wave_height',
                forecast_days: 1,
            },
            timeout: 5000,
        });
        const hour = new Date().getHours();
        const wind = response.data?.hourly?.windspeed_10m?.[hour] ?? 0;
        const wave = response.data?.hourly?.wave_height?.[hour] ?? 0;
        adverseWeather = wind > 15 || wave > 2.5;
        console.log(`Weather updated: wind=${wind}, wave=${wave}, adverse=${adverseWeather}`);
    }
    catch (error) {
        adverseWeather = true;
        console.warn('Weather fetch failed; using adverse weather fallback');
    }
}
