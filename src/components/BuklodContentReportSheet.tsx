import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  BUKLOD_HIT_SLOP,
  BUKLOD_HIT_SLOP_TIGHT,
} from '@/lib/buklodTouch';

import { MaterialCommunityIcons } from '@expo/vector-icons';

import {
  CONTENT_REPORT_REASONS,
  submitContentReport,
  type ContentReportReasonId,
} from '@/lib/buklodContentReports';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';
import type { BuklodThemeRoles } from '@/lib/buklodTheme';
import { useBuklodDrawerBottomInset } from '@/lib/buklodSafeArea';

type Target = {
  entityType: string;
  entityId: string;
} | null;

type Props = {
  visible: boolean;
  entityType?: string | null;
  entityId?: string | null;
  onClose: () => void;
};

export function useBuklodContentReport() {
  const [target, setTarget] = useState<Target>(null);

  return {
    openReport: (entityType: string, entityId: string) => {
      const id = String(entityId || '').trim();
      if (!id) {
        return;
      }
      setTarget({
        entityType: String(entityType || 'post'),
        entityId: id,
      });
    },
    reportSheet: (
      <BuklodContentReportSheet
        visible={!!target}
        entityType={target?.entityType}
        entityId={target?.entityId}
        onClose={() => setTarget(null)}
      />
    ),
  };
}

export default function BuklodContentReportSheet({
  visible,
  entityType,
  entityId,
  onClose,
}: Props) {
  const { theme } = useBuklodTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const drawerBottomInset = useBuklodDrawerBottomInset();
  const [reason, setReason] = useState<ContentReportReasonId>('inappropriate');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    try {
      setBusy(true);
      await submitContentReport({
        entityType: String(entityType || 'post'),
        entityId: String(entityId || ''),
        reason,
        details,
      });
      setDetails('');
      setReason('inappropriate');
      onClose();
      Alert.alert(
        'Report sent',
        'A System Admin can review this and take action if needed.'
      );
    } catch (error: any) {
      Alert.alert(
        'Report',
        error?.message || 'Could not send this report.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.dismiss} onPress={onClose} />
        <View style={[styles.card, { paddingBottom: drawerBottomInset + 16 }]}>
          <View style={styles.header}>
            <Text style={styles.title}>Report</Text>
            <Pressable onPress={onClose} hitSlop={BUKLOD_HIT_SLOP} accessibilityLabel="Close">
              <MaterialCommunityIcons
                name="close"
                size={22}
                color={theme.textMuted}
              />
            </Pressable>
          </View>
          <Text style={styles.lead}>
            Choose why this should be reviewed. A System Admin will see it.
          </Text>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={styles.list}
          >
            {CONTENT_REPORT_REASONS.map((item) => {
              const selected = reason === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setReason(item.id)}
                  style={[
                    styles.reason,
                    selected && styles.reasonOn,
                  ]}
                >
                  <View
                    style={[
                      styles.radio,
                      selected && styles.radioOn,
                    ]}
                  />
                  <View style={styles.reasonCopy}>
                    <Text style={styles.reasonLabel}>{item.label}</Text>
                    <Text style={styles.reasonHint}>{item.hint}</Text>
                  </View>
                </Pressable>
              );
            })}

            <TextInput
              value={details}
              onChangeText={setDetails}
              multiline
              placeholder="Optional notes for the System Admin"
              placeholderTextColor={theme.textMuted}
              style={styles.notes}
            />
          </ScrollView>

          <View style={styles.actions}>
            <Pressable
              disabled={busy}
              onPress={onClose}
              style={styles.button}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={busy}
              onPress={() => void submit()}
              style={[styles.button, styles.buttonPrimary]}
            >
              <Text style={[styles.buttonText, styles.buttonTextPrimary]}>
                {busy ? 'Sending...' : 'Send report'}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(theme: BuklodThemeRoles) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.46)',
    },
    dismiss: {
      flex: 1,
    },
    card: {
      maxHeight: '86%',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 16,
      backgroundColor: theme.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 10,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      fontSize: 18,
      fontWeight: '900',
      color: theme.textPrimary,
    },
    lead: {
      fontSize: 13,
      lineHeight: 18,
      color: theme.textMuted,
    },
    list: {
      maxHeight: 420,
    },
    reason: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 8,
      backgroundColor: theme.surfaceMuted,
    },
    reasonOn: {
      borderColor: theme.accent,
      backgroundColor: theme.accentSoft,
    },
    radio: {
      marginTop: 4,
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: theme.textMuted,
    },
    radioOn: {
      borderColor: theme.accent,
      backgroundColor: theme.accent,
    },
    reasonCopy: {
      flex: 1,
    },
    reasonLabel: {
      fontSize: 14,
      fontWeight: '800',
      color: theme.textPrimary,
    },
    reasonHint: {
      marginTop: 2,
      fontSize: 12,
      lineHeight: 16,
      color: theme.textMuted,
    },
    notes: {
      minHeight: 88,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      padding: 12,
      fontSize: 14,
      color: theme.textPrimary,
      textAlignVertical: 'top',
      marginBottom: 8,
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 8,
    },
    button: {
      minHeight: 42,
      paddingHorizontal: 14,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surfaceMuted,
    },
    buttonPrimary: {
      backgroundColor: theme.accent,
    },
    buttonText: {
      fontSize: 13,
      fontWeight: '900',
      color: theme.textPrimary,
    },
    buttonTextPrimary: {
      color: theme.white,
    },
  });
}
