import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'

export async function GET() {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const rooms = db
    .prepare(
      `SELECT r.id, r.slug, r.name, r.is_ephemeral, r.created_at,
              r.message_ttl_seconds,
              COUNT(ri.id) as image_count
       FROM rooms r
       LEFT JOIN room_images ri ON ri.room_id = r.id
       GROUP BY r.id
       ORDER BY r.is_ephemeral ASC, r.created_at DESC`
    )
    .all()

  return NextResponse.json({ rooms })
}
