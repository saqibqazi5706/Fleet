'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import 'mapbox-gl/dist/mapbox-gl.css'
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'
import { Ship, Zone } from '@/lib/types'
import { getSocket } from '@/lib/socket/socketClient'

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
  const routesInitializedRef = useRef<boolean>(false)

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
      // Restricted zones source
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

      // Ship routes source — one source, multiple filtered layers
      map.addSource('ship-routes', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      // ── Direct route (ship has no waypoints — straight line to dest) ──
      map.addLayer({
        id: 'ship-route-direct',
        type: 'line',
        source: 'ship-routes',
        filter: ['==', ['get', 'lineType'], 'direct'],
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 1.5,
          'line-opacity': 0.35,
          'line-dasharray': [4, 3],
        },
      })

      // ── Waypoint route (ship is actively detouring around a zone) ──
      map.addLayer({
        id: 'ship-route-waypoint',
        type: 'line',
        source: 'ship-routes',
        filter: ['==', ['get', 'lineType'], 'waypoint'],
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 2.5,
          'line-opacity': 0.75,
        },
      })

      // ── Waypoint dots ──────────────────────────────────────────────────
      map.addLayer({
        id: 'ship-waypoint-dot',
        type: 'circle',
        source: 'ship-routes',
        filter: ['==', ['get', 'type'], 'waypoint'],
        paint: {
          'circle-radius': 4,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.9,
        },
      })

      // ── Destination marker – outer glow ────────────────────────────────
      map.addLayer({
        id: 'ship-destination-outer',
        type: 'circle',
        source: 'ship-routes',
        filter: ['==', ['get', 'type'], 'destination'],
        paint: {
          'circle-radius': 14,
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.18,
          'circle-stroke-width': 0,
        },
      })

      // ── Destination marker – inner solid ──────────────────────────────
      map.addLayer({
        id: 'ship-destination-inner',
        type: 'circle',
        source: 'ship-routes',
        filter: ['==', ['get', 'type'], 'destination'],
        paint: {
          'circle-radius': 6,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.95,
        },
      })

      // ── Destination label ──────────────────────────────────────────────
      map.addLayer({
        id: 'ship-destination-label',
        type: 'symbol',
        source: 'ship-routes',
        filter: ['==', ['get', 'type'], 'destination'],
        layout: {
          'text-field': ['get', 'portName'],
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
          'text-size': 10,
          'text-offset': [0, 1.6],
          'text-anchor': 'top',
        },
        paint: {
          'text-color': ['get', 'color'],
          'text-halo-color': '#000000',
          'text-halo-width': 1.5,
          'text-opacity': 0.85,
        },
      })

      routesInitializedRef.current = true
    })
    mapRef.current = map

    return () => {
      map.remove()
      cancelAnimationFrame(animFrameRef.current)
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !commandMode || drawRef.current) return

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true,
      },
    })
    drawRef.current = draw as mapboxgl.IControl
    map.addControl(draw, 'top-left')

    const syncDrawnZone = (event: { features: Array<{ id?: string | number; geometry?: { coordinates?: number[][][] } }> }) => {
      event.features.forEach((feature) => {
        const ring = feature.geometry?.coordinates?.[0]
        if (!ring || ring.length < 4) return
        const id = String(feature.id || `zone:${Date.now()}`)
        getSocket().emit('create_zone', {
          id,
          coordinates: ring.slice(0, -1).map((coord) => [coord[1], coord[0]]),
          label: 'Command restricted zone',
        })
      })
    }

    map.on('draw.create', syncDrawnZone)
    map.on('draw.update', syncDrawnZone)

    return () => {
      map.off('draw.create', syncDrawnZone)
      map.off('draw.update', syncDrawnZone)
      if (drawRef.current) {
        try {
          map.removeControl(drawRef.current)
        } catch {
          // Mapbox Draw can already be detached during React dev remounts.
        }
        drawRef.current = null
      }
    }
  }, [commandMode])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    const source = map.getSource('restricted-zones') as mapboxgl.GeoJSONSource | undefined
    source?.setData(buildZoneFeatureCollection(zones))
  }, [zones])

  // Update markers and routes when ships data changes
  useEffect(() => {
    if (ships.length === 0) return

    shipsRef.current.forEach(ship => {
      prevShipsRef.current[ship.id] = { lat: ship.lat, lng: ship.lng }
    })

    shipsRef.current = ships
    tickStartRef.current = Date.now()

    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return

    // Update route + destination layer
    const routeSource = map.getSource('ship-routes') as mapboxgl.GeoJSONSource
    if (routeSource) {
      routeSource.setData(buildRoutesFeatureCollection(ships, selectedShipId ?? null))
    }

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
  }, [ships, selectedShipId, captainShipId, onSelectShip])

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
    case 'insufficient_fuel': return '#FF8800'
    case 'arrived':           return '#00FF88'
    case 'out_of_fuel':       return '#FF0000'
    default:                  return '#00C8FF'
  }
}

function buildPopupHTML(ship: Ship): string {
  const fuelPercent = ((ship.fuel / ship.maxFuel) * 100).toFixed(1)
  const fuelColor = parseFloat(fuelPercent) < 15 ? '#FF8800' : '#00FF88'

  const waypointsList = ship.route.slice(0, 4)
    .map((wp, i) => `<li style="color:#94a3b8; font-size:11px; margin:2px 0">WP${i + 1}: ${wp.lat.toFixed(2)}°N, ${wp.lng.toFixed(2)}°E</li>`)
    .join('')
  const moreCount = ship.route.length - 4
  const moreHtml = moreCount > 0 ? `<li style="color:#64748b; font-size:10px; font-style:italic">+${moreCount} more waypoints...</li>` : ''

  return `
    <div style="
      font-family: monospace;
      font-size: 12px;
      color: #fff;
      background: #1a1a2e;
      padding: 12px;
      border-radius: 8px;
      min-width: 220px;
      line-height: 1.6;
      border: 1px solid rgba(0,212,255,0.15);
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    ">
      <div style="font-weight:bold; font-size:14px; margin-bottom:8px; color:#00d4ff; display:flex; align-items:center; gap:8px">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L6 20L12 16L18 20L12 2Z"/></svg>
        ${ship.name}
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px; margin-bottom:8px; font-size:11px">
        <div>ID: <span style="color:#888">${ship.id}</span></div>
        <div>Status: <span style="color:${getStatusColor(ship.status)}">${ship.status.toUpperCase()}</span></div>
        <div>Cargo: ${ship.cargo}</div>
        <div>Speed: ${ship.speed} kt</div>
        <div>Heading: ${Math.round(ship.heading)}°</div>
        <div>Fuel: <span style="color:${fuelColor}">${ship.fuel.toFixed(0)}t (${fuelPercent}%)</span></div>
      </div>
      <div style="border-top:1px solid rgba(255,255,255,0.1); margin:8px 0; padding-top:8px">
        <div style="color:#ffb800; font-weight:700; margin-bottom:6px; font-size:11px">▶ DESTINATION</div>
        <div style="color:#fff; margin-bottom:4px">${ship.destination.name}</div>
        <div style="color:#888; font-size:11px">${ship.destination.lat.toFixed(4)}°N, ${ship.destination.lng.toFixed(4)}°E</div>
      </div>
      ${ship.route.length > 0 ? `
      <div>
        <div style="color:#ffb800; font-weight:700; margin-bottom:4px; font-size:11px">⎈ DETOUR WAYPOINTS</div>
        <ul style="margin:0; padding:0; list-style:none">
          ${waypointsList}
          ${moreHtml}
        </ul>
      </div>` : ''}
      <div style="margin-top:8px; font-size:10px; color:#64748b; border-top:1px solid rgba(255,255,255,0.05); padding-top:6px">
        ${ship.lat.toFixed(4)}°N, ${ship.lng.toFixed(4)}°E · Updated ${new Date(ship.lastUpdated).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
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

/**
 * Build GeoJSON features for all ship routes and destination markers.
 *
 * For every non-arrived ship we always draw:
 *   1. A line from the ship's current position → through any waypoints → to the destination.
 *      - If the ship has active waypoints (zone detour), the line is "waypoint" style (solid, brighter).
 *      - If the ship is going straight, the line is "direct" style (dashed, subtle).
 *   2. A dot for each intermediate waypoint (zone detour only).
 *   3. A circle + label at the destination port.
 *
 * When a ship is selected its route is rendered at full opacity / on top; the rest are dimmed.
 */
function buildRoutesFeatureCollection(ships: Ship[], selectedShipId: string | null): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = []
  const hasSelection = selectedShipId !== null

  ships.forEach(ship => {
    // Don't draw routes for arrived ships
    if (ship.status === 'arrived') return

    const color = getStatusColor(ship.status)
    const isSelected = ship.id === selectedShipId
    // Dim non-selected ships when something is selected
    const opacity = hasSelection && !isSelected ? 0.3 : 1.0

    const hasWaypoints = ship.route && ship.route.length > 0

    // ── Route line ─────────────────────────────────────────────────────────
    // Always start from the ship's live position, pass through waypoints,
    // and end at the destination.
    const lineCoords: [number, number][] = [
      [ship.lng, ship.lat],
      ...(hasWaypoints ? ship.route.map(p => [p.lng, p.lat] as [number, number]) : []),
      [ship.destination.lng, ship.destination.lat],
    ]

    features.push({
      type: 'Feature',
      properties: {
        shipId: ship.id,
        type: 'route',
        lineType: hasWaypoints ? 'waypoint' : 'direct',
        color,
        opacity,
      },
      geometry: {
        type: 'LineString',
        coordinates: lineCoords,
      },
    })

    // ── Intermediate waypoint dots (only when detouring) ──────────────────
    if (hasWaypoints) {
      ship.route.forEach((wp, i) => {
        features.push({
          type: 'Feature',
          properties: {
            shipId: ship.id,
            type: 'waypoint',
            index: i + 1,
            color,
            opacity,
          },
          geometry: {
            type: 'Point',
            coordinates: [wp.lng, wp.lat],
          },
        })
      })
    }

    // ── Destination marker ────────────────────────────────────────────────
    features.push({
      type: 'Feature',
      properties: {
        shipId: ship.id,
        type: 'destination',
        portName: ship.destination.name,
        color,
        opacity,
      },
      geometry: {
        type: 'Point',
        coordinates: [ship.destination.lng, ship.destination.lat],
      },
    })
  })

  return { type: 'FeatureCollection', features }
}