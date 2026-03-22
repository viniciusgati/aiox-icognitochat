import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { sessionOptions, SessionData } from '@/lib/session'

const INACTIVE_MS =
  parseInt(process.env.SESSION_INACTIVE_HOURS ?? '24', 10) * 60 * 60 * 1000

// Throttle: atualizar lastSeenAt no máximo 1x por minuto
const THROTTLE_MS = 60_000

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const session = await getIronSession<SessionData>(req, res, sessionOptions)

  if (!session.isLoggedIn) {
    const callbackUrl = encodeURIComponent(req.nextUrl.pathname)
    return NextResponse.redirect(new URL(`/?callbackUrl=${callbackUrl}`, req.url))
  }

  const now = Date.now()
  const lastSeen = session.lastSeenAt ?? now

  // Sessão inativa além do threshold → expirar
  if (now - lastSeen > INACTIVE_MS) {
    await session.destroy()
    const callbackUrl = encodeURIComponent(req.nextUrl.pathname)
    return NextResponse.redirect(new URL(`/?expired=1&callbackUrl=${callbackUrl}`, req.url))
  }

  // Atualizar lastSeenAt com throttle (máx 1x por minuto)
  if (now - lastSeen > THROTTLE_MS) {
    session.lastSeenAt = now
    await session.save()
  }

  return res
}

export const config = {
  matcher: ['/chat/:path*'],
}
