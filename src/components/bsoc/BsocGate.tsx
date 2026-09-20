import React, { ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router } from 'expo-router';

import { Button, Card, shared } from '@/components/UI';
import { colors } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

type GateState =
  | { status: 'loading'; role: null }
  | { status: 'allowed'; role: string }
  | { status: 'denied'; role: null };

export function BsocGate({
  children,
}: {
  children: ReactNode;
}) {
  const { loading, session, hasRole } = useAuth();
  const [gate, setGate] = useState<GateState>({
    status: 'loading',
    role: null,
  });

  useEffect(() => {
    let alive = true;

    if (loading) return undefined;

    if (!session?.user?.id) {
      setGate({ status: 'denied', role: null });
      return undefined;
    }

    if (hasRole('system_admin')) {
      setGate({ status: 'allowed', role: 'ADMIN' });
      return undefined;
    }

    setGate({ status: 'loading', role: null });

    void supabase
      .rpc('buklod_bsoc_staff_role_v1' as any)
      .then(({ data, error }) => {
        if (!alive) return;

        const role =
          !error && typeof data === 'string'
            ? data.trim()
            : '';

        if (role) {
          setGate({ status: 'allowed', role });
        } else {
          setGate({ status: 'denied', role: null });
        }
      })
      .catch(() => {
        if (alive) {
          setGate({ status: 'denied', role: null });
        }
      });

    return () => {
      alive = false;
    };
  }, [hasRole, loading, session?.user?.id]);

  if (loading || gate.status === 'loading') {
    return (
      <View
        style={[
          shared.screen,
          { justifyContent: 'center' },
        ]}
      >
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  if (gate.status !== 'allowed') {
    return (
      <View style={[shared.screen, shared.content]}>
        <Text style={shared.h1}>BSOC Access</Text>

        <Card>
          <Text style={shared.body}>
            This workspace is restricted to authorized BUKLOD support and operations staff.
          </Text>
        </Card>

        <Button
          title="BACK"
          onPress={() =>
            router.canGoBack()
              ? router.back()
              : router.replace('/' as any)
          }
        />
      </View>
    );
  }

  return <>{children}</>;
}
