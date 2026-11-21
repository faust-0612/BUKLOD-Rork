import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ImageBackground, Pressable, ScrollView, StyleSheet,
  Text, View, useWindowDimensions,
} from 'react-native';
import { router, Redirect, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/AuthProvider';
import { useCompliance } from '@/providers/ComplianceProvider';
import { useRuntimeConfig } from '@/providers/RuntimeConfigProvider';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';
import GenesisCosmicSky from '@/features/season2/genesis/GenesisCosmicSky';
import GenesisApprovedEntryMap from '@/features/season2/genesis/GenesisApprovedEntryMap';
import BuklodAdMobBanner from '@/components/BuklodAdMobBanner';
import BuklodMapHeader from '@/features/season2/world/BuklodMapHeader';
import BuklodMapGuideDock from '@/features/season2/world/BuklodMapGuideDock';
import { isGenesisPreviewBuild } from '@/features/season2/genesis/genesisContract';
import { BUKLOD_MAP_DISTRICTS, getBuklodMapDistrict, visibleBuklodMapDestinations } from '@/features/season2/genesis/genesisMapDistricts';
import { useRorkGameAmbience } from '@/features/games/runtime/rorkAudio';

/** A staging-only immersive gateway. Existing feature pages and permissions stay authoritative. */
export default function BuklodMapScreen() {
  const { session, loading, profile } = useAuth();
  const { requiresAcceptance, loading: complianceLoading } = useCompliance();
  const { config, loading: runtimeLoading } = useRuntimeConfig();
  const { activeScope } = useBuklodScope();
  const insets = useSafeAreaInsets();
  const {width:windowWidth,height:windowHeight}=useWindowDimensions();
  const landscape=windowWidth>windowHeight && windowHeight<=520;
  const [focused, setFocused] = useState(false);
  const [selectedId, setSelectedId] = useState('kingdom');
  const [showDirectory, setShowDirectory] = useState(false);
  const lastDoorTap = useRef(0);
  // The default is silent until real authentication, consent, runtime and onboarding gates pass.
  // On approved Genesis entry, local music autostarts while Android system volume remains authoritative.
  const canPlayMusic = Boolean(isGenesisPreviewBuild() && !loading && !complianceLoading &&
    !runtimeLoading && session && profile && !requiresAcceptance && !config?.maintenance_mode && !config?.update_required &&
    (!config?.pilot_access_required || config?.pilot_access_granted));
  useRorkGameAmbience('kingdom-map',{autoStart:canPlayMusic});

  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));

  const district = useMemo(() => getBuklodMapDistrict(selectedId), [selectedId]);
  const showFaith = Boolean(activeScope?.show_faith_content);
  const entries = visibleBuklodMapDestinations(district, showFaith);

  // Protect the same boundaries as /index and /_layout, including old clients.
  if (!isGenesisPreviewBuild()) return <Redirect href="/(tabs)/buklod" />;
  if (loading && !session) return <View style={styles.boot}/>;
  if (!session) return <Redirect href="/(auth)/login" />;
  if (config?.maintenance_mode) return <Redirect href="/system/maintenance" />;
  if (config?.update_required) return <Redirect href="/system/update-required" />;
  if (config?.pilot_access_required && !config?.pilot_access_granted) return <Redirect href="/system/pilot-access" />;
  if (requiresAcceptance) return <Redirect href="/privacy/consent" />;
  if (!profile) return <Redirect href="/onboarding" />;

  const mapNode = (
    <GenesisApprovedEntryMap active={focused} showFaith={showFaith}
      availableWidth={landscape ? Math.max(290, Math.min(windowWidth * .55, (windowHeight - 145) * 720 / 670)) : undefined}
      onOpen={(door, route) => {
        const now = Date.now();
        if (now - lastDoorTap.current < 650) return;
        lastDoorTap.current = now;
        setSelectedId(door.districtId);
        router.push(route as any);
      }}
      onMenu={() => setShowDirectory(value => !value)}
    />
  );

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
      <BuklodMapHeader />
      <ScrollView
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, landscape&&styles.landscapeContent, { paddingTop: 6, paddingBottom: Math.max(6, insets.bottom) + 8 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={landscape ? styles.landscapeFirstRow : styles.portraitFirstView}>
          {landscape ? (
            <>
              <View style={styles.landscapeMapColumn}>{mapNode}</View>
              <View style={styles.landscapeGuideColumn}><BuklodMapGuideDock active={focused} /></View>
            </>
          ) : (
            <>
              {mapNode}
              <BuklodMapGuideDock active={focused} artworkEmbedded />
            </>
          )}
        </View>
        {showDirectory ? <View style={styles.districtPanel}>
          <View style={styles.panelHeading}>
            <MaterialCommunityIcons name={district.icon as any} size={27} color={district.accent}/>
            <View style={{flex:1}}>
              <Text style={styles.panelTitle}>{district.title}</Text>
              <Text style={styles.panelSubtitle}>{district.tagline}</Text>
            </View>
          </View>
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
        </View> : null}
        {showDirectory ? (
          <View style={styles.directory}>
            {BUKLOD_MAP_DISTRICTS.map(area => (
              <View key={area.id} style={styles.directorySection}>
                <Text style={styles.directoryArea}>{area.title}</Text>
                {visibleBuklodMapDestinations(area, showFaith).map(place => (
                  <Pressable
                    key={place.route}
                    accessibilityRole="button"
                    accessibilityLabel={'Open '+place.label}
                    onPress={() => router.push(place.route as any)}
                    style={styles.directoryEntry}
                  >
                    <Text style={styles.directoryEntryLabel}>{place.label}</Text>
                    <MaterialCommunityIcons name="chevron-right" color="#CEDAE9" size={19}/>
                  </Pressable>
                ))}
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.genesisAdFoot} accessibilityLabel="Sponsored content below the Genesis map">
          <BuklodAdMobBanner
            placement="home"
            placementId="genesis_entry_footer_banner"
            diagnosticName="legacy_home_banner"
            format="mediumRectangle"
            compact
            requireViewport
            showLabel
          />
        </View>
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
  content: { flexGrow: 1, paddingHorizontal: 14, width: '100%', maxWidth: 700, alignSelf: 'center' },
  genesisAdFoot:{marginTop:'auto',paddingTop:8,width:'100%',alignItems:'center',minHeight:8},
  landscapeContent:{maxWidth:1100,paddingHorizontal:6},
  landscapeFirstRow:{flexDirection:'row',alignItems:'flex-start',gap:8},
  landscapeMapColumn:{flex:6,minWidth:0,alignItems:'center'},
  landscapeGuideColumn:{flex:4,minWidth:0,paddingTop:3,gap:5},
  portraitFirstView:{gap:4},
  welcomeTextBlock:{paddingHorizontal:4,paddingTop:2,paddingBottom:2},
  welcomeTitle:{fontSize:19,lineHeight:25,fontWeight:'900',color:'#FFE2AF'},
  welcomeNote:{fontSize:12,lineHeight:17,color:'#DAE9F7'},
  mapSelectedCaption: {flexDirection:'row', alignItems:'center', justifyContent:'space-between',
    marginTop:7, paddingHorizontal:4, gap:8},
  selectedCaptionText: {fontSize:12, fontWeight:'900', color:'#FFE6AE', flex:1},
  selectedCaptionNote: {fontSize:10, color:'#BDD6E7', flexShrink:1, textAlign:'right'},
  directoryToggle: {marginTop:11, minHeight:45, flexDirection:'row', alignItems:'center',
    borderRadius:11, paddingHorizontal:13, justifyContent:'space-between',
    borderWidth:1, borderColor:'rgba(251,224,174,.40)', backgroundColor:'rgba(6,20,42,.85)'},
  directoryTitle: {fontSize:10, fontWeight:'900', letterSpacing:.4, color:'#FFE3A8'},
  directory: {backgroundColor:'rgba(7,20,42,.92)', borderRadius:14, padding:10, gap:10, marginTop:4},
  directorySection: {gap:3},
  directoryArea: {color:'#97E9D3', fontSize:12, fontWeight:'900', marginTop:8, marginBottom:4},
  directoryEntry: {flexDirection:'row', justifyContent:'space-between', alignItems:'center',
    borderTopWidth:StyleSheet.hairlineWidth, borderColor:'rgba(205,228,249,.2)', minHeight:45,
    paddingHorizontal:8},
  directoryEntryLabel: {color:'#F6FAFF', fontWeight:'700', fontSize:12},
  districtPanel: { marginTop: 12, borderRadius: 20, padding: 15, gap: 7, borderWidth: 1, borderColor: 'rgba(243,211,153,.35)', backgroundColor: 'rgba(6,20,42,.91)' },
  panelHeading: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 2 },
  panelTitle: { color: '#FFFFFF', fontSize: 19, fontWeight: '900' },
  panelSubtitle: { color: '#D4E6F9', fontSize: 12 },
  entry: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(205,228,249,.18)', flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 4, minHeight: 48 },
  entryPressed: { backgroundColor: 'rgba(255,255,255,.08)' },
  entryTitle: { color: '#F8FBFF', fontSize: 13, fontWeight: '800' },
  entryDesc: { color: '#BBCEE7', fontSize: 11, lineHeight: 15 },
  footer: { color: '#B3C8E5', fontSize: 10, lineHeight: 15, paddingVertical: 18, textAlign: 'center' },
});
