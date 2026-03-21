import { SessionOptions } from 'iron-session'

export interface SessionData {
  userId?: number
  username?: string
  isLoggedIn: boolean
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET as string,
  cookieName: 'icognitochat-session',
  cookieOptions: {
    // secure: true em produção (HTTPS), false em dev
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 dias
  },
}

// Augmentar o tipo global do iron-session
declare module 'iron-session' {
  interface IronSessionData extends SessionData {}
}
