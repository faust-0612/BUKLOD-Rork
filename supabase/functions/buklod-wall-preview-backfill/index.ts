import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import jpeg from "npm:jpeg-js@0.4.4";
import { findEmbeddedLegacyJpegPreview } from "./legacyThumbnail.ts";
import { sampleLegacyRgbPreview } from "./legacyRgbSampler.ts";

// Pure JS JPEG decode/encode is compatible with the Edge function bundler:
// unlike native sharp or magick-wasm it needs no unbundled WASM binary.
function compactJpeg(source: Uint8Array): Uint8Array {
  // Bounded fallback for JPEG originals without an embedded thumbnail.
  // RGB uses three bytes per pixel; the encoder receives only 384px RGBA.
  const rgb = jpeg.decode(source, {
    useTArray: true, formatAsRGBA: false,
    maxResolutionInMP: 24, maxMemoryUsageInMB: 160,
  });
  const small = sampleLegacyRgbPreview(rgb);
  return new Uint8Array(jpeg.encode(small, 46).data);
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
    if (!/^[^?#]+\/[^/]+\.jpg$/i.test(path) || path.includes("..") ||
        path.includes("://") || /-(?:p1|p1-preview|legacy-preview)\.jpg$/i.test(path)) {
      outcome = "skipped"; message = "not_a_legacy_jpeg";
    } else {
      const previewPath = path.replace(/\.jpg$/i, "-legacy-preview.jpg");
      const download = await admin.storage.from("community-media").download(path);
      if (download.error || !download.data) throw new Error("source_download_failed");
      const bytes = new Uint8Array(await download.data.arrayBuffer());
      if (bytes.byteLength > 4_000_000 || bytes.byteLength < 1000) {
        outcome = "skipped"; message = "size_outside_safe_bounds";
      } else {
        // Decode a small embedded EXIF JPEG first when available. Never trust
        // offsets or bytes without a second bounded JPEG decoder check.
        const embedded = findEmbeddedLegacyJpegPreview(bytes);
        let thumbnail: Uint8Array | null = null;
        if (embedded) {
          try {
            const small = jpeg.decode(embedded, {
              useTArray: true, formatAsRGBA: false,
              maxResolutionInMP: 1, maxMemoryUsageInMB: 16,
            });
            if (small.width > 0 && small.height > 0 &&
                small.width <= 1024 && small.height <= 1024) thumbnail = embedded;
          } catch { /* Corrupt embedded preview: original bounded fallback. */ }
        }
        if (!thumbnail) thumbnail = compactJpeg(bytes);
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
