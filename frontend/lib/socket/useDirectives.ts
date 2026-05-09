'use client'

import { useEffect, useState } from 'react'
import { Directive, DistressResult } from '@/lib/types'
import { getSocket } from './socketClient'

type DistressParsedEvent =
  | DistressResult
  | {
      shipId: string
      raw: string
      parsed: DistressResult
      alert?: unknown
      parsedAt: number
    }

export function useDirectives(shipId?: string, command = false) {
  const [directives, setDirectives] = useState<Directive[]>([])
  const [distressResults, setDistressResults] = useState<DistressResult[]>([])

  useEffect(() => {
    const socket = getSocket()
    if (command) socket.emit('join_command_room', {})
    if (shipId) socket.emit('join_ship_room', { shipId })

    const handleDirective = (directive: Directive) => {
      setDirectives((current) => [directive, ...current.filter((item) => item.id !== directive.id)])
    }
    const handleDistress = (result: DistressParsedEvent) => {
      const normalized = 'parsed' in result
        ? {
            ...result.parsed,
            shipId: result.shipId,
            raw: result.raw,
            parsedAt: result.parsedAt,
          }
        : result
      setDistressResults((current) => [normalized, ...current])
    }

    socket.on('directive_received', handleDirective)
    socket.on('distress_parsed', handleDistress)

    return () => {
      socket.off('directive_received', handleDirective)
      socket.off('distress_parsed', handleDistress)
    }
  }, [shipId, command])

  const sendDirective = (directive: Omit<Directive, 'id' | 'fromCommand' | 'sentAt'>) => {
    getSocket().emit('send_directive', directive)
  }

  const respondToDirective = (
    directive: Directive,
    response: 'ACCEPT' | 'ESCALATE_DISTRESS',
    distressMessage?: string
  ) => {
    getSocket().emit('directive_response', {
      directiveId: directive.id,
      shipId: directive.shipId,
      response,
      distressMessage,
      directive: { type: directive.type, payload: directive.payload },
    })
    setDirectives((current) => current.filter((item) => item.id !== directive.id))
  }

  const escalateDistress = (shipIdValue: string, distressMessage: string) => {
    getSocket().emit('directive_response', {
      directiveId: `manual:${Date.now()}`,
      shipId: shipIdValue,
      response: 'ESCALATE_DISTRESS',
      distressMessage,
    })
  }

  return { directives, distressResults, sendDirective, respondToDirective, escalateDistress }
}
