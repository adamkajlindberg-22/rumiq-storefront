#!/usr/bin/env python3
"""Studio, the room side (studio brief): the sign-in gate for your own photo, photo intake, real size from a known
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


with sync_playwright() as p:
    b = p.chromium.launch()

    # ------------------------------------------------------------ 1. the gate: an own photo needs an account, sample rooms stay free
    for W, Hh, mob in ((390, 844, True), (1440, 900, False)):
        tag = f"[gate {W}]"
        c = ctx_for(b, W, Hh, mob); pg = new_page(c)
        hit = (lambda s: pg.tap(s)) if mob else (lambda s: pg.click(s))
        pg.goto(BASE + "produkt-lysa-keramiklampa/"); pg.wait_for_timeout(1000); quiet(pg)
        pg.evaluate("RQ.room.add('sand-keramikvas', true)")  # something already chosen before the room exists
        pg.evaluate("document.querySelector('.roomcta, .pinroom').click()"); pg.wait_for_timeout(1000)  # Prova i Mitt rum: Mitt rum with the lamp
        pg.evaluate("document.querySelector('#view [data-room-setup]').click()"); pg.wait_for_timeout(600)
        hit(".roomsheet.open .sheet-acts label" + (".cam" if mob else ":not(.cam)")); pg.wait_for_timeout(600)
        ok(pg.evaluate(MODE) == "gate" and pg.evaluate(TITLE) == "Logga in för att lägga in ditt rum", f"{tag} signed out, Ta en bild / Välj en bild opens the calm sign-in sheet")
        ok(pg.choosers == 0, f"{tag} and no camera or file chooser opens before signing in")
        ok(pg.evaluate("[...document.querySelectorAll('.roomsheet [data-room-gate]')].map((a) => a.textContent.trim())") == ["Logga in", "Skapa gratis konto"], f"{tag} Logga in and Skapa gratis konto")
        ok(pg.evaluate("document.querySelectorAll('.roomsheet.open [data-room-sample]').length") == 7 and "utan konto" in pg.evaluate("document.querySelector('[data-samples-h]').textContent"), f"{tag} the sample rooms stay right there, free without an account")
        bt = pg.evaluate("(() => { const r = document.querySelector('.roomsheet [data-room-gate]').getBoundingClientRect(); return [r.top, r.bottom, r.height]; })()")
        ok(bt[1] <= Hh and bt[2] >= 44, f"{tag} Logga in is on the first screen and large enough to tap: {bt}")
        hit(".roomsheet.open [data-room-gate]:first-child"); pg.wait_for_timeout(900)
        g = json.loads(pg.evaluate("sessionStorage.getItem('rumiq-room-gate')") or "{}")
        ok(pg.evaluate("RQ.currentRoute()") == "konto" and g.get("route") == "mitt-rum-lysa-keramiklampa", f"{tag} the step is kept while you sign in: {g}")
        sign_in_on_page(pg)
        ok(pg.evaluate("RQ.currentRoute()") == "mitt-rum-lysa-keramiklampa" and pg.evaluate("document.querySelector('.roomsheet').classList.contains('open')") and pg.evaluate(MODE) == "main", f"{tag} after signing in you are back on the same page with the sheet open")
        ok("inloggad" in pg.evaluate("document.querySelector('.sheet-hello').textContent") and pg.evaluate("!document.querySelector('.sheet-hello').hidden"), f"{tag} and told you can go on")
        put(pg, "rum.jpg", picture(1400, 900)); pg.wait_for_timeout(2200)
        ok(pg.evaluate("RQ.currentRoute()") == "mitt-rum-lysa-keramiklampa" and set(pg.evaluate("RQ.room.scene().map((i) => i.h)")) == {"sand-keramikvas", "lysa-keramiklampa"}, f"{tag} the photo goes in, and everything chosen is still chosen: {pg.evaluate('RQ.room.scene().map((i) => i.h)')}")
        ok(not pg.evaluate("sessionStorage.getItem('rumiq-room-gate')"), f"{tag} the kept step is used once")
        # a photo picked (dropped) before signing in waits, and goes straight in after
        pg.evaluate("RQ.room.clear(); RQ.shop.signOut()"); pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(800)
        pg.evaluate("RQ.room.add('plad-ullblandning-havre', true)")
        pg.click("#view [data-room-setup]"); pg.wait_for_timeout(500)
        put(pg, "rum.jpg", picture(1200, 800)); pg.wait_for_timeout(1500)
        ok(pg.evaluate(MODE) == "gate" and pg.evaluate("!document.querySelector('.sheet-wait').hidden && document.querySelector('.sheet-wait img').naturalWidth > 0"), f"{tag} a photo dropped before signing in is shown waiting")
        ok(not pg.evaluate("RQ.room.has()"), f"{tag} and it does not become the room before you sign in")
        hit(".roomsheet.open [data-room-gate]:nth-child(2)"); pg.wait_for_timeout(900)
        ok(pg.evaluate("RQ.currentRoute()") == "skapa-konto", f"{tag} Skapa gratis konto opens the sign-up page")
        sign_in_on_page(pg, signup=True); pg.wait_for_timeout(800)
        ok(pg.evaluate("RQ.currentRoute()") == "mitt-rum" and pg.evaluate("RQ.room.has() && !RQ.room.get().sample && RQ.room.get().w === 1200") and pg.evaluate("RQ.room.scene().map((i) => i.h)") == ["plad-ullblandning-havre"], f"{tag} after creating the account the waiting photo is the room and the throw is still in it")
        ok(pg.evaluate("!!document.getElementById('rmStage') && !document.querySelector('.roomsheet.open')"), f"{tag} the editor is open")
        # signed out again: a sample room is still free
        pg.evaluate("RQ.room.clear(); RQ.shop.signOut()"); pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(800)
        pg.click("#view [data-room-setup]"); pg.wait_for_timeout(500)
        hit(".roomsheet.open [data-room-sample][data-type=sovrum]"); pg.wait_for_timeout(1800)
        ok(pg.evaluate("RQ.room.has() && RQ.room.get().sample") and not pg.evaluate("RQ.shop.customer()"), f"{tag} a sample room needs no account")
        # a product's room button without a room: the product is kept with the step
        pg.evaluate("RQ.room.clear()"); pg.goto(BASE + "butik/"); pg.wait_for_timeout(900); quiet(pg)
        # (the shop's cards have no room button any more, review N3; any data-room-btn, as in the stylist's answers, works the same)
        pg.evaluate("document.getElementById('view').insertAdjacentHTML('beforeend', '<button type=button data-room-btn=lysa-keramiklampa id=tRoomBtn>x</button>'); document.getElementById('tRoomBtn').click()"); pg.wait_for_timeout(500)
        h0 = "lysa-keramiklampa"
        pg.evaluate("document.querySelector('.roomsheet .sheet-acts label:not(.cam)').click()"); pg.wait_for_timeout(400)
        pg.evaluate("document.querySelector('.roomsheet [data-room-gate]').click()"); pg.wait_for_timeout(700)
        g = json.loads(pg.evaluate("sessionStorage.getItem('rumiq-room-gate')") or "{}")
        ok(g.get("route") == "butik" and g.get("plan", {}).get("add") == [h0], f"{tag} a product you tapped to see in your room is kept: {g}")
        ok(not pg.errs, f"{tag} no script errors: {pg.errs[:2]}")
        c.close()

    # ------------------------------------------------------------ 1. photo intake: any type, the right way up, ~1600 px, a word about dark or small photos
    c = ctx_for(b, 1280, 720, False); pg = new_page(c)
    pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(800); pg.evaluate("RQ.shop.signIn('test@example.com', 'Test', 'email')")
    ok(pg.evaluate("![...document.scripts].some((s) => /heic2any/.test(s.src)) && typeof window.heic2any === 'undefined'"), "[intake] the HEIC decoder is not loaded with the page")
    ok(all("HeifDecoder" not in (ROOT / f"assets/js/{f}").read_text() for f in ("site.min.js", "site-tools.min.js")), "[intake] and not in the main bundles")
    pg.evaluate("RQ.room.openSetup()"); pg.wait_for_timeout(300)
    put(pg, "IMG_2041.HEIC", (ROOT / "test/fixtures/rum.heic").read_bytes(), "image/heic"); pg.wait_for_timeout(6000)
    ok(pg.evaluate("RQ.room.has() && [RQ.room.get().w, RQ.room.get().h]") == [960, 540], f"[intake] an iPhone HEIC photo is read: {pg.evaluate('RQ.room.has() && [RQ.room.get().w, RQ.room.get().h]')}")
    ok(pg.evaluate("[...document.scripts].some((s) => /vendor\\/heic2any\\.js/.test(s.src))"), "[intake] the decoder was fetched only now, for that photo")
    pg.evaluate("RQ.room.openSetup()"); pg.wait_for_timeout(300)
    put(pg, "IMG_2042.HEIC", b"\x00" * 900, ""); pg.wait_for_timeout(900)
    ok("HEIC" in pg.evaluate("document.querySelector('.sheet.open .sheet-err').textContent"), "[intake] a broken HEIC file is explained in the sheet")
    # a photo the camera stored on its side (EXIF orientation 6): it goes in upright
    from PIL import Image
    side = io.BytesIO(); Image.open(io.BytesIO(picture(1200, 800))).transpose(Image.Transpose.ROTATE_90).save(side, "JPEG", quality=85, exif=(lambda e: (e.__setitem__(0x0112, 6), e.tobytes())[1])(Image.Exif()))
    put(pg, "IMG_2043.JPG", side.getvalue()); pg.wait_for_timeout(1800)
    r = pg.evaluate("[RQ.room.get().w, RQ.room.get().h]")
    ok(r[0] > r[1], f"[intake] a photo stored on its side (EXIF orientation 6) goes in the right way up: {r}")
    # any size: long side about 1600 px, as JPEG
    pg.evaluate("RQ.room.openSetup()"); pg.wait_for_timeout(300)
    put(pg, "big.jpg", picture(4032, 3024)); pg.wait_for_timeout(2500)
    ok(pg.evaluate("[RQ.room.get().w, RQ.room.get().h]") == [1600, 1200] and pg.evaluate("/^data:image\\/jpeg/.test(RQ.room.get().img)"), f"[intake] a 12 MP photo is fitted to 1600 px on the long side, as JPEG: {pg.evaluate('[RQ.room.get().w, RQ.room.get().h]')}")
    # dark: a friendly word with Använd ändå / Välj en annan
    pg.evaluate("RQ.room.openSetup()"); pg.wait_for_timeout(300)
    at = pg.evaluate("RQ.room.get().at")
    put(pg, "kvall.jpg", picture(1600, 1000, light=0.35)); pg.wait_for_timeout(1500)
    ok(pg.evaluate(MODE) == "check" and pg.evaluate(TITLE) == "Bilden är ganska mörk." and pg.evaluate("document.getElementById('roomSheetLead').textContent") == "Ett ljusare foto ger en mer verklighetstrogen bild.", "[intake] a dark photo gets the tip, in those words")
    ok(pg.evaluate("[...document.querySelectorAll('.sheet-check .btn')].map((x) => x.textContent)") == ["Använd ändå", "Välj en annan"] and pg.evaluate("RQ.room.get().at") == at, "[intake] with Använd ändå and Välj en annan, and the room is not changed yet")
    with pg.expect_file_chooser() as fc:
        pg.click("[data-check-other]")
    ok(pg.evaluate(MODE) == "main", "[intake] Välj en annan opens the file chooser again")
    fc.value.set_files({"name": "kvall2.jpg", "mimeType": "image/jpeg", "buffer": picture(1600, 1000, light=0.35)}); pg.wait_for_timeout(1500)
    pg.click("[data-check-use]"); pg.wait_for_timeout(1500)
    ok(pg.evaluate("RQ.room.get().at") != at and pg.evaluate("!document.querySelector('.roomsheet.open')"), "[intake] Använd ändå takes the dark photo in")
    # an ordinary, slightly dim photo gets no tip
    pg.evaluate("RQ.room.openSetup()"); pg.wait_for_timeout(300)
    put(pg, "dag.jpg", picture(1600, 1000, light=0.7)); pg.wait_for_timeout(1500)
    ok(not pg.evaluate("document.querySelector('.roomsheet').classList.contains('open')"), "[intake] an ordinary, slightly dim photo goes straight in")
    ok(not pg.errs, f"[intake] no script errors: {pg.errs[:2]}")
    c.close()

    # ------------------------------------------------------------ 3. the surface: "Står på: bord ▾", visible and changeable in one tap
    ON = "(q) => { const s = document.querySelector(q); return s.hidden ? null : [...s.options].map((o) => o.text); }"
    for W, Hh, mob in ((390, 844, True), (360, 740, True), (1440, 900, False), (1280, 720, False)):
        tag = f"[on {W}]"
        c = ctx_for(b, W, Hh, mob); pg = new_page(c)
        pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(500); pg.evaluate(SAMPLE, "vardagsrum")
        pg.evaluate("['lysa-keramiklampa', 'strand-jutematta', 'affisch-linje-ekram', 'plad-ullblandning-havre'].forEach((h) => RQ.room.add(h, true)); location.hash = '#mitt-rum'; RQ.router()"); pg.wait_for_timeout(1400); quiet(pg)
        pg.evaluate("document.querySelector('[data-pick=lysa-keramiklampa]').click()"); pg.wait_for_timeout(600)
        sq, lq = ("#rmOn2", "#rmOnL2") if mob else ("#rmOn", "#rmOnL")
        ok(pg.evaluate(ON, sq) == ["bord", "golv"] and pg.evaluate(f"document.querySelector('{sq}').value") == "bord" and pg.evaluate(f"document.querySelector('{lq}').textContent") == "Står på", f"{tag} the lamp says Står på: bord, with golv as the other choice")
        r = pg.evaluate(f"(() => {{ const r = document.querySelector('{sq}').getBoundingClientRect(); return [r.top, r.bottom, r.width, r.height]; }})()") if mob else None
        if mob:
            ok(r[1] <= Hh - 60 and r[3] >= 40, f"{tag} on a phone it sits with the selected thing, on the first screen, large enough to tap: {r}")
            ok(pg.evaluate("document.getElementById('rmActName').textContent") == "Lysa keramiklampa", f"{tag} and the selected thing is named there")
            bb = pg.evaluate("[document.querySelector('[data-act=done]').getBoundingClientRect().bottom, document.querySelector('.rm-bar').getBoundingClientRect().top]")
            ok(bb[0] <= bb[1] + 1, f"{tag} the selected thing's buttons are not under the buy bar: {bb}")
        before = pg.evaluate(SPOT, "lysa-keramiklampa")
        pg.select_option(sq, "golv"); pg.wait_for_timeout(600)
        it = pg.evaluate("RQ.room.scene().find((i) => i.h === 'lysa-keramiklampa')")
        ok(it.get("on") == "golv" and it["y"] > 80 and pg.evaluate(f"document.querySelector('{sq}').value") == "golv", f"{tag} one choice moves it to the floor of the sample room: {before} -> {[it['x'], it['y'], it['w']]}")
        ok(it["x"] == before[0], f"{tag} straight down, at the same place across (review minor 8): {before[0]} -> {it['x']}")
        order = pg.evaluate("[...document.querySelectorAll('.rm-item')].map((e) => e.dataset.h)")
        ok(order.index("strand-jutematta") < order.index("lysa-keramiklampa"), f"{tag} and it stands on the rug, not under it: {order}")
        pg.evaluate("document.getElementById('rmUndo').click()"); pg.wait_for_timeout(400)
        ok(pg.evaluate(SPOT, "lysa-keramiklampa") == before and not pg.evaluate("RQ.room.scene().find((i) => i.h === 'lysa-keramiklampa').on"), f"{tag} Ångra takes it back to the table")
        pg.evaluate("document.querySelector('[data-pick=affisch-linje-ekram]').click()"); pg.wait_for_timeout(500)
        ok(pg.evaluate(ON, sq) == ["vägg", "bord", "golv"] and pg.evaluate(f"document.querySelector('{lq}').textContent") == "Hänger på", f"{tag} a print: Hänger på: vägg, or leaning on a table or the floor")
        pg.evaluate("document.querySelector('[data-pick=strand-jutematta]').click()"); pg.wait_for_timeout(500)
        one = "#rmOn2b" if mob else "#rmOnb"
        ok(pg.evaluate(ON, sq) is None and pg.evaluate(f"document.querySelector('{one}').textContent") == "golv" and pg.evaluate(f"document.querySelector('{lq}').textContent") == "Ligger på:", f"{tag} a rug only lies on the floor: said, without a choice")
        pg.evaluate("document.querySelector('[data-pick=plad-ullblandning-havre]').click()"); pg.wait_for_timeout(500)
        ok(pg.evaluate(ON, sq) == ["soffa", "säng"] and pg.evaluate(f"document.querySelector('{sq}').value") == "soffa" and pg.evaluate(f"document.querySelector('{lq}').textContent") == "Ligger på", f"{tag} a throw lies on the sofa (or the bed)")
        ok(not pg.errs, f"{tag} no script errors: {pg.errs[:2]}")
        c.close()
    # own photo: nothing is known about where the tables are, so the choice keeps the thing where you put it; it stays after a reload
    c = ctx_for(b, 390, 844, True); pg = new_page(c)
    pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(500); pg.evaluate("RQ.shop.signIn('test@example.com', 'Test', 'email')")
    pg.evaluate("RQ.room.openSetup()"); pg.wait_for_timeout(300); put(pg, "rum.jpg", picture(1400, 900)); pg.wait_for_timeout(2000)
    pg.evaluate("RQ.room.add('flatad-forvaringskorg', true); RQ.room.saveScene(RQ.room.scene().map((i) => ({ ...i, x: 40, y: 70 })))"); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('[data-pick=flatad-forvaringskorg]').click()"); pg.wait_for_timeout(400)
    pg.select_option("#rmOn2", "bord"); pg.wait_for_timeout(400)
    ok(pg.evaluate(SPOT, "flatad-forvaringskorg")[:2] == [40, 70] and pg.evaluate("RQ.room.scene()[0].on") == "bord", "[on own] in your own photo the basket stays where you put it, now on a table")
    pg.reload(); pg.wait_for_timeout(1200)
    pg.evaluate("document.querySelector('[data-pick=flatad-forvaringskorg]').click()"); pg.wait_for_timeout(400)
    ok(pg.evaluate("document.getElementById('rmOn2').value") == "bord", "[on own] and it is remembered")
    c.close()

    # ------------------------------------------------------------ 2. real size: sample rooms know their scale; your own photo gets "Känd längd i bilden"
    data = (ROOT / "assets/js/data.js").read_text()
    sized = re.findall(r'handle: "([a-z0-9-]+)"[^{]*?(?:\{[^}]*\}[^{]*?)*?size: \{ w: (\d+), (?:h|d): (\d+) \}', data)
    ok({h for h, _, _ in sized} == {"affisch-linje-ekram", "affisch-horisont-ekram", "strand-jutematta", "dagsljus-linnegardin-2-pack"}, f"[real] only products whose text states their measurements have them: {sorted(h for h, _, _ in sized)}")
    OWN = io.BytesIO(); __import__("PIL.Image").Image.open(ROOT / "assets/img/rum/vardagsrum-1600.webp").convert("RGB").save(OWN, "JPEG", quality=85)
    for W, Hh, mob in ((1440, 900, False), (1280, 720, False), (390, 844, True), (360, 740, True)):
        tag = f"[real {W}]"
        c = ctx_for(b, W, Hh, mob); pg = new_page(c); cdp = c.new_cdp_session(pg) if mob else None
        # a sample room: measured products are at true scale from the start, from the room's own scale; no line to draw
        pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(500); pg.evaluate(SAMPLE, "vardagsrum")
        pg.evaluate("['lysa-keramiklampa', 'affisch-linje-ekram'].forEach((h) => RQ.room.add(h, true)); location.hash = '#mitt-rum'; RQ.router()"); pg.wait_for_timeout(1400); quiet(pg)
        pr = pg.evaluate("RQ.room.scene().find((i) => i.h === 'affisch-linje-ekram')")
        ok(pr.get("real") and abs(pr["w"] - 70 * 0.17 / 1.3) < 0.15, f"{tag} sample room: the print is at true scale from the room's own scale: {pr['w']}")
        ok(pg.evaluate("document.getElementById('rmScale').textContent").startswith("I exempelrummet visas produkter med mått i rätt skala.") and not pg.evaluate("document.querySelector('[data-measure]')"), f"{tag} and no length to draw in a sample room, said plainly")
        pg.evaluate("document.querySelector('[data-pick=lysa-keramiklampa]').click()"); pg.wait_for_timeout(300)
        ok(pg.evaluate("document.getElementById('rmReal').textContent") == "Storleken är ungefärlig.", f"{tag} a product without measurements says its size is approximate")
        # your own photo: approximate until you draw a known length
        pg.evaluate("RQ.shop.signIn('test@example.com', 'Test', 'email'); RQ.room.openSetup()"); pg.wait_for_timeout(300)
        put(pg, "rum.jpg", OWN.getvalue()); pg.wait_for_timeout(2200); quiet(pg)
        pg.evaluate("RQ.room.saveScene([{ h: 'lysa-keramiklampa', x: 70, y: 70, w: 8, flip: false, light: 100 }, { h: 'strand-jutematta', x: 45, y: 96, w: 50, sy: 0.42, flip: false, light: 100 }, { h: 'affisch-linje-ekram', x: 30, y: 45, w: 9, on: 'vagg', flip: false, light: 100 }])"); pg.wait_for_timeout(400)
        lamp0, rug0 = pg.evaluate(SPOT, "lysa-keramiklampa"), pg.evaluate(SPOT, "strand-jutematta")
        ok(pg.evaluate("document.getElementById('rmScale').textContent").startswith("Storleken är ungefärlig."), f"{tag} own photo without a known length: Storleken är ungefärlig")
        pg.evaluate("document.querySelector('[data-pick=affisch-linje-ekram]').click()"); pg.wait_for_timeout(300)
        ok(pg.evaluate("document.getElementById('rmReal').textContent") == "50 × 70 cm. Visa i rätt skala", f"{tag} a print shows its stated 50 × 70 cm and offers true scale")
        pg.evaluate("document.querySelector('#rmScale [data-measure]').click()"); pg.wait_for_timeout(600)
        ok(pg.evaluate("!document.getElementById('rmRuler').hidden && !document.getElementById('rmMeasure').hidden && document.getElementById('rmStage').classList.contains('measuring')"), f"{tag} Känd längd i bilden: a line to drag and a length to type")
        ok(pg.evaluate("document.getElementById('rmLen').value") == "200" and "dörr" in pg.evaluate("document.getElementById('rmRHint').textContent"), f"{tag} a door, about 200 cm, is the suggested example")
        cv = pg.evaluate("(() => { const r = document.getElementById('rmCanvas').getBoundingClientRect(), s = document.getElementById('rmStage').getBoundingClientRect(); return [r.left, r.top, r.width, r.height, s.left, s.width]; })()")
        h1 = pg.evaluate("(() => { const r = document.querySelector('.rm-rh').getBoundingClientRect(); return r.left + r.width / 2; })()")
        x = max(cv[4] + 40, min(cv[4] + cv[5] - 40, cv[0] + cv[2] * 0.4)); x = x if abs(x - h1) > 60 else h1 + 90  # not on the first line's handle
        ya, yb = cv[1] + cv[3] * 0.3, cv[1] + cv[3] * 0.82
        if mob:
            touch(cdp, "touchStart", [(x, ya)]); pg.wait_for_timeout(40)
            for k in range(1, 9):
                touch(cdp, "touchMove", [(x, ya + (yb - ya) * k / 8)]); pg.wait_for_timeout(16)
            touch(cdp, "touchEnd", []); pg.wait_for_timeout(200)
        else:
            pg.mouse.move(x, ya); pg.mouse.down(); pg.mouse.move(x, yb, steps=8); pg.mouse.up(); pg.wait_for_timeout(200)
        m = pg.evaluate("(() => { const l = document.querySelector('#rmRuler line'); return ['x1','y1','x2','y2'].map((k) => +l.getAttribute(k)); })()")
        ok(abs(m[1] - 30) < 1 and abs(m[3] - 82) < 1 and abs(m[0] - m[2]) < 0.5, f"{tag} the line follows the {'finger' if mob else 'mouse'}: {m}")
        pg.fill("#rmLen", "200"); pg.click("#rmMDone"); pg.wait_for_timeout(700)
        K = pg.evaluate("RQ.room.get().known") or {"x1": 0, "x2": 0, "y1": 0, "y2": 1, "cm": 0}; sc = {it["h"]: it for it in pg.evaluate("RQ.room.scene()")}
        ar = pg.evaluate("RQ.room.get().h / RQ.room.get().w")
        k0 = ((K["x2"] - K["x1"]) ** 2 + ((K["y2"] - K["y1"]) * ar) ** 2) ** 0.5 / 200
        ok(K and K["cm"] == 200 and abs(K["y2"] - 82) < 1, f"{tag} the length is kept with the photo: {K}")
        ok(sc["affisch-linje-ekram"].get("real") and abs(sc["affisch-linje-ekram"]["w"] - 70 * k0 / 1.3) < 0.15, f"{tag} the print is drawn at 70 cm high on the wall at the line's scale: {sc['affisch-linje-ekram']['w']} vs {70 * k0 / 1.3:.2f}")
        hz, d0 = 48, K["y2"] - 48
        ok(sc["strand-jutematta"].get("real") and abs(sc["strand-jutematta"]["w"] - min(96, 230 * k0 * max(0.3, min(3, (rug0[1] - hz) / d0)))) < 0.15, f"{tag} the rug, 230 cm across, with perspective at its place: {sc['strand-jutematta']['w']}")
        ok(not sc["lysa-keramiklampa"].get("real") and pg.evaluate(SPOT, "lysa-keramiklampa") == lamp0, f"{tag} a product without measurements keeps its approximate size")
        ok("rätt skala" in pg.evaluate("document.getElementById('rmScale').textContent") and "200 cm" in pg.evaluate("document.getElementById('rmScale').textContent"), f"{tag} the caption says which sizes are true and which approximate")
        tt = pg.evaluate("document.querySelector('.toast.show') ? document.querySelector('.toast.show').innerText : ''")
        ok("i rätt skala" in tt and len(tt) < 60, f"{tag} and a short toast says how many are now at true scale: {tt!r}")
        pg.evaluate("RQ.room.update('strand-jutematta', { y: 80 }); RQ.room.update('affisch-linje-ekram', { y: 40 })"); pg.wait_for_timeout(300)
        rw, pw = pg.evaluate(SPOT, "strand-jutematta")[2], pg.evaluate(SPOT, "affisch-linje-ekram")[2]
        ok(abs(rw - 230 * k0 * (80 - hz) / d0) < 0.15 and rw < sc["strand-jutematta"]["w"], f"{tag} further back on the floor, smaller: {rw}")
        ok(abs(pw - sc["affisch-linje-ekram"]["w"]) < 0.05, f"{tag} higher on the wall, the same size: {pw}")
        pg.evaluate("document.querySelector('[data-pick=strand-jutematta]').click()"); pg.wait_for_timeout(400)
        pts = pg.evaluate("document.querySelector('#rmArea polygon').getAttribute('points')").split()
        ok(len(pts) == 4 and pg.evaluate("!document.getElementById('rmAreaLab').hidden && document.getElementById('rmAreaLab').textContent") == "160 × 230 cm", f"{tag} the rug's floor area is outlined with its measurements: {pts}")
        ok(pg.evaluate("getComputedStyle(document.querySelector('#rmArea polygon')).strokeDasharray") not in ("none", ""), f"{tag} dashed")
        tw = pg.evaluate(SPOT, "strand-jutematta")[2]
        pg.evaluate("document.querySelector('[data-act=smaller]').click()"); pg.wait_for_timeout(300)
        ok(not pg.evaluate("RQ.room.scene().find((i) => i.h === 'strand-jutematta').real") and "Rätt storlek" in pg.evaluate("document.getElementById('rmReal').textContent"), f"{tag} made smaller by hand: no longer said to be true scale, Rätt storlek offered")
        ok(pg.evaluate("document.getElementById('rmAreaLab').hidden"), f"{tag} and the measurements are not shown on it")
        pg.evaluate("document.querySelector('#rmReal [data-real]').click()"); pg.wait_for_timeout(300)
        ok(abs(pg.evaluate(SPOT, "strand-jutematta")[2] - tw) < 0.05, f"{tag} Rätt storlek brings the true size back")
        ok(not pg.errs, f"{tag} no script errors: {pg.errs[:2]}")
        if W == 1440:
            pg.reload(); pg.wait_for_timeout(1200)
            ok(pg.evaluate("RQ.room.get().known.cm") == 200 and pg.evaluate("RQ.room.scene().find((i) => i.h === 'strand-jutematta').real"), f"{tag} the length and the true scale stay after a reload")
            pg.focus("#rmMore"); pg.keyboard.press("Enter"); pg.wait_for_timeout(200)
            pg.evaluate("document.querySelector('#rmMenu [data-measure]').focus()"); pg.keyboard.press("Enter"); pg.wait_for_timeout(300)
            ok(pg.evaluate("document.activeElement.classList.contains('rm-rh')"), f"{tag} opened with the keyboard, the focus is on the line's end")
            y0 = pg.evaluate("+document.querySelector('#rmRuler line').getAttribute('y1')"); pg.keyboard.press("ArrowUp"); pg.keyboard.press("ArrowUp")
            ok(abs(pg.evaluate("+document.querySelector('#rmRuler line').getAttribute('y1')") - (y0 - 1)) < 0.01, f"{tag} the arrow keys move it")
            pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
            ok(pg.evaluate("document.getElementById('rmRuler').hidden && RQ.room.get().known.y1") == K["y1"], f"{tag} Escape leaves without changing the length")
            pg.evaluate("document.querySelector('#rmScale [data-measure]').click()"); pg.wait_for_timeout(300)
            pg.click("#rmMOff"); pg.wait_for_timeout(400)
            ok(not pg.evaluate("RQ.room.get().known") and not any(i.get("real") for i in pg.evaluate("RQ.room.scene()")) and pg.evaluate("document.getElementById('rmScale').textContent").startswith("Storleken är ungefärlig."), f"{tag} Ta bort: the sizes are approximate again, and said so")
        c.close()

    # ------------------------------------------------------------ the editor's delight: things land left to right and a phone's camera follows them; one warm word; Visa någon
    for W, Hh, mob in ((390, 844, True), (1440, 900, False)):
        tag = f"[delight {W}]"
        c = ctx_for(b, W, Hh, mob); pg = new_page(c)
        pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(800); quiet(pg)
        pg.click("#view [data-room-sample-now]"); pg.wait_for_timeout(1800); quiet(pg)
        cx0 = pg.evaluate("document.getElementById('rmCanvas').getBoundingClientRect().left")
        pg.click("#rmSuggest0"); pg.wait_for_timeout(250)
        lanes = pg.evaluate("[...document.querySelectorAll('.rm-item.land')].map((e) => [parseFloat(e.style.left), +getComputedStyle(e).getPropertyValue('--i')]).sort((a, b) => a[1] - b[1]).map((x) => x[0])")
        ok(len(lanes) >= 3 and lanes == sorted(lanes), f"{tag} Inred åt mig: the things land one after the other from left to right: {lanes}")
        if mob:
            a0 = pg.evaluate("document.getElementById('rmCanvas').getBoundingClientRect().left"); pg.wait_for_timeout(1500)
            a1 = pg.evaluate("document.getElementById('rmCanvas').getBoundingClientRect().left")
            ok(a1 < a0 - 100, f"{tag} and the camera glides across the room after them: {round(a0)} -> {round(a1)}")
            pg.wait_for_timeout(1800)
            wv = pg.evaluate("(() => { const s = document.getElementById('rmStage').getBoundingClientRect(); return [...document.querySelectorAll('.rm-item')].map((e) => { const r = e.getBoundingClientRect(); return [r.left >= s.left - 2 && r.right <= s.right + 2, Math.round(Math.min(r.width, r.height))]; }); })()")
            ok(all(v[0] and v[1] >= 44 for v in wv), f"{tag} and ends on a view that shows all of them, each at least 44 px to tap (review N1): {wv}")
        else:
            pg.wait_for_timeout(1500)
        ok(pg.evaluate("!document.getElementById('rmFirst').hidden && /hemma hos dig/.test(document.getElementById('rmFirst').textContent)") and not pg.evaluate("document.querySelector('.toast.show')"), f"{tag} the first time, one warm line on the room and no toast beside it")
        if not mob:
            pg.click("#rmMore"); pg.wait_for_timeout(200)
            with pg.expect_download() as dl:
                pg.click("#rmShow")
            from PIL import Image
            im = Image.open(dl.value.path())
            ok(dl.value.suggested_filename == "mitt-rum-fore-efter.jpg" and im.size == (1200, 2 * 670 + 16), f"{tag} Visa någon: a before and after picture to show someone: {dl.value.suggested_filename} {im.size}")
        ok(not pg.errs, f"{tag} no script errors: {pg.errs[:2]}")
        c.close()

    # ------------------------------------------------------------ review round: own photo without floating things, the empty page, the cookie strip, messages
    from PIL import Image
    KOK = io.BytesIO(); Image.open(ROOT / "assets/img/rum/kok-1600.webp").convert("RGB").save(KOK, "JPEG", quality=85)
    for W, Hh, mob in ((390, 844, True), (360, 740, True), (1440, 900, False), (1280, 720, False)):
        tag = f"[review {W}]"
        c = ctx_for(b, W, Hh, mob); pg = new_page(c)
        # M3: signed out, the empty Mitt rum's main button is the free sample room, high and above the dock; no way out of Studio in its picture
        pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(1300)
        btns = pg.evaluate("[...document.querySelectorAll('.rm-empty-acts .btn')].map((b) => [b.textContent.trim(), b.classList.contains('ghost'), b.getBoundingClientRect().bottom])")
        dock = pg.evaluate("(() => { const d = document.querySelector('.dock'); const r = d && d.getBoundingClientRect(); return r && r.height && getComputedStyle(d).visibility !== 'hidden' ? r.top : innerHeight; })()")
        ok(btns[0][0] == "Prova med ett exempelrum" and not btns[0][1] and btns[1][0] == "Lägg in ditt rum" and btns[1][1], f"{tag} signed out: Prova med ett exempelrum is the main button, Lägg in ditt rum the second: {btns}")
        ok(btns[0][2] <= dock, f"{tag} and it is on the first screen, above the dock: {round(btns[0][2])} <= {round(dock)}")
        ok(not pg.evaluate("[...document.querySelectorAll('.rm-empty .rh-card a')].length"), f"{tag} the picture on the empty page has no Till butiken")
        # M4: the cookie choice is a slim strip under the header that never covers the room's tools
        ck = pg.evaluate("(() => { const c = document.getElementById('cookie'); const r = c.getBoundingClientRect(); return [c.classList.contains('show'), r.top, r.bottom, getComputedStyle(c).position]; })()")
        ok(ck[0] and ck[3] == "absolute" and ck[2] - ck[1] <= (110 if mob else 70), f"{tag} the cookie choice is a strip under the header: {ck}")
        pg.evaluate(SAMPLE, "vardagsrum"); pg.evaluate("location.hash = '#mitt-rum'; RQ.router()"); pg.wait_for_timeout(1200)
        tools = pg.evaluate("(() => { const r = document.querySelector('.rm-tools').getBoundingClientRect(); return [r.top, r.bottom]; })()"); ckr = pg.evaluate("(() => { const r = document.getElementById('cookie').getBoundingClientRect(); return [r.top, r.bottom]; })()")
        ok(ckr[1] <= pg.evaluate("document.getElementById('rmStage').getBoundingClientRect().top") + 1 and (tools[1] < ckr[0] or tools[0] > ckr[1]), f"{tag} and it covers neither the room nor its tools: strip {ckr}, tools {tools}")
        # M1: your own photo: what came from the sample room stands in a row on the floor, in view, and the room says what to do
        pg.evaluate("['lysa-keramiklampa', 'flatad-forvaringskorg', 'affisch-horisont-ekram', 'dagsljus-linnegardin-2-pack'].forEach((h) => RQ.room.add(h, true)); RQ.shop.signIn('test@example.com', 'Test', 'email'); RQ.room.openSetup()"); pg.wait_for_timeout(400)
        put(pg, "kok.jpg", KOK.getvalue()); pg.wait_for_timeout(2600)
        sc = {it["h"]: it for it in pg.evaluate("RQ.room.scene()")}
        rows = [sc[h] for h in ("lysa-keramiklampa", "flatad-forvaringskorg", "affisch-horisont-ekram")]
        ok(all(r.get("row") and r.get("on") == "golv" and r["y"] >= 80 for r in rows), f"{tag} own photo: the things stand in a row on the floor, said to stand on golv: {[(r['x'], r['y']) for r in rows]}")
        ys = sorted(r["y"] for r in rows if r["y"] == 93); xs = sorted((r["x"] - r["w"] / 2, r["x"] + r["w"] / 2) for r in rows if r["y"] == 93)
        ok(all(a[1] <= b[0] for a, b in zip(xs, xs[1:])), f"{tag} a tidy row: none in front of another: {xs}")
        ok(sc["dagsljus-linnegardin-2-pack"]["x"] >= 80, f"{tag} the curtain hangs at the side: {sc['dagsljus-linnegardin-2-pack']['x']}")
        ok(pg.evaluate("!document.getElementById('rmFirst').hidden && document.getElementById('rmFirst').textContent") == "Dra sakerna dit du vill ha dem.", f"{tag} with one line: Dra sakerna dit du vill ha dem")
        vis = pg.evaluate("(() => { const s = document.getElementById('rmStage').getBoundingClientRect(); return [...document.querySelectorAll('.rm-item')].map((e) => { const r = e.getBoundingClientRect(); return [e.dataset.h.slice(0, 6), Math.round(r.left - s.left), Math.round(s.right - r.right)]; }); })()")
        ok(all(v[1] >= -2 and v[2] >= -2 for v in vis), f"{tag} and the view fits all of them, so every one is in view (review N1): {vis}")
        # dragged out of the row: it stands where you put it, its own kind again
        pg.evaluate("RQ.room.update('lysa-keramiklampa', { x: 60, y: 60, row: undefined, on: undefined })"); pg.wait_for_timeout(300)
        ok(pg.evaluate("RQ.room.scene().find((i) => i.h === 'lysa-keramiklampa').on") is None, f"{tag} out of the row it is no longer said to stand on the floor")
        # minor 4 + 5: Inred åt mig on an own photo without a room type asks first, then suggests; one message at a time
        pg.evaluate("RQ.room.saveScene([])"); pg.wait_for_timeout(300); quiet(pg)
        ok(pg.evaluate("document.getElementById('rmSuggest0').hidden && !!document.querySelector('#rmHint .rm-hintask')"), f"{tag} the empty own photo asks which room it is before offering Inred åt mig")
        pg.click("#rmSuggest"); pg.wait_for_timeout(500)
        ok(pg.evaluate("RQ.room.scene().length") == 0 and pg.evaluate("!!document.querySelector('.ask-now')"), f"{tag} Inred åt mig waits for the room type and points at the question")
        pg.click("#rmHint [data-roomtype=kok]"); pg.wait_for_timeout(1800)
        ok(pg.evaluate("RQ.room.get().type") == "kok" and pg.evaluate("RQ.room.scene().length") >= 2, f"{tag} choosing Kök runs the suggestions at once")
        ok(not pg.evaluate("document.querySelector('.toast.show')") and pg.evaluate("document.getElementById('rmFirst').textContent").startswith("Dra sakerna dit du vill ha dem."), f"{tag} one message only, under the room")
        ok(not pg.errs, f"{tag} no script errors: {pg.errs[:2]}")
        c.close()
    # minor 3: a sample room is called an example room; polish 1: no grey box behind the selected thing; polish 6: the curtain reaches above the picture; polish 7: Shift+arrow moves 5 %
    c = ctx_for(b, 1440, 900, False); pg = new_page(c)
    pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(900); pg.click("#view [data-room-sample-now]"); pg.wait_for_timeout(1800)
    ok("Klart. Här är exempelrummet." in pg.evaluate("[...document.querySelectorAll('.toast.show')].map((t) => t.innerText).join(' ')"), "[review] a sample room is called the example room")
    pg.evaluate("RQ.room.add('dagsljus-linnegardin-2-pack', true); RQ.room.add('lysa-keramiklampa', true)"); pg.wait_for_timeout(400)
    top = pg.evaluate("(() => { const e = document.querySelector('.rm-item[data-h=dagsljus-linnegardin-2-pack]').getBoundingClientRect(), s = document.getElementById('rmStage').getBoundingClientRect(); return e.top - s.top; })()")
    ok(top < 0, f"[review] the sample living room's curtain reaches above the picture (no hard top edge): {round(top)}")
    pg.evaluate("document.querySelector('[data-pick=lysa-keramiklampa]').click()"); pg.wait_for_timeout(300)
    ok(pg.evaluate("getComputedStyle(document.querySelector('.rm-item.sel')).boxShadow") == "none", "[review] the selected thing has no grey box behind it")
    x0 = pg.evaluate(SPOT, "lysa-keramiklampa")[0]; pg.focus(".rm-item[data-h=lysa-keramiklampa]"); pg.keyboard.press("Shift+ArrowLeft"); pg.wait_for_timeout(200)
    ok(abs(pg.evaluate(SPOT, "lysa-keramiklampa")[0] - (x0 - 5)) < 0.01, "[review] Shift+arrow moves 5 %")
    c.close()
    # minor 6 + 7: back from signing in, one message and the next step glows; the account page says you come back; Google and the like on the gate when the sign-in server is live
    c = ctx_for(b, 390, 844, True); pg = new_page(c)
    pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(800); pg.click("#view [data-room-setup]"); pg.wait_for_timeout(400)
    pg.evaluate("document.querySelector('.roomsheet .sheet-acts label.cam').click()"); pg.wait_for_timeout(400)
    pg.tap(".roomsheet.open [data-room-gate]:first-child"); pg.wait_for_timeout(900)
    ok("tillbaka till ditt rum" in pg.evaluate("document.getElementById('view').innerText"), "[review] the sign-in page says you come back to your room")
    sign_in_on_page(pg)
    ok(not pg.evaluate("document.querySelector('.toast.show')") and "inloggad" in pg.evaluate("document.querySelector('.sheet-hello').textContent"), "[review] back from signing in: the sheet says it, no toast on top")
    ok(pg.evaluate("!!document.querySelector('.roomsheet .sheet-acts .btn.nudge')"), "[review] and Ta en bild glows once")
    pg.evaluate("RQ.room.closeSetup(); RQ.shop.signOut(); RQ.auth.start = () => Promise.resolve(); RQ.auth.mode = 'supabase'; RQ.auth.socials = ['google', 'apple']; window.__sso = []; RQ.auth.social = (p) => { window.__sso.push(p); return new Promise(() => {}); }; 1")
    pg.evaluate("RQ.room.openSetup()"); pg.wait_for_timeout(300); pg.evaluate("document.querySelector('.roomsheet .sheet-acts label.cam').click()"); pg.wait_for_timeout(400)
    ok(pg.evaluate("[...document.querySelectorAll('.roomsheet .sheet-sso [data-sso]')].map((b) => b.textContent.trim())") == ["Fortsätt med Google", "Fortsätt med Apple"] and pg.evaluate("!document.querySelector('.roomsheet .sheet-sso').hidden"), "[review] with the sign-in server live, Google, Apple and Microsoft are on the gate (minor 7)")
    pg.tap(".roomsheet .sheet-sso [data-sso=google]"); pg.wait_for_timeout(300)
    ok(pg.evaluate("window.__sso") == ["google"] and json.loads(pg.evaluate("sessionStorage.getItem('rumiq-room-gate')"))["route"] == "mitt-rum", "[review] one tap starts Google, with the step kept for the way back")
    c.close()

    b.close()

print(f"{n - len(fails)} of {n} checks passed")
sys.exit(1 if fails else 0)
