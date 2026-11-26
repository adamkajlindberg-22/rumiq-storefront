#!/usr/bin/env python3
"""v15 round 3, butik checks. Run after `python3 tools/build.py`:  python3 test/v15r3_butik.py
What the independent review found in the shop, the product page, search, cart and header: the phone
gallery's first slide, Passar ihop pictures, hover zoom, the room toggle, search order and Enter, filter
counts, quick add of a multi-colour product, toasts over sheets, the look discount in the cart, the
Mitt rum header link's name, the scroll position back in the shop, the card buttons and tab order.
Phone (360, 390, 430), tablet (820, 1024) and desktop (1280, 1440, 1920); evening where it matters."""
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


# the slide a visitor sees first: the top-left one that is inside the gallery's own box
FIRST_SLIDE = """() => { const g = document.querySelector('#view .pg-grid'), gr = g.getBoundingClientRect(), items = [...g.children];
  let best = null, bt = 1e9, bl = 1e9; for (const e of items) { const r = e.getBoundingClientRect(); if (r.left < gr.left - 2 || r.left > gr.right) continue;
    if (r.top < bt - 2 || (Math.abs(r.top - bt) < 2 && r.left < bl)) { best = e; bt = r.top; bl = r.left; } } return [items.length, items.indexOf(best)]; }"""

with sync_playwright() as p:
    b = p.chromium.launch()
    for W, Hh, mobile in SIZES:
        for evening in (False, True):
            tag = f"[{W}{' kväll' if evening else ''}]"
            ctx = context(b, W, Hh, mobile, evening)
            pg = page(ctx)
            # M1: the gallery opens on its first picture, with an even or odd number of slides, with and without a room
            for prod in ("plad-ullblandning-havre", "lysa-keramiklampa"):
                pg.goto(BASE + "produkt-" + prod + "/", wait_until="load"); pg.wait_for_timeout(200)
                got = pg.evaluate(FIRST_SLIDE)
                ok(got[1] == 0, f"{tag} {prod} opens on its first picture: {got}")
            # D2: Passar ihop shows whole 4:5 pictures, not slivers
            pg.evaluate("document.querySelector('#view .look').scrollIntoView({block:'center'})"); pg.wait_for_timeout(150)
            rat = pg.evaluate("[...document.querySelectorAll('#view .look-item img')].map((i) => { const r = i.getBoundingClientRect(); return +(r.height / r.width).toFixed(2); })")
            ok(rat and all(1.2 <= x <= 1.3 for x in rat), f"{tag} Passar ihop pictures are 4:5: {rat}")
            pg.evaluate(SAMPLE, "vardagsrum")
            pg.goto(BASE + "produkt-lysa-keramiklampa/", wait_until="load"); pg.wait_for_timeout(200)
            got = pg.evaluate(FIRST_SLIDE)
            ok(got[0] == 3 and got[1] == 0, f"{tag} with a room the lamp still has its own three pictures (no room picture: founder's decision) and opens on the first: {got}")
            # founder's decision (studio round): the shop has no room switch any more; the cards show the product, the sort menu keeps its words
            pg.goto(BASE + "butik/", wait_until="load"); pg.wait_for_timeout(250)
            t = pg.evaluate("""() => { const tb = document.querySelector('#view .toolbar').getBoundingClientRect(), s = document.getElementById('sort');
              return [!document.querySelector('#view .roomtoggle, [data-room-mode]'), Math.round(tb.height), s.scrollWidth <= s.clientWidth + 1 || s.clientWidth > 90, Math.round(s.getBoundingClientRect().width), !document.querySelector('#results .card.in-room')]; }""")
            ok(t[0] and t[1] < 60 and t[4], f"{tag} no room switch in the shop, and the cards show the product: {t}")
            ok(t[2] and t[3] <= 260, f"{tag} the sort menu shows its words and keeps a sensible width: {t[3]} px")
            # M18 + D22: a phone card's photo has heart and Lägg till only; elsewhere the four buttons tab in reading order
            btns = pg.evaluate("[...document.querySelector('#results .card').querySelectorAll('button')].filter((b) => b.offsetParent).map((b) => b.className.replace('iconbtn ', ''))")
            if W <= 640:
                ok(btns == ["fav", "qadd"], f"{tag} a phone card carries heart and Lägg till only: {btns}")
            else:
                ok(btns == ["fav", "qv", "qadd"], f"{tag} card buttons in reading order (heart, Snabbtitt, Lägg till; no room button, review N3): {btns}")
            ok(not pg.errs, f"{tag} no script errors: {pg.errs[:1]}")
            ctx.close()
    # M10, D13, D14: search with a room: best colour match first, names for the room's colours, a green underline on focus,
    # Enter opens the marked first hit with a mouse and keyboard (on a phone it puts the keyboard away), typographic quotes
    for W, Hh, mobile in SIZES:
        for evening in (False, True):
            tag = f"[search {W}{' kväll' if evening else ''}]"
            ctx = context(b, W, Hh, mobile, evening); pg = page(ctx)
            pg.goto(BASE, wait_until="load"); pg.evaluate(SAMPLE, "vardagsrum")
            pg.evaluate("RQ.openSearch()"); pg.wait_for_timeout(500)
            st = pg.evaluate("() => { const f = getComputedStyle(document.querySelector('#search .sfield')), i = getComputedStyle(document.getElementById('searchInput')); return [document.activeElement.id, f.borderBottomWidth, f.borderBottomColor === getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || f.borderBottomColor, i.outlineStyle]; }")
            ok(st[0] == "searchInput" and st[1] == "3px" and st[3] == "none", f"{tag} the focused field is a thicker underline, no box: {st}")
            names = pg.evaluate("[...document.querySelectorAll('#searchRes [data-room-tone]')].map((e) => e.dataset.toneName)")
            ok(len(names) == 5 and len(set(names)) == 5 and not any("Rumsfärg" in x for x in names), f"{tag} the room's colours have names: {names}")
            pg.keyboard.type("lampa"); pg.wait_for_timeout(500)
            # (founder's decision, studio round: search keeps its own order, not the room's colour match)
            m = pg.evaluate("[document.querySelectorAll('#searchRes .card .fm').length, (document.querySelector('#searchRes .card a[href*=produkt-]') || {}).getAttribute ? document.querySelector('#searchRes .card a[href*=produkt-]').getAttribute('href').split('produkt-')[1] : '']")
            ok(m[0] == 0 and m[1], f"{tag} lamps in the search's own order, without a colour match: {m}")
            fine = W >= 1280
            ok(pg.evaluate("document.querySelectorAll('#searchRes .s-pick').length") == (1 if fine else 0), f"{tag} the hit Enter opens is marked (mouse and keyboard only)")
            pg.keyboard.press("Enter"); pg.wait_for_timeout(600)
            got = pg.evaluate("[location.pathname, document.getElementById('search').classList.contains('open')]")
            if fine:
                ok(got[0].endswith("/produkt-" + m[1].strip("/") + "/") and not got[1], f"{tag} Enter opens the first hit: {got}")
                pg.evaluate("RQ.openSearch()"); pg.wait_for_timeout(400)
            else:
                ok(got[1] and pg.evaluate("document.activeElement.id") != "searchInput", f"{tag} on a touch screen Enter puts the keyboard away and keeps the hits: {got}")
            pg.fill("#searchInput", "xqzv"); pg.wait_for_timeout(450)
            ok(pg.evaluate("document.querySelector('#searchRes .empty h3').textContent") == "Inga träffar på ”xqzv”", f"{tag} typographic quotes in the empty state")
            ok(not pg.errs, f"{tag} no script errors: {pg.errs[:1]}")
            ctx.close()

    # D17: the filter counts follow the other groups' choices, also after Back from a product
    for W, Hh, mobile in ((390, 844, True), (1440, 900, False)):
        tag = f"[filter {W}]"
        ctx = context(b, W, Hh, mobile); pg = page(ctx)
        pg.goto(BASE + "butik/", wait_until="load"); pg.wait_for_timeout(300)
        C = "Object.fromEntries([...document.querySelectorAll('#fForm .f-opt')].map((o) => [o.querySelector('input').value, [+o.querySelector('.count').textContent, o.classList.contains('f-zero')]]))"
        before = pg.evaluate(C)
        if mobile:
            pg.tap("#toggleFilters"); pg.wait_for_timeout(500)
        pg.click("#fForm input[name=cat][value=belysning-atmosfar]", force=True); pg.wait_for_timeout(300)
        shown = pg.evaluate("document.querySelectorAll('#results .card').length")
        after = pg.evaluate(C)
        want = pg.evaluate("RQ.PRODUCTS.filter((p) => p.cat === 'belysning-atmosfar' && p.rooms.includes('vardagsrum')).length")
        ok(before["vardagsrum"][0] > after["vardagsrum"][0] == want and after["vardagsrum"][0] <= shown, f"{tag} Vardagsrum counts only lighting once Belysning is chosen: {before['vardagsrum'][0]} -> {after['vardagsrum'][0]} (want {want}, {shown} shown)")
        ok(after["hem-inredning"][0] == before["hem-inredning"][0], f"{tag} choices in the same group keep their own counts (they add up)")
        ok(all(z == (n == 0) for v, (n, z) in after.items() if v != "belysning-atmosfar"), f"{tag} a choice that would show nothing is marked quiet")
        pg.goto(BASE + "produkt-lysa-keramiklampa/", wait_until="load"); pg.wait_for_timeout(300); pg.go_back(); pg.wait_for_timeout(700)
        ok(pg.evaluate(C)["vardagsrum"][0] == want, f"{tag} the counts still follow the filter after Back")
        ctx.close()

    # D18: + on a card of a product with several colours asks for the colour; nothing is put in the cart before that
    for W, Hh, mobile in ((390, 844, True), (1440, 900, False)):
        tag = f"[colour {W}]"
        ctx = context(b, W, Hh, mobile); pg = page(ctx)
        pg.goto(BASE + "butik/", wait_until="load"); pg.wait_for_timeout(300)
        sel = "#results [data-add='lin-kuddfodral::0']"
        pg.evaluate(f"document.querySelector(\"{sel}\").scrollIntoView({{block:'center'}})"); pg.wait_for_timeout(200)
        if mobile:
            pg.tap(sel)
        else:
            pg.hover("#results .card:has([data-add='lin-kuddfodral::0'])"); pg.wait_for_timeout(300); pg.click(sel)
        pg.wait_for_timeout(500)
        got = pg.evaluate("[document.getElementById('sheet').classList.contains('open'), [...document.querySelectorAll('#sheet [data-shv]')].map((x) => x.getAttribute('aria-checked')), localStorage.getItem('rumiq-cart'), (document.getElementById('shAsk') || {}).textContent]")
        ok(got[0] and got[1] == ["false", "false"] and got[2] in (None, "[]") and got[3] == "Vilken färg vill du ha?", f"{tag} + asks which colour, nothing chosen for you: {got}")
        pg.click("#shAdd"); pg.wait_for_timeout(200)
        ok(pg.evaluate("[document.getElementById('shAsk').textContent, document.activeElement.dataset.shv, localStorage.getItem('rumiq-cart')]") in (["Välj en färg först.", "0", None], ["Välj en färg först.", "0", "[]"]), f"{tag} Lägg i varukorgen without a colour says so and goes to the colours")
        pg.click("#sheet [data-shv='1']"); pg.click("#shAdd"); pg.wait_for_timeout(400)
        ok(pg.evaluate("JSON.parse(localStorage.getItem('rumiq-cart'))") == [{"v": "lin-kuddfodral::1", "q": 1}], f"{tag} the chosen colour is what lands in the cart")
        ok(not pg.errs, f"{tag} no script errors: {pg.errs[:1]}")
        ctx.close()

    # M7 + D22: a toast never covers what the customer needs next: the open quick view's buttons, the dock, the product's buy row
    OVER = """(qs) => { const t = document.getElementById('toast'); if (!t.classList.contains('show')) return ['no toast'];
      const r = t.getBoundingClientRect(); return [...document.querySelectorAll(qs)].filter((e) => e.offsetParent || getComputedStyle(e).position === 'fixed').filter((e) => { const q = e.getBoundingClientRect();
        return q.width && q.left < r.right && q.right > r.left && q.top < r.bottom && q.bottom > r.top; }).map((e) => e.id || e.className); }"""
    for W, Hh, mobile in SIZES:
        tag = f"[toast {W}]"
        ctx = context(b, W, Hh, mobile); pg = page(ctx)
        pg.goto(BASE + "butik/", wait_until="load"); pg.wait_for_timeout(300)
        pg.evaluate("RQ.sheet.open('lysa-keramiklampa')"); pg.wait_for_timeout(700)
        pg.click("#shAdd"); pg.wait_for_timeout(500)
        ok(pg.evaluate(OVER, "#sheet .sh-act button, #sheet .sh-room, #sheet .sheet-x, #sheet .sh-price, #sheet h2") == [], f"{tag} after adding in the quick view the toast covers none of its buttons")
        pg.keyboard.press("Escape"); pg.wait_for_timeout(500)
        pg.evaluate("scrollTo(0, 400)"); pg.wait_for_timeout(300)
        pg.locator("#results .card .fav").nth(1).click(); pg.wait_for_timeout(500)
        card = "#results .card:nth-child(2) .ct, #results .card:nth-child(2) .fav"
        ok(pg.evaluate(OVER, card + ", #dock") == [], f"{tag} the Sparad toast covers neither the card you saved nor the dock")
        pg.goto(BASE + "produkt-sand-keramikvas/", wait_until="load"); pg.wait_for_timeout(300)
        pg.click("#add"); pg.wait_for_timeout(500)
        ok(pg.evaluate(OVER, "#add, .buy button, #buyNow, .pinfo h1, .nav a, .nav button") == [], f"{tag} the added toast covers neither the buy row, the way to the checkout nor the header")
        ok(not pg.errs, f"{tag} no script errors: {pg.errs[:1]}")
        ctx.close()

    # M9 + D15: the rest of a look says what it costs, adding it says the whole look is in, look things are named in the cart,
    # removing one says the discount goes (and Ångra brings it back), the page does not jump
    for W, Hh, mobile in ((360, 740, True), (390, 844, True), (1280, 720, False), (1440, 900, False)):
        tag = f"[look {W}]"
        ctx = context(b, W, Hh, mobile); pg = page(ctx)
        pg.goto(BASE + "look-mjuk-kvall/", wait_until="load"); pg.wait_for_timeout(300)
        items = pg.evaluate("RQ.LOOKS.find((l) => l.id === 'mjuk-kvall').items")
        for h in items[:-1]:
            pg.evaluate("(h) => RQ.shop.addToCart(h + '::0', 1)", h)
        pg.wait_for_timeout(300)
        pg.evaluate("document.getElementById('lpBuy').scrollIntoView({block:'center'})"); pg.wait_for_timeout(200)
        # r4: the button says what the cart rises by (the rest, less the discount it completes), so it is never higher than the whole look
        want = pg.evaluate("(h) => RQ.byHandle(h).price - (RQ.shop.cartDiscount([h]) - RQ.shop.cartDiscount())", items[-1])
        txt = pg.evaluate("document.querySelector('#lpBuy [data-look-add]').textContent")
        ok(txt == f"Lägg till resten · +{want} kr", f"{tag} Lägg till resten says what the cart rises by, one space: {txt!r}")
        y0 = pg.evaluate("scrollY"); pg.click("#lpBuy [data-look-add]"); pg.wait_for_timeout(600)
        ok(abs(pg.evaluate("scrollY") - y0) <= 2, f"{tag} the page stays where it is after the click")
        toast = pg.evaluate("document.getElementById('toast').textContent")
        ok(toast.startswith("Mjuk kväll ligger i varukorgen. Du sparar 269 kr."), f"{tag} the toast says the whole look is in and what it saves: {toast!r}")
        pg.evaluate("document.querySelector('[data-open-cart]').click()"); pg.wait_for_timeout(600)
        tags = pg.evaluate("[...document.querySelectorAll('#cart .lk-tag')].map((e) => e.textContent)")
        ok(tags == ["Ingår i looken Mjuk kväll"] * 4, f"{tag} the look's things are named in the cart: {tags}")
        pg.click(f"#cart [data-rm='{items[0]}::0']"); pg.wait_for_timeout(400)
        toast = pg.evaluate("document.getElementById('toast').textContent")
        ok("rabatten på 269 kr försvinner" in toast and "Ångra" in toast, f"{tag} removing a look thing says the discount goes: {toast!r}")
        ok(pg.evaluate("document.querySelectorAll('#cart .lk-tag').length") == 0, f"{tag} no look tags once the look is not whole")
        pg.click("#toast [data-undo-rm]"); pg.wait_for_timeout(400)
        ok(pg.evaluate("RQ.shop.cartDiscount()") == 269, f"{tag} Ångra brings the discount back")
        ok(not pg.errs, f"{tag} no script errors: {pg.errs[:1]}")
        ctx.close()

    # D9: the Mitt rum link in the header has a real name where only its picture and number show
    for W, Hh, mobile in ((1024, 768, True), (1280, 720, False), (1440, 900, False)):
        tag = f"[header {W}]"
        ctx = context(b, W, Hh, mobile); pg = page(ctx)
        pg.goto(BASE, wait_until="load"); pg.evaluate(SAMPLE, "vardagsrum"); pg.evaluate("RQ.room.add('sand-keramikvas', true)"); pg.wait_for_timeout(300)
        pg.goto(BASE + "butik/", wait_until="load"); pg.wait_for_timeout(300)
        got = pg.evaluate("(() => { const p = document.querySelector('.roompill'), n = +p.querySelector('.badge').textContent; return [p.getAttribute('aria-label'), n, p.textContent.replace(/\\s+/g, ' ').trim()]; })()")
        ok(got[0] == f"Mitt rum, {got[1]} {'sak' if got[1] == 1 else 'saker'} i rummet" and "Mitt rum" in got[2], f"{tag} the header's Mitt rum link is named: {got}")
        ctx.close()

    # M19: Back to the shop lands where you were, also when the product was a full page load, and with filters kept
    for W, Hh, mobile in ((390, 844, True), (1440, 900, False)):
        tag = f"[back {W}]"
        ctx = context(b, W, Hh, mobile); pg = page(ctx)
        pg.goto(BASE + "butik/", wait_until="load"); pg.wait_for_timeout(400)
        if mobile:
            pg.tap("#toggleFilters"); pg.wait_for_timeout(400); pg.tap("#fForm input[name=room][value=vardagsrum]"); pg.wait_for_timeout(200); pg.tap("#fShow"); pg.wait_for_timeout(400)
        pg.evaluate("scrollTo(0, 900)"); pg.wait_for_timeout(400)
        h = pg.evaluate("[...document.querySelectorAll('#results .card')].find((c) => { const r = c.querySelector('h3 a').getBoundingClientRect(); return r.top > 70 && r.bottom < innerHeight - 90; }).querySelector('h3 a').getAttribute('href')")
        (pg.tap if mobile else pg.click)(f"#results h3 a[href='{h}']"); pg.wait_for_timeout(900)
        pg.go_back(); pg.wait_for_timeout(1200)
        ok(abs(pg.evaluate("scrollY") - 900) < 4, f"{tag} Back from a product returns to 900 px: {pg.evaluate('scrollY')}")
        pg.goto(BASE + "produkt-sand-keramikvas/", wait_until="load"); pg.wait_for_timeout(600)
        pg.go_back(); pg.wait_for_timeout(1600)
        ok(abs(pg.evaluate("scrollY") - 900) < 4, f"{tag} Back after a full page load also returns to 900 px: {pg.evaluate('scrollY')}")
        if mobile:
            ok(pg.evaluate("document.getElementById('fN').textContent") == "1", f"{tag} the filter is kept")
        ctx.close()

    # D22: the order button in the checkout says the total, and follows the delivery choice
    for W, Hh, mobile in ((360, 740, True), (1440, 900, False)):
        tag = f"[kassa {W}]"
        ctx = context(b, W, Hh, mobile); pg = page(ctx)
        pg.goto(BASE, wait_until="load"); pg.evaluate("RQ.shop.addToCart('sand-keramikvas::0', 1)")
        pg.goto(BASE + "kassa/", wait_until="load"); pg.wait_for_timeout(400)
        btn = lambda: pg.evaluate("document.querySelector('#co button[type=submit]').textContent.replace(/\\s+/g, ' ')")
        tot = lambda: pg.evaluate("document.querySelector('.co-final [data-co=total]').textContent.replace(/\\s+/g, ' ')")
        ok(btn() == f"Lägg testorder · {tot()}", f"{tag} the order button says the total: {btn()!r}")
        radios = pg.evaluate("[...document.querySelectorAll('#co [name=ship]')].map((r) => r.value)")
        if len(radios) > 1:
            pg.evaluate("(v) => { const r = document.querySelector(`#co [name=ship][value='${v}']`); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }", radios[-1]); pg.wait_for_timeout(200)
            ok(btn() == f"Lägg testorder · {tot()}", f"{tag} and follows the delivery choice: {btn()!r}")
        ctx.close()

    # M11: the dock marks where you are (ink, and an accent line under the item; a ring around Mitt rum)
    for W, Hh, evening in ((390, 844, False), (360, 740, True)):
        tag = f"[dock {W}{' kväll' if evening else ''}]"
        ctx = context(b, W, Hh, True, evening); pg = page(ctx)
        for r, key in (("butik/", "butik"), ("mitt-hem/", "sparat"), ("mitt-rum/", "mitt")):
            pg.goto(BASE + r, wait_until="load"); pg.wait_for_timeout(300)
            got = pg.evaluate("""(k) => { const a = document.querySelector(`#dock [data-dock=${k}]`), acc = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
              const line = getComputedStyle(a, '::after'), others = [...document.querySelectorAll('#dock [data-dock]')].filter((x) => x !== a && getComputedStyle(x, '::after').content !== 'none').length;
              return [a.getAttribute('aria-current'), line.content !== 'none' && line.height === '3px', others]; }""", key)
            ok(got == ["page", True, 0], f"{tag} {key}: the dock item is marked, and only it: {got}")
        ctx.close()

    # D12: the loupe waits until the pointer moves on the picture
    for W, Hh, mobile in [x for x in SIZES if not x[2]]:
        tag = f"[{W}]"
        ctx = context(b, W, Hh, mobile); pg = page(ctx)
        pg.goto(BASE + "butik/", wait_until="load"); pg.wait_for_timeout(300)
        box = pg.locator("#view .card").nth(0).bounding_box()
        x, y = box["x"] + box["width"] / 2, box["y"] + 100
        pg.mouse.move(x, y); pg.mouse.click(x, y); pg.wait_for_timeout(1200)
        ok("produkt-" in pg.evaluate("location.pathname") and pg.evaluate("document.querySelectorAll('.pg-item.zooming').length") == 0, f"{tag} arriving on a product from a card shows the whole picture")
        pg.mouse.move(x + 30, y + 30, steps=5); pg.wait_for_timeout(700)
        ok(pg.evaluate("document.querySelectorAll('.pg-item.zooming').length") == 1, f"{tag} moving the pointer on the picture starts the loupe")
        ctx.close()
    b.close()

print(f"{n - len(fails)} of {n} checks passed")
sys.exit(1 if fails else 0)
