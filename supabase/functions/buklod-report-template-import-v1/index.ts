import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.2";
import * as XLSX from "npm:xlsx@0.18.5";
import { buildDocxStructureDraft } from "./docx-structure.ts";

const ANALYZER_VERSION = "v8";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify({ analyzer_version: ANALYZER_VERSION, ...body }), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const MAX_BYTES = 12 * 1024 * 1024;
const MAX_SOURCE_TEXT = 80_000;
const AI_TOTAL_TIMEOUT_MS = 48_000;
const AI_ATTEMPT_TIMEOUT_MS = 18_000;
const AI_MAX_ATTEMPTS = 4;
const TRANSIENT_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const SUPPORTED_TYPES = new Set(["short_text", "long_text", "number", "date", "yes_no", "choice"]);

const safe = (value: unknown, max = 4000) => String(value ?? "").trim().slice(0, max);
const objectValue = (value: unknown): Record<string, any> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};

function cleanError(value: unknown) {
  const message = value instanceof Error ? value.message : String(value ?? "Report form import failed.");
  return message.replace(/AIza[0-9A-Za-z_-]{20,}/g, "[redacted]").slice(0, 1400);
}

function inferMimeType(filename: string, provided?: string | null) {
  const candidate = safe(provided, 160).toLowerCase();
  if (candidate && candidate !== "application/octet-stream") return candidate;
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".txt") || lower.endsWith(".md") || lower.endsWith(".rtf")) return "text/plain";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return candidate;
}

function decodeBase64(value: string) {
  const normalized = value.includes(",") ? value.split(",").pop() ?? "" : value;
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function encodeBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, Math.min(index + chunkSize, bytes.length)));
  }
  return btoa(binary);
}

function normalizeDraft(raw: any, filename: string) {
  const sections: any[] = [];
  const fields: any[] = [];
  const seenFieldIds = new Set<string>();
  const slug = (value: string, fallback: string) => value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 56) || fallback;

  const rawSections = Array.isArray(raw?.sections) ? raw.sections : [];
  rawSections.slice(0, 30).forEach((sectionValue: unknown, sectionIndex: number) => {
    const sectionRaw = objectValue(sectionValue);
    const sectionTitle = safe(sectionRaw.title, 180) || `Section ${sectionIndex + 1}`;
    const description = safe(sectionRaw.description, 800) || null;
    const sectionId = slug(safe(sectionRaw.id, 100) || sectionTitle, `section_${sectionIndex + 1}`);
    const sectionFields: any[] = [];
    const rawFields = Array.isArray(sectionRaw.fields) ? sectionRaw.fields : [];
    rawFields.slice(0, 80).forEach((fieldValue: unknown, fieldIndex: number) => {
      const fieldRaw = objectValue(fieldValue);
      const label = safe(fieldRaw.label, 240);
      if (!label) return;
      const candidate = safe(fieldRaw.type, 40).toLowerCase();
      const type = SUPPORTED_TYPES.has(candidate) ? candidate : "long_text";
      let id = slug(safe(fieldRaw.id, 120) || label, `field_${sectionIndex + 1}_${fieldIndex + 1}`);
      const base = id;
      let suffix = 2;
      while (seenFieldIds.has(id)) id = `${base}_${suffix++}`.slice(0, 64);
      seenFieldIds.add(id);
      const options = Array.isArray(fieldRaw.options)
        ? fieldRaw.options.map((item: unknown) => safe(item, 180)).filter(Boolean).slice(0, 40)
        : [];
      const field = {
        id,
        section_id: sectionId,
        label,
        type,
        required: fieldRaw.required === true,
        help: safe(fieldRaw.help, 500) || null,
        options: type === "choice" ? options : [],
      };
      sectionFields.push(field);
      fields.push(field);
    });
    if (sectionFields.length > 0 || description) sections.push({ id: sectionId, title: sectionTitle, description, fields: sectionFields });
  });

  return {
    title: safe(raw?.title, 180) || filename.replace(/\.[^.]+$/, "") || "Imported report",
    category: safe(raw?.category, 80) || "CUSTOM",
    description: safe(raw?.description, 1000) || null,
    instructions: safe(raw?.instructions, 2400) || null,
    sections,
    fields,
    warnings: Array.isArray(raw?.warnings) ? raw.warnings.map((item: unknown) => safe(item, 500)).filter(Boolean).slice(0, 12) : [],
    confidence: Math.max(0, Math.min(1, Number(raw?.confidence ?? 0) || 0)),
  };
}

const responseJsonSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    category: { type: "string" },
    description: { type: ["string", "null"] },
    instructions: { type: ["string", "null"] },
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          description: { type: ["string", "null"] },
          fields: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" }, label: { type: "string" },
                type: { type: "string", enum: ["short_text", "long_text", "number", "date", "yes_no", "choice"] },
                required: { type: "boolean" }, help: { type: ["string", "null"] },
                options: { type: "array", items: { type: "string" } },
              },
              required: ["id", "label", "type", "required", "options"],
            },
          },
        },
        required: ["id", "title", "fields"],
      },
    },
    warnings: { type: "array", items: { type: "string" } },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["title", "category", "sections", "warnings", "confidence"],
};

type ParsedUpload = { scopeId: string; filename: string; mimeType: string; reportKindHint: string; bytes: Uint8Array };
async function parseUpload(req: Request): Promise<ParsedUpload> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.toLowerCase().includes("multipart/form-data")) {
    const form = await req.formData();
    const fileValue = form.get("file");
    if (!(fileValue instanceof File)) throw new Error("A reporting layout file is required.");
    const filename = safe(form.get("filename"), 240) || safe(fileValue.name, 240) || "report-layout";
    return {
      scopeId: safe(form.get("scope_id"), 80),
      filename,
      mimeType: inferMimeType(filename, safe(form.get("mime_type"), 160) || fileValue.type),
      reportKindHint: safe(form.get("report_kind_hint"), 3000),
      bytes: new Uint8Array(await fileValue.arrayBuffer()),
    };
  }
  const body = await req.json();
  const filename = safe(body?.filename, 240) || "report-layout";
  const base64 = safe(body?.base64, 24_000_000);
  if (!base64) throw new Error("A reporting layout file is required.");
  return {
    scopeId: safe(body?.scope_id, 80), filename,
    mimeType: inferMimeType(filename, body?.mime_type),
    reportKindHint: safe(body?.report_kind_hint, 3000), bytes: decodeBase64(base64),
  };
}

type AuditArgs = { requestId: string; scopeId: string; userId: string; action: string; filename: string; mimeType: string; stage?: string; message?: string; details?: Record<string, unknown> };
async function writeAudit(admin: any, args: AuditArgs) {
  const { error } = await admin.from("buklod_report_audit_log").insert({
    scope_id: args.scopeId, actor_user_id: args.userId, action: args.action,
    target_type: "REPORT_TEMPLATE_ANALYSIS", target_id: args.requestId,
    details: { analyzer_version: ANALYZER_VERSION, filename: args.filename, mime_type: args.mimeType, stage: args.stage ?? null, message: args.message?.slice(0, 700) ?? null, ...(args.details ?? {}) },
  });
  if (error) console.warn("[BUKLOD_REPORT_TEMPLATE_AUDIT]", cleanError(error));
}

async function storeSource(admin: any, scopeId: string, userId: string, filename: string, mimeType: string, bytes: Uint8Array) {
  const storageName = filename.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-180) || "report-layout";
  const path = `${scopeId}/${userId}/${crypto.randomUUID()}-${storageName}`;
  const { error } = await admin.storage.from("buklod-report-template-files").upload(path, bytes, { contentType: mimeType || "application/octet-stream", upsert: false });
  if (error) throw new Error(`The form was analyzed but the source file could not be stored: ${error.message}`);
  return { bucket: "buklod-report-template-files", path, name: filename, mime_type: mimeType, size_bytes: bytes.byteLength, uploaded_by: userId, uploaded_at: new Date().toISOString() };
}

function extractSourceText(bytes: Uint8Array, filename: string, mimeType: string) {
  const lower = filename.toLowerCase();
  if (/\.(xlsx|xls|csv)$/.test(lower) || /spreadsheet|excel|csv/i.test(mimeType)) {
    const workbook = lower.endsWith(".csv") || /csv/i.test(mimeType)
      ? XLSX.read(new TextDecoder().decode(bytes), { type: "string" })
      : XLSX.read(bytes, { type: "array" });
    const parts: string[] = [];
    for (const sheetName of workbook.SheetNames.slice(0, 20)) {
      parts.push(`SHEET: ${sheetName}`);
      const sheet = workbook.Sheets[sheetName];
      const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" }) as unknown[][];
      for (const row of matrix.slice(0, 250)) parts.push(row.slice(0, 60).map((cell) => safe(cell, 500)).join("\t"));
    }
    return parts.join("\n").slice(0, MAX_SOURCE_TEXT);
  }
  if (mimeType.startsWith("text/") || /\.(txt|md|rtf|json|xml)$/i.test(lower)) return new TextDecoder().decode(bytes).slice(0, MAX_SOURCE_TEXT);
  return "";
}

function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function modelCandidates() {
  return Array.from(new Set(["gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash", Deno.env.get("GEMINI_REPORT_IMPORT_MODEL") ?? "", "gemini-3.8-flash"].map((value) => value.trim()).filter(Boolean)));
}

type GeminiAttempt = { model: string; status: number | null; error: string | null };
async function callGeminiWithFallback(geminiKey: string, parts: any[], audit: (attempt: GeminiAttempt & { attempt: number }) => Promise<void>) {
  const startedAt = Date.now();
  const attempts: GeminiAttempt[] = [];
  let attemptCount = 0;
  let lastMessage = "AI analysis failed.";
  for (const model of modelCandidates()) {
    if (attemptCount >= AI_MAX_ATTEMPTS) break;
    const remaining = AI_TOTAL_TIMEOUT_MS - (Date.now() - startedAt);
    if (remaining <= 1500) break;
    attemptCount += 1;
    const controller = new AbortController();
    const timeoutMs = Math.max(1000, Math.min(AI_ATTEMPT_TIMEOUT_MS, remaining));
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": geminiKey, "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { responseMimeType: "application/json", responseJsonSchema, maxOutputTokens: 9000 } }),
      });
      const rawResponse = await response.text();
      if (response.ok) {
        const success = { model, status: response.status, error: null };
        attempts.push(success);
        await audit({ ...success, attempt: attemptCount });
        return { model, rawResponse, attempts };
      }
      const errorText = rawResponse.slice(0, 700);
      const failure = { model, status: response.status, error: errorText };
      attempts.push(failure);
      lastMessage = `${model} failed (${response.status}): ${errorText}`;
      await audit({ ...failure, attempt: attemptCount });
      if (!TRANSIENT_STATUSES.has(response.status)) break;
    } catch (error) {
      const failure = controller.signal.aborted
        ? { model, status: 408, error: `${model} timed out after ${Math.round(timeoutMs / 1000)} seconds.` }
        : { model, status: null, error: cleanError(error) };
      attempts.push(failure);
      lastMessage = failure.error ?? lastMessage;
      await audit({ ...failure, attempt: attemptCount });
    } finally {
      clearTimeout(timeout);
    }
    if (Date.now() - startedAt + 200 < AI_TOTAL_TIMEOUT_MS) await sleep(200);
  }
  throw new Error(`The AI form analyzer is temporarily unavailable. Last error: ${lastMessage.slice(0, 500)}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST required." }, 405);

  const requestId = crypto.randomUUID();
  let stage = "request";
  let admin: any = null;
  let userId = "";
  let scopeId = "";
  let filename = "report-layout";
  let mimeType = "";

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const geminiKey = Deno.env.get("GEMINI_API_KEY") ?? "";
    if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: "Report import service is not configured.", stage: "configuration", request_id: requestId }, 500);

    stage = "authentication";
    const authorization = req.headers.get("Authorization") ?? "";
    if (!authorization.toLowerCase().startsWith("bearer ")) return json({ error: "Authentication required.", stage, request_id: requestId }, 401);
    const token = authorization.replace(/^Bearer\s+/i, "").trim();
    admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) return json({ error: "Invalid or expired session.", stage, request_id: requestId }, 401);
    userId = user.id;

    stage = "request-body";
    const upload = await parseUpload(req);
    scopeId = upload.scopeId;
    filename = upload.filename;
    mimeType = upload.mimeType;
    if (!scopeId) return json({ error: "scope_id is required.", stage, request_id: requestId }, 400);
    if (!mimeType) return json({ error: "Unsupported reporting form type.", stage, request_id: requestId }, 400);
    if (upload.bytes.byteLength < 1) return json({ error: "The uploaded file is empty.", stage, request_id: requestId }, 400);
    if (upload.bytes.byteLength > MAX_BYTES) return json({ error: "Reporting layout files are limited to 12 MB.", stage, request_id: requestId }, 413);

    stage = "scope-access";
    const [{ data: scope, error: scopeError }, { data: isAdmin, error: adminError }] = await Promise.all([
      caller.from("buklod_scopes").select("id,name,scope_type,status").eq("id", scopeId).maybeSingle(),
      caller.rpc("buklod_is_exact_scope_admin_v1", { p_scope_id: scopeId }),
    ]);
    if (scopeError || !scope) return json({ error: "Report scope was not found.", stage, request_id: requestId }, 404);
    if (!["ORGANIZATION", "CLUSTER"].includes(String(scope.scope_type).toUpperCase())) return json({ error: "BUKLOD Report templates are available only for Organization or Cluster scopes.", stage, request_id: requestId }, 400);
    if (adminError || isAdmin !== true) return json({ error: "Exact-scope admin access is required.", stage, request_id: requestId }, 403);

    await writeAudit(admin, { requestId, scopeId, userId, action: "REPORT_TEMPLATE_FILE_ANALYZE_STARTED", filename, mimeType, stage, details: { size_bytes: upload.bytes.byteLength } });

    const isDocx = mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || filename.toLowerCase().endsWith(".docx");
    if (isDocx) {
      stage = "docx-structure";
      const draft = await buildDocxStructureDraft(upload.bytes, filename);
      if (draft.fields.length > 0) {
        const sourceFile = await storeSource(admin, scopeId, userId, filename, mimeType, upload.bytes);
        await writeAudit(admin, {
          requestId, scopeId, userId, action: "REPORT_TEMPLATE_DOCX_STRUCTURE_USED", filename, mimeType, stage,
          details: { field_count: draft.fields.length, section_count: draft.sections.length, confidence: draft.confidence, source_path: sourceFile.path },
        });
        return json({ ok: true, request_id: requestId, provider: "docx-structure", model: null, scope: { id: scope.id, name: scope.name, scope_type: scope.scope_type }, source_file: sourceFile, draft });
      }
    }

    if (!geminiKey) return json({ error: "No reliable fillable fields were found locally and AI fallback is not configured.", stage: "ai-configuration", request_id: requestId }, 500);

    stage = "ai-analysis";
    const prompt = [
      "You are BUKLOD Report Form Analyzer.",
      "STRICT FILLABLE-FIELD RULE: create an input field ONLY when the original document visibly expects the reporter to enter, write, select, check, choose, sign, date, or supply a value.",
      "Do NOT convert titles, headings, instructions, notes, examples, fixed values, table headers, or ordinary labels into fields.",
      "When uncertain, prefer STATIC text and omit the field.",
      "Preserve source order and section grouping. Never invent generic fallback fields.",
      "Allowed field types: short_text, long_text, number, date, yes_no, choice.",
      `Scope: ${scope.name}`,
      upload.reportKindHint ? `Administrator hint: ${upload.reportKindHint}` : "",
      `File: ${filename}`,
    ].filter(Boolean).join("\n");
    const parts: any[] = [{ text: prompt }];
    const sourceText = extractSourceText(upload.bytes, filename, mimeType);
    if (sourceText) parts.push({ text: `SOURCE TEXT:\n${sourceText}` });
    if (isDocx) {
      const localDraft = await buildDocxStructureDraft(upload.bytes, filename);
      parts.push({ text: `LOCAL DOCX STRUCTURE (may contain zero fields):\n${JSON.stringify(localDraft).slice(0, 30000)}` });
    }
    if (mimeType === "application/pdf" || mimeType.startsWith("image/")) parts.push({ inline_data: { mime_type: mimeType, data: encodeBase64(upload.bytes) } });

    const ai = await callGeminiWithFallback(geminiKey, parts, async (attempt) => {
      await writeAudit(admin, { requestId, scopeId, userId, action: "REPORT_TEMPLATE_AI_ATTEMPT", filename, mimeType, stage, message: attempt.error ?? undefined, details: { model: attempt.model, status: attempt.status, attempt: attempt.attempt, success: attempt.error == null } });
    });
    const outer = JSON.parse(ai.rawResponse);
    const outputText = (outer?.candidates?.[0]?.content?.parts ?? []).map((part: any) => typeof part?.text === "string" ? part.text : "").join("").trim();
    if (!outputText) throw new Error("No structured form draft was returned.");
    const draft = normalizeDraft(JSON.parse(outputText), filename);
    const sourceFile = await storeSource(admin, scopeId, userId, filename, mimeType, upload.bytes);
    await writeAudit(admin, { requestId, scopeId, userId, action: "REPORT_TEMPLATE_FILE_ANALYZED", filename, mimeType, stage, details: { field_count: draft.fields.length, section_count: draft.sections.length, confidence: draft.confidence, source_path: sourceFile.path, model: ai.model, attempts: ai.attempts.map((item) => ({ model: item.model, status: item.status })) } });
    return json({ ok: true, request_id: requestId, provider: "gemini", model: ai.model, scope: { id: scope.id, name: scope.name, scope_type: scope.scope_type }, source_file: sourceFile, draft });
  } catch (error) {
    const message = cleanError(error);
    console.error("[BUKLOD_REPORT_TEMPLATE_IMPORT]", ANALYZER_VERSION, stage, requestId, message);
    if (admin && scopeId && userId) await writeAudit(admin, { requestId, scopeId, userId, action: "REPORT_TEMPLATE_FILE_ANALYZE_FAILED", filename, mimeType, stage, message });
    return json({ error: message, stage, request_id: requestId }, 500);
  }
});
