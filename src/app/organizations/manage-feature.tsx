/* PATCH_175A_COMPLETE_ORGANIZATION_MANAGE_FEATURE */
import React from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { colors } from '@/lib/theme';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';

type Detail = {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  description: string;
  items: Array<{ label: string; route: string }>;
};

const encoded = encodeURIComponent;

function moduleRoute(scope: string, module: string, title: string, mode: string) {
  return `/organizations/admin-module?organization=${encoded(scope)}&module=${encoded(module)}&title=${encoded(title)}&mode=${encoded(mode)}`;
}

function settingsRoute(scope: string, section: string) {
  return `/organizations/settings?organization=${encoded(scope)}&section=${encoded(section)}`;
}

function adminsRoute(scope: string, action: string) {
  return `/organizations/admins?organization=${encoded(scope)}&action=${encoded(action)}`;
}

function membersRoute(scope: string, action: string) {
  return `/organizations/members?organization=${encoded(scope)}&action=${encoded(action)}`;
}

function officeRoute(scope: string) {
  return `/office/${encoded(scope)}`;
}

function bulletinRoute(scope: string) {
  return `/scope/bulletin-editor?scopeId=${encoded(scope)}`;
}

function details(scope: string): Record<string, Detail> {
  return {
    Members: {
      icon: 'account-multiple-outline',
      description: 'Invite, review, activate, suspend or remove members in this exact Organization scope.',
      items: [
        { label: 'Join Requests', route: `/organizations/join-requests?organization=${encoded(scope)}` },
        { label: 'Invite member', route: membersRoute(scope, 'invite') },
        { label: 'Pending invitations', route: membersRoute(scope, 'pending') },
        { label: 'Active members', route: membersRoute(scope, 'active') },
        { label: 'Membership status', route: membersRoute(scope, 'status') },
        { label: 'Remove or suspend member', route: membersRoute(scope, 'remove') },
      ],
    },
    'Admins & Roles': {
      icon: 'shield-account-outline',
      description: 'Manage Organization Admin access and review management activity.',
      items: [
        { label: 'Organization Admins', route: adminsRoute(scope, 'list') },
        { label: 'Add administrator', route: adminsRoute(scope, 'add') },
        { label: 'Assign role', route: adminsRoute(scope, 'add') },
        { label: 'Role permissions', route: settingsRoute(scope, 'permissions') },
        { label: 'Admin activity log', route: adminsRoute(scope, 'activity') },
      ],
    },
    'Dashboard Builder': {
      icon: 'view-dashboard-outline',
      description: 'Create, arrange and preview persisted Organization dashboard modules.',
      items: [
        { label: 'Open live Organization Home / Customizer', route: '/scope?section=home' },
        { label: 'Organization Home module records', route: moduleRoute(scope, 'dashboard', 'Organization Home Modules', 'manage') },
        { label: 'Arrange dashboard sections', route: moduleRoute(scope, 'dashboard', 'Arrange Dashboard Sections', 'arrange') },
        { label: 'Enable or hide modules', route: moduleRoute(scope, 'dashboard', 'Enable or Hide Modules', 'status') },
        { label: 'Custom buttons', route: moduleRoute(scope, 'dashboard_buttons', 'Custom Buttons', 'manage') },
        { label: 'Branding and theme', route: settingsRoute(scope, 'branding') },
      ],
    },
    Announcements: {
      icon: 'bullhorn-outline',
      description: 'Create, publish, pin and archive official announcements.',
      items: [
        { label: 'Publish announcement to member Home', route: bulletinRoute(scope) },
        { label: 'Create management announcement record', route: moduleRoute(scope, 'announcements', 'Announcements', 'create') },
        { label: 'Published announcements', route: moduleRoute(scope, 'announcements', 'Published Announcements', 'published') },
        { label: 'Pinned announcement', route: moduleRoute(scope, 'announcements', 'Pinned Announcements', 'pinned') },
        { label: 'Audience', route: moduleRoute(scope, 'announcements', 'Announcement Audience', 'audience') },
        { label: 'Archive', route: moduleRoute(scope, 'announcements', 'Announcement Archive', 'archive') },
      ],
    },
    'Events & Programs': {
      icon: 'calendar-month-outline',
      description: 'Manage Organization activities, schedules and programs.',
      items: [
        { label: 'Create event', route: moduleRoute(scope, 'events', 'Events & Programs', 'create') },
        { label: 'Program list', route: moduleRoute(scope, 'events', 'Program List', 'manage') },
        { label: 'Attendance', route: moduleRoute(scope, 'event_attendance', 'Event Attendance', 'manage') },
        { label: 'Calendar', route: moduleRoute(scope, 'events', 'Organization Calendar', 'calendar') },
        { label: 'Event reports', route: moduleRoute(scope, 'event_reports', 'Event Reports', 'manage') },
      ],
    },
    Monitoring: {
      icon: 'clipboard-pulse-outline',
      description: 'Track indicators, participation, alerts and follow-up records.',
      items: [
        { label: 'Monitoring dashboard', route: moduleRoute(scope, 'monitoring', 'Monitoring Dashboard', 'manage') },
        { label: 'Attendance indicators', route: moduleRoute(scope, 'monitoring_attendance', 'Attendance Indicators', 'manage') },
        { label: 'Participation', route: moduleRoute(scope, 'monitoring_participation', 'Participation', 'manage') },
        { label: 'Custom indicators', route: moduleRoute(scope, 'monitoring_custom', 'Custom Indicators', 'manage') },
        { label: 'Alerts and follow-up', route: moduleRoute(scope, 'monitoring_followup', 'Alerts & Follow-up', 'manage') },
      ],
    },
    'Reports & Analytics': {
      icon: 'chart-box-outline',
      description: 'View live Organization counts and maintain saved reports.',
      items: [
        { label: 'Membership report', route: moduleRoute(scope, 'reports_membership', 'Membership Report', 'report') },
        { label: 'Engagement report', route: moduleRoute(scope, 'reports_engagement', 'Engagement Report', 'report') },
        { label: 'Program report', route: moduleRoute(scope, 'reports_program', 'Program Report', 'report') },
        { label: 'Monitoring summary', route: moduleRoute(scope, 'reports_monitoring', 'Monitoring Summary', 'report') },
        { label: 'Saved / export-ready reports', route: moduleRoute(scope, 'reports', 'Saved Reports', 'report') },
      ],
    },
    'Forms & Records': {
      icon: 'file-document-multiple-outline',
      description: 'Create forms, record responses and maintain internal records.',
      items: [
        { label: 'Create form', route: moduleRoute(scope, 'forms', 'Organization Forms', 'create') },
        { label: 'Form responses', route: moduleRoute(scope, 'form_responses', 'Form Responses', 'manage') },
        { label: 'Member records', route: moduleRoute(scope, 'member_records', 'Member Records', 'manage') },
        { label: 'Program records', route: moduleRoute(scope, 'program_records', 'Program Records', 'manage') },
        { label: 'Archive', route: moduleRoute(scope, 'records_archive', 'Records Archive', 'archive') },
      ],
    },
    'Files & Resources': {
      icon: 'folder-outline',
      description: 'Maintain file/resource links, policies, templates and shared materials.',
      items: [
        { label: 'Open Organizer Office files', route: officeRoute(scope) },
        { label: 'Add file / resource link', route: moduleRoute(scope, 'resources', 'Files & Resources', 'create') },
        { label: 'Shared resources', route: moduleRoute(scope, 'resources', 'Shared Resources', 'manage') },
        { label: 'Policies', route: moduleRoute(scope, 'policies', 'Policies', 'manage') },
        { label: 'Forms and templates', route: moduleRoute(scope, 'templates', 'Forms & Templates', 'manage') },
        { label: 'Archive', route: moduleRoute(scope, 'resources_archive', 'Resource Archive', 'archive') },
      ],
    },
    'Community & Messages': {
      icon: 'message-text-outline',
      description: 'Configure Community posting and member communication for this Organization.',
      items: [
        { label: 'Open Organization Community', route: '/scope?section=community' },
        { label: 'Open Organization Connect', route: '/scope?section=connect' },
        { label: 'Community settings', route: settingsRoute(scope, 'community') },
        { label: 'Post permissions', route: settingsRoute(scope, 'permissions') },
        { label: 'Moderation', route: settingsRoute(scope, 'community') },
        { label: 'Member communication', route: settingsRoute(scope, 'permissions') },
      ],
    },
    'Organization Settings': {
      icon: 'cog-outline',
      description: 'Edit profile, branding, privacy, access and status.',
      items: [
        { label: 'Organization profile', route: settingsRoute(scope, 'profile') },
        { label: 'Logo and cover', route: settingsRoute(scope, 'branding') },
        { label: 'Mission and vision', route: settingsRoute(scope, 'profile') },
        { label: 'Privacy', route: settingsRoute(scope, 'access') },
        { label: 'Access settings', route: settingsRoute(scope, 'access') },
        { label: 'Organization status', route: settingsRoute(scope, 'status') },
      ],
    },
  };
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'custom_module';
}

export default function OrganizationManageFeatureScreen() {
  const params = useLocalSearchParams<{ organization?: string; feature?: string }>();
  const { selectScope } = useBuklodScope();
  const scopeId = typeof params.organization === 'string' ? params.organization : '';
  const feature = typeof params.feature === 'string' ? params.feature : '';
  const detail = details(scopeId)[feature];

  const openItem = async (route: string) => {
    if (route.startsWith('/scope')) {
      try {
        await selectScope(scopeId);
        router.push(route as any);
      }
      catch (error: any) {
        Alert.alert(
          'Organization Workspace',
          String(
            error?.message ??
              error ??
              'This Organization cannot be opened right now.'
          )
        );
      }
      return;
    }

    router.push(route as any);
  };

  const fallback: Detail = {
    icon: 'puzzle-outline',
    description: 'Organization-specific records for this module.',
    items: [
      {
        label: `Manage ${feature || 'module'}`,
        route: moduleRoute(scopeId, slugify(feature), feature || 'Custom Module', 'manage'),
      },
      {
        label: 'Create record',
        route: moduleRoute(scopeId, slugify(feature), feature || 'Custom Module', 'create'),
      },
      {
        label: 'Archive / history',
        route: moduleRoute(scopeId, slugify(feature), feature || 'Custom Module', 'archive'),
      },
    ],
  };

  const current = detail ?? fallback;

  if (!scopeId) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>No Organization selected</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()} style={styles.back}>
        <MaterialCommunityIcons name="arrow-left" size={20} color={colors.greenDark} />
        <Text style={styles.backText}>Manage Organizations</Text>
      </Pressable>

      <View style={styles.hero}>
        <MaterialCommunityIcons name={current.icon} size={26} color="#FFFFFF" />
        <Text style={styles.title}>{feature || 'Organization Control'}</Text>
        <Text style={styles.subtitle}>{current.description}</Text>
      </View>

      <View style={styles.card}>
        {current.items.map(item => (
          <Pressable
            key={`${item.label}-${item.route}`}
            onPress={() => void openItem(item.route)}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.72 }]}
          >
            <View style={styles.icon}>
              <MaterialCommunityIcons name={current.icon} size={19} color={colors.greenDark} />
            </View>
            <Text style={styles.rowText}>{item.label}</Text>
            <MaterialCommunityIcons name="chevron-right" size={19} color={colors.muted} />
          </Pressable>
        ))}
      </View>
</ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 12, paddingBottom: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  backText: { fontSize: 13.5, fontWeight: '800', color: colors.greenDark },
  hero: { borderRadius: 20, padding: 17, backgroundColor: colors.greenDark, marginBottom: 14 },
  title: { marginTop: 8, fontSize: 22, fontWeight: '900', color: '#FFFFFF' },
  subtitle: { marginTop: 6, fontSize: 13.5, lineHeight: 18, color: 'rgba(255,255,255,0.82)' },
  card: { borderWidth: 1, borderColor: colors.line, borderRadius: 13, paddingHorizontal: 12, backgroundColor: colors.white, overflow: 'hidden' },
  row: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 7, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 8 },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.greenSoft },
  rowText: { flex: 1, fontSize: 13.5, fontWeight: '800', color: colors.text },
  emptyTitle: { fontSize: 14.5, fontWeight: '900', color: colors.text },
});
