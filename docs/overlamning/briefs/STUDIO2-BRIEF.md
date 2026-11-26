# RumIQ Studio 2 – more ways to use the range (founder decision 25 nov, 22:30)

The founder: product cards are their own thing (room mode in the shop is removed: cards always show the
product photo; the product page has "Prova i Mitt rum"). Instead, develop the Studio much further so that
with our sample rooms OR the customer's own photo, people can use the products in our range in different
ways. He chose all four directions below, plus section 5 (Mitt hem). Goal as always: people LOVE it, phone and desktop, 10/10.

Read first: /home/claude/v15/STUDIO-BRIEF.md (Studio, rules, decisions: own photo needs sign-in, sample
rooms free, AI limits from config), /home/claude/v15/R2-BRIEF.md, /home/claude/v15/R4-BRIEF.md, and the
latest review /home/claude/v15/review/studio/report.md (do not reintroduce anything it criticised:
floating items, things under the dock, covered tools, small tap targets, texts that are not true).

## 1. Byt och jämför i rummet (editor – studio-rum)
Tap a placed thing → "Byt" shows alternatives of the same kind (same category/type, fits the surface) and
its colours as a light row; tapping one swaps it in place at the same spot and scale (true scale kept if
measured). "Jämför" puts 2–3 variants side by side as the same room picture (swipe on a phone, columns on
desktop) with name, price and one tap to keep one. Instant, no reload, undo with Ångra.

## 2. Färdiga stilar med budget (editor – studio-rum)
"Inred åt mig" gets a small, optional choice: style (skandinavisk, minimalistisk, klassisk, mjuk – the
existing RQ.STYLES) and a budget slider (kr, from the cheapest sensible set to the whole room). The result
is a complete suggestion that respects both, with the total and "Köp allt". Re-roll gives another set in
the same style and budget. Honest: if the budget is too low for the style, say what fits and what is left.

## 3. Moodboard och looks (new Studio surface – studio-ai)
A free board without a room photo: add products (search, from Sparat, from a look), move, resize, layer,
add colour swatches from the products and a short note; neat auto-layout to start. Save it as a look in
Sparat, share it (one picture + link), and "Prova i ett rum" sends its products into Mitt rum (sample or
own room) where the editor places them (never floating – use the editor's placement rules).

## 4. Projekt per rum (Sparat + Studio – studio-ai)
Several rooms as projects (Vardagsrum, Sovrum …, each with its photo or sample room, placed things, AI
pictures/versions, moodboards). Per project: inköpslista with total, budget and what is left, and
"Köpt" marking (manual tick, and automatic for things bought through the shop when orders exist).
Switching project in Mitt rum is one tap. Merge with today's Rumsprojekt and Mina rumsbilder so there is
ONE clear place (the review's M5): Sparat → Mina rum, each room a card with its pictures and list.

## Shared rules
Data local (localStorage/IndexedDB) until the account is real; say so honestly. Example products are
example data. Swedish copy short and warm; English in tools/i18n-add/<area>.json. Respect reduced motion.
Commit after each item, prefix "studio2 <area>: ", attribution lines, full build, all test files green
(run one or two at a time), own checks in test/studio2_<area>.py, screenshots 390/360/1440/1280 day and
evening. Do not push, do not spawn agents, do not touch Supabase. Hand-back as before with a strict score.

## Founder principle (25 nov, 22:33) – applies to everything
The shop shows only real products: product cards and product pages always show the actual product with its
own photos, price and data (today example data; later the founder's Shopify products, with nothing else in
the shop changing). The customer's room photo never appears on product cards. The Studio is separate: free,
incredible tools anyone can use (sample rooms free; own photo after sign-in) that raise joy and what makes
RumIQ unique, AND the customer's security and confidence in buying (true size, colours in context,
compare before buying, honest "ungefär" where unsure, budget, exact Köp allt, shopping list per room).

## 5. Mitt hem – one home for everything the customer saves (studio-ai; founder input 25 nov 22:36)
The founder's other build has "Mitt hem". Take the best of it and make ours better. Today we have Sparat
(#mitt-hem) with Produkter, Mina rum och mått, Mina rumsbilder, Rumsprojekt (+ stylist/looks parts) and an
account page. Build ONE clear place, ONE name everywhere (keep "Sparat" in the dock/menus if that is what
the whole site uses, but the page reads as the customer's home; never three names for the same thing):
- Overview first: the latest after-pictures as BIG cards ("Fortsätt där du slutade", the three latest rooms,
  each with its newest after-picture, room name and one next step). Not a text list.
- New customer / nothing saved: a calm "Skapa ditt första rum" card. First step is NOT the photo upload:
  name the room ("Vardagsrum") and pick the room type (and optionally style), then choose sample room or own
  photo (own photo → sign-in gate as today). Everything made afterwards lands in that room automatically.
  Show how many free AI pictures are left this month (from config/limits, honest in preview).
- A short benefits row for signed-out customers (three, e.g. "Före/efter-bilder sparas", "Dina rum följer
  med mellan enheter", "Stylistsamtal sparas"), only true claims (device-only today → say "när kontot är
  aktivt" or keep it to what is true now).
- Room project = name, room type, style, colours, budget, material, own measurements, notes, chosen products,
  placed scene, AI pictures with versions, moodboards, inköpslista (total, budget left, Köpt). All of it
  flows into the Studio editor, Inred åt mig (style + budget) and the stylist.
- Progress per room with the next step, e.g. "Stil ✓ · 2 bilder ✓ · 6 produkter valda → Nästa: välj budget".
- Image library inside the room AND a filterable "Alla bilder": slider före/efter, Ladda ner, Ta bort+Ångra,
  "Flytta till rum", jämför två versioner, "Prova igen i Studio" (opens the editor with the same products,
  colours and room).
- Favourites (Produkter), Din stil and Stylistsamtal (saved conversations, re-openable) are here too.
- Sync: everything is local today. Write the client so the same data syncs for signed-in customers when
  Supabase is live (one storage layer with a local and an account backend), and add to
  /home/claude/v15/studio-server.md the proposed tables/policies (wishlist, room projects, stylist
  conversations) – proposal only, nothing deployed.
- Privacy line once: "Allt du sparar här är privat."

## 6. The core flow: "Se ditt hem innan du köper" (founder input 25 nov 22:58) – the thing to bet on
Hitta min stil (Svep, `svep.js`, and the stylist/Stilguide) → a READY room proposal ("Ditt vardagsrum i
skandinavisk stil", style + colours + a budget-aware set from our range, total) → "Se det i ditt rum" (opens
the Studio editor with that set placed: sample room of that type, or own photo after sign-in) → saved
automatically in Mitt hem under that room → "Köp allt i bilden" (exactly those products/colours).
- Every step hands the next one its data automatically (style, colours, room type, budget, products); no
  re-choosing. The Svep result and the stylist's style answer end in that proposal card, not a dead end.
- "Vad tycker du?": share a room picture/proposal with a partner as a link that opens the same proposal
  (encoded in the URL, no account needed) where they can answer "Gillar" / "Föreslå något annat" on each
  item; the answers come back to the customer's room when they open the link reply (local/URL based today;
  propose the server table for real sync in studio-server.md). Reuse Svep's "Det ni båda gillar" ideas.
- On the AI result: "Köp allt i bilden" prominent (exists – keep it first), and "Prova en annan färg" /
  "Byt produkt" without starting over (opens the editor's Byt at that item, then Skapa igen = a new version).
- Real measurements: keep the `size` field ready for Shopify (product metafields: width/height/depth cm);
  document the expected Shopify field names in studio-server.md so the founder's import fills it.
- Make the promise visible where it matters (Studio header, the home page's Studio section, the proposal
  card, share picture): "Se ditt hem innan du köper." Do NOT change the home hero headline (founder decides).
- Explore/looks: the light switch, colour change and "lägg hela looken i varukorgen" already exist in Looks –
  make sure a look can be opened in "Se det i ditt rum" too.
