#!/usr/bin/env python3
"""The evaluation of 27 nov: Studio as its own page, three Svep buttons first, the full price struck through beside a
Svep-paket, the tool shown in the hero, the size you can see, a present and Christmas in the Leveranskoll, Mitt hem with
the empty parts together, a room marked done, Veckans rum, suggestions spread over the room. Run after `python3 tools/build.py`:
   python3 test/v15_10_utv.py"""
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


def new(b, mobile, en=False, consent=True):
    kw = dict(viewport={"width": 390, "height": 844} if mobile else {"width": 1440, "height": 900})
    if mobile:
        kw.update(is_mobile=True, has_touch=True, user_agent=UA)
    ctx = b.new_context(**kw)
    ctx.route(re.compile(r"^https?://(?!127\.0\.0\.1)"), lambda r: r.abort())
    init = "localStorage.setItem('rumiq-consent', JSON.stringify({ stats: true, at: '2026-11-27' }));" if consent else ""
    if en:
        init += "localStorage.setItem('rumiq-lang', JSON.stringify('en'));"
    ctx.add_init_script(init)
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    return ctx, pg, errs


with sync_playwright() as p:
    b = p.chromium.launch()
    for mobile in (True, False):
        tag = "390" if mobile else "1440"
        ctx, pg, errs = new(b, mobile)
        # Studio: its own page, three steps
        pg.goto(BASE + "studio/"); pg.wait_for_timeout(900)
        ok(pg.evaluate("document.querySelector('#view h1').textContent") == "Studio" and pg.evaluate("document.querySelectorAll('.st-step').length") == 3, f"{tag} /studio/ is the Studio page with three steps")
        ok(pg.evaluate("[...document.querySelectorAll('.st-step')].map((a) => a.getAttribute('href').replace(/^#|\\/$/g, ''))") == ["svep", "hitta-ratt", "mitt-rum"], f"{tag} Studio: Svep, Hitta rätt, Mitt rum in that order")
        # the hero is calm (founder 27 nov); the tool is shown in "Prova produkterna i ditt rum": pins, then the slide
        pg.goto(BASE); pg.wait_for_timeout(1200)
        ok(not pg.evaluate("!!document.querySelector('#hero .hdemo, #hero a.hdemo')"), f"{tag} the hero holds only the picture, the title and two buttons")
        ok(pg.evaluate("document.querySelectorAll('.bav .bav-pin').length") == 3 and pg.evaluate("document.querySelector('.bav .ba-range').value") == "100", f"{tag} the sample room waits as it is, with three pins to come")
        pg.evaluate("document.querySelector('.bav').scrollIntoView({ block: 'center' })"); pg.wait_for_timeout(1000)
        ok("pinning" in pg.evaluate("document.querySelector('.bav').className"), f"{tag} in view, the places are pointed out")
        pg.wait_for_timeout(3000)
        ok(pg.evaluate("[document.querySelector('.bav .ba-range').value, document.querySelector('.bav').classList.contains('placed')]") == ["31", True], f"{tag} then the picture slides to the room with the things in it")
        # Veckans rum
        wk = pg.evaluate("(() => { const s = document.getElementById('veckans-rum'); return s && [s.querySelector('.eyebrow').textContent, s.querySelectorAll('.wk-it').length, !!s.querySelector('[data-rh-try][data-rh-room]')]; })()")
        ok(wk and wk[0].startswith("Veckans rum · vecka ") and wk[1] >= 3 and wk[2], f"{tag} Veckans rum: one look this week, tried in its room: {wk}")
        pg.evaluate("document.querySelector('#veckans-rum [data-rh-try]').click()"); pg.wait_for_timeout(1500)
        ok(pg.evaluate("RQ.currentRoute()") == "mitt-rum" and pg.evaluate("RQ.room.scene().length") >= 3, f"{tag} Prova rummet opens Mitt rum with the look in it")
        # Svep: three buttons first, the rest after three answers
        pg.evaluate("localStorage.removeItem('rumiq-taste')")
        pg.goto(BASE + "svep/"); pg.wait_for_timeout(1000)
        vis = lambda: pg.evaluate("[...document.querySelectorAll('#svCtrl .sv-b')].filter((b) => b.offsetParent).map((b) => b.id)")
        ok(vis() == ["svNo", "svBag", "svYes"], f"{tag} a first round starts with Nej, Köp and Spara: {vis()}")
        pg.evaluate("document.getElementById('svYes').click()"); pg.wait_for_timeout(420)
        ok("svUndo" in vis() and "svLove" not in vis(), f"{tag} Ångra comes with the first answer: {vis()}")
        for _ in range(2):
            pg.evaluate("document.getElementById('svNo').click()"); pg.wait_for_timeout(420)
        ok(vis() == ["svUndo", "svNo", "svRoom", "svBag", "svYes", "svLove"], f"{tag} after three answers all six: {vis()}")
        # the size you can see; a present and Christmas
        pg.goto(BASE + "produkt-strand-jutematta/"); pg.wait_for_timeout(1000)
        ok(pg.evaluate("!!document.querySelector('#pt-matt .szf svg')") and "160 × 230 cm" in pg.evaluate("document.getElementById('pt-matt').textContent"), f"{tag} a product with measurements shows them and a figure to scale")
        ok("present" in (pg.evaluate("(document.querySelector('.lk-g') || {}).textContent") or ""), f"{tag} the Leveranskoll says it can be a present")
        xm = pg.evaluate("(() => { const c = RQ.delivery.cfg(); return [RQ.delivery.xmas(c, new Date(2026, 10, 27, 12)) ? 1 : 0, RQ.delivery.xmas(c, new Date(2026, 9, 27, 12)) ? 1 : 0, RQ.delivery.xmas(c, new Date(2026, 11, 22, 12)) ? 1 : 0]; })()")
        ok(xm == [1, 0, 0], f"{tag} the Christmas line shows in November, not in October, not when it is too late: {xm}")
        pg.goto(BASE + "produkt-glob-bordslampa-opalglas/"); pg.wait_for_timeout(900)
        ok(not pg.evaluate("!!document.querySelector('#pt-matt .szf')"), f"{tag} no figure without measurements")
        # the Svep-paket: the full price struck through
        pg.evaluate("RQ.shop.clearCart()")
        html = pg.evaluate("RQ.hem.slot({ type: 'vardagsrum', style: 'skandinavisk', from: 'svep', compact: true, prefer: ['lysa-keramiklampa', 'plad-ullblandning-havre', 'lin-kuddfodral'] })")
        ok("hem-was" in html and "<s" in html, f"{tag} a Svep-paket shows the full price struck through beside its own")
        # Mitt hem: the empty parts together; a room marked done
        pg.evaluate("RQ.hem.create({ label: 'Testrum', type: 'vardagsrum', items: [{ h: 'lysa-keramiklampa' }], budget: 2000 })")
        pg.goto(BASE + "mitt-hem/"); pg.wait_for_timeout(1100)
        nav = pg.evaluate("[...document.querySelectorAll('.jump-nav a')].map((a) => a.getAttribute('href'))")
        ok("#mh-chat" not in nav and "#mh-art" not in nav and pg.evaluate("!!document.querySelector('details.mh-quiet:not([open]) #mh-chat')"), f"{tag} Mitt hem: the menu names only what holds something, the rest waits closed: {nav}")
        ok("kvar av budgeten" in pg.evaluate("document.querySelector('.hem-card').textContent"), f"{tag} the room card says what is left of the budget")
        pg.click("[data-hem-done]"); pg.wait_for_timeout(700)
        ok(pg.evaluate("RQ.hem.rooms()[0].done") is True and pg.evaluate("document.querySelector('[data-hem-done]').getAttribute('aria-pressed')") == "true" and not pg.evaluate("!!document.querySelector('.hem-card [data-hem-next]')"), f"{tag} a room marked done says so and stops asking for the next step")
        ok(not errs, f"{tag} no page errors: {errs[:2]}")
        ctx.close()

    # suggestions spread over a sample room (not four by the side table)
    ctx, pg, errs = new(b, True)
    pg.goto(BASE); pg.wait_for_timeout(700)
    pg.evaluate("RQ.room.place({ room: 'vardagsrum', items: [] })"); pg.wait_for_timeout(1800)
    pg.click("#plSuggest"); pg.wait_for_timeout(1200)
    pins = pg.evaluate("RQ.room.pins().map((p) => [p.x, p.y])")
    crowd = max(sum(1 for q in pins if abs(q[0] - a[0]) < 9 and abs(q[1] - a[1]) < 8) for a in pins) if pins else 9
    ok(len(pins) >= 4 and crowd <= 3, f"suggestions spread over the room: {pins}")
    ok(not errs, f"suggest: no page errors: {errs[:2]}")
    ctx.close()

    # the cookie bar on a phone's home page is slim
    ctx, pg, errs = new(b, True, consent=False)
    pg.goto(BASE); pg.wait_for_timeout(1000); pg.evaluate("scrollTo(0, 700)"); pg.wait_for_timeout(1400)
    ck = pg.evaluate("(() => { const c = document.getElementById('cookie'); return [c.classList.contains('show'), c.getBoundingClientRect().height / innerHeight]; })()")
    ok(ck[0] and ck[1] < 0.13, f"phone home: the cookie bar takes less than an eighth of the screen: {ck}")
    ctx.close()

    # English
    ctx, pg, errs = new(b, False, en=True)
    pg.goto(BASE + "studio/"); pg.wait_for_timeout(1000)
    ok("Where do I start?" in pg.evaluate("document.body.innerText"), "en: Studio in English")
    pg.goto(BASE); pg.wait_for_timeout(1400)
    ok("Room of the week" in pg.evaluate("document.getElementById('veckans-rum').innerText"), "en: Veckans rum in English")
    ctx.close()
    b.close()

print(f"{n - len(fails)}/{n} ok")
sys.exit(1 if fails else 0)
