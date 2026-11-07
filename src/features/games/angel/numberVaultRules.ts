/** Angel Number Vault: use each tile exactly once and reach the sealed target. */
export type VaultOperator = '+' | '-' | '×' | '÷';
export type VaultTile = { id: number; value: number };
export type VaultRound = {
  level: number; target: number; tiles: VaultTile[]; nextId: number;
  steps: number; status: 'playing' | 'won' | 'lost'; score: number;
};
export const VAULT_LEVELS = [
  { values: [2, 3, 4, 5], target: 19, hint: '5 × 4 − 3 + 2' },
  { values: [3, 5, 7, 2], target: 29, hint: '7 × 5 − 3 × 2' },
  { values: [4, 6, 8, 3], target: 41, hint: '8 × 6 − (4 + 3)' },
] as const;
export function createVaultRound(level: number): VaultRound {
  const spec = VAULT_LEVELS[level];
  if (!spec || !Number.isInteger(level)) throw new Error('Invalid vault level');
  return { level, target: spec.target, tiles: spec.values.map((value, id) => ({ id, value })),
    nextId: 4, steps: 0, status: 'playing', score: 0 };
}
export function vaultCombine(a: number, b: number, operator: VaultOperator): number | null {
  if (!Number.isInteger(a) || !Number.isInteger(b)) return null;
  const value = operator === '+' ? a + b : operator === '-' ? a - b :
    operator === '×' ? a * b : operator === '÷' && b !== 0 && a % b === 0 ? a / b : null;
  return value !== null && Number.isInteger(value) && Math.abs(value) <= 10_000 ? value : null;
}
export function applyVaultMove(round: VaultRound, firstId: number, secondId: number, operator: VaultOperator): VaultRound {
  if (round.status !== 'playing') throw new Error('Vault round already ended');
  if (firstId === secondId) throw new Error('Choose distinct number tiles');
  const first = round.tiles.find(t => t.id === firstId);
  const second = round.tiles.find(t => t.id === secondId);
  if (!first || !second) throw new Error('Unavailable number tile');
  const value = vaultCombine(first.value, second.value, operator);
  if (value === null) throw new Error('Invalid arithmetic operation');
  const tiles = [...round.tiles.filter(x => x.id !== firstId && x.id !== secondId),
    { id: round.nextId, value }];
  const status = tiles.length === 1
    ? tiles[0].value === round.target ? 'won' : 'lost'
    : 'playing';
  return { ...round, tiles, nextId: round.nextId + 1, steps: round.steps + 1,
    status, score: status === 'won' ? 700 : 0 };
}
/** Independent solution probe protects authored content from an impossible puzzle. */
export function vaultHasSolution(values: readonly number[], target: number, cap = 100000): boolean {
  if (!values.length || values.length > 5 || !values.every(Number.isInteger)) return false;
  let operations = 0;
  function search(nums: number[]): boolean {
    if (nums.length === 1) return nums[0] === target;
    for (let i = 0; i < nums.length; i++) for (let j = 0; j < nums.length; j++) {
      if (i === j) continue;
      const left = nums.filter((_, k) => k !== i && k !== j);
      for (const op of ['+', '-', '×', '÷'] as const) {
        if (++operations > cap) return false;
        const value = vaultCombine(nums[i], nums[j], op);
        if (value !== null && search([...left, value])) return true;
      }
    }
    return false;
  }
  return search([...values]);
}
