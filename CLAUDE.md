# RumIQ – instruktioner för Claude Code

RumIQ är en svensk webbutik för heminredning (dropshipping): belysning, textil, förvaring och mer. Grundaren bestämmer
inriktningen. Löftet är **"Se ditt hem innan du köper."** och förstasidans rubrik är "Ditt hem. Din vision. Din stil.".
Målet är 10/10 på dator och på alla telefonstorlekar. En app ska byggas på samma grund senare.

Läs `docs/overlamning/README.md` först. Där står var arbetet står, vad som återstår och var allt finns.

## Arbetssätt
- **Svara alltid grundaren på svenska.** Kort och enkelt, utan teknisk jargong när det går.
- All synlig text på sajten är på svenska: kort, varm och tydlig. Engelska läggs i `tools/i18n-add/*.json`.
  Redigera **aldrig** `assets/js/i18n-en.js` för hand, eftersom den byggs.
- Butiken visar bara riktiga produkter. Produktkort och produktsidor visar alltid själva produkten (exempeldata nu,
  Shopify senare). Rumsverktygen hör hemma i **Studio** och nås från produktsidan via "Prova i Mitt rum".
- Ärlighet: skriv aldrig att något är en "demo" eller "den riktiga sajten". När AI:n är av visas en märkt
  "Förhandsvisning" och ingenting skickas.
- Fråga grundaren innan beslut som inte går att ångra eller som kostar pengar.

## Hårda regler
- **Klistra aldrig in nycklar eller hemligheter** i chatt, kod eller commits. Grundaren lägger själv in nycklar för
  Supabase, Stripe och fal.
- **Deploya inte edge functions och ändra inte databasen** utan att grundaren bestämt det. Serverarbete skrivs som förslag i
  `docs/overlamning/studio-server.md`.
- Ange priset i krediter innan Higgsfield används (bilder/film). Ladda upp bilder via `media_import_url` med
  GitHub Pages-adresser.
- **Skriv aldrig en `//`-kommentar mitt på en kodrad.** Mycket kod står på en rad, och då sväljer kommentaren koden efter
  den. Det har hänt flera gånger. Använd `/* ... */`. En hook i `.claude/settings.json` kör `python3 tools/check_comments.py` efter varje ändring
  och säger till om den hittar en sådan rad.
- Safari 15 (iPhone SE och äldre iPhones) måste fungera:
  - ingen regex-lookbehind `(?<=` / `(?<!`
  - en vanlig färg före `color-mix()`
  - procentfallback före containerenheter (`cqw`)
  - fokusringar med box-shadow
  - globala variabler läses som `window.X`

## Bygga
Källor: `assets/js/*.js` (inte `*.min.js`), `assets/css/site.css` och `tools/shell.html`.

    python3 tools/build.py          # fullt bygge: minifierar, förrenderar ~140 sidor + 404, sitemap, feed
    python3 tools/build.py --fast   # bara skript/stil/engelska under arbetet

Kör alltid ett fullt bygge före publicering. Bygget kräver Node med esbuild (`npx esbuild`) och Python med Playwright och Chromium.

## Testa
Playwright-tester i `test/*.py` (cirka 27 filer). De startar en egen lokal server.

    export AXE=/path/to/axe-core/axe.min.js   # npm i axe-core; behövs för tillgänglighetskontrollerna
    ls test/*.py | grep -v _edit_way | xargs -P 3 -I{} python3 {}

- Kör om en fil som fallerar **ensam** innan du felsöker. Tidskänsliga kontroller kan svaja under last.
- `test/_edit_way.py` är en hjälpfil, inget test.
- Viktigaste filerna per område:
  - Studio och Mitt rum: `studio_rum.py`, `studio2_rum.py`, `place_rum.py`
  - AI-sidan: `studio_ai.py`, `studio2_ai.py`, `place_ai.py`
  - Svep: `svep2.py`
  - Telefoner: `device1.py`
  - Hela köpresan: `v15_dator-kopresa.py`, `v15_mobil-kopresa.py`
  - SEO: `v15_seo-fart.py`
- Riktiga enheter testas med BrowserStack (MCP, produkten "devicecontrol"). Fungerande enheter:
  - "iPhone 18 Pro" (iOS 27)
  - "iPhone SE 2022" (iOS 15)
  - "Samsung Galaxy S26" (Android 16)
  - macOS "Golden Gate" med Safari 27

  På iOS är tryck syntetiska, och `navigator.share` fryser webbvyn, så delningsknappar testas på Android.

## Publicera
Sajten publiceras från `main` via GitHub Pages: https://adamkajlindberg-22.github.io/rumiq-storefront/
1. Arbeta på en egen gren och slå ihop med `main`.
2. Kör ett fullt bygge och testerna, och committa byggfilerna med (`git add -A`).
3. Gör `git fetch` och därefter `git merge origin/main` innan du pushar till `main`.
4. Kontrollera den publicerade sajten, gärna på BrowserStack.

Committa aldrig hemligheter. Ta bort skräp som `gc.log` och skärmbildsmappar innan commit.

## Arkitektur i korthet
- `assets/js/app.js`: router, sidor och gemensamt. `RQ.part()` kapslar varje del av produktsidan så att ett fel inte fäller sidan.
- `assets/js/room.js`: rummotorn (Mitt rum).
  - Rumskartor med yt-, upptaget- och kantpunkter per exempelrum.
  - API:er: `RQ.room.openWith`, `fits`, `pins`, `place`, `movePin`, `pinOrder`, `preview`, `way`/`setWay`.
  - Händelsen `rq-place-create`.
- `assets/js/ai.js`: AI-bilder.
  - `RQ_CONFIG.studio.aiLive` är `false` tills servern finns; då visas en ärlig förhandsvisning.
  - Lyssnar på `rq-place-create`.
- `assets/js/hem.js` / `hemsida.js` / `myhome.js`: Mitt hem, rum per projekt, moodboard.
  - `RQ.vault` för lagring; synk bakom `RQ_CONFIG.studio.serverSync`.
- `assets/js/svep.js`: Svep (hitta min stil, även tillsammans 2–6 personer).
- `assets/js/studio.js`: Studio-verktygen.
- `assets/js/auth.js` / `account.js`: inloggning. Bara Google och Apple (`social: ["google","apple"]` i `config.js`).
- `assets/js/config.js`: priser, frakt, gränser.
  - studio-block: 5 gratis AI-bilder per månad.
  - Studio Plus: 99 kr/mån för 100 bilder och +10 per köp.
- `assets/js/data.js`: exempelprodukter (byts mot Shopify).
