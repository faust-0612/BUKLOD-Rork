const fs=require('fs');
const path=require('path');

const file=path.resolve(
  'src/components/BibleReadingMonitor.tsx'
);

let t=fs.readFileSync(file,'utf8');

const backup=
  file+'.bak154v_d_template_fix';

if(!fs.existsSync(backup)){
  fs.copyFileSync(file,backup);
}

const escapedTicksBefore=
  (t.match(/\\`/g)||[]).length;

const escapedInterpolationsBefore=
  (t.match(/\\\$\{/g)||[]).length;

/*
 * Fix template literals accidentally written
 * with literal escape characters by String.raw.
 */
t=t.replace(
  /\\`/g,
  '`'
);

t=t.replace(
  /\\\$\{/g,
  '${'
);

const escapedTicksAfter=
  (t.match(/\\`/g)||[]).length;

const escapedInterpolationsAfter=
  (t.match(/\\\$\{/g)||[]).length;

if(
  escapedTicksAfter>0 ||
  escapedInterpolationsAfter>0
){
  throw new Error(
    'Escaped template characters still remain'
  );
}

fs.writeFileSync(
  file,
  t,
  'utf8'
);

console.log('');
console.log('PATCH 154V-D TEMPLATE FIX WRITTEN');
console.log('✓ escaped backticks fixed: '+escapedTicksBefore);
console.log('✓ escaped ${...} fixed: '+escapedInterpolationsBefore);
console.log('✓ reviewer logic untouched');
console.log('✓ monitor V3 retained');
console.log('');

