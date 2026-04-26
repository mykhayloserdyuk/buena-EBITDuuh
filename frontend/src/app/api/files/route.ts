import type { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:8000'
  const path = req.nextUrl.searchParams.get('path') ?? ''
  const preview = req.nextUrl.searchParams.get('preview') === 'true'

  if (!path) {
    return new Response('Missing path parameter', { status: 400 })
  }

  const url = `${backendUrl}/files/${path}${preview ? '?preview=true' : ''}`
  const res = await fetch(url)

  if (!res.ok) {
    return new Response('File not found', { status: res.status })
  }

  const body = await res.arrayBuffer()
  return new Response(body, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('content-type') ?? 'application/octet-stream',
      'Content-Disposition': res.headers.get('content-disposition') ?? '',
    },
  })
}
