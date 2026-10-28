import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
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
  submitFaithPayment,
  type FaithPaymentKind,
} from '@/lib/buklodScopeFaithAccess';
import type { BuklodCommercialProductCode } from '@/lib/buklodCommercialCatalog';
import { submitScopeProductPayment } from '@/lib/buklodScopeProductAccess';
import { colors } from '@/lib/theme';
import { BUKLOD_PAID_FEATURES_ENABLED } from '@/lib/buklodCommercialCatalog';

type Props = {
  visible: boolean;
  title: string;
  description: string;
  amountPhp: number;
  gcashNumber: string;
  scopeId?: string | null;
  paymentKind: FaithPaymentKind;
  stageCode?: number;
  productCode?: BuklodCommercialProductCode;
  onClose: () => void;
  onSubmitted: () => void;
};

export default function BuklodFaithPaymentModal({
  visible,
  title,
  description,
  amountPhp,
  gcashNumber,
  scopeId,
  paymentKind,
  stageCode,
  productCode,
  onClose,
  onSubmitted,
}: Props) {
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setReference('');
    setSubmitting(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!BUKLOD_PAID_FEATURES_ENABLED) {
      Alert.alert('Paid features paused', 'Payments are disabled pending final approval.');
      return;
    }
    const trimmed = reference.trim();

    if (trimmed.length < 6) {
      Alert.alert(
        'Reference required',
        'Enter your GCash reference number after payment.'
      );
      return;
    }

    setSubmitting(true);

    try {
      if (productCode && scopeId) {
        await submitScopeProductPayment({
          scopeId,
          productCode,
          gcashReference: trimmed,
        });
      } else {
        await submitFaithPayment({
          scopeId,
          paymentKind,
          gcashReference: trimmed,
          stageCode,
        });
      }

      Alert.alert(
        'Payment submitted',
        'Your GCash reference was sent for System Admin verification.'
      );
      reset();
      onSubmitted();
      onClose();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not submit payment';
      Alert.alert('Payment', message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!BUKLOD_PAID_FEATURES_ENABLED) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.head}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={handleClose} hitSlop={BUKLOD_HIT_SLOP}>
              <MaterialCommunityIcons
                name="close"
                size={22}
                color={colors.muted}
              />
            </Pressable>
          </View>

          <Text style={styles.description}>{description}</Text>

          <View style={styles.amountBox}>
            <Text style={styles.amountLabel}>Amount</Text>
            <Text style={styles.amountValue}>₱{amountPhp.toFixed(0)}</Text>
          </View>

          <View style={styles.gcashBox}>
            <MaterialCommunityIcons
              name="cellphone"
              size={18}
              color={colors.greenDark}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.gcashLabel}>Send GCash to</Text>
              <Text style={styles.gcashNumber}>{gcashNumber}</Text>
            </View>
          </View>

          <Text style={styles.fieldLabel}>GCash reference number</Text>
          <TextInput
            value={reference}
            onChangeText={setReference}
            placeholder="Enter reference after payment"
            placeholderTextColor={colors.muted}
            autoCapitalize="characters"
            style={styles.input}
          />

          <Pressable
            onPress={() => void handleSubmit()}
            disabled={submitting}
            style={({ pressed }) => [
              styles.submit,
              pressed && { opacity: 0.85 },
              submitting && { opacity: 0.6 },
            ]}
          >
            <Text style={styles.submitText}>
              {submitting ? 'SUBMITTING...' : 'SUBMIT FOR VERIFICATION'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 12,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    flex: 1,
    color: '#173B2F',
    fontSize: 16,
    fontWeight: '900',
  },
  description: {
    color: '#5F6F67',
    fontSize: 12,
    lineHeight: 18,
  },
  amountBox: {
    borderRadius: 12,
    backgroundColor: '#F4F7F5',
    padding: 12,
    gap: 2,
  },
  amountLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  amountValue: {
    color: colors.greenDark,
    fontSize: 22,
    fontWeight: '900',
  },
  gcashBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    padding: 12,
  },
  gcashLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  gcashNumber: {
    color: '#173B2F',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  fieldLabel: {
    color: '#173B2F',
    fontSize: 11,
    fontWeight: '800',
  },
  input: {
    borderWidth: 1,
    borderColor: '#DCE5E0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#173B2F',
    fontSize: 14,
    fontWeight: '700',
  },
  submit: {
    marginTop: 4,
    borderRadius: 12,
    backgroundColor: colors.greenDark,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
