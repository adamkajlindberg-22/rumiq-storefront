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
  // svep2: the taste model, the style history ("Din stil över tid") and the Svep groups you are in follow the account too
  const SYNC = ["rumiq-home", "rumiq-wish", "rumiq-looks", "rumiq-boards", "rumiq-chat-saved", "rumiq-style", "rumiq-room-active", "rumiq-taste", "rumiq-style-log", "rumiq-groups"];
  const vault = (RQ.vault = {
    keys: SYNC,
    account: () => !!conf().serverSync && !!(RQ.ai && (RQ.ai.account || RQ.ai.live)()) && !!S.customer(),
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
  // the taste model writes through the shop's own store (flow.js): every change is queued for the account here
  if (RQ.taste) ["add", "boost", "reset"].forEach((m) => { const f = RQ.taste[m]; RQ.taste[m] = function (...a) { const out = f.apply(this, a); vault.queue("rumiq-taste"); return out; }; });
  // signed in with the account live: what this browser has goes up, what the account has comes down
  document.addEventListener("rq-auth", () => { if (vault.account()) { SYNC.forEach((k) => vault.pending.add(k)); vault.pull().then(() => vault.push()).catch(() => {}); } });

  /* ------------------------------------------------------------------ room projects */
  const ACTIVE = "rumiq-room-active";
  const now = () => new Date().toISOString();
  const typeName = (t) => (RQ.roomById(t) || {}).name || "Rum";
  const H = (RQ.hem = {});
  const fire = () => document.dispatchEvent(new CustomEvent("rq-hem"));
  H.rooms = () => (RQ.homeRooms ? RQ.homeRooms.list() : []);
  H.room = (id) => H.rooms().find((r) => r.id === id) || (H._peek && H._peek.id === id ? H._peek : null);
  H.save = (room) => { if (room && room.peek) return room; // a borrowed proposal (the partner's page) is never saved
    const all = H.rooms(), i = all.findIndex((r) => r.id === room.id); room.updated = now();
    if (i < 0) all.unshift(room); else all[i] = room;
    RQ.homeRooms.save(all); vault.queue("rumiq-home"); fire(); return room;
  };
  H.patch = (id, p) => { const r = H.room(id); return r ? H.save({ ...r, ...p }) : null; };
  H.create = ({ label, type, style = null, budget = null, items = [] }) => {
    const t = RQ.roomById(type) ? type : "vardagsrum";
    const r = { id: "rm" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), type: t, label: H.uniqueName(String(label || "").trim().slice(0, 37) || typeName(t)), style: RQ.STYLES[style] ? style : null,
      budget: budget > 0 ? Math.round(budget) : null, colours: [], material: "", notes: "", items: items.slice(0, 12), bought: {}, boards: [], feedback: [], at: now() };
    return H.save(r);
  };
  // never two rooms with the same name: "Vardagsrum", "Vardagsrum 2", "Vardagsrum 3" (device2 A4)
  H.uniqueName = (name, not) => { const have = new Set(H.rooms().filter((r) => r.id !== not).map((r) => H.name(r).toLowerCase())); if (!have.has(name.toLowerCase())) return name; let n = 2; while (have.has(`${name} ${n}`.toLowerCase())) n++; return `${name} ${n}`; };
  // a room of this type that already holds exactly these things (the same proposal, the same saved set): used instead of a second one
  H.sameSet = (type, items) => { const k = (l) => [...new Set((l || []).map((it) => it.h))].sort().join(); const want = k(items); return want ? H.rooms().find((r) => r.type === type && k(H.items(r)) === want) || null : null; };
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
  // the room's style: its own, else the one you found in Svep (your style profile) (device2 A5)
  H.styleOf = (r) => (r && RQ.STYLES[r.style] ? r.style : ((S.style && S.style()) || {}).style || null);
  H.progress = (r, pics = 0) => {
    const its = H.items(r), m = H.money(r), st = H.styleOf(r);
    const parts = [[st ? `Stil: ${RQ.STYLES[st].name.toLowerCase()}` : "Stil", !!st], [pics ? `${pics} ${pics === 1 ? "bild" : "bilder"}` : "Bilder", pics > 0], [its.length ? `${its.length} ${its.length === 1 ? "produkt vald" : "produkter valda"}` : "Produkter", its.length > 0], [r.budget ? `Budget ${kr(r.budget)}` : "Budget", !!r.budget]];
    const next = !st ? { label: "Välj stil", act: "style" } : !its.length ? { label: "Se ett förslag", act: "propose" } : !pics ? { label: "Se det i ditt rum", act: "see" } : !r.budget ? { label: "Välj budget", act: "budget" } : m.toBuy.length ? { label: "Köp det som är kvar", act: "buy" } : { label: "Allt är köpt", act: "open" };
    return { parts, next };
  };

  /* Rumsprojekt and Mitt hem are one: "Spara" in Mitt rum saves into the room it belongs to (the active one when it is
     this photo, else a new room named after the room type), and older Rumsprojekt become rooms once */
  const baseSaveProject = S.saveProject;
  S.saveProject = (p) => {
    const ok = baseSaveProject(p); if (ok && S.projects()[0]) { p = { ...p, id: S.projects()[0].id }; S.store.set("rumiq-projects", S.projects().map((x) => (x.id === p.id ? { ...x, hem: true } : x))); } // device3 X3: a saved project is part of its room at once, never turned into a second room on the next visit
    if (!ok || !RQ.room || !RQ.room.has()) return ok;
    const key = RQ.ai ? RQ.ai.projectKey() : null, act = H.activeId() && H.room(H.activeId());
    const scene = RQ.room.scene(), items = (p.handles || scene.map((it) => it.h)).filter((h) => RQ.byHandle(h)).map((h) => ({ h, v: 0 }));
    const g = RQ.room.get(), sameSample = act && g.sample && (act.sceneMap || act.type) === g.map; // the same sample room, opened again: still that room
    const r = act && (!act.pkey || act.pkey === key || sameSample) ? act : H.rooms().find((x) => x.pkey && x.pkey === key) || H.create({ label: typeName(RQ.room.get().type || "vardagsrum"), type: RQ.room.get().type || "vardagsrum" });
    H.patch(r.id, { items, scene, pkey: key, saved: { project: p.id, at: now() } }); H.setActive(r.id); return ok;
  };
  const migrate = () => { const had = new Set(H.rooms().map((r) => r.saved && r.saved.project).filter(Boolean)), old = S.projects().filter((p) => !p.hem && !had.has(p.id)); if (!old.length) { if (S.projects().some((p) => !p.hem)) S.store.set("rumiq-projects", S.projects().map((p) => ({ ...p, hem: true }))); return; }
    old.slice().reverse().forEach((p) => { const items = (p.handles || []).filter((h) => RQ.byHandle(h)).map((h) => ({ h, v: 0 })); const t = (RQ.byHandle((items[0] || {}).h) || { rooms: ["vardagsrum"] }).rooms[0];
      if (H.sameSet(t, items)) return;
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
  /* only what fits the room (device2 A7): the editor says what has a place in a room of that type (RQ.room.fits, room.js);
     what does not is left out of the set and the total, and named on the card */
  const fitted = (pr) => { const F = RQ.room && RQ.room.fits; let ok = null;
    if (typeof F === "function" && pr.items.length) { try { const r = F(pr.items, pr.type); ok = Array.isArray(r) ? r : r && (r.items || r.fit) ? r.items || r.fit : r && (r.out || r.left) ? pr.items.filter((it) => !(r.out || r.left).some((x) => (x.h || x) === it.h)) : null; } catch (e) { ok = null; } }
    if (!ok) return { ...pr, out: [] };
    const keep = new Set(ok.map((x) => x.h || x)), items = pr.items.filter((it) => keep.has(it.h)), out = pr.items.filter((it) => !keep.has(it.h)).map((it) => it.h);
    return { ...pr, items, out, total: items.reduce((a, it) => a + vPrice(it), 0) }; };
  H.title = (pr) => `Ditt ${roomWord(pr.type)}${pr.style ? ` i ${(RQ.STYLES[pr.style].name.split(" ")[0]).toLowerCase()} stil` : ""}`;
  const PROMISE = "Se ditt hem innan du köper.";
  H.PROMISE = PROMISE;

  // the card: style, colours, the set, total, budget; one obvious next step ("Se det i ditt rum"). Self-contained (delegated events).
  const cardState = new Map(); let seq = 0;
  H.slot = (spec) => { const id = "hp" + ++seq; cardState.set(id, { ...spec, budget: spec.budget || null }); return `<div class="hem-prop" data-hem-prop="${id}">${cardInner(id)}</div>`; };
  const cardInner = (id) => {
    const s = cardState.get(id), pr = fitted(H.propose(s)); s.pr = pr;
    const its = pr.items.map((it) => RQ.byHandle(it.h)), room = s.room ? H.room(s.room) : null;
    const types = ["vardagsrum", "sovrum", "kok", "hall", "badrum", "hemmakontor"];
    const budgetHtml = `<label class="hem-budget"><span>Budget <b>${kr(s.budget || pr.fullTotal)}</b></span><input type="range" data-hem-budget min="${Math.max(100, Math.floor(pr.min / 100) * 100)}" max="${Math.ceil(pr.fullTotal / 100) * 100}" step="100" value="${s.budget || Math.ceil(pr.fullTotal / 100) * 100}" aria-label="Budget i kronor" aria-valuetext="${esc(kr(s.budget || pr.fullTotal))}"></label>`;
    /* review N8: on the Svep result the card leads with what it offers; what is left out follows the buttons */
    const outNote = pr.out.length ? `<p class="small hem-left">${pr.out.length === 1 ? "1 sak får" : `${pr.out.length} saker får`} inte plats på borden i rummet och är inte med: ${pr.out.map((h) => esc(RQ.byHandle(h).name)).join(", ")}.</p>` : "";
    return `<div class="hem-prop-h"><span class="eyebrow">${s.from === "room" ? "Förslag för rummet" : "Ett färdigt rumsförslag"}</span><h3 class="h3">${esc(H.title(pr))}</h3>
        <p class="small hem-promise">${PROMISE}</p></div>
      ${s.compact ? "" : typeChips(s, pr, types)}
      ${pr.colours.length && !s.compact ? `<div class="hem-cols" role="img" aria-label="Färgerna i förslaget">${pr.colours.map((c) => `<i style="background:${esc(c)}"></i>`).join("")}</div>` : ""}
      ${s.compact ? `<div class="hem-prop-row${s.all ? " open" : ""}"><span class="hem-prop-thumbs" aria-hidden="true">${its.slice(0, 2).map((p) => `<img src="${RQ.cut(p)}" alt="">`).join("")}${its.length > 2 ? `<i>+${its.length - 2}</i>` : ""}</span><b>${kr(pr.total)}</b>${its.length > 3 ? `<button class="tlink" type="button" data-hem-all aria-expanded="${!!s.all}">${s.all ? "Visa färre" : `Visa alla ${its.length}`}</button>` : ""}</div>` : ""}
      <ul class="hem-prop-items${s.compact ? " compact" : ""}${s.all ? " open" : ""}">${its.map((p) => { const w = why(s, room, p); return `<li data-h="${p.handle}">${s.compact ? `<span class="hem-prop-im"><img src="${RQ.cut(p)}" alt=""></span>` : `<button type="button" data-sheet="${p.handle}" aria-label="Snabbtitt på ${esc(p.name)}"><img src="${RQ.cut(p)}" alt=""></button>`}<span>${esc(p.name)}${w ? `<small class="why">${esc(w)}</small>` : ""}</span><b>${kr(p.price)}</b></li>`; }).join("")}</ul>
      ${s.compact ? "" : outNote}
      ${pr.left.length ? `<p class="small hem-left">Budgeten räcker till ${its.length} av ${its.length + pr.left.length}. Kvar: ${pr.left.map((h) => esc(RQ.byHandle(h).name)).join(", ")}.</p>` : ""}
      ${s.compact ? "" : budgetHtml}
      <div class="hem-prop-sum"><span>${its.length} ${its.length === 1 ? "produkt" : "produkter"}</span><b>${kr(pr.total)}</b></div>
      <div class="ai-row hem-prop-acts"><button class="btn" type="button" data-hem-see>${RQ.roomIco}<span>Se det i ditt rum</span></button><button class="btn ghost" type="button" data-hem-buy>Köp allt · ${kr(pr.total)}</button></div>
      <div class="ai-row small-row">${s.noAsk ? "" : `<button class="tlink" type="button" data-hem-ask>Vad tycker du?</button>`}<button class="tlink" type="button" data-hem-reroll>Ett annat förslag</button>${room || s.compact ? "" : `<button class="tlink" type="button" data-hem-keep>Spara rummet</button>`}</div>
      ${s.compact ? outNote : ""}
      ${s.compact ? `<details class="hem-more"${s.open ? " open" : ""}><summary>Ändra rum och budget</summary><div class="hem-more-in">${typeChips(s, pr, types)}${budgetHtml}</div></details>` : ""}
      <p class="small" role="status" data-hem-msg>${room ? `Hör till ${esc(H.name(room))}.` : ""}</p>`;
  };
  // the reason on each thing in the proposal (RQ.why, svep.js): what the room lacks, what fits its kind and style, what you liked
  const why = (s, room, p) => { if (!RQ.why) return ""; const w = RQ.why.of(p, { room });
    return w || (s.style && p.styles.includes(s.style) ? `Passar stilen: ${RQ.STYLES[s.style].name}` : ""); };
  const typeChips = (s, pr, types) => s.from === "room" ? "" : `<div class="chips hem-prop-types" role="group" aria-label="Vilket rum?">${types.map((t) => `<button type="button" class="chip" data-hem-type="${t}" aria-pressed="${pr.type === t}">${esc(typeName(t))}</button>`).join("")}</div>`;
  let propUndo = null;
  document.addEventListener("click", (e) => { if (!e.target.closest("[data-hem-prop-undo]") || !propUndo) return; const u = propUndo; propUndo = null; $("#toast").classList.remove("show"); const r = H.room(u.id); if (!r) return;
    H.patch(u.id, { items: u.items, scene: u.scene, pkey: u.pkey, sceneMap: u.sceneMap, style: u.style, budget: u.budget }); const y = H.room(u.id); H.openInRoom({ room: y.type, items: H.items(y), style: y.style, budget: y.budget, project: y.id }).then(() => RQ.toast(`${esc(H.name(y))} är som förut.`)); });
  // the details stay open while you change the room or the budget inside them
  document.addEventListener("toggle", (e) => { const d = e.target; if (!d.matches || !d.matches(".hem-more")) return; const box = d.closest("[data-hem-prop]"), st = box && cardState.get(box.dataset.hemProp); if (st) st.open = d.open; }, true);
  const repaint = (box, focusSel) => { box.innerHTML = cardInner(box.dataset.hemProp); if (focusSel) { const f = $(focusSel, box); if (f) f.focus({ preventScroll: true }); } };
  // the room this proposal belongs to: the one it came from, else a new one named after the room type
  const ensureRoom = (s) => { if (s.room && H.room(s.room)) return H.room(s.room); const same = H.sameSet(s.pr.type, s.pr.items) || H.rooms().filter((x) => x.type === s.pr.type).sort((a, b) => ((b.updated || b.at || "") > (a.updated || a.at || "") ? 1 : -1))[0]; if (same) { s.room = same.id; return same; } // device3 X3: a room of this type you have takes the proposal; never a silent second one
    const r = H.create({ label: typeName(s.pr.type), type: s.pr.type, style: s.pr.style, budget: s.budget, items: s.pr.items }); s.room = r.id; return r; };
  document.addEventListener("input", (e) => { const r = e.target.closest("[data-hem-budget]"); if (!r) return; const box = r.closest("[data-hem-prop]"), s = cardState.get(box.dataset.hemProp); s.budget = +r.value; clearTimeout(s.t); s.t = setTimeout(() => repaint(box, "[data-hem-budget]"), 120); });
  document.addEventListener("click", (e) => {
    const box = e.target.closest("[data-hem-prop]"); if (!box) return; const s = cardState.get(box.dataset.hemProp); if (!s) return;
    const b = e.target.closest("button"); if (!b) return;
    if (b.matches("[data-hem-type]")) { s.type = b.dataset.hemType; repaint(box, `[data-hem-type="${s.type}"]`); return; }
    if (b.matches("[data-hem-all]")) { s.all = !s.all; repaint(box, "[data-hem-all]"); return; }
    if (b.matches("[data-hem-reroll]")) { s.avoid = [...new Set([...(s.avoid || []), ...s.pr.items.map((it) => it.h)])].slice(-12); repaint(box, "[data-hem-reroll]"); return; }
    if (b.matches("[data-hem-buy]")) { RQ.addMany(s.pr.items.map((it) => it.h + "::" + it.v), b, H.title(s.pr)); return; }
    if (b.matches("[data-hem-keep]")) { const r = ensureRoom(s); if (s.room === r.id) H.patch(r.id, { items: s.pr.items, style: s.pr.style, budget: s.budget || r.budget }); repaint(box); RQ.toast(`${esc(H.name(r))} är sparat. <a href="#mitt-hem">Visa i Mitt hem</a>`); return; }
    if (b.matches("[data-hem-see]")) { const r = ensureRoom(s), had = H.items(r), other = had.length && !H.sameSet(r.type, s.pr.items);
      // the proposal goes into the room you have; what stood there comes back with Ångra
      if (other) propUndo = { id: r.id, items: r.items, scene: r.scene, pkey: r.pkey, sceneMap: r.sceneMap, style: r.style, budget: r.budget };
      H.patch(r.id, { items: s.pr.items, style: s.pr.style, budget: s.budget || r.budget, ...(other ? { scene: null } : {}) });
      H.openInRoom({ room: r.type, items: s.pr.items, style: s.pr.style, budget: s.budget, project: r.id }).then(() => { if (other) RQ.toast(`Förslaget står nu i ${esc(H.name(r))}. <button type="button" class="tlink" data-hem-prop-undo>Ångra</button>`, 7000); }); return; }
    if (b.matches("[data-hem-ask]")) { const r = ensureRoom(s); if (!H.items(r).length) H.patch(r.id, { items: s.pr.items, style: s.pr.style }); repaint(box); H.askLink({ ...H.room(r.id), items: s.pr.items, style: s.pr.style || r.style }, $("[data-hem-ask]", box) || b); }
  });

  /* Inred åt mig in a style: the room you are in takes that style (device2 A5) */
  if (RQ.room && typeof RQ.room.suggestSet === "function") { const base = RQ.room.suggestSet;
    RQ.room.suggestSet = function (o) { const out = base.apply(this, arguments), st = o && o.style, id = H.activeId(), r = id && H.room(id);
      if (st && RQ.STYLES[st] && r && r.style !== st && RQ.ai && r.pkey && RQ.ai.projectKey() === r.pkey) H.patch(id, { style: st }); return out; }; }

  /* ------------------------------------------------------------------ into Mitt rum ("Se det i ditt rum") */
  const OWN = "rumiq-hem-own";
  document.addEventListener("rq-room", (e) => {
    if (e.detail !== "room" || !RQ.room || !RQ.room.has()) return; let w = null; try { w = JSON.parse(RQ.ss.get(OWN) || "null"); } catch (x) {} if (!w || !w.type) return;
    const g = RQ.room.get(); if (g.sample) return RQ.ss.set(OWN, ""); // a sample room has its own type
    RQ.ss.set(OWN, ""); if (Date.now() - (w.at || 0) > 36e5) return;
    // a room asked for with your own photo is made now, when the photo has really come (device2 A3), tied to this photo
    if (w.make && !w.made) { w.made = 1; const r = H.create({ label: w.make.label, type: w.type, style: w.style, items: w.make.items || [] }); H.setActive(r.id); if (RQ.ai) H.patch(r.id, { pkey: RQ.ai.projectKey() }); }
    if (g.type) return;
    RQ.room.setType(w.type); if (!RQ.room._want || !RQ.room._want.style) RQ.room._want = { style: RQ.STYLES[w.style] ? w.style : null, budget: w.budget > 0 ? +w.budget : null };
  });
  /* Into Mitt rum through the editor's own entry, RQ.room.openWith({ room, own, items, style, budget, project }) (room.js). */
  H.openInRoom = async ({ room = null, own = false, items = [], style = null, budget = null, project = null, swap = null, title = null, add = false } = {}) => {
    const R = RQ.room; if (!R) return;
    document.dispatchEvent(new CustomEvent("rq-hem-go")); // the room sheet or the moodboard steps aside
    if (project) H.setActive(project);
    // the editor's own entry (room.js): sample room or own photo (with its sign-in gate), placed by its rules, tied to the project
    // your own photo: the room type (and style) you already chose go with it, so the editor never asks "Vilket rum är det?" again.
    // Kept for the next own photo only (it survives the sign-in step), and dropped when a sample room comes instead.
    const t = room || (project && H.room(project) ? H.room(project).type : null);
    RQ.ss.set(OWN, own && t ? JSON.stringify({ type: t, style, budget, at: Date.now(), make: H._make || null }) : ""); H._make = null;
    const out = await R.openWith({ room, own, items: items.map((it) => (typeof it === "string" ? { h: it, v: 0 } : it)), style, budget, project, swap, ...(title ? { title } : {}), ...(add ? { add: true } : {}) });
    if (out && own) { RQ.ss.set(OWN, ""); const g = R.get(); if (t && g && !g.sample && !g.type) R.setType(t); } // the photo you already had
    if (out && project && RQ.ai) H.patch(project, { pkey: RQ.ai.projectKey() }); // only once the room is really open (not while it waits for sign-in)
    return out;
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
  /* a link to send: the phone's share sheet when there is one, and always a note on the page with the link in a field to copy
     (the share sheet can be closed, or not come at all); the note sits right under the button's row */
  const shareUrl = async (url, title, text, btn) => {
    const n = linkNote(url, false, btn); // on the page at once, whatever the share sheet or the clipboard do (device3 X2)
    let shared = null; try { if (navigator.share) shared = navigator.share({ title, text, url }); } catch (e) {}
    if (shared) shared.catch(() => {});
    try { await Promise.race([navigator.clipboard.writeText(url), new Promise((ok, no) => setTimeout(no, 1500))]); if (n && n.isConnected) $("p b", n).textContent = "Länken är kopierad."; } catch (e) {}
  };
  const linkNote = (url, copied, btn) => {
    const row = btn && btn.isConnected ? btn.closest(".ai-row, .ctrl-row") || btn : null; if (!row) { RQ.toast(`Kopiera länken och skicka den: <input type="text" readonly value="${esc(url)}" aria-label="Länken">`, 12000); return null; }
    let n = row.nextElementSibling; if (!n || !n.matches(".hem-link")) { n = document.createElement("div"); n.className = "hem-link"; row.after(n); }
    n.innerHTML = `<p role="status"><b>${copied ? "Länken är kopierad." : "Här är länken."}</b> Skicka den till vem du vill. Inget konto behövs för att öppna den.</p><div class="hem-link-row"><label class="sr" for="hl${++seq}">Länken</label><input id="hl${seq}" type="text" readonly value="${esc(url)}"><button class="btn ghost sm" type="button" data-copy-link>Kopiera</button></div>`;
    const inp = $("input", n); inp.addEventListener("focus", () => inp.select());
    $("[data-copy-link]", n).addEventListener("click", async (e) => { try { await navigator.clipboard.writeText(url); } catch (x) { inp.select(); try { document.execCommand("copy"); } catch (y) {} } e.currentTarget.textContent = "Kopierad"; $("p b", n).textContent = "Länken är kopierad."; });
    return n;
  };
  H.linkNote = (url, btn) => linkNote(url, false, btn);
  H.askLink = (r, btn) => { if (!r || !H.items(r).length) { RQ.toast("Välj några saker till rummet först."); return; } shareUrl(H.askUrl(r), "Vad tycker du?", `${H.name(r)}: vad tycker du? ${PROMISE}`, btn); };
  const parseAsk = (raw) => {
    const t = raw.indexOf("~", raw.lastIndexOf(".")) ; let core = raw, name = "";
    const k = raw.lastIndexOf("~"); if (k > 0 && raw.lastIndexOf(".") < k && !/^\d+$/.test(raw.slice(k + 1))) { core = raw.slice(0, k); try { name = clean(decodeURIComponent(raw.slice(k + 1))); } catch (e) {} }
    void t; const [id, type, style, list] = core.split(".");
    const items = (list || "").split("_").map((x) => { const [p, v] = x.split("~"); const h = byPid(p); return h ? { h, v: +v || 0 } : null; }).filter(Boolean);
    return items.length ? { id: clean(id), type: RQ.roomById(type) ? type : "vardagsrum", style: RQ.STYLES[style] ? style : null, items, name } : null;
  };
  const parseReply = (raw) => { let core = raw, name = ""; const k = raw.lastIndexOf("~"); if (k > 0) { core = raw.slice(0, k); try { name = clean(decodeURIComponent(raw.slice(k + 1))); } catch (e) {} }
    const [id, list] = core.split("."); const answers = {}, alts = {}; (list || "").split("_").forEach((x) => { const m = /^([0-9a-z]{4})([+-])([0-9a-z]{4})?$/.exec(x); const h = m && byPid(m[1]); if (!h) return; answers[h] = m[2] === "+" ? 1 : 0; const o = m[3] && m[2] === "-" && byPid(m[3]); if (o && o !== h) alts[h] = o; });
    return Object.keys(answers).length ? { id: clean(id), answers, alts, name } : null; };
  const baseShared = V.shared;
  V.shared = (payload) => {
    const p = String(payload || "");
    if (p.startsWith("f.")) return askView(parseAsk(p.slice(2)));
    if (p.startsWith("s.")) return replyView(parseReply(p.slice(2)));
    return baseShared(payload);
  };
  const crumbs = () => RQ.crumbs([["Hem", "hem"], ["Vad tycker du?"]]);
  const empty = (h) => ({ title: "Vad tycker du? · RumIQ", html: `<header class="page-head wrap">${crumbs()}<h1 class="h1">${h}</h1><p class="lead">Länken saknar något eller har klippts av. Be om en ny länk.</p><div class="ctrl-row" style="margin-top:1.4rem"><a class="btn" href="#mitt-rum">Till Mitt rum</a></div></header>` });
  /* a picture of a set that is not one of your rooms (the partner's page): the editor draws it in a sample room of the type,
     placed by its rules (R.snapshot with a borrowed project that is never saved). Resolves a data URL or null. */
  let peekN = 0;
  H.pictureOf = (type, items) => { const R = RQ.room; if (!R || typeof R.snapshot !== "function") return Promise.resolve(null);
    H._peek = { id: "peek" + ++peekN, peek: true, type, items, updated: String(peekN) };
    try { return Promise.resolve(R.snapshot(H._peek.id, 900)).catch(() => null); } catch (e) { return Promise.resolve(null); } finally { H._peek = null; } };
  // something else of the same kind (a lamp for a lamp, a textile for a textile), for the same room, best style first
  H.othersFor = (h, { type, style, not = [] } = {}) => { const p = RQ.byHandle(h); if (!p) return []; const no = new Set([h, ...not]);
    const base = RQ.room && RQ.room.alternatives ? RQ.room.alternatives(h) : [];
    const pool = (base.length ? base : RQ.PRODUCTS.filter((q) => q.cat === p.cat)).filter((q) => !no.has(q.handle));
    const sc = (q) => (q.rooms.includes(type) ? 2 : 0) + (style && q.styles.includes(style) ? 1 : 0);
    return pool.map((q, i) => ({ q, i })).sort((a, b) => sc(b.q) - sc(a.q) || a.i - b.i).map((x) => x.q).slice(0, 4); };
  const sampleOf = (t) => (RQ.SAMPLE_ROOMS.find((x) => x.id === t) || RQ.SAMPLE_ROOMS[0]).img.replace("-1600", "-900");
  // the partner's page: the room picture, and "Gillar" / "Föreslå något annat" (with a pick of the same kind) on each thing;
  // the answer goes back as a link, and "Prova själv i Mitt rum" opens the same set (with what you suggested) in a sample room
  const askView = (A) => {
    if (!A) return empty("Förslaget gick inte att öppna.");
    const ps = A.items.map((it) => RQ.byHandle(it.h)), total = A.items.reduce((s, it) => s + vPrice(it), 0);
    const ttl = `${A.name ? esc(A.name) + "s" : "Ett"} ${roomWord(A.type)}${A.style ? ` i ${RQ.STYLES[A.style].name.split(" ")[0].toLowerCase()} stil` : ""}`;
    const altsHtml = (p) => { const os = H.othersFor(p.handle, { type: A.type, style: A.style, not: A.items.map((it) => it.h) }); return os.length ? `<div class="hem-ask-alts" hidden><p class="small">Vad vill du ha i stället? Valfritt.</p><div class="hem-ask-altl" role="group" aria-label="Något annat i stället för ${esc(p.name)}">${os.map((q) => `<button type="button" data-alt="${q.handle}" aria-pressed="false"><img src="${RQ.cut(q)}" alt=""><span>${esc(q.name)}</span><b>${kr(q.price)}</b></button>`).join("")}</div></div>` : ""; };
    return { title: "Vad tycker du? · RumIQ",
      html: `<header class="page-head wrap">${crumbs()}<span class="eyebrow">Vad tycker du?</span><h1 class="h1">${ttl}</h1>
          <p class="lead">${ps.length} ${ps.length === 1 ? "sak" : "saker"} · ${kr(total)}. Säg vad du tycker om var och en, så skickar du svaret tillbaka med en länk. Inget konto behövs.</p></header>
        <section class="wrap hem-ask" style="padding-bottom:5rem">
          <figure class="hem-ask-pic" id="askPic"><span class="hem-ask-im"><img src="${esc(sampleOf(A.type))}" alt="Förslaget i ett exempelrum"><span class="hem-card-col" aria-hidden="true">${ps.slice(0, 5).map((p) => `<img src="${RQ.cut(p)}" alt="">`).join("")}</span></span><figcaption class="small" id="askCap">Förslaget i ett exempelrum. Ungefärlig bild.</figcaption></figure>
          <ul class="hem-ask-list">${ps.map((p) => `<li data-h="${p.handle}"><img src="${RQ.cut(p)}" alt=""><div><b>${esc(p.name)}</b><span>${kr(p.price)}</span></div>
            <div class="chips" role="group" aria-label="Vad tycker du om ${esc(p.name)}?"><button type="button" class="chip" data-like="1" aria-pressed="false">Gillar</button><button type="button" class="chip" data-like="0" aria-pressed="false">Föreslå något annat</button></div>${altsHtml(p)}</li>`).join("")}</ul>
          <label class="hem-ask-name">Ditt namn, om du vill<input type="text" id="askName" maxlength="30" autocomplete="given-name"></label>
          <div class="ctrl-row"><button class="btn" type="button" id="askSend" disabled>Skicka svaret</button><button class="btn ghost" type="button" id="askTry">${RQ.roomIco}<span>Prova själv i Mitt rum</span></button></div>
          <p class="small" id="askNote" role="status">Svara på minst en sak. Svaret finns bara i länken du skickar, vi sparar inget.</p><p class="small hem-promise">${PROMISE}</p></section>`,
      mount(root) {
        const ans = {}, alt = {}, send = $("#askSend", root), pic = $("#askPic .hem-ask-im > img", root);
        const now = () => A.items.map((it) => (alt[it.h] ? { h: alt[it.h], v: 0 } : it)); // the set as you would have it
        let n = 0; const draw = () => { const k = ++n; H.pictureOf(A.type, now()).then((u) => { if (!u || k !== n || !pic.isConnected) return; pic.src = u; pic.closest("figure").classList.add("snap"); $("#askCap", root).textContent = Object.keys(alt).length ? "Så här blir det med det du föreslår. Ungefärlig bild." : "Förslaget i ett exempelrum. Ungefärlig bild."; }); };
        draw();
        root.addEventListener("click", (e) => {
          const c = e.target.closest("[data-like]"), o = e.target.closest("[data-alt]");
          if (c) { const li = c.closest("li"), h = li.dataset.h, box = $(".hem-ask-alts", li); ans[h] = +c.dataset.like; $$("[data-like]", li).forEach((x) => x.setAttribute("aria-pressed", x === c)); if (box) box.hidden = ans[h] !== 0; if (ans[h] && alt[h]) { delete alt[h]; $$("[data-alt]", li).forEach((x) => x.setAttribute("aria-pressed", "false")); draw(); } send.disabled = false; return; }
          if (o) { const li = o.closest("li"), h = li.dataset.h, on = alt[h] !== o.dataset.alt; if (on) alt[h] = o.dataset.alt; else delete alt[h]; $$("[data-alt]", li).forEach((x) => x.setAttribute("aria-pressed", on && x === o)); draw(); }
        });
        $("#askTry", root).addEventListener("click", () => H.openInRoom({ room: A.type, items: now(), style: A.style }));
        send.addEventListener("click", () => { const nm = clean($("#askName", root).value);
          const url = new URL("delad/", document.baseURI).href + "#delad-s." + A.id + "." + Object.entries(ans).map(([h, v]) => pidOf(h) + (v ? "+" : "-" + (alt[h] ? pidOf(alt[h]) : ""))).join("_") + "~" + encodeURIComponent(nm);
          shareUrl(url, "Mitt svar", "Här är vad jag tycker om rummet.", send); $("#askNote", root).textContent = "Skicka länken tillbaka. När den öppnas hamnar svaren i rummet."; });
      } };
  };
  // the customer opens the answer: it lands in the room it was about
  const replyView = (A) => {
    if (!A) return empty("Svaret gick inte att öppna.");
    const r = H.room(A.id);
    const rows = Object.entries(A.answers).map(([h, v]) => { const o = A.alts[h] && RQ.byHandle(A.alts[h]); return `<li><img src="${RQ.cut(RQ.byHandle(h))}" alt=""><div><b>${esc(RQ.byHandle(h).name)}</b><span>${v ? "Gillar" : o ? `Föreslår ${esc(o.name)} i stället` : "Föreslår något annat"}</span></div></li>`; }).join("");
    if (r) { const same = (f) => f.name === A.name && JSON.stringify(f.answers) === JSON.stringify(A.answers) && JSON.stringify(f.alts || {}) === JSON.stringify(A.alts); const fb = (r.feedback || []).filter((f) => !same(f)); H.patch(r.id, { feedback: [{ name: A.name, answers: A.answers, alts: A.alts, at: now() }, ...fb].slice(0, 10) }); }
    return { title: "Svar på ditt rum · RumIQ",
      html: `<header class="page-head wrap">${crumbs()}<span class="eyebrow">Svar på ditt rum</span><h1 class="h1">${A.name ? `${esc(A.name)} har svarat` : "Du har fått ett svar"}</h1>
          <p class="lead">${r ? `Svaret är sparat i ${esc(H.name(r))}, i Mitt hem.` : "Rummet finns inte i den här webbläsaren, så svaret visas bara här."}</p></header>
        <section class="wrap hem-ask" style="padding-bottom:5rem"><ul class="hem-ask-list">${rows}</ul><div class="ctrl-row">${r ? `<a class="btn" href="#mitt-hem" data-hem-open="${esc(r.id)}">Öppna rummet</a>` : `<a class="btn" href="#mitt-hem">Till Mitt hem</a>`}</div></section>` };
  };
})();
