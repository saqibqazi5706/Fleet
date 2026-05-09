'use client'

import dynamic from 'next/dynamic'
import { useMemo, useState } from 'react'
import { EmergencyAudioControls } from '@/components/alerts/EmergencyAudioControls'
import { AlertPanel } from '@/components/alerts/AlertPanel'
import { AIDistressResult } from '@/components/directives/AIDistressResult'
import { DirectiveComposer } from '@/components/directives/DirectiveComposer'
import { TopBar } from '@/components/layout/TopBar'
import { PlaybackSlider } from '@/components/playback/PlaybackSlider'
import { ShipDetailCard } from '@/components/ships/ShipDetailCard'
import { useAlerts } from '@/lib/socket/useAlerts'
import { useDirectives } from '@/lib/socket/useDirectives'
import { useFleetState } from '@/lib/socket/useFleetState'
import { usePlayback } from '@/lib/socket/usePlayback'
import { useZones } from '@/lib/socket/useZones'
import { Ship } from '@/lib/types'

const FleetMap = dynamic(() => import('@/components/map/FleetMap'), {
  ssr: false,
  loading: () => <div className="mapLoading">Loading command map...</div>,
})

export default function CommandPage() {
  const { ships, connected, lastTimestamp } = useFleetState()
  const { zones } = useZones()
  const { alerts, acknowledgeAlert } = useAlerts()
  const { distressResults, sendDirective } = useDirectives(undefined, true)
  const { windowRange, snapshotShips, snapshotTimestamp, requestSnapshot, clearSnapshot } = usePlayback()
  const [selectedShipId, setSelectedShipId] = useState<string | null>(null)

  const displayShips = snapshotShips || ships
  const selectedShip = useMemo(
    () => displayShips.find((ship) => ship.id === selectedShipId) || displayShips[0],
    [displayShips, selectedShipId]
  )

  return (
    <main className="opsShell">
      <TopBar
        role="Command Center"
        connected={connected}
        shipCount={ships.length}
        lastTimestamp={lastTimestamp}
      />
      <aside className="leftRail">
        <ShipDetailCard ship={selectedShip} />
        <DirectiveComposer ship={selectedShip} onSend={sendDirective} />
        <AIDistressResult results={distressResults} alerts={alerts} />
      </aside>
      <section className="mapStage">
        <FleetMap
          ships={displayShips}
          zones={zones}
          selectedShipId={selectedShip?.id}
          commandMode
          onSelectShip={(ship: Ship) => setSelectedShipId(ship.id)}
        />
        {snapshotTimestamp && <div className="snapshotBanner">Playback {new Date(snapshotTimestamp).toLocaleTimeString()}</div>}
      </section>
      <aside className="rightRail">
        <EmergencyAudioControls alerts={alerts} />
        <AlertPanel alerts={alerts} onAcknowledge={acknowledgeAlert} />
        <PlaybackSlider
          start={windowRange.start}
          end={windowRange.end}
          count={windowRange.count}
          activeTimestamp={snapshotTimestamp}
          onRequest={requestSnapshot}
          onClear={clearSnapshot}
        />
        <section className="panel">
          <h2>Zones</h2>
          <p className="muted">{zones.length} active restricted zone{zones.length === 1 ? '' : 's'}.</p>
        </section>
      </aside>
    </main>
  )
}
