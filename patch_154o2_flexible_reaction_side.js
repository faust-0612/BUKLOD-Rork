const fs=require('fs');
const path=require('path');

const file=path.resolve('src/app/connect/[id].tsx');
const backup=file+'.bak154o2';

if(!fs.existsSync(file)){
  throw new Error('connect/[id].tsx not found');
}

let t=fs.readFileSync(file,'utf8');

if(!fs.existsSync(backup)){
  fs.copyFileSync(file,backup);
}

/* ============================================================
   UNIVERSAL MESSAGE-SIDE REACTION
   LEFT bubble  = reaction LEFT
   RIGHT bubble = reaction RIGHT
============================================================ */

const label='accessibilityLabel="React to message"';
const labelAt=t.indexOf(label);

if(labelAt<0){
  throw new Error('React to message control not found');
}

const before=t.slice(
  Math.max(0,labelAt-1800),
  labelAt+label.length
);

const styleRx=
  /style=\{\[\s*s\.reactCue,[\s\S]*?\]\}\s*accessibilityLabel="React to message"/;

if(!styleRx.test(before)){
  throw new Error('Reaction cue style block not found');
}

const replacement=`style={[
                      s.reactCue,

                      /* PATCH_154O2_FLEXIBLE_MESSAGE_SIDE */
                      m.is_mine
                        ? {
                            left: undefined,
                            right: 3,
                          }
                        : {
                            right: undefined,
                            left: 3,
                          },
                    ]}
                    accessibilityLabel="React to message"`;

const fixedBefore=
  before.replace(
    styleRx,
    replacement
  );

t=
  t.slice(
    0,
    Math.max(0,labelAt-1800)
  )+
  fixedBefore+
  t.slice(
    labelAt+label.length
  );

/* ============================================================
   REACTION PICKER ALSO FOLLOWS MESSAGE SIDE
   Choices extend toward the CENTER of the screen.
============================================================ */

const pickerMarker=
  t.indexOf(
    'PATCH_154N_SCREEN_SAFE_REACTIONS'
  );

if(pickerMarker>=0){
  const start=
    Math.max(
      0,
      pickerMarker-800
    );

  const end=
    t.indexOf(
      '{RX.map',
      pickerMarker
    );

  if(end>start){
    let block=
      t.slice(start,end);

    block=block.replace(
      /left:\s*m\.is_mine\s*\?\s*undefined\s*:\s*0,\s*right:\s*m\.is_mine\s*\?\s*0\s*:\s*undefined,/s,
`/* PATCH_154O2_PICKER_SAME_SIDE */
          left:
            m.is_mine
              ? undefined
              : 0,
          right:
            m.is_mine
              ? 0
              : undefined,`
    );

    t=
      t.slice(0,start)+
      block+
      t.slice(end);
  }
}

fs.writeFileSync(
  file,
  t,
  'utf8'
);

console.log('');
console.log('PATCH 154O-2 WRITTEN');
console.log('✓ LEFT message = react LEFT');
console.log('✓ RIGHT message = react RIGHT');
console.log('✓ photo/text/long message use same rule');
console.log('✓ reaction picker grows inward');
console.log('');
