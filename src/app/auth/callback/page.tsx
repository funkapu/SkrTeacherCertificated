'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function CallbackPage() {
  const [msg, setMsg] = useState('กำลังยืนยันตัวตน…')
  const router = useRouter()

  useEffect(() => {
    // ถ้า OAuth สำเร็จ Supabase จะตั้ง session ให้แล้ว
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setMsg('✅ เข้าสู่ระบบสำเร็จ กำลังพาไปหน้าค้นหา…')
        setTimeout(() => router.replace('/search'), 800)
      } else {
        setMsg('❌ ลิงก์ไม่ถูกต้องหรือหมดอายุ')
      }
    })
  }, [router])

  return <div className="p-6 text-center">{msg}</div>
}
