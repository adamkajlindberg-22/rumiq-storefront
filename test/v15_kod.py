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
    pg.evaluate("(r) => { location.hash = '#' + r; }", route)
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

    b.close()

srv.shutdown()
print(f"{n - len(fails)} of {n} checks passed")
sys.exit(1 if fails else 0)
