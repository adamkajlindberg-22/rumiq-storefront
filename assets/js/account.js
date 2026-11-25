/* Account, checkout (test mode), order tracking and withdrawal.
   Demo layer: sign-in, orders and withdrawals are kept in this browser only.
   In production, checkout opens Shopify's hosted checkout and accounts are Shopify customer accounts. */
(function () {
  const RQ = window.RQ, S = RQ.shop, V = RQ.views, $ = RQ.$, $$ = RQ.$$, esc = RQ.esc, kr = S.kr;
  const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim());
  const date = (iso) => new Date(iso).toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" });

  const orderCard = (o, here) => `<div class="order"><header><div><b>${esc(o.number)}</b><div class="small">${date(o.createdAt)}</div></div><div style="text-align:right"><span class="st">${o.withdrawn ? "ÅNGRAD" : "TESTORDER"}</span><div class="price" style="font-family:var(--mono)">${kr(o.total)}</div></div></header>${o.gift ? `<p class="small gift-line">Present${o.gift.note ? `. Hälsning: ”${esc(o.gift.note)}”` : ", utan priser på följesedeln"}</p>` : ""}
    <ul class="small" style="list-style:none;display:grid;gap:.2rem">${o.lines.map((l) => `<li>${l.quantity} × ${esc(l.title)}${l.variant !== "Standard" ? `, ${esc(l.variant)}` : ""}</li>`).join("")}</ul>
    <div class="ctrl-row">${here === true ? "" : `<a class="chip" href="#spara-order" data-track="${o.number}">Spåra min beställning</a>`}${o.withdrawn ? "" : `<a class="chip" href="#angra" data-wd="${o.number}">Ångra köp</a>`}</div></div>`;

  /* ---------------- Konto: sign in, create account, account pages */
  const BENEFITS = `<div class="auth-aside"><span class="eyebrow">Med ett gratis konto kan du</span>
    <ul class="rules" style="margin-top:1.2rem"><li>Se produkterna i en bild av ditt eget rum och spara resultatet</li><li>Samla det du sparar i egna listor, till exempel en per rum</li><li>Spara dina looks, din stil och dina samtal med stylisten</li><li>Följa och ångra beställningar med ett klick</li><li>Gå snabbare genom kassan nästa gång</li></ul>
    <p class="small" style="margin-top:1.6rem">Du kan alltid handla som gäst. Kassan kräver inget konto.</p></div>`;
  const demoNote = () => (RQ.auth.mode === "demo" ? `<p class="note" style="margin:0 0 1.2rem">Förhandsversion: inloggningen är inte kopplad än. Knapparna skapar ett testkonto som bara finns i den här webbläsaren. Inga uppgifter skickas till Google, Apple, Microsoft eller oss.</p>` : "");

  function authView(tab) {
    const signup = tab === "skapa";
    // the auth server did not answer: say so, and do not offer a form that cannot work
    const down = RQ.auth.mode === "down";
    return {
      title: (signup ? "Skapa konto" : "Logga in") + " · RumIQ",
      html: `<header class="page-head wrap" style="padding-bottom:1.5rem">${RQ.crumbs([["Hem", "hem"], [signup ? "Skapa konto" : "Logga in"]])}<h1 class="h1">${signup ? "Skapa ditt konto" : "Logga in"}</h1></header>
        <section class="wrap auth-grid" style="padding-bottom:5rem">
          <div class="auth-card">
            <div class="seg" role="tablist"><a role="tab" href="#konto" aria-selected="${!signup}">Logga in</a><a role="tab" href="#skapa-konto" aria-selected="${signup}">Skapa konto</a></div>
            ${down ? `<div class="auth-down" role="status"><h2 class="h3">Inloggningen går inte att nå just nu</h2><p>Det beror inte på dig. Försök igen om en stund. Du kan handla som gäst under tiden, och det du har sparat i den här webbläsaren ligger kvar.</p><div class="ctrl-row"><button class="btn" type="button" id="authRetry">Försök igen</button><a class="btn ghost" href="#butik">Till butiken</a></div></div>` : ""}
            <div id="authMain"${down ? " hidden" : ""}>
              ${demoNote()}
              <div class="sso-list">${RQ.socialButtons(signup ? "Skapa konto" : "Fortsätt")}</div>
              <div class="or"><span>eller med e-post</span></div>
              <form id="codeForm" novalidate>
                ${signup ? `<label>Förnamn<input name="name" autocomplete="given-name"></label>` : ""}
                <label>E-post<input type="email" name="email" autocomplete="email" required></label>
                ${signup ? `<label class="check"><input type="checkbox" name="terms"> <span>Jag har läst <a href="#juridik-integritet">integritetspolicyn</a> och godkänner <a href="#juridik-villkor">villkoren</a>.</span></label><label class="check"><input type="checkbox" name="news"> Ja tack, skicka nyheter och inspiration ibland. Du kan avregistrera dig när du vill.</label>` : ""}
                <button class="btn block" type="submit">${signup ? "Skapa konto med e-post" : "Skicka en inloggningskod"}</button>
                <p class="small" style="text-align:center">Vi skickar en kod på sex siffror. Inget lösenord behövs.</p>
                <p class="status" id="codeStatus" role="alert"></p>
              </form>
            </div>
            <div id="authStep" hidden></div>
          </div>
          ${BENEFITS}
        </section>`,
      mount(root) {
        const step = $("#authStep", root), main = $("#authMain", root);
        const done = (msg) => { RQ.toast(msg || "Välkommen! Du är inloggad."); const back = RQ.ss.get("rumiq-after-login"); RQ.ss.set("rumiq-after-login", ""); location.hash = back || "#konto"; RQ.router(); };
        const fail = (el, e) => { el.textContent = (e && e.message) || "Något gick fel. Försök igen."; el.classList.add("err"); };
        RQ.auth.start(); // the auth server is asked now, not on every page of the shop; the page redraws itself when it has answered
        const rt = $("#authRetry", root); if (rt) rt.addEventListener("click", async () => { rt.disabled = true; rt.textContent = "Försöker…"; await RQ.auth.retry(); if (document.contains(rt)) RQ.router(); });
        const busy = (f, on) => { const b = f.querySelector("button[type=submit]"); if (b) b.disabled = on; };
        // Social
        $$("[data-sso]", root).forEach((b) => b.addEventListener("click", async () => {
          const p = b.dataset.sso, name = RQ.auth.providerName(p);
          if (signup) { const st = $("#codeStatus", root); const f = $("#codeForm", root); if (!f.terms.checked) { st.textContent = "Bekräfta integritetspolicyn och villkoren först."; st.classList.add("err"); f.terms.focus(); return; } }
          b.disabled = true; try { await RQ.auth.start(); } catch (e) {} b.disabled = false;
          if (RQ.auth.mode === "down") { RQ.router(); return; }
          if (RQ.auth.mode === "demo") {
            main.hidden = true; step.hidden = false;
            step.innerHTML = `<div class="sso-demo">${RQ.providerLogo(p)}<h2 class="h3">Fortsätt med ${name}</h2><p>På den riktiga sajten öppnas ${name}s egen inloggning, och du kommer tillbaka hit inloggad. I förhandsversionen skapar vi ett testkonto i stället.</p>
              <form id="ssoDemo" novalidate><label>E-post för testkontot<input type="email" name="email" autocomplete="email" required></label><button class="btn block" type="submit">Skapa testkonto</button><button class="link" type="button" id="back" style="border:0;background:none">Tillbaka</button><p class="status" id="ssoStatus" role="alert"></p></form></div>`;
            $("#back", step).addEventListener("click", () => { step.hidden = true; main.hidden = false; });
            $("#ssoDemo", step).addEventListener("submit", async (e) => { e.preventDefault(); const em = e.currentTarget.email.value.trim(); if (!emailOk(em)) return fail($("#ssoStatus", step), { message: "Skriv en giltig e-postadress." }); await RQ.auth.social(p, em); done(`Inloggad med ${name} (testkonto).`); });
            setTimeout(() => step.querySelector("input").focus(), 50);
            return;
          }
          try { b.disabled = true; await RQ.auth.social(p); } catch (e) { b.disabled = false; fail($("#codeStatus", root), e); }
        }));
        // Email code
        $("#codeForm", root).addEventListener("submit", async (e) => {
          e.preventDefault(); const f = e.currentTarget, st = $("#codeStatus", root); st.classList.remove("err");
          const email = f.email.value.trim();
          if (!emailOk(email)) { RQ.badField(f.email, st, ""); return fail(st, { message: "Skriv en giltig e-postadress." }); }
          if (signup && !f.terms.checked) { RQ.badField(f.terms, st, ""); return fail(st, { message: "Bekräfta integritetspolicyn och villkoren först." }); }
          if (f.querySelector("button[type=submit]").disabled) return; // one code per press
          busy(f, true); st.textContent = "";
          try {
            const r = await RQ.auth.sendCode(email, signup ? f.name.value.trim() : "", signup && f.news.checked);
            busy(f, false);
            main.hidden = true; step.hidden = false;
            step.innerHTML = `<h2 class="h3">Skriv in koden</h2><p style="margin:.5rem 0 1.2rem;color:var(--ink2)">Vi har skickat en kod på sex siffror till <b>${esc(email)}</b>.</p>
              ${r.demoCode ? `<p class="example-note"><span>●</span><span><b>Förhandsversion.</b> Inget mejl skickas. Din testkod är <b style="font-family:var(--mono);letter-spacing:.1em">${r.demoCode}</b>.</span></p>` : ""}
              <form id="verify" novalidate style="margin-top:1.2rem"><div class="otp">${[0, 1, 2, 3, 4, 5].map((i) => `<input inputmode="numeric" maxlength="1" aria-label="Siffra ${i + 1}" ${i === 0 ? 'autocomplete="one-time-code"' : ""}>`).join("")}</div>
              <button class="btn block" type="submit">Logga in</button><div class="ctrl-row" style="justify-content:space-between"><button class="link" type="button" id="resend" style="border:0;background:none">Skicka en ny kod</button><button class="link" type="button" id="back" style="border:0;background:none">Byt e-post</button></div><p class="status" id="vStatus" role="alert"></p></form>`;
            const boxes = $$(".otp input", step);
            boxes.forEach((bx, i) => {
              bx.addEventListener("input", () => { bx.value = bx.value.replace(/\D/g, "").slice(-1); if (bx.value && boxes[i + 1]) boxes[i + 1].focus(); if (boxes.every((x) => x.value)) $("#verify", step).requestSubmit(); });
              bx.addEventListener("keydown", (ev) => { if (ev.key === "Backspace" && !bx.value && boxes[i - 1]) boxes[i - 1].focus(); });
              bx.addEventListener("paste", (ev) => { const d = (ev.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6); if (d.length) { ev.preventDefault(); d.split("").forEach((c, j) => boxes[j] && (boxes[j].value = c)); (boxes[d.length] || boxes[5]).focus(); if (d.length === 6) $("#verify", step).requestSubmit(); } });
            });
            boxes[0].focus();
            $("#verify", step).addEventListener("submit", async (ev) => { ev.preventDefault(); const code = boxes.map((x) => x.value).join(""); if (code.length < 6) return fail($("#vStatus", step), { message: "Skriv alla sex siffror." }); try { await RQ.auth.verifyCode(email, code); done(signup ? "Ditt konto är skapat. Välkommen!" : null); } catch (er) { fail($("#vStatus", step), er); boxes.forEach((x) => (x.value = "")); boxes[0].focus(); } });
            $("#resend", step).addEventListener("click", () => { f.requestSubmit(); });
            $("#back", step).addEventListener("click", () => { step.hidden = true; main.hidden = false; });
          } catch (er) { busy(f, false); fail(st, er); }
        });
      },
    };
  }
  V.signup = () => (S.customer() ? V.account() : authView("skapa"));

  /* a jump menu that follows the page: the part you are reading is marked (class on, aria-current), on phones it is
     scrolled into view sideways. Used by Mitt konto and Sparat. Returns a clean-up function. */
  RQ.jumpSpy = (nav, root) => {
    if (!nav) return () => {};
    const links = $$("a[href^='#']", nav).map((a) => [a, document.getElementById(a.getAttribute("href").slice(1))]).filter((x) => x[1]);
    let raf = 0, cur = null, lock = 0;
    const mark = (a) => {
      if (a === cur) return; cur = a;
      links.forEach(([x]) => { x.classList.toggle("on", x === a); if (x === a) x.setAttribute("aria-current", "true"); else x.removeAttribute("aria-current"); });
      if (a && nav.scrollWidth > nav.clientWidth + 2) { const l = a.offsetLeft - nav.offsetLeft, r = l + a.offsetWidth; if (l < nav.scrollLeft || r > nav.scrollLeft + nav.clientWidth) nav.scrollTo({ left: Math.max(0, l - 24), behavior: "smooth" }); }
    };
    const check = () => { raf = 0; if (Date.now() < lock) return; const line = innerHeight * 0.3; let on = links[0];
      links.forEach((x) => { if (x[1].getBoundingClientRect().top <= line) on = x; });
      if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) on = links[links.length - 1]; // the last part can never reach the line
      mark(on && on[0]); };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(check); };
    nav.addEventListener("click", (e) => { const a = e.target.closest("a[href^='#']"); if (!a) return; const t = document.getElementById(a.getAttribute("href").slice(1)); if (!t) return;
      e.preventDefault(); lock = Date.now() + 900; mark(a); t.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); });
    addEventListener("scroll", onScroll, { passive: true }); check();
    return () => removeEventListener("scroll", onScroll);
  };

  V.account = () => {
    const c = S.customer();
    if (!c) return authView("logga");
    const orders = S.orders(), lists = S.lists();
    const prov = c.provider && c.provider !== "email" && c.provider !== "password" ? RQ.auth.providerName(c.provider) : null;
    const addr = c.address || {};
    return {
      title: "Mitt konto · RumIQ",
      html: `<header class="page-head wrap" style="padding-bottom:1.5rem">${RQ.crumbs([["Hem", "hem"], ["Mitt konto"]])}<h1 class="h1">${c.name ? "Hej " + esc(c.name) : "Mitt konto"}</h1>
          <p class="lead">${prov ? `<span class="provider">${RQ.providerLogo(c.provider)} Inloggad med ${prov}</span> · ` : ""}${esc(c.email)}</p></header>
        <section class="wrap acct" style="padding-bottom:5rem">
          <nav class="acct-nav" aria-label="Konto"><a href="#acc-oversikt" class="on" aria-current="true">Översikt</a><a href="#acc-studio">Mitt rum</a><a href="#acc-order">Beställningar</a><a href="#acc-listor">Mina listor</a><a href="#acc-profil">Profil och adress</a><a href="#acc-installningar">Inställningar</a><a href="#mitt-hem">Sparat</a></nav>
          <div style="display:grid;gap:3.2rem;min-width:0">
            <section id="acc-oversikt"><div class="stat-grid">
              <a class="stat" href="#acc-order"><b>${orders.length}</b><span>Beställningar</span></a>
              <a class="stat" href="#onskelista"><b>${S._wish.length}</b><span>Sparat</span></a>
              <a class="stat" href="#acc-listor"><b>${lists.length}</b><span>Listor</span></a>
              <a class="stat" href="#mitt-hem"><b>${S.projects().length}</b><span>Rumsprojekt</span></a></div></section>
            <section id="acc-studio"><div class="sec-row" style="margin-bottom:1.2rem"><h2 class="h3">Mitt rum och AI-bilder</h2><a class="link arrow" href="#studio-plus">Om Studio Plus</a></div><div data-ai-account><p class="small">Laddar…</p></div></section>
            <section id="acc-order"><h2 class="h3" style="margin-bottom:1.2rem">Beställningar</h2>${orders.length ? orders.map(orderCard).join("") : `<div class="empty"><h3>Inga beställningar än</h3><p>När du beställer hamnar ordern här.</p><a class="btn ghost" href="#butik">Till butiken</a></div>`}</section>
            <section id="acc-listor"><div class="sec-row" style="margin-bottom:1.2rem"><h2 class="h3">Mina listor</h2><a class="link arrow" href="#onskelista">Öppna listorna</a></div>${lists.length ? `<div class="chips">${lists.map((l) => `<a class="chip" href="#onskelista">${esc(l.name)} (${l.handles.length})</a>`).join("")}</div>` : `<p class="small">Inga egna listor än. Spara produkter i ett rum från produktsidan.</p>`}</section>
            <section id="acc-profil"><h2 class="h3" style="margin-bottom:1.2rem">Profil och adress</h2>
              <form id="profForm" class="form-grid panel" novalidate><label>Förnamn<input name="name" value="${esc(c.name || "")}" autocomplete="given-name"></label><label>E-post<input value="${esc(c.email)}" disabled></label>
                <label class="full">Gatuadress<input name="street" value="${esc(addr.street || "")}" autocomplete="street-address"></label><label>Postnummer<input name="zip" value="${esc(addr.zip || "")}" inputmode="numeric" autocomplete="postal-code"></label><label>Ort<input name="city" value="${esc(addr.city || "")}" autocomplete="address-level2"></label>
                <label class="full">Telefon (valfritt)<input name="phone" type="tel" value="${esc(c.phone || "")}" autocomplete="tel"></label>
                <button class="btn" type="submit">Spara</button><p class="status full" id="profStatus"></p></form></section>
            <section id="acc-installningar"><h2 class="h3" style="margin-bottom:1.2rem">Inställningar</h2><div class="panel" style="display:grid;gap:1rem">
              <label class="switch"><input type="checkbox" id="mkt" ${c.marketing ? "checked" : ""}><span></span>Nyheter och inspiration via e-post</label>
              <p class="small">Inloggning: ${prov ? `${prov}` : "e-post med kod"}. ${RQ.auth.mode === "demo" ? "Kontot finns bara i den här webbläsaren i förhandsversionen." : ""}</p>
              <div class="ctrl-row"><button class="btn ghost sm" type="button" id="out">Logga ut</button><button class="btn ghost sm" type="button" id="wipe">Ta bort konto och sparad data</button></div><p class="status" id="wipeStatus"></p></div></section>
          </div>
        </section>`,
      mount(root) {
        $("#out", root).addEventListener("click", async () => { await RQ.auth.signOut(); RQ.toast("Du är utloggad."); RQ.router(); });
        let armed = false;
        $("#wipe", root).addEventListener("click", async (e) => {
          if (!armed) { armed = true; e.currentTarget.textContent = "Klicka igen för att ta bort allt"; $("#wipeStatus", root).textContent = "Det går inte att ångra."; return; }
          try { await RQ.auth.deleteAccount(); } catch (er) { $("#wipeStatus", root).textContent = "Kontot kunde inte tas bort just nu. Försök igen eller kontakta oss."; return; }
          S.clearAll(); RQ.toast("Kontot och all sparad data är borttagen."); location.hash = "#hem";
        });
        $("#mkt", root).addEventListener("change", (e) => { S.setProfile({ marketing: e.target.checked }); RQ.toast(e.target.checked ? "Du får nyheter via e-post." : "Du får inga nyhetsmejl."); });
        $("#profForm", root).addEventListener("submit", (e) => { e.preventDefault(); const f = e.currentTarget; const zip = f.zip.value.trim();
          if (zip && !/^\d{3}\s?\d{2}$/.test(zip)) { $("#profStatus", root).textContent = "Postnumret ska ha fem siffror."; f.zip.focus(); return; }
          const tel = f.phone.value.trim();
          if (tel && !/^\+?[\d\s()-]{6,20}$/.test(tel)) { $("#profStatus", root).textContent = "Skriv telefonnumret med siffror, eller lämna fältet tomt."; f.phone.focus(); return; }
          S.setProfile({ name: f.name.value.trim(), phone: f.phone.value.trim(), address: { street: f.street.value.trim(), zip, city: f.city.value.trim() } }); $("#profStatus", root).textContent = "Sparat. Kassan fylls i automatiskt nästa gång."; });
        root.addEventListener("click", (e) => {
          const t = e.target.closest("[data-track],[data-wd]"); if (t) RQ.ss.set("rumiq-prefill", t.dataset.track || t.dataset.wd);
          const a = e.target.closest(".stat[href^='#acc-']"); if (a) { e.preventDefault(); const el = document.getElementById(a.getAttribute("href").slice(1)); el.scrollIntoView({ behavior: "smooth", block: "start" }); }
        });
        return RQ.jumpSpy($(".acct-nav", root), root);
      },
    };
  };

  /* ---------------- Kassa (test mode) */
  const cfgDel = () => (window.RQ_CONFIG || {}).delivery || {};
  // one sentence about the return window, read from the settings (never typed by hand)
  const returnLine = () => (cfgDel().openPurchaseDays ? `${cfgDel().openPurchaseDays} dagars öppet köp från att du tog emot varan. Lagen ger alltid 14 dagars ångerrätt.` : "14 dagars ångerrätt från att du tog emot varan.");
  const shipOf = (id) => S.SHIPPING.find((x) => x.id === id) || S.SHIPPING[0];
  const shipPrice = (n) => (n ? kr(n) : "Fri");
  const digits = (v) => String(v).replace(/\D/g, "");
  // checkout fields: what must be right, and the words shown under the field when it is not
  const CO_RULES = {
    email: (v) => (emailOk(v) ? "" : v ? "Skriv en giltig e-postadress, till exempel namn@exempel.se." : "Skriv din e-postadress."),
    phone: (v) => (!v || (/^\+?[\d\s()-]+$/.test(v) && digits(v).length >= 7 && digits(v).length <= 15) ? "" : "Skriv numret med siffror, till exempel 070 123 45 67."),
    first: (v) => (/\p{L}/u.test(v) ? "" : "Skriv ditt förnamn."),
    last: (v) => (/\p{L}/u.test(v) ? "" : "Skriv ditt efternamn."),
    street: (v) => (/\p{L}{2}/u.test(v) ? "" : "Skriv gatuadressen, till exempel Storgatan 1."),
    zip: (v) => (digits(v).length === 5 && /^[\d\s]+$/.test(v) ? "" : "Fem siffror, till exempel 123 45."),
    city: (v) => (/\p{L}{2}/u.test(v) ? "" : "Skriv orten."),
  };
  V.checkout = () => {
    const lines = S.cartLines();
    if (!lines.length) return { html: `${RQ.head(RQ.crumbs([["Hem", "hem"], ["Kassa"]]), "Kassa", "")}<section class="wrap" style="padding-bottom:5rem">${RQ.emptyCartHtml(true)}</section>` };
    const c = S.customer() || {};
    const nm = String(c.name || "").trim().split(/\s+/), first = nm[0] || "", last = nm.slice(1).join(" ");
    // the summary is drawn from the cart each time, so it always shows what will be ordered
    const summary = () => { const ls = S.cartLines(), n = S.cartCount();
      return `<details class="co-det" open><summary><h2 class="h3">Sammanfattning</h2><span class="co-mini"><span>${n} ${n === 1 ? "vara" : "varor"}</span><b data-co="total"></b></span></summary>
        <div id="coLines">${ls.map((l) => `<div class="line" style="grid-template-columns:3.6rem 1fr auto"><img src="${RQ.img(l.product, 600)}" alt="" width="58" height="72" loading="lazy" decoding="async"><div><h3>${esc(l.product.name)}</h3><div class="v">${l.quantity} st${l.variant.title !== "Standard" ? " · " + esc(l.variant.title) : ""}</div></div><span class="lp">${kr(l.lineTotal)}</span></div>`).join("")}</div>
        <div class="co-sums"><div class="sum"><span>Delsumma</span><span>${kr(S.cartSubtotal())}</span></div>${RQ.discRows(S.lookDiscounts())}<div class="sum"><span>Frakt</span><span data-co="ship"></span></div><div class="sum total"><span>Totalt</span><span data-co="total"></span></div><div class="sum small"><span>Varav moms</span><span data-co="vat"></span></div></div></details>`; };
    const fld = (name, label, attrs, cls = "") => `<label${cls ? ` class="${cls}"` : ""}>${label}<input name="${name}" ${attrs}><span class="ferr" id="coe-${name}" hidden></span></label>`;
    return {
      title: "Kassa · RumIQ",
      html: `<header class="page-head wrap" style="padding-bottom:1rem">${RQ.crumbs([["Hem", "hem"], ["Varukorg"], ["Kassa"]]).replace("<li>Varukorg</li>", '<li><button type="button" class="crumb-btn" data-open-cart>Varukorg</button></li>')}<h1 class="h1">Kassa</h1></header>
        <section class="wrap split co-split" style="padding-bottom:5rem;align-items:start">
          <form id="co" novalidate>
            <div class="example-note co-note"><span>●</span><span><b>Testläge.</b> Varukorgen innehåller exempelprodukter. Du kan gå igenom hela kassan, men inget betalas och inget skickas. När butiken öppnar sker betalningen i Shopifys säkra kassa.</span></div>
            <div class="panel"><h2 class="h3">1. Kontakt</h2><div class="form-grid" style="margin-top:1rem">${fld("email", "E-post", `type="email" autocomplete="email" autocapitalize="off" spellcheck="false" value="${esc(c.email || "")}" required`, "full")}${fld("phone", "Telefon (valfritt, för avisering)", `type="tel" autocomplete="tel" value="${esc(c.phone || "")}"`, "full")}</div>${c.email ? "" : `<p class="small" style="margin-top:.8rem">Har du ett konto? <a href="#konto" data-after="kassa">Logga in</a> så fylls uppgifterna i. Annars handlar du som gäst.</p>`}</div>
            <div class="panel"><h2 class="h3">2. Leveransadress</h2><div class="form-grid" style="margin-top:1rem">${fld("first", "Förnamn", `autocomplete="given-name" value="${esc(first)}" required`, "half")}${fld("last", "Efternamn", `autocomplete="family-name" value="${esc(last)}" required`, "half")}${fld("street", "Gatuadress", `autocomplete="street-address" value="${esc((c.address || {}).street || "")}" required`, "full")}${fld("zip", "Postnummer", `autocomplete="postal-code" inputmode="numeric" maxlength="7" value="${esc((c.address || {}).zip || "")}" required`, "half")}${fld("city", "Ort", `autocomplete="address-level2" value="${esc((c.address || {}).city || "")}" required`, "half")}<label class="full">Land<select name="country" autocomplete="country-name"><option>Sverige</option></select></label></div></div>
            <div class="panel"><h2 class="h3" id="coShipH">3. Leveranssätt</h2><div role="radiogroup" aria-labelledby="coShipH" style="display:grid;gap:.6rem;margin-top:1rem">${S.SHIPPING.map((s, i) => `<label class="check ship-opt"><span class="so-l"><input type="radio" name="ship" value="${s.id}" ${i === 0 ? "checked" : ""}> <span><b>${s.title}</b><span class="small">${s.eta ? `Målet är ${s.eta}` : "Leveranstiden visas innan du betalar"}${s.note ? `<br>${s.note}` : ""}</span></span></span><span class="so-p" data-ship-price="${s.id}">${shipPrice(S.shippingCost(s.id))}</span></label>`).join("")}</div><p class="small" style="margin-top:.8rem">Leveranssätt och priser är exempel tills leverantörerna är bekräftade.</p><label class="check" style="margin-top:1.1rem"><input type="checkbox" name="gift" id="coGift"> Det är en present</label><div class="gift-box" id="coGiftBox" hidden><p class="small">Priserna syns inte på följesedeln. Skriv en hälsning, så lägger vi den på ett kort i paketet.</p><label class="full">Hälsning (frivillig)<textarea name="giftNote" rows="3" maxlength="240" placeholder="Grattis på nya hemmet!"></textarea></label></div></div>
            <div class="panel"><h2 class="h3">4. Betalning</h2><p style="margin-top:.6rem;color:var(--ink2)">När butiken öppnar betalar du i Shopifys kassa. Vi ser aldrig dina kortuppgifter. I testläget hoppar vi över betalningen.</p>${RQ.payRow ? RQ.payRow() : ""}
              <label class="check" style="margin-top:1rem"><input type="checkbox" name="terms" required aria-describedby="coe-terms"> <span>Jag godkänner <a href="#juridik-villkor">köpvillkoren</a> och har läst om min <a href="#juridik-angerratt">ångerrätt</a>.</span></label><span class="ferr" id="coe-terms" hidden></span>
              <div class="co-final"><div class="sum"><span>Frakt</span><span data-co="ship"></span></div><div class="sum total"><span>Totalt</span><span data-co="total"></span></div></div>
              <button class="btn block" type="submit" style="margin-top:1.2rem"><span><span>Lägg testorder</span> · <span data-co="total"></span></span></button><p class="status err" id="coStatus" role="alert"></p></div>
          </form>
          <aside class="panel co-sum" id="coSum">${summary()}</aside>
        </section>`,
      mount(root) {
        const f = $("#co", root), sum = $("#coSum", root), phone = matchMedia("(max-width:900px)");
        const set = (k, v) => $$(`[data-co=${k}]`, root).forEach((el) => (el.textContent = v));
        const upd = () => { const ship = S.shippingCost(f.ship.value), t = S.cartTotalBeforeShipping() + ship;
          set("ship", shipPrice(ship)); set("total", kr(t)); set("vat", kr(S.vatIncluded(t)));
          $$("[data-ship-price]", f).forEach((el) => (el.textContent = shipPrice(S.shippingCost(el.dataset.shipPrice)))); };
        // on a phone the summary is one line above the form (open it to see the things); beside the form it is always open
        const fold = () => { const d = $(".co-det", sum); d.open = !phone.matches; d.addEventListener("toggle", () => { if (!phone.matches && !d.open) d.open = true; }); };
        $$("[name=ship]", f).forEach((r) => r.addEventListener("change", upd)); fold(); upd();
        f.gift.addEventListener("change", () => { $("#coGiftBox", root).hidden = !f.gift.checked; });
        // the cart can change while the checkout is open (the drawer, another tab): the summary follows it
        let placing = false;
        const off = S.onChange((w) => { if (w !== "cart" || placing) return; if (!S.cartLines().length) return RQ.router(); const was = $(".co-det", sum).open; sum.innerHTML = summary(); fold(); if (phone.matches) $(".co-det", sum).open = was; upd(); });
        // errors: under the field they belong to, all at once, and the first one gets the focus
        const mark = (el, box, msg) => { box.textContent = msg; box.hidden = !msg; if (msg) { el.setAttribute("aria-invalid", "true"); el.setAttribute("aria-describedby", box.id); } else { el.removeAttribute("aria-invalid"); if (el.name !== "terms") el.removeAttribute("aria-describedby"); } };
        const check = (name) => { const el = f[name], msg = name === "terms" ? (el.checked ? "" : "Kryssa i rutan för att godkänna köpvillkoren.") : CO_RULES[name](el.value.trim()); mark(el, $("#coe-" + name, f), msg); return !msg; };
        const NAMES = [...Object.keys(CO_RULES), "terms"];
        const said = (n) => (!n ? "" : n === 1 ? "En sak behöver rättas innan du kan beställa." : `${n} saker behöver rättas innan du kan beställa.`);
        // after a try, the count under the button follows every fix (changed only when the number changes, so it is not read out at every key)
        const recount = () => { const st = $("#coStatus", root); if (!st.textContent) return; const t = said($$("[aria-invalid=true]", f).length); if (t !== st.textContent) st.textContent = t; };
        NAMES.forEach((n) => { const el = f[n]; el.addEventListener(n === "terms" ? "change" : "input", () => { if (el.getAttribute("aria-invalid")) { check(n); recount(); } });
          if (n !== "terms") el.addEventListener("blur", () => { if (n === "zip" && digits(el.value).length === 5 && /^[\d\s]+$/.test(el.value)) el.value = digits(el.value).replace(/^(\d{3})(\d{2})$/, "$1 $2"); if (el.value.trim() || el.getAttribute("aria-invalid")) { check(n); recount(); } }); });
        f.addEventListener("submit", (e) => {
          e.preventDefault(); if (placing) return; const st = $("#coStatus", root);
          const bad = NAMES.filter((n) => !check(n));
          if (bad.length) { st.textContent = said(bad.length); const el = f[bad[0]]; (el.closest("label") || el).scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion:reduce)").matches ? "auto" : "smooth" }); el.focus({ preventScroll: true }); return; }
          st.textContent = ""; placing = true;
          const zip = digits(f.zip.value).replace(/^(\d{3})(\d{2})$/, "$1 $2");
          const o = S.placeTestOrder({ contact: { email: f.email.value.trim(), phone: f.phone.value.trim() }, address: { first: f.first.value.trim(), last: f.last.value.trim(), street: f.street.value.trim(), zip, city: f.city.value.trim(), country: f.country.value }, shippingId: f.ship.value, gift: f.gift && f.gift.checked ? { note: f.giftNote.value.trim().slice(0, 240) } : null });
          if (o && S.customer() && !(S.customer().address || {}).street) S.setProfile({ address: { street: f.street.value.trim(), zip, city: f.city.value.trim() }, phone: f.phone.value.trim() });
          if (o) location.hash = "#order-" + o.number; else placing = false;
        });
        return off;
      },
    };
  };
  // the receipt on the thank-you page: what was ordered, where it goes, how, and what it cost
  const receipt = (o) => { const a = o.address || {}, sh = shipOf(o.shippingId), eta = RQ.delivery ? RQ.delivery.range(RQ.delivery.cfg(), o.createdAt) : "", net = o.subtotal - (o.discount || 0) + (o.shipping || 0);
    return `<div class="order receipt"><header><div><b>${esc(o.number)}</b><div class="small">${date(o.createdAt)}</div></div><span class="st">${o.withdrawn ? "ÅNGRAD" : "TESTORDER"}</span></header>
      <ul class="rc-lines">${o.lines.map((l) => { const p = RQ.byHandle(l.handle); return `<li>${p ? `<img src="${RQ.img(p, 600)}" alt="" width="48" height="60" loading="lazy" decoding="async">` : "<span></span>"}<span><b>${esc(l.title)}</b><small>${l.quantity} st${l.variant !== "Standard" ? " · " + esc(l.variant) : ""}</small></span><span class="lp">${kr(l.price * l.quantity)}</span></li>`; }).join("")}</ul>
      <div class="co-sums"><div class="sum"><span>Delsumma</span><span>${kr(o.subtotal)}</span></div>${o.discount ? `<div class="sum disc"><span>Rabatt på hel look</span><span>−${kr(o.discount)}</span></div>` : ""}<div class="sum"><span>Frakt</span><span>${shipPrice(o.shipping)}</span></div><div class="sum total"><span>Totalt</span><span>${kr(o.total)}</span></div><div class="sum small"><span>Varav moms</span><span>${kr(S.vatIncluded(net))}</span></div></div>
      <dl class="rc-facts">${a.street ? `<div><dt>Levereras till</dt><dd>${esc(a.first || "")} ${esc(a.last || "")}<br>${esc(a.street)}<br>${esc(a.zip || "")} ${esc(a.city || "")}</dd></div>` : ""}<div><dt>Leveranssätt</dt><dd>${esc(sh.title)}${sh.eta ? `<br>Målet är ${esc(sh.eta)}` : ""}${eta ? `<br><span class="small">Beräknat: <span>${eta}</span></span>` : ""}</dd></div>${o.gift ? `<div><dt>Present</dt><dd>${o.gift.note ? `Hälsning: ”${esc(o.gift.note)}”` : "Utan priser på följesedeln"}</dd></div>` : ""}</dl></div>`; };
  V.orderDone = (num) => {
    const o = S.orders().find((x) => x.number === num); if (!o) return null;
    return { title: "Tack för din testorder · RumIQ",
      html: `<header class="page-head wrap"><span class="eyebrow">Testorder ${esc(o.number)}</span><h1 class="h1">Tack! Så här hade det sett ut.</h1><p class="lead">Ingen betalning gjordes och inget skickas. När butiken är öppen får du en orderbekräftelse via e-post till ${esc(o.contact.email)}.</p></header>
        <section class="wrap split" style="padding-bottom:5rem;align-items:start"><div>${receipt(o)}<div class="ctrl-row" style="margin-top:1.2rem"><a class="btn" href="#butik">Fortsätt handla</a><a class="btn ghost" href="#spara-order" data-track="${o.number}">Spåra min beställning</a></div>${o.withdrawn ? "" : `<p class="small" style="margin-top:1rem">Ångrat dig? <a href="#angra" data-wd="${o.number}">Ångra köpet här</a>. Du kan prova det med testordern också.</p>`}</div>
          <div><h2 class="h3">Vad händer nu?</h2><ol class="timeline"><li class="done"><div><b>Beställningen tas emot</b><small>Du får en bekräftelse via e-post.</small></div></li><li><div><b>Leverantören packar</b><small>Varor från olika leverantörer kan skickas separat.</small></div></li><li><div><b>Skickad</b><small>Du får spårningsnummer när fraktbolaget har det.</small></div></li><li><div><b>Levererad</b><small>${returnLine()}</small></div></li></ol></div></section>`,
      mount(root) { RQ.ss.set("rumiq-prefill", o.number); root.addEventListener("click", (e) => { const t = e.target.closest("[data-track],[data-wd]"); if (t) RQ.ss.set("rumiq-prefill", t.dataset.track || t.dataset.wd); }); } };
  };

  /* ---------------- Spåra min beställning */
  V.track = () => RQ.infoPage("spara-order", "Kundservice", "Spåra min beställning", "Ange ordernummer och e-post, så ser du var beställningen är.",
    `<form id="trForm" class="form-grid" novalidate><label>Ordernummer<input name="num" placeholder="Till exempel TEST-1001" autocapitalize="characters" autocomplete="off" spellcheck="false" required></label><label>E-post<input type="email" name="email" autocomplete="email" autocapitalize="off" spellcheck="false" required></label><button class="btn" type="submit">Visa status</button><p class="status full" id="trStatus" role="alert"></p></form><div id="trOut"></div>
     <h2>Om du har en riktig beställning</h2><p>Använd länken till orderstatus i orderbekräftelsen. Spårning från fraktbolaget visas när leverantören eller fraktbolaget skickar den. Varor från olika leverantörer kan komma i separata paket.</p>`,
    (root) => {
      const f = $("#trForm", root), out = $("#trOut", root); const pre = RQ.ss.get("rumiq-prefill"), preO = pre && S.findOrder(pre); if (pre) { f.num.value = pre; if (preO) f.email.value = preO.contact.email; }
      // errors under the field they belong to, in red, as in the checkout; the first one gets the focus
      [f.num, f.email].forEach((el) => el.addEventListener("input", () => { if (el.getAttribute("aria-invalid")) RQ.fieldErr(el, ""); }));
      const show = (e) => {
        if (e) e.preventDefault(); const st = $("#trStatus", root);
        const e1 = f.num.value.trim() ? "" : "Skriv ordernumret, till exempel TEST-1001.", e2 = emailOk(f.email.value) ? "" : "Skriv e-postadressen du använde vid köpet.";
        RQ.fieldErr(f.num, e1); RQ.fieldErr(f.email, e2);
        if (e1 || e2) { st.textContent = ""; out.innerHTML = ""; (e1 ? f.num : f.email).focus(); return; }
        const o = S.findOrder(f.num.value, f.email.value);
        if (!o) { st.textContent = "Vi hittar ingen beställning med de uppgifterna i den här webbläsaren. Kontrollera ordernumret och e-posten."; out.innerHTML = ""; return; }
        st.textContent = "";
        const dc = RQ.delivery ? RQ.delivery.cfg() : {}, eta = RQ.delivery ? RQ.delivery.range(dc, o.createdAt) : "", ship = (S.SHIPPING.find((x) => x.id === o.shippingId) || {}).title || "";
        out.innerHTML = `<div class="tr-res">${orderCard(o, true)}
          ${o.withdrawn ? "" : `<div class="tr-eta"><span class="eyebrow">Beräknad leverans</span><b>${eta || "Bekräftas innan vi öppnar"}</b>${ship ? `<small>${esc(ship)}${dc.fromCountry ? ` · ${esc(dc.fromCountry)}` : ""}</small>` : ""}</div>`}
          <ol class="timeline"><li class="done"><div><b>Mottagen</b><small>${date(o.createdAt)}</small></div></li>
          <li class="${o.withdrawn ? "done" : ""}"><div><b>${o.withdrawn ? "Köpet ångrat" : "Packas"}</b><small>${o.withdrawn ? date(o.withdrawnAt) : "Testorder, skickas inte"}</small></div></li>
          ${o.withdrawn ? "" : `<li><div><b>Lämnar lagret</b><small>Du får ett mejl när paketet har lämnat lagret</small></div></li>
          <li><div><b>På väg</b><small>Spårningsnummer och fraktbolagets länk visas här</small></div></li>
          <li><div><b>${o.shippingId === "hem" ? "Levererad" : "Redo att hämta"}</b><small>${o.shippingId === "skap" ? "Du får en kod till paketskåpet" : o.shippingId === "ombud" ? "Ta med legitimation till ombudet" : "Fraktbolaget meddelar när det kommer"}</small></div></li>`}</ol></div>`;
      };
      f.addEventListener("submit", show);
      if (preO) show(); // came from the order: its status straight away
    });

  /* ---------------- Ångra avtalet här */
  V.withdraw = () => RQ.infoPage("angra", "Kundservice", "Ångra avtalet här", "Ångra hela eller delar av en beställning. Du behöver inte logga in och inte ange något skäl.",
    `<div id="wdStep1"><form id="wdForm" class="form-grid" novalidate><label>Ordernummer<input name="num" required placeholder="Till exempel TEST-1001" autocapitalize="characters" autocomplete="off" spellcheck="false"></label><label>E-post som användes vid köpet<input type="email" name="email" autocomplete="email" autocapitalize="off" spellcheck="false" required></label><button class="btn" type="submit">Hitta beställningen</button><p class="status full" id="wdStatus" role="alert"></p></form></div>
     <div id="wdStep2"></div>
     <h2>Bra att veta</h2><ul><li>${returnLine()}</li><li>Efter att du ångrat har du 14 dagar på dig att skicka tillbaka varan.</li><li>Vi betalar tillbaka senast 14 dagar efter ditt meddelande, men får vänta tills varan kommit tillbaka.</li><li>Du kan också skriva till support@rumiq.se eller använda Konsumentverkets standardformulär.</li></ul>
     <p class="note">I förhandsversionen hittar formuläret bara testordrar som lagts i den här webbläsaren.</p>`,
    (root) => {
      const f = $("#wdForm", root); const pre = RQ.ss.get("rumiq-prefill"); if (pre) { f.num.value = pre; const o = S.findOrder(pre); if (o) f.email.value = o.contact.email; }
      f.addEventListener("submit", (e) => {
        e.preventDefault(); const st = $("#wdStatus", root);
        if (!f.num.value.trim()) return RQ.badField(f.num, st, "Skriv ordernumret, till exempel TEST-1001.");
        if (!emailOk(f.email.value)) return RQ.badField(f.email, st, "Skriv e-postadressen du använde vid köpet.");
        const o = S.findOrder(f.num.value, f.email.value);
        if (!o) { st.textContent = "Vi hittar ingen beställning med de uppgifterna. Kontrollera ordernumret, eller skriv till support@rumiq.se."; return; }
        if (o.withdrawn) { st.textContent = `Köpet ångrades redan ${date(o.withdrawnAt)}.`; return; }
        st.textContent = "";
        $("#wdStep2", root).innerHTML = `<div class="panel" style="margin-top:1.6rem"><h3 class="h3">Vilka varor vill du ångra?</h3><form id="wd2" style="display:grid;gap:.6rem;margin-top:1rem">${o.lines.map((l) => `<label class="check"><input type="checkbox" name="l" value="${l.handle}" checked> ${l.quantity} × ${esc(l.title)}</label>`).join("")}<button class="btn" type="submit" style="justify-self:start;margin-top:.8rem">Ångra valda varor</button></form></div>`;
        $("#wd2", root).addEventListener("submit", (ev) => {
          ev.preventDefault(); const hs = $$("[name=l]:checked", ev.currentTarget).map((x) => x.value);
          if (!hs.length) { RQ.toast("Välj minst en vara."); return; }
          const w = S.withdrawOrder(o.number, hs.length === o.lines.length ? null : hs);
          $("#wdStep1", root).hidden = true;
          $("#wdStep2", root).innerHTML = `<div class="result"><span class="eyebrow">Kvitto på ånger</span><h2 style="margin-top:.4rem">Ditt köp är ångrat</h2><p style="margin-top:.6rem">Order ${esc(w.number)}, ${hs.length} av ${o.lines.length} varor, ${date(w.withdrawnAt)}. En bekräftelse skickas till ${esc(o.contact.email)} när butiken är öppen. Spara gärna den här sidan.</p><p class="small" style="margin-top:.8rem">Returadress och instruktioner kommer i bekräftelsen.</p></div>`;
        });
      });
    });
})();
