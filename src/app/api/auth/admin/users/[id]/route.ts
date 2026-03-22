import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const masterPassword = req.headers.get('x-master-password')
  if (!masterPassword || masterPassword !== process.env.MASTER_PASSWORD) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const id = parseInt(params.id, 10)
  if (isNaN(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const user = db
    .prepare('SELECT id, username FROM users WHERE id = ?')
    .get(id) as { id: number; username: string } | undefined

  if (!user) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  }

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
