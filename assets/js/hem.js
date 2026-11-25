/* RumIQ: Mitt hem, the customer's home on the site (data, room proposals and the way into Mitt rum).
   - RQ.vault: one storage layer. Local (this browser) today; with RQ_CONFIG.studio.serverSync and a real account
     the same keys are pushed to and pulled from the account (table "home_store", see studio-server.md).
   - RQ.hem: room projects (name, type, style, colours, budget, material, measurements, notes, chosen products,
     the placed scene, AI pictures, moodboards, inköpslista with Köpt), the active room, progress and next step,
     a ready room proposal from the range (style + budget), "Se det i ditt rum", and "Vad tycker du?" links.
   Room projects live in the same list as "Mina rum och mått" (rumiq-home), so the product pages' "I ditt hem"
   keeps working with them. Products are example data until the founder's Shopify products arrive. */
(function () {
  const RQ = window.RQ, S = RQ.shop, V = RQ.views, $ = RQ.$, $$ = RQ.$$, esc = RQ.esc, kr = S.kr;
  const conf = () => (window.RQ_CONFIG && window.RQ_CONFIG.studio) || {};

  /* ------------------------------------------------------------------ one storage layer: local now, the account later */
  const SYNC = ["rumiq-home", "rumiq-wish", "rumiq-looks", "rumiq-boards", "rumiq-chat-saved", "rumiq-style", "rumiq-room-active"];
  const vault = (RQ.vault = {
    keys: SYNC,
    account: () => !!conf().serverSync && !!(RQ.ai && RQ.ai.live && RQ.ai.live()) && !!S.customer(),
    where: () => (vault.account() ? "account" : "local"),
    get: (k, d) => S.store.get(k, d),
    set(k, v) { const ok = S.store.set(k, v); if (ok) vault.queue(k); return ok; },
    pending: new Set(), timer: null,
    queue(k) { if (!SYNC.includes(k) || !vault.account()) return; vault.pending.add(k); clearTimeout(vault.timer); vault.timer = setTimeout(() => vault.push().catch(() => {}), 1200); },
    // the account backend: one row per key and customer (RLS: own rows only); newest wins
    async push() {
      const c = RQ.auth.client(); if (!c || !vault.pending.size) return;
      const rows = [...vault.pending].map((key) => ({ key, value: S.store.get(key, null, true), updated_at: new Date().toISOString() }));
      vault.pending.clear(); const { error } = await c.from("home_store").upsert(rows, { onConflict: "user_id,key" }); if (error) throw error;
      S.store.set("rumiq-sync-at", new Date().toISOString());
    },
    async pull() {
      if (!vault.account()) return false;
      const { data, error } = await RQ.auth.client().from("home_store").select("key,value,updated_at"); if (error || !Array.isArray(data)) return false;
      const since = S.store.get("rumiq-sync-at", ""); let n = 0;
      data.forEach((r) => { if (SYNC.includes(r.key) && (!since || r.updated_at > since)) { S.store.set(r.key, r.value); n++; } });
      S.store.set("rumiq-sync-at", new Date().toISOString()); return n;
    },
  });
  // signed in with the account live: what this browser has goes up, what the account has comes down
  document.addEventListener("rq-auth", () => { if (vault.account()) { SYNC.forEach((k) => vault.pending.add(k)); vault.pull().then(() => vault.push()).catch(() => {}); } });

  /* ------------------------------------------------------------------ room projects */
  const ACTIVE = "rumiq-room-active";
  const now = () => new Date().toISOString();
  const typeName = (t) => (RQ.roomById(t) || {}).name || "Rum";
  const H = (RQ.hem = {});
  const fire = () => document.dispatchEvent(new CustomEvent("rq-hem"));
  H.rooms = () => (RQ.homeRooms ? RQ.homeRooms.list() : []);
  H.room = (id) => H.rooms().find((r) => r.id === id) || null;
  H.save = (room) => {
    const all = H.rooms(), i = all.findIndex((r) => r.id === room.id); room.updated = now();
    if (i < 0) all.unshift(room); else all[i] = room;
    RQ.homeRooms.save(all); vault.queue("rumiq-home"); fire(); return room;
  };
  H.patch = (id, p) => { const r = H.room(id); return r ? H.save({ ...r, ...p }) : null; };
  H.create = ({ label, type, style = null, budget = null, items = [] }) => {
    const t = RQ.roomById(type) ? type : "vardagsrum";
    const r = { id: "rm" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), type: t, label: String(label || "").trim().slice(0, 40) || typeName(t), style: RQ.STYLES[style] ? style : null,
      budget: budget > 0 ? Math.round(budget) : null, colours: [], material: "", notes: "", items: items.slice(0, 12), bought: {}, boards: [], feedback: [], at: now() };
    return H.save(r);
  };
  H.remove = (id) => { const all = H.rooms(), r = all.find((x) => x.id === id); if (!r) return null; RQ.homeRooms.save(all.filter((x) => x.id !== id)); if (H.activeId() === id) vault.set(ACTIVE, ""); vault.queue("rumiq-home"); fire(); return r; };
  H.restore = (r) => { if (r) H.save(r); };
  H.activeId = () => { const id = S.store.get(ACTIVE, ""); return id && H.room(id) ? id : null; };
  H.setActive = (id) => { vault.set(ACTIVE, id || ""); fire(); };
  H.picture = (r) => { const id = r && r.saved && r.saved.project, pr = id && S.projects().find((x) => x.id === id); return pr && /^data:image\//.test(pr.img || "") ? pr.img : null; };
  H.name = (r) => (r ? r.label || typeName(r.type) : "");
  H.items = (r) => (r && Array.isArray(r.items) ? r.items.filter((it) => it && RQ.byHandle(it.h)) : []);
  const vPrice = (it) => { const x = S.variantById(it.h + "::" + (it.v || 0)); return x && x.variant ? x.variant.price : RQ.byHandle(it.h).price; };
  H.price = vPrice;
  // Köpt: ticked by hand, or bought through the shop (the test orders today, real orders later)
  H.boughtSet = (r) => { const set = new Set(Object.keys((r && r.bought) || {})); S.orders().forEach((o) => (o.lines || []).forEach((l) => { if (H.items(r).some((it) => it.h === l.handle)) set.add(l.handle); })); return set; };
  H.money = (r) => { const its = H.items(r), b = H.boughtSet(r), total = its.reduce((s, it) => s + vPrice(it), 0), spent = its.filter((it) => b.has(it.h)).reduce((s, it) => s + vPrice(it), 0);
    return { total, spent, left: r && r.budget ? r.budget - total : null, toBuy: its.filter((it) => !b.has(it.h)) }; };
  // what is done and the one next step
  H.progress = (r, pics = 0) => {
    const its = H.items(r), m = H.money(r);
    const parts = [[r.style ? `Stil: ${RQ.STYLES[r.style].name.toLowerCase()}` : "Stil", !!r.style], [pics ? `${pics} ${pics === 1 ? "bild" : "bilder"}` : "Bilder", pics > 0], [its.length ? `${its.length} ${its.length === 1 ? "produkt vald" : "produkter valda"}` : "Produkter", its.length > 0], [r.budget ? `Budget ${kr(r.budget)}` : "Budget", !!r.budget]];
    const next = !r.style ? { label: "Välj stil", act: "style" } : !its.length ? { label: "Se ett förslag", act: "propose" } : !pics ? { label: "Se det i ditt rum", act: "see" } : !r.budget ? { label: "Välj budget", act: "budget" } : m.toBuy.length ? { label: "Köp det som är kvar", act: "buy" } : { label: "Allt är köpt", act: "open" };
    return { parts, next };
  };

  /* Rumsprojekt and Mitt hem are one: "Spara" in Mitt rum saves into the room it belongs to (the active one when it is
     this photo, else a new room named after the room type), and older Rumsprojekt become rooms once */
  const baseSaveProject = S.saveProject;
  S.saveProject = (p) => {
    const ok = baseSaveProject(p); if (ok && S.projects()[0]) p = { ...p, id: S.projects()[0].id };
    if (!ok || !RQ.room || !RQ.room.has()) return ok;
    const key = RQ.ai ? RQ.ai.projectKey() : null, act = H.activeId() && H.room(H.activeId());
    const scene = RQ.room.scene(), items = (p.handles || scene.map((it) => it.h)).filter((h) => RQ.byHandle(h)).map((h) => ({ h, v: 0 }));
    const r = act && (!act.pkey || act.pkey === key) ? act : H.rooms().find((x) => x.pkey && x.pkey === key) || H.create({ label: typeName(RQ.room.get().type || "vardagsrum"), type: RQ.room.get().type || "vardagsrum" });
    H.patch(r.id, { items, scene, pkey: key, saved: { project: p.id, at: now() } }); H.setActive(r.id); return ok;
  };
  const migrate = () => { const old = S.projects().filter((p) => !p.hem); if (!old.length) return;
    old.slice().reverse().forEach((p) => { const items = (p.handles || []).filter((h) => RQ.byHandle(h)).map((h) => ({ h, v: 0 })); const t = (RQ.byHandle((items[0] || {}).h) || { rooms: ["vardagsrum"] }).rooms[0];
      const r = H.create({ label: String(p.title || "").replace(/^(Mitt rum|AI-bild) med .*/, "") || typeName(t), type: t, items }); H.patch(r.id, { notes: p.note || "", pkey: p.studio || null, saved: { project: p.id, at: p.at } }); });
    S.store.set("rumiq-projects", S.projects().map((p) => ({ ...p, hem: true }))); };
  try { migrate(); } catch (e) {}

  /* Mitt rum keeps the active room up to date: what stands in the room photo it was opened with is its chosen set */
  document.addEventListener("rq-room", (e) => {
    if (e.detail !== "scene") return; const id = H.activeId(), r = id && H.room(id); if (!r || !RQ.ai || !r.pkey || RQ.ai.projectKey() !== r.pkey) return;
    const scene = RQ.room.scene(), old = Object.fromEntries(H.items(r).map((it) => [it.h, it.v || 0]));
    clearTimeout(H._t); H._t = setTimeout(() => H.patch(id, { items: scene.map((it) => ({ h: it.h, v: old[it.h] || 0 })), scene }), 400);
  });

  /* ------------------------------------------------------------------ a ready room proposal from the range */
  H.propose = ({ type, style, budget, avoid = [], prefer = [] } = {}) => {
    const t = RQ.roomById(type) ? type : "vardagsrum", R0 = RQ.roomById(t), st = RQ.STYLES[style] ? style : null;
    const taste = RQ.taste && RQ.taste.get ? RQ.taste.get() : null;
    const score = (p) => (prefer.includes(p.handle) ? 6 : 0) + (st && p.styles.includes(st) ? 4 : 0) + (taste && taste.saved && taste.saved.includes && taste.saved.includes(p.handle) ? 1 : 0) - (avoid.includes(p.handle) ? 9 : 0) + (p.rooms[0] === t ? 1 : 0);
    const pool = RQ.PRODUCTS.filter((p) => p.rooms.includes(t) && (!st || p.styles.includes(st) || !RQ.PRODUCTS.some((q) => q.rooms.includes(t) && q.cat === p.cat && q.styles.includes(st))));
    const order = [...(R0.cats || []), ...new Set(pool.map((p) => p.cat))];
    const best = []; [...new Set(order)].forEach((c) => { const ps = pool.filter((p) => p.cat === c).sort((a, b) => score(b) - score(a) || a.price - b.price); ps.slice(0, c === order[0] ? 2 : 1).forEach((p) => best.push(p)); });
    const full = best.slice(0, 6), fullTotal = full.reduce((s, p) => s + p.price, 0), min = full.length ? Math.min(...full.map((p) => p.price)) : 0;
    let picked = full, left = [];
    if (budget && budget < fullTotal) { picked = []; let sum = 0; full.forEach((p) => { if (sum + p.price <= budget) { picked.push(p); sum += p.price; } else left.push(p); }); }
    const total = picked.reduce((s, p) => s + p.price, 0), colours = [...new Set(picked.map((p) => p.tone[0]))].slice(0, 5);
    return { type: t, style: st, budget: budget || null, items: picked.map((p) => ({ h: p.handle, v: 0 })), left: left.map((p) => p.handle), total, fullTotal, min, colours };
  };
  const roomWord = (t) => typeName(t).toLowerCase();
  H.title = (pr) => `Ditt ${roomWord(pr.type)}${pr.style ? ` i ${(RQ.STYLES[pr.style].name.split(" ")[0]).toLowerCase()} stil` : ""}`;
  const PROMISE = "Se ditt hem innan du köper.";
  H.PROMISE = PROMISE;

  // the card: style, colours, the set, total, budget; one obvious next step ("Se det i ditt rum"). Self-contained (delegated events).
  const cardState = new Map(); let seq = 0;
  H.slot = (spec) => { const id = "hp" + ++seq; cardState.set(id, { ...spec, budget: spec.budget || null }); return `<div class="hem-prop" data-hem-prop="${id}">${cardInner(id)}</div>`; };
  const cardInner = (id) => {
    const s = cardState.get(id), pr = H.propose(s); s.pr = pr;
    const its = pr.items.map((it) => RQ.byHandle(it.h)), room = s.room ? H.room(s.room) : null;
    const types = ["vardagsrum", "sovrum", "kok", "hall", "badrum", "hemmakontor"];
    return `<div class="hem-prop-h"><span class="eyebrow">${s.from === "room" ? "Förslag för rummet" : "Ett färdigt rumsförslag"}</span><h3 class="h3">${esc(H.title(pr))}</h3>
        <p class="small hem-promise">${PROMISE}</p></div>
      ${s.compact ? "" : typeChips(s, pr, types)}
      ${pr.colours.length ? `<div class="hem-cols" role="img" aria-label="Färgerna i förslaget">${pr.colours.map((c) => `<i style="background:${esc(c)}"></i>`).join("")}</div>` : ""}
      <ul class="hem-prop-items">${its.map((p) => `<li>${s.compact ? `<span class="hem-prop-im"><img src="${RQ.cut(p)}" alt=""></span>` : `<button type="button" data-sheet="${p.handle}" aria-label="Snabbtitt på ${esc(p.name)}"><img src="${RQ.cut(p)}" alt=""></button>`}<span>${esc(p.name)}</span><b>${kr(p.price)}</b></li>`).join("")}</ul>
      ${pr.left.length ? `<p class="small hem-left">Budgeten räcker till ${its.length} av ${its.length + pr.left.length}. Kvar: ${pr.left.map((h) => esc(RQ.byHandle(h).name)).join(", ")}.</p>` : ""}
      ${s.compact ? `<details class="hem-more"${s.open ? " open" : ""}><summary>Ändra rum och budget</summary>${typeChips(s, pr, types)}` : ""}<label class="hem-budget"><span>Budget <b>${kr(s.budget || pr.fullTotal)}</b></span><input type="range" data-hem-budget min="${Math.max(100, Math.floor(pr.min / 100) * 100)}" max="${Math.ceil(pr.fullTotal / 100) * 100}" step="100" value="${s.budget || Math.ceil(pr.fullTotal / 100) * 100}" aria-label="Budget i kronor" aria-valuetext="${esc(kr(s.budget || pr.fullTotal))}"></label>
      ${s.compact ? `<div class="ai-row small-row"><button class="tlink" type="button" data-hem-reroll>Ett annat förslag</button><button class="tlink" type="button" data-hem-ask>Vad tycker du?</button></div></details>` : ""}
      <div class="hem-prop-sum"><span>${its.length} ${its.length === 1 ? "produkt" : "produkter"}</span><b>${kr(pr.total)}</b></div>
      <div class="ai-row"><button class="btn" type="button" data-hem-see>${RQ.roomIco}<span>Se det i ditt rum</span></button><button class="btn ghost" type="button" data-hem-buy>Köp allt</button></div>
      ${s.compact ? "" : `<div class="ai-row small-row"><button class="tlink" type="button" data-hem-reroll>Ett annat förslag</button>${room ? "" : `<button class="tlink" type="button" data-hem-keep>Spara i Mitt hem</button>`}<button class="tlink" type="button" data-hem-ask>Vad tycker du?</button></div>`}
      <p class="small" role="status" data-hem-msg>${room ? `Hör till ${esc(H.name(room))}.` : ""}</p>`;
  };
  const typeChips = (s, pr, types) => s.from === "room" ? "" : `<div class="chips hem-prop-types" role="group" aria-label="Vilket rum?">${types.map((t) => `<button type="button" class="chip" data-hem-type="${t}" aria-pressed="${pr.type === t}">${esc(typeName(t))}</button>`).join("")}</div>`;
  // the details stay open while you change the room or the budget inside them
  document.addEventListener("toggle", (e) => { const d = e.target; if (!d.matches || !d.matches(".hem-more")) return; const box = d.closest("[data-hem-prop]"), st = box && cardState.get(box.dataset.hemProp); if (st) st.open = d.open; }, true);
  const repaint = (box, focusSel) => { box.innerHTML = cardInner(box.dataset.hemProp); if (focusSel) { const f = $(focusSel, box); if (f) f.focus({ preventScroll: true }); } };
  // the room this proposal belongs to: the one it came from, else a new one named after the room type
  const ensureRoom = (s) => { if (s.room && H.room(s.room)) return H.room(s.room); const r = H.create({ label: typeName(s.pr.type), type: s.pr.type, style: s.pr.style, budget: s.budget, items: s.pr.items }); s.room = r.id; return r; };
  document.addEventListener("input", (e) => { const r = e.target.closest("[data-hem-budget]"); if (!r) return; const box = r.closest("[data-hem-prop]"), s = cardState.get(box.dataset.hemProp); s.budget = +r.value; clearTimeout(s.t); s.t = setTimeout(() => repaint(box, "[data-hem-budget]"), 120); });
  document.addEventListener("click", (e) => {
    const box = e.target.closest("[data-hem-prop]"); if (!box) return; const s = cardState.get(box.dataset.hemProp); if (!s) return;
    const b = e.target.closest("button"); if (!b) return;
    if (b.matches("[data-hem-type]")) { s.type = b.dataset.hemType; repaint(box, `[data-hem-type="${s.type}"]`); return; }
    if (b.matches("[data-hem-reroll]")) { s.avoid = [...new Set([...(s.avoid || []), ...s.pr.items.map((it) => it.h)])].slice(-12); repaint(box, "[data-hem-reroll]"); return; }
    if (b.matches("[data-hem-buy]")) { RQ.addMany(s.pr.items.map((it) => it.h + "::" + it.v), b, H.title(s.pr)); return; }
    if (b.matches("[data-hem-keep]")) { const r = ensureRoom(s); if (s.room === r.id) H.patch(r.id, { items: s.pr.items, style: s.pr.style, budget: s.budget || r.budget }); repaint(box); RQ.toast(`${esc(H.name(r))} är sparat i Mitt hem. <a href="#mitt-hem">Visa</a>`); return; }
    if (b.matches("[data-hem-see]")) { const r = ensureRoom(s); H.patch(r.id, { items: s.pr.items, style: s.pr.style, budget: s.budget || r.budget }); H.openInRoom({ room: r.type, items: s.pr.items, style: s.pr.style, budget: s.budget, project: r.id }); return; }
    if (b.matches("[data-hem-ask]")) { const r = ensureRoom(s); H.patch(r.id, { items: s.pr.items, style: s.pr.style }); H.askLink(H.room(r.id), b); repaint(box); }
  });

  /* ------------------------------------------------------------------ into Mitt rum ("Se det i ditt rum") */
  /* The editor's own entry (room.js) when it is there: RQ.room.openWith({ room, own, items, style, budget, project }).
     Until then: the sample room of that type is put in, and the things are added with the editor's own placement rules
     (R.add, never floating); an own photo goes through the editor's setup (with its sign-in gate). */
  H.openInRoom = async ({ room = null, own = false, items = [], style = null, budget = null, project = null } = {}) => {
    const R = RQ.room; if (!R) return;
    document.dispatchEvent(new CustomEvent("rq-hem-go")); // the room sheet or the moodboard steps aside
    const hs = items.map((it) => (typeof it === "string" ? it : it.h)).filter((h) => RQ.byHandle(h));
    if (project) H.setActive(project);
    const pin = () => { if (project && RQ.ai) H.patch(project, { pkey: RQ.ai.projectKey() }); };
    if (typeof R.openWith === "function") { const out = await R.openWith({ room, own, items: items.map((it) => (typeof it === "string" ? { h: it, v: 0 } : it)), style, budget, project }); pin(); return out; }
    if (own) { R.openSetup(() => { pin(); }, { add: hs, go: "#mitt-rum" }); return; }
    const pr = project && H.room(project), sameRoom = pr && pr.pkey && RQ.ai && R.has() && RQ.ai.projectKey() === pr.pkey;
    const cur = R.get(), sample = RQ.SAMPLE_ROOMS.find((x) => x.id === room) || RQ.SAMPLE_ROOMS[0];
    if (!sameRoom && !(cur && cur.sample && cur.map === sample.id && !pr)) {
      const im = new Image(); im.crossOrigin = "anonymous";
      const ok = await new Promise((res) => { im.onload = () => res(true); im.onerror = () => res(false); im.src = sample.img; });
      if (!ok || !(await R.saveImage(im, { sample: true, map: sample.id, type: sample.id, name: sample.name }))) { RQ.toast("Rummet gick inte att öppna. Försök igen."); return; }
    }
    R.group(() => { R.saveScene([]); hs.forEach((h) => R.add(h, true)); });
    pin();
    if (RQ.currentRoute && RQ.currentRoute() === "mitt-rum") RQ.router(); else RQ.go("mitt-rum");
  };

  // a look opened in the room: its products, in a sample room of the look's kind (or the room you have), placed by the editor
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-hem-look]"); if (!b) return; const l = (RQ.LOOKS || []).find((x) => x.id === b.dataset.hemLook); if (!l) return;
    const t = (RQ.byHandle(l.items[0]) || { rooms: ["vardagsrum"] }).rooms[0]; H.openInRoom({ room: l.room || t, items: l.items.map((h) => ({ h, v: 0 })) }); });

  // "Öppna rummet" from an answer link: Sparat opens that room when it is drawn
  document.addEventListener("click", (e) => { const a = e.target.closest("a[data-hem-open]"); if (a && !a.closest(".mh")) RQ.ss.set("rumiq-hem-open", a.dataset.hemOpen); }, true);

  /* the moodboard lives with the Sparat page (site-tools); any page can open it */
  H.openBoard = (id, preset) => (RQ.loadTools ? RQ.loadTools() : Promise.resolve()).then(() => H._openBoard && H._openBoard(id, preset));
  document.addEventListener("click", (e) => {
    const n = e.target.closest("[data-board-new]"); if (n) { e.preventDefault(); H.openBoard(null, { room: n.dataset.boardNew || null, items: (n.dataset.boardItems || "").split(",").filter((h) => RQ.byHandle(h)), name: n.dataset.boardName || "" }); return; }
    const o = e.target.closest("[data-board-open]"); if (o) { e.preventDefault(); H.openBoard(o.dataset.boardOpen); }
  });

  /* ------------------------------------------------------------------ "Vad tycker du?" (a link, no account needed) */
  // ask: #delad-f.<room id>.<type>.<style>.<pid~v ...>~<name>   answer: #delad-s.<room id>.<pid+/- ...>~<name>
  const enc = RQ.sharedList && RQ.sharedList.enc, dec = RQ.sharedList && RQ.sharedList.dec;
  const pidOf = (h) => (enc ? enc([h], "").split("~")[0] : h);
  const byPid = (x) => (dec ? (dec(x) || { hs: [] }).hs[0] : null);
  const clean = (s) => String(s || "").replace(/[^\p{L}\p{N} '-]/gu, "").trim().slice(0, 30);
  H.askUrl = (r) => { const me = clean(((S.customer && S.customer()) || {}).name || ""), its = H.items(r);
    return new URL("delad/", document.baseURI).href + "#delad-f." + [r.id, r.type, r.style || "x", its.map((it) => pidOf(it.h) + (it.v ? "~" + it.v : "")).join("_")].join(".") + "~" + encodeURIComponent(me); };
  const shareUrl = async (url, title, text, btn) => {
    try { if (navigator.share) { await navigator.share({ title, text, url }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(url); RQ.toast("Länken är kopierad. Skicka den till vem du vill."); } catch (e) { window.prompt("Kopiera länken:", url); }
  };
  H.askLink = (r, btn) => { if (!r || !H.items(r).length) { RQ.toast("Välj några saker till rummet först."); return; } shareUrl(H.askUrl(r), "Vad tycker du?", `${H.name(r)}: vad tycker du? ${PROMISE}`, btn); };
  const parseAsk = (raw) => {
    const t = raw.indexOf("~", raw.lastIndexOf(".")) ; let core = raw, name = "";
    const k = raw.lastIndexOf("~"); if (k > 0 && raw.lastIndexOf(".") < k && !/^\d+$/.test(raw.slice(k + 1))) { core = raw.slice(0, k); try { name = clean(decodeURIComponent(raw.slice(k + 1))); } catch (e) {} }
    void t; const [id, type, style, list] = core.split(".");
    const items = (list || "").split("_").map((x) => { const [p, v] = x.split("~"); const h = byPid(p); return h ? { h, v: +v || 0 } : null; }).filter(Boolean);
    return items.length ? { id: clean(id), type: RQ.roomById(type) ? type : "vardagsrum", style: RQ.STYLES[style] ? style : null, items, name } : null;
  };
  const parseReply = (raw) => { let core = raw, name = ""; const k = raw.lastIndexOf("~"); if (k > 0) { core = raw.slice(0, k); try { name = clean(decodeURIComponent(raw.slice(k + 1))); } catch (e) {} }
    const [id, list] = core.split("."); const answers = {}; (list || "").split("_").forEach((x) => { const m = /^([0-9a-z]{4})([+-])$/.exec(x); const h = m && byPid(m[1]); if (h) answers[h] = m[2] === "+" ? 1 : 0; });
    return Object.keys(answers).length ? { id: clean(id), answers, name } : null; };
  const baseShared = V.shared;
  V.shared = (payload) => {
    const p = String(payload || "");
    if (p.startsWith("f.")) return askView(parseAsk(p.slice(2)));
    if (p.startsWith("s.")) return replyView(parseReply(p.slice(2)));
    return baseShared(payload);
  };
  const crumbs = () => RQ.crumbs([["Hem", "hem"], ["Vad tycker du?"]]);
  const empty = (h) => ({ title: "Vad tycker du? · RumIQ", html: `<header class="page-head wrap">${crumbs()}<h1 class="h1">${h}</h1><p class="lead">Länken saknar något eller har klippts av. Be om en ny länk.</p><div class="ctrl-row" style="margin-top:1.4rem"><a class="btn" href="#mitt-rum">Till Mitt rum</a></div></header>` });
  // the partner's page: the proposal, and "Gillar" / "Föreslå något annat" on each thing; the answer goes back as a link
  const askView = (A) => {
    if (!A) return empty("Förslaget gick inte att öppna.");
    const ps = A.items.map((it) => RQ.byHandle(it.h)), total = A.items.reduce((s, it) => s + vPrice(it), 0);
    const ttl = `${A.name ? esc(A.name) + "s" : "Ett"} ${roomWord(A.type)}${A.style ? ` i ${RQ.STYLES[A.style].name.split(" ")[0].toLowerCase()} stil` : ""}`;
    return { title: "Vad tycker du? · RumIQ",
      html: `<header class="page-head wrap">${crumbs()}<span class="eyebrow">Vad tycker du?</span><h1 class="h1">${ttl}</h1>
          <p class="lead">${ps.length} ${ps.length === 1 ? "sak" : "saker"} · ${kr(total)}. Säg vad du tycker om var och en, så skickar du svaret tillbaka med en länk. Inget konto behövs.</p></header>
        <section class="wrap hem-ask" style="padding-bottom:5rem"><ul class="hem-ask-list">${ps.map((p) => `<li data-h="${p.handle}"><img src="${RQ.cut(p)}" alt=""><div><b>${esc(p.name)}</b><span>${kr(p.price)}</span></div>
            <div class="chips" role="group" aria-label="Vad tycker du om ${esc(p.name)}?"><button type="button" class="chip" data-like="1" aria-pressed="false">Gillar</button><button type="button" class="chip" data-like="0" aria-pressed="false">Föreslå något annat</button></div></li>`).join("")}</ul>
          <label class="hem-ask-name">Ditt namn, om du vill<input type="text" id="askName" maxlength="30" autocomplete="given-name"></label>
          <div class="ctrl-row"><button class="btn" type="button" id="askSend" disabled>Skicka svaret</button><a class="btn ghost" href="#mitt-rum">Prova själv i Mitt rum</a></div>
          <p class="small" id="askNote" role="status">Svara på minst en sak. Svaret finns bara i länken du skickar, vi sparar inget.</p><p class="small hem-promise">${PROMISE}</p></section>`,
      mount(root) {
        const ans = {}, send = $("#askSend", root);
        root.addEventListener("click", (e) => { const c = e.target.closest("[data-like]"); if (!c) return; const li = c.closest("li"); ans[li.dataset.h] = +c.dataset.like; $$("[data-like]", li).forEach((x) => x.setAttribute("aria-pressed", x === c)); send.disabled = !Object.keys(ans).length; });
        send.addEventListener("click", () => { const nm = clean($("#askName", root).value);
          const url = new URL("delad/", document.baseURI).href + "#delad-s." + A.id + "." + Object.entries(ans).map(([h, v]) => pidOf(h) + (v ? "+" : "-")).join("_") + "~" + encodeURIComponent(nm);
          shareUrl(url, "Mitt svar", "Här är vad jag tycker om rummet.", send); $("#askNote", root).textContent = "Skicka länken tillbaka. När den öppnas hamnar svaren i rummet."; });
      } };
  };
  // the customer opens the answer: it lands in the room it was about
  const replyView = (A) => {
    if (!A) return empty("Svaret gick inte att öppna.");
    const r = H.room(A.id);
    const rows = Object.entries(A.answers).map(([h, v]) => `<li><img src="${RQ.cut(RQ.byHandle(h))}" alt=""><div><b>${esc(RQ.byHandle(h).name)}</b><span>${v ? "Gillar" : "Föreslår något annat"}</span></div></li>`).join("");
    if (r) { const fb = (r.feedback || []).filter((f) => !(f.name === A.name && JSON.stringify(f.answers) === JSON.stringify(A.answers))); H.patch(r.id, { feedback: [{ name: A.name, answers: A.answers, at: now() }, ...fb].slice(0, 10) }); }
    return { title: "Svar på ditt rum · RumIQ",
      html: `<header class="page-head wrap">${crumbs()}<span class="eyebrow">Svar på ditt rum</span><h1 class="h1">${A.name ? `${esc(A.name)} har svarat` : "Du har fått ett svar"}</h1>
          <p class="lead">${r ? `Svaret är sparat i ${esc(H.name(r))} i Mitt hem.` : "Rummet finns inte i den här webbläsaren, så svaret visas bara här."}</p></header>
        <section class="wrap hem-ask" style="padding-bottom:5rem"><ul class="hem-ask-list">${rows}</ul><div class="ctrl-row">${r ? `<a class="btn" href="#mitt-hem" data-hem-open="${esc(r.id)}">Öppna rummet</a>` : `<a class="btn" href="#mitt-hem">Till Mitt hem</a>`}</div></section>` };
  };
})();
