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
  const PRICE = 99, PLUS_IMAGES = 100, FREE_IMAGES = 5;

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
  const live = () => !!(RQ.auth && RQ.auth.mode === "supabase" && RQ.auth.client && RQ.auth.client());
  /* Preview = the copy inside claude.ai or on your own machine, where other sites are blocked on purpose.
     On the real site a server that does not answer is said to be exactly that. */
  const preview = () => { const c = (window.RQ_CONFIG && window.RQ_CONFIG.auth) || {}; if (c.preview != null) return !!c.preview; return c.provider !== "supabase" || location.protocol === "file:" || /^(localhost|127\.0\.0\.1|\[::1\])$|claude\.ai$|claudeusercontent\.com$/.test(location.hostname); };
  const fn = async (name, body) => {
    const token = RQ.auth.token ? await RQ.auth.token() : null;
    if (!token) { const e = new Error("not_signed_in"); throw e; }
    let r; const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 150000); if (name === "generate") gen = ctrl;
    try { r = await fetch(CFG.supabaseUrl.replace(/\/$/, "") + "/functions/v1/" + name, { method: "POST", signal: ctrl.signal, headers: { Authorization: "Bearer " + token, apikey: CFG.supabaseAnonKey, "Content-Type": "application/json" }, body: JSON.stringify(body || {}) }); }
    catch (e) { throw new Error(ctrl.stopped ? "cancelled" : "network"); }
    finally { clearTimeout(t); if (gen === ctrl) gen = null; }
    let data = {}; try { data = await r.json(); } catch (e) {}
    if (!r.ok) throw new Error(data.error || "server_error");
    return data;
  };
  const rpc = async (name, args) => { const { data, error } = await RQ.auth.client().rpc(name, args || {}); if (error) throw new Error((error.message || "").trim() || "server_error"); return data; };

  const demoStatus = () => ({ signed_in: !!S.customer(), consent: !!ls.get("rumiq-ai-consent", null), plan: "free", plan_name: "Gratis", free_play: false, balance: FREE_IMAGES, daily_used: 0, daily_cap: FREE_IMAGES, quality_left: 3, demo: true });
  let cache = null, gen = null;
  const AI = (RQ.ai = {
    live, EDITS, MAXP,
    async status(force) {
      if (RQ.auth && RQ.auth.start) { try { await RQ.auth.start(); } catch (e) {} }
      if (!live()) { if (!preview()) { if (RQ.auth) RQ.auth._started = null; return (cache = { signed_in: !!S.customer(), error: "network" }); } return (cache = demoStatus()); }
      if (!S.customer()) return (cache = { signed_in: false });
      if (cache && !force && cache._t > Date.now() - 15000) return cache;
      // A failed status call is an error, never demo mode: live generation would still charge.
      try { cache = { ...(await rpc("ai_status")), _t: Date.now() }; } catch (e) { cache = { signed_in: true, error: e.message === "network" ? "network" : "server_error" }; }
      return cache;
    },
    peek: () => cache,
    async consent() { if (live()) await rpc("ai_give_consent"); else ls.set("rumiq-ai-consent", new Date().toISOString()); cache = null; },
    async generate({ mode = "place", edit = null, idem, only = null }) {
      const R = RQ.room, scene = R.scene().filter((it) => !only || only.includes(it.h));
      if (!scene.length) throw new Error("empty_scene");
      if (scene.length > MAXP) throw new Error("too_many_products");
      const guide = await AI.composite(1280, only);
      if (!live()) { if (!preview()) throw new Error("network"); const mine = (gen = { stopped: false, abort() { this.stopped = true; } }); await new Promise((ok) => setTimeout(ok, 1200)); if (gen === mine) gen = null; if (mine.stopped) throw new Error("cancelled"); return { demo: true, url: guide }; }
      const room = await AI.roomImage(1280);
      const res = await fn("generate", { idem, mode, edit, scene: scene.map((it) => ({ h: it.h, x: it.x, y: it.y, w: it.w, flip: !!it.flip })), room, guide });
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
        const p = RQ.byHandle(it.h); let im; try { im = await load(RQ.cut(p)); } catch (e) { continue; }
        const w = W * it.w / 100, h = w * im.naturalHeight / im.naturalWidth * (it.sy || 1), x = W * it.x / 100 - w / 2, y = H * it.y / 100 - h;
        cx.save(); cx.filter = R.lightFilter(it.light); if (it.flip) { cx.translate(x + w, y); cx.scale(-1, 1); cx.drawImage(im, 0, 0, w, h); } else cx.drawImage(im, x, y, w, h); cx.restore();
      }
      return cv.toDataURL("image/jpeg", 0.86);
    },
  });
  const load = (src) => new Promise((ok, bad) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => ok(i); i.onerror = bad; i.src = src; });

  /* ------------------------------------------------------------------ the AI sheet */
  const el = document.createElement("div");
  el.className = "sheet ai-sheet"; el.id = "aiSheet"; el.setAttribute("aria-hidden", "true"); el.inert = true;
  el.innerHTML = `<div class="sheet-scrim" data-ai-close></div><div class="sheet-in" role="dialog" aria-modal="true" aria-labelledby="aiTitle" tabindex="-1"><div class="sheet-grab" aria-hidden="true"><span></span></div><button class="iconbtn sheet-x" type="button" data-ai-close aria-label="Stäng">${RQ.ICO5 ? RQ.ICO5.x : "×"}</button><div class="ai-body"></div></div>`;
  document.body.appendChild(el);
  const body = $(".ai-body", el), box = $(".sheet-in", el);
  let isOpen = false, ret = null, busy = false, last = null, pick = {}, chosen = null, pending = null;
  const open = () => { if (!isOpen) { ret = document.activeElement; RQ.closeAll && RQ.closeAll(); } isOpen = true; el.inert = false; el.classList.add("open"); el.setAttribute("aria-hidden", "false"); document.documentElement.classList.add("sheet-lock"); setTimeout(() => box.focus({ preventScroll: true }), 30); };
  const close = () => { if (busy) { AI.stop(); return; } isOpen = false; el.classList.remove("open"); el.setAttribute("aria-hidden", "true"); el.inert = true; document.documentElement.classList.remove("sheet-lock"); if (ret && ret.focus && document.contains(ret)) ret.focus({ preventScroll: true }); AI.hydrate(); };
  const show = (html) => { body.innerHTML = html; box.scrollTop = 0; open(); };
  el.addEventListener("click", (e) => { if (e.target.closest("[data-ai-close]")) close(); });
  document.addEventListener("keydown", (e) => { if (isOpen && e.key === "Escape") { e.stopPropagation(); close(); } }, true);

  const balanceLine = (st) => st.demo ? `Förhandsvisning: ${FREE_IMAGES} bilder i månaden när sajten är live` : `${st.balance} ${st.balance === 1 ? "bild" : "bilder"} kvar${st.plan === "plus" ? " i Studio Plus" : " den här månaden"}`;
  const productsList = (scene) => {
    const total = scene.reduce((s, it) => s + RQ.byHandle(it.h).price, 0);
    return `<ul class="ai-prods">${scene.map((it) => { const p = RQ.byHandle(it.h); return `<li><button type="button" data-sheet="${p.handle}" aria-label="Snabbtitt på ${esc(p.name)}"><img src="${RQ.cut(p)}" alt=""></button><div><b>${esc(p.name)}</b><span>${kr(p.price)}${p.variants ? ` · <em>Bilden visar färgen ${esc(p.variants[0])}</em>` : ""}</span></div></li>`; }).join("")}</ul>
      <div class="ai-sum"><span>Det här finns i bilden</span><b>${kr(total)}</b></div>`;
  };

  const viewSignin = () => show(`<div class="ai-pad"><span class="eyebrow">AI-bild av ditt rum</span><h2 id="aiTitle" class="ai-h">Logga in för att skapa bilden.</h2>
      <p class="ai-lead">Bilderna sparas i ditt konto. Du får ${FREE_IMAGES} bilder gratis varje månad.</p>
      <div class="ai-row"><a class="btn" href="#konto" data-after="mitt-rum" data-ai-close>Logga in</a><a class="btn ghost" href="#skapa-konto" data-after="mitt-rum" data-ai-close>Skapa konto</a></div></div>`);

  const viewConsent = () => {
    show(`<div class="ai-pad"><span class="eyebrow">Innan första bilden</span><h2 id="aiTitle" class="ai-h">Så används din bild.</h2>
      <ul class="ai-list">
        <li><b>Det här skickas:</b> fotot av ditt rum och hur du har ställt produkterna.</li>
        <li><b>Hit:</b> RumIQ:s server i EU och bildtjänsten som skapar bilden.</li>
        <li><b>Så länge:</b> rumsfotot raderas efter 30 dagar. AI-bilderna sparas i ditt konto tills du tar bort dem.</li>
        <li><b>Aldrig:</b> vi använder inte dina bilder för att träna AI och visar dem inte för någon annan.</li>
      </ul>
      <label class="check ai-check"><input type="checkbox" id="aiOk"> Jag godkänner att bilden skickas för att skapa AI-bilder.</label>
      <div class="ai-row"><button class="btn" type="button" id="aiConsentGo" disabled>Fortsätt</button><a class="tlink" href="#juridik-integritet" data-ai-close>Läs integritetspolicyn</a></div></div>`);
    $("#aiOk", body).addEventListener("change", (e) => ($("#aiConsentGo", body).disabled = !e.target.checked));
    $("#aiConsentGo", body).addEventListener("click", async (e) => { e.currentTarget.disabled = true; try { await AI.consent(); viewCompose(); } catch (x) { RQ.toast(esc(errText(x.message))); e.currentTarget.disabled = false; } });
  };

  const chipsHtml = (st) => st.free_play ? `<div class="ai-edits">
      <div class="ai-edits-h"><b>Prova fritt</b><span class="small">Välj en eller flera. Produkterna står kvar.</span></div>
      ${Object.entries(EDITS).map(([k, g]) => `<div class="ai-eg"><span>${g.label}</span><div class="chips">${Object.entries(g.opts).map(([v, l]) => `<button type="button" class="chip" data-edit="${k}" data-v="${v}" aria-pressed="${pick[k] === v}">${l}</button>`).join("")}</div></div>`).join("")}
    </div>` : `<a class="ai-more" href="#studio-plus" data-ai-close><span><b>Prova väggfärg, golv, ljus och stil</b><small>Ingår i Studio Plus, ${PRICE} kr i månaden.</small></span><span class="plus-badge">Studio Plus</span></a>`;
  /* more things in the room than a picture can hold: you choose which ones come along */
  const chooseHtml = (scene) => `<fieldset class="ai-choose"><legend>En bild rymmer ${MAXP} saker. Välj vilka som ska med.</legend>${scene.map((it) => { const p = RQ.byHandle(it.h); return `<label><input type="checkbox" data-in="${it.h}" ${chosen.includes(it.h) ? "checked" : ""}><img src="${RQ.cut(p)}" alt=""><span>${esc(p.name)}</span></label>`; }).join("")}<p class="small" id="aiCount" role="status"></p></fieldset>`;

  async function viewCompose() {
    const st = await AI.status(true), scene = RQ.room.scene();
    if (!st.signed_in) return viewSignin();
    if (st.error) {
      show(`<div class="ai-pad"><h2 id="aiTitle" class="ai-h">Det gick inte att nå bildskaparen.</h2><p class="ai-lead">${esc(errText(st.error))}</p><div class="ai-row"><button class="btn" type="button" id="aiRetry">Försök igen</button></div></div>`);
      $("#aiRetry", body).addEventListener("click", viewCompose); return;
    }
    if (!st.consent) return viewConsent();
    if (!st.demo && st.balance <= 0) return viewOut(st);
    const tooMany = scene.length > MAXP;
    if (!tooMany) chosen = null; else if (!chosen || chosen.some((h) => !scene.some((it) => it.h === h))) chosen = scene.slice(0, MAXP).map((it) => it.h);
    const shot = await AI.composite(900, chosen).catch(() => RQ.room.url());
    show(`<div class="ai-grid"><figure class="ai-fig"><img src="${shot}" alt="Din uppställning" id="aiShot"><figcaption>Din uppställning. AI:n behåller platserna och gör ljus och skuggor verkliga.</figcaption></figure>
      <div class="ai-pad"><span class="eyebrow">${esc(balanceLine(st))}</span><h2 id="aiTitle" class="ai-h">Gör bilden verklig.</h2>
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
    const sig = JSON.stringify([scene, edit, mode]);
    const idem = again || (pending && pending.sig === sig ? pending.key : "g-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8));
    pending = { sig, key: idem };
    const before = await AI.composite(1100, only).catch(() => RQ.room.url());
    busy = true;
    show(`<div class="ai-pad ai-wait"><div class="ai-spin" aria-hidden="true"></div><h2 id="aiTitle" class="ai-h">Skapar din bild…</h2><p class="ai-lead" role="status">Det brukar ta 15–40 sekunder. Ha sidan öppen så länge.</p><figure class="ai-fig shimmer"><img src="${before}" alt=""></figure><button class="btn ghost sm" type="button" id="aiStop">Avbryt</button></div>`);
    $("#aiStop", body).addEventListener("click", () => AI.stop());
    let res;
    try { res = await AI.generate({ mode, edit: mode === "edit" ? edit : null, idem, only }); }
    catch (e) {
      busy = false;
      if (e.message === "cancelled") { await viewCompose(); RQ.toast(st.demo ? "Avbrutet." : "Avbrutet. Hann bilden bli klar får du samma bild nästa gång du trycker på Skapa bild, utan att det dras en till."); return; }
      if (e.message === "no_credits") return viewOut(await AI.status(true));
      if (e.message === "not_signed_in") return viewSignin();
      const sameAgain = e.message === "network" || e.message === "in_progress";
      show(`<div class="ai-pad"><h2 id="aiTitle" class="ai-h">Det gick inte den här gången.</h2><p class="ai-lead">${esc(errText(e.message))}</p><div class="ai-row">${sameAgain ? `<button class="btn" type="button" id="aiSame">Försök igen</button>` : ""}<button class="btn ${sameAgain ? "ghost" : ""}" type="button" id="aiBack">Tillbaka</button></div></div>`);
      $("#aiBack", body).addEventListener("click", viewCompose);
      const same = $("#aiSame", body); if (same) same.addEventListener("click", () => run(st, idem));
      return;
    }
    busy = false; pending = null;
    if (!res.demo) await AI.status(true).catch(() => {});
    last = { ...res, before, scene, mode };
    viewResult();
  }

  function viewResult() {
    const r = last, st = AI.peek() || {};
    show(`<div class="ai-grid result">
      <figure class="ai-ba" id="aiBa" style="--x:100%"><img class="after" src="${esc(r.url)}" alt="AI-bild av ditt rum med produkterna"><img class="before" src="${r.before}" alt="Din uppställning"><span class="ai-tag">${r.demo ? "Demo" : "AI-bild"}</span><input type="range" min="0" max="100" value="100" aria-label="Jämför före och efter"><span class="ai-ba-hint">Dra för att jämföra</span></figure>
      <div class="ai-pad"><span class="eyebrow">${r.demo ? "Förhandsvisning" : "Klar"}</span><h2 id="aiTitle" class="ai-h">${r.demo ? "Så här fungerar det." : "Ditt rum, med sakerna på plats."}</h2>
        ${r.demo ? `<p class="ai-lead">På den riktiga sajten blir din uppställning en AI-bild med verkligt ljus och skuggor. Här visar vi uppställningen som den är.</p>` : `<p class="small">Bilden är skapad med AI. Färg och storlek kan skilja sig något från verkligheten.</p>`}
        ${productsList(r.scene)}
        <div class="ai-row"><button class="btn" type="button" id="aiBuy">Köp allt</button><button class="btn ghost" type="button" id="aiSave">Spara bilden</button></div>
        <div class="ai-row small-row"><button class="tlink" type="button" id="aiAgain">Skapa igen</button>${!r.demo && r.id && st.quality_left > 0 ? `<button class="tlink" type="button" id="aiBad">Produkten blev fel</button>` : ""}${r.demo ? `<a class="tlink" href="#studio-plus" data-ai-close>Om Studio Plus</a>` : ""}</div></div></div>`);
    const ba = $("#aiBa", body), range = $("input", ba);
    range.addEventListener("input", () => ba.style.setProperty("--x", range.value + "%"));
    $("#aiBuy", body).addEventListener("click", (e) => { RQ.addMany(r.scene.map((it) => it.h), e.currentTarget, "Ditt rum"); });
    $("#aiSave", body).addEventListener("click", async (e) => {
      const b = e.currentTarget; b.disabled = true;
      try {
        const img = r.demo ? r.url : await toDataUrl(r.url);
        const ok = S.saveProject({ title: (r.demo ? "Mitt rum" : "AI-bild") + " med " + r.scene.map((it) => RQ.byHandle(it.h).name.split(" ")[0]).join(", "), img, before: r.before, handles: r.scene.map((it) => it.h) });
        RQ.toast(ok ? 'Bilden är sparad. <a href="#mitt-hem" data-ai-close>Se Sparat</a>' : "Webbläsarens lagring är full. Ta bort ett gammalt projekt under Sparat.");
      } catch (x) { RQ.toast("Bilden kunde inte sparas. Försök igen."); b.disabled = false; }
    });
    $("#aiAgain", body).addEventListener("click", viewCompose);
    const bad = $("#aiBad", body);
    if (bad) bad.addEventListener("click", async () => {
      bad.disabled = true;
      try { const n = await AI.qualityRefund(r.id, "Produkten blev fel"); RQ.toast(`Bilden är tillbaka på ditt saldo. ${n} ${n === 1 ? "ersättning" : "ersättningar"} kvar den här månaden.`); bad.remove(); }
      catch (x) { RQ.toast(esc(errText(x.message))); }
    });
  }
  const toDataUrl = async (url) => { const im = await load(url); const cv = document.createElement("canvas"); const k = Math.min(1, 1100 / im.naturalWidth); cv.width = Math.round(im.naturalWidth * k); cv.height = Math.round(im.naturalHeight * k); cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height); return cv.toDataURL("image/jpeg", 0.8); };

  function viewOut(st) {
    const next = st.period_end ? new Date(st.period_end).toLocaleDateString(window.RQ_LANG === "en" ? "en-GB" : "sv-SE", { day: "numeric", month: "long" }) : "";
    show(`<div class="ai-pad"><span class="eyebrow">Slut på bilder</span><h2 id="aiTitle" class="ai-h">${st.plan === "plus" ? "Du har använt periodens bilder." : "Du har använt månadens gratisbilder."}</h2>
      <p class="ai-lead">${next ? `Nya bilder kommer ${esc(next)}.` : ""}${st.plan === "plus" ? "" : ` Med Studio Plus får du ${PLUS_IMAGES} bilder i månaden och kan prova väggfärg, golv, ljus och stil.`}</p>
      <div class="ai-row">${st.plan === "plus" ? `<button class="btn" type="button" data-ai-close>Stäng</button>` : `<a class="btn" href="#studio-plus" data-ai-close>Se Studio Plus · ${PRICE} kr/mån</a>`}</div></div>`);
  }

  RQ.openAI = () => { if (!RQ.room.has()) { RQ.room.openSetup(() => (location.hash = "#mitt-rum")); return; } pick = {}; chosen = null; viewCompose(); };
  document.addEventListener("click", (e) => { if (e.target.closest("[data-ai-create]")) { e.preventDefault(); RQ.openAI(); } });

  /* ------------------------------------------------------------------ card in Mitt rum, balance chips */
  AI.card = () => `<div class="ai-card"><div><b>Gör bilden verklig</b><span data-ai-balance>${FREE_IMAGES} AI-bilder gratis varje månad</span></div><button class="btn sm" type="button" data-ai-create>Skapa AI-bild</button></div>`;
  AI.hydrate = async () => {
    const chips = $$("[data-ai-balance]"), acct = $("[data-ai-account]:not([data-done])");
    if (!chips.length && !acct) return;
    const st = await AI.status();
    chips.forEach((c) => (c.textContent = !st.signed_in ? `${FREE_IMAGES} AI-bilder gratis varje månad med konto` : balanceLine(st)));
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
        <p class="lead">Ställ in produkterna i ditt eget rum och få en verklighetstrogen bild med rätt ljus och skuggor. Med Studio Plus kan du också prova väggfärg, golv, ljus och stil.</p></div>
        <figure class="sp-pair"><div><img src="assets/img/rum/sovrum-fore-900.webp" alt="Ett sovrum med tomt nattduksbord och bar säng" width="900" height="504" decoding="async"><span>Ditt foto</span></div><div><img src="assets/img/rum/sovrum-efter-900.webp" alt="Samma sovrum med lampa, pläd och korg på plats" width="900" height="504" decoding="async"><span>Med sakerna på plats</span></div><figcaption>Exempel: samma rum före och efter.</figcaption></figure></div></section>
      <section class="wrap sp-plans">
        <article class="sp-plan"><span class="eyebrow">Gratis</span><h2>0 kr</h2><ul><li>${FREE_IMAGES} AI-bilder i månaden</li><li>Dina produkter så nära dina platser som möjligt</li><li>Kräver ett konto</li></ul><a class="btn ghost block" href="#mitt-rum">Börja i Mitt rum</a></article>
        <article class="sp-plan plus"><span class="eyebrow">Studio Plus</span><h2>${PRICE} kr <small>/ månad</small></h2><ul><li>${PLUS_IMAGES} AI-bilder i månaden</li><li>Prova fritt: väggfärg, golv, ljus och stil</li><li>Ingen bindningstid, säg upp när du vill</li><li>Pris inklusive moms</li></ul>
          <div id="spBuy"></div></article></section>
      <section class="wrap sp-steps"><ol><li><b>Ta en bild av ditt rum</b><span>Eller välj ett exempelrum.</span></li><li><b>Ställ in produkterna</b><span>Dra dem dit du vill ha dem, flera på en gång.</span></li><li><b>Skapa bilden</b><span>AI:n gör ljus, skuggor och perspektiv verkliga.</span></li></ol></section>
      <section class="wrap sp-faq"><h2 class="h2">Frågor</h2>
        <details><summary>Blir bilden exakt?</summary><p>Nästan. AI:n håller platserna och produkternas form så nära som möjligt, men färg och storlek kan skilja sig något. Blev en produkt fel får du bilden tillbaka, upp till tre gånger i månaden.</p></details>
        <details><summary>Hur många bilder kan jag göra?</summary><p>${FREE_IMAGES} i månaden utan kostnad, eller ${PLUS_IMAGES} i månaden med Studio Plus, högst 30 på ett dygn. En bild rymmer upp till ${MAXP} produkter.</p></details>
        <details><summary>Hur säger jag upp?</summary><p>Under Konto, med ett klick. Du behåller bilderna perioden ut.</p></details>
        <details><summary>Kan jag ångra köpet?</summary><p>Ja, inom 14 dagar. Abonnemanget avslutas direkt och du får tillbaka betalningen minus den del du har använt. Har du använt 10 av 100 bilder får du tillbaka 90 procent.</p></details>
        <details><summary>Vad händer med mina bilder?</summary><p>Rumsfotot raderas efter 30 dagar. AI-bilderna sparas i ditt konto tills du tar bort dem. Vi tränar ingen AI på dem.</p></details>
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
    <p>Med ett konto får du ${FREE_IMAGES} AI-bilder per kalendermånad utan kostnad. Studio Plus kostar ${PRICE} kr per månad inklusive moms och ger ${PLUS_IMAGES} AI-bilder per betalningsperiod och möjlighet att prova väggfärg, golv, ljus och stil. Oanvända bilder sparas inte till nästa period. Det finns en gräns per dygn (${FREE_IMAGES} bilder utan abonnemang, 30 med Studio Plus).</p>
    <p>Abonnemanget förnyas automatiskt varje månad tills du säger upp det. Du säger upp under Konto, och abonnemanget gäller då perioden ut.</p>
    <p><b>Ångerrätt:</b> När du tecknar ber du oss uttryckligen att starta tjänsten direkt. Ångrar du dig inom 14 dagar avslutas abonnemanget omedelbart och du får tillbaka betalningen minus en proportionell del för det du har använt, räknat som antal skapade bilder av ${PLUS_IMAGES}.</p>
    <p>AI-bilderna är illustrationer. Färg, storlek och detaljer kan skilja sig från de riktiga produkterna. Blev en produkt fel kan du få bilden återförd till ditt saldo, högst tre gånger per månad.</p>`);
  addLegal("integritet", `<h2>Mitt rum: AI-bilder</h2>
    <p><b>Utkast, ska granskas före lansering.</b></p>
    <p>När du väljer att skapa en AI-bild, och först efter att du har godkänt det, skickar vi fotot av ditt rum och din uppställning till vår server i EU (Supabase) och till bildtjänsten som skapar bilden. Rumsfotot raderas automatiskt efter 30 dagar. AI-bilderna sparas i ditt konto tills du tar bort dem eller tar bort kontot. Vi använder inte bilderna för att träna AI och visar dem inte för någon annan. Rättslig grund: ditt samtycke och avtalet om tjänsten. Betalningar för Studio Plus hanteras av Stripe.</p>`);

})();
