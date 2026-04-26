import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:8000'
  const body = await req.json()

  const res = await fetch(`${backendUrl}/ask/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  return new Response(res.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}
