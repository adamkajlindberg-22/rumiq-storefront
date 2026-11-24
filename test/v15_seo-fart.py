#!/usr/bin/env python3
"""v15 checks for the build, the page heads and what search engines are given.
Run after `python3 tools/build.py`:  python3 test/v15_seo-fart.py
Part 1 reads the built files. Part 2 opens pages in a browser (phone and desktop)."""
import hashlib, http.server, importlib.util, json, re, socketserver, sys, threading
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

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
SITE = build.SITE
PFX = urlparse(SITE).path.rstrip("/")  # the folder the site lives in when published ("/rumiq-storefront", or "" on its own domain)
routes = [""] + (ROOT / "routes.txt").read_text().split()
page = lambda r: ROOT / r / "index.html" if r else ROOT / "index.html"
url = lambda r: SITE + (r + "/" if r else "")


def head_of(text):
    return text[: text.index("</head>")]


def meta(head, key, attr="name"):
    m = re.search(rf'<meta {attr}="{re.escape(key)}" content="([^"]*)"', head)
    return m.group(1) if m else None


def lds(head):
    return [json.loads(x) for x in re.findall(r'<script type="application/ld\+json"[^>]*>(.*?)</script>', head, re.S)]


# ---------------------------------------------------------------- part 1: the built files
heads, titles, descs = {}, {}, {}
for r in routes:
    text = page(r).read_text(encoding="utf-8")
    h = heads[r] = head_of(text)
    tag = r or "home"
    t = re.findall(r"<title>(.*?)</title>", h)
    ok(len(t) == 1 and 10 <= len(t[0]) <= 70, f"one title of a sensible length: {tag}")
    d = meta(h, "description")
    ok(d is not None and 50 <= len(d) <= 160, f"description 50 to 160 characters: {tag} ({len(d or '')})")
    titles[r], descs[r] = (t[0] if t else ""), d or ""
    can = re.search(r'<link rel="canonical" href="([^"]*)"', h)
    ok(can is not None and can.group(1) == url(build.canonical_route(r)), f"canonical address: {tag}")
    ok(meta(h, "og:url", "property") == url(build.canonical_route(r)) and meta(h, "og:title", "property") is not None, f"sharing tags follow the page: {tag}")
    ok(meta(h, "robots") == "noindex", f"test site says noindex: {tag}")
    img = meta(h, "og:image", "property") or ""
    ok(img.startswith(SITE) and (ROOT / img[len(SITE):]).exists(), f"sharing image exists: {tag}")
    ok(f'<base href="{"./" if not r else "../"}">' in h, f"base address: {tag}")
    try:
        data = lds(h)
        ok(len(data) >= 1 and data[0]["@type"] == "OnlineStore", f"structured data reads, the shop first: {tag}")
    except ValueError:
        ok(False, f"structured data reads: {tag}")
        data = []
    for x in data:  # every picture a search engine is pointed at must exist
        for im in (x.get("image") if isinstance(x.get("image"), list) else [x.get("image")] if isinstance(x.get("image"), str) else []):
            ok(im.startswith(SITE) and (ROOT / im[len(SITE):]).exists(), f"structured data picture exists: {tag} {im[-40:]}")
    for name in ("assets/css/site.min.css", "assets/js/site.min.js", "assets/js/site-tools.min.js", "assets/js/config.js", "assets/js/i18n.min.js", "assets/js/i18n-en.min.js", "assets/heads.json"):
        m = re.search(re.escape(name) + r"\?v=([0-9a-f]{8})", text)
        ok(m is not None and m.group(1) == hashlib.sha1((ROOT / name).read_bytes()).hexdigest()[:8], f"{name} carries its own hash: {tag}")
    ok('src="assets/js/i18n.js"' not in text and "?v=d061b1d0" not in text, f"no unstamped script: {tag}")

shown = [r for r in routes if not build.is_hidden(r)]
ok(len(shown) == len({titles[r] for r in shown}), "every page that can be found has its own title")
ok(len(shown) == len({descs[r] for r in shown}), "every page that can be found has its own description")
ok(all(len(titles[r]) <= 60 for r in shown), "titles of findable pages are at most 60 characters: " + ", ".join(r for r in shown if len(titles[r]) > 60))
ok(not any(descs[r].startswith("Sedan") for r in routes), "no description starts in the middle of a thought")
prods = [r for r in routes if r.startswith("produkt-")]
ok(not any(descs[r].endswith("…") for r in prods), "no product description is cut off")
ok(all(re.search(r"\d kr\.", descs[r]) for r in prods), "product descriptions say the price")
ok("Rätt saker" in page("").read_text(encoding="utf-8") and "finns inte" not in re.search(r"<main.*?</main>", page("").read_text(encoding="utf-8"), re.S).group(0), "the start page shows the start page")
ok(not any("Du har tittat på" in page(r).read_text(encoding="utf-8") for r in prods), "product pages are drawn for a first visit (no 'Du har tittat på')")

for r in prods:
    data = lds(heads[r])
    p = next((x for x in data if x["@type"] == "Product"), None)
    ok(p is not None and p.get("sku") == r[8:] and len(p.get("image", [])) >= 2, f"product data has article number and pictures: {r}")
    o = (p or {}).get("offers", {})
    ok(o.get("priceCurrency") == "SEK" and re.fullmatch(r"\d+\.00", o.get("price", "")) and o.get("url") == url(r), f"offer has price and address: {r}")
    ok("shippingDetails" in o and o.get("hasMerchantReturnPolicy", {}).get("merchantReturnDays", 0) > 0, f"offer has shipping and returns: {r}")
    ok(f'{int(float(o.get("price", "0"))):,}'.replace(",", "\u00a0") + " kr" in descs[r], f"description and structured data agree on the price: {r}")
    bc = next((x for x in data if x["@type"] == "BreadcrumbList"), None)
    ok(bc is not None and len(bc["itemListElement"]) == 4 and "kategori-" in bc["itemListElement"][2].get("item", ""), f"breadcrumbs have the category: {r}")
for r in routes:
    types = [x["@type"] for x in lds(heads[r])]
    if r.startswith(("kategori-", "rum-", "kollektion-", "look-")) or r in ("butik", "looks", "magasin"):
        ok("CollectionPage" in types, f"list page has its list as structured data: {r}")
    if r.startswith("artikel-"):
        ok("Article" in types and "BreadcrumbList" in types, f"article has article data and breadcrumbs: {r}")
ok([x["@type"] for x in lds(heads[""])][:2] == ["OnlineStore", "WebSite"], "the start page names the site")
faq = next(x for x in lds(heads["faq"]) if x["@type"] == "FAQPage")
answers = {q["name"]: q["acceptedAnswer"]["text"] for q in faq["mainEntity"]}
ok("30 dagars öppet köp" in answers.get("Hur lång är ångerfristen?", "") and "14 dagars ångerrätt" in answers.get("Hur lång är ångerfristen?", ""), "FAQ: the return answer says 30 days open purchase and the legal 14")
ok("inte bekräftad" not in answers.get("Hur lång tid tar leveransen?", "") and "Målet är" in answers.get("Hur lång tid tar leveransen?", ""), "FAQ: delivery time is the goal, not denied")
ok("49 kr" in answers.get("Vad kostar frakten?", "") and "799 kr" in answers.get("Vad kostar frakten?", ""), "FAQ answers what shipping costs")

for r, target in list(build.ALIAS.items()) + [("mitt-rum-lysa-keramiklampa", "mitt-rum"), ("svep-rum-kok", "svep")]:
    if r in routes:
        ok(f'rel="canonical" href="{url(target)}"' in heads[r] and titles[r] == titles[target], f"{r} points at {target}")

sm = ET.parse(ROOT / "sitemap.xml").getroot()
locs = [e.text for e in sm.iter("{http://www.sitemaps.org/schemas/sitemap/0.9}loc")]
ok(sorted(locs) == sorted(url(r) for r in shown), f"sitemap lists exactly the findable pages ({len(locs)})")
ok(not any(url(r) in locs for r in ("kassa", "konto", "mitt-rum-lysa-keramiklampa", "studio", "svep-rum-kok")), "sitemap leaves out personal pages, aliases and near-copies")
ok((ROOT / "robots.txt").read_text() == "User-agent: *\nDisallow: /\n", "robots.txt keeps search engines out of the test site")
items = ET.parse(ROOT / "feed/products.xml").getroot().find("channel").findall("item")
g = "{http://base.google.com/ns/1.0}"
ok(len(items) == len(prods), f"product feed has every product ({len(items)})")
for it in items:
    r = "produkt-" + it.find(g + "id").text
    o = next(x for x in lds(heads[r]) if x["@type"] == "Product")["offers"]
    ok(it.find("link").text == url(r) and it.find(g + "price").text == o["price"] + " SEK", f"feed and page agree on address and price: {r}")
    ok(it.find(g + "shipping").find(g + "price").text == o["shippingDetails"]["shippingRate"]["value"] + " SEK", f"feed and page agree on shipping: {r}")

nf = (ROOT / "404.html").read_text(encoding="utf-8")
ok(f'<base href="{PFX}/">' in nf, "404.html starts its addresses from the site root")
ok(meta(head_of(nf), "robots") == "noindex" and "finns inte" in nf and 'rel="canonical"' not in nf, "404.html is hidden, says so and claims no address")
llms = (ROOT / "llms.txt").read_text(encoding="utf-8")
ok("30 dagars öppet köp" in llms and "49 kr till ombud" in llms and url("produkt-lysa-keramiklampa") in llms, "llms.txt states the facts and lists the products")
man = json.loads((ROOT / "manifest.webmanifest").read_text(encoding="utf-8"))
ok(man["name"] == "RumIQ" and all((ROOT / i["src"]).exists() for i in man["icons"]), "web manifest reads and its icons exist")
en = (ROOT / "assets/js/i18n-en.min.js").read_text(encoding="utf-8")
added = {}
for f in sorted((ROOT / "tools/i18n-add").glob("*.json")):
    added.update(json.loads(f.read_text(encoding="utf-8")))
ok(all(json.dumps(k, ensure_ascii=False) + ":" + json.dumps(v, ensure_ascii=False) in en for k, v in added.items()), f"every pair in tools/i18n-add is in the English dictionary ({len(added)})")
ok((ROOT / "assets/js/i18n-en.js").read_text(encoding="utf-8").rstrip() in en, "the original English dictionary is kept whole")
heads_json = json.loads((ROOT / "assets/heads.json").read_text(encoding="utf-8"))
ok(heads_json["site"] == SITE and all((r or "hem") in heads_json["pages"] for r in routes), "heads.json has every page")
ok(not any(d.is_dir() and d.name not in routes and not d.name.startswith(".") and d.name not in build.KEEP_DIRS and (d / "index.html").exists() for d in ROOT.iterdir()), "no folder is left from a route that is gone")

# the launch switch, without building: the same head with the switch on
build.LAUNCH = True
m = {"title": "T", "description": "D", "canonical": "butik", "noindex": build.is_hidden("butik"), "og_type": "website", "image": "assets/img/og.jpg", "ld": [], "extra": []}
ok('content="index,follow,max-image-preview:large"' in build.render_head("butik", m, "<head><base href=\"./\"><!--seo--></head>"), "launch: a shop page can be found")
m["noindex"] = build.is_hidden("kassa")
ok('content="noindex,follow"' in build.render_head("kassa", m, "<head><!--seo--></head>"), "launch: the checkout stays hidden")
ok(all(build.is_hidden(r) for r in ("konto", "mitt-rum-lysa-keramiklampa", "svep-rum-kok", "studio", "rosta", "nyheter")) and not any(build.is_hidden(r) for r in ("", "butik", "mitt-rum", "svep", "faq", "produkt-lysa-keramiklampa")), "launch: the right pages are hidden")
build.LAUNCH = False


# ---------------------------------------------------------------- part 2: in the browser
class H(http.server.SimpleHTTPRequestHandler):
    """Serves the site in its published folder and answers unknown addresses with 404.html, as GitHub Pages does."""

    def log_message(self, *a):
        pass

    def do_GET(self):
        p = self.path.split("?")[0]
        if not p.startswith(PFX + "/"):
            self.send_error(404)
            return
        rel = p[len(PFX):]
        f = ROOT / rel.lstrip("/")
        if f.is_dir() and not rel.endswith("/"):
            self.send_response(301); self.send_header("Location", p + "/"); self.end_headers()
            return
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
HEAD = "() => ({ t: document.title, d: document.querySelector('meta[name=description]').content, c: document.querySelector('link[rel=canonical]').href, o: document.querySelector('meta[property=\"og:url\"]').content, products: [...document.querySelectorAll('script[type=\"application/ld+json\"]')].filter((s) => JSON.parse(s.textContent)['@type'] === 'Product').length })"

with sync_playwright() as p:
    b = p.chromium.launch()
    for W, Hh, mobile in ((390, 844, True), (1440, 900, False)):
        tag = f"[{W}]"
        ctx = b.new_context(viewport={"width": W, "height": Hh}, has_touch=mobile, is_mobile=mobile)
        ctx.route(re.compile(r"^https?://(?!127\.0\.0\.1)"), lambda r: r.abort())
        pg = ctx.new_page()
        errs, reqs, bad = [], [], []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("request", lambda r: reqs.append(r.url))
        pg.on("response", lambda r: bad.append(r.url) if r.status >= 400 and "127.0.0.1" in r.url else None)

        # the head the build wrote is still there when the script has started
        pg.goto(BASE + "produkt-lysa-keramiklampa/"); pg.wait_for_timeout(900)
        h = pg.evaluate(HEAD)
        ok(h["t"] == titles["produkt-lysa-keramiklampa"], f"{tag} the product title is the built one after start: {h['t']}")
        ok(h["products"] == 1, f"{tag} one product in the structured data, not two ({h['products']})")
        # ... and follows when the view changes without a new page
        pg.evaluate("location.hash = '#produkt-sand-keramikvas'"); pg.wait_for_timeout(1200)
        h = pg.evaluate(HEAD)
        ok(h["t"] == titles["produkt-sand-keramikvas"] and h["d"] == descs["produkt-sand-keramikvas"], f"{tag} title and description follow to the next product: {h['t']}")
        ok(h["c"] == url("produkt-sand-keramikvas") and h["o"] == h["c"], f"{tag} canonical address follows: {h['c']}")
        ok(h["products"] == 1, f"{tag} still one product in the structured data ({h['products']})")
        pg.evaluate("location.hash = '#mitt-rum-sand-keramikvas'"); pg.wait_for_timeout(1500)
        ok(pg.evaluate(HEAD)["c"] == url("mitt-rum"), f"{tag} a near-copy points at the real page while browsing too")
        pg.evaluate("location.hash = '#butik'"); pg.wait_for_timeout(1000)
        ok(pg.evaluate(HEAD)["t"] == titles["butik"], f"{tag} the shop title follows")
        ok(not errs, f"{tag} no script error: {errs[:1]}")

        # files that are not needed are not fetched
        reqs.clear(); bad.clear()
        pg.goto(BASE + "butik/"); pg.wait_for_timeout(1500)
        ok(not any("italic" in u for u in reqs), f"{tag} the italic font is not fetched")
        ok(not any("rumiq-vit" in u for u in reqs), f"{tag} the evening logo is not fetched in day light")
        ok(not any("rumiq-grafit.webp" in u for u in reqs) and any("rumiq-grafit-288" in u for u in reqs), f"{tag} the small logo is used")
        ok(pg.evaluate("(() => { const i = document.querySelector('.nav-logo .logo-day'); return i.complete && i.naturalWidth === 288 && i.getBoundingClientRect().height > 20; })()"), f"{tag} the logo shows")
        feature = "document.querySelector('#megaShop .feature img')"
        ok(pg.evaluate(f"!{feature}.complete || {feature}.naturalWidth === 0"), f"{tag} the menu photos wait until the menu opens")
        ok(not bad, f"{tag} nothing missing on the shop page: {bad[:2]}")
        if not mobile:
            pg.hover("[data-mega=megaShop]"); pg.wait_for_timeout(1200)
            ok(pg.evaluate(f"{feature}.complete && {feature}.naturalWidth > 0 && {feature}.getBoundingClientRect().width > 100"), f"{tag} the menu photos show when the menu is open")
            pg.mouse.move(700, 800); pg.wait_for_timeout(300)
        pg.evaluate("localStorage.setItem('rumiq-ljus', 'kvall')"); pg.goto(BASE + "butik/"); pg.wait_for_timeout(900)
        ok(pg.evaluate("(() => { const i = document.querySelector('.nav-logo .logo-night'); return i.complete && i.naturalWidth === 288 && getComputedStyle(i).display !== 'none'; })()"), f"{tag} evening: the light logo shows")
        pg.evaluate("localStorage.removeItem('rumiq-ljus')")

        # an address that does not exist, at any depth, gets a whole page
        for path in ("finns-inte", "finns-inte/", "a/b/", "butik/sida-2/"):
            bad.clear()
            resp = pg.goto(BASE + path); pg.wait_for_timeout(700)
            styled = pg.evaluate("getComputedStyle(document.body).fontFamily.includes('Familjen') && typeof RQ === 'object' && !!document.querySelector('#view h1')")
            ok(resp.status == 404 and styled and not [u for u in bad if u != BASE + path], f"{tag} /{path} is a whole 404 page")
            ok("finns inte" in pg.evaluate("document.querySelector('#view h1').textContent"), f"{tag} /{path} says the page does not exist")
        pg.goto(BASE + "finns-inte/"); pg.wait_for_timeout(500)
        pg.click("#view a.btn.ghost"); pg.wait_for_timeout(900)
        ok(pg.evaluate("location.pathname") == PFX + "/butik/" and pg.evaluate("document.querySelector('#view h1').textContent.trim()") == "Alla produkter", f"{tag} the way out of the 404 page works")

        # one story about returns and delivery
        facts = pg.evaluate("RQ.facts")
        cfg = pg.evaluate("window.RQ_CONFIG")
        ok(facts["openDays"] == cfg["delivery"]["openPurchaseDays"] and facts["freeFrom"] == cfg["freeShippingFrom"], f"{tag} the facts come from the settings")
        for r, must, never in (("faq", ["30 dagars öppet köp från att du tog emot varan", "Målet är 2–5 arbetsdagar", "Vad kostar frakten?"], ["inte bekräftad än", "veckogräns", "jämföra upp till", "laddas inte upp någonstans"]),
                               ("sa-fungerar-det", ["30 dagars öppet köp", "Studio Plus är ett tillval"], ["upp till tre", "alla gratis", "jämföra två"]),
                               ("frakt", ["Målet är 2–5 arbetsdagar", "49 kr", "89 kr", "799 kr"], ["Vi skickar från lager inom EU"]),
                               ("om", ["Vi har inget eget lager"], ["inga leverantörer eller leveransregler är bekräftade"]),
                               ("returer", ["30 dagars öppet köp från att du tog emot varan. Lagen ger alltid 14 dagars ångerrätt."], []),
                               ("juridik-villkor", ["14 dagars ångerrätt enligt lagen", "dessutom 30 dagars öppet köp"], []),
                               ("juridik-angerratt", ["inom 14 dagar", "dessutom 30 dagars öppet köp"], [])):
            pg.goto(BASE + r + "/"); pg.wait_for_timeout(500)
            text = pg.evaluate("document.getElementById('view').textContent.replace(/\\s+/g, ' ')")
            ok(all(s in text for s in must), f"{tag} {r} says: " + "; ".join(s for s in must if s not in text))
            ok(not any(s in text for s in never), f"{tag} {r} no longer says: " + "; ".join(s for s in never if s in text))
        # the page drawn by the script says what the built page says
        pg.goto(BASE + "faq/"); pg.wait_for_timeout(500)
        ok(all(a[:60] in pg.evaluate("document.getElementById('view').textContent.replace(/\\s+/g, ' ')") for a in answers.values()), f"{tag} the FAQ on screen and its structured data say the same")
        ctx.close()

    # English: the new sentences are translated, and the dictionary comes from the merged file
    ctx = b.new_context(viewport={"width": 390, "height": 844})
    ctx.route(re.compile(r"^https?://(?!127\.0\.0\.1)"), lambda r: r.abort())
    ctx.add_init_script("try { localStorage.setItem('rumiq-lang', JSON.stringify('en')); } catch (e) {}")
    pg = ctx.new_page()
    reqs = []
    pg.on("request", lambda r: reqs.append(r.url))
    pg.goto(BASE + "faq/"); pg.wait_for_timeout(1000)
    text = pg.evaluate("document.getElementById('view').textContent")
    ok(any("i18n-en.min.js?v=" in u for u in reqs) and not any(u.endswith("i18n-en.js") for u in reqs), "English is read from the merged, stamped dictionary")
    ok("30-day returns from the day you received the item" in text and "What does shipping cost?" in text and "öppet köp" not in text, "English: the return and shipping answers are translated")
    ctx.close()
    b.close()

srv.shutdown()
print(f"\n{n - len(fails)} of {n} checks passed")
sys.exit(1 if fails else 0)
