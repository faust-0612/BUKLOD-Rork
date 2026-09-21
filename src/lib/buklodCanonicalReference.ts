import * as Clipboard from 'expo-clipboard';

import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import { supabase } from '@/lib/supabase';

export const BUKLOD_CANONICAL_DOCUMENT_KEY =
  'BUKLOD_CANONICAL_MASTER' as const;

export type CanonicalVersionStatus =
  | 'DRAFT'
  | 'REVIEW'
  | 'APPROVED'
  | 'EFFECTIVE'
  | 'SUPERSEDED';

export type CanonicalImplementationStatus =
  | 'DOC_ONLY'
  | 'PLANNED'
  | 'BUILDING'
  | 'VERIFIED'
  | 'LIVE';

export type CanonicalVerificationStatus =
  | 'MATCHED'
  | 'PENDING_IMPLEMENTATION'
  | 'CONFLICT_DETECTED'
  | 'VERIFICATION_REQUIRED';

export type CanonicalRiskLevel =
  | 'NORMAL'
  | 'HIGH'
  | 'FINANCIAL'
  | 'SECURITY'
  | 'PRIVACY';

export type CanonicalReferencePermissions = {
  can_view: boolean;
  can_draft: boolean;
  can_review: boolean;
  can_approve: boolean;
  can_publish: boolean;
  can_high_risk_publish: boolean;
  can_implementation: boolean;
};

export type CanonicalDocument = {
  id: string;
  document_key: string;
  title: string;
  status: string;
  metadata: Record<string, unknown>;
};

export type CanonicalVersion = {
  id: string;
  document_id: string;
  version: string;
  status: CanonicalVersionStatus;
  effective_at: string | null;
  supersedes_version_id: string | null;
  created_by: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  diff_reviewed_at: string | null;
  diff_reviewed_by: string | null;
  change_summary: string | null;
  affected_modules: string[];
  implementation_status: CanonicalImplementationStatus;
  implementation_ref: string | null;
  verification_status: CanonicalVerificationStatus;
  risk_level: CanonicalRiskLevel;
  notes: string | null;
  revision: number;
};

export type CanonicalSectionSummary = {
  section_key: string;
  title: string;
  sort_order: number;
  visibility_scope: string;
  tags: string[];
  revision: number;
  updated_at: string;
};

export type CanonicalSection = CanonicalSectionSummary & {
  id: string;
  version_id: string;
  content_markdown: string;
  updated_by: string | null;
  created_at: string;
};

export type CanonicalCurrentSnapshot = {
  document: CanonicalDocument;
  version: CanonicalVersion;
  sections: CanonicalSectionSummary[];
  permissions: CanonicalReferencePermissions;
};

export type CanonicalCompareRow = {
  section_key: string;
  title: string;
  sort_order: number;
  change_type: 'ADDED' | 'REMOVED' | 'CHANGED' | 'UNCHANGED';
  before_content: string | null;
  after_content: string | null;
};

export type CanonicalSearchResult = {
  version_id: string;
  version: string;
  version_status: CanonicalVersionStatus;
  implementation_status: CanonicalImplementationStatus;
  section_key: string;
  section_title: string;
  excerpt: string;
  sort_order: number;
};

const TIMEOUT = 12_000;

function rows<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export async function loadCanonicalCurrent() {
  const result = await withBuklodTimeout(
    (supabase as any).rpc('buklod_canonical_current_v1', {
      p_document_key: BUKLOD_CANONICAL_DOCUMENT_KEY,
    }),
    TIMEOUT,
    'Canonical Reference current version',
  );
  if (result.error) throw result.error;
  return result.data as CanonicalCurrentSnapshot;
}

export async function loadCanonicalHistory(
  limit = 20,
  offset = 0,
) {
  const result = await withBuklodTimeout(
    (supabase as any).rpc('buklod_canonical_history_v1', {
      p_document_key: BUKLOD_CANONICAL_DOCUMENT_KEY,
      p_limit: limit,
      p_offset: offset,
    }),
    TIMEOUT,
    'Canonical Reference history',
  );
  if (result.error) throw result.error;
  return rows<CanonicalVersion>(result.data);
}

export async function loadCanonicalSection(
  versionId: string,
  sectionKey: string,
) {
  const result = await withBuklodTimeout(
    (supabase as any).rpc('buklod_canonical_section_v1', {
      p_version_id: versionId,
      p_section_key: sectionKey,
    }),
    TIMEOUT,
    'Canonical Reference section',
  );
  if (result.error) throw result.error;
  return result.data as CanonicalSection;
}

export async function loadCanonicalSectionList(
  versionId: string,
) {
  const result = await withBuklodTimeout(
    (supabase as any)
      .from('buklod_canonical_sections')
      .select(
        'section_key,title,sort_order,visibility_scope,tags,revision,updated_at',
      )
      .eq('version_id', versionId)
      .order('sort_order', { ascending: true }),
    TIMEOUT,
    'Canonical Reference section list',
  );
  if (result.error) throw result.error;
  return rows<CanonicalSectionSummary>(result.data);
}

export async function createCanonicalDraft(input: {
  version: string;
  changeSummary: string;
  affectedModules: string[];
  riskLevel: CanonicalRiskLevel;
  notes?: string | null;
  sourceVersionId?: string | null;
  requestId: string;
}) {
  const result = await withBuklodTimeout(
    (supabase as any).rpc(
      'buklod_canonical_create_draft_v1',
      {
        p_document_key: BUKLOD_CANONICAL_DOCUMENT_KEY,
        p_version: input.version,
        p_change_summary: input.changeSummary,
        p_affected_modules: input.affectedModules,
        p_risk_level: input.riskLevel,
        p_notes: input.notes ?? null,
        p_source_version_id: input.sourceVersionId ?? null,
        p_request_id: input.requestId,
      },
    ),
    TIMEOUT,
    'Create Canonical Reference draft',
  );
  if (result.error) throw result.error;
  return String(result.data ?? '');
}

export async function saveCanonicalDraftSection(input: {
  versionId: string;
  sectionKey: string;
  title: string;
  contentMarkdown: string;
  expectedRevision: number;
  reason: string;
}) {
  const result = await withBuklodTimeout(
    (supabase as any).rpc(
      'buklod_canonical_save_section_v1',
      {
        p_version_id: input.versionId,
        p_section_key: input.sectionKey,
        p_title: input.title,
        p_content_markdown: input.contentMarkdown,
        p_expected_revision: input.expectedRevision,
        p_reason: input.reason,
      },
    ),
    TIMEOUT,
    'Save Canonical Reference section',
  );
  if (result.error) throw result.error;
  return result.data as CanonicalSection;
}

export async function updateCanonicalDraftMetadata(input: {
  versionId: string;
  changeSummary: string;
  affectedModules: string[];
  riskLevel: CanonicalRiskLevel;
  notes?: string | null;
  expectedRevision: number;
  reason: string;
}) {
  const result = await withBuklodTimeout(
    (supabase as any).rpc(
      'buklod_canonical_update_draft_metadata_v1',
      {
        p_version_id: input.versionId,
        p_change_summary: input.changeSummary,
        p_affected_modules: input.affectedModules,
        p_risk_level: input.riskLevel,
        p_notes: input.notes ?? null,
        p_expected_revision: input.expectedRevision,
        p_reason: input.reason,
      },
    ),
    TIMEOUT,
    'Update Canonical Reference draft metadata',
  );
  if (result.error) throw result.error;
  return result.data as CanonicalVersion;
}

export async function compareCanonicalVersions(
  beforeVersionId: string,
  afterVersionId: string,
) {
  const result = await withBuklodTimeout(
    (supabase as any).rpc(
      'buklod_canonical_compare_versions_v1',
      {
        p_before_version_id: beforeVersionId,
        p_after_version_id: afterVersionId,
      },
    ),
    TIMEOUT,
    'Compare Canonical Reference versions',
  );
  if (result.error) throw result.error;
  return rows<CanonicalCompareRow>(result.data);
}

export async function markCanonicalDiffReviewed(
  versionId: string,
  expectedRevision: number,
) {
  const result = await withBuklodTimeout(
    (supabase as any).rpc(
      'buklod_canonical_mark_diff_reviewed_v1',
      {
        p_version_id: versionId,
        p_expected_revision: expectedRevision,
      },
    ),
    TIMEOUT,
    'Record Canonical Reference diff review',
  );
  if (result.error) throw result.error;
  return result.data as CanonicalVersion;
}

export async function submitCanonicalReview(
  versionId: string,
  expectedRevision: number,
  reviewNotes?: string | null,
) {
  const result = await withBuklodTimeout(
    (supabase as any).rpc(
      'buklod_canonical_submit_review_v1',
      {
        p_version_id: versionId,
        p_expected_revision: expectedRevision,
        p_review_notes: reviewNotes ?? null,
      },
    ),
    TIMEOUT,
    'Submit Canonical Reference review',
  );
  if (result.error) throw result.error;
  return result.data as CanonicalVersion;
}

export async function decideCanonicalReview(input: {
  versionId: string;
  approve: boolean;
  expectedRevision: number;
  notes: string;
}) {
  const result = await withBuklodTimeout(
    (supabase as any).rpc(
      'buklod_canonical_review_decision_v1',
      {
        p_version_id: input.versionId,
        p_approve: input.approve,
        p_expected_revision: input.expectedRevision,
        p_notes: input.notes,
      },
    ),
    TIMEOUT,
    'Canonical Reference review decision',
  );
  if (result.error) throw result.error;
  return result.data as CanonicalVersion;
}

export async function publishCanonicalVersion(
  versionId: string,
  expectedRevision: number,
) {
  const result = await withBuklodTimeout(
    (supabase as any).rpc(
      'buklod_canonical_publish_v1',
      {
        p_version_id: versionId,
        p_expected_revision: expectedRevision,
      },
    ),
    TIMEOUT,
    'Publish Canonical Reference',
  );
  if (result.error) throw result.error;
  return result.data as CanonicalVersion;
}

export async function setCanonicalImplementation(input: {
  versionId: string;
  implementationStatus: CanonicalImplementationStatus;
  verificationStatus: CanonicalVerificationStatus;
  implementationRef?: string | null;
  expectedRevision: number;
  reason: string;
}) {
  const result = await withBuklodTimeout(
    (supabase as any).rpc(
      'buklod_canonical_set_implementation_v1',
      {
        p_version_id: input.versionId,
        p_implementation_status: input.implementationStatus,
        p_verification_status: input.verificationStatus,
        p_implementation_ref: input.implementationRef ?? null,
        p_expected_revision: input.expectedRevision,
        p_reason: input.reason,
      },
    ),
    TIMEOUT,
    'Update Canonical Reference implementation status',
  );
  if (result.error) throw result.error;
  return result.data as CanonicalVersion;
}

export async function searchCanonicalReference(
  query: string,
  includeHistory = false,
) {
  const result = await withBuklodTimeout(
    (supabase as any).rpc(
      'buklod_canonical_search_v1',
      {
        p_query: query,
        p_include_history: includeHistory,
        p_limit: 40,
      },
    ),
    TIMEOUT,
    'Search Canonical Reference',
  );
  if (result.error) throw result.error;
  return rows<CanonicalSearchResult>(result.data);
}

export async function exportCanonicalMarkdown(
  versionId?: string | null,
) {
  const result = await withBuklodTimeout(
    (supabase as any).rpc(
      'buklod_canonical_export_markdown_v1',
      {
        p_document_key: BUKLOD_CANONICAL_DOCUMENT_KEY,
        p_version_id: versionId ?? null,
      },
    ),
    TIMEOUT,
    'Export Canonical Reference',
  );
  if (result.error) throw result.error;
  return String(result.data ?? '');
}

export async function copyCanonicalMarkdown(
  versionId?: string | null,
) {
  const markdown = await exportCanonicalMarkdown(versionId);
  await Clipboard.setStringAsync(markdown);
  return markdown;
}

export async function copyCanonicalSection(input: {
  version: CanonicalVersion;
  section: CanonicalSection;
}) {
  const text = [
    '# COPY FOR IMPLEMENTATION',
    '',
    `Document: ${BUKLOD_CANONICAL_DOCUMENT_KEY}`,
    `Version: ${input.version.version}`,
    `Status: ${input.version.status}`,
    `Effective: ${input.version.effective_at ?? 'Not effective'}`,
    `Implementation: ${input.version.implementation_status}`,
    `Verification: ${input.version.verification_status}`,
    `Section: ${input.section.section_key}`,
    '',
    `## ${input.section.title}`,
    '',
    input.section.content_markdown,
  ].join('\n');

  await Clipboard.setStringAsync(text);
  return text;
}

export function canonicalRiskNeedsDiff(
  risk: CanonicalRiskLevel,
) {
  return [
    'HIGH',
    'FINANCIAL',
    'SECURITY',
    'PRIVACY',
  ].includes(risk);
}

export function canonicalRiskNeedsElevatedPublish(
  risk: CanonicalRiskLevel,
) {
  return [
    'FINANCIAL',
    'SECURITY',
    'PRIVACY',
  ].includes(risk);
}
