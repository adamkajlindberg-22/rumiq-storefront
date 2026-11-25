#!/usr/bin/env python3
"""v15 round 2, design checks. Run after `python3 tools/build.py`:  python3 test/v15r2_design.py
Visual consistency and the premium feel: evening glare, one page head and h1 size, one h3 size,
one image corner, one field shape, the Mitt rum toast, the 404 page, manifest icons and the tablet
layouts. Phone (390, 360) and desktop (1440, 1280); evening where it matters."""
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

# ---------------------------------------------------------------- files
man = json.loads((ROOT / "manifest.webmanifest").read_text(encoding="utf-8"))
sizes = {i["sizes"]: i["src"] for i in man["icons"]}
for s in ("192x192", "512x512"):
    ok(s in sizes and (ROOT / sizes[s]).exists(), f"manifest lists a {s} icon that exists")
    if s in sizes and (ROOT / sizes[s]).exists():
        ok("%dx%d" % Image.open(ROOT / sizes[s]).size == s, f"the {s} icon really is {s}")

# page heads that share the one pattern (crumbs, h1, lead)
HEADS = ["butik", "kategori-belysning-atmosfar", "rum-vardagsrum", "looks", "kollektioner", "hitta-ratt", "onska", "konto", "kassa",
         "om", "faq", "frakt", "kontakt", "magasin", "inspiration", "presentguiden", "erbjudanden", "favoriter", "upptack", "mitt-hem", "juridik-villkor"]
# where h3 is not an item heading on purpose: product card titles, tab titles, the room's colours, Upptäck's story
H3_OWN = ".card, .ptab, .rm-colors, .jr-copy, .svt-tx, .vtz, .svh-done, .cookie, .sheet, .promise, .signup"
# photo frames that are physical objects on purpose (Svep card, gift card, the card stacks) or round
IMG_OWN = ".sv-card, .gc-card, .svt-cards, .sv-nudge-cards, .hroom-im, .rp-img, .dr-img, .msg, .cutph"

RADII = """(own) => { const v = document.getElementById('view'), out = [];
  for (const e of v.querySelectorAll('img')) {
    const r = e.getBoundingClientRect(); if (!e.offsetParent || r.width < 80 || e.closest(own)) continue;
    let n = e, rad = '0px'; for (let i = 0; i < 4 && n && n !== v; i++) { const x = getComputedStyle(n).borderTopLeftRadius; if (x !== '0px') { rad = x; break; } n = n.parentElement; }
    if (rad !== '0px' && rad !== getComputedStyle(document.documentElement).getPropertyValue('--r-img').trim()) out.push(rad + ' ' + (n.className || n.tagName));
  } return out; }"""
FIELDS = """() => [...document.querySelectorAll('#view input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=hidden]):not([type=file]), #view select')]
  .filter((e) => e.offsetParent && !e.closest('.qty, .otp, .search, .pickbar')).map((e) => Math.round(e.getBoundingClientRect().height))"""

with sync_playwright() as p:
    b = p.chromium.launch()
    for W, Hh, mobile in ((390, 844, True), (360, 740, True), (1440, 900, False), (1280, 720, False)):
        tag = f"[{W}]"
        ctx = b.new_context(viewport={"width": W, "height": Hh}, has_touch=mobile, is_mobile=mobile, device_scale_factor=2 if mobile else 1)
        ctx.route(re.compile(r"^https?://(?!127\.0\.0\.1)"), lambda r: r.abort())
        ctx.add_init_script(CONSENT)
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))

        # one page head: the same h1 size and the same place for the h1 on every page that uses it
        sizes, tops = {}, {}
        for r in HEADS:
            pg.goto(BASE + r + "/", wait_until="load"); pg.wait_for_timeout(150)
            got = pg.evaluate("() => { const h = document.querySelector('#view .page-head h1'); return h ? [getComputedStyle(h).fontSize, Math.round(h.getBoundingClientRect().top + scrollY), !!h.parentElement.querySelector('.crumbs')] : null; }")
            ok(got is not None and got[2], f"{tag} {r} has the page head with crumbs")
            if got:
                sizes[r], tops[r] = got[0], got[1]
        ok(len(set(sizes.values())) == 1, f"{tag} one h1 size in every page head: {sorted(set(sizes.values()))}")
        ok(max(tops.values()) - min(tops.values()) <= 2, f"{tag} the h1 sits at the same height on every page: {min(tops.values())}..{max(tops.values())}")

        # one h3 size for item headings, one image corner, one field shape
        h3s, radii, fields = set(), [], set()
        for r in ["", "butik", "produkt-lysa-keramiklampa", "rum-vardagsrum", "looks", "look-mjuk-kvall", "mitt-hem", "kassa", "om", "kontakt", "magasin", "hitta-ratt", "erbjudanden", "onska", "inspiration", "kollektioner"]:
            pg.goto(BASE + (r + "/" if r else ""), wait_until="load"); pg.wait_for_timeout(150)
            h3s |= set(pg.evaluate("(own) => [...document.querySelectorAll('#view h3')].filter((e) => e.offsetParent && !e.closest(own)).map((e) => getComputedStyle(e).fontSize)", H3_OWN))
            radii += [f"{r}: {x}" for x in pg.evaluate(RADII, IMG_OWN)]
            fields |= set(pg.evaluate(FIELDS))
        ok(len(h3s) == 1, f"{tag} one h3 size for item headings: {sorted(h3s)}")
        ok(not radii, f"{tag} every photo frame has the one image corner: {radii[:3]}")
        ok(fields <= {44, 52}, f"{tag} fields are 52 px (as a button) or 44 px (compact): {sorted(fields)}")

        # the product page: the room and 3D boxes share the panel line, the buy button is the strong thing
        pg.goto(BASE + "produkt-lysa-keramiklampa/", wait_until="load"); pg.wait_for_timeout(200)
        same = pg.evaluate("() => { const a = document.querySelector('#view .roomcta'), l = document.querySelector('#view .lk'); return a && l && getComputedStyle(a).borderTopColor === getComputedStyle(l).borderTopColor && getComputedStyle(a).borderTopLeftRadius === getComputedStyle(l).borderTopLeftRadius; }")
        ok(same, f"{tag} Se den i ditt rum has the same line and corner as Leveranskoll")

        # Mitt rum: the toast after choosing a room covers no control
        pg.goto(BASE + "mitt-rum/", wait_until="load"); pg.wait_for_timeout(300)
        pg.click("#view [data-room-setup]"); pg.wait_for_timeout(400)
        pg.click("[data-room-sample]")
        try:
            pg.wait_for_selector("#toast.show", timeout=6000)
        except Exception:
            pass
        pg.wait_for_timeout(500)
        hit = pg.evaluate("""() => { const t = document.getElementById('toast'); if (!t.classList.contains('show')) return 'no toast';
          const r = t.getBoundingClientRect(); const under = [...document.querySelectorAll('#view button, #view a, #view input, .buybar button, #view .rm-hint, #view .small')].filter((e) => e.offsetParent).filter((e) => { const q = e.getBoundingClientRect(); return q.width && q.left < r.right && q.right > r.left && q.top < r.bottom && q.bottom > r.top; });
          return under.map((e) => e.textContent.trim().slice(0, 30)); }""")
        ok(hit == [], f"{tag} the Mitt rum toast covers no button or hint: {hit}")
        if not mobile:
            none = pg.evaluate("() => { const e = document.querySelector('#view .rm-none'); return e && e.offsetParent ? [getComputedStyle(e).display, Math.round(e.getBoundingClientRect().height)] : null; }")
            ok(none and none[0] == "block" and none[1] < 60, f"{tag} the empty I rummet sentence is one block of text: {none}")
            pg.goto(BASE + "look-mjuk-kvall/", wait_until="load"); pg.wait_for_timeout(200)
            row = pg.evaluate("() => { const r = document.querySelector('#view .looks-row'), v = [...r.children].filter((e) => e.offsetParent); return [r.scrollWidth <= r.clientWidth + 1, v.every((e) => e.getBoundingClientRect().right <= innerWidth)]; }")
            ok(row == [True, True], f"{tag} Fler looks shows whole cards without sideways scrolling: {row}")
        ok(not errs, f"{tag} no script errors: {errs[:1]}")
        ctx.close()

        # evening: filled buttons and photos do not glow
        ctx = b.new_context(viewport={"width": W, "height": Hh}, has_touch=mobile, is_mobile=mobile)
        ctx.route(re.compile(r"^https?://(?!127\.0\.0\.1)"), lambda r: r.abort())
        ctx.add_init_script(CONSENT + "localStorage.setItem('rumiq-ljus','kvall');")
        pg = ctx.new_page()
        pg.goto(BASE + "produkt-lysa-keramiklampa/", wait_until="load"); pg.wait_for_timeout(300)
        lum = pg.evaluate("""() => { const c = getComputedStyle(document.getElementById('add')).backgroundColor.match(/[\\d.]+/g).slice(0, 3).map((v) => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
          return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; }""")
        ok(pg.evaluate("document.documentElement.dataset.light === 'kvall'"), f"{tag} evening is on")
        ok(lum < 0.6, f"{tag} the evening buy button is warm stone, not white (luminance {lum:.2f})")
        ink = pg.evaluate("getComputedStyle(document.getElementById('add')).color")
        ok(ink in ("rgb(25, 26, 24)",), f"{tag} the evening buy button keeps dark text: {ink}")
        dim = pg.evaluate("() => { const i = [...document.querySelectorAll('#view img')].find((e) => e.offsetParent && e.getBoundingClientRect().width > 150); return i ? getComputedStyle(i).filter : ''; }")
        ok("brightness" in dim, f"{tag} evening photos are dimmed a little: {dim}")
        pg.goto(BASE + "konto/", wait_until="load"); pg.wait_for_timeout(300)
        sso = pg.evaluate("() => [...document.querySelectorAll('#view .sso')].filter((e) => e.offsetParent).map((e) => getComputedStyle(e).backgroundColor)")
        ok(sso and all(c == "rgb(19, 19, 20)" for c in sso), f"{tag} the sign-in buttons use the providers' dark style at night: {sso}")
        ctx.close()

    # ---------------------------------------------------------------- 404, tablets
    for W, Hh, mobile in ((390, 844, True), (1440, 900, False)):
        tag = f"[{W}]"
        ctx = b.new_context(viewport={"width": W, "height": Hh}, has_touch=mobile, is_mobile=mobile)
        ctx.route(re.compile(r"^https?://(?!127\.0\.0\.1)"), lambda r: r.abort())
        ctx.add_init_script(CONSENT)
        pg = ctx.new_page()
        resp = pg.goto(BASE + "produkt-ekbord-runt/", wait_until="load"); pg.wait_for_timeout(600)
        ok(resp.status == 404, f"{tag} a missing product answers 404")
        ok(pg.evaluate("document.getElementById('nfQ').value") == "ekbord runt", f"{tag} the 404 search is filled with the words of the address")
        ok(pg.evaluate("document.querySelectorAll('#view .nf-go a.chip').length") == 5 and pg.evaluate("document.querySelectorAll('#view .nf-pop .card').length") == 4, f"{tag} the 404 page offers five places and four products")
        pg.fill("#nfQ", "lampa"); pg.press("#nfQ", "Enter"); pg.wait_for_timeout(500)
        ok(pg.evaluate("document.getElementById('search').classList.contains('open') && document.getElementById('searchInput').value === 'lampa' && document.querySelectorAll('#searchRes .card').length > 0"), f"{tag} searching from the 404 page opens the search with hits")
        ctx.close()

    for W, Hh in ((1024, 768), (820, 1180)):
        tag = f"[{W}]"
        ctx = b.new_context(viewport={"width": W, "height": Hh}, has_touch=W < 900, is_mobile=W < 900)
        ctx.route(re.compile(r"^https?://(?!127\.0\.0\.1)"), lambda r: r.abort())
        ctx.add_init_script(CONSENT)
        pg = ctx.new_page()
        pg.goto(BASE + "butik/", wait_until="load"); pg.wait_for_timeout(300)
        w = pg.evaluate("Math.round(document.querySelector('#view .card').getBoundingClientRect().width)")
        ok(w >= 240, f"{tag} butik cards get the full width ({w} px)")
        pg.click("#toggleFilters"); pg.wait_for_timeout(500)
        fw = pg.evaluate("Math.round(document.getElementById('filters').getBoundingClientRect().width)")
        ok(pg.evaluate("document.getElementById('filters').classList.contains('show')") and fw <= 545, f"{tag} the filters open as a sheet of a phone's width ({fw} px)")
        pg.goto(BASE + "mitt-rum/", wait_until="load"); pg.wait_for_timeout(300)
        st = pg.evaluate("() => { const f = document.querySelector('#view .rm-empty .rh-fig'), t = document.querySelector('#view .rm-empty h2'); return f && t ? [Math.round(f.getBoundingClientRect().bottom), Math.round(t.getBoundingClientRect().top), Math.round(f.getBoundingClientRect().width)] : null; }")
        if W > Hh:  # r4: on a landscape tablet the picture stands beside the text, so 'Lägg in ditt rum' is on the first screen
            cta = pg.evaluate("Math.round(document.querySelector('#view .rm-empty [data-room-setup]').getBoundingClientRect().bottom)")
            ok(st and st[2] > 380 and cta <= Hh, f"{tag} the Mitt rum intro picture stands beside the text and the button is on the first screen: {st}, button {cta}")
        else:
            ok(st and st[0] <= st[1] and st[2] > 600, f"{tag} the Mitt rum intro picture stands above the text at full width: {st}")
        pg.goto(BASE + "butik/", wait_until="load"); pg.wait_for_timeout(200)
        pill = pg.evaluate("() => { const e = document.querySelector('.roompill'); return e && e.offsetParent ? getComputedStyle(e).whiteSpace : 'nowrap'; }")
        ok(pill == "nowrap", f"{tag} the Mitt rum pill stays on one line")
        ctx.close()
    b.close()

print(f"{n - len(fails)} of {n} checks passed")
sys.exit(1 if fails else 0)
