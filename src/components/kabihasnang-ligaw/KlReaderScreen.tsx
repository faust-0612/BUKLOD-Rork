import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  NativeScrollEvent,
  NativeSyntheticEvent,
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
import KlSceneMotion from '@/components/kabihasnang-ligaw/KlSceneMotion';
import {
  buildAssetGate,
  buildCatalogEpisodes,
  buildStoryboard,
  KL_AUTHOR,
  KL_CHAPTER_ONE_LIVING_SCOPE,
  KL_SEASON_ONE_TITLE,
} from '@/lib/kabihasnang-ligaw/catalog';
import { klCopy } from '@/lib/kabihasnang-ligaw/copy';
import { KL_ECONOMY_V2 } from '@/lib/kabihasnang-ligaw/economyPolicy';
import { KL_MONETIZATION } from '@/lib/kabihasnang-ligaw/monetizationPolicy';
import { memberReadable } from '@/lib/kabihasnang-ligaw/gates';
import { isLowBandwidth, resolveLivingMotion, visibleLivingLayers } from '@/lib/kabihasnang-ligaw/livingMotion';
import { paragraphDisplayText, splitCanonicalParagraphs } from '@/lib/kabihasnang-ligaw/manuscript';
import { journeySummary } from '@/lib/kabihasnang-ligaw/journey';
import {
  DEFAULT_READER_CACHE,
  queueReaderIssue,
  rememberReleasedReading,
  rememberScroll,
  sanitizeReaderCache,
  sceneArtDecision,
  selectMemberReading,
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
const STORYBOARD = buildStoryboard();

function cacheKey(userId: string | null): string {
  return `kl.reader.v1.${userId ?? 'device'}`;
}

function otherAudioPlaying(): boolean {
  const ptt = getBuklodPttRuntimeState();
  return peekDzasPlaying() || ptt.transmitting || ptt.priorityReceiving;
}

export default function KlReaderScreen() {
  const { width, height } = useWindowDimensions();
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
  const [serverState, setServerState] = useState<'unread' | 'readable' | 'hidden' | 'unknown'>('unread');
  const [serverText, setServerText] = useState<string | null>(null);
  const [viewStart, setViewStart] = useState<number | null>(null);
  const [viewEnd, setViewEnd] = useState<number | null>(null);
  const paragraphY = useRef<Record<number, number>>({});

  const compact = width < 420;
  const bodySize = Math.round(19 * cache.textScale);
  const selected = EPISODES.find((episode) => episode.id === selectedId) ?? null;
  const selectedAssets = ASSETS.filter((asset) => asset.episodeId === selected?.id);
  const decision = selected ? memberReadable(selected, selectedAssets, new Date(), STORYBOARD) : null;
  const lowBandwidth = isLowBandwidth({
    online,
    connectionType,
    cellularGeneration: cellGeneration,
    userDataSaver: cache.dataSaver,
  });
  const canonicalRelease = Boolean(selected && decision?.readable && (selected.episodeNumber === 0 || selected.episodeNumber === 1));
  const reading = selectMemberReading({
    locallyReadable: decision?.readable === true,
    serverState: canonicalRelease && serverState === 'hidden' ? 'unknown' : serverState,
    serverText,
    bundledText: selected?.prose ?? null,
    cachedText: selected ? cache.releasedProse[selected.id] ?? null : null,
  });
  const paragraphs = reading.text ? splitCanonicalParagraphs(reading.text, selected?.episodeNumber ?? 0) : [];
  const sceneRows = STORYBOARD.filter((row) => row.episodeId === selected?.id);
  const revealStart = sceneRows.find((row) => row.spoiler)?.paragraphRange?.start ?? null;
  const living = visibleLivingLayers({
    layers: KL_CHAPTER_ONE_LIVING_SCOPE.filter((layer) => layer.episodeId === selected?.id),
    viewStart,
    viewEnd,
    revealParagraph: revealStart,
  });
  const motion = resolveLivingMotion({
    boundToManuscriptParagraph: living.length > 0,
    manuscriptApprovedComplete: Boolean(
      selected && selected.manuscriptStatus === 'approved_complete' && selected.proseComplete,
    ),
    ownerApproved: selectedAssets.some((asset) => asset.kind === 'illustration' && asset.approved),
    depictsStory: true,
    technicalFixture: false,
    allowUnapprovedPreview: false,
    visible: viewStart != null && appActive,
    appActive,
    reduceMotion,
    userMotionEnabled: cache.motionEnabled,
    batterySaver: cache.batterySaver,
    lowBandwidth,
    layers: living,
  });
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

  const syncViewport = (scrollY: number) => {
    const entries = Object.entries(paragraphY.current)
      .map(([index, y]) => ({ index: Number(index), y }))
      .sort((left, right) => left.y - right.y);
    const top = scrollY + 24;
    const bottom = scrollY + Math.max(320, height);
    let start: number | null = null;
    let end: number | null = null;
    for (let index = 0; index < entries.length; index += 1) {
      const current = entries[index];
      const nextY = entries[index + 1]?.y ?? current.y + 240;
      if (nextY > top && current.y < bottom) {
        if (start == null) start = current.index;
        end = current.index;
      }
    }
    setViewStart(start);
    setViewEnd(end);
  };

  const openEpisode = async (episodeId: string) => {
    const episode = EPISODES.find((item) => item.id === episodeId);
    if (!episode) return;
    const episodeAssets = ASSETS.filter((asset) => asset.episodeId === episodeId);
    const readable = memberReadable(episode, episodeAssets, new Date(), STORYBOARD).readable;
    paragraphY.current = {};
    setViewStart(null);
    setViewEnd(null);
    setServerState('unread');
    setServerText(null);
    setSelectedId(episodeId);
    setGlossaryOpen(false);
    let nextCache = rememberScroll(cache, episodeId, 0, readable);
    try {
      const { data, error } = await supabase.rpc(KL_RPC.readEpisode, { p_episode_id: episodeId });
      if (error || !data || typeof data !== 'object') {
        setServerState('unknown');
      } else {
        const payload = data as { readable?: boolean; content?: { text?: string }[] };
        if (payload.readable === true && Array.isArray(payload.content)) {
          const text = payload.content.map((paragraph) => paragraph.text ?? '').filter(Boolean).join('\n\n');
          setServerText(text);
          setServerState('readable');
          nextCache = rememberReleasedReading(nextCache, episodeId, text, true);
        } else {
          setServerState('hidden');
          setServerText(null);
          nextCache = rememberReleasedReading(nextCache, episodeId, null, false);
        }
      }
    } catch {
      setServerState('unknown');
      setNotice(online ? klCopy.couldNotOpen : klCopy.weakNetwork);
    }
    await persist(nextCache);
  };

  const waitingCopy = useMemo(() => {
    if (!selected) return null;
    if (selected.kind === 'panimula') return klCopy.panimulaNotReady;
    if (selected.manuscriptStatus === 'outline_only') return klCopy.outlineLocked;
    return klCopy.notReady;
  }, [selected]);

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[styles.content, { paddingHorizontal: compact ? 16 : 24 }]}
      scrollEventThrottle={32}
      onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => syncViewport(event.nativeEvent.contentOffset.y)}
    >
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
        <Text style={styles.panelTitle}>Gantimpala sa Pagbabasa</Text>
        <Text style={styles.body}>{`+${KL_ECONOMY_V2.chapterCompletionPoints} points sa unang verified chapter completion; +${KL_ECONOMY_V2.meaningfulCommentPoints} sa eligible comment.`}</Text>
        <Text style={styles.meta}>Ibinibigay lamang ang points kapag nakumpirma ng server. Hindi pa aktibo ang bagong reward policy.</Text>
      </View>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Libreng Pagbabasa</Text>
        <Text style={styles.meta}>{KL_MONETIZATION.freeMainStory ? 'Libreng basahin ang pangunahing kuwento.' : 'Hindi available ang pagbabasa.'} Walang ads sa gitna ng kabanata.</Text>
      </View>
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
          {paragraphs.length > 0 ? (
            <View>
              {paragraphs.map((paragraph) => {
                const scene = sceneRows.find((row) => row.paragraphRange?.start === paragraph.index);
                const sceneStill = scene && scene.sceneId !== 's1-e01-shot-05'
                  ? selectedAssets.find((asset) => asset.sceneId === scene.sceneId && asset.kind === 'illustration' && asset.approved && asset.classification === 'APPROVED')
                  : null;
                const art = scene
                  ? sceneArtDecision({
                    spoiler: scene.spoiler,
                    rangeStart: scene.paragraphRange?.start ?? null,
                    reachedParagraph: viewEnd,
                    approvedUri: sceneStill?.path ?? null,
                    lowBandwidth,
                  })
                  : null;
                return (
                  <View
                    key={paragraph.id}
                    testID={paragraph.id}
                    onLayout={(event) => {
                      paragraphY.current[paragraph.index] = event.nativeEvent.layout.y;
                    }}
                    style={styles.paragraph}
                  >
                    <Text style={[
                      paragraph.kind === 'heading' ? styles.kicker : styles.body,
                      paragraph.kind === 'body' && { fontSize: bodySize, lineHeight: Math.round(bodySize * 1.65) },
                    ]}
                    >
                      {paragraphDisplayText(paragraph)}
                    </Text>
                    {art && art.message !== 'spoiler_held' ? (
                      <Text style={styles.meta}>{art.message === 'withheld' ? klCopy.imageWithheld : klCopy.noImage}</Text>
                    ) : null}
                  </View>
                );
              })}
              <KlSceneMotion animate={motion.animate} layers={motion.layers} />
            </View>
          ) : (
            <Text style={[styles.body, { fontSize: bodySize, lineHeight: Math.round(bodySize * 1.65) }]}>
              {`${waitingCopy} ${klCopy.readerWaiting}`}
            </Text>
          )}
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
              <Text style={styles.meta}>
                {memberReadable(episode, ASSETS.filter((asset) => asset.episodeId === episode.id), new Date(), STORYBOARD).readable
                  ? klCopy.readable
                  : klCopy.locked}
              </Text>
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
  paragraph: { marginBottom: 14 },
});
