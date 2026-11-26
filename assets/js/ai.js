/* RumIQ Studio: AI room images and Studio Plus.
   The customer's Mitt rum arrangement becomes the guide; the server (Supabase Edge Function
   "generate") asks the image model to make it real and charges one image from the credits kept in
   Postgres. On the claude.ai preview or in demo sign-in nothing leaves the browser: "Skapa bild"
   shows the local arrangement labelled "Demo" and uses no images.
   Spec: docs/2026-11-22-ai-rumsbilder-och-studio-plus-design.md */
(function () {
  const RQ = window.RQ, S = RQ.shop, V = RQ.views, $ = RQ.$, $$ = RQ.$$, esc = RQ.esc, kr = S.kr;
  const CFG = (window.RQ_CONFIG && window.RQ_CONFIG.auth) || {};
  const ls = { get: (k, d) => S.store.get(k, d, true), set: S.store.set }; // the shop's one reader (commerce.js); the consent is kept as text
  const MAXP = 6;
  // the founder's limits, read from config.js (RQ_CONFIG.studio); the numbers here only stand in if that block is missing
  const LIM = { freeImages: 5, plusImages: 100, plusPrice: 99, dailyFree: 5, dailyPlus: 30, purchaseBonus: 10, ...((window.RQ_CONFIG && window.RQ_CONFIG.studio) || {}) };
  const PRICE = LIM.plusPrice, PLUS_IMAGES = LIM.plusImages, FREE_IMAGES = LIM.freeImages;

  const EDITS = {
    wall: { label: "Väggfärg", opts: { vit: "Varmvit", salvia: "Salvia", sand: "Sand", gra: "Ljusgrå", terrakotta: "Terrakotta", natt: "Nattblå" } },
    floor: { label: "Golv", opts: { ljusek: "Ljus ek", morkek: "Mörk ek", kalksten: "Kalksten", betong: "Betong" } },
    light: { label: "Ljus", opts: { morgon: "Morgon", dag: "Dag", kvall: "Kväll" } },
    style: { label: "Stil", opts: { skandinavisk: "Skandinavisk", mjuk: "Mjuk", minimalistisk: "Minimalistisk", klassisk: "Klassisk" } },
  };
  const ERR = {
    not_signed_in: "Logga in för att skapa AI-bilder.",
    no_consent: "Godkänn först hur bilden används.",
    no_credits: "Du har använt alla bilder för den här perioden.",
    daily_cap: "Du har nått dagens gräns. Prova igen i morgon.",
    global_cap: "Bildskaparen har nått sin gräns för månaden. Vi är tillbaka snart.",
    free_play_locked: "Väggfärg, golv, ljus och stil ingår i Studio Plus.",
    too_many_products: `Högst ${MAXP} produkter per bild. Ta bort någon och försök igen.`,
    empty_scene: "Ställ in minst en produkt i rummet först.",
    provider_failed: "Bilden kunde inte skapas just nu. Bilden drogs inte från ditt saldo.",
    not_configured: "Bildskaparen är inte påslagen än.",
    in_progress: "Bilden skapas redan. Vänta en stund.",
    network: "Ingen kontakt med servern. Kontrollera uppkopplingen och försök igen.",
    already_subscribed: "Du har redan Studio Plus.",
    quality_limit: "Du har använt dina tre ersättningar den här månaden.",
    not_eligible: "Ångerfristen på 14 dagar har gått ut. Du kan fortfarande säga upp abonnemanget.",
  };
  const errText = (code) => ERR[code] || "Något gick fel. Försök igen om en stund.";

  /* ------------------------------------------------------------------ server calls */
  // the account server (sign-in, saved data) and the AI server are two things: the AI picture is live only when the founder
  // has switched it on (RQ_CONFIG.studio.aiLive, once the generate function has its keys). Until then everyone gets the
  // honest preview demo and nothing is sent (device3 X1).
  const backend = () => !!(RQ.auth && RQ.auth.mode === "supabase" && RQ.auth.client && RQ.auth.client());
  const aiOn = () => !!((window.RQ_CONFIG && window.RQ_CONFIG.studio) || {}).aiLive;
  const live = () => backend() && aiOn();
  /* Preview = the copy inside claude.ai or on your own machine, where other sites are blocked on purpose.
     On the real site a server that does not answer is said to be exactly that. */
  const preview = () => { const c = (window.RQ_CONFIG && window.RQ_CONFIG.auth) || {}; if (c.preview != null) return !!c.preview; return c.provider !== "supabase" || location.protocol === "file:" || /^(localhost|127\.0\.0\.1|\[::1\])$|claude\.ai$|claudeusercontent\.com$/.test(location.hostname); };
  /* onStage: the server may answer as a stream of lines (application/x-ndjson), each {stage} a step it has reached
     ("retry" = the first picture failed the quality check and it is making one more, without charging twice) and the
     last line the answer. A server that answers with plain JSON works the same, only without the steps. */
  const fn = async (name, body, onStage) => {
    const token = RQ.auth.token ? await RQ.auth.token() : null;
    if (!token) { const e = new Error("not_signed_in"); throw e; }
    const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 150000); if (name === "generate") gen = ctrl;
    const fail = () => new Error(ctrl.stopped ? "cancelled" : "network");
    try {
      let r;
      try { r = await fetch(CFG.supabaseUrl.replace(/\/$/, "") + "/functions/v1/" + name, { method: "POST", signal: ctrl.signal, headers: { Authorization: "Bearer " + token, apikey: CFG.supabaseAnonKey, "Content-Type": "application/json", Accept: onStage ? "application/x-ndjson, application/json" : "application/json" }, body: JSON.stringify(body || {}) }); }
      catch (e) { throw fail(); }
      if (onStage && r.ok && r.body && /ndjson/.test(r.headers.get("content-type") || "")) {
        const rd = r.body.getReader(), dec = new TextDecoder(); let buf = "", last = null;
        const line = (l) => { l = l.trim(); if (!l) return; let m; try { m = JSON.parse(l); } catch (e) { return; } if (m && m.stage && !m.url && !m.error) { try { onStage(m.stage, m); } catch (e) {} } else last = m; };
        try { for (;;) { const { value, done } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true }); let i; while ((i = buf.indexOf("\n")) > -1) { line(buf.slice(0, i)); buf = buf.slice(i + 1); } } line(buf); }
        catch (e) { throw fail(); }
        if (!last) throw new Error("network");
        if (last.error) throw new Error(last.error);
        return last;
      }
      let data = {}; try { data = await r.json(); } catch (e) {}
      if (!r.ok) throw new Error(data.error || "server_error");
      return data;
    } finally { clearTimeout(t); if (gen === ctrl) gen = null; }
  };
  const rpc = async (name, args) => { const { data, error } = await RQ.auth.client().rpc(name, args || {}); if (error) throw new Error((error.message || "").trim() || "server_error"); return data; };

  const demoStatus = () => ({ signed_in: !!S.customer(), consent: !!ls.get("rumiq-ai-consent", null), plan: "free", plan_name: "Gratis", free_play: false, balance: FREE_IMAGES, daily_used: 0, daily_cap: LIM.dailyFree, quality_left: 3, demo: true });
  let cache = null, gen = null;
  const AI = (RQ.ai = {
    live, account: backend, EDITS, MAXP,
    async status(force) {
      if (RQ.auth && RQ.auth.start) { try { await RQ.auth.start(); } catch (e) {} }
      if (!live()) { if (!preview() && aiOn()) { if (RQ.auth) RQ.auth._started = null; return (cache = { signed_in: !!S.customer(), error: "network" }); } return (cache = demoStatus()); }
      if (!S.customer()) return (cache = { signed_in: false });
      if (cache && !force && cache._t > Date.now() - 15000) return cache;
      // A failed status call is an error, never demo mode: live generation would still charge.
      try { cache = { ...(await rpc("ai_status")), _t: Date.now() }; } catch (e) { cache = { signed_in: true, error: e.message === "network" ? "network" : "server_error" }; }
      return cache;
    },
    peek: () => cache,
    async consent() { if (live()) await rpc("ai_give_consent"); else ls.set("rumiq-ai-consent", new Date().toISOString()); cache = null; },
    async generate({ mode = "place", edit = null, idem, only = null, onStage = null, parent = null, pins = null }) {
      const R = RQ.room, scene = R.scene().filter((it) => !only || only.includes(it.h));
      if (!scene.length) throw new Error("empty_scene");
      if (scene.length > MAXP) throw new Error("too_many_products");
      const guide = await AI.composite(1280, only);
      if (!live() && pins && R.preview) { const u = await R.preview(1280).catch(() => null); if (u) { const mine = (gen = { stopped: false, abort() { this.stopped = true; } }); await new Promise((ok) => setTimeout(ok, 900)); if (gen === mine) gen = null; if (mine.stopped) throw new Error("cancelled"); return { demo: true, url: u }; } } // Placera och skapa while the AI is off: the pins drawn at true scale, nothing sent
      if (!live()) { if (!preview() && aiOn()) throw new Error("network"); const mine = (gen = { stopped: false, abort() { this.stopped = true; } }); await new Promise((ok) => setTimeout(ok, 1200)); if (gen === mine) gen = null; if (mine.stopped) throw new Error("cancelled"); return { demo: true, url: guide }; }
      const room = await AI.roomImage(1280);
      // v: the colour the picture shows (the cut-out is the first colour); the server answers at the room photo's size and shape
      const rm = RQ.room.get(), res = await fn("generate", { idem, mode, edit, scene: scene.map((it) => ({ h: it.h, v: 0, x: it.x, y: it.y, w: it.w, flip: !!it.flip })), room, guide, size: { w: rm.w, h: rm.h }, ...(parent ? { parent } : {}), ...(pins ? { pins: pins.map((x) => { const q = RQ.byHandle(x.h); return { ...x, name: q.en || q.name, tone: (q.tone || [])[x.v || 0] || (q.tone || [])[0] || null, colour: ((q.variants || [])[x.v || 0]) || null }; }), room_info: { type: rm.type || null, sample: !!rm.sample, map: rm.map || null, known: rm.known || null } } : {}) }, onStage); // parent: the room's first picture, so the account keeps the versions together
      cache = null; return res;
    },
    async checkout() { const r = await fn("stripe-checkout", { consent: true }); location.href = r.url; },
    async portal() { const r = await fn("stripe-portal", {}); location.href = r.url; },
    async withdrawQuote() { return (await fn("ai-withdraw", {})).quote; },
    async withdraw() { const r = await fn("ai-withdraw", { confirm: true }); cache = null; return r; },
    async qualityRefund(id, reason) { const n = await rpc("ai_quality_refund", { p_gen: id, p_reason: reason }); cache = null; return n; },

    /* the customer's room photo, scaled */
    async roomImage(max) {
      const room = RQ.room.get(); const im = await load(room.img);
      const k = Math.min(1, max / Math.max(room.w, room.h)), W = Math.round(room.w * k), H = Math.round(room.h * k);
      const cv = document.createElement("canvas"); cv.width = W; cv.height = H; cv.getContext("2d").drawImage(im, 0, 0, W, H);
      return cv.toDataURL("image/jpeg", 0.86);
    },
    /* the arrangement exactly as Mitt rum shows it: bottom-centre anchored cut-outs, width in % of the room */
    /* stop waiting for a picture that is being made */
    stop() { if (gen) { gen.stopped = true; gen.abort(); } },
    async composite(max, only) {
      const R = RQ.room, room = R.get(); const bg = await load(room.img);
      const k = Math.min(1, max / Math.max(room.w, room.h)), W = Math.round(room.w * k), H = Math.round(room.h * k);
      const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const cx = cv.getContext("2d"); cx.drawImage(bg, 0, 0, W, H);
      for (const it of R.ordered()) {
        if (only && !only.includes(it.h)) continue;
        const p = RQ.byHandle(it.h); let im; try { im = await load(R.cutIn ? R.cutIn(p) : RQ.cut(p)); } catch (e) { continue; }
        const w = W * it.w / 100, h = w * im.naturalHeight / im.naturalWidth * (it.sy || 1), x = W * it.x / 100 - w / 2, y = H * it.y / 100 - h;
        cx.save(); cx.filter = R.lightFilter(it.light); if (it.flip) { cx.translate(x + w, y); cx.scale(-1, 1); cx.drawImage(im, 0, 0, w, h); } else cx.drawImage(im, x, y, w, h); cx.restore();
      }
      return cv.toDataURL("image/jpeg", 0.86);
    },
  });
  const load = (src) => new Promise((ok, bad) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => ok(i); i.onerror = bad; i.src = src; });

  /* ------------------------------------------------------------------ the picture at the room photo's shape */
  // The server is asked for the photo's own size. Whatever comes back is drawn at the photo's aspect ratio, cropped
  // around the middle when the shape differs (never stretched), so the before/after slider lines up with the photo.
  const toBlob = (cv, q) => new Promise((ok, bad) => { try { cv.toBlob((b) => (b ? ok(b) : bad(new Error("blob"))), "image/jpeg", q || 0.88); } catch (e) { bad(e); } });
  const fitTo = async (src, rw, rh, max = 1600) => {
    const im = await load(src), nw = im.naturalWidth, nh = im.naturalHeight;
    const s = Math.min(nw / rw, nh / rh), sw = rw * s, sh = rh * s, k = Math.min(1, max / Math.max(sw, sh));
    const W = Math.max(1, Math.round(sw * k)), H = Math.max(1, Math.round(sh * k));
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    cv.getContext("2d").drawImage(im, (nw - sw) / 2, (nh - sh) / 2, sw, sh, 0, 0, W, H);
    return { blob: await toBlob(cv), w: W, h: H, cropped: Math.abs(nw / nh - rw / rh) > 0.01 };
  };

  /* ------------------------------------------------------------------ Mina rumsbilder: the image library
     Every AI picture is kept with its before picture (the room photo it was made from), in IndexedDB on this device:
     localStorage is far too small for pictures. Store "rooms" holds one record per room project (the photo, once),
     "pics" one per picture (version). Removing a project's last picture removes its photo too.
     With RQ_CONFIG.studio.serverLibrary on and a real account, the list comes from the private results bucket instead
     (edge function "ai-library", see studio-server.md); nothing of it is used until then. */
  const isFull = (e) => !!e && (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED" || e.code === 22 || /quota/i.test(String(e.message || "")));
  const Lib = (() => {
    let dbp = null;
    const open = () => dbp || (dbp = new Promise((ok, bad) => {
      let rq; try { rq = indexedDB.open("rumiq-studio", 1); } catch (e) { bad(e); return; }
      rq.onupgradeneeded = () => { const db = rq.result; if (!db.objectStoreNames.contains("pics")) db.createObjectStore("pics", { keyPath: "id" }); if (!db.objectStoreNames.contains("rooms")) db.createObjectStore("rooms", { keyPath: "key" }); };
      rq.onsuccess = () => ok(rq.result); rq.onerror = () => bad(rq.error || new Error("db")); rq.onblocked = () => bad(new Error("db"));
    }).catch((e) => { dbp = null; throw e; }));
    // one transaction; fn gets the stores and returns a function that reads the answer once it is written
    const tx = async (mode, fn) => {
      const db = await open();
      return new Promise((ok, bad) => {
        let t, read;
        const no = (e) => bad(isFull(e) ? new Error("full") : e || new Error("db"));
        try { t = db.transaction(["pics", "rooms"], mode); read = fn(t.objectStore("pics"), t.objectStore("rooms")); } catch (e) { no(e); return; }
        t.oncomplete = () => { try { ok(read ? read() : undefined); } catch (e) { bad(e); } };
        t.onerror = (e) => { if (e && e.preventDefault) e.preventDefault(); no(t.error || (e.target && e.target.error)); };
        t.onabort = () => no(t.error);
      });
    };
    const all = (st) => { const r = st.getAll(); return () => r.result || []; };
    return {
      async save(pic, room) { return tx("readwrite", (P, R) => { if (room) { const g = R.get(room.key); g.onsuccess = () => { try { if (!g.result) R.put(room); } catch (e) {} }; } P.put(pic); }); },
      async list() { let pr, rr; await tx("readonly", (P, R) => { pr = all(P); rr = all(R); }); return { pics: pr().sort((a, b) => (a.at < b.at ? 1 : -1)), rooms: Object.fromEntries(rr().map((r) => [r.key, r])) }; },
      async remove(id) {
        let pic = null, room = null;
        const { pics, rooms } = await this.list(); pic = pics.find((p) => p.id === id) || null; if (!pic) return null;
        const last = !pics.some((p) => p.id !== id && p.project === pic.project); room = last ? rooms[pic.project] || null : null;
        await tx("readwrite", (P, R) => { P.delete(id); if (room) R.delete(room.key); });
        return { pic, room };
      },
      async update(ids, patch) { const { pics } = await this.list(); const hit = pics.filter((p) => ids.includes(p.id)); if (hit.length) await tx("readwrite", (P) => { hit.forEach((p) => P.put({ ...p, ...patch })); }); return hit.length; },
      async restore(u) { if (u && u.pic) await tx("readwrite", (P, R) => { P.put(u.pic); if (u.room) R.put(u.room); }); },
      async clear() { await tx("readwrite", (P, R) => { P.clear(); R.clear(); }); },
    };
  })();
  const autosave = () => S.store.get("rumiq-ai-autosave", true) !== false;
  // how many pictures the library holds, kept beside it so Sparat can put Mina rumsbilder first without waiting for IndexedDB
  const libCount = () => { const n = S.store.get("rumiq-ai-n", 0); return n > 0 ? Math.floor(n) : 0; };
  const setCount = (n) => (n > 0 ? S.store.set("rumiq-ai-n", n) : S.store.del("rumiq-ai-n")); // nothing kept when the library is empty ("Rensa allt" leaves no trace)
  const recount = () => Lib.list().then((r) => { setCount(r.pics.length); return r.pics.length; }).catch(() => 0);
  const remoteLib = () => !!((window.RQ_CONFIG && window.RQ_CONFIG.studio) || {}).serverLibrary && live() && !!S.customer();
  /* the one promise before sign-in, the same words everywhere (the sign-in sheet, Mitt rum's card, Skapa ditt första rum):
     how many free pictures, honest about the preview, and where the pictures are kept */
  AI.promise = (long) => { const s = `${FREE_IMAGES} AI-bilder gratis i månaden med konto${live() ? "" : ", när AI-bilderna är igång"}`;
    return long ? `${s}. Bilderna sparas privat ${((window.RQ_CONFIG && window.RQ_CONFIG.studio) || {}).serverLibrary && live() ? "i ditt konto" : "på den här enheten"}.` : s; };

  /* the room project: one per room photo. Versions (every picture made in the same room) belong to it, and so does a
     Rumsprojekt saved from Mitt rum. "Fortsätt i Mitt rum" puts the photo back under its old key (rumiq-ai-proj). */
  const PMAP = "rumiq-ai-proj";
  AI.projectKey = () => { const r = RQ.room && RQ.room.get(); if (!r) return null; const at = String(r.at || `${r.w}x${r.h}`), m = S.store.get(PMAP, {}); return typeof m[at] === "string" ? m[at] : "r" + at.replace(/\D/g, "").slice(-14); };
  const keepKey = (key) => { const r = RQ.room.get(); if (!r || !r.at) return; const m = S.store.get(PMAP, {}); m[r.at] = key; const ks = Object.keys(m); ks.slice(0, Math.max(0, ks.length - 30)).forEach((k) => delete m[k]); S.store.set(PMAP, m); };
  const baseSave = S.saveProject;
  S.saveProject = (p) => baseSave(RQ.room && RQ.room.has() && !(p && p.studio) ? { ...p, studio: AI.projectKey() } : p);

  /* one picture as the viewer knows it: urls to show, and the record behind it */
  const urls = new Map(); // blob -> object URL, made once
  const blobUrl = (b) => { if (!b) return ""; if (typeof b === "string") return b; if (!urls.has(b)) urls.set(b, URL.createObjectURL(b)); return urls.get(b); };
  const verOf = (pic, room) => ({ ...pic, url: pic.url || blobUrl(pic.after), before: pic.beforeUrl || blobUrl(room && room.photo) || "" });
  const roomName = (room) => { const m = (room && room.meta) || {}; const t = m.type && RQ.roomById && RQ.roomById(m.type); return t ? t.name : m.sample ? "Exempelrum" : "Mitt rum"; };
  const dateText = (iso) => { try { return new Date(iso).toLocaleDateString(window.RQ_LANG === "en" ? "en-GB" : "sv-SE", { day: "numeric", month: "long" }); } catch (e) { return ""; } };
  const itemsTotal = (items) => items.reduce((s, it) => { const r = S.variantById(it.h + "::" + (it.v || 0)); return s + (r && r.variant ? r.variant.price : (RQ.byHandle(it.h) || {}).price || 0); }, 0);
  const liveItems = (items) => (items || []).filter((it) => it && RQ.byHandle(it.h));

  /* ------------------------------------------------------------------ before/after viewer (the sheet and Sparat) */
  const KNOB = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7l-5 5 5 5M15 7l5 5-5 5"/></svg>';
  // other: null = compare with the before picture (the room photo), or another version of the same room
  const baHtml = (v, other, x, many) => {
    const left = other ? `Version ${other.n}` : "Före";
    const right = other ? `Version ${v.n} · ${v.demo ? "Förhandsvisning" : "AI-bild"}` : (v.demo ? "Förhandsvisning" : "RumIQ · AI-bild");
    const src2 = other ? other.url : v.before;
    return `<figure class="ai-ba${x <= 22 ? " lo" : ""}${x >= 78 ? " hi" : ""}" data-ba style="--x:${x}%;--ar:${v.w} / ${v.h}">
      <img class="after" src="${esc(v.url)}" alt="${v.demo ? "Din uppställning i rummet" : `AI-bild av ditt rum med produkterna${many ? `, version ${v.n}` : ""}`}" width="${v.w}" height="${v.h}">
      ${src2 ? `<img class="before" src="${esc(src2)}" alt="${other ? `Version ${other.n}` : "Rummet före"}">` : ""}
      <span class="ai-tag ai-tag-b" aria-hidden="true">${left}</span><span class="ai-tag ai-tag-a">${right}</span>
      ${src2 ? `<input type="range" min="0" max="100" value="${x}" aria-label="${other ? `Jämför version ${other.n} och ${v.n}` : "Jämför före och efter"}" aria-valuetext="${esc(baText(x, other))}"><span class="ai-knob" aria-hidden="true">${KNOB}</span><span class="ai-ba-hint" aria-hidden="true">Dra för att jämföra</span>` : ""}</figure>`;
  };
  const baText = (x, other) => `${other ? `Version ${other.n}` : "Före"} ${Math.round(x)} %`;
  const baWire = (fig, other, onTouch) => {
    const range = $("input", fig); if (!range) return { set() {} };
    const set = (x) => { x = Math.max(0, Math.min(100, x)); fig.style.setProperty("--x", x + "%"); fig.classList.toggle("lo", x <= 22); fig.classList.toggle("hi", x >= 78); range.value = String(Math.round(x)); range.setAttribute("aria-valuetext", baText(x, other)); };
    range.addEventListener("input", () => { fig._stop = true; fig.classList.add("touched"); set(+range.value); if (onTouch) onTouch(+range.value); });
    return { set };
  };
  const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  // the moment: your room, then the made room sweeping in over it, settling with most of the new picture showing
  const reveal = (fig, ctl, rest) => {
    if (!fig || calm()) { ctl.set(rest); return; }
    const ease = (t) => 1 - Math.pow(1 - t, 3), seg = [[100, 14, 950], [14, 14, 260], [14, rest, 520]]; let i = 0, t0 = 0;
    ctl.set(100);
    const step = (ts) => { if (fig._stop || !fig.isConnected) return; if (!t0) t0 = ts; const [a, b, d] = seg[i], p = Math.min(1, (ts - t0) / d); ctl.set(a + (b - a) * ease(p)); if (p >= 1) { i++; t0 = ts; if (i >= seg.length) return; } requestAnimationFrame(step); };
    const im = $("img.after", fig), go = () => setTimeout(() => requestAnimationFrame(step), 160);
    if (im && !im.complete) im.addEventListener("load", go, { once: true }); else go();
  };
  const versHtml = (list, cur, cmp) => list.length < 2 ? "" : `<div class="ai-vers" role="group" aria-label="Versioner">${list.map((v, i) => `<button type="button" class="ai-ver" data-ver="${i}" aria-pressed="${i === cur}" aria-label="Version ${v.n}"><img src="${esc(v.url)}" alt=""><span aria-hidden="true">${v.n}</span></button>`).join("")}</div>
    <div class="ai-cmp" role="group" aria-label="Jämför med"><span>Jämför med</span><button type="button" class="chip" data-cmp="-1" aria-pressed="${cmp < 0}">Före</button>${list.map((v, i) => (i === cur ? "" : `<button type="button" class="chip" data-cmp="${i}" aria-pressed="${cmp === i}">Version ${v.n}</button>`)).join("")}</div>`;

  /* ------------------------------------------------------------------ download and share, with the label burned in */
  const T = (t) => (window.RQ_LANG === "en" && window.RQ_t && window.RQ_t(t)) || t; // words drawn into a picture are not in the page, so they are translated here
  const pill = (cx, text, x, y, fs) => {
    text = T(text);
    cx.font = `600 ${fs}px "Familjen Grotesk", system-ui, sans-serif`; const w = cx.measureText(text).width + fs * 1.3, h = fs * 1.9;
    cx.fillStyle = "rgba(247,247,244,.92)"; if (cx.roundRect) { cx.beginPath(); cx.roundRect(x, y, w, h, h / 2); cx.fill(); } else cx.fillRect(x, y, w, h);
    cx.fillStyle = "#22252A"; cx.textBaseline = "middle"; cx.fillText(text, x + fs * 0.65, y + h / 2 + fs * 0.04);
  };
  const saveFile = (blob, name) => { const u = URL.createObjectURL(blob), a = document.createElement("a"); a.href = u; a.download = name; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); };
  const stamp = () => new Date().toISOString().slice(0, 10);
  const labelled = async (v) => {
    const im = await load(v.url), W = im.naturalWidth, H = im.naturalHeight, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const cx = cv.getContext("2d"); cx.drawImage(im, 0, 0, W, H); const fs = Math.max(13, Math.round(Math.max(W, H) * 0.017)); pill(cx, v.demo ? "RumIQ · Förhandsvisning" : "RumIQ · AI-bild", fs, H - fs * 3, fs);
    return toBlob(cv, 0.9);
  };
  const pairBlob = async (v) => {
    const a = await load(v.url), b = v.before ? await load(v.before) : null, W = a.naturalWidth, H = a.naturalHeight;
    if (!b) return labelled(v);
    const stack = W >= H, gap = Math.round(Math.max(W, H) * 0.012), cv = document.createElement("canvas");
    cv.width = stack ? W : W * 2 + gap; cv.height = stack ? H * 2 + gap : H;
    const cx = cv.getContext("2d"); cx.fillStyle = "#F7F7F4"; cx.fillRect(0, 0, cv.width, cv.height);
    cx.drawImage(b, 0, 0, W, H); const ox = stack ? 0 : W + gap, oy = stack ? H + gap : 0; cx.drawImage(a, ox, oy, W, H);
    const fs = Math.max(13, Math.round(Math.max(W, H) * 0.02));
    pill(cx, "Före", fs, fs, fs); pill(cx, v.demo ? "Efter · RumIQ Demo" : "Efter · RumIQ AI-bild", ox + fs, oy + fs, fs);
    return toBlob(cv, 0.9);
  };
  const download = async (v) => { try { saveFile(await labelled(v), `rumiq-ai-bild-${stamp()}${v.n > 1 ? "-v" + v.n : ""}.jpg`); } catch (e) { RQ.toast("Bilden gick inte att ladda ner. Försök igen."); } };
  // "Vad tycker du?" (was "Visa någon"): the before and after in one picture, through the phone's own share sheet when there is one
  // "Ändra nålarna": back to the photo, the focus on the first pin (review: not on Skapa bilden)
  document.addEventListener("click", (e) => { if (!e.target.closest("#aiPins")) return; setTimeout(() => { const st = document.getElementById("plStage"), p = st && st.querySelector("[data-pin]"); if (!p) return; st.scrollIntoView({ block: "nearest", behavior: calm() ? "auto" : "smooth" }); p.focus({ preventScroll: true }); }, 80); });
  let offer = null;
  document.addEventListener("click", (e) => { if (!e.target.closest("[data-ai-offer]") || !offer) return; saveFile(offer, `rumiq-fore-efter-${stamp()}.jpg`); offer = null; $("#toast").classList.remove("show"); RQ.toast("Bilden med före och efter är nedladdad."); });
  const share = async (v, btn) => {
    // "Vad tycker du?": the room's link on the page too (the partner can answer on it), beside the picture (device3 X2)
    const H = RQ.hem, rid = (v && v.roomId) || (H && H.activeId && H.activeId()), hr = rid && H && H.room(rid), rm = (RQ.room && RQ.room.get()) || {};
    const its = liveItems(v && v.items).map((it) => ({ h: it.h, v: it.v || 0 })); // the link holds exactly what the picture shows
    if (H && H.linkNote && its.length) H.linkNote(H.askUrl({ ...(hr || {}), id: hr ? hr.id : "rum", type: (hr && hr.type) || rm.type || rm.map || "vardagsrum", style: hr ? hr.style : null, items: its }), btn);
    if (btn) btn.disabled = true;
    try {
      const blob = await pairBlob(v), file = new File([blob], "rumiq-fore-efter.jpg", { type: "image/jpeg" });
      if (navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: T("Före och efter"), text: T("Mitt rum före och efter, gjort i RumIQ.") }); } catch (e) { if (e && e.name !== "AbortError") throw e; }
      } else { offer = blob; RQ.toast(`Skicka länken${its.length && H && H.linkNote ? " ovan" : ""}. Vill du ha bilden med före och efter också? <button type="button" class="tlink" data-ai-offer>Ladda ner bilden</button>`, 8000); } // offered, never downloaded by itself
    } catch (e) { RQ.toast("Bilden gick inte att dela just nu. Ladda ner den i stället."); }
    finally { if (btn && btn.isConnected) btn.disabled = false; }
  };
  const ICON_SHARE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v6h14v-6"/></svg>';

  /* ------------------------------------------------------------------ the AI sheet */
  const el = document.createElement("div");
  el.className = "sheet ai-sheet"; el.id = "aiSheet"; el.setAttribute("aria-hidden", "true"); el.inert = true;
  el.innerHTML = `<div class="sheet-scrim" data-ai-close></div><div class="sheet-in" role="dialog" aria-modal="true" aria-labelledby="aiTitle" tabindex="-1"><div class="sheet-grab" aria-hidden="true"><span></span></div><button class="iconbtn sheet-x" type="button" data-ai-close aria-label="Stäng">${RQ.ICO5 ? RQ.ICO5.x : "×"}</button><div class="ai-body"></div></div>`;
  document.body.appendChild(el);
  const body = $(".ai-body", el), box = $(".sheet-in", el);
  let isOpen = false, ret = null, busy = false, last = null, pick = {}, chosen = null, pending = null;
  const open = () => { if (!isOpen) { ret = document.activeElement; RQ.closeAll && RQ.closeAll(); } isOpen = true; el.inert = false; el.classList.add("open"); el.setAttribute("aria-hidden", "false"); document.documentElement.classList.add("sheet-lock"); setTimeout(() => { const f = document.activeElement; if (!f || f === document.body || !box.contains(f)) box.focus({ preventScroll: true }); }, 30); }; // a control that was given focus on purpose keeps it (a version, a compare chip)
  const close = () => { if (busy) { AI.stop(); return; } isOpen = false; el.classList.remove("open"); el.setAttribute("aria-hidden", "true"); el.inert = true; document.documentElement.classList.remove("sheet-lock"); if (ret && ret.focus && document.contains(ret)) ret.focus({ preventScroll: true }); AI.hydrate(); };
  const show = (html, narrow, wide) => { body.innerHTML = html; el.classList.toggle("narrow", !!narrow); el.classList.toggle("wide", !!wide); box.scrollTop = 0; open(); }; // narrow: a short message gets a dialog its own size; wide: the picture as large as the window allows
  el.addEventListener("click", (e) => { if (e.target.closest("[data-ai-close]")) close(); });
  // the cart opens over the page, so the picture steps aside first (Visa varukorgen here, or Visa in the toast)
  document.addEventListener("click", (e) => { if (isOpen && !busy && e.target.closest && e.target.closest("[data-open-cart]")) close(); }, true);
  document.addEventListener("keydown", (e) => { if (isOpen && e.key === "Escape") { e.stopPropagation(); close(); } }, true);

  const balanceLine = (st) => st.demo ? AI.promise() : `${st.balance} ${st.balance === 1 ? "bild" : "bilder"} kvar${st.plan === "plus" ? " i Studio Plus" : " den här månaden"}`;
  // the picture shows a product's first colour; when the cart holds it in another, the row says both, so the cart is not doubted
  const colourNote = (p, v = 0) => { const shown = p.variants[v] || p.variants[0], inC = [...new Set(S.cartLines().filter((l) => l.product.handle === p.handle).map((l) => l.variant && l.variant.title).filter(Boolean))];
    return inC.length && !inC.includes(shown) ? `I varukorgen: ${inC[0]} · bilden visar ${shown}` : `Bilden visar färgen ${shown}`; };
  // Byt and another colour without starting over: the editor's Byt at that thing (room.js R.openSwap), then Skapa igen makes a new version.
  // Shown only when the editor has it.
  const swapOk = () => !!(RQ.room && typeof RQ.room.openSwap === "function");
  const swapBtns = (p, swap) => swap ? `<span class="ai-swap">${(p.variants || []).length > 1 ? `<button class="tlink" type="button" data-ai-swap="${p.handle}" data-colour="1">Prova en annan färg</button>` : ""}<button class="tlink" type="button" data-ai-swap="${p.handle}">Byt produkt</button></span>` : "";
  const productsList = (items, swap) => `<ul class="ai-prods">${items.map((it) => { const p = RQ.byHandle(it.h), r = S.variantById(it.h + "::" + (it.v || 0)), price = r && r.variant ? r.variant.price : p.price; return `<li><button type="button" data-sheet="${p.handle}" aria-label="Snabbtitt på ${esc(p.name)}"><img src="${RQ.cut(p)}" alt=""></button><div><b>${esc(p.name)}</b><span>${kr(price)}${p.variants ? ` · <em>${esc(colourNote(p, it.v || 0))}</em>` : ""}</span>${swapBtns(p, swap)}</div></li>`; }).join("")}</ul>
      <div class="ai-sum"><span>Det här finns i bilden</span><b>${kr(itemsTotal(items))}</b></div>`;

  // how long pictures are kept: with the account library on (RQ_CONFIG.studio.serverLibrary) the before picture is kept beside the AI picture
  const keepText = (cap) => { const t = ((window.RQ_CONFIG && window.RQ_CONFIG.studio) || {}).serverLibrary ? "rumsfotot som skickas till bildtjänsten raderas efter 30 dagar. AI-bilderna och bilden före sparas privat i ditt konto tills du tar bort dem." : "rumsfotot raderas efter 30 dagar. AI-bilderna sparas i ditt konto, och i Mitt hem på den här enheten, tills du tar bort dem."; return cap ? t[0].toUpperCase() + t.slice(1) : t; };
  const viewSignin = () => show(`<div class="ai-pad"><span class="eyebrow">AI-bild av ditt rum</span><h2 id="aiTitle" class="ai-h">Logga in för att skapa bilden.</h2>
      <p class="ai-lead">${AI.promise(true)}</p>
      <div class="ai-row"><a class="btn" href="#konto" data-after="mitt-rum" data-ai-after data-ai-close>Logga in</a><a class="btn ghost" href="#skapa-konto" data-after="mitt-rum" data-ai-after data-ai-close>Skapa konto</a></div></div>`, true);

  const viewConsent = () => {
    const smp = !!(RQ.room && RQ.room.get && (RQ.room.get() || {}).sample); // a sample room: our photo, nothing of yours but the arrangement
    show(`<div class="ai-pad"><span class="eyebrow">Innan första bilden</span><h2 id="aiTitle" class="ai-h">${smp ? "Så används bilden." : "Så används din bild."}</h2>
      <ul class="ai-list">
        <li><b>Det här skickas:</b> ${smp ? "exempelrummets foto och hur du har ställt produkterna. Ett eget foto skickas först när du använder ett." : "fotot av ditt rum och hur du har ställt produkterna."}</li>
        <li><b>Hit:</b> RumIQ:s server i EU och bildtjänsten som skapar bilden.</li>
        <li><b>Så länge:</b> ${smp ? `AI-bilderna sparas ${remoteLib() ? "privat i ditt konto" : "i Mitt hem på den här enheten"} tills du tar bort dem. Ett eget rumsfoto raderas efter 30 dagar.` : keepText()}</li>
        <li><b>Aldrig:</b> vi använder inte dina bilder för att träna AI och visar dem inte för någon annan.</li>
      </ul>
      <label class="check ai-check"><input type="checkbox" id="aiOk"> Jag godkänner att bilden skickas för att skapa AI-bilder.</label>
      <div class="ai-row"><button class="btn" type="button" id="aiConsentGo" disabled>Fortsätt</button><a class="tlink" href="#juridik-integritet" data-ai-close>Läs integritetspolicyn</a></div></div>`);
    $("#aiOk", body).addEventListener("change", (e) => ($("#aiConsentGo", body).disabled = !e.target.checked));
    $("#aiConsentGo", body).addEventListener("click", async (e) => { e.currentTarget.disabled = true; try { await AI.consent(); if (placing) placeCreate(); else viewCompose(); } catch (x) { RQ.toast(esc(errText(x.message))); e.currentTarget.disabled = false; } });
  };

  const chipsHtml = (st) => st.free_play ? `<div class="ai-edits">
      <div class="ai-edits-h"><b>Prova fritt</b><span class="small">Välj en eller flera. Produkterna står kvar.</span></div>
      ${Object.entries(EDITS).map(([k, g]) => `<div class="ai-eg"><span>${g.label}</span><div class="chips">${Object.entries(g.opts).map(([v, l]) => `<button type="button" class="chip" data-edit="${k}" data-v="${v}" aria-pressed="${pick[k] === v}">${l}</button>`).join("")}</div></div>`).join("")}
    </div>` : `<a class="ai-more" href="#studio-plus" data-ai-close><span><b>Prova väggfärg, golv, ljus och stil</b><small>Ingår i Studio Plus, ${PRICE} kr i månaden.</small></span><span class="plus-badge">Studio Plus</span></a>`;
  /* more things in the room than a picture can hold: you choose which ones come along */
  const chooseHtml = (scene) => `<fieldset class="ai-choose"><legend>En bild rymmer ${MAXP} saker. Välj vilka som ska med.</legend>${scene.map((it) => { const p = RQ.byHandle(it.h); return `<label><input type="checkbox" data-in="${it.h}" ${chosen.includes(it.h) ? "checked" : ""}><img src="${RQ.cut(p)}" alt=""><span>${esc(p.name)}</span></label>`; }).join("")}<p class="small" id="aiCount" role="status"></p></fieldset>`;

  async function viewCompose() {
    const st = await AI.status(true), scene = RQ.room.scene();
    const pre = !!st.demo, guest = !st.signed_in && pre; // the preview: everyone sees the demo, signed in or not (nothing is sent, nothing is charged)
    if (!st.signed_in && !guest) return viewSignin();
    if (st.error) {
      show(`<div class="ai-pad"><h2 id="aiTitle" class="ai-h">Det gick inte att nå bildskaparen.</h2><p class="ai-lead">${esc(errText(st.error))}</p><div class="ai-row"><button class="btn" type="button" id="aiRetry">Försök igen</button></div></div>`);
      $("#aiRetry", body).addEventListener("click", viewCompose); return;
    }
    if (!st.consent && !(pre && !aiOn())) return viewConsent(); // with the AI switched off nothing is ever sent, so there is nothing to agree to
    if (!st.demo && st.balance <= 0) return viewOut(st);
    const tooMany = scene.length > MAXP;
    if (!tooMany) chosen = null; else if (!chosen || chosen.some((h) => !scene.some((it) => it.h === h))) chosen = scene.slice(0, MAXP).map((it) => it.h);
    const shot = await AI.composite(900, chosen).catch(() => RQ.room.url());
    show(`<div class="ai-grid"><figure class="ai-fig"><img src="${shot}" alt="Din uppställning" id="aiShot"><figcaption>Din uppställning. AI:n behåller platserna och gör ljus och skuggor verkliga.</figcaption></figure>
      <div class="ai-pad"><span class="eyebrow">${guest ? "Förhandsvisning utan konto" : pre ? "Förhandsvisning" : esc(balanceLine(st))}</span><h2 id="aiTitle" class="ai-h">Gör bilden verklig.</h2>
        ${pre ? `<p class="small ai-guest">${guest ? "Här ser du hur det fungerar, utan konto. " : "Här ser du hur det fungerar. "}${aiOn() ? "Den riktiga AI-bilden kräver ett gratis konto." : "Den riktiga AI-bilden kommer snart och kräver ett gratis konto. Inget skickas härifrån."}${guest ? ` <a href="#konto" data-after="mitt-rum" data-ai-after data-ai-close>Logga in</a>` : ""}</p>` : ""}
        ${!scene.length ? `<p class="ai-warn">${errText("empty_scene")}</p>` : tooMany ? chooseHtml(scene) : `<p class="ai-lead">${scene.length} ${scene.length === 1 ? "produkt" : "produkter"} i rummet.</p>`}
        ${st.free_play ? chipsHtml(st) : ""}
        <div class="ai-row"><button class="btn" type="button" id="aiGo" ${!scene.length ? "disabled" : ""}>Skapa bild</button>${st.demo ? `<span class="small">Förhandsvisning: ingen bild dras.</span>` : `<span class="small">Använder 1 bild</span>`}</div>
        ${st.free_play ? "" : chipsHtml(st)}
        <p class="small ai-fine">Bilden skapas med AI. Placering, färg och storlek blir så nära som möjligt, men inte exakt.</p></div></div>`);
    $$("[data-edit]", body).forEach((b) => b.addEventListener("click", () => { const k = b.dataset.edit, v = b.dataset.v; pick[k] = pick[k] === v ? undefined : v; $$(`[data-edit="${k}"]`, body).forEach((x) => x.setAttribute("aria-pressed", pick[k] === x.dataset.v)); }));
    const go = $("#aiGo", body); if (go) go.addEventListener("click", () => run(st));
    const boxes = $$("[data-in]", body);
    if (boxes.length) { const count = async (redraw) => { chosen = boxes.filter((b) => b.checked).map((b) => b.dataset.in); const n = chosen.length; go.disabled = n < 1 || n > MAXP;
        $("#aiCount", body).textContent = n > MAXP ? `${n} valda. Ta bort ${n - MAXP} till.` : n ? `${n} av ${MAXP} valda.` : "Välj minst en sak.";
        if (redraw) { const im = $("#aiShot", body), pic = await AI.composite(900, chosen).catch(() => null); if (pic && im && im.isConnected) im.src = pic; } };
      boxes.forEach((b) => b.addEventListener("change", () => count(true))); count(false); }
  }

  async function run(st, again) {
    const edit = Object.fromEntries(Object.entries(pick).filter((e) => e[1]));
    const mode = st.free_play && Object.keys(edit).length ? "edit" : "place";
    // A retry of the same attempt reuses its key, so the server returns that image instead of charging again.
    const only = chosen ? chosen.slice() : null, scene = RQ.room.scene().filter((it) => !only || only.includes(it.h));
    if (!scene.length) return viewCompose();
    const sig = JSON.stringify([scene, edit, mode]);
    const idem = again || (pending && pending.sig === sig ? pending.key : "g-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8));
    pending = { sig, key: idem };
    const before = await AI.composite(1100, only).catch(() => RQ.room.url());
    // what the picture shows, remembered with it: each product and the colour drawn (the cut-out is the first colour)
    const items = scene.map((it) => ({ ...it, v: placing ? it.v || 0 : 0 })), pins = placing && RQ.room.pins ? RQ.room.pins().filter((x) => !only || only.includes(x.h)) : null;
    const key = AI.projectKey(), rm = RQ.room.get();
    busy = true;
    show(`<div class="ai-pad ai-wait"><div class="ai-spin" aria-hidden="true"></div><h2 id="aiTitle" class="ai-h">${st.demo ? "Gör i ordning förhandsvisningen…" : "Skapar din bild…"}</h2><p class="ai-lead" role="status">${st.demo ? "Här visar vi din uppställning som den är. När AI-bilderna är igång tar bilden 15–40 sekunder." : "Det brukar ta 15–40 sekunder. Ha sidan öppen så länge."}</p><figure class="ai-fig shimmer"><img src="${before}" alt=""></figure><button class="btn ghost sm" type="button" id="aiStop">Avbryt</button></div>`, false, true);
    $("#aiStop", body).addEventListener("click", () => AI.stop());
    // the server says its first picture failed the quality check and it makes one more (the customer pays for one)
    const onStage = (stage) => { if (stage !== "retry" || !busy) return; const h = $("#aiTitle", body), p = $(".ai-wait .ai-lead", body); box.classList.add("ai-retrying"); if (h) h.textContent = "Vi gör ett nytt försök…"; if (p) p.textContent = "Det första förslaget höll inte måttet, så vi gör om det. Det kostar ingen extra bild."; };
    let res, ver;
    try {
      const first = (await versionsOf(key)).find((v) => v.gid);
      res = await AI.generate({ mode, edit: mode === "edit" ? edit : null, idem, only, onStage, parent: first ? first.gid : null, pins });
      // the picture at the room photo's shape, and the before picture (the photo itself) beside it
      const [after, photo] = await Promise.all([fitTo(res.url, rm.w, rm.h), photoBlob(key, rm)]);
      const list = await versionsOf(key);
      ver = { id: res.id ? "g" + res.id : "l" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), gid: res.id || null, project: key, at: new Date().toISOString(),
        n: Math.max(0, ...list.map((v) => v.n || 0)) + 1, items, ...(pins ? { pins, place: true } : {}), demo: !!res.demo, retried: !!res.retried, mode, edit: mode === "edit" ? edit : null, w: after.w, h: after.h, after: after.blob };
      const same = list.find((v) => v.id === ver.id); if (same) ver.n = same.n; // the same picture again (a retried key): the same version
      ver.url = blobUrl(after.blob); ver.before = blobUrl(photo);
      ver.saved = autosave() ? await keep(ver, rm, key, photo) : "off";
    } catch (e) {
      busy = false; box.classList.remove("ai-retrying");
      if (e.message === "cancelled") { await viewCompose(); RQ.toast(st.demo ? "Avbrutet." : "Avbrutet. Hann bilden bli klar får du samma bild nästa gång du trycker på Skapa bild, utan att det dras en till."); return; }
      if (e.message === "no_credits") return viewOut(await AI.status(true));
      if (e.message === "not_signed_in") return viewSignin();
      const sameAgain = e.message === "network" || e.message === "in_progress";
      show(`<div class="ai-pad"><h2 id="aiTitle" class="ai-h">Det gick inte den här gången.</h2><p class="ai-lead">${esc(errText(e.message))}</p><div class="ai-row">${sameAgain ? `<button class="btn" type="button" id="aiSame">Försök igen</button>` : ""}<button class="btn ${sameAgain ? "ghost" : ""}" type="button" id="aiBack">Tillbaka</button></div></div>`);
      $("#aiBack", body).addEventListener("click", viewCompose);
      const same = $("#aiSame", body); if (same) same.addEventListener("click", () => run(st, idem));
      return;
    }
    busy = false; pending = null; box.classList.remove("ai-retrying");
    if (!res.demo) await AI.status(true).catch(() => {});
    const sess = (session[key] = (session[key] || []).filter((v) => v.id !== ver.id)); sess.push(ver);
    view = { key, list: await versionsOf(key), cur: 0, cmp: -1, fresh: true, place: placing };
    view.cur = Math.max(0, view.list.findIndex((v) => v.id === ver.id));
    viewResult();
    // the device is full: said at once too, since the line under the buttons can be below the fold on a phone
    if (ver.saved === "full") RQ.toast('Bilden sparades inte, enheten är full. <button type="button" class="tlink" data-ai-down-now>Ladda ner</button>', 8000);
  }

  /* versions of one room project: this visit's pictures and the saved ones, oldest first */
  const session = {}; // key -> versions made while this page is open (also those not saved)
  let view = null;    // the result sheet: { key, list, cur, cmp, fresh }
  const photos = {};  // key -> the room photo as a picture, made once
  const photoBlob = async (key, rm) => photos[key] || (photos[key] = (await fitTo(rm.img, rm.w, rm.h, 1600)).blob);
  async function versionsOf(key) {
    let saved = [];
    try { const { pics, rooms } = await Lib.list(); saved = pics.filter((p) => p.project === key).map((p) => verOf(p, rooms[p.project])); } catch (e) {}
    const out = [...saved]; (session[key] || []).forEach((v) => { const i = out.findIndex((x) => x.id === v.id); if (i < 0) out.push(v); else out[i] = { ...out[i], saved: v.saved }; });
    return out.sort((a, b) => (a.n || 0) - (b.n || 0));
  }
  // into Mina rumsbilder; "ok", "full" (the device has no room) or "fail"
  async function keep(ver, rm, key, photo) {
    const { url, before, saved, ...pic } = ver; if (!pic.roomId && RQ.hem && RQ.hem.activeId()) pic.roomId = RQ.hem.activeId(); // the room in Mitt hem it was made for
    if (!pic.roomId && RQ.hem && RQ.hem.create) { const H = RQ.hem, t = rm.type || rm.map || "vardagsrum", its = liveItems(ver.items).map((it) => ({ h: it.h, v: it.v || 0 }));
      const r = H.rooms().find((x) => x.pkey && x.pkey === key) || H.sameSet(t, its) || H.create({ label: (RQ.roomById(t) || {}).name || "Rum", type: t, items: its }); // review M8: never a picture without a room
      H.patch(r.id, { pkey: key, ...(rm.sample ? { sceneMap: rm.map } : {}) }); H.setActive(r.id); pic.roomId = r.id; ver.roomId = r.id; }
    try { await Lib.save(pic, { key, photo, w: rm.w, h: rm.h, at: new Date().toISOString(), meta: { type: rm.type || null, name: rm.name || "", sample: !!rm.sample, map: rm.map || null } }); recount(); return "ok"; }
    catch (e) { return e && e.message === "full" ? "full" : "fail"; }
  }

  const hemRoom = (v) => { const r = v && v.roomId && RQ.hem && RQ.hem.room(v.roomId); return r ? RQ.hem.name(r) : ""; };
  const savedLine = (v) => v.saved === "ok" ? `<p class="small ai-saved" role="status"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg><span>Bilden finns nu i <a href="#mitt-hem" data-ai-lib data-ai-close>Mitt hem</a>${hemRoom(v) ? `, under ${esc(hemRoom(v))}` : ""}, på den här enheten.</span></p>`
    : v.saved === "full" ? `<p class="ai-warn small" role="alert">Det finns inte plats på enheten, så bilden sparades inte. Ladda ner den, eller ta bort några gamla bilder i <a href="#mitt-hem" data-ai-lib data-ai-close>Mitt hem</a>.</p>`
    : v.saved === "fail" ? `<p class="small ai-saved" role="status"><span>Bilden kunde inte sparas här.</span> <button class="tlink" type="button" id="aiSave">Försök igen</button></p>`
    : `<p class="small ai-saved" role="status"><button class="tlink" type="button" id="aiSave">Spara bilden</button></p>`;

  function viewResult() {
    const st = AI.peek() || {}, list = view.list, v = list[view.cur], other = view.cmp >= 0 ? list[view.cmp] : null, many = list.length > 1;
    const items = liveItems(v.items), fresh = view.fresh; view.fresh = false;
    const pl = !!(view.place || v.place), sure = pl && (v.pins || []).length && v.pins.every((x) => x.scale && x.scale.sure), buyT = pl ? `Köp allt i bilden · ${kr(itemsTotal(items))}` : "Köp allt";
    const head = pl ? (v.demo ? ["Förhandsvisning", "Så här blir bilden när AI:n är på.", `<p class="ai-lead">Sakerna står där du pekade, i ${sure ? "rätt" : "ungefärlig"} storlek. Ingenting har skickats.</p><p class="small">När AI:n är på blir det ett riktigt foto av rummet, med ljus och skuggor.</p>`]
      : [many ? `Version ${v.n} av ${list.length}` : "Klar", "Ditt rum, med sakerna där du pekade.", `<p class="small">Ett förslag skapat med AI, i ${sure ? "rätt" : "ungefärlig"} storlek. Färg och storlek kan skilja sig något från verkligheten.${v.retried ? " Vi gjorde ett nytt försök, utan att det kostade en extra bild." : ""}</p>`]) : null;
    show(`<div class="ai-grid ai-result">
      <div class="ai-stage">${baHtml(v, other, fresh ? 100 : 30, many).replace("<figure ", '<figure id="aiBa" ')}${versHtml(list, view.cur, view.cmp)}</div>
      <div class="ai-pad"><span class="eyebrow">${head ? head[0] : v.demo ? "Förhandsvisning" : many ? `Version ${v.n} av ${list.length}` : "Klar"}</span><h2 id="aiTitle" class="ai-h">${head ? head[1] : v.demo ? "Så här fungerar det." : "Ditt rum, med sakerna på plats."}</h2>
        ${head ? head[2] : v.demo ? `<p class="ai-lead">När AI-bilderna är igång blir din uppställning ett riktigt foto med ljus och skuggor. Här visar vi uppställningen som den är.</p><p class="small">När AI:n är igång kan du skapa nya versioner av samma rum och jämföra dem.</p>` : `<p class="small">Ett förslag skapat med AI. Färg och storlek kan skilja sig något från verkligheten.${v.retried ? " Vi gjorde ett nytt försök, utan att det kostade en extra bild." : ""}</p>`}
        <div class="ai-row ai-buybar${pl ? " pl" : ""}"><span class="ai-buysum"><small>${items.length} ${items.length === 1 ? "produkt" : "produkter"}</small><b>${kr(itemsTotal(items))}</b></span><button class="btn" type="button" id="aiBuy">${buyT}</button><button class="btn ghost" type="button" id="aiShare">${ICON_SHARE}<span class="ai-share-t">Vad tycker du?</span></button></div>
        <div class="ai-row small-row">${v.demo ? "" : `<button class="tlink" type="button" id="aiAgain">Skapa igen · 1 bild</button>`}<button class="tlink" type="button" id="aiDown">Ladda ner</button>${!v.demo && v.gid && st.quality_left > 0 && !v.refunded ? `<button class="tlink" type="button" id="aiBad">Produkten blev fel</button>` : ""}${pl ? `<button class="tlink" type="button" id="aiPins" data-ai-close>Ändra nålarna</button>` : v.demo ? `<a class="tlink" href="#studio-plus" data-ai-close>Om Studio Plus</a>` : ""}</div>
        ${productsList(items, swapOk())}
        ${savedLine(v)}</div></div>`, false, true);
    const fig = $("[data-ba]", body), ctl = baWire(fig, other);
    if (fresh) reveal(fig, ctl, 30);
    $$("[data-ver]", body).forEach((b) => b.addEventListener("click", () => { view.cur = +b.dataset.ver; if (view.cmp === view.cur) view.cmp = -1; viewResult(); focusBack(`[data-ver="${view.cur}"]`); }));
    $$("[data-cmp]", body).forEach((b) => b.addEventListener("click", () => { view.cmp = +b.dataset.cmp; viewResult(); focusBack(`[data-cmp="${view.cmp}"]`); }));
    /* Köp allt adds what the picture shows that is not in the cart yet, in the colour the picture shows (the list says which);
       once all of it lies there the button shows the cart */
    const buy = $("#aiBuy", body), have = () => items.filter((it) => S.cartLines().some((l) => l.product.handle === it.h)).length;
    const paintBuy = () => { if (!buy.isConnected || buy.classList.contains("done")) return; const n = have(), all = n === items.length; buy.toggleAttribute("data-open-cart", all); buy.classList.toggle("ghost", all); buy.textContent = all ? "Visa varukorgen" : n ? "Lägg till resten" : buyT; };
    paintBuy();
    buy.addEventListener("click", () => { if (buy.hasAttribute("data-open-cart")) return; if (RQ.addMany(items.map((it) => it.h + "::" + (it.v || 0)), buy, "Ditt rum")) { setTimeout(paintBuy, 1650); toastOverBar(); } });
    $("#aiShare", body).addEventListener("click", (e) => share(v, e.currentTarget));
    $("#aiDown", body).addEventListener("click", () => download(v));
    const again = $("#aiAgain", body); if (again) again.addEventListener("click", () => { const s = AI.peek() || st; if (!s.demo && s.balance != null && s.balance <= 0) return viewOut(s); run(s); });
    const sv = $("#aiSave", body);
    if (sv) sv.addEventListener("click", async () => { sv.disabled = true; const rm = RQ.room.get(); v.saved = rm ? await keep(v, rm, view.key, await photoBlob(view.key, rm).catch(() => null)) : "fail"; (session[view.key] || []).forEach((x) => { if (x.id === v.id) x.saved = v.saved; }); viewResult(); focusBack(".ai-saved a, .ai-warn a, #aiSave"); });
    const bad = $("#aiBad", body);
    if (bad) bad.addEventListener("click", async () => {
      bad.disabled = true;
      try { const n = await AI.qualityRefund(v.gid, "Produkten blev fel"); v.refunded = true; RQ.toast(`Bilden är tillbaka på ditt saldo. ${n} ${n === 1 ? "ersättning" : "ersättningar"} kvar den här månaden.`); bad.remove(); }
      catch (x) { RQ.toast(esc(errText(x.message))); bad.disabled = false; }
    });
  }
  document.addEventListener("click", (e) => { if (e.target.closest("[data-ai-down-now]") && view) { $("#toast").classList.remove("show"); const v = view.list[view.cur]; if (v) download(v); } });
  // on a phone the toast after Köp allt sits just above the buy bar, clear of the picture and the sheet's close button
  const toastOverBar = () => { const bar = $(".ai-buybar", body), t = $("#toast"); if (!bar || !t || innerWidth >= 900 || getComputedStyle(bar).position !== "sticky") return; const r = bar.getBoundingClientRect(); t.style.top = Math.max(8, Math.round(r.top - t.offsetHeight - 10)) + "px"; t.style.bottom = "auto"; t.style.left = Math.round((innerWidth - t.offsetWidth) / 2) + "px"; t.style.right = "auto"; };
  /* Placera och skapa: Byt produkt / Prova en annan färg right in the result; the other pins stay, a new version is made */
  const placeSwap = (b) => {
    const li = b.closest("li"), h = b.dataset.aiSwap, colour = !!b.dataset.colour, p = RQ.byHandle(h), v = view.list[view.cur], it = (v.items || []).find((x) => x.h === h) || { v: 0 };
    const old = $(".ai-pick", li); if (old) { const same = old.dataset.kind === (colour ? "c" : "p"); old.remove(); if (same) { b.setAttribute("aria-expanded", "false"); return; } }
    $$("[data-ai-swap]", li).forEach((x) => x.setAttribute("aria-expanded", x === b));
    const opts = colour ? (p.variants || []).map((n, i) => ({ h, v: i, n, tone: p.tone[i] || p.tone[0] })).filter((o) => o.v !== (it.v || 0))
      : (RQ.room.alternatives ? RQ.room.alternatives(h) : []).slice(0, 6).map((q) => ({ h: q.handle, v: 0, n: q.name, img: RQ.cut(q), price: q.price }));
    const box = document.createElement("div"); box.className = "ai-pick"; box.dataset.kind = colour ? "c" : "p";
    box.innerHTML = opts.length ? `<p class="small">${colour ? "Välj en färg." : "Välj något annat av samma slag."} ${live() ? "Det blir en ny version, 1 bild." : "Det blir en ny förhandsvisning."} De andra sakerna står kvar.</p>
      <div class="ai-pick-l" role="group" aria-label="${colour ? `Färger för ${esc(p.name)}` : `I stället för ${esc(p.name)}`}">${opts.map((o) => colour ? `<button type="button" class="chip" data-place-to="${h}|${o.h}|${o.v}"><i style="background:${esc(o.tone)}"></i>${esc(o.n)}</button>`
        : `<button type="button" class="ai-pick-p" data-place-to="${h}|${o.h}|0"><img src="${o.img}" alt=""><span>${esc(o.n)}</span><b>${kr(o.price)}</b></button>`).join("")}</div>`
      : `<p class="small">Inget annat av samma slag passar här.</p>`;
    b.closest("div").appendChild(box); box.scrollIntoView({ block: "nearest", behavior: calm() ? "auto" : "smooth" }); const f = $("[data-place-to]", box); if (f) f.focus({ preventScroll: true });
  };
  document.addEventListener("click", (e) => { const t = e.target.closest("[data-place-to]"); if (!t || !view || !isOpen) return;
    const [h, to, v] = t.dataset.placeTo.split("|"), R = RQ.room; if (!R.inScene(h) || !R.swapWith(h, to, +v || 0)) { RQ.toast("Det gick inte att byta här. Prova i Justera själv."); return; }
    placing = true; chosen = R.pins().map((x) => x.h); const s0 = AI.peek() || {}; if (!s0.demo && s0.balance != null && s0.balance <= 0) return viewOut(s0); run(s0); });
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-ai-swap]"); if (b && view && view.place && isOpen && RQ.room.alternatives) { placeSwap(b); return; } if (!b || !swapOk()) return; const h = b.dataset.aiSwap, colour = !!b.dataset.colour; close(); if (RQ.currentRoute && RQ.currentRoute() !== "mitt-rum") RQ.go("mitt-rum"); setTimeout(() => RQ.room.openSwap(h, { colour }), 120); });
  const focusBack = (sel) => { const b = $(sel, body); if (b) b.focus({ preventScroll: true }); };

  function viewOut(st) {
    const next = st.period_end ? new Date(st.period_end).toLocaleDateString(window.RQ_LANG === "en" ? "en-GB" : "sv-SE", { day: "numeric", month: "long" }) : "";
    show(`<div class="ai-pad"><span class="eyebrow">Slut på bilder</span><h2 id="aiTitle" class="ai-h">${st.plan === "plus" ? "Du har använt periodens bilder." : "Du har använt månadens gratisbilder."}</h2>
      <p class="ai-lead">${next ? `Nya bilder kommer ${esc(next)}.` : ""}${st.plan === "plus" ? "" : ` Med Studio Plus får du ${PLUS_IMAGES} bilder i månaden och kan prova väggfärg, golv, ljus och stil.`}</p>
      <div class="ai-row">${st.plan === "plus" ? `<button class="btn" type="button" data-ai-close>Stäng</button>` : `<a class="btn" href="#studio-plus" data-ai-close>Se Studio Plus · ${PRICE} kr/mån</a>`}</div></div>`);
  }

  RQ.openAI = () => { if (!RQ.room.has()) { RQ.room.openSetup(() => (location.hash = "#mitt-rum")); return; } pick = {}; chosen = null; placing = false; viewCompose(); };

  /* ------------------------------------------------------------------ Placera och skapa (PLACE-BRIEF): "Skapa bilden"
     Mitt rum's pin view says rq-place-create; the AI side makes the picture: the pins (RQ.room.pins(): where, on what, real
     measurements, the room's scale) go to the server with the room photo, and the result is the same sheet as always
     (before/after, versions, Köp allt i bilden, Byt produkt / Prova en annan färg as a new version, saved in the room,
     Vad tycker du?). While RQ_CONFIG.studio.aiLive is false: the honest preview of the pins, nothing is sent. */
  let placing = false;
  document.addEventListener("rq-place-create", (e) => { if (!RQ.room || typeof RQ.room.pins !== "function") return; e.preventDefault(); placeCreate(); });
  async function placeCreate() {
    placing = true; pick = {}; const pins = RQ.room.pins(); if (!pins.length) return;
    chosen = pins.map((x) => x.h);
    const st = await AI.status(true);
    if (aiOn()) {
      if (!st.signed_in) return viewSignin();
      if (st.error) { show(`<div class="ai-pad"><h2 id="aiTitle" class="ai-h">Det gick inte att nå bildskaparen.</h2><p class="ai-lead">${esc(errText(st.error))}</p><div class="ai-row"><button class="btn" type="button" id="aiRetry">Försök igen</button></div></div>`); $("#aiRetry", body).addEventListener("click", placeCreate); return; }
      if (!st.consent) return viewConsent();
      if (!st.demo && st.balance <= 0) return viewOut(st);
    }
    return run(st);
  }
  document.addEventListener("click", (e) => { if (e.target.closest("[data-ai-create]")) { e.preventDefault(); RQ.openAI(); } });
  // signing in from the AI sheet: back in Mitt rum the sheet opens again where you were (room.js reads this)
  document.addEventListener("click", (e) => { if (e.target.closest("[data-ai-after]") && RQ.ss) RQ.ss.set("rumiq-ai-after", String(Date.now())); });

  /* ------------------------------------------------------------------ Mina rumsbilder in Sparat */
  // the list as groups (one per room project), newest first; each group's versions oldest first
  async function libGroups() {
    if (remoteLib()) {
      try {
        const r = await fn("ai-library", { action: "list" });
        const pics = (r.items || []).map((p) => ({ id: "g" + p.id, gid: p.id, project: p.project || "srv-" + p.id, at: p.at, n: p.n || 1, items: (p.scene || []).map((it) => ({ ...it, v: it.v || 0 })), w: p.w || 4, h: p.h || 3, url: p.url, before: p.before_url || "", remote: true, retried: !!p.retried }));
        return group(pics, {});
      } catch (e) { /* the server list is not there: show this device's pictures */ }
    }
    const { pics, rooms } = await Lib.list();
    return group(pics.map((p) => verOf(p, rooms[p.project])), rooms);
  }
  const hemOf = (g) => g.list.map((v) => v.roomId).find(Boolean) || ""; // the Mitt hem room these pictures belong to
  const shown = () => libState.groups.filter((g) => !libState.filter || (libState.filter === "-" ? !hemOf(g) || !(RQ.hem && RQ.hem.room(hemOf(g))) : hemOf(g) === libState.filter));
  const group = (vers, rooms) => {
    const by = new Map(); vers.forEach((v) => { if (!by.has(v.project)) by.set(v.project, []); by.get(v.project).push(v); });
    return [...by.entries()].map(([key, list]) => { list.sort((a, b) => (a.n || 0) - (b.n || 0)); return { key, list, room: rooms[key] || null, at: list.reduce((m, v) => (v.at > m ? v.at : m), ""), cur: list.length - 1, cmp: -1 }; })
      .sort((a, b) => (a.at < b.at ? 1 : -1));
  };
  const libState = { groups: [], undo: null, host: null, filter: "" };
  const libNote = () => remoteLib() ? "AI-bilderna du har skapat i Mitt rum, med bilden före. De sparas privat i ditt konto, och ingen annan kan se dem." : "Bilderna du har skapat i Mitt rum, med bilden före. Förhandsvisningar är märkta som det. De sparas på den här enheten, och ingen annan kan se dem.";
  /* one room, one truth (device4 D5): a picture of a room whose things have changed since says so, and its Köp allt and total
     are the room's own now (its list i Mitt hem), with "Skapa ny bild" for a fresh picture */
  const setKey = (l) => (l || []).map((it) => it.h + "::" + (it.v || 0)).sort().join();
  const roomNow = (g) => { const id = hemOf(g), r = id && RQ.hem && RQ.hem.room(id); return r && RQ.hem.items(r).length ? r : null; };
  const staleOf = (g, v) => { const r = roomNow(g); return r && setKey(liveItems(v.items)) !== setKey(RQ.hem.items(r)) ? r : null; };
  const libCard = (g, i) => {
    const v = g.list[g.cur], other = g.cmp >= 0 ? g.list[g.cmp] : null, many = g.list.length > 1, old = staleOf(g, v), items = old ? RQ.hem.items(old).map((it) => ({ h: it.h, v: it.v || 0 })) : liveItems(v.items);
    return `<article class="ai-lcard" data-lib="${i}" aria-labelledby="aiLibH${i}">
      <div class="ai-stage">${baHtml(v, other, 50, many)}${versHtml(g.list, g.cur, g.cmp)}</div>
      <div class="ai-lcard-tx"><div class="ai-lcard-h"><h3 class="h3" id="aiLibH${i}">${esc(hemName(g) || roomName(g.room))}${many ? `, version ${v.n}` : ""}</h3>${v.demo ? `<span class="ai-prev-tag">Förhandsvisning, inte en AI-bild</span>` : ""}<span class="small">${esc(dateText(v.at))} · ${items.length} ${items.length === 1 ? "produkt" : "produkter"}</span></div>
        ${items.length ? `<ul class="ai-lib-items">${items.map((it) => { const p = RQ.byHandle(it.h); return `<li><button type="button" data-sheet="${p.handle}" aria-label="Snabbtitt på ${esc(p.name)}"><img src="${RQ.cut(p)}" alt=""></button></li>`; }).join("")}</ul>` : ""}
        ${old ? `<p class="small ai-stale" role="note"><b>Bild från tidigare.</b> Produkterna i rummet har ändrats sedan dess. Listan och priset gäller rummet nu. <button class="tlink" type="button" data-lib-new>Skapa ny bild</button></p>` : ""}
        <div class="ai-row">${items.length ? `<button class="btn sm" type="button" data-lib-buy>Köp allt</button>` : ""}<button class="btn ghost sm" type="button" data-lib-share>${ICON_SHARE}<span>Vad tycker du?</span></button></div>
        <div class="ai-row small-row">${g.room || v.before ? `<button class="tlink" type="button" data-lib-cont>Prova igen i Studio</button>` : ""}<button class="tlink" type="button" data-lib-down>Ladda ner</button><button class="tlink" type="button" data-lib-del>Ta bort</button></div>
        ${RQ.hem && RQ.hem.rooms().length && !v.remote ? `<label class="ai-move"><span>Flytta till rum</span><select data-lib-move>${[["", "Inget rum"], ...RQ.hem.rooms().map((r) => [r.id, RQ.hem.name(r)])].map(([id, nm]) => `<option value="${esc(id)}"${id === hemOf(g) ? " selected" : ""}>${esc(nm)}</option>`).join("")}</select></label>` : ""}</div></article>`;
  };
  const hemName = (g) => { const id = hemOf(g), r = id && RQ.hem && RQ.hem.room(id); return r ? RQ.hem.name(r) : ""; };
  const libPaint = (focusSel) => {
    const host = libState.host; if (!host || !host.isConnected) return;
    const all = libState.groups, n = all.reduce((s, g) => s + g.list.length, 0), gs = shown();
    if (!remoteLib()) setCount(n);
    host.removeAttribute("aria-busy");
    host.innerHTML = gs.length ? gs.map((g) => libCard(g, all.indexOf(g))).join("") : libState.filter && all.length ? `<p class="small">Inga bilder i det här rummet än.</p>` : `<div class="mh-none"><p><b>Inga rumsbilder än.</b> <span>Varje AI-bild du skapar i Mitt rum hamnar här, med bilden före.</span></p><a class="link" href="#mitt-rum">Till Mitt rum</a></div>`;
    $$("[data-ai-count]").forEach((c) => (c.textContent = `Alla bilder (${n})`));
    $$("[data-ai-proj]").forEach((c) => { const g = gs.find((x) => x.key === c.dataset.aiProj); c.innerHTML = g ? `<a class="link" href="#mh-bilder" data-ai-goto="${esc(g.key)}">${g.list.length === 1 ? "1 AI-bild" : `${g.list.length} AI-bilder`} av rummet</a>` : ""; c.hidden = !g; });
    $$(".ai-lcard", host).forEach((card) => {
      const g = all[+card.dataset.lib], v = g.list[g.cur], other = g.cmp >= 0 ? g.list[g.cmp] : null;
      baWire($("[data-ba]", card), other);
      const repaint = (sel) => { card.outerHTML = libCard(g, +card.dataset.lib); libPaint.one(+card.dataset.lib, sel); };
      $$("[data-ver]", card).forEach((b) => b.addEventListener("click", () => { g.cur = +b.dataset.ver; if (g.cmp === g.cur) g.cmp = -1; repaint(`[data-ver="${g.cur}"]`); }));
      $$("[data-cmp]", card).forEach((b) => b.addEventListener("click", () => { g.cmp = +b.dataset.cmp; repaint(`[data-cmp="${g.cmp}"]`); }));
      const old = staleOf(g, v), items = old ? RQ.hem.items(old).map((it) => ({ h: it.h, v: it.v || 0 })) : liveItems(v.items);
      const nb = $("[data-lib-new]", card); if (nb && old) nb.addEventListener("click", () => RQ.hem.openInRoom({ room: old.type, items: RQ.hem.items(old), style: old.style, budget: old.budget, project: old.id }));
      const buy = $("[data-lib-buy]", card), hs = () => items.map((it) => it.h + "::" + (it.v || 0));
      if (buy) { const paint = RQ.addAllBtn(buy, hs, () => `Köp allt · ${kr(itemsTotal(items))}`), say = () => { if (buy.hasAttribute("data-open-cart") && !buy.classList.contains("done")) { buy.textContent = "Visa varukorgen"; buy._apText = "Visa varukorgen"; } }; say(); S.onChange(() => setTimeout(say, 30)); buy.addEventListener("click", () => setTimeout(say, 1950)); void paint; buy.addEventListener("click", () => { if (!buy.hasAttribute("data-open-cart")) RQ.addMany(hs(), buy, "Rumsbilden"); }); }
      $("[data-lib-share]", card).addEventListener("click", (e) => share(v, e.currentTarget));
      $("[data-lib-down]", card).addEventListener("click", () => download(v));
      const cont = $("[data-lib-cont]", card); if (cont) cont.addEventListener("click", () => continueIn(g, v, cont));
      $("[data-lib-del]", card).addEventListener("click", () => removePic(g, v));
      const mv = $("[data-lib-move]", card); if (mv) mv.addEventListener("change", async () => { await Lib.update(g.list.map((x) => x.id), { roomId: mv.value || null }); g.list.forEach((x) => (x.roomId = mv.value || null)); const r = mv.value && RQ.hem.room(mv.value); RQ.toast(r ? `Bilden hör nu till ${esc(RQ.hem.name(r))}.` : "Bilden hör inte till något rum nu."); document.dispatchEvent(new CustomEvent("rq-hem")); libPaint(); });
    });
    if (focusSel) { const f = $(focusSel, host) || $("#mh-bilder h2"); if (f) f.focus({ preventScroll: true }); }
  };
  libPaint.one = (i, sel) => { libPaint(); const card = $(`.ai-lcard[data-lib="${i}"]`, libState.host); const f = card && $(sel, card); if (f) f.focus({ preventScroll: true }); };
  const libLoad = async (focusSel) => { try { libState.groups = await libGroups(); } catch (e) { libState.groups = []; } libPaint(focusSel); };

  // take the room back into Mitt rum as it was in this picture: the photo (under its old project key) and the products where they stood
  async function continueIn(g, v, btn) {
    btn.disabled = true;
    try {
      // moved to a room of another kind than the sample room it was made in: that room opens (its tab chosen) with the picture's things
      const hr0 = RQ.hem && v.roomId && RQ.hem.room(v.roomId), m0 = (g.room && g.room.meta) || {};
      if (hr0 && m0.sample && m0.type && m0.type !== hr0.type) {
        const its = liveItems(v.items).map((it) => ({ h: it.h, v: it.v || 0 })), R = RQ.room;
        const out = await RQ.hem.openInRoom({ room: hr0.type, items: its, style: hr0.style, budget: hr0.budget, project: hr0.id });
        if (out && R.group) R.group(() => its.forEach((it) => { if (!R.inScene(it.h)) R.add(it.h, true, it.v); }));
        return;
      }
      if (AI.projectKey() !== g.key) {
        const src = (g.room && blobUrl(g.room.photo)) || v.before; if (!src) throw new Error("photo");
        const im = await load(src); const okay = await RQ.room.saveImage(im, (g.room && g.room.meta) || {});
        if (!okay) { RQ.toast(esc(RQ.room.lastError || "Bilden fick inte plats i webbläsarens lagring.")); btn.disabled = false; return; }
        keepKey(g.key);
      }
      RQ.room.saveScene(liveItems(v.items).map(({ v: _v, ...it }) => it));
      // the room it belongs to i Mitt hem
      const hr = RQ.hem && v.roomId && RQ.hem.room(v.roomId);
      if (hr) { RQ.hem.setActive(v.roomId); RQ.hem.patch(v.roomId, { pkey: g.key }); }
      RQ.go("mitt-rum");
    } catch (e) { RQ.toast("Rummet gick inte att öppna. Försök igen."); if (btn.isConnected) btn.disabled = false; }
  }
  // Ta bort: the picture goes at once (and the before picture with the room's last picture); Ångra brings both back for a few seconds
  async function removePic(g, v) {
    const last = g.list.length === 1;
    let u = null;
    try {
      if (v.remote) { u = { remote: v }; libState.groups.forEach((x) => (x.list = x.list.filter((y) => y.id !== v.id))); libState.groups = libState.groups.filter((x) => x.list.length); clearTimeout(libState.commit); const gone = v; libState.commit = setTimeout(() => fn("ai-library", { action: "delete", id: gone.gid }).catch(() => {}), 7000); }
      else { u = await Lib.remove(v.id); if (!u) return; libState.groups = await libGroups(); }
    } catch (e) { RQ.toast("Bilden gick inte att ta bort. Försök igen."); return; }
    libState.undo = u; if (!v.remote) recount();
    libPaint(".ai-lcard [data-lib-del]");
    RQ.toast(`${last ? "Bilden och bilden före är borttagna." : `Version ${v.n} är borttagen.`} <button type="button" class="tlink" data-ai-undo>Ångra</button>`, 7000);
  }
  document.addEventListener("click", async (e) => {
    if (e.target.closest("[data-ai-undo]")) {
      const u = libState.undo; libState.undo = null; $("#toast").classList.remove("show"); if (!u) return;
      try { if (u.remote) clearTimeout(libState.commit); else { await Lib.restore(u); recount(); } } catch (x) { RQ.toast("Det gick inte att ångra."); return; }
      await libLoad(); RQ.toast("Bilden är tillbaka.");
      return;
    }
    const lk = e.target.closest("[data-ai-lib]"); if (lk) { RQ.ss.set("rumiq-ai-jump", "1"); if (RQ.currentRoute && RQ.currentRoute() === "mitt-hem") setTimeout(jump, 80); return; }
    const gt = e.target.closest("[data-ai-goto]");
    if (gt) { e.preventDefault(); const i = libState.groups.findIndex((g) => g.key === gt.dataset.aiGoto), card = $(`.ai-lcard[data-lib="${i}"]`); if (card) { card.scrollIntoView({ block: "start", behavior: calm() ? "auto" : "smooth" }); const f = $("[data-lib-share]", card); if (f) f.focus({ preventScroll: true }); } }
  });
  const jump = () => { const s = document.getElementById("mh-bilder"); if (s) { s.scrollIntoView({ block: "start" }); const h = $("h2", s); if (h) h.focus({ preventScroll: true }); } };

  RQ.aiLib = {
    store: Lib,
    html: () => `<div id="mh-bilder" class="ai-lib"><div class="sec-row"><div class="sec-head"><h2 class="h3" tabindex="-1">Alla bilder</h2></div>
        <label class="switch ai-auto"><input type="checkbox" role="switch" id="aiAuto" ${autosave() ? "checked" : ""}><span></span>Spara mina AI-bilder automatiskt</label></div>
      <p class="small ai-lib-note" id="aiLibNote">${esc(libNote())}${autosave() ? "" : " Nya AI-bilder sparas inte förrän du slår på det igen."}</p>
      <div class="ai-lib-list" id="aiLib" aria-busy="true"></div></div>`,
    // a room's own pictures (the room sheet in Mitt hem); restore() gives the list back to the page
    mountInto(host, roomId) { libState.prev = libState.prev || { host: libState.host, filter: libState.filter }; libState.host = host; libState.filter = roomId; libLoad(); },
    restore() { if (!libState.prev) return; libState.host = libState.prev.host; libState.filter = libState.prev.filter; libState.prev = null; libLoad(); },
    pics: async (roomId) => { try { const { pics } = await Lib.list(); return pics.filter((p) => !roomId || p.roomId === roomId).map((p) => ({ id: p.id, at: p.at, url: blobUrl(p.after), roomId: p.roomId || null, n: p.n, demo: p.demo, items: (p.items || []).map((it) => ({ h: it.h, v: it.v || 0 })) })); } catch (e) { return []; } },
    filter(id) { libState.filter = id || ""; libPaint(); },
    mount(root) {
      libState.host = $("#aiLib", root); libState.prev = null; if (!libState.host) return;
      const sw = $("#aiAuto", root);
      sw.addEventListener("change", () => { S.store.set("rumiq-ai-autosave", sw.checked); $("#aiLibNote", root).textContent = libNote() + (sw.checked ? "" : " Nya AI-bilder sparas inte förrän du slår på det igen."); });
      libLoad().then(() => { if (RQ.ss.get("rumiq-ai-jump")) { RQ.ss.set("rumiq-ai-jump", ""); jump(); } });
    },
    clear: () => { setCount(0); return Lib.clear().then(recount).catch(() => {}); },
    groups: libGroups,
    setKey,
    count: libCount,
  };

  /* ------------------------------------------------------------------ card in Mitt rum, balance chips */
  AI.card = () => `<div class="ai-card"><div><b>Gör bilden verklig</b><span data-ai-balance>${AI.promise()}</span>${libCount() ? `<a class="link ai-card-lib" href="#mitt-hem" data-ai-lib>Alla bilder (${libCount()})</a>` : ""}</div><button class="btn sm" type="button" data-ai-create>Skapa AI-bild</button></div>`;
  AI.hydrate = async () => {
    const chips = $$("[data-ai-balance]"), acct = $("[data-ai-account]:not([data-done])");
    if (!chips.length && !acct) return;
    const st = await AI.status();
    chips.forEach((c) => (c.textContent = st.demo || st.signed_in ? balanceLine(st) : AI.promise())); // the preview says the same thing signed in or not
    if (acct) renderAccount(acct, st);
  };
  const baseShell = RQ.paintShell;
  RQ.paintShell = () => { baseShell(); AI.hydrate(); };

  /* ------------------------------------------------------------------ account section */
  function renderAccount(node, st) {
    node.dataset.done = "1";
    const d = (x) => (x ? new Date(x).toLocaleDateString(window.RQ_LANG === "en" ? "en-GB" : "sv-SE", { day: "numeric", month: "long", year: "numeric" }) : "");
    const finishing = st.sub_status === "withdrawing";
    const canWithdraw = finishing || (st.plan === "plus" && st.withdraw_until && new Date(st.withdraw_until) > new Date());
    node.innerHTML = `<div class="panel ai-acct"><div class="ai-acct-h"><div><span class="eyebrow">${st.plan === "plus" ? "Studio Plus" : "Gratis"}</span><b>${esc(balanceLine(st))}</b></div>${st.period_end && !st.demo ? `<span class="small">${st.plan === "plus" ? (st.sub_status === "canceled" ? "Gäller till" : "Förnyas") : "Nya bilder"} ${esc(d(st.period_end))}</span>` : ""}</div>
      <div class="ctrl-row">${st.plan === "plus" ? `<button class="btn ghost sm" type="button" id="aiPortal">Hantera abonnemang</button>${canWithdraw && !finishing ? `<button class="btn ghost sm" type="button" id="aiWithdraw">Ångra inom 14 dagar</button>` : ""}` : finishing ? `<button class="btn sm" type="button" id="aiWithdraw" data-q="1">Slutför ångern</button>` : `<a class="btn sm" href="#studio-plus">Studio Plus · ${PRICE} kr/mån</a>`}<button class="btn ghost sm" type="button" data-ai-create>Skapa AI-bild</button></div>
      <p class="small" id="aiAcctMsg" role="status">${st.demo ? "Förhandsversion: abonnemang och AI-bilder fungerar på den riktiga sajten." : ""}</p></div>`;
    const msg = $("#aiAcctMsg", node);
    const p = $("#aiPortal", node); if (p) p.addEventListener("click", async () => { try { await AI.portal(); } catch (e) { msg.textContent = errText(e.message); } });
    const w = $("#aiWithdraw", node);
    if (w) w.addEventListener("click", async () => {
      try {
        if (!w.dataset.q) { const q = await AI.withdrawQuote(); w.dataset.q = "1"; w.textContent = "Bekräfta ånger"; msg.textContent = `Du har använt ${q.used} av ${PLUS_IMAGES} bilder. Du får tillbaka ${kr(Math.floor(q.refund_ore / 100))}, och abonnemanget avslutas direkt.`; return; }
        w.disabled = true; const r = await AI.withdraw(); msg.textContent = `Klart. ${kr(Math.floor(r.refund_ore / 100))} betalas tillbaka till ditt kort inom några dagar.`; w.remove();
      } catch (e) { msg.textContent = errText(e.message); w.disabled = false; }
    });
  }

  /* ------------------------------------------------------------------ Studio Plus page */
  V.studioPlus = (thanks) => ({
    title: "Studio Plus · RumIQ",
    html: `<section class="wrap sp-hero">${RQ.crumbs([["Hem", "hem"], ["Mitt rum", "mitt-rum"], ["Studio Plus"]])}
        <div id="spThanks" role="status"></div>
        <div class="sp-top"><div><span class="eyebrow">Mitt rum</span><h1 class="display">Se allt hemma hos dig, i en verklighetstrogen bild.</h1>
        <p class="lead">Peka ut var produkterna ska stå i ditt eget rum och få en verklighetstrogen bild med rätt ljus och skuggor. Med Studio Plus kan du också prova väggfärg, golv, ljus och stil.</p></div>
        <figure class="sp-pair"><div><img src="assets/img/rum/sovrum-fore-900.webp" srcset="${RQ.srcset("assets/img/rum/sovrum-fore-900.webp")}" sizes="(max-width: 700px) 46vw, 24rem" alt="Ett sovrum med tomt nattduksbord och bar säng" width="900" height="504" decoding="async"><span>Ditt foto</span></div><div><img src="assets/img/rum/sovrum-efter-900.webp" srcset="${RQ.srcset("assets/img/rum/sovrum-efter-900.webp")}" sizes="(max-width: 700px) 46vw, 24rem" alt="Samma sovrum med lampa, pläd och korg på plats" width="900" height="504" decoding="async"><span>Med sakerna på plats</span></div><figcaption>Exempel: samma rum före och efter.</figcaption></figure></div></section>
      <section class="wrap sp-plans">
        <article class="sp-plan"><span class="eyebrow">Gratis</span><h2>0 kr</h2><ul><li>${FREE_IMAGES} AI-bilder i månaden</li><li>Dina produkter så nära dina platser som möjligt</li><li>Kräver ett konto</li></ul><a class="btn ghost block" href="#mitt-rum">Börja i Mitt rum</a></article>
        <article class="sp-plan plus"><span class="eyebrow">Studio Plus</span><h2>${PRICE} kr <small>/ månad</small></h2><ul><li>${PLUS_IMAGES} AI-bilder i månaden</li><li>Prova fritt: väggfärg, golv, ljus och stil</li><li>Ingen bindningstid, säg upp när du vill</li><li>Pris inklusive moms</li></ul>
          <div id="spBuy"></div></article></section>
      <section class="wrap sp-steps"><ol><li><b>Ta en bild av ditt rum</b><span>Eller välj ett exempelrum.</span></li><li><b>Peka ut</b><span>Visa var sakerna ska stå, upp till fem på en gång.</span></li><li><b>Skapa bilden</b><span>AI:n gör ljus, skuggor och perspektiv verkliga.</span></li></ol></section>
      <section class="wrap sp-faq"><h2 class="h2">Frågor</h2>
        <details><summary>Blir bilden exakt?</summary><p>Nästan. AI:n håller platserna och produkternas form så nära som möjligt, men färg och storlek kan skilja sig något. Blev en produkt fel får du bilden tillbaka, upp till tre gånger i månaden.</p></details>
        <details><summary>Hur många bilder kan jag göra?</summary><p>${FREE_IMAGES} i månaden utan kostnad, eller ${PLUS_IMAGES} i månaden med Studio Plus, högst ${LIM.dailyPlus} på ett dygn. En bild rymmer upp till ${MAXP} produkter.</p></details>
        <details><summary>Hur säger jag upp?</summary><p>Under Konto, med ett klick. Du behåller bilderna perioden ut.</p></details>
        <details><summary>Kan jag ångra köpet?</summary><p>Ja, inom 14 dagar. Abonnemanget avslutas direkt och du får tillbaka betalningen minus den del du har använt. Har du använt 10 av 100 bilder får du tillbaka 90 procent.</p></details>
        <details><summary>Vad händer med mina bilder?</summary><p>${keepText(true)} Vi tränar ingen AI på dem.</p></details>
        <details><summary>Sparas oanvända bilder?</summary><p>Nej, de förnyas varje period och sparas inte till nästa.</p></details>
      </section>`,
    async mount(root) {
      const buy = $("#spBuy", root), st = await AI.status(true);
      if (!document.contains(buy)) return;
      // the thank-you is only for someone who really has the subscription; right after paying it can take a moment to show
      const th = $("#spThanks", root);
      if (thanks && st.plan === "plus") th.innerHTML = `<div class="sp-thanks"><b>Tack! Studio Plus är igång.</b><span>${esc(balanceLine(st))}.</span><a class="btn sm" href="#mitt-rum">Till Mitt rum</a></div>`;
      else if (thanks && st.signed_in && !st.demo && !st.error) { th.innerHTML = `<div class="sp-thanks"><b>Vi väntar på besked om betalningen.</b><span>Det brukar ta under en minut. Har du inte betalat händer ingenting.</span><button class="btn ghost sm" type="button" id="spAgain">Titta igen</button></div>`; $("#spAgain", root).addEventListener("click", () => RQ.router()); }
      if (st.error) { buy.innerHTML = `<p class="sp-have" role="status">${esc(errText(st.error))}</p><button class="btn ghost block" type="button" id="spRetry">Försök igen</button>`; $("#spRetry", root).addEventListener("click", () => RQ.router()); return; }
      if (st.plan === "plus") { buy.innerHTML = `<p class="sp-have">Du har Studio Plus. ${esc(balanceLine(st))}.</p><a class="btn ghost block" href="#konto">Hantera i Konto</a>`; return; }
      if (!st.signed_in) { buy.innerHTML = `<a class="btn block" href="#konto" data-after="studio-plus">Logga in för att teckna</a>`; return; }
      buy.innerHTML = `<label class="check sp-consent"><input type="checkbox" id="spOk"> Starta Studio Plus direkt. Jag förstår att om jag ångrar mig inom 14 dagar betalar jag för den del jag har använt.</label>
        <button class="btn block" type="button" id="spGo" disabled>Teckna Studio Plus</button><p class="small" id="spMsg" role="status">${st.demo ? "Förhandsversion: betalningen öppnas på den riktiga sajten." : "Du betalar i Stripes säkra kassa. Vi ser aldrig ditt kort."}</p>`;
      $("#spOk", root).addEventListener("change", (e) => ($("#spGo", root).disabled = !e.target.checked));
      $("#spGo", root).addEventListener("click", async (e) => {
        if (st.demo) { $("#spMsg", root).textContent = "Förhandsversion: på den riktiga sajten öppnas Stripes kassa här."; return; }
        e.currentTarget.disabled = true; $("#spMsg", root).textContent = "Öppnar kassan…";
        try { await AI.checkout(); } catch (x) { $("#spMsg", root).textContent = errText(x.message); e.currentTarget.disabled = false; }
      });
    },
  });

  /* ------------------------------------------------------------------ terms and privacy drafts */
  const addLegal = (k, extra) => { const L = RQ.LEGAL && RQ.LEGAL[k]; if (!L) return; const base = L.html; L.html = () => base() + extra; };
  addLegal("villkor", `<h2>AI-bilder i Mitt rum och Studio Plus</h2>
    <p><b>Utkast, ska granskas av jurist före lansering.</b></p>
    <p>Med ett konto får du ${FREE_IMAGES} AI-bilder per kalendermånad utan kostnad. Studio Plus kostar ${PRICE} kr per månad inklusive moms och ger ${PLUS_IMAGES} AI-bilder per betalningsperiod och möjlighet att prova väggfärg, golv, ljus och stil. Oanvända bilder sparas inte till nästa period. Det finns en gräns per dygn (${LIM.dailyFree} bilder utan abonnemang, ${LIM.dailyPlus} med Studio Plus).</p>
    <p>Abonnemanget förnyas automatiskt varje månad tills du säger upp det. Du säger upp under Konto, och abonnemanget gäller då perioden ut.</p>
    <p><b>Ångerrätt:</b> När du tecknar ber du oss uttryckligen att starta tjänsten direkt. Ångrar du dig inom 14 dagar avslutas abonnemanget omedelbart och du får tillbaka betalningen minus en proportionell del för det du har använt, räknat som antal skapade bilder av ${PLUS_IMAGES}.</p>
    <p>AI-bilderna är illustrationer. Färg, storlek och detaljer kan skilja sig från de riktiga produkterna. Blev en produkt fel kan du få bilden återförd till ditt saldo, högst tre gånger per månad.</p>`);
  addLegal("integritet", `<h2>Mitt rum: AI-bilder</h2>
    <p><b>Utkast, ska granskas före lansering.</b></p>
    <p>När du väljer att skapa en AI-bild, och först efter att du har godkänt det, skickar vi fotot av ditt rum och din uppställning till vår server i EU (Supabase) och till bildtjänsten som skapar bilden. Rumsfotot raderas automatiskt efter 30 dagar. AI-bilderna sparas i ditt konto tills du tar bort dem eller tar bort kontot. Vi använder inte bilderna för att träna AI och visar dem inte för någon annan. Rättslig grund: ditt samtycke och avtalet om tjänsten. Betalningar för Studio Plus hanteras av Stripe.</p>`);

})();
