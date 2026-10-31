import React, { useMemo, type ReactNode } from 'react';
import { Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { router } from 'expo-router';
import { DZAS_LOGO_IMAGE, DZAS_PORTRAIT_IMAGE } from '@/assets/dzasImages';

/**
 * DZAS Signal Deck. Pure view: web/native players own their media lifecycle.
 *
 * Program entries are a *published guide* (not a live now-playing API).
 * Every feed tile opens a real DZAS destination, never a fabricated local post.
 * The sponsor block must be an actual ad-provider view, not simulated fill.
 */
export const DZAS_OFFICIAL_URL = 'https://dzas.febc.ph/';
export const DZAS_GUIDE_URL = 'https://dzas.febc.ph/on-air-programs/';
export const DZAS_COMMUNITY_URL = 'https://www.facebook.com/702DZAS/';
export const DZAS_EMAIL = 'info@dzas.febc.ph';
const GOLD = '#E7B652';
const GREEN = '#124C35';

type Program = {
  time: string;
  title: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
};
const PROGRAMS: Record<'weekday' | 'saturday' | 'sunday', Program[]> = {
  weekday: [
    { time: '5:00 AM', title: 'Unang Salmo', icon: 'white-balance-sunny' },
    { time: '6:00 AM', title: 'Hardin ng Panalangin', icon: 'hands-pray' },
    { time: '7:00 AM', title: 'Oras Na Pilipinas', icon: 'radio-tower' },
    { time: '12:00 PM', title: 'Tinig Balita', icon: 'message-text-outline' },
    { time: '4:30 PM', title: 'Papuri', icon: 'music-note' },
  ],
  saturday: [
    { time: '5:00 AM', title: 'Maunlad na Pilipino', icon: 'white-balance-sunny' },
    { time: '6:30 AM', title: 'Pagsusuri', icon: 'book-open-outline' },
    { time: '7:00 AM', title: 'Konektado', icon: 'radio-tower' },
    { time: '12:00 PM', title: 'Patok', icon: 'message-text-outline' },
    { time: '5:00 PM', title: 'Puso at Lakas', icon: 'heart-outline' },
  ],
  sunday: [
    { time: '4:30 AM', title: 'Ang Mabuting Balita', icon: 'white-balance-sunny' },
    { time: '6:30 AM', title: 'Karunungang Buhay', icon: 'book-open-outline' },
    { time: '7:30 AM', title: "Pag-asang Para sa 'Yo", icon: 'radio-tower' },
    { time: '12:00 PM', title: 'Ang Tipan', icon: 'book-open-variant' },
    { time: '8:30 PM', title: 'Evidence and Answers', icon: 'lightbulb-outline' },
  ],
};

function getPhilippineProgramDay(date = new Date()): 'weekday' | 'saturday' | 'sunday' {
  try {
    const day = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'Asia/Manila' }).format(date);
    return day === 'Sun' ? 'sunday' : day === 'Sat' ? 'saturday' : 'weekday';
  } catch {
    const day = date.getDay();
    return day === 0 ? 'sunday' : day === 6 ? 'saturday' : 'weekday';
  }
}
export { getPhilippineProgramDay };

function openDzasUrl(url: string) {
  void Linking.openURL(url).catch(() =>
    Alert.alert('DZAS', 'Hindi mabuksan ang link. Tingnan ang internet o email app at subukan muli.'),
  );
}
function openPrayerEmail() {
  openDzasUrl('mailto:' + DZAS_EMAIL + '?subject=' + encodeURIComponent('Prayer Request – BUKLOD listener'));
}
function openPartnershipEmail() {
  openDzasUrl('mailto:' + DZAS_EMAIL + '?subject=' + encodeURIComponent('702 DZAS Partnership Inquiry'));
}

type Props = {
  playing: boolean;
  busy: boolean;
  buffering?: boolean;
  error?: string;
  favorite: boolean;
  onPlay: () => void;
  onPause: () => void;
  onRetry: () => void;
  onFavorite: () => void;
  ad?: ReactNode;
};

const waveHeights = [10, 23, 15, 32, 21, 37, 18, 28, 12];

export default function DzasSignalDeck({
  playing, busy, buffering = false, error = '', favorite,
  onPlay, onPause, onRetry, onFavorite, ad,
}: Props) {
  const day = useMemo(() => getPhilippineProgramDay(), []);
  const dayLabel = day === 'weekday' ? 'MON–FRI' : day === 'saturday' ? 'SATURDAY' : 'SUNDAY';
  const schedule = PROGRAMS[day];

  const feed = [
    {
      id: 'prayer', kicker: 'PRAYER REQUEST', title: 'Send Your\nPrayer Request',
      icon: 'hands-pray' as const, colors: ['#675837', '#224B34'] as const,
      onPress: openPrayerEmail,
      label: 'Email your prayer request to DZAS',
    },
    {
      id: 'update', kicker: 'STATION UPDATE', title: '702 DZAS\nOfficial Updates',
      icon: 'radio-tower' as const, colors: ['#4D7780', '#163C36'] as const,
      onPress: () => openDzasUrl(DZAS_OFFICIAL_URL),
      label: 'Open official DZAS station updates',
    },
    {
      id: 'community', kicker: 'COMMUNITY', title: 'DZAS\nCommunity',
      icon: 'account-group-outline' as const, colors: ['#BE8540', '#18543D'] as const,
      onPress: () => openDzasUrl(DZAS_COMMUNITY_URL),
      label: 'Open DZAS official community page',
    },
  ];

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button" accessibilityLabel="Bumalik"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <MaterialCommunityIcons name="arrow-left" size={25} color={GREEN} />
          </Pressable>
          <Text style={styles.pageTitle} numberOfLines={1}>DZAS Signal Deck</Text>
          <View style={styles.signalBars} accessibilityLabel="Signal deck decoration">
            {[9, 15, 22, 29].map((height, index) =>
              <View key={index} style={[styles.signalBar, { height }]} />)}
          </View>
        </View>

        <LinearGradient
          colors={['#0C3F2C', '#1A603C', '#082F24']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Svg style={styles.heroCurve} viewBox="0 0 400 130" preserveAspectRatio="none">
            <Path d="M0 120 C120 160 240 74 400 17 L400 130 L0 130 Z" fill="#2B704A" opacity={0.65} />
            <Path d="M0 125 C135 161 275 88 400 21" stroke={GOLD} strokeWidth={2} fill="none" />
          </Svg>

          <View style={styles.heroTop}>
            <View style={styles.brandLogoFrame}>
              <Image source={DZAS_LOGO_IMAGE} style={styles.heroLogo} resizeMode="contain"
                accessibilityLabel="Official 702 DZAS AM station logo supplied for BUKLOD" />
            </View>
            <View style={styles.heroFrequencyBlock}>
              <View style={styles.onAirBadge}>
                <View style={[styles.liveDot, !playing && styles.inactiveDot]} />
                <Text style={styles.onAirText}>
                  {playing ? 'ON AIR' : busy || buffering ? 'CONNECTING' : '702 DZAS'}
                </Text>
              </View>
              <Text style={styles.heroFrequency}>702 <Text style={styles.am}>AM</Text></Text>
              <View style={styles.waveRow}>
                {waveHeights.map((height, index) =>
                  <View key={index} style={[
                    styles.wave, { height, opacity: playing ? 1 : 0.6 },
                  ]} />)}
              </View>
            </View>
          </View>

          <View style={styles.portraitFrame} pointerEvents="none">
            <Image source={DZAS_PORTRAIT_IMAGE} style={styles.heroPortrait} resizeMode="cover"
              accessibilityLabel="Portrait supplied by BUKLOD owner for the DZAS radio design" />
            <LinearGradient
              colors={['rgba(12,63,44,0.22)', 'rgba(12,63,44,0)', 'rgba(12,63,44,0.38)']}
              style={styles.portraitOverlay}
            />
          </View>

          <View style={styles.heroBottom}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={playing ? 'I-pause ang DZAS live stream' : 'Pakinggan ang DZAS live stream'}
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={playing ? onPause : onPlay}
              style={({ pressed }) => [styles.listenButton, busy && styles.disabled, pressed && styles.pressed]}
            >
              <View style={styles.listenIcon}>
                <MaterialCommunityIcons name={busy ? 'loading' : playing ? 'pause' : 'play'}
                  size={28} color="#103D2E" />
              </View>
              <Text style={styles.listenLabel}>
                {busy ? 'Connecting' : playing ? 'Pause Live' : 'Listen Live'}
              </Text>
              <MaterialCommunityIcons name="access-point" size={28} color="#145039" />
            </Pressable>
          </View>
        </LinearGradient>

        {!!error && (
          <View style={styles.errorBox} accessibilityRole="alert">
            <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#893C2F" />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Retry DZAS audio"
              onPress={onRetry} style={styles.errorRetry}>
              <Text style={styles.errorRetryText}>Retry</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.quickPanel}>
          <Pressable
            accessibilityRole="button" accessibilityLabel="Retry live stream"
            disabled={busy} onPress={onRetry}
            style={({ pressed }) => [styles.quickButton, pressed && styles.pressed]}
          >
            <MaterialCommunityIcons name="refresh" size={27} color={GREEN}/>
            <Text style={styles.quickLabel}>Retry</Text>
          </Pressable>
          <View style={styles.quickDivider} />
          <Pressable
            accessibilityRole="button" accessibilityLabel={favorite ? 'Remove DZAS from favorites' : 'Add DZAS to favorites'}
            onPress={onFavorite}
            style={({ pressed }) => [styles.quickButton, pressed && styles.pressed]}
          >
            <MaterialCommunityIcons name={favorite ? 'heart' : 'heart-outline'} size={27}
              color={favorite ? '#C14D56' : GREEN} />
            <Text style={styles.quickLabel}>{favorite ? 'Favorited' : 'Favorite'}</Text>
          </Pressable>
          <View style={styles.quickDivider} />
          <Pressable
            accessibilityRole="button" accessibilityLabel="Official DZAS source website"
            onPress={() => openDzasUrl(DZAS_OFFICIAL_URL)}
            style={({ pressed }) => [styles.quickButton, pressed && styles.pressed]}
          >
            <MaterialCommunityIcons name="web" size={27} color={GREEN} />
            <Text style={styles.quickLabel}>Source</Text>
          </Pressable>
        </View>

        <LinearGradient
          colors={['#104D37', '#286E4B', '#C79C47']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.partnerBanner}
        >
          <View style={styles.partnerCopy}>
            <Text style={styles.partnerEyebrow}>SUPPORT THE MISSION</Text>
            <Text style={styles.partnerTitle}>Partner with 702 DZAS</Text>
            <Text style={styles.partnerCaption}>Connect with the station to explore ways to support its ministry.</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Inquire about a DZAS partnership"
            onPress={openPartnershipEmail} style={styles.partnerLink}>
            <Text style={styles.partnerLinkText}>Learn More</Text>
            <MaterialCommunityIcons name="arrow-right" size={17} color="#164431" />
          </Pressable>
        </LinearGradient>

        {ad ? (
          <View style={styles.adSlot}>
            {ad}
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="calendar-month-outline" size={26} color={GREEN} />
          <Text style={styles.sectionTitle}>Program Schedule</Text>
          <View style={styles.sectionRule} />
          <Pressable accessibilityRole="link" accessibilityLabel="Open official full DZAS program schedule"
            onPress={() => openDzasUrl(DZAS_GUIDE_URL)} style={styles.sectionLink}>
            <Text style={styles.sectionLinkText}>View All</Text>
            <MaterialCommunityIcons name="arrow-right" size={17} color={GREEN} />
          </Pressable>
        </View>
        <Text style={styles.sectionDescription}>{dayLabel} · Published DZAS guide, subject to station changes</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scheduleScroll} style={styles.scheduleOuter}>
          {schedule.map((program, index) => (
            <Pressable key={program.time + program.title}
              accessibilityRole="link"
              accessibilityLabel={program.title + ' at ' + program.time + '. Open official program guide.'}
              onPress={() => openDzasUrl(DZAS_GUIDE_URL)}
              style={({ pressed }) => [
                styles.programCard,
                index === 1 && styles.programCardAccent,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.programTime}>
                <MaterialCommunityIcons name={program.icon} size={17} color="#FFFFFF" />
                <Text style={styles.programTimeText}>{program.time}</Text>
              </View>
              <Text style={styles.programTitle} numberOfLines={3}>{program.title}</Text>
              <MaterialCommunityIcons name={program.icon} size={30} color={GREEN} />
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="bullhorn-outline" size={27} color={GREEN} />
          <Text style={styles.sectionTitle}>DZAS Feed</Text>
          <View style={styles.sectionRule} />
          <Pressable accessibilityRole="link" accessibilityLabel="Official latest DZAS updates"
            onPress={() => openDzasUrl(DZAS_COMMUNITY_URL)} style={styles.sectionLink}>
            <Text style={styles.sectionLinkText}>Latest Updates</Text>
            <MaterialCommunityIcons name="arrow-right" size={17} color={GREEN}/>
          </Pressable>
        </View>
        <Text style={styles.sectionDescription}>Official DZAS links · Updates open at the source</Text>
        <View style={styles.feedRow}>
          {feed.map(item =>
            <Pressable key={item.id} accessibilityRole="link" accessibilityLabel={item.label}
              onPress={item.onPress} style={({ pressed }) => [
                styles.feedCard, pressed && styles.pressed,
              ]}>
              <LinearGradient colors={[...item.colors]} style={styles.feedGradient}>
                <Text style={styles.feedKicker}>{item.kicker}</Text>
                <MaterialCommunityIcons name={item.icon} size={39} color="rgba(255,255,255,0.85)" style={styles.feedIcon}/>
                <View style={styles.feedBottom}>
                  <Text style={styles.feedTitle} numberOfLines={3}>{item.title}</Text>
                  <MaterialCommunityIcons name="arrow-right-circle" size={23} color="#FFFFFF"/>
                </View>
              </LinearGradient>
            </Pressable>
          )}
        </View>
        <Text style={styles.footer}>702 DZAS · Agapay ng Sambayanan · Official audio stream; BUKLOD does not record or restream the station.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F3EA' },
  scroll: { flex: 1 },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 48 },
  topBar: { height: 52, flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 12 },
  backButton: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', elevation: 2, shadowOpacity: 0.12, shadowRadius: 5 },
  pageTitle: { flex: 1, color: '#103D2E', fontSize: 23, fontWeight: '900', letterSpacing: -0.4 },
  signalBars: { flexDirection: 'row', gap: 4, alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: 4, height: 28 },
  signalBar: { width: 5, borderRadius: 4, backgroundColor: '#216545' },
  hero: { minHeight: 270, borderRadius: 26, overflow: 'hidden', padding: 16, backgroundColor: '#0C3F2C', elevation: 4, shadowOpacity: 0.16, shadowRadius: 10 },
  heroCurve: { position: 'absolute', bottom: 0, left: 0, right: 0, width: '100%', height: 100 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', zIndex: 2 },
  brandLogoFrame: { width: '43%', height: 156, justifyContent: 'center', alignItems: 'center' },
  heroLogo: { width: '100%', height: '100%', borderRadius: 8 },
  heroFrequencyBlock: { marginLeft: 9, zIndex: 2, justifyContent: 'center', alignItems: 'flex-start', flex: 1 },
  onAirBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FBF2E1', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 30, maxWidth: '100%' },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#CF313B', marginRight: 6 },
  inactiveDot: { backgroundColor: '#8D9C91' },
  onAirText: { color: '#973634', fontWeight: '900', fontSize: 11, letterSpacing: 0.7 },
  heroFrequency: { marginTop: 7, fontSize: 33, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.8 },
  am: { color: '#EFC77C', fontSize: 22 },
  waveRow: { height: 40, marginTop: 4, flexDirection: 'row', gap: 4, alignItems: 'center' },
  wave: { width: 4, borderRadius: 5, backgroundColor: GOLD },
  portraitFrame: { position: 'absolute', right: 0, top: 30, height: 200, width: '49%', borderTopLeftRadius: 90, borderBottomLeftRadius: 110, overflow: 'hidden', opacity: 0.92 },
  heroPortrait: { width: '100%', height: '100%', backgroundColor: '#B7D3BB' },
  portraitOverlay: { ...StyleSheet.absoluteFillObject },
  heroBottom: { flex: 1, justifyContent: 'flex-end', alignItems: 'flex-start', marginTop: 40, zIndex: 3 },
  listenButton: { minHeight: 54, paddingHorizontal: 9, paddingRight: 14, gap: 10, borderRadius: 30, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5D483', borderWidth: 2, borderColor: '#F8E0A9', width: '77%', elevation: 2 },
  listenIcon: { height: 42, width: 42, borderRadius: 25, backgroundColor: '#FFF6D9', alignItems: 'center', justifyContent: 'center' },
  listenLabel: { flex: 1, fontSize: 17, color: '#153E2C', fontWeight: '900' },
  disabled: { opacity: 0.65 },
  pressed: { opacity: 0.76 },
  errorBox: { marginTop: 11, borderRadius: 15, borderColor: '#EDC8C0', borderWidth: 1, backgroundColor: '#FEF2EE', padding: 11, flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText: { flex: 1, fontSize: 12, lineHeight: 17, color: '#80352E' },
  errorRetry: { borderRadius: 10, backgroundColor: '#F8D6C9', paddingHorizontal: 12, paddingVertical: 9 },
  errorRetryText: { color: '#80352E', fontWeight: '800', fontSize: 12 },
  quickPanel: { marginTop: 13, minHeight: 65, backgroundColor: '#FFFEFB', borderRadius: 22, borderColor: '#E4DACB', borderWidth: 1, flexDirection: 'row', alignItems: 'center', elevation: 2, shadowOpacity: 0.07, shadowRadius: 8 },
  quickButton: { flex: 1, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', minHeight: 57 },
  quickLabel: { fontSize: 12, fontWeight: '800', color: '#203A2C' },
  quickDivider: { height: 31, width: 1, backgroundColor: '#E0DBD1' },
  partnerBanner: { marginTop: 16, minHeight: 118, borderRadius: 20, padding: 16, overflow: 'hidden', justifyContent: 'center' },
  partnerCopy: { paddingRight: 8 },
  partnerEyebrow: { color: '#FFF9DB', fontWeight: '900', fontSize: 9, letterSpacing: 1 },
  partnerTitle: { color: '#FFFFFF', fontWeight: '900', fontSize: 19, marginTop: 3 },
  partnerCaption: { color: '#F0F5E8', fontWeight: '600', fontSize: 11, lineHeight: 16, marginTop: 5, maxWidth: '77%' },
  partnerLink: { position: 'absolute', bottom: 10, right: 10, borderRadius: 21, minHeight: 36, paddingHorizontal: 12, backgroundColor: '#FFF4D4', flexDirection: 'row', alignItems: 'center', gap: 5 },
  partnerLinkText: { color: '#164431', fontWeight: '900', fontSize: 11 },
  adSlot: { marginTop: 15, minHeight: 289, width: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#E4E5DB' },
  sectionHeader: { marginTop: 23, marginBottom: 4, flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectionTitle: { fontSize: 18, color: '#25342F', fontWeight: '900' },
  sectionRule: { flex: 1, height: 1, marginLeft: 3, backgroundColor: '#D7B46D' },
  sectionLink: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 9, paddingLeft: 4 },
  sectionLinkText: { fontSize: 11, color: '#275D45', fontWeight: '800' },
  sectionDescription: { color: '#698071', fontSize: 10, marginBottom: 10, fontWeight: '600' },
  scheduleOuter: { marginHorizontal: -12 },
  scheduleScroll: { paddingHorizontal: 12, paddingVertical: 4, gap: 8 },
  programCard: { width: 132, minHeight: 147, borderRadius: 21, borderColor: '#E5E3D8', borderWidth: 1, backgroundColor: '#FDFDF6', padding: 9, alignItems: 'center', justifyContent: 'space-between', elevation: 1, shadowOpacity: 0.04, shadowRadius: 3 },
  programCardAccent: { backgroundColor: '#FCF4D9', borderColor: GOLD, borderWidth: 2 },
  programTime: { width: '100%', borderRadius: 14, backgroundColor: '#1D6747', paddingHorizontal: 6, paddingVertical: 7, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center' },
  programTimeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  programTitle: { color: '#1D3026', fontWeight: '900', fontSize: 12.5, lineHeight: 16, textAlign: 'center', marginTop: 5, marginBottom: 3 },
  feedRow: { flexDirection: 'row', gap: 8 },
  feedCard: { flex: 1, minWidth: 0, height: 145, borderRadius: 18, overflow: 'hidden', elevation: 2, shadowOpacity: 0.1, shadowRadius: 4 },
  feedGradient: { flex: 1, padding: 9, justifyContent: 'space-between' },
  feedKicker: { alignSelf: 'flex-start', fontSize: 8, fontWeight: '900', color: '#153B2B', backgroundColor: '#FFF5DC', borderRadius: 12, paddingHorizontal: 6, paddingVertical: 5 },
  feedIcon: { alignSelf: 'center', opacity: 0.8 },
  feedBottom: { flexDirection: 'row', alignItems: 'flex-end', gap: 1 },
  feedTitle: { flex: 1, fontSize: 12, lineHeight: 16, color: '#FFFFFF', fontWeight: '900' },
  footer: { marginTop: 20, paddingBottom: 4, color: '#6C796E', textAlign: 'center', fontSize: 10, lineHeight: 16 },
});
