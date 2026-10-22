import { ScrollView, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Card, shared } from '@/components/UI';
import { privacyNotice } from '@/lib/legal';

export default function PrivacyNoticeScreen(){
  return(
    <ScrollView style={shared.screen} contentContainerStyle={shared.content}>
      <Text style={shared.h1}>Privacy Notice</Text>
      <Pressable onPress={() => router.push('/privacy' as any)}>
        <Text style={[shared.body, { color: '#0E4F20', fontWeight: '800', marginBottom: 12 }]}>
          Open the public BUKLOD Privacy Policy
        </Text>
      </Pressable>
      <Pressable onPress={() => router.push('/delete-account' as any)}>
        <Text style={[shared.body, { color: '#0E4F20', fontWeight: '800', marginBottom: 12 }]}>
          How to delete a BUKLOD account
        </Text>
      </Pressable>
      <Card><Text style={shared.body}>{privacyNotice}</Text></Card>
    </ScrollView>
  )
}
