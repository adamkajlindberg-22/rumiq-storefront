#!/usr/bin/env python3
"""v15 round 4, butik checks. Run after `python3 tools/build.py`:  python3 test/v15r4_butik.py
The add toast never covers Leveranskoll, room mode keeps a product's own photo when it does not belong in the room,
three tab stops per card, the room link next to the price on phones, the look buttons say what the cart rises by and
follow the cart, the home page has no double gaps, the look cards line up, the hero buttons share a width, the empty
cart shows look prices, every colour of a product has its own dot. Phone (360, 390, 430), tablet (820, 1024) and
desktop (1280, 1440, 1920); evening where it matters."""
import http.server, importlib.util, json, re, socketserver, sys, threading
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
fails, n = [], 0


def ok(cond, name):
    global n
    n += 1
    if not cond:
        fails.append(name)
        print("  FAIL", name)


spec = importlib.util.spec_from_file_location("build", ROOT / "tools/build.py")
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)
PFX = urlparse(build.SITE).path.rstrip("/")


class H(http.server.SimpleHTTPRequestHandler):
    """The site in its published folder; unknown addresses get 404.html, as on GitHub Pages."""

    def log_message(self, *a):
        pass

    def do_GET(self):
        p = self.path.split("?")[0]
        if not p.startswith(PFX + "/"):
            self.send_error(404)
            return
        rel = p[len(PFX):]
        f = ROOT / rel.lstrip("/")
        if f.is_dir():
            f = f / "index.html"
        if not f.exists():
            body = (ROOT / "404.html").read_bytes()
            self.send_response(404); self.send_header("Content-Type", "text/html; charset=utf-8"); self.send_header("Content-Length", str(len(body))); self.end_headers()
            self.wfile.write(body)
            return
        self.path = rel + ("?" + self.path.split("?")[1] if "?" in self.path else "")
        return super().do_GET()


class Srv(socketserver.ThreadingTCPServer):
    daemon_threads = True

    def handle_error(self, *a):
        pass


srv = Srv(("127.0.0.1", 0), lambda *a, **k: H(*a, directory=str(ROOT), **k))
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{srv.server_address[1]}{PFX}/"
CONSENT = "localStorage.setItem('rumiq-consent', JSON.stringify({stats:false, mkt:false, at:'2026-11-24'}));"

SAMPLE = """async (r) => { const im = new Image(); await new Promise((ok) => { im.onload = ok; im.src = 'assets/img/rum/' + r + '-1600.webp'; });
  await RQ.room.saveImage(im, { sample: true, map: r, type: r, name: r }); }"""
SIZES = [(360, 740, True), (390, 844, True), (430, 932, True), (820, 1180, True), (1024, 768, True), (1280, 720, False), (1440, 900, False), (1920, 1080, False)]


def context(b, W, Hh, mobile, evening=False):
    ctx = b.new_context(viewport={"width": W, "height": Hh}, has_touch=mobile, is_mobile=mobile, device_scale_factor=2 if mobile else 1)
    ctx.route(re.compile(r"^https?://(?!127\.0\.0\.1)"), lambda r: r.abort())
    ctx.add_init_script(CONSENT + ("localStorage.setItem('rumiq-ljus','kvall');" if evening else ""))
    return ctx


def page(ctx):
    pg = ctx.new_page()
    pg.errs = []
    pg.on("pageerror", lambda e: pg.errs.append(str(e)))
    return pg



with sync_playwright() as p:
    b = p.chromium.launch()
    for W, Hh, mobile in SIZES:
        for evening in ((False, True) if W in (390, 1440) else (False,)):
            tag = f"[{W}{' kväll' if evening else ''}]"
            ctx = context(b, W, Hh, mobile, evening); pg = page(ctx)
            # C7: the add toast keeps clear of Leveranskoll
            pg.goto(BASE + "produkt-lysa-keramiklampa/", wait_until="load"); pg.wait_for_timeout(300)
            pg.evaluate("document.querySelector('#add').scrollIntoView({block:'center'})"); pg.wait_for_timeout(200)
            pg.click("#add"); pg.wait_for_timeout(450)
            hit = pg.evaluate("""() => { const t = document.querySelector('#toast').getBoundingClientRect(), l = document.querySelector('.lk').getBoundingClientRect(); return !(t.right < l.left || t.left > l.right || t.bottom < l.top || t.top > l.bottom); }""")
            ok(not hit, f"{tag} the add toast does not cover Leveranskoll")
            # the room link next to the price: on phones in the first screen, elsewhere the big card is there instead
            pg.evaluate("RQ.shop.clearCart(); scrollTo(0, 0)"); pg.goto(BASE + "produkt-sand-keramikvas/", wait_until="load"); pg.wait_for_timeout(300)
            pin = pg.evaluate("(() => { const e = document.querySelector('.pinroom'); const r = e.getBoundingClientRect(); return [getComputedStyle(e).display !== 'none', Math.round(r.bottom), Math.round(r.height), Math.round(document.querySelector('.priceline').getBoundingClientRect().height)]; })()")
            if W <= 640:
                ok(pin[0] and pin[1] < Hh - 60 and pin[2] >= 44 and pin[3] < 40, f"{tag} Se den i ditt rum is next to the price, on the first screen, a 44 px target, the line no taller: {pin}")
            else:
                ok(not pin[0], f"{tag} no second room link next to the price where the big card is on screen")
            # cards: three tab stops each (heart, Lägg till, the name)
            pg.goto(BASE + "butik/", wait_until="load"); pg.wait_for_timeout(300)
            stops = pg.evaluate("[...document.querySelector('#results .card').querySelectorAll('a,button')].filter((e) => e.tabIndex >= 0 && e.offsetParent).map((e) => e.className || e.tagName)")
            ok(len(stops) == 3, f"{tag} a card has three tab stops: {stops}")
            ok(not pg.errs, f"{tag} no script errors: {pg.errs[:1]}")
            ctx.close()
    # room mode: a product that does not belong in the room's type keeps its own photo (shop and product page)
    for W, Hh, mobile in ((390, 844, True), (1440, 900, False)):
        tag = f"[room {W}]"
        ctx = context(b, W, Hh, mobile); pg = page(ctx)
        pg.goto(BASE, wait_until="load"); pg.evaluate(SAMPLE, "vardagsrum")
        pg.goto(BASE + "butik/", wait_until="load"); pg.wait_for_timeout(300)
        cards = pg.evaluate("""[...document.querySelectorAll('#results .card')].map((c) => { const h = c.querySelector('[data-add]').dataset.add.split('::')[0], p = RQ.byHandle(h); return [h, p.rooms.includes('vardagsrum'), c.classList.contains('in-room'), !!c.querySelector('.hov.inroom')]; })""")
        ok(all(c[1] == c[2] == c[3] for c in cards), f"{tag} only products for a living room are shown in it: {[c for c in cards if not c[1] == c[2] == c[3]][:2]}")
        pg.goto(BASE + "produkt-skarbrada-ek-med-handtag/", wait_until="load"); pg.wait_for_timeout(300)
        ok(pg.evaluate("!document.querySelector('.inroomtile')"), f"{tag} the cutting board's gallery has no living-room picture")
        pg.goto(BASE + "produkt-lysa-keramiklampa/", wait_until="load"); pg.wait_for_timeout(300)
        ok(pg.evaluate("!!document.querySelector('.inroomtile')"), f"{tag} the lamp's gallery keeps its room picture")
        if mobile:
            pg.tap(".pinroom"); pg.wait_for_timeout(700)
            ok(pg.evaluate("Math.abs(document.querySelector('#pgGrid').scrollLeft - document.querySelector('.inroomtile').offsetLeft) < 4"), f"{tag} Se den i ditt rum shows the room picture in the gallery")
        ok(not pg.errs, f"{tag} no script errors: {pg.errs[:1]}")
        ctx.close()
    # no room: the link starts the room setup
    ctx = context(b, 390, 844, True); pg = page(ctx)
    pg.goto(BASE + "produkt-lysa-keramiklampa/", wait_until="load"); pg.wait_for_timeout(300); pg.tap(".pinroom"); pg.wait_for_timeout(500)
    ok(pg.evaluate("!!document.querySelector('.sheet.open [data-room-file]')"), "[390] without a room, Se den i ditt rum opens the room setup")
    ctx.close()
    # looks: the button says what the cart rises by, on the look page and on the cards; the cards follow the cart
    for W, Hh, mobile in ((360, 740, True), (1440, 900, False)):
        tag = f"[look {W}]"
        ctx = context(b, W, Hh, mobile); pg = page(ctx)
        pg.goto(BASE + "look-mjuk-kvall/", wait_until="load"); pg.wait_for_timeout(300)
        items = pg.evaluate("RQ.LOOKS.find((l) => l.id === 'mjuk-kvall').items")
        pg.evaluate("(h) => RQ.shop.addToCart(h + '::0', 1)", items[2]); pg.wait_for_timeout(300)
        txt = pg.evaluate("document.querySelector('#lpBuy [data-look-add]').textContent")
        net = pg.evaluate("RQ.lookNet(RQ.LOOKS.find((l) => l.id === 'mjuk-kvall'))")
        before = pg.evaluate("RQ.shop.cartTotalBeforeShipping()")
        rise = int(re.sub(r"\D", "", txt.split("+")[-1])) if "+" in txt else -1
        ok(txt.startswith("Lägg till resten · +") and rise < net, f"{tag} the rest button says what the cart rises by, below the whole look: {txt!r} ({net})")
        pg.click("#lpBuy [data-look-add]"); pg.wait_for_timeout(500)
        ok(pg.evaluate("RQ.shop.cartTotalBeforeShipping()") - before == rise, f"{tag} the cart rose by exactly what the button said ({rise})")
        bw = pg.evaluate("(() => { const r = document.querySelector('#lpBuy .ctrl-row').getBoundingClientRect(); return [...document.querySelectorAll('#lpBuy .ctrl-row > .btn')].map((e) => Math.round(r.right - e.getBoundingClientRect().right)); })()")
        ok(min(bw) <= 1, f"{tag} the look's buttons fill their row (no ragged right edge): {bw}")
        pg.goto(BASE + "looks/", wait_until="load"); pg.wait_for_timeout(400)
        row = pg.evaluate("(() => { const r = document.querySelector('[data-lookrow=mjuk-kvall]'); return [r.innerText, !!r.querySelector('[data-open-cart]')]; })()")
        ok(row[1] and "i varukorgen" in row[0], f"{tag} a look that is in the cart says so on its card and offers the cart: {row}")
        pg.evaluate("RQ.shop.clearCart()"); pg.wait_for_timeout(300)
        ok(pg.evaluate("document.querySelector('[data-lookrow=mjuk-kvall] [data-look-add]').textContent").startswith("Handla looken · "), f"{tag} the card follows the cart when it is emptied")
        if not mobile:
            feet = pg.evaluate("[...document.querySelectorAll('.looks-grid .lc-row')].slice(0, 3).map((e) => Math.round(e.getBoundingClientRect().bottom))")
            ok(max(feet) - min(feet) <= 1, f"{tag} the look cards' price rows line up: {feet}")
        ok(not pg.errs, f"{tag} no script errors: {pg.errs[:1]}")
        ctx.close()
    # home: same-background sections share one gap; hero buttons share a width on phones; empty cart shows look prices
    for W, Hh, mobile in ((390, 844, True), (1440, 900, False)):
        tag = f"[home {W}]"
        ctx = context(b, W, Hh, mobile); pg = page(ctx)
        pg.goto(BASE, wait_until="load"); pg.wait_for_timeout(400)
        pads = pg.evaluate("['.looks-sec', '.why', '.cta-band'].map((s) => getComputedStyle(document.querySelector('#view ' + s)).paddingTop)")
        ok(all(x == "0px" for x in pads), f"{tag} no double padding between sections on the same background: {pads}")
        if mobile:
            ws = pg.evaluate("[...document.querySelectorAll('.band.settle .row .btn')].map((e) => Math.round(e.getBoundingClientRect().width))")
            ok(len(ws) == 2 and ws[0] == ws[1], f"{tag} the hero's two buttons share one width: {ws}")
        pg.evaluate("document.querySelector('[data-open-cart]').click()"); pg.wait_for_timeout(500)
        ec = pg.evaluate("[...document.querySelectorAll('#cart .ec-look')].map((e) => [e.innerText, getComputedStyle(e).textDecorationLine])")
        ok(ec and all(" kr" in t and d == "none" for t, d in ec), f"{tag} the empty cart's looks show their price, not underlined: {ec}")
        ok(not pg.errs, f"{tag} no script errors: {pg.errs[:1]}")
        ctx.close()
    # every colour of a product has its own dot
    ctx = context(b, 1440, 900, False); pg = page(ctx)
    pg.goto(BASE + "produkt-vila-paslakanset-linne/", wait_until="load"); pg.wait_for_timeout(300)
    dots = pg.evaluate("[...document.querySelectorAll('.swatch-row .dotc')].map((e) => getComputedStyle(e).backgroundColor)")
    ok(len(dots) == 3 and len(set(dots)) == 3 and "rgb(204, 204, 204)" not in dots, f"[colour] every colour has its own dot: {dots}")
    ctx.close()
    b.close()

print(f"{n - len(fails)} of {n} checks passed")
sys.exit(1 if fails else 0)
