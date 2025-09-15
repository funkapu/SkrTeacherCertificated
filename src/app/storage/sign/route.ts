import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const BUCKET = 'submissions'

function normalizeKey(k: string) {
  let key = String(k || '').trim().replace(/^\/+/, '').replace(/^public\//, '').replace(/^submissions\//, '')
  const m = key.match(/\/object\/(?:public|sign)\/[^/]+\/(.+)$/)
  if (m) key = m[1]
  return key
}

// ✅ เปิดในเบราว์เซอร์เพื่อตรวจว่ามา route นี้จริงไหม
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      route: '/api/storage/sign',
      env: {
        HAS_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
        HAS_SERVICE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      },
    },
    { headers: { 'X-Route': 'storage/sign' } }
  )
}

export async function POST(req: Request) {
  try {
    const admin = createClient(url, serviceKey)
    const { key, expiresIn = 300 } = await req.json()
    if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 })

    const clean = normalizeKey(key)
    const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(clean, Number(expiresIn))
    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: error?.message || 'sign failed' }, { status: 404 })
    }
    return NextResponse.json({ url: data.signedUrl })
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : 'server error';
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
