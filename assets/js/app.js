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
  // the toast rises at the bottom, just above whatever bar is there (dock, buy bar, the cart's footer), never over the header
  const toastLift = () => {
    const H = innerHeight; let top = H;
    (document.elementsFromPoint ? [...document.elementsFromPoint(innerWidth / 2, H - 6), ...document.elementsFromPoint(innerWidth / 2, H - 30)] : []).forEach((el) => {
      for (let n = el; n && n !== document.body && n.id !== "toast"; n = n.parentElement) {
        const pos = getComputedStyle(n).position; if (pos !== "fixed" && pos !== "sticky") continue;
        const bar = n.id === "cart" ? n.querySelector("footer") : n, r = bar ? bar.getBoundingClientRect() : null;
        if (r && r.height && r.height < H * 0.5 && r.bottom > H - 40) top = Math.min(top, r.top);
        break;
      }
    });
    return Math.max(0, Math.round(H - top));
  };
  RQ.toast = (html, ms) => {
    const t = $("#toast"); t.innerHTML = html; t.style.setProperty("--toast-lift", toastLift() + "px"); t.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), ms || 3600);
  };
  const swatches = (p) => (p.variants ? `<span class="swatches" role="img" aria-label="${p.variants.length} färger">${p.tone.slice(0, p.variants.length).map((c) => `<i style="background:${c}"></i>`).join("")}</span>` : "");
  const plus = '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>';
  RQ.plus = plus;
  const roomIco = '<svg viewBox="0 0 24 24"><path d="M3.5 20V10l8.5-6 8.5 6v10"/><path d="M9 20v-5.5h6V20"/></svg>';
  RQ.roomIco = roomIco;
  /* first: "eager" or "high" for the cards at the top of a list (the pictures a visitor sees first are fetched at once, "high" with priority) */
  RQ.card = (p, first) => {
    const R = RQ.room, on = R && R.mode(), m = on ? R.match(p) : null;
    const print = RQ.isPrint && RQ.isPrint(p);
    const photo = print ? `<img class="fade cutph" src="${RQ.cut(p)}" alt="${esc(p.name)}" ${first ? 'loading="eager"' : 'loading="lazy"'} decoding="async" width="461" height="600">`
      : `<img class="fade" src="${RQ.img(p, 600)}" srcset="${RQ.img(p, 600)} 600w, ${RQ.img(p, 900)} 900w" sizes="(max-width:640px) 50vw, (max-width:1100px) 33vw, 25vw" alt="${esc(p.name)}" ${first === "high" ? 'fetchpriority="high"' : first === "eager" ? 'loading="eager"' : 'loading="lazy"'} decoding="async" width="600" height="750">`;
    // with "Visa i mitt rum" on, the product photo still comes first; the room is the second picture (hover, or swipe on a phone)
    const ph = on ? `${photo}<span class="hov inroom">${R.layer(p)}<i class="inr-tag">I ditt rum</i></span>`
      : `${photo}<img class="hov fade" data-src="${print ? RQ.img(p, 600) : `assets/img/d/${p.handle}-600.webp`}" alt="" decoding="async" width="600" height="750" onerror="this.remove()">`;
    return `
    <article class="card${on ? " in-room" : ""}" style="--tone:${p.tone[0]}22">
      <a class="ph" href="#produkt-${p.handle}" tabindex="-1" aria-hidden="true">${ph}</a>${on ? '<span class="ph-dots" aria-hidden="true"><i></i><i></i></span>' : ""}
      <button class="iconbtn fav" type="button" data-wish="${p.handle}" aria-pressed="${S.isWished(p.handle)}" aria-label="Spara ${esc(p.name)} i önskelistan">${I.heart}</button>
      <button class="iconbtn rbtn" type="button" data-room-btn="${p.handle}" aria-pressed="${!!(R && R.inScene(p.handle))}" aria-label="Ställ in ${esc(p.name)} i mitt rum">${roomIco}</button>
      <button class="qadd" type="button" data-add="${p.handle}::0" aria-label="Lägg ${esc(p.name)} i varukorgen">${plus}<span>Lägg till</span></button>
      <button class="qv" type="button" data-sheet="${p.handle}" aria-label="Snabbtitt på ${esc(p.name)}"><svg viewBox="0 0 24 24"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/></svg><span>Snabbtitt</span></button>
      <div class="ct"><h3><a href="#produkt-${p.handle}">${esc(p.name)}</a></h3>${RQ.priceHtml(p, "card")}</div>
      <p class="sub">${m ? `<span class="fm" title="Hur väl produktens färger passar ditt rum">${m} % färgmatch</span>` : swatches(p)}</p>
    </article>`;
  };
  RQ.grid = (list, cls = "", top = false) => (list.length ? `<div class="grid ${cls}">${list.map((p, i) => RQ.card(p, top && i < 2 ? "high" : top && i < 4 ? "eager" : "")).join("")}</div>` : `<div class="empty"><h3>Inga produkter här än</h3><p>Sortimentet växer. Titta in igen snart, eller se allt vi har just nu.</p><a class="btn ghost" href="#butik">Alla produkter</a></div>`);
  const crumbs = (items) => `<ol class="crumbs">${items.map(([t, h]) => `<li>${h ? `<a href="#${h}">${esc(t)}</a>` : esc(t)}</li>`).join("")}</ol>`;
  RQ.crumbs = crumbs;
  const head = (kicker, title, lead, extra = "") => `<header class="page-head wrap">${kicker}<h1 class="h1">${title}</h1>${lead ? `<p class="lead">${lead}</p>` : ""}${extra}</header>`;
  RQ.head = head;

  /* ---------------------------------------------------------------- views */
  const V = (RQ.views = {});

  /* ---- in-place filters for a product list: category, room, price span and colour family ---- */
  const SPANS = [["0-300", "Under 300 kr", 0, 300], ["300-600", "300–600 kr", 300, 600], ["600-1000", "600–1 000 kr", 600, 1000], ["1000-", "Över 1 000 kr", 1000, Infinity]];
  const FAMS = [["vit", "Vit", "#F2F0EC"], ["beige", "Beige", "#D8C6A8"], ["brun", "Brun", "#B88A5A"], ["terrakotta", "Terrakotta", "#B8714A"], ["gron", "Grön", "#A9B39A"], ["gra", "Grå", "#9E9890"], ["svart", "Svart", "#3A3936"]];
  /* a product's colour families, read from its two tones (hue, saturation, lightness) */
  const famOf = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    const sat = d ? d / (1 - Math.abs(2 * l - 1)) : 0, hue = !d ? 0 : ((mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60 + 360) % 360;
    if (l < 0.32) return "svart"; if (sat < 0.1) return l > 0.86 ? "vit" : "gra"; if (l > 0.86) return "vit";
    if (hue >= 60 && hue <= 170) return "gron"; if (hue < 26 && sat > 0.3) return "terrakotta"; return l > 0.72 ? "beige" : "brun";
  };
  RQ.colours = (p) => p._fam || (p._fam = [...new Set((p.tone || []).map(famOf))]);
  const FKEYS = ["cat", "room", "price", "tone"];
  const fIco = '<svg viewBox="0 0 24 24"><path d="M4 7h16M7 12h10M10 17h4"/></svg>';
  const xIco = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const nProd = (n) => `${n} ${n === 1 ? "produkt" : "produkter"}`;
  RQ.nProd = nProd;

  let modeAt = 0; document.addEventListener("click", (e) => { if (e.target.closest && e.target.closest("[data-room-mode]")) modeAt = Date.now(); }, true);
  // Shop listing used by #butik, #kategori-x, #rum-x, #kollektion-x, #nyheter, #favoriter
  function shopView({ title, kicker, lead, cat = null, room = null, col = null, sort = "rel", banner = null, extraTop = "", extraBottom = "", trail, only = null, noSort = false }) {
    /* what the visitor chose on this list is kept for the visit, so Back from a product shows the same list */
    const key = "rumiq-shop:" + (cat ? "k-" + cat : room ? "r-" + room : col ? "c-" + col : title);
    let saved = {}; try { const v = RQ.ss.get(key); saved = (typeof v === "string" ? JSON.parse(v) : v) || {}; } catch (e) {}
    const st = { sort: noSort ? sort : saved.sort || sort }; FKEYS.forEach((k) => (st[k] = Array.isArray(saved[k]) ? saved[k].slice() : []));
    const base = (srt = "rel") => { const l = S.list({ cat, room, col, sort: srt }); return only ? l.filter(only) : l; };
    const all = base();
    const pass = (p) => (!st.cat.length || st.cat.includes(p.cat)) && (!st.room.length || p.rooms.some((r) => st.room.includes(r)))
      && (!st.price.length || SPANS.some(([id, , lo, hi]) => st.price.includes(id) && p.price >= lo && p.price < hi)) && (!st.tone.length || RQ.colours(p).some((c) => st.tone.includes(c)));
    const listFor = (srt) => {
      let l = srt === "dig" && RQ.taste ? RQ.taste.sort(base()) : base(srt === "match" ? "rel" : srt);
      if (srt === "match" && RQ.room && RQ.room.has()) l = [...l].sort((a, b) => (RQ.room.match(b) || 0) - (RQ.room.match(a) || 0));
      return l.filter(pass);
    };
    const nActive = () => FKEYS.reduce((n, k) => n + st[k].length, 0);
    /* the groups a list can be narrowed by: only choices that exist in this list, and not the one the page itself is about */
    const opt = (name, id, label, n, sw) => `<label class="f-opt${sw ? " f-sw" : ""}"><input type="checkbox" name="${name}" value="${id}"${st[name].includes(id) ? " checked" : ""}>${sw ? `<i style="background:${sw}"></i>` : ""}<span>${esc(label)}</span><span class="count">${n}</span></label>`;
    const group = (name, legend, rows) => (rows.filter(Boolean).length > 1 ? `<fieldset class="f-group" data-f="${name}"><legend>${legend}</legend><div class="f-opts">${rows.filter(Boolean).join("")}</div></fieldset>` : "");
    const groups = [
      cat ? "" : group("cat", "Kategori", RQ.CATEGORIES.map((c) => { const n = all.filter((p) => p.cat === c.id).length; return n ? opt("cat", c.id, c.name, n) : ""; })),
      room ? "" : group("room", "Rum", RQ.ROOMS.map((r) => { const n = all.filter((p) => p.rooms.includes(r.id)).length; return n ? opt("room", r.id, r.name, n) : ""; })),
      group("price", "Pris", SPANS.map(([id, label, lo, hi]) => { const n = all.filter((p) => p.price >= lo && p.price < hi).length; return n ? opt("price", id, label, n) : ""; })),
      group("tone", "Färg", FAMS.map(([id, label, hex]) => { const n = all.filter((p) => RQ.colours(p).includes(id)).length; return n ? opt("tone", id, label, n, hex) : ""; })),
    ].join("");
    FKEYS.forEach((k) => { if (!groups.includes(`data-f="${k}"`)) st[k] = []; });
    const label = (k, id) => (k === "cat" ? (RQ.catById(id) || {}).name : k === "room" ? (RQ.roomById(id) || {}).name : k === "price" ? (SPANS.find((x) => x[0] === id) || [])[1] : (FAMS.find((x) => x[0] === id) || [])[1]) || id;
    const chips = () => (nActive() ? FKEYS.flatMap((k) => st[k].map((id) => `<button type="button" class="chip f-chip" data-f-off="${k}:${id}"><span class="sr">Ta bort filtret</span> <span>${esc(label(k, id))}</span>${xIco}</button>`)).join("") + `<button type="button" class="tlink" data-f-clear>Rensa filter</button>` : "");
    /* the end of a list is never a dead end: a quiet closing line, and for short lists a few things that go with them */
    const tail = (list) => {
      if (!list.length) return `<div class="empty"><h3>Inget matchar de filtren</h3><p>Ta bort ett filter, eller rensa alla och börja om.</p><button class="btn ghost" type="button" data-f-clear>Rensa filter</button></div>`;
      const seen = new Set(list.map((p) => p.handle)), rooms = new Set(list.flatMap((p) => p.rooms));
      const more = list.length < 4 && !nActive() ? RQ.PRODUCTS.filter((p) => !seen.has(p.handle) && p.rooms.some((r) => rooms.has(r))).slice(0, 4) : [];
      return `${more.length ? `<div class="list-more"><h2 class="h3">Mer som passar</h2>${RQ.grid(more, "three")}</div>` : ""}
        <div class="list-end"><p>${list.length === all.length ? `Du har sett alla ${nProd(list.length)}.` : `Du har sett ${list.length} av ${nProd(all.length)}.`}</p><span class="chips"><a class="chip" href="#looks">Färdiga looks</a><a class="chip" href="#hitta-ratt">Hitta rätt</a></span></div>`;
    };
    const results = (list) => (list.length ? RQ.grid(list, "three", true) : "") + tail(list);
    const first = listFor(st.sort);
    return {
      html: `${head(crumbs(trail), esc(title), lead, banner ? `<div class="banner-img reveal"><img src="${banner}" alt="" loading="eager" decoding="async" width="1600" height="893"></div>` : "").replace('class="page-head wrap"', 'class="page-head wrap shop-head"')}
        ${extraTop}
        <section class="wrap" style="padding-bottom:${extraBottom ? "3rem" : "6rem"}">
          <div class="shop${groups ? "" : " nofilters"}">
            ${groups ? `<aside class="filters" id="filters" aria-label="Filter">
              <div class="f-head"><h2>Filter</h2><button class="iconbtn" type="button" data-f-close aria-label="Stäng filter">${xIco}</button></div>
              <form class="f-body" id="fForm" novalidate>${groups}</form>
              <div class="f-foot"><button type="button" class="tlink" data-f-clear>Rensa</button><button class="btn" type="button" data-f-close id="fShow">Visa ${nProd(first.length)}</button></div>
            </aside><div class="f-scrim" data-f-close></div>` : ""}
            <div>
              <div class="toolbar">
                <span class="tb-l"><span class="count" id="count" role="status">${nProd(first.length)}</span>${RQ.room && RQ.room.mode() ? '<span class="rm-hint">Peka på en bild så ser du den i ditt rum.</span>' : ""}</span>
                <div class="tb-r">
                  ${groups ? `<button class="chip tb-filter" type="button" id="toggleFilters" aria-expanded="false" aria-controls="filters">${fIco}<span>Filter</span><b id="fN"${nActive() ? "" : " hidden"}>${nActive()}</b></button>` : ""}
                  <button class="roomtoggle" type="button" data-room-mode aria-pressed="${!!(RQ.room && RQ.room.mode())}"><span class="rt-img" data-room-thumb data-empty='${roomIco}'>${RQ.room && RQ.room.has() ? RQ.room.thumb() : roomIco}</span><span class="rt-t">${RQ.room && RQ.room.has() ? "Visa i mitt rum" : "Se allt i ditt rum"}</span><i class="sw" aria-hidden="true"></i></button>
                  ${noSort ? "" : `<label class="sr" for="sort">Sortera</label>
                  <select class="select" id="sort"><option value="rel">Relevans</option><option value="pop">Popularitet</option><option value="asc">Pris: lågt till högt</option><option value="desc">Pris: högt till lågt</option><option value="new">Senaste</option>${RQ.room && RQ.room.has() ? '<option value="match">Passar mitt rum</option>' : ""}${RQ.taste && RQ.taste.has() ? '<option value="dig">För dig</option>' : ""}</select>`}
                </div>
              </div>
              <div class="f-active" id="fActive"${nActive() ? "" : " hidden"}>${chips()}</div>
              <div id="results">${results(first)}</div>
              <p class="example-line"><b>Exempel.</b> Produkterna visar hur butiken kommer att se ut. De går inte att köpa än, och bilderna är skapade med AI.</p>
            </div>
          </div>
        </section>${extraBottom}`,
      mount(root) {
        const sel = $("#sort", root), aside = $("#filters", root), tf = $("#toggleFilters", root), form = $("#fForm", root);
        if (sel) { if (![...sel.options].some((o) => o.value === st.sort)) st.sort = sort; sel.value = st.sort; }
        /* the room switch was just turned on: every card shows its room picture for a moment, so the switch is seen to do something */
        if (RQ.room && RQ.room.mode() && Date.now() - modeAt < 1500) { const r = $("#results", root); r.classList.add("peek"); setTimeout(() => r.classList.remove("peek"), 2200); }
        const paint = () => {
          const list = listFor(st.sort), n = nActive();
          $("#results", root).innerHTML = results(list); $("#count", root).textContent = nProd(list.length);
          const fa = $("#fActive", root); fa.innerHTML = chips(); fa.hidden = !n;
          if (aside) { $("#fShow", root).textContent = `Visa ${nProd(list.length)}`; const b = $("#fN", root); b.textContent = n; b.hidden = !n; }
          RQ.ss.set(key, JSON.stringify({ sort: st.sort, cat: st.cat, room: st.room, price: st.price, tone: st.tone }));
          RQ.markImages(root); RQ.watch(root);
        };
        if (sel) sel.addEventListener("change", () => { st.sort = sel.value; paint(); });
        const sync = () => form && $$("input", form).forEach((i) => (i.checked = st[i.name].includes(i.value)));
        const clear = () => { FKEYS.forEach((k) => (st[k] = [])); sync(); paint(); };
        if (form) form.addEventListener("change", (e) => { const i = e.target; if (!i.name || !st[i.name]) return; st[i.name] = $$(`input[name=${i.name}]:checked`, form).map((x) => x.value); paint(); });
        /* phones: the filter is a sheet from the bottom, opened by the Filter button and closed by "Visa N produkter" */
        const open = (on) => { if (!aside) return; aside.classList.toggle("show", on); tf.setAttribute("aria-expanded", on); document.documentElement.classList.toggle("f-open", on); if (on) setTimeout(() => $("[data-f-close]", aside).focus({ preventScroll: true }), 60); else tf.focus({ preventScroll: true }); };
        const onClick = (e) => {
          const t = e.target.closest("#toggleFilters,[data-f-close],[data-f-clear],[data-f-off]"); if (!t) return;
          if (t.id === "toggleFilters") return open(!aside.classList.contains("show"));
          if (t.matches("[data-f-close]")) return open(false);
          if (t.matches("[data-f-clear]")) return clear();
          const [k, id] = t.dataset.fOff.split(":"); st[k] = st[k].filter((x) => x !== id); sync(); paint(); const nx = $("#fActive button", root) || tf || sel; if (nx && matchMedia("(hover:hover)").matches) nx.focus({ preventScroll: true });
        };
        root.addEventListener("click", onClick);
        const onKey = (e) => { if (e.key === "Escape" && aside && aside.classList.contains("show")) { e.stopPropagation(); open(false); } };
        document.addEventListener("keydown", onKey, true);
        return () => { root.removeEventListener("click", onClick); document.removeEventListener("keydown", onKey, true); document.documentElement.classList.remove("f-open"); };
      },
    };
  }

  RQ.shopView = shopView;
  V.butik = () => shopView({ title: "Alla produkter", kicker: "", lead: "Färre, bättre saker för hemmets alla rum.", trail: [["Hem", "hem"], ["Butik"]] });
  V.nyheter = () => shopView({ title: "Nyheter", lead: "Allt i sortimentet är nytt, eftersom butiken precis har börjat. Här visas det senast tillagda först.", sort: "new", trail: [["Hem", "hem"], ["Butik", "butik"], ["Nyheter"]] });
  V.favoriter = () => shopView({ title: "Populärt", lead: "Det vi själva tycker extra mycket om.", only: (p) => p.featured, noSort: true, trail: [["Hem", "hem"], ["Butik", "butik"], ["Populärt"]] });
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
      <section class="wrap" style="padding-bottom:6rem"><div class="tiles wide stagger" data-watch>${RQ.ROOMS.map((r) => `<a class="tile" href="#rum-${r.id}"><img src="assets/img/rum/${r.id}-900.webp" srcset="assets/img/rum/${r.id}-900.webp 900w, assets/img/rum/${r.id}-1600.webp 1600w" sizes="(max-width:640px) 111vw, 56vw" alt="" loading="lazy" decoding="async" width="1600" height="893"><span>${esc(r.name)}<small>${esc(r.lead)}</small></span></a>`).join("")}<a class="tile" href="#inspiration" style="background:#22252A"><span>Rumsinspiration<small>Idéer för varje rum, samlade på ett ställe.</small></span></a></div></section>`,
  });
  V.rum = (id) => {
    const r = RQ.roomById(id); if (!r) return null;
    const arts = RQ.ARTICLES.filter((a) => a.rooms.includes(id)).slice(0, 3);
    const extra = `<section class="wrap rum-more">
        <div class="split" style="align-items:start">
          <div><span class="eyebrow">Tre tips för ${esc(r.name.toLowerCase())}</span><div class="prose" style="margin-top:1.4rem"><ol class="numbered">${r.tips.map((t) => `<li><p>${esc(t)}</p></li>`).join("")}</ol></div>
            <div class="ctrl-row" style="margin-top:2rem">${r.cats.map((cid) => `<a class="chip" href="#kategori-${cid}">${esc(RQ.catById(cid).name)}</a>`).join("")}<a class="btn sm" href="#mitt-rum">Designa mitt rum</a></div></div>
          <div>${arts.length ? `<span class="eyebrow">Idéer för det här rummet</span><div style="display:grid;gap:1rem;margin-top:1.2rem">${arts.map((a) => `<a class="mag" href="#artikel-${a.slug}" style="display:grid;grid-template-columns:7rem 1fr;gap:1rem;align-items:center"><div class="im" style="aspect-ratio:1"><img src="${a.img}" alt="" loading="lazy" decoding="async" width="900" height="900"></div><div><h3 style="margin:0;font-size:1.15rem">${esc(a.title)}</h3><span class="min">${a.minutes} min läsning</span></div></a>`).join("")}</div>` : ""}</div>
        </div></section>`;
    const stage = RQ.hotspots ? `<section class="wrap rm-shop">${RQ.hotspots.render(id, { eager: true, cls: "room-stage" })}<div class="rm-shop-bar"><span><b>Allt i bilden</b> <span>${RQ.hotspots.handles(id).length} saker · ${S.kr(RQ.hotspots.total(id))}</span></span><span class="daynight" role="group" aria-label="Ljus i rummet"><button type="button" data-dn="dag" aria-pressed="true">Dag</button><button type="button" data-dn="kvall" aria-pressed="false">Kväll</button></span><button class="btn sm" type="button" data-shop-room="${id}">Handla rummet · ${S.kr(RQ.hotspots.total(id))}</button></div><p class="small rm-shop-note">Bilden är en illustration. Produkterna nedan är utvalda för rummet, inte exakta kopior av det du ser.</p></section>` : "";
    const v = shopView({ title: r.name, lead: r.lead, room: id, banner: stage ? null : `assets/img/rum/${id}-1600.webp`, extraTop: stage, extraBottom: extra, trail: [["Hem", "hem"], ["Efter rum", "rum"], [r.name]] });
    const m0 = v.mount; v.mount = (root) => { if (m0) m0(root); return RQ.hotspots ? RQ.hotspots.mount(root) : null; };
    return v;
  };
  V.kollektion = (id) => {
    const c = RQ.colById(id); if (!c) return null;
    return shopView({ title: c.name, lead: `${c.lead} ${c.text}`, col: id, banner: COL_BANNER[id] || "assets/img/rum-1600.webp", trail: [["Hem", "hem"], ["Looks", "looks"], [c.name]] });
  };
  const COL_IMG = { "det-organiserade-hemmet": "forradsburkar-glas-ek-3-pack", "skandinaviskt-hemmaliv": "rum", "vardagens-favoriter": "svamp-uppladdningsbar-lampa" };
  const COL_BANNER = { "det-organiserade-hemmet": "assets/img/rum/hall-1600.webp", "vardagens-favoriter": "assets/img/rum/kok-1600.webp" };
  const colImg = (id, w) => (COL_IMG[id] === "rum" ? `assets/img/rum-${w >= 1600 ? 1600 : 900}.webp` : `assets/img/p/${COL_IMG[id]}-${w >= 1600 ? 900 : 600}.webp`);
  const colCards = RQ.colCards = () => `<div class="cols3 stagger" data-watch>${RQ.COLLECTIONS.map((c) => `<a class="colcard" href="#kollektion-${c.id}"><div class="im"><img src="${colImg(c.id, 900)}" alt="" loading="lazy" decoding="async" width="900" height="${COL_IMG[c.id] === "rum" ? 503 : 1125}"></div><div class="tx"><span class="eyebrow">${S.list({ col: c.id }).length} produkter</span><h3 style="margin-top:.5rem">${esc(c.name)}</h3><p>${esc(c.lead)}</p></div></a>`).join("")}</div>`;
  RQ.colCards = colCards;

  /* ---------------- product page */
  const LAMPS = ["glob-bordslampa-opalglas", "lysa-keramiklampa", "svamp-uppladdningsbar-lampa"];
  RQ.LAMPS = LAMPS;
  /* a print is shown as the framed print itself (its room photo is mostly other things); soft things and the rug have no cut-out worth showing */
  const PRINT = (p) => p.cat === "tavlor-vaggar";
  const NO_CUT = ["plad-ullblandning-havre", "lin-kuddfodral", "vaffelhandduk-bomull", "dagsljus-linnegardin-2-pack", "vila-paslakanset-linne", "strand-jutematta"];
  RQ.isPrint = PRINT;
  /* the picture that stands for the product in small places (buy bar, lists) */
  RQ.thumb = (p) => (PRINT(p) ? RQ.cut(p) : RQ.img(p, 600));
  RQ.gallery = (p) => {
    const main = { k: "main", src: RQ.img(p, 1400), thumb: RQ.img(p, 600), alt: `${p.name}, miljöbild` };
    const cut = { k: "cut", src: RQ.cut(p), thumb: RQ.cut(p), alt: PRINT(p) ? `${p.name}, inramad` : `${p.name}, frilagd`, cut: true };
    const g = PRINT(p) ? [cut, main] : [main];
    g.push({ k: "detail", src: `assets/img/d/${p.handle}-1200.webp`, thumb: `assets/img/d/${p.handle}-600.webp`, alt: `${p.name}, detalj` });
    if (LAMPS.includes(p.handle)) g.push({ k: "off", src: `assets/img/p/${p.handle}-off-1400.webp`, thumb: `assets/img/p/${p.handle}-off-600.webp`, alt: `${p.name}, släckt` });
    if (!PRINT(p) && !NO_CUT.includes(p.handle)) g.push(cut);
    return g;
  };
  const ic = {
    truck: '<svg viewBox="0 0 24 24"><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7" cy="17.5" r="1.6"/><circle cx="17" cy="17.5" r="1.6"/></svg>',
    undo: '<svg viewBox="0 0 24 24"><path d="M9 7L4 12l5 5"/><path d="M4 12h10a6 6 0 0 1 0 12h-2" transform="translate(0 -6)"/></svg>',
    lock: '<svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="1.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
    room: '<svg viewBox="0 0 24 24"><path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/></svg>',
    list: '<svg viewBox="0 0 24 24"><path d="M5 5h14v15l-7-4-7 4z"/></svg>',
    share: '<svg viewBox="0 0 24 24"><path d="M12 15V4M8 7.5L12 4l4 3.5"/><path d="M6 11.5v7.5h12v-7.5"/></svg>',
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
      html: `<section class="wrap pcr">${crumbs([["Hem", "hem"], ["Butik", "butik"], [c.name, "kategori-" + c.id], [p.name]])}</section>
        <section class="wrap pdp">
          <div class="pg">
            <div class="pg-grid" id="pgGrid" style="--tone:${p.tone[0]}22">${shown.map((g, i) => `<button type="button" class="pg-item${g.cut ? " cut" : ""}" data-gi="${gal.indexOf(g)}" aria-label="Visa större: ${esc(g.alt)}"><img class="fade" src="${g.src}" alt="${esc(g.alt)}" ${i === 0 ? 'style="view-transition-name:pimg" fetchpriority="high"' : 'loading="lazy"'} decoding="async" ${g.cut ? "" : g.k === "detail" ? 'width="1200" height="1200"' : 'width="1400" height="1750"'} onerror="this.closest('.pg-item').remove()">${i === 0 && LAMPS.includes(p.handle) ? `<img class="pg-off" src="assets/img/p/${p.handle}-off-1400.webp" alt="" aria-hidden="true" decoding="async" onerror="this.remove()">` : ""}${i === 0 ? '<span class="tag">Exempel</span>' : ""}<span class="zhint">${ic.zoom}Zooma</span></button>${i === 0 && RQ.film(p) ? `<div class="pg-item pg-film"><video src="${RQ.film(p)}" poster="${RQ.img(p, 900)}" muted playsinline loop autoplay preload="metadata" aria-label="${esc(p.name)} i rörelse"></video><span class="tag">Film</span></div>` : ""}${i === 0 && RQ.room && RQ.room.has() ? `<button type="button" class="pg-item inroomtile" data-goroom="${p.handle}" aria-label="Ställ in ${esc(p.name)} i mitt rum">${RQ.room.layer(p, true)}<span class="tag">I ditt rum</span><span class="zhint">${RQ.roomIco}Öppna i Mitt rum</span></button>` : ""}`).join("")}</div>
            ${isLamp ? `<button type="button" class="lightswitch" id="lightSw" aria-pressed="true" hidden><i></i><span>Lampan är tänd</span></button>` : ""}
            <div class="pg-dots" id="pgDots" aria-hidden="true"></div>
          </div>
          <div class="pinfo">
            <a class="eyebrow" href="#kategori-${c.id}">${esc(c.name)}</a>
            <h1>${esc(p.name)}</h1>
            <div class="priceline">${RQ.priceHtml(p, "pdp")}<span class="vat">inkl. moms</span></div>${RQ.shipNote(p)}
            <p class="short">${esc(p.short)}</p>
            ${p.variants ? `<div class="opt"><span class="lbl">Färg: <b id="vname">${esc(vs[0].title)}</b></span><div class="swatch-row" role="radiogroup" aria-label="Färg">${vs.map((v, i) => `<button type="button" role="radio" aria-checked="${i === 0}" data-v="${v.id}"><i class="dotc" style="background:${p.tone[i] || "#ccc"}"></i>${esc(v.title)}</button>`).join("")}</div><p class="small vnote" id="vnote" hidden><span>Bilderna visar färgen</span> <b>${esc(vs[0].title)}</b>.</p></div>` : ""}
            <div class="buy"><div class="qty"><button type="button" data-q="-1" aria-label="Minska">−</button><input id="qty" type="number" value="1" min="1" max="99" aria-label="Antal" inputmode="numeric"><button type="button" data-q="1" aria-label="Öka">+</button></div><button class="btn" type="button" id="add">Lägg i varukorgen</button></div>
            <p class="small qty-note" id="qtyNote" role="status"></p>
            <p class="buy-alt">Vill du handla direkt? <button type="button" class="tlink" id="buyNow">Gå till kassan</button></p>${RQ.payRow()}
            ${RQ.room && RQ.room.has() ? `<a class="roomcta" href="#mitt-rum-${p.handle}"><span class="rc-img">${RQ.room.thumb()}</span><span><b>Ställ in i mitt rum</b><small>Se den hemma hos dig och handla hela rummet på en gång.</small></span>${RQ.roomIco}</a>`
              : `<button type="button" class="roomcta" data-room-setup="#mitt-rum-${p.handle}"><span class="rc-img">${RQ.roomIco}</span><span><b>Se den i ditt rum</b><small>Ta en bild av ditt rum, så ställer vi in produkten där.</small></span>${RQ.plus}</button>`}
            ${RQ.p3d ? RQ.p3d.card(p) : ""}
            <div class="pactions">
              <button type="button" data-wish="${p.handle}" aria-pressed="${S.isWished(p.handle)}">${I.heart}<span>${S.isWished(p.handle) ? "Sparad" : "Spara"}</span></button>
              <button type="button" id="saveRoomBtn" aria-expanded="false" aria-controls="listPanel">${ic.list}<span>Lägg i lista${S.listsWith(p.handle).length ? ` (${S.listsWith(p.handle).length})` : ""}</span></button>
              <button type="button" id="shareBtn">${ic.share}<span>Dela</span></button>
            </div>
            <div class="panel" id="listPanel" hidden style="margin-top:1rem">${listPanel(p)}</div>
            ${RQ.delivery ? RQ.delivery.html(p) : ""}
            ${RQ.homeFit ? RQ.homeFit.html(p) : ""}
            <div class="example-note"><span>●</span><div><p><b>Exempelprodukt.</b> Den går inte att köpa än. Du kan prova varukorgen och kassan, men inget betalas. Bilderna är skapade med AI, så färg och detaljer kan skilja sig.</p>${RQ.notify ? RQ.notify.html(p) : ""}</div></div>
            <div class="ptabs" data-ptabs>
              <div class="ptab-bar" role="tablist" aria-label="Mer om produkten"><button type="button" role="tab" id="ptb-om" aria-controls="pt-om" aria-selected="true">Om</button><button type="button" role="tab" id="ptb-matt" aria-controls="pt-matt" aria-selected="false" tabindex="-1">Mått och skötsel</button><button type="button" role="tab" id="ptb-frakt" aria-controls="pt-frakt" aria-selected="false" tabindex="-1">Frakt och retur</button></div>
              <div class="ptab" role="tabpanel" id="pt-om" aria-labelledby="ptb-om"><p>${esc(p.story)}</p><h3>Så använder du den</h3><ul>${p.use.map((u) => `<li>${esc(u)}</li>`).join("")}</ul>${RQ.LOOKS && RQ.LOOKS.some((l) => l.items.includes(p.handle)) ? `<div class="p-looks"><span class="eyebrow">Ingår i färdiga looks</span><div class="chips">${RQ.LOOKS.filter((l) => l.items.includes(p.handle)).map((l) => `<a class="chip" href="#look-${l.id}">${esc(l.name)}</a>`).join("")}</div></div>` : ""}<div class="p-reviews"><span class="eyebrow">Omdömen</span><p>Inga omdömen ännu. Kunder som köpt får en fråga om produkten när de haft den i tio dagar, och svaren visas här, även de kritiska.</p></div></div>
              <div class="ptab" role="tabpanel" id="pt-matt" aria-labelledby="ptb-matt" hidden><h3>Passar den hemma?</h3><p>Exakta mått visas här när produkten är verifierad. Till dess kan du:</p><ul><li>Mäta platsen där den ska stå, både bredd, djup och höjd.</li><li>Prova produkten i ett foto av ditt rum i <a href="#mitt-rum-${p.handle}">Se det i ditt rum</a>.</li><li>Fråga <a href="#studio-stylist">stylisten</a> om vad som passar ihop.</li></ul><h3>Material och skötsel</h3><p><b>Material:</b> ${esc(p.material)}</p><p style="margin-top:.6rem">${esc(care)}</p><p class="small" style="margin-top:.6rem">Allmänna råd för materialet. Följ alltid tillverkarens skötselråd när produkten levereras.</p><h3>Mått och fakta</h3><ul class="facts" style="margin-top:0;border-top:0">
                <li><span>Artikel</span><span>${esc(p.sku || "RQ-" + (1001 + RQ.PRODUCTS.indexOf(p)))}</span></li>
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

        ${pairs.length ? `<section class="sec tight kalk"><div class="wrap"><div class="sec-row"><div class="sec-head"><h2 class="h2">Passar ihop</h2><p>Bocka ur det du inte vill ha. Du kan ändra antal i varukorgen.</p></div><a class="link" href="#mitt-rum-${p.handle}">Bygg en look i ditt rum</a></div>
          <div class="look"><div class="look-items">${look.map((x, i) => `<label class="look-item"><input type="checkbox" data-look="${x.handle}" checked><img${RQ.isPrint(x) ? ' class="cutph"' : ""} src="${RQ.thumb(x)}" alt="" loading="lazy" decoding="async" width="600" height="750"><span class="nm">${i === 0 ? "Den här: " : ""}${esc(x.name)}</span><span class="pr">${kr(x.price)}</span></label>`).join("")}</div>
          <div class="look-sum"><div class="sum total"><span>Totalt</span><span id="lookTotal">${kr(look.reduce((s, x) => s + x.price, 0))}</span></div><button class="btn block" type="button" id="lookAdd">Lägg ${look.length} produkter i varukorgen</button></div></div></div></section>` : ""}
        ${related.length ? `<section class="sec tight"><div class="wrap"><div class="sec-row"><div class="sec-head"><h2 class="h2">Liknande produkter</h2></div><a class="link" href="#kategori-${c.id}">Visa alla</a></div>${RQ.grid(related.slice(0, 4))}</div></section>` : ""}
        ${seen.length ? `<section class="sec tight" style="padding-top:0"><div class="wrap"><div class="sec-head"><h2 class="h3">Du har tittat på</h2></div>${RQ.grid(seen)}</div></section>` : ""}
        <div class="buybar" id="buybar"><div class="bb-p"><img${PRINT(p) ? ' class="cutph"' : ""} src="${RQ.thumb(p)}" alt="" width="600" height="750" decoding="async"><div class="bb-t"><b>${esc(p.name)}</b><span>${kr(p.price)}<span id="bbVar"></span></span></div></div><button class="btn sm" type="button" id="add2">Lägg i varukorgen</button></div>
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
          const off = gal.find((g) => g.k === "off"), main = gal.find((g) => g.k === "main");
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
          const vt = S.variantById(variant).variant.title;
          $("#vname", root).textContent = vt;
          /* there is one set of photos: say which colour they show, and carry the choice to the buy bar */
          $("#vnote", root).hidden = variant === vs[0].id; $("#bbVar", root).textContent = " · " + vt;
        }));
        const q = $("#qty", root), qNote = $("#qtyNote", root), MAXQ = 99;
        /* the field always shows what will be added: whole numbers from 1 to 99, corrected in the field itself */
        const qty = () => { const n = Math.round(+String(q.value).replace(",", ".")); const v = !isFinite(n) || n < 1 ? 1 : Math.min(MAXQ, n); if (String(v) !== q.value) q.value = v; qNote.textContent = n > MAXQ ? `Max ${MAXQ} per produkt.` : ""; return v; };
        q.addEventListener("change", qty);
        $$("[data-q]", root).forEach((b) => b.addEventListener("click", () => { q.value = (Math.round(+q.value) || 1) + +b.dataset.q; qty(); }));
        const put = () => { const want = qty(), line = S.cartLines().find((l) => l.id === variant), room = MAXQ - (line ? line.quantity : 0), n = Math.min(want, room);
          if (n < 1) { qNote.textContent = `Du har redan ${MAXQ} i varukorgen. Det är max per produkt.`; return 0; }
          S.addToCart(variant, n); q.value = 1; qNote.textContent = n < want ? `Max ${MAXQ} per produkt. Vi lade till ${n}.` : ""; return n; };
        const add = (btn) => { if (btn.classList.contains("done")) return; if (put()) RQ.confirmAdd(btn, p.name); };
        $("#add", root).addEventListener("click", (e) => add(e.currentTarget)); $("#add2", root).addEventListener("click", (e) => add(e.currentTarget));
        $("#buyNow", root).addEventListener("click", () => { put(); location.hash = "#kassa"; });
        /* share: the phone's own share sheet where there is one, otherwise the address is copied */
        $("#shareBtn", root).addEventListener("click", async () => {
          const url = location.href.split("#")[0], data = { title: p.name, text: `${p.name} från RumIQ`, url };
          try { if (navigator.share) { await navigator.share(data); return; } await navigator.clipboard.writeText(url); RQ.toast("Länken är kopierad."); }
          catch (e) { if (e && e.name === "AbortError") return; RQ.toast("Det gick inte att dela. Kopiera adressen i adressfältet."); }
        });
        // save in a room (named lists)
        const panel = $("#listPanel", root), srb = $("#saveRoomBtn", root);
        srb.addEventListener("click", () => { const open = panel.hidden; panel.hidden = !open; srb.setAttribute("aria-expanded", open); });
        const repaint = () => { panel.innerHTML = listPanel(p); const n = S.listsWith(p.handle).length; $("span", srb).textContent = "Lägg i lista" + (n ? ` (${n})` : ""); };
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
        const io2 = new IntersectionObserver(([e]) => bar.classList.toggle("show", e.intersectionRatio < 0.9 && (e.boundingClientRect.top < 0 || matchMedia("(max-width:900px)").matches)), { threshold: [0, 0.9] });
        io2.observe($("#add", root));
        return () => io2.disconnect();
      },
    };
  };

  V.onskelista = () => {
    const lists = S.lists();
    let active = RQ.ss.get("rumiq-list") || "fav";
    if (active !== "fav" && !lists.some((l) => l.id === active)) active = "fav";
    const cur = active === "fav" ? { id: "fav", name: "Allt sparat", handles: S._wish } : lists.find((l) => l.id === active);
    const items = cur.handles.map(RQ.byHandle).filter(Boolean);
    const total = items.reduce((s, p) => s + p.price, 0);
    return { title: "Sparat · RumIQ",
      html: `${head(crumbs([["Hem", "hem"], ["Mitt hem", "mitt-hem"], ["Sparat"]]), "Sparat", "Det du har sparat och dina egna listor, till exempel en per rum. Allt finns kvar i den här webbläsaren.")}
      <section class="wrap" style="padding-bottom:6rem">
        <div class="listtabs" role="group" aria-label="Dina listor"><button class="chip" type="button" data-tab="fav" aria-pressed="${active === "fav"}">Allt sparat (${S._wish.length})</button>${lists.map((l) => `<button class="chip" type="button" data-tab="${l.id}" aria-pressed="${active === l.id}">${esc(l.name)} (${l.handles.length})</button>`).join("")}
          <form id="mkList" style="display:flex;gap:.4rem"><label class="sr" for="mkl">Ny lista</label><input id="mkl" placeholder="Ny lista" maxlength="40" style="padding:.5rem .9rem;border-radius:999px;width:10rem"><button class="chip" type="submit">Skapa</button></form></div>
        <div class="listhead"><div><h2 class="h3">${esc(cur.name)}</h2>${items.length ? `<p class="small">${items.length} ${items.length === 1 ? "produkt" : "produkter"} · ${kr(total)}</p>` : ""}</div>
          <div class="ctrl-row" style="margin:0">${items.length ? `<button class="btn sm" type="button" id="allCart">Lägg alla i varukorgen</button><button class="btn ghost sm" type="button" data-room-all="${items.slice(0, 8).map((p) => p.handle).join(",")}">Se dem i ditt rum</button><button class="btn ghost sm" type="button" id="share">Kopiera lista</button>` : ""}${active !== "fav" ? `<button class="chip" type="button" id="ren">Byt namn</button><button class="chip" type="button" id="del">Ta bort listan</button>` : ""}</div></div>
        ${items.length ? RQ.grid(items) + (active === "fav" && RQ.priceWatch ? `<div style="margin-top:2rem">${RQ.priceWatch.html(items.map((x) => x.handle))}</div>` : "") : `<div class="empty"><h3>Listan är tom</h3><p>${active === "fav" ? "Tryck på hjärtat på en produkt för att spara den här." : "Öppna en produkt och välj Spara i ett rum."}</p><a class="btn ghost" href="#butik">Utforska butiken</a></div>${active === "fav" && RQ.svepNudge ? RQ.svepNudge() : ""}`}
      </section>`,
      mount(root) {
        root.addEventListener("click", (e) => { const t = e.target.closest("[data-tab]"); if (t) { RQ.ss.set("rumiq-list", t.dataset.tab); RQ.router(); } });
        $("#mkList", root).addEventListener("submit", (e) => { e.preventDefault(); const v = $("#mkl", root).value.trim(); if (!v) return; const l = S.createList(v); RQ.ss.set("rumiq-list", l.id); RQ.router(); });
        const ac = $("#allCart", root); if (ac) ac.addEventListener("click", () => RQ.addMany(items.map((p) => p.handle), ac, cur.name)); // addMany ignores a double tap
        const sh = $("#share", root); if (sh) sh.addEventListener("click", async () => { const txt = `${cur.name} (RumIQ)\n` + items.map((p) => `- ${p.name}, ${kr(p.price)}`).join("\n") + `\nTotalt ${kr(total)}`; try { await navigator.clipboard.writeText(txt); RQ.toast("Listan är kopierad. Klistra in den var du vill."); } catch (er) { RQ.toast("Kunde inte kopiera i den här webbläsaren."); } });
        const rn = $("#ren", root); if (rn) rn.addEventListener("click", () => { const h = $(".listhead h2", root); h.innerHTML = `<form id="rnf" style="display:flex;gap:.4rem"><input value="${esc(cur.name)}" maxlength="40" style="padding:.5rem .9rem"><button class="chip" type="submit">Spara</button></form>`; $("#rnf", root).addEventListener("submit", (ev) => { ev.preventDefault(); const v = ev.currentTarget.querySelector("input").value.trim(); if (v) S.renameList(cur.id, v); RQ.router(); }); });
        let armed = false; const dl = $("#del", root); if (dl) dl.addEventListener("click", () => { if (!armed) { armed = true; dl.textContent = "Klicka igen för att ta bort"; return; } S.deleteList(cur.id); RQ.ss.set("rumiq-list", "fav"); RQ.router(); });
      } };
  };
  /* ---------------- magazine */
  // reading time counted from the text itself (200 words a minute), so a short text does not claim four minutes
  const readMin = (a) => Math.max(1, Math.round(String(a.body || "").replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length / 200));
  RQ.magCard = (a) => `<a class="mag" href="#artikel-${a.slug}"><div class="im"><img src="${a.img}" alt="" loading="lazy"></div><h3>${esc(a.title)}</h3><p>${esc(a.lead)}</p><span class="min">${readMin(a)} min läsning</span></a>`;
  V.magasin = () => ({ html: `${head(crumbs([["Hem", "hem"], ["Magasin"]]), "Magasin", "Idéer för ditt hem. Korta texter om ljus, material, färg och vardag.")}
      <section class="wrap" style="padding-bottom:6rem"><div class="mag-grid stagger" data-watch>${RQ.ARTICLES.map(RQ.magCard).join("")}</div></section>` });
  V.artikel = (slug) => {
    const a = RQ.articleBySlug(slug); if (!a) return null;
    const saved = S.savedArticles().includes(slug);
    return { title: `${a.title} · RumIQ Magasin`,
      html: `<header class="page-head wrap" style="padding-bottom:0">${crumbs([["Hem", "hem"], ["Magasin", "magasin"], ["Artikel"]])}<h1 class="h1" style="max-width:22ch">${esc(a.title)}</h1><p class="lead">${esc(a.lead)}</p>
        <div class="ctrl-row"><span class="eyebrow" style="align-self:center">${readMin(a)} min läsning</span><button class="chip" type="button" id="saveArt" aria-pressed="${saved}">${saved ? "Sparad i Mitt hem" : "Spara artikeln"}</button></div></header>
        <div class="wrap"><div class="article-hero reveal"><img src="${a.img.replace("-1200", "-1600")}" onerror="this.src='${a.img}'" alt=""></div></div>
        <div class="wrap"><article class="prose" style="padding-bottom:4rem">${a.body}</article></div>
        <section class="sec tight kalk"><div class="wrap"><div class="sec-head"><span class="eyebrow">Från artikeln</span><h2 class="h2">Saker som passar</h2></div>${RQ.grid(a.picks.map(RQ.byHandle).filter(Boolean))}</div></section>
        <section class="sec tight"><div class="wrap"><div class="sec-head"><span class="eyebrow">Läs mer</span></div><div class="mag-grid">${RQ.ARTICLES.filter((x) => x.slug !== slug).slice(0, 3).map(RQ.magCard).join("")}</div></div></section>`,
      mount(root) { $("#saveArt", root).addEventListener("click", (e) => { const on = S.toggleArticle(slug); e.currentTarget.setAttribute("aria-pressed", on); e.currentTarget.textContent = on ? "Sparad i Mitt hem" : "Spara artikeln"; }); },
    };
  };
  V.inspiration = () => ({ html: `${head(crumbs([["Hem", "hem"], ["Rumsinspiration"]]), "Rumsinspiration", "Rum att drömma sig bort i, och idéer att ta med hem. Bilderna är illustrationer.")}
      <section class="wrap"><div class="tiles stagger" data-watch>${RQ.ROOMS.map((r, i) => `<a class="tile ${i === 0 ? "big" : ""}" href="#rum-${r.id}"><img src="assets/img/rum/${r.id}-${i === 0 ? 1600 : 900}.webp" srcset="assets/img/rum/${r.id}-900.webp 900w, assets/img/rum/${r.id}-1600.webp 1600w" sizes="${i === 0 ? "(max-width:640px) 100vw, 60vw" : "(max-width:640px) 111vw, 56vw"}" alt="" loading="${i < 2 ? "eager" : "lazy"}" decoding="async" width="1600" height="893"><span>${esc(r.name)}<small>${esc(r.lead)}</small></span></a>`).join("")}</div></section>
      <section class="sec"><div class="wrap"><div class="sec-row"><div class="sec-head"><span class="eyebrow">Magasin</span><h2 class="h2">Idéer för ditt hem</h2></div><a class="link arrow" href="#magasin">Alla artiklar</a></div><div class="mag-grid">${RQ.ARTICLES.slice(0, 3).map(RQ.magCard).join("")}</div></div></section>
      <section class="sec kalk"><div class="wrap split"><div><span class="eyebrow">Mitt rum</span><h2 class="h2" style="margin-top:.9rem">Fri inredningsidé för ditt eget rum</h2><p class="lead" style="margin-top:1rem">Lägg till ett foto av ditt rum och prova produkterna där, eller svep fram en riktning.</p><div class="ctrl-row" style="margin-top:1.6rem"><a class="btn" href="#mitt-rum">Se det i ditt rum</a><a class="btn ghost" href="#svep">Svep fram din stil</a></div></div><div class="im"><img src="assets/img/rum/sovrum-900.webp" srcset="assets/img/rum/sovrum-900.webp 900w, assets/img/rum/sovrum-1600.webp 1600w" sizes="(max-width:900px) 100vw, 50vw" alt="" loading="lazy" decoding="async" width="1600" height="893"></div></div></section>` });

  /* ---------------- info + legal */
  const infoNav = (active) => `<ul class="sidenav"><li><h4>Kundservice</h4></li>${[["kontakt", "Kontakt"], ["onska", "Önska en produkt"], ["faq", "Vanliga frågor"], ["spara-order", "Spåra min beställning"], ["frakt", "Frakt & leverans"], ["returer", "Returer & återbetalning"], ["angra", "Ångra avtalet här"], ["betalning", "Betalning"], ["sa-fungerar-det", "Så fungerar RumIQ"], ["om", "Om RumIQ"]].map(([h, t]) => `<li><a class="${h === active ? "on" : ""}" href="#${h}"${h === active ? ' aria-current="page"' : ""}>${t}</a></li>`).join("")}
    <li><h4 style="margin-top:1rem">Juridisk information</h4></li>${Object.entries(RQ.LEGAL).map(([k, v]) => `<li><a class="${"juridik-" + k === active ? "on" : ""}" href="#juridik-${k}"${"juridik-" + k === active ? ' aria-current="page"' : ""}>${v.title}</a></li>`).join("")}</ul>`;
  RQ.infoPage = (route, kicker, title, lead, body, mount) => ({ title: `${title} · RumIQ`, html: `${head(crumbs([["Hem", "hem"], [title]]), esc(title), lead)}<section class="wrap layout-side" style="padding-bottom:6rem">${infoNav(route)}<div class="prose">${body}</div></section>`, mount });
  Object.entries(RQ.INFO).forEach(([k, v]) => {
    V[k] = () => RQ.infoPage(k, v.kicker, v.title, v.lead, v.html(), k === "kontakt" ? mountContact : null);
  });
  V.juridik = (k) => { const v = RQ.LEGAL[k]; if (!v) return null; return RQ.infoPage("juridik-" + k, "Juridisk information", v.title, v.lead, v.html()); };
  // a message under the field it belongs to (the box is made on first use), and the field marked for screen readers
  RQ.fieldErr = (el, msg) => {
    let box = el.parentNode.querySelector(".ferr");
    if (!box) { box = document.createElement("span"); box.className = "ferr"; box.id = "fe-" + (el.id || el.name || "f") + "-" + Math.random().toString(36).slice(2, 7); el.after(box); }
    box.textContent = msg || ""; box.hidden = !msg;
    if (msg) { el.setAttribute("aria-invalid", "true"); el.setAttribute("aria-describedby", box.id); } else { el.removeAttribute("aria-invalid"); el.removeAttribute("aria-describedby"); }
    return !msg;
  };
  const MAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function mountContact(root) {
    const f = $("#contactForm", root); if (!f) return;
    const RULES = [["name", (v) => (v ? "" : "Skriv ditt namn.")], ["email", (v) => (MAIL_OK.test(v) ? "" : v ? "Skriv en giltig e-postadress, till exempel namn@exempel.se." : "Skriv din e-postadress.")], ["msg", (v) => (v ? "" : "Skriv ditt meddelande.")]];
    RULES.forEach(([n, rule]) => f[n].addEventListener("input", () => { if (f[n].getAttribute("aria-invalid")) RQ.fieldErr(f[n], rule(f[n].value.trim())); }));
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      const st = $("#contactStatus", root);
      const bad = RULES.filter(([n, rule]) => !RQ.fieldErr(f[n], rule(f[n].value.trim())));
      if (bad.length) { st.textContent = bad.length === 1 ? "En sak behöver rättas innan du kan skicka." : `${bad.length} saker behöver rättas innan du kan skicka.`; st.classList.add("err"); f[bad[0][0]].focus(); return; }
      st.classList.remove("err");
      st.textContent = "Förhandsversion: formuläret är inte kopplat än, så meddelandet skickades inte. Skriv till support@rumiq.se så länge.";
    });
  }

  /* ---------------- 404 */
  V.notfound = () => ({ html: `${head(`<span class="eyebrow">404</span>`, "Den här sidan finns inte", "Länken kan vara gammal eller felstavad.")}<section class="wrap" style="padding-bottom:6rem"><div class="ctrl-row"><a class="btn" href="#hem">Till startsidan</a><a class="btn ghost" href="#butik">Till butiken</a></div></section>` });

  /* ---------------------------------------------------------------- tools on demand
     studio.js (Snabbval, Hitta rätt, Mitt hem, Bygg din egen look, Färger ur ditt rum, the stylist) is its own
     file on the live site. Until it has loaded, its views are stubs that ask the router to fetch it first.
     In the unbundled shell the real views replace the stubs straight away. */
  const TOOL_VIEWS = ["findRight", "giftFinder", "myHome", "studioGuide", "studioSearch", "studioStyle", "studioStylist"];
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
    [/^kollektioner$/, () => V.looks()], [/^kollektion-(.+)$/, (m) => V.kollektion(m[1])],
    [/^produkt-(.+)$/, (m) => V.produkt(m[1])], [/^onskelista$/, () => V.onskelista()], [/^jamfor$/, () => V.myHome()], // the compare tool is gone: its old address opens Mitt hem
    [/^magasin$/, () => V.magasin()], [/^artikel-(.+)$/, (m) => V.artikel(m[1])], [/^inspiration$/, () => V.inspiration()],
    [/^juridik-(.+)$/, (m) => V.juridik(m[1])], [/^ideer$/, () => V.onska()],
    [/^(kontakt|faq|frakt|returer|betalning|om|sa-fungerar-det)$/, (m) => V[m[1]]()],
    [/^studio$/, () => V.studio()], [/^(?:studio|mitt)-rum(?:-(.+))?$/, (m) => V.myRoom(m[1])], [/^studio-stil$/, () => V.studioStyle()], [/^studio-analys$/, () => V.myRoom()],
    [/^studio-stylist$/, () => V.studioStylist()], [/^studio-sok$/, () => V.findRight("ord")], [/^studio-hemurval$/, () => V.findRight("")], [/^hitta-ratt(?:-(present|ord))?$/, (m) => V.findRight(m[1] || "")], [/^studio-kombinera(?:-(.+))?$/, (m) => V.myRoom(m[1])],
    [/^upptack$/, () => V.upptack()], [/^svep(?:-rum-(.+))?$/, (m) => V.svep(m[1])], [/^svep-ihop(?:-(.+))?$/, (m) => V.svepIhop(m[1])], [/^delad(?:-(.+))?$/, (m) => V.shared(m[1])], [/^presentkort$/, () => V.giftCard()], [/^for-dig$/, () => V.forDig()], [/^looks$/, () => V.looks()], [/^look-(.+)$/, (m) => V.look(m[1])], [/^(?:rosta|onska)$/, () => V.onska()],
    [/^studio-plus$/, () => V.studioPlus(false)], [/^studio-plus-tack$/, () => V.studioPlus(true)],
    [/^presentguiden$/, () => V.findRight("present")], [/^mitt-hem$/, () => V.myHome()],
    [/^konto$/, () => V.account()], [/^skapa-konto$/, () => V.signup()], [/^kassa$/, () => V.checkout()], [/^order-(.+)$/, (m) => V.orderDone(m[1])], [/^spara-order$/, () => V.track()], [/^angra$/, () => V.withdraw()],
  ];
  let current = null, cleanup = null, firstRun = true, drawn = 0;
  let routing = null; // the route being drawn, until render() has run: popstate and hashchange both report one navigation
  let popNav = false; // the navigation in progress is Back or Forward: return to where the customer was
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dec = (s) => { try { return decodeURIComponent(s); } catch (e) { return s; } }; // a stray "%" in an address must never stop the script
  const isHomeRaw = (raw) => /^(hem)?$/.test(raw);

  /* Where the customer was on each page, so Back returns there instead of to the top. */
  try { history.scrollRestoration = "manual"; } catch (e) {}
  const scrolls = new Map();
  let settle = 0;
  const scrollBack = (y) => {
    const id = ++settle; let n = 0;
    const stop = () => { settle++; };
    ["wheel", "touchstart", "keydown", "pointerdown"].forEach((t) => window.addEventListener(t, stop, { once: true, passive: true }));
    // the page may still grow above this point (a toolbar, pictures): hold the place for a second, until the customer moves
    const step = () => { if (id !== settle) return; if (Math.abs(window.scrollY - y) > 1) window.scrollTo(0, y); if (n++ < 14) setTimeout(step, 70); };
    step();
  };

  window.addEventListener("pagehide", () => { if (current != null) RQ.ss.set("rumiq-scroll", JSON.stringify([current, Math.round(window.scrollY)])); });

  /* One polite voice for route changes: screen readers hear the new page's name, and the keyboard starts at its top. */
  const live = document.createElement("p");
  live.className = "sr"; live.id = "routeLive"; live.setAttribute("role", "status"); live.setAttribute("aria-live", "polite");
  document.body.appendChild(live);

  /* The page head follows the view: title, description, canonical address and the sharing tags.
     One owner while browsing: when the build has written a head for every page (assets/heads.json, read by
     seo.js as RQ.headBook), that head is used and the values below are only its stand-in, for views the build has
     no head for. Without it (English, an older build) the router writes the head itself: RQ.META[route] =
     { title, description, image } wins when provided; otherwise the view's own title and lead are used.
     Routes that show another page point their canonical address at that page. */
  const CANON = { studio: "mitt-rum", "studio-analys": "mitt-rum", "studio-kombinera": "mitt-rum", kollektioner: "looks", ideer: "onska", rosta: "onska", jamfor: "mitt-hem", presentguiden: "hitta-ratt-present", "studio-sok": "hitta-ratt-ord", "studio-hemurval": "hitta-ratt" };
  const HOME_TITLE = "RumIQ · Skandinavisk inredning och smarta verktyg för hemmet";
  const metaEl = (sel) => document.head.querySelector(sel);
  const HEAD0 = { desc: (metaEl('meta[name="description"]') || {}).content || "", image: (metaEl('meta[property="og:image"]') || {}).content || "" };
  let siteRoot = null; // the public address of the start page, read once from the canonical link the page came with
  const publicRoot = () => {
    if (siteRoot) return siteRoot;
    const c = metaEl('link[rel="canonical"]'); let u;
    try { u = new URL((c && c.getAttribute("href")) || SITE.href, SITE.href); } catch (e) { u = new URL(SITE.href); }
    const m = /^(.*\/)([^/]+)\/$/.exec(u.pathname);
    if (m && isRoute(dec(m[2]))) u.pathname = m[1];
    u.search = ""; u.hash = "";
    return (siteRoot = u.href);
  };
  const setMeta = (sel, attr, val) => { const el = metaEl(sel); if (el && val != null && el.getAttribute(attr) !== val) el.setAttribute(attr, val); };
  function paintHead(raw, view, root, found) {
    const own = () => ownHead(raw, view, root, found);
    if (RQ.headBook && !view.crashed) RQ.headBook.follow(raw, own); else own();
  }
  function ownHead(raw, view, root, found) {
    const M = (RQ.META && RQ.META[raw]) || {};
    const isHome = isHomeRaw(raw), h1 = !view.title && !isHome && root.querySelector("h1");
    const title = M.title || view.title || (isHome ? HOME_TITLE : h1 ? `${h1.textContent.trim().replace(/\s+/g, " ")} · RumIQ` : "RumIQ");
    document.title = title;
    const lead = !isHome && root.querySelector(".lead, .short");
    const text = (M.description || view.description || (lead ? lead.textContent.trim().replace(/\s+/g, " ") : "") || HEAD0.desc);
    const desc = text.length > 158 ? text.slice(0, 155).replace(/\s+\S*$/, "") + "…" : text;
    const to = CANON[raw] || (/^studio-kombinera-/.test(raw) ? "mitt-rum" : raw);
    const url = found && pathable(to) ? new URL(isHomeRaw(to) ? "./" : encodeURI(to) + "/", publicRoot()).href : publicRoot();
    const pm = /^produkt-(.+)$/.exec(raw), prod = pm && RQ.byHandle(pm[1]);
    const image = M.image || view.image || (prod ? new URL(RQ.img(prod, 900), publicRoot()).href : HEAD0.image);
    setMeta('link[rel="canonical"]', "href", url);
    setMeta('meta[name="description"]', "content", desc);
    setMeta('meta[property="og:title"]', "content", title);
    setMeta('meta[property="og:description"]', "content", desc);
    setMeta('meta[property="og:url"]', "content", url);
    setMeta('meta[property="og:image"]', "content", image);
  }

  /* When a page cannot be drawn (a value kept in the browser that no longer fits, or a fault of ours), the
     customer gets a way forward instead of a page whose buttons do nothing. */
  V.crashed = () => ({
    title: "Sidan kunde inte visas · RumIQ", crashed: true,
    html: `${head(`<span class="eyebrow">Något gick snett</span>`, "Sidan kunde inte visas", "Prova att ladda om sidan. Hjälper inte det kan du rensa det som är sparat i den här webbläsaren. Då töms varukorgen och det du har sparat.")}
      <section class="wrap" style="padding-bottom:6rem"><div class="ctrl-row"><button class="btn" type="button" id="crashReload">Ladda om sidan</button><button class="btn ghost" type="button" id="crashClear">Rensa sparat och ladda om</button><a class="btn ghost" href="./">Till startsidan</a></div></section>`,
    mount(root) {
      $("#crashReload", root).addEventListener("click", () => location.reload());
      $("#crashClear", root).addEventListener("click", () => { try { S.clearAll(); } catch (e) {} location.reload(); });
    },
  });
  const lookup = (raw) => {
    let view = null;
    for (const [re, fn] of ROUTES) { const m = raw.match(re); if (m) { view = fn(m); break; } }
    // in-page anchors such as #faq-2 fall back to their page
    if (!view && /^faq-\d+$/.test(raw)) view = V.faq();
    return view;
  };
  function render(raw) {
    let view = null, found = true;
    try { view = lookup(raw); } catch (e) { console.error(e); view = V.crashed(); }
    if (!view) { view = V.notfound(); found = false; }
    if (view.lazy) { // a tool that has not loaded yet: keep what is on screen (the prerendered page), load, then draw
      document.documentElement.classList.add("loading-tools");
      RQ.loadTools().then(() => { document.documentElement.classList.remove("loading-tools"); if (currentRaw() === raw) render(raw); else if (routing === raw) routing = null; }, () => {
        routing = null; document.documentElement.classList.remove("loading-tools");
        // the address goes back to the page that is still on screen; the customer can try again from the message
        if (current != null && currentRaw() === raw) { try { history.replaceState(null, "", pathFor(current)); } catch (e) {} }
        RQ.toast(`Sidan kunde inte laddas. Kontrollera anslutningen. <a href="${esc(hrefFor(raw))}">Försök igen</a>`);
      });
      return;
    }
    if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
    const root = $("#view");
    const isHome = isHomeRaw(raw), moved = current !== raw, first = !drawn++;
    // the first draw replaces the prerendered page with the same pictures: they must not fade out and in again
    root.className = "view" + (isHome ? " home" : "") + (first ? " first" : "");
    document.body.classList.toggle("on-home", isHome);
    document.body.classList.toggle("on-product", /^produkt-/.test(raw));
    document.body.classList.toggle("on-checkout", /^kassa$/.test(raw));
    root.innerHTML = view.html;
    toPathLinks(root);
    paintHead(raw, view, root, found && !view.crashed);
    let backTo = moved && popNav ? scrolls.get(raw) || 0 : 0;
    if (first) { // a reload, or Back from another site, lands where the customer was
      try { const nav = performance.getEntriesByType("navigation")[0], was = JSON.parse(RQ.ss.get("rumiq-scroll") || "null"); if (nav && /reload|back_forward/.test(nav.type) && Array.isArray(was) && was[0] === raw && was[1] > 0) backTo = was[1]; } catch (e) {}
    }
    if (moved) { settle++; if (!backTo) window.scrollTo(0, 0); }
    popNav = false;
    current = raw; routing = null;
    // #view outlives every page: whatever a page listens for on it is taken away again when the page leaves
    const offs = [], add = root.addEventListener.bind(root);
    root.addEventListener = (t, f, o) => { offs.push(() => root.removeEventListener(t, f, o)); add(t, f, o); };
    let un = null;
    try { un = view.mount ? view.mount(root) : null; }
    catch (e) { // the page was written out but could not be started: show the way forward instead of dead buttons
      console.error(e);
      if (!view.crashed) { const c = V.crashed(); root.innerHTML = c.html; toPathLinks(root); document.title = c.title; try { c.mount(root); } catch (x) {} }
    } finally { delete root.addEventListener; }
    if (RQ.mountBav && root.querySelector(".bav")) { const b = RQ.mountBav(root); offs.push(() => b && b()); }
    cleanup = () => { offs.forEach((f) => { try { f(); } catch (e) {} }); if (typeof un === "function") un(); };
    RQ.watch(root);
    RQ.paintShell();
    RQ.markImages(root);
    $$(".menu a").forEach((a) => a.classList.toggle("active", rawOf(a) === raw));
    const DOCK = { butik: /^(butik|kategori|produkt|nyheter|kollektion|for-dig|favoriter|hitta-ratt|presentguiden|erbjudanden)/, upptack: /^(upptack|svep|looks?|rosta|onska|ideer|rum|magasin|artikel|inspiration)(-|$)/, mitt: /^(mitt-rum|studio)/, sparat: /^(mitt-hem|onskelista|jamfor)$/ };
    $$("[data-dock]").forEach((a) => a.classList.toggle("on", !!(DOCK[a.dataset.dock] && DOCK[a.dataset.dock].test(raw))));
    const anchor = /^faq-\d+$/.test(raw) && document.getElementById(raw);
    if (anchor) anchor.scrollIntoView();
    if (backTo) scrollBack(backTo); // after the page has started, so its own parts are in place
    RQ.navCheck && RQ.navCheck();
    if (moved && !first) { // a new page: the keyboard and the screen reader start at its top (unless the page chose a field itself)
      if (!root.contains(document.activeElement)) { try { root.focus({ preventScroll: true }); } catch (e) {} }
      // the name the customer sees on the page (its heading), not the longer title written for search engines
      live.textContent = ""; setTimeout(() => { const h1 = root.querySelector("h1"); live.textContent = (h1 ? h1.textContent : document.title.replace(/\s*·\s*RumIQ.*$/, "")).trim().replace(/\s+/g, " "); }, 60);
    }
    if (first) setTimeout(() => root.classList.remove("first"), 1200);
  }
  /* Real addresses. Every view has its own path (rumiq.se/produkt-glob-bordslampa-opalglas/) that Google can
     index; the build script writes a prerendered page for each. Every internal link on the page is that real
     path ("butik/"), so search engines and "open in new tab" follow it; a normal click is caught here and the
     view changes without a reload. Templates may still write "#route": those links are turned into paths as
     they enter the page, and "#route" addresses keep working as an alias.
     <base href> in every page points at the site root, so relative paths work from every page. */
  const SITE = new URL(".", document.baseURI);
  const isRoute = (raw) => /^faq-\d+$/.test(raw) || ROUTES.some(([re]) => re.test(raw));
  // routes whose address carries an answer or an anchor stay "#route": they have no page of their own on the server
  const pathable = (raw) => !/^faq-\d+$/.test(raw) && !/^svep-ihop-/.test(raw) && !/^delad-/.test(raw) && !/^studio-kombinera-/.test(raw);
  const hrefFor = (raw) => (isHomeRaw(raw) ? "./" : pathable(raw) ? encodeURI(raw) + "/" : "#" + raw);
  const pathFor = (raw) => new URL(isHomeRaw(raw) ? "./" : encodeURIComponent(raw) + "/", SITE).pathname;
  // "#Butik" and "#butik/" mean "#butik"; the start page has one name, "" ("#hem" is the same page)
  const tidy = (raw) => { raw = raw.replace(/\/+$/, ""); if (!isRoute(raw) && isRoute(raw.toLowerCase())) raw = raw.toLowerCase(); return raw === "hem" ? "" : raw; };
  const rawOfPath = (pathname) => {
    const rp = SITE.pathname; if (!pathname.startsWith(rp)) return null;
    return dec(pathname.slice(rp.length).replace(/index\.html$/, "").replace(/\/+$/, ""));
  };
  const currentRaw = () => {
    const h = dec(location.hash.replace(/^#/, ""));
    if (h && !h.includes("=")) return tidy(h); // "#access_token=…" from a sign-in belongs to the auth client
    const p = rawOfPath(location.pathname);
    return tidy(p == null ? dec(location.pathname.replace(/index\.html$/, "").replace(/\/+$/, "")) : p);
  };
  // the route a link leads to, or null when it leaves the shop (a file, another site, an anchor that is no route)
  const rawOf = (a) => {
    const h = a.getAttribute("href") || "";
    if (h[0] === "#") { const raw = tidy(dec(h.slice(1))); return h.length > 1 && (isHomeRaw(raw) || isRoute(raw)) ? raw : null; }
    let u; try { u = new URL(a.href); } catch (e) { return null; }
    if (u.origin !== SITE.origin || (u.hash && u.hash.length > 1)) return null;
    const raw = rawOfPath(u.pathname); if (raw == null) return null;
    return raw === "" || isRoute(tidy(raw)) ? tidy(raw) : null;
  };
  RQ.pathFor = pathFor; RQ.hrefFor = hrefFor; RQ.isRoute = isRoute; RQ.currentRoute = () => current;
  // links written as "#butik" become "butik/" as they enter the page (the quick-view sheet keeps its own, see flow.js)
  const toPathLinks = (root) => {
    if (!root || root.nodeType !== 1) return;
    const list = root.matches && root.matches('a[href^="#"]') ? [root] : [];
    root.querySelectorAll && list.push(...root.querySelectorAll('a[href^="#"]'));
    list.forEach((a) => {
      const h = a.getAttribute("href"); if (h.length < 2 || a.closest("#sheet")) return;
      const raw = tidy(dec(h.slice(1)));
      if ((isHomeRaw(raw) || isRoute(raw)) && pathable(raw)) a.setAttribute("href", hrefFor(raw));
    });
  };
  RQ.toPathLinks = toPathLinks; RQ.toHashLinks = toPathLinks; // the old name is still called by the stylist
  toPathLinks(document.body);
  if ("MutationObserver" in window) new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach(toPathLinks))).observe(document.body, { childList: true, subtree: true });
  // go to a route from code: RQ.go("kassa")
  RQ.go = (raw) => {
    raw = tidy(String(raw || "").replace(/^#/, ""));
    if (raw === current && !routing) return;
    if (!pathable(raw)) { location.hash = "#" + raw; return; }
    try { history.pushState(null, "", pathFor(raw)); } catch (e) { location.hash = "#" + raw; return; }
    RQ.router();
  };
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest("a[href]"); if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
    const h = a.getAttribute("href"); if (h === "#" || h === "") return;
    if (a.closest("#sheet")) return; // the quick-view sheet steps its own history entry back first (flow.js)
    const raw = rawOf(a);
    if (raw != null) {
      e.preventDefault();
      if (a.dataset.after) RQ.ss.set("rumiq-after-login", "#" + a.dataset.after);
      if (h[0] !== "#" && RQ.closeAll) RQ.closeAll(); // "#route" links are closed by the shell's own click handler
      RQ.go(raw); return;
    }
    if (h[0] !== "#") return; // a file, a mail address or another site: the browser takes it
    e.preventDefault();
    const id = dec(h.slice(1)), el = document.getElementById(id);
    if (el) { el.scrollIntoView({ block: "start" }); if (el.matches("main,section,[tabindex]")) el.focus({ preventScroll: true }); }
    else location.hash = h;
  }, true);
  const onNav = (e) => {
    const raw = currentRaw();
    if (raw === current) { routing = null; return; }
    if (raw === routing) return;
    popNav = !!e && e.type === "popstate" && !location.hash; // Back or Forward to a page with a real address
    RQ.router();
  };
  window.addEventListener("popstate", onNav);
  const COARSE = matchMedia("(pointer: coarse), (max-width: 900px)").matches;
  RQ.router = () => {
    const raw = currentRaw(); routing = raw;
    if (current != null && raw !== current) scrolls.set(current, window.scrollY);
    // "#butik" is an alias: the address bar gets the real path (what follows "?" stays, a sign-in answer after "#" is left alone)
    if (location.hash && !location.hash.includes("=") && isRoute(raw) && pathable(raw)) { try { history.replaceState(history.state && history.state.rqSheet ? null : history.state, "", pathFor(raw) + location.search); } catch (e) {} }
    // phones and tablets: no view transition. Taking a picture of the whole page before every change costs more
    // than the fade is worth there; the new view gets a short fade instead.
    if (firstRun || !document.startViewTransition || reduced() || raw === current || COARSE) {
      const swap = !firstRun && raw !== current && !reduced(); firstRun = false; render(raw);
      if (swap) { const v = document.getElementById("view"); if (v.animate) v.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 140, easing: "ease-out" }); }
      return;
    }
    const t = document.startViewTransition(() => render(raw));
    t.ready.catch(() => {}); t.updateCallbackDone.catch(() => {});
    t.finished.catch(() => {}).finally(() => $$("[style*=view-transition-name]").forEach((el) => { if (!el.closest(".pg-grid")) el.style.viewTransitionName = ""; }));
  };
  // a tapped product image morphs into the product page
  document.addEventListener("click", (e) => {
    const a = e.target.closest(".card a[href*='produkt-']"); if (!a) return;
    const img = $(".ph img", a.closest(".card")); if (img) img.style.viewTransitionName = "pimg";
  }, true);

  /* shop cards in room mode on touch screens: the dots follow the swipe between photo and room */
  document.addEventListener("scroll", (e) => { const t = e.target; if (t.classList && t.classList.contains("ph")) { const c = t.closest(".card.in-room"); if (c) c.dataset.i = Math.round(t.scrollLeft / Math.max(1, t.clientWidth)); } }, { capture: true, passive: true });

  /* images fade in on their tone colour once decoded */
  document.addEventListener("load", (e) => { const t = e.target; if (t.tagName === "IMG" && t.classList.contains("fade")) t.classList.add("ok"); }, true);
  if (matchMedia("(hover:hover)").matches) document.addEventListener("pointerover", (e) => { if (e.pointerType && e.pointerType !== "mouse") return; const c = e.target.closest && e.target.closest(".card"); const im = c && c.querySelector("img.hov[data-src]"); if (im) { im.src = im.dataset.src; im.removeAttribute("data-src"); } }, { passive: true });
  RQ.markImages = (root) => $$("img.fade", root).forEach((im) => { if (im.complete && im.naturalWidth) im.classList.add("ok"); });

  /* ---------------------------------------------------------------- reveal */
  const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }) : null;
  RQ.watch = (root) => $$("[data-watch]:not(.in), .reveal:not(.in), .stagger:not(.in)", root).forEach((el) => (io ? io.observe(el) : el.classList.add("in")));

  /* ---------------------------------------------------------------- shell: cart drawer, search, menus */
  RQ.paintShell = () => {
    $$("[data-count=cart]").forEach((b) => { const n = S.cartCount(); if (+b.dataset.n < n) { b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump"); } b.textContent = n || ""; b.dataset.n = n; });
    $$("[data-count=cartline]").forEach((b) => { const n = S.cartCount(); b.textContent = n ? `${n} ${n === 1 ? "produkt" : "produkter"}` : ""; });
    $$("[data-count=wish]").forEach((b) => { const n = S._wish.length; b.textContent = n || ""; b.dataset.n = n; });
    const c = S.customer(); const acc = $("#accLink"); if (acc) acc.setAttribute("aria-label", c ? "Mitt konto" : "Logga in");
  };
  const drawer = $("#cart"), scrimAll = $("#scrimAll");
  // the control that opened a layer gets the focus back when the layer closes
  let opener = null; const remember = () => { const a = document.activeElement; opener = a && a !== document.body && !a.closest("#cart,#mnav,#search") ? a : opener; };
  drawer.setAttribute("role", "dialog"); drawer.setAttribute("aria-modal", "true"); drawer.tabIndex = -1;
  // the page behind stands still while the cart is open; the focus goes to the drawer itself (no ring on the close button after a tap)
  const openCart = () => { remember(); renderCart(); closeLight(); $("#toast").classList.remove("show"); drawer.classList.add("open"); scrimAll.classList.add("open"); drawer.setAttribute("aria-hidden", "false"); document.documentElement.style.overflow = "hidden"; setTimeout(() => drawer.focus({ preventScroll: true }), 50); };
  const closeAll = () => { const was = drawer.classList.contains("open") || $("#search").classList.contains("open") || $("#mnav").classList.contains("open"); if (was && opener && opener.isConnected && document.activeElement && document.activeElement.closest("#cart,#mnav,#search")) { try { opener.focus({ preventScroll: true }); } catch (e) {} } opener = null; if (was) $("#toast").classList.remove("show"); drawer.classList.remove("open"); scrimAll.classList.remove("open"); drawer.setAttribute("aria-hidden", "true"); $("#search").classList.remove("open"); $("#mnav").classList.remove("open"); $("#burger").setAttribute("aria-expanded", "false"); closeMega(); closeLight(); document.documentElement.style.overflow = ""; };
  RQ.openCart = openCart; RQ.closeAll = closeAll;
  // keep the keyboard inside whatever layer is open (quick view, search, menu or cart)
  const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const layer = [".sheet.open", "#search.open", "#mnav.open", "#cart.open"].map((q) => document.querySelector(q)).find(Boolean);
    if (!layer) return;
    const f = $$(FOCUSABLE, layer).filter((el) => el.getClientRects().length);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1], a = document.activeElement;
    if (!layer.contains(a)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && a === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
  });
  // a look that is one thing short of complete: the thing, and what the whole look would save
  const lookNudge = (lines) => {
    const rate = +((window.RQ_CONFIG || {}).lookDiscount || 0); if (!rate || !RQ.LOOKS) return null;
    const left = {}; lines.forEach((l) => { left[l.product.handle] = (left[l.product.handle] || 0) + l.quantity; });
    S.lookDiscounts().forEach((d) => d.look.items.forEach((h) => left[h]--));
    let best = null;
    RQ.LOOKS.forEach((L) => { const miss = L.items.filter((h) => !(left[h] > 0)); if (miss.length !== 1 || L.items.length < 3) return; const p = RQ.byHandle(miss[0]); if (!p) return;
      const save = Math.round(L.items.reduce((s, h) => s + (RQ.byHandle(h) || { price: 0 }).price, 0) * rate); if (!best || save > best.save) best = { look: L, p, save }; });
    return best;
  };
  // the same look twice is one row ("2 × ...")
  RQ.discRows = (disc) => { const g = new Map(); disc.forEach((d) => { const x = g.get(d.look.id) || { name: d.look.name, n: 0, amount: 0 }; x.n++; x.amount += d.amount; g.set(d.look.id, x); });
    return [...g.values()].map((x) => `<div class="sum disc"><span>${x.n > 1 ? x.n + " × " : ""}Hela looken ${esc(x.name)}</span><span>−${kr(x.amount)}</span></div>`).join(""); };
  function renderCart() {
    const lines = S.cartLines();
    const body = $("#cart .body"), foot = $("#cart footer");
    // the cart is drawn again after every change: remember which control had the focus and give it back
    const a = document.activeElement, had = !!a && a !== drawer && drawer.contains(a) && !a.closest("header");
    const key = !had ? "" : a.dataset.line ? `[data-line="${a.dataset.line}"][data-d="${a.dataset.d}"]` : a.dataset.rm ? `[data-rm="${a.dataset.rm}"]` : a.dataset.add ? `[data-add="${a.dataset.add}"]` : "";
    const refocus = () => { if (!had) return; let el = key ? $(key, drawer) : null; if (el && el.disabled && a.dataset.line) el = $(`[data-line="${a.dataset.line}"]:not([disabled])`, drawer); (el && !el.disabled ? el : drawer).focus({ preventScroll: true }); };
    if (!lines.length) {
      body.innerHTML = RQ.emptyCartHtml();
      foot.innerHTML = ""; refocus(); return;
    }
    const sub = S.cartSubtotal(), disc = S.lookDiscounts(), net = sub - S.cartDiscount(), free = !!(S.freeShipping && S.freeShipping()), ship = S.shippingCost ? S.shippingCost("ombud") : 0, nudge = lookNudge(lines);
    body.innerHTML = RQ.freeShipHtml(net) + (nudge ? `<div class="gap look-nudge"><p class="eyebrow">Nästan hela looken ${esc(nudge.look.name)}</p><div class="gap-i"><img src="${RQ.cut(nudge.p)}" alt="" width="42" height="42" loading="lazy"><span><b>${esc(nudge.p.name)}</b><small>Lägg till och spara ${kr(nudge.save)}</small></span><button class="btn sm ghost" type="button" data-add="${nudge.p.handle}::0" aria-label="Lägg ${esc(nudge.p.name)} i varukorgen">Lägg till</button></div></div>` : RQ.fillGapHtml(lines, net)) + lines.map((l) => `<div class="line"><a href="#produkt-${l.product.handle}" data-close><img src="${RQ.img(l.product, 600)}" alt="" width="74" height="92" loading="lazy" decoding="async"></a><div><h4><a href="#produkt-${l.product.handle}" data-close>${esc(l.product.name)}</a></h4>${l.variant.title !== "Standard" ? `<div class="v">${esc(l.variant.title)}</div>` : ""}<div class="qty"><button type="button" data-line="${l.id}" data-d="-1" aria-label="Minska antalet ${esc(l.product.name)}"${l.quantity <= 1 ? " disabled" : ""}>−</button><input value="${l.quantity}" aria-label="Antal ${esc(l.product.name)}" readonly tabindex="-1"><button type="button" data-line="${l.id}" data-d="1" aria-label="Öka antalet ${esc(l.product.name)}"${l.quantity >= 99 ? " disabled" : ""}>+</button></div><button class="rm" type="button" data-rm="${l.id}" aria-label="Ta bort ${esc(l.product.name)}">Ta bort</button></div><span class="lp">${kr(l.lineTotal)}${l.quantity > 1 ? `<small>${kr(l.variant.price)}/st</small>` : ""}</span></div>`).join("") +
      `<div class="example-note" style="margin-top:1.2rem"><span>●</span><span><b>Testläge.</b> Varukorgen innehåller exempelprodukter. Du kan prova kassan, men inget betalas och inget skickas.</span></div>`;
    foot.innerHTML = `<div class="sum"><span>Delsumma</span><span>${kr(sub)}</span></div>${RQ.discRows(disc)}<div class="sum small"><span>Frakt till ombud eller paketskåp</span><span>${free ? "Fri" : kr(ship)}</span></div><div class="sum total"><span>Totalt</span><span>${kr(net + ship)}</span></div><div class="sum small"><span>Varav moms (25 %)</span><span>${kr(S.vatIncluded(net + ship))}</span></div><a class="btn block" href="#kassa" data-close>Till kassan</a><button class="btn ghost block cart-room" type="button" data-cart-room>${RQ.roomIco}Se varorna i ditt rum</button>`;
    refocus();
  }
  S.onChange((w) => { RQ.paintShell(); if (drawer.classList.contains("open")) renderCart(); });
  // the browser's storage is full: say that this will not be kept, instead of a cart that is empty after a reload
  let fullAt = 0;
  S.onChange((w) => {
    if (w !== "full" || Date.now() - fullAt < 6000) return; fullAt = Date.now();
    setTimeout(() => { if (!S.store.lost) { fullAt = 0; return; } S.store.lost = null; const t = $("#toast"); if (t.classList.contains("show") && /lagring|storage/i.test(t.textContent)) return; RQ.toast('Webbläsarens lagring är full, så det här sparas inte. Ta bort något du har sparat. <a href="#mitt-hem">Visa</a>'); }, 0);
  });
  // day/evening on a room picture: the same room after sunset, so you see how the lamps change it
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-dn]"); if (!b) return; const sec = b.closest(".rm-shop"); const st = sec && $(".hs-stage", sec); if (!st) return; st.classList.toggle("eve", b.dataset.dn === "kvall"); $$("[data-dn]", sec).forEach((x) => x.setAttribute("aria-pressed", x === b)); });
  /* the total cost up front: shipping on the product page, so nothing new appears in the checkout */
  RQ.shipNote = (p) => {
    const free = (window.RQ_CONFIG || {}).freeShippingFrom, ship = (S.SHIPPING || [])[0];
    if (!ship) return "";
    if (free && p.price >= free) return `<p class="ship-note"><b>Fri frakt</b> till ombud och paketskåp. Totalt ${S.kr(p.price)}.</p>`;
    return `<p class="ship-note">Frakt ${S.kr(ship.price)} till ombud och paketskåp${free ? `, fri frakt från ${S.kr(free)}` : ""}.</p>`;
  };
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
    const left = Math.max(0, from - net), pct = left ? Math.min(97, Math.floor((net / from) * 100)) : 100;
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
  // help pages people look for in the search box (words are matched without å ä ö)
  const HELP = [
    ["frakt", "Frakt & leverans", /^(frakt|leverans|leverera|skicka|hemleverans|ombud|paketskap|shipping|delivery)/],
    ["returer", "Returer & återbetalning", /^(retur|aterbetal|oppet kop|bytesratt|byta|refund)/],
    ["angra", "Ångra avtalet här", /^(angra|anger|avbestall|cancel|withdraw)/],
    ["betalning", "Betalning", /^(betal|klarna|swish|faktura|pay)/],
    ["spara-order", "Spåra min beställning", /^(sparning|paket|order|bestallning|track)/, /^spår/],
    ["kontakt", "Kontakt", /^(kontakt|kundservice|kundtjanst|support|mejl|telefon|contact)/],
    ["faq", "Vanliga frågor", /^(fraga|fragor|faq|hjalp|help)/],
    ["hitta-ratt-present", "Hitta rätt present", /^(present|gava|julklapp|gift)/],
    ["presentkort", "Presentkort", /^(present|gava|julklapp|gift)/],
    ["juridik-garanti", "Reklamation & garanti", /^(reklam|garanti|trasig|skad|warranty)/],
  ];
  RQ.nProd = nProd;
  const POPULAR = () => `<p class="eyebrow" style="margin-bottom:1rem">Populärt</p><div class="chips">${["Lampa", "Ek", "Lin", "Förvaring", "Badrum", "Present", "Hall", "Lugnt och varmt", "Mjukt i sovrummet"].map((t) => `<button class="chip" type="button" data-q="${t}">${t}</button>`).join("")}</div>`;
  const doSearch = () => {
    const q = sInput.value.trim(), tones = RQ.toneChips ? RQ.toneChips() : "", ext = RQ.flowSearch ? RQ.flowSearch(q) : null;
    $("#search").classList.toggle("has-q", !!q);
    if (!q && !ext) { sRes.innerHTML = `${POPULAR()}${tones}`; return; }
    if (ext) { sRes.innerHTML = `${tones}${ext.note ? `<p class="small s-note">${ext.note}</p>` : ""}${ext.list.length ? `<p class="eyebrow" style="margin-bottom:1rem">${nProd(ext.list.length)}</p>${RQ.grid(ext.list)}` : `<div class="empty"><h3>Inga träffar</h3><p>Prova en annan färg eller ett annat ord.</p></div>`}`; RQ.watch(sRes); return; }
    const found = S.search(q), list = found.list, words = S._words(q), raw = S.norm(q).split(/\s+/);
    if (found.short) { sRes.innerHTML = `<p class="small s-note" role="status">Skriv minst två bokstäver.</p>${POPULAR()}`; return; }
    const arts = RQ.ARTICLES.filter((a) => S.norm(a.title + " " + a.lead).includes(S.norm(q)));
    const cats = RQ.CATEGORIES.filter((c) => S.fold(c.name).includes(S.fold(q)));
    const help = HELP.filter((h) => words.some((w) => h[2].test(w)) || (h[3] && raw.some((w) => h[3].test(w))) || h[2].test(S.fold(q)));
    const links = `${cats.map((c) => `<a class="chip" href="#kategori-${c.id}" data-close>${esc(c.name)}</a>`).join("")}${help.map((h) => `<a class="chip s-help" href="#${h[0]}" data-close>${h[1]}</a>`).join("")}`;
    sRes.innerHTML = `${found.fixed ? `<p class="s-fix" role="status">Menade du <b>${esc(found.fixed)}</b>? Här är träffarna för det.</p>` : ""}${links ? `<div class="chips" style="margin-bottom:1.6rem">${links}</div>` : ""}
      ${list.length ? `<p class="eyebrow" style="margin-bottom:1rem" role="status">${nProd(list.length)}</p>${RQ.grid(list)}` : help.length || cats.length ? "" : `<div class="empty"><h3>Inga träffar på "${esc(q)}"</h3><p>Prova ett annat ord, eller beskriv vad du behöver i den smarta sökningen.</p><a class="btn ghost" href="#studio-sok" data-close>Smart sökning</a></div>${RQ.svepNudge ? RQ.svepNudge("Hittar du inte rätt ord?", "Svep i stället. Tio kort, så visar vi vad som passar dig.").replace('class="sv-nudge"', 'class="sv-nudge" data-close') : ""}`}
      ${arts.length ? `<p class="eyebrow" style="margin:2.4rem 0 1rem">Från magasinet</p><div class="mag-grid">${arts.slice(0, 3).map(RQ.magCard).join("")}</div>` : ""}`;
    RQ.watch(sRes);
  };
  RQ.doSearch = doSearch;
  let sT; sInput.addEventListener("input", () => { clearTimeout(sT); sT = setTimeout(doSearch, 140); });
  RQ.openSearch = () => { const from = document.activeElement; closeAll(); opener = from && from !== document.body ? from : null; $("#toast").classList.remove("show"); $("#search").classList.add("open"); $("#search").scrollTop = 0; document.documentElement.style.overflow = "hidden"; doSearch(); setTimeout(() => { sInput.focus(); sInput.select(); }, 60); };
  // keys in the search: Enter puts the keyboard away on a phone and steps into the hits, the arrows walk through them
  const sItems = () => $$("a.chip, button.chip, .card .ct a, .empty a, .mag-grid a", sRes).filter((el) => el.offsetParent);
  $("#search").addEventListener("keydown", (e) => {
    const items = sItems(), i = items.indexOf(document.activeElement), inField = e.target === sInput;
    if (e.key === "Enter" && inField) { e.preventDefault(); clearTimeout(sT); doSearch(); const first = $(".card .ct a", sRes) || sItems()[0]; if (matchMedia("(pointer:coarse)").matches || !first) sInput.blur(); else first.focus(); return; }
    if (e.key === "ArrowDown" && inField && items.length) { e.preventDefault(); ($(".card .ct a", sRes) || items[0]).focus(); return; }
    if (i < 0 || !/^Arrow(Down|Up|Left|Right)$/.test(e.key)) return;
    e.preventDefault(); const n = i + (/Down|Right/.test(e.key) ? 1 : -1);
    if (n < 0) sInput.focus(); else if (items[n]) items[n].focus();
  });

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
  /* keyboard: Escape closes the panel and returns to its button, tabbing out of the panel closes it */
  megaBtns.forEach((b) => { const li = b.parentElement;
    li.addEventListener("keydown", (e) => { if (e.key === "Escape" && b.getAttribute("aria-expanded") === "true") { e.stopPropagation(); closeMega(); b.focus(); } });
    li.addEventListener("focusout", (e) => { if (b.getAttribute("aria-expanded") === "true" && e.relatedTarget && !li.contains(e.relatedTarget)) closeMega(); });
  });
  /* the menu shows where you are, and every icon in the bar says what it is when the mouse rests on it */
  const NAV_AT = [[/^(upptack|svep|magasin|artikel-|inspiration|hitta-ratt|onska|for-dig)/, 0], [/^(butik|kategori-|produkt-|rum$|rum-|nyheter|favoriter|erbjudanden|kollektion-|presentkort)/, 1], [/^(looks$|look-|kollektioner)/, 2]];
  const navMark = () => {
    const r = location.hash.slice(1) || location.pathname.replace(/\/$/, "").split("/").pop() || "", hit = NAV_AT.find(([re]) => re.test(r));
    $$(".menu > li > a, .menu > li > button").forEach((el, i) => { const on = !!hit && hit[1] === i; el.classList.toggle("active", on); if (el.tagName === "A") { if (on) el.setAttribute("aria-current", "page"); else el.removeAttribute("aria-current"); } });
    $$(".tools > a[aria-label], .tools > button[aria-label], #lampBtn").forEach((el) => { const t = el.getAttribute("aria-label"); if (el.title !== t) el.title = t; });
    const rp = $(".roompill"); if (rp && !rp.title) rp.title = "Mitt rum";
  };
  RQ.navMark = navMark;
  if (window.MutationObserver) new MutationObserver(navMark).observe($("#view"), { childList: true });
  document.addEventListener("DOMContentLoaded", navMark);

  // global clicks
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-wish],[data-add],[data-open-cart],[data-close],[data-open-search],[data-q],[data-rm],[data-undo-rm],[data-line],[data-action],[data-cart-room],#burger,#mnavClose,a[href^='#']");
    if (!t) { if (!e.target.closest(".mega,.nav")) closeMega(); return; }
    if (t.matches("[data-wish]")) { const on = S.toggleWish(t.dataset.wish); t.setAttribute("aria-pressed", on); if (t.classList.contains("chip")) t.textContent = on ? "Sparad i önskelistan" : "Spara i önskelistan"; if (t.closest(".pactions")) $("span", t).textContent = on ? "Sparad" : "Spara"; if (on && RQ.flyWish) RQ.flyWish(t); RQ.toast(on ? 'Sparad i Mitt hem. <a href="#mitt-hem">Visa</a>' : "Borttagen ur Mitt hem"); return; }
    if (t.matches("[data-add]")) { S.addToCart(t.dataset.add, 1); const pr = RQ.byHandle(t.dataset.add.split("::")[0]); RQ.confirmAdd(t, pr ? pr.name : ""); return; }
    if (t.matches("[data-open-cart]")) { e.preventDefault(); openCart(); return; }
    if (t.matches("[data-open-search]")) { e.preventDefault(); RQ.openSearch(); return; }
    if (t.matches("[data-q]") && t.closest("#searchRes")) { sInput.value = t.dataset.q; doSearch(); return; }
    if (t.matches("[data-rm]")) { // nothing leaves the cart for good by one tap: the toast offers to put it back
      const l = S.cartLines().find((x) => x.id === t.dataset.rm), at = S._cart.findIndex((x) => x.v === t.dataset.rm);
      S.setQty(t.dataset.rm, 0);
      if (l) { undoRm = { v: l.id, q: l.quantity, at }; RQ.toast(`<span>${esc(l.product.name)} togs bort.</span> <button type="button" data-undo-rm>Ångra</button>`, 7000); }
      return; }
    if (t.matches("[data-undo-rm]")) { const u = undoRm; undoRm = null; $("#toast").classList.remove("show");
      if (u && !S._cart.some((x) => x.v === u.v)) { S._cart.splice(Math.min(Math.max(0, u.at), S._cart.length), 0, { v: u.v, q: u.q }); S.setQty(u.v, u.q); const b = $(`[data-rm="${u.v}"]`, drawer); if (b && drawer.classList.contains("open")) b.focus({ preventScroll: true }); }
      return; }
    if (t.matches("[data-line]")) { const l = S.cartLines().find((x) => x.id === t.dataset.line); if (l) S.setQty(l.id, l.quantity + +t.dataset.d); return; }
    if (t.matches("[data-action=cookies]")) { RQ.showCookies(true); return; }
    if (t.id === "burger") { opener = t; $("#mnav").classList.add("open"); t.setAttribute("aria-expanded", "true"); document.documentElement.style.overflow = "hidden"; setTimeout(() => $("#mnavClose").focus(), 60); return; }
    if (t.id === "mnavClose") { closeAll(); return; }
    if (t.matches("a[data-after]")) RQ.ss.set("rumiq-after-login", "#" + t.dataset.after);
    if (t.matches("[data-close]") || t.matches("a[href^='#']")) { closeAll(); }
    if (t.matches("[data-cart-room]")) { const hs = S.cartLines().map((l) => l.product.handle); const go = () => { hs.forEach((h) => RQ.room.add(h, true)); location.hash = "#mitt-rum"; }; closeAll(); if (RQ.room.has()) go(); else RQ.room.openSetup(go); }
  });
  let undoRm = null;
  scrimAll.addEventListener("click", closeAll);

  /* ---------------------------------------------------------------- layers and the Back button
     Menu, search, cart, the picture viewer, the 3D view and the room sheets put ONE entry in the history while any
     of them is open. Back (the button, or the edge swipe on a phone) then closes the layer and the page stays
     where it was. Closing a layer by its own button takes that entry away again. Layers are found by their
     "open" class, so a new layer only needs to be a dialog directly in <body> (or be added to LAYERS). */
  const LAYERS = "#cart, #search, #mnav, .lb, body > [role=dialog]:not(#sheet):not(#cookie)";
  RQ.layers = (() => {
    let watched = [], hold = false, navFrom = null;
    const dlg = () => $("dialog.m3d[open]");
    const anyOpen = () => watched.some((el) => el.classList.contains("open")) || !!dlg();
    const onTop = () => !!(history.state && history.state.rqLayer);
    // called after any layer opened or closed (class changes arrive here one microtask later)
    const sync = () => {
      if (hold) { hold = false; return; }
      if (anyOpen()) { if (!onTop()) { try { history.pushState({ rqLayer: 1 }, "", location.href); } catch (e) {} } }
      else if (onTop()) history.back();
    };
    const shut = () => { // Back was pressed: close whatever is open, without touching the history again
      closeAll();
      watched.forEach((el) => { if (!el.classList.contains("open")) return;
        if (el.classList.contains("lb")) RQ.lightbox.close();
        else { const x = el.querySelector("[data-sheet-close], .sheet-x, [data-close], .close"); if (x) x.click(); else el.classList.remove("open"); } });
      const d = dlg(); if (d) d.close();
    };
    if (window.navigation && navigation.addEventListener) navigation.addEventListener("currententrychange", (e) => { navFrom = e.from ? e.from.index : null; });
    window.addEventListener("popstate", (e) => {
      if (anyOpen()) { shut(); return; }
      // an entry a layer left behind (the layer was closed by going somewhere else): step over it, the way we were going
      if (e.state && e.state.rqLayer) { const fwd = navFrom != null && navigation.currentEntry && navigation.currentEntry.index > navFrom; hold = false; if (fwd) history.forward(); else history.back(); }
    });
    // a link inside a layer: the new page takes the layer's place in the history (no dead step on the way back)
    window.addEventListener("click", (e) => {
      if (!onTop() || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest && e.target.closest("a[href]"); if (!a || !a.closest("#cart,#search,#mnav") || (a.target && a.target !== "_self")) return;
      const h = a.getAttribute("href"); let raw = null;
      if (h[0] === "#") raw = h.length > 1 ? decodeURIComponent(h.slice(1)) : null;
      else { try { const u = new URL(a.href), base = new URL(".", document.baseURI); if (u.origin === location.origin && u.pathname.startsWith(base.pathname) && !u.hash) raw = decodeURIComponent(u.pathname.slice(base.pathname.length).replace(/index\.html$/, "").replace(/\/+$/, "")) || "hem"; } catch (x) {} }
      if (raw == null || !RQ.isRoute(raw)) return;
      e.preventDefault(); closeAll();
      const home = (r) => /^(hem)?$/.test(r || "");
      if (raw === RQ.currentRoute() || (home(raw) && home(RQ.currentRoute()))) return; // same page: the layer just closes (sync steps back)
      hold = true; try { history.replaceState(null, "", RQ.pathFor(raw)); } catch (x) {} RQ.router(); Promise.resolve().then(() => { hold = false; });
    }, true);
    document.addEventListener("DOMContentLoaded", () => {
      if (onTop()) { try { history.replaceState(null, "", location.href); } catch (e) {} } // reloaded with a layer open: the layer is gone
      watched = $$(LAYERS);
      const mo = new MutationObserver(sync);
      watched.forEach((el) => mo.observe(el, { attributes: true, attributeFilter: ["class"] }));
      if (RQ.p3d && RQ.p3d.open) { const open3d = RQ.p3d.open; RQ.p3d.open = function (...a) { const r = open3d.apply(this, a), d = dlg(); if (d) { sync(); d.addEventListener("close", () => setTimeout(sync, 0)); } return r; }; }
    });
    return { sync, anyOpen };
  })();
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
  // what was just put in the cart (how many, which colour), so the confirmation can say it
  let lastAdd = null; const add0 = S.addToCart;
  S.addToCart = (v, q = 1) => { lastAdd = { v, q, at: Date.now() }; return add0.call(S, v, q); };
  // a second tap while the button still says "Tillagd" is a slip of the finger, not a second order
  document.addEventListener("click", (e) => { const b = e.target.closest && e.target.closest("button.done"); if (b && b._t) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  RQ.confirmAdd = (btn, name) => {
    const la = lastAdd && Date.now() - lastAdd.at < 400 ? lastAdd : null, r = la ? S.variantById(la.v) : null;
    const what = name ? `${la && la.q > 1 ? la.q + " × " : ""}${esc(name)}${r && r.variant && r.variant.title !== "Standard" ? ", " + esc(r.variant.title) : ""}` : "";
    if (btn && btn.classList) {
      const isQ = btn.classList.contains("qadd");
      if (!btn.dataset.label) btn.dataset.label = btn.innerHTML;
      btn.classList.add("done");
      btn.innerHTML = isQ ? '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg><span>Tillagd</span>' : "Tillagd i varukorgen";
      clearTimeout(btn._t); btn._t = setTimeout(() => { btn._t = null; btn.classList.remove("done"); btn.innerHTML = btn.dataset.label; }, 1800);
    }
    if ($("#cart").classList.contains("open")) return; // in the open cart the new row is the confirmation
    RQ.toast(`${what ? `<span><span>${what}</span> <span>ligger i varukorgen.</span></span>` : "<span>Lagd i varukorgen.</span>"} <a href="#" data-open-cart>Visa</a>`);
  };

  // daylight switch
  const lampBtn = $("#lampBtn"), lightMenu = $("#lightMenu");
  const LIGHT_LABEL = { auto: "Följ dagsljuset", dag: "Dag", kvall: "Kväll" };
  const sunNow = () => { const d = new Date(), h = d.getHours() + d.getMinutes() / 60, S2 = [[8.7, 15], [7.6, 16.3], [6.3, 17.7], [6.2, 19.9], [4.8, 21], [3.7, 22], [4, 21.9], [5.2, 20.7], [6.6, 19.1], [7.9, 17.4], [7.4, 15.4], [8.6, 14.8]][d.getMonth()]; return h < S2[0] || h >= Math.max(S2[1], 17) ? "kvall" : "dag"; };
  // the site is light by default; only a choice the visitor makes is remembered (key rumiq-ljus)
  const applyLight = (mode, save) => {
    const r = document.documentElement, t = mode === "auto" ? sunNow() : mode;
    r.setAttribute("data-light", t); r.setAttribute("data-light-mode", mode);
    if (save) { try { localStorage.setItem("rumiq-ljus", mode); } catch (e) {} }
    const tc = $("meta[name=theme-color]"); if (tc) tc.content = t === "kvall" ? "#191A18" : "#EDEDEA";
    $$("[data-light-set]").forEach((b) => b.setAttribute("aria-checked", b.dataset.lightSet === mode));
    $$("[data-light-label]").forEach((el) => (el.textContent = LIGHT_LABEL[mode]));
  };
  RQ.applyLight = applyLight;
  function closeLight() { if (lightMenu) { lightMenu.classList.remove("open"); lampBtn.setAttribute("aria-expanded", "false"); } }
  if (lampBtn) {
    applyLight(document.documentElement.getAttribute("data-light-mode") || "dag");
    lampBtn.addEventListener("click", (e) => { e.stopPropagation(); const open = !lightMenu.classList.contains("open"); closeMega(); lightMenu.classList.toggle("open", open); lampBtn.setAttribute("aria-expanded", open); if (open) setTimeout(() => $("[aria-checked=true]", lightMenu)?.focus(), 30); });
    lightMenu.addEventListener("click", (e) => { const b = e.target.closest("[data-light-set]"); if (!b) return; e.stopPropagation(); applyLight(b.dataset.lightSet, true); closeLight(); lampBtn.focus(); });
    document.addEventListener("click", (e) => { if (!e.target.closest(".lampwrap")) closeLight(); });
    $$("[data-light-cycle]").forEach((b) => b.addEventListener("click", () => { const order = ["dag", "kvall", "auto"]; const cur = document.documentElement.getAttribute("data-light-mode") || "dag"; applyLight(order[(order.indexOf(cur) + 1) % 3], true); }));
    setInterval(() => { if (document.documentElement.getAttribute("data-light-mode") === "auto") applyLight("auto"); }, 5 * 60 * 1000);
  }

  // dock steps aside while reading downwards, returns on the way up
  const dock = $("#dock"); let lastY = scrollY, dockTick = false;
  window.addEventListener("scroll", () => { if (dockTick || !dock) return; dockTick = true; requestAnimationFrame(() => { const y = scrollY; const end = y + innerHeight >= document.documentElement.scrollHeight - 90; if (Math.abs(y - lastY) > 8 || end) { dock.classList.toggle("away", y > lastY && y > 240 && !end); lastY = y; } dockTick = false; }); }, { passive: true });

  /* ---------------------------------------------------------------- lightbox: pinch, double tap, wheel, drag, swipe, keys */
  RQ.lightbox = (() => {
    const el = document.createElement("div");
    el.className = "lb"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Bildvisning"); el.hidden = false;
    el.innerHTML = `<div class="lb-top"><div class="t"><b class="lb-title"></b><span class="lb-count"></span></div><div class="lb-ctrl"><button class="iconbtn" type="button" data-z="-1" aria-label="Zooma ut"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2M8.5 11h5"/></svg></button><button class="iconbtn" type="button" data-z="1" aria-label="Zooma in"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2M11 8.5v5M8.5 11h5"/></svg></button><button class="iconbtn lb-x" type="button" aria-label="Stäng bildvisningen"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div></div>
      <div class="lb-stage"><img class="lb-img" alt=""><p class="lb-hint">${matchMedia("(hover:hover) and (pointer:fine)").matches ? "Scrolla eller dubbelklicka för att zooma" : "Dubbeltryck eller nyp för att zooma"}</p></div>
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
  // the answer is written under the field (a toast far from the form is easy to miss); nothing is called saved that was not
  $("#newsEmail").setAttribute("autocomplete", "email"); $("#newsEmail").setAttribute("autocapitalize", "off");
  $("#newsForm").addEventListener("submit", async (e) => { e.preventDefault(); const f = e.currentTarget, v = f.email.value.trim(), btn = $("button", f);
    let st = $("#newsStatus", f); if (!st) { st = document.createElement("p"); st.id = "newsStatus"; st.className = "status"; st.setAttribute("role", "status"); f.appendChild(st); }
    const say = (msg, err) => { st.textContent = msg; st.classList.toggle("err", !!err); };
    if (!MAIL_OK.test(v)) { say(v ? "Skriv en giltig e-postadress, till exempel namn@exempel.se." : "Skriv din e-postadress.", true); f.email.setAttribute("aria-invalid", "true"); f.email.focus(); return; }
    f.email.removeAttribute("aria-invalid"); if (btn.disabled) return; btn.disabled = true; say("");
    const res = await RQ.subscribe({ email: v, lista: "Nyhetsbrev" }); btn.disabled = false;
    say(res === "sent" ? "Tack. Du får nyhetsbrevet och 10 % på första köpet när vi öppnar." : res === "preview" ? "Förhandsversion: adressen sparades inte här." : "Det gick inte att skicka just nu. Försök igen om en stund.", res === "error"); if (res === "sent") f.reset(); });
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

  window.addEventListener("hashchange", onNav);
  document.addEventListener("DOMContentLoaded", () => {
    RQ.router(); navCheck();
    /* the first screen of the home page belongs to the offer: on the home page the cookie bar waits until the
       visitor has scrolled past it or gone to another page; everywhere else it shows after a moment */
    if (!document.body.classList.contains("on-home")) { setTimeout(() => RQ.showCookies(false), 1200); return; }
    let done = false; const go = () => { if (done) return; done = true; window.removeEventListener("scroll", onScroll); left.disconnect(); RQ.showCookies(false); };
    const onScroll = () => { if (window.scrollY > window.innerHeight * 0.6) go(); };
    const left = new MutationObserver(() => { if (!document.body.classList.contains("on-home")) go(); });
    window.addEventListener("scroll", onScroll, { passive: true }); left.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  });
})();
