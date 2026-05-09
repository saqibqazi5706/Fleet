'use client'

import dynamic from 'next/dynamic'
import { useMemo } from 'react'
import { useParams } from 'next/navigation'
import { EmergencyAudioControls } from '@/components/alerts/EmergencyAudioControls'
import { DirectiveReceiver } from '@/components/directives/DirectiveReceiver'
import { DistressInput } from '@/components/directives/DistressInput'
import { TopBar } from '@/components/layout/TopBar'
import { ShipDetailCard } from '@/components/ships/ShipDetailCard'
import { useAlerts } from '@/lib/socket/useAlerts'
import { useDirectives } from '@/lib/socket/useDirectives'
import { useFleetState } from '@/lib/socket/useFleetState'
import { useZones } from '@/lib/socket/useZones'

const FleetMap = dynamic(() => import('@/components/map/FleetMap'), {
  ssr: false,
  loading: () => <div className="mapLoading">Loading captain map...</div>,
})

export default function CaptainPage() {
  const params = useParams<{ shipId: string }>()
  const shipId = params.shipId
  const { ships, connected, lastTimestamp } = useFleetState()
  const { zones } = useZones()
  const { alerts } = useAlerts()
  const { directives, respondToDirective, escalateDistress } = useDirectives(shipId)
  const ownShip = useMemo(() => ships.find((ship) => ship.id === shipId), [ships, shipId])
  const relevantAlerts = alerts.filter((alert) => alert.shipId === shipId || alert.relatedShipId === shipId)

  return (
    <main className="opsShell captainShell">
      <TopBar
        role={`Captain ${shipId}`}
        connected={connected}
        shipCount={ships.length}
        lastTimestamp={lastTimestamp}
      />
      <section className="mapStage">
        <FleetMap ships={ships} zones={zones} selectedShipId={shipId} captainShipId={shipId} />
      </section>
      <aside className="rightRail captainRail">
        <EmergencyAudioControls alerts={relevantAlerts} />
        <ShipDetailCard ship={ownShip} title="Assigned Vessel" />
        <DirectiveReceiver
          directives={directives.filter((directive) => directive.shipId === shipId)}
          onAccept={(directive) => respondToDirective(directive, 'ACCEPT')}
          onEscalate={(directive, message) => respondToDirective(directive, 'ESCALATE_DISTRESS', message)}
        />
        <DistressInput shipId={shipId} onEscalate={escalateDistress} />
        <section className="panel">
          <h2>Zone Access</h2>
          <p className="muted">Restricted zones are visible here but editable only from Command.</p>
        </section>
      </aside>
    </main>
  )
}
