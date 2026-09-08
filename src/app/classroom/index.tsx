import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import { isClassroomApp } from '@/lib/appTarget';

export default function ClassroomAppHome() {
  const { session, loading, profile } = useAuth();
  if (!isClassroomApp) return <Redirect href="/" />;
  if (loading && !session) return <View style={styles.loading}><Text style={styles.loadingText}>Opening BUKLOD Classroom...</Text></View>;
  if (!session) return <Redirect href="/(auth)/login" />;

  const displayName = String(profile?.full_name || profile?.username || 'BUKLOD Learner');
  const signOut = async () => { await supabase.auth.signOut(); router.replace('/(auth)/login'); };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.brandRow}>
        <Image source={require('../../../assets/classroom/app-icon.png')} style={styles.logo} />
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>STANDALONE LEARNING APP</Text>
          <Text style={styles.title}>BUKLOD Classroom</Text>
          <Text style={styles.subtitle}>Welcome, {displayName}</Text>
        </View>
      </View>
      <View style={styles.hero}>
        <MaterialCommunityIcons name="google-classroom" size={34} color="#1f7a3f" />
        <Text style={styles.heroTitle}>Dedicated Classroom experience</Text>
        <Text style={styles.heroText}>Classes, live sessions, attendance, activities, submissions, materials, grading and results stay inside Classroom. Your BUKLOD account remains shared intentionally.</Text>
      </View>
      <Pressable style={styles.card} onPress={() => router.push('/profile/buklod-classrooms' as any)}>
        <View style={styles.cardIcon}><MaterialCommunityIcons name="account-school-outline" size={28} color="#1f7a3f" /></View>
        <View style={{ flex: 1 }}><Text style={styles.cardTitle}>My Classroom</Text><Text style={styles.cardText}>Student classes, discussions, live sessions, activities, materials and grades.</Text></View>
        <MaterialCommunityIcons name="chevron-right" size={24} color="#7d8b81" />
      </Pressable>
      <Pressable style={styles.card} onPress={() => router.push('/profile/buklod-faculty' as any)}>
        <View style={styles.cardIcon}><MaterialCommunityIcons name="account-tie" size={28} color="#1f7a3f" /></View>
        <View style={{ flex: 1 }}><Text style={styles.cardTitle}>Faculty</Text><Text style={styles.cardText}>Classes, roster, attendance, assessments, grading, files and live teaching.</Text></View>
        <MaterialCommunityIcons name="chevron-right" size={24} color="#7d8b81" />
      </Pressable>
      <Text style={styles.integration}>BUKLOD ecosystem account • Classroom-specific app identity</Text>
      <Pressable style={styles.signOut} onPress={() => void signOut()}><MaterialCommunityIcons name="logout" size={18} color="#6d2f2f" /><Text style={styles.signOutText}>Sign out</Text></Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:'#f2f6f1'}, content:{width:'100%',maxWidth:760,alignSelf:'center',padding:20,paddingTop:42,paddingBottom:64},
  loading:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:'#f2f6f1'}, loadingText:{color:'#526159',fontWeight:'800'},
  brandRow:{flexDirection:'row',alignItems:'center',gap:14,marginBottom:20}, logo:{width:72,height:72,borderRadius:20}, eyebrow:{color:'#1f7a3f',fontSize:10,fontWeight:'900',letterSpacing:1.2},
  title:{color:'#17311f',fontSize:30,fontWeight:'900',marginTop:2}, subtitle:{color:'#68736b',marginTop:3}, hero:{backgroundColor:'#fff',borderRadius:24,padding:20,marginBottom:14},
  heroTitle:{color:'#17311f',fontSize:20,fontWeight:'900',marginTop:10}, heroText:{color:'#68736b',lineHeight:20,marginTop:6}, card:{flexDirection:'row',alignItems:'center',gap:13,backgroundColor:'#fff',borderRadius:20,padding:16,marginBottom:11},
  cardIcon:{width:50,height:50,borderRadius:15,backgroundColor:'#e7f4e9',alignItems:'center',justifyContent:'center'}, cardTitle:{color:'#203328',fontSize:17,fontWeight:'900'}, cardText:{color:'#6b776e',lineHeight:18,marginTop:3},
  integration:{textAlign:'center',color:'#7b877e',fontSize:11,fontWeight:'700',marginTop:16}, signOut:{alignSelf:'center',flexDirection:'row',gap:7,alignItems:'center',padding:12,marginTop:8}, signOutText:{color:'#6d2f2f',fontWeight:'800'}
});
