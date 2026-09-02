const fs=require('fs');

const path=
 './src/app/(tabs)/_layout.tsx';

let src=
 fs.readFileSync(
  path,
  'utf8'
 );


function stop(message){
 console.error('');
 console.error(
  'PATCH 162B STOPPED:'
 );
 console.error(message);
 process.exit(1);
}


/* ============================================================
   1. REMOVE OLD 162A TIMED ANIMATION
   ============================================================ */

src=
 src.replace(
  /\s*\/\*\s*PATCH_162A_GENTLE_TAB_TRANSITION[\s\S]*?(?=\s*headerStyle\s*:)/,
  '\n      '
 );


src=
 src.replace(
  /\s*animation:\s*'shift'\s*,/g,
  ''
 );


src=
 src.replace(
  /\s*transitionSpec:\s*\{\s*animation:\s*'timing'\s*,\s*config:\s*\{\s*duration:\s*\d+\s*,?\s*\}\s*,?\s*\}\s*,?/g,
  ''
 );


console.log(
 '✓ Old timed shift removed'
 );


/* ============================================================
   2. EXPO ROUTER IMPORT
   ============================================================ */

const routerImport=
 /import\s*\{([\s\S]*?)\}\s*from\s*'expo-router';/;

const routerMatch=
 src.match(
  routerImport
 );


if(!routerMatch){
 stop(
  'expo-router import not found.'
 );
}


const routerNames=
 routerMatch[1]
  .split(',')
  .map(x=>x.trim())
  .filter(Boolean);


for(
 const name of [
  'router',
  'usePathname'
 ]
){
 if(
  !routerNames.includes(name)
 ){
  routerNames.push(name);
 }
}


src=
 src.replace(
  routerImport,
`import {
 ${routerNames.join(',\n ')}
} from 'expo-router';`
 );


/* ============================================================
   3. REACT TYPE IMPORT
   ============================================================ */

if(
 !src.includes(
  "from 'react';"
 )
){
 src=
  `import type { ReactNode } from 'react';\n`+
  src;
}
else if(
 !src.includes(
  'ReactNode'
 )
){
 const reactRx=
  /import\s*\{([\s\S]*?)\}\s*from\s*'react';/;

 const match=
  src.match(
   reactRx
  );

 if(match){

  const names=
   match[1]
    .split(',')
    .map(x=>x.trim())
    .filter(Boolean);

  names.push(
   'type ReactNode'
  );

  src=
   src.replace(
    reactRx,
`import {
 ${names.join(',\n ')}
} from 'react';`
   );

 }else{

  src=
   `import type { ReactNode } from 'react';\n`+
   src;
 }
}


/* ============================================================
   4. DIMENSIONS
   ============================================================ */

const rnImport=
 /import\s*\{([\s\S]*?)\}\s*from\s*'react-native';/;

const rnMatch=
 src.match(
  rnImport
 );


if(!rnMatch){
 stop(
  'react-native import not found.'
 );
}


const rnNames=
 rnMatch[1]
  .split(',')
  .map(x=>x.trim())
  .filter(Boolean);


if(
 !rnNames.includes(
  'Dimensions'
 )
){
 rnNames.push(
  'Dimensions'
 );
}


src=
 src.replace(
  rnImport,
`import {
 ${rnNames.join(',\n ')}
} from 'react-native';`
 );


/* ============================================================
   5. GESTURE + REANIMATED IMPORTS
   ============================================================ */

if(
 !src.includes(
  "from 'react-native-gesture-handler'"
 )
){

 const themeImport=
  "import { colors } from '@/lib/theme';";

 if(
  !src.includes(
   themeImport
  )
 ){
  stop(
   'Theme import anchor not found.'
  );
 }


 src=
  src.replace(
   themeImport,
`${themeImport}

import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';

import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';`
  );
}


/* ============================================================
   6. CARD SWIPE COMPONENT
   ============================================================ */

const layoutAnchor=
 'export default function TabsLayout()';


if(
 !src.includes(
  layoutAnchor
 )
){
 stop(
  'TabsLayout anchor not found.'
 );
}


if(
 !src.includes(
  'PATCH_162B_CARD_SWIPE'
 )
){

const component=
`/* PATCH_162B_CARD_SWIPE
 *
 * The current dashboard follows the finger horizontally.
 * Vertical movements fail quickly so normal feed scrolling wins.
 */

const PRIMARY_SWIPE_TABS=[
  {
    key:'home',
    path:'/home',
  },
  {
    key:'messages',
    path:'/messages',
  },
  {
    key:'learn',
    path:'/learn',
  },
  {
    key:'buklod',
    path:'/buklod',
  },
  {
    key:'prayer',
    path:'/prayer',
  },
  {
    key:'me',
    path:'/me',
  },
] as const;


const SWIPE_WIDTH=
  Dimensions
   .get('window')
   .width;


function SwipeCardLayer({
  children,
}:{
  children:ReactNode;
}){

  const pathname=
    usePathname();


  const dragX=
    useSharedValue(0);


  const currentIndex=
    PRIMARY_SWIPE_TABS
     .findIndex(
      tab=>
       pathname===tab.path
       ||
       pathname.startsWith(
        tab.path+'/'
       )
     );


  const navigateSwipe=
    (
      direction:-1|1
    )=>{

      if(currentIndex<0){
        return;
      }


      const nextIndex=
        currentIndex+
        direction;


      if(
        nextIndex<0
        ||
        nextIndex>=
          PRIMARY_SWIPE_TABS.length
      ){
        return;
      }


      dragX.value=0;


      router.navigate(
        PRIMARY_SWIPE_TABS[
          nextIndex
        ].path as any
      );
    };


  const pan=
    Gesture
     .Pan()

     /*
      * Horizontal intent first.
      * Vertical scrolling remains natural.
      */
     .activeOffsetX([
       -16,
       16,
     ])

     .failOffsetY([
       -12,
       12,
     ])

     .onUpdate(
      event=>{

       if(currentIndex<0){
        dragX.value=0;
        return;
       }


       const atFirst=
         currentIndex===0
         &&
         event.translationX>0;


       const atLast=
         currentIndex===
           PRIMARY_SWIPE_TABS.length-1
         &&
         event.translationX<0;


       /*
        * Edge resistance:
        * like pulling a card against
        * the end of the stack.
        */
       dragX.value=
         atFirst||atLast
          ? event.translationX*0.18
          : event.translationX;
      }
     )

     .onEnd(
      event=>{

       if(currentIndex<0){
        dragX.value=
          withSpring(0);
        return;
       }


       const distance=
         Math.abs(
          event.translationX
         );


       const fast=
         Math.abs(
          event.velocityX
         )>650;


       const committed=
         distance>
           SWIPE_WIDTH*0.15
         ||
         fast;


       if(
        committed
        &&
        event.translationX<0
        &&
        currentIndex<
          PRIMARY_SWIPE_TABS.length-1
       ){

        runOnJS(
         navigateSwipe
        )(1);

        return;
       }


       if(
        committed
        &&
        event.translationX>0
        &&
        currentIndex>0
       ){

        runOnJS(
         navigateSwipe
        )(-1);

        return;
       }


       /*
        * Not enough pull:
        * snap the card naturally
        * back under the finger.
        */
       dragX.value=
         withSpring(
          0,
          {
           damping:20,
           stiffness:260,
           mass:0.65,
          }
         );
      }
     );


  const cardStyle=
    useAnimatedStyle(
     ()=>{

      const rotate=
        (
         dragX.value/
         Math.max(
          SWIPE_WIDTH,
          1
         )
        )*1.25;


      return {
       transform:[
        {
         translateX:
          dragX.value,
        },
        {
         rotateZ:
          rotate+'deg',
        },
       ],
      };
     }
    );


  return(
   <View
    style={{
     flex:1,
     overflow:'hidden',
     backgroundColor:
      colors.greenSoft,
    }}
   >

    <GestureDetector
     gesture={pan}
    >

     <Animated.View
      style={[
       {
        flex:1,
        backgroundColor:
         colors.white,
       },
       cardStyle,
      ]}
     >

      {children}

     </Animated.View>

    </GestureDetector>

   </View>
  );
}


`;


 src=
  src.replace(
   layoutAnchor,
   component+
   layoutAnchor
  );
}


/* ============================================================
   7. WRAP EVERY TAB SCREEN WITH screenLayout
   ============================================================ */

if(
 !src.includes(
  'screenLayout={({children})'
 )
){

 const tabsOpen=
  /<Tabs\s+screenOptions=\{\{/;


 if(
  !tabsOpen.test(src)
 ){
  stop(
   '<Tabs screenOptions={{ anchor not found.'
  );
 }


 src=
  src.replace(
   tabsOpen,
`<Tabs
      screenLayout={({children}) => (
        <SwipeCardLayer>
          {children}
        </SwipeCardLayer>
      )}
      screenOptions={{`
  );
}


/* ============================================================
   8. FINAL CHECKS
   ============================================================ */

if(
 src.includes(
  "animation: 'shift'"
 )
){
 stop(
  'Old shift animation still exists.'
 );
}


if(
 !src.includes(
  'screenLayout={({children})'
 )
){
 stop(
  'screenLayout wrapper missing.'
 );
}


if(
 !/Gesture\s*\.Pan\s*\(\s*\)/.test(
  src
 )
){
 stop(
  'Gesture Pan missing.'
 );
}


if(
 !src.includes(
  'router.navigate('
 )
){
 stop(
  'Swipe route navigation missing.'
 );
}


fs.writeFileSync(
 path,
 src,
 'utf8'
 );


console.log('');
console.log(
 'PATCH 162B SOURCE APPLIED'
);

console.log(
 '✓ Finger-following horizontal drag'
);

console.log(
 '✓ 15% swipe threshold'
);

console.log(
 '✓ Fast flick supported'
);

console.log(
 '✓ Short swipe springs back'
);

console.log(
 '✓ Vertical scrolling preserved'
);

console.log(
 '✓ Bottom tab taps remain immediate'
);

console.log(
 '✓ No timed shift animation'
);
