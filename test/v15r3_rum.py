#!/usr/bin/env python3
"""v15 round 3 checks for Mitt rum, the room engine and the look pictures. Run after `python3 tools/build.py`:
   python3 test/v15r3_rum.py
Phone (390 and 360, real touch events) and desktop (1440 and 1280), plus tablets where it matters."""
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

    # ---------------------------------------------------------------- D1: Prova med ett exempelrum on the empty Mitt rum
    for W, Hh, mob in ((390, 844, True), (1440, 900, False)):
        tag = f"[D1 {W}]"
        c = ctx_for(b, W, Hh, mob); pg = new_page(c)
        pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(800)
        pg.evaluate("document.querySelector('[data-room-sample-now]').click()"); pg.wait_for_timeout(1800)
        ok(pg.evaluate("RQ.room.has()") and pg.evaluate("!!document.getElementById('rmStage')"), f"{tag} the sample room is drawn at once on the same page")
        ok(pg.evaluate("scrollY") < 5, f"{tag} the page starts at the top with the room")
        ok(not pg.errs, f"{tag} no script errors: {pg.errs[:2]}")
        c.close()

    # ---------------------------------------------------------------- M3 D7: undo on touch, several steps, the Ångra button
    for W, Hh in ((390, 844), (360, 740)):
        tag = f"[undo {W}]"
        c, pg = room_page(b, W, Hh, True)
        cdp = c.new_cdp_session(pg)
        ok(pg.is_hidden("#rmUndo"), f"{tag} no Ångra before anything has changed")
        x, y = mid(pg, "#rmSuggest"); tap(pg, cdp, x, y); pg.wait_for_timeout(1400)
        ok(pg.evaluate("RQ.room.scene().length") >= 3, f"{tag} Inred åt mig places things")
        ok(not pg.evaluate("!!document.querySelector('.toast.show [data-room-undo]')"), f"{tag} the Inred åt mig toast has no second Ångra (r4: the button on the room is the one Ångra)")
        ok(pg.is_visible("#rmUndo"), f"{tag} the Ångra button is on the room")
        h = pg.evaluate(VISIBLE_ITEM); s0 = pg.evaluate(SPOT, h)
        x, y = mid(pg, f'.rm-item[data-h="{h}"]'); swipe(pg, cdp, x, y, x - 40, y - 20)
        s1 = pg.evaluate(SPOT, h); ok(s1[:2] != s0[:2], f"{tag} a drag moves the thing")
        bx, by = mid(pg, '[data-act="bigger"]'); tap(pg, cdp, bx, by)
        s2 = pg.evaluate(SPOT, h); ok(s2[2] > s1[2], f"{tag} Större makes it bigger")
        x, y = mid(pg, f'.rm-item[data-h="{h}"]'); pinch(pg, cdp, x, y - 20, 30, 60)
        s3 = pg.evaluate(SPOT, h); ok(s3[2] > s2[2], f"{tag} a pinch makes it bigger")
        ux, uy = mid(pg, "#rmUndo")
        tap(pg, cdp, ux, uy); ok(pg.evaluate(SPOT, h) == s2, f"{tag} Ångra takes back the pinch")
        tap(pg, cdp, ux, uy); ok(pg.evaluate(SPOT, h) == s1, f"{tag} Ångra again takes back Större")
        tap(pg, cdp, ux, uy); ok(pg.evaluate(SPOT, h) == s0, f"{tag} and again the move")
        tap(pg, cdp, ux, uy); ok(pg.evaluate("RQ.room.scene().length") == 0, f"{tag} and Inred åt mig as one step")
        ok(pg.is_hidden("#rmUndo"), f"{tag} Ångra goes away when there is nothing to take back")
        x, y = mid(pg, "#rmSuggest"); tap(pg, cdp, x, y); pg.wait_for_timeout(900)
        h = pg.evaluate(VISIBLE_ITEM); x, y = mid(pg, f'.rm-item[data-h="{h}"]'); tap(pg, cdp, x, y)
        ok(pg.evaluate("document.getElementById('rmActOrder').innerText") == "Lägg bakom", f"{tag} 'Bakåt' is now 'Lägg bakom'")
        ok(not pg.errs, f"{tag} no script errors: {pg.errs[:2]}")
        c.close()

    # ---------------------------------------------------------------- D7 D4 on a computer: Ctrl+Z on the slider, per-thing size range
    for W, Hh in ((1440, 900), (1280, 720)):
        tag = f"[size {W}]"
        c, pg = room_page(b, W, Hh, False, items=("lysa-keramiklampa",))
        h = "lysa-keramiklampa"; w0 = pg.evaluate(SPOT, h)[2]
        pg.click(f'.rm-item[data-h="{h}"]'); pg.wait_for_timeout(300)
        lo, hi = pg.eval_on_selector("#rmSize", "e => [+e.min, +e.max]")
        ok(abs(lo - w0 / 2) < 0.2 and abs(hi - w0 * 2) < 0.2, f"{tag} the size slider runs from half to twice the start size: {lo}–{hi} for {w0}")
        pg.click("#rmSize"); pg.wait_for_timeout(300)
        w1 = pg.evaluate(SPOT, h)[2]; ok(w1 <= w0 * 2 + 0.1 and w1 != w0, f"{tag} one click on the slider no longer makes a giant: {w0} -> {w1}")
        pg.focus("#rmSize"); pg.keyboard.press("Control+z"); pg.wait_for_timeout(300)
        ok(pg.evaluate(SPOT, h)[2] == w0, f"{tag} Ctrl+Z works while the slider has focus")
        pg.focus(f'.rm-item[data-h="{h}"]')
        for _ in range(25):
            pg.keyboard.press("+"); pg.wait_for_timeout(40)
        ok(pg.evaluate(SPOT, h)[2] <= w0 * 2 + 0.1, f"{tag} plus stops at the largest size")
        ok(pg.get_attribute('[data-act="bigger"]', "aria-disabled") == "true", f"{tag} Större shows it cannot go further")
        ok("Ctrl+Z" in pg.evaluate("document.querySelector('.rm-keys').innerText") and pg.is_visible(".rm-keys"), f"{tag} the keyboard hint names Ctrl+Z")
        ok(not pg.errs, f"{tag} no script errors: {pg.errs[:2]}")
        c.close()

    # ---------------------------------------------------------------- M17: no keyboard hints on touch tablets
    for W, Hh in ((1024, 768), (820, 1180)):
        c, pg = room_page(b, W, Hh, True, items=("lysa-keramiklampa",))
        ok(pg.evaluate("getComputedStyle(document.querySelector('.rm-keys')).display") == "none", f"[M17 {W}] no Mitt rum keyboard hint on a touch tablet")
        pg.goto(BASE + "svep/"); pg.wait_for_timeout(900)
        ok(all(d == "none" for d in pg.evaluate("[...document.querySelectorAll('.sv-tip,.sv-keys')].map((e) => getComputedStyle(e).display)")), f"[M17 {W}] no Svep key hints on a touch tablet")
        c.close()

    # ---------------------------------------------------------------- D11: the room and its toolbar fit the first screen
    for W, Hh in ((1280, 720), (1440, 900), (1920, 1080)):
        c, pg = room_page(b, W, Hh, False, items=("lysa-keramiklampa", "plad-ullblandning-havre"))
        t = pg.evaluate(RECT, ".rm-tools")
        ok(t[3] <= Hh, f"[D11 {W}] the toolbar is on the first screen: bottom {round(t[3])} of {Hh}")
        c.close()
    c = ctx_for(b, 1440, 900, False); pg = new_page(c)
    from PIL import Image
    buf = io.BytesIO(); Image.open(ROOT / "assets/img/rum/vardagsrum-1600.webp").convert("RGB").resize((1600, 1100)).save(buf, "JPEG", quality=85)
    pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(600); pg.evaluate("RQ.room.openSetup()"); pg.wait_for_timeout(300)
    pg.evaluate("RQ.shop.signIn('test@example.com', 'Test', 'email')"); pg.set_input_files(".sheet.open label.btn:not(.cam) input[data-room-file]", files=[{"name": "rum.jpg", "mimeType": "image/jpeg", "buffer": buf.getvalue()}]); pg.wait_for_timeout(2200)
    ok(pg.evaluate(RECT, ".rm-tools")[3] <= 900, "[D11 1440] a 16:11 own photo and its toolbar fit the first screen")
    # M12: in an own photo the first lamp and print start mid-picture and large enough to grab
    pg.evaluate("RQ.room.add('lysa-keramiklampa', true); RQ.room.add('affisch-linje-ekram', true)"); pg.wait_for_timeout(300)
    lamp, art = pg.evaluate(SPOT, "lysa-keramiklampa"), pg.evaluate(SPOT, "affisch-linje-ekram")
    ok(55 <= lamp[1] <= 68 and lamp[2] >= 8, f"[M12] the first lamp stands mid-height and is not a speck: {lamp}")
    ok(30 <= art[1] <= 50 and art[2] >= 10, f"[M12] a print hangs on the wall, mid-picture: {art}")
    c.close()

    # ---------------------------------------------------------------- M7: messages over the room picture, not the title
    for W, Hh, mob in ((390, 844, True), (1024, 768, True)):
        c, pg = room_page(b, W, Hh, mob, room="sovrum")
        pg.evaluate("document.getElementById('rmSuggest').click()"); pg.wait_for_timeout(900)
        t, s, hd = pg.evaluate(RECT, "#toast"), pg.evaluate(RECT, "#rmStage"), pg.evaluate(RECT, ".rm-title h1")
        ok(t[1] >= s[1] and t[1] > hd[3], f"[M7 {W}] the toast comes in over the room picture, below the title: toast {round(t[1])}, room {round(s[1])}, title {round(hd[3])}")
        hold = pg.evaluate(RECT, "#rmHold")
        if hold and hold[2] > hold[0]:
            ok(t[0] >= hold[2], f"[M7 {W}] the toast does not cover Håll för före")
        c.close()

    # ---------------------------------------------------------------- M16: the Kvällsljus chip
    for W, Hh, mob in ((390, 844, True), (1440, 900, False)):
        c, pg = room_page(b, W, Hh, mob, items=("lysa-keramiklampa",), night=True)
        ok(pg.is_hidden("#rmNightChip"), f"[M16 {W}] no chip while Kvällsljus is off")
        pg.evaluate("document.getElementById('rmNight').click()"); pg.wait_for_timeout(300)
        ok(pg.is_visible("#rmNightChip"), f"[M16 {W}] the chip shows on the room while Kvällsljus is on")
        ok(pg.evaluate("getComputedStyle(document.querySelector('.rm-stage.night .rm-bg')).filter").startswith("brightness(0.4"), f"[M16 {W}] Kvällsljus dims the room also in evening mode")
        pg.goto(BASE + "butik/"); pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(900)
        ok(pg.is_visible("#rmNightChip"), f"[M16 {W}] it is still shown on the next visit")
        pg.click("#rmNightChip"); pg.wait_for_timeout(300)
        ok(pg.is_hidden("#rmNightChip") and not pg.evaluate("document.getElementById('rmStage').classList.contains('night')"), f"[M16 {W}] the chip turns Kvällsljus off")
        c.close()

    # ---------------------------------------------------------------- D22 D8: seven sample rooms, focus on Välj en bild
    c = ctx_for(b, 1440, 900, False); pg = new_page(c)
    pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(700)
    pg.evaluate("RQ.room.openSetup()"); pg.wait_for_timeout(400)
    ok(pg.evaluate("document.querySelectorAll('.sheet.open [data-room-sample]').length") == 7, "[D22] all seven sample rooms are in the setup sheet")
    pg.focus(".sheet.open label.btn:not(.cam) input[data-room-file]"); pg.keyboard.press("Shift+Tab"); pg.keyboard.press("Tab"); pg.wait_for_timeout(100)
    ok(pg.evaluate("getComputedStyle(document.activeElement.parentElement).outlineStyle") == "solid", "[D8] Välj en bild shows a focus ring")
    c.close()
    for room in ("badrum", "hemmakontor", "uteliv"):
        c, pg = room_page(b, 1440, 900, False, room=room)
        pg.evaluate("RQ.room.suggest(4).forEach((p) => RQ.room.add(p.handle, true))"); pg.wait_for_timeout(300)
        sc = pg.evaluate("RQ.room.scene()")
        ok(len(sc) >= 2 and all(0 < it["x"] < 100 and 0 < it["y"] <= 100 for it in sc) and not any(it.get("on") for it in sc), f"[D22 {room}] Inred åt mig places things on the room's own spots: {[(it['h'], it['x'], it['y']) for it in sc]}")
        c.close()

    # ---------------------------------------------------------------- D3 M8: the look pictures show the whole look
    for W, Hh, mob in ((1440, 900, False), (390, 844, True), (820, 1180, True)):
        c = ctx_for(b, W, Hh, mob); pg = new_page(c)
        for l in ("mjuk-kvall", "lugn-hall", "frukostbanken", "sov-gott", "vardagsmiddag", "spa-hemma", "fokus"):
            pg.goto(BASE + f"look-{l}/"); pg.wait_for_timeout(900)
            items = pg.evaluate("document.querySelectorAll('.lp-list .lp-item').length")
            dots = pg.evaluate("document.querySelectorAll('.lp-stage .hs').length")
            seen = pg.evaluate("[...document.querySelectorAll('.lp-stage .hs')].filter((h) => !h.hidden).length")
            ok(dots == items, f"[look {W} {l}] every thing in the look has its dot in the picture: {dots} of {items}")
            ok(seen >= items - 1, f"[look {W} {l}] the picture shows the look's things: {seen} of {items} dots in view")
        pg.goto(BASE + "look-mjuk-kvall/"); pg.wait_for_timeout(900)
        ok(pg.evaluate("document.querySelectorAll('.lp-stage .rc-box .rm-item').length") == 3, f"[look {W}] Mjuk kväll: the lamp, the cushions and the candle stand in the room")
        im, st = pg.evaluate(RECT, ".lp-stage .hs-img"), pg.evaluate(RECT, ".lp-stage")
        ok(im[0] <= st[0] + 1 and im[1] <= st[1] + 1 and im[2] >= st[2] - 1 and im[3] >= st[3] - 1, f"[look {W}] the closer picture still fills the frame")
        own = pg.evaluate("[...document.querySelectorAll('.lp-stage .hs')].filter((h) => !/Liknande/.test(h.getAttribute('aria-label'))).length")
        ok(own == 3, f"[look {W}] the placed products are named as themselves, not 'Liknande i butiken'")
        ok(not pg.errs, f"[look {W}] no script errors: {pg.errs[:2]}")
        c.close()

    # ---------------------------------------------------------------- M15 D21: before left, after right, no clipped label
    for W, Hh, mob in ((390, 844, True), (1440, 900, False)):
        c = ctx_for(b, W, Hh, mob); pg = new_page(c)
        pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(500)
        bf, nw = pg.evaluate(RECT, ".bav .ba-before"), pg.evaluate(RECT, ".bav .ba-now")
        ok(bf[0] < nw[0], f"[M15 {W}] Före is on the left, Med RumIQ on the right")
        ok(pg.evaluate("getComputedStyle(document.querySelector('.bav .ba-after')).clipPath").startswith("inset(0px 0px 0px"), f"[M15 {W}] after is the right side of the line")
        pg.evaluate("document.querySelector('.bav').scrollIntoView({ block: 'center' })")
        clipped = 0
        for _ in range(14):
            pg.wait_for_timeout(180)
            clipped += pg.evaluate("""(() => { const f = document.querySelector('.bav'), st = f.querySelector('.rh-stage'), x = parseFloat(getComputedStyle(f).getPropertyValue('--ba')) / 100 * st.clientWidth + st.getBoundingClientRect().left;
              return [...f.querySelectorAll('.ba-tag')].filter((t) => { const r = t.getBoundingClientRect(); return !t.classList.contains('off') && x > r.left - 2 && x < r.right + 2; }).length; })()""")
        ok(clipped == 0, f"[M15 {W}] the line never runs through a label during the demo")
        c.close()

    # ---------------------------------------------------------------- M14: the AI sheet after signing in, the demo result
    for W, Hh, mob in ((390, 844, True), (1440, 900, False)):
        tag = f"[AI {W}]"
        c, pg = room_page(b, W, Hh, mob, room="sovrum", items=("lysa-keramiklampa", "plad-ullblandning-havre"))
        pg.evaluate("RQ.openAI()"); pg.wait_for_timeout(1500)
        pg.evaluate("document.querySelector('.ai-body a.btn[data-after]:not(.ghost)').click()"); pg.wait_for_timeout(1000)
        pg.evaluate("RQ.shop.signIn('test@example.com', 'Test', 'email'); location.hash = '#mitt-rum'"); pg.wait_for_timeout(1800)
        ok(pg.evaluate("document.getElementById('aiSheet').classList.contains('open')"), f"{tag} back in Mitt rum after signing in, the AI sheet opens again")
        pg.evaluate("localStorage.setItem('rumiq-ai-consent', JSON.stringify('x')); RQ.openAI()"); pg.wait_for_timeout(1600)
        pg.evaluate("document.getElementById('aiGo').click()"); pg.wait_for_timeout(2600)
        ok(not pg.evaluate("!!document.querySelector('.ai-ba-hint')") and not pg.evaluate("!!document.querySelector('#aiBa input')"), f"{tag} the demo offers no compare slider between two identical pictures")
        ok(pg.evaluate("getComputedStyle(document.querySelector('.ai-grid')).borderTopStyle") == "none", f"{tag} no card with a border inside the AI sheet")
        ba = pg.evaluate("(() => { const e = document.elementFromPoint(...(() => { const r = document.querySelector('#aiSheet .sheet-x').getBoundingClientRect(); return [r.right - 8, r.top + r.height / 2]; })()); return e && e.closest('.sheet-x') ? 1 : 0; })()")
        ok(ba == 1, f"{tag} nothing covers the close button")
        ok(not pg.errs, f"{tag} no script errors: {pg.errs[:2]}")
        c.close()
    b.close()

print(f"{n - len(fails)} of {n} checks passed")
sys.exit(1 if fails else 0)
