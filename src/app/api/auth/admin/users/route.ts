import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import db from '@/lib/db'
import { generateCredentials } from '@/lib/generate-credentials'
import { RateLimiter } from '@/lib/rate-limit'

const BCRYPT_ROUNDS = 10
const ADMIN_LIMIT = 3
const ADMIN_WINDOW_MS = 60_000

const adminLimiter = new RateLimiter()
setInterval(() => adminLimiter.cleanup(ADMIN_WINDOW_MS), ADMIN_WINDOW_MS * 2)

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '127.0.0.1'
}

export async function GET(req: NextRequest) {
  const ip = getIp(req)
  const { allowed, retryAfter } = adminLimiter.check(ip, ADMIN_LIMIT, ADMIN_WINDOW_MS)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many attempts', retryAfter },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }

  const masterPassword = req.headers.get('x-master-password')
  if (!masterPassword || masterPassword !== process.env.MASTER_PASSWORD) {
    adminLimiter.recordFailure(ip)
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const users = db
    .prepare(
      'SELECT id, username, created_at, last_seen_at FROM users ORDER BY last_seen_at DESC NULLS LAST, created_at DESC'
    )
    .all() as { id: number; username: string; created_at: number; last_seen_at: number | null }[]

  return NextResponse.json({ users })
}

export async function POST(req: NextRequest) {
  const ip = getIp(req)
  const { allowed, retryAfter } = adminLimiter.check(ip, ADMIN_LIMIT, ADMIN_WINDOW_MS)

  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many attempts', retryAfter },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }

  const masterPassword = req.headers.get('x-master-password')

  if (!masterPassword || masterPassword !== process.env.MASTER_PASSWORD) {
    adminLimiter.recordFailure(ip)
    return NextResponse.json(
      { error: 'Não autorizado' },
      { status: 401 }
    )
  }

  try {
    const { username, password } = generateCredentials()
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)

    db.prepare(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)'
    ).run(username, passwordHash)

    // Retorna credenciais em plaintext — única vez que são exibidas
    return NextResponse.json({ username, password }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    return NextResponse.json(
      { error: `Falha ao criar usuário: ${message}` },
      { status: 500 }
    )
  }
}
