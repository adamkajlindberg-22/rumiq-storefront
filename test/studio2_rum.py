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


with sync_playwright() as p:
    b = p.chromium.launch()
    SIZES = ((390, 844, True), (360, 740, True), (1440, 900, False), (1280, 720, False))

    # ------------------------------------------------------------ 1. Byt och jämför
    for W, Hh, mob in SIZES:
        tag = f"[byt {W}]"
        c = ctx_for(b, W, Hh, mob); pg = new_page(c)
        editor(pg, ["lysa-keramiklampa", "lin-kuddfodral", "plad-ullblandning-havre"])
        pg.evaluate("document.querySelector('[data-pick=lysa-keramiklampa]').click()"); pg.wait_for_timeout(300)
        btn = pg.evaluate("(() => { const b = [...document.querySelectorAll('[data-swap-open]')].find((x) => x.offsetParent); const r = b.getBoundingClientRect(); return [b.innerText.trim(), r.height, r.bottom]; })()")
        ok(btn[0].startswith("Byt") and btn[1] >= 40 and btn[2] <= Hh, f"{tag} a tapped thing has Byt, on the first screen, large enough to tap: {btn}")
        if mob:
            ok(pg.evaluate("document.getElementById('rmActOrder').getBoundingClientRect().height") < 22, f"{tag} Bakom is one line in the phone's bar")
        pg.evaluate(OPENSWAP); pg.wait_for_timeout(400)
        alts = pg.evaluate("[...document.querySelectorAll('#rmSwap [data-alt]')].map((b) => b.dataset.alt)")
        ok(alts and all(pg.evaluate("(h) => RQ.byHandle(h).cat === 'belysning-atmosfar'", a) for a in alts) and "lysa-keramiklampa" not in alts, f"{tag} Byt on a lamp offers lamps and candles only: {alts}")
        x0, y0, w0 = pg.evaluate(SPOT, "lysa-keramiklampa")
        pg.evaluate("document.querySelector('#rmSwap [data-alt=glob-bordslampa-opalglas]').click()"); pg.wait_for_timeout(500)
        g = pg.evaluate(SPOT, "glob-bordslampa-opalglas")
        ok(g and g[0] == x0 and g[1] == y0 and abs(g[2] - w0 * 20 / 30.5) < 0.15 and not pg.evaluate(SPOT, "lysa-keramiklampa"), f"{tag} one tap swaps it in place, at the same scale: {[x0, y0, w0]} -> {g}")
        ok(pg.evaluate("document.querySelector('.rm-item.sel').dataset.h") == "glob-bordslampa-opalglas" and not pg.evaluate("document.getElementById('rmSwap').hidden"), f"{tag} the new one is selected and Byt stays open")
        pg.evaluate("document.getElementById('rmUndo').click()"); pg.wait_for_timeout(400)
        ok(pg.evaluate(SPOT, "lysa-keramiklampa") == [x0, y0, w0] and not pg.evaluate(SPOT, "glob-bordslampa-opalglas"), f"{tag} Ångra brings the first one back")
        # colours: the cushion in Salvia, approximate and said so; Köp allt buys that colour without asking
        pg.evaluate("document.querySelector('[data-pick=lin-kuddfodral]').click()"); pg.wait_for_timeout(300); pg.evaluate(OPENSWAP); pg.wait_for_timeout(300)
        talts = pg.evaluate("[...document.querySelectorAll('#rmSwap [data-alt]')].map((b) => b.dataset.alt)")
        ok(all(pg.evaluate("(h) => ['cushion','throw','bedding'].includes(RQ.room.kindOf(RQ.byHandle(h)))", a) for a in talts), f"{tag} Byt on a cushion offers textiles: {talts}")
        pg.evaluate("document.querySelector('#rmSwap [data-swv=\"1\"]').click()"); pg.wait_for_timeout(400)
        ok(pg.evaluate("RQ.room.scene().find((i) => i.h === 'lin-kuddfodral').v") == 1 and pg.evaluate("!!document.querySelector('.rm-item[data-h=lin-kuddfodral] .rm-tint')") and "ungefärlig" in pg.evaluate("document.getElementById('rmSwap').innerText"), f"{tag} Salvia: the cushion takes the colour in the picture, said to be approximate")
        pg.evaluate("RQ.shop.clearCart(); document.getElementById('rmCart').click()"); pg.wait_for_timeout(600)
        lines = pg.evaluate("RQ.shop.cartLines().map((l) => l.id)")
        ok("lin-kuddfodral::1" in lines and not pg.evaluate("document.querySelector('#varList') && document.querySelector('#varList').closest('.sheet.open')"), f"{tag} Lägg allt i varukorgen buys the cushion in Salvia, without asking again: {lines}")
        pg.evaluate("RQ.shop.clearCart(); document.querySelectorAll('.toast').forEach((t) => t.classList.remove('show'))")
        # Jämför: up to three, the same room picture each, one tap keeps one
        pg.evaluate("document.querySelector('[data-pick=lysa-keramiklampa]').click()"); pg.wait_for_timeout(300); pg.evaluate(OPENSWAP); pg.wait_for_timeout(300)
        pg.evaluate("document.getElementById('rmCmpT').click()"); pg.wait_for_timeout(150)
        for h in ("glob-bordslampa-opalglas", "svamp-uppladdningsbar-lampa", "stilla-ljusstake-massing-2-pack"):
            pg.evaluate("(h) => document.querySelector(`#rmSwap [data-alt=\"${h}\"]`) && document.querySelector(`#rmSwap [data-alt=\"${h}\"]`).click()", h); pg.wait_for_timeout(80)
        ok(len(pg.evaluate("[...document.querySelectorAll('#rmSwap [data-alt][aria-pressed=true]')]")) == 2, f"{tag} Jämför takes at most two beside the one in the room")
        pg.evaluate("document.getElementById('rmCmpGo').click()"); pg.wait_for_timeout(600)
        figs = pg.evaluate("[...document.querySelectorAll('.rmcmp.open .rm-cmp figure')].map((f) => { const r = f.querySelector('.rm-cmp-pic').getBoundingClientRect(); return [f.querySelector('b').textContent, f.querySelectorAll('.rm-item').length, Math.round(r.left), Math.round(r.top), Math.round(r.width)]; })")
        ok(len(figs) == 3 and all(f[1] == 3 for f in figs), f"{tag} Jämför shows three pictures of the same room, each with the whole set: {figs}")
        ok((figs[1][2] > figs[0][2] + figs[0][4] - 2 and abs(figs[1][3] - figs[0][3]) < 2), f"{tag} side by side ({'a swipe' if mob else 'columns'})")
        keep = figs[2][0]
        pg.evaluate("document.querySelectorAll('.rmcmp [data-keep]')[2].click()"); pg.wait_for_timeout(500)
        ok(not pg.evaluate("document.querySelector('.rmcmp').classList.contains('open')") and keep in [pg.evaluate("(h) => RQ.byHandle(h).name", it[0]) for it in pg.evaluate(SC)], f"{tag} Välj den här keeps it in the room: {keep}")
        ok(not pg.errs, f"{tag} no script errors: {pg.errs[:2]}")
        c.close()

    # ------------------------------------------------------------ 2. Inred åt mig with style and budget
    for W, Hh, mob in SIZES:
        tag = f"[style {W}]"
        c = ctx_for(b, W, Hh, mob); pg = new_page(c)
        editor(pg, [])
        pg.evaluate("document.getElementById('rmSuggest').click()"); pg.wait_for_timeout(1500)
        ok(pg.evaluate("!document.getElementById('rmSugg').hidden") and len(pg.evaluate("RQ.room.scene()")) >= 3, f"{tag} Inred åt mig still works with one tap, and offers style and budget after")
        st = pg.evaluate("[...document.querySelectorAll('#rmSugg [data-sty]')].map((b) => b.textContent)")
        ok(st == ["Alla stilar", "Skandinavisk", "Minimalistisk", "Klassisk", "Mjuk"], f"{tag} the four styles: {st}")
        pg.evaluate("document.querySelector('#rmSugg [data-sty=minimalistisk]').click()"); pg.wait_for_timeout(1200)
        sc = pg.evaluate("RQ.room.scene().filter((i) => i.sg).map((i) => i.h)")
        ok(sc and all("minimalistisk" in pg.evaluate("(h) => RQ.byHandle(h).styles", h) for h in sc), f"{tag} Minimalistisk: every suggested thing is in that style: {sc}")
        tot = pg.evaluate("RQ.room.scene().filter((i) => i.sg).reduce((s, i) => s + RQ.byHandle(i.h).price, 0)")
        ok(pg.evaluate("document.querySelector('.rm-sugg-h span').textContent").replace(" ", " ").replace(" ", " ").endswith(f"{tot:,}".replace(",", " ") + " kr"), f"{tag} the total is shown: {tot}")
        pg.evaluate("(() => { const r = document.getElementById('rmSgB'); r.value = 900; r.dispatchEvent(new Event('input', {bubbles:true})); r.dispatchEvent(new Event('change', {bubbles:true})); })()"); pg.wait_for_timeout(1200)
        tot = pg.evaluate("RQ.room.scene().filter((i) => i.sg).reduce((s, i) => s + RQ.byHandle(i.h).price, 0)")
        ok(0 < tot <= 900, f"{tag} a budget of 900 kr: the set costs {tot} kr")
        ok("Budgeten räcker till" in pg.evaluate("document.getElementById('rmSugg').innerText"), f"{tag} and it says honestly what fits and what is left")
        first = sorted(pg.evaluate("RQ.room.scene().filter((i) => i.sg).map((i) => i.h)"))
        pg.evaluate("document.getElementById('rmSgAgain').click()"); pg.wait_for_timeout(1200)
        again = sorted(pg.evaluate("RQ.room.scene().filter((i) => i.sg).map((i) => i.h)"))
        tot2 = pg.evaluate("RQ.room.scene().filter((i) => i.sg).reduce((s, i) => s + RQ.byHandle(i.h).price, 0)")
        ok(again != first and tot2 <= 900 and all("minimalistisk" in pg.evaluate("(h) => RQ.byHandle(h).styles", h) for h in again), f"{tag} Ett annat förslag: another set, same style and budget: {first} -> {again}")
        # what you moved stays when the set changes; Köp allt buys exactly the set
        moved = again[0]; pg.evaluate("(h) => RQ.room.update(h, { x: 30, sg: undefined })", moved)
        pg.evaluate("document.querySelector('#rmSugg [data-sty=\"\"]').click()"); pg.wait_for_timeout(1200)
        ok(pg.evaluate(SPOT, moved) is not None, f"{tag} a thing you moved stays when the set changes")
        pg.evaluate("RQ.shop.clearCart()")
        want = sorted(pg.evaluate("RQ.room.scene().filter((i) => i.sg).map((i) => i.h + '::' + (i.v || 0))"))
        pg.evaluate("document.getElementById('rmSgBuy').click()"); pg.wait_for_timeout(700)
        ok(sorted(pg.evaluate("RQ.shop.cartLines().map((l) => l.id)")) == want, f"{tag} Köp allt adds exactly the suggested set: {want}")
        ok(not pg.errs, f"{tag} no script errors: {pg.errs[:2]}")
        c.close()

    # ------------------------------------------------------------ openWith, your rooms, Byt from the AI picture
    for W, Hh, mob in ((390, 844, True), (1440, 900, False)):
        tag = f"[open {W}]"
        c = ctx_for(b, W, Hh, mob); pg = new_page(c)
        pg.goto(BASE + "svep/"); pg.wait_for_timeout(800)
        r = pg.evaluate("RQ.room.openWith({ room: 'sovrum', items: [{ h: 'glob-bordslampa-opalglas', v: 0 }, { h: 'lin-kuddfodral', v: 1 }, { h: 'vila-paslakanset-linne', v: 2 }], style: 'mjuk', budget: 3000 })"); pg.wait_for_timeout(1600)
        ok(r is True and pg.evaluate("RQ.currentRoute()") == "mitt-rum" and pg.evaluate("RQ.room.get().sample && RQ.room.get().map") == "sovrum", f"{tag} openWith opens Mitt rum in the sample bedroom")
        sc = {i[0]: i for i in pg.evaluate(SC)}
        ok(set(sc) == {"glob-bordslampa-opalglas", "lin-kuddfodral", "vila-paslakanset-linne"} and sc["lin-kuddfodral"][4] == 1 and sc["vila-paslakanset-linne"][4] == 2, f"{tag} with the things in the colours asked for: {sc}")
        maps = pg.evaluate("(() => { const M = RQ.room.mapOf(); return [M.surface.map((s) => [s[0], s[1]]), M.bedding.map((s) => [s[0], s[1]]), M.cushion.map((s) => [s[0], s[1]])]; })()")
        ok([sc["glob-bordslampa-opalglas"][1], sc["glob-bordslampa-opalglas"][2]] in maps[0] and [sc["vila-paslakanset-linne"][1], sc["vila-paslakanset-linne"][2]] in maps[1], f"{tag} placed on the room's own spots (never in mid-air)")
        # a project: its saved scene comes back exactly when the photo is the same
        pid = pg.evaluate("RQ.hem.create({ label: 'Gästrummet', type: 'sovrum', items: [{ h: 'svamp-uppladdningsbar-lampa', v: 0 }] }).id")
        pg.evaluate("(id) => RQ.room.openWith({ room: 'sovrum', items: [{ h: 'svamp-uppladdningsbar-lampa', v: 0 }], project: id })", pid); pg.wait_for_timeout(1500)
        pg.evaluate("(id) => RQ.hem.patch(id, { pkey: RQ.ai.projectKey(), scene: [{ h: 'svamp-uppladdningsbar-lampa', x: 33.3, y: 70.1, w: 6, flip: false, light: 100 }] })", pid)
        pg.evaluate("RQ.room.openWith({ room: 'vardagsrum', items: [{ h: 'sand-keramikvas', v: 0 }] })"); pg.wait_for_timeout(1500)
        ok(pg.evaluate("RQ.room.get().map") == "vardagsrum", f"{tag} another room opens in its own sample room")
        chips = pg.evaluate("[...document.querySelectorAll('.rm-projs [data-proj]')].map((b) => b.textContent)")
        ok("Gästrummet" in chips and pg.evaluate("!!document.querySelector('.rm-projs a[href*=mitt-hem]')"), f"{tag} your rooms are one tap away in Mitt rum: {chips}")
        pg.evaluate("(id) => document.querySelector(`[data-proj=\"${id}\"]`).click()", pid); pg.wait_for_timeout(1700)
        ok(pg.evaluate("RQ.room.get().map") == "sovrum" and pg.evaluate("RQ.hem.activeId()") == pid and pg.evaluate("document.querySelector(`[data-proj=\"${RQ.hem.activeId()}\"]`).getAttribute('aria-pressed')") == "true", f"{tag} one tap switches to Gästrummet, marked as the active room")
        ok(pg.evaluate(SC)[0][:4] == ["svamp-uppladdningsbar-lampa", 33.3, 70.1, 6], f"{tag} with its things where you left them: {pg.evaluate(SC)}")
        # Byt from the AI picture ("Prova en annan färg", "Byt produkt")
        pg.goto(BASE + "produkt-lin-kuddfodral/"); pg.wait_for_timeout(600)
        pg.evaluate("RQ.room.add('lin-kuddfodral', true)")
        ok(pg.evaluate("RQ.room.openSwap('lin-kuddfodral')") is True, f"{tag} openSwap answers true for a thing in the room")
        pg.wait_for_timeout(1500)
        ok(pg.evaluate("RQ.currentRoute()") == "mitt-rum" and pg.evaluate("!document.getElementById('rmSwap').hidden && document.querySelector('.rm-item.sel').dataset.h") == "lin-kuddfodral", f"{tag} it opens Mitt rum with Byt open on that thing")
        ok(pg.evaluate("RQ.room.openSwap('strand-jutematta')") is False, f"{tag} and refuses a thing that is not in the room")
        pg.evaluate("document.getElementById('rmSwapX').click()"); pg.wait_for_timeout(200)
        ok(pg.evaluate("RQ.room.openSwap('lin-kuddfodral', { colour: true })") is True and pg.wait_for_timeout(500) is None and pg.evaluate("document.activeElement && document.activeElement.matches('[data-swv]')"), f"{tag} openSwap with colour: Byt opens at the colours")
        # Spara tells Mitt hem (rq-room-saved); a room card can be drawn with its things (snapshot)
        pg.evaluate("window.__saved = null; document.addEventListener('rq-room-saved', (e) => { window.__saved = e.detail; })"); pg.evaluate("document.getElementById('rmSave').click()"); pg.wait_for_timeout(1500)
        sv = pg.evaluate("window.__saved && [window.__saved.handles, /^data:image/.test(window.__saved.img)]")
        ok(sv and "lin-kuddfodral" in sv[0] and sv[1], f"{tag} Spara sends rq-room-saved with the room's things and picture")
        u = pg.evaluate("(id) => RQ.room.snapshot(id, 600)", pid)
        ok(u and u.startswith("data:image/jpeg"), f"{tag} snapshot draws one of your rooms with its things: {str(u)[:30]}")
        ok(pg.evaluate("RQ.room.snapshot('finns-inte', 600)") is None, f"{tag} and answers null for a room that does not exist")
        ok(not pg.errs, f"{tag} no script errors: {pg.errs[:2]}")
        c.close()
    # own photo through openWith: the sign-in gate, and afterwards the things stand in the floor row
    c = ctx_for(b, 390, 844, True); pg = new_page(c)
    pg.goto(BASE + "svep/"); pg.wait_for_timeout(800)
    r = pg.evaluate("RQ.room.openWith({ own: true, items: [{ h: 'glob-bordslampa-opalglas', v: 0 }, { h: 'sand-keramikvas', v: 0 }] })"); pg.wait_for_timeout(500)
    ok(r is False and pg.evaluate("document.querySelector('.roomsheet').classList.contains('open')"), "[own] openWith own: the room sheet opens")
    pg.evaluate("document.querySelector('.roomsheet .sheet-acts label.cam').click()"); pg.wait_for_timeout(300)
    ok(pg.evaluate(MODE) == "gate", "[own] and asks you to sign in for your own photo")
    pg.evaluate("RQ.shop.signIn('test@example.com', 'Test', 'email')"); pg.evaluate("document.querySelector('.roomsheet [data-sheet-close]').click()"); pg.evaluate("RQ.room.openWith({ own: true, items: [{ h: 'glob-bordslampa-opalglas', v: 0 }, { h: 'sand-keramikvas', v: 0 }] })"); pg.wait_for_timeout(400)
    put(pg, "rum.jpg", picture(1400, 900)); pg.wait_for_timeout(2500)
    sc = pg.evaluate(SC)
    ok(pg.evaluate("RQ.currentRoute()") == "mitt-rum" and {s[0] for s in sc} == {"glob-bordslampa-opalglas", "sand-keramikvas"} and all(s[2] >= 72 for s in sc) and abs(sc[0][1] - sc[1][1]) >= 10, f"[own] signed in, the photo goes in and the things stand in the floor row: {sc}")
    c.close()

    # ------------------------------------------------------------ studio2 review (5bebf95): the room's points
    for W, Hh, mob in ((390, 844, True), (1280, 720, False)):
        tag = f"[review {W}]"
        c = ctx_for(b, W, Hh, mob); pg = new_page(c); pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(400); quiet(pg)
        pr = pg.evaluate("RQ.hem.propose({ type: 'vardagsrum' }).items")
        pg.evaluate("(its) => RQ.room.openWith({ room: 'vardagsrum', items: its })", pr); pg.wait_for_timeout(1800); quiet(pg)
        # M2: a handed-over proposal is replaced by Inred åt mig, never stacked; no table thing on the open floor
        pg.evaluate("document.getElementById('rmSuggest').click()"); pg.wait_for_timeout(900)
        sc = pg.evaluate("RQ.room.scene().map((i) => [i.h, i.on || '', !!i.sg])")
        ok(len(sc) <= 6 and all(x[2] for x in sc), f"{tag} M2 Inred åt mig replaces the proposal instead of stacking a second set: {len(sc)}")
        pg.evaluate("document.getElementById('rmSgAgain').click()"); pg.wait_for_timeout(900)
        ok(not pg.evaluate("RQ.room.scene().filter((i) => RQ.room.homeless(i)).map((i) => i.h)") and len(pg.evaluate("RQ.room.scene()")) <= 6, f"{tag} M2 and another proposal puts nothing for a table on the open floor")
        # M3: one stable count at every budget; what fits is always taken
        for sty in ("minimalistisk", "skandinavisk", None):
            full = pg.evaluate("(s) => RQ.room.suggestSet({ style: s })", sty)
            res = [pg.evaluate("([s, b]) => { const x = RQ.room.suggestSet({ style: s, budget: b }); return [x.count, x.items.length, x.total, x.left.map((h) => RQ.byHandle(h).price)]; }", [sty, bud]) for bud in (full["min"], full["min"] + 100, 1000, 2000, None)]
            ok(len({r[0] for r in res}) == 1 and res[-1][1] == full["count"] and all(r[1] + len(r[3]) == r[0] for r in res), f"{tag} M3 {sty}: the same N at every budget, and Hela rummet holds all N: {res}")
            ok(all(r[1] >= 1 for r in res) and all(all(r[2] + q > b for q in r[3]) for r, b in zip(res, (full["min"], full["min"] + 100, 1000, 2000)) ), f"{tag} M3 {sty}: what is left out is only what the budget cannot take")
        # minor 12: the room keeps its style
        pg.evaluate("document.getElementById('rmSugg').scrollIntoView({ block: 'center' })"); pg.evaluate("document.querySelector('[data-sty=minimalistisk]').click()"); pg.wait_for_timeout(700)
        pg.reload(); pg.wait_for_timeout(1500); quiet(pg); pg.evaluate("document.getElementById('rmSuggest').click()"); pg.wait_for_timeout(800)
        ok(pg.evaluate("(document.querySelector('[data-sty][aria-pressed=true]') || {}).dataset.sty") == "minimalistisk", f"{tag} minor 12 Inred åt mig keeps the room's style after a reload")
        # minor 3: one name per scope; the set's button says it is in the cart
        ok(pg.evaluate("document.getElementById('rmSgBuy').textContent.trim()") == "Köp förslaget", f"{tag} minor 3 the proposal's button says what it buys")
        pg.evaluate("document.getElementById('rmSgBuy').click()"); pg.wait_for_timeout(500)
        ok("I varukorgen" in pg.evaluate("document.getElementById('rmSgBuy').textContent"), f"{tag} minor 3 and then that it lies in the cart")
        # Byt: minor 13 lamps for a lamp; minor 9 no Jämför without alternatives; minor 8 focus stays; M4 beside the picture on a computer
        pg.evaluate("RQ.room.saveScene([]); ['lysa-keramiklampa', 'dagsljus-linnegardin-2-pack'].forEach((h) => RQ.room.add(h, true))"); pg.wait_for_timeout(600)
        ok(all("lampa" in h for h in pg.evaluate("RQ.room.alternatives('lysa-keramiklampa').map((q) => q.handle)")), f"{tag} minor 13 a lamp is swapped for lamps only")
        pg.evaluate("RQ.room.openSwap('dagsljus-linnegardin-2-pack', { colour: true })"); pg.wait_for_timeout(700)
        ok(not pg.evaluate("!!document.getElementById('rmCmpT')"), f"{tag} minor 9 no Jämför when nothing else fits there")
        pg.focus("[data-swv='1']"); pg.keyboard.press("Enter"); pg.wait_for_timeout(600)
        ok(pg.evaluate("document.activeElement.matches('[data-swv]')"), f"{tag} minor 8 Enter on a colour keeps the focus in Byt")
        r = pg.evaluate("(() => { const e = document.querySelector('.rm-item.sel').getBoundingClientRect(), s = document.getElementById('rmSwap').getBoundingClientRect(), nav = document.querySelector('header').getBoundingClientRect().bottom; return [e.top >= nav - 2, e.bottom > nav + 40, s.top < innerHeight, !!document.querySelector('.rm-sel #rmSwap')]; })()")
        ok((r[1] if mob else r[0] and r[3]) and r[2], f"{tag} M4 after a colour the thing and the panel are in sight{'' if mob else ', the panel beside the picture'}: {r}")
        # M6: Jämför fills a phone's width
        pg.evaluate("RQ.room.openSwap('lysa-keramiklampa')"); pg.wait_for_timeout(500); pg.evaluate("document.getElementById('rmCmpT').click()"); pg.wait_for_timeout(200)
        pg.evaluate("document.querySelector('#rmSwap [data-alt]').click()"); pg.wait_for_timeout(200); pg.evaluate("document.getElementById('rmCmpGo').click()"); pg.wait_for_timeout(700)
        cw = pg.evaluate("document.querySelector('.rmcmp .sheet-card').getBoundingClientRect().width")
        ok(cw >= W - 1 if mob else cw > 900, f"{tag} M6 Jämför is {'full width' if mob else 'wide'}: {cw}")
        ok(pg.evaluate("document.getElementById('cmpT').textContent") == "Jämför i rummet", f"{tag} minor 5 a sample room is 'rummet', not 'ditt rum'")
        pg.evaluate("document.querySelector('.rmcmp [data-cmp-close]').click()"); pg.wait_for_timeout(300)
        # minor 11: the room's own buttons are 44 px
        small = pg.evaluate("[...document.querySelectorAll('#rmZoom, #rmUndo, #rmHold, #rmCart2, .rm-more .chip')].filter((e) => { const r = e.getBoundingClientRect(); return r.height && r.height < 43.5; }).map((e) => e.id || e.textContent)")
        ok(not small, f"{tag} minor 11 the room's buttons are 44 px: {small}")
        ok(not pg.errs, f"{tag} no script errors: {pg.errs[:2]}")
        c.close()

    # M8: a moodboard of bathroom things, no room named: the bathroom, everything on a surface
    c = ctx_for(b, 390, 844, True); pg = new_page(c); pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(400)
    ok(pg.evaluate("RQ.room.openWith({ items: [{ h: 'tvalpump-stengods' }, { h: 'vaffelhandduk-bomull' }, { h: 'lysa-keramiklampa' }] })") and pg.wait_for_timeout(1500) is None and pg.evaluate("RQ.room.get().map") == "badrum", "[mb] M8 bathroom things open the bathroom")
    ok(not pg.evaluate("RQ.room.scene().filter((i) => RQ.room.homeless(i)).length"), "[mb] M8 and nothing stands on the open floor")
    c.close()
    # M5: your own photo through openWith with a room type: the editor does not ask again, and Inred åt mig starts in the style
    c = ctx_for(b, 390, 844, True); pg = new_page(c); pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(400); quiet(pg)
    pg.evaluate("RQ.shop.signIn('test@example.com', 'Test', 'email')")
    pg.evaluate("RQ.room.openWith({ own: true, room: 'hall', style: 'skandinavisk', items: [{ h: 'affisch-linje-ekram' }, { h: 'flatad-forvaringskorg' }] })"); pg.wait_for_timeout(500)
    put(pg, "hall.jpg", picture(1400, 1050)); pg.wait_for_timeout(2500)
    ok(pg.evaluate("RQ.room.get().type") == "hall" and not pg.evaluate("!!document.getElementById('rmAsk')"), "[own] M5 the room type comes along, no second question")
    pg.evaluate("document.getElementById('rmSuggest').click()"); pg.wait_for_timeout(900)
    ok(pg.evaluate("(document.querySelector('[data-sty][aria-pressed=true]') || {}).dataset.sty") == "skandinavisk" and pg.evaluate("RQ.room.scene().filter((i) => i.sg).length") >= 2, "[own] M5 and Inred åt mig starts in the style you chose")
    c.close()

    b.close()

print(f"{n - len(fails)} of {n} checks passed")
sys.exit(1 if fails else 0)
