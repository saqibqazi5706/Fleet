import axios from 'axios'
import { DistressParseResult, Severity } from '../types'

type DistressDamage = DistressParseResult['damageEstimate']
type ParsedDistress = Omit<DistressParseResult, 'shipId' | 'raw' | 'parsedAt'>

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash'
const GEMINI_TIMEOUT_MS = 8000

export async function parseDistressMessage(message: string): Promise<ParsedDistress> {
  const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase()
  const apiKey = process.env.GEMINI_API_KEY

  if (provider === 'gemini' && apiKey && !apiKey.includes('xxxxx')) {
    try {
      return await parseWithGemini(message, apiKey)
    } catch (error) {
      console.warn('Gemini distress parsing failed; using fallback parser')
    }
  }

  return fallbackParse(message)
}

export async function parseDistress(shipId: string, raw: string): Promise<DistressParseResult> {
  const parsed = await parseDistressMessage(raw)

  return {
    shipId,
    raw,
    ...parsed,
    parsedAt: Date.now(),
  }
}

async function parseWithGemini(message: string, apiKey: string): Promise<ParsedDistress> {
  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      contents: [
        {
          role: 'user',
          parts: [{ text: buildPrompt(message) }],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 400,
        responseMimeType: 'application/json',
      },
    },
    {
      params: { key: apiKey },
      timeout: GEMINI_TIMEOUT_MS,
      headers: { 'content-type': 'application/json' },
    }
  )

  const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini returned empty distress response')

  return normalizeParsed(JSON.parse(stripJsonFence(text)))
}

function buildPrompt(message: string): string {
  return `You are an operations AI for a maritime crisis command system.
Extract structured operational data from the captain distress message.
Respond ONLY with valid JSON. No markdown. No explanation.
Required JSON fields:
{
  "severity": "low | medium | high | critical",
  "issueType": "string",
  "injuries": number,
  "damageEstimate": "none | minor | moderate | major | total_loss | unknown",
  "impact": "string",
  "recommendedAction": "string"
}
Rules:
- If injuries are not mentioned, injuries must be 0.
- If damage is unclear, damageEstimate must be "unknown".
- Severity should reflect operational urgency.
- Use critical for fire, sinking, attack, collision with injuries, or loss of propulsion in danger zone.
- Use high for serious engine/fuel/weather damage without confirmed casualties.
- Use medium for non-immediate operational issues.
- Use low for minor issues.

Message:
${message}`
}

function fallbackParse(message: string): ParsedDistress {
  const lower = message.toLowerCase()
  const issueType = detectIssueType(lower)
  const injuries = extractInjuryCount(lower)
  const damageEstimate = estimateDamage(lower, issueType)
  const severity = estimateSeverity(lower, issueType, injuries)

  return {
    severity,
    issueType,
    injuries,
    damageEstimate,
    impact: buildImpact(issueType, injuries, damageEstimate),
    recommendedAction: buildRecommendedAction(severity, issueType),
  }
}

function detectIssueType(lower: string): string {
  if (lower.includes('attack') || lower.includes('pirate') || lower.includes('missile') || lower.includes('naval')) {
    return 'security_threat'
  }
  if (lower.includes('collision') || lower.includes(' collided') || lower.includes(' hit ')) {
    return 'collision'
  }
  if (lower.includes('fire')) return 'fire'
  if (lower.includes('engine') || lower.includes('propulsion')) return 'engine_failure'
  if (lower.includes('fuel leak') || lower.includes('leak') || lower.includes('taking on water') || lower.includes('flood')) {
    return 'leak_or_flooding'
  }
  if (lower.includes('medical')) return 'medical_emergency'
  if (lower.includes('low fuel') || lower.includes('fuel emergency') || lower.includes('fuel')) return 'fuel_emergency'
  if (lower.includes('weather') || lower.includes('storm') || lower.includes('wave')) return 'weather_damage'
  return 'unknown'
}

function extractInjuryCount(lower: string): number {
  const explicit = lower.match(/(\d+)\s+(crew|people|personnel|sailors|injured|injuries|wounded|hurt)/)
  if (explicit) return Number(explicit[1])

  const laterNumber = lower.match(/(injured|injuries|wounded|crew hurt|hurt)\D{0,12}(\d+)/)
  if (laterNumber) return Number(laterNumber[2])

  return lower.includes('injur') || lower.includes('wounded') || lower.includes('crew hurt') ? 1 : 0
}

function estimateDamage(lower: string, issueType: string): DistressDamage {
  if (lower.includes('sinking') || lower.includes('abandon') || lower.includes('total loss')) return 'total_loss'
  if (lower.includes('major') || lower.includes('severe') || issueType === 'fire' || issueType === 'leak_or_flooding') return 'major'
  if (lower.includes('moderate') || issueType === 'engine_failure' || issueType === 'collision') return 'moderate'
  if (lower.includes('minor')) return 'minor'
  if (lower.includes('no damage') || lower.includes('none')) return 'none'
  return 'unknown'
}

function estimateSeverity(lower: string, issueType: string, injuries: number): Severity {
  if (
    issueType === 'fire' ||
    issueType === 'security_threat' ||
    lower.includes('sinking') ||
    lower.includes('taking on water') ||
    (issueType === 'collision' && injuries > 0)
  ) {
    return 'critical'
  }

  if (
    issueType === 'engine_failure' ||
    issueType === 'fuel_emergency' ||
    issueType === 'leak_or_flooding' ||
    issueType === 'medical_emergency' ||
    injuries > 0
  ) {
    return 'high'
  }

  if (issueType === 'unknown') return 'medium'
  return 'medium'
}

function buildImpact(issueType: string, injuries: number, damageEstimate: DistressDamage): string {
  const injuryImpact = injuries > 0 ? `${injuries} injured; ` : ''

  switch (issueType) {
    case 'fire':
      return `${injuryImpact}fire threatens vessel safety, propulsion, and cargo integrity.`
    case 'engine_failure':
      return `${injuryImpact}loss of propulsion may prevent safe navigation through the chokepoint.`
    case 'leak_or_flooding':
      return `${injuryImpact}leak or flooding may affect stability and fuel safety.`
    case 'security_threat':
      return `${injuryImpact}security threat may require immediate reroute and external support.`
    case 'collision':
      return `${injuryImpact}collision may reduce maneuverability and structural integrity.`
    case 'medical_emergency':
      return `${injuryImpact}medical situation requires prioritization and possible evacuation.`
    case 'fuel_emergency':
      return `fuel emergency may prevent reaching destination without assistance.`
    default:
      return `${injuryImpact}operational impact is unclear; damage estimate is ${damageEstimate}.`
  }
}

function buildRecommendedAction(severity: Severity, issueType: string): string {
  if (severity === 'critical') {
    return 'Prioritize emergency response, notify Command, reroute nearby support, and prepare evacuation or assistance.'
  }

  if (issueType === 'engine_failure') {
    return 'Reduce speed if possible, hold safe heading, and await reroute or assistance directive.'
  }

  if (issueType === 'fuel_emergency') {
    return 'Calculate nearest safe port, reduce fuel burn, and request Command reroute.'
  }

  if (severity === 'high') {
    return 'Maintain continuous reporting, prepare support response, and await Command directive.'
  }

  return 'Monitor condition, continue reporting, and await Command review.'
}

function normalizeParsed(value: Record<string, unknown>): ParsedDistress {
  return {
    severity: normalizeSeverity(value.severity),
    issueType: String(value.issueType || 'unknown'),
    injuries: normalizeNumber(value.injuries),
    damageEstimate: normalizeDamage(value.damageEstimate),
    impact: String(value.impact || 'Operational impact unknown.'),
    recommendedAction: String(value.recommendedAction || 'Command review required.'),
  }
}

function normalizeSeverity(value: unknown): Severity {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'critical'
    ? value
    : 'medium'
}

function normalizeDamage(value: unknown): DistressDamage {
  return value === 'none' ||
    value === 'minor' ||
    value === 'moderate' ||
    value === 'major' ||
    value === 'total_loss' ||
    value === 'unknown'
    ? value
    : 'unknown'
}

function normalizeNumber(value: unknown): number {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) && numberValue >= 0 ? Math.floor(numberValue) : 0
}

function stripJsonFence(text: string): string {
  return text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
}
