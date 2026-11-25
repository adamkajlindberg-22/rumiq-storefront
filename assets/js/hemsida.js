/* RumIQ: Sparat, the customer's home on the site (address mitt-hem), the room sheet and the moodboard.
   One place for everything saved: the rooms first ("Fortsätt där du slutade", big cards with the newest
   after-picture and one next step), then Alla bilder, favourites, style, stylist conversation, looks and
   moodboards, articles. Data: RQ.hem / RQ.vault (hem.js), pictures: RQ.aiLib (ai.js). */
(function () {
  const RQ = window.RQ, S = RQ.shop, $ = RQ.$, $$ = RQ.$$, esc = RQ.esc, kr = S.kr, H = RQ.hem;
  if (!H) return;
  const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const typeName = (t) => (RQ.roomById(t) || {}).name || "Rum";
  const sampleImg = (t) => (RQ.SAMPLE_ROOMS.find((x) => x.id === t) || RQ.SAMPLE_ROOMS[0]).img.replace("-1600", "-900");
  const LIMIT = () => { const c = (window.RQ_CONFIG && window.RQ_CONFIG.studio) || {}; return c.freeImages || 5; };
  const boards = () => S.store.get("rumiq-boards", []).filter((b) => b && b.id && Array.isArray(b.items));
  const saveBoards = (l) => RQ.vault.set("rumiq-boards", l.slice(0, 30));

  /* ------------------------------------------------------------------ the page */
  const styleChips = (cur, attr) => Object.entries(RQ.STYLES).map(([k, s]) => `<button type="button" class="chip" ${attr}="${k}" aria-pressed="${cur === k}">${esc(s.name)}</button>`).join("");
  const typeOpts = (cur) => ["vardagsrum", "sovrum", "kok", "hall", "badrum", "hemmakontor", "uteliv"].map((t) => `<option value="${t}"${t === cur ? " selected" : ""}>${esc(typeName(t))}</option>`).join("");
  const firstRoom = () => `<div class="hem-first" id="hemFirst"><span class="eyebrow">Börja här</span><h3 class="h3">Skapa ditt första rum</h3>
      <p class="lead">Ge rummet ett namn och välj vilket slags rum det är. Allt du gör sedan, bilder, produkter och listor, hamnar där.</p>
      <form class="hem-first-f" id="hemFirstF" novalidate>
        <label>Rummets namn<input name="label" maxlength="40" placeholder="Vardagsrum" autocomplete="off"></label>
        <label>Slags rum<select name="type">${typeOpts("vardagsrum")}</select></label>
        <fieldset class="hem-first-st"><legend>Stil <small>valfritt</small></legend><div class="chips">${styleChips(null, "data-first-style")}</div></fieldset>
        <div class="ai-row"><button class="btn" type="submit" name="go" value="sample">Börja med ett exempelrum</button><button class="btn ghost" type="submit" name="go" value="own">Använd ditt eget foto</button></div>
        <p class="small">${S.customer() ? "" : "Ditt eget foto kräver ett gratis konto. Exempelrummen är fria. "}${RQ.ai && RQ.ai.live && RQ.ai.live() ? "" : `Förhandsvisning: ${LIMIT()} AI-bilder gratis i månaden med konto, när sajten är live.`}</p></form></div>`;
  const benefits = () => S.customer() ? "" : `<ul class="hem-bens" aria-label="Det här får du här">
      <li><b>Före och efter sparas</b><span>Varje AI-bild hamnar i rummet, med bilden före.</span></li>
      <li><b>Lista och budget per rum</b><span>Se vad som är kvar att köpa och vad det kostar.</span></li>
      <li><b>Med dig mellan enheter</b><span>När kontot är aktivt. I dag sparas allt i den här webbläsaren.</span></li></ul>`;
  const roomCard = (r, big) => { const its = H.items(r), m = H.money(r);
    return `<article class="hem-card${big ? " big" : ""}" data-room-card="${esc(r.id)}"><button type="button" class="hem-card-im" data-hem-open="${esc(r.id)}" aria-label="Öppna ${esc(H.name(r))}"><img src="${esc(H.picture(r) || sampleImg(r.type))}" alt="" data-room-pic="${esc(r.id)}" loading="lazy"></button>
      <div class="hem-card-tx"><h3 class="h3"><button type="button" class="hem-card-name" data-hem-open="${esc(r.id)}">${esc(H.name(r))}</button></h3>
        <p class="hem-prog" data-room-prog="${esc(r.id)}">${progHtml(r, 0)}</p>
        <p class="small">${its.length ? `${its.length} ${its.length === 1 ? "produkt" : "produkter"} · ${kr(m.total)}${r.budget ? ` · budget ${kr(r.budget)}` : ""}` : typeName(r.type)}</p>
        <button class="btn${big ? "" : " ghost"} sm" type="button" data-hem-next="${esc(r.id)}">${esc(H.progress(r, 0).next.label)}</button></div></article>`; };
  const progHtml = (r, pics) => H.progress(r, pics).parts.map(([t, ok]) => `<span class="${ok ? "ok" : ""}">${ok ? "✓ " : ""}${esc(t)}</span>`).join("<i aria-hidden=\"true\"> · </i>");
  const chatPart = () => { const h = S.store.get("rumiq-chat-saved", []); const qs = (Array.isArray(h) ? h : []).filter((m) => m && m.who === "me");
    return qs.length ? `<div class="hem-chat"><p><b>${esc(qs[0].text.slice(0, 80))}</b> <span class="small">${qs.length} ${qs.length === 1 ? "fråga" : "frågor"}</span></p><a class="btn ghost sm" href="#studio-stylist">Fortsätt samtalet</a></div>` : ""; };

  RQ.hemPage = () => {
    const rooms = H.rooms().sort((a, b) => ((b.updated || b.at || "") > (a.updated || a.at || "") ? 1 : -1)), wish = S.wishlist(), looks = S.looks(), bs = boards(), arts = S.savedArticles().map(RQ.articleBySlug).filter(Boolean);
    const st0 = S.style(), style = st0 && RQ.STYLES[st0.style] ? st0 : null, aiN = RQ.aiLib ? RQ.aiLib.count() : 0, chat = chatPart();
    const none = (title, text, href, label) => `<div class="mh-none"><p><b>${title}</b> <span>${text}</span></p><a class="link" href="${href}">${label}</a></div>`;
    const parts = [
      ["rum", true, `<a href="#mh-rum">Mina rum (${rooms.length})</a>`, `<div id="mh-rum" class="hem-rooms"><div class="sec-row"><div class="sec-head"><h2 class="h3">${rooms.length ? "Fortsätt där du slutade" : "Mina rum"}</h2></div>${rooms.length ? `<button class="btn ghost sm" type="button" id="hemNew">Nytt rum</button>` : ""}</div>
        ${rooms.length ? `<div class="hem-cards">${rooms.slice(0, 3).map((r) => roomCard(r, true)).join("")}</div>${rooms.length > 3 ? `<div class="hem-cards small">${rooms.slice(3).map((r) => roomCard(r, false)).join("")}</div>` : ""}<div id="hemNewBox" hidden>${firstRoom().replace("Skapa ditt första rum", "Skapa ett nytt rum").replace('<span class="eyebrow">Börja här</span>', "")}</div>` : firstRoom()}
        ${benefits()}${RQ.homeRooms ? RQ.homeRooms.html() : ""}</div>`],
      ["bilder", aiN > 0, RQ.aiLib ? `<a href="#mh-bilder" data-ai-count>Mina rumsbilder (${aiN})</a>` : "", RQ.aiLib ? RQ.aiLib.html() : ""],
      ["fav", wish.length > 0, `<a href="#mh-fav">Produkter (${wish.length})</a>`, `<div id="mh-fav"><div class="sec-row"><div class="sec-head"><h2 class="h3">Produkter</h2></div>${wish.length ? `<span class="mh-favacts"><button class="btn ghost sm" type="button" data-share-wish><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v6h14v-6"/></svg><span>Dela listan</span></button><a class="link" href="#onskelista">Listor per rum</a></span>` : ""}</div>${wish.length ? RQ.grid(wish) : ""}${wish.length && RQ.priceWatch ? RQ.priceWatch.html(wish.map((p) => p.handle), "mhw") : ""}${wish.length ? "" : `${none("Inget sparat än.", "Tryck på hjärtat på en produkt, så hamnar den här.", "#butik", "Till butiken")}${RQ.svepNudge ? RQ.svepNudge() : ""}`}</div>`],
      ["stil", !!style, `<a href="#mh-stil">Min stil</a>`, `<div id="mh-stil"><div class="sec-head"><h2 class="h3">Min stil</h2></div>${style ? `<div class="result"><h2>${RQ.STYLES[style.style].name}</h2><p style="margin-top:.5rem">${RQ.STYLES[style.style].text}</p><p class="small">Uppdaterad ${new Date(style.at).toLocaleDateString("sv-SE")}.</p><div class="ctrl-row"><a class="btn sm" href="#svep">Svep mer</a><a class="btn ghost sm" href="#studio-stil">Fyra snabba val</a></div></div>${H.slot({ type: (rooms[0] || {}).type || "vardagsrum", style: style.style, from: "stil" })}` : none("Ingen stil än.", "Svep tio kort, så får du din stilprofil och ett färdigt rumsförslag.", "#svep", "Svep fram din stil")}</div>`],
      ["chat", !!chat, `<a href="#mh-chat">Stylistsamtal</a>`, `<div id="mh-chat"><div class="sec-head"><h2 class="h3">Stylistsamtal</h2></div>${chat || none("Inget sparat samtal.", "Logga in och fråga stylisten, så sparas samtalet här.", "#studio-stylist", "Fråga stylisten")}</div>`],
      ["looks", looks.length + bs.length > 0, `<a href="#mh-looks">Looks och moodboards (${looks.length + bs.length})</a>`, `<div id="mh-looks"><div class="sec-row"><div class="sec-head"><h2 class="h3">Sparade looks och moodboards</h2></div><button class="btn ghost sm" type="button" data-board-new>Ny moodboard</button></div>
        ${bs.length ? `<div class="hem-boards">${bs.map((b) => `<button type="button" class="hem-board" data-board-open="${esc(b.id)}"><span class="hem-board-ims">${b.items.slice(0, 4).map((it) => RQ.byHandle(it.h) ? `<img src="${RQ.cut(RQ.byHandle(it.h))}" alt="">` : "").join("")}</span><b>${esc(b.name || "Moodboard")}</b><span class="small">${b.items.length} saker${b.room && H.room(b.room) ? ` · ${esc(H.name(H.room(b.room)))}` : ""}</span></button>`).join("")}</div>` : ""}
        ${looks.length ? `<div class="mylooks">${RQ.savedLooksHtml()}</div>` : bs.length ? "" : none("Inga looks än.", "Spara en färdig look, eller gör en moodboard av det du gillar.", "#looks", "Se alla looks")}</div>`],
      ["art", arts.length > 0, `<a href="#mh-art">Artiklar (${arts.length})</a>`, `<div id="mh-art"><div class="sec-head"><h2 class="h3">Sparade artiklar</h2></div>${arts.length ? `<div class="mag-grid">${arts.map(RQ.magCard).join("")}</div>` : none("Inga sparade artiklar.", "Spara en artikel i magasinet, så hamnar den här.", "#magasin", "Till magasinet")}</div>`],
    ];
    const order = [...parts.filter((x) => x[0] === "rum" && rooms.length), ...parts.filter((x) => x[0] === "bilder" && x[1]), ...parts.filter((x) => x[0] !== "rum" && x[0] !== "bilder" && x[1]), ...parts.filter((x) => x[0] === "rum" && !rooms.length), ...parts.filter((x) => x[0] !== "rum" && !x[1])];
    return {
      title: "Sparat · RumIQ",
      html: `<header class="page-head wrap">${RQ.crumbs([["Hem", "hem"], ["Sparat"]])}<span class="eyebrow">Ditt hem</span><h1 class="h1">Sparat</h1><p class="lead">Dina rum, bilderna, det du gillar och din stil, samlat så att du kan fortsätta där du slutade. Allt du sparar här är privat.</p>
          <nav class="jump-nav" aria-label="På sidan">${order.map((x) => x[2]).join("")}</nav></header>
        <section class="wrap mh" style="padding-bottom:5rem;display:grid;gap:3.2rem">
          ${order.map((x) => x[3]).join("\n          ")}
          <div class="panel"><h3 class="h3">Dina uppgifter</h3><p class="small" style="margin-top:.5rem">${RQ.vault.where() === "account" ? "Det du sparar följer med ditt konto. Du kan ta bort allt när du vill." : "I förhandsversionen finns allt du sparat bara i den här webbläsaren. Inget skickas till oss. Du kan ta bort allt när du vill."}</p><button class="btn ghost sm" type="button" id="clearAll" style="margin-top:1rem">Rensa allt sparat</button><p class="small" id="clearNote" role="status" style="margin-top:.6rem"></p></div>
        </section>`,
      mount(root) {
        RQ.homeRooms && RQ.homeRooms.mount(root);
        RQ.aiLib && RQ.aiLib.mount(root);
        // the newest after-picture on each room card, and its progress with the picture count
        if (RQ.aiLib) RQ.aiLib.pics().then((pics) => { H.rooms().forEach((r) => { const mine = pics.filter((p) => p.roomId === r.id), im = $(`[data-room-pic="${r.id}"]`, root), pr = $(`[data-room-prog="${r.id}"]`, root), nx = $(`[data-hem-next="${r.id}"]`, root);
          if (mine[0] && im) { im.src = mine[0].url; im.closest(".hem-card").classList.add("has-pic"); } if (pr) pr.innerHTML = progHtml(r, mine.length); if (nx) nx.textContent = H.progress(r, mine.length).next.label; }); });
        firstForm(root);
        const nw = $("#hemNew", root); if (nw) nw.addEventListener("click", () => { const b = $("#hemNewBox", root); b.hidden = !b.hidden; if (!b.hidden) $("input", b).focus(); });
        root.addEventListener("click", (e) => {
          const o = e.target.closest("[data-hem-open]"); if (o) { e.preventDefault(); openRoom(o.dataset.hemOpen); return; }
          const n = e.target.closest("[data-hem-next]"); if (n) { nextStep(n.dataset.hemNext, n); return; }
          const dl = e.target.closest("[data-dellook]"); if (dl) { S.deleteLook(dl.dataset.dellook); RQ.router(); return; }
        });
        let armed = false;
        $("#clearAll", root).addEventListener("click", (e) => {
          if (!armed) { armed = true; e.currentTarget.textContent = "Tryck igen för att ta bort allt"; $("#clearNote", root).textContent = "Det du har sparat, dina listor, rum och mått, din stil, ditt rumsfoto och dina rumsbilder, samtalet med stylisten, varukorgen och testbeställningarna tas bort från den här webbläsaren, och du loggas ut. Det går inte att ångra."; return; }
          S.clearAll();
          if (RQ.room && RQ.room.clear) RQ.room.clear();
          if (RQ.aiLib) RQ.aiLib.clear();
          ["rumiq-chat-saved", "rumiq-ai-consent", "rumiq-ai-autosave", "rumiq-ai-proj", "rumiq-boards", "rumiq-room-active", "rumiq-sync-at"].forEach((k) => { try { localStorage.removeItem(k); } catch (er) {} });
          ["rumiq-chat", "rumiq-svep-result", "rumiq-svep-two", "rumiq-svep-carry", "rumiq-guide", "rumiq-gift", "rumiq-ord", "rumiq-list"].forEach((k) => { try { sessionStorage.removeItem(k); } catch (er) {} });
          RQ.toast("Allt sparat är borttaget."); RQ.router(); scrollTo(0, 0);
        });
        const want = RQ.ss.get("rumiq-hem-open"); if (want) { RQ.ss.set("rumiq-hem-open", ""); if (H.room(want)) setTimeout(() => openRoom(want), 60); }
        const off = () => document.removeEventListener("rq-hem", again); const again = () => { if (!root.isConnected) return off(); };
        document.addEventListener("rq-hem", again);
        return RQ.jumpSpy($(".jump-nav", root), root);
      },
    };
  };

  // Skapa ditt första rum: name and type first, then a sample room or the own photo (the editor's sign-in gate)
  function firstForm(root) {
    $$(".hem-first-f", root).forEach((f) => {
      let style = null;
      f.addEventListener("click", (e) => { const c = e.target.closest("[data-first-style]"); if (!c) return; style = style === c.dataset.firstStyle ? null : c.dataset.firstStyle; $$("[data-first-style]", f).forEach((b) => b.setAttribute("aria-pressed", b.dataset.firstStyle === style)); });
      f.addEventListener("submit", (e) => {
        e.preventDefault(); const go = (e.submitter && e.submitter.value) || "sample", type = f.type.value;
        const r = H.create({ label: f.label.value || typeName(type), type, style, items: style ? H.propose({ type, style }).items : [] });
        H.openInRoom({ room: r.type, own: go === "own", items: H.items(r), style, project: r.id });
      });
      f.type.addEventListener("change", () => { if (!f.label.value) f.label.placeholder = typeName(f.type.value); });
    });
  }
  function nextStep(id, btn) {
    const r = H.room(id); if (!r) return; RQ.aiLib && RQ.aiLib.pics(id).then((pics) => {
      const nx = H.progress(r, pics.length).next;
      if (nx.act === "see") return H.openInRoom({ room: r.type, items: H.items(r), style: r.style, budget: r.budget, project: r.id });
      if (nx.act === "buy") return RQ.addMany(H.money(r).toBuy.map((it) => it.h + "::" + (it.v || 0)), btn, H.name(r));
      openRoom(id, nx.act);
    });
  }

  /* ------------------------------------------------------------------ the room sheet: everything about one room */
  const sheet = document.createElement("div");
  sheet.className = "sheet ai-sheet hem-sheet"; sheet.id = "hemSheet"; sheet.setAttribute("aria-hidden", "true"); sheet.inert = true;
  sheet.innerHTML = `<div class="sheet-scrim" data-hem-close></div><div class="sheet-in" role="dialog" aria-modal="true" aria-labelledby="hemTitle" tabindex="-1"><div class="sheet-grab" aria-hidden="true"><span></span></div><button class="iconbtn sheet-x" type="button" data-hem-close aria-label="Stäng">${RQ.ICO5 ? RQ.ICO5.x : "×"}</button><div class="hem-body"></div></div>`;
  document.body.appendChild(sheet);
  const sbody = $(".hem-body", sheet), sbox = $(".sheet-in", sheet);
  let sret = null, sid = null, undoRoom = null;
  const sopen = () => { sret = document.activeElement; RQ.closeAll && RQ.closeAll(); sheet.inert = false; sheet.classList.add("open"); sheet.setAttribute("aria-hidden", "false"); document.documentElement.classList.add("sheet-lock"); setTimeout(() => { const f = document.activeElement; if (!sbox.contains(f)) sbox.focus({ preventScroll: true }); }, 40); };
  const sclose = () => { sheet.classList.remove("open"); sheet.setAttribute("aria-hidden", "true"); sheet.inert = true; document.documentElement.classList.remove("sheet-lock"); sid = null; RQ.aiLib && RQ.aiLib.restore(); if (sret && document.contains(sret)) sret.focus({ preventScroll: true }); if (RQ.currentRoute() === "mitt-hem") RQ.router(); };
  sheet.addEventListener("click", (e) => { if (e.target.closest("[data-hem-close]")) sclose(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && sheet.classList.contains("open") && !board.classList.contains("open")) { e.stopPropagation(); sclose(); } }, true);
  const listRows = (r) => { const b = H.boughtSet(r), m = H.money(r);
    return H.items(r).length ? `<ul class="hem-list">${H.items(r).map((it) => { const p = RQ.byHandle(it.h), col = p.variants ? p.variants[it.v || 0] : ""; return `<li${b.has(it.h) ? ' class="done"' : ""}><img src="${RQ.cut(p)}" alt=""><div><b>${esc(p.name)}</b><span>${kr(H.price(it))}${col ? ` · ${esc(col)}` : ""}</span></div><label class="check"><input type="checkbox" data-bought="${p.handle}" ${b.has(it.h) ? "checked" : ""}> Köpt</label></li>`; }).join("")}</ul>
      <div class="hem-money"><span>Totalt <b>${kr(m.total)}</b></span>${m.spent ? `<span>Köpt <b>${kr(m.spent)}</b></span>` : ""}${r.budget ? `<span class="${m.left < 0 ? "over" : ""}">${m.left < 0 ? "Över budget" : "Kvar av budgeten"} <b>${kr(Math.abs(m.left))}</b></span>` : ""}</div>
      ${m.toBuy.length ? `<button class="btn" type="button" id="hemBuyRest">Köp det som är kvar · ${kr(m.toBuy.reduce((s, it) => s + H.price(it), 0))}</button>` : `<p class="small">Allt i listan är köpt.</p>`}` : `<p class="small">Inga produkter i rummet än. Se förslaget nedan, eller ställ in saker i Mitt rum.</p>`; };
  const fbHtml = (r) => (r.feedback || []).length ? `<div class="hem-fb"><h3 class="h3">Vad andra tycker</h3>${r.feedback.map((f) => `<p><b>${esc(f.name || "Någon")}</b>: ${Object.entries(f.answers).filter(([h]) => RQ.byHandle(h)).map(([h, v]) => `${esc(RQ.byHandle(h).name)} ${v ? "gillar" : "vill ha något annat"}`).join(", ")}.</p>`).join("")}</div>` : "";
  function openRoom(id, focus) {
    const r = H.room(id); if (!r) return; sid = id; H.setActive(id);
    const bs = boards().filter((b) => b.room === id);
    sbody.innerHTML = `<div class="hem-room">
      <div class="hem-room-h"><span class="eyebrow">${esc(typeName(r.type))}</span><h2 id="hemTitle" class="ai-h">${esc(H.name(r))}</h2><p class="hem-prog" id="hemProg">${progHtml(r, 0)}</p>
        <div class="ai-row"><button class="btn" type="button" id="hemSee">${RQ.roomIco}<span>Se det i ditt rum</span></button><button class="btn ghost" type="button" id="hemAsk">Vad tycker du?</button></div></div>
      <section class="hem-sec"><h3 class="h3">Bilder</h3><div class="ai-lib-list" id="hemPics" aria-busy="true"></div></section>
      <section class="hem-sec" id="hemListSec"><h3 class="h3">Inköpslista</h3><div id="hemList">${listRows(r)}</div></section>
      ${fbHtml(r)}
      <section class="hem-sec" id="hemPropSec">${H.slot({ type: r.type, style: r.style, budget: r.budget, room: r.id, from: "room" })}</section>
      <section class="hem-sec"><div class="sec-row"><h3 class="h3">Moodboards</h3><button class="btn ghost sm" type="button" data-board-new="${esc(id)}">Ny moodboard</button></div>${bs.length ? `<div class="hem-boards">${bs.map((b) => `<button type="button" class="hem-board" data-board-open="${esc(b.id)}"><span class="hem-board-ims">${b.items.slice(0, 4).map((it) => RQ.byHandle(it.h) ? `<img src="${RQ.cut(RQ.byHandle(it.h))}" alt="">` : "").join("")}</span><b>${esc(b.name || "Moodboard")}</b></button>`).join("")}</div>` : `<p class="small">Samla saker fritt, utan rum, och prova dem sedan här.</p>`}</section>
      <section class="hem-sec"><h3 class="h3">Om rummet</h3><form class="hem-room-f" id="hemRoomF" novalidate>
        <label>Namn<input name="label" maxlength="40" value="${esc(r.label || "")}"></label>
        <label>Slags rum<select name="type">${typeOpts(r.type)}</select></label>
        <fieldset id="hemStyle"><legend>Stil</legend><div class="chips">${styleChips(r.style, "data-room-style")}</div></fieldset>
        <label>Budget, kr<input name="budget" inputmode="numeric" value="${r.budget || ""}" placeholder="5000"></label>
        <label>Material du gillar<input name="material" maxlength="60" value="${esc(r.material || "")}" placeholder="Ek, lin, keramik"></label>
        <div class="hem-cols-f"><span>Färger i rummet</span><div class="hem-cols" role="img" aria-label="Färgerna i rummet">${[...new Set(H.items(r).map((it) => RQ.byHandle(it.h).tone[it.v || 0] || RQ.byHandle(it.h).tone[0]))].slice(0, 6).map((c) => `<i style="background:${esc(c)}"></i>`).join("") || `<small>Kommer från produkterna du väljer.</small>`}</div></div>
        <label class="wide">Anteckningar<textarea name="notes" rows="3" maxlength="500">${esc(r.notes || "")}</textarea></label>
        <p class="small wide">${RQ.homeRooms && RQ.homeRooms.dims(r) ? `Mått: ${esc(RQ.homeRooms.dims(r))}.` : "Måtten lägger du in under Mått för dina rum på sidan."} Allt sparas medan du skriver.</p></form></section>
      <p class="hem-room-foot"><button class="tlink" type="button" id="hemDel">Ta bort rummet</button></p></div>`;
    sopen();
    RQ.aiLib && RQ.aiLib.mountInto($("#hemPics", sbody), id);
    RQ.aiLib && RQ.aiLib.pics(id).then((p) => { const g = $("#hemProg", sbody); if (g) g.innerHTML = progHtml(H.room(id) || r, p.length); });
    const f = $("#hemRoomF", sbody);
    const save = () => { const x = H.room(id); if (!x) return; const n = Math.round(+String(f.budget.value).replace(/\s/g, "")); H.patch(id, { label: f.label.value.trim().slice(0, 40) || typeName(f.type.value), type: f.type.value, budget: n > 0 ? n : null, material: f.material.value.trim(), notes: f.notes.value.trim() }); $("#hemTitle", sbody).textContent = H.name(H.room(id)); };
    f.addEventListener("input", () => { clearTimeout(f._t); f._t = setTimeout(save, 350); });
    f.addEventListener("change", save);
    f.addEventListener("click", (e) => { const c = e.target.closest("[data-room-style]"); if (!c) return; const x = H.room(id), v = x.style === c.dataset.roomStyle ? null : c.dataset.roomStyle; H.patch(id, { style: v }); $$("[data-room-style]", f).forEach((b) => b.setAttribute("aria-pressed", b.dataset.roomStyle === v)); });
    f.addEventListener("submit", (e) => e.preventDefault());
    sbody.addEventListener("change", (e) => { const c = e.target.closest("[data-bought]"); if (!c) return; const x = H.room(id), b = { ...(x.bought || {}) }; if (c.checked) b[c.dataset.bought] = new Date().toISOString(); else delete b[c.dataset.bought]; H.patch(id, { bought: b }); $("#hemList", sbody).innerHTML = listRows(H.room(id)); const again = $(`[data-bought="${c.dataset.bought}"]`, sbody); if (again) again.focus({ preventScroll: true }); });
    sbody.addEventListener("click", (e) => {
      if (e.target.closest("#hemBuyRest")) { const x = H.room(id); RQ.addMany(H.money(x).toBuy.map((it) => it.h + "::" + (it.v || 0)), e.target.closest("button"), H.name(x)); return; }
      if (e.target.closest("#hemSee")) { const x = H.room(id); if (!H.items(x).length) { const pr = H.propose({ type: x.type, style: x.style, budget: x.budget }); H.patch(id, { items: pr.items }); } const y = H.room(id); sheet.classList.remove("open"); sclose(); H.openInRoom({ room: y.type, items: H.items(y), style: y.style, budget: y.budget, project: id }); return; }
      if (e.target.closest("#hemAsk")) { H.askLink(H.room(id), e.target.closest("button")); return; }
      if (e.target.closest("#hemDel")) { const gone = H.remove(id); undoRoom = gone; sclose(); RQ.toast(`${esc(H.name(gone))} är borttaget. <button type="button" class="tlink" data-hem-undo>Ångra</button>`, 7000); }
    });
    if (focus === "style") setTimeout(() => $("#hemStyle .chip", sbody).focus(), 80);
    if (focus === "budget") setTimeout(() => f.budget.focus(), 80);
    if (focus === "propose") setTimeout(() => { $("#hemPropSec", sbody).scrollIntoView({ block: "start", behavior: calm() ? "auto" : "smooth" }); }, 80);
  }
  RQ.hem.openRoom = openRoom;
  document.addEventListener("click", (e) => { if (e.target.closest("[data-hem-undo]") && undoRoom) { H.restore(undoRoom); undoRoom = null; $("#toast").classList.remove("show"); RQ.toast("Rummet är tillbaka."); if (RQ.currentRoute() === "mitt-hem") RQ.router(); } });

  /* ------------------------------------------------------------------ moodboard: a free board without a room photo */
  const board = document.createElement("div");
  board.className = "sheet ai-sheet hem-sheet mb-sheet"; board.id = "mbSheet"; board.setAttribute("aria-hidden", "true"); board.inert = true;
  board.innerHTML = `<div class="sheet-scrim" data-mb-close></div><div class="sheet-in" role="dialog" aria-modal="true" aria-labelledby="mbTitle" tabindex="-1"><div class="sheet-grab" aria-hidden="true"><span></span></div><button class="iconbtn sheet-x" type="button" data-mb-close aria-label="Stäng">${RQ.ICO5 ? RQ.ICO5.x : "×"}</button><div class="mb-body"></div></div>`;
  document.body.appendChild(board);
  const mbody = $(".mb-body", board), mbox = $(".sheet-in", board);
  let justDragged = false, B = null, sel = null, mret = null, addOpen = false, addTab = "fav", addQ = "";
  const mopen = () => { mret = document.activeElement; board.inert = false; board.classList.add("open"); board.setAttribute("aria-hidden", "false"); document.documentElement.classList.add("sheet-lock"); setTimeout(() => { if (!mbox.contains(document.activeElement)) mbox.focus({ preventScroll: true }); }, 40); };
  const mclose = () => { board.classList.remove("open"); board.setAttribute("aria-hidden", "true"); board.inert = true; if (!sheet.classList.contains("open")) document.documentElement.classList.remove("sheet-lock"); if (mret && document.contains(mret)) mret.focus({ preventScroll: true }); if (RQ.currentRoute() === "mitt-hem" && !sheet.classList.contains("open")) RQ.router(); };
  board.addEventListener("click", (e) => { if (e.target.closest("[data-mb-close]")) mclose(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && board.classList.contains("open")) { e.stopPropagation(); mclose(); } }, true);
  // neat start: a loose grid, larger things first
  const autoLayout = (items) => { const n = items.length, cols = n <= 1 ? 1 : n <= 4 ? 2 : 3, rows = Math.ceil(n / cols), w = Math.min(28, (cols === 1 ? 34 : cols === 2 ? 20 : 16) * (rows > 2 ? 0.8 : 1)); // tall cut-outs stay inside their cell
    return items.map((it, i) => ({ ...it, x: Math.round((100 / cols) * ((i % cols) + 0.5)), y: Math.round((100 / rows) * (Math.floor(i / cols) + 0.5)), w, z: i })); };
  const tones = () => [...new Set(B.items.map((it) => { const p = RQ.byHandle(it.h); return p && (p.tone[it.v || 0] || p.tone[0]); }).filter(Boolean))].slice(0, 6);
  const mbItems = () => B.items.filter((it) => RQ.byHandle(it.h)).map((it, i) => { const p = RQ.byHandle(it.h); return `<button type="button" class="mb-it${sel === i ? " on" : ""}" data-mb-i="${i}" style="left:${it.x}%;top:${it.y}%;width:${it.w}%;z-index:${it.z || 0}" aria-label="${esc(p.name)}" aria-pressed="${sel === i}"><img src="${RQ.cut(p)}" alt="" draggable="false"></button>`; }).join("");
  const addList = () => { const q = S.norm ? S.norm(addQ) : addQ.toLowerCase(); let ps = addTab === "fav" ? S.wishlist() : addTab === "look" ? [...new Set((RQ.LOOKS || []).flatMap((l) => l.items))].map(RQ.byHandle).filter(Boolean) : RQ.PRODUCTS;
    if (q) ps = ps.filter((p) => (S.searchText ? S.norm(S.searchText(p)) : p.name.toLowerCase()).includes(q));
    return ps.length ? ps.slice(0, 24).map((p) => `<button type="button" class="mb-add-it" data-mb-add="${p.handle}" aria-label="Lägg till ${esc(p.name)}"${B.items.some((it) => it.h === p.handle) ? ' aria-pressed="true"' : ""}><img src="${RQ.cut(p)}" alt=""><span>${esc(p.name)}</span></button>`).join("") : `<p class="small">${addTab === "fav" && !q ? "Inget sparat än. Välj Alla för hela sortimentet." : "Inget hittades."}</p>`; };
  const mpaint = (focusSel) => {
    const room = B.room && H.room(B.room), sp = sel != null ? B.items[sel] : null;
    mbody.innerHTML = `<div class="mb-wrap"><div class="mb-head"><span class="eyebrow">Moodboard${room ? ` · ${esc(H.name(room))}` : ""}</span><label class="mb-name"><span class="sr">Namn</span><input id="mbName" maxlength="40" value="${esc(B.name || "")}" placeholder="Min moodboard"></label><h2 id="mbTitle" class="sr">Moodboard</h2></div>
      <div class="mb-board" id="mbBoard">${mbItems()}${B.items.length ? "" : `<p class="mb-empty">Lägg till saker du gillar. Flytta dem, ändra storlek och lägg dem i lager.</p>`}
        ${tones().length ? `<div class="mb-tones" role="img" aria-label="Färgerna på tavlan">${tones().map((c) => `<i style="background:${esc(c)}"></i>`).join("")}</div>` : ""}${B.note ? `<p class="mb-note">${esc(B.note)}</p>` : ""}</div>
      <div class="mb-tools" role="toolbar" aria-label="Verktyg">${sp ? `<b class="mb-selname">${esc(RQ.byHandle(sp.h).name)}</b><button class="btn ghost sm" type="button" data-mb-do="smaller" aria-label="Mindre">−</button><button class="btn ghost sm" type="button" data-mb-do="bigger" aria-label="Större">+</button><button class="btn ghost sm" type="button" data-mb-do="front">Fram</button><button class="btn ghost sm" type="button" data-mb-do="back">Bak</button><button class="btn ghost sm" type="button" data-mb-do="remove">Ta bort</button><button class="tlink" type="button" data-mb-do="deselect">Klar</button>`
        : `<button class="btn sm" type="button" data-mb-do="add" aria-expanded="${addOpen}">Lägg till</button>${B.items.length > 1 ? `<button class="btn ghost sm" type="button" data-mb-do="auto">Ordna snyggt</button>` : ""}`}</div>
      ${addOpen && !sp ? `<div class="mb-add"><div class="chips" role="group" aria-label="Var ifrån?">${[["fav", "Sparat"], ["look", "Från looks"], ["all", "Alla"]].map(([k, l]) => `<button type="button" class="chip" data-mb-tab="${k}" aria-pressed="${addTab === k}">${l}</button>`).join("")}</div><label class="mb-q"><span class="sr">Sök</span><input id="mbQ" type="search" value="${esc(addQ)}" placeholder="Sök i sortimentet"></label><div class="mb-add-list">${addList()}</div></div>` : ""}
      <label class="mb-notef">Anteckning<textarea id="mbNote" rows="2" maxlength="200" placeholder="Varför gillar du det här?">${esc(B.note || "")}</textarea></label>
      <div class="ai-row mb-acts"><button class="btn" type="button" data-mb-do="try" ${B.items.length ? "" : "disabled"}>${RQ.roomIco}<span>Prova i ett rum</span></button><button class="btn ghost" type="button" data-mb-do="save" ${B.items.length ? "" : "disabled"}>Spara som look</button><button class="btn ghost" type="button" data-mb-do="share" ${B.items.length ? "" : "disabled"}>Dela</button></div>
      <p class="small" role="status" id="mbMsg">Sparas medan du arbetar. ${H.PROMISE}</p></div>`;
    wireBoard();
    if (focusSel) { const f = $(focusSel, mbody); if (f) f.focus({ preventScroll: true }); }
  };
  const persist = () => { B.at = new Date().toISOString(); const l = boards().filter((b) => b.id !== B.id); saveBoards([B, ...l]); if (B.room) { const r = H.room(B.room); if (r && !(r.boards || []).includes(B.id)) H.patch(B.room, { boards: [...(r.boards || []), B.id] }); } };
  function wireBoard() {
    const bd = $("#mbBoard", mbody);
    $("#mbName", mbody).addEventListener("input", (e) => { B.name = e.target.value.slice(0, 40); persist(); });
    $("#mbNote", mbody).addEventListener("change", (e) => { B.note = e.target.value.trim().slice(0, 200); persist(); const bd2 = $("#mbBoard", mbody); let nt = $(".mb-note", bd2); if (!B.note) { if (nt) nt.remove(); return; } if (!nt) { nt = document.createElement("p"); nt.className = "mb-note"; bd2.appendChild(nt); } nt.textContent = B.note; }); // the note on the board, without drawing the field again
    const q = $("#mbQ", mbody); if (q) q.addEventListener("input", () => { addQ = q.value; $(".mb-add-list", mbody).innerHTML = addList(); });
    // drag: a pointer moves the thing (in % of the board), arrows move the chosen one
    $$(".mb-it", bd).forEach((el) => {
      el.addEventListener("pointerdown", (e) => { const i = +el.dataset.mbI, r = bd.getBoundingClientRect(), it = B.items[i], sx = e.clientX, sy = e.clientY, x0 = it.x, y0 = it.y; let moved = false;
        el.setPointerCapture(e.pointerId);
        const mv = (ev) => { const dx = (ev.clientX - sx) / r.width * 100, dy = (ev.clientY - sy) / r.height * 100; if (Math.abs(dx) + Math.abs(dy) > 1) moved = true; it.x = Math.max(4, Math.min(96, x0 + dx)); it.y = Math.max(4, Math.min(96, y0 + dy)); el.style.left = it.x + "%"; el.style.top = it.y + "%"; };
        const up = () => { el.removeEventListener("pointermove", mv); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up); if (moved) { justDragged = true; setTimeout(() => (justDragged = false), 50); persist(); sel = i; mpaint(`[data-mb-i="${i}"]`); } };
        el.addEventListener("pointermove", mv); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up); });
      el.addEventListener("click", () => { if (justDragged) return; const i = +el.dataset.mbI; sel = sel === i ? null : i; mpaint(`[data-mb-i="${i}"]`); });
      el.addEventListener("keydown", (e) => { const i = +el.dataset.mbI, it = B.items[i], k = { ArrowLeft: [-2, 0], ArrowRight: [2, 0], ArrowUp: [0, -2], ArrowDown: [0, 2] }[e.key]; if (!k) return; e.preventDefault(); const m = e.shiftKey ? 3 : 1; it.x = Math.max(4, Math.min(96, it.x + k[0] * m)); it.y = Math.max(4, Math.min(96, it.y + k[1] * m)); persist(); sel = i; mpaint(`[data-mb-i="${i}"]`); });
    });
  }
  mbody.addEventListener("click", (e) => {
    const t = e.target.closest("[data-mb-tab]"); if (t) { addTab = t.dataset.mbTab; mpaint(`[data-mb-tab="${addTab}"]`); return; }
    const a = e.target.closest("[data-mb-add]"); if (a) { const h = a.dataset.mbAdd, i = B.items.findIndex((it) => it.h === h);
      if (i > -1) B.items.splice(i, 1); else B.items.push({ h, v: 0, x: 50, y: 50, w: 28, z: B.items.length });
      if (i < 0 && B.items.length <= 6) B.items = autoLayout(B.items); persist(); mpaint(`[data-mb-add="${h}"]`); return; }
    const d = e.target.closest("[data-mb-do]"); if (!d) return; const act = d.dataset.mbDo, it = sel != null ? B.items[sel] : null;
    if (act === "add") { addOpen = !addOpen; mpaint('[data-mb-do="add"]'); return; }
    if (act === "auto") { B.items = autoLayout(B.items); persist(); mpaint('[data-mb-do="auto"]'); return; }
    if (act === "deselect") { const i = sel; sel = null; mpaint(`[data-mb-i="${i}"]`); return; }
    if (it && act === "smaller") { it.w = Math.max(10, it.w - 4); persist(); mpaint('[data-mb-do="smaller"]'); return; }
    if (it && act === "bigger") { it.w = Math.min(70, it.w + 4); persist(); mpaint('[data-mb-do="bigger"]'); return; }
    if (it && act === "front") { it.z = Math.max(...B.items.map((x) => x.z || 0)) + 1; persist(); mpaint('[data-mb-do="front"]'); return; }
    if (it && act === "back") { it.z = Math.min(...B.items.map((x) => x.z || 0)) - 1; persist(); mpaint('[data-mb-do="back"]'); return; }
    if (it && act === "remove") { B.items.splice(sel, 1); sel = null; persist(); mpaint('[data-mb-do="add"]'); return; }
    if (act === "save") { S.saveLook(B.items.map((x) => x.h), B.name || "Min moodboard"); persist(); $("#mbMsg", mbody).innerHTML = `Sparad som look i Sparat. <a href="#mitt-hem" data-mb-close>Visa</a>`; return; }
    if (act === "share") { shareBoard(d); return; }
    if (act === "try") { const r = B.room && H.room(B.room); mclose(); sheet.classList.contains("open") && sclose(); H.openInRoom({ room: r ? r.type : "vardagsrum", items: B.items.map((x) => ({ h: x.h, v: x.v || 0 })), project: r ? r.id : null }); }
  });
  // one picture of the board (with its colours and note) and a link to the same things
  async function shareBoard(btn) {
    btn.disabled = true;
    try {
      const W = 1200, Hh = 900, cv = document.createElement("canvas"); cv.width = W; cv.height = Hh; const cx = cv.getContext("2d");
      cx.fillStyle = "#F4F2EE"; cx.fillRect(0, 0, W, Hh);
      const ims = await Promise.all(B.items.map((it) => new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = RQ.cut(RQ.byHandle(it.h)); })));
      B.items.map((it, i) => [it, ims[i]]).sort((a, b) => (a[0].z || 0) - (b[0].z || 0)).forEach(([it, im]) => { if (!im) return; const w = W * it.w / 100, h = w * im.naturalHeight / im.naturalWidth; cx.drawImage(im, W * it.x / 100 - w / 2, (Hh - 120) * it.y / 100 - h / 2, w, h); });
      tones().forEach((c, i) => { cx.fillStyle = c; cx.beginPath(); cx.arc(60 + i * 64, Hh - 60, 24, 0, 7); cx.fill(); });
      cx.fillStyle = "#22252A"; cx.font = '600 30px "Familjen Grotesk", system-ui'; cx.fillText((B.name || "Min moodboard").slice(0, 40), 60 + tones().length * 64 + 20, Hh - 70);
      cx.font = '400 22px "Familjen Grotesk", system-ui'; cx.fillText("RumIQ · " + H.PROMISE, 60 + tones().length * 64 + 20, Hh - 38);
      const blob = await new Promise((ok) => cv.toBlob(ok, "image/jpeg", 0.9)), url = new URL("delad/", document.baseURI).href + "#delad-" + RQ.sharedList.enc(B.items.map((x) => x.h), "");
      const file = new File([blob], "rumiq-moodboard.jpg", { type: "image/jpeg" });
      if (navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: B.name || "Moodboard", text: `${B.name || "Min moodboard"} på RumIQ: ${url}` }); } catch (e) { if (e && e.name !== "AbortError") throw e; } }
      else { const u = URL.createObjectURL(blob), a = document.createElement("a"); a.href = u; a.download = "rumiq-moodboard.jpg"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
        try { await navigator.clipboard.writeText(url); } catch (e) {} $("#mbMsg", mbody).textContent = "Bilden är nedladdad och länken till sakerna är kopierad."; }
    } catch (e) { RQ.toast("Moodboarden gick inte att dela just nu."); }
    finally { if (btn.isConnected) btn.disabled = false; }
  }
  RQ.hem._openBoard = (id, preset = {}) => {
    const old = id && boards().find((b) => b.id === id);
    B = old ? JSON.parse(JSON.stringify(old)) : { id: "mb" + Date.now().toString(36), name: preset.name || "", room: preset.room || null, items: autoLayout((preset.items || []).slice(0, 12).map((h) => ({ h, v: 0 }))), note: "", at: new Date().toISOString() };
    if (!old && B.items.length) persist();
    sel = null; addOpen = !B.items.length; addTab = S.wishlist().length ? "fav" : "all"; addQ = ""; mpaint(); mopen();
  };
  // leaving for Mitt rum: the sheets step aside without drawing the page again
  document.addEventListener("rq-hem-go", () => { if (board.classList.contains("open")) { board.classList.remove("open"); board.inert = true; board.setAttribute("aria-hidden", "true"); } if (sheet.classList.contains("open")) { sheet.classList.remove("open"); sheet.inert = true; sheet.setAttribute("aria-hidden", "true"); sid = null; RQ.aiLib && RQ.aiLib.restore(); } document.documentElement.classList.remove("sheet-lock"); });
})();
