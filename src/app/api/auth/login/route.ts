import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import db from '@/lib/db'
import { sessionOptions, SessionData } from '@/lib/session'
import { RateLimiter } from '@/lib/rate-limit'

const LOGIN_LIMIT = 5
const LOGIN_WINDOW_MS = 60_000

const loginLimiter = new RateLimiter()
setInterval(() => loginLimiter.cleanup(LOGIN_WINDOW_MS), LOGIN_WINDOW_MS * 2)

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '127.0.0.1'
}

export async function POST(req: NextRequest) {
  const ip = getIp(req)
  const { allowed, retryAfter } = loginLimiter.check(ip, LOGIN_LIMIT, LOGIN_WINDOW_MS)

  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many attempts', retryAfter },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }

  try {
    const { username, password } = await req.json()

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Usuário e senha são obrigatórios' },
        { status: 400 }
      )
    }

    const user = db
      .prepare('SELECT id, username, password_hash FROM users WHERE username = ?')
      .get(username) as { id: number; username: string; password_hash: string } | undefined

    if (!user) {
      loginLimiter.recordFailure(ip)
      return NextResponse.json(
        { error: 'Credenciais inválidas' },
        { status: 401 }
      )
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash)
    if (!passwordMatch) {
      loginLimiter.recordFailure(ip)
      return NextResponse.json(
        { error: 'Credenciais inválidas' },
        { status: 401 }
      )
    }

    loginLimiter.onSuccess(ip)

    // Atualiza last_seen_at
    db.prepare('UPDATE users SET last_seen_at = unixepoch() WHERE id = ?').run(user.id)

    const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
    session.userId = user.id
    session.username = user.username
    session.isLoggedIn = true
    session.lastSeenAt = Date.now()
    await session.save()

    return NextResponse.json({ ok: true, username: user.username })
  } catch {
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
