'use client'
import { useEffect, useMemo, useState } from 'react'
import AdminGuard from '../../components/AdminGuard'
import { supabase } from '@/lib/supabase'
import { CATEGORIES } from '@/lib/categories'

function shortHash(s: string) {
  let h = 0; for (let i=0;i<s.length;i++) h = Math.imul(31,h)+s.charCodeAt(i)|0;
  return Math.abs(h).toString(36).slice(0,6)
}
function teacherFolderSlug(fullName: string) {
  const base = fullName.trim()
    .normalize('NFKD').replace(/[^\x00-\x7F]/g,'')
    .replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-+|-+$/g,'').toLowerCase()
  return (base || 'teacher') + '-' + shortHash(fullName)
}

type Teacher = { id: string; full_name: string; slug: string; email: string|null }
type Join = { teacher_id: string; category_slug: string }

export default function AdminTeachersPage() {
  const [list, setList] = useState<Teacher[]>([])
  const [joins, setJoins] = useState<Join[]>([])
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [selectedCats, setSelectedCats] = useState<string[]>([])
  const [msg, setMsg] = useState<string | null>(null)

  async function refresh() {
    const t = await supabase.from('teachers').select('id, full_name, slug, email').order('full_name', { ascending: true })
    setList((t.data ?? []) as Teacher[])
    const j = await supabase.from('teacher_categories').select('teacher_id, category_slug')
    setJoins((j.data ?? []) as Join[])
  }
  useEffect(() => { refresh() }, [])

  const catsByTeacher = useMemo(() => {
    const m: Record<string, string[]> = {}
    for (const j of joins) (m[j.teacher_id] ||= []).push(j.category_slug)
    return m
  }, [joins])

  async function addTeacher(e: React.FormEvent) {
    e.preventDefault(); setMsg(null)
    const name = fullName.trim()
    if (!name) return setMsg('กรุณากรอกชื่อครู')
    const slug = teacherFolderSlug(name)

    const { data, error } = await supabase.from('teachers')
      .insert({ full_name: name, slug, email: email.trim() || null })
      .select('id').single()
    if (error) return setMsg(`เพิ่มครูไม่สำเร็จ: ${error.message}`)

    if (selectedCats.length) {
      const rows = selectedCats.map(c => ({ teacher_id: data!.id, category_slug: c }))
      const { error: jerr } = await supabase.from('teacher_categories').insert(rows)
      if (jerr) return setMsg(`ผูกหมวดไม่สำเร็จ: ${jerr.message}`)
    }
    setFullName(''); setEmail(''); setSelectedCats([]); setMsg('✅ เพิ่มครูสำเร็จ')
    refresh()
  }

  async function removeTeacher(id: string) {
    if (!confirm('ลบครูคนนี้? (การผูกหมวดจะถูกลบด้วย)')) return
    const { error } = await supabase.from('teachers').delete().eq('id', id)
    if (error) return setMsg(`ลบไม่สำเร็จ: ${error.message}`)
    setMsg('✅ ลบแล้ว'); refresh()
  }

  function toggleCat(slug: string) {
    setSelectedCats(prev => prev.includes(slug) ? prev.filter(s => s!==slug) : [...prev, slug])
  }

  return (
    <AdminGuard>
      <div className="mx-auto max-w-4xl p-6 space-y-6">
        <h1 className="text-2xl font-bold">Admin: ครู & หมวด</h1>

        <form onSubmit={addTeacher} className="border rounded p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm">ชื่อ-นามสกุลครู</span>
              <input className="w-full border p-2 rounded" value={fullName} onChange={e=>setFullName(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-sm">อีเมล (ถ้ามี)</span>
              <input type="email" className="w-full border p-2 rounded" value={email} onChange={e=>setEmail(e.target.value)} />
            </label>
          </div>

          <div>
            <div className="text-sm mb-1">หมวดที่รับผิดชอบ</div>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(c => (
                <label key={c.slug} className="inline-flex items-center gap-2 border rounded px-2 py-1">
                  <input type="checkbox" checked={selectedCats.includes(c.slug)} onChange={()=>toggleCat(c.slug)} />
                  <span>{c.label}</span>
                </label>
              ))}
            </div>
          </div>

          <button className="border px-4 py-2 rounded bg-blue-600 text-white">เพิ่มครู</button>
          {msg && <p>{msg}</p>}
        </form>

        <div className="space-y-2">
          <h2 className="font-semibold">รายการครู</h2>
          <ul className="space-y-2">
            {list.map(t => (
              <li key={t.id} className="border rounded p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{t.full_name}</div>
                    <div className="text-sm opacity-70">{t.email ?? '—'}</div>
                    <div className="text-xs opacity-60">slug: {t.slug}</div>
                    <div className="text-xs mt-1">หมวด: {(catsByTeacher[t.id] ?? []).join(', ') || '—'}</div>
                  </div>
                  <button className="underline text-red-600" onClick={()=>removeTeacher(t.id)}>ลบ</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AdminGuard>
  )
}
