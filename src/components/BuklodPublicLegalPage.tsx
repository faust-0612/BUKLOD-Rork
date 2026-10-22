import { useEffect, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  documentTitle: string;
  screenTitle: string;
  kicker: string;
  title: string;
  meta: string;
  children: ReactNode;
};

export function BuklodPublicLegalPage({
  documentTitle,
  screenTitle,
  kicker,
  title,
  meta,
  children,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const compact = width < 720;
  const contentWidth = Math.min(width, 760);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }
    document.title = documentTitle;
  }, [documentTitle]);

  return (
    <View
      style={[
        publicLegalStyles.screen,
        {
          paddingTop: Math.max(insets.top, 12),
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <Stack.Screen
        options={{
          title: screenTitle,
          headerShown: false,
        }}
      />

      <ScrollView
        contentContainerStyle={[
          publicLegalStyles.scroll,
          {
            paddingHorizontal: compact ? 20 : 32,
            width: '100%',
            maxWidth: contentWidth,
            alignSelf: 'center',
          },
        ]}
        showsVerticalScrollIndicator
      >
        <Text accessibilityRole="header" style={publicLegalStyles.kicker}>
          {kicker}
        </Text>
        <Text accessibilityRole="header" style={publicLegalStyles.title}>
          {title}
        </Text>
        <Text style={publicLegalStyles.meta}>{meta}</Text>

        {children}

        <Pressable
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            }
          }}
          style={publicLegalStyles.back}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={publicLegalStyles.backText}>Back</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

export const publicLegalStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7FAF8',
  },
  scroll: {
    paddingTop: 20,
    paddingBottom: 48,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#5F7A6C',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    color: '#143326',
  },
  meta: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
    color: '#5F6F67',
  },
  lead: {
    marginTop: 16,
    fontSize: 16,
    lineHeight: 24,
    color: '#1F332A',
  },
  link: {
    marginTop: 14,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    color: '#0E4F20',
    textDecorationLine: 'underline',
  },
  hint: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    color: '#6A7B73',
  },
  section: {
    marginTop: 28,
  },
  heading: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
    color: '#143326',
    marginBottom: 8,
  },
  body: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 23,
    color: '#24362E',
  },
  bullet: {
    marginTop: 6,
    marginLeft: 4,
    fontSize: 15,
    lineHeight: 22,
    color: '#24362E',
  },
  back: {
    marginTop: 36,
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  backText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0E4F20',
  },
});
