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

## 2. Nästa release: grenen `v15.7` (på GitHub, inte publicerad)

**Allt arbete är ihopslaget i grenen `v15.7`.** Börja där. De äldre grenarna (`place-merge`, `rum-d7`, `s2-ai`,
`device-fix`, `svep2`) finns kvar som historik men behövs inte.

Det här finns i v15.7:
- **Placera och skapa**, den nya huvudvägen i Mitt rum: välj rum → välj produkter → peka ut var de ska stå med nålar och
  ytor → streckat fotavtryck i rätt skala → "Skapa bilden" ger en AI-bild. Den gamla editorn heter "Justera själv".
  Rättat efter granskningen (som gav mobil 5/10 och dator 6,5/10 före rättningarna):
  - B1: produkten följer med från produktsidan.
  - B2: mattan stannar på golvet.
  - M1/D7: nålarna staplas aldrig på samma punkt, och upptagna ytor är kartlagda i alla 7 exempelrum.
  - M2: täta nålar ritas isär.
  - M3: kontrollerna för en vald nål ligger ovanför docken på mobil.
  - M4: rimliga ytor på eget foto.
  - M5: mattan ligger i perspektiv, och sakerna har kontaktskuggor.
  - M9: Mitt rums start handlar om Placera och skapa.
  - M10: antal och total stämmer.
  - M11, D12.
- **AI-sidan:**
  - D5: en sanning för rum, bild och pris i Sparat.
  - D9/M7: ärlig text.
  - M6: valen syns.
  - M8: bilden sparas i ett riktigt rum.
  - "Vad tycker du?" laddar inte ner automatiskt.
- **Riktiga enheter:**
  - D1: Svep-knapparna ovanför docken.
  - D2: kvällsremsan live.
  - D3: fokusringar bara vid tangentbord.
  - D4: SE i nålvyn.
  - D6: en etikett.
  - D8: ingen avstavning i namn.
- **Svep 2** med alla granskningsfynd rättade:
  - inbjudan för mottagaren
  - "Skicka tillbaka till Anna"
  - en full grupp kan skicka resultatet
  - sanna skäl, inget man svept nej på
  - luckor efter sorts sak
  - integritetstexten följer synken

  Agenten satte själv mobil 8/10 och dator 7,5/10.

Testläget för v15.7 står i `granskningar/v15.7-tester.md`.

Att göra innan v15.7 publiceras:
1. Ny oberoende granskning av Placera och skapa och av Svep 2 (målet är minst 8,5/10 på mobil).
2. Kontrollera på BrowserStack: D1 på S26, D2 på iOS 27, D3 med tryck och D4 på iPhone SE.
3. Slå ihop med `main`, gör ett fullt bygge och publicera.

## 3. Kvar att göra

### A. Kvar efter rättningarna
- **Justera själv på iPhone SE (D4):** verktygsraden hamnar under raden "Hela rummet". Ett försök med lägre scenhöjd bröt
  `v15_mitt-rum` och Mer-menyn i `device1` och backades.
- **M12:** tunga förhandsvisningar (OffscreenCanvas eller uppdelad rendering). Dragning är redan begränsad till en
  uppdatering per bildruta.
- **Placera, mindre saker:**
  - "Förstora bilden" och glappet under den på telefon
  - toasten "Klart. Här är exempelrummet." ligger över knappen
  - en nål som flyttas med tangentbordet kan hamna under den klistrade headern
  - en riktig Ångra-knapp efter Ta bort
  - kontrasten för vald nål i kvällsläget
  - kuddens standardnål ligger över sidobordet
  - "Ändra nålarna" ska även välja nålen; lägg till `RQ.room.selectPin(h)` i room.js och anropa det från ai.js
- **Svep 2:**
  - Svep-förslagets 6 saker mot Placeras 5 (förslaget bör ge 5 eller säga vilken som väntar)
  - hack vid skrollning av förstasidan på långsamma telefoner
  - resultatet på mobil är långt (cirka 3 400 px)
  - live-uppdatering mellan personer kräver servern (`studio-server.md` avsnitt 11)
- Testförväntningar som ändrades på grund av D7 (färre saker får plats på ett bord):
  - P5 i `v15r5_rum`
  - "the first two stand on the table" i `v15_mitt-rum`

  Titta på dem om de verkar fel.

### B. Efter v15.7 (grundarens beslut, "viktigt!")
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

## 7. Förslag på första instruktion i Claude Code
> Läs CLAUDE.md och docs/overlamning/README.md. Checka ut grenen v15.7 och fortsätt enligt avsnitt 2 och 3:
> granskning, BrowserStack och sedan publicering. Svara mig på svenska.
