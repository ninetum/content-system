/**
 * Edge Function: r  (redirect + นับคลิก)
 * ---------------------------------------------------------------
 * ลิงก์ติดตามผลของแต่ละโพสต์ชี้มาที่นี่:
 *     https://<project>.supabase.co/functions/v1/r/<code>
 *
 * หน้าที่: บันทึกว่ามีคนกด แล้วพาไปหน้าปลายทางจริงพร้อมแท็ก UTM
 * ทำให้ตอบได้ว่า "คนที่เข้าเว็บ/ทักมา มาจากโพสต์ไหน ช่องไหน"
 *
 * deploy (สำคัญ — ต้องปิดการเช็ก JWT เพราะคนทั่วไปต้องกดได้):
 *     supabase functions deploy r --no-verify-jwt
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// หน้าเว้นว่างเมื่อหาลิงก์ไม่เจอ — ตั้ง FALLBACK_URL เป็นหน้าแรกของร้านได้
const FALLBACK = Deno.env.get('FALLBACK_URL') ?? '';

const notFound = () =>
  FALLBACK
    ? Response.redirect(FALLBACK, 302)
    : new Response('ไม่พบลิงก์นี้ หรือลิงก์ถูกลบไปแล้ว', {
        status: 404,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });

Deno.serve(async (req) => {
  const url = new URL(req.url);
  // รองรับทั้ง /functions/v1/r/<code> และ /r?c=<code>
  const code = url.pathname.split('/').filter(Boolean).pop() ?? '';
  const key = url.searchParams.get('c') || (code === 'r' ? '' : code);

  if (!key) return notFound();

  const { data: link } = await admin
    .from('tracked_links')
    .select('id, target_url, content_id, channel_id')
    .eq('code', key)
    .maybeSingle();

  if (!link?.target_url) return notFound();

  // บันทึกคลิกแบบไม่ต้องรอ (ไม่เก็บ IP — เก็บแค่ที่มาและชนิดเครื่อง)
  const logging = admin.from('link_clicks').insert({
    link_id: link.id,
    referer: req.headers.get('referer')?.slice(0, 500) ?? '',
    user_agent: req.headers.get('user-agent')?.slice(0, 300) ?? '',
  });

  // แปะ UTM ให้ Google Analytics / Shopee / เว็บร้าน อ่านที่มาได้
  let target: URL;
  try {
    target = new URL(link.target_url);
  } catch {
    return notFound();
  }

  let channelName = 'direct';
  if (link.channel_id) {
    const { data: ch } = await admin
      .from('channels').select('platform, name').eq('id', link.channel_id).maybeSingle();
    if (ch) channelName = ch.platform || ch.name || 'direct';
  }

  if (!target.searchParams.has('utm_source')) target.searchParams.set('utm_source', channelName);
  if (!target.searchParams.has('utm_medium')) target.searchParams.set('utm_medium', 'social');
  if (!target.searchParams.has('utm_campaign') && link.content_id) {
    target.searchParams.set('utm_campaign', String(link.content_id).slice(0, 8));
  }
  target.searchParams.set('ref', key);

  try { await logging; } catch { /* นับคลิกพลาดไม่ควรทำให้ลูกค้าเข้าเว็บไม่ได้ */ }

  return new Response(null, {
    status: 302,
    headers: { Location: target.toString(), 'Cache-Control': 'no-store' },
  });
});
