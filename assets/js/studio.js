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
  const roomOpts = () => picOpts("room", RQ.ROOMS.map((r) => [r.id, r.name.replace("Hemmakontor", "Hemma\u00adkontor"), `assets/img/rum/${r.id}-600.webp`]), "Vilket rum?"); // narrow tiles break "Hemma-kontor", never "Hemmakon-tor"
  // answers and the result are kept for this tab, so looking at a product and going back does not empty the page
  const keep = { get(k) { try { return JSON.parse(RQ.ss.get(k) || "null"); } catch (e) { return null; } }, set(k, v) { RQ.ss.set(k, JSON.stringify(v)); } };
  // after an answer the result is what you see: scrolled to under the header, with focus on its heading
  const showOut = (out) => { const h = out.querySelector("h2, h3, .eyebrow"); if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); } out.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); };
  const toNext = (el) => { if (!el) return; const r = el.getBoundingClientRect(), top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav-h")) || 64; if (r.top < top || r.bottom > innerHeight - 90) el.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" }); };
  const press = (root, q, v) => { const g = $(`[data-q="${q}"]`, root); if (g) $$("[data-v]", g).forEach((x) => x.setAttribute("aria-pressed", x.dataset.v === v)); };
  const maxOf = (el) => { const n = Math.floor(+String(el.value).replace(",", ".")); return n > 0 ? n : null; };
  const byPrice = (list) => [...list].sort((a, b) => a.price - b.price);
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
    // one swatch per named colour (several shades of white are one "Vit")
    const tones = picks.flatMap((p) => p.tone).filter((t, i, all) => all.findIndex((x) => toneName(x) === toneName(t)) === i).slice(0, 5);
    return `<div class="result reveal"><span class="eyebrow">Din stil</span><h2>${st.name}</h2><p class="lead" style="margin-top:.6rem">${st.text}</p>
      <div class="palette">${tones.map((t) => `<i style="background:${t}"><span>${esc(toneName(t))}</span></i>`).join("")}</div>
      <p class="small">Färgerna kommer från produkterna som passar stilen.</p></div>
      <div class="list-more"><h3 class="h3">Förslag ur sortimentet</h3>${RQ.grid(picks)}</div>`;
  };
  V.studioStyle = () => ({
    title: "Snabbval · Svep · RumIQ",
    html: `<header class="page-head wrap">${crumbs("Snabbval", ["Svep", "svep"])}<h1 class="h1">Fyra snabba val</h1><p class="lead">Ingen tid att svepa? Fyra val ger din stil, en färgpalett och förslag. Svaren hamnar i samma stilprofil som Svep.</p></header>
      <section class="wrap quiz" style="padding-bottom:5rem">
        <div class="q"><h2>1. Vilket rum tänker du på?</h2><div class="chips" data-q="room">${RQ.ROOMS.map((r) => `<button class="chip" type="button" data-v="${r.id}" aria-pressed="false">${esc(r.name)}</button>`).join("")}</div></div>
        <div class="q"><h2>2. Vilken bild känns mest som hemma?</h2><div class="imgopts" data-q="img">${Object.entries(RQ.STYLES).map(([k, s]) => `<button type="button" data-v="${k}" aria-pressed="false"><img src="${STYLE_IMG[k]}" alt="${esc(s.name)} rum" loading="lazy"><span>${["Ljust och naturligt", "Rent och stilla", "Tidlöst och varmt", "Mjukt och ombonat"][Object.keys(RQ.STYLES).indexOf(k)]}</span></button>`).join("")}</div></div>
        <div class="q"><h2>3. Vilka material tycker du om? Välj gärna flera.</h2><div class="chips" data-q="mat" data-multi="1">${Object.keys(MATERIALS).map((m) => `<button class="chip" type="button" data-v="${m}" aria-pressed="false">${m[0].toUpperCase() + m.slice(1)}</button>`).join("")}</div></div>
        <div class="q"><h2>4. Hur vill du att rummet ska kännas?</h2><div class="chips" data-q="feel">${Object.keys(FEEL).map((f) => `<button class="chip" type="button" data-v="${f}" aria-pressed="false">${f[0].toUpperCase() + f.slice(1)}</button>`).join("")}</div></div>
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
        $("#styleOut", root).innerHTML = RQ.styleResult(style, ans.room) + `<div class="ctrl-row" style="margin-top:1.6rem"><a class="btn" href="#mitt-hem">Din stil är sparad. Se Sparat</a><a class="btn ghost" href="#studio-stylist">Fråga stylisten</a></div>`;
        RQ.watch(root); $("#styleOut", root).scrollIntoView({ behavior: "smooth", block: "start" });
      });
    },
  });

  /* ---------------------------------------------------------------- rule-based stylist + smart search */
  const LEX = {
    rooms: { vardagsrum: ["vardagsrum", "soffa", "soffan", "tv", "living", "lounge", "sofa", "couch"], sovrum: ["sovrum", "säng", "sängen", "nattduksbord", "bedroom", "bed", "bedside"], kok: ["kök", "köket", "bänk", "matplats", "middag", "frukost", "kitchen", "dining", "dinner", "breakfast", "worktop"], badrum: ["badrum", "dusch", "handfat", "badrummet", "bathroom", "shower", "sink"], hall: ["hall", "hallen", "entré", "ytterdörr", "hallway", "entrance", "entryway"], hemmakontor: ["kontor", "skrivbord", "jobba", "hemmakontor", "arbetsplats", "office", "desk", "work", "study"], uteliv: ["balkong", "ute", "trädgård", "uteplats", "terrass", "balcony", "outdoor", "outdoors", "garden", "patio", "terrace"] },
    needs: { ljus: ["ljus", "lampa", "lampor", "mörkt", "mörk", "läsa", "läs", "belysning", "kväll", "mysig", "mysigt", "mysigare", "stämning", "flyttar", "flytten", "light", "lamp", "lamps", "lighting", "dark", "reading", "read", "evening", "cosy", "cozy", "atmosphere", "cosier", "cozier", "moving"], forvaring: ["förvaring", "barnrum", "barnrummet", "rörigt", "stökigt", "ordning", "plats", "organisera", "sladdar", "kablar", "liten", "litet", "leksaker", "prylar", "grejer", "flyttar", "flytten", "storage", "messy", "cluttered", "tidy", "organise", "organize", "cables", "small", "toys", "stuff", "moving"], detaljer: ["kalt", "kallt", "kall", "tomt", "tråkigt", "personligt", "personlighet", "detaljer", "inredning", "fint", "färg", "mysig", "mysigt", "mysigare", "varmt", "varmare", "bare", "empty", "boring", "personal", "details", "decor", "colour", "color", "warm", "warmer"], rutiner: ["enklare", "vardagen", "vardagslivet", "morgon", "rutin", "praktiskt", "smidigt", "ladda", "easier", "everyday", "morning", "routine", "practical", "charge", "charging"] },
    cats: { "belysning-atmosfar": ["lampa", "lampor", "ljus", "belysning", "doftljus", "ljusstake", "ljusstakar", "lamp", "lamps", "light", "lighting", "candle", "candles", "candlestick"], "sovrum-komfort": ["pläd", "filt", "ull", "mjuk", "mjukt", "påslakan", "sängkläder", "örngott", "throw", "blanket", "wool", "soft", "bedding", "duvet"], "hem-inredning": ["kudde", "kuddar", "vas", "inredning", "gardin", "gardiner", "matta", "mattor", "cushion", "cushions", "vase", "decor", "curtain", "curtains", "rug"], "kok-matplats": ["burk", "burkar", "bräda", "skärbräda", "kök", "jar", "jars", "board", "kitchen"], "forvaring-organisering": ["korg", "låda", "förvaring", "basket", "box", "storage"], "badrum-valmaende": ["handduk", "handdukar", "tvål", "badrum", "towel", "towels", "soap", "bathroom"], "tavlor-vaggar": ["tavla", "tavlor", "affisch", "affischer", "poster", "konst", "vägg", "väggen", "ram", "art", "print", "wall", "frame"], uteliv: ["kruka", "växt", "ute", "balkong", "pot", "plant", "plants", "balcony"] },
    styles: { skandinavisk: ["skandinavisk", "nordisk", "ljust", "naturligt", "scandinavian", "nordic", "natural"], minimalistisk: ["minimalistisk", "enkelt", "rent", "avskalat", "lugnt", "minimalist", "minimal", "simple", "clean", "calm", "japandi", "modern", "modernt", "stilrent", "industriell", "industrial"], klassisk: ["klassisk", "tidlös", "classic", "timeless", "lantlig", "lantligt", "rustik", "rustikt", "country", "vintage"], mjuk: ["hygge", "boho", "mysig", "mysigt", "mysigare", "ombonat", "mjukt", "varmt", "varmare", "cosy", "cozy", "cosier", "cozier", "soft", "warm"] },
    colors: { "#A9B39A": ["grön", "salvia", "green", "sage"], "#9E9890": ["grå", "grått", "gråa", "grey", "gray"], "#F2EFE9": ["vit", "vitt", "white"], "#3A3936": ["grafit", "svart", "graphite", "black"], "#B8714A": ["terrakotta", "rost", "terracotta", "rust"], "#D8C6A8": ["beige", "havre", "sand", "oat"], "#B88A5A": ["ek", "trä", "oak", "wood", "wooden"] },
  };
  // every word the rules know, to catch small typos ("lmpa" is read as "lampa")
  const VOCAB = [...new Set(Object.values(LEX).flatMap((m) => Object.values(m).flat()).filter((w) => w.length >= 4 && !w.includes(" ")))];
  const lev = (a, b) => { if (Math.abs(a.length - b.length) > 2) return 9; const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1), i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1] ? d[i - 2][j - 2] + 1 : 9); return d[a.length][b.length]; };
  const nameWords = (p) => S.norm(p.name).split(/[^a-zåäö]+/).filter((w) => w.length >= 4);
  // the English name names it too ("candle", "curtains"), word for word: no loose endings across languages ("handle" is not "candle")
  const enWords = (p) => S.norm(p.en || "").split(/[^a-z]+/).filter((w) => w.length >= 3 && !/^(and|with|table|the)$/.test(w));
  const sameEnd = (a, b) => { let n = 0; while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++; return n; };
  const sameStart = (a, b) => { let n = 0; while (n < a.length && n < b.length && a[n] === b[n]) n++; return n; };
  // "lampa" names "Glob bordslampa", "matta" names "Strand jutematta", "kudde" names "Lin kuddfodral"
  const stem = (w) => { const s = w.replace(/(?:erna|arna|orna|er|ar|or)$/, ""); return s.length >= 4 && s !== w ? s : null; }; // "gardiner" is "gardin"
  const namesIt = (p, w) => nameWords(p).some((n) => (w.length === 3 ? n.endsWith(w) : (/(?:en|et|n)$/.test(w) && w.replace(/(?:en|et|n)$/, "").length >= 3 && n.endsWith(w.replace(/(?:en|et|n)$/, ""))) || n.includes(w) || w.includes(n) || (stem(w) && n.includes(stem(w))) || sameEnd(n, w) >= 5 || (sameStart(n, w) >= 4 && Math.min(n.length, w.length) <= sameStart(n, w) + 2))) || enWords(p).some((n) => n === w || n === w.replace(/(?:es|s)$/, "") || n + "s" === w);
  const subseq = (a, b) => { let i = 0; for (const c of b) if (c === a[i]) i++; return i === a.length; }; // a inside b, in order
  const SMALL = new Set(["något", "någon", "några", "till", "från", "under", "över", "inte", "utan", "eller", "också", "bara", "lite", "mycket", "mest", "helst", "gärna", "vill", "skulle", "behöver", "söker", "letar", "efter", "finns", "har", "med", "och", "för", "som", "den", "det", "min", "mitt", "mina", "vår", "vårt", "kronor", "present", "saker", "sak", "rum", "rummet", "hemma", "hem", "bra", "fin", "fint", "snygg", "snyggt", "passar", "högst", "max", "billig", "billigt", "ungefär", "att", "jag", "kan", "ska", "vad", "hur", "var", "nya", "nytt", "stor", "små", "mer", "ett", "två", "tre", "vid", "ute", "inne", "hej", "hallå", "tack", "känns", "blir", "göra", "får", "ser", "litet", "liten", "någonting", "ont", "tid", "mig", "dig", "sig", "oss", "nog", "allt", "alla", "där", "här", "när", "nån", "fler", "dem", "sin", "sitt", "era", "ert", "gör",
    // English words that must stay themselves ("have" is not "havre", "tables" not "cables")
    "have", "has", "you", "your", "the", "and", "for", "with", "what", "which", "how", "does", "something", "anything", "some", "any", "there", "this", "that", "these", "those", "sell", "need", "want", "looking", "good", "best", "nice", "get", "make", "from", "about", "into", "goes", "tips", "would", "should", "could", "can", "will", "much", "many", "more", "less", "give", "between", "difference", "cheap", "cheapest", "help", "ideas", "idea", "room", "rooms", "home", "house", "flat", "apartment", "it's", "i'm", "don't", "dont", "really", "very", "just", "like", "love", "make", "makes", "feel", "feels", "looks", "look", "where", "when", "kids", "children", "child", "dog", "dogs", "cat", "cats", "pet", "pets", "rent", "rented", "renting", "rental", "student", "budget", "mum", "mom", "dad", "friend", "friends", "girlfriend", "boyfriend", "wife", "husband", "partner", "colleague"]);
  const OCC = { inflyttning: ["inflyttning", "flyttar", "housewarming", "moving"], fodelsedag: ["födelsedag", "årsdag", "fyller", "kalas", "birthday"], jul: ["jul", "julklapp", "julklappar", "christmas"], tack: ["tack för", "tacka", "värdinna", "thank", "host"] };
  RQ.parseNeed = (text) => {
    const fixed = [];
    const words = S.norm(text).replace(/[.,!?;:()"]/g, " ").split(/\s+/).filter(Boolean).map((w) => {
      if (w.length < 4 || /\d/.test(w) || SMALL.has(w) || VOCAB.includes(w) || VOCAB.some((v) => v.length >= 4 && w.includes(v))) return w;
      if (RQ.PRODUCTS.some((p) => namesIt(p, w)) || NOTSOLD.some((e) => e.w.includes(w)) || KEEP.has(w)) return w;
      // short words only when a letter is missing or two have swapped places ("lmpa"), never one letter for another ("kall" is not "hall")
      const near = VOCAB.map((v) => [v, lev(w, v)]).filter((x) => (w.length >= 8 ? x[1] <= 2 : w.length >= 6 ? x[1] <= 1 : x[1] === 1 && (subseq(w, x[0]) || [...w].sort().join("") === [...x[0]].sort().join("")))).sort((a, b) => a[1] - b[1])[0];
      if (near) { fixed.push([w, near[0]]); return near[0]; }
      return w;
    });
    const t = " " + words.join(" ") + " ";
    const hit = (list) => list.some((w) => (w.length <= 3 ? new RegExp(" " + w + "(?:en|et|ar|er|a|n|s)? ").test(t) : t.includes(" " + w) || (w.length >= 4 && t.includes(w))));
    const pick = (map) => Object.keys(map).filter((k) => hit(map[k]));
    const priceM = t.match(/(?:under|max|högst|mindre än|budget|below|less than|up to)\s*(\d[\d\s]{1,6})/) || t.match(/(\d[\d\s]{1,6})\s*(?:kr|kronor|:-|sek)/);
    const named = words.filter((w) => w.length >= 3 && !SMALL.has(w) && !/\d/.test(w) && !/^(ljus|ljuset|ljust|ljusa|light|lights)$/.test(w));
    const occ = Object.keys(OCC).filter((k) => hit(OCC[k]));
    const needs = pick(LEX.needs).filter((k) => k !== "ljus" || hit(LEX.needs.ljus.filter((w) => w !== "ljus")) || / ljus(?:et|en)? /.test(t)); // "ljust golv" is a colour, not a lamp
    // "mjukt till soffan" is soft, not bedding: the bedroom category only when bedding or the bedroom is named
    const cats = pick(LEX.cats).filter((k) => k !== "sovrum-komfort" || hit(LEX.cats[k].filter((w) => !/^(mjuk|mjukt|soft)$/.test(w))) || !pick(LEX.rooms).some((r) => r !== "sovrum"));
    return { rooms: pick(LEX.rooms), needs, cats, styles: pick(LEX.styles), colors: pick(LEX.colors), max: priceM ? parseInt(priceM[1].replace(/\s/g, ""), 10) : null, gift: hit(["present", "presenter", "ge bort", "inflyttning", "värdinna", "födelsedag", "årsdag", "julklapp", "julklappar", "syster", "systern", "bror", "brorsan", "mamma", "pappa", "mormor", "farmor", "morfar", "farfar", "svärmor", "svärfar", "kompis", "kollega", "väninna", "sister", "brother", "mum", "mom", "dad", "mother", "father", "grandma", "grandpa", "friend", "colleague", "gift", "gifts", "housewarming", "host", "birthday"]) || /(?:^| )ge (?:min|mitt|mina|till|henne|honom|dem|en|ett) /.test(t) || occ.includes("fodelsedag") || occ.includes("jul"), occ, named, fixed, words };
  };
  RQ.rank = (q, max) => {
    const all = RQ.PRODUCTS.filter((p) => priceOk(p, max || q.max)).map((p) => {
      let s = 0; const why = [];
      if ((q.named || []).some((w) => namesIt(p, w))) { s += 6; why.push("det du nämnde"); } // the thing itself beats everything that only suits
      q.rooms.forEach((r) => { if (p.rooms.includes(r)) { s += 3; why.push("passar i " + RQ.roomById(r).name.toLowerCase()); } });
      q.cats.forEach((c) => { if (p.cat === c) { s += 4; why.push(RQ.catById(c).name.toLowerCase()); } });
      q.needs.forEach((n) => { if (p.needs.includes(n)) { s += 2; why.push(RQ.NEEDS[n].toLowerCase()); } });
      q.styles.forEach((st) => { if (p.styles.includes(st)) { s += 1.5; why.push(RQ.STYLES[st].name.toLowerCase() + " stil"); } });
      q.colors.forEach((c) => { if (p.tone.some((t) => dist(hex2rgb(t), hex2rgb(c)) < 60)) { s += 2; why.push("färgen " + toneName(c).toLowerCase()); } }); // which colour, not only "färgen"
      if (q.gift && p.gift.length) { s += 2; why.push("bra present"); }
      if (q.gift && (q.occ || []).some((o) => (p.occ || []).includes(o))) s += 1; // a birthday gift before one that suits any day
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
  const ROOM_ADVICE = { hall: "En låda per person i hallen gör morgonen lugnare. En liten lampa som alltid är tänd gör hallen välkomnande även en mörk vinterkväll.", kok: "Ställ fram det du använder dagligen och ställ undan resten. Samma material på lock och brädor gör bänken lugnare.", badrum: "Häll över tvålen i en pump i stengods och välj två handdukstoner som går ihop, till exempel vit och sand.", hemmakontor: "Dölj grenuttaget och ge telefonen en egen plats. Det tar bort det mesta av röran.", sovrum: "Ett lågt, varmt ljus vid sängen och lådor med lock gör sovrummet lugnt även när det inte är städat.", uteliv: "En sladdlös lampa kan följa med ut på kvällen, och terrakotta passar växter som vill torka upp mellan vattningarna.", vardagsrum: "Flytta in möblerna lite från väggarna, tänd lampor på olika höjd och låt en pläd binda ihop soffan med resten av rummet." };
  // questions about buying, not about decorating: the answer is the shop's own fixed facts (config.js) and the page, never products
  const helpFacts = {
    frakt: (cost) => { const F = RQ.facts || {}, time = F.minDays ? `Målet är ${F.minDays}–${F.maxDays} arbetsdagar. Varje produktsida visar vilka datum paketet beräknas komma.` : "Leveranstiden visas innan du betalar.", price = `Hämta hos ombud eller i paketskåp kostar ${F.pickup} kr och hemleverans ${F.home} kr.${F.freeFrom ? ` Handlar du för ${F.freeFrom} kr eller mer är frakten till ombud och paketskåp fri.` : ""} Du ser fraktkostnaden i kassan innan du betalar.`; return cost ? [price, time] : [time, price]; }, // what it costs first when that is the question
    returer: () => [S.returnsLine(), "Hur du gör, steg för steg, står här:"],
    betalning: () => { const m = ((window.RQ_CONFIG || {}).payments || []); return [m.length ? `Du kan betala med ${m.join(", ")}.` : "Vilka betalsätt som finns ser du i kassan innan du betalar.", "Betalningen sker i Shopifys kassa. Vi ser eller sparar aldrig dina fullständiga kortuppgifter."]; },
    spara: () => ["Med ordernumret och din e-post ser du var beställningen är."],
    kontakt: () => ["Det där hjälper kundservice dig bäst med. Skriv till oss så svarar vi så snart vi kan."],
  };
  const HELP = [
    [["retur", "returnera", "ångra", "ångerrätt", "öppet köp", "skicka tillbaka", "pengarna tillbaka", "return", "refund", "send back", "exchange"], "returer", "Returer & återbetalning", "returer"],
    [["frakt", "leverans", "levereras", "leverera", "fraktkostnad", "paketet", "skickar ni", "shipping", "delivery", "deliver"], "frakt", "Frakt & leverans", "frakt"],
    [["betala", "betalning", "betalar", "klarna", "swish", "faktura", "delbetal", "pay", "payment", "invoice"], "betalning", "Betalning", "betalning"],
    [["min beställning", "min order", "spåra", "ordernummer", "track", "my order"], "spara-order", "Spåra min beställning", "spara"],
    [["kundservice", "kundtjänst", "reklamation", "reklamera", "garanti", "trasig", "kontakta", "customer service", "broken", "warranty", "complaint"], "kontakt", "Kontakt", "kontakt"],
  ];
  // work the shop does not do: say so before suggesting things that suit the room
  const CRAFT = ["måla", "målar", "målarfärg", "tapet", "tapetsera", "renovera", "renovering", "kakla", "snickra", "bygga", "elektriker", "paint", "wallpaper", "renovate"];
  /* colours: the shop's tones as families (havre and sand are one), what goes with each, and the words for them */
  const FAMILY = { havre: "beige", sand: "beige" };
  const fam = (hex) => { const c = hex2rgb(hex), t = RQ.TONES.reduce((b, x) => (dist(hex2rgb(x.hex), c) < dist(hex2rgb(b.hex), c) ? x : b)); return FAMILY[t.id] || t.id; };
  const colorsOf = (p) => [...new Set([...p.tone, ...(p.variants || []).map((v) => (RQ.TONES.find((t) => t.name === v) || {}).hex).filter(Boolean)].map(fam))];
  const COLOR_WORDS = { salvia: ["grön", "gröna", "grönt", "salvia", "green", "sage"], gra: ["grå", "grått", "gråa", "grey", "gray"], vit: ["vit", "vitt", "vita", "white"], grafit: ["grafit", "svart", "svarta", "black", "graphite"], terrakotta: ["terrakotta", "rost", "rostrött", "terracotta", "rust"], beige: ["beige", "havre", "sand", "oat"], ek: ["ek", "trä", "oak", "wood", "wooden"] };
  const COLOR_GOES = {
    gra: ["Grått blir varmare med havre, sand och ek. Vill du ha mer liv är salvia eller terrakotta en fin kontrast.", ["beige", "ek", "salvia", "terrakotta"]],
    salvia: ["Salvia går fint ihop med havre, vitt och ek. Terrakotta ger en varm kontrast.", ["beige", "vit", "ek", "terrakotta"]],
    vit: ["Vitt blir mjukare med havre och sand, och ek eller terrakotta gör det varmt.", ["beige", "ek", "terrakotta"]],
    grafit: ["Svart och grafit lyfts av ljusa naturtoner som havre, vitt och ek.", ["beige", "vit", "ek"]],
    terrakotta: ["Terrakotta passar med salvia, havre och ek. Håll resten lugnt så att färgen får ta plats.", ["salvia", "beige", "ek"]],
    beige: ["Havre och sand är en lugn bas. Ge dem liv med salvia eller terrakotta och lite ek.", ["salvia", "terrakotta", "ek"]],
    ek: ["Ek passar med vitt, havre och salvia. Grafit ger en skarp kontrast.", ["vit", "beige", "salvia", "grafit"]],
  };
  const COLOR_SAY = { salvia: "Vårt gröna heter salvia.", grafit: "Vårt svarta heter grafit." };
  // colours the shop does not have: said plainly, with the nearest tone when there is one; as the room's base they still get advice
  Object.assign(COLOR_WORDS, { rod: ["röd", "rött", "röda", "red"], bla: ["blå", "blått", "blåa", "blue", "navy"], gul: ["gul", "gult", "gula", "yellow"], rosa: ["rosa", "pink"] });
  Object.assign(COLOR_GOES, {
    rod: ["Rött blir lugnare med havre, vitt och ek.", ["beige", "vit", "ek"]],
    bla: ["Blått går fint med havre, vitt och ek, och terrakotta ger en varm kontrast.", ["beige", "vit", "ek", "terrakotta"]],
    gul: ["Gult blir mjukare med vitt, havre och ek.", ["vit", "beige", "ek"]],
    rosa: ["Rosa passar med havre, vitt och salvia.", ["beige", "vit", "salvia"]],
  });
  const MISSING = { rod: ["Rött har vi inte i sortimentet just nu, men terrakotta ligger närmast.", ["terrakotta"]], bla: ["Blått har vi inte i sortimentet just nu.", []], gul: ["Gult har vi inte i sortimentet just nu.", []], rosa: ["Rosa har vi inte i sortimentet just nu.", []] };
  const COLOR_ASK = ["färg", "färger", "färgen", "färgerna", "kulör", "colour", "colours", "color", "colors"];
  // a colour right before something the shop does not sell ("grå soffa", "gröna väggar") is the room's base, not what you want to buy
  const BASE = ["soffa", "soffan", "soffor", "vägg", "väggen", "väggar", "väggarna", "golv", "golvet", "säng", "sängen", "stol", "stolar", "bord", "bordet", "fåtölj", "fåtöljen", "kök", "köket", "kakel", "kaklet", "klinker", "sofa", "tiles", "tile", "tiling", "couch", "wall", "walls", "floor", "bed", "chair", "chairs", "table", "armchair", "kitchen", "cabinets"];
  const LAMP = /^(lampa|lampan|lampor|lamporna|bordslampa|golvlampa|taklampa|nattlampa|läslampa|lamp|lamps|mörkt|mörk|dark)$/; // too dark means a lamp, not a candle
  // also the room's base: "köket känns vitt" (said about the room) and "ekgolv" (one word)
  const SAYS = /^(är|känns|ser|blir|is|feels|looks|are)$/;
  const colorIn = (words) => { const found = []; words.forEach((w, i) => Object.entries(COLOR_WORDS).forEach(([k, list]) => { const glued = list.some((c) => c.length >= 2 && w.startsWith(c) && BASE.includes(w.slice(c.length))); if ((list.includes(w) || glued) && !found.some((f) => f.k === k)) found.push({ k, base: glued || (!/^(i|in|av|of)$/.test(words[i - 1] || "") && (BASE.includes(words[i + 1] || "") || BASE.includes(words[i + 2] || "") || words.slice(Math.max(0, i - 3), i).some((x) => SAYS.test(x)))) }); })); return found; };
  // furniture the shop does not sell, when you ask for it ("jag vill ha en soffa", "har ni soffor"), not when it is what you decorate around
  const FURN = /(?:^| )(?:vill ha|söker|letar efter|har ni|säljer ni|köpa|behöver|want|looking for|do you have|do you sell|buy|need)(?: (?:en|ett|nya?|nytt|a|an|some|new))? (?:soffa|soffor|stol|stolar|bord|säng|sängar|fåtölj|fåtöljer|hylla|hyllor|byrå|möbler|sofa|sofas|couch|chair|chairs|table|tables|bed|beds|armchair|shelf|furniture) /;
  const HAVE = /^ ?(?:har ni|finns det|säljer ni|do you have|do you sell|have you got) /;
  // things the shop does not sell. Asked for ("har ni soffbord?", "do you have coffee tables?"): a plain no and what we do have for it.
  // Named as the place ("något till soffbordet"): what suits it, when nothing else in the question says more
  const NOTSOLD = [
    { w: ["soffbord", "soffbordet", "soffborden", "coffee table", "coffee tables"], say: "Soffbord har vi inte. Vi säljer inga möbler, bara inredning och detaljer.", on: "På soffbordet passar till exempel:", h: ["sand-keramikvas", "glod-doftljus-keramik", "stilla-ljusstake-massing-2-pack"] },
    { w: ["soffa", "soffan", "soffor", "sofa", "sofas", "couch", "couches"], say: "Soffor har vi inte. Vi säljer inga möbler, bara inredning och textilier.", on: "Till soffan passar:", h: ["lin-kuddfodral", "plad-ullblandning-havre", "strand-jutematta"] },
    { w: ["matbord", "matbordet", "köksbord", "köksbordet", "bord", "bordet", "dining table", "dining tables", "kitchen table", "table", "tables"], say: "Bord har vi inte. Vi säljer inga möbler, bara det som står på dem.", on: "Till bordet passar:", h: ["stilla-ljusstake-massing-2-pack", "sand-keramikvas", "skarbrada-ek-med-handtag"] },
    { w: ["fåtölj", "fåtöljen", "fåtöljer", "stol", "stolen", "stolar", "armchair", "armchairs", "chair", "chairs"], say: "Stolar och fåtöljer har vi inte. Vi säljer inga möbler.", on: "Till läshörnan passar:", h: ["lysa-keramiklampa", "plad-ullblandning-havre", "lin-kuddfodral"] },
    { w: ["säng", "sängen", "sängar", "madrass", "madrasser", "bed", "beds", "mattress", "mattresses"], say: "Sängar och madrasser har vi inte. Vi säljer inga möbler.", on: "Till sängen har vi:", h: ["vila-paslakanset-linne", "plad-ullblandning-havre", "svamp-uppladdningsbar-lampa"] },
    { w: ["hylla", "hyllan", "hyllor", "bokhylla", "bokhyllor", "byrå", "byrån", "byråer", "garderob", "garderober", "skåp", "shelf", "shelves", "bookcase", "bookcases", "bookshelf", "dresser", "wardrobe", "wardrobes", "cabinet", "cabinets"], say: "Hyllor och skåp har vi inte. Vi säljer inga möbler.", on: "För ordningen har vi:", h: ["flatad-forvaringskorg", "forvaringslada-filt", "forradsburkar-glas-ek-3-pack"] },
    { w: ["tv-bänk", "tv-bänken", "tvbänk", "tv bänk", "skänk", "skänken", "sideboard", "tv-bench", "tv bench", "tv unit", "tv stand", "media unit"], say: "Tv-bänkar och skänkar har vi inte. Vi säljer inga möbler.", on: "Ovanpå och bredvid passar:", h: ["glob-bordslampa-opalglas", "sand-keramikvas", "flatad-forvaringskorg"] },
    { w: ["skrivbord", "skrivbordet", "desk", "desks"], say: "Skrivbord har vi inte. Vi säljer inga möbler.", on: "På skrivbordet passar:", h: ["skrivbordsorganisator-ek", "svamp-uppladdningsbar-lampa", "affisch-linje-ekram"] },
    { w: ["spegel", "speglar", "mirror", "mirrors"], say: "Speglar har vi inte just nu.", on: "För väggen har vi:", h: ["affisch-horisont-ekram", "affisch-linje-ekram"] },
    { w: ["taklampa", "taklampor", "pendel", "pendlar", "pendellampa", "golvlampa", "golvlampor", "ceiling lamp", "ceiling lamps", "ceiling light", "pendant", "floor lamp", "floor lamps"], say: "Tak- och golvlampor har vi inte just nu, bara bordslampor och en sladdlös lampa.", on: "Det här ligger närmast:", h: ["lysa-keramiklampa", "glob-bordslampa-opalglas", "svamp-uppladdningsbar-lampa"] },
    { w: ["växt", "växter", "blommor", "plant", "plants", "flowers"], say: "Växter och blommor säljer vi inte, men krukan och vasen har vi.", on: "", h: ["terrakottakruka-rafflad", "sand-keramikvas"] },
    { w: ["tallrik", "tallrikar", "servis", "bestick", "muggar", "koppar", "dricksglas", "plates", "cutlery", "mugs", "cups", "dinnerware", "tableware"], say: "Servis och bestick har vi inte.", on: "Till dukningen har vi:", h: ["stilla-ljusstake-massing-2-pack", "skarbrada-ek-med-handtag", "sand-keramikvas"] },
    { w: ["leksaker", "toys"], say: "Leksaker säljer vi inte.", on: "Att samla dem i passar:", h: ["flatad-forvaringskorg", "forvaringslada-filt"] },
    { w: ["badrumsmatta", "badrumsmattor", "duschdraperi", "duschdraperier", "bath mat", "shower curtain"], say: "Badrumsmattor och duschdraperier har vi inte.", on: "Till badrummet har vi:", h: ["vaffelhandduk-bomull", "tvalpump-stengods", "flatad-forvaringskorg"] },
    { w: ["ljusslinga", "ljusslingor", "fairy lights", "string lights"], say: "Ljusslingor har vi inte.", on: "För stämningen har vi:", h: ["svamp-uppladdningsbar-lampa", "glod-doftljus-keramik", "stilla-ljusstake-massing-2-pack"] },
  ];
  const ASKFOR = /(?:^| )(?:har ni|finns det|säljer ni|vill ha|söker|letar efter|köpa|behöver|do you have|do you sell|have you got|have you any|any|i want|want|looking for|buy|need) /;
  const PLACE = /^(till|på|vid|i|under|bredvid|för|ovanför|över|runt|kring|framför|on|for|to|by|next|beside|near|in|at|above|around|over|under|behind)$/, FILL = /^(min|mitt|mina|vår|vårt|en|ett|den|det|grå|vit|svart|stora|lilla|nya|gamla|my|our|the|a|an|new|old|grey|gray|white|black|big|small)$/;
  // where a not-sold thing is named: asked for, or the place you decorate
  const notSold = (words, t) => { for (const e of NOTSOLD) for (const w of e.w) { const ph = w.split(" "); const i = words.findIndex((x, k) => ph.every((y, j) => words[k + j] === y)); if (i < 0) continue; let k = i - 1; while (k >= 0 && FILL.test(words[k])) k--; const at = k >= 0 && PLACE.test(words[k]); return { e, at, asked: !at && ASKFOR.test(" " + words.slice(0, i).join(" ") + " "), i }; } return null; };
  // two products named with a comparing word: one line each, from the product's own description
  const COMPARE = /(?:^| )(?:skillnad|skillnaden|skiljer|jämför|jämföra|eller|vs|versus|bättre|difference|differ|compare|or|better) /;
  const COST = ["kostar", "kosta", "kostnad", "pris", "priset", "gratis", "fri frakt", "cost", "costs", "price", "how much", "free"];
  const SIZE_ASK = ["hur stor", "hur stora", "hur lång", "hur bred", "hur hög", "mått", "måtten", "storlek", "storleken", "how big", "how large", "how long", "how wide", "how tall", "size", "dimensions", "measurements"];
  // questions about the shop itself, answered only with what the site already says
  const STORE = ["fysisk butik", "hämta i butik", "hämta i butiken", "besöka butiken", "besöka er", "butiken ligger", "showroom", "visit the shop", "visit your shop", "visit your store", "physical shop", "physical store", "pick up in store", "collect in store"];
  const SALE = ["rea", "rean", "rabatt", "rabatter", "rabattkod", "rabattkoder", "erbjudande", "erbjudanden", "kampanj", "sale", "sales", "discount", "discounts", "discount code", "coupon", "promo", "offer", "offers"];
  const COUNT = ["hur många produkter", "hur många saker", "hur stort är sortimentet", "how many products", "how many things"];
  const REAL = ["riktig butik", "seriös", "seriöst", "bluff", "på riktigt", "real shop", "real store", "legit", "a scam", "is this real"];
  const DRAW = ["rita", "ritar", "ritning", "planlösning", "inreda åt mig", "möblera åt mig", "draw", "floor plan", "design my room", "see it in my room", "see them in my room", "visualise", "visualize", "ladda upp", "upload"];
  const POP = ["bästa produkt", "bästa produkten", "rekommenderar du", "best product", "what do you recommend", "populär", "populärt", "populärast", "populäraste", "mest sålda", "säljer mest", "bästsäljare", "bäst säljande", "popular", "most popular", "best seller", "bestseller", "bestsellers", "best-selling", "best selling"];
  const SPEC = ["dimbar", "dimbara", "dimmer", "dimmerbar", "dimmable", "dimmbar", "watt", "sockel", "e27", "e14", "lumen", "batteri", "batteriet", "laddning", "hur länge lyser", "lyser den", "battery", "charge", "vattentät", "waterproof", "ip44", "ip-klass", "kelvin", "sladden", "sladdlängd", "cord", "how long does it last"];
  const CHEAP = ["billigast", "billigaste", "lägsta pris", "cheapest", "least expensive", "lowest price"];
  const PETS = ["hund", "hunden", "hundar", "katt", "katten", "katter", "husdjur", "fäller", "valp", "kattunge", "dog", "dogs", "cat", "cats", "pet", "pets", "puppy", "kitten"];
  const RENT = ["hyr", "hyresrätt", "hyresgäst", "hyreslägenhet", "andrahand", "inte borra", "får inte borra", "rent", "renting", "rented", "rental", "tenant", "can't drill", "cannot drill", "no holes"];
  const SMALLSPACE = ["etta", "ettan", "kvadrat", "kvm", "liten lägenhet", "litet hem", "små ytor", "trångt", "känns större", "kännas större", "större ut", "small flat", "small apartment", "studio flat", "tiny", "feel bigger", "feel larger", "look bigger", "small space", "cramped"];
  const KIDS = ["barnrum", "barnrummet", "barnen", "barnens", "barn", "leksaker", "kids", "children", "child", "toys", "nursery"];
  const BUDGET = /(?:^| )(?:jag har|har jag|har bara|bara har|budget|budgeten|budgeten är|have|spend|got)(?: (?:på|of|about|ungefär|runt|max))? \d/;
  const COLOR_YES = { salvia: "Ja, den finns i salvia, vårt gröna.", vit: "Ja, den finns i vitt.", beige: "Ja, den finns i en ljus beige ton.", gra: "Ja, den finns i grått.", grafit: "Ja, den finns i grafit, vårt svarta.", terrakotta: "Ja, den finns i terrakotta.", ek: "Ja, den finns i ek." };
  const SMALL_SAY = { room: "I ett litet rum gör ljust och luftigt mest: få saker framme, förvaring som samlar småsakerna och gardiner som hänger högt, så ser fönstret större ut.", home: "I ett litet hem gör ljust och luftigt mest: få saker framme, förvaring som samlar småsakerna och gardiner som hänger högt, så ser fönstret större ut.", badrum: "I ett litet badrum: samla småsakerna i en korg och häll över tvålen i en pump, så blir ytorna lugnare och rummet känns större." };
  const GIFT_SAY = "Här är saker som brukar bli uppskattade att få.", FITS_SAY = "Det här ur sortimentet passar det du beskriver.";
  const KIDS_SAY = "Låga korgar och lådor som barnen själva når gör det lättare att plocka undan, och det som har en fast plats blir inte liggande.";
  const ROOM_WARM = { kok: "Ge köket värme med trä och keramik: en skärbräda i ek som får stå framme, en vas med en kvist och ljus på bordet." };
  const STYLE_SAY = { japandi: "Japandi blandar skandinaviskt och japanskt: få saker, naturmaterial och lugna toner. Det ligger nära vår minimalistiska stil.", hygge: "Hygge handlar om varmt ljus och mjuka textilier, och det är precis vad vår mjuka stil är gjord av." };
  const WHO = ["vem är du", "vad är du", "är du en ai", "är du en robot", "är du en bot", "är du en människa", "är du riktig", "who are you", "what are you", "are you an ai", "are you a bot", "are you a robot", "are you human", "are you real", "chatgpt"];
  const ABOUT = ["hur gammal", "hur länge har ni", "var finns ni", "var ligger ni", "vilka är ni", "vem står bakom", "vilka står bakom", "om företaget", "where are you based", "where are you from", "who are you guys", "who is behind", "about you", "how old", "how long have you"];
  const CARD = ["presentkort", "presentkortet", "gift card", "gift cards", "giftcard", "voucher"];
  const SCENT = ["luktar", "lukt", "doft", "doftar", "instängt", "smell", "smells", "scent", "scented", "stuffy"];
  const USE_ASK = ["hur hänger", "hur ska jag hänga", "var ska jag hänga", "hur ställer", "var ska jag ställa", "hur använder", "hur ska jag använda", "how do i hang", "how should i hang", "where should i hang", "where should i put", "how do i use", "how should i use"];
  const MAT_ASK = ["material", "materialet", "gjord av", "gjort av", "gjorda av", "tillverkad", "vegan", "vegansk", "veganskt", "made of", "made from"];
  const KEEP = new Set([...STORE, ...SALE, ...REAL, ...DRAW, ...POP, ...SPEC, ...CHEAP, ...PETS, ...RENT, ...SMALLSPACE, ...KIDS, "japandi", "hygge"].filter((w) => !w.includes(" ")));
  const firstName = (p) => S.norm(p.name).split(/[^a-zåäö]+/)[0];
  const GREET = /^ ?(?:hej|hejsan|hallå|tjena|tja|god morgon|god kväll|hi|hello|hey)(?: där| there)? ?$/, THANKS = /^ ?(?:tack|tack så mycket|tusen tack|thanks|thank you)(?: så mycket)? ?$/;
  const ABROAD = ["norge", "norway", "danmark", "denmark", "finland", "utomlands", "abroad", "europa", "europe"];
  // how to look after a material: the care text the product pages use (data.js)
  const CARE_ASK = ["sköta", "sköter", "skötsel", "tvätta", "tvättar", "rengöra", "rengör", "hand om", "care", "wash", "clean"];
  const MATERIAL = { lin: ["lin", "linne", "linen"], ull: ["ull", "ylle", "wool"], ek: ["ek", "trä", "oak", "wood"], keramik: ["keramik", "ceramic", "ceramics"], glas: ["glas", "glass"], bomull: ["bomull", "cotton"], jute: ["jute"], massing: ["mässing", "brass"], terrakotta: ["terrakotta", "terracotta"], stengods: ["stengods", "stoneware"], filt: ["filt", "felt"] };
  const LIVING = ["vardagsrum", "sovrum"]; // rooms where the general advice fits better than the room's own
  /* what a question asks the thing to be ("en matta 200 × 300", "i ull", "rund", "3-pack", "utan doft", "under 1 000 kr"),
     checked against what we have, so that "Ja, det här har vi." is only said when every part of the question is true */
  const MAT_ASKED = { lin: ["lin", "linne", "linen"], ull: ["ull", "ylle", "wool", "woollen", "woolen"], keramik: ["keramik", "ceramic", "ceramics"], glas: ["glas", "glass"], bomull: ["bomull", "cotton"], jute: ["jute"], massing: ["mässing", "brass"], stengods: ["stengods", "stoneware"], filt: ["filt", "felt"], metall: ["metall", "metal"],
    sammet: ["sammet", "velvet"], boucle: ["bouclé", "boucle"], rotting: ["rotting", "rattan"], bambu: ["bambu", "bamboo"], marmor: ["marmor", "marble"], plast: ["plast", "plastic"], lader: ["läder", "skinn", "leather"], silke: ["siden", "silke", "silk"], betong: ["betong", "concrete"], porslin: ["porslin", "porcelain"], sisal: ["sisal"], polyester: ["polyester"], koppar: ["koppar", "copper"], guld: ["guld", "gold"], silver: ["silver"], krom: ["krom", "chrome"], kashmir: ["kashmir", "cashmere"], farskinn: ["fårskinn", "sheepskin"] };
  const MAT_NAME = { lin: "lin", ull: "ull", keramik: "keramik", glas: "glas", bomull: "bomull", jute: "jute", massing: "mässing", stengods: "stengods", filt: "filt", metall: "metall", sammet: "sammet", boucle: "bouclé", rotting: "rotting", bambu: "bambu", marmor: "marmor", plast: "plast", lader: "läder", silke: "siden", betong: "betong", porslin: "porslin", sisal: "sisal", polyester: "polyester", koppar: "koppar", guld: "guld", silver: "silver", krom: "krom", kashmir: "kashmir", farskinn: "fårskinn" };
  const MAT_OF = { lin: /\blin/, ull: /ull/, keramik: /keramik/, glas: /glas/, bomull: /bomull/, jute: /jute/, massing: /mässing/, stengods: /stengods/, filt: /filt/, metall: /metall|mässing/ }; // what the product's own material line says
  const MAT_WORDS = Object.entries(MAT_ASKED).flatMap(([k, l]) => l.map((w) => [w, k])).sort((a, b) => b[0].length - a[0].length);
  const COLOR_NO = { salvia: "grönt", gra: "grått", vit: "vitt", grafit: "svart", terrakotta: "terrakotta", beige: "beige", ek: "ek" };
  const SIZE_W = /^(stor|stora|stort|större|största|liten|lilla|litet|små|mindre|minsta|big|bigger|large|larger|small|smaller|tiny|huge|xl|mini)$/, SMALL_W = /^(liten|lilla|litet|små|mindre|minsta|small|smaller|tiny|mini)$/;
  const DOUBLE_W = /^(dubbelsäng|dubbelsängen|dubbelsängar|dubbeltäcke|dubbeltäcken|dubbel|double|king|queen|kingsize|tvåmanssäng)$/;
  const SHAPE_W = /^(rund|runda|runt|round|oval|ovala|kvadratisk|kvadratiska|fyrkantig|fyrkantiga|square|rektangulär|rektangulära|rectangular)$/;
  const UNSCENTED = /utan doft|doftfri|doftfritt|doftfria|oparfymerad|unscented|scent-free|scent free|without scent|no scent|fragrance-free|fragrance free|without fragrance/;
  const dimsOf = (p) => [...new Set([...(p.name + ". " + p.short).matchAll(/(\d+)\s*×\s*(\d+)/g)].map((m) => m[1] + "×" + m[2]))].map((d) => d.split("×").map(Number)); // in the name or the description
  const packOf = (p) => +((p.name.match(/(\d+)\s*[‑-]\s*pack/) || [])[1] || 1);
  // the words that are the thing itself ("matta" in "en rund matta i ull"), and what the rest asks of it
  const askedOf = (text, colors, lamp, max) => {
    const tt = S.norm(text).replace(/candle ?(?:holders?|sticks?)/g, "candlesticks").replace(/ljushållare/g, "ljusstake");
    const w = tt.replace(/[.,!?;:()"]/g, " ").split(/\s+/).filter(Boolean), asks = [], thing = [];
    const productWord = (x) => x && x.length >= 3 && !SMALL.has(x) && !/\d/.test(x) && RQ.PRODUCTS.some((p) => namesIt(p, x));
    const colorW = new Set(Object.values(COLOR_WORDS).flat());
    w.forEach((x, i) => {
      // a material: "i ull", "made of wool", "wool rugs", or glued on ("ullmatta", "sammetskudde")
      const m = MAT_WORDS.find(([mw]) => x === mw);
      const glued = !m && MAT_WORDS.find(([mw]) => mw.length >= 3 && x.startsWith(mw) && x.length - mw.length >= 3 && productWord(x.slice(mw.length).replace(/^s(?=[^aeiouyåäö])/, "")));
      if (m && (/^(i|av|in|of)$/.test(w[i - 1] || "") || productWord(w[i + 1]))) { asks.push({ mat: m[1] }); return; }
      if (glued) { asks.push({ mat: glued[1] }); thing.push(x.slice(glued[0].length).replace(/^s(?=[^aeiouyåäö])/, "")); return; }
      if (m || colorW.has(x)) return;
      if (DOUBLE_W.test(x)) { asks.push({ double: 1 }); return; }
      if (SHAPE_W.test(x)) { asks.push({ shape: /^(rekt|rect)/.test(x) ? "rekt" : /^(kvad|fyrk|square)/.test(x) ? "kvadrat" : "rund" }); return; }
      if (SIZE_W.test(x) && (productWord(w[i + 1]) || productWord(w[i + 2]))) { asks.push({ size: SMALL_W.test(x) ? "liten" : "stor" }); return; }
      if (productWord(x) && !/^(ljus|ljuset|ljust|ljusa|light|lights|doft|scent)$/.test(x)) thing.push(x);
    });
    const two = tt.match(/(\d+(?:[.,]\d+)?)\s*(?:x|×|\*|gånger|by)\s*(\d+(?:[.,]\d+)?)\s*(cm|m|meter|metre|meters|metres)?\b/);
    const toCm = (n, unit, other) => { const v = parseFloat(String(n).replace(",", ".")); return /^m/.test(unit || "") || (v < 10 && other < 10) ? Math.round(v * 100) : Math.round(v); };
    if (two) { const a = parseFloat(two[1].replace(",", ".")), b = parseFloat(two[2].replace(",", ".")); asks.push({ dims: [toCm(a, two[3], b), toCm(b, two[3], a)] }); }
    else { const one = tt.match(/(\d+(?:[.,]\d+)?)\s*(cm|centimeter|m|meter|metre|meters|metres)\b/); if (one) asks.push({ len: toCm(one[1], one[2], 99) }); }
    const pack = tt.match(/(\d+)\s*[-‑]?\s*(?:pack|pak|set)\b|(?:pack|set|förpackning|paket) (?:of|om|med|på) (\d+)/);
    if (pack) asks.push({ pack: +(pack[1] || pack[2]) });
    if (UNSCENTED.test(tt)) asks.push({ unscented: 1 });
    colors.filter((c) => !c.base).forEach((c) => asks.push({ color: c.k }));
    if (max && !lamp) asks.push({ max });
    return { asks, thing: [...new Set(thing)] };
  };
  // true: it is so; false: it is not; null: we cannot say from what the shop knows
  const meets = (p, a) => {
    const dims = dimsOf(p), txt = S.norm(p.name + " " + p.short);
    if (a.mat) return MAT_OF[a.mat] ? (a.mat === "ull" && /blandning/.test(S.norm(p.material)) ? null : MAT_OF[a.mat].test(S.norm(p.material))) : false; // a wool blend is not pure wool
    if (a.dims) return dims.length ? dims.some(([x, y]) => (Math.abs(x - a.dims[0]) <= 2 && Math.abs(y - a.dims[1]) <= 2) || (Math.abs(x - a.dims[1]) <= 2 && Math.abs(y - a.dims[0]) <= 2)) : null;
    if (a.len) return dims.length ? dims.some((d) => d.some((v) => Math.abs(v - a.len) <= 2)) : null;
    if (a.double) return p.cat === "sovrum-komfort" && dims.length ? false : null;
    if (a.shape) return dims.length ? (a.shape === "rekt" ? true : a.shape === "kvadrat" ? dims.some(([x, y]) => x === y) : false) : a.shape === "rund" && /klot|rund|svampformad/.test(txt) ? true : null;
    if (a.size) return a.size === "liten" && /\bliten\b|\blitet\b|\bsmå\b/.test(txt) ? true : null;
    if (a.pack) return packOf(p) === a.pack;
    if (a.unscented) return /doft/.test(txt) ? false : null;
    if (a.color) return !MISSING[a.color] && colorsOf(p).includes(a.color);
    if (a.max) return p.price <= a.max;
    return true;
  };
  // what to say when nothing we have is all you asked for: each part that is not so, plainly, and the thing as it is
  const notSo = (ps, asks) => {
    const many = ps.length > 1, D = many ? "De" : "Den", p = ps[0], out = [];
    const one = (a) => ps.every((x) => meets(x, a) === false), dims = ps.map(dimsOf), single = dims.every((d) => d.length === 1 && d[0].join() === dims[0][0].join()) ? dims[0][0] : null;
    let short = false, sizeInfo = false;
    asks.forEach((a) => {
      if (a.dims && one(a)) { if (single) out.push(`${D} finns bara i ${single[0]} × ${single[1]} cm, inte ${a.dims[0]} × ${a.dims[1]}.`); else { out.push(`${D} har vi inte i ${a.dims[0]} × ${a.dims[1]} cm.`); short = true; } }
      else if (a.len && one(a)) { if (single) out.push(`${D} finns bara i ${single[0]} × ${single[1]} cm.`); else { out.push(`${D} har vi inte i ${a.len} cm.`); short = true; } }
      else if (a.double && one(a)) { out.push("Till dubbelsäng har vi inget just nu."); short = true; }
      else if (a.shape && one(a)) out.push(`${D} finns bara ${many ? "rektangulära" : "rektangulär"}, ${single ? `${single[0]} × ${single[1]} cm.` : "som på bilden."}`);
      else if (a.mat && one(a)) { out.push(`${D} har vi inte i ${MAT_NAME[a.mat]}.`); short = true; }
      else if (a.color && one(a)) { out.push(MISSING[a.color] ? MISSING[a.color][0] : `${D} har vi inte i ${COLOR_NO[a.color]}.`); short = true; }
      else if (a.pack && one(a)) out.push(packOf(p) > 1 ? `${D} finns bara som ${packOf(p)}‑pack.` : `${D} säljs en och en, så du väljer antal i varukorgen.`);
      else if (a.unscented && one(a)) { out.push("Utan doft har vi den inte."); short = true; }
      else if (a.max && one(a)) out.push(`Under ${kr(a.max)} har vi ${many ? "dem" : "den"} inte.`, many ? `Billigast är ${byPrice(ps)[0].name}, ${kr(byPrice(ps)[0].price)}.` : `${p.name} kostar ${kr(p.price)}.`);
      else if (a.mat === "ull" && ps.some((x) => meets(x, a) === null)) out.push(`${D} vi har är i ullblandning, inte i ren ull.`);
      else if ((a.size || a.shape) && ps.some((x) => meets(x, a) === null)) sizeInfo = sizeInfo || a;
    });
    if (sizeInfo) {
      if (single) out.push(`${D} finns bara i ${single[0]} × ${single[1]} cm.`);
      else { if (!many && !out.length) out.push(`Den vi har är ${p.name}.`); out.push(sizeInfo.shape ? "Formen ser du på bilden." : "Exakta mått visas på produktsidan när produkten är verifierad."); }
    }
    if (short && !many) out.push(p.short);
    return out;
  };
  const DEAR = ["dyrast", "dyraste", "dyrare", "högsta pris", "mest exklusiv", "mest exklusiva", "most expensive", "priciest", "highest price", "dearest"];
  const HOWMANY = /(?:^| )(?:hur många|how many|fler än|more than)(?: |$)/;
  RQ.stylistAnswer = (text, max) => {
    const q = RQ.parseNeed(text); if (max) q.max = max;
    const t = " " + q.words.join(" ") + " ";
    const has = (list) => list.some((w) => t.includes(" " + w));
    const none = (say, extra) => ({ q: text, text: say, picks: [], help: null, unknown: false, cheaper: null, ...extra });
    if (GREET.test(t)) return none(["Hej! Berätta vilket rum det gäller och vad du vill förändra, så föreslår jag något."], { hi: true });
    if (THANKS.test(t)) return none(["Varsågod! Säg till om du vill ha fler förslag."]);
    const raw = S.norm(text).replace(/[.,!?;:()"]/g, " ").split(/\s+/).filter(Boolean); // as written: "bord" is a table, not a typo for "board"
    const rt = " " + raw.join(" ") + " ", word = (list) => list.some((w) => rt.includes(" " + w + " ")); // whole words only ("rea" is not "realistisk")
    // the shop itself: what the site already says, and the page
    if (word(STORE)) return none(["Vi har ingen butik att besöka just nu, RumIQ finns på nätet.", helpFacts.frakt(true)[0]], { help: { route: "frakt", label: "Frakt & leverans" } });
    if (word(SALE)) return none(["Kampanjer och erbjudanden samlar vi på en egen sida när de finns."], { help: { route: "erbjudanden", label: "Erbjudanden" } });
    if (word(COUNT)) return none([`Just nu har vi ${RQ.PRODUCTS.length} produkter, utvalda för hemmets alla rum.`], { help: { route: "butik", label: "Se alla produkter" } });
    if (word(REAL)) return none(["Det här är en förhandsversion av RumIQ. Kassan är i testläge, så inga riktiga köp görs än."], { help: { route: "om", label: "Om RumIQ" } });
    if (word(WHO)) return none(["Jag är RumIQs stylist. Jag svarar med enkla regler och RumIQs sortiment, inte med en AI-tjänst än."]);
    if (word(ABOUT)) return none(["Mer om oss och företaget står på sidan Om RumIQ."], { help: { route: "om", label: "Om RumIQ" } });
    if (word(CARD)) return none(["Presentkorten kommer när butiken öppnar. På sidan kan du få ett mejl när de går att köpa."], { help: { route: "presentkort", label: "Presentkort" } });
    if (word(DRAW)) return none(["Rita kan jag inte, men i Mitt rum laddar du upp ett foto av ditt rum och ställer in produkterna där. Fotot stannar i din webbläsare."], { help: { route: "mitt-rum", label: "Mitt rum" } });
    const help = HELP.find((h) => has(h[0]) || (h[3] === "frakt" && has(ABROAD)));
    // a question about delivery, returns or paying gets only that answer, with the shop's own facts and the page
    if (help) return none([...(help[3] === "frakt" && has(ABROAD) ? ["Vi levererar till adresser i Sverige."] : []), ...helpFacts[help[3]](has(COST))], { help: { route: help[1], label: help[2] } });
    const ns = notSold(raw), nsWords = ns ? ns.e.w.flatMap((w) => w.split(" ")) : [];
    const namedHit = q.named.some((w) => !nsWords.includes(w) && RQ.PRODUCTS.some((p) => namesIt(p, w))); // "golvlampa" is the thing we do not have, not a lamp you named
    // products named one by one ("Glob", "Svamp"): a word that names exactly one product
    const one = [...new Set(raw.filter((w) => w.length >= 4 && !SMALL.has(w)).map((w) => RQ.PRODUCTS.filter((p) => firstName(p) === w || namesIt(p, w))).filter((l) => l.length === 1).map((l) => l[0]))];
    if (one.length >= 2 && COMPARE.test(" " + raw.join(" ") + " ")) {
      const two = one.slice(0, 3);
      return none(["Så skiljer de sig:", ...two.map((p) => `${p.name} kostar ${kr(p.price)}. ${p.short}`)], { picks: two });
    }
    if (has(SIZE_ASK) && namedHit) {
      const ps = (one.length ? one : RQ.PRODUCTS.filter((p) => q.named.some((w) => namesIt(p, w)))).slice(0, 2);
      const dims = ps.filter((p) => /\d\s*×\s*\d/.test(p.short));
      return none([...dims.map((p) => p.short), ...(dims.length < ps.length ? [dims.length ? "För övriga visas exakta mått på produktsidan när produkten är verifierad." : "Exakta mått visas på produktsidan när produkten är verifierad. Prova den gärna i ett foto av ditt rum i Mitt rum."] : [])], { picks: ps });
    }
    // details we cannot vouch for yet: said plainly, with the page where they will be
    if (word(SPEC) && (namedHit || q.words.some((w) => LAMP.test(w)))) return none(["Det kan jag inte svara säkert på än. Tekniska uppgifter som det visas på produktsidan när produkten är verifierad."], { picks: (RQ.PRODUCTS.filter((p) => raw.includes(firstName(p))).length ? RQ.PRODUCTS.filter((p) => raw.includes(firstName(p))) : RQ.PRODUCTS.filter((p) => q.named.some((w) => namesIt(p, w)) || (/lampa/.test(S.norm(p.name)) && q.words.some((w) => LAMP.test(w))))).slice(0, 3) });
    // a product you named: what it is made of, how to use it, which colours it comes in
    const solo = one.length === 1 ? one[0] : null, byCat = q.cats.length === 1 ? RQ.PRODUCTS.filter((p) => p.cat === q.cats[0]) : [];
    if (word(MAT_ASK) && (solo || namedHit)) {
      const ps = solo ? [solo] : RQ.PRODUCTS.filter((p) => q.named.some((w) => namesIt(p, w))).slice(0, 2);
      return none(["Så här står det om materialet:", ...ps.map((p) => p.material), ...(word(["vegan", "vegansk", "veganskt", "eko", "ekologisk", "certifierad", "organic", "certified"]) ? ["Om något är veganskt eller certifierat visas på produktsidan när produkten är verifierad."] : [])], { picks: ps });
    }
    const useP = solo || (byCat.length && byCat.length <= 2 ? byCat[0] : null);
    // hanging pictures when you may not drill: no holes, and the magazine's renting tips
    const rentNow = word(RENT.filter((w) => w !== "rent")) || (word(["rent"]) && RQ.isEnglish(text));
    const art = (useP && useP.cat === "tavlor-vaggar") || raw.some((w) => /^(tavl|affisch|poster|print|picture|frame|konst|art$|artwork)/.test(w));
    if (rentNow && art && (has(USE_ASK) || raw.some((w) => /^(häng|hang|sätta|put)/.test(w)))) return none(["Utan att borra: ställ tavlan på en hylla eller byrå och luta den mot väggen, eller häng den med självhäftande tavelkrokar som går att ta bort. Kolla hur mycket krokarna bär.", "Fler tips för dig som hyr:"], { help: { route: "artikel-hyresvanlig-inredning", label: "Hyresvänlig inredning" }, picks: ["affisch-linje-ekram", "affisch-horisont-ekram"].map(RQ.byHandle).filter((p) => p && priceOk(p, q.max)) });
    if (has(USE_ASK) && useP) return none(useP.use.slice(0, 2), { picks: solo ? [solo] : byCat });
    const tones0 = colorIn(q.words), asked0 = tones0.filter((c) => !c.base);
    if (solo && (has(COLOR_ASK) || asked0.length) && !tones0.some((c) => c.base)) {
      const fits = asked0.filter((c) => colorsOf(solo).includes(c.k));
      if (!asked0.length || !solo.variants) return none([solo.variants ? "Den finns i flera färger, och du väljer färg på produktsidan." : "Den finns i en färg, den du ser på bilden.", solo.short], { picks: [solo] });
      return none([fits.length ? COLOR_YES[fits[0].k] : "Den har vi inte i den färgen. Vilka färger den finns i ser du på produktsidan."], { picks: [solo] });
    }
    // a stuffy smell: air first, then a scented candle
    if (word(SCENT) && !namedHit) { const g = RQ.PRODUCTS.find((p) => /doftljus/.test(S.norm(p.name))); if (g && priceOk(g, q.max)) return none(["Vädra en stund först, sedan gör ett doftljus rummet varmare.", g.short], { picks: [g] }); }
    const pets = word(PETS);
    if (pets && namedHit && !has(CARE_ASK)) {
      const ps = (one.length ? one : RQ.PRODUCTS.filter((p) => q.named.some((w) => namesIt(p, w)))).slice(0, 2);
      return none(["Med husdjur hemma är det bra med saker som tål att borstas och torkas av. Så sköter du det här:", ...new Set(ps.flatMap((p) => p.care.map((k) => RQ.CARE[k])))], { picks: ps });
    }
    if (word(POP)) { const fav = []; RQ.PRODUCTS.filter((p) => p.featured).forEach((p) => { if (fav.length < 3 && !fav.some((f) => f.cat === p.cat)) fav.push(p); }); return none(["Butiken har precis börjat, så jag vet inte än vad som säljer mest. Det här är våra egna favoriter:"], { picks: fav }); }
    if (has(CARE_ASK)) {
      const mat = Object.keys(MATERIAL).find((k) => MATERIAL[k].some((w) => q.words.includes(w)));
      const own = !mat && RQ.PRODUCTS.filter((p) => q.named.some((w) => namesIt(p, w)));
      const ps = mat ? RQ.PRODUCTS.filter((p) => p.care.includes(mat)) : own || [];
      const say = mat ? [RQ.CARE[mat]] : ps.length ? [...new Set(ps[0].care.map((k) => RQ.CARE[k]))] : [];
      return none([...say, "Skötselråden för varje produkt står under Material och skötsel på produktsidan."], { picks: ps.slice(0, 3) });
    }
    const colors = colorIn(q.words), colorAsk = has(COLOR_ASK), furn = !!(ns && ns.asked);
    const within = (hs) => hs.map(RQ.byHandle).filter((p) => p && priceOk(p, q.max));
    // something we do not sell, asked for: a plain no, and what we have for it (alone, unless you also named something we do sell)
    if (furn && !namedHit) {
      const ps = within(ns.e.h), near = ps.length ? null : byPrice(ns.e.h.map(RQ.byHandle).filter(Boolean))[0];
      return none([ns.e.say, ...(ps.length ? (ns.e.on ? [ns.e.on] : []) : near ? [`Under ${kr(q.max)} har jag inget till det. Det här ligger närmast:`] : [])], { picks: ps.length ? ps : near ? [near] : [], tags: near ? ["Närmast"] : null });
    }
    // a thing we sell, asked for with a size, material, shape, colour, pack or price: only what is all of that, or a plain no for each part that is not
    const lamp0 = q.words.some((w) => LAMP.test(w) || /^läs/.test(w) || /^read/.test(w));
    const ask = askedOf(text, colors, lamp0, q.max), asking = ASKFOR.test(rt) || raw.length <= 5;
    const ownAll = asking && !furn ? byPrice(RQ.PRODUCTS.filter((p) => ask.thing.some((w) => namesIt(p, w)))) : [];
    // how many of a thing we have ("hur många lampor har ni?"): the count and all of them
    if (ownAll.length && HOWMANY.test(rt) && /(?:^| )(?:har ni|finns det|säljer ni|do you have|do you sell|have you got)(?: |$)/.test(rt)) return none([ownAll.length === 1 ? "Just nu har vi en, den här:" : `Just nu har vi ${ownAll.length} sådana:`], { picks: ownAll.slice(0, 4) });
    let only = null, sure = true;
    if (ownAll.length && ask.asks.length) {
      const full = ownAll.filter((p) => ask.asks.every((a) => meets(p, a) === true));
      if (full.length) only = full;
      else { const ps = ownAll.slice(0, 3), say = notSo(ps, ask.asks); if (say.length) return none(say, { picks: ps }); sure = false; }
    }
    const known = q.rooms.length || q.needs.length || q.cats.length || q.styles.length || q.colors.length || colors.length || colorAsk || q.gift || namedHit || furn;
    // the place you decorate ("något till soffbordet") when nothing else in the question says what you want
    if (!known && ns && ns.at && /(?:passar|har vi)(?: till exempel)?:$/.test(ns.e.on) && within(ns.e.h).length) return none([ns.e.on.replace(/(?: till exempel)?:$/, " till exempel det här.")], { picks: within(ns.e.h) });
    // renting: what needs no holes in the wall
    const rent = word(RENT.filter((w) => w !== "rent")) || (word(["rent"]) && RQ.isEnglish(text));
    if (rent) return none(["När du hyr gör textilier, lampor och tavlor som lutar mot väggen mest, och inget av det kräver hål. En sladdlös lampa kan stå var som helst."], { help: { route: "artikel-hyresvanlig-inredning", label: "Hyresvänlig inredning" }, picks: within(["affisch-linje-ekram", "plad-ullblandning-havre", "svamp-uppladdningsbar-lampa"]) });
    // the cheapest of what you asked about, or of everything
    if (word(CHEAP)) {
      const r = known ? RQ.rank(q, q.max) : [], top = r.length ? r[0].s : 0;
      const ps = byPrice(r.length ? r.filter((x) => x.s >= top * 0.7).map((x) => x.p) : RQ.PRODUCTS.filter((p) => priceOk(p, q.max))).slice(0, 3);
      if (ps.length) return none([r.length ? `Billigast är ${ps[0].name}, ${kr(ps[0].price)}.` : "Det billigaste vi har just nu:"], { picks: ps });
    }
    // the most expensive, the same way
    if (word(DEAR)) {
      const r = known ? RQ.rank(q, q.max) : [], top = r.length ? r[0].s : 0;
      const ps = byPrice(r.length ? r.filter((x) => x.s >= top * 0.7).map((x) => x.p) : RQ.PRODUCTS.filter((p) => priceOk(p, q.max))).reverse().slice(0, 3);
      if (ps.length) return none([`Dyrast är ${ps[0].name}, ${kr(ps[0].price)}.`], { picks: ps });
    }
    if (pets && !known) return none(["Saker för husdjur har vi inte, bara inredning. Med husdjur hemma håller textilier som går att tvätta och stadiga saker i stengods bäst.", "Det här går att tvätta:"], { picks: within(["lin-kuddfodral", "vila-paslakanset-linne", "vaffelhandduk-bomull"]) });
    // not understood: no advice pulled from a hat and no products that only look like an answer
    if (!known) return none(["Det där kan jag inte svara på än. Jag kan hjälpa dig med ljus, förvaring, färger, detaljer och presenter, rum för rum."], { unknown: true });
    const parts = [], craft = has(CRAFT);
    if (craft) parts.push("Måla, tapetsera och renovera kan jag inte ge råd om. Men jag kan föreslå saker som passar i rummet.");
    if (furn) parts.push(ns.e.say);
    // what the products must be: in the room you named, a lamp when you said lamp, in the colour you asked for
    const base = colors.find((c) => c.base) || (colorAsk && colors[0]);
    const asked = colors.filter((c) => !c.base), gone = asked.filter((c) => MISSING[c.k]), ok = asked.filter((c) => !MISSING[c.k]);
    if (!base) gone.forEach((c) => parts.push(MISSING[c.k][0]));
    const want = base ? COLOR_GOES[base.k][1] : colorAsk && !colors.length ? ["beige", "ek", "salvia"] : [...ok.map((c) => c.k), ...gone.flatMap((c) => MISSING[c.k][1])];
    const lamp = q.words.some((w) => LAMP.test(w) || /^läs/.test(w) || /^read/.test(w)); // reading light is a lamp, not a candle
    const inRoom = (p) => !q.rooms.length || q.rooms.some((r) => p.rooms.includes(r));
    const fitsBy = (o) => (p) => (!o.room || inRoom(p)) && (!o.lamp || !lamp || /lampa/.test(S.norm(p.name))) && (!o.color || !want.length || colorsOf(p).some((c) => want.includes(c)));
    const hexes = (o) => (o.color ? want.map((k) => (RQ.TONES.find((x) => (FAMILY[x.id] || x.id) === k) || {}).hex).filter(Boolean) : []);
    const match = (mx, o = { room: 1, lamp: 1, color: 1 }) => RQ.rank({ ...q, max: mx, colors: hexes(o), rooms: o.room ? q.rooms : [] }, mx).filter((x) => fitsBy(o)(x.p));
    const fitting = (mx) => match(mx);
    // asked for a thing we only have relatives of ("golvlampa" when there are table lamps): say that first
    const exact = (w) => RQ.PRODUCTS.some((p) => nameWords(p).some((n) => n.includes(w) || (stem(w) && n.endsWith(stem(w))) || (sameStart(n, w) >= 4 && sameStart(n, w) >= Math.min(n.length, w.length) - 2)) || enWords(p).some((n) => n === w || n + "s" === w || n === w.replace(/(?:es|s)$/, ""))); // an English name is exact too ("cushion")
    const miss = !only && q.named.find((w) => w.length >= 7 && !exact(w) && RQ.PRODUCTS.some((p) => namesIt(p, w)));
    if (miss) parts.push(`Just ”${miss}” har vi inte i sortimentet än. Det här ligger närmast.`);
    // one piece of advice at a time, so the answer stays short: colours when you asked about colour, then a gift, then what you asked for or the room
    // reading: the lamp whose own text says it is for where you read
    const readUse = (p) => [...p.use, p.short].find((u) => /läser|läsa/.test(u));
    const reader = lamp && raw.some((w) => /^(läs|read)/.test(w)) && RQ.PRODUCTS.find((p) => /lampa/.test(S.norm(p.name)) && readUse(p) && priceOk(p, q.max));
    const lampOk = RQ.PRODUCTS.some((p) => /lampa/.test(S.norm(p.name)) && priceOk(p, q.max) && inRoom(p));
    const room0 = q.rooms[0], roomFirst = room0 && ROOM_ADVICE[room0] && !LIVING.includes(room0) && !lamp;
    if (base) parts.push(COLOR_GOES[base.k][0]);
    else if (colorAsk && !colors.length) parts.push("Välj en bas, en varm ton och en kontrast. Till exempel havre som bas, ek för värmen och salvia eller grafit som kontrast.");
    else if (ok.length && !q.needs.length) parts.push((COLOR_SAY[ok[0].k] && !q.words.includes(ok[0].k) ? COLOR_SAY[ok[0].k] + " " : "") + COLOR_GOES[ok[0].k][0]);
    else if (gone.length || furn || craft || miss) { /* already said what matters */ }
    else if (reader) parts.push(`Att läsa vid är ${reader.name} bäst av våra lampor.`, readUse(reader));
    else if (word(SMALLSPACE) || (q.words.some((w) => /^(liten|litet|lilla|små|small)$/.test(w)) && word(["större", "bigger", "larger"]))) parts.push(room0 === "badrum" ? SMALL_SAY.badrum : SMALL_SAY.home);
    else if (q.words.some((w) => /^(liten|litet|lilla|små|small|tiny)$/.test(w)) && LIVING.includes(room0)) parts.push(SMALL_SAY.room);
    else if (word(KIDS)) parts.push(KIDS_SAY);
    else if (pets) parts.push("Med husdjur hemma håller textilier som går att tvätta och stadiga saker i stengods bäst.");
    else if (raw.some((w) => STYLE_SAY[w])) parts.push(STYLE_SAY[raw.find((w) => STYLE_SAY[w])]);
    else if (q.gift) parts.push(GIFT_SAY);
    else if (q.occ.includes("inflyttning")) parts.push("Grattis till flytten! Börja med ljuset och en fast plats för det du använder varje dag, så känns det som hemma fortare.");
    else if (ROOM_WARM[room0] && q.needs.includes("detaljer")) parts.push(ROOM_WARM[room0]);
    else if (roomFirst) parts.push(ROOM_ADVICE[room0]);
    else if (q.needs[0]) parts.push(ADVICE[lampOk || q.needs.length < 2 ? q.needs[0] : q.needs.find((n) => n !== "ljus")]); // lamp advice only when a lamp can be shown
    else if (room0 && ROOM_ADVICE[room0]) parts.push(ROOM_ADVICE[room0]);
    else if (q.styles.length) parts.push(RQ.STYLES[q.styles[0]].text);
    let ranked = fitting(q.max);
    // the thing you named comes alone ("har ni gardiner?" shows the curtains, not a vase next to them); "ljus" is light, not only candles
    const own = ranked.filter((x) => q.named.some((w) => !/^(ljus|light|lights)$/.test(w) && namesIt(x.p, w)) && (!only || only.includes(x.p)));
    if (own.length) { ranked = own; if (HAVE.test(t) && !parts.length && sure) parts.push("Ja, det här har vi."); else if (!parts.length && own.length === 1) parts.push(`Den vi har är ${own[0].p.name}.`, own[0].p.short); }
    // a colour you named that is also in the name ("något i ek") comes first
    const inName = (p) => ok.some((c) => COLOR_WORDS[c.k].some((w) => nameWords(p).some((n) => n === w || n.endsWith(w)) || S.norm(p.name).split(/[^a-zåäö]+/).includes(w)));
    ranked = [...ranked.filter((x) => inName(x.p)), ...ranked.filter((x) => !inName(x.p))];
    if (!parts.length) parts.push(FITS_SAY);
    // three of a kind only when that is what you asked for: among equally good answers, one per category first
    const top = ranked.length ? ranked[0].s : 0, mix = [];
    ranked.forEach((x) => { if (mix.length < 3 && x.s >= top * 0.7 && !mix.some((m) => m.p.cat === x.p.cat)) mix.push(x); });
    ranked.forEach((x) => { if (mix.length < 3 && !mix.includes(x)) mix.push(x); });
    const picks = mix.map((x) => x.p);
    // a small home and a child's room: the things that say it best, unless you named something
    const pick = (hs) => { const ps = within(hs); if (ps.length && !q.cats.length && !namedHit && !q.rooms.length) picks.splice(0, picks.length, ...ps); };
    if (parts[0] === SMALL_SAY.home) pick(["flatad-forvaringskorg", "dagsljus-linnegardin-2-pack", "svamp-uppladdningsbar-lampa"]);
    if (parts[0] === KIDS_SAY) pick(["flatad-forvaringskorg", "forvaringslada-filt"]);
    if (reader) { const i = picks.indexOf(reader); if (i) { if (i > 0) picks.splice(i, 1); picks.unshift(reader); picks.length = Math.min(picks.length, 3); } }
    let tags = null;
    // "jag har 1000 kr": a total budget, so the suggestions together stay within it
    if (picks.length > 1 && q.max && BUDGET.test(rt)) {
      const set = []; let sum = 0;
      ranked.forEach((x) => { if (set.length < 3 && sum + x.p.price <= q.max && !set.some((p) => p.cat === x.p.cat)) { set.push(x.p); sum += x.p.price; } });
      if (set.length < 2) { set.length = 0; sum = 0; byPrice(ranked.map((x) => x.p)).forEach((p) => { if (set.length < 3 && sum + p.price <= q.max && !set.some((x) => x.cat === p.cat)) { set.push(p); sum += p.price; } }); }
      if (set.length === 1) { picks.splice(0, picks.length, set[0]); parts.push(`Den ryms i din budget på ${kr(q.max)}.`); }
      if (set.length > 1) { picks.splice(0, picks.length, ...set); parts.push(`Tillsammans kostar de ${kr(sum)}, inom din budget på ${kr(q.max)}.`); }
    }
    const isLamp = (p) => /lampa/.test(S.norm(p.name));
    if (!picks.length && lamp && q.max && !RQ.PRODUCTS.some((p) => isLamp(p) && p.price <= q.max)) {
      // no lamp at that price at all: say so, and name the cheapest lamp, and the cheapest in the colours that suit when that is another one
      const low = byPrice(RQ.PRODUCTS.filter((p) => isLamp(p) && (!q.rooms.length || inRoom(p))))[0] || byPrice(RQ.PRODUCTS.filter(isLamp))[0];
      const col = want.length ? byPrice(fitting(null).map((x) => x.p))[0] : null;
      picks.push(low); tags = ["Billigast"];
      parts.push(`Under ${kr(q.max)} har vi ingen lampa. Billigast är ${low.name}, ${kr(low.price)}.`);
      if (col && col !== low) { picks.push(col); tags.push("Passar färgerna"); parts.push(`I färgerna som passar är ${col.name} billigast, ${kr(col.price)}.`); }
    }
    if (!picks.length && lamp && q.rooms.length) {
      // a lamp for a room none of ours is made for: the bathroom gets a plain no, other rooms the lamps that can stand there
      const ls = byPrice(RQ.PRODUCTS.filter((p) => isLamp(p) && priceOk(p, q.max)));
      if (q.rooms.includes("badrum")) { parts.push("Lampor för badrum har vi inte."); const c = RQ.PRODUCTS.filter((p) => p.rooms.includes("badrum") && p.cat === "belysning-atmosfar" && priceOk(p, q.max)); if (c.length) { parts.push("För stämningen finns det här:"); picks.push(...c.slice(0, 2)); } }
      else if (ls.length) { parts.push("Ingen av våra lampor är tänkt just för det rummet, men de kan stå där också."); picks.push(...ls.slice(0, 3)); }
    }
    if (!picks.length) [GIFT_SAY, FITS_SAY].forEach((x) => { const i = parts.indexOf(x); if (i > -1) parts.splice(i, 1); }); // "here are…" only when there is something to show
    if (!picks.length && !(lamp && q.rooms.includes("badrum"))) {
      // never a dead end: the nearest thing as a card, and what fits the room within the budget without the colour
      const cheapestOf = (l) => l.map((x) => x.p).sort((a, b) => a.price - b.price)[0];
      const near = cheapestOf(fitting(null)) || cheapestOf(match(q.max, { lamp: 1, color: 1 })) || cheapestOf(match(null, { lamp: 1, color: 1 })) || (!lamp && cheapestOf(match(null, { room: 1 })));
      const loose = (q.max && want.length && !lamp && match(q.max, { room: 1 }).map((x) => x.p).filter((p) => p !== near).slice(0, near ? 2 : 3)) || [];
      if (near) picks.push(near);
      picks.push(...loose);
      // each card says why it is there: the nearest one, and the ones within your budget in another colour
      if (picks.length) tags = [...(near ? ["Närmast"] : []), ...loose.map(() => `Under ${kr(q.max)}, annan färg`)];
      parts.push(q.max && near && loose.length ? `Under ${kr(q.max)} hittar jag inget som passar helt. Här är det som ligger närmast, och det bästa i andra färger.`
        : q.max && near ? `Under ${kr(q.max)} hittar jag inget som passar helt. Här är det som ligger närmast.`
        : q.max && loose.length ? `Under ${kr(q.max)} hittar jag inget i just den färgen. Här är det bästa i andra färger.`
        : near ? "Just det har vi inte än. Här är det som ligger närmast." : "Jag hittar inget i sortimentet som passar just det.");
    }
    // "Billigare förslag" is only offered when there really is something cheaper that fits
    const low = picks.length && !tags ? Math.min(...picks.map((p) => p.price)) : 0;
    const cheaper = low && fitting(low - 1).some((x) => !own.length || own.some((o) => o.p === x.p) || q.named.some((w) => namesIt(x.p, w)));
    return { q: text, text: parts, picks, tags, help: null, unknown: false, cheaper: cheaper ? low - 1 : null };
  };

  // a question written in English gets its answer in English, also on the Swedish site
  const EN_W = new Set(["the", "a", "an", "and", "or", "do", "does", "you", "your", "i'm", "my", "me", "we", "our", "is", "are", "what", "which", "how", "have", "has", "for", "with", "to", "of", "on", "it", "can", "should", "would", "something", "anything", "any", "some", "need", "want", "looking", "goes", "good", "best", "living", "bedroom", "kitchen", "bathroom", "hallway", "gift", "cheap", "between", "difference", "there", "this", "that", "sell", "ship", "return", "much", "cost", "price", "where", "when", "why", "if", "be", "make", "get", "go", "small", "big", "room", "home", "light", "lamp", "hello", "hi", "hey", "thanks", "thank", "please", "tips", "kids", "dog", "cat", "rent", "flat", "apartment", "don't", "doesn't", "isn't", "it's"]);
  const SV_W = new Set(["jag", "du", "ni", "vi", "och", "eller", "är", "har", "vad", "hur", "vilken", "vilka", "vilket", "till", "för", "med", "min", "mitt", "mina", "en", "ett", "det", "den", "som", "kan", "ska", "vill", "något", "någon", "passar", "finns", "mellan", "kostar", "rum", "rummet", "att", "på", "av", "inte", "hej", "tack", "mig", "dig", "oss", "sig", "lite", "mycket", "bra", "fin", "när", "var", "varför", "om", "hem", "hemma", "bara", "också", "nu", "så", "sen", "efter", "utan", "lägenhet", "barn", "hund", "katt"]);
  RQ.isEnglish = (text) => { const w = S.norm(text).replace(/[.,!?;:()"]/g, " ").split(/\s+/).filter(Boolean); let en = 0, sv = /[åäö]/.test(S.norm(text)) ? 2 : 0; w.forEach((x) => { if (EN_W.has(x)) en++; if (SV_W.has(x)) sv++; }); return en > sv; };
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
          <form id="chatForm"><label class="sr" for="chatIn">Din fråga</label><input id="chatIn" type="text" placeholder="Skriv din fråga" autocomplete="off" enterkeyhint="send" maxlength="400"><button class="btn" type="submit">Fråga</button></form></div>
        <aside><div class="panel"><label>Högsta pris per produkt (kr, valfritt)<input type="number" id="maxP" min="1" step="50" inputmode="numeric" placeholder="Inget maxpris"></label></div>
          <p class="note">Råden är inspiration, inte verifierade produktuppgifter.</p><p class="small" id="chatNote" style="margin-top:.8rem"></p><button class="btn ghost sm" type="button" id="chatClear" style="margin-top:.8rem">Rensa samtalet</button></aside>
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
      const handles = (l) => (l || []).map((x) => (typeof x === "string" ? RQ.byHandle(x) : x)).filter(Boolean);
      const prods = (a) => handles(a.picks);
      const mini = (ps, tags) => (ps.length ? `<div class="mini">${ps.map((p, i) => `<a href="#produkt-${p.handle}"${tags && tags[i] ? ' class="tagged"' : ""}><img src="${RQ.img(p, 600)}" alt="" loading="lazy" width="600" height="750">${tags && tags[i] ? `<small>${esc(tags[i])}</small>` : ""}<span>${esc(p.name)}</span><b>${kr(p.price)}</b></a>`).join("")}</div>` : "");
      // after an answer: put the suggestions in your room, or ask for cheaper ones
      const follow = (a) => { const ps = prods(a); if (!ps.length) return "";
        return `<div class="follow"><button class="chip" type="button" data-inroom="${ps.map((p) => p.handle).join(",")}">Ställ in i Mitt rum</button>${a.cheaper ? `<button class="chip" type="button" data-cheaper="${+a.cheaper}" data-q="${esc(a.q || "")}">Billigare förslag</button>` : ""}</div>`; };
      const answerHtml = (a) => { const text = Array.isArray(a.text) ? a.text : [a.text];
        return `${text.map((p) => `<p>${esc(p)}</p>`).join("")}${a.help ? `<p><a class="msg-help" href="#${esc(a.help.route)}">${esc(a.help.label)}</a></p>` : ""}${a.unknown || a.hi ? `<div class="follow">${starters.slice(0, 2).map((q) => `<button class="chip" type="button" data-try="${esc(q)}">${esc(q)}</button>`).join("")}${a.unknown ? '<a class="chip" href="#kontakt">Kontakta oss</a>' : ""}</div>` : ""}${mini(handles(a.picks), a.tags)}${follow(a)}`; };
      // an answer to an English question is shown in English (the dictionary is loaded the first time it is needed)
      const toEn = (a) => a.en && window.RQ_LANG !== "en" && window.RQ_toEn;
      const show = (el, a, then) => { const html = answerHtml(a); if (!toEn(a)) { el.innerHTML = html; return then && then(); } const d = document.createElement("div"); d.innerHTML = html; window.RQ_toEn(d).then(() => { el.lang = "en"; el.innerHTML = d.innerHTML; }, () => { el.innerHTML = html; }).then(() => then && then()); };
      hist.forEach((m) => { if (m.who === "me") add("me", esc(m.text)); else show(add("ai", ""), m.a); });
      const st = $("#starters", root); if (hist.length) st.remove();
      let busy = false;
      const ask = (text, opt = {}) => {
        if (busy) return; // one question at a time
        if (!text.trim()) { inp.focus(); return; } if (st.isConnected) st.remove();
        if (!document.activeElement || document.activeElement === document.body) inp.focus({ preventScroll: true }); // the starter that had the focus is gone: the focus goes to the field, the answer is read from the log
        busy = true; armed = false; if (clr) clr.textContent = "Rensa samtalet";
        const q = opt.q || text;
        const me = add("me", esc(text)); const typing = add("ai", '<span class="typing"><i></i><i></i><i></i></span>');
        const a = RQ.stylistAnswer(q, opt.max || maxOf($("#maxP", root)));
        const stored = { q, text: a.text, picks: a.picks.map((p) => p.handle), tags: a.tags || null, hi: !!a.hi, help: a.help, unknown: a.unknown, cheaper: a.cheaper, en: RQ.isEnglish(q) };
        if (toEn(stored)) window.RQ_toEn(opt.q ? me : null).catch(() => {}); // start loading the English words while the dots show ("Billigare förslag" in English too)
        setTimeout(() => { busy = false; if (!typing.isConnected) return; show(typing, stored, () => { RQ.toHashLinks && RQ.toHashLinks(typing); log.scrollTop += me.getBoundingClientRect().top - log.getBoundingClientRect().top - 10; }); }, 700);
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
    html: `<header class="page-head wrap">${crumbs("Med egna ord")}<h1 class="h1">Med egna ord</h1><p class="lead">Beskriv i en mening vad du behöver, med egna ord. Rum, färg, stil och maxpris förstår vi.</p></header>
      <section class="wrap" style="padding-bottom:5rem"><form id="ssForm" class="ss-form" novalidate><label for="ssIn">Vad letar du efter?</label><div class="field"><input id="ssIn" autocomplete="off" enterkeyhint="search" placeholder="Till exempel: något grönt och mjukt till soffan under 300 kr"><button class="btn" type="submit">Sök</button></div></form>
        <div class="chips" style="margin-top:1rem">${["Mjukt ljus till sovrummet", "Ordning i hallen under 400 kr", "Något i ek till köket", "Present till en värd"].map((s) => `<button class="chip" type="button" data-ss="${s}">${s}</button>`).join("")}</div>
        <p class="note">I förhandsversionen tolkas meningen med regler mot RumIQs sortiment, inte av en AI-tjänst.</p>
        <div id="ssOut" style="margin-top:2.4rem"></div></section>`,
    mount(root) {
      const out = $("#ssOut", root), inp = $("#ssIn", root);
      const run = (text, show) => {
        if (!text.trim()) { out.innerHTML = ""; inp.focus(); return; } // nothing asked: nothing to say "not found" about
        keep.set("rumiq-ord", text);
        const q = RQ.parseNeed(text); let r = RQ.rank(q);
        // the thing you named but not at that price ("grön matta under 200 kr"): the nearest of that thing, not a box that only shares the colour
        const named = (x) => x.why.includes("det du nämnde"), namedAll = RQ.rank({ ...q, max: null }).filter(named);
        const underNamed = q.max && namedAll.length && !r.some(named);
        if (underNamed) r = [];
        const understood = [...q.rooms.map((x) => RQ.roomById(x).name), ...q.cats.map((x) => RQ.catById(x).name), ...q.needs.map((x) => RQ.NEEDS[x]), ...q.styles.map((x) => RQ.STYLES[x].name), ...q.colors.map((h) => [toneName(h), h]), ...(q.max ? ["Högst " + kr(q.max)] : []), ...(q.gift ? ["Present"] : [])];
        const read = q.fixed.length ? `<p class="small ss-read">${q.fixed.map(([a, b]) => `<span>Vi läste</span> ”${esc(a)}” <span>som</span> ”${esc(b)}”.`).join(" ")}</p>` : "";
        const under = q.max && !r.length && RQ.rank({ ...q, max: null }).length; // something fits, but nothing that cheap
        const nearest = underNamed ? namedAll.map((x) => x.p) : RQ.rank({ ...q, max: null }).map((x) => x.p);
        // one or two hits under your limit: what else fits, without the limit, as the gift finder offers more
        const inTone = (p) => q.colors.some((h) => colorsOf(p).includes(fam(h))); // the colour you named, itself, first
        const wider = r.length && r.length < 3 && q.max ? RQ.rank({ ...q, max: null }).filter((x) => !r.some((y) => y.p === x.p)).sort((x, y) => inTone(y.p) - inTone(x.p)).slice(0, 4 - r.length).map((x) => x.p) : [];
        out.innerHTML = `${understood.length ? `<p class="eyebrow" style="margin-bottom:.8rem">Det här förstod vi</p><ul class="chips ss-got" style="margin-bottom:${read ? ".8rem" : "2rem"}">${understood.map((u) => (Array.isArray(u) ? `<li class="chip tone"><i style="background:${u[1]}"></i>${esc(u[0])}</li>` : `<li class="chip">${esc(u)}</li>`)).join("")}</ul>` : ""}${read}
          ${r.length ? `<div class="grid">${r.slice(0, 8).map((x) => RQ.card(x.p).replace("</article>", `<p class="small" style="margin-top:.3rem">Matchar: ${esc(x.why.slice(0, 3).join(", "))}</p></article>`)).join("")}</div>${wider.length ? `<p class="eyebrow" style="margin:2.4rem 0 1.4rem">Utan prisgränsen:</p>${RQ.grid(wider)}` : ""}`
            : under ? `<p class="eyebrow" style="margin-bottom:1.4rem"><span>Inget under</span> ${kr(q.max)}<span>. Det här ligger närmast i pris:</span></p>${RQ.grid(byPrice(nearest).slice(0, 4))}<div class="ctrl-row" style="justify-content:center;margin-top:2rem"><button class="btn ghost" type="button" id="ssNoMax">Visa utan maxpris</button></div>`
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
        <div class="q" id="gQ1"><h2><span class="q-n">1</span>Vilket rum?</h2>${roomOpts()}</div>
        <div class="q" id="gQ2"><h2><span class="q-n">2</span>Vad behöver du mest?</h2>${picOpts("need", Object.entries(RQ.NEEDS).map(([k, v]) => [k, softWrap(v), pimg(NEED_IMG[k])]), "Vad behöver du mest?")}</div>
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
          ? `${head(esc(ADVICE[a.need]))}<div style="margin-top:2rem">${RQ.grid(list)}</div>${extra.length ? `<div class="list-more"><h3 class="h3"><span>Mer för</span> <span>${esc(rn)}</span></h3>${RQ.grid(extra.slice(0, 4))}</div>` : ""}`
          // nothing for exactly this: say so, instead of advice about one thing above products for another
          : fits.length ? `${head(`<span>Inget under</span> ${kr(max)} <span>här. Det här ligger närmast i pris:</span>`)}<div style="margin-top:2rem">${RQ.grid(byPrice(fits).slice(0, 4))}</div>${noMax}`
          : extra.length ? `${head(`<span>Vi har inget för just</span> <span>${esc(nn)}</span> <span>i</span> <span>${esc(rn)}</span> <span>än. Det här passar i rummet:</span>`)}<div style="margin-top:2rem">${RQ.grid(extra.slice(0, 8))}</div>`
          : max && inRoom.length ? `${head(`<span>Inget under</span> ${kr(max)} <span>här. Det här ligger närmast i pris:</span>`)}<div style="margin-top:2rem">${RQ.grid(byPrice(inRoom).slice(0, 4))}</div>${noMax}`
          : `${head(`<span>Vi har inget för</span> <span>${esc(rn)}</span> <span>än.</span>`)}<a class="btn ghost" href="#butik" style="margin-top:1.2rem">Se allt i butiken</a>`;
        const nm = $("#gNoMax", out); if (nm) nm.addEventListener("click", () => { gmax.value = ""; run(true); });
        RQ.watch(root); RQ.markImages && RQ.markImages(out);
        if (show) showOut(out);
      };
      $$("[data-q]", root).forEach((g) => g.addEventListener("click", (e) => {
        const b = e.target.closest("[data-v]"); if (!b) return; const off = b.getAttribute("aria-pressed") === "true";
        $$("[data-v]", g).forEach((x) => x.setAttribute("aria-pressed", !off && x === b)); a[g.dataset.q] = off ? null : b.dataset.v;
        // one answer leads to the next thing: the second question, then the result
        if (a.room && a.need) run(true); else if (!off && g.dataset.q === "room") toNext($("#gQ2", root));
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
        <div class="q" id="gfQ1"><h2><span class="q-n">1</span>Vem är presenten till?</h2>${picOpts("for", Object.entries(RQ.GIFT_FOR).map(([k, v]) => [k, v, pimg(FOR_IMG[k])]), "Vem är presenten till?")}</div>
        <div class="q" id="gfQ2"><h2><span class="q-n">2</span>Tillfället</h2>${picOpts("occ", Object.entries(RQ.OCCASIONS).map(([k, v]) => [k, v, pimg(OCC_IMG[k])]), "Tillfället")}</div>
        <div class="q" id="gfQ3"><h2><span class="q-n">3</span>Mottagarens stil <small>Hoppa över om du inte vet</small></h2>${picOpts("style", ["skandinavisk", "minimalistisk", "klassisk", "mjuk"].map((k) => [k, RQ.STYLES[k].name, STYLE_IMG[k]]), "Mottagarens stil")}</div>
        <div class="q q-max"><label>Högsta presentpris (kr)<input type="number" id="gfMax" min="1" step="50" inputmode="numeric" placeholder="Till exempel 500"></label><div class="ctrl-row"><button class="btn" type="button" id="gfGo">Hitta en present</button><a class="btn ghost" href="#presentkort">Hellre ett presentkort</a></div></div>
        <div id="gfOut" class="q-out"></div></section>`,
    mount(root) {
      const a = {}, out = $("#gfOut", root), gfMax = $("#gfMax", root);
      const run = (show, all) => {
        if (!a.for && !a.occ) { RQ.toast("Välj vem presenten är till eller tillfället."); if (show) $("#gfQ1", root).scrollIntoView({ behavior: "smooth", block: "center" }); return; }
        const max = maxOf(gfMax);
        keep.set("rumiq-gift", { for: a.for || null, occ: a.occ || null, style: a.style || null, max });
        const score = (p) => (a.for && p.gift.includes(a.for) ? 3 : 0) + (a.occ && p.occ.includes(a.occ) ? 3 : 0) + (a.style && p.styles.includes(a.style) ? 2 : 0) + (p.gift.length ? 1 : 0);
        const fits = RQ.PRODUCTS.map((p) => ({ p, s: score(p) })).filter((x) => x.s > 1).sort((x, y) => y.s - x.s), scored = fits.filter((x) => priceOk(x.p, max));
        const n = all ? scored.length : Math.min(8, scored.length); // eight: full rows of four or two (tablets show six, three by three)
        // fewer than three ideas: more of what costs no more than your limit, and the gift card as a way out
        const more = scored.length < 3 && max ? RQ.PRODUCTS.filter((p) => p.price <= max && !scored.some((x) => x.p === p)).sort((x, y) => (y.gift.length ? 1 : 0) - (x.gift.length ? 1 : 0) || x.price - y.price).slice(0, 4 - scored.length) : [];
        out.innerHTML = scored.length
          ? `<p class="eyebrow" style="margin-bottom:1.4rem">${n < scored.length ? `<span>De bästa av</span> ${scored.length} <span>förslag</span>` : `${scored.length} <span>förslag</span>`}${more.length ? ` + ${more.length} <span>till i din prisklass</span>` : max ? ` <span>upp till</span> ${kr(max)}` : ""}</p>${more.length ? `<div class="grid">${[...scored.map((x) => RQ.card(x.p)), ...more.map((p) => RQ.card(p).replace("</article>", '<p class="small" style="margin-top:.3rem">Också i din prisklass</p></article>'))].join("")}</div><div class="ctrl-row" style="justify-content:center;margin-top:2rem"><a class="btn ghost" href="#presentkort">Hellre ett presentkort</a></div>` : RQ.grid(scored.slice(0, n).map((x) => x.p), all ? "" : "feat")}${n < scored.length ? `<div class="ctrl-row" style="justify-content:center;margin-top:2rem"><button class="btn ghost" type="button" id="gfAll">Visa alla ${scored.length}</button></div>` : ""}`
          : fits.length ? `<p class="eyebrow" style="margin-bottom:1.4rem"><span>Inget under</span> ${kr(max)}<span>. Det här ligger närmast i pris:</span></p>${RQ.grid(byPrice(fits.map((x) => x.p)).slice(0, 4))}<div class="ctrl-row" style="justify-content:center;margin-top:2rem"><button class="btn ghost" type="button" id="gfNoMax">Visa utan maxpris</button></div>`
          : `<div class="empty">${`<h3>Inget passar riktigt</h3><p>Prova ett annat tillfälle, eller ge ett presentkort.</p><a class="btn ghost" href="#presentkort">Till presentkortet</a>`}</div>`;
        const nm = $("#gfNoMax", out); if (nm) nm.addEventListener("click", () => { gfMax.value = ""; run(true); });
        const al = $("#gfAll", out); if (al) al.addEventListener("click", () => run(false, true));
        RQ.watch(root); RQ.markImages && RQ.markImages(out);
        if (show) showOut(out);
      };
      $$("[data-q]", root).forEach((g) => g.addEventListener("click", (e) => { const b = e.target.closest("[data-v]"); if (!b) return; const off = b.getAttribute("aria-pressed") === "true"; $$("[data-v]", g).forEach((x) => x.setAttribute("aria-pressed", !off && x === b)); a[g.dataset.q] = off ? null : b.dataset.v; if (out.firstChild) run(false);
        else if (!off) toNext(g.dataset.q === "for" ? $("#gfQ2", root) : g.dataset.q === "occ" ? $("#gfQ3", root) : $("#gfGo", root)); })); // one answer leads to the next question
      $("#gfGo", root).addEventListener("click", () => run(true));
      gfMax.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); run(true); } });
      const was = keep.get("rumiq-gift");
      if (was && (was.for || was.occ)) { ["for", "occ", "style"].forEach((k) => { if (was[k]) { a[k] = was[k]; press(root, k, was[k]); } }); gfMax.value = was.max || ""; run(false); }
    },
  });

  /* ---------------------------------------------------------------- Sparat (address mitt-hem): everything you saved, in one place */
  V.myHome = () => {
    const projects = S.projects(), wish = S.wishlist(), looks = S.looks(), arts = S.savedArticles().map(RQ.articleBySlug).filter(Boolean);
    const st0 = S.style(), style = st0 && RQ.STYLES[st0.style] ? st0 : null; // a stored style we do not know is treated as none
    // an empty part is one quiet line with its way in, not a large empty box: a new visitor sees the whole page on two screens
    const none = (title, text, href, label) => `<div class="mh-none"><p><b>${title}</b> <span>${text}</span></p><a class="link" href="${href}">${label}</a></div>`;
    const safeImg = (u) => (/^(data:image\/|assets\/)/.test(String(u || "")) ? esc(u) : ""); // only our own pictures and saved room photos
    return {
      title: "Sparat · RumIQ",
      html: `<header class="page-head wrap">${RQ.crumbs([["Hem", "hem"], ["Sparat"]])}<span class="eyebrow">Ditt privata bibliotek</span><h1 class="h1">Sparat</h1><p class="lead">Det du har sparat, dina rum och mått, din stil och dina looks, samlat så att du kan fortsätta där du slutade.</p>
          <nav class="jump-nav" aria-label="På sidan"><a href="#mh-fav">Produkter (${wish.length})</a><a href="#mh-matt">Mina rum och mått (${RQ.homeRooms ? RQ.homeRooms.list().length : 0})</a><a href="#mh-stil">Min stil</a><a href="#mh-rum">Rumsprojekt (${projects.length})</a><a href="#mh-looks">Looks (${looks.length})</a><a href="#mh-art">Artiklar (${arts.length})</a></nav></header>
        <section class="wrap mh" style="padding-bottom:5rem;display:grid;gap:3.2rem">
          <div id="mh-fav"><div class="sec-row"><div class="sec-head"><h2 class="h3">Produkter</h2></div>${wish.length ? `<span class="mh-favacts"><button class="btn ghost sm" type="button" data-share-wish><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v6h14v-6"/></svg><span>Dela listan</span></button><a class="link" href="#onskelista">Listor per rum</a></span>` : ""}</div>${wish.length ? RQ.grid(wish) : ""}${wish.length && RQ.priceWatch ? RQ.priceWatch.html(wish.map((p) => p.handle), "mhw") : ""}${wish.length ? "" : `${none("Inget sparat än.", "Tryck på hjärtat på en produkt, så hamnar den här.", "#butik", "Till butiken")}${RQ.svepNudge ? RQ.svepNudge() : ""}`}</div>
          ${RQ.homeRooms ? RQ.homeRooms.html() : ""}
          <div id="mh-stil"><div class="sec-head"><h2 class="h3">Min stil</h2></div>${style ? `<div class="result"><h2>${RQ.STYLES[style.style].name}</h2><p style="margin-top:.5rem">${RQ.STYLES[style.style].text}</p>${RQ.styleProfile && RQ.taste.get().n ? `<div class="sp-mix" style="max-width:30rem;margin-top:1rem">${RQ.styleProfile().mix.map((m) => `<div class="sp-row"><span>${esc(m.name)}</span><span class="sp-bar"><i style="width:${m.pct}%"></i></span><b>${m.pct} %</b></div>`).join("")}</div>` : ""}<p class="small">Uppdaterad ${new Date(style.at).toLocaleDateString("sv-SE")}.</p><div class="ctrl-row"><a class="btn sm" href="#svep">Svep mer</a><a class="btn ghost sm" href="#studio-stil">Fyra snabba val</a></div></div>` : none("Ingen stil än.", "Svep tio kort, så får du din stilprofil.", "#svep", "Svep fram din stil")}</div>
          <div id="mh-rum"><div class="sec-row"><div class="sec-head"><h2 class="h3">Rumsprojekt</h2></div>${projects.length > 1 ? `<button class="chip" type="button" id="cmpBtn">Jämför två sida vid sida</button>` : ""}</div>
            ${projects.length ? `<div class="cols3" id="projects">${projects.map((p) => `<article class="colcard" style="cursor:default"><div class="im" style="aspect-ratio:4/3"><img src="${safeImg(p.img)}" alt="${esc(p.title)}"></div><div class="tx"><label class="check" style="font-size:.85rem;margin-bottom:.6rem"><input type="checkbox" data-cmp="${esc(p.id)}"> Välj för jämförelse</label><h3 class="h3">${esc(p.title)}</h3><p class="small">${new Date(p.at).toLocaleDateString("sv-SE")}</p><label style="margin-top:.8rem">Anteckning<textarea rows="2" data-note="${esc(p.id)}">${esc(p.note || "")}</textarea></label><div class="ctrl-row"><button class="btn sm" type="button" data-look-buy="${esc((p.handles || []).join(","))}" data-look-name="Rummet">Lägg i varukorgen</button><button class="btn ghost sm" type="button" data-room-all="${esc((p.handles || []).join(","))}">Se i Mitt rum</button><button class="chip" type="button" data-del="${esc(p.id)}">Ta bort</button></div></div></article>`).join("")}</div><div id="cmpOut"></div>` : none("Inga rumsprojekt än.", "Ställ in saker i ett foto av ditt rum och spara resultatet.", "#mitt-rum", "Till Mitt rum")}</div>
          <div id="mh-looks"><div class="sec-head"><h2 class="h3">Sparade looks</h2></div>${looks.length ? `<div class="mylooks">${RQ.savedLooksHtml()}</div>` : none("Inga looks än.", "Spara en färdig look, eller bygg en egen i Mitt rum.", "#looks", "Se alla looks")}</div>
          <div id="mh-art"><div class="sec-head"><h2 class="h3">Sparade artiklar</h2></div>${arts.length ? `<div class="mag-grid">${arts.map(RQ.magCard).join("")}</div>` : none("Inga sparade artiklar.", "Spara en artikel i magasinet, så hamnar den här.", "#magasin", "Till magasinet")}</div>
          <div class="panel"><h3 class="h3">Dina uppgifter</h3><p class="small" style="margin-top:.5rem">I förhandsversionen finns allt du sparat bara i den här webbläsaren. Inget skickas till oss. Du kan ta bort allt när du vill.</p><button class="btn ghost sm" type="button" id="clearAll" style="margin-top:1rem">Rensa allt sparat</button><p class="small" id="clearNote" role="status" style="margin-top:.6rem"></p></div>
        </section>`,
      mount(root) {
        RQ.homeRooms && RQ.homeRooms.mount(root);
        root.addEventListener("click", (e) => {
          const d = e.target.closest("[data-del]"); if (d) { S.deleteProject(d.dataset.del); RQ.router(); return; }
          const dl = e.target.closest("[data-dellook]"); if (dl) { S.deleteLook(dl.dataset.dellook); RQ.router(); return; }
        });
        $$("[data-note]", root).forEach((t) => t.addEventListener("change", () => S.updateProject(t.dataset.note, { note: t.value })));
        const cb = $("#cmpBtn", root);
        if (cb) cb.addEventListener("click", () => {
          const ids = $$("[data-cmp]:checked", root).map((x) => x.dataset.cmp); const ps = S.projects();
          const pair = (ids.length === 2 ? ids.map((id) => ps.find((p) => p.id === id)) : ps.slice(0, 2)).filter(Boolean);
          $("#cmpOut", root).innerHTML = `<div class="split" style="margin-top:2rem;align-items:start">${pair.map((p) => `<div><img src="${safeImg(p.img)}" alt="" style="border-radius:var(--r);width:100%"><h3 class="h3" style="margin-top:.7rem">${esc(p.title)}</h3><p class="small">${esc(p.note || "Ingen anteckning")}</p></div>`).join("")}</div>`;
          $("#cmpOut", root).scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
        let armed = false;
        $("#clearAll", root).addEventListener("click", (e) => {
          // say exactly what goes before it goes: the same button also empties the cart and signs out
          if (!armed) { armed = true; e.currentTarget.textContent = "Tryck igen för att ta bort allt"; $("#clearNote", root).textContent = "Det du har sparat, dina listor, rum och mått, din stil, ditt rumsfoto, samtalet med stylisten, varukorgen och testbeställningarna tas bort från den här webbläsaren, och du loggas ut. Det går inte att ångra."; return; }
          S.clearAll();
          if (RQ.room && RQ.room.clear) RQ.room.clear(); // the room photo and what stands in it
          ["rumiq-chat-saved", "rumiq-ai-consent"].forEach((k) => { try { localStorage.removeItem(k); } catch (er) {} });
          ["rumiq-chat", "rumiq-svep-result", "rumiq-svep-two", "rumiq-svep-carry", "rumiq-guide", "rumiq-gift", "rumiq-ord", "rumiq-list"].forEach((k) => { try { sessionStorage.removeItem(k); } catch (er) {} });
          RQ.toast("Allt sparat är borttaget."); RQ.router(); scrollTo(0, 0);
        });
        return RQ.jumpSpy($(".jump-nav", root), root);
      },
    };
  };
})();
