#!/usr/bin/env python3
"""v15 checks for the foundation (router, storage, cart core). Run after `python3 tools/build.py`:
python3 test/v15_kod.py
One navigation draws once, pages leave nothing behind on #view, bad storage never stops the site,
the cart only holds whole numbers, "Rensa allt" really clears, Back returns to where you were."""
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
UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
COUNT = """() => { window.__c = {}; for (const k of Object.keys(RQ.views)) { const f = RQ.views[k]; if (typeof f !== 'function') continue;
  const w = function () { __c[k] = (__c[k] || 0) + 1; return f.apply(this, arguments); }; Object.assign(w, f); RQ.views[k] = w; } }"""
SAMPLE = """async (r) => { const im = new Image(); await new Promise((ok) => { im.onload = ok; im.src = 'assets/img/rum/' + r + '-1600.webp'; });
  await RQ.room.saveImage(im, { sample: true, map: r, type: r, name: r }); }"""


def context(b, mobile, **kw):
    if mobile:
        c = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, user_agent=UA, **kw)
    else:
        c = b.new_context(viewport={"width": 1440, "height": 900}, **kw)
    c.route(re.compile(r"^https?://(?!127\.0\.0\.1)"), lambda r: r.abort())
    return c


def go(pg, route, wait=450):
    """Open a route through its "#route" alias, wait until the router has drawn it, then let it settle."""
    pg.evaluate("(r) => { location.hash = '#' + r; }", route)
    try:
        pg.wait_for_function("(r) => RQ.currentRoute() === (r === 'hem' ? '' : r)", arg=route, timeout=4000)
    except Exception:
        pass
    pg.wait_for_timeout(wait)


with sync_playwright() as p:
    b = p.chromium.launch()

    for mobile in (True, False):
        tag = "[390]" if mobile else "[1440]"
        ctx = context(b, mobile)
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(BASE); pg.wait_for_timeout(500)
        pg.evaluate("document.getElementById('ckAll').click()")
        pg.evaluate("RQ.loadTools()"); pg.wait_for_timeout(300)
        pg.evaluate(COUNT)

        # ------------------------------------------------ 1. one navigation, one draw
        go(pg, "butik", 700)
        ok(pg.evaluate("__c.butik") == 1, f"{tag} a hash navigation draws the page once")
        ok(pg.evaluate("location.pathname").endswith("/butik/") and pg.evaluate("location.hash") == "", f"{tag} the address becomes the real path")
        pg.evaluate("__c = {}"); pg.evaluate("document.querySelector('footer a[href$=\"faq/\"], footer a[href=\"#faq\"]').click()"); pg.wait_for_timeout(700)
        ok(pg.evaluate("__c.faq") == 1, f"{tag} a link click draws the page once")
        pg.evaluate("__c = {}"); pg.go_back(); pg.wait_for_timeout(700)
        ok(pg.evaluate("__c.butik") == 1 and pg.evaluate("RQ.currentRoute()") == "butik", f"{tag} Back draws the page once")
        pg.evaluate("window.dataLayer = []; __c = {}"); go(pg, "produkt-lysa-keramiklampa", 700)
        ok(pg.evaluate("(window.dataLayer || []).filter((e) => e.event === 'view_item').length") == 1, f"{tag} one product view is counted once")
        go(pg, "hitta-ratt", 600); go(pg, "butik", 500); pg.evaluate("__c = {}"); go(pg, "hitta-ratt", 600)
        ok(pg.evaluate("__c.findRight") == 1 and pg.evaluate("RQ.currentRoute()") == "hitta-ratt", f"{tag} a tool page opens again after leaving it")

        # ------------------------------------------------ 2. nothing piles up on #view
        pg.evaluate("localStorage.setItem('rumiq-ideas', JSON.stringify([{ id: 'i1', title: 'A', text: '', votes: 1 }]))")
        for i in range(4):
            go(pg, "onska", 350); go(pg, "butik", 350)
        go(pg, "onska", 500)
        pg.evaluate("document.querySelector('[data-idea-vote]').click()"); pg.wait_for_timeout(150)
        ok(pg.evaluate("RQ.shop.ideas().find((i) => i.id === 'i1').votes") == 2, f"{tag} a vote on an idea counts once after five visits")
        before = pg.evaluate("RQ.shop.ideas().length")
        pg.evaluate("(() => { const f = document.getElementById('ideaForm'); f.querySelector('[name=title]').value = 'En idé'; f.requestSubmit(); })()"); pg.wait_for_timeout(200)
        ok(pg.evaluate("RQ.shop.ideas().length") == before + 1, f"{tag} one idea is stored once after five visits")
        for i in range(3):
            go(pg, "onskelista", 350); go(pg, "butik", 350)
        go(pg, "onskelista", 500); pg.evaluate("__c = {}")
        pg.evaluate("document.querySelector('[data-tab=fav]').click()"); pg.wait_for_timeout(300)
        ok(pg.evaluate("__c.onskelista") == 1, f"{tag} a list tab redraws the list once after four visits")
        pg.evaluate(SAMPLE, "vardagsrum")
        pg.evaluate("['lysa-keramiklampa', 'sand-keramikvas'].forEach((h) => RQ.room.add(h, true))")
        go(pg, "mitt-hem", 700); go(pg, "mitt-rum", 800); pg.evaluate("__c = {}")
        if pg.evaluate("!!document.querySelector('#view [data-del]')"):
            pg.evaluate("document.querySelector('#view [data-del]').click()"); pg.wait_for_timeout(300)
            ok(not pg.evaluate("__c.myRoom"), f"{tag} removing a thing in Mitt rum does not redraw the page (no handler left from Mitt hem)")
        ok(not errs, f"{tag} no script errors while walking: {errs[:2]}")
        ctx.close()

    # ------------------------------------------------ 3. bad values in storage never stop a page
    KEYS = "cart wish seen customer style projects articles looks orders ideas lists taste votes notify home watch soon consent lang myroom scene roommode roomlearn ai-consent chat-saved".split()
    PAGES = ["butik", "produkt-lysa-keramiklampa", "mitt-rum", "mitt-hem", "konto", "kassa", "svep", "onska", "onskelista", "studio-stylist", "hem"]
    OTHERS = {"taste", "votes", "notify", "home", "watch", "soon", "myroom", "scene", "roommode", "roomlearn", "ai-consent", "chat-saved"}  # read in other owners' files
    for val in ["null", "{}", "5", "\"x\"", "[null]", "[{}]", "true", "{bad"]:
        ctx = context(b, False)
        ctx.add_init_script("try{" + "".join(f"localStorage.setItem('rumiq-{k}', {json.dumps(val)});" for k in KEYS) + "}catch(e){}")
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(BASE, wait_until="load"); pg.wait_for_timeout(350)
        ok(pg.evaluate("!!(window.RQ && RQ.currentRoute) && RQ.currentRoute() !== null"), f"[storage {val}] the site starts")
        pg.evaluate("RQ.loadTools()"); pg.wait_for_timeout(250)
        dead = []
        for r in PAGES:
            go(pg, r, 230)
            if pg.evaluate("RQ.currentRoute()") != ("" if r == "hem" else r) or not pg.evaluate("!!document.querySelector('#view h1, #view .h1, #view video')"): dead.append(r)
        ok(not dead, f"[storage {val}] every page draws something: {dead}")
        ok(pg.evaluate("(() => { try { RQ.shop.addToCart('lysa-keramiklampa::0', 1); RQ.openCart(); return RQ.shop.cartCount() === 1 && !!document.querySelector('#cart .line'); } catch (e) { return String(e); } })()") is True, f"[storage {val}] the cart works")
        ctx.close()
    # one key at a time, the keys the shop core reads itself: nothing may reach the error page
    CORE = [k for k in KEYS if k not in OTHERS]
    ctx = context(b, False); pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(BASE, wait_until="load"); pg.wait_for_timeout(300); pg.evaluate("RQ.loadTools()"); pg.wait_for_timeout(250)
    crashed = []
    for k in CORE:
        for val in ["null", "{}", "[null]", "[{}]", "5"]:
            pg.evaluate("([k, v]) => { Object.keys(localStorage).filter((x) => /^rumiq-/.test(x)).forEach((x) => localStorage.removeItem(x)); localStorage.setItem('rumiq-' + k, v); }", [k, val])
            for r in {"cart": ["kassa"], "wish": ["onskelista", "mitt-hem"], "seen": ["produkt-lysa-keramiklampa"], "customer": ["konto", "kassa"], "style": ["mitt-hem"], "projects": ["mitt-hem"], "articles": ["mitt-hem"], "looks": ["mitt-hem"], "orders": ["konto", "spara-order"], "ideas": ["onska"], "lists": ["produkt-lysa-keramiklampa", "onskelista"], "consent": ["butik"], "lang": ["butik"]}[k]:
                go(pg, "faq", 120); go(pg, r, 200)
                if pg.evaluate("!!document.getElementById('crashReload')") or pg.evaluate("RQ.currentRoute()") != r: crashed.append(f"{k}={val}@{r}")
    ok(not crashed and not errs, f"[storage] the shop's own keys never reach the error page: {crashed[:6]} {errs[:2]}")
    ctx.close()

    # ------------------------------------------------ 3b. the error page, when a view does throw
    ctx = context(b, True); pg = ctx.new_page(); pg.goto(BASE + "butik/"); pg.wait_for_timeout(400)
    pg.evaluate("RQ.shop.addToCart('lysa-keramiklampa::0', 1); RQ.views.magasin = () => { throw new Error('test'); }; 0")
    go(pg, "magasin", 400)
    ok(pg.evaluate("!!document.getElementById('crashReload') && !!document.getElementById('crashClear') && document.querySelector('#view h1').textContent === 'Sidan kunde inte visas'"), "[error page] a view that throws gives the error page with two ways forward")
    pg.evaluate("RQ.views.magasin = () => ({ html: '<h1 class=\"h1\">x</h1>', mount() { throw new Error('test'); } }); 0")
    go(pg, "butik", 300); go(pg, "magasin", 400)
    ok(pg.evaluate("!!document.getElementById('crashClear')"), "[error page] a view that cannot start gives the error page too")
    go(pg, "butik", 400)
    ok(pg.evaluate("document.querySelector('#view h1').textContent.trim()") == "Alla produkter", "[error page] the rest of the shop still works afterwards")
    go(pg, "magasin", 300); pg.evaluate("document.getElementById('crashClear').click()"); pg.wait_for_timeout(900)
    ok(pg.evaluate("localStorage.getItem('rumiq-cart')") is None, "[error page] 'Rensa sparat och ladda om' empties what was kept")
    ctx.close()

    # ------------------------------------------------ 7. quantities are whole numbers from 1 to 99
    ctx = context(b, True); pg = ctx.new_page(); pg.goto(BASE + "butik/"); pg.wait_for_timeout(400)
    for v, want in (("2.5", 2), ("500", 99), ("1e3", 99), ("99999999999999999999", 99), ("0", 1), ("-3", 1), ("abc", 1), (" 7 ", 7)):
        got = pg.evaluate("(v) => { RQ.shop.clearCart(); RQ.shop.addToCart('lysa-keramiklampa::0', v); return RQ.shop._cart[0].q; }", v)
        ok(got == want, f"[cart] quantity '{v}' becomes {want} (got {got})")
    ok(pg.evaluate("(() => { RQ.shop.clearCart(); RQ.shop.addToCart('lysa-keramiklampa::0', 60); RQ.shop.addToCart('lysa-keramiklampa::0', 60); return RQ.shop._cart[0].q; })()") == 99, "[cart] never more than 99 of one thing")
    ok(pg.evaluate("(() => { RQ.shop.setQty('lysa-keramiklampa::0', 2.7); return RQ.shop._cart[0].q; })()") == 2, "[cart] a changed quantity is a whole number")
    ok(pg.evaluate("(() => { RQ.shop.clearCart(); RQ.LOOKS.find((l) => l.id === 'spa-hemma').items.forEach((h) => RQ.shop.addToCart(h + '::0', 2.5)); return RQ.shop.lookDiscounts().length; })()") == 2, "[cart] two of every thing in a look give two discounts, never three")
    ok(pg.evaluate("RQ.shop.addToCart('lysa-keramiklampa::7', 1)") is False and pg.evaluate("RQ.shop.addToCart('finns-inte::0', 1)") is False, "[cart] a colour or product that does not exist is not added")
    for raw, count in (('[{"v":"finns-inte::0","q":2}]', 0), ('[{"v":"lysa-keramiklampa::7","q":1}]', 0), ('[{"v":"lysa-keramiklampa::0","q":"abc"}]', 0), ('[{"v":"lysa-keramiklampa::0","q":-3}]', 0), ('[{"v":"lysa-keramiklampa::0","q":1e9}]', 99), ('[{"v":"lysa-keramiklampa::0"}]', 0), ('[{"v":"lysa-keramiklampa::0","q":2.5},{"v":"sand-keramikvas::0","q":"3"}]', 5)):
        pg.evaluate("(r) => localStorage.setItem('rumiq-cart', r)", raw); pg.reload(); pg.wait_for_timeout(450)
        st = pg.evaluate("(() => { RQ.openCart(); return [RQ.shop.cartCount(), document.querySelector('[data-count=cart]').textContent, document.querySelector('#cart').classList.contains('open'), document.querySelector('#cart').innerText]; })()")
        ok(st[0] == count and st[1] == (str(count) if count else "") and st[2] and "NaN" not in st[3] and "−" not in st[3].replace("\n−\n", ""), f"[cart] stored row {raw[:44]} gives a clean cart of {count}: {st[:3]}")
    pg.evaluate("localStorage.removeItem('rumiq-cart')")
    # 8. a full storage is said out loud
    pg.reload(); pg.wait_for_timeout(400)
    pg.evaluate("for (const n of [262144, 4096, 64, 1]) { let i = 0; try { for (;; i++) localStorage.setItem('f' + n + '_' + i, 'x'.repeat(n)); } catch (e) {} }")
    pg.evaluate("RQ.shop.addToCart('sand-keramikvas::0', 1); RQ.confirmAdd(null, 'Sand keramikvas')"); pg.wait_for_timeout(250)
    ok("lagring är full" in pg.evaluate("document.getElementById('toast').textContent"), "[storage full] adding to the cart says that it will not be kept")
    pg.evaluate("Object.keys(localStorage).filter((k) => /^f\\d/.test(k)).forEach((k) => localStorage.removeItem(k))")
    ctx.close()

    # ------------------------------------------------ 9. "Rensa allt" clears everything the shop kept
    ctx = context(b, False); pg = ctx.new_page(); pg.goto(BASE); pg.wait_for_timeout(400)
    pg.evaluate("document.getElementById('ckNeed').click(); RQ.loadTools()"); pg.wait_for_timeout(300)
    pg.evaluate(SAMPLE, "vardagsrum")
    pg.evaluate("""() => { const S = RQ.shop; ['lysa-keramiklampa', 'sand-keramikvas'].forEach((h) => RQ.room.add(h, true)); S.signIn('a@example.com', 'Anna', 'email'); S.toggleWish('lysa-keramiklampa'); S.addToCart('lysa-keramiklampa::0', 1);
      S.store.set('rumiq-chat-saved', [{ who: 'me', text: 'hej' }]); S.store.set('rumiq-ai-consent', '2026-01-01'); localStorage.setItem('rumiq-room-night', '1'); sessionStorage.setItem('rumiq-chat', '[]'); S.store.set('rumiq-ljus', 'kvall'); }""")
    go(pg, "mitt-hem", 800)
    pg.evaluate("document.getElementById('clearAll').click()"); pg.wait_for_timeout(100); pg.evaluate("document.getElementById('clearAll').click()"); pg.wait_for_timeout(600)
    left = pg.evaluate("[...Object.keys(localStorage), ...Object.keys(sessionStorage)].filter((k) => /^rumiq-/.test(k)).sort()")
    ok(sorted(left) == ["rumiq-consent", "rumiq-ljus"], f"[rensa allt] only the cookie choice and the light stay: {left}")
    ok(pg.evaluate("!RQ.room.has() && RQ.room.scene().length === 0 && RQ.shop.cartCount() === 0 && RQ.shop._wish.length === 0 && !RQ.shop.customer()"), "[rensa allt] the room, its things, the cart and the account are gone at once")
    pg.reload(); pg.wait_for_timeout(500)
    ok(pg.evaluate("!RQ.room.has() && !document.querySelector('[data-count=scene]').textContent"), "[rensa allt] and stay gone after a reload")
    ctx.close()

    # ------------------------------------------------ links, addresses, Back, focus
    for mobile in (True, False):
        tag = "[390]" if mobile else "[1440]"
        ctx = context(b, mobile); pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(BASE + "butik/"); pg.wait_for_timeout(500); pg.evaluate("document.getElementById('ckNeed').click()")
        links = pg.evaluate("[...document.querySelectorAll('a[href]')].filter((a) => !a.closest('#sheet')).map((a) => a.getAttribute('href'))")
        hashed = [h for h in links if h.startswith("#") and h not in ("#", "#view") and pg.evaluate("(h) => RQ.isRoute(decodeURIComponent(h.slice(1))) && !/^faq-/.test(h.slice(1))", h)]
        ok(len(links) > 100 and not hashed, f"{tag} every internal link on Butik is a real path ({len(links)} links, still '#': {hashed[:4]})")
        ok(all((ROOT / h / "index.html").exists() for h in links if re.fullmatch(r"[a-z0-9-]+/", h)), f"{tag} every path link has a page")
        pg.evaluate("RQ.toast('<a href=\"#kassa\">Till kassan</a>')"); pg.wait_for_timeout(80)
        ok(pg.evaluate("document.querySelector('#toast a').getAttribute('href')") == "kassa/", f"{tag} a link added later (a message) becomes a real path too")
        pg.evaluate(COUNT); pg.evaluate("window.__loads = 0; addEventListener('beforeunload', () => __loads++)")
        pg.evaluate("window.scrollTo(0, 1200)"); pg.wait_for_timeout(200)
        pg.evaluate("document.querySelector('#results .card h3 a').click()"); pg.wait_for_timeout(800)
        ok(pg.evaluate("__c.produkt") == 1 and pg.evaluate("location.pathname").startswith("/produkt-") and pg.evaluate("window.__loads") == 0, f"{tag} a click on a path link changes the view without a reload")
        ok(pg.evaluate("scrollY") == 0, f"{tag} a new page starts at the top")
        ok(pg.evaluate("document.activeElement.id") == "view", f"{tag} the keyboard starts at the new page (focus on #view)")
        pg.wait_for_timeout(150)
        ok(pg.evaluate("document.getElementById('routeLive').textContent") == pg.evaluate("document.querySelector('#view h1').textContent.trim()"), f"{tag} the new page is announced by name")
        ok(pg.evaluate("document.querySelector('link[rel=canonical]').href").endswith(pg.evaluate("location.pathname")) and pg.evaluate("document.querySelector('meta[property=\"og:url\"]').content").endswith(pg.evaluate("location.pathname")), f"{tag} canonical and og:url follow the view")
        ok(pg.evaluate("document.querySelector('meta[name=description]').content") == pg.evaluate("document.querySelector('#view .short').textContent.trim()")[:158] and pg.evaluate("document.querySelector('meta[property=\"og:title\"]').content") == pg.title() and "/img/p/" in pg.evaluate("document.querySelector('meta[property=\"og:image\"]').content"), f"{tag} description, og:title and og:image follow the product")
        pg.go_back(); pg.wait_for_timeout(1100)
        ok(pg.evaluate("RQ.currentRoute()") == "butik" and abs(pg.evaluate("scrollY") - 1200) < 6, f"{tag} Back returns to where you were on Butik (scrollY {pg.evaluate('scrollY')})")
        ok(pg.evaluate("document.querySelector('link[rel=canonical]').href").endswith("/butik/"), f"{tag} canonical follows Back")
        pg.go_forward(); pg.wait_for_timeout(700)
        ok(pg.evaluate("RQ.currentRoute()").startswith("produkt-") and pg.evaluate("scrollY") == 0, f"{tag} Forward opens the product at the top")
        pg.go_back(); pg.wait_for_timeout(1400); pg.evaluate("window.scrollTo(0, 900)"); pg.wait_for_timeout(200); pg.reload(); pg.wait_for_timeout(1500)
        ok(pg.evaluate("RQ.currentRoute()") == "butik" and abs(pg.evaluate("scrollY") - 900) < 6, f"{tag} a reload lands where you were (scrollY {pg.evaluate('scrollY')})")
        ok(pg.evaluate("RQ.shop.returnsLine()") == "30 dagars öppet köp från att du tog emot varan. Lagen ger alltid 14 dagars ångerrätt.", f"{tag} the one sentence about returns reads its numbers from the settings")
        # aliases and odd addresses
        for u, want in (("#butik", "butik"), ("#Butik", "butik"), ("#butik/", "butik"), ("?utm_source=x#butik", "butik"), ("#hem", ""), ("butik/#faq-2", "faq-2")):
            pg.goto(BASE + u); pg.wait_for_timeout(450)
            ok(pg.evaluate("RQ.currentRoute()") == want, f"{tag} '{u}' opens {want}")
        pg.goto(BASE + "?utm_source=x#butik"); pg.wait_for_timeout(400)
        ok(pg.evaluate("location.pathname + location.search").endswith("/butik/?utm_source=x"), f"{tag} what follows '?' stays when '#butik' becomes the path")
        for u in ("#%", "#%E0%A4%A", "butik/#%"):
            errs.clear(); pg.goto(BASE + u); pg.wait_for_timeout(450)
            ok(not errs and pg.evaluate("RQ.currentRoute() !== null"), f"{tag} a broken '%' in the address does not stop the script ({u}): {errs[:1]}")
        pg.goto(BASE + "#access_token=abc&type=x"); pg.wait_for_timeout(400)
        ok(pg.evaluate("location.hash") == "#access_token=abc&type=x", f"{tag} a sign-in answer after '#' is left for the sign-in code")
        pg.goto(BASE + "jamfor/"); pg.wait_for_timeout(900)
        ok(pg.evaluate("document.querySelector('#view h1').textContent.trim()") == "Mitt hem" and pg.evaluate("document.querySelector('link[rel=canonical]').href").endswith("/mitt-hem/"), f"{tag} the old compare address opens Mitt hem")
        ok(pg.evaluate("!RQ.shop.toggleCompare && !RQ.views.jamfor && !RQ.views.ideer"), f"{tag} the compare tool and the old ideas view are gone")
        ok(not errs, f"{tag} no script errors: {errs[:2]}")
        ctx.close()

    # first draw: the pictures of the prerendered page do not blink
    ctx = context(b, True)
    ctx.add_init_script("""window.__low = 1; document.addEventListener('DOMContentLoaded', () => { let n = 0; const s = () => { const im = document.querySelector('#view img.fade'); if (im && im.complete) __low = Math.min(__low, +getComputedStyle(im).opacity); if (++n < 45) requestAnimationFrame(s); }; s(); }, true);""")
    pg = ctx.new_page(); pg.goto(BASE + "butik/", wait_until="load"); pg.wait_for_timeout(1500)
    ok(pg.evaluate("__low") > 0.98, f"[first draw] product pictures stay visible while the script takes over (lowest opacity {pg.evaluate('__low')})")
    ok(pg.evaluate("!document.getElementById('view').classList.contains('first')"), "[first draw] the helper class is gone afterwards")
    ctx.close()

    # tools file cannot be fetched: the address stays honest and there is a way to try again
    ctx = context(b, True); state = {"fail": True}
    ctx.route(re.compile(r"site-tools\.min\.js"), lambda r: r.abort() if state["fail"] else r.continue_())
    pg = ctx.new_page(); pg.goto(BASE + "butik/", wait_until="domcontentloaded"); pg.wait_for_timeout(400)
    go(pg, "hitta-ratt", 900)
    ok(pg.evaluate("location.pathname").endswith("/butik/") and pg.evaluate("RQ.currentRoute()") == "butik", "[tools] when the tools cannot be fetched the address stays on the page that is shown")
    ok(pg.evaluate("(() => { const a = document.querySelector('#toast a'); return !!a && a.getAttribute('href') === 'hitta-ratt/' && a.textContent === 'Försök igen'; })()"), "[tools] the message offers 'Försök igen'")
    state["fail"] = False
    pg.evaluate("document.querySelector('#toast a').click()"); pg.wait_for_timeout(1200)
    ok(pg.evaluate("RQ.currentRoute()") == "hitta-ratt" and pg.evaluate("location.pathname").endswith("/hitta-ratt/"), "[tools] 'Försök igen' opens the page once the connection is back")
    ctx.close()

    # no JavaScript: the page says what is missing
    ctx = b.new_context(viewport={"width": 390, "height": 844}, java_script_enabled=False)
    pg = ctx.new_page(); pg.goto(BASE + "butik/"); pg.wait_for_timeout(300)
    shell = (ROOT / "tools/shell.html").read_text(encoding="utf-8")
    ok("<noscript>" in shell and "Butiken behöver JavaScript" in shell, "[no script] the shell carries a note for visitors without JavaScript")
    ctx.close()

    ok(not [f for f in ("assets/img/p/kabelbox-vit-600.webp", "assets/img/p/orbit-tradlost-laddstall-600.webp", "assets/img/p/rund-vaggspegel-ek-600.webp", "assets/3d/kabelbox-vit.glb", "assets/brand/r-champagne.webp") if (ROOT / f).exists()], "[files] pictures of products that left the range are gone")
    ok(sum(1 for f in ("room", "flow", "svep", "myhome", "ai") if "localStorage.getItem(k)" in (ROOT / f"assets/js/{f}.js").read_text(encoding="utf-8")) == 0, "[storage] one reader: no private copies left in room, flow, svep, myhome, ai")

    # ------------------------------------------------ English: one way to write numbers, no Swedish left in cart and checkout
    PAIRS = json.loads((ROOT / "tools/i18n-add/kod.json").read_text(encoding="utf-8"))
    ok(isinstance(PAIRS, dict) and all(isinstance(k, str) and isinstance(v, str) and v for k, v in PAIRS.items()), "[english] tools/i18n-add/kod.json is a flat list of pairs")
    # the build merges the pairs into the dictionary; here they are laid on top the same way, so the check stands on its own
    EN = "try{localStorage.setItem('rumiq-lang','\"en\"')}catch(e){};document.addEventListener('DOMContentLoaded',()=>{if(window.RQ_EN)Object.assign(RQ_EN.dict," + json.dumps(PAIRS) + ")});"
    for mobile in (True, False):
        tag = "[390 en]" if mobile else "[1440 en]"
        ctx = context(b, mobile); ctx.add_init_script(EN); pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(BASE + "look-mjuk-kvall/"); pg.wait_for_timeout(700); pg.evaluate("document.getElementById('ckNeed').click()")
        txt = pg.evaluate("document.body.innerText")
        ok(re.search(r"\d,\d{3} kr", txt) and not re.search(r"\d[ \u00a0\u202f]\d{3} kr", txt), f"{tag} prices are written one way on the look page (2,687 kr)")
        pg.evaluate("RQ.LOOKS.find((l) => l.id === 'mjuk-kvall').items.forEach((h) => RQ.shop.addToCart(h + '::0', 1)); RQ.openCart()"); pg.wait_for_timeout(500)
        cart = pg.evaluate("document.getElementById('cart').innerText")
        ok("Whole look Soft evening" in cart and "Of which VAT (25%)" in cart and "example products" in cart and not re.search(r"Hela looken|Varav moms|Varukorgen", cart), f"{tag} the cart drawer is in English")
        ok(not re.search(r"\d[ \u00a0\u202f]\d{3} kr", cart) and "1 pcs" not in cart, f"{tag} the cart drawer writes numbers one way")
        pg.evaluate("RQ.closeAll()"); go(pg, "kassa", 700)
        co = pg.evaluate("document.getElementById('view').innerText")
        ok(not re.search(r"Hela looken|Varav moms|arbetsdagar|När butiken|\b1 pcs\b", co) and not re.search(r"\d[ \u00a0\u202f]\d{3} kr", co), f"{tag} the checkout has no Swedish rows and one number format")
        ok(not pg.evaluate("[...document.querySelectorAll('#view textarea[placeholder]')].some((t) => /[åäö]/i.test(t.placeholder))"), f"{tag} hints inside text fields are translated")
        go(pg, "butik", 600)
        ok(pg.title() == "All products · RumIQ", f"{tag} the page title is translated ({pg.title()})")
        go(pg, "produkt-lysa-keramiklampa", 700)
        ok("incl. VAT" in pg.evaluate("document.getElementById('view').innerText") and "inkl. moms" not in pg.evaluate("document.getElementById('view').innerText"), f"{tag} the product page says incl. VAT")
        terms = {"Önska": "Requests", "Var är mitt paket?": "Track my order", "Spåra min beställning": "Track my order", "30 dagars öppet köp": "30-day returns", "Hitta rätt": "Find the right piece", "Ljust hela tiden": "Always light", "Reklamation & garanti": "Faults & warranty", "Ångra avtalet här": "Withdraw from a purchase", "4 produkter": "4 items", "1 st": "1 pc", "2 st": "2 pcs", "Svep · Kök": "Swipe · Kitchen", "1 st · Havre": "1 pc · Oat"}
        got = pg.evaluate("(t) => Object.fromEntries(Object.keys(t).map((k) => [k, RQ_t(k)]))", terms)
        ok(got == terms, f"{tag} the agreed English terms: {[(k, got[k]) for k in terms if got[k] != terms[k]]}")
        ok(not errs, f"{tag} no script errors: {errs[:2]}")
        ctx.close()

    b.close()

srv.shutdown()
print(f"{n - len(fails)} of {n} checks passed")
sys.exit(1 if fails else 0)
