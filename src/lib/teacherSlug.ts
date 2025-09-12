export function shortHash(s: string) {
  let h = 0; for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  return Math.abs(h).toString(36).slice(0, 6);
}
export function teacherFolderSlug(fullName: string) {
  const base = fullName.trim()
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')   // ตัด non-ASCII
    .replace(/[^a-zA-Z0-9]+/g, '-') // เว้นวรรค→ขีด
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  const h = shortHash(fullName);
  return (base || 'teacher') + '-' + h; // กันเคสไทยล้วน
}
export function sanitizeFilename(filename: string): string {
  // ลบอักขระที่ไม่ปลอดภัยออก
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_')
}