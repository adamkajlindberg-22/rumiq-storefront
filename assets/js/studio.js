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
  // answers and the result are kept for this tab, so looking at a product and going back does not empty the page
  const keep = { get(k) { try { return JSON.parse(RQ.ss.get(k) || "null"); } catch (e) { return null; } }, set(k, v) { RQ.ss.set(k, JSON.stringify(v)); } };
  // after an answer the result is what you see: scrolled to under the header, with focus on its heading
  const showOut = (out) => { const h = out.querySelector("h2, h3, .eyebrow"); if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); } out.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); };
  const press = (root, q, v) => { const g = $(`[data-q="${q}"]`, root); if (g) $$("[data-v]", g).forEach((x) => x.setAttribute("aria-pressed", x.dataset.v === v)); };
  const maxOf = (el) => { const n = Math.floor(+String(el.value).replace(",", ".")); return n > 0 ? n : null; };
  const cheapest = (list) => (list.length ? Math.min(...list.map((p) => p.price)) : 0);
  const toneName = (hex) => { const c = hex2rgb(hex); return RQ.TONES.reduce((b, x) => (dist(hex2rgb(x.hex), c) < dist(hex2rgb(b.hex), c) ? x : b)).name; };

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
      <div class="palette">${tones.map((t) => `<i style="background:${t}"><span>${esc(toneName(t))}</span></i>`).join("")}</div>
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
    needs: { ljus: ["ljus", "lampa", "lampor", "mörkt", "mörk", "läsa", "läs", "belysning", "kväll", "mysig", "mysigt", "mysigare", "stämning", "light", "lamp", "lamps", "lighting", "dark", "reading", "read", "evening", "cosy", "cozy", "atmosphere"], forvaring: ["förvaring", "rörigt", "stökigt", "ordning", "plats", "organisera", "sladdar", "kablar", "liten", "litet", "storage", "messy", "cluttered", "tidy", "organise", "organize", "cables", "small"], detaljer: ["kalt", "kallt", "kall", "tomt", "tråkigt", "personligt", "personlighet", "detaljer", "inredning", "fint", "färg", "mysig", "mysigt", "mysigare", "varmt", "varmare", "bare", "empty", "boring", "personal", "details", "decor", "colour", "color", "warm", "warmer"], rutiner: ["enklare", "vardagen", "vardagslivet", "morgon", "rutin", "praktiskt", "smidigt", "ladda", "easier", "everyday", "morning", "routine", "practical", "charge", "charging"] },
    cats: { "belysning-atmosfar": ["lampa", "lampor", "ljus", "belysning", "doftljus", "ljusstake", "ljusstakar", "lamp", "lamps", "light", "lighting", "candle", "candles", "candlestick"], "sovrum-komfort": ["pläd", "filt", "ull", "mjuk", "mjukt", "påslakan", "sängkläder", "örngott", "throw", "blanket", "wool", "soft", "bedding", "duvet"], "hem-inredning": ["kudde", "kuddar", "vas", "inredning", "gardin", "gardiner", "matta", "mattor", "cushion", "cushions", "vase", "decor", "curtain", "curtains", "rug"], "kok-matplats": ["burk", "burkar", "bräda", "skärbräda", "kök", "jar", "jars", "board", "kitchen"], "forvaring-organisering": ["korg", "låda", "förvaring", "basket", "box", "storage"], "badrum-valmaende": ["handduk", "handdukar", "tvål", "badrum", "towel", "towels", "soap", "bathroom"], "tavlor-vaggar": ["tavla", "tavlor", "affisch", "affischer", "poster", "konst", "vägg", "väggen", "ram", "art", "print", "wall", "frame"], uteliv: ["kruka", "växt", "ute", "balkong", "pot", "plant", "plants", "balcony"] },
    styles: { skandinavisk: ["skandinavisk", "nordisk", "ljust", "naturligt", "scandinavian", "nordic", "natural"], minimalistisk: ["minimalistisk", "enkelt", "rent", "avskalat", "lugnt", "minimalist", "minimal", "simple", "clean", "calm"], klassisk: ["klassisk", "tidlös", "classic", "timeless"], mjuk: ["mysig", "mysigt", "mysigare", "ombonat", "mjukt", "varmt", "varmare", "cosy", "cozy", "soft", "warm"] },
    colors: { "#A9B39A": ["grön", "salvia", "green", "sage"], "#F2EFE9": ["vit", "vitt", "white"], "#3A3936": ["grafit", "svart", "mörk", "graphite", "black", "dark"], "#B8714A": ["terrakotta", "rost", "terracotta", "rust"], "#D8C6A8": ["beige", "havre", "sand", "oat"], "#B88A5A": ["ek", "trä", "oak", "wood", "wooden"] },
  };
  // every word the rules know, to catch small typos ("lmpa" is read as "lampa")
  const VOCAB = [...new Set(Object.values(LEX).flatMap((m) => Object.values(m).flat()).filter((w) => w.length >= 4 && !w.includes(" ")))];
  const lev = (a, b) => { if (Math.abs(a.length - b.length) > 2) return 9; const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1), i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1] ? d[i - 2][j - 2] + 1 : 9); return d[a.length][b.length]; };
  const nameWords = (p) => S.norm(p.name).split(/[^a-zåäö]+/).filter((w) => w.length >= 4);
  const sameEnd = (a, b) => { let n = 0; while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++; return n; };
  const sameStart = (a, b) => { let n = 0; while (n < a.length && n < b.length && a[n] === b[n]) n++; return n; };
  // "lampa" names "Glob bordslampa", "matta" names "Strand jutematta", "kudde" names "Lin kuddfodral"
  const namesIt = (p, w) => nameWords(p).some((n) => (w.length === 3 ? n.endsWith(w) : n.includes(w) || w.includes(n) || sameEnd(n, w) >= 5 || (sameStart(n, w) >= 4 && Math.min(n.length, w.length) <= sameStart(n, w) + 2)));
  const subseq = (a, b) => { let i = 0; for (const c of b) if (c === a[i]) i++; return i === a.length; }; // a inside b, in order
  const SMALL = new Set(["något", "någon", "några", "till", "från", "under", "över", "inte", "utan", "eller", "också", "bara", "lite", "mycket", "mest", "helst", "gärna", "vill", "skulle", "behöver", "söker", "letar", "efter", "finns", "har", "med", "och", "för", "som", "den", "det", "min", "mitt", "mina", "vår", "vårt", "kronor", "present", "saker", "sak", "rum", "rummet", "hemma", "hem", "bra", "fin", "fint", "snygg", "snyggt", "passar", "högst", "max", "billig", "billigt", "ungefär", "att", "jag", "kan", "ska", "vad", "hur", "var", "nya", "nytt", "stor", "små", "mer", "ett", "två", "tre", "vid", "ute", "inne", "hej", "hallå", "tack", "känns", "blir", "göra", "får", "ser", "litet", "liten", "någonting"]);
  RQ.parseNeed = (text) => {
    const fixed = [];
    const words = S.norm(text).replace(/[.,!?;:()"]/g, " ").split(/\s+/).filter(Boolean).map((w) => {
      if (w.length < 4 || /\d/.test(w) || SMALL.has(w) || VOCAB.includes(w) || VOCAB.some((v) => v.length >= 4 && w.includes(v))) return w;
      if (RQ.PRODUCTS.some((p) => namesIt(p, w))) return w;
      // short words only when a letter is missing or two have swapped places ("lmpa"), never one letter for another ("kall" is not "hall")
      const near = VOCAB.map((v) => [v, lev(w, v)]).filter((x) => (w.length >= 8 ? x[1] <= 2 : w.length >= 5 ? x[1] <= 1 : x[1] === 1 && (subseq(w, x[0]) || [...w].sort().join("") === [...x[0]].sort().join("")))).sort((a, b) => a[1] - b[1])[0];
      if (near) { fixed.push([w, near[0]]); return near[0]; }
      return w;
    });
    const t = " " + words.join(" ") + " ";
    const hit = (list) => list.some((w) => t.includes(" " + w + " ") || t.includes(" " + w) || (w.length >= 4 && t.includes(w)));
    const pick = (map) => Object.keys(map).filter((k) => hit(map[k]));
    const priceM = t.match(/(?:under|max|högst|mindre än|budget|below|less than|up to)\s*(\d[\d\s]{1,6})/) || t.match(/(\d[\d\s]{1,6})\s*(?:kr|kronor|:-|sek)/);
    const named = words.filter((w) => w.length >= 3 && !SMALL.has(w) && !/\d/.test(w));
    return { rooms: pick(LEX.rooms), needs: pick(LEX.needs), cats: pick(LEX.cats), styles: pick(LEX.styles), colors: pick(LEX.colors), max: priceM ? parseInt(priceM[1].replace(/\s/g, ""), 10) : null, gift: hit(["present", "presenter", "ge bort", "inflyttning", "värdinna", "gift", "gifts", "housewarming", "host"]), named, fixed, words };
  };
  RQ.rank = (q, max) => {
    const all = RQ.PRODUCTS.filter((p) => priceOk(p, max || q.max)).map((p) => {
      let s = 0; const why = [];
      if ((q.named || []).some((w) => namesIt(p, w))) { s += 6; why.push("det du nämnde"); } // the thing itself beats everything that only suits
      q.rooms.forEach((r) => { if (p.rooms.includes(r)) { s += 3; why.push("passar i " + RQ.roomById(r).name.toLowerCase()); } });
      q.cats.forEach((c) => { if (p.cat === c) { s += 4; why.push(RQ.catById(c).name.toLowerCase()); } });
      q.needs.forEach((n) => { if (p.needs.includes(n)) { s += 2; why.push(RQ.NEEDS[n].toLowerCase()); } });
      q.styles.forEach((st) => { if (p.styles.includes(st)) { s += 1.5; why.push(RQ.STYLES[st].name.toLowerCase() + " stil"); } });
      q.colors.forEach((c) => { if (p.tone.some((t) => dist(hex2rgb(t), hex2rgb(c)) < 60)) { s += 2; why.push("färgen"); } });
      if (q.gift && p.gift.length) { s += 2; why.push("bra present"); }
      return { p, s, why: [...new Set(why)] };
    }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.p.price - b.p.price);
    // weak hits (one loose colour match next to something that fits in three ways) are left out
    const top = all.length ? all[0].s : 0;
    return all.filter((x) => x.s >= top * 0.4);
  };

  const ADVICE = {
    ljus: "Börja med ljuset. Släck taklampan på kvällen och arbeta med två eller tre lampor på olika höjd, med varmvitt ljus runt 2 700 K. En lampa med opal- eller textilskärm sprider ljuset mjukt utan att blända.",
    forvaring: "Ge varje sak en fast plats. Korgar och lådor med mjuka material gör att förvaringen kan stå framme utan att det ser rörigt ut, och tio saker i en korg ser ut som en.",
    detaljer: "Lägg till textur i stället för fler saker: en pläd i ull, kuddar i lin och något i keramik. Tre olika ytor i ett rum, något slätt, något vävt och något mjukt, gör det varmare direkt.",
    rutiner: "Gör det du gör varje dag enklare: en fast plats för laddningen, saker du använder ofta inom räckhåll och samma material i det som står framme.",
  };
  const ROOM_ADVICE = { hall: "I en liten hall gör en spegel stor skillnad, den fångar ljuset och gör utrymmet större. Ge varje person en egen låda för vantar och mössor.", kok: "Ställ fram det du använder dagligen och ställ undan resten. Samma material på lock och brädor gör bänken lugnare.", badrum: "Häll över tvålen i en pump i stengods och välj två handdukstoner som går ihop, till exempel vit och sand.", hemmakontor: "Dölj grenuttaget och ge telefonen en egen plats. Det tar bort det mesta av röran.", sovrum: "Ett lågt, varmt ljus vid sängen och lådor med lock gör sovrummet lugnt även när det inte är städat.", uteliv: "En sladdlös lampa kan följa med ut på kvällen, och terrakotta passar växter som vill torka upp mellan vattningarna.", vardagsrum: "Flytta in möblerna lite från väggarna, tänd lampor på olika höjd och låt en pläd binda ihop soffan med resten av rummet." };
  // questions about buying, not about decorating: the stylist does not guess, it points at the page that knows
  const HELP = [
    [["frakt", "leverans", "levereras", "leverera", "fraktkostnad", "paketet", "shipping", "delivery"], "frakt", "Frakt och leverans", "Frakt och leverans kan jag inte svara säkert på."],
    [["retur", "returnera", "ångra", "ångerrätt", "öppet köp", "skicka tillbaka", "pengarna tillbaka", "return", "refund"], "returer", "Returer och återbetalning", "Returer kan jag inte svara säkert på."],
    [["betala", "betalning", "betalar", "klarna", "swish", "faktura", "delbetal", "payment"], "betalning", "Betalning", "Betalning kan jag inte svara säkert på."],
    [["beställning", "min order", "spåra", "kundservice", "kundtjänst", "reklamation", "reklamera", "garanti", "trasig", "kontakta"], "kontakt", "Kontakt", "Det där hjälper kundservice dig bäst med."],
  ];
  // work the shop does not do: say so before suggesting things that suit the room
  const CRAFT = ["måla", "målar", "målarfärg", "tapet", "tapetsera", "renovera", "renovering", "kakel", "snickra", "bygga", "elektriker", "paint", "wallpaper", "renovate"];
  RQ.stylistAnswer = (text, max) => {
    const q = RQ.parseNeed(text); if (max) q.max = max;
    const t = " " + q.words.join(" ") + " ";
    const has = (list) => list.some((w) => t.includes(" " + w));
    const help = HELP.find((h) => has(h[0]));
    const namedHit = q.named.some((w) => RQ.PRODUCTS.some((p) => namesIt(p, w)));
    const known = q.rooms.length || q.needs.length || q.cats.length || q.styles.length || q.colors.length || q.gift || namedHit;
    const helpOut = help ? { route: help[1], label: help[2] } : null;
    // not understood: no advice pulled from a hat and no products that only look like an answer
    if (!known) return { q: text, text: [help ? help[3] + " Det står här:" : "Det där kan jag inte svara på än. Jag kan hjälpa dig med ljus, förvaring, detaljer och presenter, rum för rum."], picks: [], help: helpOut, unknown: !help, cheaper: null };
    const parts = [], craft = has(CRAFT);
    if (craft) parts.push("Måla, tapetsera och renovera kan jag inte ge råd om. Men jag kan föreslå saker som passar i rummet.");
    // asked for a thing we only have relatives of ("golvlampa" when there are table lamps): say that first
    const exact = (w) => RQ.PRODUCTS.some((p) => nameWords(p).some((n) => n.includes(w) || (sameStart(n, w) >= 4 && sameStart(n, w) >= Math.min(n.length, w.length) - 2)));
    const miss = q.named.find((w) => w.length >= 7 && !exact(w) && RQ.PRODUCTS.some((p) => namesIt(p, w)));
    if (miss) parts.push(`Just ”${miss}” har vi inte i sortimentet än. Det här ligger närmast.`);
    // one piece of advice at a time, so the answer stays short: what you asked for first, otherwise the room
    if (q.needs[0] && !craft && !miss) parts.push(ADVICE[q.needs[0]]);
    else if (q.rooms[0] && ROOM_ADVICE[q.rooms[0]]) parts.push(ROOM_ADVICE[q.rooms[0]]);
    if (!parts.length) parts.push(q.gift ? "Här är saker som brukar bli uppskattade att få." : "Det här ur sortimentet passar det du beskriver.");
    const ranked = RQ.rank(q).slice(0, 3), picks = ranked.map((x) => x.p);
    if (!ranked.length) { const any = RQ.rank({ ...q, max: null }); parts.push(q.max && any.length ? `Jag hittar inget under ${kr(q.max)} som passar. Det billigaste kostar ${kr(cheapest(any.map((x) => x.p)))}.` : "Jag hittar inget i sortimentet som passar just det."); }
    if (help) parts.push(help[3] + " Det står här:");
    // "Billigare förslag" is only offered when there really is something cheaper that fits
    const low = picks.length ? Math.min(...picks.map((p) => p.price)) : 0;
    return { q: text, text: parts, picks, help: helpOut, unknown: false, cheaper: low && RQ.rank(q, low - 1).length ? low - 1 : null };
  };

  const STARTERS = ["Mitt vardagsrum känns kalt, hur gör jag det mysigare?", "Jag behöver mjukare ljus vid läsfåtöljen", "Hur får jag en liten hall att kännas mer ordnad?", "Vad passar i ett litet sovrum?", "En present till en inflyttning under 500 kr"];
  V.studioStylist = () => {
    const mine = RQ.room && RQ.room.has() && RQ.room.get().type && RQ.roomById(RQ.room.get().type);
    const starters = [...(mine ? [`Vad saknas i mitt ${mine.name.toLowerCase()}?`] : []), ...STARTERS];
    return {
    title: "Stylisten · Hitta rätt · RumIQ",
    html: `<header class="page-head wrap stylist-head">${crumbs("Stylisten", ["Hitta rätt", "hitta-ratt"])}<h1 class="h1">Fråga stylisten</h1><p class="lead">Beskriv ditt rum och vad du vill förändra. Du får praktiska råd och, när det passar, produkter ur sortimentet.</p></header>
      <section class="wrap tool-shell" style="padding-bottom:5rem">
        <div class="chat" id="chat"><div class="log" id="log" aria-live="polite"><div class="msg ai">Hej! Vad vill du förändra hemma? Välj en fråga att börja med, eller skriv en egen. Jag svarar med enkla regler och RumIQs sortiment, inte med en AI-tjänst än.</div>
            <div class="starters" id="starters" role="group" aria-label="Frågor att börja med">${starters.map((q) => `<button class="chip" type="button" data-try="${esc(q)}">${esc(q)}</button>`).join("")}</div></div>
          <form id="chatForm"><label class="sr" for="chatIn">Din fråga</label><input id="chatIn" type="text" placeholder="Till exempel: mitt vardagsrum känns kalt" autocomplete="off" enterkeyhint="send" maxlength="400"><button class="btn" type="submit">Fråga</button></form></div>
        <aside><div class="panel"><label>Högsta pris per produkt (kr, valfritt)<input type="number" id="maxP" min="1" step="50" inputmode="numeric" placeholder="Inget maxpris"></label></div>
          <p class="note">Råden är inspiration, inte verifierade produktuppgifter.</p><p class="small" id="chatNote" style="margin-top:.8rem"></p><button class="link" type="button" id="chatClear" style="border:0;background:none;margin-top:.4rem;font-size:.88rem">Rensa samtalet</button></aside>
      </section>`,
    mount(root) {
      const log = $("#log", root), inp = $("#chatIn", root), chat = $("#chat", root);
      // the conversation fills what is left of the screen, so the field you write in is always in view
      const fit = () => chat.style.setProperty("--chat-top", Math.round(chat.getBoundingClientRect().top + scrollY) + "px");
      fit(); addEventListener("resize", fit);
      const signed = !!S.customer();
      const load = () => { if (signed) return S.store.get("rumiq-chat-saved", []); try { return JSON.parse(RQ.ss.get("rumiq-chat") || "[]"); } catch (e) { return []; } };
      const save = (h) => (signed ? S.store.set("rumiq-chat-saved", h.slice(-40)) : RQ.ss.set("rumiq-chat", JSON.stringify(h.slice(-40))));
      let hist = load(); if (!Array.isArray(hist)) hist = [];
      hist = hist.filter((m) => m && (m.who === "me" ? typeof m.text === "string" : m.a && Array.isArray(m.a.picks)));
      const note = $("#chatNote", root); if (note) note.textContent = signed ? "Du är inloggad, så samtalet sparas i ditt konto. Du kan rensa det när du vill." : "Som gäst finns samtalet bara kvar i den här fliken. Logga in för att spara det.";
      let armed = false;
      const clr = $("#chatClear", root); if (clr) clr.addEventListener("click", () => { if (hist.length && !armed) { armed = true; clr.textContent = "Tryck igen för att rensa samtalet"; return; } hist = []; save(hist); RQ.router(); });
      const add = (who, html) => { const d = document.createElement("div"); d.className = "msg " + who; d.innerHTML = html; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; };
      const prods = (a) => a.picks.map((x) => (typeof x === "string" ? RQ.byHandle(x) : x)).filter(Boolean);
      // after an answer: put the suggestions in your room, or ask for cheaper ones
      const follow = (a) => { const ps = prods(a); if (!ps.length) return "";
        return `<div class="follow"><button class="chip" type="button" data-inroom="${ps.map((p) => p.handle).join(",")}">Ställ in i mitt rum</button>${a.cheaper ? `<button class="chip" type="button" data-cheaper="${+a.cheaper}" data-q="${esc(a.q || "")}">Billigare förslag</button>` : ""}</div>`; };
      const answerHtml = (a) => { const ps = prods(a), text = Array.isArray(a.text) ? a.text : [a.text];
        return `${text.map((p) => `<p>${esc(p)}</p>`).join("")}${a.help ? `<p><a class="msg-help" href="#${esc(a.help.route)}">${esc(a.help.label)}</a></p>` : ""}${a.unknown ? `<div class="follow">${starters.slice(0, 2).map((q) => `<button class="chip" type="button" data-try="${esc(q)}">${esc(q)}</button>`).join("")}<a class="chip" href="#kontakt">Kontakta oss</a></div>` : ""}${ps.length ? `<div class="mini">${ps.map((p) => `<a href="#produkt-${p.handle}"><img src="${RQ.img(p, 600)}" alt="" loading="lazy" width="600" height="750"><span>${esc(p.name)}</span><b>${kr(p.price)}</b></a>`).join("")}</div>` : ""}${follow(a)}`; };
      hist.forEach((m) => add(m.who, m.who === "me" ? esc(m.text) : answerHtml(m.a)));
      const st = $("#starters", root); if (hist.length) st.remove();
      let busy = false;
      const ask = (text, opt = {}) => {
        if (busy) return; // one question at a time
        if (!text.trim()) { inp.focus(); return; } if (st.isConnected) st.remove();
        busy = true; armed = false; if (clr) clr.textContent = "Rensa samtalet";
        const q = opt.q || text;
        const me = add("me", esc(text)); const typing = add("ai", '<span class="typing"><i></i><i></i><i></i></span>');
        const a = RQ.stylistAnswer(q, opt.max || maxOf($("#maxP", root)));
        const stored = { q, text: a.text, picks: a.picks.map((p) => p.handle), help: a.help, unknown: a.unknown, cheaper: a.cheaper };
        setTimeout(() => { busy = false; if (!typing.isConnected) return; typing.innerHTML = answerHtml(stored); RQ.toHashLinks && RQ.toHashLinks(typing); log.scrollTop += me.getBoundingClientRect().top - log.getBoundingClientRect().top - 10; }, 700);
        hist.push({ who: "me", text, q }, { who: "ai", a: stored });
        save(hist);
      };
      $("#chatForm", root).addEventListener("submit", (e) => { e.preventDefault(); if (busy) return; const v = inp.value; inp.value = ""; ask(v); });
      log.addEventListener("click", (e) => {
        const t = e.target.closest("[data-try]"); if (t) { ask(t.dataset.try); return; }
        const c = e.target.closest("[data-cheaper]"); if (c) { ask(`Billigare förslag, högst ${kr(+c.dataset.cheaper)}`, { q: c.dataset.q || "detaljer", max: +c.dataset.cheaper }); return; }
        const r = e.target.closest("[data-inroom]"); if (!r) return;
        const hs = r.dataset.inroom.split(","), R = RQ.room;
        const put = () => { const n = hs.filter((h) => R.add(h, true)).length; RQ.toast(n ? `${n} ${n === 1 ? "sak står" : "saker står"} nu i ditt rum. <a href="#mitt-rum">Öppna</a>` : 'De står redan i ditt rum. <a href="#mitt-rum">Öppna</a>'); };
        if (R.has()) put(); else R.openSetup(put);
      });
      return () => removeEventListener("resize", fit);
    },
  }; };

  V.studioSearch = () => ({
    title: "Med egna ord · Hitta rätt · RumIQ",
    html: `<header class="page-head wrap">${crumbs("Smart sökning")}<h1 class="h1">Smart sökning</h1><p class="lead">Beskriv i en mening vad du behöver, med egna ord. Rum, färg, stil och maxpris förstår vi.</p></header>
      <section class="wrap" style="padding-bottom:5rem"><form id="ssForm" class="ss-form" novalidate><label for="ssIn">Vad letar du efter?</label><div class="field"><input id="ssIn" autocomplete="off" enterkeyhint="search" placeholder="Till exempel: något grönt och mjukt till soffan under 300 kr"><button class="btn" type="submit">Sök</button></div></form>
        <div class="chips" style="margin-top:1rem">${["Mjukt ljus till sovrummet", "Ordning i hallen under 400 kr", "Något i ek till köket", "Present till en värd"].map((s) => `<button class="chip" type="button" data-ss="${s}">${s}</button>`).join("")}</div>
        <p class="note">I förhandsversionen tolkas meningen med regler mot RumIQs sortiment, inte av en AI-tjänst.</p>
        <div id="ssOut" style="margin-top:2.4rem"></div></section>`,
    mount(root) {
      const out = $("#ssOut", root), inp = $("#ssIn", root);
      const run = (text, show) => {
        if (!text.trim()) { out.innerHTML = ""; inp.focus(); return; } // nothing asked: nothing to say "not found" about
        keep.set("rumiq-ord", text);
        const q = RQ.parseNeed(text); const r = RQ.rank(q);
        const understood = [...q.rooms.map((x) => RQ.roomById(x).name), ...q.cats.map((x) => RQ.catById(x).name), ...q.needs.map((x) => RQ.NEEDS[x]), ...q.styles.map((x) => RQ.STYLES[x].name), ...(q.max ? ["Högst " + kr(q.max)] : []), ...(q.gift ? ["Present"] : [])];
        const read = q.fixed.length ? `<p class="small ss-read">${q.fixed.map(([a, b]) => `<span>Vi läste</span> ”${esc(a)}” <span>som</span> ”${esc(b)}”.`).join(" ")}</p>` : "";
        const under = q.max && !r.length && RQ.rank({ ...q, max: null }).length; // something fits, but nothing that cheap
        out.innerHTML = `${understood.length ? `<p class="eyebrow" style="margin-bottom:.8rem">Det här förstod vi</p><div class="chips" style="margin-bottom:${read ? ".8rem" : "2rem"}">${understood.map((u) => `<span class="chip on">${esc(u)}</span>`).join("")}</div>` : ""}${read}
          ${r.length ? `<div class="grid three">${r.slice(0, 9).map((x) => RQ.card(x.p).replace("</article>", `<p class="small" style="margin-top:.3rem">Matchar: ${esc(x.why.slice(0, 3).join(", "))}</p></article>`)).join("")}</div>`
            : under ? `<div class="empty"><h3><span>Inget under</span> ${kr(q.max)}</h3><p><span>Det billigaste som passar kostar</span> ${kr(cheapest(RQ.rank({ ...q, max: null }).map((x) => x.p)))}.</p><button class="btn ghost" type="button" id="ssNoMax">Visa utan maxpris</button></div>`
            : `<div class="empty"><h3>Vi hittade inget som matchar</h3><p>Prova att nämna ett rum, en sak eller vad du vill uppnå. Eller fråga stylisten.</p><a class="btn ghost" href="#studio-stylist">Fråga stylisten</a></div>`}`;
        const nm = $("#ssNoMax", out); if (nm) nm.addEventListener("click", () => { const t = text.replace(/(?:under|max|högst|mindre än)\s*\d[\d\s]*(?:kr|kronor|:-)?/i, "").replace(/\d[\d\s]*(?:kr|kronor|:-)/i, "").trim(); inp.value = t; run(t, true); });
        RQ.watch(root); RQ.markImages && RQ.markImages(out);
        if (show) showOut(out);
      };
      $("#ssForm", root).addEventListener("submit", (e) => { e.preventDefault(); run(inp.value, true); });
      $$("[data-ss]", root).forEach((b) => b.addEventListener("click", () => { inp.value = b.dataset.ss; run(b.dataset.ss, true); }));
      const was = keep.get("rumiq-ord"); if (typeof was === "string" && was) { inp.value = was; run(was, false); }
    },
  });

  /* ---------------------------------------------------------------- Hitta ditt hemurval */
  const softWrap = (s) => s.replace("Inredningsdetaljer", "Inrednings\u00addetaljer");
  V.studioGuide = () => ({
    title: "Hitta rätt · RumIQ",
    html: `<header class="page-head wrap">${crumbs("Hitta ditt hemurval")}<h1 class="h1">Hitta ditt hemurval</h1><p class="lead">Vad skulle göra hemmet bättre? Välj ett rum och vad du behöver mest, så visar vi passande produkter ur sortimentet.</p></header>
      <section class="wrap quiz" style="padding-bottom:5rem">
        <div class="q" id="gQ1"><h3><span class="q-n">1</span>Vilket rum?</h3>${roomOpts()}</div>
        <div class="q" id="gQ2"><h3><span class="q-n">2</span>Vad behöver du mest?</h3>${picOpts("need", Object.entries(RQ.NEEDS).map(([k, v]) => [k, softWrap(v), pimg(NEED_IMG[k])]), "Vad behöver du mest?")}</div>
        <div class="q q-max"><label>Högsta pris per produkt (kr, valfritt)<input type="number" id="gmax" min="1" step="50" inputmode="numeric" placeholder="Inget maxpris"></label><button class="btn" type="button" id="gGo">Visa mitt hemurval</button></div>
        <div id="gOut" class="q-out"></div></section>`,
    mount(root) {
      const a = {}, out = $("#gOut", root), gmax = $("#gmax", root);
      const run = (show) => {
        if (!a.room || !a.need) { RQ.toast(a.room ? "Välj också vad du behöver mest." : a.need ? "Välj också ett rum." : "Välj både rum och behov."); const q = $(a.room ? "#gQ2" : "#gQ1", root); if (show && q) q.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
        const max = maxOf(gmax), r = RQ.roomById(a.room), rn = r.name.toLowerCase(), nn = RQ.NEEDS[a.need].toLowerCase();
        keep.set("rumiq-guide", { room: a.room, need: a.need, max });
        const fits = RQ.PRODUCTS.filter((p) => p.rooms.includes(a.room) && p.needs.includes(a.need)), list = fits.filter((p) => priceOk(p, max));
        const inRoom = RQ.PRODUCTS.filter((p) => p.rooms.includes(a.room)), extra = inRoom.filter((p) => !list.includes(p) && priceOk(p, max));
        const head = (text) => `<div class="result"><span class="eyebrow"><span>${esc(r.name)}</span> · <span>${RQ.NEEDS[a.need]}</span></span><h2 style="margin-top:.4rem">Ditt hemurval</h2><p style="margin-top:.6rem">${text}</p></div>`;
        const noMax = `<button class="btn ghost" type="button" id="gNoMax" style="margin-top:1.2rem">Visa utan maxpris</button>`;
        out.innerHTML = list.length
          ? `${head(esc(ADVICE[a.need]))}<div style="margin-top:2rem">${RQ.grid(list, "three")}</div>${extra.length ? `<div class="sec-head" style="margin:3rem 0 1.4rem"><span class="eyebrow"><span>Mer för</span> <span>${esc(rn)}</span></span></div>${RQ.grid(extra.slice(0, 3), "three")}` : ""}`
          // nothing for exactly this: say so, instead of advice about one thing above products for another
          : fits.length ? `${head(`<span>Inget under</span> ${kr(max)} <span>här. Det billigaste som passar kostar</span> ${kr(cheapest(fits))}.`)}${noMax}`
          : extra.length ? `${head(`<span>Vi har inget för just</span> <span>${esc(nn)}</span> <span>i</span> <span>${esc(rn)}</span> <span>än. Det här passar i rummet:</span>`)}<div style="margin-top:2rem">${RQ.grid(extra.slice(0, 6), "three")}</div>`
          : `${head(max && inRoom.length ? `<span>Inget under</span> ${kr(max)} <span>här. Det billigaste som passar kostar</span> ${kr(cheapest(inRoom))}.` : `<span>Vi har inget för</span> <span>${esc(rn)}</span> <span>än.</span>`)}${max && inRoom.length ? noMax : `<a class="btn ghost" href="#butik" style="margin-top:1.2rem">Se allt i butiken</a>`}`;
        const nm = $("#gNoMax", out); if (nm) nm.addEventListener("click", () => { gmax.value = ""; run(true); });
        RQ.watch(root); RQ.markImages && RQ.markImages(out);
        if (show) showOut(out);
      };
      $$("[data-q]", root).forEach((g) => g.addEventListener("click", (e) => {
        const b = e.target.closest("[data-v]"); if (!b) return; const off = b.getAttribute("aria-pressed") === "true";
        $$("[data-v]", g).forEach((x) => x.setAttribute("aria-pressed", !off && x === b)); a[g.dataset.q] = off ? null : b.dataset.v;
        // one answer leads to the next thing: the second question, then the result
        if (a.room && a.need) run(true); else if (!off && g.dataset.q === "room") $("#gQ2", root).scrollIntoView({ behavior: "smooth", block: "center" });
      }));
      $("#gGo", root).addEventListener("click", () => run(true));
      gmax.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); run(true); } });
      const was = keep.get("rumiq-guide");
      if (was && RQ.roomById(was.room) && RQ.NEEDS[was.need]) { a.room = was.room; a.need = was.need; press(root, "room", a.room); press(root, "need", a.need); if (was.max) gmax.value = was.max; run(false); }
    },
  });

  /* ---------------------------------------------------------------- Presentguiden */
  V.giftFinder = () => ({
    title: "Som present · Hitta rätt · RumIQ",
    html: `<header class="page-head wrap">${RQ.crumbs([["Hem", "hem"], ["Butik", "butik"], ["Presentguiden"]])}<h1 class="h1">Presentguiden</h1><p class="lead">Svara på tre korta frågor och ange ett maxpris, så visar vi passande saker ur sortimentet.</p></header>
      <section class="wrap quiz" style="padding-bottom:5rem">
        <div class="q" id="gfQ1"><h3><span class="q-n">1</span>Vem är presenten till?</h3>${picOpts("for", Object.entries(RQ.GIFT_FOR).map(([k, v]) => [k, v, pimg(FOR_IMG[k])]), "Vem är presenten till?")}</div>
        <div class="q" id="gfQ2"><h3><span class="q-n">2</span>Tillfället</h3>${picOpts("occ", Object.entries(RQ.OCCASIONS).map(([k, v]) => [k, v, pimg(OCC_IMG[k])]), "Tillfället")}</div>
        <div class="q"><h3><span class="q-n">3</span>Mottagarens stil <small>Hoppa över om du inte vet</small></h3>${picOpts("style", ["skandinavisk", "minimalistisk", "klassisk", "mjuk"].map((k) => [k, RQ.STYLES[k].name, STYLE_IMG[k]]), "Mottagarens stil")}</div>
        <div class="q q-max"><label>Högsta presentpris (kr)<input type="number" id="gfMax" min="1" step="50" inputmode="numeric" value="800"></label><div class="ctrl-row"><button class="btn" type="button" id="gfGo">Hitta en present</button><a class="btn ghost" href="#presentkort">Hellre ett presentkort</a></div></div>
        <div id="gfOut" class="q-out"></div></section>`,
    mount(root) {
      const a = {}, out = $("#gfOut", root), gfMax = $("#gfMax", root);
      const run = (show, all) => {
        if (!a.for && !a.occ) { RQ.toast("Välj vem presenten är till eller tillfället."); if (show) $("#gfQ1", root).scrollIntoView({ behavior: "smooth", block: "center" }); return; }
        const max = maxOf(gfMax);
        keep.set("rumiq-gift", { for: a.for || null, occ: a.occ || null, style: a.style || null, max });
        const score = (p) => (a.for && p.gift.includes(a.for) ? 3 : 0) + (a.occ && p.occ.includes(a.occ) ? 3 : 0) + (a.style && p.styles.includes(a.style) ? 2 : 0) + (p.gift.length ? 1 : 0);
        const fits = RQ.PRODUCTS.map((p) => ({ p, s: score(p) })).filter((x) => x.s > 1).sort((x, y) => y.s - x.s), scored = fits.filter((x) => priceOk(x.p, max));
        const n = all ? scored.length : Math.min(9, scored.length);
        out.innerHTML = scored.length
          ? `<p class="eyebrow" style="margin-bottom:1.4rem">${n < scored.length ? `<span>De</span> ${n} <span>bästa av</span> ${scored.length} <span>förslag</span>` : `${scored.length} <span>förslag</span>`}${max ? ` <span>upp till</span> ${kr(max)}` : ""}</p>${RQ.grid(scored.slice(0, n).map((x) => x.p), "three")}${n < scored.length ? `<div class="ctrl-row" style="justify-content:center;margin-top:2rem"><button class="btn ghost" type="button" id="gfAll"><span>Visa alla</span> ${scored.length}</button></div>` : ""}`
          : `<div class="empty">${fits.length ? `<h3><span>Inget under</span> ${kr(max)}</h3><p><span>Det billigaste som passar kostar</span> ${kr(cheapest(fits.map((x) => x.p)))}.</p><button class="btn ghost" type="button" id="gfNoMax">Visa utan maxpris</button>` : `<h3>Inget passar riktigt</h3><p>Prova ett annat tillfälle, eller ge ett presentkort.</p><a class="btn ghost" href="#presentkort">Till presentkortet</a>`}</div>`;
        const nm = $("#gfNoMax", out); if (nm) nm.addEventListener("click", () => { gfMax.value = ""; run(true); });
        const al = $("#gfAll", out); if (al) al.addEventListener("click", () => run(false, true));
        RQ.watch(root); RQ.markImages && RQ.markImages(out);
        if (show) showOut(out);
      };
      $$("[data-q]", root).forEach((g) => g.addEventListener("click", (e) => { const b = e.target.closest("[data-v]"); if (!b) return; const off = b.getAttribute("aria-pressed") === "true"; $$("[data-v]", g).forEach((x) => x.setAttribute("aria-pressed", !off && x === b)); a[g.dataset.q] = off ? null : b.dataset.v; if (out.firstChild) run(false); }));
      $("#gfGo", root).addEventListener("click", () => run(true));
      gfMax.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); run(true); } });
      const was = keep.get("rumiq-gift");
      if (was && (was.for || was.occ)) { ["for", "occ", "style"].forEach((k) => { if (was[k]) { a[k] = was[k]; press(root, k, was[k]); } }); gfMax.value = was.max || ""; run(false); }
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
