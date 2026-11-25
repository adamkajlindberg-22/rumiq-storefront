/* Keeps the page head right while browsing.
   The build (tools/build.py) writes one head per page: title, description, canonical address and
   sharing tags. Inside the running site the view changes without a new page being fetched, so this
   sets the same values for the page on screen, read from assets/heads.json (written by the build).
   On the page that was fetched nothing is changed: its head is already right.
   This is the one owner of the head while browsing: the router (app.js) calls RQ.headBook.follow(route, own)
   after every draw, and its own head (own) is used only for a view the build wrote no head for, or until
   the file has arrived. */
(function () {
  const RQ = window.RQ;
  if (!RQ || window.RQ_LANG === "en" || !window.RQ_HEADS_SRC) return; // English is a layer over the Swedish page; pages from an older build name no file: the router keeps the head
  const titleEl = document.querySelector("title");
  if (!titleEl) return;
  const q = (s) => document.head.querySelector(s);
  const firstTitle = document.title;
  // "#butik" on the address shows another view than the page that was fetched: no view has the fetched head then
  let first = location.hash.length > 1 && !location.hash.includes("=") ? false : null;
  let book = null, loading = false, failed = false, want = null, own = null;

  const title = (t) => { if (document.title !== t) document.title = t; };
  const attr = (sel, name, val) => { const el = q(sel); if (el && el.getAttribute(name) !== val) el.setAttribute(name, val); };

  function load() {
    if (loading) return;
    loading = true;
    fetch(new URL(window.RQ_HEADS_SRC, document.baseURI)).then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j && j.pages) book = j; else failed = true; apply(); }, () => { failed = true; apply(); });
  }

  function apply() {
    const k = want; if (k == null) return;
    if (k === first) { // the fetched page: keep what the build wrote, and let its structured data stand alone
      title(firstTitle);
      document.querySelectorAll('#view script[type="application/ld+json"]').forEach((s) => s.remove());
      if (!book) return;
    } else if (!book) { // the router's head stands in until the file is here
      if (own) own();
      if (!failed) load();
      return;
    }
    const h = book.pages[k];
    if (!h) { if (own) own(); return; }
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

  RQ.headBook = {
    follow(route, ownHead) {
      want = /^(hem)?$/.test(route) ? "hem" : route;
      own = ownHead || null;
      // 404.html is served for every address without a page of its own (an order page after a reload): its head is not this view's, so the router's own head is used
      if (first === null) first = /^Sidan finns inte/.test(firstTitle) ? false : want;
      apply();
    },
  };
})();
