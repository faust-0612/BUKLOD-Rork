import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { router } from 'expo-router';

import BuklodNearbyChurchFinder from '@/components/BuklodNearbyChurchFinder';
import {
  ChurchSummary,
  myChurches,
  respondChurchInvite,
} from '@/lib/buklodChurches';

function msg(e: unknown) {
  if (e && typeof e === 'object' && 'message' in e) {
    return String((e as any).message);
  }
  return String(e || 'Unknown error');
}

function openChurch(id: string) {
  router.push({
    pathname: '/churches/[id]' as any,
    params: { id },
  } as any);
}

function Button({
  title,
  onPress,
  outline,
  disabled,
}: {
  title: string;
  onPress: () => void;
  outline?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        s.button,
        outline && s.buttonOutline,
        disabled && s.disabled,
      ]}
    >
      <Text
        style={[
          s.buttonText,
          outline && s.buttonTextOutline,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

function Card({
  item,
  children,
}: {
  item: ChurchSummary;
  children?: React.ReactNode;
}) {
  const location = [
    item.barangay,
    item.city_municipality,
    item.province,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <View style={s.card}>
      <Text style={s.name}>{item.name}</Text>

      <Text style={s.meta}>
        {item.denomination || 'Christian Church'}
        {!!location && `  |  ${location}`}
      </Text>

      {!!item.description && (
        <Text style={s.description}>
          {item.description}
        </Text>
      )}

      <Text style={s.meta}>
        {Number(item.member_count || 0).toLocaleString()}
        {' members'}
        {!!item.scope_status &&
          `  |  ${item.scope_status}`}
        {!!item.membership_status &&
          `  |  ${item.membership_status}`}
      </Text>

      {children}
    </View>
  );
}

export default function ChurchesScreen() {
  const [mine, setMine] =
    useState<ChurchSummary[]>([]);

  const [loadingMine, setLoadingMine] = useState(true);
  const [busy, setBusy] =
    useState<string | null>(null);

  const loadMine = useCallback(async () => {
    try {
      setMine(await myChurches());
    } catch (e) {
      Alert.alert('Churches', msg(e));
    } finally {
      setLoadingMine(false);
    }
  }, []);

  useEffect(() => {
    void loadMine();
  }, [loadMine]);

  async function respond(
    item: ChurchSummary,
    accept: boolean,
  ) {
    setBusy(item.scope_id);

    try {
      await respondChurchInvite(item.scope_id, accept);
      await loadMine();
    } catch (e) {
      Alert.alert('Church invitation', msg(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <BuklodNearbyChurchFinder
      onMembershipChange={() => void loadMine()}
      header={
        <>
          <View style={s.hero}>
            <Text style={s.eyebrow}>BUKLOD</Text>
            <Text style={s.title}>Find a Church</Text>

            <Text style={s.subtitle}>
              Nearby Churches uses your location only to find churches around
              you. Search by name, pastor, mentor, or public place name. Home
              addresses are never shown.
            </Text>

            <Button
              title="REGISTER A CHURCH"
              onPress={() =>
                router.push('/churches/create' as any)
              }
            />
          </View>

          <Text style={s.section}>MY CHURCHES</Text>

          {loadingMine ? (
            <View style={s.loading}>
              <ActivityIndicator size="large" />
            </View>
          ) : mine.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.muted}>
                You do not have a Church membership yet.
              </Text>
            </View>
          ) : (
            mine.map((item) => (
              <Card key={item.scope_id} item={item}>
                <View style={s.actions}>
                  {item.membership_status === 'INVITED' ? (
                    <>
                      <Button
                        title="ACCEPT"
                        disabled={busy === item.scope_id}
                        onPress={() => void respond(item, true)}
                      />
                      <Button
                        title="DECLINE"
                        outline
                        disabled={busy === item.scope_id}
                        onPress={() => void respond(item, false)}
                      />
                    </>
                  ) : (
                    <Button
                      title={
                        item.is_admin ? 'OPEN / MANAGE' : 'OPEN'
                      }
                      onPress={() => openChurch(item.scope_id)}
                    />
                  )}
                </View>
              </Card>
            ))
          )}
        </>
      }
    />
  );
}

const s = StyleSheet.create({
  hero: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E7E3',
    gap: 8,
  },
  eyebrow: {
    color: '#2D6A4F',
    fontWeight: '900',
    letterSpacing: 2,
  },
  title: {
    color: '#19362A',
    fontWeight: '900',
    fontSize: 30,
  },
  subtitle: {
    color: '#66756D',
    lineHeight: 20,
  },
  section: {
    marginTop: 15,
    color: '#365347',
    fontWeight: '900',
    letterSpacing: 1,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E7E3',
    borderRadius: 16,
    padding: 15,
    gap: 6,
  },
  name: {
    fontWeight: '900',
    fontSize: 18,
    color: '#1A3329',
  },
  meta: {
    color: '#748079',
    fontSize: 12,
  },
  description: {
    color: '#47574F',
    lineHeight: 19,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 5,
  },
  button: {
    minHeight: 40,
    paddingHorizontal: 13,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 11,
    backgroundColor: '#2D6A4F',
  },
  buttonOutline: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2D6A4F',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 11,
  },
  buttonTextOutline: {
    color: '#2D6A4F',
  },
  disabled: {
    opacity: 0.45,
  },
  empty: {
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E1E7E3',
  },
  muted: {
    color: '#748079',
  },
  loading: {
    padding: 24,
  },
});
