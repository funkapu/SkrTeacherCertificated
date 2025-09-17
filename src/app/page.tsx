"use client";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import Link from "next/link";
import logo from "./image.png";

export default function Page() {
  async function signInWithGoogle() {
    // ใช้ URL แบบ dynamic เพื่อรองรับทั้ง local และ production
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://skr-teacher-certificated.vercel.app';
    const redirectTo = `${baseUrl}/auth/callback`;

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        scopes: "email profile",
        queryParams: {
          access_type: "offline",
          prompt: "select_account",
          include_granted_scopes: "true",
          response_type: "code",
        },
      },
    });
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-white">
      <div className="max-w-sm p-6 space-y-6 text-center">
        <Image
          src={logo}
          alt="Logo"
          width={200} // ปรับขนาดตามต้องการ
          height={200} // ปรับขนาดตามต้องการ
          className="mx-auto" // จัดให้อยู่กึ่งกลาง
        />
        <h1 className="text-2xl font-bold">ระบบงานสารสนเทศ</h1>
        <button
          onClick={signInWithGoogle}
          className="w-full border px-4 py-2 rounded bg-blue-500 text-white hover:bg-red-600 transition"
        >
          ลงชื่อเข้าใช้ด้วย Google
        </button>
      </div>
    </main>
  );
}
