/* Language layer. Swedish is written in the code; English comes from i18n-en.js, a phrase
   dictionary that is applied to the page after each render. Swedish visitors load it only if they
   write to the stylist in English (RQ_toEn).
   Switch language with RQ.setLang("en" | "sv"); the choice is kept in this browser. */
(function () {
  const read = () => { try { return JSON.parse(localStorage.getItem("rumiq-lang")) || ""; } catch (e) { return ""; } };
  const LANG = read() === "en" ? "en" : "sv";
  window.RQ_LANG = LANG;
  document.documentElement.lang = LANG;
  const SRC = "assets/js/i18n-en.js";
  if (LANG === "en") document.write('<script src="' + SRC + '"><\/script>');

  window.RQ_setLang = (l) => { try { localStorage.setItem("rumiq-lang", JSON.stringify(l === "en" ? "en" : "sv")); } catch (e) {} location.reload(); };
  // the translator, built from the dictionary: for the English site after each render, and on the Swedish site
  // only when someone writes to the stylist in English (RQ_toEn loads the dictionary then, never before)
  function make() {
    const EN = window.RQ_EN || { dict: {}, prods: [] };
    const D = EN.dict;
    // product names: data.js says each product's English name (field en), so a name is written in one place;
    // the dictionary's own list is only for names data.js does not have
    const own = ((window.RQ && window.RQ.PRODUCTS) || []).filter((p) => p.en).map((p) => [p.name, p.en]);
    const ALL = [...own, ...EN.prods.filter(([sv]) => !own.some((o) => o[0] === sv))];
    const PRODS = ALL.slice().sort((a, b) => b[0].length - a[0].length);
    const PROD_EN = Object.fromEntries(ALL);
    own.forEach(([sv, en]) => (D[sv] = en)); // a name on its own (a card, a heading) is the same name
    const NUM = /\d+(?:[  ]\d{3})*(?:[.,]\d+)?/g;
    const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
    const L = "ABCDEFGH";
    const cache = new Map();

    const fmtNum = (n) => (/^\d{1,3}([  ]\d{3})+$/.test(n) ? n.replace(/[  ]/g, ",") : n);

    function viaTemplate(s, withEmail) {
      const prods = [], nums = [], mails = [];
      let t = s;
      for (const [sv] of PRODS) { let i; while ((i = t.indexOf(sv)) > -1 && prods.length < 8) { t = t.slice(0, i) + "{P" + L[prods.length] + "}" + t.slice(i + sv.length); prods.push(sv); } }
      if (withEmail) t = t.replace(EMAIL, (m) => { mails.push(m); return "{E}"; });
      let k = 0; t = t.replace(NUM, (m) => { nums.push(m); return "{" + k++ + "}"; });
      if (t === s || !(t in D)) return null;
      return D[t].replace(/\{P([A-H])\}/g, (_, c) => PROD_EN[prods[L.indexOf(c)]] || prods[L.indexOf(c)])
                 .replace(/\{(\d+)\}/g, (_, i) => fmtNum(nums[+i] || ""))
                 .replace(/\{E\}/g, () => mails.shift() || "");
    }
    const RULES = [
      [/^Matchar: (.+)$/, (m) => { const p = m[1].split(", ").map(one); return p.every(Boolean) ? "Matches: " + p.join(", ") : null; }],
      [/^Hej (.+)$/, (m) => "Hi " + m[1]],
      [/^Hela looken (.+)$/, (m) => { const a = one(m[1]); return a ? "Whole look " + a : null; }],
      [/^Sparad i (.+)\.$/, (m) => "Saved in " + (one(m[1]) || m[1]) + "."],
      [/^Inga träffar på [”"](.*)[”"]$/, (m) => `No results for “${m[1]}”`],
      [/^Inloggad med (.+) \(testkonto\)\.$/, (m) => `Signed in with ${m[1]} (test account).`],
      [/^Köpet ångrades redan (.+)\.$/, (m) => `The purchase was already cancelled ${m[1]}.`],
      [/^När inloggningen är kopplad öppnas (\w+?)s egen inloggning, och du kommer tillbaka hit inloggad\. I förhandsversionen skapar vi ett testkonto i stället\.$/, (m) => `Once sign-in is connected, ${m[1]}'s own sign-in opens, and you come back here signed in. In the preview we create a test account instead.`],
      [/^(.+) \((\d+)\)$/, (m) => { const a = one(m[1]); return a ? `${a} (${m[2]})` : null; }],
      /* Placera och skapa (v15.7): a room's name, and lists of things */
      [/^(\d+) (.+), (står|ligger|hänger) (på|i|vid) (golvet|bordet|väggen|sängen|soffan), flytta med piltangenterna$/, (m) => `${m[1]} ${one(m[2]) || m[2]}, ${{ "står": "stands", "ligger": "lies", "hänger": "hangs" }[m[3]]} ${m[4] === "vid" ? "by" : m[4] === "i" ? "in" : "on"} the ${PLC[m[5]]}, move with the arrow keys`],
      [/^Öppna (.+)$/, (m) => { const a = one(m[1]); return a ? `Open ${a}` : null; }],
      [/^(står|ligger|hänger) (på|i|vid) (golvet|bordet|väggen|sängen|soffan)( · .+)?$/, (m) => `${{ "står": "stands", "ligger": "lies", "hänger": "hangs" }[m[1]]} ${m[2] === "vid" ? "by" : m[2] === "i" ? "in" : "on"} the ${PLC[m[3]]}${m[4] ? " · " + (one(m[4].slice(3)) || m[4].slice(3)) : ""}`],
      [/^(.+) (står|ligger|hänger) (på|i|vid) (golvet|bordet|väggen|sängen|soffan)\.$/, (m) => `${list(m[1])} ${{ "står": "stands", "ligger": "lies", "hänger": "hangs" }[m[2]]} ${m[3] === "vid" ? "by" : m[3] === "i" ? "in" : "on"} the ${PLC[m[4]]}.`],
      [/^Bilden finns nu i (.+) under$/, (m) => `The image is now in ${one(m[1]) || m[1]} under`],
      [/^, under (.+), på den här enheten\.$/, (m) => `, under ${one(m[1]) || m[1]}, on this device.`],
      [/^Fick inte plats: (.+)\. Det finns ingen ledig bordsyta för (den|dem) i rummet\.$/, (m) => `No room for: ${list(m[1])}. There is no free table top for ${m[2] === "den" ? "it" : "them"} in the room.`],
      [/^Väntar: (.+)\.$/, (m) => `Waiting: ${list(m[1])}.`],
      [/^Filter: (.+)$/, (m) => `Filter: ${m[1].split(" · ").map((x) => one(x) || x.replace(/^under /, "under ")).join(" · ")}`],
      [/^(.+) är med nu\.$/, (m) => `${list(m[1])} ${m[1].includes(", ") ? "are" : "is"} in now.`],
      [/^(.+) är borttagen\.$/, (m) => `${list(m[1])} is removed.`],
      [/^(.+) är med i bilden\. (.+) väntar, bilden tar fem saker åt gången\.$/, (m) => `${list(m[1])} is in the picture. ${list(m[2])} is waiting; the picture takes five things at a time.`],
      [/^(.+) är med i bilden nu\. (.+) väntar\.$/, (m) => `${list(m[1])} is in the picture now. ${list(m[2])} is waiting.`],
      [/^Målet: hemma före jul om du beställer senast (.+)\.$/, (m) => `Target: home before Christmas if you order by ${m[1]}.`],
      [/^(.+), (\d+) × (\d+) cm, i samma skala som (.+)$/, (m) => `${one(m[1]) || m[1]}, ${m[2]} × ${m[3]} cm, at the same scale as ${({ "ett A4-papper": "an A4 sheet", "en person, 170 cm": "a person, 170 cm", "en soffa, 200 × 90 cm": "a sofa, 200 × 90 cm" })[m[4]] || m[4]}`],
      [/^(.+) är klart\. Snyggt!$/, (m) => `${one(m[1]) || m[1]} is done. Nice!`],
      [/^(.+) är inte markerat som klart\.$/, (m) => `${one(m[1]) || m[1]} is no longer marked as done.`],
      /* Svep v15.9: a duel, a whole look, the thing in your room */
      [/^Välj (.+), (\d{1,3}(?:[  ]\d{3})*) kr$/, (m) => `Choose ${one(m[1]) || m[1]}, ${fmtNum(m[2])} kr`],
      [/^Se (.+) i ditt rum$/, (m) => `See ${one(m[1]) || m[1]} in your room`],
      [/^(.+) i ditt rum$/, (m) => { const a = one(m[1]); return a ? `${a} in your room` : null; }],
      [/^(.+?[.?]) (Nästa: .+)$/, (m) => { const x = translate(m[1]), y = translate(m[2]); return x && y ? `${x} ${y}` : null; }],
      [/^Sparade hela looken ([^.]+)\.$/, (m) => `Saved the whole look ${one(m[1]) || m[1]}.`],
      [/^Hela looken ([^.]+) ligger i varukorgen\.$/, (m) => `The whole look ${one(m[1]) || m[1]} is in the cart.`],
      [/^Nästa: Hela looken ([^.]+)\.$/, (m) => `Next: the whole look ${one(m[1]) || m[1]}.`],
      [/^Nästa: Kommer snart\? ([^.]+)\.$/, (m) => `Next: Coming soon? ${one(m[1]) || m[1]}.`],
      [/^(Står|Ligger|Hänger) (på|i) (golvet|bordet|väggen|sängen|soffan), alltid\.$/, (m) => `${{ "Står": "Stands", "Ligger": "Lies", "Hänger": "Hangs" }[m[1]]} on the ${{ golvet: "floor", bordet: "table", "väggen": "wall", "sängen": "bed", soffan: "sofa" }[m[3]]}, always.`],
    ];
    const PLC = { golvet: "floor", bordet: "table", "väggen": "wall", "sängen": "bed", soffan: "sofa" };
    const list = (x) => x.split(", ").map((n) => one(n) || n).join(", ");
    function one(s) {
      if (s in D) return D[s];
      return viaTemplate(s, false) || viaTemplate(s, true);
    }
    function translate(raw) {
      const s = raw.replace(/\s+/g, " ").trim();
      if (!s || !/[A-Za-zÅÄÖåäö]/.test(s)) return null;
      if (cache.has(s)) return cache.get(s);
      let out = one(s);
      if (!out) for (const [re, fn] of RULES) { const m = s.match(re); if (m && (out = fn(m))) break; }
      if (!out && s.includes(", ")) { const p = s.split(", ").map(one); if (p.every(Boolean)) out = p.join(", "); }
      // "Svep · Kök", "1 st · Havre" and page titles ("Populärt · RumIQ"): each part on its own, the brand stays
      if (!out && s.includes(" · ")) { const p = s.split(" · ").map((x) => (/^RumIQ( Studio)?$/.test(x) || !/[A-Za-zÅÄÖåäö]/.test(x) ? x : /^[−-]?\d[\d  ]* ?kr$/.test(x) ? x.replace(/\d{1,3}(?:[  ]\d{3})+/g, fmtNum) : x === "RumIQ Magasin" ? "RumIQ Magazine" : translate(x))); if (p.every(Boolean)) out = p.join(" · "); }
      if (!out) { // runs of known sentences, e.g. advice paragraphs put together
        const sent = (s.match(/(?:[^.!?]|[.!?](?![.!?]*(?:\s|$)))+[.!?]*\s*|[.!?]+\s*/g) || []).map((x) => x.trim()).filter(Boolean); const parts = []; let i = 0;
        while (i < sent.length) { let j = sent.length, hit = null; for (; j > i; j--) { const k = sent.slice(i, j).join(" "); if ((hit = one(k))) break; } if (!hit) { parts.length = 0; break; } parts.push(hit); i = j; }
        if (parts.length) out = parts.join(" ");
      }
      // one way to write numbers in English: "2,687 kr", also in prices that are not part of a sentence; "1 pc", "1 item"
      if (!out) { const f = s.replace(/\d{1,3}(?: \d{3})+(?= ?kr\b)/g, fmtNum); if (f !== s) out = f; }
      if (out) out = out.replace(/\b1 (pcs|items|products)\b/g, (m, w) => "1 " + w.replace(/s$/, ""));
      cache.set(s, out || null);
      return out || null;
    }

    const ATTR = ["placeholder", "aria-label", "title", "alt"];
    const skip = (el) => el.closest && el.closest("[translate=no], script, style, textarea, [contenteditable]");
    function doText(n) {
      const p = n.parentElement; if (!p || skip(p)) return;
      const v = n.nodeValue, t = translate(v);
      if (t && t !== v.trim()) { const lead = v.match(/^\s*/)[0], tail = v.match(/\s*$/)[0]; n.nodeValue = lead + t + tail; }
    }
    function doEl(el) {
      if (skip(el) && !(el.tagName === "TEXTAREA" && !el.closest("[translate=no]"))) return; // a text field's own hint and label are ours, what is typed in it is not
      for (const a of ATTR) { if (el.hasAttribute(a)) { const v = el.getAttribute(a), t = translate(v); if (t && t !== v) el.setAttribute(a, t); } }
      if (el.tagName === "INPUT" && /^(submit|button)$/.test(el.type) && el.value) { const t = translate(el.value); if (t) el.value = t; }
    }
    function walk(root) {
      if (!root) return;
      if (root.nodeType === 3) return doText(root);
      if (root.nodeType !== 1) return;
      doEl(root);
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
      let n; while ((n = w.nextNode())) { if (n.nodeType === 3) doText(n); else doEl(n); }
    }
    return { translate, walk, doText, doEl, ATTR };
  }
  let made = null, wait = null;
  window.RQ_toEn = (el) => {
    wait = wait || new Promise((ok, no) => { if (window.RQ_EN) return ok(); const sc = document.createElement("script"); sc.src = SRC; sc.onload = ok; sc.onerror = () => { wait = null; no(); }; document.head.appendChild(sc); });
    return wait.then(() => { made = made || make(); if (el) made.walk(el); });
  };
  if (LANG !== "en") return;

  document.addEventListener("DOMContentLoaded", () => {
    made = make();
    const { translate, walk, doText, doEl, ATTR } = made;
    const fixTitle = () => { const t = translate(document.title); if (t && t !== document.title) document.title = t; };

    walk(document.body); fixTitle();
    let busy = false;
    new MutationObserver((ms) => {
      if (busy) return; busy = true;
      try {
        for (const m of ms) {
          if (m.type === "characterData") doText(m.target);
          else if (m.type === "attributes") doEl(m.target);
          else m.addedNodes.forEach(walk);
        }
      } finally { busy = false; }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTR });
    new MutationObserver(fixTitle).observe(document.querySelector("title"), { childList: true, characterData: true, subtree: true });
    window.RQ_t = translate; // handy for scripts and tests
  });
})();
