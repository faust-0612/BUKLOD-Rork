export const BUKLOD_COMMUNITY_KINDS = [
  'question',
  'need_advice',
  'challenge',
  'poll',
  'idea',
  'encouragement',
  'help_needed',
  'share_a_win',
  'decision',
  'resource',
  'story',
  'open_discussion',
  'moment',
] as const;

export type BuklodCommunityKind =
  (typeof BUKLOD_COMMUNITY_KINDS)[number];

export const BUKLOD_DUGTONG_TYPES = [
  'advice',
  'experience',
  'alternative',
  'encouragement',
  'question_back',
  'resource',
  'challenge_response',
  'moment',
  'continuation',
] as const;

export type BuklodDugtongType =
  (typeof BUKLOD_DUGTONG_TYPES)[number];

export type BuklodCommunityPrivacy =
  | 'public'
  | 'anonymous';

export type BuklodDugtongPrivacy =
  | 'public'
  | 'anonymous'
  | 'private_poster';

export type BuklodChainStatus =
  | 'open'
  | 'growing'
  | 'resolved';

export const BUKLOD_COMMUNITY_KIND_LABELS:
  Record<BuklodCommunityKind, string> = {
    question: 'Question',
    need_advice: 'Need Advice',
    challenge: 'Challenge',
    poll: 'Poll',
    idea: 'Idea',
    encouragement: 'Encouragement',
    help_needed: 'Help Needed',
    share_a_win: 'Share a Win',
    decision: 'Decision',
    resource: 'Resource',
    story: 'Story',
    open_discussion: 'Open Discussion',
    moment: 'Moment',
  };

export const BUKLOD_DUGTONG_TYPE_LABELS:
  Record<BuklodDugtongType, string> = {
    advice: 'Advice',
    experience: 'Experience',
    alternative: 'Alternative',
    encouragement: 'Encouragement',
    question_back: 'Question back',
    resource: 'Resource',
    challenge_response: 'Challenge response',
    moment: 'Add yours',
    continuation: 'Continue',
  };

export type BuklodPrivacyShieldResult = {
  hardBlock: boolean;
  warnings: string[];
  suggestedText: string;
};

const PHONE_PATTERN =
  /(?<!\d)(?:\+?63|0)?9\d{9}(?!\d)/g;
const EMAIL_PATTERN =
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const ADDRESS_HINT_PATTERN =
  /\b(?:house|unit|lot|block|blk|street|st\.|road|rd\.|purok|sitio)\s*[#:.-]?\s*[A-Z0-9-]{1,12}\b/gi;
const LINK_PATTERN = /https?:\/\/\S+/gi;
const HARD_ABUSE_PATTERN =
  /\b(?:kill\s+yourself|kys|child\s+porn|rape\s+you)\b/gi;

/**
 * Fast local Privacy Shield before publish. This is intentionally conservative:
 * it protects accidental identity exposure and obvious abuse without pretending
 * to replace server moderation or future AI moderation.
 */
export function scanBuklodCommunityPrivacy(
  text: string,
): BuklodPrivacyShieldResult {
  const source = String(text ?? '');
  const warnings: string[] = [];
  let suggestedText = source;

  if (PHONE_PATTERN.test(source)) {
    warnings.push('Possible phone number detected.');
    suggestedText = suggestedText.replace(
      PHONE_PATTERN,
      '[phone hidden]',
    );
  }

  PHONE_PATTERN.lastIndex = 0;

  if (EMAIL_PATTERN.test(source)) {
    warnings.push('Possible email address detected.');
    suggestedText = suggestedText.replace(
      EMAIL_PATTERN,
      '[email hidden]',
    );
  }

  EMAIL_PATTERN.lastIndex = 0;

  if (ADDRESS_HINT_PATTERN.test(source)) {
    warnings.push('Possible exact address detail detected.');
  }

  ADDRESS_HINT_PATTERN.lastIndex = 0;

  const links = source.match(LINK_PATTERN) ?? [];
  if (links.length > 5) {
    warnings.push('Many links detected. This may look like spam.');
  }

  HARD_ABUSE_PATTERN.lastIndex = 0;
  const hardBlock = HARD_ABUSE_PATTERN.test(source);
  HARD_ABUSE_PATTERN.lastIndex = 0;

  if (hardBlock) {
    warnings.push('This text contains content that cannot be posted.');
  }

  return {
    hardBlock,
    warnings,
    suggestedText,
  };
}

export function primaryDugtongLabelForKind(
  kind?: string | null,
): string {
  switch (String(kind ?? '').toLowerCase()) {
    case 'moment':
      return 'Add yours';
    case 'challenge':
      return 'Join / Dugtong';
    case 'question':
    case 'need_advice':
    case 'help_needed':
      return 'Dugtong';
    default:
      return 'Dugtong';
  }
}

export function defaultDugtongTypeForKind(
  kind?: string | null,
): BuklodDugtongType {
  switch (String(kind ?? '').toLowerCase()) {
    case 'moment':
      return 'moment';
    case 'challenge':
      return 'challenge_response';
    case 'question':
    case 'need_advice':
      return 'advice';
    case 'encouragement':
      return 'encouragement';
    default:
      return 'continuation';
  }
}
