# RumIQ – testsajt

Förhandsversion av RumIQ på GitHub Pages. Dold för sökmotorer (noindex) tills den riktiga domänen är på plats.

## Bygga

Källan är `assets/js/*.js`, `assets/css/site.css` och `tools/shell.html` (sidhuvud, sidfot och lådor).

    python3 tools/build.py          # minifierar och skriver en färdig sida per adress i routes.txt
    python3 tools/build.py --fast   # bara minifiering, när inget innehåll har ändrats
    python3 test/v14.py             # kontroller: alla sidor, Mitt rum, butikskorten, Hitta rätt, stylisten

Kräver Node med esbuild (`npx esbuild`) och Python med Playwright och Chromium.
`sitemap.xml`, `robots.txt` och `feed/products.xml` skrivs inte om av bygget.
