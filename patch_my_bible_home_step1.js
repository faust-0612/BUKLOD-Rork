const fs = require("fs");

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
    "MY BIBLE HOME PATCH STOPPED:"
  );
  console.error(message);
  process.exit(1);
}


if (
  src.includes(
    "MY_BIBLE_HOME_SPLIT_V1"
  )
) {
  console.log(
    "MY BIBLE HOME SPLIT ALREADY INSTALLED"
  );

  process.exit(0);
}


/*
 * Replace the existing
 * HomeDailyBayanihanPair only.
 *
 * Main HomeScreen keeps calling the
 * same component, so surrounding
 * sections are untouched.
 */

const start =
  src.indexOf(
    "function HomeDailyBayanihanPair() {"
  );

const end =
  src.indexOf(
    "function HomeDailyBibleStrip() {",
    start
  );


if (
  start < 0 ||
  end < 0
) {
  stop(
    "HomeDailyBayanihanPair boundaries not found."
  );
}


const replacement =
String.raw`function HomeDailyBayanihanPair() {
  /* MY_BIBLE_HOME_SPLIT_V1 */

  const [
    reading,
    setReading,
  ] =
    useState<{
      bible_reference:
        string;

      chapters_today:
        number;

      reading_date?:
        string;
    } | null>(
      null
    );


  const [
    bayanihanBalance,
    setBayanihanBalance,
  ] =
    useState<
      number |
      null
    >(
      null
    );


  const [
    readingLoading,
    setReadingLoading,
  ] =
    useState(true);


  const [
    balanceLoading,
    setBalanceLoading,
  ] =
    useState(true);


  useEffect(
    () => {

      let active =
        true;


      const load =
        async () => {

          try {

            const [
              bibleResult,
              balanceResult,
            ] =
              await Promise.all([
                (
                  supabase as any
                ).rpc(
                  'get_automatic_bible_today'
                ),

                (
                  supabase as any
                ).rpc(
                  'get_my_bayanihan_current_balance_v1'
                ),
              ]);


            if (!active) {
              return;
            }


            const bibleRaw =
              Array.isArray(
                bibleResult.data
              )
                ? bibleResult
                    .data[0] ??
                  null
                : bibleResult
                    .data ??
                  null;


            if (bibleRaw) {

              setReading({
                bible_reference:
                  String(
                    bibleRaw
                      .bible_reference ??
                    ''
                  ),

                chapters_today:
                  Number(
                    bibleRaw
                      .chapters_today ??
                    1
                  ),

                reading_date:
                  String(
                    bibleRaw
                      .reading_date ??
                    ''
                  ),
              });

            }
            else {

              setReading(
                null
              );

            }


            if (
              balanceResult.error
            ) {

              console.warn(
                'Home Bayanihan balance:',
                balanceResult
                  .error
                  .message
              );

              setBayanihanBalance(
                null
              );

            }
            else {

              const balanceRaw =
                Array.isArray(
                  balanceResult.data
                )
                  ? balanceResult
                      .data[0] ??
                    null
                  : balanceResult
                      .data;


              const value =
                balanceRaw &&
                typeof balanceRaw ===
                  'object'
                  ? (
                      balanceRaw
                        .current_balance ??
                      balanceRaw
                        .balance ??
                      0
                    )
                  : (
                      balanceRaw ??
                      0
                    );


              const numeric =
                Number(
                  value
                );


              setBayanihanBalance(
                Number.isFinite(
                  numeric
                )
                  ? numeric
                  : 0
              );

            }

          }
          catch (
            error: any
          ) {

            if (!active) {
              return;
            }


            console.warn(
              'Home Daily/Bayanihan:',
              error?.message ??
              error
            );

          }
          finally {

            if (active) {
              setReadingLoading(
                false
              );

              setBalanceLoading(
                false
              );
            }

          }

        };


      void load();


      return () => {
        active =
          false;
      };

    },
    []
  );


  const money =
    (
      value:
        number
    ) => {

      return Number(
        value ||
        0
      )
        .toLocaleString(
          'en-PH',
          {
            minimumFractionDigits:
              2,

            maximumFractionDigits:
              2,
          }
        );

    };


  const openDailyDevotion =
    () => {

      if (
        reading
          ?.reading_date
      ) {

        router.push({
          pathname:
            '/bible/read',

          params: {
            source:
              'daily_plan',

            assignedDate:
              reading
                .reading_date,
          },
        } as any);

        return;

      }


      router.push(
        '/bible' as any
      );

    };


  const openMyBible =
    () => {

      router.push({
        pathname:
          '/bible/read',

        params: {
          source:
            'my_bible',
        },
      } as any);

    };


  return (
    <View
      style={{
        flexDirection:
          'row',

        gap:
          8,

        alignItems:
          'stretch',

        marginTop:
          3,

        marginBottom:
          0,

        minHeight:
          112,
      }}
    >

      {/* ================================================
          LEFT HALF:
          DAILY DEVOTION + MY BIBLE
      ================================================= */}

      <View
        style={{
          flex:
            1,

          gap:
            6,
        }}
      >

        {/* DAILY DEVOTION */}

        <Pressable
          onPress={
            openDailyDevotion
          }
          accessibilityRole="button"
          accessibilityLabel="Open Daily Devotion"
          style={({
            pressed,
          }) => ({
            flex:
              1,

            opacity:
              pressed
                ? 0.8
                : 1,
          })}
        >

          <View
            style={{
              flex:
                1,

              minHeight:
                53,

              borderWidth:
                1,

              borderColor:
                colors.line,

              borderRadius:
                15,

              backgroundColor:
                colors.white,

              paddingHorizontal:
                9,

              paddingVertical:
                7,
            }}
          >

            <View
              style={{
                flexDirection:
                  'row',

                alignItems:
                  'center',

                gap:
                  5,
              }}
            >

              <MaterialCommunityIcons
                name="book-open-page-variant-outline"
                size={16}
                color={
                  colors.greenDark
                }
              />

              <Text
                numberOfLines={1}
                style={{
                  flex:
                    1,

                  fontSize:
                    9,

                  fontWeight:
                    '900',

                  color:
                    colors.greenDark,

                  letterSpacing:
                    0.35,
                }}
              >
                DAILY DEVOTION
              </Text>

            </View>


            <Text
              numberOfLines={
                1
              }
              style={{
                marginTop:
                  4,

                fontSize:
                  11,

                lineHeight:
                  14,

                fontWeight:
                  '900',

                color:
                  colors.text,
              }}
            >
              {
                readingLoading
                  ? 'Loading...'
                  : reading
                      ?.bible_reference ||
                    'Today’s Reading'
              }
            </Text>


            <Text
              numberOfLines={
                1
              }
              style={{
                marginTop:
                  2,

                fontSize:
                  8.5,

                color:
                  colors.muted,
              }}
            >
              {
                reading
                  ? `${reading.chapters_today} ${
                      reading.chapters_today ===
                      1
                        ? 'chapter'
                        : 'chapters'
                    } today`
                  : 'Open devotion'
              }
            </Text>

          </View>

        </Pressable>


        {/* MY BIBLE */}

        <Pressable
          onPress={
            openMyBible
          }
          accessibilityRole="button"
          accessibilityLabel="Open My Bible"
          style={({
            pressed,
          }) => ({
            flex:
              1,

            opacity:
              pressed
                ? 0.8
                : 1,
          })}
        >

          <View
            style={{
              flex:
                1,

              minHeight:
                53,

              borderWidth:
                1,

              borderColor:
                colors.line,

              borderRadius:
                15,

              backgroundColor:
                '#F7FBF8',

              paddingHorizontal:
                9,

              paddingVertical:
                7,

              justifyContent:
                'center',
            }}
          >

            <View
              style={{
                flexDirection:
                  'row',

                alignItems:
                  'center',

                gap:
                  6,
              }}
            >

              <MaterialCommunityIcons
                name="book-heart-outline"
                size={17}
                color={
                  colors.greenDark
                }
              />


              <View
                style={{
                  flex:
                    1,
                }}
              >

                <Text
                  style={{
                    fontSize:
                      10,

                    fontWeight:
                      '900',

                    color:
                      colors.greenDark,

                    letterSpacing:
                      0.6,
                  }}
                >
                  MY BIBLE
                </Text>


                <Text
                  numberOfLines={
                    1
                  }
                  style={{
                    marginTop:
                      1,

                    fontSize:
                      8.5,

                    color:
                      colors.muted,
                  }}
                >
                  Read • Highlight • Notes
                </Text>

              </View>


              <MaterialCommunityIcons
                name="chevron-right"
                size={18}
                color={
                  colors.greenDark
                }
              />

            </View>

          </View>

        </Pressable>

      </View>


      {/* ================================================
          RIGHT HALF:
          BUKLOD BAYANIHAN
      ================================================= */}

      <Pressable
        onPress={() =>
          router.push(
            '/bayanihan' as any
          )
        }
        accessibilityRole="button"
        accessibilityLabel="Open BUKLOD Bayanihan"
        style={({
          pressed,
        }) => ({
          flex:
            1,

          opacity:
            pressed
              ? 0.82
              : 1,
        })}
      >

        <View
          style={{
            minHeight:
              112,

            flex:
              1,

            borderWidth:
              1,

            borderColor:
              colors.line,

            borderRadius:
              16,

            backgroundColor:
              colors.white,

            padding:
              10,
          }}
        >

          <View
            style={{
              flexDirection:
                'row',

              alignItems:
                'center',

              gap:
                6,
            }}
          >

            <MaterialCommunityIcons
              name="hand-heart-outline"
              size={18}
              color={
                colors.greenDark
              }
            />


            <Text
              style={{
                flex:
                  1,

                fontSize:
                  10,

                fontWeight:
                  '900',

                color:
                  colors.greenDark,

                letterSpacing:
                  0.4,
              }}
            >
              BUKLOD BAYANIHAN
            </Text>

          </View>


          <Text
            style={{
              marginTop:
                5,

              fontSize:
                9,

              fontWeight:
                '800',

              color:
                colors.muted,

              letterSpacing:
                0.3,
            }}
          >
            CURRENT BALANCE
          </Text>


          <Text
            numberOfLines={
              1
            }
            adjustsFontSizeToFit
            minimumFontScale={
              0.75
            }
            style={{
              marginTop:
                3,

              fontSize:
                18,

              lineHeight:
                23,

              fontWeight:
                '900',

              color:
                colors.text,
            }}
          >
            {
              balanceLoading
                ? '...'
                : bayanihanBalance ===
                    null
                  ? 'Unavailable'
                  : `₱${money(
                      bayanihanBalance
                    )}`
            }
          </Text>


          <Text
            style={{
              marginTop:
                5,

              fontSize:
                9,

              lineHeight:
                12,

              color:
                colors.muted,
            }}
          >
            Reference only • Not personal cash.
          </Text>

        </View>

      </Pressable>

    </View>
  );
}


`;


src =
  src.slice(
    0,
    start
  ) +
  replacement +
  src.slice(
    end
  );


fs.writeFileSync(
  path,
  src,
  "utf8"
);


console.log(
  "MY BIBLE HOME SPLIT INSTALLED"
);

console.log(
  "DAILY DEVOTION + MY BIBLE = SAME HEIGHT AS BAYANIHAN"
);
