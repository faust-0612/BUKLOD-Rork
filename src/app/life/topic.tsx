import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import {
  LinearGradient,
} from 'expo-linear-gradient';

import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import {
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import {
  getBuklodLifeCopy,
  type BuklodLifeLanguage,
  type BuklodLifeTopicKey,
} from '@/lib/buklodLifeContent';


const LIFE_TOPIC_KEYS =
  new Set<BuklodLifeTopicKey>([
    'hope',
    'peace',
    'purpose',
    'forgiveness',
    'strength',
    'new-start',
    'questions',
    'jesus',
    'help',
  ]);


function safeTopic(
  value: unknown,
): BuklodLifeTopicKey {
  const key =
    String(
      value ?? ''
    ) as BuklodLifeTopicKey;

  return LIFE_TOPIC_KEYS.has(
    key
  )
    ? key
    : 'hope';
}


function safeLanguage(
  value: unknown,
): BuklodLifeLanguage {
  return String(
    value ?? ''
  ).toLowerCase() === 'en'
    ? 'en'
    : 'fil';
}


export default function BuklodLifeTopicScreen() {

  const insets =
    useSafeAreaInsets();

  const params =
    useLocalSearchParams<{
      topic?: string;
      lang?: string;
      question?: string;
    }>();

  const topic =
    safeTopic(
      params.topic
    );

  const language =
    safeLanguage(
      params.lang
    );

  const copy =
    useMemo(
      () =>
        getBuklodLifeCopy(
          language
        ),
      [
        language,
      ]
    );

  const [
    stage,
    setStage,
  ] =
    useState(0);

  const [
    selectedQuestion,
    setSelectedQuestion,
  ] =
    useState(
      String(
        params.question ??
        ''
      )
    );

  const [
    gospelResponseOpen,
    setGospelResponseOpen,
  ] =
    useState(false);

  const [
    gospelYesOpen,
    setGospelYesOpen,
  ] =
    useState(false);


  useEffect(() => {

    setStage(0);
    setGospelResponseOpen(false);
    setGospelYesOpen(false);

    if (
      params.question
    ) {
      setSelectedQuestion(
        String(
          params.question
        )
      );
    }

  }, [
    topic,
    params.question,
  ]);


  const questionAnswers =
    useMemo(
      () =>
        language === 'fil'
          ? [
            'Maraming tao ang nakakarating sa tanong na ito sa pamamagitan ng kalikasan, konsensya, dahilan, at karanasan. Sa Christian view, ang Diyos ang pinagmumulan ng buhay at kahulugan, at ang pagkilala sa Kanya ay hindi hinihinging ipikit ang isip sa mga tanong.',
            'Hindi itinuturo ng Christian Gospel na maliit o ilusyon lang ang pagdurusa. Kinikilala nito ang sakit, kasalanan, sirang mundo, at ang pag-asa na hindi huling salita ang suffering dahil kay Jesus.',
            'Nasa sentro si Jesus dahil ang Christian faith ay hindi lamang sistema ng moralidad. Inaangkin nito na sa Kanya mismo kumilos ang Diyos para iligtas at ibalik ang tao sa Kanya.',
            'Oo. Sa Christian Gospel, ang kapatawaran ay hindi nakabase sa pagiging karapat-dapat natin kundi sa biyaya ng Diyos sa pamamagitan ni Jesus.',
            'Itinuturo ng Christianity na hindi nagtatapos sa kamatayan ang pagkatao at may pananagutan tayo sa Diyos. Kaya mahalaga ang tanong kung paano tayo nakikipagkasundo sa Kanya.',
            'Ang maligtas ay hindi simpleng pagkuha ng religious label. Ito ay pagtanggap sa biyaya ng Diyos sa pamamagitan ng pagsisisi at pananampalataya kay Jesus, at pagsisimula ng bagong buhay na sumusunod sa Kanya.',
          ]
          : [
            'Many people approach this question through nature, conscience, reason, and experience. In the Christian view, God is the source of life and meaning, and knowing Him does not require pretending that hard questions do not exist.',
            'The Christian Gospel does not treat suffering as small or imaginary. It recognizes pain, sin, a broken world, and the hope that suffering is not the final word because of Jesus.',
            'Jesus is central because Christian faith is not merely a moral system. It claims that God acted through Him to rescue and reconcile people to Himself.',
            'Yes. In the Christian Gospel, forgiveness is not based on our worthiness but on God’s grace through Jesus.',
            'Christianity teaches that death is not the end of human existence and that we are accountable to God. That makes reconciliation with Him an important question.',
            'To be saved is not simply to acquire a religious label. It means receiving God’s grace through repentance and faith in Jesus and beginning a new life of following Him.',
          ],
      [
        language,
      ]
    );


  const selectedQuestionIndex =
    Math.max(
      0,
      copy.questions.findIndex(
        item =>
          item ===
          selectedQuestion
      )
    );


  const goToQuestions =
    () => {
      router.push({
        pathname:
          '/life/topic' as any,
        params: {
          topic:
            'questions',
          lang:
            language,
        },
      });
    };


  if (
    topic ===
    'questions'
  ) {

    return (
      <ScrollView
        style={
          styles.screen
        }
        contentContainerStyle={[
          styles.content,
          {
            paddingTop:
              Math.max(
                insets.top,
                14
              ),
            paddingBottom:
              Math.max(
                insets.bottom + 26,
                40
              ),
          },
        ]}
        showsVerticalScrollIndicator={
          false
        }
      >
        <Header
          title={
            copy.questionsTitle
          }
          language={
            copy.languageLabel
          }
          onBack={() =>
            router.back()
          }
        />

        <View
          style={
            styles.introCard
          }
        >
          <MaterialCommunityIcons
            name="help-circle-outline"
            size={28}
            color="#365D3E"
          />

          <Text
            style={
              styles.introText
            }
          >
            {copy.questionsIntro}
          </Text>
        </View>

        <View
          style={
            styles.stack
          }
        >
          {
            copy.questions.map(
              (
                question,
                index
              ) => {

                const active =
                  selectedQuestion
                    ? question ===
                      selectedQuestion
                    : index === 0;

                return (
                  <Pressable
                    key={
                      question
                    }
                    onPress={() =>
                      setSelectedQuestion(
                        question
                      )
                    }
                    style={({ pressed }) => [
                      styles.questionRow,
                      active &&
                        styles.questionRowActive,
                      pressed &&
                        styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.questionRowText,
                        active && {
                          color:
                            '#24482D',
                        },
                      ]}
                    >
                      {question}
                    </Text>

                    <MaterialCommunityIcons
                      name={
                        active
                          ? 'chevron-up'
                          : 'chevron-down'
                      }
                      size={20}
                      color="#5C7162"
                    />
                  </Pressable>
                );
              }
            )
          }
        </View>

        <View
          style={
            styles.answerCard
          }
        >
          <Text
            style={
              styles.answerLabel
            }
          >
            {
              selectedQuestion ||
              copy.questions[0]
            }
          </Text>

          <Text
            style={
              styles.answerText
            }
          >
            {
              questionAnswers[
                selectedQuestion
                  ? selectedQuestionIndex
                  : 0
              ]
            }
          </Text>
        </View>

        <Pressable
          onPress={() =>
            router.push({
              pathname:
                '/life/topic' as any,
              params: {
                topic:
                  'jesus',
                lang:
                  language,
              },
            })
          }
          style={
            styles.primaryButton
          }
        >
          <Text
            style={
              styles.primaryButtonText
            }
          >
            {copy.exploreCta}
          </Text>

          <MaterialCommunityIcons
            name="arrow-right"
            size={18}
            color="#FFFFFF"
          />
        </Pressable>

        <Pressable
          onPress={() =>
            router.back()
          }
          style={
            styles.secondaryButton
          }
        >
          <Text
            style={
              styles.secondaryButtonText
            }
          >
            {copy.notNowLabel}
          </Text>
        </Pressable>
      </ScrollView>
    );
  }


  if (
    topic ===
    'jesus'
  ) {

    return (
      <ScrollView
        style={
          styles.screen
        }
        contentContainerStyle={[
          styles.content,
          {
            paddingTop:
              Math.max(
                insets.top,
                14
              ),
            paddingBottom:
              Math.max(
                insets.bottom + 26,
                40
              ),
          },
        ]}
        showsVerticalScrollIndicator={
          false
        }
      >
        <Header
          title={
            copy.jesusTitle
          }
          language={
            copy.languageLabel
          }
          onBack={() =>
            router.back()
          }
        />

        <LinearGradient
          colors={[
            '#F6E8D5',
            '#ECD1AB',
            '#E5B97E',
          ]}
          start={{
            x: 0,
            y: 0,
          }}
          end={{
            x: 1,
            y: 1,
          }}
          style={
            styles.jesusHero
          }
        >
          <View
            style={
              styles.jesusIcon
            }
          >
            <MaterialCommunityIcons
              name="book-cross"
              size={30}
              color="#7A4928"
            />
          </View>

          <Text
            style={
              styles.jesusTitle
            }
          >
            {copy.jesusTitle}
          </Text>

          <Text
            style={
              styles.jesusIntro
            }
          >
            {copy.jesusIntro}
          </Text>
        </LinearGradient>

        <View
          style={
            styles.stack
          }
        >
          {
            copy.jesusPoints.map(
              (
                point,
                index
              ) => (
                <View
                  key={
                    point
                  }
                  style={
                    styles.gospelPoint
                  }
                >
                  <View
                    style={
                      styles.numberCircle
                    }
                  >
                    <Text
                      style={
                        styles.numberText
                      }
                    >
                      {
                        index + 1
                      }
                    </Text>
                  </View>

                  <Text
                    style={
                      styles.gospelText
                    }
                  >
                    {point}
                  </Text>
                </View>
              )
            )
          }
        </View>

        {!gospelResponseOpen ? (
          <>
            <Pressable
              onPress={() =>
                setGospelResponseOpen(
                  true
                )
              }
              style={
                styles.primaryButton
              }
            >
              <Text
                style={
                  styles.primaryButtonText
                }
              >
                {copy.continueLabel}
              </Text>

              <MaterialCommunityIcons
                name="arrow-right"
                size={18}
                color="#FFFFFF"
              />
            </Pressable>

            <Pressable
              onPress={
                goToQuestions
              }
              style={
                styles.secondaryButton
              }
            >
              <Text
                style={
                  styles.secondaryButtonText
                }
              >
                {copy.askLabel}
              </Text>
            </Pressable>

            <Pressable
              onPress={() =>
                router.back()
              }
              style={
                styles.textButton
              }
            >
              <Text
                style={
                  styles.textButtonText
                }
              >
                {copy.notNowLabel}
              </Text>
            </Pressable>
          </>
        ) : (
          <View
            style={
              styles.responseCard
            }
          >
            <Text
              style={
                styles.responseTitle
              }
            >
              {
                language === 'fil'
                  ? 'Gusto mo bang magtiwala kay Cristo?'
                  : 'Would you like to trust Christ?'
              }
            </Text>

            <Text
              style={
                styles.responseBody
              }
            >
              {
                language === 'fil'
                  ? 'Walang pressure. Maaari kang tumugon, magtanong, o huminto muna.'
                  : 'There is no pressure. You may respond, ask a question, or stop for now.'
              }
            </Text>

            <Pressable
              onPress={() =>
                setGospelYesOpen(
                  true
                )
              }
              style={
                styles.primaryButton
              }
            >
              <Text
                style={
                  styles.primaryButtonText
                }
              >
                {
                  language === 'fil'
                    ? 'Oo, gusto kong tumugon'
                    : 'Yes, I want to respond'
                }
              </Text>
            </Pressable>

            <Pressable
              onPress={
                goToQuestions
              }
              style={
                styles.secondaryButton
              }
            >
              <Text
                style={
                  styles.secondaryButtonText
                }
              >
                {copy.askLabel}
              </Text>
            </Pressable>

            <Pressable
              onPress={() =>
                router.back()
              }
              style={
                styles.textButton
              }
            >
              <Text
                style={
                  styles.textButtonText
                }
              >
                {copy.notNowLabel}
              </Text>
            </Pressable>

            {gospelYesOpen && (
              <View
                style={
                  styles.clarifier
                }
              >
                <Text
                  style={
                    styles.clarifierTitle
                  }
                >
                  {
                    language === 'fil'
                      ? 'Mahalagang malinaw ito'
                      : 'One important clarification'
                  }
                </Text>

                <Text
                  style={
                    styles.clarifierBody
                  }
                >
                  {
                    language === 'fil'
                      ? 'Hindi panalangin ang nagliligtas. Si Jesus ang nagliligtas. Ang panalangin ay maaari lamang maging paraan upang ipahayag sa Diyos ang iyong pagsisisi at pananampalataya.'
                      : 'A prayer does not save you. Jesus saves. Prayer can simply be a way to express your repentance and faith to God.'
                  }
                </Text>

                <Text
                  style={
                    styles.samplePrayer
                  }
                >
                  {
                    language === 'fil'
                      ? 'Halimbawa: “Panginoong Jesus, inaamin kong kailangan Kita. Pinagsisisihan ko ang aking kasalanan at nagtitiwala ako sa ginawa Mo para sa akin. Turuan Mo akong sumunod sa Iyo at mamuhay sa bagong buhay na ibinibigay Mo.”'
                      : 'Example: “Lord Jesus, I admit that I need You. I turn from my sin and trust what You have done for me. Teach me to follow You and live the new life You give.”'
                  }
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    );
  }


  if (
    topic ===
    'help'
  ) {

    return (
      <ScrollView
        style={
          styles.screen
        }
        contentContainerStyle={[
          styles.content,
          {
            paddingTop:
              Math.max(
                insets.top,
                14
              ),
            paddingBottom:
              Math.max(
                insets.bottom + 26,
                40
              ),
          },
        ]}
        showsVerticalScrollIndicator={
          false
        }
      >
        <Header
          title={
            copy.helpGuideTitle
          }
          language={
            copy.languageLabel
          }
          onBack={() =>
            router.back()
          }
        />

        <LinearGradient
          colors={[
            '#E7F0DF',
            '#D4E5CB',
            '#C8DCBD',
          ]}
          start={{
            x: 0,
            y: 0,
          }}
          end={{
            x: 1,
            y: 1,
          }}
          style={
            styles.helpHero
          }
        >
          <MaterialCommunityIcons
            name="hand-heart-outline"
            size={34}
            color="#2F6D3A"
          />

          <Text
            style={
              styles.helpHeroTitle
            }
          >
            {copy.helpGuideTitle}
          </Text>

          <Text
            style={
              styles.helpHeroBody
            }
          >
            {copy.helpGuideIntro}
          </Text>
        </LinearGradient>

        <View
          style={
            styles.stack
          }
        >
          {
            copy.helpSteps.map(
              step => (
                <View
                  key={
                    step.title
                  }
                  style={
                    styles.guideStep
                  }
                >
                  <Text
                    style={
                      styles.guideTitle
                    }
                  >
                    {step.title}
                  </Text>

                  <Text
                    style={
                      styles.guideBody
                    }
                  >
                    {step.body}
                  </Text>
                </View>
              )
            )
          }
        </View>

        <View
          style={
            styles.noteCard
          }
        >
          <MaterialCommunityIcons
            name="heart-outline"
            size={21}
            color="#456B4D"
          />

          <Text
            style={
              styles.noteText
            }
          >
            {
              language === 'fil'
                ? 'Walang conversion points, cash reward, leaderboard, o pressure. Ang tao ang malayang magpapasya kung gusto niyang magpatuloy.'
                : 'No conversion points, cash rewards, leaderboard, or pressure. The other person remains free to decide whether to continue.'
            }
          </Text>
        </View>
      </ScrollView>
    );
  }


  const detail =
    copy.details[
      topic as Exclude<
        BuklodLifeTopicKey,
        'questions' |
        'jesus' |
        'help'
      >
    ];


  return (
    <ScrollView
      style={
        styles.screen
      }
      contentContainerStyle={[
        styles.content,
        {
          paddingTop:
            Math.max(
              insets.top,
              14
            ),
          paddingBottom:
            Math.max(
              insets.bottom + 26,
              40
            ),
        },
      ]}
      showsVerticalScrollIndicator={
        false
      }
    >
      <Header
        title={
          detail.title
        }
        language={
          copy.languageLabel
        }
        onBack={() =>
          router.back()
        }
      />

      <LinearGradient
        colors={[
          '#F1EAD7',
          '#E2EDDC',
          '#CEDFC8',
        ]}
        start={{
          x: 0,
          y: 0,
        }}
        end={{
          x: 1,
          y: 1,
        }}
        style={
          styles.topicHero
        }
      >
        <View
          style={
            styles.topicHeroIcon
          }
        >
          <MaterialCommunityIcons
            name="sprout"
            size={30}
            color="#2F6D3A"
          />
        </View>

        <Text
          style={
            styles.topicHeroTitle
          }
        >
          {detail.title}
        </Text>

        <Text
          style={
            styles.topicHeroBody
          }
        >
          {detail.subtitle}
        </Text>
      </LinearGradient>

      <View
        style={
          styles.contentCard
        }
      >
        <Text
          style={
            styles.contentLabel
          }
        >
          {copy.humanFirstLabel}
        </Text>

        <Text
          style={
            styles.contentTitle
          }
        >
          {detail.practicalTitle}
        </Text>

        <Text
          style={
            styles.contentBody
          }
        >
          {detail.practicalBody}
        </Text>
      </View>

      {stage >= 1 && (
        <>
          <View
            style={
              styles.questionPrompt
            }
          >
            <MaterialCommunityIcons
              name="thought-bubble-outline"
              size={22}
              color="#5A704F"
            />

            <Text
              style={
                styles.questionPromptText
              }
            >
              {detail.deeperQuestion}
            </Text>
          </View>

          <View
            style={
              styles.truthCard
            }
          >
            <Text
              style={
                styles.contentLabel
              }
            >
              {copy.christianTruthLabel}
            </Text>

            <Text
              style={
                styles.contentTitle
              }
            >
              {detail.truthTitle}
            </Text>

            <Text
              style={
                styles.contentBody
              }
            >
              {detail.truthBody}
            </Text>
          </View>
        </>
      )}

      {stage >= 2 && (
        <View
          style={
            styles.nextCard
          }
        >
          <Text
            style={
              styles.contentLabel
            }
          >
            {copy.nextStepLabel}
          </Text>

          <Text
            style={
              styles.contentTitle
            }
          >
            {detail.nextTitle}
          </Text>

          <Text
            style={
              styles.contentBody
            }
          >
            {detail.nextBody}
          </Text>

          <Pressable
            onPress={() =>
              router.push({
                pathname:
                  '/life/topic' as any,
                params: {
                  topic:
                    'jesus',
                  lang:
                    language,
                },
              })
            }
            style={
              styles.inlineCta
            }
          >
            <Text
              style={
                styles.inlineCtaText
              }
            >
              {copy.exploreCta}
            </Text>

            <MaterialCommunityIcons
              name="arrow-right"
              size={17}
              color="#FFFFFF"
            />
          </Pressable>
        </View>
      )}

      {stage < 2 && (
        <Pressable
          onPress={() =>
            setStage(
              current =>
                Math.min(
                  2,
                  current + 1
                )
            )
          }
          style={
            styles.primaryButton
          }
        >
          <Text
            style={
              styles.primaryButtonText
            }
          >
            {copy.continueLabel}
          </Text>

          <MaterialCommunityIcons
            name="arrow-right"
            size={18}
            color="#FFFFFF"
          />
        </Pressable>
      )}

      <Pressable
        onPress={
          goToQuestions
        }
        style={
          styles.secondaryButton
        }
      >
        <Text
          style={
            styles.secondaryButtonText
          }
        >
          {copy.askLabel}
        </Text>
      </Pressable>

      <Pressable
        onPress={() =>
          router.back()
        }
        style={
          styles.textButton
        }
      >
        <Text
          style={
            styles.textButtonText
          }
        >
          {copy.notNowLabel}
        </Text>
      </Pressable>
    </ScrollView>
  );
}


function Header({
  title,
  language,
  onBack,
}: {
  title: string;
  language: string;
  onBack: () => void;
}) {
  return (
    <View
      style={
        styles.header
      }
    >
      <Pressable
        onPress={
          onBack
        }
        style={
          styles.back
        }
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <MaterialCommunityIcons
          name="arrow-left"
          size={23}
          color="#24442B"
        />
      </Pressable>

      <View
        style={{
          flex:
            1,
        }}
      >
        <Text
          style={
            styles.headerEyebrow
          }
        >
          BUKLOD LIFE
        </Text>

        <Text
          numberOfLines={2}
          style={
            styles.headerTitle
          }
        >
          {title}
        </Text>
      </View>

      <View
        style={
          styles.languageBadge
        }
      >
        <Text
          style={
            styles.languageText
          }
        >
          {language}
        </Text>
      </View>
    </View>
  );
}


const styles =
  StyleSheet.create({

    screen: {
      flex:
        1,
      backgroundColor:
        '#FAFAF7',
    },

    content: {
      paddingHorizontal:
        14,
    },

    header: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        10,
      marginBottom:
        14,
    },

    back: {
      width:
        42,
      height:
        42,
      borderRadius:
        14,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#FFFFFF',
      borderWidth:
        1,
      borderColor:
        '#E3E8E1',
    },

    headerEyebrow: {
      fontSize:
        8,
      letterSpacing:
        1,
      fontWeight:
        '900',
      color:
        '#4A7253',
    },

    headerTitle: {
      marginTop:
        2,
      fontSize:
        20,
      lineHeight:
        24,
      fontWeight:
        '900',
      color:
        '#1F3325',
    },

    languageBadge: {
      paddingHorizontal:
        8,
      paddingVertical:
        6,
      borderRadius:
        999,
      backgroundColor:
        '#E7F0DF',
    },

    languageText: {
      fontSize:
        7,
      letterSpacing:
        0.7,
      fontWeight:
        '900',
      color:
        '#365D3E',
    },

    introCard: {
      flexDirection:
        'row',
      gap:
        11,
      alignItems:
        'flex-start',
      padding:
        16,
      borderRadius:
        18,
      backgroundColor:
        '#E8F0E4',
      marginBottom:
        12,
    },

    introText: {
      flex:
        1,
      fontSize:
        13,
      lineHeight:
        19,
      color:
        '#344A39',
    },

    stack: {
      gap:
        9,
      marginBottom:
        14,
    },

    questionRow: {
      minHeight:
        58,
      paddingHorizontal:
        14,
      paddingVertical:
        12,
      borderRadius:
        16,
      borderWidth:
        1,
      borderColor:
        '#E2E8E0',
      backgroundColor:
        '#FFFFFF',
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        10,
    },

    questionRowActive: {
      borderColor:
        '#91B08D',
      backgroundColor:
        '#F0F6EC',
    },

    questionRowText: {
      flex:
        1,
      fontSize:
        13,
      lineHeight:
        18,
      fontWeight:
        '800',
      color:
        '#34483A',
    },

    answerCard: {
      padding:
        17,
      borderRadius:
        20,
      backgroundColor:
        '#FFFFFF',
      borderWidth:
        1,
      borderColor:
        '#E4E7E1',
      marginBottom:
        14,
    },

    answerLabel: {
      fontSize:
        16,
      lineHeight:
        21,
      fontWeight:
        '900',
      color:
        '#24482D',
      marginBottom:
        8,
    },

    answerText: {
      fontSize:
        13,
      lineHeight:
        20,
      color:
        '#47554A',
    },

    jesusHero: {
      padding:
        20,
      borderRadius:
        22,
      marginBottom:
        14,
      overflow:
        'hidden',
    },

    jesusIcon: {
      width:
        54,
      height:
        54,
      borderRadius:
        18,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        'rgba(255,255,255,0.58)',
      marginBottom:
        13,
    },

    jesusTitle: {
      fontSize:
        25,
      fontWeight:
        '900',
      color:
        '#694225',
    },

    jesusIntro: {
      marginTop:
        7,
      fontSize:
        13,
      lineHeight:
        20,
      color:
        '#6D523D',
    },

    gospelPoint: {
      flexDirection:
        'row',
      gap:
        11,
      alignItems:
        'flex-start',
      padding:
        14,
      borderRadius:
        17,
      backgroundColor:
        '#FFFFFF',
      borderWidth:
        1,
      borderColor:
        '#E6E5DF',
    },

    numberCircle: {
      width:
        31,
      height:
        31,
      borderRadius:
        16,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#E8F0DF',
    },

    numberText: {
      fontSize:
        11,
      fontWeight:
        '900',
      color:
        '#35623D',
    },

    gospelText: {
      flex:
        1,
      fontSize:
        12,
      lineHeight:
        18,
      color:
        '#3F4D42',
    },

    responseCard: {
      padding:
        17,
      borderRadius:
        20,
      backgroundColor:
        '#F3F6EF',
      borderWidth:
        1,
      borderColor:
        '#DCE7D8',
    },

    responseTitle: {
      fontSize:
        20,
      lineHeight:
        25,
      fontWeight:
        '900',
      color:
        '#24482D',
    },

    responseBody: {
      marginTop:
        6,
      marginBottom:
        13,
      fontSize:
        12,
      lineHeight:
        18,
      color:
        '#526157',
    },

    clarifier: {
      marginTop:
        14,
      padding:
        14,
      borderRadius:
        16,
      backgroundColor:
        '#FFFFFF',
      borderWidth:
        1,
      borderColor:
        '#DCE4D9',
    },

    clarifierTitle: {
      fontSize:
        14,
      fontWeight:
        '900',
      color:
        '#274A30',
      marginBottom:
        6,
    },

    clarifierBody: {
      fontSize:
        12,
      lineHeight:
        18,
      color:
        '#49584E',
    },

    samplePrayer: {
      marginTop:
        10,
      fontSize:
        12,
      lineHeight:
        19,
      fontStyle:
        'italic',
      color:
        '#5A634F',
    },

    helpHero: {
      padding:
        20,
      borderRadius:
        22,
      marginBottom:
        14,
    },

    helpHeroTitle: {
      marginTop:
        10,
      fontSize:
        24,
      fontWeight:
        '900',
      color:
        '#24482D',
    },

    helpHeroBody: {
      marginTop:
        7,
      fontSize:
        13,
      lineHeight:
        20,
      color:
        '#435948',
    },

    guideStep: {
      padding:
        15,
      borderRadius:
        17,
      backgroundColor:
        '#FFFFFF',
      borderWidth:
        1,
      borderColor:
        '#E4E8E1',
    },

    guideTitle: {
      fontSize:
        15,
      fontWeight:
        '900',
      color:
        '#284B31',
      marginBottom:
        5,
    },

    guideBody: {
      fontSize:
        12,
      lineHeight:
        18,
      color:
        '#4B594E',
    },

    noteCard: {
      flexDirection:
        'row',
      gap:
        10,
      padding:
        14,
      borderRadius:
        16,
      backgroundColor:
        '#EEF3EA',
    },

    noteText: {
      flex:
        1,
      fontSize:
        11,
      lineHeight:
        17,
      color:
        '#495B4E',
    },

    topicHero: {
      padding:
        20,
      borderRadius:
        22,
      marginBottom:
        13,
    },

    topicHeroIcon: {
      width:
        54,
      height:
        54,
      borderRadius:
        18,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        'rgba(255,255,255,0.7)',
      marginBottom:
        12,
    },

    topicHeroTitle: {
      fontSize:
        26,
      fontWeight:
        '900',
      color:
        '#24482D',
    },

    topicHeroBody: {
      marginTop:
        5,
      fontSize:
        13,
      lineHeight:
        19,
      color:
        '#4D6252',
    },

    contentCard: {
      padding:
        16,
      borderRadius:
        19,
      backgroundColor:
        '#FFFFFF',
      borderWidth:
        1,
      borderColor:
        '#E4E8E1',
      marginBottom:
        11,
    },

    truthCard: {
      padding:
        16,
      borderRadius:
        19,
      backgroundColor:
        '#F6EFE3',
      borderWidth:
        1,
      borderColor:
        '#E9DDC8',
      marginBottom:
        11,
    },

    nextCard: {
      padding:
        16,
      borderRadius:
        19,
      backgroundColor:
        '#EAF2E5',
      borderWidth:
        1,
      borderColor:
        '#DCE8D7',
      marginBottom:
        11,
    },

    contentLabel: {
      fontSize:
        8,
      letterSpacing:
        0.9,
      fontWeight:
        '900',
      color:
        '#55705C',
      marginBottom:
        6,
    },

    contentTitle: {
      fontSize:
        17,
      lineHeight:
        22,
      fontWeight:
        '900',
      color:
        '#273D2E',
      marginBottom:
        6,
    },

    contentBody: {
      fontSize:
        13,
      lineHeight:
        20,
      color:
        '#4A574D',
    },

    questionPrompt: {
      flexDirection:
        'row',
      gap:
        10,
      alignItems:
        'flex-start',
      padding:
        15,
      borderRadius:
        17,
      backgroundColor:
        '#EDF1EA',
      marginBottom:
        11,
    },

    questionPromptText: {
      flex:
        1,
      fontSize:
        14,
      lineHeight:
        20,
      fontWeight:
        '800',
      color:
        '#364A3B',
    },

    primaryButton: {
      minHeight:
        48,
      borderRadius:
        15,
      paddingHorizontal:
        15,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap:
        7,
      backgroundColor:
        '#2F6D3A',
      marginTop:
        8,
    },

    primaryButtonText: {
      fontSize:
        12,
      fontWeight:
        '900',
      color:
        '#FFFFFF',
    },

    secondaryButton: {
      minHeight:
        46,
      borderRadius:
        15,
      paddingHorizontal:
        15,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#FFFFFF',
      borderWidth:
        1,
      borderColor:
        '#DCE5D9',
      marginTop:
        9,
    },

    secondaryButtonText: {
      fontSize:
        12,
      fontWeight:
        '900',
      color:
        '#365D3E',
    },

    textButton: {
      minHeight:
        42,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginTop:
        5,
    },

    textButtonText: {
      fontSize:
        11,
      fontWeight:
        '800',
      color:
        '#7A817A',
    },

    inlineCta: {
      alignSelf:
        'flex-start',
      marginTop:
        13,
      paddingHorizontal:
        13,
      paddingVertical:
        9,
      borderRadius:
        999,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        6,
      backgroundColor:
        '#2F6D3A',
    },

    inlineCtaText: {
      fontSize:
        11,
      fontWeight:
        '900',
      color:
        '#FFFFFF',
    },

    pressed: {
      opacity:
        0.9,
      transform: [
        {
          scale:
            0.99,
        },
      ],
    },

  });
