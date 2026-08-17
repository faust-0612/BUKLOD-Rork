import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/lib/theme';

type Church = {
  id: string;
  name: string;
};

function normalizeMobileForDisplay(value: string) {
  const digits = value.replace(/\D/g, '');

  if (digits.startsWith('63') && digits.length <= 12) {
    return `0${digits.slice(2, 12)}`;
  }

  return digits.slice(0, 11);
}

export default function GivingSetupScreen() {
  const { user } = useAuth();

  const [churches, setChurches] = useState<Church[]>([]);
  const [gcashMobile, setGcashMobile] = useState('');
  const [churchId, setChurchId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const selectedChurch = useMemo(
    () => churches.find((item) => item.id === churchId) ?? null,
    [churches, churchId]
  );

  const load = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    setLoading(true);

    try {
      const [
        churchesResult,
        profileResult,
      ] = await Promise.all([
        supabase
          .from('churches')
          .select('id,name')
          .eq('is_active', true)
          .order('name'),
        (supabase as any).rpc('get_my_giving_profile'),
      ]);

      if (churchesResult.error) {
        throw churchesResult.error;
      }

      setChurches(
        ((churchesResult.data ?? []) as Church[])
      );

      if (!profileResult.error) {
        const row = Array.isArray(profileResult.data)
          ? profileResult.data[0]
          : profileResult.data;

        if (row?.gcash_mobile) {
          setGcashMobile(row.gcash_mobile);
        }

        if (row?.default_church_id) {
          setChurchId(row.default_church_id);
        }
      }
    }
    catch (error: any) {
      Alert.alert(
        'Giving Setup',
        error?.message || 'Could not load Giving setup.'
      );
    }
    finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    const mobile = normalizeMobileForDisplay(gcashMobile);

    if (!/^09\d{9}$/.test(mobile)) {
      Alert.alert(
        'GCash Mobile',
        'Enter a valid 11-digit Philippine mobile number beginning with 09.'
      );
      return;
    }

    if (!churchId) {
      Alert.alert(
        'Local Church',
        'Select your default Local Church.'
      );
      return;
    }

    setSaving(true);

    try {
      const { error } = await (supabase as any).rpc(
        'upsert_my_giving_profile',
        {
          p_gcash_mobile: mobile,
          p_default_church_id: churchId,
        }
      );

      if (error) {
        throw error;
      }

      router.replace('/giving');
    }
    catch (error: any) {
      Alert.alert(
        'Giving Setup',
        error?.message || 'Could not save Giving setup.'
      );
    }
    finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#F6F8F6' }}
      contentContainerStyle={{
        paddingHorizontal: 18,
        paddingTop: 20,
        paddingBottom: 48,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable
        onPress={() => router.back()}
        style={{ alignSelf: 'flex-start', marginBottom: 12 }}
      >
        <Text
          style={{
            fontSize: 13,
            fontWeight: '800',
            color: colors.green,
          }}
        >
          BACK
        </Text>
      </Pressable>

      <Text
        style={{
          fontSize: 28,
          lineHeight: 34,
          fontWeight: '900',
          color: '#15231B',
        }}
      >
        BUKLOD Giving Setup
      </Text>

      <Text
        style={{
          marginTop: 7,
          fontSize: 14,
          lineHeight: 20,
          color: '#68756D',
        }}
      >
        Set this once. Your GCash mobile and default Local Church
        will be remembered for your next Giving transaction.
      </Text>

      <View
        style={{
          marginTop: 20,
          padding: 16,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: '#D8E3DC',
          backgroundColor: '#FFFFFF',
        }}
      >
        <Text
          style={{
            fontSize: 12,
            fontWeight: '900',
            color: '#34473B',
          }}
        >
          GCASH MOBILE
        </Text>

        <TextInput
          value={gcashMobile}
          onChangeText={(value) =>
            setGcashMobile(normalizeMobileForDisplay(value))
          }
          placeholder="09XXXXXXXXX"
          keyboardType="phone-pad"
          maxLength={11}
          style={{
            marginTop: 9,
            height: 50,
            borderWidth: 1,
            borderColor: '#CFDBD3',
            borderRadius: 13,
            paddingHorizontal: 14,
            fontSize: 17,
            color: '#15231B',
            backgroundColor: '#FAFCFA',
          }}
        />

        <Text
          style={{
            marginTop: 9,
            fontSize: 11,
            lineHeight: 16,
            color: '#68756D',
          }}
        >
          BUKLOD stores only the mobile number needed for your Giving
          profile. Never enter your GCash MPIN, OTP, PIN or password.
        </Text>
      </View>

      <View
        style={{
          marginTop: 14,
          padding: 16,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: '#D8E3DC',
          backgroundColor: '#FFFFFF',
        }}
      >
        <Text
          style={{
            fontSize: 12,
            fontWeight: '900',
            color: '#34473B',
          }}
        >
          DEFAULT LOCAL CHURCH
        </Text>

        {loading ? (
          <View style={{ paddingVertical: 22 }}>
            <ActivityIndicator />
          </View>
        ) : (
          <View style={{ marginTop: 10, gap: 8 }}>
            {churches.map((church) => {
              const selected = church.id === churchId;

              return (
                <Pressable
                  key={church.id}
                  onPress={() => setChurchId(church.id)}
                  style={{
                    minHeight: 47,
                    justifyContent: 'center',
                    paddingHorizontal: 13,
                    borderRadius: 13,
                    borderWidth: 1,
                    borderColor: selected
                      ? colors.green
                      : '#D8E3DC',
                    backgroundColor: selected
                      ? '#EAF5EE'
                      : '#FFFFFF',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: selected ? '900' : '700',
                      color: selected ? colors.green : '#25372C',
                    }}
                  >
                    {church.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {!!selectedChurch && (
        <Text
          style={{
            marginTop: 14,
            textAlign: 'center',
            fontSize: 12,
            color: '#68756D',
          }}
        >
          Default: {selectedChurch.name}
        </Text>
      )}

      <Pressable
        disabled={saving || loading}
        onPress={() => void save()}
        style={{
          marginTop: 18,
          minHeight: 54,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 16,
          backgroundColor: colors.green,
          opacity: saving || loading ? 0.55 : 1,
        }}
      >
        {saving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text
            style={{
              fontSize: 15,
              fontWeight: '900',
              color: '#FFFFFF',
            }}
          >
            SAVE GIVING SETUP
          </Text>
        )}
      </Pressable>
    </ScrollView>
  );
}
