/* RumIQ Studio: tools that help people choose. Everything runs in the browser.
   No photo leaves the device. Where a tool uses rules instead of an AI service, it says so. */
(function () {
  const RQ = window.RQ, S = RQ.shop, V = RQ.views, $ = RQ.$, $$ = RQ.$$, esc = RQ.esc, I = RQ.I, kr = S.kr;
  const crumbs = (last) => RQ.crumbs([["Hem", "hem"], ["RumIQ Studio", "studio"], [last]]);
  const icon = (k) => `<span class="ic">${I[k]}</span>`;
  const priceOk = (p, max) => !max || p.price <= max;

  /* colour helpers */
  const hex2rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgb2hex = (r, g, b) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const toHsl = ([r, g, b]) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return [h, s, l]; };

  /* ---------------------------------------------------------------- Studio landing */
  const TOOLS = [
    ["Hitta din stil", [
      ["studio-stil", "palette", "Hitta min stil", "Välj rum och bilderna som känns mest som hemma. Ingen bild behövs.", "Inget konto, ingen bild"],
      ["studio-analys", "eye", "Stilanalys", "Ladda upp ett foto och se rummets färgpalett, stil och material.", "Kräver en bild"],
    ]],
    ["Hitta rätt produkter", [
      ["studio-stylist", "chat", "AI-stylist", "Beskriv ditt rum och vad du vill ändra. Få råd och förslag ur sortimentet.", "Inget konto"],
      ["studio-sok", "search", "Smart sökning", "Beskriv i en mening vad du behöver, så hittar vi det.", "Inget konto"],
      ["studio-hemurval", "compass", "Hitta ditt hemurval", "Välj ett rum och vad du behöver mest. Två val, sedan förslag.", "Inget konto"],
      ["studio-kombinera", "grid", "Kombinera och matcha", "Bygg en look av flera produkter, se totalpris och få stylingråd.", "Inget konto"],
    ]],
    ["Se och spara", [
      ["studio-rum", "room", "Se det i ditt rum", "Placera upp till tre produkter i ett foto av ditt rum.", "Ditt foto stannar hos dig"],
      ["presentguiden", "gift", "Presentguiden", "Tre frågor och ett maxpris, sedan presentförslag.", "Inget konto"],
      ["mitt-hem", "home", "Mitt hem", "Rumsprojekt, favoriter, looks och din stil på ett ställe.", "Sparas i din webbläsare"],
    ]],
  ];
  RQ.toolCard = ([h, ic, t, d, need]) => `<a class="tool" href="#${h}">${icon(ic)}<h3>${t}</h3><p>${d}</p><span class="need">${need}</span></a>`;
  RQ.beforeAfter = (cls = "") => `<figure class="${cls}"><div class="ba" id="ba" style="--x:50%"><img src="assets/img/studio/fore-1600.webp" alt="Rummet före inredning"><img class="after" src="assets/img/rum-1600.webp" alt="En möjlig inredningsidé i samma rum"><span class="bar"></span><span class="knob">⇆</span><span class="lab l">Före</span><span class="lab r">Inredningsidé</span><input type="range" min="0" max="100" value="50" aria-label="Jämför före och efter"></div><figcaption class="caption">AI-skapat inspirationsexempel. Inte ett verkligt kundresultat och inte produkter ur sortimentet.</figcaption></figure>`;
  RQ.mountBA = (root) => { const ba = $("#ba", root); if (!ba) return; const r = $("input", ba); r.addEventListener("input", () => ba.style.setProperty("--x", r.value + "%")); };

  V.studio = () => ({
    title: "RumIQ Studio · Planera ditt hem med trygghet",
    html: `<header class="page-head wrap">${RQ.crumbs([["Hem", "hem"], ["RumIQ Studio"]])}<span class="eyebrow" style="display:block;margin-top:1rem">RumIQ Studio</span><h1 class="h1">Planera ditt hem med trygghet</h1><p class="lead">Verktyg som hjälper dig att välja rätt från början. Allt är gratis, och resultaten är förslag, inte garantier.</p></header>
      <section class="wrap split" style="padding-bottom:5rem;align-items:center">${RQ.beforeAfter()}
        <div><span class="eyebrow">Så funkar det</span><ol class="studio-steps" style="grid-template-columns:1fr 1fr;margin-top:1.4rem">
          <li><h3>Välj produkter</h3><p>Upp till tre ur sortimentet.</p></li>
          <li><h3>Lägg till ditt rum</h3><p>Ladda upp ett foto eller välj ett exempelrum.</p></li>
          <li><h3>Placera</h3><p>Dra dit varje produkt ska stå och ändra storlek.</p></li>
          <li><h3>Se resultatet</h3><p>Jämför före och efter, spara och handla.</p></li></ol></div></section>
      <section class="sec kalk"><div class="wrap"><div class="sec-head"><span class="eyebrow">Hur vill du börja?</span><h2 class="h2">Två vägar in</h2></div>
        <div class="cols3" style="grid-template-columns:1fr 1fr">
          <a class="colcard" href="#studio-kombinera"><div class="im"><img src="assets/img/p/glob-bordslampa-opalglas-900.webp" alt="" loading="lazy" style="object-position:50% 40%"></div><div class="tx"><span class="eyebrow">Börja med produkter</span><h3 style="margin-top:.5rem">Välj upp till tre, lägg sedan till ditt rum</h3><p>För dig som redan har sett något du gillar.</p><span class="btn sm" style="margin-top:1rem">Kom igång</span></div></a>
          <a class="colcard" href="#studio-rum"><div class="im"><img src="assets/img/rum/vardagsrum-900.webp" alt="" loading="lazy"></div><div class="tx"><span class="eyebrow">Börja med ditt rum</span><h3 style="margin-top:.5rem">Lägg till ett foto eller välj ett exempelrum</h3><p>För dig som vill se vad som passar där du bor.</p><span class="btn sm" style="margin-top:1rem">Kom igång</span></div></a>
        </div>
        <div class="ctrl-row" style="margin-top:1.6rem"><a class="link arrow" href="#studio-stil">Fri inredningsidé</a><span style="width:1.5rem"></span><a class="link arrow" href="#inspiration">Upptäck inspirerande rum</a></div></div></section>
      <section class="sec"><div class="wrap"><div class="sec-head"><span class="eyebrow">Fler verktyg i Studio</span><h2 class="h2">Allt du behöver för att välja rätt</h2></div>
        ${TOOLS.map(([g, list]) => `<h3 class="eyebrow" style="margin:2.2rem 0 1rem">${g}</h3><div class="toolgrid stagger" data-watch>${list.map(RQ.toolCard).join("")}</div>`).join("")}</div></section>
      <section class="sec kalk"><div class="wrap split" style="align-items:start"><div><span class="eyebrow">Ny i Studio?</span><h2 class="h2" style="margin-top:.9rem">Gratis, och du bestämmer över dina bilder</h2><p class="lead" style="margin-top:1rem">Bläddra bland produkter, se dem i ditt rum, spara idéer och beställ när du är redo.</p><div class="ctrl-row" style="margin-top:1.6rem"><a class="btn ghost" href="#sa-fungerar-det">Så fungerar RumIQ</a><a class="btn ghost" href="#mitt-hem">Mitt hem</a></div></div>
        <div class="panel"><h3 class="h3" style="margin-bottom:1rem">Regler för verktygen</h3><ul class="rules">${RQ.STUDIO_RULES.map((r) => `<li>${esc(r)}</li>`).join("")}</ul></div></div></section>`,
    mount: RQ.mountBA,
  });

  /* ---------------------------------------------------------------- photo input helper */
  function photoInput(root, onImage, { sample = true } = {}) {
    const box = $(".drop", root), file = $("input[type=file]", root);
    const read = (f) => {
      if (!f || !/^image\//.test(f.type)) { RQ.toast("Välj en bildfil, till exempel JPG, PNG eller WebP."); return; }
      const url = URL.createObjectURL(f); const im = new Image();
      im.onload = () => onImage(im, url); im.onerror = () => RQ.toast("Bilden gick inte att läsa. Prova en JPG eller PNG.");
      im.src = url;
    };
    file.addEventListener("change", () => read(file.files[0]));
    ["dragenter", "dragover"].forEach((ev) => box.addEventListener(ev, (e) => { e.preventDefault(); box.classList.add("over"); }));
    ["dragleave", "drop"].forEach((ev) => box.addEventListener(ev, (e) => { e.preventDefault(); box.classList.remove("over"); }));
    box.addEventListener("drop", (e) => read(e.dataTransfer.files[0]));
    const paste = (e) => { const it = [...(e.clipboardData || {}).items || []].find((i) => i.type.startsWith("image/")); if (it) read(it.getAsFile()); };
    document.addEventListener("paste", paste);
    if (sample) $$("[data-sample]", root).forEach((b) => b.addEventListener("click", () => { const im = new Image(); im.onload = () => onImage(im, b.dataset.sample); im.src = b.dataset.sample; }));
    return () => document.removeEventListener("paste", paste);
  }
  const dropHtml = (label = "Ta eller ladda upp ett foto av ditt rum") => `<div class="drop">${I.upload}<b>${label}</b><span class="small">Bra dagsljus och vid vinkel fungerar bäst. Du kan också dra hit en bild eller klistra in den.</span><label class="btn sm" style="color:var(--linne);display:inline-flex">Välj foto<input type="file" accept="image/*" class="sr"></label><span class="small">JPG, PNG, WebP och de flesta mobilbilder. Fotot stannar i din webbläsare.</span></div>
    <p class="eyebrow" style="margin:1.4rem 0 .7rem">Ingen bild till hands? Prova ett exempelrum</p><div class="chips">${RQ.SAMPLE_ROOMS.map((r) => `<button class="chip" type="button" data-sample="${r.img}">${esc(r.name)}</button>`).join("")}</div>`;

  /* ---------------------------------------------------------------- Se det i ditt rum */
  V.studioRoom = (preselect) => {
    let chosen = preselect && RQ.byHandle(preselect) ? [preselect] : [];
    return {
      title: "Se det i ditt rum · RumIQ Studio",
      html: `<header class="page-head wrap">${crumbs("Se det i ditt rum")}<h1 class="h1">Se det i ditt rum</h1><p class="lead">Lägg till ett foto av ditt rum, välj upp till tre produkter och dra dem dit du vill ha dem.</p></header>
        <section class="wrap tool-shell" style="padding-bottom:5rem">
          <div>
            <div id="roomStart">${dropHtml()}</div>
            <div id="roomStage" hidden>
              <div class="stage-box" id="stageBox"><img class="bg" id="roomBg" alt="Ditt rum"></div>
              <div class="ctrl-row"><button class="chip" type="button" id="beforeBtn" aria-pressed="false">Visa före</button><button class="chip" type="button" id="newPhoto">Byt foto</button><button class="btn sm" type="button" id="saveRoom">Spara i Mitt hem</button><button class="btn ghost sm" type="button" id="cartAll">Lägg alla i varukorgen</button></div>
              <div id="selCtrl" class="panel" style="margin-top:1rem" hidden>
                <b id="selName"></b>
                <div class="range-row"><span>Storlek</span><input type="range" id="selScale" min="8" max="90" value="28"></div>
                <div class="range-row"><span>Ljus</span><input type="range" id="selLight" min="60" max="130" value="100"></div>
                <div class="ctrl-row"><button class="chip" type="button" id="selFlip">Spegelvänd</button><button class="chip" type="button" id="selFront">Lägg överst</button><button class="chip" type="button" id="selRemove">Ta bort</button></div>
              </div>
              <p class="caption">Placeringen är en illustration. Storlek och färg kan skilja sig från verkligheten, kontrollera produktsidan.</p>
            </div>
          </div>
          <aside>
            <div class="panel"><div style="display:flex;justify-content:space-between;align-items:baseline"><h3 class="h3" style="font-size:1.25rem">Välj produkter</h3><span class="small" id="pickCount">0 av 3</span></div>
              <input type="search" id="pickSearch" placeholder="Sök i sortimentet" style="margin:1rem 0">
              <div class="pick" id="pick"></div>
              <div class="sum total" style="margin-top:1rem"><span>Totalt</span><span id="pickTotal">0 kr</span></div></div>
          </aside>
        </section>`,
      mount(root) {
        const box = $("#stageBox", root), bg = $("#roomBg", root);
        let sel = null, z = 10, photoUrl = null;
        const placed = new Map(); // handle -> {el, x, y, w, flip, light}
        const renderPick = () => {
          const q = S.norm($("#pickSearch", root).value);
          $("#pick", root).innerHTML = RQ.PRODUCTS.filter((p) => !q || S.searchText(p).includes(q)).map((p) => `<button type="button" data-h="${p.handle}" aria-pressed="${chosen.includes(p.handle)}"><img src="${RQ.cut(p)}" alt="" loading="lazy"><span>${esc(p.name)}</span></button>`).join("");
          $("#pickCount", root).textContent = `${chosen.length} av 3`;
          $("#pickTotal", root).textContent = kr(chosen.reduce((s, h) => s + RQ.byHandle(h).price, 0));
        };
        const select = (h) => {
          sel = h; placed.forEach((o, k) => o.el.classList.toggle("sel", k === h));
          const c = $("#selCtrl", root); c.hidden = !h; if (!h) return;
          const o = placed.get(h); $("#selName", root).textContent = RQ.byHandle(h).name;
          $("#selScale", root).value = o.w; $("#selLight", root).value = o.light;
        };
        const apply = (o) => { o.el.style.left = o.x + "%"; o.el.style.top = o.y + "%"; o.el.style.width = o.w + "%"; o.el.style.transform = `translate(-50%,-100%) scaleX(${o.flip ? -1 : 1})`; $("img", o.el).style.filter = `brightness(${o.light / 100}) drop-shadow(0 14px 14px rgba(0,0,0,.22))`; };
        const place = (h, i) => {
          if (placed.has(h)) return;
          const p = RQ.byHandle(h);
          const el = document.createElement("div"); el.className = "placed"; el.tabIndex = 0; el.setAttribute("role", "button"); el.setAttribute("aria-label", `${p.name}. Dra för att flytta.`);
          el.innerHTML = `<img src="${RQ.cut(p)}" alt="">`;
          const o = { el, x: 30 + i * 22, y: p.wall ? 48 : 84, w: p.wall ? 16 : p.cat === "belysning-atmosfar" ? 12 : p.cat === "tavlor-vaggar" ? 14 : 17, flip: false, light: 100 };
          box.appendChild(el); placed.set(h, o); apply(o); el.style.zIndex = ++z;
          let drag = null;
          el.addEventListener("pointerdown", (e) => { select(h); el.setPointerCapture(e.pointerId); const r = box.getBoundingClientRect(); drag = { sx: e.clientX, sy: e.clientY, ox: o.x, oy: o.y, r }; el.style.zIndex = ++z; });
          el.addEventListener("pointermove", (e) => { if (!drag) return; o.x = Math.max(0, Math.min(100, drag.ox + (e.clientX - drag.sx) / drag.r.width * 100)); o.y = Math.max(5, Math.min(105, drag.oy + (e.clientY - drag.sy) / drag.r.height * 100)); apply(o); });
          el.addEventListener("pointerup", () => (drag = null));
          el.addEventListener("keydown", (e) => { const d = e.shiftKey ? 5 : 1; const m = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }[e.key]; if (m) { e.preventDefault(); o.x += m[0]; o.y += m[1]; apply(o); select(h); } });
        };
        const unplace = (h) => { const o = placed.get(h); if (o) { o.el.remove(); placed.delete(h); } if (sel === h) select(null); };
        const sync = () => { chosen.forEach((h, i) => place(h, i)); [...placed.keys()].forEach((h) => { if (!chosen.includes(h)) unplace(h); }); renderPick(); };
        $("#pick", root).addEventListener("click", (e) => {
          const b = e.target.closest("[data-h]"); if (!b) return; const h = b.dataset.h;
          if (chosen.includes(h)) chosen = chosen.filter((x) => x !== h);
          else { if (chosen.length >= 3) { RQ.toast("Du kan välja upp till tre produkter. Ta bort en först."); return; } chosen.push(h); }
          if (!$("#roomStage", root).hidden) sync(); else renderPick();
        });
        $("#pickSearch", root).addEventListener("input", renderPick);
        $("#selScale", root).addEventListener("input", (e) => { const o = placed.get(sel); if (o) { o.w = +e.target.value; apply(o); } });
        $("#selLight", root).addEventListener("input", (e) => { const o = placed.get(sel); if (o) { o.light = +e.target.value; apply(o); } });
        $("#selFlip", root).addEventListener("click", () => { const o = placed.get(sel); if (o) { o.flip = !o.flip; apply(o); } });
        $("#selFront", root).addEventListener("click", () => { const o = placed.get(sel); if (o) o.el.style.zIndex = ++z; });
        $("#selRemove", root).addEventListener("click", () => { if (sel) { chosen = chosen.filter((x) => x !== sel); unplace(sel); renderPick(); } });
        box.addEventListener("pointerdown", (e) => { if (e.target === box || e.target === bg) select(null); });
        $("#beforeBtn", root).addEventListener("click", (e) => { const on = e.currentTarget.getAttribute("aria-pressed") !== "true"; e.currentTarget.setAttribute("aria-pressed", on); e.currentTarget.textContent = on ? "Visa efter" : "Visa före"; placed.forEach((o) => (o.el.style.visibility = on ? "hidden" : "")); });
        $("#newPhoto", root).addEventListener("click", () => { $("#roomStage", root).hidden = true; $("#roomStart", root).hidden = false; });
        $("#cartAll", root).addEventListener("click", () => { if (!chosen.length) { RQ.toast("Välj minst en produkt först."); return; } chosen.forEach((h) => S.addToCart(h + "::0", 1)); RQ.toast(`${chosen.length} produkter i varukorgen. <a href="#" data-open-cart>Visa</a>`); });
        $("#saveRoom", root).addEventListener("click", async () => {
          try {
            const W = 960, H = Math.round(W * bg.naturalHeight / bg.naturalWidth);
            const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const cx = cv.getContext("2d");
            const r = box.getBoundingClientRect(); const sx = W / r.width, sy = H / r.height;
            // background drawn as object-fit: cover
            const ir = bg.naturalWidth / bg.naturalHeight, br = r.width / r.height; let dw = W, dh = H, dx = 0, dy = 0;
            if (ir > br) { dw = H * ir; dx = (W - dw) / 2; } else { dh = W / ir; dy = (H - dh) / 2; }
            cx.drawImage(bg, dx, dy, dw, dh);
            const draw = (o) => new Promise((ok) => { const im = $("img", o.el); const er = o.el.getBoundingClientRect(); cx.save(); cx.filter = `brightness(${o.light / 100})`; const x = (er.left - r.left) * sx, y = (er.top - r.top) * sy, w = er.width * sx, h = er.height * sy; if (o.flip) { cx.translate(x + w, y); cx.scale(-1, 1); cx.drawImage(im, 0, 0, w, h); } else cx.drawImage(im, x, y, w, h); cx.restore(); ok(); });
            for (const o of [...placed.values()].sort((a, b) => a.el.style.zIndex - b.el.style.zIndex)) await draw(o);
            const before = document.createElement("canvas"); before.width = 480; before.height = Math.round(480 * H / W); before.getContext("2d").drawImage(bg, dx / 2, dy / 2, dw / 2, dh / 2);
            const ok = S.saveProject({ title: "Rum med " + chosen.map((h) => RQ.byHandle(h).name.split(" ")[0]).join(", "), img: cv.toDataURL("image/jpeg", 0.72), before: before.toDataURL("image/jpeg", 0.6), handles: [...chosen] });
            RQ.toast(ok ? 'Sparat i Mitt hem. <a href="#mitt-hem">Öppna</a>' : "Webbläsarens lagring är full. Ta bort ett gammalt projekt i Mitt hem.");
          } catch (e) { RQ.toast("Bilden gick inte att spara i den här webbläsaren."); }
        });
        const cleanPaste = photoInput(root, (im, url) => { photoUrl = url; bg.src = url; $("#roomStart", root).hidden = true; $("#roomStage", root).hidden = false; bg.onload = () => { box.style.aspectRatio = `${im.naturalWidth} / ${im.naturalHeight}`; sync(); }; if (bg.complete && bg.naturalWidth) bg.onload(); });
        renderPick();
        return cleanPaste;
      },
    };
  };

  /* ---------------------------------------------------------------- Hitta min stil */
  const STYLE_IMG = { skandinavisk: "assets/img/stil/skandinavisk-600.webp", minimalistisk: "assets/img/stil/minimalistisk-600.webp", klassisk: "assets/img/stil/klassisk-600.webp", mjuk: "assets/img/stil/mjuk-600.webp" };
  const MATERIALS = { ek: ["skandinavisk", "klassisk"], lin: ["skandinavisk", "mjuk"], ull: ["mjuk", "klassisk"], keramik: ["klassisk", "skandinavisk"], glas: ["minimalistisk", "skandinavisk"], terrakotta: ["mjuk", "klassisk"], metall: ["minimalistisk"] };
  const FEEL = { lugnt: ["minimalistisk", "skandinavisk"], varmt: ["mjuk", "klassisk"], luftigt: ["skandinavisk", "minimalistisk"], ombonat: ["mjuk"] };
  RQ.styleResult = (style, room) => {
    const st = RQ.STYLES[style];
    const picks = RQ.PRODUCTS.filter((p) => p.styles[0] === style || p.styles.includes(style)).filter((p) => !room || p.rooms.includes(room)).slice(0, 6);
    const tones = [...new Set(picks.flatMap((p) => p.tone))].slice(0, 5);
    return `<div class="result reveal"><span class="eyebrow">Din stil</span><h2>${st.name}</h2><p class="lead" style="margin-top:.6rem">${st.text}</p>
      <div class="palette">${tones.map((t) => `<i style="background:${t}"><span>${t}</span></i>`).join("")}</div>
      <p class="small">Färgerna kommer från produkterna som passar stilen.</p></div>
      <div class="sec-head" style="margin:2.4rem 0 1.4rem"><span class="eyebrow">Förslag ur sortimentet</span></div>${RQ.grid(picks, "three")}`;
  };
  V.studioStyle = () => ({
    title: "Hitta min stil · RumIQ Studio",
    html: `<header class="page-head wrap">${crumbs("Hitta min stil")}<h1 class="h1">Hitta min stil</h1><p class="lead">Fyra snabba val, ingen bild behövs. Du får en stil, en färgpalett och förslag ur sortimentet.</p></header>
      <section class="wrap quiz" style="padding-bottom:5rem">
        <div class="q"><h3>1. Vilket rum tänker du på?</h3><div class="chips" data-q="room">${RQ.ROOMS.map((r) => `<button class="chip" type="button" data-v="${r.id}" aria-pressed="false">${esc(r.name)}</button>`).join("")}</div></div>
        <div class="q"><h3>2. Vilken bild känns mest som hemma?</h3><div class="imgopts" data-q="img">${Object.entries(RQ.STYLES).map(([k, s]) => `<button type="button" data-v="${k}" aria-pressed="false"><img src="${STYLE_IMG[k]}" alt="${esc(s.name)} rum" loading="lazy"><span>${["Ljust och naturligt", "Rent och stilla", "Tidlöst och varmt", "Mjukt och ombonat"][Object.keys(RQ.STYLES).indexOf(k)]}</span></button>`).join("")}</div></div>
        <div class="q"><h3>3. Vilka material tycker du om? Välj gärna flera.</h3><div class="chips" data-q="mat" data-multi="1">${Object.keys(MATERIALS).map((m) => `<button class="chip" type="button" data-v="${m}" aria-pressed="false">${m[0].toUpperCase() + m.slice(1)}</button>`).join("")}</div></div>
        <div class="q"><h3>4. Hur vill du att rummet ska kännas?</h3><div class="chips" data-q="feel">${Object.keys(FEEL).map((f) => `<button class="chip" type="button" data-v="${f}" aria-pressed="false">${f[0].toUpperCase() + f.slice(1)}</button>`).join("")}</div></div>
        <button class="btn" type="button" id="styleGo">Visa min stil</button>
        <div id="styleOut" style="margin-top:2rem"></div>
      </section>`,
    mount(root) {
      const ans = { room: null, img: null, mat: [], feel: null };
      $$("[data-q]", root).forEach((g) => g.addEventListener("click", (e) => {
        const b = e.target.closest("[data-v]"); if (!b) return; const k = g.dataset.q;
        if (g.dataset.multi) { const on = b.getAttribute("aria-pressed") !== "true"; b.setAttribute("aria-pressed", on); ans[k] = $$("[aria-pressed=true]", g).map((x) => x.dataset.v); }
        else { $$("[data-v]", g).forEach((x) => { x.setAttribute("aria-pressed", x === b); x.classList.toggle("dim", x !== b); }); ans[k] = b.dataset.v; }
      }));
      $("#styleGo", root).addEventListener("click", () => {
        if (!ans.img) { RQ.toast("Välj den bild som känns mest som hemma."); return; }
        const score = { skandinavisk: 0, minimalistisk: 0, klassisk: 0, mjuk: 0 };
        score[ans.img] += 3; ans.mat.forEach((m) => MATERIALS[m].forEach((s, i) => (score[s] += i ? 0.5 : 1))); (FEEL[ans.feel] || []).forEach((s, i) => (score[s] += i ? 0.5 : 1.5));
        const style = Object.entries(score).sort((a, b) => b[1] - a[1])[0][0];
        S.saveStyle({ style, room: ans.room, materials: ans.mat, feel: ans.feel, source: "quiz" });
        $("#styleOut", root).innerHTML = RQ.styleResult(style, ans.room) + `<div class="ctrl-row" style="margin-top:1.6rem"><a class="btn" href="#mitt-hem">Sparad i Mitt hem</a><a class="btn ghost" href="#studio-stylist">Fråga stylisten</a></div>`;
        RQ.watch(root); $("#styleOut", root).scrollIntoView({ behavior: "smooth", block: "start" });
      });
    },
  });

  /* ---------------------------------------------------------------- Stilanalys */
  function analyse(img) {
    const cv = document.createElement("canvas"); const W = 96, H = Math.max(1, Math.round(96 * img.naturalHeight / img.naturalWidth)); cv.width = W; cv.height = H;
    const cx = cv.getContext("2d", { willReadFrequently: true }); cx.drawImage(img, 0, 0, W, H);
    const d = cx.getImageData(0, 0, W, H).data; const px = [];
    for (let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2]]);
    // k-means, k = 5
    let cs = [0, 0.25, 0.5, 0.75, 0.99].map((f) => px[Math.floor(f * (px.length - 1))].slice());
    let asg = new Array(px.length).fill(0);
    for (let it = 0; it < 10; it++) {
      px.forEach((p, i) => { let b = 0, bd = 1e9; cs.forEach((c, j) => { const dd = dist(p, c); if (dd < bd) { bd = dd; b = j; } }); asg[i] = b; });
      cs = cs.map((c, j) => { const m = px.filter((_, i) => asg[i] === j); if (!m.length) return c; return [0, 1, 2].map((k) => m.reduce((s, p) => s + p[k], 0) / m.length); });
    }
    const counts = cs.map((_, j) => asg.filter((a) => a === j).length);
    const pal = cs.map((c, j) => ({ c, n: counts[j] })).filter((x) => x.n).sort((a, b) => b.n - a.n);
    const avg = [0, 1, 2].map((k) => px.reduce((s, p) => s + p[k], 0) / px.length);
    const [, sat, light] = toHsl(avg);
    const warm = (avg[0] - avg[2]) / 255;
    return { pal, light, sat, warm };
  }
  function describe(a) {
    const bright = a.light > 0.62 ? "ljust" : a.light > 0.42 ? "mellanljust" : "mörkt";
    const temp = a.warm > 0.06 ? "varma" : a.warm < -0.02 ? "svala" : "neutrala";
    const satw = a.sat > 0.28 ? "tydliga färger" : "dova, lugna färger";
    let style = "skandinavisk";
    if (a.light > 0.62 && a.sat < 0.18 && a.warm < 0.08) style = "minimalistisk";
    else if (a.warm > 0.1 && a.light < 0.6) style = "mjuk";
    else if (a.sat > 0.25 || a.light < 0.42) style = "klassisk";
    const mats = []; if (a.warm > 0.05) mats.push("trä"); if (a.light > 0.6) mats.push("kalkade eller ljusa väggar"); if (a.sat < 0.2) mats.push("naturliga textilier som lin"); if (a.warm > 0.1 && a.light < 0.6) mats.push("ull och terrakotta");
    const tips = [];
    if (a.light < 0.45) tips.push("Rummet är ganska mörkt. Lampor med opal- eller textilskärm och en spegel mot fönstret lyfter det.");
    if (a.warm < -0.02) tips.push("Färgerna är svala. Trä, ull eller terrakotta ger värme utan att du behöver måla om.");
    if (a.sat > 0.3) tips.push("Det finns redan mycket färg. Välj lugna, naturliga toner till det nya så att det inte blir för mycket.");
    if (a.light > 0.65 && a.sat < 0.18) tips.push("Ljust och lugnt. Lägg till en mörkare kontrast, till exempel grafit, så att rummet får djup.");
    if (!tips.length) tips.push("Bra balans. Upprepa en av rummets färger i en textil eller kruka för att binda ihop helheten.");
    return { bright, temp, satw, style, mats, tips };
  }
  V.studioAnalysis = () => ({
    title: "Stilanalys · RumIQ Studio",
    html: `<header class="page-head wrap">${crumbs("Stilanalys")}<h1 class="h1">Stilanalys</h1><p class="lead">Ladda upp ett foto av ditt rum. Du får rummets färgpalett, en stil som passar och förslag på vad som skulle lyfta det.</p></header>
      <section class="wrap tool-shell" style="padding-bottom:5rem"><div><div id="anStart">${dropHtml("Lägg till ett foto av rummet")}</div><div id="anOut" hidden></div></div>
        <aside class="panel"><h3 class="h3" style="font-size:1.2rem">Så görs analysen</h3><p class="small" style="margin-top:.6rem">Analysen görs i din webbläsare utifrån färgerna och ljuset i bilden. Den använder ingen AI-tjänst och fotot skickas ingenstans. Den ser alltså färger och ljus, inte föremål.</p></aside></section>`,
    mount(root) {
      return photoInput(root, (im, url) => {
        const a = analyse(im), d = describe(a);
        const pal = a.pal.slice(0, 5).map((x) => rgb2hex(...x.c));
        const matches = RQ.PRODUCTS.map((p) => ({ p, s: Math.min(...p.tone.map(hex2rgb).map((t) => Math.min(...a.pal.slice(0, 5).map((x) => dist(t, x.c))))) - (p.styles.includes(d.style) ? 40 : 0) })).sort((x, y) => x.s - y.s).slice(0, 6).map((x) => x.p);
        S.saveStyle({ style: d.style, palette: pal, source: "analys" });
        $("#anStart", root).hidden = true; const o = $("#anOut", root); o.hidden = false;
        o.innerHTML = `<div class="split" style="align-items:start"><div class="im" style="aspect-ratio:auto"><img src="${url}" alt="Ditt rum" style="height:auto"></div>
          <div><span class="eyebrow">Rummets palett</span><div class="palette">${pal.map((t) => `<i style="background:${t}"><span>${t}</span></i>`).join("")}</div>
          <ul class="facts"><li><span>Ljus</span><span>${d.bright}</span></li><li><span>Färgtemperatur</span><span>${d.temp}</span></li><li><span>Färger</span><span>${d.satw}</span></li><li><span>Stil som passar</span><span>${RQ.STYLES[d.style].name}</span></li><li><span>Material som passar</span><span>${d.mats.join(", ") || "lin, ek och keramik"}</span></li></ul>
          <h3 class="h3" style="margin-top:1.6rem;font-size:1.25rem">Tips för ditt rum</h3><ul class="rules" style="margin-top:.8rem">${d.tips.map((t) => `<li>${t}</li>`).join("")}</ul>
          <div class="ctrl-row" style="margin-top:1.4rem"><button class="chip" type="button" id="anAgain">Prova ett annat foto</button><a class="btn sm" href="#studio-rum">Prova produkter i rummet</a></div></div></div>
          <div class="sec-head" style="margin:3rem 0 1.4rem"><span class="eyebrow">Passar rummets färger</span></div>${RQ.grid(matches, "three")}`;
        $("#anAgain", root).addEventListener("click", () => { $("#anStart", root).hidden = false; o.hidden = true; });
        RQ.watch(root);
      });
    },
  });

  /* ---------------------------------------------------------------- rule-based stylist + smart search */
  const LEX = {
    rooms: { vardagsrum: ["vardagsrum", "soffa", "soffan", "tv", "living", "lounge", "sofa", "couch"], sovrum: ["sovrum", "säng", "sängen", "nattduksbord", "bedroom", "bed", "bedside"], kok: ["kök", "köket", "bänk", "matplats", "middag", "frukost", "kitchen", "dining", "dinner", "breakfast", "worktop"], badrum: ["badrum", "dusch", "handfat", "badrummet", "bathroom", "shower", "sink"], hall: ["hall", "hallen", "entré", "ytterdörr", "hallway", "entrance", "entryway"], hemmakontor: ["kontor", "skrivbord", "jobba", "hemmakontor", "arbetsplats", "office", "desk", "work", "study"], uteliv: ["balkong", "ute", "trädgård", "uteplats", "terrass", "balcony", "outdoor", "outdoors", "garden", "patio", "terrace"] },
    needs: { ljus: ["ljus", "lampa", "lampor", "mörkt", "mörk", "läsa", "läs", "belysning", "kväll", "mysig", "mysigt", "mysigare", "stämning", "light", "lamp", "lamps", "lighting", "dark", "reading", "read", "evening", "cosy", "cozy", "atmosphere"], forvaring: ["förvaring", "rörigt", "stökigt", "ordning", "plats", "organisera", "sladdar", "kablar", "liten", "litet", "storage", "messy", "cluttered", "tidy", "organise", "organize", "cables", "small"], detaljer: ["kalt", "tomt", "tråkigt", "personligt", "personlighet", "detaljer", "inredning", "fint", "färg", "mysig", "mysigt", "mysigare", "varmt", "varmare", "bare", "empty", "boring", "personal", "details", "decor", "colour", "color", "warm", "warmer"], rutiner: ["enklare", "vardag", "morgon", "rutin", "praktiskt", "smidigt", "ladda", "easier", "everyday", "morning", "routine", "practical", "charge", "charging"] },
    cats: { "belysning-atmosfar": ["lampa", "lampor", "ljus", "belysning", "doftljus", "ljusstake", "ljusstakar", "lamp", "lamps", "light", "lighting", "candle", "candles", "candlestick"], "sovrum-komfort": ["pläd", "filt", "ull", "mjuk", "mjukt", "påslakan", "sängkläder", "örngott", "throw", "blanket", "wool", "soft", "bedding", "duvet"], "hem-inredning": ["kudde", "kuddar", "vas", "inredning", "gardin", "gardiner", "matta", "mattor", "cushion", "cushions", "vase", "decor", "curtain", "curtains", "rug"], "kok-matplats": ["burk", "burkar", "bräda", "skärbräda", "kök", "jar", "jars", "board", "kitchen"], "forvaring-organisering": ["korg", "låda", "förvaring", "basket", "box", "storage"], "badrum-valmaende": ["handduk", "handdukar", "tvål", "badrum", "towel", "towels", "soap", "bathroom"], "tavlor-vaggar": ["tavla", "tavlor", "affisch", "affischer", "poster", "konst", "vägg", "väggen", "ram", "art", "print", "wall", "frame"], uteliv: ["kruka", "växt", "ute", "balkong", "pot", "plant", "plants", "balcony"] },
    styles: { skandinavisk: ["skandinavisk", "nordisk", "ljust", "naturligt", "scandinavian", "nordic", "natural"], minimalistisk: ["minimalistisk", "enkelt", "rent", "avskalat", "lugnt", "minimalist", "minimal", "simple", "clean", "calm"], klassisk: ["klassisk", "tidlös", "classic", "timeless"], mjuk: ["mysig", "mysigt", "mysigare", "ombonat", "mjukt", "varmt", "varmare", "cosy", "cozy", "soft", "warm"] },
    colors: { "#A9B39A": ["grön", "salvia", "green", "sage"], "#F2EFE9": ["vit", "vitt", "white"], "#3A3936": ["grafit", "svart", "mörk", "graphite", "black", "dark"], "#B8714A": ["terrakotta", "rost", "terracotta", "rust"], "#D8C6A8": ["beige", "havre", "sand", "oat"], "#B88A5A": ["ek", "trä", "oak", "wood", "wooden"] },
  };
  RQ.parseNeed = (text) => {
    const t = " " + S.norm(text).replace(/[.,!?]/g, " ") + " ";
    const hit = (words) => words.some((w) => t.includes(" " + w + " ") || t.includes(" " + w));
    const pick = (map) => Object.keys(map).filter((k) => hit(map[k]));
    const priceM = t.match(/(?:under|max|högst|mindre än|budget|below|less than|up to)\s*(\d[\d\s]{1,6})/) || t.match(/(\d[\d\s]{1,6})\s*(?:kr|kronor|:-|sek)/);
    return { rooms: pick(LEX.rooms), needs: pick(LEX.needs), cats: pick(LEX.cats), styles: pick(LEX.styles), colors: pick(LEX.colors), max: priceM ? parseInt(priceM[1].replace(/\s/g, ""), 10) : null, gift: hit(["present", "presenter", "ge bort", "inflyttning", "värdinna", "gift", "gifts", "housewarming", "host"]) };
  };
  RQ.rank = (q, max) => RQ.PRODUCTS.filter((p) => priceOk(p, max || q.max)).map((p) => {
    let s = 0; const why = [];
    q.rooms.forEach((r) => { if (p.rooms.includes(r)) { s += 3; why.push("passar i " + RQ.roomById(r).name.toLowerCase()); } });
    q.cats.forEach((c) => { if (p.cat === c) { s += 4; why.push(RQ.catById(c).name.toLowerCase()); } });
    q.needs.forEach((n) => { if (p.needs.includes(n)) { s += 2; why.push(RQ.NEEDS[n].toLowerCase()); } });
    q.styles.forEach((st) => { if (p.styles.includes(st)) { s += 1.5; why.push(RQ.STYLES[st].name.toLowerCase() + " stil"); } });
    q.colors.forEach((c) => { if (p.tone.some((t) => dist(hex2rgb(t), hex2rgb(c)) < 60)) { s += 2; why.push("färgen"); } });
    if (q.gift && p.gift.length) { s += 2; why.push("bra present"); }
    return { p, s, why: [...new Set(why)] };
  }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.p.price - b.p.price);

  const ADVICE = {
    ljus: "Börja med ljuset. Släck taklampan på kvällen och arbeta med två eller tre lampor på olika höjd, med varmvitt ljus runt 2 700 K. En lampa med opal- eller textilskärm sprider ljuset mjukt utan att blända.",
    forvaring: "Ge varje sak en fast plats. Korgar och lådor med mjuka material gör att förvaringen kan stå framme utan att det ser rörigt ut, och tio saker i en korg ser ut som en.",
    detaljer: "Lägg till textur i stället för fler saker: en pläd i ull, kuddar i lin och något i keramik. Tre olika ytor i ett rum, något slätt, något vävt och något mjukt, gör det varmare direkt.",
    rutiner: "Gör det du gör varje dag enklare: en fast plats för laddningen, saker du använder ofta inom räckhåll och samma material i det som står framme.",
  };
  const ROOM_ADVICE = { hall: "I en liten hall gör en spegel stor skillnad, den fångar ljuset och gör utrymmet större. Ge varje person en egen låda för vantar och mössor.", kok: "Ställ fram det du använder dagligen och ställ undan resten. Samma material på lock och brädor gör bänken lugnare.", badrum: "Häll över tvålen i en pump i stengods och välj två handdukstoner som går ihop, till exempel vit och sand.", hemmakontor: "Dölj grenuttaget och ge telefonen en egen plats. Det tar bort det mesta av röran.", sovrum: "Ett lågt, varmt ljus vid sängen och lådor med lock gör sovrummet lugnt även när det inte är städat.", uteliv: "En sladdlös lampa kan följa med ut på kvällen, och terrakotta passar växter som vill torka upp mellan vattningarna.", vardagsrum: "Flytta in möblerna lite från väggarna, tänd lampor på olika höjd och låt en pläd binda ihop soffan med resten av rummet." };
  RQ.stylistAnswer = (text, max) => {
    const q = RQ.parseNeed(text); if (max) q.max = max;
    const parts = [];
    if (q.rooms[0] && ROOM_ADVICE[q.rooms[0]]) parts.push(ROOM_ADVICE[q.rooms[0]]);
    (q.needs.length ? q.needs : ["detaljer"]).slice(0, 2).forEach((n) => parts.push(ADVICE[n]));
    const ranked = RQ.rank(q.needs.length || q.rooms.length || q.cats.length ? q : { ...q, needs: ["detaljer", "ljus"] }).slice(0, 3);
    if (q.max && !ranked.length) parts.push(`Jag hittar inget under ${kr(q.max)} som passar just det här. Prova ett högre maxpris.`);
    return { text: parts.join(" "), picks: ranked.map((x) => x.p) };
  };

  V.studioStylist = () => ({
    title: "AI-stylist · RumIQ Studio",
    html: `<header class="page-head wrap">${crumbs("AI-stylist")}<h1 class="h1">AI-stylist</h1><p class="lead">Beskriv ditt rum och vad du vill förändra. Du får praktiska råd och, när det passar, produkter ur sortimentet.</p></header>
      <section class="wrap tool-shell" style="padding-bottom:5rem">
        <div class="chat"><div class="log" id="log" aria-live="polite"><div class="msg ai">Hej! Vad vill du förändra hemma? Berätta gärna vilket rum det gäller och hur det känns i dag.</div></div>
          <form id="chatForm"><label class="sr" for="chatIn">Din fråga</label><input id="chatIn" type="text" placeholder="Till exempel: mitt vardagsrum känns kalt" autocomplete="off"><button class="btn" type="submit">Fråga</button></form></div>
        <aside><div class="panel"><h3 class="h3" style="font-size:1.2rem">Prova till exempel</h3><div style="display:grid;gap:.5rem;margin-top:1rem">${["Mitt vardagsrum känns kalt, hur gör jag det mysigare?", "Jag behöver mjukare ljus vid läsfåtöljen", "Hur får jag en liten hall att kännas mer ordnad?", "En present till en inflyttning under 500 kr"].map((s) => `<button class="chip" type="button" data-try="${esc(s)}" style="white-space:normal;text-align:left">${esc(s)}</button>`).join("")}</div>
          <label style="margin-top:1.4rem">Högsta pris per produkt (kr, valfritt)<input type="number" id="maxP" min="0" step="50" placeholder="Inget maxpris"></label></div>
          <p class="note">Råden är inspiration, inte verifierade produktuppgifter. I förhandsversionen bygger stylisten på regler och RumIQs sortiment, inte på en AI-tjänst.</p><p class="small" id="chatNote" style="margin-top:.8rem"></p><button class="link" type="button" id="chatClear" style="border:0;background:none;margin-top:.4rem;font-size:.88rem">Rensa samtalet</button></aside>
      </section>`,
    mount(root) {
      const log = $("#log", root), inp = $("#chatIn", root);
      const signed = !!S.customer();
      const load = () => { if (signed) return S.store.get("rumiq-chat-saved", []); try { return JSON.parse(RQ.ss.get("rumiq-chat") || "[]"); } catch (e) { return []; } };
      const save = (h) => (signed ? S.store.set("rumiq-chat-saved", h.slice(-40)) : RQ.ss.set("rumiq-chat", JSON.stringify(h.slice(-40))));
      let hist = load();
      const note = $("#chatNote", root); if (note) note.textContent = signed ? "Du är inloggad, så samtalet sparas i ditt konto. Du kan rensa det när du vill." : "Som gäst finns samtalet bara kvar i den här fliken. Logga in för att spara det.";
      const clr = $("#chatClear", root); if (clr) clr.addEventListener("click", () => { hist = []; save(hist); RQ.router(); });
      const add = (who, html) => { const d = document.createElement("div"); d.className = "msg " + who; d.innerHTML = html; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; };
      const answerHtml = (a) => `${esc(a.text)}${a.picks.length ? `<div class="mini">${a.picks.map((x) => (typeof x === "string" ? RQ.byHandle(x) : x)).filter(Boolean).map((p) => `<a href="#produkt-${p.handle}"><img src="${RQ.img(p, 600)}" alt="">${esc(p.name)}<br><b>${kr(p.price)}</b></a>`).join("")}</div>` : ""}`;
      hist.forEach((m) => add(m.who, m.who === "me" ? esc(m.text) : answerHtml(m.a)));
      const ask = (text) => {
        if (!text.trim()) return;
        add("me", esc(text)); const typing = add("ai", '<span class="typing"><i></i><i></i><i></i></span>');
        const a = RQ.stylistAnswer(text, +$("#maxP", root).value || null);
        setTimeout(() => { typing.innerHTML = answerHtml(a); log.scrollTop = log.scrollHeight; }, 700);
        hist.push({ who: "me", text }, { who: "ai", a: { text: a.text, picks: a.picks.map((p) => p.handle) } });
        save(hist);
      };
      $("#chatForm", root).addEventListener("submit", (e) => { e.preventDefault(); ask(inp.value); inp.value = ""; });
      $$("[data-try]", root).forEach((b) => b.addEventListener("click", () => ask(b.dataset.try)));
    },
  });

  V.studioSearch = () => ({
    title: "Smart sökning · RumIQ Studio",
    html: `<header class="page-head wrap">${crumbs("Smart sökning")}<h1 class="h1">Smart sökning</h1><p class="lead">Beskriv i en mening vad du behöver, med egna ord. Rum, färg, stil och maxpris förstår vi.</p></header>
      <section class="wrap" style="padding-bottom:5rem"><form id="ssForm" class="signup" style="background:var(--natt);max-width:52rem"><label for="ssIn">Vad letar du efter?</label><div class="field"><input id="ssIn" placeholder="Till exempel: något grönt och mjukt till soffan under 300 kr"><button class="btn champ" type="submit">Sök</button></div></form>
        <div class="chips" style="margin-top:1rem">${["Mjukt ljus till sovrummet", "Ordning i hallen under 400 kr", "Något i ek till köket", "Present till en värd"].map((s) => `<button class="chip" type="button" data-ss="${s}">${s}</button>`).join("")}</div>
        <p class="note">I förhandsversionen tolkas meningen med regler mot RumIQs sortiment, inte av en AI-tjänst.</p>
        <div id="ssOut" style="margin-top:2.4rem"></div></section>`,
    mount(root) {
      const run = (text) => {
        const q = RQ.parseNeed(text); const r = RQ.rank(q);
        const understood = [...q.rooms.map((x) => RQ.roomById(x).name), ...q.cats.map((x) => RQ.catById(x).name), ...q.needs.map((x) => RQ.NEEDS[x]), ...q.styles.map((x) => RQ.STYLES[x].name), ...(q.max ? ["Högst " + kr(q.max)] : []), ...(q.gift ? ["Present"] : [])];
        $("#ssOut", root).innerHTML = `${understood.length ? `<p class="eyebrow" style="margin-bottom:.8rem">Det här förstod vi</p><div class="chips" style="margin-bottom:2rem">${understood.map((u) => `<span class="chip on">${esc(u)}</span>`).join("")}</div>` : ""}
          ${r.length ? `<div class="grid three">${r.slice(0, 9).map((x) => RQ.card(x.p).replace("</article>", `<p class="small" style="margin-top:.3rem">Matchar: ${esc(x.why.slice(0, 3).join(", "))}</p></article>`)).join("")}</div>` : `<div class="empty"><h3>Vi hittade inget som matchar</h3><p>Prova att nämna ett rum, en färg eller vad du vill uppnå. Eller fråga stylisten.</p><a class="btn ghost" href="#studio-stylist">Fråga stylisten</a></div>`}`;
      };
      $("#ssForm", root).addEventListener("submit", (e) => { e.preventDefault(); run($("#ssIn", root).value); });
      $$("[data-ss]", root).forEach((b) => b.addEventListener("click", () => { $("#ssIn", root).value = b.dataset.ss; run(b.dataset.ss); }));
    },
  });

  /* ---------------------------------------------------------------- Hitta ditt hemurval */
  V.studioGuide = () => ({
    title: "Hitta ditt hemurval · RumIQ Studio",
    html: `<header class="page-head wrap">${crumbs("Hitta ditt hemurval")}<h1 class="h1">Hitta ditt hemurval</h1><p class="lead">Vad skulle göra hemmet bättre? Välj ett rum och vad du behöver mest, så visar vi passande produkter ur sortimentet.</p></header>
      <section class="wrap quiz" style="padding-bottom:5rem">
        <div class="q"><h3>Vilket rum?</h3><div class="chips" data-q="room">${RQ.ROOMS.map((r) => `<button class="chip" type="button" data-v="${r.id}" aria-pressed="false">${esc(r.name)}</button>`).join("")}</div></div>
        <div class="q"><h3>Vad behöver du mest?</h3><div class="chips" data-q="need">${Object.entries(RQ.NEEDS).map(([k, v]) => `<button class="chip" type="button" data-v="${k}" aria-pressed="false">${v}</button>`).join("")}</div></div>
        <div class="q"><label style="max-width:20rem">Högsta pris per produkt (kr, valfritt)<input type="number" id="gmax" min="0" step="50"></label></div>
        <button class="btn" type="button" id="gGo">Visa mitt hemurval</button><div id="gOut" style="margin-top:2.4rem"></div></section>`,
    mount(root) {
      const a = {};
      $$("[data-q]", root).forEach((g) => g.addEventListener("click", (e) => { const b = e.target.closest("[data-v]"); if (!b) return; $$("[data-v]", g).forEach((x) => x.setAttribute("aria-pressed", x === b)); a[g.dataset.q] = b.dataset.v; }));
      $("#gGo", root).addEventListener("click", () => {
        if (!a.room || !a.need) { RQ.toast("Välj både rum och behov."); return; }
        const max = +$("#gmax", root).value || null; const r = RQ.roomById(a.room);
        let list = RQ.PRODUCTS.filter((p) => p.rooms.includes(a.room) && p.needs.includes(a.need) && priceOk(p, max));
        const extra = RQ.PRODUCTS.filter((p) => !list.includes(p) && p.rooms.includes(a.room) && priceOk(p, max));
        $("#gOut", root).innerHTML = `<div class="result"><span class="eyebrow">${esc(r.name)} · ${RQ.NEEDS[a.need]}</span><h2 style="margin-top:.4rem">Ditt hemurval</h2><p style="margin-top:.6rem">${esc(ADVICE[a.need])}</p></div><div style="margin-top:2rem">${RQ.grid(list.length ? list : extra.slice(0, 6), "three")}</div>${list.length && extra.length ? `<div class="sec-head" style="margin:3rem 0 1.4rem"><span class="eyebrow">Mer för ${esc(r.name.toLowerCase())}</span></div>${RQ.grid(extra.slice(0, 3), "three")}` : ""}`;
        RQ.watch(root);
      });
    },
  });

  /* ---------------------------------------------------------------- Kombinera och matcha */
  const harmony = (ps) => {
    if (ps.length < 2) return { score: 0, text: "Lägg till minst två produkter så ser du hur väl de går ihop." };
    let s = 0, n = 0;
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const shared = ps[i].styles.filter((x) => ps[j].styles.includes(x)).length;
      const td = Math.min(...ps[i].tone.flatMap((a) => ps[j].tone.map((b) => dist(hex2rgb(a), hex2rgb(b)))));
      s += Math.min(1, shared / 2) * 0.6 + Math.max(0, 1 - td / 160) * 0.4; n++;
    }
    const score = Math.round((s / n) * 100);
    const styles = Object.keys(RQ.STYLES).map((k) => [k, ps.filter((p) => p.styles.includes(k)).length]).sort((a, b) => b[1] - a[1]);
    const cats = new Set(ps.map((p) => p.cat));
    const tips = [];
    tips.push(`Looken lutar mot ${RQ.STYLES[styles[0][0]].name.toLowerCase()} stil.`);
    if (!ps.some((p) => p.cat === "belysning-atmosfar")) tips.push("Lägg gärna till en lampa, ljuset är det som får allt annat att synas.");
    if (!ps.some((p) => ["lin", "ull"].some((m) => S.norm(p.material).includes(m)))) tips.push("En textil i lin eller ull gör looken mjukare.");
    if (cats.size === ps.length && ps.length > 3) tips.push("Många olika kategorier. Upprepa ett material, till exempel ek, så hänger det ihop.");
    if (score >= 70) tips.push("Färgerna och stilarna går fint ihop.");
    else if (score < 45) tips.push("Färgerna drar åt olika håll. Byt en sak mot något i samma ton som resten.");
    return { score, text: tips.join(" ") };
  };
  V.studioMix = (start) => {
    let board = start && RQ.byHandle(start) ? [start] : [];
    if (!board.length) board = S.cartLines().map((l) => l.product.handle).filter((h, i, a) => a.indexOf(h) === i).slice(0, 6);
    return {
      title: "Kombinera och matcha · RumIQ Studio",
      html: `<header class="page-head wrap">${crumbs("Kombinera och matcha")}<h1 class="h1">Kombinera och matcha</h1><p class="lead">Bygg en look av upp till sex produkter. Du ser totalpriset, hur väl sakerna går ihop och får stylingråd.</p></header>
        <section class="wrap tool-shell" style="padding-bottom:5rem">
          <div><div class="board" id="board"></div>
            <div class="panel" style="margin-top:1.4rem"><div class="harmony"><span class="eyebrow">Harmoni</span><div class="meter"><i id="hm" style="width:0"></i></div><b id="hmv">0</b></div><p id="advice" style="margin-top:.8rem;color:#4a4741"></p>
              <div class="sum total" style="margin-top:1rem"><span>Totalpris</span><span id="mixTotal">0 kr</span></div>
              <div class="ctrl-row"><button class="btn sm" type="button" id="mixCart">Lägg alla i varukorgen</button><button class="btn ghost sm" type="button" id="mixSave">Spara looken</button><a class="btn ghost sm" id="mixRoom" href="#studio-rum">Se i ditt rum</a></div></div>
            <p class="note">Harmonin räknas utifrån produkternas stil och färger. Stylingråden bygger på regler, inte på en AI-tjänst.</p></div>
          <aside class="panel"><h3 class="h3" style="font-size:1.2rem">Lägg till</h3><input type="search" id="mixSearch" placeholder="Sök i sortimentet" style="margin:1rem 0"><div class="pick" id="mixPick"></div></aside>
        </section>`,
      mount(root) {
        const render = () => {
          const ps = board.map(RQ.byHandle);
          $("#board", root).innerHTML = ps.map((p) => `<div class="slot"><img src="${RQ.img(p, 600)}" alt="${esc(p.name)}"><button class="iconbtn fav" type="button" data-rmb="${p.handle}" aria-label="Ta bort ${esc(p.name)}">${I.close}</button></div>`).join("") + (board.length < 6 ? `<div class="slot">Välj en produkt till höger</div>` : "");
          const h = harmony(ps); $("#hm", root).style.width = h.score + "%"; $("#hmv", root).textContent = h.score; $("#advice", root).textContent = h.text;
          $("#mixTotal", root).textContent = kr(ps.reduce((s, p) => s + p.price, 0));
          $("#mixRoom", root).href = "#studio-rum" + (board[0] ? "-" + board[0] : "");
          const q = S.norm($("#mixSearch", root).value);
          $("#mixPick", root).innerHTML = RQ.PRODUCTS.filter((p) => !q || S.searchText(p).includes(q)).map((p) => `<button type="button" data-h="${p.handle}" aria-pressed="${board.includes(p.handle)}"><img src="${RQ.cut(p)}" alt="" loading="lazy"><span>${esc(p.name)}</span></button>`).join("");
        };
        root.addEventListener("click", (e) => {
          const r = e.target.closest("[data-rmb]"); if (r) { board = board.filter((x) => x !== r.dataset.rmb); render(); return; }
          const b = e.target.closest("#mixPick [data-h]"); if (!b) return;
          const h = b.dataset.h; if (board.includes(h)) board = board.filter((x) => x !== h); else { if (board.length >= 6) { RQ.toast("Max sex produkter i en look."); return; } board.push(h); } render();
        });
        $("#mixSearch", root).addEventListener("input", render);
        $("#mixCart", root).addEventListener("click", () => { if (!board.length) return; board.forEach((h) => S.addToCart(h + "::0", 1)); RQ.toast(`${board.length} produkter i varukorgen. <a href="#" data-open-cart>Visa</a>`); });
        $("#mixSave", root).addEventListener("click", () => { if (board.length < 2) { RQ.toast("Lägg till minst två produkter först."); return; } S.saveLook([...board], "Look " + new Date().toLocaleDateString("sv-SE")); RQ.toast('Looken är sparad. <a href="#mitt-hem">Mitt hem</a>'); });
        render();
      },
    };
  };

  /* ---------------------------------------------------------------- Presentguiden */
  V.giftFinder = () => ({
    title: "Presentguiden · RumIQ",
    html: `<header class="page-head wrap">${RQ.crumbs([["Hem", "hem"], ["Butik", "butik"], ["Presentguiden"]])}<h1 class="h1">Presentguiden</h1><p class="lead">Svara på tre korta frågor och ange ett maxpris, så visar vi passande saker ur sortimentet.</p></header>
      <section class="wrap quiz" style="padding-bottom:5rem">
        <div class="q"><h3>Vem är presenten till?</h3><div class="chips" data-q="for">${Object.entries(RQ.GIFT_FOR).map(([k, v]) => `<button class="chip" type="button" data-v="${k}" aria-pressed="false">${v}</button>`).join("")}</div></div>
        <div class="q"><h3>Tillfället</h3><div class="chips" data-q="occ">${Object.entries(RQ.OCCASIONS).map(([k, v]) => `<button class="chip" type="button" data-v="${k}" aria-pressed="false">${v}</button>`).join("")}</div></div>
        <div class="q"><h3>Mottagarens inredningsstil</h3><div class="chips" data-q="style"><button class="chip" type="button" data-v="" aria-pressed="false">Alla stilar</button><button class="chip" type="button" data-v="skandinavisk" aria-pressed="false">Skandinavisk</button><button class="chip" type="button" data-v="minimalistisk" aria-pressed="false">Minimalistisk</button><button class="chip" type="button" data-v="klassisk" aria-pressed="false">Klassisk</button></div></div>
        <div class="q"><label style="max-width:20rem">Högsta presentpris (kr)<input type="number" id="gfMax" min="0" step="50" value="800"></label></div>
        <button class="btn" type="button" id="gfGo">Hitta en present</button><div id="gfOut" style="margin-top:2.4rem"></div></section>`,
    mount(root) {
      const a = {};
      $$("[data-q]", root).forEach((g) => g.addEventListener("click", (e) => { const b = e.target.closest("[data-v]"); if (!b) return; $$("[data-v]", g).forEach((x) => x.setAttribute("aria-pressed", x === b)); a[g.dataset.q] = b.dataset.v; }));
      $("#gfGo", root).addEventListener("click", () => {
        const max = +$("#gfMax", root).value || null;
        const scored = RQ.PRODUCTS.filter((p) => priceOk(p, max)).map((p) => ({ p, s: (a.for && p.gift.includes(a.for) ? 3 : 0) + (a.occ && p.occ.includes(a.occ) ? 3 : 0) + (a.style && p.styles.includes(a.style) ? 2 : 0) + (p.gift.length ? 1 : 0) })).filter((x) => x.s > 1).sort((x, y) => y.s - x.s);
        $("#gfOut", root).innerHTML = scored.length ? `<p class="eyebrow" style="margin-bottom:1.4rem">${scored.length} förslag${max ? " upp till " + kr(max) : ""}</p>${RQ.grid(scored.slice(0, 9).map((x) => x.p), "three")}` : `<div class="empty"><h3>Inget passar riktigt</h3><p>Prova ett högre maxpris eller ett annat tillfälle.</p></div>`;
        RQ.watch(root);
      });
    },
  });

  /* ---------------------------------------------------------------- Mitt hem */
  V.myHome = () => {
    const projects = S.projects(), wish = S.wishlist(), style = S.style(), looks = S.looks(), arts = S.savedArticles().map(RQ.articleBySlug).filter(Boolean);
    return {
      title: "Mitt hem · RumIQ",
      html: `<header class="page-head wrap">${RQ.crumbs([["Hem", "hem"], ["Mitt hem"]])}<span class="eyebrow" style="display:block;margin-top:1rem">Ditt privata bibliotek</span><h1 class="h1">Mitt hem</h1><p class="lead">Rumsprojekt, Studio-bilder, favoriter och din stil, samlat på ett ställe så att du kan fortsätta där du slutade.</p>
          <div class="chips" style="margin-top:1.6rem"><a class="chip" href="#mh-rum">Rumsprojekt (${projects.length})</a><a class="chip" href="#mh-fav">Favoriter (${wish.length})</a><a class="chip" href="#mh-stil">Min stil</a><a class="chip" href="#mh-looks">Looks (${looks.length})</a><a class="chip" href="#mh-art">Artiklar (${arts.length})</a></div></header>
        <section class="wrap" style="padding-bottom:5rem;display:grid;gap:4rem">
          <div id="mh-rum"><div class="sec-row"><div class="sec-head"><span class="eyebrow">Rumsprojekt</span></div>${projects.length > 1 ? `<button class="chip" type="button" id="cmpBtn">Jämför två sida vid sida</button>` : ""}</div>
            ${projects.length ? `<div class="cols3" id="projects">${projects.map((p) => `<article class="colcard" style="cursor:default"><div class="im" style="aspect-ratio:4/3"><img src="${p.img}" alt="${esc(p.title)}"></div><div class="tx"><label class="check" style="font-size:.85rem;margin-bottom:.6rem"><input type="checkbox" data-cmp="${p.id}"> Välj för jämförelse</label><h3 style="font-size:1.2rem">${esc(p.title)}</h3><p class="small">${new Date(p.at).toLocaleDateString("sv-SE")}</p><label style="margin-top:.8rem">Anteckning<textarea rows="2" data-note="${p.id}">${esc(p.note || "")}</textarea></label><div class="ctrl-row"><a class="btn sm" href="#studio-kombinera-${p.handles[0] || ""}">Handla looken</a><button class="chip" type="button" data-del="${p.id}">Ta bort</button></div></div></article>`).join("")}</div><div id="cmpOut"></div>` : `<div class="empty"><h3>Inga rumsprojekt än</h3><p>Placera produkter i ett foto av ditt rum och spara resultatet här.</p><a class="btn ghost" href="#studio-rum">Se det i ditt rum</a></div>`}</div>
          <div id="mh-fav"><div class="sec-head"><span class="eyebrow">Favoriter</span></div>${wish.length ? RQ.grid(wish) : `<div class="empty"><h3>Inga favoriter än</h3><p>Tryck på hjärtat på en produkt.</p></div>`}</div>
          <div id="mh-stil"><div class="sec-head"><span class="eyebrow">Min stil</span></div>${style ? `<div class="result"><h2>${RQ.STYLES[style.style].name}</h2><p style="margin-top:.5rem">${RQ.STYLES[style.style].text}</p>${style.palette ? `<div class="palette">${style.palette.map((t) => `<i style="background:${t}"></i>`).join("")}</div>` : ""}<p class="small">Från ${style.source === "analys" ? "Stilanalys" : "Hitta min stil"}, ${new Date(style.at).toLocaleDateString("sv-SE")}.</p><div class="ctrl-row"><a class="btn sm" href="#svep">Gör om testet</a><a class="btn ghost sm" href="#studio-stylist">Fråga stylisten</a></div></div>` : `<div class="empty"><h3>Ingen stil sparad än</h3><p>Fyra snabba val ger dig en stil och en palett.</p><a class="btn ghost" href="#svep">Hitta min stil</a></div>`}</div>
          <div id="mh-looks"><div class="sec-head"><span class="eyebrow">Sparade looks</span></div>${looks.length ? looks.map((l) => `<div class="order"><header><b>${esc(l.name)}</b><span class="price" style="font-family:var(--mono)">${kr(l.handles.map(RQ.byHandle).filter(Boolean).reduce((s, p) => s + p.price, 0))}</span></header><div class="board">${l.handles.map(RQ.byHandle).filter(Boolean).map((p) => `<a class="slot" href="#produkt-${p.handle}"><img src="${RQ.img(p, 600)}" alt="${esc(p.name)}"></a>`).join("")}</div><div class="ctrl-row"><a class="btn sm" href="#studio-kombinera-${l.handles[0]}">Öppna</a><button class="chip" type="button" data-dellook="${l.id}">Ta bort</button></div></div>`).join("") : `<div class="empty"><h3>Inga looks än</h3><p>Bygg en look i Kombinera och matcha.</p><a class="btn ghost" href="#studio-kombinera">Kombinera och matcha</a></div>`}</div>
          <div id="mh-art"><div class="sec-head"><span class="eyebrow">Sparade artiklar</span></div>${arts.length ? `<div class="mag-grid">${arts.map(RQ.magCard).join("")}</div>` : `<div class="empty"><h3>Inga sparade artiklar</h3><p>Spara en artikel i magasinet så hamnar den här.</p><a class="btn ghost" href="#magasin">Till magasinet</a></div>`}</div>
          <div class="panel"><h3 class="h3" style="font-size:1.2rem">Dina uppgifter</h3><p class="small" style="margin-top:.5rem">I förhandsversionen sparas allt i Mitt hem bara i den här webbläsaren. Inget skickas till oss. Du kan ta bort allt när du vill.</p><button class="btn ghost sm" type="button" id="clearAll" style="margin-top:1rem">Rensa allt sparat</button></div>
        </section>`,
      mount(root) {
        root.addEventListener("click", (e) => {
          const d = e.target.closest("[data-del]"); if (d) { S.deleteProject(d.dataset.del); RQ.router(); return; }
          const dl = e.target.closest("[data-dellook]"); if (dl) { S.deleteLook(dl.dataset.dellook); RQ.router(); return; }
          const a = e.target.closest("a[href^='#mh-']"); if (a) { e.preventDefault(); document.getElementById(a.getAttribute("href").slice(1)).scrollIntoView({ behavior: "smooth" }); }
        });
        $$("[data-note]", root).forEach((t) => t.addEventListener("change", () => S.updateProject(t.dataset.note, { note: t.value })));
        const cb = $("#cmpBtn", root);
        if (cb) cb.addEventListener("click", () => {
          const ids = $$("[data-cmp]:checked", root).map((x) => x.dataset.cmp); const ps = S.projects();
          const pair = (ids.length === 2 ? ids.map((id) => ps.find((p) => p.id === id)) : ps.slice(0, 2)).filter(Boolean);
          $("#cmpOut", root).innerHTML = `<div class="split" style="margin-top:2rem;align-items:start">${pair.map((p) => `<div><img src="${p.img}" alt="" style="border-radius:var(--r);width:100%"><h3 class="h3" style="font-size:1.15rem;margin-top:.7rem">${esc(p.title)}</h3><p class="small">${esc(p.note || "Ingen anteckning")}</p></div>`).join("")}</div>`;
          $("#cmpOut", root).scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
        let armed = false;
        $("#clearAll", root).addEventListener("click", (e) => { if (!armed) { armed = true; e.currentTarget.textContent = "Klicka igen för att ta bort allt. Det går inte att ångra."; return; } S.clearAll(); RQ.toast("Allt sparat är borttaget."); RQ.router(); });
      },
    };
  };
})();
