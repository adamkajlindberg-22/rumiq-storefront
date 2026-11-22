/* Mitt rum: the customer's own room photo becomes the place where the whole shop is shown.
   - The photo is resized and kept in this browser only (localStorage), never uploaded.
   - Its colours and light are read once (k-means palette, brightness, warmth).
   - "The scene" is the set of products the customer has stood in the room, with position and size.
   - Every product card, product page and the room editor read from here.
   Sizes are approximate: verified product measurements do not exist yet, and the page says so. */
(function () {
  const RQ = window.RQ, S = RQ.shop, $ = RQ.$, $$ = RQ.$$, esc = RQ.esc, kr = S.kr;
  const KEY = "rumiq-myroom", SCENE = "rumiq-scene", MODE = "rumiq-roommode";
  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };
  let room = ls.get(KEY, null), blobUrl = null;
  const emit = (what) => document.dispatchEvent(new CustomEvent("rq-room", { detail: what }));

  /* where a product usually sits in a room photo: x/y in % of the photo (y = where it stands), w = width in % */
  const PLACE = {
    "glob-bordslampa-opalglas": { y: 80, w: 12 }, "lysa-keramiklampa": { y: 80, w: 14 }, "svamp-uppladdningsbar-lampa": { y: 80, w: 9 },
    "skarbrada-ek-med-handtag": { y: 82, w: 11 }, "forradsburkar-glas-ek-3-pack": { y: 82, w: 13 }, "plad-ullblandning-havre": { y: 78, w: 22 },
    "lin-kuddfodral": { y: 74, w: 12 }, "sand-keramikvas": { y: 80, w: 8 }, "rund-vaggspegel-ek": { y: 46, w: 20 },
    "forvaringslada-filt": { y: 94, w: 16 }, "flatad-forvaringskorg": { y: 95, w: 17 }, "vaffelhandduk-bomull": { y: 82, w: 12 },
    "tvalpump-stengods": { y: 82, w: 5 }, "kabelbox-vit": { y: 95, w: 12 }, "skrivbordsorganisator-ek": { y: 82, w: 10 },
    "orbit-tradlost-laddstall": { y: 82, w: 6 }, "terrakottakruka-rafflad": { y: 95, w: 12 },
  };
  const placeFor = (p) => PLACE[p.handle] || { y: p.wall ? 46 : 84, w: 14 };
  const SLOTS = [50, 30, 70, 18, 82, 40, 60];

  /* ---------------------------------------------------------------- colour */
  const hex2rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgb2hex = (c) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  const lab = ([r, g, b]) => {
    const f = (v) => { v /= 255; return v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92; };
    const [R, G, B] = [f(r), f(g), f(b)];
    let x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, y = R * 0.2126 + G * 0.7152 + B * 0.0722, z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
    const t = (v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
    x = t(x); y = t(y); z = t(z);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  };
  const dE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

  function analyse(img) {
    const W = 96, H = Math.max(1, Math.round(96 * img.naturalHeight / img.naturalWidth));
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const cx = cv.getContext("2d", { willReadFrequently: true }); cx.drawImage(img, 0, 0, W, H);
    const d = cx.getImageData(0, 0, W, H).data, px = [];
    for (let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2]]);
    let cs = [0.05, 0.25, 0.5, 0.75, 0.95].map((f) => px[Math.floor(f * (px.length - 1))].slice());
    const asg = new Array(px.length).fill(0);
    for (let it = 0; it < 9; it++) {
      px.forEach((p, i) => { let b = 0, bd = 1e9; cs.forEach((c, j) => { const dd = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (dd < bd) { bd = dd; b = j; } }); asg[i] = b; });
      cs = cs.map((c, j) => { let n = 0; const s = [0, 0, 0]; px.forEach((p, i) => { if (asg[i] === j) { n++; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; } }); return n ? s.map((v) => v / n) : c; });
    }
    const counts = cs.map((_, j) => asg.filter((a) => a === j).length);
    const pal = cs.map((c, j) => ({ hex: rgb2hex(c), n: counts[j] / px.length })).filter((x) => x.n > 0.02).sort((a, b) => b.n - a.n);
    const avg = [0, 1, 2].map((k) => px.reduce((s, p) => s + p[k], 0) / px.length);
    const light = (0.2126 * avg[0] + 0.7152 * avg[1] + 0.0722 * avg[2]) / 255;
    const warm = (avg[0] - avg[2]) / 255;
    return { pal, light, warm };
  }

  /* how well a product's colours sit with the room's colours: 0–100 */
  function match(p) {
    if (!room || !room.pal || !room.pal.length) return null;
    const P = room.pal.map((x) => ({ l: lab(hex2rgb(x.hex)), n: x.n }));
    const tones = (p.tone || []).slice(0, 3).map((h) => lab(hex2rgb(h)));
    if (!tones.length) return null;
    const ds = tones.map((t) => Math.min(...P.map((x) => dE(t, x.l) * (1.15 - Math.min(0.3, x.n)))));
    const avg = ds.reduce((a, b) => a + b, 0) / ds.length;
    return Math.max(35, Math.min(98, Math.round(108 - avg * 2.2)));
  }

  /* the products' light follows the room's light */
  const lightFilter = (extra = 100) => {
    if (!room) return "";
    const b = (0.84 + (room.light || 0.6) * 0.3) * extra / 100, w = Math.max(0, Math.min(0.25, (room.warm || 0) * 0.9));
    return `brightness(${b.toFixed(3)}) sepia(${w.toFixed(3)}) saturate(${(1 - w * 0.4).toFixed(3)})`;
  };

  const toBlobUrl = (dataUrl) => {
    try { const [h, b64] = dataUrl.split(","); const mime = h.match(/:(.*?);/)[1]; const bin = atob(b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return URL.createObjectURL(new Blob([u8], { type: mime })); }
    catch (e) { return dataUrl; }
  };

  /* ---------------------------------------------------------------- public API */
  const R = (RQ.room = {
    PLACE, placeFor, match, lightFilter, analyse,
    has: () => !!room,
    get: () => room,
    url() { if (!room) return null; if (!blobUrl) blobUrl = toBlobUrl(room.img); return blobUrl; },
    mode: () => !!room && ls.get(MODE, true) !== false,
    setMode(on) { ls.set(MODE, !!on); emit("mode"); },
    async saveImage(img, meta = {}) {
      const max = 1400, k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const W = Math.round(img.naturalWidth * k), H = Math.round(img.naturalHeight * k);
      const cv = document.createElement("canvas"); cv.width = W; cv.height = H; cv.getContext("2d").drawImage(img, 0, 0, W, H);
      let data = cv.toDataURL("image/jpeg", 0.82);
      const a = analyse(img);
      const next = { img: data, w: W, h: H, pal: a.pal, light: a.light, warm: a.warm, type: meta.type || null, name: meta.name || "", sample: !!meta.sample, at: new Date().toISOString() };
      let ok = ls.set(KEY, next);
      if (!ok) { data = cv.toDataURL("image/jpeg", 0.62); next.img = data; ok = ls.set(KEY, next); }
      if (!ok) { RQ.toast("Bilden fick inte plats i webbläsarens lagring. Ta bort gamla projekt i Mitt hem och försök igen."); return false; }
      room = next; if (blobUrl && blobUrl.startsWith("blob:")) URL.revokeObjectURL(blobUrl); blobUrl = null;
      ls.set(MODE, true); emit("room"); return true;
    },
    setType(t) { if (!room) return; room.type = t; ls.set(KEY, room); emit("type"); },
    clear() { ls.del(KEY); room = null; blobUrl = null; emit("room"); },
    /* scene */
    scene: () => ls.get(SCENE, []).filter((it) => RQ.byHandle(it.h)),
    saveScene(list) { ls.set(SCENE, list); emit("scene"); },
    inScene: (h) => R.scene().some((it) => it.h === h),
    add(h, quiet) {
      const p = RQ.byHandle(h); if (!p) return false;
      const list = R.scene(); if (list.some((it) => it.h === h)) return false;
      const pl = placeFor(p); const used = list.map((it) => it.x);
      const slots = p.wall ? [72, 28, 50] : SLOTS;
      const x = slots.find((s) => !used.some((u) => Math.abs(u - s) < 9)) ?? 50;
      list.push({ h, x, y: pl.y, w: pl.w, flip: false, light: 100 });
      R.saveScene(list);
      if (!quiet) RQ.toast(`${esc(p.name)} står nu i ditt rum. <a href="#mitt-rum">Öppna</a>`);
      return true;
    },
    remove(h) { R.saveScene(R.scene().filter((it) => it.h !== h)); },
    toggle(h) { if (R.inScene(h)) { R.remove(h); return false; } R.add(h); return true; },
    update(h, patch) { R.saveScene(R.scene().map((it) => (it.h === h ? { ...it, ...patch } : it))); },
    toFront(h) { const l = R.scene(); const i = l.findIndex((it) => it.h === h); if (i < 0) return; l.push(l.splice(i, 1)[0]); R.saveScene(l); },
    total: () => R.scene().reduce((s, it) => s + RQ.byHandle(it.h).price, 0),
    /* rule-based suggestions: the room's type and colours, one product per category */
    suggest(n = 4) {
      const have = new Set(R.scene().map((it) => it.h)), cats = new Set(R.scene().map((it) => RQ.byHandle(it.h).cat));
      const pool = RQ.PRODUCTS.filter((p) => !have.has(p.handle) && (!room || !room.type || p.rooms.includes(room.type)))
        .map((p) => ({ p, s: (match(p) || 70) + (p.featured ? 4 : 0) })).sort((a, b) => b.s - a.s);
      const out = [];
      for (const { p } of pool) { if (out.length >= n) break; if (cats.has(p.cat)) continue; cats.add(p.cat); out.push(p); }
      return out;
    },
    /* the product shown inside the customer's room, for cards and tiles */
    layer(p, big) {
      if (!room) return "";
      const pl = placeFor(p);
      const w = Math.min(big ? 52 : 64, pl.w * (big ? 2.3 : 2.9));
      const y = p.wall ? 54 : 90;
      return `<span class="inr"><img class="inr-bg" src="${R.url()}" alt="" decoding="async"><span class="inr-p${p.wall ? " wall" : ""}" style="left:50%;top:${y}%;width:${w.toFixed(1)}%"><img src="${RQ.cut(p)}" alt="" decoding="async" style="filter:${lightFilter()}"></span></span>`;
    },
    thumb: () => (room ? `<img src="${R.url()}" alt="">` : ""),
  });

  /* ---------------------------------------------------------------- setup sheet: take or choose the photo */
  const TYPES = [["vardagsrum", "Vardagsrum"], ["sovrum", "Sovrum"], ["kok", "Kök"], ["badrum", "Badrum"], ["hall", "Hall"], ["hemmakontor", "Hemmakontor"], ["uteliv", "Uteliv"]];
  const sheet = document.createElement("div");
  sheet.className = "sheet"; sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-modal", "true"); sheet.setAttribute("aria-labelledby", "roomSheetTitle");
  sheet.innerHTML = `<div class="sheet-scrim" data-sheet-close></div><div class="sheet-card"><span class="sheet-grip" aria-hidden="true"></span>
    <button class="iconbtn sheet-x" type="button" data-sheet-close aria-label="Stäng"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    <h2 id="roomSheetTitle">Lägg in ditt rum</h2>
    <p class="lead">Ta en bild av rummet du vill inreda. Sedan står varje produkt du tittar på i just ditt rum.</p>
    <div class="sheet-acts">
      <label class="btn cam"><svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>Ta en bild<input type="file" accept="image/*" capture="environment" class="sr" data-room-file></label>
      <label class="btn ghost"><svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="1.5"/><path d="M4 16l5-5 4 4 3-3 4 4"/></svg>Välj en bild<input type="file" accept="image/*" class="sr" data-room-file></label>
    </div>
    <p class="small sheet-tip">Ställ dig i dörröppningen, håll telefonen vågrätt och ta bilden i dagsljus.</p>
    <h3>Eller prova med ett exempelrum</h3>
    <div class="sheet-samples">${RQ.SAMPLE_ROOMS.map((r) => `<button type="button" data-room-sample="${r.img}" data-type="${r.id}"><img src="${r.img.replace("-1600", "-600")}" alt="" loading="lazy"><span>${esc(r.name)}</span></button>`).join("")}</div>
    <h3>Vilket rum är det?</h3>
    <div class="chips" data-room-type>${TYPES.map(([id, n]) => `<button type="button" class="chip" data-v="${id}" aria-pressed="false">${n}</button>`).join("")}</div>
    <p class="small sheet-priv"><svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="1.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>Bilden sparas bara i din webbläsare. Den skickas till oss först om du själv väljer att skapa en AI-bild.</p>
    <div class="sheet-busy" hidden><span class="spin"></span>Läser in rummet</div>
  </div>`;
  document.body.appendChild(sheet);
  let after = null, chosenType = null, back = null;
  const busy = (on) => ($(".sheet-busy", sheet).hidden = !on);
  R.openSetup = (then) => {
    after = then || null; back = document.activeElement;
    chosenType = room && room.type;
    $$("[data-room-type] [data-v]", sheet).forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === chosenType));
    $("#roomSheetTitle", sheet).textContent = room ? "Byt rum" : "Lägg in ditt rum";
    $(".cam", sheet).hidden = !matchMedia("(pointer:coarse)").matches;
    sheet.classList.add("open"); document.documentElement.style.overflow = "hidden";
    setTimeout(() => $(".sheet-x", sheet).focus(), 60);
  };
  const close = () => { sheet.classList.remove("open"); document.documentElement.style.overflow = ""; if (back && back.focus) back.focus({ preventScroll: true }); };
  R.closeSetup = close;
  const done = async (img, meta) => {
    busy(true);
    const ok = await R.saveImage(img, { ...meta, type: chosenType || meta.type || null });
    busy(false); if (!ok) return;
    close();
    const cb = after; after = null;
    if (cb) cb(); else RQ.toast('Klart. Nu visas butiken i ditt rum. <a href="#butik">Till butiken</a>');
  };
  sheet.addEventListener("click", (e) => {
    if (e.target.closest("[data-sheet-close]")) return close();
    const t = e.target.closest("[data-room-type] [data-v]"); if (t) { chosenType = chosenType === t.dataset.v ? null : t.dataset.v; $$("[data-room-type] [data-v]", sheet).forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === chosenType)); if (room) R.setType(chosenType); return; }
    const s = e.target.closest("[data-room-sample]"); if (s) { busy(true); const im = new Image(); im.onload = () => done(im, { sample: true, type: s.dataset.type, name: $("span", s).textContent }); im.onerror = () => busy(false); im.src = s.dataset.roomSample; }
  });
  $$("[data-room-file]", sheet).forEach((inp) => inp.addEventListener("change", () => {
    const f = inp.files[0]; inp.value = ""; if (!f) return;
    if (!/^image\//.test(f.type) && !/\.(heic|heif)$/i.test(f.name)) { RQ.toast("Välj en bildfil, till exempel JPG, PNG eller WebP."); return; }
    busy(true); const url = URL.createObjectURL(f); const im = new Image();
    im.onload = () => { done(im, { name: "Mitt rum" }); setTimeout(() => URL.revokeObjectURL(url), 4000); };
    im.onerror = () => { busy(false); RQ.toast("Bilden gick inte att läsa. Prova en JPG eller PNG."); };
    im.src = url;
  }));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && sheet.classList.contains("open")) { e.stopImmediatePropagation(); close(); } }, true);
  // swipe the sheet down to close it on phones
  (() => { const card = $(".sheet-card", sheet); let y0 = null, dy = 0;
    card.addEventListener("touchstart", (e) => { if (card.scrollTop > 0) return; y0 = e.touches[0].clientY; dy = 0; }, { passive: true });
    card.addEventListener("touchmove", (e) => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); card.style.transform = `translateY(${dy}px)`; }, { passive: true });
    card.addEventListener("touchend", () => { if (y0 == null) return; card.style.transform = ""; if (dy > 110) close(); y0 = null; });
  })();


  /* ---------------------------------------------------------------- the room editor (#mitt-rum) */
  const V = RQ.views;
  const ICO = {
    wand: '<svg viewBox="0 0 24 24"><path d="M4 20L15 9M14 4v3M19 9h-3M17.5 5.5l-2 2M9 4l.6 1.4L11 6l-1.4.6L9 8l-.6-1.4L7 6l1.4-.6zM19 14l.6 1.4L21 16l-1.4.6L19 18l-.6-1.4L17 16l1.4-.6z"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    swap: '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    save: '<svg viewBox="0 0 24 24"><path d="M5 5h14v15l-7-4-7 4z"/></svg>',
    eye: '<svg viewBox="0 0 24 24"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    flip: '<svg viewBox="0 0 24 24"><path d="M12 3v18M8 7l-4 5 4 5zM16 7l4 5-4 5z"/></svg>',
    front: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="11" rx="1"/><path d="M5 15V5h10"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13"/></svg>',
    share: '<svg viewBox="0 0 24 24"><path d="M12 4v11M8 8l4-4 4 4M5 13v7h14v-7"/></svg>',
  };
  const setupBlock = () => `<div class="rm-empty">
      <div class="rm-empty-in">
        <h2 class="h2">Börja med en bild av ditt rum.</h2>
        <p class="lead">Sedan ställer du in produkter där du vill ha dem, ser vad hela rummet kostar och handlar allt på en gång.</p>
        <div class="ctrl-row" style="margin-top:1.6rem"><button class="btn" type="button" data-room-setup>Lägg in ditt rum</button><button class="btn ghost" type="button" data-room-sample-now="#mitt-rum">Prova med ett exempelrum</button></div>
        <ol class="rm-steps"><li><b>Ta en bild</b><span>Med telefonen, eller välj en du redan har.</span></li><li><b>Ställ in produkter</b><span>Från butiken, eller låt oss föreslå.</span></li><li><b>Handla looken</b><span>Allt i rummet hamnar i varukorgen med en knapp.</span></li></ol>
        <p class="small" style="margin-top:1.2rem">Bilden sparas bara i din webbläsare. Den skickas till oss först om du själv väljer att skapa en AI-bild.</p>
      </div>${RQ.demoFig ? RQ.demoFig() : ""}</div>`;

  V.myRoom = (pre) => {
    if (pre && RQ.byHandle(pre) && room) R.add(pre, true);
    if (pre && RQ.byHandle(pre) && !room) RQ.ss && RQ.ss.set("rumiq-room-pre", pre);
    return {
      title: "Mitt rum · RumIQ",
      html: `<section class="wrap rm-top">${RQ.crumbs([["Hem", "hem"], ["Mitt rum"]])}<div class="rm-title"><h1 class="h1">Mitt rum</h1>${room ? `<p class="lead">Ställ in produkter, flytta dem med fingret och nyp för att ändra storlek. Allt du ser kan du handla direkt.</p>` : ""}</div></section>
        ${room ? `<section class="rm wrap">
          <div class="rm-stagewrap">
            <div class="rm-stage" id="rmStage" style="aspect-ratio:${room.w} / ${room.h}"><img class="rm-bg" src="${R.url()}" alt="Ditt rum" draggable="false"><div class="rm-items" id="rmItems"></div>
              <button type="button" class="rm-hold" id="rmHold" aria-label="Håll inne för att se rummet utan produkterna">${ICO.eye}<span>Håll för före</span></button>
              <div class="rm-emptyhint" id="rmHint" hidden><p>Rummet är tomt.</p><button class="btn sm light" type="button" id="rmSuggest0">${ICO.wand}Inred åt mig</button></div>
            </div>
            <div class="rm-tools">
              <button type="button" class="rm-tool" id="rmSuggest">${ICO.wand}<span>Inred åt mig</span></button>
              <button type="button" class="rm-tool" id="rmAdd">${ICO.plus}<span>Lägg till</span></button>
              <button type="button" class="rm-tool rm-ai" data-ai-create><svg viewBox="0 0 24 24"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/></svg><span>AI-bild</span></button>
              <button type="button" class="rm-tool" id="rmSave">${ICO.save}<span>Spara</span></button>
              <button type="button" class="rm-tool" data-room-setup>${ICO.swap}<span>Byt rum</span></button>
              <button type="button" class="rm-tool rm-hold2" id="rmHold2" aria-label="Håll inne för att se rummet utan produkterna">${ICO.eye}<span>Före</span></button>
            </div>
            <p class="caption">Storleken är ungefärlig tills produkternas mått är bekräftade. Ljuset på produkterna anpassas efter ditt foto.</p>
          </div>
          <aside class="rm-side">
            ${RQ.ai ? RQ.ai.card() : ""}
            <div class="rm-sel" id="rmSel" hidden>
              <div class="rm-sel-h"><img id="rmSelImg" alt=""><div><b id="rmSelName"></b><span id="rmSelPrice"></span></div><a class="tlink" id="rmSelLink" href="#">Visa</a></div>
              <div class="range-row"><span>Storlek</span><input type="range" id="rmSize" min="3" max="70" step=".5" aria-label="Storlek"></div>
              <div class="range-row"><span>Ljus</span><input type="range" id="rmLight" min="60" max="135" aria-label="Ljus"></div>
              <div class="rm-sel-a"><button type="button" class="chip" id="rmFlip">${ICO.flip}Spegelvänd</button><button type="button" class="chip" id="rmFront">${ICO.front}Längst fram</button><button type="button" class="chip" id="rmDel">${ICO.trash}Ta bort</button></div>
            </div>
            <div class="rm-listhead"><h2 class="h3">I rummet</h2><span class="small" id="rmCount"></span></div>
            <ul class="rm-list" id="rmList"></ul>
            <div class="rm-buy">
              <div class="sum total"><span>Hela rummet</span><span id="rmTotal">0 kr</span></div>
              <button class="btn block" type="button" id="rmCart">Lägg allt i varukorgen</button>
              <p class="small">Du väljer antal och ser frakt i kassan innan du betalar.</p>
            </div>
          </aside>
        </section>
        <div class="buybar rm-bar" id="rmBar"><div class="bb-t"><b>Hela rummet</b><span id="rmBarSum">0 kr</span></div><button class="btn sm" type="button" id="rmCart2">Lägg allt i varukorgen</button></div>
        <section class="sec tight kalk"><div class="wrap"><div class="sec-row"><div class="sec-head"><h2 class="h2">Passar ditt rum</h2><p>Sorterat efter hur väl färgerna går ihop med ditt foto. Tryck på rummet-knappen för att ställa in.</p></div><a class="link" href="#butik">Hela butiken</a></div><div id="rmFits"></div></div></section>`
        : `<section class="wrap" style="padding-bottom:5rem">${setupBlock()}</section>`}`,
      mount(root) {
        document.body.classList.add("on-room");
        if (!room) return () => document.body.classList.remove("on-room");
        const pre2 = RQ.ss && RQ.ss.get("rumiq-room-pre"); if (pre2) { RQ.ss.set("rumiq-room-pre", ""); R.add(pre2, true); }
        const stage = $("#rmStage", root), wrap = $("#rmItems", root);
        let sel = null;
        const fits = () => { const list = RQ.PRODUCTS.map((p) => ({ p, m: match(p) || 0 })).sort((a, b) => b.m - a.m).slice(0, 6).map((x) => x.p); $("#rmFits", root).innerHTML = RQ.grid(list, "three"); RQ.markImages && RQ.markImages(root); };
        const draw = () => {
          const list = R.scene();
          wrap.innerHTML = list.map((it, i) => { const p = RQ.byHandle(it.h); return `<div class="rm-item${p.wall ? " wall" : ""}${sel === it.h ? " sel" : ""}" data-h="${it.h}" tabindex="0" role="button" aria-label="${esc(p.name)}. Dra för att flytta." style="left:${it.x}%;top:${it.y}%;width:${it.w}%;z-index:${i + 1}"><img src="${RQ.cut(p)}" alt="" draggable="false" style="transform:scaleX(${it.flip ? -1 : 1});filter:${lightFilter(it.light)}"></div>`; }).join("");
          $("#rmHint", root).hidden = list.length > 0;
          $("#rmList", root).innerHTML = list.length ? list.map((it) => { const p = RQ.byHandle(it.h); return `<li class="${sel === it.h ? "on" : ""}"><button type="button" class="rm-li" data-pick="${it.h}"><img src="${RQ.img(p, 600)}" alt=""><span><b>${esc(p.name)}</b><span>${kr(p.price)}</span></span></button><button type="button" class="iconbtn" data-del="${it.h}" aria-label="Ta bort ${esc(p.name)} ur rummet">${ICO.trash}</button></li>`; }).join("") : `<li class="rm-none">Inget i rummet än. Tryck på <b>Inred åt mig</b> eller <b>Lägg till</b>.</li>`;
          const t = kr(R.total()); $("#rmTotal", root).textContent = t; $("#rmBarSum", root).textContent = `${list.length} ${list.length === 1 ? "produkt" : "produkter"} · ${t}`;
          $("#rmCount", root).textContent = list.length ? `${list.length} ${list.length === 1 ? "produkt" : "produkter"}` : "";
          $("#rmCart", root).disabled = $("#rmCart2", root).disabled = !list.length;
          paintSel();
        };
        const paintSel = () => {
          const it = R.scene().find((x) => x.h === sel); const box = $("#rmSel", root); box.hidden = !it; if (!it) return;
          const p = RQ.byHandle(it.h);
          $("#rmSelImg", root).src = RQ.img(p, 600); $("#rmSelName", root).textContent = p.name; $("#rmSelPrice", root).textContent = kr(p.price);
          $("#rmSelLink", root).href = "#produkt-" + p.handle; $("#rmSize", root).value = it.w; $("#rmLight", root).value = it.light;
        };
        const select = (h) => { sel = h; $$(".rm-item", wrap).forEach((el) => el.classList.toggle("sel", el.dataset.h === h)); $$("#rmList li", root).forEach((li) => li.classList.toggle("on", !!$(`[data-pick="${h}"]`, li))); paintSel(); };
        const live = (h, patch) => { const el = $(`.rm-item[data-h="${h}"]`, wrap); if (!el) return; if (patch.x != null) el.style.left = patch.x + "%"; if (patch.y != null) el.style.top = patch.y + "%"; if (patch.w != null) el.style.width = patch.w + "%"; };
        // gestures: one finger moves, two fingers resize, the stage keeps the page from scrolling while you work
        const pts = new Map(); let drag = null, pinch = null;
        stage.addEventListener("pointerdown", (e) => {
          const el = e.target.closest(".rm-item");
          if (e.target.closest(".rm-hold,.rm-emptyhint")) return;
          pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
          try { stage.setPointerCapture(e.pointerId); } catch (x) {}
          if (pts.size === 2 && sel) { const [a, b] = [...pts.values()]; const it = R.scene().find((x) => x.h === sel); pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), w: it.w }; drag = null; return; }
          if (el) { select(el.dataset.h); const it = R.scene().find((x) => x.h === el.dataset.h); const r = stage.getBoundingClientRect(); drag = { h: el.dataset.h, sx: e.clientX, sy: e.clientY, ox: it.x, oy: it.y, r, x: it.x, y: it.y }; el.style.zIndex = 99; }
          else if (pts.size === 1) select(null);
        });
        stage.addEventListener("pointermove", (e) => {
          if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (pinch && pts.size >= 2) { const [a, b] = [...pts.values()]; const w = Math.max(3, Math.min(70, pinch.w * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d)); pinch.cur = w; live(sel, { w }); $("#rmSize", root).value = w; return; }
          if (!drag) return; e.preventDefault();
          drag.x = Math.max(0, Math.min(100, drag.ox + (e.clientX - drag.sx) / drag.r.width * 100));
          drag.y = Math.max(8, Math.min(104, drag.oy + (e.clientY - drag.sy) / drag.r.height * 100));
          live(drag.h, { x: drag.x, y: drag.y });
        });
        const up = (e) => {
          if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId);
          if (pinch) { if (pts.size < 2) { if (pinch.cur) R.update(sel, { w: +pinch.cur.toFixed(1) }); pinch = null; } return; }
          if (drag) { const d = drag; drag = null; R.update(d.h, { x: +d.x.toFixed(1), y: +d.y.toFixed(1) }); }
        };
        stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", up);
        stage.addEventListener("wheel", (e) => { if (!sel) return; e.preventDefault(); const it = R.scene().find((x) => x.h === sel); const w = Math.max(3, Math.min(70, it.w * (e.deltaY < 0 ? 1.06 : 1 / 1.06))); R.update(sel, { w: +w.toFixed(1) }); }, { passive: false });
        stage.addEventListener("keydown", (e) => { const el = e.target.closest(".rm-item"); if (!el) return; const it = R.scene().find((x) => x.h === el.dataset.h); const d = e.shiftKey ? 4 : 1;
          const m = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }[e.key];
          if (m) { e.preventDefault(); select(it.h); R.update(it.h, { x: Math.max(0, Math.min(100, it.x + m[0])), y: Math.max(8, Math.min(104, it.y + m[1])) }); setTimeout(() => $(`.rm-item[data-h="${it.h}"]`, wrap)?.focus(), 0); }
          if (e.key === "+" || e.key === "-") { e.preventDefault(); R.update(it.h, { w: Math.max(3, Math.min(70, it.w + (e.key === "+" ? 1 : -1))) }); }
          if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); R.remove(it.h); sel = null; } });
        // hold to see the room as it is
        const show = (on) => { stage.classList.toggle("before", on); $$("#rmHold,#rmHold2", root).forEach((b) => b.classList.toggle("on", on)); };
        $$("#rmHold,#rmHold2", root).forEach((hold) => {
          hold.addEventListener("pointerdown", (e) => { e.preventDefault(); show(true); });
          ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => hold.addEventListener(ev, () => show(false)));
          hold.addEventListener("contextmenu", (e) => e.preventDefault());
          hold.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); show(true); } });
          hold.addEventListener("keyup", () => show(false));
        });
        // controls
        $("#rmSize", root).addEventListener("input", (e) => { if (sel) live(sel, { w: +e.target.value }); });
        $("#rmSize", root).addEventListener("change", (e) => { if (sel) R.update(sel, { w: +e.target.value }); });
        $("#rmLight", root).addEventListener("input", (e) => { if (!sel) return; const im = $(`.rm-item[data-h="${sel}"] img`, wrap); if (im) im.style.filter = lightFilter(+e.target.value); });
        $("#rmLight", root).addEventListener("change", (e) => { if (sel) R.update(sel, { light: +e.target.value }); });
        $("#rmFlip", root).addEventListener("click", () => { const it = R.scene().find((x) => x.h === sel); if (it) R.update(sel, { flip: !it.flip }); });
        $("#rmFront", root).addEventListener("click", () => { if (sel) R.toFront(sel); });
        $("#rmDel", root).addEventListener("click", () => { if (sel) { const h = sel; sel = null; R.remove(h); } });
        root.addEventListener("click", (e) => {
          const pk = e.target.closest("[data-pick]"); if (pk) { select(pk.dataset.pick); if (innerWidth <= 900) stage.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
          const dl = e.target.closest("[data-del]"); if (dl) { if (sel === dl.dataset.del) sel = null; R.remove(dl.dataset.del); }
        });
        const suggest = () => {
          const picks = R.suggest(Math.max(1, 4 - R.scene().length) + (R.scene().length >= 4 ? 1 : 0));
          if (!picks.length) { RQ.toast("Vi hittar inget mer som passar just det här rummet. Lägg till själv."); return; }
          picks.forEach((p) => R.add(p.handle, true));
          RQ.toast(`${picks.length} förslag efter rummets färger${room.type ? " och rumstyp" : ""}. Flytta och byt fritt.`);
        };
        $("#rmSuggest", root).addEventListener("click", suggest); $("#rmSuggest0", root).addEventListener("click", suggest);
        $("#rmAdd", root).addEventListener("click", () => RQ.room.openPicker());
        const cartAll = (btn) => { const list = R.scene(); if (!list.length) return; list.forEach((it) => S.addToCart(it.h + "::0", 1)); RQ.confirmAdd(btn, ""); RQ.toast(`${list.length} produkter från ditt rum ligger i varukorgen. <a href="#" data-open-cart>Visa</a>`); };
        $("#rmCart", root).addEventListener("click", (e) => cartAll(e.currentTarget)); $("#rmCart2", root).addEventListener("click", (e) => cartAll(e.currentTarget));
        $("#rmSave", root).addEventListener("click", async () => {
          try {
            const bg = $(".rm-bg", root); const W = 1100, H = Math.round(W * room.h / room.w);
            const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const cx = cv.getContext("2d"); cx.drawImage(bg, 0, 0, W, H);
            const before = document.createElement("canvas"); before.width = 480; before.height = Math.round(480 * H / W); before.getContext("2d").drawImage(bg, 0, 0, before.width, before.height);
            for (const it of R.scene()) {
              const p = RQ.byHandle(it.h); const im = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = RQ.cut(p); });
              const w = W * it.w / 100, h = w * im.naturalHeight / im.naturalWidth, x = W * it.x / 100 - w / 2, y = H * it.y / 100 - h;
              if (!p.wall) { const g = cx.createRadialGradient(x + w / 2, y + h, 0, x + w / 2, y + h, w * 0.45); g.addColorStop(0, "rgba(0,0,0,.28)"); g.addColorStop(1, "rgba(0,0,0,0)"); cx.save(); cx.translate(0, y + h); cx.scale(1, 0.18); cx.translate(0, -(y + h)); cx.fillStyle = g; cx.fillRect(x - w * 0.1, y + h - w * 0.5, w * 1.2, w); cx.restore(); }
              cx.save(); cx.filter = lightFilter(it.light); if (it.flip) { cx.translate(x + w, y); cx.scale(-1, 1); cx.drawImage(im, 0, 0, w, h); } else cx.drawImage(im, x, y, w, h); cx.restore();
            }
            const handles = R.scene().map((it) => it.h);
            const ok = S.saveProject({ title: "Mitt rum med " + handles.map((h) => RQ.byHandle(h).name.split(" ")[0]).join(", "), img: cv.toDataURL("image/jpeg", 0.74), before: before.toDataURL("image/jpeg", 0.6), handles });
            if (!ok) { RQ.toast("Webbläsarens lagring är full. Ta bort ett gammalt projekt i Mitt hem."); return; }
            if (navigator.canShare && window.isSecureContext) {
              const blob = await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.86)); const file = new File([blob], "mitt-rum.jpg", { type: "image/jpeg" });
              if (navigator.canShare({ files: [file] })) { RQ.toast('Sparat i Mitt hem. <a href="#" data-share-room>Dela bilden</a>'); R._share = file; return; }
            }
            RQ.toast('Sparat i Mitt hem. <a href="#mitt-hem">Öppna</a>');
          } catch (e) { RQ.toast("Bilden gick inte att spara i den här webbläsaren."); }
        });
        const onRoom = (e) => { if (e.detail === "scene") { if (sel && !R.inScene(sel)) sel = null; draw(); } };
        document.addEventListener("rq-room", onRoom);
        draw(); fits();
        return () => { document.removeEventListener("rq-room", onRoom); document.body.classList.remove("on-room"); };
      },
    };
  };
  document.addEventListener("click", async (e) => { const a = e.target.closest("[data-share-room]"); if (!a || !R._share) return; e.preventDefault(); try { await navigator.share({ files: [R._share], title: "Mitt rum" }); } catch (x) {} });

  /* ---------------------------------------------------------------- product picker sheet */
  const picker = document.createElement("div");
  picker.className = "sheet"; picker.setAttribute("role", "dialog"); picker.setAttribute("aria-modal", "true"); picker.setAttribute("aria-labelledby", "pickTitle");
  picker.innerHTML = `<div class="sheet-scrim" data-pick-close></div><div class="sheet-card wide"><span class="sheet-grip" aria-hidden="true"></span>
    <button class="iconbtn sheet-x" type="button" data-pick-close aria-label="Stäng"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    <h2 id="pickTitle">Ställ in i rummet</h2><p class="small">Sorterat efter hur väl färgerna passar ditt rum.</p>
    <label class="sr" for="pickQ">Sök</label><input type="search" id="pickQ" placeholder="Sök i sortimentet" autocomplete="off">
    <div class="pickgrid" id="pickGrid"></div>
    <div class="pickfoot"><button class="btn block" type="button" data-pick-close>Klar</button></div></div>`;
  document.body.appendChild(picker);
  const renderPicker = () => {
    const q = S.norm($("#pickQ", picker).value);
    const list = RQ.PRODUCTS.filter((p) => !q || S.searchText(p).includes(q)).map((p) => ({ p, m: match(p) })).sort((a, b) => (b.m || 0) - (a.m || 0));
    $("#pickGrid", picker).innerHTML = list.map(({ p, m }) => `<button type="button" data-room-btn="${p.handle}" aria-pressed="${R.inScene(p.handle)}"><span class="pg-cut"><img src="${RQ.cut(p)}" alt="" loading="lazy"></span><b>${esc(p.name)}</b><span>${kr(p.price)}${m ? ` · ${m} % färgmatch` : ""}</span><i aria-hidden="true"></i></button>`).join("");
  };
  R.openPicker = () => { renderPicker(); picker.classList.add("open"); document.documentElement.style.overflow = "hidden"; setTimeout(() => $("#pickQ", picker).focus({ preventScroll: true }), 80); };
  const closePicker = () => { picker.classList.remove("open"); document.documentElement.style.overflow = ""; };
  picker.addEventListener("click", (e) => { if (e.target.closest("[data-pick-close]")) closePicker(); });
  $("#pickQ", picker).addEventListener("input", renderPicker);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && picker.classList.contains("open")) { e.stopImmediatePropagation(); closePicker(); } }, true);

  /* ---------------------------------------------------------------- shell: header pill, counts */
  const paint = () => {
    const n = R.scene().length;
    $$("[data-count=scene]").forEach((b) => { if (+b.dataset.n < n) { b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump"); } b.textContent = n || ""; b.dataset.n = n; });
    $$("[data-room-thumb]").forEach((el) => { el.innerHTML = room ? `<img src="${R.url()}" alt="">` : el.dataset.empty || ""; el.classList.toggle("has", !!room); });
    $$("[data-room-btn]").forEach((b) => { const on = R.inScene(b.dataset.roomBtn); b.setAttribute("aria-pressed", on); });
  };
  R.paint = paint;
  document.addEventListener("rq-room", (e) => {
    paint();
    // room photo or mode changed: redraw views that show products
    if (e.detail === "room" || e.detail === "mode") { const h = (RQ.currentRoute && RQ.currentRoute()) || ""; if (!/^(mitt-rum|studio-rum|kassa|konto)/.test(h)) RQ.router(); }
  });
  document.addEventListener("DOMContentLoaded", paint);

  /* global clicks: put a product in the room, open the setup */
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-room-btn],[data-room-setup],[data-room-mode],[data-room-sample-now]"); if (!b) return;
    e.preventDefault();
    if (b.matches("[data-room-setup]")) { R.openSetup(b.dataset.roomSetup ? () => (location.hash = b.dataset.roomSetup) : null); return; }
    if (b.matches("[data-room-sample-now]")) { const im = new Image(); im.onload = () => R.saveImage(im, { sample: true, type: "vardagsrum", name: "Vardagsrum i morgonljus" }).then((ok) => ok && (location.hash = b.dataset.roomSampleNow || "#butik")); im.src = "assets/img/rum/vardagsrum-1600.webp"; return; }
    if (b.matches("[data-room-mode]")) { if (!room) { R.openSetup(); return; } R.setMode(!R.mode()); return; }
    const h = b.dataset.roomBtn;
    const go = () => { const on = R.toggle(h); b.setAttribute("aria-pressed", on); if (!on) RQ.toast("Borttagen ur ditt rum."); };
    if (!room) R.openSetup(() => { R.add(h); }); else go();
  });
})();
