/* Sign-in layer. Pages call RQ.auth only.
   "demo": everything stays in this browser, no email is sent, no provider is contacted.
   "supabase": real accounts through Supabase Auth (Google, Apple, Microsoft, Facebook, email code,
   email + password). Switch in config.js. */
(function () {
  const RQ = window.RQ, S = RQ.shop;
  const CFG = (window.RQ_CONFIG && window.RQ_CONFIG.auth) || { provider: "demo", social: ["google", "apple", "azure"] };
  const NAMES = { google: "Google", apple: "Apple", azure: "Microsoft", facebook: "Facebook" };
  let sb = null, pendingCode = null;

  const loadSupabase = () => new Promise((ok, bad) => {
    if (window.supabase) return ok(window.supabase);
    const s = document.createElement("script");
    s.src = "assets/vendor/supabase.js"; // supabase-js 2.119.2, self-hosted
    s.onload = () => ok(window.supabase); s.onerror = () => bad(new Error("Kunde inte ladda inloggningen."));
    document.head.appendChild(s);
  });
  const fromUser = (u) => u && { email: u.email, name: (u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) || "", provider: (u.app_metadata && u.app_metadata.provider) || "email", since: u.created_at };

  /* Which customer data follows the account between devices. */
  const SAVED_KEYS = { wish: "rumiq-wish", lists: "rumiq-lists", style: "rumiq-style", articles: "rumiq-articles", looks: "rumiq-looks", orders: "rumiq-orders" };
  const readLocal = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const writeLocal = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const mergeArr = (a, b, key) => { const out = [...(a || [])]; (b || []).forEach((x) => { const id = key ? x && x[key] : x; if (!out.some((y) => (key ? y && y[key] : y) === id)) out.push(x); }); return out; };
  let syncing = false, pushTimer = null, userId = null;

  async function pullProfile(user) {
    userId = user.id;
    const { data, error } = await sb.from("profiles").select("full_name, phone, address, marketing, saved").eq("id", user.id).maybeSingle();
    if (error) return console.warn(error);
    syncing = true;
    try {
      const c = S.customer() || {};
      const addr = (data && data.address) || {};
      const localAddr = c.address || {};
      S.setProfile({ name: c.name || (data && data.full_name) || "", phone: c.phone || (data && data.phone) || "", marketing: !!(data && data.marketing), address: localAddr.street ? localAddr : { ...addr } });
      const saved = (data && data.saved) || {};
      Object.entries(SAVED_KEYS).forEach(([k, lk]) => {
        const remote = saved[k], local = readLocal(lk);
        if (remote == null) return;
        if (k === "style") { if (!local) writeLocal(lk, remote); return; }
        writeLocal(lk, mergeArr(local, remote, k === "wish" || k === "articles" ? null : "id"));
      });
      S._wish = readLocal("rumiq-wish") || [];
    } finally { syncing = false; }
    pushProfile(true);
  }
  function pushProfile(now) {
    if (A.mode !== "supabase" || !sb || !userId || syncing) return Promise.resolve();
    clearTimeout(pushTimer);
    if (now) return doPush();
    pushTimer = setTimeout(doPush, 1200);
    return Promise.resolve();
  }
  async function doPush() {
    {
      const c = S.customer(); if (!c) return;
      const address = c.address || {};
      const saved = {}; Object.entries(SAVED_KEYS).forEach(([k, lk]) => { const v = readLocal(lk); if (v != null) saved[k] = k === "orders" ? v.slice(0, 50) : v; });
      const { error } = await sb.from("profiles").upsert({ id: userId, full_name: c.name || null, phone: c.phone || null, address, marketing: !!c.marketing, locale: (readLocal("rumiq-lang") || "sv"), saved });
      if (error) console.warn(error);
    }
  }

  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, bad) => setTimeout(() => bad(new Error("timeout")), ms))]);

  const A = (RQ.auth = {
    configured: CFG.provider === "supabase" && !!CFG.supabaseUrl && !!CFG.supabaseAnonKey,
    mode: "demo",            // becomes "supabase" once the auth server answers
    live: {},                // social providers switched on in Supabase
    socials: (CFG.social || ["google", "apple", "azure"]).filter((p) => NAMES[p]),
    providerName: (p) => NAMES[p] || "e-post",
    redirect: () => CFG.redirect || new URL("konto/", document.baseURI).href,
    ready: null,
    client: () => (A.mode === "supabase" ? sb : null),
    async token() { if (A.mode !== "supabase" || !sb) return null; const { data } = await sb.auth.getSession(); return (data.session && data.session.access_token) || null; },

    // anything that needs the real account state (AI pictures, checkout) calls start() and waits
    start() { return A._started || (A._started = A.init()); },
    async init() {
      if (!A.configured) return;
      try {
        /* The preview (claude.ai) blocks calls to other sites. Then we stay in demo mode. */
        const r = await withTimeout(fetch(CFG.supabaseUrl.replace(/\/$/, "") + "/auth/v1/settings", { headers: { apikey: CFG.supabaseAnonKey } }), 5000);
        if (!r.ok) throw new Error("auth " + r.status);
        const settings = await r.json();
        A.live = settings.external || {};
        const lib = await withTimeout(loadSupabase(), 8000);
        sb = lib.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true } });
        A.mode = "supabase";
        A.socials = A.socials.filter((p) => A.live[p]);
        const { data } = await sb.auth.getSession();
        const u = data.session && data.session.user;
        if (u) { const c = fromUser(u); S.signIn(c.email, c.name, c.provider); await pullProfile(u); }
        else if (S.customer() && S.customer().provider !== "demo-local") S.signOut();
        sb.auth.onAuthStateChange((ev, session) => {
          const su = session && session.user;
          if (su && (ev === "SIGNED_IN" || ev === "USER_UPDATED")) { const c = fromUser(su); S.signIn(c.email, c.name, c.provider); setTimeout(() => pullProfile(su), 0); }
          if (ev === "SIGNED_OUT") { userId = null; if (S.customer()) S.signOut(); }
        });
        S.onChange((what) => { if (["customer", "wish", "lists", "style", "articles", "looks", "orders"].includes(what) && S.customer()) pushProfile(); });
        if (typeof RQ.router === "function" && /^(konto|logga-in|skapa-konto)/.test(RQ.currentRoute ? RQ.currentRoute() || "" : location.hash.slice(1))) RQ.router();
      } catch (e) {
        A.mode = "demo"; A.blocked = true;
        console.info("RumIQ: inloggningsservern svarar inte här, kör förhandsläget.", e && e.message);
      }
    },
    async deleteAccount() {
      if (A.mode === "supabase" && sb) { const { error } = await sb.rpc("delete_my_account"); if (error) throw error; await sb.auth.signOut(); }
    },

    /* Social sign-in. Supabase opens the provider's own sign-in page and returns here. */
    async social(provider, demoEmail) {
      if (A.mode === "supabase") {
        if (!A.live[provider]) throw new Error(`Inloggning med ${NAMES[provider]} är inte påslagen än. Använd e-post så länge.`);
        const { error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo: A.redirect() } });
        if (error) throw error; return { redirected: true };
      }
      S.signIn(demoEmail, "", provider); return { ok: true };
    },

    /* Passwordless: a six-digit code by email. */
    async sendCode(email, name, marketing) {
      if (A.mode === "supabase") {
        const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true, data: { ...(name ? { full_name: name } : {}), marketing: !!marketing, locale: (readLocal("rumiq-lang") || "sv") }, emailRedirectTo: A.redirect() } });
        if (error) throw new Error(/rate|seconds/i.test(error.message) ? "Vänta en liten stund innan du ber om en ny kod." : "Vi kunde inte skicka mejlet just nu. Försök igen om en stund.");
        return { sent: true };
      }
      pendingCode = { email, name, marketing, code: String(Math.floor(100000 + Math.random() * 900000)) };
      return { sent: true, demoCode: pendingCode.code };
    },
    async verifyCode(email, code) {
      if (A.mode === "supabase") {
        const { error } = await sb.auth.verifyOtp({ email, token: code, type: "email" });
        if (error) throw new Error("Koden stämmer inte eller har gått ut. Be om en ny kod.");
        return { ok: true };
      }
      if (!pendingCode || pendingCode.email !== email || pendingCode.code !== code) throw new Error("Koden stämmer inte. Kontrollera siffrorna eller be om en ny kod.");
      S.signIn(email, pendingCode.name, "email"); if (pendingCode.marketing) S.setProfile({ marketing: true }); pendingCode = null; return { ok: true };
    },

    /* Email and password. In demo mode the password is never stored. */
    async signInPassword(email, password) {
      if (A.mode === "supabase") { const { error } = await sb.auth.signInWithPassword({ email, password }); if (error) throw new Error("Fel e-post eller lösenord."); return { ok: true }; }
      S.signIn(email, "", "password"); return { ok: true };
    },
    async signUp(email, password, name, marketing) {
      if (A.mode === "supabase") {
        const { error } = await sb.auth.signUp({ email, password, options: { data: { full_name: name, marketing: !!marketing }, emailRedirectTo: A.redirect() } });
        if (error) throw error; return { confirm: true };
      }
      S.signIn(email, name, "password"); if (marketing) S.setProfile({ marketing: true }); return { ok: true };
    },
    async resetPassword(email) {
      if (A.mode === "supabase") { const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: A.redirect() }); if (error) throw error; }
      return { sent: true };
    },
    async signOut() { if (A.mode === "supabase" && sb) { await pushProfile(true); await sb.auth.signOut(); } userId = null; S.signOut(); },
  });

  /* Official-style sign-in buttons (brand marks per each provider's button guidelines). */
  const LOGO = {
    google: '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.5 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.2l7.9 6.2C12.5 13.6 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.2 5.6c4.2-3.9 7.1-9.6 7.1-17z"/><path fill="#FBBC05" d="M10.6 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.6l-7.9-6.2A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l8-6.2z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.2-5.6c-2.2 1.5-5 2.4-8.7 2.4-6.2 0-11.5-4.2-13.4-9.9l-8 6.2C6.6 42.6 14.6 48 24 48z"/></svg>',
    apple: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9-.1 0-2.7-1-2.7-4.1zM13.9 5c.7-.9 1.2-2 1.1-3.2-1 0-2.3.7-3 1.6-.7.8-1.3 2-1.1 3.1 1.1.1 2.3-.6 3-1.5z"/></svg>',
    azure: '<svg viewBox="0 0 23 23" aria-hidden="true"><path fill="#F25022" d="M1 1h10v10H1z"/><path fill="#7FBA00" d="M12 1h10v10H12z"/><path fill="#00A4EF" d="M1 12h10v10H1z"/><path fill="#FFB900" d="M12 12h10v10H12z"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#1877F2" d="M24 12a12 12 0 1 0-13.9 11.9v-8.4h-3V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z"/></svg>',
  };
  RQ.socialButtons = (verb = "Fortsätt") => A.socials.map((p) => `<button type="button" class="sso sso-${p}" data-sso="${p}">${LOGO[p]}<span>${verb} med ${NAMES[p]}</span></button>`).join("");
  RQ.providerLogo = (p) => LOGO[p] || "";

  /* Sign-in starts after the page has loaded, so the 220 kB auth library never competes with the first
     picture. It starts at once when someone is coming back from a sign-in or opens a page that needs it. */
  document.addEventListener("DOMContentLoaded", () => {
    const route = (RQ.currentRoute && RQ.currentRoute()) || location.hash.slice(1);
    const now = /[?&](code|error)=|access_token=/.test(location.search + location.hash) || /^(konto|skapa-konto|logga-in|kassa|studio-plus|mitt-hem)/.test(route || "");
    A.ready = now ? A.start() : new Promise((ok) => {
      const go = () => A.start().then(ok, ok);
      const idle = () => (window.requestIdleCallback ? requestIdleCallback(go, { timeout: 2500 }) : setTimeout(go, 300));
      if (document.readyState === "complete") idle(); else addEventListener("load", idle, { once: true });
    });
  });
})();
