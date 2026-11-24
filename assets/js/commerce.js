/* Commerce and customer layer.
   Every page talks to the store through RQ.shop only. Today the "demo" provider answers from
   data.js and this browser's localStorage. When Shopify is connected, a "shopify" provider
   implements the same functions against the Storefront API (products, cart, checkout URL) and
   the pages do not change. Demo orders are test orders: nothing is paid and nothing is sent. */
(function () {
  const RQ = (window.RQ = window.RQ || {});
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  };
  const listeners = new Set();
  const emit = (what) => listeners.forEach((f) => { try { f(what); } catch (e) { console.error(e); } });

  RQ.ss = { get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} } };
  const S = (RQ.shop = {
    PROVIDER: "demo",
    store,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    kr: (n) => new Intl.NumberFormat("sv-SE").format(Math.round(n)) + " kr",

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
    list({ cat = null, room = null, col = null, sort = "rel", query = "", max = Infinity, maxPrice = null, handles = null } = {}) {
      let list = RQ.PRODUCTS.filter((p) => (!cat || p.cat === cat) && (!room || p.rooms.includes(room)) && (!col || p.collections.includes(col)) && (!maxPrice || p.price <= maxPrice) && (!handles || handles.includes(p.handle)));
      const q = S.norm(query.trim());
      if (q) list = list.filter((p) => q.split(/\s+/).every((w) => S.searchText(p).includes(w)));
      if (sort === "asc") list = [...list].sort((a, b) => a.price - b.price);
      if (sort === "desc") list = [...list].sort((a, b) => b.price - a.price);
      if (sort === "new") list = [...list].sort((a, b) => b.added - a.added);
      if (sort === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name, "sv"));
      if (sort === "pop") list = [...list].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
      return list.slice(0, max);
    },

    /* ---------------- cart */
    _cart: store.get("rumiq-cart", []).filter((x) => x && x.v),
    cartLines() {
      return S._cart.map((x) => { const r = S.variantById(x.v); return r ? { id: x.v, quantity: x.q, product: r.product, variant: r.variant, lineTotal: r.variant.price * x.q } : null; }).filter(Boolean);
    },
    cartCount: () => S._cart.reduce((s, x) => s + x.q, 0),
    cartSubtotal: () => S.cartLines().reduce((s, l) => s + l.lineTotal, 0),
    /* A complete look in the cart is 10 % cheaper (RQ_CONFIG.lookDiscount). One unit of each product
       counts towards one look at most; the largest discounts are taken first. */
    lookDiscounts() {
      const rate = +((window.RQ_CONFIG || {}).lookDiscount || 0); if (!rate || !RQ.LOOKS) return [];
      const left = {}; S.cartLines().forEach((l) => { left[l.product.handle] = (left[l.product.handle] || 0) + l.quantity; });
      const price = (h) => (RQ.byHandle(h) || { price: 0 }).price;
      const cands = RQ.LOOKS.map((L) => ({ look: L, amount: Math.round(L.items.reduce((s, h) => s + price(h), 0) * rate) })).sort((a, b) => b.amount - a.amount);
      const out = [];
      for (const c of cands) { while (c.look.items.every((h) => left[h] > 0)) { c.look.items.forEach((h) => left[h]--); out.push(c); } }
      return out;
    },
    cartDiscount: () => S.lookDiscounts().reduce((s, d) => s + d.amount, 0),
    cartTotalBeforeShipping: () => S.cartSubtotal() - S.cartDiscount(),
    addToCart(variantId, qty = 1) {
      if (!S.variantById(variantId)) return;
      { const v = S.variantById(variantId); RQ.track && RQ.track("add_to_cart", { item_id: v && v.product ? v.product.handle : variantId, quantity: qty }); }
      const it = S._cart.find((x) => x.v === variantId);
      if (it) it.q = Math.min(99, it.q + qty); else S._cart.push({ v: variantId, q: qty });
      store.set("rumiq-cart", S._cart); emit("cart");
    },
    setQty(variantId, qty) {
      S._cart = qty <= 0 ? S._cart.filter((x) => x.v !== variantId) : S._cart.map((x) => (x.v === variantId ? { ...x, q: Math.min(99, qty) } : x));
      store.set("rumiq-cart", S._cart); emit("cart");
    },
    clearCart() { S._cart = []; store.set("rumiq-cart", S._cart); emit("cart"); },

    /* Shipping options are examples until suppliers are confirmed. */
    SHIPPING: [
      { id: "ombud", title: "Hämta hos ombud", eta: "2–5 arbetsdagar", price: 49, free: true },
      { id: "skap", title: "Paketskåp", eta: "2–5 arbetsdagar", price: 49, free: true, note: "Hämta när det passar dig" },
      { id: "hem", title: "Hemleverans", eta: "2–5 arbetsdagar", price: 89 },
    ],
    // free to pickup point and parcel locker from RQ_CONFIG.freeShippingFrom (order value after look discounts)
    freeShipping() { const from = (window.RQ_CONFIG || {}).freeShippingFrom; return !!from && S.cartTotalBeforeShipping() >= from; },
    shippingCost(id) { const o = S.SHIPPING.find((s) => s.id === id) || S.SHIPPING[0]; return o.free && S.freeShipping() ? 0 : o.price; },
    vatIncluded: (total) => total - total / 1.25,

    /* ---------------- orders (test orders, kept in this browser) */
    orders: () => store.get("rumiq-orders", []),
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
    _wish: store.get("rumiq-wish", []),
    wishlist: () => S._wish.map(RQ.byHandle).filter(Boolean),
    isWished: (h) => S._wish.includes(h),
    toggleWish(h) { S._wish = S._wish.includes(h) ? S._wish.filter((x) => x !== h) : [h, ...S._wish]; store.set("rumiq-wish", S._wish); emit("wish"); return S._wish.includes(h); },
    /* Named lists, for example one per room ("Spara i ett rum"). The favourites above are the default list. */
    lists: () => store.get("rumiq-lists", []),
    createList(name) { const l = { id: "l" + Date.now(), name: String(name).slice(0, 40), handles: [], at: new Date().toISOString() }; store.set("rumiq-lists", [...S.lists(), l]); emit("lists"); return l; },
    renameList(id, name) { store.set("rumiq-lists", S.lists().map((l) => (l.id === id ? { ...l, name: String(name).slice(0, 40) } : l))); emit("lists"); },
    deleteList(id) { store.set("rumiq-lists", S.lists().filter((l) => l.id !== id)); emit("lists"); },
    toggleInList(id, h) { let on = false; store.set("rumiq-lists", S.lists().map((l) => { if (l.id !== id) return l; on = !l.handles.includes(h); return { ...l, handles: on ? [h, ...l.handles] : l.handles.filter((x) => x !== h) }; })); emit("lists"); return on; },
    listsWith: (h) => S.lists().filter((l) => l.handles.includes(h)),
    _cmp: store.get("rumiq-compare", []),
    compareList: () => S._cmp.map(RQ.byHandle).filter(Boolean),
    inCompare: (h) => S._cmp.includes(h),
    toggleCompare(h) {
      if (S._cmp.includes(h)) S._cmp = S._cmp.filter((x) => x !== h);
      else { if (S._cmp.length >= 4) S._cmp.pop(); S._cmp = [h, ...S._cmp]; }
      store.set("rumiq-compare", S._cmp); emit("compare"); return S._cmp.includes(h);
    },
    _seen: store.get("rumiq-seen", []),
    markSeen(h) { RQ.track && RQ.track("view_item", { item_id: h }); S._seen = [h, ...S._seen.filter((x) => x !== h)].slice(0, 8); store.set("rumiq-seen", S._seen); },
    recentlySeen: (except) => S._seen.filter((h) => h !== except).map(RQ.byHandle).filter(Boolean),

    /* ---------------- customer (demo sign-in: nothing leaves this browser) */
    customer: () => store.get("rumiq-customer", null),
    signIn(email, name, provider) { const prev = S.customer(); store.set("rumiq-customer", { ...(prev && prev.email === email ? prev : {}), email, name: name || (prev && prev.email === email ? prev.name : "") || "", provider: provider || "email", since: (prev && prev.email === email && prev.since) || new Date().toISOString() }); emit("customer"); },
    setProfile(patch) { const c = S.customer(); if (!c) return; store.set("rumiq-customer", { ...c, ...patch }); emit("customer"); },
    signOut() { store.set("rumiq-customer", null); emit("customer"); },

    /* ---------------- Mitt hem: style, room projects, saved articles */
    style: () => store.get("rumiq-style", null),
    saveStyle(s) { store.set("rumiq-style", { ...s, at: new Date().toISOString() }); emit("style"); },
    projects: () => store.get("rumiq-projects", []),
    saveProject(p) {
      const list = [{ id: "p" + Date.now(), at: new Date().toISOString(), note: "", ...p }, ...S.projects()].slice(0, 12);
      if (!store.set("rumiq-projects", list)) return false;
      emit("projects"); return true;
    },
    updateProject(id, patch) { store.set("rumiq-projects", S.projects().map((p) => (p.id === id ? { ...p, ...patch } : p))); emit("projects"); },
    deleteProject(id) { store.set("rumiq-projects", S.projects().filter((p) => p.id !== id)); emit("projects"); },
    savedArticles: () => store.get("rumiq-articles", []),
    toggleArticle(slug) { const a = S.savedArticles(); const n = a.includes(slug) ? a.filter((x) => x !== slug) : [slug, ...a]; store.set("rumiq-articles", n); emit("articles"); return n.includes(slug); },
    looks: () => store.get("rumiq-looks", []),
    saveLook(handles, name) { const l = [{ id: "l" + Date.now(), name, handles, at: new Date().toISOString() }, ...S.looks()].slice(0, 20); store.set("rumiq-looks", l); emit("looks"); },
    deleteLook(id) { store.set("rumiq-looks", S.looks().filter((l) => l.id !== id)); emit("looks"); },

    /* ---------------- ideas (Dela en idé) */
    ideas: () => store.get("rumiq-ideas", []),
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
    clearAll() { ["rumiq-cart", "rumiq-wish", "rumiq-compare", "rumiq-seen", "rumiq-customer", "rumiq-style", "rumiq-projects", "rumiq-articles", "rumiq-looks", "rumiq-orders", "rumiq-ideas", "rumiq-lists", "rumiq-taste", "rumiq-votes", "rumiq-notify", "rumiq-home", "rumiq-watch", "rumiq-soon"].forEach((k) => { try { localStorage.removeItem(k); } catch (e) {} });
      S._cart = []; S._wish = []; S._cmp = []; S._seen = []; emit("all"); },
  });
  RQ.track = (ev, data) => S.track(ev, data);
})();
