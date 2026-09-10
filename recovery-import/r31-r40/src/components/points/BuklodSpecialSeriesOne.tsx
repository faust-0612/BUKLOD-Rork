/* BUKLOD_CHARACTER_R37B_SPECIAL_SERIES1_PREVIEW
 * Passport-preview surface only.
 * No ownership, unlock, points, BCU, redeem, DB or active-character mutation.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import {
  discoverMyBuklodSpecialCharacter,
  getMyBuklodSpecialCharacterPursuit,
  getMyBuklodSpecialCharacterState,
  setMyBuklodSpecialCharacterActive,
  setMyBuklodSpecialCharacterPursuit,
  unlockMyBuklodSpecialCharacter,
  type BuklodSpecialCharacterServerState,
  type BuklodSpecialCharacterStateMap,
} from '@/lib/buklodSpecialCharacterServer';
import {
  BUKLOD_SPECIAL_SERIES_1,
  BUKLOD_SPECIAL_SERIES_1_ORDER,
  type BuklodSpecialCharacterId,
} from '@/lib/buklodSpecialCharacters';

const ART = {
  jawo: {
    thumb: require('../../../assets/images/characters/special-series1/jawo_thumb.webp'),
    medium: require('../../../assets/images/characters/special-series1/jawo_medium.webp'),
  },
  trudice: {
    thumb: require('../../../assets/images/characters/special-series1/trudice_thumb.webp'),
    medium: require('../../../assets/images/characters/special-series1/trudice_medium.webp'),
  },
  ace: {
    thumb: require('../../../assets/images/characters/special-series1/ace_thumb.webp'),
    medium: require('../../../assets/images/characters/special-series1/ace_medium.webp'),
  },
  mitch: {
    thumb: require('../../../assets/images/characters/special-series1/mitch_thumb.webp'),
    medium: require('../../../assets/images/characters/special-series1/mitch_medium.webp'),
  },
  niel: {
    thumb: require('../../../assets/images/characters/special-series1/niel_thumb.webp'),
    medium: require('../../../assets/images/characters/special-series1/niel_medium.webp'),
  },
  angel: {
    thumb: require('../../../assets/images/characters/special-series1/angel_thumb.webp'),
    medium: require('../../../assets/images/characters/special-series1/angel_medium.webp'),
  },
  vhen: {
    thumb: require('../../../assets/images/characters/special-series1/vhen_thumb.webp'),
    medium: require('../../../assets/images/characters/special-series1/vhen_medium.webp'),
  },
  ellusur: {
    thumb: require('../../../assets/images/characters/special-series1/ellusur_thumb.webp'),
    medium: require('../../../assets/images/characters/special-series1/ellusur_medium.webp'),
  },
} as const;

function stateLabel(state: BuklodSpecialCharacterServerState | null) {
  if (!state) return 'PREVIEW · SYNCING';
  switch (state.state) {
    case 'CLUES_AVAILABLE':
      return 'CLUES AVAILABLE';
    case 'FRAGMENT_PROGRESS':
      return `${state.fragment_count}/${state.required_fragments} FRAGMENTS`;
    case 'READY_TO_DISCOVER':
      return 'READY TO DISCOVER';
    case 'READY_TO_UNLOCK':
      return 'DISCOVERED · UNLOCK READY';
    case 'OWNED_INACTIVE':
      return 'OWNED · INACTIVE';
    case 'ACTIVE':
      return 'ACTIVE';
    default:
      return 'PREVIEW · LOCKED';
  }
}

function stateIcon(
  state: BuklodSpecialCharacterServerState | null,
): 'lock-outline' | 'map-marker-path' | 'puzzle-outline' | 'star-circle-outline' | 'check-decagram-outline' {
  if (!state) return 'lock-outline';
  switch (state.state) {
    case 'CLUES_AVAILABLE':
      return 'map-marker-path';
    case 'FRAGMENT_PROGRESS':
      return 'puzzle-outline';
    case 'READY_TO_DISCOVER':
    case 'READY_TO_UNLOCK':
      return 'star-circle-outline';
    case 'OWNED_INACTIVE':
    case 'ACTIVE':
      return 'check-decagram-outline';
    default:
      return 'lock-outline';
  }
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Unable to update Special Character progress.';
}

export default function BuklodSpecialSeriesOne() {
  const { theme } = useBuklodPresentation();
  const [openId, setOpenId] =
    useState<BuklodSpecialCharacterId | null>(null);
  const [serverStates, setServerStates] =
    useState<BuklodSpecialCharacterStateMap>({});
  const [pursuitId, setPursuitId] =
    useState<BuklodSpecialCharacterId | null>(null);
  const [serverLoading, setServerLoading] = useState(true);
  const [serverAction, setServerAction] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const openProfile = useMemo(
    () => (openId ? BUKLOD_SPECIAL_SERIES_1[openId] : null),
    [openId],
  );
  const openServerState = useMemo(
    () => (openId ? serverStates[openId] ?? null : null),
    [openId, serverStates],
  );
  const activeSpecialId = useMemo(
    () =>
      BUKLOD_SPECIAL_SERIES_1_ORDER.find(
        (id) => Boolean(serverStates[id]?.active),
      ) ?? null,
    [serverStates],
  );
  const activeSpecialProfile = useMemo(
    () =>
      activeSpecialId
        ? BUKLOD_SPECIAL_SERIES_1[activeSpecialId]
        : null,
    [activeSpecialId],
  );

  const loadServerStates = useCallback(async () => {
    setServerLoading(true);
    setServerError(null);
    try {
      const [next, pursuit] = await Promise.all([
        getMyBuklodSpecialCharacterState(),
        getMyBuklodSpecialCharacterPursuit(),
      ]);
      setServerStates(next);
      setPursuitId(pursuit.pursuit_character_id ?? null);
    } catch (error) {
      setServerError(errorMessage(error));
    } finally {
      setServerLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadServerStates();
  }, [loadServerStates]);

  const runServerAction = useCallback(
    async (
      action:
        | 'pursue'
        | 'stopPursuit'
        | 'discover'
        | 'unlock'
        | 'activate'
        | 'deactivate',
      characterId: BuklodSpecialCharacterId,
    ) => {
      const actionKey = `${action}:${characterId}`;
      setServerAction(actionKey);
      setServerError(null);
      try {
        if (action === 'pursue') {
          await setMyBuklodSpecialCharacterPursuit(characterId);
        } else if (action === 'stopPursuit') {
          await setMyBuklodSpecialCharacterPursuit(null);
        } else if (action === 'discover') {
          await discoverMyBuklodSpecialCharacter(characterId);
        } else if (action === 'unlock') {
          await unlockMyBuklodSpecialCharacter(characterId);
        } else if (action === 'activate') {
          await setMyBuklodSpecialCharacterActive(characterId);
        } else {
          await setMyBuklodSpecialCharacterActive(null);
        }
        await loadServerStates();
      } catch (error) {
        const message = errorMessage(error);
        setServerError(message);
        Alert.alert('Special Character', message);
      } finally {
        setServerAction(null);
      }
    },
    [loadServerStates],
  );

  return (
    <View
      style={[
        styles.wrap,
        {
          borderColor: theme.border,
          backgroundColor: theme.surfaceElevated,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={[styles.eyebrow, { color: theme.accent }]}>
            SPECIAL CHARACTERS · SERIES 1
          </Text>
          <Text style={[styles.title, { color: theme.textPrimary }]}>
            Eight new BUKLOD journeys
          </Text>
          <Text style={[styles.note, { color: theme.textMuted }]}>
            Additions to Phan, Quin, Van, Christian and Lhen — never replacements.
            Passport previews stay available while the server-authoritative discovery system
            tracks clues, Journey proof and Character Fragments. DISCOVER and UNLOCK remain manual.
          </Text>
        </View>
        <MaterialCommunityIcons
          name="account-star-outline"
          size={26}
          color={theme.accent}
        />
      </View>

      {activeSpecialId && activeSpecialProfile ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open active Special Character ${activeSpecialProfile.name}`}
          onPress={() => setOpenId(activeSpecialId)}
          style={({ pressed }) => [
            styles.activeHero,
            {
              borderColor: theme.accentSoft,
              backgroundColor: theme.surface,
            },
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.activeHeroTopRow}>
            <View style={styles.activeHeroLabelWrap}>
              <MaterialCommunityIcons
                name="check-decagram"
                size={18}
                color={theme.accent}
              />
              <View style={styles.activeHeroLabelCopy}>
                <Text style={[styles.activeHeroEyebrow, { color: theme.accent }]}>
                  ACTIVE SPECIAL CHARACTER · MAIN VIEW
                </Text>
                <Text style={[styles.activeHeroName, { color: theme.textPrimary }]}>
                  {activeSpecialProfile.name}
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.activeHeroState,
                {
                  borderColor: theme.accentSoft,
                  backgroundColor: theme.surfaceMuted,
                },
              ]}
            >
              <Text style={[styles.activeHeroStateText, { color: theme.accent }]}>
                {stateLabel(serverStates[activeSpecialId] ?? null)}
              </Text>
            </View>
          </View>

          <View style={styles.activeHeroFrame}>
            <Image
              source={ART[activeSpecialId].medium}
              style={styles.activeHeroImage}
              contentFit="contain"
              transition={160}
            />
          </View>

          <Text style={[styles.activeHeroRole, { color: theme.textPrimary }]}>
            {activeSpecialProfile.role}
          </Text>
          <Text style={[styles.activeHeroMeta, { color: theme.textSecondary }]}>
            {activeSpecialProfile.profession}
          </Text>
          <Text style={[styles.activeHeroNote, { color: theme.textMuted }]}>
            Special identity is active. Core Character progression, collectibles,
            CP, BCU and global rewards remain preserved separately.
          </Text>
        </Pressable>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {BUKLOD_SPECIAL_SERIES_1_ORDER.map((id) => {
          const profile = BUKLOD_SPECIAL_SERIES_1[id];
          const serverState = serverStates[id] ?? null;
          const isPursued = pursuitId === id;
          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityLabel={`Preview ${profile.name}`}
              onPress={() => setOpenId(id)}
              style={({ pressed }) => [
                styles.card,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.surfaceMuted,
                },
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.thumbFrame}>
                <Image
                  source={ART[id].thumb}
                  style={styles.thumb}
                  contentFit="contain"
                  transition={120}
                />
              </View>

              <Text style={[styles.name, { color: theme.textPrimary }]}>
                {profile.name}
              </Text>
              <Text style={[styles.role, { color: theme.textSecondary }]} numberOfLines={2}>
                {profile.role}
              </Text>

              <View
                style={[
                  styles.lockPill,
                  {
                    borderColor: theme.border,
                    backgroundColor: theme.surface,
                  },
                ]}
              >
                {serverLoading && !serverState ? (
                  <ActivityIndicator size={10} color={theme.textMuted} />
                ) : (
                  <MaterialCommunityIcons
                    name={stateIcon(serverState)}
                    size={12}
                    color={serverState?.active ? theme.accent : theme.textMuted}
                  />
                )}
                <Text
                  style={[
                    styles.lockText,
                    {
                      color: serverState?.active
                        ? theme.accent
                        : theme.textMuted,
                    },
                  ]}
                >
                  {stateLabel(serverState)}
                </Text>
              </View>
              {isPursued ? (
                <View style={[styles.pursuitChip, { borderColor: theme.accentSoft }]}>
                  <MaterialCommunityIcons
                    name="map-marker-path"
                    size={11}
                    color={theme.accent}
                  />
                  <Text style={[styles.pursuitChipText, { color: theme.accent }]}>
                    JOURNEY TRACKED
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.policyRow}>
        <Text style={[styles.policy, { color: theme.textMuted }]}>
          Special Character unlock is not a CP purchase. Default Series 1 model:
          participation milestone + meaningful Journey + 5 Character Fragments.
          Progress is read from the protected server; previewing alone changes nothing.
          Verified canonical activities can add fragments only to the Character Journey
          you explicitly track, and one source cannot be claimed twice across Series 1.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh Special Character progress"
          onPress={() => void loadServerStates()}
          disabled={serverLoading}
          hitSlop={8}
          style={({ pressed }) => [
            styles.refreshButton,
            {
              borderColor: theme.border,
              backgroundColor: theme.surface,
            },
            pressed && styles.pressed,
          ]}
        >
          {serverLoading ? (
            <ActivityIndicator size="small" color={theme.accent} />
          ) : (
            <MaterialCommunityIcons
              name="refresh"
              size={16}
              color={theme.accent}
            />
          )}
        </Pressable>
      </View>

      <Modal
        visible={Boolean(openProfile)}
        transparent
        animationType="fade"
        onRequestClose={() => setOpenId(null)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setOpenId(null)}
        >
          <Pressable
            style={[
              styles.modalCard,
              {
                borderColor: theme.border,
                backgroundColor: theme.surface,
              },
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            {openProfile && openId ? (
              <ScrollView
                contentContainerStyle={styles.modalContent}
                showsVerticalScrollIndicator
              >
                <View style={styles.modalTopRow}>
                  <View style={styles.modalTitleWrap}>
                    <Text style={[styles.modalEyebrow, { color: theme.accent }]}>
                      SERIES 1 · CHARACTER PASSPORT PREVIEW
                    </Text>
                    <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                      {openProfile.name}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close preview"
                    onPress={() => setOpenId(null)}
                    hitSlop={8}
                  >
                    <MaterialCommunityIcons
                      name="close"
                      size={24}
                      color={theme.textMuted}
                    />
                  </Pressable>
                </View>

                <View style={styles.mediumFrame}>
                  <Image
                    source={ART[openId].medium}
                    style={styles.medium}
                    contentFit="contain"
                    transition={140}
                  />
                </View>

                <Text style={[styles.profileLine, { color: theme.textPrimary }]}>
                  {openProfile.role}
                </Text>
                <Text style={[styles.profileMeta, { color: theme.textSecondary }]}>
                  {openProfile.profession}
                </Text>
                <Text style={[styles.profileMeta, { color: theme.textMuted }]}>
                  {openProfile.personality}
                </Text>

                <Text style={[styles.stageTitle, { color: theme.textPrimary }]}>
                  STAGES 1–20
                </Text>
                <View style={styles.stageGrid}>
                  {openProfile.stages.map((stage, index) => (
                    <View
                      key={`${openProfile.id}-stage-${index + 1}`}
                      style={[
                        styles.stageChip,
                        {
                          borderColor: theme.border,
                          backgroundColor: theme.surfaceMuted,
                        },
                      ]}
                    >
                      <Text style={[styles.stageNo, { color: theme.accent }]}>
                        {index + 1}
                      </Text>
                      <Text style={[styles.stageName, { color: theme.textSecondary }]}>
                        {stage}
                      </Text>
                    </View>
                  ))}
                </View>

                <View
                  style={[
                    styles.unlockBox,
                    {
                      borderColor: theme.border,
                      backgroundColor: theme.surfaceMuted,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={stateIcon(openServerState)}
                    size={22}
                    color={theme.accent}
                  />
                  <View style={styles.unlockCopy}>
                    <View style={styles.unlockHeadingRow}>
                      <Text style={[styles.unlockTitle, { color: theme.textPrimary }]}>
                        Protected discovery progress
                      </Text>
                      {serverLoading ? (
                        <ActivityIndicator size="small" color={theme.accent} />
                      ) : null}
                    </View>

                    <View style={styles.requirementRow}>
                      <MaterialCommunityIcons
                        name={
                          openServerState?.participation_met
                            ? 'check-circle-outline'
                            : 'circle-outline'
                        }
                        size={15}
                        color={
                          openServerState?.participation_met
                            ? theme.accent
                            : theme.textMuted
                        }
                      />
                      <Text style={[styles.requirementText, { color: theme.textSecondary }]}>
                        Participation milestone
                      </Text>
                    </View>

                    <View style={styles.requirementRow}>
                      <MaterialCommunityIcons
                        name={
                          openServerState?.meaningful_journey_met
                            ? 'check-circle-outline'
                            : 'circle-outline'
                        }
                        size={15}
                        color={
                          openServerState?.meaningful_journey_met
                            ? theme.accent
                            : theme.textMuted
                        }
                      />
                      <Text style={[styles.requirementText, { color: theme.textSecondary }]}>
                        Meaningful Journey
                      </Text>
                    </View>

                    <View style={styles.requirementRow}>
                      <MaterialCommunityIcons
                        name="puzzle-outline"
                        size={15}
                        color={theme.accent}
                      />
                      <Text style={[styles.requirementText, { color: theme.textSecondary }]}>
                        Character Fragments: {openServerState?.fragment_count ?? 0}/
                        {openServerState?.required_fragments
                          ?? openProfile.defaultFragmentsRequired}
                      </Text>
                    </View>

                    <Text style={[styles.unlockText, { color: theme.textMuted }]}>
                      State: {stateLabel(openServerState)}. Previewing does not grant
                      fragments, discover, unlock, activate, spend CP or award BCU.
                    </Text>

                    {!openServerState?.unlocked_at ? (
                      <View
                        style={[
                          styles.pursuitBox,
                          {
                            borderColor:
                              pursuitId === openProfile.id
                                ? theme.accentSoft
                                : theme.border,
                            backgroundColor: theme.surface,
                          },
                        ]}
                      >
                        <View style={styles.pursuitCopy}>
                          <MaterialCommunityIcons
                            name={
                              pursuitId === openProfile.id
                                ? 'check-circle-outline'
                                : 'map-marker-path'
                            }
                            size={18}
                            color={theme.accent}
                          />
                          <View style={styles.pursuitTextWrap}>
                            <Text style={[styles.pursuitTitle, { color: theme.textPrimary }]}>
                              {pursuitId === openProfile.id
                                ? 'Tracking this Character Journey'
                                : 'Track this Character Journey'}
                            </Text>
                            <Text style={[styles.pursuitText, { color: theme.textMuted }]}>
                              Only the Character you explicitly track receives eligible
                              canonical fragments. Switching Journey keeps existing progress,
                              and the same source cannot be reused for another Character.
                            </Text>
                          </View>
                        </View>

                        {pursuitId === openProfile.id ? (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Stop tracking ${openProfile.name}`}
                            disabled={Boolean(serverAction)}
                            onPress={() => void runServerAction('stopPursuit', openProfile.id)}
                            style={({ pressed }) => [
                              styles.secondaryActionButton,
                              {
                                borderColor: theme.border,
                                backgroundColor: theme.surfaceMuted,
                              },
                              pressed && styles.pressed,
                            ]}
                          >
                            {serverAction === `stopPursuit:${openProfile.id}` ? (
                              <ActivityIndicator size="small" color={theme.accent} />
                            ) : (
                              <Text
                                style={[
                                  styles.secondaryActionText,
                                  { color: theme.accent },
                                ]}
                              >
                                STOP TRACKING
                              </Text>
                            )}
                          </Pressable>
                        ) : (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Track ${openProfile.name} Character Journey`}
                            disabled={Boolean(serverAction)}
                            onPress={() => void runServerAction('pursue', openProfile.id)}
                            style={({ pressed }) => [
                              styles.actionButton,
                              { backgroundColor: theme.accent },
                              pressed && styles.pressed,
                            ]}
                          >
                            {serverAction === `pursue:${openProfile.id}` ? (
                              <ActivityIndicator size="small" color={theme.white} />
                            ) : (
                              <Text style={[styles.actionText, { color: theme.white }]}>
                                TRACK THIS JOURNEY
                              </Text>
                            )}
                          </Pressable>
                        )}
                      </View>
                    ) : null}

                    {serverError ? (
                      <Text style={[styles.serverError, { color: theme.danger }]}>
                        {serverError}
                      </Text>
                    ) : null}

                    {openServerState?.state === 'READY_TO_DISCOVER' ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Discover ${openProfile.name}`}
                        disabled={Boolean(serverAction)}
                        onPress={() => void runServerAction('discover', openProfile.id)}
                        style={({ pressed }) => [
                          styles.actionButton,
                          { backgroundColor: theme.accent },
                          pressed && styles.pressed,
                        ]}
                      >
                        {serverAction === `discover:${openProfile.id}` ? (
                          <ActivityIndicator size="small" color={theme.white} />
                        ) : (
                          <Text style={[styles.actionText, { color: theme.white }]}>
                            DISCOVER
                          </Text>
                        )}
                      </Pressable>
                    ) : null}

                    {openServerState?.state === 'READY_TO_UNLOCK' ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Unlock ${openProfile.name}`}
                        disabled={Boolean(serverAction)}
                        onPress={() => void runServerAction('unlock', openProfile.id)}
                        style={({ pressed }) => [
                          styles.actionButton,
                          { backgroundColor: theme.accent },
                          pressed && styles.pressed,
                        ]}
                      >
                        {serverAction === `unlock:${openProfile.id}` ? (
                          <ActivityIndicator size="small" color={theme.white} />
                        ) : (
                          <Text style={[styles.actionText, { color: theme.white }]}>
                            UNLOCK
                          </Text>
                        )}
                      </Pressable>
                    ) : null}

                    {openServerState?.state === 'OWNED_INACTIVE' ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Activate ${openProfile.name}`}
                        disabled={Boolean(serverAction)}
                        onPress={() => void runServerAction('activate', openProfile.id)}
                        style={({ pressed }) => [
                          styles.actionButton,
                          { backgroundColor: theme.accent },
                          pressed && styles.pressed,
                        ]}
                      >
                        {serverAction === `activate:${openProfile.id}` ? (
                          <ActivityIndicator size="small" color={theme.white} />
                        ) : (
                          <Text style={[styles.actionText, { color: theme.white }]}>
                            USE CHARACTER
                          </Text>
                        )}
                      </Pressable>
                    ) : null}

                    {openServerState?.state === 'ACTIVE' ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Deactivate ${openProfile.name}`}
                        disabled={Boolean(serverAction)}
                        onPress={() => void runServerAction('deactivate', openProfile.id)}
                        style={({ pressed }) => [
                          styles.secondaryActionButton,
                          {
                            borderColor: theme.border,
                            backgroundColor: theme.surface,
                          },
                          pressed && styles.pressed,
                        ]}
                      >
                        {serverAction === `deactivate:${openProfile.id}` ? (
                          <ActivityIndicator size="small" color={theme.accent} />
                        ) : (
                          <Text style={[styles.secondaryActionText, { color: theme.accent }]}>
                            STOP USING SPECIAL CHARACTER
                          </Text>
                        )}
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              </ScrollView>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 14,
    paddingBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 14,
  },
  headerCopy: {
    flex: 1,
    gap: 3,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
  },
  note: {
    fontSize: 10,
    lineHeight: 15,
  },
  activeHero: {
    marginHorizontal: 14,
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    overflow: 'hidden',
  },
  activeHeroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  activeHeroLabelWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeHeroLabelCopy: {
    flex: 1,
  },
  activeHeroEyebrow: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.55,
  },
  activeHeroName: {
    marginTop: 2,
    fontSize: 21,
    fontWeight: '900',
  },
  activeHeroState: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  activeHeroStateText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.35,
  },
  activeHeroFrame: {
    marginTop: 10,
    width: '100%',
    height: 330,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 14,
  },
  activeHeroImage: {
    width: '100%',
    height: '100%',
  },
  activeHeroRole: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '900',
  },
  activeHeroMeta: {
    marginTop: 2,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
  },
  activeHeroNote: {
    marginTop: 7,
    fontSize: 9,
    lineHeight: 13,
  },
  row: {
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  card: {
    width: 176,
    borderWidth: 1,
    borderRadius: 16,
    padding: 9,
  },
  pressed: {
    opacity: 0.75,
  },
  thumbFrame: {
    width: '100%',
    height: 132,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 12,
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  name: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: '900',
  },
  role: {
    marginTop: 2,
    minHeight: 28,
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '700',
  },
  lockPill: {
    marginTop: 7,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  lockText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  policyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  policy: {
    flex: 1,
    fontSize: 9,
    lineHeight: 13,
  },
  refreshButton: {
    width: 34,
    height: 34,
    borderWidth: 1,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    width: '100%',
    maxWidth: 620,
    maxHeight: '92%',
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalContent: {
    padding: 16,
    paddingBottom: 28,
  },
  modalTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  modalTitleWrap: {
    flex: 1,
  },
  modalEyebrow: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  modalTitle: {
    marginTop: 2,
    fontSize: 24,
    fontWeight: '900',
  },
  mediumFrame: {
    marginTop: 12,
    width: '100%',
    height: 360,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 16,
  },
  medium: {
    width: '100%',
    height: '100%',
  },
  profileLine: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '900',
  },
  profileMeta: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 16,
  },
  stageTitle: {
    marginTop: 16,
    marginBottom: 8,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  stageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  stageChip: {
    width: '48%',
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  stageNo: {
    width: 18,
    fontSize: 10,
    fontWeight: '900',
  },
  stageName: {
    flex: 1,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '700',
  },
  unlockBox: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  unlockCopy: {
    flex: 1,
  },
  unlockHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  unlockTitle: {
    flex: 1,
    fontSize: 11,
    fontWeight: '900',
  },
  requirementRow: {
    marginTop: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  requirementText: {
    flex: 1,
    fontSize: 10,
    fontWeight: '700',
  },
  unlockText: {
    marginTop: 8,
    fontSize: 10,
    lineHeight: 15,
  },
  pursuitChip: {
    marginTop: 6,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  pursuitChipText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.35,
  },
  pursuitBox: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  pursuitCopy: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  pursuitTextWrap: {
    flex: 1,
  },
  pursuitTitle: {
    fontSize: 10,
    fontWeight: '900',
  },
  pursuitText: {
    marginTop: 3,
    fontSize: 9,
    lineHeight: 13,
  },
  serverError: {
    marginTop: 8,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
  },
  actionButton: {
    marginTop: 10,
    minHeight: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  secondaryActionButton: {
    marginTop: 10,
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryActionText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.35,
    textAlign: 'center',
  },
});
