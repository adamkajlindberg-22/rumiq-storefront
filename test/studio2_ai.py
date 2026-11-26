#!/usr/bin/env python3
"""Studio 2 (studio-ai): Mitt hem (Sparat as the customer's home), the core flow and the moodboard.
5 Skapa ditt första rum (name and type first), room cards with the newest after-picture and one next step, the room
  sheet (all fields, inköpslista with Köpt, budget and what is left), pictures in the room and in Alla bilder with
  Flytta till rum and Prova igen i Studio, benefits row, stylist conversation, one storage layer that syncs;
6 Svep and the stylist end in a ready room proposal (style, colours, budget-aware set, total) → Se det i ditt rum →
  saved in the room → Köp allt; "Vad tycker du?" link with answers back; a look opens in your room; the promise;
3 the moodboard: add, auto-layout, move, resize, layer, colours, note, save as look, share, Prova i ett rum.
Run after `python3 tools/build.py`:  python3 test/studio2_ai.py
Own in-process server; everything outside 127.0.0.1 is blocked, as in the sandbox."""
import http.server, os, re, socketserver, sys, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
AXE = Path(os.environ.get("AXE", "/home/claude/axe/node_modules/axe-core/axe.min.js"))
SHOTS = Path(os.environ.get("SHOTS", "/tmp/studio2-ai-shots"))
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
TOAST = "[...document.querySelectorAll('.toast.show')].map((t) => t.innerText).join(' ')"
LINES = "RQ.shop.cartLines().map((l) => l.id).sort().join(',')"
ROOM0 = "RQ.hem.rooms()[0]"
# share and clipboard caught in the page: the link a button would send
CATCH = """() => { window.__sent = []; Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => { window.__sent.push(t); } }, configurable: true }); }"""


def new(b, mobile, w, h, evening=False, en=False):
    kw = dict(viewport={"width": w, "height": h}, device_scale_factor=2, is_mobile=True, has_touch=True, user_agent=UA) if mobile else dict(viewport={"width": w, "height": h})
    ctx = b.new_context(locale="sv-SE", accept_downloads=True, **kw)
    ctx.route(re.compile(r"^https?://(?!127\.0\.0\.1)"), lambda r: r.abort())
    init = ("localStorage.setItem('rumiq-ljus', 'kvall');" if evening else "") + ("localStorage.setItem('rumiq-lang', JSON.stringify('en'));" if en else "")
    if init:
        ctx.add_init_script("if (!sessionStorage.getItem('__i')) { sessionStorage.setItem('__i', '1'); " + init + " }")
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: m.type == "error" and "ERR_FAILED" not in m.text and errs.append(m.text))
    return ctx, pg, errs


def go(pg, route, wait=900):
    pg.goto(BASE + (route + "/" if route else ""), wait_until="load")
    pg.wait_for_timeout(wait)
    pg.evaluate("document.getElementById('ckNeed') && document.getElementById('ckNeed').click()")
    pg.evaluate("RQ.loadTools && RQ.loadTools()")
    pg.wait_for_timeout(250)


def shot(pg, name):
    SHOTS.mkdir(parents=True, exist_ok=True)
    pg.screenshot(path=str(SHOTS / f"{name}.png"))


def first_room(pg, label="Vardagsrummet", style="skandinavisk", how="sample"):
    go(pg, "mitt-hem", 1300)
    pg.fill("#hemFirstF [name=label]", label)
    if style:
        pg.evaluate("(s) => document.querySelector(`#hemFirstF [data-first-style=${s}]`).click()", style)
    pg.evaluate("(h) => document.querySelector(`#hemFirstF button[value=${h}]`).click()", how); pg.wait_for_timeout(2600)


def ai_picture(pg):
    pg.evaluate("RQ.shop.signIn('test@example.com', 'Test', 'email'); localStorage.setItem('rumiq-ai-consent', JSON.stringify('x'))")
    pg.evaluate("RQ.openAI()"); pg.wait_for_timeout(2200); pg.evaluate("document.getElementById('aiGo').click()"); pg.wait_for_timeout(3600)
    pg.keyboard.press("Escape"); pg.wait_for_timeout(300)


with sync_playwright() as p:
    b = p.chromium.launch()

    # ------------------------------------------------ 5. Mitt hem: the first room, cards, the room sheet, pictures
    for W, Hh, mob in ((390, 844, True), (1440, 900, False)):
        tag = f"[hem {W}]"
        ctx, pg, errs = new(b, mob, W, Hh)
        go(pg, "mitt-hem", 1300)
        first = pg.evaluate("document.querySelector('.mh > [id]').id")
        ok(first == "mh-rum" and pg.evaluate("!!document.getElementById('hemFirst')") and "Skapa ditt första rum" in pg.evaluate("document.getElementById('hemFirst').innerText"), f"{tag} a new customer sees 'Skapa ditt första rum' first: {first}")
        ok(pg.evaluate("document.querySelector('#hemFirstF input[name=label]').compareDocumentPosition(document.querySelector('#hemFirstF button[value=own]')) & 4") != 0, f"{tag} the first step is the name and the room type, the photo comes after")
        ok("5 AI-bilder gratis i månaden med konto, när sajten är live. Bilderna sparas privat på den här enheten." in pg.evaluate("document.getElementById('hemFirst').innerText") and pg.evaluate("RQ.ai.promise(true)") in pg.evaluate("document.getElementById('hemFirst').innerText"), f"{tag} the free AI pictures are said, honestly as a preview, from config, in the one promise used everywhere before sign-in")
        ok(not pg.evaluate("!!document.getElementById('hrOpen')") and pg.evaluate("document.querySelector('#hemFirstF input[name=label]').placeholder").startswith("Till exempel"), f"{tag} the empty page has one way to start (no second 'Lägg till ditt första rum' under it), and the name field does not look filled in")
        ok(pg.evaluate("document.querySelectorAll('.hem-bens li').length") == 3 and "när kontot är aktivt" in pg.evaluate("document.querySelector('.hem-bens').innerText").lower(), f"{tag} three benefits for a signed-out customer, only true claims")
        ok(pg.evaluate("(document.body.innerText.match(/Allt du sparar här är privat/g) || []).length") == 1, f"{tag} the privacy line is said once")
        shot(pg, f"hem-{W}-empty")
        first_room(pg)
        r = pg.evaluate(ROOM0)
        ok(pg.evaluate("RQ.currentRoute()") == "mitt-rum" and r["label"] == "Vardagsrummet" and r["type"] == "vardagsrum" and r["style"] == "skandinavisk" and len(r["items"]) >= 3, f"{tag} the first room is made with its name, type, style and a set, and opens in Mitt rum: {[r.get('label'), r.get('style'), len(r.get('items', []))]}")
        ok(sorted(pg.evaluate("RQ.room.scene().map((i) => i.h)")) == sorted(i["h"] for i in r["items"]) and pg.evaluate("RQ.room.get().map") == "vardagsrum", f"{tag} the sample room of that type holds exactly the room's products, placed by the editor")
        ok(pg.evaluate("RQ.hem.activeId()") == r["id"] and r.get("pkey") == pg.evaluate("RQ.ai.projectKey()"), f"{tag} the room is the active one and knows its room photo")
        ai_picture(pg)
        pics = pg.evaluate("RQ.aiLib.pics()")
        ok(len(pics) == 1 and pics[0]["roomId"] == r["id"], f"{tag} the AI picture lands in the room automatically")
        pg.evaluate("RQ.room.remove(RQ.room.scene()[0].h)"); pg.wait_for_timeout(700)
        ok(len(pg.evaluate(ROOM0)["items"]) == len(r["items"]) - 1, f"{tag} what changes in Mitt rum follows into the room project")
        go(pg, "mitt-hem", 1700)
        ok(pg.evaluate("document.querySelector('#mh-rum h2').innerText") == "Fortsätt där du slutade" and pg.evaluate("document.querySelectorAll('.hem-card.big').length") == 1, f"{tag} the overview: big room cards, 'Fortsätt där du slutade'")
        ok(pg.evaluate("document.querySelector('.hem-card.has-pic img').src.startsWith('blob:') && !document.querySelector('.hem-card.has-pic .hem-card-col')"), f"{tag} the card shows the newest after-picture")
        prog = pg.evaluate("document.querySelector('[data-room-prog]').innerText")
        ok("✓ Stil" in prog and "✓ 1 bild" in prog and "produkter valda" in prog and pg.evaluate("document.querySelector('[data-hem-next]').innerText") == "Välj budget", f"{tag} progress and the next step: {prog} → {pg.evaluate('document.querySelector(\"[data-hem-next]\").innerText')}")
        shot(pg, f"hem-{W}-cards")
        pg.evaluate("document.querySelector('[data-hem-next]').click()"); pg.wait_for_timeout(900)
        ok(pg.evaluate("document.getElementById('hemSheet').classList.contains('open') && document.activeElement && document.activeElement.name === 'budget'"), f"{tag} 'Välj budget' opens the room at its budget field")
        pg.fill("#hemRoomF [name=budget]", "1500"); pg.wait_for_timeout(700)
        ok(pg.evaluate(ROOM0)["budget"] == 1500, f"{tag} the room's fields save as you type")
        pg.fill("#hemRoomF [name=notes]", "Varmt ljus i soffhörnan"); pg.fill("#hemRoomF [name=material]", "Ek och lin"); pg.wait_for_timeout(700)
        rr = pg.evaluate(ROOM0)
        ok(rr["notes"] == "Varmt ljus i soffhörnan" and rr["material"] == "Ek och lin", f"{tag} notes and material are kept")
        pg.evaluate("RQ.hem.openRoom(RQ.hem.rooms()[0].id)"); pg.wait_for_timeout(900)
        money = pg.evaluate("document.querySelector('.hem-money').innerText")
        ok(("Över budget" in money or "Kvar av budgeten" in money) and "Totalt" in money, f"{tag} the list shows the total and what is left of the budget: {money}")
        first_h = pg.evaluate("document.querySelector('[data-bought]').dataset.bought")
        pg.evaluate("document.querySelector('[data-bought]').click()"); pg.wait_for_timeout(300)
        ok(first_h in pg.evaluate(ROOM0)["bought"] and pg.evaluate("!!document.querySelector('.hem-list li.done')"), f"{tag} Köpt can be ticked by hand")
        pg.evaluate("RQ.shop.clearCart()"); pg.evaluate("document.getElementById('hemBuyRest').click()"); pg.wait_for_timeout(500)
        lines = pg.evaluate(LINES)
        ok(first_h not in lines and len(lines.split(",")) == len(pg.evaluate(ROOM0)["items"]) - 1, f"{tag} 'Köp det som är kvar' adds only what is not bought: {lines}")
        ok(pg.evaluate("document.querySelectorAll('#hemPics .ai-lcard').length") == 1, f"{tag} the room's own pictures are in the room sheet")
        shot(pg, f"hem-{W}-sheet")
        sees = pg.evaluate("[...document.querySelectorAll('#hemSheet button')].filter((b) => b.offsetParent && /Se det i ditt rum/.test(b.innerText)).length")
        ok(sees == 1 and pg.evaluate("!!document.querySelector('#hemPropSec details.hem-other:not([open]) .hem-prop')") and pg.evaluate("[...document.querySelectorAll('#hemSheet [data-hem-ask]')].filter((b) => b.offsetParent).length") == 0, f"{tag} the room sheet does not repeat itself: one 'Se det i ditt rum', one 'Vad tycker du?', another proposal behind one line ({sees})")
        pg.keyboard.press("Escape"); pg.wait_for_timeout(600)
        ok(pg.evaluate("document.activeElement && document.activeElement.matches('.hem-card-name, [data-hem-next]')"), f"{tag} Esc closes the room sheet and gives the focus back to the room's card: {pg.evaluate('document.activeElement && document.activeElement.outerHTML.slice(0, 60)')}")
        # a second room; the picture moves to it from Alla bilder
        pg.evaluate("RQ.hem.create({ label: 'Sovrummet', type: 'sovrum' })"); go(pg, "mitt-hem", 1600)
        ok(pg.evaluate("!!document.querySelector('#mh-bilder [data-lib-move]')") and pg.evaluate("!!document.querySelector('#mh-bilder [data-lib-cont]')") and pg.evaluate("document.querySelector('#mh-bilder [data-lib-cont]').innerText") == "Prova igen i Studio", f"{tag} Alla bilder: Flytta till rum and Prova igen i Studio")
        pg.evaluate("(() => { const s = document.querySelector('#mh-bilder [data-lib-move]'); s.value = RQ.hem.rooms().find((r) => r.label === 'Sovrummet').id; s.dispatchEvent(new Event('change')); })()"); pg.wait_for_timeout(700)
        ok(pg.evaluate("RQ.aiLib.pics().then((p) => p[0].roomId)") == pg.evaluate("RQ.hem.rooms().find((r) => r.label === 'Sovrummet').id") and "Sovrummet" in pg.evaluate(TOAST), f"{tag} 'Flytta till rum' moves the picture to another room")
        pg.wait_for_timeout(600)
        progs = pg.evaluate("Object.fromEntries([...document.querySelectorAll('.hem-card')].map((c) => [c.querySelector('.hem-card-name').innerText, c.querySelector('[data-room-prog]').innerText]))")
        ok("1 bild" not in progs.get("Vardagsrummet", "") and "1 bild" in progs.get("Sovrummet", ""), f"{tag} the cards follow the move at once: {progs}")
        ok(pg.evaluate("document.querySelector('#mh-bilder h2').innerText") == "Alla bilder" and pg.evaluate("document.querySelector('[data-ai-count]').innerText").startswith("Alla bilder"), f"{tag} one name: Alla bilder")
        # Prova igen i Studio: the editor with the same room and products, the room active again
        pg.evaluate("document.querySelector('#mh-bilder [data-lib-cont]').click()"); pg.wait_for_timeout(1800)
        ok(pg.evaluate("RQ.currentRoute()") == "mitt-rum" and pg.evaluate("RQ.room.scene().length") >= 3, f"{tag} 'Prova igen i Studio' opens the editor with the picture's room and products")
        g4 = pg.evaluate("(() => { const s = RQ.hem.rooms().find((r) => r.label === 'Sovrummet'); return [RQ.hem.activeId() === s.id, RQ.room.get().map, (document.querySelector('[data-proj][aria-pressed=true]') || {}).innerText || ''] })()")
        ok(g4[0] and g4[1] == "sovrum" and "Sovrummet" in g4[2], f"{tag} a living-room picture moved to the bedroom opens the bedroom (its tab chosen) with the picture's things: {g4}")
        ok(not pg.evaluate("document.getElementById('toast').classList.contains('show')") or "Sovrummet" not in pg.evaluate(TOAST), f"{tag} the toast about the move does not follow onto the next page")
        # a room goes, and comes back
        go(pg, "mitt-hem", 1500); n0 = pg.evaluate("RQ.hem.rooms().length")
        pg.evaluate("RQ.hem.openRoom(RQ.hem.rooms()[0].id)"); pg.wait_for_timeout(700); pg.evaluate("document.getElementById('hemDel').click()"); pg.wait_for_timeout(600)
        ok(pg.evaluate("RQ.hem.rooms().length") == n0 - 1 and "Ångra" in pg.evaluate(TOAST), f"{tag} Ta bort rummet, with Ångra")
        pg.evaluate("document.querySelector('#toast [data-hem-undo]').click()"); pg.wait_for_timeout(700)
        ok(pg.evaluate("RQ.hem.rooms().length") == n0, f"{tag} Ångra brings the room back")
        # the stylist conversation, re-openable
        pg.evaluate("RQ.shop.store.set('rumiq-chat-saved', [{ who: 'me', text: 'Varmare ljus i vardagsrummet', q: 'x' }, { who: 'ai', a: { picks: [] } }])"); go(pg, "mitt-hem", 1300)
        ok("Varmare ljus" in pg.evaluate("document.getElementById('mh-chat').innerText") and pg.evaluate("document.querySelector('#mh-chat a').getAttribute('href').includes('studio-stylist')"), f"{tag} the saved stylist conversation is here and can be opened again")
        pg.evaluate("RQ.hem.create({ label: 'Hallen', type: 'hall', items: [{ h: 'glob-bordslampa-opalglas', v: 0 }, { h: 'flatad-forvaringskorg', v: 0 }] })"); go(pg, "mitt-hem", 1500)
        # with the editor's R.snapshot (room.js) the card shows the sample room drawn with its products; the cut-out collage is the fallback
        card = pg.evaluate("(() => { const c = [...document.querySelectorAll('.hem-card')].find((c) => c.innerText.includes('Hallen')); return [c.classList.contains('snap'), [...c.querySelectorAll('img')].some((i) => /^data:image.jpeg/.test(i.src)), c.querySelectorAll('.hem-card-col img').length]; })()")
        ok((card[0] and card[1]) or card[2] == 2, f"{tag} a room without a picture shows its products in the room, never an empty room: {card}")
        pg.evaluate("RQ.room.snapshot = async (id, w) => { window.__snap = [id, w]; const c = document.createElement('canvas'); c.width = 40; c.height = 25; return c.toDataURL('image/png'); }; RQ.router()"); pg.wait_for_timeout(1500)
        card = pg.evaluate("(() => { const c = [...document.querySelectorAll('.hem-card')].find((c) => c.innerText.includes('Hallen')); return [c.classList.contains('snap'), c.querySelector('img').src.slice(0, 15), !!c.querySelector('.hem-card-col'), window.__snap && window.__snap[1]]; })()")
        ok(card[0] and card[1].startswith("data:image/png") and not card[2] and card[3] == 900, f"{tag} with the editor's R.snapshot the card shows the room drawn with its products: {card}")
        pg.evaluate("RQ.hem.remove(RQ.hem.rooms().find((r) => r.label === 'Hallen').id); delete RQ.room.snapshot")
        ok(not errs, f"{tag} no script errors: {errs[:3]}")
        ctx.close()

    # ------------------------------------------------ one storage layer: local now, the account when it is live
    ctx, pg, errs = new(b, False, 1280, 720)
    go(pg, "mitt-hem", 1000)
    ok(pg.evaluate("RQ.vault.where()") == "local", "[vault] today everything is local")
    pg.evaluate("""() => { window.__up = []; RQ_CONFIG.studio.serverSync = true; RQ.ai.live = () => true; RQ.shop.signIn('t@e.se', 'T', 'email');
      RQ.auth.client = () => ({ from: () => ({ upsert: async (rows) => { window.__up.push(...rows); return { error: null }; }, select: async () => ({ data: [], error: null }) }) }); }""")
    pg.evaluate("RQ.hem.create({ label: 'Hallen', type: 'hall' })"); pg.wait_for_timeout(1700)
    ok(pg.evaluate("RQ.vault.where()") == "account" and pg.evaluate("__up.some((r) => r.key === 'rumiq-home' && JSON.stringify(r.value).includes('Hallen'))"), "[vault] with the account live, a room is pushed to the account table")
    ctx.close()

    # ------------------------------------------------ 6. the core flow: Svep → proposal → Se det i ditt rum → Köp allt
    for W, Hh, mob in ((390, 844, True), (1440, 900, False)):
        tag = f"[flow {W}]"
        ctx, pg, errs = new(b, mob, W, Hh)
        go(pg, "svep", 1200)
        pg.focus("#svDeck")
        for i in range(10):
            pg.keyboard.press("ArrowRight"); pg.wait_for_timeout(260)
        pg.wait_for_timeout(1800)
        card = pg.evaluate("(() => { const c = document.querySelector('.svep-result .hem-prop'); return c && [c.querySelector('h3').innerText, c.querySelectorAll('.hem-prop-items li').length, c.querySelector('.hem-promise').innerText]; })()")
        ok(card and card[0].startswith("Ditt vardagsrum i ") and card[1] >= 3 and card[2] == "Se ditt hem innan du köper.", f"{tag} the Svep result ends in a ready room proposal: {card}")
        vis = pg.evaluate("[...document.querySelectorAll('.svep-result .hem-prop a, .svep-result .hem-prop button, .svep-result .hem-prop input')].filter((e) => e.offsetParent && e.getBoundingClientRect().height > 0 && !e.closest('details:not([open])')).map((e) => e.textContent.trim())")
        main = [x for x in vis if not x.startswith("Visa alla")]
        ok(len(main) == 4 and main[0] == "Se det i ditt rum" and re.match(r"^Köp allt · [\d\s]+ kr$", main[1]) and main[2:] == ["Vad tycker du?", "Ett annat förslag"] and pg.evaluate("!!document.querySelector('.svep-result .hem-more:not([open]) [data-hem-budget]') && !!document.querySelector('.svep-result .hem-more:not([open]) [data-hem-type]')"), f"{tag} the card in Svep: Se det i ditt rum, Köp allt · total and Vad tycker du? in view; only room type and budget behind 'Ändra rum och budget': {vis}")
        if mob:  # the phone: two small pictures and +N in a row with the total (one line, also at 360), "Visa alla N" opens the list
            row = pg.evaluate("(() => { const c = document.querySelector('.svep-result .hem-prop'), r = c.querySelector('.hem-prop-row'); return [c.querySelectorAll('.hem-prop-thumbs img').length, getComputedStyle(c.querySelector('.hem-prop-items')).display, (c.querySelector('[data-hem-all]') || {}).textContent || '', Math.round(c.getBoundingClientRect().height), Math.round(r.getBoundingClientRect().height), r.scrollWidth <= r.clientWidth + 1]; })()")
            ok(row[0] == 2 and row[1] == "none" and row[2].startswith("Visa alla") and row[3] < 640 and row[4] <= 56 and row[5], f"{tag} the phone card is short: two pictures, +N and the total on one line, the list behind Visa alla: {row}")
            pg.evaluate("document.querySelector('.svep-result [data-hem-all]').click()"); pg.wait_for_timeout(300)
            ok(pg.evaluate("getComputedStyle(document.querySelector('.svep-result .hem-prop-items')).display") != "none" and pg.evaluate("document.activeElement && document.activeElement.textContent") == "Visa färre", f"{tag} Visa alla opens the list, the focus stays on the button")
            pg.evaluate("document.querySelector('.svep-result [data-hem-all]').click()"); pg.wait_for_timeout(200)
        shot(pg, f"flow-{W}-svep")
        # the budget: a lower one keeps the set inside it and says what is left
        pg.evaluate("(() => { const r = document.querySelector('.svep-result [data-hem-budget]'); r.value = r.min * 1 + 500; r.dispatchEvent(new Event('input', { bubbles: true })); })()"); pg.wait_for_timeout(500)
        tot = pg.evaluate("(() => { const b = document.querySelector('.svep-result [data-hem-budget]'); return [+b.value, +document.querySelector('.svep-result .hem-prop-sum b').innerText.replace(/\\D/g, ''), !!document.querySelector('.svep-result .hem-left')]; })()")
        ok(tot[1] <= tot[0] and tot[2], f"{tag} the proposal keeps to the budget and says what does not fit: {tot}")
        pg.evaluate("document.querySelector('.svep-result [data-hem-type=sovrum]').click()"); pg.wait_for_timeout(300)
        ok(pg.evaluate("document.querySelector('.svep-result .hem-prop h3').innerText").startswith("Ditt sovrum"), f"{tag} another room type in one tap")
        pg.evaluate("(() => { const r = document.querySelector('.svep-result [data-hem-budget]'); r.value = r.max; r.dispatchEvent(new Event('input', { bubbles: true })); })()"); pg.wait_for_timeout(500)
        want = pg.evaluate("[...document.querySelectorAll('.svep-result .hem-prop-items li[data-h]')].map((b) => b.dataset.h).sort()")
        ok(len(want) >= 3, f"{tag} the whole room's set at the full budget: {want}")
        pg.evaluate("document.querySelector('.svep-result [data-hem-see]').click()"); pg.wait_for_timeout(2600)
        ok(pg.evaluate("RQ.currentRoute()") == "mitt-rum" and sorted(pg.evaluate("RQ.room.scene().map((i) => i.h)")) == want and pg.evaluate("RQ.room.get().map") == "sovrum", f"{tag} Se det i ditt rum: the sample bedroom with exactly the proposal's products")
        r = pg.evaluate(ROOM0)
        ok(r and r["type"] == "sovrum" and sorted(i["h"] for i in r["items"]) == want and pg.evaluate("RQ.hem.activeId()") == r["id"], f"{tag} ...saved automatically as a room in Mitt hem, and active")
        ai_picture(pg)
        ok(pg.evaluate("RQ.aiLib.pics().then((p) => p[0].roomId)") == r["id"], f"{tag} the AI picture is saved in that room")
        pg.evaluate("RQ.openAI()"); pg.wait_for_timeout(2200); pg.evaluate("document.getElementById('aiGo').click()"); pg.wait_for_timeout(3600)
        pg.evaluate("RQ.shop.clearCart()"); pg.evaluate("document.getElementById('aiBuy').click()"); pg.wait_for_timeout(500)
        ok(pg.evaluate(LINES) == ",".join(sorted(h + "::0" for h in want)), f"{tag} Köp allt i bilden adds exactly those products")
        pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
        # Vad tycker du?: a link that opens the same proposal; the answer comes back to the room
        pg.evaluate(CATCH); go(pg, "mitt-hem", 1300); pg.evaluate(CATCH)
        pg.evaluate("RQ.hem.openRoom(RQ.hem.rooms()[0].id)"); pg.wait_for_timeout(800); pg.evaluate("document.getElementById('hemAsk').click()"); pg.wait_for_timeout(400)
        ask = pg.evaluate("window.__sent[0] || ''")
        ok("#delad-f." in ask, f"{tag} 'Vad tycker du?' makes a link: {ask[-60:]}")
        ctx2, p2, e2 = new(b, mob, W, Hh)
        p2.goto(ask, wait_until="load"); p2.wait_for_timeout(1500)
        try:
            p2.wait_for_selector(".hem-ask-list li", timeout=6000)
        except Exception:
            print("   ask page:", ask[-80:], p2.evaluate("RQ.currentRoute()"), p2.evaluate("document.getElementById('view').innerText")[:200])
        p2.evaluate(CATCH)
        ok(p2.evaluate("document.querySelectorAll('.hem-ask-list li').length") == len(want), f"{tag} the partner sees the same proposal, no account needed")
        p2.wait_for_timeout(1200)
        ok(p2.evaluate("(() => { const f = document.getElementById('askPic'); return f.classList.contains('snap') && /^data:image\\/jpeg/.test(f.querySelector('.hem-ask-im > img').src); })()"), f"{tag} the partner sees the room picture: the set drawn in a sample room of the type")
        # the thing to disagree on: one with others of the same sort (R.alternatives is strict since the studio3 review, minor 2/3)
        ai = p2.evaluate("[...document.querySelectorAll('.hem-ask-list li')].findIndex((li, i) => i > 0 && RQ.room.alternatives(li.dataset.h).length)")
        p2.evaluate("(ai) => { document.querySelectorAll('.hem-ask-list li')[0].querySelector('[data-like=\"1\"]').click(); document.querySelectorAll('.hem-ask-list li')[ai].querySelector('[data-like=\"0\"]').click(); }", ai)
        alts = p2.evaluate("(ai) => [...document.querySelectorAll('.hem-ask-list li')[ai].querySelectorAll('.hem-ask-alts:not([hidden]) [data-alt]')].map((b) => b.dataset.alt)", ai)
        h1 = p2.evaluate("(ai) => document.querySelectorAll('.hem-ask-list li')[ai].dataset.h", ai)
        ok(len(alts) >= 1 and h1 not in alts, f"{tag} 'Föreslå något annat' offers things of the same kind: {alts}")
        p2.evaluate("(ai) => document.querySelectorAll('.hem-ask-list li')[ai].querySelector('[data-alt]').click()", ai); p2.wait_for_timeout(1200)
        ok("föreslår" in p2.evaluate("document.getElementById('askCap').innerText"), f"{tag} the picture follows what you suggest")
        p2.fill("#askName", "Sam"); p2.evaluate("document.getElementById('askSend').click()"); p2.wait_for_timeout(400)
        reply = p2.evaluate("window.__sent[0] || ''")
        ok("#delad-s." in reply, f"{tag} the answer goes back as a link")
        p2.evaluate("document.getElementById('askTry').click()"); p2.wait_for_timeout(2600)
        tried = sorted(p2.evaluate("RQ.room.scene().map((i) => i.h)"))
        ok(p2.evaluate("RQ.currentRoute()") == "mitt-rum" and alts[0] in tried and h1 not in tried and len(tried) == len(want), f"{tag} 'Prova själv i Mitt rum' opens the same set (with the suggestion) in a sample room: {tried}")
        shot(p2, f"flow-{W}-ask")
        ok(not e2, f"{tag} no script errors on the partner's page: {e2[:2]}")
        ctx2.close()
        pg.goto(reply, wait_until="load"); pg.wait_for_timeout(1300)
        fb = pg.evaluate(ROOM0)["feedback"]
        ok(len(fb) == 1 and fb[0]["name"] == "Sam" and sorted(fb[0]["answers"].values()) == [0, 1], f"{tag} the answer lands in the room: {fb}")
        pg.evaluate("document.querySelector('[data-hem-open]').click()"); pg.wait_for_timeout(1800)
        ok(pg.evaluate("document.getElementById('hemSheet').classList.contains('open')") and "Sam" in pg.evaluate("document.querySelector('.hem-fb').innerText"), f"{tag} 'Öppna rummet' shows what the partner thinks")
        ok(fb[0].get("alts", {}).get(h1) == alts[0] and pg.evaluate("!!document.querySelector('.hem-fb [data-fb-to]')"), f"{tag} the suggestion comes back, with 'Byt till den' beside it")
        pg.evaluate("document.querySelector('.hem-fb [data-fb-to]').click()"); pg.wait_for_timeout(400)
        hs = [i["h"] for i in pg.evaluate(ROOM0)["items"]]
        ok(alts[0] in hs and h1 not in hs, f"{tag} 'Byt till den' puts the suggestion in the room's list in its place")
        pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
        # the stylist's style answer ends in a proposal too; a look opens in your room
        go(pg, "studio-stylist", 1200)
        pg.locator("#chatIn").fill("Något skandinaviskt till vardagsrummet"); pg.locator("#chatIn").press("Enter"); pg.wait_for_timeout(1400)
        ok(pg.evaluate("!!document.querySelector('#log .msg.ai .hem-prop')"), f"{tag} the stylist's style answer ends in a room proposal")
        go(pg, "look-mjuk-kvall", 1200)
        pg.evaluate("document.querySelector('[data-hem-look]').click()"); pg.wait_for_timeout(2600)
        look = pg.evaluate("RQ.LOOKS.find((l) => l.id === 'mjuk-kvall').items.slice().sort()")
        ok(pg.evaluate("RQ.currentRoute()") == "mitt-rum" and sorted(pg.evaluate("RQ.room.scene().map((i) => i.h)")) == look, f"{tag} a look opens in Se det i ditt rum")
        go(pg, "", 1200)
        ok(pg.evaluate("(document.querySelector('.rh-promise') || {}).innerText") == "Se ditt hem innan du köper.", f"{tag} the promise on the home page's Studio section")
        ok(not errs, f"{tag} no script errors: {errs[:3]}")
        ctx.close()

    # ------------------------------------------------ 3. the moodboard
    for W, Hh, mob in ((390, 844, True), (1440, 900, False)):
        tag = f"[board {W}]"
        ctx, pg, errs = new(b, mob, W, Hh)
        go(pg, "mitt-hem", 1300); pg.evaluate(CATCH)
        pg.evaluate("document.querySelector('[data-board-new]').click()"); pg.wait_for_timeout(900)
        ok(pg.evaluate("document.getElementById('mbSheet').classList.contains('open') && !!document.querySelector('.mb-add')"), f"{tag} a new moodboard opens with the product picker")
        pg.evaluate("document.querySelector('[data-mb-tab=all]').click()"); pg.wait_for_timeout(200)
        pg.fill("#mbQ", "lampa"); pg.wait_for_timeout(300)
        found = pg.evaluate("[...document.querySelectorAll('.mb-add-it span')].map((s) => s.innerText)")
        ok(2 <= len(found) < pg.evaluate("RQ.PRODUCTS.length") and sum("lamp" in x.lower() for x in found) >= 2, f"{tag} search in the range: {found}")
        pg.fill("#mbQ", ""); pg.wait_for_timeout(200)
        for i in range(3):
            pg.evaluate("(i) => document.querySelectorAll('.mb-add-it')[i].click()", i); pg.wait_for_timeout(200)
        pg.evaluate("document.querySelector('[data-mb-do=add]').click()"); pg.wait_for_timeout(200)
        pos = pg.evaluate("[...document.querySelectorAll('.mb-it')].map((e) => [e.style.left, e.style.top])")
        ok(len(pos) == 3 and len(set(map(tuple, pos))) == 3, f"{tag} three things, laid out neatly: {pos}")
        ok(pg.evaluate("document.querySelectorAll('.mb-tones i').length") >= 2, f"{tag} the products' colours show as swatches")
        # drag the first one
        bx = pg.evaluate("(() => { const r = document.querySelector('.mb-it').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()")
        x0 = pg.evaluate("document.querySelector('.mb-it').style.left")
        pg.mouse.move(bx[0], bx[1]); pg.mouse.down(); pg.mouse.move(bx[0] + 40, bx[1] + 20, steps=6); pg.mouse.up(); pg.wait_for_timeout(300)
        ok(pg.evaluate("RQ.shop.store.get('rumiq-boards', [])[0].items[0].x") != float(x0.rstrip('%')), f"{tag} a thing can be dragged")
        ok(pg.evaluate("!!document.querySelector('.mb-it.on')"), f"{tag} the dragged thing is the chosen one")
        pg.evaluate("document.querySelector('.mb-it.on') || document.querySelector('.mb-it').click()"); pg.wait_for_timeout(200)
        w0 = pg.evaluate("RQ.shop.store.get('rumiq-boards', [])[0].items[0].w")
        pg.evaluate("document.querySelector('[data-mb-do=bigger]').click()"); pg.wait_for_timeout(200)
        pg.evaluate("document.querySelector('[data-mb-do=front]').click()"); pg.wait_for_timeout(200)
        bd = pg.evaluate("RQ.shop.store.get('rumiq-boards', [])[0]")
        ok(bd["items"][0]["w"] > w0 and bd["items"][0]["z"] == max(i["z"] for i in bd["items"]), f"{tag} resize and layer")
        pg.evaluate("document.querySelector('.mb-it.on').focus()"); pg.keyboard.press("ArrowRight"); pg.wait_for_timeout(200)
        ok(pg.evaluate("RQ.shop.store.get('rumiq-boards', [])[0].items[0].x") > bd["items"][0]["x"], f"{tag} the arrow keys move the chosen thing")
        pg.evaluate("document.querySelector('[data-mb-do=deselect]').click()"); pg.wait_for_timeout(200)
        pg.fill("#mbNote", "Ljust och mjukt"); pg.evaluate("document.getElementById('mbNote').dispatchEvent(new Event('change'))"); pg.wait_for_timeout(300)
        pg.fill("#mbName", "Kvällsljus"); pg.wait_for_timeout(200)
        shot(pg, f"board-{W}")
        pg.evaluate("document.querySelector('[data-mb-do=save]').click()"); pg.wait_for_timeout(300)
        ok(pg.evaluate("RQ.shop.looks()[0].name") == "Kvällsljus" and len(pg.evaluate("RQ.shop.looks()[0].handles")) == 3, f"{tag} saved as a look in Sparat")
        with pg.expect_download() as d:
            pg.evaluate("document.querySelector('[data-mb-do=share]').click()")
        pg.wait_for_timeout(400)
        ok(d.value.suggested_filename == "rumiq-moodboard.jpg" and "#delad-" in pg.evaluate("window.__sent[0] || ''"), f"{tag} share: one picture and a link to the same things")
        hs = sorted(i["h"] for i in bd["items"])
        pg.evaluate("document.querySelector('[data-mb-do=try]').click()"); pg.wait_for_timeout(400)
        ask = pg.evaluate("(() => { const t = document.querySelector('.mb-try'); return t && [t.querySelectorAll('[data-mb-room]').length, [...t.querySelectorAll('[data-mb-sample]')].map((b) => b.dataset.mbSample), (t.querySelector('.chip.fit') || {}).dataset]; })()")
        ok(ask and ask[0] == min(8, pg.evaluate("RQ.hem.rooms().length")) and len(ask[1]) == 6 and pg.evaluate("RQ.currentRoute()") == "mitt-hem", f"{tag} Prova i ett rum asks which room first: your rooms, or a sample room of a kind (the best fit marked): {ask}")
        pg.evaluate("document.querySelector('.mb-try .chip.fit').click()"); pg.wait_for_timeout(2600)
        # the editor's surface rules hold (studio2 review M8): a thing with no free surface is left out and named in the editor, never put on the floor
        inroom = pg.evaluate("RQ.room.scene().map((i) => i.h)"); note = pg.evaluate("(document.getElementById('rmSugg') || {}).innerText || ''")
        out = [h for h in hs if h not in inroom]
        ok(pg.evaluate("RQ.currentRoute()") == "mitt-rum" and pg.evaluate("RQ.room.get().sample") and set(inroom) <= set(hs) and len(inroom) >= 2 and all(pg.evaluate("(h) => RQ.byHandle(h).name", h) in note for h in out), f"{tag} Prova i ett rum: the board's products placed by the editor in the sample room you chose, what does not fit named: {inroom} {out}")
        tab = pg.evaluate("(() => { const a = RQ.hem.room(RQ.hem.activeId()); return [a && a.label, (document.querySelector('[data-proj][aria-pressed=true]') || {}).innerText || '', document.getElementById('toast').innerText] })()")
        ok(tab[0] and tab[0] in tab[1], f"{tag} a sample room from the board becomes a named room of yours, its tab chosen: {tab}")
        go(pg, "mitt-hem", 1300)
        ok(pg.evaluate("document.querySelectorAll('.hem-board').length") == 1, f"{tag} the moodboard is in Sparat")
        ok(not errs, f"{tag} no script errors: {errs[:3]}")
        ctx.close()

    # ------------------------------------------------ review fixes: own photo keeps the room type, the AI sheet's words, focus
    import io
    from PIL import Image as PImage
    buf = io.BytesIO(); PImage.new("RGB", (1200, 900), (214, 206, 194)).save(buf, "JPEG"); JPG = buf.getvalue()
    for W, Hh, mob in ((390, 844, True), (1440, 900, False)):
        tag = f"[fix {W}]"
        ctx, pg, errs = new(b, mob, W, Hh)
        # the one promise before sign-in: Mitt rum's card and the sign-in sheet say the same as Skapa ditt första rum
        go(pg, "mitt-rum", 900); pg.evaluate("document.querySelector('.sheet.open [data-room-sample]') && document.querySelector('.sheet.open [data-room-sample]').click()"); pg.wait_for_timeout(1500)
        if pg.evaluate("RQ.room.has()") is False:
            pg.evaluate("RQ.room.openWith({ room: 'vardagsrum', items: [{ h: 'glob-bordslampa-opalglas', v: 0 }] })"); pg.wait_for_timeout(2000)
        prom = pg.evaluate("RQ.ai.promise()")
        pg.wait_for_timeout(500)
        ok(prom.startswith("5 AI-bilder gratis i månaden med konto") and pg.evaluate("[...document.querySelectorAll('[data-ai-balance]')].every((c) => c.textContent === RQ.ai.promise())"), f"{tag} Mitt rum's AI card says the one promise: {prom}")
        pg.evaluate("RQ.openAI()"); pg.wait_for_timeout(900)
        gtxt = pg.evaluate("(document.querySelector('.ai-sheet.open') || {}).innerText || ''")
        ok("Förhandsvisning utan konto" in gtxt and "kräver ett gratis konto" in gtxt and pg.evaluate("!!document.getElementById('aiGo') && !document.getElementById('aiOk')"), f"{tag} a guest sees the preview demo, honestly labelled, no consent needed (nothing is sent): {gtxt[:120]}")
        pg.evaluate("document.getElementById('aiGo').click()"); pg.wait_for_timeout(3000)
        ok(pg.evaluate("!!document.querySelector('.ai-result')"), f"{tag} the guest's demo result shows")
        pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
        # the consent for a sample room speaks of the sample room, not of "your room"
        pg.evaluate("RQ.shop.signIn('test@example.com', 'Test', 'email'); localStorage.removeItem('rumiq-ai-consent')"); pg.wait_for_timeout(300)
        pg.evaluate("RQ.openAI()"); pg.wait_for_timeout(900)
        cons = pg.evaluate("(document.querySelector('.ai-sheet.open .ai-list') || {}).innerText || ''")
        ok("exempelrummets foto" in cons and "fotot av ditt rum" not in cons, f"{tag} the consent on a sample room says what is really sent: {cons[:120]}")
        # the demo result offers Byt produkt / Prova en annan färg too (they only open the editor)
        pg.evaluate("localStorage.setItem('rumiq-ai-consent', JSON.stringify('x'))"); pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
        pg.evaluate("RQ.openAI()"); pg.wait_for_timeout(1500); pg.evaluate("document.getElementById('aiGo') && document.getElementById('aiGo').click()"); pg.wait_for_timeout(3600)
        sw = pg.evaluate("[...document.querySelectorAll('.ai-result [data-ai-swap]')].map((b) => b.textContent)")
        ok("Byt produkt" in sw, f"{tag} the demo result shows Byt produkt: {sw}")
        pg.evaluate("document.querySelector('.ai-result [data-ai-swap]').click()"); pg.wait_for_timeout(1200)
        ok(pg.evaluate("RQ.currentRoute()") == "mitt-rum" and not pg.evaluate("document.querySelector('.ai-sheet.open')"), f"{tag} Byt produkt opens the editor at that thing")
        # your own photo from Skapa ditt första rum: the room type and style go with it, the editor never asks again
        go(pg, "mitt-hem", 1200)
        pg.fill("#hemFirstF [name=label]", "Hallen"); pg.select_option("#hemFirstF select[name=type]", "hall")
        pg.evaluate("document.querySelector('#hemFirstF [data-first-style=minimalistisk]').click()")
        pg.evaluate("document.querySelector('#hemFirstF button[value=own]').click()"); pg.wait_for_timeout(900)
        pg.set_input_files(".sheet [data-room-file]:not([capture])", {"name": "hall.jpg", "mimeType": "image/jpeg", "buffer": JPG}); pg.wait_for_timeout(3000)
        if pg.evaluate("!!document.querySelector('.sheet.open [data-check-use]')"):
            pg.evaluate("document.querySelector('.sheet.open [data-check-use]').click()"); pg.wait_for_timeout(2500)
        pg.evaluate("(document.getElementById('rmSuggest') || document.getElementById('rmSuggest0')).click()"); pg.wait_for_timeout(1500)
        g = pg.evaluate("[RQ.currentRoute(), RQ.room.get().sample || false, RQ.room.get().type, !!document.getElementById('rmAsk'), (document.querySelector('.rm-sugg-sty [aria-pressed=true]') || { dataset: {} }).dataset.sty]")
        ok(g[0] == "mitt-rum" and not g[1] and g[2] == "hall" and not g[3] and g[4] == "minimalistisk", f"{tag} own photo: the room type and style chosen in Sparat go with it, no 'Vilket rum är det?': {g}")
        ok(not errs, f"{tag} no script errors: {errs[:3]}")
        ctx.close()
        # after the cookie choice on Svep the focus is on the page, so the arrows work at once
        ctx, pg, errs = new(b, mob, W, Hh)
        pg.goto(BASE + "svep/", wait_until="load"); pg.wait_for_timeout(1200)
        pg.focus("#ckNeed"); pg.keyboard.press("Enter"); pg.wait_for_timeout(300)
        ok(pg.evaluate("document.activeElement && document.activeElement.id") == "view", f"{tag} after the cookie choice the focus moves to the page: {pg.evaluate('document.activeElement && document.activeElement.outerHTML.slice(0, 60)')}")
        ctx.close()

    # ------------------------------------------------ English
    ctx, pg, errs = new(b, True, 390, 844, en=True)
    first_room(pg); go(pg, "mitt-hem", 1500)
    txt = pg.evaluate("document.querySelector('.mh').innerText")
    ok("Continue where you left off" in txt and "Fortsätt" not in txt and "Välj" not in txt, f"[en] Mitt hem in English: {txt[:200]}")
    pg.evaluate("RQ.hem.openRoom(RQ.hem.rooms()[0].id)"); pg.wait_for_timeout(900)
    st = pg.evaluate("document.querySelector('#hemSheet .hem-room').innerText")
    ok("Shopping list" in st and "Inköpslista" not in st and "Köpt" not in st, f"[en] the room sheet in English: {st[:200]}")
    ok(not errs, f"[en] no script errors: {errs[:3]}")
    ctx.close()

    # ------------------------------------------------ screenshots at the other sizes, day and evening
    for W, Hh, mob in ((360, 740, True), (1280, 720, False), (390, 844, True), (1440, 900, False)):
        for eve in (False, True):
            if W in (390, 1440) and not eve:
                continue
            ctx, pg, errs = new(b, mob, W, Hh, evening=eve)
            nm = f"{W}{'-kvall' if eve else ''}"
            go(pg, "mitt-hem", 1300); shot(pg, f"empty-{nm}")
            first_room(pg); go(pg, "mitt-hem", 1500); shot(pg, f"cards-{nm}")
            over = pg.evaluate("[...document.querySelectorAll('.mh *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.right > innerWidth + 1; }).map((e) => e.className).slice(0, 3)")
            ok(not over, f"[{nm}] nothing in Sparat runs off the screen: {over}")
            pg.evaluate("RQ.hem.openRoom(RQ.hem.rooms()[0].id)"); pg.wait_for_timeout(900); shot(pg, f"sheet-{nm}")
            pg.keyboard.press("Escape"); pg.wait_for_timeout(500)
            pg.evaluate("RQ.hem.openBoard(null, { items: ['lysa-keramiklampa', 'plad-ullblandning-havre', 'sand-keramikvas', 'lin-kuddfodral'], name: 'Mjukt' })"); pg.wait_for_timeout(1200); shot(pg, f"board-{nm}")
            ok(not errs, f"[{nm}] no script errors: {errs[:3]}")
            ctx.close()

    # ------------------------------------------------ axe
    if AXE.exists():
        src = AXE.read_text()
        RUN = """async (sel) => { const r = await axe.run(sel ? document.querySelector(sel) : document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] }, resultTypes: ['violations'] });
          return r.violations.map((v) => v.id + ': ' + v.nodes.slice(0, 2).map((x) => x.target.join(' ')).join(' | ')); }"""
        for W, Hh, mob in ((390, 844, True), (1440, 900, False)):
            for eve in (False, True):
                ctx, pg, errs = new(b, mob, W, Hh, evening=eve)
                tag = f"[axe {W}{' evening' if eve else ''}]"
                go(pg, "mitt-hem", 1300); pg.add_script_tag(content=src)
                ok(not pg.evaluate(RUN, "#view"), f"{tag} empty Sparat: {pg.evaluate(RUN, '#view')[:3]}")
                first_room(pg); go(pg, "mitt-hem", 1500); pg.add_script_tag(content=src)
                ok(not pg.evaluate(RUN, "#view"), f"{tag} Sparat with a room: {pg.evaluate(RUN, '#view')[:3]}")
                pg.evaluate("RQ.hem.openRoom(RQ.hem.rooms()[0].id)"); pg.wait_for_timeout(900)
                ok(not pg.evaluate(RUN, "#hemSheet"), f"{tag} the room sheet: {pg.evaluate(RUN, '#hemSheet')[:3]}")
                pg.keyboard.press("Escape"); pg.wait_for_timeout(500)
                pg.evaluate("RQ.hem.openBoard(null, { items: ['lysa-keramiklampa', 'sand-keramikvas'] })"); pg.wait_for_timeout(1200)
                ok(not pg.evaluate(RUN, "#mbSheet"), f"{tag} the moodboard: {pg.evaluate(RUN, '#mbSheet')[:3]}")
                ctx.close()
    else:
        print(f"  (axe-core not found at {AXE}; set AXE=/path/to/axe.min.js to include the axe pass)")
    b.close()

print(f"{n - len(fails)} of {n} checks passed")
sys.exit(1 if fails else 0)
