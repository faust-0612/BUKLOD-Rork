const fs=require('fs');
const path=require('path');

const file=path.resolve('src/app/connect/[id].tsx');
const backup=file+'.bak154p';

if(!fs.existsSync(file)){
  throw new Error('connect/[id].tsx not found');
}

let t=fs.readFileSync(file,'utf8');

if(!fs.existsSync(backup)){
  fs.copyFileSync(file,backup);
}

/* ============================================================
   1. MAIN REACT BUTTON ITSELF SHOWS CURRENT REACTION
============================================================ */

const label='accessibilityLabel="React to message"';
const labelAt=t.indexOf(label);

if(labelAt<0){
  throw new Error('React button not found');
}

const iconAt=t.indexOf(
  '<MaterialCommunityIcons',
  labelAt
);

if(iconAt<0 || iconAt-labelAt>700){
  throw new Error('React icon not found');
}

const iconEnd=t.indexOf('/>',iconAt);

if(iconEnd<0){
  throw new Error('React icon closing not found');
}

let icon=t.slice(iconAt,iconEnd+2);

icon=icon.replace(
  /name=\{?["']emoticon-plus-outline["']\}?/,
`/* PATCH_154P_SINGLE_REACTION_ICON */
      name={
        m.reaction
          ? reactionIcon(
              m.reaction
            ) as any
          : 'emoticon-plus-outline'
      }`
);

if(!icon.includes('PATCH_154P_SINGLE_REACTION_ICON')){
  throw new Error(
    'Static react icon format not recognized'
  );
}

t=
  t.slice(0,iconAt)+
  icon+
  t.slice(iconEnd+2);

/* ============================================================
   2. HIDE OLD SEPARATE REACTION BADGE
   Keep code intact for safety, but no duplicate icon appears.
============================================================ */

if(
  !t.includes(
    'PATCH_154P_HIDE_OLD_REACTION_BADGE'
  )
){
  const styleAt=t.indexOf(
    'reactionBadge:'
  );

  if(styleAt<0){
    throw new Error(
      'reactionBadge style not found'
    );
  }

  const brace=t.indexOf('{',styleAt);

  if(brace<0){
    throw new Error(
      'reactionBadge opening brace not found'
    );
  }

  t=
    t.slice(0,brace+1)+
`
        /* PATCH_154P_HIDE_OLD_REACTION_BADGE */
        display: 'none',
`+
    t.slice(brace+1);
}

fs.writeFileSync(file,t,'utf8');

console.log('');
console.log('PATCH 154P WRITTEN');
console.log('✓ one reaction control only');
console.log('✓ chosen reaction replaces React icon');
console.log('✓ changing reaction changes same icon');
console.log('✓ removing reaction returns generic icon');
console.log('✓ old duplicate reaction badge hidden');
console.log('');
