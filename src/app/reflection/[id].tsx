import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Button, shared } from '@/components/UI';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/lib/theme';

type Privacy = 'private'|'leader'|'group'|'church';

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
  const [reflection, setReflection] = useState('');
  const [application, setApplication] = useState('');
  const [privacy, setPrivacy] = useState<Privacy>('private');
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
          p_privacy: privacy,
        }
      );

      if (error) throw error;

      const result = (data ?? {}) as DevotionalCompletionResult;
      if (result.ok !== true || !result.submission_id) {
        throw new Error('Completion was not confirmed by the server. Check your devotional status before trying again.');
      }

      Alert.alert(
        result.already_completed ? 'Devotional already completed' : 'Devotional completed',
        result.status === 'approved'
          ? 'Your devotional is complete and already approved.'
          : 'Your reflection, application, completion, and validation submission were saved together. BUKLOD is checking it automatically; there is no separate manual submission step.'
      );
      router.replace('/(tabs)/hub');
    } catch (error: any) {
      Alert.alert(
        'Could not complete devotional',
        error?.message ?? 'The connection may have interrupted the confirmation. Check your devotional status before trying again.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={shared.screen} contentContainerStyle={shared.content}>
      <Text style={shared.h1}>Your Reflection</Text>
      <Text style={shared.muted}>What spoke to you today?</Text>
      <TextInput multiline value={reflection} onChangeText={setReflection} style={styles.area} placeholder="Write your reflection..." />
      <Text style={shared.muted}>What will you do today?</Text>
      <TextInput multiline value={application} onChangeText={setApplication} style={[styles.area,{minHeight:90}]} placeholder="One practical step..." />

      <Text style={shared.h2}>Privacy</Text>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:7}}>
        {(['private','leader','group','church'] as Privacy[]).map(p=>(
          <Pressable key={p} onPress={()=>setPrivacy(p)} style={[styles.chip,privacy===p&&styles.chipOn]}>
            <Text style={{fontWeight:'700'}}>{p}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={shared.muted}>
        Completing this devotional automatically saves and submits it for BUKLOD checking.
      </Text>
      <Button title={busy?'COMPLETING...':'✓ COMPLETE DEVOTIONAL'} onPress={complete} />
    </ScrollView>
  );
}
const styles=StyleSheet.create({
  area:{minHeight:120,backgroundColor:colors.white,borderColor:colors.line,borderWidth:1,borderRadius:12,padding:12,textAlignVertical:'top'},
  chip:{paddingVertical:8,paddingHorizontal:12,borderWidth:1,borderColor:colors.line,borderRadius:20,backgroundColor:colors.white},
  chipOn:{backgroundColor:colors.greenSoft,borderColor:colors.green},
});
