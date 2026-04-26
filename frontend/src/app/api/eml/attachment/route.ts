import type { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:8000'
  const path = req.nextUrl.searchParams.get('path') ?? ''
  const index = req.nextUrl.searchParams.get('index') ?? ''

  if (!path || index === '') {
    return new Response('Missing path or index parameter', { status: 400 })
  }

  const url = `${backendUrl}/eml/attachment?path=${encodeURIComponent(path)}&index=${encodeURIComponent(index)}`
  const res = await fetch(url)

  if (!res.ok) {
    return new Response('Attachment not found', { status: res.status })
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
