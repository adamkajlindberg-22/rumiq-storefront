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

## 2. v15.7 (gren `claude/serene-bohr-7fc3mj`, inte publicerad än)

`place-merge`, `rum-d7`, `s2-ai` och `device-fix` är ihopslagna här, plus rättningarna nedan. `svep2` är inte med; den
publiceras när dess granskning håller.

Klart i v15.7:
- **Rum-sidan:** B1, B2, M1, D7 (från `rum-d7`); M2 nålar som står för nära trycks isär, med en prick och ett streck till
  den exakta platsen; M3 på telefon ligger den valda nålens kontroller direkt under bilden, ovanför docken; M4 en sak får
  aldrig en yta den inte kan ha (påslakan på säng, inte golv); M5 mattan ligger framför soffan och sakerna har
  kontaktskuggor i förhandsvisningen; M9 Mitt rum, förstasidan och Studio Plus berättar om Placera och skapa, och en tom
  lista har "Föreslå saker"; M10 det som inte fick plats eller väntar sägs i listan ("Fick inte plats", "Väntar" med
  "Lägg till dem"); M11 vägen tillbaka till Placera och skapa syns ovanför rumsraden.
- **Minor:** riktig Ångra-knapp efter Ta bort, steget man är på markeras (aria-current), "Förstora bilden" bara när det
  finns nålar, ingen toast över Skapa bilden, fotavtryckets etikett läsbar och bara för den valda saken.
- **AI-sidan:** D5, M6, M7/D9, M8, Ändra nålarna, Vad tycker du? (från `s2-ai`); D12 bilden centreras bredvid listan på
  dator; glappet under Köp allt i bilden borta (en CSS-krock med `.pl`); bocken vid "Bilden finns nu …" står på samma
  rad som texten; "Bilden finns nu i {rum} under Sparat" finns på engelska.
- **Enheter:** D1–D4, D8 (från `device-fix`). D6 finns i `svep2`.

Kvar:
- M12 (ryck vid 4× långsammare processor) och "Mått kommer" i produktväljaren.
- En ny oberoende granskning av Placera och skapa (målet minst 8,5/10 på mobil), BrowserStack och sedan publicering.
- Svep 2.

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
