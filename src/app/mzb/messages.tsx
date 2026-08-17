import React, {
  useMemo,
} from 'react';

import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import ConnectScreen
  from '../(tabs)/messages';


import {
  useBuklodScope,
} from '@/providers/BuklodScopeProvider';

import {
  colors,
} from '@/lib/theme';

/* PATCH_169C_MZB_CONNECT_REUSE */

export default function
MzbMessagesScreen() {
  const {
    scopes,
    loading,
  } =
    useBuklodScope();

  const mzbScope =
    useMemo(
      () =>
        (
          scopes as any[]
        ).find(
          scope =>
            scope.scope_type ===
              'ORGANIZATION' &&
            (
              String(
                scope.name ?? ''
              )
                .toLowerCase()
                .includes(
                  'mzb ministry'
                ) ||
              String(
                scope.metadata
                  ?.is_mzb ??
                  ''
              )
                .toLowerCase() ===
                'true'
            ) &&
            (
              !scope
                .membership_status ||
              scope
                .membership_status ===
                'ACTIVE'
            )
        ) ?? null,
      [scopes],
    );

  if (loading) {
    return (
      
        <View
          style={
            styles.center
          }
        >
          <ActivityIndicator
            color={
              colors.green
            }
          />
        </View>
      
    );
  }

  if (!mzbScope) {
    return (
      
        <View
          style={
            styles.center
          }
        >
          <Text
            style={
              styles.title
            }
          >
            MZB Messages
          </Text>

          <Text
            style={
              styles.text
            }
          >
            MZB Ministry messaging is available to active MZB members.
          </Text>
        </View>
      
    );
  }

  return (
    
      <ConnectScreen
        forcedScopeId={
          mzbScope.scope_id
        }
        threadBase="/mzb/connect"
      />
    
  );
}

const styles =
  StyleSheet.create({
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent:
        'center',
      padding: 28,
    },

    title: {
      fontSize: 21,
      fontWeight: '900',
      color:
        colors.greenDark,
    },

    text: {
      marginTop: 7,
      maxWidth: 290,
      textAlign: 'center',
      fontSize: 10.5,
      lineHeight: 16,
      color:
        colors.muted,
    },
  });