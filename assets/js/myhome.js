/* RumIQ: your home, remembered.
   - Mina rum och mått (in Mitt hem): the rooms you have and their measurements, saved in this browser
     (and in the account when signed in). Every product page then says whether the product suits and
     fits each of your rooms ("I ditt hem").
   - Prisbevakning: an e-mail when something you saved becomes cheaper or can be bought. The sign-up
     goes to the same waiting-list table as the other lists (list "Prisbevakning"). */
(function () {
  const RQ = window.RQ, S = RQ.shop, $ = RQ.$, $$ = RQ.$$, esc = RQ.esc;
  const ls = S.store; // the shop's one typed reader (commerce.js)
  const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  const PREVIEW_NOTE = "Förhandsversion: adressen sparas inte än. När butiken öppnar fungerar det här på riktigt.";

  /* Sizes stated in the product texts (cm). Only these are used for "ryms"; the rest only get "passar". */
  const SIZES = {
    "dagsljus-linnegardin-2-pack": { kind: "window", w: 140, h: 250, n: 2 },
    "strand-jutematta": { kind: "floor", w: 160, d: 230 },
    "affisch-linje-ekram": { kind: "wall", w: 50, h: 70 },
    "affisch-horisont-ekram": { kind: "wall", w: 50, h: 70 },
  };
  RQ.SIZES = SIZES;

  /* ---------------------------------------------------------------- rooms */
  const num = (v) => { const n = Math.round(+String(v || "").trim().replace(/\s*cm$/i, "").replace(",", ".")); return n > 0 && n < 5000 ? n : null; };
  RQ.homeRooms = {
    list() { return (ls.get("rumiq-home", { rooms: [] }).rooms || []).filter((r) => RQ.roomById(r.type)); },
    save(rooms) { ls.set("rumiq-home", { rooms, at: new Date().toISOString() }); },
    label(r) { return r.label || RQ.roomById(r.type).name; },
    dims(r) {
      const out = [];
      if (r.floorW && r.floorD) out.push(`golv ${r.floorW} × ${r.floorD} cm`);
      if (r.wallW) out.push(`vägg ${r.wallW} cm`);
      if (r.windowW) out.push(`fönster ${r.windowW} cm`);
      return out.join(" · ");
    },
    html() {
      const rooms = this.list();
      return `<div id="mh-matt"><div class="sec-head"><span class="eyebrow">Mina rum och mått</span></div>
        <p class="lead" style="max-width:40rem">Lägg in dina rum och några mått en gång. Sedan säger varje produktsida om den passar och ryms hos dig.</p>
        <div class="hr-list" id="hrList">${rooms.map((r) => `<div class="hr-card"><span class="hr-ic" aria-hidden="true">${RQ.roomIco}</span><div><b>${esc(this.label(r))}</b><small>${this.dims(r) || "Inga mått än"}</small></div>
          <button class="tlink" type="button" data-hr-edit="${r.id}">Ändra</button><button class="tlink" type="button" data-hr-del="${r.id}">Ta bort</button></div>`).join("")}</div>
        <button class="btn ghost" type="button" id="hrOpen" aria-expanded="false" aria-controls="hrForm">${rooms.length ? "Lägg till ett rum" : "Lägg till ditt första rum"}</button>
        <form class="hr-form panel" id="hrForm" novalidate hidden><input type="hidden" name="id">
          <h3 class="h3" style="font-size:1.15rem" id="hrTitle">${rooms.length ? "Lägg till ett rum" : "Lägg till ditt första rum"}</h3>
          <div class="hr-grid">
            <label>Rum<select name="type">${RQ.ROOMS.map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join("")}</select></label>
            <label><span>Eget namn <small class="hr-opt">valfritt</small></span><input name="label" maxlength="30" placeholder="Till exempel Sovrum uppe"></label>
            <label>Golvets bredd, cm<input name="floorW" inputmode="numeric" placeholder="350"></label>
            <label>Golvets djup, cm<input name="floorD" inputmode="numeric" placeholder="420"></label>
            <label>Fri väggbredd, cm<input name="wallW" inputmode="numeric" placeholder="240"></label>
            <label>Fönstrets bredd, cm<input name="windowW" inputmode="numeric" placeholder="120"></label>
          </div>
          <p class="small">Mät det fria golvet där en matta kan ligga, väggen där en tavla kan hänga och fönstret utan karm. Inga mått är obligatoriska.</p>
          <div class="ctrl-row"><button class="btn" type="submit">Spara rummet</button><button class="btn ghost" type="button" id="hrCancel">Avbryt</button></div>
          <p class="status" id="hrStatus" role="status"></p></form></div>`;
    },
    mount(root) {
      const f = $("#hrForm", root); if (!f) return;
      // the form waits behind one button, so an empty Mitt hem is a short page
      const opener = $("#hrOpen", root), show = (on) => { f.hidden = !on; opener.hidden = on; opener.setAttribute("aria-expanded", on); };
      opener.addEventListener("click", () => { show(true); f.type.focus(); });
      const reset = () => { f.reset(); f.id.value = ""; $("#hrTitle", root).textContent = this.list().length ? "Lägg till ett rum" : "Lägg till ditt första rum"; $("#hrStatus", root).textContent = ""; show(false); };
      f.addEventListener("submit", (e) => {
        e.preventDefault();
        // a measure that is written but cannot be read is said out loud, not dropped silently
        const bad = ["floorW", "floorD", "wallW", "windowW"].find((k) => f[k].value.trim() && !num(f[k].value));
        if (bad) { $("#hrStatus", root).textContent = "Skriv måtten i centimeter med siffror, till exempel 350."; $("#hrStatus", root).classList.add("err"); f[bad].setAttribute("aria-invalid", "true"); f[bad].focus(); return; }
        const r = { id: f.id.value || Math.random().toString(36).slice(2, 9), type: f.type.value, label: f.label.value.trim().slice(0, 30), floorW: num(f.floorW.value), floorD: num(f.floorD.value), wallW: num(f.wallW.value), windowW: num(f.windowW.value) };
        const rooms = this.list(), i = rooms.findIndex((x) => x.id === r.id);
        if (i > -1) rooms[i] = r; else rooms.push(r);
        this.save(rooms); RQ.toast(`${esc(this.label(r))} är sparat.`); RQ.router();
      });
      $("#hrCancel", root).addEventListener("click", reset);
      root.addEventListener("click", (e) => {
        const ed = e.target.closest("[data-hr-edit]"), dl = e.target.closest("[data-hr-del]");
        if (dl) { this.save(this.list().filter((x) => x.id !== dl.dataset.hrDel)); RQ.router(); return; }
        if (ed) {
          const r = this.list().find((x) => x.id === ed.dataset.hrEdit); if (!r) return;
          f.id.value = r.id; f.type.value = r.type; f.label.value = r.label || ""; ["floorW", "floorD", "wallW", "windowW"].forEach((k) => (f[k].value = r[k] || ""));
          $("#hrTitle", root).textContent = `Ändra ${this.label(r)}`; show(true); f.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    },
  };

  /* ---------------------------------------------------------------- "I ditt hem" on the product page */
  const fit = (size, r) => {
    if (!size) return null;
    if (size.kind === "floor") {
      if (!r.floorW || !r.floorD) return null;
      const a = Math.min(r.floorW, r.floorD), b = Math.max(r.floorW, r.floorD), s1 = Math.min(size.w, size.d), s2 = Math.max(size.w, size.d);
      if (a < s1 || b < s2) return { ok: false, text: `För stor för golvet du angett (${r.floorW} × ${r.floorD} cm).` };
      const air = Math.floor(Math.min(a - s1, b - s2) / 2);
      return air >= 20 ? { ok: true, text: `Ryms, med ungefär ${air} cm golv runt om.` } : { ok: true, text: "Ryms precis, utan mycket golv runt om." };
    }
    if (size.kind === "window") {
      if (!r.windowW) return null;
      const cloth = size.w * size.n;
      if (cloth >= r.windowW * 1.5) return { ok: true, text: `Räcker till ditt fönster på ${r.windowW} cm, med fint fall.` };
      if (cloth >= r.windowW) return { ok: true, text: `Täcker fönstret på ${r.windowW} cm, men hänger ganska slätt. Ta två paket för fylligare fall.` };
      return { ok: false, text: `Ditt fönster är ${r.windowW} cm. Ta två paket så att det räcker.` };
    }
    if (size.kind === "wall") {
      if (!r.wallW) return null;
      if (r.wallW < size.w + 20) return { ok: false, text: `Väggen på ${r.wallW} cm är lite smal för en tavla på ${size.w} cm.` };
      return r.wallW >= 2 * size.w + 60 ? { ok: true, text: `Ryms fint. Två bredvid varandra tar ungefär ${2 * size.w + 6} cm av väggen på ${r.wallW} cm.` } : { ok: true, text: `Ryms på väggen på ${r.wallW} cm.` };
    }
    return null;
  };
  RQ.homeFit = {
    html(p) {
      const rooms = RQ.homeRooms.list(), size = SIZES[p.handle];
      if (!rooms.length) {
        if (!size) return "";
        const what = size.kind === "floor" ? "golvet" : size.kind === "window" ? "fönstret" : "väggen";
        return `<a class="hf hf-ask" href="#mitt-hem"><span class="hf-ic" aria-hidden="true">${RQ.roomIco}</span><span><b>Ryms den hos dig?</b><small>Mät ${what} och spara måttet i Mitt hem, så räknar vi ut det åt dig.</small></span></a>`;
      }
      const t = RQ.taste && RQ.taste.get(), top = t && RQ.taste.top(t)[0];
      const rel = rooms.filter((r) => p.rooms.includes(r.type) || (size && fit(size, r)));
      if (!rel.length) return "";
      const rows = rel.slice(0, 3).map((r) => {
        const f = fit(size, r), suits = p.rooms.includes(r.type);
        const line = f ? f.text : suits ? "Passar i rummet." : "";
        return `<li class="${f && !f.ok ? "warn" : "ok"}"><i aria-hidden="true">${f && !f.ok ? "!" : "✓"}</i><span><b>${esc(RQ.homeRooms.label(r))}</b> <span>${line}</span></span></li>`;
      }).join("");
      return `<div class="hf" role="group" aria-label="I ditt hem"><p class="hf-h">I ditt hem${top && p.styles.includes(top) ? ` · <span>Matchar din stil</span>` : ""}</p><ul>${rows}</ul>
        ${size && !rel.some((r) => fit(size, r)) ? `<p class="small">Lägg in måtten i <a href="#mitt-hem">Mitt hem</a>, så ser du om den ryms.</p>` : `<p class="small"><a href="#mitt-hem">Ändra dina rum och mått</a></p>`}</div>`;
    },
  };

  /* ---------------------------------------------------------------- Prisbevakning */
  RQ.priceWatch = {
    get() { return ls.get("rumiq-watch", null); },
    html(handles, id = "pw") {
      if (!handles.length) return "";
      const w = this.get();
      if (w) {
        const fresh = handles.filter((h) => !w.handles.includes(h));
        return `<div class="watch on" data-pwatch-box><span class="watch-ic" aria-hidden="true">${bell}</span><div class="watch-tx"><b>Du bevakar ${w.handles.length} ${w.handles.length === 1 ? "sak" : "saker"}</b><span>Vi mejlar när något blir billigare eller går att köpa.</span></div>
          <div class="watch-acts">${fresh.length ? `<button class="btn sm" type="button" data-pwatch-add="${fresh.join(",")}">Bevaka ${fresh.length} till</button>` : ""}<button class="tlink" type="button" data-pwatch-stop>Sluta bevaka</button></div></div>`;
      }
      return `<form class="watch" data-pwatch="${handles.join(",")}" novalidate><span class="watch-ic" aria-hidden="true">${bell}</span>
        <div class="watch-tx"><b>Bevaka priset</b><span>Få ett mejl när något du sparat blir billigare eller går att köpa. Inget annat.</span></div>
        <div class="field"><label class="sr" for="${id}E">Din e-post</label><input id="${id}E" type="email" autocomplete="email" placeholder="Din e-post"><button class="btn sm" type="submit">Bevaka</button></div>
        <p class="nt-err" role="alert"></p><p class="nt-ok" role="status"></p></form>`;
    },
  };
  const bell = '<svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>';
  const send = (email, handles, lista) => (RQ.subscribe ? RQ.subscribe({ email, lista, roster: handles.join(", ") }) : Promise.resolve("preview"));
  document.addEventListener("submit", (e) => {
    const f = e.target.closest("form[data-pwatch]"); if (!f) return;
    e.preventDefault();
    const v = $("input", f).value.trim(), err = $(".nt-err", f), ok = $(".nt-ok", f);
    if (!emailOk(v)) { err.textContent = "Skriv en e-postadress, till exempel namn@exempel.se."; return; }
    err.textContent = ""; const hs = f.dataset.pwatch.split(",").filter(Boolean);
    RQ.once(f, () => send(v, hs, "Prisbevakning").then((res) => {
      if (res === "error") { err.textContent = "Det gick inte att skicka just nu. Försök igen om en stund."; return; }
      // only a watch that really reached us is remembered: otherwise the page would say "Du bevakar…" about nothing
      if (res === "sent") ls.set("rumiq-watch", { email: v, handles: hs, at: new Date().toISOString() });
      ok.textContent = res === "preview" ? PREVIEW_NOTE : `Klart. Du bevakar ${hs.length} ${hs.length === 1 ? "sak" : "saker"}.`; f.classList.add("sent");
      if (res === "sent") RQ.track && RQ.track("price_watch", { items: hs.length });
    }));
  });
  document.addEventListener("click", (e) => {
    const add = e.target.closest("[data-pwatch-add]"), stop = e.target.closest("[data-pwatch-stop]");
    const w = RQ.priceWatch.get(); if (!w || (!add && !stop)) return;
    if (add) {
      if (add.disabled) return; add.disabled = true;
      const hs = [...new Set([...w.handles, ...add.dataset.pwatchAdd.split(",")])];
      send(w.email, hs, "Prisbevakning").then((res) => { add.disabled = false; if (res === "error") { RQ.toast("Det gick inte att skicka just nu. Försök igen om en stund."); return; } ls.set("rumiq-watch", { ...w, handles: hs }); RQ.toast(`Du bevakar ${hs.length} saker.`); RQ.router(); });
    }
    if (stop) {
      if (stop.disabled) return; stop.disabled = true;
      send(w.email, [], "Prisbevakning avslutad").then((res) => {
        if (res === "error") { stop.disabled = false; RQ.toast("Det gick inte att avsluta just nu. Försök igen om en stund."); return; }
        ls.del("rumiq-watch"); RQ.toast("Bevakningen är avslutad."); RQ.router();
      });
    }
  });

  /* ---------------- Delad önskelista: favourites shared as a link. The list lives only in the link
     (product numbers + an optional first name), nothing is stored on a server. #delad-<n.n.n>~<namn> */
  const V = RQ.views, kr = (n) => S.kr(n);
  const gen = (n) => (/[sxz]$/i.test(n) ? n : n + "s");
  const cleanName = (n) => String(n || "").replace(/[^\p{L}\p{N} '\-]/gu, "").trim().slice(0, 24);
  // a product's own number: made from its handle, so a link still means the same things when the catalogue is reordered or grows
  const pid = (h) => { let x = 7; for (const c of h) x = (x * 31 + c.charCodeAt(0)) >>> 0; return (x % 1679616).toString(36).padStart(4, "0"); };
  const byPid = () => Object.fromEntries(RQ.PRODUCTS.map((p) => [pid(p.handle), p]));
  const encList = (hs, name) => {
    const idx = hs.filter((h) => RQ.byHandle(h)).map(pid);
    const n = cleanName(name);
    return idx.join(".") + (n ? "~" + encodeURIComponent(n) : "");
  };
  const decList = (raw) => {
    if (!raw) return null;
    let core = raw, name = "";
    const t = raw.indexOf("~"); if (t >= 0) { core = raw.slice(0, t); try { name = cleanName(decodeURIComponent(raw.slice(t + 1))); } catch (e) { name = ""; } }
    // four characters = the product's own number; one or two = an older link that counted places in the catalogue
    const ids = byPid();
    const hs = [...new Set(core.split(".").map((x) => (/^[0-9a-z]{4}$/.test(x) ? ids[x] : /^[0-9a-z]{1,2}$/.test(x) ? RQ.PRODUCTS[parseInt(x, 36)] : null)).filter(Boolean).map((p) => p.handle))].slice(0, 40);
    return hs.length ? { hs, name } : null;
  };
  RQ.sharedList = { enc: encList, dec: decList };
  RQ.shareWishLink = async (btn) => {
    const hs = S.wishlist().map((p) => p.handle); if (!hs.length) return;
    const nm = ((S.customer && S.customer()) || {}).name || "";
    const url = new URL("delad/", document.baseURI).href + "#delad-" + encList(hs, nm); // from the site root, whatever page we are on
    try { if (navigator.share) { await navigator.share({ title: "Min önskelista på RumIQ", url }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(url); RQ.toast("Länken till din önskelista är kopierad."); } catch (e) { window.prompt("Kopiera länken:", url); }
    RQ.track("wishlist_share", { items: hs.length });
  };
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-share-wish]"); if (b) RQ.shareWishLink(b); });
  V.shared = (payload) => {
    const L = decList(payload), crumbs = RQ.crumbs([["Hem", "hem"], ["Delad önskelista"]]);
    if (!L) return { title: "Delad önskelista · RumIQ", html: `<header class="page-head wrap">${crumbs}<h1 class="h1">Den här listan är tom.</h1><p class="lead">Länken saknar produkter, eller så har den klippts av. Be om en ny länk, eller titta runt i butiken.</p><div class="ctrl-row" style="margin-top:1.4rem"><a class="btn" href="#butik">Till butiken</a></div></header>` };
    const ps = L.hs.map(RQ.byHandle), total = ps.reduce((a, p) => a + p.price, 0);
    return {
      title: (L.name ? `${gen(L.name)} önskelista` : "Delad önskelista") + " · RumIQ",
      html: `<header class="page-head wrap">${crumbs}<span class="eyebrow">Delad önskelista</span><h1 class="h1">${L.name ? `${esc(gen(L.name))} önskelista` : "En önskelista till dig"}</h1>
          <p class="lead">${ps.length} ${ps.length === 1 ? "sak" : "saker"} · ${kr(total)}. Köp något som present, spara det du också gillar eller se allt i ditt eget rum.</p>
          <div class="ctrl-row" style="margin-top:1.4rem"><button class="btn" type="button" id="shAll">Lägg alla i varukorgen · ${kr(total)}</button><button class="btn ghost" type="button" id="shSave">Spara hos mig</button></div></header>
        <section class="wrap" style="padding-bottom:5rem"><div class="grid">${ps.map(RQ.card).join("")}</div>
          <p class="small" style="margin-top:1.6rem">Listan finns bara i länken. Vi sparar inget om den på någon server.</p></section>`,
      mount(root) {
        const a = $("#shAll", root); a.addEventListener("click", () => RQ.addMany(L.hs, a, "Önskelistan"));
        const b = $("#shSave", root); b.addEventListener("click", () => { let n = 0; L.hs.forEach((h) => { if (!S.isWished(h)) { S.toggleWish(h); n++; } }); RQ.toast(n ? `${n} ${n === 1 ? "sak sparad" : "saker sparade"}. <a href="#mitt-hem">Visa</a>` : "Du har redan sparat allt."); });
        RQ.track("wishlist_open", { items: L.hs.length });
      },
    };
  };

  /* ---------------- Presentkort: the page is ready, the card itself comes with Shopify (gift cards are
     built in there). Until then the page collects e-mails on the list "Presentkort". */
  const AMOUNTS = [250, 500, 1000, 1500];
  V.giftCard = () => ({
    title: "Presentkort · RumIQ",
    html: `<header class="page-head wrap">${RQ.crumbs([["Hem", "hem"], ["Presentkort"]])}</header>
      <section class="wrap gc" style="padding-bottom:5rem">
        <div class="gc-card" aria-hidden="true"><img src="assets/brand/rumiq-vit.webp" alt="" width="480" height="120"><span class="gc-amt" id="gcAmt">${kr(500)}</span><span class="gc-sub">Presentkort · gäller i två år</span></div>
        <div class="gc-info"><span class="eyebrow">Present</span><h1 class="h1">Ge bort ett lugnare hem.</h1>
          <p class="lead">Mottagaren väljer själv och kan se allt i sitt eget rum först.</p>
          <div class="gc-amts" role="radiogroup" aria-label="Belopp">${AMOUNTS.map((a, i) => `<button type="button" class="chip" role="radio" aria-checked="${i === 1}" data-gc="${a}">${kr(a)}</button>`).join("")}</div>
          <ul class="gc-points"><li>Skickas med e-post direkt, eller på ett datum du väljer</li><li>Med en egen hälsning</li><li>Går att använda på allt i butiken, flera gånger</li></ul>
          <div class="gc-soon"><p><b>Presentkorten kommer när butiken öppnar.</b> Skriv upp dig, så mejlar vi när de går att köpa.</p>
            <form id="gcForm" novalidate><label class="sr" for="gcEmail">Din e-post</label><div class="field"><input id="gcEmail" type="email" autocomplete="email" placeholder="namn@exempel.se"><button class="btn" type="submit">Säg till mig</button></div><p class="status" id="gcSt" role="alert"></p></form></div>
          <p class="small" style="margin-top:1.4rem">Letar du efter en present nu? <a href="#hitta-ratt-present">Hitta rätt present</a> hjälper dig att välja.</p></div>
      </section>`,
    mount(root) {
      $$("[data-gc]", root).forEach((b) => b.addEventListener("click", () => { $$("[data-gc]", root).forEach((x) => x.setAttribute("aria-checked", String(x === b))); $("#gcAmt", root).textContent = kr(+b.dataset.gc); }));
      const f = $("#gcForm", root), st = $("#gcSt", root);
      f.addEventListener("submit", async (e) => {
        e.preventDefault(); const v = $("#gcEmail", root).value.trim();
        if (!emailOk(v)) { st.textContent = "Skriv en e-postadress, till exempel namn@exempel.se."; return; }
        const amt = ($("[data-gc][aria-checked=true]", root) || {}).dataset, btn = f.querySelector("button[type=submit]");
        if (btn.disabled) return; btn.disabled = true; st.textContent = "";
        const res = await (RQ.subscribe ? RQ.subscribe({ email: v, lista: "Presentkort", roster: amt ? amt.gc + " kr" : "" }) : Promise.resolve("preview"));
        btn.disabled = false; st.classList.toggle("err", res === "error");
        st.textContent = res === "error" ? "Det gick inte att skicka just nu. Försök igen om en stund." : res === "preview" ? "Förhandsversion: adressen sparas inte här. På den riktiga sajten hamnar du på listan." : "Tack. Vi mejlar när presentkorten går att köpa. Inget annat.";
        if (res === "sent") $("#gcEmail", root).value = "";
      });
    },
  });
})();
