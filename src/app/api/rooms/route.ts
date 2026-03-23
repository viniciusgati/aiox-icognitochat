import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import crypto from 'crypto'
import db, { getSetting } from '@/lib/db'
import { sessionOptions, SessionData } from '@/lib/session'

const ALLOWED_TTLS = new Set([30, 60, 300, 600, 1800, 3600])

function parseTtl(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const n = Number(value)
  return ALLOWED_TTLS.has(n) ? n : null
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
}

function generateEphemeralSlug(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = crypto.randomBytes(8)
  const p1 = Array.from(bytes.slice(0, 4), (b) => chars[b % chars.length]).join('')
  const p2 = Array.from(bytes.slice(4, 8), (b) => chars[b % chars.length]).join('')
  return `${p1}-${p2}`
}

export async function GET() {
  // Ephemeral rooms are excluded — they are accessed only via direct link
  const rooms = db
    .prepare(
      'SELECT id, slug, name, description, created_at FROM rooms WHERE is_ephemeral = 0 ORDER BY id ASC'
    )
    .all()

  return NextResponse.json({ rooms })
}

export async function POST(req: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)

  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  // Check global settings
  if (!session.isAdmin) {
    const allowRoomCreation = getSetting('allow_room_creation') ?? '1'
    if (allowRoomCreation !== '1') {
      return NextResponse.json({ error: 'Criação de salas desativada pelo administrador' }, { status: 403 })
    }
  }

  const body = await req.json()
  const ephemeral = body.ephemeral === true
  const ttl = parseTtl(body.messageTtlSeconds)

  if (ephemeral) {
    const slug = generateEphemeralSlug()
    // Name = slug to satisfy UNIQUE constraint (slug is always unique)
    const result = db
      .prepare(
        'INSERT INTO rooms (slug, name, created_by, is_ephemeral, message_ttl_seconds) VALUES (?, ?, ?, 1, ?)'
      )
      .run(slug, slug, session.userId, ttl)

    const room = db
      .prepare(
        'SELECT id, slug, name, created_at, is_ephemeral, message_ttl_seconds FROM rooms WHERE id = ?'
      )
      .get(result.lastInsertRowid)

    return NextResponse.json({ room }, { status: 201 })
  }

  // Regular room
  const { name } = body

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'Nome da sala é obrigatório' }, { status: 400 })
  }

  const trimmedName = name.trim()
  if (trimmedName.length < 2 || trimmedName.length > 50) {
    return NextResponse.json(
      { error: 'Nome deve ter entre 2 e 50 caracteres' },
      { status: 400 }
    )
  }

  const slug = slugify(trimmedName)
  if (!slug) {
    return NextResponse.json({ error: 'Nome inválido para sala' }, { status: 400 })
  }

  try {
    const result = db
      .prepare(
        'INSERT INTO rooms (slug, name, created_by, is_ephemeral, message_ttl_seconds) VALUES (?, ?, ?, 0, ?)'
      )
      .run(slug, trimmedName, session.userId, ttl)

    const room = db
      .prepare(
        'SELECT id, slug, name, created_at, is_ephemeral, message_ttl_seconds FROM rooms WHERE id = ?'
      )
      .get(result.lastInsertRowid)

    return NextResponse.json({ room }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('UNIQUE')) {
      return NextResponse.json({ error: 'Já existe uma sala com este nome' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Erro ao criar sala' }, { status: 500 })
  }
}
