import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { resolvePersonDisplayName } from '@/lib/buklodPersonDisplay';
import { Card, SectionTitle, shared } from '@/components/UI';
import { colors } from '@/lib/theme';

type Church = {
  id: string;
  name: string;
};

type GivingRow = {
  id: string;
  user_id: string;
  full_name: string | null;
  giving_type: string;
  amount: number | string;
  payment_method: string;
  payment_date: string;
  reference_number: string | null;
  status: 'pending' | 'verified' | 'rejected';
  created_at: string;
  verified_at: string | null;
  verified_by: string | null;
  verifier_name: string | null;

  proof_path?: string | null;
  proof_url?: string | null;
  member_note?: string | null;
  treasurer_note?: string | null;
};

function money(value: number | string) {
  return `₱${Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function dateTime(value: string | null) {
  if (!value) return '';

  try {
    return new Date(value).toLocaleString('en-PH');
  } catch {
    return value;
  }
}

export default function GivingReviewScreen() {
  const [churches, setChurches] = useState<Church[]>([]);
  const [churchId, setChurchId] = useState('');

  const [rows, setRows] = useState<GivingRow[]>([]);

  const [notes, setNotes] = useState<Record<string, string>>({});

  const [loadingChurches, setLoadingChurches] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const selectedChurch =
    churches.find((church) => church.id === churchId) ?? null;

  const pendingRows = useMemo(
    () => rows.filter((row) => row.status === 'pending'),
    [rows]
  );

  const reviewedRows = useMemo(
    () => rows.filter((row) => row.status !== 'pending'),
    [rows]
  );

  const loadAuthorizedChurches = useCallback(async () => {
    try {
      setLoadingChurches(true);

      const { data: churchRows, error: churchError } =
        await supabase
          .from('churches')
          .select('id,name')
          .eq('is_active', true)
          .order('name');

      if (churchError) throw churchError;

      const allChurches = (churchRows ?? []) as Church[];

      const checks = await Promise.all(
        allChurches.map(async (church) => {
          const { data, error } = await supabase.rpc(
            'can_verify_church_giving',
            {
              target_church: church.id,
            }
          );

          if (error) {
            console.warn(
              `Giving access check for ${church.name}:`,
              error.message
            );

            return false;
          }

          return data === true;
        })
      );

      const allowed = allChurches.filter(
        (_, index) => checks[index]
      );

      setChurches(allowed);

      setChurchId((current) => {
        if (
          current &&
          allowed.some((church) => church.id === current)
        ) {
          return current;
        }

        return allowed[0]?.id ?? '';
      });
    } catch (error: any) {
      Alert.alert(
        'Giving Verification',
        error?.message ||
          'Could not determine your authorized Local Churches.'
      );
    } finally {
      setLoadingChurches(false);
    }
  }, []);

  const loadRows = useCallback(async () => {
    if (!churchId) {
      setRows([]);
      return;
    }

    try {
      setLoadingRows(true);

      const { data: masterlist, error: masterlistError } =
        await supabase.rpc(
          'get_church_giving_masterlist',
          {
            p_church_id: churchId,
          }
        );

      if (masterlistError) {
        throw masterlistError;
      }

      /*
       * Masterlist RPC contains the financial record.
       * We separately fetch proof_path and notes so the
       * reviewer can inspect the submitted evidence.
       */
      const { data: detailRows, error: detailError } =
        await supabase
          .from('tithe_submissions')
          .select(`
            id,
            proof_path,
            member_note,
            treasurer_note
          `)
          .eq('church_id', churchId);

      if (detailError) {
        throw detailError;
      }

      const detailMap = new Map(
        (detailRows ?? []).map((item: any) => [
          item.id,
          item,
        ])
      );

      const merged: GivingRow[] =
        (masterlist ?? []).map((item: any) => {
          const detail = detailMap.get(item.id);

          return {
            ...item,
            proof_path: detail?.proof_path ?? null,
            proof_url: null,
            member_note: detail?.member_note ?? null,
            treasurer_note: detail?.treasurer_note ?? null,
          };
        });

      /*
       * Private tithe-proofs bucket:
       * generate temporary signed URLs only for proofs
       * this reviewer is permitted to access.
       */
      const withProofUrls = await Promise.all(
        merged.map(async (item) => {
          if (!item.proof_path) return item;

          const { data, error } =
            await supabase.storage
              .from('tithe-proofs')
              .createSignedUrl(
                item.proof_path,
                10 * 60
              );

          if (error) {
            console.warn(
              'Could not create proof URL:',
              error.message
            );

            return item;
          }

          return {
            ...item,
            proof_url: data.signedUrl,
          };
        })
      );

      withProofUrls.sort((a, b) => {
        if (
          a.status === 'pending' &&
          b.status !== 'pending'
        ) {
          return -1;
        }

        if (
          a.status !== 'pending' &&
          b.status === 'pending'
        ) {
          return 1;
        }

        return (
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
        );
      });

      setRows(withProofUrls);
    } catch (error: any) {
      Alert.alert(
        'Giving Masterlist',
        error?.message ||
          'Could not load giving submissions.'
      );

      setRows([]);
    } finally {
      setLoadingRows(false);
    }
  }, [churchId]);

  useEffect(() => {
    loadAuthorizedChurches();
  }, [loadAuthorizedChurches]);

  useEffect(() => {
    setNotes({});
    loadRows();
  }, [loadRows]);

  const reviewSubmission = (
    item: GivingRow,
    decision: 'verified' | 'rejected'
  ) => {
    const note = notes[item.id]?.trim() ?? '';

    if (decision === 'rejected' && !note) {
      Alert.alert(
        'Treasurer Note Required',
        'Please explain why this submission is being rejected.'
      );
      return;
    }

    const action =
      decision === 'verified'
        ? 'Verify'
        : 'Reject';

    Alert.alert(
      `${action} Submission`,
      `${action} ${money(item.amount)} from ${
        item.full_name || 'this member'
      }?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: action,
          style:
            decision === 'rejected'
              ? 'destructive'
              : 'default',
          onPress: async () => {
            try {
              setReviewingId(item.id);

              const { error } = await supabase.rpc(
                'review_tithe_submission',
                {
                  p_submission_id: item.id,
                  p_decision: decision,
                  p_treasurer_note:
                    note || null,
                }
              );

              if (error) throw error;

              setNotes((current) => ({
                ...current,
                [item.id]: '',
              }));

              await loadRows();

              Alert.alert(
                decision === 'verified'
                  ? 'Giving Verified'
                  : 'Submission Rejected',
                decision === 'verified'
                  ? 'The giving record has been verified successfully.'
                  : 'The submission has been rejected and the member can see the Treasurer note.'
              );
            } catch (error: any) {
              Alert.alert(
                'Could Not Review',
                error?.message ||
                  'Could not review this giving submission.'
              );
            } finally {
              setReviewingId(null);
            }
          },
        },
      ]
    );
  };

  const renderSubmission = (item: GivingRow) => {
    const pending = item.status === 'pending';

    return (
      <Card key={item.id}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.memberName}>
              {resolvePersonDisplayName(
                item.full_name,
                item.user_id,
              )}
            </Text>

            <Text style={styles.date}>
              Payment Date: {item.payment_date}
            </Text>
          </View>

          <Text style={styles.amount}>
            {money(item.amount)}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.methodBadge}>
            {item.payment_method.toUpperCase()}
          </Text>

          <Text style={styles.typeBadge}>
            {item.giving_type.toUpperCase()}
          </Text>

          <View
            style={[
              styles.statusBadge,
              item.status === 'verified' &&
                styles.statusVerified,
              item.status === 'rejected' &&
                styles.statusRejected,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                item.status === 'verified' &&
                  styles.statusVerifiedText,
                item.status === 'rejected' &&
                  styles.statusRejectedText,
              ]}
            >
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>

        {!!item.reference_number && (
          <View style={styles.detailBlock}>
            <Text style={styles.detailLabel}>
              REFERENCE NUMBER
            </Text>

            <Text style={styles.reference}>
              {item.reference_number}
            </Text>
          </View>
        )}

        {!!item.member_note && (
          <View style={styles.detailBlock}>
            <Text style={styles.detailLabel}>
              MEMBER NOTE
            </Text>

            <Text style={styles.detailText}>
              {item.member_note}
            </Text>
          </View>
        )}

        <View style={styles.detailBlock}>
          <Text style={styles.detailLabel}>
            PAYMENT PROOF
          </Text>

          {item.proof_url ? (
            <Image
              source={{ uri: item.proof_url }}
              style={styles.proof}
              resizeMode="contain"
            />
          ) : item.proof_path ? (
            <Text style={shared.muted}>
              Proof is attached but could not be
              displayed. Reload the page and try again.
            </Text>
          ) : (
            <Text style={shared.muted}>
              No payment proof attached.
            </Text>
          )}
        </View>

        {pending ? (
          <>
            <Text style={styles.noteLabel}>
              TREASURER NOTE
            </Text>

            <TextInput
              value={notes[item.id] ?? ''}
              onChangeText={(value) =>
                setNotes((current) => ({
                  ...current,
                  [item.id]: value,
                }))
              }
              multiline
              placeholder="Optional for verification; required when rejecting..."
              placeholderTextColor="#8A948E"
              style={styles.noteInput}
            />

            <View style={styles.reviewActions}>
              <Pressable
                disabled={reviewingId === item.id}
                onPress={() =>
                  reviewSubmission(
                    item,
                    'verified'
                  )
                }
                style={[
                  styles.verifyButton,
                  reviewingId === item.id && {
                    opacity: 0.55,
                  },
                ]}
              >
                <Text style={styles.verifyText}>
                  {reviewingId === item.id
                    ? 'PROCESSING...'
                    : 'VERIFY'}
                </Text>
              </Pressable>

              <Pressable
                disabled={reviewingId === item.id}
                onPress={() =>
                  reviewSubmission(
                    item,
                    'rejected'
                  )
                }
                style={[
                  styles.rejectButton,
                  reviewingId === item.id && {
                    opacity: 0.55,
                  },
                ]}
              >
                <Text style={styles.rejectText}>
                  REJECT
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.reviewedBlock}>
            {!!item.verifier_name && (
              <Text style={styles.reviewedText}>
                Reviewed by: {item.verifier_name}
              </Text>
            )}

            {!!item.verified_at && (
              <Text style={styles.reviewedText}>
                Reviewed: {dateTime(item.verified_at)}
              </Text>
            )}

            {!!item.treasurer_note && (
              <>
                <Text style={styles.reviewedLabel}>
                  TREASURER NOTE
                </Text>

                <Text style={styles.reviewedText}>
                  {item.treasurer_note}
                </Text>
              </>
            )}
          </View>
        )}
      </Card>
    );
  };

  return (
    <ScrollView
      style={shared.screen}
      contentContainerStyle={shared.content}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable
        onPress={() => router.back()}
        style={styles.back}
      >
        <Text style={styles.backText}>
          ‹ BACK
        </Text>
      </Pressable>

      <Text style={shared.h1}>
        Giving Verification
      </Text>

      <Text style={shared.muted}>
        Review Local Church giving submissions,
        payment references and proof of payment.
      </Text>

      {loadingChurches ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.green} />
          <Text style={shared.muted}>
            Checking Treasurer authorization...
          </Text>
        </View>
      ) : churches.length === 0 ? (
        <Card>
          <Text style={styles.noAccessTitle}>
            No Giving Verification Access
          </Text>

          <Text style={shared.muted}>
            Your account is not currently authorized
            to verify giving for any Local Church.
          </Text>
        </Card>
      ) : (
        <>
          <SectionTitle>
            AUTHORIZED LOCAL CHURCH
          </SectionTitle>

          <View style={styles.churchWrap}>
            {churches.map((church) => {
              const selected =
                church.id === churchId;

              return (
                <Pressable
                  key={church.id}
                  onPress={() =>
                    setChurchId(church.id)
                  }
                  style={[
                    styles.churchChip,
                    selected &&
                      styles.churchChipOn,
                  ]}
                >
                  <Text
                    style={[
                      styles.churchText,
                      selected &&
                        styles.churchTextOn,
                    ]}
                  >
                    {church.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryEyebrow}>
              {selectedChurch?.name}
            </Text>

            <Text style={styles.summaryNumber}>
              {pendingRows.length}
            </Text>

            <Text style={styles.summaryLabel}>
              submission
              {pendingRows.length === 1
                ? ''
                : 's'}{' '}
              awaiting verification
            </Text>
          </View>

          {loadingRows ? (
            <View style={styles.loading}>
              <ActivityIndicator
                color={colors.green}
              />
              <Text style={shared.muted}>
                Loading giving records...
              </Text>
            </View>
          ) : (
            <>
              <SectionTitle>
                PENDING VERIFICATION
              </SectionTitle>

              {pendingRows.length === 0 ? (
                <Card>
                  <Text style={shared.muted}>
                    No pending giving submissions.
                  </Text>
                </Card>
              ) : (
                pendingRows.map(renderSubmission)
              )}

              <SectionTitle>
                REVIEWED RECORDS
              </SectionTitle>

              {reviewedRows.length === 0 ? (
                <Card>
                  <Text style={shared.muted}>
                    No reviewed giving records yet.
                  </Text>
                </Card>
              ) : (
                reviewedRows.map(renderSubmission)
              )}
            </>
          )}
        </>
      )}

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  back: {
    alignSelf: 'flex-start',
    marginBottom: 12,
  },

  backText: {
    color: colors.green,
    fontWeight: '900',
    fontSize: 11,
  },

  loading: {
    minHeight: 130,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },

  churchWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  churchChip: {
    borderWidth: 1,
    borderColor: '#D8E3DC',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },

  churchChipOn: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },

  churchText: {
    color: colors.green,
    fontSize: 11,
    fontWeight: '800',
  },

  churchTextOn: {
    color: '#FFFFFF',
  },

  summaryCard: {
    marginTop: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(39,93,69,0.13)',
    borderRadius: 18,
    backgroundColor: 'rgba(39,93,69,0.055)',
  },

  summaryEyebrow: {
    color: colors.green,
    fontSize: 11,
    fontWeight: '900',
  },

  summaryNumber: {
    marginTop: 7,
    fontSize: 31,
    fontWeight: '900',
    color: '#1D2A23',
  },

  summaryLabel: {
    color: '#6F7C74',
    fontSize: 12,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  memberName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1D2A23',
  },

  date: {
    marginTop: 3,
    color: '#78847D',
    fontSize: 11,
  },

  amount: {
    color: colors.green,
    fontSize: 19,
    fontWeight: '900',
  },

  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
  },

  methodBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: '#EAF4EE',
    color: colors.green,
    fontSize: 9,
    fontWeight: '900',
  },

  typeBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: '#EFF1F0',
    color: '#536059',
    fontSize: 9,
    fontWeight: '900',
  },

  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 15,
    backgroundColor: '#FFF3CC',
  },

  statusText: {
    color: '#765E0C',
    fontSize: 9,
    fontWeight: '900',
  },

  statusVerified: {
    backgroundColor: '#DFF3E6',
  },

  statusVerifiedText: {
    color: '#21633E',
  },

  statusRejected: {
    backgroundColor: '#F8E2E2',
  },

  statusRejectedText: {
    color: '#8A3030',
  },

  detailBlock: {
    marginTop: 14,
  },

  detailLabel: {
    marginBottom: 5,
    color: '#708078',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  reference: {
    color: '#1D2A23',
    fontSize: 15,
    fontWeight: '900',
  },

  detailText: {
    color: '#354139',
    fontSize: 12,
    lineHeight: 18,
  },

  proof: {
    width: '100%',
    height: 300,
    borderRadius: 14,
    backgroundColor: '#F1F4F2',
  },

  noteLabel: {
    marginTop: 16,
    marginBottom: 6,
    color: colors.green,
    fontSize: 10,
    fontWeight: '900',
  },

  noteInput: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: '#D8E3DC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingTop: 11,
    textAlignVertical: 'top',
    backgroundColor: '#FFFFFF',
    color: '#1D2A23',
  },

  reviewActions: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 13,
  },

  verifyButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.green,
  },

  verifyText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 11,
  },

  rejectButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#A43A3A',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },

  rejectText: {
    color: '#A43A3A',
    fontWeight: '900',
    fontSize: 11,
  },

  reviewedBlock: {
    marginTop: 15,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F3F6F4',
  },

  reviewedLabel: {
    marginTop: 8,
    fontSize: 9,
    fontWeight: '900',
    color: '#6B776F',
  },

  reviewedText: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 16,
    color: '#4E5A53',
  },

  noAccessTitle: {
    marginBottom: 5,
    fontSize: 14,
    fontWeight: '900',
  },
});