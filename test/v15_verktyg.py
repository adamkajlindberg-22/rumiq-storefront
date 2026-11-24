#!/usr/bin/env python3
"""v15 checks for Svep, Hitta rätt, the stylist, Looks, Mitt hem, the account pages and the forms.
Run after `python3 tools/build.py`:  python3 test/v15_verktyg.py
Own in-process server; everything outside 127.0.0.1 is blocked, as in the sandbox."""
import http.server, json, re, socketserver, sys, threading
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
# the auth layer treats 127.0.0.1 as a developer's machine (demo sign-in); "strict" makes it behave as on the live site
STRICT = "Object.defineProperty(window, 'RQ_CONFIG', { configurable: true, set(v) { if (v && v.auth) v.auth.strict = true; Object.defineProperty(window, 'RQ_CONFIG', { value: v, writable: true, configurable: true }); }, get() { return undefined; } });"
TOAST = "document.getElementById('toast').textContent"
CARD = "(() => { const c = [...document.querySelectorAll('#svDeck .sv-card')].pop(); if (!c) return null; const r = c.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.width, r.height, c.dataset.h]; })()"
COUNT = "(document.getElementById('svCount') || {}).textContent"
QTY = "RQ.shop.cartLines().reduce((s, l) => s + l.quantity, 0)"


def new(b, mobile, strict=False, w=None, h=None):
    kw = dict(viewport={"width": w or 390, "height": h or 844}, device_scale_factor=2, is_mobile=True, has_touch=True, user_agent=UA) if mobile else dict(viewport={"width": w or 1440, "height": h or 900})
    ctx = b.new_context(locale="sv-SE", **kw)
    ctx.route(re.compile(r"^https?://(?!127\.0\.0\.1)"), lambda r: r.abort())
    if strict:
        ctx.add_init_script(STRICT)
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    return ctx, pg, errs


def go(pg, route, wait=700):
    pg.goto(BASE + (route + "/" if route else ""), wait_until="load")
    pg.wait_for_timeout(wait)
    pg.evaluate("document.getElementById('ckNeed') && document.getElementById('ckNeed').click()")
    pg.evaluate("RQ.loadTools && RQ.loadTools()")
    pg.wait_for_timeout(200)


def swipe(cdp, pg, x0, y0, x1, y1, ms=180, steps=10):
    ev = lambda t, pts: cdp.send("Input.dispatchTouchEvent", {"type": t, "touchPoints": [{"x": x, "y": y, "id": 1} for x, y in pts]})
    ev("touchStart", [(x0, y0)])
    for i in range(1, steps + 1):
        pg.wait_for_timeout(ms / steps)
        ev("touchMove", [(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps)])
    ev("touchEnd", [])


def finish_round(pg, pattern="YNY"):
    k = 0
    while pg.evaluate("!!document.querySelector('#svDeck .sv-card')") and k < 30:
        pg.evaluate("document.getElementById('%s').click()" % ("svYes" if pattern[k % len(pattern)] == "Y" else "svNo"))
        pg.wait_for_timeout(300)
        k += 1
    pg.wait_for_timeout(400)


with sync_playwright() as p:
    b = p.chromium.launch()

    # ------------------------------------------------------------ Svep on a phone
    for w, h in ((390, 844), (360, 740)):
        tag = f"[svep {w}]"
        ctx, pg, errs = new(b, True, w=w, h=h)
        cdp = ctx.new_cdp_session(pg)
        go(pg, "svep", 900)
        g = pg.evaluate("(() => { const r = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return [b.top, b.bottom]; }; return { count: r('#svCount'), ctrl: r('#svCtrl'), dock: r('.dock') }; })()")
        ok(g["count"][1] < g["dock"][0] and g["ctrl"][1] <= g["dock"][0] + 1, f"{tag} counter and buttons are above the dock: {g}")
        # a scroll gesture upwards never buys, at any speed
        for dist, ms in ((260, 200), (300, 90), (150, 120), (260, 400)):
            pg.evaluate("scrollTo(0, 0)"); pg.wait_for_timeout(200)
            c = pg.evaluate(CARD); q0 = pg.evaluate(QTY); c0 = pg.evaluate(COUNT)
            swipe(cdp, pg, c[0], c[1] + 50, c[0] + 4, c[1] + 50 - dist, ms=ms); pg.wait_for_timeout(600)
            ok(pg.evaluate(QTY) == q0 and pg.evaluate(COUNT) == c0, f"{tag} finger up {dist}px in {ms}ms: nothing in the cart, same card")
        pg.evaluate("scrollTo(0, 0)"); pg.wait_for_timeout(300)
        ok(pg.evaluate("[...document.querySelectorAll('#svDeck .sv-card')].pop().style.transform") == "", f"{tag} the card is back in place after a cancelled gesture")
        c = pg.evaluate(CARD); pg.touchscreen.tap(c[0], c[1]); pg.wait_for_timeout(800)
        ok(pg.evaluate("RQ.sheet.isOpen()"), f"{tag} a tap in the middle opens the product and it stays open")
        pg.evaluate("RQ.sheet.close()"); pg.wait_for_timeout(500)
        c = pg.evaluate(CARD); swipe(cdp, pg, c[0], c[1], c[0] + 200, c[1] + 8); pg.wait_for_timeout(600)
        ok(pg.evaluate(COUNT) == "2 av 10" and pg.evaluate("RQ.shop.wishlist().length") == 1, f"{tag} swipe right saves")
        c = pg.evaluate(CARD); swipe(cdp, pg, c[0], c[1], c[0] - 200, c[1] + 8); pg.wait_for_timeout(600)
        ok(pg.evaluate(COUNT) == "3 av 10", f"{tag} swipe left skips")
        c = pg.evaluate(CARD); swipe(cdp, pg, c[0], c[1], c[0] + 60, c[1] + 4, ms=260); pg.wait_for_timeout(600)
        ok(pg.evaluate(COUNT) == "3 av 10", f"{tag} a half swipe snaps back")
        pg.evaluate("document.getElementById('svBag').click()"); pg.wait_for_timeout(600)
        ok(pg.evaluate(QTY) == 1, f"{tag} the bag button puts the card in the cart")
        while pg.evaluate(COUNT) not in ("6 av 10", None): pg.evaluate("document.getElementById('svNo').click()"); pg.wait_for_timeout(320)
        soon = pg.evaluate("(() => { const c = [...document.querySelectorAll('#svDeck .sv-card')].pop(); if (!c.classList.contains('soon')) return null; const r = c.getBoundingClientRect(); return [[...c.querySelector('.sv-soon').children].every((k) => { const b = k.getBoundingClientRect(); return b.top >= r.top - 1 && b.bottom <= r.bottom + 1; }), document.getElementById('svBag').disabled]; })()")
        ok(soon and soon[0] and soon[1], f"{tag} 'Kommer snart' fits inside its card and cannot be bought: {soon}")
        finish_round(pg)
        ok(pg.evaluate("!!document.querySelector('.svep-result')"), f"{tag} a round ends in the style profile")
        pg.reload(); pg.wait_for_timeout(900)
        ok(pg.evaluate("!!document.querySelector('.svep-result') && document.querySelectorAll('.sv-liked button').length > 0"), f"{tag} the profile is still there after a reload")
        if w == 390:
            pg.evaluate("document.getElementById('svRoomAll').click()"); pg.wait_for_timeout(700)
            ok("/svep/" in pg.url and pg.evaluate("!!document.querySelector('.sheet.open, dialog[open]')"), f"{tag} 'Se dem i ditt rum' without a room asks for a room first")
            pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
            q0 = pg.evaluate(QTY); pg.evaluate("const x = document.getElementById('svAll'); x.click(); x.click();"); pg.wait_for_timeout(300)
            ok(pg.evaluate(QTY) - q0 == pg.evaluate("document.querySelectorAll('.sv-liked button').length"), f"{tag} a double tap on 'Lägg alla' adds each thing once")
            h0 = pg.evaluate("history.length"); pg.evaluate("document.getElementById('svMore').click()"); pg.wait_for_timeout(600)
            ok(pg.evaluate("history.length") == h0 and pg.evaluate(COUNT) == "1 av 10", f"{tag} a new round does not add pages to the history")
            finish_round(pg)
            pg.evaluate("document.getElementById('svAgain').click()"); pg.wait_for_timeout(200)
            ok(pg.evaluate("RQ.taste.get().n") > 0, f"{tag} 'Börja om' asks before it resets")
            pg.evaluate("document.getElementById('svAgain').click()"); pg.wait_for_timeout(600)
            ok(pg.evaluate("RQ.taste.get().n") == 0 and pg.evaluate("RQ.shop.style()") is None, f"{tag} 'Börja om' resets the profile and the saved style together")
            go(pg, "svep-rum-uteliv", 700)
            ok(pg.evaluate("(() => { const c = document.querySelector('.sv-scope [aria-current]').getBoundingClientRect(); return c.left >= 0 && c.right <= innerWidth; })()"), f"{tag} the chosen room chip is scrolled into view")
        ok(not errs, f"{tag} no script errors: {errs[:2]}")
        ctx.close()

    # ------------------------------------------------------------ Svep on desktop
    ctx, pg, errs = new(b, False)
    go(pg, "svep", 900)
    for i in range(4): pg.keyboard.press("ArrowRight")
    pg.wait_for_timeout(1600)
    ok(pg.evaluate(COUNT) == "5 av 10", f"[svep desktop] four quick arrow keys swipe four cards: {pg.evaluate(COUNT)}")
    c = pg.evaluate(CARD); pg.mouse.move(c[0], c[1]); pg.mouse.down(); pg.mouse.move(c[0], c[1] - 180, steps=8); pg.wait_for_timeout(300); pg.mouse.up(); pg.wait_for_timeout(800)
    ok(pg.evaluate(QTY) == 1, "[svep desktop] dragging a card upwards with the mouse still puts it in the cart")
    pg.evaluate("document.querySelector('[data-open-cart]').click()"); pg.wait_for_timeout(500); c0 = pg.evaluate(COUNT); pg.keyboard.press("ArrowRight"); pg.wait_for_timeout(500)
    ok(pg.evaluate(COUNT) == c0, "[svep desktop] arrow keys do not swipe behind the open cart")
    ctx.close()
    ctx, pg, errs = new(b, False)
    pg.add_init_script("try { localStorage.setItem('rumiq-ljus', JSON.stringify('kvall')); } catch (e) {}")
    go(pg, "svep", 900)
    kbd = pg.evaluate("(() => { const k = document.querySelector('.sv-legend kbd'), cs = getComputedStyle(k); return [cs.backgroundColor, cs.color]; })()")
    ok(kbd[0] != "rgb(255, 255, 255)" and kbd[0] != kbd[1], f"[svep desktop, evening] the arrows in the legend are readable: {kbd}")
    ctx.close()

    # ------------------------------------------------------------ Hitta rätt, stylist, looks, Mitt hem: phone and desktop
    for mobile in (True, False):
        tag = "[390]" if mobile else "[1440]"
        ctx, pg, errs = new(b, mobile)
        go(pg, "hitta-ratt", 800)
        pg.click("[data-q=room] button[data-v=vardagsrum]"); pg.wait_for_timeout(300)
        pg.click("[data-q=need] button[data-v=ljus]"); pg.wait_for_timeout(1300)
        top = pg.evaluate("document.getElementById('gOut').getBoundingClientRect().top")
        ok(pg.evaluate("document.querySelectorAll('#gOut .card').length") > 0 and 0 <= top < pg.evaluate("innerHeight") * 0.5, f"{tag} Hitta rätt: the second answer shows the result on screen (top {top:.0f})")
        pg.evaluate("document.querySelector('#gOut .card a[href*=produkt]').click()"); pg.wait_for_timeout(800); pg.go_back(); pg.wait_for_timeout(1000)
        ok(pg.evaluate("document.querySelectorAll('[data-q] [aria-pressed=true]').length") == 2 and pg.evaluate("document.querySelectorAll('#gOut .card').length") > 0, f"{tag} Hitta rätt: answers and result are still there after looking at a product")
        wrong = pg.evaluate("""() => { const out = []; RQ.ROOMS.forEach((r) => Object.keys(RQ.NEEDS).forEach((n) => { sessionStorage.setItem('rumiq-guide', JSON.stringify({ room: r.id, need: n, max: null })); RQ.router(); const o = document.getElementById('gOut'); const exact = RQ.PRODUCTS.some((p) => p.rooms.includes(r.id) && p.needs.includes(n)); if (exact === /Vi har inget för just/.test(o.innerText) || !o.querySelector('.card')) out.push(r.id + '+' + n); })); sessionStorage.removeItem('rumiq-guide'); return out; }""")
        ok(not wrong, f"{tag} Hitta rätt: all 28 combinations show products, and say so when none fits exactly: {wrong}")
        pg.evaluate("sessionStorage.setItem('rumiq-guide', JSON.stringify({ room: 'sovrum', need: 'ljus', max: 50 })); RQ.router()"); pg.wait_for_timeout(300)
        ok("Inget under" in pg.evaluate("document.getElementById('gOut').innerText") and pg.evaluate("!!document.getElementById('gNoMax')"), f"{tag} Hitta rätt: a too low maximum price says so and offers to drop it")
        pg.evaluate("sessionStorage.removeItem('rumiq-guide')")
        go(pg, "hitta-ratt-present", 800)
        pg.evaluate("document.getElementById('gfGo').click()"); pg.wait_for_timeout(300)
        ok(pg.evaluate("document.getElementById('gfOut').innerText").strip() == "" and "Välj" in pg.evaluate(TOAST), f"{tag} gift tab: nothing chosen asks for a choice instead of 'Inget passar'")
        pg.click("[data-q=for] button[data-v=van]"); pg.click("[data-q=occ] button[data-v=inflyttning]"); pg.evaluate("document.getElementById('gfGo').click()"); pg.wait_for_timeout(1200)
        head = pg.evaluate("document.querySelector('#gfOut .eyebrow').innerText"); cards = pg.evaluate("document.querySelectorAll('#gfOut .card').length")
        ok(re.search(r"De\s+%d\s+bästa av\s+\d+" % cards, head) is not None or re.match(r"^%d\s+förslag" % cards, head) is not None, f"{tag} gift tab: the number in the heading is the number shown: {head!r} / {cards}")
        ok(0 <= pg.evaluate("document.getElementById('gfOut').getBoundingClientRect().top") < pg.evaluate("innerHeight") * 0.5, f"{tag} gift tab: the result is scrolled into view")
        go(pg, "hitta-ratt-ord", 800)
        box = pg.evaluate("(() => { const f = document.getElementById('ssForm'), cs = getComputedStyle(f); return [parseFloat(cs.paddingTop), parseFloat(cs.borderTopLeftRadius)]; })()")
        ok(box[0] >= 12 and box[1] >= 8, f"{tag} Med egna ord: the box has padding and round corners: {box}")
        first = lambda: pg.evaluate("[...document.querySelectorAll('#ssOut .card a[href*=produkt]')].map(a => a.getAttribute('href').replace(/^.*produkt-/, '').replace(/\\/$/, '')).filter((v, i, a) => a.indexOf(v) === i)")
        ask = lambda q: (pg.fill("#ssIn", q), pg.evaluate("document.getElementById('ssForm').requestSubmit()"), pg.wait_for_timeout(500))
        ask("lampa"); f3 = first()[:3]
        ok(all("lampa" in x for x in f3), f"{tag} Med egna ord: 'lampa' shows the lamps first: {f3}")
        ask("lmpa")
        ok(len(first()) > 0 and "lampa" in pg.evaluate("document.getElementById('ssOut').innerText"), f"{tag} Med egna ord: 'lmpa' is read as 'lampa'")
        ask("en matta")
        ok(first()[:1] == ["strand-jutematta"], f"{tag} Med egna ord: 'en matta' shows the rug first: {first()[:2]}")
        ask("")
        ok(pg.evaluate("document.getElementById('ssOut').innerText").strip() == "" and pg.evaluate("document.activeElement.id") == "ssIn", f"{tag} Med egna ord: an empty question focuses the field, no 'hittade inget'")

        # the stylist
        go(pg, "studio-stylist", 900)
        g = pg.evaluate("(() => { const i = document.getElementById('chatIn').getBoundingClientRect(), d = document.querySelector('.dock'); const dt = d && getComputedStyle(d).display !== 'none' && d.getBoundingClientRect().height ? d.getBoundingClientRect().top : innerHeight; return [i.bottom, dt]; })()")
        ok(g[0] <= g[1], f"{tag} stylist: the field you write in is on the first screen, above the dock: {g}")
        say = lambda q: (pg.fill("#chatIn", q), pg.press("#chatIn", "Enter"), pg.wait_for_timeout(1000))
        last = "(() => { const m = [...document.querySelectorAll('#log .msg.ai')].pop(); return [m.innerText, m.querySelectorAll('.mini a').length, [...m.querySelectorAll('a')].map(a => a.getAttribute('href'))]; })()"
        say("Vad kostar frakten och hur lång är leveranstiden?"); a = pg.evaluate(last)
        ok(a[1] == 0 and any("frakt" in (x or "") for x in a[2]), f"{tag} stylist: a delivery question gets the delivery page, not products: {a[0][:60]!r}")
        say("Vad tycker du om fotboll?"); a = pg.evaluate(last)
        ok(a[1] == 0 and "kan jag inte svara" in a[0], f"{tag} stylist: says so when it does not understand: {a[0][:60]!r}")
        say("<b>x</b><img src=x onerror=window.__x=1>"); pg.wait_for_timeout(200)
        ok(pg.evaluate("window.__x") is None and not pg.evaluate("!!document.querySelector('#log .msg.me b')"), f"{tag} stylist: typed markup stays text")
        say("En lampa till sovrummet"); a = pg.evaluate(last)
        ok(a[1] == 3 and pg.evaluate("[...[...document.querySelectorAll('#log .msg.ai')].pop().querySelectorAll('.mini a span')].every(s => /lampa/i.test(s.textContent))"), f"{tag} stylist: asked for a lamp, the three suggestions are lamps")
        ok(pg.evaluate("(() => { const i = document.getElementById('chatIn').getBoundingClientRect(); return i.top >= 0 && i.bottom <= innerHeight; })()"), f"{tag} stylist: the field is still on screen after several answers")
        ok(not pg.evaluate("(() => { const a = [...[...document.querySelectorAll('#log .msg.ai')].pop().querySelectorAll('.mini a')]; return a.some((x) => x.scrollWidth > x.clientWidth + 1); })()"), f"{tag} stylist: product names stay inside their columns")
        pg.evaluate("document.getElementById('maxP').value = '100'"); say("Jag behöver mjukare ljus"); a = pg.evaluate(last)
        ok(a[1] == 0 and "Det billigaste kostar" in a[0] and "Billigare" not in a[0], f"{tag} stylist: nothing under the price is said plainly, with the cheapest price")

        # looks
        go(pg, "looks", 800)
        ok("10 %" in pg.evaluate("document.querySelector('.page-head .lead').innerText") and pg.evaluate("!!document.querySelector('.lc-row s')"), f"{tag} looks: the discount is said on the list and the full price is struck through")
        pg.evaluate("document.querySelector('[data-look-add=spa-hemma]').click()"); pg.wait_for_timeout(1900); pg.evaluate("document.querySelector('[data-look-add=spa-hemma]').click()"); pg.wait_for_timeout(300)
        ok(pg.evaluate(QTY) == 3, f"{tag} looks: buying the same look twice adds it once ({pg.evaluate(QTY)})")
        pg.evaluate("RQ.shop.cartLines().forEach(l => RQ.shop.setQty(l.id, 0))")
        go(pg, "look-sov-gott", 800)
        ok(pg.evaluate("[...document.querySelectorAll('.lp-stage .hs')].every(h => RQ.LOOKS.find(l => l.id === 'sov-gott').items.includes(h.dataset.hs))"), f"{tag} look page: every dot in the picture belongs to the look")
        for i in range(3): pg.evaluate("(i) => document.querySelectorAll('.lp-item [data-add]')[i].click()", i); pg.wait_for_timeout(250)
        ok("3" in pg.evaluate("document.getElementById('lpBuy').innerText") and "369" in pg.evaluate("document.getElementById('lpBuy').innerText"), f"{tag} look page: with three of four in the cart it says what the last one saves")
        ok(not pg.evaluate("[...document.querySelectorAll('.lp-item')].some(r => r.scrollWidth > r.clientWidth + 1)"), f"{tag} look page: the 'added' state stays inside its row")
        pg.wait_for_timeout(1900); pg.evaluate("document.querySelector('#lpBuy [data-look-add]').click()"); pg.wait_for_timeout(500)
        ok(pg.evaluate(QTY) == 4 and pg.evaluate("RQ.shop.cartDiscount()") == 369, f"{tag} look page: completing a look adds only what is missing and gives the discount")
        ok(pg.evaluate("!!document.querySelector('#lpBuy [data-open-cart]')"), f"{tag} look page: a look that is in the cart offers the cart, not a second copy")
        pg.evaluate("document.querySelector('[data-look-save]').click(); document.querySelector('[data-look-save]').click()"); pg.wait_for_timeout(300); pg.reload(); pg.wait_for_timeout(800)
        ok(pg.evaluate("RQ.shop.looks().length") == 1 and pg.evaluate("document.querySelector('[data-look-save]').disabled"), f"{tag} look page: a saved look is saved once and stays marked after a reload")
        go(pg, "looks", 800)
        ok(pg.evaluate("!!document.querySelector('.mylooks [data-look-buy]')"), f"{tag} looks: your saved looks are shown on the Looks page and can be bought")
        go(pg, "upptack", 900)
        j = pg.evaluate("(() => { const s = document.querySelector('.journey').getBoundingClientRect(); return [s.top + scrollY, s.height]; })()")
        hit = False
        for fr in (0.3, 0.6, 0.9):
            pg.evaluate("(y) => scrollTo(0, y)", j[0] + j[1] * fr - 400); pg.wait_for_timeout(450)
            hit = hit or pg.evaluate("(() => { const c = document.querySelector('.jr-cap-after .hs-cap'); if (!c || getComputedStyle(c.parentNode).display === 'none') return false; const r = c.getBoundingClientRect(), o = document.querySelector('.jr-room.on .jr-copy').getBoundingClientRect(), im = document.querySelector('.jr-room.on .jr-img').getBoundingClientRect(); const over = (x) => r.top < x.bottom && r.bottom > x.top; return r.bottom > 0 && r.top < innerHeight && (over(o) || over(im)); })()")
        ok(not hit, f"{tag} Upptäck: the note about the pictures never lies over a room")

        # Mitt hem, Sparat, shared list, clear all
        go(pg, "mitt-hem", 800)
        ok(pg.evaluate("document.querySelectorAll('#view .empty').length") == 0 and pg.evaluate("document.getElementById('hrForm').hidden"), f"{tag} Mitt hem: an empty page has no big empty boxes and the room form waits behind a button")
        pg.click("#hrOpen"); pg.fill("#hrForm [name=floorW]", "tre meter"); pg.evaluate("document.getElementById('hrForm').requestSubmit()"); pg.wait_for_timeout(300)
        ok(pg.evaluate("RQ.homeRooms.list().length") == 0 and "siffror" in pg.evaluate("document.getElementById('hrStatus').textContent"), f"{tag} Mitt hem: a measure that cannot be read is said, not dropped")
        pg.evaluate("window.__x = 0"); pg.fill("#hrForm [name=floorW]", "350"); pg.fill("#hrForm [name=label]", "<img src=x onerror=__x=1>"); pg.evaluate("document.getElementById('hrForm').requestSubmit()"); pg.wait_for_timeout(600)
        ok(pg.evaluate("__x") == 0 and pg.evaluate("RQ.homeRooms.list().length") == 1, f"{tag} Mitt hem: a room name is text in the toast")
        pg.evaluate("RQ.PRODUCTS.slice(0, 5).forEach(p => RQ.shop.toggleWish(p.handle)); localStorage.setItem('rumiq-style', JSON.stringify({ style: 'finns-inte' }))")
        go(pg, "mitt-hem", 800)
        ok(pg.evaluate("!!document.querySelector('#mh-fav .grid')") and pg.evaluate("document.querySelector('.mh > div').id") == "mh-fav", f"{tag} Mitt hem: draws with an unknown stored style, the saved things come first")
        link = pg.evaluate("new URL('delad/', document.baseURI).href + '#delad-' + RQ.sharedList.enc(RQ.shop.wishlist().map(p => p.handle), '')")
        ok(re.search(r"#delad-[0-9a-z]{4}(\.[0-9a-z]{4}){4}$", link) is not None and pg.evaluate("(l) => RQ.sharedList.dec(l.split('#delad-')[1]).hs.join() === RQ.shop.wishlist().map(p => p.handle).join()", link), f"{tag} shared list: products travel by their own number and come back the same")
        ok(pg.evaluate("RQ.sharedList.dec('4.3.2.1.0').hs.length") == 5, f"{tag} shared list: an older link still opens")
        go(pg, "onskelista", 800)
        ok(pg.evaluate("document.querySelector('h1').textContent.trim()") == "Sparat" and "Sparat" in pg.evaluate("document.querySelector('#mh-fav .eyebrow') ? '' : document.querySelector('[data-tab=fav]').textContent"), f"{tag} one word for saved things: the page is called Sparat")
        pg.dblclick("#allCart"); pg.wait_for_timeout(400)
        ok(pg.evaluate(QTY) == 5, f"{tag} Sparat: a double click on 'Lägg alla' adds five, not ten")
        go(pg, "onska", 800)
        for t in ("Större krukor", "Fler mattor"):
            pg.fill("#ideaForm [name=title]", t); pg.click("#ideaForm button[type=submit]"); pg.wait_for_timeout(400)
        ok(pg.evaluate("RQ.shop.ideas().length") == 2 and pg.evaluate("new Set(RQ.shop.ideas().map(i => i.id)).size") == 2, f"{tag} Önska (direct load): one idea per click, each with its own id")
        pg.evaluate("sessionStorage.setItem('rumiq-chat', '[]'); localStorage.setItem('rumiq-chat-saved', '[]')")
        go(pg, "mitt-hem", 800)
        pg.evaluate("document.getElementById('clearAll').click()"); pg.wait_for_timeout(200)
        ok("varukorgen" in pg.evaluate("document.getElementById('clearNote').textContent") and pg.evaluate("RQ.shop.wishlist().length") == 5, f"{tag} 'Rensa allt' first says what will go")
        pg.evaluate("document.getElementById('clearAll').click()"); pg.wait_for_timeout(500)
        ok(pg.evaluate("!localStorage.getItem('rumiq-chat-saved') && !sessionStorage.getItem('rumiq-chat')"), f"{tag} 'Rensa allt' also removes the conversation with the stylist")
        go(pg, "presentkort", 800)
        ok(pg.evaluate("(() => { const a = document.getElementById('gcEmail').getBoundingClientRect(), b = document.querySelector('#gcForm button').getBoundingClientRect(); return Math.abs(a.top - b.top) < 4 && getComputedStyle(document.querySelector('.gc-card img')).objectFit === 'contain'; })()"), f"{tag} gift card: field and button on one row, the logo keeps its shape")
        go(pg, "artikel-belysning-i-lager", 800)
        lefts = pg.evaluate("['h1', '.prose', '.sec .grid'].map(s => Math.round(document.querySelector(s).getBoundingClientRect().left))")
        ok(len(set(lefts)) == 1 and pg.evaluate("document.querySelector('.crumbs').getBoundingClientRect().height") < 30, f"{tag} article: one left edge, crumbs on one line: {lefts}")
        ok(not errs, f"{tag} no script errors in the walk: {errs[:2]}")
        ctx.close()

    # ------------------------------------------------------------ forms and sign-in when the servers do not answer (as on the live site)
    for mobile in (True, False):
        tag = "[offline 390]" if mobile else "[offline 1440]"
        ctx, pg, errs = new(b, mobile, strict=True)
        reqs = []
        pg.on("request", lambda r: reqs.append(r.url) if "supabase" in r.url else None)
        go(pg, "butik", 800); pg.wait_for_timeout(3500)
        ok(not reqs, f"{tag} an anonymous page view asks the auth server nothing: {len(reqs)}")
        go(pg, "", 900)
        pg.fill("#signup [name=email]", "anna@exempel.se"); pg.evaluate("document.getElementById('signup').requestSubmit()"); pg.wait_for_timeout(1500)
        ok(not pg.evaluate("document.getElementById('formBox').classList.contains('sent')") and "gick inte" in pg.evaluate("document.getElementById('formErr').textContent"), f"{tag} waiting list: a failed request is an error, not 'Tack'")
        go(pg, "onska", 800)
        pg.fill("#voteEmail", "anna@exempel.se"); pg.evaluate("document.getElementById('voteMail').requestSubmit()"); pg.wait_for_timeout(1500)
        ok(not pg.evaluate("document.getElementById('voteMail').classList.contains('sent')") and "gick inte" in pg.evaluate("document.querySelector('#voteMail .nt-err').textContent") and not pg.evaluate("document.querySelector('#voteMail button').disabled"), f"{tag} vote mail: error shown, button free again")
        pg.evaluate("RQ.shop.toggleWish('lin-kuddfodral')"); go(pg, "onskelista", 800)
        pg.fill("form[data-pwatch] input", "anna@exempel.se"); pg.evaluate("document.querySelector('form[data-pwatch]').requestSubmit()"); pg.wait_for_timeout(1500)
        ok(pg.evaluate("localStorage.getItem('rumiq-watch')") is None and "gick inte" in pg.evaluate("document.querySelector('form[data-pwatch] .nt-err').textContent"), f"{tag} price watch: nothing is remembered as watched when the request failed")
        go(pg, "presentkort", 800)
        pg.fill("#gcEmail", "anna@exempel.se"); pg.evaluate("document.getElementById('gcForm').requestSubmit()"); pg.wait_for_timeout(1500)
        ok("gick inte" in pg.evaluate("document.getElementById('gcSt').textContent"), f"{tag} gift card: a failed request is an error")
        go(pg, "konto", 2500)
        ok(pg.evaluate("RQ.auth.mode") == "down" and pg.evaluate("!!document.querySelector('.auth-down')") and pg.evaluate("document.getElementById('authMain').hidden") and not pg.evaluate("!!document.querySelector('.auth-card .note')"), f"{tag} account: 'cannot be reached' instead of a test account")
        ok(pg.evaluate("document.querySelector('h1').textContent.trim()") == "Logga in", f"{tag} account: the heading is 'Logga in'")
        r = pg.evaluate("RQ.auth.sendCode('x@y.se').then(() => 'SENT', (e) => e.message)")
        ok(r != "SENT" and pg.evaluate("RQ.shop.customer()") is None and pg.evaluate("typeof RQ.auth.signInPassword") == "undefined", f"{tag} account: nobody is signed in with a made-up account ({r!r})")
        ctx.close()

    # a server that answers: one request per form however often it is pressed
    ctx, pg, errs = new(b, False)
    posts = []

    def take(route):
        posts.append(1); pg.wait_for_timeout(250); route.fulfill(status=201, body="")

    ctx.route(re.compile(r"supabase\.co/rest/v1/waitlist"), take)
    go(pg, "onska", 800)
    pg.fill("#voteEmail", "anna@exempel.se"); pg.evaluate("const f = document.getElementById('voteMail'); f.requestSubmit(); f.requestSubmit(); f.requestSubmit();"); pg.wait_for_timeout(1500)
    ok(len(posts) == 1 and pg.evaluate("document.getElementById('voteMail').classList.contains('sent')"), f"[forms] three presses are one request, and success is shown when it was one: {len(posts)}")
    ctx.close()

    # tablet: the look page stands in two columns
    ctx, pg, errs = new(b, False, w=820, h=1180)
    go(pg, "look-mjuk-kvall", 800)
    g = pg.evaluate("(() => { const s = document.querySelector('.lp-stage').getBoundingClientRect(), t = document.querySelector('.lp-tx').getBoundingClientRect(), bt = document.querySelector('#lpBuy .btn').getBoundingClientRect(); return [s.right <= t.left + 1, bt.bottom < innerHeight]; })()")
    ok(g[0] and g[1], f"[820] look page: picture and list side by side, the buy button on the first screen: {g}")
    ctx.close()

    # English: the new texts have pairs
    pairs = json.loads((ROOT / "tools/i18n-add/verktyg.json").read_text(encoding="utf-8"))
    ok(len(pairs) > 100 and all(isinstance(v, str) and v for v in pairs.values()), "[en] tools/i18n-add/verktyg.json holds the new pairs")
    b.close()

srv.shutdown()
print(f"{n - len(fails)} of {n} checks passed")
sys.exit(1 if fails else 0)
