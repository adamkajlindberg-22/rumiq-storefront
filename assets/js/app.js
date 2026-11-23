/* RumIQ app: shell, router and shop pages. Plain JavaScript, no build step.
   Routes are plain hash names (#butik, #produkt-<handle>) so links work everywhere,
   including the preview, and a page can be bookmarked. */
(function () {
  const RQ = window.RQ, S = RQ.shop;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const kr = S.kr;
  RQ.$ = $; RQ.$$ = $$; RQ.esc = esc;

  /* ---------------------------------------------------------------- icons */
  const I = {
    heart: '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
    bag: '<svg viewBox="0 0 24 24"><path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
    user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    cmp: '<svg viewBox="0 0 24 24"><path d="M8 4v16M16 4v16M4 8h8M12 16h8"/></svg>',
    spark: '<svg viewBox="0 0 24 24"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18"/></svg>',
    room: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 15l5-4 4 3 3-2 6 4"/></svg>',
    eye: '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    palette: '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-1.5-1-2.5 1-1.5 2-1.5h2a4 4 0 0 0 4-4c0-4.4-4-8-9-8z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/></svg>',
    chat: '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4V5z"/></svg>',
    grid: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg>',
    gift: '<svg viewBox="0 0 24 24"><rect x="4" y="9" width="16" height="11" rx="1"/><path d="M3 9h18M12 9v11M12 9c-2-4-6-4-6-1.5S10 9 12 9c2 0 6-.5 6-1.5S14 5 12 9z"/></svg>',
    home: '<svg viewBox="0 0 24 24"><path d="M4 11l8-6 8 6v9H4z"/><path d="M10 20v-5h4v5"/></svg>',
    compass: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/></svg>',
    upload: '<svg viewBox="0 0 24 24"><path d="M12 15V4M7.5 8.5L12 4l4.5 4.5"/><path d="M4 15v4h16v-4"/></svg>',
  };
  RQ.I = I;

  /* ---------------------------------------------------------------- small UI */
  let toastT;
  RQ.toast = (html) => {
    const t = $("#toast"); t.innerHTML = html; t.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 3600);
  };
  const swatches = (p) => (p.variants ? `<span class="swatches" role="img" aria-label="${p.variants.length} färger">${p.tone.slice(0, p.variants.length).map((c) => `<i style="background:${c}"></i>`).join("")}</span>` : "");
  const plus = '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>';
  RQ.plus = plus;
  const roomIco = '<svg viewBox="0 0 24 24"><path d="M3.5 20V10l8.5-6 8.5 6v10"/><path d="M9 20v-5.5h6V20"/></svg>';
  RQ.roomIco = roomIco;
  RQ.card = (p) => {
    const R = RQ.room, on = R && R.mode(), m = on ? R.match(p) : null;
    const ph = on ? `${R.layer(p)}<img class="hov fade" src="${RQ.img(p, 600)}" alt="" loading="lazy" decoding="async">`
      : `<img class="fade" src="${RQ.img(p, 600)}" srcset="${RQ.img(p, 600)} 600w, ${RQ.img(p, 900)} 900w" sizes="(max-width:640px) 50vw, (max-width:1100px) 33vw, 25vw" alt="${esc(p.name)}" loading="lazy" decoding="async" width="600" height="750"><img class="hov fade" src="assets/img/d/${p.handle}-600.webp" alt="" loading="lazy" decoding="async" onerror="this.remove()">`;
    return `
    <article class="card${on ? " in-room" : ""}" style="--tone:${p.tone[0]}22">
      <a class="ph" href="#produkt-${p.handle}" tabindex="-1" aria-hidden="true">${ph}</a>
      <button class="iconbtn fav" type="button" data-wish="${p.handle}" aria-pressed="${S.isWished(p.handle)}" aria-label="Spara ${esc(p.name)} i önskelistan">${I.heart}</button>
      <button class="iconbtn rbtn" type="button" data-room-btn="${p.handle}" aria-pressed="${!!(R && R.inScene(p.handle))}" aria-label="Ställ in ${esc(p.name)} i mitt rum">${roomIco}</button>
      <button class="qadd" type="button" data-add="${p.handle}::0" aria-label="Lägg ${esc(p.name)} i varukorgen">${plus}<span>Lägg till</span></button>
      <button class="qv" type="button" data-sheet="${p.handle}" aria-label="Snabbtitt på ${esc(p.name)}"><svg viewBox="0 0 24 24"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/></svg><span>Snabbtitt</span></button>
      <div class="ct"><h3><a href="#produkt-${p.handle}">${esc(p.name)}</a></h3>${RQ.priceHtml(p, "card")}</div>
      <p class="sub">${m ? `<span class="fm" title="Hur väl produktens färger passar ditt rum">${m} % färgmatch</span>` : swatches(p)}</p>
    </article>`;
  };
  RQ.grid = (list, cls = "") => (list.length ? `<div class="grid ${cls}">${list.map(RQ.card).join("")}</div>` : `<div class="empty"><h3>Inga produkter här än</h3><p>Sortimentet växer. Titta in igen snart, eller se allt vi har just nu.</p><a class="btn ghost" href="#butik">Alla produkter</a></div>`);
  const crumbs = (items) => `<ol class="crumbs">${items.map(([t, h]) => `<li>${h ? `<a href="#${h}">${esc(t)}</a>` : esc(t)}</li>`).join("")}</ol>`;
  RQ.crumbs = crumbs;
  const head = (kicker, title, lead, extra = "") => `<header class="page-head wrap">${kicker}<h1 class="h1">${title}</h1>${lead ? `<p class="lead">${lead}</p>` : ""}${extra}</header>`;
  RQ.head = head;

  /* ---------------------------------------------------------------- views */
  const V = (RQ.views = {});

  // Shop listing used by #butik, #kategori-x, #rum-x, #kollektion-x, #nyheter, #favoriter
  function shopView({ title, kicker, lead, cat = null, room = null, col = null, sort = "rel", banner = null, extraTop = "", trail }) {
    const listFor = (srt) => { if (srt === "dig" && RQ.taste) return RQ.taste.sort(S.list({ cat, room, col, sort: "rel" })); const l = S.list({ cat, room, col, sort: srt === "match" ? "rel" : srt }); return srt === "match" && RQ.room && RQ.room.has() ? [...l].sort((a, b) => (RQ.room.match(b) || 0) - (RQ.room.match(a) || 0)) : l; };
    const catCount = (id) => S.list({ cat: id, room, col }).length;
    const sideCats = RQ.CATEGORIES.map((c) => `<li><a class="${c.id === cat ? "on" : ""}" href="#kategori-${c.id}">${esc(c.name)}<span class="count">${S.list({ cat: c.id }).length}</span></a></li>`).join("");
    const sideRooms = RQ.ROOMS.map((r) => `<li><a class="${r.id === room ? "on" : ""}" href="#rum-${r.id}">${esc(r.name)}<span class="count">${S.list({ room: r.id }).length}</span></a></li>`).join("");
    return {
      html: `${head(crumbs(trail), esc(title), lead, banner ? `<div class="banner-img reveal"><img src="${banner}" alt="" loading="eager"></div>` : "")}
        ${extraTop}
        <section class="wrap" style="padding-bottom:6rem">
          <div class="shop">
            <aside class="filters" id="filters" aria-label="Filter">
              <div><h4>Kategorier</h4><ul><li><a class="${!cat && !room && !col ? "on" : ""}" href="#butik">Alla produkter<span class="count">${RQ.PRODUCTS.length}</span></a></li>${sideCats}</ul></div>
              <div><h4>Rum</h4><ul>${sideRooms}</ul></div>
              <div><h4>Mer</h4><ul><li><a href="#favoriter">Populärt</a></li><li data-show="news"><a href="#nyheter">Nyheter</a></li><li data-show="offers"><a href="#erbjudanden">Erbjudanden</a></li><li><a href="#hitta-ratt-present">Presenttips</a></li><li><a href="#jamfor">Jämför</a></li></ul></div>
            </aside>
            <div>
              <div class="toolbar">
                <span class="count" id="count">${listFor(sort).length} produkter</span>
                <div class="tb-r">
                  <button class="roomtoggle" type="button" data-room-mode aria-pressed="${!!(RQ.room && RQ.room.mode())}"><span class="rt-img" data-room-thumb data-empty='${roomIco}'>${RQ.room && RQ.room.has() ? RQ.room.thumb() : roomIco}</span><span>${RQ.room && RQ.room.has() ? "Visa i mitt rum" : "Se allt i ditt rum"}</span><i class="sw" aria-hidden="true"></i></button>
                  <button class="chip" type="button" id="toggleFilters" style="display:none">Filter</button>
                  <label class="sr" for="sort">Sortera</label>
                  <select class="select" id="sort"><option value="rel">Relevans</option><option value="pop">Popularitet</option><option value="asc">Pris: lågt till högt</option><option value="desc">Pris: högt till lågt</option><option value="new">Senaste</option>${RQ.room && RQ.room.has() ? '<option value="match">Passar mitt rum</option>' : ""}${RQ.taste && RQ.taste.has() ? '<option value="dig">För dig</option>' : ""}</select>
                </div>
              </div>
              <div class="example-note" style="margin-bottom:1.6rem"><span>●</span><span><b>Exempel.</b> Produkterna visar hur butiken kommer att se ut. De går inte att köpa än, och bilderna är skapade med AI.</span></div>
              <div id="results">${RQ.grid(listFor(sort), "three")}</div>
            </div>
          </div>
        </section>`,
      mount(root) {
        const sel = $("#sort", root); sel.value = sort;
        sel.addEventListener("change", () => { $("#results", root).innerHTML = RQ.grid(listFor(sel.value), "three"); RQ.watch(root); });
        const tf = $("#toggleFilters", root);
        if (matchMedia("(max-width:900px)").matches) { tf.style.display = ""; tf.addEventListener("click", () => $("#filters", root).classList.toggle("show")); }
      },
    };
  }

  RQ.shopView = shopView;
  V.butik = () => shopView({ title: "Alla produkter", kicker: "", lead: "Färre, bättre saker för hemmets alla rum.", trail: [["Hem", "hem"], ["Butik"]] });
  V.nyheter = () => shopView({ title: "Nyheter", lead: "Allt i sortimentet är nytt, eftersom butiken precis har börjat. Här visas det senast tillagda först.", sort: "new", trail: [["Hem", "hem"], ["Butik", "butik"], ["Nyheter"]] });
  V.favoriter = () => {
    const v = shopView({ title: "Populärt", lead: "Det vi själva tycker extra mycket om och det kunderna sparar mest i Svep.", trail: [["Hem", "hem"], ["Butik", "butik"], ["Populärt"]] });
    const list = S.list({}).filter((p) => p.featured);
    v.html = v.html.replace(/<div id="results">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/section>$/, `<div id="results">${RQ.grid(list, "three")}</div></div></div></section>`);
    const m = v.mount; v.mount = (root) => { m(root); $("#sort", root).closest("div").style.display = "none"; $("#count", root).textContent = list.length + " produkter"; };
    return v;
  };
  V.erbjudanden = () => ({
    html: `${head(crumbs([["Hem", "hem"], ["Butik", "butik"], ["Erbjudanden"]]), "Erbjudanden", "Här samlar vi kampanjer och erbjudanden när de finns.")}
      <section class="wrap" style="padding-bottom:6rem"><div class="empty"><h3>Inga erbjudanden just nu</h3><p>Vi sätter hellre rätt pris från början än hittar på rabatter. När det finns ett riktigt erbjudande syns det här, med tydligt vad det gäller och hur länge.</p><a class="btn ghost" href="#butik">Se alla produkter</a></div></section>`,
  });
  V.kategori = (id) => {
    const c = RQ.catById(id); if (!c) return null;
    return shopView({ title: c.name, lead: c.lead, cat: id, trail: [["Hem", "hem"], ["Butik", "butik"], [c.name]] });
  };
  V.rumindex = () => ({
    html: `${head(crumbs([["Hem", "hem"], ["Efter rum"]]), "Handla efter rum", "Välj ett rum och se idéer, tips och produkter som passar där.")}
      <section class="wrap" style="padding-bottom:6rem"><div class="tiles wide stagger" data-watch>${RQ.ROOMS.map((r) => `<a class="tile" href="#rum-${r.id}"><img src="assets/img/rum/${r.id}-900.webp" alt="" loading="lazy"><span>${esc(r.name)}<small>${esc(r.lead)}</small></span></a>`).join("")}<a class="tile" href="#inspiration" style="background:var(--natt)"><span>Rumsinspiration<small>Idéer för varje rum, samlade på ett ställe.</small></span></a></div></section>`,
  });
  V.rum = (id) => {
    const r = RQ.roomById(id); if (!r) return null;
    const arts = RQ.ARTICLES.filter((a) => a.rooms.includes(id)).slice(0, 3);
    const extra = `<section class="wrap" style="padding-bottom:3rem">
        <div class="split" style="align-items:start">
          <div><span class="eyebrow">Tre tips för ${esc(r.name.toLowerCase())}</span><ol class="prose numbered" style="margin-top:1.4rem">${r.tips.map((t) => `<li><p>${esc(t)}</p></li>`).join("")}</ol>
            <div class="ctrl-row" style="margin-top:2rem">${r.cats.map((cid) => `<a class="chip" href="#kategori-${cid}">${esc(RQ.catById(cid).name)}</a>`).join("")}<a class="btn sm" href="#studio-rum">Designa mitt rum</a></div></div>
          <div>${arts.length ? `<span class="eyebrow">Idéer för det här rummet</span><div style="display:grid;gap:1rem;margin-top:1.2rem">${arts.map((a) => `<a class="mag" href="#artikel-${a.slug}" style="display:grid;grid-template-columns:7rem 1fr;gap:1rem;align-items:center"><div class="im" style="aspect-ratio:1"><img src="${a.img}" alt="" loading="lazy"></div><div><h3 style="margin:0;font-size:1.15rem">${esc(a.title)}</h3><span class="min">${a.minutes} min läsning</span></div></a>`).join("")}</div>` : ""}</div>
        </div>
        <p class="note">Rummen på bilderna är illustrationer. Föremålen i dem är inte identifierade produkter ur sortimentet.</p></section>
      <div class="wrap"><div class="sec-head" style="margin-bottom:1.5rem"><span class="eyebrow">Detaljer för en liknande känsla</span><p>Utvalt efter rum och kategori, inte som exakta kopior av bilden.</p></div></div>`;
    const stage = RQ.hotspots ? `<section class="wrap rm-shop">${RQ.hotspots.render(id, { eager: true, cls: "room-stage" })}<div class="rm-shop-bar"><span><b>Allt i bilden</b> <span>${RQ.hotspots.handles(id).length} saker · ${S.kr(RQ.hotspots.total(id))}</span></span><span class="daynight" role="group" aria-label="Ljus i rummet"><button type="button" data-dn="dag" aria-pressed="true">Dag</button><button type="button" data-dn="kvall" aria-pressed="false">Kväll</button></span><button class="btn sm" type="button" data-shop-room="${id}">Handla rummet · ${S.kr(RQ.hotspots.total(id))}</button></div></section>` : "";
    const v = shopView({ title: r.name, lead: r.lead, room: id, banner: stage ? null : `assets/img/rum/${id}-1600.webp`, extraTop: stage + extra, trail: [["Hem", "hem"], ["Efter rum", "rum"], [r.name]] });
    const m0 = v.mount; v.mount = (root) => { if (m0) m0(root); return RQ.hotspots ? RQ.hotspots.mount(root) : null; };
    return v;
  };
  V.kollektioner = () => ({
    html: `${head(crumbs([["Hem", "hem"], ["Kollektioner"]]), "Utvalda kollektioner", "Saker som hör ihop, samlade kring en idé.")}
      <section class="wrap" style="padding-bottom:6rem">${colCards()}</section>`,
  });
  V.kollektion = (id) => {
    const c = RQ.colById(id); if (!c) return null;
    return shopView({ title: c.name, lead: `${c.lead} ${c.text}`, col: id, banner: colImg(id, 1600), trail: [["Hem", "hem"], ["Kollektioner", "kollektioner"], [c.name]] });
  };
  const COL_IMG = { "det-organiserade-hemmet": "forradsburkar-glas-ek-3-pack", "skandinaviskt-hemmaliv": "rum", "vardagens-favoriter": "svamp-uppladdningsbar-lampa" };
  const colImg = (id, w) => (COL_IMG[id] === "rum" ? `assets/img/rum-${w >= 1600 ? 1600 : 900}.webp` : `assets/img/p/${COL_IMG[id]}-${w >= 1600 ? 900 : 600}.webp`);
  const colCards = () => `<div class="cols3 stagger" data-watch>${RQ.COLLECTIONS.map((c) => `<a class="colcard" href="#kollektion-${c.id}"><div class="im"><img src="${colImg(c.id, 900)}" alt="" loading="lazy"></div><div class="tx"><span class="eyebrow">${S.list({ col: c.id }).length} produkter</span><h3 style="margin-top:.5rem">${esc(c.name)}</h3><p>${esc(c.lead)}</p></div></a>`).join("")}</div>`;
  RQ.colCards = colCards;

  /* ---------------- product page */
  const LAMPS = ["glob-bordslampa-opalglas", "lysa-keramiklampa", "svamp-uppladdningsbar-lampa"];
  RQ.LAMPS = LAMPS;
  RQ.LAMPS = LAMPS;
  RQ.gallery = (p) => {
    const g = [{ k: "main", src: RQ.img(p, 1400), thumb: RQ.img(p, 600), alt: `${p.name}, miljöbild` }];
    g.push({ k: "detail", src: `assets/img/d/${p.handle}-1200.webp`, thumb: `assets/img/d/${p.handle}-600.webp`, alt: `${p.name}, detalj` });
    if (LAMPS.includes(p.handle)) g.push({ k: "off", src: `assets/img/p/${p.handle}-off-1400.webp`, thumb: `assets/img/p/${p.handle}-off-600.webp`, alt: `${p.name}, släckt` });
    g.push({ k: "cut", src: RQ.cut(p), thumb: RQ.cut(p), alt: `${p.name}, frilagd`, cut: true });
    return g;
  };
  const ic = {
    truck: '<svg viewBox="0 0 24 24"><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7" cy="17.5" r="1.6"/><circle cx="17" cy="17.5" r="1.6"/></svg>',
    undo: '<svg viewBox="0 0 24 24"><path d="M9 7L4 12l5 5"/><path d="M4 12h10a6 6 0 0 1 0 12h-2" transform="translate(0 -6)"/></svg>',
    lock: '<svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="1.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
    room: '<svg viewBox="0 0 24 24"><path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/></svg>',
    list: '<svg viewBox="0 0 24 24"><path d="M5 5h14v15l-7-4-7 4z"/></svg>',
    cmp: '<svg viewBox="0 0 24 24"><path d="M8 4v16M16 4v16M4 8h4M16 16h4"/></svg>',
    zoom: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2M11 8.5v5M8.5 11h5"/></svg>',
  };
  RQ.icons2 = ic;
  const listPanel = (p) => {
    const lists = S.lists();
    const suggest = p.rooms.map((r) => RQ.roomById(r).name).filter((n) => !lists.some((l) => l.name === n));
    return `<p class="small" style="margin-bottom:.7rem">Samla produkter per rum eller projekt. Listorna finns under Önskelista och Mitt konto.</p>
      <div style="display:grid;gap:.45rem">${lists.map((l) => `<label class="check"><input type="checkbox" data-list="${l.id}" ${l.handles.includes(p.handle) ? "checked" : ""}> ${esc(l.name)} <span class="small">(${l.handles.length})</span></label>`).join("")}</div>
      ${suggest.length ? `<div class="chips" style="margin-top:.8rem">${suggest.map((n) => `<button type="button" class="chip" data-newlist="${esc(n)}">+ ${esc(n)}</button>`).join("")}</div>` : ""}
      <form id="newList" style="display:flex;gap:.5rem;margin-top:.8rem"><label class="sr" for="nl">Ny lista</label><input id="nl" placeholder="Ny lista, till exempel Sommarstugan" maxlength="40"><button class="btn sm" type="submit">Skapa</button></form>`;
  };
  V.produkt = (handle) => {
    const p = RQ.byHandle(handle); if (!p) return null;
    S.markSeen(handle);
    const c = RQ.catById(p.cat);
    const vs = S.variantsOf(p);
    const care = p.care.map((k) => RQ.CARE[k]).join(" ");
    const related = S.list({ cat: p.cat }).filter((x) => x.handle !== p.handle);
    const pairs = RQ.PRODUCTS.filter((x) => x.handle !== p.handle && x.cat !== p.cat && x.rooms.some((r) => p.rooms.includes(r)) && x.styles.some((s) => p.styles.includes(s))).slice(0, 4);
    const seen = S.recentlySeen(handle).slice(0, 4);
    const gal = RQ.gallery(p);
    const isLamp = LAMPS.includes(p.handle);
    const ld = { "@context": "https://schema.org", "@type": "Product", name: p.name, description: p.short, image: new URL(RQ.img(p, 900), document.baseURI).href, category: c.name, brand: { "@type": "Brand", name: "RumIQ" },
      offers: { "@type": "Offer", priceCurrency: "SEK", price: p.price, availability: "https://schema.org/PreOrder" } };
    const look = [p, ...pairs.slice(0, 3)];
    const shown = gal.filter((g) => g.k !== "off");
    return {
      title: `${p.name} · RumIQ`,
      html: `<section class="wrap" style="padding-top:1.6rem">${crumbs([["Hem", "hem"], ["Butik", "butik"], [c.name, "kategori-" + c.id], [p.name]])}</section>
        <section class="wrap pdp" style="padding:1.4rem 0 clamp(3rem,7vw,6rem)">
          <div class="pg">
            <div class="pg-grid" id="pgGrid" style="--tone:${p.tone[0]}22">${RQ.room && RQ.room.has() ? "" : ""}${shown.map((g, i) => `<button type="button" class="pg-item${g.cut ? " cut" : ""}" data-gi="${gal.indexOf(g)}" aria-label="Visa större: ${esc(g.alt)}"><img class="fade" src="${g.src}" alt="${esc(g.alt)}" ${i === 0 ? 'style="view-transition-name:pimg" fetchpriority="high"' : 'loading="lazy"'} decoding="async" onerror="this.closest('.pg-item').remove()">${i === 0 && LAMPS.includes(p.handle) ? `<img class="pg-off" src="assets/img/p/${p.handle}-off-1400.webp" alt="" aria-hidden="true" decoding="async" onerror="this.remove()">` : ""}${i === 0 ? '<span class="tag">Exempel</span>' : ""}<span class="zhint">${ic.zoom}Zooma</span></button>${i === 0 && RQ.film(p) ? `<div class="pg-item pg-film"><video src="${RQ.film(p)}" poster="${RQ.img(p, 900)}" muted playsinline loop autoplay preload="metadata" aria-label="${esc(p.name)} i rörelse"></video><span class="tag">Film</span></div>` : ""}${i === 0 && RQ.room && RQ.room.has() ? `<button type="button" class="pg-item inroomtile" data-goroom="${p.handle}" aria-label="Ställ in ${esc(p.name)} i mitt rum">${RQ.room.layer(p, true)}<span class="tag">I ditt rum</span><span class="zhint">${RQ.roomIco}Öppna i Mitt rum</span></button>` : ""}`).join("")}</div>
            ${isLamp ? `<button type="button" class="lightswitch" id="lightSw" aria-pressed="true" hidden><i></i><span>Lampan är tänd</span></button>` : ""}
            <div class="pg-dots" id="pgDots" aria-hidden="true"></div>
            <p class="caption">Bilderna är skapade med AI och visar hur produkten kan se ut. Färg och detaljer kan skilja sig från den riktiga produkten.</p>
          </div>
          <div class="pinfo">
            <a class="eyebrow" href="#kategori-${c.id}">${esc(c.name)}</a>
            <h1>${esc(p.name)}</h1>
            <div class="priceline">${RQ.priceHtml(p, "pdp")}<span class="vat">inkl. moms</span></div>
            <p class="short">${esc(p.short)}</p>
            ${p.variants ? `<div class="opt"><span class="lbl">Färg: <b id="vname">${esc(vs[0].title)}</b></span><div class="swatch-row" role="radiogroup" aria-label="Färg">${vs.map((v, i) => `<button type="button" role="radio" aria-checked="${i === 0}" data-v="${v.id}"><i class="dotc" style="background:${p.tone[i] || "#ccc"}"></i>${esc(v.title)}</button>`).join("")}</div></div>` : ""}
            <div class="buy"><div class="qty"><button type="button" data-q="-1" aria-label="Minska">−</button><input id="qty" type="number" value="1" min="1" max="99" aria-label="Antal" inputmode="numeric"><button type="button" data-q="1" aria-label="Öka">+</button></div><button class="btn" type="button" id="add">Lägg i varukorgen</button></div>
            <p class="buy-alt">Vill du handla direkt? <button type="button" class="tlink" id="buyNow">Gå till kassan</button></p>${RQ.payRow()}
            ${RQ.room && RQ.room.has() ? `<a class="roomcta" href="#mitt-rum-${p.handle}"><span class="rc-img">${RQ.room.thumb()}</span><span><b>Ställ in i mitt rum</b><small>Se den hemma hos dig och handla hela rummet på en gång.</small></span>${RQ.roomIco}</a>`
              : `<button type="button" class="roomcta" data-room-setup="#mitt-rum-${p.handle}"><span class="rc-img">${RQ.roomIco}</span><span><b>Se den i ditt rum</b><small>Ta en bild av ditt rum, så ställer vi in produkten där.</small></span>${RQ.plus}</button>`}
            ${RQ.p3d ? RQ.p3d.card(p) : ""}
            <div class="pactions">
              <button type="button" data-wish="${p.handle}" aria-pressed="${S.isWished(p.handle)}">${I.heart}<span>${S.isWished(p.handle) ? "Sparad" : "Spara"}</span></button>
              <button type="button" id="saveRoomBtn" aria-expanded="false" aria-controls="listPanel">${ic.list}<span>Spara i ett rum${S.listsWith(p.handle).length ? ` (${S.listsWith(p.handle).length})` : ""}</span></button>
            </div>
            <div class="panel" id="listPanel" hidden style="margin-top:1rem">${listPanel(p)}</div>
            ${RQ.delivery ? RQ.delivery.html(p) : ""}
            ${RQ.homeFit ? RQ.homeFit.html(p) : ""}
            ${RQ.notify ? RQ.notify.html(p) : ""}
            <div class="example-note"><span>●</span><span><b>Exempelprodukt.</b> Den är inte verifierad för försäljning än. Du kan prova varukorgen och kassan, men exempelprodukter går inte att betala för.</span></div>
            <div class="ptabs" data-ptabs>
              <div class="ptab-bar" role="tablist" aria-label="Mer om produkten"><button type="button" role="tab" id="ptb-om" aria-controls="pt-om" aria-selected="true">Om</button><button type="button" role="tab" id="ptb-matt" aria-controls="pt-matt" aria-selected="false" tabindex="-1">Mått och skötsel</button><button type="button" role="tab" id="ptb-frakt" aria-controls="pt-frakt" aria-selected="false" tabindex="-1">Frakt och retur</button></div>
              <div class="ptab" role="tabpanel" id="pt-om" aria-labelledby="ptb-om"><p>${esc(p.story)}</p><h3>Så använder du den</h3><ul>${p.use.map((u) => `<li>${esc(u)}</li>`).join("")}</ul>${RQ.LOOKS && RQ.LOOKS.some((l) => l.items.includes(p.handle)) ? `<div class="p-looks"><span class="eyebrow">Ingår i färdiga looks</span><div class="chips">${RQ.LOOKS.filter((l) => l.items.includes(p.handle)).map((l) => `<a class="chip" href="#look-${l.id}">${esc(l.name)}</a>`).join("")}</div></div>` : ""}<div class="p-reviews"><span class="eyebrow">Omdömen</span><p>Inga omdömen ännu. Kunder som köpt får en fråga om produkten när de haft den i tio dagar, och svaren visas här, även de kritiska.</p></div></div>
              <div class="ptab" role="tabpanel" id="pt-matt" aria-labelledby="ptb-matt" hidden><h3>Passar den hemma?</h3><p>Exakta mått visas här när produkten är verifierad. Till dess kan du:</p><ul><li>Mäta platsen där den ska stå, både bredd, djup och höjd.</li><li>Prova produkten i ett foto av ditt rum i <a href="#studio-rum-${p.handle}">Se det i ditt rum</a>.</li><li>Fråga <a href="#studio-stylist">stylisten</a> om vad som passar ihop.</li></ul><h3>Material och skötsel</h3><p><b>Material:</b> ${esc(p.material)}</p><p style="margin-top:.6rem">${esc(care)}</p><p class="small" style="margin-top:.6rem">Allmänna råd för materialet. Följ alltid tillverkarens skötselråd när produkten levereras.</p><h3>Mått och fakta</h3><ul class="facts" style="margin-top:0;border-top:0">
                <li><span>Artikel</span><span>${esc(p.handle.toUpperCase().slice(0, 14))}</span></li>
                <li><span>Mått</span><span class="pending">Bekräftas när produkten är verifierad</span></li>
                <li><span>Vikt</span><span class="pending">Bekräftas</span></li>
                <li><span>Material</span><span>${esc(p.material)}</span></li>
                ${p.variants ? `<li><span>Färger</span><span>${esc(p.variants.join(", "))}</span></li>` : ""}
                <li><span>Passar i</span><span>${p.rooms.map((r) => `<a href="#rum-${r}">${esc(RQ.roomById(r).name)}</a>`).join(", ")}</span></li>
                <li><span>Stil</span><span>${p.styles.map((s) => RQ.STYLES[s].name).join(", ")}</span></li>
                <li><span>Tillverkare</span><span class="pending">Anges innan försäljning</span></li>
                <li><span>Skickas från</span><span class="pending">Anges innan försäljning</span></li>
                <li><span>Leveranstid</span><span class="pending">Visas när leverantören bekräftat</span></li>
              </ul></div>
              <div class="ptab" role="tabpanel" id="pt-frakt" aria-labelledby="ptb-frakt" hidden><ul class="pfacts">
              <li>${ic.truck}<span>${(window.RQ_CONFIG || {}).freeShippingFrom ? `Fri frakt till ombud och paketskåp från ${kr(window.RQ_CONFIG.freeShippingFrom)}, annars från 49 kr.` : "Leveranssätt, pris och leveranstid visas i kassan innan du betalar."} <a href="#frakt">Om frakt</a></span></li>
              <li>${ic.undo}<span>${((window.RQ_CONFIG || {}).delivery || {}).openPurchaseDays ? `${window.RQ_CONFIG.delivery.openPurchaseDays} dagars öppet köp. Du ångrar med en knapp och returen går till en adress i Sverige.` : "14 dagars ångerrätt. Du ångrar med en knapp."} <a href="#returer">Om returer</a></span></li>
              <li>${ic.lock}<span>Säker betalning i Shopifys kassa. Vi ser aldrig ditt kort.</span></li>
            </ul><p class="small"><a href="#frakt">Frakt och leverans</a> · <a href="#returer">Returer och återbetalning</a> · <a href="#angra">Ångra avtalet här</a></p></div>
            </div>
          </div>
        </section>

        ${pairs.length ? `<section class="sec tight kalk"><div class="wrap"><div class="sec-row"><div class="sec-head"><h2 class="h2">Passar ihop</h2><p>Bocka ur det du inte vill ha. Du kan ändra antal i varukorgen.</p></div><a class="link" href="#studio-kombinera-${p.handle}">Bygg en egen look</a></div>
          <div class="look"><div class="look-items">${look.map((x, i) => `<label class="look-item"><input type="checkbox" data-look="${x.handle}" checked><img src="${RQ.img(x, 600)}" alt="" loading="lazy"><span class="nm">${i === 0 ? "Den här: " : ""}${esc(x.name)}</span><span class="pr">${kr(x.price)}</span></label>`).join("")}</div>
          <div class="look-sum"><div class="sum total"><span>Totalt</span><span id="lookTotal">${kr(look.reduce((s, x) => s + x.price, 0))}</span></div><button class="btn block" type="button" id="lookAdd">Lägg ${look.length} produkter i varukorgen</button></div></div></div></section>` : ""}
        ${related.length ? `<section class="sec tight"><div class="wrap"><div class="sec-row"><div class="sec-head"><h2 class="h2">Liknande produkter</h2></div><a class="link" href="#kategori-${c.id}">Visa alla</a></div>${RQ.grid(related.slice(0, 4))}</div></section>` : ""}
        ${seen.length ? `<section class="sec tight" style="padding-top:0"><div class="wrap"><div class="sec-head"><h2 class="h3">Du har tittat på</h2></div>${RQ.grid(seen)}</div></section>` : ""}
        <div class="buybar" id="buybar"><div class="bb-p"><img src="${RQ.img(p, 600)}" alt=""><div class="bb-t"><b>${esc(p.name)}</b><span>${kr(p.price)}</span></div></div><button class="btn sm" type="button" id="add2">Lägg i varukorgen</button></div>
        <script type="application/ld+json">${JSON.stringify(ld)}</script>`,
      mount(root) {
        let variant = vs[0].id;
        const grid = $("#pgGrid", root);
        const items = () => $$(".pg-item:not(.inroomtile):not(.pg-film)", grid);
        const lbList = () => items().map((b) => { const g = gal[+b.dataset.gi]; const im = $("img", b); return { src: im.currentSrc || im.src, thumb: g.thumb, alt: im.alt, cut: !!g.cut }; });
        // open the lightbox on click, loupe on hover (fine pointers only)
        grid.addEventListener("click", (e) => { const t = e.target.closest(".inroomtile"); if (t) { location.hash = "#mitt-rum-" + p.handle; return; } const b = e.target.closest(".pg-item:not(.pg-film)"); if (!b) return; RQ.lightbox.open(lbList(), items().indexOf(b), p.name); });
        const fine = matchMedia("(hover:hover) and (pointer:fine)").matches && innerWidth > 900;
        if (fine) {
          let zt = null;
          grid.addEventListener("mousemove", (e) => { const b = e.target.closest(".pg-item"); if (!b) return; const r = b.getBoundingClientRect(); b.style.setProperty("--zx", ((e.clientX - r.left) / r.width * 100).toFixed(1) + "%"); b.style.setProperty("--zy", ((e.clientY - r.top) / r.height * 100).toFixed(1) + "%"); });
          grid.addEventListener("mouseover", (e) => { const b = e.target.closest(".pg-item:not(.inroomtile)"); if (!b || b.classList.contains("zooming")) return; clearTimeout(zt); zt = setTimeout(() => b.classList.add("zooming"), 380); });
          grid.addEventListener("mouseout", (e) => { const b = e.target.closest(".pg-item"); if (!b || b.contains(e.relatedTarget)) return; clearTimeout(zt); b.classList.remove("zooming"); });
        }
        // drop images that do not exist yet (lazy images never fire an error off screen)
        items().slice(1).forEach((b) => { const t = new Image(); t.onerror = () => { b.remove(); paintDots(); }; t.src = $("img", b).getAttribute("src"); });
        // phones: dots follow the carousel
        const dots = $("#pgDots", root);
        const paintDots = () => { const n = $$(".pg-item", grid).length; if (dots.children.length !== n) dots.innerHTML = Array.from({ length: n }, () => "<i></i>").join(""); const i = Math.round(grid.scrollLeft / Math.max(1, grid.clientWidth)); [...dots.children].forEach((d, k) => d.classList.toggle("on", k === i)); };
        grid.addEventListener("scroll", () => requestAnimationFrame(paintDots), { passive: true });
        setTimeout(paintDots, 300); setTimeout(paintDots, 1500);
        // lamps: switch the light on the first image
        const sw = $("#lightSw", root);
        if (sw) {
          const off = gal.find((g) => g.k === "off"), main = gal[0];
          const pre = new Image(); pre.onload = () => (sw.hidden = false); pre.src = off.src;
          sw.addEventListener("click", () => {
            const on = sw.getAttribute("aria-pressed") !== "true";
            sw.setAttribute("aria-pressed", on); $("span", sw).textContent = on ? "Lampan är tänd" : "Lampan är släckt";
            const im = $(".pg-item img", grid); im.style.opacity = 0;
            setTimeout(() => { im.src = on ? main.src : off.src; im.alt = on ? main.alt : off.alt; im.style.opacity = 1; }, 220);
            grid.scrollTo({ left: 0, behavior: "smooth" });
          });
        }
        $$("[data-v]", $(".pinfo", root)).forEach((b) => b.addEventListener("click", () => {
          variant = b.dataset.v; $$("[data-v]", $(".pinfo", root)).forEach((x) => x.setAttribute("aria-checked", x === b));
          $("#vname", root).textContent = S.variantById(variant).variant.title;
        }));
        const q = $("#qty", root);
        $$("[data-q]", root).forEach((b) => b.addEventListener("click", () => { q.value = Math.max(1, Math.min(99, (+q.value || 1) + +b.dataset.q)); }));
        const add = (btn) => { S.addToCart(variant, Math.max(1, +q.value || 1)); RQ.confirmAdd(btn, p.name); };
        $("#add", root).addEventListener("click", (e) => add(e.currentTarget)); $("#add2", root).addEventListener("click", (e) => add(e.currentTarget));
        $("#buyNow", root).addEventListener("click", () => { S.addToCart(variant, Math.max(1, +q.value || 1)); location.hash = "#kassa"; });
        // save in a room (named lists)
        const panel = $("#listPanel", root), srb = $("#saveRoomBtn", root);
        srb.addEventListener("click", () => { const open = panel.hidden; panel.hidden = !open; srb.setAttribute("aria-expanded", open); });
        const repaint = () => { panel.innerHTML = listPanel(p); const n = S.listsWith(p.handle).length; $("span", srb).textContent = "Spara i ett rum" + (n ? ` (${n})` : ""); };
        panel.addEventListener("change", (e) => { const cb = e.target.closest("[data-list]"); if (!cb) return; const on = S.toggleInList(cb.dataset.list, p.handle); RQ.toast(on ? "Sparad i listan." : "Borttagen ur listan."); repaint(); });
        panel.addEventListener("click", (e) => { const b = e.target.closest("[data-newlist]"); if (!b) return; const l = S.createList(b.dataset.newlist); S.toggleInList(l.id, p.handle); RQ.toast(`Sparad i ${esc(l.name)}.`); repaint(); });
        panel.addEventListener("submit", (e) => { e.preventDefault(); const v = $("#nl", root).value.trim(); if (!v) return; const l = S.createList(v); S.toggleInList(l.id, p.handle); RQ.toast(`Sparad i ${esc(l.name)}.`); repaint(); });
        // complete the look
        const lt = $("#lookTotal", root);
        if (lt) {
          const upd = () => { const sel = $$("[data-look]:checked", root).map((x) => RQ.byHandle(x.dataset.look)); lt.textContent = kr(sel.reduce((s, x) => s + x.price, 0)); const b = $("#lookAdd", root); b.textContent = sel.length ? `Lägg ${sel.length} ${sel.length === 1 ? "produkt" : "produkter"} i varukorgen` : "Välj minst en produkt"; b.disabled = !sel.length; };
          root.addEventListener("change", (e) => { if (e.target.matches("[data-look]")) upd(); });
          $("#lookAdd", root).addEventListener("click", () => { const sel = $$("[data-look]:checked", root).map((x) => x.dataset.look); sel.forEach((h) => S.addToCart(h + "::0", 1)); RQ.toast(`${sel.length} produkter i varukorgen. <a href="#" data-open-cart>Visa</a>`); });
        }
        // sticky buy bar once the buy button scrolls away (desktop); always on phones
        const bar = $("#buybar", root), buy = $(".buy", root);
        const io2 = new IntersectionObserver(([e]) => bar.classList.toggle("show", !e.isIntersecting && e.boundingClientRect.top < 0));
        io2.observe(buy);
        return () => io2.disconnect();
      },
    };
  };

  V.onskelista = () => {
    const lists = S.lists();
    let active = RQ.ss.get("rumiq-list") || "fav";
    if (active !== "fav" && !lists.some((l) => l.id === active)) active = "fav";
    const cur = active === "fav" ? { id: "fav", name: "Favoriter", handles: S._wish } : lists.find((l) => l.id === active);
    const items = cur.handles.map(RQ.byHandle).filter(Boolean);
    const total = items.reduce((s, p) => s + p.price, 0);
    return { title: "Önskelista · RumIQ",
      html: `${head(crumbs([["Hem", "hem"], ["Önskelista"]]), "Önskelista", "Dina favoriter och egna listor, till exempel en per rum. Listorna finns kvar i den här webbläsaren.")}
      <section class="wrap" style="padding-bottom:6rem">
        <div class="listtabs" role="tablist"><button class="chip" type="button" role="tab" data-tab="fav" aria-pressed="${active === "fav"}">Favoriter (${S._wish.length})</button>${lists.map((l) => `<button class="chip" type="button" role="tab" data-tab="${l.id}" aria-pressed="${active === l.id}">${esc(l.name)} (${l.handles.length})</button>`).join("")}
          <form id="mkList" style="display:flex;gap:.4rem"><label class="sr" for="mkl">Ny lista</label><input id="mkl" placeholder="Ny lista" maxlength="40" style="padding:.5rem .9rem;border-radius:999px;width:10rem"><button class="chip" type="submit">Skapa</button></form></div>
        <div class="listhead"><div><h2 class="h3">${esc(cur.name)}</h2><p class="small">${items.length} produkter · ${kr(total)}</p></div>
          <div class="ctrl-row" style="margin:0">${items.length ? `<button class="btn sm" type="button" id="allCart">Lägg alla i varukorgen</button><a class="btn ghost sm" href="#studio-kombinera-${items[0].handle}">Se dem tillsammans</a><button class="btn ghost sm" type="button" id="share">Kopiera lista</button>` : ""}${active !== "fav" ? `<button class="chip" type="button" id="ren">Byt namn</button><button class="chip" type="button" id="del">Ta bort listan</button>` : ""}</div></div>
        ${active === "fav" && items.length && RQ.priceWatch ? RQ.priceWatch.html(items.map((x) => x.handle)) : ""}
        ${items.length ? RQ.grid(items) : `<div class="empty"><h3>Listan är tom</h3><p>${active === "fav" ? "Tryck på hjärtat på en produkt för att spara den här." : "Öppna en produkt och välj Spara i ett rum."}</p><a class="btn ghost" href="#butik">Utforska butiken</a></div>${active === "fav" && RQ.svepNudge ? RQ.svepNudge() : ""}`}
      </section>`,
      mount(root) {
        root.addEventListener("click", (e) => { const t = e.target.closest("[data-tab]"); if (t) { RQ.ss.set("rumiq-list", t.dataset.tab); RQ.router(); } });
        $("#mkList", root).addEventListener("submit", (e) => { e.preventDefault(); const v = $("#mkl", root).value.trim(); if (!v) return; const l = S.createList(v); RQ.ss.set("rumiq-list", l.id); RQ.router(); });
        const ac = $("#allCart", root); if (ac) ac.addEventListener("click", () => { items.forEach((p) => S.addToCart(p.handle + "::0", 1)); RQ.toast(`${items.length} produkter i varukorgen. <a href="#" data-open-cart>Visa</a>`); });
        const sh = $("#share", root); if (sh) sh.addEventListener("click", async () => { const txt = `${cur.name} (RumIQ)\n` + items.map((p) => `- ${p.name}, ${kr(p.price)}`).join("\n") + `\nTotalt ${kr(total)}`; try { await navigator.clipboard.writeText(txt); RQ.toast("Listan är kopierad. Klistra in den var du vill."); } catch (er) { RQ.toast("Kunde inte kopiera i den här webbläsaren."); } });
        const rn = $("#ren", root); if (rn) rn.addEventListener("click", () => { const h = $(".listhead h2", root); h.innerHTML = `<form id="rnf" style="display:flex;gap:.4rem"><input value="${esc(cur.name)}" maxlength="40" style="padding:.5rem .9rem"><button class="chip" type="submit">Spara</button></form>`; $("#rnf", root).addEventListener("submit", (ev) => { ev.preventDefault(); const v = ev.currentTarget.querySelector("input").value.trim(); if (v) S.renameList(cur.id, v); RQ.router(); }); });
        let armed = false; const dl = $("#del", root); if (dl) dl.addEventListener("click", () => { if (!armed) { armed = true; dl.textContent = "Klicka igen för att ta bort"; return; } S.deleteList(cur.id); RQ.ss.set("rumiq-list", "fav"); RQ.router(); });
      } };
  };
  V.jamfor = () => {
    const list = S.compareList();
    const row = (label, f) => `<tr><th>${label}</th>${list.map((p) => `<td>${f(p)}</td>`).join("")}</tr>`;
    return { html: `${head(crumbs([["Hem", "hem"], ["Butik", "butik"], ["Jämför"]]), "Jämför produkter", "Lägg till upp till fyra produkter och se dem sida vid sida.")}
      <section class="wrap" style="padding-bottom:6rem">${list.length ? `<div class="compare-wrap"><table class="compare">
        <tr><th></th>${list.map((p) => `<td><a href="#produkt-${p.handle}"><img src="${RQ.img(p, 600)}" alt=""></a><h3 class="h3" style="font-size:1.15rem;margin-top:.7rem"><a href="#produkt-${p.handle}" style="text-decoration:none">${esc(p.name)}</a></h3><button class="link" type="button" data-compare="${p.handle}" style="border:0;background:none;margin-top:.4rem;font-size:.85rem">Ta bort</button></td>`).join("")}</tr>
        ${row("Pris", (p) => `<span class="price" style="font-family:var(--mono)">${kr(p.price)}</span>`)}
        ${row("Kategori", (p) => esc(RQ.catById(p.cat).name))}
        ${row("Material", (p) => esc(p.material))}
        ${row("Färger", (p) => esc((p.variants || ["En färg"]).join(", ")))}
        ${row("Passar i", (p) => p.rooms.map((r) => RQ.roomById(r).name).join(", "))}
        ${row("Stil", (p) => p.styles.map((s) => RQ.STYLES[s].name).join(", "))}
        ${row("Beskrivning", (p) => esc(p.short))}
        ${row("Mått", () => `<span class="pending">Bekräftas</span>`)}
        ${row("", (p) => `<button class="btn sm" type="button" data-add="${p.handle}::0">Lägg i varukorgen</button>`)}
      </table></div>` : `<div class="empty"><h3>Inget att jämföra än</h3><p>Välj Jämför på en produkt, så hamnar den här.</p><a class="btn ghost" href="#butik">Utforska butiken</a></div>`}</section>` };
  };

  /* ---------------- magazine */
  RQ.magCard = (a) => `<a class="mag" href="#artikel-${a.slug}"><div class="im"><img src="${a.img}" alt="" loading="lazy"></div><h3>${esc(a.title)}</h3><p>${esc(a.lead)}</p><span class="min">${a.minutes} min läsning</span></a>`;
  V.magasin = () => ({ html: `${head(crumbs([["Hem", "hem"], ["Magasin"]]), "Magasin", "Idéer för ditt hem. Korta texter om ljus, material, färg och vardag.")}
      <section class="wrap" style="padding-bottom:6rem"><div class="mag-grid stagger" data-watch>${RQ.ARTICLES.map(RQ.magCard).join("")}</div></section>` });
  V.artikel = (slug) => {
    const a = RQ.articleBySlug(slug); if (!a) return null;
    const saved = S.savedArticles().includes(slug);
    return { title: `${a.title} · RumIQ Magasin`,
      html: `<header class="page-head wrap" style="padding-bottom:0">${crumbs([["Hem", "hem"], ["Magasin", "magasin"], [a.title]])}<h1 class="h1" style="max-width:22ch">${esc(a.title)}</h1><p class="lead">${esc(a.lead)}</p>
        <div class="ctrl-row"><span class="eyebrow" style="align-self:center">${a.minutes} min läsning</span><button class="chip" type="button" id="saveArt" aria-pressed="${saved}">${saved ? "Sparad i Mitt hem" : "Spara artikeln"}</button></div></header>
        <div class="wrap"><div class="article-hero reveal"><img src="${a.img.replace("-1200", "-1600")}" onerror="this.src='${a.img}'" alt=""></div></div>
        <article class="wrap prose" style="padding-bottom:4rem">${a.body}</article>
        <section class="sec tight kalk"><div class="wrap"><div class="sec-head"><span class="eyebrow">Från artikeln</span><h2 class="h2">Saker som passar</h2></div>${RQ.grid(a.picks.map(RQ.byHandle).filter(Boolean), "three")}</div></section>
        <section class="sec tight"><div class="wrap"><div class="sec-head"><span class="eyebrow">Läs mer</span></div><div class="mag-grid">${RQ.ARTICLES.filter((x) => x.slug !== slug).slice(0, 3).map(RQ.magCard).join("")}</div></div></section>`,
      mount(root) { $("#saveArt", root).addEventListener("click", (e) => { const on = S.toggleArticle(slug); e.currentTarget.setAttribute("aria-pressed", on); e.currentTarget.textContent = on ? "Sparad i Mitt hem" : "Spara artikeln"; }); },
    };
  };
  V.inspiration = () => ({ html: `${head(crumbs([["Hem", "hem"], ["Rumsinspiration"]]), "Rumsinspiration", "Rum att drömma sig bort i, och idéer att ta med hem. Bilderna är illustrationer.")}
      <section class="wrap"><div class="tiles stagger" data-watch>${RQ.ROOMS.map((r, i) => `<a class="tile ${i === 0 ? "big" : ""}" href="#rum-${r.id}"><img src="assets/img/rum/${r.id}-${i === 0 ? 1600 : 900}.webp" alt="" loading="lazy"><span>${esc(r.name)}<small>${esc(r.lead)}</small></span></a>`).join("")}</div></section>
      <section class="sec"><div class="wrap"><div class="sec-row"><div class="sec-head"><span class="eyebrow">Magasin</span><h2 class="h2">Idéer för ditt hem</h2></div><a class="link arrow" href="#magasin">Alla artiklar</a></div><div class="mag-grid">${RQ.ARTICLES.slice(0, 3).map(RQ.magCard).join("")}</div></div></section>
      <section class="sec kalk"><div class="wrap split"><div><span class="eyebrow">Mitt rum</span><h2 class="h2" style="margin-top:.9rem">Fri inredningsidé för ditt eget rum</h2><p class="lead" style="margin-top:1rem">Lägg till ett foto av ditt rum och prova produkterna där, eller svep fram en riktning.</p><div class="ctrl-row" style="margin-top:1.6rem"><a class="btn" href="#mitt-rum">Se det i ditt rum</a><a class="btn ghost" href="#svep">Svep fram din stil</a></div></div><div class="im"><img src="assets/img/rum/sovrum-900.webp" alt="" loading="lazy"></div></div></section>` });

  /* ---------------- info + legal */
  const infoNav = (active) => `<ul class="sidenav"><h4>Kundservice</h4>${[["kontakt", "Kontakt"], ["ideer", "Dela en idé"], ["faq", "Vanliga frågor"], ["spara-order", "Spåra min beställning"], ["frakt", "Frakt & leverans"], ["returer", "Returer & återbetalning"], ["angra", "Ångra avtalet här"], ["betalning", "Betalning"], ["sa-fungerar-det", "Så fungerar RumIQ"], ["om", "Om RumIQ"]].map(([h, t]) => `<li><a class="${h === active ? "on" : ""}" href="#${h}">${t}</a></li>`).join("")}
    <h4>Juridisk information</h4>${Object.entries(RQ.LEGAL).map(([k, v]) => `<li><a class="${"juridik-" + k === active ? "on" : ""}" href="#juridik-${k}">${v.title}</a></li>`).join("")}</ul>`;
  RQ.infoPage = (route, kicker, title, lead, body, mount) => ({ title: `${title} · RumIQ`, html: `${head(`<span class="eyebrow">${esc(kicker)}</span>`, esc(title), lead)}<section class="wrap layout-side" style="padding-bottom:6rem">${infoNav(route)}<div class="prose">${body}</div></section>`, mount });
  Object.entries(RQ.INFO).forEach(([k, v]) => {
    V[k] = () => RQ.infoPage(k, v.kicker, v.title, v.lead, v.html(), k === "kontakt" ? mountContact : null);
  });
  V.juridik = (k) => { const v = RQ.LEGAL[k]; if (!v) return null; return RQ.infoPage("juridik-" + k, "Juridisk information", v.title, v.lead, v.html()); };
  function mountContact(root) {
    const f = $("#contactForm", root); if (!f) return;
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      const st = $("#contactStatus", root);
      if (!f.name.value.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.value.trim()) || !f.msg.value.trim()) { st.textContent = "Fyll i namn, en giltig e-post och ditt meddelande."; st.classList.add("err"); return; }
      st.classList.remove("err");
      st.textContent = "Förhandsversion: formuläret är inte kopplat än, så meddelandet skickades inte. Skriv till support@rumiq.se så länge.";
    });
  }

  /* ---------------- ideas */
  V.ideer = () => {
    const ideas = S.ideas().sort((a, b) => b.votes - a.votes);
    return RQ.infoPage("ideer", "Kundservice", "Vad vill du se hos RumIQ?", "Föreslå en produkt eller en förbättring, och rösta på andras idéer.",
      `<h2 style="margin-top:0">Kundernas idéer</h2>
       ${ideas.length ? `<div style="display:grid;gap:.8rem;margin-top:1rem">${ideas.map((i) => `<div class="order" style="display:flex;gap:1rem;align-items:flex-start"><button class="chip" type="button" data-vote="${i.id}" aria-pressed="${!!i.voted}" style="flex:none">▲ ${i.votes}</button><div><b>${esc(i.title)}</b><p class="small">${esc(i.text)}</p></div></div>`).join("")}</div>` : `<p>Inga publicerade idéer ännu. Bli först!</p>`}
       <p class="note">I den här förhandsversionen sparas idéerna bara i din webbläsare och syns inte för andra.</p>
       <h2>Dela en idé</h2>
       <form id="ideaForm" class="form-grid" novalidate style="margin-top:1rem"><label class="full">Rubrik<input name="title" maxlength="80" required placeholder="Till exempel: Fler mörka textilier"></label><label class="full">Beskriv gärna lite mer<textarea name="text" rows="4" maxlength="600"></textarea></label><button class="btn" type="submit">Skicka idén</button><p class="status full" id="ideaStatus"></p></form>`,
      (root) => {
        $$("[data-vote]", root).forEach((b) => b.addEventListener("click", () => { S.voteIdea(b.dataset.vote); RQ.router(); }));
        $("#ideaForm", root).addEventListener("submit", (e) => { e.preventDefault(); const f = e.currentTarget; if (!f.title.value.trim()) { $("#ideaStatus", root).textContent = "Skriv en kort rubrik."; return; } S.addIdea(f.title.value.trim(), f.text.value.trim()); RQ.toast("Tack för idén!"); RQ.router(); });
      });
  };

  /* ---------------- 404 */
  V.notfound = () => ({ html: `${head(`<span class="eyebrow">404</span>`, "Den här sidan finns inte", "Länken kan vara gammal eller felstavad.")}<section class="wrap" style="padding-bottom:6rem"><div class="ctrl-row"><a class="btn" href="#hem">Till startsidan</a><a class="btn ghost" href="#butik">Till butiken</a></div></section>` });

  /* ---------------------------------------------------------------- tools on demand
     studio.js (Snabbval, Hitta rätt, Mitt hem, Bygg din egen look, Färger ur ditt rum, the stylist) is its own
     file on the live site. Until it has loaded, its views are stubs that ask the router to fetch it first.
     In the unbundled shell the real views replace the stubs straight away. */
  const TOOL_VIEWS = ["findRight", "giftFinder", "myHome", "studioAnalysis", "studioGuide", "studioMix", "studioRoom", "studioSearch", "studioStyle", "studioStylist"];
  TOOL_VIEWS.forEach((n) => { if (!V[n]) V[n] = Object.assign(() => ({ lazy: true }), { stub: true }); });
  let toolsP = null;
  RQ.loadTools = () => {
    if (toolsP) return toolsP;
    if (!window.RQ_TOOLS_SRC || !V.myHome.stub) return (toolsP = Promise.resolve());
    return (toolsP = new Promise((ok, bad) => { const s = document.createElement("script"); s.src = window.RQ_TOOLS_SRC; s.onload = ok; s.onerror = () => { toolsP = null; bad(); }; document.head.appendChild(s); }));
  };
  // fetch them quietly once the page is idle, so the next tap is instant
  window.addEventListener("load", () => setTimeout(() => (window.requestIdleCallback || setTimeout)(() => RQ.loadTools().catch(() => {})), 2500));
  V.studio = () => V.myRoom(); // Studio is no longer its own place: the tools live in Mitt rum, Svep, Hitta rätt and Looks

  /* ---------------------------------------------------------------- router */
  const ROUTES = [
    [/^(hem)?$/, () => V.home()],
    [/^butik$/, () => V.butik()], [/^nyheter$/, () => V.nyheter()], [/^favoriter$/, () => V.favoriter()], [/^erbjudanden$/, () => V.erbjudanden()],
    [/^kategori-(.+)$/, (m) => V.kategori(m[1])], [/^rum$/, () => V.rumindex()], [/^rum-(.+)$/, (m) => V.rum(m[1])],
    [/^kollektioner$/, () => V.kollektioner()], [/^kollektion-(.+)$/, (m) => V.kollektion(m[1])],
    [/^produkt-(.+)$/, (m) => V.produkt(m[1])], [/^onskelista$/, () => V.onskelista()], [/^jamfor$/, () => V.jamfor()],
    [/^magasin$/, () => V.magasin()], [/^artikel-(.+)$/, (m) => V.artikel(m[1])], [/^inspiration$/, () => V.inspiration()],
    [/^juridik-(.+)$/, (m) => V.juridik(m[1])], [/^ideer$/, () => V.onska()],
    [/^(kontakt|faq|frakt|returer|betalning|om|sa-fungerar-det)$/, (m) => V[m[1]]()],
    [/^studio$/, () => V.studio()], [/^(?:studio|mitt)-rum(?:-(.+))?$/, (m) => V.myRoom(m[1])], [/^studio-stil$/, () => V.studioStyle()], [/^studio-analys$/, () => V.studioAnalysis()],
    [/^studio-stylist$/, () => V.studioStylist()], [/^studio-sok$/, () => V.findRight("ord")], [/^studio-hemurval$/, () => V.findRight("")], [/^hitta-ratt(?:-(present|ord))?$/, (m) => V.findRight(m[1] || "")], [/^studio-kombinera(?:-(.+))?$/, (m) => V.studioMix(m[1])],
    [/^upptack$/, () => V.upptack()], [/^svep(?:-rum-(.+))?$/, (m) => V.svep(m[1])], [/^svep-ihop(?:-(.+))?$/, (m) => V.svepIhop(m[1])], [/^for-dig$/, () => V.forDig()], [/^looks$/, () => V.looks()], [/^look-(.+)$/, (m) => V.look(m[1])], [/^(?:rosta|onska)$/, () => V.onska()],
    [/^studio-plus$/, () => V.studioPlus(false)], [/^studio-plus-tack$/, () => V.studioPlus(true)],
    [/^presentguiden$/, () => V.findRight("present")], [/^mitt-hem$/, () => V.myHome()],
    [/^konto$/, () => V.account()], [/^skapa-konto$/, () => V.signup()], [/^kassa$/, () => V.checkout()], [/^order-(.+)$/, (m) => V.orderDone(m[1])], [/^spara-order$/, () => V.track()], [/^angra$/, () => V.withdraw()],
  ];
  let current = null, cleanup = null, firstRun = true;
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  function render(raw) {
    let view = null;
    for (const [re, fn] of ROUTES) { const m = raw.match(re); if (m) { view = fn(m); break; } }
    // in-page anchors such as #faq-2 fall back to their page
    if (!view && /^faq-\d+$/.test(raw)) view = V.faq();
    if (!view) view = V.notfound();
    if (view.lazy) { // a tool that has not loaded yet: keep what is on screen (the prerendered page), load, then draw
      document.documentElement.classList.add("loading-tools");
      RQ.loadTools().then(() => { document.documentElement.classList.remove("loading-tools"); if (currentRaw() === raw) render(raw); }, () => { document.documentElement.classList.remove("loading-tools"); RQ.toast("Sidan kunde inte laddas. Kontrollera anslutningen och försök igen."); });
      return;
    }
    if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
    const root = $("#view");
    const isHome = /^(hem)?$/.test(raw);
    root.className = "view" + (isHome ? " home" : "");
    document.body.classList.toggle("on-home", isHome);
    document.body.classList.toggle("on-product", /^produkt-/.test(raw));
    document.body.classList.toggle("on-checkout", /^kassa$/.test(raw));
    root.innerHTML = view.html;
    const h1 = !view.title && !isHome && root.querySelector("h1");
    document.title = view.title || (isHome ? "RumIQ · Skandinavisk inredning och smarta verktyg för hemmet" : h1 ? `${h1.textContent.trim().replace(/\s+/g, " ")} · RumIQ` : "RumIQ");
    if (current !== raw) window.scrollTo(0, 0);
    current = raw;
    if (view.mount) cleanup = view.mount(root) || null;
    if (RQ.mountBav && root.querySelector(".bav")) { const a = cleanup, b = RQ.mountBav(root); cleanup = () => { a && a(); b(); }; }
    RQ.watch(root);
    RQ.paintShell();
    RQ.markImages(root);
    $$(".menu a").forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + raw));
    const DOCK = { butik: /^(butik|kategori|produkt|nyheter|kollektion|for-dig|favoriter|hitta-ratt|presentguiden|erbjudanden|jamfor)/, upptack: /^(upptack|svep|looks?|rosta|onska|ideer|rum|magasin|artikel|inspiration)(-|$)/, mitt: /^(mitt-rum|studio)/, sparat: /^(mitt-hem|onskelista)$/ };
    $$("[data-dock]").forEach((a) => a.classList.toggle("on", !!(DOCK[a.dataset.dock] && DOCK[a.dataset.dock].test(raw))));
    const anchor = /^faq-\d+$/.test(raw) && document.getElementById(raw);
    if (anchor) anchor.scrollIntoView();
    RQ.navCheck && RQ.navCheck();
  }
  /* Real addresses. Every view has its own path (rumiq.se/produkt-glob-bordslampa-opalglas/) that Google can
     index; the build script writes a prerendered page for each. Links and code inside the site still say
     "#route": a click or a hash change is turned into the path form here, without reloading the page.
     <base href> in every page points at the site root, so relative asset paths keep working. */
  const SITE = new URL(".", document.baseURI);
  const isRoute = (raw) => /^faq-\d+$/.test(raw) || ROUTES.some(([re]) => re.test(raw));
  const pathFor = (raw) => new URL(/^(hem)?$/.test(raw) ? "./" : encodeURIComponent(raw) + "/", SITE).pathname;
  const currentRaw = () => {
    const h = decodeURIComponent(location.hash.replace(/^#/, ""));
    if (h && !h.includes("=")) return h; // "#access_token=…" from a sign-in belongs to the auth client
    let p = location.pathname; const rp = SITE.pathname;
    if (p.startsWith(rp)) p = p.slice(rp.length);
    return decodeURIComponent(p.replace(/index\.html$/, "").replace(/\/+$/, ""));
  };
  RQ.pathFor = pathFor; RQ.isRoute = isRoute; RQ.currentRoute = () => current;
  // prerendered pages carry path links ("butik/") for search engines; inside the running site they are "#butik"
  const toHashLinks = (root) => $$("a[href]", root).forEach((a) => { const h = a.getAttribute("href"); const m = /^(?:\.\/|([a-z0-9-]+)\/)$/.exec(h); if (m) a.setAttribute("href", "#" + (m[1] || "hem")); });
  RQ.toHashLinks = toHashLinks;
  toHashLinks(document);
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest("a[href]"); if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
    const h = a.getAttribute("href"); if (h[0] !== "#" || h.length < 2) return;
    if (a.closest("#sheet")) return; // the quick-view sheet steps its own history entry back first (flow.js)
    e.preventDefault();
    const raw = decodeURIComponent(h.slice(1));
    if (isRoute(raw)) { if (raw !== current) location.hash = h; return; }
    const el = document.getElementById(raw);
    if (el) { el.scrollIntoView({ block: "start" }); if (el.matches("main,section,[tabindex]")) el.focus({ preventScroll: true }); }
    else location.hash = h;
  }, true);
  window.addEventListener("popstate", () => { if (currentRaw() !== current) RQ.router(); });
  RQ.router = () => {
    const raw = currentRaw();
    if (location.hash && isRoute(raw) && !/^faq-\d+$/.test(raw) && !/^svep-ihop-/.test(raw)) { try { history.replaceState(history.state && history.state.rqSheet ? null : history.state, "", pathFor(raw)); } catch (e) {} }
    if (firstRun || !document.startViewTransition || reduced() || raw === current) { firstRun = false; render(raw); return; }
    const t = document.startViewTransition(() => render(raw));
    t.ready.catch(() => {}); t.updateCallbackDone.catch(() => {});
    t.finished.catch(() => {}).finally(() => $$("[style*=view-transition-name]").forEach((el) => { if (!el.closest(".pg-grid")) el.style.viewTransitionName = ""; }));
  };
  // a tapped product image morphs into the product page
  document.addEventListener("click", (e) => {
    const a = e.target.closest(".card a[href^='#produkt-']"); if (!a) return;
    const img = $(".ph img", a.closest(".card")); if (img) img.style.viewTransitionName = "pimg";
  }, true);

  /* images fade in on their tone colour once decoded */
  document.addEventListener("load", (e) => { const t = e.target; if (t.tagName === "IMG" && t.classList.contains("fade")) t.classList.add("ok"); }, true);
  RQ.markImages = (root) => $$("img.fade", root).forEach((im) => { if (im.complete && im.naturalWidth) im.classList.add("ok"); });

  /* ---------------------------------------------------------------- reveal */
  const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }) : null;
  RQ.watch = (root) => $$("[data-watch]:not(.in), .reveal:not(.in), .stagger:not(.in)", root).forEach((el) => (io ? io.observe(el) : el.classList.add("in")));
  RQ.observeImages = (root) => RQ.markImages(root);

  /* ---------------------------------------------------------------- shell: cart drawer, search, menus */
  RQ.paintShell = () => {
    $$("[data-count=cart]").forEach((b) => { const n = S.cartCount(); if (+b.dataset.n < n) { b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump"); } b.textContent = n || ""; b.dataset.n = n; });
    $$("[data-count=cartline]").forEach((b) => { const n = S.cartCount(); b.textContent = n ? `${n} ${n === 1 ? "produkt" : "produkter"}` : ""; });
    $$("[data-count=wish]").forEach((b) => { const n = S._wish.length; b.textContent = n || ""; b.dataset.n = n; });
    $$("[data-count=cmp]").forEach((b) => { const n = S._cmp.length; b.textContent = n || ""; b.dataset.n = n; });
    const c = S.customer(); const acc = $("#accLink"); if (acc) acc.setAttribute("aria-label", c ? "Mitt konto" : "Logga in");
  };
  const drawer = $("#cart"), scrimAll = $("#scrimAll");
  const openCart = () => { renderCart(); closeLight(); drawer.classList.add("open"); scrimAll.classList.add("open"); drawer.setAttribute("aria-hidden", "false"); setTimeout(() => $("#cart .close").focus(), 50); };
  const closeAll = () => { drawer.classList.remove("open"); scrimAll.classList.remove("open"); drawer.setAttribute("aria-hidden", "true"); $("#search").classList.remove("open"); $("#mnav").classList.remove("open"); $("#burger").setAttribute("aria-expanded", "false"); closeMega(); closeLight(); document.documentElement.style.overflow = ""; };
  RQ.openCart = openCart; RQ.closeAll = closeAll;
  function renderCart() {
    const lines = S.cartLines();
    const body = $("#cart .body"), foot = $("#cart footer");
    if (!lines.length) {
      body.innerHTML = RQ.emptyCartHtml();
      foot.innerHTML = ""; return;
    }
    const sub = S.cartSubtotal(), disc = S.lookDiscounts(), net = sub - S.cartDiscount();
    body.innerHTML = RQ.freeShipHtml(net) + RQ.fillGapHtml(lines, net) + lines.map((l) => `<div class="line"><a href="#produkt-${l.product.handle}" data-close><img src="${RQ.img(l.product, 600)}" alt=""></a><div><h4><a href="#produkt-${l.product.handle}" data-close>${esc(l.product.name)}</a></h4>${l.variant.title !== "Standard" ? `<div class="v">${esc(l.variant.title)}</div>` : ""}<div class="qty"><button type="button" data-line="${l.id}" data-d="-1" aria-label="Minska">−</button><input value="${l.quantity}" aria-label="Antal" readonly><button type="button" data-line="${l.id}" data-d="1" aria-label="Öka">+</button></div><button class="rm" type="button" data-rm="${l.id}">Ta bort</button></div><span class="lp">${kr(l.lineTotal)}</span></div>`).join("") +
      `<div class="example-note" style="margin-top:1.2rem"><span>●</span><span><b>Testläge.</b> Varukorgen innehåller exempelprodukter. Du kan prova kassan, men inget betalas och inget skickas.</span></div>`;
    foot.innerHTML = `<div class="sum"><span>Delsumma</span><span>${kr(sub)}</span></div>${disc.map((d) => `<div class="sum disc"><span>Hela looken ${esc(d.look.name)}</span><span>−${kr(d.amount)}</span></div>`).join("")}<div class="sum small"><span>Frakt</span><span>${S.freeShipping && S.freeShipping() ? "Fri till ombud och paketskåp" : "Från 49 kr"}</span></div><div class="sum small"><span>Varav moms (25 %)</span><span>${kr(S.vatIncluded(net))}</span></div><a class="btn block" href="#kassa" data-close>Till kassan</a><button class="btn ghost block" type="button" data-cart-room>${RQ.roomIco}Se varorna i ditt rum</button>`;
  }
  S.onChange((w) => { RQ.paintShell(); if (drawer.classList.contains("open")) renderCart(); });
  // day/evening on a room picture: the same room after sunset, so you see how the lamps change it
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-dn]"); if (!b) return; const sec = b.closest(".rm-shop"); const st = sec && $(".hs-stage", sec); if (!st) return; st.classList.toggle("eve", b.dataset.dn === "kvall"); $$("[data-dn]", sec).forEach((x) => x.setAttribute("aria-pressed", x === b)); });
  RQ.payRow = () => { const m = (window.RQ_CONFIG || {}).payments || []; return m.length ? `<ul class="payrow" aria-label="Betalsätt">${m.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""; };
  // price with the Swedish rule for reductions: when a product is on sale (p.was = earlier price) the lowest price of
  // the last 30 days (p.low30, from Shopify price history) is shown next to the new price (prisinformationslagen 7 a §)
  RQ.priceHtml = (p, kind) => {
    const cls = kind === "pdp" ? "pprice" : "price";
    if (!p.was || p.was <= p.price) return `<span class="${cls}">${kr(p.price)}</span>`;
    const low = p.low30 || p.was;
    return `<span class="${cls} sale">${kr(p.price)}</span><span class="low30">Tidigare lägsta pris (30 dagar): ${kr(low)}</span>`;
  };
  // two things that close the gap to free shipping, picked from the rooms already in the cart
  RQ.fillGapHtml = (lines, net) => {
    const from = (window.RQ_CONFIG || {}).freeShippingFrom; if (!from || !lines.length || net >= from) return "";
    const gap = from - net, inCart = new Set(lines.map((l) => l.product.handle)), rooms = new Set(lines.flatMap((l) => l.product.rooms));
    const picks = RQ.PRODUCTS.filter((p) => !inCart.has(p.handle) && p.price >= gap && p.price <= gap + 400)
      .sort((a, b) => (b.rooms.some((r) => rooms.has(r)) - a.rooms.some((r) => rooms.has(r))) || a.price - b.price).slice(0, 2);
    if (!picks.length) return "";
    return `<div class="gap"><p class="eyebrow">Passar till det du valt</p>${picks.map((p) => `<div class="gap-i"><img src="${RQ.cut(p)}" alt="" loading="lazy"><span><b>${esc(p.name)}</b><small>${kr(p.price)}</small></span><button class="btn sm ghost" type="button" data-add="${p.handle}::0" aria-label="Lägg ${esc(p.name)} i varukorgen">Lägg till</button></div>`).join("")}</div>`;
  };
  RQ.freeShipHtml = (net) => {
    const from = (window.RQ_CONFIG || {}).freeShippingFrom; if (!from) return "";
    const left = Math.max(0, from - net), pct = Math.min(100, Math.round((net / from) * 100));
    return `<div class="fsm" role="status"><p>${left ? `<b>${kr(left)}</b> kvar till fri frakt` : "<b>Fri frakt</b> på den här beställningen"}</p><span class="fsm-bar"><i style="width:${pct}%"></i></span></div>`;
  };
  // an empty cart or checkout is never a dead end: two looks and what you looked at last
  RQ.emptyCartHtml = (wide) => {
    const seen = (S.recentlySeen ? S.recentlySeen("") : []).slice(0, wide ? 4 : 2);
    return `<div class="empty-cart${wide ? " wide" : ""}"><h3>Varukorgen är tom</h3><p>Börja med en färdig look. Hela looken ger ${Math.round(((window.RQ_CONFIG || {}).lookDiscount || 0) * 100)} % rabatt.</p>
      <div class="ec-looks">${RQ.LOOKS.slice(0, 2).map((l) => `<a class="ec-look" href="#look-${l.id}" data-close><span class="ec-imgs">${l.items.slice(0, 3).map((h) => `<img src="${RQ.cut(RQ.byHandle(h))}" alt="" loading="lazy">`).join("")}</span><span><b>${esc(l.name)}</b><small>${l.items.length} saker</small></span></a>`).join("")}</div>
      ${seen.length ? `<p class="eyebrow" style="margin-top:1.6rem">Senast visade</p><div class="ec-seen">${seen.map((p) => `<a href="#produkt-${p.handle}" data-close><img src="${RQ.img(p, 600)}" alt=""><span>${esc(p.name)}</span></a>`).join("")}</div>` : ""}
      ${RQ.svepNudge ? RQ.svepNudge("Vet du inte var du ska börja?", "Svep tio kort, så hittar vi det som passar dig.").replace('class="sv-nudge"', 'class="sv-nudge" data-close') : ""}
      <a class="btn ghost" href="#butik" data-close style="margin-top:1.6rem">Till butiken</a></div>`;
  };

  // search overlay
  const sInput = $("#searchInput"), sRes = $("#searchRes");
  const doSearch = () => {
    const q = sInput.value.trim(), tones = RQ.toneChips ? RQ.toneChips() : "", ext = RQ.flowSearch ? RQ.flowSearch(q) : null;
    if (!q && !ext) { sRes.innerHTML = `<p class="eyebrow" style="margin-bottom:1rem">Populärt</p><div class="chips">${["Lampa", "Ek", "Lin", "Förvaring", "Badrum", "Present", "Hall", "Lugnt och varmt", "Mjukt i sovrummet"].map((t) => `<button class="chip" type="button" data-q="${t}">${t}</button>`).join("")}</div>${tones}`; return; }
    if (ext) { sRes.innerHTML = `${tones}${ext.note ? `<p class="small s-note">${ext.note}</p>` : ""}${ext.list.length ? `<p class="eyebrow" style="margin-bottom:1rem">${ext.list.length} produkter</p>${RQ.grid(ext.list)}` : `<div class="empty"><h3>Inga träffar</h3><p>Prova en annan färg eller ett annat ord.</p></div>`}`; RQ.watch(sRes); return; }
    const list = S.list({ query: q });
    const arts = RQ.ARTICLES.filter((a) => S.norm(a.title + " " + a.lead).includes(S.norm(q)));
    const cats = RQ.CATEGORIES.filter((c) => S.norm(c.name).includes(S.norm(q)));
    sRes.innerHTML = `${cats.length ? `<div class="chips" style="margin-bottom:1.6rem">${cats.map((c) => `<a class="chip" href="#kategori-${c.id}" data-close>${esc(c.name)}</a>`).join("")}</div>` : ""}
      ${list.length ? `<p class="eyebrow" style="margin-bottom:1rem">${list.length} produkter</p>${RQ.grid(list)}` : `<div class="empty"><h3>Inga träffar på "${esc(q)}"</h3><p>Prova ett annat ord, eller beskriv vad du behöver i den smarta sökningen.</p><a class="btn ghost" href="#studio-sok" data-close>Smart sökning</a></div>${RQ.svepNudge ? RQ.svepNudge("Hittar du inte rätt ord?", "Svep i stället. Tio kort, så visar vi vad som passar dig.").replace('class="sv-nudge"', 'class="sv-nudge" data-close') : ""}`}
      ${arts.length ? `<p class="eyebrow" style="margin:2.4rem 0 1rem">Från magasinet</p><div class="mag-grid">${arts.slice(0, 3).map(RQ.magCard).join("")}</div>` : ""}`;
    RQ.watch(sRes);
  };
  RQ.doSearch = doSearch;
  let sT; sInput.addEventListener("input", () => { clearTimeout(sT); sT = setTimeout(doSearch, 140); });
  RQ.openSearch = () => { closeAll(); $("#search").classList.add("open"); document.documentElement.style.overflow = "hidden"; doSearch(); setTimeout(() => sInput.focus(), 60); };

  // mega menus
  const megaBtns = $$("[data-mega]");
  function closeMega() { megaBtns.forEach((b) => b.setAttribute("aria-expanded", "false")); $$(".mega").forEach((m) => m.classList.remove("open")); $("#nav").classList.remove("open"); }
  megaBtns.forEach((b) => {
    const m = document.getElementById(b.dataset.mega);
    const open = () => { closeMega(); b.setAttribute("aria-expanded", "true"); m.classList.add("open"); $("#nav").classList.add("open"); };
    b.addEventListener("click", () => (b.getAttribute("aria-expanded") === "true" ? closeMega() : open()));
    b.parentElement.addEventListener("mouseenter", () => matchMedia("(hover:hover)").matches && open());
  });
  $("#nav").addEventListener("mouseleave", () => matchMedia("(hover:hover)").matches && closeMega());

  // global clicks
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-wish],[data-compare],[data-add],[data-open-cart],[data-close],[data-open-search],[data-q],[data-rm],[data-line],[data-action],[data-cart-room],#burger,#mnavClose,a[href^='#']");
    if (!t) { if (!e.target.closest(".mega,.nav")) closeMega(); return; }
    if (t.matches("[data-wish]")) { const on = S.toggleWish(t.dataset.wish); t.setAttribute("aria-pressed", on); if (t.classList.contains("chip")) t.textContent = on ? "Sparad i önskelistan" : "Spara i önskelistan"; if (t.closest(".pactions")) $("span", t).textContent = on ? "Sparad" : "Spara"; if (on && RQ.flyWish) RQ.flyWish(t); RQ.toast(on ? 'Sparad i Mitt hem. <a href="#mitt-hem">Visa</a>' : "Borttagen ur Mitt hem"); return; }
    if (t.matches("[data-compare]")) { const on = S.toggleCompare(t.dataset.compare); if (t.classList.contains("chip")) { t.setAttribute("aria-pressed", on); t.textContent = on ? "I jämförelsen" : "Jämför"; } else if (t.closest(".pactions")) { t.setAttribute("aria-pressed", on); $("span", t).textContent = on ? "I jämförelsen" : "Jämför"; } else if (t.classList.contains("btn")) t.textContent = on ? "I jämförelsen" : "Jämför"; RQ.toast(on ? `Tillagd i jämförelsen (${S._cmp.length} av 4). <a href="#jamfor">Jämför</a>` : "Borttagen ur jämförelsen"); if (current === "jamfor") RQ.router(); return; }
    if (t.matches("[data-add]")) { S.addToCart(t.dataset.add, 1); const pr = RQ.byHandle(t.dataset.add.split("::")[0]); RQ.confirmAdd(t, pr ? pr.name : ""); return; }
    if (t.matches("[data-open-cart]")) { e.preventDefault(); openCart(); return; }
    if (t.matches("[data-open-search]")) { e.preventDefault(); RQ.openSearch(); return; }
    if (t.matches("[data-q]") && t.closest("#searchRes")) { sInput.value = t.dataset.q; doSearch(); return; }
    if (t.matches("[data-rm]")) { S.setQty(t.dataset.rm, 0); return; }
    if (t.matches("[data-line]")) { const l = S.cartLines().find((x) => x.id === t.dataset.line); if (l) S.setQty(l.id, l.quantity + +t.dataset.d); return; }
    if (t.matches("[data-action=cookies]")) { RQ.showCookies(true); return; }
    if (t.id === "burger") { $("#mnav").classList.add("open"); t.setAttribute("aria-expanded", "true"); document.documentElement.style.overflow = "hidden"; setTimeout(() => $("#mnavClose").focus(), 60); return; }
    if (t.id === "mnavClose") { closeAll(); return; }
    if (t.matches("a[data-after]")) RQ.ss.set("rumiq-after-login", "#" + t.dataset.after);
    if (t.matches("[data-close]") || t.matches("a[href^='#']")) { closeAll(); }
    if (t.matches("[data-cart-room]")) { const hs = S.cartLines().map((l) => l.product.handle); const go = () => { hs.forEach((h) => RQ.room.add(h, true)); location.hash = "#mitt-rum"; }; closeAll(); if (RQ.room.has()) go(); else RQ.room.openSetup(go); }
  });
  scrimAll.addEventListener("click", closeAll);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAll(); if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !e.target.closest("input,textarea,select"))) { e.preventDefault(); RQ.openSearch(); } });

  // nav state on scroll
  const nav = $("#nav"); let solid = null;
  const navCheck = () => { const s = !document.body.classList.contains("on-home") || window.scrollY > window.innerHeight * 0.35; if (s !== solid) { solid = s; nav.classList.toggle("solid", s); } };
  window.addEventListener("scroll", navCheck, { passive: true });
  RQ.navCheck = navCheck;

  // cookie banner
  RQ.showCookies = (force) => {
    const box = $("#cookie");
    const c = S.consent();
    if (c && !force) return;
    box.classList.add("show");
    $("#ckStats").checked = !!(c && c.stats); $("#ckMkt").checked = !!(c && c.mkt);
  };
  $("#ckAll").addEventListener("click", () => { S.setConsent({ stats: true, mkt: true }); $("#cookie").classList.remove("show"); });
  $("#ckNeed").addEventListener("click", () => { S.setConsent({ stats: false, mkt: false }); $("#cookie").classList.remove("show"); });
  $("#ckSave").addEventListener("click", () => { S.setConsent({ stats: $("#ckStats").checked, mkt: $("#ckMkt").checked }); $("#cookie").classList.remove("show"); });
  $("#ckMore").addEventListener("click", () => { $("#cookie .opts").hidden = !$("#cookie .opts").hidden; });


  // add-to-cart feedback: the button itself confirms, the cart count bumps
  RQ.confirmAdd = (btn, name) => {
    if (btn && btn.classList) {
      const isQ = btn.classList.contains("qadd");
      if (!btn.dataset.label) btn.dataset.label = btn.innerHTML;
      btn.classList.add("done");
      btn.innerHTML = isQ ? '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg><span>Tillagd</span>' : "Tillagd i varukorgen";
      clearTimeout(btn._t); btn._t = setTimeout(() => { btn.classList.remove("done"); btn.innerHTML = btn.dataset.label; }, 1800);
    }
    RQ.toast(`${name ? esc(name) + " ligger i varukorgen." : "Lagd i varukorgen."} <a href="#" data-open-cart>Visa</a>`);
  };

  // daylight switch
  const lampBtn = $("#lampBtn"), lightMenu = $("#lightMenu");
  const LIGHT_LABEL = { auto: "Följ dagsljuset", dag: "Dag", kvall: "Kväll" };
  const sunNow = () => { const d = new Date(), h = d.getHours() + d.getMinutes() / 60, S2 = [[8.7, 15], [7.6, 16.3], [6.3, 17.7], [6.2, 19.9], [4.8, 21], [3.7, 22], [4, 21.9], [5.2, 20.7], [6.6, 19.1], [7.9, 17.4], [7.4, 15.4], [8.6, 14.8]][d.getMonth()]; return h < S2[0] || h >= Math.max(S2[1], 17) ? "kvall" : "dag"; };
  const applyLight = (mode) => {
    const r = document.documentElement, t = mode === "auto" ? sunNow() : mode;
    r.setAttribute("data-light", t); r.setAttribute("data-light-mode", mode);
    try { localStorage.setItem("rumiq-light", mode); } catch (e) {}
    const tc = $("meta[name=theme-color]"); if (tc) tc.content = t === "kvall" ? "#191A18" : "#EDEDEA";
    $$("[data-light-set]").forEach((b) => b.setAttribute("aria-checked", b.dataset.lightSet === mode));
    $$("[data-light-label]").forEach((el) => (el.textContent = LIGHT_LABEL[mode]));
  };
  RQ.applyLight = applyLight;
  function closeLight() { if (lightMenu) { lightMenu.classList.remove("open"); lampBtn.setAttribute("aria-expanded", "false"); } }
  if (lampBtn) {
    applyLight(document.documentElement.getAttribute("data-light-mode") || "auto");
    lampBtn.addEventListener("click", (e) => { e.stopPropagation(); const open = !lightMenu.classList.contains("open"); closeMega(); lightMenu.classList.toggle("open", open); lampBtn.setAttribute("aria-expanded", open); if (open) setTimeout(() => $("[aria-checked=true]", lightMenu)?.focus(), 30); });
    lightMenu.addEventListener("click", (e) => { const b = e.target.closest("[data-light-set]"); if (!b) return; e.stopPropagation(); applyLight(b.dataset.lightSet); closeLight(); lampBtn.focus(); });
    document.addEventListener("click", (e) => { if (!e.target.closest(".lampwrap")) closeLight(); });
    $$("[data-light-cycle]").forEach((b) => b.addEventListener("click", () => { const order = ["auto", "dag", "kvall"]; const cur = document.documentElement.getAttribute("data-light-mode") || "auto"; applyLight(order[(order.indexOf(cur) + 1) % 3]); }));
    setInterval(() => { if ((document.documentElement.getAttribute("data-light-mode") || "auto") === "auto") applyLight("auto"); }, 5 * 60 * 1000);
  }

  // dock steps aside while reading downwards, returns on the way up
  const dock = $("#dock"); let lastY = scrollY, dockTick = false;
  window.addEventListener("scroll", () => { if (dockTick || !dock) return; dockTick = true; requestAnimationFrame(() => { const y = scrollY; if (Math.abs(y - lastY) > 8) { dock.classList.toggle("away", y > lastY && y > 240); lastY = y; } dockTick = false; }); }, { passive: true });

  /* ---------------------------------------------------------------- lightbox: pinch, double tap, wheel, drag, swipe, keys */
  RQ.lightbox = (() => {
    const el = document.createElement("div");
    el.className = "lb"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Bildvisning"); el.hidden = false;
    el.innerHTML = `<div class="lb-top"><div class="t"><b class="lb-title"></b><span class="lb-count"></span></div><div class="lb-ctrl"><button class="iconbtn" type="button" data-z="-1" aria-label="Zooma ut"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2M8.5 11h5"/></svg></button><button class="iconbtn" type="button" data-z="1" aria-label="Zooma in"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2M11 8.5v5M8.5 11h5"/></svg></button><button class="iconbtn lb-x" type="button" aria-label="Stäng bildvisningen"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div></div>
      <div class="lb-stage"><img class="lb-img" alt=""><p class="lb-hint">Dubbeltryck eller nyp för att zooma</p></div>
      <button class="lb-nav prev" type="button" aria-label="Föregående bild"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button><button class="lb-nav next" type="button" aria-label="Nästa bild"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button>
      <div class="lb-foot"></div>`;
    document.body.appendChild(el);
    const stage = $(".lb-stage", el), img = $(".lb-img", el), foot = $(".lb-foot", el), count = $(".lb-count", el), title = $(".lb-title", el), hint = $(".lb-hint", el);
    let list = [], i = 0, s = 1, x = 0, y = 0, bw = 0, bh = 0, back = null, swipe = null;
    const pts = new Map(); let pinch = null, lastTap = 0, moved = false;
    const MAX = 4;
    const fit = () => { const W = stage.clientWidth, H = stage.clientHeight; const nw = img.naturalWidth || 1200, nh = img.naturalHeight || 1500; const k = Math.min(W / nw, H / nh, 1.6); bw = nw * k; bh = nh * k; img.style.width = bw + "px"; img.style.height = bh + "px"; };
    const clamp = () => { const W = stage.clientWidth, H = stage.clientHeight; const mx = Math.max(0, (bw * s - W) / 2), my = Math.max(0, (bh * s - H) / 2); x = Math.min(mx, Math.max(-mx, x)); y = Math.min(my, Math.max(-my, y)); };
    const paint = (anim) => { img.classList.toggle("anim", !!anim); img.style.transform = `translate(${x - bw * s / 2}px, ${y - bh * s / 2}px) scale(${s})`; const z = s > 1.01; stage.classList.toggle("zoomed", z); el.classList.toggle("zoomed", z); };
    const zoomAt = (ns, cx, cy, anim) => { const r = stage.getBoundingClientRect(); const px = cx - r.left - r.width / 2, py = cy - r.top - r.height / 2; ns = Math.min(MAX, Math.max(1, ns)); x = px - (px - x) * (ns / s); y = py - (py - y) * (ns / s); s = ns; if (s === 1) { x = 0; y = 0; } clamp(); paint(anim); };
    const show = (k, dir) => {
      i = (k + list.length) % list.length; const g = list[i]; s = 1; x = 0; y = 0;
      img.classList.toggle("cut", !!g.cut); img.alt = g.alt || "";
      img.style.opacity = 0;
      const done = () => { fit(); paint(false); img.style.transition = "opacity .25s"; img.style.opacity = 1; };
      img.onload = done; img.src = g.src; if (img.complete && img.naturalWidth) done();
      count.textContent = `${i + 1} / ${list.length}`;
      $$("button", foot).forEach((b, n) => b.setAttribute("aria-current", n === i));
    };
    const open = (items, start, name) => {
      list = items; back = document.activeElement; title.textContent = name || "";
      foot.innerHTML = list.length > 1 ? list.map((g, n) => `<button type="button" aria-label="Bild ${n + 1}"><img src="${g.thumb}" alt=""></button>`).join("") : "";
      foot.hidden = list.length < 2; $$(".lb-nav", el).forEach((b) => (b.hidden = list.length < 2));
      el.classList.add("open"); document.documentElement.style.overflow = "hidden";
      hint.style.opacity = 1; setTimeout(() => (hint.style.opacity = 0), 2600);
      show(start || 0); setTimeout(() => $(".lb-x", el).focus(), 50);
    };
    const close = () => { el.classList.remove("open"); document.documentElement.style.overflow = ""; pts.clear(); if (back && back.focus) back.focus({ preventScroll: true }); };
    el.addEventListener("click", (e) => {
      if (e.target.closest(".lb-x")) return close();
      if (e.target.closest(".lb-nav.prev")) return show(i - 1);
      if (e.target.closest(".lb-nav.next")) return show(i + 1);
      const z = e.target.closest("[data-z]"); if (z) { const r = stage.getBoundingClientRect(); zoomAt(+z.dataset.z > 0 ? s * 1.6 : s / 1.6, r.left + r.width / 2, r.top + r.height / 2, true); return; }
      const t = e.target.closest(".lb-foot button"); if (t) show($$("button", foot).indexOf(t));
    });
    stage.addEventListener("wheel", (e) => { e.preventDefault(); zoomAt(s * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX, e.clientY, false); }, { passive: false });
    stage.addEventListener("pointerdown", (e) => {
      try { stage.setPointerCapture(e.pointerId); } catch (x) {} pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = false;
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; swipe = null; }
      else swipe = { x0: e.clientX, y0: e.clientY, x: x, y: y, t: Date.now() };
      if (s > 1) stage.classList.add("drag");
    });
    stage.addEventListener("pointermove", (e) => {
      if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pts.size === 2) { const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); zoomAt(pinch.s * d / pinch.d, (a.x + b.x) / 2, (a.y + b.y) / 2, false); moved = true; return; }
      if (!swipe) return; const dx = e.clientX - swipe.x0, dy = e.clientY - swipe.y0; if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
      if (s > 1) { x = swipe.x + dx; y = swipe.y + dy; clamp(); paint(false); }
      else { img.style.transform = `translate(${dx - bw / 2}px, ${Math.max(0, dy) - bh / 2}px) scale(${1 - Math.min(.15, Math.max(0, dy) / 1600)})`; el.style.background = `rgba(14,15,14,${0.96 - Math.min(.5, Math.max(0, dy) / 600)})`; }
    });
    const end = (e) => {
      if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId); stage.classList.remove("drag");
      if (pinch) { if (pts.size < 2) { pinch = null; const r = [...pts.values()][0]; swipe = r ? { x0: r.x, y0: r.y, x, y, t: Date.now() } : null; } return; }
      if (!swipe) return; const dx = e.clientX - swipe.x0, dy = e.clientY - swipe.y0, dt = Date.now() - swipe.t; swipe = null; el.style.background = "";
      if (s === 1 && moved) { if (dy > 110 && Math.abs(dy) > Math.abs(dx)) return close(); if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) return show(i + (dx < 0 ? 1 : -1)); paint(true); return; }
      if (!moved && dt < 300) { const now = Date.now(); if (now - lastTap < 320) { zoomAt(s > 1.01 ? 1 : 2.5, e.clientX, e.clientY, true); lastTap = 0; } else lastTap = now; }
    };
    stage.addEventListener("pointerup", end); stage.addEventListener("pointercancel", end);
    stage.addEventListener("dblclick", (e) => e.preventDefault());
    document.addEventListener("keydown", (e) => {
      if (!el.classList.contains("open")) return;
      if (e.key === "Escape") { e.stopImmediatePropagation(); close(); }
      else if (e.key === "ArrowRight") show(i + 1);
      else if (e.key === "ArrowLeft") show(i - 1);
      else if (e.key === "+" || e.key === "=") { const r = stage.getBoundingClientRect(); zoomAt(s * 1.5, r.left + r.width / 2, r.top + r.height / 2, true); }
      else if (e.key === "-") { const r = stage.getBoundingClientRect(); zoomAt(s / 1.5, r.left + r.width / 2, r.top + r.height / 2, true); }
      else if (e.key === "0") zoomAt(1, 0, 0, true);
      else if (e.key === "Tab") { const f = $$("button:not([hidden])", el).filter((b) => b.offsetParent); const k = f.indexOf(document.activeElement); if (e.shiftKey && k <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && k === f.length - 1) { e.preventDefault(); f[0].focus(); } }
    }, true);
    window.addEventListener("resize", () => { if (el.classList.contains("open")) { fit(); clamp(); paint(false); } });
    return { open, close };
  })();

  // language: Swedish in the code, English from the phrase dictionary (i18n.js)
  if (window.RQ_LANG === "en") {
    $$("[data-lang-short]").forEach((b) => { b.textContent = "SV"; b.lang = "sv"; b.setAttribute("aria-label", "På svenska"); });
    $$("[data-lang-long]").forEach((b) => { b.textContent = "Svenska"; b.lang = "sv"; });
  }
  $$(".lang").forEach((b) => b.addEventListener("click", () => { S.setLang(window.RQ_LANG === "en" ? "sv" : "en"); location.reload(); }));

  // footer newsletter: RumIQ's sign-up table (or a form service, see config.js)
  $("#newsForm").addEventListener("submit", async (e) => { e.preventDefault(); const f = e.currentTarget, v = f.email.value.trim(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { RQ.toast("Skriv en giltig e-postadress."); return; }
    const res = await RQ.subscribe({ email: v, lista: "Nyhetsbrev" });
    RQ.toast(res === "sent" ? "Tack. Du får nyhetsbrevet och 10 % på första köpet när vi öppnar." : res === "preview" ? "Förhandsversion: adressen sparades inte här." : "Det gick inte att skicka just nu. Försök igen om en stund."); if (res !== "error") f.reset(); });
  // company details in the footer (RQ_CONFIG.company)
  (() => { const c = (window.RQ_CONFIG || {}).company || {}, el = $("#coInfo"); if (!el) return; const parts = [c.name, c.orgnr && "Org.nr " + c.orgnr, c.address, c.phone].filter(Boolean);
    el.textContent = parts.length ? parts.join(" · ") : "Företagsnamn, organisationsnummer, adress och telefon visas här när bolaget är registrerat."; })();

  // product tabs: Om, Mått och skötsel, Frakt och retur (arrow keys move between them)
  const tabTo = (bar, t) => { $$("[role=tab]", bar).forEach((x) => { const on = x === t; x.setAttribute("aria-selected", on); x.tabIndex = on ? 0 : -1; const pnl = document.getElementById(x.getAttribute("aria-controls")); if (pnl) pnl.hidden = !on; }); };
  document.addEventListener("click", (e) => { const t = e.target.closest("[data-ptabs] [role=tab]"); if (t) tabTo(t.parentNode, t); });
  document.addEventListener("keydown", (e) => { const t = e.target.closest && e.target.closest("[data-ptabs] [role=tab]"); if (!t || !/^Arrow(Left|Right)$/.test(e.key)) return; const all = $$("[role=tab]", t.parentNode), i = all.indexOf(t), n = all[(i + (e.key === "ArrowRight" ? 1 : all.length - 1)) % all.length]; tabTo(t.parentNode, n); n.focus(); e.preventDefault(); });

  // pages with nothing to show yet stay out of the menus: Erbjudanden until a product is on sale, Nyheter until RQ_CONFIG.showNews
  const showFlags = () => { const c = window.RQ_CONFIG || {}, h = document.documentElement; h.toggleAttribute("data-no-offers", !RQ.PRODUCTS.some((p) => p.was)); h.toggleAttribute("data-no-news", !c.showNews); };
  showFlags();

  window.addEventListener("hashchange", RQ.router);
  document.addEventListener("DOMContentLoaded", () => { RQ.router(); navCheck(); setTimeout(() => RQ.showCookies(false), 1200); });
})();
