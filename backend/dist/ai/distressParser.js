"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDistress = parseDistress;
const axios_1 = __importDefault(require("axios"));
async function parseDistress(shipId, raw) {
    const parsed = await parseWithClaude(raw).catch(() => fallbackParse(raw));
    return {
        shipId,
        raw,
        ...parsed,
        parsedAt: Date.now(),
    };
}
async function parseWithClaude(message) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey.includes('xxxxx'))
        throw new Error('Missing Anthropic key');
    const prompt = `You are an operations AI for a maritime crisis system.
Extract structured data from this distress message.
Respond ONLY with valid JSON, no other text.
Fields: severity (low/medium/high/critical), issueType (string), injuries (number, 0 if unknown), damageEstimate (none/minor/moderate/major/total_loss), impact (string), recommendedAction (string)

Message: ${message}`;
    const response = await axios_1.default.post('https://api.anthropic.com/v1/messages', {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
    }, {
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
        },
        timeout: 8000,
    });
    const text = response.data?.content?.[0]?.text;
    if (!text)
        throw new Error('Empty Claude response');
    return normalizeParsed(JSON.parse(text));
}
function fallbackParse(message) {
    const lower = message.toLowerCase();
    const hasFire = lower.includes('fire');
    const hasInjury = lower.includes('injur') || lower.includes('wound') || lower.includes('crew hurt');
    const hasEngine = lower.includes('engine');
    const hasFlood = lower.includes('water') || lower.includes('flood') || lower.includes('taking on');
    const injuries = Number(lower.match(/(\d+)\s+(crew|people|injur|wound)/)?.[1] || (hasInjury ? 1 : 0));
    return {
        severity: hasFire || hasFlood ? 'critical' : hasEngine || hasInjury ? 'high' : 'medium',
        issueType: hasFire ? 'fire' : hasEngine ? 'engine_failure' : hasFlood ? 'flooding' : 'unknown',
        injuries,
        damageEstimate: hasFire || hasFlood ? 'major' : hasEngine ? 'moderate' : 'minor',
        impact: hasFire
            ? 'Fire threatens vessel safety and route continuity.'
            : hasFlood
                ? 'Flooding may compromise stability and propulsion.'
                : 'Operational risk requires command review.',
        recommendedAction: hasFire || hasFlood
            ? 'Dispatch emergency support, reroute nearby vessels, and prioritize evacuation readiness.'
            : 'Maintain contact, reduce speed if needed, and await command directive.',
    };
}
function normalizeParsed(value) {
    return {
        severity: normalizeSeverity(value.severity),
        issueType: String(value.issueType || 'unknown'),
        injuries: Number(value.injuries || 0),
        damageEstimate: normalizeDamage(value.damageEstimate),
        impact: String(value.impact || 'Operational impact unknown.'),
        recommendedAction: String(value.recommendedAction || 'Command review required.'),
    };
}
function normalizeSeverity(value) {
    return value === 'low' || value === 'medium' || value === 'high' || value === 'critical'
        ? value
        : 'medium';
}
function normalizeDamage(value) {
    return value === 'none' || value === 'minor' || value === 'moderate' || value === 'major' || value === 'total_loss'
        ? value
        : 'moderate';
}
