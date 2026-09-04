const fs = require('fs');

function need(condition, message) {
  if (!condition) throw new Error(message);
}

// 1) Never amplify a transient auth outage with an automatic retry.
const resiliencePath = 'src/lib/buklodAuthResilience.ts';
let resilience = fs.readFileSync(resiliencePath, 'utf8');

resilience = resilience.replace(
  "const AUTH_TRANSIENT_RETRY_MIN_MS = 700;\nconst AUTH_TRANSIENT_RETRY_JITTER_MS = 350;\n",
  ''
);

const oldWait = `function wait(ms: number) {
  return new Promise<void>(resolve => {
    setTimeout(resolve, ms);
  });
}

`;
need(resilience.includes(oldWait), 'Anchor not found: auth wait helper');
resilience = resilience.replace(oldWait, '');

const oldSignIn = `export async function signInWithPasswordResilient(
  credentials: Parameters<
    typeof supabase.auth.signInWithPassword
  >[0]
) {
  let result =
    await supabase.auth.signInWithPassword(
      credentials
    );

  if (
    result.error &&
    isBuklodTransientAuthError(result.error)
  ) {
    const retryDelay =
      AUTH_TRANSIENT_RETRY_MIN_MS +
      Math.floor(
        Math.random() *
          AUTH_TRANSIENT_RETRY_JITTER_MS
      );

    await wait(retryDelay);

    result =
      await supabase.auth.signInWithPassword(
        credentials
      );
  }

  return result;
}`;

const newSignIn = `export async function signInWithPasswordResilient(
  credentials: Parameters<
    typeof supabase.auth.signInWithPassword
  >[0]
) {
  /*
   * HIGH_CONCURRENCY_LOGIN_R1
   * Never auto-retry a password request after a timeout/5xx/429. During a
   * synchronized login wave, automatic retries amplify overload (N -> 2N).
   * Legacy identifier compatibility remains an explicit caller decision.
   */
  return supabase.auth.signInWithPassword(
    credentials
  );
}`;

need(resilience.includes(oldSignIn), 'Anchor not found: resilient sign-in');
resilience = resilience.replace(oldSignIn, newSignIn);
need(
  (resilience.match(/supabase\.auth\.signInWithPassword\(/g) || []).length === 1,
  'Auth resilience helper must contain exactly one password call'
);
fs.writeFileSync(resiliencePath, resilience);

// 2) Login screen: same-tick single-flight + zero-network Suggested Login save.
const loginPath = 'src/app/(auth)/login.tsx';
let login = fs.readFileSync(loginPath, 'utf8');

const busyAnchor = "  const [busy, setBusy] = useState(false);\n";
need(login.includes(busyAnchor), 'Anchor not found: busy state');
need(!login.includes('HIGH_CONCURRENCY_LOGIN_R1: React state alone'), 'Patch already applied');
login = login.replace(
  busyAnchor,
  busyAnchor +
    '  // HIGH_CONCURRENCY_LOGIN_R1: React state alone cannot stop same-tick double taps.\n' +
    '  const loginInFlightRef = useRef(false);\n'
);

const saveStart = login.indexOf('  const saveSuggestedLogin =\n');
const loginStart = login.indexOf('  async function login(\n', saveStart);
need(saveStart >= 0 && loginStart > saveStart, 'Could not isolate Suggested Login saver');

const newSaver = `  const saveSuggestedLogin =
    async (
      loginIdentifier: string,
      loginPassword: string,
      authenticatedUser: any
    ) => {
      /*
       * HIGH_CONCURRENCY_LOGIN_R1
       * signInWithPassword already returned the authenticated user. Do not
       * call auth.getUser() and profiles again just to paint a local bubble.
       */
      const userId =
        String(authenticatedUser?.id ?? '').trim();

      if (!userId) {
        return;
      }

      const stored =
        parseSuggestedLogins(
          await AsyncStorage.getItem(
            SUGGESTED_LOGINS_KEY
          )
        );

      const existing =
        stored.find(
          item => item.userId === userId
        );

      const metadata =
        authenticatedUser?.user_metadata ?? {};

      const displayName =
        String(
          metadata?.full_name ||
          metadata?.display_name ||
          metadata?.name ||
          metadata?.username ||
          existing?.displayName ||
          loginIdentifier
        ).trim();

      const rawAvatar =
        metadata?.avatar_url ||
        metadata?.picture ||
        existing?.avatarUrl ||
        null;

      const nextItem: SuggestedLogin = {
        userId,
        identifier:
          loginIdentifier.trim(),
        displayName:
          displayName ||
          loginIdentifier.trim(),
        avatarUrl:
          typeof rawAvatar === 'string' &&
          rawAvatar.trim()
            ? rawAvatar.trim()
            : null,
        lastUsedAt:
          new Date().toISOString(),
        hasPassword:
          rememberPassword,
      };

      const next = [
        nextItem,
        ...stored.filter(
          item =>
            item.userId !== userId
        ),
      ].slice(0, 6);

      await AsyncStorage.setItem(
        SUGGESTED_LOGINS_KEY,
        JSON.stringify(next)
      );

      if (rememberPassword) {
        await writeLoginSecret(
          suggestedLoginPasswordKey(
            userId
          ),
          loginPassword
        );
      }
      else {
        await deleteLoginSecret(
          suggestedLoginPasswordKey(
            userId
          )
        );
      }

      setSuggestedLogins(next);
    };
`;

login = login.slice(0, saveStart) + newSaver + login.slice(loginStart);

const updatedLoginStart = login.indexOf('  async function login(\n');
const loginEnd = login.indexOf(
  '  /* PATCH_171K_R3_REMOVED_SECOND_STAGE_EFFECT */',
  updatedLoginStart
);
need(updatedLoginStart >= 0 && loginEnd > updatedLoginStart, 'Could not isolate login function');

let loginFn = login.slice(updatedLoginStart, loginEnd);

// Replace all original busy releases inside login (including reactivation callbacks).
loginFn = loginFn.replace(/setBusy\(false\);/g, 'releaseLogin();');

const startAnchor = '    setBusy(true);\n\n    let error: any = null;';
need(loginFn.includes(startAnchor), 'Anchor not found: login busy/error start');
loginFn = loginFn.replace(
  startAnchor,
  `    if (loginInFlightRef.current) {
      return;
    }

    loginInFlightRef.current = true;
    setBusy(true);

    const releaseLogin = () => {
      loginInFlightRef.current = false;
      setBusy(false);
    };

    let error: any = null;
    let authenticatedUser: any = null;`
);

const errorAssignments = (loginFn.match(/error = result\.error;/g) || []).length;
need(errorAssignments === 3, `Expected 3 login result assignments, found ${errorAssignments}`);
loginFn = loginFn.replace(
  /^(\s*)error = result\.error;$/gm,
  '$1error = result.error;\n$1authenticatedUser =\n$1  result.data?.user ??\n$1  result.data?.session?.user ??\n$1  null;'
);

const oldSaveCall = `    void saveSuggestedLogin(
      raw,
      effectivePassword
    ).catch(error => {`;
need(loginFn.includes(oldSaveCall), 'Anchor not found: saveSuggestedLogin call');
loginFn = loginFn.replace(
  oldSaveCall,
  `    void saveSuggestedLogin(
      raw,
      effectivePassword,
      authenticatedUser
    ).catch(error => {`
);

need(loginFn.includes('if (loginInFlightRef.current)'), 'Single-flight guard missing');
need(loginFn.includes('authenticatedUser'), 'Authenticated user handoff missing');

login = login.slice(0, updatedLoginStart) + loginFn + login.slice(loginEnd);

const saverSection = login.slice(
  login.indexOf('  const saveSuggestedLogin =\n'),
  login.indexOf('  async function login(\n')
);
need(!saverSection.includes('supabase.auth.getUser'), 'Suggested Login saver still calls getUser');
need(!saverSection.includes(".from('profiles')"), 'Suggested Login saver still queries profiles');

fs.writeFileSync(loginPath, login);
