#!/usr/bin/env python3
"""v15 round 4 checks for Mitt rum, the room engine and the look pictures. Run after `python3 tools/build.py`:
   python3 test/v15r4_rum.py
Phones (360, 390, 430, real touch events), tablets (820, 1024 touch) and computers (1280, 1440, 1920)."""
import http.server, io, re, socketserver, sys, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
fails, n = [], 0


def ok(cond, name):
    global n
    n += 1
    if not cond:
        fails.append(name)
        print("  FAIL", name)


class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


class Srv(socketserver.ThreadingTCPServer):
    daemon_threads = True

    def handle_error(self, *a):
        pass


srv = Srv(("127.0.0.1", 0), lambda *a, **k: H(*a, directory=str(ROOT), **k))
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{srv.server_address[1]}/"
UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
SAMPLE = """async (r) => { const im = new Image(); await new Promise((ok) => { im.onload = ok; im.src = 'assets/img/rum/' + r + '-1600.webp'; });
  await RQ.room.saveImage(im, { sample: true, map: r, type: r, name: r }); }"""
SPOT = "(h) => { const it = RQ.room.scene().find((x) => x.h === h); return it ? [it.x, it.y, it.w] : null; }"
RECT = "(s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; }"
VISIBLE_ITEM = """(() => { const s = document.getElementById('rmStage').getBoundingClientRect(); const e = [...document.querySelectorAll('.rm-item')].find((e) => { const r = e.getBoundingClientRect(); return r.left > s.left + 10 && r.right < s.right - 10 && r.top > s.top && r.bottom < s.bottom - 60; }); return e ? e.dataset.h : null; })()"""


def ctx_for(b, w, h, mobile, night=False):
    kw = dict(viewport={"width": w, "height": h})
    if mobile:
        kw.update(device_scale_factor=2, is_mobile=True, has_touch=True, user_agent=UA)
    c = b.new_context(**kw)
    c.route(re.compile(r"^https?://(?!127\.0\.0\.1)"), lambda r: r.abort())
    c.add_init_script("localStorage.getItem('rumiq-consent') || localStorage.setItem('rumiq-consent', JSON.stringify({ stats: false, ads: false, at: '2026-01-01' }))")
    if night:
        c.add_init_script("localStorage.setItem('rumiq-ljus', 'kvall')")
    return c


def new_page(c):
    pg = c.new_page(); pg.set_default_timeout(9000); pg.errs = []
    pg.on("pageerror", lambda e: pg.errs.append(str(e)))
    return pg


def touch(cdp, typ, pts):
    cdp.send("Input.dispatchTouchEvent", {"type": typ, "touchPoints": [{"x": x, "y": y, "id": i} for i, (x, y) in enumerate(pts)]})


def tap(pg, cdp, x, y):
    touch(cdp, "touchStart", [(x, y)]); pg.wait_for_timeout(40); touch(cdp, "touchEnd", []); pg.wait_for_timeout(260)


def swipe(pg, cdp, x0, y0, x1, y1, steps=10):
    touch(cdp, "touchStart", [(x0, y0)]); pg.wait_for_timeout(60)
    for i in range(1, steps + 1):
        touch(cdp, "touchMove", [(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps)]); pg.wait_for_timeout(16)
    touch(cdp, "touchEnd", []); pg.wait_for_timeout(350)


def pinch(pg, cdp, cx, cy, d0, d1, steps=8):
    touch(cdp, "touchStart", [(cx - d0, cy), (cx + d0, cy)]); pg.wait_for_timeout(60)
    for i in range(1, steps + 1):
        d = d0 + (d1 - d0) * i / steps
        touch(cdp, "touchMove", [(cx - d, cy), (cx + d, cy)]); pg.wait_for_timeout(16)
    touch(cdp, "touchEnd", []); pg.wait_for_timeout(350)


def mid(pg, sel):
    r = pg.evaluate(RECT, sel)
    return ((r[0] + r[2]) / 2, (r[1] + r[3]) / 2)


def room_page(b, w, h, mob, room="vardagsrum", items=(), night=False):
    c = ctx_for(b, w, h, mob, night); pg = new_page(c)
    pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(300); pg.evaluate(SAMPLE, room)
    pg.evaluate("(hs) => { RQ.room.saveScene([]); hs.forEach((h) => RQ.room.add(h, true)); }", list(items))
    pg.goto(BASE + "butik/"); pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(1200)
    return c, pg


with sync_playwright() as p:
    b = p.chromium.launch()

    # ---------------------------------------------------------------- the size slider's spoken value follows a pinch
    for W, Hh in ((390, 844), (360, 740)):
        tag = f"[pinch {W}]"
        c, pg = room_page(b, W, Hh, True, items=("lysa-keramiklampa",))
        cdp = c.new_cdp_session(pg); h = "lysa-keramiklampa"
        x, y = mid(pg, f'.rm-item[data-h="{h}"]'); tap(pg, cdp, x, y)
        t0 = pg.get_attribute("#rmSize", "aria-valuetext")
        touch(cdp, "touchStart", [(x - 25, y), (x + 25, y)]); pg.wait_for_timeout(60)
        for i in range(1, 7):
            touch(cdp, "touchMove", [(x - 25 - 6 * i, y), (x + 25 + 6 * i, y)]); pg.wait_for_timeout(16)
        t1 = pg.get_attribute("#rmSize", "aria-valuetext")
        touch(cdp, "touchEnd", []); pg.wait_for_timeout(350)
        ok(t0 and t1 and t1 != t0 and t1.startswith("Storlek "), f"{tag} the slider's spoken value changes during a pinch: {t0} -> {t1}")
        ok(not pg.errs, f"{tag} no script errors: {pg.errs[:2]}")
        c.close()
    # ---------------------------------------------------------------- one Ångra at a time in Mitt rum: the button on the room
    for W, Hh, mob in ((390, 844, True), (1440, 900, False)):
        tag = f"[one undo {W}]"
        c, pg = room_page(b, W, Hh, mob)
        pg.evaluate("document.getElementById('rmSuggest').click()"); pg.wait_for_timeout(900)
        ok(pg.is_visible("#rmUndo") and not pg.evaluate("!!document.querySelector('.toast.show [data-room-undo]')"), f"{tag} after Inred åt mig only the Ångra button on the room shows")
        h = pg.evaluate("RQ.room.scene()[0].h"); pg.evaluate(f"document.querySelector('[data-del=\"{h}\"]').click()"); pg.wait_for_timeout(300)
        ok(pg.is_visible("#rmUndo") and not pg.evaluate("!!document.querySelector('.toast.show [data-room-undo]')"), f"{tag} after Ta bort only the Ångra button on the room shows")
        n0 = pg.evaluate("RQ.room.scene().length"); pg.click("#rmUndo"); pg.wait_for_timeout(300)
        ok(pg.evaluate("RQ.room.scene().length") == n0 + 1, f"{tag} the button brings it back")
        ok(not pg.errs, f"{tag} no script errors: {pg.errs[:2]}")
        c.close()
#CHECKS
    b.close()

print(f"{n - len(fails)} of {n} checks passed")
sys.exit(1 if fails else 0)
