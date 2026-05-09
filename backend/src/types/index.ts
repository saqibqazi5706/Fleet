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