import React, {
  useEffect,
  useState,
} from 'react';

import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import {
  supabase,
} from '@/lib/supabase';

import {
  buklodLanguageLabel,
  detectBuklodLocalLanguage,
  getDailyFaithVerse,
  getDailyMotivation,
} from '@/lib/buklodPublicDailyFaith';

import {
  useBuklodPresentation,
} from '@/hooks/useBuklodPresentation';

import {
  useAuth,
} from '@/providers/AuthProvider';

import {
  useBuklodScope,
} from '@/providers/BuklodScopeProvider';

export default function BuklodPublicDailyMessageBar({
  forceVisible = false,
}: {
  forceVisible?: boolean;
}) {
  /* PATCH_186F_ENCOURAGEMENT_THROUGH_PROFILE */
  const {
    user,
    profile,
  } = useAuth();

  const { colors } = useBuklodPresentation();
  const styles = createStyles(colors);

  const {
    activeScope,
  } = useBuklodScope();

  const [address, setAddress] =
    useState<{
      province?: string | null;
      country?: string | null;
    }>({});

  useEffect(() => {
    let alive = true;

    const load = async () => {
      if (!user?.id) {
        setAddress({});
        return;
      }

      try {
        const { data, error } = await (supabase as any)
          .from('buklod_user_addresses')
          .select('province,country')
          .eq('user_id', user.id)
          .maybeSingle();

        if (alive && !error) {
          setAddress(data ?? {});
        }
      } catch {
        // Address is optional; the local encouragement stays visible.
      }
    };

    void load();

    return () => {
      alive = false;
    };
  }, [user?.id]);

  const isPublic =
    activeScope?.scope_type ===
    'PUBLIC';

  const showFaithContent =
    Boolean(
      activeScope
        ?.show_faith_content
    );

  const language =
    detectBuklodLocalLanguage(
      address.province,
      address.country,
      (profile as any)
        ?.preferred_language,
    );

  const verse =
    getDailyFaithVerse(
      user?.id ?? 'public-user',
      language,
    );

  const motivation =
    getDailyMotivation(
      user?.id ?? 'public-user',
      language,
    );

  if (!isPublic && !forceVisible) {
    return null;
  }

  return (
    <View style={styles.shell}>
      <View style={styles.icon}>
        <MaterialCommunityIcons
          name={
            showFaithContent
              ? 'book-open-page-variant-outline'
              : 'lightbulb-on-outline'
          }
          size={19}
          color={colors.greenDark}
        />
      </View>

      <View style={styles.copy}>
        <View style={styles.metaRow}>
          <Text style={styles.label}>
            TODAY'S ENCOURAGEMENT
          </Text>

          <Text style={styles.language}>
            {buklodLanguageLabel(
              language
            )}
          </Text>
        </View>

        <Text
          style={styles.message}
          numberOfLines={2}
        >
          {showFaithContent
            ? verse.text
            : motivation}
        </Text>

        {showFaithContent ? (
          <Text style={styles.reference}>
            {verse.reference}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function createStyles(
  colors: ReturnType<typeof useBuklodPresentation>['colors']
) {
  return StyleSheet.create({
  shell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.white,
  },

  loading: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.white,
  },

  icon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.greenSoft,
  },

  copy: {
    flex: 1,
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
    gap: 8,
  },

  label: {
    flex: 1,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.75,
    color: colors.greenDark,
  },

  language: {
    fontSize: 8,
    fontWeight: '800',
    color: colors.muted,
  },

  message: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '700',
    color: colors.text,
  },

  reference: {
    marginTop: 2,
    fontSize: 9.5,
    fontWeight: '900',
    color: colors.greenDark,
  },
  });
}