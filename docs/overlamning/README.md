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

## 2. Pågående arbete (grenar på GitHub, inte publicerade)

| Gren | Innehåll | Läge |
|---|---|---|
| `place-merge` | **Placera och skapa** ihopslagen med v15.6. Det är den nya huvudvägen i Mitt rum: välj rum → välj produkter → peka ut var de ska stå med nålar och ytor → streckat fotavtryck i rätt skala → "Skapa bilden" ger en AI-bild. Den gamla editorn heter "Justera själv". | Hela testsviten är grön utom `v15r5_rum` D12 (rumsbilden centreras inte bredvid listan på dator) och två tester som svajar ibland. Granskningen gav **mobil 5/10, dator 6,5/10**. Den behöver rättningarna nedan innan publicering. |
| `rum-d7` | Rum-sidans rättningar av Placera och skapa (bygger på `place-merge`) | Pågår. Se 3A. |
| `s2-ai` | AI-sidans rättningar: en sanning för rum, bild och pris i Sparat (D5) och ärlig text (D9, M7) | Pågår. Se 3B. |
| `device-fix` | Fixar från riktiga enheter: D1–D4, D8 | Pågår. Se 3C. |
| `svep2` | **Svep 2**: grupp för 2–6 personer, resultatet sparas som rum, smaken synkas med kontot, rekommendationer med sanna skäl, delning som tar in folk, mätning | Rättar granskningens fynd (`granskningar/svep2.md`) plus D6. Därefter ny granskning, BrowserStack och publicering. |

Ordning för nästa release (**v15.7**):
1. Slå ihop `rum-d7`, `s2-ai` och `device-fix` med `place-merge`.
2. Kör hela testsviten och en ny oberoende granskning av Placera och skapa. Målet är minst 8,5/10 på mobil.
3. Kontrollera på BrowserStack och publicera.

Svep 2 publiceras när dess granskning håller.

## 3. Kvar att göra

### A. Placera och skapa: rum-sidan (`granskningar/placera-och-skapa.md`, avsnittet RUM)
1. **B1** Produktsida → "Prova i Mitt rum" → exempelrum tappar produkten för en ny besökare. `rumiq-room-pre` används aldrig.
2. **B2** Mattan kan flyttas upp på väggen. Saker som hör till golvet ska alltid stå på golvet.
3. **M1** Nålar staplas på exakt samma punkt. Säg varför när en sak hoppar.
4. **M3** På mobil: kontrollerna för en vald nål ska ligga i en kompakt rad vid bilden, ovanför docken.
5. **M2** Standardnålarna trängs på 360–390 px.
6. **M4** Eget foto: rimliga ytor, till exempel påslakan på säng och inte golv.
7. **M10** Svep-förslag, Placera och Justera själv visar olika antal och totaler. Det ska finnas en sanning.
8. **M9** Startsidan i Mitt rum ska berätta om Placera och skapa, inte om den gamla editorn.
9. **M5** Förhandsvisningen: mattan i perspektiv under möblerna, och kontaktskuggor.
10. Därefter M11, M12, D7 (Glob-lampan över muggen), `v15r5_rum` D12, och sist Minor och Polish.

### B. Placera och skapa: AI-sidan (samma fil, avsnittet AI)
- **D5:** Sparat visar en gammal bild och ett gammalt pris efter ett byte.
- **M7/D9:** ta bort "riktiga sajten" och "Demo".
- **M6:** "Byt produkt" och "Prova en annan färg" ska skrolla valen in i synfältet.
- **M8:** "Bilden finns nu under Sparat" stämmer inte för exempelrum.
- "Ändra nålarna" ska ge fokus tillbaka till bilden.
- "Vad tycker du?" ska inte ladda ner automatiskt.

### C. Riktiga enheter (`granskningar/enheter-4.md`)
- **D1:** Svep-knapparna hamnar under docken när "Din stil växer fram" visas (S26).
- **D2:** kvällsremsan uppdateras inte live i Safari.
- **D3:** fokusringar dröjer kvar efter tryck.
- **D4:** iPhone SE, verktygen i Mitt rum.
- **D6:** etiketten på Svep-knappen byts.
- **D8:** avstavning i produktnamn.

### D. Efter v15.7 (grundarens beslut, "viktigt!")
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
> Läs CLAUDE.md och docs/overlamning/README.md. Hämta grenarna place-merge, rum-d7, s2-ai, device-fix och svep2, och
> fortsätt mot v15.7 enligt avsnitt 2 och 3. Svara mig på svenska.
