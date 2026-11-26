# Svep 2 review – build r6-merge (/home/claude/wt18), 26 nov. Phone 6.5, desktop 5.5 ("would people love it and share it")
Shots /home/claude/v15/review/svep2/shots/ ; scripts /home/claude/v15/review/svep2/scripts/
Engine works: short links (99 chars 1 person, 145 for 6), merge across browsers up to 6, old 2-person links OK, broken link says so, result looks good, Gör ett rum → Sparat → Se det i ditt rum works, axe clean, keyboard OK. What keeps it down: the sharing loop leaks people, and some reasons are false.

## Major
1 A friend's first screen is an identity question, not an invitation ("Vem är du?" with the sender's name as the big first button, "Jag är ny" second, "Den här webbläsaren känner inte igen dig…"; no product picture, no one-line what-to-do, no promise; half the phone screen / whole left desktop column empty). Should: lead with "Anna vill veta vad du tycker. Svep 10 kort, så ser ni vad ni båda gillar.", a strip of the cards, the promise, "Svep korten" as the primary button; "Är du Anna? Visa resultatet" as a small secondary link. g05_whoami_B_1440n, g09_whoami_C_360, o01_oldlink1_390, t01_whoami_375s
2 Tapping the wrong name cannot be undone (saved as Anna permanently, sees Anna's result, "Skicka vidare" sends as Anna; no "Inte du?"). Add "Inte Anna? Svep själv" on the result. w01_tapped_anna_by_mistake_390
3 The result is not sent back: B sees "Ni gillar båda 4 saker" but Anna only learns it if B uses "Skicka vidare", which is at the bottom of the right column below the fold at 1440×900/1280×720 and talks about adding more people. Should: a primary "Skicka tillbaka till Anna" (groups: "Skicka till gruppen") directly under the meter; name field labelled "Ditt namn" (not "Till exempel Anna" when Anna is in the group). g07_resultB_1440n(_full), g08_sentB_1440n, d03_result_1280
4 A full group of 6 has no visible way to share the result ("Gruppen är full…", only the small "Dela er stil" which downloads a PNG without asking and toasts "Bilden är sparad.", no link shown unless the clipboard works). Offer "Skicka resultatet till gruppen" with the same share-or-visible-link fallback. g12_result6_390_full, f01_full_390, f02_dela_er_stil_390, d05_dela_stil_noclip_1280
5 Home "Utvalt för dig" and shop sort "För dig" recommend something the user swiped NO on (Sand keramikvas, score −0.5) 4th, with "Eftersom du gillade Dagsljus linnegardin"; 6 of 8 picks are already-liked items with circular reasons (Glob "Eftersom du gillade Stilla", Stilla "Eftersom du gillade Glob"). Should: drop negative scores; leave out already-liked items or say "Du gillade den i Svep". h03_utvalt_390, b01_butik_fordig_390
6 Room sheet "Saknas i rummet": "Pläd ullblandning havre · Saknas i ert rum: textil" in a room with Lin kuddfodral – gaps are decided by shop category (only sovrum-komfort = textil; linen cushion covers, curtain, jute rug are hem-inredning = "detaljer"). Decide gaps by kind of thing, or name the gap ("en pläd"). r08_roomsheet_gaps_390
7 Reasons technically true but nonsense: rule "shares a style and is the same category or colour family" gives "Eftersom du gillade Våffelhandduk bomull" on a lamp, "Eftersom du gillade Tvålpump stengods" on Svamp lampa, "Samma sort och stil som Dagsljus linnegardin" on a cushion cover. When categories differ say what is shared ("Samma färgton som …"); avoid cross-room pairs (bathroom → living room). p01_pdp_passar_ihop_390, s04_mer_som_390
8 Privacy line will become untrue: svep-ihop intro says "Svaren finns bara i länken … och i era egna webbläsare. Vi sparar dem inte." but rumiq-groups is on the account sync list. Make it depend on the sync setting, or soften it now.

## Minor
- Phone result order: "Skicka vidare" far down at 360/390; "Lägg i varukorgen" under the dock on first view. g11_resultC_360
- Intro at 390: "Starta en grupp" half under the dock on first view. g01_intro_390
- Undo 42×42 at 375×548 (<44); deck icon-only home and bag buttons have no visible labels. t02_deck_375s
- "båda" in group contexts (up to six): "sen ser ni vad ni båda gillar" (A's Skicka korten), "När ni båda har svept" (solo result). g03_resultA_390, s03
- Sparat group line "Du och Anna och Erik" → "Du, Anna och Erik"; room sheet repeats the title ("Vårt vardagsrum" then "Vårt vardagsrum: skandinavisk…"). r07_roomsheet_390
- "Din stil över tid": two rows both "26 nov. Skandinavisk", no time/round/percent; bars by colour only (add text/percent). m01_stil_over_tid_390
- Reasons cut off with "…" in "Mer som det du gillade" ("Dagsljus linnegardin,…"). s04_mer_som_390
- Desktop: left column ends after the actions leaving a big empty area while the right column is long. g07_resultB_1440n_full
- Home scroll jank at 4× CPU: long tasks 225 and 145 ms, p95 frame 83 ms (deck fine).
- Solo /svep/ uses the "Svep tillsammans" share picture (group image under a solo title) – give solo its own or a neutral one.

## Polish
- Avatar row shows "Du" twice.
- "Se det i ditt rum" at 390: the poster is cropped at the left edge. r03_se_i_rum_390
- Empty sample room: toast "Klart. Här är exempelrummet." over "Rummet är tomt." x07
- Share picture wordmark is plain text, not the logo.
- Meter label "50 % gemensamt" → explain ("så lika tycker ni").

## Five changes that would most raise the score
1 Recipient's first screen as an invitation. 2 "Skicka tillbaka till [namn]" under the meter on every result after the first; full group: "Skicka resultatet till gruppen". 3 Recommendation truth (no rejected, no circular, gaps by kind, "Samma färgton som"). 4 "Inte [namn]? Svep själv". 5 Desktop: send + actions above the fold in the left column; phone order: meter → send back → Gör ett rum → rest.
