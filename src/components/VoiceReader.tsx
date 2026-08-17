import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import * as Speech from 'expo-speech';


/* ==========================================================
   VOICE_READER_SPEED_IMMEDIATE_V2

   - 0.5x to 2.0x
   - Tap or drag
   - Immediate speed change while speaking
   - Restarts current speech chunk at new speed
   - Pure React Native UI
========================================================== */


type Props = {
  text?: string | string[];
  language?: string;

  title?: string;
  label?: string;
  buttonLabel?: string;

  onFinished?: () => void;
  onComplete?: () => void;

  disabled?: boolean;

  /* VOICE_READER_CONTINUOUS_AUTOPLAY_V1 */
  autoPlay?: boolean;

  onUserStart?: () => void;
  onUserStop?: () => void;

  [key: string]: any;
};


const MIN_RATE = 0.5;
const MAX_RATE = 2;
const RATE_STEP = 0.1;


function clamp(
  value: number,
  min: number,
  max: number
) {
  return Math.max(
    min,
    Math.min(
      max,
      value
    )
  );
}


function normalizeText(
  input?: string | string[]
) {

  if (Array.isArray(input)) {

    return input
      .filter(Boolean)
      .join(' ')
      /* VOICE_STRIP_VERSE_LABELS_V1 */
    .replace(
      /\b(?:Talata|Verse)\s+\d+\s*[.:,;-]?\s*/gi,
      ''
    )
    .replace(/\s+/g, ' ')
    .trim();

  }

  return String(input ?? '')
    /* VOICE_STRIP_VERSE_LABELS_V1 */
    .replace(
      /\b(?:Talata|Verse)\s+\d+\s*[.:,;-]?\s*/gi,
      ''
    )
    .replace(/\s+/g, ' ')
    .trim();

}


function makeChunks(
  input: string
) {

  if (!input) {
    return [];
  }


  /*
   * Smaller chunks make speed changes
   * feel much more responsive.
   */
  const maxLength = 500;


  const sentences =
    input.match(
      /[^.!?]+[.!?]+|[^.!?]+$/g
    ) ?? [input];


  const chunks: string[] = [];

  let current = '';


  const pushCurrent = () => {

    const clean =
      current.trim();

    if (clean) {
      chunks.push(clean);
    }

    current = '';

  };


  for (
    const sentence
    of sentences
  ) {

    const clean =
      sentence.trim();

    if (!clean) {
      continue;
    }


    if (
      clean.length >
      maxLength
    ) {

      pushCurrent();

      const words =
        clean.split(/\s+/);

      let part = '';


      for (
        const word
        of words
      ) {

        const next =
          part
            ? `${part} ${word}`
            : word;


        if (
          next.length >
          maxLength
        ) {

          if (part.trim()) {
            chunks.push(
              part.trim()
            );
          }

          part =
            word;

        }
        else {

          part =
            next;

        }

      }


      if (part.trim()) {
        chunks.push(
          part.trim()
        );
      }


      continue;

    }


    const next =
      current
        ? `${current} ${clean}`
        : clean;


    if (
      next.length >
      maxLength
    ) {

      pushCurrent();

      current =
        clean;

    }
    else {

      current =
        next;

    }

  }


  pushCurrent();

  return chunks;

}



/* ==========================================================
   BIBLE_MALE_VOICE_PREFERENCE_V1

   Prefer an installed male / masculine voice.
   Android TTS voice metadata is not uniform,
   so we also lower pitch slightly as fallback.
========================================================== */

function maleVoiceScore(
  voice: any
) {

  const identity =
    (
      String(
        voice?.name ??
        ''
      ) +
      ' ' +
      String(
        voice?.identifier ??
        ''
      )
    )
      .toLowerCase();


  let score =
    0;


  if (
    /(^|[\s_-])(male|man|guy|masculine|boy)([\s_-]|$)/i
      .test(
        identity
      )
  ) {
    score +=
      100;
  }


  if (
    /(female|woman|girl|feminine)/i
      .test(
        identity
      )
  ) {
    score -=
      100;
  }


  const quality =
    String(
      voice?.quality ??
      ''
    )
      .toLowerCase();


  if (
    quality.includes(
      'enhanced'
    )
  ) {
    score +=
      10;
  }


  return score;

}



/* ==========================================================
   FILIPINO_TTS_CONTRACTIONS_V1

   Displayed Bible text remains unchanged.
   Only the text sent to Filipino TTS is expanded.

   Examples:
   nawa'y  -> nawa ay
   ako'y   -> ako ay
   siya'y  -> siya ay
   tayo'y  -> tayo ay
   ako't   -> ako at
========================================================== */

function normalizeFilipinoSpeech(
  input: string
) {

  return String(
    input ?? ''
  )

    /*
     * Normalize curly apostrophes first.
     */
    .replace(
      /[’‘]/g,
      "'"
    )

    /*
     * Filipino contraction:
     * ako'y -> ako ay
     * nawa'y -> nawa ay
     */
    .replace(
      /([A-Za-zÀ-ÖØ-öø-ÿ]+)'y\b/gi,
      '$1 ay'
    )

    /*
     * Filipino contraction:
     * ako't -> ako at
     * puso't -> puso at
     */
    .replace(
      /([A-Za-zÀ-ÖØ-öø-ÿ]+)'t\b/gi,
      '$1 at'
    )

    .replace(
      /\s+/g,
      ' '
    )
    .trim();

}


export function VoiceReader({
  text,
  language = 'fil-PH',

  title,
  label,
  buttonLabel,

  onFinished,
  onComplete,

  disabled = false,

  autoPlay = false,

  onUserStart,
  onUserStop,
}: Props) {

  const speechText =
    useMemo(
      () => {

        const normalized =
          normalizeText(
            text
          );


        return String(
          language
        )
          .toLowerCase()
          .startsWith(
            'fil'
          )
            ? normalizeFilipinoSpeech(
                normalized
              )
            : normalized;

      },
      [
        text,
        language,
      ]
    );


  const chunks =
    useMemo(
      () =>
        makeChunks(
          speechText
        ),
      [speechText]
    );


  const [
    speaking,
    setSpeaking,
  ] =
    useState(false);


  const [
    rate,
    setRate,
  ] =
    useState(1);


  const [
    barWidth,
    setBarWidth,
  ] =
    useState(1);


  const mountedRef =
    useRef(true);


  const speakingRef =
    useRef(false);


  const rateRef =
    useRef(1);


  const currentChunkRef =
    useRef(0);


  const runTokenRef =
    useRef(0);


  const voiceRef =
    useRef<
      string |
      undefined
    >(
      undefined
    );


  const finishCallback =
    onFinished ??
    onComplete;


  const setSpeakingSafe =
    useCallback(
      (
        value: boolean
      ) => {

        speakingRef.current =
          value;

        if (
          mountedRef.current
        ) {
          setSpeaking(value);
        }

      },
      []
    );


  /* ========================================================
     FIND APPROPRIATE INSTALLED VOICE
  ======================================================== */

  useEffect(
    () => {

      let cancelled =
        false;


      const loadVoice =
        async () => {

          try {

            const voices =
              await Speech
                .getAvailableVoicesAsync();


            if (cancelled) {
              return;
            }


            const wanted =
              String(language)
                .toLowerCase();


            const base =
              wanted.split('-')[0];


            const matches =
              (voices ?? [])
                .filter(
                  voice => {

                    const lang =
                      String(
                        voice.language ??
                        ''
                      )
                        .toLowerCase();


                    return (
                      lang === wanted ||
                      lang.startsWith(
                        `${base}-`
                      ) ||
                      lang === base
                    );

                  }
                );


            const preferredVoice =
              [...matches]
                .sort(
                  (
                    a: any,
                    b: any
                  ) =>
                    maleVoiceScore(b) -
                    maleVoiceScore(a)
                )[0];


            voiceRef.current =
              preferredVoice
                ?.identifier;

          }
          catch {

            voiceRef.current =
              undefined;

          }

        };


      void loadVoice();


      return () => {

        cancelled =
          true;

      };

    },
    [
      language,
    ]
  );


  /* ========================================================
     CORE SPEECH ENGINE
  ======================================================== */

  const speakChunk =
    useCallback(
      function speakChunkInternal(
        index: number,
        token: number
      ) {

        if (
          token !==
          runTokenRef.current
        ) {
          return;
        }


        const chunk =
          chunks[index];


        if (!chunk) {

          setSpeakingSafe(
            false
          );

          finishCallback
            ?.();

          return;
        }


        currentChunkRef.current =
          index;


        Speech.speak(
          chunk,
          {

            language,

            voice:
              voiceRef.current,

            /*
             * IMPORTANT:
             * Always read current rateRef.
             */
            rate:
              rateRef.current,

            pitch: 0.82,

            volume:
              1,


            onDone:
              () => {

                if (
                  token !==
                  runTokenRef.current
                ) {
                  return;
                }


                speakChunkInternal(
                  index + 1,
                  token
                );

              },


            onStopped:
              () => {

                /*
                 * Ignore callbacks belonging
                 * to an old/restarted speech.
                 */
                if (
                  token !==
                  runTokenRef.current
                ) {
                  return;
                }


                setSpeakingSafe(
                  false
                );

              },


            onError:
              () => {

                if (
                  token !==
                  runTokenRef.current
                ) {
                  return;
                }


                setSpeakingSafe(
                  false
                );

              },

          }
        );

      },
      [
        chunks,
        language,
        finishCallback,
        setSpeakingSafe,
      ]
    );


  const stop =
    useCallback(
      async () => {

        onUserStop?.();


        runTokenRef.current +=
          1;


        setSpeakingSafe(
          false
        );


        try {
          await Speech.stop();
        }
        catch {
          // no-op
        }

      },
      [
        setSpeakingSafe,
      ]
    );


  const start =
    useCallback(
      async () => {

        if (
          disabled ||
          !speechText ||
          !chunks.length
        ) {
          return;
        }


        /*
         * Invalidate all old callbacks first.
         */
        runTokenRef.current +=
          1;


        try {
          await Speech.stop();
        }
        catch {
          // no-op
        }


        const token =
          runTokenRef.current +
          1;


        runTokenRef.current =
          token;


        currentChunkRef.current =
          0;


        onUserStart?.();


        setSpeakingSafe(
          true
        );


        speakChunk(
          0,
          token
        );

      },
      [
        chunks.length,
        disabled,
        speechText,
        speakChunk,
        setSpeakingSafe,
      ]
    );


  /* ========================================================
     SPEED
  ======================================================== */

  const applyRate =
    useCallback(
      async (
        rawValue: number
      ) => {

        const clamped =
          clamp(
            rawValue,
            MIN_RATE,
            MAX_RATE
          );


        const stepped =
          Math.round(
            clamped /
            RATE_STEP
          ) *
          RATE_STEP;


        const next =
          Number(
            stepped.toFixed(1)
          );


        /*
         * Avoid unnecessary speech restart.
         */
        if (
          next ===
          rateRef.current
        ) {
          return;
        }


        rateRef.current =
          next;


        if (
          mountedRef.current
        ) {
          setRate(next);
        }


        /*
         * CRITICAL FIX:
         *
         * If currently speaking,
         * restart CURRENT chunk immediately
         * using the new rate.
         */
        if (
          speakingRef.current
        ) {

          const index =
            currentChunkRef.current;


          /*
           * Invalidate old callbacks BEFORE
           * stopping the old utterance.
           */
          const nextToken =
            runTokenRef.current +
            1;


          runTokenRef.current =
            nextToken;


          try {
            await Speech.stop();
          }
          catch {
            // no-op
          }


          if (
            !mountedRef.current ||
            !speakingRef.current
          ) {
            return;
          }


          /*
           * Keep state as speaking.
           */
          setSpeakingSafe(
            true
          );


          speakChunk(
            index,
            nextToken
          );

        }

      },
      [
        speakChunk,
        setSpeakingSafe,
      ]
    );


  const rateFromX =
    useCallback(
      (
        x: number
      ) => {

        const width =
          Math.max(
            1,
            barWidth
          );


        const ratio =
          clamp(
            x / width,
            0,
            1
          );


        const next =
          MIN_RATE +
          (
            ratio *
            (
              MAX_RATE -
              MIN_RATE
            )
          );


        void applyRate(
          next
        );

      },
      [
        applyRate,
        barWidth,
      ]
    );


  /* ========================================================
     PAN RESPONDER

     Prevents parent ScrollView from stealing
     the horizontal drag.
  ======================================================== */

  const panResponder =
    useMemo(
      () =>
        PanResponder.create({

          onStartShouldSetPanResponder:
            () =>
              true,


          onMoveShouldSetPanResponder:
            () =>
              true,


          onPanResponderTerminationRequest:
            () =>
              false,


          onPanResponderGrant:
            event => {

              rateFromX(
                event
                  .nativeEvent
                  .locationX
              );

            },


          onPanResponderMove:
            event => {

              rateFromX(
                event
                  .nativeEvent
                  .locationX
              );

            },

        }),
      [
        rateFromX,
      ]
    );


  const percent =
    clamp(
      (
        rate -
        MIN_RATE
      ) /
      (
        MAX_RATE -
        MIN_RATE
      ),
      0,
      1
    );


  /* ========================================================
     RESET WHEN PASSAGE CHANGES
  ======================================================== */

  useEffect(
    () => {

      runTokenRef.current +=
        1;


      setSpeakingSafe(
        false
      );


      void Speech.stop();

    },
    [
      speechText,
      language,
      setSpeakingSafe,
    ]
  );



  /* ========================================================
     VOICE_READER_CONTINUOUS_AUTOPLAY_V1
     Automatically start new chapter after text changes.
  ======================================================== */

  useEffect(
    () => {

      if (
        !autoPlay ||
        disabled ||
        !speechText ||
        !chunks.length
      ) {
        return;
      }


      /*
       * If already speaking, do not restart.
       */
      if (
        speakingRef.current
      ) {
        return;
      }


      const timer =
        setTimeout(
          () => {

            if (
              mountedRef.current &&
              !speakingRef.current
            ) {
              void start();
            }

          },
          180
        );


      return () =>
        clearTimeout(timer);

    },
    [
      autoPlay,
      speechText,
      language,
      disabled,
      chunks.length,
      start,
    ]
  );


  useEffect(
    () => {

      mountedRef.current =
        true;


      return () => {

        mountedRef.current =
          false;

        speakingRef.current =
          false;

        runTokenRef.current +=
          1;

        void Speech.stop();

      };

    },
    []
  );


  const visibleTitle =
    buttonLabel ||
    title ||
    label ||
    'PAKINGGAN';


  const presets =
    [
      0.5,
      1,
      1.5,
      2,
    ];


  return (

    <View
      style={
        styles.card
      }
    >

      {/* PLAY / STOP */}

      <Pressable
        disabled={
          disabled ||
          !speechText
        }

        onPress={
          speaking
            ? stop
            : start
        }

        style={({
          pressed,
        }) => [

          styles.playButton,

          (
            disabled ||
            !speechText
          ) &&
            styles.disabled,

          pressed &&
            styles.pressed,

        ]}
      >

        <Text
          style={
            styles.playIcon
          }
        >
          {
            speaking
              ? '■'
              : '▶'
          }
        </Text>


        <View
          style={{
            flex:
              1,
          }}
        >

          <Text
            style={
              styles.playTitle
            }
          >
            {
              speaking
                ? 'ITIGIL'
                : visibleTitle
            }
          </Text>


          <Text
            style={
              styles.playSub
            }
          >
            {
              speaking
                ? `Binabasa • ${rate.toFixed(1)}x`
                : `Voice reader • ${rate.toFixed(1)}x`
            }
          </Text>

        </View>

      </Pressable>


      {/* SPEED HEADER */}

      <View
        style={
          styles.speedHeader
        }
      >

        <Text
          style={
            styles.speedLabel
          }
        >
          BILIS
        </Text>


        <Text
          style={
            styles.speedValue
          }
        >
          {rate.toFixed(1)}x
        </Text>

      </View>


      {/* SPEED BAR */}

      <View
        {...panResponder.panHandlers}

        onLayout={
          event => {

            setBarWidth(
              Math.max(
                1,
                event
                  .nativeEvent
                  .layout
                  .width
              )
            );

          }
        }

        style={
          styles.speedTouch
        }
      >

        <View
          pointerEvents="none"
          style={
            styles.speedTrack
          }
        />


        <View
          pointerEvents="none"
          style={[
            styles.speedFill,
            {
              width:
                `${percent * 100}%`,
            },
          ]}
        />


        <View
          pointerEvents="none"
          style={[
            styles.speedThumb,
            {
              left:
                Math.max(
                  0,
                  (
                    barWidth -
                    24
                  ) *
                  percent
                ),
            },
          ]}
        />

      </View>


      {/* TAP PRESETS */}

      <View
        style={
          styles.presetRow
        }
      >

        {presets.map(
          preset => {

            const active =
              Math.abs(
                rate -
                preset
              ) <
              0.05;


            return (

              <Pressable
                key={
                  preset
                }

                onPress={() =>
                  void applyRate(
                    preset
                  )
                }

                style={[
                  styles.preset,

                  active &&
                    styles.presetActive,
                ]}
              >

                <Text
                  style={[
                    styles.presetText,

                    active &&
                      styles.presetTextActive,
                  ]}
                >
                  {preset}x
                </Text>

              </Pressable>

            );

          }
        )}

      </View>


      <Text
        style={
          styles.hint
        }
      >
        I-drag ang bar o pindutin ang speed. Magbabago agad habang binabasa.
      </Text>

    </View>

  );

}


export default VoiceReader;


const styles =
  StyleSheet.create({

    card: {

      borderWidth:
        1,

      borderColor:
        '#D8E2DC',

      borderRadius:
        15,

      backgroundColor:
        '#F7FAF8',

      padding:
        12,

    },


    playButton: {

      minHeight:
        52,

      paddingHorizontal:
        13,

      borderRadius:
        13,

      backgroundColor:
        '#275D45',

      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        11,

    },


    pressed: {
      opacity:
        0.78,
    },


    disabled: {
      opacity:
        0.4,
    },


    playIcon: {

      width:
        24,

      textAlign:
        'center',

      fontSize:
        17,

      fontWeight:
        '900',

      color:
        '#FFFFFF',

    },


    playTitle: {

      fontSize:
        11.5,

      fontWeight:
        '900',

      letterSpacing:
        0.4,

      color:
        '#FFFFFF',

    },


    playSub: {

      marginTop:
        2,

      fontSize:
        8.5,

      color:
        '#D7E6DE',

    },


    speedHeader: {

      marginTop:
        13,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

    },


    speedLabel: {

      fontSize:
        9,

      fontWeight:
        '900',

      letterSpacing:
        0.7,

      color:
        '#64746B',

    },


    speedValue: {

      fontSize:
        16,

      fontWeight:
        '900',

      color:
        '#275D45',

    },


    speedTouch: {

      marginTop:
        6,

      height:
        42,

      justifyContent:
        'center',

      position:
        'relative',

    },


    speedTrack: {

      position:
        'absolute',

      left:
        0,

      right:
        0,

      height:
        8,

      borderRadius:
        99,

      backgroundColor:
        '#D9E2DD',

    },


    speedFill: {

      position:
        'absolute',

      left:
        0,

      height:
        8,

      borderRadius:
        99,

      backgroundColor:
        '#275D45',

    },


    speedThumb: {

      position:
        'absolute',

      width:
        24,

      height:
        24,

      borderRadius:
        12,

      backgroundColor:
        '#FFFFFF',

      borderWidth:
        3,

      borderColor:
        '#275D45',

    },


    presetRow: {

      marginTop:
        2,

      flexDirection:
        'row',

      justifyContent:
        'space-between',

      gap:
        4,

    },


    preset: {

      flex:
        1,

      minHeight:
        30,

      borderRadius:
        8,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#EEF3F0',

    },


    presetActive: {

      backgroundColor:
        '#275D45',

    },


    presetText: {

      fontSize:
        8,

      fontWeight:
        '900',

      color:
        '#617067',

    },


    presetTextActive: {

      color:
        '#FFFFFF',

    },


    hint: {

      marginTop:
        8,

      fontSize:
        8.5,

      lineHeight:
        13,

      color:
        '#77847D',

    },

  });
