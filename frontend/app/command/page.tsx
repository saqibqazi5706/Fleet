'use client'

import dynamic from 'next/dynamic'
import { useMemo, useState } from 'react'
import { AlertPanel } from '@/components/alerts/AlertPanel'
import { AIDistressResult } from '@/components/directives/AIDistressResult'
import { DirectiveComposer } from '@/components/directives/DirectiveComposer'
import { TopBar } from '@/components/layout/TopBar'
import { PlaybackSlider } from '@/components/playback/PlaybackSlider'
import { ShipDetailCard } from '@/components/ships/ShipDetailCard'
import { HUDCornerDecor } from '@/components/layout/HUDCornerDecor'
import { useAlerts } from '@/lib/socket/useAlerts'
import { useDirectives } from '@/lib/socket/useDirectives'
import { useFleetState } from '@/lib/socket/useFleetState'
import { usePlayback } from '@/lib/socket/usePlayback'
import { useZones } from '@/lib/socket/useZones'
import { Ship } from '@/lib/types'

const FleetMap = dynamic(() => import('@/components/map/FleetMap'), {
  ssr: false,
  loading: () => (
    <div className="mapLoading">
      <div className="mapSpinner" />
      <span>INITIALIZING COMMAND systems...</span>
    </div>
  ),
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
    <main className="opsShell noise">
      <HUDCornerDecor position="top-left" />
      <HUDCornerDecor position="top-right" />
      <HUDCornerDecor position="bottom-left" />
      <HUDCornerDecor position="bottom-right" />

      <TopBar
        role="Command Center"
        connected={connected}
        shipCount={ships.length}
        lastTimestamp={lastTimestamp}
      />

      <aside className="leftRail">
        <div className="panel" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <h2 style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.18em', color: 'rgba(148,163,184,0.45)' }}>
              VESSEL DETAILS
            </h2>
          </div>
          <ShipDetailCard ship={selectedShip} />
        </div>

        <DirectiveComposer ship={selectedShip} onSend={sendDirective} />
        <AIDistressResult results={distressResults} />
      </aside>

      <section className="mapStage">
        <FleetMap
          ships={displayShips}
          zones={zones}
          selectedShipId={selectedShip?.id}
          commandMode
          onSelectShip={(ship: Ship) => setSelectedShipId(ship.id)}
        />
        {snapshotTimestamp && (
          <div className="snapshotBanner">
            ⏱ PLAYBACK {new Date(snapshotTimestamp).toLocaleTimeString()}
          </div>
        )}
      </section>

      <aside className="rightRail">
        <section className="panel" style={{ marginBottom: 16 }}>
          <div className="panelTitleRow">
            <h2 style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.18em', color: 'rgba(148,163,184,0.45)' }}>
              ZONES
            </h2>
            <span className="badge badge-info">{zones.length} ACTIVE</span>
          </div>
          <p className="muted" style={{ fontSize: '12px', marginTop: 8 }}>
            {zones.length === 0
              ? 'No restricted zones defined. Use polygon tool on map.'
              : `Tracking ${zones.length} restricted zone${zones.length === 1 ? '' : 's'}.`}
          </p>
        </section>

        <AlertPanel alerts={alerts} onAcknowledge={acknowledgeAlert} />

        <PlaybackSlider
          start={windowRange.start}
          end={windowRange.end}
          count={windowRange.count}
          activeTimestamp={snapshotTimestamp}
          onRequest={requestSnapshot}
          onClear={clearSnapshot}
        />
      </aside>
    </main>
  )
}
