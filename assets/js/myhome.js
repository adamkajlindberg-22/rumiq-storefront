/* RumIQ: your home, remembered.
   - Mina rum och mått (in Mitt hem): the rooms you have and their measurements, saved in this browser
     (and in the account when signed in). Every product page then says whether the product suits and
     fits each of your rooms ("I ditt hem").
   - Prisbevakning: an e-mail when something you saved becomes cheaper or can be bought. The sign-up
     goes to the same waiting-list table as the other lists (list "Prisbevakning"). */
(function () {
  const RQ = window.RQ, S = RQ.shop, $ = RQ.$, $$ = RQ.$$, esc = RQ.esc;
  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };
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
  const num = (v) => { const n = Math.round(+String(v || "").replace(",", ".")); return n > 0 && n < 5000 ? n : null; };
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
        <form class="hr-form panel" id="hrForm" novalidate><input type="hidden" name="id">
          <h3 class="h3" style="font-size:1.15rem" id="hrTitle">${rooms.length ? "Lägg till ett rum" : "Lägg till ditt första rum"}</h3>
          <div class="hr-grid">
            <label>Rum<select name="type">${RQ.ROOMS.map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join("")}</select></label>
            <label>Eget namn <span class="opt">valfritt</span><input name="label" maxlength="30" placeholder="Till exempel Sovrum uppe"></label>
            <label>Golvets bredd, cm<input name="floorW" inputmode="numeric" placeholder="350"></label>
            <label>Golvets djup, cm<input name="floorD" inputmode="numeric" placeholder="420"></label>
            <label>Fri väggbredd, cm<input name="wallW" inputmode="numeric" placeholder="240"></label>
            <label>Fönstrets bredd, cm<input name="windowW" inputmode="numeric" placeholder="120"></label>
          </div>
          <p class="small">Mät det fria golvet där en matta kan ligga, väggen där en tavla kan hänga och fönstret utan karm. Inga mått är obligatoriska.</p>
          <div class="ctrl-row"><button class="btn" type="submit">Spara rummet</button><button class="btn ghost" type="button" id="hrCancel" hidden>Avbryt</button></div>
          <p class="status" id="hrStatus" role="status"></p></form></div>`;
    },
    mount(root) {
      const f = $("#hrForm", root); if (!f) return;
      const reset = () => { f.reset(); f.id.value = ""; $("#hrTitle", root).textContent = this.list().length ? "Lägg till ett rum" : "Lägg till ditt första rum"; $("#hrCancel", root).hidden = true; };
      f.addEventListener("submit", (e) => {
        e.preventDefault();
        const r = { id: f.id.value || Math.random().toString(36).slice(2, 9), type: f.type.value, label: f.label.value.trim().slice(0, 30), floorW: num(f.floorW.value), floorD: num(f.floorD.value), wallW: num(f.wallW.value), windowW: num(f.windowW.value) };
        const rooms = this.list(), i = rooms.findIndex((x) => x.id === r.id);
        if (i > -1) rooms[i] = r; else rooms.push(r);
        this.save(rooms); RQ.toast(`${this.label(r)} är sparat.`); RQ.router();
      });
      $("#hrCancel", root).addEventListener("click", reset);
      root.addEventListener("click", (e) => {
        const ed = e.target.closest("[data-hr-edit]"), dl = e.target.closest("[data-hr-del]");
        if (dl) { this.save(this.list().filter((x) => x.id !== dl.dataset.hrDel)); RQ.router(); return; }
        if (ed) {
          const r = this.list().find((x) => x.id === ed.dataset.hrEdit); if (!r) return;
          f.id.value = r.id; f.type.value = r.type; f.label.value = r.label || ""; ["floorW", "floorD", "wallW", "windowW"].forEach((k) => (f[k].value = r[k] || ""));
          $("#hrTitle", root).textContent = `Ändra ${this.label(r)}`; $("#hrCancel", root).hidden = false; f.scrollIntoView({ behavior: "smooth", block: "center" });
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
    send(v, hs, "Prisbevakning").then((res) => {
      if (res === "error") { err.textContent = "Det gick inte att skicka just nu. Försök igen om en stund."; return; }
      ls.set("rumiq-watch", { email: v, handles: hs, at: new Date().toISOString() });
      ok.textContent = res === "preview" ? PREVIEW_NOTE : `Klart. Du bevakar ${hs.length} ${hs.length === 1 ? "sak" : "saker"}.`; f.classList.add("sent");
      RQ.track && RQ.track("price_watch", { items: hs.length });
    });
  });
  document.addEventListener("click", (e) => {
    const add = e.target.closest("[data-pwatch-add]"), stop = e.target.closest("[data-pwatch-stop]");
    const w = RQ.priceWatch.get(); if (!w || (!add && !stop)) return;
    if (add) {
      const hs = [...new Set([...w.handles, ...add.dataset.pwatchAdd.split(",")])];
      send(w.email, hs, "Prisbevakning").then((res) => { if (res === "error") { RQ.toast("Det gick inte att skicka just nu. Försök igen om en stund."); return; } ls.set("rumiq-watch", { ...w, handles: hs }); RQ.toast(`Du bevakar ${hs.length} saker.`); RQ.router(); });
    }
    if (stop) { send(w.email, [], "Prisbevakning avslutad"); ls.del("rumiq-watch"); RQ.toast("Bevakningen är avslutad."); RQ.router(); }
  });
})();
