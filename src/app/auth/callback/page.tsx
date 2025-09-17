"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { isAuthorizedUser } from "@/lib/admin";

export default function CallbackPage() {
  const [msg, setMsg] = useState("กำลังยืนยันตัวตน…");

  useEffect(() => {
    // ถ้า OAuth สำเร็จ Supabase จะตั้ง session ให้แล้ว
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        const userEmail = data.user.email || null;

        // ตรวจสอบสิทธิ์การเข้าถึง
        if (isAuthorizedUser(userEmail)) {
          setMsg("✅ เข้าสู่ระบบสำเร็จ กำลังพาไปหน้าค้นหา…");
          // ใช้ window.location แทน router เพื่อหลีกเลี่ยงปัญหา hash fragment
          setTimeout(() => {
            window.location.href = "/search";
          }, 800);
        } else {
          setMsg("❌ อีเมลนี้ไม่ได้รับอนุญาตให้เข้าถึงระบบ");
          // ออกจากระบบหลังจากแสดงข้อความ
          setTimeout(() => {
            supabase.auth.signOut();
            window.location.href = "/";
          }, 3000);
        }
      } else {
        setMsg("❌ ลิงก์ไม่ถูกต้องหรือหมดอายุ");
        setTimeout(() => {
          window.location.href = "/";
        }, 2000);
      }
    });
  }, []);

  return <div className="p-6 text-center">{msg}</div>;
}
