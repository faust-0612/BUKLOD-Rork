export type IgpatRelayPrompt =
  | 'continue_this'
  | 'your_turn'
  | 'answer_this'
  | 'show_yours';

export const IGPAT_RELAY_OPTIONS: Array<{
  key: IgpatRelayPrompt;
  label: string;
  helper: string;
}> = [
  { key: 'continue_this', label: 'Continue This', helper: 'Add the next part of the story or thought.' },
  { key: 'your_turn', label: 'Your Turn', helper: 'Respond with your own version or experience.' },
  { key: 'answer_this', label: 'Answer This', helper: 'Give a direct video response.' },
  { key: 'show_yours', label: 'Show Yours', helper: 'Show your own example, result, or moment.' },
];

export function normalizeIgpatRelayPrompt(value: unknown): IgpatRelayPrompt | null {
  const candidate = String(value ?? '').trim().toLowerCase();
  return IGPAT_RELAY_OPTIONS.some(option => option.key === candidate)
    ? candidate as IgpatRelayPrompt
    : null;
}

export function igpatRelayPromptLabel(value: unknown): string {
  const prompt = normalizeIgpatRelayPrompt(value);
  return IGPAT_RELAY_OPTIONS.find(option => option.key === prompt)?.label ?? 'IGPAT Relay';
}
