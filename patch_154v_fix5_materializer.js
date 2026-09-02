const fs=require('fs');
const path=require('path');

const source=path.resolve(
  'supabase/migrations/20260811071500_patch153h1b1_automatic_bible_materialization.sql'
);

if(!fs.existsSync(source)){
  throw new Error(
    'Original automatic Bible materialization migration not found'
  );
}

const original=fs.readFileSync(source,'utf8');

const start=original.indexOf(
  'create or replace function\npublic.materialize_automatic_bible_assignment('
);

if(start<0){
  throw new Error(
    'materialize_automatic_bible_assignment function not found'
  );
}

const bodyEnd=original.indexOf(
  '$$;',
  start
);

if(bodyEnd<0){
  throw new Error(
    'materializer function end not found'
  );
}

let fn=original.slice(
  start,
  bodyEnd+3
);

/*
 * Rename ONLY the PL/pgSQL local variable.
 * Do NOT rename actual table columns named assignment_id.
 */

fn=fn.replace(
  '  assignment_id uuid;',
  '  v_assignment_id uuid;'
);

fn=fn.replace(
  /    assignment_id :=/g,
  '    v_assignment_id :='
);

fn=fn.replace(
  /  into assignment_id;/g,
  '  into v_assignment_id;'
);

fn=fn.replace(
  /          assignment_id\n/g,
  '          v_assignment_id\n'
);

fn=fn.replace(
  /      where id =\n        assignment_id;/g,
  '      where id =\n        v_assignment_id;'
);

fn=fn.replace(
  /      assignment_id,\n      p\.id/g,
  '      v_assignment_id,\n      p.id'
);

fn=fn.replace(
  /    assignment_id,\n    p\.id/g,
  '    v_assignment_id,\n    p.id'
);

fn=fn.replace(
  /    return assignment_id;/g,
  '    return v_assignment_id;'
);

fn=fn.replace(
  /  return assignment_id;/g,
  '  return v_assignment_id;'
);

/* Safety checks */

if(
  fn.includes('  assignment_id uuid;')
){
  throw new Error(
    'Old local variable declaration still exists'
  );
}

if(
  fn.includes('s.assignment_id =\n          assignment_id')
){
  throw new Error(
    'Ambiguous submission comparison still exists'
  );
}

if(
  !fn.includes('v_assignment_id')
){
  throw new Error(
    'Replacement variable was not installed'
  );
}

const migration=path.resolve(
  'supabase/migrations/20260812031500_patch154v_fix5_materializer_variable.sql'
);

const sql=`-- PATCH 154V-FIX5
-- Fix ambiguous assignment_id inside the private automatic Bible materializer.
-- Database column names remain unchanged.

${fn}

notify pgrst, 'reload schema';
`;

fs.writeFileSync(
  migration,
  sql,
  'utf8'
);

console.log('');
console.log('PATCH 154V-FIX5 WRITTEN');
console.log('✓ local assignment_id renamed to v_assignment_id');
console.log('✓ table assignment_id columns untouched');
console.log('✓ private materializer retained');
console.log('✓ V2 automatic-week wrapper retained');
console.log('✓ schema reload included');
console.log('');

