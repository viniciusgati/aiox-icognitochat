import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getAdminMessages, markAllMessagesRead, countUnreadMessages } from '@/lib/db'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))

  const messages = getAdminMessages(page)
  const unread = countUnreadMessages()

  return NextResponse.json({ messages, unread, page })
}

export async function PATCH() {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  markAllMessagesRead()
  return NextResponse.json({ ok: true })
}
