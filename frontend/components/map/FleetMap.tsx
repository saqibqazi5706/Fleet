'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import 'mapbox-gl/dist/mapbox-gl.css'
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'
import { Ship, Zone } from '@/lib/types'
import { getSocket } from '@/lib/socket/socketClient'

const MAX_INTERPOLATION_JUMP_KM = 3

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

interface FleetMapProps {
  ships: Ship[]
  zones?: Zone[]
  selectedShipId?: string | null
  captainShipId?: string
  commandMode?: boolean
  onSelectShip?: (ship: Ship) => void
}

export default function FleetMap({
  ships,
  zones = [],
  selectedShipId,
  captainShipId,
  commandMode = false,
  onSelectShip,
}: FleetMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<Record<string, mapboxgl.Marker>>({})
  const shipsRef = useRef<Ship[]>([])
  const prevShipsRef = useRef<Record<string, { lat: number; lng: number }>>({})
  const animFrameRef = useRef<number>(0)
  const tickStartRef = useRef<number>(Date.now())
  const drawRef = useRef<mapboxgl.IControl | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  // Initialize map once
  useEffect(() => {
    if (!mapContainerRef.current) return

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [56.5, 26.5],
      zoom: 6,
    })

    map.addControl(new mapboxgl.NavigationControl(), 'top-right')
    map.on('load', () => {
      map.addSource('ship-routes', buildRouteSource([]))
      map.addLayer({
        id: 'ship-routes-line',
        type: 'line',
        source: 'ship-routes',
        paint: {
          'line-color': [
            'case',
            ['==', ['get', 'selected'], true],
            '#00e5ff',
            ['==', ['get', 'captainShip'], true],
            '#00ff88',
            '#64748b',
          ],
          'line-width': [
            'case',
            ['==', ['get', 'selected'], true],
            4,
            ['==', ['get', 'captainShip'], true],
            4,
            1.5,
          ],
          'line-opacity': [
            'case',
            ['==', ['get', 'selected'], true],
            0.95,
            ['==', ['get', 'captainShip'], true],
            0.95,
            0.28,
          ],
          'line-dasharray': [
            'case',
            ['==', ['get', 'status'], 'rerouting'],
            ['literal', [1.5, 1]],
            ['literal', [1, 0]],
          ],
        },
      })
      map.addSource('destination-ports', buildDestinationSource([]))
      map.addLayer({
        id: 'destination-ports-circle',
        type: 'circle',
        source: 'destination-ports',
        paint: {
          'circle-radius': [
            'case',
            ['==', ['get', 'selected'], true],
            6,
            4,
          ],
          'circle-color': '#22d3ee',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.5,
          'circle-opacity': 0.95,
        },
      })
      map.addLayer({
        id: 'destination-ports-label',
        type: 'symbol',
        source: 'destination-ports',
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 11,
          'text-offset': [0, 1.1],
          'text-anchor': 'top',
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#cffafe',
          'text-halo-color': '#04111f',
          'text-halo-width': 1.4,
        },
      })
      map.addSource('restricted-zones', buildZoneSource([]))
      map.addLayer({
        id: 'restricted-zones-fill',
        type: 'fill',
        source: 'restricted-zones',
        paint: {
          'fill-color': '#ff3344',
          'fill-opacity': 0.18,
        },
      })
      map.addLayer({
        id: 'restricted-zones-line',
        type: 'line',
        source: 'restricted-zones',
        paint: {
          'line-color': '#ff6677',
          'line-width': 2,
          'line-dasharray': [2, 2],
        },
      })
      map.addLayer({
        id: 'restricted-zones-label',
        type: 'symbol',
        source: 'restricted-zones',
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 12,
          'text-anchor': 'center',
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#ffd1d8',
          'text-halo-color': '#28050b',
          'text-halo-width': 1.2,
        },
      })
      setMapLoaded(true)
    })
    mapRef.current = map

    return () => {
      setMapLoaded(false)
      map.remove()
      cancelAnimationFrame(animFrameRef.current)
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded || !commandMode || drawRef.current) return

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true,
      },
    })
    drawRef.current = draw as mapboxgl.IControl
    map.addControl(draw, 'top-left')

    const syncDrawnZone = (
      action: 'create_zone' | 'update_zone',
      event: { features: Array<{ id?: string | number; geometry?: { coordinates?: number[][][] } }> }
    ) => {
      event.features.forEach((feature) => {
        const ring = feature.geometry?.coordinates?.[0]
        if (!ring || ring.length < 4) return
        const id = String(feature.id || `zone:${Date.now()}`)
        getSocket().emit(action, {
          id,
          coordinates: ring.slice(0, -1).map((coord) => [coord[1], coord[0]]),
          label: 'Command restricted zone',
        })
      })
    }

    const handleCreate = (event: { features: Array<{ id?: string | number; geometry?: { coordinates?: number[][][] } }> }) =>
      syncDrawnZone('create_zone', event)
    const handleUpdate = (event: { features: Array<{ id?: string | number; geometry?: { coordinates?: number[][][] } }> }) =>
      syncDrawnZone('update_zone', event)
    const handleDelete = (event: { features: Array<{ id?: string | number }> }) => {
      event.features.forEach((feature) => {
        if (feature.id) getSocket().emit('delete_zone', { id: String(feature.id) })
      })
    }

    map.on('draw.create', handleCreate)
    map.on('draw.update', handleUpdate)
    map.on('draw.delete', handleDelete)

    return () => {
      map.off('draw.create', handleCreate)
      map.off('draw.update', handleUpdate)
      map.off('draw.delete', handleDelete)
      if (drawRef.current) {
        try {
          map.removeControl(drawRef.current)
        } catch {
          // Mapbox Draw can already be detached during React dev remounts.
        }
        drawRef.current = null
      }
    }
  }, [commandMode, mapLoaded])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return
    const source = map.getSource('restricted-zones') as mapboxgl.GeoJSONSource | undefined
    source?.setData(buildZoneFeatureCollection(zones))
  }, [zones, mapLoaded])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return
    const source = map.getSource('ship-routes') as mapboxgl.GeoJSONSource | undefined
    source?.setData(buildRouteFeatureCollection(ships, selectedShipId, captainShipId))
    const destinationSource = map.getSource('destination-ports') as mapboxgl.GeoJSONSource | undefined
    destinationSource?.setData(buildDestinationFeatureCollection(ships, selectedShipId, captainShipId))
  }, [ships, selectedShipId, captainShipId, mapLoaded])

  // Update markers when ships data changes
  useEffect(() => {
    if (ships.length === 0) return

    shipsRef.current.forEach(ship => {
      prevShipsRef.current[ship.id] = { lat: ship.lat, lng: ship.lng }
    })

    shipsRef.current = ships
    tickStartRef.current = Date.now()

    const map = mapRef.current
    if (!map || !mapLoaded) return

    ships.forEach(ship => {
      if (!markersRef.current[ship.id]) {
        const el = createShipElement(ship, selectedShipId === ship.id, captainShipId === ship.id)
        el.addEventListener('click', () => onSelectShip?.(ship))
        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([ship.lng, ship.lat])
          .setPopup(
            new mapboxgl.Popup({ offset: 25 }).setHTML(buildPopupHTML(ship))
          )
          .addTo(map)
        markersRef.current[ship.id] = marker
      } else {
        markersRef.current[ship.id]
          .getPopup()
          ?.setHTML(buildPopupHTML(ship))

        const el = markersRef.current[ship.id].getElement()
        const svg = el.querySelector('svg')
        if (svg) svg.style.transform = `rotate(${ship.heading}deg)`
        updateShipElement(el, ship, selectedShipId === ship.id, captainShipId === ship.id)
      }
    })
  }, [ships, selectedShipId, captainShipId, onSelectShip, mapLoaded])

  // Interpolation animation loop
  useEffect(() => {
    const animate = () => {
      const now = Date.now()
      const elapsed = now - tickStartRef.current
      const progress = Math.min(elapsed / 1000, 1)

      shipsRef.current.forEach(ship => {
        const marker = markersRef.current[ship.id]
        const prev = prevShipsRef.current[ship.id]
        if (!marker || !prev) return

        if (roughDistanceKm(prev.lat, prev.lng, ship.lat, ship.lng) > MAX_INTERPOLATION_JUMP_KM) {
          marker.setLngLat([ship.lng, ship.lat])
          return
        }

        const interpLat = prev.lat + (ship.lat - prev.lat) * progress
        const interpLng = prev.lng + (ship.lng - prev.lng) * progress
        marker.setLngLat([interpLng, interpLat])
      })

      animFrameRef.current = requestAnimationFrame(animate)
    }

    animFrameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [])

  return (
    <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
  )
}

function createShipElement(ship: Ship, selected: boolean, captainShip: boolean): HTMLDivElement {
  const el = document.createElement('div')
  updateShipElement(el, ship, selected, captainShip)
  el.title = ship.name
  return el
}

function roughDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const kmPerDegreeLat = 111
  const kmPerDegreeLng = 111 * Math.cos((lat1 * Math.PI) / 180)
  const dLat = (lat2 - lat1) * kmPerDegreeLat
  const dLng = (lng2 - lng1) * kmPerDegreeLng
  return Math.sqrt(dLat * dLat + dLng * dLng)
}

function updateShipElement(el: HTMLElement, ship: Ship, selected: boolean, captainShip: boolean) {
  el.style.cssText = `
    width: ${selected || captainShip ? 34 : 28}px;
    height: ${selected || captainShip ? 34 : 28}px;
    cursor: pointer;
    opacity: ${captainShip || !selected ? 1 : 0.86};
    filter: drop-shadow(0 0 ${selected || captainShip ? 12 : 6}px ${getStatusColor(ship.status)}cc);
  `
  el.innerHTML = `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style="transform: rotate(${ship.heading}deg); transition: transform 0.5s ease;"
    >
      <path
        d="M12 2L6 20L12 16L18 20L12 2Z"
        fill="${getStatusColor(ship.status)}"
        stroke="white"
        stroke-width="${selected || captainShip ? 2 : 1}"
      />
    </svg>
  `
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'normal':            return '#00C8FF'
    case 'rerouting':         return '#FFB800'
    case 'distressed':        return '#FF4444'
    case 'stopped':           return '#888888'
    case 'stranded':          return '#FF0000'
    case 'restricted_zone_breach': return '#FF0033'
    case 'insufficient_fuel': return '#FF8800'
    case 'arrived':           return '#00FF88'
    case 'out_of_fuel':       return '#FF0000'
    default:                  return '#00C8FF'
  }
}

function buildPopupHTML(ship: Ship): string {
  const fuelPercent = ((ship.fuel / ship.maxFuel) * 100).toFixed(1)
  const fuelColor = parseFloat(fuelPercent) < 15 ? '#FF8800' : '#00FF88'

  return `
    <div style="
      font-family: monospace;
      font-size: 12px;
      color: #fff;
      background: #1a1a2e;
      padding: 10px;
      border-radius: 6px;
      min-width: 190px;
      line-height: 1.6;
    ">
      <div style="font-weight:bold; font-size:14px; margin-bottom:6px; color:#00C8FF">
        ${ship.name}
      </div>
      <div>ID: <span style="color:#888">${ship.id}</span></div>
      <div>Status: <span style="color:${getStatusColor(ship.status)}">${ship.status.toUpperCase()}</span></div>
      <div>Cargo: ${ship.cargo}</div>
      <div>Speed: ${ship.speed} knots</div>
      <div>Heading: ${Math.round(ship.heading)}°</div>
      <div>Fuel: <span style="color:${fuelColor}">${ship.fuel.toFixed(0)}t (${fuelPercent}%)</span></div>
      <div>Destination: ${ship.destination.name}</div>
      <div style="margin-top:6px; color:#555; font-size:10px">
        ${ship.lat.toFixed(4)}°N, ${ship.lng.toFixed(4)}°E
      </div>
    </div>
  `
}

function buildZoneSource(zones: Zone[]): mapboxgl.GeoJSONSourceSpecification {
  return {
    type: 'geojson',
    data: buildZoneFeatureCollection(zones),
  }
}

function buildZoneFeatureCollection(zones: Zone[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: zones.map((zone) => ({
      type: 'Feature',
      properties: { id: zone.id, label: zone.label },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          ...zone.coordinates.map((coord) => [coord[1], coord[0]]),
          [zone.coordinates[0][1], zone.coordinates[0][0]],
        ]],
      },
    })),
  }
}

function buildRouteSource(ships: Ship[]): mapboxgl.GeoJSONSourceSpecification {
  return {
    type: 'geojson',
    data: buildRouteFeatureCollection(ships, null, undefined),
  }
}

function buildDestinationSource(ships: Ship[]): mapboxgl.GeoJSONSourceSpecification {
  return {
    type: 'geojson',
    data: buildDestinationFeatureCollection(ships, null, undefined),
  }
}

function buildRouteFeatureCollection(
  ships: Ship[],
  selectedShipId?: string | null,
  captainShipId?: string
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: ships
      .map((ship) => {
        const coordinates = [
          [ship.lng, ship.lat],
          ...ship.route.map((point) => [point.lng, point.lat]),
          [ship.destination.lng, ship.destination.lat],
        ]
        return {
          type: 'Feature' as const,
          properties: {
            id: ship.id,
            status: ship.status,
            selected: ship.id === selectedShipId,
            captainShip: ship.id === captainShipId,
          },
          geometry: {
            type: 'LineString' as const,
            coordinates,
          },
        }
      })
      .filter((feature) => feature.geometry.coordinates.length >= 2),
  }
}

function buildDestinationFeatureCollection(
  ships: Ship[],
  selectedShipId?: string | null,
  captainShipId?: string
): GeoJSON.FeatureCollection {
  const destinations = new Map<string, {
    name: string
    lng: number
    lat: number
    selected: boolean
  }>()

  ships.forEach((ship) => {
    const key = `${ship.destination.lat},${ship.destination.lng}`
    const existing = destinations.get(key)
    destinations.set(key, {
      name: ship.destination.name,
      lng: ship.destination.lng,
      lat: ship.destination.lat,
      selected: Boolean(existing?.selected || ship.id === selectedShipId || ship.id === captainShipId),
    })
  })

  return {
    type: 'FeatureCollection',
    features: Array.from(destinations.values()).map((destination) => ({
      type: 'Feature' as const,
      properties: {
        name: destination.name,
        selected: destination.selected,
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [destination.lng, destination.lat],
      },
    })),
  }
}
