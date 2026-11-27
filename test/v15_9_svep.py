#!/usr/bin/env python3
"""Svep v15.9 (founder, 27 nov): filters (type incl. Nyheter, style, budget), Älskar and Favoriter "Från Svep",
Svep-paket 10 % from three things (cart and checkout), the saved sum on the deck, a whole look as a card, a duel,
the thing in your own room on the card, your own vote on the result, English. Run after `python3 tools/build.py`:
   python3 test/v15_9_svep.py
Phone 360 (touch) and desktop 1440."""
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
TOP = "(() => { const c = [...document.querySelectorAll('#svDeck .sv-card')].pop(); return c ? c.dataset.h : ''; })()"
WISH = "JSON.parse(localStorage.getItem('rumiq-wish') || '[]')"
LIVE = "(() => { const b = document.getElementById('svNo'); return !!(b && b.offsetParent); })()"


def new(b, mobile, en=False):
    kw = dict(viewport={"width": 360, "height": 740} if mobile else {"width": 1440, "height": 900})
    if mobile:
        kw.update(is_mobile=True, has_touch=True, user_agent=UA)
    ctx = b.new_context(**kw)
    ctx.route(re.compile(r"^https?://(?!127\.0\.0\.1)"), lambda r: r.abort())
    init = "localStorage.setItem('rumiq-consent', JSON.stringify({ stats: true, at: '2026-11-27' }));"
    if en:
        init += "localStorage.setItem('rumiq-lang', JSON.stringify('en'));"
    ctx.add_init_script(init)
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    return ctx, pg, errs


def click(pg, id_):
    pg.evaluate(f"document.getElementById('{id_}').click()")
    pg.wait_for_timeout(380)


with sync_playwright() as p:
    b = p.chromium.launch()
    for mobile in (True, False):
        tag = "360" if mobile else "1440"
        ctx, pg, errs = new(b, mobile)
        pg.goto(BASE + "svep/")
        pg.wait_for_timeout(1000)

        # filters: a type narrows the deck and says so; Nyheter is the newest eight
        pg.evaluate("document.querySelector('.sv-filter').open = true")
        pg.evaluate("document.querySelector('[data-svf=\"type:lampa\"]').click()")
        pg.wait_for_timeout(700)
        ok("Lampor" in pg.evaluate("document.querySelector('.sv-f-what').textContent"), f"{tag} the filter says what it shows")
        hs = pg.evaluate("[...document.querySelectorAll('#svDeck .sv-card')].map((c) => c.dataset.h)")
        ok(hs and all(re.search(r"lampa|ljus", h) for h in hs), f"{tag} a type filter shows only that kind: {hs}")
        pg.evaluate("document.querySelector('[data-svf=\"type:nytt\"]').click()")
        pg.wait_for_timeout(700)
        ok(re.search(r"av 8$", pg.evaluate("document.getElementById('svSeen').textContent") or "") is not None, f"{tag} Nyheter is the newest eight")
        pg.evaluate("document.querySelector('[data-svf=\"type:\"]').click()")
        pg.wait_for_timeout(700)
        ok(pg.evaluate("document.querySelector('.sv-f-what').textContent").startswith("Filtrera"), f"{tag} all kinds again")

        # Älskar, the saved sum, the look card (4), Kommer snart (6), the duel (8)
        ok(pg.evaluate("document.getElementById('svSum').hidden"), f"{tag} no sum before anything is saved")
        click(pg, "svLove")
        loved = pg.evaluate("Object.keys(RQ.wishSrc.all()).filter((h) => RQ.wishSrc.get(h) === 'love')")
        ok(len(loved) == 1, f"{tag} Älskar marks the thing as loved: {loved}")
        ok(re.match(r"Sparat 1 · [\d  ]+ kr", pg.evaluate("document.getElementById('svSum').textContent") or "") is not None, f"{tag} the sum counts what you saved")
        click(pg, "svYes")
        click(pg, "svYes")
        ok(pg.evaluate(TOP).startswith("look:"), f"{tag} card four is a whole look: {pg.evaluate(TOP)}")
        ok(pg.evaluate("document.getElementById('svRoom').disabled && document.getElementById('svLove').disabled"), f"{tag} a look has no Mitt rum or Älskar")
        ok(pg.evaluate("[...document.querySelectorAll('.sv-look-row img')].every((i) => i.getBoundingClientRect().height < 120)"), f"{tag} the look's things are small pictures, not the full card")
        n0, lk = pg.evaluate("RQ.shop.cartCount()"), pg.evaluate(TOP)
        k = pg.evaluate(f"RQ.LOOKS.find((l) => 'look:' + l.id === '{lk}').items.length")
        click(pg, "svBag")
        disc = pg.evaluate("RQ.shop.allDiscounts().map((d) => d.look.name)")
        ok(pg.evaluate("RQ.shop.cartCount()") == n0 + k, f"{tag} up on a look puts all of it in the cart")
        ok(len(disc) == 1, f"{tag} the whole look gets its discount: {disc}")
        click(pg, "svUndo")
        ok(pg.evaluate("RQ.shop.cartCount()") == n0 and pg.evaluate(TOP).startswith("look:"), f"{tag} undo takes the look out of the cart and shows it again")
        ok(pg.evaluate("JSON.parse(localStorage.getItem('rumiq-svep-looks') || '[]').length") == 0, f"{tag} undo forgets that the look was shown")
        w0 = len(pg.evaluate(WISH))
        click(pg, "svYes")
        w1 = len(pg.evaluate(WISH))
        ok(w1 > w0, f"{tag} right on a look saves its things ({w0} -> {w1})")
        click(pg, "svUndo")
        ok(len(pg.evaluate(WISH)) == w0, f"{tag} undo un-saves them")
        click(pg, "svYes")
        click(pg, "svYes")
        ok(pg.evaluate(TOP).startswith("soon:"), f"{tag} card six is Kommer snart: {pg.evaluate(TOP)}")
        click(pg, "svYes")
        click(pg, "svYes")
        d = pg.evaluate(TOP)
        ok(d.startswith("duel:"), f"{tag} card eight is a duel: {d}")
        if d.startswith("duel:"):
            a, bb = d[5:].split("|")
            ok(pg.evaluate("document.getElementById('svYes').disabled && document.getElementById('svBag').disabled"), f"{tag} a duel is not saved with Spara")
            ok(pg.evaluate("[...document.querySelectorAll('.sv-card.duel[aria-hidden=\"true\"] [data-duel-pick]')].every((x) => x.tabIndex === -1)"), f"{tag} a duel under the top card is not in the tab order")
            pg.locator(f".sv-card.duel [data-duel-pick='{bb}']").click()
            pg.wait_for_timeout(450)
            ok(pg.evaluate(TOP) != d and bb in pg.evaluate(WISH) and a not in pg.evaluate(WISH), f"{tag} a tap on one side saves that one only")
            ok(pg.evaluate(f"RQ.wishSrc.get('{bb}')") == "svep", f"{tag} the duel's pick comes from Svep")
            click(pg, "svUndo")
            ok(pg.evaluate(TOP) == d and bb not in pg.evaluate(WISH), f"{tag} undo brings the duel back")
            pg.locator(f".sv-card.duel [data-duel-pick='{a}']").click()
            pg.wait_for_timeout(450)
        while pg.evaluate(LIVE):
            click(pg, "svYes")
        pg.wait_for_timeout(700)
        ok("Du röstade på" in (pg.evaluate("(document.querySelector('.sv-vote') || {}).textContent") or ""), f"{tag} the result shows your own vote")
        # Svep-paket: the result's room proposal buys the round 10 % cheaper, and the cart says so
        buy = pg.evaluate("[...document.querySelectorAll('[data-hem-buy]')].map((x) => x.textContent)")
        ok(any("Köp allt" in x for x in buy) and "Svep-paket" in (pg.evaluate("(document.querySelector('.hem-bundle') || {}).textContent") or ""), f"{tag} the result offers the Svep-paket: {buy}")
        pg.evaluate("RQ.shop.clearCart && RQ.shop.clearCart()")
        pg.evaluate("document.querySelector('[data-hem-buy]').click()")
        pg.wait_for_timeout(700)
        rows = pg.evaluate("RQ.shop.allDiscounts().map((d) => [d.look.label || d.look.name, d.amount])")
        sub = pg.evaluate("RQ.shop.cartSubtotal()")
        pk = [r for r in rows if r[0] == "Svep-paket"]
        ok(pk and abs(pk[0][1] - round(sum(pg.evaluate("RQ.shop._bundles[0].items.map((h) => RQ.byHandle(h).price)")) * 0.1)) <= 1, f"{tag} the Svep-paket takes 10 %: {rows} of {sub}")
        pg.goto(BASE + "kassa/")
        pg.wait_for_timeout(900)
        ok("Svep-paket" in pg.evaluate("document.querySelector('#view').textContent"), f"{tag} the checkout shows the Svep-paket row")
        # Mitt hem: Favoriter can show what came from Svep and what you love
        pg.goto(BASE + "mitt-hem/")
        pg.wait_for_timeout(1000)
        chips = pg.evaluate("[...document.querySelectorAll('[data-favf]')].map((x) => x.textContent)")
        ok(any("Från Svep" in c for c in chips) and any("Älskar" in c for c in chips), f"{tag} Favoriter: Från Svep and Älskar: {chips}")
        ok(not errs, f"{tag} no page errors: {errs[:2]}")
        ctx.close()

    # the thing in your own room, on the card
    ctx, pg, errs = new(b, True)
    pg.goto(BASE + "svep/")
    pg.wait_for_timeout(900)
    ok(not pg.evaluate("!!document.querySelector('[data-sv-room]')"), "no room: no 'I ditt rum' on the card")
    pg.evaluate("""new Promise((res) => { const im = new Image(); im.onload = async () => { await RQ.room.saveImage(im, { src: 'assets/img/rum/vardagsrum-1600.webp', sample: true, type: 'vardagsrum', name: 'Vardagsrum' }); res(); }; im.src = 'assets/img/rum/vardagsrum-1600.webp'; })""")
    pg.evaluate("RQ.router()")
    pg.wait_for_timeout(800)
    pg.locator(".sv-card[aria-hidden=false] [data-sv-room]").click()
    pg.wait_for_timeout(2000)
    im = pg.evaluate("(() => { const i = document.querySelector('.sv-card[aria-hidden=false] [data-room-im]'); return i ? [i.classList.contains('on'), (i.getAttribute('src') || '').slice(0, 11), i.naturalWidth] : null; })()")
    ok(im and im[0] and im[1] == "data:image/" and im[2] > 300, f"with a room, 'I ditt rum' draws the thing in it: {im}")
    ok(pg.evaluate(TOP) and not pg.evaluate("RQ.sheet.isOpen()"), "the room picture opens nothing and decides nothing")
    ok(not errs, f"room card: no page errors: {errs[:2]}")
    ctx.close()

    # English: the new words and the sum
    ctx, pg, errs = new(b, False, en=True)
    pg.goto(BASE + "svep/")
    pg.wait_for_timeout(1000)
    click(pg, "svYes")
    pg.wait_for_timeout(300)
    ok(re.match(r"Saved 1 · [\d,]+ kr", pg.evaluate("document.getElementById('svSum').textContent") or "") is not None, "en: the sum is in English")
    click(pg, "svYes")
    click(pg, "svYes")
    ok("Whole look" in pg.evaluate("document.querySelector('.sv-card.look').innerText"), "en: the look card is in English")
    ok("Älskar" not in pg.evaluate("document.querySelector('.sv-ctrl').innerText"), "en: the controls are in English")
    ok(not errs, f"en: no page errors: {errs[:2]}")
    ctx.close()
    b.close()

print(f"{n - len(fails)}/{n} ok")
sys.exit(1 if fails else 0)
