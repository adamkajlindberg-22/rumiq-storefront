/* Keeps the page head right while browsing.
   The build (tools/build.py) writes one head per page: title, description, canonical address and
   sharing tags. Inside the running site the view changes without a new page being fetched, so this
   sets the same values for the page on screen, read from assets/heads.json (written by the build).
   On the page that was fetched nothing is changed: its head is already right. */
(function () {
  const RQ = window.RQ;
  if (!RQ || !RQ.currentRoute || window.RQ_LANG === "en") return; // English is a layer over the Swedish page, not a page of its own
  const titleEl = document.querySelector("title");
  if (!titleEl) return;
  const q = (s) => document.head.querySelector(s);
  const firstTitle = document.title;
  let first = null, book = null, loading = false;

  const key = () => { const r = RQ.currentRoute(); return r == null ? null : /^(hem)?$/.test(r) ? "hem" : r; };
  const title = (t) => { if (document.title !== t) document.title = t; };
  const attr = (sel, name, val) => { const el = q(sel); if (el && el.getAttribute(name) !== val) el.setAttribute(name, val); };

  function load() {
    if (loading || book || !window.RQ_HEADS_SRC) return; // pages from an older build name no file: nothing to read
    loading = true;
    fetch(new URL(window.RQ_HEADS_SRC, document.baseURI)).then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j && j.pages) { book = j; apply(); } }).catch(() => {});
  }

  function apply() {
    const k = key(); if (k == null) return;
    if (first === null) first = k;
    if (k === first) { // the fetched page: keep what the build wrote, and let its structured data stand alone
      title(firstTitle);
      document.querySelectorAll('#view script[type="application/ld+json"]').forEach((s) => s.remove());
      if (!book) return;
    }
    if (!book) return load();
    const h = book.pages[k]; if (!h) return;
    const site = book.site, address = site + (h[2] ? h[2] + "/" : "");
    title(h[0]);
    attr('meta[name="description"]', "content", h[1]);
    attr('meta[property="og:title"]', "content", h[0]);
    attr('meta[property="og:description"]', "content", h[1]);
    attr('link[rel="canonical"]', "href", address);
    attr('meta[property="og:url"]', "content", address);
    attr('meta[property="og:image"]', "content", site + h[3]);
    attr('meta[name="robots"]', "content", h[4] ? (book.launch ? "noindex,follow" : "noindex") : "index,follow,max-image-preview:large");
    // structured data written for the fetched page says nothing about this one
    if (k !== first) document.head.querySelectorAll('script[type="application/ld+json"][data-page]').forEach((s) => s.remove());
  }

  // the router sets the title on every change of view: that is the moment to follow
  new MutationObserver(apply).observe(titleEl, { childList: true, characterData: true, subtree: true });
  document.addEventListener("DOMContentLoaded", apply);
  window.addEventListener("popstate", () => setTimeout(apply, 0));
})();
