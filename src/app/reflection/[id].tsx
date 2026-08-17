import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Button, shared } from '@/components/UI';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/lib/theme';

type Privacy = 'private'|'leader'|'group'|'church';

export default function ReflectionScreen() {
  const { id } = useLocalSearchParams<{id:string}>();
  const { user } = useAuth();
  const [reflection, setReflection] = useState('');
  const [application, setApplication] = useState('');
  const [privacy, setPrivacy] = useState<Privacy>('private');
  const [busy, setBusy] = useState(false);

  const complete = async () => {
    if (!user || !id) return;
    if (!reflection.trim()) return Alert.alert('Reflection', 'Write a short reflection first.');
    setBusy(true);

    const { error: reflectionError } = await supabase.from('reflections').upsert({
      user_id:user.id, devotional_id:id,
      reflection_text:reflection.trim(), application_text:application.trim(), privacy
    }, { onConflict:'user_id,devotional_id' });

    if (reflectionError) { setBusy(false); return Alert.alert('Could not save', reflectionError.message); }

    const { error: completionError } = await supabase.from('devotional_completions').upsert({
      user_id:user.id, devotional_id:id,
      completed_at:new Date().toISOString(),
      completion_date:new Date().toISOString().slice(0,10)
    }, { onConflict:'user_id,devotional_id' });

    setBusy(false);
    if (completionError) return Alert.alert('Could not complete', completionError.message);
    Alert.alert('Devotional completed', 'Your reflection has been saved.');
    router.replace('/(tabs)/home');
  };

  return (
    <ScrollView style={shared.screen} contentContainerStyle={shared.content}>
      <Text style={shared.h1}>Your Reflection</Text>
      <Text style={shared.muted}>What spoke to you today?</Text>
      <TextInput multiline value={reflection} onChangeText={setReflection} style={styles.area} placeholder="Write a short reflection..." />
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

      <Button title={busy?'SAVING...':'✓ COMPLETE DEVOTIONAL'} onPress={complete} />
    </ScrollView>
  );
}
const styles=StyleSheet.create({
  area:{minHeight:120,backgroundColor:colors.white,borderColor:colors.line,borderWidth:1,borderRadius:12,padding:12,textAlignVertical:'top'},
  chip:{paddingVertical:8,paddingHorizontal:12,borderWidth:1,borderColor:colors.line,borderRadius:20,backgroundColor:colors.white},
  chipOn:{backgroundColor:colors.greenSoft,borderColor:colors.green},
});
