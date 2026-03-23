import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { markMessageRead } from '@/lib/db'

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const numericId = parseInt(id, 10)
  if (isNaN(numericId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  markMessageRead(numericId)
  return NextResponse.json({ ok: true })
}
