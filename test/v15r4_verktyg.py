#!/usr/bin/env python3
"""v15 round 4 checks for verktyg: the stylist never ends in a dead end and answers varied questions sensibly,
Svep on touch screens, the dock and top menu marks, Hitta rätt results, Sparat headings, Önska rows.
Run after `python3 tools/build.py`:  python3 test/v15r4_verktyg.py
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



ASK = "(([q, m]) => { const a = RQ.stylistAnswer(q, m || null); return { text: a.text.join(' '), picks: a.picks.map((p) => p.handle), names: a.picks.map((p) => p.name), cats: a.picks.map((p) => p.cat), rooms: a.picks.map((p) => p.rooms), tags: a.tags || [], help: a.help && a.help.route, unknown: a.unknown, hi: !!a.hi }; })"
LAST = "(() => { const m = [...document.querySelectorAll('#log .msg.ai')].pop(); return [m.innerText, m.querySelectorAll('.mini a').length, [...m.querySelectorAll('.mini small')].map(s => s.textContent)]; })()"

with sync_playwright() as p:
    b = p.chromium.launch()

    # ------------------------------------------------------------ the stylist: never a dead end, sensible answers to varied questions
    ctx, pg, errs = new(b, False)
    go(pg, "studio-stylist", 900)
    A = lambda q, m=None: pg.evaluate(ASK, [q, m])
    a = A("Något grönt till hallen under 300 kr")
    ok(len(a["picks"]) >= 2 and a["tags"][0] == "Närmast" and any("annan färg" in t for t in a["tags"]) and "Under 300 kr hittar jag inget" in a["text"], f"stylist: green for the hall under 300 kr shows the nearest and an in-budget card: {a}")
    a = A("Present till en kollega max 200 kr")
    ok(len(a["picks"]) == 1 and a["tags"] == ["Närmast"], f"stylist: a gift under 200 kr shows the nearest gift: {a['names']} {a['tags']}")
    a = A("Behöver en lampa till skrivbordet under 500 kr")
    ok(a["picks"] and all("lampa" in n.lower() for n in a["names"]), f"stylist: a desk lamp under 500 kr shows the nearest lamp, not a dead end: {a['names']}")
    a = A("hej")
    ok(a["hi"] and not a["picks"] and a["text"].startswith("Hej!"), f"stylist: a greeting is greeted back: {a['text']!r}")
    a = A("Do you ship to Norway?")
    ok(a["help"] == "frakt" and "Sverige" in a["text"] and not a["picks"], f"stylist: shipping abroad gets the delivery facts: {a['text'][:80]!r}")
    a = A("Hur tar jag hand om linne?")
    ok("40 °C" in a["text"] and a["picks"] and all("lin" in n.lower() for n in a["names"]), f"stylist: linen care gets the care text and linen things: {a['names']}")
    a = A("Jag vill ha en soffa")
    ok("Möbler har vi inte" in a["text"] and a["picks"], f"stylist: furniture we do not sell is said plainly: {a['text'][:60]!r}")
    a = A("Något rött till vardagsrummet")
    ok("Rött har vi inte" in a["text"] and a["picks"] and all("vardagsrum" in r for r in a["rooms"]), f"stylist: a colour we lack is said, with the nearest tone in the room: {a['names']}")
    a = A("Har ni gardiner?")
    ok(a["text"].startswith("Ja") and a["names"] and all("gardin" in n.lower() for n in a["names"]), f"stylist: 'har ni gardiner?' shows the curtains alone: {a['names']}")
    a = A("Vit vas")
    ok(a["names"] and all("vas" in n.lower() for n in a["names"]), f"stylist: the thing named comes alone: {a['names']}")
    a = A("Mitt sovrum är för mörkt")
    ok(a["names"] and all("lampa" in n.lower() for n in a["names"]), f"stylist: too dark means lamps, not candles: {a['names']}")
    a = A("Jag flyttar snart, vad behöver jag?")
    ok("Grattis till flytten" in a["text"] and "grafit" not in a["text"].lower(), f"stylist: moving is not read as 'svart': {a['text'][:60]!r}")
    a = A("Vad ska jag ge min mamma på födelsedagen?")
    ok(not a["unknown"] and a["picks"] and "uppskattade" in a["text"], f"stylist: a birthday gift question is understood: {a['text'][:60]!r}")
    a = A("Mina barn har för mycket leksaker överallt")
    ok(not a["unknown"] and a["picks"], f"stylist: toys everywhere is a storage question: {a['names']}")
    a = A("Badrummet ser tråkigt ut")
    ok("pläd" not in a["text"] and a["picks"] and all("badrum" in r for r in a["rooms"]), f"stylist: a dull bathroom gets bathroom advice, not throws: {a['text'][:60]!r}")
    a = A("Något i ek till köket")
    ok(a["names"] and " ek" in a["names"][0].lower(), f"stylist: 'i ek' puts oak things first: {a['names']}")
    a = A("Mitt vardagsrum känns kalt, hur gör jag det mysigare?")
    ok(len(set(a["cats"])) >= 2, f"stylist: equally good picks come from more than one category: {a['cats']}")
    # in the page: the labelled cards and the English
    say = lambda q: (pg.fill("#chatIn", q), pg.press("#chatIn", "Enter"), pg.wait_for_timeout(1000), pg.evaluate(LAST))[-1]
    r = say("Något grönt till hallen under 300 kr")
    ok(r[1] >= 2 and r[2][0] == "Närmast", f"stylist page: cards with their reason shown: {r[2]}")
    ok(not errs, f"stylist: no script errors {errs[:2]}")
    ctx.close()
    ctx, pg, errs = new(b, True, en=True)
    go(pg, "studio-stylist", 900)
    r = (pg.fill("#chatIn", "Something green for the hallway under 300 kr"), pg.press("#chatIn", "Enter"), pg.wait_for_timeout(1100), pg.evaluate(LAST))[-1]
    ok("closest" in r[0].lower() and r[2] and r[2][0] == "Closest" and "Närmast" not in r[0], f"stylist en: the nearest card in English: {r[0][-160:]!r}")
    ctx.close()

    # ------------------------------------------------------------ Svep on a touch tablet: gestures and button icons, no keys
    for touch in (True, False):
        ctx = b.new_context(viewport={"width": 1024, "height": 768}, device_scale_factor=2, has_touch=touch, is_mobile=False, locale="sv-SE") if touch else b.new_context(viewport={"width": 1440, "height": 900}, locale="sv-SE")
        ctx.route(re.compile(r"^https?://(?!127\.0\.0\.1)"), lambda r: r.abort())
        pg = ctx.new_page(); go(pg, "svep", 900)
        vis = pg.evaluate("(() => { const v = (s) => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none'; }; return [v('.sv-legend kbd'), v('.sv-legend .sv-ti'), v('.sv-legend .sv-tc')]; })()")
        txt = pg.evaluate("document.querySelector('.sv-after').innerText")
        if touch:
            ok(vis == [False, True, True] and "Klicka" not in txt, f"svep 1024 touch: swipe words and button icons, no keyboard keys: {vis} {txt[:40]!r}")
        else:
            ok(vis == [True, False, False], f"svep 1440 mouse: the keys stay: {vis}")
        ctx.close()

    # ------------------------------------------------------------ the dock and the top menu mark the same place
    ctx, pg, errs = new(b, True)
    go(pg, "", 800)
    for route, want in (("rum-hall", "butik"), ("rum", "butik"), ("for-dig", "upptack"), ("kollektioner", "upptack"), ("studio-stil", "upptack"), ("studio-stylist", "upptack"), ("hitta-ratt-ord", "upptack"), ("presentkort", "butik"), ("mitt-rum", "mitt"), ("studio", "mitt"), ("mitt-hem", "sparat"), ("looks", "upptack")):
        pg.evaluate(f"location.hash = '#{route}'"); pg.wait_for_timeout(300)
        got = pg.evaluate("[...document.querySelectorAll('[data-dock].on')].map(a => a.dataset.dock)")
        ok(got == [want], f"dock: #{route} marks {want}: {got}")
    ctx.close()
    ctx, pg, errs = new(b, False)
    go(pg, "", 800)
    for route, want in (("studio-stylist", "Upptäck"), ("studio-stil", "Upptäck"), ("rum-kok", "Butik"), ("for-dig", "Upptäck"), ("rosta", "Upptäck")):
        pg.evaluate(f"location.hash = '#{route}'"); pg.wait_for_timeout(300)
        got = pg.evaluate("[...document.querySelectorAll('#nav .menu > li > .active')].map(a => a.textContent.trim())")
        ok(got == [want], f"top menu: #{route} marks {want}: {got}")
    ctx.close()

    # ------------------------------------------------------------ Hitta rätt
    for mobile in (True, False):
        tag = "390" if mobile else "1440"
        ctx, pg, errs = new(b, mobile)
        go(pg, "hitta-ratt", 900)
        pg.click("[data-q=room] [data-v=hall]"); pg.wait_for_timeout(500); pg.click("[data-q=need] [data-v=ljus]"); pg.wait_for_timeout(1600)
        top = pg.evaluate("document.getElementById('gOut').getBoundingClientRect().top")
        nav = pg.evaluate("document.getElementById('nav').getBoundingClientRect().bottom")
        ok(nav <= top <= nav + 40, f"hitta rätt {tag}: the result lands right under the header ({top:.0f}, header {nav:.0f})")
        ok(pg.evaluate("[...document.querySelectorAll('#gOut .list-more .h3')].some(h => h.offsetHeight > 0 && /Mer för/.test(h.textContent))"), f"hitta rätt {tag}: the 'Mer för hall' heading is visible")
        if not mobile:
            cols = pg.evaluate("getComputedStyle(document.querySelector('#gOut .grid')).gridTemplateColumns.split(' ').length")
            ok(cols == 4, f"hitta rätt 1440: four across: {cols}")
        pg.fill("#gmax", "100"); pg.click("#gGo"); pg.wait_for_timeout(1300)
        ok(pg.evaluate("document.querySelectorAll('#gOut .card').length") > 0 and "närmast i pris" in pg.evaluate("document.getElementById('gOut').innerText"), f"hitta rätt {tag}: too low a price shows the nearest in price as cards")
        go(pg, "hitta-ratt-ord", 900)
        pg.fill("#ssIn", "grön matta under 200 kr"); pg.press("#ssIn", "Enter"); pg.wait_for_timeout(1300)
        names = pg.evaluate("[...document.querySelectorAll('#ssOut .card h3, #ssOut .card .name, #ssOut .card a[href*=produkt]')].map(e => e.textContent).join(' ')")
        ok("matta" in names.lower() and "Salvia" in pg.evaluate("document.getElementById('ssOut').innerText"), f"med egna ord {tag}: a green rug under 200 kr shows the rug and the colour understood: {names[:80]!r}")
        pg.fill("#ssIn", "Mjukt ljus till sovrummet"); pg.press("#ssIn", "Enter"); pg.wait_for_timeout(1300)
        first = pg.evaluate("[...document.querySelectorAll('#ssOut .card a[href*=produkt]')].slice(0, 6).map(a => a.getAttribute('href'))")
        ok(sum("lampa" in h for h in first) >= 3, f"med egna ord {tag}: 'mjukt ljus' brings lamps: {first}")
        ok(not errs, f"hitta rätt {tag}: no script errors {errs[:2]}")
        ctx.close()

    # ------------------------------------------------------------ the home Svep taster: one progress sign
    ctx, pg, errs = new(b, True)
    go(pg, "", 1000)
    shown = pg.evaluate("[...document.querySelectorAll('#svep-hem .sv-prog, #svep-hem .sv-meta')].filter(e => getComputedStyle(e).display !== 'none' && e.offsetHeight > 0).map(e => e.className)")
    ok(shown == ["sv-meta"], f"home svep: one progress sign ('1 av 3'), no bar above it: {shown}")
    ctx.close()

    # ------------------------------------------------------------ Sparat headings, Önska rows, konto counts
    ctx, pg, errs = new(b, True)
    go(pg, "mitt-hem", 900)
    heads = pg.evaluate("[...document.querySelectorAll('.mh .sec-head .h3')].filter(h => h.offsetHeight > 0).map(h => h.textContent)")
    ok(heads[:2] == ["Produkter", "Mina rum och mått"] and len(heads) == 6, f"sparat: every part has a visible heading: {heads}")
    ctx.close()
    ctx, pg, errs = new(b, False)
    go(pg, "onska", 900)
    ok(pg.evaluate("getComputedStyle(document.querySelector('.onska .vote-grid')).gridTemplateColumns.split(' ').length") == 4, "önska 1440: ideas four across")
    ctx.close()
    b.close()

print(f"{n - len(fails)} of {n} checks passed")
sys.exit(1 if fails else 0)
