import React, { useCallback, useMemo, useState } from 'react';
import {
  Image, ImageBackground, Pressable, ScrollView, StyleSheet,
  Text, View, useWindowDimensions,
} from 'react-native';
import { router, Redirect, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Stop } from 'react-native-svg';
import { useAuth } from '@/providers/AuthProvider';
import { useCompliance } from '@/providers/ComplianceProvider';
import { useRuntimeConfig } from '@/providers/RuntimeConfigProvider';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';
import GenesisCosmicSky from '@/features/season2/genesis/GenesisCosmicSky';
import { GENESIS_IDENTITY, GENESIS_PALETTE, isGenesisPreviewBuild } from '@/features/season2/genesis/genesisContract';
import { BUKLOD_MAP_DISTRICTS, getBuklodMapDistrict, visibleBuklodMapDestinations } from '@/features/season2/genesis/genesisMapDistricts';
import { useRorkGameAmbience } from '@/features/games/runtime/rorkAudio';

/** A staging-only immersive gateway. Existing feature pages and permissions stay authoritative. */
export default function BuklodMapScreen() {
  const { session, loading, profile } = useAuth();
  const { requiresAcceptance } = useCompliance();
  const { config } = useRuntimeConfig();
  const { activeScope } = useBuklodScope();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [focused, setFocused] = useState(false);
  const [selectedId, setSelectedId] = useState('community');
  const { musicEnabled, toggleMusic } = useRorkGameAmbience('kingdom-map');

  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));

  const district = useMemo(() => getBuklodMapDistrict(selectedId), [selectedId]);
  const showFaith = Boolean(activeScope?.show_faith_content);
  const entries = visibleBuklodMapDestinations(district, showFaith);
  const compact = width < 355;

  // Protect the same boundaries as /index and /_layout, including old clients.
  if (!isGenesisPreviewBuild()) return <Redirect href="/(tabs)/buklod" />;
  if (loading && !session) return <View style={styles.boot}/>;
  if (!session) return <Redirect href="/(auth)/login" />;
  if (config?.maintenance_mode) return <Redirect href="/system/maintenance" />;
  if (config?.update_required) return <Redirect href="/system/update-required" />;
  if (config?.pilot_access_required && !config?.pilot_access_granted) return <Redirect href="/system/pilot-access" />;
  if (requiresAcceptance) return <Redirect href="/privacy/consent" />;
  if (!profile) return <Redirect href="/onboarding" />;

  return (
    <View style={styles.root}>
      <ImageBackground
        source={require('../../assets/season2/genesis/galaxy/nebula.jpg')}
        resizeMode="cover"
        style={StyleSheet.absoluteFillObject}
        imageStyle={styles.underpainting}
      >
        <View style={styles.dimmer}/>
      </ImageBackground>
      <GenesisCosmicSky active={focused} transparent />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: Math.max(12, insets.top) + 12, paddingBottom: Math.max(20, insets.bottom) + 44 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topline}>
          <View style={styles.brand}>
            <Image source={require('../../assets/season2/genesis/genesis-green-b-transparent.png')} style={styles.brandMark} resizeMode="contain"/>
            <View style={styles.brandText}>
              <Text style={styles.eyebrow}>BUKLOD WORLD MAP</Text>
              <Text numberOfLines={2} style={styles.title}>{GENESIS_IDENTITY.title}</Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={musicEnabled ? 'Turn ambient music off' : 'Turn ambient music on'}
            onPress={toggleMusic}
            style={({ pressed }) => [styles.musicButton, pressed && styles.pressed]}
          >
            <MaterialCommunityIcons name={musicEnabled ? 'music-note' : 'music-note-off'} size={18} color="#FFF0CC"/>
            <Text style={styles.musicText}>{musicEnabled ? 'Music on' : 'Music off'}</Text>
          </Pressable>
        </View>
        <Text style={styles.intro}>Isang mundo, malinaw na direksyon. Pumili ng lugar sa mapa at buksan ang mga gawain nito.</Text>

        <View style={styles.constellation}>
          <Svg style={StyleSheet.absoluteFillObject} viewBox="0 0 360 310" preserveAspectRatio="xMidYMid meet" pointerEvents="none">
            <Defs>
              <LinearGradient id="line" x1="0" x2="1" y1="0" y2="1">
                <Stop offset="0" stopColor="#82C9DA" stopOpacity=".18"/>
                <Stop offset=".52" stopColor="#FFE2A0" stopOpacity=".68"/>
                <Stop offset="1" stopColor="#89CBBE" stopOpacity=".12"/>
              </LinearGradient>
            </Defs>
            <Ellipse cx="180" cy="152" rx="150" ry="92" transform="rotate(-15 180 152)" stroke="url(#line)" strokeWidth="1.3" fill="none"/>
            <Ellipse cx="180" cy="152" rx="112" ry="140" transform="rotate(31 180 152)" stroke="#9EDEF0" strokeOpacity=".25" strokeWidth=".8" fill="none"/>
            <Path d="M52 74 C116 148 250 90 302 234" stroke="url(#line)" strokeWidth="1.6" fill="none"/>
            <Path d="M50 252 C110 190 239 246 314 52" stroke="#EED6A2" strokeOpacity=".28" strokeWidth="1" fill="none"/>
            <Circle cx="180" cy="151" r="54" fill="#EED6A2" fillOpacity=".06" stroke="#FFE5AA" strokeOpacity=".3" strokeWidth="1"/>
            <Circle cx="180" cy="151" r="3.2" fill="#FFF9E7"/>
          </Svg>
          <View style={styles.mapCore} pointerEvents="none">
            <Image source={require('../../assets/season2/genesis/genesis-green-b-transparent.png')} style={styles.coreMark} resizeMode="contain"/>
            <Text style={styles.coreText}>BUKLOD</Text>
          </View>
          <View style={styles.nodeGrid}>
            {BUKLOD_MAP_DISTRICTS.map((node, i) => {
              const active = node.id === selectedId;
              return (
                <Pressable
                  key={node.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={node.title + ', ' + node.tagline}
                  onPress={() => setSelectedId(node.id)}
                  style={({ pressed }) => [
                    styles.node, { borderColor: active ? node.accent : 'rgba(197,229,255,.24)' },
                    active && styles.nodeActive, pressed && styles.pressed,
                    compact && styles.nodeCompact,
                  ]}
                >
                  <View style={[styles.nodeIcon, { backgroundColor: active ? 'rgba(255,231,176,.19)' : 'rgba(97,179,186,.11)' }]}>
                    <MaterialCommunityIcons name={node.icon as any} size={compact ? 21 : 25} color={node.accent}/>
                  </View>
                  <Text numberOfLines={1} style={styles.nodeTitle}>{node.title}</Text>
                  <Text numberOfLines={2} style={styles.nodeTagline}>{node.tagline}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.districtPanel}>
          <View style={styles.panelHeading}>
            <MaterialCommunityIcons name={district.icon as any} size={27} color={district.accent}/>
            <View style={{flex:1}}>
              <Text style={styles.panelTitle}>{district.title}</Text>
              <Text style={styles.panelSubtitle}>{district.tagline}</Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={'Enter ' + district.title}
            onPress={() => router.push(district.destination as any)}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.primaryText}>ENTER {district.title.toUpperCase()}</Text>
            <MaterialCommunityIcons name="arrow-right" size={20} color="#071B2C"/>
          </Pressable>
          {entries.map(entry => (
            <Pressable
              key={entry.route}
              accessibilityRole="button"
              accessibilityLabel={'Open ' + entry.label}
              onPress={() => router.push(entry.route as any)}
              style={({ pressed }) => [styles.entry, pressed && styles.entryPressed]}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.entryTitle}>{entry.label}</Text>
                <Text style={styles.entryDesc}>{entry.description}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color="#DAECFF"/>
            </Pressable>
          ))}
        </View>
        <Text style={styles.footer}>Iisang mapa para sa lahat ng destinasyon. Ang permissions, verified rewards, at privacy ay pinamamahalaan pa rin sa bawat feature.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#030916' },
  boot: { flex: 1, backgroundColor: '#050A19' },
  dimmer: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(2,9,24,.60)' },
  underpainting: { opacity: .78 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 14, width: '100%', maxWidth: 700, alignSelf: 'center' },
  topline: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0, gap: 7 },
  brandMark: { height: 46, width: 40 },
  brandText: { flex: 1, minWidth: 0 },
  eyebrow: { color: '#9EE5D7', letterSpacing: 1.5, fontSize: 10, fontWeight: '900' },
  title: { fontSize: 17, lineHeight: 22, color: '#FFE5B2', fontWeight: '900' },
  musicButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, gap: 5, borderRadius: 21, borderWidth: 1, borderColor: 'rgba(255,233,188,.38)', backgroundColor: 'rgba(8,21,44,.75)' },
  musicText: { color: '#FFF2D6', fontSize: 11, fontWeight: '800' },
  pressed: { opacity: .75, transform: [{ scale: .985 }] },
  intro: { color: '#DAE8FA', marginTop: 13, marginBottom: 14, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  constellation: { minHeight: 310, borderRadius: 26, borderWidth: 1, borderColor: 'rgba(172,222,238,.28)', overflow: 'hidden', backgroundColor: 'rgba(4,15,34,.49)', justifyContent: 'center', paddingVertical: 14 },
  mapCore: { position: 'absolute', top: '43%', left: '40%', width: '20%', alignItems: 'center' },
  coreMark: { width: 48, height: 48 },
  coreText: { fontSize: 9, color: '#FCEBCB', fontWeight: '900', letterSpacing: 1 },
  nodeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-evenly', rowGap: 8 },
  node: { width: '45%', minHeight: 66, borderWidth: 1, borderRadius: 14, paddingVertical: 6, paddingHorizontal: 8, backgroundColor: 'rgba(7,20,46,.88)', justifyContent: 'center', alignItems: 'center' },
  nodeCompact: { minHeight: 70 },
  nodeActive: { backgroundColor: 'rgba(28,47,78,.98)', shadowColor: '#FFE5B2', shadowOpacity: .34, shadowRadius: 10, elevation: 3 },
  nodeIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  nodeTitle: { fontSize: 12, color: '#FFFFFF', fontWeight: '900', marginTop: 1 },
  nodeTagline: { fontSize: 9, lineHeight: 11, color: '#BFD3EE', textAlign: 'center' },
  districtPanel: { marginTop: 12, borderRadius: 20, padding: 15, gap: 7, borderWidth: 1, borderColor: 'rgba(243,211,153,.35)', backgroundColor: 'rgba(6,20,42,.91)' },
  panelHeading: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 2 },
  panelTitle: { color: '#FFFFFF', fontSize: 19, fontWeight: '900' },
  panelSubtitle: { color: '#D4E6F9', fontSize: 12 },
  primaryButton: { marginTop: 6, backgroundColor: '#FFE3A8', borderRadius: 13, minHeight: 46, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  primaryText: { color: '#071B2C', fontSize: 12, fontWeight: '900', letterSpacing: .6 },
  entry: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(205,228,249,.18)', flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 4, minHeight: 48 },
  entryPressed: { backgroundColor: 'rgba(255,255,255,.08)' },
  entryTitle: { color: '#F8FBFF', fontSize: 13, fontWeight: '800' },
  entryDesc: { color: '#BBCEE7', fontSize: 11, lineHeight: 15 },
  footer: { color: '#B3C8E5', fontSize: 10, lineHeight: 15, paddingVertical: 18, textAlign: 'center' },
});
