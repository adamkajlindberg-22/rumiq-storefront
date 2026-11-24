#!/usr/bin/env python3
"""v15 round 2 checks for the words: one name for each thing, honest delivery and offer texts read from
config.js, specific descriptions, and English without Swedish leftovers. Phone (390) and desktop (1440).
Run after `python3 tools/build.py`:  python3 test/v15r2_texter.py
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
CONSENT = "try { localStorage.setItem('rumiq-consent', JSON.stringify({ stats: false, mkt: false, at: '2026-11-24' })); } catch (e) {}"
# change config.js values on the way in, to see that the pages read them instead of typing them
CFG = """Object.defineProperty(window, 'RQ_CONFIG', { configurable: true, set(v) { if (v) { v.delivery.minDays = 3; v.delivery.maxDays = 7; v.waitlist.offer = '15 % på första köpet när vi öppnar'; }
  Object.defineProperty(window, 'RQ_CONFIG', { value: v, writable: true, configurable: true }); }, get() { return undefined; } });"""
TEXT = "(sel) => [...document.querySelectorAll(sel)].map((e) => e.innerText).join(' ').replace(/\\s+/g, ' ')"
ATTRS = "(sel) => [...document.querySelectorAll(sel + ' [aria-label], ' + sel + ' [title]')].map((e) => (e.getAttribute('aria-label') || '') + ' ' + (e.getAttribute('title') || '')).join(' | ')"

# ---------------------------------------------------------------- the page heads the build wrote
heads = json.loads((ROOT / "assets/heads.json").read_text(encoding="utf-8"))["pages"]
ok(heads["svep"][0].startswith("Svep "), f"Svep is called Svep in its title: {heads['svep'][0]}")
ok(heads["looks"][0].startswith("Looks "), f"Looks is called Looks in its title: {heads['looks'][0]}")
ok(heads["delad"][0] == "Delad lista · RumIQ", f"the shared list has no second name: {heads['delad'][0]}")
ok(not any("AI-stylist" in h[0] + h[1] for h in heads.values()), "no page head calls the rule-based stylist an AI stylist")
prods = {k: v[1] for k, v in heads.items() if k.startswith("produkt-")}
ok(not any(d.endswith("Se den i ditt eget rum först.") for d in prods.values()), "product descriptions no longer share one tail")
rooms = {k: v[1] for k, v in heads.items() if re.match(r"^rum-[a-z]+$", k)}
ok(sum("Tryck på prickarna" in d for d in rooms.values()) <= 1, "room descriptions use each room's own tip")
ok(len(set(rooms.values())) == len(rooms), "every room description is its own")
lin = prods.get("produkt-lin-kuddfodral", "")
ok("Lin har en levande yta" in lin and re.search(r"\d kr\.", lin), f"a thin short text gets the product's own story: {lin}")

with sync_playwright() as p:
    b = p.chromium.launch()
    for tag, kw in (("390", dict(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2)),
                    ("1440", dict(viewport={"width": 1440, "height": 900}))):
        ctx = b.new_context(**kw)
        ctx.route(re.compile(r"^https?://(?!127\.0\.0\.1)"), lambda r: r.abort())
        ctx.add_init_script(CONSENT)
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))

        # 1. menus and footer: one name for each thing
        pg.goto(BASE, wait_until="networkidle"); pg.wait_for_timeout(500)
        mnav = pg.evaluate("[...document.querySelectorAll('#mnav a')].map((a) => a.textContent.trim())")
        for name in ("Looks", "Svep", "Sparat", "Mitt rum", "Studio Plus", "Hitta rätt", "Spåra min beställning", "Handla efter rum"):
            ok(name in mnav, f"{tag} phone menu names {name}")
        for old in ("Färdiga looks", "Hitta din stil", "Sparat och mina rum", "Rum att handla i", "Var är mitt paket?"):
            ok(old not in mnav, f"{tag} phone menu no longer says {old}")
        foot = pg.evaluate("[...document.querySelectorAll('footer.site a, #megaShop a')].map((a) => a.textContent.trim())")
        ok("Looks" in foot and "Färdiga looks" not in foot and "Efter rum" not in foot, f"{tag} footer and shop menu use Looks and Handla efter rum")
        ok(pg.evaluate("document.querySelector('.dock [data-dock=sparat]').textContent.trim()") == "Sparat", f"{tag} the dock says Sparat")

        # 2. the home page: delivery time is a goal, the offer comes from config.js
        why = pg.evaluate(TEXT, "#varfor")
        ok("Målet: hemma om 2–5 arbetsdagar" in why and "Hemma om" not in why.replace("Målet: hemma om", ""), f"{tag} home says the delivery time is a goal")
        lead = pg.evaluate(TEXT, "#bli-forst .lead")
        ok("10 % på första köpet när vi öppnar" in lead, f"{tag} home waiting list shows the offer from config.js")
        ok(pg.evaluate("[...document.querySelectorAll('#view .hcard, #view .pcard, #view [data-wish]')].every((b) => !/önskelist/i.test(b.getAttribute('aria-label') || ''))"), f"{tag} heart buttons do not say önskelista")

        # 3. a product: Leveranskoll and labels
        pg.goto(BASE + "produkt-glob-bordslampa-opalglas/", wait_until="networkidle"); pg.wait_for_timeout(500)
        ok("Målet: hos dig" in pg.evaluate(TEXT, ".lk"), f"{tag} Leveranskoll calls the date a goal")
        view = pg.evaluate(TEXT, "#view") + " " + pg.evaluate(ATTRS, "#view")
        ok(not re.search(r"[öÖ]nskelist|i mitt rum\b", view), f"{tag} product page uses Sparat and Mitt rum")
        ok("Listorna finns under Sparat" in pg.evaluate("document.getElementById('view').textContent"), f"{tag} the list popover points to Sparat")
        ok(pg.evaluate("[...document.querySelectorAll('#pt-matt a')].some((a) => a.textContent.trim() === 'Mitt rum')"), f"{tag} the size tab links to Mitt rum by its name")

        # 4. the checkout reads the delivery time from config.js and calls it a goal
        pg.evaluate("RQ.shop.addToCart('lin-kuddfodral::0', 1)")
        pg.goto(BASE + "kassa/", wait_until="networkidle"); pg.wait_for_timeout(500)
        ship = pg.evaluate(TEXT, ".ship-opt")
        ok(ship.count("Målet är 2–5 arbetsdagar") == 3 and "Leveranstid:" not in ship, f"{tag} checkout delivery options say the goal: {ship[:120]}")

        # 5. how it works and FAQ: no AI claims the stylist cannot back, Svep by its name
        pg.goto(BASE + "sa-fungerar-det/", wait_until="networkidle"); pg.wait_for_timeout(400)
        t = pg.evaluate(TEXT, "#view")
        ok("AI-stylist" not in t and "smarta sökningen" not in t and "stiltestet" not in t, f"{tag} how it works names the tools by their names")
        pg.goto(BASE + "faq/", wait_until="networkidle"); pg.wait_for_timeout(400)
        ok("AI-stylist" not in pg.evaluate("document.getElementById('view').textContent"), f"{tag} FAQ says stylisten")
        pg.goto(BASE + "looks/", wait_until="networkidle"); pg.wait_for_timeout(400)
        ok(pg.evaluate("document.querySelector('#view h1').textContent.trim()") == "Looks", f"{tag} the Looks page is called Looks")
        ok(not errs, f"{tag} no script errors: {errs[:2]}")
        ctx.close()

        # 6. other numbers in config.js reach the pages
        ctx = b.new_context(**kw)
        ctx.route(re.compile(r"^https?://(?!127\.0\.0\.1)"), lambda r: r.abort())
        ctx.add_init_script(CONSENT); ctx.add_init_script(CFG)
        pg = ctx.new_page()
        pg.goto(BASE, wait_until="networkidle"); pg.wait_for_timeout(500)
        ok("Målet: hemma om 3–7 arbetsdagar" in pg.evaluate(TEXT, "#varfor"), f"{tag} home delivery goal follows config.js")
        ok("15 % på första köpet" in pg.evaluate(TEXT, "#bli-forst .lead"), f"{tag} home offer follows config.js")
        pg.evaluate("RQ.shop.addToCart('lin-kuddfodral::0', 1)")
        pg.goto(BASE + "kassa/", wait_until="networkidle"); pg.wait_for_timeout(500)
        ok("Målet är 3–7 arbetsdagar" in pg.evaluate(TEXT, ".ship-opt"), f"{tag} checkout delivery goal follows config.js")
        ctx.close()

        # 7. English: the same names, no Swedish counts left
        ctx = b.new_context(**kw)
        ctx.route(re.compile(r"^https?://(?!127\.0\.0\.1)"), lambda r: r.abort())
        ctx.add_init_script(CONSENT + "try { localStorage.setItem('rumiq-lang', JSON.stringify('en')); } catch (e) {}")
        pg = ctx.new_page()
        pg.goto(BASE, wait_until="networkidle"); pg.wait_for_timeout(700)
        body = pg.evaluate(TEXT, "body")
        ok(not re.search(r"\b\d+ saker\b|\bsaker ·", body), f"{tag} English home has no Swedish counts")
        ok("Goal: at your door in 2–5 working days" in body, f"{tag} English home calls the delivery time a goal")
        ok("10% off" in body and "10 % off" not in body, f"{tag} English writes 10% the English way")
        en_menu = pg.evaluate("[...document.querySelectorAll('#mnav a')].map((a) => a.textContent.trim())")
        ok("Swipe" in en_menu and "Saved" in en_menu and "Looks" in en_menu and "Ready-made looks" not in en_menu, f"{tag} English menu: Swipe, Saved, Looks")
        pg.goto(BASE + "produkt-lin-kuddfodral/", wait_until="networkidle"); pg.wait_for_timeout(700)
        ok("Goal: at your door" in pg.evaluate(TEXT, ".lk"), f"{tag} English Leveranskoll calls the date a goal")
        ok(not re.search(r"wish ?list", pg.evaluate(ATTRS, "#view"), re.I), f"{tag} English labels say Save, not wishlist")
        ctx.close()
    b.close()

print(f"\n{n - len(fails)} of {n} checks passed")
sys.exit(1 if fails else 0)
