#!/usr/bin/env python3
"""v15 round 5, butik checks. Run after `python3 tools/build.py`:  python3 test/v15r5_butik.py
A way to the cart on the product page and in Mitt rum on phones (header cart, Varukorg in the menu), the buy bar follows the
cart, /varukorg opens the cart, add-all never doubles and keeps the chosen colour, AI Köp allt follows the cart, the lamp
switch leaves with its picture, the checkout count follows every fix, Spåra shows the order straight away with errors at the
fields, % färgmatch only from 60 %, no idle dots in the phone demo, För dig grouped as in the dock, look rows mark the cart,
the look toast keeps clear of the buy block, the Testläge note is as wide as the steps, Passar ihop counts only what is new,
footer English ends at the column edge, Lin kuddfodral has a real description. Phone, tablet and desktop; evening where it matters."""
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




LINES = "RQ.shop.cartLines().map((l) => l.id + 'x' + l.quantity).sort().join(' ')"
TOAST = "document.querySelector('#toast').innerText"

with sync_playwright() as p:
    b = p.chromium.launch()
    # P1: the cart is reachable on the product page and in Mitt rum on every phone and tablet size; the buy bar follows the cart
    for W, Hh, mobile in SIZES:
        for evening in ((False, True) if W in (390, 1440) else (False,)):
            tag = f"[{W}{' kväll' if evening else ''}]"
            ctx = context(b, W, Hh, mobile, evening); pg = page(ctx)
            pg.goto(BASE + "produkt-lysa-keramiklampa/", wait_until="load"); pg.wait_for_timeout(400)
            cart = pg.evaluate("(() => { const c = document.querySelector('.tools [data-open-cart]'), r = c.getBoundingClientRect(); return [getComputedStyle(c).display !== 'none' && r.width >= 40, Math.round(r.right), document.documentElement.scrollWidth]; })()")
            ok(cart[0] and cart[1] <= W and cart[2] <= W, f"{tag} the header cart is there on the product page, inside the screen: {cart}")
            ok(pg.evaluate("document.querySelector('#add2').textContent") == "Lägg i varukorgen", f"{tag} the buy bar starts with Lägg i varukorgen")
            pg.evaluate("document.querySelector('#add2').click()"); pg.wait_for_timeout(2200)
            bar = pg.evaluate("[document.querySelector('#add2').textContent, document.querySelector('#add2').hasAttribute('data-open-cart'), document.querySelector('.tools [data-open-cart] .badge').textContent]")
            ok(bar == ["I varukorgen · Visa", True, "1"], f"{tag} once the lamp is in the cart the bar says I varukorgen · Visa and the header counts it: {bar}")
            pg.evaluate("document.querySelector('#add2').click()"); pg.wait_for_timeout(500)
            ok(pg.evaluate("[RQ.shop.cartCount(), document.querySelector('#cart').classList.contains('open')]") == [1, True], f"{tag} a second tap on the bar opens the cart, no second lamp")
            pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
            if mobile and W < 900:
                pg.click("#burger"); pg.wait_for_timeout(500)
                m = pg.evaluate("(() => { const a = document.querySelector('#mnav a[data-open-cart]'); return [a.textContent.trim(), [...document.querySelectorAll('#mnav h4')].map((h) => h.textContent)]; })()")
                ok(m[0].startswith("Varukorg") and m[0].endswith("1"), f"{tag} the phone menu has Varukorg with its count: {m[0]}")
                pg.evaluate("document.querySelector('#mnav a[data-open-cart]').scrollIntoView({block:'center'})"); pg.click("#mnav a[data-open-cart]"); pg.wait_for_timeout(600)
                st = pg.evaluate("[document.querySelector('#cart').classList.contains('open'), document.querySelector('#mnav').classList.contains('open'), location.pathname.endsWith('/produkt-lysa-keramiklampa/')]")
                ok(st == [True, False, True], f"{tag} Varukorg in the menu closes the menu and opens the cart where you are: {st}")
                pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
            if W in (390, 1440) and not evening:
                # the lamp switch leaves with the first picture (phones: the gallery is a carousel)
                pg.evaluate(SAMPLE, "vardagsrum"); pg.goto(BASE + "produkt-lysa-keramiklampa/", wait_until="load"); pg.wait_for_timeout(1300)
                if mobile:
                    pg.evaluate("document.querySelector('.inroomtile').scrollIntoView({inline:'start', block:'nearest'})"); pg.wait_for_timeout(700)
                    ok(pg.evaluate("getComputedStyle(document.querySelector('#lightSw')).visibility") == "hidden", f"{tag} on the I ditt rum slide the lamp switch is away")
                    pg.evaluate("document.querySelector('#pgGrid').scrollTo({left: 0})"); pg.wait_for_timeout(700)
                ok(pg.evaluate("getComputedStyle(document.querySelector('#lightSw')).visibility") == "visible", f"{tag} on the first picture the lamp switch is there")
                # Mitt rum with a room: the header cart is there too
                pg.goto(BASE + "mitt-rum/", wait_until="load"); pg.wait_for_timeout(1000)
                ok(pg.evaluate("getComputedStyle(document.querySelector('.tools [data-open-cart]')).display !== 'none'"), f"{tag} the header cart is there in Mitt rum")
            ok(not pg.errs, f"{tag} no script errors: {pg.errs[:1]}")
            ctx.close()

    # D15: /varukorg opens the cart; Lin kuddfodral has more than one short line, in English too
    ctx = context(b, 390, 844, True); pg = page(ctx)
    pg.goto(BASE, wait_until="load"); pg.evaluate("RQ.shop.addToCart('glob-bordslampa-opalglas::0', 1)")
    pg.goto(BASE + "varukorg/", wait_until="load"); pg.wait_for_timeout(900)
    ok(pg.evaluate("document.querySelector('#cart').classList.contains('open') && !!document.querySelector('#cart [data-rm]')"), "[390] /varukorg opens the cart")
    ok(len(pg.evaluate("RQ.byHandle('lin-kuddfodral').short")) > 40, "Lin kuddfodral has a real short description")
    pg.evaluate("localStorage.setItem('rumiq-lang', JSON.stringify('en'))"); pg.goto(BASE + "produkt-lin-kuddfodral/", wait_until="load"); pg.wait_for_timeout(900)
    ok("softer with every wash" in pg.evaluate("document.querySelector('.short').innerText"), "[en] the Lin kuddfodral description is English and whole")
    ctx.close()

    # D1: add-all paths never double, keep the chosen colour, ask when none is chosen, and say what happened
    for W, Hh, mobile in ((390, 844, True), (1440, 900, False)):
        tag = f"[add-all {W}]"
        ctx = context(b, W, Hh, mobile); pg = page(ctx)
        pg.goto(BASE, wait_until="load")
        pg.evaluate("RQ.shop.signIn('test@example.com', 'Test', 'email'); localStorage.setItem('rumiq-ai-consent', JSON.stringify('x'))")
        pg.evaluate(SAMPLE, "vardagsrum")
        for h in ["lysa-keramiklampa", "plad-ullblandning-havre", "lin-kuddfodral", "sand-keramikvas"]:
            pg.evaluate("(h) => RQ.room.add(h, true)", h)
        pg.goto(BASE + "mitt-rum/", wait_until="load"); pg.wait_for_timeout(1300)
        pg.evaluate("RQ.room.cartAll(null)"); pg.wait_for_timeout(500)
        pg.evaluate("document.querySelector('.var-row[data-h=lin-kuddfodral] [data-v=\"1\"]').click(); document.querySelector('#varGo').click()"); pg.wait_for_timeout(400)
        before = pg.evaluate(LINES)
        ok("lin-kuddfodral::1x1" in before, f"{tag} the room's buy-all takes Salvia when Salvia is chosen: {before}")
        pg.evaluate("RQ.openAI()"); pg.wait_for_timeout(2400); pg.evaluate("document.getElementById('aiGo').click()"); pg.wait_for_timeout(2600)
        ok(pg.evaluate("[document.getElementById('aiBuy').textContent, document.getElementById('aiBuy').hasAttribute('data-open-cart')]") == ["Visa varukorgen", True], f"{tag} with the whole scene in the cart, AI's button shows the cart")
        pg.evaluate("document.getElementById('aiBuy').click()"); pg.wait_for_timeout(600)
        ok(pg.evaluate(LINES) == before and pg.evaluate("document.querySelector('#cart').classList.contains('open') && !document.querySelector('#aiSheet.open')"), f"{tag} it adds nothing and the cart opens in front: {pg.evaluate(LINES)}")
        pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
        pg.evaluate("RQ.shop.setQty('sand-keramikvas::0', 0)")
        pg.evaluate("RQ.openAI()"); pg.wait_for_timeout(2400); pg.evaluate("document.getElementById('aiGo').click()"); pg.wait_for_timeout(2600)
        ok(pg.evaluate("document.getElementById('aiBuy').textContent") == "Lägg till resten", f"{tag} with part of it in the cart, AI's button says Lägg till resten")
        pg.evaluate("document.getElementById('aiBuy').click()"); pg.wait_for_timeout(500)
        after = pg.evaluate(LINES)
        ok(after == before and "1 ny i varukorgen" in pg.evaluate(TOAST) and "3 låg redan där" in pg.evaluate(TOAST), f"{tag} AI Köp allt adds only the missing vase, Salvia stays, the toast says so: {after} / {pg.evaluate(TOAST)}")
        pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
        # Sparat: the towel has two colours and none was chosen: asked; a second tap adds nothing
        pg.evaluate("RQ.shop.clearCart(); RQ.shop.addToCart('lysa-keramiklampa::0', 1); ['lysa-keramiklampa', 'vaffelhandduk-bomull', 'glob-bordslampa-opalglas'].forEach((h) => RQ.shop.isWished(h) || RQ.shop.toggleWish(h))")
        pg.goto(BASE + "onskelista/", wait_until="load"); pg.wait_for_timeout(700)
        pg.click("#allCart"); pg.wait_for_timeout(500)
        ok(pg.evaluate("[...document.querySelectorAll('.sheet.open .var-row')].map((r) => r.dataset.h)") == ["vaffelhandduk-bomull"], f"{tag} Lägg alla asks the colour of the one thing with colours")
        pg.evaluate("document.querySelector('.sheet.open .var-row [data-v=\"1\"]').click()"); pg.click("#varGo"); pg.wait_for_timeout(500)
        ok(pg.evaluate(LINES) == "glob-bordslampa-opalglas::0x1 lysa-keramiklampa::0x1 vaffelhandduk-bomull::1x1" and "2 nya i varukorgen" in pg.evaluate(TOAST), f"{tag} the list adds the two new ones in the chosen colour: {pg.evaluate(LINES)}")
        pg.wait_for_timeout(1800); pg.click("#allCart"); pg.wait_for_timeout(500)
        # r6 (C5): with all of it in the cart the button reads "I varukorgen · Visa" and opens the cart
        ok(pg.evaluate("document.getElementById('allCart').textContent") == "I varukorgen · Visa" and pg.evaluate("document.getElementById('cart').classList.contains('open')") and pg.evaluate("RQ.shop.cartCount()") == 3, f"{tag} again: nothing doubled, the button shows the cart")
        pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
        # Passar ihop: this product in the colour chosen above, only what is new is counted
        pg.evaluate("RQ.shop.clearCart()"); pg.goto(BASE + "produkt-lin-kuddfodral/", wait_until="load"); pg.wait_for_timeout(600)
        pg.evaluate("document.querySelector('.pinfo [data-v=\"lin-kuddfodral::1\"]').click(); document.querySelector('#add').click()"); pg.wait_for_timeout(400)
        k = len(pg.evaluate("[...document.querySelectorAll('[data-look]:checked')]"))
        ok(pg.evaluate("document.querySelector('#lookAdd').textContent") == f"Lägg {k - 1} produkter i varukorgen", f"{tag} Passar ihop counts only what is not in the cart yet")
        pg.evaluate("document.querySelector('#lookAdd').click()"); pg.wait_for_timeout(500)
        if pg.evaluate("!!document.querySelector('.sheet.open #varGo')"): pg.click("#varGo"); pg.wait_for_timeout(400)
        lines = pg.evaluate(LINES)
        ok("lin-kuddfodral::1x1" in lines and "lin-kuddfodral::0" not in lines and pg.evaluate("RQ.shop.cartCount()") == k, f"{tag} Passar ihop keeps Salvia and adds no second cover: {lines}")
        pg.wait_for_timeout(1900)
        ok(pg.evaluate("document.querySelector('#lookAdd').textContent") == "Visa varukorgen", f"{tag} then Passar ihop shows the cart")
        ok(pg.evaluate("getComputedStyle(document.querySelector('.look-sum .sum.total')).borderTopWidth") == "0px", f"{tag} no rule above the total in Passar ihop")
        ok(not pg.errs, f"{tag} no script errors: {pg.errs[:1]}")
        ctx.close()

    # D10/D11: look rows mark what is in the cart; the toast keeps clear of the buy block
    for W, Hh, mobile, evening in ((360, 740, True, False), (1440, 900, False, True), (1920, 1080, False, False)):
        tag = f"[look {W}]"
        ctx = context(b, W, Hh, mobile, evening); pg = page(ctx)
        pg.goto(BASE + "look-mjuk-kvall/", wait_until="load"); pg.wait_for_timeout(600)
        items = pg.evaluate("RQ.LOOKS.find((l) => l.id === 'mjuk-kvall').items")
        pg.evaluate("(h) => RQ.shop.addToCart(h + '::0', 1)", items[0]); pg.wait_for_timeout(300)
        acts = pg.evaluate("[...document.querySelectorAll('.lp-item')].map((li) => li.lastElementChild.classList.contains('lp-have'))")
        ok(acts == [True] + [False] * (len(items) - 1), f"{tag} the row of the thing in the cart says I varukorgen, the others keep +: {acts}")
        pg.evaluate("document.querySelector('#lpBuy').scrollIntoView({block:'center'})"); pg.wait_for_timeout(300)
        pg.click("#lpBuy [data-look-add]"); pg.wait_for_timeout(500)
        hit = pg.evaluate("""() => { const t = document.querySelector('#toast').getBoundingClientRect(), l = document.querySelector('#lpBuy').getBoundingClientRect(); return t.right < l.left || t.left > l.right || t.bottom < l.top || t.top > l.bottom; }""")
        ok(hit, f"{tag} the look's toast does not cover the buy block")
        ok(pg.evaluate("[...document.querySelectorAll('.lp-item')].every((li) => li.lastElementChild.classList.contains('lp-have'))"), f"{tag} after Lägg till resten every row says I varukorgen")
        ok(not pg.errs, f"{tag} no script errors: {pg.errs[:1]}")
        ctx.close()

    # P8, P10, D14: checkout count, Spåra, Testläge note, footer
    for W, Hh, mobile in ((360, 740, True), (1024, 768, True), (1440, 900, False)):
        tag = f"[kassa {W}]"
        ctx = context(b, W, Hh, mobile); pg = page(ctx)
        pg.goto(BASE, wait_until="load"); pg.evaluate("RQ.shop.addToCart('lysa-keramiklampa::0', 1)")
        pg.goto(BASE + "kassa/", wait_until="load"); pg.wait_for_timeout(700)
        w = pg.evaluate("[document.querySelector('.co-note').getBoundingClientRect().width, document.querySelector('#co .panel').getBoundingClientRect().width]")
        ok(abs(w[0] - w[1]) < 1, f"{tag} the Testläge note is as wide as the steps: {w}")
        pg.evaluate("document.querySelector('#co').requestSubmit()"); pg.wait_for_timeout(400)
        st = lambda: pg.evaluate("document.querySelector('#coStatus').textContent")
        first = st(); pg.fill("[name=email]", "anna@example.se"); pg.fill("[name=first]", "Anna"); pg.wait_for_timeout(200)
        ok(first.startswith("7 saker") and st().startswith("5 saker"), f"{tag} the count follows the fixes: {first} / {st()}")
        v = {"phone": "0701234567", "last": "Berg", "street": "Storgatan 1", "zip": "11122", "city": "Stockholm"}
        for k, x in v.items(): pg.fill(f"[name={k}]", x)
        pg.evaluate("document.querySelector('[name=terms]').click()"); pg.wait_for_timeout(200)
        ok(st() == "", f"{tag} all fixed: the count is gone")
        pg.evaluate("document.querySelector('#co').requestSubmit()"); pg.wait_for_timeout(1000)
        pg.click(".btn.ghost[data-track]"); pg.wait_for_timeout(900)
        ok(pg.evaluate("!!document.querySelector('#trOut .tr-res .order') && !document.querySelector('#trOut .panel')"), f"{tag} from the order, Spåra shows its status straight away, without a card around the card")
        pg.evaluate("document.querySelector('[name=num]').value = ''; document.querySelector('[name=email]').value = ''"); pg.click("#trForm button[type=submit]"); pg.wait_for_timeout(400)
        e = pg.evaluate("[...document.querySelectorAll('#trForm .ferr')].filter((x) => !x.hidden).map((x) => [x.closest('label').contains(x), getComputedStyle(x).color])")
        ok(len(e) == 2 and all(x[0] for x in e) and pg.evaluate("document.activeElement.name") == "num", f"{tag} Spåra's errors sit at their fields and the first gets the focus: {e}")
        ok(len({x[1] for x in e}) == 1 and e[0][1] == pg.evaluate("getComputedStyle(document.querySelector('#trForm .ferr')).color"), f"{tag} both errors in the same red")
        r = pg.evaluate("(() => { const l = document.querySelector('footer.site .bottom .lang').getBoundingClientRect(), s = document.querySelector('footer.site .bottom > span:last-child').getBoundingClientRect(); return [Math.round(l.right), Math.round(s.right)]; })()")
        ok(r[0] == r[1], f"{tag} footer English ends at its row's edge: {r}")
        ok(not pg.errs, f"{tag} no script errors: {pg.errs[:1]}")
        ctx.close()

    # P12: % färgmatch only from 60 %; no idle dots in the phone demo; För dig in Upptäck as in the dock
    for W, Hh, mobile in ((390, 844, True), (1440, 900, False)):
        tag = f"[p12 {W}]"
        ctx = context(b, W, Hh, mobile); pg = page(ctx)
        pg.goto(BASE, wait_until="load"); pg.wait_for_timeout(500)
        dots = pg.evaluate("[...document.querySelectorAll('.bav .rh-tag')].filter((t) => t.getBoundingClientRect().width > 0).length")
        ok((dots == 0) if W < 620 else (dots > 0), f"{tag} demo dots: none on a phone, named on a large screen ({dots})")
        groups = pg.evaluate("(() => { const out = {}; let h = ''; [...document.querySelectorAll('#mnav > *')].forEach((e) => { if (e.tagName === 'H4') h = e.textContent; else e.querySelectorAll ? [...(e.matches('a') ? [e] : e.querySelectorAll('a'))].forEach((a) => (out[a.getAttribute('href')] = h)) : 0; }); return [out['for-dig/'], out['rum/']]; })()")
        ok(groups == ["Upptäck", "Butik"], f"{tag} the menu groups För dig and Handla efter rum as the dock does: {groups}")
        pg.evaluate(SAMPLE, "vardagsrum"); pg.evaluate("RQ.room.setMode(true)")
        pg.goto(BASE + "butik/", wait_until="load"); pg.wait_for_timeout(700)
        fm = pg.evaluate("[...document.querySelectorAll('#results .card .fm')].map((e) => parseInt(e.textContent))")
        ok(fm and min(fm) >= 60, f"{tag} % färgmatch only where it is 60 % or more: {fm}")
        ok(not pg.errs, f"{tag} no script errors: {pg.errs[:1]}")
        ctx.close()
    b.close()

print(f"{n - len(fails)} of {n} checks passed")
sys.exit(1 if fails else 0)
