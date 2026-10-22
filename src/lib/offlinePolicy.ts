export type BuklodOnlineOnlyFeature =
  | 'ai_grade_scanner'
  | 'live_audio_video_call'
  | 'large_media_upload'
  | 'payment_or_billing'
  | 'role_or_admin_security_change'
  | 'grade_release_or_locked_grade_change'
  | 'account_security_change';

export function internetRequiredMessage(
  feature: BuklodOnlineOnlyFeature,
): string {
  switch (feature) {
    case 'ai_grade_scanner':
      return 'Internet is required for AI grading. Your draft can be kept until connection is available.';
    case 'live_audio_video_call':
      return 'Internet is required for live calls.';
    case 'large_media_upload':
      return 'Internet is required to upload large media. Keep the draft and upload when connected.';
    case 'payment_or_billing':
      return 'Internet is required to verify payment or billing.';
    case 'role_or_admin_security_change':
      return 'Internet is required for role and administrative security changes.';
    case 'grade_release_or_locked_grade_change':
      return 'Internet is required for grade release and locked-grade changes.';
    case 'account_security_change':
      return 'Internet is required for account security changes.';
  }
}

export const BUKLOD_OFFLINE_SAFE_FOUNDATION = {
  cachedRead: true,
  draftEditing: true,
  explicitLowRiskQueue: true,
  serverAuthoritativeConflictProtection: true,
} as const;