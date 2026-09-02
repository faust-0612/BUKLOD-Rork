/**
 * Universal focus-app integration registry.
 * Single doorway contract for Main BUKLOD — not duplicate identity/org systems.
 */

import type { BuklodFocusApp } from '@/lib/buklodFoundation';
import {
  BUKLOD_REPORT_NOTIFICATION_EVENTS,
  BUKLOD_REPORT_REMINDER_POLICY,
} from '@/lib/buklodReportContracts';
import {
  buklodReportDefinitionsPath,
  buklodReportLandingPath,
} from '@/lib/buklodReportRoutes';

export type BuklodIntegrationAvailability =
  | 'AVAILABLE'
  | 'INTEGRATION_READY'
  | 'DISABLED';

export type BuklodIntegrationAppId =
  | 'report'
  | 'faculty'
  | 'local'
  | 'family'
  | 'palengke'
  | 'health'
  | 'commercial';

export type BuklodIntegrationApp = {
  id: BuklodIntegrationAppId;
  displayName: string;
  doorwayRoute: string;
  availability: BuklodIntegrationAvailability;
  foundationApp: BuklodFocusApp | null;
  deepLinkScheme: string | null;
  notificationNamespace: string;
  scopeParamKeys: string[];
  organizationContextKeys: string[];
  roleKeys: string[];
  entitlementKeys: string[];
  fileHandoffBucket: string | null;
  fallbackTitle: string;
  fallbackMessage: string;
};

export const BUKLOD_INTEGRATION_APPS: Record<
  BuklodIntegrationAppId,
  BuklodIntegrationApp
> = {
  report: {
    id: 'report',
    displayName: 'BUKLOD Report',
    doorwayRoute: '/reports',
    availability: 'INTEGRATION_READY',
    foundationApp: null,
    deepLinkScheme: 'buklod-report',
    notificationNamespace: 'buklod_report',
    scopeParamKeys: ['scope_id', 'scopeId', 'organization', 'cluster'],
    organizationContextKeys: ['scope_id', 'organization_id', 'parent_scope_id'],
    roleKeys: ['ORGANIZATION_ADMIN', 'CLUSTER_ADMIN', 'SUB_ORG_ADMIN', 'ADMIN'],
    entitlementKeys: ['buklod_report_scope_entitled_v1'],
    fileHandoffBucket: 'report-attachments',
    fallbackTitle: 'BUKLOD Report',
    fallbackMessage:
      'Definition management is available. Submissions, review, and reminders arrive in a later phase.',
  },
  faculty: {
    id: 'faculty',
    displayName: 'BUKLOD Faculty',
    doorwayRoute: '/profile/buklod-faculty',
    availability: 'AVAILABLE',
    foundationApp: 'faculty',
    deepLinkScheme: 'buklod-faculty',
    notificationNamespace: 'buklod_faculty',
    scopeParamKeys: ['scope_id', 'scopeId', 'school_id', 'classroom_id'],
    organizationContextKeys: ['scope_id', 'organization_id', 'school_scope_id'],
    roleKeys: [
      'FACULTY',
      'SCHOOL_ADMIN',
      'FACULTY_ADMIN',
      'STUDENT',
      'EDUCATION',
    ],
    entitlementKeys: [
      'education.faculty.open',
      'education.classroom.manage',
      'education.access',
    ],
    fileHandoffBucket: 'education-materials',
    fallbackTitle: 'BUKLOD Faculty',
    fallbackMessage:
      'Faculty workspace is linked to your BUKLOD identity. Advanced classroom features continue to roll out.',
  },
  local: {
    id: 'local',
    displayName: 'BUKLOD Local',
    doorwayRoute: '/profile/buklod-local',
    availability: 'INTEGRATION_READY',
    foundationApp: 'government',
    deepLinkScheme: 'buklod-local',
    notificationNamespace: 'buklod_local',
    scopeParamKeys: ['scope_id', 'scopeId', 'barangay_id', 'locality_id'],
    organizationContextKeys: ['scope_id', 'organization_id', 'parent_scope_id'],
    roleKeys: ['BARANGAY_ADMIN', 'GOVERNMENT_ADMIN', 'LOCAL_ADMIN'],
    entitlementKeys: ['government.admin', 'government.barangay.admin'],
    fileHandoffBucket: 'local-announcements',
    fallbackTitle: 'BUKLOD Local',
    fallbackMessage:
      'Local community identity is linked. Full Local app features are not built yet.',
  },
  family: {
    id: 'family',
    displayName: 'BUKLOD Family',
    doorwayRoute: '/profile/buklod-family',
    availability: 'INTEGRATION_READY',
    foundationApp: 'family',
    deepLinkScheme: 'buklod-family',
    notificationNamespace: 'buklod_family',
    scopeParamKeys: ['scope_id', 'family_id', 'household_id'],
    organizationContextKeys: ['household_id', 'guardian_user_id'],
    roleKeys: ['GUARDIAN', 'PARENT', 'FAMILY_MEMBER', 'MINOR'],
    entitlementKeys: ['family', 'family.access'],
    fileHandoffBucket: 'family-documents',
    fallbackTitle: 'BUKLOD Family',
    fallbackMessage:
      'Family contracts are reserved. Household features are integration-ready only.',
  },
  palengke: {
    id: 'palengke',
    displayName: 'BUKLOD Palengke',
    doorwayRoute: '/profile/buklod-market',
    availability: 'INTEGRATION_READY',
    foundationApp: 'market',
    deepLinkScheme: 'buklod-palengke',
    notificationNamespace: 'buklod_palengke',
    scopeParamKeys: ['scope_id', 'seller_id', 'listing_id', 'locality_id'],
    organizationContextKeys: ['business_scope_id', 'seller_user_id'],
    roleKeys: ['SELLER', 'MARKET_ADMIN', 'PALENGKE_ADMIN'],
    entitlementKeys: ['market', 'palengke', 'market.access'],
    fileHandoffBucket: 'market-listings',
    fallbackTitle: 'BUKLOD Palengke',
    fallbackMessage:
      'Seller and listing contracts are ready. Checkout and orders are not implemented.',
  },
  health: {
    id: 'health',
    displayName: 'BUKLOD Health',
    doorwayRoute: '/profile/buklod-health',
    availability: 'INTEGRATION_READY',
    foundationApp: 'health',
    deepLinkScheme: 'buklod-health',
    notificationNamespace: 'buklod_health',
    scopeParamKeys: ['scope_id', 'program_id', 'referral_id'],
    organizationContextKeys: ['scope_id', 'rhu_scope_id', 'barangay_scope_id'],
    roleKeys: ['HEALTH_WORKER', 'RHU_ADMIN', 'BARANGAY_HEALTH'],
    entitlementKeys: ['health', 'health.access'],
    fileHandoffBucket: 'health-program-docs',
    fallbackTitle: 'BUKLOD Health',
    fallbackMessage:
      'Privacy and consent boundaries are defined. No clinical records are created here.',
  },
  commercial: {
    id: 'commercial',
    displayName: 'BUKLOD Commercial',
    doorwayRoute: '/profile/buklod-business',
    availability: 'INTEGRATION_READY',
    foundationApp: 'business',
    deepLinkScheme: 'buklod-commercial',
    notificationNamespace: 'buklod_commercial',
    scopeParamKeys: ['scope_id', 'plan_id', 'billing_owner_id'],
    organizationContextKeys: ['scope_id', 'billing_scope_id'],
    roleKeys: ['BUSINESS_ADMIN', 'BILLING_MANAGER', 'COMMERCIAL_ADMIN'],
    entitlementKeys: [
      'business.admin',
      'buklod_scope_commercial_entitlements_v1',
      'buklod_scope_has_commercial_feature_v1',
    ],
    fileHandoffBucket: null,
    fallbackTitle: 'BUKLOD Commercial',
    fallbackMessage:
      'Billing, entitlements, and Cost Guard foundations are linked. Full subscription UI is not required yet.',
  },
};

export const BUKLOD_FACULTY_INTEGRATION = {
  identity: 'buklod_auth_user_id',
  roles: ['STUDENT', 'FACULTY', 'SCHOOL_ADMIN', 'FACULTY_ADMIN'] as const,
  scopeKeys: ['scope_id', 'school_scope_id', 'organization_id'] as const,
  classKeys: ['classroom_id', 'subject_code', 'section_name'] as const,
  attendanceRoute: '/profile/buklod-faculty-attendance',
  reportRoute: '/reports',
  deepLinkScheme: 'buklod-faculty',
  notificationNamespace: 'buklod_faculty',
  materialsBucket: 'education-materials',
} as const;

export const BUKLOD_FAMILY_INTEGRATION = {
  householdIdKey: 'household_id',
  relationshipKeys: ['parent', 'guardian', 'child', 'spouse', 'dependent'] as const,
  consentBoundary: 'minor_guardian_consent_required',
  documentsBucket: 'family-documents',
  deepLinkScheme: 'buklod-family',
} as const;

export const BUKLOD_COMMERCIAL_INTEGRATION = {
  entitlementRpc: 'buklod_scope_commercial_entitlements_v1',
  exemptionRpc: 'buklod_scope_is_mzb_exempt_v1',
  billingOwnerKey: 'billing_owner_user_id',
  planIdKey: 'commercial_plan_id',
  costGuard: true,
  paymentProviderBoundary: 'external_checkout_only',
} as const;

export const BUKLOD_REPORT_INTEGRATION = {
  status: 'INTEGRATION_READY' as const,
  phase: 'PHASE_3_DEFINITIONS' as const,
  notificationEvents: BUKLOD_REPORT_NOTIFICATION_EVENTS,
  reminderPolicy: BUKLOD_REPORT_REMINDER_POLICY,
  deepLinkScheme: 'buklod-report',
  landingRoute: buklodReportLandingPath,
  definitionsRoute: buklodReportDefinitionsPath,
} as const;

export function getIntegrationApp(
  appId: BuklodIntegrationAppId
): BuklodIntegrationApp {
  return BUKLOD_INTEGRATION_APPS[appId];
}

export function integrationRoute(
  appId: BuklodIntegrationAppId,
  scopeId?: string
): string {
  const app = getIntegrationApp(appId);

  if (appId === 'report' && scopeId) {
    return buklodReportLandingPath(scopeId);
  }

  if (!scopeId) {
    return app.doorwayRoute;
  }

  const query = new URLSearchParams({ scope_id: scopeId });
  return `${app.doorwayRoute}?${query.toString()}`;
}

export function integrationAvailabilityLabel(
  availability: BuklodIntegrationAvailability
): string {
  switch (availability) {
    case 'AVAILABLE':
      return 'Available';
    case 'INTEGRATION_READY':
      return 'Integration ready';
    default:
      return 'Disabled';
  }
}
