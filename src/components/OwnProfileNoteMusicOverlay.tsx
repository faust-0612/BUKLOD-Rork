import {
  useCallback,
  useState,
} from 'react';

import {
  Pressable,
  Text,
  View,
} from 'react-native';
import {
  BUKLOD_HIT_SLOP,
  BUKLOD_HIT_SLOP_TIGHT,
} from '@/lib/buklodTouch';

import {
  useFocusEffect,
  useRouter,
} from 'expo-router';

import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';


export function OwnProfileNoteMusicOverlay({
  size = 88,
}: {
  size?: number;
}) {
  const router =
    useRouter();

  const [
    note,
    setNote,
  ] =
    useState('');


  const refresh =
    useCallback(
      async () => {
        const {
          data: authData,
          error: authError,
        } =
          await supabase.auth.getUser();

        if (
          authError ||
          !authData.user?.id
        ) {
          setNote('');
          return;
        }

        const {
          data,
          error,
        } =
          await (
            supabase as any
          )
            .from(
              'buklod_profile_status'
            )
            .select(
              'quick_note'
            )
            .eq(
              'user_id',
              authData.user.id
            )
            .maybeSingle();

        if (error) {
          console.warn(
            'Own Profile status:',
            error.message
          );
          return;
        }

        setNote(
          String(
            data?.quick_note ??
            ''
          ).trim()
        );
      },
      []
    );


  useFocusEffect(
    useCallback(
      () => {
        void refresh();
      },
      [
        refresh,
      ]
    )
  );


  const bubbleWidth =
    166;

  const bubbleHeight =
    40;


  return (
    <View
      style={{
        position:
          'absolute',

        // Center the short bubble over the real Profile avatar.
        left:
          size / 2 -
          bubbleWidth / 2,

        top:
          -42,

        zIndex:
          80,

        width:
          bubbleWidth,

        height:
          bubbleHeight,

        paddingLeft:
          11,

        paddingRight:
          5,

        borderWidth:
          1,

        borderColor:
          colors.line,

        borderRadius:
          bubbleHeight / 2,

        backgroundColor:
          '#FFFFFF',

        flexDirection:
          'row',

        alignItems:
          'center',

        justifyContent:
          'center',

        gap:
          5,
      }}
    >
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        style={{
          flex:
            1,

          textAlign:
            'center',

          fontSize:
            10.5,

          lineHeight:
            15,

          fontWeight:
            '800',

          color:
            note
              ? colors.text
              : '#67716B',
        }}
      >
        {
          note ||
          'Add status'
        }
      </Text>

      <Pressable
        onPress={() =>
          router.push(
            '/profile/status' as any
          )
        }
        hitSlop={BUKLOD_HIT_SLOP_TIGHT}
        style={{
          height:
            24,

          minWidth:
            32,

          paddingHorizontal:
            6,

          alignItems:
            'center',

          justifyContent:
            'center',

          borderWidth:
            1,

          borderColor:
            colors.line,

          borderRadius:
            10,

          backgroundColor:
            '#F7F9F7',
        }}
      >
        <Text
          style={{
            fontSize:
              7.5,

            lineHeight:
              10,

            fontWeight:
              '900',

            color:
              colors.greenDark,
          }}
        >
          EDIT
        </Text>
      </Pressable>
    </View>
  );
}