import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Card, shared } from '@/components/UI';
import { isStaging } from '@/lib/environment';
import { useRuntimeConfig } from '@/providers/RuntimeConfigProvider';
import { colors } from '@/lib/theme';

export function PilotLaunchCard(){
  const {config}=useRuntimeConfig();
  if(!isStaging)return null;

  return(
    <Card>
      <Text style={styles.eyebrow}>🧪 BUKLOD PILOT</Text>
      <Text style={shared.h2}>{config?.release_title || 'Welcome to the BUKLOD Pilot'}</Text>
      <Text style={[shared.muted,{marginTop:6}]} numberOfLines={3}>
        {config?.release_notes || 'Please test the core experience, use test-appropriate information, and send feedback when something is confusing or broken.'}
      </Text>
      <View style={styles.actions}>
        <Pressable style={styles.primary} onPress={()=>router.push('/pilot/welcome')}>
          <Text style={styles.primaryText}>PILOT GUIDE</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={()=>router.push('/pilot/checklist')}>
          <Text style={styles.secondaryText}>CHECKLIST</Text>
        </Pressable>
      </View>
    </Card>
  )
}

const styles=StyleSheet.create({
  eyebrow:{fontSize:11,fontWeight:'900',color:colors.green,marginBottom:6},
  actions:{flexDirection:'row',gap:8,marginTop:12},
  primary:{flex:1,backgroundColor:colors.green,borderRadius:11,padding:11,alignItems:'center'},
  primaryText:{color:colors.white,fontWeight:'900',fontSize:11},
  secondary:{flex:1,borderWidth:1,borderColor:colors.green,borderRadius:11,padding:11,alignItems:'center'},
  secondaryText:{color:colors.green,fontWeight:'900',fontSize:11},
});
