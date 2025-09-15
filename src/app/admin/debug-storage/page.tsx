"use client";
import { useState } from "react";
import AdminGuard from "../../components/AdminGuard";
import { supabase } from "@/lib/supabase";

const BUCKET = "submissions";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function DebugStoragePage() {
  const [input, setInput] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const append = (s: string) => setLogs((l) => [...l, s]);

  function normalizeBasePath(p: string) {
    let base = (p || "").trim().replace(/^\/+/, "");
    try {
      base = decodeURIComponent(base);
    } catch {}
    // ตัด prefix ที่ไม่ใช่ object key ทิ้ง
    const m = base.match(/\/object\/(?:public|sign)\/[^/]+\/(.+)$/);
    base = (m ? m[1] : base).replace(/^\/+/, "").replace(/^public\//, "");
    base = base.replace(/^submissions\//, "");
    return base;
  }

  async function listPrefix(prefix: string) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefix || "", { limit: 1000 });
    if (error) {
      append(`list('${prefix}') error: ${error.message}`);
      return [];
    }
    return (data ?? []) as Array<{ name: string }>;
  }

  function isUrlLike(s: string) {
    return /^https?:\/\//i.test(s);
  }

  async function tryCreateSignedUrl(key: string) {
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(key, 300);
      if (error || !data?.signedUrl) {
        append(` -> ${key} : error = ${String(error?.message ?? "no url")}`);
        return null;
      }
      append(` -> ${key} : OK (signedUrl length=${data.signedUrl.length})`);
      return data.signedUrl;
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      append(` -> ${key} : exception = ${errorMsg}`);
      return null;
    }
  }

  async function run() {
    setLogs([]);
    const raw = (input || "").trim();
    if (!raw) return append("empty input");

    // Removed supabaseUrl logging (not accessible in newer versions)
    append(`Starting debug check for: ${raw}`);
    if (isUrlLike(raw)) {
      append("Input is URL → opening directly");
      window.open(raw, "_blank");
      return;
    }

    const base = normalizeBasePath(raw);
    append(`normalized base: ${base}`);

    // สร้าง candidates เบื้องต้น
    const candidates = new Set<string>([
      base,
      base.replace(/^\/+/, ""),
      encodeURI(base),
      base.replace(/^public\//, ""),
    ]);

    // ถ้า path เป็น thai/<uuid>/... ให้ลองสลับ uuid ทุกตัวที่อยู่ใต้ thai/
    const segs = base.split("/");
    if (segs.length >= 3 && segs[0] === "thai" && UUID_RE.test(segs[1])) {
      const wrongUuid = segs[1];
      const rest = segs.slice(2).join("/");

      append(
        `detected pattern thai/<uuid>/${rest}. Listing 'thai/' to try swapping UUID...`
      );
      const firstLevel = await listPrefix("thai");
      const dirs = firstLevel.map((x) => x.name).filter((n) => UUID_RE.test(n));

      append(`thai/ contains ${dirs.length} UUID dirs`);
      // ลองสลับทุก uuid ภายใต้ thai/
      for (const dir of dirs) {
        if (dir === wrongUuid) continue;
        candidates.add(`thai/${dir}/${rest}`);
      }

      // เผื่อใช้ user.id ปัจจุบัน
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (uid && uid !== wrongUuid) {
        candidates.add(`thai/${uid}/${rest}`);
        append(`added thai/${uid}/${rest} from current user.id`);
      }
    }

    // log candidates
    append(`candidates (${candidates.size}):`);
    for (const k of candidates) append(` - ${k}`);

    // ยิงทีละ candidate
    for (const k of candidates) {
      const ok = await tryCreateSignedUrl(k.replace(/^\/+/, ""));
      if (ok) {
        append(`SUCCESS: ${k}`);
        window.open(ok, "_blank");
        return;
      }
    }

    // ถ้าไม่เจอ: list โฟลเดอร์แม่
    const parent = base.replace(/\/[^/]+$/, "");
    append(`\nlisting parent: '${parent}'`);
    const listed = await listPrefix(parent);
    append(`list count: ${listed.length}`);
    append(
      `list sample: ${
        listed
          .slice(0, 50)
          .map((x) => x.name)
          .join(", ") || "(empty)"
      }`
    );

    // ถ้ายังว่าง ลอง list base และ base+'/' เผื่อ path เป็นโฟลเดอร์
    if (listed.length === 0) {
      append(`parent empty → list('${base}') & list('${base}/')`);
      const l2 = await listPrefix(base);
      append(`list('${base}') count: ${l2.length}`);
      const l3 = await listPrefix(base + "/");
      append(`list('${base}/') count: ${l3.length}`);
    }

    // ค้นใน DB ว่ามี file_path ที่ขึ้นต้นเหมือน base ไหม
    append(
      `\nquery DB: certificates where file_path ilike '${base}%' (limit 50)`
    );
    const { data: certData, error: certErr } = await supabase
      .from("certificates")
      .select("id, file_path, created_at")
      .ilike("file_path", `${base}%`)
      .limit(50);

    if (certErr) {
      append(`certificates query error: ${String(certErr.message)}`);
      return;
    }
    const certs = (certData ?? []) as Array<{ id: string; file_path: string }>;
    append(`certificates rows: ${certs.length}`);
    for (const c of certs.slice(0, 50)) append(` - ${c.file_path}`);

    // ลอง createSignedUrl ทีละค่าใน DB
    if (certs.length) {
      append("\ntry createSignedUrl for each DB file_path:");
      for (const c of certs) {
        const fp = normalizeBasePath(c.file_path);
        append(` - ${fp}`);
        const ok = await tryCreateSignedUrl(fp);
        if (ok) {
          append(`SUCCESS (from DB path): ${fp}`);
          window.open(ok, "_blank");
          return;
        }
      }
    }

    // แผนสำรอง: ค้นหาตาม token ของชื่อไฟล์แบบ BFS
    try {
      const filenameToken = base.split("/").pop() || base;
      const topLevel = "thai"; // เรารู้ว่าไฟล์ส่วนใหญ่เริ่มด้วย thai/
      append(
        `\nBFS search: token='${filenameToken}' under top-level '${topLevel}'`
      );

      const queue: string[] = [topLevel];
      const found: string[] = [];
      let visited = 0;
      const MAX_VISIT = 200; // กันลูปยาวไป

      while (queue.length && visited < MAX_VISIT) {
        const prefix = queue.shift() || "";
        const items = await listPrefix(prefix);
        append(` list('${prefix}') = ${items.length}`);

        for (const it of items) {
          const candidatePath = prefix ? `${prefix}/${it.name}` : it.name;
          // heuristic: ไม่มีจุด → น่าจะเป็น "โฟลเดอร์" ให้ enqueue
          if (!it.name.includes(".") && visited < MAX_VISIT)
            queue.push(candidatePath);
          // เจอชื่อไฟล์ที่น่าจะเกี่ยว
          if (it.name === filenameToken || it.name.includes(filenameToken)) {
            found.push(candidatePath);
            append(`  found candidate: ${candidatePath}`);
          }
        }
        visited++;
      }

      if (!found.length) {
        append("BFS: no matches");
      } else {
        append(`BFS: ${found.length} matches`);
        for (const p of found.slice(0, 20)) {
          append(` try found: ${p}`);
          const ok = await tryCreateSignedUrl(p.replace(/^\/+/, ""));
          if (ok) {
            append(`SUCCESS (from BFS): ${p}`);
            window.open(ok, "_blank");
            return;
          }
        }
      }
    } catch (ex: unknown) {
      const errorMsg = ex instanceof Error ? ex.message : String(ex);
      append(`BFS exception: ${errorMsg}`);
    }

    append("\nDONE: not found. Verify bucket/key in Storage UI vs DB.");
  }

  async function scanDB() {
    setLogs([]);
    append("Starting DB scan (up to 1000 rows)...");
    try {
      const { data: rows, error } = await supabase
        .from("certificates")
        .select("id,file_path")
        .limit(1000);
      if (error) {
        append(`DB query error: ${String(error.message)}`);
        return;
      }
      const items = (rows ?? []) as Array<{ id: string; file_path: string }>;
      append(`DB rows to check: ${items.length}`);

      let ok = 0,
        fail = 0;
      const failedSample: string[] = [];

      for (const it of items) {
        const fp = normalizeBasePath(it.file_path);
        const { data: d, error: e } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(fp, 60);
        if (e || !d?.signedUrl) {
          fail++;
          if (failedSample.length < 30) {
            failedSample.push(
              `${it.id}: ${fp} -> ${String(e?.message ?? "no url")}`
            );
          }
        } else {
          ok++;
        }
      }
      append(`Scan complete. ok=${ok}, fail=${fail}`);
      if (failedSample.length) {
        append("Failed samples:");
        failedSample.forEach((s) => append(s));
      }
    } catch (ex: unknown) {
      const errorMsg = ex instanceof Error ? ex.message : String(ex);
      append(`Scan error: ${errorMsg}`);
    }
  }

  return (
    <AdminGuard>
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-xl font-bold mb-4">Debug Storage</h1>
        <p className="mb-2">
          ใส่ <code>file_path</code> ที่เก็บใน DB แล้วกด Run
          เพื่อตรวจและหาคีย์จริง
        </p>

        <div className="flex gap-2 mb-4">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="เช่น thai/50b18d.../teacher-xxx/1757..._Screenshot__9_.png"
            className="flex-1 border p-2 rounded"
          />
          <button
            onClick={run}
            className="px-3 py-2 bg-blue-600 text-white rounded"
          >
            Run
          </button>
          <button
            onClick={scanDB}
            className="px-3 py-2 bg-red-600 text-white rounded"
          >
            Scan DB
          </button>
          <button
            onClick={() => setLogs([])}
            className="px-3 py-2 bg-slate-200 rounded"
          >
            Clear
          </button>
        </div>

        <div className="bg-black text-white p-3 rounded h-80 overflow-auto">
          {logs.map((l, i) => (
            <div key={i} className="text-sm font-mono whitespace-pre-wrap">
              {l}
            </div>
          ))}
        </div>
      </div>
    </AdminGuard>
  );
}
