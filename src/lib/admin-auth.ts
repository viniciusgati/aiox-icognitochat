import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { sessionOptions, SessionData } from './session'

/**
 * Verifica que o request tem sessão de admin ativa.
 * Retorna a session se autorizado, ou um NextResponse 403 para retornar imediatamente.
 */
export async function requireAdmin(): Promise<SessionData | NextResponse> {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }
  return session
}
