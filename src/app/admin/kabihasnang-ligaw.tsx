import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useAudioPlayer } from 'expo-audio';

import { AdminGate } from '@/components/AdminGate';
import KlAudioControls from '@/components/kabihasnang-ligaw/KlAudioControls';
import KlLivingFixture from '@/components/kabihasnang-ligaw/KlLivingFixture';
import KlSceneMotion from '@/components/kabihasnang-ligaw/KlSceneMotion';
import { useBuklodReduceMotion } from '@/components/HomeMotion';
import {
  appendRevision,
  adminApprovalBlockers,
  defaultAdminFlow,
  draftDiffersFromNextRelease,
  draftForEpisode,
  focusEpisodeId,
  friendlyEpisodeLabel,
  isMemberReleasedEpisode,
  KL_ADMIN_FLOW_STORAGE_KEY,
  manilaStamp,
  markEpisodeApproved,
  markNextReleaseScheduled,
  mergeEpisodeForAdmin,
  nextApprovalEpisodeNumber,
  nextReleaseSummary,
  patchEpisodeDraft,
  replaceNextReleaseFromDesk,
  revisionThreadForEpisode,
  sanitizeAdminFlow,
  type AdminApprovalFlow,
} from '@/lib/kabihasnang-ligaw/adminApproval';
import {
  approvalQueue,
  isReleasedForApproval,
  manilaCivilDate,
  manilaDayRelation,
  nextApprovalArrival,
  nextLiveRelease,
} from '@/lib/kabihasnang-ligaw/approvalQueue';
import { manilaSixUtc } from '@/lib/kabihasnang-ligaw/gates';
import {
  buildAssetGate,
  buildCatalogEpisodes,
  klEpisodeId,
} from '@/lib/kabihasnang-ligaw/catalog';
import {
  paragraphDisplayText,
  splitCanonicalParagraphs,
} from '@/lib/kabihasnang-ligaw/manuscript';
import { adminActionArgs, KL_RPC, type AdminAction } from '@/lib/kabihasnang-ligaw/rpc';
import {
  adminImageSource,
  KL_ADMIN_IMAGE_CHOICES,
} from '@/lib/kabihasnang-ligaw/sceneStills';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

const EPISODES = buildCatalogEpisodes();
const ASSETS = buildAssetGate();

const MUSIC_PREVIEW = require('../../../assets/bible-ambience/night.wav');
const AMBIENT_PREVIEW = require('../../../assets/bible-ambience/wind.wav');

const PRIMARY_ACTIONS: AdminAction[] = ['approve', 'revise', 'correct', 'schedule'];
const MORE_ACTIONS: AdminAction[] = [
  'pause',
  'hold',
  'resume',
  'pause_season',
  'resume_season',
  'emergency_stop',
  'emergency_clear',
];

function actionLabel(action: AdminAction): string {
  switch (action) {
    case 'approve':
      return 'Approve';
    case 'revise':
      return 'Send revision';
    case 'correct':
      return 'Save quick fix';
    case 'schedule':
      return 'Schedule 6:00 a.m.';
    case 'pause':
      return 'Pause chapter';
    case 'hold':
      return 'Hold';
    case 'resume':
      return 'Resume chapter';
    case 'pause_season':
      return 'Pause season';
    case 'resume_season':
      return 'Resume season';
    case 'emergency_stop':
      return 'Emergency stop';
    case 'emergency_clear':
      return 'Clear emergency';
    default:
      return action;
  }
}

function LightAction({
  label,
  onPress,
  disabled,
  primary,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.lightAction, primary && styles.lightActionPrimary, disabled && styles.disabled]}
    >
      <Text style={[styles.lightActionText, primary && styles.lightActionTextPrimary]}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function KabihasnangLigawAdminScreen() {
  const reduceMotion = useBuklodReduceMotion();
  const [flow, setFlow] = useState<AdminApprovalFlow>(() => defaultAdminFlow(EPISODES));
  const [hydrated, setHydrated] = useState(false);
  const [episodeId, setEpisodeId] = useState(() => focusEpisodeId(defaultAdminFlow(EPISODES)));
  const [notes, setNotes] = useState('');
  const [manilaDate, setManilaDate] = useState('2026-10-22');
  const [result, setResult] = useState('Panimula and Kabanata 1 are already with members. Next approval starts at Kabanata 02.');
  const [busy, setBusy] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [musicIntent, setMusicIntent] = useState(false);
  const [ambientIntent, setAmbientIntent] = useState(false);
  const [musicMuted, setMusicMuted] = useState(false);
  const [ambientMuted, setAmbientMuted] = useState(false);
  const [musicVolume, setMusicVolume] = useState(0.7);
  const [ambientVolume, setAmbientVolume] = useState(0.45);

  const musicPlayer = useAudioPlayer(MUSIC_PREVIEW);
  const ambientPlayer = useAudioPlayer(AMBIENT_PREVIEW);

  const catalogEpisode = EPISODES.find((item) => item.id === episodeId) ?? EPISODES[2] ?? EPISODES[0];
  const draft = draftForEpisode(flow, catalogEpisode);
  const episode = mergeEpisodeForAdmin(catalogEpisode, draft);
  const blockers = useMemo(
    () => adminApprovalBlockers(episode, draft, KL_ADMIN_IMAGE_CHOICES.length > 0),
    [episode, draft],
  );
  const now = new Date();
  const openEntries = approvalQueue(now);
  const openNumbers = new Set(openEntries.map((entry) => entry.episodeNumber));
  const released = EPISODES.filter((item) => isMemberReleasedEpisode(item.episodeNumber));
  const queue = EPISODES.filter((item) => openNumbers.has(item.episodeNumber));
  const nextArrival = nextApprovalArrival(now);
  const nextLive = nextLiveRelease(now);
  const nextArrivalTitle = EPISODES.find((item) => item.episodeNumber === nextArrival?.episodeNumber)?.title;
  const nextLiveTitle = EPISODES.find((item) => item.episodeNumber === nextLive?.episodeNumber)?.title;
  const paragraphs = episode.prose
    ? splitCanonicalParagraphs(episode.prose, episode.episodeNumber)
    : [];
  const revisions = revisionThreadForEpisode(flow, episode.id);
  const selectedImage = adminImageSource(draft.imageKey);
  const scheduledImage = adminImageSource(flow.nextRelease?.imageKey ?? null);
  const nextNumber = nextApprovalEpisodeNumber(queue, flow.drafts);
  const canApprove = blockers.length === 0 && !busy && openNumbers.has(episode.episodeNumber);
  const releaseDateOk = Boolean(manilaSixUtc(manilaDate));
  const deskDiffers = draftDiffersFromNextRelease(draft, catalogEpisode, flow.nextRelease);
  const nextReleaseParagraphs = flow.nextRelease
    ? splitCanonicalParagraphs(flow.nextRelease.prose, flow.nextRelease.episodeNumber)
    : [];

  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem(KL_ADMIN_FLOW_STORAGE_KEY)
      .then((raw) => {
        if (!alive) return;
        if (!raw) {
          setHydrated(true);
          return;
        }
        try {
          const parsed = sanitizeAdminFlow(JSON.parse(raw), EPISODES);
          setFlow(parsed);
          setEpisodeId(focusEpisodeId(parsed));
        } catch {
          // Keep default flow when storage is corrupt.
        } finally {
          setHydrated(true);
        }
      })
      .catch(() => {
        if (alive) setHydrated(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void AsyncStorage.setItem(KL_ADMIN_FLOW_STORAGE_KEY, JSON.stringify(flow)).catch(() => undefined);
  }, [flow, hydrated]);

  const openKey = openEntries.map((entry) => entry.episodeNumber).join(',');
  useEffect(() => {
    if (!hydrated) return;
    if (isMemberReleasedEpisode(catalogEpisode.episodeNumber)) return;
    const open = new Set(openKey.split(',').filter(Boolean).map(Number));
    if (open.has(catalogEpisode.episodeNumber)) return;
    const first = Number(openKey.split(',')[0]);
    if (Number.isInteger(first) && first > 0) setEpisodeId(klEpisodeId(first));
  }, [hydrated, catalogEpisode.episodeNumber, openKey]);

  useEffect(() => {
    setFlow((current) => {
      if (current.drafts[catalogEpisode.id]) return current;
      if (!catalogEpisode.prose) return current;
      return patchEpisodeDraft(current, catalogEpisode.id, {
        prose: catalogEpisode.prose,
        title: catalogEpisode.title,
      });
    });
    setMusicIntent(false);
    setAmbientIntent(false);
  }, [catalogEpisode.id, catalogEpisode.prose, catalogEpisode.title]);

  useEffect(() => {
    try {
      musicPlayer.volume = musicMuted ? 0 : musicVolume;
      if (draft.musicApplied && musicIntent && !musicMuted) musicPlayer.play();
      else musicPlayer.pause();
    } catch {
      // Preview audio is best-effort on admin desk only.
    }
  }, [draft.musicApplied, musicIntent, musicMuted, musicVolume, musicPlayer]);

  useEffect(() => {
    try {
      ambientPlayer.volume = ambientMuted ? 0 : ambientVolume;
      if (draft.musicApplied && ambientIntent && !ambientMuted) ambientPlayer.play();
      else ambientPlayer.pause();
    } catch {
      // Preview audio is best-effort on admin desk only.
    }
  }, [draft.musicApplied, ambientIntent, ambientMuted, ambientVolume, ambientPlayer]);

  const updateDraft = (patch: Parameters<typeof patchEpisodeDraft>[2]) => {
    setFlow((current) => patchEpisodeDraft(current, episode.id, patch));
  };

  const run = async (action: AdminAction) => {
    if (action === 'approve' && blockers.length > 0) {
      setResult(blockers[0]);
      return;
    }
    if ((action === 'approve' || action === 'schedule') && !releaseDateOk) {
      setResult('Set a valid release date (YYYY-MM-DD). Members open it at 6:00 a.m. Manila.');
      return;
    }
    if (action === 'schedule' && !flow.nextRelease) {
      setResult('Approve first. Schedule only sends the exact approved package.');
      return;
    }
    setBusy(true);
    try {
      if (action === 'revise' || action === 'correct') {
        const text = notes.trim() || (action === 'correct' ? 'Quick story fix saved for this chapter.' : '');
        if (action === 'revise' && !text) {
          setResult('Write the revision note so the feedback can come back clearly.');
          setBusy(false);
          return;
        }
        setFlow((current) => appendRevision(current, {
          episodeId: episode.id,
          direction: 'sent',
          text: text || draft.prose.slice(0, 280),
          action,
        }));
      }

      const targetEpisodeId = action === 'schedule'
        ? (flow.nextRelease?.episodeId ?? episode.id)
        : episode.id;
      const releaseNote = action === 'approve' || action === 'schedule'
        ? [
          notes.trim() || (action === 'approve'
            ? 'Approved exact desk preview for next release schedule.'
            : 'Schedule exact approved package for 6:00 a.m. Manila.'),
          flow.nextRelease
            ? `Frozen package: ${flow.nextRelease.fingerprint}`
            : `Pending freeze for ${episode.title}`,
          `Release date: ${manilaDate} 06:00 Asia/Manila`,
        ].join('\n')
        : (notes.trim() || (action === 'correct' ? 'Quick fix from story desk.' : ''));

      const args = adminActionArgs({
        action,
        episodeId: targetEpisodeId,
        notes: releaseNote,
        manilaDate: action === 'schedule' || action === 'approve' ? manilaDate : null,
      });
      const { data, error } = await supabase.rpc(KL_RPC.adminAction, args);
      if (error) {
        setFlow((current) => appendRevision(current, {
          episodeId: targetEpisodeId,
          direction: 'returned',
          text: 'Server could not accept this yet. Your notes stay here so you can send them again.',
          action,
        }));
        setResult('The server refused this action. Your revision notes are kept on this desk.');
        return;
      }
      const payload = data as { ok?: boolean; message?: string } | null;
      const ok = payload?.ok === true;
      const returned = (payload?.message || '').trim()
        || (ok
          ? 'Server accepted this step. Feedback is saved on this desk.'
          : 'Server did not publish this chapter. Feedback is still saved here.');

      setFlow((current) => {
        let next = appendRevision(current, {
          episodeId: targetEpisodeId,
          direction: 'returned',
          text: returned,
          action,
        });
        if (action === 'approve') {
          next = markEpisodeApproved(next, episode, EPISODES, manilaDate);
          if (ok) {
            next = markNextReleaseScheduled(next, manilaDate);
          }
          const package_ = next.nextRelease;
          const focusArrived = isReleasedForApproval(next.focusEpisodeNumber, now)
            || isMemberReleasedEpisode(next.focusEpisodeNumber);
          const focusNumber = focusArrived
            ? next.focusEpisodeNumber
            : (openEntries.at(-1)?.episodeNumber ?? next.focusEpisodeNumber);
          setEpisodeId(klEpisodeId(focusNumber));
          setResult(
            package_
              ? `${package_.title} locked for ${package_.manilaDate} 6:00 a.m. That exact text, picture, motion, and music are the next release. Next desk focus: Kabanata ${String(focusNumber).padStart(2, '0')}.`
              : `${episode.title} approved, but the release date was not valid.`,
          );
        } else if (action === 'schedule') {
          next = markNextReleaseScheduled(next, manilaDate);
          const package_ = next.nextRelease;
          setResult(
            package_
              ? `Scheduled. Members will receive exactly: ${nextReleaseSummary(package_)}.`
              : returned,
          );
        } else {
          setResult(returned);
        }
        return next;
      });
      if (action === 'revise' || action === 'correct') {
        setNotes('');
      }
    } catch {
      setFlow((current) => appendRevision(current, {
        episodeId: episode.id,
        direction: 'returned',
        text: 'Could not reach the server. Your notes stay saved on this phone.',
        action,
      }));
      setResult('Story admin could not reach the server. Nothing was published. Notes stay here.');
    } finally {
      setBusy(false);
    }
  };

  const lockDeskIntoSchedule = () => {
    if (!releaseDateOk) {
      setResult('Set a valid release date first.');
      return;
    }
    if (blockers.length > 0) {
      setResult(blockers[0]);
      return;
    }
    setFlow((current) => replaceNextReleaseFromDesk(current, catalogEpisode, manilaDate));
    setResult(
      `${episode.title} replaced the next release package. Schedule still uses this exact desk preview.`,
    );
  };

  return (
    <AdminGate>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Text style={styles.kicker}>BUKLOD ADMIN</Text>
        <Text style={styles.title}>Kabihasnang Ligaw — Story Management</Text>
        <Text style={styles.body}>
          Panimula and Kabanata 1 are already with members. This desk is for Kabanata 02 onward —
          exact release preview, picture choices, living motion, music, revision feedback, and quick story edits.
        </Text>
        <Text style={styles.ready}>
          Next to approve: Kabanata {String(nextNumber).padStart(2, '0')}
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Next release schedule</Text>
          {flow.nextRelease ? (
            <>
              <Text style={styles.ready}>
                {flow.nextRelease.scheduled ? 'Locked for members at' : 'Approved for'}
                {' '}
                {flow.nextRelease.manilaDate}
                {' '}
                6:00 a.m. Manila
              </Text>
              <Text style={styles.meta}>{nextReleaseSummary(flow.nextRelease)}</Text>
              {scheduledImage ? (
                <Image
                  source={scheduledImage}
                  style={styles.previewImage}
                  contentFit="cover"
                  accessibilityLabel="Exact picture for next release"
                />
              ) : null}
              {nextReleaseParagraphs.slice(0, 4).map((paragraph) => (
                <Text
                  key={`next-${paragraph.id}`}
                  style={paragraph.kind === 'heading' ? styles.heading : styles.story}
                >
                  {paragraphDisplayText(paragraph)}
                </Text>
              ))}
              {nextReleaseParagraphs.length > 4 ? (
                <Text style={styles.meta}>
                  +{nextReleaseParagraphs.length - 4} more paragraphs in the locked release package
                </Text>
              ) : null}
              <Text style={styles.meta}>
                Approve freezes this exact package. Later desk edits do not change the schedule unless you replace it.
              </Text>
            </>
          ) : (
            <Text style={styles.body}>
              Nothing is locked yet. When you approve, that exact preview becomes the next 6:00 a.m. release.
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Already with members</Text>
          {released.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => setEpisodeId(item.id)}
              style={[styles.row, item.id === episodeId && styles.rowOn]}
            >
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Text style={styles.meta}>Released · open only to review</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Approval queue</Text>
          <Text style={styles.body}>
            A new chapter arrives here at 6:00 p.m., two days before its 6:00 a.m. live release. Members do not see it until you approve it.
          </Text>
          {nextLive && nextLiveTitle ? (
            <Text style={styles.meta}>
              {manilaDayRelation(now, nextLive.at) === 'today' ? 'Today' : 'Tomorrow'}
              {', 6:00 a.m.: '}
              {nextLiveTitle}
              {' is the next live slot if you have approved it.'}
            </Text>
          ) : null}
          {nextArrival && nextArrivalTitle ? (
            <Text style={styles.meta}>
              {manilaDayRelation(now, nextArrival.at) === 'today' ? 'Today' : 'Tomorrow'}
              {', 6:00 p.m.: '}
              {nextArrivalTitle}
              {' arrives for approval.'}
            </Text>
          ) : (
            <Text style={styles.meta}>Every remaining chapter is already in this queue.</Text>
          )}
          {queue.map((item) => {
            const itemDraft = draftForEpisode(flow, item);
            const arrived = openEntries.find((entry) => entry.episodeNumber === item.episodeNumber);
            const arrivedToday = arrived?.releasedOn === manilaCivilDate(now);
            return (
              <Pressable
                key={item.id}
                onPress={() => setEpisodeId(item.id)}
                style={[styles.row, item.id === episodeId && styles.rowOn]}
              >
                <Text style={styles.rowTitle}>{itemDraft.title.trim() || item.title}</Text>
                <Text style={styles.meta}>
                  {friendlyEpisodeLabel(item, itemDraft, flow.nextRelease)}
                  {arrivedToday ? ' · Arrived today at 6:00 p.m.' : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {isMemberReleasedEpisode(episode.episodeNumber) ? 'Released preview' : 'Exact release preview'}
            {' · '}
            {episode.title}
          </Text>
          <Text style={styles.meta}>
            {paragraphs.length > 0
              ? `${paragraphs.length} paragraphs · what members will read`
              : 'No story text yet — write it below'}
          </Text>

          {selectedImage ? (
            <View style={styles.previewStage}>
              <Image
                source={selectedImage}
                style={styles.previewImage}
                contentFit="cover"
                accessibilityLabel="Chosen release picture"
              />
              {draft.animationApplied ? (
                <KlSceneMotion
                  animate={!reduceMotion}
                  layers={['wind_foliage', 'dust', 'magical_glow', 'water_ripples']}
                />
              ) : null}
            </View>
          ) : null}

          {paragraphs.length > 0 ? (
            paragraphs.map((paragraph) => (
              <Text
                key={paragraph.id}
                style={paragraph.kind === 'heading' ? styles.heading : styles.story}
              >
                {paragraphDisplayText(paragraph)}
              </Text>
            ))
          ) : (
            <Text style={styles.body}>Write the chapter below so this preview matches the release.</Text>
          )}

          {draft.animationApplied ? (
            <KlLivingFixture
              visible
              appActive
              reduceMotion={reduceMotion}
              userMotionEnabled
              batterySaver={false}
              lowBandwidth={false}
            />
          ) : null}

          {draft.musicApplied ? (
            <KlAudioControls
              musicStatus="APPROVED"
              ambientStatus="APPROVED"
              otherAudioPlaying={false}
              musicMuted={musicMuted}
              ambientMuted={ambientMuted}
              musicVolume={musicVolume}
              ambientVolume={ambientVolume}
              musicIntent={musicIntent}
              onTogglePlay={(channel) => {
                if (channel === 'music') setMusicIntent((value) => !value);
                else setAmbientIntent((value) => !value);
              }}
              onToggleMute={(channel) => {
                if (channel === 'music') setMusicMuted((value) => !value);
                else setAmbientMuted((value) => !value);
              }}
              onCycleVolume={(channel) => {
                const cycle = (value: number) => (value >= 0.9 ? 0.3 : Math.min(1, value + 0.2));
                if (channel === 'music') setMusicVolume((value) => cycle(value));
                else setAmbientVolume((value) => cycle(value));
              }}
            />
          ) : null}
        </View>

        {!isMemberReleasedEpisode(episode.episodeNumber) ? (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Edit story</Text>
              <Text style={styles.meta}>Change title or text now if something needs a quick fix.</Text>
              <TextInput
                value={draft.title}
                onChangeText={(title) => updateDraft({ title })}
                placeholder="Chapter title"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
              <TextInput
                value={draft.prose}
                onChangeText={(prose) => updateDraft({ prose })}
                placeholder="Paste or write the exact chapter text members will read…"
                placeholderTextColor={colors.muted}
                multiline
                textAlignVertical="top"
                style={[styles.input, styles.storyEditor]}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Picture choices</Text>
              <Text style={styles.meta}>Tap one image. No heavy buttons — just choose what members should see.</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageRow}>
                {KL_ADMIN_IMAGE_CHOICES.map((choice) => {
                  const on = draft.imageKey === choice.key;
                  return (
                    <Pressable
                      key={choice.key}
                      onPress={() => updateDraft({ imageKey: choice.key })}
                      style={[styles.imageChoice, on && styles.imageChoiceOn]}
                    >
                      <Image source={choice.source} style={styles.thumb} contentFit="cover" />
                      <Text style={styles.thumbLabel}>{choice.label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Motion and music for approval</Text>
              <Text style={styles.meta}>
                Apply both so the live preview matches the release feel before you approve.
              </Text>
              <View style={styles.softRow}>
                <LightAction
                  label={draft.animationApplied ? 'Motion on' : 'Apply motion'}
                  primary={draft.animationApplied}
                  onPress={() => updateDraft({ animationApplied: !draft.animationApplied })}
                />
                <LightAction
                  label={draft.musicApplied ? 'Music on' : 'Apply music'}
                  primary={draft.musicApplied}
                  onPress={() => {
                    const next = !draft.musicApplied;
                    updateDraft({ musicApplied: next });
                    setMusicIntent(next);
                    setAmbientIntent(next);
                  }}
                />
              </View>
              {ASSETS.filter((asset) => asset.required && (asset.kind === 'music' || asset.kind === 'ambient')).map((asset) => (
                <Text key={asset.id} style={styles.meta}>
                  {asset.kind === 'music' ? 'Music' : 'Ambient'}
                  {': '}
                  {draft.musicApplied ? 'Ready on this approval desk' : 'Not applied yet'}
                </Text>
              ))}
            </View>
          </>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Revision notes</Text>
          <Text style={styles.meta}>
            Notes go to the server and come back here as feedback, so the next release does not get confused.
          </Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="What should change before the next pass?"
            placeholderTextColor={colors.muted}
            multiline
            textAlignVertical="top"
            style={[styles.input, styles.notes]}
          />
          {revisions.length > 0 ? (
            <View style={styles.thread}>
              {revisions.slice().reverse().map((entry) => (
                <View key={entry.id} style={styles.threadItem}>
                  <Text style={styles.threadMeta}>
                    {entry.direction === 'sent' ? 'You sent' : 'Came back'}
                    {' · '}
                    {manilaStamp(entry.at)}
                    {' · '}
                    {actionLabel(entry.action as AdminAction)}
                  </Text>
                  <Text style={styles.threadBody}>{entry.text}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.meta}>No revision feedback yet for this chapter.</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Actions</Text>
          {!isMemberReleasedEpisode(episode.episodeNumber) && blockers.length > 0 ? (
            <Text style={styles.warning}>{blockers.join(' ')}</Text>
          ) : null}
          {deskDiffers ? (
            <Text style={styles.warning}>
              Desk preview changed after approve. The scheduled release still holds the older locked package until you replace it.
            </Text>
          ) : null}
          <Text style={styles.meta}>
            Release opens at 6:00 a.m. Manila on this date — same text, picture, motion, and music you approved.
          </Text>
          <TextInput
            value={manilaDate}
            onChangeText={setManilaDate}
            placeholder="Release date YYYY-MM-DD"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            style={styles.input}
          />
          <View style={styles.softRow}>
            {PRIMARY_ACTIONS.map((action) => (
              <LightAction
                key={action}
                label={actionLabel(action)}
                primary={action === 'approve'}
                disabled={
                  busy
                  || (action === 'approve' && !canApprove)
                  || (action === 'schedule' && !flow.nextRelease)
                }
                onPress={() => void run(action)}
              />
            ))}
          </View>
          {deskDiffers ? (
            <LightAction
              label="Replace scheduled release with this desk preview"
              disabled={busy || blockers.length > 0 || !releaseDateOk}
              onPress={lockDeskIntoSchedule}
            />
          ) : null}
          <Pressable onPress={() => setShowMore((value) => !value)} style={styles.moreToggle}>
            <Text style={styles.moreToggleText}>{showMore ? 'Hide more' : 'More controls'}</Text>
          </Pressable>
          {showMore ? (
            <View style={styles.softRow}>
              {MORE_ACTIONS.map((action) => (
                <LightAction
                  key={action}
                  label={actionLabel(action)}
                  disabled={busy}
                  onPress={() => void run(action)}
                />
              ))}
            </View>
          ) : null}
          <Text style={styles.body}>{result}</Text>
        </View>
      </ScrollView>
    </AdminGate>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, gap: 14, backgroundColor: colors.background, paddingBottom: 40 },
  kicker: { color: colors.greenDark, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  body: { color: colors.text, fontSize: 15, lineHeight: 22 },
  ready: { color: colors.greenDark, fontSize: 15, fontWeight: '700', lineHeight: 22 },
  warning: { color: '#8A5A00', fontSize: 14, lineHeight: 20 },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.line,
  },
  cardTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  row: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  rowOn: { backgroundColor: '#f3faf4', marginHorizontal: -6, paddingHorizontal: 6, borderRadius: 8 },
  rowTitle: { color: colors.text, fontWeight: '700' },
  heading: { color: colors.text, fontSize: 18, fontWeight: '800', lineHeight: 26, marginTop: 8 },
  story: { color: colors.text, fontSize: 16, lineHeight: 26 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 10,
    color: colors.text,
    backgroundColor: '#fcfcfb',
  },
  storyEditor: { minHeight: 180 },
  notes: { minHeight: 88 },
  imageRow: { gap: 10, paddingVertical: 4 },
  imageChoice: {
    width: 112,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 6,
    backgroundColor: '#fcfcfb',
  },
  imageChoiceOn: { borderColor: colors.greenDark, backgroundColor: '#f3faf4' },
  thumb: { width: '100%', height: 72, borderRadius: 8 },
  thumbLabel: { color: colors.text, fontSize: 11, lineHeight: 14 },
  previewStage: { gap: 6, marginVertical: 4 },
  previewImage: { width: '100%', height: 180, borderRadius: 12 },
  softRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  lightAction: {
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  lightActionPrimary: {
    borderBottomColor: colors.greenDark,
  },
  lightActionText: {
    color: colors.greenDark,
    fontSize: 14,
    fontWeight: '600',
  },
  lightActionTextPrimary: {
    fontWeight: '800',
  },
  moreToggle: { paddingVertical: 4 },
  moreToggleText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  thread: { gap: 10, marginTop: 4 },
  threadItem: { gap: 2, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  threadMeta: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  threadBody: { color: colors.text, fontSize: 14, lineHeight: 20 },
  disabled: { opacity: 0.4 },
});
