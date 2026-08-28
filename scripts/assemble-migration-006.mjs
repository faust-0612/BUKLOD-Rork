import fs from 'fs';
import path from 'path';

const root = path.resolve(process.cwd());
const out = path.join(
  root,
  'supabase/migrations/20260820130001_buklod_formation_import_controlled_006.sql',
);
const l1 = fs.readFileSync(
  path.join(root, 'supabase/seed/formation/generated/leadership-1-import.sql'),
  'utf8',
);
const cov = fs.readFileSync(
  path.join(root, 'supabase/seed/formation/generated/covenant-templates-import.sql'),
  'utf8',
);
const tail = fs.readFileSync(
  path.join(root, 'supabase/migrations/_006_runtime_tail.sql'),
  'utf8',
);

const sql = `BEGIN;

-- ============================================================================
-- BUKLOD Formation Engine — Implementation 006 (part 2)
-- Leadership 1 import + covenant templates + controlled drafts + QA hooks
-- ============================================================================

${l1}

-- ============================================================================
-- 006-F: COVENANT TEMPLATE IMPORT
-- ============================================================================

${cov}

${tail}
`;

fs.writeFileSync(out, sql, 'utf8');
console.log('Wrote', out, sql.length, 'chars');
