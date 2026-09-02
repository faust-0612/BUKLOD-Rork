import {
  useMemo,
  useState,
} from 'react';

import {
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  type BibleNarrationBook,
  type BibleNarrationMode,
  type BibleNarrationVerse,
} from '@/lib/buklodBibleNarration';
import {
  useBuklodBibleNarration,
} from '@/providers/BuklodBibleNarrationProvider';

type Props = {
  title?: string;
  subtitle?: string;
  translation: string;
  language: string;
  bookNo: number;
  bookName: string;
  chapterNo: number;
  verses: BibleNarrationVerse[];
  startVerseNo?: number | null;
  books?: BibleNarrationBook[];
  continueNextBook?: boolean;
  disabled?: boolean;
};

const MODES: Array<{
  id: BibleNarrationMode;
  label: string;
}> = [
  { id: 'pure', label: 'Pure Voice' },
  { id: 'expressive', label: 'Expressive' },
  { id: 'dramatized', label: 'Dramatized' },
];

function clamp01(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function VolumeStrip({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  disabled?: boolean;
}) {
  const [width, setWidth] = useState(1);

  const apply = (x: number) => {
    if (disabled) {
      return;
    }
    onChange(clamp01(x / Math.max(1, width)));
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: () => !disabled,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          apply(event.nativeEvent.locationX);
        },
        onPanResponderMove: (event) => {
          apply(event.nativeEvent.locationX);
        },
      }),
    [disabled, onChange, width]
  );

  return (
    <View style={styles.volumeRow}>
      <Text
        style={[
          styles.volumeLabel,
          disabled && styles.dimText,
        ]}
      >
        {label}
      </Text>
      <View
        style={[
          styles.volumeTrack,
          disabled && styles.volumeDisabled,
        ]}
        onLayout={(event) => {
          setWidth(
            Math.max(1, event.nativeEvent.layout.width)
          );
        }}
        {...panResponder.panHandlers}
      >
        <View
          pointerEvents="none"
          style={[
            styles.volumeFill,
            {
              width: `${Math.round(clamp01(value) * 100)}%`,
            },
          ]}
        />
      </View>
      <Text
        style={[
          styles.volumeValue,
          disabled && styles.dimText,
        ]}
      >
        {Math.round(clamp01(value) * 100)}
      </Text>
    </View>
  );
}

export function BuklodBibleNarrationBar({
  title = 'Listen to Scripture',
  subtitle = 'One play continues verse by verse, then to the next chapter, until you stop.',
  translation,
  language,
  bookNo,
  bookName,
  chapterNo,
  verses,
  startVerseNo,
  books,
  continueNextBook = true,
  disabled = false,
}: Props) {
  const {
    snapshot,
    play,
    pause,
    resume,
    stop,
    setMode,
    setSfxEnabled,
    setVoiceVolume,
    setSfxVolume,
  } = useBuklodBibleNarration();

  const active = snapshot.status !== 'idle';
  const playing = snapshot.status === 'playing';
  const paused = snapshot.status === 'paused';
  const loading = snapshot.status === 'loading';
  const sfxActive = snapshot.mode === 'dramatized';
  const canStart = !disabled && verses.length > 0;

  const nowReading = active
    ? `${snapshot.bookName || bookName} ${snapshot.chapterNo}:${snapshot.verseNo}`
    : '';

  const onPrimary = () => {
    if (playing) {
      void pause();
      return;
    }
    if (paused) {
      void resume();
      return;
    }
    if (!canStart) {
      return;
    }

    const sameChapter =
      snapshot.translation ===
        String(translation ?? '').trim().toUpperCase() &&
      Number(snapshot.bookNo) === Number(bookNo) &&
      Number(snapshot.chapterNo) === Number(chapterNo);

    const resumeVerse =
      startVerseNo ??
      (
        sameChapter && snapshot.verseNo > 0
          ? snapshot.verseNo
          : undefined
      );

    void play({
      translation,
      language,
      bookNo,
      bookName,
      chapterNo,
      verses,
      startVerseNo: resumeVerse,
      books,
      continueNextBook,
    });
  };

  const primaryLabel = playing
    ? 'Pause'
    : paused
      ? 'Resume'
      : loading
        ? 'Starting'
        : 'Play';

  return (
    <View style={styles.card}>
      <Pressable
        disabled={
          disabled ||
          (!canStart && !active) ||
          loading
        }
        onPress={onPrimary}
        style={({ pressed }) => [
          styles.playButton,
          (disabled || (!canStart && !active)) &&
            styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.playIcon}>
          {playing ? 'II' : '▶'}
        </Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.playTitle}>
            {primaryLabel}
          </Text>
          <Text style={styles.playSub}>
            {playing || paused ? nowReading : title}
          </Text>
        </View>
      </Pressable>

      {active ? (
        <Pressable
          onPress={() => {
            void stop();
          }}
          style={({ pressed }) => [
            styles.stopButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.stopText}>Stop</Text>
        </Pressable>
      ) : null}

      <Text style={styles.subtitle}>
        {paused
          ? `Paused at ${nowReading}. Resume continues from this verse.`
          : subtitle}
      </Text>

      <View style={styles.modeRow}>
        {MODES.map((mode) => {
          const selected = snapshot.mode === mode.id;
          return (
            <Pressable
              key={mode.id}
              onPress={() => setMode(mode.id)}
              style={[
                styles.modeChip,
                selected && styles.modeChipOn,
              ]}
            >
              <Text
                style={[
                  styles.modeText,
                  selected && styles.modeTextOn,
                ]}
              >
                {mode.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.sfxRow}>
        <Text style={styles.sfxLabel}>
          Background sounds
        </Text>
        <Pressable
          onPress={() =>
            setSfxEnabled(!snapshot.sfxEnabled)
          }
          style={[
            styles.sfxToggle,
            snapshot.sfxEnabled &&
              sfxActive &&
              styles.sfxToggleOn,
            !sfxActive && styles.volumeDisabled,
          ]}
        >
          <Text
            style={[
              styles.sfxToggleText,
              snapshot.sfxEnabled &&
                sfxActive &&
                styles.sfxToggleTextOn,
            ]}
          >
            {snapshot.sfxEnabled ? 'On' : 'Off'}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.hint}>
        {snapshot.mode === 'pure'
          ? 'Narration only. The Bible words stay exactly as written.'
          : snapshot.mode === 'expressive'
            ? 'The voice follows the passage mood. The Bible words stay exactly as written.'
            : snapshot.sfxEnabled
              ? 'Expressive narration with quiet scene sounds. Scripture stays exactly as written.'
              : 'Expressive narration. Turn background sounds on to add quiet scene audio.'}
      </Text>

      <VolumeStrip
        label="Voice"
        value={snapshot.voiceVolume}
        onChange={setVoiceVolume}
      />
      <VolumeStrip
        label="Sounds"
        value={snapshot.sfxVolume}
        onChange={setSfxVolume}
        disabled={!sfxActive || !snapshot.sfxEnabled}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: '#D8E2DC',
    borderRadius: 15,
    backgroundColor: '#F7FAF8',
    padding: 12,
    gap: 9,
  },
  playButton: {
    minHeight: 52,
    paddingHorizontal: 13,
    borderRadius: 13,
    backgroundColor: '#275D45',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  stopButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#E8EEEA',
  },
  stopText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#355246',
  },
  pressed: {
    opacity: 0.78,
  },
  disabled: {
    opacity: 0.4,
  },
  playIcon: {
    width: 24,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  playTitle: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.3,
    color: '#FFFFFF',
  },
  playSub: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.82)',
  },
  subtitle: {
    fontSize: 11,
    lineHeight: 16,
    color: '#5B6B63',
  },
  modeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  modeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#C9D6CF',
    backgroundColor: '#FFFFFF',
  },
  modeChipOn: {
    backgroundColor: '#275D45',
    borderColor: '#275D45',
  },
  modeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#355246',
  },
  modeTextOn: {
    color: '#FFFFFF',
  },
  sfxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sfxLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    color: '#24352C',
  },
  sfxToggle: {
    minWidth: 52,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#C9D6CF',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  sfxToggleOn: {
    backgroundColor: '#275D45',
    borderColor: '#275D45',
  },
  sfxToggleText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#355246',
  },
  sfxToggleTextOn: {
    color: '#FFFFFF',
  },
  hint: {
    fontSize: 10,
    lineHeight: 14,
    color: '#718078',
  },
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  volumeLabel: {
    width: 58,
    fontSize: 11,
    fontWeight: '800',
    color: '#24352C',
  },
  volumeTrack: {
    flex: 1,
    height: 22,
    borderRadius: 999,
    backgroundColor: '#E2EBE6',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  volumeFill: {
    height: 22,
    backgroundColor: '#275D45',
    borderRadius: 999,
  },
  volumeValue: {
    width: 32,
    textAlign: 'right',
    fontSize: 11,
    fontWeight: '800',
    color: '#355246',
  },
  volumeDisabled: {
    opacity: 0.45,
  },
  dimText: {
    color: '#8A9690',
  },
});
