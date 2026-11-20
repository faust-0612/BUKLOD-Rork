/**
 * Season 2 only: finite, accessible Android-native Genesis cinematic opener.
 * The real, alpha-keyed canonical green B floats in created space.
 * No remote assets, synthetic game state, backend writes, advertising, or sound.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Dimensions, Easing, Image, StatusBar, StyleSheet, Text, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import Svg, { Circle, Defs, Ellipse, LinearGradient as SvgLinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { GENESIS_IDENTITY, GENESIS_PALETTE } from './genesisContract';
import { markBuklodStartupChromeReady, subscribeBuklodStartupChromeReady } from '@/lib/buklodStartupChrome';

// This file is deliberately different from the full-square, opaque launcher
// artwork. Only the original green B pixels remain; surrounding alpha is zero.
const TRANSPARENT_GREEN_B = require('../../../../assets/season2/genesis/genesis-green-b-transparent.png');
const LOCKED_SCREEN = Dimensions.get('screen');
const MARK_SIZE = Math.min(236, Math.max(138, LOCKED_SCREEN.height * 0.285));
const STARS = Array.from({ length: 78 }, (_, i) => ({
  x: ((i * 173 + i * i * 37 + 19) % 398) + 1,
  y: ((i * 211 + i * i * 13 + 31) % 812) + 4,
  radius: i % 11 === 0 ? 1.55 : i % 4 === 0 ? 1.05 : 0.58,
}));

function CreationUniverse() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 400 820" preserveAspectRatio="xMidYMid slice">
      <Defs>
        <RadialGradient id="genesis-void" cx="49%" cy="46%" rx="78%" ry="78%">
          <Stop offset="0" stopColor="#172F5A"/>
          <Stop offset=".37" stopColor="#141A43"/>
          <Stop offset=".74" stopColor="#090D26"/>
          <Stop offset="1" stopColor="#030714"/>
        </RadialGradient>
        <RadialGradient id="genesis-violet" cx="48%" cy="48%" rx="55%" ry="48%">
          <Stop offset="0" stopColor="#B46DCD" stopOpacity=".45"/>
          <Stop offset=".4" stopColor="#5C67BD" stopOpacity=".28"/>
          <Stop offset="1" stopColor="#212D6A" stopOpacity="0"/>
        </RadialGradient>
        <RadialGradient id="genesis-teal" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor="#72E0D7" stopOpacity=".43"/>
          <Stop offset=".52" stopColor="#387B9F" stopOpacity=".13"/>
          <Stop offset="1" stopColor="#19436B" stopOpacity="0"/>
        </RadialGradient>
        <RadialGradient id="genesis-first-light" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor="#FFFDFC" stopOpacity=".97"/>
          <Stop offset=".08" stopColor="#FFF3CB" stopOpacity=".83"/>
          <Stop offset=".3" stopColor="#E6C998" stopOpacity=".36"/>
          <Stop offset=".7" stopColor="#B6A5CF" stopOpacity=".09"/>
          <Stop offset="1" stopColor="#C2A2FF" stopOpacity="0"/>
        </RadialGradient>
        <RadialGradient id="genesis-earth" cx="25%" cy="22%" rx="80%" ry="83%">
          <Stop offset="0" stopColor="#DDF9F1"/>
          <Stop offset=".24" stopColor="#5FCDCA"/>
          <Stop offset=".58" stopColor="#367DB3"/>
          <Stop offset="1" stopColor="#090D29"/>
        </RadialGradient>
        <RadialGradient id="genesis-moon" cx="25%" cy="25%" rx="80%" ry="80%">
          <Stop offset="0" stopColor="#F8E4C5"/>
          <Stop offset=".55" stopColor="#B9A6AD"/>
          <Stop offset="1" stopColor="#372D52"/>
        </RadialGradient>
        <SvgLinearGradient id="genesis-stream" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#9583C8" stopOpacity="0"/>
          <Stop offset=".42" stopColor="#AAB3ED" stopOpacity=".48"/>
          <Stop offset=".65" stopColor="#E8CFA1" stopOpacity=".42"/>
          <Stop offset="1" stopColor="#83D9DB" stopOpacity="0"/>
        </SvgLinearGradient>
      </Defs>
      <Rect width="400" height="820" fill="url(#genesis-void)"/>
      <Ellipse cx="240" cy="356" rx="295" ry="264" fill="url(#genesis-violet)" transform="rotate(-28 240 356)"/>
      <Ellipse cx="73" cy="645" rx="205" ry="257" fill="url(#genesis-teal)"/>
      <Ellipse cx="340" cy="110" rx="230" ry="185" fill="url(#genesis-teal)" opacity=".48"/>
      <Path d="M-132 548 C-19 94 272 114 515 356" fill="none" stroke="#946FC7" strokeOpacity=".14" strokeWidth="79"/>
      <Path d="M-145 584 C-10 93 294 108 537 377" fill="none" stroke="#94BCE0" strokeOpacity=".12" strokeWidth="28"/>
      <Path d="M-95 604 C80 176 309 144 477 333" fill="none" stroke="url(#genesis-stream)" strokeWidth="3.7"/>
      <Path d="M-66 632 C85 188 328 165 484 318" fill="none" stroke="url(#genesis-stream)" strokeWidth=".9"/>
      <Path d="M-55 696 C55 385 322 234 476 395" fill="none" stroke="#C8B9E5" strokeOpacity=".24" strokeWidth=".85"/>
      <Circle cx="347" cy="655" r="113" fill="url(#genesis-earth)"/>
      <Path d="M270 614 C299 610 317 650 353 628 S398 633 426 624" stroke="#D3EDE6" strokeOpacity=".34" strokeWidth="6" fill="none"/>
      <Path d="M257 675 C308 648 343 698 424 683" stroke="#84E8DE" strokeOpacity=".22" strokeWidth="9" fill="none"/>
      <Circle cx="71" cy="154" r="37" fill="url(#genesis-moon)"/>
      <Ellipse cx="71" cy="154" rx="62" ry="13" transform="rotate(-27 71 154)" fill="none" stroke="#E1C99E" strokeOpacity=".64" strokeWidth="1.7"/>
      <Ellipse cx="198" cy="369" rx="176" ry="154" fill="url(#genesis-first-light)" opacity=".72"/>
      <Path d="M198 82 V633 M4 369 H396 M45 205 L349 541 M354 195 L46 537" fill="none" stroke="#FFE9C9" strokeOpacity=".14" strokeWidth=".8"/>
      <Circle cx="198" cy="369" r="2.6" fill="#FFF9E8"/>
      {STARS.map((p, i) => (
        <React.Fragment key={i}>
          <Circle cx={p.x} cy={p.y} r={p.radius} fill={i % 7 === 0 ? '#FFE8BF' : '#E8F5FF'} opacity={i % 5 === 0 ? .96 : .72}/>
          {i % 12 === 0 ? <Path d={`M${p.x-5} ${p.y} H${p.x+5} M${p.x} ${p.y-5} V${p.y+5}`}
            fill="none" stroke="#FFF2D6" strokeOpacity=".67" strokeWidth=".66"/> : null}
        </React.Fragment>
      ))}
    </Svg>
  );
}

function FirstLightBurst({ phase }: { phase: Animated.Value }) {
  return (
    <Animated.View pointerEvents="none" style={[
      styles.burst,
      {
        opacity: phase.interpolate({ inputRange:[0,.2,.55,1], outputRange:[0,.9,.78,.43] }),
        transform:[{ scale:phase.interpolate({ inputRange:[0,1], outputRange:[.23,1.43] }) }],
      },
    ]}>
      <Svg width="100%" height="100%" viewBox="0 0 460 460">
        <Defs>
          <RadialGradient id="genesis-burst" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity=".8"/>
            <Stop offset=".14" stopColor="#FCEDC6" stopOpacity=".6"/>
            <Stop offset=".42" stopColor="#8FE5CB" stopOpacity=".24"/>
            <Stop offset="1" stopColor="#B69ED8" stopOpacity="0"/>
          </RadialGradient>
        </Defs>
        <Circle cx="230" cy="230" r="229" fill="url(#genesis-burst)"/>
        <Ellipse cx="230" cy="230" rx="215" ry="69" fill="none" stroke="#F7E4B4" strokeOpacity=".51" strokeWidth="1.7" transform="rotate(-29 230 230)"/>
        <Ellipse cx="230" cy="230" rx="182" ry="46" fill="none" stroke="#8DEBD9" strokeOpacity=".43" strokeWidth="1.1" transform="rotate(39 230 230)"/>
        <Path d="M230 12 V448 M12 230 H448 M74 74 L386 386 M74 386 L386 74"
          fill="none" stroke="#FFF7D9" strokeOpacity=".3" strokeWidth="1.5"/>
      </Svg>
    </Animated.View>
  );
}

export default function GenesisCinematicStartup({ children }: { children: React.ReactNode }) {
  const [splashGone, setSplashGone] = useState(false);
  const [chromeReady, setChromeReady] = useState(false);
  const [motionReduced, setMotionReduced] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const [holdDone, setHoldDone] = useState(false);
  const [visible, setVisible] = useState(true);
  const hiddenSplash = useRef(false);
  const ambient = useRef(new Animated.Value(0)).current;
  const reveal = useRef(new Animated.Value(0)).current;
  const markOpacity = useRef(new Animated.Value(0)).current;
  const markScale = useRef(new Animated.Value(.79)).current;
  const copyOpacity = useRef(new Animated.Value(0)).current;
  const fadeOut = useRef(new Animated.Value(1)).current;

  const hideNativeSplash = () => {
    if (hiddenSplash.current) return;
    hiddenSplash.current = true;
    void SplashScreen.hideAsync().catch(() => undefined).finally(() => setSplashGone(true));
  };

  useEffect(() => {
    const backup = setTimeout(hideNativeSplash, 1000);
    const readySubscription = subscribeBuklodStartupChromeReady(() => setChromeReady(true));
    const chromeBackup = setTimeout(() => markBuklodStartupChromeReady(), 20000);
    const appSubscription = AppState.addEventListener('change', state => setForeground(state === 'active'));
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (mounted) setMotionReduced(Boolean(value));
    }).catch(() => undefined);
    const reduceSubscription = AccessibilityInfo.addEventListener('reduceMotionChanged', v => setMotionReduced(Boolean(v)));
    return () => {
      mounted = false;
      clearTimeout(backup);
      clearTimeout(chromeBackup);
      readySubscription();
      appSubscription.remove();
      reduceSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!splashGone || !visible || !foreground || holdDone) return;
    // One non-looping cinematic sequence: never steal frames from live video
    // playback, message composition or ad navigation after launch.
    const animate = Animated.parallel([
      Animated.timing(ambient, { toValue: 1, duration: motionReduced ? 90 : 620, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(motionReduced ? 0 : 260),
        Animated.timing(reveal, { toValue: 1, duration: motionReduced ? 130 : 1370, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.delay(motionReduced ? 0 : 560),
        Animated.parallel([
          Animated.timing(markOpacity, { toValue: 1, duration: motionReduced ? 110 : 750, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(markScale, { toValue: 1, duration: motionReduced ? 110 : 870, easing: Easing.out(Easing.back(1.22)), useNativeDriver: true }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(motionReduced ? 0 : 1080),
        Animated.timing(copyOpacity, { toValue: 1, duration: motionReduced ? 110 : 560, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.delay(motionReduced ? 80 : 850),
      ]),
    ]);
    animate.start(({ finished }) => { if (finished) setHoldDone(true); });
    return () => animate.stop();
  }, [ambient, reveal, markOpacity, markScale, copyOpacity, splashGone, motionReduced, visible, foreground, holdDone]);

  useEffect(() => {
    if (!splashGone || !holdDone || !chromeReady || !visible || !foreground) return;
    const fade = Animated.timing(fadeOut, { toValue: 0, duration: motionReduced ? 100 : 260, useNativeDriver: true });
    fade.start(({ finished }) => { if (finished) setVisible(false); });
    return () => fade.stop();
  }, [fadeOut, splashGone, holdDone, chromeReady, motionReduced, visible, foreground]);

  const haloSize = useMemo(() => Math.max(270, MARK_SIZE * 1.9), []);
  return (
    <View style={styles.root}>
      {splashGone ? children : null}
      {visible ? (
        <Animated.View pointerEvents="auto" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
          style={[styles.stage, { width: LOCKED_SCREEN.width, height: LOCKED_SCREEN.height, opacity: fadeOut }]}>
          <StatusBar barStyle="light-content" backgroundColor="#050A19"/>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, {
            opacity: ambient,
            transform:[{ translateY:ambient.interpolate({ inputRange:[0,1], outputRange:[12,-8] }) }],
          }]}>
            <CreationUniverse/>
          </Animated.View>
          {/* First-light particles drift independently of the static cosmic artwork.
              One bounded intro animation only; nothing loops over live app content. */}
          <Animated.View pointerEvents="none" style={[styles.lightSweep, {
            opacity: reveal.interpolate({inputRange:[0,.25,.7,1],outputRange:[0,.1,.7,0]}),
            transform: [
              {translateX: reveal.interpolate({inputRange:[0,1],outputRange:[-LOCKED_SCREEN.width*.7,LOCKED_SCREEN.width*.8]})},
              {rotate:'-24deg'},
            ],
          }]}/>
          <Animated.View pointerEvents="none" style={[styles.particleField, {
            opacity: ambient.interpolate({inputRange:[0,1],outputRange:[0,.9]}),
            transform:[{translateY: reveal.interpolate({inputRange:[0,1],outputRange:[22,-28]})}],
          }]}>
            <Svg width="100%" height="100%" viewBox="0 0 400 820" preserveAspectRatio="xMidYMid slice">
              {STARS.filter((_,i)=>i%3===0).map((star,i)=>(
                <Circle key={i} cx={star.x} cy={star.y} r={star.radius*.8}
                  fill={i%2===0?'#FCE5B4':'#A5E8FF'} opacity=".7"/>
              ))}
            </Svg>
          </Animated.View>
          <View pointerEvents="none" style={styles.composition}>
            <View style={[styles.markFrame, { width: MARK_SIZE, height: MARK_SIZE }]}>
              <View pointerEvents="none" style={{ position:'absolute',width:haloSize,height:haloSize,alignItems:'center',justifyContent:'center' }}>
                <FirstLightBurst phase={reveal}/>
              </View>
              <Animated.View pointerEvents="none" style={{ opacity:markOpacity, transform:[{ scale:markScale }] }}>
                <Image source={TRANSPARENT_GREEN_B} resizeMode="contain"
                  onLoadEnd={hideNativeSplash}
                  style={{ width:MARK_SIZE, height:MARK_SIZE }}/>
              </Animated.View>
            </View>
            <Animated.View pointerEvents="none" style={[styles.copy, { opacity:copyOpacity }]}>
              <Text style={styles.season}>BUKLOD · SEASON 2</Text>
              <Text style={styles.title}>{GENESIS_IDENTITY.title}</Text>
              <Text style={styles.verse}>“LET THERE BE LIGHT” · {GENESIS_IDENTITY.verse}</Text>
              <View style={styles.goldRule}/>
            </Animated.View>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:GENESIS_PALETTE.void},
  stage:{position:'absolute',top:0,left:0,zIndex:99999,overflow:'hidden',backgroundColor:'#050A19'},
  composition:{...StyleSheet.absoluteFillObject,alignItems:'center',justifyContent:'center'},
  lightSweep:{position:'absolute',top:'-20%',left:'35%',width:110,height:'140%',backgroundColor:'rgba(244,227,177,.16)'},
  particleField:{...StyleSheet.absoluteFillObject},
  markFrame:{alignItems:'center',justifyContent:'center'},
  burst:{width:'100%',height:'100%',alignItems:'center',justifyContent:'center'},
  copy:{alignItems:'center',marginTop:10,paddingHorizontal:18},
  season:{color:'#E3C990',fontSize:10,letterSpacing:3,fontWeight:'800',textAlign:'center'},
  title:{color:'#FFF6DC',fontSize:21,fontWeight:'900',textAlign:'center',marginTop:9,lineHeight:29},
  verse:{color:'#DDEBFF',fontSize:11,fontWeight:'700',letterSpacing:1.1,textAlign:'center',marginTop:7},
  goldRule:{height:1,width:124,backgroundColor:'#E8CC91',opacity:.7,marginTop:17},
});
