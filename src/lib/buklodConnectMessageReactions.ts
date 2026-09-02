export type ConnectMessageReactionKey =
  | 'love'
  | 'amen'
  | 'haha'
  | 'praying'
  | 'yes'
  | 'celebrate'
  | 'wow'
  | 'sad'
  | 'with_you'
  | 'clap'
  | 'fire'
  | 'hug';

export type ConnectMessageReaction = {
  key: ConnectMessageReactionKey;
  emoji: string;
  label: string;
};

export const CONNECT_MESSAGE_REACTIONS: ConnectMessageReaction[] =
  [
    {
      key: 'love',
      emoji: '\u2764\uFE0F',
      label: 'Love',
    },
    {
      key: 'amen',
      emoji: '\uD83D\uDE4F',
      label: 'Amen',
    },
    {
      key: 'praying',
      emoji: '\uD83E\uDD32',
      label: 'Praying',
    },
    {
      key: 'haha',
      emoji: '\uD83D\uDE02',
      label: 'Haha',
    },
    {
      key: 'yes',
      emoji: '\uD83D\uDC4D',
      label: 'Yes',
    },
    {
      key: 'celebrate',
      emoji: '\uD83C\uDF89',
      label: 'Celebrate',
    },
    {
      key: 'wow',
      emoji: '\uD83D\uDE2E',
      label: 'Wow',
    },
    {
      key: 'sad',
      emoji: '\uD83D\uDE22',
      label: 'Sad',
    },
    {
      key: 'with_you',
      emoji: '\uD83E\uDD1D',
      label: 'With you',
    },
    {
      key: 'clap',
      emoji: '\uD83D\uDC4F',
      label: 'Clap',
    },
    {
      key: 'fire',
      emoji: '\uD83D\uDD25',
      label: 'Fire',
    },
    {
      key: 'hug',
      emoji: '\uD83E\uDD17',
      label: 'Hug',
    },
  ];

export const CONNECT_MESSAGE_REACTION_KEYS =
  CONNECT_MESSAGE_REACTIONS.map(
    item => item.key
  );

export function emptyConnectMessageReactionCounts(): Record<
  ConnectMessageReactionKey,
  number
> {
  return {
    love: 0,
    amen: 0,
    haha: 0,
    praying: 0,
    yes: 0,
    celebrate: 0,
    wow: 0,
    sad: 0,
    with_you: 0,
    clap: 0,
    fire: 0,
    hug: 0,
  };
}
