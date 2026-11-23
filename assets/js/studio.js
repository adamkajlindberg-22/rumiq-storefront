/* RumIQ Studio: tools that help people choose. Everything runs in the browser.
   No photo leaves the device. Where a tool uses rules instead of an AI service, it says so. */
(function () {
  const RQ = window.RQ, S = RQ.shop, V = RQ.views, $ = RQ.$, $$ = RQ.$$, esc = RQ.esc, I = RQ.I, kr = S.kr;
  const crumbs = (last, parent = ["Mitt rum", "mitt-rum"]) => RQ.crumbs([["Hem", "hem"], parent, [last]]);
  const icon = (k) => `<span class="ic">${I[k]}</span>`;
  const priceOk = (p, max) => !max || p.price <= max;

  /* colour helpers */
  const hex2rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgb2hex = (r, g, b) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const toHsl = ([r, g, b]) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return [h, s, l]; };

  /* answers you choose with a picture: a room photo for the room, a product for what you need */
  const pimg = (h) => `assets/img/p/${h}-600.webp`;
  const NEED_IMG = { forvaring: "flatad-forvaringskorg", ljus: "lysa-keramiklampa", detaljer: "sand-keramikvas", rutiner: "tvalpump-stengods" };
  const FOR_IMG = { van: "svamp-uppladdningsbar-lampa", familj: "forradsburkar-glas-ek-3-pack", vard: "glod-doftljus-keramik" };
  const OCC_IMG = { inflyttning: "terrakottakruka-rafflad", fodelsedag: "sand-keramikvas", jul: "stilla-ljusstake-massing-2-pack", tack: "plad-ullblandning-havre" };
  const picOpts = (q, list, label) => `<div class="imgopts pick" data-q="${q}" role="group" aria-label="${esc(label)}">${list.map(([v, t, img]) => `<button type="button" data-v="${v}" aria-pressed="false"><img src="${img}" alt="" loading="lazy" width="600" height="750"><span>${esc(t)}</span></button>`).join("")}</div>`;
  const roomOpts = () => picOpts("room", RQ.ROOMS.map((r) => [r.id, r.name, `assets/img/rum/${r.id}-600.webp`]), "Vilket rum?");

  /* ---------------------------------------------------------------- Hitta rätt
     One helper instead of four: the home guide, the gift guide and "in your own words" share one page
     with tabs; the AI stylist is one tap away. The old addresses open the matching tab. */
  const FR = [["", "Till mitt hem"], ["present", "Som present"], ["ord", "Med egna ord"]];
  V.findRight = (mode = "") => {
    const inner = mode === "present" ? V.giftFinder() : mode === "ord" ? V.studioSearch() : V.studioGuide();
    const body = inner.html.replace(/^\s*<header class="page-head[\s\S]*?<\/header>/, "");
    return {
      title: inner.title,
      html: `<header class="page-head wrap">${RQ.crumbs([["Hem", "hem"], ["Hitta rätt"]])}<h1 class="h1">Hitta rätt.</h1><p class="lead">Svara på några frågor eller beskriv med egna ord, så visar vi det som passar.</p>
        <nav class="fr-tabs" aria-label="Hur vill du hitta?">${FR.map(([m, t]) => `<a class="chip" href="#hitta-ratt${m ? "-" + m : ""}"${m === mode ? ' aria-current="true"' : ""}>${t}</a>`).join("")}<a class="fr-ai" href="#studio-stylist">${I.chat || ""}<span>Hellre prata? <b>Fråga stylisten</b></span></a></nav></header>
        ${body}`,
      mount: inner.mount,
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
    title: "Snabbval · Svep · RumIQ",
    html: `<header class="page-head wrap">${crumbs("Snabbval", ["Svep", "svep"])}<h1 class="h1">Fyra snabba val</h1><p class="lead">Ingen tid att svepa? Fyra val ger din stil, en färgpalett och förslag. Svaren hamnar i samma stilprofil som Svep.</p></header>
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
        if (RQ.taste && RQ.taste.boost) RQ.taste.boost(style, 3);
        $("#styleOut", root).innerHTML = RQ.styleResult(style, ans.room) + `<div class="ctrl-row" style="margin-top:1.6rem"><a class="btn" href="#mitt-hem">Sparad i Mitt hem</a><a class="btn ghost" href="#studio-stylist">Fråga stylisten</a></div>`;
        RQ.watch(root); $("#styleOut", root).scrollIntoView({ behavior: "smooth", block: "start" });
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

  const STARTERS = ["Mitt vardagsrum känns kalt, hur gör jag det mysigare?", "Jag behöver mjukare ljus vid läsfåtöljen", "Hur får jag en liten hall att kännas mer ordnad?", "Vad passar i ett litet sovrum?", "En present till en inflyttning under 500 kr"];
  V.studioStylist = () => {
    const mine = RQ.room && RQ.room.has() && RQ.room.get().type && RQ.roomById(RQ.room.get().type);
    const starters = [...(mine ? [`Vad saknas i mitt ${mine.name.toLowerCase()}?`] : []), ...STARTERS];
    return {
    title: "AI-stylist · Hitta rätt · RumIQ",
    html: `<header class="page-head wrap">${crumbs("AI-stylist", ["Hitta rätt", "hitta-ratt"])}<h1 class="h1">AI-stylist</h1><p class="lead">Beskriv ditt rum och vad du vill förändra. Du får praktiska råd och, när det passar, produkter ur sortimentet.</p></header>
      <section class="wrap tool-shell" style="padding-bottom:5rem">
        <div class="chat"><div class="log" id="log" aria-live="polite"><div class="msg ai">Hej! Vad vill du förändra hemma? Välj en fråga att börja med, eller skriv en egen.</div>
            <div class="starters" id="starters" role="group" aria-label="Frågor att börja med">${starters.map((q) => `<button class="chip" type="button" data-try="${esc(q)}">${esc(q)}</button>`).join("")}</div></div>
          <form id="chatForm"><label class="sr" for="chatIn">Din fråga</label><input id="chatIn" type="text" placeholder="Till exempel: mitt vardagsrum känns kalt" autocomplete="off" enterkeyhint="send"><button class="btn" type="submit">Fråga</button></form></div>
        <aside><div class="panel"><label>Högsta pris per produkt (kr, valfritt)<input type="number" id="maxP" min="0" step="50" inputmode="numeric" placeholder="Inget maxpris"></label></div>
          <p class="note">Råden är inspiration, inte verifierade produktuppgifter. I förhandsversionen bygger stylisten på regler och RumIQs sortiment, inte på en AI-tjänst.</p><p class="small" id="chatNote" style="margin-top:.8rem"></p><button class="link" type="button" id="chatClear" style="border:0;background:none;margin-top:.4rem;font-size:.88rem">Rensa samtalet</button></aside>
      </section>`,
    mount(root) {
      const log = $("#log", root), inp = $("#chatIn", root);
      const signed = !!S.customer();
      const load = () => { if (signed) return S.store.get("rumiq-chat-saved", []); try { return JSON.parse(RQ.ss.get("rumiq-chat") || "[]"); } catch (e) { return []; } };
      const save = (h) => (signed ? S.store.set("rumiq-chat-saved", h.slice(-40)) : RQ.ss.set("rumiq-chat", JSON.stringify(h.slice(-40))));
      let hist = load(); if (!Array.isArray(hist)) hist = [];
      const note = $("#chatNote", root); if (note) note.textContent = signed ? "Du är inloggad, så samtalet sparas i ditt konto. Du kan rensa det när du vill." : "Som gäst finns samtalet bara kvar i den här fliken. Logga in för att spara det.";
      const clr = $("#chatClear", root); if (clr) clr.addEventListener("click", () => { hist = []; save(hist); RQ.router(); });
      const add = (who, html) => { const d = document.createElement("div"); d.className = "msg " + who; d.innerHTML = html; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; };
      const prods = (a) => a.picks.map((x) => (typeof x === "string" ? RQ.byHandle(x) : x)).filter(Boolean);
      // after an answer: put the suggestions in your room, or ask for cheaper ones
      const follow = (a) => { const ps = prods(a); if (!ps.length) return ""; const low = Math.min(...ps.map((p) => p.price));
        return `<div class="follow"><button class="chip" type="button" data-inroom="${ps.map((p) => p.handle).join(",")}">Ställ in i mitt rum</button>${RQ.PRODUCTS.some((p) => p.price < low) ? `<button class="chip" type="button" data-cheaper="${low - 1}">Billigare förslag</button>` : ""}</div>`; };
      const answerHtml = (a) => { const ps = prods(a); return `${esc(a.text)}${ps.length ? `<div class="mini">${ps.map((p) => `<a href="#produkt-${p.handle}"><img src="${RQ.img(p, 600)}" alt="">${esc(p.name)}<br><b>${kr(p.price)}</b></a>`).join("")}</div>` : ""}${follow(a)}`; };
      hist.forEach((m) => add(m.who, m.who === "me" ? esc(m.text) : answerHtml(m.a)));
      const st = $("#starters", root); if (hist.length) st.remove();
      let last = hist.filter((m) => m.who === "me").map((m) => m.q || m.text).pop() || "";
      const ask = (text, opt = {}) => {
        if (!text.trim()) return; if (st.isConnected) st.remove();
        const q = opt.q || text; last = q;
        const me = add("me", esc(text)); const typing = add("ai", '<span class="typing"><i></i><i></i><i></i></span>');
        const a = RQ.stylistAnswer(q, opt.max || +$("#maxP", root).value || null);
        setTimeout(() => { typing.innerHTML = answerHtml(a); RQ.toHashLinks && RQ.toHashLinks(typing); log.scrollTop += me.getBoundingClientRect().top - log.getBoundingClientRect().top - 10; }, 700);
        hist.push({ who: "me", text, q }, { who: "ai", a: { text: a.text, picks: a.picks.map((p) => p.handle) } });
        save(hist);
      };
      $("#chatForm", root).addEventListener("submit", (e) => { e.preventDefault(); ask(inp.value); inp.value = ""; });
      log.addEventListener("click", (e) => {
        const t = e.target.closest("[data-try]"); if (t) { ask(t.dataset.try); return; }
        const c = e.target.closest("[data-cheaper]"); if (c) { ask(`Billigare förslag, högst ${kr(+c.dataset.cheaper)}`, { q: last || "detaljer", max: +c.dataset.cheaper }); return; }
        const r = e.target.closest("[data-inroom]"); if (!r) return;
        const hs = r.dataset.inroom.split(","), R = RQ.room;
        const put = () => { const n = hs.filter((h) => R.add(h, true)).length; RQ.toast(n ? `${n} ${n === 1 ? "sak står" : "saker står"} nu i ditt rum. <a href="#mitt-rum">Öppna</a>` : 'De står redan i ditt rum. <a href="#mitt-rum">Öppna</a>'); };
        if (R.has()) put(); else R.openSetup(put);
      });
    },
  }; };

  V.studioSearch = () => ({
    title: "Med egna ord · Hitta rätt · RumIQ",
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
    title: "Hitta rätt · RumIQ",
    html: `<header class="page-head wrap">${crumbs("Hitta ditt hemurval")}<h1 class="h1">Hitta ditt hemurval</h1><p class="lead">Vad skulle göra hemmet bättre? Välj ett rum och vad du behöver mest, så visar vi passande produkter ur sortimentet.</p></header>
      <section class="wrap quiz" style="padding-bottom:5rem">
        <div class="q"><h3>Vilket rum?</h3>${roomOpts()}</div>
        <div class="q"><h3>Vad behöver du mest?</h3>${picOpts("need", Object.entries(RQ.NEEDS).map(([k, v]) => [k, v, pimg(NEED_IMG[k])]), "Vad behöver du mest?")}</div>
        <div class="q"><label style="max-width:20rem">Högsta pris per produkt (kr, valfritt)<input type="number" id="gmax" min="0" step="50"></label></div>
        <button class="btn" type="button" id="gGo">Visa mitt hemurval</button><div id="gOut" style="margin-top:2.4rem"></div></section>`,
    mount(root) {
      const a = {};
      $$("[data-q]", root).forEach((g) => g.addEventListener("click", (e) => { const b = e.target.closest("[data-v]"); if (!b) return; const off = b.getAttribute("aria-pressed") === "true"; $$("[data-v]", g).forEach((x) => x.setAttribute("aria-pressed", !off && x === b)); a[g.dataset.q] = off ? null : b.dataset.v; }));
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

  /* ---------------------------------------------------------------- Presentguiden */
  V.giftFinder = () => ({
    title: "Som present · Hitta rätt · RumIQ",
    html: `<header class="page-head wrap">${RQ.crumbs([["Hem", "hem"], ["Butik", "butik"], ["Presentguiden"]])}<h1 class="h1">Presentguiden</h1><p class="lead">Svara på tre korta frågor och ange ett maxpris, så visar vi passande saker ur sortimentet.</p></header>
      <section class="wrap quiz" style="padding-bottom:5rem">
        <div class="q"><h3>Vem är presenten till?</h3>${picOpts("for", Object.entries(RQ.GIFT_FOR).map(([k, v]) => [k, v, pimg(FOR_IMG[k])]), "Vem är presenten till?")}</div>
        <div class="q"><h3>Tillfället</h3>${picOpts("occ", Object.entries(RQ.OCCASIONS).map(([k, v]) => [k, v, pimg(OCC_IMG[k])]), "Tillfället")}</div>
        <div class="q"><h3>Mottagarens stil <small>Hoppa över om du inte vet</small></h3>${picOpts("style", ["skandinavisk", "minimalistisk", "klassisk", "mjuk"].map((k) => [k, RQ.STYLES[k].name, STYLE_IMG[k]]), "Mottagarens stil")}</div>
        <div class="q"><label style="max-width:20rem">Högsta presentpris (kr)<input type="number" id="gfMax" min="0" step="50" value="800"></label></div>
        <div class="ctrl-row"><button class="btn" type="button" id="gfGo">Hitta en present</button><a class="btn ghost" href="#presentkort">Hellre ett presentkort</a></div><div id="gfOut" style="margin-top:2.4rem"></div></section>`,
    mount(root) {
      const a = {};
      $$("[data-q]", root).forEach((g) => g.addEventListener("click", (e) => { const b = e.target.closest("[data-v]"); if (!b) return; const off = b.getAttribute("aria-pressed") === "true"; $$("[data-v]", g).forEach((x) => x.setAttribute("aria-pressed", !off && x === b)); a[g.dataset.q] = off ? null : b.dataset.v; }));
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
      html: `<header class="page-head wrap">${RQ.crumbs([["Hem", "hem"], ["Mitt hem"]])}<span class="eyebrow" style="display:block;margin-top:1rem">Ditt privata bibliotek</span><h1 class="h1">Mitt hem</h1><p class="lead">Dina favoriter, rum och mått, din stil, rumsprojekt och looks, samlat på ett ställe så att du kan fortsätta där du slutade.</p>
          <div class="chips" style="margin-top:1.6rem"><a class="chip" href="#mh-fav">Favoriter (${wish.length})</a><a class="chip" href="#mh-matt">Mina rum och mått (${RQ.homeRooms ? RQ.homeRooms.list().length : 0})</a><a class="chip" href="#mh-stil">Min stil</a><a class="chip" href="#mh-rum">Rumsprojekt (${projects.length})</a><a class="chip" href="#mh-looks">Looks (${looks.length})</a><a class="chip" href="#mh-art">Artiklar (${arts.length})</a></div></header>
        <section class="wrap" style="padding-bottom:5rem;display:grid;gap:4rem">
          <div id="mh-fav"><div class="sec-row"><div class="sec-head"><span class="eyebrow">Favoriter</span></div>${wish.length ? `<span class="mh-favacts"><button class="btn ghost sm" type="button" data-share-wish><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v6h14v-6"/></svg><span>Dela listan</span></button><a class="link" href="#onskelista">Listor per rum</a></span>` : ""}</div>${wish.length && RQ.priceWatch ? RQ.priceWatch.html(wish.map((p) => p.handle), "mhw") : ""}${wish.length ? RQ.grid(wish) : `<div class="empty"><h3>Inga favoriter än</h3><p>Tryck på hjärtat på en produkt.</p></div>${RQ.svepNudge ? RQ.svepNudge() : ""}`}</div>
          ${RQ.homeRooms ? RQ.homeRooms.html() : ""}
          <div id="mh-stil"><div class="sec-head"><span class="eyebrow">Min stil</span></div>${style ? `<div class="result"><h2>${RQ.STYLES[style.style].name}</h2><p style="margin-top:.5rem">${RQ.STYLES[style.style].text}</p>${style.palette ? `<div class="palette">${style.palette.map((t) => `<i style="background:${t}"></i>`).join("")}</div>` : ""}${RQ.styleProfile && RQ.taste.get().n ? `<div class="sp-mix" style="max-width:30rem;margin-top:1rem">${RQ.styleProfile().mix.map((m) => `<div class="sp-row"><span>${esc(m.name)}</span><span class="sp-bar"><i style="width:${m.pct}%"></i></span><b>${m.pct} %</b></div>`).join("")}</div>` : ""}<p class="small">Uppdaterad ${new Date(style.at).toLocaleDateString("sv-SE")}.</p><div class="ctrl-row"><a class="btn sm" href="#svep">Svep mer</a><a class="btn ghost sm" href="#studio-stil">Fyra snabba val</a></div></div>` : `<div class="empty"><h3>Ingen stil sparad än</h3><p>Svep tio kort eller svara på fyra snabba frågor.</p><a class="btn ghost" href="#svep">Svep fram din stil</a></div>`}</div>
          <div id="mh-rum"><div class="sec-row"><div class="sec-head"><span class="eyebrow">Rumsprojekt</span></div>${projects.length > 1 ? `<button class="chip" type="button" id="cmpBtn">Jämför två sida vid sida</button>` : ""}</div>
            ${projects.length ? `<div class="cols3" id="projects">${projects.map((p) => `<article class="colcard" style="cursor:default"><div class="im" style="aspect-ratio:4/3"><img src="${p.img}" alt="${esc(p.title)}"></div><div class="tx"><label class="check" style="font-size:.85rem;margin-bottom:.6rem"><input type="checkbox" data-cmp="${p.id}"> Välj för jämförelse</label><h3 style="font-size:1.2rem">${esc(p.title)}</h3><p class="small">${new Date(p.at).toLocaleDateString("sv-SE")}</p><label style="margin-top:.8rem">Anteckning<textarea rows="2" data-note="${p.id}">${esc(p.note || "")}</textarea></label><div class="ctrl-row"><button class="btn sm" type="button" data-room-all="${(p.handles || []).join(",")}">Handla looken</button><button class="chip" type="button" data-del="${p.id}">Ta bort</button></div></div></article>`).join("")}</div><div id="cmpOut"></div>` : `<div class="empty"><h3>Inga rumsprojekt än</h3><p>Placera produkter i ett foto av ditt rum och spara resultatet här.</p><a class="btn ghost" href="#mitt-rum">Se det i ditt rum</a></div>`}</div>
          <div id="mh-looks"><div class="sec-head"><span class="eyebrow">Sparade looks</span></div>${looks.length ? looks.map((l) => `<div class="order"><header><b>${esc(l.name)}</b><span class="price" style="font-family:var(--mono)">${kr(l.handles.map(RQ.byHandle).filter(Boolean).reduce((s, p) => s + p.price, 0))}</span></header><div class="board">${l.handles.map(RQ.byHandle).filter(Boolean).map((p) => `<a class="slot" href="#produkt-${p.handle}"><img src="${RQ.img(p, 600)}" alt="${esc(p.name)}"></a>`).join("")}</div><div class="ctrl-row"><button class="btn sm" type="button" data-room-all="${l.handles.join(",")}">Se i mitt rum</button><button class="chip" type="button" data-dellook="${l.id}">Ta bort</button></div></div>`).join("") : `<div class="empty"><h3>Inga looks än</h3><p>Ställ in det du gillar i ditt rum och välj Spara som look, eller spara en färdig look.</p><a class="btn ghost" href="#mitt-rum">Till Mitt rum</a></div>`}</div>
          <div id="mh-art"><div class="sec-head"><span class="eyebrow">Sparade artiklar</span></div>${arts.length ? `<div class="mag-grid">${arts.map(RQ.magCard).join("")}</div>` : `<div class="empty"><h3>Inga sparade artiklar</h3><p>Spara en artikel i magasinet så hamnar den här.</p><a class="btn ghost" href="#magasin">Till magasinet</a></div>`}</div>
          <div class="panel"><h3 class="h3" style="font-size:1.2rem">Dina uppgifter</h3><p class="small" style="margin-top:.5rem">I förhandsversionen sparas allt i Mitt hem bara i den här webbläsaren. Inget skickas till oss. Du kan ta bort allt när du vill.</p><button class="btn ghost sm" type="button" id="clearAll" style="margin-top:1rem">Rensa allt sparat</button></div>
        </section>`,
      mount(root) {
        RQ.homeRooms && RQ.homeRooms.mount(root);
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
