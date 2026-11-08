/* PATCH_184F_R3_PROFILE_CLEANUP */
/* PATCH_179C_R1_PREMIUM_CURRENT_PROFILE */
import { useCallback as useProfileFocusCallback, useRef as useProfileScrollRef } from 'react';
import { useFocusEffect as useProfileFocusEffect } from 'expo-router';
import BuklodProfileMembershipNav from '@/components/BuklodProfileMembershipNav';
import { BuklodSystemAnnouncementBoard } from '@/components/BuklodSystemAnnouncementBoard';
import BuklodFoundationWorkspaceNav from '@/components/BuklodFoundationWorkspaceNav';
import {
  BuklodTappableAvatar,
} from '@/components/BuklodTappableAvatar';
import {
  BuklodProfileGlassCard,
  BuklodProfileGlassRow,
} from '@/components/BuklodProfileGlassCard';
import {
  BuklodProfileCustomizeSheet,
} from '@/components/BuklodProfileCustomizeSheet';
import {
  ProfileMotionAvatar,
  ProfileMotionCover,
  ProfileMotionFadeUp,
  ProfilePressable,
} from '@/components/BuklodProfileMotion';
import BuklodProfileCharacterCard from '@/components/points/BuklodProfileCharacterCard';
import BuklodFirstViewAd from '@/components/BuklodFirstViewAd';
import BuklodReferralInviteCard from '@/components/BuklodReferralInviteCard';
import {
  resolveContrastPaint,
  withAlpha,
} from '@/lib/buklodContrast';
import {
  DEFAULT_PROFILE_LAYOUT,
  loadProfileLayout,
  saveProfileLayout,
  type ProfileSectionId,
  type ProfileSectionLayout,
} from '@/lib/buklodProfileLayout';
import { decode } from 'base64-arraybuffer';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import { ensureImagePickerLibraryAccess } from '@/lib/buklodImagePickerAccess';
import {
  BUKLOD_HIT_SLOP,
  BUKLOD_HIT_SLOP_TIGHT,
} from '@/lib/buklodTouch';
import React, { ReactNode, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Button } from '@/components/UI';
import { AppRole, useAuth } from '@/providers/AuthProvider';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';
import { firstRouteParam } from '@/lib/buklodScopeRoute';
import { supabase } from '@/lib/supabase';
import { resolvePersonDisplayName } from '@/lib/buklodPersonDisplay';
import {
  loadMyProfileLocked,
  setMyProfileLocked,
} from '@/lib/buklodMemberProfile';
import { shareProfileUpdateOnCommunityWall } from '@/lib/buklodProfileCommunityShare';
import { loadBuklodPointsDashboard } from '@/lib/buklodRewards';
import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import { BuklodGlobalThemeSelectorModal } from '@/components/BuklodGlobalThemeSelector';
import {
  useBuklodTheme,
} from '@/providers/BuklodThemeProvider';
import {
  DEFAULT_DASHBOARD_THEME,
  type DashboardTheme,
} from '@/components/BuklodDashboardCustomizer';
import {
  loadProfileDashboardTheme,
  saveProfileDashboardTheme,
} from '@/lib/buklodDashboardTheme';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const QUICK_ACTION_WIDTH = 118;
const QUICK_ACTION_GAP = 8;
const QUICK_ACTION_SNAP_INTERVAL =
  QUICK_ACTION_WIDTH + QUICK_ACTION_GAP;

type QuickActionItem = {
  key: string;
  icon: IconName;
  label: string;
  onPress: () => void;
};

function ProfileQuickActionsStrip({
  items,
  styles,
  theme,
}: {
  items: QuickActionItem[];
  styles: ReturnType<typeof createMeStyles>;
  theme: ReturnType<typeof useBuklodTheme>['theme'];
}) {
  // BuklodPressable already cancels drag gestures. Never hold a disabled
  // button state after a short horizontal scroll without momentum.
  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      directionalLockEnabled
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      disableIntervalMomentum
      snapToInterval={QUICK_ACTION_SNAP_INTERVAL}
      snapToAlignment="start"
      scrollEventThrottle={16}
      contentContainerStyle={styles.quickRow}
    >
      {items.map((item, index) => (
        <ProfileMotionFadeUp
          key={item.key}
          delay={35 + index * 35}
          duration={240}
          fromY={10}
          fromOpacity={0.78}
        >
          <ProfilePressable
            accessibilityRole="button"
            accessibilityLabel={item.label}
            testID={`profile-quick-${item.key}`}
            onPress={item.onPress}
            style={styles.quickAction}
          >
            <MaterialCommunityIcons
              name={item.icon}
              size={18}
              color={theme.accent}
            />
            <Text numberOfLines={1} style={styles.quickLabel}>
              {item.label}
            </Text>
          </ProfilePressable>
        </ProfileMotionFadeUp>
      ))}
    </ScrollView>
  );
}

function roleLabel(role: AppRole) {
  const labels: Record<AppRole, string> = {
    member: 'Member',
    leader: 'Leader',
    mentor: 'Mentor',
    pastor: 'Pastor',
    local_admin: 'Local Admin',
    system_admin: 'System Admin',
  };

  return labels[role];
}

function DrawerSection({
  title,
  subtitle,
  icon,
  open,
  onToggle,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: IconName;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const { theme } = useBuklodTheme();
  const local = useMemo(
    () =>
      StyleSheet.create({
        drawer: {
          marginBottom: 6,
          marginHorizontal: 12,
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: 13,
          overflow: 'hidden',
          backgroundColor: withAlpha(theme.cardSurface, 0.78),
          shadowColor: theme.shadow,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.045,
          shadowRadius: 12,
          elevation: 2,
        },
        drawerHeader: {
          minHeight: 62,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 13,
          paddingVertical: 10,
          gap: 6,
          backgroundColor: theme.surface,
        },
        drawerIcon: {
          width: 36,
          height: 36,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.accentSoft,
          borderWidth: 1,
          borderColor: theme.border,
        },
        drawerTitle: {
          fontSize: 15.5,
          lineHeight: 18,
          fontWeight: '900',
          letterSpacing: -0.05,
          color: theme.textPrimary,
        },
        drawerSubtitle: {
          marginTop: 2,
          fontSize: 13.5,
          lineHeight: 18,
          color: theme.textMuted,
        },
        drawerBody: {
          borderTopWidth: 1,
          borderTopColor: theme.border,
          paddingHorizontal: 0,
          paddingTop: 5,
          paddingBottom: 7,
          backgroundColor: theme.surfaceElevated,
        },
      }),
    [theme]
  );

  return (
    <View style={local.drawer}>
      <ProfilePressable
        onPress={onToggle}
        style={({ pressed }) => [
          local.drawerHeader,
          pressed && { opacity: 0.78 },
        ]}
      >
        <View style={local.drawerIcon}>
          <MaterialCommunityIcons
            name={icon}
            size={18}
            color={theme.accent}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={local.drawerTitle}>{title}</Text>

          {!!subtitle && (
            <Text style={local.drawerSubtitle}>
              {subtitle}
            </Text>
          )}
        </View>

        <MaterialCommunityIcons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={theme.textMuted}
        />
      </ProfilePressable>

      {open && (
        <View style={local.drawerBody}>
          {children}
        </View>
      )}
    </View>
  );
}

function MenuRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  onPress: () => void;
}) {
  const { theme } = useBuklodTheme();
  const local = useMemo(
    () =>
      StyleSheet.create({
        menuRow: {
          minHeight: 54,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 7,
          paddingVertical: 7,
          marginVertical: 2,
          borderRadius: 13,
          gap: 6,
          backgroundColor: theme.surface,
        },
        menuIcon: {
          width: 32,
          height: 32,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 10,
          backgroundColor: theme.accentSoft,
        },
        menuTitle: {
          fontSize: 14.5,
          lineHeight: 18,
          fontWeight: '900',
          letterSpacing: -0.03,
          color: theme.textPrimary,
        },
        menuSubtitle: {
          marginTop: 1,
          fontSize: 12.5,
          lineHeight: 18,
          color: theme.textMuted,
        },
      }),
    [theme]
  );

  return (
    <ProfilePressable
      onPress={onPress}
      style={({ pressed }) => [
        local.menuRow,
        pressed && { opacity: 0.72 },
      ]}
    >
      <View style={local.menuIcon}>
        <MaterialCommunityIcons
          name={icon}
          size={18}
          color={theme.accent}
        />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={local.menuTitle}>{title}</Text>

        {!!subtitle && (
          <Text style={local.menuSubtitle}>
            {subtitle}
          </Text>
        )}
      </View>

      <MaterialCommunityIcons
        name="chevron-right"
        size={18}
        color={theme.textMuted}
      />
    </ProfilePressable>
  );
}

export default function MeScreen() {
  const { theme, shared } = useBuklodPresentation();
  const params =
    useLocalSearchParams<{
      returnScopeId?:
        | string
        | string[];
    }>();
  const {
    activeScope,
    scopes,
    selectScope,
  } = useBuklodScope();
  /* PATCH_174B_R2_PROFILE_FOCUS_STABILITY */
  const profileScrollRef =
    useProfileScrollRef(null as ScrollView | null);

  useProfileFocusEffect(
    useProfileFocusCallback(() => {
      const returnScopeId =
        firstRouteParam(
          params.returnScopeId
        );

      if (!returnScopeId) {
        return;
      }

      const publicScope =
        scopes.find(
          (scope) =>
            scope.scope_type ===
            'PUBLIC'
        );

      if (
        !publicScope ||
        activeScope?.scope_id ===
          publicScope.scope_id
      ) {
        return;
      }

      void (async () => {
        try {
          await selectScope(
            publicScope.scope_id
          );
        } catch (error) {
          console.warn(
            'BUKLOD profile public scope refresh:',
            error
          );
        }
      })();
    }, [
      params.returnScopeId,
      scopes,
      activeScope?.scope_id,
      selectScope,
    ])
  );

  const {
    profile,
    roles,
    hasRole,
    signOut,
    refreshProfile,
  } = useAuth();

  const [bsocAuthorized,setBsocAuthorized]=useState(false);
  useEffect(()=>{
    if(!profile?.id){setBsocAuthorized(false);return;}
    let live=true;
    // PostgREST query builders are PromiseLike, not native Promises.
    // Assimilate the thenable before handling a rejected permission read.
    void Promise.resolve(supabase.rpc('buklod_bsoc_can',{p_permission_key:'bsoc.support.read'}))
      .then(({data,error})=>{if(live)setBsocAuthorized(!error&&data===true);})
      .catch(()=>{if(live)setBsocAuthorized(false);});
    return ()=>{live=false;};
  },[profile?.id,roles]);

  const [
    personalDashboardTheme,
    setPersonalDashboardTheme,
  ] = useState<DashboardTheme>(
    DEFAULT_DASHBOARD_THEME
  );

  const [
    profileLayout,
    setProfileLayout,
  ] = useState<ProfileSectionLayout[]>(
    DEFAULT_PROFILE_LAYOUT
  );

  const [customizeOpen, setCustomizeOpen] =
    useState(false);

  const [profileMenuOpen, setProfileMenuOpen] =
    useState(false);

  const [profileLocked, setProfileLockedState] =
    useState(false);

  const [profileLockBusy, setProfileLockBusy] =
    useState(false);

  const [themeOpen, setThemeOpen] =
    useState(false);

  const [lifetimePoints, setLifetimePoints] =
    useState(0);

  useEffect(() => {
    let mounted = true;

    const loadPoints = async () => {
      try {
        const dashboard = await loadBuklodPointsDashboard();
        if (!mounted || !dashboard) return;
        setLifetimePoints(
          dashboard.lifetime_points ?? dashboard.total_points,
        );
      } catch {
        if (!mounted) return;
      }
    };

    void loadPoints();

    return () => {
      mounted = false;
    };
  }, [profile?.id]);

  useEffect(() => {
    let mounted = true;

    if (!profile?.id) {
      setProfileLockedState(false);
      return () => {
        mounted = false;
      };
    }

    void loadMyProfileLocked()
      .then((locked) => {
        if (mounted) {
          setProfileLockedState(locked);
        }
      })
      .catch(() => {
        if (mounted) {
          setProfileLockedState(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [profile?.id]);

  const toggleProfileLock = async (next: boolean) => {
    setProfileLockBusy(true);

    try {
      await setMyProfileLocked(next);
      setProfileLockedState(next);
    } catch (error: unknown) {
      Alert.alert(
        'Profile Privacy',
        error instanceof Error
          ? error.message
          : 'Could not update profile privacy.',
      );
    } finally {
      setProfileLockBusy(false);
    }
  };

  useEffect(
    () => {
      let mounted = true;

      if (!profile?.id) {
        setPersonalDashboardTheme(
          DEFAULT_DASHBOARD_THEME
        );
        setProfileLayout(DEFAULT_PROFILE_LAYOUT);

        return () => {
          mounted = false;
        };
      }

      void loadProfileDashboardTheme(
        profile.id
      )
        .then(nextTheme => {
          if (mounted) {
            setPersonalDashboardTheme(
              nextTheme
            );
          }
        })
        .catch(error => {
          console.warn(
            'Profile theme load failed:',
            error
          );
        });

      void loadProfileLayout(profile.id)
        .then(nextLayout => {
          if (mounted) {
            setProfileLayout(nextLayout);
          }
        })
        .catch(() => undefined);

      return () => {
        mounted = false;
      };
    },
    [profile?.id]
  );

  const savePersonalDashboardTheme =
    async (
      nextTheme: DashboardTheme
    ) => {
      if (!profile?.id) return;

      try {
        await saveProfileDashboardTheme(
          profile.id,
          nextTheme
        );

        setPersonalDashboardTheme(
          nextTheme
        );
      } catch (error: any) {
        Alert.alert(
          'Profile Theme',
          error?.message ||
            'Could not save your profile theme.'
        );

        throw error;
      }
    };

  const applyProfileLayout = (
    next: ProfileSectionLayout[]
  ) => {
    setProfileLayout(next);
    if (profile?.id) {
      void saveProfileLayout(profile.id, next);
    }
  };

  /* PATCH_169D_ACTIVE_MZB_PROFILE_GATE */

  /* PATCH_160_EDITABLE_AVATAR */
  const [
    avatarBusy,
    setAvatarBusy,
  ] =
    useState(false);

  const changeProfilePhoto =
    async () => {

      if (
        !profile?.id ||
        avatarBusy
      ) {
        return;
      }

      try {
        setAvatarBusy(
          true
        );

        const permissionGranted =
          await ensureImagePickerLibraryAccess(
            ImagePicker.requestMediaLibraryPermissionsAsync
          );

        if (
          !permissionGranted
        ) {
          Alert.alert(
            'Profile Photo',
            'Please allow photo access to change your profile picture.'
          );

          return;
        }


        const result =
          await ImagePicker
            .launchImageLibraryAsync(
              {
                mediaTypes:
                  [
                    'images',
                  ] as any,

                allowsEditing:
                  true,

                aspect:
                  [1, 1],

                quality:
                  0.82,
              }
            );


        if (
          result.canceled ||
          !result.assets?.[0]
        ) {
          return;
        }


        const prepared =
          await ImageManipulator
            .manipulateAsync(
              result.assets[0]
                .uri,

              [
                {
                  resize: {
                    width:
                      900,
                  },
                },
              ],

              {
                compress:
                  0.8,

                format:
                  ImageManipulator
                    .SaveFormat
                    .JPEG,

                base64:
                  true,
              }
            );


        if (
          !prepared.base64
        ) {
          throw new Error(
            'Could not prepare profile photo.'
          );
        }


        const objectPath =
          `${profile.id}/avatar.jpg`;


        const {
          error:
            uploadError,
        } =
          await supabase
            .storage
            .from(
              'profile-avatars'
            )
            .upload(
              objectPath,

              decode(
                prepared.base64
              ),

              {
                contentType:
                  'image/jpeg',

                upsert:
                  true,

                cacheControl:
                  '3600',
              }
            );


        if (
          uploadError
        ) {
          throw uploadError;
        }


        const {
          data:
            publicData,
        } =
          supabase
            .storage
            .from(
              'profile-avatars'
            )
            .getPublicUrl(
              objectPath
            );


        const avatarUrl =
          `${publicData.publicUrl}?v=${Date.now()}`;


        const {
          error:
            updateError,
        } =
          await supabase
            .from(
              'profiles'
            )
            .update({
              avatar_url:
                avatarUrl,
            })
            .eq(
              'id',
              profile.id
            );


        if (
          updateError
        ) {
          throw updateError;
        }


        await refreshProfile();

        try {
          await shareProfileUpdateOnCommunityWall({
            userId: profile.id,
            kind: 'photo',
            base64: prepared.base64,
          });
        } catch (shareError: any) {
          console.warn(
            'Profile photo community post:',
            shareError?.message || shareError
          );
        }

        Alert.alert(
          'Profile Photo',
          'Profile picture updated.'
        );
      }
      catch (error: any) {
        console.error(
          'Profile avatar:',
          error
        );

        Alert.alert(
          'Profile Photo',
          error?.message ||
          'Could not update profile picture.'
        );
      }
      finally {
        setAvatarBusy(
          false
        );
      }
    };


  const [
    profileBackgroundUrl,
    setProfileBackgroundUrl,
  ] = useState<string | null>(
    null
  );

  useEffect(() => {
    let active = true;

    const loadProfileBackground =
      async () => {
        if (!profile?.id) {
          if (active) {
            setProfileBackgroundUrl(
              null
            );
          }

          return;
        }

        const {
          data,
          error,
        } =
          await (supabase as any)
            .rpc(
              'get_my_profile_background_url'
            );

        if (!active) {
          return;
        }

        if (error) {
          console.warn(
            'Profile background load:',
            error
          );

          return;
        }

        setProfileBackgroundUrl(
          typeof data === 'string' &&
          data.trim()
            ? data
            : null
        );
      };

    void loadProfileBackground();

    return () => {
      active = false;
    };
  }, [profile?.id]);

  const changeProfileBackground =
    async () => {
      if (!profile?.id) {
        return;
      }

      try {
        const permissionGranted =
          await ensureImagePickerLibraryAccess(
            ImagePicker.requestMediaLibraryPermissionsAsync
          );

        if (
          !permissionGranted
        ) {
          Alert.alert(
            'Photo Permission',
            'Please allow photo access to change your profile background.'
          );

          return;
        }

        const picked =
          await ImagePicker
            .launchImageLibraryAsync({
              mediaTypes:
                ['images'],
              allowsEditing:
                true,
              aspect:
                [16, 9],
              quality:
                0.9,
            });

        if (
          picked.canceled ||
          !picked.assets?.length
        ) {
          return;
        }

        const asset =
          picked.assets[0];

        const prepared =
          await ImageManipulator
            .manipulateAsync(
              asset.uri,
              [
                {
                  resize: {
                    width:
                      1400,
                  },
                },
              ],
              {
                compress:
                  0.8,

                format:
                  ImageManipulator
                    .SaveFormat
                    .JPEG,

                base64:
                  true,
              }
            );

        if (
          !prepared.base64
        ) {
          throw new Error(
            'Could not prepare profile background.'
          );
        }

        const objectPath =
          `${profile.id}/cover.jpg`;

        const {
          error:
            uploadError,
        } =
          await supabase
            .storage
            .from(
              'profile-avatars'
            )
            .upload(
              objectPath,

              decode(
                prepared.base64
              ),

              {
                contentType:
                  'image/jpeg',

                upsert:
                  true,

                cacheControl:
                  '3600',
              }
            );

        if (
          uploadError
        ) {
          throw uploadError;
        }

        const {
          data:
            publicData,
        } =
          supabase
            .storage
            .from(
              'profile-avatars'
            )
            .getPublicUrl(
              objectPath
            );

        const backgroundUrl =
          `${publicData.publicUrl}?v=${Date.now()}`;

        const {
          error:
            updateError,
        } =
          await (supabase as any)
            .rpc(
              'set_my_profile_background_url',
              {
                p_url:
                  backgroundUrl,
              }
            );

        if (
          updateError
        ) {
          throw updateError;
        }
        setProfileBackgroundUrl(
          backgroundUrl
        );

        await refreshProfile();

        try {
          await shareProfileUpdateOnCommunityWall({
            userId: profile.id,
            kind: 'background',
            base64: prepared.base64,
          });
        } catch (shareError: any) {
          console.warn(
            'Profile background community post:',
            shareError?.message || shareError
          );
        }

        Alert.alert(
          'Profile Background',
          'Profile background updated.'
        );
      }
      catch (error: any) {
        console.error(
          'Profile background:',
          error
        );

        Alert.alert(
          'Profile Background',
          error?.message ||
          'Could not update profile background.'
        );
      }
    };


  const [circleRank, setCircleRank] =
    useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadCircleRank = async () => {
      if (!profile?.id) {
        if (active) setCircleRank(null);
        return;
      }

      const { data, error } = await (supabase as any).rpc(
        'get_member_circle_ranks_v1',
        {
          p_user_ids: [profile.id],
        }
      );

      if (!active) return;

      if (error) {
        setCircleRank(null);
        return;
      }

      const row =
        Array.isArray(data) && data.length
          ? data[0]
          : null;

      const rankName =
        typeof row?.rank_name === 'string'
          ? row.rank_name.trim()
          : '';

      setCircleRank(rankName || null);
    };

    void loadCircleRank();

    return () => {
      active = false;
    };
  }, [profile?.id]);


  const [openSection, setOpenSection] = useState<
    'buklod' | 'organizations' | 'ministry' | 'admin' | 'account' | null
  >(null);

  /* PATCH_166L_MY_BUKLOD_DEEPLINK */
  const myBuklodParams =
    useLocalSearchParams<{
      section?: string;
    }>();

  useEffect(() => {
    if (
      String(
        myBuklodParams.section ?? ''
      ).toLowerCase() === 'buklod'
    ) {
      setOpenSection('account');
    }
  }, [myBuklodParams.section]);

  const isSystemAdmin = hasRole('system_admin');

  const toggle = (
    section: 'buklod' | 'organizations' | 'ministry' | 'admin' | 'account'
  ) => {
    setOpenSection((current) =>
      current === section ? null : section
    );
  };

  const fallbackPortrait = isSystemAdmin
    ? require('../../../assets/branding/admin-profile.jpg')
    : require('../../../assets/release/buklod-generic-photo.jpg');

  const coverUrl =
    profileBackgroundUrl ||
    (profile as any)?.profile_background_url ||
    null;

  const hasPersonalCanvas =
    !!personalDashboardTheme.backgroundImage ||
    (
      !!personalDashboardTheme.backgroundColor &&
      personalDashboardTheme.backgroundColor !==
        DEFAULT_DASHBOARD_THEME.backgroundColor
    );

  const hasCoverImage = !!(
    coverUrl ||
    personalDashboardTheme.backgroundImage
  );

  const identityPaint = resolveContrastPaint(
    hasPersonalCanvas
      ? personalDashboardTheme.backgroundColor
      : theme.canvas,
    hasCoverImage,
    theme
  );

  const identityShadow = {
    color: identityPaint.color,
    textShadowColor: identityPaint.shadowColor,
    textShadowOffset: {
      width: 0,
      height: 1,
    } as const,
    textShadowRadius: hasCoverImage ? 6 : 3,
  };

  const highlightAccent =
    personalDashboardTheme.accentColor &&
    personalDashboardTheme.accentColor !==
      DEFAULT_DASHBOARD_THEME.accentColor
      ? personalDashboardTheme.accentColor
      : theme.accent;

  const visibleRoles = (roles ?? []).filter(Boolean);
  const username = String(profile?.username ?? '').trim();

  const sectionVisible = (
    id: ProfileSectionId
  ) =>
    profileLayout.find((row) => row.id === id)?.visible !==
    false;

  const orderedSections = profileLayout.filter(
    (row) => row.visible
  );

  const styles = useMemo(
    () => createMeStyles(theme),
    [theme]
  );

  /* PATCH_ORG_PROFILE_QUICK_CARD_R24 */
  const openUserOrganization = () => {
    router.push('/organizations' as any);
  };

  const highlightsSection =
    sectionVisible('highlights') && !!circleRank ? (
      <ProfileMotionFadeUp delay={40}>
        <View style={styles.sectionPad}>
          <Text style={styles.eyebrow}>
            PERSONAL HIGHLIGHTS
          </Text>
          <BuklodProfileGlassCard>
            <BuklodProfileGlassRow
              icon="star-circle-outline"
              title={circleRank}
              subtitle="Circle rank"
              onPress={() => router.push('/points')}
            />
          </BuklodProfileGlassCard>
        </View>
      </ProfileMotionFadeUp>
    ) : null;

  /* Always visible on Profile — not tied to customizable Highlights layout. */
  const referralSection = (
    <ProfileMotionFadeUp delay={60}>
      <View style={styles.sectionPad}>
        <Text style={styles.eyebrow}>SHARE BUKLOD</Text>
        <BuklodReferralInviteCard username={username || null} />
      </View>
    </ProfileMotionFadeUp>
  );

  const quickActionItems = useMemo<QuickActionItem[]>(
    () => [
      {
        key: 'support',
        icon: 'lifebuoy',
        label: 'Live Support',
        onPress: () => router.push('/support/live' as any),
      },
      {
        key: 'attendance-qr',
        icon: 'qrcode',
        label: 'Attendance QR',
        onPress: () => router.push('/profile/attendance-qr' as any),
      },
      {
        key: 'organization',
        icon: 'domain',
        label: 'Organization',
        onPress: () => openUserOrganization(),
      },
      {
        key: 'theme',
        icon: 'palette-outline',
        label: 'Theme',
        onPress: () => setThemeOpen(true),
      },
      {
        key: 'advertise',
        icon: 'bullhorn-outline',
        label: 'Advertise',
        onPress: () => router.push('/advertise' as any),
      },
    ],
    [scopes, selectScope]
  );

  const quickActionsSection =
    sectionVisible('quickActions') ? (
      <View style={styles.sectionPad}>
        <ProfileMotionFadeUp
          delay={0}
          duration={240}
          fromY={10}
          fromOpacity={0.78}
        >
          <Text style={styles.eyebrow}>
            QUICK ACTIONS
          </Text>
        </ProfileMotionFadeUp>
        <ProfileQuickActionsStrip
          items={quickActionItems}
          styles={styles}
          theme={theme}
        />
      </View>
    ) : null;

  const communitiesSection =
    sectionVisible('communities') ? (
      <BuklodProfileMembershipNav />
    ) : null;

  const focusAppsSection =
    sectionVisible('focusApps') ? (
      <BuklodFoundationWorkspaceNav />
    ) : null;

  const myBuklodSection =
    sectionVisible('myBuklod') ? (
      <ProfileMotionFadeUp delay={120} duration={240} fromY={10} fromOpacity={0.78}>
        <DrawerSection
          title="My BUKLOD"
          icon="lock-outline"
          open={openSection === 'account'}
          onToggle={() => toggle('account')}
        >
          <MenuRow
            icon="information-outline"
            title="About BUKLOD"
            onPress={() =>
              router.push('/about-buklod' as any)
            }
          />

          <MenuRow
            icon="account-edit-outline"
            title="Edit My Personal Information"
            onPress={() =>
              router.push(
                '/account/personal-information' as any
              )
            }
          />

          <View
            style={{
              minHeight: 54,
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 7,
              paddingVertical: 7,
              marginVertical: 2,
              borderRadius: 13,
              gap: 6,
              backgroundColor: theme.surface,
            }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 10,
                backgroundColor: theme.accentSoft,
              }}
            >
              <MaterialCommunityIcons
                name="lock-outline"
                size={18}
                color={theme.accent}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 14.5,
                  lineHeight: 18,
                  fontWeight: '900',
                  color: theme.textPrimary,
                }}
              >
                Lock Profile
              </Text>
              <Text
                style={{
                  marginTop: 1,
                  fontSize: 12.5,
                  lineHeight: 18,
                  color: theme.textMuted,
                }}
              >
                Hide your profile details from other members
              </Text>
            </View>

            <Switch
              value={profileLocked}
              disabled={profileLockBusy}
              onValueChange={(next) => {
                void toggleProfileLock(next);
              }}
              trackColor={{
                false: theme.border,
                true: theme.accent,
              }}
            />
          </View>

          <MenuRow
            icon="lock-reset"
            title="Password & Recovery"
            onPress={() =>
              router.push('/account/security' as any)
            }
          />

          <MenuRow
            icon="volume-high"
            title="Sounds & Notifications"
            subtitle="Messages, calls, submissions and quiet hours"
            onPress={() =>
              router.push('/settings/sounds' as any)
            }
          />

          <MenuRow
            icon="shield-lock-outline"
            title="Recovery PIN"
            onPress={() =>
              router.push(
                '/account/recovery-pin' as any
              )
            }
          />

          <MenuRow
            icon="account-off-outline"
            title="Deactivate Account"
            onPress={() =>
              router.push(
                '/account/deactivate' as any
              )
            }
          />

          <MenuRow
            icon="delete-outline"
            title="Delete Account"
            onPress={() =>
              router.push('/account/delete' as any)
            }
          />

          <MenuRow
            icon="information-outline"
            title="How Account Deletion Works"
            onPress={() =>
              router.push('/delete-account' as any)
            }
          />

          <MenuRow
            icon="shield-account-outline"
            title="Privacy Policy"
            onPress={() =>
              router.push('/privacy' as any)
            }
          />

          <MenuRow
            icon="file-document-outline"
            title="Privacy Notice"
            onPress={() =>
              router.push('/privacy/notice')
            }
          />

          <MenuRow
            icon="shield-alert-outline"
            title="Community Safety"
            subtitle="Report unsafe content or behavior"
            onPress={() => router.push('/moderation/report' as any)}
          />

          <MenuRow
            icon="email-outline"
            title="Contact Us"
            onPress={() =>
              router.push('/contact-us' as any)
            }
          />

          <MenuRow
            icon="lifebuoy"
            title="Live Chat & Report a Problem"
            subtitle="Makipag-chat sa support; magsend ng screenshot o video ng problema kung kailangan"
            onPress={() => router.push('/support/live' as any)}
          />

          {bsocAuthorized && (
            <MenuRow
              icon="headset"
              title="BSOC Support Operations"
              subtitle="Authorized personnel · live inbox · notifications · GPT diagnostics"
              onPress={() => router.push('/admin/bsoc-support' as any)}
            />
          )}

          {isSystemAdmin && (
            <MenuRow
              icon="crown-outline"
              title="Subscription Admin"
              onPress={() =>
                router.push(
                  '/system/paid-features' as any
                )
              }
            />
          )}

          {isSystemAdmin && (
            <MenuRow
              icon="test-tube"
              title="Pilot Checklist"
              onPress={() =>
                router.push('/pilot/checklist')
              }
            />
          )}

          {isSystemAdmin && (
            <>
              <MenuRow
                icon="book-open-page-variant"
                title="Kabihasnang Ligaw"
                subtitle="Aprubahan, iskedyul, at i-pause ang kuwento"
                onPress={() =>
                  router.push('/admin/kabihasnang-ligaw' as any)
                }
              />
              <MenuRow
                icon="lock-reset"
                title="Account Recovery Requests"
                onPress={() =>
                  router.push(
                    '/admin/account-recovery' as any
                  )
                }
              />
              <MenuRow
                icon="shield-crown-outline"
                title="Open BUKLOD Admin"
                onPress={() => router.push('/admin')}
              />
            </>
          )}

          <View style={styles.signOutWrap}>
            <Button
              title="SIGN OUT"
              outline
              onPress={signOut}
            />
          </View>
        </DrawerSection>
      </ProfileMotionFadeUp>
    ) : null;

  const sectionMap: Record<
    ProfileSectionId,
    ReactNode
  > = {
    highlights: highlightsSection,
    quickActions: quickActionsSection,
    communities: communitiesSection,
    focusApps: focusAppsSection,
    myBuklod: myBuklodSection,
  };

  return (
    <ScrollView
      ref={profileScrollRef}
      style={[
        shared.screen,
        {
          backgroundColor: hasPersonalCanvas
            ? personalDashboardTheme.backgroundColor
            : theme.canvas,
        },
      ]}
      contentContainerStyle={[
        shared.content,
        styles.content,
      ]}
      showsVerticalScrollIndicator={false}
      directionalLockEnabled
    >
      {!!personalDashboardTheme.backgroundImage && (
        <View
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        >
          <Image
            source={{
              uri:
                personalDashboardTheme.backgroundImage,
            }}
            resizeMode="cover"
            style={StyleSheet.absoluteFill}
          />
        </View>
      )}

      <View
        style={[
          styles.profileCard,
          {
            backgroundColor: hasCoverImage
              ? 'transparent'
              : withAlpha(theme.cardSurface, 0.62),
            borderColor: withAlpha(theme.border, 0.7),
          },
        ]}
      >
        {!!coverUrl && (
          <ProfileMotionCover
            active
            style={styles.profileCardCover}
          >
            <Image
              source={{ uri: coverUrl }}
              resizeMode="cover"
              style={styles.profileCardBackground}
            />
            <View style={styles.profileCardWash} />
          </ProfileMotionCover>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Profile options"
          onPress={() => setProfileMenuOpen(true)}
          hitSlop={BUKLOD_HIT_SLOP}
          style={[
            styles.profileMenuBtn,
            {
              backgroundColor: withAlpha(
                theme.surface,
                hasCoverImage ? 0.82 : 0.9
              ),
              borderColor: withAlpha(
                theme.border,
                0.75
              ),
            },
          ]}
        >
          <MaterialCommunityIcons
            name="dots-vertical"
            size={22}
            color={identityPaint.color}
          />
        </Pressable>

        <ProfileMotionAvatar>
          <View
            style={[
              styles.avatarRing,
              {
                borderColor: withAlpha(
                  identityPaint.edgeColor,
                  0.72
                ),
                backgroundColor: withAlpha(
                  theme.surface,
                  0.88
                ),
              },
            ]}
          >
            <BuklodTappableAvatar
              userId={profile?.id}
              uri={profile?.avatar_url}
              name={profile?.full_name}
              size={108}
              fallbackSource={fallbackPortrait}
              enableLongPressSheet={false}
              onPress={() => {
                if (!avatarBusy) {
                  void changeProfilePhoto();
                }
              }}
            />
            <View
              pointerEvents="box-none"
              style={styles.avatarEditBadge}
            >
              <Pressable
                onPress={() => {
                  if (!avatarBusy) {
                    void changeProfilePhoto();
                  }
                }}
                style={styles.avatarEditHit}
              >
                <MaterialCommunityIcons
                  name={
                    avatarBusy
                      ? 'progress-clock'
                      : 'camera-outline'
                  }
                  size={17}
                  color={theme.white}
                />
              </Pressable>
            </View>
          </View>
        </ProfileMotionAvatar>

        <ProfileMotionFadeUp delay={40}>
          <Text
            style={[
              styles.avatarHint,
              identityShadow,
            ]}
          >
            {avatarBusy
              ? 'UPLOADING...'
              : 'Tap photo to change'}
          </Text>
        </ProfileMotionFadeUp>

        <ProfileMotionFadeUp delay={70} duration={240} fromY={10} fromOpacity={0}>
          <Text style={[styles.name, identityShadow]}>
            {resolvePersonDisplayName(profile, profile?.id)}
          </Text>
        </ProfileMotionFadeUp>

        {!!username && (
          <ProfileMotionFadeUp delay={110}>
            <Text
              style={[
                styles.meta,
                identityShadow,
              ]}
            >
              @{username}
            </Text>
          </ProfileMotionFadeUp>
        )}

        {visibleRoles.length > 0 && (
          <ProfileMotionFadeUp delay={140}>
            <View style={styles.rolesWrap}>
              {visibleRoles.map((role) => (
                <View
                  key={role}
                  style={[
                    styles.roleBadge,
                    {
                      backgroundColor: withAlpha(
                        theme.surface,
                        0.92
                      ),
                      borderColor: withAlpha(
                        highlightAccent,
                        0.35
                      ),
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.roleText,
                      { color: highlightAccent },
                    ]}
                  >
                    {roleLabel(role)}
                  </Text>
                </View>
              ))}
            </View>
          </ProfileMotionFadeUp>
        )}
      </View>

      <BuklodFirstViewAd placement="profile" placementId="profile_first_view" />
      <View style={styles.sectionPad}>
        <BuklodSystemAnnouncementBoard slot="profile" />
      </View>

      <BuklodProfileCharacterCard
        lifetimePoints={lifetimePoints}
        rankName={circleRank}
      />

      {referralSection}

      {orderedSections.map((row) => (
        <View key={row.id}>
          {sectionMap[row.id]}
        </View>
      ))}

      <Text
        style={[
          styles.footer,
          { color: theme.textMuted },
        ]}
      >
        Samahang Binuklod ng Pag-ibig
      </Text>

      <BuklodGlobalThemeSelectorModal
        visible={themeOpen}
        onClose={() => setThemeOpen(false)}
      />

      <Modal
        visible={profileMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setProfileMenuOpen(false)
        }
      >
        <Pressable
          style={styles.profileMenuBackdrop}
          onPress={() =>
            setProfileMenuOpen(false)
          }
        >
          <View
            style={[
              styles.profileMenuSheet,
              {
                backgroundColor: theme.surfaceElevated,
                borderColor: theme.border,
              },
            ]}
          >
            <Pressable
              style={styles.profileMenuItem}
              onPress={() => {
                setProfileMenuOpen(false);
                router.push('/notifications' as any);
              }}
            >
              <MaterialCommunityIcons
                name="bell-outline"
                size={22}
                color={theme.accent}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.profileMenuTitle,
                    { color: theme.textPrimary },
                  ]}
                >
                  Notifications
                </Text>
                <Text
                  style={[
                    styles.profileMenuSubtitle,
                    { color: theme.textMuted },
                  ]}
                >
                  View updates, messages, and requests
                </Text>
              </View>
            </Pressable>

            <Pressable
              style={styles.profileMenuItem}
              onPress={() => {
                setProfileMenuOpen(false);
                void changeProfileBackground();
              }}
            >
              <MaterialCommunityIcons
                name="image-outline"
                size={22}
                color={theme.accent}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.profileMenuTitle,
                    { color: theme.textPrimary },
                  ]}
                >
                  Edit Profile Background
                </Text>
                <Text
                  style={[
                    styles.profileMenuSubtitle,
                    { color: theme.textMuted },
                  ]}
                >
                  Change your profile cover photo
                </Text>
              </View>
            </Pressable>

            <Pressable
              style={styles.profileMenuItem}
              onPress={() => {
                setProfileMenuOpen(false);
                setCustomizeOpen(true);
              }}
            >
              <MaterialCommunityIcons
                name="palette-outline"
                size={22}
                color={theme.accent}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.profileMenuTitle,
                    { color: theme.textPrimary },
                  ]}
                >
                  Customize Profile
                </Text>
                <Text
                  style={[
                    styles.profileMenuSubtitle,
                    { color: theme.textMuted },
                  ]}
                >
                  Sections, accent, and layout
                </Text>
              </View>
            </Pressable>

            <View style={styles.profileMenuItem}>
              <MaterialCommunityIcons
                name="lock-outline"
                size={22}
                color={theme.accent}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.profileMenuTitle,
                    { color: theme.textPrimary },
                  ]}
                >
                  Lock Profile
                </Text>
                <Text
                  style={[
                    styles.profileMenuSubtitle,
                    { color: theme.textMuted },
                  ]}
                >
                  Other members only see your name when locked
                </Text>
              </View>
              <Switch
                value={profileLocked}
                disabled={profileLockBusy}
                onValueChange={(next) => {
                  void toggleProfileLock(next);
                }}
                trackColor={{
                  false: theme.border,
                  true: theme.accent,
                }}
              />
            </View>
          </View>
        </Pressable>
      </Modal>

      <BuklodProfileCustomizeSheet
        visible={customizeOpen}
        layout={profileLayout}
        dashboardTheme={personalDashboardTheme}
        onClose={() => setCustomizeOpen(false)}
        onChangeLayout={applyProfileLayout}
        onChangeDashboardTheme={(next) => {
          setPersonalDashboardTheme(next);
          void savePersonalDashboardTheme(next);
        }}
        onEditCover={() =>
          void changeProfileBackground()
        }
      />
    </ScrollView>
  );
}

function createMeStyles(
  theme: ReturnType<typeof useBuklodTheme>['theme']
) {
  return StyleSheet.create({
    content: {
      paddingTop: 10,
      paddingBottom: 24,
      paddingHorizontal: 0,
      marginHorizontal: 0,
      gap: 10,
    },
    sectionPad: {
      paddingHorizontal: 12,
    },
    eyebrow: {
      marginBottom: 8,
      marginLeft: 4,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.8,
      color: theme.textMuted,
    },
    quickRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 8,
      paddingRight: 4,
    },
    quickAction: {
      width: QUICK_ACTION_WIDTH,
      minWidth: QUICK_ACTION_WIDTH,
      minHeight: 48,
      paddingHorizontal: 14,
      paddingVertical: 10,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: withAlpha(theme.border, 0.88),
      borderRadius: 14,
      backgroundColor: withAlpha(theme.cardSurface, 0.72),
    },
    quickLabel: {
      fontSize: 12,
      lineHeight: 15,
      fontWeight: '800',
      textAlign: 'center',
      color: theme.textPrimary,
    },
    profileCard: {
      minHeight: 70,
      position: 'relative',
      alignItems: 'center',
      paddingTop: 12,
      paddingBottom: 23,
      paddingHorizontal: 12,
      marginBottom: 6,
      borderRadius: 0,
      overflow: 'hidden',
      borderWidth: 1,
    },
    profileCardCover: {
      ...StyleSheet.absoluteFill,
      overflow: 'hidden',
    },
    profileCardBackground: {
      ...StyleSheet.absoluteFill,
    },
    profileCardWash: {
      ...StyleSheet.absoluteFill,
      backgroundColor: 'rgba(0,0,0,0.16)',
    },
    profileMenuBtn: {
      position: 'absolute',
      top: 10,
      right: 10,
      zIndex: 4,
      width: 38,
      height: 38,
      borderRadius: 19,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    profileMenuBackdrop: {
      flex: 1,
      justifyContent: 'flex-start',
      alignItems: 'flex-end',
      paddingTop: 118,
      paddingRight: 14,
      backgroundColor: 'rgba(0,0,0,0.28)',
    },
    profileMenuSheet: {
      width: 280,
      borderRadius: 16,
      borderWidth: 1,
      overflow: 'hidden',
    },
    profileMenuItem: {
      minHeight: 64,
      paddingHorizontal: 14,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    profileMenuTitle: {
      fontSize: 14.5,
      fontWeight: '800',
    },
    profileMenuSubtitle: {
      marginTop: 2,
      fontSize: 12,
      lineHeight: 16,
    },
    avatarEditBadge: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      width: 32,
      height: 32,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: theme.accent,
      borderWidth: 2.5,
      borderColor: theme.white,
      shadowColor: theme.shadow,
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.2,
      shadowRadius: 5,
      elevation: 3,
    },
    avatarEditHit: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarHint: {
      marginTop: 6,
      fontSize: 12,
      lineHeight: 18,
      fontWeight: '900',
      letterSpacing: 0.15,
      textAlign: 'center',
    },
    avatarRing: {
      position: 'relative',
      padding: 5,
      borderWidth: 1.5,
      borderRadius: 64,
      zIndex: 2,
    },
    name: {
      marginTop: 6,
      paddingHorizontal: 8,
      fontSize: 25,
      lineHeight: 31,
      fontWeight: '900',
      letterSpacing: -0.4,
      textAlign: 'center',
    },
    meta: {
      marginTop: 4,
      fontSize: 13.5,
      lineHeight: 18,
      fontWeight: '700',
      textAlign: 'center',
    },
    rolesWrap: {
      marginTop: 8,
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 6,
    },
    roleBadge: {
      minHeight: 29,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      justifyContent: 'center',
    },
    roleText: {
      fontSize: 13,
      fontWeight: '800',
    },
    signOutWrap: {
      paddingTop: 12,
      paddingHorizontal: 4,
      paddingBottom: 5,
    },
    footer: {
      marginTop: 10,
      marginBottom: 4,
      textAlign: 'center',
      fontSize: 12.5,
      lineHeight: 14,
      fontWeight: '800',
      letterSpacing: 0.8,
    },
  });
}
