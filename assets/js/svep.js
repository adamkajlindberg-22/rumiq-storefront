/* RumIQ Svep: swipe your style.
   Right = save to Favourites, left = no thanks, undo = one step back. Into the cart: the bag button, the
   up arrow, or a drag upwards with a mouse. A finger moving up or down always scrolls the page, so on
   touch screens there is no swipe-up (it used to put things in the cart when someone only scrolled).
   One engine (runDeck) drives three decks:
   - Svep: rounds of 10 cards that learn while you swipe, for the whole shop or one room (#svep-rum-<id>).
   - The three-card taster on the home page, which carries on into Svep where it stopped.
   - Svep tillsammans (#svep-ihop): two people swipe the same cards through a shared link and see what
     they both like. The link carries the cards and the answers, nothing is stored on a server.
   Also here: the style picture to share, "Kommer snart" cards that ask whether RumIQ should take in a
   candidate product, the small Svep nudges used on empty pages, and anonymous swipe counts. The counts
   are sent only with consent to statistics and only hold the product, the choice and a random id that
   lives as long as the page. Loaded after flow.js (needs RQ.taste, RQ.addMany, RQ.sheet). */
(function () {
  const RQ = window.RQ, S = RQ.shop, V = RQ.views, $ = RQ.$, $$ = RQ.$$, esc = RQ.esc, kr = S.kr, ICO = RQ.ICO5;
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ls = S.store; // the shop's one typed reader (commerce.js)
  const ss = {
    get(k, d) { try { const v = sessionStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { sessionStorage.removeItem(k); } catch (e) {} },
  };
  const hex2rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const hash = (s) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
  const tr = (s) => (window.RQ_LANG === "en" && window.RQ_EN && window.RQ_EN.dict[s]) || s;
  const ROUND = 10, HOME_CARDS = 3, MAXV = 3;
  const SV = {
    bag: '<svg viewBox="0 0 24 24"><path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></svg>',
    undo: '<svg viewBox="0 0 24 24"><path d="M9 7L4 12l5 5"/><path d="M4 12h10a6 6 0 0 1 0 12h-2" transform="translate(0 -6)"/></svg>',
    share: '<svg viewBox="0 0 24 24"><path d="M12 15V4M8 8l4-4 4 4"/><path d="M5 13v6h14v-6"/></svg>',
    two: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><circle cx="16.5" cy="9.5" r="2.4"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0M14.5 19a4.3 4.3 0 0 1 6.5-3.6"/></svg>',
    link: '<svg viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  };

  /* ---------------------------------------------------------------- anonymous swipe counts */
  const sid = Math.random().toString(36).slice(2, 10);
  const stat = (item, choice, ctx) => {
    const c = S.consent && S.consent(); if (!c || !c.stats) return;
    if (location.protocol === "file:" || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return;
    const cfg = window.RQ_CONFIG || {}, a = cfg.auth || {}; if (cfg.swipeStats === false || !a.supabaseUrl || !a.supabaseAnonKey) return;
    try {
      fetch(`${a.supabaseUrl}/rest/v1/swipe_events`, { method: "POST", keepalive: true, headers: { apikey: a.supabaseAnonKey, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ item: String(item).slice(0, 80), choice, ctx: String(ctx || "svep").slice(0, 40), sid }) }).catch(() => {});
    } catch (e) {}
  };

  /* ---------------------------------------------------------------- the cards */
  const inScope = (p, scope) => !scope || p.rooms.includes(scope);
  // the next cards: a varied opener, then the best match with every fourth card from somewhere else
  const upcoming = (t, skip, n, step, scope) => {
    const left = RQ.PRODUCTS.filter((p) => inScope(p, scope) && !(p.handle in t.seen) && !skip.has(p.handle));
    const out = [];
    while (out.length < n && left.length) {
      const k = step + out.length; let pick;
      if (t.likes < 2 || k % 4 === 3) { // explore: a category not seen lately, in a stable order
        const recent = new Set(out.map((p) => p.cat));
        const pool = left.filter((p) => !recent.has(p.cat)); const from = pool.length ? pool : left;
        pick = from.sort((a, b) => hash(a.handle + k) - hash(b.handle + k))[0];
      } else pick = left.sort((a, b) => RQ.taste.score(b, t) - RQ.taste.score(a, t))[0];
      out.push(pick); left.splice(left.indexOf(pick), 1);
    }
    return out;
  };
  // "Kommer snart": one candidate product per round asks whether we should take it in (votes as on #rosta)
  const soonWrap = (c) => ({ soon: c, handle: "soon:" + c.id });
  const nextSoon = () => { const s = ls.get("rumiq-soon", {}); const c = RQ.CANDIDATES.find((x) => !(x.id in s)); return c ? soonWrap(c) : null; };
  const resolve = (h) => (h.startsWith("soon:") ? (RQ.CANDIDATES.find((c) => "soon:" + c.id === h) ? soonWrap(RQ.CANDIDATES.find((c) => "soon:" + c.id === h)) : null) : RQ.byHandle(h));

  const svImgs = (p) => [{ src: RQ.img(p, 900), set: `${RQ.img(p, 600)} 600w, ${RQ.img(p, 900)} 900w`, alt: p.name }, { src: `assets/img/d/${p.handle}-1200.webp`, set: `assets/img/d/${p.handle}-600.webp 600w, assets/img/d/${p.handle}-1200.webp 1200w`, alt: `${p.name}, detalj` }];
  const stamps = (yes, up) => `<span class="sv-stamp yes" aria-hidden="true">${yes}</span><span class="sv-stamp no" aria-hidden="true">Nej tack</span><span class="sv-stamp up" aria-hidden="true">${up}</span>`;
  const svCard = (p, i, why) => `<article class="sv-card" data-h="${p.handle}" data-img="0" style="--i:${i}" aria-hidden="${i ? "true" : "false"}">
      <div class="sv-ims">${svImgs(p).map((m, k) => `<img class="${k ? "" : "on"}" src="${m.src}" srcset="${m.set}" sizes="(min-width:900px) 26rem, 88vw" alt="${esc(m.alt)}" draggable="false" ${i > 1 || k ? 'loading="lazy"' : ""}>`).join("")}</div>
      ${!i && RQ.film && RQ.film(p) ? `<video class="sv-film" src="${RQ.film(p)}" muted playsinline loop autoplay preload="metadata" aria-hidden="true"></video>` : ""}
      ${!i && RQ.LAMPS && RQ.LAMPS.includes(p.handle) ? `<img class="sv-off" src="assets/img/p/${p.handle}-off-1400.webp" alt="" aria-hidden="true" draggable="false" onerror="this.remove()">` : ""}
      <div class="sv-dots" aria-hidden="true"><i class="on"></i><i></i></div>
      ${why ? `<span class="sv-why">${esc(why)}</span>` : ""}
      ${stamps("Spara", "I varukorgen")}
      <div class="sv-info"><div><b>${esc(p.name)}</b><span>${kr(p.price)}</span></div><small>${p.rooms.slice(0, 3).map((r) => `<span>${esc(RQ.roomById(r).name)}</span>`).join(" · ")}</small></div>
    </article>`;
  const svSoon = (c, i) => `<article class="sv-card soon" data-h="soon:${c.id}" style="--i:${i};--tone:${c.tone}" aria-hidden="${i ? "true" : "false"}">
      <div class="sv-soon"><span class="sv-soon-tag">Kommer snart?</span>${c.img ? `<img class="sv-soon-img" src="${c.img}" alt="${esc(c.name)}" draggable="false">` : `<span class="sv-soon-sw" aria-hidden="true"></span>`}<b>${esc(c.name)}</b><p>${esc(c.line)}</p>
        <small><span class="sv-soon-why">Vi har inget eget lager, så vi kan fråga först.</span> <span>Svep höger om du vill att vi tar in den.</span></small></div>
      ${stamps("Ja tack", "Ja tack")}
    </article>`;

  const STYLE_KEYS = ["skandinavisk", "minimalistisk", "klassisk", "mjuk"];
  const nearestTone = (hex) => { const c = hex2rgb(hex); return RQ.TONES.reduce((b, x) => (dist(hex2rgb(x.hex), c) < dist(hex2rgb(b.hex), c) ? x : b)); };
  // the style profile: share of each style, a palette from what you liked, the look that fits best
  RQ.styleProfile = (t = RQ.taste.get()) => {
    const pos = STYLE_KEYS.map((k) => [k, Math.max(0, t.styles[k] || 0)]), sum = pos.reduce((s, e) => s + e[1], 0);
    const mix = sum ? pos.map(([k, v]) => ({ id: k, name: RQ.STYLES[k].name, pct: Math.round((v / sum) * 100) })).sort((a, b) => b.pct - a.pct) : [];
    const likedH = Object.keys(t.seen).filter((h) => t.seen[h] > 0 && RQ.byHandle(h));
    const tones = []; likedH.forEach((h) => { const n = nearestTone(RQ.byHandle(h).tone[0]); if (!tones.some((x) => x.id === n.id)) tones.push(n); });
    const look = RQ.LOOKS.map((l) => ({ l, s: l.items.reduce((a, h) => a + RQ.taste.score(RQ.byHandle(h), t), 0) / l.items.length })).sort((a, b) => b.s - a.s)[0];
    return { mix, tones: tones.slice(0, 6), look: sum ? look.l : null, liked: likedH };
  };

  /* ---------------------------------------------------------------- deck markup and engine */
  const deckHtml = (px, compact) => `<div class="sv-wrap${compact ? " compact" : ""}">
      <div class="sv-prog" aria-hidden="true"><i id="${px}Bar"></i></div>
      <p class="sv-meta"><span id="${px}Count"></span><span class="sv-chip" id="${px}Chip" hidden></span></p>
      <div class="sv-deck" id="${px}Deck" aria-live="polite"></div>
      <div class="sv-ctrl" id="${px}Ctrl">
        ${compact ? "" : `<button class="sv-b undo" type="button" id="${px}Undo" aria-label="Ångra senaste" title="Ångra senaste" disabled>${SV.undo}</button>`}
        <button class="sv-b no" type="button" id="${px}No" aria-label="Nej tack" title="Nej tack">${ICO.x}</button>
        ${compact ? "" : `<button class="sv-b room" type="button" id="${px}Room" aria-label="Ställ in i mitt rum" title="Ställ in i mitt rum">${RQ.roomIco}</button>`}
        <button class="sv-b bag" type="button" id="${px}Bag" aria-label="Lägg i varukorgen" title="Lägg i varukorgen">${SV.bag}</button>
        <button class="sv-b yes" type="button" id="${px}Yes" aria-label="Spara" title="Spara">${ICO.heart}</button>
      </div>
      ${compact ? "" : `<p class="small sv-keys">Piltangenter: höger sparar, vänster hoppar över, uppåt lägger i varukorgen. Backsteg ångrar.</p>`}
    </div>`;

  // cfg: px, ctx (for the counts), total(st, t), next(st, t, skip, n) -> cards, why(p, t), keys, hint, onFinish(st, deckEl), start
  function runDeck(root, cfg) {
    const el = (n) => $(`#${cfg.px}${n}`, root);
    const deckEl = el("Deck");
    const st0 = cfg.start || {};
    const st = { done: [...(st0.done || [])], answers: { ...(st0.answers || {}) }, saved: [...(st0.saved || [])], bagged: [...(st0.bagged || [])], forced: [], history: [], over: false, soonDone: !!st0.soonDone };
    let stack = [], busy = false, queue = [];
    const cards = () => $$(".sv-card", deckEl);
    const topCard = () => cards().pop();
    const paint = () => {
      const t = RQ.taste.get(), front = st.forced.map(resolve).filter(Boolean);
      const skip = new Set([...st.done, ...st.forced]);
      stack = [...front, ...cfg.next(st, t, skip, 3 - front.length)].slice(0, 3);
      const total = cfg.total(st, t);
      if (!stack.length || st.done.length >= total) return finish();
      deckEl.innerHTML = stack.map((it, k) => (it.soon ? svSoon(it.soon, k) : svCard(it, k, k || !cfg.why ? "" : cfg.why(it, t)))).reverse().join("");
      const c = el("Count"); if (c) c.textContent = `${st.done.length + 1} av ${total}`;
      const b = el("Bar"); if (b) b.style.width = `${(st.done.length / total) * 100}%`;
      const room = el("Room"), first = stack[0];
      if (room) { room.disabled = !!first.soon; if (first.soon) delete room.dataset.roomBtn; else { room.dataset.roomBtn = first.handle; room.setAttribute("aria-pressed", !!(RQ.room && RQ.room.inScene(first.handle))); } }
      const bag = el("Bag"); if (bag) bag.disabled = !!first.soon; // a "Kommer snart" card cannot be bought
      const u = el("Undo"); if (u) u.disabled = !st.history.length;
      const top = RQ.taste.top(t)[0], chip = el("Chip");
      if (chip && t.n >= 5 && top) { chip.hidden = false; chip.textContent = `Din stil växer fram: ${RQ.STYLES[top].name}`; }
      if (cfg.hint !== false && !t.n && !st.done.length && !reduced()) { const tc = topCard(); tc && tc.classList.add("hint"); }
    };
    const finish = () => {
      if (st.over) return; st.over = true;
      ["Ctrl", "Count", "Chip"].forEach((n) => { const x = el(n); if (x) x.hidden = true; });
      const pr = $(".sv-prog", deckEl.parentNode); if (pr) pr.hidden = true;
      const mt = $(".sv-meta", deckEl.parentNode); if (mt) mt.hidden = true;
      const k = $(".sv-keys", deckEl.parentNode); if (k) k.hidden = true;
      cfg.onFinish(st, deckEl);
    };
    const flash = (c, cls) => { const s = $(`.sv-stamp.${cls}`, c); if (s) s.style.opacity = 1; };
    const decide = (dir, c0) => {
      if (st.over) return;
      // a key or a tap while the last card is still flying out waits its turn instead of being dropped
      if (busy) { if (!c0 && queue.length < 3) queue.push(dir); return; }
      const c = c0 || topCard(); if (!c) return;
      if (dir === 2 && c.classList.contains("soon")) dir = 1;
      busy = true; const h = c.dataset.h, isSoon = h.startsWith("soon:");
      const rec = { h, dir, before: JSON.stringify(RQ.taste.get()), wish: false, bag: false, soon: isSoon ? JSON.stringify([ls.get("rumiq-soon", {}), ls.get("rumiq-votes", [])]) : null };
      if (isSoon) {
        const id = h.slice(5), s = ls.get("rumiq-soon", {}); s[id] = dir === -1 ? 0 : 1; ls.set("rumiq-soon", s);
        if (dir !== -1) { const v = ls.get("rumiq-votes", []); if (!v.includes(id) && v.length < MAXV) ls.set("rumiq-votes", [...v, id]); }
        st.soonDone = true;
      } else if (dir === 1) { if (!S.isWished(h)) { S.toggleWish(h); rec.wish = true; } RQ.taste.add(h, 1); st.saved.push(h); }
      else if (dir === 2) { S.addToCart(h + "::0", 1); rec.bag = true; RQ.taste.add(h, 1.5); st.bagged.push(h); RQ.fly && RQ.fly($(".sv-ims img.on", c)); }
      else RQ.taste.add(h, -0.5);
      st.answers[h] = dir === -1 ? 0 : dir;
      const choice = dir === 1 ? "save" : dir === 2 ? "cart" : "skip";
      RQ.track && RQ.track("swipe", { item_id: h, choice });
      stat(h, choice, cfg.ctx);
      if (navigator.vibrate) try { navigator.vibrate(8); } catch (e) {}
      st.history.push(rec); st.forced = st.forced.filter((x) => x !== h); st.done.push(h);
      cfg.onDecide && cfg.onDecide(st);
      const next = () => { busy = false; paint(); if (queue.length && !st.over) decide(queue.shift()); else queue = []; };
      if (reduced()) return next();
      flash(c, dir === 1 ? "yes" : dir === 2 ? "up" : "no");
      c.style.transition = "transform .26s cubic-bezier(.3,.6,.2,1), opacity .26s";
      c.style.transform = dir === 2 ? "translate(0,-120%) scale(.9)" : `translate(${dir * 130}%, -4%) rotate(${dir * 18}deg)`; c.style.opacity = 0;
      setTimeout(next, 210);
    };
    const undo = () => {
      queue = [];
      if (busy || st.over || !st.history.length) return;
      const r = st.history.pop(); ls.set("rumiq-taste", JSON.parse(r.before));
      if (r.soon) { const [s, v] = JSON.parse(r.soon); ls.set("rumiq-soon", s); ls.set("rumiq-votes", v); st.soonDone = false; }
      if (r.wish && S.isWished(r.h)) S.toggleWish(r.h);
      if (r.bag) { const line = S.cartLines().find((l) => l.id === r.h + "::0"); if (line) S.setQty(line.id, line.quantity - 1); }
      st.saved = st.saved.filter((x) => x !== r.h); st.bagged = st.bagged.filter((x) => x !== r.h); delete st.answers[r.h];
      st.done = st.done.filter((x) => x !== r.h); st.forced = [r.h, ...st.forced]; paint();
      const c = topCard(); if (c && !reduced()) c.animate([{ transform: "translate(0,-30px) scale(.96)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 320, easing: "ease-out" });
    };
    const flip = (c, d) => {
      const ims = $$(".sv-ims img", c), dots = $$(".sv-dots i", c), cur = +c.dataset.img, nx = Math.max(0, Math.min(ims.length - 1, cur + d));
      if (!ims.length || nx === cur) { c.animate([{ transform: `translateX(${d * 6}px)` }, { transform: "none" }], { duration: 180 }); return; }
      ims.forEach((im, k) => im.classList.toggle("on", k === nx)); dots.forEach((x, k) => x.classList.toggle("on", k === nx)); c.dataset.img = nx;
    };
    // drag: sideways = save or skip; upwards = cart, with a mouse or pen only (a finger moving up scrolls the page).
    // A tap on the edges flips the picture, in the middle it opens the product.
    let drag = null, lastX = 0, tapped = null;
    const down = (e) => { tapped = null; const c = e.target.closest(".sv-card"); if (!c || c !== topCard() || busy) return; c.classList.remove("hint"); drag = { c, x: e.clientX, y: e.clientY, t: performance.now(), dx: 0, dy: 0, touch: e.pointerType === "touch" }; c.setPointerCapture && c.setPointerCapture(e.pointerId); c.style.transition = "none"; };
    const back = (c) => { c.style.transition = "transform .45s var(--spring)"; c.style.transform = ""; $$(".sv-stamp", c).forEach((s) => (s.style.opacity = 0)); };
    const move = (e) => {
      if (!drag) return; drag.dx = e.clientX - drag.x; drag.dy = e.clientY - drag.y; const { c, dx, dy } = drag;
      const upish = !drag.touch && dy < 0 && Math.abs(dy) > Math.abs(dx);
      c.style.transform = `translate(${dx}px, ${upish ? dy : drag.touch ? 0 : dy * 0.25}px) rotate(${upish ? 0 : dx / 18}deg)`;
      const kx = Math.min(1, Math.abs(dx) / 110), ky = Math.min(1, -dy / 120);
      $(".sv-stamp.yes", c).style.opacity = !upish && dx > 0 ? kx : 0; $(".sv-stamp.no", c).style.opacity = !upish && dx < 0 ? kx : 0; $(".sv-stamp.up", c).style.opacity = upish ? ky : 0;
    };
    // the browser took the gesture (page scroll) or the pointer was lost: nothing is decided, the card goes back
    const cancel = () => { if (!drag) return; const c = drag.c; drag = null; back(c); };
    const up = () => {
      if (!drag) return; const { c, dx, dy, t, touch } = drag; drag = null;
      const ms = Math.max(1, performance.now() - t), vx = Math.abs(dx) / ms, vy = -dy / ms, w = c.offsetWidth, hgt = c.offsetHeight;
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) {
        c.style.transform = ""; if (c.classList.contains("soon")) return;
        const r = c.getBoundingClientRect(), x = (lastX - r.left) / r.width;
        if (x < 0.3) return flip(c, -1); if (x > 0.7) return flip(c, 1);
        tapped = c; return; // opened by the click that follows: opening here let that click close the sheet again on phones
      }
      const sideways = Math.abs(dx) >= Math.abs(dy);
      if (sideways && (Math.abs(dx) > w * 0.3 || (vx > 0.6 && Math.abs(dx) > 24))) return decide(dx > 0 ? 1 : -1, c);
      if (!touch && !sideways && dy < 0 && (-dy > hgt * 0.22 || vy > 0.6)) return decide(2, c);
      back(c);
    };
    const pdown = (e) => { lastX = e.clientX; down(e); }, pup = (e) => { lastX = e.clientX; up(); };
    const tap = (e) => { const c = tapped; tapped = null; if (c && c === topCard() && e.target.closest(".sv-card") === c && !RQ.sheet.isOpen()) RQ.sheet.open(c.dataset.h, { from: c }); };
    deckEl.addEventListener("pointerdown", pdown); deckEl.addEventListener("click", tap); addEventListener("pointermove", move); addEventListener("pointerup", pup); addEventListener("pointercancel", cancel);
    const on = (n, f) => { const b = el(n); if (b) b.addEventListener("click", f); };
    on("No", () => decide(-1)); on("Yes", () => decide(1)); on("Bag", () => decide(2)); on("Undo", undo);
    const key = (e) => {
      if (st.over || e.target.closest("input,textarea,select") || RQ.sheet.isOpen() || document.querySelector(".drawer.open, #search.open, #mnav.open, dialog[open], .sheet.open")) return;
      if (e.key === "ArrowRight") { e.preventDefault(); decide(1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); decide(-1); }
      if (e.key === "ArrowUp") { e.preventDefault(); decide(2); }
      if (e.key === "Backspace" || (e.key === "z" && (e.metaKey || e.ctrlKey))) { e.preventDefault(); undo(); }
    };
    if (cfg.keys) addEventListener("keydown", key);
    if (cfg.finished) finish(); else paint();
    return () => { removeEventListener("pointermove", move); removeEventListener("pointerup", pup); removeEventListener("pointercancel", cancel); removeEventListener("keydown", key); };
  }

  /* ---------------------------------------------------------------- the style picture */
  const loadImg = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  RQ.styleImage = async (prof, liked) => {
    const W = 1080, H = 1920, cv = document.createElement("canvas"); cv.width = W; cv.height = H; const x = cv.getContext("2d");
    try { await document.fonts.ready; } catch (e) {}
    const F = (w, s) => `${w} ${s}px "Familjen Grotesk", system-ui, sans-serif`;
    x.fillStyle = "#EDEDEA"; x.fillRect(0, 0, W, H);
    x.fillStyle = "#22252A"; x.font = F(500, 52); x.textBaseline = "alphabetic"; x.fillText("RumIQ", 90, 160);
    x.fillStyle = "#696B68"; x.font = F(600, 34); x.fillText(tr("Min stil").toUpperCase(), 90, 330);
    const st = prof.mix.filter((m) => m.pct >= 25).slice(0, 2);
    x.fillStyle = "#22252A"; x.font = F(600, 112);
    const lines = st.length === 2 ? [st[0].name, `${tr("och")} ${st[1].name}`] : st.length ? [st[0].name] : [tr("Vi lär oss fortfarande")];
    lines.forEach((l, i) => { let s = 112; while (x.measureText(tr(l)).width > W - 180 && s > 60) { s -= 4; x.font = F(600, s); } x.fillText(tr(l), 90, 470 + i * 124); x.font = F(600, 112); });
    let y = 470 + lines.length * 124 + 90;
    prof.mix.forEach((m) => {
      x.fillStyle = "#22252A"; x.font = F(500, 40); x.fillText(tr(m.name), 90, y + 14);
      x.fillStyle = "rgba(34,37,42,.12)"; x.beginPath(); x.roundRect(560, y - 8, 330, 22, 11); x.fill();
      x.fillStyle = "#2F4A3A"; x.beginPath(); x.roundRect(560, y - 8, Math.max(22, 330 * m.pct / 100), 22, 11); x.fill();
      x.fillStyle = "#22252A"; x.font = F(600, 40); x.textAlign = "right"; x.fillText(`${m.pct} %`, 990, y + 14); x.textAlign = "left";
      y += 86;
    });
    if (prof.tones.length) {
      y += 50; x.fillStyle = "#696B68"; x.font = F(600, 30); x.fillText(tr("Mina färger").toUpperCase(), 90, y); y += 40;
      prof.tones.slice(0, 5).forEach((t, i) => { const cx = 140 + i * 190; x.fillStyle = t.hex; x.beginPath(); x.arc(cx, y + 60, 56, 0, Math.PI * 2); x.fill(); x.strokeStyle = "rgba(34,37,42,.15)"; x.lineWidth = 2; x.stroke();
        x.fillStyle = "#22252A"; x.font = F(500, 30); x.textAlign = "center"; x.fillText(tr(t.name), cx, y + 160); x.textAlign = "left"; });
      y += 200;
    }
    const picks = liked.slice(0, 3);
    if (picks.length) {
      const sz = 280, gap = 30; y = Math.min(Math.max(y + 40, 1340), H - 210 - sz);
      const ims = await Promise.all(picks.map((p) => loadImg(RQ.cut(p))));
      picks.forEach((p, i) => {
        const px = 90 + i * (sz + gap); x.fillStyle = "#F7F7F4"; x.beginPath(); x.roundRect(px, y, sz, sz, 28); x.fill();
        const im = ims[i]; if (im) { const k = Math.min((sz - 50) / im.width, (sz - 50) / im.height), w = im.width * k, h = im.height * k; x.drawImage(im, px + (sz - w) / 2, y + (sz - h) / 2, w, h); }
      });
    }
    x.fillStyle = "#22252A"; x.font = F(500, 40); x.fillText(tr("Svep fram din egen stil på RumIQ"), 90, H - 120);
    return new Promise((res) => cv.toBlob((b) => res(b), "image/png"));
  };
  const shareStyle = async (st, liked) => {
    const prof = RQ.styleProfile(), url = new URL("svep/", document.baseURI).href;
    const txt = `${tr("Min stil på RumIQ")}: ${st.map((s) => `${tr(s.name)} ${s.pct} %`).join(", ")}.`;
    let blob = null; try { blob = await RQ.styleImage(prof, liked); } catch (e) {}
    const file = blob && typeof File === "function" ? new File([blob], "min-stil-rumiq.png", { type: "image/png" }) : null;
    try {
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: tr("Min stil på RumIQ"), text: `${txt} ${url}` }); return; }
      if (blob) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "min-stil-rumiq.png"; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
      let copied = false; try { await navigator.clipboard.writeText(`${txt} ${url}`); copied = true; } catch (e) {}
      RQ.toast(blob ? (copied ? "Bilden är sparad och länken kopierad." : "Bilden är sparad.") : copied ? "Länken är kopierad." : "Det gick inte att dela härifrån. Kopiera adressen i webbläsaren i stället.");
    } catch (e) {}
  };

  /* ---------------------------------------------------------------- Svep tillsammans: link format
     #svep-ihop-<answers>[_<answers>].<handle>.<handle>…[~<name>[_<name>]]   answers: 1 = likes, 0 = not */
  const cleanName = (s) => String(s || "").replace(/[^\p{L}\p{M} '-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 24);
  const twoLink = (hs, a, b, na, nb) => {
    const names = [cleanName(na), cleanName(nb)];
    const tail = names[0] || names[1] ? "~" + names[0] + (b ? "_" + names[1] : "") : "";
    return new URL("svep-ihop/", document.baseURI).href + "#svep-ihop-" + encodeURIComponent(`${a}${b ? "_" + b : ""}.${hs.join(".")}${tail}`).replace(/%7E/gi, "~");
  };
  const parseTwo = (raw) => {
    if (!raw) return null;
    const [core, names = ""] = raw.split("~"), parts = core.split("."), ans = (parts[0] || "").split("_"), hs = parts.slice(1);
    if (!hs.length || hs.length > 30 || ans.length > 2 || ans.some((a) => !/^[01]+$/.test(a) || a.length !== hs.length) || hs.some((h) => !RQ.byHandle(h))) return null;
    const nm = names.split("_").map(cleanName);
    return { hs, a: ans[0], b: ans[1] || null, na: nm[0] || "", nb: nm[1] || "" };
  };
  const shareLink = async (url, title, text) => {
    try { if (navigator.share) { await navigator.share({ title, text, url }); return "shared"; } } catch (e) { if (e && e.name === "AbortError") return "aborted"; }
    try { await navigator.clipboard.writeText(url); RQ.toast("Länken är kopierad."); return "copied"; } catch (e) { return "shown"; }
  };
  // a small form: optional name, then share the link (or show it to copy by hand)
  const linkForm = (id, label, btn) => `<form class="sv-linkf" id="${id}" novalidate><label for="${id}N">${label}</label>
      <div class="field"><input id="${id}N" name="n" maxlength="24" autocomplete="given-name" placeholder="Till exempel Anna"><button class="btn sm" type="submit">${SV.link}<span>${btn}</span></button></div>
      <input class="sv-linkout" type="text" readonly hidden aria-label="Länken"></form>`;
  const bindLinkForm = (f, make, title, text) => f && f.addEventListener("submit", async (e) => {
    e.preventDefault(); const url = make(f.n.value), out = $(".sv-linkout", f);
    out.value = url; out.hidden = false; out.select && out.select();
    await shareLink(url, title, text);
    RQ.track && RQ.track("svep_together_link", {});
  });

  // put things in Mitt rum and go there; without a room the set-up sheet comes first, so nobody lands on an empty page
  const toRoom = (hs) => {
    const R = RQ.room; if (!R) return;
    const put = () => { hs.forEach((h) => R.add(h, true)); location.hash = "#mitt-rum"; };
    if (R.has()) put(); else R.openSetup(put);
  };

  /* ---------------------------------------------------------------- Svep (the full page) */
  const roundAnswers = (st) => { const hs = st.done.filter((h) => !h.startsWith("soon:") && RQ.byHandle(h)); return { hs, a: hs.map((h) => ((st.answers[h] || 0) > 0 ? 1 : 0)).join("") }; };
  const savedTiles = (list) => `<div class="sv-liked">${list.map((p) => `<button type="button" data-sheet="${p.handle}"><img src="${RQ.cut(p)}" alt=""><span>${esc(p.name)}</span><small>${kr(p.price)}</small></button>`).join("")}</div>`;
  const resultHtml = (st, scope) => {
    const t = RQ.taste.get(), prof = RQ.styleProfile(t), top = prof.mix.filter((m) => m.pct >= 25).slice(0, 2);
    const more = RQ.PRODUCTS.some((p) => inScope(p, scope) && !(p.handle in t.seen));
    const room = scope ? RQ.roomById(scope) : null;
    // nothing left to swipe and no round behind us: say so, instead of a result that appears from nowhere
    const allDone = !more ? `<p class="sv-alldone">${room ? `<span>Du har svept alla kort för</span> <span>${esc(room.name.toLowerCase())}</span>.` : "Du har svept alla kort i butiken."}${room ? ` <a href="#svep">Svep hela butiken</a>` : ""}</p>` : "";
    const saved = st.saved.map(RQ.byHandle).filter(Boolean), ra = roundAnswers(st);
    return { top, saved, html: `<div class="svep-result" tabindex="-1">
      <span class="eyebrow">Din stilprofil</span>
      <h2 class="h2">${top.length ? top.map((s) => `<span>${esc(s.name)}</span>`).join(" <span>och</span> ") : "Vi lär oss fortfarande"}</h2>
      <p class="lead">${top.length ? esc(RQ.STYLES[top[0].id].text) : "Spara några saker du gillar, så kan butiken sortera efter dig."}</p>
      ${allDone}
      ${prof.mix.length ? `<div class="sp-grid"><div class="sp-mix" aria-label="Din stil i procent">${prof.mix.map((m) => `<div class="sp-row"><span>${esc(m.name)}</span><span class="sp-bar"><i style="width:${m.pct}%"></i></span><b>${m.pct} %</b></div>`).join("")}</div>
        ${prof.tones.length ? `<div class="sp-tones"><span class="eyebrow">Dina färger</span><div>${prof.tones.map((x) => `<span class="sp-tone"><i style="background:${x.hex}"></i>${esc(x.name)}</span>`).join("")}</div></div>` : ""}</div>` : ""}
      ${saved.length ? `<div class="sp-saved"><span class="eyebrow">Sparat i den här rundan · ${saved.length}</span>${savedTiles(saved)}
        <div class="ctrl-row sp-acts"><button class="btn" type="button" id="svAll">Lägg alla i varukorgen · ${kr(saved.reduce((s, p) => s + p.price, 0))}</button><button class="btn ghost" type="button" id="svRoomAll">${RQ.roomIco}<span>Se dem i ditt rum</span></button></div>
        ${RQ.priceWatch ? RQ.priceWatch.html(saved.map((p) => p.handle), "svw") : ""}</div>` : ""}
      ${st.bagged.length ? `<p class="small">${st.bagged.length} ${st.bagged.length === 1 ? "vara ligger" : "varor ligger"} redan i varukorgen. <a href="#kassa">Till kassan</a></p>` : ""}
      ${prof.look ? `<a class="sp-look" href="#look-${prof.look.id}"><span class="sp-look-ims">${prof.look.items.slice(0, 4).map((h) => `<img src="${RQ.cut(RQ.byHandle(h))}" alt="">`).join("")}</span><span><span class="eyebrow">En look för dig</span><b>${esc(prof.look.name)}</b><small>${esc(prof.look.lead)}</small></span></a>` : ""}
      ${ra.hs.length >= 3 ? `<div class="sp-two"><span class="sp-two-ic" aria-hidden="true">${SV.two}</span><div class="sp-two-tx"><b>Inreder ni tillsammans?</b><p>Skicka samma kort till någon. När ni båda har svept ser ni vad ni gillar gemensamt.</p>
        ${linkForm("svTwo", "Ditt namn, om du vill", "Skicka korten")}</div></div>` : ""}
      <div class="ctrl-row" style="margin-top:.6rem;justify-content:center">${more ? `<button class="btn" type="button" id="svMore">Svep tio till</button>` : ""}<a class="btn ghost" href="#for-dig">Butiken för dig</a>${top.length ? `<button class="btn ghost" type="button" id="svShare">${SV.share}<span>Dela min stil</span></button>` : ""}</div>
      <button class="tlink" type="button" id="svAgain">Börja om från början</button><p class="small" id="svAgainNote" role="status"></p></div>` };
  };
  const scopeNav = (scope) => `<nav class="sv-scope" aria-label="Vad vill du svepa?"><a class="chip" href="#svep"${scope ? "" : ' aria-current="true"'}>Hela butiken</a>${RQ.ROOMS.map((r) => `<a class="chip" href="#svep-rum-${r.id}"${scope === r.id ? ' aria-current="true"' : ""}>${esc(r.name)}</a>`).join("")}</nav>`;
  const legend = `<ul class="sv-legend">
      <li><kbd aria-hidden="true">→</kbd><div><b>Spara</b><span>Hamnar under Sparat och lär oss din stil.</span></div></li>
      <li><kbd aria-hidden="true">←</kbd><div><b>Hoppa över</b><span>Du får se mindre av sådant framöver.</span></div></li>
      <li><kbd aria-hidden="true">↑</kbd><div><b>Lägg i varukorgen</b><span>Direkt, utan att lämna svepet. Väskan under kortet gör samma sak.</span></div></li>
      <li><kbd aria-hidden="true">⌫</kbd><div><b>Ångra</b><span>Ändrade du dig? Backa ett steg.</span></div></li>
    </ul>`;
  // a room with fewer cards left than a full round: how many there are (0 = a normal round of ten)
  const roomLeft = (scope) => { if (!scope) return 0; const t = RQ.taste.get(), n = RQ.PRODUCTS.filter((p) => inScope(p, scope) && !(p.handle in t.seen)).length; return n && n < ROUND ? n : 0; };
  const KEEP = "rumiq-svep-result"; // the finished round, kept for this tab so that Back and reload show the profile again
  V.svep = (scope) => {
    const room = scope ? RQ.roomById(scope) : null; if (scope && !room) return V.notfound();
    return {
      title: room ? `Svep · ${room.name} · RumIQ` : "Svep · RumIQ",
      html: `<section class="wrap svep" aria-label="Svep">
        <div class="sv-head">${RQ.crumbs(room ? [["Hem", "hem"], ["Upptäck", "upptack"], ["Svep", "svep"], [room.name]] : [["Hem", "hem"], ["Upptäck", "upptack"], ["Svep"]])}<h1 class="h1">Svep fram din stil.</h1><p class="lead">Höger sparar, vänster hoppar över. Tryck på kortet för att läsa mer.</p>
          ${scopeNav(scope)}
          ${legend}
          <p class="small sv-after">Klicka på bildens kanter för fler bilder, eller mitt på bilden för att läsa mer. ${roomLeft(scope) ? `<span>${roomLeft(scope)}</span> <span>kort för</span> <span>${esc(room.name.toLowerCase())}</span>, <span>sedan får du din stilprofil.</span>` : "Efter tio kort får du din stilprofil."}</p>
          <a class="sv-two-link" href="#svep-ihop">${SV.two}<span>Inreder ni tillsammans? <b>Svep tillsammans</b></span></a></div>
        ${deckHtml("sv", false)}</section>`,
      mount(root) {
        const kept = ss.get(KEEP, null), keep = kept && kept.scope === (scope || "") && Array.isArray(kept.done) && kept.done.length ? kept : null;
        const carry = !keep && !scope && ss.get("rumiq-svep-carry", null); // dropped once this page takes the round further
        const unseen = (t, st) => RQ.PRODUCTS.filter((p) => inScope(p, scope) && !(p.handle in t.seen)).length;
        // "Kommer snart" comes as card six, so it only counts in a round that gets that far
        const soonOpen = (st, t) => !scope && !st.soonDone && st.done.length <= 5 && st.done.length + unseen(t, st) >= 5 && !!nextSoon();
        const cur = $(".sv-scope [aria-current]", root), nav = cur && cur.parentNode; if (nav && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = cur.offsetLeft - (nav.clientWidth - cur.offsetWidth) / 2;
        return runDeck(root, {
          px: "sv", ctx: scope ? "svep:" + scope : "svep", keys: true, start: keep || carry, finished: !!keep, onDecide: () => ss.del("rumiq-svep-carry"),
          total: (st, t) => Math.min(ROUND, st.done.length + unseen(t, st) + (soonOpen(st, t) ? 1 : 0)),
          next: (st, t, skip, n) => {
            const out = upcoming(t, skip, n, st.done.length, scope);
            if (n === 3 && st.done.length === 5 && soonOpen(st, t)) { out.unshift(nextSoon()); out.length = Math.min(out.length, 3); }
            return out;
          },
          why: (p, t) => { const s = RQ.taste.top(t)[0]; return t.likes >= 2 && s && p.styles.includes(s) ? `Passar din stil: ${RQ.STYLES[s].name}` : ""; },
          onFinish: (st, deckEl) => {
            const r = resultHtml(st, scope); deckEl.outerHTML = r.html;
            const res = $(".svep-result", root); res.focus({ preventScroll: true });
            const fresh = !(keep && keep.done.length === st.done.length);
            if (st.done.length) ss.set(KEEP, { scope: scope || "", done: st.done, answers: st.answers, saved: st.saved, bagged: st.bagged, soonDone: st.soonDone });
            if (fresh) RQ.track && RQ.track("swipe_round", { saved: r.saved.length, bagged: st.bagged.length, style: r.top.length ? r.top[0].id : "", scope: scope || "" });
            // a new round is drawn in place: no detour through another page, so Back still leads where you came from
            const again = () => { ss.del(KEEP); RQ.router(); scrollTo(0, 0); };
            let armed = false;
            $("#svAgain", root).addEventListener("click", (e) => {
              if (!armed) { armed = true; e.currentTarget.textContent = "Tryck igen för att börja om"; $("#svAgainNote", root).textContent = "Din stilprofil nollställs. Det du har sparat ligger kvar."; return; }
              RQ.taste.reset(); try { localStorage.removeItem("rumiq-style"); } catch (er) {} again();
            });
            const m = $("#svMore", root); m && m.addEventListener("click", again);
            const all = $("#svAll", root); all && all.addEventListener("click", () => RQ.addMany(r.saved.map((p) => p.handle), all, "Din runda"));
            const ra = $("#svRoomAll", root); ra && ra.addEventListener("click", () => toRoom(r.saved.map((p) => p.handle)));
            const sh = $("#svShare", root); sh && sh.addEventListener("click", () => shareStyle(r.top, (r.saved.length ? r.saved : RQ.styleProfile().liked.map(RQ.byHandle)).filter(Boolean)));
            const ans = roundAnswers(st);
            bindLinkForm($("#svTwo", root), (n) => twoLink(ans.hs, ans.a, null, n, ""), tr("Svep tillsammans på RumIQ"), tr("Svep samma kort som jag, så ser vi vad vi båda gillar."));
          },
        });
      },
    };
  };

  /* ---------------------------------------------------------------- Svep tillsammans */
  const compare = (two, viewerIsB) => {
    const both = [], onlyA = [], onlyB = [];
    two.hs.forEach((h, i) => { const a = two.a[i] === "1", b = two.b[i] === "1"; if (a && b) both.push(h); else if (a) onlyA.push(h); else if (b) onlyB.push(h); });
    const union = both.length + onlyA.length + onlyB.length, pct = union ? Math.round((both.length / union) * 100) : 0;
    const nA = two.na || (viewerIsB ? "Din vän" : "Person 1"), nB = viewerIsB ? "Du" : two.nb || "Person 2";
    const P = (l) => l.map(RQ.byHandle).filter(Boolean), bothP = P(both);
    const group = (label, name, list) => (list.length ? `<div class="sp-saved"><span class="eyebrow">${label}${name ? ` <b class="sv-name">${esc(name)}</b>` : ""} · ${list.length}</span>${savedTiles(P(list))}</div>` : "");
    return { both: bothP, html: `<div class="svep-result two" tabindex="-1">
      <span class="eyebrow">Svep tillsammans</span>
      <h2 class="h2">${both.length ? `Ni gillar båda ${both.length} ${both.length === 1 ? "sak" : "saker"}` : "Ni gillade olika saker den här gången"}</h2>
      <div class="two-meter" aria-label="Hur lika ni tycker"><span class="two-names"><b class="sv-name">${esc(nA)}</b><b class="sv-name">${esc(nB)}</b></span><span class="sp-bar"><i style="width:${pct}%"></i></span><span class="two-pct">${pct} % gemensamt</span></div>
      ${both.length ? `<div class="sp-saved"><span class="eyebrow">Ni gillar båda</span>${savedTiles(bothP)}
        <div class="ctrl-row sp-acts"><button class="btn" type="button" id="twoAll">Lägg det ni båda gillar i varukorgen · ${kr(bothP.reduce((s, p) => s + p.price, 0))}</button><button class="btn ghost" type="button" id="twoRoom">${RQ.roomIco}<span>Se dem i ditt rum</span></button></div></div>` : `<p class="lead">Det är också bra att veta. Prova en runda för ett rum ni ska inreda, så blir det lättare att mötas.</p>`}
      ${group("Bara", nA, onlyA)}${group("Bara", nB === "Du" ? "" : nB, onlyB).replace("Bara · ", "Bara du · ")}
      ${viewerIsB ? `<div class="sp-two"><span class="sp-two-ic" aria-hidden="true">${SV.two}</span><div class="sp-two-tx"><b>Skicka ditt svar tillbaka</b><p>Då ser <b class="sv-name">${esc(nA)}</b> samma jämförelse.</p>${linkForm("twoBack", "Ditt namn, om du vill", "Skicka svaret")}</div></div>` : ""}
      <div class="ctrl-row" style="margin-top:.6rem;justify-content:center"><a class="btn ghost" href="#svep">Svep en egen runda</a><a class="btn ghost" href="#svep-ihop">Börja om tillsammans</a></div></div>` };
  };
  V.svepIhop = (payload) => {
    const two = parseTwo(payload);
    const crumbs = RQ.crumbs([["Hem", "hem"], ["Upptäck", "upptack"], ["Svep", "svep"], ["Tillsammans"]]);
    if (!two) return {
      title: "Svep tillsammans · RumIQ",
      html: `<section class="wrap svep two-intro"><div class="sv-head">${crumbs}<h1 class="h1">Svep tillsammans.</h1><p class="lead">Inreder ni ihop? Svep samma kort var för sig och se vad ni båda gillar, utan att behöva bråka om gardinerna.</p>
        ${payload ? `<p class="note">Länken verkar vara ofullständig. Be om en ny länk, eller börja en egen runda.</p>` : ""}
        <ol class="two-steps"><li><b>Svep tio kort</b><span>Höger på det du gillar, vänster på resten.</span></li><li><b>Skicka korten</b><span>Du får en länk att skicka i ett meddelande.</span></li><li><b>Se vad ni båda gillar</b><span>När den andra har svept syns det ni har gemensamt, redo att lägga i varukorgen.</span></li></ol>
        <div class="ctrl-row" style="margin-top:1.6rem"><a class="btn" href="#svep">Börja svepa</a></div>
        <p class="small" style="margin-top:1rem">Svaren finns bara i länken ni skickar till varandra. Vi sparar dem inte.</p></div></section>`,
    };
    if (two.b) {
      const c = compare(two, false);
      return { title: "Svep tillsammans · RumIQ", html: `<section class="wrap svep two-done"><div class="sv-head">${crumbs}<h1 class="h1">Så här svarade ni.</h1></div>${c.html}</section>`,
        mount(root) { bindTwoActions(root, c.both); } };
    }
    return {
      title: "Svep tillsammans · RumIQ",
      html: `<section class="wrap svep" aria-label="Svep tillsammans">
        <div class="sv-head">${crumbs}<span class="eyebrow">Svep tillsammans</span><h1 class="h1">Vad gillar ni båda?</h1>
          <p class="lead keep">${two.na ? `<b class="sv-name">${esc(two.na)}</b> ` : ""}<span>${two.na ? "har svept de här korten." : "Någon har svept de här korten."}</span> <span>Svep dem du också, så ser ni vad ni har gemensamt.</span></p>
          ${legend}<p class="small sv-after keep">Du ser inte vad den andra har svarat förrän du är klar.</p></div>
        ${deckHtml("sv", false)}</section>`,
      mount(root) {
        // your answers to these cards are kept for this tab, so a reload shows the comparison instead of the cards again
        const K2 = "rumiq-svep-two", kept = ss.get(K2, null), keep = kept && kept.raw === payload && kept.answers ? kept : null;
        return runDeck(root, {
          px: "sv", ctx: "ihop", keys: true, hint: true, start: keep ? { done: two.hs, answers: keep.answers } : null, finished: !!keep,
          total: () => two.hs.length,
          next: (st, t, skip, n) => two.hs.filter((h) => !skip.has(h)).slice(0, n).map(RQ.byHandle),
          onFinish: (st, deckEl) => {
            ss.set(K2, { raw: payload, answers: st.answers });
            const b = two.hs.map((h) => ((st.answers[h] || 0) > 0 ? 1 : 0)).join(""), res = { ...two, b };
            const c = compare(res, true); deckEl.outerHTML = c.html;
            $(".svep-result", root).focus({ preventScroll: true });
            RQ.track && RQ.track("svep_together_done", { both: c.both.length });
            bindTwoActions(root, c.both);
            bindLinkForm($("#twoBack", root), (n) => twoLink(two.hs, two.a, b, two.na, n), tr("Svep tillsammans på RumIQ"), tr("Här är vad vi båda gillar."));
          },
        });
      },
    };
  };
  const bindTwoActions = (root, both) => {
    const all = $("#twoAll", root); all && all.addEventListener("click", () => RQ.addMany(both.map((p) => p.handle), all, "Det ni båda gillar"));
    const rm = $("#twoRoom", root); rm && rm.addEventListener("click", () => toRoom(both.map((p) => p.handle)));
  };

  /* ---------------------------------------------------------------- the taster on the home page */
  RQ.svepHome = {
    html() {
      const t = RQ.taste.get(), top = RQ.taste.top(t)[0];
      return `<section class="sec svh" id="svep-hem" aria-label="Svep fram din stil">
        <div class="wrap svh-in">
          <div class="svh-tx"><span class="eyebrow">${top ? `Din stil: ${esc(RQ.STYLES[top].name)}` : "Ny här? Börja här"}</span>
            <h2 class="display">Hitta din stil på en minut.</h2>
            <p class="lead">Svep höger på det du gillar och vänster på resten. Efter tio kort får du din stilprofil, och hela butiken sorterar sig efter dig.</p>
            <ul class="svh-how"><li><i aria-hidden="true">→</i>Spara</li><li><i aria-hidden="true">←</i>Hoppa över</li><li><i aria-hidden="true">↑</i>I varukorgen</li></ul>
            <div class="ctrl-row"><a class="btn" href="#svep">${t.n ? "Fortsätt svepa" : "Börja svepa"}</a><a class="btn ghost" href="#svep-ihop">${SV.two}<span>Svep tillsammans</span></a></div></div>
          <div class="svh-deck">${deckHtml("svh", true)}</div>
        </div></section>`;
    },
    mount(root) {
      const host = $("#svep-hem", root); if (!host) return () => {};
      return runDeck(host, {
        px: "svh", ctx: "hem", keys: false,
        total: () => HOME_CARDS,
        next: (st, t, skip, n) => upcoming(t, skip, n, st.done.length, null),
        onFinish: (st, deckEl) => {
          ss.set("rumiq-svep-carry", { done: st.done, answers: st.answers, saved: st.saved, bagged: st.bagged });
          const left = ROUND - st.done.length;
          deckEl.outerHTML = `<div class="svh-done" tabindex="-1"><span class="eyebrow">${st.done.length} av ${ROUND} klara</span><h3>Snyggt. ${left} kort kvar till din stilprofil.</h3>
            ${st.saved.length ? `<p>${st.saved.length} ${st.saved.length === 1 ? "sak har" : "saker har"} hamnat under Sparat.</p>` : `<p>Ju fler kort, desto bättre förstår vi vad du gillar.</p>`}
            <a class="btn" href="#svep">Fortsätt svepa</a></div>`;
        },
      });
    },
  };

  /* ---------------------------------------------------------------- nudges and teaser */
  const deck = () => [...RQ.PRODUCTS].sort((a, b) => hash(a.handle + "rq") - hash(b.handle + "rq"));
  RQ.svepTeaser = () => {
    const t = RQ.taste.get(), top = RQ.taste.top(t)[0], picks = deck().slice(0, 3);
    return `<a class="svt" href="#svep"><div class="svt-cards" aria-hidden="true">${picks.map((p, k) => `<img src="${RQ.img(p, 600)}" alt="" loading="lazy" style="--k:${k}">`).join("")}</div>
      <div class="svt-tx"><span class="eyebrow">${top ? `Din stil: ${esc(RQ.STYLES[top].name)}` : "Hitta din stil"}</span><h3>${t.n ? "Fortsätt där du var." : "Vilken stil är din?"}</h3><p>Svep höger på det du gillar och vänster på resten. Efter tio kort sorteras hela butiken efter dig.</p><span class="btn sm">${t.n ? "Fortsätt" : "Börja svepa"}</span></div></a>`;
  };
  // a small way into Svep for pages that would otherwise be empty
  RQ.svepNudge = (title = "Osäker på vad du gillar?", text = "Svep tio kort, så sparas det du gillar här och butiken sorterar sig efter dig.") => {
    const picks = deck().slice(3, 6);
    return `<a class="sv-nudge" href="#svep"><span class="sv-nudge-cards" aria-hidden="true">${picks.map((p, k) => `<img src="${RQ.img(p, 600)}" alt="" loading="lazy" style="--k:${k}">`).join("")}</span>
      <span class="sv-nudge-tx"><b>${title}</b><small>${text}</small><span class="tlink">Svep fram din stil</span></span></a>`;
  };
})();
