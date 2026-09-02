import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from 'expo-router';
import { useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BuklodLearningContent } from '@/app/(tabs)/learn';
import BuklodScopeLessonLicensesCard from '@/components/BuklodScopeLessonLicensesCard';
import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';
import { colors } from '@/lib/theme';

function readScopeId(
  value: string | string[] | undefined,
) {
  const raw = Array.isArray(value) ? value[0] : value;
  return String(raw ?? '').trim();
}

export default function ScopeBuklodLessonPortalScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    scopeId?: string | string[];
  }>();
  const routeScopeId = readScopeId(params.scopeId);
  const { activeScope } = useBuklodScope();

  const scopeId = routeScopeId || activeScope?.scope_id || '';
  const scopeName =
    activeScope?.scope_id === scopeId
      ? activeScope.name
      : 'this scope';

  useFocusEffect(
    useCallback(() => {
      // Portal content refreshes on focus via child components.
    }, []),
  );

  return (
    <>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 8 },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={22}
            color={colors.greenDark}
          />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerEyebrow}>BUKLOD LESSON</Text>
          <Text style={styles.headerTitle}>Learning Portal</Text>
          <Text style={styles.headerSubtitle}>
            BUKLOD 101–107 · {scopeName}
          </Text>
        </View>
      </View>

      <BuklodPortalScrollView contentContainerStyle={styles.content}>
        <BuklodScopeLessonLicensesCard
          scopeId={scopeId}
          scopeName={scopeName}
          defaultExpanded
        />

        <BuklodLearningContent variant="embedded" />
      </BuklodPortalScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8EFEA',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F4F7F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerEyebrow: {
    color: colors.greenDark,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  headerTitle: {
    color: '#173B2F',
    fontSize: 18,
    fontWeight: '900',
  },
  headerSubtitle: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 28,
  },
});
