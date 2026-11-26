#!/usr/bin/env python3
"""Real-device findings (BrowserStack, 26 nov: iPhone SE iOS 15.4, iPhone iOS 27, Galaxy S26, macOS Safari).
Run after `python3 tools/build.py`:  python3 test/device1.py
B1  product pages work when i18n.js cannot be parsed (Safari < 16.4 and its regex lookbehind) and when one widget throws
M1  Safari 15 CSS: container-unit and color-mix() fallbacks; p2 focus ring that follows round corners
M2, m1, m3, p6, p7  short screens (iPhone SE: 375 x 548) and desktop Svep chips
m4  search Enter and the Android Sök key; m5 the burger closes the menu; p1 toasts; p4 Kväll on the root; p5, polish 2-3 Mitt rum"""
import http.server, re, socketserver, sys, threading
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


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


class Srv(socketserver.ThreadingTCPServer):
    daemon_threads = True

    def handle_error(self, *a):
        pass


srv = Srv(("127.0.0.1", 0), lambda *a, **k: Handler(*a, directory=str(ROOT), **k))
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{srv.server_address[1]}/"
PROD = "produkt-glob-bordslampa-opalglas/"
R = "(s) => { const e = document.querySelector(s); if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; }"
DOCK_TOP = "(() => { const d = document.querySelector('.dock'); return d && getComputedStyle(d).display !== 'none' ? d.getBoundingClientRect().top : innerHeight; })()"
SAMPLE = """async (r) => { const im = new Image(); await new Promise((ok) => { im.onload = ok; im.src = 'assets/img/rum/' + r + '-1600.webp'; });
  await RQ.room.saveImage(im, { sample: true, map: r, type: r, name: r }); }"""


def go(pg, url):
    """open a page; the local test server now and then drops the very first connection, so once more then"""
    try:
        pg.goto(url)
    except Exception:
        pg.wait_for_timeout(500); pg.goto(url)


CRASH = "(() => { const s = document.querySelector('[data-err]'); return s ? s.dataset.err || 'crash' : null; })()"

# ---------------------------------------------------------------- static: what Safari 15 cannot run
JS = ROOT / "assets/js"
for name in ("site.min.js", "site-tools.min.js", "i18n.min.js"):
    text = (JS / name).read_text(encoding="utf-8")
    ok(not re.search(r"\(\?<[=!]", text), f"[B1] {name}: no regex lookbehind (Safari < 16.4 cannot parse the whole file)")
src = "\n".join((JS / f).read_text(encoding="utf-8") for f in ("data.js", "content.js", "commerce.js", "app.js", "room.js", "flow.js", "svep.js", "myhome.js", "auth.js", "account.js", "ai.js", "hem.js", "home.js", "seo.js", "studio.js", "hemsida.js"))
bare = [m.start() for m in re.finditer(r"(?<![\w.$])RQ_(LANG|EN|t|toEn|setLang)\b", src)]
ok(not bare, f"[B1] the shop's scripts read the language layer's globals through window. (a bare name throws when i18n.js failed): {len(bare)} bare")
css = (ROOT / "assets/css/site.css").read_text(encoding="utf-8")
mincss = (ROOT / "assets/css/site.min.css").read_text(encoding="utf-8")
# every declaration with color-mix() has a plain value of the same property right before it (Safari < 16.2 drops it)
missing = []
for sel, body in re.findall(r"([^{}]+)\{([^{}]*color-mix[^{}]*)\}", css):
    if re.match(r"\s*\d+%", sel.split(",")[0].strip()):
        continue  # a keyframe step
    decls = [d.strip() for d in body.split(";")]
    for i, d in enumerate(decls):
        m = re.match(r"(background(?:-color)?):\s*color-mix\(in srgb,[^)]*?\)?\s*(\d+)%\s*,\s*([^)]+)\)", d)
        if m and (int(m.group(2)) >= 50 or m.group(3).strip() != "transparent") and not any(x.startswith(m.group(1) + ":") and "color-mix" not in x for x in decls[:i]):
            missing.append(sel.strip()[-40:])
ok(not missing, f"[M1] solid backgrounds made with color-mix() have a plain colour first: {missing[:5]}")
for s in (".dock{", ".nav.solid,.nav.open{", ".buybar{", ".search{"):
    bodies = [m.group(1) for m in re.finditer(re.escape(s) + r"([^}]*)\}", css)]
    ok(any(re.search(r"background:var\(--(paper|bg)\);background:color-mix", x) for x in bodies), f"[M1] {s[:-1]} is not see-through without color-mix()")
ok("@supports not (top:1cqw){.card .qadd,.card .qv{top:0;margin-top:calc(125% - 3rem)}}" in mincss, "[M1] card quick add has a place without container units")
ok(mincss.count("@supports not (width:1lh)") >= 3 and "outline-color:transparent;box-shadow:0 0 0 3px var(--bg),0 0 0 5px var(--accent)" in mincss, "[p2] a shadow ring where an outline cannot follow round corners")
ok("font-feature-settings:inherit" in mincss.split("button,input,select,textarea{", 1)[1].split("}", 1)[0], "[p3] fields inherit the page's digits")
ok(re.search(r"(^|})html\{background:var\(--bg\)", mincss), "[p4] the root carries the page colour")

with sync_playwright() as p:
    b = p.chromium.launch()

    def new(W, H, mobile, eve=False, **kw):
        c = b.new_context(viewport={"width": W, "height": H}, is_mobile=mobile, has_touch=mobile, device_scale_factor=2 if mobile else 1, **kw)
        c.route(re.compile(r"^https?://(?!127\.0\.0\.1)"), lambda r: r.abort())
        c.add_init_script("try{localStorage.setItem('rumiq-consent', JSON.stringify({stats:false,marketing:false,at:'2026-01-01'}));" + ("localStorage.setItem('rumiq-ljus','kvall');" if eve else "") + "}catch(e){}")
        return c

    # ---------------------------------------------------------------- B1: i18n.js unreadable (Safari 15.4), and a widget that throws
    for W, H, mob in ((375, 548, True), (1440, 900, False)):
        tag = f"[B1 {W}]"
        c = new(W, H, mob)
        c.route(re.compile(r"i18n\.min\.js"), lambda r: r.fulfill(status=200, content_type="application/javascript", body="var x = /(?<=a)b/; @@@"))
        pg = c.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        for r in (PROD, "produkt-dagsljus-linnegardin-2-pack/"):
            go(pg, BASE + r); pg.wait_for_timeout(500)
            ok(pg.evaluate(CRASH) is None and pg.evaluate("!!document.querySelector('#view h1') && !!document.querySelector('#add')"), f"{tag} {r} draws without the language layer: {pg.evaluate(CRASH)}")
            ok(pg.evaluate("!!document.querySelector('#view .lk')"), f"{tag} {r} Leveranskoll is there")
        ok(not [e for e in errs if "RQ_LANG" in e or "not defined" in e], f"{tag} no ReferenceError: {[e for e in errs if 'defined' in e][:1]}")
        c.close()

        c = new(W, H, mob); pg = c.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        go(pg, BASE + "butik/"); pg.wait_for_timeout(500)
        # three widgets of the page fail: two while it is written, one while it starts
        pg.evaluate("RQ.delivery.html = () => { throw new Error('stub delivery'); }; RQ.homeFit.html = () => { throw new Error('stub homefit'); }; window.IntersectionObserver = function () { throw new Error('stub io'); }; RQ.partErrors.length = 0")
        pg.evaluate("location.hash = '#produkt-sand-keramikvas'"); pg.wait_for_timeout(700)
        ok(pg.evaluate(CRASH) is None, f"{tag} a product page with failing widgets is not the crash view: {pg.evaluate(CRASH)}")
        ok(pg.evaluate("document.querySelector('#view h1').textContent") == "Sand keramikvas" and pg.evaluate("!document.querySelector('#view .lk')"), f"{tag} the page is drawn, without the widget that failed")
        perr = pg.evaluate("RQ.partErrors.join(' | ')")
        ok("delivery" in perr and "homefit" in perr and "buybar" in perr, f"{tag} each failing part is noted on its own: {perr}")
        pg.click("#add"); pg.wait_for_timeout(300)
        ok(pg.evaluate("RQ.shop.cartCount()") == 1, f"{tag} the buy button still works")
        pg.click("#saveRoomBtn"); pg.wait_for_timeout(150)
        ok(pg.evaluate("!document.getElementById('listPanel').hidden"), f"{tag} later parts (Lägg i lista) still start")
        c.close()

    # ---------------------------------------------------------------- M1: the container-unit fallback puts the quick add where cqw does
    c = new(375, 548, True); pg = c.new_page(); go(pg, BASE + "butik/"); pg.wait_for_timeout(500)
    POS = "() => { const c = document.querySelector('.card'), q = c.querySelector('.qadd'), f = c.querySelector('.fav'), a = c.getBoundingClientRect(), r = q.getBoundingClientRect(); return [Math.round(r.top - a.top), Math.round(r.left - a.left), Math.round(f.getBoundingClientRect().bottom - a.top)]; }"
    a = pg.evaluate(POS)
    pg.add_style_tag(content=".card .qadd,.card .qv{top:0!important;margin-top:calc(125% - 3rem)!important}")
    f = pg.evaluate(POS)
    ok(abs(a[0] - f[0]) <= 1 and a[1] == f[1] and f[0] > f[2] + 40, f"[M1] without container units the quick add sits at the picture's foot, not on the heart: {a} vs {f}")
    c.close()

    # ---------------------------------------------------------------- short screens: nothing under the dock
    for W, H in ((375, 548), (390, 844), (360, 780)):
        for eve in (False, True):
            tag = f"[short {W}x{H}{' kväll' if eve else ''}]"
            c = new(W, H, True, eve); pg = c.new_page(); errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            go(pg, BASE); pg.wait_for_timeout(900)
            dt = pg.evaluate(DOCK_TOP)
            btns = pg.evaluate("() => [...document.querySelectorAll('.band.settle .btn')].map(e => e.getBoundingClientRect().bottom)")
            ok(btns and max(btns) <= dt - 4, f"{tag} m1 both start buttons above the dock: {btns} dock {dt}")
            go(pg, BASE + "svep/"); pg.wait_for_timeout(1200)
            dt = pg.evaluate(DOCK_TOP)
            sb = pg.evaluate("() => [...document.querySelectorAll('.sv-ctrl button')].filter(e => e.offsetParent).map(e => e.getBoundingClientRect().bottom)")
            ok(sb and max(sb) <= dt - 4, f"{tag} M2 Svep's buttons above the dock: {max(sb) if sb else None} dock {dt}")
            ok(pg.evaluate("document.querySelector('footer.site').getBoundingClientRect().top") >= H - 1, f"{tag} p6 the footer starts below the screen on Svep")
            pg.evaluate("['glob-bordslampa-opalglas::0','sand-keramikvas::0','lin-kuddfodral::0','strand-jutematta::0'].forEach(v => RQ.shop.addToCart(v, 1))")
            pg.evaluate("RQ.openCart()"); pg.wait_for_timeout(700)
            seen = pg.evaluate("() => { const d = document.querySelector('#cart').getBoundingClientRect(), go = document.querySelector('#cart footer .btn:not(.ghost)').getBoundingClientRect(); return [[...document.querySelectorAll('#cart .line')].filter(l => { const r = l.getBoundingClientRect(); return r.top >= d.top && r.bottom <= go.top; }).length, go.bottom <= innerHeight, go.left >= 0 && go.right <= innerWidth]; }")
            ok(seen[0] >= (2 if H < 700 else 2) and seen[1] and seen[2], f"{tag} m3 the cart shows more than one product and Till kassan in reach: {seen}")
            pg.evaluate("document.querySelector('#cart').scrollTop = 1e5; document.querySelector('#cart .body').scrollTop = 1e5"); pg.wait_for_timeout(200)
            ok(pg.evaluate("!!document.querySelector('#cart .sum.total') && document.querySelector('#cart .sum.total').getBoundingClientRect().bottom <= innerHeight"), f"{tag} m3 the total can be scrolled to")
            ok(not errs, f"{tag} no script errors {errs[:1]}")
            c.close()

    # ---------------------------------------------------------------- p1: the toast and the price row
    for W, H in ((375, 548), (360, 780), (390, 844)):
        c = new(W, H, True); pg = c.new_page(); go(pg, BASE + PROD); pg.wait_for_timeout(800)
        pg.evaluate("(H) => { const r = document.querySelector('.pinfo .priceline').getBoundingClientRect(); window.scrollBy(0, r.bottom - (H - 90)); }", H); pg.wait_for_timeout(500)
        pg.tap("#buybar.show #add2" if pg.evaluate(R, "#buybar.show #add2") else "#add"); pg.wait_for_timeout(600)
        t, pl = pg.evaluate(R, "#toast"), pg.evaluate(R, ".pinfo .priceline")
        ok(t and pl and (t[1] >= pl[3] or t[3] <= pl[1]), f"[p1 {W}x{H}] the cart toast does not cover the price and Prova i Mitt rum: toast {t} price {pl}")
        c.close()

    # ---------------------------------------------------------------- p2: the ring itself (modern and Safari 15 shape)
    c = new(390, 844, True); pg = c.new_page(); go(pg, BASE + "butik/"); pg.wait_for_timeout(500)
    pg.focus(".card .fav"); pg.keyboard.press("Tab"); pg.wait_for_timeout(100)
    st = pg.evaluate("(() => { const e = document.activeElement, c = getComputedStyle(e); return [e.className, c.outlineStyle, c.outlineWidth, c.borderRadius, c.boxShadow]; })()")
    ok(st[0] == "qadd" and st[1] == "solid" and st[2] == "2px" and st[4].count("rgb") == 1, f"[p2] the keyboard ring: accent outline over a page-coloured band: {st}")
    forced = "\n".join(re.findall(r"@supports not \(width:1lh\)\{(.*?\})\}", mincss))
    pg.add_style_tag(content=forced); pg.wait_for_timeout(50)
    st = pg.evaluate("(() => { const c = getComputedStyle(document.activeElement); return [c.outlineColor, c.boxShadow, c.borderRadius]; })()")
    ok(st[0] == "rgba(0, 0, 0, 0)" and st[1].count("rgb") == 2 and st[2] == "999px", f"[p2] Safari before 16.4: the same two tones as a shadow on the round button: {st}")
    c.close()

    # ---------------------------------------------------------------- m4: search Enter and the Android Sök key; m5 the burger
    for W, H, mob in ((360, 780, True), (1280, 720, False)):
        tag = f"[m4 {W}]"
        c = new(W, H, mob); pg = c.new_page(); go(pg, BASE + "butik/"); pg.wait_for_timeout(500)
        pg.evaluate("RQ.openSearch()"); pg.wait_for_timeout(300); pg.fill("#searchInput", "jutematta"); pg.wait_for_timeout(250)
        pg.locator("#searchInput").press("Enter"); pg.wait_for_timeout(600)
        ok("produkt-strand-jutematta" in pg.url, f"{tag} Enter on a single hit opens it: {pg.url}")
        go(pg, BASE + "butik/"); pg.wait_for_timeout(400)
        pg.evaluate("RQ.openSearch()"); pg.wait_for_timeout(300); pg.fill("#searchInput", "lampa"); pg.wait_for_timeout(250)
        pg.locator("#searchInput").press("Enter"); pg.wait_for_timeout(600)
        if mob:
            ok(pg.evaluate("document.activeElement.id") != "searchInput" and pg.evaluate("document.getElementById('search').classList.contains('open') && document.getElementById('search').contains(document.activeElement)") and pg.evaluate("document.querySelectorAll('#searchRes .card').length") == 3, f"{tag} on a phone Enter puts the keyboard away and stays on the hits")
        else:
            ok("produkt-" in pg.url, f"{tag} with a mouse Enter opens the marked first hit: {pg.url}")
        go(pg, BASE + "butik/"); pg.wait_for_timeout(400)
        pg.evaluate("RQ.openSearch()"); pg.wait_for_timeout(300); pg.fill("#searchInput", "jutematta"); pg.wait_for_timeout(250)
        # Android: the key during composition says 229, then the keyboard's Sök key submits the form
        pg.evaluate("const i = document.getElementById('searchInput'); i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Unidentified', keyCode: 229, bubbles: true })); i.form.requestSubmit()"); pg.wait_for_timeout(600)
        ok("produkt-strand-jutematta" in pg.url, f"{tag} the Android Sök key (a form submit) is heard")
        if mob:
            go(pg, BASE); pg.wait_for_timeout(400)
            bu = pg.evaluate(R, "#burger"); pg.tap("#burger"); pg.wait_for_timeout(700)
            cl = pg.evaluate(R, "#mnavClose")
            ok(cl and abs(cl[0] - bu[0]) <= 1 and abs(cl[2] - bu[2]) <= 1, f"[m5] the menu's close button sits where the burger is: {bu} {cl}")
            pg.mouse.click(bu[0] + 4, (bu[1] + bu[3]) / 2); pg.wait_for_timeout(500)
            ok(not pg.evaluate("document.getElementById('mnav').classList.contains('open')"), "[m5] a tap at the burger's place closes the menu")
            pg.evaluate("document.getElementById('burger').click()"); pg.wait_for_timeout(60); pg.evaluate("document.getElementById('burger').click()"); pg.wait_for_timeout(500)
            ok(not pg.evaluate("document.getElementById('mnav').classList.contains('open')") and pg.evaluate("document.getElementById('burger').getAttribute('aria-expanded')") == "false", "[m5] the burger itself closes what it opened")
        c.close()

    # ---------------------------------------------------------------- p4 Kväll on the root; p7 desktop Svep chips
    c = new(390, 844, True, eve=True); pg = c.new_page(); go(pg, BASE); pg.wait_for_timeout(400)
    ok(pg.evaluate("[getComputedStyle(document.documentElement).backgroundColor, document.querySelector('meta[name=theme-color]').content]") == ["rgb(25, 26, 24)", "#191A18"], "[p4] Kväll: the root and theme-color are dark")
    pg.evaluate("RQ.applyLight('dag', false)"); pg.wait_for_timeout(100)
    ok(pg.evaluate("[getComputedStyle(document.documentElement).backgroundColor, document.querySelector('meta[name=theme-color]').content]") == ["rgb(237, 237, 234)", "#EDEDEA"], "[p4] switching to Dag lightens both again")
    c.close()
    for W in (1024, 1180, 1280, 1440):
        c = new(W, 800, False); pg = c.new_page(); go(pg, BASE + "svep/"); pg.wait_for_timeout(700)
        rows = pg.evaluate("() => { const r = {}; document.querySelectorAll('.sv-scope .chip').forEach(c => { const t = Math.round(c.getBoundingClientRect().top); r[t] = (r[t] || 0) + 1; }); return Object.values(r); }")
        ok(min(rows) >= 2 or len(rows) == 1, f"[p7 {W}] no room chip alone on its row: {rows}")
        c.close()

    # ---------------------------------------------------------------- Mitt rum: p5, polish 2 and 3
    c = new(390, 844, True); pg = c.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    go(pg, BASE + "mitt-rum/"); pg.wait_for_timeout(300); pg.evaluate(SAMPLE, "vardagsrum")
    pg.evaluate("RQ.room.saveScene([]); ['plad-ullblandning-havre'].forEach((h) => RQ.room.add(h, true))")
    sp = pg.evaluate("RQ.room.scene()[0]")
    ok(sp["x"] - sp["w"] / 2 > 58 and sp["y"] < 71.5, f"[polish 3] a throw in the sample living room goes beside its own white throw: {sp}")
    pg.evaluate("RQ.room.saveScene([]); ['glob-bordslampa-opalglas', 'skrivbordsorganisator-ek'].forEach((h) => RQ.room.add(h, true))")
    sc = {it["h"]: it for it in pg.evaluate("RQ.room.scene()")}
    org = sc["skrivbordsorganisator-ek"]
    ok(org.get("y", 0) > 75 or org["x"] + org["w"] * 0.4 <= 84.7, f"[polish 2] the desk organiser does not hang over the side table's edge: {org}")
    go(pg, BASE + "butik/"); go(pg, BASE + "mitt-rum/"); pg.wait_for_timeout(900)
    pg.evaluate("RQ.room.openVariants(['dagsljus-linnegardin-2-pack', 'lin-kuddfodral'], () => {})"); pg.wait_for_timeout(700)
    im = pg.evaluate("[...document.querySelectorAll('.var-row img')].map(i => [i.className, getComputedStyle(i).objectFit])")
    ok(im == [["tall", "cover"], ["", "contain"]], f"[p5] the curtain fills its square in the colour sheet, the others show whole: {im}")
    pg.keyboard.press("Escape")
    ok(not errs, f"[Mitt rum] no script errors {errs[:1]}")
    c.close()


    # ---------------------------------------------------------------- second device run (D2-D10)
    ok(not re.search(r"\.pg-item[^{}]*\{[^}]*aspect-ratio:1/1;max-height", css), "[D2] no phone gallery slide sized by aspect-ratio with max-height (Safari 15 makes it narrow)")
    for W, Hh in ((375, 548), (390, 844)):
        c = new(W, Hh, True); pg = c.new_page(); go(pg, BASE + "produkt-forradsburkar-glas-ek-3-pack/"); pg.wait_for_timeout(700)
        ok(pg.evaluate("Math.round(document.querySelector('.pg-item').getBoundingClientRect().width)") == W, f"[D2 {W}] the first slide is the full width")
        ok(not pg.evaluate("document.getElementById('buybar').classList.contains('show')"), f"[D9 {W}] no buy bar over the name at load")
        pg.evaluate("window.scrollTo(0, document.querySelector('#add').getBoundingClientRect().bottom + scrollY + 40)"); pg.wait_for_timeout(500)
        ok(pg.evaluate("document.getElementById('buybar').classList.contains('show')"), f"[D9 {W}] the buy bar comes once you scroll")
        c.close()
    c = new(390, 844, True); pg = c.new_page(); go(pg, BASE); pg.wait_for_timeout(500)
    pg.tap("#burger"); pg.wait_for_timeout(400)
    ring = pg.evaluate("(() => { const c = getComputedStyle(document.activeElement); return [document.activeElement.id, document.documentElement.dataset.input === 'pointer', c.outlineStyle === 'none' || c.outlineColor === 'rgba(0, 0, 0, 0)', c.boxShadow]; })()")
    ok(ring[0] == "mnavClose" and ring[1] and ring[2] and ring[3] == "none", f"[D9] after a tap the menu's close button has the focus without a ring: {ring}")
    forcedq = re.search(r"(:root\[data-input=pointer\] :focus-visible[^{]*\{[^}]*\})", mincss)
    ok(forcedq and "outline-color:transparent!important" in forcedq.group(1), "[D9 X10] after a tap no ring anywhere the page sets the focus (Safari's own rings)")
    # X10: tap + then the cart opens and closes; the button the focus returns to has no ring
    go(pg, BASE + "butik/"); pg.wait_for_timeout(500)
    pg.tap(".card .qadd"); pg.wait_for_timeout(500); pg.evaluate("RQ.openCart()"); pg.wait_for_timeout(500); pg.tap("#cart .close"); pg.wait_for_timeout(800)
    st = pg.evaluate("(() => { const c = getComputedStyle(document.activeElement); return [document.activeElement.tagName + '.' + document.activeElement.className, c.outlineStyle === 'none' || c.outlineColor === 'rgba(0, 0, 0, 0)', c.boxShadow]; })()")
    ok(st[1] and st[2] in ("none", ""), f"[X10] after taps, the focus put back by the page shows no ring: {st}")
    pg.keyboard.press("Tab"); pg.keyboard.press("Shift+Tab"); pg.wait_for_timeout(100)
    ok(pg.evaluate("getComputedStyle(document.activeElement).outlineStyle") == "solid" and pg.evaluate("getComputedStyle(document.activeElement).outlineColor") != "rgba(0, 0, 0, 0)", "[D9] with the keyboard the ring is back")
    c.close()
    for W, Hh in ((375, 548), (402, 760)):
        c = new(W, Hh, True); pg = c.new_page(); go(pg, BASE + "svep/"); pg.wait_for_timeout(1000)
        for i in range(10):
            pg.evaluate("document.querySelector('.sv-b.yes').click()"); pg.wait_for_timeout(620)
        pg.wait_for_timeout(900)
        see = pg.evaluate(R, ".svep-result [data-hem-see]"); dt = pg.evaluate(DOCK_TOP)
        ok(see and see[3] <= dt - 2 and see[1] >= 0, f"[D4 {W}x{Hh}] after ten cards Se det i ditt rum is above the dock: {see} dock {dt}")
        go(pg, BASE + "mitt-rum/"); pg.wait_for_timeout(800)
        acts = pg.evaluate("() => [...document.querySelectorAll('.rm-empty-acts .btn')].map(e => e.getBoundingClientRect().bottom)"); dt = pg.evaluate(DOCK_TOP)
        ok(acts and acts[0] <= dt - 2 and (Hh < 600 or acts[-1] <= dt - 2), f"[D5 {W}x{Hh}] Mitt rum's way in is above the dock: {acts} dock {dt}")
        c.close()
    for W, Hh in ((375, 548), (800, 600), (1280, 720)):
        tag = f"[room {W}x{Hh}]"
        c = new(W, Hh, W < 800); pg = c.new_page(); go(pg, BASE + "mitt-rum/"); pg.wait_for_timeout(300); pg.evaluate(SAMPLE, "vardagsrum")
        pg.evaluate("RQ.room.saveScene([]); ['plad-ullblandning-havre', 'glob-bordslampa-opalglas'].forEach(h => RQ.room.add(h, true))")
        go(pg, BASE + "butik/"); go(pg, BASE + "mitt-rum/"); pg.wait_for_timeout(1200)
        pg.evaluate("(m) => { const t = document.querySelector('.rm-tools').getBoundingClientRect(); window.scrollBy(0, t.top - 70); }", 0); pg.wait_for_timeout(300)
        pg.evaluate("document.getElementById('rmMore').click()"); pg.wait_for_timeout(300)
        mn, nav = pg.evaluate(R, "#rmMenu"), pg.evaluate(R, "#nav")
        ok(mn and mn[1] >= nav[3], f"{tag} D6 the Mer menu is not under the header: {mn} nav {nav}")
        pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
        pg.evaluate("document.getElementById('rmStage').scrollIntoView({block:'start'})"); pg.wait_for_timeout(300)
        bb = pg.locator('.rm-item[data-h="plad-ullblandning-havre"]').bounding_box(); pg.mouse.click(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2); pg.wait_for_timeout(800)
        act, bar, it = pg.evaluate(R, "#rmAct"), pg.evaluate(R, ".rm-bar"), pg.evaluate(R, ".rm-item.sel")
        ok(not act or not bar or act[3] <= bar[1] + 1, f"{tag} D7 the chosen thing's tools are above the room's bar: {act} {bar}")
        ok(it and it[1] >= 50, f"{tag} D7 and the thing stays in sight: {it}")
        pg.evaluate("document.getElementById('rmStage').scrollIntoView({block:'start'})"); pg.wait_for_timeout(200); pg.evaluate("window.scrollBy(0, 200)"); pg.wait_for_timeout(300)
        bb = pg.locator('.rm-item[data-h="glob-bordslampa-opalglas"]').bounding_box(); pg.mouse.click(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2); pg.wait_for_timeout(600)
        pg.locator("[data-swap-open]:visible").first.click(); pg.wait_for_timeout(1000)
        pg.locator(".rm-swap-row .rm-alt").first.click(); pg.wait_for_timeout(1000)
        t, it = pg.evaluate(R, "#toast.show"), pg.evaluate(R, ".rm-item.sel")
        ok(t and it and (t[1] >= it[3] or t[3] <= it[1] or t[0] >= it[2] or t[2] <= it[0]), f"{tag} D8 the toast after Byt is not over the thing: toast {t} thing {it}")
        c.close()
    c = new(375, 548, True); pg = c.new_page(); go(pg, BASE + "svep/"); pg.wait_for_timeout(900)
    ok(pg.evaluate("(() => { const b = document.querySelector('.sv-card:last-child .sv-info b'); return b.scrollHeight <= b.clientHeight + 1; })()"), "[D10] the Svep card shows the whole name on a short phone")
    tops = []
    for i in range(6):
        pg.evaluate("document.querySelector('.sv-b.yes').click()"); pg.wait_for_timeout(650); tops.append(round(pg.evaluate("document.querySelector('.sv-deck').getBoundingClientRect().top")))
    ok(len(set(tops)) == 1, f"[D10] the card does not move when Din stil växer fram appears: {tops}")
    c.close()


    # ---------------------------------------------------------------- fourth device run (D1-D4, D8)
    ok(re.search(r"\.sv-info div b\{[^}]*hyphens:manual", mincss) and not re.search(r"\.sv-info div b\{[^}]*hyphens:auto", mincss), "[D8] product names in Svep are not hyphenated")
    c = new(360, 780, True); pg = c.new_page(); go(pg, BASE + "svep/"); pg.wait_for_timeout(900)
    pg.evaluate("(() => { const ch = document.querySelector('.sv-meta .sv-chip'); ch.hidden = false; ch.textContent = 'Din stil växer fram: Mjuk och ombonad'; const p = document.createElement('p'); p.style.height = '90px'; document.querySelector('.sv-head').appendChild(p); })()"); pg.wait_for_timeout(700)
    ok(pg.evaluate("Math.round(document.querySelector('.sv-meta').getBoundingClientRect().height)") <= 26, "[D1] the style pill keeps to one row")
    ok(pg.evaluate("document.querySelector('.sv-ctrl').getBoundingClientRect().bottom") <= pg.evaluate(DOCK_TOP) - 2, "[D1] when something above the card grows, the buttons are fitted above the dock again")
    pg.evaluate("RQ.applyLight('kvall', false)"); first = pg.evaluate("document.querySelector('meta[name=theme-color]')")
    ok(pg.evaluate("[document.querySelectorAll('meta[name=theme-color]').length, document.querySelector('meta[name=theme-color]').content]") == [1, "#191A18"], "[D2] Kväll: one theme-color tag, dark, at once")
    pg.evaluate("RQ.applyLight('dag', false)")
    ok(pg.evaluate("document.querySelector('meta[name=theme-color]').content") == "#EDEDEA", "[D2] and back to Dag")
    ok(pg.evaluate("document.documentElement.dataset.input") == "pointer", "[D3] a touch screen starts without rings")
    pg.focus('[data-dock="sparat"]'); pg.keyboard.press("Tab"); pg.wait_for_timeout(150)
    ring = pg.evaluate("(() => { const e = document.activeElement, c = getComputedStyle(e), d = document.querySelector('.dock').getBoundingClientRect(), r = e.getBoundingClientRect(), o = parseFloat(c.outlineOffset) + parseFloat(c.outlineWidth); return [document.documentElement.dataset.input || 'key', c.outlineStyle, r.right + o <= d.right && r.top - o >= d.top && r.bottom + o <= d.bottom]; })()")
    ok(ring[0] == "key" and ring[1] == "solid" and ring[2], f"[D3] with the keyboard the dock's ring shows, inside the dock's edge: {ring}")
    pg.evaluate("document.querySelector('.sv-b.no').dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))")
    ok(pg.evaluate("document.documentElement.dataset.input") == "pointer", "[D3] a click from a pointer (also a faked one) counts as a tap")
    c.close()
    c = new(375, 548, True); pg = c.new_page(); go(pg, BASE + "mitt-rum/"); pg.wait_for_timeout(300); pg.evaluate(SAMPLE, "vardagsrum")
    pg.evaluate("RQ.room.saveScene([]); ['glob-bordslampa-opalglas'].forEach(h => RQ.room.add(h, true))")
    go(pg, BASE + "butik/"); go(pg, BASE + "mitt-rum/"); pg.wait_for_timeout(1300)
    if pg.evaluate("!!document.getElementById('plSelf')"):
        pg.evaluate("document.getElementById('plSelf').click()"); pg.wait_for_timeout(1500)
    t, bar = pg.evaluate(R, ".rm-tools"), pg.evaluate(R, ".rm-bar")
    ok(t and bar and t[3] <= bar[1] + 1 and pg.evaluate(R, "#rmStage")[1] >= 40, f"[D4 375x548] Mitt rum's toolbar starts above the Hela rummet bar: {t} {bar}")
    c.close()

    b.close()

print(f"{n - len(fails)} of {n} checks passed")
sys.exit(1 if fails else 0)
