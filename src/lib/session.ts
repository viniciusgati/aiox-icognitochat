import { SessionOptions } from 'iron-session'

export interface SessionData {
  userId?: number
  username?: string
  isLoggedIn: boolean
  isAdmin?: boolean
  lastSeenAt?: number // timestamp ms — usado para verificar inatividade no middleware
}

const SESSION_TTL_DAYS = parseInt(process.env.SESSION_TTL_DAYS ?? '7', 10)
const SESSION_TTL_SECONDS = SESSION_TTL_DAYS * 24 * 60 * 60

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET as string,
  cookieName: 'icognitochat-session',
  ttl: SESSION_TTL_SECONDS,
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: SESSION_TTL_SECONDS,
  },
}

// Augmentar o tipo global do iron-session
declare module 'iron-session' {
  interface IronSessionData extends SessionData {}
}
