import { NextResponse } from 'next/server'
import { destroyAllData } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'

export async function POST() {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const io = (global as any).io
  const connections = io?.engine?.clientsCount ?? 0
  io?.emit('server-destroyed')

  const { users, rooms } = destroyAllData()

  return NextResponse.json({ destroyed: { users, rooms, connections } })
}
