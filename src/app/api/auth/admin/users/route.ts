import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import db from '@/lib/db'
import { generateCredentials } from '@/lib/generate-credentials'
import { requireAdmin } from '@/lib/admin-auth'

const BCRYPT_ROUNDS = 10

export async function GET() {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const users = db
    .prepare(
      'SELECT id, username, is_admin, created_at, last_seen_at FROM users ORDER BY last_seen_at DESC NULLS LAST, created_at DESC'
    )
    .all() as { id: number; username: string; is_admin: number; created_at: number; last_seen_at: number | null }[]

  return NextResponse.json({ users })
}

export async function POST() {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  try {
    const { username, password } = generateCredentials()
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)

    db.prepare(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)'
    ).run(username, passwordHash)

    // Retorna credenciais em plaintext — única vez que são exibidas
    return NextResponse.json({ username, password }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    return NextResponse.json(
      { error: `Falha ao criar usuário: ${message}` },
      { status: 500 }
    )
  }
}
