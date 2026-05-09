import { Ship } from '../types'

export function applyWeatherPenalty(ship: Ship, adverseWeather: boolean): Ship {
  return { ...ship, inAdverseWeather: adverseWeather }
}
