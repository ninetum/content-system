/* ข้อมูลตัวอย่างสำหรับโหมดทดลอง (local) — ลบทิ้งได้ที่หน้า "ตั้งค่า" */
window.CMS_SEED = (function () {
  const day = 86400000;
  const now = Date.now();
  const at = (d, h = 9, m = 0) => {
    const t = new Date(now + d * day);
    t.setHours(h, m, 0, 0);
    return t.toISOString();
  };

  const channels = [
    { id: 'ch-fb',  name: 'ร้านเราเอง Official', platform: 'facebook',  handle: '@raoeng.official', followers: 18420, active: true,  note: 'เพจหลัก ยิงแอดประจำ' },
    { id: 'ch-tt',  name: 'RaoEng Rider',        platform: 'tiktok',    handle: '@raoeng.rider',    followers: 42130, active: true,  note: 'คลิปสั้น สายมอเตอร์ไซค์/ทริป' },
    { id: 'ch-ig',  name: 'raoeng.studio',       platform: 'instagram', handle: '@raoeng.studio',   followers: 9210,  active: true,  note: 'ภาพนิ่ง งานพุทธศิลป์' },
    { id: 'ch-yt',  name: 'RaoEng Channel',      platform: 'youtube',   handle: '@raoengchannel',   followers: 6740,  active: true,  note: 'คลิปยาว รีวิวอุปกรณ์' },
    { id: 'ch-line', name: 'LINE OA ร้านเรา',     platform: 'line',      handle: '@raoeng',          followers: 3120,  active: false, note: 'ใช้ส่งโปรฯ ลูกค้าเก่า' },
  ];

  const styles = [
    { id: 'st-1', name: 'สายลุยเป็นกันเอง', emoji: '🏍️', tone: 'เป็นกันเอง เล่าเหมือนคุยกับเพื่อนร่วมทริป', audience: 'นักขี่มอเตอร์ไซค์ อายุ 25-45', cta: 'คอมเมนต์บอกเส้นทางที่อยากให้รีวิวต่อ', prompt: 'เปิดด้วยภาพบรรยากาศ 1 ประโยค เล่าประสบการณ์จริง 3 ย่อหน้าสั้น ปิดด้วยคำถามชวนคุย ใส่อิโมจิพอประมาณ' },
    { id: 'st-2', name: 'ขายแบบไม่ยัดเยียด', emoji: '🛒', tone: 'สุภาพ ชัดเจน เน้นประโยชน์ก่อนราคา', audience: 'ลูกค้าที่กำลังเปรียบเทียบสินค้า', cta: 'ทักแชทรับส่วนลดพิเศษวันนี้', prompt: 'เริ่มจากปัญหาที่ลูกค้าเจอ ตามด้วยวิธีที่สินค้าช่วยได้ 3 ข้อ ปิดด้วยข้อเสนอและ CTA ชัดเจน' },
    { id: 'st-3', name: 'สงบ งดงาม',        emoji: '🛕', tone: 'สุภาพ อ่อนโยน ให้ความรู้เชิงศิลปะ',     audience: 'คนชอบวัด งานพุทธศิลป์ สายถ่ายภาพ', cta: 'เซฟไว้เป็นพิกัดทริปหน้า', prompt: 'บรรยายรายละเอียดงานศิลป์ที่น่าสนใจ เล่าที่มาโดยย่อ แนะนำมุมถ่ายภาพ ปิดด้วยข้อคิดสั้น ๆ' },
    { id: 'st-4', name: 'สายเทคนิค IT',      emoji: '💻', tone: 'กระชับ ตรงประเด็น มีตัวเลขอ้างอิง',     audience: 'คนสาย IT / เจ้าของธุรกิจออนไลน์', cta: 'อ่านสเต็ปเต็มในลิงก์ใต้โพสต์', prompt: 'พาดหัวบอกผลลัพธ์ที่วัดได้ ตามด้วยขั้นตอน 3-5 ข้อแบบ bullet ปิดด้วยข้อควรระวัง 1 ข้อ' },
  ];

  const media = [
    { id: 'md-1', name: 'ทริปดอยอินทนนท์-เช้าหมอกลง.jpg', url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=640', kind: 'image', tags: ['ทริป', 'ภูเขา'], size_kb: 842 },
    { id: 'md-2', name: 'บิ๊กไบค์-หน้าร้าน.jpg',            url: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=640', kind: 'image', tags: ['มอเตอร์ไซค์', 'สินค้า'], size_kb: 610 },
    { id: 'md-3', name: 'วัดเชียงใหม่-ลายปูนปั้น.jpg',       url: 'https://images.unsplash.com/photo-1528181304800-259b08848526?w=640', kind: 'image', tags: ['วัด', 'พุทธศิลป์'], size_kb: 733 },
    { id: 'md-4', name: 'ตกหมึกกลางคืน-เรือ.jpg',           url: 'https://images.unsplash.com/photo-1534254821465-c0e6a4d9a9b3?w=640', kind: 'image', tags: ['ทะเล', 'ตกปลา'], size_kb: 905 },
    { id: 'md-5', name: 'คลิปรีวิวกล่องเก็บของท้ายรถ.mp4',   url: 'https://cdn.example.com/clips/review-topbox.mp4',                  kind: 'video', tags: ['รีวิว', 'สินค้า'], size_kb: 18420 },
  ];

  const contents = [
    {
      id: 'ct-1', title: 'พากันไปดอยอินทนนท์ หมอกลงเต็มถนน', pillar: 'รีวิว / ประสบการณ์', style_id: 'st-1',
      body: 'ออกจากเชียงใหม่ตีห้า อากาศ 14 องศา หมอกลงจนมองเห็นไฟท้ายคันหน้าแค่ราง ๆ\n\nช่วงกม.ที่ 31 ขึ้นมาถึงจุดชมวิว พระอาทิตย์เพิ่งโผล่พอดี — ภาพนี้คือของจริง ไม่ได้แต่งสีเลยครับ\n\nใครจะขึ้นช่วงนี้ เตรียมเสื้อกันลมกับถุงมือกันหนาวไปด้วย แล้วออกเช้าหน่อยจะได้มุมสวยแบบนี้',
      hashtags: ['ทริปมอเตอร์ไซค์', 'ดอยอินทนนท์', 'เที่ยวเชียงใหม่'],
      channel_ids: ['ch-fb', 'ch-tt'], media_ids: ['md-1'],
      status: 'published', scheduled_at: at(-4, 7, 30), published_at: at(-4, 7, 32), author: 'ทีมคอนเทนต์', note: '',
    },
    {
      id: 'ct-2', title: 'กล่องท้ายรถ 45 ลิตร ใส่ของได้แค่ไหน', pillar: 'ขายของ / โปรโมชัน', style_id: 'st-2',
      body: 'ไปทริป 3 วัน 2 คืน ต้องขนอะไรบ้าง? เราลองยัดจริงให้ดูแล้ว\n\n- เสื้อผ้า 3 ชุด + ชุดกันฝน\n- กล้อง + ขาตั้ง\n- ชุดเครื่องมือฉุกเฉิน\n\nยังเหลือที่ใส่หมวกกันน็อคได้อีกใบ ล็อกกันขโมยได้ ติดตั้งฟรีหน้าร้าน',
      hashtags: ['กล่องท้ายรถ', 'อุปกรณ์แต่งรถ'],
      channel_ids: ['ch-fb', 'ch-ig'], media_ids: ['md-2', 'md-5'],
      status: 'scheduled', scheduled_at: at(1, 19, 0), published_at: null, author: 'ทีมคอนเทนต์', note: '',
    },
    {
      id: 'ct-3', title: 'ลายปูนปั้นวัดเก่า เล่าอะไรได้บ้าง', pillar: 'ให้ความรู้ / How-to', style_id: 'st-3',
      body: 'ลายเครือเถาที่เห็นบนซุ้มประตู ไม่ได้มีไว้สวยอย่างเดียวครับ\n\nช่างสมัยก่อนใช้ความถี่ของลายบอก "ลำดับความสำคัญ" ของพื้นที่ ยิ่งใกล้พระประธานลายยิ่งละเอียด\n\nถ้าไปถ่ายรูป ลองเก็บมุมเฉียง 45 องศาตอนแดดบ่าย เงาจะช่วยขับมิติของลายให้เด่นขึ้นมาก',
      hashtags: ['พุทธศิลป์', 'วัดสวย', 'ถ่ายภาพ'],
      channel_ids: ['ch-ig', 'ch-fb'], media_ids: ['md-3'],
      status: 'pending', scheduled_at: at(2, 9, 0), published_at: null, author: 'ทีมคอนเทนต์', note: '',
    },
    {
      id: 'ct-4', title: 'ตกหมึกคืนเดือนมืด ต้องเตรียมอะไร', pillar: 'ให้ความรู้ / How-to', style_id: 'st-1',
      body: 'คืนเดือนมืดคือช่วงที่หมึกขึ้นดีที่สุด แต่ต้องเตรียมของให้พร้อม\n\n1. ไฟล่อหมึกสีเขียว กำลังไฟพอประมาณ อย่าแรงเกิน\n2. โยะ 2-3 สี สลับจนเจอสีที่หมึกกิน\n3. ถังน้ำแข็งแยกจากถังเก็บหมึก\n\nเทคนิคเล็ก ๆ คือรอให้ไฟนิ่งอย่างน้อย 20 นาทีก่อนเริ่มตี',
      hashtags: ['ตกหมึก', 'ตกปลา', 'ทะเลไทย'],
      channel_ids: ['ch-tt', 'ch-yt'], media_ids: ['md-4'],
      status: 'draft', scheduled_at: null, published_at: null, author: 'ทีมคอนเทนต์', note: '',
    },
    {
      id: 'ct-5', title: 'สรุป 5 เครื่องมือช่วยตัดคลิปให้เร็วขึ้น 3 เท่า', pillar: 'ให้ความรู้ / How-to', style_id: 'st-4',
      body: 'ทีมเราลดเวลาตัดคลิปจาก 3 ชั่วโมงเหลือ 55 นาที ด้วย 5 ตัวนี้\n\n- ตัดช่วงเงียบอัตโนมัติ\n- ถอดเสียงเป็นซับไทยอัตโนมัติ\n- เทมเพลต transition ที่ใช้ซ้ำได้\n- ไลบรารีเสียงประกอบจัดหมวดไว้ล่วงหน้า\n- เรนเดอร์เป็นคิว ไม่ต้องนั่งเฝ้า\n\nข้อควรระวัง: ซับอัตโนมัติยังพิมพ์ชื่อเฉพาะผิดอยู่ ต้องกวาดตาตรวจก่อนปล่อยเสมอ',
      hashtags: ['ตัดต่อวิดีโอ', 'ทำคอนเทนต์', 'สายไอที'],
      channel_ids: ['ch-fb', 'ch-yt', 'ch-tt'], media_ids: [],
      status: 'published', scheduled_at: at(-9, 20, 0), published_at: at(-9, 20, 3), author: 'ทีมคอนเทนต์', note: '',
    },
    {
      id: 'ct-6', title: 'โปรฯ ต้นเดือน ลดชุดแต่งรถ 15%', pillar: 'ขายของ / โปรโมชัน', style_id: 'st-2',
      body: 'เฉพาะ 7 วันแรกของเดือนนี้ ชุดแต่งรถทุกรายการลด 15%\n\nซื้อครบ 3,000 บาท ติดตั้งฟรี พร้อมรับประกันงานติดตั้ง 6 เดือน\n\nทักแชทแจ้งรุ่นรถได้เลยครับ เดี๋ยวทีมช่างเช็กความเข้ากันให้ก่อนสั่ง',
      hashtags: ['โปรโมชัน', 'แต่งรถ'],
      channel_ids: ['ch-fb', 'ch-line'], media_ids: ['md-2'],
      status: 'approved', scheduled_at: at(3, 10, 30), published_at: null, author: 'ทีมคอนเทนต์', note: 'รออาร์ตทำภาพปกใหม่',
    },
  ];

  const stats = [
    { id: 'sv-1', content_id: 'ct-1', channel_id: 'ch-fb', views: 24180, likes: 1420, comments: 186, shares: 92,  clicks: 410, recorded_at: at(-3) },
    { id: 'sv-2', content_id: 'ct-1', channel_id: 'ch-tt', views: 86400, likes: 7320, comments: 512, shares: 641, clicks: 0,   recorded_at: at(-3) },
    { id: 'sv-3', content_id: 'ct-5', channel_id: 'ch-fb', views: 12640, likes: 690,  comments: 74,  shares: 120, clicks: 880, recorded_at: at(-8) },
    { id: 'sv-4', content_id: 'ct-5', channel_id: 'ch-yt', views: 9120,  likes: 540,  comments: 61,  shares: 33,  clicks: 240, recorded_at: at(-8) },
    { id: 'sv-5', content_id: 'ct-5', channel_id: 'ch-tt', views: 31500, likes: 2410, comments: 133, shares: 208, clicks: 0,   recorded_at: at(-8) },
  ];

  const activity = [
    { id: 'ac-1', content_id: 'ct-3', action: 'ส่งขออนุมัติ', actor: 'ทีมคอนเทนต์', note: '',                    created_at: at(-1, 14, 20) },
    { id: 'ac-2', content_id: 'ct-6', action: 'อนุมัติแล้ว',   actor: 'หัวหน้าทีม',   note: 'ภาพปกขอเป็นแนวนอน',    created_at: at(-1, 11, 5) },
    { id: 'ac-3', content_id: 'ct-1', action: 'เผยแพร่แล้ว',   actor: 'ระบบตั้งเวลา', note: 'Facebook, TikTok',     created_at: at(-4, 7, 32) },
  ];

  return { channels, styles, media, contents, stats, activity };
})();
