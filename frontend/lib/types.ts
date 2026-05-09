export type ShipStatus =
  | 'normal'
  | 'rerouting'
  | 'distressed'
  | 'stopped'
  | 'stranded'
  | 'insufficient_fuel'
  | 'arrived'
  | 'out_of_fuel'

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
}

export interface Alert {
  id: string
  type: 'GEOFENCE_BREACH' | 'PROXIMITY_WARNING' | 'STRANDED' | 'INSUFFICIENT_FUEL' | 'OUT_OF_FUEL'
  severity: 'low' | 'medium' | 'high' | 'critical'
  shipId: string
  message: string
  active: boolean
  acknowledged: boolean
  createdAt: number
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
