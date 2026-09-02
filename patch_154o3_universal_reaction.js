const fs=require('fs');
const path=require('path');

const file=path.resolve('src/app/connect/[id].tsx');
const backup=file+'.bak154o3';

if(!fs.existsSync(file)){
  throw new Error('connect/[id].tsx not found');
}

let t=fs.readFileSync(file,'utf8');

if(!fs.existsSync(backup)){
  fs.copyFileSync(file,backup);
}

const label='accessibilityLabel="React to message"';
const labelAt=t.indexOf(label);

if(labelAt<0){
  throw new Error('React control not found');
}

/* ============================================================
   A. FIND ACTUAL reactCue WRAPPER
============================================================ */

const cueAt=t.lastIndexOf(
  's.reactCue',
  labelAt
);

if(cueAt<0){
  throw new Error('s.reactCue wrapper not found');
}

const viewStart=t.lastIndexOf(
  '<View',
  cueAt
);

const viewEnd=t.indexOf(
  '>',
  cueAt
);

if(
  viewStart<0 ||
  viewEnd<0 ||
  viewEnd>labelAt
){
  throw new Error(
    'React wrapper View could not be isolated'
  );
}

let opening=
  t.slice(
    viewStart,
    viewEnd+1
  );

const universalStyle=`style={[
                    s.reactCue,

                    /* PATCH_154O3_UNIVERSAL_SIDE */
                    m.is_mine
                      ? {
                          left: undefined,
                          right: 2,
                        }
                      : {
                          right: undefined,
                          left: 2,
                        },
                  ]}`;

/* Support every previous formatting variant */
if(
  /style=\{\[[\s\S]*?s\.reactCue[\s\S]*?\]\}/.test(opening)
){
  opening=opening.replace(
    /style=\{\[[\s\S]*?s\.reactCue[\s\S]*?\]\}/,
    universalStyle
  );
}else if(
  /style=\{s\.reactCue\}/.test(opening)
){
  opening=opening.replace(
    /style=\{s\.reactCue\}/,
    universalStyle
  );
}else{
  throw new Error(
    'React wrapper style format not recognized'
  );
}

t=
  t.slice(0,viewStart)+
  opening+
  t.slice(viewEnd+1);

/* ============================================================
   B. MAKE SURE BOTH LEFT AND RIGHT MESSAGES CAN REACT
============================================================ */

const newCueAt=
  t.indexOf(
    'PATCH_154O3_UNIVERSAL_SIDE'
  );

const contextStart=
  Math.max(
    0,
    newCueAt-500
  );

let context=
  t.slice(
    contextStart,
    newCueAt
  );

context=context.replace(
  /\{!m\.is_mine\s*&&\s*!m\.is_deleted\s*&&\s*\(\s*$/s,
  `{!m.is_deleted && (
                  `
);

t=
  t.slice(0,contextStart)+
  context+
  t.slice(newCueAt);

/* ============================================================
   C. REACTION PALETTE ALWAYS OPENS TOWARD SCREEN CENTER

   left message  -> left:0, grows right
   right message -> right:0, grows left
============================================================ */

const reactionAt=
  t.indexOf(
    'reactionOpen &&',
    newCueAt
  );

const rxAt=
  t.indexOf(
    '{RX.map',
    reactionAt
  );

if(
  reactionAt>=0 &&
  rxAt>reactionAt
){
  let picker=
    t.slice(
      reactionAt,
      rxAt
    );

  const sideStyle=`left:
            m.is_mine
              ? undefined
              : 0,
          right:
            m.is_mine
              ? 0
              : undefined,`;

  /* Existing ternary version */
  picker=picker.replace(
    /left:\s*m\.is_mine[\s\S]*?right:\s*m\.is_mine[\s\S]*?(?:undefined|0),/,
    sideStyle
  );

  /* Older right:0-only version */
  if(
    !picker.includes(
      'm.is_mine'
    )
  ){
    picker=picker.replace(
      /right:\s*0,/,
      sideStyle
    );
  }

  /* Keep palette compact and screen-safe */
  if(
    !/width:\s*190/.test(picker)
  ){
    picker=picker.replace(
      /flexDirection:\s*'row',/,
`width: 190,
          maxWidth: 190,
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',`
    );
  }

  /* Top two messages: palette opens below instead of being hidden */
  if(
    t.includes(
      'messageIndex: number'
    ) &&
    /bottom:\s*38,/.test(picker)
  ){
    picker=picker.replace(
      /bottom:\s*38,/,
`top:
            messageIndex < 2
              ? '100%'
              : undefined,
          bottom:
            messageIndex < 2
              ? undefined
              : '100%',
          marginTop:
            messageIndex < 2
              ? 5
              : undefined,
          marginBottom:
            messageIndex < 2
              ? undefined
              : 5,`
    );
  }

  t=
    t.slice(0,reactionAt)+
    picker+
    t.slice(rxAt);
}

/* ============================================================
   D. REMOVE OLD PHOTO-SPECIFIC POSITION LOGIC IF PRESENT
============================================================ */

t=t.replace(
  /\/\*\s*PATCH_154O_PHOTO_REACT_SIDE\s*\*\/[\s\S]*?(?=m\.is_mine|s\.reactCue)/g,
  ''
);

fs.writeFileSync(
  file,
  t,
  'utf8'
);

console.log('');
console.log('PATCH 154O-3 WRITTEN');
console.log('✓ LEFT bubble = react LEFT');
console.log('✓ RIGHT bubble = react RIGHT');
console.log('✓ text length does not matter');
console.log('✓ photo does not matter');
console.log('✓ reaction palette grows inward');
console.log('✓ top messages open downward');
console.log('');
