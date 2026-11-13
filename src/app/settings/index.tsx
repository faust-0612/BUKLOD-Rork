import React, { useMemo, useState } from 'react';
import { buklodVisual } from '@/lib/buklodVisual';
import { BuklodAppearanceSection } from '@/components/BuklodGlobalThemeSelector';
import { Pressable, ScrollView, StatusBar, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';
import { ProfilePressable } from '@/components/BuklodProfileMotion';

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
    { label: 'How to use BUKLOD', description: 'Five tabs, feature finder and pinned shortcuts', icon: 'help-circle-outline', route: '/settings/navigation-help' },
    { label: 'Live support', description: 'Report a problem or ask for help', icon: 'lifebuoy', route: '/support/live' },
    { label: 'Contact us', description: 'Reach the BUKLOD team', icon: 'email-outline', route: '/contact-us' },
  ] },
  { title: 'Account management', links: [
    { label: 'Deactivate account', description: 'Temporarily deactivate your account', icon: 'account-off-outline', route: '/account/deactivate' },
    { label: 'Delete account', description: 'Review account deletion and confirmation', icon: 'delete-outline', route: '/account/delete' },
  ] },
];

export default function BuklodSettingsHome() {
  const [query, setQuery] = useState('');
  const groups = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return GROUPS.map(group => ({ ...group, links: group.links.filter(item =>
      !term || `${group.title} ${item.label} ${item.description}`.toLocaleLowerCase().includes(term))
    })).filter(group => group.links.length > 0);
  }, [query]);
  const insets = useSafeAreaInsets();
  const { theme, paletteId } = useBuklodTheme();
  const darkPalette = paletteId === 'nightPine' || paletteId === 'graphite' || paletteId === 'midnight';
  return (
    <>
    <StatusBar barStyle={darkPalette ? 'light-content' : 'dark-content'} backgroundColor={theme.canvas} />
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.canvas }}
      contentContainerStyle={{ paddingTop: Math.max(insets.top, 6) + 4, paddingBottom: Math.max(insets.bottom, 20) + 16, paddingHorizontal: 12, gap: 9 }}
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
      <View style={{ minHeight: buklodVisual.size.touch, flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 12, borderRadius: buklodVisual.radius.control, backgroundColor: theme.inputSurface }}>
        <MaterialCommunityIcons name="magnify" size={22} color={theme.textMuted} />
        <TextInput accessibilityLabel="Search settings" placeholder="Search settings" placeholderTextColor={theme.textMuted}
          value={query} onChangeText={setQuery} allowFontScaling autoCorrect={false}
          style={{ flex: 1, minWidth: 0, minHeight: 48, fontSize: 16, color: theme.textPrimary }} />
        {!!query && <Pressable accessibilityRole="button" accessibilityLabel="Clear settings search" onPress={() => setQuery('')}
          style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
          <MaterialCommunityIcons name="close" size={20} color={theme.textMuted} />
        </Pressable>}
      </View>
      {(!query || /appearance|theme|display|accessib|font/i.test(query)) && <BuklodAppearanceSection />}
      {groups.length === 0 && <Text allowFontScaling style={{ color: theme.textMuted, padding: 12 }}>No matching setting. Try account, privacy, notifications or help.</Text>}
      {groups.map(group => (
        <View key={group.title} style={{ gap: 5 }}>
          <Text allowFontScaling style={{ color: theme.textMuted, fontSize: 12, fontWeight: '800', marginHorizontal: 6, marginTop: 3 }}>
            {group.title}
          </Text>
          <View style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: buklodVisual.radius.card, overflow: 'hidden' }}>
            {group.links.map((item, i) => (
              <ProfilePressable
                key={item.route}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                accessibilityHint={item.description}
                onPress={() => router.push(item.route as any)}
                style={({ pressed }) => ({
                  minHeight: buklodVisual.size.row, flexDirection: 'row', alignItems: 'center', gap: 9,
                  paddingHorizontal: 11, paddingVertical: 5,
                  borderTopWidth: i === 0 ? 0 : 1, borderTopColor: theme.border,
                  backgroundColor: pressed ? theme.accentSoft : theme.surface,
                })}
              >
                <View style={{ width: 33, height: 33, borderRadius: 11, backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialCommunityIcons name={item.icon} size={19} color={theme.accent} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text allowFontScaling style={{ fontSize: 15, fontWeight: '700', color: theme.textPrimary }}>{item.label}</Text>
                  <Text allowFontScaling style={{ fontSize: 12, lineHeight: 17, color: theme.textMuted }}>{item.description}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={21} color={theme.textMuted} />
              </ProfilePressable>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
    </>
  );
}
