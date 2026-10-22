import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { verifyOrganizationManageAccess } from '@/lib/buklodOrganization';
import { colors } from '@/lib/theme';

type Props = {
  scopeId: string;
  title?: string;
  children: React.ReactNode;
};

export default function OrganizationManageGate({
  scopeId,
  title = 'Manage Organization',
  children,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const verify = useCallback(async () => {
    if (!scopeId) {
      setAllowed(false);
      setLoading(false);
      return;
    }

    try {
      const result = await verifyOrganizationManageAccess(scopeId);
      setAllowed(result.allowed);
    } catch {
      setAllowed(false);
    } finally {
      setLoading(false);
    }
  }, [scopeId]);

  useEffect(() => {
    void verify();
  }, [verify]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.green} />
        <Text style={styles.muted}>Checking admin access...</Text>
      </View>
    );
  }

  if (!allowed) {
    return (
      <View style={styles.center}>
        <Text style={styles.deniedTitle}>ADMIN ACCESS REQUIRED</Text>
        <Text style={styles.muted}>
          {title} is available only to an authorized admin of this exact
          Organization or Sub-organization. Membership or admin authority in
          another scope does not grant access.
        </Text>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 28,
    backgroundColor: '#F4F7F5',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  muted: {
    color: '#6E7E76',
    textAlign: 'center',
    lineHeight: 18,
    fontSize: 12,
  },
  deniedTitle: {
    color: '#173B2F',
    fontSize: 15,
    fontWeight: '900',
  },
});
