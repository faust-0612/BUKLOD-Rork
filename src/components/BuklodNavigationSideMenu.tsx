import React, { useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StatusBar, Text, View, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
type MenuLink = { label: string; hint: string; icon: IconName; route: string };
const SECTIONS: readonly { title: string; hint: string; links: readonly MenuLink[] }[] = [
  { title: 'LEARN & GROW', hint: 'Faith, service and personal growth', links: [
    { label: 'Bible & Reading', hint: 'Read and reflect', icon: 'book-open-variant', route: '/bible' },
    { label: 'Community Contribution', hint: 'Your progress and Bayanihan', icon: 'hand-heart-outline', route: '/community-contribution' },
    { label: 'BUKLOD Kingdom', hint: 'Explore your game progress', icon: 'crown-outline', route: '/games' },
  ] },
  { title: 'YOUR PERSONAL TOOLS', hint: 'Useful features in one place', links: [
    { label: 'My Drawer', hint: 'Private notes and files', icon: 'folder-outline', route: '/drawer' },
    { label: 'Health Center', hint: 'Consultation and health resources', icon: 'heart-pulse', route: '/profile/buklod-health' },
    { label: 'Settings', hint: 'Appearance, privacy and security', icon: 'cog-outline', route: '/settings' },
  ] },
  { title: 'HELP & INFORMATION', hint: 'Guides and assistance', links: [
    { label: 'Live Support', hint: 'Get help and report an issue', icon: 'lifebuoy', route: '/support/live' },
    { label: 'How to use BUKLOD', hint: 'Learn features and navigation', icon: 'help-circle-outline', route: '/settings/navigation-help' },
    { label: 'About BUKLOD', hint: 'Our purpose and community', icon: 'information-outline', route: '/about-buklod' },
  ] },
];

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
      // Preserve canonical PUBLIC scope isolation for personal destinations.
      if (activeScope?.scope_type === 'ORGANIZATION' || activeScope?.scope_type === 'CLUSTER') {
        const publicScope = scopes.find(scope => scope.scope_type === 'PUBLIC');
        if (!publicScope) throw new Error('Hindi pa ma-load ang Public community. Subukang muli.');
        await selectScope(publicScope.scope_id);
      }
      onClose();
      router.push(item.route as any);
    } catch (error) {
      Alert.alert('Hindi mabuksan', error instanceof Error ? error.message : 'Subukang muli.');
    } finally {
      busy.current = false;
      setOpening(false);
    }
  };
  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="fade" onRequestClose={onClose}>
      {visible ? <StatusBar barStyle="light-content" backgroundColor="#0B2048" /> : null}
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: 'rgba(7,16,32,0.52)' }}>
        <View style={{ width: Math.min(332, width * 0.88), maxWidth: '100%', backgroundColor: theme.canvas,
          borderTopRightRadius: 23, borderBottomRightRadius: 23, overflow: 'hidden' }}>
          <View style={{ paddingTop: Math.max(insets.top, 12), paddingBottom: 18, paddingHorizontal: 16,
            backgroundColor: '#0B2048', gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
                backgroundColor: '#193968', borderWidth: 1, borderColor: '#325583' }}>
                <MaterialCommunityIcons name="view-dashboard-outline" size={26} color="#79DAA4" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text allowFontScaling style={{ color: '#FFFFFF', fontSize: 21, fontWeight: '900' }}>Explore BUKLOD</Text>
                <Text allowFontScaling style={{ color: '#CADAF2', fontSize: 12 }}>Discover what matters to you</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close navigation menu" onPress={onClose}
                style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14,
                  backgroundColor: 'rgba(255,255,255,0.09)' }}>
                <MaterialCommunityIcons name="close" size={25} color="#FFFFFF" />
              </Pressable>
            </View>
            <Text allowFontScaling style={{ color: '#AFC7E8', fontSize: 12 }}>
              Home, Wall, Cluster, Connect at Profile ay nasa navigation bar sa ibaba.
            </Text>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 16,
              paddingBottom: Math.max(insets.bottom, 16) + 12, gap: 17 }}>
            {SECTIONS.map(section => (
              <View key={section.title} style={{ gap: 7 }}>
                <View style={{ paddingHorizontal: 8, gap: 2 }}>
                  <Text allowFontScaling style={{ fontSize: 12, fontWeight: '900', letterSpacing: 0.8,
                    color: theme.accent }}>{section.title}</Text>
                  <Text allowFontScaling style={{ fontSize: 12, color: theme.textMuted }}>{section.hint}</Text>
                </View>
                <View style={{ borderRadius: 16, overflow: 'hidden',
                  borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface }}>
                  {section.links.map((item, index) => {
                    const selected = pathname === item.route;
                    return (
                      <Pressable key={item.route} accessibilityRole="button" accessibilityLabel={item.label}
                        accessibilityHint={item.hint} accessibilityState={{ selected, disabled: opening }}
                        disabled={opening} onPress={() => { void navigate(item); }}
                        style={({ pressed }) => ({ minHeight: 56, flexDirection: 'row',
                          alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 11,
                          borderTopWidth: index ? 1 : 0, borderTopColor: theme.border,
                          backgroundColor: selected || pressed ? theme.accentSoft : theme.surface })}>
                        <View style={{ width: 38, height: 38, borderRadius: 12,
                          backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                          <MaterialCommunityIcons name={item.icon} size={21} color={theme.accent} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                          <Text allowFontScaling style={{ color: theme.textPrimary, fontSize: 15, fontWeight: '800' }}>
                            {item.label}
                          </Text>
                          <Text allowFontScaling style={{ color: theme.textMuted, fontSize: 12 }}>{item.hint}</Text>
                        </View>
                        <MaterialCommunityIcons name={selected ? 'check' : 'chevron-right'} size={20}
                          color={selected ? theme.accent : theme.textMuted} />
                      </Pressable>
                    );
                  })}
                </View>
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
