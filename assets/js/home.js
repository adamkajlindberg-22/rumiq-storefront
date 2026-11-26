/* Home: the offer on the first screen, a short scroll film behind it, then the real shop front.
   The headline, the text and both buttons are there from the first frame. On a desktop the film is
   scrubbed by one screen of scroll behind them (fetched on the first scroll or when the browser is
   idle, as one Blob; the shown time is lerped toward the scroll target in a rAF loop that rests when
   it arrives). Phones play a short loop once; reduced motion, Save-Data and slow lines get a still.
   One <picture> picks the right first image for each of those, so nothing is fetched twice. */
(function () {
  const RQ = window.RQ, S = RQ.shop, V = RQ.views, $ = RQ.$, $$ = RQ.$$, esc = RQ.esc;
  /* a big or sharp screen gets the 1440p cut of the film, everything else 1080p */
  const VIDEO_SRC = (innerWidth || 0) * (devicePixelRatio || 1) > 2000 ? "assets/video/hero-1440.mp4" : "assets/video/hero.mp4";
  const HOLD = 0.9;
  /* the wide still: the box is cropped with object-fit cover, so on a tall screen the picture is wider than the window */
  const WIDE_SET = "assets/img/rum-900.webp 900w, assets/img/rum-1600.webp 1600w, assets/img/rum-2400.webp 2400w, assets/img/rum-3200.webp 3200w", WIDE_SIZES = "max(100vw, 180vh)";
  const WIDE_FIRST = "(prefers-reduced-motion: reduce), (pointer: coarse) and (min-width: 821px) and (max-width: 1100px)";
  let videoBlobUrl = null, videoFailed = false;

  const mq = (s) => matchMedia(s).matches;
  const conn = navigator.connection || {};
  const staticHero = () => videoFailed || mq("(prefers-reduced-motion: reduce)") || mq("(max-width: 820px)") || mq("(pointer: coarse) and (max-width: 1100px)") || conn.saveData === true || /(^|-)2g$/.test(conn.effectiveType || "") || location.protocol === "file:";

  /* a sideways row gets two arrows on a desktop (a mouse wheel does not scroll sideways); phones swipe */
  RQ.rowNav = (id, what) => `<span class="row-nav" data-row-nav="${id}"><button type="button" class="iconbtn" data-dir="-1" aria-label="Föregående ${what}" title="Föregående" disabled><svg viewBox="0 0 24 24"><path d="M14.5 6l-6 6 6 6"/></svg></button><button type="button" class="iconbtn" data-dir="1" aria-label="Nästa ${what}" title="Nästa"><svg viewBox="0 0 24 24"><path d="M9.5 6l6 6-6 6"/></svg></button></span>`;
  RQ.mountRowNav = (root) => {
    const offs = [];
    $$("[data-row-nav]", root).forEach((nav) => {
      const row = document.getElementById(nav.dataset.rowNav); if (!row) return;
      const [prev, next] = $$("button", nav);
      const paint = () => { prev.disabled = row.scrollLeft < 8; next.disabled = row.scrollLeft > row.scrollWidth - row.clientWidth - 8; nav.hidden = row.scrollWidth <= row.clientWidth + 8; };
      const go = (e) => { const b = e.target.closest("button"); if (!b) return; const card = row.firstElementChild, step = card ? card.getBoundingClientRect().width + parseFloat(getComputedStyle(row).columnGap || 0) : row.clientWidth; row.scrollBy({ left: +b.dataset.dir * Math.max(1, Math.floor(row.clientWidth * 0.8 / step)) * step, behavior: mq("(prefers-reduced-motion: reduce)") ? "auto" : "smooth" }); };
      nav.addEventListener("click", go); row.addEventListener("scroll", paint, { passive: true }); window.addEventListener("resize", paint, { passive: true }); paint();
      offs.push(() => { nav.removeEventListener("click", go); row.removeEventListener("scroll", paint); window.removeEventListener("resize", paint); });
    });
    return () => offs.forEach((f) => f());
  };

  V.home = () => {
    const forYou = RQ.taste && RQ.taste.has();
    const featured = forYou ? RQ.taste.sort(RQ.PRODUCTS).slice(0, 8) : RQ.PRODUCTS.filter((p) => p.featured).slice(0, 8);
    return {
      html: `
      <section class="hero" id="hero" aria-label="Välkommen till RumIQ">
        <div class="stage">
          <picture><source media="(prefers-reduced-motion: reduce), (pointer: coarse) and (min-width: 821px) and (max-width: 1100px)" srcset="${WIDE_SET}" sizes="${WIDE_SIZES}"><source media="(max-width: 820px)" srcset="assets/img/hero-m-start.webp 540w, assets/img/hero-m-start-1080.webp 1080w" sizes="100vw"><img class="still first" src="assets/img/hero-start-1600.webp" srcset="assets/img/hero-start-1600.webp 1600w, assets/img/hero-start-2560.webp 2560w" sizes="100vw" alt="Ett ljust skandinaviskt vardagsrum i morgonsol, med linnesoffa, ekbord och en stengodsmugg." width="1600" height="900" fetchpriority="high" decoding="async"></picture>
          <img class="still wide" alt="" aria-hidden="true" width="2400" height="1340" decoding="async" hidden>
          <video id="heroVideo" muted playsinline preload="none" aria-hidden="true" tabindex="-1"></video>
          <video class="mloop" id="heroLoop" muted playsinline preload="none" aria-hidden="true" tabindex="-1"></video>
          <canvas id="dust" aria-hidden="true"></canvas>
          <div class="scrim" aria-hidden="true"></div>
          <div class="bands">
            <div class="band settle"><h1>Ditt hem.<br>Din vision.<br>Din stil.</h1><p class="sub"><b>Se ditt hem innan du köper.</b> Noga utvald belysning, textil och förvaring, och verktyg som visar allt i ditt eget rum.</p>
              <div class="row">${RQ.room.has() ? `<a class="btn" href="#mitt-rum">Öppna Mitt rum</a>` : `<a class="btn" href="#mitt-rum">Prova i Mitt rum</a>`}<a class="btn ghost" href="#butik">Upptäck butiken</a></div></div>
          </div>
          <div class="cue" id="cue" aria-hidden="true"><span>Scrolla</span><i></i></div>
        </div>
      </section>

      <section class="promise" aria-label="Det här lovar vi"><ul class="wrap"><li><b>Se det hemma först</b> i en bild av ditt eget rum</li><li>${((window.RQ_CONFIG || {}).delivery || {}).openPurchaseDays ? `<b>${window.RQ_CONFIG.delivery.openPurchaseDays} dagars öppet köp</b>, ångra med en knapp` : `<b>14 dagars ångerrätt</b>, ångra med en knapp`}</li><li><b>Säker betalning</b> i Shopifys kassa</li></ul></section>

      <section class="hrooms" aria-label="Handla efter rum"><div class="wrap hrooms-in">
        ${RQ.ROOMS.map((r) => `<a class="hroom" href="#rum-${r.id}"><span class="hroom-im"><img src="assets/img/rum/${r.id}-600.webp" srcset="${RQ.srcset(`assets/img/rum/${r.id}-600.webp`)}" sizes="(max-width: 640px) 94vw, 31rem" alt="" loading="lazy" decoding="async" width="600" height="750"></span><span>${esc(r.name)}</span></a>`).join("")}
        <a class="hroom all" href="#butik"><span class="hroom-im"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/></svg></span><span>Alla produkter</span></a>
      </div></section>

      <section class="sec" id="utvalt">
        <div class="wrap"><div class="sec-row"><div class="sec-head"><h2 class="h2">${forYou ? "Utvalt för dig" : "Våra favoriter just nu"}</h2><p>${forYou ? "Sorterat efter det du sparat i Svep." : "Saker vi tycker gör skillnad i vardagen. Valda av oss, inte efter försäljning."}</p></div><a class="link" href="${forYou ? "#for-dig" : "#butik"}">${forYou ? "Hela butiken för dig" : "Alla produkter"}</a></div>
          ${RQ.grid(featured, "feat")}</div>
      </section>

      ${RQ.svepHome ? RQ.svepHome.html() : ""}

      <section class="sec roomhero" id="ditt-rum">
        <div class="wrap rh">
          <div class="rh-copy">
            <span class="eyebrow rh-promise">Se ditt hem innan du köper.</span>
            <h2 class="display">Prova produkterna i ditt rum.</h2>
            <p class="lead">Ta en bild av ditt rum, eller börja i ett exempelrum. Peka ut var sakerna ska stå och se bilden med dem på plats. Sedan handlar du allt med en knapp.</p>
            <ol class="rh-steps"><li><b>Välj rum</b><span>Ta en bild med telefonen, eller börja i ett exempelrum.</span></li><li><b>Peka ut</b><span>Välj upp till fem saker och visa var de ska stå.</span></li><li><b>Skapa bilden</b><span>Se rummet med sakerna på plats och handla allt med en knapp.</span></li></ol>
            <div class="ctrl-row" style="margin-top:2rem">${RQ.room.has() ? `<a class="btn" href="#mitt-rum">Öppna Mitt rum</a><a class="btn ghost" href="#butik">Till butiken</a>` : `<button class="btn" type="button" data-room-sample-now="#mitt-rum">Prova med ett exempelrum</button><button class="btn ghost" type="button" data-room-setup="#mitt-rum">Lägg in ditt rum</button>`}</div>
            <p class="small" style="margin-top:1rem">Bilden sparas bara i din webbläsare. Den skickas till oss först om du själv väljer att skapa en AI-bild.</p>
          </div>
          ${demoFig()}
        </div>
      </section>


      <section class="sec looks-sec" id="looks-hem">
        <div class="wrap"><div class="sec-row"><div class="sec-head"><h2 class="h2">Looks</h2><p>Tre eller fyra saker som hör ihop. Ett tryck, så ligger allt i varukorgen.</p></div><span class="sec-end">${RQ.rowNav("homeLooks", "looks")}<a class="link" href="#looks">Alla looks</a></span></div>
          <div class="looks-row" id="homeLooks">${RQ.LOOKS.map(RQ.lookCard).join("")}</div></div>
      </section>

      ${RQ.whyHtml()}

      <section class="sec cta-band" id="bli-forst">
                <div class="wrap"><div><h2>Bli först när vi öppnar.</h2><p class="lead">${((window.RQ_CONFIG || {}).waitlist || {}).offer ? `Skriv upp dig så får du ${esc(RQ_CONFIG.waitlist.offer)}.` : "Skriv upp dig så mejlar vi när vi öppnar."} Till dess kan du prova Mitt rum gratis och se produkterna i ditt eget rum.</p></div>
          <div class="signup" id="formBox"><form id="signup" novalidate><label for="email">Din e-post</label><div class="field"><input id="email" name="email" type="email" autocomplete="email" placeholder="namn@exempel.se" required><button class="btn" type="submit">Skriv upp mig</button></div><p class="status" id="formErr" role="alert"></p><p class="fine">Vi mejlar när vi öppnar och ibland med stylingtips. Vi delar aldrig din adress, och du kan avregistrera dig när du vill.</p></form>
            <div class="ok" role="status" aria-live="polite"><h3>Tack. Du står på listan.</h3><p id="okText">Vi hör av oss med din rabattkod när RumIQ öppnar.</p><a class="btn ghost sm" href="#mitt-rum">Prova Mitt rum under tiden</a></div></div></div>
      </section>`,
      mount: mountHome,
    };
  };

  /* the "whole shop in your room" demo: the customer's own room and scene if they have one, otherwise a sample */
  function demoFig(o) { // o.bare: without the card's button (Mitt rum's empty page keeps you in Studio)
    const R = RQ.room, mine = R.has() && R.scene().length;
    /* sample: a real photo pair (same room before and after), with small product tags in the "after" half. Before is on the
       left and after on the right, so the pair is shown mirrored: the things stand on the right (x below is in the mirrored photo) */
    const SAMPLE = [{ h: "lysa-keramiklampa", x: 86, y: 47, l: 1 }, { h: "plad-ullblandning-havre", x: 44, y: 57 }, { h: "flatad-forvaringskorg", x: 75, y: 74, l: 1 }];
    const items = mine ? R.ordered().slice(0, 8) : SAMPLE;
    const total = items.reduce((s, it) => s + RQ.byHandle(it.h).price, 0);
    const set = (k) => RQ.srcset(`assets/img/rum/sovrum-${k}-900.webp`);
    const sizes = "(max-width: 900px) 100vw, 60vw";
    const stage = mine
      ? `<div class="rh-stage" style="aspect-ratio:${R.get().w} / ${R.get().h}"><img class="rh-bg" src="${R.url()}" alt="Ditt rum med produkterna du ställt in" loading="lazy"><div class="ba-after">${items.map((it) => { const p = RQ.byHandle(it.h); return `<span class="rh-item" style="left:${it.x}%;top:${it.y}%;width:${it.w}%"><img src="${R.cutIn ? R.cutIn(p) : RQ.cut(p)}" alt="" loading="lazy" style="${it.sy ? `aspect-ratio:1 / ${(R.PLACE[it.h][2] * it.sy).toFixed(3)};` : ""}filter:${R.lightFilter(it.light)}"></span>`; }).join("")}</div>`
      : `<div class="rh-stage rh-photo" style="aspect-ratio:1344 / 752"><img class="rh-bg rh-flip" src="assets/img/rum/sovrum-fore-900.webp" srcset="${set("fore")}" sizes="${sizes}" alt="Ett ljust sovrum innan, med tomt nattduksbord och bar säng" loading="lazy" decoding="async" width="1344" height="752"><div class="ba-after"><img class="rh-bg rh-flip" src="assets/img/rum/sovrum-efter-900.webp" srcset="${set("efter")}" sizes="${sizes}" alt="Samma sovrum med Lysa keramiklampa, Pläd ullblandning havre och Flätad förvaringskorg" loading="lazy" decoding="async" width="1344" height="752">${items.map((it) => { const p = RQ.byHandle(it.h); return `<span class="rh-tag${it.l ? " l" : ""}" style="left:${it.x}%;top:${it.y}%"><i></i><span><b>${RQ.esc(p.name)}</b> ${S.kr(p.price)}</span></span>`; }).join("")}</div>`;
    // the line starts left of the things, so every one of them shows "after" at first
    const start = mine ? Math.round(Math.max(10, Math.min(50, Math.min(...items.map((it) => it.x - it.w / 2)) - 4))) : 31;
    return `<figure class="rh-fig bav" style="--ba:${start}%">${stage}
      <span class="ba-tag ba-before" aria-hidden="true">Före</span><span class="ba-tag ba-now" aria-hidden="true">Med RumIQ</span><span class="ba-line" aria-hidden="true"><i></i></span>
      <input class="ba-range" type="range" min="0" max="100" value="${start}" aria-label="Jämför rummet före och efter. Dra åt vänster för att visa fler produkter."></div>
      <figcaption class="rh-card"><span><b>${mine ? "Ditt rum" : "Hela rummet"}</b><span>${items.length} produkter · ${S.kr(total).replace(/ (?=kr$)/, "\u00a0")}</span></span>${o && o.bare ? "" : `<a class="btn sm" href="${mine ? "#mitt-rum" : "#butik"}">${mine ? "Fortsätt" : "Till butiken"}</a>`}</figcaption></figure>`;
  }

  /* Why RumIQ: four reasons to trust a new shop, every figure read from RQ_CONFIG */
  RQ.whyHtml = () => {
    const C = window.RQ_CONFIG || {}, d = C.delivery || {}, mail = (C.company || {}).email || "support@rumiq.se";
    const ico = (path) => `<svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
    const items = [
      [ico('<path d="M3.5 20V10l8.5-6 8.5 6v10"/><path d="M9 20v-5.5h6V20"/>'), "Se det hemma först", "Peka ut var produkterna ska stå i en bild av ditt eget rum innan du köper. Bilden stannar i din webbläsare."],
      [ico('<path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.6"/><circle cx="17" cy="17.5" r="1.6"/>'), d.minDays ? `Målet: hemma om ${d.minDays}–${d.maxDays} arbetsdagar` : "Leverans till ombud, paketskåp eller hem", `${d.fromCountry || "Lager i EU"}. Du ser beräknat datum innan du beställer och väljer ombud, paketskåp eller hem.`],
      [ico('<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/>'), d.openPurchaseDays ? `${d.openPurchaseDays} dagars öppet köp` : "14 dagars ångerrätt", `Ångra med en knapp på sajten. ${d.returnText || ""}`.trim()],
      [ico('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>'), "Du är med och väljer", "Färre, bättre saker. Rösta fram nästa produkt i Önska, så vet vi vad vi ska ta in."],
    ];
    return `<section class="sec why" id="varfor" aria-labelledby="whyH"><div class="wrap">
        <div class="sec-head"><h2 class="h2" id="whyH">Därför RumIQ</h2><p>En ny butik ska vara lätt att lita på. Det här kan du räkna med.</p></div>
        <ul class="why-grid">${items.map(([i, b, t]) => `<li>${i}<b>${b}</b><span>${t}</span></li>`).join("")}</ul>
        <p class="why-foot">Frågor? Skriv till <a href="mailto:${mail}">${mail}</a>, eller läs mer <a href="#om">om oss</a> och <a href="#sa-fungerar-det">hur det fungerar</a>.</p>
      </div></section>`;
  };

  RQ.demoFig = demoFig;

  // Where waiting-list sign-ups go. Empty = preview mode: the thank-you shows but nothing is saved.
  // Before launch, paste the Formspree form URL here (https://formspree.io/f/xxxxxxx).
  RQ.FORM_ENDPOINT = (window.RQ_CONFIG && window.RQ_CONFIG.formEndpoint) || "";

  function mountHome(root) {
    const off = [];
    const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); off.push(() => t.removeEventListener(ev, fn, o)); };
    const hero = $("#hero", root), video = $("#heroVideo", root), first = $(".stage .first", root), wide = $(".stage .wide", root), cue = $("#cue", root);
    let isStatic = staticHero(); const html = document.documentElement;
    html.classList.toggle("static", isStatic);
    let duration = 0, ready = false, shown = 0, running = false, cueHidden = false, alive = true, asked = false, top = 0, span = 1;
    /* the wide still is fetched only when it will be seen: under the film if the film is not there yet, or as the still hero */
    const showWide = (over) => { if (!wide.getAttribute("src")) { wide.sizes = WIDE_SIZES; wide.srcset = WIDE_SET; wide.src = "assets/img/rum-1600.webp"; } if (over) wide.classList.add("over"); };
    const goStatic = () => { isStatic = true; html.classList.add("static"); if (!mq(WIDE_FIRST)) showWide(true); };
    /* where the hero starts and how far it scrolls, measured once and after a resize (not every frame) */
    const measure = () => { top = hero.getBoundingClientRect().top + scrollY; span = Math.max(1, hero.offsetHeight - innerHeight); };
    const prog = () => Math.min(1, Math.max(0, (scrollY - top) / span));
    const tick = () => {
      if (!alive || isStatic) { running = false; return; }
      const p = prog();
      if (!cueHidden && p > 0.03) { cue.style.opacity = 0; cueHidden = true; }
      if (!ready) { if (p > 0.15) showWide(); first.style.opacity = p < 0.3 ? 1 : Math.max(0, 1 - (p - 0.3) / 0.45); running = false; return; }
      const target = Math.min(1, p / HOLD) * duration;
      shown += (target - shown) * 0.14; if (Math.abs(target - shown) < 0.002) shown = target;
      if (!video.seeking && Math.abs(video.currentTime - shown) > 0.008) video.currentTime = shown;
      if (shown === target && !video.seeking) { running = false; return; }
      requestAnimationFrame(tick);
    };
    const wake = () => { if (!running && !isStatic && alive) { running = true; requestAnimationFrame(tick); } };

    const attach = async (url) => {
      video.src = url;
      await new Promise((ok, bad) => { video.addEventListener("loadeddata", ok, { once: true }); video.addEventListener("error", bad, { once: true }); video.load(); });
      duration = video.duration || 6; shown = Math.min(1, prog() / HOLD) * duration; video.currentTime = shown;
      await new Promise((ok) => video.addEventListener("seeked", ok, { once: true }));
      if (!alive || isStatic) return;
      ready = true; video.classList.add("ready"); first.style.opacity = 0; wake();
    };
    const load = async () => {
      if (videoBlobUrl) return attach(videoBlobUrl).catch(() => {});
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 25000);
      try {
        const res = await fetch(VIDEO_SRC, { signal: ctrl.signal }); if (!res.ok) throw new Error("video " + res.status);
        const blob = await res.blob();
        clearTimeout(t); videoBlobUrl = URL.createObjectURL(blob);
        if (alive) await attach(videoBlobUrl);
      } catch (e) { clearTimeout(t); videoFailed = true; if (alive && !isStatic) { showWide(); wake(); } } // no film: the still fades in as you scroll, nothing jumps
    };
    /* the film is 1.4 MB: it waits for the first sign of scrolling or for the browser to be idle after load */
    const ask = () => { if (asked || isStatic || !alive) return; asked = true; load(); };

    // dust and motes, whisper level
    const dust = (canvas, opts) => {
      if (!canvas || mq("(prefers-reduced-motion: reduce)")) return;
      const cx = canvas.getContext("2d"); let w, h, motes = [], vis = true, raf = 0;
      const size = () => { const d = Math.min(2, devicePixelRatio || 1); w = canvas.clientWidth; h = canvas.clientHeight; canvas.width = w * d; canvas.height = h * d; cx.setTransform(d, 0, 0, d, 0, 0);
        motes = Array.from({ length: opts.count }, () => ({ x: Math.random() * w, y: Math.random() * h, r: 0.4 + Math.random() * 1.3, vx: (Math.random() - 0.3) * 0.12, vy: -0.03 - Math.random() * 0.1, t: Math.random() * 6.28 })); };
      // the motes drift for the first five seconds on screen and then rest where they are (moving things stop by themselves, WCAG 2.2.2)
      let moved = 0, last = 0;
      const draw = (now) => { if (!alive) return; if (last && now) moved += Math.min(100, now - last); last = now || 0; if (moved > 5000) { raf = 0; return; } cx.clearRect(0, 0, w, h); for (const m of motes) { m.x += m.vx; m.y += m.vy; m.t += 0.01; if (m.y < -4) m.y = h + 4; if (m.x > w + 4) m.x = -4; if (m.x < -4) m.x = w + 4;
          const a = opts.alpha(m.x / w, m.y / h) * (0.55 + 0.45 * Math.sin(m.t)); if (a <= 0.01) continue; cx.beginPath(); cx.arc(m.x, m.y, m.r, 0, 6.283); cx.fillStyle = `rgba(${opts.rgb},${a})`; cx.fill(); }
        raf = vis ? requestAnimationFrame(draw) : 0; if (!vis) last = 0; };
      size(); on(window, "resize", size, { passive: true });
      const ob = new IntersectionObserver(([e]) => { vis = e.isIntersecting; if (vis && !raf && moved <= 5000) raf = requestAnimationFrame(draw); }); ob.observe(canvas); off.push(() => ob.disconnect());
    };


    if (RQ.svepHome) off.push(RQ.svepHome.mount(root));
    off.push(RQ.mountRowNav(root));

    // waiting list
    const form = $("#signup", root), err = $("#formErr", root), btn = form.querySelector("button");
    on(form, "submit", async (e) => {
      e.preventDefault(); const v = form.email.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { err.textContent = "Skriv en e-postadress, till exempel namn@exempel.se."; form.email.focus(); return; }
      err.textContent = "";
      btn.disabled = true; btn.textContent = "Skickar…";
      const res = await RQ.subscribe({ email: v, lista: "Väntelista" });
      if (res === "error") { btn.disabled = false; btn.textContent = "Skriv upp mig"; err.textContent = "Det gick inte att skicka just nu. Försök igen om en stund."; return; }
      // nothing is connected to receive the address: say that, not "Tack. Du står på listan."
      if (res === "preview") { const h = $("#formBox .ok h3", root); if (h) h.textContent = "Förhandsversion"; $("#okText", root).textContent = "Adressen sparas inte här. På den riktiga sajten hamnar du på listan."; }
      $("#formBox", root).classList.add("sent");
    });

    const onScroll = () => { ask(); wake(); RQ.navCheck(); };
    on(window, "scroll", onScroll, { passive: true });
    on(window, "wheel", ask, { passive: true }); on(window, "keydown", ask);
    /* a window dragged narrow gets the still hero, like a phone opened that way */
    on(window, "resize", () => { if (!isStatic && staticHero()) goStatic(); measure(); wake(); RQ.navCheck(); }, { passive: true });
    // phones: the standing cut of the film plays once behind the headline and rests on its last frame
    const loop = $("#heroLoop", root);
    if (isStatic) {
      if (loop && mq("(max-width: 820px)") && !mq("(prefers-reduced-motion: reduce)") && conn.saveData !== true && !/(^|-)2g$/.test(conn.effectiveType || "")) {
        const noLoop = () => { loop.classList.remove("on"); showWide(true); };
        loop.src = "assets/video/hero-m.mp4"; loop.classList.add("on"); loop.defaultPlaybackRate = loop.playbackRate = 1.25; // once, in under five seconds (2.2.2)
        const pl = loop.play(); if (pl && pl.catch) pl.catch(noLoop);
        on(loop, "error", noLoop);
      } else if (!mq(WIDE_FIRST)) showWide(true);
    } else {
      measure(); dust($("#dust", root), { count: 60, rgb: "255,244,222", alpha: (x, y) => Math.max(0, 1 - Math.abs(x - (0.7 - y * 0.35)) * 3.2) * 0.55 }); wake();
      if (videoBlobUrl || scrollY > 0) ask();
      else { const idle = () => (window.requestIdleCallback ? requestIdleCallback(ask, { timeout: 4000 }) : setTimeout(ask, 2000)); if (document.readyState === "complete") idle(); else on(window, "load", idle); }
    }

    return () => { alive = false; off.forEach((f) => f()); html.classList.remove("static"); };
  }
})();
