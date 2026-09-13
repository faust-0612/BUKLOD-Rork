import JSZip from "npm:jszip@3.10.1";

const SUPPORTED_TYPES = new Set(["short_text", "long_text", "number", "date", "yes_no", "choice"]);

const safe = (value: unknown, max = 4000) => String(value ?? "").trim().slice(0, max);

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function xmlText(fragment: string) {
  const pieces: string[] = [];
  for (const match of fragment.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)) {
    pieces.push(decodeXml(match[1] ?? ""));
  }
  return pieces.join("").replace(/\s+/g, " ").trim();
}

function slug(value: string, fallback: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 56) || fallback;
}

function inferType(label: string) {
  const lower = label.toLowerCase();
  if (/\bdate\b|petsa|araw/.test(lower)) return "date";
  if (/\b(number|no\.?|count|total|hours?|minutes?|qty|quantity|attendance count)\b/.test(lower)) return "number";
  if (/\b(yes\/?no|yes or no|oo\/?hindi)\b/.test(lower)) return "yes_no";
  if (/remark|comment|reason|explanation|description|concern|challenge|issue|problem|action|recommendation|accomplishment|narrative|observation|notes?/.test(lower)) return "long_text";
  return "short_text";
}

function blankMarkerIndex(text: string) {
  const patterns = [/{[^}]{0,20}}/, /_{3,}/, /\.{4,}/, /…{2,}/, /\[\s*\]/, /\(\s*\)/, /☐|□/];
  let best = -1;
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.index != null && (best < 0 || match.index < best)) best = match.index;
  }
  return best;
}

function labelBeforeBlank(text: string) {
  const index = blankMarkerIndex(text);
  if (index < 0) return "";
  const before = text.slice(0, index).replace(/[:\-–—\s]+$/g, "").trim();
  if (!before || before.length > 220) return "";
  return before;
}

function explicitColonBlank(text: string) {
  const colon = text.indexOf(":");
  if (colon <= 0) return "";
  const label = text.slice(0, colon).trim();
  const after = text.slice(colon + 1).trim();
  if (!label || label.length > 220) return "";
  if (!after || blankMarkerIndex(after) >= 0) return label;
  return "";
}

function looksLikeHeading(text: string, paragraphXml: string) {
  const style = paragraphXml.match(/<w:pStyle[^>]*w:val="([^"]+)"/i)?.[1] ?? "";
  if (/heading|title/i.test(style)) return true;
  if (text.length > 4 && text.length <= 100 && /[A-Z]/.test(text) && text === text.toUpperCase()) return true;
  return false;
}

function addField(fields: any[], sectionFields: any[], seen: Set<string>, sectionId: string, label: string, indexSeed: string, help?: string | null) {
  const cleanLabel = safe(label, 240);
  if (!cleanLabel) return;
  let id = slug(cleanLabel, `field_${indexSeed}`);
  const base = id;
  let suffix = 2;
  while (seen.has(id)) id = `${base}_${suffix++}`.slice(0, 64);
  seen.add(id);
  const type = inferType(cleanLabel);
  const field = {
    id,
    section_id: sectionId,
    label: cleanLabel,
    type: SUPPORTED_TYPES.has(type) ? type : "short_text",
    required: false,
    help: help ?? null,
    options: [],
  };
  fields.push(field);
  sectionFields.push(field);
}

function tableRows(tableXml: string) {
  return Array.from(tableXml.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)).map((rowMatch) => {
    const rowXml = rowMatch[0];
    return Array.from(rowXml.matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)).map((cellMatch) => ({
      xml: cellMatch[0],
      text: xmlText(cellMatch[0]),
    }));
  });
}

function chooseHeaderRow(rows: Array<Array<{ text: string }>>) {
  let bestIndex = -1;
  let bestScore = -1;
  for (let i = 0; i < Math.min(rows.length, 5); i += 1) {
    const texts = rows[i].map((cell) => cell.text.trim());
    const nonEmpty = texts.filter(Boolean).length;
    if (nonEmpty < 2) continue;
    const shortish = texts.filter((text) => text.length <= 80).length;
    const score = nonEmpty * 3 + shortish;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  return bestIndex;
}

export async function buildDocxStructureDraft(bytes: Uint8Array, filename: string) {
  const zip = await JSZip.loadAsync(bytes);
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) throw new Error("DOCX document.xml was not found.");

  const title = filename.replace(/\.[^.]+$/, "") || "Imported Word form";
  const sections: any[] = [];
  const fields: any[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  const staticLines: string[] = [];
  let currentHeading = "General information";

  const bodyWithoutTables = xml.replace(/<w:tbl\b[\s\S]*?<\/w:tbl>/g, " ");
  const paragraphFields: any[] = [];
  const paragraphSectionId = "general_information";

  let paragraphIndex = 0;
  for (const paragraphMatch of bodyWithoutTables.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)) {
    paragraphIndex += 1;
    const paragraphXml = paragraphMatch[0];
    const text = xmlText(paragraphXml);
    if (!text) continue;
    if (looksLikeHeading(text, paragraphXml)) {
      currentHeading = text;
      staticLines.push(text);
      continue;
    }

    const label = explicitColonBlank(text) || labelBeforeBlank(text);
    if (label) {
      addField(fields, paragraphFields, seen, paragraphSectionId, label, `p_${paragraphIndex}`, currentHeading !== "General information" ? `Under: ${currentHeading}` : null);
      continue;
    }

    staticLines.push(text);
  }

  if (paragraphFields.length > 0) {
    sections.push({
      id: paragraphSectionId,
      title: "General information",
      description: staticLines.slice(0, 8).join("\n").slice(0, 1400) || null,
      fields: paragraphFields,
    });
  }

  let tableIndex = 0;
  for (const tableMatch of xml.matchAll(/<w:tbl\b[\s\S]*?<\/w:tbl>/g)) {
    tableIndex += 1;
    const rows = tableRows(tableMatch[0]);
    if (!rows.length) continue;

    const sectionId = `table_${tableIndex}`;
    const sectionFields: any[] = [];
    const headerIndex = chooseHeaderRow(rows);
    const preHeaderText = headerIndex > 0
      ? rows.slice(0, headerIndex).flat().map((cell) => cell.text).filter(Boolean).join(" · ")
      : "";
    const headers = headerIndex >= 0 ? rows[headerIndex].map((cell, index) => cell.text || `Column ${index + 1}`) : [];
    const dataRows = headerIndex >= 0 ? rows.slice(headerIndex + 1) : rows;

    if (headerIndex >= 0 && dataRows.length > 0) {
      const fullyBlankRows = dataRows.filter((row) => row.every((cell) => !cell.text.trim()));
      const mixedRows = dataRows.filter((row) => row.some((cell) => cell.text.trim()) && row.some((cell) => !cell.text.trim()));

      if (fullyBlankRows.length > 0 && mixedRows.length === 0) {
        headers.forEach((header, columnIndex) => {
          const cleanHeader = safe(header, 180);
          if (!cleanHeader || /^column \d+$/i.test(cleanHeader)) return;
          addField(
            fields,
            sectionFields,
            seen,
            sectionId,
            cleanHeader,
            `t${tableIndex}_c${columnIndex + 1}`,
            "Fillable column from a repeatable table in the uploaded Word form. Enter the applicable value(s) for this report."
          );
        });
      } else {
        dataRows.forEach((row, rowIndex) => {
          const rowContextParts = row.map((cell, index) => ({ text: cell.text.trim(), index })).filter((item) => item.text);
          const rowContext = rowContextParts.slice(0, 2).map((item) => item.text).join(" / ");
          row.forEach((cell, columnIndex) => {
            if (cell.text.trim()) {
              const inlineLabel = explicitColonBlank(cell.text) || labelBeforeBlank(cell.text);
              if (inlineLabel) {
                addField(fields, sectionFields, seen, sectionId, inlineLabel, `t${tableIndex}_r${rowIndex + 1}_c${columnIndex + 1}`);
              }
              return;
            }
            const header = safe(headers[columnIndex], 160);
            if (!header || /^column \d+$/i.test(header)) return;
            const label = rowContext ? `${header} — ${rowContext}` : header;
            addField(fields, sectionFields, seen, sectionId, label, `t${tableIndex}_r${rowIndex + 1}_c${columnIndex + 1}`);
          });
        });
      }
    } else {
      rows.forEach((row, rowIndex) => {
        row.forEach((cell, columnIndex) => {
          const inlineLabel = explicitColonBlank(cell.text) || labelBeforeBlank(cell.text);
          if (inlineLabel) addField(fields, sectionFields, seen, sectionId, inlineLabel, `t${tableIndex}_r${rowIndex + 1}_c${columnIndex + 1}`);
        });
      });
    }

    if (sectionFields.length > 0) {
      const headerSummary = headers.filter(Boolean).join(" | ").slice(0, 900);
      sections.push({
        id: sectionId,
        title: preHeaderText.slice(0, 180) || `Table ${tableIndex}`,
        description: headerSummary ? `Original table columns: ${headerSummary}` : null,
        fields: sectionFields,
      });
    }
  }

  if (fields.length === 0) {
    warnings.push("No reliable fillable Word fields were found from blanks, placeholders, or table input areas. AI fallback may be needed.");
  } else {
    warnings.push("Generated directly from the Word document structure without AI. Only visible fill-in areas and fillable table cells/columns were converted to fields.");
  }

  return {
    title,
    category: "CUSTOM",
    description: "Imported from the original Word reporting form.",
    instructions: staticLines.slice(0, 12).join("\n").slice(0, 2400) || null,
    sections,
    fields,
    warnings,
    confidence: fields.length > 0 ? 0.82 : 0.25,
  };
}
