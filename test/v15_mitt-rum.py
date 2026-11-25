#!/usr/bin/env python3
"""v15 checks for Mitt rum, the AI sheet and Studio Plus. Run after `python3 tools/build.py`:
   python3 test/v15_mitt-rum.py
Phone (390 and 360, real touch events) and desktop (1440 and 1280)."""
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
BOX = "(h) => { const r = document.querySelector(`.rm-item[data-h=\"${h}\"]`).getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }"
TOAST = "[...document.querySelectorAll('.toast.show')].map((t) => t.innerText).join(' ')"
VIEW = """(() => { const r = document.getElementById('rmStage').getBoundingClientRect(), c = document.getElementById('rmCanvas').getBoundingClientRect(); return { sx: r.left, sy: r.top, sw: r.width, sh: r.height, cx: c.left, cy: c.top, cw: c.width, ch: c.height }; })()"""
# the positions the things are drawn at, in % of the picture
DRAWN = """(() => { const c = document.getElementById('rmCanvas').getBoundingClientRect(); return Object.fromEntries([...document.querySelectorAll('.rm-item')].map((e) => { const r = e.getBoundingClientRect(); return [e.dataset.h, [+(((r.left + r.width / 2) - c.left) / c.width * 100).toFixed(1), +((r.bottom - c.top) / c.height * 100).toFixed(1), +(r.width / c.width * 100).toFixed(1)]]; })); })()"""


def picture(w, h, kind="JPEG"):
    """a test photo of a room: the bedroom sample, resized"""
    from PIL import Image
    im = Image.open(ROOT / "assets/img/rum/sovrum-1600.webp").convert("RGB").resize((w, h))
    b = io.BytesIO(); im.save(b, kind, quality=85); return b.getvalue()


def ctx_for(b, w, h, mobile):
    kw = dict(viewport={"width": w, "height": h})
    if mobile:
        kw.update(device_scale_factor=3, is_mobile=True, has_touch=True, user_agent=UA)
    ctx = b.new_context(**kw)
    ctx.route(re.compile(r"^https?://(?!127\.0\.0\.1)"), lambda r: r.abort())
    return ctx


def new_page(ctx):
    pg = ctx.new_page(); pg.set_default_timeout(9000); pg.errs = []
    pg.on("pageerror", lambda e: pg.errs.append(str(e)))
    return pg


def touch(cdp, typ, pts):
    cdp.send("Input.dispatchTouchEvent", {"type": typ, "touchPoints": [{"x": x, "y": y, "id": i} for i, (x, y) in enumerate(pts)]})


def swipe(pg, cdp, x0, y0, x1, y1, steps=10):
    touch(cdp, "touchStart", [(x0, y0)]); pg.wait_for_timeout(60)
    for i in range(1, steps + 1):
        touch(cdp, "touchMove", [(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps)]); pg.wait_for_timeout(16)
    touch(cdp, "touchEnd", []); pg.wait_for_timeout(350)


def upload(pg, name, data, mime="image/jpeg"):
    pg.evaluate("RQ.shop.customer() || RQ.shop.signIn('test@example.com', 'Test', 'email')")  # an own photo needs an account (studio brief, founder decision)
    pg.set_input_files(".sheet [data-room-file]:not([capture])", {"name": name, "mimeType": mime, "buffer": data})


def quiet(pg):
    pg.evaluate("document.querySelectorAll('.toast').forEach((t) => t.classList.remove('show')); document.getElementById('ckNeed') && document.getElementById('ckNeed').click()")


with sync_playwright() as p:
    b = p.chromium.launch()

    # ------------------------------------------------------------ phone: the room mode, with real touch events
    for W, Hh in ((390, 844), (360, 740)):
        tag = f"[{W}]"
        ctx = ctx_for(b, W, Hh, True); pg = new_page(ctx); cdp = ctx.new_cdp_session(pg)
        pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(700); quiet(pg)
        ok(pg.evaluate("getComputedStyle(document.querySelector('.dock')).transform") in ("none", "matrix(1, 0, 0, 1, 0, 0)"), f"{tag} the dock stays while there is no room yet")
        # a file that is not a picture, and one the browser cannot read: said inside the sheet
        pg.click("#view [data-room-setup]"); pg.wait_for_timeout(400)
        upload(pg, "notes.txt", b"hello", "text/plain"); pg.wait_for_timeout(300)
        ok(pg.evaluate("(() => { const e = document.querySelector('.sheet.open .sheet-err'); const r = e.getBoundingClientRect(); return !e.hidden && /ingen bild/.test(e.textContent) && r.top > 0 && r.bottom < innerHeight; })()"), f"{tag} a file that is no picture is explained inside the sheet")
        upload(pg, "IMG_1.HEIC", b"\x00" * 900, ""); pg.wait_for_timeout(700)
        ok(pg.evaluate("/HEIC/.test(document.querySelector('.sheet.open .sheet-err').textContent)"), f"{tag} an unreadable HEIC is explained inside the sheet")
        # own portrait photo: the editor opens at once, and the page can still be scrolled from the picture
        upload(pg, "rum.jpg", picture(788, 1400)); pg.wait_for_timeout(1800)
        ok(pg.evaluate("!!document.getElementById('rmStage') && !document.querySelector('.sheet.open')") and "Här är ditt rum" in pg.evaluate(TOAST), f"{tag} own photo: the editor opens on the spot")
        v = pg.evaluate(VIEW)
        ok(v["sh"] <= Hh * 0.8 and abs(v["cw"] / v["ch"] - 788 / 1400) < 0.01, f"{tag} a portrait photo is shown whole and leaves room to scroll: {v}")
        y0 = pg.evaluate("scrollY"); swipe(pg, cdp, W / 2, v["sy"] + v["sh"] * 0.6, W / 2, v["sy"] + v["sh"] * 0.6 - 220)
        ok(pg.evaluate("scrollY") > y0 + 80, f"{tag} a swipe that starts on the room scrolls the page")
        ok(pg.evaluate("!!document.getElementById('rmAsk')"), f"{tag} own photo: asked which room it is")
        pg.evaluate("scrollTo(0, 0)")
        # Byt rum: the picture changes and the things are put where they belong in the new room
        pg.evaluate("RQ.room.add('lysa-keramiklampa', true); RQ.room.add('flatad-forvaringskorg', true)"); pg.wait_for_timeout(400)
        pg.evaluate("document.querySelector('[data-act=done]').click()"); quiet(pg)
        pg.tap("#rmMore"); pg.tap("#rmMenu [data-room-setup]"); pg.wait_for_timeout(500)
        pg.tap(".sheet.open [data-room-sample][data-type=vardagsrum]"); pg.wait_for_timeout(1900)
        lamp = pg.evaluate(SPOT, "lysa-keramiklampa")
        # studio brief: photos are kept at about 1600 px on the long side (was 1400)
        ok(pg.evaluate("document.querySelector('.rm-bg').naturalWidth") == 1600 and abs(float(pg.evaluate("getComputedStyle(document.getElementById('rmStage')).getPropertyValue('--ar')")) - 1600 / 893) < 0.01, f"{tag} Byt rum shows the new room")
        ok(lamp[0] > 70 and 60 < lamp[1] < 72, f"{tag} after Byt rum the lamp stands on the new room's table: {lamp}")
        pg.evaluate("scrollTo(0, 0)"); pg.wait_for_timeout(300); quiet(pg)
        # the room mode: tall view, bigger things, positions unchanged
        v = pg.evaluate(VIEW); d = pg.evaluate(DRAWN); sc = {it["h"]: it for it in pg.evaluate("RQ.room.scene()")}
        ok(v["sh"] >= Hh * 0.55 and v["cw"] > W * 2 and v["sy"] < 130, f"{tag} the room fills the screen and is wider than it: stage {round(v['sh'])} high, picture {round(v['cw'])} wide, starts at {round(v['sy'])}")
        ok(all(abs(d[h][0] - sc[h]["x"]) < 0.3 and abs(d[h][1] - sc[h]["y"]) < 0.3 and abs(d[h][2] - sc[h]["w"]) < 0.3 for h in sc), f"{tag} things are drawn at their stored places in the tall view: {d}")
        lb = pg.evaluate(BOX, "lysa-keramiklampa")
        ok(lb[2] > 60, f"{tag} the lamp is at least 60 pt wide (was 33): {round(lb[2])}")
        ok(pg.evaluate("!document.getElementById('rmPos').hidden && document.getElementById('rmZoom').innerText.trim() === 'Hela rummet'"), f"{tag} position bar and 'Hela rummet' are shown")
        # pan sideways with one finger on the background; up and down scrolls the page
        swipe(pg, cdp, 40, v["sy"] + 60, 40 + 200, v["sy"] + 66); v2 = pg.evaluate(VIEW)
        ok(v2["cx"] > v["cx"] + 120, f"{tag} one finger on the room pans it sideways: {round(v['cx'])} -> {round(v2['cx'])}")
        y0 = pg.evaluate("scrollY"); swipe(pg, cdp, 40, v["sy"] + 300, 44, v["sy"] + 80)
        ok(pg.evaluate("scrollY") > y0 + 80, f"{tag} one finger up on the room scrolls the page")
        pg.evaluate("scrollTo(0, 0)"); pg.wait_for_timeout(250)
        # the camera goes to the thing you pick; tap selects and the action bar takes the toolbar's place
        pg.evaluate("document.querySelector('#rmList [data-pick=lysa-keramiklampa]').click()"); pg.wait_for_timeout(1000); pg.evaluate("scrollTo(0, 0)"); pg.wait_for_timeout(300)
        lb = pg.evaluate(BOX, "lysa-keramiklampa")
        ok(0 < lb[0] and lb[0] + lb[2] < W, f"{tag} the camera glides to the chosen thing: {lb}")
        act = pg.evaluate("(() => { const a = document.getElementById('rmAct'), r = a.getBoundingClientRect(); return [a.hidden, r.top, r.bottom, document.getElementById('rmBar').getBoundingClientRect().top, getComputedStyle(document.querySelector('.rm-tools')).display, [...a.querySelectorAll('button')].every((x) => x.getBoundingClientRect().height >= 44)]; })()")
        ok(not act[0] and act[2] <= act[3] and act[4] == "none" and act[5], f"{tag} tapping a thing shows its actions above the buy bar: {act}")
        ok(pg.evaluate("getComputedStyle(document.querySelector('.rm-item.sel')).outlineStyle") == "dashed", f"{tag} a selected lamp has a frame")
        # drag with a finger; a trembling tap does not move it
        s0 = pg.evaluate(SPOT, "lysa-keramiklampa"); swipe(pg, cdp, lb[0] + lb[2] / 2, lb[1] + lb[3] / 2, lb[0] + lb[2] / 2 - 60, lb[1] + lb[3] / 2 - 24)
        s1 = pg.evaluate(SPOT, "lysa-keramiklampa"); v = pg.evaluate(VIEW)
        ok(abs((s0[0] - s1[0]) - 60 / v["cw"] * 100) < 0.6 and abs((s0[1] - s1[1]) - 24 / v["ch"] * 100) < 0.6, f"{tag} a finger drag moves the thing exactly as far as the finger: {s0} -> {s1}")
        lb = pg.evaluate(BOX, "lysa-keramiklampa"); swipe(pg, cdp, lb[0] + lb[2] / 2, lb[1] + lb[3] / 2, lb[0] + lb[2] / 2 + 2, lb[1] + lb[3] / 2 + 2, steps=2)
        ok(pg.evaluate(SPOT, "lysa-keramiklampa") == s1, f"{tag} a tap with a trembling finger does not move the thing")
        pg.tap("[data-act=bigger]"); pg.wait_for_timeout(200)
        ok(pg.evaluate(SPOT, "lysa-keramiklampa")[2] > s1[2] and pg.evaluate("document.querySelector('.rm-item.sel').dataset.h") == "lysa-keramiklampa", f"{tag} 'Större' makes it bigger and it stays selected")
        pg.tap("[data-act=order]"); pg.wait_for_timeout(200)
        ok(pg.evaluate("RQ.room.ordered()[0].h") == "lysa-keramiklampa" and pg.evaluate("document.getElementById('rmActOrder').innerText") == "Lägg framför", f"{tag} 'Lägg bakom' sends it to the back")  # r3 M3: Bakåt/Framåt renamed Lägg bakom/Lägg framför
        pg.tap("[data-act=del]"); pg.wait_for_timeout(300)
        ok(not pg.evaluate("RQ.room.inScene('lysa-keramiklampa')") and pg.is_visible("#rmUndo"), f"{tag} 'Ta bort' offers an undo")  # r4: the Ångra button on the room is the one undo (no second link in the toast)
        pg.evaluate("document.getElementById('rmUndo').click()"); pg.wait_for_timeout(300)
        ok(pg.evaluate("RQ.room.inScene('lysa-keramiklampa')"), f"{tag} undo brings it back")
        # two fingers zoom the room when nothing is selected
        quiet(pg); pg.evaluate("scrollTo(0, 0)"); pg.wait_for_timeout(200); v = pg.evaluate(VIEW)
        touch(cdp, "touchStart", [(30, v["sy"] + 40)]); pg.wait_for_timeout(40); touch(cdp, "touchEnd", []); pg.wait_for_timeout(250)
        cx, cy = W / 2, v["sy"] + 60
        touch(cdp, "touchStart", [(cx - 30, cy)]); pg.wait_for_timeout(30); touch(cdp, "touchStart", [(cx - 30, cy), (cx + 30, cy)]); pg.wait_for_timeout(30)
        for i in range(1, 9):
            touch(cdp, "touchMove", [(cx - 30 - i * 6, cy), (cx + 30 + i * 6, cy)]); pg.wait_for_timeout(16)
        touch(cdp, "touchEnd", []); pg.wait_for_timeout(300)
        z = pg.evaluate(VIEW)
        ok(z["cw"] > v["cw"] * 1.8, f"{tag} two fingers zoom the room: {round(v['cw'])} -> {round(z['cw'])}")
        pg.tap("#rmZoom"); pg.wait_for_timeout(600); z = pg.evaluate(VIEW)
        ok(abs(z["cw"] - v["cw"]) < 2, f"{tag} 'Hela rummet' first takes the zoom away")
        pg.tap("#rmZoom"); pg.wait_for_timeout(600); z = pg.evaluate(VIEW)
        ok(abs(z["cw"] - W) < 2 and pg.evaluate("document.getElementById('rmZoom').innerText.trim()") == "Närmare", f"{tag} then shows the whole room, and offers 'Närmare'")
        pg.tap("#rmZoom"); pg.wait_for_timeout(600)
        # the picker leaves the room in view, and the chosen thing lands where you can see it
        pg.tap("#rmAdd"); pg.wait_for_timeout(900)
        pk = pg.evaluate("(() => { const c = document.querySelector('.sheet.rmpick .sheet-card').getBoundingClientRect(), s = document.getElementById('rmStage').getBoundingClientRect(); return [c.top, s.bottom, s.height, s.top]; })()")
        ok(pk[1] <= pk[0] + 2 and pk[2] > 250 and pk[3] > 40, f"{tag} the picker sits under the room, which stays in view: {pk}")
        pg.tap("#pickGrid [data-room-btn='sand-keramikvas']"); pg.wait_for_timeout(150)
        ok(pg.evaluate("document.querySelector('.rm-item[data-h=sand-keramikvas]').classList.contains('land')"), f"{tag} the thing you pick lands")
        pg.wait_for_timeout(900); vb = pg.evaluate(BOX, "sand-keramikvas")
        ok(0 < vb[0] < W - vb[2] and vb[1] + vb[3] < pk[0], f"{tag} and it lands inside the visible part of the room: {vb}")
        ok("Öppna" not in pg.evaluate(TOAST), f"{tag} no toast with a link to the page you are on")
        for q, want in (("kudde", "Lin kuddfodral"), ("lmpa", "Lysa keramiklampa"), ("matta", "Strand jutematta 160 × 230")):
            pg.fill("#pickQ", q); pg.wait_for_timeout(150)
            ok(want in pg.evaluate("[...document.querySelectorAll('#pickGrid button b')].map((b) => b.textContent)"), f"{tag} picker search '{q}' finds {want}")
        pg.fill("#pickQ", "xyzq"); pg.wait_for_timeout(150)
        ok(pg.evaluate("!!document.querySelector('.pick-none')"), f"{tag} picker says so when nothing is found")
        pg.fill("#pickQ", ""); pg.tap("#pickGroups [data-g=vagg]"); pg.wait_for_timeout(150)
        ok(pg.evaluate("document.querySelectorAll('#pickGrid button').length") == 2, f"{tag} picker groups: 'På väggen' shows the two prints")
        pg.tap(".sheet.rmpick .sheet-x"); pg.wait_for_timeout(700)
        ok(pg.evaluate(VIEW)["sh"] >= Hh * 0.55, f"{tag} the room takes its height back when the picker closes")
        # "Spara som look" exists on a phone
        ok(pg.evaluate("(() => { const l = document.getElementById('rmLook'); return !l.hidden && l.offsetParent !== null; })()"), f"{tag} 'Spara som look' can be reached on a phone")
        ok(not pg.errs, f"{tag} no script errors: {pg.errs[:2]}")
        ctx.close()

    # ------------------------------------------------------------ phone landscape: nothing is trapped
    ctx = ctx_for(b, 844, 390, True); pg = new_page(ctx); cdp = ctx.new_cdp_session(pg)
    pg.goto(BASE); pg.wait_for_timeout(400); pg.evaluate(SAMPLE, "vardagsrum"); pg.evaluate("RQ.room.add('lysa-keramiklampa', true)")
    pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(1200); quiet(pg)
    v = pg.evaluate(VIEW)
    ok(v["sh"] <= 390 - 58 - 63 + 2, f"[844x390] the room fits between the header and the buy bar: {round(v['sh'])}")
    y0 = pg.evaluate("scrollY"); swipe(pg, cdp, 300, v["sy"] + 150, 304, v["sy"] + 20)
    ok(pg.evaluate("scrollY") > y0 + 60, "[844x390] the page scrolls from the room")
    ctx.close()

    # ------------------------------------------------------------ desktop
    for W, Hh in ((1440, 900), (1280, 720)):
        tag = f"[{W}]"
        ctx = ctx_for(b, W, Hh, False); pg = new_page(ctx)
        pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(700); quiet(pg)
        pg.click("#view [data-room-setup]"); pg.wait_for_timeout(400)
        tops = pg.evaluate("[...document.querySelectorAll('.sheet-samples img')].map((i) => Math.round(i.getBoundingClientRect().top))")
        ok(len(set(tops)) == -(-len(tops) // 4), f"{tag} sample thumbnails line up: {tops}")  # r3 D22: seven samples, four to a row
        ok(pg.evaluate("document.querySelector('[data-tip-touch]').hidden && !document.querySelector('[data-tip-desk]').hidden && !document.querySelector('.sheet-acts .btn:not(.cam)').classList.contains('ghost')"), f"{tag} the sheet speaks to a computer: own tip, one main button")
        # drop a photo on the sheet (an own photo needs an account: studio brief, founder decision)
        pg.evaluate("RQ.shop.signIn('test@example.com', 'Test', 'email')")
        pg.evaluate("""(b64) => { const bin = atob(b64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); const dt = new DataTransfer(); dt.items.add(new File([u8], 'rum.jpg', { type: 'image/jpeg' }));
          document.querySelector('.sheet.open .sheet-card').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); }""", base64.b64encode(picture(1050, 1400)).decode())
        pg.wait_for_timeout(1800)
        st = pg.evaluate("(() => { const r = document.getElementById('rmStage').getBoundingClientRect(); return [r.width, r.height]; })()")
        ok(pg.evaluate("!!document.getElementById('rmStage')") and abs(st[0] / st[1] - 0.75) < 0.01 and st[1] <= Hh * 0.78 + 1, f"{tag} a dropped portrait photo opens the editor and is not cropped: {st}")
        # the same arrangement is saved as it is seen
        pg.evaluate("RQ.room.saveScene([{ h: 'flatad-forvaringskorg', x: 20, y: 60, w: 18, flip: false, light: 100 }])"); pg.wait_for_timeout(400)
        d = pg.evaluate(DRAWN)["flatad-forvaringskorg"]
        ok(abs(d[0] - 20) < 0.3 and abs(d[1] - 60) < 0.3 and abs(d[2] - 18) < 0.3, f"{tag} what you see is where it is saved (portrait photo): {d}")
        # paste a photo
        pg.evaluate("RQ.room.openSetup()"); pg.wait_for_timeout(300)
        pg.evaluate("""(b64) => { const bin = atob(b64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); const dt = new DataTransfer(); dt.items.add(new File([u8], 'p.jpg', { type: 'image/jpeg' }));
          document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }""", base64.b64encode(picture(4000, 1000)).decode())
        pg.wait_for_timeout(1800)
        r = pg.evaluate("[RQ.room.get().w, RQ.room.get().h]")
        ok(r[0] == 1600 and abs(r[0] / r[1] - 2.2) < 0.02, f"{tag} a pasted panorama is taken in and trimmed to 2.2:1: {r}")
        # sample from the sheet, on the Mitt rum page
        pg.evaluate("RQ.room.saveScene([]); RQ.room.openSetup()"); pg.wait_for_timeout(300)
        pg.click(".sheet.open [data-room-sample][data-type=vardagsrum]"); pg.wait_for_timeout(1700); quiet(pg)
        ok(pg.evaluate("RQ.room.get().sample && document.querySelector('.rm-bg').naturalWidth === 1600"), f"{tag} a sample room from the sheet is shown at once")
        # a table has an end: the fourth thing goes to the floor and says so
        for h in ["lysa-keramiklampa", "sand-keramikvas", "glod-doftljus-keramik"]:
            pg.evaluate("(h) => RQ.room.add(h, true)", h)
        pg.evaluate("RQ.room.add('stilla-ljusstake-massing-2-pack')"); pg.wait_for_timeout(300)
        c4 = pg.evaluate(SPOT, "stilla-ljusstake-massing-2-pack")
        ok(c4[1] > 78 and "golvet" in pg.evaluate(TOAST), f"{tag} a full table: the next thing stands on the floor and you are told: {c4}")
        ok(all(72 <= pg.evaluate(SPOT, h)[0] <= 85.5 for h in ["lysa-keramiklampa", "sand-keramikvas", "glod-doftljus-keramik"]), f"{tag} the first three stand on the table")
        pg.evaluate("RQ.room.add('plad-ullblandning-havre', true)")
        ok(55 < pg.evaluate(SPOT, "plad-ullblandning-havre")[0] < 70, f"{tag} a candle on the table does not push the throw off the sofa")
        pg.wait_for_timeout(900); quiet(pg)
        # total and button on the first screen
        ok(pg.evaluate("document.getElementById('rmCart').getBoundingClientRect().bottom") < Hh and pg.evaluate("document.getElementById('rmTotal').getBoundingClientRect().bottom") < Hh, f"{tag} the room's price and buy button are on the first screen")
        # selection frame on a lamp; the wheel only resizes over the selected thing
        lb = pg.evaluate(BOX, "lysa-keramiklampa"); pg.mouse.click(lb[0] + lb[2] / 2, lb[1] + lb[3] / 2); pg.wait_for_timeout(200)
        ok(pg.evaluate("getComputedStyle(document.querySelector('.rm-item.sel')).outlineStyle") == "dashed", f"{tag} a selected lamp has a frame")
        ok(pg.evaluate("document.getElementById('rmCart').getBoundingClientRect().bottom") < Hh, f"{tag} selecting does not push the buy button away")
        w0 = pg.evaluate(SPOT, "lysa-keramiklampa")[2]; pg.mouse.move(lb[0] - 300, lb[1]); pg.mouse.wheel(0, 180); pg.wait_for_timeout(250)
        ok(pg.evaluate("scrollY") > 100 and pg.evaluate(SPOT, "lysa-keramiklampa")[2] == w0, f"{tag} the wheel scrolls the page when the pointer is not on the selected thing")
        pg.evaluate("scrollTo(0, 0)"); pg.wait_for_timeout(150); lb = pg.evaluate(BOX, "lysa-keramiklampa"); pg.mouse.move(lb[0] + lb[2] / 2, lb[1] + lb[3] / 2); pg.mouse.wheel(0, -100); pg.wait_for_timeout(250)
        ok(pg.evaluate(SPOT, "lysa-keramiklampa")[2] > w0, f"{tag} the wheel over the selected thing changes its size")
        # keyboard: focus stays, Delete can be undone with Ctrl+Z
        pg.focus(".rm-item[data-h='sand-keramikvas']"); pg.keyboard.press("+"); pg.wait_for_timeout(120)
        ok(pg.evaluate("document.activeElement.dataset.h") == "sand-keramikvas", f"{tag} focus stays on the thing after +")
        pg.keyboard.press("Delete"); pg.wait_for_timeout(250)
        ok(not pg.evaluate("RQ.room.inScene('sand-keramikvas')") and pg.evaluate("document.activeElement.classList.contains('rm-item')"), f"{tag} Delete removes it and focus moves to the next thing")
        pg.keyboard.press("Control+z"); pg.wait_for_timeout(250)
        ok(pg.evaluate("RQ.room.inScene('sand-keramikvas')"), f"{tag} Ctrl+Z takes the removal back")
        # a thing cannot be dragged out of the picture
        bb = pg.evaluate(BOX, "plad-ullblandning-havre"); pg.mouse.move(bb[0] + bb[2] / 2, bb[1] + bb[3] / 2); pg.mouse.down(); pg.mouse.move(W - 4, Hh - 4, steps=8); pg.mouse.up(); pg.wait_for_timeout(250)
        e = pg.evaluate("(() => { const s = document.getElementById('rmStage').getBoundingClientRect(), r = document.querySelector('.rm-item[data-h=plad-ullblandning-havre]').getBoundingClientRect(); return [(r.right - s.right) / r.width, (r.bottom - s.bottom) / r.height]; })()")
        ok(e[0] < 0.36 and e[1] < 0.1, f"{tag} at most a third of a thing can hang over the edge: {e}")
        # the picker is a panel beside the room; Escape gives focus back
        pg.click("#rmAdd"); pg.wait_for_timeout(700)
        pk = pg.evaluate("(() => { const c = document.querySelector('.sheet.rmpick .sheet-card').getBoundingClientRect(), s = document.getElementById('rmStage').getBoundingClientRect(); return [c.left, s.right, c.height]; })()")
        ok(pk[0] >= pk[1] and pk[2] > Hh * 0.6, f"{tag} the picker stands beside the room: {pk}")
        pg.keyboard.press("Escape"); pg.wait_for_timeout(500)
        ok(pg.evaluate("document.activeElement.id") == "rmAdd", f"{tag} Escape closes the picker and focus returns to 'Lägg till'")
        # everything into the cart: colours are asked for, a second press does not double
        pg.evaluate("RQ.room.add('lin-kuddfodral', true)"); pg.wait_for_timeout(300)
        pg.evaluate("document.getElementById('rmCart').click()"); pg.wait_for_timeout(500)
        ok(pg.evaluate("document.querySelectorAll('#varList .var-row').length") == 1 and pg.evaluate("document.querySelectorAll('#varList [data-v]').length") == 2, f"{tag} the cushion's colour is asked for before the room goes into the cart")
        pg.click("#varList [data-v='1']"); pg.click("#varGo"); pg.wait_for_timeout(500)
        cart = pg.evaluate("RQ.shop.cartLines().map((l) => [l.product.handle, l.quantity, l.variant.title])")
        ok(len(cart) == pg.evaluate("RQ.room.scene().length") and ["lin-kuddfodral", 1, "Salvia"] in cart, f"{tag} the cart holds what is in the room, in the chosen colour: {cart}")
        pg.wait_for_timeout(2700); pg.evaluate("document.getElementById('rmCart').click()"); pg.wait_for_timeout(400)
        # r6 (C5): once all of it lies in the cart the button says "I varukorgen · Visa" and opens the cart instead of a toast
        ok(all(q == 1 for q in pg.evaluate("RQ.shop.cartLines().map((l) => l.quantity)")) and pg.evaluate("document.getElementById('cart').classList.contains('open')"), f"{tag} a second press does not double the order, it shows the cart")
        pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
        # Spara twice, look twice
        quiet(pg); pg.click("#rmSave"); pg.wait_for_timeout(900); pg.click("#rmSave"); pg.wait_for_timeout(500)
        ok(pg.evaluate("RQ.shop.projects().length") == 1 and "redan" in pg.evaluate(TOAST), f"{tag} 'Spara' twice keeps one project")
        pg.evaluate("document.getElementById('rmLook').click(); document.getElementById('rmLook').click()"); pg.wait_for_timeout(300)
        ok(pg.evaluate("RQ.shop.looks().length") == 1, f"{tag} 'Spara som look' twice keeps one look")
        # Inred åt mig keeps finding things, and can be undone as one step
        pg.evaluate("RQ.room.saveScene([])"); pg.wait_for_timeout(200)
        seen = []
        for i in range(4):
            pg.click("#rmSuggest"); pg.wait_for_timeout(400); seen.append(pg.evaluate("RQ.room.scene().length"))
        ok(seen[0] == 4 and seen[3] > seen[1] > seen[0], f"{tag} 'Inred åt mig' goes on suggesting: {seen}")
        ok(pg.evaluate("RQ.room.scene()[0].h") != "dagsljus-linnegardin-2-pack", f"{tag} the first suggestion is not the curtain")
        before = seen[2]; pg.keyboard.press("Control+z"); pg.wait_for_timeout(300)
        ok(pg.evaluate("RQ.room.scene().length") == before, f"{tag} Ctrl+Z takes back one round of suggestions")
        # the harmony shows a word, and tells sets apart
        hm = pg.evaluate("(() => { const s = (l) => { RQ.room.saveScene([]); l.forEach((h) => RQ.room.add(h, true)); return RQ.room.harmony(); }; return [s(['lysa-keramiklampa', 'sand-keramikvas']), s(['svamp-uppladdningsbar-lampa', 'terrakottakruka-rafflad'])]; })()")
        ok(hm[0]["word"] == "Samspelt" and hm[1]["word"] == "Spretigt", f"{tag} 'Går ihop' tells a matched pair from a mixed one: {[h['word'] for h in hm]}")
        m = pg.evaluate("RQ.PRODUCTS.map((p) => RQ.room.match(p))")
        ok(max(m) - min(m) >= 40, f"{tag} colour match spreads over a wide range: {min(m)}–{max(m)}")
        ok(not pg.errs, f"{tag} no script errors: {pg.errs[:2]}")
        ctx.close()

    # ------------------------------------------------------------ own photo: the first thing teaches the room; from a product page
    ctx = ctx_for(b, 390, 844, True); pg = new_page(ctx); cdp = ctx.new_cdp_session(pg)
    pg.goto(BASE + "mitt-rum-lysa-keramiklampa/"); pg.wait_for_timeout(800); quiet(pg)
    # the title is the built one of Mitt rum (a near-copy page carries its target's head, see test/v15_seo-fart.py); the page itself names the product
    ok("Lysa keramiklampa" in pg.evaluate("document.querySelector('.rm-want').innerText"), "[own] the page names the product you came with")
    pg.click("#view [data-room-setup]"); pg.wait_for_timeout(400)
    upload(pg, "rum.jpg", picture(1400, 788)); pg.wait_for_timeout(2200)
    ok(pg.evaluate("RQ.room.scene().map((i) => i.h)") == ["lysa-keramiklampa"] and pg.evaluate("document.querySelector('.rm-item.sel').dataset.h") == "lysa-keramiklampa", "[own] the product stands in the new room and is selected")
    ok(pg.evaluate("!document.getElementById('rmFirst').hidden && /lagom stor/.test(document.getElementById('rmFirst').innerText)"), "[own] you are told to place and size the first thing")
    ok(pg.evaluate("scrollY") == 0, "[own] the page shows the room from the top")
    pg.tap("[data-act=bigger]"); pg.wait_for_timeout(150); pg.tap("[data-act=bigger]"); pg.wait_for_timeout(250)
    k = json.loads(pg.evaluate("localStorage.getItem('rumiq-roomlearn')")).get("k")
    pg.evaluate("RQ.room.add('sand-keramikvas', true); RQ.room.add('flatad-forvaringskorg', true)"); pg.wait_for_timeout(300)
    lamp, vase, basket = [pg.evaluate(SPOT, h) for h in ("lysa-keramiklampa", "sand-keramikvas", "flatad-forvaringskorg")]
    ok(k and k > 1.2 and abs(vase[2] / lamp[2] - 17 / 30.5) < 0.05 and abs(vase[1] - lamp[1]) < 0.2, f"[own] the next table thing keeps the scale you chose: k {k}, lamp {lamp}, vase {vase}")
    ok(abs(basket[2] - 0.9 * (92 - 48) * 0.4 * k) < 0.4, f"[own] floor things follow the same scale: {basket}")
    ok(vase[2] >= 2.5, "[own] nothing becomes smaller than can be touched")
    pg.tap("#rmAsk [data-roomtype=sovrum]"); pg.wait_for_timeout(300)
    ok(pg.evaluate("RQ.room.get().type") == "sovrum" and pg.evaluate("!document.getElementById('rmAsk')"), "[own] the room type is saved from the question under the room")
    upload_small = picture(300, 200)
    pg.evaluate("document.querySelector('[data-act=done]') && document.querySelector('[data-act=done]').click(); RQ.room.openSetup()"); pg.wait_for_timeout(300)
    upload(pg, "liten.jpg", upload_small); pg.wait_for_timeout(1800)
    # studio brief: a small photo gets a friendly word with "Använd ändå" / "Välj en annan" before it goes in (was a toast after)
    ok("liten" in pg.evaluate("document.getElementById('roomSheetTitle').textContent"), "[own] a tiny photo gets a friendly word first")
    pg.tap(".sheet.open [data-check-use]"); pg.wait_for_timeout(1500)
    ok(pg.evaluate("RQ.room.get().w") == 300, "[own] and goes in with Använd ändå")
    ctx.close()

    ctx = ctx_for(b, 390, 844, True); pg = new_page(ctx)
    pg.goto(BASE); pg.wait_for_timeout(400); pg.evaluate(SAMPLE, "vardagsrum"); pg.evaluate("RQ.room.add('plad-ullblandning-havre', true)")
    pg.goto(BASE + "produkt-sand-keramikvas/"); pg.wait_for_timeout(1200); quiet(pg)
    pg.evaluate("window.__l = 0; const iv = setInterval(() => { if (document.querySelector('.rm-item.land[data-h=sand-keramikvas]')) window.__l++; }, 40); setTimeout(() => clearInterval(iv), 4000); document.querySelector('.roomcta').click()")
    pg.wait_for_timeout(2600)
    ok(pg.evaluate("window.__l") > 0, "[pdp] the product you bring from its page lands in the room")
    ok(pg.evaluate("document.querySelector('.rm-item.sel') && document.querySelector('.rm-item.sel').dataset.h") == "sand-keramikvas", "[pdp] and it is the one that is selected")
    ctx.close()

    # ------------------------------------------------------------ storage: full, corrupt, cleared
    ctx = ctx_for(b, 1280, 800, False); pg = new_page(ctx)
    pg.goto(BASE); pg.wait_for_timeout(400); pg.evaluate(SAMPLE, "vardagsrum"); pg.evaluate("RQ.room.add('lysa-keramiklampa', true)")
    pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(1000); quiet(pg)
    pg.evaluate("""(() => { for (const size of [500000, 100000, 10000, 1000, 100, 10, 1]) { try { for (let i = 0; i < 200; i++) localStorage.setItem('zz-' + size + '-' + i, 'x'.repeat(size)); } catch (e) {} } })()""")
    r = pg.evaluate("RQ.room.add('sand-keramikvas')"); pg.wait_for_timeout(200)
    ok(r is False and not pg.evaluate("RQ.room.inScene('sand-keramikvas')") and "full" in pg.evaluate(TOAST), "[full] a thing that could not be saved is not claimed to stand in the room")
    quiet(pg); pg.click("#rmAdd"); pg.wait_for_timeout(500); pg.click("#pickGrid [data-room-btn='sand-keramikvas']"); pg.wait_for_timeout(300)
    ok(pg.evaluate("document.querySelector('#pickGrid [data-room-btn=sand-keramikvas]').getAttribute('aria-pressed')") == "false", "[full] the picker does not tick a thing that was not saved")
    pg.keyboard.press("Escape"); quiet(pg); pg.click("#rmSuggest"); pg.wait_for_timeout(300)
    ok("förslag" not in pg.evaluate(TOAST), "[full] 'Inred åt mig' does not claim suggestions that were not saved")
    pg.evaluate("Object.keys(localStorage).filter((k) => k.startsWith('zz-')).forEach((k) => localStorage.removeItem(k))")
    for bad, name in (("{\"a\":1}", "an object"), ("\"text\"", "a string"), ("[null, 5, {\"h\":\"lysa-keramiklampa\"}, {\"h\":\"sand-keramikvas\",\"x\":\"a\",\"y\":null,\"w\":-5}, {\"h\":\"glod-doftljus-keramik\",\"x\":50,\"y\":60,\"w\":4}]", "broken rows")):
        pg.evaluate("(v) => localStorage.setItem('rumiq-scene', v)", bad); pg.errs.clear()
        pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(700)
        ok(not pg.errs and pg.evaluate("!!document.getElementById('rmStage')") and pg.evaluate("RQ.room.scene().length") == (1 if name == "broken rows" else 0), f"[corrupt] a stored scene that is {name} is read safely: {pg.errs[:1]}")
    for bad in ("\"str\"", "{\"img\":\"javascript:alert(1)\",\"w\":10,\"h\":10}", "{\"img\":\"data:image/jpeg;base64,AAAA\",\"w\":\"1/0;x\",\"h\":10}"):
        pg.evaluate("(v) => localStorage.setItem('rumiq-myroom', v)", bad); pg.errs.clear()
        pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(600)
        ok(not pg.errs and pg.evaluate("!RQ.room.has() && !document.getElementById('rmStage')"), f"[corrupt] a stored room that is not a picture is ignored: {bad[:30]}")
    pg.evaluate(SAMPLE, "hall"); pg.evaluate("RQ.room.add('lysa-keramiklampa', true); localStorage.setItem('rumiq-room-night', '1')")
    pg.evaluate("RQ.room.clear()")
    left = pg.evaluate("Object.keys(localStorage).filter((k) => /^rumiq-(myroom|scene|roommode|roomlearn|room-)/.test(k))")
    ok(not left and not pg.evaluate("RQ.room.has()") and pg.evaluate("RQ.room.scene().length") == 0, f"[clear] RQ.room.clear() removes every room key: {left}")
    ctx.close()

    # ------------------------------------------------------------ the tall phone view changes nothing in what is saved, sent or shown in the shop
    SCENE = [{"h": "lysa-keramiklampa", "x": 78, "y": 68.8, "w": 8.5, "flip": False, "light": 100}, {"h": "flatad-forvaringskorg", "x": 31.5, "y": 84, "w": 9.9, "flip": True, "light": 110}, {"h": "strand-jutematta", "x": 45, "y": 96, "w": 50, "sy": 0.42, "flip": False, "light": 100}]
    got = {}
    for nm, (W, Hh, mob) in (("phone", (390, 844, True)), ("desktop", (1440, 900, False))):
        ctx = ctx_for(b, W, Hh, mob); pg = new_page(ctx)
        pg.goto(BASE); pg.wait_for_timeout(400); pg.evaluate(SAMPLE, "vardagsrum"); pg.evaluate("(s) => RQ.room.saveScene(s)", SCENE)
        pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(1200); quiet(pg)
        drawn = pg.evaluate(DRAWN)
        comp = pg.evaluate("RQ.ai.composite(600)")
        pg.evaluate("document.getElementById('rmSave').click()"); pg.wait_for_timeout(1200)
        saved = pg.evaluate("RQ.shop.projects()[0].img")
        layers = pg.evaluate("RQ.PRODUCTS.map((p) => RQ.room.layer(p).replace(/blob:[^\"]+/g, 'B')).join('|')")
        got[nm] = (drawn, comp, saved, layers); ctx.close()
    ok(all(abs(got["phone"][0][it["h"]][i] - (it["x"], it["y"], it["w"])[i]) < 0.3 for it in SCENE for i in range(3)), f"[same] phone draws every thing at its stored place: {got['phone'][0]}")
    ok(got["phone"][0] == got["desktop"][0], "[same] phone and desktop draw the things at the same places")
    ok(got["phone"][1] == got["desktop"][1], "[same] the AI guide picture is the same from phone and desktop")
    ok(got["phone"][2] == got["desktop"][2], "[same] the saved picture is the same from phone and desktop")
    ok(got["phone"][3] == got["desktop"][3], "[same] the shop-card crops are the same on phone and desktop")

    # ------------------------------------------------------------ AI sheet and Studio Plus
    for W, Hh, mob in ((390, 844, True), (1440, 900, False)):
        tag = f"[ai {W}]"
        ctx = ctx_for(b, W, Hh, mob); pg = new_page(ctx)
        pg.goto(BASE + "studio-plus/"); pg.wait_for_timeout(2300); quiet(pg)
        ok(pg.evaluate("document.querySelectorAll('.sp-pair img').length") == 2 and pg.evaluate("[...document.querySelectorAll('.sp-pair img')].every((i) => i.complete && i.naturalWidth > 0)"), f"{tag} Studio Plus shows an example picture pair")
        txt = pg.evaluate("document.querySelector('#view').innerText")
        ok("Så många gånger du vill" not in txt and "exakt dina platser" not in txt and "verklighetstrogen" in txt and "RumIQ Studio" not in txt, f"{tag} Studio Plus promises only what the terms say")
        ok(pg.evaluate("!document.querySelector('#view .btn.accent')"), f"{tag} the Studio Plus buttons are graphite like the rest")
        first = pg.evaluate("[...document.querySelectorAll('.sp-plan')].sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top || a.getBoundingClientRect().left - b.getBoundingClientRect().left)[0].classList.contains('plus')")
        ok(first == mob, f"{tag} the paid plan comes first on a phone")
        pg.goto(BASE + "#studio-plus-tack"); pg.wait_for_timeout(2300)
        ok(pg.evaluate("document.getElementById('spThanks').innerText.trim()") == "", f"{tag} studio-plus-tack does not thank a visitor who has no subscription")
        pg.evaluate("RQ.shop.signIn('test@example.com', 'Test', 'email'); localStorage.setItem('rumiq-ai-consent', JSON.stringify('x'))")
        pg.evaluate(SAMPLE, "sovrum")
        for h in ["glob-bordslampa-opalglas", "lysa-keramiklampa", "svamp-uppladdningsbar-lampa", "sand-keramikvas", "glod-doftljus-keramik", "plad-ullblandning-havre", "lin-kuddfodral", "affisch-linje-ekram"]:
            pg.evaluate("(h) => RQ.room.add(h, true)", h)
        pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(1300); quiet(pg)
        pg.evaluate("RQ.openAI()"); pg.wait_for_timeout(2400)
        ok(pg.evaluate("document.querySelectorAll('.ai-choose [data-in]').length") == 8 and pg.evaluate("document.querySelectorAll('.ai-choose [data-in]:checked').length") == 6 and not pg.evaluate("document.getElementById('aiGo').disabled"), f"{tag} eight things: you choose which six go into the picture")
        pg.evaluate("document.querySelectorAll('[data-in]')[6].click()"); pg.wait_for_timeout(500)
        ok(pg.evaluate("document.getElementById('aiGo').disabled") and "Ta bort 1" in pg.evaluate("document.getElementById('aiCount').innerText"), f"{tag} seven ticked: the button waits and says why")
        pg.evaluate("document.querySelectorAll('[data-in]')[0].click(); document.querySelectorAll('[data-in]')[1].click()"); pg.wait_for_timeout(500)
        pg.evaluate("document.getElementById('aiGo').click()"); pg.wait_for_timeout(400)
        ok(pg.evaluate("!!document.getElementById('aiStop')"), f"{tag} the wait can be cancelled")
        pg.evaluate("document.getElementById('aiStop').click()"); pg.wait_for_timeout(1700)
        ok("Avbrutet" in pg.evaluate(TOAST) and pg.evaluate("document.getElementById('aiTitle').innerText") == "Gör bilden verklig.", f"{tag} Avbryt takes you back")
        pg.evaluate("document.getElementById('aiGo').click()"); pg.wait_for_timeout(2600)
        ok(pg.evaluate("document.querySelectorAll('.ai-prods li').length") == 5, f"{tag} the result lists the five chosen things")
        pg.keyboard.press("Escape"); pg.wait_for_timeout(400)
        pg.evaluate("RQ.room.saveScene(RQ.room.scene().slice(0, 3))"); pg.wait_for_timeout(300); pg.evaluate("RQ.openAI()"); pg.wait_for_timeout(2400)
        go = pg.evaluate("[document.getElementById('aiGo').getBoundingClientRect().bottom, document.querySelector('.ai-more').getBoundingClientRect().top, document.querySelectorAll('.ai-body [disabled]').length]")
        ok(go[0] < Hh and go[0] <= go[1] and go[2] == 0, f"{tag} 'Skapa bild' is on the first screen, above the Studio Plus line: {go}")
        pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
        # on the real site a server that does not answer is an error, not a preview
        pg.evaluate("RQ_CONFIG.auth.preview = false; RQ.openAI()"); pg.wait_for_timeout(1200)
        body = pg.evaluate("document.querySelector('.ai-body').innerText")
        ok("Ingen kontakt med servern" in body and "Förhandsvisning" not in body and pg.evaluate("!!document.getElementById('aiRetry')"), f"{tag} an unreachable server is called that, with a retry")
        ok(not pg.errs, f"{tag} no script errors: {pg.errs[:2]}")
        ctx.close()

    # ------------------------------------------------------------ evening mode and English
    ctx = ctx_for(b, 390, 844, True); pg = new_page(ctx)
    pg.goto(BASE); pg.wait_for_timeout(400); pg.evaluate("localStorage.setItem('rumiq-ljus', 'kvall')"); pg.evaluate(SAMPLE, "vardagsrum"); pg.evaluate("RQ.room.add('lysa-keramiklampa', true)")
    pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(1100); quiet(pg)
    pg.evaluate("document.querySelector('.rm-item').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 9, isPrimary: true })); document.getElementById('rmStage').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 9 }))"); pg.wait_for_timeout(200)
    c = pg.evaluate("(() => { const b = document.querySelector('#rmAct button'), s = getComputedStyle(b); const lum = (c) => { const m = c.match(/[\\d.]+/g).map(Number).slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; }; const a = lum(s.color), d = lum(s.backgroundColor); return (Math.max(a, d) + 0.05) / (Math.min(a, d) + 0.05); })()")
    ok(c > 4.5, f"[kvall] the action bar is readable in evening mode: contrast {round(c, 1)}")
    ctx.close()

    add = json.loads((ROOT / "tools/i18n-add/mitt-rum.json").read_text(encoding="utf-8"))
    ctx = ctx_for(b, 1280, 800, False)
    def en(route):  # the pairs the build will merge are added here too, so this check holds before and after the merge
        body = (ROOT / "assets/js/i18n-en.js").read_text(encoding="utf-8") + "\n;Object.assign(window.RQ_EN.dict, " + json.dumps(add, ensure_ascii=False) + ");"
        route.fulfill(status=200, content_type="application/javascript; charset=utf-8", body=body)
    ctx.route(re.compile(r"i18n-en\.js"), en)
    pg = new_page(ctx)
    pg.goto(BASE); pg.wait_for_timeout(400); pg.evaluate("localStorage.setItem('rumiq-lang', JSON.stringify('en'))"); pg.evaluate(SAMPLE, "vardagsrum")
    pg.evaluate("['lysa-keramiklampa', 'sand-keramikvas', 'lin-kuddfodral'].forEach((h) => RQ.room.add(h, true))")
    pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(1300); quiet(pg)
    sv = lambda t: [x for x in re.split(r"\n+", t) if re.search(r"[åäöÅÄÖ]", x)]
    left = sv(pg.evaluate("document.querySelector('.rm-stagewrap').innerText + '\\n' + document.querySelector('.rm-side').innerText"))
    ok(not left, f"[en] the editor is in English: {left[:4]}")
    pg.click("#rmAdd"); pg.wait_for_timeout(600)
    left = [x for x in sv(pg.evaluate("document.querySelector('.sheet.rmpick').innerText + '\\n' + document.getElementById('pickQ').placeholder")) if "Glöd" not in x]
    ok(not left, f"[en] the picker is in English: {left[:4]}")
    pg.keyboard.press("Escape"); pg.evaluate("document.getElementById('rmCart').click()"); pg.wait_for_timeout(500)
    left = sv(pg.evaluate("document.querySelector('.sheet.open').innerText"))
    ok(not left, f"[en] the colour question is in English: {left[:4]}")
    pg.keyboard.press("Escape"); pg.evaluate("RQ.room.openSetup()"); pg.wait_for_timeout(400)
    left = sv(pg.evaluate("document.querySelector('.sheet.open').innerText"))
    ok(not left, f"[en] the setup sheet is in English: {left[:4]}")
    pg.keyboard.press("Escape"); pg.goto(BASE + "#studio-plus"); pg.wait_for_timeout(2300)
    left = sv(pg.evaluate("document.querySelector('#view').innerText"))
    ok(not left, f"[en] Studio Plus is in English: {left[:4]}")
    ctx.close()
    b.close()

srv.shutdown()
print(f"{n - len(fails)} of {n} checks passed")
sys.exit(1 if fails else 0)
