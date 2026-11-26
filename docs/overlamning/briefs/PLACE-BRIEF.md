# "Placera och skapa" – the main way into Studio (founder decision 26 nov, 14:40)

Founder: dragging and resizing cut-out product pictures makes it hard for the customer to know if a thing fits.
The luxury – and what makes RumIQ unique – is a GENERATED picture of your own room (or one of our sample rooms)
with the chosen products placed where you pointed, at their real size. Keep the manual editor too, but as the
secondary choice ("Justera själv"), so nobody is confused. New headline on home: "Ditt hem. Din vision. Din stil."
with "Se ditt hem innan du köper." as the line under it (the coordinator does the headline).

## The flow (phone first, then desktop)
1. Välj rum: one of our sample rooms (free) or your own photo (sign-in gate as today; HEIC/EXIF intake as today).
2. Välj produkter: up to 5, from the proposal, Sparat, a look, search, or "Prova i Mitt rum" on a product page.
   Each shows its real measurements (size field; Shopify metafields later) or "Mått kommer" honestly.
3. Peka ut: tap the photo where each thing should go → a numbered pin. The pin's surface is suggested from where you
   tapped (golv / bord / vägg / säng / soffa – sample rooms know their surfaces; own photo: ask once with chips) and can
   be changed with one tap. A dashed footprint at TRUE SCALE shows roughly how much room it takes (sample rooms have a
   built-in scale; own photo uses "Känd längd i bilden" if given, otherwise an estimate that says "ungefär").
   Pins can be moved by dragging (pointer + keyboard), removed, reordered. No resizing of pictures in this mode.
4. Skapa bilden: one big button. Sends the photo, the product images, each pin (x,y in %, surface, product
   measurements in cm, the room's scale if known) to the AI server; the server writes the prompt (see
   studio-server.md – extend the generate proposal with pins + measurements + a fixed prompt template like the one in
   /home/claude/v15/place-test/prompts.md) and returns a photoreal picture with the products in place at true size.
   Automatic quality check + at most one retry (existing proposal). While RQ_CONFIG.studio.aiLive is false: an honest
   preview ("Förhandsvisning – så här blir bilden när AI:n är på") built from the existing editor's placement of the
   same pins (cut-outs at true scale), clearly labelled; nothing is sent.
5. Resultat: before/after slider, "Köp allt i bilden · total" (exactly these products and colours), "Byt produkt" /
   "Prova en annan färg" (keeps the other pins, makes a new version), versions, saved to the room in Sparat,
   "Vad tycker du?".
6. "Justera själv" (secondary, visible but quiet): opens today's editor with the same products placed at the pins.

## Entry points
Mitt rum's start, the proposal card ("Se det i ditt rum" → Placera och skapa with the set pre-pinned by the editor's
placement rules – the customer can just press Skapa), product page "Prova i Mitt rum", Sparat room cards, Svep group
"Gör ett rum av det". The flow must be the obvious main path everywhere; the old editor only via "Justera själv".

## Rules
No floating things, no fake precision: say "ungefär" where the scale is estimated. 44 px targets, keyboard and screen
reader friendly pins (each pin a button "1 Glob bordslampa, står på bord, flytta med piltangenterna"), reduced
motion, axe clean, phone 375×548 up to desktop. Swedish copy short and warm; English in tools/i18n-add/place.json.
