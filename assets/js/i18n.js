/* Language layer. Swedish is written in the code; English comes from i18n-en.js, a phrase
   dictionary that is applied to the page after each render. Swedish visitors never load it.
   Switch language with RQ.setLang("en" | "sv"); the choice is kept in this browser. */
(function () {
  const read = () => { try { return JSON.parse(localStorage.getItem("rumiq-lang")) || ""; } catch (e) { return ""; } };
  const LANG = read() === "en" ? "en" : "sv";
  window.RQ_LANG = LANG;
  document.documentElement.lang = LANG;
  if (LANG === "en") document.write('<script src="assets/js/i18n-en.js"><\/script>');

  window.RQ_setLang = (l) => { try { localStorage.setItem("rumiq-lang", JSON.stringify(l === "en" ? "en" : "sv")); } catch (e) {} location.reload(); };
  if (LANG !== "en") return;

  document.addEventListener("DOMContentLoaded", () => {
    const EN = window.RQ_EN || { dict: {}, prods: [] };
    const D = EN.dict;
    const PRODS = EN.prods.slice().sort((a, b) => b[0].length - a[0].length);
    const PROD_EN = Object.fromEntries(EN.prods);
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
      [/^Inga träffar på "(.*)"$/, (m) => `No results for "${m[1]}"`],
      [/^Inloggad med (.+) \(testkonto\)\.$/, (m) => `Signed in with ${m[1]} (test account).`],
      [/^Köpet ångrades redan (.+)\.$/, (m) => `The purchase was already cancelled ${m[1]}.`],
      [/^På den riktiga sajten öppnas (\w+?)s egen inloggning, och du kommer tillbaka hit inloggad\. I förhandsversionen skapar vi ett testkonto i stället\.$/, (m) => `On the real site ${m[1]}'s own sign-in opens, and you come back here signed in. In the preview we create a test account instead.`],
      [/^(.+) \((\d+)\)$/, (m) => { const a = one(m[1]); return a ? `${a} (${m[2]})` : null; }],
    ];
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
      if (!out && s.includes(" · ")) { const p = s.split(" · ").map((x) => (/^RumIQ( Studio)?$/.test(x) || !/[A-Za-zÅÄÖåäö]/.test(x) ? x : x === "RumIQ Magasin" ? "RumIQ Magazine" : translate(x))); if (p.every(Boolean)) out = p.join(" · "); }
      if (!out) { // runs of known sentences, e.g. advice paragraphs put together
        const sent = s.split(/(?<=[.!?])\s+/); const parts = []; let i = 0;
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
