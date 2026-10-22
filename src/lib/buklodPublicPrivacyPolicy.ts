export const BUKLOD_PRIVACY_POLICY_VERSION = '1.0';
export const BUKLOD_PRIVACY_POLICY_EFFECTIVE_DATE = '28 August 2026';
export const BUKLOD_PRIVACY_POLICY_PUBLIC_URL =
  'https://buklod.expo.app/privacy';

export const BUKLOD_PRIVACY_CONTACT_EMAIL = 'efmagaj@gmail.com';

export const BUKLOD_PRIVACY_CONTROLLER_NAME = 'MZB Ministry Inc.';
export const BUKLOD_PRIVACY_APP_NAME = 'BUKLOD';
export const BUKLOD_PRIVACY_ANDROID_PACKAGE = 'org.mzbministry.buklod';
export const BUKLOD_PRIVACY_DEVELOPER_NAME = 'Faustino Jr. M. Gabut';

export type BuklodPrivacySection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export const buklodPrivacyPolicySections: BuklodPrivacySection[] = [
  {
    heading: '1. Who we are',
    paragraphs: [
      'BUKLOD is a community, discipleship, and church-life application for members of Samahang Binuklod ng Pag-ibig and related ministry communities.',
      'For Google Play and this policy, the app is BUKLOD (Android package org.mzbministry.buklod). The organization identified with the product is MZB Ministry Inc. The in-app developer credit is Faustino Jr. M. Gabut.',
      `Questions about this policy or personal data: ${BUKLOD_PRIVACY_CONTACT_EMAIL}. You may also use in-app Feedback after you sign in.`,
    ],
  },
  {
    heading: '2. Scope of this policy',
    paragraphs: [
      'This page describes personal data the current BUKLOD mobile and web application is built to collect or process. It is based on an audit of the live codebase. It does not claim practices that were not found in that code.',
      'Some features are optional. If you do not use a feature (for example Find a Church, voice/video calls, or advertising), BUKLOD does not need that feature’s extra data from you.',
    ],
  },
  {
    heading: '3. Account and profile information',
    paragraphs: [
      'When you create or use an account, BUKLOD processes identifiers needed to sign you in and show your profile.',
    ],
    bullets: [
      'Login identifier: Philippine mobile number, username, or email, plus a password (authentication is handled by Supabase Auth).',
      'Profile details such as display name, username, photo, and other profile fields you save.',
      'Optional mobile number on the profile even when you log in with username or email.',
      'Membership and role information for Public Community, Organization, Cluster, church, and other workspaces you join.',
      'Optional Recovery PIN and related account-recovery records if you set them up.',
      'Remember-password storage on the device you choose (local secure/device storage).',
    ],
  },
  {
    heading: '4. User-generated posts, comments, and messages',
    paragraphs: [
      'Content you create is stored so the community and your conversations can work.',
    ],
    bullets: [
      'Community posts, comments, reactions, Reels, and similar wall content, including captions you write.',
      'Prayer requests and responses, using the privacy/visibility option you choose for that request.',
      'Devotional reflections and related text, using the privacy option you choose.',
      'Direct Connect / Messages threads stored in BUKLOD’s own message tables (not a separate Stream Chat product).',
      'Status notes, reports, feedback, and support messages you submit.',
    ],
  },
  {
    heading: '5. Photos, videos, and other uploads',
    paragraphs: [
      'If you grant photo/camera permission and upload media, files are stored in BUKLOD cloud storage (Supabase Storage, including the community-media bucket and other feature buckets).',
    ],
    bullets: [
      'Profile photos and community/Reels photos or videos.',
      'Images used as evidence for Daily Bible or similar formation uploads.',
      'Documents or images you attach in formation or organization tools.',
      'Advertising creatives and payment-proof screenshots if you use paid advertising submission.',
    ],
  },
  {
    heading: '6. Location',
    paragraphs: [
      'BUKLOD requests device location only for features that need a map or nearby-church result, and only after the platform permission prompt. The app is not built as always-on background tracking.',
    ],
    bullets: [
      'Approximate or precise coordinates when you use Find a Church / nearby church search.',
      'Map pin coordinates when an authorized user sets a worship or church location.',
      'Coordinates that may be saved on an Organization or church profile when that workflow is used.',
      'Attendance reports can record a “location” check-in method when that method is allowed for an event. That is a check-in method flag plus any location the attendance flow is designed to send—not a separate always-on GPS trail in this client.',
      'Address text may be turned into coordinates using the device geocoder and, if needed, OpenStreetMap Nominatim.',
    ],
  },
  {
    heading: '7. Device, notifications, and identifiers',
    paragraphs: [
      'To deliver the app and alerts, BUKLOD uses device and notification identifiers.',
    ],
    bullets: [
      'Expo push token and platform (for example Android), stored through an authenticated device-token claim so activity alerts can be delivered.',
      'Firebase Cloud Messaging is used with Stream Video so incoming call/push events can reach the device.',
      'App version, runtime, and similar technical data used for updates and diagnostics.',
      'Local caches (for example attendance event lists or session data) on the device.',
    ],
  },
  {
    heading: '8. Advertising (AdMob / Google)',
    paragraphs: [
      'The Android app includes Google Mobile Ads (AdMob) for banner ads on selected screens (for example Home and community feeds). Ads are not shown as a condition of reading this policy page.',
      'Google’s advertising SDK may process advertising identifiers, approximate location, device and app data, and interaction data according to Google’s own policies. BUKLOD configures a PG maximum ad content rating and uses Google’s Ads User Messaging / consent APIs before requesting ads when those APIs apply.',
      'Production builds are configured to use BUKLOD’s own AdMob application and banner units, not Google sample test units.',
    ],
  },
  {
    heading: '9. Voice and video calls',
    paragraphs: [
      'Voice and video calling uses Stream Video (GetStream). When you start or receive a call, Stream processes call signaling and media as needed to connect participants.',
      'BUKLOD obtains a Stream token through a signed-in backend function (stream-token). Camera, microphone, and related permissions are used for calls, Reels, QR, and recordings you choose to make.',
      'Call metadata reasonably necessary to start the call (for example your BUKLOD user id used as the Stream user id) is shared with Stream for that purpose.',
    ],
  },
  {
    heading: '10. Events and attendance',
    paragraphs: [
      'Organization and Cluster operators can create attendance events (title, schedule, location text, allowed check-in methods). Members may check in when the event is open.',
    ],
    bullets: [
      'Event records and check-in records (who, when, method, and related status).',
      'An Attendance QR issued for your BUKLOD account (token plus name/username used to display the card).',
      'Allowed methods in this app include QR, face, device biometric, and manual. This BUKLOD client stores the method selected for the event and check-in results returned by the backend.',
    ],
  },
  {
    heading: '11. Face registration and biometric identity',
    paragraphs: [
      'The Attendance ID screen states that QR is enough, and that face registration and device fingerprint/biometric unlock are optional.',
      'This BUKLOD application repository does not implement storage of face templates, face embeddings, or a face-capture registration pipeline. Device biometric check-in, if used, is treated as an attendance method on the user’s device, not as a biometric gallery uploaded by this client.',
      'If a separate Attendance Checker or later feature captures a face image, that would be additional processing and should be described when that product is published. This policy does not claim that this BUKLOD app currently collects biometric face templates.',
    ],
  },
  {
    heading: '12. Character avatar (not identity biometrics)',
    paragraphs: [
      'BUKLOD includes an optional illustrated character/avatar (body choice and cosmetic items). That is a game-style avatar, not a scan of your real face, and it is separate from your profile photo.',
    ],
  },
  {
    heading: '13. Learning, pastoral care, and ministry records',
    paragraphs: [
      'If you use Daily Bible Reading, Daily Devotion, lessons, or related formation tools, BUKLOD stores submissions, progress, and approval history so learning can stay sequential and verifiable.',
      'Authorized Cluster or Organization leaders may see participation and follow-up records appropriate to their role. Pastoral notes are restricted leadership records. BUKLOD does not compute a holiness or salvation score.',
    ],
  },
  {
    heading: '14. Payments, giving, and rewards',
    paragraphs: [
      'If your Organization uses paid Focus Apps, Cluster Premium, lesson packages, or similar catalog products, BUKLOD stores product, entitlement, and payment records (including amount and status) for that Organization or Cluster.',
      'Church giving tools may store treasurer-configured payment methods such as GCash or bank details for the church, not as a requirement for every member.',
      'Advertising submissions may include a payment reference and proof image.',
      'BUKLOD Points and Bayanihan/earnings ledgers are separate. The product is not built to convert Points into cash.',
    ],
  },
  {
    heading: '15. Why we use this data',
    paragraphs: [
      'BUKLOD uses the data above to operate the service you request: signing you in, showing community and messages, running Organization/Cluster tools, attendance, learning, calls, notifications, ads where enabled, security, abuse review, and records the ministry needs to run those features.',
      'We do not sell your personal information as a product. Sharing with processors (listed below) happens so those features can run.',
    ],
  },
  {
    heading: '16. Third-party services and sharing',
    paragraphs: [
      'BUKLOD shares data with service providers only as needed to host and operate the app. Those providers process data under their own terms as well.',
    ],
    bullets: [
      'Supabase — account authentication, database, file storage, and edge functions (including account deletion and Stream tokens).',
      'Expo — app delivery, Expo Application Services (builds and over-the-air updates), Expo push notifications, and web hosting (including buklod.expo.app).',
      'Google (AdMob / Google Mobile Ads, Ads User Messaging Platform) — advertising on Android.',
      'Google (Maps) — native map used when picking a worship/church location.',
      'Google (Firebase Cloud Messaging) — push delivery used with Stream Video on Android.',
      'Stream (GetStream) — voice and video calling.',
      'OpenStreetMap Nominatim — fallback geocoding when the device geocoder is not enough.',
    ],
  },
  {
    heading: '17. Security and handling',
    paragraphs: [
      'Access to many records is limited by signed-in identity, roles, and database row-level security. Passwords are handled by Supabase Auth rather than stored in app code.',
      'No online service is perfectly secure. Use a strong password. Do not post another person’s private pastoral or contact information.',
      'Authorized administrators may access records needed to operate, moderate, or recover the service.',
    ],
  },
  {
    heading: '18. Retention',
    paragraphs: [
      'Account, community, message, attendance, learning, and payment records are kept while the account and the related ministry records remain active, and as long as needed for security, dispute, or legal recordkeeping.',
      'Device push tokens are updated when you use the app on that device; a token can be claimed by the account currently signed in on that device.',
      'Backups and logs held by processors (Supabase, Expo, Google, Stream) follow those providers’ retention practices.',
    ],
  },
  {
    heading: '19. Account and data deletion',
    paragraphs: [
      'You can delete your account inside BUKLOD: Profile → Delete Account. Type DELETE to confirm. An optional reason may be stored with the request.',
      'A public explanation of this process, including what is removed and what may stay, is at https://buklod.expo.app/delete-account (no login required).',
      'Deletion calls the protected delete-account backend. If it succeeds, your sign-in account and cloud files owned by that account are removed, and related rows follow their cascade, set-null, or blocking rules. Some ministry records may stay with the user id cleared rather than being fully erased. Church giving, education, reports, and similar operational records can block automatic deletion. See the public account-deletion page for the current behavior.',
      `You can also email ${BUKLOD_PRIVACY_CONTACT_EMAIL} to request deletion or related Philippine data-privacy rights (access, correction, objection, or erasure where applicable). If automatic deletion cannot finish, the request can be completed manually through that privacy contact. Only records legitimately required for legal, security, financial, audit, or operational purposes may be retained.`,
      'Deleting the app from your phone does not by itself delete your cloud account. Use Delete Account or email us.',
    ],
  },
  {
    heading: '20. Children',
    paragraphs: [
      `BUKLOD is a church-community app. It is not directed at children in a way that is meant to collect personal data from them independently of a family or church context. If you believe we have data that should not have been collected, contact ${BUKLOD_PRIVACY_CONTACT_EMAIL}.`,
    ],
  },
  {
    heading: '21. Changes',
    paragraphs: [
      'We may update this policy when the product changes. The effective date at the top of this page will change. Material changes may also be shown in-app through BUKLOD’s existing policy-acknowledgement flow.',
    ],
  },
];
