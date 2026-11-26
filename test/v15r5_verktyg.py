#!/usr/bin/env python3
"""v15 round 5 checks for verktyg: the stylist answers real questions honestly in the language they were asked in,
Hitta rätt, the Svep result, Upptäck.
Run after `python3 tools/build.py`:  python3 test/v15r5_verktyg.py
Own in-process server; everything outside 127.0.0.1 is blocked, as in the sandbox."""
import http.server, json, re, socketserver, sys, threading
from pathlib import Path
from playwright.sync_api import sync_playwright
import sys as _s, os as _o; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); import _edit_way  # noqa: E402,F401  the editor tests start in Justera själv

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

ASK = "(([q, m]) => { const a = RQ.stylistAnswer(q, m || null); return { text: a.text.join(' '), first: a.text[0] || '', picks: a.picks.map((p) => p.handle), names: a.picks.map((p) => p.name), prices: a.picks.map((p) => p.price), tags: a.tags || [], help: a.help && a.help.route, unknown: a.unknown }; })"
MSG = "(() => { const m = [...document.querySelectorAll('#log .msg.ai')].pop(); return [m.innerText, m.lang, m.querySelectorAll('.mini a').length]; })()"

with sync_playwright() as p:
    b = p.chromium.launch()

    # ------------------------------------------------------------ the stylist (D2, D3, D4, P3 and 40 more real questions)
    ctx, pg, errs = new(b, False)
    go(pg, "studio-stylist", 900)
    A = lambda q, m=None: pg.evaluate(ASK, [q, m])
    a = A("har ni soffor?")
    ok(a["text"].startswith("Soffor har vi inte") and len(a["picks"]) == 3 and "hittar inget" not in a["text"] and "lin-kuddfodral" in a["picks"], f"stylist: 'har ni soffor?' is a plain no and what goes with a sofa: {a['text'][:80]!r} {a['picks']}")
    a = A("Har ni soffbord?")
    ok(a["text"].startswith("Soffbord har vi inte") and a["picks"] and not a["unknown"], f"stylist: 'Har ni soffbord?' says we do not sell it and names what we have: {a['text'][:60]!r}")
    a = A("Do you have coffee tables?")
    ok(a["text"].startswith("Soffbord har vi inte") and "sand-keramikvas" in a["picks"] and "plad-ullblandning-havre" not in a["picks"], f"stylist: 'Do you have coffee tables?' is understood: {a['picks']}")
    a = A("vad passar till ett badrum med svart kakel")
    ok("Måla" not in a["text"] and not a["tags"] and a["picks"] and all("lampa" not in h for h in a["picks"]) and {"tvalpump-stengods", "vaffelhandduk-bomull"} <= set(a["picks"]), f"stylist: black bathroom tiles get bathroom things, no renovation line: {a['text'][:60]!r} {a['picks']}")
    a = A("Jag har en grå soffa och vill ha en lampa under 300 kr")
    ok(a["picks"][0] == "svamp-uppladdningsbar-lampa" and a["tags"][0] == "Billigast" and "Billigast är Svamp" in a["text"] and "ingen lampa" in a["text"], f"stylist: grey sofa + lamp under 300 names the cheapest lamp correctly: {a['text'][-120:]!r} {a['tags']}")
    a = A("Vilken lampa är bäst att läsa vid?")
    ok(a["picks"][0] == "lysa-keramiklampa" and "Lysa" in a["first"], f"stylist: the reading lamp is named: {a['first']!r}")
    a = A("Vad är skillnaden mellan Glob och Svamp?")
    ok(set(a["picks"]) == {"glob-bordslampa-opalglas", "svamp-uppladdningsbar-lampa"} and "sladdlös" in a["text"] and "899" in a["text"] and "699" in a["text"], f"stylist: Glob and Svamp compared with price and one line each: {a['text'][:120]!r}")
    a = A("Vad kostar frakten?")
    ok(a["first"].startswith("Hämta hos ombud") and "49 kr" in a["first"], f"stylist: the shipping price comes first: {a['first'][:50]!r}")
    a = A("Hur många dagar tar leveransen?")
    ok(a["first"].startswith("Målet är"), f"stylist: a delivery time question still gets the time first: {a['first'][:40]!r}")
    for q, want in (("Har ni en tv-bänk?", "Tv-bänkar"), ("Har ni speglar?", "Speglar har vi inte"), ("Jag letar efter en golvlampa", "golvlampor har vi inte"), ("Har ni växter?", "Växter"),
                    ("Det billigaste ni har", "billigaste"), ("Vad är populärast?", "precis börjat"), ("Kan jag hämta i butik?", "ingen butik"), ("Har ni rea?", "erbjudanden"),
                    ("Är det här en riktig butik?", "förhandsversion"), ("Kan du rita mitt rum?", "Mitt rum"), ("Är du en AI?", "AI-tjänst"), ("Har ni presentkort?", "Presentkorten"),
                    ("Är lampan dimbar?", "inte svara säkert"), ("Hur stor är jutemattan?", "160 × 230"), ("Jag hyr och får inte borra i väggarna", "hyr"),
                    ("Barnrummet är alltid stökigt", "barnen"), ("Tips för en liten etta på 25 kvadrat", "litet hem"), ("Jag gillar japandi", "Japandi"),
                    ("Kan jag få kuddfodralet i grönt?", "salvia"), ("Vilken färg har vasen?", "en färg"), ("Hur hänger jag tavlan?", "ögonhöjd"), ("Det luktar instängt i hallen", "Vädra")):
        a = A(q)
        ok(want.lower() in a["text"].lower() and not a["unknown"], f"stylist: {q!r} answered: {a['text'][:80]!r}")
    a = A("Mitt kök känns tråkigt och vitt")
    ok(a["first"].startswith("Vitt blir") and all("kok" in RQ_ROOMS for RQ_ROOMS in [pg.evaluate("(h) => RQ.byHandle(h).rooms", h) for h in a["picks"]]), f"stylist: a white kitchen gets advice for white and kitchen things: {a['first'][:40]!r} {a['picks']}")
    a = A("Jag har 1000 kr, vad ska jag köpa till vardagsrummet?")
    ok(sum(a["prices"]) <= 1000 and "Tillsammans" in a["text"], f"stylist: a total budget is kept together: {a['prices']}")
    a = A("Hemmakontoret är mörkt på vintern")
    ok(a["picks"] and all("lampa" in h for h in a["picks"]) and "Just det har vi inte" not in a["text"], f"stylist: a dark office gets lamps, not 'we do not have that': {a['picks']}")
    a = A("Present till en kollega max 200 kr")
    ok("uppskattade" not in a["text"] and a["tags"] == ["Närmast"], f"stylist: no 'here are things' when nothing fits the budget: {a['text'][:60]!r}")
    a = A("Is the candle vegan?")
    ok(a["picks"] == ["glod-doftljus-keramik"] and "Vegetabiliskt" in a["text"], f"stylist: 'the candle' is the scented candle, the material is said and nothing invented: {a['picks']}")
    ok(pg.evaluate("RQ.isEnglish('Do you have coffee tables?') && !RQ.isEnglish('Har ni soffbord?') && !RQ.isEnglish('Vad passar i ett litet sovrum?') && RQ.isEnglish('I rent and can\\'t paint the walls')"), "stylist: English questions are recognised")
    ok(not errs, f"stylist: no script errors {errs[:2]}")
    # an English question on the Swedish site gets an English answer, also after a reload
    say = lambda q: (pg.fill("#chatIn", q), pg.press("#chatIn", "Enter"), pg.wait_for_timeout(1800), pg.evaluate(MSG))[-1]
    r = say("Do you have coffee tables?")
    ok(r[1] == "en" and r[0].startswith("We do not have coffee tables") and "Sand ceramic vase" in r[0] and r[2] == 3, f"stylist sv site: an English question gets an English answer: {r[0][:80]!r}")
    r = say("Har ni soffbord?")
    ok(r[1] != "en" and r[0].startswith("Soffbord har vi inte"), f"stylist sv site: a Swedish question stays Swedish: {r[0][:40]!r}")
    pg.reload(wait_until="load"); pg.wait_for_timeout(2200)
    ok(pg.evaluate("[...document.querySelectorAll('#log .msg.ai')].some(m => m.lang === 'en' && /^We do not have coffee tables/.test(m.innerText))"), "stylist sv site: the English answer stays English after a reload")
    ctx.close()
    # the English site: every answer in English, no Swedish left
    ctx, pg, errs = new(b, True, en=True)
    go(pg, "studio-stylist", 900)
    left = pg.evaluate("""(qs) => qs.filter((q) => RQ.stylistAnswer(q).text.some((t) => !window.RQ_t(t)))""", ["har ni soffor?", "Har ni soffbord?", "Do you have coffee tables?", "vad passar till ett badrum med svart kakel", "I have a grey sofa and want a lamp under 300 kr", "Which lamp is best for reading?", "What is the difference between Glob and Svamp?", "How much is shipping?", "Something for my dog", "Is the jute rug ok with pets?", "What's your cheapest candle?", "Do you sell gift cards?", "Where are you based?", "I rent and can't paint the walls, how do I make it cosy?", "Tips för en liten etta", "Kan jag få kuddfodralet i grönt?", "Jag har 1000 kr, vad ska jag köpa till vardagsrummet?", "Hemmakontoret är mörkt på vintern"])
    ok(not left, f"stylist en: every answer has its English words: {left}")
    r = (pg.fill("#chatIn", "I have a grey sofa and want a lamp under 300 kr"), pg.press("#chatIn", "Enter"), pg.wait_for_timeout(1300), pg.evaluate(MSG))[-1]
    ok("The cheapest is Svamp rechargeable lamp" in r[0] and "Cheapest" in r[0] and "Billigast" not in r[0], f"stylist en: cheapest said in English: {r[0][-200:]!r}")
    ok(not errs, f"stylist en: no script errors {errs[:2]}")
    ctx.close()

    # ------------------------------------------------------------ Hitta rätt: Med egna ord names the colour (D7), the gift price field and few results (P9)
    for mobile in (True, False):
        tag = "390" if mobile else "1440"
        ctx, pg, errs = new(b, mobile)
        go(pg, "hitta-ratt-ord", 900)
        pg.fill("#ssIn", "något grönt och mjukt till soffan under 300 kr"); pg.press("#ssIn", "Enter"); pg.wait_for_timeout(1300)
        got = pg.evaluate("[...document.querySelectorAll('#ssOut .ss-got .chip')].map(c => c.textContent.trim())")
        ok("Sovrum & komfort" not in got and "Salvia" in got and "Vardagsrum" in got, f"med egna ord {tag}: a sofa is not 'Sovrum & komfort', the colour is named: {got}")
        ok("färgen salvia" in pg.evaluate("document.getElementById('ssOut').innerText"), f"med egna ord {tag}: the reason names the colour")
        st = pg.evaluate("(() => { const c = document.querySelector('#ssOut .ss-got .chip'); const s = getComputedStyle(c); return [c.tagName, s.backgroundColor, s.cursor]; })()")
        ok(st[0] == "LI" and st[1] in ("rgba(0, 0, 0, 0)", "transparent") and st[2] == "default", f"med egna ord {tag}: what we understood are outline labels, not buttons: {st}")
        go(pg, "hitta-ratt-present", 900)
        ok(pg.input_value("#gfMax") == "" and pg.get_attribute("#gfMax", "placeholder") == "Till exempel 500", f"presentguiden {tag}: the price field is empty with a placeholder")
        pg.click("[data-q=for] [data-v=vard]"); pg.wait_for_timeout(300); pg.click("[data-q=occ] [data-v=inflyttning]"); pg.wait_for_timeout(300)
        pg.fill("#gfMax", "250"); pg.click("#gfGo"); pg.wait_for_timeout(1300)
        names = pg.evaluate("[...document.querySelectorAll('#gfOut .card')].map(c => c.querySelector('a[href*=produkt]').getAttribute('href').replace(/^.*produkt-/, '').replace(/[/]$/, ''))")
        ok(len(names) >= 3 and {"lin-kuddfodral", "forvaringslada-filt"} <= set(names) and pg.evaluate("!!document.querySelector('#gfOut a[href=\"#presentkort\"], #gfOut a[href*=presentkort]')"), f"presentguiden {tag}: fewer than three ideas get more under the limit and the gift card: {names}")
        ok(not errs, f"hitta rätt {tag}: no script errors {errs[:2]}")
        ctx.close()

    # ------------------------------------------------------------ the Svep result: simple and light (D8)
    for mobile in (True, False):
        tag = "390" if mobile else "1440"
        ctx, pg, errs = new(b, mobile)
        go(pg, "svep", 1200)
        for i in range(10):
            pg.click("#svYes"); pg.wait_for_timeout(420)
        pg.wait_for_timeout(1500)
        r = pg.evaluate("""(() => { const res = document.querySelector('.svep-result'); const vis = (e) => !!e && e.offsetParent !== null && getComputedStyle(e).visibility !== 'hidden';
          // svep2: 'Mer som det här' belongs to the saved things (it was a link on each one before), so it is counted with them
          // studio2 ai: the result ends in the room proposal card (its two actions, Se det i ditt rum and Köp allt, are counted on their own)
          const acts = [...res.querySelectorAll('a, button, input')].filter((e) => vis(e) && !e.closest('.sv-liked') && !e.closest('.ml-way') && !e.closest('form[hidden]') && !e.closest('.hem-prop'));
          const sm = res.querySelector('.sp-look small');
          return { two: [...document.querySelectorAll('.sv-two-link, .sp-two')].filter(vis).length, acts: acts.map((e) => e.textContent.trim().slice(0, 30)), watch: !!res.querySelector('input[type=email]'), small: sm ? getComputedStyle(sm).display : 'none' }; })()""")
        ok(r["two"] == 1, f"svep result {tag}: 'Inreder ni tillsammans?' once: {r['two']}")
        ok(not r["watch"] and len(r["acts"]) <= 8, f"svep result {tag}: few actions, no e-mail form: {r['acts']}")
        ok(r["small"] == "block", f"svep result {tag}: the look text is a block with even lines: {r['small']}")
        ok(not errs, f"svep result {tag}: no script errors {errs[:2]}")
        ctx.close()

    # ------------------------------------------------------------ Upptäck at 430 without empty bands, Hitta rätt's stylist line aligned (P11, P12)
    ctx, pg, errs = new(b, True, w=430, h=932)
    go(pg, "upptack", 1200)
    r = pg.evaluate("""(() => { const R = (s) => document.querySelector(s).getBoundingClientRect(); const c = R('.svt-cards'), h = R('.svt-tx h3'), card = R('.svt');
      const cap = R('.jr-cap-after'), looks = document.querySelector('.jr-cap-after + .sec .sec-head').getBoundingClientRect(), last = [...document.querySelectorAll('.jr-room')].pop().querySelector('.jr-row').getBoundingClientRect();
      const vote = document.querySelector('.jr-cap-after + .sec + section').getBoundingClientRect(), mag = document.querySelector('.jr-cap-after + .sec + section + .sec .sec-head').getBoundingClientRect();
      return { beside: h.left > c.right - 2 && h.top < c.bottom, empty: card.right - Math.max(h.right, c.right), capGap: cap.top - (document.querySelector('.journey').getBoundingClientRect().bottom), toLooks: looks.top - cap.bottom, toMag: mag.top - vote.bottom }; })()""")
    ok(r["beside"], f"upptäck 430: the Svep card puts the cards beside the heading: {r}")
    ok(r["toLooks"] < 110 and r["toMag"] < 110 and r["capGap"] < 0, f"upptäck 430: no empty bands around the picture note and between Önska and Magasin: {r}")
    go(pg, "hitta-ratt", 900)
    x = pg.evaluate("[document.querySelector('.fr-ai').getBoundingClientRect().left, document.querySelector('.fr-tabs .chip').getBoundingClientRect().left]")
    ok(abs(x[0] - x[1]) < 1, f"hitta rätt 430: 'Hellre prata? Fråga stylisten' starts at the same edge as the tabs: {x}")
    ok(not errs, f"upptäck 430: no script errors {errs[:2]}")
    ctx.close()
    ctx, pg, errs = new(b, True, en=True)
    go(pg, "looks", 1000)
    t = pg.evaluate("document.body.innerText")
    ok("in one evening" in t and "in an evening" not in t, "english: the hall look says 'in one evening'")
    ctx.close()

    b.close()

print(f"{n - len(fails)} of {n} checks passed")
sys.exit(1 if fails else 0)
