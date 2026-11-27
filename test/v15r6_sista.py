#!/usr/bin/env python3
"""v15 round 6 (sista): the last findings of the final review before the founder tests.
B1 the stylist never says yes to a size, material, shape, colour, pack, scent or price we do not have (30 questions,
Swedish and English), C2 renting and pictures, C3 the most expensive, cats; C5 add-all buttons show the cart,
C4 Passar ihop marks what is in the cart, C6 the rug fills its in-room card, C7 the AI row says the cart's colour,
C8 /varukorg leaves the shop's address, C9 no duplicate view-transition name, C10 gift finder, Med egna ord, own photo.
Run after `python3 tools/build.py`:  python3 test/v15r6_sista.py
Own in-process server; everything outside 127.0.0.1 is blocked, as in the sandbox."""
import base64, http.server, re, socketserver, sys, threading
from pathlib import Path
from playwright.sync_api import sync_playwright
import sys as _s, os as _o; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); import _edit_way  # noqa: E402,F401  the editor tests start in Justera själv
SVYES = "(document.querySelector('#svDeck .sv-card.duel[aria-hidden=false] [data-duel-pick]') || document.getElementById('svYes')).click()"  # Spara, or the first side of a duel (v15.9)

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
SIZES = ((390, 844, True), (360, 740, True), (1440, 900, False), (1280, 720, False))
SAMPLE = """async (r) => { const im = new Image(); await new Promise((ok) => { im.onload = ok; im.src = 'assets/img/rum/' + r + '-1600.webp'; });
  await RQ.room.saveImage(im, { sample: true, map: r, type: r, name: r }); }"""
# an own photo with no map: a wall, a grey sofa in the middle, a window and a floor (as the reviewer's own-room.jpg)
OWN = """async () => { const c = document.createElement('canvas'); c.width = 1200; c.height = 1600; const g = c.getContext('2d');
  g.fillStyle = '#d8cfc2'; g.fillRect(0, 0, 1200, 1600); g.fillStyle = '#986e50'; g.fillRect(0, 830, 1200, 770);
  g.fillStyle = '#7f7b76'; g.fillRect(90, 560, 630, 450); g.fillStyle = '#ecebe6'; g.fillRect(740, 160, 360, 600);
  const im = new Image(); await new Promise((ok) => { im.onload = ok; im.src = c.toDataURL('image/jpeg', .9); });
  RQ.room.saveScene([]); localStorage.removeItem('rumiq-roomlearn'); await RQ.room.saveImage(im, { name: 'Mitt rum' }); }"""
TOAST = "[...document.querySelectorAll('.toast.show')].map((t) => t.innerText).join(' ')"
CART_OPEN = "document.getElementById('cart').classList.contains('open')"


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
    pg.on("console", lambda m: m.type == "error" and "ERR_FAILED" not in m.text and errs.append(m.text))
    return ctx, pg, errs


def go(pg, route, wait=800):
    pg.goto(BASE + (route + "/" if route else ""), wait_until="load")
    pg.wait_for_timeout(wait)
    pg.evaluate("document.getElementById('ckNeed') && document.getElementById('ckNeed').click()")
    pg.evaluate("RQ.loadTools && RQ.loadTools()")
    pg.wait_for_timeout(200)


def room(pg, items, r="vardagsrum"):
    go(pg, "mitt-rum", 300); pg.evaluate(SAMPLE, r)
    pg.evaluate("(hs) => { RQ.room.saveScene([]); hs.forEach((h) => RQ.room.add(h, true)); }", list(items))
    pg.goto(BASE + "butik/"); pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(1300)


# what the chat shows (English too): the last answer's text and its product cards
def chat(pg, q):
    pg.locator("#chatIn").fill(q); pg.locator("#chatIn").press("Enter"); pg.wait_for_timeout(1150)
    return pg.evaluate("(() => { const m = [...document.querySelectorAll('#log .msg.ai')].pop(); return [m.innerText.replace(/\\n+/g, ' | ').replace(/[\\u00a0\\u202f]/g, ' '), [...m.querySelectorAll('.mini a')].map((a) => a.getAttribute('href').replace(/^.*produkt-/, '').replace(/[/]$/, '')).filter((h, i, l) => l.indexOf(h) === i), [...m.querySelectorAll('a.msg-help')].map((a) => a.getAttribute('href'))]; })()")


YES = ("Ja, det här har vi", "Yes, we have this", "Ja, den finns", "Yes, it comes")
# question, words the answer must hold, the products it must show (first), whether it may say yes
Q30 = [
    ("Har ni en matta som är 200x300?", ["160 × 230 cm, inte 200 × 300"], ["strand-jutematta"], False),
    ("Har ni en rund matta?", ["bara rektangulär", "160 × 230"], ["strand-jutematta"], False),
    ("Har ni mattor i ull?", ["inte i ull", "jute"], ["strand-jutematta"], False),
    ("Har ni mattan i 160x230?", ["Ja, det här har vi"], ["strand-jutematta"], True),
    ("Har ni gardiner som är 280 cm långa?", ["bara i 140 × 250 cm"], ["dagsljus-linnegardin-2-pack"], False),
    ("Har ni linnegardiner i 140 x 250?", ["Ja, det här har vi"], ["dagsljus-linnegardin-2-pack"], True),
    ("Har ni påslakan till dubbelsäng?", ["Till dubbelsäng har vi inget", "150 × 210"], ["vila-paslakanset-linne"], False),
    ("Har ni kuddfodral i sammet?", ["inte i sammet", "lin"], ["lin-kuddfodral"], False),
    ("Har ni kuddfodral i salvia?", ["salvia"], ["lin-kuddfodral"], True),
    ("Har ni rosa kuddfodral?", ["inte i den färgen"], ["lin-kuddfodral"], False),
    ("Finns handdukarna i svart?", ["inte i den färgen"], ["vaffelhandduk-bomull"], False),
    ("Har ni vita handdukar?", ["vitt"], ["vaffelhandduk-bomull"], True),
    ("Har ni handdukar i linne?", ["inte i lin", "bomull"], ["vaffelhandduk-bomull"], False),
    ("Har ni en vas i glas?", ["inte i glas", "Keramikvas"], ["sand-keramikvas"], False),
    ("Har ni en lampa i mässing?", ["inte i mässing"], [], False),
    ("Har ni ljusstakar i mässing?", ["Ja, det här har vi"], ["stilla-ljusstake-massing-2-pack"], True),
    ("Har ni ljusstakar i 4-pack?", ["bara som 2‑pack"], ["stilla-ljusstake-massing-2-pack"], False),
    ("Har ni doftljus utan doft?", ["Utan doft har vi den inte"], ["glod-doftljus-keramik"], False),
    ("Har ni lampor under 500 kr?", ["Under 500 kr har vi ingen lampa", "Svamp uppladdningsbar lampa, 699 kr"], ["svamp-uppladdningsbar-lampa"], False),
    ("Har ni något i ek under 400 kr?", [], [], False),
    ("Hur många lampor har ni?", ["Just nu har vi 3"], [], False),
    ("Vilken är er dyraste produkt?", ["Dyrast är Strand jutematta 160 × 230, 1 490 kr"], ["strand-jutematta"], False),
    ("Har ni lampor till badrummet?", ["Lampor för badrum har vi inte"], [], False),
    ("Har ni en stor vas?", ["Exakta mått"], ["sand-keramikvas"], False),
    ("Do you have a rug in 200x300?", ["It only comes in 160 × 230 cm, not 200 × 300"], ["strand-jutematta"], False),
    ("Do you have velvet cushion covers?", ["We don't have it in velvet"], ["lin-kuddfodral"], False),
    ("Do you have grey curtains?", ["not have it in that colour"], ["dagsljus-linnegardin-2-pack"], False),
    ("Do you sell wool throws?", ["wool blend, not pure wool"], ["plad-ullblandning-havre"], False),
    ("What is your cheapest lamp?", ["The cheapest is Svamp rechargeable lamp, 699 kr"], ["svamp-uppladdningsbar-lampa"], False),
    ("How many candle holders come in a pack?", ["holds 2"], ["stilla-ljusstake-massing-2-pack"], False),
]

with sync_playwright() as p:
    b = p.chromium.launch()

    # ------------------------------------------------------------ B1, C2, C3, cats: the stylist in the chat, as the customer sees it
    ctx, pg, errs = new(b, False, 1280, 900)
    go(pg, "studio-stylist", 900)
    for q, must, picks, yes in Q30:
        t, ps, _ = chat(pg, q)
        ok(all(m in t for m in must), f"stylist: {q!r} says {must}: {t[:220]}")
        ok(yes or not any(y in t for y in YES), f"stylist: {q!r} never says yes to what we do not have: {t[:160]}")
        ok(not picks or ps[:len(picks)] == picks, f"stylist: {q!r} shows {picks}: {ps}")
        en = not re.search(r"[åäöÅÄÖ]|^Har |^Hur |^Vilken |^Finns ", q)
        if en:
            ok(not re.search(r"\b(har vi|finns bara|inte i|Den |De )\b", t), f"stylist: {q!r} is answered in English: {t[:160]}")
    t, ps, help_ = chat(pg, "Jag bor i hyresrätt och får inte borra, hur hänger jag tavlor?")
    ok("Utan att borra" in t and "självhäftande" in t and any("hyresvanlig" in h for h in help_) and ps[:1] == ["affisch-linje-ekram"], f"C2: renting and hanging pictures: no holes, hooks, the renting article: {t[:200]} {help_}")
    t, ps, help_ = chat(pg, "Jag hyr i andra hand, vad kan jag göra?")
    ok("När du hyr" in t and any("hyresvanlig" in h for h in help_), f"C2: the general renting answer links the article too: {help_}")
    t, ps, _ = chat(pg, "Har ni något som tål katter?")
    ok("husdjur" in t and len(ps) >= 2 and "lin-kuddfodral" in ps, f"cats: advice and washable things to show: {ps}")
    t, ps, _ = chat(pg, "Jag har en grå soffa, vilken lampa under 300 kr är billigast?")
    ok("ingen lampa" in t and "Svamp" in t and "kuddfodral" not in t, f"the cheapest lamp, not a cushion: {t[:160]}")
    t, ps, _ = chat(pg, "Har ni en ullpläd?")
    ok("ullblandning, inte i ren ull" in t and "Ja, det här" not in t, f"a wool-blend throw is not called pure wool: {t[:120]}")
    for q in ("Har ni gardiner?", "Har ni soffbord?", "har ni soffor?"):
        t, ps, _ = chat(pg, q)
        ok(("Ja, det här har vi" in t) == (q == "Har ni gardiner?"), f"the plain questions keep their answers: {q!r} {t[:100]}")
    ok(not errs, f"stylist: no script errors {errs[:2]}")
    ctx.close()

    # ------------------------------------------------------------ C5: add-all buttons show the cart once everything lies there
    for W, Hh, mob in SIZES:
        for ev in (False, True):
            tag = f"[C5 {W}{' kväll' if ev else ''}]"
            ctx, pg, errs = new(b, mob, W, Hh, evening=ev)
            room(pg, ["glob-bordslampa-opalglas", "plad-ullblandning-havre"])
            pg.evaluate("RQ.shop.addToCart('glob-bordslampa-opalglas::0', 1)"); pg.wait_for_timeout(400)
            st = lambda: pg.evaluate("['rmCart', 'rmCart2'].map((id) => { const b = document.getElementById(id); return [b.textContent, b.hasAttribute('data-open-cart')]; })")
            ok(st() == [["Lägg allt i varukorgen", False]] * 2, f"{tag} Mitt rum: part of the room in the cart, the buttons still add: {st()}")
            pg.evaluate("RQ.shop.addToCart('plad-ullblandning-havre::0', 1)"); pg.wait_for_timeout(400)
            ok(st() == [["I varukorgen · Visa", True]] * 2, f"{tag} Mitt rum: all of it in the cart, the buttons show the cart: {st()}")
            if not ev and W in (390, 1440):
                pg.evaluate("document.getElementById('rmCart2').click()"); pg.wait_for_timeout(500)
                ok(pg.evaluate(CART_OPEN) and pg.evaluate("RQ.shop.cartCount()") == 2, f"{tag} Mitt rum: the tap opens the cart and adds nothing")
                pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
                pg.evaluate("RQ.room.add('sand-keramikvas', true)"); pg.wait_for_timeout(500)
                ok(st() == [["Lägg allt i varukorgen", False]] * 2, f"{tag} Mitt rum: a new thing in the room, the buttons add again: {st()}")
                # Svep result
                go(pg, "svep", 900)
                k = 0
                while pg.evaluate("!!document.querySelector('#svDeck .sv-card')") and k < 30:
                    pg.evaluate(SVYES if k % 3 != 1 else "document.getElementById('svNo').click()"); pg.wait_for_timeout(260); k += 1
                pg.wait_for_timeout(500)
                SV = "(() => { const b = document.getElementById('svAll'); return [b.textContent, b.hasAttribute('data-open-cart')]; })()"
                ok(pg.evaluate(SV)[0].startswith("Lägg de sparade i varukorgen"), f"{tag} Svep: the result adds first: {pg.evaluate(SV)}")
                hs = pg.evaluate("[...new Set([...document.querySelectorAll('.sv-liked [data-sheet]')].map((x) => x.dataset.sheet))]")
                pg.evaluate("(hs) => hs.forEach((h) => RQ.shop.addToCart(h + '::0', 1))", hs); pg.wait_for_timeout(400)
                ok(pg.evaluate(SV) == ["I varukorgen · Visa", True], f"{tag} Svep: with all of it in the cart the button shows the cart: {pg.evaluate(SV)}")
                c0 = pg.evaluate("RQ.shop.cartCount()"); pg.evaluate("document.getElementById('svAll').click()"); pg.wait_for_timeout(500)
                ok(pg.evaluate(CART_OPEN) and pg.evaluate("RQ.shop.cartCount()") == c0, f"{tag} Svep: the tap opens the cart, nothing doubled")
            ok(not errs, f"{tag} no script errors {errs[:2]}")
            ctx.close()

    # ------------------------------------------------------------ C4: Passar ihop with the vase already in the cart
    for W, Hh, mob in SIZES:
        for ev in (False, True):
            tag = f"[C4 {W}{' kväll' if ev else ''}]"
            ctx, pg, errs = new(b, mob, W, Hh, evening=ev)
            go(pg, "produkt-lysa-keramiklampa", 900)
            pg.evaluate("RQ.shop.addToCart('sand-keramikvas::0', 1)"); pg.wait_for_timeout(400)
            L = pg.evaluate("[[...document.querySelectorAll('.look-item')].map((i) => [i.querySelector('[data-look]').dataset.look, i.classList.contains('in'), i.querySelector('.pr').innerText.trim()]), document.querySelector('.look-sum .sum.total').innerText.replace(/\\s+/g, ' '), document.getElementById('lookAdd').textContent]")
            vase = [x for x in L[0] if x[0] == "sand-keramikvas"]
            ok(vase and vase[0][1] and vase[0][2] == "I varukorgen", f"{tag} the vase in the cart is marked I varukorgen: {vase}")
            ok(L[1].startswith("Att lägga till") and "2 338 kr" in L[1].replace("\xa0", " ") and L[2] == "Lägg 3 produkter i varukorgen", f"{tag} the sum is what is added and says so: {L[1:]}")
            vis = pg.evaluate("(() => { const i = document.querySelector('.look-item:not(.in) [data-look]'); i.scrollIntoView({block:'center'}); const r = i.getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return e === i; })()")
            ok(vis, f"{tag} the tick box is on top of the photo (evening too)")
            if not ev and W in (390, 1440):
                pg.evaluate("['plad-ullblandning-havre::0', 'lin-kuddfodral::1', 'lysa-keramiklampa::0'].forEach((v) => RQ.shop.addToCart(v, 1))"); pg.wait_for_timeout(500)
                b2 = pg.evaluate("[document.getElementById('lookAdd').textContent, document.getElementById('lookAdd').hasAttribute('data-open-cart')]")
                ok(b2 == ["Visa varukorgen", True], f"{tag} all of it in the cart: the button shows the cart: {b2}")
            ok(not errs, f"{tag} no script errors {errs[:2]}")
            ctx.close()
    ctx, pg, errs = new(b, False, 1440, 900, en=True)
    go(pg, "produkt-lysa-keramiklampa", 900); pg.evaluate("RQ.shop.addToCart('sand-keramikvas::0', 1)"); pg.wait_for_timeout(600)
    e = pg.evaluate("[document.querySelector('.look-item.in .pr').innerText.trim(), document.querySelector('.look-sum .sum.total span').innerText]")
    ok(e == ["In the cart", "To add"], f"[C4 en] English: {e}")
    ctx.close()

    # ------------------------------------------------------------ C6 (in-room cards) removed: the founder took the room mode out of the shop (studio round);
    # the rug's card shows its own photo. One check that it does, with a room:
    ctx, pg, errs = new(b, True, 390, 844); room(pg, [], "vardagsrum"); go(pg, "butik", 800)
    ok(pg.evaluate("(() => { const c = document.querySelector('a[href*=strand-jutematta]').closest('.card'); return !c.querySelector('.inr') && /img\\/p\\//.test(c.querySelector('.ph img').src); })()"), "[C6] with a room, the rug's card shows its own photo")
    ctx.close()

    # ------------------------------------------------------------ C7: the AI row says the cart's colour
    for W, Hh, mob in ((390, 844, True), (1440, 900, False)):
        for en in (False, True):
            ctx, pg, errs = new(b, mob, W, Hh, en=en)
            go(pg, "", 500); pg.evaluate("RQ.shop.signIn('test@example.com', 'Test', 'email'); localStorage.setItem('rumiq-ai-consent', JSON.stringify('x'))")
            room(pg, ["lin-kuddfodral", "glob-bordslampa-opalglas"])
            pg.evaluate("RQ.shop.addToCart('lin-kuddfodral::1', 1)")
            pg.evaluate("RQ.openAI()"); pg.wait_for_timeout(2400); pg.evaluate("document.getElementById('aiGo').click()"); pg.wait_for_timeout(2700)
            row = pg.evaluate("document.querySelector('.ai-prods li em').innerText")
            want = "In the cart: Sage · the picture shows Oat" if en else "I varukorgen: Salvia · bilden visar Havre"
            ok(row == want, f"[C7 {W}{' en' if en else ''}] the AI row says the cart's colour: {row}")
            ok(not errs, f"[C7 {W}] no script errors {errs[:2]}")
            ctx.close()

    # ------------------------------------------------------------ C8: /varukorg becomes the shop's address
    for W, Hh, mob in ((390, 844, True), (1440, 900, False)):
        ctx, pg, errs = new(b, mob, W, Hh)
        go(pg, "", 400); pg.evaluate("RQ.shop.addToCart('sand-keramikvas::0', 1)")
        pg.goto(BASE + "varukorg/"); pg.wait_for_timeout(1400)
        ok(pg.evaluate(CART_OPEN) and pg.evaluate("location.pathname").endswith("/butik/"), f"[C8 {W}] /varukorg opens the cart over the shop, the address is the shop's: {pg.evaluate('location.pathname')}")
        pg.keyboard.press("Escape"); pg.wait_for_timeout(500)
        pg.reload(); pg.wait_for_timeout(1300)
        ok(not pg.evaluate(CART_OPEN) and pg.evaluate("location.pathname").endswith("/butik/"), f"[C8 {W}] after closing, a reload is the shop without the cart")
        ok(not errs, f"[C8 {W}] no script errors {errs[:2]}")
        ctx.close()

    # ------------------------------------------------------------ C9: Enter or a click in search: no duplicate view-transition name
    for W, Hh in ((1440, 900), (1280, 720)):
        ctx, pg, errs = new(b, False, W, Hh)
        go(pg, "butik", 900)
        pg.evaluate("document.querySelector('[data-open-search]').click()"); pg.wait_for_timeout(500)
        pg.keyboard.type("lampa vardagsrum", delay=25); pg.wait_for_timeout(900); pg.keyboard.press("Enter"); pg.wait_for_timeout(1500)
        ok("produkt-" in pg.url and not [e for e in errs if "view-transition" in e], f"[C9 {W}] Enter in search opens the product without a duplicate name: {errs[:1]}")
        go(pg, "butik", 800); errs.clear()
        pg.evaluate("document.querySelector('[data-open-search]').click()"); pg.wait_for_timeout(500)
        pg.keyboard.type("vas", delay=25); pg.wait_for_timeout(900)
        pg.evaluate("document.querySelector('#search a[href*=produkt-]').click()"); pg.wait_for_timeout(1500)
        ok("produkt-" in pg.url and not errs, f"[C9 {W}] a click on a search result: no errors {errs[:1]}")
        ctx.close()

    # ------------------------------------------------------------ C10: gift finder heading, Med egna ord without the limit, own photo
    for W, Hh, mob in SIZES:
        ctx, pg, errs = new(b, mob, W, Hh)
        go(pg, "hitta-ratt-present", 900)
        pg.evaluate("document.querySelector('[data-q=for] [data-v]').click()"); pg.fill("#gfMax", "250")
        pg.evaluate("[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Hitta en present').click()"); pg.wait_for_timeout(900)
        h = pg.evaluate("[document.querySelector('#gfOut .eyebrow').innerText, document.querySelectorAll('#gfOut .card').length]")
        ok(re.match(r"^\d+ förslag \+ \d+ till i din prisklass$", h[0]) and h[1] == int(h[0].split()[0]) + int(h[0].split()[3]), f"[C10 {W}] the gift heading counts the extra cards too: {h}")
        go(pg, "hitta-ratt-ord", 900)
        pg.fill("#ssIn", "något grönt och mjukt till soffan under 300 kr"); pg.evaluate("document.querySelector('#ssForm button').click()"); pg.wait_for_timeout(900)
        e = pg.evaluate("[[...document.querySelectorAll('#ssOut .eyebrow')].map((x) => x.innerText), document.querySelectorAll('#ssOut .card').length]")
        ok("Utan prisgränsen:" in e[0] and e[1] >= 3, f"[C10 {W}] Med egna ord with one hit offers more without the limit: {e}")
        ok(not errs, f"[C10 {W}] no script errors {errs[:2]}")
        ctx.close()
    for W, Hh, mob in ((390, 844, True), (1440, 900, False)):
        ctx, pg, errs = new(b, mob, W, Hh)
        go(pg, "mitt-rum", 500); pg.evaluate(OWN)
        pg.evaluate("['lin-kuddfodral', 'glob-bordslampa-opalglas', 'lysa-keramiklampa', 'plad-ullblandning-havre', 'sand-keramikvas'].forEach((h) => RQ.room.add(h, true))")
        pg.goto(BASE + "butik/"); pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(1400)
        sc = pg.evaluate("RQ.room.scene().map((it) => [it.h, it.x, it.y, it.w])")
        lamps = [s for s in sc if s[0] in ("glob-bordslampa-opalglas", "lysa-keramiklampa", "sand-keramikvas")]
        # studio review M1 (supersedes C10's side spots): with unknown surfaces they stand in a tidy row on the floor line, never on a seat or in mid-air
        tidy = all(a[1] <= b[0] + 0.01 for y in {s[2] for s in sc} for rowd in [sorted((s[1] - s[3] / 2, s[1] + s[3] / 2) for s in sc if s[2] == y)] for a, b in zip(rowd, rowd[1:]))
        ok(all(s[2] >= 80 for s in lamps) and tidy, f"[C10 own {W}] in an own photo things for a table stand in a tidy row on the floor, not on a seat: {lamps}")
        ok(all(s[1] - s[3] / 2 >= 1.5 and s[1] + s[3] / 2 <= 98.5 for s in lamps), f"[C10 own {W}] and whole inside the picture: {lamps}")
        ok(not errs, f"[C10 own {W}] no script errors {errs[:2]}")
        ctx.close()

    b.close()

print(f"{n - len(fails)} of {n} checks passed")
sys.exit(1 if fails else 0)
