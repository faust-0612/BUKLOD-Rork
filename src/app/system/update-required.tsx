import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Card, shared } from '@/components/UI';
import { useRuntimeConfig } from '@/providers/RuntimeConfigProvider';

export default function UpdateRequired(){
  const {config,refresh}=useRuntimeConfig();

  return(
    <View style={[shared.screen,shared.content,{justifyContent:'center'}]}>
      <Card>
        <Text style={shared.h1}>Update Required</Text>
        <Text style={[shared.body,{marginTop:10}]}>
          {config?.update_message || 'This BUKLOD build is no longer supported. Install the current approved build before continuing.'}
        </Text>
        <Text style={[shared.muted,{marginTop:8}]}>
          Minimum supported version: {config?.minimum_supported_version || '—'}
        </Text>
        <Pressable onPress={async()=>{await refresh();router.replace('/')}}>
          <Text style={{fontWeight:'900',marginTop:18}}>CHECK AGAIN</Text>
        </Pressable>
      </Card>
    </View>
  )
}
