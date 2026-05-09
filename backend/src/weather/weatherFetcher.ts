import axios from 'axios'
import { WeatherState, Zone } from '../types'

const HORMUZ_LAT = 26.5
const HORMUZ_LNG = 56.5
const WEATHER_REFRESH_TIMEOUT_MS = 5000
export const WEATHER_FUEL_MULTIPLIER = 1.3

const adverseZone: Zone = {
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
}

let adverseWeather = true
let weatherState: WeatherState = {
  adverse: true,
  windspeed10m: null,
  waveHeight: null,
  fuelPenaltyMultiplier: WEATHER_FUEL_MULTIPLIER,
  adverseZone,
  updatedAt: Date.now(),
  source: 'fallback',
}

export function isAdverseWeather(): boolean {
  return adverseWeather
}

export function getWeatherState(): WeatherState {
  return weatherState
}

export function getWeatherAvoidanceZones(): Zone[] {
  return weatherState.adverse && weatherState.adverseZone ? [weatherState.adverseZone] : []
}

export async function refreshWeather(): Promise<void> {
  try {
    const [forecast, marine] = await Promise.all([
      axios.get(process.env.OPEN_METEO_URL || 'https://api.open-meteo.com/v1/forecast', {
        params: {
          latitude: HORMUZ_LAT,
          longitude: HORMUZ_LNG,
          current: 'wind_speed_10m',
          wind_speed_unit: 'kmh',
        },
        timeout: WEATHER_REFRESH_TIMEOUT_MS,
      }),
      axios.get(process.env.OPEN_METEO_MARINE_URL || 'https://marine-api.open-meteo.com/v1/marine', {
        params: {
          latitude: HORMUZ_LAT,
          longitude: HORMUZ_LNG,
          current: 'wave_height',
        },
        timeout: WEATHER_REFRESH_TIMEOUT_MS,
      }),
    ])

    const wind = normalizeNumber(forecast.data?.current?.wind_speed_10m)
    const wave = normalizeNumber(marine.data?.current?.wave_height)
    adverseWeather = wind > 15 || wave > 2.5
    weatherState = {
      adverse: adverseWeather,
      windspeed10m: wind,
      waveHeight: wave,
      fuelPenaltyMultiplier: adverseWeather ? WEATHER_FUEL_MULTIPLIER : 1,
      adverseZone: adverseWeather ? { ...adverseZone, updatedAt: Date.now() } : null,
      updatedAt: Date.now(),
      source: 'open-meteo',
    }
    console.log(`Weather updated: wind=${wind}, wave=${wave}, adverse=${adverseWeather}`)
  } catch (error) {
    adverseWeather = true
    weatherState = {
      adverse: true,
      windspeed10m: null,
      waveHeight: null,
      fuelPenaltyMultiplier: WEATHER_FUEL_MULTIPLIER,
      adverseZone: { ...adverseZone, updatedAt: Date.now() },
      updatedAt: Date.now(),
      source: 'fallback',
    }
    console.warn('Weather fetch failed; using adverse weather fallback')
  }
}

function normalizeNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
