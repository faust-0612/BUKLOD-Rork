/* PATCH_184F_R3_PROFILE_CLEANUP */
/* PATCH_179C_R1_PREMIUM_CURRENT_PROFILE */
import { useCallback as useProfileFocusCallback, useRef as useProfileScrollRef } from 'react';
import { useFocusEffect as useProfileFocusEffect } from 'expo-router';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';
import BuklodProfileMembershipNav
  from '@/components/BuklodProfileMembershipNav';
import BuklodFoundationWorkspaceNav from '@/components/BuklodFoundationWorkspaceNav';
import { decode } from 'base64-arraybuffer';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import React, { ReactNode, useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Button, shared } from '@/components/UI';
import { AppRole, useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import { useBuklodAccess } from '@/hooks/useBuklodAccess';
import {
  BuklodDashboardCustomizer,
  DEFAULT_DASHBOARD_THEME,
  type DashboardTheme,
} from '@/components/BuklodDashboardCustomizer';
import {
  loadProfileDashboardTheme,
  saveProfileDashboardTheme,
} from '@/lib/buklodDashboardTheme';
// PATCH_170B_R3_PERSONAL_PROFILE_THEME


type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

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
  return (
    <View style={styles.drawer}>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [
          styles.drawerHeader,
          pressed && { opacity: 0.78 },
        ]}
      >
        <View style={styles.drawerIcon}>
          <MaterialCommunityIcons
            name={icon}
            size={18}
            color="#275D45"
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.drawerTitle}>{title}</Text>

          {!!subtitle && (
            <Text style={styles.drawerSubtitle}>
              {subtitle}
            </Text>
          )}
        </View>

        <MaterialCommunityIcons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#68756E"
        />
      </Pressable>

      {open && (
        <View style={styles.drawerBody}>
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
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuRow,
        pressed && { opacity: 0.72 },
      ]}
    >
      <View style={styles.menuIcon}>
        <MaterialCommunityIcons
          name={icon}
          size={18}
          color="#275D45"
        />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.menuTitle}>{title}</Text>

        {!!subtitle && (
          <Text style={styles.menuSubtitle}>
            {subtitle}
          </Text>
        )}
      </View>

      <MaterialCommunityIcons
        name="chevron-right"
        size={18}
        color="#8A948F"
      />
    </Pressable>
  );
}

export default function MeScreen() {
  /* PATCH_174B_R2_PROFILE_FOCUS_STABILITY */
  const profileScrollRef =
    useProfileScrollRef(null as ScrollView | null);

  useProfileFocusEffect(
    useProfileFocusCallback(() => {
      profileScrollRef.current?.scrollTo({
        x: 0,
        y: 0,
        animated: false,
      });
    }, [])
  );

  const {
    profile,
    roles,
    hasRole,
    hasAnyRole,
    signOut,
    refreshProfile,
  } = useAuth();

  const [
    personalDashboardTheme,
    setPersonalDashboardTheme,
  ] = useState<DashboardTheme>(
    DEFAULT_DASHBOARD_THEME
  );

  useEffect(
    () => {
      let mounted = true;

      if (!profile?.id) {
        setPersonalDashboardTheme(
          DEFAULT_DASHBOARD_THEME
        );

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

  /* PATCH_169D_ACTIVE_MZB_PROFILE_GATE */
  const {
    scopes: buklodScopes,
  } = useBuklodScope();

  const hasActiveMzbMembership =
    (buklodScopes as any[]).some(
      scope =>
        scope?.scope_type ===
          'ORGANIZATION' &&
        scope?.membership_status ===
          'ACTIVE' &&
        (
          String(
            scope?.name ?? ''
          )
            .toLowerCase()
            .includes(
              'mzb ministry'
            ) ||
          String(
            scope?.metadata
              ?.organization_code ??
              ''
          )
            .toLowerCase() ===
            'mzb' ||
          String(
            scope?.metadata
              ?.is_mzb ??
              ''
          )
            .toLowerCase() ===
            'true' ||
          String(
            scope?.metadata
              ?.organization_type ??
              ''
          )
            .toUpperCase() ===
            'MZB_MINISTRY'
        )
    );

  /* PATCH_172J_MZB_ADMIN_PORTAL_ACCESS
     Active MZB members keep normal access.
     System Admin must never lose the MZB Ministry portal. */
  const hasMzbPortalAccess =
    hasActiveMzbMembership ||
    hasRole('system_admin');
  /* PATCH_165H_ME_ENTITLEMENTS */
  const { hasEntitlement } = useBuklodAccess();
  const canUseBayanihan = hasEntitlement('bayanihan');
  const canUseTithes = hasEntitlement('tithes');

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

        const permission =
          await ImagePicker
            .requestMediaLibraryPermissionsAsync();

        if (
          !permission.granted
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
        const permission =
          await ImagePicker
            .requestMediaLibraryPermissionsAsync();

        if (
          permission.status !==
          'granted'
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


  // PROFILE_CIRCLE_RANK_IDENTITY
  const [circleRank, setCircleRank] =
    useState<string | null>('Circle Starter V');

  useEffect(() => {
    let active = true;

    const loadCircleRank = async () => {
      if (!profile?.id) {
        if (active) setCircleRank('Circle Starter V');
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
        setCircleRank('Circle Starter V');
        return;
      }

      const row =
        Array.isArray(data) && data.length
          ? data[0]
          : null;

      setCircleRank(
        row?.rank_name ?? 'Circle Starter V'
      );
    };

    void loadCircleRank();

    return () => {
      active = false;
    };
  }, [profile?.id]);


  const [openSection, setOpenSection] = useState<'buklod' | 'organizations' | 'ministry' | 'admin' | 'account' | null>('buklod');

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
      setOpenSection('buklod');
    }
  }, [myBuklodParams.section]);

  const isSystemAdmin = hasRole('system_admin');
  const isPastor = hasRole('pastor');
  const isMentor = hasRole('mentor');

  const canLead = hasAnyRole([
    'leader',
    'pastor',
    'local_admin',
    'system_admin',
  ]);

  const canReview = hasAnyRole([
    // PATCH_156B_LOCAL_REVIEW_MENU
    'pastor',
    'local_admin',
    'system_admin',
  ]);

  const hasMinistryTools =
    canLead || isMentor || isPastor;

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

  return (
    <ScrollView
      ref={profileScrollRef}
      style={[shared.screen, { backgroundColor: personalDashboardTheme.backgroundColor }]}
      contentContainerStyle={[
        shared.content,
        styles.content,
        {
          /* UI_002_R4_R6_PROFILE_EDGE */
          paddingHorizontal: 0,
          marginHorizontal: 0,
          gap: 6,
        }
      ]}
      showsVerticalScrollIndicator={false}
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
          !!(
            profileBackgroundUrl ||
            (profile as any)?.profile_background_url
          ) && {
            backgroundColor: 'transparent',
          },
        ]}
      >
        {!!(profileBackgroundUrl || (profile as any)?.profile_background_url) && (
          <View
            pointerEvents="none"
            style={styles.profileCardCover}
          >
            <Image
              source={{
                uri:
                  profileBackgroundUrl ||
                  (profile as any)?.profile_background_url,
              }}
              resizeMode="cover"
              style={styles.profileCardBackground}
              onLoad={() => {
                console.log(
                  'PROFILE COVER LOADED:',
                  profileBackgroundUrl ||
                    (profile as any)?.profile_background_url
                );
              }}
              onError={(event) => {
                console.error(
                  'PROFILE COVER IMAGE ERROR:',
                  event.nativeEvent?.error,
                  profileBackgroundUrl ||
                    (profile as any)?.profile_background_url
                );
              }}
            />

            <View
              style={styles.profileCardWash}
            />
          </View>
        )}
        <View
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 20,
            backgroundColor: '#FFFFFF',
            borderRadius: 22,
            shadowColor: '#000000',
            shadowOpacity: 0.18,
            shadowRadius: 5,
            shadowOffset: {
              width: 0,
              height: 2,
            },
            elevation: 4,
          }}
        >
          <BuklodDashboardCustomizer
            theme={personalDashboardTheme}
            canCustomize={!!profile?.id}
            onSave={
              savePersonalDashboardTheme
            }          onEditProfileBackground={() =>
            void changeProfileBackground()
          }
        />
        </View>
        <Pressable
          style={
            styles.avatarRing
          }
          disabled={
            avatarBusy
          }
          onPress={() =>
            void changeProfilePhoto()
          }
        >
          <Image
            source={
              profile?.avatar_url
                ? {
                    uri:
                      profile.avatar_url,
                  }
                : fallbackPortrait
            }
            style={
              styles.avatar
            }
          />
<View
            style={
              styles.avatarEditBadge
            }
          >
            <MaterialCommunityIcons
              name={
                avatarBusy
                  ? 'progress-clock'
                  : 'camera-outline'
              }
              size={17}
              color="#FFFFFF"
            />
          </View>
        </Pressable>

        <Text
          style={
            styles.avatarHint
          }
        >
          {avatarBusy
            ? 'UPLOADING...'
            : 'Tap photo to change'}
        </Text>

        <Text style={styles.name}>
          {profile?.full_name || 'BUKLOD Member'}
        </Text>

        {!!circleRank && (
          <Pressable
            onPress={() =>
              router.push('/points')
            }
            style={{
              marginTop: 9,
              paddingHorizontal: 20,
              paddingVertical: 10,
              borderRadius: 999,
              backgroundColor: '#0B5D2A',
              borderWidth: 2,
              borderColor: '#FFFFFF',
              shadowColor: '#000000',
              shadowOpacity: 0.55,
              shadowRadius: 9,
              shadowOffset: {
                width: 0,
                height: 3,
              },
              elevation: 9,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                lineHeight: 23,
                fontWeight: '900',
                letterSpacing: 0.5,
                color: '#FFFFFF',
                textShadowColor: '#000000',
                textShadowOffset: {
                  width: 0,
                  height: 2,
                },
                textShadowRadius: 7,
              }}
            >
              {circleRank}
            </Text>
          </Pressable>
        )}
{/* PATCH_169D_MEMBERSHIP_NAV_MOUNT */}
        <BuklodProfileMembershipNav />
      </View>
      {/* PATCH_166M_MY_BUKLOD_CONTENT_PRESERVED */}
      <View>



        

        <MenuRow
          icon="account-group-outline"
          title="My Clusters"
          
          onPress={() => router.push('/clusters' as any)}
        />

                <MenuRow
          icon="bullhorn-outline"
          title="Advertise"
          
          onPress={() => router.push('/advertise' as any)}
        />
<MenuRow
          icon="lifebuoy"
          title="BUKLOD Policy"
          
          onPress={() => router.push('/policy' as any)}
        />

                <MenuRow
          icon="email-outline"
          title="Contact Us"
          
          onPress={() =>
            router.push(
              '/contact-us' as any
            )
          }
        />
<MenuRow
          icon="message-text-outline"
          title="Send Feedback"
          
          onPress={() => router.push('/feedback')}
        />
      </View>
      {/* PATCH_168C_ORGANIZATIONS_BUTTON */}
      <Pressable
        onPress={() =>
          router.push('/organizations' as any)
        }
        style={({ pressed }) => [
          styles.organizationMainButton,
          pressed && {
            opacity: 0.72,
          },
        ]}
      >
        <View
          style={
            styles.organizationMainButtonIcon
          }
        >
          <MaterialCommunityIcons
            name="domain"
            size={22}
            color="#FFFFFF"
          />
        </View>

        <View
          style={{
            flex: 1,
          }}
        >
          <Text
            style={
              styles.organizationMainButtonTitle
            }
          >
            Organizations
          </Text>

          <Text
            style={
              styles.organizationMainButtonText
            }
          >
            Create and manage organization environments
          </Text>
        </View>

        <MaterialCommunityIcons
          name="chevron-right"
          size={21}
          color="#275D45"
        />
      </Pressable>

      {/* PATCH_168A_R3_ORGANIZATION_PORTALS */}
      {hasMzbPortalAccess && (
      <View
        style={
          styles.organizationPortalSection
        }
      >
        <Text
          style={
            styles.organizationPortalEyebrow
          }
        >
          MY ORGANIZATIONS
        </Text>

        <Pressable
          onPress={() =>
            router.push('/mzb/home' as any)
          }
          style={({ pressed }) => [
            styles.organizationPortal,
            pressed && {
              opacity: 0.72,
            },
          ]}
        >
          <View
            style={
              styles.organizationPortalIcon
            }
          >
            <MaterialCommunityIcons
              name="church"
              size={22}
              color="#FFFFFF"
            />
          </View>

          <View
            style={{
              flex: 1,
            }}
          >
            <Text
              style={
                styles.organizationPortalTitle
              }
            >
              MZB Ministry
            </Text>

            <Text
              style={
                styles.organizationPortalText
              }
            >
              Open MZB Ministry environment
            </Text>
          </View>

          <MaterialCommunityIcons
            name="chevron-right"
            size={21}
            color="#275D45"
          />
        </Pressable>
      </View>
      )}


      {isSystemAdmin && (
        <DrawerSection
          title="System Administration"
          
          icon="shield-crown-outline"
          open={openSection === 'admin'}
          onToggle={() => toggle('admin')}
        >
          <View style={styles.adminBanner}>
            <MaterialCommunityIcons
              name="shield-check-outline"
              size={25}
              color="#275D45"
            />

            <View style={{ flex: 1 }}>
              <Text style={styles.adminBannerTitle}>
                Executive Administration
              </Text>

              <Text style={styles.adminBannerText}>
                Organization, formation, users, operations and governance.
              </Text>
            </View>
          </View>

          
                    
          {/* PATCH_174A_R2_ADMIN_RECOVERY_MENU */}
          <MenuRow
            icon="lock-reset"
            title="Account Recovery Requests"
            
            onPress={() =>
              router.push('/admin/account-recovery' as any)
            }
          />
<Button
            title="OPEN BUKLOD ADMIN"
            onPress={() => router.push('/admin')}
          />
        </DrawerSection>
      )}

      <DrawerSection
        title="My BUKLOD"
        
        icon="lock-outline"
        open={openSection === 'account'}
        onToggle={() => toggle('account')}
      >

        {/* PATCH_172K_R4_PERSONAL_INFORMATION */}
        <MenuRow
          icon="account-edit-outline"
          title="Edit My Personal Information"
          
          onPress={() =>
            router.push(
              '/account/personal-information' as any
            )
          }
        />



                        <MenuRow
          icon="crown-outline"
          title="Paid Features"
          
          onPress={() => router.push('/premium' as any)}
        />
        {/* PATCH_173G_R4_PROFILE_STATUS_ENTRY */}
                {/* PATCH_177E_R2_ATTENDANCE_QR_ENTRY */}
        <MenuRow
          icon="qrcode"
          title="My Attendance QR"
          
          onPress={() =>
            router.push(
              '/profile/attendance-qr' as any
            )
          }
        />
<MenuRow
          icon="note-text-outline"
          title="Profile Note"
          
          onPress={() =>
            router.push('/profile/status' as any)
          }
        />
<MenuRow
          icon="lock-reset"
          title="Password & Recovery"
          
          onPress={() =>
            router.push(
              '/account/security' as any
            )
          }
        />
        {/* PATCH_174A_R2_RECOVERY_PIN_MENU */}
        <MenuRow
          icon="shield-lock-outline"
          title="Recovery PIN"
          
          onPress={() =>
            router.push('/account/recovery-pin' as any)
          }
        />
        {/* PATCH_174C_ACCOUNT_DEACTIVATE_MENU */}
        <MenuRow
          icon="account-off-outline"
          title="Deactivate Account"
          
          onPress={() =>
            router.push('/account/deactivate' as any)
          }
        />
        {/* PATCH_174C_ACCOUNT_DELETE_MENU */}
        <MenuRow
          icon="delete-outline"
          title="Delete Account"
          
          onPress={() =>
            router.push('/account/delete' as any)
          }
        />
<MenuRow
          icon="file-document-outline"
          title="Privacy Notice"
          
          onPress={() => router.push('/privacy/notice')}
        />
                {isSystemAdmin && (
          <MenuRow
            icon="crown-outline"
            title="Subscription Admin"
            
            onPress={() => router.push('/system/paid-features' as any)}
          />
        )}
{isSystemAdmin && (
          

        <MenuRow
          icon="test-tube"
          title="Pilot Checklist"
          
          onPress={() => router.push('/pilot/checklist')}
        />
        )}

        <View style={styles.signOutWrap}>
          <Button
            title="SIGN OUT"
            outline
            onPress={signOut}
          />
        </View>
      </DrawerSection>

      {/* BUKLOD_FOUNDATION_WORKSPACE_NAV */}
      <BuklodFoundationWorkspaceNav />

      <Text style={styles.footer}>
        Samahang Binuklod ng Pag-ibig
      </Text></ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 10,
    paddingBottom: 24,
    gap: 6,
  },

  organizationMainButton: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: 'rgba(39,93,69,0.13)',
    borderRadius: 13,
    paddingHorizontal: 13,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    marginBottom: 6,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.045,
    shadowRadius: 11,
    elevation: 2,
  },

  organizationMainButtonIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#275D45',
    shadowColor: '#275D45',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.16,
    shadowRadius: 7,
    elevation: 2,
  },

  organizationMainButtonTitle: {
    fontSize: 15.5,
    lineHeight: 18,
    fontWeight: '900',
    letterSpacing: -0.1,
    color: '#17231D',
  },

  organizationMainButtonText: {
    marginTop: 3,
    fontSize: 12.5,
    lineHeight: 18,
    color: '#6B7280',
  },
  organizationPortalSection: {
    marginBottom: 6,
  },

  organizationPortalEyebrow: {
    marginBottom: 6,
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.95,
    color: '#275D45',
  },

  organizationPortal: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: 'rgba(39,93,69,0.13)',
    borderRadius: 13,
    paddingHorizontal: 13,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.045,
    shadowRadius: 11,
    elevation: 2,
  },

  organizationPortalIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#275D45',
  },

  organizationPortalTitle: {
    fontSize: 15.5,
    lineHeight: 18,
    fontWeight: '900',
    letterSpacing: -0.1,
    color: '#17231D',
  },

  organizationPortalText: {
    marginTop: 3,
    fontSize: 12.5,
    lineHeight: 18,
    color: '#6B7280',
  },
  profileCard: {
    /* PATCH_174B_R2_PROFILE_STABLE_FOOTPRINT */
    minHeight: 70,
    position: 'relative',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 23,
    paddingHorizontal: 12,
    marginBottom: 6,
    borderRadius: 0,
    backgroundColor: 'rgba(39,93,69,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(39,93,69,0.13)',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
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
    backgroundColor:
      'rgba(0,0,0,0.16)',
  },

rankTextStrong: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
    letterSpacing: 0.25,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.95)',
    textShadowOffset: {
      width: 0,
      height: 2,
    },
    textShadowRadius: 7,
  },

rankPill: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 15,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    backgroundColor: 'rgba(11,93,42,0.92)',
    shadowColor: '#000000',
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    elevation: 5,
  },

avatarEditBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#275D45',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.20,
    shadowRadius: 5,
    elevation: 3,
  },

  avatarHint: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '900',
    letterSpacing: 0.15,
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.90)',
    textShadowOffset: {
      width: 0,
      height: 1,
    },
    textShadowRadius: 4,
  },

  avatarRing: {
    padding: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.72)',
    borderRadius: 64,
    backgroundColor: '#FFFFFF',
    zIndex: 2,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 5,
  },

  avatar: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: '#EEF4F0',
  },

  name: {
    marginTop: 6,
    paddingHorizontal: 8,
    fontSize: 25,
    lineHeight: 31,
    fontWeight: '900',
    letterSpacing: -0.4,
    textAlign: 'center',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.95)',
    textShadowOffset: {
      width: 0,
      height: 2,
    },
    textShadowRadius: 7,
  },

  identity: {
    marginTop: 5,
    fontSize: 13.5,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 1.35,
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.95)',
    textShadowOffset: {
      width: 0,
      height: 1,
    },
    textShadowRadius: 5,
  },

  rolesWrap: {
    marginTop: 6,
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
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 1,
  },

  roleBadgeExecutive: {
    backgroundColor: '#275D45',
    borderColor: 'rgba(255,255,255,0.72)',
  },

  roleText: {
    fontSize: 13.5,
    fontWeight: '900',
    letterSpacing: 0.1,
    color: '#275D45',
  },

  roleTextExecutive: {
    color: '#FFFFFF',
  },

  executiveLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 5,
    marginBottom: 6,
    paddingHorizontal: 4,
  },

  executiveEyebrow: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: '#7A867F',
  },

  executiveTitle: {
    marginTop: 2,
    fontSize: 23,
    lineHeight: 29,
    fontWeight: '900',
    letterSpacing: -0.35,
    color: '#1C2822',
  },

  drawer: {
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(25,45,35,0.09)',
    borderRadius: 13,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.045,
    shadowRadius: 12,
    elevation: 2,
  },

  /* PATCH_153E_1_SECONDARY_DRAWER */
  drawerHeader: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 10,
    gap: 6,
    backgroundColor: '#FFFFFF',
  },

  drawerIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF4ED',
    borderWidth: 1,
    borderColor: 'rgba(39,93,69,0.08)',
  },

  drawerTitle: {
    fontSize: 15.5,
    lineHeight: 18,
    fontWeight: '900',
    letterSpacing: -0.05,
    color: '#1C2822',
  },

  drawerSubtitle: {
    marginTop: 2,
    fontSize: 13.5,
    lineHeight: 18,
    color: '#7A867F',
  },

  drawerBody: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(25,45,35,0.07)',
    paddingHorizontal: 0,
    paddingTop: 5,
    paddingBottom: 7,
    backgroundColor: '#FCFDFC',
  },

  menuRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 7,
    marginVertical: 2,
    borderRadius: 13,
    gap: 6,
    backgroundColor: '#FFFFFF',
  },

  menuIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#EFF6F1',
  },

  menuTitle: {
    fontSize: 14.5,
    lineHeight: 18,
    fontWeight: '900',
    letterSpacing: -0.03,
    color: '#25312B',
  },

  menuSubtitle: {
    marginTop: 1,
    fontSize: 12.5,
    lineHeight: 18,
    color: '#7A867F',
  },

  adminBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 14,
    marginVertical: 7,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: 'rgba(39,93,69,0.10)',
    backgroundColor: '#EEF6F1',
  },

  adminBannerTitle: {
    fontSize: 15.5,
    lineHeight: 18,
    fontWeight: '900',
    color: '#275D45',
  },

  adminBannerText: {
    marginTop: 3,
    fontSize: 13.5,
    lineHeight: 18,
    color: '#66736C',
  },

  signOutWrap: {
    paddingTop: 12,
    paddingHorizontal: 4,
    paddingBottom: 5,
  },

  footer: {
    marginTop: 6,
    marginBottom: 4,
    textAlign: 'center',
    fontSize: 12.5,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#909B95',
  },
});









