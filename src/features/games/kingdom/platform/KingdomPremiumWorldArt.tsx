/**
 * Original BUKLOD 39-scene illustrated world layer: shipped entirely as
 * vector paths and local gradients, with NO remote image/CDN calls, licensing
 * dependency, AI runtime, new package, generated currency or duplicate game.
 *
 * The existing native cinematic scene remains responsible for animated
 * character movement and performance-aware gameplay feedback.
 */
import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, G, Path, Circle, Ellipse, Rect } from 'react-native-svg';

const PALETTE = {
  "coast": {
    "sky": "#89d9ed",
    "light": "#f9d69d",
    "hill": "#639d78",
    "deep": "#1e5b66",
    "ground": "#2d7166",
    "water": "#418cad"
  },
  "jungle": {
    "sky": "#b0d8b5",
    "light": "#ffdda1",
    "hill": "#578d65",
    "deep": "#164d43",
    "ground": "#245a3e",
    "water": "#3e8b8a"
  },
  "city": {
    "sky": "#a7cde2",
    "light": "#f4ca88",
    "hill": "#728b86",
    "deep": "#2b5365",
    "ground": "#385d63",
    "water": "#4b7d9b"
  },
  "civic": {
    "sky": "#a7bddb",
    "light": "#ffe0a6",
    "hill": "#8d9893",
    "deep": "#484b65",
    "ground": "#626956",
    "water": "#608aa0"
  },
  "forest": {
    "sky": "#9fcbbb",
    "light": "#f6d29e",
    "hill": "#5f936b",
    "deep": "#24533e",
    "ground": "#376e45",
    "water": "#4c938f"
  },
  "winter": {
    "sky": "#b9d6e9",
    "light": "#fff3c5",
    "hill": "#9ab3c6",
    "deep": "#49677c",
    "ground": "#6d91a2",
    "water": "#86bac6"
  },
  "village": {
    "sky": "#c1d3bf",
    "light": "#f6d6a7",
    "hill": "#718e6e",
    "deep": "#476151",
    "ground": "#547b60",
    "water": "#6998a5"
  }
} as const;
export const KINGDOM_ILLUSTRATED_ART = {
  'phan-enterprise-builder': {biome:'coast',motif:'dock',mission:'Build a living harbor',seed:1,path:"M10 78 L110 78 L110 88 L10 88Z M22 78 L22 107 M54 78 L54 107 M89 78 L89 107 M74 74 L74 19 L92 19 L92 25 L80 25 L80 74Z M14 64 L55 64 L45 73 L22 73Z",detail:"M60 30 L104 30 L104 36 L60 36Z M92 34 L92 56 L98 56 L98 34 M17 62 L33 41 L33 62Z"},
  'phan-trade-master': {biome:'coast',motif:'balance',mission:'Negotiate honest routes',seed:2,path:"M57 16 L63 16 L63 96 L80 96 L85 105 L35 105 L42 96 L57 96Z M18 41 L101 41 L101 46 L18 46Z",detail:"M27 46 L17 76 Q27 87 42 76 L32 46 M86 46 L76 76 Q86 87 102 76 L91 46 M48 17 Q60 3 72 17 Q60 29 48 17"},
  'phan-market-match': {biome:'coast',motif:'market',mission:'Fill village market orders',seed:3,path:"M15 41 L105 41 L111 55 L8 55Z M23 55 L23 99 M96 55 L96 99 M15 96 L105 96 L105 103 L15 103Z",detail:"M16 40 L24 28 L100 28 L108 40 M31 70 Q40 59 49 70 L49 91 L31 91Z M61 69 Q78 56 94 69 L94 91 L61 91Z"},
  'quin-discovery-expedition': {biome:'jungle',motif:'portal',mission:'Explore lost ruins',seed:4,path:"M12 105 L21 45 Q62 -16 107 45 L112 105 L91 105 L91 52 Q61 12 36 52 L36 105Z",detail:"M40 82 Q58 54 86 82 M56 57 L65 34 L74 57 M18 30 L29 21 L37 29"},
  'quin-guessing-quest': {biome:'jungle',motif:'telescope',mission:'Search for evidence',seed:5,path:"M23 51 L95 22 L105 42 L32 68Z M55 58 L68 85 L58 85 L47 61 M68 83 L53 107 M68 83 L84 107",detail:"M21 46 L33 73 M92 23 L104 45 M59 37 L65 54"},
  'quin-code-breaker': {biome:'jungle',motif:'runes',mission:'Open the ancient cipher',seed:6,path:"M18 24 L102 24 L111 104 L9 104Z M29 32 L90 32 L94 96 L25 96Z",detail:"M40 48 L69 42 L62 68 L82 75 M38 78 L46 61 L56 83 M72 40 L85 55"},
  'van-living-city-dispatch': {biome:'city',motif:'road',mission:'Guide the city transport',seed:7,path:"M15 96 L52 22 L82 22 L111 96Z M44 102 L57 74 L72 74 L86 102Z",detail:"M60 80 L60 95 M60 45 L60 65 M22 24 L22 62 L28 62 L28 24Z M92 24 L92 62 L98 62 L98 24Z"},
  'van-sudoku-master': {biome:'city',motif:'tablet',mission:'Restore the number tower',seed:8,path:"M21 12 L98 12 L107 104 L13 104Z M30 25 L90 25 L94 93 L26 93Z",detail:"M49 27 L49 91 M70 27 L70 91 M27 49 L93 49 M27 71 L93 71"},
  'van-mind-challenge': {biome:'city',motif:'gears',mission:'Solve the civic machine',seed:9,path:"M60 20 L74 29 L90 24 L96 40 L105 49 L97 64 L102 80 L86 90 L72 85 L60 99 L47 84 L30 89 L20 72 L25 56 L18 43 L35 32 L47 37Z",detail:"M42 58 A18 18 0 1 0 78 58 A18 18 0 1 0 42 58 M60 40 L60 77 M42 58 L78 58"},
  'christian-civic-leadership': {biome:'civic',motif:'council',mission:'Unite the council',seed:10,path:"M20 34 L60 13 L100 34Z M22 91 L98 91 L106 105 L14 105Z M29 39 L42 39 L42 91 L29 91Z M54 39 L67 39 L67 91 L54 91Z M80 39 L93 39 L93 91 L80 91Z",detail:"M18 34 L102 34 L102 41 L18 41 M23 84 L97 84"},
  'christian-bible-crown': {biome:'civic',motif:'crown',mission:'Study the radiant book',seed:11,path:"M22 67 L16 28 L42 48 L60 14 L77 48 L103 28 L98 67Z M22 74 L98 74 L98 87 L22 87Z",detail:"M17 91 Q60 83 103 91 M44 54 L60 61 L76 54 M60 6 L60 15"},
  'christian-scripture-word-search': {biome:'civic',motif:'scroll',mission:'Trace the ancient scroll',seed:12,path:"M27 19 L91 19 Q105 20 105 36 L105 88 L26 88 Q13 87 13 73 L13 31 Q14 20 27 19Z",detail:"M31 37 L88 37 M31 49 L81 49 M31 62 L88 62 M31 74 L72 74 M23 23 Q29 31 23 39"},
  'lhen-rhythm-journey': {biome:'forest',motif:'marimba',mission:'Cross the rhythm sanctuary',seed:13,path:"M11 67 L103 42 L108 53 L17 78Z M22 83 L105 58 L110 68 L25 93Z",detail:"M30 86 L30 106 M90 63 L90 106 M19 40 L39 31 L46 38 M73 29 L92 20 L99 27"},
  'lhen-melody-memory': {biome:'forest',motif:'chimes',mission:'Remember the mountain melody',seed:14,path:"M13 29 L106 29 L106 34 L13 34Z M23 35 L23 83 M40 35 L40 92 M59 35 L59 75 M78 35 L78 99 M96 35 L96 83",detail:"M16 98 L60 72 L103 98 M19 21 L35 18 L39 23"},
  'lhen-beat-composer': {biome:'forest',motif:'drums',mission:'Compose the village rhythm',seed:15,path:"M21 62 Q39 44 58 62 L58 95 Q39 107 21 95Z M67 46 Q88 30 106 46 L106 84 Q89 99 67 84Z",detail:"M21 62 Q40 72 58 62 M67 46 Q85 57 106 46 M40 20 L80 65 M78 20 L46 59"},
  'jawo-forest-trail': {biome:'jungle',motif:'runner',mission:'Navigate the forest trail',seed:16,path:"M20 92 Q29 46 60 42 Q90 42 101 17 M16 104 Q63 89 108 101Z",detail:"M45 35 L60 25 L70 42 L57 58 L48 86 M70 42 L87 61 M59 55 L78 89"},
  'jawo-trail-maze': {biome:'jungle',motif:'maze',mission:'Find the woodland route',seed:17,path:"M9 100 L9 20 L111 20 L111 99 L92 99 L92 47 L69 47 L69 79 L45 79 L45 45 L29 45 L29 99Z",detail:"M29 89 L45 89 M69 26 L69 37 M92 75 L111 75"},
  'jawo-nature-match': {biome:'jungle',motif:'wildlife',mission:'Restore the natural habitat',seed:18,path:"M30 98 Q12 69 32 49 Q47 37 64 45 Q75 20 95 42 Q109 69 85 90Z",detail:"M18 90 Q43 63 71 92 M76 39 L89 18 M59 55 L43 25 M88 77 Q103 61 109 76"},
  'trudice-playground-memory': {biome:'forest',motif:'treehouse',mission:'Explore the wonder forest',seed:19,path:"M34 44 L60 18 L91 44 L91 84 L34 84Z M15 85 L111 85 L111 94 L15 94Z",detail:"M47 55 L61 55 L61 83 M72 52 L84 52 L84 70 L72 70Z M60 84 L60 110"},
  'trudice-picture-pairs': {biome:'forest',motif:'pictures',mission:'Find hidden nature pairs',seed:20,path:"M13 17 L54 17 L54 85 L13 85Z M66 28 L108 28 L108 98 L66 98Z",detail:"M22 70 Q35 34 47 70Z M74 80 Q84 49 100 80Z M21 25 L45 25 M73 36 L99 36"},
  'trudice-word-garden': {biome:'forest',motif:'garden',mission:'Grow the living word garden',seed:21,path:"M14 92 Q31 42 51 92 Q68 28 99 90 L109 106 L8 106Z",detail:"M40 72 Q37 35 57 20 M58 78 Q70 44 80 31 M54 41 Q36 35 28 43 M76 53 Q93 45 97 60"},
  'ace-rescue-grid': {biome:'winter',motif:'rescue',mission:'Deliver emergency aid',seed:22,path:"M9 74 L23 40 L89 40 L110 74 L106 94 L13 94Z M26 94 L26 108 M92 94 L92 108",detail:"M47 45 L70 45 L70 58 L83 58 L83 68 L70 68 L70 81 L47 81 L47 68 L35 68 L35 58 L47 58Z"},
  'ace-chess-master': {biome:'winter',motif:'knight',mission:'Master the royal strategy',seed:23,path:"M35 101 Q43 76 43 65 L31 47 L54 19 L78 33 L93 50 L80 60 L77 78 L91 100Z",detail:"M47 37 L52 44 M32 107 L96 107 M65 48 L82 52"},
  'ace-tower-tactics': {biome:'winter',motif:'towers',mission:'Protect the winter frontier',seed:24,path:"M13 105 L13 42 L21 42 L21 31 L35 31 L35 42 L44 42 L44 105Z M73 105 L73 31 L83 31 L83 19 L97 19 L97 31 L107 31 L107 105Z",detail:"M22 67 L35 67 M83 54 L96 54 M50 90 L68 90"},
  'mitch-restore-mural': {biome:'village',motif:'mural',mission:'Restore the historic mural',seed:25,path:"M17 18 L104 18 L104 104 L17 104Z M26 86 Q48 30 89 83Z",detail:"M35 36 Q51 53 74 33 M52 89 Q78 58 96 65 M7 102 L23 57"},
  'mitch-block-forge': {biome:'village',motif:'forge',mission:'Shape the artisan\'s craft',seed:26,path:"M19 82 L76 82 L91 94 L81 106 L13 106Z M35 68 L53 54 L88 54 L88 65 L48 65Z",detail:"M28 27 L40 11 L47 39 L64 16 L65 57 M49 78 L74 78"},
  'mitch-color-merge': {biome:'village',motif:'crystals',mission:'Refine the luminous minerals',seed:27,path:"M9 73 L29 25 L50 56 L71 18 L99 51 L111 83 L83 104 L32 104Z",detail:"M29 25 L40 78 L50 56 L83 104 M71 18 L82 68 L99 51 M40 78 L9 73"},
  'niel-mission-trail': {biome:'winter',motif:'camp',mission:'Secure the mountain mission',seed:28,path:"M10 103 L58 28 L106 103Z M58 28 L58 103",detail:"M28 99 L57 47 L89 99 M85 30 L109 19 M87 35 L107 31"},
  'niel-expedition-puzzle': {biome:'winter',motif:'steps',mission:'Cross the ancient sky path',seed:29,path:"M15 100 L45 86 L71 94 L105 69 M17 65 L38 50 L63 59 L96 40",detail:"M21 97 L21 84 L45 72 L45 84 M72 90 L72 73 L99 55"},
  'niel-word-explorer': {biome:'winter',motif:'compass',mission:'Decode the expedition clues',seed:30,path:"M59 15 A43 43 0 1 0 60 101 A43 43 0 1 0 59 15Z",detail:"M59 23 L69 61 L59 95 L49 61Z M19 61 L98 61"},
  'angel-kingdom-treasury': {biome:'civic',motif:'vault',mission:'Guard the royal treasury',seed:31,path:"M17 22 L100 22 L108 106 L10 106Z M37 38 L82 38 L82 89 L37 89Z",detail:"M60 49 A14 14 0 1 0 60 77 A14 14 0 1 0 60 49 M60 51 L60 75 M48 63 L72 63"},
  'angel-number-vault': {biome:'civic',motif:'lock',mission:'Unlock the mechanical vault',seed:32,path:"M15 24 L105 24 L105 103 L15 103Z M61 41 A31 31 0 1 0 61 103 A31 31 0 1 0 61 41Z",detail:"M60 45 L60 99 M39 68 L83 68 M60 68 L79 54"},
  'angel-treasure-merge': {biome:'civic',motif:'gems',mission:'Restore the royal relics',seed:33,path:"M14 67 L37 25 L64 47 L86 15 L110 71 L86 102 L49 104Z",detail:"M37 25 L44 79 L64 47 L86 102 M86 15 L79 78 L110 71"},
  'vhen-farm-to-market': {biome:'coast',motif:'terraces',mission:'Grow the coastal farm',seed:34,path:"M8 97 Q37 84 53 93 Q76 69 112 75 L112 107 L8 107Z",detail:"M13 77 Q37 58 51 67 Q83 44 109 56 M18 91 L42 91 L42 100 M67 83 L91 83"},
  'vhen-harvest-match': {biome:'coast',motif:'orchard',mission:'Harvest the tropical orchard',seed:35,path:"M60 15 L59 107 M18 61 Q12 22 51 28 Q64 4 84 27 Q116 32 101 72Z",detail:"M38 54 L43 54 M73 46 L78 46 M88 61 L93 61"},
  'vhen-farm-merge': {biome:'coast',motif:'granary',mission:'Build the farm supply chain',seed:36,path:"M17 48 L64 20 L109 48 L109 103 L17 103Z",detail:"M27 56 L98 56 M46 63 L46 101 M76 63 L76 101 M16 103 L110 103"},
  'elesur-village-builder': {biome:'village',motif:'house',mission:'Construct the first village',seed:37,path:"M16 56 L59 20 L108 56 L108 106 L16 106Z M48 73 L74 73 L74 106 L48 106Z",detail:"M24 58 L59 31 L100 58 M83 68 L101 68 L101 82 L83 82"},
  'elesur-domino-village': {biome:'village',motif:'stonepath',mission:'Connect the village paths',seed:38,path:"M11 93 L35 73 L58 85 L80 58 L108 78 L114 101 L9 109Z",detail:"M33 73 L38 95 M58 85 L69 103 M80 58 L84 91"},
  'elesur-bridge-puzzle': {biome:'village',motif:'bridge',mission:'Bridge the canyon',seed:39,path:"M10 42 Q61 96 113 42 M10 47 L10 110 M113 47 L113 110",detail:"M10 48 L113 48 M28 54 L28 80 M43 59 L43 86 M59 62 L59 90 M77 58 L77 85 M95 53 L95 78"},
} as const;

export type KingdomIllustratedGameId = keyof typeof KINGDOM_ILLUSTRATED_ART;
export function getKingdomIllustratedArt(gameId:string){
  return Object.prototype.hasOwnProperty.call(KINGDOM_ILLUSTRATED_ART,gameId)
    ? KINGDOM_ILLUSTRATED_ART[gameId as KingdomIllustratedGameId] : null;
}
type Props={ gameId:string; opacity?:number };
function KingdomPremiumWorldArt({gameId,opacity=0.68}:Props) {
  const scene=getKingdomIllustratedArt(gameId);
  if(!scene)return null;
  const p=PALETTE[scene.biome];
  const winter=scene.biome==='winter';
  const coastal=scene.biome==='coast';
  const city=scene.biome==='city'||scene.biome==='civic';
  const shift=scene.seed%4;
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill,{opacity}]}>
    <Svg width="100%" height="100%" viewBox="0 0 360 158" preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id="s" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0" stopColor={p.sky}/>
          <Stop offset="1" stopColor={p.light}/>
        </LinearGradient>
        <LinearGradient id="g" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0" stopColor={p.hill}/>
          <Stop offset="1" stopColor={p.deep}/>
        </LinearGradient>
      </Defs>
      <Rect width="360" height="158" fill="url(#s)"/>
      <Circle cx={270-shift*16} cy={30+shift*2} r={19} fill={p.light} opacity={.85}/>
      <Ellipse cx="274" cy="31" rx="45" ry="27" fill={p.light} opacity={.13}/>
      <Path d="M0 82 L39 36 L80 77 L116 42 L166 93 L208 51 L249 84 L289 38 L360 83 L360 143 L0 143Z"
        fill={winter?'#e5f0ee':p.hill} opacity={.8}/>
      <Path d="M0 102 Q44 61 93 101 Q137 48 188 97 Q237 52 296 92 Q331 71 360 88 L360 158 L0 158Z"
        fill="url(#g)"/>
      <Path d="M0 123 Q53 104 112 126 Q175 101 233 121 Q290 94 360 122 L360 158 L0 158Z"
        fill={p.ground}/>
      <Path d="M0 148 Q96 124 183 147 Q264 124 360 148 L360 158 L0 158Z"
        fill={p.deep} opacity={.5}/>
      {coastal ? <Path d="M0 127 Q60 112 127 128 Q205 114 360 126 L360 158 L0 158Z"
        fill={p.water} opacity={.62}/> : null}
      <Path d="M0 148 Q49 134 94 146 Q158 126 202 149 Q260 136 360 141"
        stroke={p.light} strokeWidth={2} fill="none" opacity={.4}/>
      <Path d="M0 127 Q26 101 48 119 Q76 98 103 121 M248 119 Q274 89 296 113 Q326 93 360 115"
        stroke={p.deep} strokeWidth={6} fill="none" opacity={.6}/>
      {!city?<>
        <Path d="M12 122 L23 66 L36 122Z M27 113 L40 76 L53 117Z M310 119 L325 64 L339 119Z M336 128 L346 81 L359 129Z"
          fill={winter?'#b4d4d3':'#174f3f'} opacity={.88}/>
        <Path d="M7 100 L23 63 L39 102 M301 100 L326 62 L352 104" stroke={winter?'#d9eef1':'#316b4c'} strokeWidth={4} fill="none"/>
      </>:<>
        <Path d="M0 118 L0 66 L15 66 L15 113 M27 120 L27 48 L51 48 L51 114 M286 110 L286 55 L314 55 L314 118 M327 120 L327 70 L348 70 L348 122"
         fill="none" stroke={p.deep} strokeWidth={9} opacity={.57}/>
      </>}
      <G transform="translate(117 27) scale(0.91)">
        <Ellipse cx="62" cy="108" rx="68" ry="10" fill={p.deep} opacity={.32}/>
        <Path d={scene.path} fill={p.light} stroke={p.deep} strokeWidth={3.3} strokeLinejoin="round"/>
        <Path d={scene.detail} stroke={p.deep} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        <Path d={scene.detail} stroke="#fff5da" strokeWidth={1} fill="none" strokeLinecap="round" opacity={.8}/>
      </G>
      <Path d="M0 140 Q35 132 60 145 Q78 132 111 144 M249 142 Q301 129 360 146"
        stroke={p.light} strokeWidth={1.5} opacity={.55} fill="none"/>
    </Svg>
  </View>;
}
export default memo(KingdomPremiumWorldArt);
