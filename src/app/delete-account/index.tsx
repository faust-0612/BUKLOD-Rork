import { Linking, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

import {
  BuklodPublicLegalPage,
  publicLegalStyles,
} from '@/components/BuklodPublicLegalPage';
import {
  BUKLOD_DELETE_ACCOUNT_EFFECTIVE_DATE,
  BUKLOD_DELETE_ACCOUNT_PUBLIC_URL,
  BUKLOD_DELETE_ACCOUNT_VERSION,
  BUKLOD_PRIVACY_ANDROID_PACKAGE,
  BUKLOD_PRIVACY_APP_NAME,
  BUKLOD_PRIVACY_CONTACT_EMAIL,
  BUKLOD_PRIVACY_CONTROLLER_NAME,
  BUKLOD_PRIVACY_DEVELOPER_NAME,
  buklodAccountDeletionSections,
} from '@/lib/buklodPublicAccountDeletion';

export default function PublicDeleteAccountScreen() {
  return (
    <BuklodPublicLegalPage
      documentTitle="BUKLOD Account Deletion"
      screenTitle="BUKLOD Account Deletion"
      kicker="PUBLIC POLICY"
      title="Delete a BUKLOD account"
      meta={`Effective / last updated: ${BUKLOD_DELETE_ACCOUNT_EFFECTIVE_DATE} · Version ${BUKLOD_DELETE_ACCOUNT_VERSION}`}
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
        accessibilityLabel="Email privacy contact to request account deletion"
      >
        <Text style={publicLegalStyles.link}>
          Request deletion by email: {BUKLOD_PRIVACY_CONTACT_EMAIL}
        </Text>
      </Pressable>
      <Text style={publicLegalStyles.hint}>
        Public URL: {BUKLOD_DELETE_ACCOUNT_PUBLIC_URL}
      </Text>

      <Pressable
        onPress={() => router.push('/privacy' as any)}
        accessibilityRole="link"
        accessibilityLabel="Open the BUKLOD Privacy Policy"
      >
        <Text style={publicLegalStyles.link}>
          Privacy Policy (no login required)
        </Text>
      </Pressable>

      {buklodAccountDeletionSections.map((section) => (
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
        onPress={() => router.push('/privacy' as any)}
        accessibilityRole="link"
        accessibilityLabel="Open the BUKLOD Privacy Policy"
      >
        <Text style={publicLegalStyles.link}>Read the Privacy Policy</Text>
      </Pressable>
    </BuklodPublicLegalPage>
  );
}
