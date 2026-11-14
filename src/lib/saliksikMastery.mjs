/**
 * SALIKSIK objective assessment contract.
 * Must run ONLY on the server with a private question bank.
 * Written Master tier is deliberately NOT gradeable by this engine.
 */
export const SALIKSIK_COMPETENCIES = Object.freeze([
  'understanding', 'evidence', 'context', 'reasoning', 'transfer',
]);
export const SALIKSIK_WEIGHTS = Object.freeze({
  understanding: 20, evidence: 25, context: 20, reasoning: 25, transfer: 10,
});
export const SALIKSIK_POINTS = Object.freeze({ discover: 10, investigate: 20, master: 35 });

const INTEGER = v => Number.isInteger(v) && Number.isFinite(v);
const normalized = s => typeof s === 'string' ? s.trim().toLowerCase() : '';
const count = tier => tier === 'discover' ? 5 : tier === 'investigate' ? 10 : 0;

export function validateObjectiveBank(tier, bank) {
  const size = count(tier);
  if (!size || !Array.isArray(bank) || bank.length !== size) return false;
  const ids = new Set(), prompts = new Set();
  const competencies = Object.fromEntries(SALIKSIK_COMPETENCIES.map(c => [c, 0]));
  for (const q of bank) {
    if (!q || typeof q !== 'object' || typeof q.id !== 'string' ||
        !/^[a-z0-9-]{1,64}$/i.test(q.id) || ids.has(q.id) ||
        typeof q.prompt !== 'string' || q.prompt.trim().length < 15 ||
        prompts.has(normalized(q.prompt)) ||
        !Array.isArray(q.options) || q.options.length !== 4 ||
        q.options.some(o => typeof o !== 'string' || o.trim().length < 1) ||
        new Set(q.options.map(normalized)).size !== 4 ||
        !INTEGER(q.correctIndex) || q.correctIndex < 0 || q.correctIndex > 3 ||
        !Object.hasOwn(competencies, q.competency) ||
        typeof q.evidence !== 'string' || q.evidence.trim().length < 20) return false;
    competencies[q.competency] += 1;
    ids.add(q.id);
    prompts.add(normalized(q.prompt));
  }
  return SALIKSIK_COMPETENCIES.every(k => competencies[k] === size / 5);
}

export function evaluateObjectiveAttempt({ tier, bank, questionOrder, answers }) {
  if (!validateObjectiveBank(tier, bank)) return { ok: false, passed: false, reason: 'bank_invalid' };
  if (!Array.isArray(questionOrder) || questionOrder.length !== bank.length ||
      new Set(questionOrder).size !== bank.length ||
      questionOrder.some(i => !INTEGER(i) || i < 0 || i >= bank.length)) {
    return { ok: false, passed: false, reason: 'question_order_invalid' };
  }
  if (!Array.isArray(answers) || answers.length !== bank.length ||
      answers.some(a => !INTEGER(a) || a < 0 || a > 3)) {
    return { ok: false, passed: false, reason: 'answers_invalid' };
  }
  const totals = Object.fromEntries(SALIKSIK_COMPETENCIES.map(k => [k, {correct: 0,total: 0}]));
  for (let i = 0; i < bank.length; i++) {
    const q = bank[questionOrder[i]];
    const t = totals[q.competency];
    t.total++;
    if (answers[i] === q.correctIndex) t.correct++;
  }
  const competencies = Object.fromEntries(SALIKSIK_COMPETENCIES.map(k =>
    [k, Math.round((100 * totals[k].correct) / totals[k].total)]));
  const score = Math.round(SALIKSIK_COMPETENCIES.reduce(
    (sum,k) => sum + SALIKSIK_WEIGHTS[k] * competencies[k] / 100, 0));
  const core = ['evidence', 'context', 'reasoning'];
  const passed = score >= 80 && (tier !== 'investigate' || core.every(k => competencies[k] >= 70));
  const weak = SALIKSIK_COMPETENCIES.filter(k =>
    competencies[k] < (tier === 'investigate' && core.includes(k) ? 70 : 60));
  return {
    ok: true, passed, tier, score, competencies,
    points: passed ? SALIKSIK_POINTS[tier] : 0,
    reason: passed ? 'mastery_verified' : score < 80 ? 'overall_below_80' : 'core_weak',
    nextAction: passed ? 'next_investigation' : score < 60
      ? 'guided_reteach' : 'focused_practice',
    weakCompetencies: weak,
  };
}
export function saliksikRewardKey(investigationId, version) {
  if (!/^[0-9a-f-]{36}$/i.test(investigationId) || !INTEGER(version) || version < 1) {
    throw new Error('Invalid immutable reward identity');
  }
  return 'saliksik:' + investigationId.toLowerCase() + ':v' + version;
}
