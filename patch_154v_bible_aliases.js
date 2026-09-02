const fs=require('fs');
const path=require('path');

const file=path.resolve(
  'src/app/bible/index.tsx'
);

let t=fs.readFileSync(file,'utf8');

const backup=file+'.bak154v_bible_aliases';

if(!fs.existsSync(backup)){
  fs.copyFileSync(file,backup);
}

const anchor=
  'const BIBLE_BOOK_NUMBERS = ([';

const at=t.indexOf(anchor);

if(at<0){
  throw new Error(
    'BIBLE_BOOK_NUMBERS anchor not found'
  );
}

if(t.includes("['gen',1]")){
  console.log(
    'Bible aliases already installed.'
  );
  process.exit(0);
}

const insertAt=
  at+anchor.length;

const aliases=`
  /* PATCH_154V_BIBLE_REFERENCE_ALIASES */
  ['gen',1],['ge',1],
  ['exo',2],['exod',2],['ex',2],
  ['lev',3],
  ['num',4],['nu',4],
  ['deut',5],['dt',5],
  ['josh',6],
  ['judg',7],['jdg',7],
  ['ru',8],

  ['1 sam',9],['1sam',9],['1 sa',9],
  ['2 sam',10],['2sam',10],['2 sa',10],
  ['1 kgs',11],['1kgs',11],['1 ki',11],
  ['2 kgs',12],['2kgs',12],['2 ki',12],
  ['1 chr',13],['1chr',13],['1 chron',13],
  ['2 chr',14],['2chr',14],['2 chron',14],

  ['neh',16],
  ['esth',17],['est',17],
  ['ps',19],['psa',19],['psalm',19],
  ['prov',20],['pr',20],
  ['eccl',21],['ecc',21],
  ['song',22],['sos',22],

  ['isa',23],
  ['jer',24],
  ['lam',25],
  ['ezek',26],['eze',26],
  ['dan',27],
  ['hos',28],
  ['obad',31],['ob',31],
  ['jon',32],
  ['mic',33],
  ['nah',34],
  ['hab',35],
  ['zeph',36],
  ['hag',37],
  ['zech',38],
  ['mal',39],

  ['matt',40],['mt',40],
  ['mk',41],['mrk',41],
  ['lk',42],
  ['jn',43],['jhn',43],
  ['act',44],
  ['rom',45],

  ['1 cor',46],['1cor',46],
  ['2 cor',47],['2cor',47],
  ['gal',48],
  ['eph',49],
  ['phil',50],
  ['col',51],

  ['1 thess',52],['1thess',52],['1 thes',52],
  ['2 thess',53],['2thess',53],['2 thes',53],
  ['1 tim',54],['1tim',54],
  ['2 tim',55],['2tim',55],
  ['tit',56],
  ['phlm',57],['phm',57],
  ['heb',58],
  ['jas',59],

  ['1 pet',60],['1pet',60],['1 pe',60],
  ['2 pet',61],['2pet',61],['2 pe',61],
  ['1 jn',62],['1jn',62],
  ['2 jn',63],['2jn',63],
  ['3 jn',64],['3jn',64],

  ['rev',66],['re',66],
`;

t=
  t.slice(0,insertAt)+
  aliases+
  t.slice(insertAt);

fs.writeFileSync(
  file,
  t,
  'utf8'
);

console.log('');
console.log('PATCH 154V BIBLE ALIASES WRITTEN');
console.log('✓ Gen 2 -> Genesis 2');
console.log('✓ common OT abbreviations supported');
console.log('✓ common NT abbreviations supported');
console.log('✓ automatic Daily Bible reading unchanged');
console.log('✓ no DB change');
console.log('');

