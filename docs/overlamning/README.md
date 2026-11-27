# RumIQ – överlämning till Claude Code (26 november 2026)

Det här dokumentet beskriver var arbetet står när bygget flyttar från Claude-appen till Claude Code. Läs `CLAUDE.md` i repots
rot för regler, bygge, tester och arkitektur.

> Filerna i `briefs/` och `granskningar/` skrevs i den gamla miljön. Där står ibland sökvägar som `/home/claude/wt20` eller
> `/home/claude/v15/...`. De finns inte längre. Det som gäller är grenarna nedan och filerna i den här mappen.

## 1. Tidigare: v15.6 (commit c4c7aadd)
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

## 2. Live nu: v15.8 (commit fbfdd37 på `main`, 27 november)

v15.7 (Placera och skapa och Svep 2) och v15.8 är publicerade. v15.8 bygger på utvärderingen av hela sajten
("RumIQ – granskning av hela sajten (v15.7) mot marknaden"), två oberoende granskningar och en buggjakt.

**Buggjakten:** 140 sidor på telefon och dator, i kvällsläge och på engelska. Den hittade inga skriptfel och inga trasiga
sidor. Alla 28 testfiler är gröna.

**Ändrat i v15.8:**
- **Namn:** "Mitt rum" är verktyget och "Mitt hem" det sparade. "Sparat" är borta.
- **Cookierutan:** på telefon en smal rad under sidhuvudet, utom på förstasidan. Den täcker aldrig knappar.
- **Placera och skapa på telefon:**
  - Rumsbilden tar ungefär halva skärmen, och man sveper i sidled.
  - "Skapa bilden" ligger ovanför docken och kliver undan när en sak är vald.
  - Ett tomt rum visar "Föreslå saker" och "Lägg till en sak" direkt på bilden.
- **Svep-resultatet:** en huvudknapp och en total. Resten ligger under "Fler val".
- **Mitt rum före ett rum:** tre sätt att börja (Svep, Svep tillsammans, stylisten). Ingen separat Studio-sida, eftersom
  det hade blivit ett namn till.
- **Förstasidan:** "Prova produkterna i ditt rum" kommer som andra sektion, mörk och helbredd. Kortet heter
  "Prova det här rummet".
- **Mitt hem:** med sparade saker men inget rum kommer det sparade först.
- **Bakåt-knappen:** fungerar mellan Justera själv och Placera och skapa, och stänger rumsbladet i Mitt hem.
- **Text:** "står på bordet", "ligger i soffan", "en verklighetstrogen bild". Engelska finns för allt nytt.

**Kvar:**
- I Mitt hem kan formuläret fortfarande ta plats när man saknar rum och sparade saker.
- Kontroll på riktiga telefoner: BrowserStack-kontots testtid är slut, och grundaren har sagt att det får vänta.
- Allt som kräver Shopify, servern eller grundarens beslut: produkter, mått, omdömen, betalning, AI-bilden,
  att ta bort det som står i rummet, synk, klubb och prisgaranti.

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
