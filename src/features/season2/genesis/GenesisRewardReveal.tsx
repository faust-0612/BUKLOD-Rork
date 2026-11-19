import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, type ImageSourcePropType, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GenesisSeal } from './GenesisVisuals';
import GenesisCosmicSky from './GenesisCosmicSky';
import { GENESIS_MOTION_MS, GENESIS_PALETTE } from './genesisContract';

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  rewardText?: string | null;
  characterSource?: ImageSourcePropType | null;
};

/**
 * Presentation-only. The parent must already have a verified reward receipt;
 * this component never writes to a ledger or announces unconfirmed balance.
 * Audio/haptics remain managed by the existing caller, with no cheap fallback beep.
 */
export default function GenesisRewardReveal({ visible, onClose, title, message, rewardText, characterSource }: Props) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) { progress.stopAnimation(); progress.setValue(0); return; }
    const animation = Animated.timing(progress, { toValue: 1, duration: GENESIS_MOTION_MS.rewardEntrance,
      easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [visible, progress]);

  const fade = progress.interpolate({ inputRange: [0, .26, 1], outputRange: [0, .85, 1] });
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [.86, 1] });
  const lift = progress.interpolate({ inputRange: [0, 1], outputRange: [42, 0] });
  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.frame, { opacity: fade, transform: [{ scale }, { translateY: lift }] }]}>
          <LinearGradient colors={['#020C20', '#0A2436', '#092C2A']} style={styles.surface}>
            <GenesisCosmicSky active={visible} />
            <View style={styles.goldHairline} pointerEvents="none" />
            <Text style={styles.eyebrow}>BUKLOD  ·  GENESIS</Text>
            <View style={styles.art}>
              {characterSource
                ? <Image source={characterSource} resizeMode="contain" style={styles.artImage} />
                : <GenesisSeal size={148} active={visible} />}
            </View>
            <Text style={styles.label}>A MILESTONE WORTH CELEBRATING</Text>
            <Text style={styles.title} allowFontScaling>{title}</Text>
            {rewardText ? <View style={styles.reward}><Text style={styles.rewardText}>{rewardText}</Text></View> : null}
            <Text style={styles.message}>{message || 'Continue the journey. Every meaningful step counts.'}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Continue" onPress={onClose} style={({ pressed }) => [
              styles.action, pressed && { opacity: .83 },
            ]}>
              <Text style={styles.actionText}>CONTINUE</Text>
            </Pressable>
            <Text style={styles.disclaimer}>BUKLOD recognizes recorded participation, not personal worth or spiritual maturity.</Text>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(2,12,10,.86)', alignItems: 'center',
    justifyContent: 'center', paddingHorizontal: 20 },
  frame: { width: '100%', maxWidth: 420, borderRadius: 25, overflow: 'hidden', borderWidth: 1,
    borderColor: '#C7A567' },
  surface: { paddingHorizontal: 22, paddingTop: 21, paddingBottom: 20, alignItems: 'center' },
  goldHairline: { width: '100%', position: 'absolute', top: 8, borderTopWidth: .7,
    borderColor: GENESIS_PALETTE.gold, opacity: .7 },
  eyebrow: { color: GENESIS_PALETTE.goldLight, fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  art: { height: 170, alignItems: 'center', justifyContent: 'center' },
  artImage: { width: 160, height: 160 },
  label: { color: '#B9DBC9', fontSize: 9, fontWeight: '800', letterSpacing: 1.35, textAlign: 'center' },
  title: { color: '#FFF8E7', fontSize: 24, lineHeight: 29, marginTop: 8, fontWeight: '900', textAlign: 'center' },
  reward: { marginTop: 13, borderWidth: 1, borderColor: '#CBAC70', borderRadius: 13,
    backgroundColor: 'rgba(235,194,113,.12)', paddingHorizontal: 18, paddingVertical: 9 },
  rewardText: { color: GENESIS_PALETTE.goldLight, fontSize: 15, fontWeight: '900', textAlign: 'center' },
  message: { color: '#DAEEE1', fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 12 },
  action: { minHeight: 46, marginTop: 22, backgroundColor: '#DBBB78', borderRadius: 12,
    alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  actionText: { color: '#143026', fontSize: 13, fontWeight: '900', letterSpacing: 1.4 },
  disclaimer: { fontSize: 10, lineHeight: 14, marginTop: 12, color: '#B3CABE', textAlign: 'center' },
});
