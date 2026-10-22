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
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import {
  supabase,
} from '@/lib/supabase';


type Placement =
  | 'home'
  | 'messages'
  | 'learn'
  | 'community'
  | 'prayer';


type Sponsor = {
  id: string;
  sponsor_name: string;
  headline: string;
  body: string | null;
  target_url: string | null;
  placement: string;
  priority: number;
  ends_at: string | null;
};


/* BUKLOD_WEB_REQUEST_STORM_R1
 * All sponsor slots ask for the same sponsor set. Bucket the moving
 * starts_at boundary so simultaneous mounts produce one identical safe read
 * that the global request shield can coalesce instead of one request per slot.
 */
const SPONSOR_QUERY_BUCKET_MS = 30_000;


export default function BuklodSponsorSlot({
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

  const translateX =
    useRef(
      new Animated.Value(24)
    ).current;

  const scale =
    useRef(
      new Animated.Value(0.985)
    ).current;


  const animateIn =
    useCallback(() => {

      Animated.parallel([

        Animated.timing(
          opacity,
          {
            toValue: 1,
            duration: 480,
            easing:
              Easing.out(
                Easing.cubic
              ),
            useNativeDriver: true,
          }
        ),

        Animated.timing(
          translateX,
          {
            toValue: 0,
            duration: 480,
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
            friction: 8,
            tension: 70,
            useNativeDriver: true,
          }
        ),

      ]).start();

    }, [
      opacity,
      scale,
      translateX,
    ]);


  const advance =
    useCallback(() => {

      Animated.parallel([

        Animated.timing(
          opacity,
          {
            toValue: 0,
            duration: 240,
            useNativeDriver: true,
          }
        ),

        Animated.timing(
          translateX,
          {
            toValue: -20,
            duration: 240,
            useNativeDriver: true,
          }
        ),

        Animated.timing(
          scale,
          {
            toValue: 0.985,
            duration: 240,
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

        translateX.setValue(24);
        scale.setValue(0.985);

        animateIn();

      });

    }, [
      animateIn,
      items.length,
      opacity,
      scale,
      translateX,
    ]);


  useEffect(() => {

    let alive = true;


    const load =
      async () => {

        const nowMs = Date.now();
        const now =
          new Date(
            Math.floor(
              nowMs /
                SPONSOR_QUERY_BUCKET_MS
            ) *
              SPONSOR_QUERY_BUCKET_MS
          ).toISOString();


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
              body,
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
            'Body sponsor:',
            error.message
          );

          setItems([]);

          return;
        }


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
    translateX.setValue(24);
    scale.setValue(0.985);

    animateIn();

  }, [
    animateIn,
    items.length,
    opacity,
    scale,
    translateX,
  ]);


  useEffect(() => {

    if (
      items.length === 0
    ) {
      return;
    }


    const timer =
      setInterval(
        advance,
        7600
      );


    return () =>
      clearInterval(timer);

  }, [
    advance,
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
      style={{
        opacity,
        transform: [
          { translateX },
          { scale },
        ],
      }}
    >

      {sponsor ? (

        <Pressable
          onPress={open}
          disabled={
            !sponsor.target_url
          }
          style={({ pressed }) => [
            styles.card,
            pressed &&
            sponsor.target_url
              ? {
                  opacity: 0.76,
                }
              : null,
          ]}
        >

          <View style={styles.icon}>

            <Text style={styles.initial}>
              {
                sponsor
                  .sponsor_name
                  .trim()
                  .charAt(0)
                  .toUpperCase()
              }
            </Text>

          </View>


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
              numberOfLines={2}
            >
              {sponsor.headline}
            </Text>

            {!!sponsor.body && (

              <Text
                style={styles.body}
                numberOfLines={1}
              >
                {sponsor.body}
              </Text>

            )}

          </View>


          <MaterialCommunityIcons
            name={
              sponsor.target_url
                ? 'arrow-top-right'
                : 'bullhorn-outline'
            }
            size={22}
            color="#275D45"
          />

        </Pressable>

      ) : (

        <View style={styles.card}>

          <View style={styles.icon}>

            <MaterialCommunityIcons
              name="bullhorn-outline"
              size={25}
              color="#275D45"
            />

          </View>


          <View style={styles.copy}>

            <Text style={styles.sub}>
              SPONSOR
            </Text>

            <Text style={styles.advertise}>
              ADVERTISE YOUR BUSINESS HERE
            </Text>

            <Text style={styles.headline}>
              Reach members of the BUKLOD community.
            </Text>

          </View>

        </View>

      )}

    </Animated.View>
  );
}


const styles =
  StyleSheet.create({

    card: {
      minHeight: 94,

      flexDirection: 'row',
      alignItems: 'center',

      gap: 12,

      paddingHorizontal: 14,
      paddingVertical: 13,

      marginVertical: 4,

      backgroundColor:
        '#FFFFFF',

      borderWidth: 1,
      borderColor:
        'rgba(39,93,69,0.16)',

      borderRadius: 14,
    },

    icon: {
      width: 48,
      height: 48,

      borderRadius: 12,

      alignItems: 'center',
      justifyContent: 'center',

      backgroundColor:
        '#EEF5F0',
    },

    initial: {
      color: '#275D45',
      fontSize: 23,
      fontWeight: '900',
    },

    copy: {
      flex: 1,
      minWidth: 0,
    },

    sub: {
      color: '#78857E',
      fontSize: 8,
      lineHeight: 10,
      fontWeight: '900',
      letterSpacing: 1.2,
    },

    name: {
      marginTop: 2,

      color: '#173D2C',

      fontSize: 18,
      lineHeight: 21,

      fontWeight: '900',
    },

    advertise: {
      marginTop: 2,

      color: '#173D2C',

      fontSize: 16,
      lineHeight: 20,

      fontWeight: '900',
    },

    headline: {
      marginTop: 3,

      color: '#526159',

      fontSize: 12.5,
      lineHeight: 16,

      fontWeight: '700',
    },

    body: {
      marginTop: 2,

      color: '#7A8680',

      fontSize: 10.5,
    },

  });