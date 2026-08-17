import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';

import {
  Button,
  Card,
  SectionTitle,
  shared,
} from '@/components/UI';
import { colors } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';

export default function OnboardingScreen() {
  const {
    user,
    profile,
    membershipState,
    refreshProfile,
    signOut,
  } = useAuth();

  const [request, setRequest] =
    useState<any>(null);
  const [loading, setLoading] =
    useState(true);
  const [refreshing, setRefreshing] =
    useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setRequest(null);
      setLoading(false);
      return;
    }

    const { data, error } =
      await supabase
        .from('church_join_requests')
        .select(`
          id,
          status,
          member_note,
          reviewer_note,
          created_at,
          reviewed_at,
          requested_group_id,
          proposed_group_name,
          assigned_group_id,
          church:church_id(name),
          requested_group:requested_group_id(name),
          assigned_group:assigned_group_id(name)
        `)
        .eq('user_id', user.id)
        .order('created_at', {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

    if (error) {
      console.warn(
        'Verification request load failed:',
        error.message
      );
    }

    setRequest(data ?? null);
    setLoading(false);
  }, [user?.id]);

  const syncStatus =
    useCallback(
      async (
        showSpinner = false
      ) => {
        if (showSpinner) {
          setRefreshing(true);
        }

        try {
          await refreshProfile();
          await load();
        } finally {
          if (showSpinner) {
            setRefreshing(false);
          }
        }
      },
      [
        load,
        refreshProfile,
      ]
    );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (
      !user ||
      membershipState === 'ready'
    ) {
      return;
    }

    const timer =
      setInterval(() => {
        syncStatus(false).catch(
          (error: any) => {
            console.warn(
              'Verification auto-refresh failed:',
              error?.message ??
                error
            );
          }
        );
      }, 5000);

    return () =>
      clearInterval(timer);
  }, [
    user?.id,
    membershipState,
    syncStatus,
  ]);

  if (loading) {
    return (
      <View
        style={[
          shared.screen,
          {
            justifyContent:
              'center',
          },
        ]}
      >
        <ActivityIndicator
          color={colors.green}
        />
      </View>
    );
  }

  const verified =
    membershipState === 'ready';

  const rejected =
    membershipState ===
      'rejected' ||
    request?.status ===
      'rejected';

  return (
    <ScrollView
      style={shared.screen}
      contentContainerStyle={[
        shared.content,
        { paddingTop: 40 },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() =>
            syncStatus(true)
          }
        />
      }
    >
      <View
        style={{
          alignItems: 'center',
        }}
      >
        <Image
          source={require('../../../assets/release/buklod-generic-photo.jpg')}
          style={{
            width: 92,
            height: 92,
            borderRadius: 46,
          }}
        />

        <Text
          style={[
            shared.h1,
            {
              marginTop: 10,
              textAlign: 'center',
            },
          ]}
        >
          BUKLOD Verification
        </Text>

        <Text
          style={[
            shared.muted,
            {
              textAlign: 'center',
            },
          ]}
        >
          {profile?.full_name ||
            'BUKLOD Account'}
        </Text>
      </View>

      <SectionTitle>
        ACCOUNT STATUS
      </SectionTitle>

      <Card>
        <Text
          style={[
            shared.h1,
            {
              color: verified
                ? colors.green
                : rejected
                ? colors.danger
                : colors.amber,
            },
          ]}
        >
          {verified
            ? 'ADMIN VERIFIED'
            : rejected
            ? 'NEEDS ADMIN REVIEW'
            : 'WAITING FOR ADMIN VERIFICATION'}
        </Text>

        <Text
          style={[
            shared.body,
            {
              marginTop: 8,
            },
          ]}
        >
          {verified
            ? 'Your account is verified. BUKLOD navigation is now available.'
            : rejected
            ? 'Your account can still sign in, but navigation remains locked until the System Admin approves your registration.'
            : 'Your login is active. For security, all app navigation stays locked here until the System Admin verifies and approves your account.'}
        </Text>
      </Card>

      {request && (
        <Card>
          <Text
            style={shared.h2}
          >
            Local Church:{' '}
            {request.church?.name ||
              'Pending'}
          </Text>

          {!!request
            .requested_group?.name && (
            <Text
              style={[
                shared.body,
                {
                  marginTop: 9,
                },
              ]}
            >
              Requested Group:{' '}
              {
                request
                  .requested_group
                  .name
              }
            </Text>
          )}

          {!!request
            .proposed_group_name && (
            <Text
              style={[
                shared.body,
                {
                  marginTop: 8,
                },
              ]}
            >
              Proposed Group:{' '}
              {
                request
                  .proposed_group_name
              }
            </Text>
          )}

          {!request
            .requested_group?.name &&
            !request
              .proposed_group_name &&
            !request
              .assigned_group?.name && (
              <Text
                style={[
                  shared.muted,
                  {
                    marginTop: 8,
                  },
                ]}
              >
                BUKLOD Cluster: Admin may assign later.
              </Text>
            )}

          {!!request
            .assigned_group?.name && (
            <Text
              style={[
                shared.body,
                {
                  marginTop: 8,
                  fontWeight: '900',
                },
              ]}
            >
              Assigned Group:{' '}
              {
                request
                  .assigned_group
                  .name
              }
            </Text>
          )}

          {!!request
            .reviewer_note && (
            <Text
              style={[
                shared.body,
                {
                  marginTop: 8,
                },
              ]}
            >
              Admin note:{' '}
              {
                request
                  .reviewer_note
              }
            </Text>
          )}
        </Card>
      )}

      {verified ? (
        <Button
          title="ENTER BUKLOD"
          onPress={async () => {
            await refreshProfile();
            router.replace(
              '/(tabs)/home'
            );
          }}
        />
      ) : (
        <Button
          title="CHECK VERIFICATION STATUS"
          onPress={() =>
            syncStatus(true)
          }
        />
      )}

      <Button
        title="LOG OUT"
        outline
        onPress={signOut}
      />
    </ScrollView>
  );
}
