import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

const CLASSROOM_ICON = require('../../../assets/classroom/app-icon.png');

export default function BuklodClassroomAboutScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable style={styles.back} onPress={() => router.back()}>
        <MaterialCommunityIcons name="arrow-left" size={22} color="#17311f" />
        <Text style={styles.backText}>BUKLOD Classroom</Text>
      </Pressable>

      <View style={styles.card}>
        <Image source={CLASSROOM_ICON} style={styles.logo} />
        <Text style={styles.title}>BUKLOD Classroom</Text>
        <Text style={styles.version}>Standalone Classroom Application</Text>
        <Text style={styles.body}>
          BUKLOD Classroom is the learning-focused BUKLOD application for classes, live teaching, enrollment, attendance, activities, submissions, assessments, grading, results, files and academic communication.
        </Text>
        <Text style={styles.body}>
          It can share an authorized BUKLOD account and selected infrastructure with the wider BUKLOD ecosystem without becoming the BUKLOD Main application.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f2f6f1' },
  content: { padding: 20, paddingTop: 44, paddingBottom: 60 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 16 },
  backText: { color: '#17311f', fontWeight: '900' },
  card: { backgroundColor: '#fff', borderRadius: 24, padding: 22, alignItems: 'center' },
  logo: { width: 88, height: 88, borderRadius: 22 },
  title: { color: '#17311f', fontSize: 28, fontWeight: '900', marginTop: 16 },
  version: { color: '#1f7a3f', fontSize: 11, fontWeight: '900', letterSpacing: 0.8, marginTop: 4 },
  body: { color: '#647069', lineHeight: 20, marginTop: 16, textAlign: 'center' },
});
