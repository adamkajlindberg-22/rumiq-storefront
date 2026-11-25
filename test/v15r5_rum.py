#!/usr/bin/env python3
"""v15 round 5 checks for Mitt rum, the room engine, the AI sheet and the look dots. Run after `python3 tools/build.py`:
   python3 test/v15r5_rum.py
Phones (360, 390, 430, real touch events), tablets (820, 1024 touch) and computers (1280, 1440, 1920)."""
import http.server, io, re, socketserver, sys, threading
from PIL import Image
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

OWNAR = """async ([r, ar]) => { const im = new Image(); await new Promise((ok) => { im.onload = ok; im.src = 'assets/img/rum/' + r + '-1600.webp'; });
  const H = 893, W = Math.round(H * ar), cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.getContext('2d').drawImage(im, (1600 - W) / 2, 0, W, H, 0, 0, W, H);
  const im2 = new Image(); await new Promise((ok) => { im2.onload = ok; im2.src = cv.toDataURL('image/jpeg', .9); });
  RQ.room.saveScene([]); await RQ.room.saveImage(im2, { name: 'Mitt rum' }); }"""
SIZES = ((360, 740, True), (390, 844, True), (430, 932, True), (820, 1180, True), (1024, 768, True), (1280, 720, False), (1440, 900, False), (1920, 1080, False))
VT = "document.getElementById('rmSize').getAttribute('aria-valuetext')"


def own_page(b, w, h, mob, ar, items=(), night=False, en=False):
    c = ctx_for(b, w, h, mob, night)
    if en:
        c.add_init_script("""localStorage.setItem('rumiq-lang', '"en"')""")
    pg = new_page(c)
    pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(300); pg.evaluate(OWNAR, ["sovrum", ar])
    pg.evaluate("(hs) => hs.forEach((h) => RQ.room.add(h, true))", list(items))
    pg.goto(BASE + "butik/"); pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(1200)
    return c, pg


with sync_playwright() as p:
    b = p.chromium.launch()

    # ---------------------------------------------------------------- D13: no "Håll för före" in an empty room; D14: the toolbar is as wide as the photo
    for W, Hh, mob in SIZES:
        for night in (False, True):
            tag = f"[empty {W}{' kväll' if night else ''}]"
            c, pg = room_page(b, W, Hh, mob, night=night)
            ok(pg.evaluate("document.getElementById('rmHold').hidden"), f"{tag} 'Håll för före' is hidden while the room is empty")
            pg.evaluate("document.getElementById('rmSuggest0').click()"); pg.wait_for_timeout(900)
            ok(not pg.evaluate("document.getElementById('rmHold').hidden") and (W <= 900 or pg.is_visible("#rmHold")), f"{tag} it comes back with the first thing")
            ok(not pg.errs, f"{tag} no script errors: {pg.errs[:2]}")
            c.close()
    ALIGN = """(() => { const q = (s) => { const e = document.querySelector(s); if (!e || !e.offsetWidth) return null; const r = e.getBoundingClientRect(); return [r.left, r.right]; };
      return { st: q('#rmStage'), tools: q('.rm-tools'), cap: q('.rm-stagewrap .caption'), more: q('.rm-stagewrap .rm-more') }; })()"""
    for W, Hh, mob in SIZES:
        if W <= 900:
            continue
        for ar in (0.75, 1.333, 1.79):
            tag = f"[D14 {W} {ar}]"
            c, pg = own_page(b, W, Hh, mob, ar, items=("lysa-keramiklampa",))
            a = pg.evaluate(ALIGN)
            ok(abs(a["tools"][0] - a["st"][0]) < 1.5 and abs(a["tools"][1] - a["st"][1]) < 1.5, f"{tag} the toolbar is exactly as wide as the photo: {a['st']} vs {a['tools']}")
            ok(abs(a["cap"][0] - a["st"][0]) < 1.5 and abs(a["more"][0] - a["st"][0]) < 1.5, f"{tag} the caption and the chips start at the photo's left edge")
            c.close()

    # ---------------------------------------------------------------- D5: the keyboard goes on working after a drag
    for W, Hh in ((1280, 720), (1440, 900), (1920, 1080)):
        tag = f"[D5 {W}]"
        c, pg = room_page(b, W, Hh, False, items=("lysa-keramiklampa", "plad-ullblandning-havre"))
        h = "lysa-keramiklampa"; x, y = mid(pg, f'.rm-item[data-h="{h}"]')
        pg.mouse.move(x, y); pg.mouse.down(); pg.mouse.move(x - 50, y + 4, steps=6); pg.mouse.up(); pg.wait_for_timeout(250)
        ok(pg.evaluate("(document.activeElement.dataset || {}).h") == h, f"{tag} the moved thing keeps the focus")
        a = pg.evaluate(SPOT, h); pg.keyboard.press("ArrowRight"); pg.wait_for_timeout(150); pg.keyboard.press("+"); pg.wait_for_timeout(250)
        z = pg.evaluate(SPOT, h)
        ok(z[0] > a[0] and z[2] > a[2], f"{tag} the arrow and plus keys go on working: {a} -> {z}")
        ok(not pg.errs, f"{tag} no script errors: {pg.errs[:2]}")
        c.close()

    # ---------------------------------------------------------------- D9: the size is read relative to the start size, in English too
    for en in (False, True):
        for kind in ("sample", "own"):
            tag = f"[D9 {'en' if en else 'sv'} {kind}]"
            if kind == "sample":
                c = ctx_for(b, 1440, 900, False)
                if en:
                    c.add_init_script("""localStorage.setItem('rumiq-lang', '"en"')""")
                pg = new_page(c); pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(300); pg.evaluate(SAMPLE, "vardagsrum")
                pg.evaluate("RQ.room.saveScene([]); RQ.room.add('lysa-keramiklampa', true)"); pg.goto(BASE + "butik/"); pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(1200)
            else:
                c, pg = own_page(b, 1440, 900, False, 1.333, items=("lysa-keramiklampa",), en=en)
            pg.click('.rm-item[data-h="lysa-keramiklampa"]'); pg.wait_for_timeout(200)
            word = "Size" if en else "Storlek"
            t0 = pg.evaluate(VT)
            ok(t0 in (f"{word} 100 %", f"{word} 100%"), f"{tag} at the start the slider says 100 %: {t0}")
            pg.evaluate("(() => { const s = document.getElementById('rmSize'); s.value = s.min; s.dispatchEvent(new Event('input')); })()"); t1 = pg.evaluate(VT)
            ok(t1.startswith(word + " ") and t1 != t0 and int(re.sub(r"\D", "", t1)) < 100, f"{tag} smaller reads below 100 %: {t1}")
            pg.evaluate("(() => { const s = document.getElementById('rmSize'); s.value = s.max; s.dispatchEvent(new Event('input')); })()"); t2 = pg.evaluate(VT)
            ok(int(re.sub(r"\D", "", t2)) >= 200, f"{tag} the largest reads as a multiple of the start: {t2}")
            ok(not pg.errs, f"{tag} no script errors: {pg.errs[:2]}")
            c.close()

    # ---------------------------------------------------------------- P4: the picker row opens with the first tile at the gutter
    for W, Hh, mob in SIZES[:4]:
        tag = f"[P4 {W}]"
        c, pg = room_page(b, W, Hh, mob)
        pg.evaluate("document.getElementById('rmAdd').click()"); pg.wait_for_timeout(800)
        g = pg.evaluate("(() => { const g = document.getElementById('pickGrid'); return [g.scrollLeft, g.querySelector('button').getBoundingClientRect().left]; })()")
        ok(g[0] == 0 and g[1] >= 15, f"{tag} the first tile is not scrolled against the screen edge: {g}")
        c.close()

    # ---------------------------------------------------------------- P5: a second table lamp stays on the table where it fits, otherwise says why it is on the floor
    c = ctx_for(b, 390, 844, True); pg = new_page(c); pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(300)
    pg.evaluate(SAMPLE, "sovrum"); pg.evaluate("RQ.room.saveScene([]); ['lysa-keramiklampa', 'glob-bordslampa-opalglas', 'glod-doftljus-keramik'].forEach((h) => RQ.room.add(h, true))")
    sc = pg.evaluate("RQ.room.scene().map((i) => [i.h, i.on || ''])")
    ok(all(not on for _, on in sc), f"[P5 sovrum] two lamps and a candle all stand on the bedside table: {sc}")
    pg.evaluate(SAMPLE, "vardagsrum"); pg.evaluate("RQ.room.saveScene([]); ['lysa-keramiklampa', 'svamp-uppladdningsbar-lampa'].forEach((h) => RQ.room.add(h, true))")
    sc = pg.evaluate("RQ.room.scene().map((i) => [i.h, i.x, i.on || ''])")
    ok(all(not s[2] for s in sc) and all(72 <= s[1] <= 83 for s in sc), f"[P5 vardagsrum] a second, smaller lamp goes to the other end of the side table: {sc}")
    pg.evaluate("RQ.room.saveScene([]); RQ.room.add('lysa-keramiklampa', true)")
    pg.goto(BASE + "mitt-rum-glob-bordslampa-opalglas/"); pg.wait_for_timeout(1600)
    ts = pg.evaluate("[...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' ')")
    ok(pg.evaluate("(RQ.room.scene().find((i) => i.h === 'glob-bordslampa-opalglas') || {}).on") == "floor" and "står på golvet" in ts and "Dra den dit du vill" in ts, f"[P5 vardagsrum] a lamp that does not fit says why it is on the floor, also coming from its product page: {ts[:90]}")
    ok(not pg.evaluate("!document.getElementById('rmFirst').hidden"), "[P5] and no second message on top of it")
    ok(not pg.errs, f"[P5] no script errors: {pg.errs[:2]}")
    c.close()

    # ---------------------------------------------------------------- P6: curtains in an own photo hang as a tall panel by the side, the floor in front stays free
    for W, Hh, mob in ((390, 844, True), (1440, 900, False)):
        for ar in (0.75, 1.333, 1.79):
            tag = f"[P6 {W} {ar}]"
            c, pg = own_page(b, W, Hh, mob, ar, items=("flatad-forvaringskorg", "dagsljus-linnegardin-2-pack", "terrakottakruka-rafflad"))
            r = pg.evaluate("""(() => { const e = document.querySelector('.rm-item[data-h="dagsljus-linnegardin-2-pack"]').getBoundingClientRect(), s = document.getElementById('rmCanvas').getBoundingClientRect();
              return [(e.bottom - e.top) / s.height * 100, (e.bottom - s.top) / s.height * 100, (e.left - s.left) / s.width * 100, (e.right - s.left) / s.width * 100]; })()""")
            ok(r[0] >= 72 and 88 <= r[1] <= 95, f"{tag} the curtain hangs from near the ceiling to the floor: {[round(v) for v in r]}")
            ok(r[2] >= 0 and r[3] <= 100.5, f"{tag} and stays inside the photo")
            sc = pg.evaluate("RQ.room.scene()"); cur = next(i for i in sc if i["h"].startswith("dagsljus"))
            inf = [i["h"] for i in sc if i["h"] != cur["h"] and abs(i["x"] - cur["x"]) < cur["w"] / 2]
            ok(not inf, f"{tag} nothing is put on the floor in front of it: {inf}")
            ok(not pg.errs, f"{tag} no script errors: {pg.errs[:2]}")
            c.close()

    # ---------------------------------------------------------------- P7: the duvet's sides fade into the bed
    im = Image.open(ROOT / "assets/img/cut/vila-paslakanset-linne-rum.webp").convert("RGBA"); wv, hv = im.size; al = im.getchannel("A")
    ok(al.getpixel((int(wv * 0.04), hv // 2)) < 150 and al.getpixel((int(wv * 0.96), hv // 2)) < 150 and al.getpixel((wv // 2, hv // 2)) == 255, "[P7] the duvet picture fades out at its left and right edges and is solid in the middle")

    # ---------------------------------------------------------------- D6: a look dot's name lies over the next dot
    for W, Hh in ((1280, 720), (1440, 900), (1920, 1080)):
        c = ctx_for(b, W, Hh, False); pg = new_page(c); pg.goto(BASE + "look-mjuk-kvall/"); pg.wait_for_timeout(1200)
        d = pg.locator('.lp-stage .hs[data-hs="lysa-keramiklampa"]'); d.scroll_into_view_if_needed(); d.hover(); pg.wait_for_timeout(400)
        z = pg.evaluate("""(() => { const h = document.querySelector('.lp-stage .hs[data-hs="lysa-keramiklampa"]'); return [+getComputedStyle(h).zIndex, Math.max(...[...document.querySelectorAll('.lp-stage .hs')].filter((x) => x !== h).map((x) => +getComputedStyle(x).zIndex))]; })()""")
        ok(z[0] > z[1], f"[D6 {W}] the hovered dot (and its name) lies above the other dots: {z}")
        c.close()

    # ---------------------------------------------------------------- D12: the AI demo picture sits in the middle of its column
    for W, Hh in ((1024, 768), (1280, 720), (1440, 900), (1920, 1080)):
        tag = f"[D12 {W}]"
        c, pg = room_page(b, W, Hh, W == 1024, items=("lysa-keramiklampa", "plad-ullblandning-havre", "lin-kuddfodral", "flatad-forvaringskorg"))
        pg.evaluate("RQ.shop.signIn('test@example.com', 'Test', 'email'); localStorage.setItem('rumiq-ai-consent', JSON.stringify('x'))")
        pg.evaluate("RQ.openAI()"); pg.wait_for_timeout(2200); pg.evaluate("document.getElementById('aiGo').click()"); pg.wait_for_timeout(2600)
        f = pg.evaluate("(() => { const f = document.getElementById('aiBa').getBoundingClientRect(), p = document.querySelector('.ai-result .ai-pad').getBoundingClientRect(); return [(f.top + f.bottom) / 2, (p.top + p.bottom) / 2]; })()")
        ok(abs(f[0] - f[1]) < 30, f"{tag} the picture is centred beside the list, not at the top of a half-empty column: {[round(v) for v in f]}")
        ok(not pg.errs, f"{tag} no script errors: {pg.errs[:2]}")
        c.close()
#CHECKS
    b.close()

print(f"{n - len(fails)} of {n} checks passed")
sys.exit(1 if fails else 0)
