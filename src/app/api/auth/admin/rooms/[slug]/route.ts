import { NextRequest, NextResponse } from 'next/server'
import db, { deleteRoom } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'

interface Props {
  params: Promise<{ slug: string }>
}

export async function DELETE(req: NextRequest, { params }: Props) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { slug } = await params

  const room = db.prepare('SELECT slug FROM rooms WHERE slug = ?').get(slug) as { slug: string } | undefined
  if (!room) {
    return NextResponse.json({ error: 'Sala não encontrada' }, { status: 404 })
  }

  // Notify connected users in this room before deletion
  const io = (global as unknown as { io?: { to: (r: string) => { emit: (e: string) => void } } }).io
  io?.to(slug).emit('room-closed')

  deleteRoom(slug)

  return NextResponse.json({ deleted: slug })
}
