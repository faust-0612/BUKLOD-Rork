/* Canonical member Economy & Bayanihan ledger aggregator.
 * Points, Pool/QMP share weight, and Bayanihan ₱ stay separate ledgers.
 * No invented balances. Partial loads are honest nulls/zeros from real APIs only.
 */
import { supabase } from '@/lib/supabase';
import {
  loadBuklodClaimGroups,
  loadBuklodPointsDashboard,
  type BuklodClaimGroup,
  type BuklodPointsDashboard,
} from '@/lib/buklodRewards';
import {
  loadMyBuklodFinancialSummaryV3,
  type BuklodFinancialSummaryV3,
} from '@/lib/buklodEconomyV3';
import {
  loadMyBuklodR38EconomyReport,
  type BuklodR38UserEconomyReport,
} from '@/lib/buklodR38Economy';
import {
  loadMyCommunityContribution,
  type CommunityContributionDashboard,
} from '@/lib/buklodCommunityContributionEconomy';
import {
  loadBuklodLifeImpact,
  type BuklodLifeImpactSummary,
} from '@/lib/buklodLifeImpact';
import {
  CHARACTER_DISPLAY_NAME,
  getMyBuklodCharacterSelectionV2,
  type BuklodCharacterSelectionV2State,
} from '@/lib/buklodCharacterSelectionV2';

export type BuklodEconomyLedgerTxn = {
  id: string;
  direction: 'credit' | 'debit' | string;
  claim_state: string | null;
  points: number;
  activity_type: string;
  source_key: string | null;
  source_id: string | null;
  description: string | null;
  created_at: string;
  running_balance: number | null;
};

export type BuklodEconomySourceBucket = {
  key: string;
  label: string;
  points: number;
};

export type BuklodEconomyRankSlice = {
  points: number;
  rank_code: string | null;
  rank_name: string | null;
  points_to_next: number;
  next_rank_name: string | null;
  progress_percent: number;
};

export type BuklodEconomyLedgerSnapshot = {
  loaded_at: string;
  points: BuklodPointsDashboard | null;
  claimGroups: BuklodClaimGroup[];
  claimablePoints: number;
  pointsSpent: number;
  pointsPendingInLedger: number;
  transactions: BuklodEconomyLedgerTxn[];
  sources: BuklodEconomySourceBucket[];
  rank: {
    lifetime: BuklodEconomyRankSlice | null;
    season: BuklodEconomyRankSlice | null;
  };
  financial: BuklodFinancialSummaryV3 | null;
  r38: BuklodR38UserEconomyReport | null;
  community: CommunityContributionDashboard | null;
  impact: BuklodLifeImpactSummary | null;
  character: BuklodCharacterSelectionV2State | null;
  characterName: string | null;
  errors: string[];
};

function num(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function sourceLabel(activityType: string) {
  const key = String(activityType || '').toLowerCase();
  if (key.includes('bible') || key.includes('reading') || key.includes('devotional')) return 'Daily activity';
  if (key.includes('formation') || key.includes('lesson') || key.includes('learning')) return 'Formation';
  if (key.includes('community') || key.includes('r36') || key.includes('wall')) return 'Community';
  if (key.includes('attendance') || key.includes('event') || key.includes('ministry')) return 'Attendance / ministry';
  if (key.includes('mentor')) return 'Mentoring';
  if (key.includes('referral')) return 'Referral';
  if (key.includes('challenge')) return 'Challenge';
  if (key.includes('reward') || key.includes('redeem') || key.includes('catalog')) return 'Rewards';
  if (key.includes('admin') || key.includes('grant')) return 'Admin grant';
  if (key.includes('bayanihan')) return 'Bayanihan activity';
  if (key.includes('claim')) return 'Claims';
  return 'Other BUKLOD activity';
}

function withRunningBalance(rows: Omit<BuklodEconomyLedgerTxn, 'running_balance'>[]): BuklodEconomyLedgerTxn[] {
  const chronological = [...rows].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  let balance = 0;
  const stamped = chronological.map((row) => {
    const pts = Math.max(0, num(row.points));
    if (String(row.direction).toLowerCase() === 'debit') balance = Math.max(0, balance - pts);
    else balance += pts;
    return { ...row, running_balance: balance };
  });
  return stamped.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

async function loadRankDashboard() {
  const { data, error } = await supabase.rpc('get_my_buklod_rank_dashboard');
  if (error || !data || typeof data !== 'object') return null;
  const row = data as Record<string, unknown>;
  const lifetime = (row.lifetime ?? null) as Record<string, unknown> | null;
  const season = (row.season ?? null) as Record<string, unknown> | null;
  const asSlice = (value: Record<string, unknown> | null): BuklodEconomyRankSlice | null => {
    if (!value) return null;
    return {
      points: num(value.points),
      rank_code: value.rank_code == null ? null : String(value.rank_code),
      rank_name: value.rank_name == null ? null : String(value.rank_name),
      points_to_next: num(value.points_to_next),
      next_rank_name: value.next_rank_name == null ? null : String(value.next_rank_name),
      progress_percent: num(value.progress_percent),
    };
  };
  return { lifetime: asSlice(lifetime), season: asSlice(season) };
}

async function loadLedgerRows() {
  const { data, error } = await supabase
    .from('buklod_points_ledger')
    .select('id,direction,claim_state,points,activity_type,source_key,source_id,description,created_at')
    .order('created_at', { ascending: false })
    .limit(300);
  if (error || !Array.isArray(data)) return [] as Omit<BuklodEconomyLedgerTxn, 'running_balance'>[];
  return data.map((row: Record<string, unknown>) => ({
    id: String(row.id ?? ''),
    direction: String(row.direction ?? 'credit'),
    claim_state: row.claim_state == null ? null : String(row.claim_state),
    points: Math.max(0, num(row.points)),
    activity_type: String(row.activity_type ?? 'other'),
    source_key: row.source_key == null ? null : String(row.source_key),
    source_id: row.source_id == null ? null : String(row.source_id),
    description: row.description == null ? null : String(row.description),
    created_at: String(row.created_at ?? ''),
  }));
}

export async function loadBuklodEconomyLedger(
  userId?: string | null,
): Promise<BuklodEconomyLedgerSnapshot> {
  const errors: string[] = [];

  const [
    pointsResult,
    claimsResult,
    ledgerResult,
    rankResult,
    financialResult,
    r38Result,
    communityResult,
    impactResult,
    characterResult,
  ] = await Promise.allSettled([
    loadBuklodPointsDashboard(),
    loadBuklodClaimGroups(),
    loadLedgerRows(),
    loadRankDashboard(),
    loadMyBuklodFinancialSummaryV3(),
    loadMyBuklodR38EconomyReport(),
    loadMyCommunityContribution(),
    loadBuklodLifeImpact(),
    userId ? getMyBuklodCharacterSelectionV2(userId) : Promise.resolve(null),
  ]);

  const points = pointsResult.status === 'fulfilled' ? pointsResult.value : null;
  if (pointsResult.status === 'rejected') errors.push('Points dashboard unavailable.');

  const claimGroups = claimsResult.status === 'fulfilled' ? claimsResult.value : [];
  if (claimsResult.status === 'rejected') errors.push('Claim groups unavailable.');

  const rawLedger = ledgerResult.status === 'fulfilled' ? ledgerResult.value : [];
  if (ledgerResult.status === 'rejected') errors.push('Points ledger unavailable.');

  const rank = rankResult.status === 'fulfilled' && rankResult.value
    ? rankResult.value
    : { lifetime: null, season: null };
  if (rankResult.status === 'rejected') errors.push('Circle Rank unavailable.');

  const financial = financialResult.status === 'fulfilled' ? financialResult.value : null;
  if (financialResult.status === 'rejected') errors.push('Bayanihan earnings summary unavailable.');

  const r38 = r38Result.status === 'fulfilled' ? r38Result.value : null;
  if (r38Result.status === 'rejected') errors.push('Economy report unavailable.');

  const community = communityResult.status === 'fulfilled' ? communityResult.value : null;
  if (communityResult.status === 'rejected') errors.push('Pool / QMP contribution unavailable.');

  const impact = impactResult.status === 'fulfilled' ? impactResult.value : null;
  if (impactResult.status === 'rejected') errors.push('Impact summary unavailable.');

  const character = characterResult.status === 'fulfilled' ? characterResult.value : null;

  const transactions = withRunningBalance(rawLedger);
  const pointsSpent = rawLedger
    .filter((row) => String(row.direction).toLowerCase() === 'debit')
    .reduce((sum, row) => sum + row.points, 0);
  const pointsPendingInLedger = rawLedger
    .filter((row) => String(row.direction).toLowerCase() === 'credit' && row.claim_state === 'pending')
    .reduce((sum, row) => sum + row.points, 0);

  const sourceMap = new Map<string, number>();
  for (const row of rawLedger) {
    if (String(row.direction).toLowerCase() !== 'credit') continue;
    const label = sourceLabel(row.activity_type);
    sourceMap.set(label, (sourceMap.get(label) ?? 0) + row.points);
  }
  const sources = [...sourceMap.entries()]
    .map(([label, pts]) => ({
      key: label.toLowerCase().replace(/\s+/g, '_'),
      label,
      points: pts,
    }))
    .sort((a, b) => b.points - a.points);

  const claimablePoints = Math.max(
    0,
    points?.pending_claimable_points
      ?? claimGroups.reduce((sum, group) => sum + num(group.total_points), 0),
  );

  const characterId = character?.active_character_id ?? null;
  const characterName = characterId && characterId in CHARACTER_DISPLAY_NAME
    ? CHARACTER_DISPLAY_NAME[characterId as keyof typeof CHARACTER_DISPLAY_NAME]
    : characterId;

  return {
    loaded_at: new Date().toISOString(),
    points,
    claimGroups,
    claimablePoints,
    pointsSpent,
    pointsPendingInLedger,
    transactions,
    sources,
    rank,
    financial,
    r38,
    community,
    impact,
    character,
    characterName,
    errors,
  };
}

export function formatEconomyPts(value: unknown) {
  return Math.max(0, num(value)).toLocaleString('en-PH');
}

export function formatEconomyPhp(value: unknown) {
  return num(value).toLocaleString('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Prefer minor units when community API returns them; otherwise PHP major units from V3/R38. */
export function economyEstimatedBayanihanPhp(snapshot: BuklodEconomyLedgerSnapshot) {
  const communityMinor = snapshot.community?.estimated_share_minor;
  if (communityMinor != null && Number.isFinite(Number(communityMinor))) {
    return Number(communityMinor) / 100;
  }
  const v3 = snapshot.financial?.earnings?.estimated_earnings_php;
  if (v3 != null) return num(v3);
  const r38 = snapshot.r38?.actual_earnings?.estimated_share?.bayanihan
    ?? snapshot.r38?.actual_earnings?.estimated_share?.total;
  if (r38 != null) return num(r38);
  return null;
}

export function economyFinalizedBayanihanPhp(snapshot: BuklodEconomyLedgerSnapshot) {
  const communityMinor = snapshot.community?.finalized_share?.amount_minor;
  if (communityMinor != null && Number.isFinite(Number(communityMinor))) {
    return Number(communityMinor) / 100;
  }
  const v3 = snapshot.financial?.earnings?.latest_finalized_user_share_php;
  if (v3 != null) return num(v3);
  const r38 = snapshot.r38?.actual_earnings?.finalized_share?.bayanihan
    ?? snapshot.r38?.actual_earnings?.finalized_share?.total;
  if (r38 != null) return num(r38);
  return null;
}

export function economyPoolSharePct(snapshot: BuklodEconomyLedgerSnapshot) {
  const v3 = snapshot.financial?.earnings?.estimated_pool_share_pct;
  if (v3 != null && Number.isFinite(Number(v3))) return Number(v3);
  return null;
}

export function economyQmpWeight(snapshot: BuklodEconomyLedgerSnapshot) {
  if (snapshot.community?.share_weight != null) return num(snapshot.community.share_weight);
  if (snapshot.community?.this_month_qmp != null) return num(snapshot.community.this_month_qmp);
  if (snapshot.financial?.progress?.qualified_monthly_points != null) {
    return num(snapshot.financial.progress.qualified_monthly_points);
  }
  return null;
}
