/* RumIQ Svep: swipe your style.
   Right = save to Favourites, left = no thanks, undo = one step back. Into the cart: the bag button, the
   up arrow, or a drag upwards with a mouse. A finger moving up or down always scrolls the page, so on
   touch screens there is no swipe-up (it used to put things in the cart when someone only scrolled).
   One engine (runDeck) drives three decks:
   - Svep: rounds of 10 cards that learn while you swipe, for the whole shop or one room (#svep-rum-<id>).
   - The three-card taster on the home page, which carries on into Svep where it stopped.
   - Svep tillsammans (#svep-ihop): two people swipe the same cards through a shared link and see what
     they both like. The link carries the cards and the answers, nothing is stored on a server.
   Also here: the style picture to share, "Kommer snart" cards that ask whether RumIQ should take in a
   candidate product, the small Svep nudges used on empty pages, and anonymous swipe counts. The counts
   are sent only with consent to statistics and only hold the product, the choice and a random id that
   lives as long as the page. Loaded after flow.js (needs RQ.taste, RQ.addMany, RQ.sheet). */
(function () {
  const RQ = window.RQ, S = RQ.shop, V = RQ.views, $ = RQ.$, $$ = RQ.$$, esc = RQ.esc, kr = S.kr, ICO = RQ.ICO5;
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ls = S.store; // the shop's one typed reader (commerce.js)
  const ss = {
    get(k, d) { try { const v = sessionStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { sessionStorage.removeItem(k); } catch (e) {} },
  };
  const hex2rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const hash = (s) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
  const tr = (s) => (window.RQ_LANG === "en" && window.RQ_EN && window.RQ_EN.dict[s]) || s;
  const ROUND = 10, HOME_CARDS = 3, MAXV = 3;
  const SV = {
    bag: '<svg viewBox="0 0 24 24"><path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></svg>',
    undo: '<svg viewBox="0 0 24 24"><path d="M9 7L4 12l5 5"/><path d="M4 12h10a6 6 0 0 1 0 12h-2" transform="translate(0 -6)"/></svg>',
    share: '<svg viewBox="0 0 24 24"><path d="M12 15V4M8 8l4-4 4 4"/><path d="M5 13v6h14v-6"/></svg>',
    two: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><circle cx="16.5" cy="9.5" r="2.4"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0M14.5 19a4.3 4.3 0 0 1 6.5-3.6"/></svg>',
    link: '<svg viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  };

  /* ---------------------------------------------------------------- anonymous swipe counts */
  const sid = Math.random().toString(36).slice(2, 10);
  const stat = (item, choice, ctx) => {
    const c = S.consent && S.consent(); if (!c || !c.stats) return;
    if (location.protocol === "file:" || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return;
    const cfg = window.RQ_CONFIG || {}, a = cfg.auth || {}; if (cfg.swipeStats === false || !a.supabaseUrl || !a.supabaseAnonKey) return;
    try {
      fetch(`${a.supabaseUrl}/rest/v1/swipe_events`, { method: "POST", keepalive: true, headers: { apikey: a.supabaseAnonKey, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ item: String(item).slice(0, 80), choice, ctx: String(ctx || "svep").slice(0, 40), sid }) }).catch(() => {});
    } catch (e) {}
  };

  /* ---------------------------------------------------------------- the cards */
  const inScope = (p, scope) => !scope || p.rooms.includes(scope);
  const EXPLORED = new Set();
  // the next cards: a varied opener, then the best match with every fourth card from somewhere else
  const upcoming = (t, skip, n, step, scope) => {
    const left = RQ.PRODUCTS.filter((p) => inScope(p, scope) && !(p.handle in t.seen) && !skip.has(p.handle));
    const out = [];
    while (out.length < n && left.length) {
      const k = step + out.length; let pick;
      if (t.likes < 2 || k % 4 === 3) { // explore: a category not seen lately, in a stable order
        const recent = new Set(out.map((p) => p.cat));
        const pool = left.filter((p) => !recent.has(p.cat)); const from = pool.length ? pool : left;
        pick = from.sort((a, b) => hash(a.handle + k) - hash(b.handle + k))[0]; EXPLORED.add(pick.handle); // picked for variety, so no "why" chip
      } else pick = left.sort((a, b) => RQ.taste.score(b, t) - RQ.taste.score(a, t))[0];
      out.push(pick); left.splice(left.indexOf(pick), 1);
    }
    return out;
  };
  // "Kommer snart": one candidate product per round asks whether we should take it in (votes as on #rosta)
  const soonWrap = (c) => ({ soon: c, handle: "soon:" + c.id });
  const nextSoon = () => { const s = ls.get("rumiq-soon", {}); const c = RQ.CANDIDATES.find((x) => !(x.id in s)); return c ? soonWrap(c) : null; };
  const resolve = (h) => (h.startsWith("soon:") ? (RQ.CANDIDATES.find((c) => "soon:" + c.id === h) ? soonWrap(RQ.CANDIDATES.find((c) => "soon:" + c.id === h)) : null) : RQ.byHandle(h));

  const svImgs = (p) => [{ src: RQ.img(p, 900), set: `${RQ.img(p, 600)} 600w, ${RQ.img(p, 900)} 900w`, alt: p.name }, { src: `assets/img/d/${p.handle}-1200.webp`, set: `assets/img/d/${p.handle}-600.webp 600w, assets/img/d/${p.handle}-1200.webp 1200w`, alt: `${p.name}, detalj` }];
  const stamps = (yes, up) => `<span class="sv-stamp yes" aria-hidden="true">${yes}</span><span class="sv-stamp no" aria-hidden="true">Nej tack</span><span class="sv-stamp up" aria-hidden="true">${up}</span>`;
  const svCard = (p, i, why) => `<article class="sv-card" data-h="${p.handle}" data-img="0" style="--i:${i}" aria-hidden="${i ? "true" : "false"}">
      <div class="sv-ims">${svImgs(p).map((m, k) => `<img class="${k ? "" : "on"}" src="${m.src}" srcset="${m.set}" sizes="(min-width:900px) 26rem, 88vw" alt="${esc(m.alt)}" draggable="false" ${i > 1 || k ? 'loading="lazy"' : ""}>`).join("")}</div>
      ${!i && RQ.film && RQ.film(p) ? `<video class="sv-film" src="${RQ.film(p)}" muted playsinline loop autoplay preload="metadata" aria-hidden="true"></video>` : ""}
      ${!i && RQ.LAMPS && RQ.LAMPS.includes(p.handle) ? `<img class="sv-off" src="assets/img/p/${p.handle}-off-1400.webp" alt="" aria-hidden="true" draggable="false" onerror="this.remove()">` : ""}
      <div class="sv-dots" aria-hidden="true"><i class="on"></i><i></i></div>
      ${why ? `<span class="sv-why">${esc(why)}</span>` : ""}
      ${stamps("Spara", "I varukorgen")}
      <div class="sv-info"><div><b>${esc(p.name)}</b><span>${kr(p.price)}</span></div><small>${p.rooms.slice(0, 3).map((r) => `<span>${esc(RQ.roomById(r).name)}</span>`).join(" · ")}</small></div>
    </article>`;
  const svSoon = (c, i) => `<article class="sv-card soon" data-h="soon:${c.id}" style="--i:${i};--tone:${c.tone}" aria-hidden="${i ? "true" : "false"}">
      <div class="sv-soon"><span class="sv-soon-tag">Kommer snart?</span>${c.img ? `<img class="sv-soon-img" src="${c.img}" alt="${esc(c.name)}" draggable="false">` : `<span class="sv-soon-sw" aria-hidden="true"></span>`}<b>${esc(c.name)}</b><p>${esc(c.line)}</p>
        <small><span class="sv-soon-why">Vi har inget eget lager, så vi kan fråga först.</span> <span>Svep höger om du vill att vi tar in den.</span></small></div>
      ${stamps("Ja tack", "Ja tack")}
    </article>`;

  const STYLE_KEYS = ["skandinavisk", "minimalistisk", "klassisk", "mjuk"];
  const nearestTone = (hex) => { const c = hex2rgb(hex); return RQ.TONES.reduce((b, x) => (dist(hex2rgb(x.hex), c) < dist(hex2rgb(b.hex), c) ? x : b)); };
  // the style profile: share of each style, a palette from what you liked, the look that fits best
  RQ.styleProfile = (t = RQ.taste.get()) => {
    const pos = STYLE_KEYS.map((k) => [k, Math.max(0, t.styles[k] || 0)]), sum = pos.reduce((s, e) => s + e[1], 0);
    const mix = sum ? pos.map(([k, v]) => ({ id: k, name: RQ.STYLES[k].name, pct: Math.round((v / sum) * 100) })).sort((a, b) => b.pct - a.pct) : [];
    const likedH = Object.keys(t.seen).filter((h) => t.seen[h] > 0 && RQ.byHandle(h));
    const tones = []; likedH.forEach((h) => { const n = nearestTone(RQ.byHandle(h).tone[0]); if (!tones.some((x) => x.id === n.id)) tones.push(n); });
    const look = RQ.LOOKS.map((l) => ({ l, s: l.items.reduce((a, h) => a + RQ.taste.score(RQ.byHandle(h), t), 0) / l.items.length })).sort((a, b) => b.s - a.s)[0];
    return { mix, tones: tones.slice(0, 6), look: sum ? look.l : null, liked: likedH };
  };
  // "Din stil över tid": the style mix after each finished round, the newest first (rumiq-style-log, synced with the account)
  RQ.styleLog = {
    get: () => (ls.get("rumiq-style-log", []) || []).filter((x) => x && x.at && Array.isArray(x.mix)),
    add(prof, scope) { const e = { at: new Date().toISOString(), mix: prof.mix.filter((m) => m.pct > 0).map((m) => [m.id, m.pct]), likes: prof.liked.length, scope: scope || "" };
      (RQ.vault ? RQ.vault.set : ls.set).call(RQ.vault || ls, "rumiq-style-log", [e, ...RQ.styleLog.get()].slice(0, 12)); },
  };

  /* ---------------------------------------------------------------- true reasons, and "Mer som det här"
     RQ.why.of(p, ctx) gives one short reason that holds for p, or "" (never a made-up one, never for something you said no to):
       ctx.room (a room project): "Saknas i ditt rum: en lampa" when the room has no thing of that kind and the kind belongs in
         that kind of room (kinds of things, not shop categories: a cushion cover is textile); ctx.group (G.calc):
         "Ni gillade båda den", "Alla gillade den", "3 av 4 gillade den"; ctx.room again: "Passar ditt vardagsrum" when it is made
         for that kind of room and has the room's style;
       you: "Du gillade den i Svep", "Du har sparat den" (a thing you liked is never explained by another thing you liked);
         "Eftersom du gillade Glob bordslampa" when it is the same kind of thing, shares a style and a room with it;
         "Samma färgton som Glob bordslampa" when it is another kind of thing but the same colour family, style and room;
         "Passar din stil: Skandinavisk" when it has the style you lean to most. ctx.mine = false leaves out the first two. */
  // the kind of thing: data can say it (p.kind, ready for Shopify), else the name, else the shop category
  const KINDS = { lampa: "en lampa", ljus: "levande ljus", textil: "textil", vagg: "något på väggen", forvaring: "förvaring", detalj: "en vas eller kruka", kok: "något för köket", bad: "något för badet" };
  const CAT_KIND = { "belysning-atmosfar": "lampa", "tavlor-vaggar": "vagg", "forvaring-organisering": "forvaring", "sovrum-komfort": "textil", "hem-inredning": "detalj", "kok-matplats": "kok", "badrum-valmaende": "bad", uteliv: "detalj" };
  const kindOf = (p) => (p.kind && KINDS[p.kind] ? p.kind : /kudd|plad|paslakan|gardin|matta|handduk/.test(p.handle) ? "textil" : /lampa/.test(p.handle) ? "lampa" : /doftljus|ljusstake/.test(p.handle) ? "ljus" : /affisch|tavla|poster/.test(p.handle) ? "vagg" : /vas|kruka/.test(p.handle) ? "detalj" : CAT_KIND[p.cat] || "detalj");
  // what belongs in each kind of room, in the order a room usually needs it
  const ROOM_KINDS = { vardagsrum: ["lampa", "textil", "vagg", "detalj"], sovrum: ["textil", "lampa", "forvaring"], kok: ["kok", "forvaring"], badrum: ["bad", "forvaring"], hall: ["forvaring", "lampa", "vagg"], hemmakontor: ["forvaring", "lampa", "vagg"], uteliv: ["detalj", "lampa"] };
  const ROOMWORD = { hall: ["din hall", "er hall"], uteliv: ["din uteplats", "er uteplats"] };
  const roomWord = (t, ours) => (ROOMWORD[t] || [`ditt ${(RQ.roomById(t) || { name: "rum" }).name.toLowerCase()}`, `ert ${(RQ.roomById(t) || { name: "rum" }).name.toLowerCase()}`])[ours ? 1 : 0];
  const sameTone = (p, q) => nearestTone(p.tone[0]).id === nearestTone(q.tone[0]).id;
  const shareRoom = (p, q) => p.rooms.some((r) => q.rooms.includes(r));
  const shareStyle_ = (p, q) => p.styles.some((s) => q.styles.includes(s));
  // how p is like q: "kind" (same kind of thing), "tone" (another kind, the same colour family), or "" (not alike enough to say)
  const likeness = (p, q) => (p.handle === q.handle || !shareStyle_(p, q) || !shareRoom(p, q) ? "" : kindOf(p) === kindOf(q) ? "kind" : sameTone(p, q) ? "tone" : "");
  const likedOf = (t) => [...new Set([...Object.keys(t.seen).filter((h) => t.seen[h] > 0), ...(S.wishlist ? S.wishlist().map((p) => p.handle) : [])])].map(RQ.byHandle).filter(Boolean);
  const liked = (t, h) => t.seen[h] > 0 || S.isWished(h), rejected = (t, h) => t.seen[h] < 0 && !S.isWished(h);
  RQ.why = {
    kindOf, kindName: (p) => KINDS[kindOf(p)], roomWord, likeness,
    missing(r, p) { if (!r || !p || !p.rooms.includes(r.type)) return false; const k = kindOf(p), its = (r.items || []).map((it) => RQ.byHandle(it.h)).filter(Boolean); return (ROOM_KINDS[r.type] || []).includes(k) && !its.some((q) => kindOf(q) === k); },
    // what a room lacks: the kinds that belong in that kind of room that it has nothing of, each with the best thing for it
    gaps(r) { if (!r) return []; const its = (r.items || []).map((it) => RQ.byHandle(it.h)).filter(Boolean), t = RQ.taste.get();
      return (ROOM_KINDS[r.type] || []).filter((k) => !its.some((q) => kindOf(q) === k)).map((k) => RQ.PRODUCTS.filter((p) => kindOf(p) === k && p.rooms.includes(r.type) && !rejected(t, p.handle))
        .sort((a, b) => (r.style ? (b.styles.includes(r.style) ? 1 : 0) - (a.styles.includes(r.style) ? 1 : 0) : 0) || RQ.taste.score(b, t) - RQ.taste.score(a, t))[0]).filter(Boolean); },
    of(p, ctx = {}) {
      if (!p) return ""; const t = ctx.t || RQ.taste.get(), r = ctx.room, ours = !!(r && r.group), gp = ctx.group;
      if (r && RQ.why.missing(r, p)) return `Saknas i ${ours ? "ert" : "ditt"} rum: ${KINDS[kindOf(p)]}`;
      if (gp && gp.n > 1) { const i = gp.hs.indexOf(p.handle), k = i < 0 ? 0 : gp.likes[i]; if (k === gp.n) return gp.n === 2 ? "Ni gillade båda den" : "Alla gillade den"; if (k > 0 && k >= gp.n / 2) return `${k} av ${gp.n} gillade den`; }
      if (r && r.style && p.rooms.includes(r.type) && p.styles.includes(r.style)) return `Passar ${roomWord(r.type, ours)}`;
      if (rejected(t, p.handle)) return ""; // you said no to it: nothing recommends it
      if (liked(t, p.handle)) return ctx.mine === false ? "" : t.seen[p.handle] > 0 ? "Du gillade den i Svep" : "Du har sparat den";
      // in a list each liked thing is named once (ctx.used), so the reasons say something new from card to card
      const free = (x) => !(ctx.used && ctx.used.has(x.handle)), L = likedOf(t);
      const q = L.find((x) => free(x) && likeness(p, x) === "kind") || L.find((x) => free(x) && likeness(p, x) === "tone");
      if (q) { if (ctx.used) ctx.used.add(q.handle); return likeness(p, q) === "kind" ? `Eftersom du gillade ${q.name}` : `Samma färgton som ${q.name}`; }
      const top = RQ.taste.top(t)[0]; if (top && p.styles.includes(top)) return `Passar din stil: ${RQ.STYLES[top].name}`;
      return "";
    },
    // for shop lists sorted for you: a fresh reason-giver per list, nothing without a taste yet
    shop: () => { const used = new Set(), t = RQ.taste.get(); return (p) => (t.n ? RQ.why.of(p, { t, used }) : ""); },
    // "För dig": what you have not seen yet first (best match first), then what you liked, what you said no to last
    forYou(list) { const t = RQ.taste.get(), sc = (p) => RQ.taste.score(p, t), grp = (p) => (rejected(t, p.handle) ? 2 : liked(t, p.handle) ? 1 : 0);
      return [...list].sort((a, b) => grp(a) - grp(b) || sc(b) - sc(a)); },
    rejected: (h) => rejected(RQ.taste.get(), h),
  };
  // more of the same kind: things for the same rooms that share a style, the same kind of thing or the same colour family
  RQ.moreLike = (h, n = 4) => {
    const p = RQ.byHandle(h); if (!p) return []; const t = RQ.taste.get();
    return RQ.PRODUCTS.filter((q) => q.handle !== h && shareRoom(p, q) && !rejected(t, q.handle)).map((q) => { const st = q.styles.filter((s) => p.styles.includes(s)), cat = kindOf(q) === kindOf(p), tone = sameTone(p, q);
      const why = cat && st.length ? "Samma sort och stil" : cat ? `Också ${KINDS[kindOf(q)]}` : st.length && tone ? "Samma stil och färgton" : st.length ? `Samma stil: ${RQ.STYLES[st[0]].name}` : "";
      return { p: q, why, st, cat, tone, from: h, s: st.length * 2 + (cat ? 4 : 0) + (tone ? 2 : 0) }; })
      .filter((x) => x.why && x.s >= 4).sort((a, b) => b.s - a.s).slice(0, n);
  };
  // more like several things at once (one way in under a list): each thing found says which of them it is like, and how
  RQ.moreLikeMany = (hs, n = 4) => {
    hs = hs.filter((h) => RQ.byHandle(h)); if (hs.length === 1) return RQ.moreLike(hs[0], n);
    const best = {}; hs.forEach((h) => RQ.moreLike(h, 40).forEach((x) => { if (hs.includes(x.p.handle)) return; const o = best[x.p.handle]; if (!o || x.s > o.s) best[x.p.handle] = x; }));
    const all = Object.values(best).sort((a, b) => b.s - a.s), named = new Set(), out = []; // spread the "like what" over the list first, then the best of the rest
    all.forEach((x) => { if (out.length < n && !named.has(x.from)) { named.add(x.from); out.push(x); } });
    all.forEach((x) => { if (out.length < n && !out.includes(x)) out.push(x); });
    return out.sort((a, b) => b.s - a.s).map((x) => { const nm = RQ.byHandle(x.from).name;
        return { ...x, why: x.cat && x.st.length ? `Samma sort och stil som ${nm}` : x.cat ? `Samma sort som ${nm}` : x.tone ? `Samma färgton som ${nm}` : `Samma stil som ${nm}` }; });
  };
  // one way in: a button under the list; the panel opens right under it
  RQ.moreBtn = (hs, label = "Mer som det här") => (hs.length ? `<p class="ml-way"><button type="button" class="btn ghost sm" data-more="${hs.join(",")}" aria-expanded="false">${esc(label)}</button></p>` : "");
  // the panel: a few things like it, with the reason on each, and a round of Svep from there
  document.addEventListener("click", (e) => {
    const sd = e.target.closest("[data-svep-seed]"); if (sd) { ss.set("rumiq-svep-seed", sd.dataset.svepSeed); ss.del(KEEP); if (RQ.currentRoute() === "svep") { e.preventDefault(); RQ.router(); scrollTo(0, 0); } return; }
    const x = e.target.closest("[data-ml-close]"); if (x) { const pn = x.closest(".ml"), b = pn && pn.previousElementSibling && $(`[data-more][aria-expanded="true"]`, pn.previousElementSibling); if (pn) pn.remove(); if (b) { b.setAttribute("aria-expanded", "false"); b.focus({ preventScroll: true }); } return; }
    const b = e.target.closest("[data-more]"); if (!b) return; e.preventDefault();
    const hs = b.dataset.more.split(",").filter((h) => RQ.byHandle(h)), host = b.closest(".ml-way, .sv-liked, .grid"); if (!hs.length || !host) return;
    const key = hs.join(","), old = host.nextElementSibling && host.nextElementSibling.matches(".ml") ? host.nextElementSibling : null, same = old && old.dataset.ml === key;
    $$("[data-more]", host).forEach((y) => y.setAttribute("aria-expanded", "false")); if (old) old.remove(); if (same) return;
    const list = RQ.moreLikeMany(hs), why = Object.fromEntries(list.map((x) => [x.p.handle, x.why])), id = "ml-" + hash(key).toString(36);
    const title = hs.length === 1 ? `Mer som ${RQ.byHandle(hs[0]).name}` : b.dataset.moreTitle || "Mer som det du gillade";
    const pn = document.createElement("section"); pn.className = "ml"; pn.dataset.ml = key; pn.setAttribute("aria-labelledby", id);
    pn.innerHTML = `<div class="ml-head"><h3 class="h3" id="${id}" tabindex="-1">${esc(title)}</h3><button class="iconbtn ml-x" type="button" data-ml-close aria-label="Stäng">${ICO.x}</button></div>
      ${list.length ? RQ.grid(list.map((x) => x.p), "ml-grid", false, (q) => why[q.handle]) : `<p class="small">Inget mer av samma slag just nu. Sortimentet växer.</p>`}
      <p class="ml-foot"><a class="tlink" href="#svep" data-svep-seed="${esc(key)}">${hs.length === 1 ? "Svep fler som den" : "Svep fler som dem"}</a></p>`;
    host.after(pn); b.setAttribute("aria-expanded", "true");
    if (RQ.markImages) RQ.markImages(pn); if (RQ.watch) RQ.watch(pn);
    $("h3", pn).focus({ preventScroll: true }); pn.scrollIntoView({ block: "nearest", behavior: reduced() ? "auto" : "smooth" });
    RQ.track && RQ.track("more_like", { item_id: key, n: hs.length });
  });

  /* ---------------------------------------------------------------- deck markup and engine */
  const deckHtml = (px, compact) => `<div class="sv-wrap${compact ? " compact" : ""}">
      <div class="sv-prog" aria-hidden="true"><i id="${px}Bar"></i></div>
      <p class="sv-meta"><span id="${px}Count"></span><span class="sv-chip" id="${px}Chip" hidden></span></p>
      <div class="sv-deck" id="${px}Deck" tabindex="0" role="group" aria-label="Kortet"${compact ? "" : ' aria-keyshortcuts="ArrowRight ArrowLeft ArrowUp Backspace"'}></div>
      <p class="sr" id="${px}Said" role="status"></p>
      <div class="sv-ctrl" id="${px}Ctrl">
        ${compact ? "" : `<button class="sv-b undo" type="button" id="${px}Undo" aria-label="Ångra senaste" title="Ångra senaste" disabled>${SV.undo}<span class="sv-bl" aria-hidden="true">Ångra</span></button>`}
        <button class="sv-b no" type="button" id="${px}No" aria-label="Nej tack" title="Nej tack">${ICO.x}${compact ? "" : `<span class="sv-bl" aria-hidden="true">Nej</span>`}</button>
        ${compact ? "" : `<button class="sv-b room" type="button" id="${px}Room" aria-label="Ställ in i Mitt rum" title="Ställ in i Mitt rum">${RQ.roomIco}<span class="sv-bl" aria-hidden="true">Mitt rum</span></button>`}
        <button class="sv-b bag" type="button" id="${px}Bag" aria-label="Köp, lägg i varukorgen" title="Köp, lägg i varukorgen">${SV.bag}${compact ? "" : `<span class="sv-bl" aria-hidden="true">Köp</span>`}</button>
        <button class="sv-b yes" type="button" id="${px}Yes" aria-label="Spara" title="Spara">${ICO.heart}${compact ? "" : `<span class="sv-bl" aria-hidden="true">Spara</span>`}</button>
      </div>
      ${compact ? "" : `<p class="small sv-keys">Piltangenter: höger sparar, vänster hoppar över, uppåt lägger i varukorgen. Backsteg ångrar.</p>`}
    </div>`;

  // cfg: px, ctx (for the counts), total(st, t), next(st, t, skip, n) -> cards, why(p, t), keys, hint, onFinish(st, deckEl), start
  function runDeck(root, cfg) {
    const el = (n) => $(`#${cfg.px}${n}`, root);
    const deckEl = el("Deck");
    const st0 = cfg.start || {};
    const st = { done: [...(st0.done || [])], answers: { ...(st0.answers || {}) }, saved: [...(st0.saved || [])], bagged: [...(st0.bagged || [])], forced: [...(st0.forced || [])], history: [], over: false, soonDone: !!st0.soonDone };
    let stack = [], busy = false, queue = [];
    const cards = () => $$(".sv-card", deckEl);
    const topCard = () => cards().pop();
    const paint = () => {
      const t = RQ.taste.get(), front = st.forced.map(resolve).filter(Boolean);
      const skip = new Set([...st.done, ...st.forced]);
      stack = [...front, ...cfg.next(st, t, skip, 3 - front.length)].slice(0, 3);
      const total = cfg.total(st, t);
      if (!stack.length || st.done.length >= total) return finish();
      deckEl.innerHTML = stack.map((it, k) => (it.soon ? svSoon(it.soon, k) : svCard(it, k, k || !cfg.why ? "" : cfg.why(it, t)))).reverse().join("");
      const c = el("Count"); if (c) c.textContent = `${st.done.length + 1} av ${total}`;
      const said = el("Said"), nx = stack[0]; if (said && said.dataset.msg != null) { said.textContent = `${said.dataset.msg} Nästa: ${nx.soon ? `Kommer snart? ${nx.soon.name}.` : `${nx.name}, ${kr(nx.price)}.`}`.trim(); delete said.dataset.msg; }
      const b = el("Bar"); if (b) b.style.width = `${(st.done.length / total) * 100}%`;
      const room = el("Room"), first = stack[0];
      if (room) { room.disabled = !!first.soon; if (first.soon) delete room.dataset.roomBtn; else { room.dataset.roomBtn = first.handle; room.setAttribute("aria-pressed", !!(RQ.room && RQ.room.inScene(first.handle))); } }
      const bag = el("Bag"); if (bag) bag.disabled = !!first.soon; // a "Kommer snart" card cannot be bought
      const u = el("Undo"); if (u) u.disabled = !st.history.length;
      const top = RQ.taste.top(t)[0], chip = el("Chip");
      if (chip && t.n >= 5 && top) { chip.hidden = false; chip.textContent = `Din stil växer fram: ${RQ.STYLES[top].name}`; }
      if (cfg.hint !== false && !t.n && !st.done.length && !reduced()) { const tc = topCard(); tc && tc.classList.add("hint"); }
    };
    const finish = () => {
      if (st.over) return; st.over = true;
      ["Ctrl", "Count", "Chip"].forEach((n) => { const x = el(n); if (x) x.hidden = true; });
      const pr = $(".sv-prog", deckEl.parentNode); if (pr) pr.hidden = true;
      const mt = $(".sv-meta", deckEl.parentNode); if (mt) mt.hidden = true;
      const k = $(".sv-keys", deckEl.parentNode); if (k) k.hidden = true;
      cfg.onFinish(st, deckEl);
    };
    const flash = (c, cls) => { const s = $(`.sv-stamp.${cls}`, c); if (s) s.style.opacity = 1; };
    const decide = (dir, c0) => {
      if (st.over) return;
      // a key or a tap while the last card is still flying out waits its turn instead of being dropped
      if (busy) { if (!c0 && queue.length < 3) queue.push(dir); return; }
      const c = c0 || topCard(); if (!c) return;
      if (dir === 2 && c.classList.contains("soon")) dir = 1;
      busy = true; const h = c.dataset.h, isSoon = h.startsWith("soon:");
      const rec = { h, dir, before: JSON.stringify(RQ.taste.get()), wish: false, bag: false, soon: isSoon ? JSON.stringify([ls.get("rumiq-soon", {}), ls.get("rumiq-votes", [])]) : null };
      if (isSoon) {
        const id = h.slice(5), s = ls.get("rumiq-soon", {}); s[id] = dir === -1 ? 0 : 1; ls.set("rumiq-soon", s);
        if (dir !== -1) { const v = ls.get("rumiq-votes", []); if (!v.includes(id) && v.length < MAXV) ls.set("rumiq-votes", [...v, id]); }
        st.soonDone = true;
      } else if (dir === 1) { if (!S.isWished(h)) { S.toggleWish(h); rec.wish = true; } RQ.taste.add(h, 1); st.saved.push(h); }
      else if (dir === 2) { S.addToCart(h + "::0", 1); rec.bag = true; RQ.taste.add(h, 1.5); st.bagged.push(h); RQ.fly && RQ.fly($(".sv-ims img.on", c)); }
      else RQ.taste.add(h, -0.5);
      st.answers[h] = dir === -1 ? 0 : dir;
      const said = el("Said"), nm = isSoon ? "" : (RQ.byHandle(h) || {}).name || ""; // read out by the next paint, with the next card
      if (said) said.dataset.msg = isSoon ? (dir === -1 ? "Nej tack." : "Tack, vi räknar din röst.") : dir === 1 ? `Sparad: ${nm}.` : dir === 2 ? `I varukorgen: ${nm}.` : `Hoppade över ${nm}.`;
      const choice = dir === 1 ? "save" : dir === 2 ? "cart" : "skip";
      RQ.track && RQ.track("swipe", { item_id: h, choice });
      stat(h, choice, cfg.ctx);
      if (navigator.vibrate) try { navigator.vibrate(8); } catch (e) {}
      st.history.push(rec); st.forced = st.forced.filter((x) => x !== h); st.done.push(h);
      cfg.onDecide && cfg.onDecide(st);
      const next = () => { busy = false; paint(); if (queue.length && !st.over) decide(queue.shift()); else queue = []; };
      if (reduced()) return next();
      flash(c, dir === 1 ? "yes" : dir === 2 ? "up" : "no");
      c.style.transition = "transform .26s cubic-bezier(.3,.6,.2,1), opacity .26s";
      c.style.transform = dir === 2 ? "translate(0,-120%) scale(.9)" : `translate(${dir * 130}%, -4%) rotate(${dir * 18}deg)`; c.style.opacity = 0;
      setTimeout(next, 210);
    };
    const undo = () => {
      queue = [];
      if (busy || st.over || !st.history.length) return;
      const r = st.history.pop(); vset("rumiq-taste", JSON.parse(r.before));
      if (r.soon) { const [s, v] = JSON.parse(r.soon); ls.set("rumiq-soon", s); ls.set("rumiq-votes", v); st.soonDone = false; }
      if (r.wish && S.isWished(r.h)) S.toggleWish(r.h);
      if (r.bag) { const line = S.cartLines().find((l) => l.id === r.h + "::0"); if (line) S.setQty(line.id, line.quantity - 1); }
      st.saved = st.saved.filter((x) => x !== r.h); st.bagged = st.bagged.filter((x) => x !== r.h); delete st.answers[r.h];
      st.done = st.done.filter((x) => x !== r.h); st.forced = [r.h, ...st.forced]; paint();
      const c = topCard(); if (c && !reduced()) c.animate([{ transform: "translate(0,-30px) scale(.96)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 320, easing: "ease-out" });
    };
    const flip = (c, d) => {
      const ims = $$(".sv-ims img", c), dots = $$(".sv-dots i", c), cur = +c.dataset.img, nx = Math.max(0, Math.min(ims.length - 1, cur + d));
      if (!ims.length || nx === cur) { c.animate([{ transform: `translateX(${d * 6}px)` }, { transform: "none" }], { duration: 180 }); return; }
      ims.forEach((im, k) => im.classList.toggle("on", k === nx)); dots.forEach((x, k) => x.classList.toggle("on", k === nx)); c.dataset.img = nx;
    };
    // drag: sideways = save or skip; upwards = cart, with a mouse or pen only (a finger moving up scrolls the page).
    // A tap on the edges flips the picture, in the middle it opens the product.
    let drag = null, lastX = 0, tapped = null;
    const down = (e) => { tapped = null; const c = e.target.closest(".sv-card"); if (!c || c !== topCard() || busy) return; c.classList.remove("hint"); drag = { c, x: e.clientX, y: e.clientY, t: performance.now(), dx: 0, dy: 0, touch: e.pointerType === "touch" }; c.setPointerCapture && c.setPointerCapture(e.pointerId); c.style.transition = "none"; };
    const back = (c) => { c.style.transition = "transform .45s var(--spring)"; c.style.transform = ""; $$(".sv-stamp", c).forEach((s) => (s.style.opacity = 0)); };
    const move = (e) => {
      if (!drag) return; drag.dx = e.clientX - drag.x; drag.dy = e.clientY - drag.y; const { c, dx, dy } = drag;
      const upish = !drag.touch && dy < 0 && Math.abs(dy) > Math.abs(dx);
      c.style.transform = `translate(${dx}px, ${upish ? dy : drag.touch ? 0 : dy * 0.25}px) rotate(${upish ? 0 : dx / 18}deg)`;
      const kx = Math.min(1, Math.abs(dx) / 110), ky = Math.min(1, -dy / 120);
      $(".sv-stamp.yes", c).style.opacity = !upish && dx > 0 ? kx : 0; $(".sv-stamp.no", c).style.opacity = !upish && dx < 0 ? kx : 0; $(".sv-stamp.up", c).style.opacity = upish ? ky : 0;
    };
    // the browser took the gesture (page scroll) or the pointer was lost: nothing is decided, the card goes back
    const cancel = () => { if (!drag) return; const c = drag.c; drag = null; back(c); };
    const up = () => {
      if (!drag) return; const { c, dx, dy, t, touch } = drag; drag = null;
      const ms = Math.max(1, performance.now() - t), vx = Math.abs(dx) / ms, vy = -dy / ms, w = c.offsetWidth, hgt = c.offsetHeight;
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) {
        c.style.transform = ""; if (c.classList.contains("soon")) return;
        const r = c.getBoundingClientRect(), x = (lastX - r.left) / r.width;
        if (x < 0.3) return flip(c, -1); if (x > 0.7) return flip(c, 1);
        tapped = c; return; // opened by the click that follows: opening here let that click close the sheet again on phones
      }
      const sideways = Math.abs(dx) >= Math.abs(dy);
      if (sideways && (Math.abs(dx) > w * 0.3 || (vx > 0.6 && Math.abs(dx) > 24))) return decide(dx > 0 ? 1 : -1, c);
      if (!touch && !sideways && dy < 0 && (-dy > hgt * 0.22 || vy > 0.6)) return decide(2, c);
      back(c);
    };
    const pdown = (e) => { lastX = e.clientX; down(e); }, pup = (e) => { lastX = e.clientX; up(); };
    const tap = (e) => { const c = tapped; tapped = null; if (c && c === topCard() && e.target.closest(".sv-card") === c && !RQ.sheet.isOpen()) RQ.sheet.open(c.dataset.h, { from: c }); };
    deckEl.addEventListener("pointerdown", pdown); deckEl.addEventListener("click", tap); addEventListener("pointermove", move); addEventListener("pointerup", pup); addEventListener("pointercancel", cancel);
    const on = (n, f) => { const b = el(n); if (b) b.addEventListener("click", f); };
    on("No", () => decide(-1)); on("Yes", () => decide(1)); on("Bag", () => decide(2)); on("Undo", undo);
    // the arrows work as soon as a round starts: in the deck, or when the focus is on no control at all (the page itself)
    let auto = false; // the deck has the focus only because the round started there
    deckEl.addEventListener("blur", () => { auto = false; });
    const key = (e) => {
      const free = e.target === document.body || e.target.id === "view";
      if (st.over || !e.target.closest || (!free && e.target.closest(".sv-wrap") !== deckEl.parentNode) || e.altKey || e.shiftKey || RQ.sheet.isOpen() || document.querySelector(".drawer.open, #search.open, #mnav.open, dialog[open], .sheet.open")) return;
      if (e.key === "ArrowUp" && (free || auto)) return; // on the page itself, or before you have used the deck, ↑ scrolls: it never buys anything by surprise
      if (/^Arrow(Right|Left)$/.test(e.key)) auto = false;
      if (free && /^Arrow(Right|Left)$|^Backspace$/.test(e.key)) deckEl.focus({ preventScroll: true });
      if (e.key === "ArrowRight") { e.preventDefault(); decide(1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); decide(-1); }
      if (e.key === "ArrowUp") { e.preventDefault(); decide(2); }
      if (e.key === "Backspace" || (e.key === "z" && (e.metaKey || e.ctrlKey))) { e.preventDefault(); undo(); }
    };
    if (cfg.keys) addEventListener("keydown", key);
    if (cfg.finished) finish(); else paint();
    // with a keyboard and a mouse the round starts in the deck, so the arrows work at once (not on touch screens, where it would only draw a ring)
    if (cfg.keys && !st.over && matchMedia("(hover:hover) and (pointer:fine)").matches && !RQ.sheet.isOpen()) { deckEl.focus({ preventScroll: true, focusVisible: false }); auto = true; }
    return () => { removeEventListener("pointermove", move); removeEventListener("pointerup", pup); removeEventListener("pointercancel", cancel); removeEventListener("keydown", key); };
  }

  /* ---------------------------------------------------------------- the style picture */
  const loadImg = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  RQ.styleImage = async (prof, liked, label = "Min stil") => {
    const W = 1080, H = 1920, cv = document.createElement("canvas"); cv.width = W; cv.height = H; const x = cv.getContext("2d");
    try { await document.fonts.ready; } catch (e) {}
    const F = (w, s) => `${w} ${s}px "Familjen Grotesk", system-ui, sans-serif`;
    x.fillStyle = "#EDEDEA"; x.fillRect(0, 0, W, H);
    x.fillStyle = "#22252A"; x.font = F(500, 52); x.textBaseline = "alphabetic"; x.fillText("RumIQ", 90, 160);
    x.fillStyle = "#696B68"; x.font = F(600, 34); x.fillText(tr(label).toUpperCase(), 90, 330);
    const st = prof.mix.filter((m) => m.pct >= 25).slice(0, 2);
    x.fillStyle = "#22252A"; x.font = F(600, 112);
    const lines = st.length === 2 ? [st[0].name, `${tr("och")} ${st[1].name}`] : st.length ? [st[0].name] : [tr("Vi lär oss fortfarande")];
    lines.forEach((l, i) => { let s = 112; while (x.measureText(tr(l)).width > W - 180 && s > 60) { s -= 4; x.font = F(600, s); } x.fillText(tr(l), 90, 470 + i * 124); x.font = F(600, 112); });
    let y = 470 + lines.length * 124 + 90;
    prof.mix.forEach((m) => {
      x.fillStyle = "#22252A"; x.font = F(500, 40); x.fillText(tr(m.name), 90, y + 14);
      x.fillStyle = "rgba(34,37,42,.12)"; x.beginPath(); x.roundRect(560, y - 8, 330, 22, 11); x.fill();
      x.fillStyle = "#2F4A3A"; x.beginPath(); x.roundRect(560, y - 8, Math.max(22, 330 * m.pct / 100), 22, 11); x.fill();
      x.fillStyle = "#22252A"; x.font = F(600, 40); x.textAlign = "right"; x.fillText(`${m.pct} %`, 990, y + 14); x.textAlign = "left";
      y += 86;
    });
    if (prof.tones.length) {
      y += 50; x.fillStyle = "#696B68"; x.font = F(600, 30); x.fillText(tr("Mina färger").toUpperCase(), 90, y); y += 40;
      prof.tones.slice(0, 5).forEach((t, i) => { const cx = 140 + i * 190; x.fillStyle = t.hex; x.beginPath(); x.arc(cx, y + 60, 56, 0, Math.PI * 2); x.fill(); x.strokeStyle = "rgba(34,37,42,.15)"; x.lineWidth = 2; x.stroke();
        x.fillStyle = "#22252A"; x.font = F(500, 30); x.textAlign = "center"; x.fillText(tr(t.name), cx, y + 160); x.textAlign = "left"; });
      y += 200;
    }
    const picks = liked.slice(0, 3);
    if (picks.length) {
      const sz = 280, gap = 30; y = Math.min(Math.max(y + 40, 1340), H - 210 - sz);
      const ims = await Promise.all(picks.map((p) => loadImg(RQ.cut(p))));
      picks.forEach((p, i) => {
        const px = 90 + i * (sz + gap); x.fillStyle = "#F7F7F4"; x.beginPath(); x.roundRect(px, y, sz, sz, 28); x.fill();
        const im = ims[i]; if (im) { const k = Math.min((sz - 50) / im.width, (sz - 50) / im.height), w = im.width * k, h = im.height * k; x.drawImage(im, px + (sz - w) / 2, y + (sz - h) / 2, w, h); }
      });
    }
    x.fillStyle = "#22252A"; x.font = F(500, 40); x.fillText(tr("Svep fram din egen stil på RumIQ"), 90, H - 130);
    x.fillStyle = "#696B68"; x.font = F(500, 32); x.fillText(tr("Se ditt hem innan du köper."), 90, H - 78);
    return new Promise((res) => cv.toBlob((b) => res(b), "image/png"));
  };
  // opts: prof (another profile, e.g. a group's), label ("Vår stil"), url (the link that goes with the picture)
  let styleBlob = null; // the picture is saved only when "Spara bilden" is pressed
  document.addEventListener("click", (e) => { if (!e.target.closest("[data-style-save]") || !styleBlob) return; const a = document.createElement("a"); a.href = URL.createObjectURL(styleBlob); a.download = "stil-rumiq.png"; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); RQ.track && RQ.track("style_share", { method: "download" }); });
  const shareStyle = async (st, liked, opts = {}) => {
    const prof = opts.prof || RQ.styleProfile(), url = opts.url || new URL("svep/", document.baseURI).href, label = opts.label || "Min stil";
    const txt = `${tr(label + " på RumIQ")}: ${st.map((s) => `${tr(s.name)} ${s.pct} %`).join(", ")}. ${tr("Se ditt hem innan du köper.")}`;
    let blob = null; try { blob = await RQ.styleImage(prof, liked, label); } catch (e) {}
    const file = blob && typeof File === "function" ? new File([blob], "min-stil-rumiq.png", { type: "image/png" }) : null;
    try {
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: tr(label + " på RumIQ"), text: `${txt} ${url}` }); RQ.track && RQ.track("style_share", { method: "file", label }); return; }
      // no picture sharing here: the link goes out as text (share sheet, else copied, else shown), the picture only when asked for
      styleBlob = blob;
      if (navigator.share) { try { await navigator.share({ title: tr(label + " på RumIQ"), text: txt, url }); RQ.track && RQ.track("style_share", { method: "link", label }); return; } catch (e) { if (e && e.name === "AbortError") return; } }
      let copied = false; try { await navigator.clipboard.writeText(`${txt} ${url}`); copied = true; } catch (e) {}
      const save = blob ? ` <button type="button" class="tlink" data-style-save>Spara bilden</button>` : "";
      RQ.toast(copied ? `Länken är kopierad. Klistra in den i ett meddelande.${save}` : `Kopiera länken: <span class="toast-link">${esc(url)}</span>${save}`, 9000);
      RQ.track && RQ.track("style_share", { method: copied ? "copy" : "shown", label });
    } catch (e) {}
  };

  /* ---------------------------------------------------------------- Svep tillsammans, 2 to 6 people: the link
     #svep-ihop-g<group>.<cards>.<person>_<person>…
       group: 4 characters, random. cards: each card's own 4-character number (made from its handle, as in shared lists),
       back to back. person: the answers as hex (one bit per card, 1 = likes), a 2-character id, then the name (optional).
     Each answer link carries everyone who has answered so far; the next person adds themselves and sends it on.
     Older two-person links (#svep-ihop-<0101>[_<0101>].<handle>.<handle>…[~<name>[_<name>]]) still open, as a group of
     one or two. Groups you are in are kept in this browser (rumiq-groups, synced with the account when it is live). */
  const cleanName = (s) => String(s || "").replace(/[^\p{L}\p{M} '-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 24);
  const MAXP = 6, GKEY = "rumiq-groups", NKEY = "rumiq-svep-name";
  const pid4 = (h) => { let x = 7; for (const c of h) x = (x * 31 + c.charCodeAt(0)) >>> 0; return (x % 1679616).toString(36).padStart(4, "0"); };
  const rid = (n) => { let s = ""; for (let i = 0; i < n; i++) s += "0123456789abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 36)]; return s; };
  const toHex = (b) => { let s = ""; for (let i = 0; i < b.length; i += 4) s += parseInt(b.slice(i, i + 4).padEnd(4, "0"), 2).toString(16); return s; };
  const fromHex = (x, n) => [...x].map((c) => parseInt(c, 16).toString(2).padStart(4, "0")).join("").slice(0, n);
  const undec = (s) => { try { return /%[0-9a-f]{2}/i.test(s) ? decodeURIComponent(s) : s; } catch (e) { return s; } };
  const vset = (k, v) => (RQ.vault ? RQ.vault.set(k, v) : ls.set(k, v));
  const G = (RQ.svepGroup = {
    all: () => (ls.get(GKEY, []) || []).filter((g) => g && /^[0-9a-z]{4}$/.test(g.id) && Array.isArray(g.hs) && Array.isArray(g.ppl)),
    get: (id) => G.all().find((g) => g.id === id) || null,
    save(g) { const l = G.all().filter((x) => x.id !== g.id); g.at = new Date().toISOString(); vset(GKEY, [g, ...l].slice(0, 12)); return g; },
    payload: (g) => "g" + g.id + "." + g.hs.map(pid4).join("") + (g.ppl.length ? "." + g.ppl.map((p) => toHex(p.b) + p.id + encodeURIComponent(cleanName(p.n))).join("_") : ""),
    url: (g) => new URL("svep-ihop/", document.baseURI).href + "#svep-ihop-" + G.payload(g),
    parse(raw) {
      raw = String(raw || ""); if (!raw) return null;
      if (raw[0] === "g") { // today's link
        const [head, cards = "", people = ""] = raw.split("."), id = head.slice(1);
        if (!/^[0-9a-z]{4}$/.test(id) || !cards || cards.length % 4 || cards.length > 120) return null;
        const ids = Object.fromEntries(RQ.PRODUCTS.map((p) => [pid4(p.handle), p.handle]));
        const hs = cards.match(/.{4}/g).map((x) => ids[x]); if (hs.some((h) => !h)) return null;
        const L = Math.ceil(hs.length / 4), ppl = [];
        for (const s of people ? people.split("_") : []) {
          const hx = s.slice(0, L), pid = s.slice(L, L + 2);
          if (!/^[0-9a-f]+$/.test(hx) || hx.length !== L || !/^[0-9a-z]{2}$/.test(pid)) return null;
          if (!ppl.some((p) => p.id === pid) && ppl.length < MAXP) ppl.push({ id: pid, b: fromHex(hx, hs.length), n: cleanName(undec(s.slice(L + 2))) });
        }
        return { id, hs, ppl };
      }
      // an older two-person link: the cards by handle, one or two answer strings, the names after ~
      const [core, names = ""] = raw.split("~"), parts = core.split("."), ans = (parts[0] || "").split("_"), hs = parts.slice(1);
      if (!hs.length || hs.length > 30 || ans.length > 2 || ans.some((a) => !/^[01]+$/.test(a) || a.length !== hs.length) || hs.some((h) => !RQ.byHandle(h))) return null;
      const nm = names.split("_").map((x) => cleanName(undec(x)));
      return { id: "l" + (hash(hs.join(".") + ans[0]) % 46656).toString(36).padStart(3, "0"), hs, ppl: ans.map((b, i) => ({ id: i ? "b0" : "a0", b, n: nm[i] || "" })), old: true };
    },
    // what this browser knows of the group joins what the link says (two links sent on from the same group meet here)
    open(link) {
      const st = G.get(link.id); if (!st || st.hs.join() !== link.hs.join()) return { ...link, me: null, room: null };
      const ppl = st.ppl.map((p) => ({ ...p }));
      link.ppl.forEach((p) => { const q = ppl.find((x) => x.id === p.id); if (!q) ppl.push(p); else if (!q.n && p.n) q.n = p.n; });
      return { ...st, ppl: ppl.slice(0, MAXP) };
    },
    // fresh cards for a new group: varied, a different set each time, for the whole home or one room
    fresh(scope) {
      const gid = rid(4), pool = RQ.PRODUCTS.filter((p) => inScope(p, scope)).sort((a, b) => hash(a.handle + gid) - hash(b.handle + gid)), out = [];
      while (out.length < Math.min(ROUND, pool.length)) { const recent = new Set(out.slice(-2).map((p) => p.cat)); const p = pool.find((x) => !out.includes(x) && !recent.has(x.cat)) || pool.find((x) => !out.includes(x)); out.push(p); }
      return { id: gid, hs: out.map((p) => p.handle), ppl: [], me: null, room: null, scope: scope || null };
    },
  });
  // what the group likes: all of them, most of them (at least half, three or more people), each one; how alike they are; their style
  G.calc = (g) => {
    const n = g.ppl.length, hs = g.hs, likes = hs.map((h, i) => g.ppl.filter((p) => p.b[i] === "1").length);
    const all = n ? hs.filter((h, i) => likes[i] === n) : [], most = n >= 3 ? hs.filter((h, i) => likes[i] < n && likes[i] >= n / 2) : [];
    const per = g.ppl.map((p) => hs.filter((h, i) => p.b[i] === "1"));
    let s = 0, k = 0; // the mean over every pair: liked by both out of liked by either
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const a = new Set(per[i]), u = new Set([...per[i], ...per[j]]), both = per[j].filter((h) => a.has(h)).length; s += u.size ? both / u.size : 0; k++; }
    const t = { styles: {}, cats: {}, tone: null, likes: 0, n: 0, seen: {} };
    per.flat().forEach((h) => { const p = RQ.byHandle(h); p.styles.forEach((x) => (t.styles[x] = (t.styles[x] || 0) + 1)); t.cats[p.cat] = (t.cats[p.cat] || 0) + 1; t.likes++; t.seen[h] = 1; });
    const sum = STYLE_KEYS.reduce((a, x) => a + (t.styles[x] || 0), 0);
    const mix = sum ? STYLE_KEYS.map((x) => ({ id: x, name: RQ.STYLES[x].name, pct: Math.round(((t.styles[x] || 0) / sum) * 100) })).sort((a, b) => b.pct - a.pct) : [];
    const tones = []; (all.length + most.length ? [...all, ...most] : per.flat()).forEach((h) => { const x = nearestTone(RQ.byHandle(h).tone[0]); if (!tones.some((y) => y.id === x.id)) tones.push(x); });
    const look = sum ? RQ.LOOKS.map((l) => ({ l, s: l.items.reduce((a, h) => a + RQ.taste.score(RQ.byHandle(h), t), 0) / l.items.length })).sort((a, b) => b.s - a.s)[0].l : null;
    return { n, likes, all, most, per, pct: k ? Math.round((s / k) * 100) : 0, mix, top: mix.filter((m) => m.pct >= 25).slice(0, 2), tones: tones.slice(0, 5), look };
  };
  // "skandinavisk och klassisk", "skandinavisk, mjuk och ombonad": the group style in running text
  const styleWords = (top) => { const ns = top.map((s) => s.name.charAt(0).toLocaleLowerCase("sv") + s.name.slice(1)); if (ns.length > 1 && / och /.test(ns[0])) ns.reverse(); return ns.length < 2 ? ns[0] || "" : / och /.test(ns[1]) ? `${ns[0]}, ${ns[1]}` : `${ns[0]} och ${ns[1]}`; };
  G.styleWords = styleWords;
  // the share sheet where there is one (phones), else the link is copied; the link also stays in a field to copy by hand
  const shareLink = async (url, title, text) => {
    try { if (navigator.share) { await navigator.share({ title, text, url }); return "shared"; } } catch (e) { if (e && e.name === "AbortError") return "aborted"; }
    try { await navigator.clipboard.writeText(url); RQ.toast("Länken är kopierad. Klistra in den i ett meddelande."); return "copied"; } catch (e) { return "shown"; }
  };
  RQ.shareLink = shareLink;
  // a small form: optional name, then share the link (or show it to copy by hand)
  const linkForm = (id, label, btn, name = "", ph = "Till exempel Anna", noName = false) => `<form class="sv-linkf" id="${id}" novalidate>${noName ? "" : `<label for="${id}N">${label} <span class="sv-opt">valfritt</span></label>`}
      <div class="field">${noName ? `<input type="hidden" name="n" value="">` : `<input id="${id}N" name="n" maxlength="24" autocomplete="given-name"${ph ? ` placeholder="${esc(ph)}"` : ""} value="${esc(name)}">`}<button class="btn sm" type="submit">${SV.link}<span>${btn}</span></button></div>
      <div class="sv-linkout-row" hidden><input class="sv-linkout" type="text" readonly aria-label="Länken"><button class="btn ghost sm" type="button" data-copy>Kopiera</button></div>
      <p class="small sv-linkmsg" role="status"></p></form>`;
  const bindLinkForm = (f, make, title, text, ev = "svep_group_share") => {
    if (!f) return;
    const row = $(".sv-linkout-row", f), out = $(".sv-linkout", f), msg = $(".sv-linkmsg", f);
    f.addEventListener("submit", async (e) => {
      e.preventDefault(); const nm = cleanName(f.n.value); if (nm) ls.set(NKEY, nm);
      const url = make(nm); out.value = url;
      const how = await shareLink(url, title, text);
      // the link stays in view to copy by hand when nothing could share it (and after a share, for a second message)
      row.hidden = false; if (how === "shown") { out.focus(); out.select && out.select(); }
      msg.textContent = how === "shared" ? "Skickat. Du kan skicka samma länk till fler." : how === "copied" ? "Länken är kopierad. Klistra in den i ett meddelande." : how === "aborted" ? "" : "Kopiera länken och skicka den i ett meddelande.";
      RQ.track && RQ.track(ev, { method: how });
    });
    f.addEventListener("click", async (e) => {
      if (!e.target.closest("[data-copy]")) return; let done = false;
      try { await navigator.clipboard.writeText(out.value); done = true; } catch (er) {}
      if (!done) { out.focus(); out.select && out.select(); try { done = document.execCommand("copy"); } catch (er) {} }
      msg.textContent = done ? "Länken är kopierad." : "Markera länken och kopiera den.";
    });
  };

  // put things in Mitt rum and go there; without a room the set-up sheet comes first, so nobody lands on an empty page
  // only what belongs in this kind of room goes in, four at a time, so the room does not fill with soap pumps and desk trays;
  // the rest stays i Mitt hem, and the toast says so
  RQ.placeFitting = (hs) => {
    const R = RQ.room, type = R.get() && R.get().type, MAX = 4;
    const fit = hs.filter((h) => { const p = RQ.byHandle(h); return p && (!type || p.rooms.includes(type)); });
    const placed = [], already = fit.filter((h) => R.inScene(h));
    fit.filter((h) => !already.includes(h)).forEach((h) => { if (placed.length < MAX && R.add(h, true)) placed.push(h); });
    const notFit = hs.length - fit.length, over = fit.length - already.length - placed.length, rest = notFit + over;
    const lead = placed.length ? `${placed.length} ${placed.length === 1 ? "sak står" : "saker står"} nu i rummet.` : already.length ? "De som passar står redan i rummet." : "Inget av det passar i det här rummet.";
    const tail = !rest ? "" : notFit === hs.length ? " Det ligger kvar i Mitt hem." : notFit && !over ? ` De andra ${notFit} passar bättre i andra rum och ligger kvar i Mitt hem.` : !notFit ? ` ${over} till ligger kvar i Mitt hem, så att rummet inte blir för fullt.` : ` De andra ${rest} ligger kvar i Mitt hem. Några passar bättre i andra rum.`;
    return { placed, already, rest, text: lead + tail };
  };
  // put things in Mitt rum and go there; without a room the set-up sheet comes first, so nobody lands on an empty page
  const toRoom = (hs) => {
    const R = RQ.room; if (!R) return;
    const put = () => { const r = RQ.placeFitting(hs); if (r.placed.length || r.already.length) { location.hash = "#mitt-rum"; setTimeout(() => RQ.toast(r.text), 400); } else RQ.toast(`${r.text} <a href="#mitt-hem">Se Mitt hem</a>`); };
    if (R.has()) put(); else R.openSetup(put, { add: hs, go: "#mitt-rum" });
  };

  /* ---------------------------------------------------------------- Svep (the full page) */
  const roundAnswers = (st) => { const hs = st.done.filter((h) => !h.startsWith("soon:") && RQ.byHandle(h)); return { hs, a: hs.map((h) => ((st.answers[h] || 0) > 0 ? 1 : 0)).join("") }; };
  // long Swedish compounds in narrow tiles break where the words meet ("Skrivbords-organisatör"), never mid-syllable
  RQ.shy = (s) => (window.RQ_LANG === "en" ? String(s) : String(s).replace(/(skrivbords|förvarings|terrakotta|uppladdnings|förråds|våffel|keramik|ull|jute|linne|bords)(?=[a-zåäö]{4,})/giu, "$1\u00AD"));
  // with more (true or a label) the list gets ONE way to more of the same kind under it (RQ.moreBtn, RQ.moreLikeMany)
  const tile = (p) => `<button type="button" data-sheet="${p.handle}"><img src="${RQ.cut(p)}" alt=""><span>${esc(RQ.shy(p.name))}</span><small>${kr(p.price)}</small></button>`;
  const savedTiles = (list, more) => `<div class="sv-liked">${list.map(tile).join("")}</div>${more ? RQ.moreBtn(list.map((p) => p.handle), typeof more === "string" ? more : "Mer som det här") : ""}`;
  // "Skandinavisk och klassisk", "Skandinavisk, mjuk och ombonad": one "och", a capital only first
  const styleTitle = (top) => {
    const ns = top.map((s) => s.name), i = ns.findIndex((n) => / och /.test(n));
    if (ns.length > 1 && i === 0) ns.reverse();
    const low = (n) => n.charAt(0).toLocaleLowerCase("sv") + n.slice(1);
    return ns.length < 2 ? `<span>${esc(ns[0])}</span>` : / och /.test(ns[1]) ? `<span>${esc(ns[0])}</span>, <span>${esc(low(ns[1]))}</span>` : `<span>${esc(ns[0])}</span> <span>och</span> <span>${esc(low(ns[1]))}</span>`;
  };
  const resultHtml = (st, scope) => {
    const t = RQ.taste.get(), prof = RQ.styleProfile(t), top = prof.mix.filter((m) => m.pct >= 25).slice(0, 2);
    const more = RQ.PRODUCTS.some((p) => inScope(p, scope) && !(p.handle in t.seen));
    const room = scope ? RQ.roomById(scope) : null;
    // nothing left to swipe and no round behind us: say so, instead of a result that appears from nowhere
    const allDone = !more ? `<p class="sv-alldone">${room ? `<span>Du har svept alla kort för</span> <span>${esc(room.name.toLowerCase())}</span>.` : "Du har svept alla kort i butiken."}${room ? ` <a href="#svep">Svep hela butiken</a>` : ""}</p>` : "";
    const saved = st.saved.map(RQ.byHandle).filter(Boolean), ra = roundAnswers(st);
    return { top, saved, html: `<div class="svep-result" tabindex="-1">
      <span class="eyebrow">Din stilprofil</span>
      <h2 class="h2">${top.length ? styleTitle(top) : "Vi lär oss fortfarande"}</h2>
      <p class="lead">${top.length ? esc(RQ.STYLES[top[0].id].text) : "Spara några saker du gillar, så kan butiken sortera efter dig."}</p>
      ${allDone}
      ${top.length && RQ.hem ? RQ.hem.slot({ type: scope || "vardagsrum", style: top[0].id, from: "svep", compact: true, prefer: saved.map((p) => p.handle) }) : ""}
      ${prof.mix.length ? `<div class="sp-grid"><div class="sp-mix" role="group" aria-label="Din stil i procent">${prof.mix.map((m) => `<div class="sp-row"><span>${esc(m.name)}</span><span class="sp-bar"><i style="width:${m.pct}%"></i></span><b>${m.pct} %</b></div>`).join("")}</div>
        ${prof.tones.length ? `<div class="sp-tones"><span class="eyebrow">Dina färger</span><div>${prof.tones.map((x) => `<span class="sp-tone"><i style="background:${x.hex}"></i>${esc(x.name)}</span>`).join("")}</div></div>` : ""}</div>` : ""}
      ${saved.length ? `<div class="sp-saved"><span class="eyebrow">Sparat i den här rundan · ${saved.length}</span>${savedTiles(saved, true)}
</div>` : ""}
      ${st.bagged.length ? `<p class="small">${st.bagged.length} ${st.bagged.length === 1 ? "vara ligger" : "varor ligger"} redan i varukorgen. <a href="#kassa">Till kassan</a></p>` : ""}
      ${prof.look || ra.hs.length >= 3 ? `<div class="sp-next">` : ""}${prof.look ? `<a class="sp-look" href="#look-${prof.look.id}"><span class="sp-look-ims">${prof.look.items.slice(0, 4).map((h) => `<img src="${RQ.cut(RQ.byHandle(h))}" alt="">`).join("")}</span><span><span class="eyebrow">En look för dig</span><b>${esc(prof.look.name)}</b><small>${esc(prof.look.lead)}</small></span></a>` : ""}
      ${ra.hs.length >= 3 ? `<div class="sp-two"><span class="sp-two-ic" aria-hidden="true">${SV.two}</span><div class="sp-two-tx"><b>Inreder ni tillsammans?</b><p>Skicka samma kort till en eller flera. När de har svept ser ni vad ni gillar gemensamt.</p>
        <button class="btn ghost sm" type="button" id="svTwoOpen" aria-expanded="false" aria-controls="svTwo">${SV.link}<span>Skicka korten</span></button>
        ${linkForm("svTwo", "Ditt namn", "Skicka korten", ls.get(NKEY, ""), "").replace("<form ", "<form hidden ")}</div></div>` : ""}${prof.look || ra.hs.length >= 3 ? "</div>" : ""}
      <div class="ctrl-row sp-main" style="margin-top:.6rem;justify-content:center">${more ? `<button class="btn" type="button" id="svMore">Svep tio till</button>` : `<a class="btn" href="#for-dig">Butiken för dig</a>`}</div>
      <details class="sp-more"><summary>Fler val</summary><div class="sp-more-in">
        ${saved.length ? `<button class="tlink" type="button" id="svAll">Lägg de sparade i varukorgen · ${kr(saved.reduce((s, p) => s + p.price, 0))}</button><button class="tlink" type="button" id="svRoomAll">Se de sparade i ditt rum</button>` : ""}
        ${more ? `<a class="tlink" href="#for-dig">Butiken för dig</a>` : ""}${top.length ? `<button class="tlink" type="button" id="svShare">Dela min stil</button>` : ""}<button class="tlink" type="button" id="svAgain">Börja om från början</button></div></details>
      <p class="small" id="svAgainNote" role="status"></p></div>` }; // few actions: two buttons, two quiet links
  };
  const scopeNav = (scope) => `<nav class="sv-scope" aria-label="Vad vill du svepa?"><a class="chip" href="#svep"${scope ? "" : ' aria-current="true"'}>Hela butiken</a>${RQ.ROOMS.map((r) => `<a class="chip" href="#svep-rum-${r.id}"${scope === r.id ? ' aria-current="true"' : ""}>${esc(r.name)}</a>`).join("")}</nav>`;
  // keys where there is a keyboard and a mouse; on touch screens the same rows show the gesture and the button's own icon
  const legend = `<ul class="sv-legend">
      <li><kbd aria-hidden="true">→</kbd><i class="sv-ti" aria-hidden="true">${ICO.heart}</i><div><b>Spara</b><span><em class="sv-tc">Svep åt höger. </em>Hamnar i Mitt hem och lär oss din stil.</span></div></li>
      <li><kbd aria-hidden="true">←</kbd><i class="sv-ti" aria-hidden="true">${ICO.x}</i><div><b>Hoppa över</b><span><em class="sv-tc">Svep åt vänster. </em>Du får se mindre av sådant framöver.</span></div></li>
      <li><kbd aria-hidden="true">↑</kbd><i class="sv-ti" aria-hidden="true">${SV.bag}</i><div><b>Lägg i varukorgen</b><span><em class="sv-tc">Svep uppåt. </em>Direkt, utan att lämna svepet. Väskan under kortet gör samma sak.</span></div></li>
      <li><kbd aria-hidden="true">⌫</kbd><i class="sv-ti" aria-hidden="true">${SV.undo}</i><div><b>Ångra</b><span>Ändrade du dig? Backa ett steg.</span></div></li>
      <li class="sv-tip">Pilarna fungerar direkt, så länge du inte har markerat en annan knapp.</li>
    </ul>`;
  // a room with fewer cards left than a full round: how many there are (0 = a normal round of ten)
  const roomLeft = (scope) => { if (!scope) return 0; const t = RQ.taste.get(), n = RQ.PRODUCTS.filter((p) => inScope(p, scope) && !(p.handle in t.seen)).length; return n && n < ROUND ? n : 0; };
  const KEEP = "rumiq-svep-result"; // the finished round, kept for this tab so that Back and reload show the profile again
  V.svep = (scope) => {
    const room = scope ? RQ.roomById(scope) : null; if (scope && !room) return V.notfound();
    return {
      title: room ? `Svep · ${room.name} · RumIQ` : "Svep · RumIQ",
      html: `<section class="wrap svep" aria-label="Svep">
        <div class="sv-head">${RQ.crumbs(room ? [["Hem", "hem"], ["Upptäck", "upptack"], ["Svep", "svep"], [room.name]] : [["Hem", "hem"], ["Upptäck", "upptack"], ["Svep"]])}<h1 class="h1">Svep fram din stil.</h1><p class="lead">Höger sparar, vänster hoppar över. Tryck på kortet för att läsa mer.</p>
          ${scopeNav(scope)}
          ${legend}
          <p class="small sv-after">Tryck på bildens kanter för fler bilder, eller mitt på bilden för att läsa mer. ${roomLeft(scope) ? `<span>${roomLeft(scope)}</span> <span>kort för</span> <span>${esc(room.name.toLowerCase())}</span>, <span>sedan får du din stilprofil.</span>` : "Efter tio kort får du din stilprofil."}</p>
          <a class="sv-two-link" href="#svep-ihop">${SV.two}<span>Inreder ni tillsammans? <b>Svep tillsammans</b></span></a></div>
        ${deckHtml("sv", false)}</section>`,
      mount(root) {
        const kept = ss.get(KEEP, null), keep = kept && kept.scope === (scope || "") && Array.isArray(kept.done) && kept.done.length ? kept : null;
        // "Svep fler som den" (Mer som det här): the round opens with things like it that you have not swiped yet
        const seedH = !keep && !scope && ss.get("rumiq-svep-seed", ""), t0 = RQ.taste.get(); ss.del("rumiq-svep-seed");
        const seedHs = String(seedH || "").split(",").filter((h) => RQ.byHandle(h));
        const seed = seedHs.length ? RQ.moreLikeMany(seedHs, 8).filter((x) => !(x.p.handle in t0.seen)).slice(0, 4) : [], seedWhy = Object.fromEntries(seed.map((x) => [x.p.handle, `Mer som ${RQ.byHandle(x.from).name}`]));
        const carry = !keep && !scope && (seed.length ? { forced: seed.map((x) => x.p.handle) } : ss.get("rumiq-svep-carry", null)); // dropped once this page takes the round further
        const unseen = (t, st) => RQ.PRODUCTS.filter((p) => inScope(p, scope) && !(p.handle in t.seen)).length;
        // "Kommer snart" comes as card six, so it only counts in a round that gets that far
        const soonOpen = (st, t) => !scope && !st.soonDone && st.done.length <= 5 && st.done.length + unseen(t, st) >= 5 && !!nextSoon();
        const cur = $(".sv-scope [aria-current]", root), nav = cur && cur.parentNode; if (nav && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = cur.offsetLeft - (nav.clientWidth - cur.offsetWidth) / 2;
        return runDeck(root, {
          px: "sv", ctx: scope ? "svep:" + scope : "svep", keys: true, start: keep || carry, finished: !!keep, onDecide: () => ss.del("rumiq-svep-carry"),
          total: (st, t) => Math.min(ROUND, st.done.length + unseen(t, st) + (soonOpen(st, t) ? 1 : 0)),
          next: (st, t, skip, n) => {
            const out = upcoming(t, skip, n, st.done.length, scope);
            if (n === 3 && st.done.length === 5 && soonOpen(st, t)) { out.unshift(nextSoon()); out.length = Math.min(out.length, 3); }
            return out;
          },
          // a true reason on the top card: what it is like that you liked, or your style; none on the cards picked for variety
          why: (p, t) => seedWhy[p.handle] || (t.likes >= 2 && !EXPLORED.has(p.handle) ? RQ.why.of(p, { t, mine: false }) : ""),
          onFinish: (st, deckEl) => {
            const r = resultHtml(st, scope); deckEl.outerHTML = r.html;
            const res = $(".svep-result", root); res.focus({ preventScroll: true });
            { const see = $("[data-hem-see]", res); if (see && see.getBoundingClientRect().bottom > innerHeight - 90) see.scrollIntoView({ block: "nearest" }); } // a short phone: the room proposal's first button above the dock (D4)
            const tl = $(".sv-two-link", root); if (tl) tl.hidden = true; // the result asks "Inreder ni tillsammans?" itself, once
            const fresh = !(keep && keep.done.length === st.done.length);
            if (st.done.length) ss.set(KEEP, { scope: scope || "", done: st.done, answers: st.answers, saved: st.saved, bagged: st.bagged, soonDone: st.soonDone });
            if (fresh && r.top.length) RQ.styleLog.add(RQ.styleProfile(), scope);
            if (fresh) RQ.track && RQ.track("swipe_round", { saved: r.saved.length, bagged: st.bagged.length, style: r.top.length ? r.top[0].id : "", scope: scope || "" });
            // a new round is drawn in place: no detour through another page, so Back still leads where you came from
            const again = () => { ss.del(KEEP); RQ.router(); scrollTo(0, 0); };
            let armed = false;
            $("#svAgain", root).addEventListener("click", (e) => {
              if (!armed) { armed = true; e.currentTarget.textContent = "Tryck igen för att börja om"; $("#svAgainNote", root).textContent = "Din stilprofil nollställs. Det du har sparat ligger kvar."; return; }
              RQ.taste.reset(); try { localStorage.removeItem("rumiq-style"); } catch (er) {} again();
            });
            const m = $("#svMore", root); m && m.addEventListener("click", again);
            const all = $("#svAll", root); all && all.addEventListener("click", () => RQ.addMany(r.saved.map((p) => p.handle), all, "Din runda")); RQ.addAllBtn(all, () => r.saved.map((p) => p.handle), () => `Lägg de sparade i varukorgen · ${kr(r.saved.reduce((s, p) => s + p.price, 0))}`);
            const ra = $("#svRoomAll", root); ra && ra.addEventListener("click", () => toRoom(r.saved.map((p) => p.handle)));
            const sh = $("#svShare", root); sh && sh.addEventListener("click", () => shareStyle(r.top, (r.saved.length ? r.saved : RQ.styleProfile().liked.map(RQ.byHandle)).filter(Boolean)));
            const ans = roundAnswers(st);
            // the form for a name opens only for those who want to send the cards, so the result page stays short
            const to = $("#svTwoOpen", root); to && to.addEventListener("click", () => { const f = $("#svTwo", root); f.hidden = false; to.hidden = true; to.setAttribute("aria-expanded", "true"); $("#svTwoN", root).focus(); });
            // the round's cards and your answers start a group: you are its first person, the link carries you
            let mine = null;
            bindLinkForm($("#svTwo", root), (n) => {
              if (!mine) { const me = { id: rid(2), b: ans.a, n }; mine = { id: rid(4), hs: ans.hs, ppl: [me], me: me.id, room: null, scope: scope || null }; RQ.track && RQ.track("svep_group_created", { cards: ans.hs.length, from: "svep" }); }
              else mine.ppl[0].n = n;
              G.save(mine); return G.url(mine);
            }, tr("Svep tillsammans på RumIQ"), tr("Svep tio kort, så ser vi vad vi gillar gemensamt. Se ditt hem innan du köper."));
          },
        });
      },
    };
  };

  /* ---------------------------------------------------------------- Svep tillsammans (2 to 6 people) */
  const isMe = (g, i) => !!g.me && g.ppl[i].id === g.me;
  const who = (g, i) => (isMe(g, i) ? "Du" : g.ppl[i].n || `Person ${i + 1}`);
  const ME_ICO = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="9" r="3.4"/><path d="M5.5 19.5a6.5 6.5 0 0 1 13 0"/></svg>';
  // the round mark: the first letter of the name; for you a small figure (with "Du" beside it, never "Du" twice)
  const initial = (g, i) => (isMe(g, i) ? (g.ppl[i].n ? esc(g.ppl[i].n.charAt(0).toLocaleUpperCase("sv")) : ME_ICO) : esc((g.ppl[i].n || "").charAt(0).toLocaleUpperCase("sv") || String(i + 1)));
  // who has swiped: a calm round mark and the name for each, in the order they answered (and an open place for you)
  const pplRow = (g, you) => `<ul class="gr-ppl" aria-label="De som har svept">${g.ppl.map((p, i) => `<li><span class="gr-av${isMe(g, i) ? " me" : ""}" data-c="${i % 6}" aria-hidden="true">${initial(g, i)}</span><b class="sv-name">${esc(who(g, i))}</b></li>`).join("")}${you ? `<li class="you"><span class="gr-av" aria-hidden="true">+</span><span>Du</span></li>` : ""}</ul>`;
  // "Anna", "Anna och Erik", "Anna, Erik och Sara": names in running text, each in its own element (the English layer keeps them)
  const namesHtml = (l) => l.map((x) => `<b class="sv-name">${esc(x)}</b>`).reduce((a, x, i, all) => (i === 0 ? x : i === all.length - 1 ? `${a} <span>och</span> ${x}` : `${a}, ${x}`), "");
  const others = (g) => g.ppl.filter((p) => p.id !== g.me);
  const nSaker = (k) => `${k} ${k === 1 ? "sak" : "saker"}`;
  const OUR = { hall: "Vår hall", uteliv: "Vår uteplats" };
  const ourName = (t) => OUR[t] || `Vårt ${(RQ.roomById(t) || { name: "rum" }).name.toLowerCase()}`;
  // the room a group result becomes: the kind of room most of what you all liked is made for, those things, the group style
  G.makeRoom = (g, c = G.calc(g)) => {
    const H = RQ.hem; if (!H) return null;
    const want = [...c.all, ...c.most], pool = want.length ? want : [...new Set(c.per.flat())];
    const types = ["vardagsrum", "sovrum", "kok", "hall", "badrum", "hemmakontor", "uteliv"];
    const fit = (t) => pool.reduce((s, h) => s + (RQ.byHandle(h).rooms.includes(t) ? (c.all.includes(h) ? 2 : 1) : 0), 0);
    const type = types.reduce((b, t) => (fit(t) > fit(b) ? t : b), "vardagsrum"), style = c.top[0] ? c.top[0].id : null;
    let items = pool.filter((h) => RQ.byHandle(h).rooms.includes(type)).slice(0, 8).map((h) => ({ h, v: 0 }));
    if (!items.length) items = H.propose({ type, style }).items;
    const r = H.create({ label: ourName(type), type, style, items });
    H.patch(r.id, { group: { id: g.id, link: G.payload(g), names: g.ppl.map((p, i) => (isMe(g, i) ? "" : p.n || "")).filter(Boolean), people: g.ppl.length, words: styleWords(c.top), liked: c.all, most: c.most } });
    g.room = r.id; G.save(g);
    RQ.track && RQ.track("svep_group_room", { people: g.ppl.length, items: items.length, type });
    return H.room(r.id);
  };
  const roomPanel = (g) => {
    const H = RQ.hem, r = H && g.room && H.room(g.room); if (!r) return "";
    const its = H.items(r), gr = r.group || {}, w = gr.words || "";
    return `<div class="gr-room" data-gr-r="${esc(r.id)}"><span class="eyebrow">I Mitt hem</span><h3 class="h3" tabindex="-1">${esc(H.name(r))}</h3>
        ${w ? `<p class="small">${esc(w.charAt(0).toLocaleUpperCase("sv") + w.slice(1))}, er gemensamma stil.</p>` : ""}
        <span class="gr-room-ims" aria-hidden="true">${its.slice(0, 5).map((it) => `<img src="${RQ.cut(RQ.byHandle(it.h))}" alt="">`).join("")}</span>
        <div class="ai-row"><button class="btn" type="button" data-gr-see>${RQ.roomIco}<span>Se det i ditt rum</span></button><button class="btn ghost" type="button" data-gr-buy>Köp allt · ${kr(H.money(r).total)}</button></div>
        <div class="ai-row small-row"><button class="tlink" type="button" data-gr-ask>Vad tycker du?</button><a class="tlink" href="#mitt-hem" data-hem-open="${esc(r.id)}">Öppna i Mitt hem</a></div></div>`;
  };
  const groupResult = (g) => {
    const c = G.calc(g), n = c.n, P = (l) => l.map(RQ.byHandle).filter(Boolean), sum = (l) => P(l).reduce((s, p) => s + p.price, 0);
    const meI = g.ppl.findIndex((p) => p.id === g.me), alone = n === 1 && meI === 0, full = n >= MAXP;
    const keep = c.all.length ? c.all : c.most, ot = others(g), named = ot.filter((p) => p.n);
    // the one list shown open (what you all, or most of you, like), with one way to more like it; the rest folds away
    const block = (label, list, cls = "", more = false) => (list.length ? `<div class="sp-saved ${cls}"><span class="eyebrow">${label} · ${list.length}</span>${savedTiles(P(list), more ? "Mer som det här" : false)}</div>` : "");
    const fold = (cls, summary, body) => `<details class="gr-fold ${cls}"><summary>${summary}</summary><div class="gr-fold-in">${body}</div></details>`;
    const acts = !alone && c.mix.length ? `<div class="gr-acts">${g.room && RQ.hem && RQ.hem.room(g.room) ? roomPanel(g) : `<div class="ctrl-row sp-acts"><button class="btn" type="button" data-gr-room>${RQ.roomIco}<span>Gör ett rum av det</span></button>${keep.length ? `<button class="btn ghost" type="button" data-gr-cart>Lägg i varukorgen · ${kr(sum(keep))}</button>` : ""}</div><p class="small gr-note">Rummet hamnar i Mitt hem, med er stil och det ni gillar.</p>`}</div>` : "";
    const title = alone ? "Dina svar är klara." : c.all.length ? (n === 2 ? `Ni gillar båda ${nSaker(c.all.length)}` : `Ni gillar alla ${nSaker(c.all.length)}`) : c.most.length ? `De flesta av er gillar ${nSaker(c.most.length)}` : "Ni gillade olika saker den här gången";
    // the result goes back to the others first: right under the meter, named ("Skicka tillbaka till Anna"), for a full group too
    const sendT = alone ? "Skicka korten" : full ? "Skicka resultatet till gruppen" : n === 2 ? (named.length ? `Skicka tillbaka till <b class="sv-name">${esc(named[0].n)}</b>` : "Skicka tillbaka") : "Skicka till gruppen";
    const sendP = alone ? "Länken har dina svar. De du skickar den till sveper samma kort, och sen ser ni vad ni gillar gemensamt."
      : full ? "Alla sex har svept. Länken visar resultatet för alla."
      : n === 2 ? `${named.length ? `<span>Då ser</span> <b class="sv-name">${esc(named[0].n)}</b> <span>samma resultat.</span>` : "<span>Då ser ni samma resultat.</span>"} <span>Fler kan också svepa samma kort, upp till sex.</span>`
      : "Då ser alla samma resultat. Fler kan svepa samma kort, upp till sex.";
    const sendB = alone ? "Skicka korten" : full ? "Skicka resultatet" : n === 2 ? "Skicka tillbaka" : "Skicka till gruppen";
    const send = `<div class="sp-two gr-send"><span class="sp-two-ic" aria-hidden="true">${SV.two}</span><div class="sp-two-tx"><b>${sendT}</b><p>${sendP}</p>
        ${meI >= 0 ? linkForm("grSend", "Ditt namn", sendB, g.ppl[meI].n || ls.get(NKEY, ""), "") : full ? linkForm("grSend", "", sendB, "", "", true) : `<button class="btn sm" type="button" data-gr-join>${SV.two}<span>Svep korten du också</span></button>`}</div></div>`;
    const notMe = g.claimed && meI >= 0 && g.ppl[meI].n ? `<p class="gr-notme"><button class="tlink" type="button" data-gr-notme><span>Inte</span> <b class="sv-name">${esc(g.ppl[meI].n)}</b><span>? Svep själv</span></button></p>` : "";
    const style = !alone && c.mix.length ? `<div class="gr-style"><span class="eyebrow">Er gemensamma stil</span><p class="gr-style-t">${c.top.length ? styleTitle(c.top) : esc(c.mix[0].name)}</p>
        ${c.tones.length ? `<div class="sp-tones"><span class="eyebrow">Era färger</span><div>${c.tones.map((x) => `<span class="sp-tone"><i style="background:${x.hex}"></i>${esc(x.name)}</span>`).join("")}</div></div>` : ""}
        <details class="gr-fold gr-mix"${matchMedia("(min-width:1100px)").matches ? " open" : ""}><summary>Så fördelar sig er stil</summary><div class="gr-fold-in"><div class="sp-mix" role="group" aria-label="Er stil i procent">${c.mix.map((m) => `<div class="sp-row"><span>${esc(m.name)}</span><span class="sp-bar"><i style="width:${m.pct}%"></i></span><b>${m.pct} %</b></div>`).join("")}</div></div></details>
        ${c.look ? `<a class="sp-look" href="#look-${c.look.id}"><span class="sp-look-ims">${c.look.items.slice(0, 4).map((h) => `<img src="${RQ.cut(RQ.byHandle(h))}" alt="">`).join("")}</span><span><span class="eyebrow">En look för er</span><b>${esc(c.look.name)}</b><small>${esc(c.look.lead)}</small></span></a>` : ""}</div>` : "";
    const each = n < 2 ? "" : fold("gr-each", "Vad var och en gillade", n === 2
      ? [0, 1].map((i) => { const only = c.per[i].filter((h) => !c.all.includes(h)); return `<div class="sp-saved"><span class="eyebrow">${isMe(g, i) ? "Bara du" : `Bara <b class="sv-name">${esc(who(g, i))}</b>`} · ${only.length}</span>${only.length ? savedTiles(P(only), false) : `<p class="small">Inget mer än det ni båda gillar.</p>`}</div>`; }).join("")
      : g.ppl.map((p, i) => `<div class="sp-saved"><span class="eyebrow"><b class="sv-name">${esc(who(g, i))}</b> · ${c.per[i].length}</span>${c.per[i].length ? savedTiles(P(c.per[i]), false) : `<p class="small">Inget den här gången.</p>`}</div>`).join(""));
    const first = alone ? "" : c.all.length ? block(n === 2 ? "Det ni båda gillar" : "Det ni alla gillar", c.all, "", true) : block("Det de flesta gillar", c.most, "", true);
    const most = !alone && c.all.length && c.most.length ? fold("gr-most", `Det de flesta gillar · ${c.most.length}`, savedTiles(P(c.most), false)) : "";
    const differ = !alone && !c.all.length && !c.most.length ? `<p class="lead">Det är också bra att veta. Prova en runda för ett rum ni ska inreda, så blir det lättare att mötas.</p>` : "";
    const again = `<div class="ctrl-row gr-again"><a class="btn ghost" href="#svep">Svep en egen runda</a><a class="btn ghost" href="#svep-ihop">Starta en ny grupp</a></div>`;
    // phone: meter, send back, Gör ett rum, what you agree on, then the rest. Computer: the same on the left; style and details on the right
    return { c, html: `<div class="svep-result two group${alone ? " alone" : ""}" tabindex="-1">
      <div class="gr-main">
        ${alone ? "" : `<span class="eyebrow">Svep tillsammans · ${n} personer</span>`}
        <h2 class="h2">${title}</h2>
        ${alone ? `<p class="lead">Skicka korten till dem du inreder med. När de har svept ser ni vad ni gillar gemensamt.</p>` : `${pplRow(g, false)}${notMe}
        <div class="two-meter" role="group" aria-label="Hur lika ni tycker"><span class="sp-bar"><i style="width:${c.pct}%"></i></span><span class="two-pct">Ni tycker ${c.pct} % lika</span></div>`}
        ${send}${differ}${acts}${first}
      </div>
      <div class="gr-side">
        ${alone ? block("Det du gillade", c.per[0], "", true) : `${style}${most}${each}`}
        ${again}
        ${!alone && c.mix.length ? `<p class="sp-links"><button class="tlink" type="button" data-gr-style>Dela er stil</button></p>` : ""}
      </div></div>` };
  };
  // everything a group result does, on its own root (the result page, or the deck page once you are done)
  const bindGroup = (root, g) => {
    const H = RQ.hem, room = () => H && g.room && H.room(g.room), c = G.calc(g), keep = c.all.length ? c.all : c.most;
    bindLinkForm($("#grSend", root), (nm) => { const me = g.ppl.find((p) => p.id === g.me); if (me) me.n = nm; G.save(g); try { history.replaceState(history.state, "", G.url(g)); } catch (e) {} return G.url(g); },
      tr("Svep tillsammans på RumIQ"), g.ppl.length >= MAXP ? tr("Här är vad vi alla gillar. Se ditt hem innan du köper.") : g.ppl.length > 1 ? tr("Här är vad vi gillar. Svep du också, om du inte har gjort det. Se ditt hem innan du köper.") : tr("Svep tio kort, så ser vi vad vi gillar gemensamt. Se ditt hem innan du köper."));
    const res = $(".svep-result.group", root); // this result only: a page drawn again never answers with an older group
    root.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b || !res || b.closest(".svep-result.group") !== res) return;
      if (b.matches("[data-gr-room]")) { const r = G.makeRoom(g, c); if (!r) return; const box = b.closest(".gr-acts"); box.innerHTML = roomPanel(g); $("h3", box).focus({ preventScroll: true }); box.scrollIntoView({ block: "nearest", behavior: reduced() ? "auto" : "smooth" }); return; }
      if (b.matches("[data-gr-cart]")) { RQ.addMany(keep, b, "Det ni gillar"); return; }
      const r = room();
      if (b.matches("[data-gr-see]") && r) { H.openInRoom({ room: r.type, items: H.items(r), style: r.style, budget: r.budget, project: r.id }); return; }
      if (b.matches("[data-gr-buy]") && r) { RQ.addMany(H.items(r).map((it) => it.h + "::" + (it.v || 0)), b, H.name(r)); return; }
      if (b.matches("[data-gr-ask]") && r) { H.askLink(r, b); return; }
      if (b.matches("[data-gr-join]")) { ss.set("rumiq-svep-join", g.id); RQ.router(); scrollTo(0, 0); return; }
      // tapped the wrong name: this browser is nobody in the group again, and swipes the cards itself
      if (b.matches("[data-gr-notme]")) { const st = G.get(g.id); if (st) { st.me = null; st.claimed = false; G.save(st); } ss.set("rumiq-svep-join", g.id); RQ.track && RQ.track("svep_group_notme", {}); RQ.router(); scrollTo(0, 0); return; }
      if (b.matches("[data-gr-style]")) { shareStyle(c.top, [...c.all, ...c.most, ...c.per.flat()].filter((h, i, a) => a.indexOf(h) === i).map(RQ.byHandle), { prof: { mix: c.mix, tones: c.tones }, label: "Vår stil", url: G.url(g) }); }
    });
  };
  // where the answers are kept, as the sync setting says (RQ.vault): never "we keep nothing" while the account keeps them
  const privacy = () => (RQ.vault && RQ.vault.where() === "account" ? "Svaren finns i länken ni skickar till varandra. Grupper du är med i sparas också i ditt konto." : "Svaren finns i länken ni skickar till varandra. Din grupp sparas bara i den här webbläsaren.");
  const crumbsTwo = () => RQ.crumbs([["Hem", "hem"], ["Upptäck", "upptack"], ["Svep", "svep"], ["Tillsammans"]]);
  const introView = (bad) => ({
    title: "Svep tillsammans · RumIQ",
    html: `<section class="wrap svep two-intro"><div class="sv-head">${crumbsTwo()}<h1 class="h1">Svep tillsammans.</h1><p class="lead">Inreder ni ihop? Svep samma kort var för sig, två till sex personer, och se vad ni alla gillar. Utan att behöva bråka om gardinerna.</p>
        ${bad ? `<p class="note">Länken verkar vara ofullständig. Be om en ny länk, eller starta en egen grupp.</p>` : ""}
        <fieldset class="gr-scope"><legend>Vad ska ni inreda?</legend><div class="chips">${[["", "Hela hemmet"], ...RQ.ROOMS.map((r) => [r.id, r.name])].map(([id, nm], i) => `<button type="button" class="chip" data-gr-scope="${id}" aria-pressed="${!i}">${esc(nm)}</button>`).join("")}</div></fieldset>
        <div class="ctrl-row gr-start"><button class="btn" type="button" id="grStart">${SV.two}<span>Starta en grupp</span></button><a class="btn ghost" href="#svep">Svep själv först</a></div>
        <ol class="two-steps"><li><b>Svep tio kort</b><span>Höger på det du gillar, vänster på resten.</span></li><li><b>Skicka länken</b><span>Till en eller flera, i ett vanligt meddelande. Inget konto behövs.</span></li><li><b>Se vad ni alla gillar</b><span>Er gemensamma stil och det ni är överens om. Gör ett rum av det med ett tryck.</span></li></ol>
        <p class="small" style="margin-top:1rem">${privacy()}</p>
        <p class="small hem-promise">Se ditt hem innan du köper.</p></div></section>`,
    mount(root) {
      let scope = "";
      root.addEventListener("click", (e) => {
        const c = e.target.closest("[data-gr-scope]"); if (c) { scope = c.dataset.grScope; $$("[data-gr-scope]", root).forEach((x) => x.setAttribute("aria-pressed", x === c)); return; }
        if (e.target.closest("#grStart")) { const g = G.fresh(scope); RQ.track && RQ.track("svep_group_start", { scope }); location.hash = "#svep-ihop-" + G.payload(g); }
      });
    },
  });
  V.svepIhop = (payload) => {
    const link = G.parse(payload);
    if (!link) return introView(!!payload);
    const g = G.open(link), meIn = !!g.me && g.ppl.some((p) => p.id === g.me), n = g.ppl.length;
    const join = ss.get("rumiq-svep-join", "") === g.id;
    // you are in it, or it is full, or an older reply that already holds both answers: the result. Otherwise: your turn.
    if (meIn || n >= MAXP || (link.old && n === 2 && !join)) {
      const r = groupResult(g);
      return { title: "Svep tillsammans · RumIQ", html: `<section class="wrap svep two-done"><div class="sv-head">${crumbsTwo()}<h1 class="h1">${meIn && n === 1 ? "Svep tillsammans." : "Så här svarade ni."}</h1></div>${r.html}</section>`,
        mount(root) { if (meIn) G.save(g); bindGroup(root, g); } };
    }
    // someone sent you the cards: first an invitation (who asks, the cards, one button), "Är du Anna?" only as a small way back
    const invite = n > 0 && !join, ns = g.ppl.map((p) => p.n).filter(Boolean);
    const asks = ns.length ? `${namesHtml(ns.slice(0, 3))}${ns.length > 3 ? ` <span>och ${ns.length - 3} till</span>` : ""} <span>vill veta vad du tycker.</span>` : "<span>Någon vill veta vad du tycker.</span>";
    const line = n === 0 ? "Sen skickar du dem vidare, så ser ni vad ni gillar gemensamt." : `Svep ${g.hs.length} kort, så ser ni vad ni ${n === 1 ? "båda" : "alla"} gillar.`;
    const strip = g.hs.slice(0, 3).map(RQ.byHandle).filter(Boolean);
    const known = n === 1 ? `<button class="tlink" type="button" data-gr-known>${g.ppl[0].n ? `<span>Är du</span> <b class="sv-name">${esc(g.ppl[0].n)}</b><span>? Visa resultatet</span>` : "Har du redan svept? Visa resultatet"}</button>`
      : `<button class="tlink" type="button" data-gr-known aria-expanded="false" aria-controls="grKnown">Har du redan svept? Visa resultatet</button>
        <span class="gr-known" id="grKnown" hidden><span class="small">Vem av dem är du?</span><span class="gr-whoami-ppl">${g.ppl.map((p, i) => `<button type="button" class="gr-me" data-gr-me="${p.id}"><span class="gr-av" data-c="${i % 6}" aria-hidden="true">${initial(g, i)}</span><span>${esc(who(g, i))}</span></button>`).join("")}</span></span>`;
    const inviteHtml = `<div class="gr-invite" tabindex="-1">
        <div class="gr-invite-cards" aria-hidden="true">${strip.map((p, k) => `<img src="${RQ.img(p, 600)}" alt="" style="--k:${k}" ${k ? 'loading="lazy"' : ""}>`).join("")}</div>
        <p class="gr-invite-t">${line}</p>
        <button class="btn" type="button" data-gr-new>${SV.two}<span>Svep korten</span></button>
        <p class="small hem-promise">Se ditt hem innan du köper.</p>
        <p class="small gr-known-row">${known}</p></div>`;
    const h1 = invite ? asks : n ? "Din tur att svepa." : "Svep tio kort.";
    return {
      title: "Svep tillsammans · RumIQ",
      html: `<section class="wrap svep group-join${invite ? " asking" : ""}" aria-label="Svep tillsammans">
        <div class="sv-head">${crumbsTwo()}<span class="eyebrow">Svep tillsammans</span><h1 class="h1">${h1}</h1>
          ${n ? `<div class="gr-who">${pplRow(g, true)}</div>` : ""}
          <p class="lead keep">${line}</p>
          ${legend}<p class="small sv-after keep">${n ? `<span>Du ser vad de andra har svarat när du är klar.</span> ` : ""}<span class="hem-promise">Se ditt hem innan du köper.</span></p></div>
        ${invite ? inviteHtml : deckHtml("sv", false)}</section>`,
      mount(root) {
        if (n && !join) RQ.track && RQ.track("svep_group_opened", { people: n });
        ss.del("rumiq-svep-join");
        let off = null;
        const start = () => runDeck(root, {
          px: "sv", ctx: "ihop", keys: true, hint: true,
          total: () => g.hs.length,
          next: (st, t, skip, k) => g.hs.filter((h) => !skip.has(h)).slice(0, k).map(RQ.byHandle),
          onFinish: (st, deckEl) => {
            const me = { id: rid(2), b: g.hs.map((h) => ((st.answers[h] || 0) > 0 ? 1 : 0)).join(""), n: ls.get(NKEY, "") || "" };
            while (g.ppl.some((p) => p.id === me.id)) me.id = rid(2);
            g.ppl.push(me); g.me = me.id; g.claimed = false; G.save(g);
            try { history.replaceState(history.state, "", G.url(g)); } catch (e) {}
            RQ.track && RQ.track(g.ppl.length === 1 ? "svep_group_created" : "svep_group_completed", { people: g.ppl.length, cards: g.hs.length });
            const r = groupResult(g), wrap = deckEl.closest(".sv-wrap"); (wrap || deckEl).outerHTML = r.html; // the result takes the deck's whole place
            // the head now says what the page shows: the answers, not your turn
            $$(".gr-who, .sv-head .lead, .sv-head .eyebrow, .sv-legend, .sv-after", root).forEach((x) => x.remove());
            const h = $(".sv-head h1", root); if (h) h.textContent = g.ppl.length === 1 ? "Svep tillsammans." : "Så här svarade ni.";
            const sec = $(".svep", root); if (sec) { sec.classList.remove("group-join"); sec.classList.add("two-done"); }
            $(".svep-result", root).focus({ preventScroll: true });
            bindGroup(root, g);
          },
        });
        if (!invite) off = start();
        else root.addEventListener("click", (e) => {
          const claim = (id) => { g.me = id; g.claimed = true; G.save(g); RQ.track && RQ.track("svep_group_whoami", { known: 1 }); RQ.router(); scrollTo(0, 0); };
          const m = e.target.closest("[data-gr-me]"); if (m) return claim(m.dataset.grMe);
          const k = e.target.closest("[data-gr-known]");
          if (k) { if (n === 1) return claim(g.ppl[0].id); const box = $("#grKnown", root), open = box.hidden; box.hidden = !open; k.setAttribute("aria-expanded", String(open)); if (open) $(".gr-me", box).focus(); return; }
          if (!e.target.closest("[data-gr-new]")) return;
          RQ.track && RQ.track("svep_group_whoami", { known: 0 });
          $(".gr-invite", root).outerHTML = deckHtml("sv", false);
          const sec = $(".svep", root); sec.classList.remove("asking"); $(".sv-head h1", root).textContent = "Din tur att svepa.";
          off = start(); const d = $("#svDeck", root); if (d && document.activeElement !== d) d.focus({ preventScroll: true, focusVisible: false });
        });
        return () => { if (off) off(); };
      },
    };
  };
  /* ---------------------------------------------------------------- the taster on the home page */
  RQ.svepHome = {
    html() {
      const t = RQ.taste.get(), top = RQ.taste.top(t)[0];
      return `<section class="sec svh" id="svep-hem" aria-label="Svep fram din stil">
        <div class="wrap svh-in">
          <div class="svh-tx"><span class="eyebrow">${top ? `Din stil: ${esc(RQ.STYLES[top].name)}` : "Ny här? Börja här"}</span>
            <h2 class="display">Hitta din stil på en minut.</h2>
            <p class="lead">Svep höger på det du gillar och vänster på resten. Efter tio kort får du din stilprofil, och hela butiken sorterar sig efter dig.</p>
            <ul class="svh-how"><li><i aria-hidden="true">→</i>Spara</li><li><i aria-hidden="true">←</i>Hoppa över</li><li><i aria-hidden="true">↑</i>I varukorgen</li></ul>
            <div class="ctrl-row"><a class="btn" href="#svep">${t.n ? "Fortsätt svepa" : "Börja svepa"}</a><a class="btn ghost" href="#svep-ihop">${SV.two}<span>Svep tillsammans</span></a></div></div>
          <div class="svh-deck">${deckHtml("svh", true)}</div>
        </div></section>`;
    },
    mount(root) {
      const host = $("#svep-hem", root); if (!host) return () => {};
      return runDeck(host, {
        px: "svh", ctx: "hem", keys: false,
        total: () => HOME_CARDS,
        next: (st, t, skip, n) => upcoming(t, skip, n, st.done.length, null),
        onFinish: (st, deckEl) => {
          ss.set("rumiq-svep-carry", { done: st.done, answers: st.answers, saved: st.saved, bagged: st.bagged });
          const left = ROUND - st.done.length;
          deckEl.outerHTML = `<div class="svh-done" tabindex="-1"><span class="eyebrow">${st.done.length} av ${ROUND} klara</span><h3>Snyggt. ${left} kort kvar till din stilprofil.</h3>
            ${st.saved.length ? `<p>${st.saved.length} ${st.saved.length === 1 ? "sak har" : "saker har"} hamnat i Mitt hem.</p>` : `<p>Ju fler kort, desto bättre förstår vi vad du gillar.</p>`}
            <a class="btn" href="#svep">Fortsätt svepa</a></div>`;
        },
      });
    },
  };

  /* ---------------------------------------------------------------- nudges and teaser */
  const deck = () => [...RQ.PRODUCTS].sort((a, b) => hash(a.handle + "rq") - hash(b.handle + "rq"));
  RQ.svepTeaser = () => {
    const t = RQ.taste.get(), top = RQ.taste.top(t)[0], picks = deck().slice(0, 3);
    return `<a class="svt" href="#svep"><div class="svt-cards" aria-hidden="true">${picks.map((p, k) => `<img src="${RQ.img(p, 600)}" alt="" loading="lazy" style="--k:${k}">`).join("")}</div>
      <div class="svt-tx"><span class="eyebrow">${top ? `Din stil: ${esc(RQ.STYLES[top].name)}` : "Svep"}</span><h3>${t.n ? "Fortsätt där du var." : "Vilken stil är din?"}</h3><p>Svep höger på det du gillar och vänster på resten. Efter tio kort sorteras hela butiken efter dig.</p><span class="btn sm">${t.n ? "Fortsätt" : "Börja svepa"}</span></div></a>`;
  };
  // a small way into Svep for pages that would otherwise be empty
  RQ.svepNudge = (title = "Osäker på vad du gillar?", text = "Svep tio kort, så sparas det du gillar här och butiken sorterar sig efter dig.") => {
    const picks = deck().slice(3, 6);
    return `<a class="sv-nudge" href="#svep"><span class="sv-nudge-cards" aria-hidden="true">${picks.map((p, k) => `<img src="${RQ.img(p, 600)}" alt="" loading="lazy" style="--k:${k}">`).join("")}</span>
      <span class="sv-nudge-tx"><b>${title}</b><small>${text}</small><span class="tlink">Svep fram din stil</span></span></a>`;
  };
})();
