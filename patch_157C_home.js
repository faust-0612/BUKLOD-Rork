const fs = require("fs");

const path =
  "./src/app/(tabs)/home.tsx";

let source =
  fs.readFileSync(
    path,
    "utf8"
  );

function stop(message) {
  console.error("");
  console.error(
    "PATCH 157C STOPPED:"
  );
  console.error(message);
  process.exit(1);
}

/*
 * Add compact Top 5 component.
 * No StyleSheet.hairlineWidth dependency.
 */
if (
  !source.includes(
    "function HomeTopFiveCompact"
  )
) {
  source += `

/* PATCH_157C_HOME_TOP5 */
function HomeTopFiveCompact({
  weekly,
  weeklyLoading,
}: {
  weekly: any[];
  weeklyLoading: boolean;
}) {
  const [
    monthly,
    setMonthly,
  ] = useState<any[]>([]);

  const [
    monthlyLoading,
    setMonthlyLoading,
  ] = useState(true);

  useEffect(() => {
    let active = true;

    const loadMonthly =
      async () => {
        setMonthlyLoading(true);

        const {
          data,
          error,
        } =
          await (
            supabase as any
          ).rpc(
            'get_buklod_points_top5_v1',
            {
              p_period: 'month',
            }
          );

        if (!active) {
          return;
        }

        if (error) {
          console.warn(
            'Home monthly Top 5:',
            error.message
          );

          setMonthly([]);
        }
        else {
          setMonthly(
            (data ?? []).slice(
              0,
              5
            )
          );
        }

        setMonthlyLoading(false);
      };

    void loadMonthly();

    return () => {
      active = false;
    };
  }, []);

  const renderRows =
    (
      rows: any[],
      loading: boolean
    ) => {
      if (loading) {
        return (
          <ActivityIndicator
            color={colors.green}
          />
        );
      }

      if (!rows.length) {
        return (
          <Text style={shared.muted}>
            No leaderboard results yet.
          </Text>
        );
      }

      return (
        <View>
          {rows
            .slice(0, 5)
            .map(
              (
                item,
                index
              ) => {
                const memberName =
                  item.full_name ||
                  item.member_name ||
                  item.name ||
                  'BUKLOD Member';

                const points =
                  Number(
                    item.total_points ??
                    item.points ??
                    0
                  );

                return (
                  <View
                    key={
                      item.user_id ||
                      \`\${memberName}-\${index}\`
                    }
                    style={{
                      flexDirection:
                        'row',

                      alignItems:
                        'center',

                      paddingVertical:
                        7,

                      borderBottomWidth:
                        index <
                        Math.min(
                          rows.length,
                          5
                        ) - 1
                          ? 1
                          : 0,

                      borderBottomColor:
                        colors.line,
                    }}
                  >
                    <Text
                      style={{
                        width: 24,
                        fontSize: 11,
                        fontWeight:
                          '900',
                        color:
                          colors.greenDark,
                      }}
                    >
                      {index + 1}
                    </Text>

                    <Text
                      numberOfLines={1}
                      style={{
                        flex: 1,
                        fontSize: 12,
                        fontWeight:
                          '800',
                        color:
                          colors.text,
                      }}
                    >
                      {memberName}
                    </Text>

                    <Text
                      style={{
                        marginLeft: 8,
                        fontSize: 11,
                        fontWeight:
                          '900',
                        color:
                          colors.greenDark,
                      }}
                    >
                      {points.toLocaleString()}
                    </Text>
                  </View>
                );
              }
            )}
        </View>
      );
    };

  return (
    <Card>
      <Text style={shared.h2}>
        Top 5 Members
      </Text>

      <Text
        style={{
          marginTop: 12,
          marginBottom: 5,
          fontSize: 10,
          fontWeight: '900',
          letterSpacing: 0.4,
          color: colors.greenDark,
        }}
      >
        THIS WEEK
      </Text>

      {renderRows(
        weekly,
        weeklyLoading
      )}

      <View
        style={{
          height: 1,
          backgroundColor:
            colors.line,
          marginVertical: 12,
        }}
      />

      <Text
        style={{
          marginBottom: 5,
          fontSize: 10,
          fontWeight: '900',
          letterSpacing: 0.4,
          color: colors.greenDark,
        }}
      >
        THIS MONTH
      </Text>

      {renderRows(
        monthly,
        monthlyLoading
      )}
    </Card>
  );
}
`;
}


/*
 * Replace old weekly-only leaderboard section.
 */
const weekText =
  source.indexOf(
    "TOP BUKLOD THIS WEEK"
  );

const journeyText =
  source.indexOf(
    "YOUR JOURNEY",
    weekText
  );

if (weekText < 0) {
  stop(
    "TOP BUKLOD THIS WEEK was not found."
  );
}

if (journeyText < 0) {
  stop(
    "YOUR JOURNEY was not found."
  );
}

const weekSection =
  source.lastIndexOf(
    "<SectionTitle",
    weekText
  );

const journeySection =
  source.lastIndexOf(
    "<SectionTitle",
    journeyText
  );

if (
  weekSection < 0 ||
  journeySection < 0
) {
  stop(
    "Could not locate Home section boundaries."
  );
}

const replaceStart =
  source.lastIndexOf(
    "\n",
    weekSection
  ) + 1;

const replaceEnd =
  source.lastIndexOf(
    "\n",
    journeySection
  ) + 1;

const replacement =
`      <SectionTitle>
        TOP 5 MEMBERS
      </SectionTitle>

      <HomeTopFiveCompact
        weekly={
          homeTop.slice(0, 5)
        }
        weeklyLoading={
          topLoading
        }
      />

`;

source =
  source.slice(
    0,
    replaceStart
  ) +
  replacement +
  source.slice(
    replaceEnd
  );

fs.writeFileSync(
  path,
  source,
  "utf8"
);

console.log("");
console.log(
  "PATCH 157C HOME APPLIED"
);
