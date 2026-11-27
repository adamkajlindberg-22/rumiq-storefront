#!/usr/bin/env python3
"""Studio 2, the room side (STUDIO2-BRIEF): Byt och jämför, Inred åt mig with style and budget, your rooms in Mitt rum,
Byt from the AI picture and RQ.room.openWith. Run after `python3 tools/build.py`:
   python3 test/studio2_rum.py
Phone (390 and 360, touch) and desktop (1440 and 1280).
(was: Studio, the room side (studio brief): the sign-in gate for your own photo, photo intake, real size from a known
length, the surface chooser and the Mitt rum editor. Run after `python3 tools/build.py`:
   python3 test/studio_rum.py
Phone (390 and 360, touch) and desktop (1440 and 1280)."""
import base64, http.server, io, json, re, socketserver, sys, threading
from pathlib import Path
from playwright.sync_api import sync_playwright
import sys as _s, os as _o; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); # (no _edit_way: these tests are for Placera och skapa itself)

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
MODE = "document.querySelector('.roomsheet').dataset.mode"
TITLE = "document.getElementById('roomSheetTitle').textContent"
FILE = ".sheet.open label.btn:not(.cam) input[data-room-file]"


def picture(w, h, light=1.0, turn=0):
    """a test photo of a room (the bedroom sample); light < 1 darkens it; turn = an EXIF orientation to store it with"""
    from PIL import Image, ImageEnhance
    im = Image.open(ROOT / "assets/img/rum/sovrum-1600.webp").convert("RGB").resize((w, h))
    if light != 1.0:
        im = ImageEnhance.Brightness(im).enhance(light)
    b = io.BytesIO()
    if turn:
        ex = Image.Exif(); ex[0x0112] = turn
        im.save(b, "JPEG", quality=85, exif=ex.tobytes())
    else:
        im.save(b, "JPEG", quality=85)
    return b.getvalue()


def ctx_for(b, w, h, mobile, night=False):
    kw = dict(viewport={"width": w, "height": h})
    if mobile:
        kw.update(device_scale_factor=2, is_mobile=True, has_touch=True, user_agent=UA)
    ctx = b.new_context(**kw)
    ctx.route(re.compile(r"^https?://(?!127\.0\.0\.1)"), lambda r: r.abort())
    if night:
        ctx.add_init_script("localStorage.setItem('rumiq-ljus', 'kvall')")
    return ctx


def new_page(ctx):
    pg = ctx.new_page(); pg.set_default_timeout(9000); pg.errs = []; pg.choosers = 0
    pg.on("pageerror", lambda e: pg.errs.append(str(e)))
    pg.on("filechooser", lambda fc: setattr(pg, "choosers", pg.choosers + 1))
    return pg


def quiet(pg):
    pg.evaluate("document.querySelectorAll('.toast').forEach((t) => t.classList.remove('show'))")


def touch(cdp, typ, pts):
    cdp.send("Input.dispatchTouchEvent", {"type": typ, "touchPoints": [{"x": x, "y": y, "id": i} for i, (x, y) in enumerate(pts)]})


def put(pg, name, data, mime="image/jpeg"):
    pg.set_input_files(FILE, {"name": name, "mimeType": mime, "buffer": data})


def sign_in_on_page(pg, signup=False):
    """the demo account page: e-mail, the six-digit code, and back to where you came from"""
    pg.wait_for_timeout(600)
    if signup:
        pg.fill("#codeForm input[name=name]", "Anna"); pg.check("#codeForm input[name=terms]")
    pg.fill("#codeForm input[name=email]", "anna@example.com"); pg.click("#codeForm button[type=submit]"); pg.wait_for_timeout(700)
    code = pg.evaluate("document.querySelector('.example-note b[style]').textContent")
    for i, c in enumerate(code):
        pg.fill(f".otp input:nth-child({i + 1})", c)
    pg.wait_for_timeout(1600)



SC = "() => RQ.room.scene().map((i) => [i.h, i.x, i.y, i.w, i.v || 0])"
OPENSWAP = "() => [...document.querySelectorAll('[data-swap-open]')].find((b) => b.offsetParent).click()"


def editor(pg, items, room="vardagsrum"):
    pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(400); pg.evaluate(SAMPLE, room)
    pg.evaluate("(hs) => { hs.forEach((h) => RQ.room.add(h, true)); location.hash = '#mitt-rum'; RQ.router(); }", items); pg.wait_for_timeout(1300); quiet(pg)



import os
AXE = Path(os.environ.get("AXE", "/home/claude/axe/node_modules/axe-core/axe.min.js"))
RUN_AXE = """async () => { const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] }, resultTypes: ['violations'] });
  return r.violations.map((v) => v.id + ': ' + v.nodes.slice(0, 2).map((x) => x.target.join(' ')).join(' | ')); }"""
SET = [{"h": "glob-bordslampa-opalglas"}, {"h": "strand-jutematta"}, {"h": "affisch-linje-ekram"}, {"h": "plad-ullblandning-havre"}]
PINS = "RQ.room.pins()"
BTN = "(h) => { const r = document.querySelector(`[data-pin='${h}']`).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.width, r.height]; }"
STAGE = "(() => { const r = document.getElementById('plIn').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()"


def place(pg, items=SET, room="vardagsrum"):
    pg.goto(BASE + "mitt-hem/"); pg.wait_for_timeout(500); quiet(pg)
    r = pg.evaluate("([its, rm]) => RQ.room.place({ room: rm, items: its })", [items, room]); pg.wait_for_timeout(1800); quiet(pg)
    return r


with sync_playwright() as p:
    b = p.chromium.launch()
    for W, Hh, mob in ((390, 844, True), (360, 740, True), (375, 548, True), (1440, 900, False), (1280, 720, False)):
        tag = f"[place {W}x{Hh}]"
        c = ctx_for(b, W, Hh, mob); pg = new_page(c)
        ok(place(pg) is True and pg.evaluate("RQ.currentRoute()") == "mitt-rum" and pg.evaluate("document.querySelector('h1').textContent") == "Placera och skapa", f"{tag} every way in (RQ.room.place / openWith) opens Placera och skapa")
        pins = pg.evaluate(PINS)
        ok([x["h"] for x in pins] == [x["h"] for x in SET] and all(set(x) >= {"h", "v", "x", "y", "surface", "size", "scale", "w"} for x in pins), f"{tag} RQ.room.pins(): one per thing, in order, with h v x y surface size scale w")
        sf = {x["h"]: x["surface"] for x in pins}
        ok(sf == {"glob-bordslampa-opalglas": "bord", "strand-jutematta": "golv", "affisch-linje-ekram": "vagg", "plad-ullblandning-havre": "soffa"}, f"{tag} each pin has the surface it stands on: {sf}")
        rug = next(x for x in pins if x["h"] == "strand-jutematta"); glob = next(x for x in pins if x["h"] == "glob-bordslampa-opalglas")
        ok(rug["size"] == {"w": 160, "d": 230} and rug["scale"]["sure"] and glob["size"] is None and not glob["scale"]["sure"], f"{tag} measurements and an honest scale (sure for the rug, ungefär for the lamp)")
        labels = pg.evaluate("[...document.querySelectorAll('[data-pin]')].map((b) => b.getAttribute('aria-label'))")
        ok(labels[0] == "1 Glob bordslampa opalglas, står på bordet, flytta med piltangenterna" and len(labels) == 4, f"{tag} each pin is a button with its number, name and surface: {labels[0]}")
        sizes = pg.evaluate("[...document.querySelectorAll('[data-pin], #plPin button, #pl .pl-li, #plAdd, #plCreate, #plSelf, .pl-steps .tlink')].filter((e) => e.offsetParent).map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })")
        ok(all(w >= 44 and h >= 44 for w, h in sizes), f"{tag} every tap target is at least 44 px: {[s for s in sizes if min(s) < 44][:3]}")
        fw = pg.evaluate("(() => { const st = document.getElementById('plIn').getBoundingClientRect(); return [...document.querySelectorAll('.pl-foot')].map((f) => +(f.getBoundingClientRect().width / st.width * 100).toFixed(1)); })()")
        ok(all(abs(a - x["w"]) < 1.2 for a, x in zip(fw, pins)) and "ungefär" in pg.evaluate("document.querySelectorAll('.pl-foot')[0].textContent"), f"{tag} the dashed footprints are drawn at the things' widths, the estimated one says ungefär: {fw}")
        st = pg.evaluate(STAGE); ok(st[1] + st[3] <= Hh + 2 or mob and st[3] > 120, f"{tag} the picture is on the first screen: {st}")
        # choose a pin, change its surface, move it with a tap
        x0, y0, bw, bh = pg.evaluate(BTN, "glob-bordslampa-opalglas")
        (pg.tap if mob else pg.click)(f"[data-pin='glob-bordslampa-opalglas']"); pg.wait_for_timeout(300)
        ok(not pg.evaluate("document.getElementById('plPin').hidden") and pg.evaluate("[...document.querySelectorAll('#plPin [data-surf]')].map((b) => b.textContent)") == ["bord", "golv"], f"{tag} a chosen pin shows its surfaces, one tap to change")
        pg.evaluate("document.querySelector('#plPin [data-surf=golv]').click()"); pg.wait_for_timeout(300)
        g = next(x for x in pg.evaluate(PINS) if x["h"] == "glob-bordslampa-opalglas")
        ok(g["surface"] == "golv", f"{tag} the lamp now stands on the floor: {g['surface']}")
        st = pg.evaluate(STAGE)
        pg.evaluate("(h) => document.querySelector(`[data-pin='${h}']`).scrollIntoView({ block: 'center' })", "glob-bordslampa-opalglas"); pg.wait_for_timeout(200); st = pg.evaluate(STAGE)
        # the side table's right end: far enough from the other pins that a finger's touch is not drawn to one of them
        tx, ty = st[0] + st[2] * 0.80, st[1] + st[3] * 0.66
        if W >= 390:
            (pg.touchscreen.tap if mob else pg.mouse.click)(tx, ty); pg.wait_for_timeout(400)
            g = next(x for x in pg.evaluate(PINS) if x["h"] == "glob-bordslampa-opalglas")
            ok(abs(g["x"] - 80) < 6 and g["surface"] == "bord", f"{tag} a tap on the side table moves the chosen lamp there, on the table: {g}")
        else:  # a 200 px tall picture: a finger near the side table is drawn to a pin there, so the open wall shows the same
            pg.evaluate("document.querySelector('[data-pick=affisch-linje-ekram]').click()"); pg.wait_for_timeout(200); st = pg.evaluate(STAGE)
            pg.touchscreen.tap(st[0] + st[2] * 0.15, st[1] + st[3] * 0.35); pg.wait_for_timeout(400)
            a0 = next(x for x in pg.evaluate(PINS) if x["h"] == "affisch-linje-ekram")
            ok(abs(a0["x"] - 15) < 4 and a0["surface"] == "vagg", f"{tag} a tap on the wall moves the chosen print there: {a0}")
        # keyboard: arrows move, Delete removes
        pg.focus("[data-pin='affisch-linje-ekram']"); x1 = next(x for x in pg.evaluate(PINS) if x["h"] == "affisch-linje-ekram")["x"]
        pg.keyboard.press("ArrowRight"); pg.wait_for_timeout(250)
        a = next(x for x in pg.evaluate(PINS) if x["h"] == "affisch-linje-ekram")
        ok(abs(a["x"] - (x1 + 1)) < 0.11 and pg.evaluate("document.activeElement.dataset.pin") == "affisch-linje-ekram", f"{tag} an arrow key moves the pin and keeps the focus: {x1} -> {a['x']}")
        ok("% från vänster" in pg.evaluate("document.getElementById('plHint').textContent"), f"{tag} and says where it is")
        # order
        pg.evaluate("document.querySelector('[data-pick=strand-jutematta]').click()"); pg.wait_for_timeout(200); pg.evaluate("document.querySelector('#plPin [data-ord=\"1\"]').click()"); pg.wait_for_timeout(300)
        ok([x["h"] for x in pg.evaluate(PINS)][2] == "strand-jutematta" and pg.evaluate("document.querySelector(\"[data-pin='strand-jutematta']\").textContent") == "3", f"{tag} Senare makes the rug number 3")
        if not mob:
            # drag a pin with the mouse
            x0, y0, _, _ = pg.evaluate(BTN, "plad-ullblandning-havre"); st = pg.evaluate(STAGE)
            pg.mouse.move(x0, y0); pg.mouse.down(); pg.mouse.move(x0 - st[2] * 0.08, y0, steps=8); pg.mouse.up(); pg.wait_for_timeout(400)
            pl = next(x for x in pg.evaluate(PINS) if x["h"] == "plad-ullblandning-havre")
            ok(pl["x"] < 64, f"{tag} a pin can be dragged: {pl['x']}")
        pg.focus("[data-pin='affisch-linje-ekram']"); pg.keyboard.press("Delete"); pg.wait_for_timeout(300)
        ok("affisch-linje-ekram" not in [x["h"] for x in pg.evaluate(PINS)] and pg.evaluate("!!document.activeElement.dataset.pin"), f"{tag} Delete removes a pin and the focus goes to the next")
        # Skapa bilden: the AI side's event, and the honest preview while the AI is off
        pg.evaluate("window.__pc = null; document.addEventListener('rq-place-create', (e) => { window.__pc = e.detail; })")
        pg.evaluate("document.getElementById('plCreate').click()"); pg.wait_for_timeout(2200)
        pc = pg.evaluate("window.__pc && [window.__pc.pins.length, window.__pc.room.w > 0, !!window.__pc.room.src]")
        ok(pc == [3, True, True], f"{tag} Skapa bilden hands the pins and the room to the AI side (rq-place-create): {pc}")
        # the AI side (ai.js) takes the event and shows its sheet; without it, the room's own preview below the pins
        for _ in range(30):
            if pg.evaluate("((document.querySelector('.ai-sheet.open') || document.getElementById('plResult')).innerText || '').includes('Ingenting har skickats')"): break
            pg.wait_for_timeout(300)
        res = pg.evaluate("(() => { const a = document.querySelector('.ai-sheet.open'); if (a) return [false, (a.querySelector('img') || {}).src || 'data:image/jpeg', a.innerText.replace(/\\n+/g, ' ')]; const r = document.getElementById('plResult'); return [r.hidden, (r.querySelector('img') || {}).src || '', r.innerText]; })()")
        ok(not res[0] and res[1] and "Förhandsvisning" in res[2] and "Ingenting har skickats" in res[2], f"{tag} while the AI is off: an honest, labelled preview: {res[2][:80]}")
        tot = pg.evaluate("RQ.room.pins().reduce((t, x) => t + RQ.byHandle(x.h).price, 0)")
        ok(f"Köp allt i bilden · {pg.evaluate('(n) => RQ.shop.kr(n)', tot)}".replace("\u00a0", " ") in res[2].replace("\u00a0", " "), f"{tag} Köp allt i bilden with the total of exactly these things")
        pg.evaluate("(() => { const x = document.querySelector('.ai-sheet.open [data-ai-close], .ai-sheet.open .sheet-x, .ai-sheet.open [aria-label=Stäng]'); if (x) x.click(); })()"); pg.wait_for_timeout(500)
        if AXE.exists():
            # (.roompill, the nav's Mitt rum pill, is app.js: its label lacks the count it shows; told to the coordinator)
            pg.add_script_tag(content=AXE.read_text()); v = [x for x in pg.evaluate(RUN_AXE) if not x.startswith("label-content-name-mismatch: .roompill")]; ok(not v, f"{tag} axe: {v[:3]}")
        # Justera själv: the editor on the same things; and back
        hs = [x["h"] for x in pg.evaluate(PINS)]
        pg.evaluate("document.getElementById('plSelf').click()"); pg.wait_for_timeout(1200)
        ok(pg.evaluate("!!document.getElementById('rmStage')") and pg.evaluate("RQ.room.scene().map((i) => i.h)")[:3] == hs, f"{tag} Justera själv opens the editor with the same things where the pins are")
        pg.evaluate("document.getElementById('rmToPlace').click()"); pg.wait_for_timeout(900)
        ok(pg.evaluate("!!document.getElementById('plStage')"), f"{tag} and Tillbaka till Placera och skapa comes back")
        ok(not pg.errs, f"{tag} no script errors: {pg.errs[:2]}")
        c.close()


    # a phone: Förstora bilden makes the picture twice as wide; a pin is placed the same way there
    c = ctx_for(b, 360, 740, True); pg = new_page(c); place(pg)
    pg.evaluate("document.querySelector('[data-pick=glob-bordslampa-opalglas]').click()"); pg.wait_for_timeout(200)
    pg.tap("#plZoom"); pg.wait_for_timeout(600)
    z = pg.evaluate("(() => { const s = document.getElementById('plStage'), i = document.getElementById('plIn'); return [i.offsetWidth / s.clientWidth, s.scrollLeft > 0, document.getElementById('plZoom').getAttribute('aria-pressed')]; })()")
    ok(z[0] > 1.9 and z[1] and z[2] == "true", f"[zoom 360] Förstora bilden: twice as wide, scrolled to the chosen lamp: {z}")
    st = pg.evaluate(STAGE); sx = pg.evaluate("document.getElementById('plStage').getBoundingClientRect().left")
    tx = st[0] + st[2] * 0.80; pg.touchscreen.tap(tx, st[1] + st[3] * 0.66); pg.wait_for_timeout(400)
    g = next(x for x in pg.evaluate(PINS) if x["h"] == "glob-bordslampa-opalglas")
    ok(abs(g["x"] - 80) < 4 and g["surface"] == "bord", f"[zoom 360] and a tap on the side table puts the lamp there: {g}")
    c.close()

    # at most five in the picture; the rest is said
    c = ctx_for(b, 390, 844, True); pg = new_page(c)
    place(pg, SET + [{"h": "flatad-forvaringskorg"}, {"h": "terrakottakruka-rafflad"}, {"h": "dagsljus-linnegardin-2-pack"}])
    ok(len(pg.evaluate("RQ.room.scene()")) > 5 and pg.evaluate("document.querySelectorAll('[data-pin]').length") == 5 and "fem" in pg.evaluate("document.getElementById('plGoNote').textContent"), "[five] five pins at most, and the page says the picture takes five")
    # the product page's Prova i Mitt rum: into Placera och skapa, the thing chosen to be pointed out
    pg.goto(BASE + "produkt-svamp-uppladdningsbar-lampa/"); pg.wait_for_timeout(900); quiet(pg); pg.evaluate("document.querySelector('.roomcta').click()"); pg.wait_for_timeout(2200)
    ok(pg.evaluate("!!document.getElementById('plStage')") and pg.evaluate("RQ.room.inScene('svamp-uppladdningsbar-lampa')"), "[pdp] Prova i Mitt rum opens Placera och skapa with the lamp in it")
    ok("är vald" in pg.evaluate("document.getElementById('plHint').textContent") or pg.evaluate("document.querySelector(\"[data-pin='svamp-uppladdningsbar-lampa']\") && document.querySelector(\"[data-pin='svamp-uppladdningsbar-lampa']\").classList.contains('on')"), "[pdp] and the lamp is chosen, ready to be pointed out")
    c.close()

    # D7: a thing for a table never stands on what already stands on a sample room's tables (the mug on the side table, the
    # basin, the jars, the plant): its whole width keeps clear of the busy areas, from a product page and when pinned by hand
    c = ctx_for(b, 1440, 900, False); pg = new_page(c); pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(600)
    CLEAR = """(rm) => { const M = RQ.room._maps[rm], bad = []; RQ.room.scene().forEach((it) => { const p = RQ.byHandle(it.h); if (RQ.room._kind(p) !== 'surface' || it.on) return;
      (M.busy || []).forEach(([a, b, y, top]) => { if (Math.abs(y - it.y) < 4 && !(top != null && it.y < top)) { const bs = RQ.room._base(p), up = top != null ? (it.y - top + 1.5) / (it.w * RQ.room._ratio(p) * 1600 / 893) : 1, half = it.w / 2 * (bs && up <= bs[0] ? bs[1] : 1);
        if (it.x + half > a - 0.25 && it.x - half < b + 0.25) bad.push([it.h, it.x, it.w, a, b]); } });
      const es = (M.edge || []).filter((e) => Math.abs(e[2] - it.y) < 4); if (es.length && !es.some(([a, b]) => it.x >= a && it.x <= b)) bad.push([it.h, 'off the table', it.x]); }); return bad; }"""
    rooms_busy = pg.evaluate("Object.keys(RQ.room._maps).filter((r) => (RQ.room._maps[r].busy || []).length)")
    ok(len(rooms_busy) == 7, f"[D7] every sample room knows what stands on its tables: {rooms_busy}")
    bad_all = []
    for rm in rooms_busy:
        pg.evaluate(SAMPLE, rm); pg.wait_for_timeout(150)
        for pre in ([], ["svamp-uppladdningsbar-lampa"], ["glod-doftljus-keramik"], ["lysa-keramiklampa"], ["sand-keramikvas", "glod-doftljus-keramik"], ["stilla-ljusstake-massing-2-pack", "tvalpump-stengods"]):
            pg.evaluate("RQ.room.saveScene([], true)")
            for h in pre: pg.evaluate("(h) => RQ.room.add(h, true)", h)
            pg.evaluate("RQ.room.tryIn('glob-bordslampa-opalglas')")
            bad_all += [(rm, pre, x) for x in pg.evaluate(CLEAR, rm)]
        # pinned by hand right on the busy area: it goes to the nearest free place on that table instead
        pg.evaluate("RQ.room.saveScene([], true)"); pg.evaluate("RQ.room.add('glob-bordslampa-opalglas', true)")
        for a_, b_, y_, *_ in pg.evaluate("(rm) => RQ.room._maps[rm].busy", rm):
            pg.evaluate("([x, y]) => RQ.room.movePin('glob-bordslampa-opalglas', x, y, 'bord')", [(a_ + b_) / 2, y_])
            bad_all += [(rm, "pin", x) for x in pg.evaluate(CLEAR, rm)]
    ok(not bad_all, f"[D7] the glob lamp (from a product page, beside other things, or pinned on top of something) stands on a free part of the table: {bad_all[:4]}")
    pg.evaluate(SAMPLE, "vardagsrum"); pg.wait_for_timeout(150); pg.evaluate("RQ.room.saveScene([], true)"); pg.evaluate("RQ.room.tryIn('glob-bordslampa-opalglas')")
    g = pg.evaluate(SPOT, "glob-bordslampa-opalglas")
    ok(g and g[0] - g[2] / 2 >= 79.3 and g[0] + g[2] * 0.25 <= 84.6, f"[D7] the living room: the glob lamp stands right of the mug, on the side table: {g}")
    ok(not pg.errs, f"[D7] no script errors: {pg.errs[:2]}")
    c.close()

    # B1: product page -> Prova i Mitt rum -> Prova med ett exempelrum: the product is pinned and chosen in Placera och skapa
    for url in ("produkt-glob-bordslampa-opalglas/", "mitt-rum-glob-bordslampa-opalglas/"):
        c = ctx_for(b, 390, 844, True); pg = new_page(c); pg.goto(BASE + url); pg.wait_for_timeout(1200); quiet(pg)
        if url.startswith("produkt"):
            pg.wait_for_selector(".roomcta", state="attached", timeout=15000); pg.evaluate("document.querySelector('.roomcta').click()"); pg.wait_for_timeout(1500)
        pg.evaluate("[...document.querySelectorAll('[data-room-sample-now]')].find((b) => b.offsetParent).click()"); pg.wait_for_timeout(2600)
        ok(pg.evaluate("!!document.getElementById('plStage')") and pg.evaluate("RQ.room.inScene('glob-bordslampa-opalglas')") and pg.evaluate("!!document.querySelector(\"[data-pin='glob-bordslampa-opalglas'].on\")"), f"[B1 {url}] the lamp is in the sample room, pinned and chosen")
        ok(not pg.errs, f"[B1 {url}] no script errors: {pg.errs[:2]}")
        c.close()

    # B2: a rug stays on the floor (keyboard, a tap high up); M1: a table thing put on the wall goes to a free place on a table,
    # never onto another pin, and the page says why
    c = ctx_for(b, 1440, 900, False); pg = new_page(c); place(pg); pg.evaluate("RQ.room.add('glod-doftljus-keramik', true)"); pg.wait_for_timeout(300)
    pg.focus("[data-pin='strand-jutematta']")
    for _ in range(12): pg.keyboard.press("Shift+ArrowUp"); pg.wait_for_timeout(40)
    r = next(x for x in pg.evaluate(PINS) if x["h"] == "strand-jutematta")
    ok(r["y"] >= 82 and r["surface"] == "golv", f"[B2] Shift+Up does not lift the rug off the floor: {r}")
    pg.evaluate("RQ.room.movePin('strand-jutematta', 30, 40)"); r = next(x for x in pg.evaluate(PINS) if x["h"] == "strand-jutematta")
    ok(r["y"] >= 82 and r["surface"] == "golv", f"[B2] nor does putting it on the wall: {r}")
    pg.evaluate("document.querySelector('[data-pick=glob-bordslampa-opalglas]').click()"); pg.wait_for_timeout(200); st = pg.evaluate(STAGE)
    pg.mouse.click(st[0] + st[2] * 0.30, st[1] + st[3] * 0.35); pg.wait_for_timeout(400)
    ps = {x["h"]: x for x in pg.evaluate(PINS)}; gl, va = ps["glob-bordslampa-opalglas"], ps["glod-doftljus-keramik"]
    ok(gl["surface"] in ("bord", "golv") and (gl["surface"] != va["surface"] or abs(gl["x"] - va["x"]) > (gl["w"] + va["w"]) * 0.4) and not any(o["h"] != gl["h"] and o["x"] == gl["x"] and o["y"] == gl["y"] for o in ps.values()), f"[M1] the lamp put on the wall stands on a free place, not on the candle: {gl} / {va}")
    ok("kan stå på bord eller golv" in pg.evaluate("document.getElementById('plHint').textContent") or "fullt" in pg.evaluate("document.getElementById('plHint').textContent"), f"[M1] and the page says why: {pg.evaluate('document.getElementById(\"plHint\").textContent')}")
    ok(not pg.errs, f"[B2/M1] no script errors: {pg.errs[:2]}")
    c.close()

    # your own photo: the surface is asked once
    c = ctx_for(b, 390, 844, True); pg = new_page(c); pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(500); quiet(pg)
    pg.evaluate("RQ.shop.signIn('test@example.com', 'Test', 'email')")
    pg.evaluate("RQ.room.place({ own: true, room: 'vardagsrum', items: [{ h: 'flatad-forvaringskorg' }, { h: 'affisch-linje-ekram' }] })"); pg.wait_for_timeout(500)
    put(pg, "rum.jpg", picture(1400, 900)); pg.wait_for_timeout(2500)
    ok(pg.evaluate("!!document.getElementById('plStage')"), "[own] your own photo goes straight to Placera och skapa")
    pg.evaluate("document.querySelector('[data-pin]').click()"); pg.wait_for_timeout(300)
    ok(pg.evaluate("document.querySelector('#plPin .pl-ask').textContent") == "Var står den?" and not pg.evaluate("document.querySelector('#plPin [data-surf][aria-pressed=true]')"), "[own] a pin in your own photo asks once where it stands")
    pg.evaluate("document.querySelector('#plPin [data-surf=golv]').click()"); pg.wait_for_timeout(300)
    ok(pg.evaluate("document.querySelector('#plPin .pl-ask').textContent") != "Var står den?" and "Ange en känd längd" in pg.evaluate("document.getElementById('plPin').innerText"), "[own] answered, it is not asked again; a known length is offered for the right scale")
    ok(not pg.errs, f"[own] no script errors: {pg.errs[:2]}")
    c.close()

    # English
    c = ctx_for(b, 1440, 900, False); pg = new_page(c); pg.goto(BASE); pg.wait_for_timeout(300); pg.evaluate("localStorage.setItem('rumiq-lang', JSON.stringify('en'))")
    place(pg); txt = pg.evaluate("document.getElementById('pl').innerText + document.querySelector('h1').textContent")
    ok("Create the picture" in txt and "Place and create" in txt and "Adjust it yourself" in txt and not re.search(r"Skapa bilden|Justera själv|Dina saker", txt), f"[en] Placera och skapa is in English: {txt[:120]}")
    c.close()
    b.close()

print(f"{n - len(fails)} of {n} checks passed")
sys.exit(1 if fails else 0)
