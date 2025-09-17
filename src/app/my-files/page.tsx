"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { CATEGORIES, Category } from "@/lib/categories";
import { isAuthorizedUser } from "@/lib/admin";

type Obj = { name: string; id: string; created_at: string };

export default function MyFilesPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [cat, setCat] = useState<Category>(CATEGORIES[0]);
  const [items, setItems] = useState<Obj[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data }) => {
        const user = data.user;
        setUserId(user?.id ?? null);
        setUserEmail(user?.email ?? null);
      })
      .finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    supabase.storage
      .from("submissions")
      .list(`${cat.slug}/${userId}`, {
        limit: 200,
        sortBy: { column: "created_at", order: "desc" },
      })
      .then(({ data, error }) => {
        if (!error) {
          setItems((data as Obj[]) ?? []); // Explicitly cast data to Obj[]
        }
        setLoading(false);
      });
  }, [cat.slug, userId]);

  if (authLoading) {
    return <div className="p-6">กำลังตรวจสอบสิทธิ์…</div>;
  }
  if (!userId || !userEmail || !isAuthorizedUser(userEmail)) {
    return (
      <div className="p-6">
        <div className="text-center space-y-3">
          <h1 className="text-lg font-bold">ไม่มีสิทธิ์เข้าถึง</h1>
          <p className="text-gray-600">
            ระบบนี้สำหรับผู้ใช้ที่ได้รับอนุญาตจากองค์กรเท่านั้น
          </p>
          <Link className="underline" href="/">
            กลับไปหน้าเข้าสู่ระบบ
          </Link>
        </div>
      </div>
    );
  }

  async function openSigned(name: string) {
    const raw = `${cat.slug}/${userId}/${name}`;
    const path = raw.replace(/^\/+/, "").trim();
    try {
      const { data, error } = await supabase.storage
        .from("submissions")
        .createSignedUrl(path, 60);
      if (error) {
        console.error("createSignedUrl error", { path, error });
        setMsg(error.message || "ไม่สามารถสร้างลิงก์เข้าถึงไฟล์ได้");
        return;
      }
      if (!data?.signedUrl) {
        console.error("createSignedUrl returned no signedUrl", { path, data });
        setMsg("ไม่พบไฟล์ หรือไม่สามารถสร้างลิงก์เข้าถึงได้");
        return;
      }
      window.open(data.signedUrl, "_blank");
    } catch (e) {
      console.error("openSigned unexpected", e);
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }

  try {
    setBusy(true);
    // Upload logic
  } catch (error: unknown) {
    if (error instanceof Error) {
      setMsg(`❌ ล้มเหลว: ${error.message}`);
    } else {
      setMsg(`❌ ล้มเหลว: ${String(error)}`);
    }
  } finally {
    setBusy(false);
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold">ไฟล์ของฉัน</h1>
        <select
          className="border p-2 rounded"
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
      </div>

      {loading && <p>กำลังโหลด…</p>}
      {!loading && items.length === 0 && <p>ยังไม่มีไฟล์ในหมวดนี้</p>}

      <ul className="space-y-2">
        {items.map((it) => (
          <li
            key={it.id}
            className="flex items-center justify-between border p-3 rounded"
          >
            <span className="truncate">{it.name}</span>
            <button className="underline" onClick={() => openSigned(it.name)}>
              เปิด
            </button>
          </li>
        ))}
      </ul>

      <div className="text-center">
        {busy && <div className="text-center">กำลังประมวลผล...</div>}
        {msg && (
          <div className="mb-4 p-4 rounded bg-red-50 text-red-600">{msg}</div>
        )}
        <Link
          href="/"
          className="inline-block px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
        >
          กลับหน้าแรก
        </Link>
      </div>
    </div>
  );
}
