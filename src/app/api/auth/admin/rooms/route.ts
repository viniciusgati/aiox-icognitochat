import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { RateLimiter } from '@/lib/rate-limit'

const ADMIN_LIMIT = 10
const ADMIN_WINDOW_MS = 60_000
const limiter = new RateLimiter()
setInterval(() => limiter.cleanup(ADMIN_WINDOW_MS), ADMIN_WINDOW_MS * 2)

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '127.0.0.1'
}

export async function GET(req: NextRequest) {
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

  const rooms = db
    .prepare(
      `SELECT r.id, r.slug, r.name, r.is_ephemeral, r.created_at,
              r.message_ttl_seconds,
              COUNT(ri.id) as image_count
       FROM rooms r
       LEFT JOIN room_images ri ON ri.room_id = r.id
       GROUP BY r.id
       ORDER BY r.is_ephemeral ASC, r.created_at DESC`
    )
    .all()

  return NextResponse.json({ rooms })
}
