import * as React from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';

const QUIZ_ENTRY_ENDPOINT =
  'https://cjtehbfspgimyhifnjon.supabase.co/functions/v1/buklod-quiz-main-entry-v1';

const QUIZ_PUBLISHABLE_KEY =
  'sb_publishable_06d3QBjV_26E8Rk9rS4GMw_SCJ6P8sO';

type ClassroomRow = {
  id: string;
  name: string;
  subject_code: string | null;
  section_name: string | null;
  school_year: string | null;
  term: string | null;
  status: string;
  description: string | null;
};

type EnrollmentRow = {
  classroom_id: string;
  status: string;
  enrolled_at: string;
};

type QuizEntryPayload = {
  ok?: boolean;
  error?: string;
  message?: string;
  launch_url?: string;
  quiz_url?: string;
  one_time_code?: string | null;
  retry_after_ms?: number;
};

export default function StudentClassroomScreen() {
  const { colors, shared, theme } = useBuklodPresentation();
  const { profile, session } = useAuth();

  const [classrooms, setClassrooms] =
    React.useState<ClassroomRow[]>([]);
  const [enrollmentByClassroom, setEnrollmentByClassroom] =
    React.useState<Record<string, EnrollmentRow>>({});
  const [loading, setLoading] = React.useState(true);
  const [openingQuiz, setOpeningQuiz] = React.useState(false);
  const [loadMessage, setLoadMessage] = React.useState<string | null>(null);
  const [fallbackCode, setFallbackCode] = React.useState<string | null>(null);
  const entryInFlight = React.useRef(false);

  React.useEffect(() => {
    let active = true;

    const load = async () => {
      if (!profile?.id) {
        if (active) setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setLoadMessage(null);

        const enrollmentResult = await (supabase as any)
          .from('buklod_education_enrollments')
          .select('classroom_id,status,enrolled_at')
          .eq('student_user_id', profile.id)
          .order('enrolled_at', { ascending: false })
          .limit(100);

        if (enrollmentResult.error) {
          throw enrollmentResult.error;
        }

        const enrollments =
          (enrollmentResult.data ?? []) as EnrollmentRow[];

        const activeEnrollments = enrollments.filter((item) => {
          const status = String(item.status ?? '').toUpperCase();
          return ![
            'REMOVED',
            'DROPPED',
            'REJECTED',
            'INACTIVE',
          ].includes(status);
        });

        const ids = Array.from(
          new Set(
            activeEnrollments
              .map((item) => item.classroom_id)
              .filter(Boolean),
          ),
        );

        if (active) {
          setEnrollmentByClassroom(
            Object.fromEntries(
              activeEnrollments.map((item) => [
                item.classroom_id,
                item,
              ]),
            ),
          );
        }

        if (ids.length === 0) {
          if (active) setClassrooms([]);
          return;
        }

        const classroomResult = await (supabase as any)
          .from('buklod_education_classrooms')
          .select(
            'id,name,subject_code,section_name,school_year,term,status,description',
          )
          .in('id', ids)
          .order('updated_at', { ascending: false })
          .limit(100);

        if (classroomResult.error) {
          throw classroomResult.error;
        }

        if (active) {
          setClassrooms(
            (classroomResult.data ?? []) as ClassroomRow[],
          );
        }
      } catch (error: any) {
        if (active) {
          setClassrooms([]);
          setLoadMessage(
            error?.message ||
              'Your classroom list could not be loaded right now.',
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [profile?.id]);

  const openBuklodQuiz = React.useCallback(async () => {
    if (entryInFlight.current || openingQuiz) return;

    const accessToken = session?.access_token;
    if (!accessToken) {
      Alert.alert(
        'BUKLOD session required',
        'Please sign in to BUKLOD Main again.',
      );
      return;
    }

    entryInFlight.current = true;
    setOpeningQuiz(true);
    setFallbackCode(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(QUIZ_ENTRY_ENDPOINT, {
        method: 'POST',
        headers: {
          apikey: QUIZ_PUBLISHABLE_KEY,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ source: 'buklod_main_my_classroom' }),
        signal: controller.signal,
      });

      const payload =
        (await response.json().catch(() => ({}))) as QuizEntryPayload;

      if (!response.ok || !payload.ok || !payload.launch_url) {
        if (response.status === 409 && payload.error === 'entry_already_in_progress') {
          Alert.alert(
            'Quiz entry already in progress',
            'Please tap only once. Your previous request is still being processed.',
          );
          return;
        }

        throw new Error(
          payload.message ||
            'BUKLOD Quiz entry could not be created.',
        );
      }

      try {
        await Linking.openURL(payload.launch_url);
      } catch (linkError) {
        if (payload.one_time_code) {
          setFallbackCode(String(payload.one_time_code));
        }

        if (payload.quiz_url) {
          await Linking.openURL(payload.quiz_url);
          return;
        }

        throw linkError;
      }
    } catch (error: any) {
      const timedOut =
        error?.name === 'AbortError' ||
        String(error?.message ?? '')
          .toLowerCase()
          .includes('abort');

      Alert.alert(
        timedOut ? 'Quiz entry timed out' : 'Cannot enter BUKLOD Quiz',
        timedOut
          ? 'No repeated request was sent. Check your connection, then tap Enter BUKLOD Quiz once.'
          : error?.message ||
              'Please check your connection and try once again.',
      );
    } finally {
      clearTimeout(timeoutId);
      entryInFlight.current = false;
      setOpeningQuiz(false);
    }
  }, [openingQuiz, session?.access_token]);

  return (
    <ScrollView
      style={shared.screen}
      contentContainerStyle={{
        paddingHorizontal: 14,
        paddingTop: 12,
        paddingBottom: 32,
        gap: 12,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={({ pressed }) => ({
            width: 42,
            height: 42,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: colors.line,
            backgroundColor: colors.white,
            opacity: pressed ? 0.65 : 1,
          })}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={22}
            color={colors.greenDark}
          />
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text style={[shared.h1, { fontSize: 21 }]}>MY CLASSROOM</Text>
          <Text style={[shared.muted, { marginTop: 2 }]}>Student side</Text>
        </View>
      </View>

      <View
        style={{
          borderRadius: 20,
          padding: 16,
          borderWidth: 1,
          borderColor: colors.line,
          backgroundColor: theme.cardSurface,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.greenSoft,
            }}
          >
            <MaterialCommunityIcons
              name="clipboard-text-clock-outline"
              size={25}
              color={colors.greenDark}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: colors.text,
                fontSize: 17,
                fontWeight: '900',
              }}
            >
              BUKLOD Quiz
            </Text>
            <Text
              style={{
                marginTop: 3,
                color: colors.muted,
                fontSize: 12,
                lineHeight: 17,
              }}
            >
              Your BUKLOD Main sign-in is your account proof. Enter the class code given by your examiner inside BUKLOD Quiz.
            </Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Enter BUKLOD Quiz"
          disabled={openingQuiz}
          onPress={() => void openBuklodQuiz()}
          style={({ pressed }) => ({
            marginTop: 14,
            minHeight: 48,
            borderRadius: 15,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
            backgroundColor: colors.greenDark,
            opacity: openingQuiz ? 0.6 : pressed ? 0.78 : 1,
          })}
        >
          {openingQuiz ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <MaterialCommunityIcons
              name="login-variant"
              size={20}
              color="#FFFFFF"
            />
          )}
          <Text
            style={{
              color: '#FFFFFF',
              fontWeight: '900',
              fontSize: 13,
              letterSpacing: 0.3,
            }}
          >
            {openingQuiz ? 'VERIFYING MAIN SESSION...' : 'ENTER BUKLOD QUIZ'}
          </Text>
        </Pressable>

        <Text
          style={{
            marginTop: 9,
            color: colors.muted,
            fontSize: 10.5,
            lineHeight: 15,
            textAlign: 'center',
          }}
        >
          One tap sends only one handoff request. No email/SMS OTP and no repeated password check.
        </Text>

        {fallbackCode ? (
          <View
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.line,
              backgroundColor: colors.greenSoft,
            }}
          >
            <Text
              style={{
                color: colors.muted,
                fontSize: 10,
                fontWeight: '800',
              }}
            >
              ONE-TIME QUIZ CODE
            </Text>
            <Text
              selectable
              style={{
                marginTop: 4,
                color: colors.greenDark,
                fontSize: 22,
                fontWeight: '900',
                letterSpacing: 3,
              }}
            >
              {fallbackCode}
            </Text>
          </View>
        ) : null}
      </View>

      <View>
        <Text
          style={{
            color: colors.text,
            fontSize: 15,
            fontWeight: '900',
          }}
        >
          My Classes
        </Text>
        <Text
          style={{
            marginTop: 3,
            color: colors.muted,
            fontSize: 11,
          }}
        >
          Classroom enrollment is separate from Quiz live class codes.
        </Text>
      </View>

      {loading ? (
        <View style={{ paddingVertical: 24, alignItems: 'center' }}>
          <ActivityIndicator color={colors.greenDark} />
        </View>
      ) : classrooms.length > 0 ? (
        classrooms.map((item) => {
          const enrollment = enrollmentByClassroom[item.id];
          const subtitle = [
            item.subject_code,
            item.section_name,
            item.term,
            item.school_year,
          ]
            .filter(Boolean)
            .join(' • ');

          return (
            <View
              key={item.id}
              style={{
                padding: 14,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: colors.line,
                backgroundColor: colors.white,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 11,
                }}
              >
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.greenSoft,
                  }}
                >
                  <MaterialCommunityIcons
                    name="school-outline"
                    size={22}
                    color={colors.greenDark}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 14,
                      fontWeight: '900',
                    }}
                  >
                    {item.name}
                  </Text>
                  {subtitle ? (
                    <Text
                      style={{
                        marginTop: 3,
                        color: colors.muted,
                        fontSize: 10.5,
                      }}
                    >
                      {subtitle}
                    </Text>
                  ) : null}
                </View>

                {enrollment?.status ? (
                  <Text
                    style={{
                      color: colors.greenDark,
                      fontSize: 9,
                      fontWeight: '900',
                    }}
                  >
                    {String(enrollment.status).toUpperCase()}
                  </Text>
                ) : null}
              </View>

              {item.description ? (
                <Text
                  numberOfLines={3}
                  style={{
                    marginTop: 10,
                    color: colors.muted,
                    fontSize: 11,
                    lineHeight: 16,
                  }}
                >
                  {item.description}
                </Text>
              ) : null}
            </View>
          );
        })
      ) : (
        <View
          style={{
            padding: 16,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.line,
            backgroundColor: colors.white,
          }}
        >
          <Text
            style={{
              color: colors.text,
              fontSize: 13,
              fontWeight: '900',
            }}
          >
            No classroom enrollment yet
          </Text>
          <Text
            style={{
              marginTop: 5,
              color: colors.muted,
              fontSize: 11,
              lineHeight: 16,
            }}
          >
            You can still enter BUKLOD Quiz above. A live exam uses the class code provided by the examiner.
          </Text>
          {loadMessage ? (
            <Text
              style={{
                marginTop: 7,
                color: colors.muted,
                fontSize: 10,
              }}
            >
              {loadMessage}
            </Text>
          ) : null}
        </View>
      )}
    </ScrollView>
  );
}
