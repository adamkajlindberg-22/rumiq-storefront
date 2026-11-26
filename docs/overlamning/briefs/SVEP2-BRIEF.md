# Svep 2 – find your style together, share, and buy (founder decision 26 nov, 12:34)

The founder believes strongly in Svep: it should be EASY for people to share and find products with each
other, which brings traffic and purchases. Build all of the following, as good as possible on phone and desktop.
Read first: /home/claude/v15/STUDIO2-BRIEF.md (the founder's principle: the shop shows only real products; the
Studio/tools give joy, safety and buying confidence; core flow "Se ditt hem innan du köper"), /home/claude/v15/R2-BRIEF.md
(code layout, rules). Code today: assets/js/svep.js (Svep, the style profile RQ.styleProfile, "Svep tillsammans"
for two people via a link that carries cards and answers; no server), RQ.taste in flow.js (taste model: add, score,
sort, top, boost), hem.js (RQ.vault storage layer with an account backend behind RQ_CONFIG.studio.serverSync; SYNC
list of keys; RQ.hem rooms/projects; H.propose; H.openInRoom → RQ.room.openWith), hemsida.js (Sparat page).

## 1. Svep i grupp (2–6 people)
- One link everyone can open (no account needed). Each person enters an optional name and swipes the SAME cards.
- Each answer link carries what that person said; the next person's link carries everyone's so far (URL-based, compact
  encoding; keep URLs short and robust – e.g. base64url bitsets per person). When someone opens a link they see who has
  answered and can add themselves, then share on ("Skicka vidare").
- Result: "Det ni alla gillar", "Det de flesta gillar" (≥ half), per-person picks, the GROUP style (mix of styles,
  palette, best look) and a "hur lika ni tycker" meter. Works for 2 like today's Svep tillsammans (keep that path; it
  becomes the 2-person case of the group).
- Propose the server table for live group sessions in /home/claude/v15/studio-server.md (proposal only).

## 2. The shared result is kept
- One tap: "Gör ett rum av det" → a room in Sparat (name suggested, e.g. "Vårt vardagsrum") with the group style,
  the products everyone liked as the proposal, and the people's names; then "Se det i ditt rum" (openWith),
  "Köp allt · total", "Vad tycker du?". The group result is also listed in Sparat (Mina rum) and can be re-opened
  from the link.
- A room carries its style ("Vardagsrummet: skandinavisk och mjuk – er gemensamma stil") and Inred åt mig, the
  proposals and the recommendations use it.

## 3. Taste follows the account
- Add the taste model (rumiq-taste) and the Svep history to RQ.vault's SYNC list so it syncs when the account is live.
- "Din stil över tid": a small, honest history in Min stil (e.g. how the mix changed over the last rounds; local today).

## 4. Recommendations with reasons
- Where the site recommends (home "För dig", shop sort "För dig", Svep "why" chip, product page "Passar ihop"/related,
  Sparat rooms, the proposal card), show a short true reason: "Eftersom du gillade Glob bordslampa", "Passar din stil:
  Skandinavisk", "Passar ert vardagsrum", "Saknas i ditt rum" (e.g. a room with no lighting). Never invent a reason.
- A "Mer som det här" from a liked product (in Sparat and on Svep's result).

## 5. Sharing that brings people in
- The share picture (style card) and the group link use the Web Share API with a proper fallback (copy link), and the
  shared page that the recipient opens is beautiful and explains in one line what to do ("Svep 10 kort, så ser vi vad ni
  båda gillar"), with RumIQ's promise "Se ditt hem innan du köper".
- Open Graph meta for share links where the build allows it (title, description, image) so links look good in
  Messenger/WhatsApp/iMessage. The site is static: if per-link OG is impossible, make the Svep page's static OG image
  and text excellent.
- Track (RQ.track) group link created/opened/completed and "Gör ett rum av det" so the founder can see it works.

## Rules
Do not touch layout fixes for short screens on Svep (buttons under the dock, footer peeking, desktop chip wrap) – the
device-fix agent does those in parallel; avoid restructuring the Svep page layout CSS that would conflict, and say in
the hand-back which shared lines you touched. Swedish copy short and warm; English in tools/i18n-add/svep2.json.
Respect reduced motion; 44 px targets; axe clean. Commit after each item ("svep2: " prefix + attribution lines), full
build, all test files green (one or two at a time), own checks in test/svep2.py (group of 3 via links, 2-person
compatibility with old links, result → room, sync keys, reasons true, share fallback), screenshots 390/360/1440/1280
day and evening. Do not push, do not spawn agents, do not touch Supabase.
