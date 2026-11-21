import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { AdminGate } from '@/components/AdminGate';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';

type NewUser = {
  id: string; full_name: string | null; username: string | null; mobile: string | null;
  created_at: string; is_verified: boolean | null; is_active: boolean | null;
  connection_type: string | null; login_method: string | null; church_name: string | null;
};
type Detail = Record<string, any>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const display = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return 'Hindi pa ibinigay';
  if (typeof value === 'boolean') return value ? 'Oo' : 'Hindi';
  return String(value);
};
const date = (value: unknown) => {
  if (!value) return 'Hindi pa ibinigay';
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? display(value) : parsed.toLocaleString();
};
function Field({ label, value }: { label: string; value: unknown }) {
  return <View style={s.field}>
    <Text style={s.fieldLabel}>{label}</Text>
    <Text style={s.fieldValue} selectable>{display(value)}</Text>
  </View>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={s.section}><Text style={s.sectionTitle}>{title}</Text>{children}</View>;
}

export default function AdminNewUsersScreen() {
  const { user, hasRole } = useAuth();
  const allowed = hasRole('system_admin');
  const params = useLocalSearchParams<{ user_id?: string }>();
  const directUserId = typeof params.user_id === 'string' && UUID.test(params.user_id) ? params.user_id : '';
  const [members, setMembers] = useState<NewUser[]>([]);
  const membersRef = useRef<NewUser[]>([]);
  const requestInFlight = useRef(false);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [unread, setUnread] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const selectedGeneration = useRef(0);

  const loadUnread = useCallback(async () => {
    if (!allowed || !user?.id) return;
    const { count, error: countError } = await supabase.from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('kind', 'admin_new_user').is('read_at', null);
    if (!countError) setUnread(count ?? 0);
  }, [allowed, user?.id]);

  const load = useCallback(async (older = false) => {
    if (!allowed || requestInFlight.current) return;
    requestInFlight.current = true;
    setLoading(true);
    setError('');
    try {
      const last = older ? membersRef.current[membersRef.current.length - 1] : null;
      const { data, error: fetchError } = await supabase.rpc('buklod_admin_recent_registrations_v1', {
        p_limit: 30,
        p_before_created_at: last?.created_at ?? null,
        p_before_id: last?.id ?? null,
      });
      if (fetchError) throw fetchError;
      if (!Array.isArray(data)) throw new Error('Unexpected registration response');
      const page = data as NewUser[];
      const next = older
        ? [...membersRef.current, ...page.filter(item => !membersRef.current.some(old => old.id === item.id))]
        : page;
      membersRef.current = next;
      setMembers(next);
      setHasMore(page.length === 30);
      void loadUnread();
    } catch (e) {
      setError(String((e as Error)?.message || e));
    } finally {
      requestInFlight.current = false;
      setLoading(false);
    }
  }, [allowed, loadUnread]);

  const open = useCallback(async (id: string) => {
    if (!allowed || !UUID.test(id)) return;
    const generation = ++selectedGeneration.current;
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    setError('');
    try {
      const { data, error: fetchError } = await supabase.rpc('buklod_admin_registration_detail_v1', { p_user_id: id });
      if (fetchError) throw fetchError;
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Registration details unavailable');
      if (selectedGeneration.current !== generation) return;
      setDetail(data as Detail);
      // Opening the verified detail clears only this admin's matching notice.
      // Never acknowledge other admins, member notifications or unrelated kinds.
      if (user?.id) {
        const { error: markError } = await supabase.from('notifications')
          .update({ read_at: new Date().toISOString() })
          .eq('user_id', user.id).eq('kind', 'admin_new_user')
          .contains('data', { user_id: id }).is('read_at', null);
        if (!markError) void loadUnread();
      }
    } catch (e) {
      if (selectedGeneration.current === generation) setError(String((e as Error)?.message || e));
    } finally {
      if (selectedGeneration.current === generation) setDetailLoading(false);
    }
  }, [allowed, user?.id, loadUnread]);

  useFocusEffect(useCallback(() => {
    if (allowed) { void load(false); void loadUnread(); }
  }, [allowed, load, loadUnread]));

  useEffect(() => {
    if (allowed && directUserId) void open(directUserId);
  }, [allowed, directUserId, open]);

  useEffect(() => {
    if (!allowed) return;
    const refresh = () => { void load(false); void loadUnread(); };
    const state = AppState.addEventListener('change', value => { if (value === 'active') refresh(); });
    const channel = supabase.channel('admin-new-user-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'kind=eq.admin_new_user' }, refresh)
      .subscribe();
    return () => { state.remove(); void supabase.removeChannel(channel); };
  }, [allowed, load, loadUnread]);

  const address = detail?.address ?? {};
  const request = detail?.membership_request ?? {};
  const groups = Array.isArray(detail?.groups) ? detail.groups : [];
  const scopes = Array.isArray(detail?.scopes) ? detail.scopes : [];
  const roles = Array.isArray(detail?.roles) ? detail.roles : [];

  return <AdminGate><ScrollView style={s.page} contentContainerStyle={s.content}>
    <Pressable onPress={() => router.back()} accessibilityRole="button">
      <Text style={s.link}>‹ Administration</Text>
    </Pressable>
    <Text style={s.eyebrow}>SYSTEM ADMIN ONLY</Text>
    <Text style={s.title}>Bagong Members</Text>
    <Text style={s.hint}>Lahat ng available registration details, diretso mula sa live profile. Walang personal information sa notification preview.</Text>
    <Text style={s.counter}>{unread === null ? 'Checking new registrations…' : String(unread) + ' bagong unread registration alerts'}</Text>
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {selectedId && <View style={s.detail}>
      <View style={s.headingRow}>
        <Text style={s.sectionTitle}>Registration details</Text>
        <Pressable accessibilityRole="button" onPress={() => void open(selectedId)}><Text style={s.link}>Refresh</Text></Pressable>
      </View>
      {detailLoading && <ActivityIndicator color="#24603E" />}
      {detail && <>
        <Section title="Personal information">
          <Field label="Buong pangalan" value={detail.full_name} />
          <Field label="First name" value={detail.first_name} />
          <Field label="Middle name" value={detail.middle_name} />
          <Field label="Surname" value={detail.surname} />
          <Field label="Suffix" value={detail.suffix} />
          <Field label="Username" value={detail.username} />
          <Field label="Sex" value={detail.sex} />
          <Field label="Date of birth" value={detail.birth_date} />
          <Field label="Account created" value={date(detail.created_at)} />
        </Section>
        <Section title="Contact and login">
          <Field label="Contact mobile" value={detail.mobile} />
          <Field label="Email" value={detail.email} />
          <Field label="Login method" value={detail.login_method} />
          <Field label="Login identifier" value={detail.login_identifier} />
          <Field label="Email confirmed" value={detail.email_confirmed} />
          <Field label="Phone confirmed" value={detail.phone_confirmed} />
          <Field label="Preferred language" value={detail.preferred_language} />
        </Section>
        <Section title="Address">
          <Field label="Street / address" value={address.address_line} />
          <Field label="Barangay" value={address.barangay} />
          <Field label="City / Municipality" value={address.city_municipality} />
          <Field label="Province" value={address.province} />
          <Field label="Country" value={address.country} />
          <Field label="Postal code" value={address.postal_code} />
          <Field label="Address completed" value={address.address_completed} />
        </Section>
        <Section title="Membership and access">
          <Field label="Connection type" value={detail.connection_type} />
          <Field label="Approved church" value={detail.church_name} />
          <Field label="Church request" value={request.church} />
          <Field label="Join request status" value={request.status} />
          <Field label="Requested cluster" value={request.requested_group || request.proposed_group} />
          <Field label="Registered groups" value={groups.map((g: any) => g.name).join(', ') || null} />
          <Field label="Organization / Cluster" value={scopes.map((m: any) => m.name + ' (' + m.type + ')').join(', ') || null} />
          <Field label="Roles" value={roles.join(', ') || 'member'} />
          <Field label="Member verified" value={detail.member_verified} />
          <Field label="Active account" value={detail.is_active} />
        </Section>
        <Text style={s.hint}>Ang member-verified status ay hindi katumbas ng government-ID verification para sa withdrawals.</Text>
      </>}
    </View>}
    <View style={s.headingRow}>
      <Text style={s.sectionTitle}>Latest registrations</Text>
      <Pressable accessibilityRole="button" onPress={() => void load(false)} disabled={loading}><Text style={s.link}>Refresh</Text></Pressable>
    </View>
    {members.map(item => <Pressable key={item.id} accessibilityRole="button"
      onPress={() => void open(item.id)} style={[s.member, selectedId === item.id && s.selected]}>
      <Text style={s.memberName}>{item.full_name || item.username || 'Pending profile'}</Text>
      <Text style={s.small}>{date(item.created_at)} · {item.church_name || 'No approved church'}</Text>
      <Text style={s.small}>{item.mobile || 'No mobile'} · {item.is_verified ? 'Member verified' : 'Verification pending'}</Text>
      <Text style={s.link}>Tingnan ang buong impormasyon ›</Text>
    </Pressable>)}
    {loading && <ActivityIndicator color="#24603E" />}
    {!loading && members.length === 0 && <Text style={s.hint}>Wala pang registration records.</Text>}
    {hasMore && <Pressable accessibilityRole="button" onPress={() => void load(true)} disabled={loading} style={s.loadMore}>
      <Text style={s.link}>Load older registrations</Text>
    </Pressable>}
  </ScrollView></AdminGate>;
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F7FAF8' },
  content: { padding: 14, paddingBottom: 100, gap: 10 },
  eyebrow: { color: '#507B5E', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  title: { fontSize: 25, fontWeight: '900', color: '#163D2A' },
  hint: { color: '#66776B', fontSize: 12, lineHeight: 18 },
  link: { color: '#1D6645', fontSize: 13, fontWeight: '800' },
  counter: { color: '#235E41', fontWeight: '800', fontSize: 13 },
  error: { color: '#991B1B', backgroundColor: '#FEE2E2', padding: 10, borderRadius: 8 },
  detail: { borderRadius: 14, backgroundColor: '#FFFFFF', padding: 12, gap: 9, borderWidth: 1, borderColor: '#D6E7DC' },
  section: { gap: 7, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#E6EEE8' },
  sectionTitle: { color: '#244D38', fontWeight: '900', fontSize: 16 },
  field: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 4 },
  fieldLabel: { fontSize: 12, color: '#5C6E61', flex: 1, minWidth: 110 },
  fieldValue: { fontSize: 12, color: '#182C20', fontWeight: '700', flex: 1.5, minWidth: 130 },
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  member: { borderRadius: 12, backgroundColor: '#FFFFFF', padding: 12, borderColor: '#E0E8E2', borderWidth: 1, gap: 5 },
  selected: { borderColor: '#286D47', backgroundColor: '#F1F8F2' },
  memberName: { fontWeight: '900', fontSize: 15, color: '#1D472F' },
  small: { color: '#627469', fontSize: 12 },
  loadMore: { alignItems: 'center', padding: 14 },
});
