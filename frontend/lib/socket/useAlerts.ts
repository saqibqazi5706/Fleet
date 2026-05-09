'use client'

import { useEffect, useState } from 'react'
import { Alert } from '@/lib/types'
import { getSocket } from './socketClient'

export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([])

  useEffect(() => {
    const socket = getSocket()

    const handleState = (data: { alerts: Alert[] }) => setAlerts(data.alerts)
    const handleFleetState = (data: { alerts?: Alert[] }) => {
      if (data.alerts) setAlerts(data.alerts)
    }
    const handleCreated = (alert: Alert) => {
      setAlerts((current) => [alert, ...current.filter((item) => item.id !== alert.id)])
      playAlertSound(alert.severity)
    }
    const handleUpdated = (alert: Alert) => {
      setAlerts((current) => [alert, ...current.filter((item) => item.id !== alert.id)])
    }
    const handleDistressSignal = (event: { alert?: Alert }) => {
      if (!event.alert) return
      setAlerts((current) => [event.alert!, ...current.filter((item) => item.id !== event.alert!.id)])
      playAlertSound(event.alert.severity)
    }

    socket.on('alerts_state', handleState)
    socket.on('alert_created', handleCreated)
    socket.on('alert_updated', handleUpdated)
    socket.on('distress_signal', handleDistressSignal)
    socket.on('fleet_state', handleFleetState)

    return () => {
      socket.off('alerts_state', handleState)
      socket.off('alert_created', handleCreated)
      socket.off('alert_updated', handleUpdated)
      socket.off('distress_signal', handleDistressSignal)
      socket.off('fleet_state', handleFleetState)
    }
  }, [])

  const acknowledgeAlert = (alertId: string) => {
    getSocket().emit('acknowledge_alert', { alertId })
    setAlerts((current) =>
      current.map((alert) => alert.id === alertId ? { ...alert, active: false, acknowledged: true } : alert)
    )
  }

  return { alerts, acknowledgeAlert }
}

function playAlertSound(severity: Alert['severity']) {
  if (typeof window === 'undefined') return
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) return

  const context = new AudioContextClass()
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = severity === 'critical' ? 'sawtooth' : 'sine'
  oscillator.frequency.value = severity === 'critical' ? 880 : 520
  gain.gain.value = 0.025
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start()
  oscillator.stop(context.currentTime + 0.12)
}
