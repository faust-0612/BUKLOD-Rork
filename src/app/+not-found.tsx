import { Link } from 'expo-router';
import { Text, View } from 'react-native';
import { shared } from '@/components/UI';

export default function NotFound(){
  return(
    <View style={[shared.screen,shared.content,{justifyContent:'center'}]}>
      <Text style={shared.h1}>Page not found</Text>
      <Text style={shared.muted}>The BUKLOD page you opened is unavailable.</Text>
      <Link href="/" style={{fontWeight:'900',marginTop:12}}>Return Home</Link>
    </View>
  )
}
