# Placera och skapa – review routing (full report in coordinator chat; shots in review/place/shots/)
Scores: phone 5/10, desktop 6.5/10.

## RUM (room.js / pin view) – agent rum-d7 (wt21)
B1 Product page → "Prova i Mitt rum" → "Prova med ett exempelrum" loses the product (rumiq-room-pre in sessionStorage never used on the sample path; also direct URL mitt-rum-<handle>/). Must land in Placera with the product pinned + chosen.
B2 Rug floats up the wall (Shift+↑ → y 41 %, 13.8 % wide, still "ligger på golv"); movePin exempts kind "rug" from floor clamp. Floor things always stay on the floor.
M1 Pins stack: dragging the table lamp to the wall snaps it back to the table at exactly the vase's coords → pin 1 fully under pin 5. Table things get distinct spots; say why it snapped ("en bordslampa står på bord eller golv").
M2 Default pins crowd at 360–390 (pins 1/4/5 only 76–84 % hittable; labels "ungefärungefär"); Svep proposal same cluster. Spread defaults; offset/leader lines; readable "ungefär".
M3 Phones: chosen pin's controls below photo / under dock (375×548 panel at y 527; 390×844 Tidigare/Senare/Ta bort under dock). Compact bar for the chosen pin next to the photo, above the dock.
M4 Own photo: everything defaults to "står på golv" incl. duvet cover (only allowed "säng"); list and panel disagree. Ask surface right after adding on own photo, or guess sensibly (bedding → säng, table lamp → bord …).
M5 Preview look: default rug at y 96 % / 79.5 % wide flat mat in foreground → put it under/in front of the sofa in perspective; add contact shadows to cut-outs; believable default spots.
M9 Mitt rum start still tells the old editor story ("Ställ in produkter / Handla looken"); empty Placera list says "tryck på Inred åt mig i Justera själv"; "Ange en känd längd" sends to Justera själv. Rewrite around Placera och skapa (and give "Inred åt mig" / known length a way inside Placera or a clear return).
M10 Svep proposal 6 products (3 974 kr) vs Placera 5 vs Justera själv 6 (4 385 kr). One truth: say clearly which waits; picking a 6th thing gives feedback.
M11 Justera själv phone: "Placera och skapa" chip (y 805/844) under the sticky "Hela rummet" bar.
M12 Jank at 4× CPU: Skapa bilden → result 5.5 s, blocks up to 572 ms; drag frames up to 133 ms. (Preview render: chunk/yield, use OffscreenCanvas/createImageBitmap, rAF for drag.)
Minor: picker shows no measurements/"Mått kommer", filter chips 37 px; step row 1–4 lacks current step (aria-current); "Förstora bilden" shown with no pins + ~70 px gap on phones; "Klart. Här är exempelrummet." toast covers Skapa bilden; footprint labels 11.2 px white on light wall, clipped at 1440; keyboard-moved pin can go under sticky header (scroll-follow, WCAG 2.4.11); after delete "Ångra med Ctrl+Z i Justera själv" → give a real Ångra button in this flow; evening: chosen pin white on pale sage ~1.6:1, panel number badge dark on dark; cushion default pin over the side table while saying "ligger på soffa".
Polish: tapping the floor with the throw chosen silently moves it to the sofa → say so.

## AI (ai.js / result sheet / Sparat) – agent ai (wt12)
M6 "Byt produkt" / "Prova en annan färg" open choices out of sight (focus with preventScroll) → scroll choices into view.
M7 Wording: loading "På den riktiga sajten tar AI-bilden 15–40 sekunder" (= D9); after-side label "Demo" vs "Förhandsvisning" everywhere else; Sparat files previews under "AI-bilderna du har skapat" → label previews honestly.
M8 "Bilden finns nu under Sparat" but for a sample room Sparat shows "Mina rum (0)"; pictures only under "Alla bilder". Create/link the room so the picture is truly saved to a room (or say exactly where it is).
Minor: "Ändra nålarna" returns focus to Skapa bilden – should go back to the photo with the pin chosen (coordinate with rum: RQ.room API or focus the first pin); leftover "downloaded" toast because "Vad tycker du?" auto-downloads when share isn't available → offer, don't auto-download.
Polish: result slider starts at 3–4 % hiding the "Före" chip; with AI on "Skapa igen · 1 bild" renders as two separately underlined pieces.
