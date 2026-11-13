import React, { useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';
import { buklodInstantNavigate } from '@/lib/buklodInstantNavigation';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
type MenuLink = { label: string; hint: string; icon: IconName; route: string };
const SECTIONS: { title: string; links: MenuLink[] }[] = [
  { title: 'EXPLORE', links: [
    { label: 'Home', hint: 'Your everyday BUKLOD space', icon: 'home-variant-outline', route: '/hub' },
    { label: 'Wall & Marites', hint: 'Community posts and stories', icon: 'forum-outline', route: '/buklod' },
    { label: 'Cluster', hint: 'Find your community', icon: 'account-group-outline', route: '/clusters' },
    { label: 'Connect', hint: 'Chats and calls', icon: 'message-outline', route: '/messages' },
    { label: 'Profile', hint: 'Account and personal tools', icon: 'account-outline', route: '/me' },
  ] },
  { title: 'YOUR TOOLS', links: [
    { label: 'Notifications', hint: 'Updates and activity', icon: 'bell-outline', route: '/notifications' },
    { label: 'My Drawer', hint: 'Private notes and files', icon: 'folder-outline', route: '/drawer' },
    { label: 'Settings', hint: 'Appearance and privacy', icon: 'cog-outline', route: '/settings' },
  ] },
  { title: 'BUKLOD', links: [
    { label: 'Help & Support', hint: 'Searchable offline help', icon: 'help-circle-outline', route: '/settings/navigation-help' },
    { label: 'About BUKLOD', hint: 'Our purpose and community', icon: 'information-outline', route: '/about-buklod' },
  ] },
];
const GLOBAL_TABS = new Set(['/hub', '/clusters', '/buklod', '/messages', '/me']);

export default function BuklodNavigationSideMenu({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { theme } = useBuklodTheme();
  const { activeScope, scopes, selectScope } = useBuklodScope();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const busy = useRef(false);
  const [opening, setOpening] = useState(false);
  const navigate = async (item: MenuLink) => {
    if (busy.current) return;
    busy.current = true;
    setOpening(true);
    try {
      // Match the canonical five-tab rule: global destinations must never
      // carry Organization/Cluster authorization context into public screens.
      if (activeScope?.scope_type === 'ORGANIZATION' || activeScope?.scope_type === 'CLUSTER') {
        const publicScope = scopes.find(scope => scope.scope_type === 'PUBLIC');
        if (!publicScope) throw new Error('Hindi pa ma-load ang Public community. Subukang muli.');
        await selectScope(publicScope.scope_id);
      }
      onClose();
      if (GLOBAL_TABS.has(item.route)) buklodInstantNavigate(item.route as '/hub' | '/clusters' | '/buklod' | '/messages' | '/me');
      else router.push(item.route as any);
    } catch (error) {
      Alert.alert('Hindi mabuksan', error instanceof Error ? error.message : 'Subukang muli.');
    } finally {
      busy.current = false;
      setOpening(false);
    }
  };
  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: 'rgba(7,16,32,0.48)' }}>
        <View style={{ width: Math.min(328, width * 0.86), maxWidth: '100%', backgroundColor: theme.surfaceElevated,
          paddingTop: Math.max(insets.top, 12), paddingBottom: Math.max(insets.bottom, 16),
          borderTopRightRadius: 22, borderBottomRightRadius: 22, overflow: 'hidden' }}>
          <View style={{ paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.border,
            flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
              backgroundColor: theme.accentSoft }}>
              <MaterialCommunityIcons name="account-group" size={25} color={theme.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text allowFontScaling style={{ color: theme.textPrimary, fontSize: 20, fontWeight: '900' }}>BUKLOD</Text>
              <Text allowFontScaling style={{ color: theme.textMuted, fontSize: 12 }}>Your community, your space</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close navigation menu" onPress={onClose}
              style={{ minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center' }}>
              <MaterialCommunityIcons name="close" size={25} color={theme.textPrimary} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 12, gap: 14 }}>
            {SECTIONS.map(section => (
              <View key={section.title} style={{ gap: 5 }}>
                <Text allowFontScaling style={{ color: theme.textMuted, fontSize: 12, fontWeight: '800',
                  letterSpacing: 1, paddingHorizontal: 13 }}>{section.title}</Text>
                {section.links.map(item => {
                  const selected = pathname === item.route;
                  return (
                    <Pressable key={item.route} accessibilityRole="button" accessibilityLabel={item.label}
                      accessibilityHint={item.hint} accessibilityState={{ selected, disabled: opening }}
                      disabled={opening} onPress={() => { void navigate(item); }}
                      style={({ pressed }) => ({ minHeight: 54, borderRadius: 13,
                        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, gap: 12,
                        backgroundColor: selected || pressed ? theme.accentSoft : 'transparent' })}>
                      <MaterialCommunityIcons name={item.icon} size={23} color={selected ? theme.accent : theme.textSecondary} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text allowFontScaling style={{ color: selected ? theme.accent : theme.textPrimary,
                          fontSize: 16, fontWeight: selected ? '800' : '600' }}>{item.label}</Text>
                        <Text allowFontScaling style={{ color: theme.textMuted, fontSize: 12 }}>{item.hint}</Text>
                      </View>
                      {selected && <MaterialCommunityIcons name="check" size={19} color={theme.accent} />}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Close navigation menu"
          onPress={onClose} style={{ flex: 1, minWidth: 0 }} />
      </View>
    </Modal>
  );
}
