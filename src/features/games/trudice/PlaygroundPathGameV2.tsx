import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle, Defs, Ellipse, G, LinearGradient as SvgGradient, Path, Rect, Stop,
} from 'react-native-svg';
import { SPECIAL_CHARACTER_HERO } from '@/lib/buklodSpecialCharacterAssets';
import { useBuklodGameLanguage } from '../runtime/BuklodGameLanguage';
import { playBuklodGameFeedback } from '../runtime/BuklodGameFeedback';
import type { BuklodGameResult } from '../types';
import {
  buildWonderChallenge, checkWonderStep, WONDER_STARTING_HEARTS, WONDER_TOTAL_ROUNDS,
  type WonderStation,
} from './wonderPathRules';

type Phase = 'ready' | 'watch' | 'input' | 'retry' | 'round-clear' | 'won' | 'lost';
type Station = { id: WonderStation; name: string; nameTl: string; short: string; icon: string; accent: string };
const GAME_ID = 'trudice-playground-memory';
const STATIONS: readonly Station[] = [
  { id: 0, name: 'Story Tree', nameTl: 'Puno ng Kuwento', short: 'STORY', icon: '📖', accent: '#ffdb80' },
  { id: 1, name: 'Sky Slide', nameTl: 'Sky Slide', short: 'SLIDE', icon: '🌈', accent: '#a1eaff' },
  { id: 2, name: 'Hop Garden', nameTl: 'Hop Garden', short: 'GARDEN', icon: '🌷', accent: '#aef4ad' },
  { id: 3, name: 'Wonder Wheel', nameTl: 'Wonder Wheel', short: 'WHEEL', icon: '🎡', accent: '#ffc2e4' },
];
const GARDEN_AREAS = [
  ['Lantern Trail', 'Landas ng mga Ilaw'],
  ['Firefly Glade', 'Liwang ng Alitaptap'],
  ['Rainbow Bridge', 'Tulay ng Bahaghari'],
  ['Mirror Garden', 'Salaming Hardin'],
  ['Star Sanctuary', 'Tahanan ng mga Bituin'],
] as const;
const starsForRun = (mistakes: number): 1 | 2 | 3 =>
  mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1;
type Props = { onFinish?: (result: BuklodGameResult) => void };

export function PlaygroundPathGameV2({ onFinish }: Props) {
  const { t } = useBuklodGameLanguage();
  const [phase, setPhase] = useState<Phase>('ready');
  const phaseRef = useRef<Phase>('ready');
  const [round, setRound] = useState(1);
  const [runSeed, setRunSeed] = useState(() => Date.now() >>> 0);
  const [watchIndex, setWatchIndex] = useState(0);
  const [inputIndex, setInputIndex] = useState(0);
  const [litStation, setLitStation] = useState<WonderStation | null>(null);
  const [heroStation, setHeroStation] = useState<WonderStation | null>(null);
  const [hearts, setHearts] = useState(WONDER_STARTING_HEARTS);
  const [mistakes, setMistakes] = useState(0);
  const [score, setScore] = useState(0);
  const [sceneWidth, setSceneWidth] = useState(360);
  const [message, setMessage] = useState('');
  const challenge = useMemo(() => buildWonderChallenge(round, runSeed), [round, runSeed]);
  const cleared = phase === 'won' ? WONDER_TOTAL_ROUNDS : round - 1;
  const finishingRef = useRef(false);
  const lockedRef = useRef(false);
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const traveler = useRef(new Animated.ValueXY()).current;
  const flash = useRef(new Animated.Value(0)).current;
  const celebrate = useRef(new Animated.Value(0)).current;
  const changePhase = useCallback((next: Phase) => { phaseRef.current = next; setPhase(next); }, []);

  const schedule = useCallback((fn: () => void, delay: number) => {
    const handle = setTimeout(() => {
      timersRef.current = timersRef.current.filter(item => item !== handle);
      fn();
    }, delay);
    timersRef.current.push(handle);
  }, []);
  const cancelPending = useCallback(() => {
    for (const timer of timersRef.current) clearTimeout(timer);
    timersRef.current = [];
  }, []);
  useEffect(() => () => {
    cancelPending();
    traveler.stopAnimation();
    flash.stopAnimation();
    celebrate.stopAnimation();
  }, [cancelPending, traveler, flash, celebrate]);

  useEffect(() => {
    const station = litStation ?? heroStation;
    if (station === null) return;
    const side = Math.max(60, sceneWidth / 2 - 78);
    const positions = [
      { x: 0, y: -124 }, { x: side, y: 8 }, { x: 0, y: 139 }, { x: -side, y: 8 },
    ];
    Animated.spring(traveler, {
      toValue: positions[station], speed: 16, bounciness: 4, useNativeDriver: true,
    }).start();
  }, [heroStation, litStation, sceneWidth, traveler]);

  const flashError = useCallback(() => {
    flash.stopAnimation();
    flash.setValue(0.48);
    Animated.timing(flash, { toValue: 0, duration: 450, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [flash]);
  const celebrateRound = useCallback(() => {
    celebrate.setValue(0);
    Animated.sequence([
      Animated.timing(celebrate, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(celebrate, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, [celebrate]);

  const finishGame = useCallback((finalScore: number, finalMistakes: number, won: boolean) => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    const stars = won ? starsForRun(finalMistakes) : 0;
    changePhase(won ? 'won' : 'lost');
    if (won) celebrateRound();
    void playBuklodGameFeedback(won ? 'success' : 'failure');
    onFinish?.({
      gameId: GAME_ID, status: won ? 'won' : 'lost', score: finalScore, stars,
      // Original station preview rewards only. Server Mastery separately controls real BP.
      reward: won
        ? { xp: 125 + stars * 40, kingdomXp: 55 + stars * 20,
            collectibleKey: stars === 3 ? 'trudice-bright-memory-star' : undefined }
        : { xp: 20, kingdomXp: 5 },
    });
  }, [onFinish, changePhase, celebrateRound]);

  useEffect(() => {
    if (phase !== 'watch') return undefined;
    if (watchIndex >= challenge.cues.length) {
      const ready = setTimeout(() => {
        setLitStation(null);
        setInputIndex(0);
        changePhase('input');
        setMessage(t(challenge.instructionsEn, challenge.instructionsTl));
      }, 580);
      return () => clearTimeout(ready);
    }
    const cue = challenge.cues[watchIndex];
    setLitStation(cue);
    const off = setTimeout(() => setLitStation(null), 490);
    const next = setTimeout(() => setWatchIndex(index => index + 1), 790);
    return () => { clearTimeout(off); clearTimeout(next); };
  }, [phase, watchIndex, challenge, changePhase, t]);

  useEffect(() => {
    if (phase !== 'round-clear') return undefined;
    const next = setTimeout(() => {
      if (round === WONDER_TOTAL_ROUNDS) {
        finishGame(score, mistakes, true);
      } else {
        setRound(value => value + 1);
        setWatchIndex(0);
        setInputIndex(0);
        setLitStation(null);
        lockedRef.current = false;
        changePhase('watch');
        setMessage(t('A new part of the playground has opened. Watch the next challenge.',
          'May bagong bahagi ng playground. Panoorin ang susunod na hamon.'));
      }
    }, 1550);
    return () => clearTimeout(next);
  }, [phase, round, score, mistakes, finishGame, changePhase, t]);

  const restart = useCallback(() => {
    cancelPending();
    finishingRef.current = false;
    lockedRef.current = false;
    setRunSeed(value => (value + 0x9e3779b9) >>> 0);
    setRound(1);
    setWatchIndex(0);
    setInputIndex(0);
    setLitStation(null);
    setHeroStation(null);
    traveler.setValue({ x: 0, y: 0 });
    setHearts(WONDER_STARTING_HEARTS);
    setMistakes(0);
    setScore(0);
    setMessage(t('Watch the magical trail, then complete each different quest.',
      'Panoorin ang mahiwagang landas at kumpletuhin ang bawat hamon.'));
    changePhase('watch');
    void playBuklodGameFeedback('unlock');
  }, [cancelPending, changePhase, t, traveler]);

  const chooseStation = useCallback((station: WonderStation) => {
    if (phaseRef.current !== 'input' || lockedRef.current) return;
    lockedRef.current = true;
    setLitStation(station);
    schedule(() => {
      setLitStation(value => value === station ? null : value);
      lockedRef.current = false;
    }, 260);
    const result = checkWonderStep(challenge, inputIndex, station);
    if (result === 'wrong') {
      const remaining = hearts - 1;
      const nextMistakes = mistakes + 1;
      setHearts(remaining);
      setMistakes(nextMistakes);
      setInputIndex(0);
      flashError();
      void playBuklodGameFeedback('impact');
      setMessage(t('That was not the right path. Watch the challenge again.',
        'Hindi iyon ang tamang ruta. Panoorin muli ang hamon.'));
      if (remaining <= 0) {
        finishGame(score, nextMistakes, false);
        return;
      }
      changePhase('retry');
      schedule(() => {
        if (phaseRef.current !== 'retry') return;
        setLitStation(null);
        setWatchIndex(0);
        lockedRef.current = false;
        changePhase('watch');
      }, 980);
      return;
    }
    setHeroStation(station);
    const nextIndex = inputIndex + 1;
    const nextScore = score + 120 + round * 30;
    setScore(nextScore);
    setInputIndex(nextIndex);
    void playBuklodGameFeedback('collect');
    if (result === 'cleared') {
      setScore(nextScore + 250 + round * 45);
      setMessage(t('The next garden awakens!', 'Nagising ang susunod na hardin!'));
      changePhase('round-clear');
      celebrateRound();
      void playBuklodGameFeedback('unlock');
    } else {
      setMessage(t(`${nextIndex}/${challenge.answer.length} steps restored. Keep going!`,
        `${nextIndex}/${challenge.answer.length} hakbang na ang natapos. Ituloy!`));
    }
  }, [schedule, challenge, inputIndex, hearts, mistakes, score, round, flashError, finishGame, changePhase, celebrateRound, t]);

  const bounce = celebrate.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] });
  const progress = Math.round((cleared / WONDER_TOTAL_ROUNDS) * 100);
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>TRUDICE • CHILDREN’S HAVEN</Text>
        <Text style={styles.title}>WONDER PATH</Text>
        <Text style={styles.chapter}>{t(challenge.titleEn, challenge.titleTl)}</Text>
        <View style={styles.metrics}>
          <Text style={styles.metric}>{t('ROUND', 'ROUND')} {round}/{WONDER_TOTAL_ROUNDS}</Text>
          <Text style={styles.metric}>{t('GAME SCORE', 'SCORE SA LARO')} {score.toLocaleString()}</Text>
          <Text style={styles.metric}>{'♥'.repeat(hearts)}{'♡'.repeat(WONDER_STARTING_HEARTS - hearts)}</Text>
        </View>
        <View style={styles.progress}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
        <View style={styles.gardenRow}>{GARDEN_AREAS.map((area, i) => (
          <View key={area[0]} style={[styles.area, i < cleared && styles.areaRestored, i === round - 1 && styles.areaCurrent]}>
            <Text style={styles.areaText}>{i < cleared ? '✦' : i + 1}</Text>
          </View>
        ))}</View>
      </View>

      <Animated.View style={[styles.scene, { transform: [{ scale: bounce }] }]}
        onLayout={event => {
          const width = event.nativeEvent.layout.width;
          if (width > 0 && Math.abs(width - sceneWidth) > 1) setSceneWidth(width);
        }}>
        <Svg style={StyleSheet.absoluteFill} viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice">
          <Defs>
            <SvgGradient id="trudiceSky" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#29195c" /><Stop offset="0.5" stopColor="#643a91" />
              <Stop offset="1" stopColor="#347c7a" />
            </SvgGradient>
            <SvgGradient id="trudiceTrail" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#ffe9ac" stopOpacity="0.9" />
              <Stop offset="1" stopColor="#eab3ec" stopOpacity="0.38" />
            </SvgGradient>
          </Defs>
          <Rect x="0" y="0" width="400" height="500" fill="url(#trudiceSky)" />
          <Circle cx="315" cy="66" r="42" fill="#f8e1b1" opacity=".24" />
          <Circle cx="315" cy="66" r="25" fill="#fff0c8" opacity=".65" />
          <G fill="#fff0bc" opacity=".75">
            <Circle cx="54" cy="60" r="2"/><Circle cx="94" cy="123" r="2"/>
            <Circle cx="232" cy="39" r="3"/><Circle cx="342" cy="174" r="2"/>
            <Circle cx="42" cy="225" r="3"/><Circle cx="352" cy="335" r="2"/>
          </G>
          <Path d="M-20 295 Q65 223 141 277 Q227 217 316 276 Q368 246 420 273 L420 500 L-20 500Z" fill="#31687c" opacity=".65" />
          <Path d="M-20 348 Q80 280 176 333 Q289 271 420 331 L420 500 L-20 500Z" fill="#245d61" opacity=".96" />
          <Ellipse cx="200" cy="363" rx="185" ry="119" fill="#174958" opacity=".65" />
          <Path d="M200 107 C310 107 365 180 320 265 C320 350 270 427 200 416 C105 421 65 348 76 266 C46 184 100 110 200 107Z"
            fill="none" stroke="url(#trudiceTrail)" strokeWidth="18" opacity=".45" strokeDasharray="19 9" />
          <Path d="M200 107 C310 107 365 180 320 265 C320 350 270 427 200 416 C105 421 65 348 76 266 C46 184 100 110 200 107Z"
            fill="none" stroke="#fff0c0" strokeWidth="2" opacity=".75" />
          <G opacity=".75">
            <Path d="M45 380 L45 283 L81 283 L81 380" fill="none" stroke="#d49de8" strokeWidth="8" strokeLinecap="round"/>
            <Path d="M51 299 L75 299" stroke="#ffdbad" strokeWidth="4"/>
            <Rect x="51" y="352" width="25" height="6" rx="3" fill="#f9e4ba"/>
            <Path d="M319 117 L349 117 L349 176 L319 176Z" fill="#e9a5cd" opacity=".35"/>
            <Circle cx="334" cy="147" r="33" fill="none" stroke="#ffc9ef" strokeWidth="5"/>
            <Path d="M334 114 L334 180 M301 147 L367 147" stroke="#ffc9ef" strokeWidth="4"/>
          </G>
          <G>
            <Rect x="190" y="352" width="18" height="58" rx="8" fill="#674c48"/>
            <Circle cx="199" cy="349" r="37" fill="#4d9b70"/>
            <Circle cx="179" cy="330" r="24" fill="#63bb7b"/>
            <Circle cx="224" cy="337" r="22" fill="#82c78d"/>
          </G>
        </Svg>
        <View style={[styles.restorationGlow, { opacity: 0.08 + cleared * 0.07 }]} pointerEvents="none" />
        {STATIONS.map(station => {
          const lit = station.id === litStation;
          const blocked = station.id === challenge.blocked && phase !== 'ready';
          return <Pressable key={station.id} accessibilityRole="button"
            accessibilityLabel={t(station.name, station.nameTl)}
            accessibilityState={{ disabled: phase !== 'input' }}
            disabled={phase !== 'input'}
            onPress={() => chooseStation(station.id)}
            style={({pressed}) => [
              styles.station,
              station.id === 0 && styles.stationTop,
              station.id === 1 && styles.stationRight,
              station.id === 2 && styles.stationBottom,
              station.id === 3 && styles.stationLeft,
              lit && styles.stationLit,
              blocked && styles.stationBlocked,
              pressed && styles.stationPressed,
            ]}>
            <Text style={styles.stationIcon}>{blocked ? '⛔' : station.icon}</Text>
            <Text style={[styles.stationName, lit && styles.stationNameLit]}>{station.short}</Text>
            <View style={[styles.stationSpark, { backgroundColor: blocked ? '#ff8296' : station.accent, opacity: lit ? 0.95 : 0.38 }]} />
          </Pressable>;
        })}
        <Animated.View pointerEvents="none" style={[styles.hero, { transform: traveler.getTranslateTransform() }]}>
          <Image source={SPECIAL_CHARACTER_HERO.trudice} style={styles.heroImage} resizeMode="cover" />
          <Text style={styles.heroCaption}>TRUDICE</Text>
        </Animated.View>
        {Array.from({ length: cleared }, (_, i) => (
          <View key={i} pointerEvents="none" style={[styles.restoredStar, { left: `${15 + (i % 3) * 31}%`, top: 26 + i * 78 }]}>
            <Text style={styles.restoredStarText}>✦</Text>
          </View>
        ))}
        <Animated.View pointerEvents="none" style={[styles.errorFlash, { opacity: flash }]} />
        {phase === 'ready' || phase === 'won' || phase === 'lost' ? (
          <View style={styles.overlay}>
            <View style={styles.overlayCard}>
              <Text style={styles.overlayLabel}>BUKLOD KINGDOM • TRUDICE</Text>
              <Text style={styles.overlayTitle}>{phase === 'ready' ? t('THE WONDER PATH', 'LANDAS NG HIWAGA')
                : phase === 'won' ? t('THE HAVEN IS RESTORED!', 'BUO NA ANG HARDIN!')
                  : t('THE LIGHTS NEED YOU', 'KAILANGAN KA NG MGA ILAW')}</Text>
              <Text style={styles.overlayCopy}>{phase === 'ready'
                ? t('Explore five different playground adventures: follow the trail, find the double glow, dodge a blocked path, reverse a sequence, and rescue the stars.',
                  'Limang hamon: sundan ang ilaw, hanapin ang dobleng liwanag, umiwas sa harang, baliktarin ang ruta, at sagipin ang mga bituin.')
                : phase === 'won'
                  ? t(`You restored all five areas with ${starsForRun(mistakes)} stars. Your score is local game progress, not cash or BUKLOD Points.`,
                    `Naibalik ang limang lugar at may ${starsForRun(mistakes)} bituin. Local game score ito, hindi pera o BUKLOD Points.`)
                  : t('You can try again without losing real BUKLOD Points. The next route will be different.',
                    'Puwedeng umulit nang walang mawawalang totoong BUKLOD Points. Iba ang susunod na ruta.')}</Text>
              <Pressable accessibilityRole="button" onPress={restart} style={styles.primary}>
                <Text style={styles.primaryText}>{phase === 'ready' ? t('ENTER THE WONDER PATH', 'SIMULAN ANG ADVENTURE')
                  : t('PLAY A NEW PATH', 'BAGONG RUTA')}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        {phase === 'round-clear' ? (
          <View pointerEvents="none" style={styles.clearBanner}>
            <Text style={styles.clearCaption}>✦ {t('NEW AREA RESTORED', 'BAGONG LUGAR NAIBALIK')} ✦</Text>
            <Text style={styles.clearTitle}>{t(GARDEN_AREAS[round - 1][0], GARDEN_AREAS[round - 1][1])}</Text>
          </View>
        ) : null}
      </Animated.View>
      <View style={styles.footer}>
        <Text style={styles.footerMode}>{phase === 'watch' ? t('WATCH THE GLOW', 'PANOORIN ANG ILAW')
          : phase === 'input' ? t('YOUR TURN', 'IKAW NAMAN')
            : phase === 'retry' ? t('WATCH AGAIN', 'ULITIN ANG PANONOOD')
              : t(challenge.titleEn, challenge.titleTl)}</Text>
        <Text style={styles.instructions}>{phase === 'watch' ? t(challenge.instructionsEn, challenge.instructionsTl)
          : message || t(challenge.instructionsEn, challenge.instructionsTl)}</Text>
        {phase === 'input' ? <Text style={styles.counter}>{inputIndex}/{challenge.answer.length} {t('steps', 'hakbang')}</Text> : null}
        {phase === 'watch' ? <Text style={styles.counter}>{watchIndex}/{challenge.cues.length} {t('glows', 'ilaw')}</Text> : null}
        <Text style={styles.disclaimer}>{t('Game stars and score are preview-only. Verified BUKLOD Points require the separate Mastery Check.',
          'Local lamang ang game stars at score. Hiwalay ang Mastery Check para sa totoong BUKLOD Points.')}</Text>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { width:'100%', maxWidth:770, alignSelf:'center', padding:12, gap:12 },
  header: { paddingHorizontal:8, gap:4 },
  eyebrow:{color:'#f6d6fb',fontSize:10,fontWeight:'900',letterSpacing:1.4},
  title:{color:'#fff3da',fontSize:29,fontWeight:'900',letterSpacing:1},
  chapter:{color:'#f9d4f2',fontSize:15,fontWeight:'800',marginTop:2},
  metrics:{flexDirection:'row',gap:7,flexWrap:'wrap',marginTop:8},
  metric:{color:'#fff2d9',fontSize:11,fontWeight:'900',backgroundColor:'#60477c',borderRadius:10,paddingHorizontal:10,paddingVertical:8,overflow:'hidden'},
  progress:{height:7,borderRadius:7,backgroundColor:'#45315b',overflow:'hidden',marginTop:8},
  progressFill:{height:'100%',backgroundColor:'#f8d985'},
  gardenRow:{flexDirection:'row',justifyContent:'space-between',marginTop:7,gap:6},
  area:{width:36,height:30,backgroundColor:'#41345e',borderRadius:11,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#7a668f'},
  areaCurrent:{borderColor:'#ffe4b4',backgroundColor:'#806397'},
  areaRestored:{backgroundColor:'#2b916f',borderColor:'#9aefcc'},
  areaText:{color:'#fff5df',fontWeight:'900',fontSize:15},
  scene:{width:'100%',height:500,position:'relative',overflow:'hidden',borderRadius:24,borderWidth:2,borderColor:'#bd92cb',backgroundColor:'#301b5d'},
  restorationGlow:{...StyleSheet.absoluteFillObject,backgroundColor:'#88f2c5'},
  station:{position:'absolute',width:104,height:79,borderRadius:20,borderWidth:2,borderColor:'#e3bedb',backgroundColor:'rgba(38,25,70,0.89)',alignItems:'center',justifyContent:'center',zIndex:4},
  stationTop:{top:69,left:'50%',marginLeft:-52},
  stationRight:{top:209,right:9},
  stationBottom:{bottom:41,left:'50%',marginLeft:-52},
  stationLeft:{top:209,left:9},
  stationLit:{backgroundColor:'#725898',borderColor:'#fff2b0',transform:[{scale:1.08}]},
  stationBlocked:{backgroundColor:'#703348',borderColor:'#ff8594'},
  stationPressed:{opacity:0.78},
  stationIcon:{fontSize:24},
  stationName:{color:'#fff1d4',fontWeight:'900',fontSize:10,letterSpacing:0.8},
  stationNameLit:{color:'#ffffff'},
  stationSpark:{width:35,height:4,borderRadius:4,marginTop:4},
  hero:{position:'absolute',left:'50%',top:'50%',marginLeft:-29,marginTop:-37,width:58,alignItems:'center',zIndex:5},
  heroImage:{width:58,height:58,borderRadius:29,borderWidth:3,borderColor:'#ffe6ae',backgroundColor:'#48265c'},
  heroCaption:{fontSize:8,fontWeight:'900',color:'#fff8e8',backgroundColor:'#5c397f',paddingHorizontal:5,paddingVertical:2,borderRadius:5,overflow:'hidden',marginTop:2},
  restoredStar:{position:'absolute',zIndex:2},
  restoredStarText:{color:'#fff2ab',fontSize:27,textShadowColor:'#fff2ab',textShadowRadius:10},
  errorFlash:{...StyleSheet.absoluteFillObject,backgroundColor:'#ffa1a5',zIndex:7},
  overlay:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(16,10,37,0.74)',alignItems:'center',justifyContent:'center',padding:15,zIndex:9},
  overlayCard:{width:'100%',maxWidth:510,backgroundColor:'#392958',borderColor:'#d1abd8',borderWidth:1,borderRadius:21,padding:21,gap:12},
  overlayLabel:{color:'#f8dba8',fontSize:10,fontWeight:'900',textAlign:'center',letterSpacing:1},
  overlayTitle:{color:'#fff4d8',fontSize:24,fontWeight:'900',textAlign:'center'},
  overlayCopy:{color:'#f2e9f1',fontSize:13,lineHeight:20,textAlign:'center'},
  primary:{alignItems:'center',backgroundColor:'#ffe0a7',padding:14,borderRadius:14,marginTop:8,minHeight:48,justifyContent:'center'},
  primaryText:{color:'#3b2955',fontWeight:'900',fontSize:12,textAlign:'center'},
  clearBanner:{position:'absolute',left:10,right:10,top:193,zIndex:8,backgroundColor:'rgba(42,113,97,0.95)',borderRadius:18,borderWidth:2,borderColor:'#b2ffdc',paddingVertical:18,paddingHorizontal:12},
  clearCaption:{textAlign:'center',color:'#dbffee',fontSize:11,fontWeight:'900',letterSpacing:1},
  clearTitle:{textAlign:'center',color:'#fff8df',fontSize:23,fontWeight:'900',marginTop:4},
  footer:{backgroundColor:'#392954',padding:15,borderRadius:18,borderWidth:1,borderColor:'#a581b8',gap:6},
  footerMode:{color:'#ffe4af',fontSize:12,fontWeight:'900',letterSpacing:1},
  instructions:{color:'#fff4e9',fontSize:13,lineHeight:19,fontWeight:'700'},
  counter:{color:'#d9f9ed',fontSize:11,fontWeight:'900'},
  disclaimer:{color:'#dccbe5',fontSize:10,lineHeight:16,marginTop:6},
});
