import { NextResponse } from 'next/server'

export async function GET() {
  const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:8000'

  try {
    const res = await fetch(`${backendUrl}/properties`, { cache: 'no-store' })
    const text = await res.text()

    try {
      return NextResponse.json(JSON.parse(text), { status: res.status })
    } catch {
      return NextResponse.json(
        {
          properties: [],
          error: 'invalid_backend_response',
          message: text || 'Backend returned an empty response.',
        },
        { status: 502 },
      )
    }
  } catch (error) {
    return NextResponse.json(
      {
        properties: [],
        error: 'backend_unreachable',
        message: error instanceof Error ? error.message : 'Unknown backend error',
      },
      { status: 503 },
    )
  }
}
