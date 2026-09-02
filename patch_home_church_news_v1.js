const fs =
  require("fs");

const path =
  "./src/app/(tabs)/home.tsx";

let src =
  fs.readFileSync(
    path,
    "utf8"
  );


function stop(message) {

  console.error("");
  console.error(
    "HOME PATCH STOPPED:"
  );
  console.error(message);

  process.exit(1);

}


/* ==========================================================
   IMPORT DIMENSIONS + LINKING
========================================================== */

const rnImportRegex =
  /import\s*\{([\s\S]*?)\}\s*from\s*['"]react-native['"];/;


const rnMatch =
  src.match(
    rnImportRegex
  );


if (!rnMatch) {

  stop(
    "React Native import not found."
  );

}


let rnImports =
  rnMatch[1];


for (
  const name
  of [
    "Dimensions",
    "Linking",
  ]
) {

  const regex =
    new RegExp(
      "\\b" +
      name +
      "\\b"
    );


  if (
    !regex.test(
      rnImports
    )
  ) {

    rnImports =
      "\n  " +
      name +
      "," +
      rnImports;

  }

}


src =
  src.replace(
    rnImportRegex,
`import {${rnImports}} from 'react-native';`
  );


/* ==========================================================
   INSERT NEWS IMMEDIATELY AFTER MISSION BULLETINS
========================================================== */

const bulletinAnchor =
  "<HomeMissionBulletins />";


if (
  !src.includes(
    bulletinAnchor
  )
) {

  stop(
    "HomeMissionBulletins anchor not found."
  );

}


if (
  !src.includes(
    "HOME_CHURCH_NEWS_CAROUSEL_V1"
  )
) {

  src =
    src.replace(
      bulletinAnchor,
`${bulletinAnchor}

      {/* HOME_CHURCH_NEWS_CAROUSEL_V1 */}
      <HomeChurchNewsCarousel />`
    );

}


/* ==========================================================
   REMOVE YOUR JOURNEY + CHURCH LIFE
   REPLACE WITH IMPORTANT REMINDER
========================================================== */

if (
  !src.includes(
    "HOME_IMPORTANT_REMINDER_V1"
  )
) {

  const journeyText =
    src.indexOf(
      "YOUR JOURNEY"
    );


  const churchLifeText =
    src.indexOf(
      "CHURCH LIFE",
      journeyText
    );


  if (
    journeyText < 0 ||
    churchLifeText < 0
  ) {

    stop(
      "YOUR JOURNEY / CHURCH LIFE area not found."
    );

  }


  const replaceStart =
    src.lastIndexOf(
      "<SectionTitle>",
      journeyText
    );


  const churchPressableStart =
    src.indexOf(
      "<Pressable",
      churchLifeText
    );


  const churchPressableEnd =
    src.indexOf(
      "</Pressable>",
      churchPressableStart
    );


  if (
    replaceStart < 0 ||
    churchPressableStart < 0 ||
    churchPressableEnd < 0
  ) {

    stop(
      "Could not isolate old Journey/Church Life block."
    );

  }


  const replaceEnd =
    churchPressableEnd +
    "</Pressable>".length;


  const replacement =
`
      {/* HOME_IMPORTANT_REMINDER_V1 */}
      <HomeImportantReminder />
`;


  src =
    src.slice(
      0,
      replaceStart
    ) +
    replacement +
    src.slice(
      replaceEnd
    );

}


/* ==========================================================
   ADD COMPONENTS BEFORE HomeMissionBulletins
========================================================== */

const componentAnchor =
  "function HomeMissionBulletins()";


if (
  !src.includes(
    componentAnchor
  )
) {

  stop(
    "HomeMissionBulletins function not found."
  );

}


if (
  !src.includes(
    "HOME_NEWS_COMPONENTS_V1"
  )
) {

  const components =
`

/* ============================================================
   HOME_NEWS_COMPONENTS_V1
============================================================ */


type HomeChurchNewsItem = {

  id: string;

  source_name: string;

  source_domain: string;

  original_title: string;

  english_summary:
    string | null;

  tagalog_title:
    string | null;

  tagalog_summary:
    string | null;

  original_url: string;

  published_at:
    string | null;

  fetched_at:
    string;
};


type HomeImportantReminderRow = {

  slot: string;

  title: string;

  body: string;

  is_active: boolean;

  starts_at: string;

  ends_at:
    string | null;

  updated_at: string;
};


function homeNewsAge(
  value:
    string |
    null
) {

  if (!value) {
    return 'Latest update';
  }


  const time =
    new Date(
      value
    ).getTime();


  if (
    !Number.isFinite(
      time
    )
  ) {
    return 'Latest update';
  }


  const diff =
    Math.max(
      0,
      Date.now() -
      time
    );


  const minutes =
    Math.floor(
      diff /
      60000
    );


  if (
    minutes <
    60
  ) {

    return minutes <= 1
      ? 'Just now'
      : minutes + ' min ago';

  }


  const hours =
    Math.floor(
      minutes /
      60
    );


  if (
    hours <
    24
  ) {

    return hours === 1
      ? '1 hour ago'
      : hours + ' hours ago';

  }


  const days =
    Math.floor(
      hours /
      24
    );


  if (
    days <
    7
  ) {

    return days === 1
      ? 'Yesterday'
      : days + ' days ago';

  }


  return new Date(
    value
  ).toLocaleDateString();

}


function HomeChurchNewsCarousel() {

  const [
    items,
    setItems,
  ] =
    useState<
      HomeChurchNewsItem[]
    >([]);


  const [
    loading,
    setLoading,
  ] =
    useState(true);


  const [
    language,
    setLanguage,
  ] =
    useState<
      'fil' |
      'en'
    >(
      'fil'
    );


  const [
    activeIndex,
    setActiveIndex,
  ] =
    useState(0);


  const cardWidth =
    Math.max(
      280,
      Dimensions
        .get('window')
        .width -
        36
    );


  useEffect(
    () => {

      let active =
        true;


      const loadCached =
        async () => {

          const {
            data,
            error,
          } =
            await supabase
              .from(
                'church_news_items'
              )
              .select(
                'id,source_name,source_domain,original_title,english_summary,tagalog_title,tagalog_summary,original_url,published_at,fetched_at'
              )
              .eq(
                'is_published',
                true
              )
              .order(
                'published_at',
                {
                  ascending:
                    false,
                }
              )
              .limit(
                10
              );


          if (!active) {
            return;
          }


          if (error) {

            console.warn(
              'Home Church News:',
              error.message
            );

            return;

          }


          setItems(
            (
              data ??
              []
            ) as HomeChurchNewsItem[]
          );

        };


      const run =
        async () => {

          setLoading(
            true
          );


          await loadCached();


          /*
           * Background refresh.
           * The Edge Function has its own
           * 3-hour throttle so many Home
           * opens do not create many AI calls.
           */
          try {

            const {
              error:
                syncError,
            } =
              await supabase
                .functions
                .invoke(
                  'sync-church-news',
                  {
                    body: {
                      source:
                        'home',
                    },
                  }
                );


            if (
              !syncError &&
              active
            ) {

              await loadCached();

            }

          }
          catch {
            // Cached news remains usable.
          }


          if (active) {

            setLoading(
              false
            );

          }

        };


      void run();


      return () => {

        active =
          false;

      };

    },
    []
  );


  return (

    <View
      style={{
        marginTop:
          14,

        marginBottom:
          6,
      }}
    >

      <View
        style={{
          flexDirection:
            'row',

          alignItems:
            'center',

          justifyContent:
            'space-between',

          marginBottom:
            8,
        }}
      >

        <View
          style={{
            flex:
              1,

            paddingRight:
              10,
          }}
        >

          <Text
            style={{
              fontSize:
                11,

              fontWeight:
                '900',

              letterSpacing:
                0.8,

              color:
                colors.greenDark,
            }}
          >
            CHURCH NEWS & UPDATES
          </Text>


          <Text
            style={[
              shared.muted,
              {
                marginTop:
                  2,

                fontSize:
                  9,
              },
            ]}
          >
            Baptist • Missions • Evangelical
          </Text>

        </View>


        <View
          style={{
            flexDirection:
              'row',

            padding:
              3,

            borderRadius:
              10,

            backgroundColor:
              '#EEF3F0',
          }}
        >

          <Pressable
            onPress={() =>
              setLanguage(
                'fil'
              )
            }
            style={{
              paddingHorizontal:
                8,

              paddingVertical:
                5,

              borderRadius:
                8,

              backgroundColor:
                language ===
                  'fil'
                  ? colors.greenDark
                  : 'transparent',
            }}
          >

            <Text
              style={{
                fontSize:
                  8,

                fontWeight:
                  '900',

                color:
                  language ===
                    'fil'
                    ? '#FFFFFF'
                    : colors.muted,
              }}
            >
              TAGALOG
            </Text>

          </Pressable>


          <Pressable
            onPress={() =>
              setLanguage(
                'en'
              )
            }
            style={{
              paddingHorizontal:
                8,

              paddingVertical:
                5,

              borderRadius:
                8,

              backgroundColor:
                language ===
                  'en'
                  ? colors.greenDark
                  : 'transparent',
            }}
          >

            <Text
              style={{
                fontSize:
                  8,

                fontWeight:
                  '900',

                color:
                  language ===
                    'en'
                    ? '#FFFFFF'
                    : colors.muted,
              }}
            >
              ORIGINAL
            </Text>

          </Pressable>

        </View>

      </View>


      {loading &&
        items.length === 0 ? (

        <Card>

          <ActivityIndicator
            color={
              colors.green
            }
          />

          <Text
            style={[
              shared.muted,
              {
                marginTop:
                  8,

                textAlign:
                  'center',
              },
            ]}
          >
            Loading church news...
          </Text>

        </Card>

      ) : items.length === 0 ? (

        <Card>

          <Text
            style={
              shared.h2
            }
          >
            Church News is being prepared.
          </Text>


          <Text
            style={[
              shared.muted,
              {
                marginTop:
                  5,
              },
            ]}
          >
            Latest Baptist and evangelical updates will appear here automatically.
          </Text>

        </Card>

      ) : (

        <>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={
              false
            }

            decelerationRate="fast"

            snapToInterval={
              cardWidth +
              10
            }

            snapToAlignment="start"

            disableIntervalMomentum

            onMomentumScrollEnd={
              event => {

                const x =
                  event
                    .nativeEvent
                    .contentOffset
                    .x;


                const next =
                  Math.round(
                    x /
                    (
                      cardWidth +
                      10
                    )
                  );


                setActiveIndex(
                  Math.max(
                    0,
                    Math.min(
                      items.length -
                        1,
                      next
                    )
                  )
                );

              }
            }

            contentContainerStyle={{
              gap:
                10,
            }}
          >

            {items.map(
              item => {

                const title =
                  language ===
                    'fil'
                    ? (
                        item
                          .tagalog_title ||
                        item
                          .original_title
                      )
                    : item
                        .original_title;


                const summary =
                  language ===
                    'fil'
                    ? (
                        item
                          .tagalog_summary ||
                        item
                          .english_summary
                      )
                    : item
                        .english_summary;


                return (

                  <View
                    key={
                      item.id
                    }

                    style={{
                      width:
                        cardWidth,

                      minHeight:
                        205,

                      borderWidth:
                        1,

                      borderColor:
                        colors.line,

                      borderRadius:
                        17,

                      backgroundColor:
                        colors.white,

                      padding:
                        15,
                    }}
                  >

                    <View
                      style={{
                        flexDirection:
                          'row',

                        alignItems:
                          'center',

                        justifyContent:
                          'space-between',

                        gap:
                          10,
                      }}
                    >

                      <Text
                        style={{
                          flex:
                            1,

                          color:
                            colors.green,

                          fontSize:
                            9,

                          fontWeight:
                            '900',

                          letterSpacing:
                            0.6,
                        }}
                      >
                        {
                          item
                            .source_name
                            .toUpperCase()
                        }
                      </Text>


                      <Text
                        style={{
                          fontSize:
                            8.5,

                          color:
                            colors.muted,
                        }}
                      >
                        {
                          homeNewsAge(
                            item
                              .published_at
                          )
                        }
                      </Text>

                    </View>


                    <Text
                      style={{
                        marginTop:
                          10,

                        fontSize:
                          16,

                        lineHeight:
                          21,

                        fontWeight:
                          '900',

                        color:
                          colors.text,
                      }}
                    >
                      {title}
                    </Text>


                    {!!summary && (

                      <Text
                        numberOfLines={
                          4
                        }
                        style={{
                          marginTop:
                            8,

                          fontSize:
                            11.5,

                          lineHeight:
                            17,

                          color:
                            colors.text,
                        }}
                      >
                        {summary}
                      </Text>

                    )}


                    <View
                      style={{
                        flex:
                          1,
                      }}
                    />


                    <Pressable
                      onPress={() => {

                        void Linking
                          .openURL(
                            item
                              .original_url
                          )
                          .catch(
                            () => {}
                          );

                      }}

                      style={{
                        marginTop:
                          12,

                        alignSelf:
                          'flex-start',

                        flexDirection:
                          'row',

                        alignItems:
                          'center',

                        gap:
                          5,
                      }}
                    >

                      <Text
                        style={{
                          fontSize:
                            9,

                          fontWeight:
                            '900',

                          color:
                            colors.greenDark,
                        }}
                      >
                        BASAHIN ANG ORIGINAL
                      </Text>


                      <MaterialCommunityIcons
                        name="open-in-new"
                        size={
                          13
                        }
                        color={
                          colors.greenDark
                        }
                      />

                    </Pressable>

                  </View>

                );

              }
            )}

          </ScrollView>


          <View
            style={{
              marginTop:
                8,

              flexDirection:
                'row',

              justifyContent:
                'center',

              gap:
                5,
            }}
          >

            {items.map(
              (
                item,
                index
              ) => (

                <View
                  key={
                    'dot-' +
                    item.id
                  }
                  style={{
                    width:
                      index ===
                        activeIndex
                        ? 15
                        : 6,

                    height:
                      6,

                    borderRadius:
                      99,

                    backgroundColor:
                      index ===
                        activeIndex
                        ? colors.greenDark
                        : colors.line,
                  }}
                />

              )
            )}

          </View>


          <Text
            style={{
              marginTop:
                5,

              textAlign:
                'center',

              fontSize:
                8,

              color:
                colors.muted,
            }}
          >
            Swipe left or right for the next update.
          </Text>

        </>

      )}

    </View>

  );

}


function HomeImportantReminder() {

  const {
    hasRole,
  } =
    useAuth();


  const [
    reminder,
    setReminder,
  ] =
    useState<
      HomeImportantReminderRow |
      null
    >(
      null
    );


  useEffect(
    () => {

      let active =
        true;


      const load =
        async () => {

          const {
            data,
            error,
          } =
            await supabase
              .from(
                'home_important_reminders'
              )
              .select(
                'slot,title,body,is_active,starts_at,ends_at,updated_at'
              )
              .eq(
                'slot',
                'home_primary'
              )
              .maybeSingle();


          if (
            !active ||
            error ||
            !data
          ) {
            return;
          }


          const now =
            Date.now();


          const starts =
            new Date(
              data.starts_at
            ).getTime();


          const ends =
            data.ends_at
              ? new Date(
                  data.ends_at
                ).getTime()
              : null;


          const visible =
            data.is_active &&
            starts <=
              now &&
            (
              ends ===
                null ||
              ends >
                now
            );


          setReminder(
            visible
              ? data as HomeImportantReminderRow
              : null
          );

        };


      void load();


      return () => {

        active =
          false;

      };

    },
    []
  );


  if (
    !reminder &&
    !hasRole(
      'system_admin'
    )
  ) {

    return null;

  }


  return (

    <View
      style={{
        marginTop:
          16,
      }}
    >

      <SectionTitle>
        IMPORTANT REMINDER
      </SectionTitle>


      <Card>

        {reminder ? (

          <View
            style={{
              borderLeftWidth:
                4,

              borderLeftColor:
                colors.greenDark,

              paddingLeft:
                11,
            }}
          >

            <Text
              style={{
                fontSize:
                  15,

                lineHeight:
                  20,

                fontWeight:
                  '900',

                color:
                  colors.text,
              }}
            >
              {
                reminder
                  .title
              }
            </Text>


            <Text
              style={{
                marginTop:
                  7,

                fontSize:
                  12,

                lineHeight:
                  18,

                color:
                  colors.text,
              }}
            >
              {
                reminder
                  .body
              }
            </Text>

          </View>

        ) : (

          <Text
            style={
              shared.muted
            }
          >
            No active reminder.
          </Text>

        )}


        {hasRole(
          'system_admin'
        ) && (

          <Pressable
            onPress={() =>
              router.push(
                '/admin/home-reminder' as any
              )
            }

            style={{
              marginTop:
                13,

              paddingTop:
                11,

              borderTopWidth:
                1,

              borderTopColor:
                colors.line,

              flexDirection:
                'row',

              alignItems:
                'center',

              justifyContent:
                'space-between',
            }}
          >

            <Text
              style={{
                fontSize:
                  9,

                fontWeight:
                  '900',

                color:
                  colors.greenDark,
              }}
            >
              EDIT IMPORTANT REMINDER
            </Text>


            <MaterialCommunityIcons
              name="pencil-outline"
              size={
                16
              }
              color={
                colors.greenDark
              }
            />

          </Pressable>

        )}

      </Card>

    </View>

  );

}


`;


  src =
    src.replace(
      componentAnchor,
      components +
      componentAnchor
    );

}


fs.writeFileSync(
  path,
  src,
  "utf8"
);


console.log(
  "HOME NEWS CAROUSEL + IMPORTANT REMINDER PATCHED"
);

