import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack } from 'expo-router';

import { useBuklodReduceMotion } from '@/components/HomeMotion';
import KlAudioControls from '@/components/kabihasnang-ligaw/KlAudioControls';
import {
  buildAssetGate,
  buildCatalogEpisodes,
  KL_AUTHOR,
  KL_SEASON_ONE_TITLE,
} from '@/lib/kabihasnang-ligaw/catalog';
import { klCopy } from '@/lib/kabihasnang-ligaw/copy';
import { memberReadable } from '@/lib/kabihasnang-ligaw/gates';
import { isLowBandwidth } from '@/lib/kabihasnang-ligaw/livingMotion';
import { journeySummary } from '@/lib/kabihasnang-ligaw/journey';
import {
  DEFAULT_READER_CACHE,
  imageSlot,
  queueReaderIssue,
  rememberScroll,
  sanitizeReaderCache,
  type ReaderCache,
} from '@/lib/kabihasnang-ligaw/readerSession';
import { KL_RPC } from '@/lib/kabihasnang-ligaw/rpc';
import { peekDzasPlaying } from '@/lib/buklodDzasRadio';
import { supabase } from '@/lib/supabase';
import { getBuklodPttRuntimeState } from '@/ptt/buklodPttRuntime';
import { useAuth } from '@/providers/AuthProvider';
import { useNetwork } from '@/providers/NetworkProvider';

const EPISODES = buildCatalogEpisodes();
const ASSETS = buildAssetGate();

function cacheKey(userId: string | null): string {
  return `kl.reader.v1.${userId ?? 'device'}`;
}

function otherAudioPlaying(): boolean {
  const ptt = getBuklodPttRuntimeState();
  return peekDzasPlaying() || ptt.transmitting || ptt.priorityReceiving;
}

export default function KlReaderScreen() {
  const { width } = useWindowDimensions();
  const reduceMotion = useBuklodReduceMotion();
  const { online } = useNetwork();
  const { user } = useAuth();
  const [cache, setCache] = useState<ReaderCache>(DEFAULT_READER_CACHE);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [appActive, setAppActive] = useState(true);
  const [externalAudio, setExternalAudio] = useState(false);
  const [cellGeneration, setCellGeneration] = useState<string | null>(null);
  const [connectionType, setConnectionType] = useState('unknown');

  const compact = width < 420;
  const bodySize = Math.round(19 * cache.textScale);
  const selected = EPISODES.find((episode) => episode.id === selectedId) ?? null;
  const selectedAssets = ASSETS.filter((asset) => asset.episodeId === selected?.id);
  const decision = selected ? memberReadable(selected, selectedAssets) : null;
  const lowBandwidth = isLowBandwidth({
    online,
    connectionType,
    cellularGeneration: cellGeneration,
    userDataSaver: cache.dataSaver,
  });
  const picture = imageSlot(null, lowBandwidth);
  const journey = journeySummary(0, 30);
  const music = ASSETS.find((asset) => asset.id === 'asset-music');
  const ambient = ASSETS.find((asset) => asset.id === 'asset-ambient');

  const persist = useCallback(async (next: ReaderCache) => {
    setCache(next);
    try {
      await AsyncStorage.setItem(cacheKey(user?.id ?? null), JSON.stringify(next));
    } catch {
      setNotice(klCopy.couldNotOpen);
    }
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(cacheKey(user?.id ?? null)).then((raw) => {
      if (!active || !raw) return;
      try {
        const parsed = sanitizeReaderCache(JSON.parse(raw) as ReaderCache);
        setCache(parsed);
        setSelectedId(parsed.lastEpisodeId);
      } catch {
        setNotice(klCopy.couldNotOpen);
      }
    });
    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    const appSub = AppState.addEventListener('change', (state) => {
      setAppActive(state === 'active');
    });
    const timer = setInterval(() => setExternalAudio(otherAudioPlaying()), 1000);
    const netSub = NetInfo.addEventListener((state) => {
      setConnectionType(String(state.type ?? 'unknown'));
      const details = state.details as { cellularGeneration?: string } | null;
      setCellGeneration(details?.cellularGeneration ?? null);
    });
    return () => {
      appSub.remove();
      clearInterval(timer);
      netSub();
    };
  }, []);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const { error } = await supabase.rpc(KL_RPC.listLibrary);
      if (error) {
        await persist(queueReaderIssue(cache, {
          kind: 'library',
          detail: 'library_refresh_failed',
          at: new Date().toISOString(),
        }));
        setNotice(online ? klCopy.couldNotOpen : klCopy.weakNetwork);
      } else {
        setNotice(online ? null : klCopy.weakNetwork);
      }
    } catch {
      setNotice(klCopy.couldNotOpen);
    } finally {
      setBusy(false);
    }
  }, [cache, online, persist]);

  const openEpisode = async (episodeId: string) => {
    const episode = EPISODES.find((item) => item.id === episodeId);
    if (!episode) return;
    const readable = memberReadable(episode, ASSETS.filter((asset) => asset.episodeId === episodeId)).readable;
    setSelectedId(episodeId);
    setGlossaryOpen(false);
    await persist(rememberScroll(cache, episodeId, 0, readable));
  };

  const waitingCopy = useMemo(() => {
    if (!selected) return null;
    if (selected.kind === 'panimula') return klCopy.panimulaNotReady;
    if (selected.manuscriptStatus === 'outline_only') return klCopy.outlineLocked;
    return klCopy.notReady;
  }, [selected]);

  return (
    <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingHorizontal: compact ? 16 : 24 }]}>
      <Stack.Screen options={{ title: 'Kabihasnang Ligaw' }} />
      <Text style={styles.kicker}>{klCopy.libraryKicker}</Text>
      <Text style={[styles.title, compact && styles.titleCompact]}>{KL_SEASON_ONE_TITLE}</Text>
      <Text style={styles.by}>{KL_AUTHOR}</Text>
      <Text style={styles.lede}>{klCopy.librarySubtitle}</Text>

      {!online || notice ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{notice ?? klCopy.weakNetwork}</Text>
          <Pressable accessibilityRole="button" onPress={() => void refresh()} style={styles.secondary}>
            <Text style={styles.secondaryText}>{busy ? klCopy.tryAgain : klCopy.tryAgain}</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>{klCopy.journey}</Text>
        <Text style={styles.body}>{klCopy.journeyEmpty}</Text>
        <Text style={styles.meta}>{journey.completed} / {journey.total}</Text>
        <Text style={styles.meta}>{klCopy.journeyNote}</Text>
      </View>

      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          onPress={() => void persist({ ...cache, textScale: Math.max(0.85, cache.textScale - 0.1) })}
          style={styles.secondary}
        >
          <Text style={styles.secondaryText}>{klCopy.textSmaller}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => void persist({ ...cache, textScale: Math.min(1.35, cache.textScale + 0.1) })}
          style={styles.secondary}
        >
          <Text style={styles.secondaryText}>{klCopy.textLarger}</Text>
        </Pressable>
      </View>

      <View style={styles.row}>
        <Pressable onPress={() => void persist({ ...cache, motionEnabled: !cache.motionEnabled })} style={styles.secondary}>
          <Text style={styles.secondaryText}>{klCopy.motion}</Text>
        </Pressable>
        <Pressable onPress={() => void persist({ ...cache, batterySaver: !cache.batterySaver })} style={styles.secondary}>
          <Text style={styles.secondaryText}>{klCopy.battery}</Text>
        </Pressable>
        <Pressable onPress={() => void persist({ ...cache, dataSaver: !cache.dataSaver })} style={styles.secondary}>
          <Text style={styles.secondaryText}>{klCopy.dataSaver}</Text>
        </Pressable>
      </View>
      {!appActive || reduceMotion || cache.batterySaver || !cache.motionEnabled || lowBandwidth ? (
        <Text style={styles.meta}>{klCopy.motionPaused}</Text>
      ) : null}

      <KlAudioControls
        musicStatus={music?.classification ?? 'MISSING'}
        ambientStatus={ambient?.classification ?? 'MISSING'}
        otherAudioPlaying={externalAudio}
        musicMuted={cache.musicMuted}
        ambientMuted={cache.ambientMuted}
        musicVolume={cache.musicVolume}
        ambientVolume={cache.ambientVolume}
        onToggleMute={(channel) => void persist(channel === 'music'
          ? { ...cache, musicMuted: !cache.musicMuted }
          : { ...cache, ambientMuted: !cache.ambientMuted })}
        onCycleVolume={(channel) => {
          const steps = [0.3, 0.6, 1];
          if (channel === 'music') {
            const next = steps.find((step) => step > cache.musicVolume) ?? steps[0];
            void persist({ ...cache, musicVolume: next });
            return;
          }
          const next = steps.find((step) => step > cache.ambientVolume) ?? steps[0];
          void persist({ ...cache, ambientVolume: next });
        }}
        onUnavailable={(channel) => {
          void persist(queueReaderIssue(cache, {
            kind: 'audio',
            detail: channel === 'music' ? 'music_missing' : 'ambient_missing',
            at: new Date().toISOString(),
          }));
          setNotice(channel === 'music' ? klCopy.noMusic : klCopy.noAmbient);
        }}
      />

      <Pressable accessibilityRole="button" onPress={() => setGlossaryOpen((open) => !open)} style={styles.secondary}>
        <Text style={styles.secondaryText}>{klCopy.glossary}</Text>
      </Pressable>
      {glossaryOpen ? <Text style={[styles.body, { fontSize: bodySize, lineHeight: Math.round(bodySize * 1.65) }]}>{klCopy.glossaryEmpty}</Text> : null}

      <Pressable accessibilityRole="button" onPress={() => void refresh()} style={styles.secondary}>
        <Text style={styles.secondaryText}>{klCopy.tryAgain}</Text>
      </Pressable>

      {selected ? (
        <View style={styles.reader}>
          <Pressable accessibilityRole="button" onPress={() => setSelectedId(null)} style={styles.secondary}>
            <Text style={styles.secondaryText}>{klCopy.back}</Text>
          </Pressable>
          <Text style={styles.kicker}>{selected.kind === 'panimula' ? 'PANIMULA' : `KABANATA ${String(selected.episodeNumber).padStart(2, '0')}`}</Text>
          <Text style={[styles.chapter, compact && styles.titleCompact]}>{selected.titleMode === 'outline_label' ? selected.title : selected.title}</Text>
          <Text style={[styles.body, { fontSize: bodySize, lineHeight: Math.round(bodySize * 1.65) }]}>
            {decision?.readable ? '' : `${waitingCopy} ${klCopy.readerWaiting}`}
          </Text>
          <Text style={styles.meta}>{picture.message === 'withheld' ? klCopy.imageWithheld : klCopy.noImage}</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {EPISODES.map((episode) => (
            <Pressable
              key={episode.id}
              accessibilityRole="button"
              onPress={() => void openEpisode(episode.id)}
              style={styles.episode}
            >
              <Text style={styles.episodeTitle}>{episode.title}</Text>
              <Text style={styles.meta}>{klCopy.locked}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#101a20' },
  content: { paddingTop: 22, paddingBottom: 72, maxWidth: 760, width: '100%', alignSelf: 'center', gap: 14 },
  kicker: { color: '#e5c891', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  title: { color: '#f6dfb0', fontSize: 34, fontWeight: '800', lineHeight: 40 },
  titleCompact: { fontSize: 28, lineHeight: 34 },
  chapter: { color: '#f6dfb0', fontSize: 30, fontWeight: '800', lineHeight: 36, marginTop: 8 },
  by: { color: '#c5c9c6', fontSize: 14 },
  lede: { color: '#e2e9df', fontSize: 16, lineHeight: 24 },
  body: { color: '#f1ece3', fontSize: 18, lineHeight: 30 },
  meta: { color: '#d6c8ad', fontSize: 13, lineHeight: 20 },
  banner: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#78613c', gap: 8 },
  bannerText: { color: '#f1ece3', fontSize: 15, lineHeight: 22 },
  panel: { padding: 14, borderRadius: 16, backgroundColor: '#16262a', gap: 6 },
  panelTitle: { color: '#f6dfb0', fontSize: 16, fontWeight: '800' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  secondary: {
    minHeight: 42,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3d4c46',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#182428',
  },
  secondaryText: { color: '#f1d39b', fontSize: 13, fontWeight: '700' },
  list: { gap: 8 },
  episode: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#31443d',
    backgroundColor: '#142226',
    gap: 4,
  },
  episodeTitle: { color: '#fff4df', fontSize: 16, fontWeight: '700' },
  reader: { gap: 10, paddingTop: 8 },
});
