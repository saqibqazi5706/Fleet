export type ShipStatus =
  | 'normal'
  | 'rerouting'
  | 'distressed'
  | 'stopped'
  | 'stranded'
  | 'insufficient_fuel'
  | 'arrived'
  | 'out_of_fuel'
  | 'restricted_zone_breach'

export interface Position {
  lat: number
  lng: number
}

export interface Ship {
  id: string
  name: string
  lat: number
  lng: number
  speed: number
  heading: number
  destination: {
    portId: string
    name: string
    lat: number
    lng: number
  }
  fuel: number
  maxFuel: number
  cargo: string
  status: ShipStatus
  inAdverseWeather: boolean
  route: Position[]
  lastUpdated: number
}

export interface Zone {
  id: string
  coordinates: [number, number][]
  label: string
  createdAt: number
  updatedAt: number
}

export interface Alert {
  id: string
  type: 'GEOFENCE_BREACH' | 'PROXIMITY_WARNING' | 'STRANDED' | 'INSUFFICIENT_FUEL' | 'OUT_OF_FUEL' | 'DISTRESS' | 'WEATHER_RISK' | 'ARRIVAL'
  severity: 'low' | 'medium' | 'high' | 'critical'
  shipId?: string
  relatedShipId?: string
  message: string
  active: boolean
  acknowledged: boolean
  createdAt: number
  resolvedAt?: number
  metadata?: Record<string, unknown>
}

export interface WeatherState {
  adverse: boolean
  windspeed10m: number | null
  waveHeight: number | null
  updatedAt: number
  source: 'open-meteo' | 'fallback'
}

export interface FleetStatePayload {
  ships: Ship[]
  zones: Zone[]
  alerts: Alert[]
  weather: WeatherState
  timestamp: number
}

export interface Directive {
  id: string
  shipId: string
  fromCommand: true
  type: 'CHANGE_DESTINATION' | 'HOLD_POSITION' | 'REROUTE_WAYPOINT'
  payload: {
    destination?: { lat: number; lng: number; name: string }
    waypoint?: { lat: number; lng: number }
  }
  sentAt: number
}

export interface DistressResult {
  shipId: string
  raw: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  issueType: string
  injuries: number
  damageEstimate: string
  impact: string
  recommendedAction: string
  parsedAt: number
}
