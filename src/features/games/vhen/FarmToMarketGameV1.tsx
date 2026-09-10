import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { playBuklodGameFeedback } from '../runtime/BuklodGameFeedback';
import { useBuklodGameLanguage } from '../runtime/BuklodGameLanguage';
import type { BuklodGameResult } from '../types';

type CropKey = 'rice' | 'vegetables' | 'fruit';
type Phase = 'planning' | 'weather' | 'harvest' | 'market' | 'result';
type Weather = 'ideal' | 'dry' | 'rain';
type Timing = 'early' | 'peak' | 'late';
type Route = 'town' | 'hub';

type CropMeta = {
  label: string;
  labelTl: string;
  baseYield: number;
  basePrice: number;
  accent: string;
};

const GAME_ID = 'vhen-farm-to-market';
const LAND_POINTS = 8;
const CROPS: Record<CropKey, CropMeta> = {
  rice: { label: 'Rice', labelTl: 'Palay', baseYield: 5, basePrice: 12, accent: '#d8bf67' },
  vegetables: { label: 'Vegetables', labelTl: 'Gulay', baseYield: 4, basePrice: 16, accent: '#69a56b' },
  fruit: { label: 'Fruit', labelTl: 'Prutas', baseYield: 3, basePrice: 22, accent: '#d58a63' },
};
const WEATHER: Weather[] = ['ideal', 'dry', 'rain'];
const DEMAND_SETS: Array<Record<CropKey, number>> = [
  { rice: 1.05, vegetables: 1.3, fruit: 0.9 },
  { rice: 1.25, vegetables: 0.95, fruit: 1.15 },
  { rice: 0.95, vegetables: 1.1, fruit: 1.35 },
];

const starsForScore = (score: number): 1 | 2 | 3 => {
  if (score >= 1500) return 3;
  if (score >= 1125) return 2;
  return 1;
};

const timingMultiplier = (timing: Timing, weather: Weather) => {
  if (weather === 'ideal') return timing === 'peak' ? 1.25 : timing === 'early' ? 0.9 : 0.82;
  if (weather === 'dry') return timing === 'early' ? 1.08 : timing === 'peak' ? 0.96 : 0.68;
  return timing === 'early' ? 0.88 : timing === 'peak' ? 1.02 : 0.72;
};

const localizeMessage = (message: string, language: 'en' | 'tl') => {
  if (language === 'en') return message;
  const exact: Record<string, string> = {
    'Allocate eight field units. Diversification protects the farm, but over-spreading can reduce output efficiency.': 'Ilaan ang walong field unit. Pinoprotektahan ng diversification ang bukid, pero ang sobrang paghahati ay maaaring magpababa ng efficiency.',
    'Fields planted. The season develops and weather starts shaping the harvest window.': 'Nataniman na ang mga bukid. Umuusad ang panahon at ang weather ay nagsisimulang magtakda ng tamang oras ng ani.',
    'Ideal season. Peak harvest gives the strongest quality and yield.': 'Mainam ang season. Pinakamaganda ang kalidad at ani sa peak harvest.',
    'Dry spell. Waiting too long increases crop loss; early harvest becomes safer.': 'Tagtuyot. Mas maraming ani ang mawawala kapag naghintay nang matagal; mas ligtas ang maagang pag-ani.',
    'Heavy rain. Peak harvest is still possible, but late harvest risks spoilage.': 'Malakas ang ulan. Maaari pa rin ang peak harvest, pero mas mataas ang panganib ng pagkasira kapag late harvest.',
    'Harvest is loaded. Choose the market route: shorter town delivery or farther trading hub with better prices but more spoilage risk.': 'Nakarga na ang ani. Piliin ang market route: mas maikling town delivery o mas malayong trading hub na mas mataas ang presyo pero mas mataas din ang spoilage risk.',
    'The farm reached market, but losses were too high to sustain the next cycle.': 'Nakarating sa market ang ani, pero masyadong malaki ang lugi para masuportahan ang susunod na cycle.',
  };
  if (exact[message]) return exact[message];

  let match = message.match(/^Use all (\d+) field units before planting\. (-?\d+) remain\.$/);
  if (match) return `Gamitin ang lahat ng ${match[1]} field unit bago magtanim. ${match[2]} pa ang natitira.`;

  match = message.match(/^Market run complete\. (\d+) crates arrived with (\d+) trade value\.$/);
  if (match) return `Tapos ang market run. ${match[1]} crate ang nakarating na may ${match[2]} trade value.`;

  return message;
};

const timingLabel = (timing: Timing, language: 'en' | 'tl') => {
  if (language === 'en') return timing.toUpperCase();
  if (timing === 'early') return 'MAAGA';
  if (timing === 'peak') return 'TAMANG ORAS';
  return 'HULI';
};

const weatherLabel = (weather: Weather, language: 'en' | 'tl') => {
  if (language === 'en') return weather.toUpperCase();
  if (weather === 'ideal') return 'MAINAM';
  if (weather === 'dry') return 'TAGTUYOT';
  return 'MAULAN';
};

type Props = { onFinish?: (result: BuklodGameResult) => void };

export function FarmToMarketGameV1({ onFinish }: Props) {
  const { language, t } = useBuklodGameLanguage();
  const [phase, setPhase] = useState<Phase>('planning');
  const [land, setLand] = useState<Record<CropKey, number>>({ rice: 3, vegetables: 3, fruit: 2 });
  const [weatherIndex, setWeatherIndex] = useState(0);
  const [timings, setTimings] = useState<Record<CropKey, Timing>>({ rice: 'peak', vegetables: 'peak', fruit: 'peak' });
  const [route, setRoute] = useState<Route>('town');
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState('Allocate eight field units. Diversification protects the farm, but over-spreading can reduce output efficiency.');

  const weather = WEATHER[weatherIndex];
  const demand = DEMAND_SETS[weatherIndex];
  const usedLand = land.rice + land.vegetables + land.fruit;
  const freeLand = LAND_POINTS - usedLand;

  const projected = useMemo(() => {
    const result = {} as Record<CropKey, { crates: number; value: number }>;
    (Object.keys(CROPS) as CropKey[]).forEach((key) => {
      const meta = CROPS[key];
      const crates = Math.max(0, Math.round(land[key] * meta.baseYield * timingMultiplier(timings[key], weather)));
      const value = Math.round(crates * meta.basePrice * demand[key]);
      result[key] = { crates, value };
    });
    return result;
  }, [demand, land, timings, weather]);

  const totalCrates = projected.rice.crates + projected.vegetables.crates + projected.fruit.crates;
  const grossValue = projected.rice.value + projected.vegetables.value + projected.fruit.value;

  const adjustLand = useCallback((key: CropKey, delta: number) => {
    if (phase !== 'planning') return;
    setLand((current) => {
      const next = current[key] + delta;
      const total = current.rice + current.vegetables + current.fruit;
      if (next < 0 || (delta > 0 && total >= LAND_POINTS)) return current;
      void playBuklodGameFeedback('move');
      return { ...current, [key]: next };
    });
  }, [phase]);

  const lockPlan = useCallback(() => {
    if (phase !== 'planning') return;
    if (freeLand !== 0) {
      setMessage(`Use all ${LAND_POINTS} field units before planting. ${freeLand} remain.`);
      void playBuklodGameFeedback('impact');
      return;
    }
    setPhase('weather');
    setMessage('Fields planted. The season develops and weather starts shaping the harvest window.');
    void playBuklodGameFeedback('collect');
  }, [freeLand, phase]);

  const revealWeather = useCallback(() => {
    if (phase !== 'weather') return;
    setPhase('harvest');
    setMessage(
      weather === 'ideal'
        ? 'Ideal season. Peak harvest gives the strongest quality and yield.'
        : weather === 'dry'
          ? 'Dry spell. Waiting too long increases crop loss; early harvest becomes safer.'
          : 'Heavy rain. Peak harvest is still possible, but late harvest risks spoilage.',
    );
    void playBuklodGameFeedback('impact');
  }, [phase, weather]);

  const cycleTiming = useCallback((key: CropKey) => {
    if (phase !== 'harvest') return;
    setTimings((current) => {
      const order: Timing[] = ['early', 'peak', 'late'];
      const next = order[(order.indexOf(current[key]) + 1) % order.length];
      void playBuklodGameFeedback('move');
      return { ...current, [key]: next };
    });
  }, [phase]);

  const goMarket = useCallback(() => {
    if (phase !== 'harvest') return;
    setPhase('market');
    setMessage('Harvest is loaded. Choose the market route: shorter town delivery or farther trading hub with better prices but more spoilage risk.');
    void playBuklodGameFeedback('collect');
  }, [phase]);

  const chooseRoute = useCallback((nextRoute: Route) => {
    if (phase !== 'market') return;
    setRoute(nextRoute);
    void playBuklodGameFeedback('move');
  }, [phase]);

  const finish = useCallback(() => {
    if (phase !== 'market') return;
    const routeMultiplier = route === 'town' ? 0.96 : 1.18;
    const spoilageRate = route === 'town' ? 0.04 : 0.13;
    const netCrates = Math.max(0, Math.round(totalCrates * (1 - spoilageRate)));
    const netRevenue = Math.round(grossValue * routeMultiplier * (1 - spoilageRate));
    const diversity = [land.rice, land.vegetables, land.fruit].filter((value) => value > 0).length;
    const stewardshipBonus = diversity === 3 ? 180 : diversity === 2 ? 90 : 0;
    const efficiencyBonus = Math.round(netCrates * 7);
    const finalScore = netRevenue + stewardshipBonus + efficiencyBonus;
    const stars = starsForScore(finalScore);
    const failed = netCrates < 12 || finalScore < 700;

    setScore(finalScore);
    setPhase('result');
    setMessage(
      failed
        ? 'The farm reached market, but losses were too high to sustain the next cycle.'
        : `Market run complete. ${netCrates} crates arrived with ${netRevenue} trade value.`,
    );
    void playBuklodGameFeedback(failed ? 'failure' : 'success');
    onFinish?.({
      gameId: GAME_ID,
      status: failed ? 'lost' : 'won',
      score: finalScore,
      stars: failed ? 0 : stars,
      reward: {
        xp: failed ? 25 : 125 + stars * 45,
        kingdomXp: failed ? 5 : 55 + stars * 20,
        collectibleKey: !failed && stars === 3 ? 'vhen-golden-harvest-crate' : undefined,
      },
    });
  }, [grossValue, land, onFinish, phase, route, totalCrates]);

  const reset = useCallback(() => {
    setPhase('planning');
    setLand({ rice: 3, vegetables: 3, fruit: 2 });
    setWeatherIndex((value) => (value + 1) % WEATHER.length);
    setTimings({ rice: 'peak', vegetables: 'peak', fruit: 'peak' });
    setRoute('town');
    setScore(0);
    setMessage('Allocate eight field units. Diversification protects the farm, but over-spreading can reduce output efficiency.');
  }, []);

  return (
    <View style={styles.shell}>
      <View style={styles.header}>
        <View><Text style={styles.eyebrow}>{t('VHEN • AGRICULTURAL VALLEY', 'VHEN • LAMBAK SAKAHAN')}</Text><Text style={styles.title}>{t('Farm to Market', 'Bukid Hanggang Pamilihan')}</Text></View>
        <View style={styles.badge}><Text style={styles.badgeValue}>{phase === 'result' ? score : LAND_POINTS}</Text><Text style={styles.badgeLabel}>{phase === 'result' ? t('FINAL SCORE', 'HULING ISKOR') : t('FIELD UNITS', 'FIELD UNITS')}</Text></View>
      </View>
      <Text style={styles.message}>{localizeMessage(message, language)}</Text>

      {phase === 'planning' ? <View style={styles.panel}>
        <Text style={styles.sectionTitle}>{t('Planting Plan', 'Plano ng Pagtatanim')}</Text>
        {(Object.keys(CROPS) as CropKey[]).map((key) => <View key={key} style={styles.cropRow}>
          <View style={[styles.cropMark, { backgroundColor: CROPS[key].accent }]} />
          <View style={styles.cropCopy}><Text style={styles.cropLabel}>{language === 'tl' ? CROPS[key].labelTl : CROPS[key].label}</Text><Text style={styles.cropSub}>{CROPS[key].baseYield} {t('base crates / field', 'base crate / field')}</Text></View>
          <Pressable style={styles.step} onPress={() => adjustLand(key, -1)}><Text style={styles.stepText}>−</Text></Pressable>
          <Text style={styles.amount}>{land[key]}</Text>
          <Pressable style={styles.step} onPress={() => adjustLand(key, 1)}><Text style={styles.stepText}>+</Text></Pressable>
        </View>)}
        <Text style={styles.summary}>{freeLand} {t('field units remaining', 'field unit ang natitira')}</Text>
        <Pressable style={styles.primary} onPress={lockPlan}><Text style={styles.primaryText}>{t('PLANT THE SEASON', 'SIMULAN ANG PAGTATANIM')}</Text></Pressable>
      </View> : null}

      {phase === 'weather' ? <View style={[styles.panel, styles.centerPanel]}>
        <Text style={styles.kicker}>{t('SEASON EVENT', 'PANGYAYARI SA SEASON')}</Text><Text style={styles.bigTitle}>{t('Weather is changing.', 'Nagbabago ang panahon.')}</Text>
        <Text style={styles.copy}>{t('Your field mix is locked. Harvest timing now determines how much of the season you save.', 'Naka-lock na ang halo ng pananim. Ang oras ng pag-ani ngayon ang magtatakda kung gaano karami ang masasagip sa season.')}</Text>
        <Pressable style={styles.primary} onPress={revealWeather}><Text style={styles.primaryText}>{t('REVEAL WEATHER', 'TINGNAN ANG PANAHON')}</Text></Pressable>
      </View> : null}

      {phase === 'harvest' ? <View style={styles.panel}>
        <Text style={styles.kicker}>{weatherLabel(weather, language)} {t('WEATHER', 'PANAHON')}</Text><Text style={styles.sectionTitle}>{t('Choose Harvest Timing', 'Piliin ang Oras ng Pag-ani')}</Text>
        {(Object.keys(CROPS) as CropKey[]).map((key) => <Pressable key={key} style={styles.timingRow} onPress={() => cycleTiming(key)}>
          <View><Text style={styles.cropLabel}>{language === 'tl' ? CROPS[key].labelTl : CROPS[key].label}</Text><Text style={styles.cropSub}>{land[key]} {t('fields planted', 'field ang nataniman')}</Text></View>
          <View style={styles.timingPill}><Text style={styles.timingText}>{timingLabel(timings[key], language)}</Text></View>
          <Text style={styles.projected}>{projected[key].crates} {t('crates', 'crate')}</Text>
        </Pressable>)}
        <Text style={styles.summary}>{t('Projected harvest', 'Tinatayang ani')}: {totalCrates} {t('crates', 'crate')}</Text>
        <Pressable style={styles.primary} onPress={goMarket}><Text style={styles.primaryText}>{t('LOAD FOR MARKET', 'IKARGA PARA SA PAMILIHAN')}</Text></Pressable>
      </View> : null}

      {phase === 'market' ? <View style={styles.panel}>
        <Text style={styles.sectionTitle}>{t('Choose Delivery Route', 'Piliin ang Ruta ng Delivery')}</Text>
        <View style={styles.demandRow}>{(Object.keys(CROPS) as CropKey[]).map((key) => <View key={key} style={styles.demandCard}><Text style={styles.demandLabel}>{language === 'tl' ? CROPS[key].labelTl : CROPS[key].label}</Text><Text style={styles.demandValue}>×{demand[key].toFixed(2)}</Text></View>)}</View>
        <Pressable style={[styles.routeCard, route === 'town' && styles.routeActive]} onPress={() => chooseRoute('town')}><Text style={styles.routeTitle}>{t('Town Market', 'Pamilihan ng Bayan')}</Text><Text style={styles.routeCopy}>{t('Lower price • only 4% spoilage risk', 'Mas mababang presyo • 4% lamang ang spoilage risk')}</Text></Pressable>
        <Pressable style={[styles.routeCard, route === 'hub' && styles.routeActive]} onPress={() => chooseRoute('hub')}><Text style={styles.routeTitle}>{t('Trading Hub', 'Sentro ng Kalakalan')}</Text><Text style={styles.routeCopy}>{t('Higher price • 13% spoilage risk', 'Mas mataas na presyo • 13% spoilage risk')}</Text></Pressable>
        <Pressable style={styles.primary} onPress={finish}><Text style={styles.primaryText}>{t('SEND THE HARVEST', 'IPADALA ANG ANI')}</Text></Pressable>
      </View> : null}

      {phase === 'result' ? <View style={[styles.panel, styles.centerPanel]}>
        <Text style={styles.kicker}>{t('SEASON COMPLETE', 'TAPOS ANG SEASON')}</Text><Text style={styles.bigScore}>{score}</Text><Text style={styles.copy}>{localizeMessage(message, language)}</Text>
        <Text style={styles.copy}>{t('Your season result is recorded in Vhen’s Kingdom station progress.', 'Naitala ang resulta ng season sa progreso ng Kingdom station ni Vhen.')}</Text>
        <Pressable style={styles.primary} onPress={reset}><Text style={styles.primaryText}>{t('NEXT SEASON', 'SUSUNOD NA SEASON')}</Text></Pressable>
      </View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell:{width:'100%',maxWidth:880,alignSelf:'center',padding:16,gap:14},header:{flexDirection:'row',justifyContent:'space-between',gap:14,alignItems:'flex-start'},eyebrow:{color:'#d8c77a',fontSize:12,fontWeight:'900',letterSpacing:1.1},title:{color:'#fffbe7',fontSize:32,fontWeight:'900',marginTop:3},badge:{alignItems:'flex-end'},badgeValue:{color:'#fff1a8',fontSize:28,fontWeight:'900'},badgeLabel:{color:'#b8b187',fontSize:9,fontWeight:'900',letterSpacing:1},message:{color:'#edf0d3',lineHeight:21},panel:{backgroundColor:'rgba(13,25,10,0.82)',borderRadius:22,borderWidth:1,borderColor:'rgba(211,196,101,0.24)',padding:18,gap:12},centerPanel:{alignItems:'center',paddingVertical:34},sectionTitle:{color:'#fffbe7',fontSize:24,fontWeight:'900'},cropRow:{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:'rgba(255,255,255,0.04)',borderRadius:14,padding:10},cropMark:{width:8,height:40,borderRadius:99},cropCopy:{flex:1},cropLabel:{color:'#fff',fontWeight:'900',fontSize:15},cropSub:{color:'#aeb89d',fontSize:12,marginTop:2},step:{width:38,height:38,borderRadius:12,backgroundColor:'#263417',alignItems:'center',justifyContent:'center'},stepText:{color:'#fff',fontSize:22,fontWeight:'900'},amount:{color:'#fff7c7',minWidth:28,textAlign:'center',fontSize:18,fontWeight:'900'},summary:{color:'#d8c77a',fontWeight:'800'},primary:{backgroundColor:'#d8bd5b',borderRadius:14,paddingVertical:14,paddingHorizontal:18,alignItems:'center',marginTop:4},primaryText:{color:'#1a1d10',fontWeight:'900',letterSpacing:.8},kicker:{color:'#d8c77a',fontSize:11,fontWeight:'900',letterSpacing:1.1},bigTitle:{color:'#fff',fontSize:28,fontWeight:'900',textAlign:'center'},copy:{color:'#d6dec7',textAlign:'center',lineHeight:21,maxWidth:620},timingRow:{flexDirection:'row',alignItems:'center',gap:10,padding:12,borderRadius:14,backgroundColor:'rgba(255,255,255,0.045)'},timingPill:{paddingVertical:6,paddingHorizontal:10,borderRadius:999,backgroundColor:'#314022'},timingText:{color:'#e8f4c9',fontWeight:'900',fontSize:11},projected:{marginLeft:'auto',color:'#fff1a8',fontWeight:'900'},demandRow:{flexDirection:'row',gap:8,flexWrap:'wrap'},demandCard:{flexGrow:1,minWidth:120,backgroundColor:'rgba(255,255,255,0.05)',padding:10,borderRadius:12},demandLabel:{color:'#c9d0bc',fontSize:11,fontWeight:'800'},demandValue:{color:'#fff1a8',fontSize:19,fontWeight:'900',marginTop:3},routeCard:{borderRadius:14,padding:14,borderWidth:1,borderColor:'rgba(255,255,255,0.11)',backgroundColor:'rgba(255,255,255,0.03)'},routeActive:{borderColor:'#e3c85f',backgroundColor:'rgba(216,189,91,0.12)'},routeTitle:{color:'#fff',fontSize:17,fontWeight:'900'},routeCopy:{color:'#b8c4aa',marginTop:3},bigScore:{color:'#fff1a8',fontSize:56,fontWeight:'900'}
});
