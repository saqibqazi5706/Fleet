import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'

  return NextResponse.json({
    proxied: true,
    backendUrl,
    shipId: body.shipId,
    message: body.message,
    note: 'Distress parsing is handled live over Socket.IO via directive_response.',
  })
}
