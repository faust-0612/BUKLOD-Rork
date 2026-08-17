import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import {
  ChurchCandidate,
  ChurchMember,
  ChurchRequest,
  ChurchSummary,
  ChurchVerification,
  ChurchVisibility,
  churchDetails,
  churchInviteCandidates,
  churchMembers,
  churchRequests,
  getChurchVerification,
  inviteChurchMember,
  joinChurch,
  leaveChurch,
  removeChurchMember,
  resubmitChurchVerification,
  respondChurchInvite,
  reviewChurchRequest,
  transferChurchAdmin,
  updateChurch,
} from '@/lib/buklodChurches';

function msg(e: unknown) {
  if (e && typeof e === 'object' && 'message' in e) {
    return String((e as any).message);
  }
  return String(e || 'Unknown error');
}

function Button({
  title,
  onPress,
  outline,
  danger,
  disabled,
}: {
  title: string;
  onPress: () => void;
  outline?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        s.button,
        outline && s.buttonOutline,
        danger && s.buttonDanger,
        disabled && s.disabled,
      ]}
    >
      <Text
        style={[
          s.buttonText,
          outline && s.buttonTextOutline,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export default function ChurchDetailScreen() {
  const params =
    useLocalSearchParams<{ id?: string }>();

  const id =
    typeof params.id === 'string'
      ? params.id
      : '';

  const [church, setChurch] =
    useState<ChurchSummary | null>(null);

  const [verification, setVerification] =
    useState<ChurchVerification | null>(null);

  const [requests, setRequests] =
    useState<ChurchRequest[]>([]);

  const [members, setMembers] =
    useState<ChurchMember[]>([]);

  const [candidates, setCandidates] =
    useState<ChurchCandidate[]>([]);

  const [search, setSearch] = useState('');

  const [name, setName] = useState('');
  const [description, setDescription] =
    useState('');

  const [visibility, setVisibility] =
    useState<ChurchVisibility>('PUBLIC');

  const [resubmitNote, setResubmitNote] =
    useState('');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (refresh = false) => {
      if (!id) return;

      refresh
        ? setRefreshing(true)
        : setLoading(true);

      try {
        const info = await churchDetails(id);

        setChurch(info);

        if (info) {
          setName(info.name);
          setDescription(info.description || '');
          setVisibility(info.visibility);

          if (info.is_admin) {
            const [
              verify,
              requestRows,
              memberRows,
            ] = await Promise.all([
              getChurchVerification(id),
              churchRequests(id),
              churchMembers(id),
            ]);

            setVerification(verify);
            setRequests(requestRows);
            setMembers(memberRows);
          }
        }
      } catch (e) {
        Alert.alert('Church', msg(e));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id]
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function run(
    fn: () => Promise<void>
  ) {
    if (busy) return;

    setBusy(true);

    try {
      await fn();
      await load(true);
    } catch (e) {
      Alert.alert('Church', msg(e));
    } finally {
      setBusy(false);
    }
  }

  async function searchPeople() {
    try {
      setCandidates(
        await churchInviteCandidates(
          id,
          search
        )
      );
    } catch (e) {
      Alert.alert('Invite', msg(e));
    }
  }

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!church) {
    return (
      <View style={s.center}>
        <Text style={s.title}>
          Church unavailable
        </Text>
      </View>
    );
  }

  const location = [
    church.barangay,
    church.city_municipality,
    church.province,
    church.country,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void load(true)}
        />
      }
    >
      <View style={s.hero}>
        <Text style={s.eyebrow}>
          CHURCH
        </Text>

        <Text style={s.title}>
          {church.name}
        </Text>

        <Text style={s.meta}>
          {church.denomination ||
            'Christian Church'}
        </Text>

        {!!church.senior_pastor_name && (
          <Text style={s.meta}>
            Pastor: {church.senior_pastor_name}
          </Text>
        )}

        {!!location && (
          <Text style={s.meta}>
            {location}
          </Text>
        )}

        {!!church.description && (
          <Text style={s.description}>
            {church.description}
          </Text>
        )}

        <View style={s.actions}>
          <View style={s.badge}>
            <Text style={s.badgeText}>
              {church.scope_status}
            </Text>
          </View>

          <View style={s.badge}>
            <Text style={s.badgeText}>
              {church.verification_status ||
                'UNVERIFIED'}
            </Text>
          </View>

          {church.is_admin && (
            <View style={s.adminBadge}>
              <Text style={s.adminBadgeText}>
                CHURCH ADMIN
              </Text>
            </View>
          )}
        </View>

        {church.scope_status === 'ACTIVE' &&
          !church.membership_status &&
          church.visibility !==
            'INVITE_ONLY' && (
            <Button
              title="REQUEST CHURCH MEMBERSHIP"
              disabled={busy}
              onPress={() =>
                void run(async () => {
                  await joinChurch(id);
                })
              }
            />
          )}

        {church.membership_status ===
          'INVITED' && (
          <View style={s.actions}>
            <Button
              title="ACCEPT INVITATION"
              disabled={busy}
              onPress={() =>
                void run(async () => {
                  await respondChurchInvite(
                    id,
                    true
                  );
                })
              }
            />

            <Button
              title="DECLINE"
              outline
              disabled={busy}
              onPress={() =>
                void run(async () => {
                  await respondChurchInvite(
                    id,
                    false
                  );

                  router.replace(
                    '/churches' as any
                  );
                })
              }
            />
          </View>
        )}

        {church.membership_status ===
          'PENDING' && (
          <Text style={s.notice}>
            Membership request is awaiting
            Church Admin approval.
          </Text>
        )}

        {church.membership_status ===
          'ACTIVE' &&
          !church.is_admin && (
            <Button
              title="LEAVE CHURCH"
              danger
              disabled={busy}
              onPress={() =>
                Alert.alert(
                  'Leave Church',
                  'Leave this Church in BUKLOD?',
                  [
                    {
                      text: 'Cancel',
                      style: 'cancel',
                    },
                    {
                      text: 'Leave',
                      style: 'destructive',
                      onPress: () =>
                        void run(async () => {
                          await leaveChurch(id);
                          router.replace(
                            '/churches' as any
                          );
                        }),
                    },
                  ]
                )
              }
            />
          )}
      </View>

      {church.is_admin && verification && (
        <>
          <Text style={s.section}>
            VERIFICATION
          </Text>

          <View style={s.card}>
            <Text style={s.bold}>
              {verification.review_status}
            </Text>

            {!!verification.review_note && (
              <Text style={s.notice}>
                Reviewer note:{' '}
                {verification.review_note}
              </Text>
            )}

            <Text style={s.meta}>
              Authority:{' '}
              {verification.authority_role}
            </Text>

            <Text style={s.meta}>
              Contact:{' '}
              {verification.contact_email ||
                verification.contact_mobile ||
                'Not available'}
            </Text>

            {verification.review_status ===
              'REJECTED' && (
              <>
                <TextInput
                  style={s.input}
                  placeholder="Resubmission note..."
                  value={resubmitNote}
                  onChangeText={setResubmitNote}
                />

                <Button
                  title="RESUBMIT FOR VERIFICATION"
                  disabled={busy}
                  onPress={() =>
                    void run(async () => {
                      await resubmitChurchVerification(
                        id,
                        resubmitNote
                      );
                      setResubmitNote('');
                    })
                  }
                />
              </>
            )}
          </View>
        </>
      )}

      {church.is_admin && (
        <>
          <Text style={s.section}>
            CHURCH SETTINGS
          </Text>

          <View style={s.card}>
            <Text style={s.label}>
              CHURCH NAME
            </Text>

            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
            />

            <Text style={s.label}>
              DESCRIPTION
            </Text>

            <TextInput
              style={[
                s.input,
                s.multiline,
              ]}
              value={description}
              onChangeText={setDescription}
              multiline
              textAlignVertical="top"
            />

            <Text style={s.label}>
              VISIBILITY
            </Text>

            {(
              [
                'PUBLIC',
                'PRIVATE',
                'INVITE_ONLY',
              ] as ChurchVisibility[]
            ).map((v) => (
              <Pressable
                key={v}
                onPress={() =>
                  setVisibility(v)
                }
                style={[
                  s.option,
                  visibility === v &&
                    s.optionOn,
                ]}
              >
                <Text style={s.bold}>
                  {v.replace('_', ' ')}
                </Text>
              </Pressable>
            ))}

            <Button
              title="SAVE CHURCH SETTINGS"
              disabled={busy}
              onPress={() =>
                void run(async () => {
                  await updateChurch(id, {
                    name,
                    description,
                    visibility,
                  });
                })
              }
            />
          </View>

          {church.scope_status ===
            'ACTIVE' && (
            <>
              <Text style={s.section}>
                MEMBERSHIP REQUESTS
              </Text>

              {requests.length === 0 ? (
                <View style={s.card}>
                  <Text style={s.meta}>
                    No pending requests.
                  </Text>
                </View>
              ) : (
                requests.map((r) => (
                  <View
                    key={r.user_id}
                    style={s.person}
                  >
                    <Text
                      style={[
                        s.bold,
                        { flex: 1 },
                      ]}
                    >
                      {r.full_name}
                    </Text>

                    <Button
                      title="APPROVE"
                      disabled={busy}
                      onPress={() =>
                        void run(async () => {
                          await reviewChurchRequest(
                            id,
                            r.user_id,
                            true
                          );
                        })
                      }
                    />

                    <Button
                      title="REJECT"
                      outline
                      disabled={busy}
                      onPress={() =>
                        void run(async () => {
                          await reviewChurchRequest(
                            id,
                            r.user_id,
                            false
                          );
                        })
                      }
                    />
                  </View>
                ))
              )}

              <Text style={s.section}>
                INVITE MEMBERS
              </Text>

              <View style={s.card}>
                <View style={s.actions}>
                  <TextInput
                    style={[
                      s.input,
                      { flex: 1 },
                    ]}
                    placeholder="Search BUKLOD member..."
                    value={search}
                    onChangeText={setSearch}
                  />

                  <Button
                    title="SEARCH"
                    onPress={() =>
                      void searchPeople()
                    }
                  />
                </View>

                {candidates.map((c) => (
                  <View
                    key={c.user_id}
                    style={s.person}
                  >
                    <Text
                      style={[
                        s.bold,
                        { flex: 1 },
                      ]}
                    >
                      {c.full_name}
                    </Text>

                    <Button
                      title="INVITE"
                      disabled={busy}
                      onPress={() =>
                        void run(async () => {
                          await inviteChurchMember(
                            id,
                            c.user_id
                          );

                          setCandidates(
                            (current) =>
                              current.filter(
                                (x) =>
                                  x.user_id !==
                                  c.user_id
                              )
                          );
                        })
                      }
                    />
                  </View>
                ))}
              </View>

              <Text style={s.section}>
                CHURCH MEMBERS
              </Text>

              {members.map((m) => (
                <View
                  key={m.user_id}
                  style={s.person}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.bold}>
                      {m.full_name}
                    </Text>

                    <Text style={s.meta}>
                      {m.is_admin
                        ? 'Church Admin'
                        : 'Member'}
                    </Text>
                  </View>

                  {!m.is_admin && (
                    <>
                      <Button
                        title="MAKE ADMIN"
                        outline
                        disabled={busy}
                        onPress={() =>
                          Alert.alert(
                            'Transfer Church Admin',
                            `Make ${m.full_name} the Church Admin?`,
                            [
                              {
                                text: 'Cancel',
                                style: 'cancel',
                              },
                              {
                                text: 'Transfer',
                                onPress: () =>
                                  void run(
                                    async () => {
                                      await transferChurchAdmin(
                                        id,
                                        m.user_id
                                      );
                                    }
                                  ),
                              },
                            ]
                          )
                        }
                      />

                      <Button
                        title="REMOVE"
                        danger
                        disabled={busy}
                        onPress={() =>
                          Alert.alert(
                            'Remove member',
                            `Remove ${m.full_name}?`,
                            [
                              {
                                text: 'Cancel',
                                style: 'cancel',
                              },
                              {
                                text: 'Remove',
                                style:
                                  'destructive',
                                onPress: () =>
                                  void run(
                                    async () => {
                                      await removeChurchMember(
                                        id,
                                        m.user_id
                                      );
                                    }
                                  ),
                              },
                            ]
                          )
                        }
                      />
                    </>
                  )}
                </View>
              ))}
            </>
          )}
        </>
      )}

      <View style={{ height: 50 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F7F6',
  },
  content: {
    padding: 16,
    gap: 10,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E7E3',
    borderRadius: 20,
    padding: 18,
    gap: 8,
  },
  eyebrow: {
    color: '#2D6A4F',
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  title: {
    color: '#19362A',
    fontWeight: '900',
    fontSize: 27,
  },
  meta: {
    color: '#748079',
    fontSize: 12,
  },
  description: {
    color: '#4B5C53',
    lineHeight: 20,
  },
  notice: {
    color: '#67552F',
    backgroundColor: '#FFF8E8',
    padding: 10,
    borderRadius: 10,
    lineHeight: 18,
  },
  section: {
    marginTop: 14,
    color: '#365347',
    fontWeight: '900',
    letterSpacing: 1,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E7E3',
    borderRadius: 15,
    padding: 14,
    gap: 8,
  },
  label: {
    color: '#496056',
    fontWeight: '900',
    fontSize: 11,
  },
  bold: {
    color: '#243C31',
    fontWeight: '900',
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#D8E1DC',
    backgroundColor: '#FAFBFA',
    borderRadius: 11,
    paddingHorizontal: 11,
  },
  multiline: {
    minHeight: 90,
    paddingTop: 10,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    alignItems: 'center',
  },
  person: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 7,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E1E7E3',
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
  },
  button: {
    minHeight: 39,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#2D6A4F',
  },
  buttonOutline: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2D6A4F',
  },
  buttonDanger: {
    backgroundColor: '#9E2A2B',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 10,
  },
  buttonTextOutline: {
    color: '#2D6A4F',
  },
  badge: {
    backgroundColor: '#EDF3EF',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  badgeText: {
    color: '#436052',
    fontWeight: '900',
    fontSize: 10,
  },
  adminBadge: {
    backgroundColor: '#DFF2E7',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  adminBadgeText: {
    color: '#236043',
    fontWeight: '900',
    fontSize: 10,
  },
  option: {
    borderWidth: 1,
    borderColor: '#DCE4E0',
    borderRadius: 10,
    padding: 11,
  },
  optionOn: {
    borderColor: '#2D6A4F',
    backgroundColor: '#F0F7F3',
  },
  disabled: {
    opacity: 0.45,
  },
});
