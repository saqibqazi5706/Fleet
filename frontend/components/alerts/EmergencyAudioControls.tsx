'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert } from '@/lib/types'
import {
  getEmergencyVolume,
  playAlertNotification,
  playTestAlarm,
  setEmergencyVolume,
  startDistressAlarm,
  stopEmergencyAlarm,
  unlockEmergencyAudio,
} from '@/lib/audio/emergencyAudio'

export function EmergencyAudioControls({ alerts }: { alerts: Alert[] }) {
  const [armed, setArmed] = useState(false)
  const [volume, setVolume] = useState(85)
  const seenAlertIds = useRef(new Set<string>())

  const activeDistress = useMemo(
    () =>
      alerts
        .filter((alert) => alert.active && !alert.acknowledged && alert.type === 'DISTRESS')
        .sort((a, b) => severityRank[b.severity] - severityRank[a.severity] || b.createdAt - a.createdAt),
    [alerts]
  )

  useEffect(() => {
    setVolume(Math.round(getEmergencyVolume() * 100))
  }, [])

  useEffect(() => {
    if (!armed) return

    const newestUnseen = alerts.find(
      (alert) => alert.active && !alert.acknowledged && !seenAlertIds.current.has(alert.id)
    )
    alerts.forEach((alert) => seenAlertIds.current.add(alert.id))

    if (!newestUnseen) return
    if (newestUnseen.type === 'DISTRESS') {
      startDistressAlarm(newestUnseen.severity)
      return
    }
    playAlertNotification(newestUnseen.severity)
  }, [alerts, armed])

  const armAudio = async () => {
    const ok = await unlockEmergencyAudio()
    setArmed(ok)
    if (ok && activeDistress[0]) startDistressAlarm(activeDistress[0].severity)
  }

  const testAlarm = async () => {
    if (!armed) {
      const ok = await unlockEmergencyAudio()
      setArmed(ok)
      if (!ok) return
    }
    playTestAlarm()
  }

  const changeVolume = (value: number) => {
    setVolume(value)
    setEmergencyVolume(value / 100)
  }

  return (
    <section className="panel">
      <div className="panelTitleRow">
        <h2>Emergency Audio</h2>
        <span className={`countPill ${armed ? 'audioArmed' : 'audioMuted'}`}>
          {armed ? 'AUDIO ARMED' : 'CLICK TO ENABLE'}
        </span>
      </div>
      <div className="buttonRow">
        <button className={armed ? 'iconButton wide' : 'primaryButton'} onClick={armAudio}>
          {armed ? 'Armed' : 'Enable Audio'}
        </button>
        <button className="iconButton wide" onClick={testAlarm}>Test</button>
        <button className="iconButton wide" onClick={stopEmergencyAlarm}>Silence</button>
      </div>
      <label className="volumeControl">
        <span>Volume {volume}%</span>
        <input min={0} max={100} type="range" value={volume} onChange={(event) => changeVolume(Number(event.target.value))} />
      </label>
      {activeDistress[0] && (
        <div className="distressNow">
          <strong>NEW DISTRESS SIGNAL</strong>
          <span>{activeDistress[0].shipId}: {activeDistress[0].message}</span>
        </div>
      )}
    </section>
  )
}

const severityRank = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
}
