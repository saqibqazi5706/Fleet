import axios from 'axios'

const HORMUZ_LAT = 26.5
const HORMUZ_LNG = 56.5

let adverseWeather = true

export function isAdverseWeather(): boolean {
  return adverseWeather
}

export async function refreshWeather(): Promise<void> {
  try {
    const url = process.env.OPEN_METEO_URL || 'https://api.open-meteo.com/v1/forecast'
    const response = await axios.get(url, {
      params: {
        latitude: HORMUZ_LAT,
        longitude: HORMUZ_LNG,
        hourly: 'windspeed_10m,wave_height',
        forecast_days: 1,
      },
      timeout: 5000,
    })

    const hour = new Date().getHours()
    const wind = response.data?.hourly?.windspeed_10m?.[hour] ?? 0
    const wave = response.data?.hourly?.wave_height?.[hour] ?? 0
    adverseWeather = wind > 15 || wave > 2.5
    console.log(`Weather updated: wind=${wind}, wave=${wave}, adverse=${adverseWeather}`)
  } catch (error) {
    adverseWeather = true
    console.warn('Weather fetch failed; using adverse weather fallback')
  }
}
