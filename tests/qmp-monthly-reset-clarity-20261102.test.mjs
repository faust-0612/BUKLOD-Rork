import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const card = readFileSync('src/components/BuklodCommunityContributionCard.tsx', 'utf8');

test('monthly QMP display remains period-scoped and lifetime QMP remains a separate read', () => {
  assert.match(card, /\{data\.this_month_qmp\}/);
  assert.match(card, /loadMyCommunityQmpHistory\(\)/);
  assert.match(card, /Lifetime QMP:\s*\{history\s*\?\s*history\.lifetime_qmp/);
  assert.match(card, /Period:\s*\{data\.period\.key\}/);
});

test('monthly reset explanation distinguishes lifetime total from monthly contribution history', () => {
  assert.match(card, /Monthly QMP starts fresh each month/);
  assert.match(card, /lifetime QMP is preserved/);
  assert.match(card, /record of your contributions/);
  assert.match(card, /THIS MONTH’S QUALIFIED CONTRIBUTION/);
  assert.doesNotMatch(card, /WHAT HELPED YOUR SHARE GROW\?/);
});

test('financial estimate remains read-only, provisional and non-withdrawable', () => {
  assert.match(card, /ESTIMATED REVENUE SHARE/);
  assert.match(card, /NOT WITHDRAWABLE/);
  assert.match(card, /No safe estimate yet/);
  assert.match(card, /Below ₱0\.01/);
});
