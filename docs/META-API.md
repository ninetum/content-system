# ต่อ API จริง — Facebook / Instagram / LINE + ล็อกอินด้วย Gmail

เอกสารนี้เป็นขั้นตอนลงมือทำจริง ไม่ใช่ทฤษฎี ทำตามลำดับได้เลย

---

## ทางลัดสำคัญ: เพจของคุณเอง **ไม่ต้องรอ App Review**

หลายคนถอดใจตรงนี้เพราะคิดว่าต้องส่งแอปให้ Meta รีวิวก่อน (รอเป็นสัปดาห์)
ความจริงคือ **แอปที่อยู่ในโหมด Development ใช้สิทธิ์ได้ทันที กับคนที่มีบทบาทในแอปนั้น**
(Admin / Developer / Tester)

แปลว่าถ้า:

- คุณเป็น **Admin ของแอป** และ
- คุณเป็น **Admin ของเพจ** ที่จะโพสต์

→ ยิง API โพสต์ขึ้นเพจตัวเองได้เลยวันนี้ ไม่ต้องรีวิว

**จะต้องส่ง App Review ก็ต่อเมื่อ** จะให้คนนอก (ลูกค้า/ทีมที่ไม่ได้อยู่ในแอป) กดเชื่อมเพจของเขาเอง
ซึ่งกรณีใช้ภายในร้าน ไม่จำเป็นเลย

---

## 1. Facebook Page

### 1.1 สร้างแอป

1. ไป https://developers.facebook.com/apps → **Create App**
2. เลือกประเภท **Business**
3. ใส่ชื่อแอป (เช่น "ร้านเราเอง Content Hub") → สร้าง
4. ในแอป → **Add Product** → เพิ่ม **Facebook Login** (ไม่ต้องตั้งค่าอะไรมาก) และ **Instagram** ถ้าจะใช้ IG ด้วย

> ปล่อยแอปไว้ในโหมด **Development** ก็พอ ไม่ต้องกด Live

### 1.2 ขอ token

1. ไป **Tools → Graph API Explorer**
2. เลือกแอปที่เพิ่งสร้าง
3. กด **Add a Permission** เลือก:
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_manage_posts`
   - `instagram_basic`, `instagram_content_publish` (ถ้าจะโพสต์ IG)
   - `business_management`
4. กด **Generate Access Token** → อนุญาตเพจที่ต้องการ
5. ได้ **User Access Token** มา (อันนี้อายุสั้น ~1-2 ชม.)

### 1.3 แปลงเป็น token ที่ไม่หมดอายุ

ขั้นนี้สำคัญ ไม่งั้นต้องมานั่งต่ออายุทุกชั่วโมง

**ก. แลกเป็น long-lived user token (อายุ 60 วัน)**

```
GET https://graph.facebook.com/v21.0/oauth/access_token
  ?grant_type=fb_exchange_token
  &client_id=<APP_ID>
  &client_secret=<APP_SECRET>
  &fb_exchange_token=<USER_TOKEN_จากข้อ1.2>
```

**ข. เอา long-lived user token ไปขอ page token**

```
GET https://graph.facebook.com/v21.0/me/accounts?access_token=<LONG_LIVED_USER_TOKEN>
```

จะได้รายการเพจ พร้อม `id` (Page ID) และ `access_token` ของเพจ

> **Page token ที่ได้จาก long-lived user token จะไม่มีวันหมดอายุ** ตราบใดที่ไม่เปลี่ยนรหัสผ่าน
> ไม่ถอนสิทธิ์ และแอปไม่โดนระงับ — เก็บค่านี้ไว้ใช้ยาว

App ID / App Secret ดูได้ที่ **App Settings → Basic**

### 1.4 หา Instagram User ID (ถ้าจะโพสต์ IG)

เงื่อนไข: บัญชี IG ต้องเป็น **Business หรือ Creator** และ **ผูกกับเพจ Facebook** นั้นแล้ว

```
GET https://graph.facebook.com/v21.0/<PAGE_ID>?fields=instagram_business_account&access_token=<PAGE_TOKEN>
```

ค่า `instagram_business_account.id` คือ IG User ID ที่ต้องใช้ (ใช้ page token ตัวเดิมได้เลย)

---

## 2. เก็บโทเคนเข้าระบบ (ห้ามใส่ในหน้าเว็บ)

ตาราง `channel_credentials` ใน `supabase/schema.sql` **เปิด RLS แต่ไม่มี policy เลย** โดยตั้งใจ
ผลคือหน้าเว็บอ่านไม่ได้แม้แต่แถวเดียว มีแค่ Edge Function (service_role) ที่เข้าถึงได้

ไปที่ Supabase → **SQL Editor** แล้วรัน (แก้ค่าตามของจริง):

```sql
-- ดู channel id ของเพจที่จะผูกก่อน
select id, name, platform from public.channels;

-- Facebook Page
insert into public.channel_credentials (channel_id, platform, external_id, access_token, note)
values ('<channel-id-ของเพจ>', 'facebook', '<PAGE_ID>', '<PAGE_ACCESS_TOKEN>', 'page token ไม่หมดอายุ');

-- Instagram
insert into public.channel_credentials (channel_id, platform, external_id, access_token, note)
values ('<channel-id-ของ IG>', 'instagram', '<IG_USER_ID>', '<PAGE_ACCESS_TOKEN>', 'ใช้ page token ตัวเดียวกัน');

-- LINE OA
insert into public.channel_credentials (channel_id, platform, external_id, access_token, note)
values ('<channel-id-ของ LINE>', 'line', '<CHANNEL_ID>', '<CHANNEL_ACCESS_TOKEN>', '');
```

---

## 3. Deploy ฟังก์ชันโพสต์

```bash
supabase login
supabase link --project-ref <PROJECT_REF>
supabase functions deploy publish-post
```

ตั้งเวอร์ชัน Graph API (ไม่ตั้งก็ใช้ค่าเริ่มต้น v21.0):

```bash
supabase secrets set GRAPH_API_VERSION=v21.0
```

> `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` แพลตฟอร์มใส่ให้อัตโนมัติ ไม่ต้องตั้งเอง

เสร็จแล้วปุ่ม **🚀 โพสต์จริง** จะโผล่ในหน้าคิวโพสต์และรายการคอนเทนต์

### ฟังก์ชันนี้ทำอะไรบ้าง

1. ตรวจว่าคนสั่งโพสต์ **ล็อกอินจริง** (ไม่ผ่าน = 401)
2. อ่านคอนเทนต์ + แฮชแท็ก + ลิงก์รูปจากแกลลอรี่
3. ยิงตามแพลตฟอร์ม:
   - Facebook: รูปเดียวใช้ `/photos`, หลายรูปอัปแบบยังไม่เผยแพร่แล้วรวมเป็นโพสต์เดียว, ข้อความล้วนใช้ `/feed`
   - Instagram: สร้าง container → **รอจนประมวลผลเสร็จ** → `media_publish` (รองรับ carousel)
   - LINE: broadcast ข้อความ + รูป
4. บันทึกผลทุกครั้งลงตาราง `publish_results` (สำเร็จ/ล้มเหลว เพราะอะไร)
5. สำเร็จอย่างน้อย 1 ช่อง → เปลี่ยนสถานะคอนเทนต์เป็น "เผยแพร่แล้ว" + บันทึกประวัติ

---

## 4. ข้อจำกัดที่ต้องรู้ก่อนใช้จริง

| เรื่อง | รายละเอียด |
|---|---|
| **IG ต้องมีรูป** | โพสต์ข้อความล้วนไม่ได้ ต้องมีภาพหรือวิดีโออย่างน้อย 1 ไฟล์ |
| **ลิงก์รูปต้องเปิดสาธารณะ** | IG ไปดึงรูปจาก URL เอง ถ้าลิงก์ต้องล็อกอินจะพัง — ใช้ Supabase Storage แบบ public ได้ |
| **โควตา IG** | โพสต์ได้ ~25 ชิ้นต่อ 24 ชม. ต่อบัญชี |
| **แคปชัน IG** | ไม่เกิน 2,200 ตัวอักษร / แฮชแท็กไม่เกิน 30 อัน (ระบบเตือนความยาวให้แล้วตอนเขียน) |
| **เวอร์ชัน Graph API** | Meta ปลดระวางเวอร์ชันเก่าเรื่อย ๆ ถ้าเจอ error เรื่องเวอร์ชัน ให้เปลี่ยนค่า `GRAPH_API_VERSION` |
| **TikTok** | Content Posting API ต้องผ่าน audit ของ TikTok ไม่มีทางลัดแบบ Meta — ทำทีหลัง |

---

## 5. ตั้งเวลาให้โพสต์เองอัตโนมัติ

ตอนนี้ปุ่มโพสต์เป็นการกดเอง ถ้าอยากให้ถึงเวลาแล้วยิงเอง เพิ่ม pg_cron ใน Supabase:

```sql
-- เปิดส่วนขยาย (ทำครั้งเดียว)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ทุก 5 นาที เรียกฟังก์ชันให้โพสต์คอนเทนต์ที่ถึงเวลาแล้ว
select cron.schedule('publish-due', '*/5 * * * *', $$
  select net.http_post(
    url := '<SUPABASE_URL>/functions/v1/publish-due',
    headers := jsonb_build_object('Authorization', 'Bearer <SERVICE_ROLE_KEY>')
  );
$$);
```

> ต้องเขียนฟังก์ชัน `publish-due` เพิ่ม (วนหาคอนเทนต์ที่ `status='scheduled'` และ `scheduled_at <= now()`
> แล้วเรียกตรรกะเดียวกับ `publish-post`) — บอกได้ ผมเขียนให้

---

## 6. ล็อกอินด้วย Gmail (Google Sign-In)

### 6.1 สร้าง OAuth client ที่ Google

1. ไป https://console.cloud.google.com → สร้างโปรเจกต์ (หรือใช้ของเดิม)
2. **APIs & Services → OAuth consent screen** → เลือก External → กรอกชื่อแอป + อีเมลติดต่อ
   - ระหว่างทดสอบ ให้เพิ่มอีเมลทีมใน **Test users**
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - **Authorized redirect URIs** ใส่:
     ```
     https://<PROJECT_REF>.supabase.co/auth/v1/callback
     ```
4. คัดลอก **Client ID** และ **Client Secret**

### 6.2 เปิดใน Supabase

1. Supabase Dashboard → **Authentication → Sign In / Providers → Google**
2. เปิดสวิตช์ → วาง Client ID + Client Secret → Save
3. ไปที่ **Authentication → URL Configuration** ตั้งค่า:
   - **Site URL**: `https://content-system-omega-sooty.vercel.app`
   - **Redirect URLs**: ใส่ URL เดียวกัน (และ `http://localhost:8000` ถ้าจะทดสอบในเครื่อง)

เสร็จแล้วปุ่ม **"เข้าสู่ระบบด้วย Google"** บนหน้าล็อกอินใช้ได้ทันที

### 6.3 กันคนนอกหลุดเข้ามา

เปิด Google login แล้ว **ใครมี Gmail ก็ล็อกอินได้** ถ้าไม่ปิดกั้น
เลือกทำอย่างใดอย่างหนึ่ง:

- **ง่ายสุด:** Authentication → Providers → ปิด **"Allow new users to sign up"**
  (คนที่แอดมินเพิ่มไว้แล้วเท่านั้นที่เข้าได้ คนใหม่ล็อกอินไม่ผ่าน)
- **ยืดหยุ่นกว่า:** ทำตาราง `team_members` เก็บอีเมลที่อนุญาต แล้วแก้ policy ให้เช็กกับตารางนั้น
  — บอกได้ ผมเขียน SQL ให้
