import React, {
  useState,
} from 'react';

import {
  Alert,
  Image,
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
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import {
  Button,
  Card,
  SectionTitle,
  shared,
} from '@/components/UI';

import {
  colors,
} from '@/lib/theme';

import {
  useCompliance,
} from '@/providers/ComplianceProvider';

/*
 * PATCH_173A_R4_SUBTLE_RECOGNITION
 *
 * Recognition is intentionally secondary:
 * - MZB logo is small and restrained.
 * - Zion mark is used as a compact badge.
 * - Developer portrait is a small circular recognition image.
 * - Main visual priority stays with the acknowledgement content.
 *
 * Compliance behavior remains acceptAll() + root routing handoff.
 */

const mzbLogo =
  require(
    '../../../assets/branding/privacy-consent-mzb.jpg'
  );

const zionLogo =
  require(
    '../../../assets/branding/privacy-consent-zion.jpg'
  );

const developerPhoto =
  require(
    '../../../assets/branding/privacy-consent-developer.jpg'
  );

export default function PrivacyConsentScreen() {
  const insets =
    useSafeAreaInsets();

  const {
    acceptAll,
  } =
    useCompliance();

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const accept =
    async () => {
      if (busy) {
        return;
      }

      setBusy(true);

      try {
        const result =
          await acceptAll();

        if (result.error) {
          Alert.alert(
            'BUKLOD',
            result.error
          );

          return;
        }

        router.replace('/');
      }
      catch (error: any) {
        Alert.alert(
          'BUKLOD',
          error?.message ??
            'Could not save your acknowledgement. Please try again.'
        );
      }
      finally {
        setBusy(false);
      }
    };

  return (
    <ScrollView
      style={
        shared.screen
      }
      contentContainerStyle={[
        shared.content,
        {
          paddingTop:
            Math.max(
              insets.top,
              18
            ),
          paddingBottom:
            Math.max(
              insets.bottom,
              18
            ) +
            28,
        },
      ]}
      showsVerticalScrollIndicator={
        false
      }
    >
      {/* Quiet ministry recognition - not a hero banner. */}
      <View
        style={
          styles.brandRow
        }
      >
        <Image
          source={
            mzbLogo
          }
          style={
            styles.mzbLogo
          }
          resizeMode="contain"
        />

        <Image
          source={
            zionLogo
          }
          style={
            styles.zionBadge
          }
          resizeMode="cover"
        />
      </View>

      <Text
        style={
          shared.h1
        }
      >
        Before you continue
      </Text>

      <Text
        style={[
          shared.muted,
          styles.lead,
        ]}
      >
        BUKLOD separates your global/Public experience from managed community workspaces. Please review how navigation and scope work before continuing.
      </Text>

      <SectionTitle>
        CURRENT BUKLOD STRUCTURE
      </SectionTitle>

      <Card>
        <Text
          style={
            styles.cardTitle
          }
        >
          Public / Personal BUKLOD
        </Text>

        <Text
          style={
            styles.body
          }
        >
          The persistent bottom navigation belongs to your global/Public BUKLOD environment. Global navigation opens your personal BUKLOD destinations rather than keeping you inside a managed Organization workspace.
        </Text>
      </Card>

      <Card>
        <Text
          style={
            styles.cardTitle
          }
        >
          Organizations & Sub-organizations
        </Text>

        <Text
          style={
            styles.body
          }
        >
          Organization and Sub-organization workspaces use their own scoped Home, Community, and Connect navigation. Content and actions there remain tied to the active managed scope.
        </Text>
      </Card>

      <Card>
        <Text
          style={
            styles.cardTitle
          }
        >
          Clusters
        </Text>

        <Text
          style={
            styles.body
          }
        >
          Cluster workspaces keep their own managed context. The global bottom navigation is not part of the Cluster workspace while you are working inside that scope.
        </Text>
      </Card>

      <SectionTitle>
        ACKNOWLEDGEMENT
      </SectionTitle>

      <Card>
        <Text
          style={
            styles.body
          }
        >
          Your acknowledgement is saved using the existing BUKLOD compliance process. After acceptance, the current root routing flow determines the correct destination based on your account, membership, and active scope.
        </Text>
      </Card>

      <Pressable
        onPress={() => router.push('/privacy' as any)}
        accessibilityRole="link"
        style={{ paddingVertical: 12 }}
      >
        <Text
          style={{
            color: colors.greenDark,
            fontWeight: '800',
            textDecorationLine: 'underline',
          }}
        >
          Read the BUKLOD Privacy Policy
        </Text>
      </Pressable>
      <Pressable
        onPress={() => router.push('/delete-account' as any)}
        accessibilityRole="link"
        style={{ paddingBottom: 12 }}
      >
        <Text
          style={{
            color: colors.greenDark,
            fontWeight: '800',
            textDecorationLine: 'underline',
          }}
        >
          How to delete a BUKLOD account
        </Text>
      </Pressable>

      <View
        style={
          styles.action
        }
      >
        <Button
          title={
            busy
              ? 'SAVING...'
              : 'ACKNOWLEDGE & CONTINUE'
          }
          onPress={
            accept
          }
        />
      </View>

      {/* Recognition only - intentionally quiet and compact. */}
      <View
        style={
          styles.recognition
        }
      >
        <Image
          source={
            developerPhoto
          }
          style={
            styles.developerPhoto
          }
          resizeMode="cover"
        />

        <View
          style={
            styles.recognitionCopy
          }
        >
          <Text
            style={
              styles.recognitionLabel
            }
          >
            Developer
          </Text>

          <Text
            style={
              styles.developerName
            }
          >
            Faustino Jr. M. Gabut
          </Text>

          <Text
            style={
              styles.ministryLine
            }
          >
            MZB Ministry
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles =
  StyleSheet.create({
    brandRow: {
      minHeight: 38,
      marginBottom: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },

    mzbLogo: {
      width: 132,
      height: 38,
      opacity: 0.86,
    },

    zionBadge: {
      width: 32,
      height: 32,
      borderRadius: 16,
      opacity: 0.78,
    },

    lead: {
      marginTop: 8,
      marginBottom: 4,
      lineHeight: 20,
    },

    cardTitle: {
      marginBottom: 6,
      fontSize: 16,
      fontWeight: '900',
      color: colors.greenDark,
    },

    body: {
      fontSize: 14,
      lineHeight: 21,
      color: colors.text,
    },

    action: {
      marginTop: 6,
    },

    recognition: {
      marginTop: 18,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 7,
      paddingHorizontal: 10,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
      backgroundColor: colors.white,
      opacity: 0.84,
    },

    developerPhoto: {
      width: 34,
      height: 34,
      borderRadius: 17,
      marginRight: 9,
    },

    recognitionCopy: {
      minWidth: 136,
    },

    recognitionLabel: {
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 0.7,
      textTransform: 'uppercase',
      color: colors.muted,
    },

    developerName: {
      marginTop: 1,
      fontSize: 11,
      fontWeight: '800',
      color: colors.text,
    },

    ministryLine: {
      marginTop: 1,
      fontSize: 9,
      color: colors.muted,
    },
  });