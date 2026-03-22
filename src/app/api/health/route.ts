import { NextResponse } from 'next/server'
import db from '@/lib/db'

const healthCheck = db.prepare('SELECT 1')

export async function GET() {
  let dbStatus: 'ok' | 'error' = 'ok'
  try {
    healthCheck.get()
  } catch {
    dbStatus = 'error'
  }

  const status = dbStatus === 'ok' ? 'ok' : 'degraded'
  return NextResponse.json(
    { status, db: dbStatus, uptime: process.uptime(), timestamp: new Date().toISOString() },
    { status: status === 'ok' ? 200 : 503, headers: { 'Cache-Control': 'no-store' } }
  )
}
