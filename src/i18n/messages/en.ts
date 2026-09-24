export const enMessages = {
  common: {
    back: 'Back',
    retry: 'Try again',
    loading: 'Loading…',
    save: 'Save',
    saved: 'Saved.',
    submitted: 'Submitted successfully.',
    failed: "We couldn't complete this action.",
    processing: 'Processing…',
    nextStep: 'Next step',
    checkConnection: 'Check connection',
    cancel: 'Cancel',
    open: 'Open',
    notAvailable: 'Not available',
  },
  auth: {
    checkingAccount: 'Checking your BUKLOD account…',
    signingIn: 'Signing you in…',
    signedIn: 'Signed in successfully. Opening Community Wall…',
    invalidCredentials:
      'The username, email, mobile number, or password is incorrect.',
    invalidCredentialsNext:
      'Check the details, try again, or recover your account.',
    trafficBusy:
      'Many users are signing in right now. Please wait briefly before trying again.',
    requestStillActive:
      'A sign-in request is already being processed. Please wait for it to finish.',
    temporaryFailure:
      "BUKLOD couldn't finish this sign-in request. Please try again.",
    accountStatusFailed:
      'Your password was accepted, but BUKLOD could not safely finish the account-status check.',
    inactive: 'Your account is currently inactive.',
    restricted: 'Your account is temporarily restricted.',
    verificationRequired:
      'Your account needs verification before you can continue.',
    sessionExpired:
      "Your session expired. We're refreshing it.",
  },
  recovery: {
    checkingService: 'Checking account recovery service…',
    checkingAccount: 'Checking your account…',
    sendingCode: 'Sending your verification code…',
    codeSent:
      'Verification sent. Enter the code to continue.',
    codeInvalid: 'The verification code is incorrect.',
    codeExpired:
      'This verification code has expired. Request a new one.',
    tooManyAttempts:
      'Too many attempts. Please wait before trying again.',
    detailsMismatch:
      'The information entered does not match our records.',
    unavailable:
      "We couldn't complete recovery right now.",
    updatingPassword: 'Updating password…',
    passwordUpdated: 'Password updated successfully.',
    passwordUpdatedNext:
      'You can now sign in using your new password.',
    pinStatusFailed:
      "BUKLOD couldn't load your Recovery PIN status.",
    pinSaved: 'Recovery PIN saved successfully.',
  },
  network: {
    offline: 'You appear to be offline.',
    unstable:
      'Your connection is unstable. Some actions may take longer.',
    restored: 'Connection restored.',
    timeout:
      "We're having trouble connecting. Your information is safe.",
  },
  feedback: {
    supportCode: 'Support code',
    unknownTitle: "We couldn't complete this action",
    unknownBody: 'Please try again.',
    rawErrorHidden:
      'Technical details were saved for support without exposing them here.',
  },
  language: {
    title: 'Language',
    open: 'Language',
    subtitle: 'Choose the language you want to use in BUKLOD.',
    current: 'Current',
    choose: 'Choose your language',
    search: 'Search language…',
    apply: 'Apply language',
    useDevice: 'Use Device Language',
    device: 'Device language',
    additionalPending:
      'Additional language packs are hidden until their app-wide translation coverage and financial terminology validation are release-ready.',
    synced:
      'Your language preference is stored on this device and, when signed in, synced to your BUKLOD profile.',
  },
  support: {
    title: 'Help & Support',
    needHelp: 'Need Help?',
    subtitle: 'BUKLOD checks safe diagnostics first, tries approved recovery, and creates a support case only when the issue is still unresolved.',
    prelogin: 'Help works even when you cannot sign in.',
    chooseIssue: 'What do you need help with?',
    identifier: 'Username, email, or mobile number',
    identifierHint: 'Use only an account identifier. Never enter your password, PIN, OTP, security answer, or payment credentials.',
    details: 'What happened? (optional)',
    checkFix: 'CHECK & FIX',
    checking: 'CHECKING…',
    fixed: 'Your issue was fixed. Please try again.',
    caseCreated: 'Support case created',
    knownIncident: 'Known incident',
    noDuplicate: 'BUKLOD already knows about this issue. You are linked for updates; you do not need to create another report.',
    openRecovery: 'OPEN PASSWORD RECOVERY',
    myCases: 'My Support Cases',
    refreshCases: 'Refresh status',
    noCases: 'No support cases on this device or account.',
    creationFailed: 'Support case was not created. BUKLOD Help could not complete the request. Please try again.',
    statusOpen: 'Open',
    statusWaiting: 'Waiting for You',
    statusReview: 'Being Reviewed',
    statusResolved: 'Resolved',
    category: {
      signIn: "I can't sign in",
      forgotPassword: 'I forgot my password',
      accountLocked: 'My account is locked',
      recoveryCode: 'Recovery code problem',
      appNotResponding: 'App does not respond',
      otherAccount: 'Other account problem',
      quiz: 'Quiz',
      classroom: 'Classroom',
      organization: 'Organization / Cluster / Sub-Org',
      reportedContent: 'Report content / moderation',
      technical: 'Technical problem',
      financial: 'Financial inquiry',
      other: 'Other problem',
    },
  },
  economy: {
    guideTitle: 'BUKLOD Economy & Bayanihan',
    guideSubtitle: 'Earnings • Referral • Livelihood • Community Fund',
    guideTagline: 'Use. Contribute. Earn. Grow the Community.',
    mySummary: 'My Economy Summary',
    profileGuideSubtitle:
      'Understand Points, earnings, referrals and the Community Fund',
    overviewNotice:
      'All figures marked as estimates may change. Actual earnings depend on finalized platform revenue, qualified activity, total qualified points, referral status and applicable rules.',
    pointsNotMoney: 'Points are not money',
    pointsNotMoneyBody:
      'BUKLOD Points measure participation, progression and distribution weight. They never create cash and there is no permanent fixed peso value per Point.',
    loading: 'Loading your BUKLOD Economy…',
    unavailable: 'Economy summary unavailable',
    actualBackendOnly:
      'This screen displays backend financial state only. No authoritative money is calculated in the app.',
    estimate: 'ESTIMATE',
    pending: 'PENDING',
    qualifying: 'QUALIFYING',
    finalized: 'FINALIZED',
    withdrawable: 'WITHDRAWABLE',
    paid: 'PAID',
    progressTitle: 'Personal Progress',
    lifetimePoints: 'Lifetime Points',
    qualifiedMonthlyPoints: 'Qualified Monthly Points',
    totalQualifiedMonthlyPoints: 'Total Qualified Monthly Points',
    progressNote:
      'Lifetime Points support progression. Qualified Monthly Points are monthly distribution weights only.',
    earningsTitle: 'Personal Earnings',
    estimatedPoolShare: 'Estimated Pool Share',
    estimatedUserPool: 'Estimated User Pool',
    estimatedEarnings: 'Estimated Earnings',
    finalizedEarnings: 'Finalized Earnings',
    withdrawableBalance: 'Withdrawable Balance',
    reservedBalance: 'Reserved for Withdrawal',
    paidEarnings: 'Paid Earnings',
    userPoolActive: '30% User Pool eligibility is active',
    userPoolInactive: '30% User Pool eligibility is not active yet',
    earningsNote:
      'Estimated may change before settlement. Finalized means settlement has completed. Withdrawable means finalized cash is available for payout subject to withdrawal rules.',
    referralTitle: 'Referral / Sharing',
    referralCode: 'Referral Code',
    totalReferrals: 'Total Referrals',
    qualifiedReferrals: 'Qualified Referrals',
    oneTimeReward: 'One-time qualified referral reward',
    firstLineShare: 'First-line referral share',
    firstLineOnly:
      'First-line only. No second-level, third-level or downline commission.',
    referralNote:
      'Normal sharing does not automatically earn cash. A valid referral requires attribution and qualification.',
    communityTitle: 'My Bayanihan Community',
    noCommunity:
      'No active Community Contribution Destination is selected.',
    communityNotPersonal:
      'Community Fund is separate from personal earnings and cannot be personally withdrawn merely because you are a member or admin.',
    selectedCommunity: 'Selected Community',
    communityRate: 'Current Community Rate',
    activeContributors: 'Active Designated Contributors',
    organizationThreshold: 'Organization 7% Threshold',
    availableFund: 'Available Community Fund',
    reservedFund: 'Reserved Community Fund',
    spentFund: 'Released / Spent Fund',
    destinationLock: 'Destination locked until',
    openGuide: 'BUKLOD ECONOMY & BAYANIHAN',
    openPayout: 'Payout Profile',
    openHistory: 'Withdrawal History',
    guideLanguage: 'Language',
    safetyNotice:
      'BUKLOD does not promise fixed income. Actual earnings and Community Fund allocations depend on genuine usage, finalized eligible platform revenue, qualification, applicable rules and settlement.',
    antiFraud:
      'Duplicate or fake accounts, artificial activity, fake referrals and invalid traffic may be excluded from qualification and earnings.',
    guide: {
      stickySummary: 'MY ECONOMY SUMMARY',
      overview: 'Overview',
      points: 'My Points',
      earnings: 'My Earnings',
      qualification: 'Qualification',
      referral: 'Referral',
      sharing: 'Sharing',
      livelihood: 'Livelihood',
      bayanihan: 'Bayanihan Fund',
      clusterOrg: 'Cluster / Organization',
      suborg: 'Sub-Organization',
      fundRequests: 'Fund Requests',
      estimator: 'Economy Estimator',
      faq: 'FAQ',
      sectionOverviewTitle: 'How the BUKLOD Economy is organized',
      sectionOverviewBody:
        'BUKLOD keeps four connected but separate areas: Personal Progress, Personal Earnings, Referral / Sharing and the Community Bayanihan Fund.',
      sectionOverviewBody2:
        'Real money must come from genuine finalized platform revenue first. Points and activity do not manufacture money.',
      pointsTitle: 'What are Points?',
      pointsLifetimeTitle: 'Lifetime Points',
      pointsLifetimeBody:
        'Used for Circle Rank, Character progression, badges, achievements, collectibles, reputation and future unlocks. They do not reset monthly.',
      pointsMonthlyTitle: 'Qualified Monthly Points',
      pointsMonthlyBody:
        'Used only to determine a qualified user’s relative share of the monthly 30% User Revenue Pool.',
      pointsFormula:
        'Finalized Revenue → 30% User Pool → Qualified Points determine each user’s percentage → Finalized Cash Earnings.',
      pointsExample:
        'Planning example: if total qualified monthly points are 1,000,000 and yours are 10,000, your weight is 1%. If the finalized User Pool is ₱30,000, that illustrative share is ₱300. The next month can be different.',
      earningsTitle: 'How do personal earnings work?',
      earningsBody:
        'Qualified users participate in one monthly 30% User Revenue Pool. This does not mean 30% of every ad seen by one user.',
      earningsBody2:
        'A portion of eligible finalized BUKLOD platform revenue enters the User Pool, and Qualified Monthly Points determine the relative distribution.',
      earningsStates:
        'Keep three states separate: Estimated Earnings may change; Finalized Earnings have completed settlement; Withdrawable Balance is finalized cash available for payout subject to rules.',
      baselineTitle: 'Planning example only',
      baselineBody:
        'Current planning baseline uses approximately ₱39/month eligible platform revenue associated with a regular active user. This is not guaranteed income and must not be presented as “every user earns ₱11.70.”',
      qualificationTitle: 'When does my 30% User Pool eligibility start?',
      qualificationReferred:
        'With a valid referrer: the referred user completes referral qualification first. The current configurable working target is approximately ₱40 qualifying platform revenue/activity value.',
      qualificationNoRef:
        'Without a referrer: the current configurable standard qualification target is approximately ₱60.',
      qualificationAfter:
        'After qualification, normal User Pool eligibility activates. For a valid referred user, the one-time referral reward and original first-line six-month share period may also activate.',
      accelerated:
        'Use “Accelerated Qualification With Referral” versus “Standard Qualification Without Referral.” It is not a penalty.',
      referralTitle: 'How does Referral work?',
      referralBody:
        'A genuine first-line referral may create one ₱20 one-time referral reward, but only after the referred person qualifies.',
      referralPending:
        'Initial state: ₱20 Pending. After qualification: ₱20 Withdrawable, subject to payout rules.',
      referralAntiReset:
        'One unique referred person can generate the one-time reward only once. Reinstalling, deleting/recreating an account, changing username or changing device does not restart eligibility.',
      referralFirstLine:
        'After qualification, the original first-line referrer may receive a 10% first-line share for the original six-month period only. There is no second-level, third-level, downline or multi-level commission.',
      referralEstimate:
        'Illustrative estimate only: using a ₱39 planning baseline, 10% is about ₱3.90/month for up to six months, or about ₱23.40 recurring. Together with a qualified ₱20 one-time reward, the illustrative six-month potential is about ₱43.40. This is not guaranteed.',
      sharingTitle: 'Sharing vs Referral',
      sharingBody:
        'Sharing a post, community activity, app link or Organization page does not automatically create cash earnings.',
      sharingReferral:
        'Referral requires valid attribution: Share Referral Link / Code → New User opens/signs up → Attribution is recorded → Qualification completes → Referral reward becomes eligible.',
      sharingCorrect:
        'Correct wording: “Earn a ₱20 one-time referral reward when your valid referred user completes qualification.” Never advertise “Every share earns ₱20.”',
      livelihoodTitle: 'Can BUKLOD be supplementary livelihood?',
      livelihoodBody:
        'BUKLOD may provide supplementary earning opportunities through legitimate participation and successful referrals, but it is not guaranteed salary, passive income or daily income.',
      livelihoodSources:
        'Possible personal economic sources are: your share of the 30% User Revenue Pool, qualified ₱20 one-time referral rewards, and 10% first-line referral share for six months. Community Fund is not personal income.',
      livelihoodEstimate:
        'Illustrative mature referral examples at the ₱39 planning baseline: 10 qualified new referrals/month ≈ ₱434/month; 50 ≈ ₱2,170/month; 150 ≈ ₱6,510/month; 300 ≈ ₱13,020/month. ESTIMATE ONLY — NOT GUARANTEED.',
      bayanihanTitle: 'What is the Bayanihan Community Fund?',
      bayanihanBody:
        'It is a separate community allocation for approved community purposes such as projects, emergency assistance, feeding, education, supplies, livelihood/community projects, outreach and approved local needs.',
      bayanihanNot:
        'It is not personal earnings, insurance, personal savings or Admin-owned money.',
      clusterTitle: 'Cluster funding',
      clusterBody:
        'A selected community with 1–29 qualified, active, designated contributors uses a 5% Community Fund allocation for future eligible revenue.',
      organizationTitle: 'Organization funding',
      organizationBody:
        'Structural Organization status and fund rate are separate. The 7% rate requires 30+ qualified, active, designated contributors. An Organization below that threshold may structurally remain an Organization while its future Community Fund rate is 5%.',
      oneDestination:
        'One user may belong to many communities but may have only ONE active Community Contribution Destination at a time. The user counts once only. No double funding and no 5% + 7% stacking.',
      suborgTitle: 'How does a Sub-Organization work?',
      suborgBody:
        'A Sub-Organization is a local operational unit under a valid Parent Organization. A user must first be an active member of the Parent Organization to join or administer its Sub-Organization.',
      suborgFinance:
        'A Sub-Organization does not automatically receive another independent 5%/7% wallet. If the Parent Organization is the selected destination, the allocation goes to the Parent Organization Community Fund.',
      suborgParticipation:
        'Sub-Org members may still use local dashboards for members, activities, announcements, projects, local needs, proposals and liquidation. Local participation is preserved while financial governance stays centralized and transparent.',
      suborgAdmin:
        'A Sub-Org Admin may propose and operate local projects, but may not personally withdraw Parent Fund money, edit the Parent Fund balance, release money independently or change Community Fund percentages.',
      fundRequestTitle: 'How does a Community Fund request move?',
      fundRequestFlow:
        'PROPOSAL → REVIEW → MEMBER VOTING → APPROVAL → SYSTEM RELEASE → PROJECT → REPORT / LIQUIDATION.',
      fundGovernance:
        'Current configurable governance example: minimum quorum 20% of qualified active contributors and 60% YES among valid votes. Admin manages. Members authorize. System releases.',
      fundNoWallet:
        'The Community Fund is not a personal wallet. Organization Admin, Sub-Org Admin and ordinary members cannot withdraw it merely because of their role.',
      transparency:
        'Members should be able to see available fund, pending requests, approved projects, released amounts, completed projects, purpose, transaction history and proof/liquidation. No silent balance editing or hidden withdrawal.',
      estimatorTitle: 'BUKLOD Economy Estimator',
      estimatorLive:
        'Live values below come from your current backend financial summary. They are not recreated from client-side money formulas.',
      planningOnly: 'PLANNING EXAMPLE ONLY',
      liveUnavailable:
        'Live economy data is unavailable. Planning examples are shown only and no numbers are manufactured for your account.',
      estimatorQualifiedPoints: 'Your Qualified Monthly Points',
      estimatorPoolShare: 'Estimated User Pool Share %',
      estimatorPersonal: 'Estimated Personal Earnings',
      estimatorReferrals: 'Qualified Referrals',
      estimatorPending: 'Pending Referral Rewards',
      estimatorCommunity: 'Selected Community',
      estimatorRate: 'Current Community Rate',
      estimatorContributors: 'Active Fund Contributors',
      estimatorFund: 'Available Community Fund',
      faq1q: 'Is 1 Point equal to a fixed peso amount?',
      faq1a:
        'No. Money must exist first from eligible finalized platform revenue. Points only determine progression and, when qualified, relative monthly distribution weight.',
      faq2q: 'Does every share earn ₱20?',
      faq2a:
        'No. Only a valid first-line referral that completes qualification can generate the one-time referral reward.',
      faq3q: 'Can I personally withdraw Community Fund money?',
      faq3a:
        'No. Community Fund releases require approved community purposes and the governed release process.',
      faq4q: 'Does changing language change my financial rules?',
      faq4a:
        'No. Language changes presentation text only. Percentages, points, balances, referral relationships, qualification, contributor counts, destinations, settlements and withdrawals do not change.',
      footerSafety:
        'BUKLOD is not promising fixed income. Actual earnings and Community Fund allocations depend on genuine usage, finalized eligible platform revenue, qualification, applicable rules and system settlement.',
      footerPoints:
        'Points measure participation and distribution weight. Points do not create money.',
      footerFraud:
        'Do not create duplicate or fake accounts, artificial activity, fake referrals or invalid traffic. Invalid activity may be excluded from earnings and qualification.',
    },
  },
} as const;
