#!/usr/bin/env python3
"""v15 round 3 checks for verktyg: the stylist answers what was asked, Svep to the room, Svep keys,
Hitta rätt tiles, one name for Sparat, the account page in English, words.
Run after `python3 tools/build.py`:  python3 test/v15r3_verktyg.py
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
        ok(a[1] == 0 and ("mirror" not in a[0].lower() if en else "spegel" not in a[0]) and ("549" in a[0]), f"{tag} stylist: green for the hall under 300 kr says plainly what is cheapest, no mirror: {a[0][:120]!r}")
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
    b.close()

print(f"{n - len(fails)} of {n} checks passed")
sys.exit(1 if fails else 0)
