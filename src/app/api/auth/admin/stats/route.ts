import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import db, { IMAGES_DIR } from '@/lib/db'
import { RateLimiter } from '@/lib/rate-limit'

const ADMIN_LIMIT = 10
const ADMIN_WINDOW_MS = 60_000
const statsLimiter = new RateLimiter()
setInterval(() => statsLimiter.cleanup(ADMIN_WINDOW_MS), ADMIN_WINDOW_MS * 2)

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '127.0.0.1'
}

export async function GET(req: NextRequest) {
  const ip = getIp(req)
  const { allowed, retryAfter } = statsLimiter.check(ip, ADMIN_LIMIT, ADMIN_WINDOW_MS)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests', retryAfter }, { status: 429 })
  }

  const masterPassword = req.headers.get('x-master-password')
  if (!masterPassword || masterPassword !== process.env.MASTER_PASSWORD) {
    statsLimiter.recordFailure(ip)
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const totalUsers = (db.prepare('SELECT COUNT(*) as n FROM users').get() as { n: number }).n
  const totalRooms = (db.prepare('SELECT COUNT(*) as n FROM rooms').get() as { n: number }).n
  const ephemeralRooms = (
    db.prepare('SELECT COUNT(*) as n FROM rooms WHERE is_ephemeral = 1').get() as { n: number }
  ).n
  const totalImages = (db.prepare('SELECT COUNT(*) as n FROM room_images').get() as { n: number }).n

  const io = (global as unknown as { io?: { engine?: { clientsCount?: number } } }).io
  const connectedSockets = io?.engine?.clientsCount ?? 0

  const userSockets = (global as unknown as { userSockets?: Map<string, unknown> }).userSockets
  const onlineUsers = userSockets?.size ?? 0

  let dbSizeBytes = 0
  try {
    const dbPath = process.env.DB_PATH ?? `${process.cwd()}/data/icognitochat.db`
    dbSizeBytes = fs.statSync(dbPath).size
  } catch { /* ignore */ }

  let imagesDirBytes = 0
  try {
    const files = fs.readdirSync(IMAGES_DIR)
    for (const f of files) {
      try { imagesDirBytes += fs.statSync(`${IMAGES_DIR}/${f}`).size } catch { /* ignore */ }
    }
  } catch { /* ignore */ }

  return NextResponse.json({
    totalUsers,
    totalRooms,
    permanentRooms: totalRooms - ephemeralRooms,
    ephemeralRooms,
    totalImages,
    connectedSockets,
    onlineUsers,
    uptime: Math.floor(process.uptime()),
    dbSizeBytes,
    imagesDirBytes,
  })
}
