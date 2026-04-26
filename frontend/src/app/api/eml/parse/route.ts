import type { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:8000'
  const path = req.nextUrl.searchParams.get('path') ?? ''

  if (!path) {
    return new Response('Missing path parameter', { status: 400 })
  }

  const res = await fetch(`${backendUrl}/eml/parse?path=${encodeURIComponent(path)}`)

  return new Response(await res.arrayBuffer(), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  })
}
