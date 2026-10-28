import { BuklodFaithRouteBoundary } from '@/components/BuklodFaithRouteBoundary';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import * as Clipboard from 'expo-clipboard';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import {
  LinearGradient,
} from 'expo-linear-gradient';

import {
  router,
} from 'expo-router';

import {
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import BuklodLifeTabs from '@/components/BuklodLifeTabs';
import {
  BuklodQrMatrix,
} from '@/components/BuklodQrMatrix';

import {
  normalizeBuklodLifeLanguage,
} from '@/lib/buklodLifeContent';

import {
  loadBuklodLifeShareInfo,
  recordBuklodLifeReferralFunnel,
  type BuklodLifeShareInfo,
} from '@/lib/buklodLifeImpact';

import {
  useAuth,
} from '@/providers/AuthProvider';


function BuklodLifeShareScreenContent() {

  const insets =
    useSafeAreaInsets();

  const {
    profile,
  } =
    useAuth();

  const language =
    useMemo(
      () =>
        normalizeBuklodLifeLanguage(
          (
            profile as any
          )?.preferred_language
        ),
      [
        profile,
      ]
    );

  const [
    info,
    setInfo,
  ] =
    useState<
      BuklodLifeShareInfo |
      null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    showQr,
    setShowQr,
  ] =
    useState(false);


  const copy =
    language === 'fil'
      ? {
        title:
          'Ibahagi ang BUKLOD. Ibahagi si Jesus.',
        subtitle:
          'Ang iyong imbitasyon ay maaaring maging unang hakbang ng isang tao upang makilala si Jesus.',
        treeLine:
          'Isang koneksyon ay maaaring maging simula ng bagong buhay.',
        shareNow:
          'IBAHAGI ANG BUKLOD',
        shareLink:
          'Share Link',
        qr:
          'QR Code',
        inviteCard:
          'Invite Card',
        more:
          'Kopyahin ang Code',
        codeLabel:
          'Iyong BUKLOD invite code',
        qrHelp:
          'Ipa-scan ang QR na ito para buksan ang BUKLOD invitation.',
        partial:
          'Available ang sharing. Ang ibang LIFE impact data ay mag-a-activate pagkatapos ng integrated backend migration.',
        unavailable:
          'Hindi pa makuha ang iyong invite code. Maaari kang bumalik at subukan muli.',
        copied:
          'Nakopya na ang BUKLOD invitation link.',
        copiedCode:
          'Nakopya na ang invite code.',
      }
      : {
        title:
          'Share BUKLOD. Share Jesus.',
        subtitle:
          'Your invitation may become someone’s first step toward knowing Jesus.',
        treeLine:
          'One connection can begin an eternal journey.',
        shareNow:
          'SHARE BUKLOD NOW',
        shareLink:
          'Share Link',
        qr:
          'QR Code',
        inviteCard:
          'Invite Card',
        more:
          'Copy Code',
        codeLabel:
          'Your BUKLOD invite code',
        qrHelp:
          'Let someone scan this QR to open the BUKLOD invitation.',
        partial:
          'Sharing is available. Additional LIFE impact data activates after the integrated backend migration.',
        unavailable:
          'Your invite code is not available yet. You can go back and try again.',
        copied:
          'BUKLOD invitation link copied.',
        copiedCode:
          'Invite code copied.',
      };


  const load =
    useCallback(
      async () => {

        setLoading(
          true
        );

        try {
          setInfo(
            await loadBuklodLifeShareInfo()
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      []
    );


  useEffect(() => {
    void load();
  }, [
    load,
  ]);


  const inviteMessage =
    useMemo(
      () => {

        if (
          !info?.shareUrl
        ) {
          return '';
        }

        return language === 'fil'
          ? [
            'Ibahagi ang BUKLOD. Ibahagi si Jesus.',
            'Isang koneksyon ay maaaring maging simula ng bagong buhay.',
            '',
            info.shareUrl,
          ].join(
            '\n'
          )
          : [
            'Share BUKLOD. Share Jesus.',
            'One connection can begin an eternal journey.',
            '',
            info.shareUrl,
          ].join(
            '\n'
          );
      },
      [
        info?.shareUrl,
        language,
      ]
    );


  const shareInvite =
    async (
      source:
        'LIFE_SHARE_LINK' |
        'LIFE_INVITE_CARD'
    ) => {

      if (
        !info?.shareUrl
      ) {
        return;
      }

      await recordBuklodLifeReferralFunnel(
        'SHARE_TAP',
        source
      );

      if (
        Platform.OS ===
        'web'
      ) {
        await Clipboard.setStringAsync(
          inviteMessage
        );

        await recordBuklodLifeReferralFunnel(
          'COPY_LINK',
          source
        );

        Alert.alert(
          'BUKLOD LIFE',
          copy.copied
        );

        return;
      }

      try {
        await recordBuklodLifeReferralFunnel(
          'NATIVE_SHARE_OPEN',
          source
        );

        await Share.share({
          title:
            'BUKLOD LIFE',
          message:
            inviteMessage,
          url:
            info.shareUrl,
        });
      } catch {
        // User dismissal or platform share error must not break LIFE.
      }
    };


  const copyCode =
    async () => {

      if (
        !info?.referralCode
      ) {
        return;
      }

      await Clipboard.setStringAsync(
        info.referralCode
      );

      await recordBuklodLifeReferralFunnel(
        'COPY_CODE',
        'LIFE'
      );

      Alert.alert(
        'BUKLOD LIFE',
        copy.copiedCode
      );
    };


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
              insets.bottom + 28,
              42
            ),
        },
      ]}
      showsVerticalScrollIndicator={
        false
      }
    >
      <View
        style={
          styles.header
        }
      >
        <Pressable
          onPress={() =>
            router.back()
          }
          style={
            styles.back
          }
          accessibilityRole="button"
          accessibilityLabel={
            language === 'fil'
              ? 'Bumalik'
              : 'Back'
          }
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
              styles.brand
            }
          >
            BUKLOD
            <Text
              style={
                styles.lifeWord
              }
            >
              {' '}Life
            </Text>
          </Text>

          <Text
            style={
              styles.smallBrand
            }
          >
            {
              language === 'fil'
                ? 'Ibahagi ang BUKLOD.'
                : 'Share BUKLOD.'
            }
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
            {
              language === 'fil'
                ? 'FILIPINO'
                : 'ENGLISH'
            }
          </Text>
        </View>
      </View>

      <BuklodLifeTabs
        active="share"
        language={
          language
        }
      />

      <LinearGradient
        colors={[
          '#E7F5FF',
          '#DCEFFF',
          '#FDECE2',
        ]}
        start={{
          x:
            0,
          y:
            0,
        }}
        end={{
          x:
            1,
          y:
            1,
        }}
        style={
          styles.hero
        }
      >
        <View
          style={
            styles.heroTree
          }
        >
          <View
            style={
              styles.treeSun
            }
          />

          <MaterialCommunityIcons
            name="tree"
            size={118}
            color="#4B8D3D"
          />
        </View>

        <Text
          style={
            styles.heroTitle
          }
        >
          {copy.title}
        </Text>

        <Text
          style={
            styles.heroSubtitle
          }
        >
          {copy.subtitle}
        </Text>

        <View
          style={
            styles.treeLineCard
          }
        >
          <MaterialCommunityIcons
            name="connection"
            size={19}
            color="#2B6942"
          />

          <Text
            style={
              styles.treeLine
            }
          >
            {
              copy.treeLine
            }
          </Text>
        </View>

        <Pressable
          disabled={
            !info?.shareUrl
          }
          onPress={() =>
            void shareInvite(
              'LIFE_SHARE_LINK'
            )
          }
          style={({ pressed }) => [
            styles.shareNow,
            !info?.shareUrl &&
              styles.disabled,
            pressed &&
              styles.pressed,
          ]}
        >
          <MaterialCommunityIcons
            name="share-variant"
            size={19}
            color="#152711"
          />

          <Text
            style={
              styles.shareNowText
            }
          >
            {
              copy.shareNow
            }
          </Text>
        </Pressable>
      </LinearGradient>


      {loading ? (
        <View
          style={
            styles.stateCard
          }
        >
          <ActivityIndicator
            color="#2F6D3A"
          />

          <Text
            style={
              styles.stateText
            }
          >
            {
              language === 'fil'
                ? 'Inihahanda ang iyong BUKLOD invitation…'
                : 'Preparing your BUKLOD invitation…'
            }
          </Text>
        </View>
      ) : !info ? (
        <View
          style={
            styles.stateCard
          }
        >
          <MaterialCommunityIcons
            name="link-variant-off"
            size={28}
            color="#7A817A"
          />

          <Text
            style={
              styles.stateText
            }
          >
            {copy.unavailable}
          </Text>

          <Pressable
            onPress={() =>
              void load()
            }
            style={
              styles.retry
            }
          >
            <Text
              style={
                styles.retryText
              }
            >
              {
                language === 'fil'
                  ? 'SUBUKAN MULI'
                  : 'TRY AGAIN'
              }
            </Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View
            style={
              styles.actions
            }
          >
            <Pressable
              onPress={() =>
                void shareInvite(
                  'LIFE_SHARE_LINK'
                )
              }
              style={({ pressed }) => [
                styles.actionCard,
                pressed &&
                  styles.pressed,
              ]}
            >
              <View
                style={[
                  styles.actionIcon,
                  {
                    backgroundColor:
                      '#D8ECFF',
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="share-variant-outline"
                  size={25}
                  color="#1671C5"
                />
              </View>

              <Text
                style={
                  styles.actionText
                }
              >
                {copy.shareLink}
              </Text>
            </Pressable>

            <Pressable
              onPress={() =>
                setShowQr(
                  value =>
                    !value
                )
              }
              style={({ pressed }) => [
                styles.actionCard,
                pressed &&
                  styles.pressed,
              ]}
            >
              <View
                style={[
                  styles.actionIcon,
                  {
                    backgroundColor:
                      '#E7E2FF',
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="qrcode"
                  size={25}
                  color="#6555C7"
                />
              </View>

              <Text
                style={
                  styles.actionText
                }
              >
                {copy.qr}
              </Text>
            </Pressable>

            <Pressable
              onPress={() =>
                void shareInvite(
                  'LIFE_INVITE_CARD'
                )
              }
              style={({ pressed }) => [
                styles.actionCard,
                pressed &&
                  styles.pressed,
              ]}
            >
              <View
                style={[
                  styles.actionIcon,
                  {
                    backgroundColor:
                      '#FFE3E7',
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="card-text-outline"
                  size={25}
                  color="#D94A65"
                />
              </View>

              <Text
                style={
                  styles.actionText
                }
              >
                {copy.inviteCard}
              </Text>
            </Pressable>
          </View>

          {showQr && (
            <View
              style={
                styles.qrCard
              }
            >
              <Text
                style={
                  styles.qrTitle
                }
              >
                {
                  language === 'fil'
                    ? 'BUKLOD LIFE Invitation'
                    : 'BUKLOD LIFE Invitation'
                }
              </Text>

              <BuklodQrMatrix
                value={
                  info.shareUrl
                }
                size={
                  190
                }
              />

              <Text
                style={
                  styles.qrHelp
                }
              >
                {copy.qrHelp}
              </Text>
            </View>
          )}

          <View
            style={
              styles.codeCard
            }
          >
            <View
              style={{
                flex:
                  1,
              }}
            >
              <Text
                style={
                  styles.codeLabel
                }
              >
                {copy.codeLabel}
              </Text>

              <Text
                selectable
                style={
                  styles.code
                }
              >
                {
                  info.referralCode
                }
              </Text>
            </View>

            <Pressable
              onPress={() =>
                void copyCode()
              }
              style={
                styles.copyCode
              }
            >
              <MaterialCommunityIcons
                name="content-copy"
                size={18}
                color="#2F6D3A"
              />

              <Text
                style={
                  styles.copyCodeText
                }
              >
                {copy.more}
              </Text>
            </Pressable>
          </View>

          <View
            style={
              styles.safetyCard
            }
          >
            <MaterialCommunityIcons
              name="shield-check-outline"
              size={23}
              color="#456C4C"
            />

            <Text
              style={
                styles.safetyText
              }
            >
              {
                language === 'fil'
                  ? 'Opsyonal ang Discover Jesus. Ang taong inimbitahan mo ay maaaring gumamit ng BUKLOD nang normal at malayang pumili kung gusto niyang tuklasin ang Christian Gospel.'
                  : 'Discover Jesus is optional. The person you invite can use BUKLOD normally and freely choose whether to explore the Christian Gospel.'
              }
            </Text>
          </View>

          {info.partial && (
            <Text
              style={
                styles.partial
              }
            >
              {copy.partial}
            </Text>
          )}
        </>
      )}
    </ScrollView>
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
        12,
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

    brand: {
      fontSize:
        22,

      fontWeight:
        '900',

      color:
        '#173D22',
    },

    lifeWord: {
      color:
        '#6C8B2A',

      fontStyle:
        'italic',
    },

    smallBrand: {
      marginTop:
        1,

      fontSize:
        9,

      fontWeight:
        '800',

      color:
        '#607061',
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

      fontWeight:
        '900',

      color:
        '#365D3E',

      letterSpacing:
        0.7,
    },

    hero: {
      padding:
        18,

      borderRadius:
        24,

      overflow:
        'hidden',

      borderWidth:
        1,

      borderColor:
        '#D6E6EF',

      marginBottom:
        14,
    },

    heroTree: {
      minHeight:
        156,

      alignItems:
        'center',

      justifyContent:
        'center',

      position:
        'relative',
    },

    treeSun: {
      position:
        'absolute',

      width:
        112,

      height:
        112,

      borderRadius:
        56,

      backgroundColor:
        'rgba(255,204,85,0.26)',
    },

    heroTitle: {
      marginTop:
        3,

      textAlign:
        'center',

      fontSize:
        25,

      lineHeight:
        30,

      fontWeight:
        '900',

      color:
        '#102C72',
    },

    heroSubtitle: {
      marginTop:
        7,

      textAlign:
        'center',

      fontSize:
        13,

      lineHeight:
        19,

      color:
        '#365477',
    },

    treeLineCard: {
      flexDirection:
        'row',

      alignItems:
        'center',

      alignSelf:
        'center',

      gap:
        8,

      marginTop:
        14,

      paddingHorizontal:
        12,

      paddingVertical:
        9,

      borderRadius:
        14,

      backgroundColor:
        'rgba(255,255,255,0.72)',
    },

    treeLine: {
      flexShrink:
        1,

      fontSize:
        11,

      lineHeight:
        16,

      fontWeight:
        '800',

      color:
        '#35533E',
    },

    shareNow: {
      minHeight:
        50,

      marginTop:
        15,

      borderRadius:
        15,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      gap:
        8,

      backgroundColor:
        '#FFD633',
    },

    shareNowText: {
      fontSize:
        12,

      fontWeight:
        '900',

      color:
        '#152711',
    },

    disabled: {
      opacity:
        0.45,
    },

    stateCard: {
      minHeight:
        160,

      borderRadius:
        20,

      backgroundColor:
        '#FFFFFF',

      borderWidth:
        1,

      borderColor:
        '#E2E6E0',

      alignItems:
        'center',

      justifyContent:
        'center',

      padding:
        20,

      gap:
        10,
    },

    stateText: {
      textAlign:
        'center',

      fontSize:
        12,

      lineHeight:
        18,

      color:
        '#5B665E',
    },

    retry: {
      paddingHorizontal:
        14,

      paddingVertical:
        9,

      borderRadius:
        999,

      backgroundColor:
        '#E8F0E4',
    },

    retryText: {
      fontSize:
        9,

      fontWeight:
        '900',

      color:
        '#365D3E',
    },

    actions: {
      flexDirection:
        'row',

      gap:
        8,

      marginBottom:
        13,
    },

    actionCard: {
      flex:
        1,

      minHeight:
        102,

      borderRadius:
        17,

      backgroundColor:
        '#FFFFFF',

      borderWidth:
        1,

      borderColor:
        '#E4E7E2',

      alignItems:
        'center',

      justifyContent:
        'center',

      padding:
        9,

      gap:
        8,
    },

    actionIcon: {
      width:
        44,

      height:
        44,

      borderRadius:
        14,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    actionText: {
      textAlign:
        'center',

      fontSize:
        10,

      fontWeight:
        '900',

      color:
        '#304252',
    },

    qrCard: {
      alignItems:
        'center',

      padding:
        16,

      borderRadius:
        20,

      backgroundColor:
        '#FFFFFF',

      borderWidth:
        1,

      borderColor:
        '#E1E6E0',

      marginBottom:
        13,
    },

    qrTitle: {
      marginBottom:
        12,

      fontSize:
        16,

      fontWeight:
        '900',

      color:
        '#263B2C',
    },

    qrHelp: {
      marginTop:
        10,

      textAlign:
        'center',

      fontSize:
        10,

      lineHeight:
        15,

      color:
        '#697269',
    },

    codeCard: {
      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        10,

      padding:
        14,

      borderRadius:
        18,

      backgroundColor:
        '#FFFFFF',

      borderWidth:
        1,

      borderColor:
        '#E2E7E0',

      marginBottom:
        12,
    },

    codeLabel: {
      fontSize:
        9,

      fontWeight:
        '800',

      color:
        '#758076',
    },

    code: {
      marginTop:
        3,

      fontSize:
        20,

      fontWeight:
        '900',

      letterSpacing:
        2,

      color:
        '#2F6D3A',
    },

    copyCode: {
      minHeight:
        42,

      paddingHorizontal:
        10,

      borderRadius:
        13,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#E9F2E6',

      gap:
        3,
    },

    copyCodeText: {
      fontSize:
        8,

      fontWeight:
        '900',

      color:
        '#365D3E',
    },

    safetyCard: {
      flexDirection:
        'row',

      alignItems:
        'flex-start',

      gap:
        10,

      padding:
        14,

      borderRadius:
        17,

      backgroundColor:
        '#EEF3EA',
    },

    safetyText: {
      flex:
        1,

      fontSize:
        10.5,

      lineHeight:
        16,

      color:
        '#4D5C50',
    },

    partial: {
      marginTop:
        10,

      textAlign:
        'center',

      fontSize:
        9,

      lineHeight:
        14,

      color:
        '#7A807A',
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

export default function BuklodLifeShareScreen() {
  return <BuklodFaithRouteBoundary><BuklodLifeShareScreenContent /></BuklodFaithRouteBoundary>;
}
