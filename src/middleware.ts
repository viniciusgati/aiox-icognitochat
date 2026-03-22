import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { sessionOptions, SessionData } from '@/lib/session'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const session = await getIronSession<SessionData>(req, res, sessionOptions)

  if (!session.isLoggedIn) {
    const callbackUrl = encodeURIComponent(req.nextUrl.pathname)
    return NextResponse.redirect(new URL(`/?callbackUrl=${callbackUrl}`, req.url))
  }

  return res
}

export const config = {
  matcher: ['/chat/:path*'],
}
