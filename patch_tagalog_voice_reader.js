const fs = require("fs");

const biblePath =
  "./src/app/bible/read.tsx";

const lessonPath =
  "./src/app/learn/lesson.tsx";

const componentPath =
  "./src/components/VoiceReader.tsx";


function stop(message) {
  console.error("");
  console.error(
    "VOICE READER PATCH STOPPED:"
  );
  console.error(message);
  process.exit(1);
}


function read(path) {
  return fs.readFileSync(
    path,
    "utf8"
  );
}


function write(path, text) {
  fs.writeFileSync(
    path,
    text,
    "utf8"
  );
}


/* ============================================================
   1. SHARED VOICE READER
   ============================================================ */

const component =
String.raw`import {
  useEffect,
  useRef,
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
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import * as Speech
  from 'expo-speech';

import {
  colors,
} from '@/lib/theme';


type VoiceReaderProps = {
  text:
    string;

  title:
    string;

  subtitle?:
    string;

  language?:
    string;
};


const SPEEDS = [
  0.85,
  1,
  1.15,
];


function normalizeSpeechText(
  raw:
    string
) {

  return String(
    raw ?? ''
  )
    .replace(
      /\r/g,
      ' '
    )

    .replace(
      /\[(.*?)\]\((.*?)\)/g,
      '$1'
    )

    .replace(
      /https?:\/\/\S+/g,
      ' '
    )

    .replace(
      /[`*_>#]/g,
      ' '
    )

    .replace(
      /\s+/g,
      ' '
    )

    .trim();
}


function splitSpeechText(
  raw:
    string
) {

  const text =
    normalizeSpeechText(
      raw
    );


  if (!text) {
    return [];
  }


  const platformLimit =
    Number(
      Speech
        .maxSpeechInputLength
    );


  /*
   * Keep chunks well below the
   * native TTS maximum for stability.
   */
  const limit =
    Math.min(
      1800,

      Number.isFinite(
        platformLimit
      ) &&
      platformLimit > 400
        ? platformLimit - 150
        : 1800
    );


  const sentences =
    text.match(
      /[^.!?]+[.!?]+|[^.!?]+$/g
    ) ??
    [
      text,
    ];


  const chunks:
    string[] =
      [];


  let current =
    '';


  const pushLongPart =
    (
      part:
        string
    ) => {

      const words =
        part.split(
          /\s+/
        );


      let piece =
        '';


      for (
        const word
        of words
      ) {

        const candidate =
          piece
            ? piece +
              ' ' +
              word
            : word;


        if (
          candidate.length >
          limit
        ) {

          if (piece) {
            chunks.push(
              piece.trim()
            );
          }

          piece =
            word;

        }
        else {

          piece =
            candidate;

        }

      }


      if (piece.trim()) {
        chunks.push(
          piece.trim()
        );
      }

    };


  for (
    const sentenceRaw
    of sentences
  ) {

    const sentence =
      sentenceRaw
        .trim();


    if (!sentence) {
      continue;
    }


    if (
      sentence.length >
      limit
    ) {

      if (
        current.trim()
      ) {
        chunks.push(
          current.trim()
        );

        current =
          '';
      }


      pushLongPart(
        sentence
      );

      continue;
    }


    const candidate =
      current
        ? current +
          ' ' +
          sentence
        : sentence;


    if (
      candidate.length >
      limit
    ) {

      if (
        current.trim()
      ) {
        chunks.push(
          current.trim()
        );
      }


      current =
        sentence;

    }
    else {

      current =
        candidate;

    }

  }


  if (
    current.trim()
  ) {
    chunks.push(
      current.trim()
    );
  }


  return chunks;
}


async function findBestVoice(
  language:
    string
) {

  try {

    const voices =
      await Speech
        .getAvailableVoicesAsync();


    const requested =
      String(
        language ||
        'fil-PH'
      )
        .toLowerCase();


    const primary =
      requested
        .split('-')[0];


    /*
     * Android/iOS may label
     * Filipino voices as fil or tl.
     */
    const accepted =
      primary === 'fil' ||
      primary === 'tl'
        ? [
            'fil',
            'tl',
          ]
        : [
            primary,
          ];


    const candidates =
      voices.filter(
        voice => {

          const voiceLanguage =
            String(
              voice.language ??
              ''
            )
              .toLowerCase();


          return accepted.some(
            code =>
              voiceLanguage ===
                code ||
              voiceLanguage
                .startsWith(
                  code + '-'
                )
          );

        }
      );


    candidates.sort(
      (
        a,
        b
      ) => {

        const aEnhanced =
          String(
            a.quality ??
            ''
          )
            .toLowerCase()
            .includes(
              'enhanced'
            )
            ? 1
            : 0;


        const bEnhanced =
          String(
            b.quality ??
            ''
          )
            .toLowerCase()
            .includes(
              'enhanced'
            )
            ? 1
            : 0;


        if (
          aEnhanced !==
          bEnhanced
        ) {
          return (
            bEnhanced -
            aEnhanced
          );
        }


        const aTagalog =
          /filipino|tagalog/i
            .test(
              String(
                a.name ??
                ''
              )
            )
            ? 1
            : 0;


        const bTagalog =
          /filipino|tagalog/i
            .test(
              String(
                b.name ??
                ''
              )
            )
            ? 1
            : 0;


        return (
          bTagalog -
          aTagalog
        );

      }
    );


    return (
      candidates[0] ??
      null
    );

  }
  catch {

    return null;

  }

}


export function VoiceReader({
  text,
  title,
  subtitle =
    'Malinaw na Filipino voice reader',
  language =
    'fil-PH',
}: VoiceReaderProps) {

  const [
    speaking,
    setSpeaking,
  ] =
    useState(false);


  const [
    rate,
    setRate,
  ] =
    useState(
      0.85
    );


  const [
    progress,
    setProgress,
  ] =
    useState({
      current:
        0,

      total:
        0,
    });


  const [
    voiceName,
    setVoiceName,
  ] =
    useState<
      string |
      null
    >(
      null
    );


  const runIdRef =
    useRef(
      0
    );


  const stopReader =
    async () => {

      runIdRef.current +=
        1;


      setSpeaking(
        false
      );


      setProgress({
        current:
          0,

        total:
          0,
      });


      await Speech.stop();

  };


  const startReader =
    async () => {

      const chunks =
        splitSpeechText(
          text
        );


      if (
        chunks.length ===
        0
      ) {

        Alert.alert(
          'Voice Reader',
          'Walang text na mababasa.'
        );

        return;

      }


      runIdRef.current +=
        1;


      const runId =
        runIdRef.current;


      await Speech.stop();


      const selectedVoice =
        await findBestVoice(
          language
        );


      if (
        runId !==
        runIdRef.current
      ) {
        return;
      }


      setVoiceName(
        selectedVoice?.name
          ? String(
              selectedVoice.name
            )
          : null
      );


      setSpeaking(
        true
      );


      setProgress({
        current:
          1,

        total:
          chunks.length,
      });


      const speakChunk =
        (
          index:
            number
        ) => {

          if (
            runId !==
            runIdRef.current
          ) {
            return;
          }


          if (
            index >=
            chunks.length
          ) {

            setSpeaking(
              false
            );


            setProgress({
              current:
                chunks.length,

              total:
                chunks.length,
            });


            return;

          }


          setProgress({
            current:
              index + 1,

            total:
              chunks.length,
          });


          Speech.speak(
            chunks[index],
            {
              language,

              voice:
                selectedVoice
                  ?.identifier,

              rate,

              pitch:
                1,

              volume:
                1,

              onDone:
                () => {

                  if (
                    runId !==
                    runIdRef.current
                  ) {
                    return;
                  }


                  speakChunk(
                    index + 1
                  );

                },

              onStopped:
                () => {

                  if (
                    runId !==
                    runIdRef.current
                  ) {
                    return;
                  }


                  setSpeaking(
                    false
                  );

                },

              onError:
                () => {

                  if (
                    runId !==
                    runIdRef.current
                  ) {
                    return;
                  }


                  setSpeaking(
                    false
                  );


                  Alert.alert(
                    'Voice Reader',
                    'Hindi mabasa ng voice engine ang text na ito.'
                  );

                },
            }
          );

        };


      speakChunk(
        0
      );

  };


  /*
   * Stop old narration when
   * moving to another chapter/lesson.
   */
  useEffect(
    () => {

      runIdRef.current +=
        1;


      setSpeaking(
        false
      );


      setProgress({
        current:
          0,

        total:
          0,
      });


      void Speech.stop();

    },
    [
      text,
    ]
  );


  useEffect(
    () => {

      return () => {

        runIdRef.current +=
          1;

        void Speech.stop();

      };

    },
    []
  );


  return (
    <View
      style={
        styles.card
      }
    >

      <View
        style={
          styles.topRow
        }
      >

        <View
          style={
            styles.iconCircle
          }
        >
          <MaterialCommunityIcons
            name="volume-high"
            size={24}
            color={
              colors.greenDark
            }
          />
        </View>


        <View
          style={{
            flex:
              1,
          }}
        >

          <Text
            style={
              styles.heading
            }
          >
            AUDIO READER
          </Text>


          <Text
            style={
              styles.description
            }
          >
            {
              speaking
                ? 'Binabasa ngayon...'
                : subtitle
            }
          </Text>


          {!!voiceName && (
            <Text
              style={
                styles.voiceName
              }
              numberOfLines={
                1
              }
            >
              Voice: {
                voiceName
              }
            </Text>
          )}

        </View>

      </View>


      <Pressable
        onPress={
          () => {

            if (
              speaking
            ) {
              void stopReader();
            }
            else {
              void startReader();
            }

          }
        }
        style={[
          styles.playButton,

          speaking &&
            styles.stopButton,
        ]}
      >

        <MaterialCommunityIcons
          name={
            speaking
              ? 'stop-circle-outline'
              : 'play-circle-outline'
          }
          size={24}
          color="#FFFFFF"
        />


        <Text
          style={
            styles.playText
          }
        >
          {
            speaking
              ? 'ITIGIL ANG PAGBASA'
              : title
          }
        </Text>

      </Pressable>


      <View
        style={
          styles.speedArea
        }
      >

        <Text
          style={
            styles.speedLabel
          }
        >
          BILIS NG BOSES
        </Text>


        <View
          style={
            styles.speedRow
          }
        >

          {SPEEDS.map(
            item => {

              const active =
                rate ===
                item;


              return (
                <Pressable
                  key={
                    item
                  }
                  onPress={() =>
                    setRate(
                      item
                    )
                  }
                  style={[
                    styles.speedButton,

                    active &&
                      styles.speedButtonOn,
                  ]}
                >
                  <Text
                    style={[
                      styles.speedText,

                      active &&
                        styles.speedTextOn,
                    ]}
                  >
                    {
                      item.toFixed(
                        item === 1
                          ? 1
                          : 2
                      )
                    }x
                  </Text>
                </Pressable>
              );

            }
          )}

        </View>

      </View>


      {speaking &&
        progress.total >
          1 && (

        <Text
          style={
            styles.progress
          }
        >
          Bahagi {
            progress.current
          } sa {
            progress.total
          }
        </Text>

      )}

    </View>
  );

}


const styles =
  StyleSheet.create({

    card: {
      marginBottom:
        12,

      padding:
        12,

      borderWidth:
        1,

      borderColor:
        colors.line,

      borderRadius:
        14,

      backgroundColor:
        '#F7FBF8',
    },


    topRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        10,

      marginBottom:
        10,
    },


    iconCircle: {
      width:
        46,

      height:
        46,

      borderRadius:
        23,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        colors.greenSoft,
    },


    heading: {
      fontSize:
        11,

      fontWeight:
        '900',

      letterSpacing:
        0.8,

      color:
        colors.greenDark,
    },


    description: {
      marginTop:
        2,

      fontSize:
        10.5,

      lineHeight:
        15,

      color:
        colors.muted,
    },


    voiceName: {
      marginTop:
        3,

      fontSize:
        8.5,

      color:
        colors.muted,
    },


    playButton: {
      minHeight:
        48,

      borderRadius:
        13,

      paddingHorizontal:
        12,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      gap:
        7,

      backgroundColor:
        colors.greenDark,
    },


    stopButton: {
      backgroundColor:
        '#8B2C2C',
    },


    playText: {
      fontSize:
        11,

      fontWeight:
        '900',

      color:
        '#FFFFFF',
    },


    speedArea: {
      marginTop:
        10,
    },


    speedLabel: {
      marginBottom:
        6,

      fontSize:
        8.5,

      fontWeight:
        '900',

      color:
        colors.muted,
    },


    speedRow: {
      flexDirection:
        'row',

      gap:
        7,
    },


    speedButton: {
      flex:
        1,

      minHeight:
        36,

      borderWidth:
        1,

      borderColor:
        colors.line,

      borderRadius:
        10,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFFFFF',
    },


    speedButtonOn: {
      borderColor:
        colors.greenDark,

      backgroundColor:
        colors.greenSoft,
    },


    speedText: {
      fontSize:
        10,

      fontWeight:
        '800',

      color:
        colors.muted,
    },


    speedTextOn: {
      color:
        colors.greenDark,
    },


    progress: {
      marginTop:
        8,

      textAlign:
        'center',

      fontSize:
        9,

      fontWeight:
        '800',

      color:
        colors.greenDark,
    },

  });
`;


write(
  componentPath,
  component
);


console.log(
  "SHARED TAGALOG VOICE READER CREATED"
);


/* ============================================================
   2. BIBLE READER
   ============================================================ */

{
  let src =
    read(
      biblePath
    );


  if (
    !src.includes(
      "@/components/VoiceReader"
    )
  ) {

    const uiImportPattern =
      /(import\s+\{[\s\S]*?\}\s+from\s+'@\/components\/UI';)/;


    if (
      !uiImportPattern.test(
        src
      )
    ) {
      stop(
        "Bible UI import anchor not found."
      );
    }


    src =
      src.replace(
        uiImportPattern,
`$1
import { VoiceReader } from '@/components/VoiceReader';`
      );

  }


  if (
    !src.includes(
      "BIBLE_TAGALOG_VOICE_READER"
    )
  ) {

    const chapterAnchor =
`        {chapterLoading ? (`;


    if (
      !src.includes(
        chapterAnchor
      )
    ) {
      stop(
        "Bible chapter render anchor not found."
      );
    }


    src =
      src.replace(
        chapterAnchor,
`        {/* BIBLE_TAGALOG_VOICE_READER */}
        {!chapterLoading &&
          verses.length > 0 && (
          <VoiceReader
            title="PAKINGGAN ANG KABANATA"
            subtitle={
              translation === 'ASD'
                ? 'Malinaw na Tagalog / Filipino voice'
                : 'Audio reader for the selected Bible version'
            }
            language={
              translation === 'ASD'
                ? 'fil-PH'
                : 'en-US'
            }
            text={[
              (currentBook?.book_name ?? 'Bible') +
                ', kabanata ' +
                chapterNo +
                '.',

              ...verses.map(
                verse =>
                  'Talata ' +
                  Number(
                    verse.verse_no
                  ) +
                  '. ' +
                  String(
                    verse.verse_text ?? ''
                  )
                    .replace(
                      /^\\u00B6\\s*/,
                      ''
                    )
                    .trim()
              ),
            ].join(' ')}
          />
        )}


        {chapterLoading ? (`
      );

  }


  write(
    biblePath,
    src
  );


  console.log(
    "BIBLE CHAPTER AUDIO BUTTON INSTALLED"
  );

}


/* ============================================================
   3. BUKLOD LESSON
   ============================================================ */

{
  let src =
    read(
      lessonPath
    );


  if (
    !src.includes(
      "@/components/VoiceReader"
    )
  ) {

    const uiImportPattern =
      /(import\s+\{[\s\S]*?\}\s+from\s+'@\/components\/UI';)/;


    if (
      !uiImportPattern.test(
        src
      )
    ) {
      stop(
        "Lesson UI import anchor not found."
      );
    }


    src =
      src.replace(
        uiImportPattern,
`$1
import { VoiceReader } from '@/components/VoiceReader';`
      );

  }


  if (
    !src.includes(
      "LESSON_TAGALOG_VOICE_READER"
    )
  ) {

    const lessonAnchor =
`      <SectionTitle>LESSON</SectionTitle>`;


    if (
      !src.includes(
        lessonAnchor
      )
    ) {
      stop(
        "Lesson section anchor not found."
      );
    }


    src =
      src.replace(
        lessonAnchor,
`      <SectionTitle>LESSON</SectionTitle>

      {/* LESSON_TAGALOG_VOICE_READER */}
      <VoiceReader
        title="PAKINGGAN ANG LESSON"
        subtitle="Malinaw na Tagalog / Filipino voice"
        language="fil-PH"
        text={[
          String(
            lesson.title ?? ''
          ),

          String(
            lesson.content ?? ''
          ),
        ]
          .filter(Boolean)
          .join('. ')}
      />`
      );

  }


  write(
    lessonPath,
    src
  );


  console.log(
    "BUKLOD LESSON AUDIO BUTTON INSTALLED"
  );

}


console.log("");
console.log(
  "TAGALOG VOICE READER PATCH APPLIED"
);
