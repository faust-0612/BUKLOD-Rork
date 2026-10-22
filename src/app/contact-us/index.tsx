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
  BUKLOD_PRIVACY_CONTACT_EMAIL,
} from '@/lib/buklodPublicPrivacyPolicy';
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
        Contact BUKLOD through the in-app feedback channel or{' '}
        {BUKLOD_PRIVACY_CONTACT_EMAIL}.
      </Text>

      <Pressable
        style={styles.row}
        onPress={() =>
          router.push(
            '/privacy' as any
          )
        }
      >
        <MaterialCommunityIcons
          name="shield-account-outline"
          size={24}
          color={colors.green}
        />

        <View style={styles.copy}>
          <Text style={styles.rowTitle}>
            Privacy Policy
          </Text>
          <Text style={styles.rowBody}>
            Public policy at buklod.expo.app/privacy. No login required.
          </Text>
        </View>
      </Pressable>

      <Pressable
        style={styles.row}
        onPress={() =>
          router.push(
            '/delete-account' as any
          )
        }
      >
        <MaterialCommunityIcons
          name="account-remove-outline"
          size={24}
          color={colors.green}
        />

        <View style={styles.copy}>
          <Text style={styles.rowTitle}>
            Account Deletion
          </Text>
          <Text style={styles.rowBody}>
            Public instructions at buklod.expo.app/delete-account. No login required.
          </Text>
        </View>
      </Pressable>

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
