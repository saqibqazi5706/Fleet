import { Zone } from '../types'

const zones = new Map<string, Zone>()

export function getZones(): Zone[] {
  return Array.from(zones.values())
}

export function createZone(input: { id: string; coordinates: [number, number][]; label: string }): Zone {
  const zone: Zone = {
    id: input.id,
    coordinates: input.coordinates,
    label: input.label || 'Restricted zone',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  zones.set(zone.id, zone)
  return zone
}

export function updateZone(input: { id: string; coordinates: [number, number][] }): Zone | null {
  const existing = zones.get(input.id)
  if (!existing) return null

  const updated = { ...existing, coordinates: input.coordinates, updatedAt: Date.now() }
  zones.set(updated.id, updated)
  return updated
}

export function deleteZone(id: string): Zone | null {
  const existing = zones.get(id)
  if (!existing) return null
  zones.delete(id)
  return existing
}
