/* ตัวควบคุมหลักของแอป (Alpine component) */
function cmsApp() {
  const CFG = window.CMS_CONFIG;

  return {
    /* ---------- state ---------- */
    ready: false,
    booting: true,
    bootError: '',
    view: 'dashboard',
    sidebarOpen: false,
    toasts: [],
    cfg: CFG,
    db: { channels: [], styles: [], media: [], contents: [], stats: [], activity: [], editJobs: [] },
    mode: 'local',

    // ระบบล็อกอิน (ใช้เฉพาะโหมด supabase)
    session: null,
    needLogin: false,
    authBusy: false,
    login: { email: '', password: '', mode: 'password' },   // password | link
    publishing: '',                                          // id ของคอนเทนต์ที่กำลังยิง API

    // ตัวกรอง
    search: '',
    filterStatus: 'all',
    filterChannel: 'all',

    // ฟอร์ม
    editor: null,
    channelForm: null,
    styleForm: null,
    mediaForm: null,
    statForm: null,
    jobForm: null,
    approveTarget: null,
    approveNote: '',
    calCursor: new Date(),
    settings: { mode: 'local', url: '', key: '' },
    settingsBusy: false,
    importText: '',
    jobPrompt: '',

    /* ---------- boot ---------- */
    /* คัดลอกข้อมูลจาก Store เข้ามาใหม่ เพื่อให้ Alpine รู้ว่ามีการเปลี่ยนแปลง
       (Store แก้ไข array ต้นฉบับโดยตรง ซึ่ง Alpine ไม่ได้ติดตาม) */
    refresh() {
      const d = Store.db || {};
      this.db = {
        channels: [...(d.channels || [])],
        styles:   [...(d.styles || [])],
        media:    [...(d.media || [])],
        contents: [...(d.contents || [])],
        stats:    [...(d.stats || [])],
        activity: [...(d.activity || [])],
        editJobs: [...(d.editJobs || [])],
      };
    },

    async init() {
      try {
        await Store.init();
        this.refresh();
        this.mode = Store.state.mode;
        this.syncAuth();
        Store.onAuthChange(async (session) => {
          this.session = session;
          if (session) {
            await Store.loadAll();
            this.refresh();
            this.needLogin = false;
          } else if (this.mode === 'supabase') {
            this.needLogin = true;
          }
        });
        const c = Store.loadConfig();
        this.settings = { mode: Store.state.mode, url: c.url || '', key: c.key || '' };
        this.ready = true;
      } catch (e) {
        this.bootError = e.message || String(e);
        // ถอยกลับไปโหมด local เพื่อให้ยังใช้งานต่อได้
        try {
          await Store.switchMode('local', '', '');
          this.refresh();
          this.mode = 'local';
          this.ready = true;
          this.toast('เชื่อม Supabase ไม่สำเร็จ สลับเป็นโหมดทดลองในเครื่องให้ก่อน', 'warn');
        } catch (e2) {
          this.toast('เริ่มระบบไม่สำเร็จ: ' + (e2.message || e2), 'err');
        }
      } finally {
        this.booting = false;
      }
    },

    go(v) {
      this.view = v;
      this.sidebarOpen = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    /* ---------- ระบบล็อกอิน ---------- */
    syncAuth() {
      this.session = Store.state.session;
      this.needLogin = this.mode === 'supabase' && !this.session;
    },

    get userEmail() { return this.session?.user?.email || ''; },

    async doLogin() {
      const email = this.login.email.trim();
      if (!email) { this.toast('กรอกอีเมลก่อนครับ', 'warn'); return; }
      this.authBusy = true;
      try {
        if (this.login.mode === 'link') {
          await Store.signInWithLink(email);
          this.toast('ส่งลิงก์เข้าระบบไปที่อีเมลแล้ว เปิดลิงก์จากเครื่องนี้ได้เลยครับ', 'ok');
        } else {
          if (!this.login.password) { this.toast('กรอกรหัสผ่านด้วยครับ', 'warn'); return; }
          await Store.signIn(email, this.login.password);
          this.refresh();
          this.needLogin = false;
          this.session = Store.state.session;
          this.login.password = '';
          this.toast('ยินดีต้อนรับครับ', 'ok');
        }
      } catch (e) {
        this.toast(e.message || String(e), 'err');
      } finally {
        this.authBusy = false;
      }
    },

    async doGoogleLogin() {
      this.authBusy = true;
      try {
        await Store.signInWithGoogle();   // พาไปหน้า Google ต่อ
      } catch (e) {
        this.toast(e.message || String(e), 'err');
        this.authBusy = false;
      }
    },

    async doResetPassword() {
      const email = this.login.email.trim();
      if (!email) { this.toast('กรอกอีเมลที่จะรีเซ็ตก่อนครับ', 'warn'); return; }
      this.authBusy = true;
      try {
        await Store.resetPassword(email);
        this.toast('ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลแล้วครับ', 'ok');
      } catch (e) {
        this.toast(e.message || String(e), 'err');
      } finally {
        this.authBusy = false;
      }
    },

    async doLogout() {
      if (!confirm('ออกจากระบบเลยไหมครับ?')) return;
      await Store.signOut();
      this.session = null;
      this.refresh();
      this.needLogin = true;
      this.toast('ออกจากระบบแล้ว', 'ok');
    },

    /* ---------- toast ---------- */
    toast(msg, kind = 'ok') {
      const id = Date.now() + Math.random();
      this.toasts.push({ id, msg, kind });
      setTimeout(() => { this.toasts = this.toasts.filter((t) => t.id !== id); }, 4200);
    },

    async run(fn, okMsg) {
      try {
        const r = await fn();
        if (okMsg) this.toast(okMsg, 'ok');
        return r;
      } catch (e) {
        this.toast(e.message || String(e), 'err');
        throw e;
      }
    },

    /* ---------- helpers ---------- */
    platform(id) {
      return CFG.platforms.find((p) => p.id === id) || { id, name: id, icon: '•', color: '#8494ab' };
    },
    status(id) {
      return CFG.statuses.find((s) => s.id === id) || { id, name: id, icon: '•', cls: 'badge-draft' };
    },
    channelById(id) { return this.db.channels.find((c) => c.id === id); },
    styleById(id) { return this.db.styles.find((s) => s.id === id); },
    mediaById(id) { return this.db.media.find((m) => m.id === id); },
    contentById(id) { return this.db.contents.find((c) => c.id === id); },

    fmtNum(n) { return (Number(n) || 0).toLocaleString('th-TH'); },

    fmtDate(iso, withTime = true) {
      if (!iso) return '—';
      const d = new Date(iso);
      if (isNaN(d)) return '—';
      const be = String((d.getFullYear() + 543) % 100).padStart(2, '0');
      const s = `${d.getDate()}/${d.getMonth() + 1}/${be}`;
      if (!withTime) return s;
      return `${s} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    },

    fmtRelative(iso) {
      if (!iso) return '—';
      const diff = new Date(iso).getTime() - Date.now();
      const abs = Math.abs(diff);
      const mins = Math.round(abs / 60000);
      if (mins < 60) return diff >= 0 ? `อีก ${mins} นาที` : `${mins} นาทีที่แล้ว`;
      const hrs = Math.round(mins / 60);
      if (hrs < 24) return diff >= 0 ? `อีก ${hrs} ชม.` : `${hrs} ชม.ที่แล้ว`;
      const days = Math.round(hrs / 24);
      return diff >= 0 ? `อีก ${days} วัน` : `${days} วันที่แล้ว`;
    },

    toLocalInput(iso) {
      if (!iso) return '';
      const d = new Date(iso);
      if (isNaN(d)) return '';
      const p = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
    },
    fromLocalInput(v) { return v ? new Date(v).toISOString() : null; },

    async log(contentId, action, note = '') {
      try {
        await Store.create('activity', { content_id: contentId, action, actor: 'ผู้ใช้งาน', note });
      } catch (e) {
        console.warn('บันทึกประวัติไม่สำเร็จ:', e);
      }
    },

    /* ---------- สรุปตัวเลขหน้าภาพรวม ---------- */
    get kpi() {
      const c = this.db.contents;
      const views = this.db.stats.reduce((s, x) => s + (Number(x.views) || 0), 0);
      const engage = this.db.stats.reduce(
        (s, x) => s + (Number(x.likes) || 0) + (Number(x.comments) || 0) + (Number(x.shares) || 0), 0);
      return {
        total: c.length,
        pending: c.filter((x) => x.status === 'pending').length,
        scheduled: c.filter((x) => x.status === 'scheduled' || x.status === 'approved').length,
        published: c.filter((x) => x.status === 'published').length,
        views,
        engage,
        rate: views ? ((engage / views) * 100).toFixed(1) : '0.0',
        channels: this.db.channels.filter((x) => x.active).length,
      };
    },

    // ยอดวิวรายช่อง (เรียงมาก→น้อย) ใช้กับกราฟแท่งนอน
    get viewsByChannel() {
      const map = {};
      for (const s of this.db.stats) {
        map[s.channel_id] = (map[s.channel_id] || 0) + (Number(s.views) || 0);
      }
      const rows = this.db.channels
        .map((c) => ({ id: c.id, name: c.name, platform: c.platform, views: map[c.id] || 0 }))
        .sort((a, b) => b.views - a.views);
      const max = Math.max(1, ...rows.map((r) => r.views));
      return rows.map((r) => ({ ...r, pct: Math.round((r.views / max) * 100) }));
    },

    // จำนวนโพสต์ย้อนหลัง 14 วัน ใช้กับกราฟแท่งตั้ง
    get postsTimeline() {
      const days = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - i);
        const next = new Date(d.getTime() + 86400000);
        const n = this.db.contents.filter((c) => {
          const t = c.published_at || c.scheduled_at;
          if (!t) return false;
          const tt = new Date(t).getTime();
          return tt >= d.getTime() && tt < next.getTime();
        }).length;
        days.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, value: n, date: d });
      }
      const max = Math.max(1, ...days.map((x) => x.value));
      return days.map((x) => ({ ...x, pct: Math.round((x.value / max) * 100) }));
    },

    get upcoming() {
      return this.db.contents
        .filter((c) => c.scheduled_at && ['approved', 'scheduled', 'pending'].includes(c.status))
        .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
        .slice(0, 6);
    },

    get recentActivity() {
      return [...this.db.activity]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 8);
    },

    get pendingList() {
      return this.db.contents
        .filter((c) => c.status === 'pending')
        .sort((a, b) => new Date(a.scheduled_at || a.created_at) - new Date(b.scheduled_at || b.created_at));
    },

    /* ---------- รายการคอนเทนต์ ---------- */
    get filteredContents() {
      const q = this.search.trim().toLowerCase();
      return this.db.contents
        .filter((c) => this.filterStatus === 'all' || c.status === this.filterStatus)
        .filter((c) => this.filterChannel === 'all' || (c.channel_ids || []).includes(this.filterChannel))
        .filter((c) => {
          if (!q) return true;
          const hay = [c.title, c.body, (c.hashtags || []).join(' '), c.pillar].join(' ').toLowerCase();
          return hay.includes(q);
        })
        .sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0));
    },

    /* ---------- ตัวแก้ไขคอนเทนต์ ---------- */
    newContent() {
      this.editor = {
        id: null, title: '', body: '', pillar: CFG.pillars[0],
        style_id: this.db.styles[0]?.id || '', hashtagsText: '',
        channel_ids: [], media_ids: [], status: 'draft',
        scheduledInput: '', note: '',
      };
      this.go('editor');
    },

    editContent(c) {
      this.editor = {
        id: c.id, title: c.title || '', body: c.body || '', pillar: c.pillar || CFG.pillars[0],
        style_id: c.style_id || '', hashtagsText: (c.hashtags || []).join(', '),
        channel_ids: [...(c.channel_ids || [])], media_ids: [...(c.media_ids || [])],
        status: c.status || 'draft', scheduledInput: this.toLocalInput(c.scheduled_at), note: c.note || '',
      };
      this.go('editor');
    },

    toggleIn(arr, id) {
      const i = arr.indexOf(id);
      if (i > -1) arr.splice(i, 1); else arr.push(id);
    },

    get editorStyle() { return this.styleById(this.editor?.style_id); },

    get editorLen() { return (this.editor?.body || '').length; },

    // ความยาวที่เหมาะกับแต่ละแพลตฟอร์มที่เลือกไว้
    get lengthHints() {
      const limits = { facebook: 2200, instagram: 2200, tiktok: 2200, youtube: 5000, line: 1000, website: 100000 };
      const picked = new Set((this.editor?.channel_ids || []).map((id) => this.channelById(id)?.platform).filter(Boolean));
      return [...picked].map((p) => ({
        platform: p, name: this.platform(p).name, icon: this.platform(p).icon,
        limit: limits[p] || 2200, over: this.editorLen > (limits[p] || 2200),
      }));
    },

    validateEditor() {
      const e = this.editor;
      if (!e.title.trim()) return 'ใส่ชื่อคอนเทนต์ก่อนนะครับ';
      if (!e.body.trim()) return 'ยังไม่มีเนื้อหาโพสต์ครับ';
      if (!e.channel_ids.length) return 'เลือกเพจ/ช่องปลายทางอย่างน้อย 1 ช่อง';
      if ((e.status === 'scheduled' || e.status === 'approved') && !e.scheduledInput) {
        return 'ตั้งเวลาโพสต์ก่อนครับ ถ้ายังไม่กำหนดให้เก็บเป็นร่างไว้ก่อน';
      }
      return '';
    },

    async saveContent(nextStatus) {
      if (nextStatus) this.editor.status = nextStatus;
      const err = this.validateEditor();
      if (err) { this.toast(err, 'warn'); return; }

      const e = this.editor;
      const payload = {
        title: e.title.trim(),
        body: e.body.trim(),
        pillar: e.pillar,
        style_id: e.style_id || null,
        hashtags: e.hashtagsText.split(',').map((s) => s.trim().replace(/^#/, '')).filter(Boolean),
        channel_ids: [...e.channel_ids],
        media_ids: [...e.media_ids],
        status: e.status,
        scheduled_at: this.fromLocalInput(e.scheduledInput),
        note: e.note || '',
        author: 'ผู้ใช้งาน',
      };

      await this.run(async () => {
        if (e.id) {
          await Store.update('contents', e.id, payload);
          await this.log(e.id, 'แก้ไขคอนเทนต์');
        } else {
          const row = await Store.create('contents', { ...payload, published_at: null });
          e.id = row.id;
          await this.log(row.id, 'สร้างคอนเทนต์ใหม่');
        }
        this.refresh();
      }, e.status === 'pending' ? 'ส่งขออนุมัติแล้ว' : 'บันทึกคอนเทนต์แล้ว');

      if (e.status === 'pending') this.go('approvals');
      else this.go('contents');
    },

    async deleteContent(c) {
      if (!confirm(`ลบ "${c.title}" ถาวรเลยไหมครับ?`)) return;
      await this.run(async () => {
        await Store.remove('contents', c.id);
        this.refresh();
      }, 'ลบคอนเทนต์แล้ว');
    },

    async setStatus(c, status, note = '') {
      const patch = { status };
      if (status === 'published') patch.published_at = new Date().toISOString();
      if (note) patch.note = note;
      await this.run(async () => {
        await Store.update('contents', c.id, patch);
        await this.log(c.id, this.status(status).name, note);
        this.refresh();
      }, `อัปเดตสถานะเป็น "${this.status(status).name}" แล้ว`);
    },

    // โพสต์ผ่าน API จริง (ต้องอยู่ในโหมด Supabase + ล็อกอิน + ผูกโทเคนไว้แล้ว)
    get canPublishApi() { return this.mode === 'supabase' && !!this.session; },

    async publishViaApi(c) {
      const names = (c.channel_ids || []).map((id) => this.channelById(id)?.name).filter(Boolean).join(', ');
      if (!confirm(`โพสต์ "${c.title}" ขึ้น ${names || 'ช่องที่เลือกไว้'} ตอนนี้เลยไหมครับ?`)) return;

      this.publishing = c.id;
      try {
        const r = await Store.publishNow(c.id);
        this.refresh();
        const okList = (r.results || []).filter((x) => x.ok).map((x) => x.channel);
        const failList = (r.results || []).filter((x) => !x.ok);

        if (okList.length) this.toast(`โพสต์ขึ้น ${okList.join(', ')} แล้ว`, 'ok');
        for (const f of failList) this.toast(`${f.channel || 'บางช่อง'}: ${f.error}`, 'err');
        if (!okList.length && !failList.length) this.toast('ไม่มีช่องที่โพสต์ได้', 'warn');
      } catch (e) {
        this.toast(e.message || String(e), 'err');
      } finally {
        this.publishing = '';
      }
    },

    async duplicateContent(c) {
      await this.run(async () => {
        const { id, created_at, updated_at, published_at, ...rest } = c;
        await Store.create('contents', {
          ...rest,
          title: c.title + ' (สำเนา)',
          status: 'draft', scheduled_at: null, published_at: null,
        });
        this.refresh();
      }, 'ทำสำเนาคอนเทนต์แล้ว');
    },

    /* ---------- ตัวช่วยร่างคอนเทนต์ (เทมเพลต ไม่ใช่ AI) ---------- */
    applyStyleTemplate() {
      const st = this.editorStyle;
      if (!st) { this.toast('เลือกสไตล์ก่อนนะครับ', 'warn'); return; }
      if (this.editor.body.trim() && !confirm('มีเนื้อหาอยู่แล้ว ทับด้วยโครงจากสไตล์นี้เลยไหม?')) return;
      this.editor.body =
        `[ฮุก] ${st.prompt.split(' ').slice(0, 6).join(' ')}...\n\n` +
        `[เนื้อหา] เล่ารายละเอียดตามโทน: ${st.tone}\n` +
        `- ประเด็นที่ 1\n- ประเด็นที่ 2\n- ประเด็นที่ 3\n\n` +
        `[ปิดท้าย] ${st.cta}`;
      this.toast(`วางโครงจากสไตล์ "${st.name}" แล้ว แก้ข้อความต่อได้เลย`, 'ok');
    },

    spinVariants() {
      const b = (this.editor?.body || '').trim();
      if (!b) { this.toast('ยังไม่มีเนื้อหาให้ปั่นครับ', 'warn'); return; }
      const first = b.split('\n')[0];
      const hooks = [
        `รู้ไหมว่า ${first}`,
        `อย่าเพิ่งเลื่อนผ่าน — ${first}`,
        `เรื่องนี้มีคนถามเยอะมาก: ${first}`,
      ];
      this.editor.body = hooks[Math.floor(Math.random() * hooks.length)] + '\n\n' + b.split('\n').slice(1).join('\n');
      this.toast('เปลี่ยนประโยคฮุกให้ใหม่แล้ว กดซ้ำเพื่อสุ่มอีกได้', 'ok');
    },

    /* ---------- เพจ & ช่อง ---------- */
    newChannel() {
      this.channelForm = { id: null, name: '', platform: 'facebook', handle: '', followers: 0, active: true, note: '' };
    },
    editChannel(c) { this.channelForm = { ...c }; },
    async saveChannel() {
      const f = this.channelForm;
      if (!f.name.trim()) { this.toast('ใส่ชื่อเพจ/ช่องก่อนครับ', 'warn'); return; }
      await this.run(async () => {
        const payload = {
          name: f.name.trim(), platform: f.platform, handle: f.handle.trim(),
          followers: Number(f.followers) || 0, active: !!f.active, note: f.note || '',
        };
        if (f.id) await Store.update('channels', f.id, payload);
        else await Store.create('channels', payload);
        this.refresh();
        this.channelForm = null;
      }, 'บันทึกเพจ/ช่องแล้ว');
    },
    async deleteChannel(c) {
      const used = this.db.contents.filter((x) => (x.channel_ids || []).includes(c.id)).length;
      if (used && !confirm(`ช่องนี้ถูกใช้ใน ${used} คอนเทนต์ ลบต่อไหมครับ?`)) return;
      if (!used && !confirm(`ลบ "${c.name}" เลยไหมครับ?`)) return;
      await this.run(async () => {
        await Store.remove('channels', c.id);
        this.refresh();
      }, 'ลบเพจ/ช่องแล้ว');
    },
    async toggleChannel(c) {
      await this.run(async () => {
        await Store.update('channels', c.id, { active: !c.active });
        this.refresh();
      }, c.active ? 'ปิดใช้งานช่องนี้แล้ว' : 'เปิดใช้งานช่องนี้แล้ว');
    },

    /* ---------- แกลลอรี่ ---------- */
    newMedia() { this.mediaForm = { id: null, name: '', url: '', kind: 'image', tagsText: '', size_kb: 0 }; },
    editMedia(m) { this.mediaForm = { ...m, tagsText: (m.tags || []).join(', ') }; },
    async saveMedia() {
      const f = this.mediaForm;
      if (!f.url.trim()) { this.toast('ใส่ลิงก์ไฟล์ (URL) ก่อนครับ', 'warn'); return; }
      await this.run(async () => {
        const payload = {
          name: f.name.trim() || f.url.split('/').pop(),
          url: f.url.trim(), kind: f.kind,
          tags: f.tagsText.split(',').map((s) => s.trim()).filter(Boolean),
          size_kb: Number(f.size_kb) || 0,
        };
        if (f.id) await Store.update('media', f.id, payload);
        else await Store.create('media', payload);
        this.refresh();
        this.mediaForm = null;
      }, 'บันทึกไฟล์ในแกลลอรี่แล้ว');
    },
    async deleteMedia(m) {
      if (!confirm(`ลบ "${m.name}" ออกจากแกลลอรี่ไหมครับ?`)) return;
      await this.run(async () => {
        await Store.remove('media', m.id);
        this.refresh();
      }, 'ลบไฟล์แล้ว');
    },
    copyText(text, msg = 'คัดลอกแล้ว') {
      navigator.clipboard?.writeText(text)
        .then(() => this.toast(msg, 'ok'))
        .catch(() => this.toast('คัดลอกไม่สำเร็จ ลองเลือกข้อความแล้วกด Ctrl+C ครับ', 'warn'));
    },

    /* ---------- คลังสไตล์ ---------- */
    newStyle() { this.styleForm = { id: null, name: '', emoji: '✨', tone: '', audience: '', cta: '', prompt: '' }; },
    editStyle(s) { this.styleForm = { ...s }; },
    async saveStyle() {
      const f = this.styleForm;
      if (!f.name.trim()) { this.toast('ตั้งชื่อสไตล์ก่อนครับ', 'warn'); return; }
      await this.run(async () => {
        const payload = {
          name: f.name.trim(), emoji: f.emoji || '✨', tone: f.tone || '',
          audience: f.audience || '', cta: f.cta || '', prompt: f.prompt || '',
        };
        if (f.id) await Store.update('styles', f.id, payload);
        else await Store.create('styles', payload);
        this.refresh();
        this.styleForm = null;
      }, 'บันทึกสไตล์แล้ว');
    },
    async deleteStyle(s) {
      if (!confirm(`ลบสไตล์ "${s.name}" ไหมครับ?`)) return;
      await this.run(async () => {
        await Store.remove('styles', s.id);
        this.refresh();
      }, 'ลบสไตล์แล้ว');
    },

    /* ---------- คิวโพสต์ / ปฏิทิน ---------- */
    get calTitle() {
      const months = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
      return `${months[this.calCursor.getMonth()]} ${this.calCursor.getFullYear() + 543}`;
    },
    moveMonth(n) {
      const d = new Date(this.calCursor);
      d.setMonth(d.getMonth() + n);
      this.calCursor = d;
    },
    get calCells() {
      const cur = new Date(this.calCursor.getFullYear(), this.calCursor.getMonth(), 1);
      const start = new Date(cur);
      start.setDate(1 - cur.getDay());
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const cells = [];
      for (let i = 0; i < 42; i++) {
        const d = new Date(start.getTime() + i * 86400000);
        const next = new Date(d.getTime() + 86400000);
        const items = this.db.contents.filter((c) => {
          const t = c.scheduled_at || c.published_at;
          if (!t) return false;
          const tt = new Date(t).getTime();
          return tt >= d.getTime() && tt < next.getTime();
        }).sort((a, b) => new Date(a.scheduled_at || a.published_at) - new Date(b.scheduled_at || b.published_at));
        cells.push({
          key: d.toISOString(), day: d.getDate(),
          dim: d.getMonth() !== cur.getMonth(),
          today: d.getTime() === today.getTime(),
          items,
        });
      }
      return cells;
    },
    get queueList() {
      return this.db.contents
        .filter((c) => c.scheduled_at && c.status !== 'published')
        .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
    },
    async reschedule(c, value) {
      const iso = this.fromLocalInput(value);
      if (!iso) return;
      await this.run(async () => {
        await Store.update('contents', c.id, { scheduled_at: iso, status: c.status === 'draft' ? 'scheduled' : c.status });
        await this.log(c.id, 'เลื่อนเวลาโพสต์', this.fmtDate(iso));
        this.refresh();
      }, 'เลื่อนเวลาเรียบร้อย');
    },

    /* ---------- อนุมัติ ---------- */
    openApprove(c) { this.approveTarget = c; this.approveNote = ''; },
    async decide(ok) {
      const c = this.approveTarget;
      if (!c) return;
      const status = ok ? (c.scheduled_at ? 'scheduled' : 'approved') : 'rejected';
      await this.setStatus(c, status, this.approveNote);
      this.approveTarget = null;
      this.approveNote = '';
    },

    /* ---------- รายงาน ---------- */
    get reportRows() {
      return this.db.contents
        .map((c) => {
          const rows = this.db.stats.filter((s) => s.content_id === c.id);
          const views = rows.reduce((s, x) => s + (Number(x.views) || 0), 0);
          const engage = rows.reduce((s, x) => s + (Number(x.likes) || 0) + (Number(x.comments) || 0) + (Number(x.shares) || 0), 0);
          return { content: c, views, engage, rate: views ? ((engage / views) * 100).toFixed(1) : '0.0', n: rows.length };
        })
        .filter((r) => r.n > 0)
        .sort((a, b) => b.views - a.views);
    },
    get bestPillar() {
      const map = {};
      for (const r of this.reportRows) {
        const k = r.content.pillar || 'ไม่ระบุ';
        map[k] = (map[k] || 0) + r.views;
      }
      const rows = Object.entries(map).map(([name, views]) => ({ name, views })).sort((a, b) => b.views - a.views);
      const max = Math.max(1, ...rows.map((r) => r.views));
      return rows.map((r) => ({ ...r, pct: Math.round((r.views / max) * 100) }));
    },
    newStat() {
      this.statForm = {
        content_id: this.db.contents[0]?.id || '', channel_id: this.db.channels[0]?.id || '',
        views: 0, likes: 0, comments: 0, shares: 0, clicks: 0,
      };
    },
    async saveStat() {
      const f = this.statForm;
      if (!f.content_id || !f.channel_id) { this.toast('เลือกคอนเทนต์และช่องก่อนครับ', 'warn'); return; }
      await this.run(async () => {
        await Store.create('stats', {
          content_id: f.content_id, channel_id: f.channel_id,
          views: Number(f.views) || 0, likes: Number(f.likes) || 0,
          comments: Number(f.comments) || 0, shares: Number(f.shares) || 0,
          clicks: Number(f.clicks) || 0, recorded_at: new Date().toISOString(),
        });
        this.refresh();
        this.statForm = null;
      }, 'บันทึกผลลัพธ์แล้ว');
    },

    /* ---------- โรงตัดคลิป (ใบสั่งงานตัดต่อ) ---------- */
    newJob(content = null) {
      this.jobForm = {
        id: null,
        content_id: content?.id || '',
        title: content?.title || '',
        source: '',
        aspect: '9:16',
        target_sec: 45,
        cut_silence: true,
        silence_ms: 400,
        subtitle: true,
        sub_style: 'ขาวขอบดำ อ่านง่าย',
        bilingual: false,
        bgm: true,
        bgm_mood: 'อัปบีต สนุก',
        sfx: true,
        transition: 'คัตตรง + ซูมเล็กน้อยตอนเปลี่ยนประเด็น',
        note: '',
        status: 'รอเริ่มงาน',
      };
      this.jobPrompt = '';
    },
    editJob(j) { this.jobForm = { ...j }; this.jobPrompt = this.buildJobPrompt(j); },

    buildJobPrompt(j) {
      const ch = (this.contentById(j.content_id)?.channel_ids || [])
        .map((id) => this.channelById(id)?.name).filter(Boolean).join(', ');
      const lines = [
        'ช่วยตัดคลิปนี้ให้หน่อยครับ ใช้ ii23 edit kit ตามขั้นตอนของ kit',
        '',
        `ไฟล์ต้นทาง: ${j.source || '(ใส่พาธไฟล์ในเครื่อง)'}`,
        `สัดส่วนภาพ: ${j.aspect}`,
        `ความยาวเป้าหมาย: ~${j.target_sec} วินาที`,
        ch ? `ปลายทาง: ${ch}` : '',
        '',
        'สิ่งที่ต้องทำ:',
        '1. รัน ii23-analyze/scripts/analyze_context.py ให้ได้ context.json ก่อนตัดสินใจตัด',
        j.cut_silence
          ? `2. ii23-clean-cut: ตัดช่วงเงียบ/คำติดขัด/เทคที่พูดใหม่ (เกณฑ์ความเงียบ ~${j.silence_ms} ms) โดยห้ามตัดกลางคำ`
          : '2. ii23-clean-cut: ไม่ต้องตัดช่วงเงียบ ให้คงจังหวะเดิมไว้',
        j.subtitle
          ? `3. ii23-transcribe: ถอดเสียงเป็นซับไทย แล้วใส่ซับใน CapCut สไตล์ "${j.sub_style}"${j.bilingual ? ' และทำซับ 2 ภาษา (ไทย+อังกฤษ) คนละแทร็ก' : ''}`
          : '3. ไม่ต้องใส่ซับ',
        j.bgm || j.sfx
          ? `4. ii23-find-assets: หา${j.bgm ? `เพลงประกอบโทน "${j.bgm_mood}"` : ''}${j.bgm && j.sfx ? ' และ' : ''}${j.sfx ? 'SFX ตามจังหวะที่เปลี่ยนประเด็น' : ''} (ใช้แหล่งที่ลิขสิทธิ์ใช้เชิงพาณิชย์ได้)`
          : '4. ไม่ต้องใส่เพลง/SFX',
        `5. จังหวะตัด/ทรานซิชัน: ${j.transition}`,
        '6. รัน ii23-capcut/scripts/qc_edit.py จนผ่าน แล้วค่อยส่งงาน',
        '',
        j.note ? `หมายเหตุเพิ่มเติม: ${j.note}` : '',
        '',
        'ถ้าตรงไหนไม่แน่ใจ (เช่น จะเก็บช่วงเงียบเกิน 2 วินาทีไว้ไหม) ถามผมก่อนนะครับ อย่าเดา',
      ];
      return lines.filter((l) => l !== '').join('\n');
    },

    async saveJob() {
      const f = this.jobForm;
      if (!f.title.trim() && !f.content_id) { this.toast('ใส่ชื่องาน หรือเลือกคอนเทนต์ที่ผูกกับงานนี้ครับ', 'warn'); return; }
      const payload = {
        content_id: f.content_id || null,
        title: f.title.trim() || this.contentById(f.content_id)?.title || 'งานตัดคลิป',
        source: f.source || '', aspect: f.aspect, target_sec: Number(f.target_sec) || 0,
        cut_silence: !!f.cut_silence, silence_ms: Number(f.silence_ms) || 400,
        subtitle: !!f.subtitle, sub_style: f.sub_style, bilingual: !!f.bilingual,
        bgm: !!f.bgm, bgm_mood: f.bgm_mood, sfx: !!f.sfx,
        transition: f.transition, note: f.note, status: f.status || 'รอเริ่มงาน',
      };
      await this.run(async () => {
        if (f.id) await Store.update('editJobs', f.id, payload);
        else await Store.create('editJobs', payload);
        this.refresh();
        this.jobForm = null;
        this.jobPrompt = '';
      }, 'บันทึกใบสั่งงานตัดต่อแล้ว');
    },
    async setJobStatus(j, status) {
      await this.run(async () => {
        await Store.update('editJobs', j.id, { status });
        this.refresh();
      }, `อัปเดตสถานะงานเป็น "${status}"`);
    },
    async deleteJob(j) {
      if (!confirm(`ลบใบสั่งงาน "${j.title}" ไหมครับ?`)) return;
      await this.run(async () => {
        await Store.remove('editJobs', j.id);
        this.refresh();
      }, 'ลบใบสั่งงานแล้ว');
    },
    previewJobPrompt() {
      if (!this.jobForm) return;
      this.jobPrompt = this.buildJobPrompt(this.jobForm);
    },

    /* ---------- ตั้งค่า ---------- */
    async testSupabase() {
      this.settingsBusy = true;
      try {
        const r = await Store.testConnection(this.settings.url.trim(), this.settings.key.trim());
        this.toast(r.message, r.ok ? 'ok' : 'err');
      } finally {
        this.settingsBusy = false;
      }
    },
    async applySettings() {
      this.settingsBusy = true;
      try {
        await Store.switchMode(this.settings.mode, this.settings.url.trim(), this.settings.key.trim());
        this.refresh();
        this.mode = Store.state.mode;
        this.syncAuth();
        if (this.needLogin) {
          this.toast('เชื่อม Supabase แล้ว — เข้าสู่ระบบก่อนใช้งานครับ', 'ok');
        } else {
          this.toast(this.mode === 'supabase' ? 'สลับไปใช้ Supabase แล้ว' : 'ใช้โหมดทดลองในเครื่อง', 'ok');
        }
      } catch (e) {
        this.toast(e.message || String(e), 'err');
      } finally {
        this.settingsBusy = false;
      }
    },
    resetDemo(withSeed) {
      if (!confirm(withSeed ? 'ล้างข้อมูลในเครื่องแล้วใส่ข้อมูลตัวอย่างใหม่?' : 'ล้างข้อมูลในเครื่องให้ว่างเปล่า?')) return;
      Store.resetLocal(withSeed);
      this.refresh();
      this.toast('ล้างข้อมูลเรียบร้อย', 'ok');
    },
    downloadBackup() {
      const blob = new Blob([Store.exportJson()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `content-system-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      this.toast('ดาวน์โหลดไฟล์สำรองแล้ว', 'ok');
    },
    async doImport() {
      if (!this.importText.trim()) { this.toast('วางข้อมูล JSON ก่อนครับ', 'warn'); return; }
      try {
        await Store.importJson(this.importText);
        this.refresh();
        this.importText = '';
        this.toast('นำเข้าข้อมูลสำเร็จ', 'ok');
      } catch (e) {
        this.toast('ไฟล์ไม่ถูกต้อง: ' + (e.message || e), 'err');
      }
    },
  };
}
