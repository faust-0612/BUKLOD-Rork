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
  'PATCH 162C STOPPED:'
 );
 console.error(message);
 process.exit(1);
}


/* ============================================================
   PRECHECK
   ============================================================ */

if(
 !src.includes(
  'export default function TabsLayout'
 )
){
 stop(
  'TabsLayout not found.'
 );
}


/* ============================================================
   1. REMOVE 162B CARD-SWIPE IMPLEMENTATION
   ============================================================ */

const oldCardMarker=
 src.indexOf(
  '/* PATCH_162B_CARD_SWIPE'
 );


if(oldCardMarker>=0){

 const layoutFunction=
  src.indexOf(
   'export default function TabsLayout',
   oldCardMarker
  );


 if(layoutFunction<0){
  stop(
   'Could not isolate old 162B block.'
  );
 }


 src=
  src.slice(
   0,
   oldCardMarker
  )+
  src.slice(
   layoutFunction
  );


 console.log(
  '✓ Old 162B simulated card swipe removed'
 );

}else{

 console.log(
  '✓ No old 162B component block remains'
 );
}


/* ============================================================
   2. REMOVE 162B-ONLY IMPORTS
   ============================================================ */

src=
 src.replace(
  /import\s*\{[^;]*\}\s*from\s*['"]react-native-gesture-handler['"]\s*;\s*/g,
  ''
 );


src=
 src.replace(
  /import\s+Animated\s*,\s*\{[^;]*\}\s*from\s*['"]react-native-reanimated['"]\s*;\s*/g,
  ''
 );


/*
 * ReactNode was introduced only for SwipeCardLayer.
 */
src=
 src.replace(
  /import\s+type\s*\{\s*ReactNode\s*\}\s*from\s*'react';\s*/g,
  ''
 );


src=
 src.replace(
  /\btype ReactNode\s*,?\s*/g,
  ''
 );


/* ============================================================
   3. NORMALIZE EXPO ROUTER IMPORT
   ============================================================ */

/*
 * ROBUST EXPO ROUTER IMPORT
 *
 * Accepts:
 * - one-line import
 * - multiline import
 * - single quotes
 * - double quotes
 * - extra imported symbols
 */
const expoSourceMatch=
 src.match(
  /from\s*['"]expo-router['"]\s*;?/
 );


if(
 !expoSourceMatch
 ||
 expoSourceMatch.index==null
){
 stop(
  'No import from expo-router exists in current source.'
 );
}


const expoSourceAt=
 expoSourceMatch.index;


const expoImportStart=
 src.lastIndexOf(
  'import',
  expoSourceAt
 );


if(expoImportStart<0){
 stop(
  'Could not locate beginning of expo-router import.'
 );
}


let expoImportEnd=
 src.indexOf(
  ';',
  expoSourceAt
 );


if(expoImportEnd<0){

 expoImportEnd=
  src.indexOf(
   '\n',
   expoSourceAt
  );
}


if(expoImportEnd<0){
 stop(
  'Could not locate end of expo-router import.'
 );
}


src=
 src.slice(
  0,
  expoImportStart
 )+
`import {
  Redirect,
  usePathname,
  withLayoutContext,
} from 'expo-router';`+
 src.slice(
  expoImportEnd+1
 );


console.log(
 '✓ expo-router import normalized'
 );


/* ============================================================
   4. MATERIAL PAGER IMPORT
   SDK 57 Expo Router version
   ============================================================ */

if(
 !src.includes(
  "from 'expo-router/js-top-tabs'"
 )
){

 const expoImportEnd=
  src.indexOf(
   "from 'expo-router';"
  );


 const semicolon=
  src.indexOf(
   ';',
   expoImportEnd
  );


 src=
  src.slice(
   0,
   semicolon+1
  )+
`
import {
  createMaterialTopTabNavigator,
} from 'expo-router/js-top-tabs';
`+
  src.slice(
   semicolon+1
  );
}


/* ============================================================
   5. ENSURE Dimensions
   ============================================================ */

const rnImportRx=
 /import\s*\{([\s\S]*?)\}\s*from\s*'react-native';/;


const rnMatch=
 src.match(
  rnImportRx
 );


if(!rnMatch){
 stop(
  'react-native import not found.'
 );
}


let rnNames=
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
  rnImportRx,
`import {
  ${rnNames.join(',\n  ')},
} from 'react-native';`
 );


/* ============================================================
   6. ENSURE SPONSOR IMPORT
   Preserve existing header sponsor.
   ============================================================ */

if(
 !src.includes(
  "BuklodHeaderSponsor"
 )
){

 const themeImportRx=
  /import\s*\{\s*colors\s*\}\s*from\s*'@\/lib\/theme';/;


 if(
  !themeImportRx.test(src)
 ){
  stop(
   'colors import anchor not found.'
  );
 }


 src=
  src.replace(
   themeImportRx,
`import { colors } from '@/lib/theme';
import { BuklodHeaderSponsor } from '@/components/BuklodHeaderSponsor';`
  );
}


/* ============================================================
   7. INSTALL REAL SWIPE NAVIGATOR
   ============================================================ */

const layoutAnchor=
 'export default function TabsLayout()';


if(
 !src.includes(
  'PATCH_162C_NATIVE_PAGER'
 )
){

 const pagerCode=
`
/* PATCH_162C_NATIVE_PAGER
 *
 * Native pager:
 * the dashboard position follows the finger continuously.
 */
const MaterialPager=
  createMaterialTopTabNavigator();


const SwipeTabs=
  withLayoutContext(
    MaterialPager.Navigator as any,
    undefined,
    true
  ) as any;


function SwipeDashboardHeader(){

  const pathname=
    usePathname();

  const insets=
    useSafeAreaInsets();


  let title='BUKLOD';

  let placement:
    | 'home'
    | 'messages'
    | 'learn'
    | 'community'
    | null
    =null;


  if(
    pathname==='/home'
    ||
    pathname.startsWith('/home/')
  ){
    title='Home';
    placement='home';
  }
  else if(
    pathname==='/messages'
    ||
    pathname.startsWith('/messages/')
  ){
    title='Messages';
    placement='messages';
  }
  else if(
    pathname==='/learn'
    ||
    pathname.startsWith('/learn/')
  ){
    title='Learn';
    placement='learn';
  }
  else if(
    pathname==='/buklod'
    ||
    pathname.startsWith('/buklod/')
  ){
    title='BUKLOD';
    placement='community';
  }
  else if(
    pathname==='/prayer'
    ||
    pathname.startsWith('/prayer/')
  ){
    title='Prayer';
  }
  else if(
    pathname==='/me'
    ||
    pathname.startsWith('/me/')
  ){
    title='Me';
  }


  return(
    <View
      style={{
        paddingTop:
          insets.top,
        minHeight:
          54+
          insets.top,
        backgroundColor:
          colors.greenDark,
        flexDirection:
          'row',
        alignItems:
          'center',
        justifyContent:
          'space-between',
        paddingLeft:
          16,
      }}
    >

      <Text
        numberOfLines={1}
        style={{
          flex:1,
          color:
            colors.white,
          fontSize:
            20,
          fontWeight:
            '900',
        }}
      >
        {title}
      </Text>


      {placement
        ? (
          <BuklodHeaderSponsor
            placement={
              placement
            }
          />
        )
        : (
          <View
            style={{
              width:12,
            }}
          />
        )
      }

    </View>
  );
}


`;


 src=
  src.replace(
   layoutAnchor,
   pagerCode+
   layoutAnchor
  );
}


/* ============================================================
   8. REMOVE screenLayout FROM OLD TABS
   ============================================================ */

src=
 src.replace(
  /\s*screenLayout=\{\(\{children\}\)\s*=>\s*\(\s*<SwipeCardLayer>[\s\S]*?<\/SwipeCardLayer>\s*\)\}/g,
  ''
 );


/* ============================================================
   9. CHANGE Tabs TO SwipeTabs
   ============================================================ */

src=
 src.replace(
  /<Tabs(?=\s|>)/g,
  '<SwipeTabs'
 );


src=
 src.replace(
  /<\/Tabs>/g,
  '</SwipeTabs>'
 );


src=
 src.replace(
  /<Tabs\.Screen/g,
  '<SwipeTabs.Screen'
 );


/* ============================================================
   10. REMOVE HIDDEN href:null SCREENS
   Material pager only gets visible dashboards.
   ============================================================ */

src=
 src.replace(
  /\s*<SwipeTabs\.Screen[\s\S]*?options=\{\{\s*href:\s*null\s*\}\}[\s\S]*?\/>/g,
  ''
 );


/* ============================================================
   11. REMOVE OLD HEADER OPTIONS
   Header is now SwipeDashboardHeader.
   ============================================================ */

src=
 src.replace(
  /\s*headerStyle:\s*\{[\s\S]*?\},/g,
  ''
 );


src=
 src.replace(
  /\s*headerTintColor:\s*[^,\n]+,/g,
  ''
 );


src=
 src.replace(
  /\s*headerTitleStyle:\s*\{[\s\S]*?\},/g,
  ''
 );


src=
 src.replace(
  /\s*headerShadowVisible:\s*(true|false),/g,
  ''
 );


/*
 * Individual sponsor headerRight entries
 * are replaced by the persistent pager header.
 */
src=
 src.replace(
  /\s*headerRight:\s*\(\)\s*=>\s*<BuklodHeaderSponsor\s+placement="[^"]+"\s*\/>\s*,?/g,
  ''
 );


/* ============================================================
   12. CONFIGURE TRUE NATIVE PAGER
   ============================================================ */

const swipeOpenRx=
 /<SwipeTabs\s+screenOptions=\{\{/;


if(
 swipeOpenRx.test(src)
){

 src=
  src.replace(
   swipeOpenRx,
`<SwipeTabs
      tabBarPosition="bottom"
      swipeEnabled={true}
      lazy={false}
      keyboardDismissMode="on-drag"
      initialLayout={{
        width:
          Dimensions
            .get('window')
            .width,
      }}
      screenOptions={{`
  );

}else if(
 !src.includes(
  'tabBarPosition="bottom"'
 )
){

 stop(
  'SwipeTabs opening anchor not found.'
 );
}


/* ============================================================
   13. MATERIAL-TAB FRIENDLY OPTIONS
   ============================================================ */

const screenOptionsAt=
 src.indexOf(
  'screenOptions={{'
 );


if(screenOptionsAt<0){
 stop(
  'screenOptions not found.'
 );
}


const screenOptionsEnd=
 src.indexOf(
  '}}>',
  screenOptionsAt
 );


if(screenOptionsEnd<0){
 stop(
  'screenOptions closing not found.'
 );
}


let optionsBlock=
 src.slice(
  screenOptionsAt,
  screenOptionsEnd
 );


if(
 !optionsBlock.includes(
  'tabBarIndicatorStyle'
 )
){

 optionsBlock=
  optionsBlock.replace(
   'screenOptions={{',
`screenOptions={{
        tabBarIndicatorStyle: {
          backgroundColor:
            colors.green,
          height:3,
        },`
  );


 src=
  src.slice(
   0,
   screenOptionsAt
  )+
  optionsBlock+
  src.slice(
   screenOptionsEnd
  );
}


/* ============================================================
   14. WRAP PAGER WITH PERSISTENT HEADER
   STRUCTURAL VERSION - PATCH 162C-3
   ============================================================ */

/*
 * Do NOT try to parse the whole return(...) block.
 *
 * Simply locate the actual SwipeTabs JSX and wrap that node.
 * This survives:
 * - different indentation
 * - comments
 * - multiline props
 * - an existing outer View
 * - formatting changes
 */

if(
 !src.includes(
  '<SwipeDashboardHeader />'
 )
){

 const navigatorStart=
  src.indexOf(
   '<SwipeTabs'
  );


 if(navigatorStart<0){
  stop(
   'Structural wrapper: <SwipeTabs not found.'
  );
 }


 const navigatorClose=
  '</SwipeTabs>';


 const navigatorCloseAt=
  src.indexOf(
   navigatorClose,
   navigatorStart
  );


 if(navigatorCloseAt<0){
  stop(
   'Structural wrapper: </SwipeTabs> not found.'
  );
 }


 const navigatorEnd=
  navigatorCloseAt+
  navigatorClose.length;


 /*
  * Insert closing wrapper FIRST so indexes
  * calculated above remain valid.
  */
 src=
  src.slice(
   0,
   navigatorEnd
  )+
`
    </View>`+
  src.slice(
   navigatorEnd
  );


 /*
  * Then insert opening wrapper + header
  * immediately before SwipeTabs.
  */
 src=
  src.slice(
   0,
   navigatorStart
  )+
`<View
      style={{
        flex:1,
        backgroundColor:
          colors.white,
      }}
    >

      <SwipeDashboardHeader />

      `+
  src.slice(
   navigatorStart
  );


 console.log(
  '✓ SwipeTabs structurally wrapped with persistent header'
 );
}
else{

 console.log(
  '✓ Persistent SwipeDashboardHeader already present'
 );
}

/* ============================================================
   15. FINAL VERIFY
   ============================================================ */

const required=[
  'PATCH_162C_NATIVE_PAGER',
  "createMaterialTopTabNavigator",
  'tabBarPosition="bottom"',
  'swipeEnabled={true}',
  'lazy={false}',
  '<SwipeDashboardHeader />',
  'SwipeTabs.Screen',
];


for(
 const value of required
){
 if(
  !src.includes(value)
 ){
  stop(
   'Missing final pager feature: '+
   value
  );
 }
}


if(
 src.includes(
  'SwipeCardLayer'
 )
){
 stop(
  'Old SwipeCardLayer still remains.'
 );
}


if(
 src.includes(
  "animation: 'shift'"
 )
){
 stop(
  'Old timed shift still remains.'
 );
}


if(
 src.includes(
  'Gesture.Pan'
 )
){
 stop(
  'Old simulated Pan gesture still remains.'
 );
}


fs.writeFileSync(
 path,
 src,
 'utf8'
 );


console.log('');
console.log(
 'PATCH 162C SOURCE APPLIED'
);

console.log(
 '✓ REAL native pager installed'
);

console.log(
 '✓ Dashboard follows finger continuously'
);

console.log(
 '✓ Adjacent dashboard rendered during drag'
);

console.log(
 '✓ Bottom navigation preserved'
);

console.log(
 '✓ Old flick-only 162B removed'
);

console.log(
 '✓ Header sponsor preserved'
);

console.log(
 '✓ No artificial 140/300ms delay'
);
