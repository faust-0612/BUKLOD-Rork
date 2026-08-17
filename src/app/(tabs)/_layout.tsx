import { withLayoutContext } from 'expo-router';
import { createMaterialTopTabNavigator } from 'expo-router/js-top-tabs';
import BuklodDashboardContextBar from '@/components/BuklodDashboardContextBar';
import BuklodHeaderSponsor from '@/components/BuklodHeaderSponsor';
import {
  Redirect,
  router,
  usePathname,
} from 'expo-router';
import { ActivityIndicator,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/lib/theme';

import { useAuth } from '@/providers/AuthProvider';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';
import { useCompliance } from '@/providers/ComplianceProvider';
import { useRuntimeConfig } from '@/providers/RuntimeConfigProvider';

/* PATCH_168_REAL_BARAHA_PAGER_V2
 *
 * REAL PAGE/BARAHA TRANSITION:
 * - current page follows finger
 * - adjacent page is visible during drag
 * - native pager decides snap/settle on release
 */
const MaterialPager =
  createMaterialTopTabNavigator();

const SwipeTabs =
  withLayoutContext(
    MaterialPager.Navigator as any,
    undefined,
    true
  ) as any;


function SwipeDashboardHeader(){

  const pathname=
    usePathname();

  const insets=
    useSafeAreaInsets();


  let title='Buklod';

  let placement:
    | 'home'
    | 'messages'
    | 'learn'
    | 'community'
    | 'me'
    | null
    =null;


  if(
    pathname==='/home'
    ||
    pathname.startsWith('/home/')
  ){
    title='Buklod';
    placement='home';
  }
  else if(
    pathname==='/messages'
    ||
    pathname.startsWith('/messages/')
  ){
    title='Buklod';
    placement='messages';
  }
  else if(
    pathname==='/learn'
    ||
    pathname.startsWith('/learn/')
  ){
    title='Buklod';
    placement='learn';
  }
  else if(
    pathname==='/buklod'
    ||
    pathname.startsWith('/buklod/')
  ){
    title='Buklod';
    placement='community';
  }
  else if(
    pathname==='/prayer'
    ||
    pathname.startsWith('/prayer/')
  ){
    title='Buklod';
  }
  else if(
    pathname==='/me'
    ||
    pathname.startsWith('/me/')
  ){
    title='Buklod';
  }


  return(
    <View
      style={{
        paddingTop:
          insets.top,
        minHeight:
          54+
          insets.top,
        backgroundColor:
          colors.greenDark,
        flexDirection:
          'row',
        alignItems:
          'center',
        justifyContent:
          'space-between',
        paddingLeft:
          16,
      }}
    >

      <Text
        numberOfLines={1}
        style={{
          flex:1,
          color:'#B7E4A8',
          fontSize:26,
          fontWeight:
            '900',
        }}
      >
        {title}
      </Text>


      {placement
        ? (
          <BuklodHeaderSponsor
            placement={
              placement
            }
          />
        )
        : (
          <View
            style={{
              width:12,
            }}
          />
        )
      }

    </View>
  );
}


function DashboardSponsorPlacementSlot({
  pathname,
}: {
  pathname: string;
}) {
  let placement:
    | 'home'
    | 'messages'
    | 'community'
    | 'prayer'
    | null = null;

  if (
    pathname === '/home' ||
    pathname.startsWith('/home/')
  ) {
    placement = 'home';
  }
  else if (
    pathname === '/messages' ||
    pathname.startsWith('/messages/')
  ) {
    placement = 'messages';
  }
  else if (
    pathname === '/buklod' ||
    pathname.startsWith('/buklod/')
  ) {
    placement = 'community';
  }
  else if (
    pathname === '/prayer' ||
    pathname.startsWith('/prayer/')
  ) {
    placement = 'prayer';
  }

  if (!placement) {
    return null;
  }

  return (
    <></>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { activeScope } = useBuklodScope();
  const showPrayer = Boolean(activeScope?.show_faith_content);

  /* PATCH_154N_SWIPE_TABS */
  const pathname =
    usePathname();

  const { session, loading, membershipState, profile } = useAuth();
  const { loading: complianceLoading, requiresAcceptance } = useCompliance();
  const { loading: runtimeLoading, config } = useRuntimeConfig();

  if (loading || complianceLoading || runtimeLoading || membershipState === 'loading') {
    return <View style={{flex:1,alignItems:'center',justifyContent:'center'}}><ActivityIndicator color={colors.green}/></View>;
  }
  if (!session) return <Redirect href="/(auth)/login" />;
  if (config?.maintenance_mode) return <Redirect href="/system/maintenance" />;
  if (config?.update_required) return <Redirect href="/system/update-required" />;
  if (config?.pilot_access_required && !config?.pilot_access_granted) return <Redirect href="/system/pilot-access" />;
  if (requiresAcceptance) return <Redirect href="/privacy/consent" />;
  /* PATCH_171F_RESTORE_TABS_COMMUNITY_ACCESS_GATE */
  // Public/Community accounts may enter when their active profile has
  // a valid connection_type. Local/managed membership remains gated
  // by membershipState === 'ready'.
  const hasCommunityAccess =
    profile?.is_active === true &&
    !!profile?.connection_type;

  if (membershipState !== 'ready' && !hasCommunityAccess) {
    return <Redirect href="/onboarding" />;
  }

  /* PATCH_164A_UI_UNIVERSAL_ACCESS */
  if (!profile) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <View
      style={{ flex: 1 }}
    >
      <View
      style={{
        flex:1,
        backgroundColor:
          colors.white,
      }}
    >

      <SwipeDashboardHeader />
      <BuklodDashboardContextBar />

      {/* GLOBAL_ADMOB_DIRECTLY_BELOW_ENCOURAGEMENT_V3 */}
      <DashboardSponsorPlacementSlot pathname={pathname} />

      <SwipeTabs
      keyboardDismissMode="on-drag"
      screenOptions={{
        /* PATCH_168_REAL_BARAHA_SCENE_V2 */
        swipeEnabled: true,
        lazy: false,

        sceneStyle: {
          backgroundColor: colors.white,
          marginHorizontal: 5,
          marginVertical: 3,
          borderRadius: 18,
          overflow: 'hidden',
        },

        headerShown: false,
      tabBarActiveTintColor: colors.green,
      tabBarInactiveTintColor: colors.muted,
      tabBarLabelStyle: {
        fontSize: 11,
        fontWeight: '800',
      },
        /* PATCH_153E_1_PRIMARY_NAV */
        tabBarStyle: {
          display: 'none',
          height: 70 + insets.bottom,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 9),
          borderTopWidth: 1,
          borderTopColor: colors.line,
          backgroundColor: colors.white,
        },

        tabBarItemStyle: {
          paddingTop: 2,
        },
    }}>
  <SwipeTabs.Screen
    name="home"
    options={{
      title: 'Home',
      headerRight: () => (
        <BuklodHeaderSponsor placement="home" />
      ),
      tabBarIcon: ({ color }: { color: string }) => (
        <MaterialCommunityIcons
          name="home-variant-outline"
          size={23}
          color={color}
        />
      ),
    }}
  />

  <SwipeTabs.Screen
    name="messages"
    options={{
      title: 'Connect',
      headerRight: () => (
        <BuklodHeaderSponsor placement="messages" />
      ),
      tabBarIcon: ({ color }: { color: string }) => (
        <MaterialCommunityIcons
          name="message-text-outline"
          size={23}
          color={color}
        />
      ),
    }}
  />
<SwipeTabs.Screen
    name="buklod"
    options={{
      title: 'Community',
      headerRight: () => (
        <BuklodHeaderSponsor placement="community" />
      ),
      tabBarIcon: ({ color }: { color: string }) => (
        <MaterialCommunityIcons
          name="account-group-outline"
          size={23}
          color={color}
        />
      ),
    }}
  />

  {showPrayer && (
      <SwipeTabs.Screen
    name="prayer"
    options={{
      title: 'Prayer',
      headerRight: () => (
        <BuklodHeaderSponsor placement="prayer" />
      ),
      tabBarIcon: ({ color }: { color: string }) => (
        <MaterialCommunityIcons
          name="hands-pray"
          size={23}
          color={color}
        />
      ),
    }}
  />

  )}
      <SwipeTabs.Screen
    name="me"
    options={{
      title: 'Me',
      headerRight: () => (
        <BuklodHeaderSponsor placement="me" />
      ),
      tabBarIcon: ({ color }: { color: string }) => (
        <MaterialCommunityIcons
          name="account-circle-outline"
          size={23}
          color={color}
        />
      ),
    }}
  />
    </SwipeTabs>
    </View>
    </View>
  );
}



