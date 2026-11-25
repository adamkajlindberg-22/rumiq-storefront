#!/usr/bin/env python3
"""v15 round 2, accessibility (WCAG 2.2 AA). Run after `python3 tools/build.py`:  python3 test/v15r2_a11y.py
Svep keys only in the deck, focus never hidden, two-tone ring, field borders 3:1, live status lines (cart, search, Svep),
the light menu by keyboard, Svep at 320 px / on its side / 200 %, motion that stops by itself, moving in Mitt rum
without dragging, names and headings, and an axe-core pass (if axe-core is installed, see AXE below)."""
import http.server, os, re, socketserver, sys, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
AXE = Path(os.environ.get("AXE", "/home/claude/axe/node_modules/axe-core/axe.min.js"))
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
SAMPLE = """async (r) => { const im = new Image(); await new Promise((ok) => { im.onload = ok; im.src = 'assets/img/rum/' + r + '-1600.webp'; });
  await RQ.room.saveImage(im, { sample: true, map: r, type: r, name: r }); }"""
# the focused element: is its centre covered by something else (a bar), and is it on screen
HIDDEN = """() => { const e = document.activeElement; if (!e || e === document.body) return null; const r = e.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2; if (y < 0 || y > innerHeight || x < 0 || x > innerWidth) return 'off screen: ' + (e.getAttribute('aria-label') || e.textContent).trim().slice(0, 30);
  const t = document.elementFromPoint(x, y); return t && (t === e || e.contains(t) || t.contains(e)) ? '' : 'under ' + (t ? t.className : '?') + ': ' + (e.getAttribute('aria-label') || e.textContent).trim().slice(0, 30); }"""


def lum(c):
    v = [int(x) / 255 for x in re.findall(r"[\d.]+", c)[:3]]
    v = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in v]
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]


def ratio(a, b):
    a, b = lum(a), lum(b)
    return (max(a, b) + 0.05) / (min(a, b) + 0.05)


def new(b, w, h, mobile, eve=False, motion="reduce"):
    ctx = b.new_context(viewport={"width": w, "height": h}, is_mobile=mobile, has_touch=mobile, device_scale_factor=1, reduced_motion=motion)
    ctx.route(re.compile(r"^https?://(?!127\.0\.0\.1)"), lambda r: r.abort())
    init = "try { localStorage.setItem('rumiq-consent', JSON.stringify({ stats: false, mkt: false, at: 'x' })); } catch (e) {}"
    if eve:
        init += "try { localStorage.setItem('rumiq-ljus', 'kvall'); } catch (e) {}"
    ctx.add_init_script(init)
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    return ctx, pg, errs


def go(pg, route, wait=700):
    pg.goto(BASE + (route + "/" if route else ""), wait_until="load")
    pg.wait_for_timeout(wait)


with sync_playwright() as p:
    b = p.chromium.launch()

    # ------------------------------------------------------------ Svep: the arrows steer the deck only from inside it
    ctx, pg, errs = new(b, 1440, 900, False)
    go(pg, "svep", 900)
    badge = lambda: pg.evaluate("document.querySelector('.tools [data-count=cart]').textContent")
    count = lambda: pg.evaluate("document.getElementById('svCount').textContent")
    pg.mouse.wheel(0, 300); pg.wait_for_timeout(300)
    pg.keyboard.press("ArrowUp"); pg.wait_for_timeout(400)
    ok(badge() == "" and count() == "1 av 10", "[svep] ArrowUp with nothing focused scrolls, it does not put a card in the cart")
    pg.focus("footer.site a"); pg.keyboard.press("ArrowRight"); pg.wait_for_timeout(400)
    ok(count() == "1 av 10", "[svep] ArrowRight on a link in the footer does not swipe")
    pg.focus(".sv-two-link"); pg.keyboard.press("Tab")
    ok(pg.evaluate("document.activeElement.id") == "svDeck", "[svep] Tab reaches the deck")
    pg.keyboard.press("ArrowRight"); pg.wait_for_timeout(500)
    ok(count() == "2 av 10" and pg.evaluate("document.getElementById('svSaid').textContent").startswith("Sparad: "), "[svep] ArrowRight in the deck saves, and the status line says so and names the next card")
    pg.keyboard.press("ArrowUp"); pg.wait_for_timeout(500)
    ok(badge() == "1" and pg.evaluate("document.getElementById('svSaid').textContent").startswith("I varukorgen: "), "[svep] ArrowUp in the deck puts the card in the cart and says so")
    pg.keyboard.press("Backspace"); pg.wait_for_timeout(500)
    ok(badge() == "" and pg.evaluate("document.activeElement.id") == "svDeck", "[svep] Backspace undoes, the focus stays in the deck")
    ok(pg.evaluate("document.querySelector('#svDeck').getAttribute('aria-live')") is None, "[svep] the deck itself is not a live region (the status line is)")
    ok(not errs, f"[svep] no script errors: {errs[:1]}")
    ctx.close()

    # ------------------------------------------------------------ Svep never collapses
    for w, h, tag in ((320, 640, "320 px"), (844, 390, "phone on its side"), (640, 360, "200 % zoom")):
        ctx, pg, errs = new(b, w, h, w < 700)
        go(pg, "svep", 800)
        s = pg.evaluate("(() => { const d = document.getElementById('svDeck').getBoundingClientRect(), c = document.getElementById('svCtrl').getBoundingClientRect(); return { sw: document.documentElement.scrollWidth, dw: d.width, dh: d.height, cr: c.right, cl: c.left }; })()")
        ok(s["sw"] <= w and s["dw"] >= 150 and s["dh"] >= 190, f"[svep {tag}] the card keeps its size, nothing runs off the side: {s}")
        ok(s["cl"] >= 0 and s["cr"] <= w, f"[svep {tag}] all five buttons fit: {s}")
        ctx.close()
    ctx, pg, errs = new(b, 320, 640, True)
    go(pg, "looks", 700)
    ok(pg.evaluate("document.documentElement.scrollWidth") <= 320, "[looks 320 px] the look cards fit without scrolling sideways")
    ctx.close()

    # ------------------------------------------------------------ focus is never hidden: bars, dock
    ctx, pg, errs = new(b, 1440, 900, False)
    go(pg, "produkt-lysa-keramiklampa", 900)
    ok(pg.evaluate("getComputedStyle(document.getElementById('buybar')).visibility") == "hidden", "[product desktop] the buy bar out of sight is out of the tab order")
    hidden = []
    for i in range(75):
        pg.keyboard.press("Tab"); pg.wait_for_timeout(40)
        r = pg.evaluate(HIDDEN)
        if r:
            hidden.append(r)
    ok(not hidden, f"[product desktop] no Tab stop is hidden under the buy bar or off screen: {hidden[:3]}")
    go(pg, "produkt-lysa-keramiklampa", 600)
    pg.keyboard.press("Tab")
    pg.evaluate("(() => { const f = document.querySelector('.card .fav'); f.scrollIntoView({ block: 'center' }); f.focus(); })()"); pg.wait_for_timeout(200)
    ring = pg.evaluate("(() => { const cs = getComputedStyle(document.activeElement); return [cs.outlineStyle, cs.outlineWidth, cs.boxShadow]; })()")
    ok(ring[0] == "solid" and ring[1] == "2px" and "3px" in ring[2], f"[focus ring] a button on a photo gets the accent line over a band of the page colour: {ring}")
    ctx.close()
    for mode in ("product", "checkout"):
        ctx, pg, errs = new(b, 390, 844, True)
        go(pg, "", 400)
        pg.evaluate("RQ.shop.addToCart('lysa-keramiklampa::0', 1)")
        go(pg, "produkt-lysa-keramiklampa" if mode == "product" else "kassa", 800)
        ok(pg.evaluate("getComputedStyle(document.getElementById('dock')).visibility") == "hidden", f"[{mode} 390] the dock that has slid away is out of the tab order")
        hidden = []
        for i in range(45):
            pg.keyboard.press("Tab"); pg.wait_for_timeout(40)
            r = pg.evaluate(HIDDEN)
            if r:
                hidden.append(r)
        ok(not hidden, f"[{mode} 390] no Tab stop is hidden or off screen: {hidden[:3]}")
        ctx.close()

    # ------------------------------------------------------------ borders that identify a field: 3:1, day and evening
    for eve in (False, True):
        ctx, pg, errs = new(b, 1440, 900, False, eve=eve)
        go(pg, "", 400); pg.evaluate("RQ.shop.addToCart('lysa-keramiklampa::0', 1)"); go(pg, "kassa", 800)
        c = pg.evaluate("(() => { const i = document.querySelector('#co input[name=email]'); let p = i.parentElement, bg = 'rgba(0, 0, 0, 0)'; while (p && /rgba\\(0, 0, 0, 0\\)|transparent/.test(bg)) { bg = getComputedStyle(p).backgroundColor; p = p.parentElement; } return [getComputedStyle(i).borderTopColor, getComputedStyle(i).backgroundColor, bg]; })()")
        tag = "evening" if eve else "day"
        ok(ratio(c[0], c[1]) >= 3 and ratio(c[0], c[2]) >= 3, f"[fields {tag}] the field border is 3:1 against the field and the panel: {c}")
        sw = pg.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--field').trim()")
        bgv = pg.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()")
        h2rgb = lambda h: "rgb(%d, %d, %d)" % tuple(int(h.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4))
        ok(ratio(h2rgb(sw), h2rgb(bgv)) >= 3, f"[fields {tag}] --field ({sw}) is 3:1 against the page ({bgv})")
        ctx.close()

    # ------------------------------------------------------------ status lines: cart, search; the light menu
    ctx, pg, errs = new(b, 1440, 900, False)
    go(pg, "butik", 700)
    pg.evaluate("RQ.shop.addToCart('lysa-keramiklampa::0', 1)"); pg.evaluate("RQ.openCart()"); pg.wait_for_timeout(400)
    pg.keyboard.press("Tab"); pg.focus("#cart button[data-d='1']"); pg.keyboard.press("Enter"); pg.wait_for_timeout(400)
    ok(pg.evaluate("document.getElementById('cartSaid').textContent").startswith("Lysa keramiklampa: 2 st. Totalt"), "[cart] + says the new quantity and the total")
    ok(pg.evaluate("document.activeElement.getAttribute('aria-label')") == "Öka antalet Lysa keramiklampa", "[cart] the focus stays on +")
    ok(pg.evaluate("document.querySelector('.tools [data-open-cart]').getAttribute('aria-label')") == "Varukorg, 2 varor", "[cart] the cart icon's name says the count it shows")
    ok(pg.evaluate("[...document.querySelectorAll('#cart .line > a')].every((a) => a.tabIndex === -1)"), "[cart] the picture link that repeats the name is out of the tab order")
    pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
    pg.focus(".searchbtn"); pg.keyboard.press("Enter"); pg.wait_for_timeout(500)
    ok(pg.evaluate("document.activeElement.id") == "searchInput", "[search] opening the search puts the focus in the field (also with reduced motion)")
    pg.keyboard.type("lampa"); pg.wait_for_timeout(500)
    ok(re.match(r"^\d+ produkter?$", pg.evaluate("document.getElementById('searchSaid').textContent")), "[search] the status line says the number of hits")
    pg.keyboard.press("Control+a"); pg.keyboard.type("zzzq"); pg.wait_for_timeout(500)
    ok(pg.evaluate("document.getElementById('searchSaid').textContent") == "Inga träffar", "[search] and says when there are none")
    pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
    pg.focus("#lampBtn"); pg.keyboard.press("Enter"); pg.wait_for_timeout(300)
    a = pg.evaluate("document.activeElement.dataset.lightSet"); pg.keyboard.press("ArrowDown"); b2 = pg.evaluate("document.activeElement.dataset.lightSet")
    ok(a and b2 and a != b2, f"[light menu] ArrowDown moves to the next choice: {a} -> {b2}")
    pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
    ok(pg.evaluate("document.activeElement.id") == "lampBtn" and pg.evaluate("document.getElementById('lampBtn').getAttribute('aria-expanded')") == "false", "[light menu] Escape closes it and the focus goes back to the lamp")
    ok(not errs, f"[status lines] no script errors: {errs[:1]}")
    ctx.close()

    # ------------------------------------------------------------ motion stops by itself within five seconds
    ctx, pg, errs = new(b, 1440, 900, False, motion="no-preference")
    go(pg, "rum-vardagsrum", 5800)
    ok(pg.evaluate("[...document.querySelectorAll('.hs')].every((h) => h.getAnimations({ subtree: true }).every((a) => a.playState !== 'running'))"), "[motion] the hotspot pulse has stopped after five seconds")
    go(pg, "", 1200)
    snap = lambda: pg.evaluate("(() => { const c = document.getElementById('dust'); return c ? c.toDataURL() : ''; })()")
    pg.wait_for_timeout(5200); s1 = snap(); pg.wait_for_timeout(600)
    ok(s1 == snap(), "[motion] the dust in the hero rests after five seconds")
    ctx.close()
    ctx, pg, errs = new(b, 390, 844, True, motion="no-preference")
    go(pg, "", 900)
    v = pg.evaluate("(() => { const v = document.getElementById('heroLoop'); return v && v.src ? [v.loop, v.playbackRate] : null; })()")
    ok(v is None or (v[0] is False and v[1] >= 1.21), f"[motion] the phone film plays once, in under five seconds: {v}")
    ctx.close()

    # ------------------------------------------------------------ Mitt rum: moving without dragging; names on phones
    ctx, pg, errs = new(b, 390, 844, True)
    go(pg, "", 400); pg.evaluate(SAMPLE, "vardagsrum"); pg.evaluate("RQ.room.add('lysa-keramiklampa', true)")
    go(pg, "mitt-rum", 900)
    pg.click(".rm-item[data-h=lysa-keramiklampa]"); pg.wait_for_timeout(300)
    x0 = pg.evaluate("RQ.room.scene().find((x) => x.h === 'lysa-keramiklampa').x")
    pg.click("[data-mv='-2,0']"); pg.wait_for_timeout(200)
    ok(pg.evaluate("RQ.room.scene().find((x) => x.h === 'lysa-keramiklampa').x") < x0, "[mitt rum] the arrow buttons move the chosen thing (no dragging needed)")
    ok(pg.evaluate("document.querySelector('#rmHold').getAttribute('aria-label').startsWith(document.querySelector('#rmHold span').textContent)"), "[mitt rum] Håll för före is named by its visible words")
    go(pg, "butik", 700)
    ok(pg.evaluate("!document.querySelector('.toolbar .roomtoggle') && document.getElementById('sort').labels.length > 0"), "[butik 390] the toolbar has no room toggle any more (founder's decision); sort keeps its label")
    ctx.close()

    # ------------------------------------------------------------ headings and names
    ctx, pg, errs = new(b, 1440, 900, False)
    go(pg, "produkt-lysa-keramiklampa", 700)
    ok(pg.evaluate("document.querySelectorAll('footer.site h2').length >= 4 && !document.querySelector('footer.site h4')"), "[headings] the footer's column headings are h2")
    ok(pg.evaluate("!document.querySelector('.ptab h3') && document.querySelectorAll('.ptab h2').length >= 2"), "[headings] the product tabs' headings are h2 under the h1")
    ok(pg.evaluate("[...document.querySelectorAll('.pg-item[data-gi]')].every((x) => !x.hasAttribute('aria-label'))"), "[names] the gallery buttons are named by their picture and the words on them")
    ok(pg.evaluate("document.querySelector('.tools .lang').getAttribute('aria-label').startsWith(document.querySelector('.tools .lang').textContent)"), "[names] the language button's name starts with what it shows")
    ctx.close()

    # ------------------------------------------------------------ axe-core
    if AXE.exists():
        src = AXE.read_text()
        RUN = """async () => { const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] }, resultTypes: ['violations'] });
          return r.violations.map((v) => v.id + ': ' + v.nodes.slice(0, 2).map((x) => x.target.join(' ')).join(' | ')); }"""
        for w, h in ((390, 844), (1440, 900)):
            for eve in (False, True):
                ctx, pg, errs = new(b, w, h, w < 700, eve=eve)
                for r in ["", "butik", "produkt-lysa-keramiklampa", "kassa", "svep", "mitt-rum", "hitta-ratt", "looks", "faq", "rum-vardagsrum"]:
                    go(pg, r, 500); pg.add_script_tag(content=src)
                    v = pg.evaluate(RUN)
                    ok(not v, f"[axe {w}{' evening' if eve else ''}] {r or 'home'}: {v[:3]}")
                go(pg, "butik", 500); pg.evaluate("RQ.shop.addToCart('lysa-keramiklampa::0', 2); RQ.openCart()"); pg.wait_for_timeout(600); pg.add_script_tag(content=src)
                v = pg.evaluate(RUN)
                ok(not v, f"[axe {w}{' evening' if eve else ''}] cart open: {v[:3]}")
                ctx.close()
    else:
        print(f"  (axe-core not found at {AXE}; set AXE=/path/to/axe.min.js to include the axe pass)")
    b.close()

print(f"{n - len(fails)} of {n} checks passed")
sys.exit(1 if fails else 0)
