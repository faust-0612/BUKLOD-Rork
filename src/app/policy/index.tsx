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
BuklodPolicyScreen() {
  return (
    <ScrollView
      contentContainerStyle={
        styles.content
      }
    >
      <Text style={styles.title}>
        BUKLOD Policy
      </Text>

      <Text style={styles.body}>
        This is the policy hub for BUKLOD.
        Official policy content can be
        maintained here without mixing it
        with technical support tools.
      </Text>

      <Pressable
        style={styles.row}
        onPress={() =>
          router.push(
            '/privacy/notice' as any
          )
        }
      >
        <MaterialCommunityIcons
          name="shield-lock-outline"
          size={23}
          color={colors.green}
        />

        <View style={styles.copy}>
          <Text style={styles.rowTitle}>
            Privacy Notice
          </Text>
          <Text style={styles.rowBody}>
            Read how BUKLOD handles
            personal information.
          </Text>
        </View>
      </Pressable>

      <Pressable
        style={styles.row}
        onPress={() =>
          router.push(
            '/moderation/report' as any
          )
        }
      >
        <MaterialCommunityIcons
          name="shield-alert-outline"
          size={23}
          color={colors.green}
        />

        <View style={styles.copy}>
          <Text style={styles.rowTitle}>
            Community Safety
          </Text>
          <Text style={styles.rowBody}>
            Report content or behavior
            that needs review.
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
      backgroundColor:
        colors.background,
      minHeight: '100%',
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
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 16,
      padding: 15,
      marginBottom: 10,
      backgroundColor:
        colors.white,
    },

    copy: {
      flex: 1,
    },

    rowTitle: {
      fontSize: 15,
      fontWeight: '900',
      color: colors.text,
    },

    rowBody: {
      marginTop: 3,
      color: colors.muted,
      lineHeight: 18,
    },
  });
