/**
 * Edge Function: publish-post
 * ---------------------------------------------------------------
 * โพสต์คอนเทนต์จากระบบไปยัง Facebook Page / Instagram ผ่าน Graph API
 *
 * ทำไมต้องมีไฟล์นี้: access token ห้ามอยู่ในหน้าเว็บ ใครเปิด DevTools ก็เอาไปใช้ได้
 * ฟังก์ชันนี้รันฝั่งเซิร์ฟเวอร์ ถือ token ไว้เอง และตรวจว่าคนสั่งโพสต์ล็อกอินจริงก่อนเสมอ
 *
 * เรียกใช้:
 *   POST /functions/v1/publish-post
 *   Authorization: Bearer <user access token ของคนที่ล็อกอินอยู่>
 *   { "content_id": "...", "channel_ids": ["..."] }   // channel_ids เว้นได้ = ใช้ของคอนเทนต์
 *
 * deploy:  supabase functions deploy publish-post
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const GRAPH_VERSION = Deno.env.get('GRAPH_API_VERSION') ?? 'v21.0';
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

const CORS = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

type Cred = { external_id: string; access_token: string; platform: string };

/* ---------- Facebook Page ---------- */
async function postToFacebook(cred: Cred, text: string, imageUrls: string[]) {
  // มีรูปเดียว → ใช้ /photos (ได้โพสต์รูปพร้อมแคปชัน)
  if (imageUrls.length === 1) {
    const res = await fetch(`${GRAPH}/${cred.external_id}/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: imageUrls[0], caption: text, access_token: cred.access_token }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message ?? 'Facebook ปฏิเสธคำขอ');
    return data.post_id ?? data.id;
  }

  // หลายรูป → อัปแบบยังไม่เผยแพร่ก่อน แล้วค่อยแนบเข้าโพสต์เดียว
  if (imageUrls.length > 1) {
    const mediaIds: string[] = [];
    for (const url of imageUrls.slice(0, 10)) {
      const res = await fetch(`${GRAPH}/${cred.external_id}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, published: false, access_token: cred.access_token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? 'อัปโหลดรูปไม่สำเร็จ');
      mediaIds.push(data.id);
    }
    const res = await fetch(`${GRAPH}/${cred.external_id}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        attached_media: mediaIds.map((id) => ({ media_fbid: id })),
        access_token: cred.access_token,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message ?? 'Facebook ปฏิเสธคำขอ');
    return data.id;
  }

  // ข้อความล้วน
  const res = await fetch(`${GRAPH}/${cred.external_id}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: text, access_token: cred.access_token }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? 'Facebook ปฏิเสธคำขอ');
  return data.id;
}

/* ---------- Instagram ---------- */
// IG ต้องทำ 2 ขั้นเสมอ: สร้าง container ก่อน แล้วค่อยสั่งเผยแพร่
async function postToInstagram(cred: Cred, text: string, imageUrls: string[]) {
  if (!imageUrls.length) throw new Error('Instagram โพสต์ข้อความล้วนไม่ได้ ต้องมีรูปหรือวิดีโออย่างน้อย 1 ไฟล์');

  const createContainer = (body: Record<string, unknown>) =>
    fetch(`${GRAPH}/${cred.external_id}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, access_token: cred.access_token }),
    }).then(async (r) => {
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error?.message ?? 'สร้างสื่อบน Instagram ไม่สำเร็จ');
      return d.id as string;
    });

  let creationId: string;

  if (imageUrls.length === 1) {
    creationId = await createContainer({ image_url: imageUrls[0], caption: text });
  } else {
    // อัลบั้ม (carousel) — สร้างลูกทีละรูปแล้วรวมเป็นตัวแม่
    const children: string[] = [];
    for (const url of imageUrls.slice(0, 10)) {
      children.push(await createContainer({ image_url: url, is_carousel_item: true }));
    }
    creationId = await createContainer({ media_type: 'CAROUSEL', children, caption: text });
  }

  // รอให้ IG ประมวลผลสื่อเสร็จก่อนสั่งเผยแพร่ (ไม่รอ = เจอ error บ่อย)
  for (let i = 0; i < 10; i++) {
    const r = await fetch(`${GRAPH}/${creationId}?fields=status_code&access_token=${cred.access_token}`);
    const d = await r.json();
    if (d.status_code === 'FINISHED') break;
    if (d.status_code === 'ERROR') throw new Error('Instagram ประมวลผลสื่อไม่สำเร็จ (เช็กว่าลิงก์รูปเปิดสาธารณะได้จริง)');
    await new Promise((res) => setTimeout(res, 2000));
  }

  const res = await fetch(`${GRAPH}/${cred.external_id}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: creationId, access_token: cred.access_token }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? 'เผยแพร่บน Instagram ไม่สำเร็จ');
  return data.id;
}

/* ---------- LINE OA ---------- */
async function postToLine(cred: Cred, text: string, imageUrls: string[]) {
  const messages: Record<string, unknown>[] = [{ type: 'text', text }];
  if (imageUrls[0]) {
    messages.push({ type: 'image', originalContentUrl: imageUrls[0], previewImageUrl: imageUrls[0] });
  }
  const res = await fetch('https://api.line.me/v2/bot/message/broadcast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cred.access_token}` },
    body: JSON.stringify({ messages: messages.slice(0, 5) }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d?.message ?? 'LINE ปฏิเสธคำขอ');
  }
  return 'broadcast';
}

/* ---------- handler ---------- */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'ใช้ได้เฉพาะ POST' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // 1) ตรวจก่อนว่าคนสั่งโพสต์ล็อกอินจริง
  const authHeader = req.headers.get('Authorization') ?? '';
  const asUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await asUser.auth.getUser();
  if (userErr || !userData?.user) return json({ error: 'ยังไม่ได้เข้าสู่ระบบ' }, 401);

  // 2) จากตรงนี้ใช้สิทธิ์ service role เพื่ออ่านโทเคน (หน้าเว็บอ่านตารางนี้ไม่ได้)
  const admin = createClient(url, service);

  let body: { content_id?: string; channel_ids?: string[] };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'รูปแบบข้อมูลไม่ถูกต้อง' }, 400);
  }
  if (!body.content_id) return json({ error: 'ต้องระบุ content_id' }, 400);

  const { data: content, error: cErr } = await admin
    .from('contents').select('*').eq('id', body.content_id).single();
  if (cErr || !content) return json({ error: 'ไม่พบคอนเทนต์นี้' }, 404);

  const targetIds: string[] = body.channel_ids?.length ? body.channel_ids : (content.channel_ids ?? []);
  if (!targetIds.length) return json({ error: 'คอนเทนต์นี้ยังไม่ได้เลือกช่องปลายทาง' }, 400);

  // ประกอบข้อความ: เนื้อหา + แฮชแท็ก
  const tags = (content.hashtags ?? []).map((h: string) => `#${h}`).join(' ');
  const text = [content.body, tags].filter(Boolean).join('\n\n');

  // ลิงก์รูปจากแกลลอรี่ (ต้องเป็น URL สาธารณะ ไม่งั้น IG จะไม่รับ)
  const { data: media } = await admin
    .from('media_assets').select('id,url,kind').in('id', content.media_ids ?? []);
  const imageUrls = (media ?? []).filter((m) => m.kind === 'image').map((m) => m.url);

  const results: Record<string, unknown>[] = [];

  for (const channelId of targetIds) {
    const { data: channel } = await admin.from('channels').select('*').eq('id', channelId).single();
    const { data: cred } = await admin
      .from('channel_credentials').select('*').eq('channel_id', channelId).maybeSingle();

    let ok = false, postId = '', error = '';

    try {
      if (!channel) throw new Error('ไม่พบช่องนี้ในระบบ');
      if (!channel.active) throw new Error(`ช่อง "${channel.name}" ถูกพักอยู่`);
      if (!cred) throw new Error(`ช่อง "${channel.name}" ยังไม่ได้ผูกโทเคน — เพิ่มที่ตาราง channel_credentials`);
      if (cred.expires_at && new Date(cred.expires_at) < new Date()) {
        throw new Error(`โทเคนของ "${channel.name}" หมดอายุแล้ว ต้องต่ออายุก่อน`);
      }

      if (channel.platform === 'facebook')       postId = await postToFacebook(cred, text, imageUrls);
      else if (channel.platform === 'instagram') postId = await postToInstagram(cred, text, imageUrls);
      else if (channel.platform === 'line')      postId = await postToLine(cred, text, imageUrls);
      else throw new Error(`ยังไม่รองรับการโพสต์อัตโนมัติสำหรับ ${channel.platform}`);

      ok = true;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }

    await admin.from('publish_results').insert({
      content_id: content.id, channel_id: channelId,
      platform: channel?.platform ?? '', ok, external_post_id: postId, error,
    });

    results.push({ channel_id: channelId, channel: channel?.name ?? '', ok, post_id: postId, error });
  }

  // สำเร็จอย่างน้อย 1 ช่อง → อัปเดตสถานะคอนเทนต์เป็นเผยแพร่แล้ว
  const anyOk = results.some((r) => r.ok);
  if (anyOk) {
    await admin.from('contents')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('id', content.id);
    await admin.from('activity_log').insert({
      content_id: content.id,
      action: 'เผยแพร่แล้ว',
      actor: userData.user.email ?? 'ระบบ',
      note: results.filter((r) => r.ok).map((r) => r.channel).join(', '),
    });
  }

  return json({ ok: anyOk, results }, anyOk ? 200 : 502);
});
