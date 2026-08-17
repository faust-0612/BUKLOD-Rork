import { Text, View } from 'react-native';
import { Card, shared } from '@/components/UI';

export function FeatureUnavailable({title}:{title:string}){
  return(
    <View style={[shared.screen,shared.content,{justifyContent:'center'}]}>
      <Card>
        <Text style={shared.h1}>{title}</Text>
        <Text style={[shared.body,{marginTop:8}]}>
          This feature is temporarily unavailable for your current BUKLOD pilot or rollout scope.
        </Text>
      </Card>
    </View>
  )
}
