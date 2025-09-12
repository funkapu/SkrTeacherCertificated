"use client";
import { useState } from "react";
import { supabase } from "../../lib/supabase";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `https://skr-teacher-certificated.vercel.app/auth/callback`,
        },
      });
      if (error) throw error;
      setMsg("ส่งลิงก์เข้าที่อีเมลแล้ว ตรวจสอบกล่องจดหมาย/สแปมได้เลย ✅");
    } catch (error: unknown) {
      if (error instanceof Error) {
        setMsg(`❌ ล้มเหลว: ${error.message}`);
      } else {
        setMsg("❌ ล้มเหลว: เกิดข้อผิดพลาดที่ไม่รู้จัก");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm p-6 space-y-4">
      <h1 className="text-xl font-bold">เข้าสู่ระบบ</h1>
      <form onSubmit={sendLink} className="space-y-3">
        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border p-2 rounded"
          required
        />
        <button disabled={loading} className="border px-4 py-2 rounded">
          {loading ? "กำลังส่งลิงก์…" : "ส่งลิงก์เข้าสู่ระบบ"}
        </button>
      </form>
      {msg && <p>{msg}</p>}
      <div>
        <Link
          href="/"
          className="inline-block px-4 py-2 rounded bg-blue-600 text-white"
        >
          กลับหน้าแรก
        </Link>
      </div>
    </div>
  );
}
