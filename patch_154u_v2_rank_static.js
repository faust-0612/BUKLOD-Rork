const fs=require('fs');
const path=require('path');

const file=path.resolve(
  'src/app/(tabs)/home.tsx'
);

let t=fs.readFileSync(file,'utf8');

const backup=
  file+'.bak154u_v2';

if(!fs.existsSync(backup)){
  fs.copyFileSync(file,backup);
}

/* Locate the under-name rank badge */
const marker='paddingHorizontal: 9,';
const markerAt=t.indexOf(marker);

if(markerAt<0){
  throw new Error(
    'Under-name rank badge marker not found'
  );
}

const start=
  t.lastIndexOf(
    '<Pressable',
    markerAt
  );

const close=
  t.indexOf(
    '</Pressable>',
    markerAt
  );

if(start<0 || close<0){
  throw new Error(
    'Rank Pressable block not found'
  );
}

const end=
  close+
  '</Pressable>'.length;

let block=
  t.slice(start,end);

/* Safety: this must be the rank badge */
if(
  !block.includes(
    "router.push('/points')"
  )
){
  throw new Error(
    'Safety stop: wrong Pressable selected'
  );
}

/* Remove ONLY click behavior */
block=block.replace(
  /\s*onPress=\{\(\)\s*=>\s*router\.push\(\s*'\/points'\s*\)\s*\}/,
  ''
);

/* Pressable becomes static View */
block=
  block.replace(
    '<Pressable',
    '<View'
  );

block=
  block.replace(
    '</Pressable>',
    '</View>'
  );

/* Make badge slightly larger */
block=
  block.replace(
    'paddingHorizontal: 9,',
    'paddingHorizontal: 13,'
  );

block=
  block.replace(
    'paddingVertical: 4,',
    'paddingVertical: 6,'
  );

/* Enlarge rank text */
const textAt=
  block.indexOf('<Text');

if(textAt>=0){
  const before=
    block.slice(0,textAt);

  let after=
    block.slice(textAt);

  after=
    after.replace(
      /fontSize:\s*\d+(?:\.\d+)?/,
      'fontSize: 14'
    );

  block=before+after;
}

/* Final safety */
if(
  block.includes(
    "router.push('/points')"
  )
){
  throw new Error(
    'Rank badge is still clickable'
  );
}

t=
  t.slice(0,start)+
  block+
  t.slice(end);

fs.writeFileSync(
  file,
  t,
  'utf8'
);

console.log('');
console.log('PATCH 154U-V2 WRITTEN');
console.log('✓ Rank below name is display only');
console.log('✓ Rank badge enlarged');
console.log('✓ Header rank icon untouched');
console.log('');

