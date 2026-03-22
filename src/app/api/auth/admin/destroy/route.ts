import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, DESTROY_LIMIT } from '@/lib/rate-limit'
import { destroyAllData } from '@/lib/db'

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'

  const { allowed, retryAfter } = checkRateLimit(ip, DESTROY_LIMIT.max, DESTROY_LIMIT.windowMs)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Tente novamente mais tarde.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }

  const masterPassword = req.headers.get('x-master-password')
  if (!masterPassword || masterPassword !== process.env.MASTER_PASSWORD) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const io = (global as any).io
  const connections = io?.engine?.clientsCount ?? 0
  io?.emit('server-destroyed')

  const { users, rooms } = destroyAllData()

  return NextResponse.json({ destroyed: { users, rooms, connections } })
}
