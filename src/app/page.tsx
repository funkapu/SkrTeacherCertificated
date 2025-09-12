"use client";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import logo from "./image.png";

export default function Page() {
  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: "email profile",
      },
    });
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="max-w-sm p-6 space-y-6 text-center">
        <Image
          src={logo}
          alt="Logo"
          width={200} // ปรับขนาดตามต้องการ
          height={200} // ปรับขนาดตามต้องการ
          className="mx-auto" // จัดให้อยู่กึ่งกลาง
        />
        <h1 className="text-2xl font-bold">
          ศูนย์เทคโนโลยีสารสนเทศ โรงเรียนสวนกุหลาบวิทยาลัยรังสิต
        </h1>
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
