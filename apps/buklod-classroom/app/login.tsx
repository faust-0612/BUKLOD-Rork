import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loginBuklod } from '../src/core';

export default function Login() {
  const insets = useSafeAreaInsets();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try { await loginBuklod(identifier, password); }
    catch (e: any) { Alert.alert('Login failed', String(e?.message ?? e ?? 'Please try again.')); }
    finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.screen, { paddingTop: Math.max(insets.top, 24), paddingBottom: Math.max(insets.bottom, 24) }]}> 
      <View style={styles.brand}><Text style={styles.kicker}>BUKLOD</Text><Text style={styles.title}>Classroom</Text><Text style={styles.subtitle}>Your classes, requirements, attendance, Quiz records, grades, RLE/OJT, and consultations in one place.</Text></View>
      <View style={styles.card}>
        <Text style={styles.label}>BUKLOD account</Text>
        <TextInput value={identifier} onChangeText={setIdentifier} autoCapitalize="none" placeholder="Mobile, Username, or Email" style={styles.input} />
        <Text style={styles.label}>Password</Text>
        <TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="Password" style={styles.input} onSubmitEditing={submit} />
        <Pressable onPress={submit} disabled={busy} style={({ pressed }) => [styles.button, (pressed || busy) && { opacity: .72 }]}><Text style={styles.buttonText}>{busy ? 'Signing in…' : 'SIGN IN'}</Text></Pressable>
        <Text style={styles.hint}>Uses the same BUKLOD Main account. Student data shown here is limited to your own enrollment and released academic records.</Text>
      </View>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({ screen:{flex:1,backgroundColor:'#f4f7f2',justifyContent:'center',padding:22},brand:{marginBottom:26},kicker:{fontSize:13,fontWeight:'900',letterSpacing:2,color:'#2c7a45'},title:{fontSize:38,fontWeight:'900',color:'#17311f'},subtitle:{marginTop:8,fontSize:15,lineHeight:22,color:'#607067'},card:{backgroundColor:'#fff',borderRadius:24,padding:20,borderWidth:1,borderColor:'#dfe8e1'},label:{fontSize:12,fontWeight:'800',color:'#405447',marginBottom:7,marginTop:9},input:{height:52,borderWidth:1,borderColor:'#d8e2da',backgroundColor:'#fafcf9',borderRadius:14,paddingHorizontal:14,fontSize:16,color:'#183021'},button:{height:54,borderRadius:16,backgroundColor:'#1f7a3f',alignItems:'center',justifyContent:'center',marginTop:18},buttonText:{color:'#fff',fontWeight:'900',letterSpacing:.7},hint:{fontSize:11,lineHeight:17,color:'#718078',marginTop:14} });
