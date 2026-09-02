const fs=require('fs');
const path=require('path');

const file=path.resolve(
  'src/app/bible/index.tsx'
);

let t=fs.readFileSync(file,'utf8');

const backup=
  file+'.bak154v_fix_types';

if(!fs.existsSync(backup)){
  fs.copyFileSync(file,backup);
}

/* ============================================================
   1. FIX Assignment TYPE
============================================================ */

const typeStart=
  t.indexOf('type Assignment = {');

if(typeStart<0){
  throw new Error(
    'Assignment type not found'
  );
}

const typeEnd=
  t.indexOf('};',typeStart);

if(typeEnd<0){
  throw new Error(
    'Assignment type closing not found'
  );
}

let typeBlock=
  t.slice(
    typeStart,
    typeEnd+2
  );

if(
  !typeBlock.includes(
    'chapter_questions_fil'
  )
){
  typeBlock=
    typeBlock.replace(
      '\n};',
`\n  chapter_questions_fil?: string[] | null;
  chapter_questions_en?: string[] | null;
};`
    );
}

t=
  t.slice(0,typeStart)+
  typeBlock+
  t.slice(typeEnd+2);


/* ============================================================
   2. FIX CALLBACK TYPES
============================================================ */

t=t.replace(
`      .every(
        (_,index)=>`,
`      .every(
        (_: string,index: number)=>`
);

t=t.replace(
`                (question,index)=>(`,
`                (question: string,index: number)=>(`
);


/* ============================================================
   3. SAFETY CHECK
============================================================ */

if(
  !t.includes(
    'chapter_questions_fil?: string[] | null;'
  ) ||
  !t.includes(
    'chapter_questions_en?: string[] | null;'
  )
){
  throw new Error(
    'Assignment question types were not installed'
  );
}

fs.writeFileSync(
  file,
  t,
  'utf8'
);

console.log('');
console.log('PATCH 154V-FIX-TYPES WRITTEN');
console.log('✓ Assignment question fields added');
console.log('✓ .every callback typed');
console.log('✓ question map callback typed');
console.log('✓ automatic reading logic untouched');
console.log('✓ migration untouched');
console.log('');

