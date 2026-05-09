'use client'

import { Alert } from '@/lib/types'

const STORAGE_KEY = 'straitwatch:emergency-volume'

let audioContext: AudioContext | null = null
let alarmTimer: number | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AudioContextClass =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) return null
  if (!audioContext) audioContext = new AudioContextClass()
  return audioContext
}

export async function unlockEmergencyAudio(): Promise<boolean> {
  const context = getAudioContext()
  if (!context) return false
  if (context.state === 'suspended') await context.resume()
  playTone([520], 0.08, 0.25)
  return context.state === 'running'
}

export function getEmergencyVolume(): number {
  if (typeof window === 'undefined') return 0.85
  const stored = Number(window.localStorage.getItem(STORAGE_KEY))
  return Number.isFinite(stored) ? Math.min(Math.max(stored, 0), 1) : 0.85
}

export function setEmergencyVolume(volume: number): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, String(Math.min(Math.max(volume, 0), 1)))
}

export function playAlertNotification(severity: Alert['severity']): void {
  if (severity === 'critical') {
    playTone([880, 660, 880], 0.14, 0.8)
    return
  }
  if (severity === 'high') {
    playTone([720, 720, 720], 0.1, 0.55)
    return
  }
  playTone([520], 0.08, 0.35)
}

export function startDistressAlarm(severity: Alert['severity'] = 'high'): void {
  if (alarmTimer !== null) return

  const run = () => {
    if (severity === 'critical') {
      playTone([880, 660, 880], 0.18, 0.9)
      return
    }
    if (severity === 'high') {
      playTone([760, 760, 760], 0.12, 0.72)
      return
    }
    playTone([620, 520], 0.1, 0.5)
  }

  run()
  alarmTimer = window.setInterval(run, severity === 'critical' ? 1200 : 1900)
}

export function stopEmergencyAlarm(): void {
  if (alarmTimer === null) return
  window.clearInterval(alarmTimer)
  alarmTimer = null
}

export function playTestAlarm(): void {
  startDistressAlarm('critical')
  window.setTimeout(stopEmergencyAlarm, 1800)
}

function playTone(frequencies: number[], duration: number, intensity: number): void {
  const context = getAudioContext()
  if (!context || context.state !== 'running') return

  const volume = getEmergencyVolume()
  const start = context.currentTime

  frequencies.forEach((frequency, index) => {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const offset = index * (duration + 0.06)

    oscillator.type = frequency >= 800 ? 'sawtooth' : 'square'
    oscillator.frequency.setValueAtTime(frequency, start + offset)
    gain.gain.setValueAtTime(0.001, start + offset)
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.001, volume * intensity * 0.22),
      start + offset + 0.02
    )
    gain.gain.exponentialRampToValueAtTime(0.001, start + offset + duration)

    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start(start + offset)
    oscillator.stop(start + offset + duration + 0.04)
  })
}
