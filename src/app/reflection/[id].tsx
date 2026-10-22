import { useEffect, useState } from 'react';
import { Alert, Keyboard, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Button, shared } from '@/components/UI';
import BuklodAdMobBanner from '@/components/BuklodAdMobBanner';
import { useBuklodFooterAdBottomPadding } from '@/lib/buklodSafeArea';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/lib/theme';
import BuklodDevotionalRewardStatus from '@/components/BuklodDevotionalRewardStatus';
// BUKLOD_DEVOTIONAL_POINTS_UI_R1

function ReflectionBottomAd() {
  const insets = useSafeAreaInsets();
  const footerPadding = useBuklodFooterAdBottomPadding();
  const bottomGap = Math.max(insets.bottom, footerPadding, 12);
  const [coverOffset, setCoverOffset] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (event) => {
      setCoverOffset(event.endCoordinates?.height ?? 0);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setCoverOffset(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return (
    <View
      style={[
        styles.adSlot,
        { paddingBottom: bottomGap, transform: [{ translateY: coverOffset }] },
      ]}
    >
      <BuklodAdMobBanner
        placement="submission"
        placementId="daily_devotion_submission"
        format="inline"
        maxHeight={250}
        requireViewport={false}
        showLabel
      />
    </View>
  );
}

type DevotionalCompletionResult = {
  ok?: boolean;
  submission_id?: string;
  status?: string;
  already_completed?: boolean;
  automatic?: boolean;
};

export default function ReflectionScreen() {
  const { id } = useLocalSearchParams<{id:string}>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [reflection, setReflection] = useState('');
  const [application, setApplication] = useState('');
  const [busy, setBusy] = useState(false);

  const complete = async () => {
    if (!user || !id || busy) return;

    const reflectionText = reflection.trim();
    const applicationText = application.trim();

    if (reflectionText.length < 20) {
      return Alert.alert('Reflection', 'Write a reflection with at least 20 characters.');
    }

    if (applicationText.length < 20) {
      return Alert.alert('Application', 'Write one practical application with at least 20 characters.');
    }

    setBusy(true);

    try {
      const { data, error } = await (supabase as any).rpc(
        'complete_my_devotional_v2',
        {
          p_devotional_id: id,
          p_reflection: reflectionText,
          p_application: applicationText,
          p_privacy: 'private',
        }
      );

      if (error) throw error;

      const result = (data ?? {}) as DevotionalCompletionResult;

      Alert.alert(
        result.already_completed ? 'Devotional already completed' : 'Devotional completed',
        result.status === 'approved'
          ? 'Your devotional is complete and already approved.'
          : 'Your reflection, application, completion, and validation submission were saved together. BUKLOD is checking it automatically; there is no separate manual submission step.'
      );
      router.replace('/(tabs)/home');
    } catch (error: any) {
      Alert.alert(
        'Could not complete devotional',
        error?.message ?? 'Nothing was partially submitted. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={shared.screen}>
      <ScrollView
        style={shared.screen}
        contentContainerStyle={[shared.content, { paddingTop: insets.top + 16 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={shared.h1}>Your Reflection</Text>
        <Text style={shared.muted}>What spoke to you today?</Text>
        <TextInput multiline value={reflection} onChangeText={setReflection} style={styles.area} placeholder="Write your reflection..." />
        <Text style={shared.muted}>What will you do today?</Text>
        <TextInput multiline value={application} onChangeText={setApplication} style={[styles.area,{minHeight:90}]} placeholder="One practical step..." />

        <Text style={shared.muted}>
          Completing this devotional automatically saves and submits it for BUKLOD checking.
        </Text>
      <BuklodDevotionalRewardStatus devotionalId={String(id ?? '')} />
        <Button title={busy?'COMPLETING...':'✓ COMPLETE DEVOTIONAL'} onPress={complete} />
        <View style={styles.scrollClearance} />
      </ScrollView>
      <View pointerEvents="box-none" style={styles.bottomDock}>
        <ReflectionBottomAd />
      </View>
    </View>
  );
}
const styles=StyleSheet.create({
  bottomDock:{position:'absolute',left:0,right:0,bottom:0,zIndex:4,elevation:8},
  scrollClearance:{height:280},
  adSlot:{width:'100%',alignItems:'center'},
  area:{minHeight:120,backgroundColor:colors.white,borderColor:colors.line,borderWidth:1,borderRadius:12,padding:12,textAlignVertical:'top'},
});
