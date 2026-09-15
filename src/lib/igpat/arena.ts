export type IgpatArenaClientMode = 'duel' | 'prove_it' | 'hard_mode';

export type IgpatArenaModeOption = {
  key: IgpatArenaClientMode;
  label: string;
  helper: string;
};

export const IGPAT_ARENA_MODES: IgpatArenaModeOption[] = [
  {
    key: 'duel',
    label: 'Duel',
    helper: 'Challenge one person. Both submit an IGPAT; outside viewers give Respect.',
  },
  {
    key: 'prove_it',
    label: 'Prove It',
    helper: 'Demonstrate an actual skill, result, or short challenge with real content.',
  },
  {
    key: 'hard_mode',
    label: 'Hard Mode',
    helper: 'A tougher one-on-one challenge for users who intentionally enter Arena.',
  },
];

export function normalizeIgpatArenaMode(value: unknown): IgpatArenaClientMode | null {
  const candidate = String(value ?? '').trim().toLowerCase();
  return IGPAT_ARENA_MODES.some(option => option.key === candidate)
    ? candidate as IgpatArenaClientMode
    : null;
}

export function igpatArenaModeLabel(value: unknown): string {
  const mode = normalizeIgpatArenaMode(value);
  return IGPAT_ARENA_MODES.find(option => option.key === mode)?.label ?? 'Arena Challenge';
}

export function igpatArenaStatusLabel(value: unknown): string {
  const status = String(value ?? '').trim().toUpperCase();
  if (status === 'OPEN') return 'OPEN';
  if (status === 'ACCEPTED') return 'ACCEPTED';
  if (status === 'ACTIVE') return 'ACTIVE';
  if (status === 'COMPLETED') return 'COMPLETE';
  if (status === 'CANCELLED') return 'CANCELLED';
  return status || 'UNKNOWN';
}
