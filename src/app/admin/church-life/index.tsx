import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { AdminGate } from '@/components/AdminGate';
import { Button, Card, SectionTitle, shared } from '@/components/UI';

export default function ChurchLifeAdmin() {
  return(
    <AdminGate>
      <View style={[shared.screen,shared.content]}>
        <Text style={shared.h1}>Church Life Admin</Text>
        <Text style={shared.muted}>Events, attendance, announcements, ministries, and serving assignments.</Text>

        <SectionTitle>CALENDAR & EVENTS</SectionTitle>
        <Button title="CREATE EVENT" onPress={()=>router.push('/admin/church-life/event-editor')}/>
        <Button title="MANAGE EVENTS" outline onPress={()=>router.push('/admin/church-life/events')}/>

        <SectionTitle>MINISTRIES</SectionTitle>
        <Button title="MANAGE MINISTRIES" outline onPress={()=>router.push('/admin/church-life/ministries')}/>

        <SectionTitle>COMMUNICATION</SectionTitle>
        <Button title="CREATE ANNOUNCEMENT" outline onPress={()=>router.push('/admin/church-life/announcement-editor')}/>
      </View>
    </AdminGate>
  )
}
