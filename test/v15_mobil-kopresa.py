#!/usr/bin/env python3
"""v15 checks for search, cart drawer, checkout, layers/Back and phone navigation (agent mobil-kopresa).
Run after `python3 tools/build.py`:  python3 test/v15_mobil-kopresa.py"""
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
UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
LOOK = ["lysa-keramiklampa", "plad-ullblandning-havre", "lin-kuddfodral", "glod-doftljus-keramik"]
STATE = "[location.pathname.replace(/.*\\/([^/]*)\\/$/, '$1'), ['mnav','search','cart'].filter((i) => document.getElementById(i).classList.contains('open')).join(','), document.documentElement.style.overflow]"

with sync_playwright() as p:
    b = p.chromium.launch()
    for W, Hh, mobile in ((390, 844, True), (1280, 720, False)):
        tag = f"[{W}]"
        ctx = b.new_context(viewport={"width": W, "height": Hh}, has_touch=mobile, is_mobile=mobile, **({"user_agent": UA, "device_scale_factor": 2} if mobile else {}))
        ctx.route(re.compile(r"^https?://(?!127\.0\.0\.1)"), lambda r: r.abort())
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        tap = (lambda sel: pg.locator(sel).first.tap()) if mobile else (lambda sel: pg.locator(sel).first.click())
        ev = pg.evaluate

        # ------------------------------------------------------------ cookie bar on the home page
        pg.goto(BASE); pg.wait_for_timeout(500)
        if mobile:
            pg.touchscreen.tap(200, 300); pg.wait_for_timeout(400)
            ok(not ev("document.getElementById('cookie').classList.contains('show')"), f"{tag} home: a tap on the first screen does not bring the cookie bar over the buttons")
            ev("scrollTo(0, innerHeight * 0.7)"); pg.wait_for_timeout(700)
            ok(ev("document.getElementById('cookie').classList.contains('show')"), f"{tag} home: the cookie bar comes after the first screen")
        ev("document.getElementById('ckNeed').click()")

        # ------------------------------------------------------------ search: the words people type
        pg.goto(BASE + "butik/"); pg.wait_for_timeout(500)
        names = lambda q: ev("(q) => RQ.shop.search(q).list.map((p) => p.handle)", q)
        ok(len(names("lampor")) == 3 and names("lampor") == names("lampa") == names("lamporna"), f"{tag} search: plural and definite forms find the lamps")
        ok(names("kudde") == ["lin-kuddfodral"] and names("kuddar") == ["lin-kuddfodral"], f"{tag} search: kudde finds kuddfodral")
        ok(set(names("poster")) == set(names("tavla")) == {"affisch-linje-ekram", "affisch-horisont-ekram"}, f"{tag} search: poster and tavla find both affischer")
        ok(names("matta") == ["strand-jutematta"], f"{tag} search: matta finds the rug and not 'matt papper'")
        ok(names("handdukar")[:1] == ["vaffelhandduk-bomull"], f"{tag} search: the towel comes first for handdukar")
        ok(names("röd") == [], f"{tag} search: röd no longer hits bröd")
        ok(len(names("forvaring")) >= 3 and names("skarbrada") == ["skarbrada-ek-med-handtag"], f"{tag} search: works without å ä ö")
        ok("plad-ullblandning-havre" in names("filt"), f"{tag} search: filt finds the pläd")
        ok(names("ek")[:3] == ["skarbrada-ek-med-handtag", "forradsburkar-glas-ek-3-pack", "skrivbordsorganisator-ek"], f"{tag} search: name hits come first")
        fx = ev("RQ.shop.search('lmpa')")
        ok(fx["fixed"] == "lampa" and len(fx["list"]) == 3, f"{tag} search: one slip is corrected (lmpa -> lampa)")
        ok(ev("RQ.shop.search('l').short") and names("l") == [], f"{tag} search: one letter searches nothing")
        ok(names("sovrum lampa") == names("lampa"), f"{tag} search: two words must both fit well")

        # ------------------------------------------------------------ search overlay
        tap(".msearch" if mobile else ".searchbtn"); pg.wait_for_timeout(450)
        ok(ev("document.activeElement.id") == "searchInput" and ev("document.getElementById('searchInput').getAttribute('autocapitalize')") == "off", f"{tag} search: field focused, no auto capitals")
        res = lambda: ev("document.getElementById('searchRes').innerText.replace(/\\s+/g, ' ')")
        for chip in ev("[...document.querySelectorAll('#searchRes .chip[data-q]')].map((c) => c.dataset.q)"):
            pg.fill("#searchInput", chip); pg.wait_for_timeout(260)
            ok("Inga träffar" not in res(), f"{tag} search: the suggested word '{chip}' leads somewhere")
        pg.fill("#searchInput", "frakt"); pg.wait_for_timeout(260)
        ok(ev("!!document.querySelector('#searchRes a.chip[href*=frakt]')") and "Inga träffar" not in res(), f"{tag} search: frakt finds the help page")
        pg.fill("#searchInput", "vas"); pg.wait_for_timeout(260)
        ok("1 produkt " in res() + " " and "1 produkter" not in res(), f"{tag} search: '1 produkt' in the singular")
        pg.fill("#searchInput", "lmpa"); pg.wait_for_timeout(260)
        ok("Menade du lampa?" in res(), f"{tag} search: 'Menade du lampa?' is shown")
        ok(ev("getComputedStyle(document.querySelector('#search .hint')).display") == "none", f"{tag} search: the hint steps aside while there is a query")
        pg.fill("#searchInput", "ljus"); pg.wait_for_timeout(260)
        ev("document.getElementById('search').scrollTop = 500"); pg.wait_for_timeout(150)
        ok(ev("(() => { const r = document.querySelector('#search .close').getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return r.top >= 0 && r.bottom <= innerHeight && !!e && !!e.closest('.close'); })()"), f"{tag} search: the close button stays on screen after scrolling")
        ev("document.getElementById('search').scrollTop = 0")
        if mobile:
            pg.set_viewport_size({"width": W, "height": 480}); pg.wait_for_timeout(250)
            ok(ev("document.querySelector('#searchRes .card .price').getBoundingClientRect().bottom") <= 480, f"{tag} search: with the keyboard up a whole first row (name and price) is visible")
            pg.set_viewport_size({"width": W, "height": Hh}); pg.wait_for_timeout(150)
        else:
            pg.focus("#searchInput"); pg.keyboard.press("Enter"); pg.wait_for_timeout(120)
            ok(ev("!!document.activeElement.closest('#searchRes .card')"), f"{tag} search: Enter steps into the hits")
            pg.keyboard.press("ArrowDown"); a2 = ev("document.activeElement.textContent"); pg.keyboard.press("ArrowUp"); pg.keyboard.press("ArrowUp")
            ok(ev("document.activeElement.id") == "searchInput" and a2, f"{tag} search: arrow keys walk the hits and back to the field")

        # ------------------------------------------------------------ layers and Back
        pg.go_back(); pg.wait_for_timeout(450)
        ok(ev(STATE) == ["butik", "", ""], f"{tag} Back closes the search and stays on the page: {ev(STATE)}")
        if mobile:
            tap("#burger"); pg.wait_for_timeout(450)
            m = ev("(() => { const m = document.getElementById('mnav'); return { cats: m.querySelectorAll('a[href*=kategori-]').length, low: [...m.querySelectorAll('a:not(.nav-logo), button')].filter((a) => a.getBoundingClientRect().height < 44).length, set: Math.max(...[...m.querySelectorAll('.mnav-set button')].map((x) => x.getBoundingClientRect().bottom)), txt: m.innerText }; })()")
            ok(m["cats"] == 8, f"{tag} menu: all eight categories")
            ok(m["low"] == 0, f"{tag} menu: every row is at least 44 px high")
            ok(m["set"] < Hh / 2, f"{tag} menu: language and light are on the first screen")
            ok("Spåra min beställning" in m["txt"] and "Var är mitt paket" not in m["txt"], f"{tag} menu: one name for order tracking")
            pg.go_back(); pg.wait_for_timeout(450)
            ok(ev(STATE) == ["butik", "", ""], f"{tag} Back closes the menu: {ev(STATE)}")
            tap("#burger"); pg.wait_for_timeout(350); pg.locator("#mnav a[href*=looks]").first.tap(); pg.wait_for_timeout(700)
            ok(ev(STATE) == ["looks", "", ""], f"{tag} a menu link opens its page")
            pg.go_back(); pg.wait_for_timeout(700)
            ok(ev(STATE) == ["butik", "", ""], f"{tag} one Back returns from a page opened in the menu")
        ok("Var är mitt paket" not in ev("document.querySelector('footer.site').innerText"), f"{tag} footer: one name for order tracking")

        # ------------------------------------------------------------ quick add: a double tap is one thing
        ev("scrollTo(0, 420)"); pg.wait_for_timeout(250)
        q = pg.locator("#results .card .qadd").first
        (q.tap if mobile else q.click)(); pg.wait_for_timeout(60); ev("document.querySelector('#results .card .qadd').click()"); pg.wait_for_timeout(300)
        ok(ev("RQ.shop.cartCount()") == 1, f"{tag} a double tap on quick add adds one")
        t = ev("(() => { const t = document.getElementById('toast').getBoundingClientRect(), nav = document.getElementById('nav').getBoundingClientRect(); return [t.top, nav.bottom, innerHeight - t.bottom]; })()")
        ok(t[0] > t[1] + 100 and t[2] < 220, f"{tag} the toast shows at the bottom, away from the header: {t}")
        pg.wait_for_timeout(1900)
        ev("RQ.shop.clearCart(); RQ.shop.addToCart('lin-kuddfodral::1', 3); RQ.confirmAdd(null, 'Lin kuddfodral')"); pg.wait_for_timeout(150)
        ok("3 × Lin kuddfodral, Salvia" in ev("document.getElementById('toast').innerText"), f"{tag} the toast says how many and which colour")

        # ------------------------------------------------------------ cart drawer
        ev("(l) => { RQ.shop.clearCart(); l.forEach((h) => RQ.shop.addToCart(h + '::0', 1)); RQ.shop.addToCart('sand-keramikvas::0', 2); RQ.openCart(); }", LOOK); pg.wait_for_timeout(500)
        foot = lambda: ev("document.querySelector('#cart footer').innerText.replace(/\\s+/g, ' ')")
        ok("Totalt 3 216 kr" in foot().replace(" ", " ") and "−269 kr" in foot(), f"{tag} drawer: a Totalt row (3 485 − 269, free shipping): {foot()}")
        ok(ev("document.documentElement.style.overflow") == "hidden" and ev("document.getElementById('cart').getAttribute('role')") == "dialog", f"{tag} drawer: the page behind is locked, the drawer is a dialog")
        sz = ev("[...document.querySelector('#cart .line').querySelectorAll('.qty button, .rm')].map((x) => { const r = x.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })")
        ok(all(w >= 44 and h >= 44 for w, h in sz[:2]) and sz[2][1] >= 44, f"{tag} drawer: steppers and Ta bort are 44 px to press: {sz}")
        ok(ev("document.querySelector('#cart .line [data-d=\"-1\"]').disabled"), f"{tag} drawer: minus rests at one")
        pg.locator("#cart .line [data-d='1']").nth(4).focus(); pg.keyboard.press("Enter"); pg.wait_for_timeout(200)
        ok(ev("(document.activeElement.getAttribute('aria-label') || '').startsWith('Öka antalet Sand')"), f"{tag} drawer: the focus stays on the button after a change")
        ok("399 kr/st" in ev("document.querySelectorAll('#cart .line')[4].innerText"), f"{tag} drawer: price each is shown when there are several")
        r = pg.locator("#cart .line .rm").nth(3); (r.tap if mobile else r.click)(); pg.wait_for_timeout(350)
        ok(ev("RQ.shop.cartLines().length") == 4 and "Ångra" in ev("document.getElementById('toast').innerText") and ev("document.getElementById('toast').classList.contains('show')"), f"{tag} drawer: removing offers Ångra")
        ok(ev("(() => { const n = document.querySelector('#cart .look-nudge'); return !!n && /Mjuk kväll/.test(n.innerText) && /Glöd doftljus/.test(n.innerText) && /269/.test(n.innerText); })()"), f"{tag} drawer: a look one thing short says what to add and what it saves")
        ok("−269" not in foot(), f"{tag} drawer: no look discount while the look is incomplete")
        if mobile:
            ok(ev("document.getElementById('toast').getBoundingClientRect().bottom <= document.querySelector('#cart footer').getBoundingClientRect().top + 1"), f"{tag} drawer: the toast sits above the footer with the total and the button")
        u = pg.locator("#toast [data-undo-rm]"); (u.tap if mobile else u.click)(); pg.wait_for_timeout(350)
        ok(ev("RQ.shop.cartLines().map((l) => l.product.handle)") == LOOK + ["sand-keramikvas"], f"{tag} drawer: Ångra puts the thing back in its place")
        ev("RQ.shop.clearCart(); RQ.shop.addToCart('sand-keramikvas::0', 2)"); pg.wait_for_timeout(200)
        ok(ev("document.querySelector('#cart .fsm').innerText").startswith("1 kr") and ev("document.querySelector('#cart .fsm-bar i').style.width") != "100%", f"{tag} drawer: the meter is not full while 1 kr is left")
        ok("Totalt 847 kr" in foot(), f"{tag} drawer: total with shipping to a pickup point (798 + 49)")
        ev("RQ.shop.setQty('sand-keramikvas::0', 99)"); pg.wait_for_timeout(200)
        ok(ev("document.querySelector('#cart .line [data-d=\"1\"]').disabled"), f"{tag} drawer: plus rests at 99")
        pg.go_back(); pg.wait_for_timeout(450)
        ok(ev(STATE) == ["butik", "", ""], f"{tag} Back closes the cart: {ev(STATE)}")

        # ------------------------------------------------------------ picture viewer and Back
        pg.goto(BASE + "produkt-sand-keramikvas/"); pg.wait_for_timeout(500)
        g = pg.locator("#pgGrid .pg-item").first; (g.tap if mobile else g.click)(); pg.wait_for_timeout(450)
        ok(ev("document.querySelector('.lb').classList.contains('open')"), f"{tag} the picture viewer opens")
        pg.go_back(); pg.wait_for_timeout(450)
        ok(not ev("document.querySelector('.lb').classList.contains('open')") and "produkt-sand-keramikvas" in pg.url, f"{tag} Back closes the picture viewer and stays on the product")

        # ------------------------------------------------------------ checkout
        ev("(l) => { RQ.shop.clearCart(); l.forEach((h) => RQ.shop.addToCart(h + '::0', 1)); location.hash = '#kassa'; }", LOOK); pg.wait_for_timeout(700)
        geo = ev("(() => { const a = document.getElementById('coSum').getBoundingClientRect(), f = document.getElementById('co').getBoundingClientRect(), s = document.querySelector('#co button[type=submit]').getBoundingClientRect(), t = document.querySelector('.co-final'); return { aTop: a.top + scrollY, aBottom: a.bottom, fTop: f.top + scrollY, sTop: s.top + scrollY, fin: getComputedStyle(t).display, finTop: t.getBoundingClientRect().top + scrollY, mini: document.querySelector('.co-mini').innerText.replace(/\\s+/g, ' ') }; })()")
        if mobile:
            ok(geo["aTop"] < geo["fTop"] and "2 418 kr" in geo["mini"].replace(" ", " "), f"{tag} checkout: the total is above the form on a phone: {geo['mini']}")
            ok(geo["fin"] != "none" and geo["finTop"] < geo["sTop"], f"{tag} checkout: Totalt stands right above the order button")
        else:
            ev("scrollTo(0, 600)"); pg.wait_for_timeout(200)
            sb = ev("(() => { const a = document.getElementById('coSum').getBoundingClientRect(), t = document.querySelector('#coSum .sum.total').getBoundingClientRect(); return [a.top, a.bottom, t.bottom]; })()")
            ok(sb[0] >= 0 and sb[1] <= Hh and sb[2] <= Hh, f"{tag} checkout: the summary stays beside the form and fits a 720 px high window with its total: {sb}")
            ev("scrollTo(0, 0)")
            ok(ev("(() => { const t = document.querySelector('#nav .tools').getBoundingClientRect(); return innerWidth - t.right < 120; })()"), f"{tag} checkout: the header icons are to the right")
        ok(ev("document.querySelector('#coSum [data-co=ship]').textContent") == "Fri", f"{tag} checkout: free shipping reads Fri, not 0 kr")
        ok(ev("!!document.querySelector('.crumbs [data-open-cart]')"), f"{tag} checkout: the Varukorg crumb opens the cart")
        sub = lambda: (ev("document.querySelector('#co button[type=submit]').scrollIntoView({block:'center'})"), tap("#co button[type=submit]"), pg.wait_for_timeout(700))
        sub()
        e1 = ev("(() => { const a = document.activeElement, b = document.getElementById('coe-email').getBoundingClientRect(); return { focus: a.name, bad: [...document.querySelectorAll('#co [aria-invalid=true]')].map((x) => x.name), seen: b.top > 0 && b.bottom < innerHeight, desc: a.getAttribute('aria-describedby'), status: document.getElementById('coStatus').textContent }; })()")
        ok(e1["bad"] == ["email", "first", "last", "street", "zip", "city", "terms"], f"{tag} checkout: every faulty field is marked at once: {e1['bad']}")
        ok(e1["focus"] == "email" and e1["seen"] and e1["desc"] == "coe-email", f"{tag} checkout: the first faulty field has the focus and its message is on screen")
        for k, v in (("email", "anna@exempel.se"), ("phone", "abc"), ("first", "Anna"), ("last", "Ek"), ("street", "Storgatan 1"), ("zip", "12 345"), ("city", "Umeå")):
            pg.fill(f"#co [name={k}]", v)
        ev("document.querySelector('#co [name=terms]').click()")
        sub()
        ok(ev("[...document.querySelectorAll('#co [aria-invalid=true]')].map((x) => x.name)") == ["phone"] and ev("document.activeElement.name") == "phone", f"{tag} checkout: phone 'abc' is not accepted, '12 345' is")
        pg.fill("#co [name=phone]", "070 123 45 67")
        ev("document.querySelector('#co [name=terms]').click()"); sub()
        ok(ev("document.activeElement.name") == "terms" and ev("!document.getElementById('coe-terms').hidden"), f"{tag} checkout: unticked terms put the focus on the box")
        ev("document.querySelector('#co [name=terms]').click(); document.querySelector('#co [name=ship][value=hem]').click()")
        ev("RQ.shop.setQty('glod-doftljus-keramik::0', 0)"); pg.wait_for_timeout(250)
        shown = ev("document.querySelector('#coSum .co-sums [data-co=total]').textContent").replace(" ", " ")
        ok(shown == "2 427 kr" and "−269" not in ev("document.getElementById('coSum').innerText"), f"{tag} checkout: the summary follows the cart (2 338 + 89): {shown}")
        sub(); pg.wait_for_timeout(400)
        o = ev("RQ.shop.orders()[0]")
        ok(o["total"] == 2427 and o["address"]["zip"] == "123 45", f"{tag} checkout: the order is what the page showed (2 427 kr, postcode 123 45)")
        tack = ev("document.getElementById('view').innerText.replace(/\\s+/g, ' ')").replace(" ", " ")
        ok(all(x in tack for x in ("Levereras till", "Storgatan 1", "Leveranssätt", "Hemleverans", "Delsumma 2 338 kr", "Frakt 89 kr", "Totalt 2 427 kr", "Fortsätt handla")), f"{tag} thank-you: address, delivery and the sums are on the receipt")
        ok("30 dagars öppet köp" in tack and "14 dagars ångerrätt" in tack and tack.count("Följ beställningen") == 1, f"{tag} thank-you: one sentence about returns, one set of buttons")
        pg.goto(BASE + "angra/"); pg.wait_for_timeout(500)
        ok("30 dagars öppet köp från att du tog emot varan. Lagen ger alltid 14 dagars ångerrätt." in ev("document.getElementById('view').innerText"), f"{tag} angra: the same sentence about the return window")

        # ------------------------------------------------------------ forms answer at the field
        pg.goto(BASE + "kontakt/"); pg.wait_for_timeout(500)
        ev("document.querySelector('#contactForm button[type=submit]').scrollIntoView({block:'center'})"); tap("#contactForm button[type=submit]"); pg.wait_for_timeout(250)
        ok(ev("[...document.querySelectorAll('#contactForm [aria-invalid=true]')].map((x) => x.name)") == ["name", "email", "msg"] and ev("document.activeElement.name") == "name", f"{tag} contact: each empty field is marked, the first has the focus")
        ev("document.getElementById('newsForm').scrollIntoView({block:'center'})"); tap("#newsForm button"); pg.wait_for_timeout(250)
        ok(ev("document.getElementById('newsStatus').textContent").startswith("Skriv din e-post") and not ev("document.getElementById('toast').classList.contains('show')"), f"{tag} newsletter: the answer is under the field, not in a toast")

        # ------------------------------------------------------------ phone only: dock, footer, card buttons, lists
        if mobile:
            pg.goto(BASE + "butik/"); pg.wait_for_timeout(500)
            ok(float(ev("getComputedStyle(document.querySelector('#dock a')).fontSize").replace("px", "")) >= 12, f"{tag} dock: labels are 12 px")
            hit = ev("(() => { scrollTo(0, 420); const c = document.querySelector('#results .card'), f = c.querySelector('.fav').getBoundingClientRect(), r = c.querySelector('.rbtn').getBoundingClientRect(); const at = (x, y) => { const e = document.elementFromPoint(x, y); return e && e.closest('button') ? e.closest('button').className : ''; }; return [at(f.left + 18, f.top - 3), at(r.left + 18, r.bottom + 3), r.top - f.bottom]; })()")
            ok("fav" in hit[0] and "rbtn" in hit[1] and hit[2] >= 4, f"{tag} cards: heart and room answer to 44 px and stand apart: {hit}")
            ev("scrollTo(0, 99999)"); pg.wait_for_timeout(700)
            end = ev("(() => { const f = document.querySelector('footer.site').getBoundingClientRect(), l = document.querySelector('footer.site .bottom').getBoundingClientRect(), d = document.getElementById('dock'); return [Math.round(innerHeight - f.bottom), d.classList.contains('away'), l.bottom <= d.getBoundingClientRect().top]; })()")
            ok(end[0] <= 1 and not end[1] and end[2], f"{tag} page end: the footer reaches the bottom, the dock is back and covers no link: {end}")
            pg.goto(BASE + "rum-vardagsrum/"); pg.wait_for_timeout(500)
            ok(ev("(() => { const l = document.querySelector('ol.numbered li'); return getComputedStyle(l, '::before').content !== 'none' && l.getBoundingClientRect().left >= 19; })()"), f"{tag} room page: the numbered tips stay inside the column")
        ok(not errs, f"{tag} no script errors: {errs[:2]}")
        ctx.close()

    # 360 px: nothing clipped in the cookie bar or the checkout delivery prices
    ctx = b.new_context(viewport={"width": 360, "height": 740}, has_touch=True, is_mobile=True, user_agent=UA)
    ctx.route(re.compile(r"^https?://(?!127\.0\.0\.1)"), lambda r: r.abort())
    pg = ctx.new_page(); pg.goto(BASE + "butik/"); pg.wait_for_timeout(1700)
    ok(pg.evaluate("[...document.querySelectorAll('#cookie .row button')].every((x) => x.scrollWidth <= x.clientWidth)"), "[360] cookie bar: no button text is clipped")
    pg.evaluate("document.getElementById('ckNeed').click(); RQ.shop.addToCart('sand-keramikvas::0', 1); location.hash = '#kassa'"); pg.wait_for_timeout(700)
    ok(pg.evaluate("[...document.querySelectorAll('.ship-opt .so-p')].every((x) => x.getBoundingClientRect().height < 30) && document.documentElement.scrollWidth <= innerWidth"), "[360] checkout: delivery prices stay on one line, nothing outside the screen")
    ctx.close()

    # evening: fields keep a visible edge
    ctx = b.new_context(viewport={"width": 390, "height": 844})
    ctx.route(re.compile(r"^https?://(?!127\.0\.0\.1)"), lambda r: r.abort())
    pg = ctx.new_page(); pg.add_init_script("try { localStorage.setItem('rumiq-ljus', 'kvall') } catch (e) {}")
    pg.goto(BASE + "kontakt/"); pg.wait_for_timeout(500)
    c = pg.evaluate("(() => { const i = document.querySelector('#contactForm input'); const cv = document.createElement('canvas').getContext('2d'); const px = (col) => { cv.fillStyle = '#000'; cv.fillRect(0, 0, 1, 1); cv.fillStyle = getComputedStyle(i).backgroundColor; cv.fillRect(0, 0, 1, 1); cv.fillStyle = col; cv.fillRect(0, 0, 1, 1); return [...cv.getImageData(0, 0, 1, 1).data].slice(0, 3); }; const lum = (c) => { const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); }; const a = lum(px(getComputedStyle(i).borderTopColor)), b2 = lum(px('rgba(0,0,0,0)')); return (Math.max(a, b2) + .05) / (Math.min(a, b2) + .05); })()")
    ok(c >= 2, f"[evening] field edges stand out from the field ({c:.2f}:1)")
    ctx.close()
    b.close()

srv.shutdown()
print(f"{n - len(fails)} of {n} checks passed")
sys.exit(1 if fails else 0)
