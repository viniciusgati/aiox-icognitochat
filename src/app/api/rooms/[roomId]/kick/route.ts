export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { sessionOptions, SessionData } from '@/lib/session'
import db from '@/lib/db'
import logger from '@/lib/logger'

interface Params {
  params: Promise<{ roomId: string }>
}

/**
 * POST /api/rooms/[roomId]/kick
 * Self-kick: the authenticated user removes themselves from the room.
 * If the room is ephemeral, all messages in that room are deleted from DB.
 * Emits Socket.IO events to notify other participants.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  if (!session.isLoggedIn || !session.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { roomId } = await params
  const body = await req.json().catch(() => ({}))
  const reason: string = body.reason ?? 'screen-sharing'

  const room = db
    .prepare('SELECT id, is_ephemeral FROM rooms WHERE slug = ?')
    .get(roomId) as { id: number; is_ephemeral: number } | undefined

  if (!room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  }

  // If ephemeral, delete all messages in the room
  let deletedMessages = 0
  if (room.is_ephemeral === 1) {
    const result = db
      .prepare('DELETE FROM messages WHERE room_id = ?')
      .run(room.id)
    deletedMessages = result.changes
    logger.info({ roomId, deletedMessages }, 'Deleted messages for ephemeral room on screen-share kick')
  }

  // Emit via Socket.IO to notify room and terminate kicked user's session
  const io = (global as any).io
  const userSockets = (global as any).userSockets as Map<string, Set<string>> | undefined

  if (io) {
    // Notify other participants
    io.to(roomId).emit('user:kicked-screen-share', {
      username: session.username,
      reason,
    })

    // Terminate session for all sockets of this user
    const socketIds = userSockets?.get(session.username)
    if (socketIds) {
      socketIds.forEach((socketId) => {
        io.to(socketId).emit('session:terminated', { reason })
      })
    }
  }

  logger.info({ roomId, username: session.username, reason, deletedMessages }, 'User self-kicked')

  return NextResponse.json({ ok: true, deletedMessages })
}
