# RumIQ Studio: server proposal for the AI picture (not deployed)

Agent: studio-ai, 2026-11-25. Branch `studio-ai` (worktree /home/claude/wt7/ai).

The repository has no `supabase/functions/` folder, so the proposal and its code are here. **Nothing below has
been deployed and the database has not been changed.** The deployed function `generate` (version 2) and the
database were only read (Supabase tools, project `viiqzkuwmhnnhtlcwlpi`). The founder decides.

## 1. What runs today (read on 2026-11-25)

- `generate` v2 (verify_jwt on): validates idem/mode/scene/edit/room/guide, reads `app_settings` (`fal_model` =
  `fal-ai/nano-banana-2/edit`, `est_cost_usd` 0.05), calls `ai_reserve` (atomic: consent, max 6 products, plan,
  daily cap, monthly USD cap, takes one credit), uploads room + guide to the private `rooms` bucket, calls fal once
  with the room, the guide and the product cut-outs, stores the result as `results/{user}/{gen}.jpg`, `ai_finish`,
  returns `{ id, url }` with a 7-day signed URL. Any failure: `ai_fail` (refunds the credit).
- It does **not** ask for any aspect ratio (fal's default for nano-banana-2 is `aspect_ratio: "auto"`), does no
  quality check, never retries, and does not keep the before picture (`rooms` is cleaned after 30 days by
  `ai-cleanup` / `ai_cleanup_paths`).
- Limits live in `plans` (free: 5/month, daily 5; plus: 99 kr, 100/month, daily 30, free_play) and
  `app_settings` (max_products 6, quality_refunds_per_month 3, monthly_cap_usd 190). `credit_ledger.reason` already
  allows `purchase_bonus`, but no function grants it (see section 5).
- Storage: buckets `rooms` and `results`, both private, no storage RLS policies (only the service role reads them).

## 2. What the client (branch studio-ai) already does, so the server can rely on it

- Sends `size: { w, h }` (the room photo's pixel size) and `v` (colour index) per scene item, and `parent` (the
  generation id of the room's first picture, when there is one).
- Sends `Accept: application/x-ndjson, application/json`. If the answer is `application/x-ndjson`, each line is
  JSON: `{ "stage": "started" }`, `{ "stage": "retry" }` (the client shows "Vi gör ett nytt försök…"), and the last
  line is the normal answer `{ id, url, retried }` or `{ error }`. A plain JSON answer still works (no live step).
- Draws whatever comes back at the room photo's aspect ratio (centre crop, never stretched), so a small mismatch is
  safe; a large one would crop products, which is why the server should ask for the right shape.
- Keeps every picture and its before picture on the device (IndexedDB). With `RQ_CONFIG.studio.serverLibrary =
  true` (config.js) and a real account, "Mina rumsbilder" lists from the function `ai-library` below instead, and
  the consent text says the before picture is kept in the account.

## 3. The change to `generate`

1. **Shape.** Read the room photo's real size from its JPEG/PNG header (fallback: `size` from the client), pick the
   nearest ratio fal supports (`21:9 16:9 3:2 4:3 5:4 1:1 4:5 3:4 2:3 9:16`) and send it as `aspect_ratio`.
   fal documents `aspect_ratio` for nano-banana-2 text-to-image; **confirm on fal's page for
   `fal-ai/nano-banana-2/edit` that the edit endpoint takes the same parameter** before deploying (if not, keep
   `"auto"`: the client crop still guarantees no stretching).
2. **One automatic quality check** (cheap, about 0.3 s, on 128 px thumbnails decoded with `imagescript`):
   - not empty: at least 15 kB, a real JPEG/PNG/WebP, long side at least 640 px;
   - shape: aspect within 12 % of the room photo's;
   - not the input returned unchanged: the result differs from the room photo (mean difference > 2 %);
   - products present: the pixels where the guide differs from the room photo are each product's area; in that area
     the result must be closer to the guide than to the empty room, for at least 80 % of the products;
   - nothing else moved (place mode only): outside the product areas the result stays close to the room photo.
   Thresholds are read from `app_settings` keys `qc_*` when present, with the defaults in the code (no new row is
   needed to deploy).
3. **At most one retry, charged once.** If the check fails, the function says `{stage:"retry"}` and asks fal once
   more with one extra prompt line; the credit taken by `ai_reserve` is not taken again. If the second picture also
   fails, the better of the two (by score) is delivered (the customer still has "Produkten blev fel"). `cost_usd`
   records the real cost (two calls). Each fal call has its own 70 s limit and the retry is skipped when more than
   75 s have passed, so the whole request stays under the edge-function wall-clock limit.
4. **Result and before picture to the private `results` bucket, with the generation row.** The result is stored
   as `results/{user}/{gen}.{W}x{H}.jpg` (size in the name, so the library needs no new column) and the room photo
   is copied to `results/{user}/{gen}-before.jpg`, so it outlives the 30-day cleanup of `rooms`. Both paths belong
   to the row (`result_path`; the before path follows from it). `parent_id` (an existing column) is set to the
   room's first generation when the client sends `parent` and it belongs to the same user: that is how versions
   belong to one room project in the account.
   **Text to change at the same time** (the client already does it when `serverLibrary` is on): consent and privacy
   say "rumsfotot som skickas till bildtjänsten raderas efter 30 dagar. AI-bilderna och bilden före sparas privat
   i ditt konto tills du tar bort dem."

### `supabase/functions/generate/index.ts` (proposed, full file; `shared.ts` unchanged)

```ts
// RumIQ Studio: turn the customer's Mitt rum arrangement into an AI photo.
// POST { idem, mode: "place"|"edit", scene: [{h, v, x, y, w, flip}], edit?, room: dataURL, guide: dataURL,
//        size?: {w, h}, parent?: uuid }
// Answer: { id, url, retried, w, h } | { error }. With "Accept: application/x-ndjson" the answer is streamed as lines:
// {stage:"started"}, {stage:"retry"} (only when the first picture failed the quality check), then the answer.
// Credits and limits are enforced in Postgres (ai_reserve); one credit per request whatever the number of attempts;
// failures refund (ai_fail).
import { admin, CORS, dbError, env, getUser, json, siteUrl } from "./shared.ts";
import { decode, Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";

const EDITS: Record<string, Record<string, string>> = {
  wall: { vit: "paint the walls a warm white", salvia: "paint the walls a soft sage green", sand: "paint the walls a light sand beige", gra: "paint the walls a calm light grey", terrakotta: "paint the walls a muted terracotta", natt: "paint the walls a deep navy blue" },
  floor: { ljusek: "make the floor light oak planks", morkek: "make the floor dark smoked oak planks", kalksten: "make the floor pale limestone tiles", betong: "make the floor smooth grey concrete" },
  light: { morgon: "soft low morning sunlight from the window", dag: "bright even daylight", kvall: "warm evening light with the lamps switched on" },
  style: { skandinavisk: "a calm Scandinavian style", mjuk: "a soft, cosy style with layered textiles", minimalistisk: "a minimalist style with fewer objects", klassisk: "a classic, timeless style" },
};
const MAX_IMG = 3_500_000; // base64 chars per image
const RATIOS: [string, number][] = [["21:9", 21 / 9], ["16:9", 16 / 9], ["3:2", 3 / 2], ["4:3", 4 / 3], ["5:4", 5 / 4], ["1:1", 1], ["4:5", 4 / 5], ["3:4", 3 / 4], ["2:3", 2 / 3], ["9:16", 9 / 16]];
const clean = (s: unknown, n = 60) => String(s ?? "").replace(/[^\p{L}\p{N} ,&\-.]/gu, "").slice(0, n);
const dataUrlBytes = (d: string) => {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(d || "");
  if (!m || m[2].length > MAX_IMG) return null;
  return { type: m[1], bytes: Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0)) };
};

/** Width and height from a JPEG (SOF marker) or PNG (IHDR) header, without decoding the picture. */
function headerSize(b: Uint8Array): { w: number; h: number } | null {
  if (b[0] === 0x89 && b[1] === 0x50) return { w: (b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19], h: (b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23] };
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1], len = (b[i + 2] << 8) | b[i + 3];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8] };
    i += 2 + len;
  }
  return null;
}
const nearestRatio = (r: number) => RATIOS.reduce((best, x) => (Math.abs(Math.log(x[1] / r)) < Math.abs(Math.log(best[1] / r)) ? x : best))[0];

function prompt(mode: string, scene: any[], edit: Record<string, string> | null, withRefs: boolean, again: boolean) {
  // Names come from the handle (a-z, 0-9, hyphen only), never from free text the browser sends.
  const products = scene.map((p, i) => `${i + 1}) ${String(p.h).replace(/-/g, " ")}`).join("; ");
  const lines = [
    "Image 1 is a photo of a customer's room. Image 2 is the same room with the products pasted in as a rough layout guide.",
    withRefs ? "The following images are the exact products, one per image, in the same order as listed." : "",
    `Products: ${products}.`,
    "Create one photorealistic photo of the room in image 1 with each product placed exactly where and exactly as large as it appears in image 2.",
    "Keep the exact framing, crop and aspect ratio of image 1.",
    "Match the room's light direction, soft contact shadows, reflections and perspective so every product sits naturally on its surface or wall.",
    "Keep each product's shape, colour, material, pattern and proportions identical to how it looks in the guide" + (withRefs ? " and its reference image." : "."),
    "Do not add, remove or move anything else in the room. No people, no text, no logos, no watermarks.",
    again ? "Important: every listed product must be clearly visible at its place in image 2, and the rest of the room must stay exactly as in image 1." : "",
  ];
  if (mode === "edit" && edit) {
    const extra = Object.entries(edit).map(([k, v]) => EDITS[k]?.[v]).filter(Boolean);
    if (extra.length) lines.push(`Also: ${extra.join("; ")}. Keep all products exactly in place.`);
  }
  return lines.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ the quality check */
type QC = { ok: boolean; score: number; why: string[]; w: number; h: number };
const thumb = (im: Image, W: number, H: number) => im.clone().resize(W, H);
const px = (im: Image, x: number, y: number) => { const c = im.getPixelAt(x + 1, y + 1); return [(c >>> 24) & 255, (c >>> 16) & 255, (c >>> 8) & 255]; };
const diff = (a: number[], b: number[]) => (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])) / 765;

async function check(out: Uint8Array, room: Uint8Array, guide: Uint8Array, roomSize: { w: number; h: number }, scene: any[], mode: string, T: Record<string, number>): Promise<QC> {
  const why: string[] = [];
  const size = headerSize(out) || { w: 0, h: 0 };
  if (out.length < T.min_bytes) why.push("empty");
  if (Math.max(size.w, size.h) < T.min_side) why.push("small");
  const ra = roomSize.w / roomSize.h, oa = size.w && size.h ? size.w / size.h : 0;
  if (!oa || Math.abs(oa / ra - 1) > T.aspect_tol) why.push("shape");
  let score = why.length ? 0 : 0.5;
  try {
    // 128 px on the long side, all three at the room's shape (the result is compared as the client will show it)
    const W = ra >= 1 ? 128 : Math.round(128 * ra), H = ra >= 1 ? Math.round(128 / ra) : 128;
    const [o, r, g] = (await Promise.all([decode(out), decode(room), decode(guide)])).map((im) => thumb(im as Image, W, H));
    let changed = 0, outside = 0, nOut = 0; const mask: boolean[] = new Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const pr = px(r, x, y), pg = px(g, x, y), po = px(o, x, y), i = y * W + x;
      mask[i] = diff(pr, pg) > 0.08; changed += diff(po, pr);
      if (!mask[i]) { outside += diff(po, pr); nOut++; }
    }
    changed /= W * H; outside = nOut ? outside / nOut : 0;
    if (changed < T.min_change) why.push("unchanged");
    if (mode === "place" && outside > T.max_outside) why.push("room_changed");
    // each product: the guide's pasted pixels in its column above its foot; present when the result is nearer the guide there
    let present = 0;
    for (const p of scene) {
      const x0 = Math.max(0, Math.floor(W * (p.x - p.w / 2) / 100)), x1 = Math.min(W - 1, Math.ceil(W * (p.x + p.w / 2) / 100)), y1 = Math.min(H - 1, Math.ceil(H * p.y / 100));
      let dg = 0, dr = 0, k = 0;
      for (let y = 0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * W + x; if (!mask[i]) continue; const po = px(o, x, y); dg += diff(po, px(g, x, y)); dr += diff(po, px(r, x, y)); k++; }
      if (!k || dg < dr) present++; // no pasted pixels found (fully hidden behind another product): not counted against
    }
    const share = scene.length ? present / scene.length : 1;
    if (share < T.min_present) why.push("products_missing");
    score = (why.length ? 0 : 0.5) + 0.4 * share + 0.1 * Math.max(0, 1 - outside / T.max_outside);
  } catch (_e) {
    // a picture we cannot decode is judged on its header alone (never blocks a delivery by itself)
  }
  return { ok: !why.length, score, why, w: size.w, h: size.h };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const user = await getUser(req);
  if (!user) return json({ error: "not_signed_in" }, 401);
  const FAL = env("FAL_KEY");
  if (!FAL) return json({ error: "not_configured" }, 503);

  let b: any;
  try { b = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const idem = clean(b.idem, 80), mode = b.mode === "edit" ? "edit" : "place";
  const scene = Array.isArray(b.scene) ? b.scene.filter((p: any) => /^[a-z0-9-]{2,80}$/.test(p?.h || "")).slice(0, 7)
    .map((p: any) => ({ h: p.h, v: Math.max(0, Math.min(20, Math.floor(+p.v || 0))), x: +p.x || 0, y: +p.y || 0, w: +p.w || 0, flip: !!p.flip })) : [];
  const edit = mode === "edit" && b.edit && typeof b.edit === "object"
    ? Object.fromEntries(Object.entries(b.edit).filter(([k, v]) => EDITS[k]?.[String(v)]).map(([k, v]) => [k, String(v)])) : null;
  const room = dataUrlBytes(b.room), guide = dataUrlBytes(b.guide);
  if (!idem || !room || !guide) return json({ error: "bad_request" }, 400);
  const sent = b.size && +b.size.w > 99 && +b.size.h > 99 && +b.size.w < 8000 && +b.size.h < 8000 ? { w: +b.size.w, h: +b.size.h } : null;
  const roomSize = headerSize(room.bytes) || sent;
  if (!roomSize) return json({ error: "bad_request" }, 400);
  const parent = typeof b.parent === "string" && /^[0-9a-f-]{36}$/.test(b.parent) ? b.parent : null;

  const db = admin();
  const { data: settings } = await db.from("app_settings").select("key,value");
  const S = Object.fromEntries((settings || []).map((r: any) => [r.key, r.value]));
  const model = String(S.fal_model || "fal-ai/nano-banana-2/edit"), est = Number(S.est_cost_usd || 0.05);
  const T = { min_bytes: 15000, min_side: 640, aspect_tol: 0.12, min_change: 0.02, max_outside: 0.16, min_present: 0.8, ...(S.qc || {}) } as Record<string, number>;
  const qcOn = S.qc_enabled !== false;

  const { data: res, error: rErr } = await db.rpc("ai_reserve", { p_user: user.id, p_idem: idem, p_mode: mode, p_scene: scene, p_edit: edit, p_cost: est });
  if (rErr) return dbError(rErr.message);
  const gen = res.id as string;
  if (!res.created) {
    if (res.status === "done" && res.result_path) {
      const { data: s } = await db.storage.from("results").createSignedUrl(res.result_path, 7 * 86400);
      return json({ id: gen, url: s?.signedUrl, replay: true });
    }
    return json({ error: res.status === "running" ? "in_progress" : "provider_failed" }, 409);
  }
  if (parent) await db.from("generations").update({ parent_id: parent }).eq("id", gen).eq("user_id", user.id)
    .then(() => db.from("generations").select("id").eq("id", parent).eq("user_id", user.id).maybeSingle())
    .then(({ data }) => { if (!data) return db.from("generations").update({ parent_id: null }).eq("id", gen); });

  // the steps go out as lines when the browser asks for them; otherwise one JSON answer at the end
  const streaming = /application\/x-ndjson/.test(req.headers.get("accept") || "");
  const enc = new TextEncoder();
  let push: (o: unknown) => void = () => {};
  const work = async () => {
    const t0 = Date.now();
    const roomPath = `${user.id}/${gen}-room.${room.type === "png" ? "png" : "jpg"}`, guidePath = `${user.id}/${gen}-guide.${guide.type === "png" ? "png" : "jpg"}`;
    try {
      const up1 = await db.storage.from("rooms").upload(roomPath, room.bytes, { contentType: `image/${room.type}`, upsert: true });
      const up2 = await db.storage.from("rooms").upload(guidePath, guide.bytes, { contentType: `image/${guide.type}`, upsert: true });
      if (up1.error || up2.error) throw new Error("upload");
      const sign = async (p: string) => (await db.storage.from("rooms").createSignedUrl(p, 900)).data?.signedUrl;
      const urls = [await sign(roomPath), await sign(guidePath)];
      const site = siteUrl();
      const refs = site ? scene.map((p: any) => `${site}/assets/img/cut/${p.h}.webp`) : [];
      const ratio = nearestRatio(roomSize.w / roomSize.h);
      const attempt = async (again: boolean) => {
        const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 70_000);
        try {
          const r = await fetch(`https://fal.run/${model}`, {
            method: "POST", signal: ctrl.signal,
            headers: { Authorization: `Key ${FAL}`, "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: prompt(mode, scene, edit, refs.length > 0, again), image_urls: [...urls, ...refs], num_images: 1, output_format: "jpeg", aspect_ratio: ratio }),
          });
          if (!r.ok) throw new Error(`provider ${r.status}: ${(await r.text()).slice(0, 200)}`);
          const out = await r.json();
          const imgUrl = out?.images?.[0]?.url || out?.image?.url;
          if (!imgUrl) throw new Error("provider returned no image");
          return new Uint8Array(await (await fetch(imgUrl)).arrayBuffer());
        } finally { clearTimeout(t); }
      };
      let img = await attempt(false), calls = 1, retried = false;
      if (qcOn) {
        const q1 = await check(img, room.bytes, guide.bytes, roomSize, scene, mode, T);
        if (!q1.ok && Date.now() - t0 < 75_000) {
          push({ stage: "retry" }); retried = true;
          try {
            const img2 = await attempt(true); calls = 2;
            const q2 = await check(img2, room.bytes, guide.bytes, roomSize, scene, mode, T);
            if (q2.ok || q2.score >= q1.score) img = img2; // the better of the two, never a third call
          } catch (_e) { calls = 2; /* the second call failed: the first picture is delivered */ }
        }
      }
      const size = headerSize(img) || roomSize;
      const resultPath = `${user.id}/${gen}.${size.w}x${size.h}.jpg`, beforePath = `${user.id}/${gen}-before.jpg`;
      const up3 = await db.storage.from("results").upload(resultPath, img, { contentType: "image/jpeg", upsert: true });
      if (up3.error) throw new Error("result upload");
      // the before picture is the customer's own photo, kept beside the result (not removed by the 30-day room cleanup)
      await db.storage.from("results").upload(beforePath, room.bytes, { contentType: `image/${room.type}`, upsert: true });
      const { data: done } = await db.rpc("ai_finish", { p_gen: gen, p_room: roomPath, p_guide: guidePath, p_result: resultPath, p_model: model, p_cost: est * calls });
      if (!done) return { error: "provider_failed" }; // timed out and already refunded
      const { data: s } = await db.storage.from("results").createSignedUrl(resultPath, 7 * 86400);
      return { id: gen, url: s?.signedUrl, retried, w: size.w, h: size.h };
    } catch (e) {
      await db.rpc("ai_fail", { p_gen: gen, p_error: String((e as Error)?.message || e) });
      return { error: "provider_failed" };
    }
  };

  if (!streaming) { const out = await work(); return json(out, (out as any).error ? 502 : 200); }
  const body = new ReadableStream({
    async start(c) {
      push = (o) => { try { c.enqueue(enc.encode(JSON.stringify(o) + "\n")); } catch (_e) { /* the browser left */ } };
      push({ stage: "started" });
      push(await work());
      c.close();
    },
  });
  return new Response(body, { headers: { ...CORS, "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
});
```

Notes:
- `imagescript` is pure TypeScript (no native code), works in Supabase Edge Functions; if the founder prefers no
  extra import, delete the decode part of `check()` and keep the header checks (empty, size, shape).
- `qc` (object of thresholds) and `qc_enabled` (boolean) are optional `app_settings` rows; without them the defaults
  in the code apply. Tune `min_present` / `max_outside` on the first real pictures.
- The `parent` update uses columns that exist (`parent_id`), no migration.

## 4. New function `ai-library` (for "Mina rumsbilder" in the account)

The client calls it only when `RQ_CONFIG.studio.serverLibrary = true`. `verify_jwt` on.

### `supabase/functions/ai-library/index.ts` (proposed)

```ts
// Mina rumsbilder: the signed-in customer's AI pictures with their before pictures, newest first.
// POST {action:"list"} -> {items:[{id, at, url, before_url, scene, w, h, project, n}]}
// POST {action:"delete", id} -> {ok:true}  (removes the result and the before picture; the row stays for the credit ledger)
import { admin, CORS, getUser, json } from "./shared.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const user = await getUser(req);
  if (!user) return json({ error: "not_signed_in" }, 401);
  let b: any; try { b = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const db = admin();

  if (b.action === "list") {
    const { data: rows, error } = await db.from("generations").select("id, created_at, scene, result_path, parent_id")
      .eq("user_id", user.id).eq("status", "done").not("result_path", "is", null).order("created_at", { ascending: false }).limit(60);
    if (error) return json({ error: "server_error" }, 500);
    const paths = (rows || []).flatMap((r: any) => [r.result_path, `${user.id}/${r.id}-before.jpg`]);
    const { data: signed } = paths.length ? await db.storage.from("results").createSignedUrls(paths, 3600) : { data: [] };
    const url = new Map((signed || []).filter((s: any) => s.signedUrl).map((s: any) => [s.path, s.signedUrl]));
    // versions: a room project is its first generation (parent_id), numbered oldest first
    const byProject = new Map<string, any[]>();
    for (const r of [...(rows || [])].reverse()) { const k = r.parent_id || r.id; if (!byProject.has(k)) byProject.set(k, []); byProject.get(k)!.push(r); }
    const n = new Map<string, number>(); byProject.forEach((list) => list.forEach((r, i) => n.set(r.id, i + 1)));
    const items = (rows || []).map((r: any) => {
      const m = /\.(\d+)x(\d+)\.jpg$/.exec(r.result_path || "");
      return { id: r.id, at: r.created_at, url: url.get(r.result_path) || null, before_url: url.get(`${user.id}/${r.id}-before.jpg`) || null,
        scene: r.scene || [], w: m ? +m[1] : null, h: m ? +m[2] : null, project: r.parent_id || r.id, n: n.get(r.id) || 1 };
    }).filter((x: any) => x.url);
    return json({ items });
  }

  if (b.action === "delete") {
    const id = String(b.id || "");
    if (!/^[0-9a-f-]{36}$/.test(id)) return json({ error: "bad_request" }, 400);
    const { data: g } = await db.from("generations").select("id, result_path").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (!g) return json({ error: "not_found" }, 404);
    await db.storage.from("results").remove([g.result_path, `${user.id}/${id}-before.jpg`].filter(Boolean));
    await db.from("generations").update({ result_path: null, error: "removed by the customer" }).eq("id", id).eq("user_id", user.id);
    return json({ ok: true });
  }
  return json({ error: "bad_request" }, 400);
});
```

The client defers the delete call for 7 seconds so "Ångra" works without a server undo.

Also: `ai-cleanup` keeps working unchanged (it deletes `rooms` after 30 days and orphans of deleted users in both
buckets). `delete_my_account` removes the auth user, after which `ai_cleanup_paths` finds both result and before.

## 5. +10 AI pictures per purchase (founder's limit; not granted anywhere today)

`credit_ledger.reason` already allows `purchase_bonus`. A proposed function, to call from the order webhook once
Shopify orders reach Supabase (migration, **not applied**):

```sql
create or replace function public.ai_grant_purchase(p_user uuid, p_order text, p_images int default 10)
returns boolean language plpgsql security definer set search_path = public as $$
declare b record;
begin
  perform pg_advisory_xact_lock(hashtext(p_user::text));
  if exists (select 1 from public.credit_ledger where user_id = p_user and reason = 'purchase_bonus' and ref = p_order) then return false; end if;
  select * into b from public.ai__month_bounds();
  insert into public.credit_ledger (user_id, reason, delta, remaining, ref, expires_at)
  values (p_user, 'purchase_bonus', p_images, p_images, p_order, b.m_end + interval '1 month');
  return true;
end $$;
revoke all on function public.ai_grant_purchase(uuid, text, int) from public, anon, authenticated;
```

The client shows nothing about the bonus until it is granted for real (the number is in `RQ_CONFIG.studio.purchaseBonus`).

## 6. To deploy (founder)

1. Confirm `aspect_ratio` on fal's page for `fal-ai/nano-banana-2/edit`.
2. Deploy `generate` (section 3) and `ai-library` (section 4) with `shared.ts` next to each.
3. Set `studio.serverLibrary: true` in `assets/js/config.js` and build; the consent and privacy texts switch to the
   "before picture is kept in your account" wording by themselves.
4. Optional: `app_settings` rows `qc` / `qc_enabled`; the purchase-bonus function when the order webhook exists.

---

# Studio 2 (Mitt hem, the core flow): proposed tables and fields (not deployed)

Agent: studio-ai, branch studio-ai. **Proposal only. Nothing has been deployed and the database has not been changed.**

## 7. One storage layer for Mitt hem: `home_store`

The client (`assets/js/hem.js`, `RQ.vault`) keeps everything in this browser today. With
`RQ_CONFIG.studio.serverSync = true` and a signed-in customer it pushes the same keys to one table and pulls them on
sign-in (newest wins). The keys are `rumiq-home` (room projects incl. measurements, style, budget, items, scene, Köpt,
feedback), `rumiq-wish` (favourites), `rumiq-looks`, `rumiq-boards` (moodboards), `rumiq-chat-saved` (stylist
conversation), `rumiq-style`, `rumiq-room-active`. One key-value table keeps the client and server in step while the
data model still moves; it can later be split into the typed tables in section 8 without changing the client
contract.

```sql
create table public.home_store (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null check (key in ('rumiq-home','rumiq-wish','rumiq-looks','rumiq-boards','rumiq-chat-saved','rumiq-style','rumiq-room-active')),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key),
  constraint home_store_size check (pg_column_size(value) < 512000)
);
alter table public.home_store alter column user_id set default auth.uid();
alter table public.home_store enable row level security;
create policy home_store_own_select on public.home_store for select to authenticated using (user_id = (select auth.uid()));
create policy home_store_own_insert on public.home_store for insert to authenticated with check (user_id = (select auth.uid()));
create policy home_store_own_update on public.home_store for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy home_store_own_delete on public.home_store for delete to authenticated using (user_id = (select auth.uid()));
```

The client calls `upsert(rows, { onConflict: "user_id,key" })` with `{ key, value, updated_at }` (user_id from the
default). `delete_my_account` already deletes the auth user; the cascade removes these rows.

## 8. Typed tables (when the model has settled)

```sql
-- room projects (Mitt hem rooms)
create table public.room_projects (
  id text primary key,                          -- the client's id ("rm…"), so links and pictures keep pointing at it
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label text not null check (length(label) <= 40),
  room_type text not null,                      -- vardagsrum, sovrum, kok, hall, badrum, hemmakontor, uteliv
  style text, budget_sek int check (budget_sek is null or budget_sek > 0),
  colours text[] default '{}', material text default '', notes text default '' check (length(notes) <= 500),
  measures jsonb default '{}',                  -- floorW, floorD, wallW, windowW (cm)
  items jsonb default '[]',                     -- [{h, v}] chosen products and colour index
  scene jsonb default '[]',                     -- the placed scene in Mitt rum
  bought jsonb default '{}',                    -- handle -> time ticked; shop orders are added on read
  generation_root uuid references public.generations(id) on delete set null,  -- its AI pictures (parent_id chain)
  created_at timestamptz default now(), updated_at timestamptz default now()
);
-- stylist conversations
create table public.stylist_conversations (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  room_id text references public.room_projects(id) on delete set null,
  messages jsonb not null default '[]',         -- [{who, text, q}|{who:'ai', a:{picks,text,tags}}], last 40
  updated_at timestamptz default now()
);
-- wishlist
create table public.wishlist (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  handle text not null, variant int default 0, room_id text references public.room_projects(id) on delete set null,
  created_at timestamptz default now(), primary key (user_id, handle)
);
-- the same four own-row policies as home_store on each table (select/insert/update/delete where user_id = auth.uid())
alter table public.generations add column if not exists room_id text references public.room_projects(id) on delete set null; -- "Flytta till rum"
```

## 9. "Vad tycker du?" with real sync (today: links only)

Today the proposal travels in the link (`#delad-f.<room>.<type>.<style>.<items>~<name>`) and the answer comes back
as a link (`#delad-s.<room>.<pid+/->~<name>`), which lands in the room when the customer opens it. Nothing is stored.
For answers that arrive without a second link:

```sql
create table public.room_feedback (
  id bigint generated always as identity primary key,
  share_token text not null,                    -- random, 22 chars, made by the owner; in the link instead of the room id
  room_id text not null references public.room_projects(id) on delete cascade,
  name text check (length(name) <= 30),
  answers jsonb not null,                       -- {handle: 1 | 0}
  created_at timestamptz default now()
);
create table public.room_shares (token text primary key, room_id text not null references public.room_projects(id) on delete cascade,
  user_id uuid not null default auth.uid(), items jsonb not null, expires_at timestamptz default now() + interval '30 days');
alter table public.room_feedback enable row level security; alter table public.room_shares enable row level security;
-- the owner reads answers to their rooms; anyone with a valid, unexpired token may add one answer (via an RPC that checks the token)
create policy feedback_owner_read on public.room_feedback for select to authenticated
  using (exists (select 1 from public.room_projects r where r.id = room_id and r.user_id = (select auth.uid())));
create policy shares_owner on public.room_shares for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- public.room_feedback_add(p_token text, p_name text, p_answers jsonb) security definer: checks room_shares.token and
-- expires_at, caps 20 answers per token, inserts one row. Granted to anon and authenticated.
```

## 10. Real measurements from Shopify (product metafields)

The client's `size` field (cm) and the editor's true scale read width, height and depth per product. Expected
Shopify product metafields (namespace `rumiq`, type `number_decimal`, unit cm), filled by the founder's import:

| Metafield | Meaning | Client field |
|---|---|---|
| `rumiq.width_cm` | width, front view | `size.w` |
| `rumiq.height_cm` | height | `size.h` |
| `rumiq.depth_cm` | depth | `size.d` |
| `rumiq.surface` (single_line_text: golv, vägg, bord, säng, soffa, fönster) | where it stands | the editor's surface |
| `rumiq.pack_count` (number_integer, optional) | pieces per pack (curtains 2) | `size.n` |

If the founder prefers Shopify's standard product dimensions on the variant instead, map: `variant.weight` is not
used; there is no standard width/height/depth field on products, so metafields are the expected path. Read with the
Storefront API: `product { metafields(identifiers: [{namespace:"rumiq", key:"width_cm"}, …]) { key value } }`.
A product without them keeps today's behaviour: drawn at an approximate size, and the editor says "Storleken är ungefärlig".

## 11. Svep tillsammans, live group sessions (svep2, proposal only, nothing deployed)

Today a group lives in its link: `#svep-ihop-g<group>.<cards>.<person>_<person>…` (group id 4 chars, each card's
4-char product number, each person = answers as hex + a 2-char id + an optional name). Each answer link carries
everyone so far; two links from the same group meet in a browser that has seen both (merged by person id). Groups you
are in are kept in `rumiq-groups` (synced through `home_store` with the other keys when the account is live).
For live sessions (everyone sees new answers without a new link, no forks):

```sql
create table public.svep_groups (
  id text primary key check (id ~ '^[0-9a-z]{12}$'),     -- longer than today's 4 chars: the id is the only key to the group
  cards text[] not null check (array_length(cards, 1) between 3 and 30),   -- product handles, in order
  scope text,                                            -- room type or null (whole home)
  created_by uuid default auth.uid(),                    -- null when made without an account
  created_at timestamptz default now(),
  expires_at timestamptz default now() + interval '60 days'
);
create table public.svep_group_answers (
  group_id text not null references public.svep_groups(id) on delete cascade,
  person_id text not null check (person_id ~ '^[0-9a-z]{2,8}$'),
  name text check (length(name) <= 24),
  bits text not null check (bits ~ '^[01]{3,30}$'),      -- 1 = likes, one per card
  user_id uuid default auth.uid(),
  created_at timestamptz default now(),
  primary key (group_id, person_id)
);
create table public.svep_group_rooms (                  -- "Gör ett rum av det": which room each signed-in member made
  group_id text references public.svep_groups(id) on delete cascade, user_id uuid default auth.uid(), room_id text,
  primary key (group_id, user_id)
);
alter table public.svep_groups enable row level security;
alter table public.svep_group_answers enable row level security;
alter table public.svep_group_rooms enable row level security;
-- No table-wide reads for anon: everything goes through two security-definer RPCs that need the group id.
-- svep_group_get(p_id text) returns cards + answers (names, bits) for an unexpired group.
-- svep_group_answer(p_id text, p_person text, p_name text, p_bits text): inserts one row; refuses a 7th person,
--   bits of the wrong length, an expired group; rate limit 20 calls per ip and hour (edge function in front).
grant execute on function public.svep_group_get(text), public.svep_group_answer(text, text, text, text) to anon, authenticated;
create policy rooms_own on public.svep_group_rooms for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- Realtime: broadcast on channel 'svep:<group id>' after each insert (from the RPC), so open result pages update live.
```

Client changes when it goes live: `G.fresh()` creates the row (12-char id) and keeps today's URL shape with the long id;
`V.svepIhop` reads `svep_group_get` and subscribes to the channel; the URL answers stay as the fallback (no account,
offline, server down). Counting: `svep_group_start`, `svep_group_created`, `svep_group_opened`, `svep_group_completed`,
`svep_group_share` (method), `svep_group_room`, `more_like`, `style_share` are sent today with `RQ.track` (dataLayer,
only with consent to statistics); the founder sees them in the analytics tool once it is connected.

# Placera och skapa: `generate` with pins (place ai, 2026-11-26; proposal only, nothing deployed)

Branch `s2-ai` (worktree /home/claude/wt12). This extends section 3. The founder deploys; nothing here has been
deployed, and the database is unchanged.

## 12.1 What the client sends now

`mode: "place"` and, from Placera och skapa only, two new fields (older clients send neither, and the function then
behaves exactly as in section 3):

```jsonc
{
  "pins": [                                   // RQ.room.pins(), 1-5, in pin order; product i is image i + 1 (after the room)
    { "h": "glob-bordslampa-opalglas", "v": 0, // product handle and colour index
      "x": 78.2, "y": 68.6,                   // the foot point in % of the photo (y = where it stands)
      "surface": "bord",                      // golv | bord | vagg | sang | soffa
      "size": { "w": 25, "h": 35 },           // cm, or null ("Mått kommer")
      "scale": { "cmPerPct": 3.1, "sure": true }, // cm per 1 % of the photo width at that place; sure:false = estimate
      "w": 8.1,                               // drawn width in % of the photo
      "name": "Glob table lamp, opal glass",  // English name (data.js `en`), cleaned on the server
      "tone": "#EDE6DA", "colour": "Opal" }   // the product colour shown, for the colour check
  ],
  "room_info": { "type": "vardagsrum", "sample": true, "map": "vardagsrum", "known": null }
}
```

The client still sends `room`, `guide` (the honest preview: cut-outs at the pins, true scale) and `scene` as before.
While `RQ_CONFIG.studio.aiLive` is `false` (today), the client sends **nothing**. Everyone, guest or signed in, sees
the honest preview built from the same pins ("Förhandsvisning – så här blir bilden när AI:n är på", "Ingenting har
skickats"). To switch the real picture on, deploy this function with its keys, then set `aiLive: true` in
`assets/js/config.js`.

## 12.2 Validation (add to the request parsing)

```ts
const SURF = new Set(["golv", "bord", "vagg", "sang", "soffa"]);
const HANDLE = /^[a-z0-9-]{2,60}$/, HEX = /^#[0-9a-f]{6}$/i;
const num = (v: unknown, lo: number, hi: number) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null; };
function parsePins(raw: unknown) {
  if (!Array.isArray(raw)) return null;
  const pins = raw.slice(0, 5).map((p: any) => {
    if (!p || !HANDLE.test(String(p.h)) || !SURF.has(p.surface)) return null;
    const x = num(p.x, 0, 100), y = num(p.y, 0, 100); if (x == null || y == null) return null;
    const size = p.size && typeof p.size === "object" ? Object.fromEntries(["w", "h", "d"].map((k) => [k, num(p.size[k], 1, 1000)]).filter(([, v]) => v != null)) : null;
    return { h: String(p.h), v: num(p.v, 0, 20) ?? 0, x, y, surface: p.surface as string, size: size && Object.keys(size).length ? size : null,
      scale: { cmPerPct: num(p.scale?.cmPerPct, 0.1, 100), sure: p.scale?.sure === true }, w: num(p.w, 0.5, 100),
      name: clean(p.name, 60) || String(p.h).replace(/-/g, " "), tone: HEX.test(String(p.tone)) ? String(p.tone) : null, colour: clean(p.colour, 30) };
  });
  return pins.every(Boolean) && pins.length ? pins as any[] : null;
}
// in the handler: const pins = mode === "place" ? parsePins(body.pins) : null;
// room_info: type/map must be one of the sample room ids, known = { cm, px } numbers or null.
```

`ai_reserve` keeps its limit of 6 products, and pins are at most 5. The pins go into `generations.scene` (jsonb),
so no migration is needed.

## 12.3 The prompt: the tested template (place-test/prompts.md)

The images are sent as: image 1 = the room photo, images 2..n+1 = the products' cut-outs in pin order. The cut-outs
come from the site, `${siteUrl()}/assets/img/cut/${h}.webp`, never from a URL the browser sends; Shopify product
images take their place later. The guide is **not** sent in place mode. The test showed the model follows the words
and the true sizes better than a pasted layout, and the guide would also add a second "room".

```ts
// sample rooms: named things the place text can refer to (from room.js MAPS; x/y in % of the photo)
const ANCHORS: Record<string, { name: string; x: number; y: number; surface: string }[]> = {
  vardagsrum: [{ name: "the oak side table", x: 78, y: 68, surface: "bord" }, { name: "the sofa", x: 62, y: 66, surface: "soffa" },
    { name: "the round mirror", x: 62, y: 38, surface: "vagg" }, { name: "the window with linen curtains", x: 93, y: 60, surface: "vagg" }],
  sovrum: [{ name: "the bedside table", x: 14, y: 70, surface: "bord" }, { name: "the bed", x: 50, y: 70, surface: "sang" }],
  kok: [{ name: "the kitchen worktop", x: 60, y: 62, surface: "bord" }],
  hall: [{ name: "the bench", x: 49, y: 68, surface: "bord" }, { name: "the chest of drawers", x: 10, y: 60, surface: "bord" }],
  badrum: [{ name: "the vanity beside the basin", x: 38, y: 59, surface: "bord" }, { name: "the shelf", x: 48, y: 33, surface: "bord" }],
  hemmakontor: [{ name: "the desk", x: 66, y: 63, surface: "bord" }],
};
const KNOWN_SIZES: Record<string, string> = { // the "scale everything correctly" line
  vardagsrum: "the sofa is about 200 cm wide and the side table about 55 cm high", sovrum: "the bed is 160 cm wide",
  kok: "the worktop is 90 cm high", hall: "the bench is about 110 cm wide", badrum: "the basin is about 60 cm wide", hemmakontor: "the desk is about 75 cm high",
};
const ROOM_EN: Record<string, string> = { vardagsrum: "living room", sovrum: "bedroom", kok: "kitchen", hall: "hallway", badrum: "bathroom", hemmakontor: "home office", uteliv: "balcony" };
const cmText = (s: any) => s ? [s.w, s.h, s.d].filter(Boolean).map((n: number) => Math.round(n)).join(" x ") + " cm" : "";
const side = (x: number) => (x < 33 ? "on the left" : x > 66 ? "on the right" : "in the middle");
function where(p: any, map: string | null) {
  const a = (map && ANCHORS[map] || []).filter((q) => q.surface === p.surface || p.surface === "golv")
    .sort((q, r) => Math.hypot(q.x - p.x, q.y - p.y) - Math.hypot(r.x - p.x, r.y - p.y))[0];
  const pos = `about ${Math.round(p.x)} % from the left${p.surface === "vagg" ? `, its bottom edge about ${Math.round(100 - p.y)} % up from the bottom of the picture` : ""}`;
  switch (p.surface) {
    case "bord": return `standing on ${a ? a.name : "the table " + side(p.x)} (${pos})`;
    case "soffa": return `draped over ${a ? a.name : "the sofa"}, ${side(p.x)} (${pos})`;
    case "sang": return `lying on ${a ? a.name : "the bed"}, made up neatly (${pos})`;
    case "vagg": return p.h?.includes("gardin") ? `hanging at ${a ? a.name : "the window"} from ceiling to floor (${pos})` : `hanging on the wall${a ? " near " + a.name : ""} at about 150 cm height (${pos})`;
    default: return /matta/.test(p.h) ? `lying flat on the floor ${a ? "in front of " + a.name : side(p.x)}, long side parallel to the back wall (${pos})` : `standing on the floor ${a ? "beside " + a.name : side(p.x)} (${pos})`;
  }
}
function placePrompt(pins: any[], info: any, fix: { i: number; colour: string }[] = []) {
  const map = info?.sample && ANCHORS[info.map] ? info.map : null, type = ROOM_EN[info?.type] || "room";
  const scale = map ? KNOWN_SIZES[map] : info?.known?.cm ? `a length the customer measured is ${Math.round(info.known.cm)} cm` : "use ordinary furniture sizes";
  const lines = pins.map((p, i) => `${i + 1}) Image ${i + 2}, ${p.name}${p.colour ? ` in ${p.colour}` : ""}${p.size ? `, ${cmText(p.size)}` : ""}${p.scale?.sure ? "" : " (approximate size)"}: ${where(p, map)}.`);
  return [
    `Edit the FIRST image (a photo of a ${type}). Keep the room exactly as it is: same camera angle, framing, walls, window, floor, furniture, decor and the same light.`,
    "Only add these products, copied faithfully from the reference images (same shape, colour, material, texture and proportions), each placed where the customer pointed and at its true real-world size:",
    ...lines,
    `Scale everything correctly relative to the room: ${scale}.`,
    "Realistic contact shadows and light that matches the room. Photorealistic interior photograph, no text, no labels, no people, nothing else changed.",
    ...fix.map((f) => `Important: keep the exact colour of image ${f.i + 2} (${f.colour}), not more yellow or saturated.`),
  ].join("\n");
}
```

In `attempt(again)`, for place mode with pins:
`body: { prompt: placePrompt(pins, info, fix), image_urls: [roomUrl, ...pins.map((p) => refUrl(p))], num_images: 1, output_format: "jpeg", aspect_ratio: ratio }`.

**Referensbilden per produkt (tillagt 26 nov):** klienten skickar `pin.cut`, produktens egen rumsbild som absolut adress.
Exempel: `.../assets/img/cut/lin-kuddfodral-rum.webp` är en kudde i Havre, och `plad-ullblandning-havre-rum.webp` är
plädet utan butiksfotots stång. Butikens frilagda bild av kuddfodralet visar två kuddar i två färger. Skickas den till
AI:n ritar den två kuddar.
- `refUrl(p)` = `p.cut` när adressen börjar med sajtens egen adress (GitHub Pages eller den egna domänen), annars `cutUrl(p.h)`.
- Lägg till adressen i valideringen i 12.2, så att bara sajtens egna bilder hämtas.
- När produkterna kommer från Shopify: lägg rumsbilden som en egen bild på produkten, eller som metafältet
  `rumiq.room_image`.

## 12.4 Colour check per product (ΔE), with the one retry

This is added to `check()` for place mode. It is the bedroom test's lesson: the duvet came out more yellow than the
product's sand.

1. For each pin, the product's area in the result: the box `[x - w/2, y - hP] .. [x + w/2, y]` in %, where `hP` comes
   from the size (h/w times the photo's aspect), widened by 15 %. Inside that box, keep only the pixels that changed
   against the room photo (the room's own things are not counted).
2. Reference colour: the mean Lab of the cut-out's opaque pixels (alpha > 200), computed once per product and cached.
   Fall back to the pin's `tone`.
3. `ΔE76 = |Lab_result − Lab_ref|`. A pin fails when `ΔE > qc.color_de` (default **12**; tune on real pictures) or when
   fewer than 8 % of the box's pixels changed (the product is missing).
4. When any pin fails and the time allows (the same 75 s rule), stream `{stage:"retry"}` and call once more with
   `placePrompt(pins, info, failed.map((f) => ({ i: f.i, colour: f.colour || "the colour of its reference image" })))`.
   Deliver the better of the two by score (the sum of ΔE plus a missing penalty). One credit, two calls in `cost_usd`.

```ts
const lab = (r: number, g: number, b: number) => { // sRGB D65 -> CIELAB
  const f = (c: number) => { c /= 255; return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92; };
  const R = f(r), G = f(g), B = f(b);
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, Y = R * 0.2126 + G * 0.7152 + B * 0.0722, Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const t = (v: number) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
  return [116 * t(Y) - 16, 500 * (t(X) - t(Y)), 200 * (t(Y) - t(Z))];
};
const refCache = new Map<string, number[]>();
async function refLab(url: string, tone: string | null) {
  if (refCache.has(url)) return refCache.get(url)!;
  let out: number[] | null = null;
  try { const im = await decode(new Uint8Array(await (await fetch(url)).arrayBuffer())) as Image; const s = im.resize(64, Image.RESIZE_AUTO); let n = 0; const acc = [0, 0, 0];
    for (const [x, y, c] of s.iterateWithColors()) { if ((c & 255) < 200) continue; const L = lab((c >>> 24) & 255, (c >>> 16) & 255, (c >>> 8) & 255); acc[0] += L[0]; acc[1] += L[1]; acc[2] += L[2]; n++; void x; void y; }
    if (n > 20) out = acc.map((v) => v / n);
  } catch (_e) { /* fall back to the tone */ }
  if (!out && tone) out = lab(parseInt(tone.slice(1, 3), 16), parseInt(tone.slice(3, 5), 16), parseInt(tone.slice(5, 7), 16));
  if (out) refCache.set(url, out); return out;
}
async function colourCheck(out: Image, room: Image, pins: any[], aspect: number, T: Record<string, number>) {
  const W = 256, H = Math.round(W / aspect), a = out.clone().resize(W, H), b = room.clone().resize(W, H), res = [];
  for (let i = 0; i < pins.length; i++) {
    const p = pins[i], wP = (p.w || 10) * 1.15, hP = (p.size?.h && p.size?.w ? wP * p.size.h / p.size.w : wP) * aspect * 1.15;
    const x0 = Math.max(0, Math.floor((p.x - wP / 2) / 100 * W)), x1 = Math.min(W - 1, Math.ceil((p.x + wP / 2) / 100 * W));
    const y0 = Math.max(0, Math.floor((p.y - hP) / 100 * H)), y1 = Math.min(H - 1, Math.ceil(p.y / 100 * H));
    let n = 0, all = 0; const acc = [0, 0, 0];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { all++; const c = px(a, x, y), d = px(b, x, y); if (diff(c, d) < 0.06) continue; const L = lab(c[0], c[1], c[2]); acc[0] += L[0]; acc[1] += L[1]; acc[2] += L[2]; n++; }
    const ref = await refLab(`${siteUrl()}/assets/img/cut/${p.h}.webp`, p.tone);
    const present = all > 0 && n / all >= (T.place_min_changed ?? 0.08);
    const de = present && ref ? Math.hypot(acc[0] / n - ref[0], acc[1] / n - ref[1], acc[2] / n - ref[2]) : 99;
    res.push({ i, de: Math.round(de), ok: present && de <= (T.color_de ?? 12), colour: p.colour });
  }
  return { ok: res.every((r) => r.ok), score: -res.reduce((s, r) => s + Math.min(r.de, 60), 0), failed: res.filter((r) => !r.ok) };
}
```

Notes:
- ΔE is measured on the changed pixels in the product's box. Shadows and light are counted too, so 12 is a lenient
  start. Log `de` per pin in `generations.error` (or a jsonb `qc` column later) for the first real pictures, then tune.
- Lamps that are on (glowing glass) read lighter than the cut-out. For `belysning-atmosfar` products only the hue is
  compared (a, b), not L.
- The existing checks (empty, shape, unchanged, nothing else moved) stay. In place mode the "product present" check is
  the per-pin one above, not the guide difference.

## 12.5 To switch it on (founder)

1. Deploy `generate` with sections 3 + 12 (same `shared.ts`). The keys are `FAL_KEY` (as today) and `SITE_URL`
   (for the cut-outs).
2. Make one test picture per sample room and check `qc` in the logs. Change `app_settings.qc.color_de` if needed.
3. Set `RQ_CONFIG.studio.aiLive = true` in `assets/js/config.js` and publish. From then on:
   - Skapa bilden asks for sign-in and consent;
   - each picture costs one AI picture;
   - the texts change by themselves ("5 AI-bilder gratis i månaden med konto").

# 13. AI-stylisten och stilanalys från foton (förslag 2026-11-26, ingenting deployat)

Jämförelsen med Lovable-studion visade två saker som kräver en server. Allt annat i den listan finns redan i sajten:
Placera och skapa med fem saker, Köp allt i bilden, Byt produkt och färg i resultatet, rum per projekt i Mitt hem,
"Vad tycker du?", och kärnflödet Svep → rumsförslag → Se det i ditt rum.

## 13.1 AI-stylisten (`supabase/functions/stylist`)
- Idag svarar stylisten med fasta regler och sortimentet. Sidan säger det ärligt ("inte med en AI-tjänst än").
- Förslag: en funktion som tar frågan, rummet och stilen och svarar med råd plus högst fyra produkter.
  - Produkterna väljs bara ur katalogen (handles som servern kontrollerar mot Shopify), aldrig påhittade.
- Gränser, räknade på servern per dygn (Europe/Stockholm):
  - gäst: 10 frågor per IP och webbläsar-id;
  - konto: 30 frågor;
  - Studio Plus: 60 frågor.
- Kontots samtal sparas i `stylist_conversations` (avsnitt 8).
- Klienten: `RQ_CONFIG.studio.stylistLive` (false tills grundaren slår på). När den är false visas dagens regelsvar.
- Kostnad: ange modell och pris per 1 000 frågor innan den slås på. Grundaren bestämmer.

## 13.2 Stilanalys från foton (`supabase/functions/analyse`)
- Upp till 3 foton av ett rum. Svaret innehåller:
  - stil (en av `RQ.STYLES`);
  - 3–5 färger som hex;
  - material;
  - tre saker som skulle lyfta rummet, med produkter ur katalogen.
- Kräver konto. Räknas som en AI-bild mot månadens gräns, så att det inte blir en ny gräns att förklara.
- Fotona skickas bara när kunden trycker "Analysera". Inget sparas utan att kunden valt det.
- Svaret sparas som rummets stil i Mitt hem och kan öppnas direkt i Placera och skapa.

## 14. Svep v15.9: röstresultat och Svep-paket (förslag, inget är byggt på servern)

**Röstresultat för "Kommer snart".** I dag sparas varje besökares röst bara i webbläsaren (`rumiq-soon`, `rumiq-votes`).
Resultatsidan i Svep visar därför bara den egna rösten ("Du röstade på …"). För att visa hur alla röstar behövs:

- en tabell `soon_votes (candidate_id text, voter uuid, vote smallint, created_at timestamptz)` med en rad per besökare
  och kandidat (unik på `candidate_id, voter`), `voter` = inloggad användare eller ett anonymt id från webbläsaren;
- en vy eller edge function `soon-results` som returnerar `{ candidate_id, yes, total }` per kandidat, cachad några minuter;
- RLS: alla får läsa summorna, bara ägaren får skriva sin egen rad.
- Klienten: Svep skickar rösten när `RQ_CONFIG.studio.serverSync` är på, och resultatsidan visar "62 % vill ha den" bredvid
  den egna rösten. Ingenting visas förrän servern svarar, så siffror hittas aldrig på.

**Svep-paket och Gruppris (10 % från tre saker).** Rabatten räknas i dag i webbläsaren (`S.allDiscounts`, `rumiq-bundles`).
Innan lansering måste samma regel finnas i Shopify som en automatisk rabatt, annars betalar kunden fullt pris i kassan.
Förslag: en Shopify Function (Discount) som läser ett line-item-attribut `_bundle=<id>` som sajten sätter på varorna i paketet,
och ger `RQ_CONFIG.svepBundle.rate` på de raderna när minst `svepBundle.min` av dem finns i varukorgen.
