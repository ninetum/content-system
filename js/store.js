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
  };

  const uid = (p) => `${p}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;

  const state = {
    mode: 'local',      // 'local' | 'supabase'
    client: null,
    url: '',
    key: '',
    lastError: '',
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
    return { channels: [], styles: [], media: [], contents: [], stats: [], activity: [], editJobs: [] };
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
    };
  }

  /* ---------- config ---------- */
  function loadConfig() {
    let cfg = { mode: 'local', url: CFG.supabaseUrl || '', key: CFG.supabaseAnonKey || '' };
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

  /* ---------- ทดสอบการเชื่อมต่อ ---------- */
  async function testConnection(url, key) {
    const client = makeClient(url, key);
    if (!client) return { ok: false, message: state.lastError || 'กรอก URL และ anon key ให้ครบก่อนครับ' };
    const { error } = await client.from(TABLES.channels).select('id', { count: 'exact', head: true });
    if (error) return { ok: false, message: `เชื่อมต่อไม่สำเร็จ: ${error.message}` };
    return { ok: true, message: 'เชื่อมต่อ Supabase สำเร็จ อ่านตาราง channels ได้' };
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
    testConnection, switchMode, resetLocal, exportJson, importJson, loadConfig,
    get db() { return state.db; },
  };
})();
