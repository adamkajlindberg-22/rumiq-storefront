# RumIQ Studio – make people LOVE it (read fully first)

The founder: "I like the studio and that we have these unique tools that set us apart from competitors,
but it must be as good and well developed as possible and people must LOVE using it." He shared how the
same tool works in his other build and asked us to take the best and most important parts and adjust
or develop ours.

Studio here = Mitt rum (own photo or sample room, place products, live engine in `assets/js/room.js`),
the AI room picture (`assets/js/ai.js`: sign-in gate, consent, compose, result with before/after, Köp
allt, Spara, Skapa igen, "Produkten blev fel"), Studio Plus (`studio-plus`), and saved things in Sparat
(`assets/js/myhome.js`). Server side (Supabase project RumIQ, already deployed, dormant until the founder
adds keys): tables plans/subscriptions/generations/credit_ledger, edge functions `generate` etc. Design
docs (in the claude.ai Project, summarised): guide image built on a canvas from the room photo with each
cut-out at its scene position/size/flip/light; inputs room + guide + up to 6 cut-outs; output labelled
"RumIQ · AI-bild"; images ~1280 px long side; "Produkten blev fel" refunds max 3/month.

## Founder decisions (binding)
- Adding an OWN room photo requires signing in first. Sample rooms stay free to try without an account.
  The gate: a calm sheet "Logga in för att lägga in ditt rum" with "Logga in" and "Skapa gratis konto"
  (and the existing providers). After sign-in the customer lands back on the same step with every
  chosen product still chosen (and the photo they picked, if they had already picked one).
- Limits stay: 5 free AI images per month with an account, Studio Plus 99 kr/month for 100 images, daily
  cap, +10 per purchase. Do not change numbers; read them from config.

## What to take from the other build (and how it fits ours)
1. Photo intake: every common image type incl. iPhone HEIC/HEIF (decode on demand only when such a file
   is chosen, e.g. a small lazily loaded decoder; never in the main bundle), any size and orientation
   (respect EXIF orientation), auto-fit (long side ~1600 px, JPEG), and a friendly tip when the photo is
   too dark or too small ("Bilden är ganska mörk. Ett ljusare foto ger en mer verklighetstrogen bild."),
   with "Använd ändå" / "Välj en annan".
2. Real size: "Känd längd i bilden" (optional): drag a line over something of known length (a door
   ~200 cm is the suggested example) and type the length; from then on products with real measurements
   are drawn at true scale at that depth (perspective: scale with the item's vertical position, simple
   and honest), and a dashed outline shows roughly how much floor/wall space the product takes. Products
   get real measurements in `data.js` (width × height × depth in cm; these are example products, so mark
   the field as example data in a comment and only use measurements the product text already states or
   that are clearly typical for that product type; never show a measurement as fact on the product page
   unless the product data says it). Without a known length or measurements: keep today's behaviour and
   say "Storleken är ungefärlig". Never guess and present it as exact.
3. Placement: our drag-and-place is already better than typed positions. Keep it. Make sure each item's
   surface (golv / vägg / bord / säng / soffa) is visible and changeable in the selected-item panel
   ("Står på: bord ▾") so the customer can correct a wrong guess in one tap (helps own photos, where the
   site does not know where tables are).
4. AI picture: same aspect ratio as the original photo (never stretched); labelled as an AI suggestion;
   one automatic quality check and at most one automatic retry (client: show "Vi gör ett nytt försök…"
   when the server says it retried; server: see section "Server" below); the result remembers exactly
   which products and colours it shows, so Köp allt always adds exactly those.
5. Image library "Mina rumsbilder" in Sparat: EVERY AI picture is saved automatically together with its
   before picture (no extra step), with a before/after slider, Ladda ner, Ta bort (removes the before
   picture too, with Ångra for a few seconds), private to the customer, and an on/off switch "Spara mina
   AI-bilder automatiskt" (default on). Store images in IndexedDB (not localStorage: too small), with a
   clear message when the device is full. When the account is real (Supabase connected), the same list
   is backed by the `results` bucket; until then local only, and the page says so honestly.
6. Versions: "Skapa igen" makes a new version beside the earlier ones; the customer can flip between
   versions and compare two with the slider; the room can be saved as a project in Sparat to continue
   later (we have Spara: make sure versions belong to the project).

## Make people LOVE it (this is the real goal)
Use `design-skills:design-elevation`, `design-skills:interaction-design` and `anthropic-skills:frontend-design`.
The first minute must feel magical and effortless on a phone: one obvious next step at every moment,
products landing softly, light, instant feedback, no dead ends, no jargon, warm short Swedish. Delight
without weight: small, purposeful motion (respect reduced motion), satisfying before/after, a moment of
pride when the room looks good ("Visa någon" / share the before/after picture). Keep it simple and light:
do not add screens or options a first-time customer has to read.

## Areas and worktrees (base: the branch named in your task; check `git log -1`)
### studio-rum (room.js side) – worktree /home/claude/wt7/rum, branch studio-rum
Items: the sign-in gate for own photos with return to the same step (1 above + decisions), photo intake
(1), real size and known length (2), surface chooser (3), and the delight of the Mitt rum editor.
### studio-ai (ai.js + Sparat side) – worktree /home/claude/wt7/ai, branch studio-ai
Items: AI picture aspect, label, retry UI, exact products (4), image library with auto-save, slider,
download, delete with Ångra, switch (5), versions and compare (6), the delight of the AI moment, and the
"Server" section below.

## Server (studio-ai)
Read the deployed edge function `generate` with the Supabase tools (project RumIQ, id viiqzkuwmhnnhtlcwlpi)
and propose, as a file in your worktree (`supabase/functions/generate/` if the repo has it, otherwise
`/home/claude/v15/studio-server.md`), the change for: output at the room photo's aspect ratio, one
automatic quality check of the result (e.g. compare size/aspect, non-empty, and a cheap check that the
products are present) and at most one retry without charging twice, and saving result + before picture
to the private `results` bucket with the generation row. DO NOT deploy anything to Supabase and do not
change the database: write the proposal and the code only; the founder decides.

## Rules
Everything in `/home/claude/v15/R2-BRIEF.md` (code, tools, rules, hand-back) and the verification sizes in
`/home/claude/v15/R4-BRIEF.md` apply. All test files in `test/` must stay green after a full build
(currently 21 files incl. `test/v15r6_sista.py` if present; AXE=/home/claude/axe/node_modules/axe-core/axe.min.js).
Your own checks in `test/studio_<area>.py`. Commit prefix "studio <area>: ", never generated files,
attribution lines at the end of every commit message:
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Kh8e8WFzY5uhWN3vnvSAzt
Do not spawn agents, do not push. Commit after every finished item. Hand-back: per item done/partly/not
(how, where), commits, tests, screenshots you looked at, your strict score for "would people love it" on
phone and desktop and what still stands between it and 10.
