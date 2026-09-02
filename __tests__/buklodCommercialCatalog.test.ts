import {
  BUKLOD_COMMERCIAL_PRODUCTS,
  BUKLOD_ORGANIZATION_TYPE_CHURCH,
  isChurchOrganizationType,
  isOrgSubscriptionGatedFocusApp,
  productForLessonStage,
} from '@/lib/buklodCommercialCatalog';
import { resolveOrganizationIdFromScope } from '@/lib/buklodOrganizationFocusApps';
import { formatBuklodAddressQuery } from '@/lib/buklodGeocode';

describe('BUKLOD commercial catalog', () => {
  it('keeps Cluster lesson packages as three separate products', () => {
    expect(BUKLOD_COMMERCIAL_PRODUCTS.cluster_lessons_ccp.amountPhp).toBe(49);
    expect(BUKLOD_COMMERCIAL_PRODUCTS.cluster_lessons_discipleship.amountPhp).toBe(59);
    expect(BUKLOD_COMMERCIAL_PRODUCTS.cluster_lessons_mentoring.amountPhp).toBe(69);
    expect(BUKLOD_COMMERCIAL_PRODUCTS.cluster_premium.amountPhp).toBe(49);
    expect(BUKLOD_COMMERCIAL_PRODUCTS.organization_focus_apps_annual.amountPhp).toBe(499);
    expect(BUKLOD_COMMERCIAL_PRODUCTS.organization_focus_apps_monthly.amountPhp).toBe(59);
  });

  it('maps 101-103 to CCP, 104-105 to Discipleship, 106-107 to Mentoring', () => {
    expect(productForLessonStage(101)?.code).toBe('cluster_lessons_ccp');
    expect(productForLessonStage(103)?.code).toBe('cluster_lessons_ccp');
    expect(productForLessonStage(104)?.code).toBe('cluster_lessons_discipleship');
    expect(productForLessonStage(105)?.code).toBe('cluster_lessons_discipleship');
    expect(productForLessonStage(106)?.code).toBe('cluster_lessons_mentoring');
    expect(productForLessonStage(107)?.code).toBe('cluster_lessons_mentoring');
    expect(productForLessonStage(108)).toBeNull();
  });

  it('does not let CCP purchase imply later stages', () => {
    expect(BUKLOD_COMMERCIAL_PRODUCTS.cluster_lessons_ccp.lessonStages).toEqual([
      101, 102, 103,
    ]);
    expect(
      BUKLOD_COMMERCIAL_PRODUCTS.cluster_lessons_ccp.lessonStages,
    ).not.toEqual(expect.arrayContaining([104, 105, 106, 107]));
  });

  it('does not advertise the retired ₱249/year Focus Apps price', () => {
    expect(
      BUKLOD_COMMERCIAL_PRODUCTS.organization_focus_apps_annual.shortLabel,
    ).not.toContain('249');
    expect(
      BUKLOD_COMMERCIAL_PRODUCTS.organization_focus_apps_monthly.shortLabel,
    ).toContain('59');
  });

  it('gates Organization Focus App portals but not Attendance, Giving, or org admin', () => {
    expect(isOrgSubscriptionGatedFocusApp('faculty')).toBe(true);
    expect(isOrgSubscriptionGatedFocusApp('business')).toBe(true);
    expect(isOrgSubscriptionGatedFocusApp('attendance')).toBe(false);
    expect(isOrgSubscriptionGatedFocusApp('giving')).toBe(false);
    expect(isOrgSubscriptionGatedFocusApp('organization')).toBe(false);
  });

  it('treats Church as an Organization type, not a ministry alias', () => {
    expect(isChurchOrganizationType(BUKLOD_ORGANIZATION_TYPE_CHURCH)).toBe(true);
    expect(isChurchOrganizationType('MINISTRY_FAITH')).toBe(false);
    expect(isChurchOrganizationType('NGO_FOUNDATION')).toBe(false);
  });

  it('resolves Organization id from Cluster parent without leaking another Cluster', () => {
    expect(
      resolveOrganizationIdFromScope({
        scope_id: 'cluster-a',
        scope_type: 'CLUSTER',
        parent_scope_id: 'org-a',
      }),
    ).toBe('org-a');
    expect(
      resolveOrganizationIdFromScope({
        scope_id: 'org-a',
        scope_type: 'ORGANIZATION',
      }),
    ).toBe('org-a');
  });

  it('builds a geocode query from structured church address parts', () => {
    expect(
      formatBuklodAddressQuery({
        addressLine: 'Poblacion',
        barangay: 'Sta. Ines',
        cityMunicipality: 'Tanay',
        province: 'Rizal',
      }),
    ).toContain('Tanay');
  });
});
