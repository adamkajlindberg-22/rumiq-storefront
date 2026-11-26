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
        ok("Förhandsvisning: 5 AI-bilder" in pg.evaluate("document.getElementById('hemFirst').innerText"), f"{tag} the free AI pictures are said, honestly as a preview, from config")
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
        pg.keyboard.press("Escape"); pg.wait_for_timeout(600)
        # a second room; the picture moves to it from Alla bilder
        pg.evaluate("RQ.hem.create({ label: 'Sovrummet', type: 'sovrum' })"); go(pg, "mitt-hem", 1600)
        ok(pg.evaluate("!!document.querySelector('#mh-bilder [data-lib-move]')") and pg.evaluate("!!document.querySelector('#mh-bilder [data-lib-cont]')") and pg.evaluate("document.querySelector('#mh-bilder [data-lib-cont]').innerText") == "Prova igen i Studio", f"{tag} Alla bilder: Flytta till rum and Prova igen i Studio")
        pg.evaluate("(() => { const s = document.querySelector('#mh-bilder [data-lib-move]'); s.value = RQ.hem.rooms().find((r) => r.label === 'Sovrummet').id; s.dispatchEvent(new Event('change')); })()"); pg.wait_for_timeout(700)
        ok(pg.evaluate("RQ.aiLib.pics().then((p) => p[0].roomId)") == pg.evaluate("RQ.hem.rooms().find((r) => r.label === 'Sovrummet').id") and "Sovrummet" in pg.evaluate(TOAST), f"{tag} 'Flytta till rum' moves the picture to another room")
        # Prova igen i Studio: the editor with the same room and products, the room active again
        pg.evaluate("document.querySelector('#mh-bilder [data-lib-cont]').click()"); pg.wait_for_timeout(1800)
        ok(pg.evaluate("RQ.currentRoute()") == "mitt-rum" and pg.evaluate("RQ.room.scene().length") >= 3, f"{tag} 'Prova igen i Studio' opens the editor with the picture's room and products")
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
        ok(main == ["Se det i ditt rum"], f"{tag} the card in Svep is one clear card with one main button, the rest behind 'Ändra rum och budget': {vis}")
        if mob:  # the phone: three small pictures in a row with the total, "Visa alla N" opens the list
            row = pg.evaluate("(() => { const c = document.querySelector('.svep-result .hem-prop'); return [c.querySelectorAll('.hem-prop-thumbs img').length, getComputedStyle(c.querySelector('.hem-prop-items')).display, (c.querySelector('[data-hem-all]') || {}).textContent || '', Math.round(c.getBoundingClientRect().height)]; })()")
            ok(row[0] == 3 and row[1] == "none" and row[2].startswith("Visa alla") and row[3] < 640, f"{tag} the phone card is short: three pictures and the total, the list behind Visa alla: {row}")
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
        p2.evaluate("document.querySelectorAll('.hem-ask-list li')[0].querySelector('[data-like=\"1\"]').click(); document.querySelectorAll('.hem-ask-list li')[1].querySelector('[data-like=\"0\"]').click()")
        p2.fill("#askName", "Sam"); p2.evaluate("document.getElementById('askSend').click()"); p2.wait_for_timeout(400)
        reply = p2.evaluate("window.__sent[0] || ''")
        ok("#delad-s." in reply, f"{tag} the answer goes back as a link")
        shot(p2, f"flow-{W}-ask")
        ok(not e2, f"{tag} no script errors on the partner's page: {e2[:2]}")
        ctx2.close()
        pg.goto(reply, wait_until="load"); pg.wait_for_timeout(1300)
        fb = pg.evaluate(ROOM0)["feedback"]
        ok(len(fb) == 1 and fb[0]["name"] == "Sam" and sorted(fb[0]["answers"].values()) == [0, 1], f"{tag} the answer lands in the room: {fb}")
        pg.evaluate("document.querySelector('[data-hem-open]').click()"); pg.wait_for_timeout(1800)
        ok(pg.evaluate("document.getElementById('hemSheet').classList.contains('open')") and "Sam" in pg.evaluate("document.querySelector('.hem-fb').innerText"), f"{tag} 'Öppna rummet' shows what the partner thinks")
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
        pg.evaluate("document.querySelector('[data-mb-do=try]').click()"); pg.wait_for_timeout(2600)
        # the editor's surface rules hold (studio2 review M8): a table thing with no free table is left out and named in the editor, never put on the floor
        inroom = pg.evaluate("RQ.room.scene().map((i) => i.h)"); note = pg.evaluate("(document.getElementById('rmSugg') || {}).innerText || ''")
        out = [h for h in hs if h not in inroom]
        ok(pg.evaluate("RQ.currentRoute()") == "mitt-rum" and set(inroom) <= set(hs) and len(inroom) >= 2 and all(pg.evaluate("(h) => RQ.byHandle(h).name", h) in note for h in out), f"{tag} Prova i ett rum: the board's products placed by the editor, what does not fit named: {inroom} {out}")
        go(pg, "mitt-hem", 1300)
        ok(pg.evaluate("document.querySelectorAll('.hem-board').length") == 1, f"{tag} the moodboard is in Sparat")
        ok(not errs, f"{tag} no script errors: {errs[:3]}")
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
