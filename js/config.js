/* ค่าตั้งต้นของระบบ + การเชื่อมต่อ Supabase
 * โหมดการทำงาน:
 *   'local'    = เก็บข้อมูลในเครื่อง (localStorage) ใช้ลองระบบได้ทันที ไม่ต้องตั้งค่าอะไร
 *   'supabase' = เก็บข้อมูลบน Supabase จริง (ใส่ URL + anon key ที่หน้า "ตั้งค่า")
 *
 * anon key ใส่ฝั่ง client ได้ (ออกแบบมาให้ public) แต่ต้องเปิด RLS ทุกตาราง
 * ห้ามนำ service_role key มาใส่ในไฟล์นี้เด็ดขาด
 */
window.CMS_CONFIG = {
  appName: 'ระบบบริหารคอนเทนต์',
  appShort: 'Content Hub',
  storageKey: 'cms.db.v1',
  configKey: 'cms.config.v1',

  // โปรเจกต์จริงของระบบนี้ — anon key ออกแบบมาให้เปิดเผยได้ ความปลอดภัยอยู่ที่ RLS
  // (ห้ามเอา service_role key มาใส่ตรงนี้เด็ดขาด)
  supabaseUrl: 'https://oxfonqvrquqmazzhmlnf.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94Zm9ucXZycXVxbWF6emhtbG5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1NDA1MzcsImV4cCI6MjEwNTExNjUzN30.fJ1eJHUpaKN1Aqf0Mf6IVCEbzj1Cybl1xaU0SoojJwQ',

  platforms: [
    { id: 'facebook',  name: 'Facebook',  icon: '📘', color: '#3987e5' },
    { id: 'instagram', name: 'Instagram', icon: '📸', color: '#d95926' },
    { id: 'tiktok',    name: 'TikTok',    icon: '🎵', color: '#199e70' },
    { id: 'youtube',   name: 'YouTube',   icon: '▶️', color: '#d03b3b' },
    { id: 'line',      name: 'LINE OA',   icon: '💬', color: '#0ca30c' },
    { id: 'website',   name: 'เว็บไซต์',   icon: '🌐', color: '#8494ab' },
  ],

  statuses: [
    { id: 'draft',     name: 'ร่าง',        icon: '📝', cls: 'badge-draft' },
    { id: 'pending',   name: 'รออนุมัติ',    icon: '⏳', cls: 'badge-pending' },
    { id: 'approved',  name: 'อนุมัติแล้ว',  icon: '👍', cls: 'badge-approved' },
    { id: 'scheduled', name: 'ตั้งเวลาแล้ว', icon: '📅', cls: 'badge-scheduled' },
    { id: 'published', name: 'เผยแพร่แล้ว',  icon: '✅', cls: 'badge-published' },
    { id: 'rejected',  name: 'ตีกลับ',      icon: '⛔', cls: 'badge-rejected' },
  ],

  pillars: [
    'ขายของ / โปรโมชัน',
    'ให้ความรู้ / How-to',
    'รีวิว / ประสบการณ์',
    'เล่าเรื่องแบรนด์',
    'คอนเทนต์ตามกระแส',
    'ถาม-ตอบ / สร้าง Engagement',
  ],
};
