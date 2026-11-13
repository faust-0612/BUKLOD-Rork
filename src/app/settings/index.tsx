import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';

type Icon = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
type SettingLink = { label: string; description: string; icon: Icon; route: string };
const GROUPS: { title: string; links: SettingLink[] }[] = [
  { title: 'Account & Security', links: [
    { label: 'Personal information', description: 'Name and account details', icon: 'account-edit-outline', route: '/account/personal-information' },
    { label: 'Password & recovery', description: 'Secure your account', icon: 'lock-reset', route: '/account/security' },
    { label: 'Recovery PIN', description: 'Manage your recovery PIN', icon: 'shield-key-outline', route: '/account/recovery-pin' },
  ] },
  { title: 'Privacy & Safety', links: [
    { label: 'Privacy policy', description: 'How your information is handled', icon: 'shield-account-outline', route: '/privacy' },
    { label: 'Privacy notice', description: 'Your privacy rights', icon: 'file-document-outline', route: '/privacy/notice' },
    { label: 'Community safety', description: 'Get help with safety or report a concern', icon: 'shield-alert-outline', route: '/support/live' },
  ] },
  { title: 'Notifications & Preferences', links: [
    { label: 'Notifications', description: 'Messages and updates', icon: 'bell-outline', route: '/notifications' },
    { label: 'Sounds & notifications', description: 'Sound styles and quiet hours', icon: 'volume-high', route: '/settings/sounds' },
    { label: 'Language', description: 'Use a supported app language', icon: 'translate', route: '/preferences/language' },
  ] },
  { title: 'Help & Support', links: [
    { label: 'Live support', description: 'Report a problem or ask for help', icon: 'lifebuoy', route: '/support/live' },
    { label: 'Contact us', description: 'Reach the BUKLOD team', icon: 'email-outline', route: '/contact-us' },
  ] },
  { title: 'Account management', links: [
    { label: 'Deactivate account', description: 'Temporarily deactivate your account', icon: 'account-off-outline', route: '/account/deactivate' },
    { label: 'Delete account', description: 'Review account deletion and confirmation', icon: 'delete-outline', route: '/account/delete' },
  ] },
];

export default function BuklodSettingsHome() {
  const insets = useSafeAreaInsets();
  const { theme } = useBuklodTheme();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.canvas }}
      contentContainerStyle={{ paddingTop: Math.max(insets.top, 10) + 8, paddingBottom: Math.max(insets.bottom, 20) + 20, paddingHorizontal: 12, gap: 12 }}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back from Settings"
        onPress={() => router.canGoBack() ? router.back() : router.replace('/me' as any)}
        style={{ alignSelf: 'flex-start', minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 6 }}
      >
        <MaterialCommunityIcons name="arrow-left" size={24} color={theme.textPrimary} />
        <Text allowFontScaling style={{ color: theme.textPrimary, fontSize: 17, fontWeight: '800' }}>Settings</Text>
      </Pressable>
      {GROUPS.map(group => (
        <View key={group.title} style={{ gap: 5 }}>
          <Text allowFontScaling style={{ color: theme.textMuted, fontSize: 13, fontWeight: '800', marginHorizontal: 6, marginTop: 7 }}>
            {group.title}
          </Text>
          <View style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 15, overflow: 'hidden' }}>
            {group.links.map((item, i) => (
              <Pressable
                key={item.route}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                accessibilityHint={item.description}
                onPress={() => router.push(item.route as any)}
                style={({ pressed }) => ({
                  minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10,
                  paddingHorizontal: 12, paddingVertical: 9,
                  borderTopWidth: i === 0 ? 0 : 1, borderTopColor: theme.border,
                  backgroundColor: pressed ? theme.accentSoft : theme.surface,
                })}
              >
                <MaterialCommunityIcons name={item.icon} size={22} color={theme.accent} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text allowFontScaling style={{ fontSize: 16, fontWeight: '700', color: theme.textPrimary }}>{item.label}</Text>
                  <Text allowFontScaling style={{ fontSize: 13, lineHeight: 19, color: theme.textMuted }}>{item.description}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={21} color={theme.textMuted} />
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
