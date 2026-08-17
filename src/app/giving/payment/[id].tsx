import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import { supabase } from '@/lib/supabase';
import {
  Card,
  SectionTitle,
  shared,
} from '@/components/UI';


type PaymentEvent = {
  event_id: string;

  event_type:
    | 'transaction_created'
    | 'status_changed'
    | 'provider_reference_updated';

  old_status:
    | 'pending'
    | 'processing'
    | 'paid'
    | 'failed'
    | 'cancelled'
    | null;

  new_status:
    | 'pending'
    | 'processing'
    | 'paid'
    | 'failed'
    | 'cancelled'
    | null;

  event_source:
    | 'member'
    | 'authorized_staff'
    | 'trusted_backend'
    | 'database';

  provider_reference:
    | string
    | null;

  confirmation_source:
    | string
    | null;

  failure_code:
    | string
    | null;

  failure_message:
    | string
    | null;

  created_at: string;
};


function statusLabel(
  value: PaymentEvent['new_status']
) {
  if (!value) return '';

  return value
    .replace(/_/g, ' ')
    .toUpperCase();
}


function eventTitle(
  event: PaymentEvent
) {
  switch (event.event_type) {
    case 'transaction_created':
      return 'PAYMENT STARTED';

    case 'status_changed':
      return 'STATUS UPDATED';

    case 'provider_reference_updated':
      return 'PROVIDER UPDATE';

    default:
      return 'PAYMENT ACTIVITY';
  }
}


function sourceLabel(
  source: PaymentEvent['event_source']
) {
  switch (source) {
    case 'member':
      return 'Member';

    case 'authorized_staff':
      return 'Authorized Church Team';

    case 'trusted_backend':
      return 'Trusted Payment Backend';

    case 'database':
      return 'BUKLOD System';

    default:
      return 'System';
  }
}


function statusColor(
  status: PaymentEvent['new_status']
) {
  switch (status) {
    case 'paid':
      return {
        backgroundColor: '#DFF3E6',
        color: '#176B3A',
      };

    case 'failed':
      return {
        backgroundColor: '#FDE6E6',
        color: '#9A2F2F',
      };

    case 'cancelled':
      return {
        backgroundColor: '#EEF0EF',
        color: '#68756D',
      };

    case 'processing':
      return {
        backgroundColor: '#FFF6D8',
        color: '#705B16',
      };

    default:
      return {
        backgroundColor: '#EEF4F0',
        color: '#42564A',
      };
  }
}


export default function PaymentAuditScreen() {
  // PATCH_153F_4C1_PAYMENT_AUDIT_SCREEN

  const params =
    useLocalSearchParams<{
      id?: string | string[];
    }>();

  const transactionId =
    Array.isArray(params.id)
      ? params.id[0]
      : params.id;

  const [
    events,
    setEvents,
  ] = useState<PaymentEvent[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(null);


  const loadEvents =
    useCallback(async () => {

      if (!transactionId) {
        setErrorMessage(
          'Payment transaction ID is missing.'
        );

        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setErrorMessage(null);

        const {
          data,
          error,
        } = await (supabase as any).rpc(
          'get_my_giving_payment_events',
          {
            p_transaction_id:
              transactionId,
          }
        );

        if (error) {
          /*
           * PATCH 153F migrations are still
           * local-only until deliberate deployment.
           *
           * Do not crash staging if the RPC is
           * not available there yet.
           */
          console.warn(
            'Payment audit:',
            error.message
          );

          setEvents([]);

          setErrorMessage(
            'Payment activity is not available on the current server yet.'
          );

          return;
        }

        setEvents(
          (data ?? []) as PaymentEvent[]
        );

      } catch (error: any) {

        console.warn(
          'Payment audit:',
          error?.message
        );

        setEvents([]);

        setErrorMessage(
          'Could not load payment activity.'
        );

      } finally {
        setLoading(false);
      }

    }, [transactionId]);


  useEffect(() => {
    loadEvents();
  }, [loadEvents]);


  return (
    <ScrollView
      style={shared.screen}
      contentContainerStyle={
        shared.content
      }
    >
      <Pressable
        onPress={() => router.back()}
        style={styles.backButton}
      >
        <Text style={styles.backText}>
          ‹ BACK
        </Text>
      </Pressable>


      <Text style={shared.h1}>
        Payment Activity
      </Text>

      <Text style={shared.muted}>
        Secure status history for this
        payment transaction.
      </Text>


      <View style={styles.securityNotice}>
        <Text style={styles.securityTitle}>
          VERIFIED PAYMENT RECORD
        </Text>

        <Text style={styles.securityText}>
          Returning from GCash or a banking
          app does not mark a payment as Paid.
          Paid status requires confirmation
          from the trusted payment backend.
        </Text>
      </View>


      <SectionTitle>
        TRANSACTION TIMELINE
      </SectionTitle>


      {loading ? (
        <Card>
          <View style={styles.loadingWrap}>
            <ActivityIndicator />

            <Text style={shared.muted}>
              Loading payment activity...
            </Text>
          </View>
        </Card>
      ) : errorMessage ? (
        <Card>
          <Text style={styles.errorText}>
            {errorMessage}
          </Text>

          <Pressable
            onPress={loadEvents}
            style={styles.refreshButton}
          >
            <Text style={styles.refreshText}>
              TRY AGAIN
            </Text>
          </Pressable>
        </Card>
      ) : events.length === 0 ? (
        <Card>
          <Text style={shared.muted}>
            No payment activity has been
            recorded yet.
          </Text>
        </Card>
      ) : (
        events.map(
          (event, index) => {

            const appearance =
              statusColor(
                event.new_status
              );

            return (
              <Card key={event.event_id}>
                <View style={styles.eventHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eventTitle}>
                      {eventTitle(event)}
                    </Text>

                    <Text style={styles.eventNumber}>
                      EVENT {index + 1}
                    </Text>
                  </View>

                  {!!event.new_status && (
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor:
                            appearance.backgroundColor,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          {
                            color:
                              appearance.color,
                          },
                        ]}
                      >
                        {statusLabel(
                          event.new_status
                        )}
                      </Text>
                    </View>
                  )}
                </View>


                {event.event_type ===
                  'status_changed' && (
                  <View style={styles.transitionBox}>
                    <Text style={styles.transitionLabel}>
                      STATUS TRANSITION
                    </Text>

                    <Text style={styles.transitionText}>
                      {event.old_status
                        ? statusLabel(
                            event.old_status
                          )
                        : '—'}
                      {'  →  '}
                      {event.new_status
                        ? statusLabel(
                            event.new_status
                          )
                        : '—'}
                    </Text>
                  </View>
                )}


                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>
                    SOURCE
                  </Text>

                  <Text style={styles.detailValue}>
                    {sourceLabel(
                      event.event_source
                    )}
                  </Text>
                </View>


                {!!event.provider_reference && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>
                      PROVIDER REFERENCE
                    </Text>

                    <Text style={styles.detailValue}>
                      {event.provider_reference}
                    </Text>
                  </View>
                )}


                {!!event.confirmation_source && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>
                      CONFIRMATION
                    </Text>

                    <Text style={styles.detailValue}>
                      {event.confirmation_source
                        .replace(/_/g, ' ')
                        .toUpperCase()}
                    </Text>
                  </View>
                )}


                {!!event.failure_code && (
                  <View style={styles.failureBox}>
                    <Text style={styles.failureTitle}>
                      {event.failure_code}
                    </Text>

                    {!!event.failure_message && (
                      <Text style={styles.failureMessage}>
                        {event.failure_message}
                      </Text>
                    )}
                  </View>
                )}


                <Text style={styles.dateText}>
                  {new Date(
                    event.created_at
                  ).toLocaleString()}
                </Text>
              </Card>
            );
          }
        )
      )}


      <Pressable
        onPress={loadEvents}
        disabled={loading}
        style={styles.refreshBottom}
      >
        <Text style={styles.refreshBottomText}>
          REFRESH ACTIVITY
        </Text>
      </Pressable>


      <View style={{ height: 30 }} />
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 12,
  },

  backText: {
    color: '#176B3A',
    fontSize: 11,
    fontWeight: '900',
  },

  securityNotice: {
    marginTop: 16,
    marginBottom: 18,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#F4F8F5',
    borderWidth: 1,
    borderColor: '#D8E3DC',
  },

  securityTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#176B3A',
    letterSpacing: 0.8,
  },

  securityText: {
    marginTop: 6,
    fontSize: 11,
    lineHeight: 17,
    color: '#68756D',
  },

  loadingWrap: {
    minHeight: 90,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },

  errorText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#9A2F2F',
  },

  refreshButton: {
    marginTop: 14,
    alignSelf: 'flex-start',
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#176B3A',
  },

  refreshText: {
    color: '#176B3A',
    fontSize: 10,
    fontWeight: '900',
  },

  eventHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },

  eventTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#15231B',
  },

  eventNumber: {
    marginTop: 3,
    fontSize: 9,
    fontWeight: '800',
    color: '#8A958E',
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },

  statusBadgeText: {
    fontSize: 9,
    fontWeight: '900',
  },

  transitionBox: {
    marginTop: 13,
    padding: 11,
    borderRadius: 10,
    backgroundColor: '#F6F8F7',
  },

  transitionLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#68756D',
  },

  transitionText: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '900',
    color: '#15231B',
  },

  detailRow: {
    marginTop: 12,
  },

  detailLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#8A958E',
  },

  detailValue: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 16,
    color: '#42564A',
    fontWeight: '700',
  },

  failureBox: {
    marginTop: 13,
    padding: 11,
    borderRadius: 10,
    backgroundColor: '#FDEEEE',
  },

  failureTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#9A2F2F',
  },

  failureMessage: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 16,
    color: '#8B4343',
  },

  dateText: {
    marginTop: 14,
    fontSize: 10,
    color: '#8A958E',
  },

  refreshBottom: {
    marginTop: 8,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#176B3A',
  },

  refreshBottomText: {
    color: '#176B3A',
    fontSize: 10,
    fontWeight: '900',
  },
});