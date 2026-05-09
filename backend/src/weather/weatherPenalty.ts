import { Ship, WeatherState } from '../types'
import { pointInPolygon } from '../routing/geometry'

export function applyWeatherPenalty(ship: Ship, weather: WeatherState): Ship {
  const inAdverseWeather = Boolean(
    weather.adverse &&
    weather.adverseZone &&
    pointInPolygon({ lat: ship.lat, lng: ship.lng }, weather.adverseZone.coordinates)
  )

  return { ...ship, inAdverseWeather }
}
