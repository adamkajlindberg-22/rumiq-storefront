/* Commerce and customer layer.
   Every page talks to the store through RQ.shop only. Today the "demo" provider answers from
   data.js and this browser's localStorage. When Shopify is connected, a "shopify" provider
   implements the same functions against the Storefront API (products, cart, checkout URL) and
   the pages do not change. Demo orders are test orders: nothing is paid and nothing is sent. */
(function () {
  const RQ = (window.RQ = window.RQ || {});
  /* The one reader for everything kept in this browser. What comes back always has the shape of the default:
     a list stays a list (empty rows dropped), a record stays a record, text stays text. Anything else, a
     half-written value or an old format, gives the default, so a bad value can never stop a page.
     any = true takes whatever is stored (for values that may be text or a record). */
  const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
  const listeners = new Set();
  const emit = (what) => listeners.forEach((f) => { try { f(what); } catch (e) { console.error(e); } });
  const store = {
    get(k, d, any) {
      let v; try { v = JSON.parse(localStorage.getItem(k)); } catch (e) { return d; }
      if (v == null) return d;
      if (any) return v;
      if (Array.isArray(d)) return Array.isArray(v) ? v.filter((x) => x != null) : d;
      if (d == null || isObj(d)) return isObj(v) ? v : d;
      return typeof v === typeof d ? v : d;
    },
    // false = it did not fit (the browser's storage is full or closed); the page is told through "full".
    // lost = the key that did not fit, until a later try with the same key does (Mitt rum saves a smaller photo)
    lost: null,
    set(k, v) {
      try { localStorage.setItem(k, JSON.stringify(v)); if (store.lost === k) store.lost = null; return true; }
      catch (e) { if (e && (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED" || e.code === 22)) { store.lost = k; emit("full"); } return false; }
    },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };
  const rows = (k, test) => store.get(k, []).filter(test);
  const words = (k) => rows(k, (x) => typeof x === "string");
  const qn = (q) => Math.max(1, Math.min(99, Math.floor(+q) || 1)); // a quantity is a whole number from 1 to 99
  const NF = new Intl.NumberFormat("sv-SE");

  RQ.ss = { get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} } };
  const S = (RQ.shop = {
    PROVIDER: "demo",
    store,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    kr: (n) => NF.format(Math.round(n)) + " kr",

    /* ---------------- catalogue */
    variantsOf(p) {
      const names = p.variants && p.variants.length ? p.variants : ["Standard"];
      return names.map((title, i) => ({ id: `${p.handle}::${i}`, title, price: p.price, availableForSale: false }));
    },
    variantById(id) {
      const [h, i] = String(id).split("::");
      const p = RQ.byHandle(h);
      if (!p) return null;
      return { product: p, variant: S.variantsOf(p)[Number(i) || 0] };
    },
    norm: (s) => String(s || "").toLocaleLowerCase("sv").normalize("NFC"),
    searchText(p) {
      const cat = RQ.catById(p.cat);
      const rooms = p.rooms.map((r) => (RQ.roomById(r) || {}).name).join(" ");
      const tr = window.RQ_t || (() => ""); // English words too, when the site is in English
      return S.norm(`${p.name} ${p.en || ""} ${cat ? cat.name : ""} ${p.short} ${p.story} ${p.material} ${rooms} ${(p.variants || []).join(" ")} ${p.styles.join(" ")} ${tr(p.short) || ""} ${cat ? tr(cat.name) || "" : ""} ${tr(p.material) || ""}`);
    },
    /* ---------------- search (v15)
       Swedish as people type it: with or without å ä ö, plural or definite ("lampor", "kuddarna"), the last part of a
       compound ("matta" finds "jutematta"), everyday words for the same thing ("poster", "filt") and one typing
       slip ("lmpa"). A hit in the name weighs most, then category and room, then material, then the texts. */
    fold: (s) => S.norm(s).normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
    _syn: { kudde: ["kuddfodral"], prydnadskudde: ["kuddfodral"], soffkudde: ["kuddfodral"], poster: ["affisch"], tavla: ["affisch"], bild: ["affisch"], konst: ["affisch"], print: ["affisch"], vaggdekor: ["affisch"],
      filt: ["plad"], sangklader: ["paslakanset"], lakan: ["paslakanset"], paslakan: ["paslakanset"], orngott: ["paslakanset"], tacke: ["paslakanset"], baddset: ["paslakanset"],
      stearinljus: ["ljusstake"], kandelaber: ["ljusstake"], blomkruka: ["kruka"], badlakan: ["handduk"], frotte: ["handduk"], box: ["forvaringslada"], lada: ["forvaringslada"],
      belysning: ["lampa"], nattlampa: ["lampa"], sanglampa: ["lampa"], fonsterlampa: ["lampa"], lykta: ["lampa", "doftljus"], tval: ["tvalpump"], skrivbord: ["skrivbordsorganisator"],
      gava: ["present"], julklapp: ["present"], gift: ["present"], rug: ["matta"], lamp: ["lampa"], candle: ["doftljus", "ljusstake"], cushion: ["kuddfodral"], pillow: ["kuddfodral"], blanket: ["plad"], throw: ["plad"], curtain: ["gardin"], towel: ["handduk"], basket: ["korg"], vase: ["vas"], pot: ["kruka"] },
    _sing(w) { // the dictionary forms a plural or definite word can come from
      const o = [w], add = (x) => { if (x.length >= 3 && !o.includes(x)) o.push(x); };
      if (w.length > 4) {
        if (/(arna|erna|orna)$/.test(w)) { const b = w.slice(0, -4); add(b); add(b + "a"); add(b + "e"); }
        if (/or$/.test(w)) add(w.slice(0, -2) + "a");
        if (/ar$/.test(w)) { add(w.slice(0, -2)); add(w.slice(0, -2) + "e"); }
        if (/er$/.test(w)) add(w.slice(0, -2));
        if (/(en|et)$/.test(w)) add(w.slice(0, -2));
        if (/[aeiouy]n$/.test(w)) add(w.slice(0, -1));
        if (/[^s]s$/.test(w)) add(w.slice(0, -1));
      }
      return o;
    },
    _words: (s) => S.fold(s).split(/[^a-z0-9]+/).filter(Boolean),
    _index() {
      if (S._ix) return S._ix;
      const tr = window.RQ_t || (() => ""), tok = (s) => { const o = new Set(); S._words(s).forEach((w) => S._sing(w).forEach((x) => o.add(x))); return [...o]; };
      // words a slip of the finger is corrected to: the things we sell, by their everyday names
      const vocab = new Set(["lampa", "bordslampa", "matta", "handduk", "gardin", "korg", "burk", "kruka", "doftljus", "ljusstake", "kuddfodral", "kudde", "plad", "affisch", "tavla", "poster", "paslakan", "lakan", "skarbrada", "forvaring", "belysning", "keramik", "massing", "linne"]);
      const rows = RQ.PRODUCTS.map((p) => {
        const cat = RQ.catById(p.cat), rooms = p.rooms.map((r) => (RQ.roomById(r) || {}).name || "").join(" ");
        const f = [[10, tok(p.name)], [6, tok(`${p.en || ""}`)], [5, tok(`${cat ? cat.name + " " + (cat.en || "") + " " + (tr(cat.name) || "") : ""} ${rooms}`)],
          [4, tok(`${p.material} ${(p.variants || []).join(" ")} ${p.styles.map((s) => (RQ.STYLES && RQ.STYLES[s] ? RQ.STYLES[s].name : s)).join(" ")} ${tr(p.material) || ""}`)],
          [3, tok(`${p.short} ${tr(p.short) || ""}`)], [1.2, tok(`${p.story} ${(p.use || []).join(" ")}`)]];
        f[0][1].concat(f[2][1]).forEach((w) => { if (w.length >= 4) vocab.add(w); });
        return { p, f };
      });
      return (S._ix = { rows, vocab: [...vocab] });
    },
    // how well one typed word fits one product: 0 = not at all
    _fit(row, forms) {
      let best = 0;
      for (const [weight, toks] of row.f) { if (weight <= best) break;
        for (const [form, q, stemOnly] of forms) for (const t of toks) {
          const m = stemOnly ? (t.length > form.length && t.startsWith(form) ? 0.7 : 0) : t === form ? 1 : t.startsWith(form) ? 0.85 : form.length >= 4 && t.endsWith(form) ? 0.8 : 0;
          if (m && weight * m * q > best) best = weight * m * q;
        } }
      return best;
    },
    _forms(w) { // [form, quality, onlyAsFirstPartOfALongerWord]
      const out = [], seen = new Set(), add = (f, q, stem) => { if (f && !seen.has(f + (stem ? "*" : ""))) { seen.add(f + (stem ? "*" : "")); out.push([f, q, !!stem]); } };
      const base = S._sing(w); base.forEach((f, i) => add(f, i ? 0.95 : 1));
      base.forEach((f) => (S._syn[f] || []).forEach((x) => add(x, 0.9)));
      base.forEach((f) => { if (f.length >= 5 && /[ae]$/.test(f)) add(f.slice(0, -1), 1, true); }); // "kudde" is "kudd" in "kuddfodral"
      return out;
    },
    _near(w, vocab) { // the closest known word, one slip away (two for long words)
      const max = w.length >= 8 ? 2 : 1; let best = null, bd = max + 1;
      for (const v of vocab) { if (Math.abs(v.length - w.length) > max) continue;
        const a = w, b = v, m = a.length, n = b.length; let prev = Array.from({ length: n + 1 }, (_, j) => j), pp = null;
        for (let i = 1; i <= m; i++) { const cur = [i];
          for (let j = 1; j <= n; j++) { let d = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); if (pp && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, pp[j - 2] + 1); cur.push(d); }
          pp = prev; prev = cur; }
        const d = prev[n]; if (d < bd || (d === bd && best && v.length < best.length)) { bd = d; best = v; } }
      return bd <= max ? best : null;
    },
    /* -> { list, fixed, short }: products best first; fixed = the query we searched for instead when the typed one
       had a slip in it ("lampa" for "lmpa"); short = fewer than two letters, nothing searched */
    search(query) {
      const words = S._words(query);
      if (words.join("").length < 2) return { list: [], fixed: "", short: true };
      const ix = S._index();
      const run = (ws) => { const forms = ws.map((w) => S._forms(w));
        const hits = ix.rows.map((row, k) => { const fit = forms.map((f) => S._fit(row, f)); return fit.every(Boolean) ? [row.p, fit, k] : null; }).filter(Boolean);
        // every word must fit about as well as it does in the best product: a word that is in a name does not also
        // bring in every product whose long text happens to mention it
        const floor = forms.map((_, i) => { const top = Math.max(0, ...hits.map((h) => h[1][i])); return top >= 8 ? top * 0.3 : top >= 3 ? top * 0.45 : top * 0.3; });
        const sum = (a) => a.reduce((s, x) => s + x, 0);
        return hits.filter((h) => h[1].every((s, i) => s >= floor[i])).sort((a, b) => sum(b[1]) - sum(a[1]) || a[2] - b[2]).map((h) => h[0]); };
      let list = run(words);
      if (list.length) return { list, fixed: "", short: false };
      // nothing: was one of the words mistyped?
      let changed = false;
      const fixed = words.map((w) => { if (w.length < 4 || ix.rows.some((row) => S._fit(row, S._forms(w)))) return w; const n = S._near(w, ix.vocab); if (n) { changed = true; return n; } return w; });
      if (changed) { list = run(fixed); if (list.length) { // show the word as it is written in the shop (with å ä ö)
        const nice = fixed.map((w, i) => { if (w === words[i]) return query.trim().split(/\s+/)[i] || w; for (const row of ix.rows) for (const x of `${row.p.name} ${(RQ.catById(row.p.cat) || {}).name || ""}`.split(/[^\p{L}\d]+/u)) if (S._sing(S.fold(x)).includes(w)) return S._sing(S.fold(x))[0] === w ? x.toLocaleLowerCase("sv") : w; return w; }).join(" ");
        return { list, fixed: nice, short: false }; } }
      return { list: [], fixed: "", short: false };
    },
    list({ cat = null, room = null, col = null, sort = "rel", query = "", max = Infinity, maxPrice = null, handles = null } = {}) {
      let list = RQ.PRODUCTS.filter((p) => (!cat || p.cat === cat) && (!room || p.rooms.includes(room)) && (!col || p.collections.includes(col)) && (!maxPrice || p.price <= maxPrice) && (!handles || handles.includes(p.handle)));
      // free text goes through S.search: word forms, compounds, synonyms, one slip of the finger, best hits first
      if (query.trim()) { const hit = S.search(query).list, keep = new Set(list); list = hit.filter((p) => keep.has(p)); }
      if (sort === "asc") list = [...list].sort((a, b) => a.price - b.price);
      if (sort === "desc") list = [...list].sort((a, b) => b.price - a.price);
      if (sort === "new") list = [...list].sort((a, b) => b.added - a.added);
      if (sort === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name, "sv"));
      if (sort === "pop") list = [...list].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
      return list.slice(0, max);
    },

    /* ---------------- cart */
    _cart: rows("rumiq-cart", (x) => isObj(x) && typeof x.v === "string" && +x.q > 0).map((x) => ({ v: x.v, q: qn(x.q) })),
    // rows whose product or colour is no longer in the range are skipped, here and in the count
    cartLines() {
      return S._cart.map((x) => { const r = S.variantById(x.v); return r && r.variant ? { id: x.v, quantity: x.q, product: r.product, variant: r.variant, lineTotal: r.variant.price * x.q } : null; }).filter(Boolean);
    },
    cartCount: () => S.cartLines().reduce((s, l) => s + l.quantity, 0),
    cartSubtotal: () => S.cartLines().reduce((s, l) => s + l.lineTotal, 0),
    /* A complete look in the cart is 10 % cheaper (RQ_CONFIG.lookDiscount). One unit of each product
       counts towards one look at most; the largest discounts are taken first. extra: handles to count as one more each (what a button would add) */
    lookDiscounts(extra = []) {
      const rate = +((window.RQ_CONFIG || {}).lookDiscount || 0); if (!rate || !RQ.LOOKS) return [];
      const left = {}; S.cartLines().forEach((l) => { left[l.product.handle] = (left[l.product.handle] || 0) + l.quantity; }); extra.forEach((h) => { left[h] = (left[h] || 0) + 1; });
      const price = (h) => (RQ.byHandle(h) || { price: 0 }).price;
      const cands = RQ.LOOKS.map((L) => ({ look: L, amount: Math.round(L.items.reduce((s, h) => s + price(h), 0) * rate) })).sort((a, b) => b.amount - a.amount);
      const out = [];
      for (const c of cands) { while (c.look.items.every((h) => left[h] > 0)) { c.look.items.forEach((h) => left[h]--); out.push(c); } }
      return out;
    },
    /* Svep-paket and Gruppris (RQ_CONFIG.svepBundle): a set bought from a Svep result. Each set is kept with its things;
       it counts while every one of them is in the cart, after the looks have taken theirs. Entries look like a look's
       (look.items, amount) so the cart and the checkout show them the same way; look.label is the row's words. */
    _bundles: rows("rumiq-bundles", (x) => isObj(x) && Array.isArray(x.items) && typeof x.id === "string").slice(0, 12),
    bundleRule: () => { const b = (window.RQ_CONFIG || {}).svepBundle; return b && +b.rate > 0 ? { min: Math.max(2, +b.min || 3), rate: +b.rate } : null; },
    addBundle(items, label) {
      const rule = S.bundleRule(), hs = [...new Set(items.map((x) => String(x).split("::")[0]))].filter((h) => RQ.byHandle(h)); if (!rule || hs.length < rule.min) return null;
      const id = hs.slice().sort().join(","); S._bundles = [{ id, items: hs, label: label || "Svep-paket" }, ...S._bundles.filter((b) => b.id !== id)].slice(0, 12);
      store.set("rumiq-bundles", S._bundles); emit("cart"); return id; },
    bundleSave: (items) => { const rule = S.bundleRule(), hs = [...new Set(items.map((x) => String(x).split("::")[0]))].filter((h) => RQ.byHandle(h)); return rule && hs.length >= rule.min ? Math.round(hs.reduce((s, h) => s + RQ.byHandle(h).price, 0) * rule.rate) : 0; },
    allDiscounts(extra = []) {
      const looks = S.lookDiscounts(extra), rule = S.bundleRule(); if (!rule || !S._bundles.length) return looks;
      const left = {}; S.cartLines().forEach((l) => { left[l.product.handle] = (left[l.product.handle] || 0) + l.quantity; }); extra.forEach((h) => { left[h] = (left[h] || 0) + 1; });
      looks.forEach((d) => d.look.items.forEach((h) => left[h]--));
      const out = [...looks];
      S._bundles.forEach((b) => { if (b.items.length < rule.min || !b.items.every((h) => left[h] > 0 && RQ.byHandle(h))) return; b.items.forEach((h) => left[h]--);
        out.push({ look: { id: "b:" + b.id, name: b.label, label: b.label, items: b.items }, amount: Math.round(b.items.reduce((s, h) => s + RQ.byHandle(h).price, 0) * rule.rate) }); });
      return out; },
    cartDiscount: (extra) => S.allDiscounts(extra).reduce((s, d) => s + d.amount, 0),
    cartTotalBeforeShipping: () => S.cartSubtotal() - S.cartDiscount(),
    addToCart(variantId, qty = 1) {
      const hit = S.variantById(variantId); if (!hit || !hit.variant) return false;
      qty = qn(qty);
      { const v = S.variantById(variantId); RQ.track && RQ.track("add_to_cart", { item_id: v && v.product ? v.product.handle : variantId, quantity: qty }); }
      const it = S._cart.find((x) => x.v === variantId);
      if (it) it.q = Math.min(99, it.q + qty); else S._cart.push({ v: variantId, q: qty });
      const kept = store.set("rumiq-cart", S._cart); emit("cart"); return kept;
    },
    setQty(variantId, qty) {
      qty = Math.floor(+qty) || 0;
      S._cart = qty <= 0 ? S._cart.filter((x) => x.v !== variantId) : S._cart.map((x) => (x.v === variantId ? { ...x, q: Math.min(99, qty) } : x));
      if (qty <= 0 && S._bundles.length) { const left = new Set(S._cart.map((x) => String(x.v).split("::")[0])), keep = S._bundles.filter((b) => b.items.every((x) => left.has(x))); if (keep.length !== S._bundles.length) { S._bundles = keep; store.set("rumiq-bundles", keep); } } /* a Svep-paket ends when a thing of it leaves the cart (review) */
      store.set("rumiq-cart", S._cart); emit("cart");
    },
    clearCart() { S._cart = []; S._bundles = []; store.set("rumiq-cart", S._cart); store.set("rumiq-bundles", []); emit("cart"); },

    /* Shipping options are examples until suppliers are confirmed. */
    SHIPPING: ((sh, d) => [ // delivery time read from config.js, a goal until the supplier has confirmed it
      { id: "ombud", title: "Hämta hos ombud", eta: d, price: sh.pickup || 49, free: true },
      { id: "skap", title: "Paketskåp", eta: d, price: sh.pickup || 49, free: true, note: "Hämta när det passar dig" },
      { id: "hem", title: "Hemleverans", eta: d, price: sh.home || 89 },
    ])((window.RQ_CONFIG || {}).shipping || {}, ((d) => (d.minDays ? `${d.minDays}–${d.maxDays} arbetsdagar` : ""))((window.RQ_CONFIG || {}).delivery || {})),
    // free to pickup point and parcel locker from RQ_CONFIG.freeShippingFrom (order value after look discounts)
    freeShipping() { const from = (window.RQ_CONFIG || {}).freeShippingFrom; return !!from && S.cartTotalBeforeShipping() >= from; },
    shippingCost(id) { const o = S.SHIPPING.find((s) => s.id === id) || S.SHIPPING[0]; return o.free && S.freeShipping() ? 0 : o.price; },
    vatIncluded: (total) => total - total / 1.25,
    /* The one sentence about returns, with its numbers from RQ_CONFIG.delivery: use it wherever the return window is told. */
    returnsLine() { const d = (window.RQ_CONFIG && window.RQ_CONFIG.delivery) || {}; return `${d.openPurchaseDays || 30} dagars öppet köp från att du tog emot varan. Lagen ger alltid ${d.withdrawalDays || 14} dagars ångerrätt.`; },

    /* ---------------- orders (test orders, kept in this browser) */
    orders: () => rows("rumiq-orders", (o) => isObj(o) && typeof o.number === "string" && isObj(o.contact) && Array.isArray(o.lines)),
    placeTestOrder({ contact, address, shippingId, gift }) {
      const lines = S.cartLines();
      if (!lines.length) return null;
      const subtotal = S.cartSubtotal(), discount = S.cartDiscount();
      const ship = S.shippingCost(shippingId);
      const order = {
        number: "TEST-" + String(1001 + S.orders().length),
        createdAt: new Date().toISOString(), contact, address, shippingId, gift: gift || null,
        lines: lines.map((l) => ({ handle: l.product.handle, title: l.product.name, variant: l.variant.title, quantity: l.quantity, price: l.variant.price })),
        subtotal, discount, shipping: ship, total: subtotal - discount + ship, status: "test", withdrawn: false,
      };
      store.set("rumiq-orders", [order, ...S.orders()]);
      S.clearCart(); emit("orders");
      return order;
    },
    findOrder(number, email) {
      const n = String(number || "").trim().toUpperCase();
      return S.orders().find((o) => o.number === n && (!email || S.norm(o.contact.email) === S.norm(email.trim()))) || null;
    },
    withdrawOrder(number, handles) {
      const list = S.orders().map((o) => (o.number === number ? { ...o, withdrawn: true, withdrawnLines: handles || null, withdrawnAt: new Date().toISOString() } : o));
      store.set("rumiq-orders", list); emit("orders");
      return list.find((o) => o.number === number) || null;
    },

    /* ---------------- wishlist and compare */
    _wish: words("rumiq-wish"),
    wishlist: () => S._wish.map(RQ.byHandle).filter(Boolean),
    isWished: (h) => S._wish.includes(h),
    toggleWish(h) { const off = S._wish.includes(h); S._wish = off ? S._wish.filter((x) => x !== h) : [h, ...S._wish]; store.set("rumiq-wish", S._wish); if (off && RQ.wishSrc) RQ.wishSrc.set(h, ""); emit("wish"); return S._wish.includes(h); }, /* a removed favourite forgets Svep and Älskar (review) */
    /* Named lists, for example one per room ("Spara i ett rum"). The favourites above are the default list. */
    lists: () => rows("rumiq-lists", (l) => isObj(l) && l.id && Array.isArray(l.handles)),
    createList(name) { const l = { id: "l" + Date.now(), name: String(name).slice(0, 40), handles: [], at: new Date().toISOString() }; store.set("rumiq-lists", [...S.lists(), l]); emit("lists"); return l; },
    renameList(id, name) { store.set("rumiq-lists", S.lists().map((l) => (l.id === id ? { ...l, name: String(name).slice(0, 40) } : l))); emit("lists"); },
    deleteList(id) { store.set("rumiq-lists", S.lists().filter((l) => l.id !== id)); emit("lists"); },
    toggleInList(id, h) { let on = false; store.set("rumiq-lists", S.lists().map((l) => { if (l.id !== id) return l; on = !l.handles.includes(h); return { ...l, handles: on ? [h, ...l.handles] : l.handles.filter((x) => x !== h) }; })); emit("lists"); return on; },
    listsWith: (h) => S.lists().filter((l) => l.handles.includes(h)),
    _seen: words("rumiq-seen"),
    markSeen(h) { RQ.track && RQ.track("view_item", { item_id: h }); S._seen = [h, ...S._seen.filter((x) => x !== h)].slice(0, 8); store.set("rumiq-seen", S._seen); },
    recentlySeen: (except) => S._seen.filter((h) => h !== except).map(RQ.byHandle).filter(Boolean),

    /* ---------------- customer (demo sign-in: nothing leaves this browser) */
    customer: () => { const c = store.get("rumiq-customer", null); return c && typeof c.email === "string" ? c : null; },
    signIn(email, name, provider) { const prev = S.customer(); store.set("rumiq-customer", { ...(prev && prev.email === email ? prev : {}), email, name: name || (prev && prev.email === email ? prev.name : "") || "", provider: provider || "email", since: (prev && prev.email === email && prev.since) || new Date().toISOString() }); emit("customer"); },
    setProfile(patch) { const c = S.customer(); if (!c) return; store.set("rumiq-customer", { ...c, ...patch }); emit("customer"); },
    signOut() { store.set("rumiq-customer", null); emit("customer"); },

    /* ---------------- Mitt hem: style, room projects, saved articles */
    style: () => { const s = store.get("rumiq-style", null); return s && RQ.STYLES[s.style] ? s : null; },
    saveStyle(s) { store.set("rumiq-style", { ...s, at: new Date().toISOString() }); emit("style"); },
    projects: () => rows("rumiq-projects", (p) => isObj(p) && p.id),
    saveProject(p) {
      const list = [{ id: "p" + Date.now(), at: new Date().toISOString(), note: "", ...p }, ...S.projects()].slice(0, 12);
      if (!store.set("rumiq-projects", list)) return false;
      emit("projects"); return true;
    },
    updateProject(id, patch) { store.set("rumiq-projects", S.projects().map((p) => (p.id === id ? { ...p, ...patch } : p))); emit("projects"); },
    deleteProject(id) { store.set("rumiq-projects", S.projects().filter((p) => p.id !== id)); emit("projects"); },
    savedArticles: () => words("rumiq-articles"),
    toggleArticle(slug) { const a = S.savedArticles(); const n = a.includes(slug) ? a.filter((x) => x !== slug) : [slug, ...a]; store.set("rumiq-articles", n); emit("articles"); return n.includes(slug); },
    looks: () => rows("rumiq-looks", (l) => isObj(l) && l.id && Array.isArray(l.handles)),
    saveLook(handles, name) { const l = [{ id: "l" + Date.now(), name, handles, at: new Date().toISOString() }, ...S.looks()].slice(0, 20); store.set("rumiq-looks", l); emit("looks"); },
    deleteLook(id) { store.set("rumiq-looks", S.looks().filter((l) => l.id !== id)); emit("looks"); },

    /* ---------------- ideas (Dela en idé) */
    ideas: () => rows("rumiq-ideas", (i) => isObj(i) && i.id),
    addIdea(title, text) { const i = [{ id: "i" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), title, text, votes: 1, mine: true, at: new Date().toISOString() }, ...S.ideas()]; store.set("rumiq-ideas", i); emit("ideas"); },
    voteIdea(id) { store.set("rumiq-ideas", S.ideas().map((i) => (i.id === id ? { ...i, votes: i.voted ? i.votes - 1 : i.votes + 1, voted: !i.voted } : i))); emit("ideas"); },

    /* ---------------- settings */
    consent: () => store.get("rumiq-consent", null),
    /* Analytics hook. Pushes events to window.dataLayer only after the visitor accepted statistics cookies.
       Google Tag Manager (GA4, Meta, Pinterest) reads dataLayer once it is added; nothing is sent before that. */
    track(ev, data) { const c = S.consent(); if (!c || !c.stats) return; (window.dataLayer = window.dataLayer || []).push(Object.assign({ event: ev }, data || {})); },
    setConsent(c) { store.set("rumiq-consent", { ...c, at: new Date().toISOString() }); emit("consent"); },
    lang: () => store.get("rumiq-lang", "sv"),
    setLang(l) { store.set("rumiq-lang", l); emit("lang"); },
    /* "Rensa allt": everything the shop has kept in this browser goes, also the room photo and the things in it.
       Only the cookie choice, the language and the light stay, they are settings and not customer data. */
    clearAll() {
      const keep = /^rumiq-(consent|lang|ljus)$/;
      [() => localStorage, () => sessionStorage].forEach((get) => { try { const st = get(); Object.keys(st).filter((k) => /^rumiq-/.test(k) && !keep.test(k)).forEach((k) => st.removeItem(k)); } catch (e) {} });
      S._cart = []; S._wish = []; S._seen = [];
      if (RQ.room && RQ.room.clear) { try { RQ.room.clear(); } catch (e) {} }
      emit("all");
    },
  });
  RQ.track = (ev, data) => S.track(ev, data);
})();
