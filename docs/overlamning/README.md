# RumIQ – överlämning till Claude Code (26 november 2026)

Det här dokumentet beskriver var arbetet står när bygget flyttar från Claude-appen till Claude Code. Läs `CLAUDE.md` i repots
rot för regler, bygge, tester och arkitektur.

> Filerna i `briefs/` och `granskningar/` skrevs i den gamla miljön. Där står ibland sökvägar som `/home/claude/wt20` eller
> `/home/claude/v15/...`. De finns inte längre. Det som gäller är grenarna nedan och filerna i den här mappen.

## 1. Live nu: v15.6 (commit c4c7aadd på `main`)
https://adamkajlindberg-22.github.io/rumiq-storefront/

Bekräftat på riktiga enheter (BrowserStack, iPhone 18 Pro, iPhone SE iOS 15 och Galaxy S26):
- ny rubrik "Ditt hem. Din vision. Din stil."
- ärlig AI-förhandsvisning för gäster
- Svep på Android
- länkfältet "Vad tycker du?"
- inga dubbla "Vardagsrum 2"
- "Inred åt mig" stämmer med rummet
- lampan från produktsidan hamnar på bordet
- iPhone SE-sidorna fungerar

## 2. v15.7 (publiceras från `claude/serene-bohr-7fc3mj`)

Ihopslaget: `place-merge`, `rum-d7`, `s2-ai`, `device-fix` och `svep2`, plus två omgångar rättningar.

**Granskning 2 av Placera och skapa (26 nov, före rättningarna):** telefon 6,5/10, dator 7/10. Förra granskningen
gav 5 och 6,5. Rättat efter den:
- iPhone SE: bilden stannar i synfältet när en nål väljs.
- En sak som läggs till när bilden redan har fem tar femte platsen, och sidan säger vilken som väntar.
- En väntande sak i listan tas med med ett tryck.
- Kudden och plädens rumsbilder: en kudde i Havre och en pläd utan stången (`assets/img/cut/*-rum.webp`).
- Mattans fotavtryck ligger platt.
- En första instruktion visas, och "Skapa bilden" är klistrig ovanför docken på telefon och står först i högerkolumnen på dator.
- Kvällsläget har kontrast på den valda nålen.
- Räknaren visar "5 i bilden · 6 i rummet".
- Ctrl+Z ångrar, och Enter släpper inte en vald nål.
- Textilier ligger, även på golvet. En yta som är den enda möjliga sägs i stället för att visas som knapp.
- Väljaren heter "Lägg till en sak" och filterknapparna är 44 px.
- AI-resultatet på dator: bilden står i höjd med rubriken och är klistrig, utan tomrum ovanför.

**Svep:** de sparade sakerna är en rad att svepa i på telefon, så resultatet är en skärm kortare.

**Fart:** längsta låsningen när bilden skapas är ungefär 200 ms vid 4× långsammare processor (förut 572 ms).

Kvar:
- Mattan i förhandsvisningen är jämnt belyst och dominerar förgrunden. Det löses av AI-bilden.
- Riktiga mått från Shopify.
- En tredje granskning, och kontroll på BrowserStack av den publicerade versionen.

**Grundarens beslut 26 nov:**
- Kundomdömen och "Så blev det hemma" väntar tills det finns riktiga kunder.
- Publicera när det är klart.

**Jämförelse med Lovable-studion:** allt i den listan finns redan, utom AI-stylisten med dagsgränser och stilanalys från
foton. Båda kräver server och står som förslag i `studio-server.md`, avsnitt 13. Miljöbilder och korta före/efter-videor
till marknadsföringen kostar krediter (Higgsfield) och görs först när grundaren godkänt priset.

## 3. Efter v15.7

Grundarens beslut, "viktigt!":
1. **Konkurrentgenomgång.** Gå igenom liknande sajter: presentation, förstasida, funktioner, layout och flöde. Exempel är IKEA (Kreativ/AR), Jotex, Ellos Home, Rum21, Nordic Nest, H&M Home, Mio, Royal Design, Houzz, Wayfair och Westwing. Gör sedan en plan för att bli bäst.
2. **Appen.** Den byggs på samma grund. Expo/React Native finns som verktyg.

## 4. Grundarens egna uppgifter (Claude ska inte göra dessa)
- Aktivera inloggning med Google och Apple i Supabase (Authentication → Providers).
- AI-servern:
  1. Lägg in fal-nyckeln som secret.
  2. Granska förslaget i `studio-server.md` (avsnitt 3–5 och 12).
  3. Låt deploya.
  4. Sätt `aiLive: true` i `config.js`.
- Shopify:
  - riktiga produkter
  - mått som metafields (`rumiq.width_cm`, `height_cm`, `depth_cm`, `surface`, `pack_count`)
  - företagsuppgifter, villkor och betalning (Stripe)
- Kontrollera säkerhetsreglerna (RLS) i Supabase.

## 5. Beslut som gäller (grundaren, 25–26 november)
- Butiken visar bara riktiga produkter. Rumsläget är borttaget ur butiken. "Prova i Mitt rum" leder till Studio.
- Studio har gratis verktyg som skapar glädje, unikhet, trygghet och köplust.
- Eget rumsfoto kräver inloggning; exempelrum är fria.
- AI: 5 gratis bilder per månad. Studio Plus kostar 99 kr/mån och ger 100 bilder, ett dagstak och +10 bilder per köp.
- Presentkortet gäller i 1 år. "Önska" finns i mobilmenyn.
- Studio 2:
  - byt och jämför
  - färdiga stilar med budget
  - moodboard och looks
  - projekt per rum
  - Mitt hem
  - kärnflödet: Hitta min stil → rumsförslag → Se det i ditt rum → Mitt hem → Köp allt i bilden, plus "Vad tycker du?"
- Svep 2 är en satsning för delning, trafik och köp.
- Placera och skapa är huvudvägen i Studio, och Justera själv är andrahandsval. Testbilderna är godkända (`testbilder/`).
- Inloggning: bara Google och Apple. Microsoft är borttaget.
- Ribban är medvetet hög: "vår hemsida ska ha en helt egen höjd i funktioner, kvalitet och användarvänlighet".

## 6. Filer i den här mappen
- `briefs/`: uppdragsbeskrivningarna för Studio, Studio 2, Svep 2 och Placera och skapa.
- `granskningar/`:
  - de senaste granskningarna: Placera och skapa, Svep 2 och riktiga enheter 4
  - fullständiga skärmbilder finns inte kvar; granska på nytt vid behov
- `studio-server.md`: serverförslagen (ingenting är deployat).
- `testbilder/`: godkända före/efter-bilder och den testade AI-prompten.

## 7. Förslag på nästa instruktion i Claude Code
> Läs CLAUDE.md och docs/overlamning/README.md. Fortsätt från grenen claude/serene-bohr-7fc3mj (v15.7): gör en oberoende
> granskning av Placera och skapa på telefon och dator, rätta det den hittar, kontrollera på BrowserStack och publicera
> när jag sagt ja. Svara mig på svenska.
