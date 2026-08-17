import { ScrollView, Text } from 'react-native';
import { Card, shared } from '@/components/UI';
import { privacyNotice } from '@/lib/legal';

export default function PrivacyNoticeScreen(){
  return(
    <ScrollView style={shared.screen} contentContainerStyle={shared.content}>
      <Text style={shared.h1}>Privacy Notice</Text>
      <Card><Text style={shared.body}>{privacyNotice}</Text></Card>
    </ScrollView>
  )
}
