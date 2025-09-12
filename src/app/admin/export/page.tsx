// app/admin/export/page.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import AdminGuard from "../../components/AdminGuard";
import { supabase } from "@/lib/supabase";
import { CATEGORIES } from "@/lib/categories";
import JSZip from "jszip";
import { saveAs } from "file-saver";

type Row = {
  id: string;
  created_at: string;
  category_slug: string;
  teacher_full_name: string;
  teacher_slug: string;
  training_date: string;
  topic: string;
  organization: string;
  file_path: string;
  mime: string | null;
  size_bytes: number | null;
  user_id: string;
};

// ---------- helpers ----------
function basename(p: string) {
  const i = p.lastIndexOf("/");
  return i >= 0 ? p.slice(i + 1) : p;
}
function safeZipName(name: string) {
  return name
    .replace(/[\\/:*?"<>|]/g, "-") // กันอักขระต้องห้ามของไฟล์
    .replace(/\s+/g, " ") // บีบช่องว่างซ้ำ
    .trim();
}
async function mapLimit<T, R>(
  arr: T[],
  limit: number,
  iter: (x: T, i: number) => Promise<R>
) {
  const ret: R[] = new Array(arr.length);
  let next = 0;
  const workers = new Array(Math.min(limit, arr.length))
    .fill(0)
    .map(async () => {
      while (true) {
        const i = next++;
        if (i >= arr.length) break;
        ret[i] = await iter(arr[i], i);
      }
    });
  await Promise.all(workers);
  return ret;
}
// --------------------------------

export default function AdminExportPage() {
  // Update initial state to be specific about the type
  const [cat, setCat] = useState<string>(CATEGORIES[0].slug);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // ---- multi-select suggest (ค้นหาครูหลายคน) ----
  const [suggests, setSuggests] = useState<string[]>([]);
  const [openSuggest, setOpenSuggest] = useState(false);
  const [selectedTeachers, setSelectedTeachers] = useState<string[]>([]);
  const suggestBoxRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!suggestBoxRef.current) return;
      if (!suggestBoxRef.current.contains(e.target as Node))
        setOpenSuggest(false);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      if (!q.trim()) {
        setSuggests([]);
        return;
      }
      const { data } = await supabase
        .from("v_certificates_export")
        .select("teacher_full_name")
        .eq("category_slug", cat)
        .ilike("teacher_full_name", `%${q.trim()}%`)
        .order("teacher_full_name", { ascending: true })
        .limit(50);
      const uniq = Array.from(
        new Set((data ?? []).map((d) => d.teacher_full_name))
      )
        .filter((n) => !selectedTeachers.includes(n))
        .slice(0, 10);
      setSuggests(uniq);
      setOpenSuggest(uniq.length > 0);
    }, 200);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [q, cat, selectedTeachers]);

  function addTeacher(name: string) {
    if (!selectedTeachers.includes(name))
      setSelectedTeachers((prev) => [...prev, name]);
    setQ("");
    setOpenSuggest(false);
  }
  function removeTeacher(name: string) {
    setSelectedTeachers((prev) => prev.filter((n) => n !== name));
  }
  // -------------------------------------------------

  async function fetchData() {
    setLoading(true);
    setMsg(null);
    let query = supabase
      .from("v_certificates_export")
      .select("*")
      .eq("category_slug", cat)
      .order("created_at", { ascending: false })
      .limit(10000);

    if (from) query = query.gte("training_date", from);
    if (to) query = query.lte("training_date", to);
    if (selectedTeachers.length > 0) {
      query = query.in("teacher_full_name", selectedTeachers);
    } else if (q.trim()) {
      query = query.ilike("teacher_full_name", `%${q.trim()}%`);
    }

    const { data, error } = await query;
    if (error) setMsg(error.message);
    setRows((data ?? []) as Row[]);
    setLoading(false);
  }

  async function fetchAll() {
    setLoading(true);
    setMsg(null);
    let query = supabase
      .from("v_certificates_export")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20000);

    if (from) query = query.gte("training_date", from);
    if (to) query = query.lte("training_date", to);
    if (selectedTeachers.length > 0) {
      query = query.in("teacher_full_name", selectedTeachers);
    } else if (q.trim()) {
      query = query.ilike("teacher_full_name", `%${q.trim()}%`);
    }

    const { data, error } = await query;
    if (error) setMsg(error.message);
    setRows((data ?? []) as Row[]);
    setLoading(false);
  }

  function toCSV(rs: Row[]) {
    const header = [
      "id",
      "created_at",
      "category_slug",
      "teacher_full_name",
      "teacher_slug",
      "training_date",
      "topic",
      "organization",
      "file_path",
      "mime",
      "size_bytes",
      "user_id",
    ];
    const lines = [header.join(",")];
    for (const r of rs) {
      const vals = [
        r.id,
        r.created_at,
        r.category_slug,
        r.teacher_full_name,
        r.teacher_slug,
        r.training_date,
        r.topic,
        r.organization,
        r.file_path,
        r.mime ?? "",
        String(r.size_bytes ?? ""),
        r.user_id,
      ].map((s) => `"${String(s).replaceAll('"', '""')}"`);
      lines.push(vals.join(","));
    }
    return lines.join("\n");
  }

  async function downloadCSV() {
    const csv = toCSV(rows);
    const blob = new Blob(
      ["\uFEFF", csv], // << ใส่ BOM
      { type: "text/csv;charset=utf-8;" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `certificates_${rows.length}_rows_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadCSVWithLinks() {
    setMsg("กำลังสร้างลิงก์ไฟล์…");
    const header = [
      "id",
      "created_at",
      "category_slug",
      "teacher_full_name",
      "training_date",
      "topic",
      "organization",
      "file_path",
      "signed_url",
    ].join(",");
    const lines: string[] = [header];
    for (const r of rows) {
      const { data, error } = await supabase.storage
        .from("submissions")
        .createSignedUrl(r.file_path, 600);
      if (error) {
        setMsg(error.message);
        return;
      }
      const vals = [
        r.id,
        r.created_at,
        r.category_slug,
        r.teacher_full_name,
        r.training_date,
        r.topic,
        r.organization,
        r.file_path,
        data?.signedUrl ?? "",
      ].map((s) => `"${String(s).replaceAll('"', '""')}"`);
      lines.push(vals.join(","));
    }
    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `certificates_withlinks_${rows.length}_rows_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg(null);
  }

  // ---- ZIP (รูป + CSV manifest) ----
  async function downloadZipImagesWithCSV() {
    if (!rows.length) return;
    setMsg("กำลังเตรียม ZIP (ดึงรูปและทำ CSV)…");

    // เลือกเฉพาะไฟล์ภาพ (ถ้าต้องรวมทุกไฟล์ ลบ filter นี้)
    const imgs = rows.filter((r) => r.mime?.startsWith("image/"));
    if (!imgs.length) {
      setMsg("ไม่พบไฟล์ภาพในผลลัพธ์ปัจจุบัน");
      return;
    }

    const zip = new JSZip();
    const manifestLines: string[] = [];
    const header = [
      "id",
      "created_at",
      "category_slug",
      "teacher_full_name",
      "training_date",
      "topic",
      "organization",
      "file_path",
      "zip_path",
      "mime",
      "size_bytes",
      "user_id",
    ];
    manifestLines.push(header.join(","));

    // จำกัด concurrency กันโหลดหนักเกิน (4–6 กำลังดี)
    await mapLimit(imgs, 4, async (r) => {
      try {
        // 1) ขอ signed URL อายุ 15 นาที
        const { data, error } = await supabase.storage
          .from("submissions")
          .createSignedUrl(r.file_path, 900);
        if (error || !data?.signedUrl)
          throw new Error(error?.message || "signed url failed");

        // 2) ดาวน์โหลดไฟล์จริง
        const resp = await fetch(data.signedUrl);
        if (!resp.ok)
          throw new Error(`fetch ${r.file_path} failed: ${resp.status}`);
        const ab = await resp.arrayBuffer();

        // 3) path ใน ZIP: <หมวด>/<ครู>/<ชื่อไฟล์จริง>
        const folderCategory = r.category_slug;
        const folderTeacher = safeZipName(r.teacher_full_name);
        const fileName = basename(r.file_path);
        const zipPath = `${folderCategory}/${folderTeacher}/${fileName}`;

        zip.file(zipPath, ab);

        // 5) เพิ่มแถวใน manifest
        const vals = [
          r.id,
          r.created_at,
          r.category_slug,
          r.teacher_full_name,
          r.training_date,
          r.topic,
          r.organization,
          r.file_path,
          zipPath,
          r.mime ?? "",
          String(r.size_bytes ?? ""),
          r.user_id,
        ].map((s) => `"${String(s).replaceAll('"', '""')}"`);
        manifestLines.push(vals.join(","));
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        const vals = [
          r.id,
          r.created_at,
          r.category_slug,
          r.teacher_full_name,
          r.training_date,
          r.topic,
          r.organization,
          r.file_path,
          "",
          r.mime ?? "",
          String(r.size_bytes ?? ""),
          r.user_id,
        ].map((s) => `"${String(s).replaceAll('"', '""')}"`);

        manifestLines.push(vals.join(",") + ',"ERROR: ' + errorMessage + '"');
      }
    });

    // 6) ใส่ manifest.csv เข้า ZIP
    // เดิม: zip.file('manifest.csv', manifestLines.join('\n'))
    zip.file("manifest.csv", "\uFEFF" + manifestLines.join("\n")); // << ใส่ BOM

    // 7) สร้าง ZIP และดาวน์โหลด
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, `certificates_images_${imgs.length}_items_${Date.now()}.zip`);

    setMsg(null);
  }

  return (
    <AdminGuard>
      <div className="mx-auto max-w-6xl p-6 space-y-4">
        <h1 className="text-2xl font-bold">Export ใบประกาศ</h1>

        {/* ฟิลเตอร์ */}
        <div className="flex flex-wrap gap-3 items-end">
          <label className="block">
            <div className="text-sm">หมวด</div>
            <select
              className="border p-2 rounded"
              value={cat}
              onChange={(e) => setCat(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <div className="text-sm">จากวันที่ (training_date)</div>
            <input
              type="date"
              className="border p-2 rounded"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="block">
            <div className="text-sm">ถึงวันที่</div>
            <input
              type="date"
              className="border p-2 rounded"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>

          {/* ค้นหาครูหลายคน + suggest */}
          <div className="block relative min-w-[260px]" ref={suggestBoxRef}>
            <div className="text-sm">ค้นหาชื่อครู (เลือกได้หลายคน)</div>
            <div className="border rounded p-1 flex flex-wrap gap-1">
              {selectedTeachers.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1 bg-gray-100 rounded px-2 py-1 text-sm"
                >
                  {name}
                  <button
                    type="button"
                    className="text-red-600"
                    onClick={() => removeTeacher(name)}
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                className="flex-1 min-w-[120px] p-1 outline-none"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onFocus={() => {
                  if (suggests.length) setOpenSuggest(true);
                }}
                placeholder={selectedTeachers.length ? "" : "เช่น สมชาย"}
                aria-autocomplete="list"
                aria-controls="teacher-suggest-list"
              />
            </div>
            {openSuggest && suggests.length > 0 && (
              <div
                id="teacher-suggest-list"
                className="absolute z-10 mt-1 w-full bg-white border rounded shadow max-h-60 overflow-auto"
                role="listbox"
              >
                {suggests.map((s) => (
                  <button
                    type="button"
                    key={s}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100"
                    role="option"
                    aria-selected={false} // Add required aria-selected attribute
                    onClick={() => addTeacher(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ปุ่มดึงข้อมูล */}
          <button onClick={fetchData} className="border px-4 py-2 rounded">
            ค้นหา (เฉพาะหมวด)
          </button>
          <button onClick={fetchAll} className="border px-4 py-2 rounded">
            Export ทั้งหมด (ทุกหมวด)
          </button>
        </div>

        {/* ปุ่มดาวน์โหลด */}
        <div className="flex flex-wrap gap-3">
          <button
            disabled={!rows.length}
            onClick={downloadCSV}
            className="border px-4 py-2 rounded bg-blue-600 text-white"
          >
            ดาวน์โหลด CSV
          </button>
          <button
            disabled={!rows.length}
            onClick={downloadCSVWithLinks}
            className="border px-4 py-2 rounded"
          >
            CSV + ลิงก์ไฟล์ (10 นาที)
          </button>
          <button
            disabled={!rows.length}
            onClick={downloadZipImagesWithCSV}
            className="border px-4 py-2 rounded"
            title="แพ็คภาพทั้งหมดในผลลัพธ์ + ใส่ manifest.csv"
          >
            ZIP (รูปภาพ + CSV)
          </button>
        </div>

        {msg && <p>{msg}</p>}
        {loading ? (
          <p>กำลังโหลด…</p>
        ) : (
          <p className="text-sm opacity-70">พบ {rows.length} รายการ</p>
        )}
      </div>
    </AdminGuard>
  );
}
