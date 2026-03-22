import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import db from '@/lib/db'
import { sendPushNotification, PushSubscriptionData } from '@/lib/push'

// Simple in-memory rate limit: max 10 sends per minute
const RATE_WINDOW_MS = 60_000
const RATE_LIMIT = 10
const sendLog: number[] = []

interface SubscriptionRow {
  username: string
  endpoint: string
  p256dh: string
  auth: string
}

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  // Rate limit
  const now = Date.now()
  while (sendLog.length > 0 && now - sendLog[0] > RATE_WINDOW_MS) sendLog.shift()
  if (sendLog.length >= RATE_LIMIT) {
    return NextResponse.json({ error: 'Rate limit excedido. Aguarde 1 minuto.' }, { status: 429 })
  }
  sendLog.push(now)

  let body: { userIds?: number[] | 'all'; message: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { userIds, message } = body
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return NextResponse.json({ error: 'message é obrigatório' }, { status: 400 })
  }

  let rows: SubscriptionRow[]
  if (userIds === 'all') {
    rows = db
      .prepare(`
        SELECT u.username, ps.endpoint, ps.p256dh, ps.auth
        FROM push_subscriptions ps
        JOIN users u ON u.id = ps.user_id
      `)
      .all() as SubscriptionRow[]
  } else if (Array.isArray(userIds) && userIds.length > 0) {
    const placeholders = userIds.map(() => '?').join(',')
    rows = db
      .prepare(`
        SELECT u.username, ps.endpoint, ps.p256dh, ps.auth
        FROM push_subscriptions ps
        JOIN users u ON u.id = ps.user_id
        WHERE ps.user_id IN (${placeholders})
      `)
      .all(...userIds) as SubscriptionRow[]
  } else {
    return NextResponse.json({ error: 'userIds deve ser "all" ou array de ids' }, { status: 400 })
  }

  if (rows.length === 0) {
    return NextResponse.json({ sent: 0, results: [] })
  }

  const results = await Promise.all(
    rows.map(async (row) => {
      const personalizedMessage = message.replace(/\{nome\}/gi, row.username)
      const sub: PushSubscriptionData = {
        endpoint: row.endpoint,
        p256dh: row.p256dh,
        auth: row.auth,
      }
      const result = await sendPushNotification(sub, {
        title: 'IcognitoChat',
        body: personalizedMessage,
        icon: '/icon-192.png',
      })

      // Remove invalid subscriptions (endpoint gone)
      if (!result.ok && result.error?.includes('410')) {
        db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(row.endpoint)
      }

      return { username: row.username, ok: result.ok, error: result.error }
    })
  )

  const sent = results.filter((r) => r.ok).length
  return NextResponse.json({ sent, results })
}
