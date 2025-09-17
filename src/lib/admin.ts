// อีเมลแอดมินพิเศษ (เข้าถึงได้ทุกอย่าง)
export const ADMIN_EMAILS = ['funkfuze@gmail.com']

// โดเมนที่อนุญาตให้เข้าถึงระบบ
export const ALLOWED_DOMAINS = ['skr.ac.th']

// ฟังก์ชันตรวจสอบสิทธิ์การเข้าถึง
export function isAuthorizedUser(email: string | null): boolean {
  if (!email) return false

  // ตรวจสอบอีเมลแอดมินพิเศษ
  if (ADMIN_EMAILS.includes(email)) {
    return true
  }

  // ตรวจสอบโดเมนที่อนุญาต
  const domain = email.split('@')[1]
  if (domain && ALLOWED_DOMAINS.includes(domain)) {
    return true
  }

  return false
}

// ฟังก์ชันตรวจสอบสิทธิ์แอดมิน
export function isAdminUser(email: string | null): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email)
}