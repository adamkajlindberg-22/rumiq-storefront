#!/usr/bin/env python3
"""Placera och skapa, the AI side (place ai): "Skapa bilden" makes the picture from the pins (RQ.room.pins()).
While RQ_CONFIG.studio.aiLive is false (today) everyone gets the honest preview of the pins and nothing is sent;
the result says "Köp allt i bilden · total" (exactly those products and colours), "Byt produkt" / "Prova en annan färg"
open in the result and make a new version with the other pins kept, versions, the picture is saved in the room,
"Vad tycker du?" shows the link. With aiLive on, the pins (where, on what, real measurements, scale) go to the server.
Run after `python3 tools/build.py`:  python3 test/place_ai.py"""
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

SET = [{"h": "glob-bordslampa-opalglas", "v": 0}, {"h": "lin-kuddfodral", "v": 0}, {"h": "affisch-linje-ekram", "v": 0}, {"h": "strand-jutematta", "v": 0}]
SENT = "(window.__calls || []).filter((c) => c.url.includes('/functions/v1/generate')).length"
WATCH = """() => { window.__net = []; const real = window.fetch; window.fetch = (u, i) => { if (String(u).includes('/functions/')) window.__net.push(String(u)); return real(u, i); }; }"""


def placed(pg):
    go(pg, "mitt-rum", 900)
    pg.evaluate("(s) => RQ.room.place({ room: 'vardagsrum', items: s })", SET); pg.wait_for_timeout(2600)
    pg.evaluate("RQ.hem.setActive(null)")  # a sample room opened without a room of yours: the picture makes one (review M8)


with sync_playwright() as p:
    b = p.chromium.launch()
    for W, Hh, mob, eve in ((390, 844, True, False), (360, 740, True, True), (1440, 900, False, False), (1280, 720, False, True)):
        tag = f"[place {W}{' evening' if eve else ''}]"
        ctx, pg, errs = new(b, mob, W, Hh, evening=eve)
        placed(pg)
        ok(pg.evaluate("RQ.currentRoute()") == "mitt-rum" and pg.evaluate("!!document.getElementById('plCreate')") and len(pg.evaluate("RQ.room.pins()")) == 4, f"{tag} Placera och skapa is open with four pins")
        pg.evaluate(WATCH)
        pins = pg.evaluate("RQ.room.pins().map((x) => x.h + '::' + (x.v || 0))")
        total = pg.evaluate("RQ.room.pins().reduce((s, x) => s + RQ.byHandle(x.h).price, 0)")
        pg.evaluate("document.getElementById('plCreate').click()"); pg.wait_for_selector(".ai-sheet.open .ai-result", timeout=15000); pg.wait_for_timeout(600)
        txt = pg.evaluate("(document.querySelector('.ai-sheet.open .ai-pad') || {}).innerText || ''")
        ok("Så här blir bilden när AI:n är på." in txt and "Ingenting har skickats" in txt and "Förhandsvisning" in txt, f"{tag} aiLive off: the honest preview of the pins, labelled: {txt[:120]}")
        ok(pg.evaluate("window.__net.length") == 0 and not pg.evaluate("!!document.getElementById('aiOk')"), f"{tag} nothing is sent, no consent asked while the AI is off")
        buy = pg.evaluate("document.getElementById('aiBuy').innerText").replace("\u00a0", " ")
        ok(buy.startswith("Köp allt i bilden · ") and int("".join(ch for ch in buy if ch.isdigit())) == total, f"{tag} Köp allt i bilden · total: {buy} ({total})")
        if mob:
            bb = pg.evaluate("(() => { const b = document.getElementById('aiBuy').getBoundingClientRect(); return [Math.round(b.height), Math.round(b.width)]; })()")
            ok(bb[0] <= 60 and bb[1] >= W - 80, f"{tag} the buy button is one line, full width on a phone: {bb}")
        shot(pg, f"place-{W}-result")
        sv = pg.evaluate("(document.querySelector('.ai-sheet.open .ai-saved') || {}).innerText || ''")
        ok("i Mitt hem, under Vardagsrum" in sv, f"{tag} the saved line says which room the picture is in (review M8): {sv}")
        ok(pg.evaluate("document.querySelector('.ai-sheet.open .ai-tag-a').innerText") == "Förhandsvisning", f"{tag} the picture's label says Förhandsvisning, not Demo (review M7)")
        pg.evaluate("RQ.shop.clearCart(); document.getElementById('aiBuy').click()"); pg.wait_for_timeout(700)
        ok(pg.evaluate("RQ.shop.cartLines().map((l) => l.id).sort().join(',')") == ",".join(sorted(pins)), f"{tag} Köp allt i bilden adds exactly those products and colours")
        pics = pg.evaluate("RQ.aiLib.pics()")
        ok(len(pics) == 1 and pics[0]["roomId"] and pics[0]["roomId"] == pg.evaluate("RQ.hem.activeId()") and pg.evaluate("RQ.hem.rooms().length") == 1, f"{tag} the picture is saved in a room of yours, made from the sample room (review M8)")
        # Byt produkt: alternatives of the same kind right in the result; one tap makes a new version, the other pins stay
        pg.evaluate("document.querySelector('.ai-result [data-ai-swap=\"glob-bordslampa-opalglas\"]:not([data-colour])').click()"); pg.wait_for_timeout(700)
        inview = pg.evaluate("(() => { const b = document.querySelector('.ai-pick').getBoundingClientRect(), box = document.querySelector('.ai-sheet.open .sheet-in').getBoundingClientRect(); return b.top >= box.top - 1 && b.bottom <= box.bottom + 1; })()")
        ok(inview, f"{tag} the choices are scrolled into view (review M6)")
        alts = pg.evaluate("[...document.querySelectorAll('.ai-pick [data-place-to]')].map((b) => b.dataset.placeTo.split('|')[1])")
        ok(len(alts) >= 1 and "glob-bordslampa-opalglas" not in alts and pg.evaluate("document.activeElement && document.activeElement.matches('[data-place-to]')"), f"{tag} Byt produkt opens the alternatives in the result, the focus on the first: {alts}")
        ok(pg.evaluate("getComputedStyle(document.querySelector('.ai-pick-l')).display") == "flex", f"{tag} the alternatives sit in a row")
        pg.evaluate("RQ.shop.clearCart(); document.querySelector('.ai-pick [data-place-to]').click()"); pg.wait_for_timeout(1200); pg.wait_for_selector(".ai-sheet.open .ai-result", timeout=15000); pg.wait_for_timeout(600)
        now = pg.evaluate("RQ.room.pins().map((x) => x.h)")
        ok(alts[0] in now and "glob-bordslampa-opalglas" not in now and all(x["h"] in now for x in SET[1:]) and len(now) == 4, f"{tag} the swap keeps the other pins: {now}")
        ok(pg.evaluate("document.querySelectorAll('.ai-sheet.open [data-ver]').length") == 2 and "Köp allt i bilden" in pg.evaluate("document.getElementById('aiBuy').innerText"), f"{tag} a new version, the result again")
        # Prova en annan färg: the colours of the cushion cover; the chosen colour is in the picture and in Köp allt
        pg.evaluate("document.querySelector('.ai-result [data-ai-swap=\"lin-kuddfodral\"][data-colour]').click()"); pg.wait_for_timeout(300)
        col = pg.evaluate("(document.querySelector('.ai-pick [data-place-to]') || { dataset: {} }).dataset.placeTo")
        ok(col and col.startswith("lin-kuddfodral|lin-kuddfodral|"), f"{tag} Prova en annan färg offers the product's colours: {col}")
        pg.evaluate("document.querySelector('.ai-pick [data-place-to]').click()"); pg.wait_for_timeout(1200); pg.wait_for_selector(".ai-sheet.open .ai-result", timeout=15000); pg.wait_for_timeout(600)
        v = int(col.split("|")[2])
        ok(pg.evaluate("RQ.room.pins().find((x) => x.h === 'lin-kuddfodral').v") == v and pg.evaluate("document.querySelectorAll('.ai-sheet.open [data-ver]').length") == 3, f"{tag} the colour changes in place, a third version")
        pg.evaluate("RQ.shop.clearCart(); document.getElementById('aiBuy').click()"); pg.wait_for_timeout(700)
        ok(f"lin-kuddfodral::{v}" in pg.evaluate("RQ.shop.cartLines().map((l) => l.id).join(',')"), f"{tag} Köp allt i bilden takes the colour shown")
        pg.evaluate("document.getElementById('aiPins').click()"); pg.wait_for_timeout(700)
        ok(pg.evaluate("document.activeElement && document.activeElement.matches('[data-pin]')"), f"{tag} Ändra nålarna gives the focus back to a pin in the photo")
        pg.evaluate("document.getElementById('plCreate').click()"); pg.wait_for_selector(".ai-sheet.open .ai-result", timeout=15000); pg.wait_for_timeout(600)
        # Vad tycker du?: the link on the page
        pg.evaluate("Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })")
        pg.evaluate("document.getElementById('aiShare').click()"); pg.wait_for_timeout(900)
        ok(pg.evaluate("!!document.querySelector('.ai-sheet.open .hem-link input')") and "#delad-f." in pg.evaluate("document.querySelector('.ai-sheet.open .hem-link input').value"), f"{tag} Vad tycker du? shows the room's link on the page")
        small = pg.evaluate("""[...document.querySelectorAll('.ai-sheet.open button, .ai-sheet.open a')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.height && r.bottom > 0 && r.top < innerHeight && (r.width < 44 || r.height < 44) && !e.closest('.ai-vers'); }).map((e) => [e.innerText.trim().slice(0, 20), Math.round(e.getBoundingClientRect().width), Math.round(e.getBoundingClientRect().height)])""")
        ok(not small, f"{tag} every control in the result is 44 px: {small}")
        if AXE.exists():
            pg.add_script_tag(path=str(AXE))
            v_ = pg.evaluate("axe.run(document.querySelector('.ai-sheet.open'), { runOnly: ['wcag2a', 'wcag2aa'] }).then((r) => r.violations.map((x) => x.id + ': ' + x.nodes.length))")
            ok(not v_, f"{tag} axe: the result is clean: {v_}")
        over = pg.evaluate("[document.scrollingElement.scrollWidth, innerWidth]")
        ok(over[0] <= over[1], f"{tag} nothing runs off the screen: {over}")
        ok(not errs, f"{tag} no script errors: {errs[:3]}")
        ctx.close()

    # aiLive on: signed in, the pins go to the server with the room
    for W, Hh, mob in ((390, 844, True), (1440, 900, False)):
        tag = f"[live {W}]"
        ctx, pg, errs = new(b, mob, W, Hh)
        placed(pg)
        pg.evaluate("RQ.shop.signIn('test@example.com', 'Test', 'email')")
        pg.evaluate(LIVE, {"stream": False, "wait": 300})
        pg.evaluate("document.getElementById('plCreate').click()"); pg.wait_for_timeout(3500)
        calls = pg.evaluate("(window.__calls || []).filter((c) => c.url.includes('/functions/v1/generate')).map((c) => c.body)")
        body = calls[0] if calls else {}
        pins = body.get("pins") or []
        ok(len(calls) == 1 and len(pins) == 4 and all(k in pins[0] for k in ("h", "v", "x", "y", "surface", "size", "scale", "name", "tone")), f"{tag} the pins go to the server: {[list(x.keys()) for x in pins[:1]]}")
        ok(body.get("room_info", {}).get("map") == "vardagsrum" and body.get("mode") == "place", f"{tag} with the room's kind and map")
        txt = pg.evaluate("(document.querySelector('.ai-sheet.open .ai-pad') || {}).innerText || ''")
        ok("Ditt rum, med sakerna där du pekade." in txt and "Köp allt i bilden" in txt and "Ingenting har skickats" not in txt, f"{tag} the real picture's result: {txt[:100]}")
        ok(not errs, f"{tag} no script errors: {errs[:3]}")
        ctx.close()
    b.close()

print(f"{n - len(fails)} of {n} checks passed")
sys.exit(1 if fails else 0)
