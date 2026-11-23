/* Home: the cinematic scroll hero, then the real shop front.
   Hero engine: the video is fetched once as a Blob, the displayed time is lerped toward the
   scroll target in a rAF loop that rests when it arrives, seeks never overlap, and the DOM is
   written only on change. Five gates serve the designed still hero instead. */
(function () {
  const RQ = window.RQ, S = RQ.shop, V = RQ.views, $ = RQ.$, $$ = RQ.$$, esc = RQ.esc;
  const VIDEO_SRC = "assets/video/hero.mp4";
  const HOLD = 0.9;
  let videoBlobUrl = null, videoFailed = false;

  const mq = (s) => matchMedia(s).matches;
  const conn = navigator.connection || {};
  const staticHero = () => videoFailed || mq("(prefers-reduced-motion: reduce)") || mq("(max-width: 820px)") || mq("(pointer: coarse) and (max-width: 1100px)") || conn.saveData === true || /(^|-)2g$/.test(conn.effectiveType || "") || location.protocol === "file:";

  V.home = () => {
    const forYou = RQ.taste && RQ.taste.has();
    const featured = forYou ? RQ.taste.sort(RQ.PRODUCTS).slice(0, 6) : RQ.PRODUCTS.filter((p) => p.featured).slice(0, 6);
    return {
      html: `
      <section class="hero" id="hero" aria-label="Välkommen till RumIQ">
        <div class="stage">
          <img class="still wide" src="assets/img/rum-1600.webp" srcset="assets/img/rum-900.webp 900w, assets/img/rum-1600.webp 1600w, assets/img/rum-2400.webp 2400w" sizes="100vw" alt="Ett ljust skandinaviskt vardagsrum i morgonsol, med linnesoffa, ekbord och en stengodsmugg." width="2400" height="1340">
          <img class="still start" src="assets/img/hero-start-1600.webp" alt="" aria-hidden="true" width="1600" height="900">
          <video id="heroVideo" muted playsinline preload="none" aria-hidden="true" tabindex="-1"></video>
          <canvas id="dust" aria-hidden="true"></canvas>
          <div class="scrim" aria-hidden="true"></div>
          <div class="bands">
            <div class="band" data-in="0" data-out=".19"><p class="big">Börja med en sak.</p></div>
            <div class="band" data-in=".22" data-out=".44"><p class="big">Den rätta.</p></div>
            <div class="band" data-in=".48" data-out=".70"><p class="big">Ett bättre hem kräver inte fler saker.</p></div>
            <div class="band" data-in=".74" data-out=".89"><p class="big">Det kräver rätt saker.</p></div>
            <div class="band settle" data-in=".92" data-out="9"><h1>Rätt saker.<br>Ett lugnare hem.</h1><p class="sub">Noga utvald belysning, textil och förvaring, och verktyg som låter dig se allt i ditt eget rum innan du köper.</p>
              <div class="row">${RQ.room.has() ? `<a class="btn" href="#mitt-rum">Öppna mitt rum</a>` : `<button class="btn" type="button" data-room-setup="#butik">Se butiken i ditt rum</button>`}<a class="btn ghost" href="#butik">Upptäck butiken</a></div></div>
          </div>
          <div class="loader" id="loader" aria-hidden="true"><svg viewBox="0 0 32 32"><circle class="track" cx="16" cy="16" r="13"/><circle class="bar" id="loaderBar" cx="16" cy="16" r="13" pathLength="1"/></svg><span id="loaderText">Laddar rummet</span></div>
          <div class="cue" id="cue" aria-hidden="true"><span>Scrolla</span><i></i></div>
        </div>
      </section>

      <section class="promise" aria-label="Det här lovar vi"><ul class="wrap"><li><b>Se det hemma först</b> i en bild av ditt eget rum</li><li><b>14 dagars ångerrätt</b>, ångra med en knapp</li><li><b>Säker betalning</b> i Shopifys kassa</li></ul></section>

      ${RQ.svepHome ? RQ.svepHome.html() : ""}

      <section class="sec roomhero" id="ditt-rum">
        <div class="wrap rh">
          <div class="rh-copy">
            <h2 class="display">Hela butiken i ditt rum.</h2>
            <p class="lead">Ta en bild av ditt rum en gång. Sedan står varje produkt du tittar på i just ditt rum, i ditt eget ljus. Ställ in det du gillar, se vad hela rummet kostar och handla allt med en knapp.</p>
            <ol class="rh-steps"><li><b>Ta en bild</b><span>Med telefonen, eller välj en du redan har.</span></li><li><b>Bläddra i ditt rum</b><span>Butiken visar varje produkt hemma hos dig.</span></li><li><b>Handla looken</b><span>Allt du ställt in hamnar i varukorgen på en gång.</span></li></ol>
            <div class="ctrl-row" style="margin-top:2rem">${RQ.room.has() ? `<a class="btn" href="#mitt-rum">Öppna mitt rum</a><a class="btn ghost" href="#butik">Butiken i ditt rum</a>` : `<button class="btn" type="button" data-room-setup="#butik">Lägg in ditt rum</button><button class="btn ghost" type="button" data-room-sample-now="#butik">Prova med ett exempelrum</button>`}</div>
            <p class="small" style="margin-top:1rem">Bilden sparas bara i din webbläsare. Den skickas till oss först om du själv väljer att skapa en AI-bild.</p>
          </div>
          ${demoFig()}
        </div>
      </section>

      ${RQ.journey.html()}

      <section class="sec looks-sec" id="looks-hem">
        <div class="wrap"><div class="sec-row"><div class="sec-head"><h2 class="h2">Färdiga looks</h2><p>Tre eller fyra saker som hör ihop. Ett tryck, så ligger allt i varukorgen.</p></div><a class="link" href="#looks">Alla looks</a></div>
          <div class="looks-row">${RQ.LOOKS.map(RQ.lookCard).join("")}</div></div>
      </section>

      <section class="sec" id="utvalt">
        <div class="wrap"><div class="sec-row"><div class="sec-head"><h2 class="h2">${forYou ? "Utvalt för dig" : "Utvalt just nu"}</h2><p>${forYou ? "Sorterat efter det du sparat i Svep." : "Saker vi tycker gör skillnad i vardagen. Valda av oss, inte efter försäljning."}</p></div><a class="link" href="${forYou ? "#for-dig" : "#butik"}">${forYou ? "Hela butiken för dig" : "Alla produkter"}</a></div>
          ${RQ.grid(featured, "three")}</div>
      </section>

      <section class="sec">
        <div class="wrap"><div class="sec-row"><div class="sec-head"><h2 class="h2">Magasin</h2><p>Korta texter om ljus, material, färg och vardag.</p></div><a class="link" href="#magasin">Alla artiklar</a></div>
          <div class="mag-grid compact">${RQ.ARTICLES.slice(0, 3).map(RQ.magCard).join("")}</div></div>
      </section>

      <section class="sec cta-band" id="bli-forst">
                <div class="wrap"><div><h2>Bli först när vi öppnar.</h2><p class="lead">Skriv upp dig så får du 10 % på första köpet när vi öppnar. Till dess kan du prova Studio gratis och se produkterna i ditt eget rum.</p></div>
          <div class="signup" id="formBox"><form id="signup" novalidate><label for="email">Din e-post</label><div class="field"><input id="email" name="email" type="email" autocomplete="email" placeholder="namn@exempel.se" required><button class="btn" type="submit">Skriv upp mig</button></div><p class="status" id="formErr" role="alert"></p><p class="fine">Vi mejlar när vi öppnar och ibland med stylingtips. Vi delar aldrig din adress, och du kan avregistrera dig när du vill.</p></form>
            <div class="ok" role="status" aria-live="polite"><h3>Tack. Du står på listan.</h3><p id="okText">Vi hör av oss med din rabattkod när RumIQ öppnar.</p><a class="btn ghost sm" href="#mitt-rum">Prova Studio under tiden</a></div></div></div>
      </section>`,
      mount: mountHome,
    };
  };

  /* the "whole shop in your room" demo: the customer's own room and scene if they have one, otherwise a sample */
  function demoFig() {
    const R = RQ.room, mine = R.has() && R.scene().length;
    const bg = mine ? R.url() : "assets/img/rum/sovrum-1600.webp";
    const ratio = mine ? `${R.get().w} / ${R.get().h}` : "16 / 9";
    const items = mine ? R.scene().slice(0, 6) : [{ h: "lysa-keramiklampa", x: 77, y: 71, w: 11 }, { h: "plad-ullblandning-havre", x: 42, y: 80, w: 20 }, { h: "flatad-forvaringskorg", x: 14, y: 97, w: 15 }];
    const total = items.reduce((s, it) => s + RQ.byHandle(it.h).price, 0);
    return `<figure class="rh-fig bav" style="--ba:58%"><div class="rh-stage" style="aspect-ratio:${ratio}"><img class="rh-bg" src="${bg}" alt="${mine ? "Ditt rum med produkterna du ställt in" : "Exempelrum med produkter från butiken inställda"}" loading="lazy"><div class="ba-after">${items.map((it) => { const p = RQ.byHandle(it.h); return `<span class="rh-item" style="left:${it.x}%;top:${it.y}%;width:${it.w}%"><img src="${RQ.cut(p)}" alt="" loading="lazy" style="${mine ? `filter:${R.lightFilter(it.light)}` : ""}"></span>`; }).join("")}</div>
      <span class="ba-tag ba-before" aria-hidden="true">Före</span><span class="ba-tag ba-now" aria-hidden="true">Med RumIQ</span><span class="ba-line" aria-hidden="true"><i></i></span>
      <input class="ba-range" type="range" min="0" max="100" value="58" aria-label="Jämför rummet före och efter. Dra åt höger för att visa fler produkter."></div>
      <figcaption class="rh-card"><span><b>${mine ? "Ditt rum" : "Hela rummet"}</b><span>${items.length} produkter · ${S.kr(total)}</span></span><a class="btn sm" href="${mine ? "#mitt-rum" : "#butik"}">${mine ? "Fortsätt" : "Till butiken"}</a></figcaption></figure>`;
  }

  RQ.demoFig = demoFig;

  // Where waiting-list sign-ups go. Empty = preview mode: the thank-you shows but nothing is saved.
  // Before launch, paste the Formspree form URL here (https://formspree.io/f/xxxxxxx).
  RQ.FORM_ENDPOINT = (window.RQ_CONFIG && window.RQ_CONFIG.formEndpoint) || "";

  function mountHome(root) {
    const off = [];
    const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); off.push(() => t.removeEventListener(ev, fn, o)); };
    const hero = $("#hero", root), video = $("#heroVideo", root), startImg = $(".stage .start", root);
    const bands = $$(".band", root).map((el) => ({ el, a: +el.dataset.in, b: +el.dataset.out, o: -1, y: 999 }));
    const loader = $("#loader", root), loaderBar = $("#loaderBar", root), loaderText = $("#loaderText", root), cue = $("#cue", root);
    let isStatic = staticHero(); const html = document.documentElement;
    const goStatic = () => { isStatic = true; html.classList.add("static"); };
    html.classList.toggle("static", isStatic);
    let duration = 0, ready = false, shown = 0, running = false, lastP = -1, cueHidden = false, alive = true;

    const prog = () => { const r = hero.getBoundingClientRect(); const span = hero.offsetHeight - innerHeight; return span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0; };
    const F = 0.035;
    const op = (p, a, b) => { if (p < a - F || p > b + F) return 0; const i = a <= 0 ? 1 : Math.min(1, (p - (a - F)) / F); const o = b >= 1 ? 1 : Math.min(1, (b + F - p) / F); return Math.max(0, Math.min(i, o)); };
    const paint = (p) => { for (const bd of bands) { const o = Math.round(op(p, bd.a, bd.b) * 100) / 100; if (o !== bd.o) { bd.el.style.opacity = o; bd.el.style.visibility = o ? "visible" : "hidden"; bd.o = o; }
      const mid = (bd.a + Math.min(bd.b, 1)) / 2; const y = bd.el.classList.contains("settle") ? Math.max(0, Math.round((bd.a + 0.06 - p) * 200)) : Math.round((p - mid) * -60);
      if (y !== bd.y) { bd.el.style.transform = `translateY(calc(-50% + ${y}px))`; bd.y = y; } } };
    const tick = () => {
      if (!alive) return;
      const p = prog(); if (p !== lastP) { paint(p); lastP = p; }
      if (!cueHidden && p > 0.02) { cue.style.opacity = 0; cueHidden = true; }
      if (!ready) { startImg.style.opacity = p < 0.55 ? 1 : Math.max(0, 1 - (p - 0.55) / 0.2); running = false; return; }
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
      ready = true; video.classList.add("ready"); startImg.style.opacity = 0; loaderBar.style.strokeDashoffset = 0; loaderText.textContent = "Klart";
      setTimeout(() => loader.classList.add("done"), 500); wake();
    };
    const load = async () => {
      if (videoBlobUrl) return attach(videoBlobUrl);
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 25000);
      try {
        const res = await fetch(VIDEO_SRC, { signal: ctrl.signal }); if (!res.ok || !res.body) throw new Error("video " + res.status);
        const total = +res.headers.get("content-length") || 0; const rd = res.body.getReader(); const chunks = []; let got = 0;
        for (;;) { const { done, value } = await rd.read(); if (done) break; chunks.push(value); got += value.length; if (total) loaderBar.style.strokeDashoffset = 1 - got / total; }
        clearTimeout(t); videoBlobUrl = URL.createObjectURL(new Blob(chunks, { type: "video/mp4" }));
        if (alive) await attach(videoBlobUrl);
      } catch (e) { clearTimeout(t); videoFailed = true; if (alive) { goStatic(); paint(1); } }
    };

    // dust and motes, whisper level
    const dust = (canvas, opts) => {
      if (!canvas || mq("(prefers-reduced-motion: reduce)")) return;
      const cx = canvas.getContext("2d"); let w, h, motes = [], vis = true, raf = 0;
      const size = () => { const d = Math.min(2, devicePixelRatio || 1); w = canvas.clientWidth; h = canvas.clientHeight; canvas.width = w * d; canvas.height = h * d; cx.setTransform(d, 0, 0, d, 0, 0);
        motes = Array.from({ length: opts.count }, () => ({ x: Math.random() * w, y: Math.random() * h, r: 0.4 + Math.random() * 1.3, vx: (Math.random() - 0.3) * 0.12, vy: -0.03 - Math.random() * 0.1, t: Math.random() * 6.28 })); };
      const draw = () => { if (!alive) return; cx.clearRect(0, 0, w, h); for (const m of motes) { m.x += m.vx; m.y += m.vy; m.t += 0.01; if (m.y < -4) m.y = h + 4; if (m.x > w + 4) m.x = -4; if (m.x < -4) m.x = w + 4;
          const a = opts.alpha(m.x / w, m.y / h) * (0.55 + 0.45 * Math.sin(m.t)); if (a <= 0.01) continue; cx.beginPath(); cx.arc(m.x, m.y, m.r, 0, 6.283); cx.fillStyle = `rgba(${opts.rgb},${a})`; cx.fill(); }
        raf = vis ? requestAnimationFrame(draw) : 0; };
      size(); on(window, "resize", size, { passive: true });
      const ob = new IntersectionObserver(([e]) => { vis = e.isIntersecting; if (vis && !raf) raf = requestAnimationFrame(draw); }); ob.observe(canvas); off.push(() => ob.disconnect());
    };


    off.push(RQ.journey.mount(root));
    if (RQ.svepHome) off.push(RQ.svepHome.mount(root));

    // waiting list
    const form = $("#signup", root), err = $("#formErr", root), btn = form.querySelector("button");
    on(form, "submit", async (e) => {
      e.preventDefault(); const v = form.email.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { err.textContent = "Skriv en e-postadress, till exempel namn@exempel.se."; form.email.focus(); return; }
      err.textContent = "";
      btn.disabled = true; btn.textContent = "Skickar…";
      const res = await RQ.subscribe({ email: v, lista: "Väntelista" });
      if (res === "error") { btn.disabled = false; btn.textContent = "Skriv upp mig"; err.textContent = "Det gick inte att skicka just nu. Försök igen om en stund."; return; }
      if (res === "preview") $("#okText", root).textContent = "Förhandsversion: adressen sparas inte här. På den riktiga sajten hamnar du på listan.";
      $("#formBox", root).classList.add("sent");
    });

    const onScroll = () => { wake(); RQ.navCheck(); };
    on(window, "scroll", onScroll, { passive: true });
    on(window, "resize", () => { lastP = -1; onScroll(); }, { passive: true });
    if (isStatic) paint(1);
    else { paint(prog()); dust($("#dust", root), { count: 60, rgb: "255,244,222", alpha: (x, y) => Math.max(0, 1 - Math.abs(x - (0.7 - y * 0.35)) * 3.2) * 0.55 }); load(); wake(); }

    return () => { alive = false; off.forEach((f) => f()); html.classList.remove("static"); };
  }
})();
