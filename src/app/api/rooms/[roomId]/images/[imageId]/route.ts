import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { readFile } from 'fs/promises'
import path from 'path'
import db, { IMAGES_DIR } from '@/lib/db'
import { sessionOptions, SessionData } from '@/lib/session'

interface Props {
  params: Promise<{ roomId: string; imageId: string }>
}

export async function GET(req: NextRequest, { params }: Props) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { roomId, imageId } = await params

  // Verify image belongs to the requested room (prevents cross-room access)
  const record = db
    .prepare(
      `SELECT ri.id FROM room_images ri
       JOIN rooms r ON r.id = ri.room_id
       WHERE r.slug = ? AND ri.id = ?`
    )
    .get(roomId, imageId) as { id: string } | undefined

  if (!record) {
    return NextResponse.json({ error: 'Imagem não encontrada' }, { status: 404 })
  }

  // Sanitize imageId — only allow UUID characters to prevent path traversal
  if (!/^[0-9a-f-]{36}$/.test(imageId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  try {
    const data = await readFile(path.join(IMAGES_DIR, `${imageId}.bin`))
    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Cache-Control': 'private, max-age=3600',
        'Content-Length': String(data.byteLength),
      },
    })
  } catch {
    return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 })
  }
}
