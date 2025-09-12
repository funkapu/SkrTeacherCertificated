'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ADMIN_EMAILS } from '@/lib/admin'

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setMe(data.user?.email ?? null)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="p-6">กำลังตรวจสิทธิ์…</div>
  if (!me || !ADMIN_EMAILS.includes(me)) {
    return <div className="p-6">สำหรับแอดมินเท่านั้น</div>
  }
  return <>{children}</>
}
