import {
  useCallback,
  useMemo,
  useState,
} from 'react';

import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  useFocusEffect,
} from 'expo-router';

import Svg, {
  Rect,
} from 'react-native-svg';

import * as QRCode
  from 'qrcode';

import {
  supabase,
} from '@/lib/supabase';

type QrRow = {
  token: string;
  full_name: string | null;
  username: string | null;
};

function QrMatrix({
  value,
  size = 216,
}: {
  value: string;
  size?: number;
}) {
  const matrix =
    useMemo(
      () => {
        const created =
          QRCode.create(
            value,
            {
              errorCorrectionLevel:
                'M',
            }
          );

        return {
          count:
            created.modules.size,
          raw:
            created.modules.data,
        };
      },
      [value]
    );

  const cell =
    size /
    matrix.count;

  const blocks:
    React.ReactNode[] =
      [];

  for (
    let row = 0;
    row < matrix.count;
    row += 1
  ) {
    for (
      let col = 0;
      col < matrix.count;
      col += 1
    ) {
      const index =
        row *
          matrix.count +
        col;

      if (!matrix.raw[index]) {
        continue;
      }

      blocks.push(
        <Rect
          key={`${row}-${col}`}
          x={col * cell}
          y={row * cell}
          width={cell + 0.15}
          height={cell + 0.15}
          fill="#000000"
        />
      );
    }
  }

  return (
    <View
      style={styles.qrFrame}
    >
      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        <Rect
          x={0}
          y={0}
          width={size}
          height={size}
          fill="#FFFFFF"
        />
        {blocks}
      </Svg>
    </View>
  );
}

export function
BuklodAttendanceQrCard() {
  const [row,setRow] =
    useState<QrRow | null>(
      null
    );

  const [loading,setLoading] =
    useState(true);

  const load =
    useCallback(
      async () => {
        setLoading(true);

        const {
          data,
          error,
        } =
          await (
            supabase as any
          ).rpc(
            'get_my_buklod_attendance_qr'
          );

        if (error) {
          console.warn(
            'Attendance QR:',
            error.message
          );
          setRow(null);
          setLoading(false);
          return;
        }

        const first =
          Array.isArray(data)
            ? data[0]
            : data;

        setRow(
          first
            ? {
                token:
                  String(first.token),
                full_name:
                  first.full_name ??
                  null,
                username:
                  first.username ??
                  null,
              }
            : null
        );

        setLoading(false);
      },
      []
    );

  useFocusEffect(
    useCallback(
      () => {
        void load();
      },
      [load]
    )
  );

  const payload =
    row?.token
      ? `BUKLOD:ATTENDANCE:V1:${row.token}`
      : '';

  const rotate =
    () => {
      Alert.alert(
        'Replace Attendance QR?',
        'The old QR will stop working.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Replace QR',
            style:
              'destructive',
            onPress:
              () => {
                void (
                  async () => {
                    const {
                      error,
                    } =
                      await (
                        supabase as any
                      ).rpc(
                        'rotate_my_buklod_attendance_qr'
                      );

                    if (error) {
                      Alert.alert(
                        'Could not replace QR',
                        error.message
                      );
                      return;
                    }

                    await load();
                  }
                )();
              },
          },
        ]
      );
    };

  return (
    <View
      style={styles.card}
    >
      <Text
        style={styles.eyebrow}
      >
        BUKLOD ATTENDANCE ID
      </Text>

      <Text
        style={styles.title}
      >
        My Attendance QR
      </Text>

      <Text
        style={styles.subtitle}
      >
        Show this at any BUKLOD Attendance event. No separate attendee registration is required.
      </Text>

      {loading ? (
        <Text
          style={styles.loading}
        >
          Preparing QR...
        </Text>
      ) : payload ? (
        <>
          <QrMatrix
            value={payload}
          />

          <Text
            style={styles.name}
          >
            {row?.full_name ||
              'BUKLOD Member'}
          </Text>

          {!!row?.username && (
            <Text
              style={styles.username}
            >
              @{row.username}
            </Text>
          )}

          <Text
            style={styles.hint}
          >
            QR is already one valid attendance method. Face and device biometric are optional.
          </Text>

          <Pressable
            onPress={rotate}
            style={styles.rotate}
          >
            <Text
              style={styles.rotateText}
            >
              Replace QR
            </Text>
          </Pressable>
        </>
      ) : (
        <Text
          style={styles.loading}
        >
          Attendance QR unavailable.
        </Text>
      )}
    </View>
  );
}

const styles =
  StyleSheet.create({
    card: {
      marginTop: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor:
        '#D8E2DD',
      borderRadius: 20,
      padding: 18,
      alignItems:
        'center',
      backgroundColor:
        '#FFFFFF',
    },
    eyebrow: {
      textAlign: 'center',
      fontSize: 10,
      letterSpacing: 1.2,
      fontWeight: '900',
      color: '#658076',
    },
    title: {
      marginTop: 3,
      textAlign: 'center',
      fontSize: 21,
      fontWeight: '900',
      color: '#12382C',
    },
    subtitle: {
      marginTop: 6,
      maxWidth: 320,
      textAlign: 'center',
      lineHeight: 19,
      color: '#61746D',
    },
    loading: {
      marginVertical: 22,
      color: '#61746D',
    },
    qrFrame: {
      marginTop: 16,
      padding: 12,
      borderRadius: 18,
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#E0E5E2',
    },
    name: {
      marginTop: 12,
      fontSize: 17,
      fontWeight: '900',
      color: '#173C30',
    },
    username: {
      marginTop: 2,
      color: '#678078',
    },
    hint: {
      marginTop: 10,
      maxWidth: 320,
      textAlign: 'center',
      fontSize: 12,
      lineHeight: 17,
      color: '#6C7A75',
    },
    rotate: {
      marginTop: 10,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor:
        '#C7D4CE',
    },
    rotateText: {
      fontWeight: '800',
      color: '#315A4B',
    },
  });
