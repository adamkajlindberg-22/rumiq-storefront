#!/usr/bin/env python3
"""v14 checks. Run after `python3 tools/build.py`:  python3 test/v14.py
Part 1: every route opens without a script error, with content and without dead internal links.
Part 2: Mitt rum puts things where they belong, the toolbar, the shop cards, Hitta rätt, the stylist,
        merged tools and the small fixes. Mobile (390) and desktop (1280)."""
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
routes = [""] + (ROOT / "routes.txt").read_text().split()

SAMPLE = """async (r) => { const im = new Image(); await new Promise((ok) => { im.onload = ok; im.src = 'assets/img/rum/' + r + '-1600.webp'; });
  await RQ.room.saveImage(im, { sample: true, map: r, type: r, name: r }); }"""
SPOT = "(h) => { const it = RQ.room.scene().find((x) => x.h === h); return it ? [it.x, it.y, it.w] : null; }"

with sync_playwright() as p:
    b = p.chromium.launch()

    # ---------------------------------------------------------------- part 1: every route
    ctx = b.new_context(viewport={"width": 1280, "height": 900})
    ctx.route(re.compile(r"^https?://(?!127\.0\.0\.1)"), lambda r: r.abort())
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    links = set()
    for r in routes:
        errs.clear()
        f = ROOT / r / "index.html" if r else ROOT / "index.html"
        ok(f.exists(), f"page file exists: {r or 'home'}")
        html = f.read_text(encoding="utf-8")
        ok("blob:" not in html and "127.0.0.1" not in html, f"no build leftovers in {r or 'home'}")
        ok(len(re.search(r'<main id="view"[^>]*>(.*)</main>', html, re.S).group(1)) > 150, f"prerendered content: {r or 'home'}")
        for m in re.finditer(r'<a [^>]*href="([a-z0-9-]+)/"', html):
            links.add(m.group(1))
        pg.goto(BASE + (r + "/" if r else ""), wait_until="load")
        pg.evaluate("RQ.loadTools()")
        pg.wait_for_timeout(120)
        ok(not errs, f"no script error on {r or 'home'}: {errs[:1]}")
        ok(pg.evaluate("document.querySelector('#view h1, #view .h1, #view video, #view .hero') !== null"), f"view drawn: {r or 'home'}")
    for l in sorted(links):
        ok((ROOT / l / "index.html").exists(), f"internal link has a page: {l}/")
    ctx.close()

    # ---------------------------------------------------------------- part 2: features, two widths
    for W, Hh, mobile in ((390, 844, True), (1280, 900, False)):
        tag = f"[{W}]"
        ctx = b.new_context(viewport={"width": W, "height": Hh}, has_touch=mobile, is_mobile=mobile)
        ctx.route(re.compile(r"^https?://(?!127\.0\.0\.1)"), lambda r: r.abort())
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(BASE); pg.wait_for_timeout(300)
        pg.evaluate("document.getElementById('ckNeed') && document.getElementById('ckNeed').click()")
        pg.evaluate(SAMPLE, "vardagsrum")

        # 1. placement by kind
        for h in ["lysa-keramiklampa", "plad-ullblandning-havre", "affisch-linje-ekram", "flatad-forvaringskorg", "strand-jutematta", "lin-kuddfodral", "dagsljus-linnegardin-2-pack"]:
            pg.evaluate("(h) => RQ.room.add(h, true)", h)
        lamp, throw, art, basket, rug, cush = [pg.evaluate(SPOT, h) for h in ["lysa-keramiklampa", "plad-ullblandning-havre", "affisch-linje-ekram", "flatad-forvaringskorg", "strand-jutematta", "lin-kuddfodral"]]
        ok(60 < lamp[1] < 72 and lamp[0] > 70, f"{tag} lamp stands on the side table")
        ok(art[1] < 55, f"{tag} print hangs on the wall")
        ok(basket[1] > 78 and rug[1] > 90, f"{tag} basket and rug are on the floor")
        ok(55 < throw[0] < 86 and 60 < throw[1] < 76 and 55 < cush[0] < 86, f"{tag} throw and cushions are on the sofa")
        ok(lamp[2] < 12 and basket[2] < 12 and art[2] < 12, f"{tag} sizes follow real measurements (lamp {lamp[2]}, basket {basket[2]})")
        ok(rug[2] > 35, f"{tag} the rug is much wider than a lamp")
        pg.evaluate("RQ.room.add('sand-keramikvas', true)")
        vase = pg.evaluate(SPOT, "sand-keramikvas")
        ok(abs(vase[0] - lamp[0]) > 3, f"{tag} a second thing on the table stands beside the first")

        pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(700)
        order = pg.evaluate("[...document.querySelectorAll('#rmItems .rm-item')].map((e) => e.dataset.h)")
        ok(order[0] == "strand-jutematta", f"{tag} the rug is drawn first, under everything else")
        ok(pg.evaluate("getComputedStyle(document.querySelector('.rm-item.k-surface'), '::after').content") != "none", f"{tag} standing things cast a shadow")
        ok(pg.evaluate("document.querySelectorAll('#rmItems .rm-item.land').length") == 0, f"{tag} things already in the room do not land again")
        ok(pg.evaluate("!document.getElementById('rmHarm').hidden && document.getElementById('rmHmv').textContent.trim().length > 3 && parseFloat(document.getElementById('rmHm').style.width) > 0"), f"{tag} 'Går ihop' shows a word and a meter")
        ok(pg.evaluate("document.querySelector('.rm-colors .palette i') !== null"), f"{tag} the room's colours are shown in Mitt rum")

        # 4. toolbar: three actions and Mer
        tools = pg.evaluate("[...document.querySelectorAll('.rm-tools > .rm-tool, .rm-tools > .rm-morewrap > .rm-tool')].filter((e) => e.offsetParent).map((e) => e.textContent.trim())")
        ok(tools == ["Lägg till", "Inred åt mig", "Spara", "Mer"], f"{tag} toolbar is Lägg till, Inred åt mig, Spara, Mer: {tools}")
        ok(pg.evaluate("document.getElementById('rmMenu').hidden"), f"{tag} Mer is closed to begin with")
        pg.click("#rmMore")
        ok(pg.evaluate("!document.getElementById('rmMenu').hidden && document.querySelectorAll('#rmMenu button').length === 4"), f"{tag} Mer opens with four choices")
        pg.click("#rmNight"); pg.wait_for_timeout(100)
        ok(pg.evaluate("document.getElementById('rmStage').classList.contains('night') && document.getElementById('rmMenu').hidden"), f"{tag} Kväll dims the room and closes the menu")
        pg.click("#rmMore"); pg.click("#rmBefore")
        ok(pg.evaluate("document.getElementById('rmStage').classList.contains('before')"), f"{tag} Visa före hides the things")
        pg.click("#rmMore"); pg.keyboard.press("Escape")
        ok(pg.evaluate("document.getElementById('rmMenu').hidden && document.activeElement.id === 'rmMore'"), f"{tag} Escape closes Mer and focus returns")

        # 7. a new thing lands
        pg.evaluate("RQ.room.add('glod-doftljus-keramik', true)"); pg.wait_for_timeout(60)
        ok(pg.evaluate("document.querySelector('.rm-item[data-h=glod-doftljus-keramik]').classList.contains('land')"), f"{tag} a new thing lands softly")
        pg.wait_for_timeout(900)
        ok(pg.evaluate("document.getElementById('rmTotal').textContent.replace(/\\D/g, '') == String(RQ.room.total())"), f"{tag} the total ends on the right sum")

        # 6. merged tools
        ok(pg.evaluate("!document.querySelector('#view a[href*=kombinera], #view a[href*=studio-analys]')"), f"{tag} Mitt rum no longer links to the merged tools")
        for old, h1 in (("studio-kombinera", "Mitt rum"), ("studio-analys", "Mitt rum"), ("kollektioner", "Looks")):
            pg.goto(BASE + old + "/"); pg.wait_for_timeout(400)
            ok(pg.evaluate("document.querySelector('#view h1').textContent.trim()") == h1, f"{tag} {old} opens {h1}")
            head = (ROOT / old / "index.html").read_text(encoding="utf-8")
            ok(re.search(r'rel="canonical" href="[^"]*/(mitt-rum|looks)/"', head) is not None, f"{tag} {old} points its canonical at the new page")
        ok(pg.evaluate("document.querySelectorAll('#view a.colcard[href*=kollektion-]').length") == 3, f"{tag} Looks shows the three collections")
        pg.goto(BASE + "butik/"); pg.wait_for_timeout(500)
        ok(pg.evaluate("!document.querySelector('#view a[href*=jamfor], .mnav a[href*=jamfor], footer a[href*=jamfor]')"), f"{tag} Jämför is out of the menus")

        # 3. shop cards: photo first, room second
        first = pg.evaluate("(() => { const ph = document.querySelector('.card.in-room .ph'); return [ph.children[0].tagName, ph.children[0].getAttribute('src'), ph.children[1].className]; })()")
        ok(first[0] == "IMG" and "/img/p/" in first[1] and "inroom" in first[2], f"{tag} product photo first, room second")
        vis = pg.evaluate("(() => { const c = document.querySelector('.card.in-room'), ph = c.querySelector('.ph'), r = ph.getBoundingClientRect(), i = ph.children[0].getBoundingClientRect(), s = ph.children[1]; return [Math.abs(i.left - r.left) < 2, getComputedStyle(s).opacity, s.getBoundingClientRect().left - r.left]; })()")
        ok(vis[0] and (vis[1] == "0" or vis[2] > 50), f"{tag} the photo is what you see first: {vis}")
        if mobile:
            pg.evaluate("document.querySelector('.card.in-room .ph').scrollLeft = 9999"); pg.wait_for_timeout(400)
            ok(pg.evaluate("document.querySelector('.card.in-room').dataset.i") == "1", f"{tag} swiping to the room moves the dots")
        box = pg.evaluate("(() => { const c = document.querySelector('.card.in-room .inr'), p = c.querySelector('.inr-p').getBoundingClientRect(), r = c.getBoundingClientRect(); return [p.width / r.width, (p.left + p.width / 2 - r.left) / r.width]; })()")
        ok(0.12 < box[0] < 0.95 and 0.1 < box[1] < 0.9, f"{tag} the product sits inside the room crop: {box}")

        # 5. Hitta rätt and the stylist
        pg.goto(BASE + "hitta-ratt/"); pg.wait_for_timeout(500)
        ok(pg.evaluate("document.querySelectorAll('#view [data-q=room] button img').length === 7 && document.querySelectorAll('#view [data-q=need] button img').length === 4"), f"{tag} Hitta rätt: pictures in the answers")
        ok(pg.evaluate("[...document.querySelectorAll('#view .imgopts.pick button span')].every((s) => s.scrollWidth <= s.clientWidth + 1)"), f"{tag} Hitta rätt: labels fit under their pictures")
        pg.click("#view [data-q=room] button"); pg.click("#view [data-q=need] button"); pg.click("#gGo"); pg.wait_for_timeout(200)
        ok(pg.evaluate("document.querySelectorAll('#gOut .card').length") > 0, f"{tag} Hitta rätt gives suggestions")
        pg.goto(BASE + "hitta-ratt-present/"); pg.wait_for_timeout(500)
        ok(pg.evaluate("document.querySelectorAll('#view .imgopts.pick button img').length") == 11, f"{tag} gift tab: pictures in the answers")
        ok(pg.evaluate("[...document.querySelectorAll('#view img')].every((i) => i.complete && i.naturalWidth > 0 || i.loading === 'lazy')"), f"{tag} gift tab: pictures load")
        pg.goto(BASE + "studio-stylist/"); pg.wait_for_timeout(500)
        ok(pg.evaluate("document.querySelectorAll('#log #starters [data-try]').length") >= 5, f"{tag} stylist: starter questions in the conversation")
        pg.click("#starters [data-try]"); pg.wait_for_timeout(1000)
        ok(pg.evaluate("!document.getElementById('starters') && document.querySelectorAll('#log .msg.ai .mini a').length > 0"), f"{tag} stylist: a starter gives an answer with products")
        ok(pg.evaluate("document.querySelector('#log [data-inroom]') !== null"), f"{tag} stylist: 'Ställ in i mitt rum' after the answer")
        before = pg.evaluate("RQ.room.scene().length")
        pg.click("#log [data-inroom]"); pg.wait_for_timeout(200)
        ok(pg.evaluate("RQ.room.scene().length") >= before, f"{tag} stylist: suggestions go into the room")

        # 8. small fixes
        pg.goto(BASE + "mitt-hem/"); pg.wait_for_timeout(600)
        lab = pg.evaluate("(() => { const l = [...document.querySelectorAll('#hrForm .hr-grid label')]; if (!l.length) return null; const i = l.map((x) => x.querySelector('input,select').getBoundingClientRect().top - x.getBoundingClientRect().top); return [Math.max(...i.slice(0, 2)) - Math.min(...i.slice(0, 2)), l[1].textContent.includes('valfritt')]; })()")
        ok(lab is not None and lab[0] < 6 and lab[1], f"{tag} room form: fields line up beside each other: {lab}")
        ok("new URL(\"delad/\", document.baseURI)" in (ROOT / "assets/js/myhome.js").read_text(encoding="utf-8"), f"{tag} shared list link is built from the site root")
        # 9. checkout: nothing outside the screen, the total is reachable
        pg.goto(BASE + "produkt-lysa-keramiklampa/"); pg.wait_for_timeout(400)
        pg.evaluate("RQ.shop.addToCart('lysa-keramiklampa::0', 1); location.hash = '#kassa'"); pg.wait_for_timeout(700)
        co = pg.evaluate("(() => { const s = document.querySelector('#view .co-split'); return [document.documentElement.scrollWidth, innerWidth, ...[...s.children].map((c) => Math.round(c.getBoundingClientRect().right))]; })()")
        ok(co[0] <= co[1] and all(r <= co[1] for r in co[2:]), f"{tag} checkout fits the screen, summary included: {co}")
        ok(not errs, f"{tag} no script errors in the feature walk: {errs[:2]}")
        ctx.close()

    # tablet: the room form
    ctx = b.new_context(viewport={"width": 820, "height": 1180})
    ctx.route(re.compile(r"^https?://(?!127\.0\.0\.1)"), lambda r: r.abort())
    pg = ctx.new_page(); pg.goto(BASE + "mitt-hem/"); pg.wait_for_timeout(700)
    tops = pg.evaluate("[...document.querySelectorAll('#hrForm .hr-grid label')].slice(0, 2).map((x) => Math.round(x.querySelector('input,select').getBoundingClientRect().top))")
    ok(len(tops) == 2 and abs(tops[0] - tops[1]) < 6, f"[820] room form: Rum and Eget namn fields on one line: {tops}")
    ctx.close()

    # an own photo: no map, so the room learns where the customer puts things
    ctx = b.new_context(viewport={"width": 1280, "height": 900})
    ctx.route(re.compile(r"^https?://(?!127\.0\.0\.1)"), lambda r: r.abort())
    pg = ctx.new_page(); pg.goto(BASE); pg.wait_for_timeout(300)
    pg.evaluate("""async () => { const im = new Image(); await new Promise((ok) => { im.onload = ok; im.src = 'assets/img/rum/badrum-1600.webp'; }); await RQ.room.saveImage(im, { name: 'Mitt rum' }); RQ.room.add('lysa-keramiklampa', true); }""")
    ok(pg.evaluate("RQ.room.mapOf() === null"), "[own photo] no hand-made map is used")
    pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(600)
    pg.evaluate("document.getElementById('ckNeed') && document.getElementById('ckNeed').click()")
    el = pg.query_selector(".rm-item[data-h=lysa-keramiklampa]"); bb = el.bounding_box()
    pg.mouse.move(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2); pg.mouse.down(); pg.mouse.move(bb["x"] + 240, bb["y"] - 40, steps=6); pg.mouse.up(); pg.wait_for_timeout(150)
    a = pg.evaluate(SPOT, "lysa-keramiklampa")
    pg.evaluate("RQ.room.add('sand-keramikvas', true)")
    v = pg.evaluate(SPOT, "sand-keramikvas")
    ok(abs(v[1] - a[1]) < 0.2 and 3 < abs(v[0] - a[0]) < 25, f"[own photo] the next table thing lands beside the one you moved: lamp {a}, vase {v}")
    f0 = pg.evaluate("(() => { RQ.room.add('flatad-forvaringskorg', true); const it = RQ.room.scene().find((x) => x.h === 'flatad-forvaringskorg'); return [it.x, it.y, it.w]; })()")
    pg.wait_for_timeout(200)
    el = pg.query_selector(".rm-item[data-h=flatad-forvaringskorg]"); bb = el.bounding_box()
    pg.mouse.move(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2); pg.mouse.down(); pg.mouse.move(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2 - 90, steps=6); pg.mouse.up(); pg.wait_for_timeout(150)
    f1 = pg.evaluate(SPOT, "flatad-forvaringskorg")
    ok(f1[1] < f0[1] and f1[2] < f0[2], f"[own photo] a thing on the floor gets smaller further away: {f0} -> {f1}")
    ctx.close()

    # reduced motion: nothing lands
    ctx = b.new_context(viewport={"width": 390, "height": 844}, reduced_motion="reduce")
    ctx.route(re.compile(r"^https?://(?!127\.0\.0\.1)"), lambda r: r.abort())
    pg = ctx.new_page(); pg.goto(BASE); pg.wait_for_timeout(300); pg.evaluate(SAMPLE, "sovrum")
    pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(500); pg.evaluate("RQ.room.add('lysa-keramiklampa', true)"); pg.wait_for_timeout(80)
    ok(pg.evaluate("document.querySelectorAll('.rm-item.land').length") == 0, "[reduced motion] things appear without the landing")
    ctx.close()

    # English: the new texts are translated
    ctx = b.new_context(viewport={"width": 1280, "height": 900})
    ctx.route(re.compile(r"^https?://(?!127\.0\.0\.1)"), lambda r: r.abort())
    pg = ctx.new_page(); pg.goto(BASE); pg.wait_for_timeout(300)
    pg.evaluate("localStorage.setItem('rumiq-lang', JSON.stringify('en'))"); pg.evaluate(SAMPLE, "vardagsrum")
    pg.evaluate("['lysa-keramiklampa', 'plad-ullblandning-havre'].forEach((h) => RQ.room.add(h, true))")
    pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(900)
    txt = pg.evaluate("document.querySelector('.rm-tools').innerText + ' | ' + document.querySelector('.rm-colors').innerText + ' | ' + document.getElementById('rmHarm').innerText + ' | ' + document.querySelector('.rm-title').innerText")
    ok(all(w in txt for w in ("More", "The colours in your room", "Goes together", "Things land where they belong")) and not re.search(r"[åäö]", txt), f"[en] Mitt rum is in English: {txt[:200]}")
    ctx.close()
    b.close()

srv.shutdown()
print(f"{n - len(fails)} of {n} checks passed")
sys.exit(1 if fails else 0)
