import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type BuklodGameLanguage = 'en' | 'tl';

type Guide = {
  titleEn: string;
  titleTl: string;
  objectiveEn: string;
  objectiveTl: string;
  controlsEn: string;
  controlsTl: string;
};

type ContextValue = {
  language: BuklodGameLanguage;
  setLanguage: (language: BuklodGameLanguage) => void;
  t: (english: string, tagalog: string) => string;
  gameId?: string;
};

const STORAGE_KEY = 'buklod.game.language.v1';
const GameLanguageContext = createContext<ContextValue>({
  language: 'en',
  setLanguage: () => undefined,
  t: (english) => english,
});

const GUIDES: Record<string, Guide> = {
  'jawo-forest-trail': {
    titleEn: 'Forest Trail', titleTl: 'Landas sa Kagubatan',
    objectiveEn: 'Move across three trails, avoid obstacles, collect Trail Lights, and keep your combo as the forest gets faster.',
    objectiveTl: 'Lumipat sa tatlong landas, umiwas sa mga harang, kolektahin ang Trail Lights, at panatilihin ang combo habang bumibilis ang kagubatan.',
    controlsEn: 'Swipe left or right, or tap the left/right sides of the play area.',
    controlsTl: 'Mag-swipe pakaliwa o pakanan, o i-tap ang kaliwa/kanang bahagi ng play area.',
  },
  'trudice-playground-memory': {
    titleEn: 'Wonder Path', titleTl: 'Landas ng Alaala',
    objectiveEn: 'Watch the glowing playground route, remember the order, then repeat the same sequence.',
    objectiveTl: 'Panoorin ang kumikislap na ruta sa playground, tandaan ang pagkakasunod-sunod, saka ulitin ang parehong sequence.',
    controlsEn: 'Tap the playground stations in the exact order shown.',
    controlsTl: 'I-tap ang mga playground station ayon sa eksaktong pagkakasunod na ipinakita.',
  },
  'ace-rescue-grid': {
    titleEn: 'Rescue Grid', titleTl: 'Rescue Grid',
    objectiveEn: 'Secure all three rescue beacons and reach extraction before your energy runs out.',
    objectiveTl: 'Kunin ang tatlong rescue beacon at makarating sa extraction bago maubos ang energy.',
    controlsEn: 'Tap only adjacent open tiles. Avoid blocked corridors and conserve moves.',
    controlsTl: 'I-tap lamang ang katabing bukas na tile. Iwasan ang blocked corridor at tipirin ang galaw.',
  },
  'mitch-restore-mural': {
    titleEn: 'Restore the Mural', titleTl: 'Ibalik ang Mural',
    objectiveEn: 'Place all mural fragments into their correct positions with the best possible precision.',
    objectiveTl: 'Ilagay ang lahat ng piraso ng mural sa tamang puwesto nang may pinakamataas na precision.',
    controlsEn: 'Drag a fragment and release it over the matching target.',
    controlsTl: 'I-drag ang piraso at bitawan ito sa katugmang target.',
  },
  'niel-mission-trail': {
    titleEn: 'Mission Trail', titleTl: 'Landas ng Misyon',
    objectiveEn: 'Reach the remote village while balancing water, food, energy, and morale through five decisions.',
    objectiveTl: 'Marating ang malayong pamayanan habang binabalanse ang tubig, pagkain, energy, at morale sa limang desisyon.',
    controlsEn: 'Read each situation and choose the route action that best protects the team reserve.',
    controlsTl: 'Basahin ang bawat sitwasyon at piliin ang aksiyong pinakamainam para mapangalagaan ang reserba ng team.',
  },
  'angel-kingdom-treasury': {
    titleEn: 'Kingdom Treasury', titleTl: 'Ingat-Yaman ng Kaharian',
    objectiveEn: 'Build a balanced budget, keep an emergency reserve, and survive an unexpected crisis.',
    objectiveTl: 'Bumuo ng balanseng budget, magtira ng emergency reserve, at harapin ang biglaang krisis.',
    controlsEn: 'Adjust allocations, confirm the budget, then choose how the reserve will respond to the crisis.',
    controlsTl: 'Ayusin ang allocations, kumpirmahin ang budget, saka piliin kung paano gagamitin ang reserve sa krisis.',
  },
  'vhen-farm-to-market': {
    titleEn: 'Farm to Market', titleTl: 'Mula Bukid Hanggang Pamilihan',
    objectiveEn: 'Plan crops, respond to weather, harvest at the right time, and deliver with minimal spoilage.',
    objectiveTl: 'Planuhin ang pananim, tumugon sa panahon, umani sa tamang oras, at maghatid na kaunti ang nasisira.',
    controlsEn: 'Allocate fields, choose harvest timing, then select the best market route.',
    controlsTl: 'Hatiin ang taniman, piliin ang oras ng ani, saka piliin ang pinakamainam na market route.',
  },
  'elesur-village-builder': {
    titleEn: 'Village Builder', titleTl: 'Tagapagtayo ng Pamayanan',
    objectiveEn: 'Use limited workers and materials to solve the most urgent community needs.',
    objectiveTl: 'Gamitin nang maayos ang limitadong workers at materials para tugunan ang pinakaapurahang pangangailangan ng komunidad.',
    controlsEn: 'Choose projects carefully; every build consumes workers and materials.',
    controlsTl: 'Piliin nang maingat ang proyekto; bawat build ay gumagamit ng workers at materials.',
  },
  'phan-enterprise-builder': {
    titleEn: 'Enterprise Builder', titleTl: 'Tagapagtayo ng Negosyo',
    objectiveEn: 'Grow an enterprise across six cycles without destroying cash flow or reputation.',
    objectiveTl: 'Palaguin ang negosyo sa anim na cycle nang hindi nasisira ang cash flow o reputation.',
    controlsEn: 'Choose when to produce, process, sell, or expand based on inventory and market conditions.',
    controlsTl: 'Piliin kung kailan mag-produce, mag-process, magbenta, o mag-expand batay sa inventory at market condition.',
  },
  'van-living-city-dispatch': {
    titleEn: 'City Dispatch', titleTl: 'City Dispatch',
    objectiveEn: 'Send the right service team to urgent city requests while preserving capacity and public trust.',
    objectiveTl: 'Ipadala ang tamang service team sa mahahalagang request ng lungsod habang pinapanatili ang capacity at public trust.',
    controlsEn: 'Review urgency, distance, and specialization before dispatching a team.',
    controlsTl: 'Tingnan ang urgency, distance, at specialization bago magpadala ng team.',
  },
  'christian-civic-leadership': {
    titleEn: 'Leadership Council', titleTl: 'Konseho ng Pamumuno',
    objectiveEn: 'Handle five leadership cases while protecting trust, unity, budget, and time.',
    objectiveTl: 'Harapin ang limang leadership case habang pinangangalagaan ang trust, unity, budget, at oras.',
    controlsEn: 'Read each case and choose the response with the best long-term balance.',
    controlsTl: 'Basahin ang bawat case at piliin ang tugon na may pinakamagandang pangmatagalang balanse.',
  },
  'lhen-rhythm-journey': {
    titleEn: 'Rhythm Journey', titleTl: 'Paglalakbay sa Ritmo',
    objectiveEn: 'Hit the timing grid accurately, build combo, and finish the performance with strong accuracy.',
    objectiveTl: 'Tamaan nang tama ang timing grid, bumuo ng combo, at tapusin ang performance na mataas ang accuracy.',
    controlsEn: 'Tap on the beat. Perfect timing scores more than Good; late or early taps can miss.',
    controlsTl: 'I-tap sa beat. Mas mataas ang Perfect kaysa Good; sobrang aga o huli ay maaaring Miss.',
  },
  'quin-discovery-expedition': {
    titleEn: 'Discovery Expedition', titleTl: 'Ekspedisyon ng Pagtuklas',
    objectiveEn: 'Explore the fog-of-war, gather clues, avoid hazards, and secure the hidden relic.',
    objectiveTl: 'Galugarin ang fog-of-war, mangalap ng clues, umiwas sa hazards, at makuha ang nakatagong relic.',
    controlsEn: 'Move only to adjacent tiles and use the clues to locate the relic before energy runs out.',
    controlsTl: 'Lumipat lamang sa katabing tile at gamitin ang clues para mahanap ang relic bago maubos ang energy.',
  },
};

export function BuklodGameLanguageProvider({ gameId, children }: { gameId?: string; children: React.ReactNode }) {
  const [language, setLanguageState] = useState<BuklodGameLanguage>('en');

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY).then((value) => {
      if (mounted && (value === 'en' || value === 'tl')) setLanguageState(value);
    }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  const setLanguage = (next: BuklodGameLanguage) => {
    setLanguageState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  };

  const value = useMemo<ContextValue>(() => ({
    language,
    setLanguage,
    gameId,
    t: (english, tagalog) => language === 'tl' ? tagalog : english,
  }), [gameId, language]);

  return <GameLanguageContext.Provider value={value}>{children}</GameLanguageContext.Provider>;
}

export function useBuklodGameLanguage() {
  return useContext(GameLanguageContext);
}

export function BuklodGameLanguageControl() {
  const { language, setLanguage, gameId } = useBuklodGameLanguage();
  const [guideOpen, setGuideOpen] = useState(false);
  const guide = gameId ? GUIDES[gameId] : undefined;

  return (
    <View style={styles.anchor} pointerEvents="box-none">
      <View style={styles.row}>
        <Pressable
          onPress={() => setGuideOpen((value) => !value)}
          style={({ pressed }) => [styles.guideButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={language === 'tl' ? 'Buksan ang gabay' : 'Open game guide'}
        >
          <Text style={styles.guideButtonText}>{language === 'tl' ? 'GABAY' : 'GUIDE'}</Text>
        </Pressable>
        <View style={styles.languagePill}>
          <Pressable onPress={() => setLanguage('en')} style={[styles.langButton, language === 'en' && styles.langActive]}>
            <Text style={[styles.langText, language === 'en' && styles.langTextActive]}>EN</Text>
          </Pressable>
          <Pressable onPress={() => setLanguage('tl')} style={[styles.langButton, language === 'tl' && styles.langActive]}>
            <Text style={[styles.langText, language === 'tl' && styles.langTextActive]}>TL</Text>
          </Pressable>
        </View>
      </View>

      {guideOpen && guide ? (
        <View style={styles.guideCard}>
          <Text style={styles.guideEyebrow}>{language === 'tl' ? 'TAGALOG GAME GUIDE' : 'GAME GUIDE'}</Text>
          <Text style={styles.guideTitle}>{language === 'tl' ? guide.titleTl : guide.titleEn}</Text>
          <Text style={styles.guideCopy}>{language === 'tl' ? guide.objectiveTl : guide.objectiveEn}</Text>
          <Text style={styles.controlsLabel}>{language === 'tl' ? 'PAANO LARUIN' : 'HOW TO PLAY'}</Text>
          <Text style={styles.guideCopy}>{language === 'tl' ? guide.controlsTl : guide.controlsEn}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', top: 10, right: 10, zIndex: 100, alignItems: 'flex-end', maxWidth: 320 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  languagePill: { flexDirection: 'row', padding: 3, borderRadius: 999, backgroundColor: 'rgba(5,10,18,0.76)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  langButton: { minWidth: 34, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  langActive: { backgroundColor: 'rgba(255,255,255,0.92)' },
  langText: { color: 'rgba(255,255,255,0.72)', fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  langTextActive: { color: '#13202a' },
  guideButton: { height: 34, paddingHorizontal: 12, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(5,10,18,0.76)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  guideButtonText: { color: '#ffffff', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  guideCard: { marginTop: 8, width: 300, maxWidth: '92%', padding: 13, borderRadius: 16, backgroundColor: 'rgba(5,10,18,0.94)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  guideEyebrow: { color: '#a9e4c0', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  guideTitle: { marginTop: 4, color: '#ffffff', fontSize: 17, fontWeight: '900' },
  guideCopy: { marginTop: 6, color: 'rgba(255,255,255,0.82)', fontSize: 11, lineHeight: 16, fontWeight: '600' },
  controlsLabel: { marginTop: 10, color: '#f3d27d', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  pressed: { opacity: 0.72 },
});
