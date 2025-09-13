// app/search/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { CATEGORIES, Category } from '@/lib/categories'
import Image from 'next/image'
import logo from '../image.png'
type Cert = {
  id: string
  category_slug: string
  teacher_full_name: string
  teacher_slug: string | null
  file_path: string
  mime: string | null
  training_date: string
  topic: string
  organization: string
  created_at: string
}
type Teacher = { id: string; full_name: string; slug: string }
const ALL_TEACHERS_VALUE = '__ALL__'

export default function SearchPage() {
  const [cat, setCat] = useState<Category>(CATEGORIES[0])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [teacherId, setTeacherId] = useState<string>(ALL_TEACHERS_VALUE)

  const [rows, setRows] = useState<Cert[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  // โหลดรายชื่อครูของหมวดที่เลือก
  async function fetchTeachersByCategory(categorySlug: string) {
    const { data, error } = await supabase
      .from('teachers')
      .select('id, full_name, slug, teacher_categories!inner(category_slug)')
      .eq('teacher_categories.category_slug', categorySlug)
      .order('full_name', { ascending: true })
    if (error) {
      console.error(error)
      setTeachers([])
      setTeacherId(ALL_TEACHERS_VALUE)
      return
    }
    const list = (data ?? []) as Teacher[]
    setTeachers(list)
    setTeacherId(ALL_TEACHERS_VALUE)
  }

  useEffect(() => {
    fetchTeachersByCategory(cat.slug)
  }, [cat.slug])

  function resultLabel(n: number) {
    if (!searched) return ''
    if (loading) return 'กำลังค้นหา…'
    if (n === 0) return 'ยังไม่พบเกียรติบัตร'
    if (n === 1) return 'เกียรติบัตรที่อัปโหลด 1 รายการ'
    return `เกียรติบัตรที่อัปโหลด ${n} รายการ`
  }

  async function handleSearch() {
    setLoading(true); setMsg(null); setSearched(true)

    let q = supabase
      .from('certificates')
      .select('id,category_slug,teacher_full_name,teacher_slug,file_path,mime,training_date,topic,organization,created_at')
      .eq('category_slug', cat.slug)
      .order('training_date', { ascending: false })
      .limit(1000)

    if (teacherId !== ALL_TEACHERS_VALUE) {
      const chosen = teachers.find(t => t.id === teacherId)
      if (chosen) q = q.eq('teacher_slug', chosen.slug)
    }

    const { data, error } = await q
    if (error) setMsg(error.message)
    setRows((data ?? []) as Cert[])
    setLoading(false)
  }

  function formatDate(d: string) {
    if (!d) return '-'
    try { return new Date(d).toLocaleDateString('th-TH') } catch { return d }
  }

  async function openFile(path: string) {
    const { data, error } = await supabase.storage.from('submissions').createSignedUrl(path, 300)
    if (error || !data?.signedUrl) {
      setMsg(error?.message || 'ไม่สามารถเปิดไฟล์ได้'); return
    }
    window.open(data.signedUrl, '_blank')
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    location.href = '/'
  }

  // ไอคอน
  function PdfIcon() {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-red-600" fill="currentColor" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <text x="6" y="18" fontSize="7" fontFamily="Arial" fill="currentColor">PDF</text>
      </svg>
    )
  }
  function FileIcon() {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-gray-700" fill="currentColor" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      </svg>
    )
  }

  // สเกลเลตันโหลดการ์ด
  function CardSkeleton() {
    return (
      <div className="border rounded-xl p-4 animate-pulse bg-white">
        <div className="h-4 w-1/2 bg-slate-200 rounded mb-3" />
        <div className="h-3 w-2/3 bg-slate-200 rounded mb-2" />
        <div className="h-3 w-1/3 bg-slate-200 rounded mb-2" />
        <div className="h-3 w-1/2 bg-slate-200 rounded" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Top Bar */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg  text-white grid place-items-center font-bold">
              <Image src={logo} alt="Logo" width={32} height={32} />
            </div>
            <div className="font-semibold">SKR Search Certificates</div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => (location.href = 'https://skr-teacher-certificated.vercel.app/upload')}
              className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
            >
              อัปโหลดใบประกาศ
            </button>
            <button
              onClick={handleSignOut}
              className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
            >
              ล็อคเอ้าท์
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 space-y-5">
        {/* ฟิลเตอร์เป็นการ์ด */}
        <section className="bg-white rounded-2xl shadow-sm border p-4 md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="block">
              <div className="text-sm font-medium text-slate-700 mb-1">กลุ่มสาระ</div>
              <select
                className="w-full rounded-lg border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                value={cat.slug}
                onChange={(e)=>setCat(CATEGORIES.find(c=>c.slug===e.target.value)!)}
              >
                {CATEGORIES.map(c => <option key={c.slug} value={c.slug}>{c.label}</option>)}
              </select>
            </label>

            <label className="block md:col-span-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-slate-700 mb-1">ครูในหมวดนี้</div>
                {teachers.length > 0 && (
                  <span className="text-xs text-slate-500 mb-1">ทั้งหมด {teachers.length} คน</span>
                )}
              </div>
              <select
                className="w-full rounded-lg border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                value={teacherId}
                onChange={(e)=>setTeacherId(e.target.value)}
              >
                <option value={ALL_TEACHERS_VALUE}>— ทั้งหมดในหมวด —</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>{t.full_name}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={handleSearch}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M10 2a8 8 0 105.293 14.293l4.707 4.707 1.414-1.414-4.707-4.707A8 8 0 0010 2zm0 2a6 6 0 110 12A6 6 0 0110 4z"/></svg>
              ค้นหา
            </button>
            {!!resultLabel(rows.length) && (
              <span className="text-sm px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                {resultLabel(rows.length)}
              </span>
            )}
            {msg && <span className="text-sm text-red-600">{msg}</span>}
          </div>
        </section>

        {/* ผลลัพธ์ */}
        <section>
          {/* กำลังโหลด: โชว์ skeleton */}
          {loading && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({length:6}).map((_,i)=><CardSkeleton key={i} />)}
            </div>
          )}

          {/* มีผลลัพธ์ */}
          {!loading && rows.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map(r => {
                const isPdf = (r.mime ?? '').toLowerCase().includes('pdf')
                return (
                  <div key={r.id} className="border rounded-xl p-4 bg-white shadow-sm hover:shadow transition flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold leading-tight line-clamp-2">{r.teacher_full_name}</div>
                      <button
                        onClick={()=>openFile(r.file_path)}
                        className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200"
                        title={isPdf ? 'เปิดไฟล์ PDF' : 'เปิดไฟล์'}
                      >
                        {isPdf ? <PdfIcon /> : <FileIcon />}
                      </button>
                    </div>

                    <div className="text-sm space-y-1">
                      <div><span className="opacity-60">วันที่อบรม:</span> {formatDate(r.training_date)}</div>
                      <div className="line-clamp-2"><span className="opacity-60">หัวข้อ:</span> {r.topic || '-'}</div>
                      <div className="line-clamp-2"><span className="opacity-60">หน่วยงาน:</span> {r.organization || '-'}</div>
                    </div>

                    <div className="text-xs opacity-60 mt-auto">
                      {r.category_slug} • อัปโหลด {formatDate(r.created_at)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ว่างเปล่า */}
          {!loading && searched && rows.length === 0 && (
            <div className="border rounded-2xl p-8 bg-white text-center text-slate-600">
              <div className="text-3xl mb-2">🔎</div>
              <div className="font-medium">ไม่พบข้อมูลในเงื่อนไขที่เลือก</div>
              <div className="text-sm mt-1">ลองเปลี่ยนหมวดหรือเลือก “ทั้งหมดในหมวด”</div>
            </div>
          )}

          {/* ยังไม่กดค้นหา */}
          {!loading && !searched && (
            <div className="border rounded-2xl p-8 bg-white text-center text-slate-600">
              เลือกกลุ่มสาระและรายชื่อครู แล้วกดปุ่ม <span className="font-medium">ค้นหา</span>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
