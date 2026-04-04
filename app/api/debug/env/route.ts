import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  // Raw dump of all environment variables
  return NextResponse.json(process.env)
}
