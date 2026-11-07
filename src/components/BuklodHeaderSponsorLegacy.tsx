import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Animated,
  Easing,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  supabase,
} from '@/lib/supabase';

import { router } from 'expo-router';


type Placement =
  | 'home'
  | 'messages'
  | 'learn'
  | 'community'
  | 'prayer'
  | 'me';


type Sponsor = {
  id: string;
  sponsor_name: string;
  headline: string;
  target_url: string | null;
  placement: string;
  priority: number;
  ends_at: string | null;
};


export default function BuklodHeaderSponsor({
  placement,
}: {
  placement: Placement;
}) {

  const [items, setItems] =
    useState<Sponsor[]>([]);

  const [index, setIndex] =
    useState(0);


  const opacity =
    useRef(
      new Animated.Value(0)
    ).current;

  const translateY =
    useRef(
      new Animated.Value(10)
    ).current;

  const scale =
    useRef(
      new Animated.Value(0.97)
    ).current;


  const animateIn =
    useCallback(() => {

      Animated.parallel([
        Animated.timing(
          opacity,
          {
            toValue: 1,
            duration: 420,
            easing:
              Easing.out(
                Easing.cubic
              ),
            useNativeDriver: true,
          }
        ),

        Animated.timing(
          translateY,
          {
            toValue: 0,
            duration: 420,
            easing:
              Easing.out(
                Easing.cubic
              ),
            useNativeDriver: true,
          }
        ),

        Animated.spring(
          scale,
          {
            toValue: 1,
            friction: 7,
            tension: 80,
            useNativeDriver: true,
          }
        ),
      ]).start();

    }, [
      opacity,
      scale,
      translateY,
    ]);


  const animateOutAndAdvance =
    useCallback(() => {

      Animated.parallel([
        Animated.timing(
          opacity,
          {
            toValue: 0,
            duration: 220,
            useNativeDriver: true,
          }
        ),

        Animated.timing(
          translateY,
          {
            toValue: -8,
            duration: 220,
            useNativeDriver: true,
          }
        ),

        Animated.timing(
          scale,
          {
            toValue: 0.97,
            duration: 220,
            useNativeDriver: true,
          }
        ),
      ]).start(() => {

        setIndex(
          current =>
            items.length > 1
              ? (
                  current + 1
                ) % items.length
              : current
        );

        translateY.setValue(10);
        scale.setValue(0.97);

        animateIn();
      });

    }, [
      animateIn,
      items.length,
      opacity,
      scale,
      translateY,
    ]);


  useEffect(() => {

    let alive = true;

    const load =
      async () => {

        const now =
          new Date().toISOString();

        const {
          data,
          error,
        } =
          await supabase
            .from(
              'app_sponsors'
            )
            .select(`
              id,
              sponsor_name,
              headline,
              target_url,
              placement,
              priority,
              ends_at
            `)
            .eq(
              'is_active',
              true
            )
            .eq(
              'status',
              'approved'
            )
            .eq(
              'policy_confirmed',
              true
            )
            .lte(
              'starts_at',
              now
            )
            .order(
              'priority',
              {
                ascending: false,
              }
            )
            .limit(30);


        if (!alive) {
          return;
        }


        if (error) {

          console.warn(
            'Header sponsor:',
            error.message
          );

          setItems([]);

          return;
        }


        const nowMs =
          Date.now();


        const next =
          (data ?? []).filter(
            (row: any) =>
              (
                row.placement ===
                  'all'
                ||
                row.placement ===
                  placement
              )
              &&
              (
                !row.ends_at
                ||
                new Date(
                  row.ends_at
                ).getTime() >
                  nowMs
              )
          ) as Sponsor[];


        setItems(next);
        setIndex(0);

      };


    void load();


    return () => {
      alive = false;
    };

  }, [placement]);


  useEffect(() => {

    opacity.setValue(0);
    translateY.setValue(10);
    scale.setValue(0.97);

    animateIn();

  }, [
    animateIn,
    items.length,
    opacity,
    scale,
    translateY,
  ]);


  useEffect(() => {

    if (
      items.length === 0
    ) {
      return;
    }


    const timer =
      setInterval(
        animateOutAndAdvance,
        6500
      );


    return () =>
      clearInterval(timer);

  }, [
    animateOutAndAdvance,
    items.length,
  ]);


  const sponsor =
    items[index];


  const open =
    async () => {

      if (
        !sponsor?.target_url
      ) {
        return;
      }

      try {

        await Linking.openURL(
          sponsor.target_url
        );

      } catch (error) {

        console.warn(
          'Sponsor URL:',
          error
        );
      }

    };


  return (
    <Animated.View
      style={[
        styles.animation,
        {
          opacity,
          transform: [
            { translateY },
            { scale },
          ],
        },
      ]}
    >

      {sponsor ? (

        <Pressable
          onPress={open}
          disabled={
            !sponsor.target_url
          }
          style={({ pressed }) => [
            styles.ad,
            pressed &&
            sponsor.target_url
              ? {
                  opacity: 0.72,
                }
              : null,
          ]}
        >

          <View style={styles.copy}>

            <Text style={styles.sub}>
              SPONSOR
            </Text>

            <Text
              style={styles.name}
              numberOfLines={1}
            >
              {sponsor.sponsor_name}
            </Text>

            <Text
              style={styles.headline}
              numberOfLines={1}
            >
              {sponsor.headline}
            </Text>

          </View>


          {items.length > 1 && (

            <Text style={styles.count}>
              {index + 1}/{items.length}
            </Text>

          )}

        </Pressable>

      ) : (

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Advertise on BUKLOD"
          testID="buklod-header-advertise"
          onPress={() => router.push('/advertise' as any)}
          style={({ pressed }) => [
            styles.ad,
            pressed && { opacity: 0.72 },
          ]}
        >

          <View style={styles.copy}>

            <Text style={styles.sub}>
              SPONSOR
            </Text>

            <Text
              style={styles.advertise}
              numberOfLines={1}
            >
              ADVERTISE HERE
            </Text>

            <Text
              style={styles.headline}
              numberOfLines={1}
            >
              Reach the BUKLOD community
            </Text>

          </View>

        </Pressable>

      )}

    </Animated.View>
  );
}


const styles =
  StyleSheet.create({

    animation: {
      width: 225,
      height: 56,
      margin: 0,
      padding: 0,
      alignSelf: 'stretch',
    },

    ad: {
      width: 225,
      height: 56,

      margin: 0,

      borderRadius: 0,

      paddingHorizontal: 13,
      paddingVertical: 0,

      backgroundColor:
        '#FFFFFF',

      borderLeftWidth: 1,
      borderLeftColor:
        'rgba(39,93,69,0.14)',

      flexDirection: 'row',
      alignItems: 'center',

      overflow: 'hidden',
    },

    copy: {
      flex: 1,
      minWidth: 0,
      justifyContent: 'center',
    },

    sub: {
      color: '#7C8881',
      fontSize: 7,
      lineHeight: 9,
      fontWeight: '900',
      letterSpacing: 1.15,
    },

    name: {
      color: '#173D2C',
      fontSize: 15,
      lineHeight: 17,
      fontWeight: '900',
      marginTop: 1,
    },

    advertise: {
      color: '#173D2C',
      fontSize: 16,
      lineHeight: 18,
      fontWeight: '900',
      marginTop: 1,
    },

    headline: {
      color: '#55665D',
      fontSize: 10.5,
      lineHeight: 12,
      fontWeight: '700',
      marginTop: 1,
    },

    count: {
      marginLeft: 5,
      color: '#89938D',
      fontSize: 7,
      fontWeight: '900',
    },

  });