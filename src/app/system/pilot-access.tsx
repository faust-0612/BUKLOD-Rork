import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Card, shared } from '@/components/UI';
import { useAuth } from '@/providers/AuthProvider';
import { useRuntimeConfig } from '@/providers/RuntimeConfigProvider';

export default function PilotAccessScreen(){
  const {signOut}=useAuth();
  const {refresh}=useRuntimeConfig();

  return(
    <View style={[shared.screen,shared.content,{justifyContent:'center'}]}>
      <Card>
        <Text style={shared.h1}>Pilot Access Required</Text>
        <Text style={[shared.body,{marginTop:10}]}>
          This BUKLOD staging build is currently limited to approved pilot participants.
          Your account is valid, but it has not yet been activated for this pilot cohort.
        </Text>
        <Pressable onPress={async()=>{await refresh();router.replace('/')}}>
          <Text style={{fontWeight:'900',marginTop:18}}>CHECK ACCESS AGAIN</Text>
        </Pressable>
        <Pressable onPress={signOut}>
          <Text style={{fontWeight:'900',marginTop:14}}>LOG OUT</Text>
        </Pressable>
      </Card>
    </View>
  )
}
