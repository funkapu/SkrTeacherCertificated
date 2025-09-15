import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ตรวจสอบ environment variables
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// สร้าง client เมื่อมี env variables ครบ
let admin: ReturnType<typeof createClient> | null = null
if (url && serviceKey) {
  admin = createClient(url, serviceKey)
}

export async function POST(req: Request) {
  // ตรวจสอบว่ามี admin client หรือไม่
  if (!admin) {
    return NextResponse.json(
      { error: 'Missing environment variables for Supabase' },
      { status: 500 }
    )
  }
  const { prefix = '', limit = 1000 } = await req.json().catch(() => ({}))

  // 1) list ผ่าน Storage API (service key ข้าม policy)
  const { data: listData, error: listErr } = await admin
    .storage.from('submissions')
    .list(prefix, { limit })

  // 2) ย้ำด้วยการส่องตาราง system: storage.objects
  const { data: objs, error: objsErr } = await admin
    .from('storage.objects')
    .select('id, name, bucket_id, updated_at')
    .eq('bucket_id', 'submissions')
    .ilike('name', `${prefix}%`)
    .limit(limit)

  return NextResponse.json({
    prefix,
    list: { data: listData, error: listErr?.message },
    objects: { data: objs, error: objsErr?.message },
  })
}
