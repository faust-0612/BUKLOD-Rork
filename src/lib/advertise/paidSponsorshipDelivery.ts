/** Narrow, fail-closed delivery guard shared by the Public Wall and desktop Home. */
export type PaidSponsorshipCoverage = 'barangay' | 'city' | 'province' | 'nationwide';
export type PaidSponsorshipCreative = 'photo' | 'video';

export type PaidSponsorshipCampaign = {
  id: string;
  advertiser_name: string;
  headline: string;
  short_text: string | null;
  image_url: string | null;
  video_url: string | null;
  destination_url: string | null;
  creative_type: PaidSponsorshipCreative;
  coverage_level: PaidSponsorshipCoverage;
  barangay: string | null;
  city_municipality: string | null;
  province: string | null;
  placement: 'all' | 'community' | string;
  priority: number | null;
  status: string;
  payment_status: string;
  policy_confirmed: boolean;
  starts_at: string;
  ends_at: string;
};

function normalize(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function firstProfileText(profile: Record<string, unknown> | null, fields: string[]): string {
  for (const key of fields) {
    const value = profile?.[key];
    if (typeof value === 'string' && value.trim()) return normalize(value);
  }
  return '';
}

export function paidSponsorshipMatchesGeography(
  campaign: Pick<PaidSponsorshipCampaign, 'coverage_level' | 'province' | 'city_municipality' | 'barangay'>,
  profile: Record<string, unknown> | null,
): boolean {
  if (campaign.coverage_level === 'nationwide') return true;
  const province = firstProfileText(profile, ['province', 'province_name', 'address_province']);
  const city = firstProfileText(profile, ['city_municipality', 'municipality', 'municipality_name', 'city', 'city_name', 'address_city', 'address_municipality']);
  const barangay = firstProfileText(profile, ['barangay', 'barangay_name', 'address_barangay']);
  if (!province || province !== normalize(campaign.province)) return false;
  if (campaign.coverage_level === 'province') return true;
  if (!city || city !== normalize(campaign.city_municipality)) return false;
  if (campaign.coverage_level === 'city') return true;
  return campaign.coverage_level === 'barangay'
    && !!barangay && barangay === normalize(campaign.barangay);
}

export function paidSponsorshipCanDisplay(
  campaign: PaidSponsorshipCampaign,
  profile: Record<string, unknown> | null,
  atMs: number,
  scopeCoverage: PaidSponsorshipCoverage | null = null,
  requireExactScopeCoverage = false,
): boolean {
  if (!Number.isFinite(atMs) || campaign.status !== 'approved'
      || !['paid', 'waived'].includes(campaign.payment_status)
      || campaign.policy_confirmed !== true
      || !['all', 'community'].includes(campaign.placement)) return false;
  const start = Date.parse(campaign.starts_at);
  const end = Date.parse(campaign.ends_at);
  if (!Number.isFinite(start) || !Number.isFinite(end) || atMs < start || atMs >= end) return false;
  if (requireExactScopeCoverage && (!scopeCoverage || campaign.coverage_level !== scopeCoverage)) return false;
  if (campaign.creative_type === 'photo' && !campaign.image_url?.trim()) return false;
  if (campaign.creative_type === 'video' && !campaign.video_url?.trim()) return false;
  if (!['photo', 'video'].includes(campaign.creative_type)) return false;
  return paidSponsorshipMatchesGeography(campaign, profile);
}
