/* RumIQ catalogue and site structure.
   The 17 products are the example products in RumIQ's store (names, prices and variants as on
   rumiq.lovable.app, Nov 2026). They are examples and cannot be bought yet.
   Facts we do not have yet (exact size, weight, supplier, country of dispatch) are marked as
   "pending" so the page says so instead of guessing. */
(function () {
  const RQ = (window.RQ = window.RQ || {});

  RQ.CATEGORIES = [
    { id: "hem-inredning", name: "Hem & inredning", en: "Home & living", lead: "Speglar, vaser och detaljer som gör rummet färdigt." },
    { id: "kok-matplats", name: "Kök & matplats", en: "Kitchen & dining", lead: "Saker du använder varje dag, gjorda för att stå framme." },
    { id: "badrum-valmaende", name: "Badrum & välmående", en: "Bath & wellbeing", lead: "Mjuka handdukar och lugna material för morgon och kväll." },
    { id: "forvaring-organisering", name: "Förvaring & organisering", en: "Storage & organising", lead: "En plats för allt som annars blir liggande." },
    { id: "belysning-atmosfar", name: "Belysning & atmosfär", en: "Lighting & atmosphere", lead: "Mjukt ljus i flera nivåer, för dag, kväll och allt däremellan." },
    { id: "smarta-hem-teknik", name: "Smarta hem & teknik", en: "Smart home & tech", lead: "Teknik som syns mindre och fungerar bättre." },
    { id: "sovrum-komfort", name: "Sovrum & komfort", en: "Bedroom & comfort", lead: "Textil och ljus som hjälper dig att varva ner." },
    { id: "uteliv", name: "Uteliv", en: "Outdoor living", lead: "För balkongen, trappan och de ljusa kvällarna." },
  ];

  RQ.ROOMS = [
    { id: "vardagsrum", name: "Vardagsrum", en: "Living room", lead: "Stillsamma former, varmt ljus och plats att umgås.",
      tips: ["Arbeta med tre ljuskällor på olika höjd: tak, bord och golv.", "Låt en mjuk textil, en pläd eller ett par kuddar, binda ihop soffan med resten av rummet.", "Ge blicken en vilopunkt: en spegel eller en tom vägg gör mer än en full hylla."],
      cats: ["belysning-atmosfar", "hem-inredning", "sovrum-komfort"] },
    { id: "sovrum", name: "Sovrum", en: "Bedroom", lead: "Mjuka material, dämpat ljus och ingenting som stör.",
      tips: ["Välj ett varmt, lågt ljus vid sängen och släck taklampan på kvällen.", "Förvaring med lock gör att rummet ser lugnt ut även när det inte är städat.", "Lin och ull andas och blir bara finare med tiden."],
      cats: ["sovrum-komfort", "belysning-atmosfar", "forvaring-organisering"] },
    { id: "kok", name: "Kök", en: "Kitchen", lead: "Det du använder varje dag, nära till hands och fint att ha framme.",
      tips: ["Ställ fram det du använder dagligen och ställ undan resten.", "Samma material på lock och brädor, till exempel ek, gör bänken lugnare.", "Genomskinliga burkar visar när något håller på att ta slut."],
      cats: ["kok-matplats", "forvaring-organisering", "badrum-valmaende"] },
    { id: "badrum", name: "Badrum", en: "Bathroom", lead: "Lugna ytor och mjuka handdukar för morgon och kväll.",
      tips: ["Häll över tvål och schampo i likadana behållare så ser hyllan genast lugnare ut.", "Rulla handdukarna i en korg om du saknar hyllplats.", "Två handdukstoner räcker, till exempel vit och sand."],
      cats: ["badrum-valmaende", "forvaring-organisering"] },
    { id: "hall", name: "Hall", en: "Hallway", lead: "Ett första intryck som gör det lätt att komma hem.",
      tips: ["En spegel i hallen gör ett litet utrymme större och ljusare.", "Ge varje familjemedlem en egen korg eller låda för vantar och mössor.", "En liten lampa som alltid är tänd gör hallen välkomnande även en mörk vinterkväll."],
      cats: ["hem-inredning", "forvaring-organisering", "belysning-atmosfar"] },
    { id: "hemmakontor", name: "Hemmakontor", en: "Home office", lead: "Färre sladdar, bättre ljus och plats att tänka.",
      tips: ["Dölj grenuttaget så försvinner hälften av röran.", "Ge telefonen en fast plats som inte är bredvid tangentbordet.", "En lampa med varmt ljus gör kvällsjobbet mindre ansträngande för ögonen."],
      cats: ["smarta-hem-teknik", "belysning-atmosfar", "forvaring-organisering"] },
    { id: "uteliv", name: "Uteliv", en: "Outdoor", lead: "Balkongen, trappan och de ljusa kvällarna.",
      tips: ["En sladdlös lampa kan följa med ut när solen går ner.", "Terrakotta andas och passar växter som inte vill stå för blött.", "Ta in textilierna när det regnar så håller de längre."],
      cats: ["uteliv", "belysning-atmosfar"] },
  ];

  const CARE = {
    ek: "Torka av med en lätt fuktad trasa och torka torrt. Olja in med träolja några gånger per år, oftare om den används i köket. Tål inte diskmaskin.",
    glas: "Torka av med en mjuk trasa. Glasdelar kan diskas för hand i ljummet vatten.",
    keramik: "Torka av med en lätt fuktad trasa. Undvik slipande medel.",
    lin: "Tvätta på 40 °C, gärna med liknande färger. Låt lufttorka och skaka ut före torkning så slipper du stryka.",
    ull: "Vädra hellre än tvätta. Vid behov: handtvätt eller ullprogram med ullmedel. Torka plant.",
    bomull: "Tvätta på 60 °C. Undvik sköljmedel så behåller våffelvävningen sin sugförmåga.",
    filt: "Borsta av damm och torka fläckar med en lätt fuktad trasa. Tål inte maskintvätt.",
    korg: "Dammsug eller borsta av. Håll borta från väta och stark värme.",
    stengods: "Diska för hand. Skölj ur pumpen med varmt vatten när du byter tvål.",
    plast: "Torka av med en torr eller lätt fuktad trasa. Koppla ur sladdar innan du rengör.",
    terrakotta: "Låt krukan torka mellan vattningarna. Ta in den över vintern om det finns risk för frost.",
  };
  RQ.CARE = CARE;

  // styles: skandinavisk, minimalistisk, klassisk, mjuk ; needs: forvaring, ljus, detaljer, rutiner
  // gift: van, familj, vard ; tone: hex colours used by Mix & match and the style tools
  RQ.PRODUCTS = [
    { handle: "glob-bordslampa-opalglas", name: "Glob bordslampa opalglas", en: "Globe table lamp, opal glass", price: 899, cat: "belysning-atmosfar",
      rooms: ["vardagsrum", "sovrum", "hall"], material: "Opalglas och trä", care: ["glas", "ek"], tone: ["#F1EDE6", "#C9A57A"], styles: ["skandinavisk", "minimalistisk", "klassisk"], needs: ["ljus"], gift: ["van", "familj"], occ: ["inflyttning", "fodelsedag", "jul"],
      short: "Bordslampa med klotformad skärm i opalglas på en fot i ljust trä. Sprider ett mjukt, jämnt ljus.",
      story: "Ett klot av opalglas gör det som en lampa ska göra en mörk kväll: sprider ljuset jämnt åt alla håll utan att blända. Foten i ljust trä gör att den passar lika bra på en skänk i vardagsrummet som på nattduksbordet.",
      use: ["Ställ den i ett hörn eller på en skänk för att fylla rummet med ett lågt, varmt ljus.", "Välj en varmvit ljuskälla, runt 2 700 K, för mjukast sken.", "Två likadana på var sin sida om soffan ger en lugn symmetri."],
      collections: ["skandinaviskt-hemmaliv"], featured: true, added: 1 },
    { handle: "lysa-keramiklampa", name: "Lysa keramiklampa", en: "Lysa ceramic lamp", price: 1290, cat: "belysning-atmosfar",
      rooms: ["vardagsrum", "sovrum"], material: "Keramik och textil", care: ["keramik"], tone: ["#D9C7AE", "#EFE6D6"], styles: ["skandinavisk", "klassisk", "mjuk"], needs: ["ljus", "detaljer"], gift: ["familj"], occ: ["inflyttning", "jul"],
      short: "Bordslampa med fot i keramik och skärm i textil för ett varmt, dämpat ljus.",
      story: "Keramikfoten har en mjuk, handgjord känsla och textilskärmen dämpar ljuset så att det blir varmt och nära. Det är lampan man tänder när taklampan känns för mycket.",
      use: ["Placera den där du läser eller sitter länge, ljuset faller nedåt och åt sidorna.", "Passar på en sidobord i samma höjd som soffans armstöd.", "Kombinera gärna med en pläd i varm ton."],
      collections: ["skandinaviskt-hemmaliv"], featured: true, added: 2 },
    { handle: "svamp-uppladdningsbar-lampa", name: "Svamp uppladdningsbar lampa", en: "Mushroom rechargeable lamp", price: 699, cat: "belysning-atmosfar",
      rooms: ["sovrum", "uteliv", "vardagsrum"], material: "Opal skärm, metall och trä", care: ["glas", "ek"], tone: ["#F4EFE7", "#3A3631"], styles: ["skandinavisk", "minimalistisk"], needs: ["ljus"], gift: ["van", "vard"], occ: ["fodelsedag", "tack", "inflyttning"],
      short: "Liten sladdlös lampa med svampformad skärm, att flytta dit ljuset behövs.",
      story: "Utan sladd kan ljuset följa med dig: från middagsbordet till balkongen och vidare till nattduksbordet. Den svampformade skärmen gör ljuset mjukt och lågt, perfekt när man vill ha stämning snarare än arbetsljus.",
      use: ["Ladda den på dagen och ta med den ut på kvällen.", "Fungerar fint som nattlampa eller på ett dukat bord.", "En bra present när man inte vet exakt hur någon bor."],
      collections: ["vardagens-favoriter"], featured: true, added: 3 },
    { handle: "skarbrada-ek-med-handtag", name: "Skärbräda ek med handtag", en: "Oak cutting board with handle", price: 449, cat: "kok-matplats",
      rooms: ["kok"], material: "Ek", care: ["ek"], tone: ["#B88A5A", "#E6D3B8"], styles: ["skandinavisk", "klassisk"], needs: ["rutiner", "detaljer"], gift: ["vard", "familj"], occ: ["inflyttning", "tack", "jul"],
      short: "Skär- och serveringsbräda i ek med handtag.",
      story: "En bräda som får stå framme. Den fungerar som arbetsyta när du lagar mat och som serveringsfat när du bär in brödet, osten eller frukten till bordet.",
      use: ["Använd ena sidan för att skära och den andra för att servera.", "Olja in den när ytan börjar se torr ut.", "Låt den luta mot väggen på bänken, den blir en del av köket."],
      collections: ["vardagens-favoriter"], added: 4 },
    { handle: "forradsburkar-glas-ek-3-pack", name: "Förrådsburkar glas & ek, 3-pack", en: "Glass & oak storage jars, 3-pack", price: 349, cat: "kok-matplats",
      rooms: ["kok", "badrum"], material: "Glas och ek", care: ["glas", "ek"], tone: ["#E9E4DA", "#B88A5A"], styles: ["skandinavisk", "minimalistisk"], needs: ["forvaring", "rutiner"], gift: ["vard", "van"], occ: ["inflyttning", "tack"],
      short: "Tre förvaringsburkar i glas med lock i ek, i tre höjder.",
      story: "Tre höjder, ett uttryck. Genom glaset ser du direkt när havregrynen eller kaffet håller på att ta slut, och locken i ek gör att burkarna kan stå framme utan att bänken ser rörig ut.",
      use: ["Fyll dem med det du använder varje dag: kaffe, gryn, pasta.", "I badrummet passar de för bomullspads och tops.", "Skriv en liten etikett på locket om du vill hålla ordning."],
      collections: ["det-organiserade-hemmet"], added: 5 },
    { handle: "plad-ullblandning-havre", name: "Pläd ullblandning havre", en: "Wool blend throw, oat", price: 799, cat: "sovrum-komfort",
      rooms: ["vardagsrum", "sovrum"], material: "Ullblandning", care: ["ull"], tone: ["#D8C6A8", "#EFE6D6"], styles: ["skandinavisk", "mjuk", "klassisk"], needs: ["detaljer"], gift: ["familj", "van"], occ: ["jul", "fodelsedag", "inflyttning"],
      short: "Mjuk pläd i ullblandning i varm havreton med fransar. Lika fin över sängens fotände som i soffan.",
      story: "Havretonen är varm utan att ta över och passar med det mesta. Ullblandningen värmer när det behövs och fransarna ger ett mjukt avslut. Den blir snabbt den man tar först.",
      use: ["Vik den över soffans armstöd så är den alltid nära.", "Lägg den över sängens fotände för ett färdigt intryck.", "Vädra den ute en torr dag i stället för att tvätta."],
      collections: ["skandinaviskt-hemmaliv"], featured: true, added: 6 },
    { handle: "lin-kuddfodral", name: "Lin kuddfodral", en: "Linen cushion cover", price: 249, cat: "hem-inredning",
      rooms: ["vardagsrum", "sovrum"], material: "Lin", care: ["lin"], variants: ["Havre", "Salvia"], tone: ["#D9CBB3", "#A9B39A"], styles: ["skandinavisk", "mjuk"], needs: ["detaljer"], gift: ["van"], occ: ["fodelsedag", "tack"],
      short: "Kuddfodral i lin.",
      story: "Lin har en levande yta som blir mjukare för varje tvätt. Havre är den lugna basen, salvia ger en stillsam färgklick. Två eller tre kuddar räcker för att ändra hur soffan känns.",
      use: ["Blanda havre och salvia för ett avslappnat uttryck.", "Skrynklorna hör till, lin ska inte strykas.", "Byt fodral med säsongen i stället för att köpa nya kuddar."],
      collections: ["skandinaviskt-hemmaliv"], added: 7 },
    { handle: "sand-keramikvas", name: "Sand keramikvas", en: "Sand ceramic vase", price: 399, cat: "hem-inredning",
      rooms: ["vardagsrum", "kok", "hall"], material: "Keramik", care: ["keramik"], tone: ["#D6C2A2", "#EDE3D2"], styles: ["skandinavisk", "minimalistisk", "klassisk"], needs: ["detaljer"], gift: ["vard", "van"], occ: ["tack", "inflyttning", "fodelsedag"],
      short: "Keramikvas i sandton med smal hals.",
      story: "Den smala halsen gör att en enda kvist räcker. Sandtonen passar mot både ljust trä och mörkare ytor, och vasen är fin även tom.",
      use: ["Sätt en kvist från skogen eller ett par torkade strån i den.", "Ställ den på ett bord eller en hylla där den får lite ljus.", "Kontrollera på produktsidan om den tål vatten innan du använder den till snittblommor."],
      collections: ["skandinaviskt-hemmaliv"], added: 8 },
    { handle: "rund-vaggspegel-ek", name: "Rund väggspegel ek", en: "Round oak wall mirror", price: 1190, cat: "hem-inredning",
      rooms: ["hall", "sovrum", "vardagsrum", "badrum"], material: "Spegelglas och ek", care: ["glas", "ek"], tone: ["#C9A57A", "#E8E4DC"], styles: ["skandinavisk", "klassisk", "minimalistisk"], needs: ["detaljer"], gift: ["familj"], occ: ["inflyttning"], wall: true,
      short: "Rund väggspegel med ram i ek.",
      story: "En rund spegel mjukar upp ett rum fullt av raka linjer. Ramen i ek ger värme, och spegeln fångar ljuset från fönstret och gör hallen eller sovrummet större.",
      use: ["Häng den mitt emot eller snett mot ett fönster för mer ljus.", "I hallen: häng den i ögonhöjd ovanför en byrå eller bänk.", "Kontrollera väggens material och använd rätt fästen."],
      collections: ["skandinaviskt-hemmaliv"], featured: true, added: 9 },
    { handle: "forvaringslada-filt", name: "Förvaringslåda filt", en: "Felt storage box", price: 199, cat: "forvaring-organisering",
      rooms: ["sovrum", "hall", "hemmakontor"], material: "Filt", care: ["filt"], tone: ["#9E9890", "#D9D3CA"], styles: ["minimalistisk", "skandinavisk"], needs: ["forvaring", "rutiner"], gift: [], occ: [],
      short: "Förvaringslåda i filt för textilier och småsaker.",
      story: "Mjuk men stadig. Lådan tar hand om det som annars blir liggande: vantar i hallen, sladdar på kontoret eller extra lakan i sovrummet.",
      use: ["En låda per person i hallen gör morgonen lugnare.", "Under sängen eller i garderoben för säsongens textilier.", "Ställ två bredvid varandra för ett lugnt, sammanhållet uttryck."],
      collections: ["det-organiserade-hemmet"], added: 10 },
    { handle: "flatad-forvaringskorg", name: "Flätad förvaringskorg", en: "Woven storage basket", price: 379, cat: "forvaring-organisering",
      rooms: ["vardagsrum", "badrum", "sovrum"], material: "Flätat naturmaterial", care: ["korg"], tone: ["#C2A57E", "#E3D3B8"], styles: ["skandinavisk", "mjuk", "klassisk"], needs: ["forvaring"], gift: ["familj"], occ: ["inflyttning"],
      short: "Flätad korg för filtar, tidningar eller handdukar.",
      story: "En korg är förvaring som får synas. Den flätade ytan ger textur åt rummet och fyller ett hörn som annars står tomt.",
      use: ["Rulla filtarna i den och ställ den bredvid soffan.", "I badrummet för rullade handdukar.", "Som tvättkorg för en mindre mängd."],
      collections: ["det-organiserade-hemmet"], added: 11 },
    { handle: "vaffelhandduk-bomull", name: "Våffelhandduk bomull", en: "Waffle cotton towel", price: 299, cat: "badrum-valmaende",
      rooms: ["badrum", "kok"], material: "Bomull, våffelvävd", care: ["bomull"], variants: ["Vit", "Sand"], tone: ["#F2EFE9", "#D9C7AA"], styles: ["skandinavisk", "minimalistisk"], needs: ["rutiner"], gift: ["vard", "familj"], occ: ["inflyttning", "tack"],
      short: "Handduk i våffelvävd bomull.",
      story: "Våffelvävningen gör handduken lätt, snabbtorkande och skön mot huden. Den tar liten plats på kroken och torkar fort även i ett badrum utan fönster.",
      use: ["Vit och sand går fint ihop om du vill ha två toner.", "Fungerar också som kökshandduk.", "Häng den fritt så torkar den snabbast."],
      collections: ["vardagens-favoriter"], featured: true, added: 12 },
    { handle: "tvalpump-stengods", name: "Tvålpump stengods", en: "Stoneware soap pump", price: 229, cat: "badrum-valmaende",
      rooms: ["badrum", "kok"], material: "Stengods", care: ["stengods"], tone: ["#E7E0D4", "#8F877B"], styles: ["minimalistisk", "skandinavisk", "klassisk"], needs: ["rutiner", "detaljer"], gift: ["vard", "van"], occ: ["tack", "inflyttning"],
      short: "Tvålpump i stengods för handtvål eller diskmedel.",
      story: "Byt ut plastflaskan mot något som får stå framme. Stengods är tungt nog att stå stadigt och lugnt nog att passa i både badrum och kök.",
      use: ["Fyll med flytande handtvål eller diskmedel.", "Två likadana, en i köket och en i badrummet, binder ihop hemmet.", "Skölj pumpen när du byter innehåll."],
      collections: ["vardagens-favoriter"], added: 13 },
    { handle: "kabelbox-vit", name: "Kabelbox vit", en: "Cable box, white", price: 249, cat: "smarta-hem-teknik",
      rooms: ["hemmakontor", "vardagsrum"], material: "Plast", care: ["plast"], tone: ["#F3F1EC", "#CFCBC4"], styles: ["minimalistisk"], needs: ["forvaring", "rutiner"], gift: [], occ: [],
      short: "Låda som döljer grenuttag och sladdar.",
      story: "Det är sällan möblerna som gör ett rum rörigt, det är sladdarna. Kabelboxen döljer grenuttaget och låter sladdarna gå ut genom sidorna.",
      use: ["Ställ den bakom tv-bänken eller under skrivbordet.", "Låt inte laddare som blir varma ligga helt instängda.", "Se produktsidan för vilka grenuttag som får plats."],
      collections: ["det-organiserade-hemmet"], added: 14 },
    { handle: "skrivbordsorganisator-ek", name: "Skrivbordsorganisatör ek", en: "Oak desk organiser", price: 349, cat: "smarta-hem-teknik",
      rooms: ["hemmakontor"], material: "Ek", care: ["ek"], tone: ["#B88A5A", "#E6D3B8"], styles: ["skandinavisk", "minimalistisk"], needs: ["forvaring", "rutiner"], gift: ["van"], occ: ["fodelsedag"],
      short: "Organisatör i ek med fack för pennor, telefon och papper.",
      story: "En fast plats för det som annars sprids över hela skrivbordet. Facken är gjorda för det man faktiskt har framme: pennor, telefonen och några papper.",
      use: ["Ställ den på den sida du inte skriver med.", "Låt telefonen stå i sitt fack under arbetstid.", "Olja in eken då och då."],
      collections: ["det-organiserade-hemmet"], added: 15 },
    { handle: "orbit-tradlost-laddstall", name: "Orbit trådlöst laddställ", en: "Orbit wireless charging stand", price: 449, cat: "smarta-hem-teknik",
      rooms: ["hemmakontor", "sovrum"], material: "Bekräftas på produktsidan", care: ["plast"], variants: ["Vit", "Grafit"], tone: ["#F2F0EC", "#3A3936"], styles: ["minimalistisk"], needs: ["rutiner"], gift: ["van", "familj"], occ: ["fodelsedag", "jul"],
      short: "Laddställ för trådlös laddning av telefonen.",
      story: "Ställ telefonen där, så laddar den. Laddstället ger telefonen en egen plats på nattduksbordet eller skrivbordet, och färre sladdar att leta efter.",
      use: ["Kontrollera att din telefon stöder trådlös laddning.", "Vit passar ljusa bord, grafit mörkare ytor.", "Ta av tjocka skal om laddningen inte startar."],
      collections: ["vardagens-favoriter"], added: 16 },
    { handle: "terrakottakruka-rafflad", name: "Terrakottakruka räfflad", en: "Fluted terracotta pot", price: 329, cat: "uteliv",
      rooms: ["uteliv", "vardagsrum", "kok"], material: "Terrakotta", care: ["terrakotta"], tone: ["#B8714A", "#D9A27E"], styles: ["skandinavisk", "klassisk", "mjuk"], needs: ["detaljer"], gift: ["vard", "van"], occ: ["inflyttning", "tack"],
      short: "Räfflad kruka i terrakotta. Växten på bilden ingår inte.",
      story: "Terrakotta andas, vilket många växter mår bra av. De räfflade sidorna fångar ljuset och gör krukan fin även när växten vilar.",
      use: ["Använd ett fat under om den står inomhus.", "Passar olivträd, örter och växter som vill torka upp mellan vattningarna.", "Ta in den före frosten."],
      collections: ["skandinaviskt-hemmaliv"], added: 17 },
  ];

  RQ.COLLECTIONS = [
    { id: "det-organiserade-hemmet", name: "Det organiserade hemmet", en: "The organised home", lead: "Genomtänkt förvaring för ett hem i balans.",
      text: "Ordning handlar mindre om att rensa och mer om att ge varje sak en plats. Här är förvaringen som får stå framme och lådorna som tar hand om resten." },
    { id: "skandinaviskt-hemmaliv", name: "Skandinaviskt hemmaliv", en: "Scandinavian living", lead: "Stillsamma former och varmt ljus för ditt hem.",
      text: "Ljust trä, mjuka textilier och ljus i flera nivåer. Saker som är lätta att leva med och fina att se på, år efter år." },
    { id: "vardagens-favoriter", name: "Vardagens favoriter", en: "Everyday essentials", lead: "Praktiska favoriter för vardagens alla stunder.",
      text: "Det du använder varje dag förtjänar att vara bra. Små saker som gör morgonen, middagen och kvällen lite enklare." },
  ];

  RQ.STYLES = {
    skandinavisk: { name: "Skandinavisk", en: "Scandinavian", text: "Ljust trä, naturliga material och mycket ljus. Lugnt, varmt och lätt att leva med." },
    minimalistisk: { name: "Minimalistisk", en: "Minimalist", text: "Få saker, rena linjer och lugna ytor. Varje sak har en tydlig plats." },
    klassisk: { name: "Klassisk", en: "Classic", text: "Tidlösa former och material som åldras vackert, gärna med en känsla av historia." },
    mjuk: { name: "Mjuk och ombonad", en: "Soft and cosy", text: "Textilier i lager, dämpat ljus och varma toner. Ett hem att krypa upp i." },
  };

  RQ.NEEDS = { forvaring: "Mer förvaring", ljus: "Varmare belysning", detaljer: "Inredningsdetaljer", rutiner: "Enklare rutiner" };
  RQ.GIFT_FOR = { van: "En vän", familj: "Familjen", vard: "En värd" };
  RQ.OCCASIONS = { inflyttning: "Inflyttning", fodelsedag: "Födelsedag", jul: "Jul", tack: "Ett tack" };

  // Sample rooms for Studio (images generated for RumIQ; illustrations, not customer homes)
  RQ.SAMPLE_ROOMS = [
    { id: "vardagsrum", name: "Vardagsrum i morgonljus", img: "assets/img/rum/vardagsrum-1600.webp" },
    { id: "sovrum", name: "Sovrum", img: "assets/img/rum/sovrum-1600.webp" },
    { id: "kok", name: "Kök", img: "assets/img/rum/kok-1600.webp" },
    { id: "hall", name: "Hall", img: "assets/img/rum/hall-1600.webp" },
  ];

  RQ.byHandle = (h) => RQ.PRODUCTS.find((p) => p.handle === h) || null;
  RQ.catById = (id) => RQ.CATEGORIES.find((c) => c.id === id) || null;
  RQ.roomById = (id) => RQ.ROOMS.find((r) => r.id === id) || null;
  RQ.colById = (id) => RQ.COLLECTIONS.find((c) => c.id === id) || null;
  RQ.img = (p, size) => `assets/img/p/${p.handle}-${size || 900}.webp`;
  RQ.cut = (p) => `assets/img/cut/${p.handle}.webp`;
})();

/* v5 "Ett levande hem": shoppable rooms, curated looks, vote candidates, colour chips.
   Hotspots are x/y in percent of the original room photo (1600 x 893). The photos are AI
   illustrations, so a spot marks a similar product in the shop, never the exact object.
   pos = object-position used when the photo is cropped (portrait phones). */
(function () {
  const RQ = window.RQ;
  RQ.HOTSPOTS = {
    hall: { pos: "52% 50%", spots: [["glob-bordslampa-opalglas", 10.5, 53], ["rund-vaggspegel-ek", 57, 34], ["forvaringslada-filt", 37, 78], ["flatad-forvaringskorg", 61, 77]] },
    vardagsrum: { pos: "68% 50%", spots: [["rund-vaggspegel-ek", 67, 31], ["plad-ullblandning-havre", 62, 66], ["terrakottakruka-rafflad", 76, 48]] },
    kok: { pos: "38% 50%", spots: [["forradsburkar-glas-ek-3-pack", 27, 27], ["skarbrada-ek-med-handtag", 30, 49], ["tvalpump-stengods", 45.5, 58], ["sand-keramikvas", 64.5, 59], ["vaffelhandduk-bomull", 21, 85]] },
    sovrum: { pos: "34% 50%", spots: [["svamp-uppladdningsbar-lampa", 14, 65], ["lin-kuddfodral", 28, 55], ["plad-ullblandning-havre", 63, 64], ["forvaringslada-filt", 26, 88]] },
    badrum: { pos: "34% 50%", spots: [["rund-vaggspegel-ek", 23, 18], ["tvalpump-stengods", 21, 53], ["vaffelhandduk-bomull", 19, 80], ["flatad-forvaringskorg", 66, 85]] },
    hemmakontor: { pos: "68% 50%", spots: [["skrivbordsorganisator-ek", 61, 53], ["lysa-keramiklampa", 70, 45], ["kabelbox-vit", 61, 89], ["terrakottakruka-rafflad", 86, 56]] },
    uteliv: { pos: "50% 50%", spots: [["terrakottakruka-rafflad", 21, 75], ["svamp-uppladdningsbar-lampa", 70, 52], ["lin-kuddfodral", 57, 47]] },
  };
  RQ.JOURNEY = ["hall", "vardagsrum", "kok", "sovrum", "badrum"];

  RQ.LOOKS = [
    { id: "lugn-hall", name: "Lugn hall", room: "hall", lead: "Spegel, ljus och en plats för vantarna. Hallen blir lugn på en kväll.", items: ["rund-vaggspegel-ek", "glob-bordslampa-opalglas", "forvaringslada-filt", "flatad-forvaringskorg"] },
    { id: "mjuk-kvall", name: "Mjuk kväll", room: "vardagsrum", lead: "Lågt ljus och mjuk textil för soffan när dagen är slut.", items: ["lysa-keramiklampa", "plad-ullblandning-havre", "lin-kuddfodral"] },
    { id: "frukostbanken", name: "Frukostbänken", room: "kok", lead: "Det du använder varje morgon, fint nog att stå framme.", items: ["forradsburkar-glas-ek-3-pack", "skarbrada-ek-med-handtag", "tvalpump-stengods", "sand-keramikvas"] },
    { id: "sov-gott", name: "Sov gott", room: "sovrum", lead: "Varmt ljus vid sängen och lin som andas.", items: ["svamp-uppladdningsbar-lampa", "lin-kuddfodral", "plad-ullblandning-havre"] },
    { id: "spa-hemma", name: "Spa hemma", room: "badrum", lead: "Mjuka handdukar och lugna ytor för morgon och kväll.", items: ["vaffelhandduk-bomull", "tvalpump-stengods", "flatad-forvaringskorg"] },
    { id: "fokus", name: "Fokus", room: "hemmakontor", lead: "Färre sladdar, bättre ljus och en plats för telefonen.", items: ["skrivbordsorganisator-ek", "kabelbox-vit", "orbit-tradlost-laddstall", "lysa-keramiklampa"] },
  ];

  RQ.CANDIDATES = [
    { id: "linneduk", name: "Linneduk havre", line: "En duk som blir finare för varje tvätt.", tone: "#D8C6A8" },
    { id: "ljuslykta", name: "Ljuslykta i glas", line: "Levande ljus som tål ett öppet fönster.", tone: "#E9E4DA" },
    { id: "muggar", name: "Stengodsmuggar, 4-pack", line: "Tunga, varma i handen och diskmaskinståliga.", tone: "#E7E0D4" },
    { id: "krokar", name: "Krokar i ek, 3-pack", line: "En plats för jackan, väskan och nycklarna.", tone: "#B88A5A" },
    { id: "badmatta", name: "Badrumsmatta bomull", line: "Mjuk under fötterna och snabb att torka.", tone: "#F2EFE9" },
    { id: "vagglampa", name: "Vägglampa opalglas", line: "Ljus vid sängen utan att ta bordsplats.", tone: "#F1EDE6" },
  ];

  RQ.TONES = [
    { id: "havre", name: "Havre", hex: "#D8C6A8" }, { id: "sand", name: "Sand", hex: "#D6C2A2" }, { id: "ek", name: "Ek", hex: "#B88A5A" },
    { id: "terrakotta", name: "Terrakotta", hex: "#B8714A" }, { id: "salvia", name: "Salvia", hex: "#A9B39A" }, { id: "gra", name: "Grå", hex: "#9E9890" },
    { id: "vit", name: "Vit", hex: "#F2F0EC" }, { id: "grafit", name: "Grafit", hex: "#3A3936" },
  ];

  /* Approximate 3D models (assets/3d, made by tools/models.py). wall: placed on a wall in AR. */
  RQ.MODELS = {
    "glob-bordslampa-opalglas": {}, "lysa-keramiklampa": {}, "svamp-uppladdningsbar-lampa": {}, "sand-keramikvas": {},
    "terrakottakruka-rafflad": {}, "rund-vaggspegel-ek": { wall: true }, "kabelbox-vit": {}, "forradsburkar-glas-ek-3-pack": {},
  };
})();
