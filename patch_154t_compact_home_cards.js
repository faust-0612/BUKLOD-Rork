const fs=require('fs');
const path=require('path');

const file=path.resolve(
  'src/app/(tabs)/home.tsx'
);

let t=fs.readFileSync(file,'utf8');

const backup=file+'.bak154t_compact';

if(!fs.existsSync(backup)){
  fs.copyFileSync(file,backup);
}

const start=t.indexOf(
  'function HomeDailyBayanihanPair()'
);

const end=t.indexOf(
  'function HomeDailyBibleStrip()',
  start
);

if(start<0 || end<0){
  throw new Error(
    'HomeDailyBayanihanPair block not found'
  );
}

let block=t.slice(start,end);

/* REMOVE THE HEIGHT BUG */
block=block.replace(
  /height:'100%',/g,
  ''
);

/* compact equal cards */
block=block.replace(
  /minHeight:132/g,
  'minHeight:104'
);

block=block.replace(
  /padding:12/g,
  'padding:10'
);

block=block.replace(
  /gap:10,/,
  'gap:8,'
);

/* slightly tighter outer spacing */
block=block.replace(
  /marginBottom:8/,
  'marginBottom:6'
);

/* Inner cards fill only their row,
   NOT the whole Home screen */
block=block.replace(
  /minHeight:104,\s*\n\s*borderWidth:1/g,
  `minHeight:104,
            flex:1,
            borderWidth:1`
);

/* Short Bayanihan reminder */
block=block.replace(
  'Reference value only. Not personal cash or automatic property of the member.',
  'Reference only • Not personal cash.'
);

/* Remove unnecessary bottom OPEN / VIEW areas.
   Whole cards are already tappable. */
block=block.replace(
  /<View style=\{\{flex:1\}\} \/>\s*[\s\S]*?<Text\s+style=\{\{\s*marginTop:7,[\s\S]*?OPEN ›\s*<\/Text>/,
  ''
);

block=block.replace(
  /<View style=\{\{flex:1\}\} \/>\s*[\s\S]*?<Text\s+style=\{\{\s*marginTop:5,[\s\S]*?VIEW ›\s*<\/Text>/,
  ''
);

/* tighter text spacing */
block=block.replace(
  /marginTop:10,/g,
  'marginTop:7,'
);

block=block.replace(
  /marginTop:9,/g,
  'marginTop:6,'
);

block=block.replace(
  /marginTop:6,/g,
  'marginTop:4,'
);

const next=
  t.slice(0,start)+
  block+
  t.slice(end);

fs.writeFileSync(
  file,
  next,
  'utf8'
);

console.log('');
console.log('PATCH 154T-COMPACT WRITTEN');
console.log('✓ removed height:100% bug');
console.log('✓ Daily Devotion card compact');
console.log('✓ Bayanihan card compact');
console.log('✓ equal side-by-side cards');
console.log('✓ current balance retained');
console.log('✓ short reference disclaimer');
console.log('✓ other Home cards no longer pushed far down');
console.log('');

