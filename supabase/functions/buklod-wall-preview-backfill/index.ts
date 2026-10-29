import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { ImageMagick, initializeImageMagick, MagickFormat } from "npm:@imagemagick/magick-wasm@0.0.45";

// No user-supplied paths are accepted. Only the DB-controlled private queue
// decides the next original file. Service role secrets never leave Edge.
// Bundled functions do not preserve node_modules/*.wasm as local runtime
// files. Fetch a VERSION-PINNED WASM asset once per worker instead.
const wasmUrl = "https://cdn.jsdelivr.net/npm/@imagemagick/magick-wasm@0.0.45/dist/magick.wasm";
let ready: Promise<void> | undefined;
function initialize() {
  if (!ready) ready = fetch(wasmUrl)
    .then(async response => {
      if (!response.ok) throw new Error("magick_wasm_unavailable");
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length < 1000000 || bytes[0] !== 0 || bytes[1] !== 97 || bytes[2] !== 115 || bytes[3] !== 109)
        throw new Error("magick_wasm_invalid");
      await initializeImageMagick(bytes);
    })
    .catch(error => { ready = undefined; throw error; });
  return ready;
}

const json = (payload: Record<string, unknown>, status = 200) =>
  Response.json(payload, { status, headers: { "Cache-Control": "no-store" } });

Deno.serve(async req => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !key) return json({ error: "worker_unconfigured" }, 503);
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const token = req.headers.get("x-buklod-backfill-token") || "";
  if (token.length !== 64 || !/^[a-f0-9]{64}$/.test(token)) return json({ error: "forbidden" }, 403);
  const authorization = await admin.rpc("buklod_legacy_preview_worker_auth_v1", { p_token: token });
  if (authorization.error || authorization.data !== true) return json({ error: "forbidden" }, 403);

  const claim = await admin.rpc("buklod_legacy_preview_claim_v1");
  if (claim.error) return json({ error: "queue_unavailable" }, 503);
  const picked = Array.isArray(claim.data) ? claim.data[0] : null;
  if (!picked) return json({ ok: true, state: "no_work" });

  const path = String(picked.original_path || "");
  let outcome: "done" | "retry" | "skipped" = "retry";
  let message = "";
  let previewBytes = 0;

  try {
    if (!/(^|\/)post-[^/]+\.jpg$/i.test(path) || path.endsWith("-p1.jpg")) {
      outcome = "skipped"; message = "not_a_legacy_jpeg";
    } else {
      const previewPath = path.replace(/\.jpg$/i, "-legacy-preview.jpg");
      const download = await admin.storage.from("community-media").download(path);
      if (download.error || !download.data) throw new Error("source_download_failed");
      const bytes = new Uint8Array(await download.data.arrayBuffer());
      if (bytes.byteLength > 4_000_000 || bytes.byteLength < 1000) {
        outcome = "skipped"; message = "size_outside_safe_bounds";
      } else {
        await initialize();
        const thumbnail = ImageMagick.read(bytes, image => {
          const longest = Math.max(image.width, image.height);
          if (longest <= 0 || longest > 12000) throw new Error("bad_dimensions");
          const ratio = Math.min(1, 384 / longest);
          if (ratio < 1) image.resize(Math.max(1, Math.round(image.width * ratio)), Math.max(1, Math.round(image.height * ratio)));
          image.quality = 48;
          return image.write(MagickFormat.Jpeg, data => Uint8Array.from(data));
        });
        if (thumbnail.length < 1000 || thumbnail.length > 125000 ||
            thumbnail[0] !== 0xff || thumbnail[1] !== 0xd8) {
          outcome = "skipped"; message = "thumbnail_exceeds_cap_or_invalid";
        } else {
          const uploaded = await admin.storage.from("community-media").upload(
            previewPath,
            new Blob([thumbnail], { type: "image/jpeg" }),
            { contentType: "image/jpeg", cacheControl: "31536000", upsert: false }
          );
          if (uploaded.error) {
            const err = String(uploaded.error.message ?? "");
            if (!/already exists|duplicate|resource already|409/i.test(err)) throw new Error("preview_upload_failed");
            const existing = await admin.storage.from("community-media").download(previewPath);
            if (existing.error || !existing.data) throw new Error("existing_preview_unverifiable");
            const old = new Uint8Array(await existing.data.arrayBuffer());
            if (old.length < 1000 || old.length > 125000 || old[0] !== 0xff || old[1] !== 0xd8)
              throw new Error("existing_preview_invalid");
            previewBytes = old.length;
          } else previewBytes = thumbnail.length;

          const indexed = await admin.from("community_wall_legacy_previews")
            .upsert({ original_path: path, preview_path: previewPath, preview_bytes: previewBytes },
              { onConflict: "original_path" });
          if (indexed.error) throw new Error("preview_index_failed");
          outcome = "done";
        }
      }
    }
  } catch (error) {
    message = String(error instanceof Error ? error.message : "unexpected_processing_error").slice(0,120);
    // This bounded worker never retries a failed conversion in the same call.
  }

  const finished = await admin.rpc("buklod_legacy_preview_finish_v1", {
    p_original_path: path, p_result: outcome, p_reason: message || null
  });
  if (finished.error) return json({ ok: false, state: "finalization_error" }, 503);
  return json({ ok: true, state: outcome, preview_bytes: previewBytes, reason: message || undefined });
});
