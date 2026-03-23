import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { sessionOptions, SessionData } from '@/lib/session'
import { insertAdminMessage, getSetting } from '@/lib/db'

// In-memory rate limiter: userId → array of timestamps (ms)
const rateLimitMap = new Map<number, number[]>()
const RATE_LIMIT_MAX = 3
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour

function isRateLimited(userId: number): boolean {
  const now = Date.now()
  const timestamps = (rateLimitMap.get(userId) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  )
  if (timestamps.length >= RATE_LIMIT_MAX) {
    rateLimitMap.set(userId, timestamps)
    return true
  }
  timestamps.push(now)
  rateLimitMap.set(userId, timestamps)
  return false
}

export async function POST(req: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  if (getSetting('allow_contact_admin') === '0') {
    return NextResponse.json({ error: 'Contato com o admin desabilitado' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const message = (body as Record<string, unknown>)?.message
  if (typeof message !== 'string' || message.trim().length === 0) {
    return NextResponse.json({ error: 'Mensagem não pode ser vazia' }, { status: 400 })
  }
  if (message.length > 500) {
    return NextResponse.json({ error: 'Mensagem muito longa (máx. 500 caracteres)' }, { status: 400 })
  }

  if (isRateLimited(session.userId)) {
    return NextResponse.json(
      { error: 'Limite atingido. Aguarde antes de enviar outra mensagem.' },
      { status: 429 }
    )
  }

  const id = insertAdminMessage(session.userId, message.trim())

  // Notify admin via Socket.IO if available
  const io = (global as any).io
  if (io) {
    const preview = message.trim().slice(0, 80)
    io.to('admin').emit('admin:new-message', {
      id,
      username: session.username,
      preview,
      created_at: Math.floor(Date.now() / 1000),
    })
  }

  // Send push notification to admin users if push is configured
  try {
    const { default: db } = await import('@/lib/db')
    const { sendPushNotification } = await import('@/lib/push')
    const adminSubs = db
      .prepare(
        `SELECT ps.endpoint, ps.p256dh, ps.auth
         FROM push_subscriptions ps
         JOIN users u ON u.id = ps.user_id
         WHERE u.is_admin = 1`
      )
      .all() as { endpoint: string; p256dh: string; auth: string }[]

    for (const sub of adminSubs) {
      sendPushNotification(sub, {
        title: 'IcognitoChat',
        body: `📩 Nova mensagem de ${session.username}`,
      }).catch(() => {/* best-effort */})
    }
  } catch {
    // Push is optional — ignore failures
  }

  return NextResponse.json({ id, created_at: Math.floor(Date.now() / 1000) }, { status: 201 })
}
