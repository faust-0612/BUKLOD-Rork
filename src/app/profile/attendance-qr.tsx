import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  Stack,
} from 'expo-router';

import {
  BuklodAttendanceQrCard,
} from '@/components/BuklodAttendanceQrCard';

import {
  colors,
} from '@/lib/theme';


export default function
AttendanceQrScreen() {
  return (
    <SafeAreaView
      style={
        styles.page
      }
    >
      <Stack.Screen
        options={{
          title:
            'My Attendance QR',
          headerShown:
            true,
        }}
      />

      <ScrollView
        contentContainerStyle={
          styles.content
        }
      >
        <View>
          <Text
            style={
              styles.eyebrow
            }
          >
            MY BUKLOD
          </Text>

          <Text
            style={
              styles.title
            }
          >
            Attendance ID
          </Text>

          <Text
            style={
              styles.subtitle
            }
          >
            Your BUKLOD account already has an Attendance QR. Show it to the BUKLOD Attendance scanner for quick check-in.
          </Text>
        </View>

        <BuklodAttendanceQrCard />

        <View
          style={
            styles.info
          }
        >
          <Text
            style={
              styles.infoTitle
            }
          >
            Attendance methods
          </Text>

          <Text
            style={
              styles.infoText
            }
          >
            QR is already enough for a BUKLOD account. Face registration is optional. Device fingerprint or biometric authentication is also optional on the user's own device.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}


const styles =
  StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor:
        colors.background,
    },

    content: {
      padding: 18,
      paddingBottom: 40,
    },

    eyebrow: {
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 1.2,
      color:
        colors.muted,
    },

    title: {
      marginTop: 4,
      fontSize: 28,
      fontWeight: '900',
      color:
        colors.text,
    },

    subtitle: {
      marginTop: 7,
      fontSize: 14,
      lineHeight: 21,
      color:
        colors.muted,
    },

    info: {
      marginTop: 4,
      padding: 15,
      borderRadius: 16,
      borderWidth: 1,
      borderColor:
        colors.line,
      backgroundColor:
        colors.white,
    },

    infoTitle: {
      fontWeight: '900',
      color:
        colors.text,
    },

    infoText: {
      marginTop: 6,
      lineHeight: 20,
      color:
        colors.muted,
    },
  });