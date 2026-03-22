import { NextRequest, NextResponse } from 'next/server'
import { getSetting, setSetting } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'

const ALLOWED_KEYS = new Set(['allow_room_creation', 'admin_only_chat'])

export async function GET() {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  return NextResponse.json({
    allow_room_creation: getSetting('allow_room_creation') ?? '1',
    admin_only_chat: getSetting('admin_only_chat') ?? '0',
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const body = await req.json()

  for (const [key, value] of Object.entries(body)) {
    if (!ALLOWED_KEYS.has(key)) continue
    if (value !== '0' && value !== '1') continue
    setSetting(key, value as string)
  }

  return NextResponse.json({ ok: true })
}
