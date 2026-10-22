import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, SectionTitle, shared } from '@/components/UI';
import { EnvironmentBadge } from '@/components/EnvironmentBadge';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PilotWelcome(){
  const insets = useSafeAreaInsets();
  return(
    <ScrollView style={shared.screen} contentContainerStyle={[shared.content, { paddingBottom: insets.bottom + 32 }]}>
      <EnvironmentBadge/>
      <Text style={shared.h1}>Welcome to the BUKLOD Pilot</Text>
      <Text style={shared.muted}>
        Your job as a tester is not to make the app look successful. Your job is to help us discover what should be fixed before a wider rollout.
      </Text>

      <SectionTitle>FIRST WEEK</SectionTitle>
      <Card>
        <Text style={shared.h2}>1. Use the app normally</Text>
        <Text style={[shared.body,{marginTop:5}]}>Read a devotional, explore prayer, BUKLOD community, learning, and Church Life.</Text>
      </Card>
      <Card>
        <Text style={shared.h2}>2. Protect privacy</Text>
        <Text style={[shared.body,{marginTop:5}]}>Use test-appropriate information. Check reflection and prayer visibility before sharing.</Text>
      </Card>
      <Card>
        <Text style={shared.h2}>3. Report confusion</Text>
        <Text style={[shared.body,{marginTop:5}]}>A confusing screen is useful pilot information. Do not quietly work around it—send feedback.</Text>
      </Card>
      <Card>
        <Text style={shared.h2}>4. Test with other roles</Text>
        <Text style={[shared.body,{marginTop:5}]}>The team needs to verify that Member, Leader, Pastor, Local Admin, and System Admin boundaries behave differently where intended.</Text>
      </Card>

      <SectionTitle>IMPORTANT</SectionTitle>
      <Card>
        <Text style={shared.body}>
          During technical staging, avoid entering real confidential pastoral notes, highly sensitive prayer concerns, passwords, verification codes, or information that is unnecessary for testing.
        </Text>
      </Card>

      <Button title="OPEN PILOT CHECKLIST" onPress={()=>router.push('/pilot/checklist')}/>
      <Button title="OPEN SUPPORT CENTER" outline onPress={()=>router.push('/support')}/>
      <Button title="SEND FEEDBACK" outline onPress={()=>router.push('/feedback')}/>
    </ScrollView>
  )
}
