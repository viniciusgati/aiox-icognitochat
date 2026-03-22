import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'

interface Props {
  params: Promise<{ id: string }>
}

export async function DELETE(req: NextRequest, { params }: Props) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { id: idStr } = await params
  const id = parseInt(idStr, 10)
  if (isNaN(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  // Cannot delete yourself
  if (id === auth.userId) {
    return NextResponse.json({ error: 'Não é possível remover o próprio usuário admin' }, { status: 400 })
  }

  const user = db
    .prepare('SELECT id, username FROM users WHERE id = ?')
    .get(id) as { id: number; username: string } | undefined

  if (!user) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  }

  db.prepare('DELETE FROM messages WHERE user_id = ?').run(id)
  db.prepare('DELETE FROM users WHERE id = ?').run(id)

  // Desconectar via Socket.io se o usuário estiver online
  const userSockets = (global as any).userSockets as Map<string, Set<string>> | undefined
  const io = global.io
  if (io && userSockets) {
    const socketIds = userSockets.get(user.username)
    if (socketIds) {
      socketIds.forEach((socketId) => {
        io.to(socketId).emit('force-logout')
      })
    }
  }

  return NextResponse.json({ ok: true })
}
