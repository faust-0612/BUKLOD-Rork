import React from 'react';
import { supabase } from '@/lib/supabase';
import {
  Pressable,
  StyleSheet,
  Text,
} from 'react-native';
import {
  router,
  useLocalSearchParams,
} from 'expo-router';

type Props = {
  scopeId?: string | null;
  compact?: boolean;
};

function firstString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (
    Array.isArray(value) &&
    typeof value[0] === 'string' &&
    value[0].trim()
  ) {
    return value[0].trim();
  }

  return null;
}

export function BuklodGivingSettingsButton({
  scopeId,
  compact = false,
}: Props) {
  const params = useLocalSearchParams();

  const resolvedScopeId =
    firstString(scopeId) ||
    firstString(params.scopeId) ||
    firstString(params.scope_id) ||
    firstString(params.organizationId) ||
    firstString(params.organization_id) ||
    firstString(params.id);

  const [authorized,setAuthorized]=React.useState(false);
  React.useEffect(()=>{
    let active=true;
    setAuthorized(false);
    if(resolvedScopeId){
      void supabase.rpc('giving_get_receiver_admin_scope',{p_scope_id:resolvedScopeId})
        .then(({data,error})=>{
          if(!active)return;
          const row=Array.isArray(data)?data[0]:data;
          setAuthorized(!error&&Boolean(row?.scope_id===resolvedScopeId));
        }).catch(()=>{if(active)setAuthorized(false)});
    }
    return ()=>{active=false};
  },[resolvedScopeId]);
  if (!resolvedScopeId || !authorized) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Giving and GCash Settings"
      onPress={() =>
        router.push({
          pathname: '/scope-giving-settings',
          params: {
            scopeId: resolvedScopeId,
          },
        })
      }
      style={({ pressed }) => [
        styles.button,
        compact && styles.compact,
        pressed && styles.pressed,
      ]}>
      <Text style={styles.title}>
        Fund Receiver & Treasurer Settings
      </Text>

      {!compact ? (
        <Text style={styles.subtitle}>
          Manage GCash, authorized bank and treasurers for this scope
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D8E2DC',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  compact: {
    minHeight: 42,
    paddingVertical: 7,
    marginTop: 6,
    marginBottom: 6,
  },
  pressed: {
    opacity: 0.72,
  },
  title: {
    color: '#153B2E',
    fontSize: 14,
    fontWeight: '900',
  },
  subtitle: {
    color: '#66756E',
    fontSize: 11,
    marginTop: 2,
  },
});