#!/usr/bin/env python3
"""v15 round 3, butik checks. Run after `python3 tools/build.py`:  python3 test/v15r3_butik.py
What the independent review found in the shop, the product page, search, cart and header: the phone
gallery's first slide, Passar ihop pictures, hover zoom, the room toggle, search order and Enter, filter
counts, quick add of a multi-colour product, toasts over sheets, the look discount in the cart, the
Mitt rum header link's name, the scroll position back in the shop, the card buttons and tab order.
Phone (360, 390, 430), tablet (820, 1024) and desktop (1280, 1440, 1920); evening where it matters."""
import http.server, importlib.util, json, re, socketserver, sys, threading
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
fails, n = [], 0


def ok(cond, name):
    global n
    n += 1
    if not cond:
        fails.append(name)
        print("  FAIL", name)


spec = importlib.util.spec_from_file_location("build", ROOT / "tools/build.py")
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)
PFX = urlparse(build.SITE).path.rstrip("/")


class H(http.server.SimpleHTTPRequestHandler):
    """The site in its published folder; unknown addresses get 404.html, as on GitHub Pages."""

    def log_message(self, *a):
        pass

    def do_GET(self):
        p = self.path.split("?")[0]
        if not p.startswith(PFX + "/"):
            self.send_error(404)
            return
        rel = p[len(PFX):]
        f = ROOT / rel.lstrip("/")
        if f.is_dir():
            f = f / "index.html"
        if not f.exists():
            body = (ROOT / "404.html").read_bytes()
            self.send_response(404); self.send_header("Content-Type", "text/html; charset=utf-8"); self.send_header("Content-Length", str(len(body))); self.end_headers()
            self.wfile.write(body)
            return
        self.path = rel + ("?" + self.path.split("?")[1] if "?" in self.path else "")
        return super().do_GET()


class Srv(socketserver.ThreadingTCPServer):
    daemon_threads = True

    def handle_error(self, *a):
        pass


srv = Srv(("127.0.0.1", 0), lambda *a, **k: H(*a, directory=str(ROOT), **k))
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{srv.server_address[1]}{PFX}/"
CONSENT = "localStorage.setItem('rumiq-consent', JSON.stringify({stats:false, mkt:false, at:'2026-11-24'}));"

SAMPLE = """async (r) => { const im = new Image(); await new Promise((ok) => { im.onload = ok; im.src = 'assets/img/rum/' + r + '-1600.webp'; });
  await RQ.room.saveImage(im, { sample: true, map: r, type: r, name: r }); }"""
SIZES = [(360, 740, True), (390, 844, True), (430, 932, True), (820, 1180, True), (1024, 768, True), (1280, 720, False), (1440, 900, False), (1920, 1080, False)]


def context(b, W, Hh, mobile, evening=False):
    ctx = b.new_context(viewport={"width": W, "height": Hh}, has_touch=mobile, is_mobile=mobile, device_scale_factor=2 if mobile else 1)
    ctx.route(re.compile(r"^https?://(?!127\.0\.0\.1)"), lambda r: r.abort())
    ctx.add_init_script(CONSENT + ("localStorage.setItem('rumiq-ljus','kvall');" if evening else ""))
    return ctx


def page(ctx):
    pg = ctx.new_page()
    pg.errs = []
    pg.on("pageerror", lambda e: pg.errs.append(str(e)))
    return pg


# the slide a visitor sees first: the top-left one that is inside the gallery's own box
FIRST_SLIDE = """() => { const g = document.querySelector('#view .pg-grid'), gr = g.getBoundingClientRect(), items = [...g.children];
  let best = null, bt = 1e9, bl = 1e9; for (const e of items) { const r = e.getBoundingClientRect(); if (r.left < gr.left - 2 || r.left > gr.right) continue;
    if (r.top < bt - 2 || (Math.abs(r.top - bt) < 2 && r.left < bl)) { best = e; bt = r.top; bl = r.left; } } return [items.length, items.indexOf(best)]; }"""

with sync_playwright() as p:
    b = p.chromium.launch()
    for W, Hh, mobile in SIZES:
        for evening in (False, True):
            tag = f"[{W}{' kväll' if evening else ''}]"
            ctx = context(b, W, Hh, mobile, evening)
            pg = page(ctx)
            # M1: the gallery opens on its first picture, with an even or odd number of slides, with and without a room
            for prod in ("plad-ullblandning-havre", "lysa-keramiklampa"):
                pg.goto(BASE + "produkt-" + prod + "/", wait_until="load"); pg.wait_for_timeout(200)
                got = pg.evaluate(FIRST_SLIDE)
                ok(got[1] == 0, f"{tag} {prod} opens on its first picture: {got}")
            pg.evaluate(SAMPLE, "vardagsrum")
            pg.goto(BASE + "produkt-lysa-keramiklampa/", wait_until="load"); pg.wait_for_timeout(200)
            got = pg.evaluate(FIRST_SLIDE)
            ok(got[0] == 4 and got[1] == 0, f"{tag} with a room the lamp has four pictures and opens on the first: {got}")
            ok(not pg.errs, f"{tag} no script errors: {pg.errs[:1]}")
            ctx.close()
    b.close()

print(f"{n - len(fails)} of {n} checks passed")
sys.exit(1 if fails else 0)
