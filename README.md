# RumIQ – testsajt

Förhandsversion av RumIQ på GitHub Pages. Dold för sökmotorer (noindex) tills den riktiga domänen är på plats.

## Bygga

Källan är `assets/js/*.js`, `assets/css/site.css` och `tools/shell.html` (sidhuvud, sidfot och lådor).

    python3 tools/build.py          # minifierar och skriver en färdig sida per adress i routes.txt
    python3 tools/build.py --fast   # bara minifiering, när inget innehåll har ändrats
    python3 test/v14.py             # kontroller: alla sidor, Mitt rum, butikskorten, Hitta rätt, stylisten
    python3 test/v15_seo-fart.py    # kontroller: sidhuvuden, sitemap, feed, 404, faktatexterna

Kräver Node med esbuild (`npx esbuild`) och Python med Playwright och Chromium.

## Det bygget skriver

Ett fullt bygge skriver allt nedan på nytt varje gång. Inget av det ändras för hand.

- En sida per adress (`<adress>/index.html`) med hela sidhuvudet: titel, beskrivning, canonical-adress,
  delningstaggar och strukturerad data. Pris, frakt och öppet köp läses ur `data.js` och `config.js`,
  så ett nytt pris blir nytt överallt.
- `sitemap.xml`, `robots.txt`, `feed/products.xml` (Google Merchant), `llms.txt`, `manifest.webmanifest`,
  `404.html` och `assets/heads.json` (det sajten läser för att hålla titel och adress rätt medan man bläddrar).
- `assets/js/site.min.js`, `site-tools.min.js`, `i18n.min.js`, `i18n-en.min.js` och `assets/css/site.min.css`.
  Varje fil får sin egen `?v=` (filens innehåll), så bara det som ändrats hämtas om.
- Mappar för adresser som tagits bort ur `routes.txt` tas bort.

Sidorna skrivs bara om varje adress gick att rita utan skriptfel. `--fast` bygger om skript, stilmall och
engelska, men skriver inte om sidornas innehåll eller sidhuvuden: kör ett fullt bygge före publicering.

## Titlar och beskrivningar

`tools/seo.json` har titel och beskrivning per adress. Siffror som lovas kunden skrivs som platshållare
och fylls i ur `config.js`: `{openDays}`, `{freeFrom}`, `{pickup}`, `{home}`, `{minDays}`, `{maxDays}`.
Produkter, kategorier, rum och looks får sin beskrivning efter en regel i bygget (kort text, pris,
öppet köp, frakt). En adress som saknas i filen får sidans rubrik som titel.

Vilka sidor som döljs för sökmotorer står överst i `tools/build.py`: `NOINDEX` (kassa, konto, tomma sidor),
`ALIAS` och `ALIAS_PREFIX` (gamla namn och nästan likadana sidor, som pekar på den riktiga sidan).

## Engelska

`assets/js/i18n-en.js` ändras inte för hand. Nya eller ändrade par läggs i `tools/i18n-add/<namn>.json`
(ett platt objekt, svenska till engelska, samma platshållare som i ordlistan). Bygget lägger dem ovanpå
ordlistan och skriver `assets/js/i18n-en.min.js`. Finns samma svenska fras i två filer vinner den sista
i bokstavsordning, och bygget säger till.

## När rumiq.se är på plats

Två rader överst i `tools/build.py`:

    SITE = "https://rumiq.se/"     # adressen sajten publiceras på
    LAUNCH = True                  # släpper in sökmotorerna (eller: python3 tools/build.py --launch)

Med `LAUNCH = False` säger varje sida `noindex` och `robots.txt` stänger ute sökmotorer. Med `True` kan
butikens sidor hittas, medan kassa, konto och de andra i `NOINDEX` förblir dolda. Bygg om och publicera.
