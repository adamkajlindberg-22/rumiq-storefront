/* RumIQ editorial, customer-service and legal content (Swedish).
   Pages marked DRAFT are checked against company, supplier and legal details before sales start.
   Nothing here is legal advice. Company details are null until the company is registered. */
(function () {
  const RQ = (window.RQ = window.RQ || {});

  RQ.COMPANY = { name: null, orgNr: null, vat: null, address: null, returnAddress: null, email: "support@rumiq.se" };
  const C = RQ.COMPANY;
  const miss = (label) => `<span class="pending">${label}: fylls i innan försäljningen börjar</span>`;
  const seller = () => `${C.name || miss("Företagsnamn")}, org.nr ${C.orgNr || miss("organisationsnummer")}, ${C.address || miss("adress")}`;
  const draft = `<p class="draft">Utkast. Texten kontrolleras och kompletteras med bolags- och leverantörsuppgifter innan butiken öppnar.</p>`;
  const mail = `<a href="mailto:${C.email}">${C.email}</a>`;

  /* The figures a customer is promised, read from config.js in ONE place, so that no page can say something else.
     The build (tools/build.py) reads the same object for the sitemap, the product feed and the structured data. */
  const CFG = window.RQ_CONFIG || {}, DEL = CFG.delivery || {}, SHIP = CFG.shipping || {};
  const F = (RQ.facts = { openDays: DEL.openPurchaseDays || 0, minDays: DEL.minDays || 0, maxDays: DEL.maxDays || 0,
    freeFrom: CFG.freeShippingFrom || 0, pickup: SHIP.pickup || 49, home: SHIP.home || 89 });
  // the one sentence about returns, and the one about delivery time (a goal until the supplier has confirmed it)
  const openBuy = F.openDays ? `${F.openDays} dagars öppet köp från att du tog emot varan. Lagen ger alltid 14 dagars ångerrätt.` : "Du har 14 dagars ångerrätt från att du tog emot varan.";
  const goal = F.minDays ? `Målet är ${F.minDays}–${F.maxDays} arbetsdagar.` : "Leveranstiden visas innan du betalar.";
  const shipCost = `Hämta hos ombud eller i paketskåp kostar ${F.pickup} kr och hemleverans ${F.home} kr.${F.freeFrom ? ` Handlar du för ${F.freeFrom} kr eller mer är frakten till ombud och paketskåp fri.` : ""}`;

  /* ---------------------------------------------------------------- Customer service */
  RQ.INFO = {
    "sa-fungerar-det": {
      title: "Så fungerar RumIQ", kicker: "Från första idé till färdigt rum",
      lead: "Fem steg från att du hittar något du gillar till att det står hemma hos dig.",
      html: () => `
        <ol class="steps-list">
          <li><h3>Upptäck</h3><p>Bläddra i butiken efter kategori eller rum, läs magasinet eller beskriv med egna ord vad du behöver. Svep, Hitta rätt och stylisten föreslår produkter, och ingen av dem behöver en bild.</p></li>
          <li><h3>Se det i ditt rum</h3><p>Lägg till ett foto av ditt rum eller välj ett exempelrum. Välj produkter och placera dem där du vill ha dem. Resultatet är en bild att inspireras av, så storlek och färg kan skilja sig från verkligheten. Kontrollera alltid produktsidan.</p></li>
          <li><h3>Spara det du gillar</h3><p>Under Sparat samlar du produkter, dina rumsprojekt och din stil, så att du kan fortsätta där du slutade.</p></li>
          <li><h3>Beställ tryggt</h3><p>Lägg enskilda produkter eller en hel look i varukorgen och betala i Shopifys säkra kassa. Leveranssätt, kostnad och beräknad leveranstid visas innan du betalar. Vi ser aldrig dina kortuppgifter.</p></li>
          <li><h3>Leverans och hjälp</h3><p>Följ din beställning, tänk på att varor kan komma i olika paket och hör av dig om något inte stämmer. ${openBuy}</p></li>
        </ol>
        <h2>Verktygen</h2>
        <p>Alla verktyg är gratis. Studio Plus är ett tillval för dig som vill ha fler AI-bilder.</p>
        <table class="tbl"><thead><tr><th>Verktyg</th><th>Vad det gör</th><th>Konto</th></tr></thead><tbody>
          <tr><td><a href="#svep">Svep</a></td><td>Svep tio kort eller gör fyra snabba val och få din stilprofil.</td><td>Behövs inte</td></tr>
          <tr><td><a href="#mitt-rum">Mitt rum</a></td><td>Se produkterna i ett foto av ditt rum, dag som kväll, och se vad som passar färgerna där.</td><td>Behövs inte</td></tr>
          <tr><td><a href="#hitta-ratt">Hitta rätt</a></td><td>Till ditt hem, som present eller med egna ord. Stylisten finns ett tryck bort.</td><td>Behövs inte</td></tr>
          <tr><td><a href="#looks">Looks</a></td><td>Looks med rabatt, eller bygg din egen.</td><td>Behövs inte</td></tr>
          <tr><td><a href="#mitt-hem">Sparat</a></td><td>Det du sparat, dina rum och mått, din stil och dina projekt på ett ställe.</td><td>Sparas i din webbläsare</td></tr>
        </tbody></table>
        <p class="note">Verktygens resultat är förslag, inte garantier eller produktfakta. Kontrollera alltid mått, material och pris på produktsidan innan du köper.</p>`,
    },
    frakt: {
      title: "Frakt & leverans", kicker: "Kundservice",
      lead: "Så kommer dina saker hem till dig, och vad som gäller om något dröjer.",
      html: () => `${draft}
        <h2>Leveranssätt och pris</h2>
        <p>Vi levererar till adresser i Sverige. ${shipCost} Du ser alltid leveranssätt, fraktkostnad och totalsumma i kassan innan du betalar.</p>
        <h2>Leveranstid</h2>
        <p>${goal} Varje produktsida visar vilka datum paketet beräknas komma${DEL.cutoffHour ? `, och beställningar före klockan ${DEL.cutoffHour} på vardagar räknas från samma dag` : ""}.</p>
        <h2>Flera paket</h2>
        <p>Varor från olika leverantörer kan komma i separata paket. Om det innebär en extra kostnad ser du det innan du betalar.</p>
        <h2>Om leveransen dröjer eller inte kommer</h2>
        <p>Hör av dig till oss om den överenskomna leveranstiden har passerat. Om ingen tid avtalades ska varan normalt levereras inom 30 dagar. Du kan kräva leverans, hålla inne betalning som inte är gjord och, när villkoren i lagen är uppfyllda, häva köpet och begära ersättning.</p>
        <p>Skriv till ${mail} med ordernummer och en kort beskrivning. Skicka aldrig lösenord eller fullständiga kortuppgifter via e-post.</p>
        <h2>Spårning</h2>
        <p>Använd länken till orderstatus i orderbekräftelsen. Spårning från fraktbolaget visas när leverantören eller fraktbolaget skickar den. Du kan också använda <a href="#spara-order">Spåra min beställning</a>.</p>
        <h2>Tull och avgifter</h2>
        <p>Målet är att allt skickas från lager inom EU, och då tillkommer ingen tull eller importavgift. Priset du ser är inklusive moms.</p>
        <h2>Vårt ansvar</h2>
        <p>RumIQ är din kontakt för leverans, ånger och reklamation, även när en leverantör skickar varan. Leverantörens villkor kan aldrig begränsa dina rättigheter som konsument.</p>
        <h2>Att bekräfta före försäljning</h2>
        <ul class="checklist"><li>Leverantörernas leveransregler och lagerplats</li><li>Länder vi säljer till</li><li>Fraktpriser och gränsen för fri frakt</li></ul>`,
    },
    returer: {
      title: "Returer & återbetalning", kicker: "Kundservice",
      lead: "Ångrat dig eller blivit något fel? Så här gör du.",
      html: () => `${draft}
        <h2>${F.openDays ? `${F.openDays} dagars öppet köp` : "Ångerrätt"}</h2>
        <p>${openBuy} Du behöver inte ange något skäl. Det enklaste sättet att ångra är <a href="#angra">Ångra avtalet här</a>, som finns i sidfoten och under varje beställning i ditt konto.</p>
        <h2>Så skickar du tillbaka</h2>
        <ol><li>Ångra köpet via knappen. Du får en bekräftelse direkt.</li><li>Packa varan väl, gärna i originalförpackningen.</li><li>Skicka varan inom 14 dagar från att du ångrade köpet. Returadressen står i bekräftelsen.</li></ol>
        <h2>Återbetalning</h2>
        <p>Vi betalar tillbaka utan onödigt dröjsmål och senast 14 dagar från ditt meddelande om att du ångrar köpet, inklusive den ursprungliga fraktkostnaden för standardleverans. Vi får vänta tills vi fått tillbaka varan eller bevis på att den skickats. Pengarna kommer tillbaka på samma sätt som du betalade, om vi inte kommer överens om något annat utan kostnad för dig.</p>
        <h2>Returfrakt</h2>
        <p>Returen skickas till en adress i Sverige, inte till leverantören utomlands. ${miss("Vem som betalar returfrakten")}</p>
        ${(() => { const v = (((window.RQ_CONFIG || {}).delivery || {}).returnVia || []); return v.length ? `<p>Du lämnar returen ${v.length > 1 ? v.slice(0, -1).join(", ") + " eller " + v[v.length - 1] : v[0]}. Du får en returetikett i bekräftelsen när du har ångrat köpet.</p>` : ""; })()}
        <h2>Varans skick</h2>
        <p>Du får undersöka varan på samma sätt som i en butik. Om varan har hanterats mer än så kan vi göra avdrag för värdeminskningen.</p>
        <h2>Fel på varan</h2>
        <p>Är något trasigt eller fel? Läs om <a href="#juridik-garanti">reklamation och garanti</a>.</p>`,
    },
    betalning: {
      title: "Betalning", kicker: "Kundservice",
      lead: "Betalning och slutlig totalsumma hanteras i Shopifys kassa.",
      html: () => `
        <h2>Betalsätt</h2>
        <p>De betalsätt som går att använda är de som visas i kassan. Vilka kort, fakturor och plånböcker som finns beror på butikens inställningar och var du handlar ifrån.</p>
        <h2>Priser och moms</h2>
        <p>Priserna anges i svenska kronor. Moms, andra skatter och fraktkostnad visas innan du betalar, och den slutliga summan ser du i kassan.</p>
        <h2>Säker betalning</h2>
        <p>Betalningen sker i Shopifys kassa, inte i ett kortformulär på den här sajten. Shopify och betalleverantören hanterar kortuppgifterna. Vi samlar aldrig in fullständiga kortnummer eller säkerhetskoder. Inget system kan garantera fullständig säkerhet, men kortdata hanteras enligt branschens regler.</p>
        <h2>Återbetalning</h2>
        <p>Vid ånger betalar vi tillbaka utan onödigt dröjsmål och senast 14 dagar från ditt meddelande. För varor får vi vänta tills vi har fått tillbaka varan eller bevis på att den skickats. Återbetalningen görs med samma betalsätt, om vi inte kommer överens om något annat utan kostnad för dig.</p>`,
    },
    kontakt: {
      title: "Kontakt", kicker: "Kundservice",
      lead: "Vi läser varje meddelande och svarar så snart vi kan.",
      html: () => `<div class="contact">
        <form id="contactForm" class="form-grid" novalidate>
          <label>Namn<input name="name" autocomplete="name" required></label>
          <label>E-post<input name="email" type="email" autocomplete="email" required></label>
          <label>Ordernummer, om du har ett<input name="order" placeholder="Till exempel TEST-1001"></label>
          <label>Vad gäller det?<select name="topic"><option>En beställning</option><option>En produkt</option><option>Retur eller reklamation</option><option>Mitt rum och verktygen</option><option>Något annat</option></select></label>
          <label class="full">Meddelande<textarea name="msg" rows="6" required></textarea></label>
          <p class="note full">Skicka aldrig lösenord eller fullständiga kortuppgifter.</p>
          <button class="btn" type="submit">Skicka meddelandet</button>
          <p class="status full" role="status" id="contactStatus"></p>
        </form>
        <aside class="contact-side">
          <h3>Snabbast hjälp</h3>
          <p><a href="#faq">Vanliga frågor</a><br><a href="#spara-order">Spåra min beställning</a><br><a href="#angra">Ångra avtalet här</a><br><a href="#returer">Returer & återbetalning</a></p>
          <h3>E-post</h3><p>${mail}</p>
          <h3>Företaget</h3><p class="small">${seller()}</p>
        </aside></div>`,
    },
    faq: {
      title: "Vanliga frågor", kicker: "Kundservice",
      lead: "Svar på det folk oftast undrar. Hittar du inte ditt svar, skriv till oss.",
      groups: [
        ["Beställningar", [
          ["Hur fungerar RumIQ?", "Du hittar produkter i butiken eller med hjälp av Svep och Hitta rätt, ser dem i ditt rum om du vill och betalar i en säker kassa. Läs mer under <a href='#sa-fungerar-det'>Så fungerar RumIQ</a>."],
          ["Hur gör jag en beställning?", "Lägg produkterna i varukorgen, öppna varukorgen och gå till kassan. Där väljer du leveranssätt och ser totalsumman innan du betalar."],
          ["Kan jag ändra min beställning?", "Hör av dig så snart som möjligt med ditt ordernummer. Har beställningen inte skickats ändrar vi den om det går."],
          ["Kan jag avbryta min beställning?", "Ja. Skriv till oss innan den har skickats. Har den redan skickats kan du använda din ångerrätt i stället."],
        ]],
        ["Leverans", [
          ["Hur lång tid tar leveransen?", `${goal} De datum paketet beräknas komma visas på varje produktsida och i kassan innan du betalar.`],
          ["Vad kostar frakten?", `${shipCost} Du ser fraktkostnaden i kassan innan du betalar.`],
          ["Hur spårar jag mitt paket?", "Använd länken i orderbekräftelsen eller <a href='#spara-order'>Spåra min beställning</a>."],
          ["Vad gör jag om leveransen är försenad?", "Hör av dig med ditt ordernummer. Om ingen leveranstid avtalades ska varan normalt komma inom 30 dagar, och du har rättigheter enligt lag om den dröjer."],
        ]],
        ["Betalning", [
          ["Vilka betalningsmetoder accepterar ni?", "De som visas i kassan. Vilka det är beror på butikens inställningar och var du handlar ifrån."],
          ["Är min betalning säker?", "Betalningen sker i Shopifys kassa. Vi ser eller sparar aldrig dina fullständiga kortuppgifter."],
          ["Var hittar jag mitt kvitto?", "Kvittot kommer i orderbekräftelsen via e-post. Är du inloggad ser du dina beställningar under Mitt konto."],
        ]],
        ["Returer", [
          ["Hur ångrar jag ett köp?", "Använd <a href='#angra'>Ångra avtalet här</a>. Du behöver inte logga in och inte ange något skäl."],
          ["Hur returnerar jag en produkt?", "Ångra köpet först. Packa sedan varan väl och skicka den till returadressen i bekräftelsen inom 14 dagar."],
          ["Hur lång är ångerfristen?", openBuy],
          ["Hur fungerar återbetalningar?", "Vi betalar tillbaka senast 14 dagar från att du ångrade köpet, med samma betalsätt. Vi får vänta tills varan har kommit tillbaka eller du visat att den skickats."],
        ]],
        ["Produkter", [
          ["Omfattas produkterna av garanti?", "Du har alltid rätt att reklamera fel i tre år enligt konsumentköplagen. Om en tillverkare ger en garanti utöver det står det på produktsidan."],
          ["Hur väljer jag rätt produkt?", "Läs produktsidan, prova produkten i Mitt rum eller fråga stylisten."],
          ["Vad gör jag om produkten är felaktig?", "Skriv till oss med ordernummer och gärna en bild, så löser vi det. Läs mer om <a href='#juridik-garanti'>reklamation</a>."],
          ["Varför kan jag inte köpa vissa produkter?", "RumIQ är i en tidig fas. Produkter märkta Exempel visar hur butiken kommer att se ut men går inte att köpa än."],
        ]],
        ["Mitt rum och verktygen", [
          ["Vad kostar verktygen?", "Ingenting. Mitt rum, Svep, Hitta rätt och stylisten är gratis. Studio Plus är ett tillval för dig som vill ha fler AI-bilder."],
          ["Hur många rumsbilder kan jag skapa?", "Hur många du vill när du själv ställer in produkterna i ditt foto. Det sker direkt i webbläsaren. AI-bilder är något annat: med ett konto får du 5 i månaden utan kostnad, och fler med Studio Plus."],
          ["Räknas det om en bild misslyckas?", "Nej. Försök som inte ger något resultat räknas aldrig."],
          ["Är AI-bilderna exakta?", "Nej. Bilderna är illustrationer och storlek, färg och detaljer kan skilja sig från den riktiga produkten. Kontrollera produktsidan innan du köper."],
          ["Vad händer med mitt foto?", "Fotot stannar i din webbläsare så länge du själv ställer in produkterna. Väljer du att skapa en AI-bild skickas fotot till en server för att bilden ska kunna skapas, först efter att du har godkänt det, och rumsfotot raderas där efter 30 dagar."],
          ["Är bilderna på sajten riktiga foton?", "Nej. Bilderna på produkter och rum är skapade med AI medan vi väntar på de första produkterna. När produkterna finns byter vi till riktiga foton."],
        ]],
      ],
      html() {
        return this.groups.map(([g, qs], i) => `<section class="faq-group" id="faq-${i}"><h2>${g}</h2>${qs.map(([q, a]) => `<details><summary>${q}<span class="pm" aria-hidden="true"></span></summary><div class="ans"><p>${a}</p></div></details>`).join("")}</section>`).join("") +
          `<div class="faq-more"><h3>Behöver du mer hjälp?</h3><a class="btn ghost" href="#kontakt">Kontakta oss</a></div>`;
      },
    },
    om: {
      title: "Om RumIQ", kicker: "Vår berättelse",
      lead: "Ett bättre hem kräver inte fler saker. Det kräver rätt saker.",
      html: () => `
        <p class="big">RumIQ är en skandinavisk webbutik för hemmet. Ett noga utvalt sortiment, inspiration för varje rum och verktyg som låter dig se produkterna hemma hos dig innan du köper.</p>
        <h2>Vad RumIQ är</h2>
        <p>Vi säljer belysning, textil, förvaring, saker för kök och badrum och smarta saker för vardagen. Kvaliteten ska kännas premium, priset ska kännas rimligt. Till det kommer ett magasin med idéer och verktyg som hjälper dig att välja: Mitt rum, Svep och Hitta rätt.</p>
        <h2>Det här vill vi göra</h2>
        <h3>Välja rätt, inte mer</h3>
        <p>Vi vill hjälpa dig att välja färre och bättre saker. Varje produkt ska fylla en funktion i ett verkligt hem, hålla länge och fungera ihop med resten.</p>
        <h3>Mindre gissande före köpet</h3>
        <p>I Mitt rum ser du produkterna i ditt eget rum innan du köper. Målet är färre felköp, för en retur är det sämsta för både plånboken och miljön.</p>
        <h3>Ärligt hela vägen</h3>
        <p>AI-bilder märks som inspiration. Pris och frakt visas innan du betalar. Vi hittar inte på recensioner, lagersaldon eller leveranslöften.</p>
        <h2>Så vill vi förbättra hela upplevelsen</h2>
        <p>Från att du upptäcker något, till att du ser det i ditt rum, sparar det och beställer i några få steg. Utan att du behöver gissa.</p>
        <h2>Där vi är i dag</h2>
        <p>RumIQ är i en tidig fas. Sortimentet växer och vissa produkter är tydligt märkta exempel som inte går att köpa än. Vi har inget eget lager. Tanken är att leverantörerna skickar direkt till dig från lager inom EU, och leverantörerna bekräftas innan butiken öppnar.</p>
        <h2>Frågor eller idéer?</h2>
        <p>Skriv till ${mail} eller <a href="#onska">önska något</a>. Vi läser allt.</p>`,
    },
  };

  /* ---------------------------------------------------------------- Legal */
  RQ.LEGAL = {
    villkor: { title: "Köpvillkor", lead: "Villkoren som gäller när du handlar hos RumIQ.", html: () => `${draft}
      <h2>1. Säljare</h2><p>${seller()}. E-post ${mail}.</p>
      <h2>2. Priser</h2><p>Priserna anges i svenska kronor inklusive moms. Fraktkostnad och eventuella avgifter visas i kassan innan du betalar.</p>
      <h2>3. Beställning och avtal</h2><p>Avtalet ingås när du får en orderbekräftelse via e-post. Vid uppenbart felaktiga priser eller om en vara inte kan levereras har vi rätt att häva köpet, och betalar då tillbaka hela beloppet.</p>
      <h2>4. Betalning</h2><p>Betalningen hanteras i Shopifys kassa. Se <a href="#betalning">Betalning</a>.</p>
      <h2>5. Leverans</h2><p>Se <a href="#frakt">Frakt & leverans</a>. Blir en leverans väsentligt försenad har du rätt att häva köpet.</p>
      <h2>6. Ångerrätt</h2><p>Du har 14 dagars ångerrätt enligt lagen om distansavtal.${F.openDays ? ` Hos oss har du dessutom ${F.openDays} dagars öppet köp från att du tog emot varan.` : ""} Se <a href="#juridik-angerratt">Ångerrätt</a> och <a href="#angra">Ångra avtalet här</a>.</p>
      <h2>7. Reklamation</h2><p>Du har rätt att reklamera fel i tre år enligt konsumentköplagen. Se <a href="#juridik-garanti">Reklamation & garanti</a>.</p>
      <h2>8. Personuppgifter</h2><p>Se <a href="#juridik-integritet">Integritetspolicy</a>.</p>
      <h2>9. Tvister</h2><p>Vi följer Allmänna reklamationsnämndens (ARN) rekommendationer. Du kan också använda EU:s plattform för tvistlösning online.</p>` },
    integritet: { title: "Integritetspolicy", lead: "Vilka uppgifter vi behandlar, varför och hur länge.", html: () => `${draft}
      <h2>Personuppgiftsansvarig</h2><p>${seller()}. Frågor om personuppgifter: ${mail}.</p>
      <h2>Vad vi behandlar</h2><ul>
        <li><b>Beställningar:</b> namn, adress, e-post och telefon för att leverera och för bokföring. Sparas i sju år enligt bokföringslagen.</li>
        <li><b>Konto:</b> e-post, favoriter, sparade rum och stilprofil, så länge du har kvar kontot.</li>
        <li><b>Mitt rum:</b> foton av ditt rum stannar i din webbläsare. Först när du själv väljer att skapa en AI-bild, och har godkänt det, skickas fotot för att skapa bilden. Se avsnittet om AI-bilder nedan.</li>
        <li><b>Kundservice:</b> det du skriver till oss, så länge ärendet pågår och därefter högst två år.</li>
        <li><b>Väntelista och nyhetsbrev:</b> e-post, med ditt samtycke, tills du avregistrerar dig.</li></ul>
      <h2>Mottagare</h2><p>E-handelsplattform, betal- och fraktpartner samt leverantörer som skickar din beställning. ${miss("Fullständig lista över personuppgiftsbiträden")}</p>
      <h2>Dina rättigheter</h2><p>Du kan begära utdrag, rättelse och radering, invända mot behandling och få dina uppgifter flyttade. Skriv till ${mail}. Du kan också klaga hos Integritetsskyddsmyndigheten (IMY).</p>` },
    cookies: { title: "Cookiepolicy", lead: "Vi använder bara nödvändiga cookies om du inte väljer något annat.", html: () => `
      <h2>Nödvändiga</h2><p>Varukorg, inloggning, språk och dina cookieval. Krävs för att butiken ska fungera och kan inte stängas av.</p>
      <h2>Statistik</h2><p>Hjälper oss att förstå vilka sidor som används. Bara med ditt samtycke.</p>
      <h2>Marknadsföring</h2><p>Gör annonser mer relevanta. Bara med ditt samtycke.</p>
      <h2>Lagring i webbläsaren</h2><p>Varukorg, det du sparat och din stilprofil sparas i din webbläsares lokala lagring i den här versionen. Du kan rensa allt under Mitt konto.</p>
      <p><button class="btn ghost" type="button" data-action="cookies">Ändra mina cookieval</button></p>` },
    angerratt: { title: "Ångerrätt", lead: "Din rätt att ångra ett köp på nätet.", html: () => `${draft}
      <p>Enligt lagen om distansavtal har du rätt att ångra köpet inom 14 dagar från den dag du, eller någon du utsett, tog emot varan. Vid flera varor i samma beställning räknas fristen från dagen du fick den sista.</p>${F.openDays ? `
      <p>Hos oss har du dessutom ${F.openDays} dagars öppet köp från att du tog emot varan.</p>` : ""}
      <h2>Så ångrar du</h2><p>Använd <a href="#angra">Ångra avtalet här</a> eller skicka ett tydligt meddelande till ${mail}. Du kan också använda Konsumentverkets standardformulär för ånger.</p>
      <h2>Undantag</h2><p>Ångerrätten gäller inte bland annat varor som tillverkats efter dina specifikationer, förseglade hygienvaror som brutits efter leverans och varor som snabbt kan försämras.</p>
      <h2>Återbetalning</h2><p>Se <a href="#returer">Returer & återbetalning</a>.</p>` },
    garanti: { title: "Reklamation & garanti", lead: "Om något är fel på varan.", html: () => `${draft}
      <h2>Reklamationsrätt</h2><p>Du har rätt att reklamera ursprungliga fel i tre år från att du tog emot varan, enligt konsumentköplagen. Fel som visar sig inom två år antas ha funnits från början, om inte vi kan visa något annat.</p>
      <h2>Så reklamerar du</h2><p>Skriv till ${mail} inom skälig tid efter att du upptäckt felet. Två månader räknas alltid som skälig tid. Ange ordernummer, vad som är fel och bifoga gärna en bild.</p>
      <h2>Vad som händer sedan</h2><p>Vi rättar felet, byter varan, sänker priset eller betalar tillbaka, beroende på felet och vad du vill. Vi står för kostnaden för att skicka tillbaka en felaktig vara.</p>
      <h2>Garanti</h2><p>En garanti från tillverkaren är ett tillägg och begränsar aldrig din reklamationsrätt. Om en produkt har garanti står det på produktsidan.</p>` },
    produktsakerhet: { title: "Produktsäkerhet", lead: "Hur vi arbetar för att produkterna ska vara säkra.", html: () => `${draft}
      <p>Produkterna vi säljer ska uppfylla EU:s krav på produktsäkerhet, inklusive förordningen om allmän produktsäkerhet (GPSR).</p>
      <h2>Märkning och information</h2><p>Varje produkt ska ha tillverkare eller ansvarig person inom EU angiven, tillsammans med de säkerhets- och bruksanvisningar som behövs. Uppgifterna visas på produktsidan när produkten är verifierad.</p>
      <h2>Elektriska produkter</h2><p>Lampor och laddare ska vara CE-märkta och följa reglerna för elsäkerhet. Använd dem enligt bruksanvisningen.</p>
      <h2>Återkallelser</h2><p>Om en produkt återkallas meddelar vi alla som köpt den och visar informationen här.</p>
      <h2>Rapportera ett problem</h2><p>Har en produkt skadat någon eller kan vara farlig? Sluta använda den och skriv till ${mail} direkt.</p>` },
    sakerhet: { title: "Säkerhet", lead: "Hur vi skyddar din information.", html: () => `
      <h2>Betalningar</h2><p>Betalningar sker i Shopifys kassa. Vi ser eller sparar aldrig fullständiga kortnummer eller säkerhetskoder.</p>
      <h2>Ditt konto</h2><p>Använd ett unikt lösenord. Vi frågar aldrig efter ditt lösenord via e-post eller telefon.</p>
      <h2>Bedrägerier</h2><p>Får du ett meddelande som påstår sig komma från RumIQ och ber om kortuppgifter eller lösenord, svara inte. Skicka det gärna vidare till ${mail}.</p>
      <h2>Rapportera en säkerhetsbrist</h2><p>Har du hittat en säkerhetsbrist på sajten? Skriv till ${mail} med en beskrivning. Vi tackar alla som rapporterar i god tro.</p>` },
    foretag: { title: "Företagsinformation", lead: "Vem som säljer och hur du når oss.", html: () => `
      <h2>Varumärke och kundservice</h2><p>Varumärke: RumIQ. Kundservice och integritetsfrågor: ${mail}.</p>
      <h2>Säljare</h2><p>${seller()}</p>
      <p>Momsregistreringsnummer: ${C.vat || miss("momsnummer")}</p>
      <p>Returadress: ${C.returnAddress || miss("verifierad returadress")}</p>
      <p class="note">Supportadressen ersätter inte de obligatoriska uppgifterna om säljaren. De kompletteras innan försäljningen börjar.</p>` },
  };

  /* ---------------------------------------------------------------- Magazine */
  RQ.ARTICLES = [
    { slug: "vardagsdukning", img: "assets/img/mag/vardagsdukning-1200.webp", minutes: 3, rooms: ["kok"],
      title: "En välkomnande dukning, även en vanlig tisdag",
      lead: "Ge plats åt vardagens måltider med en dukning som är lätt att använda och lika lätt att plocka undan.",
      body: `<p>Det dukade bordet förknippas med helger och gäster. Men det är vardagens måltider som blir flest, och de förtjänar också lite omsorg. Tricket är att välja saker som gör det enklare, inte mer arbete.</p>
        <h2>Börja med det som redan står framme</h2><p>En skärbräda i trä kan vara både arbetsyta och serveringsfat. Lägg brödet direkt på den, ställ smöret bredvid och bär in allt på en gång. En sak mindre att diska, och bordet ser genast mer genomtänkt ut.</p>
        <h2>En sak på höjden</h2><p>Ett bord blir levande när något bryter den platta ytan. En vas med några kvistar eller en liten lampa räcker. Håll det lågt nog att man ser varandra.</p>
        <h2>Textil som tål vardag</h2><p>Linne och bomull blir finare ju mer de används. Välj handdukar och servetter som går att tvätta varmt och som inte behöver strykas.</p>
        <h2>Lätt att plocka undan</h2><p>Det bästa vardagsbordet är dukat på en minut och avdukat på två. Ha en korg eller bricka för det som ska tillbaka till köket, så blir det en vana och inte ett projekt.</p>`,
      picks: ["skarbrada-ek-med-handtag", "sand-keramikvas", "svamp-uppladdningsbar-lampa"] },
    { slug: "farger-att-trivas-med", img: "assets/img/mag/farger-1200.webp", minutes: 4, rooms: ["vardagsrum", "sovrum"],
      title: "Skapa en färgpalett att trivas med",
      lead: "Kombinera välbekanta färger, lite kontrast och det ljus du faktiskt har.",
      body: `<p>En färgpalett för hemmet behöver inte börja med ett färgkort. Den kan börja med det du redan tycker om: tröjan du alltid tar på dig, tallriken du alltid väljer, ljuset en eftermiddag i september.</p>
        <h2>En bas, en värme, en kontrast</h2><p>Tänk i tre lager. En lugn bas för väggar och stora ytor, ofta ljus kalk eller havre. En värme från trä, terrakotta eller ull. Och en kontrast, något mörkare som får resten att vila: grafit, en djup grön eller svart metall.</p>
        <h2>Ljuset bestämmer</h2><p>Samma vita vägg ser blå ut i norrljus och gul i kvällslampans sken. Titta på färgprover vid olika tider på dygnet innan du bestämmer dig. Varmt ljus från lampor med opal- eller textilskärm gör det mesta mjukare.</p>
        <h2>Upprepa, men inte exakt</h2><p>En färg som återkommer i två eller tre rum binder ihop hemmet. Låt den komma tillbaka i olika material: en kudde i ett rum, en kruka i ett annat.</p>
        <p>Vill du veta vilka färger ditt rum redan har? <a href="#mitt-rum">Mitt rum</a> plockar ut paletten ur ditt foto och visar vad som passar.</p>`,
      picks: ["plad-ullblandning-havre", "terrakottakruka-rafflad", "lysa-keramiklampa"] },
    { slug: "texturer-och-material", img: "assets/img/mag/texturer-1200.webp", minutes: 3, rooms: ["vardagsrum", "badrum"],
      title: "Texturer och material: ge ett enkelt rum personlighet",
      lead: "Släta, vävda och mjuka ytor gör ett rum varmare utan att du behöver byta ut allt du har.",
      body: `<p>Ett rum där allt är slätt och blankt känns ofta kallt, även om färgerna är varma. Det är texturerna som gör skillnaden, och de är lätta att lägga till.</p>
        <h2>Tre ytor per rum</h2><p>Försök ha minst tre olika ytor i varje rum: något slätt, som glas eller lackat trä, något vävt, som en korg eller ett linnetyg, och något mjukt, som ull eller filt.</p>
        <h2>Låt materialen åldras</h2><p>Ek, keramik och linne blir vackrare med åren. De tål märken och får patina i stället för att se slitna ut. En bra tumregel för saker du använder varje dag.</p>
        <h2>Börja i det lilla</h2><p>En flätad korg för filtarna, burkar med lock i trä, ett kuddfodral i linne. Små saker, men tillsammans ändrar de hur rummet känns.</p>`,
      picks: ["flatad-forvaringskorg", "forradsburkar-glas-ek-3-pack", "lin-kuddfodral"] },
    { slug: "fran-garderob-till-hem", img: "assets/img/mag/garderob-1200.webp", minutes: 3, rooms: ["sovrum"],
      title: "Från garderob till hem: hitta din personliga stil",
      lead: "Färgerna, texturerna och kontrasterna du gillar att bära kan bli utgångspunkten för ett hem som känns som du.",
      body: `<p>De flesta har en tydligare stil i garderoben än i vardagsrummet. Det är inte konstigt: kläder väljer vi varje dag, möbler några gånger i livet. Men smaken är densamma, och den går att låna.</p>
        <h2>Öppna garderoben</h2><p>Vilka färger dominerar? Vilka material tar du helst på dig: stickat, linne, denim? Är du mer för det rena och enkla eller det mjuka och lagrade? Svaren är en bra start för hemmet också.</p>
        <h2>Översätt materialen</h2><p>Älskar du ullkoftor blir en pläd i ullblandning ett naturligt val. Gillar du linneskjortor passar kuddfodral i linne. Den som bär mycket grafit trivs ofta med mörka detaljer, som en tvålpump i mörkt stengods eller en grafisk affisch.</p>
        <h2>Gör testet</h2><p>Vill du ha hjälp att sätta ord på stilen? <a href="#svep">Svep fram din stil</a> tar en minut och ger förslag ur sortimentet.</p>`,
      picks: ["plad-ullblandning-havre", "vila-paslakanset-linne", "glob-bordslampa-opalglas"] },
    { slug: "harmoniskt-hem", img: "assets/img/mag/harmoniskt-1200.webp", minutes: 5, rooms: ["vardagsrum", "hall", "sovrum"],
      title: "7 sätt att skapa ett mer harmoniskt hem",
      lead: "Ett lugnare hem börjar med hur du använder det, inte med hur mycket du köper.",
      body: `<ol class="numbered">
        <li><h3>Ge varje sak en adress</h3><p>Det som saknar en fast plats blir liggande. Bestäm var nycklarna, laddaren och fjärrkontrollen bor.</p></li>
        <li><h3>Lägre ljus på kvällen</h3><p>Släck taklampan och tänd två eller tre lampor på lägre höjd. Rummet blir lugnare direkt.</p></li>
        <li><h3>Dölj det som surrar</h3><p>Sladdar och laddare syns mer än man tror. En låda med lock gör stor skillnad för liten insats.</p></li>
        <li><h3>Låt ytorna andas</h3><p>En tom bänk eller hylla är inte oanvänd. Den ger blicken vila.</p></li>
        <li><h3>Samla småsaker i korgar</h3><p>Tio saker i en korg ser ut som en sak. Tio saker utspridda ser ut som tio.</p></li>
        <li><h3>Upprepa material</h3><p>Samma trä, samma metall eller samma textil i flera rum gör att hemmet hänger ihop.</p></li>
        <li><h3>Byt hellre än lägg till</h3><p>När något nytt kommer in, fundera på vad som kan få gå. Det håller hemmet lätt.</p></li></ol>`,
      picks: ["forvaringslada-filt", "flatad-forvaringskorg", "glod-doftljus-keramik"] },
    { slug: "skandinavisk-inspiration", img: "assets/img/mag/skandinavisk-1200.webp", minutes: 4, rooms: ["vardagsrum", "kok"],
      title: "Skandinavisk inredningsinspiration",
      lead: "Naturligt ljus, genomtänkta proportioner och enkla vardagsrutiner.",
      body: `<p>Skandinavisk inredning handlar mindre om en stil och mer om ett sätt att leva med mörka vintrar och ljusa somrar. Ljuset är det dyrbaraste vi har, och allt annat anpassar sig efter det.</p>
        <h2>Ta vara på dagsljuset</h2><p>Tunna linnegardiner släpper in ljuset men tar bort skärpan. Speglar mitt emot fönster gör rummet ljusare.</p>
        <h2>Ljust trä och mjuka material</h2><p>Ek, björk, lin och ull. Material som är fina att ta i och som åldras med värdighet.</p>
        <h2>Lagom mycket</h2><p>Färre saker, men saker med en tydlig funktion och plats. Det är inte asketiskt, det är lugnt.</p>
        <h2>Ljus i lager när mörkret kommer</h2><p>Flera små ljuskällor på olika höjd i stället för en stark lampa i taket. Det är så skandinaviska hem håller värmen under de mörka månaderna.</p>`,
      picks: ["lysa-keramiklampa", "dagsljus-linnegardin-2-pack", "lin-kuddfodral"] },
    { slug: "varmt-vardagsrum", img: "assets/img/mag/vardagsrum-1200.webp", minutes: 3, rooms: ["vardagsrum"],
      title: "Så skapar du ett varmt och välkomnande vardagsrum",
      lead: "Små ändringar i ljus och möblering kan ändra hur ett rum känns.",
      body: `<p>Ett vardagsrum blir varmt av tre saker: ljuset, textilierna och hur möblerna står. Inget av det kräver en renovering.</p>
        <h2>Flytta in möblerna från väggarna</h2><p>När soffan och fåtöljen står närmare varandra blir rummet en plats att umgås på, inte en korridor.</p>
        <h2>Tre ljuspunkter</h2><p>En lampa vid soffan, en på en skänk och en lägre i ett hörn. Varmt, dämpat ljus i ögonhöjd och nedåt.</p>
        <h2>Textil i lager</h2><p>En pläd över armstödet, två kuddar i olika material och kanske en korg med fler filtar. Det är de mjuka sakerna som gör att man stannar kvar.</p>`,
      picks: ["plad-ullblandning-havre", "lysa-keramiklampa", "lin-kuddfodral"] },
    { slug: "belysning-i-lager", img: "assets/img/rum/sovrum-efter-1344.webp", minutes: 4, rooms: ["vardagsrum", "sovrum"],
      title: "Belysning i lager: så blir hemmet mysigt på kvällen",
      lead: "En taklampa räcker inte. Med tre ljuskällor på olika höjd blir samma rum lugnt, varmt och lätt att vara i.",
      body: `<p>Det vanligaste felet i ett mörkt svenskt vinterhem är för få lampor. En stark taklampa lyser upp allt lika mycket, och då känns rummet platt. Lösningen är att tänka i lager.</p>
        <h2>Lager 1: grundljuset</h2><p>Taklampan eller en golvlampa som ger ljus i hela rummet. Den behövs när du städar eller letar efter något, men den kan gärna vara släckt resten av kvällen.</p>
        <h2>Lager 2: ljus där du gör något</h2><p>En lampa vid läsfåtöljen, på nattduksbordet eller över skrivbordet. Ljuset ska falla på det du tittar på, inte i ögonen. En skärm i textil eller veckat tyg sprider ljuset mjukt.</p>
        <h2>Lager 3: stämningsljuset</h2><p>Små, låga ljuskällor som gör rummet levande: en lampa på en hylla, en uppladdningsbar lampa på fönsterbänken eller levande ljus på bordet. De lyser inte upp mycket, men de gör att man vill stanna.</p>
        <h2>Välj varmt ljus</h2><p>Titta efter 2 700 kelvin eller lägre på lampans förpackning. Det ger det gula, varma ljuset som liknar en solnedgång. Kallare ljus passar i badrummet och vid arbetsbänken, inte i soffan.</p>
        <h2>Prova innan du köper</h2><p>Det är svårt att föreställa sig en lampa i sitt eget rum. Ta en bild av rummet i Mitt rum och ställ in lampan där, så ser du storlek och stil innan du bestämmer dig.</p>`,
      picks: ["lysa-keramiklampa", "svamp-uppladdningsbar-lampa", "glob-bordslampa-opalglas", "stilla-ljusstake-massing-2-pack"] },
    { slug: "litet-sovrum", img: "assets/img/rum/sovrum-1600.webp", minutes: 4, rooms: ["sovrum"],
      title: "Inred ett litet sovrum: sex sätt att få det att kännas större",
      lead: "Ljusa textilier, smart förvaring och rätt ljus gör mer än kvadratmetrarna.",
      body: `<p>Ett litet sovrum behöver inte kännas trångt. Det handlar mindre om ytan och mer om hur mycket som syns på en gång.</p>
        <h2>1. Ljusa textilier i samma ton</h2><p>Påslakan, gardiner och pläd i närliggande ljusa färger flyter ihop och gör att rummet upplevs större. Lin och bomull i havre, sand och vitt är lätta att kombinera.</p>
        <h2>2. Gardiner från tak till golv</h2><p>Häng gardinstången högt och nära taket och låt gardinerna nå golvet. Fönstret ser större ut och takhöjden känns högre.</p>
        <h2>3. Förvaring som syns, men lugnt</h2><p>Korgar med lock eller i flätat material under sängen och nattduksbordet samlar det lösa. Ett fåtal korgar i samma material ser ordnat ut, många olika ser stökiga ut.</p>
        <h2>4. Ljus från sidan, inte bara uppifrån</h2><p>En lampa på nattduksbordet ger ett varmt ljus i ögonhöjd och gör rummet mjukare på kvällen. Det tar mindre plats än en golvlampa.</p>
        <h2>5. En sak på väggen</h2><p>En affisch eller en tavla ovanför sängen ger rummet en mittpunkt. Fler små saker splittrar och krymper väggen.</p>
        <h2>6. Fri golvyta</h2><p>Ju mer golv som syns, desto större känns rummet. Välj ett nattduksbord eller en hylla på väggen i stället för en byrå om det går.</p>`,
      picks: ["vila-paslakanset-linne", "dagsljus-linnegardin-2-pack", "flatad-forvaringskorg", "lysa-keramiklampa"] },
    { slug: "hyresvanlig-inredning", img: "assets/img/rum/hall-1600.webp", minutes: 3, rooms: ["hall", "vardagsrum"],
      title: "Hyresvänlig inredning: gör om utan att borra",
      lead: "Bor du i hyresrätt eller i andra hand? Så gör du hemmet personligt utan hål i väggarna.",
      body: `<p>Många vill inte, eller får inte, borra i väggarna. Det mesta som gör ett hem personligt går ändå att lösa utan verktyg, och allt följer med när du flyttar.</p>
        <h2>Ställ tavlorna i stället för att hänga dem</h2><p>Luta en affisch med ram mot väggen på en hylla, en byrå eller direkt på golvet. Flera ramar i olika storlek som lutar mot varandra ser genomtänkt ut, och du kan byta när du vill.</p>
        <h2>Ljus utan sladdar</h2><p>En uppladdningsbar lampa kan stå där det saknas uttag: på hyllan i hallen, på balkongbordet eller i bokhyllan. Ladda den på dagen och låt den lysa på kvällen.</p>
        <h2>En matta som ramar in</h2><p>En matta under soffbordet eller i hallen gör att ytan känns som en egen plats. Jute och ull tål vardag och syns på ett bra sätt.</p>
        <h2>Textil gör mest</h2><p>Gardiner, kuddar och en pläd ändrar ett rum mer än man tror, och det är det första du packar när du flyttar.</p>`,
      picks: ["affisch-linje-ekram", "svamp-uppladdningsbar-lampa", "strand-jutematta", "lin-kuddfodral"] },
  ];

  RQ.articleBySlug = (s) => RQ.ARTICLES.find((a) => a.slug === s) || null;
})();
