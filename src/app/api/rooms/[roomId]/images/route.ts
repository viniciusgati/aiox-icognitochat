import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { writeFile } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import db, { IMAGES_DIR } from '@/lib/db'
import { sessionOptions, SessionData } from '@/lib/session'

const MAX_IMAGES_PER_ROOM = 10
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024 // 3 MB (encrypted overhead ~10% over plaintext)

interface Props {
  params: Promise<{ roomId: string }>
}

export async function POST(req: NextRequest, { params }: Props) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { roomId } = await params
  const room = db
    .prepare('SELECT id FROM rooms WHERE slug = ?')
    .get(roomId) as { id: number } | undefined

  if (!room) {
    return NextResponse.json({ error: 'Sala não encontrada' }, { status: 404 })
  }

  // Enforce room image limit
  const count = (
    db
      .prepare('SELECT COUNT(*) as n FROM room_images WHERE room_id = ?')
      .get(room.id) as { n: number }
  ).n
  if (count >= MAX_IMAGES_PER_ROOM) {
    return NextResponse.json(
      { error: `Limite de ${MAX_IMAGES_PER_ROOM} imagens por sala atingido` },
      { status: 429 }
    )
  }

  const contentLength = Number(req.headers.get('content-length') ?? 0)
  if (contentLength > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'Imagem muito grande (máx. 3 MB)' }, { status: 413 })
  }

  const buffer = Buffer.from(await req.arrayBuffer())
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'Imagem muito grande (máx. 3 MB)' }, { status: 413 })
  }
  if (buffer.byteLength === 0) {
    return NextResponse.json({ error: 'Corpo vazio' }, { status: 400 })
  }

  const imageId = crypto.randomUUID()
  await writeFile(path.join(IMAGES_DIR, `${imageId}.bin`), buffer)

  db.prepare('INSERT INTO room_images (id, room_id) VALUES (?, ?)').run(imageId, room.id)

  return NextResponse.json({ imageId }, { status: 201 })
}
