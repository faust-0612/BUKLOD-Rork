const fs = require("fs");
const ts = require("typescript");

const path =
  "./src/app/(tabs)/home.tsx";

let src =
  fs.readFileSync(
    path,
    "utf8"
  )
  .replace(/^\uFEFF/, "");


if (
  src.includes(
    "PATCH_161B_BULLETIN_SOCIAL_UI"
  )
) {
  console.log(
    "PATCH 161B already installed."
  );
  process.exit(0);
}


/* ============================================================
   HELPERS
============================================================ */

function parse(code) {
  return ts.createSourceFile(
    path,
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
}


function replaceTypeAlias(
  code,
  name,
  replacement
) {

  const sf = parse(code);

  const node =
    sf.statements.find(
      (statement) =>
        ts.isTypeAliasDeclaration(
          statement
        ) &&
        statement.name.text ===
          name
    );

  if (!node) {
    throw new Error(
      "Type alias not found: " +
      name
    );
  }

  return (
    code.slice(
      0,
      node.getStart(sf)
    ) +
    replacement +
    code.slice(
      node.end
    )
  );
}


function replaceFunction(
  code,
  name,
  replacement
) {

  const sf = parse(code);

  const node =
    sf.statements.find(
      (statement) =>
        ts.isFunctionDeclaration(
          statement
        ) &&
        statement.name &&
        statement.name.text ===
          name
    );

  if (!node) {
    throw new Error(
      "Function not found: " +
      name
    );
  }

  return (
    code.slice(
      0,
      node.getStart(sf)
    ) +
    replacement +
    code.slice(
      node.end
    )
  );
}


/* ============================================================
   IMPORTS
============================================================ */

src =
`/* PATCH_161B_BULLETIN_SOCIAL_UI */
import {
  Alert as BulletinAlert,
  TextInput as BulletinTextInput,
} from 'react-native';

import {
  useRef as useBulletinRef,
} from 'react';

import {
  Image as BulletinImage,
} from 'expo-image';

` + src;


/* ============================================================
   MISSION BULLETIN TYPE
============================================================ */

src =
  replaceTypeAlias(
    src,
    "MissionBulletin",
`type MissionBulletin = {
  id: string;
  church_id: string | null;
  title: string;
  body: string;
  priority: number;
  is_pinned: boolean;
  starts_at: string;
  expires_at: string | null;
  created_at?: string;
  media_path?: string | null;
  media_url?: string | null;
  church?:
    | { name: string }
    | { name: string }[]
    | null;
};`
  );


/* ============================================================
   IMPORTANT REMINDER TYPE
============================================================ */

src =
  replaceTypeAlias(
    src,
    "HomeImportantReminderRow",
`type HomeImportantReminderRow = {
  slot: string;
  title: string;
  body: string;
  is_active: boolean;
  starts_at: string;
  ends_at: string | null;
  updated_at: string;
  media_path?: string | null;
  media_url?: string | null;
};`
  );


/* ============================================================
   IMPORTANT REMINDER HOME
============================================================ */

src =
  replaceFunction(
    src,
    "HomeImportantReminder",
String.raw`function HomeImportantReminder() {

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
    >(null);


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
                'slot,title,body,is_active,starts_at,ends_at,updated_at,media_path'
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


          const visible =
            data.is_active &&
            Date.parse(
              data.starts_at
            ) <= now &&
            (
              !data.ends_at ||
              Date.parse(
                data.ends_at
              ) > now
            );


          if (!visible) {

            setReminder(
              null
            );

            return;
          }


          let mediaUrl:
            string |
            null =
            null;


          if (
            data.media_path
          ) {

            const {
              data: signed,
            } =
              await supabase
                .storage
                .from(
                  'bulletin-media'
                )
                .createSignedUrl(
                  data.media_path,
                  3600
                );


            if (!active) {
              return;
            }


            mediaUrl =
              signed?.signedUrl ??
              null;
          }


          setReminder({
            ...(data as HomeImportantReminderRow),
            media_url:
              mediaUrl,
          });

        };


      void load();


      return () => {
        active =
          false;
      };

    },
    []
  );


  const canEdit =
    hasRole(
      'system_admin'
    );


  if (
    !reminder &&
    !canEdit
  ) {
    return null;
  }


  return (

    <View
      style={{
        marginTop: 14,
      }}
    >

      <SectionTitle>
        IMPORTANT REMINDER
      </SectionTitle>


      <Card>

        {reminder ? (

          <View>

            {!!reminder.media_url && (

              <BulletinImage
                source={{
                  uri:
                    reminder.media_url,
                }}
                style={{
                  width: '100%',
                  aspectRatio: 16 / 9,
                  borderRadius: 14,
                  marginBottom: 14,
                }}
                contentFit="cover"
                transition={180}
              />

            )}


            <View
              style={{
                borderLeftWidth: 4,
                borderLeftColor:
                  colors.greenDark,
                paddingLeft: 11,
              }}
            >

              <Text
                style={{
                  fontSize: 17,
                  fontWeight: '900',
                  color:
                    colors.greenDark,
                  marginBottom: 7,
                }}
              >
                {reminder.title}
              </Text>


              <Text
                style={{
                  fontSize: 14,
                  lineHeight: 21,
                  color: '#374151',
                }}
              >
                {reminder.body}
              </Text>

            </View>

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


        {canEdit && (

          <Pressable
            onPress={() =>
              router.push(
                '/admin/home-reminder' as any
              )
            }
            style={{
              marginTop: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent:
                'center',
              gap: 6,
              paddingVertical: 9,
            }}
          >

            <Text
              style={{
                fontSize: 12,
                fontWeight: '900',
                color:
                  colors.greenDark,
              }}
            >
              EDIT IMPORTANT REMINDER
            </Text>

            <MaterialCommunityIcons
              name="pencil-outline"
              size={16}
              color={
                colors.greenDark
              }
            />

          </Pressable>

        )}

      </Card>

    </View>

  );

}`
  );


/* ============================================================
   MISSION BULLETINS
============================================================ */

src =
  replaceFunction(
    src,
    "HomeMissionBulletins",
String.raw`function HomeMissionBulletins() {

  const {
    profile,
  } =
    useAuth();


  const mounted =
    useBulletinRef(
      true
    );


  const [
    items,
    setItems,
  ] =
    useState<
      MissionBulletin[]
    >([]);


  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );


  const [
    engagement,
    setEngagement,
  ] =
    useState<
      Record<
        string,
        {
          love: number;
          praying: number;
          amen: number;
          mine:
            | 'love'
            | 'praying'
            | 'amen'
            | null;
        }
      >
    >({});


  const [
    comments,
    setComments,
  ] =
    useState<
      Record<
        string,
        any[]
      >
    >({});


  const [
    commentDrafts,
    setCommentDrafts,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});


  const [
    replyingTo,
    setReplyingTo,
  ] =
    useState<{
      bulletinId: string;
      commentId: string;
      name: string;
    } | null>(
      null
    );


  const [
    replyDraft,
    setReplyDraft,
  ] =
    useState('');


  const [
    busyKey,
    setBusyKey,
  ] =
    useState<
      string |
      null
    >(null);


  useEffect(
    () => {

      mounted.current =
        true;


      return () => {
        mounted.current =
          false;
      };

    },
    []
  );


  const load =
    async () => {

      if (
        mounted.current
      ) {
        setLoading(
          true
        );
      }


      const now =
        new Date()
          .toISOString();


      let query =
        supabase
          .from(
            'mission_bulletins'
          )
          .select(
            'id,church_id,title,body,priority,is_pinned,starts_at,expires_at,created_at,media_path,church:church_id(name)'
          )
          .eq(
            'is_published',
            true
          )
          .lte(
            'starts_at',
            now
          )
          .order(
            'is_pinned',
            {
              ascending:
                false,
            }
          )
          .order(
            'priority',
            {
              ascending:
                false,
            }
          )
          .order(
            'created_at',
            {
              ascending:
                false,
            }
          );


      if (
        profile?.church_id
      ) {

        query =
          query.or(
            'church_id.is.null,church_id.eq.' +
            profile.church_id
          );

      } else {

        query =
          query.is(
            'church_id',
            null
          );

      }


      const {
        data,
        error,
      } =
        await query;


      if (
        !mounted.current
      ) {
        return;
      }


      if (error) {

        console.warn(
          'Could not load Mission Bulletins:',
          error.message
        );

        setItems([]);
        setLoading(false);

        return;
      }


      const activeItems =
        (
          data ??
          []
        )
          .filter(
            (item: any) =>
              !item.expires_at ||
              Date.parse(
                item.expires_at
              ) >
                Date.now()
          );


      const withMedia =
        await Promise.all(

          activeItems.map(
            async (
              item: any
            ) => {

              if (
                !item.media_path
              ) {
                return {
                  ...item,
                  media_url:
                    null,
                };
              }


              const {
                data:
                  signed,
              } =
                await supabase
                  .storage
                  .from(
                    'bulletin-media'
                  )
                  .createSignedUrl(
                    item.media_path,
                    3600
                  );


              return {
                ...item,
                media_url:
                  signed?.signedUrl ??
                  null,
              };

            }
          )

        );


      if (
        !mounted.current
      ) {
        return;
      }


      setItems(
        withMedia as
          MissionBulletin[]
      );


      const ids =
        withMedia.map(
          (item: any) =>
            item.id
        );


      if (
        !ids.length
      ) {

        setEngagement({});
        setComments({});
        setLoading(false);

        return;
      }


      const [
        reactionResult,
        commentResult,
      ] =
        await Promise.all([

          supabase
            .from(
              'mission_bulletin_reactions'
            )
            .select(
              'bulletin_id,user_id,reaction'
            )
            .in(
              'bulletin_id',
              ids
            ),

          supabase
            .from(
              'mission_bulletin_comments'
            )
            .select(
              'id,bulletin_id,user_id,parent_id,body,created_at'
            )
            .in(
              'bulletin_id',
              ids
            )
            .order(
              'created_at',
              {
                ascending:
                  true,
              }
            ),

        ]);


      if (
        !mounted.current
      ) {
        return;
      }


      const nextEngagement:
        Record<
          string,
          {
            love: number;
            praying: number;
            amen: number;
            mine:
              | 'love'
              | 'praying'
              | 'amen'
              | null;
          }
        > =
          {};


      ids.forEach(
        (id: string) => {

          nextEngagement[id] = {
            love: 0,
            praying: 0,
            amen: 0,
            mine: null,
          };

        }
      );


      (
        reactionResult.data ??
        []
      ).forEach(
        (row: any) => {

          const bucket =
            nextEngagement[
              row.bulletin_id
            ];


          if (!bucket) {
            return;
          }


          if (
            row.reaction ===
            'love'
          ) {
            bucket.love += 1;
          }


          if (
            row.reaction ===
            'praying'
          ) {
            bucket.praying += 1;
          }


          if (
            row.reaction ===
            'amen'
          ) {
            bucket.amen += 1;
          }


          if (
            row.user_id ===
            profile?.id
          ) {

            bucket.mine =
              row.reaction;

          }

        }
      );


      const rawComments =
        commentResult.data ??
        [];


      const userIds =
        Array.from(
          new Set(
            rawComments.map(
              (row: any) =>
                row.user_id
            )
          )
        );


      const nameMap:
        Record<
          string,
          string
        > =
          {};


      if (
        userIds.length
      ) {

        const {
          data:
            profileRows,
        } =
          await supabase
            .from(
              'profiles'
            )
            .select(
              'id,full_name'
            )
            .in(
              'id',
              userIds as string[]
            );


        (
          profileRows ??
          []
        ).forEach(
          (row: any) => {

            nameMap[
              row.id
            ] =
              row.full_name ||
              'Member';

          }
        );

      }


      if (
        !mounted.current
      ) {
        return;
      }


      const nextComments:
        Record<
          string,
          any[]
        > =
          {};


      ids.forEach(
        (id: string) => {
          nextComments[id] =
            [];
        }
      );


      rawComments.forEach(
        (row: any) => {

          if (
            !nextComments[
              row.bulletin_id
            ]
          ) {
            return;
          }


          nextComments[
            row.bulletin_id
          ].push({
            ...row,
            author_name:
              nameMap[
                row.user_id
              ] ||
              (
                row.user_id ===
                profile?.id
                  ? (
                      profile as any
                    )?.full_name ||
                    'You'
                  : 'Member'
              ),
          });

        }
      );


      setEngagement(
        nextEngagement
      );

      setComments(
        nextComments
      );

      setLoading(
        false
      );

    };


  useEffect(
    () => {

      void load();

    },
    [
      profile?.church_id,
      profile?.id,
    ]
  );


  const react =
    async (
      bulletinId:
        string,
      reaction:
        'love' |
        'praying' |
        'amen'
    ) => {

      if (
        !profile?.id
      ) {
        return;
      }


      const current =
        engagement[
          bulletinId
        ]?.mine ??
        null;


      const next =
        current === reaction
          ? null
          : reaction;


      setBusyKey(
        'reaction:' +
        bulletinId
      );


      const {
        error,
      } =
        await (
          supabase as any
        ).rpc(
          'set_mission_bulletin_reaction_v1',
          {
            p_bulletin_id:
              bulletinId,
            p_reaction:
              next,
          }
        );


      if (error) {

        BulletinAlert.alert(
          'Reaction',
          error.message
        );

        setBusyKey(
          null
        );

        return;
      }


      await load();


      if (
        mounted.current
      ) {
        setBusyKey(
          null
        );
      }

    };


  const submitComment =
    async (
      bulletinId:
        string,
      parentId:
        string |
        null =
        null
    ) => {

      if (
        !profile?.id
      ) {
        return;
      }


      const text =
        parentId
          ? replyDraft.trim()
          : (
              commentDrafts[
                bulletinId
              ] ??
              ''
            ).trim();


      if (!text) {
        return;
      }


      setBusyKey(
        'comment:' +
        bulletinId
      );


      const {
        error,
      } =
        await supabase
          .from(
            'mission_bulletin_comments'
          )
          .insert({
            bulletin_id:
              bulletinId,
            user_id:
              profile.id,
            parent_id:
              parentId,
            body:
              text,
          });


      if (error) {

        BulletinAlert.alert(
          parentId
            ? 'Reply'
            : 'Comment',
          error.message
        );

        setBusyKey(
          null
        );

        return;
      }


      if (parentId) {

        setReplyDraft('');
        setReplyingTo(
          null
        );

      } else {

        setCommentDrafts(
          (previous) => ({
            ...previous,
            [bulletinId]:
              '',
          })
        );

      }


      await load();


      if (
        mounted.current
      ) {
        setBusyKey(
          null
        );
      }

    };


  const deleteComment =
    async (
      commentId:
        string
    ) => {

      const {
        error,
      } =
        await supabase
          .from(
            'mission_bulletin_comments'
          )
          .delete()
          .eq(
            'id',
            commentId
          );


      if (error) {

        BulletinAlert.alert(
          'Comment',
          error.message
        );

        return;
      }


      await load();

    };


  if (loading) {

    return (

      <Card>

        <ActivityIndicator
          color={
            colors.green
          }
        />

      </Card>

    );

  }


  if (
    !items.length
  ) {

    return (

      <Card>

        <Text
          style={
            shared.muted
          }
        >
          No Mission Bulletins yet.
        </Text>

      </Card>

    );

  }


  return (

    <View
      style={{
        gap: 12,
      }}
    >

      {items.map(
        (item) => {

          const churchName =
            Array.isArray(
              item.church
            )
              ? item.church[
                  0
                ]?.name
              : item.church
                  ?.name;


          const reaction =
            engagement[
              item.id
            ] ?? {
              love: 0,
              praying: 0,
              amen: 0,
              mine: null,
            };


          const allComments =
            comments[
              item.id
            ] ??
            [];


          const rootComments =
            allComments.filter(
              (comment) =>
                !comment.parent_id
            );


          return (

            <Card
              key={
                item.id
              }
            >

              {!!item.media_url && (

                <BulletinImage
                  source={{
                    uri:
                      item.media_url,
                  }}
                  style={{
                    width:
                      '100%',
                    aspectRatio:
                      16 / 9,
                    borderRadius:
                      14,
                    marginBottom:
                      14,
                  }}
                  contentFit="cover"
                  transition={180}
                />

              )}


              <View
                style={{
                  borderLeftWidth:
                    5,
                  borderLeftColor:
                    colors.green,
                  paddingLeft:
                    12,
                }}
              >

                <Text
                  style={{
                    color:
                      colors.green,
                    fontWeight:
                      '900',
                    fontSize: 11,
                    letterSpacing:
                      1,
                  }}
                >

                  {item.is_pinned
                    ? 'PINNED | '
                    : ''}

                  {churchName ||
                    'ALL LOCALS'}

                </Text>


                <Text
                  style={{
                    marginTop: 7,
                    fontSize: 18,
                    lineHeight: 23,
                    fontWeight:
                      '900',
                    color:
                      '#111827',
                  }}
                >
                  {item.title}
                </Text>


                <Text
                  style={{
                    marginTop: 8,
                    fontSize: 14,
                    lineHeight: 21,
                    color:
                      '#374151',
                  }}
                >
                  {item.body}
                </Text>


                <Text
                  style={{
                    marginTop: 9,
                    fontSize: 11,
                    color:
                      '#6B7280',
                  }}
                >
                  {new Date(
                    item.starts_at
                  ).toLocaleString()}
                </Text>

              </View>


              {/* REACTIONS */}

              <View
                style={{
                  flexDirection:
                    'row',
                  gap: 7,
                  marginTop: 14,
                }}
              >

                {([
                  [
                    'love',
                    '\u2764\uFE0F',
                    'Love',
                    reaction.love,
                  ],
                  [
                    'praying',
                    '\uD83D\uDE4F',
                    'Praying',
                    reaction.praying,
                  ],
                  [
                    'amen',
                    '\uD83D\uDE4C',
                    'Amen',
                    reaction.amen,
                  ],
                ] as const)
                  .map(
                    (
                      [
                        key,
                        icon,
                        label,
                        count,
                      ]
                    ) => {

                      const selected =
                        reaction.mine ===
                        key;


                      return (

                        <Pressable
                          key={
                            key
                          }
                          disabled={
                            busyKey ===
                            'reaction:' +
                              item.id
                          }
                          onPress={() =>
                            void react(
                              item.id,
                              key
                            )
                          }
                          style={{
                            flex: 1,
                            minHeight:
                              40,
                            borderRadius:
                              12,
                            borderWidth:
                              1,
                            borderColor:
                              selected
                                ? colors.green
                                : '#E5E7EB',
                            backgroundColor:
                              selected
                                ? '#ECFDF3'
                                : '#FFFFFF',
                            alignItems:
                              'center',
                            justifyContent:
                              'center',
                            paddingHorizontal:
                              4,
                          }}
                        >

                          <Text
                            style={{
                              fontSize:
                                12,
                              fontWeight:
                                selected
                                  ? '900'
                                  : '700',
                              color:
                                selected
                                  ? colors.greenDark
                                  : '#4B5563',
                            }}
                          >
                            {icon}{' '}
                            {label}{' '}
                            {count}
                          </Text>

                        </Pressable>

                      );

                    }
                  )}

              </View>


              {/* COMMENTS */}

              <View
                style={{
                  marginTop:
                    15,
                  borderTopWidth:
                    1,
                  borderTopColor:
                    '#E5E7EB',
                  paddingTop:
                    12,
                }}
              >

                <Text
                  style={{
                    fontSize: 13,
                    fontWeight:
                      '900',
                    color:
                      colors.greenDark,
                    marginBottom:
                      9,
                  }}
                >
                  COMMENTS ({allComments.length})
                </Text>


                {rootComments.map(
                  (
                    comment
                  ) => {

                    const replies =
                      allComments.filter(
                        (
                          child
                        ) =>
                          child.parent_id ===
                          comment.id
                      );


                    const own =
                      comment.user_id ===
                      profile?.id;


                    return (

                      <View
                        key={
                          comment.id
                        }
                        style={{
                          marginBottom:
                            11,
                        }}
                      >

                        <View
                          style={{
                            backgroundColor:
                              '#F3F4F6',
                            borderRadius:
                              12,
                            padding:
                              10,
                          }}
                        >

                          <Text
                            style={{
                              fontSize:
                                12,
                              fontWeight:
                                '900',
                              color:
                                '#1F2937',
                            }}
                          >
                            {comment.author_name}
                          </Text>


                          <Text
                            style={{
                              marginTop:
                                3,
                              fontSize:
                                13,
                              lineHeight:
                                19,
                              color:
                                '#374151',
                            }}
                          >
                            {comment.body}
                          </Text>


                          <View
                            style={{
                              marginTop:
                                6,
                              flexDirection:
                                'row',
                              alignItems:
                                'center',
                              gap: 14,
                            }}
                          >

                            <Pressable
                              onPress={() => {

                                setReplyingTo({
                                  bulletinId:
                                    item.id,
                                  commentId:
                                    comment.id,
                                  name:
                                    comment.author_name,
                                });

                                setReplyDraft(
                                  ''
                                );

                              }}
                            >
                              <Text
                                style={{
                                  fontSize:
                                    11,
                                  fontWeight:
                                    '800',
                                  color:
                                    colors.green,
                                }}
                              >
                                Reply
                              </Text>
                            </Pressable>


                            {own && (

                              <Pressable
                                onPress={() =>
                                  void deleteComment(
                                    comment.id
                                  )
                                }
                              >
                                <Text
                                  style={{
                                    fontSize:
                                      11,
                                    fontWeight:
                                      '800',
                                    color:
                                      '#B91C1C',
                                  }}
                                >
                                  Delete
                                </Text>
                              </Pressable>

                            )}


                            <Text
                              style={{
                                marginLeft:
                                  'auto',
                                fontSize:
                                  10,
                                color:
                                  '#9CA3AF',
                              }}
                            >
                              {new Date(
                                comment.created_at
                              ).toLocaleString()}
                            </Text>

                          </View>

                        </View>


                        {replies.map(
                          (
                            reply
                          ) => {

                            const ownReply =
                              reply.user_id ===
                              profile?.id;


                            return (

                              <View
                                key={
                                  reply.id
                                }
                                style={{
                                  marginLeft:
                                    20,
                                  marginTop:
                                    6,
                                  backgroundColor:
                                    '#F9FAFB',
                                  borderRadius:
                                    11,
                                  borderLeftWidth:
                                    3,
                                  borderLeftColor:
                                    '#D1D5DB',
                                  padding:
                                    9,
                                }}
                              >

                                <Text
                                  style={{
                                    fontSize:
                                      11,
                                    fontWeight:
                                      '900',
                                    color:
                                      '#374151',
                                  }}
                                >
                                  {reply.author_name}
                                </Text>


                                <Text
                                  style={{
                                    marginTop:
                                      3,
                                    fontSize:
                                      12.5,
                                    lineHeight:
                                      18,
                                    color:
                                      '#4B5563',
                                  }}
                                >
                                  {reply.body}
                                </Text>


                                {ownReply && (

                                  <Pressable
                                    onPress={() =>
                                      void deleteComment(
                                        reply.id
                                      )
                                    }
                                    style={{
                                      marginTop:
                                        5,
                                    }}
                                  >
                                    <Text
                                      style={{
                                        fontSize:
                                          10,
                                        fontWeight:
                                          '800',
                                        color:
                                          '#B91C1C',
                                      }}
                                    >
                                      Delete
                                    </Text>
                                  </Pressable>

                                )}

                              </View>

                            );

                          }
                        )}


                        {replyingTo?.commentId ===
                          comment.id && (

                          <View
                            style={{
                              marginLeft:
                                20,
                              marginTop:
                                7,
                            }}
                          >

                            <Text
                              style={{
                                fontSize:
                                  11,
                                color:
                                  '#6B7280',
                                marginBottom:
                                  5,
                              }}
                            >
                              Replying to {replyingTo.name}
                            </Text>


                            <BulletinTextInput
                              value={
                                replyDraft
                              }
                              onChangeText={
                                setReplyDraft
                              }
                              placeholder="Write a reply..."
                              multiline
                              style={{
                                minHeight:
                                  42,
                                borderWidth:
                                  1,
                                borderColor:
                                  '#D1D5DB',
                                borderRadius:
                                  11,
                                paddingHorizontal:
                                  10,
                                paddingVertical:
                                  8,
                                fontSize:
                                  13,
                                backgroundColor:
                                  '#FFFFFF',
                              }}
                            />


                            <View
                              style={{
                                flexDirection:
                                  'row',
                                gap: 8,
                                marginTop:
                                  6,
                              }}
                            >

                              <Pressable
                                onPress={() =>
                                  void submitComment(
                                    item.id,
                                    comment.id
                                  )
                                }
                                style={{
                                  backgroundColor:
                                    colors.green,
                                  borderRadius:
                                    9,
                                  paddingHorizontal:
                                    12,
                                  paddingVertical:
                                    7,
                                }}
                              >
                                <Text
                                  style={{
                                    color:
                                      '#FFFFFF',
                                    fontWeight:
                                      '900',
                                    fontSize:
                                      11,
                                  }}
                                >
                                  REPLY
                                </Text>
                              </Pressable>


                              <Pressable
                                onPress={() => {

                                  setReplyingTo(
                                    null
                                  );

                                  setReplyDraft(
                                    ''
                                  );

                                }}
                                style={{
                                  paddingHorizontal:
                                    10,
                                  paddingVertical:
                                    7,
                                }}
                              >
                                <Text
                                  style={{
                                    color:
                                      '#6B7280',
                                    fontWeight:
                                      '800',
                                    fontSize:
                                      11,
                                  }}
                                >
                                  CANCEL
                                </Text>
                              </Pressable>

                            </View>

                          </View>

                        )}

                      </View>

                    );

                  }
                )}


                <View
                  style={{
                    flexDirection:
                      'row',
                    alignItems:
                      'flex-end',
                    gap: 7,
                    marginTop: 3,
                  }}
                >

                  <BulletinTextInput
                    value={
                      commentDrafts[
                        item.id
                      ] ??
                      ''
                    }
                    onChangeText={(
                      text
                    ) =>
                      setCommentDrafts(
                        (
                          previous
                        ) => ({
                          ...previous,
                          [item.id]:
                            text,
                        })
                      )
                    }
                    placeholder="Write a comment..."
                    multiline
                    style={{
                      flex: 1,
                      minHeight:
                        42,
                      maxHeight:
                        110,
                      borderWidth:
                        1,
                      borderColor:
                        '#D1D5DB',
                      borderRadius:
                        12,
                      paddingHorizontal:
                        11,
                      paddingVertical:
                        9,
                      backgroundColor:
                        '#FFFFFF',
                      fontSize:
                        13,
                    }}
                  />


                  <Pressable
                    disabled={
                      busyKey ===
                      'comment:' +
                        item.id
                    }
                    onPress={() =>
                      void submitComment(
                        item.id
                      )
                    }
                    style={{
                      minHeight:
                        42,
                      justifyContent:
                        'center',
                      backgroundColor:
                        colors.green,
                      borderRadius:
                        11,
                      paddingHorizontal:
                        13,
                    }}
                  >
                    <Text
                      style={{
                        color:
                          '#FFFFFF',
                        fontSize:
                          11,
                        fontWeight:
                          '900',
                      }}
                    >
                      POST
                    </Text>
                  </Pressable>

                </View>

              </View>

            </Card>

          );

        }
      )}

    </View>

  );

}`
  );


/* ============================================================
   SAVE UTF-8 WITHOUT BOM
============================================================ */

const utf8 =
  Buffer.from(
    src,
    "utf8"
  );

fs.writeFileSync(
  path,
  utf8
);


console.log(
  "PATCH 161B INSTALLED"
);
