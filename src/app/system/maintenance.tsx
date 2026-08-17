import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Card, shared } from '@/components/UI';
import { useRuntimeConfig } from '@/providers/RuntimeConfigProvider';

export default function MaintenanceScreen(){
  const {config,refresh}=useRuntimeConfig();

  return(
    <View style={[shared.screen,shared.content,{justifyContent:'center'}]}>
      <Card>
        <Text style={shared.h1}>BUKLOD Maintenance</Text>
        <Text style={[shared.body,{marginTop:10}]}>
          {config?.maintenance_message || 'BUKLOD is temporarily unavailable while maintenance is being completed.'}
        </Text>
        <Pressable onPress={async()=>{await refresh();router.replace('/')}}>
          <Text style={{fontWeight:'900',marginTop:18}}>CHECK AGAIN</Text>
        </Pressable>
      </Card>
    </View>
  )
}
