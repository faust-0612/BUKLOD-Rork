import { createClient } from "npm:@supabase/supabase-js@2.112.2";
import * as XLSX from "npm:xlsx@0.18.5";
import JSZip from "npm:jszip@3.10.1";
import { extractText, getDocumentProxy } from "npm:unpdf@0.12.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_ROWS = 500;
const AUTO_SCORE = 0.90;
const AUTO_MARGIN = 0.10;
const REVIEW_SCORE = 0.70;

type ImportedRow = { original_name: string; source_username: string; ordinal: number };
type Person = { id: string; username: string; display_name: string };

const norm = (value: string) => value
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9 ]+/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const headerKey = (value: unknown) => norm(String(value ?? "")).replace(/ /g, "");
const blockedLine = /(?:^|\b)(?:total|average|grade|score|section|student\s*id|subject|course|teacher|faculty|remarks?|attendance|signature|date)(?:\b|$)/i;
const usernamePattern = /@([a-zA-Z0-9._-]{2,80})/;

function tokenSignature(value: string) {
  return Array.from(new Set(norm(value).split(" ").filter(token => token.length > 1 && !["jr", "sr", "ii", "iii", "iv"].includes(token))))
    .sort()
    .join(" ");
}

function significantTokenCount(value: string) {
  return tokenSignature(value).split(" ").filter(Boolean).length;
}

function damerauDistance(a: string, b: string) {
  const n = a.length;
  const m = b.length;
  const d = Array.from({ length: n + 1 }, () => Array<number>(m + 1).fill(0));
  for (let i = 0; i <= n; i += 1) d[i][0] = i;
  for (let j = 0; j <= m; j += 1) d[0][j] = j;
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[n][m];
}

function similarity(left: string, right: string) {
  const a = norm(left);
  const b = norm(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const sa = tokenSignature(a);
  const sb = tokenSignature(b);
  if (sa && sa === sb) return 0.99;
  const compactA = a.replace(/ /g, "");
  const compactB = b.replace(/ /g, "");
  const maxLength = Math.max(compactA.length, compactB.length, 1);
  return Math.max(0, 1 - damerauDistance(compactA, compactB) / maxLength);
}

function cleanName(value: string) {
  let candidate = String(value ?? "")
    .replace(/^\s*\d+[.)-]?\s*/, "")
    .replace(usernamePattern, " ")
    .replace(/\s+(?:\d{1,3}|[A-F][+-]?)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!candidate || candidate.length < 3 || candidate.length > 120) return "";
  if (blockedLine.test(candidate) || /https?:|www\.|\S+@\S+\.\S+/i.test(candidate)) return "";
  if (!/[A-Za-zÀ-ÿ]{2}/.test(candidate)) return "";
  if (candidate.split(/\s+/).length > 8) return "";
  candidate = candidate.replace(/^[|;,\-\s]+|[|;\-\s]+$/g, "").trim();
  return candidate;
}

function rowFromLine(raw: string, ordinal: number): ImportedRow | null {
  const line = raw.trim();
  if (!line) return null;
  const username = line.match(usernamePattern)?.[1]?.toLowerCase() ?? "";
  const withoutUsername = line.replace(usernamePattern, " ").trim();
  const pieces = withoutUsername.split(/[\t|;]/).map(part => cleanName(part)).filter(Boolean);
  const name = cleanName(pieces[0] || withoutUsername);
  if (!name) return null;
  return { original_name: name, source_username: username, ordinal };
}

function dedupeAndSort(rows: ImportedRow[]) {
  const unique = new Map<string, ImportedRow>();
  for (const row of rows) {
    const key = `${norm(row.original_name)}|${row.source_username}`;
    if (!unique.has(key)) unique.set(key, row);
  }
  return Array.from(unique.values())
    .sort((a, b) => a.original_name.localeCompare(b.original_name, undefined, { sensitivity: "base" }))
    .slice(0, MAX_ROWS)
    .map((row, index) => ({ ...row, ordinal: index + 1 }));
}

function matrixToRows(matrix: unknown[][], startOrdinal = 0) {
  if (!matrix.length) return [] as ImportedRow[];
  const fullHeaders = new Set(["studentname", "fullname", "name", "learnername", "student", "learner"]);
  const firstHeaders = new Set(["firstname", "givenname", "given"]);
  const middleHeaders = new Set(["middlename", "middle", "mi", "middleinitial"]);
  const lastHeaders = new Set(["lastname", "surname", "familyname"]);
  const userHeaders = new Set(["username", "buklodusername", "studentusername", "user"]);

  let headerRow = -1;
  let full = -1;
  let first = -1;
  let middle = -1;
  let last = -1;
  let username = -1;
  for (let r = 0; r < Math.min(matrix.length, 15); r += 1) {
    const keys = (matrix[r] ?? []).map(headerKey);
    const f = keys.findIndex(key => fullHeaders.has(key));
    const fi = keys.findIndex(key => firstHeaders.has(key));
    const mi = keys.findIndex(key => middleHeaders.has(key));
    const la = keys.findIndex(key => lastHeaders.has(key));
    const us = keys.findIndex(key => userHeaders.has(key));
    if (f >= 0 || fi >= 0 || la >= 0 || us >= 0) {
      headerRow = r; full = f; first = fi; middle = mi; last = la; username = us; break;
    }
  }

  const out: ImportedRow[] = [];
  if (headerRow >= 0) {
    for (let r = headerRow + 1; r < matrix.length; r += 1) {
      const row = matrix[r] ?? [];
      const sourceUsername = username >= 0 ? String(row[username] ?? "").trim().replace(/^@/, "").toLowerCase() : "";
      const sourceName = full >= 0
        ? String(row[full] ?? "")
        : [first >= 0 ? row[first] : "", middle >= 0 ? row[middle] : "", last >= 0 ? row[last] : ""].filter(Boolean).join(" ");
      const name = cleanName(sourceName);
      if (name) out.push({ original_name: name, source_username: sourceUsername, ordinal: startOrdinal + r + 1 });
    }
    return out;
  }

  for (let r = 0; r < matrix.length; r += 1) {
    const cells = (matrix[r] ?? []).map(value => String(value ?? "").trim()).filter(Boolean);
    if (!cells.length) continue;
    const explicitUsername = cells.find(cell => usernamePattern.test(cell))?.match(usernamePattern)?.[1]?.toLowerCase() ?? "";
    const probable = cells.map(cleanName).filter(Boolean);
    if (!probable.length) continue;
    const joinable = probable.slice(0, 3).filter(value => !/\d/.test(value));
    const sourceName = joinable.length >= 2 && joinable.every(value => value.split(/\s+/).length <= 3)
      ? joinable.join(" ")
      : probable[0];
    const name = cleanName(sourceName);
    if (name) out.push({ original_name: name, source_username: explicitUsername, ordinal: startOrdinal + r + 1 });
  }
  return out;
}

function textToRows(text: string) {
  const out: ImportedRow[] = [];
  text.split(/\r?\n/).forEach((line, index) => {
    const row = rowFromLine(line, index + 1);
    if (row) out.push(row);
  });
  return out;
}

function legacyDocText(bytes: Uint8Array) {
  const chunks: string[] = [];
  let ascii = "";
  for (const byte of bytes) {
    if (byte >= 32 && byte <= 126) ascii += String.fromCharCode(byte);
    else { if (ascii.length >= 4) chunks.push(ascii); ascii = ""; }
  }
  if (ascii.length >= 4) chunks.push(ascii);
  let utf16 = "";
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const code = bytes[i] | (bytes[i + 1] << 8);
    if (code >= 32 && code <= 0x7e) utf16 += String.fromCharCode(code);
    else { if (utf16.length >= 4) chunks.push(utf16); utf16 = ""; }
  }
  if (utf16.length >= 4) chunks.push(utf16);
  return chunks.join("\n");
}

async function extractRows(bytes: Uint8Array, name: string, mime: string) {
  const lower = name.toLowerCase();
  if (/\.(xlsx|xls|csv)$/.test(lower) || /spreadsheet|excel|csv/i.test(mime)) {
    const workbook = lower.endsWith(".csv") || /csv/i.test(mime)
      ? XLSX.read(new TextDecoder().decode(bytes), { type: "string" })
      : XLSX.read(bytes, { type: "array" });
    const rows: ImportedRow[] = [];
    let offset = 0;
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" }) as unknown[][];
      rows.push(...matrixToRows(matrix, offset));
      offset += matrix.length;
    }
    return dedupeAndSort(rows);
  }
  if (lower.endsWith(".docx") || /officedocument\.wordprocessingml/i.test(mime)) {
    const zip = await JSZip.loadAsync(bytes);
    const xml = await zip.file("word/document.xml")?.async("string");
    if (!xml) throw new Error("DOCX text could not be extracted.");
    const text = xml.replace(/<w:tab\/>/g, "\t").replace(/<\/w:p>/g, "\n").replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    return dedupeAndSort(textToRows(text));
  }
  if (lower.endsWith(".doc") || mime === "application/msword") {
    return dedupeAndSort(textToRows(legacyDocText(bytes)));
  }
  if (lower.endsWith(".pdf") || mime === "application/pdf") {
    const pdf = await getDocumentProxy(bytes);
    const result: any = await extractText(pdf, { mergePages: true });
    const text = Array.isArray(result?.text) ? result.text.join("\n") : String(result?.text || "");
    return dedupeAndSort(textToRows(text));
  }
  return dedupeAndSort(textToRows(new TextDecoder().decode(bytes)));
}

async function loadProfiles(admin: ReturnType<typeof createClient>) {
  const people: Person[] = [];
  for (let start = 0; start < 50000; start += 1000) {
    const { data, error } = await admin.from("profiles")
      .select("id,username,full_name,first_name,middle_name,surname,suffix,is_active")
      .eq("is_active", true)
      .range(start, start + 999);
    if (error) throw error;
    const page = data ?? [];
    people.push(...page.map((p: any) => ({
      id: String(p.id),
      username: String(p.username || ""),
      display_name: String(p.full_name || [p.first_name, p.middle_name, p.surname, p.suffix].filter(Boolean).join(" ") || p.username || "BUKLOD User"),
    })));
    if (page.length < 1000) break;
  }
  return people;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authorization = req.headers.get("Authorization");
    if (!authorization) return json({ error: "Authentication required" }, 401);

    const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData.user;
    if (!user) return json({ error: "Invalid session" }, 401);

    const body = await req.json();
    const classroomId = String(body?.classroom_id || "");
    const bucket = String(body?.bucket || "buklod-classroom");
    const path = String(body?.path || "");
    const name = String(body?.name || "roster");
    const mime = String(body?.mime_type || "");
    if (!classroomId || !path) return json({ error: "classroom_id and path required" }, 400);

    const expectedPrefix = `${classroomId}/${user.id}/roster-import/`;
    if (bucket !== "buklod-classroom" || !path.startsWith(expectedPrefix)) {
      return json({ error: "Roster import path is invalid." }, 400);
    }

    const { data: canManage, error: manageError } = await userClient.rpc("buklod_education_faculty_can_manage_classroom_v3", { p_classroom_id: classroomId });
    if (manageError || canManage !== true) return json({ error: "Faculty access required" }, 403);

    const { data: file, error: fileError } = await admin.storage.from(bucket).download(path);
    if (fileError || !file) return json({ error: fileError?.message || "Roster file unavailable" }, 400);

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (bytes.byteLength > MAX_BYTES) return json({ error: "Roster parser limit is 20 MB" }, 413);
      const imported = await extractRows(bytes, name, mime);
      if (!imported.length) {
        return json({ rows: [], warning: "No probable student names were found. Review the source file or use manual enrollment." });
      }

      const people = await loadProfiles(admin);
      const rows = imported.map(row => {
        const exactUsername = row.source_username
          ? people.filter(person => person.username.toLowerCase() === row.source_username.toLowerCase())
          : [];
        const ranked = people.map(person => ({
          ...person,
          confidence: row.source_username && person.username.toLowerCase() === row.source_username.toLowerCase()
            ? 1
            : similarity(row.original_name, person.display_name),
        })).filter(person => person.confidence >= 0.35)
          .sort((a, b) => b.confidence - a.confidence || a.display_name.localeCompare(b.display_name));
        const top = exactUsername.length === 1
          ? { ...exactUsername[0], confidence: 1 }
          : ranked[0];
        const second = ranked.find(candidate => candidate.id !== top?.id);
        const gap = top ? top.confidence - (second?.confidence ?? 0) : 0;
        const usernameAuto = exactUsername.length === 1;
        const nameAuto = !!top && significantTokenCount(row.original_name) >= 2 && top.confidence >= AUTO_SCORE && gap >= AUTO_MARGIN;
        const auto = usernameAuto || nameAuto;
        const needsReview = !!top && top.confidence >= REVIEW_SCORE && !auto;
        const method = usernameAuto ? "USERNAME_EXACT" : nameAuto ? "NAME_HIGH_CONFIDENCE" : needsReview ? "NAME_REVIEW" : "NO_MATCH";
        return {
          original_name: row.original_name,
          normalized_name: norm(row.original_name),
          source_username: row.source_username,
          ordinal: row.ordinal,
          candidate_user_id: top?.id ?? null,
          candidate_username: top?.username ?? null,
          match_score: top?.confidence ?? 0,
          second_score: second?.confidence ?? 0,
          match_method: method,
          auto_enroll: auto,
          suggestions: ranked.slice(0, 3).map(candidate => ({
            id: candidate.id,
            username: candidate.username,
            display_name: candidate.display_name,
            confidence: Number(candidate.confidence.toFixed(4)),
          })),
        };
      });

      const { data: persisted, error: persistError } = await admin.rpc("buklod_classroom_roster_import_service_v1", {
        p_faculty_id: user.id,
        p_classroom_id: classroomId,
        p_source_file_name: name,
        p_rows: rows,
      });
      if (persistError) throw persistError;
      return json({ rows, count: rows.length, result: persisted });
    } finally {
      await admin.storage.from(bucket).remove([path]).catch(() => undefined);
    }
  } catch (error) {
    console.error("buklod-classroom-roster-import", error);
    return json({ error: error instanceof Error ? error.message : "Roster import failed" }, 500);
  }
});
