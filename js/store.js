/* ชั้นข้อมูล (Data layer)
 * ใช้ API ชุดเดียวกันทั้งโหมด local และ supabase — ส่วน UI ไม่ต้องรู้ว่าข้อมูลอยู่ที่ไหน
 */
window.Store = (function () {
  const CFG = window.CMS_CONFIG;

  // ชื่อ collection ในโค้ด -> ชื่อตารางจริงใน Supabase
  const TABLES = {
    channels:  'channels',
    styles:    'styles',
    media:     'media_assets',
    contents:  'contents',
    stats:     'content_stats',
    activity:  'activity_log',
    editJobs:  'edit_jobs',
    products:  'products',
    links:     'tracked_links',
    clicks:    'link_clicks',
    sales:     'sales',
  };

  const uid = (p) => `${p}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;

  const state = {
    mode: 'local',      // 'local' | 'supabase'
    client: null,
    url: '',
    key: '',
    lastError: '',
    session: null,      // เซสชันผู้ใช้ (เฉพาะโหมด supabase)
    db: null,           // แคชข้อมูลในหน่วยความจำ (ใช้เป็นแหล่งจริงในโหมด local)
  };

  /* ---------- localStorage ---------- */
  function readLocal() {
    try {
      const raw = localStorage.getItem(CFG.storageKey);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('อ่านข้อมูลในเครื่องไม่สำเร็จ:', e);
    }
    return null;
  }

  function writeLocal() {
    if (state.mode !== 'local') return;
    try {
      localStorage.setItem(CFG.storageKey, JSON.stringify(state.db));
    } catch (e) {
      console.warn('บันทึกข้อมูลลงเครื่องไม่สำเร็จ:', e);
    }
  }

  function emptyDb() {
    return {
      channels: [], styles: [], media: [], contents: [], stats: [], activity: [],
      editJobs: [], products: [], links: [], clicks: [], sales: [],
    };
  }

  function seedDb() {
    const s = window.CMS_SEED;
    return {
      channels: s.channels.map((x) => ({ ...x })),
      styles:   s.styles.map((x) => ({ ...x })),
      media:    s.media.map((x) => ({ ...x })),
      contents: s.contents.map((x) => ({ ...x })),
      stats:    s.stats.map((x) => ({ ...x })),
      activity: s.activity.map((x) => ({ ...x })),
      editJobs: [],
      products: (s.products || []).map((x) => ({ ...x })),
      links:    [],
      clicks:   (s.clicks || []).map((x) => ({ ...x })),
      sales:    (s.sales || []).map((x) => ({ ...x })),
    };
  }

  /* ---------- config ---------- */
  function loadConfig() {
    // มีค่าฝังไว้ในโค้ด = ใช้ฐานข้อมูลจริงตั้งแต่เปิดหน้าแรก (ผู้ใช้ยังสลับเป็นโหมดทดลองได้)
    const preset = CFG.supabaseUrl && CFG.supabaseAnonKey;
    let cfg = {
      mode: preset ? 'supabase' : 'local',
      url: CFG.supabaseUrl || '',
      key: CFG.supabaseAnonKey || '',
    };
    try {
      const raw = localStorage.getItem(CFG.configKey);
      if (raw) cfg = { ...cfg, ...JSON.parse(raw) };
    } catch (e) { /* ใช้ค่าเริ่มต้น */ }
    return cfg;
  }

  function saveConfig(cfg) {
    try { localStorage.setItem(CFG.configKey, JSON.stringify(cfg)); } catch (e) { /* ไม่ critical */ }
  }

  function makeClient(url, key) {
    if (!url || !key) return null;
    if (!window.supabase) { state.lastError = 'โหลดไลบรารี Supabase ไม่สำเร็จ'; return null; }
    return window.supabase.createClient(url, key);
  }

  /* ---------- โหลดข้อมูลทั้งชุด ---------- */
  async function loadAll() {
    if (state.mode === 'supabase' && state.client) {
      const db = emptyDb();
      for (const [name, table] of Object.entries(TABLES)) {
        const { data, error } = await state.client.from(table).select('*');
        if (error) {
          state.lastError = `อ่านตาราง ${table} ไม่สำเร็จ: ${error.message}`;
          throw new Error(state.lastError);
        }
        db[name] = data || [];
      }
      state.db = db;
      return db;
    }

    // โหมด local
    state.db = readLocal() || seedDb();
    for (const k of Object.keys(emptyDb())) if (!state.db[k]) state.db[k] = [];
    writeLocal();
    return state.db;
  }

  /* ---------- CRUD ---------- */
  async function create(name, row) {
    const record = { ...row };
    if (!record.id) record.id = uid(name.slice(0, 2));
    if (!record.created_at) record.created_at = new Date().toISOString();

    if (state.mode === 'supabase' && state.client) {
      const payload = { ...record };
      delete payload.id;                       // ให้ฐานข้อมูลสร้าง uuid เอง
      const { data, error } = await state.client.from(TABLES[name]).insert(payload).select().single();
      if (error) throw new Error(`บันทึกไม่สำเร็จ: ${error.message}`);
      state.db[name].push(data);
      return data;
    }

    state.db[name].push(record);
    writeLocal();
    return record;
  }

  async function update(name, id, patch) {
    const body = { ...patch, updated_at: new Date().toISOString() };

    if (state.mode === 'supabase' && state.client) {
      const { data, error } = await state.client.from(TABLES[name]).update(body).eq('id', id).select().single();
      if (error) throw new Error(`แก้ไขไม่สำเร็จ: ${error.message}`);
      const i = state.db[name].findIndex((r) => r.id === id);
      if (i > -1) state.db[name][i] = data;
      return data;
    }

    const i = state.db[name].findIndex((r) => r.id === id);
    if (i < 0) throw new Error('ไม่พบรายการที่ต้องการแก้ไข');
    state.db[name][i] = { ...state.db[name][i], ...body };
    writeLocal();
    return state.db[name][i];
  }

  async function remove(name, id) {
    if (state.mode === 'supabase' && state.client) {
      const { error } = await state.client.from(TABLES[name]).delete().eq('id', id);
      if (error) throw new Error(`ลบไม่สำเร็จ: ${error.message}`);
    }
    state.db[name] = state.db[name].filter((r) => r.id !== id);
    writeLocal();
  }

  /* ---------- ลิงก์ติดตามผล ---------- */
  function newCode() {
    // 6 ตัว พอสำหรับหลักล้านลิงก์ และสั้นพอที่จะพิมพ์ตามได้
    const chars = 'abcdefghijkmnpqrstuvwxyz23456789';   // ตัดตัวที่สับสน (l, o, 0, 1)
    let out = '';
    for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  async function createLink({ content_id, channel_id, product_id, target_url, label }) {
    if (!target_url) throw new Error('ยังไม่มีปลายทางของลิงก์ (ใส่ลิงก์สินค้าหรือหน้าร้านก่อน)');

    let code = newCode();
    for (let i = 0; i < 5; i++) {
      if (!state.db.links.some((l) => l.code === code)) break;
      code = newCode();
    }

    return create('links', {
      code, content_id: content_id || null, channel_id: channel_id || null,
      product_id: product_id || null, target_url, label: label || '',
    });
  }

  // ที่อยู่เต็มของลิงก์ที่เอาไปแปะในโพสต์
  function linkUrl(code) {
    if (state.mode === 'supabase' && state.url) {
      return `${state.url.replace(/\/$/, '')}/functions/v1/r/${code}`;
    }
    return `${window.location.origin}/r/${code}`;   // โหมดทดลอง — ไว้ดูหน้าตาเฉย ๆ
  }

  /* ---------- โพสต์จริงผ่าน Edge Function ----------
   * หน้าเว็บไม่เคยเห็น access token ของ Facebook/IG/LINE เลย
   * แค่ส่งคำสั่งพร้อมเซสชันของผู้ใช้ไปให้ฝั่งเซิร์ฟเวอร์เป็นคนยิง API
   */
  async function publishNow(contentId, channelIds) {
    if (state.mode !== 'supabase' || !state.client) {
      throw new Error('ต้องเชื่อม Supabase และเข้าสู่ระบบก่อนถึงจะโพสต์ผ่าน API ได้ครับ');
    }
    if (!state.session) throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');

    const res = await fetch(`${state.url.replace(/\/$/, '')}/functions/v1/publish-post`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: state.key,
        Authorization: `Bearer ${state.session.access_token}`,
      },
      body: JSON.stringify({ content_id: contentId, channel_ids: channelIds || undefined }),
    });

    let data = {};
    try { data = await res.json(); } catch { /* ตอบกลับไม่ใช่ JSON */ }

    if (res.status === 404) {
      throw new Error('ยังไม่ได้ deploy ฟังก์ชัน publish-post (รัน: supabase functions deploy publish-post)');
    }
    if (!res.ok && !data.results) {
      throw new Error(data.error || `โพสต์ไม่สำเร็จ (HTTP ${res.status})`);
    }
    await loadAll();
    return data;
  }

  /* ---------- ทดสอบการเชื่อมต่อ ---------- */
  async function testConnection(url, key) {
    const client = makeClient(url, key);
    if (!client) return { ok: false, message: state.lastError || 'กรอก URL และ anon key ให้ครบก่อนครับ' };
    const { error } = await client.from(TABLES.channels).select('id', { count: 'exact', head: true });
    if (error) return { ok: false, message: `เชื่อมต่อไม่สำเร็จ: ${error.message}` };
    return { ok: true, message: 'เชื่อมต่อ Supabase สำเร็จ อ่านตาราง channels ได้' };
  }

  /* ---------- ระบบล็อกอิน (เฉพาะโหมด supabase) ----------
   * โหมดทดลองไม่ต้องล็อกอิน เพราะข้อมูลอยู่ในเบราว์เซอร์เครื่องนั้นอยู่แล้ว
   * ส่วนโหมด supabase ต้องมีเซสชัน เพราะ policy ใน schema.sql เปิดให้เฉพาะ authenticated
   */
  async function readSession() {
    if (!state.client) { state.session = null; return null; }
    const { data, error } = await state.client.auth.getSession();
    if (error) { state.lastError = error.message; state.session = null; return null; }
    state.session = data.session || null;
    return state.session;
  }

  async function signIn(email, password) {
    if (!state.client) throw new Error('ยังไม่ได้เชื่อม Supabase — ไปตั้งค่าที่หน้า “ตั้งค่าระบบ” ก่อนครับ');
    const { data, error } = await state.client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(translateAuthError(error.message));
    state.session = data.session;
    await loadAll();
    return state.session;
  }

  async function signInWithLink(email) {
    if (!state.client) throw new Error('ยังไม่ได้เชื่อม Supabase — ไปตั้งค่าที่หน้า “ตั้งค่าระบบ” ก่อนครับ');
    const { error } = await state.client.auth.signInWithOtp({
      email, options: { emailRedirectTo: window.location.origin + window.location.pathname },
    });
    if (error) throw new Error(translateAuthError(error.message));
  }

  // เข้าสู่ระบบด้วยบัญชี Google (Gmail)
  // ต้องเปิด provider Google ใน Supabase Dashboard → Authentication → Sign In / Providers ก่อน
  async function signInWithGoogle() {
    if (!state.client) throw new Error('ยังไม่ได้เชื่อม Supabase — ไปตั้งค่าที่หน้า “ตั้งค่าระบบ” ก่อนครับ');
    const { error } = await state.client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    if (error) throw new Error(translateAuthError(error.message));
    // เบราว์เซอร์จะถูกพาไปหน้า Google แล้วเด้งกลับมาที่เว็บนี้พร้อมเซสชัน
  }

  async function resetPassword(email) {
    if (!state.client) throw new Error('ยังไม่ได้เชื่อม Supabase ครับ');
    const { error } = await state.client.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname,
    });
    if (error) throw new Error(translateAuthError(error.message));
  }

  async function signOut() {
    if (state.client) await state.client.auth.signOut();
    state.session = null;
    state.db = emptyDb();
  }

  function onAuthChange(cb) {
    if (!state.client) return;
    state.client.auth.onAuthStateChange((_event, session) => {
      state.session = session || null;
      cb(state.session);
    });
  }

  // แปลข้อความ error ของ Supabase เป็นไทยเฉพาะเคสที่เจอบ่อย
  function translateAuthError(msg) {
    const m = (msg || '').toLowerCase();
    if (m.includes('invalid login credentials')) return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
    if (m.includes('email not confirmed')) return 'อีเมลนี้ยังไม่ได้ยืนยัน — เช็กกล่องจดหมายก่อนนะครับ';
    if (m.includes('rate limit') || m.includes('too many')) return 'ขอบ่อยเกินไป รอสักครู่แล้วลองใหม่ครับ';
    if (m.includes('signups not allowed')) return 'ระบบปิดการสมัครเอง — ให้แอดมินเพิ่มผู้ใช้ให้ที่ Supabase Dashboard';
    if (m.includes('provider is not enabled')) return 'ยังไม่ได้เปิดการเข้าสู่ระบบด้วย Google ใน Supabase (Authentication → Providers)';
    return msg;
  }

  /* ---------- init ---------- */
  async function init() {
    const cfg = loadConfig();
    state.url = cfg.url;
    state.key = cfg.key;
    if (cfg.mode === 'supabase' && cfg.url && cfg.key) {
      state.client = makeClient(cfg.url, cfg.key);
      state.mode = state.client ? 'supabase' : 'local';
    } else {
      state.mode = 'local';
    }

    if (state.mode === 'supabase') {
      await readSession();
      if (!state.session) {      // ยังไม่ล็อกอิน — ยังไม่ต้องดึงข้อมูล
        state.db = emptyDb();
        return state;
      }
    }

    await loadAll();
    return state;
  }

  async function switchMode(mode, url, key) {
    if (mode === 'supabase') {
      const client = makeClient(url, key);
      if (!client) throw new Error(state.lastError || 'กรอก URL และ anon key ให้ครบก่อนครับ');
      state.client = client;
    }
    state.mode = mode;
    state.url = url || '';
    state.key = key || '';
    saveConfig({ mode, url: state.url, key: state.key });

    if (mode === 'supabase') {
      await readSession();
      if (!state.session) { state.db = emptyDb(); return state; }
    } else {
      state.session = null;
    }

    await loadAll();
    return state;
  }

  function resetLocal(withSeed) {
    state.db = withSeed ? seedDb() : emptyDb();
    writeLocal();
    return state.db;
  }

  function exportJson() {
    return JSON.stringify(state.db, null, 2);
  }

  async function importJson(text) {
    const parsed = JSON.parse(text);
    const db = emptyDb();
    for (const k of Object.keys(db)) if (Array.isArray(parsed[k])) db[k] = parsed[k];
    state.db = db;
    writeLocal();
    return db;
  }

  return {
    state, TABLES, uid,
    init, loadAll, create, update, remove,
    readSession, signIn, signInWithLink, signInWithGoogle, resetPassword, signOut, onAuthChange,
    createLink, linkUrl, publishNow, testConnection, switchMode, resetLocal, exportJson, importJson, loadConfig,
    get db() { return state.db; },
  };
})();
