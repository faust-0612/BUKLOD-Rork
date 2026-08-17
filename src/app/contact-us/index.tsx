import React from 'react';

import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  router,
} from 'expo-router';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import {
  colors,
} from '@/lib/theme';

export default function
ContactUsScreen() {
  return (
    <ScrollView
      contentContainerStyle={
        styles.content
      }
    >
      <Text style={styles.title}>
        Contact Us
      </Text>

      <Text style={styles.body}>
        Contact BUKLOD through the
        in-app feedback channel. Official
        phone or email details can be
        added here later without placing
        unverified contact information in
        the app.
      </Text>

      <Pressable
        style={styles.row}
        onPress={() =>
          router.push(
            '/feedback' as any
          )
        }
      >
        <MaterialCommunityIcons
          name="message-text-outline"
          size={24}
          color={colors.green}
        />

        <View style={styles.copy}>
          <Text style={styles.rowTitle}>
            Send a Message
          </Text>
          <Text style={styles.rowBody}>
            Send feedback, questions, or
            concerns to the BUKLOD team.
          </Text>
        </View>
      </Pressable>
    </ScrollView>
  );
}

const styles =
  StyleSheet.create({
    content: {
      padding: 20,
      paddingBottom: 34,
      minHeight: '100%',
      backgroundColor:
        colors.background,
    },

    title: {
      fontSize: 27,
      fontWeight: '900',
      color: colors.greenDark,
      marginBottom: 8,
    },

    body: {
      color: colors.text,
      lineHeight: 21,
      marginBottom: 18,
    },

    row: {
      flexDirection: 'row',
      gap: 12,
      padding: 15,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 16,
      backgroundColor:
        colors.white,
    },

    copy: {
      flex: 1,
    },

    rowTitle: {
      fontWeight: '900',
      fontSize: 15,
      color: colors.text,
    },

    rowBody: {
      marginTop: 3,
      color: colors.muted,
      lineHeight: 18,
    },
  });
