import { NextRequest, NextResponse } from 'next/server'
import db, { deleteRoom } from '@/lib/db'
import { RateLimiter } from '@/lib/rate-limit'

const ADMIN_LIMIT = 10
const ADMIN_WINDOW_MS = 60_000
const limiter = new RateLimiter()
setInterval(() => limiter.cleanup(ADMIN_WINDOW_MS), ADMIN_WINDOW_MS * 2)

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '127.0.0.1'
}

interface Props {
  params: Promise<{ slug: string }>
}

export async function DELETE(req: NextRequest, { params }: Props) {
  const ip = getIp(req)
  const { allowed, retryAfter } = limiter.check(ip, ADMIN_LIMIT, ADMIN_WINDOW_MS)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests', retryAfter }, { status: 429 })
  }

  const masterPassword = req.headers.get('x-master-password')
  if (!masterPassword || masterPassword !== process.env.MASTER_PASSWORD) {
    limiter.recordFailure(ip)
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { slug } = await params

  const room = db.prepare('SELECT slug FROM rooms WHERE slug = ?').get(slug) as { slug: string } | undefined
  if (!room) {
    return NextResponse.json({ error: 'Sala não encontrada' }, { status: 404 })
  }

  // Notify connected users in this room before deletion
  const io = (global as unknown as { io?: { to: (r: string) => { emit: (e: string) => void } } }).io
  io?.to(slug).emit('room-closed')

  deleteRoom(slug)

  return NextResponse.json({ deleted: slug })
}
