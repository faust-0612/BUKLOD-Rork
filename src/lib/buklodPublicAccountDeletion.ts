import {
  BUKLOD_PRIVACY_ANDROID_PACKAGE,
  BUKLOD_PRIVACY_APP_NAME,
  BUKLOD_PRIVACY_CONTACT_EMAIL,
  BUKLOD_PRIVACY_CONTROLLER_NAME,
  BUKLOD_PRIVACY_DEVELOPER_NAME,
  BUKLOD_PRIVACY_POLICY_PUBLIC_URL,
} from '@/lib/buklodPublicPrivacyPolicy';

export const BUKLOD_DELETE_ACCOUNT_VERSION = '1.0';
export const BUKLOD_DELETE_ACCOUNT_EFFECTIVE_DATE = '28 August 2026';
export const BUKLOD_DELETE_ACCOUNT_PUBLIC_URL =
  'https://buklod.expo.app/delete-account';

export {
  BUKLOD_PRIVACY_ANDROID_PACKAGE,
  BUKLOD_PRIVACY_APP_NAME,
  BUKLOD_PRIVACY_CONTACT_EMAIL,
  BUKLOD_PRIVACY_CONTROLLER_NAME,
  BUKLOD_PRIVACY_DEVELOPER_NAME,
  BUKLOD_PRIVACY_POLICY_PUBLIC_URL,
};

export type BuklodLegalSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

/**
 * Public Google Play account-deletion copy.
 * Grounded in the live delete-account edge function and production
 * foreign-key rules. Do not claim a full wipe or a retention schedule
 * that the product does not implement.
 */
export const buklodAccountDeletionSections: BuklodLegalSection[] = [
  {
    heading: '1. Who this page is for',
    paragraphs: [
      'This page explains how to delete a BUKLOD account. You do not need to sign in to read it.',
      `${BUKLOD_PRIVACY_APP_NAME} is a community, discipleship, and church-life app. Google Play listing identity: app name ${BUKLOD_PRIVACY_APP_NAME}, Android package ${BUKLOD_PRIVACY_ANDROID_PACKAGE}. The organization identified with the product is ${BUKLOD_PRIVACY_CONTROLLER_NAME} The in-app developer credit is ${BUKLOD_PRIVACY_DEVELOPER_NAME}.`,
      `Questions: ${BUKLOD_PRIVACY_CONTACT_EMAIL}.`,
    ],
  },
  {
    heading: '2. How to delete your account in the app',
    paragraphs: [
      'If you can open BUKLOD and sign in, use the in-app path:',
    ],
    bullets: [
      'Open Profile (the Me tab).',
      'Tap Delete Account.',
      'Optionally write a reason.',
      'Type DELETE to confirm, then confirm again.',
    ],
  },
  {
    heading: '3. If you cannot open the app',
    paragraphs: [
      `Email ${BUKLOD_PRIVACY_CONTACT_EMAIL} from an address we can match to your account when possible. Include your BUKLOD display name, username, mobile number or email used to sign in, and that you are requesting account deletion.`,
      'We use that mailbox for people who lost device access, cannot complete in-app deletion, or need help after an in-app attempt fails. Signed-in users can also submit a privacy request under Profile / Privacy & Data Rights.',
    ],
  },
  {
    heading: '4. What the in-app Delete Account button actually does',
    paragraphs: [
      'The screen calls BUKLOD’s protected delete-account service using your signed-in session. The service is not available without a valid login.',
      'In order, that service:',
    ],
    bullets: [
      'Checks that you typed DELETE.',
      'Records a deletion request for your account.',
      'Looks up cloud files listed as owned by your account and removes those files. If that cleanup fails, your sign-in account is not deleted.',
      'Then asks the authentication service to permanently delete your sign-in account. The app does not force-delete around database rules.',
      'If that last step succeeds, the app signs you out.',
    ],
  },
  {
    heading: '5. What is removed when deletion completes',
    paragraphs: [
      'If the sign-in account is successfully deleted, BUKLOD is built to remove:',
    ],
    bullets: [
      'Your BUKLOD sign-in account.',
      'Cloud files the deletion service found as owned by that account (photos, videos, and other uploads in that owned-file list).',
      'Your profile record, which is configured to go away with the sign-in account.',
      'Rows that are configured to be deleted with your profile or sign-in id. That includes your BUKLOD Points ledger rows, your Bayanihan / earnings ledger rows, and Connect messages you sent, according to current production rules.',
    ],
  },
  {
    heading: '6. What may stay, and why',
    paragraphs: [
      'Deletion is not a claim that every related record everywhere is erased. The current backend follows each table’s existing database rule. We do not invent a separate wipe of ministry ledgers, backups, or third-party copies.',
    ],
    bullets: [
      'Some ministry records stay in place with your user id cleared (set to empty) instead of deleting the whole row. Examples include approvals, notices, or similar actor fields other people still need to see as a record of work done.',
      'Church giving, tithe, payment, education / classroom, official report, organization-access, formation, mentoring, and some admin-audit records are configured so they can block automatic deletion. If those records exist for you, the sign-in account may remain until the request is completed manually through the privacy contact.',
      'Related attendance tables exist in production, including face-template tables used by independent attendance tools. The current BUKLOD mobile app is not built to enroll face templates. If such a record still points at a sign-in id without a “clear on delete” rule, that can also stop automatic deletion.',
      'The deletion service does not call separate erase APIs for Expo push, Stream voice/video, Google ads, maps, or Firebase messaging. Copies those providers already hold follow their own backup and retention practices, including hosting backups.',
      'Only records legitimately required for legal, security, financial, audit, or operational purposes may be retained.',
      'Uninstalling the app from a phone does not delete the cloud account.',
    ],
  },
  {
    heading: '7. If in-app deletion does not finish',
    paragraphs: [
      'If automatic deletion cannot finish, you may see an error and remain signed in. That usually means a database relationship or server rule blocked the last step. Storage cleanup may already have run before that block.',
      `The request can be completed manually through the privacy contact ${BUKLOD_PRIVACY_CONTACT_EMAIL}. Include your BUKLOD display name, username, mobile number or email used to sign in, and that you are requesting account deletion.`,
      'A deletion request is stored with a unique rule per account. If an earlier attempt recorded a request but the sign-in account was not deleted, a second in-app attempt may fail until the request is completed manually. Do not assume a failed attempt already removed your account.',
      'Deactivate Account is different. It turns the profile inactive. It is not deletion.',
    ],
  },
  {
    heading: '8. Privacy Policy',
    paragraphs: [
      `How BUKLOD handles personal data is described in the public Privacy Policy: ${BUKLOD_PRIVACY_POLICY_PUBLIC_URL}`,
    ],
  },
];
