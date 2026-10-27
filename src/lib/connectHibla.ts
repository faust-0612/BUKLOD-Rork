/** Shared HIBLA design language for Public, Cluster and Org Connect. */
export const HIBLA = {
  pine: '#075B3B',
  pineDeep: '#06472F',
  jade: '#1E9C69',
  paper: '#FAFBF5',
  cream: '#FFF9EA',
  mint: '#ECF7F0',
  gold: '#F2C565',
  ink: '#10281E',
  muted: '#617569',
  outline: '#DDEBE0',
} as const;

export const HIBLA_QUICK_REACTIONS = [
  { emoji: '👍', label: 'Like' },
  { emoji: '❤️', label: 'Heart' },
  { emoji: '😊', label: 'Smile' },
  { emoji: '🙏', label: 'Pray' },
  { emoji: '👏', label: 'Clap' },
  { emoji: '🔥', label: 'Fire' },
] as const;

export const DEFAULT_HIBLA_REACTION = '👍';

export function isHiblaQuickReaction(value: string): boolean {
  return HIBLA_QUICK_REACTIONS.some(reaction => reaction.emoji === value);
}

/** Persist per account, never share a prior user's preference on sign-out. */
export function hiblaReactionPreferenceKey(accountId: string): string {
  return `buklod:connect:quick-reaction:v1:${accountId}`;
}
