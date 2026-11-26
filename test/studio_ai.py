#!/usr/bin/env python3
"""Studio AI: the AI room picture and Mina rumsbilder (ai.js, Sparat).
4 the picture has the room photo's shape (a square server answer is cropped, never stretched), carries its AI label,
  says "Vi gör ett nytt försök…" when the server retries, and remembers exactly which products and colours it shows
  (Köp allt adds those, even after the room has changed);
5 every picture is kept automatically with its before picture in IndexedDB (Mina rumsbilder in Sparat): slider,
  Ladda ner, Ta bort with Ångra, the switch, the honest note, and a clear message when the device is full;
6 versions: Skapa igen makes a new one beside the earlier, flip and compare two, versions belong to the room project
  (a Rumsprojekt points to them, Fortsätt i Mitt rum keeps the project);
  Visa någon (before and after in one picture), limits read from config, English, axe on the new states.
The AI server is dormant: its answers are mocked in the page (a streamed retry, plain JSON, the server library).
Run after `python3 tools/build.py`:  python3 test/studio_ai.py
Own in-process server; everything outside 127.0.0.1 is blocked, as in the sandbox."""
import http.server, os, re, socketserver, sys, threading
from pathlib import Path
from playwright.sync_api import sync_playwright
import sys as _s, os as _o; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); import _edit_way  # noqa: E402,F401  the editor tests start in Justera själv

ROOT = Path(__file__).resolve().parent.parent
AXE = Path(os.environ.get("AXE", "/home/claude/axe/node_modules/axe-core/axe.min.js"))
SHOTS = Path(os.environ.get("SHOTS", "/tmp/studio-ai-shots"))
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
SAMPLE = """async (r) => { const im = new Image(); await new Promise((ok) => { im.onload = ok; im.src = 'assets/img/rum/' + r + '-1600.webp'; });
  await RQ.room.saveImage(im, { sample: true, map: r, type: r, name: r }); }"""
FOUR = ["lysa-keramiklampa", "plad-ullblandning-havre", "lin-kuddfodral", "sand-keramikvas"]
TOAST = "[...document.querySelectorAll('.toast.show')].map((t) => t.innerText).join(' ')"
LINES = "RQ.shop.cartLines().map((l) => l.id).sort().join(',')"
PICS = "RQ.aiLib.store.list().then((r) => r.pics.map((p) => ({ id: p.id, n: p.n, project: p.project, items: p.items.map((i) => i.h + '::' + i.v).join(','), demo: p.demo, w: p.w, h: p.h, after: !!p.after })))"
ROOMS = "RQ.aiLib.store.list().then((r) => Object.keys(r.rooms).length)"
# the AI server, mocked in the page: a streamed answer (with or without a retry) or plain JSON, a square picture
LIVE = r"""(o) => {
  const A = RQ.auth; RQ_CONFIG.studio.aiLive = true; A.mode = 'supabase'; A.start = async () => {}; A.token = async () => 'tok';
  window.__st = { signed_in: true, consent: true, plan: 'free', plan_name: 'Gratis', free_play: false, balance: 4, daily_used: 0, daily_cap: 5, quality_left: 3, period_end: '2026-12-01T00:00:00Z' };
  A.client = () => ({ rpc: async (name) => name === 'ai_status' ? { data: window.__st } : name === 'ai_quality_refund' ? { data: 2 } : { data: null } });
  RQ_CONFIG.auth.preview = false;
  const c = document.createElement('canvas'); c.width = 900; c.height = 900; const g = c.getContext('2d');
  g.fillStyle = '#5a7a5c'; g.fillRect(0, 0, 900, 900); g.fillStyle = '#e8d9c4'; g.fillRect(300, 300, 300, 300);
  window.__img = c.toDataURL('image/jpeg', .9); window.__calls = [];
  const real = window.__realFetch || (window.__realFetch = window.fetch);
  window.fetch = async (url, init) => {
    url = String(url); if (!url.includes('/functions/v1/')) return real(url, init);
    const body = JSON.parse(init.body || '{}'); __calls.push({ url, body, accept: init.headers.Accept });
    const enc = new TextEncoder(), sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    if (url.endsWith('/ai-library')) {
      if (body.action === 'list') return new Response(JSON.stringify({ items: [{ id: 'srv1', at: '2026-11-20T10:00:00Z', url: window.__img, before_url: window.__img, scene: [{ h: 'sand-keramikvas', v: 0, x: 50, y: 80, w: 10 }], w: 900, h: 900, project: 'srvroom', n: 1 }] }), { status: 200, headers: { 'content-type': 'application/json' } });
      return new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } });
    }
    __st.balance = Math.max(0, __st.balance - 1);
    const res = { id: 'gen' + Date.now().toString(36), url: window.__img, retried: !!o.retry };
    if (!o.stream) { await sleep(o.wait || 400); return new Response(JSON.stringify(res), { status: 200, headers: { 'content-type': 'application/json' } }); }
    const stream = new ReadableStream({ async start(ctl) {
      ctl.enqueue(enc.encode(JSON.stringify({ stage: 'started' }) + '\n'));
      if (o.retry) { await sleep(300); ctl.enqueue(enc.encode(JSON.stringify({ stage: 'retry' }) + '\n')); }
      await sleep(o.wait || 1500); ctl.enqueue(enc.encode(JSON.stringify(res) + '\n')); ctl.close(); } });
    return new Response(stream, { status: 200, headers: { 'content-type': 'application/x-ndjson' } });
  };
}"""


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


def go(pg, route, wait=800):
    pg.goto(BASE + (route + "/" if route else ""), wait_until="load")
    pg.wait_for_timeout(wait)
    pg.evaluate("document.getElementById('ckNeed') && document.getElementById('ckNeed').click()")
    pg.evaluate("RQ.loadTools && RQ.loadTools()")
    pg.wait_for_timeout(200)


def room(pg, items, r="vardagsrum"):
    go(pg, "mitt-rum", 300)
    pg.evaluate("RQ.shop.signIn('test@example.com', 'Test', 'email'); localStorage.setItem('rumiq-ai-consent', JSON.stringify('x'))")
    pg.evaluate(SAMPLE, r)
    pg.evaluate("(hs) => { RQ.room.saveScene([]); hs.forEach((h) => RQ.room.add(h, true)); }", list(items))
    pg.goto(BASE + "mitt-rum/"); pg.wait_for_timeout(1300)


def create(pg, wait=3000):
    pg.evaluate("RQ.openAI()"); pg.wait_for_timeout(2200)
    pg.evaluate("document.getElementById('aiGo').click()"); pg.wait_for_timeout(wait)


def again(pg, wait=3800):
    pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
    pg.evaluate("(() => { const it = RQ.room.scene()[0]; RQ.room.update(it.h, { x: Math.max(8, it.x - 12) }); })()")
    create(pg, wait)


def shot(pg, name):
    SHOTS.mkdir(parents=True, exist_ok=True)
    pg.screenshot(path=str(SHOTS / f"{name}.png"))


RATIO = "(() => { const r = RQ.room.get(), f = document.querySelector('#aiBa, .ai-result [data-ba]'), im = f && f.querySelector('img.after'); if (!im) return null; const b = f.getBoundingClientRect(); return [r.w / r.h, b.width / b.height, im.naturalWidth / im.naturalHeight]; })()"

with sync_playwright() as p:
    b = p.chromium.launch()

    # ------------------------------------------------ demo (the preview): the whole flow on phone and desktop
    for W, Hh, mob in ((390, 844, True), (1440, 900, False)):
        tag = f"[demo {W}]"
        ctx, pg, errs = new(b, mob, W, Hh)
        room(pg, FOUR)
        create(pg, 900)
        ok("Gör i ordning förhandsvisningen" in pg.evaluate("document.getElementById('aiTitle').innerText") and "När AI-bilderna är igång tar bilden 15–40 sekunder" in pg.evaluate("document.querySelector('.ai-wait .ai-lead').innerText"), f"{tag} the preview's wait says what the preview does")
        pg.wait_for_timeout(1300)
        mid = pg.evaluate("+document.querySelector('.ai-result [data-ba] input').value")
        pg.wait_for_timeout(2200)
        rat = pg.evaluate(RATIO)
        ok(rat and abs(rat[0] - rat[1]) / rat[0] < 0.01 and abs(rat[0] - rat[2]) / rat[0] < 0.01, f"{tag} the picture and its frame have the room photo's shape: {rat}")
        ok(pg.evaluate("document.querySelector('.ai-tag-a').innerText") == "Förhandsvisning" and pg.evaluate("document.querySelector('.ai-tag-b').innerText") == "Före", f"{tag} labelled Demo, the before side Före")
        ok(pg.evaluate("!!document.querySelector('.ai-result img.before') && !!document.querySelector('.ai-result [data-ba] input')"), f"{tag} the before picture (the room photo) is under a slider")
        ok(mid < 100 and pg.evaluate("+document.querySelector('.ai-result [data-ba] input').value") == 30, f"{tag} the made room sweeps in over the photo and settles at 30 %: {mid}")
        sv = pg.evaluate("document.querySelector('.ai-saved').innerText"); ok("Bilden finns nu" in sv and "i Mitt hem" in sv, f"{tag} the picture is saved by itself, and the sheet says where (in which room, since M8): {sv}")
        pics = pg.evaluate(PICS)
        ok(len(pics) == 1 and pics[0]["items"] == ",".join(h + "::0" for h in FOUR) and pics[0]["after"] and pg.evaluate(ROOMS) == 1, f"{tag} IndexedDB holds the picture, its products and colours, and the before photo once: {pics}")
        ok(pg.evaluate("document.getElementById('aiBuy').getBoundingClientRect().top < document.querySelector('.ai-prods').getBoundingClientRect().top"), f"{tag} Köp allt comes before the list")
        if mob:  # the phone: Köp allt and the total in reach at once, in a bar under the picture, never over it
            bar = pg.evaluate("(() => { const b = document.querySelector('.ai-buybar').getBoundingClientRect(), f = document.getElementById('aiBa').getBoundingClientRect(), k = document.getElementById('aiBuy').getBoundingClientRect(); return [k.bottom <= innerHeight, b.top >= f.bottom - 1, document.querySelector('.ai-buysum').innerText.replace(/[\\u00a0\\u202f]/g, ' ')]; })()")
            ok(bar[0] and bar[1] and "2 737 kr" in bar[2], f"{tag} Köp allt with the total is on the first screen, below the picture: {bar}")
        else:  # the desktop: the picture far larger than the old 510 px, at the photo's shape
            wid = pg.evaluate("document.getElementById('aiBa').getBoundingClientRect().width")
            ok(wid >= 740, f"{tag} the picture is shown large on a desktop: {wid:.0f} px")
        ok(not pg.evaluate("!!document.getElementById('aiAgain')") and "nya versioner" in pg.evaluate("document.querySelector('.ai-result .ai-pad').innerText"), f"{tag} the demo offers no Skapa igen (it would make the same picture) and says versions come with the AI")
        small = pg.evaluate("[...document.querySelectorAll('.ai-result .small-row .tlink, .ai-result .ai-saved a, .ai-cmp .chip')].map((e) => [e.textContent.trim(), Math.round(e.getBoundingClientRect().height)]).filter((x) => x[1] < 44)")
        ok(not small, f"{tag} the sheet's links are 44 px targets: {small}")
        if mob:
            ok(pg.evaluate("document.querySelector('#aiShare .ai-share-t').getBoundingClientRect().width > 40") and pg.evaluate("getComputedStyle(document.querySelector('.ai-result .ai-sum')).display") == "none", f"{tag} Visa någon has its words on a phone, and the total shows once (in the bar)")
        shot(pg, f"demo-{W}-result")
        # keyboard on the slider
        pg.evaluate("document.querySelector('.ai-result [data-ba] input').focus()"); pg.keyboard.press("ArrowRight"); pg.wait_for_timeout(100)
        ok(pg.evaluate("document.querySelector('.ai-result [data-ba]').style.getPropertyValue('--x')") == "31%" and "Före 31 %" == pg.evaluate("document.querySelector('.ai-result [data-ba] input').getAttribute('aria-valuetext')"), f"{tag} the arrow keys move the slider and it says where")
        # a second picture of the same room (after moving one thing): a second version beside the first
        again(pg)
        ok(pg.evaluate("document.querySelectorAll('.ai-ver').length") == 2 and pg.evaluate("document.querySelector('.ai-ver[aria-pressed=true]').dataset.ver") == "1", f"{tag} Skapa igen: two versions, the new one shown")
        ok(len(pg.evaluate(PICS)) == 2 and sorted(x["n"] for x in pg.evaluate(PICS)) == [1, 2], f"{tag} both versions are saved, numbered 1 and 2")
        pg.evaluate("document.querySelector('[data-cmp=\"0\"]').click()"); pg.wait_for_timeout(300)
        ok(pg.evaluate("document.querySelector('.ai-tag-b').innerText") == "Version 1" and "Version 2" in pg.evaluate("document.querySelector('.ai-tag-a').innerText"), f"{tag} compare: version 1 under the slider, version 2 over it")
        ok(pg.evaluate("document.activeElement && document.activeElement.dataset.cmp") == "0", f"{tag} focus stays on the chosen compare chip")
        shot(pg, f"demo-{W}-compare")
        pg.evaluate("document.querySelector('[data-ver=\"0\"]').click()"); pg.wait_for_timeout(300)
        ok(pg.evaluate("document.querySelector('.ai-ver[aria-pressed=true]').dataset.ver") == "0" and pg.evaluate("document.querySelector('.ai-tag-b').innerText") == "Före", f"{tag} flipping to version 1 (the compare goes back to Före when it was version 1 itself)")
        # Ladda ner: the AI picture with the label burned in
        with pg.expect_download() as d:
            pg.evaluate("document.getElementById('aiDown').click()")
        ok(re.match(r"rumiq-ai-bild-\d{4}-\d\d-\d\d\.jpg$", d.value.suggested_filename), f"{tag} Ladda ner gives the picture: {d.value.suggested_filename}")
        # Visa någon without a share sheet: the before and after picture is downloaded, the toast says so
        pg.evaluate("Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })")
        pg.evaluate("document.getElementById('aiShare').click()"); pg.wait_for_timeout(900)
        ok("Ladda ner bilden" in pg.evaluate(TOAST), f"{tag} without a share sheet the picture is offered, not downloaded by itself (place review)")
        with pg.expect_download() as d:
            pg.evaluate("document.querySelector('#toast [data-ai-offer]').click()")
        pg.wait_for_timeout(300)
        ok(d.value.suggested_filename.startswith("rumiq-fore-efter-") and "före och efter" in pg.evaluate(TOAST), f"{tag} Visa någon: before and after in one picture: {d.value.suggested_filename} / {pg.evaluate(TOAST)}")
        # Visa någon with a share sheet: one picture file goes to it
        pg.evaluate("window.__shared = null; Object.defineProperty(navigator, 'share', { value: async (d) => { window.__shared = d; }, configurable: true }); Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true })")
        pg.evaluate("document.getElementById('aiShare').click()"); pg.wait_for_timeout(900)
        sh = pg.evaluate("window.__shared && [window.__shared.files.length, window.__shared.files[0].type, window.__shared.files[0].size > 20000, window.__shared.title]")
        ok(sh and sh[0] == 1 and sh[1] == "image/jpeg" and sh[2] and sh[3] == "Före och efter", f"{tag} Visa någon hands the picture to the phone's share sheet: {sh}")
        # Mina rumsbilder in Sparat
        pg.evaluate("document.querySelector('.ai-saved a').click()"); pg.wait_for_timeout(1800)
        ok(pg.evaluate("RQ.currentRoute()") == "mitt-hem" and pg.evaluate("Math.abs(document.getElementById('mh-bilder').getBoundingClientRect().top) < 140"), f"{tag} the sheet's link lands on Mina rumsbilder")
        ok(pg.evaluate("document.querySelectorAll('.ai-lcard').length") == 1 and pg.evaluate("document.querySelectorAll('.ai-lcard .ai-ver').length") == 2, f"{tag} one room card with its two versions")
        ok(pg.evaluate("document.querySelector('[data-ai-count]').innerText") == "Alla bilder (2)", f"{tag} the jump menu counts the pictures")
        ok("på den här enheten" in pg.evaluate("document.getElementById('aiLibNote').innerText"), f"{tag} the page says honestly that the pictures are on this device only")
        ok(pg.evaluate("document.getElementById('aiAuto').checked && document.getElementById('aiAuto').getAttribute('role') === 'switch'"), f"{tag} 'Spara mina AI-bilder automatiskt' is a switch, on by default")
        ok(pg.evaluate("document.querySelector('.ai-lcard [data-lib-buy]').innerText.replace(/[\\u00a0\\u202f]/g, ' ')") == "Köp allt · 2 737 kr", f"{tag} the card's Köp allt says the total: {pg.evaluate('document.querySelector(\".ai-lcard [data-lib-buy]\").innerText')}")
        order = pg.evaluate("[[...document.querySelectorAll('.mh > [id]')].map((e) => e.id), [...document.querySelectorAll('.jump-nav a')].map((a) => a.getAttribute('href'))]")
        # studio2: the overview (Mina rum) comes first, then Mina rumsbilder (Alla bilder), easy to reach in the jump menu
        ok(order[0][:2] == ["mh-rum", "mh-bilder"] and order[1][1].endswith("mh-bilder"), f"{tag} the overview first, then Mina rumsbilder in Sparat and in its menu, the empty parts after: {order}")
        # studio2: Rumsprojekt is merged into Mina rum (one place); the old part is gone
        ok(pg.evaluate("!document.querySelector('.mh-why') && document.querySelector('#mh-rum h2').innerText") in ("Mina rum", "Fortsätt där du slutade"), f"{tag} one place for rooms: Mina rum (Rumsprojekt merged into it)")
        small = pg.evaluate("[...document.querySelectorAll('.ai-lcard .small-row .tlink, .ai-lcard .chip, .ai-auto')].map((e) => [e.textContent.trim(), Math.round(e.getBoundingClientRect().height)]).filter((x) => x[1] < 44)")
        ok(not small, f"{tag} the library's links, chips and switch row are 44 px targets: {small}")
        shot(pg, f"demo-{W}-library")
        # Ta bort and Ångra: a version, then the last one with its before picture
        pg.evaluate("document.querySelector('.ai-lcard [data-lib-del]').click()"); pg.wait_for_timeout(500)
        ok("Version 2 är borttagen." in pg.evaluate(TOAST) and len(pg.evaluate(PICS)) == 1 and pg.evaluate(ROOMS) == 1, f"{tag} Ta bort takes one version, the before photo stays for the other: {pg.evaluate(TOAST)}")
        pg.evaluate("document.querySelector('#toast [data-ai-undo]').click()"); pg.wait_for_timeout(500)
        ok(len(pg.evaluate(PICS)) == 2 and pg.evaluate("document.querySelectorAll('.ai-lcard .ai-ver').length") == 2, f"{tag} Ångra brings the version back")
        pg.evaluate("document.querySelector('.ai-lcard [data-lib-del]').click()"); pg.wait_for_timeout(400)
        pg.evaluate("document.querySelector('.ai-lcard [data-lib-del]').click()"); pg.wait_for_timeout(500)
        ok("Bilden och bilden före är borttagna." in pg.evaluate(TOAST) and len(pg.evaluate(PICS)) == 0 and pg.evaluate(ROOMS) == 0, f"{tag} the last picture goes with its before picture")
        ok("Inga rumsbilder än" in pg.evaluate("document.getElementById('aiLib').innerText"), f"{tag} the empty library says what will come there")
        pg.evaluate("document.querySelector('#toast [data-ai-undo]').click()"); pg.wait_for_timeout(500)
        ok(len(pg.evaluate(PICS)) == 1 and pg.evaluate(ROOMS) == 1, f"{tag} Ångra brings both back")
        go(pg, "mitt-rum", 1300)
        ok(pg.evaluate("(document.querySelector('.ai-card-lib') || {}).textContent") == "Alla bilder (1)", f"{tag} Mitt rum's AI card leads to Mina rumsbilder: {pg.evaluate('(document.querySelector(\".ai-card-lib\") || {}).textContent')}")
        pg.evaluate("RQ_CONFIG.studio.aiLive = true; localStorage.removeItem('rumiq-ai-consent'); RQ.openAI()"); pg.wait_for_timeout(2000)  # the consent comes once the AI is switched on (device3 X1)
        ok("i Mitt hem på den här enheten" in pg.evaluate("document.querySelector('.ai-list').innerText"), f"{tag} the consent says the same as the library: on this device")
        pg.evaluate("RQ_CONFIG.studio.aiLive = false; localStorage.setItem('rumiq-ai-consent', JSON.stringify('x'))"); pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
        go(pg, "mitt-hem", 1500)
        # Fortsätt i Mitt rum: another room in between, then back to this one, under the same project
        key0 = pg.evaluate("RQ.aiLib.store.list().then((r) => r.pics[0].project)")
        go(pg, "mitt-rum", 500); pg.evaluate(SAMPLE, "sovrum"); pg.evaluate("RQ.room.saveScene([])")
        ok(pg.evaluate("RQ.ai.projectKey()") != key0, f"{tag} a new room photo is a new project")
        go(pg, "mitt-hem", 1500)
        pg.evaluate("document.querySelector('.ai-lcard [data-lib-cont]').click()"); pg.wait_for_timeout(1800)
        ok(pg.evaluate("RQ.currentRoute()") == "mitt-rum" and pg.evaluate("RQ.room.get().map") == "vardagsrum" and sorted(pg.evaluate("RQ.room.scene().map((i) => i.h)")) == sorted(FOUR[:4]), f"{tag} Fortsätt i Mitt rum puts the room and its products back")
        ok(pg.evaluate("RQ.ai.projectKey()") == key0, f"{tag} ...under the same project, so the next picture is its next version")
        # a Rumsprojekt saved now belongs to the same project and points to its pictures
        pg.evaluate("RQ.shop.saveProject({ title: 'Mitt rum med Lysa', img: '', handles: ['lysa-keramiklampa'] })")
        ok(pg.evaluate("RQ.shop.projects()[0].studio") == key0 and pg.evaluate("RQ.hem.rooms().some((r) => r.pkey === '" + key0 + "')"), f"{tag} Spara in Mitt rum lands in a room in Mina rum, under the same room project")
        go(pg, "mitt-hem", 1500)
        ok(pg.evaluate("document.querySelectorAll('.hem-card').length") >= 1, f"{tag} the saved room shows as a card in Mina rum")
        # the switch off: the next picture is not kept unless asked
        pg.evaluate("document.getElementById('aiAuto').click()"); pg.wait_for_timeout(200)
        ok(pg.evaluate("RQ.shop.store.get('rumiq-ai-autosave', true)") is False and "sparas inte" in pg.evaluate("document.getElementById('aiLibNote').innerText"), f"{tag} switching off is remembered and said")
        go(pg, "mitt-rum", 1000); create(pg, 3200)
        ok(pg.evaluate("!!document.getElementById('aiSave')") and len(pg.evaluate(PICS)) == 1, f"{tag} with the switch off nothing is saved, the sheet offers to")
        pg.evaluate("document.getElementById('aiSave').click()"); pg.wait_for_timeout(800)
        ok(len(pg.evaluate(PICS)) == 2 and "Bilden finns nu i Mitt hem" in pg.evaluate("document.querySelector('.ai-saved').innerText"), f"{tag} 'Spara i Mina rumsbilder' saves it")
        # Rensa allt also empties the library
        go(pg, "mitt-hem", 1200)
        pg.evaluate("document.getElementById('clearAll').click()"); pg.wait_for_timeout(100)
        ok("rumsbilder" in pg.evaluate("document.getElementById('clearNote').innerText"), f"{tag} 'Rensa allt' says the room pictures go too")
        pg.evaluate("document.getElementById('clearAll').click()"); pg.wait_for_timeout(900)
        ok(len(pg.evaluate(PICS)) == 0, f"{tag} 'Rensa allt' empties Mina rumsbilder")
        ok(not errs, f"{tag} no script errors: {errs[:3]}")
        ctx.close()

    # ------------------------------------------------ live (mocked server): retry, shape, exact products, quality refund
    for W, Hh, mob in ((390, 844, True), (1440, 900, False)):
        tag = f"[live {W}]"
        ctx, pg, errs = new(b, mob, W, Hh)
        room(pg, FOUR)
        pg.evaluate(LIVE, {"stream": True, "retry": True, "wait": 1800})
        create(pg, 900)
        ok(pg.evaluate("document.getElementById('aiTitle').innerText") == "Vi gör ett nytt försök…" and "ingen extra bild" in pg.evaluate("document.querySelector('.ai-wait .ai-lead').innerText"), f"{tag} the retry is said while it happens: {pg.evaluate('document.getElementById(\"aiTitle\").innerText')}")
        shot(pg, f"live-{W}-retry")
        pg.wait_for_timeout(3600)
        call = pg.evaluate("__calls[0]")
        ok("x-ndjson" in call["accept"] and call["body"]["size"]["w"] == pg.evaluate("RQ.room.get().w") and all(s["v"] == 0 for s in call["body"]["scene"]), f"{tag} the request asks for steps, the photo's size and each colour shown")
        rat = pg.evaluate(RATIO)
        ok(rat and abs(rat[0] - rat[2]) / rat[0] < 0.01 and abs(rat[0] - rat[1]) / rat[0] < 0.01, f"{tag} a square answer is cropped to the room photo's shape, not stretched: {rat}")
        ok(pg.evaluate("document.querySelector('.ai-tag-a').innerText") == "RumIQ · AI-bild", f"{tag} the picture is labelled RumIQ · AI-bild")
        ok("nytt försök" in pg.evaluate("document.querySelector('.ai-result .ai-pad').innerText"), f"{tag} the result says a second try was made at no extra cost")
        ok(pg.evaluate("!!document.getElementById('aiBad')") and "1 bild" in pg.evaluate("document.getElementById('aiAgain').innerText"), f"{tag} Produkten blev fel is offered, Skapa igen says it uses one picture")
        # the editor's Byt is there now (room.js R.openSwap): the result offers it (Studio 2, part 6)
        ok(pg.evaluate("typeof RQ.room.openSwap === 'function' && !!document.querySelector('[data-ai-swap]')"), f"{tag} with the editor's Byt (R.openSwap) the result offers Byt produkt")
        shot(pg, f"live-{W}-result")
        # the room changes after the picture: Köp allt still adds exactly what the picture shows
        pg.evaluate("RQ.room.remove('sand-keramikvas'); RQ.room.remove('lin-kuddfodral'); RQ.room.add('glod-doftljus-keramik', true)")
        pg.evaluate("RQ.shop.clearCart()"); pg.wait_for_timeout(200)
        pg.evaluate("document.getElementById('aiBuy').click()"); pg.wait_for_timeout(600)
        if mob:
            tb = pg.evaluate("(() => { const t = document.getElementById('toast').getBoundingClientRect(), x = document.querySelector('#aiSheet .sheet-x').getBoundingClientRect(), b = document.querySelector('.ai-buybar').getBoundingClientRect(); return [t.bottom <= b.top + 1, t.top > x.bottom || t.bottom < x.top]; })()")
            ok(tb[0] and tb[1], f"{tag} the toast after Köp allt sits above the bar, clear of the close button: {tb}")
        ok(pg.evaluate(LINES) == ",".join(sorted(h + "::0" for h in FOUR)), f"{tag} Köp allt adds exactly the four pictured products in the pictured colours: {pg.evaluate(LINES)}")
        pg.evaluate("document.getElementById('aiBad').click()"); pg.wait_for_timeout(500)
        ok("tillbaka på ditt saldo" in pg.evaluate(TOAST) and not pg.evaluate("!!document.getElementById('aiBad')"), f"{tag} Produkten blev fel gives the picture back once")
        # with the editor's Byt: "Prova en annan färg" (things with colours) and "Byt produkt" per thing, opening Byt at that thing
        pg.evaluate("window.__swap = null; RQ.room.openSwap = (h, o) => { window.__swap = [h, !!(o && o.colour)]; }"); pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
        pg.evaluate("RQ.room.saveScene([]); " + "; ".join(f"RQ.room.add('{h}', true)" for h in FOUR))
        pg.evaluate(LIVE, {"stream": False, "wait": 300}); create(pg, 2800)
        sw = pg.evaluate("[document.querySelectorAll('[data-ai-swap]:not([data-colour])').length, [...document.querySelectorAll('[data-ai-swap][data-colour]')].map((b) => b.dataset.aiSwap)]")
        ok(sw[0] == 4 and sw[1] == ["lin-kuddfodral"], f"{tag} with R.openSwap: Byt produkt on every thing, another colour where there are colours: {sw}")
        pg.evaluate("document.querySelector('[data-ai-swap=\"lin-kuddfodral\"][data-colour]').click()"); pg.wait_for_timeout(500)
        ok(pg.evaluate("window.__swap") == ["lin-kuddfodral", True] and not pg.evaluate("document.getElementById('aiSheet').classList.contains('open')"), f"{tag} it closes the picture and opens the editor's Byt at that thing, colours first")
        pg.evaluate("delete RQ.room.openSwap"); pg.evaluate("RQ.room.saveScene([]); " + "; ".join(f"RQ.room.add('{h}', true)" for h in ["lysa-keramiklampa", "plad-ullblandning-havre"]))
        # a server that answers with plain JSON (no steps) works the same
        pg.evaluate(LIVE, {"stream": False, "wait": 500}); pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
        create(pg, 3200)
        ok(pg.evaluate("document.querySelectorAll('.ai-ver').length") == 3 and pg.evaluate("document.querySelector('.ai-tag-a').innerText") == "RumIQ · AI-bild", f"{tag} plain JSON: a second version of the same room")
        pics = pg.evaluate(PICS)
        ok(len(pics) == 3 and pics[0]["items"] != pics[1]["items"], f"{tag} each version remembers its own products")
        ok(not errs, f"{tag} no script errors: {errs[:3]}")
        ctx.close()

    # ------------------------------------------------ a full device: the picture shows, the sheet says it could not be kept
    for W, Hh, mob in ((390, 844, True), (1440, 900, False)):
        tag = f"[full {W}]"
        ctx, pg, errs = new(b, mob, W, Hh)
        room(pg, FOUR[:2])
        pg.evaluate("() => { IDBObjectStore.prototype.put = function () { throw new DOMException('The quota has been exceeded.', 'QuotaExceededError'); }; }")
        create(pg, 3400)
        warn = pg.evaluate("(document.querySelector('.ai-result .ai-warn[role=alert]') || {}).innerText || ''")
        ok("inte plats på enheten" in warn and "Ladda ner" in warn, f"{tag} the device is full: said clearly, with a way out: {warn}")
        ok(pg.evaluate("!!document.querySelector('.ai-result img.after')"), f"{tag} ...and the picture is still shown")
        ok("enheten är full" in pg.evaluate(TOAST) and pg.evaluate("!!document.querySelector('#toast [data-ai-down-now]')"), f"{tag} ...and a toast says it at once, with Ladda ner: {pg.evaluate(TOAST)}")
        with pg.expect_download() as d:
            pg.evaluate("document.querySelector('#toast [data-ai-down-now]').click()")
        ok(d.value.suggested_filename.startswith("rumiq-ai-bild-"), f"{tag} the toast's Ladda ner downloads the picture")
        shot(pg, f"full-{W}")
        ok(not errs, f"{tag} no script errors: {errs[:3]}")
        ctx.close()

    # ------------------------------------------------ the account library (once the founder deploys ai-library)
    ctx, pg, errs = new(b, True, 390, 844)
    room(pg, FOUR[:1]); pg.evaluate(LIVE, {"stream": False})
    pg.evaluate("RQ_CONFIG.studio.serverLibrary = true; RQ.go('mitt-hem')"); pg.wait_for_timeout(1800)
    ok(pg.evaluate("document.querySelectorAll('.ai-lcard').length") == 1 and "privat i ditt konto" in pg.evaluate("document.getElementById('aiLibNote').innerText"), "[server library] the list comes from the account, and the note says so")
    pg.evaluate("document.querySelector('.ai-lcard [data-lib-del]').click()"); pg.wait_for_timeout(400)
    pg.evaluate("document.querySelector('#toast [data-ai-undo]').click()"); pg.wait_for_timeout(8000)
    ok(not any(c["body"].get("action") == "delete" for c in pg.evaluate("__calls")), "[server library] Ångra within the seconds sends no delete to the server")
    ok(not errs, f"[server library] no script errors: {errs[:3]}")
    ctx.close()

    # ------------------------------------------------ limits from config, English, screenshots in evening and the small sizes
    ai = (ROOT / "assets/js/ai.js").read_text(encoding="utf-8"); cfg = (ROOT / "assets/js/config.js").read_text(encoding="utf-8")
    ok("RQ_CONFIG.studio" in ai and not re.search(r"PRICE = 99|PLUS_IMAGES = 100|FREE_IMAGES = 5|högst 30 på", ai), "[config] ai.js reads the limits from config, none typed in the texts")
    ok(re.search(r"studio: \{ freeImages: 5, plusImages: 100, plusPrice: 99, dailyFree: 5, dailyPlus: 30, purchaseBonus: 10", cfg), "[config] config.js holds the founder's numbers")
    ctx, pg, errs = new(b, True, 390, 844)
    # config.js as the founder might change it: 120 images and a daily cap of 40 show on the Studio Plus page
    ctx.add_init_script("Object.defineProperty(window, 'RQ_CONFIG', { configurable: true, get() { return this.__c; }, set(v) { if (v && v.studio) { v.studio.plusImages = 120; v.studio.dailyPlus = 40; } this.__c = v; } })")
    go(pg, "studio-plus", 500)
    txt = pg.evaluate("document.getElementById('view').innerText")
    ok("120 AI-bilder i månaden" in txt and "högst 40 på ett dygn" in pg.evaluate("document.getElementById('view').textContent"), "[config] the Studio Plus page shows the numbers from config")
    ctx.close()

    for W, Hh, mob in ((390, 844, True), (1440, 900, False)):
        ctx, pg, errs = new(b, mob, W, Hh, en=True)
        room(pg, FOUR[:2]); create(pg, 3400)
        txt = pg.evaluate("document.querySelector('.ai-result').innerText")
        ok("What do you think?" in txt and "The image is now in My home" in txt and "Skapa" not in txt and "Sparad" not in txt and "Bilden" not in txt, f"[en {W}] the result sheet is in English: {txt[:200]}")
        go(pg, "mitt-hem", 1500)
        lib = pg.evaluate("document.getElementById('mh-bilder').innerText")
        ok("All images" in lib and "Save my AI images automatically" in lib and "Mina" not in lib and "Spara" not in lib, f"[en {W}] Mina rumsbilder is in English: {lib[:240]}")
        ok(not errs, f"[en {W}] no script errors: {errs[:3]}")
        ctx.close()

    for W, Hh, mob in ((360, 740, True), (1280, 720, False), (390, 844, True), (1440, 900, False)):
        for eve in (False, True):
            if (W in (390, 1440)) and not eve:
                continue  # day at 390 and 1440 is taken above
            ctx, pg, errs = new(b, mob, W, Hh, evening=eve)
            room(pg, FOUR); create(pg, 3600)
            again(pg)
            name = f"{W}{'-kvall' if eve else ''}"
            shot(pg, f"versions-{name}")
            over = pg.evaluate("(() => { const s = document.querySelector('#aiSheet .sheet-in'); return [...s.querySelectorAll('button, a, .ai-ba')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1); }).map((e) => e.id || e.className).slice(0, 3); })()")
            ok(not over, f"[{name}] nothing in the result sheet runs off the screen: {over}")
            go(pg, "mitt-hem", 1500); pg.evaluate("document.getElementById('mh-bilder').scrollIntoView()"); pg.wait_for_timeout(300)
            shot(pg, f"library-{name}")
            over = pg.evaluate("[...document.querySelectorAll('#mh-bilder *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.right > innerWidth + 1; }).map((e) => e.className).slice(0, 3)")
            ok(not over, f"[{name}] nothing in Mina rumsbilder runs off the screen: {over}")
            ok(not errs, f"[{name}] no script errors: {errs[:3]}")
            ctx.close()

    # ------------------------------------------------ axe on the new states
    if AXE.exists():
        src = AXE.read_text()
        RUN = """async (sel) => { const r = await axe.run(sel ? document.querySelector(sel) : document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] }, resultTypes: ['violations'] });
          return r.violations.map((v) => v.id + ': ' + v.nodes.slice(0, 2).map((x) => x.target.join(' ')).join(' | ')); }"""
        for W, Hh, mob in ((390, 844, True), (1440, 900, False)):
            for eve in (False, True):
                ctx, pg, errs = new(b, mob, W, Hh, evening=eve)
                room(pg, FOUR); create(pg, 3600)
                again(pg)
                pg.add_script_tag(content=src)
                v = pg.evaluate(RUN, "#aiSheet")
                ok(not v, f"[axe {W}{' evening' if eve else ''}] the result sheet with versions: {v[:3]}")
                go(pg, "mitt-hem", 1500); pg.add_script_tag(content=src)
                v = pg.evaluate(RUN, "#mh-bilder")
                ok(not v, f"[axe {W}{' evening' if eve else ''}] Mina rumsbilder: {v[:3]}")
                ctx.close()
    else:
        print(f"  (axe-core not found at {AXE}; set AXE=/path/to/axe.min.js to include the axe pass)")

    b.close()

print(f"{n - len(fails)} of {n} checks passed")
sys.exit(1 if fails else 0)
