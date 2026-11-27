#!/usr/bin/env python3
"""Svep 2 (SVEP2-BRIEF): Svep tillsammans for 2 to 6 people through links, older two-person links, the group result
kept as a room in Sparat, taste and Svep history synced with the account, true reasons where the site recommends,
"Mer som det här", sharing with a fallback, the counts and the share picture. Run after `python3 tools/build.py`:
   python3 test/svep2.py
Phone (390 and 360, touch) and desktop (1440 and 1280), day and evening."""
import http.server, json, os, re, socketserver, sys, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
AXE = Path(os.environ.get("AXE", "/home/claude/axe/node_modules/axe-core/axe.min.js"))
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
SIZES = {"390": (390, 844, True), "360": (360, 740, True), "375s": (375, 548, True), "1440": (1440, 900, False), "1280": (1280, 720, False)}
DOCK = "(() => { const c = document.querySelector('.sv-ctrl'), d = document.querySelector('.dock'); if (!c || !d || getComputedStyle(d).display === 'none') return [0, 1]; return [Math.round(c.getBoundingClientRect().bottom), Math.round(d.getBoundingClientRect().top)]; })()"


def new(b, size="390", night=False, share=None, clip=True):
    w, h, mobile = SIZES[size]
    kw = dict(viewport={"width": w, "height": h})
    if mobile:
        kw.update(device_scale_factor=2, is_mobile=True, has_touch=True, user_agent=UA)
    ctx = b.new_context(**kw)
    ctx.route(re.compile(r"^https?://(?!127\.0\.0\.1)"), lambda r: r.abort())
    init = "localStorage.setItem('rumiq-consent', JSON.stringify({ stats: true, at: '2026-11-26' }));"
    if night:
        init += "localStorage.setItem('rumiq-ljus', 'kvall');"
    # the share sheet and the clipboard, as the test needs them: 'none' = no share sheet; clip False = no clipboard either
    if share == "none":
        init += "Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });"
    elif share == "ok":
        init += "window.__shared = []; Object.defineProperty(navigator, 'share', { value: (d) => { window.__shared.push(d); return Promise.resolve(); }, configurable: true });"
    if not clip:
        init += "Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('no')) }, configurable: true }); document.execCommand = () => false;"
    else:
        init += "window.__clip = []; Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t) => { window.__clip.push(t); return Promise.resolve(); } }, configurable: true });"
    ctx.add_init_script(init)
    pg = ctx.new_page(); pg.set_default_timeout(9000); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    return ctx, pg, errs


def go(pg, route, wait=900):
    pg.goto(BASE + (route + "/" if route and "#" not in route else route)); pg.wait_for_timeout(wait)


def swipe(pg, pattern):
    for ch in pattern:
        duel = pg.evaluate("!!document.querySelector('#svDeck .sv-card.duel[aria-hidden=\"false\"]')")  # v15.9: card eight can be a duel, Y picks the first
        pg.click("#svDeck .sv-card.duel[aria-hidden='false'] [data-duel-pick]" if duel and ch == "Y" else "#svYes" if ch == "Y" else "#svNo"); pg.wait_for_timeout(330)
    pg.wait_for_timeout(700)


def send(pg, name):
    pg.fill("#grSendN", name); pg.click("#grSend button[type=submit]"); pg.wait_for_timeout(500)
    return pg.evaluate("document.querySelector('#grSend .sv-linkout').value")


EV = "(window.dataLayer || []).map((e) => e.event)"
DATA = None

with sync_playwright() as p:
    b = p.chromium.launch()

    # ------------------------------------------------------------ a group of three through links
    A, B, C = "YYNYNYYNNY", "YNNYYYNNYY", "YYYNNYNNYY"
    ctxA, pa, ea = new(b, "390", share="none")
    go(pa, "svep-ihop")
    st0 = pa.evaluate("(() => { const b = document.getElementById('grStart').getBoundingClientRect(), d = document.querySelector('.dock').getBoundingClientRect(); return [Math.round(b.bottom), Math.round(d.top)]; })()")
    ok(st0[0] <= st0[1], f"390: 'Starta en grupp' is above the dock on the first screen: {st0}")
    ok("Din grupp sparas bara i den här webbläsaren." in pa.evaluate("document.querySelector('.two-intro').innerText"), "the privacy line says what is true with the account not live")
    DATA = pa.evaluate("Object.fromEntries(RQ.PRODUCTS.map((p) => [p.handle, { cat: p.cat, styles: p.styles, rooms: p.rooms, tone: p.tone, name: p.name, price: p.price }]))")
    ok(pa.evaluate("!!document.getElementById('grStart')") and "två till sex" in pa.evaluate("document.querySelector('.sv-head .lead').innerText"), "intro: 'Starta en grupp', for two to six people")
    pa.click("[data-gr-scope=vardagsrum]"); pa.click("#grStart"); pa.wait_for_timeout(900)
    hs = pa.evaluate("RQ.svepGroup.parse(decodeURIComponent(location.hash.slice(11))).hs")
    ok(len(hs) == 10 and len(set(hs)) == 10 and all("vardagsrum" in DATA[h]["rooms"] for h in hs), f"a new group for the living room: ten different living-room cards: {len(hs)}")
    ok(pa.evaluate("document.getElementById('svCount').textContent") == "1 av 10", "the deck starts at once")
    swipe(pa, A)
    ok(pa.evaluate("document.querySelector('.svep-result h2').innerText").startswith("Dina svar är klara"), "alone in the group: 'Dina svar är klara', the send form first")
    urlA = send(pa, "Anna")
    ok(re.fullmatch(r"http://127\.0\.0\.1:\d+/svep-ihop/#svep-ihop-g[0-9a-z]{4}\.[0-9a-z]{40}\.[0-9a-f]{3}[0-9a-z]{2}Anna", urlA or "") is not None, f"A's link: group, ten 4-character cards, A's answers in hex, id and name: {urlA}")
    ok(pa.evaluate("document.querySelector('#grSend .sv-linkmsg').textContent").startswith("Länken är kopierad") and pa.evaluate("window.__clip.length") == 1, "no share sheet: the link is copied and stays in view")
    ok(pa.evaluate("RQ.svepGroup.all().length") == 1 and pa.evaluate("RQ.svepGroup.all()[0].ppl[0].n") == "Anna", "A's browser keeps the group with A's name")

    ctxB, pb, eb = new(b, "1440", night=True, share="ok")
    pb.goto(urlA); pb.wait_for_timeout(1000)
    wa = pb.evaluate("(() => { const w = document.querySelector('.gr-invite'); return w && [document.querySelector('.sv-head h1').innerText, w.querySelectorAll('.gr-invite-cards img').length, w.querySelector('[data-gr-new]').innerText.trim(), w.querySelector('[data-gr-known]').innerText.replace(/\\s+/g, ' ').trim(), !document.getElementById('svDeck'), w.innerText.includes('Se ditt hem innan du köper.'), w.querySelector('.gr-invite-t').innerText]; })()")
    ok(wa and wa[0] == "Anna vill veta vad du tycker." and wa[1] == 3 and wa[2] == "Svep korten" and wa[3] == "Är du Anna? Visa resultatet" and wa[4] and wa[5] and wa[6] == "Svep 10 kort, så ser ni vad ni båda gillar.", f"a friend's first screen is an invitation: who asks, three cards, Svep korten, the promise; 'Är du Anna?' small: {wa}")
    pb.click("[data-gr-new]"); pb.wait_for_timeout(600)
    ok(pb.evaluate("!!document.getElementById('svDeck') && document.querySelector('.sv-head h1').innerText") == "Din tur att svepa.", "'Jag är ny, svep korten' brings the deck")
    who = pb.evaluate("[...document.querySelectorAll('.gr-who .gr-ppl li')].map((l) => l.innerText.replace(/\\s+/g, ' ').trim())")
    ok(who == ["A Anna", "+ Du"], f"B opens A's link: who has answered, and an open place for B: {who}")
    ok(pb.evaluate("document.querySelector('.sv-head .lead').innerText") == "Svep 10 kort, så ser ni vad ni båda gillar.", "B's one line says what to do")
    ok("Se ditt hem innan du köper." in pb.evaluate("document.querySelector('.sv-head').innerText"), "the promise is on the shared page")
    ok("svep_group_opened" in pb.evaluate(EV), "counted: group link opened")
    for ch in B:
        pb.keyboard.press("ArrowRight" if ch == "Y" else "ArrowLeft"); pb.wait_for_timeout(330)
    pb.wait_for_timeout(800)
    both = [h for i, h in enumerate(hs) if A[i] == "Y" and B[i] == "Y"]
    t2 = pb.evaluate("document.querySelector('.svep-result h2').innerText")
    ok(t2 == f"Ni gillar båda {len(both)} saker", f"two people: 'Ni gillar båda': {t2}")
    ua, ub = {h for i, h in enumerate(hs) if A[i] == "Y"}, {h for i, h in enumerate(hs) if B[i] == "Y"}
    ok(pb.evaluate("document.querySelector('.two-pct').innerText") == f"Ni tycker {round(len(ua & ub) / len(ua | ub) * 100)} % lika", "two people: the meter is shared out of liked by either")
    ok(pb.evaluate("document.querySelector('.sv-head h1').innerText") == "Så här svarade ni.", "after the deck the page head says what it shows")
    ok("svep_group_completed" in pb.evaluate(EV), "counted: group completed")
    sb = pb.evaluate("(() => { const s = document.querySelector('.gr-send'), m = document.querySelector('.two-meter'), a = document.querySelector('.gr-acts'); scrollTo(0, 0); return [s.querySelector('b').innerText, s.getBoundingClientRect().top > m.getBoundingClientRect().bottom, s.getBoundingClientRect().bottom < a.getBoundingClientRect().top, Math.round(s.querySelector('button[type=submit]').getBoundingClientRect().bottom), document.querySelector('#grSend label').innerText]; })()")
    ok(sb[0] == "Skicka tillbaka till Anna" and sb[1] and sb[2] and sb[3] <= 900 and sb[4].startswith("Ditt namn"), f"'Skicka tillbaka till Anna' right under the meter, above Gör ett rum, in view at 1440 × 900: {sb}")
    cols = pb.evaluate("getComputedStyle(document.querySelector('.svep-result.group')).gridTemplateColumns.split(' ').length")
    ok(cols == 2, f"on a computer the result has two columns: {cols}")
    urlB = send(pb, "Erik")
    ok(pb.evaluate("window.__shared.length") == 1 and pb.evaluate("window.__shared[0].url") == urlB and pb.evaluate("document.querySelector('#grSend .sv-linkmsg').textContent").startswith("Skickat"), "with a share sheet: Web Share gets the link, and the page says it was sent")
    ok(urlB.startswith(urlA + "_") and urlB.endswith("Erik"), f"B's link carries A and then B: {urlB[-30:]}")

    ctxC, pc, ec = new(b, "360")
    pc.goto(urlB); pc.wait_for_timeout(1000); pc.click("[data-gr-new]"); pc.wait_for_timeout(600)
    ok(pc.evaluate("document.querySelector('.sv-head .lead').innerText") == "Svep 10 kort, så ser ni vad ni alla gillar.", "C: 'vad ni alla gillar'")
    swipe(pc, C)
    allL = [h for i, h in enumerate(hs) if A[i] == B[i] == C[i] == "Y"]
    most = [h for i, h in enumerate(hs) if [A[i], B[i], C[i]].count("Y") == 2]
    t3 = pc.evaluate("document.querySelector('.svep-result h2').innerText")
    ok(t3 == f"Ni gillar alla {len(allL)} saker", f"three people: 'Ni gillar alla': {t3}")
    eyebrows = pc.evaluate("[...document.querySelectorAll('.svep-result .gr-main .sp-saved > .eyebrow, .svep-result .gr-most summary')].map((e) => e.textContent.trim())")
    ok(f"Det ni alla gillar · {len(allL)}" in eyebrows and f"Det de flesta gillar · {len(most)}" in eyebrows, f"three people: all and most (at least half): {eyebrows}")
    ok(pc.evaluate("document.querySelectorAll('.gr-each .sp-saved').length") == 3, "three people: each one's picks")
    ok(pc.evaluate("[...document.querySelectorAll('.svep-result details.gr-most, .svep-result details.gr-each')].map((d) => d.open)") == [False, False], "on a phone the result is short: 'de flesta' and each one's picks are folded")
    ok(pc.evaluate("document.querySelectorAll('.svep-result [data-more]').length") == 1, "one way in to 'Mer som det här', not one per thing")
    st = pc.evaluate("document.querySelector('.gr-style .gr-style-t') && document.querySelector('.gr-style .gr-style-t').innerText")
    ok(bool(st) and pc.evaluate("document.querySelectorAll('.gr-style .sp-row').length") == 4, f"the group style: a mix of styles: {st}")
    ok(pc.evaluate("[...document.querySelectorAll('.svep-result .gr-ppl li b')].map((x) => x.innerText)") == ["Anna", "Erik", "Du"], "three people: names in the order they answered")
    urlC = send(pc, "Sara")

    # A opens C's link: the group in A's browser joins the link, no deck again
    pa.goto(urlC); pa.wait_for_timeout(1000)
    ok(pa.evaluate("!!document.querySelector('.svep-result.group') && !document.getElementById('svDeck')"), "A opens the newest link: straight to the result, no deck again")
    ok(pa.evaluate("[...document.querySelectorAll('.svep-result .gr-ppl li b')].map((x) => x.innerText)") == ["Du", "Erik", "Sara"], "A's browser knows which one is A")
    ok(pa.evaluate("RQ.svepGroup.all()[0].ppl.length") == 3, "A's browser keeps all three")
    # A opens the same link inside a messaging app (a browser that has never seen the group): one tap on 'Anna'
    ctxW, pw_, ew = new(b, "375s")
    pw_.goto(urlC); pw_.wait_for_timeout(1000)
    pw_.click("[data-gr-known]"); pw_.wait_for_timeout(300)
    ok(pw_.evaluate("[...document.querySelectorAll('[data-gr-me]')].map((b) => b.innerText.replace(/\\s+/g, ' ').trim())") == ["A Anna", "E Erik", "S Sara"], "Vem är du?: everyone in the group as a button")
    nb = pw_.evaluate("(() => { const b = document.querySelector('[data-gr-new]'), d = document.querySelector('.dock'); return [Math.round(b.getBoundingClientRect().bottom), Math.round(d.getBoundingClientRect().top)]; })()")
    ok(nb[0] <= nb[1], f"375 × 548: 'Vem är du?' and its buttons are above the dock: {nb}")
    pw_.click("[data-gr-me]"); pw_.wait_for_timeout(900)
    ok(pw_.evaluate("[...document.querySelectorAll('.svep-result .gr-ppl li b')].map((x) => x.innerText)") == ["Du", "Erik", "Sara"] and "svep_group_whoami" in pw_.evaluate(EV), "tapping 'Anna' shows the result as Anna, no deck")
    ok(pw_.evaluate("document.querySelector('[data-gr-notme]').innerText.replace(/\\s+/g, ' ').trim()") == "Inte Anna? Svep själv", "the result says 'Inte Anna? Svep själv'")
    pw_.click("[data-gr-notme]"); pw_.wait_for_timeout(900)
    ok(pw_.evaluate("!!document.getElementById('svDeck') && RQ.svepGroup.all()[0].me === null && RQ.svepGroup.all()[0].ppl.length === 3"), "'Inte Anna?' undoes it: the deck, nobody in the group is this browser, the three answers stay")
    ctxW.close()
    # a full group of six can send the result on (an outsider sees the result, with a link to send, no name field)
    six = pa.evaluate("(() => { const g = RQ.svepGroup.all()[0]; return RQ.svepGroup.url({ id: 'zz66', hs: g.hs, ppl: ['Anna', 'Erik', 'Sara', 'Lo', 'Mio', 'Ida'].map((n, i) => ({ id: 'p' + i, n, b: g.ppl[0].b })) }); })()")
    ctx6, p6, e6 = new(b, "390", share="none")
    p6.goto(six); p6.wait_for_timeout(1000)
    f6 = p6.evaluate("(() => { const s = document.querySelector('.gr-send'); return s && [s.querySelector('b').innerText, !s.querySelector('input[name=n]:not([type=hidden])'), s.querySelector('button[type=submit]').innerText.trim()]; })()")
    ok(f6 and f6[0] == "Skicka resultatet till gruppen" and f6[1] and f6[2] == "Skicka resultatet", f"a full group: 'Skicka resultatet till gruppen': {f6}")
    p6.click("#grSend button[type=submit]"); p6.wait_for_timeout(400)
    ok(p6.evaluate("document.querySelector('#grSend .sv-linkout').value") == six or "zz66" in p6.evaluate("document.querySelector('#grSend .sv-linkout').value"), "the full group's link is copied and shown")
    downloads = []; p6.on("download", lambda d: downloads.append(d))
    p6.click("[data-gr-style]"); p6.wait_for_timeout(1500)
    ok(not downloads and "Spara bilden" in p6.evaluate("document.getElementById('toast').innerText"), "Dela er stil saves no picture without asking: the link is copied, 'Spara bilden' is offered")
    ctx6.close()

    # ------------------------------------------------------------ the result becomes a room
    pc.click("[data-gr-room]"); pc.wait_for_timeout(600)
    room = pc.evaluate("(() => { const r = RQ.hem.rooms()[0]; return { label: r.label, type: r.type, style: r.style, items: r.items.map((i) => i.h), group: r.group }; })()")
    want = [h for h in allL + most if room["type"] in DATA[h]["rooms"]]
    ok(room["label"].startswith(("Vårt ", "Vår ")) and room["items"] == want[:8] and room["group"]["names"] == ["Anna", "Erik"], f"Gör ett rum av det: '{room['label']}', what you liked that fits, the people's names: {room}")
    ok(room["style"] in ("skandinavisk", "minimalistisk", "klassisk", "mjuk") and room["group"]["words"], "the room carries the group style")
    panel = pc.evaluate("[...document.querySelectorAll('.gr-room button, .gr-room a')].map((x) => x.innerText.trim())")
    total = sum(DATA[h]["price"] for h in room["items"])
    ok(panel[0] == "Se det i ditt rum" and re.sub(r"\s", "", panel[1]) == re.sub(r"\s", "", f"Köp allt · {total - (round(total * 0.1) if len(room['items']) >= 3 else 0):,} kr".replace(",", " ")) and "Vad tycker du?" in panel and "Öppna i Mitt hem" in panel, f"then Se det i ditt rum, Köp allt · total, Vad tycker du?: {panel}")
    ok(pc.evaluate("document.activeElement && document.activeElement.closest('.gr-room') !== null"), "the focus moves to the new room")
    ok("svep_group_room" in pc.evaluate(EV), "counted: Gör ett rum av det")
    pc.goto(urlC); pc.wait_for_timeout(900)
    ok(pc.evaluate("!!document.querySelector('.gr-room') && !document.querySelector('[data-gr-room]')"), "the link opens again with the room it became")
    go(pc, "mitt-hem", 1500)
    card = pc.evaluate("document.querySelector('.hem-card .hem-card-grp') && document.querySelector('.hem-card .hem-card-grp').innerText")
    ok(card == "Med Anna och Erik", f"Sparat: the room card says who it is with: {card}")
    ok(pc.evaluate("document.querySelector('.hem-grp-ppl').innerText.replace(/\\s+/g, ' ').trim()") == "Du, Anna och Erik", "Sparat: 'Du, Anna och Erik'")
    ok(pc.evaluate("document.querySelectorAll('.hem-groups li').length") == 1 and pc.evaluate("document.querySelector('.hem-groups a').getAttribute('href').startsWith('#svep-ihop-g')"), "Sparat lists the group, with a way back to the result")
    pc.evaluate("RQ.hem.openRoom(RQ.hem.rooms()[0].id)"); pc.wait_for_timeout(900)
    g = pc.evaluate("document.querySelector('#hemSheet .hem-grp').innerText")
    ok("er gemensamma stil" in g and "Anna" in g and not g.startswith(room["label"]), f"the room sheet: the group style and the people, the title not repeated: {g}")
    pc.keyboard.press("Escape"); pc.wait_for_timeout(400)
    for c in (ctxA, ctxB, ctxC):
        c.close()
    ok(not ea and not eb and not ec, f"group of three: no script errors {(ea + eb + ec)[:3]}")

    # ------------------------------------------------------------ older two-person links still open
    ctx, pg, errs = new(b, "390")
    go(pg, "svep", 600)
    old_hs = pg.evaluate("RQ.PRODUCTS.slice(0, 6).map((p) => p.handle)")
    pg.goto(BASE + "svep-ihop/#svep-ihop-" + "101100." + ".".join(old_hs) + "~Anna"); pg.wait_for_timeout(1000); pg.click("[data-gr-new]"); pg.wait_for_timeout(500)
    ok(pg.evaluate("document.getElementById('svCount').textContent") == "1 av 6" and pg.evaluate("document.querySelector('.gr-who b').innerText") == "Anna", "an older link with one answer: the deck with its six cards, Anna has answered")
    swipe(pg, "YYYNNN")
    ok(pg.evaluate("document.querySelector('.svep-result h2').innerText") == "Ni gillar båda 2 saker" and pg.evaluate("document.querySelector('.two-pct').innerText") == "Ni tycker 50 % lika", "an older link: the same comparison as before")
    back = pg.evaluate("RQ.svepGroup.url(RQ.svepGroup.all()[0])")
    ok("#svep-ihop-gl" in back and back.endswith("a0Anna_" + back.split("_")[-1]), f"its answer goes on as a new link for the same group (today's format): {back[-40:]}")
    pg.evaluate("localStorage.removeItem('rumiq-groups')")
    pg.goto(BASE + "svep-ihop/#svep-ihop-" + "101100_111000." + ".".join(old_hs) + "~Anna_Erik"); pg.wait_for_timeout(1000)
    ok(pg.evaluate("document.querySelector('.svep-result h2') && document.querySelector('.svep-result h2').innerText") == "Ni gillar båda 2 saker" and pg.evaluate("[...document.querySelectorAll('.svep-result .gr-ppl b')].map((x) => x.innerText)") == ["Anna", "Erik"], "an older reply with both answers: the comparison straight away, both names")
    pg.goto(BASE + "svep-ihop/#svep-ihop-1011.lysa"); pg.wait_for_timeout(800)
    ok(pg.evaluate("!!document.querySelector('.two-intro .note')"), "a broken link: the intro says so")
    # the Svep result's 'Skicka korten' starts a group with your round
    go(pg, "svep", 900)
    swipe(pg, "YYNYYNYNYY")
    pg.click("#svTwoOpen"); pg.wait_for_timeout(200)
    pg.fill("#svTwoN", "Mia"); pg.click("#svTwo button[type=submit]"); pg.wait_for_timeout(500)
    link = pg.evaluate("document.querySelector('#svTwo .sv-linkout').value")
    ok(re.search(r"#svep-ihop-g[0-9a-z]{4}\.(?:[0-9a-z]{4}){6,10}\.[0-9a-f]{2,3}[0-9a-z]{2}Mia$", link) is not None, f"Svep's 'Skicka korten': a group link with your round: {link[-30:]}")
    ok(not errs, f"older links: no script errors {errs[:3]}")
    ctx.close()

    # ------------------------------------------------------------ sharing without a share sheet or a clipboard
    ctx, pg, errs = new(b, "1280", share="none", clip=False)
    go(pg, "svep-ihop"); pg.click("#grStart"); pg.wait_for_timeout(800); swipe(pg, "YNYNYNYNYN")
    send(pg, "")
    ok(pg.evaluate("!document.querySelector('#grSend .sv-linkout-row').hidden && document.activeElement.classList.contains('sv-linkout')") and pg.evaluate("document.querySelector('#grSend .sv-linkmsg').textContent") == "Kopiera länken och skicka den i ett meddelande.", "nothing can share or copy: the link is shown and selected, with one line on what to do")
    pg.click("#grSend [data-copy]"); pg.wait_for_timeout(200)
    ok(pg.evaluate("document.querySelector('#grSend .sv-linkmsg').textContent") == "Markera länken och kopiera den.", "Kopiera says what to do when copying is blocked")
    ok(not errs, f"share fallback: no script errors {errs[:3]}")
    ctx.close()

    # ------------------------------------------------------------ taste follows the account
    ctx, pg, errs = new(b, "390")
    go(pg, "svep", 900)
    keys = pg.evaluate("RQ.vault.keys")
    ok(all(k in keys for k in ("rumiq-taste", "rumiq-style-log", "rumiq-groups")), f"the taste, the style history and the groups are in the sync list: {keys}")
    q = pg.evaluate("(() => { const a = RQ.vault.account; RQ.vault.account = () => true; RQ.vault.pending.clear(); RQ.taste.add(RQ.PRODUCTS[0].handle, 1); const out = [...RQ.vault.pending]; RQ.vault.account = a; clearTimeout(RQ.vault.timer); RQ.vault.pending.clear(); return out; })()")
    ok("rumiq-taste" in q, f"a swipe queues the taste for the account: {q}")
    pg.evaluate("RQ.taste.reset()")
    swipe(pg, "YYYYYNNNNN"); pg.click("#svMore"); pg.wait_for_timeout(900); swipe(pg, "NNNNNYYYYY")
    log = pg.evaluate("RQ.styleLog.get().length")
    ok(log == 2, f"each finished round is kept in the style history: {log}")
    go(pg, "mitt-hem", 1400)
    ot = pg.evaluate("document.querySelector('.hem-ot') && [document.querySelector('.hem-ot h3').innerText, document.querySelectorAll('.hem-ot-list li').length, document.querySelector('.hem-ot').innerText.includes('Sparas i den här webbläsaren')]")
    ok(ot and ot[0] == "Din stil över tid" and ot[1] == 2 and ot[2], f"Min stil: 'Din stil över tid', two rounds, honest about where it is kept: {ot}")
    ok(not errs, f"taste and history: no script errors {errs[:3]}")

    # ------------------------------------------------------------ the reasons are true
    CHECK = """(sel) => { const T = RQ.taste.get(), top = RQ.taste.top(T)[0], tone = (h) => { const n = parseInt(h.slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
        return RQ.TONES.reduce((b, x) => { const d = (y) => { const m = parseInt(y.hex.slice(1), 16); return Math.hypot(((m >> 16) & 255) - c[0], ((m >> 8) & 255) - c[1], (m & 255) - c[2]); }; return d(x) < d(b) ? x : b; }).id; };
      const liked = (h) => T.seen[h] > 0 || RQ.shop.isWished(h), byName = (nm) => RQ.PRODUCTS.find((p) => p.name === nm);
      return [...document.querySelectorAll(sel)].map((el) => { const card = el.closest('[data-h], .card, .look-item'), a = card.querySelector('a[href*="produkt-"], [data-look]'), h = card.dataset.h || (a && (a.dataset.look || (/produkt-([a-z0-9-]+)/.exec(a.getAttribute('href')) || [])[1])), p = RQ.byHandle(h), t = el.textContent.trim();
        let good = false, m;
        const kind = RQ.why.kindOf, room = (q) => p.rooms.some((r) => q.rooms.includes(r)), style = (q) => p.styles.some((s) => q.styles.includes(s));
        if (T.seen[h] < 0 && !RQ.shop.isWished(h)) good = false; // never a reason on something you said no to
        else if ((m = /^Eftersom du gillade (.+)$/.exec(t))) { const q = byName(m[1]); good = !!q && q.handle !== h && liked(q.handle) && !liked(h) && kind(p) === kind(q) && style(q) && room(q); }
        else if ((m = /^Samma färgton som (.+)$/.exec(t))) { const q = byName(m[1]); good = !!q && q.handle !== h && liked(q.handle) && !liked(h) && kind(p) !== kind(q) && tone(p.tone[0]) === tone(q.tone[0]) && style(q) && room(q); }
        else if ((m = /^Passar din stil: (.+)$/.exec(t))) good = !liked(h) && !!top && RQ.STYLES[top].name === m[1] && p.styles.includes(top);
        else if ((m = /^(Passar stilen|Samma stil): (.+)$/.exec(t))) good = p.styles.some((s) => RQ.STYLES[s].name === m[2]);
        else if (t === 'Du gillade den i Svep') good = T.seen[h] > 0;
        else if (t === 'Du har sparat den') good = RQ.shop.isWished(h);
        return [t, h, good]; }); }"""
    go(pg, "for-dig", 1200)
    rs = pg.evaluate(CHECK, ".card-why")
    ok(len(rs) >= 6 and all(r[2] for r in rs), f"För dig: every card has a reason and each one holds: {[r for r in rs if not r[2]][:3]} ({len(rs)})")
    ok(any(r[0].startswith("Eftersom du gillade") for r in rs) and any(r[0].startswith("Passar din stil") or r[0] == "Du gillade den i Svep" for r in rs), f"För dig: reasons of more than one kind: {sorted(set(r[0][:22] for r in rs))}")
    go(pg, "butik", 1000)
    ok(pg.evaluate("document.querySelectorAll('.card-why').length") == 0, "the shop's own order shows no reasons (only 'För dig' does)")
    pg.select_option("#sort", "dig"); pg.wait_for_timeout(500)
    rs = pg.evaluate(CHECK, ".card-why")
    ok(len(rs) >= 6 and all(r[2] for r in rs), f"shop sorted 'För dig': true reasons: {[r for r in rs if not r[2]][:3]}")
    go(pg, "", 1800)
    rs = pg.evaluate(CHECK, "#utvalt .card-why")
    ok(len(rs) >= 4 and all(r[2] for r in rs), f"home 'Utvalt för dig': true reasons: {[r for r in rs if not r[2]][:3]}")
    rj = pg.evaluate("(() => { const T = RQ.taste.get(); return [...document.querySelectorAll('#utvalt .card h3 a')].map((a) => (/produkt-([a-z0-9-]+)/.exec(a.getAttribute('href')) || [])[1]).filter((h) => T.seen[h] < 0 && !RQ.shop.isWished(h)); })()")
    ok(pg.evaluate("Object.values(RQ.taste.get().seen).some((v) => v < 0)") and not rj, f"home 'Utvalt för dig' never shows something you said no to: {rj}")
    order = pg.evaluate("(() => { const T = RQ.taste.get(), l = RQ.why.forYou(RQ.PRODUCTS).map((p) => (T.seen[p.handle] < 0 && !RQ.shop.isWished(p.handle) ? 2 : T.seen[p.handle] > 0 || RQ.shop.isWished(p.handle) ? 1 : 0)); return l.every((x, i) => !i || l[i - 1] <= x); })()")
    ok(order, "'För dig' order: new things first, then what you liked, what you said no to last")
    go(pg, "produkt-lysa-keramiklampa", 1200)
    rs = pg.evaluate(CHECK, ".look-item .why")
    ok(len(rs) >= 1 and all(r[2] for r in rs), f"product page 'Passar ihop': a true reason on each: {rs}")
    # a room with no lighting: "Saknas i ditt rum: belysning", and only then
    pg.evaluate("RQ.hem.create({ label: 'Testrum', type: 'vardagsrum', style: 'skandinavisk', items: [{ h: 'lin-kuddfodral', v: 0 }, { h: 'sand-keramikvas', v: 0 }] })")
    gap = pg.evaluate("(() => { const r = RQ.hem.rooms()[0]; return RQ.why.gaps(r).map((p) => [p.handle, RQ.why.kindOf(p), RQ.why.of(p, { room: r })]); })()")
    lamp = pg.evaluate("(() => { const r = RQ.hem.rooms()[0]; return RQ.why.of(RQ.byHandle('lysa-keramiklampa'), { room: r }); })()")
    ok(lamp == "Saknas i ditt rum: en lampa" and gap and not any(g[1] == "textil" for g in gap) and all(g[2].startswith("Saknas i ditt rum") for g in gap), f"a living room with a cushion cover and a vase: it lacks a lamp, never textile: {lamp} {gap}")
    no = pg.evaluate("(() => { const r = { type: 'vardagsrum', style: null, items: [{ h: 'glob-bordslampa-opalglas' }, { h: 'lin-kuddfodral' }] }; return [RQ.why.of(RQ.byHandle('lysa-keramiklampa'), { room: r, mine: false }), RQ.why.of(RQ.byHandle('plad-ullblandning-havre'), { room: r, mine: false })]; })()")
    ok(not any(x.startswith("Saknas") for x in no), f"a room that has a lamp and a textile is never told it lacks one: {no!r}")
    go(pg, "mitt-hem", 1400)
    pg.evaluate("RQ.hem.openRoom(RQ.hem.rooms().find((r) => r.label === 'Testrum').id)"); pg.wait_for_timeout(1000)
    gp = pg.evaluate("[...document.querySelectorAll('#hemSheet .hem-gaps li span')].map((s) => s.innerText)")
    ok(gp and all(x.startswith("Saknas i ditt rum:") and "textil" not in x for x in gp), f"the room sheet: 'Saknas i rummet' with the reason: {gp}")
    pg.click("#hemSheet [data-gap-add]"); pg.wait_for_timeout(400)
    ok(pg.evaluate("RQ.hem.rooms().find((r) => r.label === 'Testrum').items.length") == 3, "Lägg till puts it in the room's list")
    ok(not errs, f"reasons: no script errors {errs[:3]}")
    ctx.close()

    # ------------------------------------------------------------ the Svep chip and the proposal card: true reasons
    ctx, pg, errs = new(b, "1440")
    go(pg, "svep", 900)
    chips = []
    for i in range(10):
        c = pg.evaluate("(() => { const c = document.querySelector('.sv-card[aria-hidden=false]'); const w = c && c.querySelector('.sv-why'); return w ? [w.textContent, c.dataset.h] : null; })()")
        if c:
            chips.append(c)
        pg.click("#svYes"); pg.wait_for_timeout(330)
    pg.wait_for_timeout(800)
    bad = pg.evaluate("""(cs) => cs.filter(([t, h]) => { const p = RQ.byHandle(h), m = /^(Eftersom du gillade|Samma färgton som|Mer som) (.+)$/.exec(t), s = /^Passar din stil: (.+)$/.exec(t);
      if (m) { const q = RQ.PRODUCTS.find((x) => x.name === m[2]); if (!q) return true; if (m[1] === 'Mer som') return false; const same = RQ.why.kindOf(p) === RQ.why.kindOf(q);
        return !p.styles.some((y) => q.styles.includes(y)) || !p.rooms.some((r) => q.rooms.includes(r)) || (m[1] === 'Eftersom du gillade' ? !same : same); }
      if (s) return !p.styles.some((y) => RQ.STYLES[y].name === s[1]); return true; })""", chips)
    ok(chips and not bad, f"Svep: the chip's reason holds on every card that has one: {bad} of {chips}")
    rs = pg.evaluate("[...document.querySelectorAll('.svep-result .hem-prop-items .why')].map((w) => [w.textContent, w.closest('li').dataset.h])")
    ok(rs and all(t in ("Du gillade den i Svep", "Du har sparat den") or t.startswith(("Eftersom du gillade", "Samma färgton som", "Passar din stil", "Passar stilen")) for t, h in rs), f"the proposal card: a reason on its things: {rs}")
    # Mer som det här, from Svep's result
    pg.click(".svep-result [data-more]"); pg.wait_for_timeout(500)
    ml = pg.evaluate("(() => { const m = document.querySelector('.ml'); return m && [m.querySelector('h3').innerText, m.querySelectorAll('.card').length, [...m.querySelectorAll('.card-why')].map((x) => x.textContent), document.activeElement === m.querySelector('h3')]; })()")
    ok(ml and ml[0].startswith("Mer som ") and 1 <= ml[1] <= 4 and len(ml[2]) == ml[1] and ml[3], f"Mer som det här: a few like it, each with what they share, the focus on its heading: {ml}")
    seed = pg.evaluate("document.querySelector('.ml').dataset.ml")
    sims = pg.evaluate("(h) => RQ.moreLikeMany(h.split(','), 8).map((x) => x.p.handle)", seed)
    pg.click(".ml [data-svep-seed]"); pg.wait_for_timeout(1000)
    first = pg.evaluate("(() => { const c = document.querySelector('.sv-card[aria-hidden=false]'); return c ? [c.dataset.h, (c.querySelector('.sv-why') || {}).textContent || ''] : null; })()")
    seen = pg.evaluate("Object.keys(RQ.taste.get().seen)")
    ok(first and (first[0] in sims or all(s in seen for s in sims)) and (first[1].startswith("Mer som") or all(s in seen for s in sims)), f"'Svep fler som den' starts a round with things like it: {first}")
    ok(not errs, f"Svep reasons: no script errors {errs[:3]}")
    ctx.close()

    # ------------------------------------------------------------ the share picture and its text
    head = (ROOT / "svep-ihop/index.html").read_text(encoding="utf-8")
    ok("assets/img/og-svep.jpg" in head and 'og:image:width" content="1200"' in head and "Svep 10 kort var för sig" in head, "svep-ihop: its own share picture (1200 × 630) and a one-line description")
    ok("assets/img/og-svep-solo.jpg" in (ROOT / "svep/index.html").read_text(encoding="utf-8"), "svep: its own share picture (Svep fram din stil)")
    from PIL import Image
    ok(Image.open(ROOT / "assets/img/og-svep.jpg").size == (1200, 630) and (ROOT / "assets/img/og-svep.jpg").stat().st_size < 150_000, "the share picture is 1200 × 630 and light")
    en = json.loads((ROOT / "tools/i18n-add/svep2.json").read_text(encoding="utf-8"))
    ok(all(k in en for k in ("Gör ett rum av det", "Mer som det här", "Skicka vidare", "Din stil över tid")), "English for the new words")

    # ------------------------------------------------------------ targets, screens, axe
    for size in ("390", "360", "375s", "1440", "1280"):
        for night in (False, True):
            ctx, pg, errs = new(b, size, night=night, share="none")
            tag = f"[{size}{' evening' if night else ''}]"
            go(pg, "svep-ihop")
            pg.click("#grStart"); pg.wait_for_timeout(800)
            swipe(pg, "YYNYNYYNNY"); u = send(pg, "Anna")
            pg.evaluate("localStorage.removeItem('rumiq-groups')")
            pg.goto(u); pg.wait_for_timeout(900)
            pg.click("[data-gr-new]"); pg.wait_for_timeout(600)
            u44 = pg.evaluate("Math.round(document.getElementById('svUndo').getBoundingClientRect().width)")
            ok(u44 >= 44, f"{tag} the undo button is at least 44 px: {u44}")
            if SIZES[size][2]:
                dk = pg.evaluate(DOCK)
                ok(dk[1] - dk[0] >= 8, f"{tag} the shared page: the Svep buttons sit above the dock: {dk}")
            sw = pg.evaluate("document.documentElement.scrollWidth")
            ok(sw <= SIZES[size][0], f"{tag} the shared page fits the width: {sw}")
            swipe(pg, "YYYNNNYYNN")
            if SIZES[size][2]:
                od = pg.evaluate("(() => { const y = (s) => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().top + scrollY) : -1; }; return [y('.two-meter'), y('.gr-send'), y('.gr-acts'), y('.gr-main .sp-saved')]; })()")
                ok(od[0] < od[1] < od[2] < od[3], f"{tag} phone order: meter, send back, Gör ett rum, what you agree on: {od}")
            small = pg.evaluate("[...document.querySelectorAll('.svep-result button, .svep-result a, .svep-result summary')].filter((e) => e.offsetParent && !e.closest('.sv-liked > div > button[data-sheet]')).map((e) => [e.textContent.trim().slice(0, 20), Math.round(e.getBoundingClientRect().height)]).filter((x) => x[1] < 44 && !/^Bara|^Det /.test(x[0]))")
            ok(not small, f"{tag} the result's controls are at least 44 px high: {small[:4]}")
            if size in ("390", "1440") and AXE.exists():
                pg.add_script_tag(content=AXE.read_text())
                RUN = """async () => { const r = await axe.run(document.querySelector('#view'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] }, resultTypes: ['violations'] });
                  return r.violations.map((v) => v.id + ': ' + v.nodes.slice(0, 2).map((x) => x.target.join(' ')).join(' | ')); }"""
                ok(not pg.evaluate(RUN), f"[axe {tag}] the group result: {pg.evaluate(RUN)[:3]}")
                pg.click("[data-gr-room]"); pg.wait_for_timeout(500); pg.click(".svep-result [data-more]"); pg.wait_for_timeout(500)
                ok(not pg.evaluate(RUN), f"[axe {tag}] the room panel and Mer som det här: {pg.evaluate(RUN)[:3]}")
                go(pg, "svep-ihop"); pg.add_script_tag(content=AXE.read_text())
                ok(not pg.evaluate(RUN), f"[axe {tag}] the intro: {pg.evaluate(RUN)[:3]}")
                pg.goto(u); pg.wait_for_timeout(900); pg.evaluate("localStorage.removeItem('rumiq-groups')"); pg.reload(); pg.wait_for_timeout(900); pg.add_script_tag(content=AXE.read_text())
                ok(not pg.evaluate(RUN), f"[axe {tag}] the invitation: {pg.evaluate(RUN)[:3]}")
                pg.click("[data-gr-new]"); pg.wait_for_timeout(600)
                ok(not pg.evaluate(RUN), f"[axe {tag}] the shared page with the deck: {pg.evaluate(RUN)[:3]}")
            ok(not errs, f"{tag} no script errors {errs[:3]}")
            ctx.close()
    b.close()

print(f"{n - len(fails)} of {n} checks passed")
sys.exit(1 if fails else 0)
