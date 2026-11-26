#!/usr/bin/env python3
"""v15 round 3 checks for verktyg: the stylist answers what was asked, Svep to the room, Svep keys,
Hitta rätt tiles, one name for Sparat, the account page in English, words.
Run after `python3 tools/build.py`:  python3 test/v15r3_verktyg.py
Own in-process server; everything outside 127.0.0.1 is blocked, as in the sandbox."""
import http.server, json, re, socketserver, sys, threading
from pathlib import Path
from playwright.sync_api import sync_playwright
import sys as _s, os as _o; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); import _edit_way  # noqa: E402,F401  the editor tests start in Justera själv

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


BASEPATH = re.search(r'<base href="([^"]*)"', (ROOT / "404.html").read_text(encoding="utf-8")).group(1)


class H404(H):
    """as the static host does: the site lives under its base path, an address without a page gets 404.html"""
    def translate_path(self, path):
        b = "/" + BASEPATH.strip("/") + "/" if BASEPATH.strip("/") else "/"
        return super().translate_path("/" + path[len(b):] if path.startswith(b) else path)

    def send_head(self):
        path = Path(self.translate_path(self.path))
        if not path.exists() or (path.is_dir() and not (path / "index.html").exists()):
            body = (ROOT / "404.html").read_bytes()
            self.send_response(404); self.send_header("Content-Type", "text/html; charset=utf-8"); self.send_header("Content-Length", str(len(body))); self.end_headers()
            import io
            return io.BytesIO(body)
        return super().send_head()


srv404 = Srv(("127.0.0.1", 0), lambda *a, **k: H404(*a, directory=str(ROOT), **k))
threading.Thread(target=srv404.serve_forever, daemon=True).start()
BASE404 = f"http://127.0.0.1:{srv404.server_address[1]}/" + BASEPATH.strip("/") + ("/" if BASEPATH.strip("/") else "")
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{srv.server_address[1]}/"
UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
LAST = "(() => { const m = [...document.querySelectorAll('#log .msg.ai')].pop(); return [m.innerText, m.querySelectorAll('.mini a').length, [...m.querySelectorAll('a')].map(a => a.getAttribute('href')), [...m.querySelectorAll('.mini a')].map(a => a.getAttribute('href').replace(/^.*produkt-/, '').replace(/[/]$/, ''))]; })()"


def new(b, mobile, w=None, h=None, en=False, evening=False):
    kw = dict(viewport={"width": w or 390, "height": h or 844}, device_scale_factor=2, is_mobile=True, has_touch=True, user_agent=UA) if mobile else dict(viewport={"width": w or 1440, "height": h or 900})
    ctx = b.new_context(locale="sv-SE", **kw)
    ctx.route(re.compile(r"^https?://(?!127\.0\.0\.1)"), lambda r: r.abort())
    init = ("localStorage.setItem('rumiq-lang', JSON.stringify('en'));" if en else "") + ("localStorage.setItem('rumiq-ljus', 'kvall');" if evening else "")
    if init:
        ctx.add_init_script("if (!sessionStorage.getItem('__i')) { sessionStorage.setItem('__i', '1'); " + init + " }")
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


SAMPLE = """async (r) => { const im = new Image(); await new Promise((ok) => { im.onload = ok; im.src = 'assets/img/rum/' + r + '-1600.webp'; });
  await RQ.room.saveImage(im, { sample: true, map: r, type: r, name: r }); }"""


def finish_round(pg, pattern="Y"):
    k = 0
    while pg.evaluate("!!document.querySelector('#svDeck .sv-card')") and k < 30:
        pg.evaluate("document.getElementById('%s').click()" % ("svYes" if pattern[k % len(pattern)] == "Y" else "svNo"))
        pg.wait_for_timeout(280)
        k += 1
    pg.wait_for_timeout(400)


DATA = None
with sync_playwright() as p:
    b = p.chromium.launch()

    # ------------------------------------------------------------ the stylist answers the question asked (M4, D6, M13)
    for mobile, en in ((True, False), (False, False), (True, True)):
        tag = ("phone" if mobile else "desktop") + (" en" if en else "")
        ctx, pg, errs = new(b, mobile, en=en)
        go(pg, "studio-stylist", 900)
        if DATA is None:
            DATA = pg.evaluate("Object.fromEntries(RQ.PRODUCTS.map(p => [p.handle, {rooms: p.rooms, name: p.name, price: p.price, cat: p.cat}]))")
        say = lambda q: (pg.fill("#chatIn", q), pg.press("#chatIn", "Enter"), pg.wait_for_timeout(950), pg.evaluate(LAST))[-1]
        a = say("How do I return a lamp?" if en else "Hur gör jag om jag vill returnera en lampa?")
        ok(a[1] == 0 and ("30-day returns" in a[0] if en else "30 dagars öppet köp" in a[0]) and "returer" in " ".join(x or "" for x in a[2]) and ("lamps" not in a[0] if en else "lampor" not in a[0]), f"{tag} stylist: a returns question gets only the returns facts and the page: {a[0][:90]!r}")
        a = say("How much is shipping?" if en else "Vad kostar frakten?")
        ok(a[1] == 0 and "49" in a[0] and "89" in a[0] and "frakt" in " ".join(x or "" for x in a[2]), f"{tag} stylist: shipping gets the prices from config and the page: {a[0][:90]!r}")
        a = say("Can I pay with Klarna?" if en else "Kan jag betala med Klarna?")
        ok(a[1] == 0 and "betalning" in " ".join(x or "" for x in a[2]), f"{tag} stylist: payment gets the payment page, no products")
        a = say("What colours go with a grey sofa?" if en else "Vilka färger passar ihop med en grå soffa?")
        ok(a[1] >= 1 and ("oat" in a[0].lower() if en else "havre" in a[0]) and all("vardagsrum" in DATA[h]["rooms"] for h in a[3]), f"{tag} stylist: a colour question gets colour advice and living room products: {a[0][:80]!r} {a[3]}")
        a = say("A lamp for the living room under 1000 kr" if en else "En lampa till vardagsrummet under 1000 kr")
        ok(a[1] >= 1 and all("lampa" in h and DATA[h]["price"] <= 1000 for h in a[3]), f"{tag} stylist: 'lampa' means lamps only, no candle: {a[3]}")
        a = say("Something green for the hallway under 300 kr" if en else "Något grönt till hallen under 300 kr")
        # r4: no longer a dead end, the nearest thing comes as a card (549 kr) next to what fits under 300 kr
        ok(a[1] >= 1 and ("mirror" not in a[0].lower() if en else "spegel" not in a[0]) and ("549" in a[0]), f"{tag} stylist: green for the hall under 300 kr says plainly what is nearest, no mirror: {a[0][:120]!r}")
        a = say("Something green for the hallway" if en else "Något grönt till hallen")
        ok(a[1] >= 1 and all("hall" in DATA[h]["rooms"] for h in a[3]), f"{tag} stylist: only products for the room asked: {a[3]}")
        a = say("How do I make a small hallway feel more organised?" if en else "Hur får jag en liten hall att kännas mer ordnad?")
        ok(all("hall" in DATA[h]["rooms"] for h in a[3]) and ("mirror" not in a[0].lower() if en else "spegel" not in a[0]), f"{tag} stylist: hall question, hall products, no mirror: {a[3]}")
        btn = pg.evaluate("document.querySelector('#chatForm .btn').textContent.trim()")
        ok(btn == ("Ask" if en else "Fråga"), f"{tag} stylist: the send button says {btn!r}")
        ok(pg.evaluate("(() => { const i = document.getElementById('chatIn'), c = document.createElement('canvas').getContext('2d'); const s = getComputedStyle(i); c.font = s.fontSize + ' ' + s.fontFamily; return c.measureText(i.placeholder).width <= i.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight); })()"), f"{tag} stylist: the placeholder is not clipped")
        if mobile and not en:
            ok(not pg.evaluate("[...document.querySelectorAll('#log .mini a span')].some(s => s.scrollHeight > s.clientHeight + 1)"), f"{tag} stylist: product names are not cut")
        ok(pg.evaluate("document.getElementById('chatClear').classList.contains('btn')"), f"{tag} stylist: 'Rensa samtalet' is a button")
        ok(not errs, f"{tag} stylist: no script errors {errs[:2]}")
        ctx.close()

    # ------------------------------------------------------------ Svep "Se dem i ditt rum" places only what fits the room (M2)
    for mobile in (True, False):
        tag = "phone" if mobile else "desktop"
        ctx, pg, errs = new(b, mobile)
        go(pg, "svep", 900)
        pg.evaluate(SAMPLE, "sovrum"); pg.wait_for_timeout(300)
        finish_round(pg)
        saved = pg.evaluate("document.querySelectorAll('.sv-liked button').length")
        pg.evaluate("document.getElementById('svRoomAll').click()"); pg.wait_for_timeout(1400)  # v15.8: under Fler val
        scene = [x["h"] for x in pg.evaluate("RQ.room.scene()")]
        toast = pg.evaluate("document.getElementById('toast').innerText")
        ok(saved >= 6 and 1 <= len(scene) <= 4 and all("sovrum" in DATA[h]["rooms"] for h in scene), f"{tag} Svep to room: only bedroom things, at most four: {saved} saved, {scene}")
        ok("/mitt-rum" in pg.evaluate("location.pathname + location.hash") and f"{len(scene)} saker står nu i rummet" in toast and "Mitt hem" in toast, f"{tag} Svep to room: an honest toast in Mitt rum: {toast!r}")
        ok(not errs, f"{tag} Svep to room: no script errors {errs[:2]}")
        ctx.close()

    # ------------------------------------------------------------ Svep: the arrows work as soon as a round starts (D5)
    for w, h in ((1440, 900), (1280, 720)):
        tag = f"desktop {w}"
        ctx, pg, errs = new(b, False, w, h)
        go(pg, "svep", 900)
        ok(pg.evaluate("document.activeElement.id") == "svDeck", f"{tag} Svep: the deck has the focus when the round starts")
        pg.keyboard.press("ArrowRight"); pg.wait_for_timeout(600)
        ok(pg.evaluate("document.getElementById('svCount').textContent").startswith("2 av"), f"{tag} Svep: → saves the first card without any Tab")
        pg.evaluate("document.activeElement.blur()"); pg.keyboard.press("ArrowLeft"); pg.wait_for_timeout(600)
        ok(pg.evaluate("document.getElementById('svCount').textContent").startswith("3 av"), f"{tag} Svep: ← works with the focus on the page itself")
        pg.focus(".sv-scope a"); pg.keyboard.press("ArrowRight"); pg.wait_for_timeout(500)
        ok(pg.evaluate("document.getElementById('svCount').textContent").startswith("3 av"), f"{tag} Svep: the arrows stay off while another control has the focus")
        ok(not errs, f"{tag} Svep keys: no script errors {errs[:2]}")
        ctx.close()
    ctx, pg, errs = new(b, True)
    go(pg, "svep", 900)
    ok(pg.evaluate("document.activeElement.id") != "svDeck", "phone Svep: no focus ring forced on a touch screen")
    ctx.close()

    # ------------------------------------------------------------ Svep: buttons clear of the dock (M5), result title and length (D16)
    for w, h in ((360, 740), (390, 844), (430, 932)):
        ctx, pg, errs = new(b, True, w, h)
        go(pg, "svep", 900)
        g = pg.evaluate("(() => { const c = document.querySelector('.sv-ctrl').getBoundingClientRect(), d = document.querySelector('.dock').getBoundingClientRect(); return [Math.round(c.bottom), Math.round(d.top), Math.round(document.getElementById('svDeck').getBoundingClientRect().height)]; })()")
        ok(g[1] - g[0] >= 10 and g[2] >= 340, f"phone {w}: Svep buttons end at least 10 px above the dock and the card stays large: {g}")
        if w == 390:
            finish_round(pg, "YYN")
            t = pg.evaluate("document.querySelector('.svep-result h2').innerText")
            ok(t.count(" och ") <= 1 and not re.search(r" (och|,) [A-ZÅÄÖ]", t), f"phone Svep result title: one 'och', a capital only first: {t!r}")
            ok(pg.evaluate("!!document.getElementById('svTwoOpen') && document.getElementById('svTwo').hidden"), "phone Svep result: the name form for swiping together opens only on request")
            pg.click("#svTwoOpen"); pg.wait_for_timeout(200)
            ok(pg.evaluate("!document.getElementById('svTwo').hidden && document.activeElement.id === 'svTwoN'"), "phone Svep result: 'Skicka korten' opens the form with the focus in the name field")
            ok(not pg.evaluate("[...document.querySelectorAll('.sv-liked span')].some(s => /[a-zåäö]-$/m.test(s.innerText) && !/(bords|organisatör|linne|förvarings)/i.test(s.innerText))"), "phone Svep result: saved names break where words meet")
        ok(not errs, f"phone {w} Svep: no script errors {errs[:2]}")
        ctx.close()

    # ------------------------------------------------------------ Hitta rätt: picture answers without an orphan or an empty right side (D20)
    for w, h, mobile in ((1440, 900, False), (1920, 1080, False), (1024, 768, False), (820, 1180, True), (360, 740, True)):
        ctx, pg, errs = new(b, mobile, w, h)
        for route in ("hitta-ratt", "hitta-ratt-present"):
            go(pg, route, 900)
            g = pg.evaluate("""[...document.querySelectorAll('.imgopts.pick')].map((g) => { const r = g.getBoundingClientRect(), bs = [...g.children].map((b) => b.getBoundingClientRect()), rows = [...new Set(bs.map((b) => Math.round(b.top)))];
              const per = rows.map((t) => bs.filter((b) => Math.round(b.top) === t).length); const right = Math.max(...bs.map((b) => b.right));
              return { rows: per, fill: (right - r.left) / (g.parentElement.getBoundingClientRect().width), clipped: [...g.querySelectorAll('span')].some((s) => s.getBoundingClientRect().bottom > r.bottom + 1 && getComputedStyle(g).overflowY !== 'visible') }; })""")
            for x in g:
                if w >= 900:
                    ok(len(x["rows"]) == 1 and x["fill"] > 0.97, f"{w} {route}: each question is one full row of pictures: {x}")
                else:
                    ok(all(n >= 3 for n in x["rows"]) and not x["clipped"], f"{w} {route}: no picture alone on a row, no label cut: {x}")
        ok(not errs, f"{w} Hitta rätt: no script errors {errs[:2]}")
        ctx.close()

    # ------------------------------------------------------------ one name for the saved-items place, one tab style, Röstad, English account (M11, D10, D22)
    for mobile in (True, False):
        tag = "phone" if mobile else "desktop"
        ctx, pg, errs = new(b, mobile)
        go(pg, "mitt-hem", 800)
        ok(pg.evaluate("document.querySelector('#view h1').textContent.trim()") == "Mitt hem" and pg.title().startswith("Mitt hem"), f"{tag} the saved-items page is called Sparat, like the dock: {pg.title()!r}")
        go(pg, "produkt-lin-kuddfodral", 900)
        pg.evaluate("document.querySelector('[data-wish]').click()"); pg.wait_for_timeout(300)
        t = pg.evaluate("document.getElementById('toast').innerText")
        ok("Mitt hem" in t and "Sparat" not in t, f"{tag} the save toast names Mitt hem (v15.8): {t!r}")
        ok("Mitt hem" in pg.evaluate("document.querySelector('.tools .wishlink') ? document.querySelector('.tools .wishlink').getAttribute('aria-label') : ''"), f"{tag} the header heart is called Sparat")
        go(pg, "mitt-hem", 800)
        ok(pg.evaluate("!!document.querySelector('.jump-nav a.on[aria-current]') && !document.querySelector('#view .chips a.chip[href^=\"#mh-\"]')"), f"{tag} Sparat: one jump menu with the current part marked")
        pg.evaluate("RQ.shop.signIn('anna@example.com', '', 'google')"); go(pg, "konto", 1200)
        ok(pg.evaluate("document.querySelector('#view h1').textContent.trim()") == "Mitt konto", f"{tag} Konto: no bare 'Hej' without a name")
        pg.evaluate("document.getElementById('acc-installningar').scrollIntoView()"); pg.wait_for_timeout(500)
        on = pg.evaluate("(document.querySelector('.acct-nav a.on') || {}).textContent")
        ok(on in ("Inställningar", "Mitt hem"), f"{tag} Konto: the side menu follows the page (scroll-spy): {on!r}")
        go(pg, "onska", 800)
        pg.evaluate("document.querySelector('[data-vote]').click()"); pg.wait_for_timeout(200)
        ok(pg.evaluate("(() => { const b = document.querySelector('[data-vote]'); return b.getAttribute('aria-pressed') === 'true' && getComputedStyle(b.querySelector('em.v-on')).display !== 'none' && !b.querySelector('i').innerHTML.includes('A4 4 0 0 1 7-2.6'); })()"), f"{tag} Önska: a vote shows Röstad, not the save heart")
        ok(not errs, f"{tag} naming: no script errors {errs[:2]}")
        ctx.close()
    ctx, pg, errs = new(b, False, en=True)
    go(pg, "konto", 800); pg.evaluate("RQ.shop.signIn('anna@example.com', '', 'google')"); go(pg, "konto", 1200)
    left = pg.evaluate("""(() => { const sv = /[åäöÅÄÖ]|\\b(och|inte|är|för|med|att|du|än|här|Inga|Hej)\\b/; const out = []; const w = document.createTreeWalker(document.getElementById('view'), NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const t = n.nodeValue.trim(); if (t && sv.test(t) && !n.parentElement.closest('[translate=no]')) out.push(t); } return out; })()""")
    ok(not left, f"desktop en: no Swedish left on the account page: {left[:4]}")
    for h, name in (("glob-bordslampa-opalglas", "Glob table lamp"), ("svamp-uppladdningsbar-lampa", "Svamp rechargeable lamp"), ("stilla-ljusstake-massing-2-pack", "Stilla brass candlesticks, 2\u2011pack")):
        go(pg, "produkt-" + h, 800)
        ok(pg.evaluate("document.querySelector('#view h1').innerText").startswith(name), f"desktop en: invented names stay names: {name}")
    ok(not errs, f"desktop en: no script errors {errs[:2]}")
    ctx.close()

    # ------------------------------------------------------------ konto: the preview note before the buttons, a narrow sign-in dialog, the room sheet (M14, D21, M13)
    for mobile in (True, False):
        tag = "phone" if mobile else "desktop"
        ctx, pg, errs = new(b, mobile)
        go(pg, "konto", 900)
        ok(pg.evaluate("(() => { const n = document.querySelector('.auth-card .note'), s = document.querySelector('.sso-list'); return !!n && !!s && n.getBoundingClientRect().bottom <= s.getBoundingClientRect().top; })()"), f"{tag} konto: 'inloggningen är inte kopplad än' stands above the provider buttons")
        go(pg, "butik", 800); pg.evaluate("RQ.room.openSetup()"); pg.wait_for_timeout(600)
        ok(pg.evaluate("document.querySelector('[data-room-type-h]').hidden && document.querySelector('.sheet [data-room-type]').hidden"), f"{tag} room sheet: 'Vilket rum är det?' waits until there is a photo")
        ok(pg.evaluate("[...document.querySelectorAll('.sheet-samples span')].every((s) => !/ i /.test(s.textContent))"), f"{tag} room sheet: the sample rooms are named the same way")
        pg.evaluate("RQ.room.closeSetup()")
        if not mobile:
            go(pg, "mitt-rum", 800); pg.evaluate(SAMPLE, "vardagsrum"); pg.wait_for_timeout(300); pg.evaluate("RQ.openAI()"); pg.wait_for_timeout(1500)
            ok("Förhandsvisning utan konto" in pg.evaluate("document.querySelector('#aiSheet').innerText") and pg.evaluate("!!document.getElementById('aiGo')"), "desktop: a guest gets the honest preview demo (device2 A1), not a sign-in wall")
        ok(not errs, f"{tag} konto/sheet: no script errors {errs[:2]}")
        ctx.close()

    # ------------------------------------------------------------ an order page after a reload keeps its own title (D22)
    ctx, pg, errs = new(b, False)
    pg.goto(BASE404 + "butik/"); pg.wait_for_timeout(900)
    num = pg.evaluate("(() => { const pr = RQ.PRODUCTS[1]; RQ.shop.addToCart(pr.variants ? pr.variants[0].id : (RQ.shop.variantsOf ? RQ.shop.variantsOf(pr)[0].id : pr.handle), 1); const o = RQ.shop.placeTestOrder({ contact: { email: 'a@b.se', first: 'A' }, address: { street: 'G 1', zip: '11122', city: 'X' }, shippingId: 'ombud' }); return o && o.number; })()")
    pg.goto(BASE404 + f"order-{num}/"); pg.wait_for_timeout(1500)
    ok(num and "Sidan finns inte" not in pg.title() and pg.evaluate("!!document.querySelector('#view h1')"), f"desktop: a reloaded order page has its own title, not 'Sidan finns inte': {pg.title()!r}")
    pg.goto(BASE404 + "finns-inte-alls/"); pg.wait_for_timeout(1000)
    ok("finns inte" in pg.title(), f"desktop: a page that does not exist still says so: {pg.title()!r}")
    ctx.close()
    b.close()

print(f"{n - len(fails)} of {n} checks passed")
sys.exit(1 if fails else 0)
