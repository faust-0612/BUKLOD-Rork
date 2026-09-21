import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { colors } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { readOrganizationScopeId } from '@/lib/buklodOrganization';
import {
  loadBuklodOrganizationWorkspaceRuntime,
} from '@/lib/buklodOrganizationWorkspaceRuntime';
import { useBuklodFeedback } from '@/providers/BuklodFeedbackProvider';
import {
  buildBuklodUserFeedback,
  trackBuklodFeedbackEvent,
} from '@/lib/buklodUserFeedback';

type Bulletin = {
  id: string;
  title: string;
  body: string;
  is_pinned: boolean;
  starts_at: string;
  expires_at: string | null;
  created_at: string;
};

export default function OrganizationAnnouncementsScreen() {
  const params = useLocalSearchParams();
  const scopeId = readOrganizationScopeId(
    params as Record<string, unknown>,
  );
  const { showFeedback } = useBuklodFeedback();
  const [name, setName] = useState('Organization');
  const [isAdmin, setIsAdmin] = useState(false);
  const [rows, setRows] = useState<Bulletin[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!scopeId) {
      setLoading(false);
      return;
    }

    try {
      const [runtime, bulletins] = await Promise.all([
        loadBuklodOrganizationWorkspaceRuntime(scopeId),
        supabase
          .from('buklod_scope_bulletins')
          .select(
            'id,title,body,is_pinned,starts_at,expires_at,created_at',
          )
          .eq('scope_id', scopeId)
          .eq('is_published', true)
          .lte('starts_at', new Date().toISOString())
          .order('is_pinned', { ascending: false })
          .order('starts_at', { ascending: false })
          .limit(50),
      ]);

      if (bulletins.error) throw bulletins.error;

      setName(runtime.scope.name);
      setIsAdmin(runtime.isAdmin);
      setRows((bulletins.data ?? []) as Bulletin[]);
    } catch (error) {
      const feedback = buildBuklodUserFeedback(
        error,
        {
          fallbackTitle: 'Announcements unavailable',
          fallbackMessage:
            "BUKLOD couldn't load Organization announcements right now.",
        },
      );
      showFeedback(
        {
          ...feedback,
          title: 'Announcements unavailable',
          message:
            "BUKLOD couldn't load Organization announcements right now.",
          nextStep:
            'Try again. Other Organization modules remain available.',
          supportCode:
            feedback.supportCode ?? 'ORG-ANN-500',
          needsSupport: true,
        },
        {
          autoHideMs: null,
          helpParams: {
            category: 'ORGANIZATION',
            organizationId: scopeId,
            moduleId: 'announcements',
            sourceRoute: '/organizations/announcements',
            errorCode:
              feedback.supportCode ?? 'ORG-ANN-500',
          },
        },
      );
      void trackBuklodFeedbackEvent({
        event: 'error_shown',
        category: feedback.category,
        supportCode:
          feedback.supportCode ?? 'ORG-ANN-500',
        route: '/organizations/announcements',
        feature: 'Organization Announcements',
        outcome: 'load_failed',
        metadata: {
          organization_id: scopeId,
        },
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [scopeId, showFeedback]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!scopeId) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>
          No Organization selected
        </Text>
        <Pressable
          onPress={() => router.replace('/organizations' as any)}
          style={styles.primary}
        >
          <Text style={styles.primaryText}>
            MY ORGANIZATIONS
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
        />
      }
    >
      <Pressable
        onPress={() => router.back()}
        style={styles.back}
      >
        <MaterialCommunityIcons
          name="arrow-left"
          size={20}
          color={colors.greenDark}
        />
        <Text style={styles.backText}>
          Back to Organization
        </Text>
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.eyebrow}>
          ANNOUNCEMENTS
        </Text>
        <Text style={styles.title}>
          {name}
        </Text>
        <Text style={styles.subtitle}>
          Official notices published to this exact Organization.
        </Text>
      </View>

      {isAdmin && (
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/scope/bulletin-editor' as any,
              params: { scopeId },
            })
          }
          style={styles.publish}
        >
          <MaterialCommunityIcons
            name="bullhorn-outline"
            size={19}
            color="#FFFFFF"
          />
          <Text style={styles.publishText}>
            PUBLISH ANNOUNCEMENT
          </Text>
        </Pressable>
      )}

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.green} />
          <Text style={styles.loadingText}>
            Loading announcements…
          </Text>
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons
            name="bullhorn-outline"
            size={34}
            color={colors.muted}
          />
          <Text style={styles.emptyTitle}>
            No announcements yet.
          </Text>
          <Text style={styles.emptyText}>
            Important Organization notices will appear here.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {rows.map(row => (
            <View
              key={row.id}
              style={[
                styles.card,
                row.is_pinned && styles.cardPinned,
              ]}
            >
              <View style={styles.cardTop}>
                {row.is_pinned && (
                  <MaterialCommunityIcons
                    name="pin"
                    size={16}
                    color={colors.greenDark}
                  />
                )}
                <Text style={styles.cardTitle}>
                  {row.title}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {row.body}
              </Text>
              <Text style={styles.date}>
                {new Date(row.starts_at).toLocaleString()}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F8F6',
  },
  content: {
    width: '100%',
    maxWidth: 860,
    alignSelf: 'center',
    padding: 18,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#F5F8F6',
  },
  back: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  backText: {
    color: colors.greenDark,
    fontWeight: '900',
  },
  header: {
    marginTop: 8,
    marginBottom: 14,
  },
  eyebrow: {
    color: colors.green,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  title: {
    marginTop: 4,
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 5,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  publish: {
    alignSelf: 'flex-start',
    minHeight: 44,
    borderRadius: 11,
    backgroundColor: colors.greenDark,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  publishText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  loading: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  empty: {
    minHeight: 180,
    borderWidth: 1,
    borderColor: '#DCE5DF',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },
  emptyTitle: {
    marginTop: 8,
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  emptyText: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 12,
    textAlign: 'center',
  },
  list: {
    gap: 10,
  },
  card: {
    borderWidth: 1,
    borderColor: '#DCE5DF',
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    padding: 15,
  },
  cardPinned: {
    borderColor: '#A9CDB6',
    backgroundColor: '#F0F8F3',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  cardBody: {
    marginTop: 7,
    color: '#45564C',
    fontSize: 13,
    lineHeight: 19,
  },
  date: {
    marginTop: 9,
    color: colors.muted,
    fontSize: 10.5,
    fontWeight: '700',
  },
  primary: {
    marginTop: 14,
    minHeight: 46,
    borderRadius: 11,
    backgroundColor: colors.green,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
});
