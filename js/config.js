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

  // หน้ารวมลิงก์ (bio.html) — แก้ข้อความตรงนี้ให้เป็นของร้านคุณได้เลย
  bio: {
    title: 'ของดีที่คัดมาแล้ว',
    subtitle: 'รีวิวจริง ใช้เอง เลือกมาให้เฉพาะตัวที่คุ้ม',
    emoji: '🛍️',
    footer: 'กดสั่งผ่านลิงก์ในหน้านี้ ผมได้ค่าคอมจากร้านค้า คุณจ่ายเท่าเดิมครับ',
  },

  // โมเดลรายได้ที่ระบบรองรับ
  productTypes: [
    { id: 'affiliate', name: 'affiliate (ได้คอม)', icon: '🤝', hint: 'ของคนอื่น เราได้ค่าคอมเป็น % หรือจำนวนคงที่ต่อออเดอร์' },
    { id: 'own',       name: 'ขายเอง (ทัวร์/สินค้า)', icon: '🎫', hint: 'ของเราเอง คิดกำไรจากราคาขายลบต้นทุน' },
  ],

  merchants: [
    { id: 'shopee',     name: 'Shopee',      icon: '🛍️' },
    { id: 'lazada',     name: 'Lazada',      icon: '🛒' },
    { id: 'tiktokshop', name: 'TikTok Shop', icon: '🎵' },
    { id: 'other',      name: 'อื่น ๆ',      icon: '🔗' },
  ],

  // สถานะคอม — สำคัญมากสำหรับสาย affiliate เพราะคอมถูกยกเลิกได้
  saleStatuses: [
    { id: 'รอยืนยัน',  icon: '⏳', cls: 'badge-pending',   counts: false, hint: 'ยังไม่แน่ ลูกค้าคืนของได้อยู่' },
    { id: 'ยืนยันแล้ว', icon: '👍', cls: 'badge-approved',  counts: true,  hint: 'แพลตฟอร์มยืนยันแล้ว รอโอน' },
    { id: 'จ่ายแล้ว',   icon: '✅', cls: 'badge-published', counts: true,  hint: 'เงินเข้ากระเป๋าแล้ว' },
    { id: 'ยกเลิก',    icon: '⛔', cls: 'badge-rejected',  counts: false, hint: 'ลูกค้าคืนของ/ยกเลิกออเดอร์' },
  ],

  // ฟอร์แมตของคอนเทนต์ที่แตกออกมา
  formats: [
    { id: 'คลิปสั้น',    icon: '🎬', job: true,  hint: 'ตัดจากคลิปยาว 15-45 วินาที' },
    { id: 'โพสต์ยาว',    icon: '📝', job: false, hint: 'เล่าเรื่องแบบมีรายละเอียด' },
    { id: 'ภาพชุด',      icon: '🖼️', job: false, hint: 'carousel 5 สไลด์ อ่านจบใน 10 วินาที' },
    { id: 'คอมเมนต์แรก', icon: '💬', job: false, hint: 'ที่ใส่ลิงก์ — กัน Facebook ลดการมองเห็น' },
    { id: 'โพสต์ซ้ำ',    icon: '🔁', job: false, hint: 'มุมใหม่จากเรื่องเดิม ปล่อยอีก 2 สัปดาห์' },
  ],

  /* สูตรแตกคอนเทนต์
   * dayOffset = ปล่อยห่างจากชิ้นแรกกี่วัน (ความถี่สำคัญกว่าความสมบูรณ์แบบ)
   */
  recipes: [
    {
      id: 'full',
      name: 'คลิปยาว → ชุดเต็ม',
      desc: 'อัดยาวครั้งเดียว 10 นาที ได้ของลง 2 สัปดาห์',
      items: [
        { format: 'คลิปสั้น',    angle: 'ฮุกปัญหา — 3 วินาทีแรกต้องโดน', dayOffset: 0 },
        { format: 'คอมเมนต์แรก', angle: 'ใส่ลิงก์สินค้าใต้โพสต์',        dayOffset: 0 },
        { format: 'คลิปสั้น',    angle: 'โชว์ของจริง ใช้งานจริง',        dayOffset: 2 },
        { format: 'โพสต์ยาว',    angle: 'เล่าประสบการณ์ + ข้อดี 3 ข้อ',   dayOffset: 4 },
        { format: 'ภาพชุด',      angle: 'สรุปให้อ่านจบใน 10 วินาที',     dayOffset: 7 },
        { format: 'คลิปสั้น',    angle: 'เทียบความคุ้ม / ตอบข้อกังขา',   dayOffset: 10 },
      ],
    },
    {
      id: 'sell',
      name: 'รีวิวสินค้า → ชุดขาย',
      desc: 'ดันสินค้าตัวเดียวให้ครบมุม ตั้งแต่สนใจจนกดซื้อ',
      items: [
        { format: 'โพสต์ยาว',    angle: 'รีวิวจากการใช้จริง',          dayOffset: 0 },
        { format: 'คอมเมนต์แรก', angle: 'ใส่ลิงก์สินค้า',              dayOffset: 0 },
        { format: 'คลิปสั้น',    angle: 'เดโมให้เห็นกับตา',            dayOffset: 2 },
        { format: 'โพสต์ยาว',    angle: 'ตอบคำถามที่คนถามบ่อย 3 ข้อ',  dayOffset: 5 },
        { format: 'โพสต์ซ้ำ',    angle: 'เตือนว่าโปรใกล้หมด / ของใกล้หมด', dayOffset: 9 },
      ],
    },
    {
      id: 'light',
      name: 'แตกสั้น ๆ',
      desc: 'เอาแค่พอมีของลงต่อเนื่อง ไม่ต้องเยอะ',
      items: [
        { format: 'คลิปสั้น',    angle: 'ตัดช่วงที่ดีที่สุดออกมา', dayOffset: 0 },
        { format: 'คอมเมนต์แรก', angle: 'ใส่ลิงก์สินค้า',          dayOffset: 0 },
        { format: 'โพสต์ซ้ำ',    angle: 'เล่าใหม่ในมุมอื่น',       dayOffset: 6 },
      ],
    },
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
