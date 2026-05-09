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

export interface Port {
  id: string
  name: string
  position: [number, number]  // [lat, lng]
}

export interface Ship {
  id: string
  name: string
  lat: number
  lng: number
  speed: number           // knots
  heading: number         // degrees 0-360
  destination: {
    portId: string
    name: string
    lat: number
    lng: number
  }
  fuel: number            // tons remaining
  maxFuel: number         // tons at start (for percentage display)
  cargo: string
  status: ShipStatus
  inAdverseWeather: boolean
  route: Position[]
  lastUpdated: number
}

export type AlertType =
  | 'GEOFENCE_BREACH'
  | 'PROXIMITY_WARNING'
  | 'STRANDED'
  | 'INSUFFICIENT_FUEL'
  | 'OUT_OF_FUEL'
  | 'DISTRESS'
  | 'WEATHER_RISK'
  | 'ARRIVAL'

export type Severity = 'low' | 'medium' | 'high' | 'critical'

export interface Zone {
  id: string
  coordinates: [number, number][]
  label: string
  createdAt: number
  updatedAt: number
}

export interface Alert {
  id: string
  type: AlertType
  severity: Severity
  shipId?: string
  relatedShipId?: string
  message: string
  active: boolean
  acknowledged: boolean
  createdAt: number
  resolvedAt?: number
  metadata?: Record<string, unknown>
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

export interface DistressParseResult {
  shipId: string
  raw: string
  severity: Severity
  issueType: string
  injuries: number
  damageEstimate: 'none' | 'minor' | 'moderate' | 'major' | 'total_loss' | 'unknown'
  impact: string
  recommendedAction: string
  parsedAt: number
}

export interface Snapshot {
  timestamp: number
  ships: Ship[]
  alerts?: Alert[]
  zones?: Zone[]
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

export interface FleetScenario {
  scenario: { name: string; description: string }
  coordinateFormat: string
  units: { speed: string; fuel: string; heading: string }
  boundingBox: { north: number; south: number; east: number; west: number }
  navigableWater: [number, number][]
  ports: Array<{ id: string; name: string; position: [number, number] }>
  fleet: Array<{
    shipId: string
    name: string
    position: [number, number]
    speed: number
    heading: number
    destination: string
    fuel: number
    cargo: string
    status: string
  }>
}
