const fs = require("fs");

function stop(message) {
  console.error("");
  console.error("PATCH 157 STOPPED:");
  console.error(message);
  process.exit(1);
}


/* ============================================================
   ADMIN BAYANIHAN
   ============================================================ */

const adminPath =
  "./src/app/admin/bayanihan.tsx";

let admin =
  fs.readFileSync(
    adminPath,
    "utf8"
  );


/* ---------- STATES ---------- */

const leaderState =
`  const [leaders, setLeaders] =
    useState<LeaderRow[]>([]);`;

if (
  !admin.includes(
    "monthlyLeaders"
  )
) {
  if (
    !admin.includes(
      leaderState
    )
  ) {
    stop(
      "Admin leaderboard state anchor missing."
    );
  }

  admin =
    admin.replace(
      leaderState,
`${leaderState}

  const [monthlyLeaders, setMonthlyLeaders] =
    useState<LeaderRow[]>([]);

  const [editingClusterId, setEditingClusterId] =
    useState('');

  const [savedClusterId, setSavedClusterId] =
    useState('');

  const [memberSearchApplied, setMemberSearchApplied] =
    useState('');`
    );
}


/* ---------- OVERALL RPC ---------- */

admin =
  admin.replace(
    "'admin_bayanihan_leaderboard_v2'",
    "'admin_bayanihan_leaderboard_v3'"
  );

admin =
  admin.replace(
`          p_limit: 50,`,
`          p_period: 'overall',
          p_limit: 5,`
  );


/* ---------- MONTHLY RPC ---------- */

if (
  !admin.includes(
    "monthlyLeaderData"
  )
) {
  const promiseEnd =
`    ]);

    if (clusterError) {`;

  if (
    !admin.includes(
      promiseEnd
    )
  ) {
    stop(
      "Admin load Promise anchor missing."
    );
  }

  admin =
    admin.replace(
      promiseEnd,
`    ]);

    const {
      data: monthlyLeaderData,
      error: monthlyLeaderError,
    } =
      await (supabase as any).rpc(
        'admin_bayanihan_leaderboard_v3',
        {
          p_period: 'month',
          p_limit: 5,
        }
      );

    if (clusterError) {`
    );
}


/* ---------- MONTH ERROR ---------- */

if (
  !admin.includes(
    "'Monthly Bayanihan Leaderboard'"
  )
) {
  const nextClustersAnchor =
`    const nextClusters =`;

  const pos =
    admin.indexOf(
      nextClustersAnchor
    );

  if (pos < 0) {
    stop(
      "nextClusters anchor missing."
    );
  }

  const errorBlock =
`    if (monthlyLeaderError) {
      Alert.alert(
        'Monthly Bayanihan Leaderboard',
        monthlyLeaderError.message
      );
    }

`;

  admin =
    admin.slice(0, pos) +
    errorBlock +
    admin.slice(pos);
}


/* ---------- STORE MONTHLY ---------- */

const setLeadersBlock =
`    setLeaders(
      (leaderData ?? []) as LeaderRow[]
    );`;

if (
  !admin.includes(
    "setMonthlyLeaders("
  )
) {
  if (
    !admin.includes(
      setLeadersBlock
    )
  ) {
    stop(
      "setLeaders anchor missing."
    );
  }

  admin =
    admin.replace(
      setLeadersBlock,
`${setLeadersBlock}

    setMonthlyLeaders(
      (monthlyLeaderData ?? []) as LeaderRow[]
    );`
    );
}


/* ---------- SEARCH ONLY AFTER SEARCH ---------- */

const filterStart =
  admin.indexOf(
    "  const filteredMembers ="
  );

const selectedStart =
  admin.indexOf(
    "  const selectedMember =",
    filterStart
  );

if (
  filterStart < 0 ||
  selectedStart < 0
) {
  stop(
    "Member filter anchors missing."
  );
}

const filterReplacement =
`  const filteredMembers =
    useMemo(() => {
      const query =
        memberSearchApplied
          .trim()
          .toLowerCase();

      if (!query) {
        return [];
      }

      return members
        .filter((row) =>
          [
            row.full_name,
            row.church_name,
            row.group_name,
          ]
            .join(' ')
            .toLowerCase()
            .includes(query)
        )
        .slice(0, 20);
    }, [
      members,
      memberSearchApplied,
    ]);

`;

admin =
  admin.slice(
    0,
    filterStart
  ) +
  filterReplacement +
  admin.slice(
    selectedStart
  );


/* ---------- SAVE/SAVED CLUSTER ---------- */

const saveFunctionPos =
  admin.indexOf(
    "  const saveClusterReward ="
  );

const firstLoadAfterSave =
  admin.indexOf(
    "              await load();",
    saveFunctionPos
  );

if (
  firstLoadAfterSave < 0
) {
  stop(
    "Cluster save completion anchor missing."
  );
}

if (
  !admin
    .slice(
      saveFunctionPos,
      firstLoadAfterSave
    )
    .includes(
      "setSavedClusterId"
    )
) {
  admin =
    admin.slice(
      0,
      firstLoadAfterSave
    ) +
`              setSavedClusterId(
                row.track_id
              );

              setEditingClusterId(
                ''
              );

` +
    admin.slice(
      firstLoadAfterSave
    );
}


/* ---------- COMPACT LEADERBOARD HELPER ---------- */

if (
  !admin.includes(
    "const renderLeaderboard ="
  )
) {
  const returnAnchor =
`  return (
    <AdminGate>`;

  if (
    !admin.includes(
      returnAnchor
    )
  ) {
    stop(
      "Admin return anchor missing."
    );
  }

  const helper =
`  const renderLeaderboard =
    (
      rows: LeaderRow[],
      title: string,
      subtitle: string
    ) => (
      <Card>
        <Text style={styles.infoTitle}>
          {title}
        </Text>

        <Text style={styles.infoText}>
          {subtitle}
        </Text>

        {rows.length === 0 ? (
          <Text
            style={[
              shared.muted,
              {
                marginTop: 10,
              },
            ]}
          >
            No earned Bayanihan yet.
          </Text>
        ) : (
          rows
            .slice(0, 5)
            .map((row, index) => (
              <View
                key={row.user_id}
                style={styles.compactLeader}
              >
                <Text
                  style={styles.rankText}
                >
                  {index + 1}
                </Text>

                <Text
                  style={styles.compactLeaderName}
                  numberOfLines={1}
                >
                  {row.full_name ||
                    'BUKLOD Member'}
                </Text>

                <Text
                  style={styles.compactLeaderAmount}
                >
                  {money(
                    row.total_earned
                  )}
                </Text>
              </View>
            ))
        )}
      </Card>
    );


`;

  admin =
    admin.replace(
      returnAnchor,
      helper +
      returnAnchor
    );
}


/* ---------- CLUSTER UI ---------- */

const clusterStart =
  admin.indexOf(
    "        {clusters.map((row) => {"
  );

const rewardSection =
  admin.indexOf(
`        <SectionTitle>
          REWARD MEMBER`,
    clusterStart
  );

if (
  clusterStart < 0 ||
  rewardSection < 0
) {
  stop(
    "Cluster UI anchors missing."
  );
}

const clusterUi =
`        {clusters.map((row) => {
          const mixed =
            Number(row.min_reward) !==
            Number(row.max_reward);

          const editing =
            editingClusterId ===
            row.track_id;

          const saved =
            savedClusterId ===
            row.track_id;

          return (
            <Card key={row.track_id}>
              <View
                style={styles.clusterLine}
              >
                <Text
                  style={
                    styles.clusterOneLine
                  }
                  numberOfLines={1}
                >
                  {row.track_title}
                  {'  |  '}
                  {row.lesson_count}{' '}
                  lesson
                  {Number(
                    row.lesson_count
                  ) === 1
                    ? ''
                    : 's'}
                  {'  |  '}
                  {mixed
                    ? 'Mixed rewards'
                    : \`\${money(
                        row.min_reward
                      )} / lesson\`}
                </Text>

                <Pressable
                  onPress={() => {
                    if (editing) {
                      setEditingClusterId(
                        ''
                      );
                    }
                    else {
                      setEditingClusterId(
                        row.track_id
                      );

                      setSavedClusterId(
                        ''
                      );
                    }
                  }}
                  style={
                    styles.smallAction
                  }
                >
                  <Text
                    style={
                      styles.smallActionText
                    }
                  >
                    {editing
                      ? 'CANCEL'
                      : saved
                        ? 'SAVED'
                        : 'EDIT REWARD'}
                  </Text>
                </Pressable>
              </View>

              {editing && (
                <View
                  style={
                    styles.rewardEditRow
                  }
                >
                  <TextInput
                    style={[
                      styles.input,
                      styles.rewardEditInput,
                    ]}
                    value={
                      clusterAmounts[
                        row.track_id
                      ] ?? ''
                    }
                    onChangeText={(
                      value
                    ) =>
                      setClusterAmounts(
                        current => ({
                          ...current,
                          [row.track_id]:
                            value,
                        })
                      )
                    }
                    placeholder="Reward"
                    keyboardType="decimal-pad"
                    editable={
                      busyKey !==
                      \`cluster:\${row.track_id}\`
                    }
                  />

                  <Pressable
                    disabled={
                      busyKey ===
                      \`cluster:\${row.track_id}\`
                    }
                    onPress={() =>
                      saveClusterReward(
                        row
                      )
                    }
                    style={
                      styles.smallAction
                    }
                  >
                    <Text
                      style={
                        styles.smallActionText
                      }
                    >
                      {busyKey ===
                      \`cluster:\${row.track_id}\`
                        ? 'SAVING...'
                        : 'SAVE'}
                    </Text>
                  </Pressable>
                </View>
              )}
            </Card>
          );
        })}

`;

admin =
  admin.slice(
    0,
    clusterStart
  ) +
  clusterUi +
  admin.slice(
    rewardSection
  );


/* ---------- REWARD MEMBER SEARCH CARD ---------- */

const rewardCardStart =
  admin.indexOf(
`        <Card>
          <Text style={styles.infoTitle}>
            All verified members are qualified`
  );

const selectedMemberAnchor =
  admin.indexOf(
    "        {!!selectedMember && (",
    rewardCardStart
  );

if (
  rewardCardStart < 0 ||
  selectedMemberAnchor < 0
) {
  stop(
    "Reward Member card anchors missing."
  );
}

const rewardSearchCard =
`        <Card>
          <Text style={styles.infoTitle}>
            All verified members are qualified
          </Text>

          <Text style={styles.infoText}>
            Search for a verified member to issue a Bayanihan reward.
          </Text>

          <View
            style={styles.searchLine}
          >
            <TextInput
              style={[
                styles.input,
                styles.searchInput,
              ]}
              placeholder="Search member, Local, or Group..."
              value={memberSearch}
              returnKeyType="search"
              onChangeText={(value) => {
                setMemberSearch(
                  value
                );

                if (!value.trim()) {
                  setMemberSearchApplied(
                    ''
                  );
                }
              }}
              onSubmitEditing={() =>
                setMemberSearchApplied(
                  memberSearch.trim()
                )
              }
            />

            <Pressable
              onPress={() =>
                setMemberSearchApplied(
                  memberSearch.trim()
                )
              }
              style={
                styles.smallAction
              }
            >
              <Text
                style={
                  styles.smallActionText
                }
              >
                SEARCH
              </Text>
            </Pressable>
          </View>

          {!!memberSearchApplied && (
            <View
              style={styles.memberList}
            >
              {filteredMembers.length ===
              0 ? (
                <Text
                  style={shared.muted}
                >
                  No verified member found.
                </Text>
              ) : (
                filteredMembers.map(
                  row => {
                    const selected =
                      row.user_id ===
                      selectedMemberId;

                    return (
                      <Pressable
                        key={row.user_id}
                        onPress={() =>
                          setSelectedMemberId(
                            row.user_id
                          )
                        }
                        style={[
                          styles.memberRow,
                          selected &&
                            styles.memberRowOn,
                        ]}
                      >
                        <View
                          style={{
                            flex: 1,
                          }}
                        >
                          <Text
                            style={
                              styles.memberName
                            }
                            numberOfLines={1}
                          >
                            {row.full_name}
                          </Text>

                          <Text
                            style={
                              styles.memberMeta
                            }
                            numberOfLines={1}
                          >
                            {row.church_name ||
                              'No Local'}
                            {' | '}
                            {row.group_name ||
                              'No Cluster'}
                          </Text>
                        </View>

                        {selected && (
                          <Text
                            style={
                              styles.selected
                            }
                          >
                            SELECTED
                          </Text>
                        )}
                      </Pressable>
                    );
                  }
                )
              )}
            </View>
          )}
        </Card>

`;

admin =
  admin.slice(
    0,
    rewardCardStart
  ) +
  rewardSearchCard +
  admin.slice(
    selectedMemberAnchor
  );


/* ---------- LEADERBOARD UI ---------- */

const leaderboardStart =
  admin.indexOf(
`        <SectionTitle>
          BAYANIHAN LEADERBOARD`
  );

const scrollEnd =
  admin.indexOf(
    "      </ScrollView>",
    leaderboardStart
  );

if (
  leaderboardStart < 0 ||
  scrollEnd < 0
) {
  stop(
    "Leaderboard UI anchors missing."
  );
}

const leaderboardUi =
`        <SectionTitle>
          BAYANIHAN LEADERBOARD
        </SectionTitle>

        {renderLeaderboard(
          monthlyLeaders,
          'Top 5 This Month',
          'Based on Bayanihan earned during the current month.'
        )}

        {renderLeaderboard(
          leaders,
          'Top 5 Overall',
          'Based on total Bayanihan earned all time.'
        )}

`;

admin =
  admin.slice(
    0,
    leaderboardStart
  ) +
  leaderboardUi +
  admin.slice(
    scrollEnd
  );


/* ---------- EXTRA STYLES ---------- */

if (
  !admin.includes(
    "clusterOneLine:"
  )
) {
  const stylesEnd =
    admin.lastIndexOf(
      "  });"
    );

  if (stylesEnd < 0) {
    stop(
      "Admin styles ending not found."
    );
  }

  const extraStyles =
`    clusterLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },

    clusterOneLine: {
      flex: 1,
      fontSize: 12,
      fontWeight: '800',
      color: colors.text,
    },

    smallAction: {
      minHeight: 32,
      paddingHorizontal: 10,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        colors.greenSoft,
    },

    smallActionText: {
      fontSize: 9.5,
      fontWeight: '900',
      color: colors.greenDark,
    },

    rewardEditRow: {
      marginTop: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },

    rewardEditInput: {
      flex: 1,
      marginTop: 0,
      paddingVertical: 8,
    },

    searchLine: {
      marginTop: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },

    searchInput: {
      flex: 1,
      marginTop: 0,
    },

    compactLeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      paddingVertical: 9,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        colors.line,
    },

    compactLeaderName: {
      flex: 1,
      fontSize: 12,
      fontWeight: '800',
      color: colors.text,
    },

    compactLeaderAmount: {
      fontSize: 11,
      fontWeight: '900',
      color: colors.greenDark,
    },

`;

  admin =
    admin.slice(
      0,
      stylesEnd
    ) +
    extraStyles +
    admin.slice(
      stylesEnd
    );
}

fs.writeFileSync(
  adminPath,
  admin,
  "utf8"
);


/* ============================================================
   MEMBER HOME
   ============================================================ */

const homePath =
  "./src/app/(tabs)/home.tsx";

let home =
  fs.readFileSync(
    homePath,
    "utf8"
  );


/* ---------- COMPACT HOME COMPONENT ---------- */

if (
  !home.includes(
    "function CompactTopFiveMembers"
  )
) {
  const styleMatch =
    home.match(
      /\nconst styles\s*=/
    );

  if (!styleMatch) {
    stop(
      "Home styles anchor missing."
    );
  }

  const component =
`
function CompactTopFiveMembers({
  weekly,
  loading,
}: {
  weekly: any[];
  loading: boolean;
}) {
  const [
    monthly,
    setMonthly,
  ] =
    useState<any[]>([]);

  const [
    monthlyLoading,
    setMonthlyLoading,
  ] =
    useState(true);

  useEffect(() => {
    let active = true;

    void (async () => {
      const {
        data,
        error,
      } =
        await (
          supabase as any
        ).rpc(
          'get_buklod_points_top5_v1',
          {
            p_period:
              'month',
          }
        );

      if (!active) {
        return;
      }

      if (error) {
        console.warn(
          'Monthly Top 5:',
          error.message
        );

        setMonthly([]);
      }
      else {
        setMonthly(
          data ?? []
        );
      }

      setMonthlyLoading(
        false
      );
    })();

    return () => {
      active = false;
    };
  }, []);

  const renderRows =
    (
      rows: any[],
      busy: boolean
    ) => {
      if (busy) {
        return (
          <ActivityIndicator
            color={colors.green}
          />
        );
      }

      if (!rows.length) {
        return (
          <Text style={shared.muted}>
            No points yet.
          </Text>
        );
      }

      return (
        <View
          style={{
            gap: 2,
          }}
        >
          {rows
            .slice(0, 5)
            .map(
              (
                item,
                index
              ) => {
                const name =
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
                      \`\${name}-\${index}\`
                    }
                    style={{
                      flexDirection:
                        'row',

                      alignItems:
                        'center',

                      paddingVertical:
                        6,

                      gap: 8,
                    }}
                  >
                    <Text
                      style={{
                        width: 18,
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
                        fontSize: 11.5,
                        fontWeight:
                          '800',
                        color:
                          colors.text,
                      }}
                    >
                      {name}
                    </Text>

                    <Text
                      style={{
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
          marginTop: 10,
          marginBottom: 6,
          fontSize: 10,
          fontWeight: '900',
          color: colors.greenDark,
        }}
      >
        THIS WEEK
      </Text>

      {renderRows(
        weekly,
        loading
      )}

      <View
        style={{
          height: 1,
          marginVertical: 10,
          backgroundColor:
            colors.line,
        }}
      />

      <Text
        style={{
          marginBottom: 6,
          fontSize: 10,
          fontWeight: '900',
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

  home =
    home.slice(
      0,
      styleMatch.index
    ) +
    component +
    home.slice(
      styleMatch.index
    );
}


/* ---------- REPLACE OLD HOME LEADERBOARD ---------- */

const weeklyText =
  home.indexOf(
    "TOP BUKLOD THIS WEEK"
  );

const journeyText =
  home.indexOf(
    "YOUR JOURNEY",
    weeklyText
  );

if (
  weeklyText < 0 ||
  journeyText < 0
) {
  stop(
    "Home leaderboard section anchors missing."
  );
}

const oldStartTag =
  home.lastIndexOf(
    "<SectionTitle",
    weeklyText
  );

const journeyTag =
  home.lastIndexOf(
    "<SectionTitle",
    journeyText
  );

const homeStart =
  home.lastIndexOf(
    "\n",
    oldStartTag
  ) + 1;

const homeEnd =
  home.lastIndexOf(
    "\n",
    journeyTag
  ) + 1;

const newHomeTop =
`      <SectionTitle>
        TOP 5 MEMBERS
      </SectionTitle>

      <CompactTopFiveMembers
        weekly={
          homeTop.slice(0, 5)
        }
        loading={topLoading}
      />

`;

home =
  home.slice(
    0,
    homeStart
  ) +
  newHomeTop +
  home.slice(
    homeEnd
  );

fs.writeFileSync(
  homePath,
  home,
  "utf8"
);

console.log("");
console.log(
  "PATCH 157 UI APPLIED"
);
