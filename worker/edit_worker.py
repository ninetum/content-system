#!/usr/bin/env python3
"""
worker รับงานตัดคลิป — รันบนเครื่องที่มี ii23 edit kit + CapCut + ffmpeg
==========================================================================
ทำไมต้องมีตัวนี้: งานตัดวิดีโอรันบน Edge Function / Vercel ไม่ได้
(ไม่มี ffmpeg ไม่มี CapCut แรม 256MB ตัดจบใน ~400 วินาที)
worker ตัวนี้จึงทำหน้าที่เป็น "โรงตัด" อยู่บนเครื่องคุณ:

    เว็บสร้างใบสั่งงาน → ตาราง edit_jobs → worker ดึงงาน → สั่ง agent ตัดด้วยสกิลของ kit
    → อัปไฟล์ผลลัพธ์ขึ้น Storage → เว็บเห็นผลเอง

ใช้ไลบรารีมาตรฐานของ Python ล้วน ไม่ต้อง pip install อะไรเพิ่ม

วิธีรัน:
    cp worker/.env.example worker/.env      # แล้วเติมค่าให้ครบ
    python3 worker/edit_worker.py           # ค้างไว้ รอรับงาน
    python3 worker/edit_worker.py --once    # ทำงานที่ค้างอยู่รอบเดียวแล้วออก
    python3 worker/edit_worker.py --dry-run # แค่พิมพ์คำสั่งให้ดู ไม่เรียก agent จริง
"""

import argparse
import json
import mimetypes
import os
import re
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

# ---------------------------------------------------------------- ค่าตั้งต้น

STATUS_WAITING = "รอเริ่มงาน"
STATUS_RUNNING = "กำลังตัด"
STATUS_REVIEW = "รอตรวจ"
STATUS_FAILED = "ตัดไม่สำเร็จ"

VIDEO_EXTS = {".mp4", ".mov", ".webm", ".m4v"}


def load_env():
    """อ่าน worker/.env แบบง่าย ๆ (ไม่ต้องลง python-dotenv)"""
    env_path = Path(__file__).with_name(".env")
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


class Config:
    def __init__(self):
        self.url = os.environ.get("SUPABASE_URL", "").rstrip("/")
        self.key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        self.kit_dir = os.environ.get("KIT_DIR", "")
        self.agent_cmd = os.environ.get("AGENT_CMD", "claude -p")
        self.bucket = os.environ.get("OUTPUT_BUCKET", "edits")
        self.poll = int(os.environ.get("POLL_SECONDS", "20"))
        self.timeout = int(os.environ.get("JOB_TIMEOUT_SECONDS", "3600"))
        self.worker_name = os.environ.get("WORKER_NAME", socket.gethostname())

    def check(self):
        problems = []
        if not self.url:
            problems.append("ยังไม่ได้ตั้ง SUPABASE_URL")
        if not self.key:
            problems.append("ยังไม่ได้ตั้ง SUPABASE_SERVICE_ROLE_KEY")
        if not self.kit_dir:
            problems.append("ยังไม่ได้ตั้ง KIT_DIR (โฟลเดอร์ที่แตก ii23 edit kit ไว้)")
        elif not Path(self.kit_dir).is_dir():
            problems.append(f"ไม่พบโฟลเดอร์ KIT_DIR: {self.kit_dir}")
        elif not (Path(self.kit_dir) / ".agents" / "skills").is_dir():
            problems.append(f"{self.kit_dir} ไม่เหมือนโฟลเดอร์ของ kit (ไม่เจอ .agents/skills)")
        return problems


# ---------------------------------------------------------------- Supabase REST


class Supa:
    """คุยกับ Supabase ผ่าน REST ตรง ๆ — service role key อยู่บนเครื่องคุณเท่านั้น"""

    def __init__(self, cfg: Config):
        self.cfg = cfg

    def _req(self, method, path, body=None, headers=None, raw=None, content_type=None):
        url = f"{self.cfg.url}{path}"
        head = {
            "apikey": self.cfg.key,
            "Authorization": f"Bearer {self.cfg.key}",
        }
        data = None
        if raw is not None:
            data = raw
            head["Content-Type"] = content_type or "application/octet-stream"
        elif body is not None:
            data = json.dumps(body).encode("utf-8")
            head["Content-Type"] = "application/json"
        head.update(headers or {})

        req = urllib.request.Request(url, data=data, headers=head, method=method)
        try:
            with urllib.request.urlopen(req, timeout=120) as res:
                payload = res.read()
                if not payload:
                    return None
                try:
                    return json.loads(payload)
                except json.JSONDecodeError:
                    return payload.decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "replace")[:400]
            raise RuntimeError(f"{method} {path} → HTTP {e.code}: {detail}") from None
        except urllib.error.URLError as e:
            raise RuntimeError(f"ต่อ Supabase ไม่ได้: {e.reason}") from None

    # ---- ตาราง ----

    def waiting_jobs(self):
        q = urllib.parse.urlencode({
            "status": f"eq.{STATUS_WAITING}",
            "order": "created_at.asc",
            "limit": "5",
        })
        return self._req("GET", f"/rest/v1/edit_jobs?{q}") or []

    def claim(self, job_id):
        """
        จองงานแบบกันชน: อัปเดตเฉพาะแถวที่ยังเป็น 'รอเริ่มงาน' อยู่
        ถ้ามี worker อื่นคว้าไปก่อน จะได้ลิสต์ว่างกลับมา
        """
        q = urllib.parse.urlencode({
            "id": f"eq.{job_id}",
            "status": f"eq.{STATUS_WAITING}",
        })
        rows = self._req(
            "PATCH", f"/rest/v1/edit_jobs?{q}",
            body={
                "status": STATUS_RUNNING,
                "claimed_at": datetime.now(timezone.utc).isoformat(),
                "worker": self.cfg.worker_name,
                "error": "",
            },
            headers={"Prefer": "return=representation"},
        )
        return rows[0] if rows else None

    def finish(self, job_id, **fields):
        q = urllib.parse.urlencode({"id": f"eq.{job_id}"})
        self._req("PATCH", f"/rest/v1/edit_jobs?{q}", body=fields,
                  headers={"Prefer": "return=minimal"})

    def content(self, content_id):
        if not content_id:
            return None
        q = urllib.parse.urlencode({"id": f"eq.{content_id}", "limit": "1"})
        rows = self._req("GET", f"/rest/v1/contents?{q}") or []
        return rows[0] if rows else None

    def channel_names(self, ids):
        if not ids:
            return []
        q = urllib.parse.urlencode({"id": f"in.({','.join(ids)})", "select": "name"})
        rows = self._req("GET", f"/rest/v1/channels?{q}") or []
        return [r["name"] for r in rows]

    def add_media(self, name, url, kind, tags):
        self._req("POST", "/rest/v1/media_assets",
                  body={"name": name, "url": url, "kind": kind, "tags": tags},
                  headers={"Prefer": "return=minimal"})

    # ---- Storage ----

    def upload(self, path_in_bucket, file_path: Path):
        key = urllib.parse.quote(f"{self.cfg.bucket}/{path_in_bucket}")
        ctype = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
        self._req("POST", f"/storage/v1/object/{key}",
                  raw=file_path.read_bytes(), content_type=ctype,
                  headers={"x-upsert": "true"})
        return f"{self.cfg.url}/storage/v1/object/public/{key}"


# ---------------------------------------------------------------- สร้างคำสั่งให้ agent


def build_prompt(job, content, channel_names):
    """คำสั่งชุดเดียวกับที่หน้าเว็บสร้าง — อ้างสกิลของ kit ตามลำดับที่ถูกต้อง"""
    lines = [
        "ช่วยตัดคลิปนี้ให้หน่อยครับ ใช้ ii23 edit kit ตามขั้นตอนของ kit",
        "",
        f"ไฟล์ต้นทาง: {job.get('source') or '(ไม่ได้ระบุ)'}",
        f"สัดส่วนภาพ: {job.get('aspect') or '9:16'}",
        f"ความยาวเป้าหมาย: ~{job.get('target_sec') or 45} วินาที",
    ]
    if channel_names:
        lines.append(f"ปลายทาง: {', '.join(channel_names)}")
    if content and content.get("title"):
        lines.append(f"คอนเทนต์ที่ผูกไว้: {content['title']}")

    lines += ["", "สิ่งที่ต้องทำ:",
              "1. รัน ii23-analyze/scripts/analyze_context.py ให้ได้ context.json ก่อนตัดสินใจตัด"]

    if job.get("cut_silence"):
        lines.append(
            f"2. ii23-clean-cut: ตัดช่วงเงียบ/คำติดขัด/เทคที่พูดใหม่ "
            f"(เกณฑ์ความเงียบ ~{job.get('silence_ms') or 400} ms) โดยห้ามตัดกลางคำ")
    else:
        lines.append("2. ii23-clean-cut: ไม่ต้องตัดช่วงเงียบ ให้คงจังหวะเดิมไว้")

    if job.get("subtitle"):
        extra = " และทำซับ 2 ภาษา (ไทย+อังกฤษ) คนละแทร็ก" if job.get("bilingual") else ""
        lines.append(
            f"3. ii23-transcribe: ถอดเสียงเป็นซับไทย แล้วใส่ซับใน CapCut "
            f"สไตล์ \"{job.get('sub_style') or 'ขาวขอบดำ อ่านง่าย'}\"{extra}")
    else:
        lines.append("3. ไม่ต้องใส่ซับ")

    if job.get("bgm") or job.get("sfx"):
        parts = []
        if job.get("bgm"):
            parts.append(f"เพลงประกอบโทน \"{job.get('bgm_mood') or 'อัปบีต สนุก'}\"")
        if job.get("sfx"):
            parts.append("SFX ตามจังหวะที่เปลี่ยนประเด็น")
        lines.append(f"4. ii23-find-assets: หา{' และ '.join(parts)} "
                     f"(ใช้แหล่งที่ลิขสิทธิ์ใช้เชิงพาณิชย์ได้)")
    else:
        lines.append("4. ไม่ต้องใส่เพลง/SFX")

    lines += [
        f"5. จังหวะตัด/ทรานซิชัน: {job.get('transition') or 'คัตตรง'}",
        "6. รัน ii23-capcut/scripts/qc_edit.py จนผ่าน แล้วค่อยส่งงาน",
        "7. เรนเดอร์ไฟล์สุดท้ายเป็น mp4 ไว้ใต้โฟลเดอร์ output/ ของ kit",
    ]
    if job.get("note"):
        lines += ["", f"หมายเหตุเพิ่มเติม: {job['note']}"]

    lines += [
        "",
        "งานนี้รันแบบไม่มีคนนั่งเฝ้า — ถ้าเจอจุดที่ต้องตัดสินใจแทนผม",
        "ให้เลือกทางที่ปลอดภัยที่สุด (เก็บเนื้อหาไว้ ดีกว่าตัดทิ้งผิด) แล้วบันทึกไว้ในผลสรุปว่าเลือกอะไรเพราะอะไร",
        "ห้ามเดาสิ่งที่ตรวจสอบไม่ได้ ให้รายงานตามจริงว่ายังไม่ยืนยัน",
    ]
    return "\n".join(lines)


# ---------------------------------------------------------------- รันงาน


def newest_video(root: Path, since: float):
    """หาไฟล์วิดีโอที่เพิ่งถูกสร้าง/แก้ไขหลังเริ่มงาน (ผลลัพธ์ของรอบนี้)"""
    best, best_mtime = None, since
    for p in root.rglob("*"):
        if p.suffix.lower() in VIDEO_EXTS and p.is_file():
            m = p.stat().st_mtime
            if m > best_mtime:
                best, best_mtime = p, m
    return best


def run_job(cfg: Config, supa: Supa, job, dry_run=False):
    title = job.get("title") or "งานตัดคลิป"
    print(f"\n▶ รับงาน: {title}  (id={job['id'][:8]})")

    content = supa.content(job.get("content_id"))
    names = supa.channel_names(content.get("channel_ids") or []) if content else []
    prompt = build_prompt(job, content, names)

    if dry_run:
        print("--- คำสั่งที่จะส่งให้ agent (โหมดทดลอง ไม่รันจริง) ---")
        print(prompt)
        print("---------------------------------------------------")
        return

    src = job.get("source") or ""
    if src and not Path(src).exists():
        raise RuntimeError(f"ไม่พบไฟล์ต้นทางในเครื่องนี้: {src}")

    kit = Path(cfg.kit_dir)
    started = time.time()
    cmd = cfg.agent_cmd.split() + [prompt]
    print(f"  สั่ง agent: {' '.join(cfg.agent_cmd.split())} … (timeout {cfg.timeout}s)")

    try:
        proc = subprocess.run(cmd, cwd=str(kit), capture_output=True,
                              text=True, timeout=cfg.timeout)
    except FileNotFoundError:
        raise RuntimeError(
            f"เรียกคำสั่ง '{cfg.agent_cmd.split()[0]}' ไม่ได้ — ตรวจว่าติดตั้งแล้วและอยู่ใน PATH "
            f"(ตั้งค่าได้ที่ AGENT_CMD ใน worker/.env)") from None
    except subprocess.TimeoutExpired:
        raise RuntimeError(f"งานใช้เวลาเกิน {cfg.timeout} วินาที — ยกเลิกแล้ว") from None

    log = (proc.stdout or "") + (proc.stderr or "")
    tail = log[-2000:]

    if proc.returncode != 0:
        raise RuntimeError(f"agent จบด้วย exit code {proc.returncode}\n{tail[-600:]}")

    out_root = kit / "output"
    result = newest_video(out_root, started) if out_root.is_dir() else None
    if not result:
        raise RuntimeError("agent ทำงานจบแล้วแต่ไม่เจอไฟล์วิดีโอใหม่ใต้ output/ — เช็ก log ด้านล่าง\n" + tail[-600:])

    print(f"  ได้ไฟล์: {result}  ({result.stat().st_size/1048576:.1f} MB)")
    safe = re.sub(r"[^A-Za-z0-9._-]+", "-", result.name)
    public_url = supa.upload(f"{job['id']}/{safe}", result)
    print(f"  อัปขึ้น Storage แล้ว: {public_url}")

    supa.finish(job["id"], status=STATUS_REVIEW, result_url=public_url,
                finished_at=datetime.now(timezone.utc).isoformat(), log_tail=tail, error="")

    # ใส่เข้าแกลลอรี่ให้เลย จะได้แนบกับคอนเทนต์ได้ทันที
    try:
        supa.add_media(result.name, public_url, "video", ["ตัดจากโรงตัดคลิป"])
    except Exception as e:      # ไม่สำเร็จก็ไม่ถือว่างานล้มเหลว
        print(f"  (เตือน) เพิ่มเข้าแกลลอรี่ไม่สำเร็จ: {e}")

    print("✅ เสร็จแล้ว — สถานะเปลี่ยนเป็น 'รอตรวจ'")


# ---------------------------------------------------------------- main


def main():
    ap = argparse.ArgumentParser(description="worker รับงานตัดคลิปจากระบบบริหารคอนเทนต์")
    ap.add_argument("--once", action="store_true", help="เคลียร์งานที่ค้างรอบเดียวแล้วออก")
    ap.add_argument("--dry-run", action="store_true", help="พิมพ์คำสั่งให้ดูเฉย ๆ ไม่เรียก agent")
    args = ap.parse_args()

    load_env()
    cfg = Config()
    problems = cfg.check()
    if problems:
        print("ตั้งค่ายังไม่ครบครับ:")
        for p in problems:
            print(f"  • {p}")
        print("\nดูตัวอย่างค่าที่ต้องใส่ได้ที่ worker/.env.example")
        sys.exit(1)

    supa = Supa(cfg)
    print(f"worker '{cfg.worker_name}' พร้อมรับงาน")
    print(f"  kit: {cfg.kit_dir}")
    print(f"  ถามงานทุก {cfg.poll} วินาที — กด Ctrl+C เพื่อหยุด")

    while True:
        try:
            jobs = supa.waiting_jobs()
        except Exception as e:
            print(f"! ดึงคิวไม่สำเร็จ: {e}")
            jobs = []

        for job in jobs:
            claimed = None
            try:
                claimed = supa.claim(job["id"]) if not args.dry_run else job
                if not claimed:
                    continue                      # worker อื่นคว้าไปแล้ว
                run_job(cfg, supa, claimed, dry_run=args.dry_run)
            except Exception as e:
                msg = str(e)
                print(f"✗ งานล้มเหลว: {msg.splitlines()[0]}")
                if claimed and not args.dry_run:
                    try:
                        supa.finish(claimed["id"], status=STATUS_FAILED, error=msg[:1500],
                                    finished_at=datetime.now(timezone.utc).isoformat())
                    except Exception as e2:
                        print(f"  (เตือน) อัปเดตสถานะงานไม่สำเร็จ: {e2}")

        if args.once:
            print("จบรอบเดียวตามที่สั่ง")
            return
        time.sleep(cfg.poll)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nหยุด worker แล้วครับ")
