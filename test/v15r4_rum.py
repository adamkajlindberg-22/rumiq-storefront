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
    # ---------------------------------------------------------------- a new own photo: the room type is asked on the picture; the empty hint reads on any wall
    from PIL import Image, ImageDraw
    white = Image.new("RGB", (1600, 1200), (244, 242, 238)); ImageDraw.Draw(white).rectangle((0, 900, 1600, 1200), fill=(226, 220, 210))
    wbuf = io.BytesIO(); white.save(wbuf, "JPEG", quality=88)
    tall = Image.new("RGB", (900, 1200), (214, 206, 194)); ImageDraw.Draw(tall).rectangle((0, 780, 900, 1200), fill=(150, 112, 80))
    tbuf = io.BytesIO(); tall.save(tbuf, "JPEG", quality=88)
    for W, Hh, mob in ((360, 740, True), (390, 844, True), (430, 932, True), (820, 1180, True), (1024, 768, True), (1280, 720, False), (1440, 900, False), (1920, 1080, False)):
        tag = f"[own {W}]"
        c = ctx_for(b, W, Hh, mob); pg = new_page(c)
        pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(500); pg.evaluate("RQ.room.openSetup()"); pg.wait_for_timeout(300)
        pg.set_input_files(".sheet.open label.btn:not(.cam) input[data-room-file]", files=[{"name": "rum.jpg", "mimeType": "image/jpeg", "buffer": wbuf.getvalue()}]); pg.wait_for_timeout(2000)
        q, bar = pg.evaluate(RECT, "#rmHint .rm-hintask"), pg.evaluate(RECT, ".rm-bar")
        lim = bar[1] if bar and bar[3] > bar[1] and pg.is_visible(".rm-bar") else Hh
        ok(q and 0 < q[1] and q[3] <= lim, f"{tag} 'Vilket rum är det?' is on the first screen, above the buy bar: {q and [round(v) for v in q]} (limit {round(lim)})")
        ok(pg.is_hidden("#rmAsk"), f"{tag} and asked once, not also under the room")
        pg.click('#rmHint [data-roomtype="vardagsrum"]'); pg.wait_for_timeout(300)
        ok(pg.evaluate("RQ.room.get().type") == "vardagsrum" and pg.evaluate("document.getElementById('rmHintT').textContent") == "Rummet är tomt." and not pg.evaluate("!!document.querySelector('.rm-hintask,#rmAsk')"), f"{tag} a tap sets the room type and the question goes away")
        bgc = pg.evaluate("getComputedStyle(document.querySelector('#rmHint p')).backgroundColor")
        ok(bgc.startswith("rgba(34, 37, 42, 0.8"), f"{tag} 'Rummet är tomt.' has its own dark ground on a white wall: {bgc}")
        ok(not pg.errs, f"{tag} no script errors: {pg.errs[:2]}")
        c.close()
    # M12: the first table lamp on an own photo is the size of a lamp on a side table, also in an upright photo
    for buf, lo, hi, name in ((wbuf, 10.5, 14, "wide"), (tbuf, 15, 22, "upright")):
        c = ctx_for(b, 390, 844, True); pg = new_page(c)
        pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(500); pg.evaluate("RQ.room.openSetup()"); pg.wait_for_timeout(300)
        pg.set_input_files(".sheet.open label.btn:not(.cam) input[data-room-file]", files=[{"name": "rum.jpg", "mimeType": "image/jpeg", "buffer": buf.getvalue()}]); pg.wait_for_timeout(2000)
        pg.evaluate("RQ.room.add('lysa-keramiklampa', true)"); lamp = pg.evaluate(SPOT, "lysa-keramiklampa")
        ok(lo <= lamp[2] <= hi and 55 <= lamp[1] <= 68, f"[M12 {name}] the first table lamp starts lamp-sized at mid-height: {lamp}")
        c.close()
    # ---------------------------------------------------------------- look pictures: every dot on its own thing, a finger apart, sharp on large screens, no doubles
    DOTS = """() => { const st = document.querySelector('.lp-stage'), r = st.getBoundingClientRect();
      const its = [...st.querySelectorAll('.rc-box .rm-item')].map((e) => { const b = e.getBoundingClientRect(), h = (e.querySelector('img').src.split('/').pop() || '').replace('.webp', ''); return { h, b: [b.left, b.top, b.right, b.bottom], z: +e.style.zIndex }; });
      const ds = [...st.querySelectorAll('.hs')].filter((d) => !d.hidden).map((d) => { const b = d.getBoundingClientRect(); return { h: d.dataset.hs, x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
      return { its, ds, stage: [r.left, r.top, r.right, r.bottom], img: st.querySelector('.hs-img').getBoundingClientRect().width }; }"""
    for W, Hh, mob in ((360, 740, True), (390, 844, True), (430, 932, True), (820, 1180, True), (1024, 768, True), (1280, 720, False), (1440, 900, False), (1920, 1080, False)):
        c = ctx_for(b, W, Hh, mob); pg = new_page(c)
        for l in ("mjuk-kvall", "lugn-hall", "frukostbanken", "sov-gott", "vardagsmiddag", "spa-hemma", "fokus"):
            tag = f"[look {W} {l}]"
            pg.goto(BASE + f"look-{l}/"); pg.wait_for_timeout(900)
            d = pg.evaluate(DOTS)
            close = [(a["h"], c2["h"]) for i, a in enumerate(d["ds"]) for c2 in d["ds"][i + 1:] if ((a["x"] - c2["x"]) ** 2 + (a["y"] - c2["y"]) ** 2) ** 0.5 < 43.5]
            ok(not close, f"{tag} no two dots closer than a finger (44 px): {close}")
            for it in d["its"]:
                dot = next((x for x in d["ds"] if x["h"] == it["h"]), None)
                if not dot:
                    continue
                l0, t0, r0, b0 = it["b"]
                on = l0 - 1 <= dot["x"] <= r0 + 1 and t0 - 24 <= dot["y"] <= b0
                ok(on, f"{tag} the dot of {it['h']} sits on it: dot {round(dot['x'])},{round(dot['y'])} thing {[round(v) for v in it['b']]}")
                hid = [o["h"] for o in d["its"] if o["z"] > it["z"] and o["b"][0] + 2 < dot["x"] < o["b"][2] - 2 and o["b"][1] + 2 < dot["y"] < o["b"][3] - 2]
                ok(not hid, f"{tag} the dot of {it['h']} is not on {hid}, which stands in front of it")
            if W >= 1280:
                ok(d["img"] <= 1215, f"{tag} the 1 600 px photo is drawn at most about 1 200 px wide, so it stays sharp: {round(d['img'])}")
        pg.goto(BASE + "look-sov-gott/"); pg.wait_for_timeout(800)
        ok(not pg.evaluate("[...document.querySelectorAll('.lp-stage .rc-box img')].some((i) => /paslakan/.test(i.src))"), f"[look {W}] Sov gott: the duvet set is the one on the bed in the photo, no pile on top")
        pg.goto(BASE + "look-fokus/"); pg.wait_for_timeout(800)
        ok(not pg.evaluate("[...document.querySelectorAll('.lp-stage .rc-box img')].some((i) => /forvaringslada/.test(i.src))"), f"[look {W}] Fokus: one box, the one under the desk, not a second one in front")
        ok(not pg.errs, f"[look {W}] no script errors: {pg.errs[:2]}")
        c.close()
    # Inred åt mig in a sample room: nothing the photo already shows (a second pump, a second throw) while there is something else
    c = ctx_for(b, 1440, 900, False); pg = new_page(c); pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(400)
    for r in ("vardagsrum", "sovrum", "kok", "hall", "badrum", "hemmakontor", "uteliv"):
        pg.evaluate(SAMPLE, r); pg.evaluate("RQ.room.saveScene([])")
        picks, shown = pg.evaluate("RQ.room.suggest(4).map((p) => p.handle)"), pg.evaluate(f"RQ.HOTSPOTS['{r}'].spots.map((s) => s[0])")
        dup = [h for h in picks if h in shown]
        ok(len(picks) >= 2 and (not dup or len(picks) - len(dup) < 2), f"[suggest {r}] Inred åt mig gives at least two things and doubles what the photo shows only when nothing else suits: {picks}")
    c.close()
    # ---------------------------------------------------------------- the duvet set lies folded on the bed in the room, not as the shop's stacked pile
    for W, Hh, mob in ((390, 844, True), (1440, 900, False)):
        c, pg = room_page(b, W, Hh, mob, room="sovrum", items=("vila-paslakanset-linne",))
        src = pg.evaluate("document.querySelector('.rm-item[data-h=\"vila-paslakanset-linne\"] img').src")
        ok(src.endswith("vila-paslakanset-linne-rum.webp") and pg.evaluate("document.querySelector('.rm-item[data-h=\"vila-paslakanset-linne\"] img').naturalWidth") > 0, f"[duvet {W}] the room shows the duvet laid on the bed: {src.split('/')[-1]}")
        it = pg.evaluate(SPOT, "vila-paslakanset-linne")
        ok(18 <= it[2] <= 28 and 66 <= it[1] <= 72, f"[duvet {W}] it lies across the bed, about as wide as a folded duvet: {it}")
        ok(not pg.errs, f"[duvet {W}] no script errors: {pg.errs[:2]}")
        c.close()
    # ---------------------------------------------------------------- C9: no product name cut by the before/after line (home demo, empty Mitt rum)
    CUT = """(() => { const f = document.querySelector('.bav'), st = f.querySelector('.rh-stage'), r0 = st.getBoundingClientRect(), x = parseFloat(getComputedStyle(f).getPropertyValue('--ba')) / 100 * st.clientWidth + r0.left;
      return [...f.querySelectorAll('.rh-tag > span')].filter((t) => { const r = t.getBoundingClientRect(); return r.width && +getComputedStyle(t).opacity > 0.5 && x > r.left + 1 && x < r.right - 1; }).length; })()"""
    for W, Hh, mob in ((820, 1180, True), (1024, 768, True), (1280, 720, False), (1440, 900, False), (1920, 1080, False)):
        for url in ("", "mitt-rum/"):
            c = ctx_for(b, W, Hh, mob); pg = new_page(c)
            pg.goto(BASE + url); pg.wait_for_timeout(600)
            if not pg.evaluate("!!document.querySelector('.bav .rh-tag')"):
                c.close(); continue
            pg.evaluate("document.querySelector('.bav').scrollIntoView({ block: 'center' })")
            cut = 0
            for _ in range(16):
                pg.wait_for_timeout(150); cut += pg.evaluate(CUT)
            pg.evaluate("(() => { const r = document.querySelector('.bav .ba-range'); for (const v of [20, 35, 50, 62, 75, 88]) { r.value = v; r.dispatchEvent(new Event('input')); } })()"); pg.wait_for_timeout(300)
            for v in (30, 45, 55, 66, 80):
                pg.evaluate(f"(() => {{ const r = document.querySelector('.bav .ba-range'); r.value = {v}; r.dispatchEvent(new Event('input')); }})()"); pg.wait_for_timeout(260); cut += pg.evaluate(CUT)
            ok(cut == 0, f"[C9 {W} /{url}] the line never shows a product name cut in half, in the demo or when dragged")
            c.close()
#CHECKS
    b.close()

print(f"{n - len(fails)} of {n} checks passed")
sys.exit(1 if fails else 0)
