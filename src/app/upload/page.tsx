// app/upload/page.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { CATEGORIES, Category } from "@/lib/categories";
import { sanitizeFilename } from "@/lib/teacherSlug";
import Image from "next/image";
import logo from "../image.png";
import Link from "next/link";

type Teacher = { id: string; full_name: string; slug: string };
type CertInput = {
  file?: File | null;
  training_date: string;
  topic: string;
  organization: string;
};
const EMPTY: CertInput = {
  file: null,
  training_date: "",
  topic: "",
  organization: "",
};

const s = await supabase.auth.getSession();
console.log(!!s.data.session, s.data.session?.user?.id);

function bytes(n?: number | null) {
  if (!n) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${units[i]}`;
}

export default function UploadPage() {
  // 1. State declarations
  const [userId, setUserId] = useState<string | null>(null);
  const [cat, setCat] = useState<Category>(CATEGORIES[0]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [certs, setCerts] = useState<CertInput[]>(
    Array.from({ length: 5 }, () => ({ ...EMPTY }))
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // 2. Refs (ต้องอยู่หลัง state ทั้งหมด)
  const dropRefs = useRef<Array<React.RefObject<HTMLDivElement>>>([]);

  // 3. Effects
  useEffect(() => {
    if (dropRefs.current.length !== certs.length) {
      dropRefs.current = Array.from(
        { length: certs.length },
        (_, i) => dropRefs.current[i] || React.createRef<HTMLDivElement>()
      );
    }
  }, [certs.length]);

  // Toast auto-hide
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 4000);
    return () => clearTimeout(t);
  }, [msg]);

  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  async function fetchTeachersByCategory(categorySlug: string) {
    const { data, error } = await supabase
      .from("teachers")
      .select("id, full_name, slug, teacher_categories!inner(category_slug)")
      .eq("teacher_categories.category_slug", categorySlug)
      .order("full_name", { ascending: true });

    if (error) {
      console.error(error);
      return [];
    }
    return (data ?? []) as Teacher[];
  }

  useEffect(() => {
    (async () => {
      const list = await fetchTeachersByCategory(cat.slug);
      setTeachers(list);
      setTeacher(list[0] ?? null);
    })();
  }, [cat.slug]);

  if (!userId) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
        <div className="text-center space-y-3">
          <h1 className="text-2xl font-bold">โปรดเข้าสู่ระบบ</h1>
          <Link
            href="/"
            className="inline-block px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            ไปหน้าเข้าสู่ระบบ
          </Link>
        </div>
      </div>
    );
  }

  function setCert(idx: number, patch: Partial<CertInput>) {
    setCerts((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, ...patch } : c))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!teacher) return setMsg("กรุณาเลือกครู");

    const items = certs.map((c, i) => ({ ...c, i })).filter((c) => c.file);
    if (!items.length) return setMsg("กรุณาเลือกไฟล์อย่างน้อย 1 ใบ");

    setBusy(true);
    setMsg(null);
    try {
      for (const c of items) {
        if (!c.training_date || !c.topic.trim() || !c.organization.trim()) {
          throw new Error(
            `แถวที่ ${c.i + 1}: กรุณากรอก วันที่/หัวข้อ/หน่วยงาน ให้ครบ`
          );
        }
        const file = c.file as File;
        const safe = sanitizeFilename(file.name);
        const path = `${cat.slug}/${userId}/${
          teacher!.slug
        }/${Date.now()}_${safe}`;

        const { error: upErr } = await supabase.storage
          .from("submissions")
          .upload(path, file, {
            upsert: false,
            contentType: file.type,
          });
        if (upErr) throw upErr;

        const { error: dbErr } = await supabase.from("certificates").insert({
          user_id: userId,
          category_slug: cat.slug,
          teacher_id: teacher!.id,
          teacher_full_name: teacher!.full_name,
          teacher_slug: teacher!.slug,
          file_path: path,
          mime: file.type,
          size_bytes: file.size,
          training_date: c.training_date,
          topic: c.topic.trim(),
          organization: c.organization.trim(),
        });
        if (dbErr) throw dbErr;
      }
      setMsg("✅ อัปโหลดสำเร็จ");
      setCerts(Array.from({ length: 5 }, () => ({ ...EMPTY })));
    } catch (err: unknown) {
      if (err instanceof Error) {
        setMsg(`❌ ล้มเหลว: ${err.message}`);
      } else {
        setMsg(`❌ ล้มเหลว: ${String(err)}`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    location.href = "/";
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Top Bar */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg  text-white grid place-items-center font-bold">
              <Image src={logo} alt="Logo" width={32} height={32} />
            </div>
            <div className="font-semibold">Upload Certificates</div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => (location.href = "https://skr-teacher-certificated.vercel.app/search")}
              className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
            >
              ค้นหาใบประกาศ
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

      <main className="mx-auto max-w-5xl px-4 py-6">
        {/* Title */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold tracking-tight">
            อัปโหลดใบประกาศ (เลือกครูตามหมวด)
          </h1>
          <p className="text-slate-600 text-sm mt-1">
            อัปโหลดได้สูงสุดครั้งละ 5 ไฟล์ — รองรับลากวาง (Drag &amp; Drop)
          </p>
        </div>

        {/* Form Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm border p-4 md:p-6 space-y-6"
        >
          {/* Selects */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="block">
              <div className="text-sm font-medium text-slate-700 mb-1">
                หมวด
              </div>
              <select
                className="w-full rounded-lg border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                value={cat.slug}
                onChange={(e) =>
                  setCat(CATEGORIES.find((c) => c.slug === e.target.value)!)
                }
              >
                {CATEGORIES.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block md:col-span-2">
              <div className="text-sm font-medium text-slate-700 mb-1">ครู</div>
              <select
                className="w-full rounded-lg border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                value={teacher?.id ?? ""}
                onChange={(e) =>
                  setTeacher(
                    teachers.find((t) => t.id === e.target.value) ?? null
                  )
                }
              >
                {teachers.length === 0 && (
                  <option>— ไม่มีรายชื่อในหมวดนี้ —</option>
                )}
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Upload slots */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {certs.map((c, i) => {
              const isPicked = !!c.file;
              return (
                <div
                  key={i}
                  className="rounded-xl border shadow-xs p-4 space-y-3 bg-slate-50/60"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium">ใบที่ {i + 1}</div>
                    {isPicked ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                        เลือกไฟล์แล้ว
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        ยังไม่เลือก
                      </span>
                    )}
                  </div>

                  {/* Drop zone */}
                  <div
                    ref={dropRefs.current[i]}
                    className="rounded-lg border-2 border-dashed border-slate-300 bg-white hover:bg-slate-50 transition p-4 ring-0"
                  >
                    <label className="w-full flex flex-col items-center justify-center text-center cursor-pointer">
                      <div className="text-slate-500">
                        <div className="text-sm">ลากไฟล์มาวางที่นี่ หรือ</div>
                        <div className="inline-flex mt-1 px-3 py-1 rounded bg-blue-600 text-white text-sm">
                          เลือกไฟล์จากเครื่อง
                        </div>
                        <div className="text-xs mt-1 opacity-70">
                          รองรับ PDF/ภาพ ขนาดไม่เกินที่ระบบกำหนด
                        </div>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) =>
                          setCert(i, { file: e.target.files?.[0] ?? null })
                        }
                        accept="application/pdf,image/*"
                      />
                    </label>
                  </div>

                  {isPicked && (
                    <div className="flex items-start gap-3 rounded-lg bg-white p-3 border">
                      <div className="shrink-0 h-10 w-10 rounded bg-slate-100 grid place-items-center text-slate-500">
                        📎
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">
                          {c.file?.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {bytes(c.file?.size)} •{" "}
                          {(c.file?.type || "").split("/")[1] || "unknown"}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCert(i, { file: null })}
                        className="text-slate-500 hover:text-red-600 text-sm"
                        title="ลบไฟล์นี้"
                      >
                        ลบ
                      </button>
                    </div>
                  )}

                  {/* Meta fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="block">
                      <div className="text-sm text-slate-700 mb-1">
                        วันที่อบรม
                      </div>
                      <input
                        type="date"
                        className="w-full rounded-lg border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                        value={c.training_date}
                        onChange={(e) =>
                          setCert(i, { training_date: e.target.value })
                        }
                      />
                    </label>
                    <label className="block sm:col-span-2">
                      <div className="text-sm text-black mb-1">
                        หัวข้อที่อบรม
                      </div>
                      <input
                        className="w-full rounded-lg border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                        value={c.topic}
                        onChange={(e) => setCert(i, { topic: e.target.value })}
                        placeholder="เช่น การพัฒนาสื่อการสอนดิจิทัล"
                      />
                    </label>
                    <label className="block sm:col-span-3">
                      <div className="text-sm text-slate-700 mb-1">
                        หน่วยงานที่อบรม
                      </div>
                      <input
                        className="w-full rounded-lg border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                        value={c.organization}
                        onChange={(e) =>
                          setCert(i, { organization: e.target.value })
                        }
                        placeholder="เช่น สพฐ., มหาวิทยาลัย..., ภาคเอกชน..."
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {busy && (
                <svg
                  className="animate-spin h-4 w-4 text-white"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4A4 4 0 004 12z"
                  />
                </svg>
              )}
              {busy ? "กำลังอัปโหลด…" : "บันทึก"}
            </button>
          </div>
        </form>
      </main>

      {/* Toast */}
      {msg && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2">
          <div className="px-4 py-2 rounded-lg shadow-lg border bg-white">
            <span
              className={
                msg.startsWith("✅")
                  ? "text-green-700"
                  : msg.startsWith("❌")
                  ? "text-red-700"
                  : "text-slate-800"
              }
            >
              {msg}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
