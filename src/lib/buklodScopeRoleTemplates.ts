/**
 * Suggested functional role labels by scope context.
 * Admins may add custom roles; these are seed suggestions only.
 */

export type ScopeRoleTemplateGroup =
  | 'CHURCH'
  | 'BUSINESS'
  | 'EDUCATION'
  | 'GOVERNMENT'
  | 'GENERAL';

export const FUNCTIONAL_ROLE_TEMPLATES: Record<
  ScopeRoleTemplateGroup,
  string[]
> = {
  CHURCH: [
    'Head Pastor',
    'Pastor',
    'Associate Pastor',
    'Assistant Pastor',
    'Mentor',
    'Missionary',
    'Deacon',
    'Ministry Leader',
    'Worker',
    'Treasurer',
    'Secretary',
    'Member',
  ],
  BUSINESS: [
    'Owner',
    'Manager',
    'HR',
    'Finance',
    'Operations',
    'Supervisor',
    'Staff',
  ],
  EDUCATION: [
    'Administrator',
    'Faculty',
    'Teacher',
    'Registrar',
    'Coordinator',
    'Staff',
    'Student',
  ],
  GOVERNMENT: [
    'Chairperson',
    'Secretary',
    'Treasurer',
    'Council Member',
    'Department Head',
    'Staff',
  ],
  GENERAL: ['Member', 'Staff', 'Coordinator', 'Officer'],
};

export function inferScopeRoleTemplateGroup(input: {
  scope_type?: string | null;
  geo_level?: string | null;
  metadata?: Record<string, unknown> | null;
}): ScopeRoleTemplateGroup {
  const meta = input.metadata ?? {};
  const orgType = String(
    meta.organization_type ??
      meta.org_type ??
      meta.industry ??
      ''
  )
    .trim()
    .toUpperCase();

  if (
    orgType.includes('BUSINESS') ||
    orgType.includes('COMPANY') ||
    orgType.includes('CORP')
  ) {
    return 'BUSINESS';
  }

  if (
    orgType.includes('SCHOOL') ||
    orgType.includes('EDUCATION') ||
    orgType.includes('FACULTY')
  ) {
    return 'EDUCATION';
  }

  if (
    orgType.includes('GOVERNMENT') ||
    orgType.includes('BARANGAY') ||
    orgType.includes('MUNICIPAL')
  ) {
    return 'GOVERNMENT';
  }

  const scopeType = String(input.scope_type ?? '')
    .trim()
    .toUpperCase();

  if (
    scopeType === 'CHURCH' ||
    orgType.includes('CHURCH') ||
    orgType.includes('MINISTRY')
  ) {
    return 'CHURCH';
  }

  if (scopeType === 'CLUSTER') {
    return 'GENERAL';
  }

  return 'CHURCH';
}
