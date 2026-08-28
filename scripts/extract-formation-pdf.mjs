/**
 * One-off PDF text extraction for formation source import (006).
 * Uses npm exec pdf-parse — not added as project dependency.
 */
import fs from 'fs';
import path from 'path';
import { PDFParse } from 'pdf-parse';

const root = path.resolve(process.cwd(), 'docs/formation-source');
const outDir = path.resolve(process.cwd(), 'supabase/seed/formation/extracted');

async function extractFile(name) {
  const filePath = path.join(root, name);
  const buffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  await parser.destroy();
  return {
    filename: name,
    pages: result.total,
    text: result.text,
  };
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const files = [
    'church-care-process.pdf',
    'advance-discipleship.pdf',
    'mga-kasunduan.pdf',
  ];

  for (const file of files) {
    const result = await extractFile(file);
    const base = file.replace('.pdf', '');
    fs.writeFileSync(
      path.join(outDir, `${base}.meta.json`),
      JSON.stringify(
        {
          filename: result.filename,
          pages: result.pages,
          extracted_at: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    fs.writeFileSync(path.join(outDir, `${base}.txt`), result.text, 'utf8');
    console.log(`${file}: ${result.pages} pages, ${result.text.length} chars`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
