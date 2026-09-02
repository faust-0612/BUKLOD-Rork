const fs=require('fs');
const path=require('path');

const file=path.resolve('src/app/connect/[id].tsx');
const backup=file+'.bak154o';

if(!fs.existsSync(file)){
  throw new Error('connect/[id].tsx not found');
}

let t=fs.readFileSync(file,'utf8');

if(!fs.existsSync(backup)){
  fs.copyFileSync(file,backup);
}

/* ============================================================
   A. PHOTO REACTION CONTROL = SAME SIDE AS PHOTO/BUBBLE
============================================================ */

if(!t.includes('PATCH_154O_PHOTO_REACT_SIDE')){

  const cueLabel=
    t.indexOf(
      'accessibilityLabel="React to message"'
    );

  if(cueLabel<0){
    throw new Error(
      'React cue not found'
    );
  }

  const styleStart=
    t.lastIndexOf(
      'style={[',
      cueLabel
    );

  const styleEnd=
    t.indexOf(
      ']}',
      styleStart
    );

  if(
    styleStart<0 ||
    styleEnd<0 ||
    cueLabel-styleStart>800
  ){
    throw new Error(
      'React cue style block not found'
    );
  }

  const oldStyle=
    t.slice(
      styleStart,
      styleEnd+2
    );

  const newStyle=`style={[
                      s.reactCue,

                      /* PATCH_154O_PHOTO_REACT_SIDE */
                      m.media_url
                        ? (
                            m.is_mine
                              ? {
                                  left: undefined,
                                  right: -35,
                                }
                              : {
                                  right: undefined,
                                  left: -35,
                                }
                          )
                        : (
                            m.is_mine
                              ? {
                                  right: undefined,
                                  left: -35,
                                }
                              : {
                                  left: undefined,
                                  right: -35,
                                }
                          ),
                    ]}`;

  t=
    t.slice(0,styleStart)+
    newStyle+
    t.slice(styleEnd+2);
}

/* ============================================================
   B. REACTION PICKER ITSELF ALSO STAYS WITH PHOTO SIDE

   LEFT PHOTO  -> picker anchored LEFT and grows right
   RIGHT PHOTO -> picker anchored RIGHT and grows left
============================================================ */

const safeMarker=
  t.indexOf(
    'PATCH_154N_SCREEN_SAFE_REACTIONS'
  );

if(
  safeMarker>=0 &&
  !t.includes(
    'PATCH_154O_PHOTO_PICKER_SIDE'
  )
){

  const pickerStyleStart=
    t.lastIndexOf(
      'style={{',
      safeMarker
    );

  const rxMap=
    t.indexOf(
      '{RX.map',
      safeMarker
    );

  if(
    pickerStyleStart>=0 &&
    rxMap>pickerStyleStart
  ){
    let block=
      t.slice(
        pickerStyleStart,
        rxMap
      );

    block=
      block.replace(
        /left:\s*m\.is_mine\s*\?\s*undefined\s*:\s*0,\s*right:\s*m\.is_mine\s*\?\s*0\s*:\s*undefined,/s,
`/* PATCH_154O_PHOTO_PICKER_SIDE */
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
      t.slice(
        0,
        pickerStyleStart
      )+
      block+
      t.slice(rxMap);
  }
}

/* ============================================================
   C. FORWARD MODAL - KEYBOARD SAFE
============================================================ */

if(
  !t.includes(
    'PATCH_154O_FORWARD_KEYBOARD_SAFE'
  )
){

  const forwardMarker=
    t.indexOf(
      '{/* FORWARD DRAWER */}'
    );

  if(forwardMarker<0){
    throw new Error(
      'FORWARD DRAWER not found'
    );
  }

  const modalStart=
    t.indexOf(
      '<Modal',
      forwardMarker
    );

  const modalEnd=
    t.indexOf(
      '</Modal>',
      modalStart
    );

  if(
    modalStart<0 ||
    modalEnd<0
  ){
    throw new Error(
      'Forward Modal bounds not found'
    );
  }

  let modal=
    t.slice(
      modalStart,
      modalEnd+
        '</Modal>'.length
    );

  const rootView=
    modal.indexOf(
      '<View'
    );

  if(rootView<0){
    throw new Error(
      'Forward modal root View not found'
    );
  }

  modal=
    modal.slice(
      0,
      rootView
    )+
`{/* PATCH_154O_FORWARD_KEYBOARD_SAFE */}
        <KeyboardAvoidingView
          style={{flex:1}}
          behavior={
            Platform.OS==='ios'
              ? 'padding'
              : 'height'
          }
          keyboardVerticalOffset={
            Platform.OS==='ios'
              ? 8
              : 0
          }
        >
          `+
    modal.slice(rootView);

  const closeModal=
    modal.lastIndexOf(
      '</Modal>'
    );

  modal=
    modal.slice(
      0,
      closeModal
    )+
`
        </KeyboardAvoidingView>
      `+
    modal.slice(closeModal);

  /* A little less drawer height so search/results remain above keyboard */
  modal=
    modal.replace(
      /maxHeight:\s*'76%'/,
      "maxHeight: '68%'"
    );

  t=
    t.slice(
      0,
      modalStart
    )+
    modal+
    t.slice(
      modalEnd+
        '</Modal>'.length
    );
}

/* ============================================================
   D. FORWARD SEARCH INPUT SHOULD REMAIN TAPPABLE WITH KEYBOARD
============================================================ */

const forwardMarker2=
  t.indexOf(
    '{/* FORWARD DRAWER */}'
  );

if(forwardMarker2>=0){

  const nextModalEnd=
    t.indexOf(
      '</Modal>',
      forwardMarker2
    );

  let forwardBlock=
    t.slice(
      forwardMarker2,
      nextModalEnd+
        '</Modal>'.length
    );

  forwardBlock=
    forwardBlock.replace(
      /<ScrollView(?![^>]*keyboardShouldPersistTaps)/,
      `<ScrollView
              keyboardShouldPersistTaps="handled"`
    );

  t=
    t.slice(
      0,
      forwardMarker2
    )+
    forwardBlock+
    t.slice(
      nextModalEnd+
        '</Modal>'.length
    );
}

fs.writeFileSync(
  file,
  t,
  'utf8'
);

console.log('');
console.log('PATCH 154O WRITTEN');
console.log('✓ left photo = react on left');
console.log('✓ right photo = react on right');
console.log('✓ reaction choices remain inside screen');
console.log('✓ forward drawer follows keyboard');
console.log('✓ forward search/results remain usable');
console.log('');
