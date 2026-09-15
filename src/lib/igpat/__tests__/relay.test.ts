import {
  IGPAT_RELAY_OPTIONS,
  igpatRelayPromptLabel,
  normalizeIgpatRelayPrompt,
} from '../relay';

describe('IGPAT Relay prompts', () => {
  it('keeps exactly the canonical prompt set', () => {
    expect(IGPAT_RELAY_OPTIONS.map(option => option.key)).toEqual([
      'continue_this',
      'your_turn',
      'answer_this',
      'show_yours',
    ]);
  });

  it('normalizes canonical route values and rejects unknown prompts', () => {
    expect(normalizeIgpatRelayPrompt('  YOUR_TURN ')).toBe('your_turn');
    expect(normalizeIgpatRelayPrompt('random_prompt')).toBeNull();
  });

  it('returns a safe fallback label for invalid data', () => {
    expect(igpatRelayPromptLabel('answer_this')).toBe('Answer This');
    expect(igpatRelayPromptLabel('bad')).toBe('IGPAT Relay');
  });
});
