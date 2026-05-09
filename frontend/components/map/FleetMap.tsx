'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { Ship } from '@/lib/socket/useFleetState'

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

interface FleetMapProps {
  ships: Ship[]
}

export default function FleetMap({ ships }: FleetMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<Record<string, mapboxgl.Marker>>({})
  const shipsRef = useRef<Ship[]>([])
  const prevShipsRef = useRef<Record<string, { lat: number; lng: number }>>({})
  const animFrameRef = useRef<number>(0)
  const tickStartRef = useRef<number>(Date.now())

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
    mapRef.current = map

    return () => {
      map.remove()
      cancelAnimationFrame(animFrameRef.current)
    }
  }, [])

  // Update markers when ships data changes
  useEffect(() => {
    if (ships.length === 0) return

    shipsRef.current.forEach(ship => {
      prevShipsRef.current[ship.id] = { lat: ship.lat, lng: ship.lng }
    })

    shipsRef.current = ships
    tickStartRef.current = Date.now()

    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return

    ships.forEach(ship => {
      if (!markersRef.current[ship.id]) {
        const el = createShipElement(ship)
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
      }
    })
  }, [ships])

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

function createShipElement(ship: Ship): HTMLDivElement {
  const el = document.createElement('div')
  el.style.cssText = `
    width: 28px;
    height: 28px;
    cursor: pointer;
    filter: drop-shadow(0 0 6px rgba(0,200,255,0.8));
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
        stroke-width="1"
      />
    </svg>
  `
  el.title = ship.name
  return el
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