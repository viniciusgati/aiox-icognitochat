import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import db from '@/lib/db'
import { generateCredentials } from '@/lib/generate-credentials'

const BCRYPT_ROUNDS = 10

export async function POST(req: NextRequest) {
  const masterPassword = req.headers.get('x-master-password')

  console.log('[admin] header recebido:', masterPassword ? `${masterPassword.slice(0, 6)}...` : 'null')
  console.log('[admin] env definido:', !!process.env.MASTER_PASSWORD)
  console.log('[admin] match:', masterPassword === process.env.MASTER_PASSWORD)

  if (!masterPassword || masterPassword !== process.env.MASTER_PASSWORD) {
    return NextResponse.json(
      { error: 'Não autorizado' },
      { status: 401 }
    )
  }

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
