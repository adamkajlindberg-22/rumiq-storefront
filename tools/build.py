#!/usr/bin/env python3
"""Build the RumIQ storefront.

  python3 tools/build.py            bundle + prerender every route + sitemap, feed, 404 and the rest
  python3 tools/build.py --fast     bundle only (the running site redraws the view itself)
  python3 tools/build.py --launch   as the first, but lets search engines in (see LAUNCH below)

What it does
  1. Minifies assets/js/*.js into site.min.js (everything on first load) and site-tools.min.js
     (studio.js, fetched on demand), i18n.js into i18n.min.js, and assets/css/site.css into
     site.min.css, with esbuild. Merges tools/i18n-add/*.json into the English dictionary and
     writes it as i18n-en.min.js (assets/js/i18n-en.js itself is never changed).
  2. Opens every route from routes.txt in headless Chrome and writes <route>/index.html with the
     drawn view inside <main>, so search engines and the first paint get real content.
     The page chrome (header, footer, drawers) comes from tools/shell.html.
  3. Writes the <head> of every page: title, description, canonical address, sharing tags and
     structured data, from the catalogue (data.js, content.js, config.js) and tools/seo.json.
     Nothing in a head is kept from an earlier build, so a new price is a new price everywhere.
  4. Writes sitemap.xml, robots.txt, feed/products.xml, llms.txt, manifest.webmanifest, 404.html
     and assets/heads.json (what assets/js/seo.js reads to keep the head right while browsing).
  5. Stamps every file address with that file's own content hash (?v=) so browsers fetch new
     code, and removes the folders of routes that are no longer in routes.txt.

Pages are written only when every route was drawn without a script error.

Needs: node + esbuild (npx esbuild), Python playwright with Chromium.
"""
import argparse, datetime, hashlib, html, http.server, json, os, re, shutil, socketserver, subprocess, sys, threading
from pathlib import Path
from urllib.parse import urlparse

# ------------------------------------------------------------------------------------ the two switches
# The address the site is published at. The ONE place to change when rumiq.se is live.
SITE = "https://adamkajlindberg-22.github.io/rumiq-storefront/"
# False = test site: every page says noindex and robots.txt shuts search engines out.
# True (or --launch) = the real shop: pages can be found, except the ones in NOINDEX below.
LAUNCH = False

ROOT = Path(__file__).resolve().parent.parent
JS = ROOT / "assets/js"
SITE_FILES = ["data", "content", "commerce", "app", "room", "flow", "svep", "myhome", "auth", "account", "ai", "hem", "home", "seo"]
TOOLS_FILES = ["studio", "hemsida"]
ESBUILD = os.environ.get("ESBUILD", "npx --yes esbuild").split()

# routes that show another page (tools that were merged, old names): they point their canonical
# address at that page and are never listed for search engines
ALIAS = {"studio-analys": "mitt-rum", "studio-kombinera": "mitt-rum", "studio": "mitt-rum", "kollektioner": "looks",
         "studio-sok": "hitta-ratt", "studio-hemurval": "hitta-ratt", "hitta-ratt-ord": "hitta-ratt", "presentguiden": "hitta-ratt-present",
         "rosta": "onska", "ideer": "onska", "studio-stil": "svep", "jamfor": "mitt-hem",
         "varukorg": "butik"}
ALIAS_PREFIX = {"mitt-rum-": "mitt-rum", "svep-rum-": "svep"}  # one near-identical page per product or room
# pages that stay hidden from search engines for good: personal, part of a purchase, or empty for now
NOINDEX = {"kassa", "konto", "skapa-konto", "mitt-hem", "onskelista", "delad", "spara-order", "angra", "for-dig",
           "nyheter", "erbjudanden", "favoriter"}
# folders in the site root that are never route folders
KEEP_DIRS = {"assets", "feed", "tools", "test", "node_modules"}

GOOGLE_CATEGORY = {
    "belysning-atmosfar": "Home & Garden > Lighting", "hem-inredning": "Home & Garden > Decor",
    "forvaring-organisering": "Home & Garden > Household Supplies > Storage & Organization",
    "kok-matplats": "Home & Garden > Kitchen & Dining", "sovrum-komfort": "Home & Garden > Linens & Bedding",
    "badrum-valmaende": "Home & Garden > Bathroom Accessories", "tavlor-vaggar": "Home & Garden > Decor > Artwork",
    "uteliv": "Home & Garden > Lawn & Garden",
}
DEFAULT_DESC = "Skandinavisk inredning du ser i ditt eget rum innan du köper. Lampor, textil och förvaring, noga utvalt. Svep fram din stil eller ta en färdig look."
OG_DEFAULT = "assets/img/og.jpg"


def canonical_route(route):
    if route in ALIAS:
        return ALIAS[route]
    for pre, target in ALIAS_PREFIX.items():
        if route.startswith(pre):
            return target
    return route


def is_hidden(route):
    return route in NOINDEX or canonical_route(route) != route


def url(route=""):
    return SITE if not route else SITE + route + "/"


# ------------------------------------------------------------------------------------ bundles
def minify(path):
    cmd = ESBUILD + [str(path), "--minify", "--charset=ascii" if str(path).endswith(".js") else "--log-level=warning"]
    return subprocess.run(cmd, check=True, capture_output=True, text=True).stdout.strip()


def sha(text):
    return hashlib.sha1(text if isinstance(text, bytes) else text.encode()).hexdigest()[:8]


def english():
    """The English dictionary with every tools/i18n-add/*.json laid on top (later files win)."""
    raw = (JS / "i18n-en.js").read_text(encoding="utf-8").rstrip()
    extra, clashes = {}, []
    owner = {}
    for f in sorted((ROOT / "tools/i18n-add").glob("*.json")):
        try:
            pairs = json.loads(f.read_text(encoding="utf-8"))
        except ValueError as e:
            sys.exit(f"tools/i18n-add/{f.name} is not valid JSON: {e}")
        if not isinstance(pairs, dict):
            sys.exit(f"tools/i18n-add/{f.name} must be one flat object of Swedish: English pairs")
        for sv, en in pairs.items():
            if not isinstance(en, str):
                sys.exit(f"tools/i18n-add/{f.name}: the value for {sv[:40]!r} is not a text")
            if sv in extra and extra[sv] != en:
                clashes.append((sv, owner[sv], f.name))
            extra[sv], owner[sv] = en, f.name
    out = "/* English for RumIQ: assets/js/i18n-en.js plus tools/i18n-add/*.json. Written by tools/build.py, do not edit. */\n" + raw + "\n"
    if extra:
        out += "\n/* tools/i18n-add */\nObject.assign(window.RQ_EN.dict, " + json.dumps(extra, ensure_ascii=False, separators=(",", ":")) + ");\n"
    return out, len(extra), clashes


def bundle():
    site = "\n".join(minify(JS / f"{f}.js") for f in SITE_FILES) + "\n"
    tools = "\n".join(minify(JS / f"{f}.js") for f in TOOLS_FILES) + "\n"
    css = minify(ROOT / "assets/css/site.css") + "\n"
    en, added, clashes = english()
    v = {"assets/css/site.min.css": sha(css), "assets/js/site.min.js": sha(site), "assets/js/site-tools.min.js": sha(tools),
         "assets/js/config.js": sha((JS / "config.js").read_bytes()), "assets/js/i18n-en.min.js": sha(en)}
    # the language layer fetches the English dictionary by name: point it at the merged, stamped file
    i18n = minify(JS / "i18n.js")
    plain = "assets/js/i18n-en.js"
    if plain in i18n:
        i18n = i18n.replace(plain, f"assets/js/i18n-en.min.js?v={v['assets/js/i18n-en.min.js']}")
    elif "RQ_EN_SRC" not in i18n:
        print("  NOTE i18n.js no longer names assets/js/i18n-en.js: the merged English dictionary is not used")
    i18n += "\n"
    v["assets/js/i18n.min.js"] = sha(i18n)
    if (ROOT / "assets/heads.json").exists():
        v["assets/heads.json"] = sha((ROOT / "assets/heads.json").read_bytes())
    for name, text in (("site.min.js", site), ("site-tools.min.js", tools), ("i18n.min.js", i18n), ("i18n-en.min.js", en)):
        (JS / name).write_text(text, encoding="utf-8")
    (ROOT / "assets/css/site.min.css").write_text(css, encoding="utf-8")
    print(f"bundled: site {len(site)//1024} kB, tools {len(tools)//1024} kB, css {len(css)//1024} kB, English +{added} phrases")
    for sv, a, b in clashes:
        print(f"  NOTE two English texts for the same Swedish phrase ({a} and {b}, the last one wins): {sv[:70]}")
    return v


def stamp(text, v):
    """Give every built file its own ?v= (its content hash)."""
    for name, h in v.items():
        text = re.sub(re.escape(name) + r"(?:\?v=[0-9a-f]{8})?", f"{name}?v={h}", text)
    return text


def routes():
    return [""] + [r.strip() for r in (ROOT / "routes.txt").read_text().split() if r.strip()]


def page_path(route):
    return ROOT / "index.html" if not route else ROOT / route / "index.html"


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


class Server(socketserver.ThreadingTCPServer):
    daemon_threads = True

    def handle_error(self, request, client_address):  # a page left before a file finished loading
        pass


def serve():
    handler = lambda *a, **k: Quiet(*a, directory=str(ROOT), **k)
    srv = Server(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, srv.server_address[1]


# ------------------------------------------------------------------------------------ what the pages are read for
GRAB = """async () => {
  if (window.RQ && RQ.loadTools) { try { await RQ.loadTools(); } catch (e) {} }
  await new Promise((r) => setTimeout(r, 250));
  const live = document.getElementById('view');
  const crumbs = [...live.querySelectorAll('ol.crumbs')].slice(0, 1).flatMap((ol) => [...ol.children].map((li) => {
    const a = li.querySelector('a'); const raw = a ? decodeURIComponent((a.getAttribute('href') || '').replace(/^#/, '').replace(/\\/$/, '')) : null;
    return [li.textContent.replace(/\\s+/g, ' ').trim(), raw === null ? null : (/^(hem|\\.)?$/.test(raw) ? '' : raw)]; }));
  const leadEl = live.querySelector('.lead, .page-head p, h1 + p');
  const v = live.cloneNode(true);
  // the page head carries the structured data, with the real address
  v.querySelectorAll('script').forEach((x) => x.remove());
  v.querySelectorAll('a[href^="#"]').forEach((a) => {
    const raw = decodeURIComponent(a.getAttribute('href').slice(1));
    if (/^(hem)?$/.test(raw)) a.setAttribute('href', './');
    else if (RQ.isRoute(raw) && !/^faq-\\d+$/.test(raw)) a.setAttribute('href', raw + '/');
  });
  return { main: v.outerHTML, title: document.title, bodyClass: document.body.className, crumbs,
           lead: leadEl ? leadEl.textContent.replace(/\\s+/g, ' ').trim() : '' };
}"""

DATA = """() => {
  const C = window.RQ_CONFIG || {}, d = C.delivery || {}, S = RQ.shop;
  const text = (h) => { const e = document.createElement('div'); e.innerHTML = h; return e.textContent.replace(/\\s+/g, ' ').trim(); };
  const handles = (q) => { try { return S.list(q).map((p) => p.handle); } catch (e) { return []; } };
  const F = RQ.facts || {};
  let faq = [];
  try { faq = RQ.INFO.faq.groups.flatMap(([g, qs]) => qs.map(([q, a]) => [q, text(a)])); } catch (e) {}
  return {
    facts: { openDays: F.openDays || d.openPurchaseDays || 0, freeFrom: F.freeFrom || C.freeShippingFrom || 0, pickup: F.pickup || 0, home: F.home || 0,
             minDays: d.minDays || 0, maxDays: d.maxDays || 0, deliveryConfirmed: d.confirmed === true, lookDiscount: C.lookDiscount || 0,
             email: (C.company || {}).email || 'support@rumiq.se', company: C.company || {} },
    products: RQ.PRODUCTS.map((p) => ({ handle: p.handle, name: p.name, short: p.short, story: p.story || '', price: p.price, cat: p.cat,
      material: p.material || '', variants: p.variants || null, rooms: p.rooms || [] })),
    categories: RQ.CATEGORIES.map((c) => ({ id: c.id, name: c.name, lead: c.lead, items: handles({ cat: c.id }) })),
    rooms: RQ.ROOMS.map((r) => ({ id: r.id, name: r.name, lead: r.lead, tips: r.tips || [], items: handles({ room: r.id }) })),
    collections: (RQ.COLLECTIONS || []).map((c) => ({ id: c.id, name: c.name, lead: c.lead, text: c.text || '', items: handles({ col: c.id }) })),
    looks: (RQ.LOOKS || []).map((l) => ({ id: l.id, name: l.name, room: l.room, lead: l.lead, items: l.items })),
    articles: (RQ.ARTICLES || []).map((a) => ({ slug: a.slug, title: a.title, lead: a.lead, img: a.img, date: a.date || null, updated: a.updated || null })),
    faq,
  };
}"""


def clip(text, n=155):
    """Shorten at a sentence or word, never in the middle of one."""
    text = re.sub(r"\s+", " ", text or "").strip()
    if len(text) <= n:
        return text
    cut = text[: n + 1]
    stop = max(cut.rfind(". "), cut.rfind("! "), cut.rfind("? "))
    if stop > n * 0.5:
        return cut[: stop + 1]
    return cut[: cut.rfind(" ")].rstrip(",;:–-") + "…"


def kr(n):
    return f"{int(n):,}".replace(",", " ") + " kr"


def ship_price(price, f):
    return 0 if f["freeFrom"] and price >= f["freeFrom"] else f["pickup"]


def product_description(p, f):
    """The product's own words first: its short text, then the opening of its story while there is room,
    so that no two descriptions read alike. Then the price and the promises, as far as they fit."""
    s = p["short"].rstrip(". ") + "."
    for sent in re.split(r"(?<=[.!?])\s+", (p.get("story") or "").strip()):
        if len(sent) < 25:  # "Mjuk men stadig." says little on its own
            continue
        if len(s) + 1 + len(sent) > 112:
            break
        s += " " + sent
    tail = [f" {kr(p['price'])}."]
    if f["openDays"]:
        tail.append(f" {f['openDays']} dagars öppet köp.")
    if f["freeFrom"]:
        tail.append(" Fri frakt till ombud." if p["price"] >= f["freeFrom"] else f" Fri frakt från {kr(f['freeFrom'])}.")
    for t in tail:
        if len(s + t) <= 155:
            s += t
    return s


def look_description(l, f):
    pct = round(f["lookDiscount"] * 100)
    offer = f" och få {pct} % rabatt" if pct else ""
    s = f"{l['name']}: {l['lead']} Färdig look där allt hör ihop. Lägg hela looken i varukorgen med ett tryck{offer}."
    if len(s) > 155:
        s = f"{l['name']}: {l['lead']} Färdig look" + (f", {pct} % rabatt när du köper allt på en gång." if pct else " där allt hör ihop.")
    return clip(s)


def ld_org(f):
    org = {"@context": "https://schema.org", "@type": "OnlineStore", "@id": SITE + "#organization", "name": "RumIQ", "url": SITE,
           "logo": {"@type": "ImageObject", "url": SITE + "assets/brand/rumiq-grafit.webp", "width": 480, "height": 120},
           "email": f["email"], "areaServed": {"@type": "Country", "name": "SE"},
           "contactPoint": {"@type": "ContactPoint", "contactType": "customer service", "email": f["email"], "availableLanguage": ["sv", "en"]}}
    c = f.get("company") or {}
    if c.get("name"):
        org["legalName"] = c["name"]
    if c.get("orgnr"):
        org["taxID"] = c["orgnr"]
    if f["openDays"]:
        org["hasMerchantReturnPolicy"] = return_policy(f, link=True)
    return org


def return_policy(f, link=False):
    p = {"@type": "MerchantReturnPolicy", "applicableCountry": "SE", "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
         "merchantReturnDays": f["openDays"], "returnMethod": "https://schema.org/ReturnByMail"}
    if link:
        p["merchantReturnLink"] = url("returer")
    return p


def ld_breadcrumbs(crumbs, route):
    if len(crumbs) < 2:
        return None
    items = []
    for i, (name, target) in enumerate(crumbs):
        it = {"@type": "ListItem", "position": i + 1, "name": name}
        if target is not None and i < len(crumbs) - 1:
            it["item"] = url(target)
        items.append(it)
    return {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": items}


def ld_itemlist(route, name, desc, handles, by_handle, image=None, kind="produkt-"):
    page = {"@context": "https://schema.org", "@type": "CollectionPage", "@id": url(route), "name": name, "inLanguage": "sv-SE",
            "isPartOf": {"@id": SITE + "#website"}}
    if desc:
        page["description"] = desc
    if image:
        page["image"] = SITE + image
    page["mainEntity"] = {"@type": "ItemList", "numberOfItems": len(handles), "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "url": url(kind + h), "name": by_handle[h]} for i, h in enumerate(handles) if h in by_handle]}
    return page


def ld_product(p, cat, f):
    offer = {"@type": "Offer", "url": url("produkt-" + p["handle"]), "priceCurrency": "SEK", "price": f"{p['price']:.2f}",
             # the products are examples that cannot be bought yet: PreOrder until they can (then InStock)
             "availability": "https://schema.org/PreOrder", "itemCondition": "https://schema.org/NewCondition",
             "seller": {"@id": SITE + "#organization"}}
    if f["pickup"]:
        ship = {"@type": "OfferShippingDetails", "shippingRate": {"@type": "MonetaryAmount", "value": f"{ship_price(p['price'], f):.2f}", "currency": "SEK"},
                "shippingDestination": {"@type": "DefinedRegion", "addressCountry": "SE"}}
        if f["deliveryConfirmed"] and f["minDays"]:  # a delivery time is stated as a fact only once the supplier has confirmed it
            ship["deliveryTime"] = {"@type": "ShippingDeliveryTime", "handlingTime": {"@type": "QuantitativeValue", "minValue": 0, "maxValue": 1, "unitCode": "DAY"},
                                    "transitTime": {"@type": "QuantitativeValue", "minValue": f["minDays"], "maxValue": f["maxDays"], "unitCode": "DAY"}}
        offer["shippingDetails"] = ship
    if f["openDays"]:
        offer["hasMerchantReturnPolicy"] = return_policy(f)
    images = [f"assets/img/p/{p['handle']}-1400.webp", f"assets/img/d/{p['handle']}-1200.webp", f"assets/img/cut/{p['handle']}.webp"]
    ld = {"@context": "https://schema.org", "@type": "Product", "@id": url("produkt-" + p["handle"]) + "#product", "name": p["name"],
          "description": p["short"], "sku": p["handle"], "image": [SITE + i for i in images if (ROOT / i).exists()],
          "brand": {"@type": "Brand", "name": "RumIQ"}, "offers": offer}
    if cat:
        ld["category"] = cat["name"]
    if p["material"]:
        ld["material"] = p["material"]
    return ld


def fill(text, f):
    """tools/seo.json names the promised figures instead of typing them: {openDays}, {freeFrom}, {pickup}, {home}, {minDays}, {maxDays}."""
    return re.sub(r"\{(openDays|freeFrom|pickup|home|minDays|maxDays)\}", lambda m: str(f[m.group(1)]), text) if text else text


def list_description(name, lead, handles, products, tail):
    first = re.split(r"(?<=[.!?])\s", lead.strip())[0]
    prices = [products[h]["price"] for h in handles if h in products]
    count = f" {len(prices)} {'produkt' if len(prices) == 1 else 'produkter'} från {kr(min(prices))}." if prices else ""
    tails = tail if isinstance(tail, list) else [tail]  # several candidates: the first that fits is used
    for s in [f"{name}: {first}{count} {t}" for t in tails] + [f"{name}: {first}{count}", f"{name}: {first}"]:
        if len(s) <= 155:
            return s
    return clip(f"{name}: {first}")


def build_meta(route, got, data, seo):
    """Everything the head of one page says."""
    f = data["facts"]
    own = canonical_route(route)
    entry = {k: fill(v, f) for k, v in seo.get(own or "hem", {}).items()}
    products = {p["handle"]: p for p in data["products"]}
    names = {h: p["name"] for h, p in products.items()}
    cats = {c["id"]: c for c in data["categories"]}
    m = {"title": entry.get("title") or got["title"] or "RumIQ", "description": entry.get("description"), "canonical": own,
         "noindex": (not LAUNCH) or is_hidden(route), "og_type": "website", "image": OG_DEFAULT, "ld": [ld_org(f)], "extra": []}
    kind, _, key = own.partition("-")
    if own != route:  # an alias says what its target says; the structured data stays with the target
        pass
    elif own == "":
        m["ld"].append({"@context": "https://schema.org", "@type": "WebSite", "@id": SITE + "#website", "url": SITE, "name": "RumIQ",
                        "alternateName": "RumIQ – skandinavisk inredning", "inLanguage": "sv-SE", "publisher": {"@id": SITE + "#organization"}})
    elif kind == "produkt" and key in products:
        p = products[key]
        m["description"] = entry.get("description") or product_description(p, f)
        m["og_type"], m["image"] = "product", f"assets/img/p/{key}-1400.webp"
        m["extra"] = [("product:price:amount", f"{p['price']:.2f}"), ("product:price:currency", "SEK")]
        m["ld"].append(ld_product(p, cats.get(p["cat"]), f))
    elif kind == "kategori" and key in cats:
        c = cats[key]
        m["description"] = entry.get("description") or list_description(c["name"] + " hos RumIQ", c["lead"], c["items"], products, "Se allt i ditt eget rum innan du köper.")
        m["ld"].append(ld_itemlist(route, c["name"], c["lead"], c["items"], names))
        if c["items"]:
            m["image"] = f"assets/img/p/{c['items'][0]}-1400.webp"
    elif kind == "rum" and key:
        r = next((x for x in data["rooms"] if x["id"] == key), None)
        if r:
            m["description"] = entry.get("description") or list_description(r["name"], r["lead"], r["items"], products, (r.get("tips") or []) + ["Tryck på prickarna i bilden och handla rummet."])
            m["image"] = f"assets/img/rum/{key}-1600.webp"
            m["ld"].append(ld_itemlist(route, r["name"], r["lead"], r["items"], names, m["image"]))
    elif kind == "kollektion":
        c = next((x for x in data["collections"] if x["id"] == key), None)
        if c:
            m["ld"].append(ld_itemlist(route, c["name"], c["lead"], c["items"], names))
    elif kind == "look" and key:
        l = next((x for x in data["looks"] if x["id"] == key), None)
        if l:
            m["description"] = entry.get("description") or look_description(l, f)
            m["image"] = f"assets/img/rum/{l['room']}-1600.webp"
            m["ld"].append(ld_itemlist(route, l["name"], l["lead"], l["items"], names, m["image"]))
    elif own == "looks":
        m["ld"].append(ld_itemlist(route, "Färdiga looks", None, [l["id"] for l in data["looks"]], {l["id"]: l["name"] for l in data["looks"]}, kind="look-"))
    elif own == "butik":
        m["ld"].append(ld_itemlist(route, "Alla produkter", None, list(names), names))
    elif own == "magasin":
        m["ld"].append(ld_itemlist(route, "Magasin", None, [a["slug"] for a in data["articles"]], {a["slug"]: a["title"] for a in data["articles"]}, kind="artikel-"))
    elif kind == "artikel":
        a = next((x for x in data["articles"] if x["slug"] == key), None)
        if a:
            m["og_type"], m["image"] = "article", a["img"]
            art = {"@context": "https://schema.org", "@type": "Article", "headline": a["title"], "description": a["lead"], "image": [SITE + a["img"]],
                   "inLanguage": "sv-SE", "mainEntityOfPage": url(route), "author": {"@type": "Organization", "name": "RumIQ", "url": url("om")},
                   "publisher": {"@id": SITE + "#organization"}}
            if a["date"]:  # an article says when it was written only if content.js says so
                art["datePublished"] = a["date"]
                art["dateModified"] = a["updated"] or a["date"]
            m["ld"].append(art)
    elif own == "faq" and data["faq"]:
        m["ld"].append({"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
            {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in data["faq"]]})
    if own == route:
        bc = ld_breadcrumbs(got.get("crumbs") or [], route)
        if bc:
            m["ld"].append(bc)
    if not m["description"]:
        m["description"] = clip(got.get("lead") or "") if len(got.get("lead") or "") > 60 else DEFAULT_DESC
    if not (ROOT / m["image"]).exists():
        m["image"] = OG_DEFAULT
    return m


def render_head(route, m, shell_head):
    e = lambda s: html.escape(s, quote=True)
    seo = [f"<title>{html.escape(m['title'])}</title>",
           f'<meta name="description" content="{e(m["description"])}">']
    if m["noindex"]:
        seo.append(f'<meta name="robots" content="{"noindex" if not LAUNCH else "noindex,follow"}">')
    else:
        seo.append('<meta name="robots" content="index,follow,max-image-preview:large">')
    seo += [f'<link rel="canonical" href="{url(m["canonical"])}">',
            f'<meta property="og:type" content="{m["og_type"]}">', '<meta property="og:site_name" content="RumIQ">', '<meta property="og:locale" content="sv_SE">',
            f'<meta property="og:title" content="{e(m["title"])}">', f'<meta property="og:description" content="{e(m["description"])}">',
            f'<meta property="og:image" content="{SITE + m["image"]}">', f'<meta property="og:url" content="{url(m["canonical"])}">']
    seo += [f'<meta property="{k}" content="{e(v)}">' for k, v in m["extra"]]
    seo.append('<meta name="twitter:card" content="summary_large_image">')
    for i, x in enumerate(m["ld"]):  # the first is the shop itself, the rest are about this page (assets/js/seo.js tells them apart)
        seo.append(f'<script type="application/ld+json"{"" if i == 0 else " data-page"}>' + json.dumps(x, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/") + "</script>")
    h = shell_head.replace("<!--seo-->", "\n".join(seo))
    return h if not route else h.replace('<base href="./">', '<base href="../">')


# ------------------------------------------------------------------------------------ the files beside the pages
def last_change():
    try:
        d = subprocess.run(["git", "log", "-1", "--format=%cs"], cwd=ROOT, capture_output=True, text=True).stdout.strip()
        if re.fullmatch(r"\d{4}-\d\d-\d\d", d):
            return d
    except OSError:
        pass
    return datetime.date.today().isoformat()


def write_sitemap(metas, data):
    day = last_change()
    rows = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">']
    n = 0
    for r, m in metas.items():
        if is_hidden(r):
            continue
        n += 1
        img = f"\n    <image:image><image:loc>{SITE + m['image']}</image:loc></image:image>" if m["image"] != OG_DEFAULT else ""
        rows.append(f"  <url>\n    <loc>{url(r)}</loc>\n    <lastmod>{day}</lastmod>{img}\n  </url>")
    rows.append("</urlset>")
    (ROOT / "sitemap.xml").write_text("\n".join(rows) + "\n", encoding="utf-8")
    return n


def write_robots():
    if not LAUNCH:
        text = "User-agent: *\nDisallow: /\n"
    else:
        # nothing is shut out here: a page that must stay hidden says noindex itself, and a search engine has to be let in to read that
        text = f"User-agent: *\nAllow: /\n\nSitemap: {SITE}sitemap.xml\n"
    (ROOT / "robots.txt").write_text(text, encoding="utf-8")


def write_feed(data):
    f = data["facts"]
    x = lambda s: html.escape(s, quote=False)
    cats = {c["id"]: c for c in data["categories"]}
    out = ['<?xml version="1.0" encoding="UTF-8"?>', '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">', "<channel>", "  <title>RumIQ</title>",
           f"  <link>{SITE}</link>", "  <description>Skandinavisk inredning från RumIQ</description>"]
    for p in data["products"]:
        h = p["handle"]
        out += ["  <item>", f"    <g:id>{h}</g:id>", f"    <title>{x(p['name'])}</title>", f"    <description>{x((p['short'] + ' ' + p['story']).strip())}</description>",
                f"    <link>{url('produkt-' + h)}</link>", f"    <g:image_link>{SITE}assets/img/p/{h}-1400.webp</g:image_link>"]
        if (ROOT / f"assets/img/d/{h}-1200.webp").exists():
            out.append(f"    <g:additional_image_link>{SITE}assets/img/d/{h}-1200.webp</g:additional_image_link>")
        out += [f"    <g:price>{p['price']:.2f} SEK</g:price>", "    <g:availability>preorder</g:availability>", "    <g:condition>new</g:condition>",
                "    <g:brand>RumIQ</g:brand>", "    <g:identifier_exists>no</g:identifier_exists>"]
        if p["cat"] in cats:
            out.append(f"    <g:product_type>{x(cats[p['cat']]['name'])}</g:product_type>")
        if p["cat"] in GOOGLE_CATEGORY:
            out.append(f"    <g:google_product_category>{x(GOOGLE_CATEGORY[p['cat']])}</g:google_product_category>")
        if p["material"]:
            out.append(f"    <g:material>{x(p['material'])}</g:material>")
        if p["variants"]:
            out.append(f"    <g:color>{x(p['variants'][0])}</g:color>")
        if f["pickup"]:
            out.append(f"    <g:shipping><g:country>SE</g:country><g:service>Ombud</g:service><g:price>{ship_price(p['price'], f):.2f} SEK</g:price></g:shipping>")
        out.append("  </item>")
    out += ["</channel>", "</rss>"]
    (ROOT / "feed").mkdir(exist_ok=True)
    (ROOT / "feed/products.xml").write_text("\n".join(out) + "\n", encoding="utf-8")


def write_llms(data, metas):
    f = data["facts"]
    cats = {c["id"]: c for c in data["categories"]}
    L = ["# RumIQ", "", "> RumIQ är en svensk webbutik med skandinavisk inredning: belysning, textil, förvaring och tavlor. Du kan se produkterna i ett foto av ditt eget rum innan du köper.", ""]
    if not LAUNCH:
        L += ["Butiken är en förhandsversion. Produkterna är exempel som visar hur butiken kommer att se ut och går inte att köpa än.", ""]
    L.append("## Fakta")
    L.append("- Priser i svenska kronor (SEK), inklusive moms. Leverans till adresser i Sverige.")
    if f["pickup"]:
        ship = f"- Frakt: {kr(f['pickup'])} till ombud och paketskåp" + (f", {kr(f['home'])} för hemleverans" if f["home"] else "")
        L.append(ship + (f". Fri frakt till ombud och paketskåp från {kr(f['freeFrom'])}." if f["freeFrom"] else "."))
    if f["minDays"]:
        L.append(f"- Leveranstid: {'' if f['deliveryConfirmed'] else 'målet är '}{f['minDays']}–{f['maxDays']} arbetsdagar. Datumet visas på produktsidan och i kassan före köp.")
    if f["openDays"]:
        L.append(f"- Returer: {f['openDays']} dagars öppet köp från att du tog emot varan. Lagen ger alltid 14 dagars ångerrätt.")
    L.append("- Reklamation: tre år enligt konsumentköplagen.")
    L.append(f"- Kundservice: {f['email']}")
    L += ["", "## Viktiga sidor"]
    for r, label in (("butik", "Alla produkter"), ("looks", "Färdiga looks: saker som hör ihop, rum för rum"), ("mitt-rum", "Mitt rum: prova produkterna i ett foto av ditt rum"),
                     ("svep", "Svep: hitta din inredningsstil"), ("hitta-ratt", "Hitta rätt: guide efter rum och behov"), ("magasin", "Magasin: inredningstips"),
                     ("frakt", "Frakt och leverans"), ("returer", "Returer och återbetalning"), ("betalning", "Betalning"), ("faq", "Vanliga frågor"),
                     ("om", "Om RumIQ"), ("sa-fungerar-det", "Så fungerar RumIQ"), ("kontakt", "Kontakt")):
        if r in metas:
            L.append(f"- [{label}]({url(r)})")
    L += ["", "## Kategorier"]
    L += [f"- [{c['name']}]({url('kategori-' + c['id'])}): {c['lead']}" for c in data["categories"]]
    L += ["", "## Produkter"]
    L += [f"- [{p['name']}]({url('produkt-' + p['handle'])}): {p['short']} {kr(p['price'])}." + (f" Kategori: {cats[p['cat']]['name']}." if p["cat"] in cats else "") for p in data["products"]]
    if data["faq"]:
        L += ["", "## Vanliga frågor"]
        for q, a in data["faq"]:
            L += [f"### {q}", a, ""]
    (ROOT / "llms.txt").write_text("\n".join(L).rstrip() + "\n", encoding="utf-8")


def write_manifest():
    icons = [{"src": f"assets/brand/{n}", "sizes": s, "type": "image/png"} for n, s in (("favicon.png", "64x64"), ("apple-touch-icon.png", "180x180"), ("icon-192.png", "192x192"), ("icon-512.png", "512x512"))
             if (ROOT / "assets/brand" / n).exists()]
    man = {"name": "RumIQ", "short_name": "RumIQ", "description": "Skandinavisk inredning du ser i ditt eget rum innan du köper.", "lang": "sv",
           "start_url": "./", "scope": "./", "display": "browser", "background_color": "#EDEDEA", "theme_color": "#EDEDEA", "icons": icons}
    (ROOT / "manifest.webmanifest").write_text(json.dumps(man, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def write_heads(metas):
    """What the running site needs to keep title, description and addresses right while browsing: route -> [title, description, canonical route, image, hidden]."""
    heads = {r or "hem": [m["title"], m["description"], m["canonical"], m["image"], 1 if m["noindex"] else 0] for r, m in metas.items()}
    text = json.dumps({"site": SITE, "launch": LAUNCH, "pages": heads}, ensure_ascii=False, separators=(",", ":")) + "\n"
    (ROOT / "assets/heads.json").write_text(text, encoding="utf-8")
    return sha(text)


def remove_old_routes(live):
    gone = []
    for d in sorted(ROOT.iterdir()):
        if not d.is_dir() or d.name.startswith(".") or d.name in KEEP_DIRS or d.name in live:
            continue
        files = [x.name for x in d.iterdir()]
        page = d / "index.html"
        if files == ["index.html"] and '<main id="view"' in page.read_text(encoding="utf-8", errors="ignore"):
            shutil.rmtree(d)
            gone.append(d.name)
    if gone:
        print(f"removed {len(gone)} folders of routes that are no longer in routes.txt: {', '.join(gone)}")


# ------------------------------------------------------------------------------------ prerender
def prerender(v):
    from playwright.sync_api import sync_playwright
    shell = stamp((ROOT / "tools/shell.html").read_text(encoding="utf-8"), v)
    cut = shell.index("</head>") + len("</head>")
    shell_head, shell_body = shell[:cut], shell[cut:]
    assert "<!--seo-->" in shell_head, "tools/shell.html has lost its <!--seo--> line"
    empty_main = '<main id="view" class="view" tabindex="-1"></main>'
    assert empty_main in shell_body
    seo = json.loads((ROOT / "tools/seo.json").read_text(encoding="utf-8"))
    # the pages are drawn from a plain page with the same scripts, so a route needs no page of its own to be built
    stage = "__build.html"
    (ROOT / stage).write_text(shell_head.replace("<!--seo-->", "<title>RumIQ</title>") + shell_body, encoding="utf-8")
    srv, port = serve()
    got_all, problems, data = {}, [], None
    try:
        with sync_playwright() as p:
            b = p.chromium.launch()
            # reduced motion: the start film is not fetched and nothing is caught mid-animation
            ctx = b.new_context(viewport={"width": 1280, "height": 900}, locale="sv-SE", reduced_motion="reduce")
            ctx.route(re.compile(r"^https?://(?!127\.0\.0\.1)"), lambda r: r.abort())
            # every page is drawn for a first-time visitor: nothing saved, nothing looked at before
            ctx.add_init_script("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}")
            pg = ctx.new_page()
            errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            for r in routes() + ["__404"]:
                errs.clear()
                pg.goto(f"http://127.0.0.1:{port}/{stage}#{r or 'hem'}", wait_until="load")
                got = pg.evaluate(GRAB)
                if data is None:
                    data = pg.evaluate(DATA)
                if errs:
                    problems.append((r, errs[:2]))
                if len(got["main"]) < 150:
                    problems.append((r, ["empty view"]))
                got_all[r] = got
            b.close()
    finally:
        srv.shutdown()
        (ROOT / stage).unlink(missing_ok=True)
    if problems:
        print("NOTHING WRITTEN: these routes could not be drawn")
        for r, e in problems:
            print("  PROBLEM", r or "(home)", e)
        return False

    nf = got_all.pop("__404")
    metas, pages = {}, {}
    for r, got in got_all.items():
        metas[r] = build_meta(r, got, data, seo)
        pages[r] = render_head(r, metas[r], shell_head) + shell_body.replace(empty_main, got["main"])
    heads_v = {"assets/heads.json": write_heads(metas)}
    for r, text in pages.items():
        path = page_path(r)
        path.parent.mkdir(exist_ok=True)
        path.write_text(stamp(text, heads_v), encoding="utf-8")
    # 404.html is served for any address that has no page, at any depth: its addresses start from the site root
    base = urlparse(SITE).path or "/"
    m404 = {"title": "Sidan finns inte · RumIQ", "description": "Den här sidan finns inte. Länken kan vara gammal eller felstavad.", "canonical": "", "noindex": True,
            "og_type": "website", "image": OG_DEFAULT, "ld": [], "extra": []}
    head404 = re.sub(r'<link rel="canonical"[^>]*>\n?|<meta property="og:url"[^>]*>\n?', "", render_head("", m404, shell_head))
    head404 = head404.replace('<base href="./">', f'<base href="{base}">').replace('content="noindex,follow"', 'content="noindex"')
    (ROOT / "404.html").write_text(stamp(head404 + shell_body.replace(empty_main, nf["main"]), heads_v), encoding="utf-8")

    n = write_sitemap(metas, data)
    write_robots()
    write_feed(data)
    write_llms(data, metas)
    write_manifest()
    remove_old_routes({r for r in got_all if r})
    print(f"prerendered {len(pages)} pages + 404.html; sitemap {n} addresses, feed {len(data['products'])} products; "
          + ("LAUNCH: search engines are let in" if LAUNCH else "test site: noindex and robots.txt Disallow"))
    return True


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--fast", action="store_true", help="bundle only, stamp existing pages")
    ap.add_argument("--launch", action="store_true", help="let search engines in (same as LAUNCH = True)")
    a = ap.parse_args()
    LAUNCH = LAUNCH or a.launch
    v = bundle()
    if a.fast:
        for f in [ROOT / "index.html", ROOT / "404.html"] + [page_path(r) for r in routes() if r]:
            if f.exists():
                # a page from before v15 named the language file directly: point it at the built one
                text = f.read_text(encoding="utf-8").replace('src="assets/js/i18n.js"', 'src="assets/js/i18n.min.js"')
                f.write_text(stamp(text, v), encoding="utf-8")
        print("stamped pages (fast)")
        sys.exit(0)
    sys.exit(0 if prerender(v) else 1)
