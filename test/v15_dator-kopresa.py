#!/usr/bin/env python3
"""v15 checks for home, shop, product page and desktop header (agent dator-kopresa).
Run after `python3 tools/build.py`:  python3 test/v15_dator-kopresa.py"""
import http.server, re, socketserver, sys, threading
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
UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"


def page(b, w, h, phone=False, **kw):
    if phone:
        kw.update(is_mobile=True, has_touch=True, device_scale_factor=2, user_agent=UA)
    ctx = b.new_context(viewport={"width": w, "height": h}, locale="sv-SE", **kw)
    ctx.route(re.compile(r"^https?://(?!127\.0\.0\.1)"), lambda r: r.abort())
    pg = ctx.new_page()
    pg.errs = []
    pg.on("pageerror", lambda e: pg.errs.append(str(e)))
    return ctx, pg


def go(pg, route="", wait=900):
    pg.goto(BASE + (route + "/" if route else ""), wait_until="load")
    pg.wait_for_timeout(wait)
    pg.evaluate("document.getElementById('ckNeed') && document.getElementById('ckNeed').click()")


with sync_playwright() as p:
    b = p.chromium.launch()

    # ------------------------------------------------------------ home, desktop
    for W, Hh in ((1440, 900), (1280, 720)):
        t = f"[home {W}]"
        ctx, pg = page(b, W, Hh)
        reqs = []
        pg.on("request", lambda r: reqs.append(r.url.split("/")[-1].split("?")[0]) if re.search(r"hero|/rum-\d|video", r.url) else None)
        go(pg, "", 1500)
        s = pg.evaluate("""() => { const h = document.getElementById('hero'), band = document.querySelector('.band.settle'), bt = [...band.querySelectorAll('.btn')].map((x) => x.getBoundingClientRect());
          return { hero: h.offsetHeight / innerHeight, bands: document.querySelectorAll('.hero .band').length, op: getComputedStyle(band).opacity, h1: band.querySelector('h1').getBoundingClientRect().top, btns: bt.length, btnBottom: Math.max(...bt.map((r) => r.bottom)), vh: innerHeight,
            card: (document.querySelector('#utvalt .card').getBoundingClientRect().top + scrollY) / innerHeight, stat: document.documentElement.classList.contains('static'), h1Lines: Math.round(band.querySelector('h1').getBoundingClientRect().height / parseFloat(getComputedStyle(band.querySelector('h1')).lineHeight)) } }""")
        ok(s["bands"] == 1 and float(s["op"]) > 0.9, f"{t} one headline, visible from the first frame (no changing lines that can overlap)")
        ok(s["btns"] == 2 and s["h1"] > 0 and s["btnBottom"] < s["vh"], f"{t} headline and both buttons are on the first screen: {s}")
        ok(s["hero"] <= 2.05, f"{t} the film scrolls one screen, not five: {s['hero']}")
        ok(s["card"] < 3, f"{t} first product within three screens: {s['card']:.2f}")
        ok(s["h1Lines"] == 2, f"{t} the headline is two lines")
        ok(not s["stat"], f"{t} a desktop gets the scroll film")
        ok("hero-m-start.webp" not in reqs and not any(x.startswith("rum-") for x in reqs), f"{t} only the first frame and the film are fetched: {reqs}")
        if W == 1440:
            pg.mouse.move(700, 450)
            for _ in range(5):
                pg.mouse.wheel(0, 100); pg.wait_for_timeout(160)
            pg.wait_for_timeout(700)
            ok(pg.evaluate("document.getElementById('heroVideo').currentTime") > 1 and pg.evaluate("getComputedStyle(document.querySelector('.band.settle')).opacity") == "1", f"{t} scrolling moves the film, the words stay")
            ok(pg.evaluate("document.querySelectorAll('#utvalt .card').length") == 8 and pg.evaluate("getComputedStyle(document.querySelector('#utvalt .grid')).gridTemplateColumns.split(' ').length") == 4, f"{t} eight favourites, four across")
            ok(pg.evaluate("[...document.querySelectorAll('#utvalt img.hov')].every((i) => !i.getAttribute('src'))"), f"{t} detail photos are not fetched before a mouse comes near")
            pg.evaluate("document.querySelector('#utvalt .card').scrollIntoView({block:'center'})"); pg.wait_for_timeout(300)
            pg.hover("#utvalt .card >> nth=0", force=True); pg.wait_for_timeout(200)
            ok(pg.evaluate("!!document.querySelector('#utvalt .card img.hov').getAttribute('src')"), f"{t} the detail photo comes on hover")
            pg.evaluate("document.querySelector('.rh-fig').scrollIntoView({block:'center'})"); pg.wait_for_timeout(2800)
            ok(pg.evaluate("(() => { const f = document.querySelector('.rh-fig'), x = f.querySelector('.ba-line').getBoundingClientRect().left; return [...f.querySelectorAll('.rh-tag')].every((t) => t.getBoundingClientRect().left >= x - 14); })()"), f"{t} every product tag is whole beside the divider")  # r3 M15: after is right of the line now
            pg.evaluate("document.getElementById('homeLooks').scrollIntoView({block:'center'})"); pg.wait_for_timeout(300)
            pg.click("[data-row-nav] [data-dir='1']"); pg.wait_for_timeout(900)
            ok(pg.evaluate("document.getElementById('homeLooks').scrollLeft") > 300, f"{t} the arrow moves the looks row")
            pg.set_viewport_size({"width": 800, "height": 900}); pg.wait_for_timeout(500)
            ok(pg.evaluate("document.documentElement.classList.contains('static') && document.getElementById('hero').offsetHeight <= innerHeight + 2"), f"{t} dragged narrow, the hero becomes the still one")
        ok(not pg.errs, f"{t} no script error: {pg.errs[:1]}")
        ctx.close()

    # ------------------------------------------------------------ home, phone
    ctx, pg = page(b, 390, 844, phone=True)
    reqs = []
    pg.on("request", lambda r: reqs.append(r.url.split("/")[-1].split("?")[0]) if re.search(r"hero|/rum-\d|video", r.url) else None)
    pg.goto(BASE, wait_until="load"); pg.wait_for_timeout(1500)
    ok(pg.evaluate("getComputedStyle(document.getElementById('nav')).color") == "rgb(247, 245, 240)", "[home 390] white logo and icons on the photo in day mode")
    ok("hero-start-1600.webp" not in reqs and not any(x.startswith("rum-") for x in reqs), f"[home 390] the phone fetches its own first picture only: {reqs}")
    ok(pg.evaluate("[...document.querySelectorAll('#utvalt img.hov')].every((i) => !i.getAttribute('src'))"), "[home 390] no hover photos on a touch screen")
    ctx.close()

    # ------------------------------------------------------------ shop, desktop
    for W, Hh in ((1440, 900), (1280, 720)):
        ctx, pg = page(b, W, Hh); go(pg, "butik", 1100)
        s = pg.evaluate("({ price: document.querySelector('#results .price').getBoundingClientRect().bottom, vh: innerHeight, tb: document.querySelector('.toolbar').offsetHeight })")
        pg.evaluate("window.scrollTo(0, 500)"); pg.wait_for_timeout(200)
        s["side"] = pg.evaluate("(() => { const f = document.getElementById('filters').getBoundingClientRect(); return f.top >= 60 && f.bottom <= innerHeight + 1; })()")
        ok(s["price"] < s["vh"], f"[shop {W}] a price is on the first screen: {s}")
        ok(s["tb"] < 60, f"[shop {W}] one toolbar row: {s['tb']}")
        ok(s["side"], f"[shop {W}] the filter column fits the window")
        ctx.close()
    ctx, pg = page(b, 1440, 900); go(pg, "butik", 1100)
    ok(pg.evaluate("[...document.querySelectorAll('#results .card .ph img:first-child')].slice(0, 5).map((i) => i.getAttribute('fetchpriority') || i.loading).join()") == "high,high,eager,eager,lazy", "[shop] the first row of pictures is fetched at once")
    pg.check("#fForm input[name=price][value='0-300']"); pg.wait_for_timeout(200)
    prices = pg.evaluate("[...document.querySelectorAll('#results > .grid .price')].map((e) => +e.textContent.replace(/\\D/g, ''))")
    ok(prices and all(x < 300 for x in prices) and pg.evaluate("document.getElementById('count').textContent") == f"{len(prices)} produkter", f"[shop] price filter works in place: {prices}")
    pg.check("#fForm input[name=tone][value=svart]"); pg.wait_for_timeout(200)
    ok(pg.evaluate("document.getElementById('count').textContent === '0 produkter' && !!document.querySelector('#results .empty [data-f-clear]')"), "[shop] an empty filter result says so and offers to clear")
    pg.click("#results [data-f-clear]"); pg.wait_for_timeout(200)
    ok(pg.evaluate("document.querySelectorAll('#results > .grid .card').length") == 21 and pg.evaluate("document.querySelectorAll('#fForm input:checked').length") == 0, "[shop] Rensa filter brings everything back")
    pg.check("#fForm input[name=cat][value='belysning-atmosfar']"); pg.check("#fForm input[name=room][value=sovrum]"); pg.wait_for_timeout(200)
    ok(0 < pg.evaluate("document.querySelectorAll('#results > .grid .card').length") < 5, "[shop] category and room can be combined")
    pg.select_option("#sort", "desc"); pg.wait_for_timeout(200)
    pg.evaluate("location.hash = '#produkt-lysa-keramiklampa'"); pg.wait_for_timeout(700)
    pg.evaluate("location.hash = '#butik'"); pg.wait_for_timeout(700)
    ok(pg.evaluate("document.getElementById('sort').value") == "desc" and pg.evaluate("document.querySelectorAll('#fForm input:checked').length") == 2, "[shop] sort and filters are kept when you come back")
    pg.evaluate("sessionStorage.clear()")
    pg.evaluate("location.hash = '#kategori-uteliv'"); pg.wait_for_timeout(700)
    ok(pg.evaluate("document.getElementById('count').textContent") == "1 produkt" and pg.evaluate("!!document.querySelector('.list-more .card')") and pg.evaluate("!document.querySelector('#fForm [data-f=cat]')"), "[shop] '1 produkt', more that fits under a short list, no category filter on a category page")
    pg.evaluate("location.hash = '#favoriter'"); pg.wait_for_timeout(700)
    ok(pg.evaluate("document.querySelectorAll('#results > .grid .card').length") == 10 and pg.evaluate("!document.getElementById('sort')") and "kunderna" not in pg.evaluate("document.querySelector('#view .lead').textContent"), "[shop] Populärt: our ten picks, an honest lead")
    pg.evaluate("location.hash = '#rum-vardagsrum'"); pg.wait_for_timeout(900)
    s = pg.evaluate("({ card: document.querySelector('#results .card').getBoundingClientRect().top + scrollY, tips: (document.querySelector('.rum-more').getBoundingClientRect().top + scrollY), ol: !!document.querySelector('.rum-more .prose > ol.numbered'), notes: document.querySelectorAll('#view .note').length })")
    ok(s["card"] < 1300 and s["tips"] > s["card"] and s["ol"] and s["notes"] == 0, f"[rum] products right under the picture, tips after, one quiet note: {s}")
    pg.evaluate("location.hash = '#kategori-tavlor-vaggar'"); pg.wait_for_timeout(700)
    ok(pg.evaluate("[...document.querySelectorAll('#results > .grid .card .ph img:first-child')].every((i) => i.classList.contains('cutph') && /\\/cut\\//.test(i.getAttribute('src')))"), "[shop] prints are shown as the framed print")
    pg.evaluate("location.hash = '#butik'"); pg.wait_for_timeout(700)
    pg.set_viewport_size({"width": 800, "height": 900}); pg.wait_for_timeout(400)
    ok(pg.evaluate("getComputedStyle(document.getElementById('toggleFilters')).display") != "none", "[shop] a window dragged narrow gets the Filter button")
    ok(not pg.errs, f"[shop] no script error: {pg.errs[:1]}")
    ctx.close()
    ctx, pg = page(b, 1920, 1080); go(pg, "butik", 900)
    ok(pg.evaluate("getComputedStyle(document.querySelector('#results .grid')).gridTemplateColumns.split(' ').length") == 4, "[shop 1920] four columns on a wide screen")
    ctx.close()
    ctx, pg = page(b, 820, 1180); go(pg, "butik", 900)
    ok(pg.evaluate("getComputedStyle(document.querySelector('#results .grid')).gridTemplateColumns.split(' ').length") == 3, "[shop 820] three columns on a tablet")
    pg.evaluate("location.hash = '#produkt-lysa-keramiklampa'"); pg.wait_for_timeout(900)
    ok(pg.evaluate("getComputedStyle(document.querySelector('.pdp')).gridTemplateColumns.split(' ').length") == 2 and pg.evaluate("document.getElementById('add').getBoundingClientRect().bottom < innerHeight"), "[product 820] two columns, the button on the first screen")
    pg.evaluate("location.hash = '#rum'"); pg.wait_for_timeout(700)
    ok(pg.evaluate("getComputedStyle(document.querySelector('.tiles')).gridTemplateColumns.split(' ').length") == 4, "[rum 820] eight tiles in two full rows")
    ctx.close()

    # ------------------------------------------------------------ shop, phone
    for W, Hh in ((390, 844), (360, 740)):
        t = f"[shop {W}]"
        ctx, pg = page(b, W, Hh, phone=True); go(pg, "butik", 1100)
        s = pg.evaluate("""(() => { const R = (q) => document.querySelector(q).getBoundingClientRect(); const tb = R('.toolbar'); return { tbH: tb.height, right: Math.max(R('#sort').right, R('#toggleFilters').right), wrapR: tb.right, card: R('#results .card').top, sw: document.documentElement.scrollWidth, iw: innerWidth }; })()""")
        ok(s["tbH"] < 60 and s["right"] <= s["wrapR"] + 1 and s["sw"] == s["iw"], f"{t} filter and sort on one row inside the page (no room switch: founder's decision): {s}")
        ok(s["card"] < 300, f"{t} the first product starts high: {s['card']}")
        pg.tap("#toggleFilters"); pg.wait_for_timeout(600)
        s = pg.evaluate("""(() => { const f = document.getElementById('filters'), r = f.getBoundingClientRect(); return { show: f.classList.contains('show'), bottom: Math.round(r.bottom), vh: innerHeight, top: r.top, exp: document.getElementById('toggleFilters').getAttribute('aria-expanded'), opt: f.querySelector('.f-opt').getBoundingClientRect().height, btn: document.getElementById('fShow').textContent, lock: getComputedStyle(document.documentElement).overflow }; })()""")
        ok(s["show"] and abs(s["bottom"] - s["vh"]) < 2 and s["top"] > 40 and s["exp"] == "true" and s["lock"] == "hidden", f"{t} Filter opens a sheet from the bottom: {s}")
        ok(s["opt"] >= 44 and s["btn"] == "Visa 21 produkter", f"{t} 44 px rows and a button that says how many: {s}")
        pg.tap("#fForm input[name=tone][value=terrakotta]"); pg.wait_for_timeout(200)
        ok(pg.evaluate("document.getElementById('fShow').textContent") == "Visa 2 produkter", f"{t} the count follows the choice")
        pg.tap("#fShow"); pg.wait_for_timeout(500)
        ok(pg.evaluate("!document.getElementById('filters').classList.contains('show') && document.querySelectorAll('#results > .grid .card').length === 2 && document.getElementById('fN').textContent === '1' && getComputedStyle(document.documentElement).overflow !== 'hidden'"), f"{t} the sheet closes on the filtered list")
        ok(not pg.errs, f"{t} no script error: {pg.errs[:1]}")
        ctx.close()

    # ------------------------------------------------------------ product, phone
    for W, Hh in ((390, 844), (360, 740)):
        t = f"[product {W}]"
        ctx, pg = page(b, W, Hh, phone=True); go(pg, "produkt-forradsburkar-glas-ek-3-pack", 1200)
        s = pg.evaluate("""(() => { const B = (q) => document.querySelector(q).getBoundingClientRect().bottom; const bar = document.getElementById('buybar'); return { h1: B('.pinfo h1'), price: B('.pprice'), limit: bar.classList.contains('show') ? bar.getBoundingClientRect().top : innerHeight, crumbs: document.querySelector('.pcr .crumbs').offsetHeight, name: (() => { const n = document.querySelector('.buybar b'); return n.scrollWidth <= n.clientWidth + 1 && n.scrollHeight <= n.clientHeight + 1; })(), btn: (() => { const x = document.getElementById('add2'); return x.scrollWidth <= x.clientWidth + 1; })(), add: (() => { const x = document.getElementById('add'); return x.scrollWidth <= x.clientWidth + 1; })() }; })()""")
        ok(s["h1"] < s["limit"] and s["price"] < s["limit"], f"{t} name and price are on the first screen: {s}")
        ok(s["crumbs"] < 30, f"{t} the path is one line")
        ok(s["name"] and s["btn"] and s["add"], f"{t} no clipped text in the buy bar or the button: {s}")
        ctx.close()

    # ------------------------------------------------------------ product, desktop
    ctx, pg = page(b, 1440, 900); go(pg, "produkt-vaffelhandduk-bomull", 1100)
    def typ(v):
        pg.evaluate("RQ.shop.clearCart()"); pg.fill("#qty", ""); pg.focus("#qty"); pg.keyboard.type(v); pg.keyboard.press("Tab"); pg.wait_for_timeout(80)
        shown = pg.evaluate("document.getElementById('qty').value"); pg.click("#add"); pg.wait_for_timeout(150)
        q = pg.evaluate("RQ.shop.cartLines().map((l) => l.quantity)[0]"); pg.wait_for_timeout(1900)
        return shown, q
    for v, want in (("500", 99), ("2.5", 3), ("0", 1), ("-1", 1), ("abc", 1), ("7", 7)):
        shown, q = typ(v)
        ok(shown == str(want) and q == want, f"[product] quantity '{v}' is corrected in the field to {want} and that is what is added: {shown}, {q}")
    ok(pg.evaluate("document.getElementById('qty').value") == "1", "[product] the quantity goes back to 1 after adding")
    pg.evaluate("RQ.shop.clearCart(); RQ.shop.addToCart('vaffelhandduk-bomull::0', 99)"); pg.click("#add"); pg.wait_for_timeout(200)
    ok(pg.evaluate("RQ.shop.cartLines()[0].quantity") == 99 and "max" in pg.evaluate("document.getElementById('qtyNote').textContent").lower() and "Tillagd" not in pg.evaluate("document.getElementById('add').textContent"), "[product] at 99 nothing is added and the page says why")
    pg.evaluate("RQ.shop.clearCart()")
    pg.click(".swatch-row button >> nth=1"); pg.wait_for_timeout(100)
    ok(pg.evaluate("!document.getElementById('vnote').hidden && document.getElementById('bbVar').textContent.includes('Sand')"), "[product] choosing a colour says which colour the photos show and follows to the buy bar")
    ok(pg.evaluate("[...document.querySelectorAll('.pactions button')].map((x) => x.textContent.trim()).join()") == "Spara,Lägg i lista,Dela", "[product] Spara, Lägg i lista, Dela")
    ok(pg.evaluate("!document.querySelector('.pg-item.cut')") and pg.evaluate("!document.querySelector('.pg .caption')"), "[product] a towel has no cut-out picture, the caption is not above the name")
    pg.click("#ptb-matt"); ok(re.match(r"^RQ-\d{4}$", pg.evaluate("document.querySelector('.facts li span:last-child').textContent")) is not None, "[product] the article number is a number, not a cut-off name")
    pg.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)"); pg.wait_for_timeout(1000)
    ok(pg.evaluate("[...document.querySelectorAll('footer.site .bottom a, footer.site .bottom button')].every((e) => { const r = e.getBoundingClientRect(), t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !(t && t.closest('#buybar')); })"), "[product] the buy bar does not cover the last row of the footer")
    ok(pg.evaluate("getComputedStyle(document.querySelector('.lb')).backgroundColor") == "rgb(14, 15, 14)", "[product] the lightbox is opaque")
    pg.evaluate("location.hash = '#produkt-affisch-linje-ekram'"); pg.wait_for_timeout(900)
    ok(pg.evaluate("document.querySelector('#pgGrid .pg-item').classList.contains('cut') && document.querySelector('.buybar img').classList.contains('cutph')"), "[product] a print leads with the framed print")
    ok(not pg.errs, f"[product] no script error: {pg.errs[:1]}")
    ctx.close()

    # ------------------------------------------------------------ header
    ctx, pg = page(b, 1024, 768); go(pg, "butik", 900)
    ok(pg.evaluate("getComputedStyle(document.querySelector('.menu')).display") == "flex" and pg.evaluate("getComputedStyle(document.getElementById('burger')).display") == "none" and pg.evaluate("document.documentElement.scrollWidth === innerWidth"), "[header 1024] the text menu is there, no burger")
    ok(pg.evaluate("document.querySelector('.menu > li > button').classList.contains('active')"), "[header] the menu marks where you are")
    ok(pg.evaluate("document.getElementById('lampBtn').title === 'Ljus på sajten' && document.getElementById('accLink').title.length > 3"), "[header] the icons have tooltips")
    pg.focus(".menu [data-mega]"); pg.keyboard.press("Enter"); pg.wait_for_timeout(250); pg.keyboard.press("Tab")
    ok(pg.evaluate("!!document.activeElement.closest('#megaShop')"), "[header] Tab goes from Butik straight into its panel")
    pg.keyboard.press("Escape"); pg.wait_for_timeout(150)
    ok(pg.evaluate("!document.getElementById('megaShop').classList.contains('open') && document.activeElement.matches('[data-mega]')"), "[header] Escape closes the panel and returns to the button")
    pg.evaluate("location.hash = '#frakt'"); pg.wait_for_timeout(700)
    ok(pg.evaluate("document.querySelector('.prose').getBoundingClientRect().width") <= 600, "[info] text lines are capped near 70 characters")
    ctx.close()
    ctx, pg = page(b, 390, 844, phone=True); go(pg, "frakt", 900)
    ok(pg.evaluate("getComputedStyle(document.querySelector('.layout-side .sidenav')).display") == "none", "[info 390] the help menu is not repeated above the footer")
    ctx.close()
    b.close()

print(f"{n - len(fails)} of {n} checks passed")
sys.exit(1 if fails else 0)
