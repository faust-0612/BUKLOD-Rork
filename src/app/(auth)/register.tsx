import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { enqueueBuklodMainHealthIssue, flushBuklodMainHealthQueue } from '@/lib/buklodMainHealth';
import {
  recordReferral,
  resolveReferralTarget,
  suggestReferralTargets,
  type ReferralSuggestItem,
} from '@/lib/buklodRewards';
import { colors } from '@/lib/theme';
import BuklodActionFeedback, { type BuklodActionStatus } from '@/components/BuklodActionFeedback';
import { useBuklodDrawerBottomInset } from '@/lib/buklodSafeArea';

type Church = {
  id: string;
  name: string;
  code: string | null;
};

type Group = {
  id: string;
  name: string;
  code: string | null;
};

type LoginMethod =
  | 'mobile'
  | 'username'
  | 'email';

function normalizePhilippinePhone(
  value: string
) {
  const cleaned =
    value.replace(/[^\d+]/g, '');

  if (/^\+639\d{9}$/.test(cleaned)) {
    return cleaned;
  }

  if (/^639\d{9}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  if (/^09\d{9}$/.test(cleaned)) {
    return `+63${cleaned.slice(1)}`;
  }

  return null;
}

function normalizeUsername(
  value: string
) {
  const username =
    value.trim().toLowerCase();

  if (
    username.length < 3 ||
    username.length > 30 ||
    !/^(?=.*[a-z])[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(
      username
    )
  ) {
    return null;
  }

  return username;
}

function mobileInternalEmail(
  phone: string
) {
  return `m.${phone.replace(
    /\D/g,
    ''
  )}@buklod.invalid`;
}

function usernameInternalEmail(
  username: string
) {
  return `u.${username}@buklod.invalid`;
}

function buildFullName(
  firstName: string,
  middleName: string,
  surname: string,
  suffix: string
) {
  return [
    firstName.trim(),
    middleName.trim(),
    surname.trim(),
    suffix.trim(),
  ]
    .filter(Boolean)
    .join(' ');
}

export default function RegisterScreen() {
  const params = useLocalSearchParams<{ ref?: string; referral?: string }>();
  const drawerBottomInset = useBuklodDrawerBottomInset();

  const [churches, setChurches] =
    useState<Church[]>([]);
  const [groups, setGroups] =
    useState<Group[]>([]);

  const [churchId, setChurchId] =
    useState('');
  const [groupId, setGroupId] =
    useState('');
  const [connectionType,setConnectionType] =
    useState<'local_member'|'invited'|'seeking_church'|'community'>('community');
  const wantsLocalMembership = connectionType === 'local_member';

  const [
    churchDrawerOpen,
    setChurchDrawerOpen,
  ] = useState(false);

  const [
    churchSearch,
    setChurchSearch,
  ] = useState('');

  const [
    proposeFirstGroup,
    setProposeFirstGroup,
  ] = useState(false);

  const [
    proposedGroupName,
    setProposedGroupName,
  ] = useState('');

  const [
    firstName,
    setFirstName,
  ] = useState('');
  const [
    middleName,
    setMiddleName,
  ] = useState('');
  const [
    surname,
    setSurname,
  ] = useState('');
  const [
    suffix,
    setSuffix,
  ] = useState('');

  const [
    loginMethod,
    setLoginMethod,
  ] = useState<LoginMethod>(
    'mobile'
  );

  const [
    loginIdentifier,
    setLoginIdentifier,
  ] = useState('');

  const [
    contactMobile,
    setContactMobile,
  ] = useState('');

  const [birthDate, setBirthDate] =
    useState('');

  const [sex, setSex] =
    useState<
      'male' | 'female' | ''
    >('');

  const [password, setPassword] =
    useState('');

  const [referralQuery, setReferralQuery] =
    useState(
      () =>
        String(params.ref ?? params.referral ?? '').trim(),
    );
  const [referralSuggestions, setReferralSuggestions] =
    useState<ReferralSuggestItem[]>([]);
  const [referralStatus, setReferralStatus] = useState<
    'idle' | 'checking' | 'matched' | 'missing'
  >('idle');
  const [referralMatchLabel, setReferralMatchLabel] =
    useState('');
  const [selectedReferralCode, setSelectedReferralCode] =
    useState('');
  const referralSuggestTimer = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    memberNote,
    setMemberNote,
  ] = useState('');

  /* PATCH_164A_REG2_STATE_RECOVERY_V2 */


  const [
    barangay,
    setBarangay,
  ] = useState('');

  const [
    cityMunicipality,
    setCityMunicipality,
  ] = useState('');

  const [
    province,
    setProvince,
  ] = useState('');

  const [
    country,
    setCountry,
  ] = useState('Philippines');

  const [
    postalCode,
    setPostalCode,
  ] = useState('');

  const [
    faithIdentity,
    setFaithIdentity,
  ] = useState<
    | 'CHRISTIAN'
    | 'NON_CHRISTIAN'
    | 'PREFER_NOT_TO_SAY'
  >('PREFER_NOT_TO_SAY');

  const [
    showFaithContent,
    setShowFaithContent,
  ] = useState<boolean>(false);

  const chooseFaithIdentity = (
    value:
      | 'CHRISTIAN'
      | 'NON_CHRISTIAN'
      | 'PREFER_NOT_TO_SAY'
  ) => {
    setFaithIdentity(value);

    setShowFaithContent(
      value === 'CHRISTIAN'
    );
  };
  const [
    groupsLoading,
    setGroupsLoading,
  ] = useState(false);

  const [busy, setBusy] =
    useState(false);
  const createAccountInFlight =
    useRef(false);
  const accountCreated = useRef(false);
  const [created, setCreated] = useState(false);
  const [feedback, setFeedback] = useState<{ status: BuklodActionStatus; message: string }>({ status: 'idle', message: '' });
  const showRegistrationError = (title: string, message: string) => {
    setFeedback({ status: 'error', message });
    if (Platform.OS !== 'web') Alert.alert(title, message);
  };

  const finishCreateAccount = () => {
    createAccountInFlight.current = false;
    setBusy(false);
  };

  const applyReferralSelection = (item: ReferralSuggestItem) => {
    setReferralQuery(item.username || item.referral_code);
    setSelectedReferralCode(item.referral_code);
    setReferralMatchLabel(item.username || item.label);
    setReferralStatus('matched');
    setReferralSuggestions([]);
  };

  const onReferralQueryChange = (value: string) => {
    const next = value.replace(/^\s+/, '');
    setReferralQuery(next);
    setSelectedReferralCode('');
    setReferralMatchLabel('');

    if (referralSuggestTimer.current) {
      clearTimeout(referralSuggestTimer.current);
      referralSuggestTimer.current = null;
    }

    const trimmed = next.trim();
    if (trimmed.length < 2) {
      setReferralSuggestions([]);
      setReferralStatus(trimmed ? 'checking' : 'idle');
      return;
    }

    setReferralStatus('checking');
    referralSuggestTimer.current = setTimeout(() => {
      void (async () => {
        const items = await suggestReferralTargets(trimmed, 8);
        setReferralSuggestions(items);

        const exact = items.find(
          (item) =>
            item.match_kind === 'username_exact' ||
            item.match_kind === 'code' ||
            (item.username &&
              item.username.toLowerCase() === trimmed.toLowerCase()) ||
            item.referral_code.toLowerCase() === trimmed.toLowerCase(),
        );

        if (exact) {
          setSelectedReferralCode(exact.referral_code);
          setReferralMatchLabel(exact.username || exact.label);
          setReferralStatus('matched');
          return;
        }

        const resolved = await resolveReferralTarget(trimmed);
        if (resolved.found && resolved.referral_code) {
          setSelectedReferralCode(resolved.referral_code);
          setReferralMatchLabel(
            resolved.username || resolved.label || 'BUKLOD member',
          );
          setReferralStatus('matched');
          return;
        }

        setSelectedReferralCode('');
        setReferralMatchLabel('');
        setReferralStatus(items.length ? 'idle' : 'missing');
      })();
    }, 280);
  };

  useEffect(() => {
    const seed = String(params.ref ?? params.referral ?? '').trim();
    if (!seed) return;
    onReferralQueryChange(seed);
    // Prefill once from deep-link params.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (referralSuggestTimer.current) {
        clearTimeout(referralSuggestTimer.current);
      }
    };
  }, []);

/* PATCH_183B_NO_REGISTRATION_CHURCH_FETCH
 *
 * Registration creates a universal BUKLOD account only.
 * Church / Cluster / Organization membership discovery and joining
 * happen separately after registration, so registration must not
 * eagerly fetch Local Churches or block account creation on that fetch.
 */
useEffect(() => {
    let active = true;

    setGroupId('');
    setProposeFirstGroup(false);
    setProposedGroupName('');

    if (!churchId) {
      setGroups([]);
      return;
    }

    const loadGroups =
      async () => {
        setGroupsLoading(true);

        const {
          data,
          error,
        } = await supabase.rpc(
          'list_signup_buklod_groups',
          {
            p_church_id:
              churchId,
          }
        );

        if (!active) return;

        if (error) {
          setGroups([]);
          Alert.alert(
            'Could not load BUKLOD clusters',
            error.message
          );
        } else {
          setGroups(
            (data ??
              []) as Group[]
          );
        }

        setGroupsLoading(false);
      };

    void loadGroups();

    return () => {
      active = false;
    };
  }, [churchId]);

  const selectedChurch =
    useMemo(
      () =>
        churches.find(
          (church) =>
            church.id === churchId
        ) ?? null,
      [churches, churchId]
    );

  const filteredChurches =
    useMemo(() => {
      const query =
        churchSearch
          .trim()
          .toLowerCase();

      if (!query) {
        return churches;
      }

      return churches.filter(
        (church) =>
          church.name
            .toLowerCase()
            .includes(query) ||
          (church.code || '')
            .toLowerCase()
            .includes(query)
      );
    }, [
      churches,
      churchSearch,
    ]);

  const chooseLoginMethod = (
    method: LoginMethod
  ) => {
    setLoginMethod(method);
    setLoginIdentifier('');
  };

  const selectChurch = (
    church: Church
  ) => {
    setChurchId(church.id);
    setChurchSearch('');
    setChurchDrawerOpen(false);
  };


  const createAccount =
    async () => {
      if (
        !firstName.trim() ||
        !surname.trim() ||
        !loginIdentifier.trim() ||
        !password ||
        !barangay.trim() ||
        !cityMunicipality.trim() ||
        !province.trim() ||
        !country.trim()
      ) {
        return showRegistrationError(
          'BUKLOD',
          'First Name, Surname, your chosen Login, Password, Barangay, Municipality/City, Province, and Country are required.'
        );
      }

      if (password.length < 6) {
        return showRegistrationError(
          'BUKLOD',
          'Use a password with at least 6 characters.'
        );
      }

      const fullName =
        buildFullName(
          firstName,
          middleName,
          surname,
          suffix
        );

      let authEmail = '';
      let profileMobile:
        | string
        | null = null;
      let username:
        | string
        | null = null;
      let publicLoginValue = '';

      if (
        loginMethod ===
        'mobile'
      ) {
        const phone =
          normalizePhilippinePhone(
            loginIdentifier
          );

        if (!phone) {
          return showRegistrationError(
            'Mobile Number',
            'Enter a valid Philippine mobile number such as 09171234567.'
          );
        }

        authEmail =
          mobileInternalEmail(
            phone
          );
        profileMobile = phone;
        publicLoginValue = phone;
      } else if (
        loginMethod ===
        'username'
      ) {
        username =
          normalizeUsername(
            loginIdentifier
          );

        if (!username) {
          return showRegistrationError(
            'Username',
            'Use 3-30 characters, include at least one letter, and use only letters, numbers, dot, underscore, or hyphen.'
          );
        }

        authEmail =
          usernameInternalEmail(
            username
          );
        publicLoginValue =
          username;

        if (
          contactMobile.trim()
        ) {
          const phone =
            normalizePhilippinePhone(
              contactMobile
            );

          if (!phone) {
            return showRegistrationError(
              'Contact Mobile',
              'Enter a valid Philippine mobile number or leave it blank.'
            );
          }

          profileMobile = phone;
        }
      } else {
        const email =
          loginIdentifier
            .trim()
            .toLowerCase();

        if (
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
            email
          )
        ) {
          return showRegistrationError(
            'Email',
            'Enter a valid email address.'
          );
        }

        authEmail = email;
        publicLoginValue =
          email;

        if (
          contactMobile.trim()
        ) {
          const phone =
            normalizePhilippinePhone(
              contactMobile
            );

          if (!phone) {
            return showRegistrationError(
              'Contact Mobile',
              'Enter a valid Philippine mobile number or leave it blank.'
            );
          }

          profileMobile = phone;
        }
      }

      if (
        proposeFirstGroup &&
        proposedGroupName
          .trim().length < 2
      ) {
        return showRegistrationError(
          'BUKLOD Cluster',
          'Enter a proposed group name, or cancel the group proposal.'
        );
      }

      if (createAccountInFlight.current || accountCreated.current) {
        return;
      }

      createAccountInFlight.current = true;
      setBusy(true);
      setFeedback({ status: 'pending', message: 'Creating account. Please do not submit twice.' });
      try {
      const { data, error } =
        await supabase.auth.signUp(
          {
            email: authEmail,
            password,
            options: {
              data: {
                full_name:
                  fullName,
                first_name:
                  firstName.trim(),
                middle_name:
                  middleName.trim() ||
                  null,
                surname:
                  surname.trim(),
                suffix:
                  suffix.trim() ||
                  null,
                mobile:
                  profileMobile,
                birth_date:
                  birthDate.trim(),
                sex,
                login_method:
                  loginMethod,
                login_value:
                  publicLoginValue,
                username,
                /*
                 * PATCH_164A_REG2B_UNIVERSAL_ACCOUNT
                 *
                 * Registration creates the universal user first.
                 * Church, Cluster and Organization memberships
                 * are handled separately after registration.
                 */
                connection_type:
                  'community',
                requested_church_id:
                  null,
                requested_group_id:
                  null,
                proposed_group_name:
                  null,
                member_note:
                  null,
                /* PATCH_193A_ATOMIC_REGISTRATION */
                buklod_registration_version:
                  '193A',
                registration_barangay:
                  barangay.trim(),
                registration_city_municipality:
                  cityMunicipality.trim(),
                registration_province:
                  province.trim(),
                registration_country:
                  country.trim() ||
                  'Philippines',
                registration_postal_code:
                  postalCode.trim() ||
                  null,
                registration_faith_identity:
                  faithIdentity,
                registration_show_faith_content:
                  showFaithContent,
              },
            },
          }
        );

      if (error) {
        const duplicate =
          /already registered|already been registered|duplicate/i.test(
            error.message
          );

        return showRegistrationError(
          'Could not create account',
          duplicate
            ? `That ${loginMethod} is already being used by another BUKLOD account.`
            : error.message
        );
      }

      if (data?.user?.id) {
        accountCreated.current = true;
        setCreated(true);
      }
      if (!data.session) {
        setFeedback({
          status: 'warning',
          message: 'Account request accepted, but no login session was returned. Sign In or contact support before creating another account.',
        });
        return;
      }

      /*
       * PATCH_193A_REGISTRATION_HARDENING
       *
       * Auth signup atomically persists private address + faith onboarding
       * when the 193A marker is present. This RPC remains the one idempotent
       * completion path for local-scope synchronization.
       */
      let localSetupError: any = null;

      for (
        let attempt = 0;
        attempt < 2;
        attempt += 1
      ) {
        const result = await (
          supabase as any
        ).rpc(
          'buklod_complete_registration_v1',
          {
            p_barangay:
              barangay.trim(),
            p_city_municipality:
              cityMunicipality.trim(),
            p_province:
              province.trim(),
            p_country:
              country.trim() ||
              'Philippines',
            p_postal_code:
              postalCode.trim() ||
              null,
            p_faith_identity:
              faithIdentity,
            p_show_faith_content:
              showFaithContent,
            p_country_code: null,
            p_province_code: null,
            p_city_municipality_code:
              null,
            p_barangay_code: null,
          }
        );

        localSetupError =
          result.error;

        if (!localSetupError) {
          break;
        }

        if (attempt == 0) {
          await new Promise(
            (resolve) =>
              setTimeout(resolve, 350)
          );
        }
      }

      if (localSetupError) {
        setFeedback({
          status: 'warning',
          message: 'Account created. Local setup is pending. Use OPEN PUBLIC HOME and complete address setup later. Do not create another account.',
        });
        return;
      }

      let referralLinked = false;
      let referralLinkNote = '';
      const referralValue =
        selectedReferralCode.trim() ||
        referralQuery.trim();

      if (referralValue) {
        try {
          await recordReferral(referralValue, { alreadyResolved: Boolean(selectedReferralCode.trim()) });
          referralLinked = true;
        } catch (
          referralError: unknown
        ) {
          const message =
            referralError instanceof Error
              ? referralError.message
              : String(referralError ?? '');
          console.warn(
            'Referral record failed:',
            message,
          );
          // Report a privacy-safe operational failure through the existing
          // BUKLOD health queue. Never send names, codes, or passwords.
          const healthUserId = data?.user?.id;
          if (healthUserId) {
            const signature = /already recorded/i.test(message)
              ? 'REFERRAL_ALREADY_RECORDED'
              : /not authenticated|jwt|session/i.test(message)
                ? 'REFERRAL_SESSION_NOT_READY'
                : /invalid referral|not found|no matching/i.test(message)
                  ? 'REFERRAL_VALIDATION_REJECTED'
                  : 'REFERRAL_ATTACH_FAILED';
            void enqueueBuklodMainHealthIssue(healthUserId, {
              category: 'SUBMISSION',
              severity: 'ERROR',
              safeErrorCode: 'REFERRAL_ATTACH_FAILED',
              errorSignature: signature,
              correlationKey: 'REGISTER_REFERRAL_ATTACH',
              routeModule: 'auth/register',
              privacyClassification: 'OPERATIONAL',
            }).then(() => flushBuklodMainHealthQueue(healthUserId))
              .catch(() => undefined);
          }
          referralLinkNote =
            /already recorded/i.test(message)
              ? ' A referral is already recorded for this account.'
              : /not authenticated|jwt|session/i.test(message)
                ? ' Your account was created, but referral linking is pending because your login session was not ready.'
                : /invalid referral|not found|no matching/i.test(message)
                  ? ' Your account was created, but the referral could not be validated during submission.'
                  : ' Your account was created, but referral linking could not finish. Please contact support rather than registering again.';
        }
      }

      setFeedback({
        status: referralLinkNote ? 'warning' : 'success',
        message: referralLinked
          ? 'Account created successfully and referral linked. Tap OPEN PUBLIC HOME.'
          : `Account created successfully. Tap OPEN PUBLIC HOME.${referralLinkNote}`,
      });
      } catch (error: unknown) {
        setFeedback({
          status: accountCreated.current ? 'warning' : 'error',
          message: accountCreated.current
            ? 'Account created but setup interrupted. Use OPEN PUBLIC HOME or Sign In; do not register again.'
            : `Creation could not be confirmed: ${error instanceof Error ? error.message : 'Check your connection and Sign In first.'}`,
        });
      } finally {
        finishCreateAccount();
      }
    };

  const loginMethodLabel =
    loginMethod === 'mobile'
      ? 'Mobile Number *'
      : loginMethod ===
        'username'
      ? 'Username *'
      : 'Email Address *';

  const loginPlaceholder =
    loginMethod === 'mobile'
      ? '09171234567'
      : loginMethod ===
        'username'
      ? 'e.g. juandelacruz'
      : 'name@example.com';

  const loginHelp =
    loginMethod === 'mobile'
      ? 'Use 09XXXXXXXXX or +639XXXXXXXXX.'
      : loginMethod ===
        'username'
      ? '3-30 characters; include at least one letter. No spaces.'
      : 'No confirmation email will be required.';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : undefined
      }
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={
          styles.content
        }
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            alignItems: 'center',
          }}
        >
          <Image
            source={require('../../../assets/release/buklod-generic-photo.jpg')}
            style={styles.logo}
          />

          <Text style={styles.title}>
            Create BUKLOD Account
          </Text>

          <Text style={styles.subtitle}>
            Choose Mobile Number, Username, or Email for your login. No confirmation is required.
          </Text>
        </View>

        <Text style={styles.label}>
          YOUR NAME
        </Text>

        <Text
          style={
            styles.fieldTitle
          }
        >
          First Name *
        </Text>
        <TextInput
          style={styles.input}
          placeholder="First Name"
          value={firstName}
          onChangeText={setFirstName}
          autoCapitalize="words"
        />

        <Text
          style={
            styles.fieldTitle
          }
        >
          Middle Name
        </Text>
        <Text style={styles.help}>
          Optional
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Middle Name (optional)"
          value={middleName}
          onChangeText={setMiddleName}
          autoCapitalize="words"
        />

        <Text
          style={
            styles.fieldTitle
          }
        >
          Surname *
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Surname"
          value={surname}
          onChangeText={setSurname}
          autoCapitalize="words"
        />

        <Text
          style={
            styles.fieldTitle
          }
        >
          Suffix
        </Text>
        <Text style={styles.help}>
          Optional - e.g. Jr., Sr., II, III
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Suffix (optional)"
          value={suffix}
          onChangeText={setSuffix}
          autoCapitalize="words"
        />

        <Text style={styles.label}>
          CHOOSE YOUR LOGIN
        </Text>

        <View style={styles.advisoryCard}>
          <Text style={styles.advisoryTitle}>
            Tip: Email is recommended
          </Text>
          <Text style={styles.advisoryText}>
            Using your real email makes it easier to confirm
            your account and recover access if you forget your
            password. Mobile and username still work across all
            BUKLOD apps.
          </Text>
        </View>

        <View
          style={
            styles.loginChoices
          }
        >
          {(
            [
              [
                'mobile',
                'Mobile',
              ],
              [
                'username',
                'Username',
              ],
              ['email', 'Email'],
            ] as const
          ).map(
            ([
              method,
              label,
            ]) => (
              <Pressable
                key={method}
                onPress={() =>
                  chooseLoginMethod(
                    method
                  )
                }
                style={[
                  styles.loginChoice,
                  loginMethod ===
                    method &&
                    styles.loginChoiceOn,
                ]}
              >
                <Text
                  style={
                    loginMethod ===
                    method
                      ? styles.loginChoiceTextOn
                      : styles.loginChoiceText
                  }
                >
                  {label}
                </Text>
              </Pressable>
            )
          )}
        </View>

        <Text
          style={
            styles.fieldTitle
          }
        >
          {loginMethodLabel}
        </Text>

        <Text style={styles.help}>
          {loginHelp}
        </Text>

        <TextInput
          style={styles.input}
          placeholder={
            loginPlaceholder
          }
          value={loginIdentifier}
          onChangeText={
            setLoginIdentifier
          }
          keyboardType={
            loginMethod ===
            'mobile'
              ? 'phone-pad'
              : loginMethod ===
                'email'
              ? 'email-address'
              : 'default'
          }
          autoCapitalize="none"
          autoCorrect={false}
        />

        {loginMethod !==
          'mobile' && (
          <>
            <Text
              style={
                styles.fieldTitle
              }
            >
              Contact Mobile
            </Text>

            <Text
              style={
                styles.help
              }
            >
              Optional. This is saved to your member profile but is not your login.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="09171234567 (optional)"
              value={contactMobile}
              onChangeText={
                setContactMobile
              }
              keyboardType="phone-pad"
            />
          </>
        )}

        <Text
          style={
            styles.fieldTitle
          }
        >
          Birth Date
        </Text>

        <Text style={styles.help}>
          Optional. Use YYYY-MM-DD.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="1990-06-12"
          value={birthDate}
          onChangeText={setBirthDate}
        />

        <Text
          style={
            styles.fieldTitle
          }
        >
          Sex
        </Text>

        <Text style={styles.help}>
          Optional.
        </Text>

        <View style={styles.chips}>
          {(
            [
              'male',
              'female',
            ] as const
          ).map((value) => (
            <Pressable
              key={value}
              onPress={() =>
                setSex(value)
              }
              style={[
                styles.chip,
                sex === value &&
                  styles.chipOn,
              ]}
            >
              <Text
                style={
                  sex === value
                    ? styles.chipTextOn
                    : styles.chipText
                }
              >
                {value === 'male'
                  ? 'Male'
                  : 'Female'}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>
          CREATE PASSWORD *
        </Text>

        <Text style={styles.help}>
          At least 6 characters. No OTP, SMS, or email confirmation.
        </Text>

        <View
          style={
            styles.passwordRow
          }
        >
          <TextInput
            style={
              styles.passwordInput
            }
            placeholder="Create your password"
            secureTextEntry={
              !showPassword
            }
            value={password}
            onChangeText={
              setPassword
            }
          />

          <Pressable
            style={
              styles.eyeButton
            }
            onPress={() =>
              setShowPassword(
                (value) => !value
              )
            }
          >
            <Ionicons
              name={
                showPassword
                  ? 'eye-off-outline'
                  : 'eye-outline'
              }
              size={22}
              color="#50606b"
            />
          </Pressable>
        </View>

        <Text style={styles.fieldTitle}>
          Referred by (optional)
        </Text>

        <Text style={styles.help}>
          Type a friend&apos;s BUKLOD account name or invite code. Matching accounts appear as you type.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Account name or invite code"
          value={referralQuery}
          onChangeText={onReferralQueryChange}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {referralStatus === 'checking' ? (
          <Text style={styles.referralHint}>
            Checking BUKLOD accounts...
          </Text>
        ) : null}

        {referralStatus === 'matched' ? (
          <Text style={styles.referralMatched}>
            Matched: {referralMatchLabel}
          </Text>
        ) : null}

        {referralStatus === 'missing' ? (
          <Text style={styles.referralMissing}>
            No matching BUKLOD account found. Check the account name or invite code.
          </Text>
        ) : null}

        {referralSuggestions.length > 0 ? (
          <View style={styles.referralSuggestBox}>
            {referralSuggestions.map((item) => {
              const key = `${item.referral_code}:${item.username || item.label}`;
              const title = item.username
                ? `@${item.username}`
                : item.label;
              return (
                <Pressable
                  key={key}
                  style={styles.referralSuggestRow}
                  onPress={() => applyReferralSelection(item)}
                >
                  <Text style={styles.referralSuggestTitle}>
                    {title}
                  </Text>
                  <Text style={styles.referralSuggestMeta}>
                    Invite code {item.referral_code}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {/* PATCH_164A_REG2_PRIVATE_ADDRESS */}

        <Text style={styles.label}>
          YOUR HOME ADDRESS
        </Text>

        <Text style={styles.help}>
          Required for automatic BUKLOD Local assignment. Your geographic location information is private and will not be shown publicly.
        </Text>

        <Text style={styles.fieldTitle}>
          Barangay *
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Barangay"
          value={barangay}
          onChangeText={setBarangay}
          autoCapitalize="words"
        />

        <Text style={styles.fieldTitle}>
          Town / City *
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Municipality or City"
          value={cityMunicipality}
          onChangeText={
            setCityMunicipality
          }
          autoCapitalize="words"
        />

        <Text style={styles.fieldTitle}>
          Province *
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Province"
          value={province}
          onChangeText={setProvince}
          autoCapitalize="words"
        />

        <Text style={styles.fieldTitle}>
          Country *
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Country"
          value={country}
          onChangeText={setCountry}
          autoCapitalize="words"
        />



        {/* PATCH_167D8_COMPACT_FAITH_IDENTITY */}
        <Text style={styles.label}>
          FAITH CONTENT
        </Text>

        <Text style={styles.compactFaithHelp}>
          Editable in My Account
        </Text>

        <View style={styles.faithIdentityList}>
          {(
            [
              [
                'CHRISTIAN',
                'Christian',
                'Faith Content ON automatically',
              ],
              [
                'NON_CHRISTIAN',
                'Non Christian',
                'Faith Content OFF',
              ],
              [
                'PREFER_NOT_TO_SAY',
                'I Prefer Not to Say',
                'Faith Content OFF',
              ],
            ] as const
          ).map(([value, label, note]) => {
            const selected =
              faithIdentity === value;

            return (
              <Pressable
                key={value}
                onPress={() => {
                  setFaithIdentity(value);

                  setShowFaithContent(
                    value === 'CHRISTIAN'
                  );
                }}
                style={[
                  styles.faithIdentityOption,
                  selected &&
                    styles.faithIdentityOptionOn,
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={
                      styles.faithIdentityName
                    }
                  >
                    {label}
                  </Text>

                  <Text
                    style={
                      styles.faithIdentityNote
                    }
                  >
                    {note}
                    {value === 'CHRISTIAN'
                      ? ' · Fixed'
                      : ''}
                  </Text>
                </View>

                <Text
                  style={
                    selected
                      ? styles.faithIdentitySelected
                      : styles.faithIdentityUnselected
                  }
                >
                  {selected
                    ? 'SELECTED'
                    : 'SELECT'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <BuklodActionFeedback status={feedback.status} message={feedback.message} />
        {created ? (
          <Pressable accessibilityRole="button" style={styles.primary} onPress={() => router.replace('/(tabs)/home')}>
            <Text style={styles.primaryText}>OPEN PUBLIC HOME</Text>
          </Pressable>
        ) : (
          <Pressable accessibilityRole="button" style={[styles.primary, busy && { opacity: 0.65 }]} onPress={createAccount} disabled={busy}>
            {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
            <Text style={styles.primaryText}>{busy ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}</Text>
          </Pressable>
        )}

        <Pressable
          style={
            styles.secondary
          }
          onPress={() =>
            router.back()
          }
          disabled={busy}
        >
          <Text
            style={
              styles.secondaryText
            }
          >
            BACK TO LOGIN
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/privacy' as any)}
          disabled={busy}
          accessibilityRole="link"
          accessibilityLabel="BUKLOD Privacy Policy"
          style={{ alignSelf: 'center', paddingVertical: 12 }}
        >
          <Text
            style={{
              color: colors.greenDark,
              fontSize: 13,
              fontWeight: '800',
              textDecorationLine: 'underline',
            }}
          >
            Privacy Policy
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/delete-account' as any)}
          disabled={busy}
          accessibilityRole="link"
          accessibilityLabel="BUKLOD account deletion"
          style={{ alignSelf: 'center', paddingBottom: 24 }}
        >
          <Text
            style={{
              color: colors.greenDark,
              fontSize: 13,
              fontWeight: '800',
              textDecorationLine: 'underline',
            }}
          >
            Delete Account
          </Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={churchDrawerOpen}
        transparent
        animationType="slide"
        onRequestClose={() =>
          setChurchDrawerOpen(false)
        }
      >
        <View style={styles.drawerOverlay}>
          <Pressable
            style={styles.drawerDismiss}
            onPress={() =>
              setChurchDrawerOpen(false)
            }
          />

          <View style={[styles.drawer, { paddingBottom: drawerBottomInset + 12 }]}>
            <View style={styles.drawerHandle} />

            <View style={styles.drawerHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.drawerTitle}>
                  Select Your Local
                </Text>
                <Text style={styles.help}>
                  Search by Local Church name or code.
                </Text>
              </View>

              <Pressable
                onPress={() =>
                  setChurchDrawerOpen(false)
                }
                style={styles.closeButton}
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={colors.text}
                />
              </Pressable>
            </View>

            <View style={styles.searchRow}>
              <Ionicons
                name="search-outline"
                size={19}
                color={colors.muted}
              />

              <TextInput
                style={styles.searchInput}
                placeholder="Search Local Church..."
                value={churchSearch}
                onChangeText={setChurchSearch}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.drawerList}
            >
              {filteredChurches.map(
                (church) => {
                  const selected =
                    church.id ===
                    churchId;

                  return (
                    <Pressable
                      key={church.id}
                      onPress={() =>
                        selectChurch(
                          church
                        )
                      }
                      style={[
                        styles.drawerItem,
                        selected &&
                          styles.drawerItemOn,
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.drawerItemName}>
                          {church.name}
                        </Text>

                        {!!church.code && (
                          <Text style={styles.drawerItemCode}>
                            {church.code}
                          </Text>
                        )}
                      </View>

                      {selected && (
                        <Ionicons
                          name="checkmark-circle"
                          size={22}
                          color={colors.green}
                        />
                      )}
                    </Pressable>
                  );
                }
              )}

              {!filteredChurches.length && (
                <View style={styles.emptySearch}>
                  <Text style={styles.help}>
                    No Local Church matched your search.
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles =
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor:
        colors.background,
    },
    content: {
      padding: 16,
      paddingBottom: 24,
      gap: 5,
    },
    logo: {
      width: 78,
      height: 78,
      borderRadius: 39,
    },
    title: {
      fontSize: 25,
      fontWeight: '900',
      color: colors.greenDark,
      marginTop: 4,
      textAlign: 'center',
    },
    subtitle: {
      color: colors.muted,
      textAlign: 'center',
      lineHeight: 19,
    },
    label: {
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 0.5,
      color: colors.muted,
      marginTop: 7,
    },
    fieldTitle: {
      fontWeight: '900',
      color: colors.text,
      marginTop: 1,
    },
    help: {
      fontSize: 12,
      color: colors.muted,
      lineHeight: 16,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 12,
      padding: 10,
      backgroundColor:
        colors.white,
    },
    referralHint: {
      fontSize: 12,
      color: colors.muted,
      marginTop: -2,
    },
    referralMatched: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.greenDark,
      marginTop: -2,
    },
    referralMissing: {
      fontSize: 12,
      fontWeight: '700',
      color: '#9A3412',
      marginTop: -2,
    },
    referralSuggestBox: {
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 12,
      backgroundColor: colors.white,
      overflow: 'hidden',
      marginTop: -4,
    },
    referralSuggestRow: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
      gap: 2,
    },
    referralSuggestTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.text,
    },
    referralSuggestMeta: {
      fontSize: 11,
      color: colors.muted,
    },
    loginChoices: {
      flexDirection: 'row',
      gap: 5,
    },
    advisoryCard: {
      marginBottom: 10,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.green,
      backgroundColor: colors.greenSoft,
    },
    advisoryTitle: {
      fontSize: 11,
      fontWeight: '900',
      color: colors.greenDark,
      marginBottom: 4,
    },
    advisoryText: {
      fontSize: 10.5,
      lineHeight: 16,
      color: colors.text,
    },
    loginChoice: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 12,
      paddingVertical: 8,
      paddingHorizontal: 6,
      alignItems: 'center',
      backgroundColor:
        colors.white,
    },
    loginChoiceOn: {
      borderColor: colors.green,
      backgroundColor:
        colors.greenSoft,
    },
    loginChoiceText: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.text,
    },
    loginChoiceTextOn: {
      fontSize: 11,
      fontWeight: '900',
      color: colors.greenDark,
    },
    passwordRow: {
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 12,
      backgroundColor:
        colors.white,
      flexDirection: 'row',
      alignItems: 'center',
    },
    passwordInput: {
      flex: 1,
      padding: 10,
    },
    eyeButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    chips: {
      flexDirection: 'row',
      gap: 5,
    },
    chip: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor:
        colors.white,
    },
    chipOn: {
      backgroundColor:
        colors.greenSoft,
      borderColor: colors.green,
    },
    chipText: {
      color: colors.text,
    },
    chipTextOn: {
      color: colors.greenDark,
      fontWeight: '800',
    },
    selector: {
      minHeight: 62,
      padding: 13,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 12,
      backgroundColor: colors.white,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    selectorOn: {
      borderColor: colors.green,
      backgroundColor: colors.greenSoft,
    },
    selectorLabel: {
      fontSize: 9,
      fontWeight: '900',
      color: colors.muted,
      letterSpacing: 0.6,
    },
    selectorValue: {
      marginTop: 3,
      fontSize: 15,
      fontWeight: '900',
      color: colors.greenDark,
    },
    selectorPlaceholder: {
      marginTop: 3,
      fontSize: 14,
      color: colors.muted,
    },
    groupList: {
      gap: 5,
    },
    groupOption: {
      padding: 9,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 12,
      backgroundColor:
        colors.white,
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',
      gap: 10,
    },
    groupOptionOn: {
      borderColor: colors.green,
      backgroundColor:
        colors.greenSoft,
    },
    groupName: {
      fontWeight: '800',
      color: colors.text,
      flex: 1,
    },
    groupCode: {
      marginTop: 3,
      fontSize: 11,
      color: colors.muted,
    },
    selectedMark: {
      fontSize: 10,
      fontWeight: '900',
      color: colors.greenDark,
    },
    unselectedMark: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.muted,
    },
    loadingBox: {
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor:
        colors.white,
      gap: 7,
      alignItems: 'center',
    },
    firstBox: {
      padding: 13,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: '#FFF8E8',
    },
    firstTitle: {
      fontWeight: '900',
      color: '#775A11',
      marginBottom: 5,
    },
    proposeButton: {
      marginTop: 10,
      padding: 11,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.green,
      alignItems: 'center',
      backgroundColor:
        colors.white,
    },
    proposeButtonOn: {
      backgroundColor:
        colors.greenSoft,
    },
    proposeText: {
      color: colors.greenDark,
      fontSize: 11,
      fontWeight: '900',
    },
    notice: {
      padding: 9,
      borderRadius: 12,
      backgroundColor: '#FFF8E8',
    },
    noticeText: {
      fontSize: 12,
      color: '#775A11',
      lineHeight: 18,
    },
    primary: {
      backgroundColor:
        colors.green,
      padding: 12,
      borderRadius: 12,
      alignItems: 'center',
      marginTop: 5,
    },
    primaryText: {
      color: colors.white,
      fontWeight: '900',
    },
    secondary: {
      borderColor: colors.green,
      borderWidth: 1,
      padding: 11,
      borderRadius: 12,
      alignItems: 'center',
    },
    secondaryText: {
      color: colors.green,
      fontWeight: '800',
    },
    drawerOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    drawerDismiss: {
      flex: 1,
    },
    drawer: {
      maxHeight: '78%',
      minHeight: '55%',
      paddingHorizontal: 18,
      paddingTop: 9,
      paddingBottom: 24,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      backgroundColor: colors.background,
    },
    drawerHandle: {
      width: 42,
      height: 5,
      borderRadius: 999,
      alignSelf: 'center',
      marginBottom: 12,
      backgroundColor: colors.line,
    },
    drawerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 12,
    },
    drawerTitle: {
      fontSize: 21,
      fontWeight: '900',
      color: colors.text,
    },
    closeButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.white,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 12,
      paddingHorizontal: 12,
      backgroundColor: colors.white,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 12,
    },
    drawerList: {
      paddingTop: 10,
      gap: 7,
      paddingBottom: 20,
    },
    drawerItem: {
      minHeight: 58,
      paddingHorizontal: 13,
      paddingVertical: 11,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.white,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    drawerItemOn: {
      borderColor: colors.green,
      backgroundColor: colors.greenSoft,
    },
    drawerItemName: {
      fontSize: 14,
      fontWeight: '900',
      color: colors.text,
    },
    drawerItemCode: {
      marginTop: 3,
      fontSize: 10,
      color: colors.muted,
    },
    emptySearch: {
      padding: 24,
      alignItems: 'center',
    },
  
    faithIdentityList: {
      gap: 4,
    },

    compactFaithHelp: {
      fontSize: 11,
      lineHeight: 14,
      color: colors.muted,
      marginTop: -2,
    },

    faithIdentityOption: {
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 10,
      paddingVertical: 7,
      paddingHorizontal: 10,
      backgroundColor: colors.white,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },

    faithIdentityOptionOn: {
      borderColor: colors.green,
      backgroundColor: colors.greenSoft,
    },

    faithIdentityName: {
      fontWeight: '800',
      color: colors.text,
      fontSize: 13,
    },

    faithIdentityNote: {
      marginTop: 1,
      fontSize: 10,
      lineHeight: 13,
      color: colors.muted,
    },

    faithIdentitySelected: {
      fontSize: 9,
      fontWeight: '900',
      color: colors.greenDark,
    },

    faithIdentityUnselected: {
      fontSize: 9,
      fontWeight: '800',
      color: colors.muted,
    },
});







