import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import {
  Redirect,
  router,
} from 'expo-router';

import { supabase }
  from '@/lib/supabase';

import {
  detectBuklodPublicLanguage,
  getDailyMotivationalLesson,
  publicLanguageLabel,
} from '@/lib/buklodPublicDailyContent';

import {
  colors,
} from '@/lib/theme';

import {
  useAuth,
} from '@/providers/AuthProvider';

import {
  useBuklodScope,
} from '@/providers/BuklodScopeProvider';


export default function InspireScreen() {

  const {
    user,
    profile,
  } =
    useAuth();

  const {
    activeScope,
  } =
    useBuklodScope();


  const [
    address,
    setAddress,
  ] =
    useState<{
      province?: string | null;
      country?: string | null;
    }>({});


  const [
    loading,
    setLoading,
  ] =
    useState(true);


  useEffect(() => {

    let alive = true;

    const load =
      async () => {

        if (!user?.id) {

          if (alive) {
            setLoading(false);
          }

          return;
        }

        const {
          data,
        } =
          await supabase
            .from(
              'buklod_user_addresses'
            )
            .select(
              'province,country'
            )
            .eq(
              'user_id',
              user.id
            )
            .maybeSingle();

        if (!alive) {
          return;
        }

        setAddress(
          data ?? {}
        );

        setLoading(false);
      };


    void load();


    return () => {
      alive = false;
    };

  }, [
    user?.id,
  ]);


  if (!activeScope) {

    return (
      <View
        style={
          styles.loading
        }
      >
        <ActivityIndicator
          color={
            colors.greenDark
          }
        />
      </View>
    );
  }


  /*
   * This screen exists ONLY for
   * PUBLIC + Show Faith OFF.
   */
  if (
    activeScope.scope_type !==
      'PUBLIC' ||
    Boolean(
      activeScope
        .show_faith_content
    )
  ) {
    return (
      <Redirect
        href={
          '/word' as any
        }
      />
    );
  }


  const language =
    useMemo(
      () =>
        detectBuklodPublicLanguage(
          (
            profile as any
          )?.preferred_language,

          address.country,

          address.province,
        ),
      [
        profile,
        address.country,
        address.province,
      ]
    );


  const lesson =
    useMemo(
      () =>
        getDailyMotivationalLesson(
          user?.id ??
            'public-user',

          language,
        ),
      [
        user?.id,
        language,
      ]
    );


  if (loading) {

    return (
      <View
        style={
          styles.loading
        }
      >
        <ActivityIndicator
          color={
            colors.greenDark
          }
        />
      </View>
    );
  }


  return (
    <ScrollView
      style={
        styles.screen
      }
      contentContainerStyle={
        styles.content
      }
      showsVerticalScrollIndicator={
        false
      }
    >

      <View
        style={
          styles.header
        }
      >

        <Pressable
          onPress={() =>
            router.back()
          }
          style={
            styles.back
          }
          accessibilityLabel="Back"
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={22}
            color={
              colors.greenDark
            }
          />
        </Pressable>


        <View
          style={{
            flex: 1,
          }}
        >
          <Text
            style={
              styles.eyebrow
            }
          >
            DAILY INSPIRE
          </Text>

          <Text
            style={
              styles.headerTitle
            }
          >
            Motivational Lesson
          </Text>
        </View>


        <View
          style={
            styles.languageBadge
          }
        >
          <Text
            style={
              styles.languageText
            }
          >
            {
              publicLanguageLabel(
                language
              )
            }
          </Text>
        </View>

      </View>


      <View
        style={
          styles.hero
        }
      >

        <View
          style={
            styles.heroIcon
          }
        >
          <MaterialCommunityIcons
            name="book-open-outline"
            size={28}
            color={
              colors.greenDark
            }
          />
        </View>

        <Text
          style={
            styles.title
          }
        >
          {lesson.title}
        </Text>

      </View>


      <View
        style={
          styles.card
        }
      >
        <Text
          style={
            styles.sectionLabel
          }
        >
          TODAY'S THOUGHT
        </Text>

        <Text
          style={
            styles.body
          }
        >
          {lesson.insight}
        </Text>
      </View>


      <View
        style={
          styles.card
        }
      >
        <Text
          style={
            styles.sectionLabel
          }
        >
          MOTIVATIONAL LESSON
        </Text>

        <Text
          style={
            styles.lesson
          }
        >
          {lesson.lesson}
        </Text>
      </View>


      <View
        style={
          styles.actionCard
        }
      >
        <MaterialCommunityIcons
          name="check-circle-outline"
          size={22}
          color={
            colors.greenDark
          }
        />

        <View
          style={{
            flex: 1,
          }}
        >
          <Text
            style={
              styles.actionLabel
            }
          >
            TRY THIS TODAY
          </Text>

          <Text
            style={
              styles.actionText
            }
          >
            {lesson.action}
          </Text>
        </View>
      </View>


      <View
        style={
          styles.reflection
        }
      >
        <MaterialCommunityIcons
          name="thought-bubble-outline"
          size={21}
          color={
            colors.greenDark
          }
        />

        <View
          style={{
            flex: 1,
          }}
        >
          <Text
            style={
              styles.actionLabel
            }
          >
            REFLECTION
          </Text>

          <Text
            style={
              styles.actionText
            }
          >
            {lesson.reflection}
          </Text>
        </View>
      </View>


      <Text
        style={
          styles.footer
        }
      >
        A new lesson is selected automatically each day.
      </Text>

    </ScrollView>
  );
}


const styles =
  StyleSheet.create({

    screen: {
      flex: 1,
      backgroundColor:
        '#F7FAF8',
    },

    content: {
      padding:
        16,

      paddingBottom:
        40,
    },

    loading: {
      flex: 1,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#F7FAF8',
    },

    header: {
      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        10,

      marginBottom:
        18,
    },

    back: {
      width:
        42,

      height:
        42,

      borderRadius:
        14,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderWidth:
        1,

      borderColor:
        colors.line,
    },

    eyebrow: {
      fontSize:
        9,

      letterSpacing:
        1,

      fontWeight:
        '900',

      color:
        colors.greenDark,
    },

    headerTitle: {
      marginTop:
        1,

      fontSize:
        18,

      fontWeight:
        '900',

      color:
        colors.text,
    },

    languageBadge: {
      paddingHorizontal:
        8,

      paddingVertical:
        5,

      borderRadius:
        999,

      backgroundColor:
        colors.greenSoft,
    },

    languageText: {
      fontSize:
        7,

      fontWeight:
        '900',

      color:
        colors.greenDark,
    },

    hero: {
      alignItems:
        'center',

      paddingHorizontal:
        18,

      paddingVertical:
        22,

      borderRadius:
        20,

      backgroundColor:
        '#FFFFFF',

      borderWidth:
        1,

      borderColor:
        colors.line,

      marginBottom:
        12,
    },

    heroIcon: {
      width:
        54,

      height:
        54,

      borderRadius:
        27,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        colors.greenSoft,

      marginBottom:
        11,
    },

    title: {
      textAlign:
        'center',

      fontSize:
        21,

      lineHeight:
        27,

      fontWeight:
        '900',

      color:
        colors.text,
    },

    card: {
      padding:
        16,

      borderRadius:
        18,

      backgroundColor:
        '#FFFFFF',

      borderWidth:
        1,

      borderColor:
        colors.line,

      marginBottom:
        10,
    },

    sectionLabel: {
      fontSize:
        9,

      fontWeight:
        '900',

      letterSpacing:
        0.9,

      color:
        colors.greenDark,

      marginBottom:
        7,
    },

    body: {
      fontSize:
        14,

      lineHeight:
        21,

      color:
        colors.text,
    },

    lesson: {
      fontSize:
        15,

      lineHeight:
        22,

      fontWeight:
        '700',

      color:
        colors.text,
    },

    actionCard: {
      flexDirection:
        'row',

      gap:
        11,

      padding:
        16,

      borderRadius:
        18,

      backgroundColor:
        colors.greenSoft,

      marginBottom:
        10,
    },

    reflection: {
      flexDirection:
        'row',

      gap:
        11,

      padding:
        16,

      borderRadius:
        18,

      borderWidth:
        1,

      borderColor:
        colors.line,

      backgroundColor:
        '#FFFFFF',
    },

    actionLabel: {
      fontSize:
        9,

      fontWeight:
        '900',

      letterSpacing:
        0.8,

      color:
        colors.greenDark,

      marginBottom:
        4,
    },

    actionText: {
      fontSize:
        13,

      lineHeight:
        19,

      color:
        colors.text,
    },

    footer: {
      marginTop:
        15,

      textAlign:
        'center',

      fontSize:
        10,

      color:
        colors.muted,
    },

  });