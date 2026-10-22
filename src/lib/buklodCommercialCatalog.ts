/**
 * Canonical BUKLOD commercial products.
 * Prices and codes are stable; display names are not used for authorization.
 */

export const BUKLOD_PRODUCT_CLUSTER_PREMIUM = 'cluster_premium';
export const BUKLOD_PRODUCT_LESSONS_CCP = 'cluster_lessons_ccp';
export const BUKLOD_PRODUCT_LESSONS_DISCIPLESHIP =
  'cluster_lessons_discipleship';
export const BUKLOD_PRODUCT_LESSONS_MENTORING = 'cluster_lessons_mentoring';
export const BUKLOD_PRODUCT_ORG_FOCUS_APPS_ANNUAL =
  'organization_focus_apps_annual';
export const BUKLOD_PRODUCT_ORG_FOCUS_APPS_MONTHLY =
  'organization_focus_apps_monthly';

export type BuklodCommercialProductCode =
  | typeof BUKLOD_PRODUCT_CLUSTER_PREMIUM
  | typeof BUKLOD_PRODUCT_LESSONS_CCP
  | typeof BUKLOD_PRODUCT_LESSONS_DISCIPLESHIP
  | typeof BUKLOD_PRODUCT_LESSONS_MENTORING
  | typeof BUKLOD_PRODUCT_ORG_FOCUS_APPS_ANNUAL
  | typeof BUKLOD_PRODUCT_ORG_FOCUS_APPS_MONTHLY;

export type BuklodCommercialBillingKind = 'ONE_TIME' | 'ANNUAL' | 'MONTHLY';
export type BuklodCommercialScopeKind = 'CLUSTER' | 'ORGANIZATION';

export type BuklodCommercialProduct = {
  code: BuklodCommercialProductCode;
  displayName: string;
  shortLabel: string;
  billingKind: BuklodCommercialBillingKind;
  amountPhp: number;
  scopeKind: BuklodCommercialScopeKind;
  lessonStages: number[];
  includesDailyBibleReading: boolean;
  memberLockedCopy: string;
  adminHint: string;
};

export const BUKLOD_COMMERCIAL_PRODUCTS: Record<
  BuklodCommercialProductCode,
  BuklodCommercialProduct
> = {
  cluster_premium: {
    code: BUKLOD_PRODUCT_CLUSTER_PREMIUM,
    displayName: 'Cluster Premium',
    shortLabel: 'Cluster Premium — ₱49',
    billingKind: 'ONE_TIME',
    amountPhp: 49,
    scopeKind: 'CLUSTER',
    lessonStages: [],
    includesDailyBibleReading: true,
    memberLockedCopy:
      'This feature is available through your Cluster Premium.',
    adminHint: 'Paid by the Cluster Admin/Head. Daily Bible Reading included.',
  },
  cluster_lessons_ccp: {
    code: BUKLOD_PRODUCT_LESSONS_CCP,
    displayName: 'CCP 101–103',
    shortLabel: 'CCP 101–103 — ₱49 one-time',
    billingKind: 'ONE_TIME',
    amountPhp: 49,
    scopeKind: 'CLUSTER',
    lessonStages: [101, 102, 103],
    includesDailyBibleReading: false,
    memberLockedCopy:
      'This lesson package has not yet been activated for your Cluster.',
    adminHint: 'One-time per Cluster. Unlocks BUKLOD 101, 102, and 103.',
  },
  cluster_lessons_discipleship: {
    code: BUKLOD_PRODUCT_LESSONS_DISCIPLESHIP,
    displayName: 'Discipleship 104–105',
    shortLabel: 'Discipleship 104–105 — ₱59 one-time',
    billingKind: 'ONE_TIME',
    amountPhp: 59,
    scopeKind: 'CLUSTER',
    lessonStages: [104, 105],
    includesDailyBibleReading: false,
    memberLockedCopy:
      'This lesson package has not yet been activated for your Cluster.',
    adminHint: 'One-time per Cluster. Unlocks BUKLOD 104 and 105.',
  },
  cluster_lessons_mentoring: {
    code: BUKLOD_PRODUCT_LESSONS_MENTORING,
    displayName: 'Mentoring 106–107',
    shortLabel: 'Mentoring 106–107 — ₱69 one-time',
    billingKind: 'ONE_TIME',
    amountPhp: 69,
    scopeKind: 'CLUSTER',
    lessonStages: [106, 107],
    includesDailyBibleReading: false,
    memberLockedCopy:
      'This lesson package has not yet been activated for your Cluster.',
    adminHint: 'One-time per Cluster. Unlocks BUKLOD 106 and 107.',
  },
  organization_focus_apps_monthly: {
    code: BUKLOD_PRODUCT_ORG_FOCUS_APPS_MONTHLY,
    displayName: 'BUKLOD Focus Apps Monthly',
    shortLabel: 'BUKLOD Focus Apps — ₱59/month per Organization',
    billingKind: 'MONTHLY',
    amountPhp: 59,
    scopeKind: 'ORGANIZATION',
    lessonStages: [],
    includesDailyBibleReading: false,
    memberLockedCopy:
      'This Organization Focus App portal requires an active Focus Apps subscription.',
    adminHint:
      '₱59/month per Organization. Separate from Cluster Premium and lesson packages.',
  },
  organization_focus_apps_annual: {
    code: BUKLOD_PRODUCT_ORG_FOCUS_APPS_ANNUAL,
    displayName: 'BUKLOD Focus Apps Annual',
    shortLabel: 'BUKLOD Focus Apps — ₱499/year per Organization',
    billingKind: 'ANNUAL',
    amountPhp: 499,
    scopeKind: 'ORGANIZATION',
    lessonStages: [],
    includesDailyBibleReading: false,
    memberLockedCopy:
      'This Organization Focus App portal requires an active Focus Apps subscription.',
    adminHint:
      '₱499/year per Organization. Organization data remains if the subscription expires. Historical ₱249 payments stay on record.',
  },
};

export const BUKLOD_CLUSTER_PACKAGE_CODES: BuklodCommercialProductCode[] = [
  BUKLOD_PRODUCT_CLUSTER_PREMIUM,
  BUKLOD_PRODUCT_LESSONS_CCP,
  BUKLOD_PRODUCT_LESSONS_DISCIPLESHIP,
  BUKLOD_PRODUCT_LESSONS_MENTORING,
];

export const BUKLOD_ORG_FOCUS_APP_PRODUCT_CODES: BuklodCommercialProductCode[] = [
  BUKLOD_PRODUCT_ORG_FOCUS_APPS_MONTHLY,
  BUKLOD_PRODUCT_ORG_FOCUS_APPS_ANNUAL,
];

/** Focus Apps gated by the Organization Focus Apps subscription. */
export const BUKLOD_ORG_SUBSCRIPTION_GATED_FOCUS_APPS = [
  'faculty',
  'business',
  'government',
  'family',
  'health',
  'market',
] as const;

/**
 * Focus Apps that keep their own unrelated entitlement and are NOT
 * gated by organization_focus_apps_monthly / organization_focus_apps_annual.
 */
export const BUKLOD_ORG_SUBSCRIPTION_EXEMPT_FOCUS_APPS = [
  'attendance',
  'giving',
  'organization',
] as const;

export const BUKLOD_ORGANIZATION_TYPE_CHURCH = 'CHURCH';

export const CLUSTER_APPROVER_ROLE_KEYS = [
  'CLUSTER_HEAD',
  'CLUSTER_ADMIN',
  'ADMIN',
  'PASTOR',
  'MENTOR',
] as const;

export const CLUSTER_BILLING_ROLE_KEYS = [
  'CLUSTER_HEAD',
  'CLUSTER_ADMIN',
  'ADMIN',
] as const;

export function productForLessonStage(
  stageCode: number,
): BuklodCommercialProduct | null {
  const code = Number(stageCode);
  if (code >= 101 && code <= 103) {
    return BUKLOD_COMMERCIAL_PRODUCTS.cluster_lessons_ccp;
  }
  if (code >= 104 && code <= 105) {
    return BUKLOD_COMMERCIAL_PRODUCTS.cluster_lessons_discipleship;
  }
  if (code >= 106 && code <= 107) {
    return BUKLOD_COMMERCIAL_PRODUCTS.cluster_lessons_mentoring;
  }
  return null;
}

export function isOrgSubscriptionGatedFocusApp(app: string) {
  return (BUKLOD_ORG_SUBSCRIPTION_GATED_FOCUS_APPS as readonly string[]).includes(
    String(app ?? '').trim().toLowerCase(),
  );
}

export function formatPhp(amount: number) {
  return `₱${Number(amount).toFixed(0)}`;
}

export function isChurchOrganizationType(value: unknown) {
  return String(value ?? '').trim().toUpperCase() === 'CHURCH';
}
