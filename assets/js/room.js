/* Mitt rum: the customer's own room photo becomes the place where the whole shop is shown.
   - The photo is resized and kept in this browser only (localStorage), never uploaded.
   - Its colours and light are read once (k-means palette, brightness, warmth).
   - "The scene" is the set of products the customer has stood in the room, with position and size.
   - Every product card, product page and the room editor read from here.
   Sizes are approximate: verified product measurements do not exist yet, and the page says so. */
(function () {
  const RQ = window.RQ, S = RQ.shop, $ = RQ.$, $$ = RQ.$$, esc = RQ.esc, kr = S.kr;
  const KEY = "rumiq-myroom", SCENE = "rumiq-scene", MODE = "rumiq-roommode"; // MODE: the shop's old room mode, only cleared now
  const ls = S.store;
  // the size slider is read relative to the size the thing was put in at ("Storlek 100 %" at first, "Storlek 150 %" when made
  // half again as big), never as a bare number like 7.6, and in English when the site is
  const sizeWord = (pct) => { const t = `Storlek ${pct} %`; return (window.RQ_t && window.RQ_t(t)) || t; };
  const sizeText = (sz) => sz.setAttribute("aria-valuetext", sizeWord(Math.round(+sz.value / (+sz.dataset.base || +sz.value || 1) * 100)));
  let room = ls.get(KEY, null), blobUrl = null, hist = [], lastTag = "", lastAt = 0;
  const emit = (what) => document.dispatchEvent(new CustomEvent("rq-room", { detail: what }));
  // only a picture kept in this browser counts as a room; anything else in the storage is ignored
  if (!room || typeof room !== "object" || typeof room.img !== "string" || !(/^data:image\//.test(room.img) || (room.sample && /^assets\/img\/rum\/[a-z]+-\d+\.webp$/.test(room.img))) || !(+room.w > 0) || !(+room.h > 0)) room = null;
  if (room) { room.w = +room.w; room.h = +room.h; if (!Array.isArray(room.pal)) room.pal = []; room.pal = room.pal.filter((x) => x && /^#[0-9a-f]{6}$/i.test(x.hex)); }
  const FULL = "Webbläsarens lagring är full. Ta bort ett gammalt projekt under Sparat och försök igen.";

  /* Where things belong. A lamp stands on a table, a throw lies on the sofa, a print hangs on the wall and a
     rug lies on the floor. kind = where it goes, cm = the real width of what the cut-out shows, r = the
     cut-out's height / width. Widths are approximate until the suppliers' measurements are confirmed. A fourth value names a
     picture made for the room (the duvet set lies folded on the bed, not as the shop's stacked pile). */
  const KIND = {
    "glob-bordslampa-opalglas": ["surface", 20, 1.62], "lysa-keramiklampa": ["surface", 30.5, 1.11], "svamp-uppladdningsbar-lampa": ["surface", 17, 1.77],
    "skarbrada-ek-med-handtag": ["surface", 22, 1.84], "forradsburkar-glas-ek-3-pack": ["surface", 36, 0.74], "sand-keramikvas": ["surface", 17, 1.85],
    "tvalpump-stengods": ["surface", 26, 0.9], "glod-doftljus-keramik": ["surface", 9, 1.25], "stilla-ljusstake-massing-2-pack": ["surface", 12, 2.93],
    "skrivbordsorganisator-ek": ["surface", 30, 0.86], "vaffelhandduk-bomull": ["surface", 39, 0.64],
    "plad-ullblandning-havre": ["throw", 80, 0.84], "lin-kuddfodral": ["cushion", 88, 0.58], "vila-paslakanset-linne": ["bedding", 120, 0.231, "rum"],
    "affisch-linje-ekram": ["wall", 53, 1.3], "affisch-horisont-ekram": ["wall", 53, 1.3],
    "forvaringslada-filt": ["floor", 42, 0.81], "flatad-forvaringskorg": ["floor", 40, 1.19], "terrakottakruka-rafflad": ["floor", 36, 1.92],
    "strand-jutematta": ["rug", 230, 0.37], "dagsljus-linnegardin-2-pack": ["window", 60, 2.63],
  };
  const meta = (p) => KIND[p.handle] || [p.wall ? "wall" : "surface", p.wall ? 50 : 20, 1.2];
  const kindOf = (p) => meta(p)[0];
  const cutIn = (p) => (meta(p)[3] ? RQ.cut(p).replace(/\.webp$/, `-${meta(p)[3]}.webp`) : RQ.cut(p)); // the picture that stands in the room
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  /* The sample rooms are mapped by hand. A spot is [x, y, s]: x/y in % of the photo (y is where the thing
     stands) and s = how many % of the photo's width one metre is at that depth. Floor spots get s from the
     horizon h and the slope k. Rugs and curtains are [x, y, width, squash]. sun = the side the light comes from. */
  const MAPS = {
    vardagsrum: { h: 58, k: 0.91, sun: 1,
      surface: [[82, 68.6, 25], [73.6, 68.4, 25], [80.6, 68.2, 25]], busy: [[75.6, 79.3, 67.5]], // the side table ends at about 84.4; a mug stands at 75.6-79.3
      cushion: [[79.5, 64.5, 16.5], [66, 64.5, 16.5]], throw: [[62.4, 72.6, 17], [80, 72, 17]], bedding: [],
      wall: [[36, 50, 17], [23, 50, 17], [48, 52, 17]],
      floor: [[49.5, 82.5], [40, 84.5], [28, 88], [15, 86]],
      rug: [[45, 96, 50, 0.42]], window: [[93, 76.5, 15, 1.13]] }, // the curtain reaches the floor where the window wall meets it, its top above the picture
    sovrum: { h: 55, k: 0.95, sun: 1,
      surface: [[13.6, 70.6, 27], [19.5, 70, 27], [10, 70.2, 27]],
      cushion: [[29, 64, 20], [38, 62, 19]], throw: [[63, 71.5, 19], [47, 70, 19]], bedding: [[47, 69.5, 19], [60, 69, 19]],
      wall: [[50, 43, 15], [62, 43, 15], [40, 43, 15]],
      floor: [[87, 89], [77, 96], [45, 98], [60, 96]],
      rug: [[63, 99, 52, 0.4]], window: [[80.6, 74, 13.5, 1.12]] },
    kok: { h: 52, k: 0.58, sun: 1, // the only free floor is the passage to the right; the hob and the sink are not places to put things
      surface: [[70.6, 62.4, 26], [59.6, 62.2, 26], [23, 62.4, 26]],
      cushion: [], throw: [], bedding: [],
      wall: [[62, 38, 15], [49, 38, 15]],
      floor: [[81.5, 93], [88, 98]],
      rug: [[84, 99, 26, 0.5]], window: [[90.6, 97, 15, 1.33]] },
    hall: { h: 56, k: 0.9, sun: 1,
      surface: [[49, 67.6, 18.5], [59, 67.6, 18.5], [39, 67.6, 18.5], [4.8, 60.4, 30], [17.3, 58.9, 30]],
      cushion: [[42, 67.6, 18.5]], throw: [[57, 71, 18.5]], bedding: [[49, 67.6, 18.5]],
      wall: [[41, 47, 15.5], [27, 30, 15.5]],
      floor: [[24.5, 87], [47, 94], [66, 93], [33, 96]], // beside and in front of the bench, never through it
      rug: [[46, 98, 52, 0.4]], window: [[74.4, 83, 13, 1.27]] },
    badrum: { h: 45, k: 0.69, sun: 1, // the vanity beside the basin, the shelf and the window sill; the floor between the stool and the basket
      surface: [[37.6, 58.8, 34], [48.5, 33, 30], [79.5, 54, 28]],
      cushion: [], throw: [], bedding: [],
      wall: [[56, 64, 24]],
      floor: [[50, 97], [41, 98.5], [57, 99.5]],
      rug: [[50, 100, 40, 0.35]], window: [[76.5, 55, 11, 1.06]] },
    hemmakontor: { h: 45, k: 0.55, sun: 1, // the desk around what already stands there, the empty wall, the strip of floor
      surface: [[60.5, 62.5, 27], [77.5, 62.5, 27], [64, 67, 28]],
      cushion: [], throw: [], bedding: [],
      wall: [[28, 50, 25], [40, 50, 25], [16, 50, 25]],
      floor: [[22, 97], [36, 97], [10, 98], [47, 97.5]],
      rug: [[28, 100, 50, 0.3]], window: [[94.5, 100, 11, 1.6]] },
    uteliv: { h: 40, k: 0.64, sun: 1, // the bench's bare end, the side table, the seat; the deck in front of the bench
      surface: [[38, 62, 27], [65.5, 61, 27], [42.5, 62, 27]],
      cushion: [[55, 59.5, 27]], throw: [[84, 64, 26]], bedding: [],
      wall: [[39, 56, 25]],
      floor: [[38, 92], [52, 94], [24, 97]],
      rug: [[50, 100, 60, 0.35]], window: [[97, 100, 8, 1.6]] },
  };
  /* A room we have not seen before: sensible spots for each kind, until the customer shows where things stand. */
  // a photo from the doorway: tables and sofa seats are about mid-height, the wall above them; the first things land there, large enough to grab
  // nothing says where the tables are: things that stand on one go to the sides, where a side table stands by a sofa, never on the seat in the middle
  const GENERIC = { h: 48, k: 0.9, sun: 1,
    surface: [[86, 63, 38], [14, 63, 38]], cushion: [[50, 68, 24], [36, 68, 24]], throw: [[50, 76, 24], [40, 76, 24]], bedding: [[50, 70, 24]],
    wall: [[50, 40, 22], [30, 40, 22], [70, 40, 22]], floor: [[22, 92], [78, 92], [50, 94], [36, 90], [64, 90]],
    rug: [[50, 98, 56, 0.45]], window: [[86, 92, 15, 1]] };
  const FALLBACK = { cushion: ["throw", "floor"], throw: ["cushion", "floor"], bedding: ["throw", "cushion", "floor"], surface: ["floor"], wall: [], floor: [] };
  const LEARN = "rumiq-roomlearn";
  const mapOf = () => (room && MAPS[room.map || (room.sample ? room.type : "")]) || null;
  const floorScale = (y, M) => Math.max(6, (M || GENERIC).k * (y - (M || GENERIC).h));
  /* the spot a product gets when it is put in the room: by kind, and beside what already stands there.
     Only things of the same sort are in each other's way (a candle does not push a throw off the sofa), and a
     mapped surface has an end: when the table is full the next thing is put on the floor, never in the air. */
  const SORT = { surface: "s", cushion: "t", throw: "t", bedding: "t", floor: "f", rug: "r", window: "w", wall: "a", golv: "f", bord: "s", vagg: "a", sang: "t", soffa: "t" };
  /* What a thing stands on, in the customer's words (the selected-item panel: "Står på: bord"). it.on holds a choice made
     there, or the kind of spot a full table sent it to; without it, the thing's own kind decides. */
  const SURF = { golv: "golv", vagg: "vägg", bord: "bord", sang: "säng", soffa: "soffa" };
  const CAN = { surface: ["bord", "golv"], floor: ["golv", "bord"], cushion: ["soffa", "sang", "golv"], throw: ["soffa", "sang"], bedding: ["sang"], wall: ["vagg", "bord", "golv"], rug: ["golv"], window: ["vagg"] };
  const soft = () => (room && room.type === "sovrum" ? "sang" : "soffa");
  const surfOf = (it) => { const k = kindOf(RQ.byHandle(it.h)); if (SURF[it.on]) return it.on; return { surface: "bord", floor: "golv", rug: "golv", wall: "vagg", window: "vagg", bedding: "sang", cushion: soft(), throw: soft() }[it.on || k] || "bord"; };
  /* the kind of spot that surface means for this thing (where it is put, what it stands in front of) */
  const kindAt = (s, k) => ({ golv: k === "rug" ? "rug" : "floor", bord: "surface", vagg: k === "window" ? "window" : "wall", soffa: k === "cushion" || k === "throw" ? k : "throw", sang: k === "cushion" || k === "throw" || k === "bedding" ? k : "throw" })[s] || k;
  const effKind = (it) => { const k = kindOf(RQ.byHandle(it.h)); return SURF[it.on] ? kindAt(it.on, k) : it.on || k; };
  /* Your own photo, before you have shown where anything stands: the site does not know where the tables are, so nothing is
     put in mid-air. Things go in a tidy row on the floor near the front (a second row a little further back when it is
     full), "Står på: golv", and the room says "Dra sakerna dit du vill ha dem". A curtain hangs at the side, a rug lies at
     the front, as before. Once you have moved one thing of a kind, the next follows it (LEARN). */
  const ROWK = { surface: 1, floor: 1, cushion: 1, throw: 1, bedding: 1, wall: 1 }, ROWS = [82, 73];
  /* the room type is known: things for a table go on a likely table or counter at mid-height ("Står på: bord", one tap to
     change); a kitchen's jars, candlesticks and towel are never put on the floor */
  const TABLE_Y = 62, onTable = (k) => k === "surface" && room && !!room.type;
  /* a row is laid out again whenever something joins it: centred, evenly spread over a band a phone can show at once, the
     things made a little smaller if they would not fit (a second row behind when it is full) */
  const spreadRows = (list) => { if (!room || mapOf()) return list; const B = clamp(110 * room.h / room.w, 56, 92); let lo = 50 - B / 2, hi = 50 + B / 2;
    // a curtain hangs to the floor by the side: the row keeps clear of it
    const hung = new Map([...R.scene(), ...list].filter((it) => { const q = RQ.byHandle(it.h); return q && kindOf(q) === "window"; }).map((it) => [it.h, it]));
    hung.forEach((c) => { if (c.x < 50) lo = Math.max(lo, c.x + c.w / 2 + 1); else hi = Math.min(hi, c.x - c.w / 2 - 1); });
    if (hi - lo < 40) { lo = 50 - B / 2; hi = 50 + B / 2; } const band = hi - lo;
    [...new Set(list.filter((it) => it.row).map((it) => it.y))].forEach((y) => { const row = list.filter((it) => it.row && it.y === y).sort((a, b) => a.x - b.x), sum = row.reduce((t, it) => t + it.w, 0), k = Math.min(1, (band - 2 * (row.length + 1)) / Math.max(1, sum));
      row.forEach((it) => { it.w = +(it.w * k).toFixed(1); }); const used = row.reduce((t, it) => t + it.w, 0), gap = (band - used) / (row.length + 1); let x = lo + gap;
      row.forEach((it) => { it.x = +(x + it.w / 2).toFixed(1); x += it.w + gap; }); }); return list; };
  const spotFor = (p, list, raw, MX, over, row) => { // MX: a sample room's map instead of the customer's room (the look pictures); over: put it on another kind of spot; row: may start a row on the floor
    const [kind0, cm] = meta(p), kind = over || kind0, M = MX || mapOf(), G = M || GENERIC;
    // in your own photo a curtain hangs down to the floor, so nothing is put on the floor in front of it
    const busy = (x, y, w) => ((M && M.busy) || []).some(([a, b, yy]) => Math.abs(yy - y) < 4 && x + w * 0.32 > a && x - w * 0.32 < b); // something in the photo stands there
    const taken = (x, y, w, k) => busy(x, y, w) || list.some((it) => { const q = RQ.byHandle(it.h); return q && (SORT[it.on || kindOf(q)] === SORT[k || kind] || (!M && SORT[k || kind] === "f" && kindOf(q) === "window")) && Math.abs(it.y - y) < 7 && Math.abs(it.x - x) < Math.max(3, (it.w + w) * 0.42); });
    const L = (!M && !raw && ls.get(LEARN, {})) || {}, learned = L[kind];
    if (learned && isFinite(learned.x) && isFinite(learned.y)) {
      const w = clamp(kind === "rug" || kind === "window" ? learned.w : cm * learned.s / 100, 2.5, 96); let x = learned.x, n = 0;
      while ((taken(x, learned.y, w) || (n > 0 && (x < 3 || x > 97))) && n < 8) { n++; x = learned.x + (n % 2 ? 1 : -1) * Math.ceil(n / 2) * (w + 2.5); } // beside it, on the side where the picture goes on
      return { x: +clamp(x, 3, 97).toFixed(1), y: learned.y, w: +w.toFixed(1), sy: learned.sy };
    }
    // your own photo: the size you gave the first thing sets the scale for the rest. Before that, a photo taken on its
    // side shows less of the room across, so the same lamp is a larger share of its width
    const k = M ? 1 : L.k > 0 ? L.k : room ? clamp((1.5 * room.h / room.w) ** 0.7, 1, 1.8) : 1;
    if (row && !M && room && ROWK[kind]) { const band = clamp(110 * room.h / room.w, 56, 92), tbl = onTable(kind);
      for (const y of tbl ? [TABLE_Y] : ROWS) {
        const w = clamp(cm * (tbl ? 30 : floorScale(y)) / 100 * k, 4, 36), inRow = list.filter((it) => it.row && Math.abs(it.y - y) < 1), used = inRow.reduce((t, it) => t + it.w, 0);
        if (!inRow.length || used + w <= band * 0.92 || y === (tbl ? TABLE_Y : ROWS[ROWS.length - 1])) return { x: 50, y, w: +w.toFixed(1), row: true, table: tbl };
      } }
    const place = (kd) => {
      const spots = G[kd] && G[kd].length ? G[kd] : null; if (!spots) return null;
      if (kd === "rug" || kd === "window") { const sp = spots[0];
        // a curtain in your own photo is a tall panel by the side, from near the ceiling to the floor (80 % of the picture), whatever its shape
        if (kd === "window" && !M && room) { const w = clamp(80 / (meta(p)[2] * room.w / room.h), 8, 40); return { x: +Math.min(sp[0], 99 - w / 2).toFixed(1), y: sp[1], w: +w.toFixed(1), sy: sp[3] }; }
        return { x: sp[0], y: sp[1], w: sp[2], sy: sp[3] }; }
      const width = (sp) => clamp(cm * (sp[2] || floorScale(sp[1], M)) / 100 * k, 2.5, 70);
      const free = spots.find((sp) => !taken(sp[0], sp[1], width(sp), kd)); if (free) return { x: free[0], y: free[1], w: +width(free).toFixed(1) };
      // every mapped spot is taken: the free place on the same surface nearest to one of them (a second lamp goes to the
      // other end of the side table, not to the floor), as long as that is still on the surface
      for (const sp of spots) { const w = width(sp), row = spots.filter((o) => Math.abs(o[1] - sp[1]) < 4).map((o) => o[0]), lo = Math.max(M ? 3 : 2 + w / 2, Math.min(...row) - (M ? 1.5 - w * 0.22 : 30)), hi = Math.min(M ? 97 : 98 - w / 2, Math.max(...row) + (M ? 1.5 - w * 0.22 : 30)); // its foot stays on the surface (and in your own photo, all of it inside the picture)
        for (let d = 0.5; d <= hi - lo; d += 0.5) for (const x of [sp[0] + d, sp[0] - d]) if (x >= lo && x <= hi && !taken(x, sp[1], w, kd)) return { x: +x.toFixed(1), y: sp[1], w: +w.toFixed(1) }; }
      return null;
    };
    let sp = place(kind), moved = false;
    if (!sp) for (const fk of FALLBACK[kind] || []) { if ((sp = place(fk))) { moved = fk; break; } }
    if (!sp && M && kind !== "rug" && kind !== "window" && kind !== "wall" && G.floor && G.floor.length) { const f = G.floor[G.floor.length - 1]; sp = { x: f[0], y: f[1], w: +clamp(cm * floorScale(f[1], M) / 100, 2.5, 70).toFixed(1) }; moved = "floor"; } // nowhere left: on the floor, to be moved by hand
    if (!sp) { const roomy = (o) => Math.min(99, ...list.filter((it) => SORT[it.on || kindOf(RQ.byHandle(it.h))] === SORT[kind] || kindOf(RQ.byHandle(it.h)) === "window").map((it) => Math.abs(it.x - o[0])));
      const s0 = (G[kind] && G[kind].length && kind !== "rug" && kind !== "window" ? G[kind].slice().sort((a, b) => roomy(b) - roomy(a))[0] : G[kind] && G[kind][0]) || GENERIC[kind][0] || GENERIC.surface[0]; // full everywhere: where there is most room
      sp = kind === "rug" || kind === "window" ? { x: s0[0], y: s0[1], w: s0[2], sy: s0[3] } : { x: s0[0], y: s0[1], w: +clamp(cm * (s0[2] || floorScale(s0[1], M)) / 100 * k, 2.5, 70).toFixed(1) }; }
    return moved ? { ...sp, moved } : sp;
  };
  /* what stands behind what: rugs lowest, then curtains, wall, floor, textiles, things on tables */
  const RANK = { rug: 0, window: 1, wall: 2, bedding: 4, throw: 4, cushion: 5, floor: 6, surface: 6 };
  /* back to front: what lies on the floor is drawn before what stands on it */
  const orderOf = (list) => list.map((it, i) => { const zk = effKind(it); return { it, i, z: it.top ? 190 + i : it.back ? -9 + i / 100 : RANK[zk] * 10 + (it.y + (zk === "surface" ? 12 : 0)) / 12 }; }).sort((a, b) => a.z - b.z || a.i - b.i).map((x) => x.it);
  const PLACE = KIND, placeFor = (p) => spotFor(p, []);

  /* ---------------------------------------------------------------- real size
     "Känd längd i bilden": a line the customer draws over something of known length (a door, about 200 cm) and its
     length, kept with the photo (room.known, in % of the photo). From it, products whose text states their measurements
     (data.js size) are drawn at true scale. Perspective, simply and honestly: on the floor, a thing nearer the camera
     (lower in the picture) is bigger, in proportion to its distance below the horizon; a thing on a table, bed or sofa
     stands that much higher (a usual height, below); on the wall it is taken to be as far away as the line. Everything
     else keeps its approximate size, and the page says so. */
  const HS = { golv: 0, bord: 65, sang: 50, soffa: 45 }; // usual heights in cm of what a thing stands on (approximate)
  const sizeOf = (p) => (p && p.size && p.size.w > 0 ? p.size : null);
  const measures = (p) => { const z = sizeOf(p); return z ? `${z.w} × ${z.h || z.d} cm` : ""; };
  const k0 = () => { const K = room && room.known; if (!K || !(K.cm > 0)) return 0; return Math.hypot(K.x2 - K.x1, (K.y2 - K.y1) * room.h / room.w) / K.cm; }; // % of the photo's width per cm at the line
  const horizon = () => (mapOf() || GENERIC).h;
  const kAt = (it) => { const K = room.known, k = k0(), hz = horizon(), d0 = Math.max(K.y1, K.y2) - hz, s = surfOf(it);
    if (s === "vagg" || d0 < 6) return k; // on the wall: as far away as the line (a door is in a wall); a line at the horizon tells nothing of depth
    const a = Math.min(0.8, (HS[s] || 0) * k * (room.w / room.h) / d0); // how far above the floor it stands, in the picture
    return k * clamp((it.y - hz) / (d0 * (1 - a)), 0.3, 3); };
  /* a sample room knows its own scale: each mapped spot says how much of the picture's width a metre is there, and the
     floor's scale follows its horizon and slope. In % of the width per cm, at the thing's place */
  const mapScale = (it, M) => { const kd = kindAt(surfOf(it), kindOf(RQ.byHandle(it.h)));
    if (kd === "window") return Math.max(6, floorScale((M.window[0] || [0, it.y])[1], M)) / 100; // a curtain is as far away as the window wall's floor
    if (kd === "floor" || kd === "rug") return Math.max(6, floorScale(it.y, M)) / 100;
    const sp = (M[kd] || []).filter((x) => x.length >= 3); if (!sp.length) return Math.max(6, floorScale(it.y, M)) / 100;
    return sp.slice().sort((a, b) => Math.abs(a[1] - it.y) - Math.abs(b[1] - it.y))[0][2] / 100; };
  const scaleAt = (it) => { const M = mapOf(); return M ? mapScale(it, M) : k0() ? kAt(it) : 0; };
  /* the width (in % of the photo) a measured thing has at its place, or null */
  const trueW = (it) => { const p = RQ.byHandle(it.h), z = sizeOf(p), k = z && room ? scaleAt(it) : 0; if (!k) return null; const kind = kindOf(p);
    const w = kind === "rug" ? Math.max(z.w, z.d || 0) * k // a rug lies with its long side across the room
      : z.h && (kind === "wall" || kind === "window") ? z.h * k / (meta(p)[2] * (it.sy || 1)) // a print and a curtain by their height: a hung curtain is gathered
      : z.w * k;
    return clamp(+w.toFixed(1), 1, 96); };
  /* the floor a rug covers: front edge where it lies, back edge its depth further away (a camera of usual focal length) */
  const rugBack = (it) => { const p = RQ.byHandle(it.h), z = sizeOf(p), k = scaleAt(it), hz = horizon(); if (!z || !k) return null; const D = 78.5 / k, k2 = k * D / (D + Math.min(z.w, z.d || z.w));
    return { y: hz + (it.y - hz) * k2 / k, w: it.w * k2 / k }; };

  /* ---------------------------------------------------------------- colour */
  const hex2rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgb2hex = (c) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  const lab = ([r, g, b]) => {
    const f = (v) => { v /= 255; return v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92; };
    const [R, G, B] = [f(r), f(g), f(b)];
    let x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, y = R * 0.2126 + G * 0.7152 + B * 0.0722, z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
    const t = (v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
    x = t(x); y = t(y); z = t(z);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  };
  const dE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

  function analyse(img) {
    const W = 96, H = Math.max(1, Math.round(96 * (img.naturalHeight || img.height) / (img.naturalWidth || img.width)));
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const cx = cv.getContext("2d", { willReadFrequently: true }); cx.drawImage(img, 0, 0, W, H);
    const d = cx.getImageData(0, 0, W, H).data, px = [];
    for (let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2]]);
    let cs = [0.05, 0.25, 0.5, 0.75, 0.95].map((f) => px[Math.floor(f * (px.length - 1))].slice());
    const asg = new Array(px.length).fill(0);
    for (let it = 0; it < 9; it++) {
      px.forEach((p, i) => { let b = 0, bd = 1e9; cs.forEach((c, j) => { const dd = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (dd < bd) { bd = dd; b = j; } }); asg[i] = b; });
      cs = cs.map((c, j) => { let n = 0; const s = [0, 0, 0]; px.forEach((p, i) => { if (asg[i] === j) { n++; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; } }); return n ? s.map((v) => v / n) : c; });
    }
    const counts = cs.map((_, j) => asg.filter((a) => a === j).length);
    const pal = cs.map((c, j) => ({ hex: rgb2hex(c), n: counts[j] / px.length })).filter((x) => x.n > 0.02).sort((a, b) => b.n - a.n);
    const avg = [0, 1, 2].map((k) => px.reduce((s, p) => s + p[k], 0) / px.length);
    const light = (0.2126 * avg[0] + 0.7152 * avg[1] + 0.0722 * avg[2]) / 255;
    const warm = (avg[0] - avg[2]) / 255;
    return { pal, light, warm };
  }

  /* how well a product's colours sit with the room's colours: 0–100 */
  function match(p) {
    if (!room || !room.pal || !room.pal.length) return null;
    const P = room.pal.map((x) => ({ l: lab(hex2rgb(x.hex)), n: x.n }));
    const tones = (p.tone || []).slice(0, 3).map((h) => lab(hex2rgb(h)));
    if (!tones.length) return null;
    const ds = tones.map((t) => Math.min(...P.map((x) => dE(t, x.l) * (1.15 - Math.min(0.3, x.n)))));
    const avg = ds.reduce((a, b) => a + b, 0) / ds.length;
    return Math.max(20, Math.min(98, Math.round(112 - avg * 3.4)));
  }

  /* the products' light follows the room's light */
  const lightFilter = (extra = 100) => {
    if (!room) return "";
    const b = (0.84 + (room.light || 0.6) * 0.3) * extra / 100, w = Math.max(0, Math.min(0.25, (room.warm || 0) * 0.9));
    return `brightness(${b.toFixed(3)}) sepia(${w.toFixed(3)}) saturate(${(1 - w * 0.4).toFixed(3)})`;
  };

  const toBlobUrl = (dataUrl) => {
    try { const [h, b64] = dataUrl.split(","); const mime = h.match(/:(.*?);/)[1]; const bin = atob(b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return URL.createObjectURL(new Blob([u8], { type: mime })); }
    catch (e) { return dataUrl; }
  };

  /* ---------------------------------------------------------------- public API */
  const R = (RQ.room = {
    PLACE, placeFor, kindOf, cutIn, mapOf, match, lightFilter, analyse,
    has: () => !!room,
    get: () => room,
    url() { if (!room) return null; if (!/^data:/.test(room.img)) return room.img; if (!blobUrl) blobUrl = toBlobUrl(room.img); return blobUrl; }, // a sample room is its own file
    async saveImage(img, meta = {}) {
      await new Promise((r) => setTimeout(r, 0)); // the tap's own feedback is drawn first
      // a sample room is its own file: kept by its address (no drawing, no re-encoding, no large write), its colours read after the first drawing
      if (meta.src && /^assets\/img\/rum\/[a-z]+-\d+\.webp$/.test(meta.src)) return R._keep(meta.src, img.naturalWidth, img.naturalHeight, { pal: [], light: 0.6, warm: 0, later: img }, meta);
      const nw = img.naturalWidth || img.width, nh = img.naturalHeight || img.height, sw = Math.min(nw, Math.round(nh * 2.2)), sh = Math.min(nh, Math.round(nw * 2.2)), sx = Math.round((nw - sw) / 2), sy0 = Math.round((nh - sh) / 2);
      const max = 1600, k = Math.min(1, max / Math.max(sw, sh)); // long side about 1600 px, as JPEG
      const W = Math.round(sw * k), H = Math.round(sh * k);
      const cv = document.createElement("canvas"); cv.width = W; cv.height = H; cv.getContext("2d").drawImage(img, sx, sy0, sw, sh, 0, 0, W, H);
      return R._keep(cv.toDataURL("image/jpeg", 0.82), W, H, analyse(cv), meta, cv);
    },
    async _keep(data, W, H, a, meta, cv) {
      const next = { img: data, w: W, h: H, pal: a.pal, light: a.light, warm: a.warm, type: meta.type || null, name: meta.name || "", sample: !!meta.sample, map: meta.map || null, at: new Date().toISOString() };
      let ok = ls.set(KEY, next);
      if (!ok && cv) { data = cv.toDataURL("image/jpeg", 0.62); next.img = data; ok = ls.set(KEY, next); }
      if (!ok) { R.lastError = "Bilden fick inte plats i webbläsarens lagring. Ta bort gamla projekt under Sparat och försök igen."; if (!sheet.classList.contains("open")) RQ.toast(R.lastError); return false; }
      room = next; if (blobUrl && blobUrl.startsWith("blob:")) URL.revokeObjectURL(blobUrl); blobUrl = null; hist = []; // a new photo: the old steps belonged to the old room
      ls.del(LEARN);
      // what stood in the old room is put where it belongs in the new one
      const moved = []; R.scene().forEach((it) => { const sp = spotFor(RQ.byHandle(it.h), moved, false, null, null, true), n = { h: it.h, x: sp.x, y: sp.y, w: sp.w, w0: sp.w, ...(sp.sy && sp.sy !== 1 ? { sy: sp.sy } : {}), ...(sp.moved ? { on: sp.moved } : {}), ...(sp.row ? { row: true, on: sp.table ? "bord" : "golv" } : {}), flip: false, light: 100 };
        const tw = trueW(n); if (tw) { n.w = tw; n.real = true; } moved.push(n); }); spreadRows(moved);
      if (moved.length) ls.set(SCENE, moved);
      R._landRow = moved.some((it) => it.row); // the editor lets them land in their row, and shows the whole room
      emit("room");
      if (a.later) { const at = next.at, run = () => { if (!room || room.at !== at) return; const b = analyse(a.later); Object.assign(room, { pal: b.pal, light: b.light, warm: b.warm }); ls.set(KEY, room); emit("palette"); };
        (window.requestIdleCallback ? (f) => requestIdleCallback(f, { timeout: 1500 }) : (f) => setTimeout(f, 200))(() => requestAnimationFrame(() => setTimeout(run, 0))); }
      return true;
    },
    setType(t) { if (!room) return; room.type = t; ls.set(KEY, room); emit("type");
      // your own photo: now that the room is known, the things for a table in the floor row go up to a likely table ("Står på: bord")
      if (!mapOf() && t) { const list = R.scene(); let n = 0; list.forEach((it) => { const p = RQ.byHandle(it.h); if (it.row && it.on === "golv" && p && kindOf(p) === "surface") { it.y = TABLE_Y; it.on = "bord"; it.w = +clamp(meta(p)[1] * 0.3 * (ls.get(LEARN, {}).k || 1), 4, 36).toFixed(1); n++; } });
        if (n) { spreadRows(list); R.saveScene(list, true); } } },
    /* forget the room: the photo, what stands in it and everything the editor remembers */
    clear() { [KEY, SCENE, MODE, LEARN, "rumiq-room-night", "rumiq-room-landed", "rumiq-room-view"].forEach((k) => ls.del(k)); room = null; if (blobUrl && blobUrl.startsWith("blob:")) URL.revokeObjectURL(blobUrl); blobUrl = null; hist = []; emit("room"); emit("scene"); },
    /* scene */
    scene: () => { const l = ls.get(SCENE, []); return (Array.isArray(l) ? l : []).filter((it) => it && typeof it.h === "string" && RQ.byHandle(it.h) && isFinite(it.x) && isFinite(it.y) && it.w > 0); },
    /* false = the browser's storage is full and nothing was saved. Every change is a step that can be taken back;
       changes with the same tag in quick succession (a held arrow key, the wheel) are one step. */
    saveScene(list, keep, tag) { const before = ls.get(SCENE, []); const ok = ls.set(SCENE, list) !== false;
      if (ok && !keep) { const now = Date.now(); if (!(tag && tag === lastTag && now - lastAt < 1200)) { hist.push(before); if (hist.length > 30) hist.shift(); } lastTag = tag || ""; lastAt = now; }
      emit("scene"); return ok; },
    /* take back the last change (a removed thing, a move, a new size, "Inred åt mig"), one step at a time */
    canUndo: () => hist.length > 0,
    undo() { if (!hist.length) return false; const p = hist.pop(); lastTag = ""; ls.set(SCENE, p); emit("scene"); return true; },
    /* several changes as one step */
    group(fn) { const n = hist.length, before = ls.get(SCENE, []); let out; R._quiet = true; try { out = fn(); } finally { R._quiet = false; } if (hist.length > n) { hist.length = n; hist.push(before); } lastTag = ""; emit("scene"); return out; }, // the editor draws once, after all of them (so they land together)
    inScene: (h) => R.scene().some((it) => it.h === h),
    add(h, quiet, v) {
      const p = RQ.byHandle(h); if (!p) return false; RQ.track && RQ.track("studio_place", { item_id: h });
      const list = R.scene(); if (list.some((it) => it.h === h)) return false;
      const sp = spotFor(p, list, false, null, null, true);
      { const tw = trueW({ h, x: sp.x, y: sp.y, sy: sp.sy, on: sp.moved }); if (tw) { sp.w = tw; sp.real = true; // a known scale: true size from the start
          if (kindOf(p) === "window" && room) sp.y = +Math.min(sp.y, tw * meta(p)[2] * (sp.sy || 1) * room.w / room.h - 2).toFixed(1); } } // a curtain hangs from above the picture, a little above the floor if it is shorter than the room
      list.push({ h, x: sp.x, y: sp.y, w: sp.w, w0: sp.w, ...(v > 0 && (p.variants || [])[v] ? { v } : {}), ...(sp.real ? { real: true } : {}), ...(sp.row ? { row: true, on: sp.table ? "bord" : "golv" } : {}), ...(sp.sy && sp.sy !== 1 ? { sy: sp.sy } : {}), ...(sp.moved ? { on: sp.moved } : {}), flip: false, light: 100 });
      if (sp.row) spreadRows(list);
      if (!R.saveScene(list)) { RQ.toast(FULL); return false; }
      R.lastMoved = sp.moved ? h : null;
      if (!quiet && sp.moved) RQ.toast(`Där var det fullt, så ${esc(p.name)} står på golvet. Dra den dit du vill.`);
      else if (!quiet) RQ.toast(/^mitt-rum/.test((RQ.currentRoute && RQ.currentRoute()) || "") ? `${esc(p.name)} står nu i ${room && room.sample ? "rummet" : "ditt rum"}.` : `${esc(p.name)} står nu i ${room && room.sample ? "exempelrummet" : "ditt rum"}. <a href="#mitt-rum">Öppna</a>`);
      return true;
    },
    remove(h) { R.saveScene(R.scene().filter((it) => it.h !== h)); },
    toggle(h) { if (R.inScene(h)) { R.remove(h); return false; } R.add(h); return true; },
    // a thing at true scale keeps it wherever it is moved (nearer is bigger); a size you choose yourself takes it off (real: false)
    update(h, patch, tag) { R.saveScene(R.scene().map((it) => { if (it.h !== h) return it; const n = { ...it, ...patch }; if (n.real) { const w = trueW(n); if (w) n.w = w; else delete n.real; } return n; }), false, tag); },
    /* the known length: saved with the photo, then every measured thing in the room at true scale (one step for Ångra) */
    setKnown(K) { if (!room) return []; if (K) room.known = { x1: +K.x1.toFixed(2), y1: +K.y1.toFixed(2), x2: +K.x2.toFixed(2), y2: +K.y2.toFixed(2), cm: Math.round(K.cm) }; else delete room.known; ls.set(KEY, room);
      const done = []; const list = R.scene().map((it) => { const w = trueW(it); if (w) { done.push(it.h); return { ...it, w, real: true }; } const { real, ...rest } = it; return rest; });
      R.saveScene(list); emit("known"); return done; },
    trueW: (h) => { const it = R.scene().find((x) => x.h === h); return it ? trueW(it) : null; },
    measures: (h) => measures(RQ.byHandle(h)),
    toFront(h) { const l = R.scene(); const i = l.findIndex((it) => it.h === h); if (i < 0) return; const it = l.splice(i, 1)[0]; it.top = true; delete it.back; l.push(it); R.saveScene(l); },
    toBack(h) { const l = R.scene(); const i = l.findIndex((it) => it.h === h); if (i < 0) return; const it = l.splice(i, 1)[0]; it.back = true; delete it.top; l.unshift(it); R.saveScene(l); },
    /* everything in the room into the cart, once: what already lies there is left as it is. Products with colours ask first. */
    cartAll(btn, chosen) {
      const list = R.scene(); if (!list.length || (btn && btn.hasAttribute("data-open-cart"))) return; // all of it lies there: the button opens the cart
      const inCart = new Set(S.cartLines().map((l) => l.product.handle)), todo = list.filter((it) => !inCart.has(it.h));
      if (!todo.length) { RQ.toast('Allt i rummet ligger redan i varukorgen. <a href="#" data-open-cart>Visa</a>'); return; }
      const ask = todo.filter((it) => (RQ.byHandle(it.h).variants || []).length > 1 && it.v == null);
      if (ask.length && !chosen) { R.openVariants(ask.map((it) => it.h), (pick) => R.cartAll(btn, pick)); return; }
      todo.forEach((it) => S.addToCart(it.h + "::" + ((chosen && chosen[it.h] != null ? chosen[it.h] : it.v) || 0), 1));
      const n = S.cartLines().filter((l) => todo.some((it) => it.h === l.product.handle)).length;
      if (!n) { RQ.toast("Det gick inte att lägga sakerna i varukorgen. Försök igen."); return; }
      RQ.confirmAdd(btn, "");
      RQ.toast(`${n === 1 ? "1 produkt" : n + " produkter"} från ${room && room.sample ? "rummet" : "ditt rum"} ${n === 1 ? "ligger" : "ligger"} i varukorgen${todo.length < list.length ? ", resten låg redan där" : ""}. <a href="#" data-open-cart>Visa</a>`);
    },
    total: () => R.scene().reduce((s, it) => s + RQ.byHandle(it.h).price, 0),
    /* Byt: what can take this thing's place (the same kind of thing, for the same surface), best colour match first */
    alternatives(h) { const p = RQ.byHandle(h); if (!p) return []; const have = new Set(R.scene().map((it) => it.h));
      // a lamp for a lamp or a candle, a textile for a textile, a print for a print, a rug for a rug, a thing on the table or the floor for the same
      const grp = (q) => { const k = kindOf(q); return q.cat === "belysning-atmosfar" && (k === "surface" || k === "floor") ? "ljus" : ["cushion", "throw", "bedding"].includes(k) ? "textil" : k; };
      return RQ.PRODUCTS.filter((q) => q.handle !== h && !have.has(q.handle) && grp(q) === grp(p))
        .map((q) => ({ q, m: (match(q) || 60) + (room && room.type && q.rooms.includes(room.type) ? 20 : 0) })).sort((a, b) => b.m - a.m).map((x) => x.q).slice(0, 8); },
    /* the thing at h, as "to" (another product, or the same one in colour v), in its place: the same spot, the same
       scale (true size when measured), the same surface. One step for Ångra. */
    swapWith(h, to, v) { const list = R.scene(), i = list.findIndex((it) => it.h === h); if (i < 0) return false; const it = list[i], p = RQ.byHandle(h), q = RQ.byHandle(to || h); if (!q) return false;
      if (q.handle !== h && list.some((x) => x.h === q.handle)) return false;
      const n = { ...it, h: q.handle }; if (v > 0 && (q.variants || [])[v]) n.v = v; else delete n.v;
      if (q.handle !== h) { const r = meta(p)[1] > 0 ? meta(q)[1] / meta(p)[1] : 1; n.w = +clamp(it.w * r, 1, 96).toFixed(1); n.w0 = +clamp((it.w0 || it.w) * r, 1, 96).toFixed(1); delete n.sy; const sp = spotFor(q, [], true); if (sp.sy && sp.sy !== 1) n.sy = sp.sy; delete n.real;
        if (SURF[it.on] && !(CAN[kindOf(q)] || []).includes(it.on)) delete n.on; const tw = trueW(n); if (tw) { n.w = tw; n.real = true; } }
      list[i] = n; R._swapped = { from: h, to: q.handle }; return R.saveScene(list); },
    /* a colour other than the one the picture shows: the cut-out takes the colour's tone (approximate, and said so) */
    tint: (it) => { const p = RQ.byHandle(it.h); return it.v > 0 && p && (p.variants || [])[it.v] ? p.tone[it.v] || null : null; },
    /* a ready set from the range for this room: style and budget (Inred åt mig). Uses the same proposal as Mitt hem when it is there.
       Honest by construction (studio2 review M2, M3): the set is first made whole for the room and the style (strictly in the
       style), without what already stands there (not part of a set) and without table things that have no free table here
       (noRoom: never on the open floor). That whole set is "Hela rummet", and its size is the one number "X av N" counts
       against at every budget; a budget then takes what fits, in the set's order, skipping what is too dear. */
    suggestSet({ style = null, budget = null, avoid = [] } = {}) {
      const t = (room && room.type) || "vardagsrum", base = R.scene().filter((it) => !it.sg), have = new Set(base.map((it) => it.h));
      const ok = (q) => q && !have.has(q.handle) && (!style || q.styles.includes(style));
      let cand = [];
      const pr = RQ.hem && RQ.hem.propose ? RQ.hem.propose({ type: t, style, avoid: [...avoid, ...have] }) : null;
      if (pr) cand = pr.items.map((it) => RQ.byHandle(it.h)).filter(ok);
      else cand = R.suggest(6).filter(ok);
      // a style with few things for this room: more of the same style that belongs in the room, up to six
      if (cand.length < 6) RQ.PRODUCTS.filter((q) => ok(q) && q.rooms.includes(t) && !cand.includes(q) && !avoid.includes(q.handle)).sort((a, b) => a.price - b.price)
        .forEach((q) => { if (cand.length < 6 && cand.filter((c) => c.cat === q.cat).length < 2) cand.push(q); });
      if (!cand.length && avoid.length) return R.suggestSet({ style, budget }); // every other set has been shown: start over
      // where each would stand, in order: a table thing with no table free is left out (said, not put on the floor)
      const sim = base.map((it) => ({ ...it })), fit = [], noRoom = [];
      cand.forEach((q) => { const sp = spotFor(q, sim, false, null, null, true), k = kindOf(q);
        if (sp.moved === "floor" && k !== "floor" && k !== "rug") { noRoom.push(q.handle); return; }
        sim.push({ h: q.handle, x: sp.x, y: sp.y, w: sp.w, ...(sp.moved ? { on: sp.moved } : {}) }); fit.push(q); });
      const items = [], left = []; let sum = 0;
      fit.forEach((q) => { if (!budget || sum + q.price <= budget) { items.push({ h: q.handle, v: 0 }); sum += q.price; } else left.push(q.handle); });
      return { items, left, noRoom, total: sum, fullTotal: fit.reduce((s, q) => s + q.price, 0), min: fit.length ? Math.min(...fit.map((q) => q.price)) : 0, count: fit.length, style: RQ.STYLES[style] ? style : null }; },
    /* a table thing that ended up on the open floor because no table had room (a sample room's last resort) */
    homeless: (it) => { const q = RQ.byHandle(it.h); return !!(q && it.on === "floor" && !["floor", "rug"].includes(kindOf(q))); },
    ordered() { return orderOf(R.scene()); },
    /* a sample room with these things placed in it, the way Mitt rum would place them: for the look pictures.
       layer = the things, to lie over the photo (in % of the photo); spots = where each one stands, for its dot */
    compose(id, handles) {
      const M = MAPS[id], ar = 1600 / 893; if (!M) return null; // every sample photo is 1600 x 893
      const list = [];
      handles.forEach((h) => { const p = RQ.byHandle(h); if (!p) return; const sp = spotFor(p, list, true, M); list.push({ h, x: sp.x, y: sp.y, w: sp.w, ...(sp.sy && sp.sy !== 1 ? { sy: sp.sy } : {}), ...(sp.moved ? { on: sp.moved } : {}) }); });
      if (!list.length) return null;
      const items = orderOf(list).map((it, i) => { const p = RQ.byHandle(it.h), r = meta(p)[2];
        return `<div class="rm-item k-${kindOf(p)}${p.cat === "belysning-atmosfar" ? " lamp" : ""}" style="left:${it.x}%;top:${it.y}%;width:${it.w}%;z-index:${i + 1}"><img src="${cutIn(p)}" alt="" decoding="async" style="${it.sy ? `aspect-ratio:1 / ${(r * it.sy).toFixed(3)};` : ""}"></div>`; }).join("");
      const hOf = (it) => it.w * meta(RQ.byHandle(it.h))[2] * (it.sy || 1) * ar; // height in % of the photo's height
      // each dot on its own thing: the middle of it, a lamp's dot on its body, and never on something standing in front of it.
      // [h, x, y, own, top, bottom, width] in % of the photo; a thing too small to carry a dot gets it on its top edge (hotspots.layout)
      const ord = orderOf(list), rect = (it) => { const h = hOf(it); return [it.x - it.w / 2, it.y - h, it.x + it.w / 2, it.y]; };
      const spots = list.map((it) => { const [l, t, r, bt] = rect(it), h = bt - t, front = ord.slice(ord.indexOf(it) + 1).map(rect);
        const tries = [[it.x, bt - h * (/lampa/.test(it.h) ? 0.3 : 0.5)], [l + (r - l) * 0.8, t + h * 0.5], [l + (r - l) * 0.2, t + h * 0.5], [it.x, t + h * 0.22]];
        const [x, y] = tries.find(([x, y]) => !front.some((f) => x > f[0] && x < f[2] && y > f[1] && y < f[3])) || tries[0];
        return [it.h, +x.toFixed(1), +y.toFixed(1), true, +t.toFixed(1), +bt.toFixed(1), it.w]; });
      const box = [Math.min(...list.map((it) => it.x - it.w / 2)), Math.min(...list.map((it) => it.y - hOf(it))), Math.max(...list.map((it) => it.x + it.w / 2)), Math.max(...list.map((it) => it.y))];
      return { box, layer: `<div class="rc-layer" aria-hidden="true"><div class="rc-box"><div class="rm-items">${items}</div></div></div>`, spots };
    },
    /* how well the things in the room go together (style and colour), with one piece of advice */
    harmony() {
      const ps = R.scene().map((it) => RQ.byHandle(it.h)); if (ps.length < 2) return null;
      let sum = 0, n = 0;
      for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
        const shared = ps[i].styles.filter((x) => ps[j].styles.includes(x)).length;
        const td = Math.min(...ps[i].tone.flatMap((a) => ps[j].tone.map((b) => { const A = hex2rgb(a), B = hex2rgb(b); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); })));
        sum += Math.min(1, shared / 2) * 0.6 + Math.max(0, 1 - td / 160) * 0.4; n++;
      }
      const raw = (sum / n) * 100, score = Math.round(clamp((raw - 45) * 1.9, 4, 100)); // 45 = clearly mixed, 97 = made for each other
      const word = score >= 72 ? "Samspelt" : score >= 40 ? "Hänger ihop" : "Spretigt";
      const top = Object.keys(RQ.STYLES).map((k) => [k, ps.filter((p) => p.styles.includes(k)).length]).sort((a, b) => b[1] - a[1])[0][0];
      let tip = `Lutar mot ${RQ.STYLES[top].name.toLowerCase()} stil.`;
      if (!ps.some((p) => p.cat === "belysning-atmosfar")) tip += " Lägg gärna till en lampa, ljuset får allt annat att synas.";
      else if (!ps.some((p) => /lin|ull/.test(S.norm(p.material)))) tip += " En textil i lin eller ull gör helheten mjukare.";
      else if (score < 40) tip += " Färgerna drar åt olika håll. Byt en sak mot något i samma ton som resten.";
      else if (score >= 72) tip += " Färgerna och stilarna går fint ihop.";
      return { score, word, tip };
    },
    /* the room in words: its light and colours, what suits it and one tip */
    read() {
      if (!room || !room.pal) return null;
      const l = room.light ?? 0.6, w = room.warm ?? 0;
      const bright = l > 0.62 ? "Ljust" : l > 0.42 ? "Mellanljust" : "Mörkt", temp = w > 0.06 ? "varma" : w < -0.02 ? "svala" : "neutrala";
      const mats = w > 0.1 && l < 0.6 ? "Ull, terrakotta och mörkare trä" : w > 0.05 ? "Trä, lin och keramik" : l > 0.6 ? "Ljust trä, lin och opalglas" : "Ek, ull och keramik";
      const tip = l < 0.45 ? "Rummet är ganska mörkt. Lampor med opal- eller textilskärm lyfter det." : w < -0.02 ? "Färgerna är svala. Trä, ull eller terrakotta ger värme utan att du behöver måla om."
        : l > 0.65 ? "Ljust och lugnt. En mörkare detalj ger rummet djup." : "Upprepa en av rummets färger i en textil eller kruka, så hänger allt ihop.";
      return { pal: room.pal.slice(0, 5).map((x) => x.hex), text: `${bright} rum med ${temp} färger. ${mats} passar.`, tip };
    },
    /* rule-based suggestions: the room's type and colours, one product per category */
    suggest(n = 4) {
      const have = new Set(R.scene().map((it) => it.h)), cats = new Set(R.scene().map((it) => RQ.byHandle(it.h).cat));
      // a sample photo already shows some things (the shop's dots in it): a second pump or box beside them comes last,
      // and only so that Inred åt mig always gives at least two things
      const shown = new Set(((room && room.sample && RQ.HOTSPOTS && RQ.HOTSPOTS[room.map]) || { spots: [] }).spots.map((x) => x[0]));
      const shy = { window: 14, bedding: room && room.type === "sovrum" ? 4 : 30 }; // kinds that are harder to make look right come later
      const all = RQ.PRODUCTS.filter((p) => !have.has(p.handle) && (!room || !room.type || p.rooms.includes(room.type)))
        .map((p) => ({ p, s: (match(p) || 70) + (p.featured ? 4 : 0) - (shy[kindOf(p)] || 0) })).sort((a, b) => b.s - a.s);
      const pool = all.filter((x) => !shown.has(x.p.handle)), more = all.filter((x) => shown.has(x.p.handle));
      if (pool.length < 2) pool.push(...more.slice(0, 2 - pool.length));
      const out = [];
      for (const { p } of pool) { if (out.length >= n) break; if (cats.has(p.cat)) continue; cats.add(p.cat); out.push(p); }
      for (const { p } of pool) { if (out.length >= n) break; if (!out.includes(p)) out.push(p); }
      return out;
    },
    thumb: () => (room ? `<img src="${R.url()}" alt="">` : ""),
  });

  /* ---------------------------------------------------------------- setup sheet: take or choose the photo
     The sample rooms are free to try. Your own photo needs an account: the sheet asks you to sign in first and
     remembers the step you were on, what you were about to put in the room and the photo if you had already picked
     one, so you come back to the same step with everything still chosen (resumeGate below).
     Any photo goes: JPG, PNG, WebP and iPhone's HEIC/HEIF (a decoder is fetched only when such a file is chosen),
     turned the right way up, trimmed to a useful shape and kept at most 1600 px on the long side. */
  const TYPES = [["vardagsrum", "Vardagsrum"], ["sovrum", "Sovrum"], ["kok", "Kök"], ["badrum", "Badrum"], ["hall", "Hall"], ["hemmakontor", "Hemmakontor"], ["uteliv", "Uteliv"]];
  const LEAD = "Ta en bild av rummet du vill inreda. Sedan ställer du in produkterna där du vill ha dem.";
  const sheet = document.createElement("div");
  sheet.className = "sheet roomsheet"; sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-modal", "true"); sheet.setAttribute("aria-labelledby", "roomSheetTitle");
  sheet.innerHTML = `<div class="sheet-scrim" data-sheet-close></div><div class="sheet-card"><span class="sheet-grip" aria-hidden="true"></span>
    <button class="iconbtn sheet-x" type="button" data-sheet-close aria-label="Stäng"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    <p class="sheet-hello" role="status" hidden></p>
    <h2 id="roomSheetTitle" tabindex="-1">Lägg in ditt rum</h2>
    <p class="lead" id="roomSheetLead">${LEAD}</p>
    <div class="sheet-main">
      <div class="sheet-acts">
        <label class="btn cam"><svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>Ta en bild<input type="file" accept="image/*" capture="environment" class="sr" data-room-file></label>
        <label class="btn ghost"><svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="1.5"/><path d="M4 16l5-5 4 4 3-3 4 4"/></svg>Välj en bild<input type="file" accept="image/*,.heic,.heif" class="sr" data-room-file></label>
      </div>
      <p class="small sheet-tip" data-tip-touch>Ställ dig i dörröppningen och ta bilden i dagsljus, gärna på bredden så att hela rummet kommer med.</p>
      <p class="small sheet-tip" data-tip-desk hidden>Du kan också dra hit en bild eller klistra in den. Bäst blir en bild i dagsljus där hela rummet syns.</p>
    </div>
    <div class="sheet-check" hidden><img class="sheet-shot" alt="Bilden du valde"><div class="sheet-two"><button type="button" class="btn" data-check-use>Använd ändå</button><button type="button" class="btn ghost" data-check-other>Välj en annan</button></div></div>
    <div class="sheet-gate" hidden>
      <p class="sheet-wait" hidden><img class="sheet-shot" alt="Bilden du valde"><span>Bilden väntar här medan du loggar in.</span></p>
      <div class="sheet-two"><a class="btn" href="#konto" data-room-gate>Logga in</a><a class="btn ghost" href="#skapa-konto" data-room-gate>Skapa gratis konto</a></div>
      <div class="sso-list sheet-sso" hidden></div>
    </div>
    <p class="sheet-err" role="alert" hidden></p>
    <h3 data-samples-h>Eller prova med ett exempelrum</h3>
    <div class="sheet-samples">${RQ.SAMPLE_ROOMS.map((r) => `<button type="button" data-room-sample="${r.img}" data-type="${r.id}"><img src="${r.img.replace("-1600", "-600")}" alt="" loading="lazy"><span>${esc(r.name)}</span></button>`).join("")}</div>
    <h3 data-room-type-h>Vilket rum är det?</h3>
    <div class="chips" data-room-type>${TYPES.map(([id, n]) => `<button type="button" class="chip" data-v="${id}" aria-pressed="false">${n}</button>`).join("")}</div>
    <p class="small sheet-priv"><svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="1.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>Bilden sparas bara i din webbläsare. Den skickas till oss först om du själv väljer att skapa en AI-bild.</p>
    <div class="sheet-busy" hidden><span class="spin"></span>Läser in bilden</div>
  </div>`;
  document.body.appendChild(sheet);
  let after = null, plan = null, chosenType = null, back = null, held = null; // held: the photo that waits for "Använd ändå", or for you to sign in
  const busy = (on) => ($(".sheet-busy", sheet).hidden = !on);
  const fail = (msg) => { const e = $(".sheet-err", sheet); e.textContent = msg || ""; e.hidden = !msg; if (msg) $(".sheet-card", sheet).scrollTop = 0; };
  const hello = (msg) => { const h = $(".sheet-hello", sheet); h.textContent = msg || ""; h.hidden = !msg; };
  /* what the sheet shows: "main" (take or choose), "check" (the photo is dark or small) or "gate" (sign in first) */
  const mode = (m, t) => { sheet.dataset.mode = m;
    $(".sheet-main", sheet).hidden = m !== "main"; $(".sheet-check", sheet).hidden = m !== "check"; $(".sheet-gate", sheet).hidden = m !== "gate";
    $("#roomSheetTitle", sheet).textContent = t ? t[0] : m === "gate" ? "Logga in för att lägga in ditt rum" : room ? "Byt rum" : "Lägg in ditt rum";
    $("#roomSheetLead", sheet).textContent = t ? t[1] : m === "gate" ? "Ett gratis konto behövs för att lägga in en bild av ditt eget rum. Allt du har valt finns kvar när du kommer tillbaka." : LEAD;
    $("[data-samples-h]", sheet).textContent = m === "gate" ? "Exempelrummen kan du prova utan konto" : "Eller prova med ett exempelrum";
    $(".sheet-card", sheet).scrollTop = 0; };
  /* then: what happens once the room is in (a closure). plan: the same thing written down ({ add: [handles], go: "#route" }),
     so it can wait while you sign in, when a closure would be lost with the page */
  R.openSetup = (then, pl) => {
    after = then || null; plan = pl || null; back = document.activeElement; held = null;
    chosenType = room && !room.sample ? room.type : null; // a sample room's type does not follow to your own photo
    $$("[data-room-type] [data-v]", sheet).forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === chosenType));
    const own = !!(room && !room.sample); $("[data-room-type-h]", sheet).hidden = !own; $("[data-room-type]", sheet).hidden = !own; // the room type is asked about a photo you have, not before (a new photo is asked in the editor)
    const touch = matchMedia("(pointer:coarse)").matches;
    $(".cam", sheet).hidden = !touch; $("[data-tip-touch]", sheet).hidden = !touch; $("[data-tip-desk]", sheet).hidden = touch;
    $(".sheet-acts .btn:not(.cam)", sheet).classList.toggle("ghost", touch); // on a computer "Välj en bild" is the one main button
    fail(""); hello(""); busy(false); mode("main"); sheet.classList.add("open"); document.documentElement.style.overflow = "hidden";
    setTimeout(() => $(".sheet-x", sheet).focus(), 60);
  };
  const close = () => { sheet.classList.remove("open"); document.documentElement.style.overflow = ""; held = null; if (back && back.focus) back.focus({ preventScroll: true }); };
  R.closeSetup = close;
  const done = async (img, meta) => {
    busy(true); fail("");
    const ok = await R.saveImage(img, { ...meta, type: chosenType || meta.type || null });
    busy(false); if (!ok) { fail(R.lastError || "Bilden gick inte att spara. Försök igen."); return; }
    close();
    const cb = after; after = null;
    if (cb) cb();
    else if (/^(mitt-rum|studio(-rum|-analys|-kombinera)?$)/.test((RQ.currentRoute && RQ.currentRoute()) || "")) { RQ.router(); scrollTo(0, 0); if (room.sample || !R.scene().length) RQ.toast(room.sample ? "Klart. Här är exempelrummet." : "Klart. Här är ditt rum."); } // the editor is drawn with the new photo
    else RQ.toast('Klart. Ditt rum är inlagt. <a href="#mitt-rum">Öppna Mitt rum</a>');
  };

  /* ---- reading a photo */
  const isHeic = (f) => /hei[cf]/i.test(f.type || "") || /\.(heic|heif)$/i.test(f.name || "");
  let heicLib = null; // iPhone photos on a browser that cannot open them: a decoder (heic2any, MIT) fetched the first time one is chosen
  const loadHeic = () => heicLib || (heicLib = new Promise((ok, bad) => { const s = document.createElement("script"); s.src = "assets/vendor/heic2any.js"; s.onload = () => (window.heic2any ? ok(window.heic2any) : bad()); s.onerror = () => { heicLib = null; bad(); }; document.head.appendChild(s); }));
  const loadImg = (blob) => new Promise((ok, bad) => { const u = URL.createObjectURL(blob), im = new Image(); im.decoding = "async"; im.onload = () => { ok(im); setTimeout(() => URL.revokeObjectURL(u), 4000); }; im.onerror = () => { URL.revokeObjectURL(u); bad(new Error("decode")); }; im.src = u; });
  /* the camera's own note of which way is up (EXIF orientation 1–8), read from the start of a JPEG */
  const exifTurn = async (f) => { try {
      const v = new DataView(await f.slice(0, 131072).arrayBuffer()); if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return 1; let o = 2;
      while (o + 10 < v.byteLength) { const m = v.getUint16(o);
        if (m === 0xffe1 && v.getUint32(o + 4) === 0x45786966) { const t = o + 10, le = v.getUint16(t) === 0x4949, d = t + v.getUint32(t + 4, le), n = v.getUint16(d, le);
          for (let i = 0; i < n; i++) { const e = d + 2 + i * 12; if (v.getUint16(e, le) === 0x0112) return v.getUint16(e + 8, le) || 1; } return 1; }
        if ((m & 0xff00) !== 0xff00 || m === 0xffda) return 1; o += 2 + v.getUint16(o + 2); }
    } catch (e) {} return 1; };
  // browsers that know CSS image-orientation already show and draw photos the right way up; older ones get turned here
  const turnsByItself = () => !!(window.CSS && CSS.supports && CSS.supports("image-orientation", "from-image"));
  const upright = (im, o) => { const w = im.naturalWidth || im.width, h = im.naturalHeight || im.height, k = Math.min(1, 3200 / Math.max(w, h)), W = Math.round(w * k), H = Math.round(h * k), side = o > 4;
    const cv = document.createElement("canvas"); cv.width = side ? H : W; cv.height = side ? W : H; const cx = cv.getContext("2d");
    const T = { 2: [-1, 0, 0, 1, W, 0], 3: [-1, 0, 0, -1, W, H], 4: [1, 0, 0, -1, 0, H], 5: [0, 1, 1, 0, 0, 0], 6: [0, 1, -1, 0, H, 0], 7: [0, -1, -1, 0, H, W], 8: [0, -1, 1, 0, 0, W] }[o];
    if (T) cx.setTransform(...T); cx.drawImage(im, 0, 0, W, H); return cv; };
  const readPhoto = async (f) => {
    let im = null; try { im = await loadImg(f); } catch (e) {}
    // the browser cannot open it: only a real HEIC/HEIF file (it says "ftyp" near its start) fetches the decoder
    if (!im && isHeic(f) && new TextDecoder().decode(await f.slice(4, 8).arrayBuffer()) === "ftyp") { const dec = await loadHeic(); const out = await dec({ blob: f, toType: "image/jpeg", quality: 0.92 }); im = await loadImg(Array.isArray(out) ? out[0] : out); }
    if (!im) throw new Error("decode");
    const o = !isHeic(f) && !turnsByItself() ? await exifTurn(f) : 1;
    const cv = upright(im, o), long = Math.max(im.naturalWidth, im.naturalHeight), a = analyse(cv);
    return { cv, small: long < 800, dark: a.light < 0.3 };
  };
  const shot = (cv) => { const k = Math.min(1, 640 / Math.max(cv.width, cv.height)), c = document.createElement("canvas"); c.width = Math.round(cv.width * k); c.height = Math.round(cv.height * k); c.getContext("2d").drawImage(cv, 0, 0, c.width, c.height); return c.toDataURL("image/jpeg", 0.8); };
  /* a picture is in: a dark or small one gets a friendly word first, then you sign in (if you have not), then it becomes the room */
  const takeFile = async (f) => {
    if (!f) return;
    if (!/^image\//.test(f.type) && !isHeic(f)) { fail("Det där är ingen bild. Välj ett foto, till exempel JPG, PNG eller HEIC."); return; }
    busy(true); fail(""); let ph;
    try { ph = await readPhoto(f); }
    catch (e) { busy(false); fail(isHeic(f) ? "Den här HEIC-bilden gick inte att läsa. Spara den som JPG eller ta en ny bild här." : "Bilden gick inte att läsa. Prova en JPG eller PNG."); return; }
    busy(false);
    if (ph.dark || ph.small) { held = ph; $(".sheet-check .sheet-shot", sheet).src = shot(ph.cv);
      mode("check", ph.dark && ph.small ? ["Bilden är ganska mörk och liten.", "Ett ljusare och större foto ger en mer verklighetstrogen bild."] : ph.dark ? ["Bilden är ganska mörk.", "Ett ljusare foto ger en mer verklighetstrogen bild."] : ["Bilden är ganska liten.", "En större bild ger ett skarpare rum."]);
      setTimeout(() => $("#roomSheetTitle", sheet).focus({ preventScroll: true }), 60); return; }
    use(ph);
  };
  const use = (ph) => { held = null; if (!S.customer()) { gate(ph); return; } done(ph.cv, { name: "Mitt rum" }); };

  /* ---- the gate: your own photo needs an account */
  const GATE = "rumiq-room-gate", GATE_IMG = "rumiq-room-gate-img";
  const routeNow = () => (RQ.currentRoute && RQ.currentRoute()) || "hem";
  let waiting = null, from = "hem"; // the photo you picked before signing in (small enough for the tab's storage), and the page you were on
  const gate = (ph) => {
    waiting = ph ? (() => { const k = Math.min(1, 1600 / Math.max(ph.cv.width, ph.cv.height)), c = document.createElement("canvas"); c.width = Math.round(ph.cv.width * k); c.height = Math.round(ph.cv.height * k); c.getContext("2d").drawImage(ph.cv, 0, 0, c.width, c.height); return c.toDataURL("image/jpeg", 0.85); })() : null;
    const w = $(".sheet-wait", sheet); w.hidden = !waiting; if (waiting) $("img", w).src = waiting;
    from = routeNow(); $$("[data-room-gate]", sheet).forEach((a) => (a.dataset.after = from));
    mode("gate"); fail("");
    const sso = $(".sheet-sso", sheet); sso.hidden = true; sso.innerHTML = "";
    // Google, Apple and Microsoft in one tap, once the sign-in server has said which are switched on
    if (RQ.auth) RQ.auth.start().then(() => { if (sheet.dataset.mode !== "gate" || RQ.auth.mode !== "supabase" || !RQ.auth.socials.length) return; sso.innerHTML = RQ.socialButtons("Fortsätt"); sso.hidden = false; }, () => {});
    setTimeout(() => $("#roomSheetTitle", sheet).focus({ preventScroll: true }), 60); // the new title is read out; Logga in is the next stop
  };
  /* the moment you leave to sign in: the step, what you were about to put in the room, the room type and the photo */
  const keepGate = () => {
    const st = { at: Date.now(), route: from, plan: plan || (after ? { go: "#mitt-rum" } : null), type: chosenType || null, photo: false };
    if (waiting) { try { sessionStorage.setItem(GATE_IMG, waiting); st.photo = true; } catch (e) {} }
    RQ.ss.set(GATE, JSON.stringify(st)); RQ.ss.set("rumiq-after-login", "#" + st.route);
  };
  const readGate = () => { try { const g = JSON.parse(RQ.ss.get(GATE) || "null"); return g && Date.now() - g.at < 18e5 ? g : null; } catch (e) { return null; } };
  const dropGate = () => { RQ.ss.set(GATE, ""); try { sessionStorage.removeItem(GATE_IMG); } catch (e) {} };
  /* back from signing in: on the same page, the sheet opens again with everything you had chosen; a photo you had
     already picked goes straight into the room */
  let resuming = 0;
  const resumeGate = () => {
    const g = readGate(); if (!g || !S.customer() || resuming) return;
    const t0 = Date.now(); resuming = 1;
    const tick = () => {
      const here = routeNow();
      if (here !== g.route) { if (/^(konto|skapa-konto|logga-in)$/.test(here) && Date.now() - t0 > 250) location.hash = "#" + g.route; if (Date.now() - t0 < 8000) setTimeout(tick, 150); else resuming = 0; return; }
      resuming = 0; let pic = null; try { pic = g.photo ? sessionStorage.getItem(GATE_IMG) : null; } catch (e) {} dropGate();
      const p = g.plan || {}, then = p.add || p.go ? () => { (p.add || []).forEach((h) => RQ.byHandle(h) && R.add(h, true)); if (p.go && routeNow() !== p.go.replace(/^#/, "")) location.hash = p.go; } : null;
      R.openSetup(then, g.plan); chosenType = g.type || chosenType;
      { const t = document.getElementById("toast"); if (t) t.classList.remove("show"); } // the sheet says it: no second "Du är inloggad" on top of it
      if (!pic) { const b = $(".sheet-acts .btn:not([hidden])", sheet); if (b) { b.classList.remove("nudge"); void b.offsetWidth; b.classList.add("nudge"); } } // and the next step glows once
      if (pic) { busy(true); const im = new Image(); im.onload = () => done(im, { name: "Mitt rum" }); im.onerror = () => { busy(false); hello("Du är inloggad. Välj bilden en gång till, så är du igång."); }; im.src = pic; }
      else hello("Du är inloggad. Nu kan du lägga in ditt rum.");
    };
    setTimeout(tick, 0);
  };
  // signing in happens on the account page (or with Google and the like, which come back to it)
  S.onChange((w) => { if (w === "customer" && S.customer() && readGate() && /^(konto|skapa-konto|logga-in)$/.test(routeNow())) resumeGate(); });
  document.addEventListener("DOMContentLoaded", () => setTimeout(() => { if (readGate() && S.customer()) resumeGate(); }, 300));

  // the step is kept as soon as you reach for Logga in / Skapa gratis konto (the account page is drawn before the click ends)
  ["pointerdown", "keydown"].forEach((ev) => sheet.addEventListener(ev, (e) => { if ((ev === "pointerdown" || e.key === "Enter" || e.key === " ") && e.target.closest("[data-room-gate]")) keepGate(); }));
  sheet.addEventListener("click", (e) => {
    if (e.target.closest("[data-sheet-close]")) return close();
    // your own photo: signed in first (a click on Ta en bild / Välj en bild opens the gate instead of the camera)
    const pickBtn = e.target.closest(".sheet-acts label, .sheet-acts input"); if (pickBtn && !S.customer()) { e.preventDefault(); gate(null); return; }
    if (e.target.closest("[data-room-gate]")) { keepGate(); setTimeout(close, 0); return; } // the link goes to the account page; the sheet closes behind it
    const sso = e.target.closest("[data-sso]"); if (sso) { keepGate(); sso.disabled = true; RQ.auth.social(sso.dataset.sso).catch((er) => { sso.disabled = false; fail((er && er.message) || "Inloggningen gick inte att starta. Försök igen."); }); return; }
    if (e.target.closest("[data-check-use]")) { if (held) use(held); return; }
    if (e.target.closest("[data-check-other]")) { held = null; mode("main"); const inp = $(".sheet-acts label:not(.cam) input", sheet); inp.click(); return; }
    const t = e.target.closest("[data-room-type] [data-v]"); if (t) { chosenType = chosenType === t.dataset.v ? null : t.dataset.v; $$("[data-room-type] [data-v]", sheet).forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === chosenType)); if (room) R.setType(chosenType); return; }
    const s = e.target.closest("[data-room-sample]"); if (s) { busy(true); const im = new Image(); im.onload = () => done(im, { sample: true, map: s.dataset.type, type: s.dataset.type, name: $("span", s).textContent, src: s.dataset.roomSample }); im.onerror = () => { busy(false); fail("Exempelrummet gick inte att hämta. Kontrollera uppkopplingen och försök igen."); }; im.src = s.dataset.roomSample; }
  });
  $$("[data-room-file]", sheet).forEach((inp) => inp.addEventListener("change", () => { const f = inp.files[0]; inp.value = ""; takeFile(f); }));
  // on a computer: drop a picture on the sheet, or paste one
  const card0 = $(".sheet-card", sheet);
  ["dragenter", "dragover"].forEach((ev) => card0.addEventListener(ev, (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes("Files")) { e.preventDefault(); card0.classList.add("drop"); } }));
  ["dragleave", "drop"].forEach((ev) => card0.addEventListener(ev, (e) => { if (ev === "dragleave" && card0.contains(e.relatedTarget)) return; card0.classList.remove("drop"); }));
  card0.addEventListener("drop", (e) => { if (!e.dataTransfer || !e.dataTransfer.files.length) return; e.preventDefault(); takeFile(e.dataTransfer.files[0]); });
  document.addEventListener("paste", (e) => { if (!sheet.classList.contains("open") || !e.clipboardData) return; const f = [...e.clipboardData.files].find((x) => /^image\//.test(x.type) || isHeic(x)); if (f) { e.preventDefault(); takeFile(f); } });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && sheet.classList.contains("open")) { e.stopImmediatePropagation(); close(); } }, true);
  // swipe the sheet down to close it on phones
  (() => { const card = $(".sheet-card", sheet); let y0 = null, dy = 0;
    card.addEventListener("touchstart", (e) => { if (card.scrollTop > 0) return; y0 = e.touches[0].clientY; dy = 0; }, { passive: true });
    card.addEventListener("touchmove", (e) => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); card.style.transform = `translateY(${dy}px)`; }, { passive: true });
    card.addEventListener("touchend", () => { if (y0 == null) return; card.style.transform = ""; if (dy > 110) close(); y0 = null; });
  })();


  /* ---------------------------------------------------------------- one way in from anywhere (Mitt hem, Svep, the stylist, looks, moodboards)
     RQ.room.openWith({ room: "vardagsrum" | null, own: false, items: [{ h, v }], style, budget, project, swap })
     - own: your own photo (the one in this browser, or the sheet with its sign-in gate when there is none);
     - room: a sample room of that type (free); null keeps the room you have, or the living room;
     - a project whose saved scene belongs to this photo gets that scene back exactly; otherwise the things are placed
       by the editor's rules (mapped spots in a sample room, the tidy floor row in an own photo; never in mid-air);
     - swap: open with Byt on that thing (from the AI picture: "Prova en annan färg", "Byt produkt").
     - room null and no project: the room you have, but a sample room where most of the things do not belong is swapped for
       the sample room they do belong in (a moodboard of bathroom things opens the bathroom);
     - own with a room (or a project's type): your photo gets that kind of room, so the editor does not ask again; the style
       goes to Inred åt mig;
     - the things are placed as a proposal (Inred åt mig replaces them); a table thing with no free table is left out, and
       RQ.room.leftOut() names what was left out (the editor says it too).
     Resolves true when Mitt rum is open with the things in it (false when it waits for the sheet or sign-in). */
  const projOf = (id) => (id && RQ.hem && RQ.hem.room ? RQ.hem.room(id) : null);
  const keyNow = () => (RQ.ai && RQ.ai.projectKey ? RQ.ai.projectKey() : room && room.at);
  const putIn = (items, pr) => R.group(() => {
    const mine = pr && ((pr.pkey && pr.pkey === keyNow()) || (room && room.sample && pr.sceneMap && pr.sceneMap === room.map)); // the room's own photo, or the same sample room
    const keep = mine && Array.isArray(pr.scene) ? pr.scene.filter((it) => it && RQ.byHandle(it.h) && isFinite(it.x) && isFinite(it.y) && it.w > 0) : null;
    if (keep && keep.length) { R.saveScene(keep); R._leftOut = []; return keep.length; }
    // a set handed over (Svep, a proposal, a moodboard) is a proposal: Inred åt mig replaces it instead of stacking a second one.
    // The editor's surface rules hold for all of it: a table thing with no free table is left out and said, never put on the open floor
    R.saveScene([]); items.forEach((it) => R.add(it.h, true, it.v || 0));
    const list = R.scene(), out = list.filter((it) => R.homeless(it)).map((it) => it.h); R._leftOut = out;
    R.saveScene(list.filter((it) => !out.includes(it.h)).map((it) => ({ ...it, sg: true }))); return list.length - out.length; });
  /* the sample room whose kind of room most of these things belong to (a moodboard of bathroom things: the bathroom) */
  const roomFor = (its) => { const n = {}; its.forEach((it) => { const q = RQ.byHandle(it.h); (q ? q.rooms : []).forEach((r, i) => { n[r] = (n[r] || 0) + (i ? 1 : 2); }); });
    return RQ.SAMPLE_ROOMS.filter((x) => n[x.id]).sort((a, b) => n[b.id] - n[a.id])[0] || null; };
  const goRoom = (swap) => { if (swap) RQ.ss.set("rumiq-room-swap", swap); const here = (RQ.currentRoute && RQ.currentRoute()) || ""; if (here === "mitt-rum") { RQ.router(); scrollTo(0, 0); } else if (RQ.go) RQ.go("mitt-rum"); else location.hash = "#mitt-rum"; };
  R.openWith = async ({ room: type = null, own = false, items = [], style = null, budget = null, project = null, swap = null } = {}) => {
    const its = (items || []).map((it) => (typeof it === "string" ? { h: it, v: 0 } : { h: it.h, v: +it.v || 0 })).filter((it) => RQ.byHandle(it.h)).slice(0, 16);
    const pr = projOf(project); if (RQ.hem && RQ.hem.setActive && (project || RQ.hem.activeId())) RQ.hem.setActive(project || null); // the room Mitt rum shows is the active one (none when it is not one of yours)
    R._want = { style: RQ.STYLES[style] ? style : null, budget: budget > 0 ? +budget : null }; // Inred åt mig starts from the same style and budget
    document.dispatchEvent(new CustomEvent("rq-hem-go"));
    // your own photo: the kind of room you said (Mitt hem's "Hall") is used, so the editor does not ask again (studio2 review M5)
    const kind = RQ.roomById && RQ.roomById(type || (pr && pr.type)) ? type || pr.type : null, typed = () => { if (kind && room && !room.sample && !room.type) R.setType(kind); };
    if (own) {
      if (room && !room.sample) { typed(); putIn(its, pr); goRoom(swap); return true; }
      R.openSetup(() => { typed(); putIn(its, pr); if (pr && RQ.hem.patch) RQ.hem.patch(pr.id, { pkey: keyNow() }); goRoom(swap); }, { add: its.map((it) => it.h), go: "#mitt-rum" }); return false; // the sheet, with its sign-in gate; the plan survives signing in
    }
    const same = pr && pr.pkey && room && pr.pkey === keyNow();
    // no room named: the room you have, unless it is a sample room where these things do not belong; then the sample room they do belong in
    const fits = (r) => its.length && its.filter((it) => RQ.byHandle(it.h).rooms.includes(r)).length * 2 >= its.length;
    const guess = !type && !pr && its.length && !(room && !room.sample) && !(room && room.sample && fits(room.type || room.map)) ? roomFor(its) : null;
    const want = RQ.SAMPLE_ROOMS.find((x) => x.id === (type || (pr && pr.type))) || guess || null;
    if (!same && (want || !room) && !(room && room.sample && want && room.map === want.id)) {
      const sm = want || RQ.SAMPLE_ROOMS[0], im = new Image();
      const ok = await new Promise((res) => { im.onload = () => res(true); im.onerror = () => res(false); im.src = sm.img; });
      if (!ok || !(await R.saveImage(im, { sample: true, map: sm.id, type: sm.id, name: sm.name, src: sm.img }))) { RQ.toast("Rummet gick inte att öppna. Försök igen."); return false; }
    }
    putIn(its, pr); if (pr && room && room.sample && RQ.hem.patch) RQ.hem.patch(pr.id, { sceneMap: room.map }); goRoom(swap); return true;
  };
  /* from the AI picture ("Prova en annan färg", "Byt produkt"): Mitt rum with Byt open on that thing; colour: true opens it at
     the colours. Answers false when the thing is not in the room. */
  R.leftOut = () => (R._leftOut || []).slice();
  R.openSwap = (h, opt = {}) => { if (!room || !R.inScene(h)) return false; const c = !!(opt && opt.colour);
    if (R._swapLive && ((RQ.currentRoute && RQ.currentRoute()) || "") === "mitt-rum") { R._swapLive(h, c); return true; }
    goRoom(h + (c ? "|c" : "")); return true; };
  /* a small picture of one of your rooms with its things (Mitt hem's room cards): the room's own photo when it is the one in
     this browser, else its sample room; things where they stand (the saved scene) or placed by the editor's rules.
     Resolves a data URL, or null when the room's photo is not in this browser. */
  const snapCache = new Map();
  const imgOf = (src) => new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = src; });
  const drawScene = async (bg, list, W, lf) => { const H = Math.round(W * (bg.naturalHeight || bg.height) / (bg.naturalWidth || bg.width)), cv = document.createElement("canvas"); cv.width = W; cv.height = H; const cx = cv.getContext("2d"); cx.drawImage(bg, 0, 0, W, H);
    for (const it of orderOf(list)) { const p = RQ.byHandle(it.h); let im; try { im = await imgOf(cutIn(p)); } catch (e) { continue; }
      const w = W * it.w / 100, h = w * im.naturalHeight / im.naturalWidth * (it.sy || 1), x = W * it.x / 100 - w / 2, y = H * it.y / 100 - h; let src = im; const tone = R.tint(it);
      if (tone) { const t = document.createElement("canvas"); t.width = Math.max(1, Math.round(w)); t.height = Math.max(1, Math.round(h)); const tx = t.getContext("2d"); tx.drawImage(im, 0, 0, t.width, t.height); tx.globalCompositeOperation = "color"; tx.fillStyle = tone; tx.fillRect(0, 0, t.width, t.height); tx.globalCompositeOperation = "destination-in"; tx.drawImage(im, 0, 0, t.width, t.height); src = t; }
      cx.save(); cx.filter = lf(it.light || 100); if (it.flip) { cx.translate(x + w, y); cx.scale(-1, 1); cx.drawImage(src, 0, 0, w, h); } else cx.drawImage(src, x, y, w, h); cx.restore(); }
    return cv; };
  R.picture = async (W) => { if (!room) return null; return drawScene(await imgOf(R.url()), R.scene(), W, lightFilter); }; // the room as it stands, as a canvas
  R.snapshot = async (id, W = 900) => {
    const pr = projOf(id); if (!pr) return null; const key = `${id}|${W}|${pr.updated || pr.at || ""}`; if (snapCache.has(key)) return snapCache.get(key);
    const its = (RQ.hem.items(pr) || []).map((it) => ({ h: it.h, v: it.v || 0 })), here = room && pr.pkey && pr.pkey === keyNow();
    const job = (async () => {
      if (here) { const list = R.scene(); return list.length ? (await drawScene(await imgOf(R.url()), list, W, lightFilter)).toDataURL("image/jpeg", 0.82) : null; }
      const map = pr.sceneMap || pr.type, sm = RQ.SAMPLE_ROOMS.find((x) => x.id === map); if (!sm || !MAPS[sm.id]) return null;
      const saved = pr.sceneMap === sm.id && Array.isArray(pr.scene) ? pr.scene.filter((it) => it && RQ.byHandle(it.h) && it.w > 0) : null;
      const list = saved && saved.length ? saved : (() => { const l = []; its.forEach((it) => { const p = RQ.byHandle(it.h); if (!p) return; const sp = spotFor(p, l, true, MAPS[sm.id]); l.push({ h: it.h, v: it.v, x: sp.x, y: sp.y, w: sp.w, ...(sp.sy && sp.sy !== 1 ? { sy: sp.sy } : {}), ...(sp.moved ? { on: sp.moved } : {}) }); }); return l; })();
      if (!list.length) return null;
      return (await drawScene(await imgOf(sm.img), list, W, () => "none")).toDataURL("image/jpeg", 0.82); })();
    snapCache.set(key, job); job.catch(() => snapCache.delete(key)); return job; };

  /* ---------------------------------------------------------------- the room editor (#mitt-rum) */
  const V = RQ.views;
  const ICO = {
    more: '<svg viewBox="0 0 24 24"><circle cx="5.5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18.5" cy="12" r="1.2"/></svg>',
    spark: '<svg viewBox="0 0 24 24"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/></svg>',
    moon: '<svg viewBox="0 0 24 24"><path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/></svg>',
    wand: '<svg viewBox="0 0 24 24"><path d="M4 20L15 9M14 4v3M19 9h-3M17.5 5.5l-2 2M9 4l.6 1.4L11 6l-1.4.6L9 8l-.6-1.4L7 6l1.4-.6zM19 14l.6 1.4L21 16l-1.4.6L19 18l-.6-1.4L17 16l1.4-.6z"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    swap: '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    save: '<svg viewBox="0 0 24 24"><path d="M5 5h14v15l-7-4-7 4z"/></svg>',
    eye: '<svg viewBox="0 0 24 24"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    flip: '<svg viewBox="0 0 24 24"><path d="M12 3v18M8 7l-4 5 4 5zM16 7l4 5-4 5z"/></svg>',
    front: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="11" rx="1"/><path d="M5 15V5h10"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13"/></svg>',
    share: '<svg viewBox="0 0 24 24"><path d="M12 4v11M8 8l4-4 4 4M5 13v7h14v-7"/></svg>',
    minus: '<svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    back: '<svg viewBox="0 0 24 24"><rect x="5" y="5" width="11" height="11" rx="1"/><path d="M19 9v10H9"/></svg>',
    fit: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    undo: '<svg viewBox="0 0 24 24"><path d="M9 14L4.5 9.5 9 5"/><path d="M4.5 9.5h10a5 5 0 0 1 0 10H11"/></svg>',
    swapx: '<svg viewBox="0 0 24 24"><path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5"/></svg>',
    ruler: '<svg viewBox="0 0 24 24"><path d="M3.5 15.5l12-12 5 5-12 12z"/><path d="M7.5 11.5l1.8 1.8M10.5 8.5l1.3 1.3M13.5 5.5l1.8 1.8"/></svg>',
  };
  const setupBlock = (want) => `<div class="rm-empty">
      <div class="rm-empty-in">
        ${want ? `<p class="rm-want"><img src="${RQ.cut(want)}" alt=""><span><b>${esc(want.name)}</b> står i rummet så fort bilden är inne.</span></p>` : ""}
        <h2 class="h2">Börja med en bild av ditt rum.</h2>
        <p class="lead">Sedan ställer du in produkter där du vill ha dem, ser vad hela rummet kostar och handlar allt på en gång.</p>
        <div class="ctrl-row rm-empty-acts" style="margin-top:1.6rem">${S.customer() ? `<button class="btn" type="button" data-room-setup>Lägg in ditt rum</button><button class="btn ghost" type="button" data-room-sample-now="#mitt-rum">Prova med ett exempelrum</button>` // signed in: your own room first; signed out: the free sample room is the main way in
          : `<button class="btn" type="button" data-room-sample-now="#mitt-rum">Prova med ett exempelrum</button><button class="btn ghost" type="button" data-room-setup>Lägg in ditt rum</button>`}</div>
        <ol class="rm-steps"><li><b>Ta en bild</b><span>Med telefonen, eller välj en du redan har.</span></li><li><b>Ställ in produkter</b><span>Från butiken, eller låt oss föreslå.</span></li><li><b>Handla looken</b><span>Allt i rummet hamnar i varukorgen med en knapp.</span></li></ol>
        <p class="small" style="margin-top:1.2rem">Bilden sparas bara i din webbläsare. Den skickas till oss först om du själv väljer att skapa en AI-bild.</p>
      </div>${RQ.demoFig ? RQ.demoFig({ bare: true }) : ""}</div>`; // the picture shows what it does; no way out of Studio in it

  /* the customer's rooms (Mitt hem): switching is one tap; the active one is marked */
  const projChips = () => { const H = RQ.hem, rs = H && H.rooms ? H.rooms() : []; if (!rs.length) return "";
    const act = H.activeId && H.activeId();
    return `<nav class="rm-projs" aria-label="Dina rum">${rs.slice(0, 6).map((r) => `<button type="button" class="chip" data-proj="${esc(r.id)}" aria-pressed="${r.id === act}">${esc(H.name(r))}</button>`).join("")}<a class="chip rm-projnew" href="#mitt-hem">${ICO.plus}<span>Nytt rum</span></a></nav>`; };
  V.myRoom = (pre) => {
    if (pre && RQ.byHandle(pre) && room && R.add(pre, true)) RQ.ss && RQ.ss.set("rumiq-room-new", pre);
    if (pre && RQ.byHandle(pre) && !room) RQ.ss && RQ.ss.set("rumiq-room-pre", pre);
    const want = pre && RQ.byHandle(pre) && !room ? RQ.byHandle(pre) : null; // came from a product without a room yet
    const more = `<nav class="rm-more" aria-label="Fler sätt att välja"><a class="chip" href="#svep">Svep fram din stil</a><a class="chip" href="#hitta-ratt">Hitta rätt</a><a class="chip" href="#studio-stylist">Fråga stylisten</a></nav>`;
    return {
      title: pre && RQ.byHandle(pre) ? `${RQ.byHandle(pre).name} i ditt rum · RumIQ` : "Mitt rum · RumIQ",
      html: `<section class="wrap rm-top${room ? " has-room" : ""}">${RQ.crumbs([["Hem", "hem"], ["Mitt rum"]])}<div class="rm-title"><h1 class="h1">Mitt rum</h1>${room ? projChips() : ""}${room ? `<p class="lead">Sakerna hamnar där de hör hemma: lampor på bord, plädar i soffan och tavlor på väggen. Flytta dem som du vill.</p>` : ""}</div>
        ${room ? "" : more}</section>
        ${room ? `<section class="rm wrap">
          <div class="rm-stagewrap" id="rmWrap" style="--ar:${(room.w / room.h).toFixed(4)}">
            <div class="rm-stage" id="rmStage" data-sun="${(mapOf() || GENERIC).sun}" style="--ar:${(room.w / room.h).toFixed(4)};aspect-ratio:${room.w} / ${room.h}">
              <p class="sr" id="rmSaid" role="status"></p><div class="rm-canvas" id="rmCanvas"><img class="rm-bg" src="${R.url()}" alt="${room.sample ? "Exempelrummet" : "Ditt rum"}" draggable="false" decoding="async"><div class="rm-items" id="rmItems"></div><svg class="rm-area" id="rmArea" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon points=""/></svg><span class="rm-arealab" id="rmAreaLab" aria-hidden="true" hidden></span>
                <div class="rm-ruler" id="rmRuler" hidden><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><line x1="0" y1="0" x2="0" y2="0"/></svg><button type="button" class="rm-rh" data-end="1" aria-label="Linjens ena ände. Piltangenterna flyttar den."></button><button type="button" class="rm-rh" data-end="2" aria-label="Linjens andra ände. Piltangenterna flyttar den."></button><span class="rm-rlab" id="rmRLab"></span></div></div>
              <p class="rm-rhint" id="rmRHint" role="status" hidden>Dra linjen över något du vet längden på, som en dörr.</p>
              <button type="button" class="rm-hold" id="rmHold" aria-label="Håll för före, så ser du rummet utan produkterna">${ICO.eye}<span>Håll för före</span></button>
              <button type="button" class="rm-zoom" id="rmZoom" hidden>${ICO.fit}<span>Hela rummet</span></button>
              <button type="button" class="rm-undo" id="rmUndo" aria-keyshortcuts="Control+Z" hidden>${ICO.undo}<span>Ångra</span></button>
              <button type="button" class="rm-nightchip" id="rmNightChip" aria-label="Kvällsljus är på. Stäng av" hidden>${ICO.moon}<span>Kvällsljus</span><svg class="x" viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17"/></svg></button>
              <span class="rm-pos" id="rmPos" aria-hidden="true" hidden><i></i></span>
              <div class="rm-emptyhint" id="rmHint" hidden>${!room.sample && !room.type ? `<p id="rmHintT">Vilket rum är det?</p><div class="chips rm-hintask">${TYPES.map(([id, n]) => `<button type="button" class="chip" data-roomtype="${id}">${n}</button>`).join("")}</div>` : `<p id="rmHintT">Rummet är tomt.</p>`}<button class="btn sm light" type="button" id="rmSuggest0"${!room.sample && !room.type ? " hidden" : ""}>${ICO.wand}Inred åt mig</button></div>
            </div>
            <p class="rm-first" id="rmFirst" role="status" hidden></p>
            <div class="rm-tools">
              <button type="button" class="rm-tool" id="rmAdd">${ICO.plus}<span>Lägg till</span></button>
              <button type="button" class="rm-tool" id="rmSuggest">${ICO.wand}<span>Inred åt mig</span></button>
              <button type="button" class="rm-tool" id="rmSave">${ICO.save}<span>Spara</span></button>
              <div class="rm-morewrap"><button type="button" class="rm-tool" id="rmMore" aria-haspopup="true" aria-expanded="false" aria-controls="rmMenu">${ICO.more}<span>Mer</span></button>
                <div class="rm-menu" id="rmMenu" role="menu" aria-label="Mer" hidden>
                  <button type="button" role="menuitem" class="rm-ai" data-ai-create>${ICO.spark}<span>Skapa AI-bild<small>Rummet med sakerna, i rätt ljus</small></span></button>
                  <button type="button" role="menuitem" id="rmShow">${ICO.share}<span>Visa någon<small>Före och efter i en bild</small></span></button>
                  <button type="button" role="menuitemcheckbox" id="rmNight" aria-checked="false">${ICO.moon}<span>Kvällsljus<small>Se lamporna lysa i rummet</small></span></button>
                  <button type="button" role="menuitemcheckbox" id="rmBefore" aria-checked="false">${ICO.eye}<span>Visa före<small>Rummet utan sakerna</small></span></button>
                  ${mapOf() ? "" : `<button type="button" role="menuitem" data-measure>${ICO.ruler}<span>Känd längd i bilden<small>Rätt skala för produkter med mått</small></span></button>`}
                  <button type="button" role="menuitem" id="rmLib">${ICO.save}<span>Mina rumsbilder<small>AI-bilder och sparade rum, under Sparat</small></span></button>
                  <button type="button" role="menuitem" data-room-setup>${ICO.swap}<span>Byt rum<small>Ny bild eller ett exempelrum</small></span></button>
                </div></div>
            </div>
            <div class="rm-act" id="rmAct" role="group" aria-label="Den valda saken" hidden>
              <div class="rm-acth"><b id="rmActName"></b><button type="button" class="rm-bytbtn" data-swap-open>${ICO.swapx}<span>Byt</span></button><span class="rm-on"><span id="rmOnL2">Står på</span><select id="rmOn2" aria-labelledby="rmOnL2"></select><b class="rm-on1" id="rmOn2b" hidden></b></span></div>
              <button type="button" data-act="smaller">${ICO.minus}<span>Mindre</span></button>
              <button type="button" data-act="bigger">${ICO.plus}<span>Större</span></button>
              <button type="button" data-act="flip">${ICO.flip}<span>Vänd</span></button>
              <button type="button" data-act="order" id="rmActOrderB" aria-label="Lägg bakom">${ICO.front}<span id="rmActOrder">Bakom</span></button>
              <button type="button" data-act="del">${ICO.trash}<span>Ta bort</span></button>
              <button type="button" data-act="done" class="on">${ICO.check}<span>Klar</span></button>
            </div>
            <div class="rm-swap" id="rmSwap" role="region" aria-label="Byt" hidden></div>
            <div class="rm-sugg" id="rmSugg" role="region" aria-label="Förslag" hidden></div>
            <div class="rm-measure" id="rmMeasure" role="group" aria-label="Känd längd i bilden" hidden>
              <label class="rm-len"><span>Längd</span><input type="number" id="rmLen" inputmode="decimal" min="10" max="2000" step="1" value="200"><span>cm</span></label>
              <div class="rm-mbtns"><button type="button" class="btn sm ghost" id="rmMOff" hidden>Ta bort</button><button type="button" class="btn sm ghost" id="rmMCancel">Avbryt</button><button type="button" class="btn sm" id="rmMDone">Klar</button></div>
            </div>
            ${!room.sample && !room.type ? `<div class="rm-ask" id="rmAsk"><span>Vilket rum är det?</span><div class="chips">${TYPES.map(([id, n]) => `<button type="button" class="chip" data-roomtype="${id}">${n}</button>`).join("")}</div></div>` : ""}
            <p class="caption"><span id="rmScale"></span> ${room.sample ? "Ljuset på produkterna följer rummets ljus." : "Ljuset på produkterna anpassas efter ditt foto."} <span class="rm-keys">Med tangentbordet: piltangenterna flyttar, plus och minus ändrar storlek och ${/Mac|iPhone|iPad/.test(navigator.platform || "") ? "⌘Z" : "Ctrl+Z"} ångrar.</span></p>
            ${more}
          </div>
          <aside class="rm-side">
            <div class="rm-buy">
              <div class="sum total"><span>Hela rummet</span><span id="rmTotal">0 kr</span></div>
              <button class="btn block" type="button" id="rmCart">Lägg allt i varukorgen</button>
            </div>
            ${RQ.ai ? RQ.ai.card() : ""}
            <div class="rm-sel" id="rmSel" hidden>
              <div class="rm-sel-h"><img id="rmSelImg" alt=""><div><b id="rmSelName"></b><span id="rmSelPrice"></span></div><a class="tlink" id="rmSelLink" href="#">Visa</a></div>
              <button type="button" class="btn ghost block rm-bytdesk" data-swap-open>${ICO.swapx}<span>Byt eller jämför</span></button>
              <div class="range-row rm-onrow"><span id="rmOnL">Står på</span><span class="rm-on"><select id="rmOn" aria-labelledby="rmOnL"></select><b class="rm-on1" id="rmOnb" hidden></b></span></div>
              <p class="small rm-real" id="rmReal"></p>
              <div class="range-row"><span>Storlek</span><input type="range" id="rmSize" min="3" max="96" step=".1" aria-label="Storlek"></div>
              <div class="range-row"><span>Ljus</span><input type="range" id="rmLight" min="60" max="135" aria-label="Ljus"></div>
              <div class="range-row rm-move" role="group" aria-label="Flytta"><span aria-hidden="true">Flytta</span><div><button type="button" class="chip" data-mv="-2,0" aria-label="Flytta åt vänster">←</button><button type="button" class="chip" data-mv="0,-2" aria-label="Flytta uppåt">↑</button><button type="button" class="chip" data-mv="0,2" aria-label="Flytta nedåt">↓</button><button type="button" class="chip" data-mv="2,0" aria-label="Flytta åt höger">→</button></div></div>
              <div class="rm-sel-a"><button type="button" class="chip" id="rmFlip">${ICO.flip}Spegelvänd</button><button type="button" class="chip" id="rmFront">${ICO.front}Längst fram</button><button type="button" class="chip" id="rmBack">${ICO.back}Längst bak</button><button type="button" class="chip" id="rmDel">${ICO.trash}Ta bort</button></div>
            </div>
            <div class="rm-listhead"><h2 class="h3">I rummet</h2><span class="small" id="rmCount"></span></div>
            <ul class="rm-list" id="rmList"></ul>
            <div class="rm-harm" id="rmHarm" hidden><div class="harmony"><span class="eyebrow">Går ihop</span><div class="meter"><i id="rmHm" style="width:0"></i></div><b id="rmHmv">0</b></div><p class="small" id="rmHmt"></p></div>
            <div class="rm-foot">
              <button class="btn ghost block" type="button" id="rmLook" hidden>Spara som look</button>
              <p class="small">Du väljer antal och ser frakt i kassan innan du betalar.</p>
            </div>
          </aside>
        </section>
        <div class="buybar rm-bar" id="rmBar"><div class="bb-t"><b>Hela rummet</b><span id="rmBarSum">0 kr</span></div><button class="btn sm" type="button" id="rmCart2">Lägg allt i varukorgen</button></div>
        <section class="sec tight kalk"><div class="wrap"><div class="sec-row"><div class="sec-head"><h2 class="h2">Passar ${room.sample ? "rummet" : "ditt rum"}</h2><p>Sorterat efter hur väl färgerna går ihop med ${room.sample ? "rummet" : "ditt foto"}. Ställ in en av dem med Lägg till vid rummet.</p></div><a class="link" href="#butik">Hela butiken</a></div><div id="rmCols"></div><div id="rmFits"></div></div></section>`
        : `<section class="wrap" style="padding-bottom:5rem">${setupBlock(want)}</section>`}`,
      mount(root) {
        document.body.classList.add("on-room");
        document.body.classList.toggle("room-empty", !room);
        if (!room) return () => document.body.classList.remove("on-room", "room-empty");
        const pre2 = RQ.ss && RQ.ss.get("rumiq-room-pre"); if (pre2) { RQ.ss.set("rumiq-room-pre", ""); if (R.add(pre2, true)) RQ.ss.set("rumiq-room-new", pre2); }
        const stage = $("#rmStage", root), canvas = $("#rmCanvas", root), wrap = $("#rmItems", root), box = $("#rmWrap", root);
        // the thing you came with from a product page lands, and is the one that is selected
        const fresh0 = (RQ.ss && RQ.ss.get("rumiq-room-new")) || "";
        let sel = fresh0 && R.inScene(fresh0) ? fresh0 : null;
        const paintCart = []; // the add-all buttons follow the cart and the room (addAllBtn)
        if (fresh0) setTimeout(() => RQ.ss.set("rumiq-room-new", ""), 1600); // kept a moment: the view may be drawn twice on the way in
        if (fresh0 && R.lastMoved === fresh0 && R.inScene(fresh0)) { R.lastMoved = null; ls.set("rumiq-room-landed", true); setTimeout(() => RQ.toast(`Där var det fullt, så ${esc(RQ.byHandle(fresh0).name)} står på golvet. Dra den dit du vill.`), 700); } // it came from a product page: say why it is not on the table
        const colsHtml = () => { const c = R.read(); return c && c.pal.length ? `<div class="rm-colors"><div class="palette" role="img" aria-label="Färgerna i ${room.sample ? "rummet" : "ditt rum"}">${c.pal.map((t) => `<i style="background:${t}"></i>`).join("")}</div><div><h3>Färgerna i ${room.sample ? "rummet" : "ditt rum"}</h3><p>${c.text} ${c.tip}</p></div></div>` : ""; };
        const fits = () => { $("#rmCols", root).innerHTML = colsHtml(); const t = room.type; const list = RQ.PRODUCTS.map((p) => ({ p, m: (match(p) || 0) + (t && p.rooms.includes(t) ? 100 : 0) })).sort((a, b) => b.m - a.m).slice(0, 6).map((x) => x.p); $("#rmFits", root).innerHTML = RQ.grid(list, "three"); RQ.markImages && RQ.markImages(root); };
        /* things land softly the first time they are put in the room */
        const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
        // things carried over to a new photo all land (and the view fits all of them)
        const seen = new Set(R._landRow ? [] : R.scene().map((it) => it.h)); if (fresh0) seen.delete(fresh0); R._landRow = false;
        let shown = R.total();
        const count = (to) => { // the room's price counts up while the things land
          const els = [$("#rmTotal", root)], from = shown; shown = to;
          if (calm() || from === to) { els[0].textContent = kr(to); return; }
          const t0 = performance.now(), step = (t) => { const k = Math.min(1, (t - t0) / 600), v = Math.round((from + (to - from) * (1 - (1 - k) ** 3)) / 10) * 10; els[0].textContent = kr(k === 1 ? to : v); if (k < 1 && els[0].isConnected) requestAnimationFrame(step); };
          requestAnimationFrame(step);
        };

        /* ---- Känd längd i bilden: a line over something you know the length of, and that length */
        let meas = null, mdrag = null, byKey = false, escMeasure = null;
        const ruler = $("#rmRuler", root), lenIn = $("#rmLen", root);
        const lenPct = (m) => Math.hypot(m.x2 - m.x1, (m.y2 - m.y1) * room.h / room.w);
        const paintRuler = () => { if (!meas) return; const ln = $("line", ruler), [h1, h2] = $$(".rm-rh", ruler), lab = $("#rmRLab", root);
          ["x1", "y1", "x2", "y2"].forEach((k) => ln.setAttribute(k, meas[k]));
          h1.style.left = meas.x1 + "%"; h1.style.top = meas.y1 + "%"; h2.style.left = meas.x2 + "%"; h2.style.top = meas.y2 + "%";
          lab.style.left = (meas.x1 + meas.x2) / 2 + "%"; lab.style.top = (meas.y1 + meas.y2) / 2 + "%"; const v = parseFloat(String(lenIn.value).replace(",", ".")); lab.textContent = v > 0 ? `${Math.round(v)} cm` : "? cm"; };
        const measure = (on) => {
          if (on) { select(null); const K = room.known; const cx = view.on ? clamp((view.sw / 2 - view.tx) / (view.cw * view.z) * 100 - 12, 8, 92) : 30; // a first line in view, upright like a door frame
            meas = K ? { x1: K.x1, y1: K.y1, x2: K.x2, y2: K.y2 } : { x1: +cx.toFixed(1), y1: 38, x2: +cx.toFixed(1), y2: 84 }; lenIn.value = K ? K.cm : 200; $("#rmMOff", root).hidden = !K; paintRuler(); }
          else { meas = mdrag = null; }
          // while drawing, one finger draws the line instead of scrolling, and the things step back
          stage.classList.toggle("measuring", !!on); box.classList.toggle("measuring", !!on); if (on) stage.style.touchAction = "none"; else paintView(); ruler.hidden = $("#rmMeasure", root).hidden = $("#rmRHint", root).hidden = !on;
          if (on && innerWidth <= 900) stage.scrollIntoView({ behavior: calm() ? "auto" : "smooth", block: "start" });
          if (on && byKey) setTimeout(() => $(".rm-rh", ruler).focus({ preventScroll: true }), 60); else if (!on) $("#rmMore", root).focus({ preventScroll: true });
        };
        root.addEventListener("keydown", () => { byKey = true; }, true); root.addEventListener("pointerdown", () => { byKey = false; }, true);
        ruler.addEventListener("keydown", (e) => { const hd = e.target.closest(".rm-rh"); if (!hd || !meas) return; const d = e.shiftKey ? 2 : 0.5, m = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }[e.key]; if (!m) return; e.preventDefault();
          meas["x" + hd.dataset.end] = clamp(meas["x" + hd.dataset.end] + m[0], 0, 100); meas["y" + hd.dataset.end] = clamp(meas["y" + hd.dataset.end] + m[1], 0, 100); paintRuler(); });
        lenIn.addEventListener("input", paintRuler);
        lenIn.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); $("#rmMDone", root).click(); } });
        $("#rmMDone", root).addEventListener("click", () => { const cm = parseFloat(String(lenIn.value).replace(",", "."));
          if (!(cm >= 10 && cm <= 2000)) { RQ.toast("Skriv längden i centimeter, till exempel 200."); lenIn.focus(); return; }
          if (lenPct(meas) < 3) { RQ.toast("Dra linjen från ena änden till den andra av det du mäter."); return; }
          const K = { ...meas, cm }; measure(false); const done = R.setKnown(K);
          RQ.toast(done.length ? `Klart. ${done.length === 1 ? "1 sak" : done.length + " saker"} med mått står i rätt skala.` : "Klart. Produkter med mått visas i rätt skala."); });
        $("#rmMCancel", root).addEventListener("click", () => measure(false));
        $("#rmMOff", root).addEventListener("click", () => { measure(false); R.setKnown(null); RQ.toast("Längden är borttagen. Storlekarna är ungefärliga igen."); });
        root.addEventListener("click", (e) => { if (e.target.closest("[data-measure]")) { if (!mapOf()) measure(true); return; } if (e.target.closest("[data-real]") && sel) R.update(sel, { real: true }); });
        document.addEventListener("keydown", escMeasure = (e) => { if (e.key === "Escape" && meas) { e.preventDefault(); measure(false); } });

        /* ---- the view of the room. On a phone the photo is shown as tall as the screen allows and you
           pan it sideways; "Hela rummet" shows all of it. Everything in the room is placed in % of the
           canvas, so positions are the same however the canvas is sized, moved or zoomed. */
        const view = { z: 1, tx: 0, ty: 0, cw: 0, ch: 0, sw: 0, sh: 0, on: false, whole: ls.get("rumiq-room-view", "") === "whole", can: false };
        const phone = () => innerWidth <= 900;
        const paintView = (glide) => {
          if (!view.on) { canvas.style.cssText = ""; stage.style.height = ""; stage.style.touchAction = ""; $("#rmPos", root).hidden = true; $("#rmZoom", root).hidden = true; stage.classList.remove("view"); return; }
          const w = view.cw * view.z, h = view.ch * view.z;
          view.tx = w <= view.sw ? (view.sw - w) / 2 : clamp(view.tx, view.sw - w, 0);
          view.ty = h <= view.sh ? (view.sh - h) / 2 : clamp(view.ty, view.sh - h, 0);
          canvas.classList.toggle("glide", !!glide && !calm());
          canvas.style.width = view.cw + "px"; canvas.style.height = view.ch + "px";
          canvas.style.transform = `translate3d(${view.tx.toFixed(1)}px,${view.ty.toFixed(1)}px,0) scale(${view.z.toFixed(3)})`;
          stage.style.touchAction = view.z > 1.01 ? "none" : "pan-y";
          const pos = $("#rmPos", root); pos.hidden = w <= view.sw + 1;
          if (!pos.hidden) { const i = pos.firstElementChild; i.style.width = (view.sw / w * 100).toFixed(1) + "%"; i.style.left = (-view.tx / w * 100).toFixed(1) + "%"; }
          const zb = $("#rmZoom", root); zb.hidden = !view.can; zb.lastElementChild.textContent = view.whole && view.z <= 1.01 ? "Närmare" : "Hela rummet";
          zb.setAttribute("aria-pressed", view.whole);
        };
        const layout = (keep) => {
          view.on = phone(); stage.classList.toggle("view", view.on);
          if (!view.on) { view.z = 1; view.tx = view.ty = 0; paintView(); return; }
          const ar = room.w / room.h, W = box.clientWidth, top = (document.querySelector("header") || {}).offsetHeight || 58;
          const drawer = document.body.classList.contains("picking-room") ? R.pickerHeight() + 10 : 0; // the picker is open under the room
          // on a short phone the room leaves space under it for the selected thing's bar (its name, Står på and the buttons) above the buy bar
          const below = drawer ? 0 : innerHeight - (box.getBoundingClientRect().top + scrollY) - 184;
          const room4 = Math.max(200, innerHeight - top - (drawer || 150)), h62 = Math.min(Math.round(innerHeight * 0.62), room4, below > 260 ? below : 1e4);
          view.can = h62 * ar >= W * 1.2;                       // a wide photo: there is more to see when it is shown tall
          const near = view.can && !view.whole;
          view.sh = Math.round(view.fit && view.can ? clamp(view.fit, Math.min(W / ar, room4), h62) : near ? h62 : Math.min(W / ar, room4)); view.sw = W;
          view.cw = view.sh * ar; view.ch = view.sh;
          stage.style.height = view.sh + "px";
          if (!keep) { view.z = 1; const c = centre(R.scene()); view.tx = view.sw / 2 - c[0] / 100 * view.cw; view.ty = 0; }
          paintView();
        };
        /* several things land at once, wider than a phone shows: the camera starts at the left one and glides across while they
           land, one after the other, so you see every one arrive. 2 = touring, 1 = moved, false = stayed */
        /* a finger or the mouse on the room stops a glide where it is, and cancels the rest of a tour */
        let tourId = 0;
        const stopGlide = () => { tourId++; if (!view.on || !canvas.classList.contains("glide")) return; const m = new DOMMatrix(getComputedStyle(canvas).transform); view.tx = m.e; view.ty = m.f; canvas.classList.remove("glide", "tour"); paintView(); };
        const tour = (list) => { if (!view.on || list.length < 2 || calm()) return lookAt(list) ? 1 : false;
          const w = view.cw * view.z, xs = list.map((it) => it.x / 100 * w), lo = Math.min(...xs), hi = Math.max(...xs); if (hi - lo <= view.sw * 0.7) return lookAt(list) ? 1 : false;
          const c = centre(list); view.ty = clamp(view.sh / 2 - c[1] / 100 * view.ch * view.z, view.sh - view.ch * view.z, 0); view.tx = view.sw * 0.22 - lo; paintView(true);
          const id = ++tourId; setTimeout(() => { if (id !== tourId || !canvas.isConnected || drag || pan || pinch) return; canvas.classList.add("tour"); view.tx = view.sw * 0.78 - hi; paintView(true);
            setTimeout(() => { canvas.classList.remove("tour"); if (id === tourId && canvas.isConnected && !drag && !pan && !pinch && !sel) fitGroup(R.scene().filter((x) => list.some((n) => n.h === x.h))); }, 1700); }, 620); // and ends on all of them, large enough to tap
          return 2; };
        /* the whole picture at once (for this visit; "Närmare" goes back) */
        const wholeRoom = () => { view.whole = true; stage.classList.add("resize"); layout(); setTimeout(() => stage.classList.remove("resize"), 450); };
        /* a phone shows the group of things that just landed: as tall as possible, wide enough for all of them, and never so
           small that one of them is under 44 px to tap */
        const fitGroup = (list) => { if (!view.on || !list.length) return; const ar = room.w / room.h, lo = Math.min(...list.map((it) => it.x - it.w / 2)), hi = Math.max(...list.map((it) => it.x + it.w / 2));
          const gw = clamp((hi - lo + 10) / 100, 0.2, 1); // (a tiny thing keeps a 44 px tap area of its own, site.css)
          view.fit = view.sw / (gw * ar); view.whole = false; stage.classList.add("resize"); layout(true);
          const c = centre(list); view.tx = view.sw / 2 - c[0] / 100 * view.cw; view.ty = 0; paintView(true); setTimeout(() => stage.classList.remove("resize"), 450); };
        const centre = (list) => { if (!list.length) return [50, 50]; const xs = list.map((it) => it.x), ys = list.map((it) => it.y - (it.w * meta(RQ.byHandle(it.h))[2] * (it.sy || 1) * room.w / room.h) / 2); return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]; };
        /* the camera glides to where something stands */
        const lookAt = (list) => { if (!view.on || !list.length) return false; const c = centre(list), w = view.cw * view.z, h = view.ch * view.z, tx = view.tx, ty = view.ty;
          const x = c[0] / 100 * w + view.tx, y = c[1] / 100 * h + view.ty; if (x > view.sw * 0.22 && x < view.sw * 0.78 && y > view.sh * 0.1 && y < view.sh * 0.9 && list.length === 1) return false;
          view.tx = view.sw / 2 - c[0] / 100 * w; view.ty = view.sh / 2 - c[1] / 100 * h; paintView(true); return Math.abs(view.tx - tx) + Math.abs(view.ty - ty) > 8; };

        const tintHtml = (it, p) => { const t = R.tint(it); return t ? `<i class="rm-tint" aria-hidden="true" style="background:${esc(t)};-webkit-mask-image:url(${cutIn(p)});mask-image:url(${cutIn(p)});transform:scaleX(${it.flip ? -1 : 1})"></i>` : ""; };
        const draw = () => {
          const list = R.scene(), order = R.ordered(); let fresh = 0; const news = [];
          const nw = order.filter((it) => !seen.has(it.h)); if (nw.length === 1 && !mapOf() && !Object.keys(ls.get(LEARN, {}) || {}).length) sel = nw[0].h;
          const lane = new Map(nw.slice().sort((a, b) => a.x - b.x).map((it, i) => [it.h, i])); // several land from left to right
          wrap.innerHTML = order.map((it, i) => { const p = RQ.byHandle(it.h), kind = kindOf(p), isNew = !seen.has(it.h), r = meta(p)[2]; if (isNew) news.push(it);
            return `<div class="rm-item k-${kind}${p.cat === "belysning-atmosfar" ? " lamp" : ""}${sel === it.h ? " sel" : ""}${isNew && !calm() ? " land" : ""}" data-h="${it.h}" tabindex="0" role="button" aria-label="${esc(p.name)}. Dra för att flytta. Piltangenterna flyttar, plus och minus ändrar storlek, Delete tar bort." style="left:${it.x}%;top:${it.y}%;width:${it.w}%;--w:${it.w};z-index:${i + 1}${isNew && !calm() ? `;--i:${lane.get(it.h) ?? fresh++}` : ""}"><img src="${cutIn(p)}" alt="" draggable="false" style="${it.sy ? `aspect-ratio:1 / ${(r * it.sy).toFixed(3)};` : ""}transform:scaleX(${it.flip ? -1 : 1});filter:${lightFilter(it.light)}">${tintHtml(it, p)}</div>`; }).join("");
          const teach = news.length && !mapOf() && !Object.keys(ls.get(LEARN, {}) || {}).length; // own photo, nothing shown yet
          if (news.length) { const t = tour(news); wrap.style.setProperty("--pre", t ? "360ms" : "90ms"); wrap.style.setProperty("--step", t === 2 ? "300ms" : "130ms");
            const f = $("#rmFirst", root);
            if (news.some((it) => it.row) && view.on) fitGroup(news); // they stand in a row: show all of them, large enough to tap
            if (teach) { f.textContent = news.some((it) => it.row) ? (news.some((it) => it.row && it.on === "bord") ? "Dra sakerna dit du vill ha dem. Står något fel, ändra under Står på." : "Dra sakerna dit du vill ha dem.") : "Dra den dit den ska stå och gör den lagom stor. Nästa sak följer efter."; f.hidden = false; f.classList.remove("go"); void f.offsetWidth; f.classList.add("go"); setTimeout(() => { if (f.isConnected) f.hidden = true; }, 9000); }
            else if (!ls.get("rumiq-room-landed", false)) { ls.set("rumiq-room-landed", true); f.textContent = "Så här kan det se ut hemma hos dig."; f.hidden = false; f.classList.remove("go"); void f.offsetWidth; f.classList.add("go"); setTimeout(() => { if (f.isConnected) f.hidden = true; }, 9000); } }
          list.forEach((it) => seen.add(it.h)); [...seen].forEach((h) => { if (!list.some((it) => it.h === h)) seen.delete(h); });
          if (!list.length) $("#rmFirst", root).hidden = true; // an empty room has its own question
          $("#rmHint", root).hidden = list.length > 0; $("#rmHold", root).hidden = !list.length; toastAt(); // nothing to compare with in an empty room (and messages move in beside it when it comes)
          { const ask = $("#rmAsk", root); if (ask) ask.hidden = !list.length && !!$(".rm-hintask", root); } // a new photo is asked about on the picture itself, where you look
          $("#rmList", root).innerHTML = list.length ? list.map((it) => { const p = RQ.byHandle(it.h); return `<li class="${sel === it.h ? "on" : ""}"><button type="button" class="rm-li" data-pick="${it.h}"><img src="${RQ.img(p, 600)}" alt=""><span><b>${esc(p.name)}</b><span>${kr(p.price)}</span></span></button><button type="button" class="iconbtn" data-del="${it.h}" aria-label="Ta bort ${esc(p.name)} ur rummet">${ICO.trash}</button></li>`; }).join("") : `<li class="rm-none">Inget i rummet än. Tryck på <b>Inred åt mig</b> eller <b>Lägg till</b>.</li>`;
          const t = kr(R.total()); count(R.total()); $("#rmBarSum", root).textContent = `${list.length} ${list.length === 1 ? "produkt" : "produkter"} · ${t}`;
          $("#rmCount", root).textContent = list.length ? `${list.length} ${list.length === 1 ? "produkt" : "produkter"}` : "";
          $("#rmCart", root).disabled = $("#rmCart2", root).disabled = !list.length; paintCart.forEach((f) => f());
          const hm = R.harmony(); $("#rmHarm", root).hidden = !hm; $("#rmLook", root).hidden = list.length < 2;
          if (hm) { $("#rmHm", root).style.width = hm.score + "%"; $("#rmHmv", root).textContent = hm.word; $("#rmHmt", root).textContent = hm.tip; }
          paintSel(); paintUndo(); paintFoot(); paintScale();
        };
        const paintScale = () => { if (!room) return; const K = room.known; $("#rmScale", root).innerHTML = mapOf() ? "I exempelrummet visas produkter med mått i rätt skala. Andra storlekar är ungefärliga." : K ? `Produkter med mått visas i rätt skala, utifrån din längd på ${K.cm} cm. Andra storlekar är ungefärliga. <button type="button" class="tlink" data-measure>Ändra längden</button>` : `Storleken är ungefärlig. <button type="button" class="tlink" data-measure>Känd längd i bilden</button> ger rätt skala för produkter med mått.`; };
        const paintSel = () => {
          const it = R.scene().find((x) => x.h === sel); const panel = $("#rmSel", root); panel.hidden = !it;
          $("#rmAct", root).hidden = !it; box.classList.toggle("picking", !!it);
          if (!it) return;
          const p = RQ.byHandle(it.h);
          $("#rmSelImg", root).src = RQ.img(p, 600); $("#rmSelName", root).textContent = p.name; $("#rmSelPrice", root).textContent = kr(p.price);
          $("#rmSelLink", root).href = "#produkt-" + p.handle; { const sz = $("#rmSize", root), [a, b] = span(it.h); sz.min = a.toFixed(1); sz.max = b.toFixed(1); sz.value = it.w; sz.dataset.base = it.w0 || spotFor(p, [], true).w; sizeText(sz);
            $('[data-act="bigger"]', root).setAttribute("aria-disabled", it.w >= b - 0.05); $('[data-act="smaller"]', root).setAttribute("aria-disabled", it.w <= a + 0.05); } $("#rmLight", root).value = it.light;
          $("#rmActOrder", root).textContent = it.back ? "Framför" : "Bakom"; $("#rmActOrderB", root).setAttribute("aria-label", it.back ? "Lägg framför" : "Lägg bakom");
          $("#rmActName", root).textContent = p.name; paintOn(it);
          // honest about size: true scale, or the measurements and how to get there, or approximate
          const z = measures(p); $("#rmReal", root).innerHTML = !z ? "Storleken är ungefärlig." : it.real ? `${z}, i rätt skala.` : room && (room.known || mapOf()) ? `${z}. <button type="button" class="tlink" data-real>Rätt storlek</button>` : `${z}. <button type="button" class="tlink" data-measure>Visa i rätt skala</button>`;
        };
        /* "Står på: bord ▾": where the selected thing stands, and the other places it can be (one tap to correct a wrong guess) */
        const ON_WORD = (it, s) => (s === "vagg" ? "Hänger på" : (s === "golv" && kindOf(RQ.byHandle(it.h)) === "rug") || ((s === "soffa" || s === "sang") && kindOf(RQ.byHandle(it.h)) !== "surface") ? "Ligger på" : "Står på");
        const paintOn = (it) => { const k = kindOf(RQ.byHandle(it.h)), cur = surfOf(it), opts = [...new Set([...(CAN[k] || [cur]), cur])];
          [["#rmOn", "#rmOnb", "#rmOnL"], ["#rmOn2", "#rmOn2b", "#rmOnL2"]].forEach(([sq, bq, lq]) => { const sel = $(sq, root), one = $(bq, root);
            $(lq, root).textContent = ON_WORD(it, cur) + (opts.length > 1 ? "" : ":"); sel.hidden = opts.length < 2; one.hidden = opts.length > 1; one.textContent = SURF[cur];
            sel.innerHTML = opts.map((o) => `<option value="${o}"${o === cur ? " selected" : ""}>${SURF[o]}</option>`).join(""); }); };
        const setOn = (h, to) => { const it = R.scene().find((x) => x.h === h); if (!it || surfOf(it) === to) return; const p = RQ.byHandle(h), k = kindOf(p), patch = { on: to };
          // in a sample room the place is known: the thing moves there (a lamp to the floor beside the sofa, a print onto the table)
          const was = kindAt(surfOf(it), k), now = kindAt(to, k);
          patch.row = undefined; const M = mapOf(), cm = meta(p)[1];
          if (M && was !== now) {
            const near = (list) => list.slice().sort((a, b) => Math.abs(a[0] - it.x) - Math.abs(b[0] - it.x))[0];
            if (now === "floor" && M.floor.length) { const y = +Math.max(it.y + 2, near(M.floor)[1]).toFixed(1); Object.assign(patch, { y, w: +clamp(cm * floorScale(y, M) / 100, 2.5, 70).toFixed(1) }); } // straight down to the floor
            else if (now === "wall" && M.wall.length) { const sp = near(M.wall); Object.assign(patch, { y: sp[1], w: +clamp(cm * sp[2] / 100, 2.5, 70).toFixed(1) }); } // straight up onto the wall
            else { const sp = spotFor(p, R.scene().filter((x) => x.h !== h), true, null, now); if (sp) Object.assign(patch, { x: sp.x, y: sp.y, w: sp.w }, sp.sy ? { sy: sp.sy } : {}); } }
          R.update(h, patch); const nw = R.scene().find((x) => x.h === h); if (nw) { lookAt([nw]); learn(h, nw); } said(`${ON_WORD(it, to)} ${SURF[to]}.`); };
        ["#rmOn", "#rmOn2"].forEach((q) => $(q, root).addEventListener("change", (e) => { if (sel) setOn(sel, e.target.value); }));
        const select = (h) => { if (swap && swap.h && swap.h !== h) { swap.h = null; paintSwap(); } sel = h; $$(".rm-item", wrap).forEach((el) => el.classList.toggle("sel", el.dataset.h === h)); $$("#rmList li", root).forEach((li) => li.classList.toggle("on", !!$(`[data-pick="${h}"]`, li))); paintSel(); paintFoot(); };
        /* the selected thing at true scale: its measurements beside it, and for a rug the floor it covers, dashed */
        const paintFoot = (cur) => { const it = cur || (sel && R.scene().find((x) => x.h === sel)), poly = $("#rmArea polygon", root), lab = $("#rmAreaLab", root);
          if (!it || !it.real || !scaleAt(it)) { poly.setAttribute("points", ""); lab.hidden = true; return; }
          const p = RQ.byHandle(it.h), kind = kindOf(p), hgt = it.w * meta(p)[2] * (it.sy || 1) * room.w / room.h, f = (v) => v.toFixed(2);
          const b = kind === "rug" && rugBack(it); poly.setAttribute("points", b ? [[it.x - it.w / 2, it.y], [it.x + it.w / 2, it.y], [it.x + b.w / 2, b.y], [it.x - b.w / 2, b.y]].map(([x, y]) => `${f(x)},${f(y)}`).join(" ") : "");
          lab.hidden = false; lab.textContent = measures(p); lab.style.left = it.x + "%"; lab.style.top = (b ? (it.y + b.y) / 2 : kind === "wall" ? Math.min(98, it.y + 0.8) : it.y - hgt / 2) + "%"; lab.classList.toggle("under", kind === "wall" && !b); };
        const live = (h, patch) => { const el = $(`.rm-item[data-h="${h}"]`, wrap); if (!el) return; if (patch.x != null) el.style.left = patch.x + "%"; if (patch.y != null) el.style.top = patch.y + "%"; if (patch.w != null) { el.style.width = patch.w + "%"; el.style.setProperty("--w", patch.w); } };
        /* a size you choose in your own photo teaches the room its scale: the next things follow it */
        const learn = (h, it) => { if (mapOf()) return; const p = RQ.byHandle(h), [, cm] = meta(p), kind = effKind(it), L = ls.get(LEARN, {}) || {}, base = it.row ? cm * (it.on === "bord" ? 30 : floorScale(it.y)) / 100 : spotFor(p, [], true, null, kind).w; // a thing in the row: measured against the row's own scale
          L[kind] = { x: +it.x.toFixed(1), y: +it.y.toFixed(1), s: +(it.w / cm * 100).toFixed(2), w: +it.w.toFixed(1), sy: it.sy };
          if (kind !== "rug" && kind !== "window" && base > 0) L.k = +clamp(it.w / base, 0.4, 3).toFixed(2);
          ls.set(LEARN, L); };
        /* how small and how big a thing may be made: around the size it was put in at (half to twice the size in
           a mapped sample room; wider in your own photo, where the first size is only a guess), so one click never makes a giant */
        const span = (h) => { const p = RQ.byHandle(h); if (!p) return [2.5, 96]; const b = spotFor(p, [], true).w, own = !mapOf(); return [Math.max(2.5, b * (own ? 0.35 : 0.5)), Math.min(96, b * (own ? 4 : 2))]; };
        const fit = (h, w) => { const [a, b] = span(h); return clamp(w, a, b); };
        const resize = (h, w, tag) => { const it = R.scene().find((x) => x.h === h); if (!it) return; w = +fit(h, w).toFixed(1); if (w === it.w) return; R.update(h, { w, real: false }, tag); learn(h, { ...it, w }); }; // a size of your own: no longer the true scale
        const removeIt = (h) => { const p = RQ.byHandle(h); if (sel === h) sel = null; R.remove(h); RQ.toast(`${esc(p.name)} är borttagen.`); }; // Ångra is the button on the room, one is enough

        // gestures: one finger on a thing moves it, one finger on the room pans it sideways (up and down scrolls the page),
        // two fingers resize the selected thing or, with nothing selected, zoom the room
        const pts = new Map(); let drag = null, pinch = null, pan = null;
        const far = (a, e) => Math.hypot(e.clientX - a.sx, e.clientY - a.sy) > 6;
        stage.addEventListener("pointerdown", (e) => {
          if (!e.target.closest(".rm-hold,.rm-zoom,.rm-undo,.rm-nightchip")) stopGlide();
          if (meas) { if (e.target.closest(".rm-zoom") || !e.isPrimary) return; e.preventDefault(); try { stage.setPointerCapture(e.pointerId); } catch (x) {} // drawing the line: a handle moves its end, anywhere else starts a new line
            const r = canvas.getBoundingClientRect(), at = (ev) => [+clamp((ev.clientX - r.left) / r.width * 100, 0, 100).toFixed(2), +clamp((ev.clientY - r.top) / r.height * 100, 0, 100).toFixed(2)], hd = e.target.closest(".rm-rh"), [x, y] = at(e);
            mdrag = hd ? { end: hd.dataset.end, at } : { end: "2", at, was: { ...meas } }; if (!hd) Object.assign(meas, { x1: x, y1: y, x2: x, y2: y }); paintRuler(); return; }
          const el = e.target.closest(".rm-item");
          if (e.target.closest(".rm-hold,.rm-emptyhint,.rm-zoom,.rm-undo,.rm-nightchip")) return;
          if (e.isPrimary) { pts.clear(); pinch = drag = pan = null; } // a first finger starts afresh, whatever an interrupted gesture left behind
          pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
          try { stage.setPointerCapture(e.pointerId); } catch (x) {}
          if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y) || 1; const it = sel && R.scene().find((x) => x.h === sel);
            if (it) pinch = { d, w: it.w };
            else if (view.on) { const r = stage.getBoundingClientRect(); pinch = { d, z: view.z, cx: (a.x + b.x) / 2 - r.left, cy: (a.y + b.y) / 2 - r.top, tx: view.tx, ty: view.ty }; canvas.classList.remove("glide"); }
            drag = pan = null; return; }
          if (el) { select(el.dataset.h); const it = R.scene().find((x) => x.h === el.dataset.h); if (!it) return; const r = canvas.getBoundingClientRect(); const kind = kindOf(RQ.byHandle(it.h));
            drag = { h: el.dataset.h, el, sx: e.clientX, sy: e.clientY, ox: it.x, oy: it.y, ow: it.w, w: it.w, kind, on: surfOf(it), row: !!it.row, real: !!it.real, r, x: it.x, y: it.y, hp: el.offsetHeight / Math.max(1, canvas.offsetHeight) * 100, moved: false }; }
          else if (pts.size === 1) pan = { sx: e.clientX, sy: e.clientY, tx: view.tx, ty: view.ty, moved: false };
        });
        stage.addEventListener("pointermove", (e) => {
          if (mdrag) { const [x, y] = mdrag.at(e); meas["x" + mdrag.end] = x; meas["y" + mdrag.end] = y; paintRuler(); return; }
          if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (pinch && pts.size >= 2) { const [a, b] = [...pts.values()], k = Math.hypot(a.x - b.x, a.y - b.y) / pinch.d;
            if (pinch.w != null) { const w = fit(sel, pinch.w * k), sz = $("#rmSize", root); pinch.cur = w; live(sel, { w }); sz.value = w; sizeText(sz); }
            else { const z = clamp(pinch.z * k, 1, 3.2); view.tx = pinch.cx - (pinch.cx - pinch.tx) * z / pinch.z; view.ty = pinch.cy - (pinch.cy - pinch.ty) * z / pinch.z; view.z = z; paintView(); }
            return; }
          if (pan) { if (!pan.moved && !far(pan, e)) return; if (!pan.moved) canvas.classList.remove("glide"); pan.moved = true; if (!view.on) return; view.tx = pan.tx + e.clientX - pan.sx; if (view.z > 1.01) view.ty = pan.ty + e.clientY - pan.sy; paintView(); return; }
          if (!drag) return; e.preventDefault();
          if (!drag.moved) { if (!far(drag, e)) return; drag.moved = true; drag.el.style.zIndex = 99; drag.el.classList.remove("land"); } // a tap with a trembling finger is not a move
          drag.x = drag.ox + (e.clientX - drag.sx) / drag.r.width * 100;
          drag.y = drag.oy + (e.clientY - drag.sy) / drag.r.height * 100;
          // on the floor, closer to the camera is bigger: the size follows the depth
          if (drag.real) { const tw = trueW({ ...R.scene().find((x) => x.h === drag.h), x: drag.x, y: drag.y }); if (tw) drag.w = tw; }
          else if (drag.on === "golv" && (!drag.row || drag.kind === "floor" || drag.kind === "rug")) { const hz = (mapOf() || GENERIC).h; if (drag.oy - hz > 6) drag.w = fit(drag.h, drag.ow * clamp((clamp(drag.y, 8, 104) - hz) / (drag.oy - hz), 0.35, 2.6)); }
          [drag.x, drag.y] = inside(drag.x, drag.y, drag.w, drag.hp * drag.w / drag.ow);
          live(drag.h, { x: drag.x, y: drag.y, w: drag.w }); if (drag.real) paintFoot({ ...R.scene().find((x) => x.h === drag.h), x: drag.x, y: drag.y, w: drag.w });
        });
        /* a thing stays inside the picture: at most a third of it may hang over the sides or the top. Below, where it
           stands, only a sliver (under a tenth of its height, at most 4 % of the picture): a small thing is not lost under the edge */
        const inside = (x, y, w, hp) => [clamp(x, Math.min(50, w / 6), Math.max(50, 100 - w / 6)), clamp(y, Math.min(60, hp * 0.67), 100 + Math.min(4, hp * 0.08))];
        const up = (e) => {
          if (mdrag) { const d = mdrag; mdrag = null; if (d.was && lenPct(meas) < 2) Object.assign(meas, d.was); paintRuler(); return; } // a tap is not a line: the old one stays
          if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId);
          if (pinch) { if (pts.size < 2) { if (pinch.cur) resize(sel, pinch.cur); pinch = null; } return; }
          if (pan) { const p = pan; pan = null; if (!p.moved && e.type === "pointerup") select(null); return; }
          if (drag) { const d = drag; drag = null; if (!d.moved) return;
            const it = R.scene().find((x) => x.h === d.h); if (!it) return;
            const next = { x: +d.x.toFixed(1), y: +d.y.toFixed(1), w: +d.w.toFixed(1), sg: undefined, ...(it.row ? { row: undefined, on: undefined } : {}) };
            R.update(d.h, next); learn(d.h, { ...it, ...next }); refocus(d.h); } // the room is drawn again: the moved thing keeps the focus, so the keys go on working
        };
        stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", up);
        // the wheel changes the size only when you mean it: over the selected thing, or with Ctrl held. Otherwise the page scrolls.
        stage.addEventListener("wheel", (e) => { if (!sel || meas) return; const over = e.target.closest(".rm-item"); if (!e.ctrlKey && !(over && over.dataset.h === sel)) return; e.preventDefault(); const it = R.scene().find((x) => x.h === sel); resize(sel, it.w * (e.deltaY < 0 ? 1.06 : 1 / 1.06), "size:" + sel); }, { passive: false });
        const refocus = (h) => setTimeout(() => { const el = h && $(`.rm-item[data-h="${h}"]`, wrap); (el || $("#rmAdd", root)).focus({ preventScroll: true }); }, 0);
        stage.addEventListener("keydown", (e) => { const el = e.target.closest(".rm-item"); if (!el) return; const it = R.scene().find((x) => x.h === el.dataset.h); if (!it) return; const d = e.shiftKey ? 5 : 1;
          const m = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }[e.key];
          if (m) { e.preventDefault(); sel = it.h; const [x, y] = inside(it.x + m[0], it.y + m[1], it.w, el.offsetHeight / Math.max(1, canvas.offsetHeight) * 100); R.update(it.h, { x, y }, "key:" + it.h); refocus(it.h); said("Flyttad."); }
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(it.h); }
          if (e.key === "+" || e.key === "-") { e.preventDefault(); sel = it.h; const w = +fit(it.h, it.w * (e.key === "+" ? 1.08 : 1 / 1.08)).toFixed(1); resize(it.h, w, "size:" + it.h); refocus(it.h); said(w === it.w ? (e.key === "+" ? "Största storleken." : "Minsta storleken.") : `Storlek ${Math.round(w / (it.w0 || spotFor(RQ.byHandle(it.h), [], true).w) * 100)} %.`); }
          if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); const l = R.ordered().map((x) => x.h), i = l.indexOf(it.h), nm = (RQ.byHandle(it.h) || {}).name || ""; removeIt(it.h); refocus(l[i + 1] || l[i - 1]); said(`${nm} är borttagen.`); } });
        // what the keys and the arrow buttons did, read out (the room itself is a picture)
        const said = (t) => { const s = $("#rmSaid", root); if (s) { s.textContent = ""; setTimeout(() => { s.textContent = t; }, 30); } };
        // moving without dragging (2.5.7): the arrows in the panel nudge the chosen thing, like the arrow keys
        $("#rmSel", root).addEventListener("click", (e) => { const b = e.target.closest("[data-mv]"); if (!b || !sel) return; const it = R.scene().find((x) => x.h === sel), el = it && $(`.rm-item[data-h="${it.h}"]`, wrap); if (!el) return;
          const [dx, dy] = b.dataset.mv.split(",").map(Number), [x, y] = inside(it.x + dx, it.y + dy, it.w, el.offsetHeight / Math.max(1, canvas.offsetHeight) * 100); R.update(it.h, { x, y }, "key:" + it.h); said("Flyttad."); });
        // Ctrl+Z (⌘Z): everywhere on the page except in a text field, where it undoes the typing. The sliders count as the room.
        const undoKey = (e) => { const t = e.target || {}; if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key || "").toLowerCase() === "z" && !/^(TEXTAREA|SELECT)$/.test(t.tagName || "") && !(t.tagName === "INPUT" && t.type !== "range") && !t.isContentEditable && R.canUndo()) { e.preventDefault(); R.undo(); RQ.toast("Ångrat."); } };
        // the Ångra button on the room: there as soon as something has changed here, gone when there is nothing left to take back
        let touched = false; const undoBtn = $("#rmUndo", root);
        const paintUndo = () => { const on = touched && R.canUndo(); if (!on && document.activeElement === undoBtn) $("#rmAdd", root).focus({ preventScroll: true }); undoBtn.hidden = !on; };
        undoBtn.addEventListener("click", () => { if (R.undo()) said("Ångrat."); });
        document.addEventListener("keydown", undoKey);
        $("#rmZoom", root).addEventListener("click", () => { view.fit = 0; if (view.z > 1.01 && !view.whole) { view.z = 1; paintView(true); return; } view.whole = !view.whole; ls.set("rumiq-room-view", view.whole ? "whole" : "near"); stage.classList.add("resize"); layout(); setTimeout(() => stage.classList.remove("resize"), 450); });
        let lw = innerWidth; const onResize = () => { toastAt(); if (innerWidth === lw && view.on) return; lw = innerWidth; view.fit = 0; layout(); }; // a phone's address bar comes and goes: only a new width is a new layout
        addEventListener("resize", onResize);
        // messages come in over the top edge of the room picture (site.css), so they cover neither the title nor the controls
        const rootS = document.documentElement.style; let tRaf = 0;
        const toastAt = () => { tRaf = 0; const r = stage.getBoundingClientRect(); rootS.setProperty("--rm-toast-top", Math.round(Math.min(innerHeight * 0.5, r.top + 12)) + "px"); const hb = $("#rmHold", root).getBoundingClientRect(); rootS.setProperty("--rm-toast-l", Math.round(Math.max(0, (hb.width ? hb.right : r.left) + 8)) + "px"); /* beside Håll för före, not over it */ rootS.setProperty("--rm-toast-r", Math.round(Math.max(0, innerWidth - r.right + 8)) + "px"); };
        const onScroll = () => { if (!tRaf) tRaf = requestAnimationFrame(toastAt); };
        addEventListener("scroll", onScroll, { passive: true });
        // see the room as it is: hold the button on the photo, or switch it on in the menu
        const before = $("#rmBefore", root);
        const show = (on) => { stage.classList.toggle("before", on); $("#rmHold", root).classList.toggle("on", on); before.setAttribute("aria-checked", on); };
        const hold = $("#rmHold", root);
        hold.addEventListener("pointerdown", (e) => { e.preventDefault(); show(true); });
        ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => hold.addEventListener(ev, () => show(false)));
        hold.addEventListener("contextmenu", (e) => e.preventDefault());
        hold.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); show(true); } });
        hold.addEventListener("keyup", () => show(false));
        before.addEventListener("click", () => show(before.getAttribute("aria-checked") !== "true"));
        // "Mer": everything that is not Lägg till, Inred åt mig or Spara
        const more = $("#rmMore", root), menu = $("#rmMenu", root);
        const openMenu = (on, focus) => { menu.hidden = !on; more.setAttribute("aria-expanded", on); more.classList.toggle("on", on); if (on && focus) $("button", menu).focus(); };
        more.addEventListener("click", () => openMenu(menu.hidden, true));
        menu.addEventListener("click", (e) => { if (e.target.closest("button")) openMenu(false); });
        menu.addEventListener("keydown", (e) => {
          const items = $$("button", menu), i = items.indexOf(document.activeElement);
          if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length].focus(); }
          if (e.key === "Escape") { e.stopPropagation(); openMenu(false); more.focus(); }
          if (e.key === "Tab") openMenu(false);
        });
        const away = (e) => { if (!menu.hidden && !e.target.closest(".rm-morewrap")) openMenu(false); };
        document.addEventListener("pointerdown", away);
        // controls
        $("#rmSize", root).addEventListener("input", (e) => { sizeText(e.target); if (sel) live(sel, { w: +e.target.value }); });
        $("#rmSize", root).addEventListener("change", (e) => { if (sel) resize(sel, +e.target.value, "size:" + sel); });
        $("#rmLight", root).addEventListener("input", (e) => { if (!sel) return; const im = $(`.rm-item[data-h="${sel}"] img`, wrap); if (im) im.style.filter = lightFilter(+e.target.value); });
        $("#rmLight", root).addEventListener("change", (e) => { if (sel) R.update(sel, { light: +e.target.value }, "light:" + sel); });
        const flip = () => { const it = R.scene().find((x) => x.h === sel); if (it) R.update(sel, { flip: !it.flip }); };
        $("#rmFlip", root).addEventListener("click", flip);
        $("#rmFront", root).addEventListener("click", () => { if (sel) R.toFront(sel); });
        $("#rmBack", root).addEventListener("click", () => { if (sel) R.toBack(sel); });
        $("#rmDel", root).addEventListener("click", () => { if (sel) removeIt(sel); });
        $("#rmAct", root).addEventListener("click", (e) => { const b = e.target.closest("[data-act]"); if (!b || !sel) return; const it = R.scene().find((x) => x.h === sel); if (!it) return; const a = b.dataset.act;
          if (a === "smaller") resize(sel, it.w / 1.12); if (a === "bigger") resize(sel, it.w * 1.12); if (a === "flip") flip();
          if (a === "order") { if (it.back) R.toFront(sel); else R.toBack(sel); } if (a === "del") removeIt(sel); if (a === "done") select(null); });
        root.addEventListener("click", (e) => { const b = e.target.closest("[data-roomtype]"); if (!b) return; R.setType(b.dataset.roomtype); $$("#rmAsk, .rm-hintask", root).forEach((x) => x.remove()); const t = $("#rmHintT", root); if (t) t.textContent = "Rummet är tomt.";
          $("#rmSuggest0", root).hidden = false; if (b.closest("#rmHint")) $("#rmSuggest0", root).focus({ preventScroll: true }); fits();
          if (wantSuggest) { wantSuggest = false; suggest(); } else RQ.toast("Tack. Nu föreslår vi sådant som passar där."); });
        root.addEventListener("click", (e) => {
          const pk = e.target.closest("[data-pick]"); if (pk) { select(pk.dataset.pick); const it = R.scene().find((x) => x.h === pk.dataset.pick); if (it) lookAt([it]); if (innerWidth <= 900) stage.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
          const dl = e.target.closest("[data-del]"); if (dl) removeIt(dl.dataset.del);
        });
        let wantSuggest = false;
        /* ---- Inred åt mig: a ready set for this room, in a style and within a budget if you like (both optional).
           The set's things are marked (sg); a new set replaces them, while what you moved or swapped stays. One step for Ångra. */
        const want0 = R._want || {}; R._want = null;
        // the style and budget last used for this room stay with it (after a reload too); a project's own style comes first
        const SGK = "rumiq-room-sg", sgKey = () => String(keyNow() || (room && (room.map || room.at)) || ""), sgOld = (ls.get(SGK, {}) || {})[sgKey()] || {};
        const prNow = projOf(RQ.hem && RQ.hem.activeId ? RQ.hem.activeId() : null);
        const sg = { style: want0.style || (prNow && RQ.STYLES[prNow.style] ? prNow.style : null) || sgOld.style || null, budget: want0.budget || (prNow && prNow.budget) || sgOld.budget || null, avoid: [], left: [], noRoom: [], note: "", shown: false, count: 0, bought: "" };
        const sgKeep = () => { const all = ls.get(SGK, {}) || {}; all[sgKey()] = { style: sg.style, budget: sg.budget }; const ks = Object.keys(all); if (ks.length > 12) delete all[ks[0]]; ls.set(SGK, all); };
        const styleWord = () => RQ.STYLES[sg.style].name.split(" ")[0].toLowerCase();
        const suggest = (again) => {
          if (!mapOf() && !room.type) { // your own photo: which room it is comes first, then the suggestions fit
            wantSuggest = true; const a = !$("#rmHint", root).hidden && $(".rm-hintask", root) ? $("#rmHint", root) : $("#rmAsk", root);
            if (a) { a.classList.remove("ask-now"); void a.offsetWidth; a.classList.add("ask-now"); a.scrollIntoView({ block: "nearest", behavior: calm() ? "auto" : "smooth" }); const c = $("[data-roomtype]", a); if (c) c.focus({ preventScroll: true }); }
            said("Välj först vilket rum det är."); return; }
          const first = !!mapOf() && !ls.get("rumiq-room-landed", false), old = R.scene().filter((it) => it.sg).map((it) => it.h);
          if (again === true) sg.avoid = [...new Set([...sg.avoid, ...old])].slice(-14);
          const set = R.suggestSet({ style: sg.style, budget: sg.budget, avoid: sg.avoid }); if (!set.items.length && !set.count) sg.avoid = [];
          Object.assign(sg, { left: set.left, noRoom: set.noRoom, full: set.fullTotal, min: set.min, count: set.count, shown: true, note: "" }); sgKeep();
          // the set replaces the proposal that stood there (one step for Ångra); what you moved or swapped yourself stays
          const n = R.group(() => { R.saveScene(R.scene().filter((it) => !it.sg)); const put = set.items.filter((it) => R.add(it.h, true, it.v)).map((it) => it.h);
            const list = R.scene(), out = list.filter((it) => put.includes(it.h) && R.homeless(it)).map((it) => it.h); if (out.length) sg.noRoom = [...sg.noRoom, ...out];
            R.saveScene(list.filter((it) => !out.includes(it.h)).map((it) => (put.includes(it.h) ? { ...it, sg: true } : it))); return put.length - out.length; });
          if (!n) sg.note = !set.count ? (sg.style ? "Inget mer i stilen passar i rummet just nu. Välj en annan stil." : "Inget mer passar i rummet just nu.") : `Budgeten räcker inte till något${sg.style ? " i stilen" : ""}. Det billigaste kostar ${kr(set.min)}.`;
          paintSugg();
          if (!n) { said(sg.note); return; }
          if (first || !mapOf()) return; // the room itself says it ("Så här kan det se ut hemma hos dig", "Dra sakerna dit du vill ha dem"): one message at a time
          said(`${n} förslag i rummet${old.length ? " i stället för det förra" : ""}.`);
        };
        const STY = [["", "Alla stilar"], ...Object.entries(RQ.STYLES).map(([k, v]) => [k, v.name.split(" ")[0]])];
        const step50 = (v, up) => (up ? Math.ceil(v / 50) * 50 : Math.floor(v / 50) * 50);
        const names = (hs) => hs.map((h) => `<b>${esc(RQ.byHandle(h).name)}</b>`).join(" · ");
        const paintSugg = () => { const bx = $("#rmSugg", root), its = R.scene().filter((it) => it.sg); bx.hidden = !sg.shown;
          if (bx.hidden) return; const tot = its.reduce((t, it) => t + RQ.byHandle(it.h).price, 0), lo = step50(Math.max(100, sg.min || 100), true), hi = Math.max(lo + 50, step50(sg.full || tot, true)), b = sg.budget ? clamp(sg.budget, lo, hi) : hi;
          const all = Math.max(sg.count || 0, its.length), hs = its.map((it) => it.h + "::" + (it.v || 0)).sort().join(","), inCart = !!(its.length && RQ.allInCart && RQ.allInCart(its.map((it) => it.h)));
          const focus = document.activeElement && bx.contains(document.activeElement) ? document.activeElement.dataset.sgk || document.activeElement.id : null;
          bx.innerHTML = `<div class="rm-sugg-h"><div><b>Förslag${sg.style ? ` i ${esc(styleWord())} stil` : ""}</b><span>${its.length} ${its.length === 1 ? "sak" : "saker"} · ${kr(tot)}</span></div>${inCart || sg.bought === hs ? `<button class="btn sm ghost" type="button" id="rmSgBuy" data-open-cart>I varukorgen ✓</button>` : `<button class="btn sm" type="button" id="rmSgBuy"${its.length ? "" : " disabled"}>Köp förslaget</button>`}</div>
            <div class="chips rm-sugg-sty" role="group" aria-label="Stil">${STY.map(([k, n]) => `<button type="button" class="chip" data-sgk="sty-${k}" data-sty="${k}" aria-pressed="${(sg.style || "") === k}">${esc(n)}</button>`).join("")}</div>
            <label class="rm-sugg-b"><span>Budget <b id="rmSgBv">${sg.budget && sg.budget < hi ? kr(b) : "Hela rummet"}</b></span><input type="range" id="rmSgB" min="${lo}" max="${hi}" step="50" value="${b}" aria-valuetext="${sg.budget && sg.budget < hi ? kr(b) : "Hela rummet"}"></label>
            ${sg.note ? `<p class="small rm-sugg-left">${esc(sg.note)}</p>` : ""}
            ${sg.left.length ? `<p class="small rm-sugg-left">Budgeten räcker till ${its.length} av ${all}. Kvar att lägga till: ${names(sg.left)}.</p>` : ""}
            ${sg.noRoom.length ? `<p class="small rm-sugg-left">Får inte plats på ett bord i rummet: ${names(sg.noRoom)}.</p>` : ""}
            <button type="button" class="tlink" data-sgk="again" id="rmSgAgain">Ett annat förslag</button>`;
          if (focus) { const f = $(`[data-sgk="${focus}"], #${focus}`, bx); if (f) f.focus({ preventScroll: true }); } };
        // a set handed over (Svep, a proposal, a moodboard) is shown as the room's proposal, with what had to be left out
        if (R.scene().some((it) => it.sg) && (R._leftOut || []).length) { const its = R.scene().filter((it) => it.sg); Object.assign(sg, { shown: true, noRoom: R._leftOut.slice(), count: its.length, full: its.reduce((t, it) => t + RQ.byHandle(it.h).price, 0), min: Math.min(...its.map((it) => RQ.byHandle(it.h).price)) }); R._leftOut = []; setTimeout(paintSugg, 0); }
        $("#rmSugg", root).addEventListener("click", (e) => { const t = e.target.closest("[data-sty]"); if (t) { sg.style = t.dataset.sty || null; sg.avoid = []; suggest(); return; }
          if (e.target.closest("#rmSgAgain")) { suggest(true); return; }
          const bb = e.target.closest("#rmSgBuy"); if (bb && !bb.hasAttribute("data-open-cart") && RQ.addMany) { const its = R.scene().filter((it) => it.sg);
            if (RQ.addMany(its.map((it) => it.h + "::" + (it.v || 0)), bb, sg.style ? `Förslaget i ${styleWord()} stil` : "Förslaget")) { sg.bought = its.map((it) => it.h + "::" + (it.v || 0)).sort().join(","); setTimeout(() => { paintSugg(); const f = $("#rmSgBuy", root); if (f) f.focus({ preventScroll: true }); }, 0); } } });
        $("#rmSugg", root).addEventListener("input", (e) => { if (e.target.id !== "rmSgB") return; const v = +e.target.value, hi = +e.target.max; $("#rmSgBv", root).textContent = v >= hi ? "Hela rummet" : kr(v); });
        $("#rmSugg", root).addEventListener("change", (e) => { if (e.target.id !== "rmSgB") return; const v = +e.target.value; sg.budget = v >= +e.target.max ? null : v; sg.avoid = []; suggest(); });

        /* ---- Byt och jämför: the selected thing's colours and what could stand in its place, swapped in one tap; up to three side by side */
        const swap = { h: null, cmp: false, pick: [] };
        const swapBox = $("#rmSwap", root);
        const paintSwap = () => { const it = swap.h && R.scene().find((x) => x.h === swap.h); swapBox.hidden = !it; box.classList.toggle("swapping", !!it); if (!it) return;
          const p = RQ.byHandle(it.h), alts = R.alternatives(it.h), vs = p.variants || [];
          swapBox.innerHTML = `<div class="rm-swap-h"><b>Byt ${esc(p.name)}</b><div><button type="button" class="chip" id="rmCmpT" aria-pressed="${swap.cmp}">Jämför</button><button type="button" class="iconbtn" id="rmSwapX" aria-label="Stäng Byt"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div></div>
            ${vs.length > 1 ? `<div class="rm-swap-col"><span class="small">Färg</span><div class="chips" role="group" aria-label="Färg på ${esc(p.name)}">${vs.map((v, i) => `<button type="button" class="chip" data-swv="${i}" aria-pressed="${(it.v || 0) === i}"><i style="background:${esc(p.tone[i] || p.tone[0])}"></i>${esc(v)}</button>`).join("")}</div>${it.v > 0 ? `<span class="small rm-swap-note">Färgen i bilden är ungefärlig.</span>` : ""}</div>` : ""}
            ${alts.length ? `<p class="small rm-swap-lead">${swap.cmp ? "Välj upp till två att jämföra med." : "Andra som passar här"}</p><div class="rm-swap-row">${alts.map((q) => `<button type="button" class="rm-alt" data-alt="${q.handle}"${swap.cmp ? ` aria-pressed="${swap.pick.includes(q.handle)}"` : ""}><span class="rm-alt-im"><img src="${RQ.cut(q)}" alt="" loading="lazy"></span><b>${esc(q.name)}</b><span>${kr(q.price)}</span></button>`).join("")}</div>` : `<p class="small rm-swap-lead">Inget annat i sortimentet passar på samma plats än.</p>`}
            ${swap.cmp ? `<button class="btn sm" type="button" id="rmCmpGo"${swap.pick.length ? "" : " disabled"}>Jämför ${swap.pick.length + 1} i rummet</button>` : ""}`; };
        const openSwap = (h, focus) => { if (!h) return; if (sel !== h) select(h); swap.h = h; swap.cmp = false; swap.pick = []; paintSwap(); if (innerWidth <= 900) swapBox.scrollIntoView({ block: "nearest", behavior: calm() ? "auto" : "smooth" }); const f = $(focus || "[data-swv][aria-pressed=true], .rm-alt", swapBox); if (f) setTimeout(() => f.focus({ preventScroll: true }), 30); };
        const closeSwap = () => { swap.h = null; paintSwap(); };
        root.addEventListener("click", (e) => { if (e.target.closest("[data-swap-open]") && sel) openSwap(sel); });
        swapBox.addEventListener("click", (e) => {
          if (e.target.closest("#rmSwapX")) { closeSwap(); return; }
          if (e.target.closest("#rmCmpT")) { swap.cmp = !swap.cmp; swap.pick = []; paintSwap(); $("#rmCmpT", swapBox).focus(); return; }
          const v = e.target.closest("[data-swv]"); if (v) { const nv = +v.dataset.swv; R.swapWith(swap.h, swap.h, nv); said(`${RQ.byHandle(swap.h).variants[nv]}.`); return; }
          const a = e.target.closest("[data-alt]");
          if (a && swap.cmp) { const h = a.dataset.alt; swap.pick = swap.pick.includes(h) ? swap.pick.filter((x) => x !== h) : [...swap.pick, h].slice(-2); paintSwap(); const f = $(`[data-alt="${h}"]`, swapBox); if (f) f.focus({ preventScroll: true }); return; }
          if (a) { const from = swap.h, to = a.dataset.alt; if (R.swapWith(from, to)) { sel = to; swap.h = to; said(`Bytt till ${RQ.byHandle(to).name}.`); RQ.toast(`Bytt till ${esc(RQ.byHandle(to).name)}. Ångra finns på rummet.`); } return; }
          if (e.target.closest("#rmCmpGo")) compare([swap.h, ...swap.pick]);
        });
        /* Jämför: the same room picture with each one in place, side by side (a swipe on a phone), one tap keeps one */
        const cmpEl = document.createElement("div"); cmpEl.className = "sheet rmcmp"; cmpEl.setAttribute("role", "dialog"); cmpEl.setAttribute("aria-modal", "true"); cmpEl.setAttribute("aria-labelledby", "cmpT"); document.body.appendChild(cmpEl);
        const itemHtml = (it, i) => { const p = RQ.byHandle(it.h), r = meta(p)[2]; return `<div class="rm-item k-${kindOf(p)}" style="left:${it.x}%;top:${it.y}%;width:${it.w}%;z-index:${i + 1}"><img src="${cutIn(p)}" alt="" style="${it.sy ? `aspect-ratio:1 / ${(r * it.sy).toFixed(3)};` : ""}transform:scaleX(${it.flip ? -1 : 1});filter:${lightFilter(it.light)}">${tintHtml(it, p)}</div>`; };
        let cmpBack = null;
        const compare = (hs) => { const base = R.scene(), cur = base.find((x) => x.h === hs[0]); if (!cur) return; cmpBack = document.activeElement;
          const opts = hs.map((h) => { if (h === cur.h) return { h, list: base }; const q = RQ.byHandle(h), r = meta(RQ.byHandle(cur.h))[1] > 0 ? meta(q)[1] / meta(RQ.byHandle(cur.h))[1] : 1, n = { ...cur, h, w: +clamp(cur.w * r, 1, 96).toFixed(1) }; delete n.v; delete n.real; const tw = trueW(n); if (tw) n.w = tw; return { h, list: base.map((x) => (x.h === cur.h ? n : x)) }; });
          const hgt = cur.w * meta(RQ.byHandle(cur.h))[2] * (cur.sy || 1) * room.w / room.h, z = clamp(30 / Math.max(cur.w, 4), 1, 2.4), ox = clamp(cur.x, 0, 100), oy = clamp(cur.y - hgt / 2, 0, 100);
          cmpEl.innerHTML = `<div class="sheet-scrim" data-cmp-close></div><div class="sheet-card wide"><span class="sheet-grip" aria-hidden="true"></span><button class="iconbtn sheet-x" type="button" data-cmp-close aria-label="Stäng"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
            <h2 id="cmpT">Jämför i ditt rum</h2><p class="lead">Samma rum, samma plats. Behåll den du gillar.</p>
            <div class="rm-cmp" style="--n:${opts.length}">${opts.map((o) => { const q = RQ.byHandle(o.h); return `<figure><div class="rm-cmp-pic" style="aspect-ratio:${room.w} / ${room.h}"><div class="rm-cmp-in" style="transform-origin:${ox}% ${oy}%;transform:scale(${z.toFixed(2)})"><img class="rm-bg" src="${R.url()}" alt=""><div class="rm-items">${orderOf(o.list).map(itemHtml).join("")}</div></div></div>
              <figcaption><b>${esc(q.name)}</b><span>${kr(q.price)}${o.h === cur.h ? " · nu i rummet" : ""}</span><button class="btn sm${o.h === cur.h ? " ghost" : ""}" type="button" data-keep="${o.h}">${o.h === cur.h ? "Behåll den här" : "Välj den här"}</button></figcaption></figure>`; }).join("")}</div></div>`;
          cmpEl.classList.add("open"); document.documentElement.style.overflow = "hidden"; setTimeout(() => $(".sheet-x", cmpEl).focus(), 60); };
        const closeCmp = () => { cmpEl.classList.remove("open"); document.documentElement.style.overflow = ""; if (cmpBack && document.contains(cmpBack)) cmpBack.focus({ preventScroll: true }); };
        cmpEl.addEventListener("click", (e) => { if (e.target.closest("[data-cmp-close]")) { closeCmp(); return; }
          const k = e.target.closest("[data-keep]"); if (!k) return; const to = k.dataset.keep; closeCmp(); if (to !== swap.h && R.swapWith(swap.h, to)) { sel = to; swap.h = to; RQ.toast(`${esc(RQ.byHandle(to).name)} står nu i rummet. Ångra finns på rummet.`); } swap.cmp = false; swap.pick = []; paintSwap(); });
        const escCmp = (e) => { if (e.key === "Escape" && cmpEl.classList.contains("open")) { e.stopImmediatePropagation(); closeCmp(); } else if (e.key === "Escape" && swap.h && !meas) closeSwap(); };
        document.addEventListener("keydown", escCmp, true);

        /* ---- your rooms (Mitt hem): one tap opens another one, with its things */
        root.addEventListener("click", (e) => { const b = e.target.closest("[data-proj]"); if (!b || !RQ.hem) return; const r = RQ.hem.room(b.dataset.proj); if (!r || b.getAttribute("aria-pressed") === "true") return;
          $$("[data-proj]", root).forEach((x) => x.setAttribute("aria-pressed", x === b)); R.openWith({ room: r.type, items: RQ.hem.items(r), style: r.style, budget: r.budget, project: r.id }); });
        $("#rmSuggest", root).addEventListener("click", () => suggest()); $("#rmSuggest0", root).addEventListener("click", () => suggest());
        $("#rmAdd", root).addEventListener("click", () => { select(null); if (view.on) scrollTo({ top: Math.max(0, stage.getBoundingClientRect().top + scrollY - ((document.querySelector("header") || {}).offsetHeight || 58) - 8) }); RQ.room.openPicker(); });
        $("#rmLook", root).addEventListener("click", () => { const hs = R.scene().map((it) => it.h); if (hs.length < 2) return;
          if (S.looks().some((l) => l.handles.join() === hs.join())) { RQ.toast('Den looken är redan sparad. <a href="#mitt-hem">Se Sparat</a>'); return; }
          S.saveLook(hs, "Mitt rum " + new Date().toLocaleDateString("sv-SE")); RQ.toast('Looken är sparad. <a href="#mitt-hem">Se Sparat</a>'); });
        $("#rmCart", root).addEventListener("click", (e) => R.cartAll(e.currentTarget)); $("#rmCart2", root).addEventListener("click", (e) => R.cartAll(e.currentTarget));
        ["#rmCart", "#rmCart2"].forEach((id) => paintCart.push(RQ.addAllBtn($(id, root), () => R.scene().map((it) => it.h), () => "Lägg allt i varukorgen")));
        // evening: the room dims and every lamp and candle you placed glows, so you see the light at home
        const night = $("#rmNight", root), nChip = $("#rmNightChip", root), setNight = (on) => { stage.classList.toggle("night", on); night.setAttribute("aria-checked", on); if (!on && document.activeElement === nChip) more.focus({ preventScroll: true }); nChip.hidden = !on; /* on the picture while it is on: it stays on between visits */ try { localStorage.setItem("rumiq-room-night", on ? "1" : "0"); } catch (e) {} };
        nChip.addEventListener("click", () => setNight(false));
        night.addEventListener("click", () => { setNight(!stage.classList.contains("night")); RQ.track && RQ.track("room_night", { on: stage.classList.contains("night") }); });
        try { if (localStorage.getItem("rumiq-room-night") === "1") setNight(true); } catch (e) {}
        let lastSave = "";
        /* the room with its things as one picture, W px wide (Spara, Visa någon) */
        const picture = async (W) => { const bg = $(".rm-bg", root), H = Math.round(W * room.h / room.w);
          const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const cx = cv.getContext("2d"); cx.drawImage(bg, 0, 0, W, H);
          for (const it of R.ordered()) {
            const p = RQ.byHandle(it.h); const im = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = cutIn(p); });
            const w = W * it.w / 100, h = w * im.naturalHeight / im.naturalWidth * (it.sy || 1), x = W * it.x / 100 - w / 2, y = H * it.y / 100 - h;
            if (["bord", "golv"].includes(surfOf(it)) && kindOf(p) !== "rug") { const g = cx.createRadialGradient(x + w / 2, y + h, 0, x + w / 2, y + h, w * 0.45); g.addColorStop(0, "rgba(0,0,0,.28)"); g.addColorStop(1, "rgba(0,0,0,0)"); cx.save(); cx.translate(0, y + h); cx.scale(1, 0.18); cx.translate(0, -(y + h)); cx.fillStyle = g; cx.fillRect(x - w * 0.1, y + h - w * 0.5, w * 1.2, w); cx.restore(); }
            let src = im; const tone = R.tint(it); if (tone) { const t = document.createElement("canvas"); t.width = Math.max(1, Math.round(w)); t.height = Math.max(1, Math.round(h)); const tx = t.getContext("2d"); tx.drawImage(im, 0, 0, t.width, t.height); tx.globalCompositeOperation = "color"; tx.fillStyle = tone; tx.fillRect(0, 0, t.width, t.height); tx.globalCompositeOperation = "destination-in"; tx.drawImage(im, 0, 0, t.width, t.height); src = t; } // the colour you chose (approximate)
            cx.save(); cx.filter = lightFilter(it.light); if (it.flip) { cx.translate(x + w, y); cx.scale(-1, 1); cx.drawImage(src, 0, 0, w, h); } else cx.drawImage(src, x, y, w, h); cx.restore();
          }
          return cv; };
        /* "Visa någon": before and after side by side (or one above the other for an upright photo), to share or keep */
        $("#rmLib", root).addEventListener("click", () => { RQ.ss.set("rumiq-ai-jump", "1"); location.hash = "#mitt-hem"; }); // Sparat opens at Mina rumsbilder (the same jump as the AI sheet's link)
        $("#rmShow", root).addEventListener("click", async () => {
          if (!R.scene().length) { RQ.toast("Ställ in något i rummet först, så finns det något att visa."); return; }
          try {
            const W = 1200, after = await picture(W), H = after.height, up = H > W * 1.05, g = 16, pad = 0;
            const cv = document.createElement("canvas"); cv.width = up ? W * 2 + g : W; cv.height = up ? H : H * 2 + g; const cx = cv.getContext("2d");
            cx.fillStyle = "#F7F7F4"; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage($(".rm-bg", root), pad, pad, W, H); cx.drawImage(after, up ? W + g : 0, up ? 0 : H + g);
            const tag = (t, x, y) => { cx.font = "600 30px 'Familjen Grotesk', system-ui, sans-serif"; const w = cx.measureText(t).width + 40; cx.fillStyle = "rgba(34,37,42,.78)"; cx.beginPath(); cx.roundRect ? cx.roundRect(x, y, w, 52, 26) : cx.rect(x, y, w, 52); cx.fill(); cx.fillStyle = "#fff"; cx.fillText(t, x + 20, y + 36); };
            tag("Före", 24, 24); tag("Efter", (up ? W + g : 0) + 24, (up ? 0 : H + g) + 24);
            cx.font = "500 26px 'Familjen Grotesk', system-ui, sans-serif"; cx.fillStyle = "rgba(255,255,255,.92)"; cx.shadowColor = "rgba(0,0,0,.45)"; cx.shadowBlur = 8; cx.textAlign = "right"; cx.fillText("RumIQ · Mitt rum", cv.width - 28, cv.height - 28);
            const blob = await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.88)), file = new File([blob], "mitt-rum-fore-efter.jpg", { type: "image/jpeg" });
            if (navigator.canShare && window.isSecureContext && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: "Mitt rum, före och efter" }); } catch (x) {} return; }
            const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
            RQ.toast("Bilden med före och efter är nedladdad. Visa den för vem du vill.");
          } catch (e) { RQ.toast("Bilden gick inte att göra i den här webbläsaren."); }
        });
        $("#rmSave", root).addEventListener("click", async () => {
          try {
            const key = JSON.stringify(R.scene()) + room.at;
            if (key === lastSave) { RQ.toast('Det här är redan sparat. <a href="#mitt-hem">Se Sparat</a>'); return; }
            const cv = await picture(1100), W = cv.width, H = cv.height, bg = $(".rm-bg", root);
            const before = document.createElement("canvas"); before.width = 480; before.height = Math.round(480 * H / W); before.getContext("2d").drawImage(bg, 0, 0, before.width, before.height);
            const handles = R.scene().map((it) => it.h);
            const ok = S.saveProject({ title: "Mitt rum med " + handles.map((h) => RQ.byHandle(h).name.split(" ")[0]).join(", "), img: cv.toDataURL("image/jpeg", 0.74), before: before.toDataURL("image/jpeg", 0.6), handles });
            if (!ok) { RQ.toast("Webbläsarens lagring är full. Ta bort ett gammalt projekt under Sparat."); return; }
            lastSave = key; document.dispatchEvent(new CustomEvent("rq-room-saved", { detail: { project: (S.projects()[0] || {}).id || null, active: RQ.hem && RQ.hem.activeId ? RQ.hem.activeId() : null, handles, img: cv.toDataURL("image/jpeg", 0.74) } })); // Spara happened
            if (navigator.canShare && window.isSecureContext) {
              const blob = await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.86)); const file = new File([blob], "mitt-rum.jpg", { type: "image/jpeg" });
              if (navigator.canShare({ files: [file] })) { RQ.toast('Rummet är sparat under Sparat. <a href="#" data-share-room>Dela bilden</a>'); R._share = file; return; }
            }
            RQ.toast('Rummet är sparat. <a href="#mitt-hem">Se Sparat</a>');
          } catch (e) { RQ.toast("Bilden gick inte att spara i den här webbläsaren."); }
        });
        const onRoom = (e) => { if (e.detail === "scene" && R._quiet) return; if (e.detail === "scene") { touched = true; const sw = R._swapped; R._swapped = null; if (sw) { if (sel === sw.from) sel = sw.to; if (swap.h === sw.from) swap.h = sw.to; seen.add(sw.to); } if (sel && !R.inScene(sel)) sel = null; if (swap.h && !R.inScene(swap.h)) swap.h = null; draw(); paintSwap(); paintSugg(); }
          if (e.detail === "known" || e.detail === "palette") { draw(); if (e.detail === "palette") fits(); }
          if (e.detail === "picker" && view.on) { stage.classList.add("resize"); layout(); setTimeout(() => stage.classList.remove("resize"), 450); } }; // the room makes space for the drawer, and takes it back
        document.addEventListener("rq-room", onRoom);
        const onCookie = () => { if (view.on) layout(true); toastAt(); }; document.addEventListener("rq-cookie", onCookie); // the cookie strip moved the room
        layout(); draw(); fits(); toastAt();
        // back from signing in that started at Skapa AI-bild: the AI sheet opens again (within half an hour)
        { const t = +((RQ.ss && RQ.ss.get("rumiq-ai-after")) || 0); if (t && S.customer()) { RQ.ss.set("rumiq-ai-after", ""); if (Date.now() - t < 18e5 && RQ.openAI) setTimeout(() => { if (root.isConnected) RQ.openAI(); }, 500); } }
        if (sel) { const it = R.scene().find((x) => x.h === sel); if (it) lookAt([it]); }
        R._swapLive = (h, colour) => { if (!root.isConnected || !R.inScene(h)) return; const it = R.scene().find((x) => x.h === h); if (it) lookAt([it]); openSwap(h, colour ? "[data-swv][aria-pressed=true]" : ".rm-alt"); };
        { const sw0 = RQ.ss && RQ.ss.get("rumiq-room-swap"); if (sw0) { RQ.ss.set("rumiq-room-swap", ""); const [sw, c] = sw0.split("|"); if (R.inScene(sw)) setTimeout(() => R._swapLive(sw, c === "c"), 300); } }
        return () => { R._swapLive = null; document.removeEventListener("keydown", escCmp, true); cmpEl.remove(); document.removeEventListener("rq-cookie", onCookie); document.removeEventListener("keydown", escMeasure); document.removeEventListener("rq-room", onRoom); document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", undoKey); removeEventListener("resize", onResize); removeEventListener("scroll", onScroll); ["--rm-toast-top", "--rm-toast-l", "--rm-toast-r"].forEach((k) => rootS.removeProperty(k)); R.closePicker(); document.body.classList.remove("on-room", "room-empty"); };
      },
    };
  };
  document.addEventListener("click", (e) => { const a = e.target.closest("[data-room-undo]"); if (!a) return; e.preventDefault(); RQ.toast(R.undo() ? a.dataset.roomUndo || "Ångrat. Den står kvar." : "Det finns inget att ångra."); });
  document.addEventListener("click", async (e) => { const a = e.target.closest("[data-share-room]"); if (!a || !R._share) return; e.preventDefault(); try { await navigator.share({ files: [R._share], title: "Mitt rum" }); } catch (x) {} });

  /* ---------------------------------------------------------------- product picker
     A drawer that leaves the room in view (under it on a phone, beside it on a computer), so you see each
     thing land when you choose it. */
  const GROUPS = [["", "Allt"], ["ljus", "Lampor och ljus"], ["textil", "Textil"], ["vagg", "På väggen"], ["golv", "På golvet"], ["bord", "På bordet"]];
  const groupOf = (p) => { const k = kindOf(p); return p.cat === "belysning-atmosfar" ? "ljus" : k === "wall" ? "vagg" : k === "floor" || k === "rug" ? "golv" : k === "surface" && !/handduk/.test(p.handle) ? "bord" : "textil"; };
  /* search that forgives: word stems ("kudde" finds kuddfodral), one wrong or missing letter ("lmpa"), everyday words */
  const ALSO = { gron: "salvia", gront: "salvia", beige: "havre sand", tavla: "affisch", tavlor: "affisch", poster: "affisch", filt: "plad", ljus: "doftljus ljusstake lampa", gardiner: "gardin", kruka: "kruka", vaxt: "kruka", sang: "paslakan", sangklader: "paslakan", burk: "burkar", korg: "korg", lada: "lada", spegel: "" };
  const near = (a, b) => { if (Math.abs(a.length - b.length) > 1) return false; let i = 0, j = 0, d = 0; while (i < a.length && j < b.length) { if (a[i] === b[j]) { i++; j++; continue; } if (++d > 1) return false; if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; } } return d + (a.length - i) + (b.length - j) <= 1; };
  const plain = (t) => S.norm(t).normalize("NFD").replace(/[̀-ͯ]/g, "");
  const hit = (p, q, loose) => { const text = plain(S.searchText(p) + " " + (p.variants || []).join(" ")), words = text.split(/[^a-z0-9]+/).filter(Boolean);
    return plain(q).split(/\s+/).filter(Boolean).every((t) => { const alts = [t, ...(ALSO[t] != null ? ALSO[t].split(" ") : [])].filter(Boolean);
      return alts.some((a) => text.includes(a) || (loose && a.length > 3 && (text.includes(a.replace(/(arna|orna|erna|ar|or|er|en|et|e|a)$/, "")) || words.some((w) => { for (let i = 0; i + a.length - 1 <= w.length; i++) { if (w[i] !== a[0]) continue; if (near(a, w.slice(i, i + a.length + 1)) && a.length < w.length - i + 1 || (a.length > 4 && near(a, w.slice(i, i + a.length)))) return true; } return false; })))); }); };
  const picker = document.createElement("div");
  picker.className = "sheet rmpick"; picker.setAttribute("role", "dialog"); picker.setAttribute("aria-labelledby", "pickTitle");
  picker.innerHTML = `<div class="sheet-scrim" data-pick-close></div><div class="sheet-card wide"><span class="sheet-grip" aria-hidden="true"></span>
    <button class="iconbtn sheet-x" type="button" data-pick-close aria-label="Stäng"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    <h2 id="pickTitle">Ställ in i rummet</h2>
    <div class="pickbar"><div class="chips" id="pickGroups" role="group" aria-label="Visa">${GROUPS.map(([id, n]) => `<button type="button" class="chip" data-g="${id}" aria-pressed="${id === ""}">${n}</button>`).join("")}</div>
      <label class="sr" for="pickQ">Sök</label><input type="search" id="pickQ" placeholder="Sök, till exempel lampa" autocomplete="off" enterkeyhint="search"></div>
    <div class="pickgrid" id="pickGrid"></div>
    <div class="pickfoot"><button class="btn block" type="button" data-pick-close>Klar</button></div></div>`;
  document.body.appendChild(picker);
  let pickG = "", pickBack = null;
  const renderPicker = () => {
    const q = $("#pickQ", picker).value.trim(), t = room && room.type;
    const inG = RQ.PRODUCTS.filter((p) => !pickG || groupOf(p) === pickG); let found = inG.filter((p) => !q || hit(p, q)); if (!found.length) found = inG.filter((p) => hit(p, q, true)); // exact words first; only when nothing is found do stems and one wrong letter count
    const list = found.map((p) => ({ p, m: match(p) })).sort((a, b) => (t ? p2(b.p, t) - p2(a.p, t) : 0) || (b.m || 0) - (a.m || 0));
    $("#pickGrid", picker).innerHTML = list.length ? list.map(({ p, m }) => `<button type="button" data-room-btn="${p.handle}" aria-pressed="${R.inScene(p.handle)}"><span class="pg-cut"><img src="${RQ.cut(p)}" alt="" loading="lazy"></span><b>${esc(p.name)}</b><span>${kr(p.price)}${m >= 60 ? `<em> · ${m} % färgmatch</em>` : ""}</span><i aria-hidden="true"></i></button>`).join("")
      : `<p class="pick-none">Inget i sortimentet heter så. Prova ett annat ord eller välj en grupp här ovanför.</p>`;
  };
  const p2 = (p, t) => (p.rooms.includes(t) ? 1 : 0);
  R.openPicker = () => { pickBack = document.activeElement; $("#pickQ", picker).value = ""; pickG = ""; $$("[data-g]", picker).forEach((b) => b.setAttribute("aria-pressed", b.dataset.g === "")); renderPicker(); picker.classList.add("open"); document.body.classList.add("picking-room"); emit("picker"); if (matchMedia("(pointer:fine)").matches) setTimeout(() => $("#pickQ", picker).focus({ preventScroll: true }), 80); else setTimeout(() => $(".sheet-x", picker).focus({ preventScroll: true }), 80); };
  const closePicker = () => { picker.classList.remove("open"); document.body.classList.remove("picking-room"); emit("picker"); if (pickBack && pickBack.focus && document.contains(pickBack)) pickBack.focus({ preventScroll: true }); pickBack = null; };
  picker.addEventListener("click", (e) => { if (e.target.closest("[data-pick-close]")) return closePicker(); const g = e.target.closest("[data-g]"); if (g) { pickG = g.dataset.g; $$("[data-g]", picker).forEach((b) => b.setAttribute("aria-pressed", b === g)); renderPicker(); $("#pickGrid", picker).scrollTo(0, 0); } });
  $("#pickQ", picker).addEventListener("input", renderPicker);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && picker.classList.contains("open")) { e.stopImmediatePropagation(); closePicker(); } }, true);
  R.closePicker = () => { if (picker.classList.contains("open")) closePicker(); };
  R.pickerHeight = () => $(".sheet-card", picker).offsetHeight;

  /* ---------------------------------------------------------------- colours, before the whole room goes into the cart */
  const vsheet = document.createElement("div");
  vsheet.className = "sheet"; vsheet.setAttribute("role", "dialog"); vsheet.setAttribute("aria-modal", "true"); vsheet.setAttribute("aria-labelledby", "varTitle");
  vsheet.innerHTML = `<div class="sheet-scrim" data-var-close></div><div class="sheet-card"><span class="sheet-grip" aria-hidden="true"></span>
    <button class="iconbtn sheet-x" type="button" data-var-close aria-label="Stäng"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    <h2 id="varTitle">Vilken färg vill du ha?</h2><p class="lead">Välj den färg du vill köpa.</p>
    <div class="varlist" id="varList"></div>
    <div class="pickfoot"><button class="btn block" type="button" id="varGo">Lägg allt i varukorgen</button></div></div>`;
  document.body.appendChild(vsheet);
  let varThen = null, varBack = null;
  const closeVar = () => { vsheet.classList.remove("open"); document.documentElement.style.overflow = ""; if (varBack && varBack.focus && document.contains(varBack)) varBack.focus({ preventScroll: true }); };
  R.openVariants = (handles, then, lead) => { varThen = then; varBack = document.activeElement; $(".lead", vsheet).textContent = lead || "Välj den färg du vill köpa."; // lead: when the things come from elsewhere than the room picture
    { const t = document.getElementById("toast"); if (t) t.classList.remove("show"); } // nothing left lying on top of the dimmed page
    $("#varList", vsheet).innerHTML = handles.map((h) => { const p = RQ.byHandle(h); return `<div class="var-row" data-h="${h}"><img src="${RQ.cut(p)}" alt=""><div><b>${esc(p.name)}</b>${lead ? "" : `<small class="var-shown">Bilden visar ${esc(p.variants[0])}</small>`}<div class="chips" role="group" aria-label="Färg på ${esc(p.name)}">${p.variants.map((v, i) => `<button type="button" class="chip" data-v="${i}" aria-pressed="${i === 0}"><i style="background:${esc(p.tone[i] || p.tone[0])}"></i>${esc(v)}</button>`).join("")}</div></div></div>`; }).join("");
    vsheet.classList.add("open"); document.documentElement.style.overflow = "hidden"; setTimeout(() => $(".sheet-x", vsheet).focus(), 60); };
  vsheet.addEventListener("click", (e) => { if (e.target.closest("[data-var-close]")) return closeVar();
    const c = e.target.closest("[data-v]"); if (c) { $$("[data-v]", c.parentElement).forEach((b) => b.setAttribute("aria-pressed", b === c)); return; }
    if (e.target.closest("#varGo")) { const pick = {}; $$(".var-row", vsheet).forEach((r) => { pick[r.dataset.h] = +($("[aria-pressed=true]", r) || { dataset: { v: 0 } }).dataset.v; }); const t = varThen; varThen = null; closeVar(); if (t) t(pick); } });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && vsheet.classList.contains("open")) { e.stopImmediatePropagation(); closeVar(); } }, true);

  /* ---------------------------------------------------------------- shell: header pill, counts */
  const paint = () => {
    const n = R.scene().length;
    $$("[data-count=scene]").forEach((b) => { if (+b.dataset.n < n) { b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump"); } b.textContent = n || ""; b.dataset.n = n; });
    $$("[data-room-thumb]").forEach((el) => { el.innerHTML = room ? `<img src="${R.url()}" alt="">` : el.dataset.empty || ""; el.classList.toggle("has", !!room); });
    $$("[data-room-btn]").forEach((b) => { const on = R.inScene(b.dataset.roomBtn); b.setAttribute("aria-pressed", on); });
  };
  R.paint = paint;
  document.addEventListener("rq-room", (e) => {
    paint();
    // room photo or mode changed: redraw views that show products
    if (e.detail === "room") { const h = (RQ.currentRoute && RQ.currentRoute()) || ""; if (!/^(mitt-rum|studio-rum|kassa|konto)/.test(h)) RQ.router(); }
  });
  document.addEventListener("DOMContentLoaded", paint);

  /* global clicks: put a product in the room, open the setup */
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-room-btn],[data-room-setup],[data-room-sample-now],[data-room-all]"); if (!b) return;
    e.preventDefault();
    if (b.matches("[data-room-all]")) { // several things at once (a saved look, a wish list): into the room, then open it
      const hs = b.dataset.roomAll.split(",").filter((h) => RQ.byHandle(h)); if (!hs.length) return;
      const put = () => { hs.forEach((h) => R.add(h, true)); if (RQ.currentRoute && /^mitt-rum/.test(RQ.currentRoute())) RQ.router(); else location.hash = "#mitt-rum"; };
      if (room) put(); else R.openSetup(put, { add: hs, go: "#mitt-rum" }); return;
    }
    if (b.matches("[data-room-setup]")) { const to = b.dataset.roomSetup; R.openSetup(to ? () => (location.hash = to) : null, to ? { go: to } : null); return; }
    if (b.matches("[data-room-sample-now]")) { const to = b.dataset.roomSampleNow || "#butik", im = new Image(); b.setAttribute("aria-busy", "true");
      im.onload = () => R.saveImage(im, { sample: true, map: "vardagsrum", type: "vardagsrum", name: "Vardagsrum", src: "assets/img/rum/vardagsrum-1600.webp" }).then((ok) => { b.removeAttribute("aria-busy"); if (!ok) return;
        // already on that page (the empty Mitt rum): a new hash would change nothing, so the page is drawn again here
        if (RQ.currentRoute && RQ.currentRoute() === to.replace(/^#/, "")) { RQ.router(); scrollTo(0, 0); RQ.toast("Klart. Här är exempelrummet."); } else location.hash = to; });
      im.onerror = () => { b.removeAttribute("aria-busy"); RQ.toast("Exempelrummet gick inte att hämta. Kontrollera uppkopplingen och försök igen."); };
      im.src = "assets/img/rum/vardagsrum-1600.webp"; return; }
    const h = b.dataset.roomBtn;
    const inPick = !!b.closest(".sheet.rmpick");
    const go = () => { if (R.inScene(h)) { R.remove(h); b.setAttribute("aria-pressed", false); RQ.toast(document.getElementById("rmUndo") ? "Borttagen ur rummet." : 'Borttagen ur rummet. <a href="#" data-room-undo>Ångra</a>'); return; } // in Mitt rum the Ångra button is on the room
      const ok = R.add(h, inPick); b.setAttribute("aria-pressed", ok); if (ok && inPick && R.lastMoved === h) RQ.toast("Där var det fullt, så den står på golvet. Dra den dit du vill."); };
    if (!room) R.openSetup(() => { R.add(h); }, { add: [h] }); else go();
  });
})();
