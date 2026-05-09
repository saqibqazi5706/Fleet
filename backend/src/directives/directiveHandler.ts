import { Directive } from '../types'

export function createDirective(input: Omit<Directive, 'id' | 'fromCommand' | 'sentAt'>): Directive {
  return {
    id: `directive:${input.shipId}:${Date.now()}`,
    fromCommand: true,
    sentAt: Date.now(),
    ...input,
  }
}
