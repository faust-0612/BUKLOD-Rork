import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuth } from '@/providers/AuthProvider';
import { playBuklodGameFeedback } from '@/features/games/runtime/BuklodGameFeedback';
import { resetBuklodKingdomPreviewProgress } from './progress';

/* BUKLOD_KINGDOM_SYSTEM_ADMIN_QA_R1 */
/* SYSTEM ADMIN QA */

type Props = {
  actualStage: number;
  previewStage: number | null;
  onPreviewStage: (stage: number | null) => void;
};

export default function BuklodKingdomAdminQa({ actualStage, previewStage, onPreviewStage }: Props) {
  const { hasRole, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const isSystemAdmin = hasRole('system_admin');

  useEffect(() => {
    if (!isSystemAdmin) {
      setOpen(false);
      setConfirmReset(false);
      onPreviewStage(null);
    }
  }, [isSystemAdmin, onPreviewStage]);

  if (!isSystemAdmin) return null;

  const testSound = (event: 'move' | 'success' | 'unlock') => {
    void playBuklodGameFeedback(event);
  };

  const resetLocalQa = async () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    await resetBuklodKingdomPreviewProgress(user?.id ?? null);
    onPreviewStage(null);
    setConfirmReset(false);
    void playBuklodGameFeedback('failure');
  };

  return (
    <View style={styles.anchor} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="System Admin Kingdom QA"
        onPress={() => {
          setOpen((value) => !value);
          setConfirmReset(false);
          testSound('move');
        }}
        style={({ pressed }) => [styles.qaButton, pressed && styles.pressed]}
      >
        <MaterialCommunityIcons name="shield-crown-outline" size={18} color="#f8d577" />
        <Text style={styles.qaButtonText}>QA</Text>
      </Pressable>

      {open ? (
        <View style={styles.panel}>
          <Text style={styles.eyebrow}>SYSTEM ADMIN QA</Text>
          <Text style={styles.title}>Kingdom Inspector</Text>
          <Text style={styles.copy}>
            Preview presentation states only. Normal-user authorization and server RLS are unchanged.
          </Text>

          <Text style={styles.label}>WORLD STAGE PREVIEW</Text>
          <View style={styles.stageRow}>
            {[1, 2, 3, 4].map((stage) => {
              const active = (previewStage ?? actualStage) === stage;
              return (
                <Pressable
                  key={stage}
                  accessibilityRole="button"
                  accessibilityLabel={`Preview Kingdom stage ${stage}`}
                  onPress={() => {
                    onPreviewStage(stage);
                    testSound(stage > actualStage ? 'unlock' : 'move');
                  }}
                  style={[styles.stageButton, active && styles.stageButtonActive]}
                >
                  <Text style={[styles.stageText, active && styles.stageTextActive]}>{stage}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => onPreviewStage(null)}
            style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
          >
            <MaterialCommunityIcons name="restore" size={15} color="#d8e8f6" />
            <Text style={styles.actionText}>REAL PROGRESS VIEW</Text>
          </Pressable>

          <View style={styles.soundRow}>
            <Pressable onPress={() => testSound('move')} style={styles.soundButton}>
              <MaterialCommunityIcons name="volume-medium" size={15} color="#d8e8f6" />
              <Text style={styles.soundText}>UI</Text>
            </Pressable>
            <Pressable onPress={() => testSound('success')} style={styles.soundButton}>
              <MaterialCommunityIcons name="star-circle-outline" size={15} color="#d8e8f6" />
              <Text style={styles.soundText}>WIN</Text>
            </Pressable>
            <Pressable onPress={() => testSound('unlock')} style={styles.soundButton}>
              <MaterialCommunityIcons name="lock-open-variant-outline" size={15} color="#d8e8f6" />
              <Text style={styles.soundText}>UNLOCK</Text>
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reset my local Kingdom QA progress"
            onPress={() => void resetLocalQa()}
            style={({ pressed }) => [styles.resetButton, confirmReset && styles.resetConfirm, pressed && styles.pressed]}
          >
            <MaterialCommunityIcons name={confirmReset ? 'alert-outline' : 'delete-restore'} size={15} color={confirmReset ? '#fff1cb' : '#ffb7b7'} />
            <Text style={[styles.resetText, confirmReset && styles.resetTextConfirm]}>
              {confirmReset ? 'TAP AGAIN TO RESET THIS ACCOUNT/DEVICE' : 'RESET MY LOCAL QA PROGRESS'}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', right: 12, bottom: 18, zIndex: 120, alignItems: 'flex-end' },
  qaButton: {
    minWidth: 54,
    height: 40,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: 'rgba(11,30,48,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(248,213,119,0.7)',
  },
  qaButtonText: { color: '#f8d577', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  panel: {
    width: 294,
    marginBottom: 8,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(8,22,36,0.97)',
    borderWidth: 1,
    borderColor: 'rgba(248,213,119,0.38)',
    shadowColor: '#000000',
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 9,
  },
  eyebrow: { color: '#f2cc6c', fontSize: 8.5, fontWeight: '900', letterSpacing: 1.2 },
  title: { marginTop: 3, color: '#ffffff', fontSize: 17, fontWeight: '900' },
  copy: { marginTop: 5, color: 'rgba(255,255,255,0.70)', fontSize: 10, lineHeight: 14, fontWeight: '600' },
  label: { marginTop: 12, color: '#a9c9df', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.8 },
  stageRow: { flexDirection: 'row', gap: 6, marginTop: 7 },
  stageButton: {
    flex: 1,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.11)',
  },
  stageButtonActive: { backgroundColor: '#f0c65b', borderColor: '#ffe49c' },
  stageText: { color: '#d8e8f6', fontSize: 11, fontWeight: '900' },
  stageTextActive: { color: '#3c2b0d' },
  actionButton: {
    marginTop: 8,
    height: 34,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(101,158,198,0.14)',
  },
  actionText: { color: '#d8e8f6', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.5 },
  soundRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  soundButton: {
    flex: 1,
    height: 34,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  soundText: { color: '#d8e8f6', fontSize: 8, fontWeight: '900' },
  resetButton: {
    marginTop: 8,
    minHeight: 36,
    paddingHorizontal: 8,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(184,72,72,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,155,155,0.2)',
  },
  resetConfirm: { backgroundColor: 'rgba(184,72,72,0.5)', borderColor: 'rgba(255,211,171,0.7)' },
  resetText: { color: '#ffb7b7', fontSize: 7.8, fontWeight: '900', textAlign: 'center' },
  resetTextConfirm: { color: '#fff1cb' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
