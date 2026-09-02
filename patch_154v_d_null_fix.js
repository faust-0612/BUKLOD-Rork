const fs=require('fs');
const path=require('path');

const file=path.resolve(
  'src/components/BibleReadingMonitor.tsx'
);

let t=fs.readFileSync(file,'utf8');

const backup=
  file+'.bak154v_d_null_fix';

if(!fs.existsSync(backup)){
  fs.copyFileSync(file,backup);
}

const oldText=`notes[
                          row.submission_id
                        ]?.trim()`;

const newText=`notes[
                          row.submission_id as string
                        ]?.trim()`;

if(!t.includes(oldText)){
  throw new Error(
    'Nullable submission_id notes lookup not found'
  );
}

t=t.replace(
  oldText,
  newText
);

fs.writeFileSync(
  file,
  t,
  'utf8'
);

console.log('');
console.log('PATCH 154V-D NULL FIX WRITTEN');
console.log('✓ nullable submission_id index fixed');
console.log('✓ reviewer logic untouched');
console.log('✓ questions + reflection monitor retained');
console.log('');

