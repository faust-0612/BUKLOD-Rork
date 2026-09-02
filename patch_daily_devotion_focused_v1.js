const fs = require("fs");

const path =
  "./src/app/bible/read.tsx";

let src =
  fs.readFileSync(
    path,
    "utf8"
  );


function stop(message) {
  console.error("");
  console.error(
    "DAILY DEVOTION FOCUSED PATCH STOPPED:"
  );
  console.error(message);
  process.exit(1);
}


if (
  src.includes(
    "DAILY_DEVOTION_FOCUSED_READING_V1"
  )
) {
  console.log(
    "DAILY DEVOTION FOCUSED READING ALREADY INSTALLED"
  );

  process.exit(0);
}


/*
 * We create a dedicated Daily Plan return.
 *
 * This means:
 * daily_plan -> focused reading only
 * my_bible   -> existing full Bible interface
 *
 * No need to manually hide every My Bible section.
 */


/* ==========================================================
   FIND FINAL MAIN BIBLE RETURN
========================================================== */

const mainNeedle =
  "  return (\n    <ScrollView";

const mainIndex =
  src.lastIndexOf(
    mainNeedle
  );


if (mainIndex < 0) {
  stop(
    "Final Bible ScrollView return not found."
  );
}


/* ==========================================================
   DEDICATED DAILY DEVOTION UI
========================================================== */

const dailyUI =
String.raw`
  /* ==========================================================
     DAILY_DEVOTION_FOCUSED_READING_V1

     Daily Devotion is intentionally different from MY BIBLE.

     DAILY:
     - assigned Scripture immediately
     - no quick chapter search
     - no word search
     - no book/chapter browser
     - no annotations
     - Respond after reading

     MY BIBLE keeps the full navigation tools.
  ========================================================== */

  if (source === 'daily_plan') {

    const dailyReference =
      (
        currentBook?.book_name ??
        'Bible'
      ) +
      ' ' +
      chapterNo;


    const openRespond =
      () => {

        if (assignedDate) {

          router.replace({
            pathname:
              '/bible',

            params: {
              date:
                assignedDate,

              mode:
                'respond',
            },
          } as any);

          return;
        }


        router.replace(
          '/bible' as any
        );

      };


    return (
      <ScrollView
        style={
          shared.screen
        }
        contentContainerStyle={[
          shared.content,
          styles.content,
          {
            paddingBottom:
              48,
          },
        ]}
        showsVerticalScrollIndicator={
          false
        }
      >

        {/* ================================================
            HEADER
        ================================================= */}

        <View
          style={
            styles.header
          }
        >

          <View
            style={{
              flex:
                1,
            }}
          >

            <Text
              style={[
                shared.muted,
                {
                  fontSize:
                    9,

                  fontWeight:
                    '900',

                  letterSpacing:
                    0.8,

                  color:
                    '#275D45',
                },
              ]}
            >
              DAILY DEVOTION
            </Text>


            <Text
              style={[
                shared.h1,
                {
                  marginTop:
                    3,
                },
              ]}
            >
              Today's Reading
            </Text>


            <Text
              style={[
                shared.muted,
                {
                  marginTop:
                    3,

                  fontSize:
                    13,

                  fontWeight:
                    '800',
                },
              ]}
            >
              {dailyReference}
            </Text>

          </View>


          <Pressable
            onPress={() =>
              router.back()
            }
            style={
              styles.outline
            }
          >
            <Text
              style={{
                fontWeight:
                  '900',

                color:
                  '#275D45',
              }}
            >
              BACK
            </Text>
          </Pressable>

        </View>


        {/* ================================================
            READING STATUS
        ================================================= */}

        {dailyPlanChaptersToday > 1 && (

          <View
            style={{
              marginTop:
                10,

              marginBottom:
                4,

              paddingHorizontal:
                12,

              paddingVertical:
                9,

              borderRadius:
                12,

              backgroundColor:
                '#F2F6F3',

              borderWidth:
                1,

              borderColor:
                '#D8E2DC',
            }}
          >

            <Text
              style={{
                fontSize:
                  10,

                fontWeight:
                  '900',

                color:
                  '#275D45',
              }}
            >
              READING {dailyPlanStep} OF {dailyPlanChaptersToday}
            </Text>

          </View>

        )}


        {/* ================================================
            READING — VERSES IMMEDIATELY
        ================================================= */}

        <Text
          style={{
            marginTop:
              15,

            marginBottom:
              8,

            fontSize:
              10,

            fontWeight:
              '900',

            letterSpacing:
              0.8,

            color:
              '#275D45',
          }}
        >
          READING
        </Text>


        <Card>

          <View
            style={{
              marginBottom:
                12,

              paddingBottom:
                10,

              borderBottomWidth:
                1,

              borderBottomColor:
                '#E1E7E3',
            }}
          >

            <Text
              style={
                styles.reference
              }
            >
              {dailyReference}
            </Text>


            <Text
              style={[
                shared.muted,
                {
                  marginTop:
                    3,

                  fontSize:
                    9,
                },
              ]}
            >
              {translation}
            </Text>

          </View>


          {chapterLoading ? (

            <View
              style={{
                minHeight:
                  160,

                alignItems:
                  'center',

                justifyContent:
                  'center',
              }}
            >

              <ActivityIndicator
                size="large"
              />

              <Text
                style={[
                  shared.muted,
                  {
                    marginTop:
                      10,
                  },
                ]}
              >
                Loading today's Scripture...
              </Text>

            </View>

          ) : verses.length === 0 ? (

            <Text
              style={[
                shared.muted,
                {
                  paddingVertical:
                    25,

                  textAlign:
                    'center',
                },
              ]}
            >
              Today's Scripture is not available yet.
            </Text>

          ) : (

            <View
              style={
                styles.verseList
              }
            >

              {verses.map(
                verse => {

                  const cleanText =
                    String(
                      verse.verse_text ??
                      ''
                    )
                      .replace(
                        /^\u00B6\s*/,
                        ''
                      )
                      .trim();


                  return (
                    <View
                      key={
                        verse.verse_no
                      }
                      style={
                        styles.verseRow
                      }
                    >

                      <Text
                        style={[
                          styles.verseNumber,
                          {
                            fontSize:
                              13,
                          },
                        ]}
                      >
                        {
                          verse.verse_no
                        }
                      </Text>


                      <Text
                        selectable
                        style={[
                          styles.verseText,
                          {
                            fontSize:
                              17,

                            lineHeight:
                              27,
                          },
                        ]}
                      >
                        {cleanText}
                      </Text>

                    </View>
                  );

                }
              )}

            </View>

          )}

        </Card>


        {/* ================================================
            DAILY FLOW
        ================================================= */}

        {!chapterLoading &&
          verses.length > 0 && (

          <View
            style={{
              marginTop:
                14,
            }}
          >

            {hasNextAssignedChapter ? (

              <Pressable
                onPress={
                  goNextAssignedChapter
                }
                style={({
                  pressed,
                }) => ({
                  minHeight:
                    52,

                  borderRadius:
                    14,

                  borderWidth:
                    1,

                  borderColor:
                    '#BCD0C4',

                  backgroundColor:
                    '#F4F8F5',

                  alignItems:
                    'center',

                  justifyContent:
                    'center',

                  paddingHorizontal:
                    15,

                  opacity:
                    pressed
                      ? 0.75
                      : 1,
                })}
              >

                <Text
                  style={{
                    fontSize:
                      11,

                    fontWeight:
                      '900',

                    letterSpacing:
                      0.4,

                    color:
                      '#275D45',
                  }}
                >
                  NEXT READING
                </Text>

              </Pressable>

            ) : (

              <Pressable
                onPress={
                  openRespond
                }
                style={({
                  pressed,
                }) => ({
                  minHeight:
                    56,

                  borderRadius:
                    15,

                  backgroundColor:
                    '#275D45',

                  alignItems:
                    'center',

                  justifyContent:
                    'center',

                  paddingHorizontal:
                    16,

                  opacity:
                    pressed
                      ? 0.78
                      : 1,
                })}
              >

                <Text
                  style={{
                    fontSize:
                      13,

                    fontWeight:
                      '900',

                    letterSpacing:
                      0.6,

                    color:
                      '#FFFFFF',
                  }}
                >
                  RESPOND
                </Text>


                <Text
                  style={{
                    marginTop:
                      3,

                    fontSize:
                      8.5,

                    color:
                      '#DDEAE3',
                  }}
                >
                  Questions + Personal Reflection
                </Text>

              </Pressable>

            )}

          </View>

        )}

      </ScrollView>
    );

  }


`;


/* ==========================================================
   INSERT BEFORE FULL MY BIBLE RETURN
========================================================== */

src =
  src.slice(
    0,
    mainIndex
  ) +
  dailyUI +
  src.slice(
    mainIndex
  );


fs.writeFileSync(
  path,
  src,
  "utf8"
);


console.log("");
console.log(
  "DAILY DEVOTION FOCUSED READING INSTALLED"
);

console.log(
  "DAILY = VERSES FIRST + RESPOND"
);

console.log(
  "MY BIBLE = FULL NAVIGATION UNCHANGED"
);
