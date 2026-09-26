import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  findLifeQuestion,
  findLifeTopic,
  LIFE_ADDITIONAL_TOPICS,
  LIFE_CRISIS_COPY,
  LIFE_GOSPEL_CORE_VERSION,
  LIFE_GOSPEL_STEPS,
  LIFE_NEXT_STEPS,
  LIFE_PRIMARY_TOPICS,
  LIFE_QUESTIONS,
  LIFE_RESPONSE_EXPLANATION,
  LIFE_SAMPLE_PRAYER,
  LIFE_SCRIPTURE_PACK_VERSION,
  LIFE_SOUL_WINNER_GUIDE,
  LIFE_SOUL_WINNER_GUIDE_VERSION,
  LIFE_SOUL_WINNER_ISSUES,
  scriptureForReferences,
} from '@/lib/buklodLifeContent';
import { useNetwork } from '@/providers/NetworkProvider';
import { useBuklodI18n } from '@/providers/BuklodI18nProvider';
import { useAuth } from '@/providers/AuthProvider';
import { trackBuklodLifeEvent } from '@/lib/buklodLifeTelemetry';

type LifePage =
  | 'home'
  | 'topic'
  | 'questions'
  | 'question'
  | 'gospel'
  | 'response'
  | 'response-yes'
  | 'soul-winner'
  | 'perspective'
  | 'crisis';

type LifePrivateProgress = {
  page:
    | 'topic'
    | 'questions'
    | 'question'
    | 'gospel'
    | 'soul-winner'
    | 'perspective';
  topicId: string;
  questionId: string;
  gospelStep: number;
  contentVersion: string;
};

const LIFE_PRIVATE_PROGRESS_PREFIX =
  '@buklod/life/private-progress-v1/';

function isLifePrivateProgress(
  value: unknown,
): value is LifePrivateProgress {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    [
      'topic',
      'questions',
      'question',
      'gospel',
      'soul-winner',
      'perspective',
    ].includes(String(row.page ?? '')) &&
    typeof row.topicId === 'string' &&
    typeof row.questionId === 'string' &&
    Number.isInteger(Number(row.gospelStep)) &&
    typeof row.contentVersion === 'string'
  );
}

function ActionButton({
  label,
  onPress,
  secondary = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.actionButton,
        secondary && styles.actionButtonSecondary,
      ]}
    >
      <Text
        style={[
          styles.actionButtonText,
          secondary && styles.actionButtonTextSecondary,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function InfoCard({
  title,
  body,
  icon = 'lightbulb-outline',
}: {
  title: string;
  body: string;
  icon?: string;
}) {
  return (
    <View style={styles.infoCard}>
      <View style={styles.infoIcon}>
        <MaterialCommunityIcons
          name={icon as any}
          size={18}
          color="#275D45"
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoTitle}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
    </View>
  );
}

export default function BuklodLifeScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { online } = useNetwork();
  const { locale } = useBuklodI18n();
  const { user } = useAuth();

  const [resumePoint, setResumePoint] =
    useState<LifePrivateProgress | null>(null);
  const telemetrySeenRef = useRef(new Set<string>());
  const lastLocaleRef = useRef<string | null>(null);

  const [page, setPage] = useState<LifePage>(
    String(params.mode ?? '').toLowerCase() === 'help'
      ? 'soul-winner'
      : 'home',
  );
  const [topicId, setTopicId] = useState('hope');
  const [questionId, setQuestionId] = useState('why-jesus');
  const [gospelStep, setGospelStep] = useState(0);
  const [soulIssue, setSoulIssue] = useState<string>('Guilt');
  const [gospelLength, setGospelLength] =
    useState<'short' | 'three' | 'full'>('short');

  const privateProgressKey =
    user?.id
      ? LIFE_PRIVATE_PROGRESS_PREFIX + user.id
      : null;

  useEffect(() => {
    if (String(params.mode ?? '').toLowerCase() === 'help') {
      setPage('soul-winner');
    }
  }, [params.mode]);

  useEffect(() => {
    if (!privateProgressKey) {
      setResumePoint(null);
      return;
    }

    let active = true;

    void AsyncStorage.getItem(privateProgressKey)
      .then(raw => {
        if (!active || !raw) return;
        try {
          const parsed = JSON.parse(raw);
          if (
            isLifePrivateProgress(parsed) &&
            parsed.contentVersion === LIFE_GOSPEL_CORE_VERSION
          ) {
            setResumePoint(parsed);
          }
        } catch {
          // Corrupt local progress is ignored; LIFE remains usable.
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [privateProgressKey]);

  useEffect(() => {
    const key = 'life_opened';
    if (telemetrySeenRef.current.has(key)) return;
    telemetrySeenRef.current.add(key);

    void trackBuklodLifeEvent('life_opened', {
      locale,
      online,
    });
  }, [locale, online]);

  useEffect(() => {
    if (lastLocaleRef.current === locale) return;
    lastLocaleRef.current = locale;

    void trackBuklodLifeEvent('life_language_selected', {
      locale,
      online,
    });
  }, [locale, online]);

  useEffect(() => {
    if (online) return;

    const key = 'life_ai_fallback_used';
    if (telemetrySeenRef.current.has(key)) return;
    telemetrySeenRef.current.add(key);

    void trackBuklodLifeEvent('life_ai_fallback_used', {
      locale,
      online: false,
    });
  }, [locale, online]);

  useEffect(() => {
    let event:
      | 'life_topic_opened'
      | 'life_question_opened'
      | 'life_explore_jesus_started'
      | 'life_gospel_step_viewed'
      | 'life_help_someone_opened'
      | 'life_gospel_path_completed'
      | null = null;

    if (page === 'topic') event = 'life_topic_opened';
    else if (page === 'question') event = 'life_question_opened';
    else if (page === 'gospel') event = 'life_gospel_step_viewed';
    else if (page === 'soul-winner') event = 'life_help_someone_opened';
    else if (page === 'response') event = 'life_gospel_path_completed';

    if (!event) return;

    const key =
      event === 'life_gospel_step_viewed'
        ? `${event}:${gospelStep}`
        : event;

    if (telemetrySeenRef.current.has(key)) return;
    telemetrySeenRef.current.add(key);

    void trackBuklodLifeEvent(event, {
      locale,
      online,
    });
  }, [gospelStep, locale, online, page]);

  useEffect(() => {
    if (page !== 'gospel') return;

    const key = 'life_explore_jesus_started';
    if (telemetrySeenRef.current.has(key)) return;
    telemetrySeenRef.current.add(key);

    void trackBuklodLifeEvent('life_explore_jesus_started', {
      locale,
      online,
    });
  }, [locale, online, page]);

  useEffect(() => {
    if (!privateProgressKey) return;

    const saveablePages: LifePrivateProgress['page'][] = [
      'topic',
      'questions',
      'question',
      'gospel',
      'soul-winner',
      'perspective',
    ];

    if (!saveablePages.includes(page as LifePrivateProgress['page'])) {
      return;
    }

    const progress: LifePrivateProgress = {
      page: page as LifePrivateProgress['page'],
      topicId,
      questionId,
      gospelStep,
      contentVersion: LIFE_GOSPEL_CORE_VERSION,
    };

    setResumePoint(progress);

    void AsyncStorage.setItem(
      privateProgressKey,
      JSON.stringify(progress),
    ).catch(() => undefined);
  }, [
    gospelStep,
    page,
    privateProgressKey,
    questionId,
    topicId,
  ]);

  const topic = useMemo(() => findLifeTopic(topicId), [topicId]);
  const question = useMemo(
    () => findLifeQuestion(questionId),
    [questionId],
  );
  const gospel = LIFE_GOSPEL_STEPS[gospelStep] ?? LIFE_GOSPEL_STEPS[0];
  const scriptures = useMemo(
    () => scriptureForReferences(gospel.scriptureRefs),
    [gospel.scriptureRefs],
  );

  const openWall = () => {
    router.replace('/buklod' as any);
  };

  const goBack = () => {
    if (page === 'home') {
      openWall();
      return;
    }
    if (page === 'question') {
      setPage('questions');
      return;
    }
    if (page === 'response-yes') {
      setPage('response');
      return;
    }
    if (page === 'response') {
      setPage('gospel');
      setGospelStep(Math.max(0, LIFE_GOSPEL_STEPS.length - 1));
      return;
    }
    setPage('home');
  };

  const startTopic = (id: string) => {
    setTopicId(id);
    setPage('topic');
  };

  const startGospel = () => {
    setGospelStep(0);
    setPage('gospel');
  };

  const resumeJourney = () => {
    if (!resumePoint) return;
    setTopicId(resumePoint.topicId);
    setQuestionId(resumePoint.questionId);
    setGospelStep(
      Math.max(
        0,
        Math.min(
          LIFE_GOSPEL_STEPS.length - 1,
          resumePoint.gospelStep,
        ),
      ),
    );
    setPage(resumePoint.page);
  };

  const contentWidth =
    width >= 900 ? Math.min(760, width - 80) : width;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={goBack}
          style={styles.headerButton}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={22}
            color="#173F31"
          />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>LIFE</Text>
          <Text style={styles.headerSubtitle}>
            Hope • Purpose • Direction
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to Community Wall"
          onPress={openWall}
          style={styles.headerButton}
        >
          <MaterialCommunityIcons
            name="home-outline"
            size={21}
            color="#173F31"
          />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            width: contentWidth,
            paddingBottom: Math.max(36, insets.bottom + 24),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {!online ? (
          <View style={styles.offlineBanner}>
            <MaterialCommunityIcons
              name="cloud-off-outline"
              size={17}
              color="#5F4A00"
            />
            <Text style={styles.offlineText}>
              You're offline. Core LIFE content is still available.
            </Text>
          </View>
        ) : null}

        {locale !== 'en' ? (
          <View style={styles.languageNotice}>
            <Text style={styles.languageNoticeText}>
              Approved English LIFE content is shown until a reviewed
              language pack is available for your selected language.
            </Text>
          </View>
        ) : null}

        {page === 'home' ? (
          <>
            <View style={styles.hero}>
              <Text style={styles.heroEyebrow}>LIFE</Text>
              <Text style={styles.heroTitle}>What do you need today?</Text>
              <Text style={styles.heroText}>
                Start with what is real. Go deeper only when you choose.
              </Text>
              <View style={styles.versionRow}>
                <Text style={styles.versionText}>
                  Curated core • works without AI
                </Text>
              </View>
            </View>

            {resumePoint ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Continue your private LIFE journey"
                onPress={resumeJourney}
                style={styles.continueCard}
              >
                <View style={styles.continueIcon}>
                  <MaterialCommunityIcons
                    name="bookmark-outline"
                    size={20}
                    color="#275D45"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.continueTitle}>
                    Continue Your Journey
                  </Text>
                  <Text style={styles.continueText}>
                    Private progress saved only for your account on this device.
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={20}
                  color="#60766B"
                />
              </Pressable>
            ) : null}

            <View style={styles.topicGrid}>
              {LIFE_PRIMARY_TOPICS.map(item => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  onPress={() => startTopic(item.id)}
                  style={styles.topicCard}
                >
                  <MaterialCommunityIcons
                    name="compass-outline"
                    size={20}
                    color="#275D45"
                  />
                  <Text style={styles.topicTitle}>{item.title}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.sectionTitle}>More of what life can carry</Text>
            <View style={styles.listCard}>
              {LIFE_ADDITIONAL_TOPICS.map(item => (
                <Pressable
                  key={item.id}
                  onPress={() => startTopic(item.id)}
                  accessibilityRole="button"
                  style={styles.listRow}
                >
                  <Text style={styles.listText}>{item.title}</Text>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={18}
                    color="#6E8178"
                  />
                </Pressable>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Questions worth asking</Text>
            <Pressable
              onPress={() => setPage('questions')}
              style={styles.featureCard}
              accessibilityRole="button"
            >
              <View style={styles.featureIcon}>
                <MaterialCommunityIcons
                  name="help-circle-outline"
                  size={22}
                  color="#275D45"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>
                  Explore honest questions
                </Text>
                <Text style={styles.featureText}>
                  God, suffering, forgiveness, death, salvation and the
                  resurrection.
                </Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color="#647A70"
              />
            </Pressable>

            <Text style={styles.sectionTitle}>Explore Jesus</Text>
            <Pressable
              onPress={startGospel}
              style={styles.jesusCard}
              accessibilityRole="button"
            >
              <Text style={styles.jesusEyebrow}>
                WHO HE IS • WHY HE CAME • WHAT HE OFFERS
              </Text>
              <Text style={styles.jesusTitle}>
                See the Christian Gospel clearly
              </Text>
              <Text style={styles.jesusText}>
                Curated truth. Voluntary response. No pressure.
              </Text>
              <View style={styles.inlineAction}>
                <Text style={styles.inlineActionText}>Explore Jesus</Text>
                <MaterialCommunityIcons
                  name="arrow-right"
                  size={17}
                  color="#FFFFFF"
                />
              </View>
            </Pressable>

            <Text style={styles.sectionTitle}>Help someone</Text>
            <Pressable
              onPress={() => setPage('soul-winner')}
              style={styles.featureCard}
              accessibilityRole="button"
            >
              <View style={styles.featureIcon}>
                <MaterialCommunityIcons
                  name="hand-heart-outline"
                  size={22}
                  color="#275D45"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>
                  A simple guide for sharing hope
                </Text>
                <Text style={styles.featureText}>
                  Listen first. Ask permission. Share Christ clearly.
                  Respect the person's response.
                </Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color="#647A70"
              />
            </Pressable>

            <Pressable
              onPress={() => setPage('perspective')}
              style={styles.quietLink}
              accessibilityRole="button"
            >
              <Text style={styles.quietLinkText}>
                Another faith, skeptical, or hurt by religion?
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setPage('crisis')}
              style={styles.urgentLink}
              accessibilityRole="button"
            >
              <MaterialCommunityIcons
                name="alert-circle-outline"
                size={17}
                color="#8A341F"
              />
              <Text style={styles.urgentLinkText}>
                Need urgent safety help?
              </Text>
            </Pressable>
          </>
        ) : null}

        {page === 'topic' && topic ? (
          <>
            <Text style={styles.pageEyebrow}>START WITH REAL LIFE</Text>
            <Text style={styles.pageTitle}>{topic.title}</Text>
            <InfoCard
              title="First, something practical"
              body={topic.intro}
              icon="lightbulb-outline"
            />
            <InfoCard
              title="One next step"
              body={topic.practical}
              icon="walk"
            />
            <View style={styles.bridgeCard}>
              <Text style={styles.bridgeEyebrow}>A DEEPER QUESTION</Text>
              <Text style={styles.bridgeText}>{topic.bridge}</Text>
            </View>
            <View style={styles.buttonStack}>
              <ActionButton label="Continue" onPress={startGospel} />
              <ActionButton
                label="Ask a Question"
                onPress={() => setPage('questions')}
                secondary
              />
              <ActionButton
                label="Not Now"
                onPress={() => setPage('home')}
                secondary
              />
            </View>
          </>
        ) : null}

        {page === 'questions' ? (
          <>
            <Text style={styles.pageEyebrow}>QUESTIONS WORTH ASKING</Text>
            <Text style={styles.pageTitle}>Ask without pretending</Text>
            <Text style={styles.pageIntro}>
              These answers explain the Christian view without insulting
              another belief or forcing you to agree.
            </Text>
            <View style={styles.listCard}>
              {LIFE_QUESTIONS.map(item => (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    setQuestionId(item.id);
                    setPage('question');
                  }}
                  style={styles.listRow}
                  accessibilityRole="button"
                >
                  <Text style={styles.listText}>{item.question}</Text>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={18}
                    color="#6E8178"
                  />
                </Pressable>
              ))}
            </View>
            <View style={styles.buttonStack}>
              <ActionButton label="Explore Jesus" onPress={startGospel} />
              <ActionButton
                label="Not Now"
                onPress={() => setPage('home')}
                secondary
              />
            </View>
          </>
        ) : null}

        {page === 'question' && question ? (
          <>
            <Text style={styles.pageEyebrow}>A CHRISTIAN PERSPECTIVE</Text>
            <Text style={styles.pageTitle}>{question.question}</Text>
            <View style={styles.answerCard}>
              <Text style={styles.answerText}>{question.answer}</Text>
            </View>
            <View style={styles.buttonStack}>
              <ActionButton label="Explore Jesus" onPress={startGospel} />
              <ActionButton
                label="Ask Another Question"
                onPress={() => setPage('questions')}
                secondary
              />
              <ActionButton
                label="Not Now"
                onPress={() => setPage('home')}
                secondary
              />
            </View>
          </>
        ) : null}

        {page === 'gospel' ? (
          <>
            <Text style={styles.pageEyebrow}>
              EXPLORE JESUS • STEP {gospelStep + 1} OF {LIFE_GOSPEL_STEPS.length}
            </Text>
            <Text style={styles.pageTitle}>{gospel.title}</Text>
            <View style={styles.gospelCard}>
              <Text style={styles.gospelBody}>{gospel.body}</Text>
            </View>

            {scriptures.map(item => (
              <View key={item.reference} style={styles.scriptureCard}>
                <Text style={styles.scriptureRef}>
                  {item.reference} • {item.version}
                </Text>
                <Text style={styles.scriptureText}>{item.text}</Text>
              </View>
            ))}

            <Text style={styles.versionFoot}>
              Gospel core: {LIFE_GOSPEL_CORE_VERSION}
              {'\n'}Scripture pack: {LIFE_SCRIPTURE_PACK_VERSION}
            </Text>

            <View style={styles.buttonStack}>
              <ActionButton
                label={
                  gospelStep >= LIFE_GOSPEL_STEPS.length - 1
                    ? 'Continue to Response'
                    : 'Continue'
                }
                onPress={() => {
                  if (gospelStep >= LIFE_GOSPEL_STEPS.length - 1) {
                    setPage('response');
                  } else {
                    setGospelStep(current => current + 1);
                  }
                }}
              />
              <ActionButton
                label="I Have Questions"
                onPress={() => setPage('questions')}
                secondary
              />
              <ActionButton
                label="Not Now"
                onPress={() => setPage('home')}
                secondary
              />
            </View>
          </>
        ) : null}

        {page === 'response' ? (
          <>
            <Text style={styles.pageEyebrow}>YOUR RESPONSE IS YOUR CHOICE</Text>
            <Text style={styles.pageTitle}>
              Would you like to trust Christ?
            </Text>
            <Text style={styles.pageIntro}>
              No countdown. No pressure. An app cannot manufacture faith or
              declare your spiritual status from a button click.
            </Text>
            <View style={styles.buttonStack}>
              <ActionButton
                label="Yes, I Want to Respond"
                onPress={() => setPage('response-yes')}
              />
              <ActionButton
                label="I Have Questions"
                onPress={() => setPage('questions')}
                secondary
              />
              <ActionButton
                label="Not Now"
                onPress={() => setPage('home')}
                secondary
              />
            </View>
          </>
        ) : null}

        {page === 'response-yes' ? (
          <>
            <Text style={styles.pageEyebrow}>A VOLUNTARY RESPONSE</Text>
            <Text style={styles.pageTitle}>Talk honestly with God</Text>
            <InfoCard
              title="What prayer means here"
              body={LIFE_RESPONSE_EXPLANATION}
              icon="message-outline"
            />
            <View style={styles.prayerCard}>
              <Text style={styles.prayerLabel}>OPTIONAL SAMPLE PRAYER</Text>
              <Text style={styles.prayerText}>{LIFE_SAMPLE_PRAYER}</Text>
            </View>
            <Text style={styles.sectionTitle}>Optional next steps</Text>
            <View style={styles.listCard}>
              {LIFE_NEXT_STEPS.map(item => (
                <View key={item} style={styles.listRow}>
                  <MaterialCommunityIcons
                    name="check-circle-outline"
                    size={17}
                    color="#275D45"
                  />
                  <Text style={[styles.listText, { flex: 1 }]}>{item}</Text>
                </View>
              ))}
            </View>
            <View style={styles.privacyCard}>
              <MaterialCommunityIcons
                name="shield-lock-outline"
                size={20}
                color="#275D45"
              />
              <Text style={styles.privacyText}>
                LIFE does not publish this response, award points or cash,
                notify an Organization, pastor or ordinary BSOC operator, or
                label you SAVED / UNSAVED / CONVERTED from app activity.
              </Text>
            </View>
            <View style={styles.buttonStack}>
              <ActionButton
                label="Continue Exploring Questions"
                onPress={() => setPage('questions')}
              />
              <ActionButton
                label="Back to BUKLOD"
                onPress={openWall}
                secondary
              />
            </View>
          </>
        ) : null}

        {page === 'soul-winner' ? (
          <>
            <Text style={styles.pageEyebrow}>HELP SOMEONE</Text>
            <Text style={styles.pageTitle}>
              A simple guide for sharing hope
            </Text>
            <Text style={styles.pageIntro}>
              Listen first. Do not treat a person like a target or a score.
            </Text>

            <Text style={styles.sectionTitle}>What are they carrying?</Text>
            <View style={styles.chipWrap}>
              {LIFE_SOUL_WINNER_ISSUES.map(issue => (
                <Pressable
                  key={issue}
                  onPress={() => setSoulIssue(issue)}
                  style={[
                    styles.chip,
                    soulIssue === issue && styles.chipActive,
                  ]}
                  accessibilityRole="button"
                >
                  <Text
                    style={[
                      styles.chipText,
                      soulIssue === issue && styles.chipTextActive,
                    ]}
                  >
                    {issue}
                  </Text>
                </Pressable>
              ))}
            </View>

            <InfoCard
              title={soulIssue}
              body={'Try permission before explanation: "Would it be okay if I share something that helped me understand this differently?"'}
              icon="ear-hearing"
            />

            {LIFE_SOUL_WINNER_GUIDE.map(item => (
              <InfoCard
                key={item.title}
                title={item.title}
                body={item.body}
                icon="account-heart-outline"
              />
            ))}

            <Text style={styles.sectionTitle}>Choose the conversation length</Text>
            <View style={styles.chipWrap}>
              {[
                ['short', 'Short version'],
                ['three', '3-minute version'],
                ['full', 'Full conversation'],
              ].map(([key, label]) => (
                <Pressable
                  key={key}
                  onPress={() =>
                    setGospelLength(key as 'short' | 'three' | 'full')
                  }
                  style={[
                    styles.chip,
                    gospelLength === key && styles.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      gospelLength === key && styles.chipTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.answerCard}>
              <Text style={styles.answerText}>
                {gospelLength === 'short'
                  ? 'God made us for relationship with Him. Sin separates us from God. Jesus Christ died for our sins and rose again. Salvation is a gift of grace received through repentance and faith in Him.'
                  : gospelLength === 'three'
                    ? 'Begin with the person, then explain the Gospel in six movements: God, our sin, Jesus Christ, grace, response, and new life. Ask questions along the way instead of delivering a speech.'
                    : 'Use the full curated Gospel path in LIFE. Move slowly enough to listen, clarify questions, use approved Scripture, and respect Interested / Has Questions / Not Ready / Wants Prayer / Professes Faith without turning any response into a score.'}
              </Text>
            </View>

            <View style={styles.privacyCard}>
              <MaterialCommunityIcons
                name="shield-lock-outline"
                size={20}
                color="#275D45"
              />
              <Text style={styles.privacyText}>
                No souls-won leaderboard, points for a profession of faith, cash reward,
                public counter or automatic spiritual-status sharing.
              </Text>
            </View>

            <Text style={styles.versionFoot}>
              Soul Winner guide: {LIFE_SOUL_WINNER_GUIDE_VERSION}
            </Text>

            <View style={styles.buttonStack}>
              <ActionButton label="Open Gospel Core" onPress={startGospel} />
              <ActionButton
                label="Back to LIFE"
                onPress={() => setPage('home')}
                secondary
              />
            </View>
          </>
        ) : null}

        {page === 'perspective' ? (
          <>
            <Text style={styles.pageEyebrow}>YOU CAN BE HONEST HERE</Text>
            <Text style={styles.pageTitle}>
              Another faith, skeptical, or hurt by religion?
            </Text>
            <View style={styles.answerCard}>
              <Text style={styles.answerText}>
                Thank you for being clear. LIFE does not need to insult your
                beliefs to explain the Christian view. If you would like, you
                can explore who Jesus is according to the Christian Gospel.
                You are free to stop at any point.
              </Text>
            </View>
            <View style={styles.buttonStack}>
              <ActionButton label="Continue" onPress={startGospel} />
              <ActionButton
                label="Ask a Question"
                onPress={() => setPage('questions')}
                secondary
              />
              <ActionButton
                label="Not Now"
                onPress={() => setPage('home')}
                secondary
              />
            </View>
          </>
        ) : null}

        {page === 'crisis' ? (
          <>
            <Text style={styles.pageEyebrow}>URGENT SAFETY</Text>
            <Text style={styles.pageTitle}>{LIFE_CRISIS_COPY.title}</Text>
            <View style={styles.crisisCard}>
              <MaterialCommunityIcons
                name="alert-circle-outline"
                size={28}
                color="#8A341F"
              />
              <Text style={styles.crisisText}>{LIFE_CRISIS_COPY.body}</Text>
            </View>
            <Text style={styles.pageIntro}>{LIFE_CRISIS_COPY.note}</Text>
            <View style={styles.buttonStack}>
              <ActionButton
                label="Back to LIFE"
                onPress={() => setPage('home')}
              />
              <ActionButton
                label="Also Show Spiritual Encouragement"
                onPress={() => startTopic('hope')}
                secondary
              />
            </View>
          </>
        ) : null}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Private by default • Curated content • Voluntary response
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.push(
                '/help?category=TECHNICAL&sourceRoute=%2Flife' as any,
              )
            }
          >
            <Text style={styles.helpLink}>Need Help with LIFE?</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F4F7F5',
  },
  header: {
    minHeight: 58,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#DFE8E3',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EEF4F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#173F31',
    fontWeight: '900',
    fontSize: 17,
    letterSpacing: 1.2,
  },
  headerSubtitle: {
    marginTop: 1,
    color: '#687B72',
    fontSize: 10.5,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  content: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  offlineBanner: {
    marginBottom: 10,
    borderRadius: 13,
    backgroundColor: '#FFF6D8',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  offlineText: {
    flex: 1,
    color: '#5F4A00',
    fontSize: 11,
    fontWeight: '800',
  },
  languageNotice: {
    marginBottom: 10,
    borderRadius: 13,
    backgroundColor: '#EEF3F0',
    padding: 10,
  },
  languageNoticeText: {
    color: '#566B61',
    fontSize: 10.5,
    lineHeight: 15,
  },
  hero: {
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DFE8E3',
    padding: 18,
  },
  heroEyebrow: {
    color: '#275D45',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  heroTitle: {
    marginTop: 6,
    color: '#173F31',
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '900',
  },
  heroText: {
    marginTop: 7,
    color: '#65786F',
    fontSize: 13,
    lineHeight: 19,
  },
  versionRow: {
    marginTop: 12,
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#EDF4F0',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  versionText: {
    color: '#486457',
    fontSize: 9.5,
    fontWeight: '800',
  },
  continueCard: {
    marginTop: 10,
    minHeight: 60,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D9E5DF',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  continueIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EDF4F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueTitle: {
    color: '#214F3C',
    fontSize: 12.5,
    fontWeight: '900',
  },
  continueText: {
    marginTop: 2,
    color: '#6B7F75',
    fontSize: 10,
    lineHeight: 14,
  },
  topicGrid: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  topicCard: {
    width: '48%',
    minHeight: 82,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DCE7E1',
    backgroundColor: '#FFFFFF',
    padding: 12,
    justifyContent: 'space-between',
  },
  topicTitle: {
    color: '#214F3C',
    fontSize: 13,
    fontWeight: '900',
  },
  sectionTitle: {
    marginTop: 20,
    marginBottom: 8,
    color: '#294D3E',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  listCard: {
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DFE8E3',
    backgroundColor: '#FFFFFF',
  },
  listRow: {
    minHeight: 48,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E6ECE8',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  listText: {
    flex: 1,
    color: '#315347',
    fontSize: 12,
    fontWeight: '700',
  },
  featureCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DCE7E1',
    backgroundColor: '#FFFFFF',
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#EDF4F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: {
    color: '#214F3C',
    fontSize: 13,
    fontWeight: '900',
  },
  featureText: {
    marginTop: 2,
    color: '#6B7F75',
    fontSize: 10.5,
    lineHeight: 15,
  },
  jesusCard: {
    borderRadius: 18,
    backgroundColor: '#275D45',
    padding: 16,
  },
  jesusEyebrow: {
    color: '#CFE1D7',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  jesusTitle: {
    marginTop: 6,
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  jesusText: {
    marginTop: 5,
    color: '#E3EEE8',
    fontSize: 11.5,
    lineHeight: 17,
  },
  inlineAction: {
    marginTop: 12,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inlineActionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  quietLink: {
    marginTop: 16,
    paddingVertical: 11,
  },
  quietLinkText: {
    color: '#526F61',
    fontSize: 11.5,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  urgentLink: {
    marginTop: 4,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#E8C8BF',
    backgroundColor: '#FFF8F5',
    padding: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  urgentLinkText: {
    color: '#8A341F',
    fontSize: 11,
    fontWeight: '900',
  },
  pageEyebrow: {
    color: '#527063',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  pageTitle: {
    marginTop: 6,
    marginBottom: 10,
    color: '#173F31',
    fontSize: 25,
    lineHeight: 30,
    fontWeight: '900',
  },
  pageIntro: {
    marginBottom: 13,
    color: '#64776E',
    fontSize: 12.5,
    lineHeight: 18,
  },
  infoCard: {
    marginBottom: 9,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DFE8E3',
    backgroundColor: '#FFFFFF',
    padding: 13,
    flexDirection: 'row',
    gap: 10,
  },
  infoIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: '#EDF4F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTitle: {
    color: '#214F3C',
    fontSize: 12.5,
    fontWeight: '900',
  },
  body: {
    marginTop: 3,
    color: '#667A70',
    fontSize: 11.5,
    lineHeight: 17,
  },
  bridgeCard: {
    marginTop: 2,
    borderRadius: 17,
    backgroundColor: '#E8F0EB',
    padding: 14,
  },
  bridgeEyebrow: {
    color: '#527063',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  bridgeText: {
    marginTop: 5,
    color: '#214F3C',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  buttonStack: {
    marginTop: 14,
    gap: 8,
  },
  actionButton: {
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: '#275D45',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  actionButtonSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#C9D9D1',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  actionButtonTextSecondary: {
    color: '#275D45',
  },
  answerCard: {
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#DFE8E3',
    backgroundColor: '#FFFFFF',
    padding: 15,
  },
  answerText: {
    color: '#375A4B',
    fontSize: 13,
    lineHeight: 20,
  },
  gospelCard: {
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9E5DF',
    padding: 17,
  },
  gospelBody: {
    color: '#244D3B',
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '700',
  },
  scriptureCard: {
    marginTop: 9,
    borderRadius: 14,
    backgroundColor: '#EEF4F0',
    padding: 12,
  },
  scriptureRef: {
    color: '#275D45',
    fontSize: 10,
    fontWeight: '900',
  },
  scriptureText: {
    marginTop: 4,
    color: '#506A5D',
    fontSize: 11.5,
    lineHeight: 17,
  },
  versionFoot: {
    marginTop: 10,
    color: '#788A81',
    fontSize: 9.5,
    lineHeight: 14,
  },
  prayerCard: {
    marginTop: 3,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE7E1',
    padding: 15,
  },
  prayerLabel: {
    color: '#527063',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  prayerText: {
    marginTop: 7,
    color: '#375A4B',
    fontSize: 12.5,
    lineHeight: 19,
    fontStyle: 'italic',
  },
  privacyCard: {
    marginTop: 12,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#D9E5DF',
    backgroundColor: '#F6FAF8',
    padding: 12,
    flexDirection: 'row',
    gap: 9,
  },
  privacyText: {
    flex: 1,
    color: '#5D7469',
    fontSize: 10.5,
    lineHeight: 16,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 12,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#C9D9D1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: '#275D45',
    borderColor: '#275D45',
  },
  chipText: {
    color: '#486457',
    fontSize: 10.5,
    fontWeight: '800',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  crisisCard: {
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#E3B7AA',
    backgroundColor: '#FFF7F4',
    padding: 15,
    gap: 10,
  },
  crisisText: {
    color: '#75301F',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
  },
  footer: {
    marginTop: 24,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#D7E2DC',
    alignItems: 'center',
    gap: 8,
  },
  footerText: {
    color: '#7A8A82',
    fontSize: 9.5,
    textAlign: 'center',
  },
  helpLink: {
    color: '#275D45',
    fontSize: 10.5,
    fontWeight: '900',
  },
});
