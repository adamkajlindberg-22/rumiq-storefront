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
        pg.evaluate("document.querySelector('.roomcta, .pinroom').click()"); pg.wait_for_timeout(600)
        hit(".roomsheet.open .sheet-acts label" + (".cam" if mob else ":not(.cam)")); pg.wait_for_timeout(600)
        ok(pg.evaluate(MODE) == "gate" and pg.evaluate(TITLE) == "Logga in för att lägga in ditt rum", f"{tag} signed out, Ta en bild / Välj en bild opens the calm sign-in sheet")
        ok(pg.choosers == 0, f"{tag} and no camera or file chooser opens before signing in")
        ok(pg.evaluate("[...document.querySelectorAll('.roomsheet [data-room-gate]')].map((a) => a.textContent.trim())") == ["Logga in", "Skapa gratis konto"], f"{tag} Logga in and Skapa gratis konto")
        ok(pg.evaluate("document.querySelectorAll('.roomsheet.open [data-room-sample]').length") == 7 and "utan konto" in pg.evaluate("document.querySelector('[data-samples-h]').textContent"), f"{tag} the sample rooms stay right there, free without an account")
        bt = pg.evaluate("(() => { const r = document.querySelector('.roomsheet [data-room-gate]').getBoundingClientRect(); return [r.top, r.bottom, r.height]; })()")
        ok(bt[1] <= Hh and bt[2] >= 44, f"{tag} Logga in is on the first screen and large enough to tap: {bt}")
        hit(".roomsheet.open [data-room-gate]:first-child"); pg.wait_for_timeout(900)
        g = json.loads(pg.evaluate("sessionStorage.getItem('rumiq-room-gate')") or "{}")
        ok(pg.evaluate("RQ.currentRoute()") == "konto" and g.get("route") == "produkt-lysa-keramiklampa" and g.get("plan", {}).get("go") == "#mitt-rum-lysa-keramiklampa", f"{tag} the step and what comes next are kept while you sign in: {g}")
        sign_in_on_page(pg)
        ok(pg.evaluate("RQ.currentRoute()") == "produkt-lysa-keramiklampa" and pg.evaluate("document.querySelector('.roomsheet').classList.contains('open')") and pg.evaluate(MODE) == "main", f"{tag} after signing in you are back on the same page with the sheet open")
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
        pg.evaluate("document.querySelector('[data-room-btn]').click()"); pg.wait_for_timeout(500)
        h0 = pg.evaluate("document.querySelector('[data-room-btn]').dataset.roomBtn")
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

    b.close()

print(f"{n - len(fails)} of {n} checks passed")
sys.exit(1 if fails else 0)
