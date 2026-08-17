import { ScrollView, Text } from 'react-native';
import { router } from 'expo-router';
import { AdminGate } from '@/components/AdminGate';
import { Button, SectionTitle, shared } from '@/components/UI';

export default function PilotOperations(){
  return(
    <AdminGate>
      <ScrollView style={shared.screen} contentContainerStyle={shared.content}>
        <Text style={shared.h1}>Pilot Operations</Text>
        <Text style={shared.muted}>Control staging access, release gates, feature rollout, and pilot feedback.</Text>

        <SectionTitle>RUNTIME CONTROL</SectionTitle>
        <Button title="MAINTENANCE • VERSION • RELEASE NOTES" onPress={()=>router.push('/admin/pilot/runtime')}/>

        <SectionTitle>FEATURE ROLLOUT</SectionTitle>
        <Button title="FEATURE FLAGS" outline onPress={()=>router.push('/admin/pilot/features')}/>

        <SectionTitle>PILOT ACCESS</SectionTitle>
        <Button title="COHORTS & PARTICIPANTS" outline onPress={()=>router.push('/admin/pilot/cohorts')}/>

        <SectionTitle>PILOT LAUNCH CONTENT</SectionTitle>
        <Button title="HELP • ANNOUNCEMENT TEMPLATES" outline onPress={()=>router.push('/admin/pilot/content')}/>
        <Button title="TESTER CHECKLIST PROGRESS" outline onPress={()=>router.push('/admin/pilot/checklist')}/>

        <SectionTitle>FEEDBACK</SectionTitle>
        <Button title="PILOT FEEDBACK QUEUE" outline onPress={()=>router.push('/admin/pilot/feedback')}/>
      </ScrollView>
    </AdminGate>
  )
}
