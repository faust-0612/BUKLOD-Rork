import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
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

type Door = {
  key: string;
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  route?: string;
  color: string;
  surface: string;
  status?: string;
};

type MapLayer = {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
};

const MAP_LAYERS: MapLayer[] = [
  { key: 'my', label: 'My Places', icon: 'heart-map-marker' },
  { key: 'institution', label: 'Institutions', icon: 'office-building-marker' },
  { key: 'business', label: 'Business', icon: 'store-marker' },
  { key: 'events', label: 'Events', icon: 'calendar-marker' },
  { key: 'services', label: 'Services', icon: 'hand-heart' },
  { key: 'bayanihan', label: 'Bayanihan', icon: 'account-group' },
  { key: 'people', label: 'People', icon: 'map-marker-account' },
];

const PRIMARY_DOORS: Door[] = [
  {
    key: 'faith',
    title: 'Faith / Church',
    subtitle: 'Church life, formation, Bible, ministries and community',
    icon: 'church',
    route: '/church',
    color: '#7154C9',
    surface: '#F2EEFF',
  },
  {
    key: 'school',
    title: 'School',
    subtitle: 'Classroom, faculty, attendance, learning and assessments',
    icon: 'school',
    route: '/profile/buklod-classrooms',
    color: '#2877DD',
    surface: '#EAF3FF',
  },
  {
    key: 'market',
    title: 'Palengke / Market',
    subtitle: 'Local stores, products and future orders',
    icon: 'shopping',
    route: '/profile/buklod-market',
    color: '#D9971D',
    surface: '#FFF6DE',
  },
  {
    key: 'business',
    title: 'Businesses',
    subtitle: 'Business spaces, services and customer touchpoints',
    icon: 'storefront-outline',
    route: '/profile/buklod-business',
    color: '#DE713A',
    surface: '#FFF0E8',
  },
  {
    key: 'organizations',
    title: 'Organizations',
    subtitle: 'Organizations, sub-organizations, clusters and members',
    icon: 'account-group-outline',
    route: '/organizations',
    color: '#168E8A',
    surface: '#E8F8F6',
  },
  {
    key: 'government',
    title: 'Government',
    subtitle: 'Reserved for verified barangay/LGU/public-service spaces',
    icon: 'bank-outline',
    color: '#7753B7',
    surface: '#F2EEFA',
    status: 'Future verified space',
  },
  {
    key: 'plaza',
    title: 'Community Plaza',
    subtitle: 'Bayanihan, local participation and community needs',
    icon: 'town-hall',
    route: '/bayanihan',
    color: '#319565',
    surface: '#EAF8F0',
  },
  {
    key: 'home',
    title: 'My Home',
    subtitle: 'Profile, connected spaces, personal tools and progress',
    icon: 'home-heart',
    route: '/(tabs)/me',
    color: '#177552',
    surface: '#E8F7F0',
  },
];

const EXISTING_TOOLS: Door[] = [
  {
    key: 'igpat',
    title: 'BUKLOD IGPAT',
    subtitle: 'An Instant Bond',
    icon: 'play-box-multiple-outline',
    route: '/igpat',
    color: '#C54A69',
    surface: '#FDEEF2',
  },
  {
    key: 'reports',
    title: 'BUKLOD Reports',
    subtitle: 'Existing reporting system and definitions',
    icon: 'file-chart-outline',
    route: '/reports',
    color: '#35679D',
    surface: '#EDF4FB',
  },
  {
    key: 'bible',
    title: 'Bible / Reading',
    subtitle: 'Existing Bible and Daily Reading entry',
    icon: 'book-open-page-variant-outline',
    route: '/bible',
    color: '#82642D',
    surface: '#FBF4E7',
  },
  {
    key: 'points',
    title: 'Circle Points',
    subtitle: 'Existing Points / progression entry',
    icon: 'star-circle-outline',
    route: '/points',
    color: '#A36C08',
    surface: '#FFF5D9',
  },
];

function resolveMapPreset(localityName: string) {
  const normalized = localityName.toLowerCase();

  if (
    normalized.includes('angono')
  ) {
    return {
      label: 'Angono, Rizal',
      src: 'https://www.openstreetmap.org/export/embed.html?bbox=121.132%2C14.509%2C121.176%2C14.543&layer=mapnik',
      exact: true,
    };
  }

  if (
    normalized.includes('antipolo')
  ) {
    return {
      label: 'Antipolo, Rizal',
      src: 'https://www.openstreetmap.org/export/embed.html?bbox=121.13%2C14.54%2C121.22%2C14.63&layer=mapnik',
      exact: true,
    };
  }

  const tanayTerms = [
    'tanay',
    'sta. ines',
    'sta ines',
    'nayon',
    'burol',
    'gabihan',
    'tinucan',
    'sampaloc',
    'san luis',
    'kinabuan',
  ];

  if (tanayTerms.some(term => normalized.includes(term))) {
    return {
      label: localityName || 'Tanay, Rizal',
      src: 'https://www.openstreetmap.org/export/embed.html?bbox=121.255%2C14.472%2C121.318%2C14.522&layer=mapnik',
      exact: false,
    };
  }

  return {
    label: localityName || 'Local community not linked yet',
    src: 'https://www.openstreetmap.org/export/embed.html?bbox=120.84%2C14.24%2C121.45%2C14.86&layer=mapnik',
    exact: false,
  };
}

function WebMap({ src, title }: { src: string; title: string }) {
  return React.createElement('iframe' as any, {
    src,
    title,
    loading: 'lazy',
    style: {
      border: 0,
      width: '100%',
      height: '100%',
      display: 'block',
    },
  });
}

function DoorCard({ door, compact = false }: { door: Door; compact?: boolean }) {
  const open = () => {
    if (!door.route) return;
    router.push(door.route as any);
  };

  return (
    <Pressable
      accessibilityRole={door.route ? 'button' : undefined}
      accessibilityLabel={door.title}
      disabled={!door.route}
      onPress={open}
      style={({ pressed }) => [
        styles.doorCard,
        compact && styles.toolCard,
        { backgroundColor: door.surface },
        pressed && door.route ? styles.pressed : null,
      ]}
    >
      <View style={[styles.doorIcon, { backgroundColor: door.color }]}>
        <MaterialCommunityIcons name={door.icon} size={compact ? 21 : 25} color="#FFFFFF" />
      </View>
      <View style={styles.doorCopy}>
        <Text style={styles.doorTitle}>{door.title}</Text>
        <Text style={styles.doorSubtitle}>{door.subtitle}</Text>
        {door.status ? <Text style={styles.statusText}>{door.status}</Text> : null}
      </View>
      {door.route ? (
        <MaterialCommunityIcons name="chevron-right" size={21} color="#6E8099" />
      ) : (
        <MaterialCommunityIcons name="lock-outline" size={17} color="#8B7CA3" />
      )}
    </Pressable>
  );
}

export default function BuklodCityWebHome() {
  const { width } = useWindowDimensions();
  const { theme } = useBuklodTheme();
  const { activeScope, scopes } = useBuklodScope();
  const [activeLayer, setActiveLayer] = useState('my');
  const [mapExpanded, setMapExpanded] = useState(false);

  const localScopes = useMemo(
    () => scopes.filter(scope => scope.scope_type === 'LOCAL'),
    [scopes]
  );

  const assignedLocality =
    localScopes[0]?.name ??
    (activeScope?.scope_type === 'CHURCH' ? activeScope.name : '');

  const mapPreset = useMemo(
    () => resolveMapPreset(assignedLocality),
    [assignedLocality]
  );

  const connectedScopes = useMemo(
    () => scopes.filter(scope =>
      scope.scope_type === 'ORGANIZATION' ||
      scope.scope_type === 'CLUSTER' ||
      scope.scope_type === 'CHURCH'
    ),
    [scopes]
  );

  const columns = width >= 1060 ? 4 : width >= 700 ? 2 : 1;
  const cardWidth = columns === 4 ? '24%' : columns === 2 ? '49%' : '100%';

  const activeScopeLabel = activeScope
    ? formatScopeTypeLabel(activeScope.scope_type, activeScope.geo_level, activeScope.parent_scope_id)
    : 'BUKLOD';

  const openActiveWorkspace = () => {
    if (!activeScope || activeScope.scope_type === 'PUBLIC') return;
    router.push('/scope' as any);
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.canvas }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>BUKLOD CITY · WEB PREVIEW</Text>
            <Text style={[styles.heroTitle, { color: theme.textPrimary }]}>Your real community, connected.</Text>
            <Text style={[styles.heroSubtitle, { color: theme.textSecondary }]}>BUKLOD City is now the web Home shell. Existing BUKLOD systems stay intact behind the doors below.</Text>
          </View>
          <View style={styles.previewBadge}>
            <MaterialCommunityIcons name="web-check" size={18} color="#177552" />
            <Text style={styles.previewBadgeText}>Web-only integration</Text>
          </View>
        </View>

        <View style={styles.contextRow}>
          <View style={styles.contextIcon}>
            <MaterialCommunityIcons name="layers-triple-outline" size={22} color="#1767D2" />
          </View>
          <View style={styles.contextCopy}>
            <Text style={styles.contextLabel}>CURRENT BUKLOD CONTEXT</Text>
            <Text style={styles.contextTitle}>{activeScope?.name ?? 'Public Community'}</Text>
            <Text style={styles.contextMeta}>{activeScopeLabel} · existing scope permissions remain authoritative</Text>
          </View>
          {activeScope && activeScope.scope_type !== 'PUBLIC' ? (
            <Pressable style={styles.contextButton} onPress={openActiveWorkspace}>
              <Text style={styles.contextButtonText}>Open workspace</Text>
              <MaterialCommunityIcons name="arrow-right" size={16} color="#FFFFFF" />
            </Pressable>
          ) : null}
        </View>

        <View style={[styles.mapCard, mapExpanded && styles.mapCardExpanded]}>
          <View style={styles.mapHeader}>
            <View style={styles.mapHeaderCopy}>
              <Text style={styles.eyebrow}>REAL COMMUNITY MAP</Text>
              <Text style={styles.mapTitle}>{mapPreset.label}</Text>
              <Text style={styles.mapMeta}>
                {assignedLocality
                  ? mapPreset.exact
                    ? 'Matched to the assigned/local BUKLOD location.'
                    : 'Approximate locality preview; exact institution addresses will become verified pins.'
                  : 'No assigned location coordinates are linked yet. Showing a neutral preview area only.'}
              </Text>
            </View>
            <Pressable style={styles.expandButton} onPress={() => setMapExpanded(value => !value)}>
              <MaterialCommunityIcons name={mapExpanded ? 'arrow-collapse' : 'arrow-expand'} size={18} color="#174E90" />
              <Text style={styles.expandText}>{mapExpanded ? 'Restore' : 'Expand'}</Text>
            </Pressable>
          </View>

          <View style={[styles.mapFrame, mapExpanded && styles.mapFrameExpanded]}>
            <WebMap src={mapPreset.src} title={`BUKLOD City map for ${mapPreset.label}`} />
            <View pointerEvents="none" style={styles.mapOverlayBadge}>
              <MaterialCommunityIcons name="map-marker-radius-outline" size={15} color="#FFFFFF" />
              <Text style={styles.mapOverlayText}>{activeLayer === 'people' ? 'People shown only when users opt in' : `${MAP_LAYERS.find(layer => layer.key === activeLayer)?.label ?? 'Map'} layer`}</Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.layerRow}>
            {MAP_LAYERS.map(layer => {
              const selected = activeLayer === layer.key;
              return (
                <Pressable
                  key={layer.key}
                  onPress={() => setActiveLayer(layer.key)}
                  style={[styles.layerChip, selected && styles.layerChipActive]}
                >
                  <MaterialCommunityIcons name={layer.icon} size={16} color={selected ? '#FFFFFF' : '#42617D'} />
                  <Text style={[styles.layerText, selected && styles.layerTextActive]}>{layer.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {activeLayer === 'people' ? (
            <View style={styles.privacyNote}>
              <MaterialCommunityIcons name="shield-lock-outline" size={20} color="#177552" />
              <View style={styles.privacyCopy}>
                <Text style={styles.privacyTitle}>People location is private by default.</Text>
                <Text style={styles.privacyText}>Presence will appear only after explicit sharing, with approximate location as the default plus audience and duration controls. No GPS permission is requested by this web shell.</Text>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.eyebrow}>COMMUNITY DOORS</Text>
            <Text style={styles.sectionTitle}>Everything in BUKLOD now has a place.</Text>
          </View>
          <Text style={styles.sectionHint}>Existing routes · existing guards</Text>
        </View>

        <View style={styles.grid}>
          {PRIMARY_DOORS.map(door => (
            <View key={door.key} style={{ width: cardWidth as any }}>
              <DoorCard door={door} />
            </View>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.eyebrow}>CONNECTED BUKLOD TOOLS</Text>
            <Text style={styles.sectionTitle}>Existing features stay as the engines.</Text>
          </View>
        </View>

        <View style={styles.toolGrid}>
          {EXISTING_TOOLS.map(door => (
            <View key={door.key} style={styles.toolGridItem}>
              <DoorCard door={door} compact />
            </View>
          ))}
        </View>

        <View style={styles.connectedCard}>
          <View style={styles.connectedHeader}>
            <View>
              <Text style={styles.eyebrow}>MY CONNECTED SPACES</Text>
              <Text style={styles.connectedTitle}>Communities already attached to this account</Text>
            </View>
            <Text style={styles.connectedCount}>{connectedScopes.length}</Text>
          </View>
          {connectedScopes.length ? (
            <View style={styles.connectedList}>
              {connectedScopes.slice(0, 8).map(scope => (
                <Pressable
                  key={scope.scope_id}
                  style={styles.connectedItem}
                  onPress={() => {
                    if (scope.is_active_scope) {
                      router.push('/scope' as any);
                    } else {
                      router.push('/organizations' as any);
                    }
                  }}
                >
                  <View style={styles.connectedItemIcon}>
                    <MaterialCommunityIcons
                      name={scope.scope_type === 'CLUSTER' ? 'account-multiple-outline' : scope.scope_type === 'CHURCH' ? 'church-outline' : 'office-building-outline'}
                      size={19}
                      color="#1E6E9D"
                    />
                  </View>
                  <View style={styles.connectedItemCopy}>
                    <Text style={styles.connectedItemTitle}>{scope.name}</Text>
                    <Text style={styles.connectedItemMeta}>{formatScopeTypeLabel(scope.scope_type, scope.geo_level, scope.parent_scope_id)}{scope.is_active_scope ? ' · Active' : ''}</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={18} color="#7B8A9D" />
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.emptyConnected}>
              <MaterialCommunityIcons name="map-marker-plus-outline" size={27} color="#64819C" />
              <Text style={styles.emptyConnectedText}>No connected Organization, Cluster, or Church scope is available yet. Use the institution doors to discover or join one.</Text>
            </View>
          )}
        </View>

        <View style={styles.progressCard}>
          <View style={styles.progressTextBlock}>
            <Text style={styles.eyebrow}>ONE SHARED PROGRESSION</Text>
            <Text style={styles.progressTitle}>Real participation → Circle Points → Character + House</Text>
            <Text style={styles.progressText}>The City shell does not create a second points system. It keeps existing BUKLOD progression as the shared bridge across eligible activities.</Text>
          </View>
          <View style={styles.progressFlow}>
            <View style={styles.flowNode}><MaterialCommunityIcons name="run" size={20} color="#326991" /><Text style={styles.flowNodeText}>Activities</Text></View>
            <MaterialCommunityIcons name="arrow-right" size={17} color="#8091A4" />
            <View style={[styles.flowNode, styles.flowCenter]}><MaterialCommunityIcons name="star-circle" size={21} color="#946607" /><Text style={styles.flowNodeText}>Circle Points</Text></View>
            <MaterialCommunityIcons name="arrow-right" size={17} color="#8091A4" />
            <View style={styles.flowNode}><MaterialCommunityIcons name="account-star-outline" size={20} color="#177552" /><Text style={styles.flowNodeText}>Character + Home</Text></View>
          </View>
        </View>

        <View style={styles.releaseGuard}>
          <MaterialCommunityIcons name="cellphone-lock" size={23} color="#315E87" />
          <View style={styles.releaseGuardCopy}>
            <Text style={styles.releaseGuardTitle}>Android release remains frozen.</Text>
            <Text style={styles.releaseGuardText}>This screen is supplied by a .web.tsx route override on the isolated integration branch. The existing native Community Wall file, native configuration, versionCode, APK/AAB and OTA channel are not changed by this phase.</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: 1180, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 22, paddingBottom: 42 },
  hero: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 22, marginBottom: 18 },
  heroCopy: { flex: 1 },
  eyebrow: { color: '#1C6CC1', fontSize: 11, lineHeight: 15, fontWeight: '900', letterSpacing: 1.4 },
  heroTitle: { marginTop: 5, fontSize: 38, lineHeight: 41, fontWeight: '900', letterSpacing: -1.2 },
  heroSubtitle: { marginTop: 8, maxWidth: 720, fontSize: 14, lineHeight: 21, fontWeight: '500' },
  previewBadge: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: '#C8EBDD', backgroundColor: '#EAF8F2' },
  previewBadgeText: { color: '#177552', fontSize: 11, fontWeight: '800' },
  contextRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: '#DDE9F4', backgroundColor: '#F5FAFF', marginBottom: 14 },
  contextIcon: { width: 43, height: 43, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  contextCopy: { flex: 1 },
  contextLabel: { color: '#66809A', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  contextTitle: { marginTop: 2, color: '#173A62', fontSize: 15, fontWeight: '900' },
  contextMeta: { marginTop: 2, color: '#72859A', fontSize: 10, lineHeight: 14 },
  contextButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: '#1767D2' },
  contextButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  mapCard: { padding: 12, borderRadius: 25, borderWidth: 1, borderColor: '#DCE5EF', backgroundColor: '#FFFFFF', shadowColor: '#153557', shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 9 } },
  mapCardExpanded: { padding: 14 },
  mapHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 3, paddingBottom: 10 },
  mapHeaderCopy: { flex: 1 },
  mapTitle: { marginTop: 2, color: '#173A62', fontSize: 18, fontWeight: '900' },
  mapMeta: { marginTop: 2, color: '#73849A', fontSize: 10, lineHeight: 14 },
  expandButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 11, backgroundColor: '#EDF5FF' },
  expandText: { color: '#174E90', fontSize: 10, fontWeight: '900' },
  mapFrame: { height: 390, overflow: 'hidden', borderRadius: 18, borderWidth: 1, borderColor: '#D8E2EC', backgroundColor: '#DDE8EC' },
  mapFrameExpanded: { height: 610 },
  mapOverlayBadge: { position: 'absolute', left: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '78%', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: 'rgba(16,35,74,0.88)' },
  mapOverlayText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  layerRow: { gap: 7, paddingTop: 10, paddingBottom: 2 },
  layerChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, backgroundColor: '#EFF3F6' },
  layerChipActive: { backgroundColor: '#1767D2' },
  layerText: { color: '#42617D', fontSize: 9, fontWeight: '800' },
  layerTextActive: { color: '#FFFFFF' },
  privacyNote: { marginTop: 9, flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 12, borderRadius: 14, backgroundColor: '#ECF8F2' },
  privacyCopy: { flex: 1 },
  privacyTitle: { color: '#17684C', fontSize: 11, fontWeight: '900' },
  privacyText: { marginTop: 2, color: '#617C70', fontSize: 9, lineHeight: 14 },
  sectionHeader: { marginTop: 28, marginBottom: 12, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 },
  sectionTitle: { marginTop: 3, color: '#173A62', fontSize: 23, lineHeight: 27, fontWeight: '900' },
  sectionHint: { color: '#8392A5', fontSize: 9, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  doorCard: { minHeight: 112, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderRadius: 19, borderWidth: 1, borderColor: 'rgba(35,70,105,0.08)' },
  toolCard: { minHeight: 88 },
  doorIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  doorCopy: { flex: 1 },
  doorTitle: { color: '#173A62', fontSize: 13, fontWeight: '900' },
  doorSubtitle: { marginTop: 3, color: '#708299', fontSize: 9, lineHeight: 13 },
  statusText: { marginTop: 5, color: '#786590', fontSize: 8, fontWeight: '800' },
  pressed: { opacity: 0.75, transform: [{ scale: 0.995 }] },
  toolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  toolGridItem: { width: 260, maxWidth: '100%' },
  connectedCard: { marginTop: 24, padding: 17, borderRadius: 22, borderWidth: 1, borderColor: '#E1E7EE', backgroundColor: '#FFFFFF' },
  connectedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  connectedTitle: { marginTop: 2, color: '#173A62', fontSize: 17, fontWeight: '900' },
  connectedCount: { minWidth: 34, height: 34, paddingHorizontal: 8, borderRadius: 17, textAlign: 'center', textAlignVertical: 'center', color: '#1767D2', backgroundColor: '#EDF5FF', fontSize: 12, lineHeight: 34, fontWeight: '900' },
  connectedList: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  connectedItem: { width: 300, maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 9, padding: 10, borderRadius: 14, backgroundColor: '#F5F8FB' },
  connectedItemIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E7F2F8' },
  connectedItemCopy: { flex: 1 },
  connectedItemTitle: { color: '#244869', fontSize: 11, fontWeight: '900' },
  connectedItemMeta: { marginTop: 2, color: '#77889B', fontSize: 8 },
  emptyConnected: { marginTop: 12, alignItems: 'center', gap: 7, padding: 17, borderRadius: 14, backgroundColor: '#F5F8FB' },
  emptyConnectedText: { maxWidth: 650, textAlign: 'center', color: '#73849A', fontSize: 10, lineHeight: 15 },
  progressCard: { marginTop: 22, flexDirection: 'row', alignItems: 'center', gap: 20, padding: 20, borderRadius: 23, borderWidth: 1, borderColor: '#E8DFC5', backgroundColor: '#FFF9E9' },
  progressTextBlock: { flex: 1 },
  progressTitle: { marginTop: 3, color: '#553F1C', fontSize: 18, lineHeight: 22, fontWeight: '900' },
  progressText: { marginTop: 5, color: '#7A6E57', fontSize: 10, lineHeight: 15 },
  progressFlow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flowNode: { alignItems: 'center', gap: 3, padding: 9, borderRadius: 12, backgroundColor: '#FFFFFF' },
  flowCenter: { backgroundColor: '#FFF0B9' },
  flowNodeText: { color: '#53697F', fontSize: 8, fontWeight: '800' },
  releaseGuard: { marginTop: 20, flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 17, backgroundColor: '#EFF5FA', borderWidth: 1, borderColor: '#DBE7F0' },
  releaseGuardCopy: { flex: 1 },
  releaseGuardTitle: { color: '#315E87', fontSize: 11, fontWeight: '900' },
  releaseGuardText: { marginTop: 2, color: '#6E8192', fontSize: 9, lineHeight: 14 },
});
