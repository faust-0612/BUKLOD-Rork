import type { BuklodScope } from '@/lib/buklodScope';

export type BuklodInstitutionPreset =
  | 'SCHOOL'
  | 'BUSINESS'
  | 'CHURCH'
  | 'NGO'
  | 'TRAINING_CENTER'
  | 'ASSOCIATION'
  | 'COMMUNITY'
  | 'OTHER';

export type BuklodOrganizationModuleId =
  | 'overview'
  | 'community'
  | 'connect'
  | 'announcements'
  | 'members'
  | 'units'
  | 'events'
  | 'reports'
  | 'classroom'
  | 'quiz'
  | 'files'
  | 'calendar'
  | 'help'
  | 'manage';

export type BuklodOrganizationModuleGroup =
  | 'OVERVIEW'
  | 'COMMUNICATE'
  | 'PEOPLE'
  | 'WORK'
  | 'ORGANIZE'
  | 'SUPPORT'
  | 'ADMIN';

export type BuklodModuleAuthority =
  | 'SCOPE_MEMBER'
  | 'SCOPE_ADMIN'
  | 'REPORT_AUTHORITY'
  | 'CLASSROOM_AUTHORITY'
  | 'QUIZ_AUTHORITY'
  | 'OFFICE_AUTHORITY';

export type BuklodOrganizationModuleDefinition = {
  id: BuklodOrganizationModuleId;
  displayName: string;
  group: BuklodOrganizationModuleGroup;
  icon: string;
  permission: string;
  authority: BuklodModuleAuthority;
  availability: 'CORE' | 'STANDALONE' | 'AGGREGATOR';
  defaultEnabled: boolean;
  adminOnly?: boolean;
};

export type BuklodInstitutionTerminology = {
  organization: string;
  unit: string;
  members: string;
  member: string;
  classroom: string;
  quiz: string;
};

export type BuklodInstitutionWorkspaceConfig = {
  version: 'INSTITUTION_WORKSPACE_V1';
  preset: BuklodInstitutionPreset;
  lifecycle:
    | 'DRAFT'
    | 'PILOT'
    | 'ACTIVE'
    | 'RESTRICTED'
    | 'READ_ONLY'
    | 'ARCHIVED'
    | 'CLOSED';
  enabledModules: Partial<Record<BuklodOrganizationModuleId, boolean>>;
  terminology: BuklodInstitutionTerminology;
  defaultLandingModule: BuklodOrganizationModuleId;
  recommendedLanguage?: string | null;
};

export const BUKLOD_ORGANIZATION_MODULE_REGISTRY: readonly BuklodOrganizationModuleDefinition[] = [
  {
    id: 'overview',
    displayName: 'Overview',
    group: 'OVERVIEW',
    icon: 'view-dashboard-outline',
    permission: 'organization.workspace.open',
    authority: 'SCOPE_MEMBER',
    availability: 'CORE',
    defaultEnabled: true,
  },
  {
    id: 'community',
    displayName: 'Community',
    group: 'COMMUNICATE',
    icon: 'account-group-outline',
    permission: 'organization.community.open',
    authority: 'SCOPE_MEMBER',
    availability: 'CORE',
    defaultEnabled: true,
  },
  {
    id: 'connect',
    displayName: 'Connect',
    group: 'COMMUNICATE',
    icon: 'message-text-outline',
    permission: 'organization.connect.open',
    authority: 'SCOPE_MEMBER',
    availability: 'CORE',
    defaultEnabled: true,
  },
  {
    id: 'announcements',
    displayName: 'Announcements',
    group: 'COMMUNICATE',
    icon: 'bullhorn-outline',
    permission: 'organization.announcements.view',
    authority: 'SCOPE_MEMBER',
    availability: 'CORE',
    defaultEnabled: true,
  },
  {
    id: 'members',
    displayName: 'Members',
    group: 'PEOPLE',
    icon: 'account-multiple-outline',
    permission: 'organization.members.manage',
    authority: 'SCOPE_ADMIN',
    availability: 'CORE',
    defaultEnabled: true,
    adminOnly: true,
  },
  {
    id: 'units',
    displayName: 'Units',
    group: 'PEOPLE',
    icon: 'sitemap-outline',
    permission: 'suborg.manage',
    authority: 'SCOPE_ADMIN',
    availability: 'CORE',
    defaultEnabled: true,
    adminOnly: true,
  },
  {
    id: 'reports',
    displayName: 'Reports',
    group: 'WORK',
    icon: 'file-chart-outline',
    permission: 'reports.view',
    authority: 'REPORT_AUTHORITY',
    availability: 'STANDALONE',
    defaultEnabled: true,
  },
  {
    id: 'classroom',
    displayName: 'Classroom',
    group: 'WORK',
    icon: 'school-outline',
    permission: 'classroom.open',
    authority: 'CLASSROOM_AUTHORITY',
    availability: 'STANDALONE',
    defaultEnabled: false,
  },
  {
    id: 'quiz',
    displayName: 'Quiz / Assessment',
    group: 'WORK',
    icon: 'clipboard-text-outline',
    permission: 'quiz.open',
    authority: 'QUIZ_AUTHORITY',
    availability: 'STANDALONE',
    defaultEnabled: false,
  },
  {
    id: 'events',
    displayName: 'Events',
    group: 'ORGANIZE',
    icon: 'calendar-star',
    permission: 'events.view',
    authority: 'SCOPE_MEMBER',
    availability: 'CORE',
    defaultEnabled: true,
  },
  {
    id: 'calendar',
    displayName: 'Calendar',
    group: 'ORGANIZE',
    icon: 'calendar-month-outline',
    permission: 'organization.calendar.view',
    authority: 'SCOPE_MEMBER',
    availability: 'AGGREGATOR',
    defaultEnabled: true,
  },
  {
    id: 'files',
    displayName: 'Files',
    group: 'ORGANIZE',
    icon: 'folder-outline',
    permission: 'files.view',
    authority: 'OFFICE_AUTHORITY',
    availability: 'CORE',
    defaultEnabled: true,
  },
  {
    id: 'help',
    displayName: 'Help',
    group: 'SUPPORT',
    icon: 'lifebuoy',
    permission: 'organization.help.open',
    authority: 'SCOPE_MEMBER',
    availability: 'CORE',
    defaultEnabled: true,
  },
  {
    id: 'manage',
    displayName: 'Manage',
    group: 'ADMIN',
    icon: 'cog-outline',
    permission: 'organization.manage',
    authority: 'SCOPE_ADMIN',
    availability: 'CORE',
    defaultEnabled: true,
    adminOnly: true,
  },
] as const;

const GROUP_ORDER: BuklodOrganizationModuleGroup[] = [
  'OVERVIEW',
  'COMMUNICATE',
  'PEOPLE',
  'WORK',
  'ORGANIZE',
  'SUPPORT',
  'ADMIN',
];

const PRESET_DEFAULTS: Record<
  BuklodInstitutionPreset,
  {
    enabled: BuklodOrganizationModuleId[];
    terminology: BuklodInstitutionTerminology;
  }
> = {
  SCHOOL: {
    enabled: [
      'overview',
      'community',
      'connect',
      'announcements',
      'members',
      'units',
      'events',
      'reports',
      'classroom',
      'quiz',
      'files',
      'calendar',
      'help',
      'manage',
    ],
    terminology: {
      organization: 'School',
      unit: 'Department / Campus / Program',
      members: 'Students / Faculty / Staff',
      member: 'Member',
      classroom: 'Classroom',
      quiz: 'Quiz / Assessment',
    },
  },
  TRAINING_CENTER: {
    enabled: [
      'overview',
      'community',
      'connect',
      'announcements',
      'members',
      'units',
      'events',
      'reports',
      'classroom',
      'quiz',
      'files',
      'calendar',
      'help',
      'manage',
    ],
    terminology: {
      organization: 'Training Center',
      unit: 'Program / Batch / Department',
      members: 'Learners / Trainers / Staff',
      member: 'Member',
      classroom: 'Classroom',
      quiz: 'Assessment',
    },
  },
  BUSINESS: {
    enabled: [
      'overview',
      'community',
      'connect',
      'announcements',
      'members',
      'units',
      'events',
      'reports',
      'files',
      'calendar',
      'help',
      'manage',
    ],
    terminology: {
      organization: 'Company',
      unit: 'Department / Team / Branch',
      members: 'Employees / Staff',
      member: 'Staff',
      classroom: 'Training',
      quiz: 'Assessment',
    },
  },
  CHURCH: {
    enabled: [
      'overview',
      'community',
      'connect',
      'announcements',
      'members',
      'units',
      'events',
      'reports',
      'files',
      'calendar',
      'help',
      'manage',
    ],
    terminology: {
      organization: 'Organization',
      unit: 'Ministry / Local Church / Outreach',
      members: 'Members / Workers',
      member: 'Member',
      classroom: 'Classroom',
      quiz: 'Assessment',
    },
  },
  NGO: {
    enabled: [
      'overview',
      'community',
      'connect',
      'announcements',
      'members',
      'units',
      'events',
      'reports',
      'files',
      'calendar',
      'help',
      'manage',
    ],
    terminology: {
      organization: 'Organization',
      unit: 'Program / Chapter / Team',
      members: 'Members / Staff / Volunteers',
      member: 'Member',
      classroom: 'Training',
      quiz: 'Assessment',
    },
  },
  ASSOCIATION: {
    enabled: [
      'overview',
      'community',
      'connect',
      'announcements',
      'members',
      'units',
      'events',
      'reports',
      'files',
      'calendar',
      'help',
      'manage',
    ],
    terminology: {
      organization: 'Association',
      unit: 'Chapter / Committee / Team',
      members: 'Members / Officers',
      member: 'Member',
      classroom: 'Training',
      quiz: 'Assessment',
    },
  },
  COMMUNITY: {
    enabled: [
      'overview',
      'community',
      'connect',
      'announcements',
      'members',
      'units',
      'events',
      'reports',
      'files',
      'calendar',
      'help',
      'manage',
    ],
    terminology: {
      organization: 'Community Organization',
      unit: 'Chapter / Program / Team',
      members: 'Members',
      member: 'Member',
      classroom: 'Classroom',
      quiz: 'Assessment',
    },
  },
  OTHER: {
    enabled: BUKLOD_ORGANIZATION_MODULE_REGISTRY.map(item => item.id).filter(
      id => id !== 'classroom' && id !== 'quiz',
    ),
    terminology: {
      organization: 'Organization',
      unit: 'Unit / Department',
      members: 'Members',
      member: 'Member',
      classroom: 'Classroom',
      quiz: 'Assessment',
    },
  },
};

function upper(value: unknown) {
  return String(value ?? '').trim().toUpperCase();
}

export function inferInstitutionPreset(
  metadata?: Record<string, unknown> | null,
): BuklodInstitutionPreset {
  const meta = metadata ?? {};
  const type = upper(
    meta.organization_type ??
      meta.org_type ??
      meta.custom_type ??
      '',
  );
  const institutionLevel = upper(meta.institution_level);

  if (
    institutionLevel.includes('TRAINING') ||
    type.includes('TRAINING')
  ) {
    return 'TRAINING_CENTER';
  }
  if (type.includes('SCHOOL') || type.includes('EDUCATION')) {
    return 'SCHOOL';
  }
  if (
    type.includes('BUSINESS') ||
    type.includes('COMPANY') ||
    type.includes('CORP')
  ) {
    return 'BUSINESS';
  }
  if (type.includes('CHURCH') || type.includes('MINISTRY') || type.includes('FAITH')) {
    return 'CHURCH';
  }
  if (type.includes('NGO') || type.includes('FOUNDATION')) {
    return 'NGO';
  }
  if (
    type.includes('ASSOCIATION') ||
    type.includes('COOPERATIVE') ||
    type.includes('PROFESSIONAL')
  ) {
    return 'ASSOCIATION';
  }
  if (type.includes('COMMUNITY') || type.includes('CIVIC')) {
    return 'COMMUNITY';
  }
  return 'OTHER';
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function defaultInstitutionWorkspaceConfig(
  preset: BuklodInstitutionPreset,
): BuklodInstitutionWorkspaceConfig {
  const defaults = PRESET_DEFAULTS[preset];
  return {
    version: 'INSTITUTION_WORKSPACE_V1',
    preset,
    lifecycle: 'ACTIVE',
    enabledModules: Object.fromEntries(
      BUKLOD_ORGANIZATION_MODULE_REGISTRY.map(module => [
        module.id,
        defaults.enabled.includes(module.id),
      ]),
    ) as Partial<Record<BuklodOrganizationModuleId, boolean>>,
    terminology: { ...defaults.terminology },
    defaultLandingModule: 'overview',
    recommendedLanguage: null,
  };
}

export function readInstitutionWorkspaceConfig(
  metadata?: Record<string, unknown> | null,
): BuklodInstitutionWorkspaceConfig {
  const meta = metadata ?? {};
  const raw = objectValue(
    meta.institution_workspace ??
      meta.institutional_workspace,
  );
  const preset =
    (upper(raw.preset) as BuklodInstitutionPreset) ||
    inferInstitutionPreset(meta);
  const safePreset: BuklodInstitutionPreset =
    preset in PRESET_DEFAULTS ? preset : inferInstitutionPreset(meta);
  const defaults = defaultInstitutionWorkspaceConfig(safePreset);
  const enabledRaw = objectValue(
    raw.enabled_modules ??
      raw.enabledModules ??
      raw.modules,
  );
  const terminologyRaw = objectValue(raw.terminology);

  const enabledModules = {
    ...defaults.enabledModules,
  };

  for (const module of BUKLOD_ORGANIZATION_MODULE_REGISTRY) {
    const value = enabledRaw[module.id];
    if (typeof value === 'boolean') {
      enabledModules[module.id] = value;
    }
  }

  // Overview and Help are recovery-safe anchors and cannot be hidden.
  enabledModules.overview = true;
  enabledModules.help = true;

  const landingCandidate = String(
    raw.default_landing_module ??
      raw.defaultLandingModule ??
      defaults.defaultLandingModule,
  ) as BuklodOrganizationModuleId;

  const defaultLandingModule =
    BUKLOD_ORGANIZATION_MODULE_REGISTRY.some(
      item =>
        item.id === landingCandidate &&
        enabledModules[item.id] !== false,
    )
      ? landingCandidate
      : 'overview';

  const lifecycleText = upper(raw.lifecycle);
  const lifecycle =
    [
      'DRAFT',
      'PILOT',
      'ACTIVE',
      'RESTRICTED',
      'READ_ONLY',
      'ARCHIVED',
      'CLOSED',
    ].includes(lifecycleText)
      ? (lifecycleText as BuklodInstitutionWorkspaceConfig['lifecycle'])
      : defaults.lifecycle;

  return {
    ...defaults,
    preset: safePreset,
    lifecycle,
    enabledModules,
    terminology: {
      organization:
        String(
          terminologyRaw.organization ??
            defaults.terminology.organization,
        ).trim() || defaults.terminology.organization,
      unit:
        String(
          terminologyRaw.unit ??
            defaults.terminology.unit,
        ).trim() || defaults.terminology.unit,
      members:
        String(
          terminologyRaw.members ??
            defaults.terminology.members,
        ).trim() || defaults.terminology.members,
      member:
        String(
          terminologyRaw.member ??
            defaults.terminology.member,
        ).trim() || defaults.terminology.member,
      classroom:
        String(
          terminologyRaw.classroom ??
            defaults.terminology.classroom,
        ).trim() || defaults.terminology.classroom,
      quiz:
        String(
          terminologyRaw.quiz ??
            defaults.terminology.quiz,
        ).trim() || defaults.terminology.quiz,
    },
    defaultLandingModule,
    recommendedLanguage:
      typeof raw.recommended_language === 'string'
        ? raw.recommended_language
        : typeof raw.recommendedLanguage === 'string'
          ? raw.recommendedLanguage
          : null,
  };
}

export function writeInstitutionWorkspaceConfig(
  metadata: Record<string, unknown> | null | undefined,
  config: BuklodInstitutionWorkspaceConfig,
): Record<string, unknown> {
  return {
    ...(metadata ?? {}),
    institution_workspace: {
      version: config.version,
      preset: config.preset,
      lifecycle: config.lifecycle,
      enabled_modules: config.enabledModules,
      terminology: config.terminology,
      default_landing_module: config.defaultLandingModule,
      recommended_language: config.recommendedLanguage ?? null,
    },
  };
}

export function institutionModuleLabel(
  config: BuklodInstitutionWorkspaceConfig,
  moduleId: BuklodOrganizationModuleId,
) {
  if (moduleId === 'members') return config.terminology.members;
  if (moduleId === 'units') return config.terminology.unit;
  if (moduleId === 'classroom') return config.terminology.classroom;
  if (moduleId === 'quiz') return config.terminology.quiz;

  return (
    BUKLOD_ORGANIZATION_MODULE_REGISTRY.find(
      module => module.id === moduleId,
    )?.displayName ??
    moduleId
  );
}

export function institutionModuleEnabled(
  config: BuklodInstitutionWorkspaceConfig,
  moduleId: BuklodOrganizationModuleId,
) {
  if (moduleId === 'overview' || moduleId === 'help') {
    return true;
  }
  return config.enabledModules[moduleId] !== false;
}

export function visibleInstitutionModules(input: {
  config: BuklodInstitutionWorkspaceConfig;
  isAdmin: boolean;
}) {
  return BUKLOD_ORGANIZATION_MODULE_REGISTRY
    .filter(
      module =>
        institutionModuleEnabled(input.config, module.id) &&
        (!module.adminOnly || input.isAdmin),
    )
    .sort(
      (a, b) =>
        GROUP_ORDER.indexOf(a.group) -
          GROUP_ORDER.indexOf(b.group) ||
        BUKLOD_ORGANIZATION_MODULE_REGISTRY.findIndex(x => x.id === a.id) -
          BUKLOD_ORGANIZATION_MODULE_REGISTRY.findIndex(x => x.id === b.id),
    );
}

export function groupedInstitutionModules(input: {
  config: BuklodInstitutionWorkspaceConfig;
  isAdmin: boolean;
}) {
  const modules = visibleInstitutionModules(input);
  return GROUP_ORDER
    .map(group => ({
      group,
      modules: modules.filter(module => module.group === group),
    }))
    .filter(item => item.modules.length > 0);
}

export function institutionalWorkspaceMetadata(
  scope: Pick<BuklodScope, 'scope_id' | 'name' | 'scope_type' | 'parent_scope_id'> & {
    metadata?: Record<string, unknown> | null;
  },
) {
  const config = readInstitutionWorkspaceConfig(scope.metadata);
  return {
    scopeId: scope.scope_id,
    scopeName: scope.name,
    isSuborganization: Boolean(scope.parent_scope_id),
    config,
  };
}
