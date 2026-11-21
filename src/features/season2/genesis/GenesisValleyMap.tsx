/**
 * Genesis-only illustrated map. The supplied owner-approved Valley art is local
 * and all hit targets are mapped in image coordinates, never viewport pixels.
 * No route entitlement or ledger logic belongs in this presentation component.
 */
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  AccessibilityInfo, Animated, Pressable, ScrollView, StyleSheet,
  Text, View, useWindowDimensions,
} from 'react-native';
import {Image} from 'expo-image';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {getGenesisDeviceQuality} from './genesisDeviceQuality';
import valley from './genesisValleyHotspots.json';

export type GenesisValleyHotspot = Readonly<{
  id: string;
  label: string;
  districtId: string;
  route: string;
  icon: string;
  x: number;
  y: number;
  faithOnly: boolean;
}>;

export const GENESIS_VALLEY_HOTSPOTS: readonly GenesisValleyHotspot[] = valley.hotspots;
const HIGH_RES = require('../../../../assets/season2/genesis/world/buklod-community-map.webp');
const LOW_RAM = require('../../../../assets/season2/genesis/world/buklod-community-map-compact.webp');
const MAP_ASPECT = 1086 / 1448;

export default function GenesisValleyMap({
  active, showFaith, selectedHotspotId, onSelect,
}: {
  active: boolean;
  showFaith: boolean;
  selectedHotspotId: string;
  onSelect: (hotspot: GenesisValleyHotspot) => void;
}) {
  const {width: windowWidth} = useWindowDimensions();
  const viewportWidth = Math.min(700, Math.max(280, windowWidth - 28));
  const quality = getGenesisDeviceQuality('home');
  const [zoomed, setZoomed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const horizontalRef = useRef<ScrollView | null>(null);
  const aura = useRef(new Animated.Value(0)).current;
  const imageWidth = zoomed ? Math.max(860, Math.round(viewportWidth * 1.7)) : viewportWidth;
  const imageHeight = imageWidth * MAP_ASPECT;
  const selected = GENESIS_VALLEY_HOTSPOTS.find(h => h.id === selectedHotspotId);
  const points = useMemo(
    () => GENESIS_VALLEY_HOTSPOTS.filter(h => !h.faithOnly || showFaith),
    [showFaith],
  );

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(v => {
      if (alive) setReducedMotion(v);
    }).catch(() => undefined);
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    aura.stopAnimation();
    aura.setValue(0);
    if (!active || reducedMotion || quality === 'minimal') return;
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(aura, {toValue: 1, duration: 1250, useNativeDriver: true}),
      Animated.timing(aura, {toValue: 0, duration: 1250, useNativeDriver: true}),
    ]));
    pulse.start();
    return () => { pulse.stop(); aura.stopAnimation(); };
  }, [active, aura, quality, reducedMotion]);

  useEffect(() => {
    const nextX = zoomed && selected
      ? Math.max(0, Math.min(imageWidth - viewportWidth, selected.x * imageWidth - viewportWidth / 2))
      : 0;
    horizontalRef.current?.scrollTo({x: nextX, animated: active});
  }, [active, imageWidth, selectedHotspotId, viewportWidth, zoomed]);

  return (
    <View style={styles.container}>
      <View style={styles.topline}>
        <View style={styles.topText}>
          <Text style={styles.mapTitle}>EXPLORE BUKLOD WORLD</Text>
          <Text style={styles.hint}>Piliin ang gusali, saka buksan ang destinasyon.</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={zoomed ? 'Show entire BUKLOD map' : 'Zoom in to explore BUKLOD map'}
          accessibilityHint="Switches between full-world overview and larger horizontally pannable illustration"
          onPress={() => setZoomed(v => !v)}
          style={({pressed}) => [styles.zoom, pressed && styles.press]}
        >
          <MaterialCommunityIcons name={zoomed ? 'magnify-minus-outline' : 'magnify-plus-outline'} size={20} color="#FFE5AC" />
          <Text style={styles.zoomText}>{zoomed ? 'OVERVIEW' : 'EXPLORE'}</Text>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        ref={horizontalRef}
        nestedScrollEnabled
        bounces={false}
        scrollEnabled={zoomed}
        showsHorizontalScrollIndicator={false}
        style={[styles.scroller, {height: imageHeight}]}
        contentContainerStyle={{width: zoomed ? imageWidth : viewportWidth}}
        accessibilityLabel="BUKLOD illustrated community map"
      >
        <View style={{width: imageWidth, height: imageHeight}}>
          <Image
            source={quality === 'minimal' ? LOW_RAM : HIGH_RES}
            contentFit="fill"
            transition={reducedMotion ? 0 : 180}
            style={StyleSheet.absoluteFill}
            accessibilityLabel="Illustrated BUKLOD Valley with fourteen community buildings"
            accessible={false}
          />
          {points.map(hotspot => {
            const chosen = hotspot.id === selectedHotspotId;
            // Keep gold-icon center alignment while enlarging tap targets for Android.
            // Clamp edge icons to the image so no target is clipped on narrow phones.
            const diameter = zoomed ? 48 : 44;
            const x = Math.max(diameter / 2, Math.min(imageWidth - diameter / 2, hotspot.x * imageWidth));
            const y = Math.max(diameter / 2, Math.min(imageHeight - diameter / 2, hotspot.y * imageHeight));
            return (
              <Pressable
                key={hotspot.id}
                accessibilityRole="button"
                accessibilityLabel={hotspot.label}
                accessibilityHint={'Select the '+hotspot.label+' destination'}
                accessibilityState={{selected: chosen}}
                onPress={() => onSelect(hotspot)}
                style={({pressed}) => [
                  styles.hotspot,
                  {
                    width: diameter, height: diameter,
                    left: x - diameter / 2,
                    top: y - diameter / 2,
                    opacity: pressed ? 0.72 : 1,
                  },
                ]}
              >
                {chosen && (
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.halo,
                      {
                        opacity: aura.interpolate({inputRange: [0, 1], outputRange: [0.6, 0.95]}),
                        transform: [{scale: aura.interpolate({inputRange: [0, 1], outputRange: [1, 1.28]})}],
                      },
                    ]}
                  />
                )}
                <View style={[styles.dot, chosen && styles.chosenDot]}>
                  <MaterialCommunityIcons
                    name={hotspot.icon as any}
                    size={chosen ? 17 : (zoomed ? 15 : 12)}
                    color={chosen ? '#1A2340' : '#FFF3CB'}
                  />
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <View style={styles.legend}>
        <MaterialCommunityIcons name="map-marker-radius-outline" size={16} color="#F4D197" />
        <Text numberOfLines={1} style={styles.legendText}>
          {selected && (!selected.faithOnly || showFaith) ? selected.label : 'Pumili ng lokasyon'}
        </Text>
        <Text style={styles.legendHint}>{zoomed ? 'Swipe sideways to explore' : 'Zoom for larger touch targets'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden', borderRadius: 21, backgroundColor: '#101F34',
    borderWidth: 1, borderColor: 'rgba(251,224,174,.58)',
  },
  topline: {flexDirection:'row', justifyContent:'space-between', alignItems:'center',
    paddingVertical: 10, paddingHorizontal: 11, backgroundColor: 'rgba(8,19,37,.96)', gap: 7},
  topText: {flex:1, minWidth:0},
  mapTitle: {fontSize: 12, fontWeight: '900', color:'#FFE3B0', letterSpacing: .6},
  hint: {fontSize: 10, lineHeight: 14, color: '#C8DCEF', paddingTop: 2},
  zoom: {minHeight: 40, paddingHorizontal: 9, flexDirection:'row', alignItems:'center',
    borderRadius: 17, gap: 4, backgroundColor:'#1C3552', borderWidth:1, borderColor:'#7BA1A9'},
  zoomText: {fontSize: 10, fontWeight:'900', color:'#FFE5AC'},
  scroller: {flexGrow: 0, backgroundColor:'#DCC9A0'},
  hotspot: {position:'absolute', zIndex:3, justifyContent:'center', alignItems:'center'},
  dot: {width:22, height:22, borderRadius:11, backgroundColor:'rgba(23,35,65,.64)',
    borderWidth: 1, borderColor:'rgba(255,238,178,.95)', justifyContent:'center',
    alignItems:'center', elevation:2},
  chosenDot: {width:29, height:29, borderRadius:15, backgroundColor:'#FFE2A8',
    borderWidth:2, borderColor:'#27364A', elevation:6},
  halo: {position:'absolute', width: 36, height:36, borderRadius:18, borderWidth: 3,
    borderColor: '#FFF1B6', backgroundColor:'rgba(251,235,189,.21)'},
  legend: {minHeight:40, paddingHorizontal:11, paddingVertical:6, flexDirection:'row', gap:7,
    alignItems:'center', backgroundColor:'rgba(7,22,42,.97)'},
  legendText: {flex:1, minWidth:0, fontSize:11, fontWeight:'900', color:'#FFF4D7'},
  legendHint: {fontSize:9, color:'#BDD0E5'},
  press: {opacity:.74},
});
