import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { formatScopeTypeLabel } from '@/lib/buklodScope';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';

type CityDoor = {
  key: string;
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  route?: string;
  tone: string;
  surface: string;
  future?: boolean;
};

const CITY_DOORS: CityDoor[] = [
  {
    key: 'faith',
    title: 'Faith / Church',
    subtitle: 'Church life, Bible, formation and ministries',
    icon: 'church-outline',
    route: '/church',
    tone: '#7254C8',
    surface: '#F2EEFF',
  },
  {
    key: 'school',
    title: 'School',
    subtitle: 'Classroom, faculty, learning and attendance',
    icon: 'school-outline',
    route: '/profile/buklod-classrooms',
    tone: '#2877DD',
    surface: '#EAF3FF',
  },
  {
    key: 'market',
    title: 'Palengke / Market',
    subtitle: 'Local shops and future marketplace activity',
    icon: 'shopping-outline',
    route: '/profile/buklod-market',
    tone: '#D9971D',
    surface: '#FFF6DE',
  },
  {
    key: 'business',
    title: 'Businesses',
    subtitle: 'Business spaces, services and local commerce',
    icon: 'storefront-outline',
    route: '/profile/buklod-business',
    tone: '#DB7040',
    surface: '#FFF0E8',
  },
  {
    key: 'organizations',
    title: 'Organizations',
    subtitle: 'Organizations, sub-organizations and clusters',
    icon: 'account-group-outline',
    route: '/organizations',
    tone: '#168E8A',
    surface: '#E8F8F6',
  },
  {
    key: 'government',
    title: 'Government',
    subtitle: 'Reserved for verified barangay/LGU public services',
    icon: 'bank-outline',
    tone: '#7753B7',
    surface: '#F2EEFA',
    future: true,
  },
  {
    key: 'plaza',
    title: 'Community Plaza',
    subtitle: 'Bayanihan and local community participation',
    icon: 'town-hall',
    route: '/bayanihan',
    tone: '#319565',
    surface: '#EAF8F0',
  },
  {
    key: 'home',
    title: 'My Home',
    subtitle: 'Profile, personal spaces and connected life',
    icon: 'home-heart',
    route: '/(tabs)/me',
    tone: '#177552',
    surface: '#E8F7F0',
  },
];

const SUPPORT_TOOLS: CityDoor[] = [
  {
    key: 'igpat',
    title: 'BUKLOD IGPAT',
    subtitle: 'An Instant Bond',
    icon: 'play-box-multiple-outline',
    route: '/igpat',
    tone: '#C54A69',
    surface: '#FDEEF2',
  },
  {
    key: 'reports',
    title: 'Reports',
    subtitle: 'Existing reporting engine',
    icon: 'file-chart-outline',
    route: '/reports',
    tone: '#35679D',
    surface: '#EDF4FB',
  },
  {
    key: 'bible',
    title: 'Bible / Reading',
    subtitle: 'Existing Bible and reading flow',
    icon: 'book-open-page-variant-outline',
    route: '/bible',
    tone: '#82642D',
    surface: '#FBF4E7',
  },
  {
    key: 'points',
    title: 'Circle Points',
    subtitle: 'Shared progression bridge',
    icon: 'star-circle-outline',
    route: '/points',
    tone: '#A36C08',
    surface: '#FFF5D9',
  },
];

function CityDoorCard({ door }: { door: CityDoor }) {
  return (
    <Pressable
      disabled={!door.route}
      onPress={() => {
        if (door.route) router.push(door.route as any);
      }}
      style={({ pressed }) => [
        styles.door,
        { backgroundColor: door.surface },
        pressed && door.route ? styles.pressed : null,
      ]}
    >
      <View style={[styles.doorIcon, { backgroundColor: door.tone }]}>
        <MaterialCommunityIcons name={door.icon} size={25} color="#FFFFFF" />
      </View>
      <View style={styles.doorCopy}>
        <Text style={styles.doorTitle}>{door.title}</Text>
        <Text style={styles.doorSubtitle}>{door.subtitle}</Text>
        {door.future ? <Text style={styles.futureLabel}>Future verified space</Text> : null}
      </View>
      <MaterialCommunityIcons
        name={door.route ? 'chevron-right' : 'lock-outline'}
        size={20}
        color={door.route ? '#71849A' : '#8A7A9C'}
      />
    </Pressable>
  );
}

export default function BuklodCityScreen() {
  const { width } = useWindowDimensions();
  const { theme } = useBuklodTheme();
  const { activeScope, scopes } = useBuklodScope();

  const connectedScopes = useMemo(
    () =>
      scopes.filter(scope =>
        scope.scope_type === 'ORGANIZATION' ||
        scope.scope_type === 'CLUSTER' ||
        scope.scope_type === 'CHURCH'
      ),
    [scopes]
  );

  const locationName =
    scopes.find(scope => scope.scope_type === 'LOCAL')?.name ??
    'Your local community';

  const columnWidth = width >= 950 ? '24%' : width >= 640 ? '49%' : '100%';

  return (
    <View style={[styles.screen, { backgroundColor: theme.canvas }]}> 
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={20} color="#244B70" />
          </Pressable>
          <View style={styles.topCopy}>
            <Text style={styles.eyebrow}>BUKLOD CITY</Text>
            <Text style={[styles.title, { color: theme.textPrimary }]}>Your real community, connected.</Text>
          </View>
          <View style={styles.compatBadge}>
            <MaterialCommunityIcons name="shield-check-outline" size={17} color="#177552" />
            <Text style={styles.compatText}>Current APK compatible</Text>
          </View>
        </View>

        <View style={styles.scopeCard}>
          <View style={styles.scopeIcon}>
            <MaterialCommunityIcons name="layers-triple-outline" size={22} color="#1767D2" />
          </View>
          <View style={styles.scopeCopy}>
            <Text style={styles.scopeLabel}>CURRENT CONTEXT</Text>
            <Text style={styles.scopeName}>{activeScope?.name ?? 'Public Community'}</Text>
            <Text style={styles.scopeMeta}>
              {activeScope
                ? formatScopeTypeLabel(activeScope.scope_type, activeScope.geo_level, activeScope.parent_scope_id)
                : 'BUKLOD'}
              {' · existing permissions remain authoritative'}
            </Text>
          </View>
          {activeScope && activeScope.scope_type !== 'PUBLIC' ? (
            <Pressable style={styles.workspaceButton} onPress={() => router.push('/scope' as any)}>
              <Text style={styles.workspaceText}>Workspace</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.mapShell}>
          <View style={styles.mapHeader}>
            <View>
              <Text style={styles.eyebrow}>COMMUNITY MAP SHELL</Text>
              <Text style={styles.mapTitle}>{locationName}</Text>
            </View>
            <MaterialCommunityIcons name="map-marker-radius-outline" size={24} color="#1767D2" />
          </View>

          <View style={styles.mapCanvas}>
            <View style={[styles.mapBlock, styles.faithBlock]}>
              <MaterialCommunityIcons name="church-outline" size={26} color="#7154C9" />
              <Text style={styles.mapBlockText}>Faith</Text>
            </View>
            <View style={[styles.mapBlock, styles.schoolBlock]}>
              <MaterialCommunityIcons name="school-outline" size={26} color="#2877DD" />
              <Text style={styles.mapBlockText}>School</Text>
            </View>
            <View style={[styles.mapBlock, styles.marketBlock]}>
              <MaterialCommunityIcons name="shopping-outline" size={26} color="#D9971D" />
              <Text style={styles.mapBlockText}>Market</Text>
            </View>
            <View style={[styles.mapBlock, styles.businessBlock]}>
              <MaterialCommunityIcons name="storefront-outline" size={26} color="#DB7040" />
              <Text style={styles.mapBlockText}>Business</Text>
            </View>
            <View style={[styles.mapBlock, styles.plazaBlock]}>
              <MaterialCommunityIcons name="account-group-outline" size={26} color="#319565" />
              <Text style={styles.mapBlockText}>Plaza</Text>
            </View>
            <View style={[styles.mapBlock, styles.homeBlock]}>
              <MaterialCommunityIcons name="home-heart" size={26} color="#177552" />
              <Text style={styles.mapBlockText}>My Home</Text>
            </View>
            <View style={styles.roadHorizontal} />
            <View style={styles.roadVertical} />
          </View>

          <View style={styles.mapNote}>
            <MaterialCommunityIcons name="information-outline" size={18} color="#49677F" />
            <Text style={styles.mapNoteText}>This APK-compatible phase uses a pure UI community map shell. Real map/location layers can be added later only after their native/runtime impact is verified.</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.eyebrow}>COMMUNITY DOORS</Text>
          <Text style={styles.sectionTitle}>Existing BUKLOD systems, organized as real places.</Text>
        </View>

        <View style={styles.grid}>
          {CITY_DOORS.map(door => (
            <View key={door.key} style={{ width: columnWidth as any }}>
              <CityDoorCard door={door} />
            </View>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.eyebrow}>CONNECTED TOOLS</Text>
          <Text style={styles.sectionTitle}>The engines stay where they are.</Text>
        </View>

        <View style={styles.supportGrid}>
          {SUPPORT_TOOLS.map(door => (
            <View key={door.key} style={styles.supportItem}>
              <CityDoorCard door={door} />
            </View>
          ))}
        </View>

        <View style={styles.connectedCard}>
          <View style={styles.connectedHeader}>
            <View style={styles.connectedCopy}>
              <Text style={styles.eyebrow}>MY CONNECTED SPACES</Text>
              <Text style={styles.connectedTitle}>Organizations, Clusters and Churches</Text>
            </View>
            <Text style={styles.connectedCount}>{connectedScopes.length}</Text>
          </View>

          {connectedScopes.length ? (
            <View style={styles.connectedList}>
              {connectedScopes.slice(0, 8).map(scope => (
                <Pressable
                  key={scope.scope_id}
                  onPress={() => router.push(scope.is_active_scope ? '/scope' as any : '/organizations' as any)}
                  style={styles.connectedItem}
                >
                  <MaterialCommunityIcons
                    name={scope.scope_type === 'CLUSTER' ? 'account-multiple-outline' : scope.scope_type === 'CHURCH' ? 'church-outline' : 'office-building-outline'}
                    size={20}
                    color="#1E6E9D"
                  />
                  <View style={styles.connectedItemCopy}>
                    <Text style={styles.connectedItemTitle}>{scope.name}</Text>
                    <Text style={styles.connectedItemMeta}>
                      {formatScopeTypeLabel(scope.scope_type, scope.geo_level, scope.parent_scope_id)}
                      {scope.is_active_scope ? ' · Active' : ''}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={18} color="#8090A2" />
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No managed Organization, Cluster or Church is attached yet.</Text>
          )}
        </View>

        <View style={styles.progressCard}>
          <MaterialCommunityIcons name="star-circle-outline" size={29} color="#9A6C0C" />
          <View style={styles.progressCopy}>
            <Text style={styles.progressTitle}>One shared progression</Text>
            <Text style={styles.progressText}>Eligible real activities → Circle Points → Character progression + House development. No second points engine is created here.</Text>
          </View>
        </View>

        <View style={styles.releaseNote}>
          <MaterialCommunityIcons name="cellphone-check" size={23} color="#315E87" />
          <View style={styles.releaseCopy}>
            <Text style={styles.releaseTitle}>No new native requirement in this phase.</Text>
            <Text style={styles.releaseText}>This route uses React Native UI, Expo Router, existing theme/scope providers and existing routes only. No new package, Android permission, Manifest, native SDK, app config, runtimeVersion or versionCode is required.</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: 1180, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 44 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  backButton: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF4F9' },
  topCopy: { flex: 1 },
  eyebrow: { color: '#1C6CC1', fontSize: 10, lineHeight: 14, fontWeight: '900', letterSpacing: 1.25 },
  title: { marginTop: 2, fontSize: 29, lineHeight: 33, fontWeight: '900', letterSpacing: -0.8 },
  compatBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, backgroundColor: '#EAF8F2', borderWidth: 1, borderColor: '#C8EBDD' },
  compatText: { color: '#177552', fontSize: 9, fontWeight: '900' },
  scopeCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderRadius: 18, backgroundColor: '#F5FAFF', borderWidth: 1, borderColor: '#DCE8F3', marginBottom: 14 },
  scopeIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  scopeCopy: { flex: 1 },
  scopeLabel: { color: '#6D8399', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  scopeName: { marginTop: 2, color: '#173A62', fontSize: 14, fontWeight: '900' },
  scopeMeta: { marginTop: 2, color: '#74879A', fontSize: 9, lineHeight: 13 },
  workspaceButton: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: '#1767D2' },
  workspaceText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  mapShell: { padding: 13, borderRadius: 23, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE6EE' },
  mapHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  mapTitle: { marginTop: 2, color: '#173A62', fontSize: 18, fontWeight: '900' },
  mapCanvas: { height: 285, overflow: 'hidden', borderRadius: 19, backgroundColor: '#EAF1E7', borderWidth: 1, borderColor: '#D3DDCF' },
  mapBlock: { position: 'absolute', width: 84, height: 68, borderRadius: 15, alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE4E9', zIndex: 2 },
  mapBlockText: { color: '#4C5F71', fontSize: 9, fontWeight: '900' },
  faithBlock: { left: '7%', top: 27 },
  schoolBlock: { right: '7%', top: 28 },
  marketBlock: { left: '14%', bottom: 33 },
  businessBlock: { right: '13%', bottom: 31 },
  plazaBlock: { left: '50%', top: 37, marginLeft: -42 },
  homeBlock: { left: '50%', bottom: 24, marginLeft: -42 },
  roadHorizontal: { position: 'absolute', left: 0, right: 0, top: '49%', height: 28, backgroundColor: '#D0D4D1', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#BCC3BE' },
  roadVertical: { position: 'absolute', top: 0, bottom: 0, left: '48%', width: 28, backgroundColor: '#D0D4D1', borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#BCC3BE' },
  mapNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 10, padding: 10, borderRadius: 13, backgroundColor: '#F3F7FA' },
  mapNoteText: { flex: 1, color: '#697E91', fontSize: 9, lineHeight: 14 },
  sectionHeader: { marginTop: 25, marginBottom: 11 },
  sectionTitle: { marginTop: 2, color: '#173A62', fontSize: 20, lineHeight: 24, fontWeight: '900' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  door: { minHeight: 106, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(40,70,100,0.08)' },
  pressed: { opacity: 0.75 },
  doorIcon: { width: 43, height: 43, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  doorCopy: { flex: 1 },
  doorTitle: { color: '#173A62', fontSize: 12, fontWeight: '900' },
  doorSubtitle: { marginTop: 3, color: '#718398', fontSize: 9, lineHeight: 13 },
  futureLabel: { marginTop: 4, color: '#7A6790', fontSize: 8, fontWeight: '800' },
  supportGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  supportItem: { width: 250, maxWidth: '100%' },
  connectedCard: { marginTop: 23, padding: 15, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DFE7EE' },
  connectedHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  connectedCopy: { flex: 1 },
  connectedTitle: { marginTop: 2, color: '#173A62', fontSize: 15, fontWeight: '900' },
  connectedCount: { minWidth: 34, height: 34, borderRadius: 17, textAlign: 'center', lineHeight: 34, color: '#1767D2', backgroundColor: '#EDF5FF', fontSize: 11, fontWeight: '900' },
  connectedList: { marginTop: 11, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  connectedItem: { width: 290, maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 13, backgroundColor: '#F5F8FB' },
  connectedItemCopy: { flex: 1 },
  connectedItemTitle: { color: '#244869', fontSize: 10, fontWeight: '900' },
  connectedItemMeta: { marginTop: 2, color: '#788A9D', fontSize: 8 },
  emptyText: { marginTop: 11, color: '#718398', fontSize: 10 },
  progressCard: { marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 16, borderRadius: 19, backgroundColor: '#FFF9E9', borderWidth: 1, borderColor: '#E9E0C4' },
  progressCopy: { flex: 1 },
  progressTitle: { color: '#5B431A', fontSize: 12, fontWeight: '900' },
  progressText: { marginTop: 3, color: '#7B6E55', fontSize: 9, lineHeight: 14 },
  releaseNote: { marginTop: 17, flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 13, borderRadius: 16, backgroundColor: '#EEF5FA', borderWidth: 1, borderColor: '#DCE7F0' },
  releaseCopy: { flex: 1 },
  releaseTitle: { color: '#315E87', fontSize: 10, fontWeight: '900' },
  releaseText: { marginTop: 2, color: '#6E8294', fontSize: 8.5, lineHeight: 13 },
});
