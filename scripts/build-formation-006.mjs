/**
 * Build Implementation 006 SQL fragments from extracted formation sources.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const root = path.resolve(process.cwd());
const extractedDir = path.join(root, 'supabase/seed/formation/extracted');
const outDir = path.join(root, 'supabase/seed/formation/generated');

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function sqlEscapeLiteral(text) {
  return text.replace(/'/g, "''");
}

function dollarTag(content, base = 'buklod_l1') {
  let tag = base;
  let i = 0;
  while (content.includes(`$${tag}$`)) {
    i += 1;
    tag = `${base}_${i}`;
  }
  return tag;
}

function parseLeadershipLevel1(text) {
  const start = text.indexOf('LEVEL 1\n“PAGTATATAG NG MATIBAY NA PUNDASYON KAY CRISTO”');
  const end = text.indexOf('ARALIN 11\nPAGKATATAG NG PAMAMAHALA SA');
  if (start < 0 || end < 0) {
    throw new Error('Could not locate LEVEL 1 boundaries in advance-discipleship.txt');
  }
  const section = text.slice(start, end);
  const parts = section.split(/\n(?=ARALIN \d+\n)/);
  const lessons = new Map();
  for (const part of parts) {
    const m = part.match(/^ARALIN (\d+)\n([\s\S]*)$/);
    if (!m) continue;
    const num = Number(m[1]);
    const body = m[2].trim();
    if (!lessons.has(num) && body.length > 0) {
      lessons.set(num, body);
    }
  }
  return lessons;
}

function lessonTitle(body, fallback) {
  const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
  const idx = lines.findIndex((l) => /^ARALIN \d+$/.test(l));
  const titleParts = [];
  for (let i = idx + 1; i < lines.length && titleParts.length < 2; i += 1) {
    if (/^[IVX]+\.\s/.test(lines[i]) || /^Mateo|^Juan|^1 Corinto|^Filipos|^Efeso|^Hebreo|^Roma|^Santiago|^Colosas|^Lucas|^1 Timoteo|^1 Pedro|^Awit|^Isaias|^Jeremias|^Levitico|^Galacia|^1 Juan|^Marcos|^2 Cronica|^Daniel|^Exodo|^Nehemias|^2 Timoteo|^2 Pedro|^Pahayag|^Job|^Malakias|^Gawa|^2 Corinto|^1 Hari|^Josue|^TANONG|^REFLECTION|^HANDA|^MGA|^Ang |^Sa araling|^Ang pagiging|^Lahat ng|^Ang panalangin|^Ang iglesia|^Ang Diyos|^Ang Salita|^Ang kapangyarihan|^Ang pag-ibig|^Ang pagkakaisa|^Ang pagpapakumbaba|^Ang pagpapatawad|^Ang paglalakad|^Ang paglago|^Ang pagbabago|^Ang pagtatalaga|^Ang paglilingkod|^Ang paghahanda|^Ang pagpapala|^Ang pagpapahalaga|^Ang pagpapasalamat|^Ang pagpapakita|^Ang pagpapahayag|^Ang pagpapahalaga|^Ang pagpapahalaga|^Ang pagpapahalaga/.test(lines[i])) {
      break;
    }
    titleParts.push(lines[i]);
  }
  const title = titleParts.join(' ').replace(/\s+/g, ' ').trim();
  return title || fallback;
}

function buildLeadership1Sql(lessons) {
  const lines = [];
  lines.push('-- Generated Leadership 1 import (006)');
  for (let n = 1; n <= 10; n += 1) {
    const body = lessons.get(n);
    if (!body) {
      lines.push(`
-- ARALIN ${n}: SOURCE BODY MISSING IN PDF (numbering gap documented)
UPDATE public.learning_lessons l
SET
  title = 'Aralin ${n} — AWAITING SOURCE ARALIN ${n}',
  content = '',
  content_ready = false,
  source_document = 'advance-discipleship.pdf',
  content_provenance = coalesce(l.content_provenance, '{}'::jsonb) || jsonb_build_object(
    'import_status', 'AWAITING_SOURCE_BODY',
    'expected_aralin', ${n},
    'note', 'ARALIN 5 body absent between ARALIN 4 and ARALIN 6 in authoritative PDF'
  ),
  updated_at = now()
FROM public.learning_tracks t
WHERE l.track_id = t.id
  AND t.slug = 'buklod-105-leadership-1'
  AND l.lesson_number = ${n};
`);
      continue;
    }

    const title = lessonTitle(body, `Aralin ${n}`);
    const tag = dollarTag(body, `buklod_l1_${n}`);
    const fullContent = `ARALIN ${n}\n${body}`;
    lines.push(`
UPDATE public.learning_lessons l
SET
  title = '${sqlEscapeLiteral(title)}',
  content = $${tag}$${fullContent}$${tag}$,
  content_ready = true,
  source_document = 'advance-discipleship.pdf',
  source_page_start = NULL,
  source_page_end = NULL,
  content_hash = '${sha256(fullContent)}',
  content_provenance = coalesce(l.content_provenance, '{}'::jsonb) || jsonb_build_object(
    'source', 'Advance Discipleship',
    'source_document', 'advance-discipleship.pdf',
    'component_code', 'LEADERSHIP_1',
    'track_slug', 'buklod-105-leadership-1',
    'lesson_number', ${n},
    'imported_at', now()
  ),
  updated_at = now()
FROM public.learning_tracks t
WHERE l.track_id = t.id
  AND t.slug = 'buklod-105-leadership-1'
  AND l.lesson_number = ${n};
`);
  }
  return lines.join('\n');
}

function buildCovenantSql(kasunduanText) {
  const blocks = kasunduanText.split(/\n-- \d+ of \d+ --\n/).map((b) => b.trim()).filter(Boolean);
  const mapping = [
    ['BAPTISM', 'Certificate of Baptism'],
    ['MISSION_COVENANT', 'TIPANAN NG MISYON NG MZB MINISTRY'],
    ['LIFE_DEDICATION', 'KASUNDUAN SA PAGTATALAGA NG BUHAY'],
    ['PARTNERSHIP_COVENANT', 'KASUNDUAN NG PAGTUWANG'],
    ['SUPPORT_COVENANT', 'KASUNDUAN NG PAGSUPORTA'],
  ];

  const lines = ['-- Covenant template import (006)'];
  mapping.forEach(([code, marker], idx) => {
    const block = blocks[idx] ?? '';
    const normalized = block
      .replace(/_{3,}/g, '{{PLACEHOLDER}}')
      .replace(/_{2,}/g, '{{PLACEHOLDER}}')
      .replace(/\bLagda:\s*_{2,}/g, 'Lagda: {{MEMBER_NAME}}')
      .replace(/\bPetsa:\s*_{2,}/g, 'Petsa: {{DATE}}')
      .replace(/\bSaksi:\s*_{2,}/g, 'Saksi: {{WITNESS}}')
      .replace(/Given this _+ day of _+, _+ at\s*\n_{2,}/g, 'Given this {{DATE}} at {{LOCATION}}')
      .replace(/Signed:\s*\n_{2,}/g, 'Signed:\n{{AUTHORIZED_SIGNATORY}}')
      .replace(/Ako,\s*_{2,}/g, 'Ako, {{MEMBER_NAME}}')
      .replace(/Ako, si\s*_{2,}/g, 'Ako, si {{MEMBER_NAME}}')
      .replace(/simula sa\s*_{2,}/g, 'simula sa {{DATE}}')
      .replace(/on this day of\s*\n_{2,}, at\s*_{2,}\./g, 'on this day of {{DATE}}, at {{LOCATION}}.')
      .replace(/was baptized[^]*?on this day of\s*\n_{2,}, at\s*_{2,}\./g, (m) =>
        m.replace(/_{2,}/g, '{{PLACEHOLDER}}'),
      );

    if (!normalized.toUpperCase().includes(marker.toUpperCase().slice(0, 8))) {
      throw new Error(`Covenant block mismatch for ${code}`);
    }

    const tag = dollarTag(normalized, `cov_${code.toLowerCase()}`);
    lines.push(`
UPDATE public.buklod_formation_covenant_templates
SET
  source_document = 'mga-kasunduan.pdf',
  template_status = 'PUBLISHED',
  template_body = $${tag}$${normalized}$${tag}$,
  content_hash = '${sha256(normalized)}',
  published_at = now(),
  updated_at = now()
WHERE requirement_code = '${code}';
`);
  });
  return lines.join('\n');
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const advance = fs.readFileSync(path.join(extractedDir, 'advance-discipleship.txt'), 'utf8');
  const kasunduan = fs.readFileSync(path.join(extractedDir, 'mga-kasunduan.txt'), 'utf8');
  const lessons = parseLeadershipLevel1(advance);
  const lessonNums = [...lessons.keys()].sort((a, b) => a - b);
  console.log('LEVEL 1 lessons parsed:', lessonNums.join(', '));
  fs.writeFileSync(path.join(outDir, 'leadership-1-import.sql'), buildLeadership1Sql(lessons));
  fs.writeFileSync(path.join(outDir, 'covenant-templates-import.sql'), buildCovenantSql(kasunduan));
  fs.writeFileSync(
    path.join(outDir, 'leadership-1-meta.json'),
    JSON.stringify({ lesson_numbers: lessonNums, missing: [5].filter((n) => !lessons.has(n)) }, null, 2),
  );
}

main();
