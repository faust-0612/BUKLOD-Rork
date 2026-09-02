const fs=require('fs');
const path=require('path');

const file=path.resolve(
  'src/app/(tabs)/home.tsx'
);

let t=fs.readFileSync(file,'utf8');

const backup=file+'.bak154u_rank_display';

if(!fs.existsSync(backup)){
  fs.copyFileSync(file,backup);
}

/* Find the small Circle Rank badge below the name */
const marker='paddingHorizontal: 9,';
const m=t.indexOf(marker);

if(m<0){
  throw new Error(
    'Circle Rank badge marker not found'
  );
}

const start=t.lastIndexOf(
  '<Pressable',
  m
);

const endTag=t.indexOf(
  '</Pressable>',
  m
);

if(start<0 || endTag<0){
  throw new Error(
    'Circle Rank Pressable block not found'
  );
}

const end=endTag+
  '</Pressable>'.length;

let block=t.slice(start,end);

if(
  !block.includes(
    "router.push('/points')"
  )
){
  throw new Error(
    'Safety stop: target is not the under-name Circle Rank badge'
  );
}

/* Preserve inner rank text, remove click behavior */
const openEnd=block.indexOf('>');

if(openEnd<0){
  throw new Error(
    'Opening Pressable tag malformed'
  );
}

let inner=
  block.slice(
    openEnd+1,
    block.lastIndexOf(
      '</Pressable>'
    )
  );

/* Make rank text larger */
inner=inner.replace(
  /fontSize:\s*\d+(?:\.\d+)?/,
  'fontSize: 14'
);

const replacement=`<View
              style={{
                alignSelf: 'flex-start',
                paddingHorizontal: 13,
                paddingVertical: 6,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.green,
                backgroundColor: colors.greenSoft,
              }}
            >${inner}</View>`;

t=
  t.slice(0,start)+
  replacement+
  t.slice(end);

fs.writeFileSync(
  file,
  t,
  'utf8'
);

console.log('');
console.log('PATCH 154U WRITTEN');
console.log('✓ Rank below name is NOT clickable');
console.log('✓ Rank badge enlarged');
console.log('✓ Header rank/points icon remains clickable');
console.log('✓ No DB change');
console.log('');

