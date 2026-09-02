import { Linking, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

import {
  BuklodPublicLegalPage,
  publicLegalStyles,
} from '@/components/BuklodPublicLegalPage';
import {
  BUKLOD_PRIVACY_ANDROID_PACKAGE,
  BUKLOD_PRIVACY_APP_NAME,
  BUKLOD_PRIVACY_CONTACT_EMAIL,
  BUKLOD_PRIVACY_CONTROLLER_NAME,
  BUKLOD_PRIVACY_DEVELOPER_NAME,
  BUKLOD_PRIVACY_POLICY_EFFECTIVE_DATE,
  BUKLOD_PRIVACY_POLICY_PUBLIC_URL,
  BUKLOD_PRIVACY_POLICY_VERSION,
  buklodPrivacyPolicySections,
} from '@/lib/buklodPublicPrivacyPolicy';

export default function PublicPrivacyPolicyScreen() {
  return (
    <BuklodPublicLegalPage
      documentTitle="BUKLOD Privacy Policy"
      screenTitle="BUKLOD Privacy Policy"
      kicker="PUBLIC POLICY"
      title="BUKLOD Privacy Policy"
      meta={`Effective / last updated: ${BUKLOD_PRIVACY_POLICY_EFFECTIVE_DATE} · Version ${BUKLOD_PRIVACY_POLICY_VERSION}`}
    >
      <Text style={publicLegalStyles.lead}>
        {BUKLOD_PRIVACY_APP_NAME} is operated with {BUKLOD_PRIVACY_CONTROLLER_NAME}{' '}
        Google Play listing identity: app name {BUKLOD_PRIVACY_APP_NAME}, Android
        package {BUKLOD_PRIVACY_ANDROID_PACKAGE}. Developer shown in the app:{' '}
        {BUKLOD_PRIVACY_DEVELOPER_NAME}.
      </Text>

      <Pressable
        onPress={() =>
          void Linking.openURL(`mailto:${BUKLOD_PRIVACY_CONTACT_EMAIL}`)
        }
        accessibilityRole="link"
        accessibilityLabel="Email privacy contact"
      >
        <Text style={publicLegalStyles.link}>
          Privacy contact: {BUKLOD_PRIVACY_CONTACT_EMAIL}
        </Text>
      </Pressable>
      <Text style={publicLegalStyles.hint}>
        Public URL: {BUKLOD_PRIVACY_POLICY_PUBLIC_URL}
      </Text>

      <Pressable
        onPress={() => router.push('/delete-account' as any)}
        accessibilityRole="link"
        accessibilityLabel="Open BUKLOD account deletion instructions"
      >
        <Text style={publicLegalStyles.link}>
          How to delete a BUKLOD account (no login required)
        </Text>
      </Pressable>

      {buklodPrivacyPolicySections.map((section) => (
        <View key={section.heading} style={publicLegalStyles.section}>
          <Text accessibilityRole="header" style={publicLegalStyles.heading}>
            {section.heading}
          </Text>
          {section.paragraphs.map((paragraph, index) => (
            <Text
              key={`${section.heading}-p-${index}`}
              style={publicLegalStyles.body}
            >
              {paragraph}
            </Text>
          ))}
          {section.bullets?.map((item, index) => (
            <Text
              key={`${section.heading}-b-${index}`}
              style={publicLegalStyles.bullet}
            >
              • {item}
            </Text>
          ))}
        </View>
      ))}

      <Pressable
        onPress={() => router.push('/delete-account' as any)}
        accessibilityRole="link"
        accessibilityLabel="Open BUKLOD account deletion instructions"
      >
        <Text style={publicLegalStyles.link}>
          Account deletion instructions
        </Text>
      </Pressable>
    </BuklodPublicLegalPage>
  );
}
