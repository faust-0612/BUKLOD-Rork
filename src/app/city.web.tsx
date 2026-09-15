import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { BuklodCityMap } from '@/components/BuklodCityMap.web';
import {
  BuklodCityLayer,
  BuklodCityPoint,
  cityLayerForPoint,
  createBuklodCityMapItem,
  getBuklodCityPointRoute,
  getBuklodCitySnapshot,
  setBuklodCityPresence,
  setBuklodCityScopeLocation,
  stopBuklodCityPresence,
} from '@/lib/buklodCity';
import { geocodeBuklodAddress } from '@/lib/buklodGeocode';
import { formatScopeTypeLabel } from '@/lib/buklodScope';
import { useAuth } from '@/providers/AuthProvider';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';

const LAYERS: Array<{ key: BuklodCityLayer; label: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'] }> = [
  { key: 'institutions', label: 'Institutions', icon: 'office-building-marker-outline' },
  { key: 'businesses', label: 'Businesses', icon: 'store-marker-outline' },
  { key: 'events', label: 'Events', icon: 'calendar-star' },
  { key: 'services', label: 'Services', icon: 'hand-heart-outline' },
  { key: 'bayanihan', label: 'Bayanihan', icon: 'account-group-outline' },
  { key: 'people', label: 'People', icon: 'map-marker-account-outline' },
];

const GATEWAYS = [
  { key: 'faith', label: 'Faith / Church', icon: 'church-outline' as const, route: '/church', description: 'Find or enter your church and faith community.' },
  { key: 'school', label: 'School', icon: 'school-outline' as const, route: '/profile/buklod-classrooms', description: 'Classroom, Faculty, Attendance and QuickCheck.' },
  { key: 'market', label: 'Palengke', icon: 'shopping-outline' as const, route: '/profile/buklod-market', description: 'Local stores, products and community commerce.' },
  { key: 'business', label: 'Businesses', icon: 'storefront-outline' as const, route: '/profile/buklod-business', description: 'Business spaces, services and operations.' },
  { key: 'organization', label: 'Organizations', icon: 'account-group-outline' as const, route: '/organizations', description: 'Organizations, sub-organizations and clusters.' },
  { key: 'government', label: 'Government', icon: 'bank-outline' as const, route: null, description: 'Only verified barangay/LGU/public-service spaces.' },
];

const CATEGORY_TONE: Record<string, string> = {
  faith: '#7254C8', school: '#2877DD', market: '#D9971D', business: '#DB7040', organization: '#168E8A', government: '#7753B7', community: '#319565', event: '#C54A69', service: '#35679D', bayanihan: '#319565', people: '#177552',
};

function compactError(error: unknown) {
  if (error instanceof Error) return error.message;
  const candidate = error as { message?: string } | null;
  return candidate?.message || 'Something went wrong. Please try again.';
}

function pointMatchesMyPlaces(point: BuklodCityPoint) {
  return Boolean(point.isMember || point.canManage || point.isMe);
}

function CityButton({ label, icon, onPress, filled = false, disabled = false }: {
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  onPress: () => void;
  filled?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.actionButton, filled && styles.actionButtonFilled, disabled && styles.disabled, pressed && !disabled && styles.pressed]}>
      <MaterialCommunityIcons name={icon} size={18} color={filled ? '#FFFFFF' : '#245574'} />
      <Text style={[styles.actionButtonText, filled && styles.actionButtonTextFilled]}>{label}</Text>
    </Pressable>
  );
}

export default function BuklodCityWeb() {
  const { width } = useWindowDimensions();
  const { theme } = useBuklodTheme();
  const { user } = useAuth();
  const { activeScope, scopes } = useBuklodScope();

  const [snapshot, setSnapshot] = useState<{ institutions: BuklodCityPoint[]; items: BuklodCityPoint[]; people: BuklodCityPoint[] }>({ institutions: [], items: [], people: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [locality, setLocality] = useState('ALL');
  const [myPlacesOnly, setMyPlacesOnly] = useState(false);
  const [expandedMap, setExpandedMap] = useState(false);
  const [activeLayers, setActiveLayers] = useState<Set<BuklodCityLayer>>(() => new Set(LAYERS.map(layer => layer.key)));

  const [presenceOpen, setPresenceOpen] = useState(false);
  const [presencePrecision, setPresencePrecision] = useState<'APPROXIMATE' | 'EXACT'>('APPROXIMATE');
  const [presenceAudience, setPresenceAudience] = useState<'FAMILY' | 'FRIENDS' | 'MY_CHURCH' | 'MY_ORGANIZATION'>('FRIENDS');
  const [presenceDuration, setPresenceDuration] = useState(60);
  const [presenceScopeId, setPresenceScopeId] = useState<string | null>(null);
  const [presenceBusy, setPresenceBusy] = useState(false);

  const [manageOpen, setManageOpen] = useState(false);
  const [manageMode, setManageMode] = useState<'PLACE' | 'ACTIVITY'>('PLACE');
  const [manageScopeId, setManageScopeId] = useState('');
  const [manageAddress, setManageAddress] = useState('');
  const [manageCategory, setManageCategory] = useState<'faith' | 'school' | 'market' | 'business' | 'organization' | 'community'>('organization');
  const [itemType, setItemType] = useState<'EVENT' | 'SERVICE' | 'BAYANIHAN'>('EVENT');
  const [itemTitle, setItemTitle] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [manageBusy, setManageBusy] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!user?.id) return;
    quiet ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const next = await getBuklodCitySnapshot();
      setSnapshot(next);
    } catch (loadError) {
      setError(compactError(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

  const allPoints = useMemo(() => [...snapshot.institutions, ...snapshot.items, ...snapshot.people], [snapshot]);
  const localities = useMemo(() => Array.from(new Set(snapshot.institutions.map(point => String(point.locality || '').trim()).filter(Boolean))).sort(), [snapshot.institutions]);

  const visiblePoints = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allPoints.filter(point => {
      if (!activeLayers.has(cityLayerForPoint(point))) return false;
      if (myPlacesOnly && !pointMatchesMyPlaces(point)) return false;
      if (locality !== 'ALL' && point.kind === 'INSTITUTION' && point.locality !== locality) return false;
      if (!q) return true;
      return [point.title, point.subtitle, point.description, point.locality, point.category].some(value => String(value || '').toLowerCase().includes(q));
    });
  }, [activeLayers, allPoints, locality, myPlacesOnly, search]);

  const mappedMyPlace = useMemo(() => visiblePoints.find(pointMatchesMyPlaces) ?? visiblePoints[0] ?? null, [visiblePoints]);
  const managedScopes = useMemo(() => scopes.filter(scope => scope.is_admin && ['ORGANIZATION', 'CHURCH', 'CLUSTER'].includes(scope.scope_type)), [scopes]);
  const churchScopes = useMemo(() => scopes.filter(scope => scope.membership_status === 'ACTIVE' && (scope.scope_type === 'CHURCH' || scope.name.toLowerCase().includes('church') || scope.name.toLowerCase().includes('ministry'))), [scopes]);
  const organizationScopes = useMemo(() => scopes.filter(scope => scope.membership_status === 'ACTIVE' && scope.scope_type === 'ORGANIZATION'), [scopes]);

  useEffect(() => {
    if (!manageScopeId && managedScopes[0]) setManageScopeId(managedScopes[0].scope_id);
  }, [manageScopeId, managedScopes]);

  useEffect(() => {
    const candidates = presenceAudience === 'MY_CHURCH' ? churchScopes : presenceAudience === 'MY_ORGANIZATION' ? organizationScopes : [];
    if (candidates.length && !candidates.some(scope => scope.scope_id === presenceScopeId)) setPresenceScopeId(candidates[0].scope_id);
    if (!candidates.length && (presenceAudience === 'MY_CHURCH' || presenceAudience === 'MY_ORGANIZATION')) setPresenceScopeId(null);
  }, [churchScopes, organizationScopes, presenceAudience, presenceScopeId]);

  const toggleLayer = (key: BuklodCityLayer) => {
    setActiveLayers(current => {
      const next = new Set(current);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const sharePresence = async () => {
    const geolocation = (globalThis as any)?.navigator?.geolocation;
    if (!geolocation) {
      setError('Location sharing is not available in this browser.');
      return;
    }
    if ((presenceAudience === 'MY_CHURCH' || presenceAudience === 'MY_ORGANIZATION') && !presenceScopeId) {
      setError('Choose an eligible Church or Organization before sharing.');
      return;
    }
    setPresenceBusy(true);
    setError(null);
    try {
      const coords = await new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
        geolocation.getCurrentPosition(
          (position: any) => resolve({ latitude: Number(position.coords.latitude), longitude: Number(position.coords.longitude) }),
          (geoError: any) => reject(new Error(geoError?.message || 'Location permission was not granted.')),
          { enableHighAccuracy: presencePrecision === 'EXACT', timeout: 15000, maximumAge: 30000 }
        );
      });
      await setBuklodCityPresence({ ...coords, precisionMode: presencePrecision, audience: presenceAudience, scopeId: presenceScopeId, durationMinutes: presenceDuration });
      await load(true);
      setPresenceOpen(false);
    } catch (shareError) {
      setError(compactError(shareError));
    } finally {
      setPresenceBusy(false);
    }
  };

  const stopPresence = async () => {
    setPresenceBusy(true);
    try {
      await stopBuklodCityPresence();
      await load(true);
    } catch (stopError) {
      setError(compactError(stopError));
    } finally {
      setPresenceBusy(false);
    }
  };

  const saveManagedRecord = async () => {
    const selectedScope = managedScopes.find(scope => scope.scope_id === manageScopeId);
    if (!selectedScope) return setError('Choose a managed BUKLOD space first.');
    if (manageAddress.trim().length < 4) return setError('Enter a real address or recognizable place first.');
    if (manageMode === 'ACTIVITY' && itemTitle.trim().length < 2) return setError('Enter the event/service/Bayanihan title.');
    setManageBusy(true);
    setError(null);
    try {
      const coords = await geocodeBuklodAddress(manageAddress);
      if (!coords) throw new Error('BUKLOD could not locate that address. Add barangay/city/province and try again.');
      if (manageMode === 'PLACE') {
        await setBuklodCityScopeLocation({ scopeId: selectedScope.scope_id, latitude: coords.latitude, longitude: coords.longitude, safeLocationLabel: manageAddress.trim(), category: manageCategory });
      } else {
        await createBuklodCityMapItem({ scopeId: selectedScope.scope_id, itemType, title: itemTitle, description: itemDescription, addressLabel: manageAddress, latitude: coords.latitude, longitude: coords.longitude, startsAt: new Date().toISOString(), visibility: 'SCOPE' });
      }
      setManageOpen(false);
      setItemTitle('');
      setItemDescription('');
      await load(true);
    } catch (manageError) {
      setError(compactError(manageError));
    } finally {
      setManageBusy(false);
    }
  };

  const hasMyPresence = snapshot.people.some(point => point.isMe);
  const desktop = width >= 1040;
  const mobile = width < 720;

  return (
    <View style={[styles.screen, { backgroundColor: theme.canvas }]}> 
      <ScrollView contentContainerStyle={[styles.page, mobile && styles.pageMobile]} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, mobile && styles.heroMobile]}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>BUKLOD CITY · WEB HOME</Text>
            <Text style={[styles.heroTitle, mobile && styles.heroTitleMobile, { color: theme.textPrimary }]}>Your real community, connected.</Text>
            <Text style={styles.heroText}>One BUKLOD identity, real institution spaces, local activity, and your existing BUKLOD tools behind the right doors.</Text>
          </View>
          <View style={[styles.heroActions, mobile && styles.heroActionsMobile]}>
            <CityButton label="Community Wall" icon="post-outline" onPress={() => router.push('/(tabs)/buklod' as any)} />
            <CityButton label={refreshing ? 'Refreshing…' : 'Refresh City'} icon="refresh" disabled={refreshing} onPress={() => void load(true)} />
          </View>
        </View>

        <View style={[styles.contextBar, mobile && styles.contextBarMobile]}>
          <MaterialCommunityIcons name="layers-triple-outline" size={22} color="#1767D2" />
          <View style={styles.contextCopy}>
            <Text style={styles.contextLabel}>BUKLOD CONTEXT</Text>
            <Text style={styles.contextName}>{activeScope?.name ?? 'Public Community'}</Text>
            <Text style={styles.contextMeta}>{activeScope ? formatScopeTypeLabel(activeScope.scope_type, activeScope.geo_level, activeScope.parent_scope_id) : 'Public'} · existing permissions remain authoritative</Text>
          </View>
          <Pressable onPress={() => router.push('/organizations' as any)} style={styles.contextLink}><Text style={styles.contextLinkText}>My spaces</Text></Pressable>
        </View>

        {error ? <View style={styles.errorBanner}><MaterialCommunityIcons name="alert-circle-outline" size={20} color="#A23D3D" /><Text style={styles.errorText}>{error}</Text><Pressable onPress={() => setError(null)}><MaterialCommunityIcons name="close" size={18} color="#A23D3D" /></Pressable></View> : null}

        <View style={styles.gatewayGrid}>
          {GATEWAYS.map(gateway => (
            <Pressable key={gateway.key} disabled={!gateway.route} onPress={() => gateway.route && router.push(gateway.route as any)} style={({ pressed }) => [styles.gatewayCard, mobile && styles.gatewayCardMobile, pressed && styles.pressed, !gateway.route && styles.gatewayLocked]}>
              <View style={[styles.gatewayIcon, { backgroundColor: CATEGORY_TONE[gateway.key] ?? '#35679D' }]}><MaterialCommunityIcons name={gateway.icon} size={24} color="#FFFFFF" /></View>
              <View style={styles.gatewayCopy}><Text style={styles.gatewayTitle}>{gateway.label}</Text><Text style={styles.gatewayDescription}>{gateway.description}</Text></View>
              <MaterialCommunityIcons name={gateway.route ? 'chevron-right' : 'shield-lock-outline'} size={20} color="#708296" />
            </Pressable>
          ))}
        </View>

        <View style={styles.toolbarCard}>
          <View style={styles.searchRow}>
            <View style={[styles.searchBox, mobile && styles.searchBoxMobile]}><MaterialCommunityIcons name="magnify" size={20} color="#668096" /><TextInput value={search} onChangeText={setSearch} placeholder="Search BUKLOD places, services, events…" placeholderTextColor="#8292A2" style={styles.searchInput} /></View>
            <CityButton label={myPlacesOnly ? 'Showing My Places' : 'My Places'} icon="heart" filled={myPlacesOnly} onPress={() => setMyPlacesOnly(value => !value)} />
            <CityButton label={expandedMap ? 'Minimize Map' : 'Expand Map'} icon={expandedMap ? 'arrow-collapse' : 'arrow-expand'} onPress={() => setExpandedMap(value => !value)} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {LAYERS.map(layer => <Pressable key={layer.key} onPress={() => toggleLayer(layer.key)} style={[styles.layerChip, activeLayers.has(layer.key) && styles.layerChipActive]}><MaterialCommunityIcons name={layer.icon} size={16} color={activeLayers.has(layer.key) ? '#FFFFFF' : '#48667D'} /><Text style={[styles.layerChipText, activeLayers.has(layer.key) && styles.layerChipTextActive]}>{layer.label}</Text></Pressable>)}
          </ScrollView>
          {localities.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.localityRow}><Pressable onPress={() => setLocality('ALL')} style={[styles.localityChip, locality === 'ALL' && styles.localityChipActive]}><Text style={[styles.localityText, locality === 'ALL' && styles.localityTextActive]}>All localities</Text></Pressable>{localities.map(value => <Pressable key={value} onPress={() => setLocality(value)} style={[styles.localityChip, locality === value && styles.localityChipActive]}><Text style={[styles.localityText, locality === value && styles.localityTextActive]}>{value}</Text></Pressable>)}</ScrollView> : null}
        </View>

        <View style={[styles.cityWorkArea, desktop && styles.cityWorkAreaDesktop]}>
          <View style={styles.mapColumn}>
            {loading ? <View style={styles.loadingMap}><ActivityIndicator size="large" color="#177552" /><Text style={styles.loadingText}>Loading your real BUKLOD community…</Text></View> : <BuklodCityMap points={visiblePoints} center={mappedMyPlace ? { latitude: mappedMyPlace.latitude, longitude: mappedMyPlace.longitude } : null} expanded={expandedMap} />}
            <View style={[styles.mapFooter, mobile && styles.mapFooterMobile]}><Text style={styles.mapFooterText}>{visiblePoints.length} visible map item{visiblePoints.length === 1 ? '' : 's'} · only stored/authorized BUKLOD records are shown</Text><Text style={styles.osmText}>Map © OpenStreetMap contributors</Text></View>
          </View>

          {!expandedMap ? <View style={[styles.directoryColumn, mobile && styles.directoryColumnMobile]}>
            <View style={styles.sectionHeading}><View><Text style={styles.eyebrow}>CITY DIRECTORY</Text><Text style={styles.sectionTitle}>What is here now</Text></View><Text style={styles.countPill}>{visiblePoints.length}</Text></View>
            <ScrollView style={styles.directoryScroll} nestedScrollEnabled>
              {visiblePoints.slice(0, 28).map(point => {
                const route = getBuklodCityPointRoute(point);
                const tone = CATEGORY_TONE[String(point.category)] ?? '#35679D';
                return <Pressable key={`${point.kind}-${point.id}`} disabled={!route} onPress={() => route && router.push(route as any)} style={({ pressed }) => [styles.placeCard, pressed && route && styles.pressed]}>
                  <View style={[styles.placeIcon, { backgroundColor: `${tone}18` }]}><MaterialCommunityIcons name={point.kind === 'PERSON' ? 'account' : point.kind === 'EVENT' ? 'calendar-star' : point.kind === 'SERVICE' ? 'hand-heart-outline' : point.kind === 'BAYANIHAN' ? 'account-group-outline' : 'map-marker-radius-outline'} size={21} color={tone} /></View>
                  <View style={styles.placeCopy}><Text style={styles.placeTitle}>{point.title}</Text><Text numberOfLines={2} style={styles.placeMeta}>{point.subtitle || point.locality || String(point.category)}</Text><View style={styles.placeFlags}>{point.verified ? <Text style={styles.verifiedFlag}>VERIFIED</Text> : null}{point.isMember ? <Text style={styles.memberFlag}>MY PLACE</Text> : null}{point.isMe ? <Text style={styles.memberFlag}>YOU</Text> : null}</View></View>
                  {route ? <MaterialCommunityIcons name="chevron-right" size={18} color="#7A8B9C" /> : null}
                </Pressable>;
              })}
              {!visiblePoints.length && !loading ? <View style={styles.emptyBox}><MaterialCommunityIcons name="map-marker-off-outline" size={34} color="#8296A8" /><Text style={styles.emptyTitle}>No matching mapped records yet</Text><Text style={styles.emptyText}>A verified/admin-managed BUKLOD space can publish its real place. We do not generate fake pins.</Text></View> : null}
            </ScrollView>
          </View> : null}
        </View>

        <View style={styles.controlGrid}>
          <View style={[styles.controlCard, mobile && styles.controlCardMobile]}>
            <View style={styles.controlIcon}><MaterialCommunityIcons name="map-marker-account-outline" size={24} color="#177552" /></View>
            <View style={styles.controlCopy}><Text style={styles.controlTitle}>People presence · opt-in only</Text><Text style={styles.controlText}>Hidden by default. Approximate area is default; exact GPS requires your explicit choice every time. Audience and duration are enforced by the backend.</Text></View>
            <View style={[styles.controlActions, mobile && styles.controlActionsMobile]}><CityButton label="Share my location" icon="crosshairs-gps" filled onPress={() => setPresenceOpen(true)} />{hasMyPresence ? <CityButton label="Stop sharing" icon="map-marker-off-outline" disabled={presenceBusy} onPress={() => void stopPresence()} /> : null}</View>
          </View>

          <View style={[styles.controlCard, mobile && styles.controlCardMobile]}>
            <View style={styles.controlIcon}><MaterialCommunityIcons name="office-building-cog-outline" size={24} color="#2877DD" /></View>
            <View style={styles.controlCopy}><Text style={styles.controlTitle}>Manage a real BUKLOD place</Text><Text style={styles.controlText}>{managedScopes.length ? 'Admins can publish a real institution location and create scoped events, services or Bayanihan map items.' : 'Only verified BUKLOD space admins can publish institution locations and map activities.'}</Text></View>
            <View style={[styles.controlActions, mobile && styles.controlActionsMobile]}><CityButton label="Manage map presence" icon="pencil" disabled={!managedScopes.length} onPress={() => setManageOpen(true)} /></View>
          </View>
        </View>

        <View style={[styles.homeStrip, mobile && styles.homeStripMobile]}>
          <Pressable onPress={() => router.push('/(tabs)/me' as any)} style={[styles.homeStripItem, mobile && styles.homeStripItemMobile]}><MaterialCommunityIcons name="home-heart" size={28} color="#177552" /><View style={styles.homeStripCopy}><Text style={styles.homeStripTitle}>My Home</Text><Text style={styles.homeStripText}>Your personal BUKLOD center and connected spaces.</Text></View></Pressable>
          <MaterialCommunityIcons name={mobile ? 'arrow-down' : 'arrow-right'} size={22} color="#8A9BAB" />
          <Pressable onPress={() => router.push('/points' as any)} style={[styles.homeStripItem, mobile && styles.homeStripItemMobile]}><MaterialCommunityIcons name="star-circle-outline" size={28} color="#A36C08" /><View style={styles.homeStripCopy}><Text style={styles.homeStripTitle}>Circle Points</Text><Text style={styles.homeStripText}>Activities → Character progression + House development.</Text></View></Pressable>
        </View>

        <View style={styles.supportGrid}>
          {[['BUKLOD IGPAT','play-box-multiple-outline','/igpat'],['Reports','file-chart-outline','/reports'],['Bible / Formation','book-open-page-variant-outline','/bible'],['Bayanihan','account-group-outline','/bayanihan'],['Organizations','office-building-outline','/organizations'],['My Classroom','school-outline','/profile/buklod-classrooms']].map(([label, icon, route]) => <Pressable key={label} onPress={() => router.push(route as any)} style={({ pressed }) => [styles.supportCard, mobile && styles.supportCardMobile, pressed && styles.pressed]}><MaterialCommunityIcons name={icon as any} size={22} color="#35679D" /><Text style={styles.supportTitle}>{label}</Text><MaterialCommunityIcons name="arrow-top-right" size={17} color="#7890A4" /></Pressable>)}
        </View>
      </ScrollView>

      {presenceOpen ? <View style={[styles.modalBackdrop, mobile && styles.modalBackdropMobile]}><View style={[styles.modalCard, mobile && styles.modalCardMobile]}>
        <View style={styles.modalHeader}><View><Text style={styles.eyebrow}>PRIVACY CONTROL</Text><Text style={styles.modalTitle}>Share my presence</Text></View><Pressable onPress={() => setPresenceOpen(false)}><MaterialCommunityIcons name="close" size={24} color="#536A7D" /></Pressable></View>
        <Text style={styles.modalLabel}>Precision</Text><View style={styles.optionRow}>{(['APPROXIMATE','EXACT'] as const).map(value => <Pressable key={value} onPress={() => setPresencePrecision(value)} style={[styles.optionChip, presencePrecision === value && styles.optionChipActive]}><Text style={[styles.optionText, presencePrecision === value && styles.optionTextActive]}>{value === 'APPROXIMATE' ? 'Approximate area (recommended)' : 'Exact GPS'}</Text></Pressable>)}</View>
        {presencePrecision === 'EXACT' ? <View style={styles.warningBox}><MaterialCommunityIcons name="shield-alert-outline" size={19} color="#9A6316" /><Text style={styles.warningText}>Exact GPS will be shown only to the audience you choose below and only for the selected duration.</Text></View> : null}
        <Text style={styles.modalLabel}>Audience</Text><View style={styles.optionWrap}>{(['FAMILY','FRIENDS','MY_CHURCH','MY_ORGANIZATION'] as const).map(value => <Pressable key={value} onPress={() => setPresenceAudience(value)} style={[styles.optionChip, presenceAudience === value && styles.optionChipActive]}><Text style={[styles.optionText, presenceAudience === value && styles.optionTextActive]}>{value.replaceAll('_',' ')}</Text></Pressable>)}</View>
        {(presenceAudience === 'MY_CHURCH' || presenceAudience === 'MY_ORGANIZATION') ? <View><Text style={styles.modalLabel}>BUKLOD space</Text><View style={styles.optionWrap}>{(presenceAudience === 'MY_CHURCH' ? churchScopes : organizationScopes).map(scope => <Pressable key={scope.scope_id} onPress={() => setPresenceScopeId(scope.scope_id)} style={[styles.optionChip, presenceScopeId === scope.scope_id && styles.optionChipActive]}><Text style={[styles.optionText, presenceScopeId === scope.scope_id && styles.optionTextActive]}>{scope.name}</Text></Pressable>)}</View></View> : null}
        <Text style={styles.modalLabel}>Duration</Text><View style={styles.optionRow}>{[[15,'15 min'],[60,'1 hour'],[240,'4 hours'],[0,'Until I turn it off']].map(([minutes,label]) => <Pressable key={String(minutes)} onPress={() => setPresenceDuration(Number(minutes))} style={[styles.optionChip, presenceDuration === Number(minutes) && styles.optionChipActive]}><Text style={[styles.optionText, presenceDuration === Number(minutes) && styles.optionTextActive]}>{label}</Text></Pressable>)}</View>
        <CityButton label={presenceBusy ? 'Requesting location…' : 'Allow browser location & share'} icon="crosshairs-gps" filled disabled={presenceBusy} onPress={() => void sharePresence()} />
      </View></View> : null}

      {manageOpen ? <View style={[styles.modalBackdrop, mobile && styles.modalBackdropMobile]}><View style={[styles.modalCard, mobile && styles.modalCardMobile]}>
        <View style={styles.modalHeader}><View><Text style={styles.eyebrow}>AUTHORIZED MANAGEMENT</Text><Text style={styles.modalTitle}>BUKLOD City map manager</Text></View><Pressable onPress={() => setManageOpen(false)}><MaterialCommunityIcons name="close" size={24} color="#536A7D" /></Pressable></View>
        <View style={styles.optionRow}>{(['PLACE','ACTIVITY'] as const).map(value => <Pressable key={value} onPress={() => setManageMode(value)} style={[styles.optionChip, manageMode === value && styles.optionChipActive]}><Text style={[styles.optionText, manageMode === value && styles.optionTextActive]}>{value === 'PLACE' ? 'Institution place' : 'Event / service / Bayanihan'}</Text></Pressable>)}</View>
        <Text style={styles.modalLabel}>Managed space</Text><View style={styles.optionWrap}>{managedScopes.map(scope => <Pressable key={scope.scope_id} onPress={() => setManageScopeId(scope.scope_id)} style={[styles.optionChip, manageScopeId === scope.scope_id && styles.optionChipActive]}><Text style={[styles.optionText, manageScopeId === scope.scope_id && styles.optionTextActive]}>{scope.name}</Text></Pressable>)}</View>
        {manageMode === 'PLACE' ? <><Text style={styles.modalLabel}>Institution type</Text><View style={styles.optionWrap}>{(['faith','school','market','business','organization','community'] as const).map(value => <Pressable key={value} onPress={() => setManageCategory(value)} style={[styles.optionChip, manageCategory === value && styles.optionChipActive]}><Text style={[styles.optionText, manageCategory === value && styles.optionTextActive]}>{value}</Text></Pressable>)}</View></> : <><Text style={styles.modalLabel}>Activity type</Text><View style={styles.optionRow}>{(['EVENT','SERVICE','BAYANIHAN'] as const).map(value => <Pressable key={value} onPress={() => setItemType(value)} style={[styles.optionChip, itemType === value && styles.optionChipActive]}><Text style={[styles.optionText, itemType === value && styles.optionTextActive]}>{value}</Text></Pressable>)}</View><TextInput value={itemTitle} onChangeText={setItemTitle} placeholder="Activity title" placeholderTextColor="#8292A2" style={styles.modalInput} /><TextInput value={itemDescription} onChangeText={setItemDescription} placeholder="Short details (optional)" placeholderTextColor="#8292A2" multiline style={[styles.modalInput, styles.modalTextarea]} /></>}
        <Text style={styles.modalLabel}>Real address / recognizable place</Text><TextInput value={manageAddress} onChangeText={setManageAddress} placeholder="e.g. Church name, street, barangay, city, province" placeholderTextColor="#8292A2" style={styles.modalInput} />
        <Text style={styles.helperText}>BUKLOD geocodes this address. Government categorization remains restricted to system verification.</Text>
        <CityButton label={manageBusy ? 'Locating & saving…' : manageMode === 'PLACE' ? 'Publish real place' : 'Publish map activity'} icon="map-marker-check-outline" filled disabled={manageBusy} onPress={() => void saveManagedRecord()} />
      </View></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, page: { width: '100%', maxWidth: 1480, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 18, paddingBottom: 80 }, pageMobile: { paddingHorizontal: 10, paddingTop: 10, paddingBottom: 72 },
  hero: { flexDirection: 'row', gap: 20, alignItems: 'center', justifyContent: 'space-between', padding: 22, borderRadius: 26, backgroundColor: '#F4FBF8', borderWidth: 1, borderColor: '#DCEEE7', marginBottom: 14 }, heroMobile: { flexDirection: 'column', alignItems: 'stretch', gap: 14, padding: 16, borderRadius: 20 }, heroCopy: { flex: 1, minWidth: 0 }, eyebrow: { fontSize: 10, lineHeight: 14, fontWeight: '900', letterSpacing: 1.3, color: '#1C6CC1' }, heroTitle: { fontSize: 34, lineHeight: 39, fontWeight: '900', letterSpacing: -1 }, heroTitleMobile: { fontSize: 27, lineHeight: 32, letterSpacing: -0.6 }, heroText: { marginTop: 7, maxWidth: 760, fontSize: 14, lineHeight: 20, color: '#5D7284' }, heroActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }, heroActionsMobile: { justifyContent: 'flex-start', width: '100%' },
  actionButton: { minHeight: 40, maxWidth: '100%', paddingHorizontal: 12, borderRadius: 13, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F7FA', borderWidth: 1, borderColor: '#D9E4EC' }, actionButtonFilled: { backgroundColor: '#177552', borderColor: '#177552' }, actionButtonText: { flexShrink: 1, color: '#245574', fontSize: 11, fontWeight: '900' }, actionButtonTextFilled: { color: '#FFFFFF' }, disabled: { opacity: 0.45 }, pressed: { opacity: 0.72 },
  contextBar: { flexDirection: 'row', gap: 11, alignItems: 'center', padding: 13, borderRadius: 18, backgroundColor: '#F5FAFF', borderWidth: 1, borderColor: '#DDE9F2', marginBottom: 14 }, contextBarMobile: { alignItems: 'flex-start', flexWrap: 'wrap' }, contextCopy: { flex: 1, minWidth: 0 }, contextLabel: { color: '#1767D2', fontSize: 9, fontWeight: '900', letterSpacing: 1 }, contextName: { fontSize: 14, fontWeight: '900', color: '#20384B' }, contextMeta: { fontSize: 10, color: '#6E8191', marginTop: 2 }, contextLink: { padding: 10 }, contextLinkText: { color: '#1767D2', fontSize: 11, fontWeight: '900' },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14, backgroundColor: '#FFF1F1', borderWidth: 1, borderColor: '#F2CDCD', marginBottom: 14 }, errorText: { flex: 1, minWidth: 0, fontSize: 12, color: '#8D3434', lineHeight: 17 },
  gatewayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 }, gatewayCard: { flexGrow: 1, flexBasis: 210, minWidth: 190, maxWidth: 360, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1E9EF' }, gatewayCardMobile: { flexBasis: '100%', minWidth: 0, maxWidth: '100%', width: '100%' }, gatewayLocked: { opacity: 0.72 }, gatewayIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, gatewayCopy: { flex: 1, minWidth: 0 }, gatewayTitle: { color: '#213A4D', fontWeight: '900', fontSize: 13 }, gatewayDescription: { marginTop: 3, color: '#718493', fontSize: 10, lineHeight: 14 },
  toolbarCard: { padding: 12, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1E9EF', marginBottom: 12 }, searchRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }, searchBox: { flex: 1, minWidth: 260, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 42, paddingHorizontal: 12, borderRadius: 14, backgroundColor: '#F5F8FA', borderWidth: 1, borderColor: '#E2E9EE' }, searchBoxMobile: { flexBasis: '100%', minWidth: 0, width: '100%' }, searchInput: { flex: 1, minWidth: 0, minHeight: 40, color: '#20384B', fontSize: 12, outlineStyle: 'none' } as any, chipRow: { gap: 7, paddingTop: 10 }, layerChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, backgroundColor: '#EFF4F7' }, layerChipActive: { backgroundColor: '#315E87' }, layerChipText: { fontSize: 10, fontWeight: '800', color: '#48667D' }, layerChipTextActive: { color: '#FFFFFF' }, localityRow: { gap: 6, paddingTop: 9 }, localityChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#DDE6ED' }, localityChipActive: { backgroundColor: '#E8F7F0', borderColor: '#A9D9C4' }, localityText: { color: '#61778A', fontSize: 10, fontWeight: '800' }, localityTextActive: { color: '#177552' },
  cityWorkArea: { gap: 12, marginBottom: 14 }, cityWorkAreaDesktop: { flexDirection: 'row', alignItems: 'stretch' }, mapColumn: { flex: 1.75, minWidth: 0 }, directoryColumn: { flex: 0.85, minWidth: 320, maxHeight: 510, padding: 12, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1E9EF' }, directoryColumnMobile: { flex: 0, minWidth: 0, width: '100%', maxHeight: 460 }, directoryScroll: { flex: 1 }, sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }, sectionTitle: { fontSize: 18, fontWeight: '900', color: '#20384B' }, countPill: { minWidth: 30, paddingHorizontal: 8, paddingVertical: 5, textAlign: 'center', borderRadius: 999, color: '#1767D2', backgroundColor: '#EAF3FF', fontSize: 10, fontWeight: '900' }, loadingMap: { height: 440, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF2F4' }, loadingText: { marginTop: 10, color: '#657C8E', fontSize: 12 }, mapFooter: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingHorizontal: 4, paddingTop: 7 }, mapFooterMobile: { flexDirection: 'column', gap: 3 }, mapFooterText: { flex: 1, minWidth: 0, fontSize: 9, color: '#748695' }, osmText: { fontSize: 9, color: '#748695' },
  placeCard: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E7EDF1' }, placeIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, placeCopy: { flex: 1, minWidth: 0 }, placeTitle: { fontSize: 12, fontWeight: '900', color: '#253D50' }, placeMeta: { marginTop: 2, color: '#748695', fontSize: 9, lineHeight: 13 }, placeFlags: { flexDirection: 'row', gap: 5, marginTop: 4, flexWrap: 'wrap' }, verifiedFlag: { color: '#177552', backgroundColor: '#E8F7F0', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2, fontSize: 7, fontWeight: '900' }, memberFlag: { color: '#1767D2', backgroundColor: '#EAF3FF', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2, fontSize: 7, fontWeight: '900' }, emptyBox: { padding: 28, alignItems: 'center' }, emptyTitle: { marginTop: 8, fontSize: 13, fontWeight: '900', color: '#354D60' }, emptyText: { marginTop: 5, textAlign: 'center', fontSize: 10, lineHeight: 15, color: '#7A8C9B' },
  controlGrid: { gap: 10, marginBottom: 14 }, controlCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1E9EF' }, controlCardMobile: { flexDirection: 'column', alignItems: 'stretch', padding: 14, gap: 10 }, controlIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF7F3' }, controlCopy: { flex: 1, minWidth: 0 }, controlTitle: { fontSize: 13, fontWeight: '900', color: '#233C4E' }, controlText: { marginTop: 3, fontSize: 10, lineHeight: 15, color: '#708394' }, controlActions: { flexDirection: 'row', gap: 7, flexWrap: 'wrap', justifyContent: 'flex-end' }, controlActionsMobile: { width: '100%', justifyContent: 'flex-start', alignItems: 'stretch' },
  homeStrip: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 22, backgroundColor: '#F8FBFA', borderWidth: 1, borderColor: '#DFEAE5', marginBottom: 14 }, homeStripMobile: { flexDirection: 'column', alignItems: 'stretch', gap: 6, padding: 12 }, homeStripItem: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8 }, homeStripItemMobile: { flexGrow: 0, flexShrink: 0, width: '100%' }, homeStripCopy: { flex: 1, minWidth: 0 }, homeStripTitle: { fontSize: 13, fontWeight: '900', color: '#294154' }, homeStripText: { fontSize: 9, lineHeight: 13, color: '#718494', marginTop: 2 }, supportGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, supportCard: { flexGrow: 1, flexBasis: 190, minWidth: 170, flexDirection: 'row', alignItems: 'center', gap: 9, padding: 13, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1E9EF' }, supportCardMobile: { flexBasis: '100%', minWidth: 0, maxWidth: '100%', width: '100%' }, supportTitle: { flex: 1, minWidth: 0, color: '#30495C', fontSize: 11, fontWeight: '900' },
  modalBackdrop: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,30,42,.42)', alignItems: 'center', justifyContent: 'center', padding: 20 }, modalBackdropMobile: { padding: 10 }, modalCard: { width: '100%', maxWidth: 680, maxHeight: '92%', padding: 20, borderRadius: 24, backgroundColor: '#FFFFFF', boxShadow: '0 20px 70px rgba(10,30,50,.25)' } as any, modalCardMobile: { maxHeight: '96%', padding: 14, borderRadius: 18 }, modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 14 }, modalTitle: { flexShrink: 1, fontSize: 21, lineHeight: 26, fontWeight: '900', color: '#20384B' }, modalLabel: { marginTop: 12, marginBottom: 6, fontSize: 10, fontWeight: '900', letterSpacing: .5, color: '#526B7E' }, optionRow: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' }, optionWrap: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' }, optionChip: { maxWidth: '100%', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, backgroundColor: '#F0F4F7', borderWidth: 1, borderColor: '#DCE6EC' }, optionChipActive: { backgroundColor: '#315E87', borderColor: '#315E87' }, optionText: { flexShrink: 1, fontSize: 9, fontWeight: '900', color: '#506A7E' }, optionTextActive: { color: '#FFFFFF' }, warningBox: { marginTop: 9, flexDirection: 'row', gap: 7, padding: 10, borderRadius: 12, backgroundColor: '#FFF7E8' }, warningText: { flex: 1, minWidth: 0, color: '#86591B', fontSize: 9, lineHeight: 14 }, modalInput: { minHeight: 42, paddingHorizontal: 12, marginTop: 8, borderRadius: 12, backgroundColor: '#F6F8FA', borderWidth: 1, borderColor: '#DCE5EB', color: '#20384B', fontSize: 11, outlineStyle: 'none' } as any, modalTextarea: { minHeight: 78, paddingTop: 11, textAlignVertical: 'top' }, helperText: { fontSize: 9, color: '#7A8B99', lineHeight: 14, marginTop: 6, marginBottom: 13 },
});