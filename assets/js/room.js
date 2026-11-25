/* Mitt rum: the customer's own room photo becomes the place where the whole shop is shown.
   - The photo is resized and kept in this browser only (localStorage), never uploaded.
   - Its colours and light are read once (k-means palette, brightness, warmth).
   - "The scene" is the set of products the customer has stood in the room, with position and size.
   - Every product card, product page and the room editor read from here.
   Sizes are approximate: verified product measurements do not exist yet, and the page says so. */
(function () {
  const RQ = window.RQ, S = RQ.shop, $ = RQ.$, $$ = RQ.$$, esc = RQ.esc, kr = S.kr;
  const KEY = "rumiq-myroom", SCENE = "rumiq-scene", MODE = "rumiq-roommode";
  const ls = S.store; // the shop's one typed reader (commerce.js)
  let room = ls.get(KEY, null), blobUrl = null, hist = [], lastTag = "", lastAt = 0;
  const emit = (what) => document.dispatchEvent(new CustomEvent("rq-room", { detail: what }));
  // only a picture kept in this browser counts as a room; anything else in the storage is ignored
  if (!room || typeof room !== "object" || typeof room.img !== "string" || !/^data:image\//.test(room.img) || !(+room.w > 0) || !(+room.h > 0)) room = null;
  if (room) { room.w = +room.w; room.h = +room.h; if (!Array.isArray(room.pal)) room.pal = []; room.pal = room.pal.filter((x) => x && /^#[0-9a-f]{6}$/i.test(x.hex)); }
  const FULL = "Webbläsarens lagring är full. Ta bort ett gammalt projekt i Mitt hem och försök igen.";

  /* Where things belong. A lamp stands on a table, a throw lies on the sofa, a print hangs on the wall and a
     rug lies on the floor. kind = where it goes, cm = the real width of what the cut-out shows, r = the
     cut-out's height / width. Widths are approximate until the suppliers' measurements are confirmed. */
  const KIND = {
    "glob-bordslampa-opalglas": ["surface", 20, 1.62], "lysa-keramiklampa": ["surface", 30.5, 1.11], "svamp-uppladdningsbar-lampa": ["surface", 17, 1.77],
    "skarbrada-ek-med-handtag": ["surface", 22, 1.84], "forradsburkar-glas-ek-3-pack": ["surface", 36, 0.74], "sand-keramikvas": ["surface", 17, 1.85],
    "tvalpump-stengods": ["surface", 26, 0.9], "glod-doftljus-keramik": ["surface", 9, 1.25], "stilla-ljusstake-massing-2-pack": ["surface", 12, 2.93],
    "skrivbordsorganisator-ek": ["surface", 30, 0.86], "vaffelhandduk-bomull": ["surface", 39, 0.64],
    "plad-ullblandning-havre": ["throw", 80, 0.84], "lin-kuddfodral": ["cushion", 88, 0.58], "vila-paslakanset-linne": ["bedding", 42, 0.53],
    "affisch-linje-ekram": ["wall", 53, 1.3], "affisch-horisont-ekram": ["wall", 53, 1.3],
    "forvaringslada-filt": ["floor", 42, 0.81], "flatad-forvaringskorg": ["floor", 40, 1.19], "terrakottakruka-rafflad": ["floor", 36, 1.92],
    "strand-jutematta": ["rug", 230, 0.37], "dagsljus-linnegardin-2-pack": ["window", 60, 2.63],
  };
  const meta = (p) => KIND[p.handle] || [p.wall ? "wall" : "surface", p.wall ? 50 : 20, 1.2];
  const kindOf = (p) => meta(p)[0];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  /* The sample rooms are mapped by hand. A spot is [x, y, s]: x/y in % of the photo (y is where the thing
     stands) and s = how many % of the photo's width one metre is at that depth. Floor spots get s from the
     horizon h and the slope k. Rugs and curtains are [x, y, width, squash]. sun = the side the light comes from. */
  const MAPS = {
    vardagsrum: { h: 58, k: 0.91, sun: 1,
      surface: [[78, 68.8, 25], [73.4, 68.4, 25], [82.6, 68, 25]],
      cushion: [[79.5, 64.5, 16.5], [66, 64.5, 16.5]], throw: [[62.4, 72.6, 17], [80, 72, 17]], bedding: [],
      wall: [[36, 50, 17], [23, 50, 17], [48, 52, 17]],
      floor: [[49.5, 82.5], [40, 84.5], [28, 88], [15, 86]],
      rug: [[45, 96, 50, 0.42]], window: [[92, 83, 15, 1.13]] },
    sovrum: { h: 55, k: 0.95, sun: 1,
      surface: [[13.6, 70.6, 27], [19.5, 70, 27], [10, 70.2, 27]],
      cushion: [[29, 64, 20], [38, 62, 19]], throw: [[63, 71.5, 19], [47, 70, 19]], bedding: [[47, 67, 19], [60, 66, 19]],
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
  const GENERIC = { h: 48, k: 0.9, sun: 1,
    surface: [[50, 63, 30], [32, 63, 30], [68, 63, 30]], cushion: [[50, 68, 24], [36, 68, 24]], throw: [[60, 71, 24], [40, 71, 24]], bedding: [[50, 70, 24]],
    wall: [[50, 40, 22], [30, 40, 22], [70, 40, 22]], floor: [[22, 92], [78, 92], [50, 94], [36, 90], [64, 90]],
    rug: [[50, 98, 56, 0.45]], window: [[86, 84, 15, 1]] };
  const FALLBACK = { cushion: ["throw", "floor"], throw: ["cushion", "floor"], bedding: ["throw", "cushion", "floor"], surface: ["floor"], wall: [], floor: [] };
  const LEARN = "rumiq-roomlearn";
  const mapOf = () => (room && MAPS[room.map || (room.sample ? room.type : "")]) || null;
  const floorScale = (y, M) => Math.max(6, (M || GENERIC).k * (y - (M || GENERIC).h));
  /* the spot a product gets when it is put in the room: by kind, and beside what already stands there.
     Only things of the same sort are in each other's way (a candle does not push a throw off the sofa), and a
     mapped surface has an end: when the table is full the next thing is put on the floor, never in the air. */
  const SORT = { surface: "s", cushion: "t", throw: "t", bedding: "t", floor: "f", rug: "r", window: "w", wall: "a" };
  const spotFor = (p, list, raw, MX) => { // MX: a sample room's map instead of the customer's room (the look pictures)
    const [kind, cm] = meta(p), M = MX || mapOf(), G = M || GENERIC;
    const taken = (x, y, w, k) => list.some((it) => { const q = RQ.byHandle(it.h); return q && SORT[it.on || kindOf(q)] === SORT[k || kind] && Math.abs(it.y - y) < 7 && Math.abs(it.x - x) < Math.max(3, (it.w + w) * 0.42); });
    const L = (!M && !raw && ls.get(LEARN, {})) || {}, learned = L[kind];
    if (learned && isFinite(learned.x) && isFinite(learned.y)) {
      const w = clamp(kind === "rug" || kind === "window" ? learned.w : cm * learned.s / 100, 2.5, 96); let x = learned.x, n = 0;
      while (taken(x, learned.y, w) && n < 6) { n++; x = learned.x + (n % 2 ? 1 : -1) * Math.ceil(n / 2) * (w + 2.5); }
      return { x: +clamp(x, 3, 97).toFixed(1), y: learned.y, w: +w.toFixed(1), sy: learned.sy };
    }
    const k = !M && L.k > 0 ? L.k : 1; // your own photo: the size you gave the first thing sets the scale for the rest
    const place = (kd) => {
      const spots = G[kd] && G[kd].length ? G[kd] : null; if (!spots) return null;
      if (kd === "rug" || kd === "window") { const sp = spots[0]; return { x: sp[0], y: sp[1], w: sp[2], sy: sp[3] }; }
      const width = (sp) => clamp(cm * (sp[2] || floorScale(sp[1], M)) / 100 * k, 2.5, 70);
      const free = spots.find((sp) => !taken(sp[0], sp[1], width(sp), kd)); if (free) return { x: free[0], y: free[1], w: +width(free).toFixed(1) };
      // every mapped spot is taken: beside one of them, as long as that is still on the same surface
      for (const sp of spots) { const w = width(sp), row = spots.filter((o) => Math.abs(o[1] - sp[1]) < 4).map((o) => o[0]), lo = Math.min(...row) - (M ? 1.5 : 30), hi = Math.max(...row) + (M ? 1.5 : 30);
        for (let n = 1; n <= 6; n++) { const x = sp[0] + (n % 2 ? 1 : -1) * Math.ceil(n / 2) * (w + 1.5); if (x >= Math.max(3, lo) && x <= Math.min(97, hi) && !taken(x, sp[1], w, kd)) return { x: +x.toFixed(1), y: sp[1], w: +w.toFixed(1) }; } }
      return null;
    };
    let sp = place(kind), moved = false;
    if (!sp) for (const fk of FALLBACK[kind] || []) { if ((sp = place(fk))) { moved = fk; break; } }
    if (!sp && M && kind !== "rug" && kind !== "window" && kind !== "wall" && G.floor && G.floor.length) { const f = G.floor[G.floor.length - 1]; sp = { x: f[0], y: f[1], w: +clamp(cm * floorScale(f[1], M) / 100, 2.5, 70).toFixed(1) }; moved = "floor"; } // nowhere left: on the floor, to be moved by hand
    if (!sp) { const s0 = (G[kind] && G[kind][0]) || GENERIC[kind][0] || GENERIC.surface[0]; sp = kind === "rug" || kind === "window" ? { x: s0[0], y: s0[1], w: s0[2], sy: s0[3] } : { x: s0[0], y: s0[1], w: +clamp(cm * (s0[2] || floorScale(s0[1], M)) / 100 * k, 2.5, 70).toFixed(1) }; }
    return moved ? { ...sp, moved } : sp;
  };
  /* what stands behind what: rugs lowest, then curtains, wall, floor, textiles, things on tables */
  const RANK = { rug: 0, window: 1, wall: 2, bedding: 4, throw: 4, cushion: 5, floor: 6, surface: 6 };
  /* back to front: what lies on the floor is drawn before what stands on it */
  const orderOf = (list) => list.map((it, i) => ({ it, i, z: it.top ? 190 + i : it.back ? -9 + i / 100 : RANK[kindOf(RQ.byHandle(it.h))] * 10 + (it.y + (kindOf(RQ.byHandle(it.h)) === "surface" && !it.on ? 12 : 0)) / 12 })).sort((a, b) => a.z - b.z || a.i - b.i).map((x) => x.it);
  const PLACE = KIND, placeFor = (p) => spotFor(p, []);

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
    PLACE, placeFor, kindOf, mapOf, match, lightFilter, analyse,
    has: () => !!room,
    get: () => room,
    url() { if (!room) return null; if (!blobUrl) blobUrl = toBlobUrl(room.img); return blobUrl; },
    mode: () => !!room && ls.get(MODE, true) !== false,
    setMode(on) { ls.set(MODE, !!on); emit("mode"); },
    async saveImage(img, meta = {}) {
      // a panorama or a very tall strip is trimmed around its middle (to 2.2:1 or 1:2.2), so the room can be shown at a useful size
      const nw = img.naturalWidth, nh = img.naturalHeight, sw = Math.min(nw, Math.round(nh * 2.2)), sh = Math.min(nh, Math.round(nw * 2.2)), sx = Math.round((nw - sw) / 2), sy0 = Math.round((nh - sh) / 2);
      const max = 1400, k = Math.min(1, max / Math.max(sw, sh));
      const W = Math.round(sw * k), H = Math.round(sh * k);
      const cv = document.createElement("canvas"); cv.width = W; cv.height = H; cv.getContext("2d").drawImage(img, sx, sy0, sw, sh, 0, 0, W, H);
      let data = cv.toDataURL("image/jpeg", 0.82);
      const a = analyse(cv);
      const next = { img: data, w: W, h: H, pal: a.pal, light: a.light, warm: a.warm, type: meta.type || null, name: meta.name || "", sample: !!meta.sample, map: meta.map || null, at: new Date().toISOString() };
      let ok = ls.set(KEY, next);
      if (!ok) { data = cv.toDataURL("image/jpeg", 0.62); next.img = data; ok = ls.set(KEY, next); }
      if (!ok) { R.lastError = "Bilden fick inte plats i webbläsarens lagring. Ta bort gamla projekt i Mitt hem och försök igen."; if (!sheet.classList.contains("open")) RQ.toast(R.lastError); return false; }
      room = next; if (blobUrl && blobUrl.startsWith("blob:")) URL.revokeObjectURL(blobUrl); blobUrl = null; hist = []; // a new photo: the old steps belonged to the old room
      ls.del(LEARN); ls.set(MODE, true);
      // what stood in the old room is put where it belongs in the new one
      const moved = []; R.scene().forEach((it) => { const sp = spotFor(RQ.byHandle(it.h), moved); moved.push({ h: it.h, x: sp.x, y: sp.y, w: sp.w, ...(sp.sy && sp.sy !== 1 ? { sy: sp.sy } : {}), ...(sp.moved ? { on: sp.moved } : {}), flip: false, light: 100 }); });
      if (moved.length) ls.set(SCENE, moved);
      emit("room"); return true;
    },
    setType(t) { if (!room) return; room.type = t; ls.set(KEY, room); emit("type"); },
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
    group(fn) { const n = hist.length, before = ls.get(SCENE, []), out = fn(); if (hist.length > n) { hist.length = n; hist.push(before); } lastTag = ""; return out; },
    inScene: (h) => R.scene().some((it) => it.h === h),
    add(h, quiet) {
      const p = RQ.byHandle(h); if (!p) return false; RQ.track && RQ.track("studio_place", { item_id: h });
      const list = R.scene(); if (list.some((it) => it.h === h)) return false;
      const sp = spotFor(p, list);
      list.push({ h, x: sp.x, y: sp.y, w: sp.w, ...(sp.sy && sp.sy !== 1 ? { sy: sp.sy } : {}), ...(sp.moved ? { on: sp.moved } : {}), flip: false, light: 100 });
      if (!R.saveScene(list)) { RQ.toast(FULL); return false; }
      R.lastMoved = sp.moved ? h : null;
      if (!quiet && sp.moved) RQ.toast(`Där var det fullt, så ${esc(p.name)} står på golvet. Dra den dit du vill.`);
      else if (!quiet) RQ.toast(/^mitt-rum/.test((RQ.currentRoute && RQ.currentRoute()) || "") ? `${esc(p.name)} står nu i ditt rum.` : `${esc(p.name)} står nu i ditt rum. <a href="#mitt-rum">Öppna</a>`);
      return true;
    },
    remove(h) { R.saveScene(R.scene().filter((it) => it.h !== h)); },
    toggle(h) { if (R.inScene(h)) { R.remove(h); return false; } R.add(h); return true; },
    update(h, patch, tag) { R.saveScene(R.scene().map((it) => (it.h === h ? { ...it, ...patch } : it)), false, tag); },
    toFront(h) { const l = R.scene(); const i = l.findIndex((it) => it.h === h); if (i < 0) return; const it = l.splice(i, 1)[0]; it.top = true; delete it.back; l.push(it); R.saveScene(l); },
    toBack(h) { const l = R.scene(); const i = l.findIndex((it) => it.h === h); if (i < 0) return; const it = l.splice(i, 1)[0]; it.back = true; delete it.top; l.unshift(it); R.saveScene(l); },
    /* everything in the room into the cart, once: what already lies there is left as it is. Products with colours ask first. */
    cartAll(btn, chosen) {
      const list = R.scene(); if (!list.length) return;
      const inCart = new Set(S.cartLines().map((l) => l.product.handle)), todo = list.filter((it) => !inCart.has(it.h));
      if (!todo.length) { RQ.toast('Allt i rummet ligger redan i varukorgen. <a href="#" data-open-cart>Visa</a>'); return; }
      const ask = todo.filter((it) => (RQ.byHandle(it.h).variants || []).length > 1);
      if (ask.length && !chosen) { R.openVariants(ask.map((it) => it.h), (pick) => R.cartAll(btn, pick)); return; }
      todo.forEach((it) => S.addToCart(it.h + "::" + ((chosen && chosen[it.h]) || 0), 1));
      const n = S.cartLines().filter((l) => todo.some((it) => it.h === l.product.handle)).length;
      if (!n) { RQ.toast("Det gick inte att lägga sakerna i varukorgen. Försök igen."); return; }
      RQ.confirmAdd(btn, "");
      RQ.toast(`${n === 1 ? "1 produkt från ditt rum ligger" : n + " produkter från ditt rum ligger"} i varukorgen${todo.length < list.length ? ", resten låg redan där" : ""}. <a href="#" data-open-cart>Visa</a>`);
    },
    total: () => R.scene().reduce((s, it) => s + RQ.byHandle(it.h).price, 0),
    ordered() { return orderOf(R.scene()); },
    /* a sample room with these things placed in it, the way Mitt rum would place them: for the look pictures.
       layer = the things, to lie over the photo (in % of the photo); spots = where each one stands, for its dot */
    compose(id, handles) {
      const M = MAPS[id], ar = 1600 / 893; if (!M) return null; // every sample photo is 1600 x 893
      const list = [];
      handles.forEach((h) => { const p = RQ.byHandle(h); if (!p) return; const sp = spotFor(p, list, true, M); list.push({ h, x: sp.x, y: sp.y, w: sp.w, ...(sp.sy && sp.sy !== 1 ? { sy: sp.sy } : {}), ...(sp.moved ? { on: sp.moved } : {}) }); });
      if (!list.length) return null;
      const items = orderOf(list).map((it, i) => { const p = RQ.byHandle(it.h), r = meta(p)[2];
        return `<div class="rm-item k-${kindOf(p)}${p.cat === "belysning-atmosfar" ? " lamp" : ""}" style="left:${it.x}%;top:${it.y}%;width:${it.w}%;z-index:${i + 1}"><img src="${RQ.cut(p)}" alt="" decoding="async" style="${it.sy ? `aspect-ratio:1 / ${(r * it.sy).toFixed(3)};` : ""}"></div>`; }).join("");
      const hOf = (it) => it.w * meta(RQ.byHandle(it.h))[2] * (it.sy || 1) * ar; // height in % of the photo's height
      const spots = list.map((it) => [it.h, it.x, +Math.max(4, it.y - hOf(it) - 2.5).toFixed(1), true]); // the dot just above the thing, so it never hides a small one
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
      const shy = { window: 14, bedding: room && room.type === "sovrum" ? 4 : 30 }; // kinds that are harder to make look right come later
      const pool = RQ.PRODUCTS.filter((p) => !have.has(p.handle) && (!room || !room.type || p.rooms.includes(room.type)))
        .map((p) => ({ p, s: (match(p) || 70) + (p.featured ? 4 : 0) - (shy[kindOf(p)] || 0) })).sort((a, b) => b.s - a.s);
      const out = [];
      for (const { p } of pool) { if (out.length >= n) break; if (cats.has(p.cat)) continue; cats.add(p.cat); out.push(p); }
      for (const { p } of pool) { if (out.length >= n) break; if (!out.includes(p)) out.push(p); }
      return out;
    },
    /* the product shown inside the customer's room, for cards and tiles: a crop of the photo around the
       spot where the product belongs, at the size it would have there */
    layer(p) {
      if (!room) return "";
      const [kind, , r] = meta(p), sp = spotFor(p, []), ar = room.w / room.h;
      const cover = 125 * ar; // the photo's width in % of a 4:5 card when it just fills the card's height
      const want = { rug: 88, window: 34, wall: 46, floor: 44, throw: 56, cushion: 58, bedding: 50 }[kind] || (r > 1.4 ? 30 : 42);
      const bw = clamp(want * 100 / sp.w, cover, cover * 3.6), bh = bw / ar / 1.25;
      const ih = sp.w * r * (sp.sy || 1) * ar; // the product's height in % of the photo's height
      const bl = clamp(50 - sp.x / 100 * bw, 100 - bw, 0), bt = clamp((kind === "wall" ? 60 : 72) - (sp.y - ih * 0.1) / 100 * bh, 100 - bh, 0);
      const st = `left:${(bl + sp.x / 100 * bw).toFixed(1)}%;top:${(bt + sp.y / 100 * bh).toFixed(1)}%;width:${(sp.w / 100 * bw).toFixed(1)}%`;
      const sq = sp.sy && sp.sy !== 1 ? `aspect-ratio:1 / ${(r * sp.sy).toFixed(3)};` : "";
      return `<span class="inr"><img class="inr-bg" src="${R.url()}" alt="" decoding="async" style="left:${bl.toFixed(1)}%;top:${bt.toFixed(1)}%;width:${bw.toFixed(1)}%;height:${bh.toFixed(1)}%"><span class="inr-p k-${kind}" style="${st}"><img src="${RQ.cut(p)}" alt="" decoding="async" style="${sq}filter:${lightFilter()}"></span></span>`;
    },
    thumb: () => (room ? `<img src="${R.url()}" alt="">` : ""),
  });

  /* ---------------------------------------------------------------- setup sheet: take or choose the photo */
  const TYPES = [["vardagsrum", "Vardagsrum"], ["sovrum", "Sovrum"], ["kok", "Kök"], ["badrum", "Badrum"], ["hall", "Hall"], ["hemmakontor", "Hemmakontor"], ["uteliv", "Uteliv"]];
  const sheet = document.createElement("div");
  sheet.className = "sheet"; sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-modal", "true"); sheet.setAttribute("aria-labelledby", "roomSheetTitle");
  sheet.innerHTML = `<div class="sheet-scrim" data-sheet-close></div><div class="sheet-card"><span class="sheet-grip" aria-hidden="true"></span>
    <button class="iconbtn sheet-x" type="button" data-sheet-close aria-label="Stäng"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    <h2 id="roomSheetTitle">Lägg in ditt rum</h2>
    <p class="lead">Ta en bild av rummet du vill inreda. Sedan står varje produkt du tittar på i just ditt rum.</p>
    <div class="sheet-acts">
      <label class="btn cam"><svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>Ta en bild<input type="file" accept="image/*" capture="environment" class="sr" data-room-file></label>
      <label class="btn ghost"><svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="1.5"/><path d="M4 16l5-5 4 4 3-3 4 4"/></svg>Välj en bild<input type="file" accept="image/*" class="sr" data-room-file></label>
    </div>
    <p class="sheet-err" role="alert" hidden></p>
    <p class="small sheet-tip" data-tip-touch>Ställ dig i dörröppningen och ta bilden i dagsljus, gärna på bredden så att hela rummet kommer med.</p>
    <p class="small sheet-tip" data-tip-desk hidden>Du kan också dra hit en bild eller klistra in den. Bäst blir en bild i dagsljus där hela rummet syns.</p>
    <h3>Eller prova med ett exempelrum</h3>
    <div class="sheet-samples">${RQ.SAMPLE_ROOMS.map((r) => `<button type="button" data-room-sample="${r.img}" data-type="${r.id}"><img src="${r.img.replace("-1600", "-600")}" alt="" loading="lazy"><span>${esc(r.name)}</span></button>`).join("")}</div>
    <h3>Vilket rum är det?</h3>
    <div class="chips" data-room-type>${TYPES.map(([id, n]) => `<button type="button" class="chip" data-v="${id}" aria-pressed="false">${n}</button>`).join("")}</div>
    <p class="small sheet-priv"><svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="1.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>Bilden sparas bara i din webbläsare. Den skickas till oss först om du själv väljer att skapa en AI-bild.</p>
    <div class="sheet-busy" hidden><span class="spin"></span>Läser in rummet</div>
  </div>`;
  document.body.appendChild(sheet);
  let after = null, chosenType = null, back = null;
  const busy = (on) => ($(".sheet-busy", sheet).hidden = !on);
  const fail = (msg) => { const e = $(".sheet-err", sheet); e.textContent = msg || ""; e.hidden = !msg; if (msg) $(".sheet-card", sheet).scrollTop = 0; };
  R.openSetup = (then) => {
    after = then || null; back = document.activeElement;
    chosenType = room && room.type;
    $$("[data-room-type] [data-v]", sheet).forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === chosenType));
    $("#roomSheetTitle", sheet).textContent = room ? "Byt rum" : "Lägg in ditt rum";
    const touch = matchMedia("(pointer:coarse)").matches;
    $(".cam", sheet).hidden = !touch; $("[data-tip-touch]", sheet).hidden = !touch; $("[data-tip-desk]", sheet).hidden = touch;
    $(".sheet-acts .btn:not(.cam)", sheet).classList.toggle("ghost", touch); // on a computer "Välj en bild" is the one main button
    fail(""); sheet.classList.add("open"); document.documentElement.style.overflow = "hidden";
    setTimeout(() => $(".sheet-x", sheet).focus(), 60);
  };
  const close = () => { sheet.classList.remove("open"); document.documentElement.style.overflow = ""; if (back && back.focus) back.focus({ preventScroll: true }); };
  R.closeSetup = close;
  const done = async (img, meta) => {
    busy(true); fail("");
    const ok = await R.saveImage(img, { ...meta, type: chosenType || meta.type || null });
    busy(false); if (!ok) { fail(R.lastError || "Bilden gick inte att spara. Försök igen."); return; }
    close();
    const cb = after; after = null;
    if (cb) cb();
    else if (/^(mitt-rum|studio(-rum|-analys|-kombinera)?$)/.test((RQ.currentRoute && RQ.currentRoute()) || "")) { RQ.router(); scrollTo(0, 0); if (room.sample || !R.scene().length) RQ.toast("Klart. Här är ditt rum."); } // the editor is drawn with the new photo
    else RQ.toast('Klart. Nu visas butiken i ditt rum. <a href="#butik">Till butiken</a>');
  };
  sheet.addEventListener("click", (e) => {
    if (e.target.closest("[data-sheet-close]")) return close();
    const t = e.target.closest("[data-room-type] [data-v]"); if (t) { chosenType = chosenType === t.dataset.v ? null : t.dataset.v; $$("[data-room-type] [data-v]", sheet).forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === chosenType)); if (room) R.setType(chosenType); return; }
    const s = e.target.closest("[data-room-sample]"); if (s) { busy(true); const im = new Image(); im.onload = () => done(im, { sample: true, map: s.dataset.type, type: s.dataset.type, name: $("span", s).textContent }); im.onerror = () => { busy(false); fail("Exempelrummet gick inte att hämta. Kontrollera uppkopplingen och försök igen."); }; im.src = s.dataset.roomSample; }
  });
  const takeFile = (f) => {
    if (!f) return;
    if (!/^image\//.test(f.type) && !/\.(heic|heif)$/i.test(f.name)) { fail("Det där är ingen bild. Välj en JPG, PNG eller WebP."); return; }
    busy(true); fail(""); const url = URL.createObjectURL(f); const im = new Image();
    im.onload = () => { const small = Math.max(im.naturalWidth, im.naturalHeight) < 700; done(im, { name: "Mitt rum" }).then(() => { if (small && room && !room.sample) RQ.toast("Bilden är liten och kan se suddig ut. En större bild ger ett finare rum."); }); setTimeout(() => URL.revokeObjectURL(url), 4000); };
    im.onerror = () => { busy(false); fail(/\.(heic|heif)$/i.test(f.name) ? "Den här webbläsaren kan inte läsa HEIC-bilder. Spara bilden som JPG eller ta en ny bild här." : "Bilden gick inte att läsa. Prova en JPG eller PNG."); };
    im.src = url;
  };
  $$("[data-room-file]", sheet).forEach((inp) => inp.addEventListener("change", () => { const f = inp.files[0]; inp.value = ""; takeFile(f); }));
  // on a computer: drop a picture on the sheet, or paste one
  const card0 = $(".sheet-card", sheet);
  ["dragenter", "dragover"].forEach((ev) => card0.addEventListener(ev, (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes("Files")) { e.preventDefault(); card0.classList.add("drop"); } }));
  ["dragleave", "drop"].forEach((ev) => card0.addEventListener(ev, (e) => { if (ev === "dragleave" && card0.contains(e.relatedTarget)) return; card0.classList.remove("drop"); }));
  card0.addEventListener("drop", (e) => { if (!e.dataTransfer || !e.dataTransfer.files.length) return; e.preventDefault(); takeFile(e.dataTransfer.files[0]); });
  document.addEventListener("paste", (e) => { if (!sheet.classList.contains("open") || !e.clipboardData) return; const f = [...e.clipboardData.files].find((x) => /^image\//.test(x.type)); if (f) { e.preventDefault(); takeFile(f); } });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && sheet.classList.contains("open")) { e.stopImmediatePropagation(); close(); } }, true);
  // swipe the sheet down to close it on phones
  (() => { const card = $(".sheet-card", sheet); let y0 = null, dy = 0;
    card.addEventListener("touchstart", (e) => { if (card.scrollTop > 0) return; y0 = e.touches[0].clientY; dy = 0; }, { passive: true });
    card.addEventListener("touchmove", (e) => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); card.style.transform = `translateY(${dy}px)`; }, { passive: true });
    card.addEventListener("touchend", () => { if (y0 == null) return; card.style.transform = ""; if (dy > 110) close(); y0 = null; });
  })();


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
  };
  const setupBlock = (want) => `<div class="rm-empty">
      <div class="rm-empty-in">
        ${want ? `<p class="rm-want"><img src="${RQ.cut(want)}" alt=""><span><b>${esc(want.name)}</b> står i rummet så fort bilden är inne.</span></p>` : ""}
        <h2 class="h2">Börja med en bild av ditt rum.</h2>
        <p class="lead">Sedan ställer du in produkter där du vill ha dem, ser vad hela rummet kostar och handlar allt på en gång.</p>
        <div class="ctrl-row" style="margin-top:1.6rem"><button class="btn" type="button" data-room-setup>Lägg in ditt rum</button><button class="btn ghost" type="button" data-room-sample-now="#mitt-rum">Prova med ett exempelrum</button></div>
        <ol class="rm-steps"><li><b>Ta en bild</b><span>Med telefonen, eller välj en du redan har.</span></li><li><b>Ställ in produkter</b><span>Från butiken, eller låt oss föreslå.</span></li><li><b>Handla looken</b><span>Allt i rummet hamnar i varukorgen med en knapp.</span></li></ol>
        <p class="small" style="margin-top:1.2rem">Bilden sparas bara i din webbläsare. Den skickas till oss först om du själv väljer att skapa en AI-bild.</p>
      </div>${RQ.demoFig ? RQ.demoFig() : ""}</div>`;

  V.myRoom = (pre) => {
    if (pre && RQ.byHandle(pre) && room && R.add(pre, true)) RQ.ss && RQ.ss.set("rumiq-room-new", pre);
    if (pre && RQ.byHandle(pre) && !room) RQ.ss && RQ.ss.set("rumiq-room-pre", pre);
    const want = pre && RQ.byHandle(pre) && !room ? RQ.byHandle(pre) : null; // came from a product without a room yet
    const more = `<nav class="rm-more" aria-label="Fler sätt att välja"><a class="chip" href="#svep">Svep fram din stil</a><a class="chip" href="#hitta-ratt">Hitta rätt</a><a class="chip" href="#studio-stylist">Fråga stylisten</a></nav>`;
    return {
      title: pre && RQ.byHandle(pre) ? `${RQ.byHandle(pre).name} i ditt rum · RumIQ` : "Mitt rum · RumIQ",
      html: `<section class="wrap rm-top${room ? " has-room" : ""}">${RQ.crumbs([["Hem", "hem"], ["Mitt rum"]])}<div class="rm-title"><h1 class="h1">Mitt rum</h1>${room ? `<p class="lead">Sakerna hamnar där de hör hemma: lampor på bord, plädar i soffan och tavlor på väggen. Flytta dem som du vill.</p>` : ""}</div>
        ${room ? "" : more}</section>
        ${room ? `<section class="rm wrap">
          <div class="rm-stagewrap" id="rmWrap">
            <div class="rm-stage" id="rmStage" data-sun="${(mapOf() || GENERIC).sun}" style="--ar:${(room.w / room.h).toFixed(4)};aspect-ratio:${room.w} / ${room.h}">
              <p class="sr" id="rmSaid" role="status"></p><div class="rm-canvas" id="rmCanvas"><img class="rm-bg" src="${R.url()}" alt="Ditt rum" draggable="false"><div class="rm-items" id="rmItems"></div></div>
              <button type="button" class="rm-hold" id="rmHold" aria-label="Håll för före, så ser du rummet utan produkterna">${ICO.eye}<span>Håll för före</span></button>
              <button type="button" class="rm-zoom" id="rmZoom" hidden>${ICO.fit}<span>Hela rummet</span></button>
              <button type="button" class="rm-undo" id="rmUndo" aria-keyshortcuts="Control+Z" hidden>${ICO.undo}<span>Ångra</span></button>
              <span class="rm-pos" id="rmPos" aria-hidden="true" hidden><i></i></span>
              <div class="rm-emptyhint" id="rmHint" hidden><p>Rummet är tomt.</p><button class="btn sm light" type="button" id="rmSuggest0">${ICO.wand}Inred åt mig</button></div>
              <p class="rm-first" id="rmFirst" role="status" hidden></p>
            </div>
            <div class="rm-tools">
              <button type="button" class="rm-tool" id="rmAdd">${ICO.plus}<span>Lägg till</span></button>
              <button type="button" class="rm-tool" id="rmSuggest">${ICO.wand}<span>Inred åt mig</span></button>
              <button type="button" class="rm-tool" id="rmSave">${ICO.save}<span>Spara</span></button>
              <div class="rm-morewrap"><button type="button" class="rm-tool" id="rmMore" aria-haspopup="true" aria-expanded="false" aria-controls="rmMenu">${ICO.more}<span>Mer</span></button>
                <div class="rm-menu" id="rmMenu" role="menu" aria-label="Mer" hidden>
                  <button type="button" role="menuitem" class="rm-ai" data-ai-create>${ICO.spark}<span>Skapa AI-bild<small>Rummet med sakerna, i rätt ljus</small></span></button>
                  <button type="button" role="menuitemcheckbox" id="rmNight" aria-checked="false">${ICO.moon}<span>Kvällsljus<small>Se lamporna lysa i rummet</small></span></button>
                  <button type="button" role="menuitemcheckbox" id="rmBefore" aria-checked="false">${ICO.eye}<span>Visa före<small>Rummet utan sakerna</small></span></button>
                  <button type="button" role="menuitem" data-room-setup>${ICO.swap}<span>Byt rum<small>Ny bild eller ett exempelrum</small></span></button>
                </div></div>
            </div>
            <div class="rm-act" id="rmAct" role="group" aria-label="Den valda saken" hidden>
              <button type="button" data-act="smaller">${ICO.minus}<span>Mindre</span></button>
              <button type="button" data-act="bigger">${ICO.plus}<span>Större</span></button>
              <button type="button" data-act="flip">${ICO.flip}<span>Vänd</span></button>
              <button type="button" data-act="order">${ICO.front}<span id="rmActOrder">Lägg bakom</span></button>
              <button type="button" data-act="del">${ICO.trash}<span>Ta bort</span></button>
              <button type="button" data-act="done" class="on">${ICO.check}<span>Klar</span></button>
            </div>
            ${!room.sample && !room.type ? `<div class="rm-ask" id="rmAsk"><span>Vilket rum är det?</span><div class="chips">${TYPES.map(([id, n]) => `<button type="button" class="chip" data-roomtype="${id}">${n}</button>`).join("")}</div></div>` : ""}
            <p class="caption">Storleken är ungefärlig tills produkternas mått är bekräftade. Ljuset på produkterna anpassas efter ditt foto. <span class="rm-keys">Med tangentbordet: piltangenterna flyttar, plus och minus ändrar storlek och ${/Mac|iPhone|iPad/.test(navigator.platform || "") ? "⌘Z" : "Ctrl+Z"} ångrar.</span></p>
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
        <section class="sec tight kalk"><div class="wrap"><div class="sec-row"><div class="sec-head"><h2 class="h2">Passar ditt rum</h2><p>Sorterat efter hur väl färgerna går ihop med ditt foto. Tryck på rummet-knappen för att ställa in.</p></div><a class="link" href="#butik">Hela butiken</a></div>${(() => { const c = R.read(); return c ? `<div class="rm-colors"><div class="palette" role="img" aria-label="Färgerna i ditt rum">${c.pal.map((t) => `<i style="background:${t}"></i>`).join("")}</div><div><h3>Färgerna i ditt rum</h3><p>${c.text} ${c.tip}</p></div></div>` : ""; })()}<div id="rmFits"></div></div></section>`
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
        if (fresh0) setTimeout(() => RQ.ss.set("rumiq-room-new", ""), 1600); // kept a moment: the view may be drawn twice on the way in
        const fits = () => { const t = room.type; const list = RQ.PRODUCTS.map((p) => ({ p, m: (match(p) || 0) + (t && p.rooms.includes(t) ? 100 : 0) })).sort((a, b) => b.m - a.m).slice(0, 6).map((x) => x.p); $("#rmFits", root).innerHTML = RQ.grid(list, "three"); RQ.markImages && RQ.markImages(root); };
        /* things land softly the first time they are put in the room */
        const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
        const seen = new Set(R.scene().map((it) => it.h)); if (fresh0) seen.delete(fresh0);
        let shown = R.total();
        const count = (to) => { // the room's price counts up while the things land
          const els = [$("#rmTotal", root)], from = shown; shown = to;
          if (calm() || from === to) { els[0].textContent = kr(to); return; }
          const t0 = performance.now(), step = (t) => { const k = Math.min(1, (t - t0) / 600), v = Math.round((from + (to - from) * (1 - (1 - k) ** 3)) / 10) * 10; els[0].textContent = kr(k === 1 ? to : v); if (k < 1 && els[0].isConnected) requestAnimationFrame(step); };
          requestAnimationFrame(step);
        };

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
          const room4 = Math.max(200, innerHeight - top - (drawer || 150)), h62 = Math.min(Math.round(innerHeight * 0.62), room4);
          view.can = h62 * ar >= W * 1.2;                       // a wide photo: there is more to see when it is shown tall
          const near = view.can && !view.whole;
          view.sh = Math.round(near ? h62 : Math.min(W / ar, room4)); view.sw = W;
          view.cw = view.sh * ar; view.ch = view.sh;
          stage.style.height = view.sh + "px";
          if (!keep) { view.z = 1; const c = centre(R.scene()); view.tx = view.sw / 2 - c[0] / 100 * view.cw; view.ty = 0; }
          paintView();
        };
        const centre = (list) => { if (!list.length) return [50, 50]; const xs = list.map((it) => it.x), ys = list.map((it) => it.y - (it.w * meta(RQ.byHandle(it.h))[2] * (it.sy || 1) * room.w / room.h) / 2); return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]; };
        /* the camera glides to where something stands */
        const lookAt = (list) => { if (!view.on || !list.length) return false; const c = centre(list), w = view.cw * view.z, h = view.ch * view.z, tx = view.tx, ty = view.ty;
          const x = c[0] / 100 * w + view.tx, y = c[1] / 100 * h + view.ty; if (x > view.sw * 0.22 && x < view.sw * 0.78 && y > view.sh * 0.1 && y < view.sh * 0.9 && list.length === 1) return false;
          view.tx = view.sw / 2 - c[0] / 100 * w; view.ty = view.sh / 2 - c[1] / 100 * h; paintView(true); return Math.abs(view.tx - tx) + Math.abs(view.ty - ty) > 8; };

        const draw = () => {
          const list = R.scene(), order = R.ordered(); let fresh = 0; const news = [];
          { const nw = order.filter((it) => !seen.has(it.h)); if (nw.length === 1 && !mapOf() && !Object.keys(ls.get(LEARN, {}) || {}).length) sel = nw[0].h; }
          wrap.innerHTML = order.map((it, i) => { const p = RQ.byHandle(it.h), kind = kindOf(p), isNew = !seen.has(it.h), r = meta(p)[2]; if (isNew) news.push(it);
            return `<div class="rm-item k-${kind}${p.cat === "belysning-atmosfar" ? " lamp" : ""}${sel === it.h ? " sel" : ""}${isNew && !calm() ? " land" : ""}" data-h="${it.h}" tabindex="0" role="button" aria-label="${esc(p.name)}. Dra för att flytta. Piltangenterna flyttar, plus och minus ändrar storlek, Delete tar bort." style="left:${it.x}%;top:${it.y}%;width:${it.w}%;z-index:${i + 1}${isNew && !calm() ? `;--i:${fresh++}` : ""}"><img src="${RQ.cut(p)}" alt="" draggable="false" style="${it.sy ? `aspect-ratio:1 / ${(r * it.sy).toFixed(3)};` : ""}transform:scaleX(${it.flip ? -1 : 1});filter:${lightFilter(it.light)}"></div>`; }).join("");
          const teach = news.length && !mapOf() && !Object.keys(ls.get(LEARN, {}) || {}).length; // own photo, nothing shown yet
          if (news.length) { wrap.style.setProperty("--pre", lookAt(news) ? "360ms" : "90ms");
            const f = $("#rmFirst", root);
            if (teach) { f.textContent = "Dra den dit den ska stå och gör den lagom stor. Nästa sak följer efter."; f.hidden = false; f.classList.remove("go"); void f.offsetWidth; f.classList.add("go"); setTimeout(() => { if (f.isConnected) f.hidden = true; }, 5200); }
            else if (!ls.get("rumiq-room-landed", false)) { ls.set("rumiq-room-landed", true); f.textContent = "Så här kan det se ut hemma hos dig."; f.hidden = false; f.classList.remove("go"); void f.offsetWidth; f.classList.add("go"); setTimeout(() => { if (f.isConnected) f.hidden = true; }, 5200); } }
          list.forEach((it) => seen.add(it.h)); [...seen].forEach((h) => { if (!list.some((it) => it.h === h)) seen.delete(h); });
          $("#rmHint", root).hidden = list.length > 0;
          $("#rmList", root).innerHTML = list.length ? list.map((it) => { const p = RQ.byHandle(it.h); return `<li class="${sel === it.h ? "on" : ""}"><button type="button" class="rm-li" data-pick="${it.h}"><img src="${RQ.img(p, 600)}" alt=""><span><b>${esc(p.name)}</b><span>${kr(p.price)}</span></span></button><button type="button" class="iconbtn" data-del="${it.h}" aria-label="Ta bort ${esc(p.name)} ur rummet">${ICO.trash}</button></li>`; }).join("") : `<li class="rm-none">Inget i rummet än. Tryck på <b>Inred åt mig</b> eller <b>Lägg till</b>.</li>`;
          const t = kr(R.total()); count(R.total()); $("#rmBarSum", root).textContent = `${list.length} ${list.length === 1 ? "produkt" : "produkter"} · ${t}`;
          $("#rmCount", root).textContent = list.length ? `${list.length} ${list.length === 1 ? "produkt" : "produkter"}` : "";
          $("#rmCart", root).disabled = $("#rmCart2", root).disabled = !list.length;
          const hm = R.harmony(); $("#rmHarm", root).hidden = !hm; $("#rmLook", root).hidden = list.length < 2;
          if (hm) { $("#rmHm", root).style.width = hm.score + "%"; $("#rmHmv", root).textContent = hm.word; $("#rmHmt", root).textContent = hm.tip; }
          paintSel(); paintUndo();
        };
        const paintSel = () => {
          const it = R.scene().find((x) => x.h === sel); const panel = $("#rmSel", root); panel.hidden = !it;
          $("#rmAct", root).hidden = !it; box.classList.toggle("picking", !!it);
          if (!it) return;
          const p = RQ.byHandle(it.h);
          $("#rmSelImg", root).src = RQ.img(p, 600); $("#rmSelName", root).textContent = p.name; $("#rmSelPrice", root).textContent = kr(p.price);
          $("#rmSelLink", root).href = "#produkt-" + p.handle; { const sz = $("#rmSize", root), [a, b] = span(it.h); sz.min = a.toFixed(1); sz.max = b.toFixed(1); sz.value = it.w;
            $('[data-act="bigger"]', root).setAttribute("aria-disabled", it.w >= b - 0.05); $('[data-act="smaller"]', root).setAttribute("aria-disabled", it.w <= a + 0.05); } $("#rmLight", root).value = it.light;
          $("#rmActOrder", root).textContent = it.back ? "Lägg framför" : "Lägg bakom";
        };
        const select = (h) => { sel = h; $$(".rm-item", wrap).forEach((el) => el.classList.toggle("sel", el.dataset.h === h)); $$("#rmList li", root).forEach((li) => li.classList.toggle("on", !!$(`[data-pick="${h}"]`, li))); paintSel(); };
        const live = (h, patch) => { const el = $(`.rm-item[data-h="${h}"]`, wrap); if (!el) return; if (patch.x != null) el.style.left = patch.x + "%"; if (patch.y != null) el.style.top = patch.y + "%"; if (patch.w != null) el.style.width = patch.w + "%"; };
        /* a size you choose in your own photo teaches the room its scale: the next things follow it */
        const learn = (h, it) => { if (mapOf()) return; const p = RQ.byHandle(h), [kind, cm] = meta(p), L = ls.get(LEARN, {}) || {}, base = spotFor(p, [], true).w;
          L[kind] = { x: +it.x.toFixed(1), y: +it.y.toFixed(1), s: +(it.w / cm * 100).toFixed(2), w: +it.w.toFixed(1), sy: it.sy };
          if (kind !== "rug" && kind !== "window" && base > 0) L.k = +clamp(it.w / base, 0.4, 3).toFixed(2);
          ls.set(LEARN, L); };
        /* how small and how big a thing may be made: around the size it was put in at (half to twice the size in
           a mapped sample room; wider in your own photo, where the first size is only a guess), so one click never makes a giant */
        const span = (h) => { const p = RQ.byHandle(h); if (!p) return [2.5, 96]; const b = spotFor(p, [], true).w, own = !mapOf(); return [Math.max(2.5, b * (own ? 0.35 : 0.5)), Math.min(96, b * (own ? 4 : 2))]; };
        const fit = (h, w) => { const [a, b] = span(h); return clamp(w, a, b); };
        const resize = (h, w, tag) => { const it = R.scene().find((x) => x.h === h); if (!it) return; w = +fit(h, w).toFixed(1); if (w === it.w) return; R.update(h, { w }, tag); learn(h, { ...it, w }); };
        const removeIt = (h) => { const p = RQ.byHandle(h); if (sel === h) sel = null; R.remove(h); RQ.toast(`${esc(p.name)} är borttagen. <a href="#" data-room-undo>Ångra</a>`); };

        // gestures: one finger on a thing moves it, one finger on the room pans it sideways (up and down scrolls the page),
        // two fingers resize the selected thing or, with nothing selected, zoom the room
        const pts = new Map(); let drag = null, pinch = null, pan = null;
        const far = (a, e) => Math.hypot(e.clientX - a.sx, e.clientY - a.sy) > 6;
        stage.addEventListener("pointerdown", (e) => {
          const el = e.target.closest(".rm-item");
          if (e.target.closest(".rm-hold,.rm-emptyhint,.rm-zoom,.rm-undo")) return;
          if (e.isPrimary) { pts.clear(); pinch = drag = pan = null; } // a first finger starts afresh, whatever an interrupted gesture left behind
          pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
          try { stage.setPointerCapture(e.pointerId); } catch (x) {}
          if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y) || 1; const it = sel && R.scene().find((x) => x.h === sel);
            if (it) pinch = { d, w: it.w };
            else if (view.on) { const r = stage.getBoundingClientRect(); pinch = { d, z: view.z, cx: (a.x + b.x) / 2 - r.left, cy: (a.y + b.y) / 2 - r.top, tx: view.tx, ty: view.ty }; canvas.classList.remove("glide"); }
            drag = pan = null; return; }
          if (el) { select(el.dataset.h); const it = R.scene().find((x) => x.h === el.dataset.h); if (!it) return; const r = canvas.getBoundingClientRect(); const kind = kindOf(RQ.byHandle(it.h));
            drag = { h: el.dataset.h, el, sx: e.clientX, sy: e.clientY, ox: it.x, oy: it.y, ow: it.w, w: it.w, kind, r, x: it.x, y: it.y, hp: el.offsetHeight / Math.max(1, canvas.offsetHeight) * 100, moved: false }; }
          else if (pts.size === 1) pan = { sx: e.clientX, sy: e.clientY, tx: view.tx, ty: view.ty, moved: false };
        });
        stage.addEventListener("pointermove", (e) => {
          if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (pinch && pts.size >= 2) { const [a, b] = [...pts.values()], k = Math.hypot(a.x - b.x, a.y - b.y) / pinch.d;
            if (pinch.w != null) { const w = fit(sel, pinch.w * k); pinch.cur = w; live(sel, { w }); $("#rmSize", root).value = w; }
            else { const z = clamp(pinch.z * k, 1, 3.2); view.tx = pinch.cx - (pinch.cx - pinch.tx) * z / pinch.z; view.ty = pinch.cy - (pinch.cy - pinch.ty) * z / pinch.z; view.z = z; paintView(); }
            return; }
          if (pan) { if (!pan.moved && !far(pan, e)) return; if (!pan.moved) canvas.classList.remove("glide"); pan.moved = true; if (!view.on) return; view.tx = pan.tx + e.clientX - pan.sx; if (view.z > 1.01) view.ty = pan.ty + e.clientY - pan.sy; paintView(); return; }
          if (!drag) return; e.preventDefault();
          if (!drag.moved) { if (!far(drag, e)) return; drag.moved = true; drag.el.style.zIndex = 99; drag.el.classList.remove("land"); } // a tap with a trembling finger is not a move
          drag.x = drag.ox + (e.clientX - drag.sx) / drag.r.width * 100;
          drag.y = drag.oy + (e.clientY - drag.sy) / drag.r.height * 100;
          // on the floor, closer to the camera is bigger: the size follows the depth
          if (drag.kind === "floor" || drag.kind === "rug") { const hz = (mapOf() || GENERIC).h; if (drag.oy - hz > 6) drag.w = fit(drag.h, drag.ow * clamp((clamp(drag.y, 8, 104) - hz) / (drag.oy - hz), 0.35, 2.6)); }
          [drag.x, drag.y] = inside(drag.x, drag.y, drag.w, drag.hp * drag.w / drag.ow);
          live(drag.h, { x: drag.x, y: drag.y, w: drag.w });
        });
        /* a thing stays inside the picture: at most a third of it may hang over the sides or the top. Below, where it
           stands, only a sliver (under a tenth of its height, at most 4 % of the picture): a small thing is not lost under the edge */
        const inside = (x, y, w, hp) => [clamp(x, Math.min(50, w / 6), Math.max(50, 100 - w / 6)), clamp(y, Math.min(60, hp * 0.67), 100 + Math.min(4, hp * 0.08))];
        const up = (e) => {
          if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId);
          if (pinch) { if (pts.size < 2) { if (pinch.cur) resize(sel, pinch.cur); pinch = null; } return; }
          if (pan) { const p = pan; pan = null; if (!p.moved && e.type === "pointerup") select(null); return; }
          if (drag) { const d = drag; drag = null; if (!d.moved) return;
            const it = R.scene().find((x) => x.h === d.h); if (!it) return;
            const next = { x: +d.x.toFixed(1), y: +d.y.toFixed(1), w: +d.w.toFixed(1) };
            R.update(d.h, next); learn(d.h, { ...it, ...next }); }
        };
        stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", up);
        // the wheel changes the size only when you mean it: over the selected thing, or with Ctrl held. Otherwise the page scrolls.
        stage.addEventListener("wheel", (e) => { if (!sel) return; const over = e.target.closest(".rm-item"); if (!e.ctrlKey && !(over && over.dataset.h === sel)) return; e.preventDefault(); const it = R.scene().find((x) => x.h === sel); resize(sel, it.w * (e.deltaY < 0 ? 1.06 : 1 / 1.06), "size:" + sel); }, { passive: false });
        const refocus = (h) => setTimeout(() => { const el = h && $(`.rm-item[data-h="${h}"]`, wrap); (el || $("#rmAdd", root)).focus({ preventScroll: true }); }, 0);
        stage.addEventListener("keydown", (e) => { const el = e.target.closest(".rm-item"); if (!el) return; const it = R.scene().find((x) => x.h === el.dataset.h); if (!it) return; const d = e.shiftKey ? 4 : 1;
          const m = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }[e.key];
          if (m) { e.preventDefault(); sel = it.h; const [x, y] = inside(it.x + m[0], it.y + m[1], it.w, el.offsetHeight / Math.max(1, canvas.offsetHeight) * 100); R.update(it.h, { x, y }, "key:" + it.h); refocus(it.h); said("Flyttad."); }
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(it.h); }
          if (e.key === "+" || e.key === "-") { e.preventDefault(); sel = it.h; const w = +fit(it.h, it.w * (e.key === "+" ? 1.08 : 1 / 1.08)).toFixed(1); resize(it.h, w, "size:" + it.h); refocus(it.h); said(w === it.w ? (e.key === "+" ? "Största storleken." : "Minsta storleken.") : `Storlek ${Math.round(w)} %.`); }
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
        $("#rmZoom", root).addEventListener("click", () => { if (view.z > 1.01 && !view.whole) { view.z = 1; paintView(true); return; } view.whole = !view.whole; ls.set("rumiq-room-view", view.whole ? "whole" : "near"); stage.classList.add("resize"); layout(); setTimeout(() => stage.classList.remove("resize"), 450); });
        let lw = innerWidth; const onResize = () => { toastAt(); if (innerWidth === lw && view.on) return; lw = innerWidth; layout(); }; // a phone's address bar comes and goes: only a new width is a new layout
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
        $("#rmSize", root).addEventListener("input", (e) => { if (sel) live(sel, { w: +e.target.value }); });
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
        const ask = $("#rmAsk", root); if (ask) ask.addEventListener("click", (e) => { const b = e.target.closest("[data-roomtype]"); if (!b) return; R.setType(b.dataset.roomtype); ask.remove(); fits(); RQ.toast("Tack. Nu föreslår vi sådant som passar där."); });
        root.addEventListener("click", (e) => {
          const pk = e.target.closest("[data-pick]"); if (pk) { select(pk.dataset.pick); const it = R.scene().find((x) => x.h === pk.dataset.pick); if (it) lookAt([it]); if (innerWidth <= 900) stage.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
          const dl = e.target.closest("[data-del]"); if (dl) removeIt(dl.dataset.del);
        });
        const suggest = () => {
          const before = R.scene(), picks = R.suggest(Math.max(1, 4 - before.length) + (before.length >= 4 ? 1 : 0));
          if (!picks.length) { RQ.toast("Nu står allt som passar här i rummet. Lägg till fler själv."); return; }
          const n = R.group(() => picks.filter((p) => R.add(p.handle, true)).length); if (!n) return; // one step: Ångra takes all of them back
          RQ.toast(`${n} förslag efter rummets färger${room.type ? " och rumstyp" : ""}. Flytta och byt fritt.${mapOf() ? "" : " Dra en sak dit den ska stå, så hamnar nästa bredvid."} <a href="#" data-room-undo="Ångrat. Förslagen är borttagna.">Ångra</a>`);
        };
        $("#rmSuggest", root).addEventListener("click", suggest); $("#rmSuggest0", root).addEventListener("click", suggest);
        $("#rmAdd", root).addEventListener("click", () => { select(null); if (view.on) scrollTo({ top: Math.max(0, stage.getBoundingClientRect().top + scrollY - ((document.querySelector("header") || {}).offsetHeight || 58) - 8) }); RQ.room.openPicker(); });
        $("#rmLook", root).addEventListener("click", () => { const hs = R.scene().map((it) => it.h); if (hs.length < 2) return;
          if (S.looks().some((l) => l.handles.join() === hs.join())) { RQ.toast('Den looken är redan sparad. <a href="#mitt-hem">Mitt hem</a>'); return; }
          S.saveLook(hs, "Mitt rum " + new Date().toLocaleDateString("sv-SE")); RQ.toast('Looken är sparad. <a href="#mitt-hem">Mitt hem</a>'); });
        $("#rmCart", root).addEventListener("click", (e) => R.cartAll(e.currentTarget)); $("#rmCart2", root).addEventListener("click", (e) => R.cartAll(e.currentTarget));
        // evening: the room dims and every lamp and candle you placed glows, so you see the light at home
        const night = $("#rmNight", root), setNight = (on) => { stage.classList.toggle("night", on); night.setAttribute("aria-checked", on); try { localStorage.setItem("rumiq-room-night", on ? "1" : "0"); } catch (e) {} };
        night.addEventListener("click", () => { setNight(!stage.classList.contains("night")); RQ.track && RQ.track("room_night", { on: stage.classList.contains("night") }); });
        try { if (localStorage.getItem("rumiq-room-night") === "1") setNight(true); } catch (e) {}
        let lastSave = "";
        $("#rmSave", root).addEventListener("click", async () => {
          try {
            const key = JSON.stringify(R.scene()) + room.at;
            if (key === lastSave) { RQ.toast('Det här är redan sparat. <a href="#mitt-hem">Öppna Mitt hem</a>'); return; }
            const bg = $(".rm-bg", root); const W = 1100, H = Math.round(W * room.h / room.w);
            const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const cx = cv.getContext("2d"); cx.drawImage(bg, 0, 0, W, H);
            const before = document.createElement("canvas"); before.width = 480; before.height = Math.round(480 * H / W); before.getContext("2d").drawImage(bg, 0, 0, before.width, before.height);
            for (const it of R.ordered()) {
              const p = RQ.byHandle(it.h); const im = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = RQ.cut(p); });
              const w = W * it.w / 100, h = w * im.naturalHeight / im.naturalWidth * (it.sy || 1), x = W * it.x / 100 - w / 2, y = H * it.y / 100 - h;
              if (["surface", "floor"].includes(kindOf(p))) { const g = cx.createRadialGradient(x + w / 2, y + h, 0, x + w / 2, y + h, w * 0.45); g.addColorStop(0, "rgba(0,0,0,.28)"); g.addColorStop(1, "rgba(0,0,0,0)"); cx.save(); cx.translate(0, y + h); cx.scale(1, 0.18); cx.translate(0, -(y + h)); cx.fillStyle = g; cx.fillRect(x - w * 0.1, y + h - w * 0.5, w * 1.2, w); cx.restore(); }
              cx.save(); cx.filter = lightFilter(it.light); if (it.flip) { cx.translate(x + w, y); cx.scale(-1, 1); cx.drawImage(im, 0, 0, w, h); } else cx.drawImage(im, x, y, w, h); cx.restore();
            }
            const handles = R.scene().map((it) => it.h);
            const ok = S.saveProject({ title: "Mitt rum med " + handles.map((h) => RQ.byHandle(h).name.split(" ")[0]).join(", "), img: cv.toDataURL("image/jpeg", 0.74), before: before.toDataURL("image/jpeg", 0.6), handles });
            if (!ok) { RQ.toast("Webbläsarens lagring är full. Ta bort ett gammalt projekt i Mitt hem."); return; }
            lastSave = key;
            if (navigator.canShare && window.isSecureContext) {
              const blob = await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.86)); const file = new File([blob], "mitt-rum.jpg", { type: "image/jpeg" });
              if (navigator.canShare({ files: [file] })) { RQ.toast('Sparat i Mitt hem. <a href="#" data-share-room>Dela bilden</a>'); R._share = file; return; }
            }
            RQ.toast('Sparat i Mitt hem. <a href="#mitt-hem">Öppna</a>');
          } catch (e) { RQ.toast("Bilden gick inte att spara i den här webbläsaren."); }
        });
        const onRoom = (e) => { if (e.detail === "scene") { touched = true; if (sel && !R.inScene(sel)) sel = null; draw(); }
          if (e.detail === "picker" && view.on) { stage.classList.add("resize"); layout(); setTimeout(() => stage.classList.remove("resize"), 450); } }; // the room makes space for the drawer, and takes it back
        document.addEventListener("rq-room", onRoom);
        layout(); draw(); fits(); toastAt();
        if (sel) { const it = R.scene().find((x) => x.h === sel); if (it) lookAt([it]); }
        return () => { document.removeEventListener("rq-room", onRoom); document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", undoKey); removeEventListener("resize", onResize); removeEventListener("scroll", onScroll); ["--rm-toast-top", "--rm-toast-l", "--rm-toast-r"].forEach((k) => rootS.removeProperty(k)); R.closePicker(); document.body.classList.remove("on-room", "room-empty"); };
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
    $("#pickGrid", picker).innerHTML = list.length ? list.map(({ p, m }) => `<button type="button" data-room-btn="${p.handle}" aria-pressed="${R.inScene(p.handle)}"><span class="pg-cut"><img src="${RQ.cut(p)}" alt="" loading="lazy"></span><b>${esc(p.name)}</b><span>${kr(p.price)}${m ? `<em> · ${m} % färgmatch</em>` : ""}</span><i aria-hidden="true"></i></button>`).join("")
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
    <h2 id="varTitle">Vilken färg vill du ha?</h2><p class="lead">Bilden i rummet visar en av färgerna. Välj den du vill köpa.</p>
    <div class="varlist" id="varList"></div>
    <div class="pickfoot"><button class="btn block" type="button" id="varGo">Lägg allt i varukorgen</button></div></div>`;
  document.body.appendChild(vsheet);
  let varThen = null, varBack = null;
  const closeVar = () => { vsheet.classList.remove("open"); document.documentElement.style.overflow = ""; if (varBack && varBack.focus && document.contains(varBack)) varBack.focus({ preventScroll: true }); };
  R.openVariants = (handles, then) => { varThen = then; varBack = document.activeElement;
    $("#varList", vsheet).innerHTML = handles.map((h) => { const p = RQ.byHandle(h); return `<div class="var-row" data-h="${h}"><img src="${RQ.cut(p)}" alt=""><div><b>${esc(p.name)}</b><div class="chips" role="group" aria-label="Färg på ${esc(p.name)}">${p.variants.map((v, i) => `<button type="button" class="chip" data-v="${i}" aria-pressed="${i === 0}"><i style="background:${esc(p.tone[i] || p.tone[0])}"></i>${esc(v)}</button>`).join("")}</div></div></div>`; }).join("");
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
    if (e.detail === "room" || e.detail === "mode") { const h = (RQ.currentRoute && RQ.currentRoute()) || ""; if (!/^(mitt-rum|studio-rum|kassa|konto)/.test(h)) RQ.router(); }
  });
  document.addEventListener("DOMContentLoaded", paint);

  /* global clicks: put a product in the room, open the setup */
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-room-btn],[data-room-setup],[data-room-mode],[data-room-sample-now],[data-room-all]"); if (!b) return;
    e.preventDefault();
    if (b.matches("[data-room-all]")) { // several things at once (a saved look, a wish list): into the room, then open it
      const hs = b.dataset.roomAll.split(",").filter((h) => RQ.byHandle(h)); if (!hs.length) return;
      const put = () => { hs.forEach((h) => R.add(h, true)); if (RQ.currentRoute && /^mitt-rum/.test(RQ.currentRoute())) RQ.router(); else location.hash = "#mitt-rum"; };
      if (room) put(); else R.openSetup(put); return;
    }
    if (b.matches("[data-room-setup]")) { R.openSetup(b.dataset.roomSetup ? () => (location.hash = b.dataset.roomSetup) : null); return; }
    if (b.matches("[data-room-sample-now]")) { const to = b.dataset.roomSampleNow || "#butik", im = new Image(); b.setAttribute("aria-busy", "true");
      im.onload = () => R.saveImage(im, { sample: true, map: "vardagsrum", type: "vardagsrum", name: "Vardagsrum i morgonljus" }).then((ok) => { b.removeAttribute("aria-busy"); if (!ok) return;
        // already on that page (the empty Mitt rum): a new hash would change nothing, so the page is drawn again here
        if (RQ.currentRoute && RQ.currentRoute() === to.replace(/^#/, "")) { RQ.router(); scrollTo(0, 0); RQ.toast("Klart. Här är ditt rum."); } else location.hash = to; });
      im.onerror = () => { b.removeAttribute("aria-busy"); RQ.toast("Exempelrummet gick inte att hämta. Kontrollera uppkopplingen och försök igen."); };
      im.src = "assets/img/rum/vardagsrum-1600.webp"; return; }
    if (b.matches("[data-room-mode]")) { if (!room) { R.openSetup(); return; } R.setMode(!R.mode()); return; }
    const h = b.dataset.roomBtn;
    const inPick = !!b.closest(".sheet.rmpick");
    const go = () => { if (R.inScene(h)) { R.remove(h); b.setAttribute("aria-pressed", false); RQ.toast('Borttagen ur ditt rum. <a href="#" data-room-undo>Ångra</a>'); return; }
      const ok = R.add(h, inPick); b.setAttribute("aria-pressed", ok); if (ok && inPick && R.lastMoved === h) RQ.toast("Där var det fullt, så den står på golvet. Dra den dit du vill."); };
    if (!room) R.openSetup(() => { R.add(h); }); else go();
  });
})();
