/* RumIQ v5 "Ett levande hem": the flowing layer.
   Product sheet (opens over where you are), shoppable rooms with hotspots, the home walk
   through the rooms, Svep + taste profile, Looks, Leveranskoll, "Säg till när den finns",
   Rösta, Upptäck, colour and mood search, fly-to-cart. Loaded after room.js, before home.js. */
(function () {
  const RQ = window.RQ, S = RQ.shop, V = RQ.views, $ = RQ.$, $$ = RQ.$$, esc = RQ.esc, kr = S.kr;
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wide = () => matchMedia("(min-width: 900px)").matches;
  const ls = S.store; // the shop's one typed reader (commerce.js)
  const ICO = {
    x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    heart: '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
    eye: '<svg viewBox="0 0 24 24"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/></svg>',
    arrow: '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    spark: '<svg viewBox="0 0 24 24"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/></svg>',
  };
  RQ.ICO5 = ICO;
  const hex2rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const toneDist = (p, rgb) => Math.min(...p.tone.map((t) => dist(hex2rgb(t), rgb)));
  const formEndpoint = () => RQ.FORM_ENDPOINT || (window.RQ_CONFIG && window.RQ_CONFIG.formEndpoint) || "";
  // resolves "sent", "preview" (no endpoint configured: nothing leaves the browser) or "error"
  // sign-ups go to a form service if one is set, otherwise to RumIQ's own Supabase table (insert-only for visitors)
  const toSupabase = (body) => {
    const c = (window.RQ_CONFIG || {}), a = c.auth || {}, t = (c.waitlist || {}).table;
    if (!a.supabaseUrl || !a.supabaseAnonKey || !t) return Promise.resolve("preview");
    const row = { email: String(body.email || "").toLowerCase().slice(0, 254), list: String(body.lista || "väntelista").slice(0, 120), note: body.roster ? String(body.roster).slice(0, 500) : null, lang: window.RQ_LANG === "en" ? "en" : "sv", consent: true };
    return fetch(`${a.supabaseUrl}/rest/v1/${t}`, { method: "POST", headers: { apikey: a.supabaseAnonKey, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(row) })
      .then((r) => (r.ok || r.status === 409 ? "sent" : "error"), () => "error");
  };
  // one request at a time per form: the button rests while it runs, so two taps are one sign-up
  RQ.once = (f, run) => { const b = f.querySelector("button[type=submit]"); if (!b || b.disabled) return Promise.resolve(); b.disabled = true; f.setAttribute("aria-busy", "true"); const end = () => { b.disabled = false; f.removeAttribute("aria-busy"); }; return Promise.resolve().then(run).then(end, end); };
  const post = (body) => { const u = formEndpoint(); if (!u) return toSupabase(body); return fetch(u, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => (r.ok ? "sent" : "error"), () => "error"); };
  RQ.subscribe = (body) => post(body).then((res) => { if (res === "sent" && RQ.track) RQ.track("sign_up", { list: body.lista || "" }); return res; });
  const PREVIEW_NOTE = "Förhandsversion: adressen sparas inte än. När butiken öppnar fungerar det här på riktigt.";
  const afterPost = (f, res, okText) => {
    const ok = $(".nt-ok", f), err = $(".nt-err", f);
    if (res === "error") { err.textContent = "Det gick inte att skicka just nu. Försök igen om en stund."; return false; }
    ok.textContent = res === "preview" ? PREVIEW_NOTE : okText; f.classList.add("sent"); return true;
  };
  const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

  /* ------------------------------------------------------------------ fly to cart */
  const cartTarget = () => [...$$(".dock [data-open-cart], .tools [data-open-cart]")].find((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && getComputedStyle(b).visibility !== "hidden" && r.bottom > 0 && r.top < innerHeight; });
  // a saved product flies to the heart (Sparat in the dock, or the heart in the header)
  const wishTarget = () => [...$$(".dock [data-dock=sparat], .tools .wishlink")].find((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && getComputedStyle(b).visibility !== "hidden" && r.bottom > 0 && r.top < innerHeight; });
  RQ.flyWish = (btn) => { const src = flySource(btn); if (src) RQ.fly(src, null, wishTarget()); };
  RQ.fly = (from, src, to) => {
    if (reduced() || !from || !from.getBoundingClientRect) return;
    const t = to || cartTarget(); if (!t) return;
    const a = from.getBoundingClientRect(), b = t.getBoundingClientRect(); if (!a.width) return;
    const size = Math.min(140, Math.max(48, a.width));
    const im = document.createElement("img");
    im.src = src || from.currentSrc || from.src; im.alt = ""; im.className = "flyer";
    Object.assign(im.style, { left: a.left + a.width / 2 - size / 2 + "px", top: a.top + a.height / 2 - size / 2 + "px", width: size + "px", height: size + "px" });
    document.body.appendChild(im);
    const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    const anim = im.animate([
      { transform: "translate(0,0) scale(1)", opacity: 1 },
      { transform: `translate(${dx * 0.55}px, ${dy * 0.35 - 60}px) scale(.62)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) scale(.16)`, opacity: 0.25 },
    ], { duration: 720, easing: "cubic-bezier(.45,.05,.25,1)" });
    anim.onfinish = () => { im.remove(); t.animate([{ transform: "scale(1)" }, { transform: "scale(1.18)" }, { transform: "scale(1)" }], { duration: 320, easing: "ease-out" }); };
  };
  const flySource = (btn) => {
    if (!btn || !btn.closest) return null;
    const host = btn.closest(".card, .sheet-in, .lc, .sv-card, .lp-item");
    if (host) return $("img", host);
    if (btn.closest(".pinfo, .buybar")) return $(".pg-item img") || $(".buybar img");
    return null;
  };
  const baseConfirm = RQ.confirmAdd;
  RQ.confirmAdd = (btn, name) => { baseConfirm(btn, name); RQ.fly(flySource(btn)); };
  const addMany = (handles, btn, label) => {
    if (btn && btn.classList && btn.classList.contains("done")) return 0; // the same button again within a moment: a double tap, not a second order
    handles.forEach((h) => S.addToCart(h + "::0", 1));
    const n = handles.length;
    RQ.toast(`${label ? esc(label) + ": " : ""}${n} ${n === 1 ? "produkt" : "produkter"} ligger i varukorgen. <a href="#" data-open-cart>Visa</a>`);
    if (btn && btn.classList) { btn.classList.add("done"); clearTimeout(btn._t); btn._t = setTimeout(() => btn.classList.remove("done"), 1600); }
    return n;
  };
  RQ.addMany = addMany;

  /* ------------------------------------------------------------------ Leveranskoll */
  const PENDING = '<span class="pending">Bekräftas innan vi öppnar</span>';
  RQ.delivery = {
    cfg(p) { const c = (window.RQ_CONFIG && window.RQ_CONFIG.delivery) || {}; return Object.assign({}, c, (p && p.ship) || {}); },
    range(c, from) {
      if (!c.minDays || !c.maxDays) return "";
      // business days: orders placed after the cut-off hour or at weekends start counting on the next weekday
      const add = (n) => { const x = from ? new Date(from) : new Date(); if (x.getHours() >= (c.cutoffHour || 14)) x.setDate(x.getDate() + 1); while (x.getDay() === 0 || x.getDay() === 6) x.setDate(x.getDate() + 1);
        let left = n; while (left > 0) { x.setDate(x.getDate() + 1); if (x.getDay() !== 0 && x.getDay() !== 6) left--; } return x; };
      const f = (d) => add(d).toLocaleDateString(RQ_LANG === "en" ? "en-GB" : "sv-SE", { weekday: "short", day: "numeric", month: "short" });
      return `${f(c.minDays)} – ${f(c.maxDays)}`;
    },
    html(p) {
      const c = this.cfg(p), r = this.range(c);
      return `<div class="lk" role="group" aria-label="Leveranskoll"><p class="lk-h">Leveranskoll</p>
        <ol><li class="on"><i></i><b>Beställ</b><span>Idag</span></li><li class="${c.fromCountry ? "on" : ""}"><i></i><b>Skickas från</b><span>${c.fromCountry ? esc(c.fromCountry) : PENDING}</span></li><li class="${r ? "on" : ""}"><i></i><b>Hos dig</b><span>${r || PENDING}</span></li></ol>
        <p class="lk-f">${c.openPurchaseDays ? `${c.openPurchaseDays} dagars öppet köp.` : "14 dagars ångerrätt."} ${c.returnText ? esc(c.returnText) : "Hur returen går till står här när den är bekräftad."}${(window.RQ_CONFIG || {}).freeShippingFrom ? ` Fri frakt till ombud och paketskåp från ${kr(window.RQ_CONFIG.freeShippingFrom)}.` : ""}</p></div>`;
    },
  };

  /* ------------------------------------------------------------------ Säg till när den finns */
  RQ.notify = {
    has(h) { return ls.get("rumiq-notify", []).includes(h); },
    html(p) {
      const done = this.has(p.handle);
      return `<form class="notify${done ? " sent" : ""}" data-notify="${p.handle}" novalidate>
        <button type="button" class="tlink nt-open">Säg till när den finns</button>
        <div class="nt-f" hidden><label class="sr" for="nt-${p.handle}">Din e-post</label><input id="nt-${p.handle}" type="email" autocomplete="email" placeholder="Din e-post"><button class="btn sm" type="submit">Säg till</button></div>
        <p class="nt-err" role="alert"></p><p class="nt-ok" role="status">Klart. Vi mejlar när den går att köpa. Inget annat.</p></form>`;
    },
  };
  document.addEventListener("click", (e) => {
    const o = e.target.closest(".nt-open"); if (!o) return;
    const f = o.closest("form"); $(".nt-f", f).hidden = false; o.hidden = true; $("input", f).focus();
  });
  document.addEventListener("submit", (e) => {
    const f = e.target.closest("form[data-notify]"); if (!f) return;
    e.preventDefault();
    const v = $("input", f).value.trim(), err = $(".nt-err", f);
    if (!emailOk(v)) { err.textContent = "Skriv en e-postadress, till exempel namn@exempel.se."; return; }
    err.textContent = "";
    const h = f.dataset.notify;
    RQ.once(f, () => post({ email: v, lista: "Produkt: " + h }).then((res) => {
      if (!afterPost(f, res, "Klart. Vi mejlar när den går att köpa. Inget annat.")) return;
      const list = ls.get("rumiq-notify", []); if (res === "sent" && !list.includes(h)) ls.set("rumiq-notify", [...list, h]);
    }));
  });

  /* ------------------------------------------------------------------ product sheet */
  const sheetEl = document.createElement("div");
  sheetEl.className = "sheet"; sheetEl.id = "sheet";
  sheetEl.setAttribute("aria-hidden", "true"); sheetEl.inert = true;
  sheetEl.innerHTML = `<div class="sheet-scrim" data-sheet-close></div><div class="sheet-in" role="dialog" aria-modal="true" aria-labelledby="shTitle" tabindex="-1"><div class="sheet-grab" aria-hidden="true"><span></span></div><button class="iconbtn sheet-x" type="button" data-sheet-close aria-label="Stäng">${ICO.x}</button><div class="sheet-body"></div></div>`;
  document.body.appendChild(sheetEl);
  const sIn = $(".sheet-in", sheetEl), sBody = $(".sheet-body", sheetEl);
  let sOpen = false, sReturn = null;

  const sheetHtml = (p) => {
    const cat = RQ.catById(p.cat), vs = p.variants || [];
    return `<figure class="sh-img"><img src="${RQ.img(p, 900)}" srcset="${RQ.img(p, 600)} 600w, ${RQ.img(p, 900)} 900w" sizes="(min-width:900px) 30rem, 100vw" alt="${esc(p.name)}"></figure>
      <div class="sh-tx">
        <span class="eyebrow"><span>${esc(cat ? cat.name : "")}</span></span>
        <h2 id="shTitle">${esc(p.name)}</h2>
        <p class="sh-price">${kr(p.price)}</p>
        <p class="sh-short">${esc(p.short)}</p>
        ${vs.length ? `<div class="sh-v" role="radiogroup" aria-label="Variant">${vs.map((v, i) => `<button type="button" class="chip" role="radio" aria-checked="${i === 0}" data-shv="${i}">${esc(v)}</button>`).join("")}</div>` : ""}
        <div class="sh-act">
          <button class="btn" type="button" id="shAdd" data-add="${p.handle}::0">Lägg i varukorgen</button>
          <button class="iconbtn sh-fav" type="button" data-wish="${p.handle}" aria-pressed="${S.isWished(p.handle)}" aria-label="Spara ${esc(p.name)}">${ICO.heart}</button>
        </div>
        <button class="btn ghost block sh-room" type="button" data-room-btn="${p.handle}" aria-pressed="${!!(RQ.room && RQ.room.inScene(p.handle))}">${RQ.roomIco}<span>Ställ in i mitt rum</span></button>
        ${RQ.delivery.html(p)}
        <a class="sh-more" href="#produkt-${p.handle}">Se hela produkten ${ICO.arrow}</a>
      </div>`;
  };
  const focusables = () => $$("a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex='-1'])", sIn).filter((el) => !el.closest("[hidden]") && el.offsetParent !== null);

  RQ.sheet = {
    isOpen: () => sOpen,
    open(handle, opts = {}) {
      const p = RQ.byHandle(handle); if (!p) return;
      RQ.closeAll && RQ.closeAll();
      sBody.innerHTML = sheetHtml(p); sBody.scrollTop = 0; sIn.scrollTop = 0;
      sReturn = opts.from || document.activeElement;
      if (!sOpen) { try { history.pushState({ rqSheet: 1 }, "", location.href); } catch (e) {} }
      sOpen = true;
      sheetEl.inert = false; sheetEl.classList.add("open"); sheetEl.setAttribute("aria-hidden", "false"); sIn.style.transform = ""; sIn.style.transition = "";
      document.documentElement.classList.add("sheet-lock");
      setTimeout(() => sIn.focus({ preventScroll: true }), 30);
    },
    hide() {
      if (!sOpen) return; sOpen = false;
      sheetEl.classList.remove("open"); sheetEl.setAttribute("aria-hidden", "true"); sheetEl.inert = true;
      sIn.style.transition = ""; sIn.style.transform = "";
      document.documentElement.classList.remove("sheet-lock");
      if (sReturn && sReturn.focus && document.contains(sReturn)) sReturn.focus({ preventScroll: true });
    },
    close(nav) {
      const had = history.state && history.state.rqSheet;
      this.hide();
      if (nav) { if (had) { history.replaceState(null, "", nav); RQ.router(); } else location.hash = nav; }
      else if (had) history.back();
    },
  };
  window.addEventListener("popstate", () => { if (sOpen) RQ.sheet.hide(); });
  window.addEventListener("hashchange", () => { if (sOpen) RQ.sheet.hide(); });
  sheetEl.addEventListener("click", (e) => {
    if (e.target.closest("[data-sheet-close]")) { RQ.sheet.close(); return; }
    const v = e.target.closest("[data-shv]");
    if (v) { $$("[data-shv]", sheetEl).forEach((x) => x.setAttribute("aria-checked", x === v)); const add = $("#shAdd", sheetEl); add.dataset.add = add.dataset.add.split("::")[0] + "::" + v.dataset.shv; return; }
    const a = e.target.closest("a[href^='#']");
    if (a && a.getAttribute("href").length > 1) { e.preventDefault(); RQ.sheet.close(a.getAttribute("href")); return; }
    if (e.target.closest("[data-room-btn]") && !(RQ.room && RQ.room.has())) RQ.sheet.close();
  });
  document.addEventListener("keydown", (e) => {
    if (!sOpen) return;
    if (e.key === "Escape") { e.stopPropagation(); RQ.sheet.close(); return; }
    if (e.key === "Tab") {
      const f = focusables(); if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === sIn)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }, true);
  // drag the sheet down to close (phones)
  (() => {
    let y0 = 0, dy = 0, t0 = 0, drag = false;
    sIn.addEventListener("pointerdown", (e) => {
      if (wide() || e.pointerType === "mouse" || !e.target.closest(".sheet-grab") || sIn.scrollTop > 0) return;
      drag = true; y0 = e.clientY; dy = 0; t0 = performance.now(); sIn.style.transition = "none";
    });
    window.addEventListener("pointermove", (e) => { if (!drag) return; dy = Math.max(0, e.clientY - y0); sIn.style.transform = `translateY(${dy}px)`; }, { passive: true });
    const end = () => {
      if (!drag) return; drag = false; sIn.style.transition = "";
      const v = dy / Math.max(1, performance.now() - t0);
      if (dy > 120 || v > 0.7) RQ.sheet.close(); else sIn.style.transform = "";
    };
    window.addEventListener("pointerup", end); window.addEventListener("pointercancel", end);
  })();
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-sheet], [data-hs]"); if (!t) return;
    e.preventDefault(); RQ.sheet.open(t.dataset.sheet || t.dataset.hs, { from: t });
  });

  /* ------------------------------------------------------------------ shoppable rooms */
  const IW = 1600, IH = 893;
  /* Living room pictures: the photo leans away from the pointer and the dots lean towards it, with a soft
     light that follows, so the room reads as a space with depth. On touch screens the photo drifts with
     scrolling instead. Nothing moves with "reduce motion". */
  function depth(stages) {
    if (reduced() || !stages.length) return () => {};
    const fine = matchMedia("(hover: hover) and (pointer: fine)").matches, offs = [];
    stages.forEach((st) => {
      st.classList.add("deep");
      if (fine) {
        let raf = 0, tx = 0, ty = 0;
        const paint = () => { raf = 0; st.style.setProperty("--px", tx.toFixed(3)); st.style.setProperty("--py", ty.toFixed(3)); };
        const move = (e) => { const r = st.getBoundingClientRect(); tx = ((e.clientX - r.left) / r.width) * 2 - 1; ty = ((e.clientY - r.top) / r.height) * 2 - 1; if (!raf) raf = requestAnimationFrame(paint); };
        const leave = () => { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(paint); };
        st.addEventListener("pointermove", move); st.addEventListener("pointerleave", leave);
        offs.push(() => { st.removeEventListener("pointermove", move); st.removeEventListener("pointerleave", leave); });
      }
    });
    // touch screens: no scroll-driven parallax. Repainting a blended light layer on every scroll frame made phones stutter.
    return () => offs.forEach((f) => f());
  }
  RQ.hotspots = {
    render(id, opts = {}) {
      const r = RQ.HOTSPOTS[id], room = RQ.roomById(id); if (!r) return "";
      const spots = r.spots.filter(([h]) => !opts.only || opts.only.includes(h)).map(([h, x, y]) => { const p = RQ.byHandle(h); return `<button class="hs" type="button" data-hs="${h}" data-x="${x}" data-y="${y}" aria-label="${esc(p.name)}, ${kr(p.price)}. Liknande i butiken."><i aria-hidden="true"></i><span class="hs-l" aria-hidden="true"><b>${esc(p.name)}</b><em>${kr(p.price)} · Liknande i butiken</em></span></button>`; }).join("");
      return `<div class="hs-stage${opts.cls ? " " + opts.cls : ""}" data-room="${id}" style="--pos:${r.pos}"><div class="hs-drift"><img class="hs-img" src="assets/img/rum/${id}-1600.webp" srcset="assets/img/rum/${id}-900.webp 900w, assets/img/rum/${id}-1600.webp 1600w" sizes="(min-width:900px) 64vw, 180vw" alt="${esc(room ? room.name : "")}, illustration" ${opts.eager ? "" : 'loading="lazy"'} decoding="async"><div class="hs-layer">${spots}</div></div></div>`;
    },
    caption: () => `<p class="hs-cap">Bilderna är illustrationer. Prickarna visar liknande produkter i butiken.</p>`,
    handles(id) { return [...new Set((RQ.HOTSPOTS[id] || { spots: [] }).spots.map((s) => s[0]))]; },
    total(id) { return this.handles(id).reduce((s, h) => s + RQ.byHandle(h).price, 0); },
    layout(stage) {
      const W = stage.clientWidth, H = stage.clientHeight; if (!W || !H) return;
      const pos = (getComputedStyle(stage).getPropertyValue("--pos") || "50% 50%").trim().split(/\s+/).map((v) => parseFloat(v) / 100);
      const s = Math.max(W / IW, H / IH), dw = IW * s, dh = IH * s, ox = (W - dw) * pos[0], oy = (H - dh) * pos[1];
      $$(".hs", stage).forEach((b) => {
        const x = ox + (+b.dataset.x / 100) * dw, y = oy + (+b.dataset.y / 100) * dh;
        const vis = x > 18 && x < W - 18 && y > 18 && y < H - 18;
        b.style.left = x + "px"; b.style.top = y + "px"; b.hidden = !vis;
        b.classList.toggle("flip", x > W * 0.6); b.classList.toggle("up", y > H * 0.72);
      });
    },
    mount(root) {
      const stages = $$(".hs-stage", root); if (!stages.length) return () => {};
      const ro = "ResizeObserver" in window ? new ResizeObserver((es) => es.forEach((e) => this.layout(e.target))) : null;
      stages.forEach((st) => { this.layout(st); ro && ro.observe(st); const im = $("img", st); if (im && !im.complete) im.addEventListener("load", () => this.layout(st), { once: true }); });
      const offDepth = depth(stages);
      return () => { ro && ro.disconnect(); offDepth(); };
    },
  };
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-shop-room]"); if (!b) return;
    const id = b.dataset.shopRoom, hs = RQ.hotspots.handles(id), room = RQ.roomById(id);
    if (!addMissing(hs, b, room ? room.name : "Rummet").length) return;
    const stage = b.closest("section, .jr-room") && $(`.hs-stage[data-room="${id}"]`, b.closest("section, .jr-room"));
    if (stage) $$(".hs:not([hidden])", stage).forEach((s, i) => setTimeout(() => RQ.fly(s, RQ.cut(RQ.byHandle(s.dataset.hs))), i * 110));
  });

  /* "Gå genom hemmet": one sticky stage, rooms cross-fade with scroll */
  RQ.journey = {
    html() {
      const ids = RQ.JOURNEY, n = ids.length;
      return `<section class="journey" id="hemmet" style="--n:${n}" aria-label="Gå genom hemmet">
        <div class="wrap jr-head"><h2 class="display">Gå genom hemmet.</h2><p class="lead">Fem rum, en sak i taget. Tryck på en prick för att se vad som finns i rummet, och handla direkt.</p></div>
        <div class="jr-stick">
          ${ids.map((id, i) => { const r = RQ.roomById(id), t = RQ.hotspots.total(id), c = RQ.hotspots.handles(id).length; return `<article class="jr-room${i === 0 ? " on" : ""}" data-i="${i}" ${i ? "inert" : ""} aria-label="${esc(r.name)}">
            <div class="jr-copy"><span class="eyebrow">${String(i + 1).padStart(2, "0")} / ${String(n).padStart(2, "0")} · <span>${esc(r.name)}</span></span><h3>${esc(r.lead)}</h3><p class="jr-tip">${esc(r.tips[0])}</p>
              <div class="jr-row"><button class="btn" type="button" data-shop-room="${id}">Handla rummet · ${kr(t)}</button><a class="link" href="#rum-${id}">${c} saker · mer för rummet</a></div><p class="hs-cap jr-cap">Bilderna är illustrationer. Prickarna visar liknande produkter i butiken.</p></div>
            <div class="jr-img">${RQ.hotspots.render(id, { eager: i === 0 })}</div></article>`; }).join("")}
          <nav class="jr-dots" aria-label="Rum">${ids.map((id, i) => `<button type="button" data-jr="${i}" aria-current="${i === 0}"><span>${esc(RQ.roomById(id).name)}</span></button>`).join("")}</nav>
        </div>
      </section><div class="wrap jr-cap-after">${RQ.hotspots.caption()}</div>`;
    },
    mount(root) {
      const sec = $(".journey", root); if (!sec) return () => {};
      const rooms = $$(".jr-room", sec), dots = $$("[data-jr]", sec), stick = $(".jr-stick", sec), n = rooms.length;
      const offHs = RQ.hotspots.mount(sec);
      if (reduced()) { sec.classList.add("flat"); rooms.forEach((r) => { r.classList.add("on"); r.removeAttribute("inert"); }); return offHs; }
      let cur = 0;
      const head = $(".jr-head", sec);
      // the sticky stage's own offsetTop moves while it is stuck, so measure from the section
      // measured once and again on resize, never while scrolling (reading layout in a scroll handler forces a reflow)
      let T0 = 0, PER = 1;
      const measure = () => { T0 = sec.getBoundingClientRect().top + scrollY + head.offsetHeight; PER = Math.max(1, (sec.offsetHeight - head.offsetHeight - stick.offsetHeight) / n); };
      const top0 = () => T0, per = () => PER;
      const set = (i) => {
        if (i === cur) return; cur = i;
        rooms.forEach((r, k) => { const on = k === i; r.classList.toggle("on", on); r.toggleAttribute("inert", !on); if (on) RQ.hotspots.layout($(".hs-stage", r)); });
        dots.forEach((d, k) => d.setAttribute("aria-current", k === i));
      };
      let jrRaf = 0;
      const update = () => { jrRaf = 0; const y = scrollY - T0; set(Math.max(0, Math.min(n - 1, Math.floor((y + PER * 0.35) / PER)))); };
      const onScroll = () => { if (!jrRaf) jrRaf = requestAnimationFrame(update); };
      const onResize = () => { measure(); onScroll(); };
      const go = (e) => { const d = e.target.closest("[data-jr]"); if (!d) return; scrollTo({ top: top0() + +d.dataset.jr * per() + 2, behavior: "smooth" }); };
      sec.addEventListener("click", go);
      addEventListener("scroll", onScroll, { passive: true }); addEventListener("resize", onResize, { passive: true });
      measure(); update();
      // content above can grow when pictures load: measure again whenever the page changes height
      const ro = "ResizeObserver" in window ? new ResizeObserver(onResize) : null; if (ro) ro.observe(document.getElementById("view") || document.body);
      return () => { offHs(); if (ro) ro.disconnect(); removeEventListener("scroll", onScroll); removeEventListener("resize", onResize); sec.removeEventListener("click", go); };
    },
  };

  /* ------------------------------------------------------------------ taste profile */
  RQ.taste = {
    get() { const t = ls.get("rumiq-taste", null) || { styles: {}, cats: {}, tone: null, likes: 0, n: 0 }; t.seen = t.seen || {}; return t; },
    has() { return this.get().likes > 0; },
    add(h, w) {
      const p = RQ.byHandle(h); if (!p) return; const t = this.get();
      p.styles.forEach((s) => (t.styles[s] = (t.styles[s] || 0) + w));
      t.cats[p.cat] = (t.cats[p.cat] || 0) + w;
      if (w > 0) { const c = hex2rgb(p.tone[0]); t.tone = t.tone ? t.tone.map((v, i) => (v * t.likes + c[i]) / (t.likes + 1)) : c; t.likes++; }
      t.seen[h] = w; t.n++; ls.set("rumiq-taste", t);
      const top = this.top(t)[0];
      if (top) { const old = S.style && S.style(); S.saveStyle({ ...(old || {}), style: top, source: "svep" }); }
      return t;
    },
    // Snabbval (the four quick questions) feeds the same profile, so there is only one style
    boost(style, w) { const t = this.get(); t.styles[style] = (t.styles[style] || 0) + w; t.n++; ls.set("rumiq-taste", t); return t; },
    top(t = this.get()) { return Object.entries(t.styles).filter((e) => e[1] > 0).sort((a, b) => b[1] - a[1]).map((e) => e[0]); },
    score(p, t = this.get()) {
      let s = p.styles.reduce((a, k) => a + (t.styles[k] || 0), 0) + (t.cats[p.cat] || 0) * 0.8;
      if (t.tone) s += (1 - toneDist(p, t.tone) / 441) * 2;
      return s;
    },
    sort(list) { const t = this.get(); return [...list].sort((a, b) => this.score(b, t) - this.score(a, t)); },
    reset() { ls.set("rumiq-taste", { styles: {}, cats: {}, tone: null, likes: 0, n: 0, seen: {} }); },
  };

  V.forDig = () => RQ.shopView({ title: "För dig", lead: RQ.taste.has() ? "Hela butiken, sorterad efter det du sparat i Svep." : "Svep några produkter först, så sorteras butiken efter dig.", sort: RQ.taste.has() ? "dig" : "rel", trail: [["Hem", "hem"], ["Butik", "butik"], ["För dig"]], extraTop: RQ.taste.has() ? "" : `<div class="wrap" style="margin-bottom:2rem"><a class="btn" href="#svep">Börja svepa</a></div>` });

  /* ------------------------------------------------------------------ Looks */
  const lookById = (id) => RQ.LOOKS.find((l) => l.id === id);
  const lookTotal = (l) => l.items.reduce((s, h) => s + RQ.byHandle(h).price, 0);
  // price with the whole-look discount, and the saving shown next to it
  const lookRate = () => +((window.RQ_CONFIG || {}).lookDiscount || 0);
  const lookNet = (l) => { const t = lookTotal(l), r = lookRate(); return Math.round(t - Math.round(t * r)); };
  RQ.lookNet = lookNet;
  const inCart = (h) => S.cartLines().some((l) => l.product.handle === h);
  // what is already in the cart is not added again: a look is one of each
  const addMissing = (handles, btn, label) => {
    const miss = handles.filter((h) => !inCart(h));
    if (!miss.length) { RQ.toast(`${esc(label)} <span>ligger redan i varukorgen.</span> <a href="#" data-open-cart>Visa</a>`); return []; }
    return addMany(miss, btn, label) ? miss : [];
  };
  // a ready-made look whose things these are (a saved look keeps its discount and its name)
  const lookOf = (handles) => RQ.LOOKS.find((l) => l.items.length === handles.length && l.items.every((h) => handles.includes(h)));
  const lookImg = (l, eager) => `<img src="assets/img/rum/${l.room}-900.webp" srcset="assets/img/rum/${l.room}-900.webp 900w, assets/img/rum/${l.room}-1600.webp 1600w" sizes="(min-width:900px) 22rem, 90vw" alt="" ${eager ? "" : 'loading="lazy"'} decoding="async" width="1600" height="893">`;
  RQ.lookCard = (l) => {
    const room = RQ.roomById(l.room), cut = lookNet(l) < lookTotal(l);
    return `<article class="lc"><a class="lc-im" href="#look-${l.id}">${lookImg(l)}<span class="lc-tag">${esc(room.name)}</span></a>
      <div class="lc-line">${l.items.map((h) => { const p = RQ.byHandle(h); return `<button type="button" data-sheet="${h}" aria-label="${esc(p.name)}"><img src="${RQ.cut(p)}" alt="" loading="lazy"></button>`; }).join("")}</div>
      <div class="lc-tx"><h3><a href="#look-${l.id}">${esc(l.name)}</a></h3><p>${esc(l.lead)}</p>
        <div class="lc-row"><span class="price">${l.items.length} saker${cut ? ` · <s>${kr(lookTotal(l))}</s>` : ""}</span><button class="btn sm" type="button" data-look-add="${l.id}">Handla looken · ${kr(lookNet(l))}</button></div></div></article>`;
  };
  // the looks you have saved yourself (from Mitt rum or a ready-made one): the same block in Mitt hem and on Looks
  RQ.savedLooksHtml = () => S.looks().map((l) => {
    const ps = (l.handles || []).map(RQ.byHandle).filter(Boolean), ready = lookOf(ps.map((p) => p.handle));
    const sum = ps.reduce((s, p) => s + p.price, 0), net = ready ? lookNet(ready) : sum;
    return `<div class="order mylook"><header><b>${esc(l.name)}</b><span class="price" style="font-family:var(--mono)">${net < sum ? `<s>${kr(sum)}</s> ` : ""}${kr(net)}</span></header>
      <div class="mylook-line">${ps.map((p) => `<button type="button" data-sheet="${p.handle}" aria-label="Snabbtitt på ${esc(p.name)}"><img src="${RQ.cut(p)}" alt="" loading="lazy"></button>`).join("")}</div>
      <div class="ctrl-row"><button class="btn sm" type="button" data-look-buy="${ps.map((p) => p.handle).join(",")}" data-look-name="${esc(l.name)}">Lägg i varukorgen</button><button class="btn ghost sm" type="button" data-room-all="${ps.map((p) => p.handle).join(",")}">Se i mitt rum</button><button class="chip" type="button" data-dellook="${l.id}">Ta bort</button></div></div>`;
  }).join("");
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-look-add]");
    if (b) { const l = lookById(b.dataset.lookAdd); const added = addMissing(l.items, b, l.name); const host = b.closest(".lc, .look-page"); if (host && added.length) $$(".lc-line button, .lp-item", host).forEach((el, k) => { if (added.includes(el.dataset.sheet || el.dataset.h)) setTimeout(() => RQ.fly($("img", el)), k * 110); }); return; }
    const mb = e.target.closest("[data-look-buy]"); if (mb) { addMissing(mb.dataset.lookBuy.split(",").filter(Boolean), mb, mb.dataset.lookName || "Looken"); return; }
    const s = e.target.closest("[data-look-save]");
    if (s) { const l = lookById(s.dataset.lookSave); if (!S.looks().some((x) => x.name === l.name)) S.saveLook(l.items, l.name); s.disabled = true; s.textContent = "Sparad i Mitt hem"; RQ.toast(`Looken sparades. <a href="#mitt-hem">Visa i Mitt hem</a>`); }
  });
  V.looks = () => {
    const mine = S.looks(), pct = Math.round(lookRate() * 100);
    return {
    title: "Looks · RumIQ",
    html: `${RQ.head(RQ.crumbs([["Hem", "hem"], ["Upptäck", "upptack"], ["Looks"]]), "Färdiga looks", `Tre eller fyra saker som hör ihop. Lägg hela looken i varukorgen med ett tryck, eller välj det du vill ha.${pct ? ` <b class="look-off"><span>Hela looken ger</span> ${pct} % <span>rabatt.</span></b>` : ""}`)}
      <section class="wrap" style="padding-bottom:6rem"><div class="looks-grid stagger" data-watch>${RQ.LOOKS.map(RQ.lookCard).join("")}
        <a class="own-look" href="#mitt-rum"><span class="ol-plus" aria-hidden="true">+</span><span><b>Bygg din egen look i ditt rum</b><small>Ställ in det du gillar, se totalpriset och hur väl sakerna går ihop.</small></span></a></div>
        ${mine.length ? `<div class="sec-head" style="margin:4rem 0 1.4rem"><h2 class="h2">Dina sparade looks</h2></div><div class="mylooks">${RQ.savedLooksHtml()}</div>` : ""}
        <div class="sec-head" style="margin:4rem 0 1.4rem"><h2 class="h2">Samlat kring en idé</h2><p>Större urval för den som vill bläddra vidare.</p></div>${RQ.colCards()}</section>`,
    mount(root) {
      const del = (e) => { const d = e.target.closest("[data-dellook]"); if (d && root.contains(d)) { S.deleteLook(d.dataset.dellook); RQ.router(); } };
      root.addEventListener("click", del); return () => root.removeEventListener("click", del);
    },
  }; };
  V.look = (id) => {
    const l = lookById(id); if (!l) return null; const room = RQ.roomById(l.room);
    const inPic = RQ.hotspots.handles(l.room).filter((h) => l.items.includes(h)).length;
    const CAP_DOTS = "Bilden är en illustration. Prickarna visar saker ur looken.", CAP_NONE = "Bilden är en illustration av rummet. Sakerna i looken ser du i listan.";
    const total = lookTotal(l), net = lookNet(l), off = total - net;
    // the buy block follows the cart: nothing in it, some of the look in it, all of it in it
    const buy = () => {
      const miss = l.items.filter((h) => !inCart(h)), have = l.items.length - miss.length, saved = S.looks().some((x) => x.name === l.name);
      const save = `<button class="btn ghost" type="button" data-look-save="${l.id}"${saved ? " disabled" : ""}>${saved ? "Sparad i Mitt hem" : "Spara looken"}</button>`;
      if (!miss.length) return `<p class="lp-in" role="status"><span>Hela looken ligger i varukorgen.</span>${off ? ` <span>Rabatten är avdragen:</span> ${kr(off)}.` : ""}</p><div class="ctrl-row"><button class="btn" type="button" data-open-cart>Visa varukorgen</button>${save}</div>`;
      if (have) { const rest = miss.reduce((s, h) => s + RQ.byHandle(h).price, 0) - off;
        return `<p class="lp-in" role="status">${have} <span>av</span> ${l.items.length} <span>finns i varukorgen.</span>${off ? ` <span>Lägg till resten så sparar du</span> ${kr(off)}.` : ""}</p><div class="ctrl-row"><button class="btn" type="button" data-look-add="${l.id}"><span>Lägg till resten</span> · ${kr(Math.max(0, rest))}</button>${save}</div>`; }
      return `<div class="ctrl-row"><button class="btn" type="button" data-look-add="${l.id}">Handla looken · ${kr(net)}</button>${save}</div>`;
    };
    return {
      title: `${l.name} · RumIQ`,
      html: `<section class="wrap look-page">
        ${RQ.crumbs([["Hem", "hem"], ["Looks", "looks"], [l.name]])}
        <div class="lp-grid">
          <div>${RQ.hotspots.render(l.room, { eager: true, cls: "lp-stage", only: l.items })}<p class="hs-cap" id="lpCap">${inPic ? CAP_DOTS : CAP_NONE}</p></div>
          <div class="lp-tx"><span class="eyebrow">Look · <span>${esc(room.name)}</span></span><h1 class="h1">${esc(l.name)}</h1><p class="lead">${esc(l.lead)}</p>
            <ul class="lp-list">${l.items.map((h) => { const p = RQ.byHandle(h); return `<li class="lp-item" data-h="${h}"><button type="button" data-sheet="${h}" aria-label="Snabbtitt på ${esc(p.name)}"><img src="${RQ.cut(p)}" alt=""></button><div><b>${esc(p.name)}</b><span>${kr(p.price)}</span></div><button class="iconbtn qadd" type="button" data-add="${h}::0" aria-label="Lägg ${esc(p.name)} i varukorgen">${RQ.plus}</button></li>`; }).join("")}</ul>
            <div class="lp-sum"><span>Hela looken${off ? ` <small><span>Du sparar</span> ${kr(off)}</small>` : ""}</span><b>${off ? `<s>${kr(total)}</s> ` : ""}${kr(net)}</b></div>
            <div class="lp-buy" id="lpBuy">${buy()}</div>
            <p class="small" style="margin-top:1rem">Produkterna är exempel tills butiken öppnar.</p></div>
        </div></section>
        <section class="sec"><div class="wrap"><div class="sec-head"><h2 class="h2">Fler looks</h2></div><div class="looks-row">${RQ.LOOKS.filter((x) => x.id !== id).map(RQ.lookCard).join("")}</div></div></section>`,
      mount: (root) => {
        const offHs = RQ.hotspots.mount(root);
        // the caption only speaks of dots when one is actually in the cropped picture
        const cap = () => { const c = $("#lpCap", root); if (c) c.textContent = $$(".lp-stage .hs", root).some((h) => !h.hidden) ? CAP_DOTS : CAP_NONE; };
        cap(); setTimeout(cap, 400); addEventListener("resize", cap);
        const offCart = S.onChange((w) => { const el = $("#lpBuy", root); if (el && (w === "cart" || w === "all" || w === "looks")) { const had = el.contains(document.activeElement); el.innerHTML = buy(); if (had) { const b = $(".btn", el); b && b.focus({ preventScroll: true }); } } });
        return () => { offHs && offHs(); offCart && offCart(); removeEventListener("resize", cap); };
      },
    };
  };

  /* ------------------------------------------------------------------ Rösta */
  const MAXV = 3;
  /* Önska: vote for the next product and share your own ideas, on one page (was Rösta and Dela en idé) */
  V.onska = () => ({
    title: "Önska · RumIQ",
    html: `${RQ.head(RQ.crumbs([["Hem", "hem"], ["Upptäck", "upptack"], ["Önska"]]), "Önska", "Vi har inget eget lager, så vi kan lyssna först. Rösta fram nästa produkt eller föreslå något helt eget.")}
      <section class="wrap onska" style="padding-bottom:3rem"><h2 class="h3" id="rosta">Rösta fram nästa produkt</h2><p class="small" style="margin:.4rem 0 1.2rem">Välj upp till tre saker du vill att vi tar in.</p>
        <p class="vote-left" id="voteLeft" aria-live="polite"></p>
        <div class="vote-grid">${RQ.CANDIDATES.map((c) => `<button type="button" class="vote" data-vote="${c.id}" aria-pressed="false">${c.img ? `<img class="vote-img" src="${c.img}" alt="" loading="lazy" width="400" height="400">` : `<span class="sw" style="background:${c.tone}"></span>`}<b>${esc(c.name)}</b><span>${esc(c.line)}</span><i aria-hidden="true">${ICO.heart}</i></button>`).join("")}</div>
        <p class="small" style="margin-top:1.4rem">Vi räknar rösterna när butiken öppnar. Din röst sparas i den här webbläsaren.</p>
        <form class="vote-mail" id="voteMail" novalidate><label for="voteEmail">Vill du veta vad som vann?</label><div class="field"><input id="voteEmail" type="email" autocomplete="email" placeholder="Din e-post"><button class="btn sm" type="submit">Mejla mig</button></div><p class="nt-err" role="alert"></p><p class="nt-ok" role="status">Tack. Ett mejl när resultatet är klart. Inget annat.</p></form>
      </section>
      <section class="wrap onska" id="ideer" style="padding-bottom:6rem">${ideasHtml()}</section>`,
    mount(root) {
      const left = $("#voteLeft", root);
      const paint = () => { const v = ls.get("rumiq-votes", []); $$("[data-vote]", root).forEach((b) => { const on = v.includes(b.dataset.vote); b.setAttribute("aria-pressed", on); b.classList.toggle("on", on); }); const n = MAXV - v.length; left.textContent = n ? `Du har ${n} av ${MAXV} röster kvar.` : "Tack. Du har använt dina tre röster. Tryck igen för att ändra."; };
      $(".vote-grid", root).addEventListener("click", (e) => {
        const b = e.target.closest("[data-vote]"); if (!b) return;
        let v = ls.get("rumiq-votes", []); const id = b.dataset.vote;
        if (v.includes(id)) v = v.filter((x) => x !== id); else if (v.length < MAXV) v = [...v, id]; else { RQ.toast("Du har redan tre röster. Ta bort en först."); return; }
        ls.set("rumiq-votes", v); paint();
      });
      $("#voteMail", root).addEventListener("submit", (e) => {
        e.preventDefault(); const f = e.currentTarget, val = $("input", f).value.trim();
        if (!emailOk(val)) { $(".nt-err", f).textContent = "Skriv en e-postadress, till exempel namn@exempel.se."; return; }
        $(".nt-err", f).textContent = ""; RQ.once(f, () => post({ email: val, lista: "Rösta", roster: ls.get("rumiq-votes", []).join(", ") }).then((res) => afterPost(f, res, "Tack. Ett mejl när resultatet är klart. Inget annat.")));
      });
      paint();
      root.addEventListener("click", (e) => { const b = e.target.closest("[data-idea-vote]"); if (b) { S.voteIdea(b.dataset.ideaVote); $("#ideer", root).innerHTML = ideasHtml(); } });
      root.addEventListener("submit", (e) => {
        const f = e.target.closest("#ideaForm"); if (!f) return; e.preventDefault();
        if (!f.title.value.trim()) { $("#ideaStatus", root).textContent = "Skriv en kort rubrik."; return; }
        S.addIdea(f.title.value.trim(), f.text.value.trim()); RQ.toast("Tack för idén!"); $("#ideer", root).innerHTML = ideasHtml();
      });
    },
  });
  const ideasHtml = () => {
    const ideas = S.ideas().sort((a, b) => b.votes - a.votes);
    return `<h2 class="h3">Föreslå något eget</h2><p class="small" style="margin:.4rem 0 1.2rem">En produkt du saknar eller något vi kan göra bättre. Rösta gärna på andras idéer.</p>
      ${ideas.length ? `<div class="idea-list">${ideas.map((i) => `<div class="order idea"><button class="chip" type="button" data-idea-vote="${i.id}" aria-pressed="${!!i.voted}">▲ ${i.votes}</button><div><b>${esc(i.title)}</b><p class="small">${esc(i.text)}</p></div></div>`).join("")}</div>` : ""}
      <form id="ideaForm" class="form-grid" novalidate style="margin-top:1.4rem;max-width:44rem"><label class="full">Rubrik<input name="title" maxlength="80" required placeholder="Till exempel: Fler mörka textilier"></label><label class="full">Beskriv gärna lite mer<textarea name="text" rows="3" maxlength="600"></textarea></label><button class="btn" type="submit">Skicka idén</button><p class="status full" id="ideaStatus"></p></form>
      <p class="note">I förhandsversionen sparas idéerna bara i din webbläsare och syns inte för andra.</p>`;
  };
  V.rosta = V.onska;

  /* ------------------------------------------------------------------ Dra solen (moved from home) */
  RQ.sunSection = () => `<section class="sec kalk" id="solen"><div class="wrap sun">
      <div><h2 class="h2">Dra solen.</h2><p style="margin-top:1.1rem;color:var(--muted);font-size:1.08rem;max-width:26rem">Samma rum ser olika ut från morgon till kväll. Därför ska du se saken i ditt eget ljus, inte bara i vårt.</p>
        <div class="sun-time" id="sunTime" aria-live="polite">07:00<small>Morgonljus</small></div>
        <input type="range" id="sunRange" min="0" max="100" value="12" aria-label="Tid på dagen" style="margin-top:1.4rem"></div>
      <figure class="sun-fig"><img src="assets/img/rum-1600.webp" srcset="assets/img/rum-900.webp 900w, assets/img/rum-1600.webp 1600w" sizes="(max-width:900px) 100vw, 60vw" alt="Vardagsrummet i olika ljus beroende på tid på dagen." loading="lazy"><div class="light" id="sunLight"></div><div class="tint" id="sunTint"></div><div class="shade" id="sunShade"></div></figure>
    </div></section>`;
  RQ.mountSun = (root) => {
    const range = $("#sunRange", root); if (!range) return;
    const sunTime = $("#sunTime", root), light = $("#sunLight", root), shade = $("#sunShade", root), tint = $("#sunTint", root);
    const lerp = (a, b, t) => a + (b - a) * t;
    const sun = () => { const v = range.value / 100, hour = 6 + v * 15;
      sunTime.firstChild.nodeValue = `${String(Math.floor(hour)).padStart(2, "0")}:${String(Math.floor(((hour % 1) * 60) / 15) * 15).padStart(2, "0")}`;
      sunTime.querySelector("small").textContent = hour < 10 ? "Morgonljus" : hour < 15 ? "Dagsljus" : hour < 18.5 ? "Eftermiddag" : "Kvällsljus";
      const x = lerp(85, 10, v), y = lerp(35, 55, Math.abs(v - 0.45) * 2), warm = v < 0.5 ? lerp(0.55, 0.25, v * 2) : lerp(0.25, 0.85, (v - 0.5) * 2);
      light.style.background = `radial-gradient(45% 60% at ${x}% ${y}%, rgba(255,214,150,${warm}), rgba(255,214,150,0) 70%)`;
      shade.style.opacity = v > 0.7 ? ((v - 0.7) / 0.3) * 0.5 : v < 0.08 ? (0.08 - v) * 2.5 : 0;
      tint.style.background = "rgb(210,140,70)"; tint.style.opacity = v > 0.6 ? ((v - 0.6) / 0.4) * 0.22 : 0; };
    range.addEventListener("input", sun); sun();
  };

  /* ------------------------------------------------------------------ teasers used on home and Upptäck */
  /* before/after: the range input is the control (keyboard and screen readers); the line follows it, and a
     gentle sweep on first view shows that it moves */
  /* 3D and AR on the product page. model-viewer (Google, open source) is loaded only when someone asks
     for it; on phones its AR button opens Quick Look (iPhone) or Scene Viewer (Android) without an app. */
  const CUBE = '<svg viewBox="0 0 24 24"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/></svg>';
  let mvLoad = null;
  RQ.p3d = {
    has: (h) => !!(RQ.MODELS || {})[h],
    card(p) {
      if (!this.has(p.handle)) return "";
      return `<button type="button" class="roomcta p3d-btn" data-3d="${p.handle}"><span class="rc-img">${CUBE}</span><span><b>Visa i 3D</b><small>Snurra och zooma. På mobilen kan du ställa den i rummet med kameran.</small></span>${RQ.plus}</button>`;
    },
    load() { return mvLoad || (mvLoad = import(new URL("assets/vendor/model-viewer.min.js", document.baseURI).href)); },
    open(h, from) {
      const p = RQ.byHandle(h), m = (RQ.MODELS || {})[h]; if (!p || !m) return;
      const d = document.createElement("dialog"); d.className = "m3d"; d.setAttribute("aria-label", `${p.name} i 3D`);
      d.innerHTML = `<div class="m3d-in"><header><b>${esc(p.name)}</b><button class="iconbtn" type="button" data-m3d-close aria-label="Stäng 3D-visningen"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></header>
        <div class="m3d-stage"><p class="m3d-wait">Laddar 3D-modellen…</p></div>
        <div class="m3d-foot"><p class="small">Ungefärlig 3D-modell. Form och färg följer produktbilderna, exakta mått bekräftas innan vi öppnar.</p><p class="small m3d-desk">Öppna sidan i mobilen för att ställa den i ditt rum med kameran.</p></div></div>`;
      document.body.appendChild(d); d.showModal();
      const close = () => { d.close(); };
      d.addEventListener("close", () => { d.remove(); if (from && from.focus) from.focus({ preventScroll: true }); });
      d.addEventListener("click", (e) => { if (e.target === d || e.target.closest("[data-m3d-close]")) close(); });
      const glb = new URL("assets/3d/" + h + ".glb", document.baseURI).href, json = new URL("assets/3d/" + h + ".json", document.baseURI).href;
      // .glb where the host serves it (the live site); the same model as glTF JSON elsewhere
      const src = fetch(glb, { method: "HEAD" }).then((r) => (r.ok ? glb : json), () => json);
      Promise.all([this.load(), src]).then(([, url]) => {
        const stage = $(".m3d-stage", d); if (!stage) return;
        stage.innerHTML = `<model-viewer src="${url}" alt="3D-modell av ${esc(p.name)}" camera-controls touch-action="pan-y" ${reduced() ? "" : "auto-rotate"} auto-rotate-delay="800" rotation-per-second="18deg" shadow-intensity="1" shadow-softness=".9" exposure="1.05" environment-image="neutral" interaction-prompt="none" camera-orbit="${m.wall ? "0deg 85deg 135%" : "30deg 72deg 135%"}" min-camera-orbit="auto auto 80%" max-camera-orbit="auto auto 220%" ar ar-modes="webxr scene-viewer quick-look" ar-placement="${m.wall ? "wall" : "floor"}"><button slot="ar-button" class="btn m3d-ar">${RQ.roomIco}Ställ i ditt rum</button></model-viewer>`;
        const mv = $("model-viewer", stage);
        mv.addEventListener("ar-status", () => {}, { once: true });
        setTimeout(() => { if (mv.canActivateAR) d.classList.add("can-ar"); }, 600);
      }).catch(() => { const w = $(".m3d-wait", d); if (w) w.textContent = "3D-visningen gick inte att ladda. Försök igen om en stund."; });
    },
  };
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-3d]"); if (b) RQ.p3d.open(b.dataset["3d"], b); });
  document.addEventListener("pointerover", (e) => { if (e.target.closest && e.target.closest("[data-3d]")) RQ.p3d.load(); }, { passive: true });

  RQ.mountBav = (root) => {
    const figs = $$(".bav", root), offs = [];
    figs.forEach((fig) => {
      const r = $(".ba-range", fig); if (!r) return;
      const set = (v) => fig.style.setProperty("--ba", v + "%");
      const onIn = () => { fig.classList.add("touched"); set(r.value); };
      r.addEventListener("input", onIn); offs.push(() => r.removeEventListener("input", onIn));
      if (!reduced() && "IntersectionObserver" in window) {
        const io = new IntersectionObserver(([e]) => { if (!e.isIntersecting) return; io.disconnect(); if (fig.classList.contains("touched")) return;
          let t0 = 0; const run = (t) => { if (fig.classList.contains("touched")) return; if (!t0) t0 = t; const k = Math.min(1, (t - t0) / 1600); const v = Math.round(58 - 38 * Math.sin(k * Math.PI)); r.value = v; set(v); if (k < 1) requestAnimationFrame(run); };
          setTimeout(() => requestAnimationFrame(run), 400); }, { threshold: 0.6 });
        io.observe(fig); offs.push(() => io.disconnect());
      }
    });
    return () => offs.forEach((f) => f());
  };
  RQ.voteTeaser = () => `<a class="vtz" href="#onska"><div class="vtz-sw" aria-hidden="true">${RQ.CANDIDATES.slice(0, 5).map((c) => c.img ? `<img src="${c.img}" alt="" loading="lazy">` : `<span style="background:${c.tone}"></span>`).join("")}</div><div><span class="eyebrow">Rösta</span><h3>Vad ska vi ta in härnäst?</h3><p>Vi har inget eget lager, så vi kan lyssna först. Välj upp till tre saker.</p></div><span class="link">Rösta nu</span></a>`;
  RQ.toolStrip = () => `<nav class="tools-strip" aria-label="Verktyg"><span>Verktyg</span>
      <a class="chip" href="#mitt-rum">Mitt rum</a><a class="chip" href="#svep">Svep fram din stil</a><a class="chip" href="#hitta-ratt">Hitta rätt</a><a class="chip" href="#looks">Färdiga looks</a></nav>`;

  /* ------------------------------------------------------------------ Upptäck */
  V.upptack = () => ({
    title: "Upptäck · RumIQ",
    html: `${RQ.head(RQ.crumbs([["Hem", "hem"], ["Upptäck"]]), "Upptäck", "Gå in i rummen, svep fram din stil eller ta en färdig look. Allt går att handla där du står.")}
      <section class="wrap up-top">${RQ.svepTeaser()}</section>
      ${RQ.journey.html()}
      <section class="sec"><div class="wrap"><div class="sec-row"><div class="sec-head"><h2 class="h2">Färdiga looks</h2><p>Saker som hör ihop, med ett tryck.</p></div><a class="link" href="#looks">Alla looks</a></div><div class="looks-row">${RQ.LOOKS.map(RQ.lookCard).join("")}</div></div></section>
      <section class="wrap" style="margin-bottom:4rem">${RQ.voteTeaser()}</section>
      <section class="sec"><div class="wrap"><div class="sec-row"><div class="sec-head"><h2 class="h2">Magasin</h2><p>Korta texter om ljus, material, färg och vardag.</p></div><a class="link" href="#magasin">Alla artiklar</a></div><div class="mag-grid">${RQ.ARTICLES.slice(0, 3).map(RQ.magCard).join("")}</div></div></section>`,
    mount: (root) => RQ.journey.mount(root),
  });

  /* ------------------------------------------------------------------ colour and mood search */
  const MOOD = {
    lugn: { styles: ["minimalistisk", "skandinavisk"], label: "lugnt" }, lugnt: "lugn", calm: "lugn",
    varm: { styles: ["mjuk", "klassisk"], warm: true, label: "varmt" }, varmt: "varm", warm: "varm", mysig: "varm", mysigt: "varm", ombonat: "varm", cosy: "varm", cozy: "varm",
    mjuk: { styles: ["mjuk"], cats: ["sovrum-komfort", "hem-inredning"], label: "mjukt" }, mjukt: "mjuk", soft: "mjuk",
    ljus: { light: true, cats: ["belysning-atmosfar"], label: "ljust" }, ljust: "ljus", bright: "ljus",
    naturlig: { mats: ["ek", "lin", "ull", "terrakotta", "korg", "keramik"], label: "naturligt" }, naturligt: "naturlig", natural: "naturlig",
    ordning: { needs: ["forvaring"], label: "ordning" }, städat: "ordning", tidy: "ordning",
  };
  const ROOMW = { hall: "hall", hallen: "hall", hallway: "hall", kök: "kok", köket: "kok", kitchen: "kok", sovrum: "sovrum", sovrummet: "sovrum", bedroom: "sovrum", badrum: "badrum", badrummet: "badrum", bathroom: "badrum", vardagsrum: "vardagsrum", vardagsrummet: "vardagsrum", soffan: "vardagsrum", "living": "vardagsrum", kontor: "hemmakontor", hemmakontor: "hemmakontor", office: "hemmakontor", skrivbordet: "hemmakontor", balkong: "uteliv", balkongen: "uteliv", ute: "uteliv", balcony: "uteliv" };
  const lum = (rgb) => 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  RQ.searchState = { tone: null, toneName: "" };
  RQ.flowSearch = (q) => {
    const st = RQ.searchState, words = S.norm(q || "").split(/[^a-zåäö]+/).filter(Boolean);
    const moods = [], rooms = [];
    words.forEach((w) => { let m = MOOD[w]; if (typeof m === "string") m = MOOD[m]; if (m && !moods.includes(m)) moods.push(m); if (ROOMW[w] && !rooms.includes(ROOMW[w])) rooms.push(ROOMW[w]); });
    const plain = q ? S.list({ query: q }) : [];
    if (!st.tone && (plain.length || (!moods.length && !rooms.length))) return null;
    let list = plain.length ? plain : RQ.PRODUCTS.slice();
    if (!plain.length && (moods.length || rooms.length)) {
      const score = (p) => { let s = 0;
        rooms.forEach((r) => { if (p.rooms.includes(r)) s += 3; });
        moods.forEach((m) => { (m.styles || []).forEach((x) => p.styles.includes(x) && (s += 1.2)); (m.cats || []).forEach((c) => p.cat === c && (s += 1.5)); (m.needs || []).forEach((n) => p.needs.includes(n) && (s += 1.5)); (m.mats || []).forEach((c) => p.care.includes(c) && (s += 1)); if (m.warm) { const c = hex2rgb(p.tone[0]); s += (c[0] - c[2]) / 90; } if (m.light) s += lum(hex2rgb(p.tone[0])) / 200; });
        return s; };
      list = list.map((p) => [p, score(p)]).filter((x) => x[1] > 0.9).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
    }
    if (st.tone) list = list.map((p) => [p, toneDist(p, st.tone)]).sort((a, b) => a[1] - b[1]).filter((x, k) => x[1] < 95 || k < 4).map((x) => x[0]);
    const terms = [...rooms.map((r) => RQ.roomById(r).name.toLowerCase()), ...moods.map((m) => m.label)];
    if (st.tone) terms.push(st.toneName.toLowerCase());
    return { list, note: terms.length ? `<span>Tolkat som:</span> ${terms.map((t) => `<span>${esc(t)}</span>`).join(" · ")}. <span>Färg och känsla tolkas med enkla regler.</span>` : "" };
  };
  RQ.toneChips = () => {
    const st = RQ.searchState, R = RQ.room, pal = R && R.has() && R.get().pal ? R.get().pal.slice(0, 5) : [];
    const chip = (hex, name, extra = "") => { const rgb = typeof hex === "string" ? hex2rgb(hex) : hex, on = st.tone && dist(st.tone, rgb) < 1; return `<button type="button" class="chip tone${on ? " on" : ""}" data-tone="${rgb.join(",")}" data-tone-name="${esc(name)}" aria-pressed="${!!on}"${extra}><i style="background:rgb(${rgb.join(",")})"></i>${esc(name)}</button>`; };
    const toRgb = (c) => hex2rgb(c.hex || c);
    return `<div class="tone-row"><p class="eyebrow">Sök på färg</p><div class="chips">${RQ.TONES.map((t) => chip(t.hex, t.name)).join("")}</div>
      ${pal.length ? `<p class="eyebrow" style="margin-top:1rem">Färger från mitt rum</p><div class="chips">${pal.map((c, k) => chip(toRgb(c), `Rumsfärg ${k + 1}`, ' data-room-tone')).join("")}</div>` : ""}</div>`;
  };
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-tone]");
    if (t) { const rgb = t.dataset.tone.split(",").map(Number), st = RQ.searchState; if (st.tone && dist(st.tone, rgb) < 1) { st.tone = null; st.toneName = ""; } else { st.tone = rgb; st.toneName = t.dataset.toneName; } RQ.doSearch && RQ.doSearch(); return; }
    const r = e.target.closest("[data-tone-room]");
    if (r) { const R = RQ.room; if (R && R.has() && R.get().pal && R.get().pal.length) { const c = R.get().pal[0]; RQ.searchState.tone = hex2rgb(c.hex || c); RQ.searchState.toneName = "Rumsfärg 1"; } setTimeout(() => RQ.doSearch && RQ.doSearch(), 80); }
  }, true);

  /* ------------------------------------------------------------------ header compaction */
  const nav = $("#nav");
  const compact = () => nav && nav.classList.toggle("compact", scrollY > 40);
  addEventListener("scroll", compact, { passive: true }); compact();
})();
