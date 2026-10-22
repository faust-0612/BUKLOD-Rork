import { supabase } from '@/lib/supabase';

export type ChurchVisibility =
  | 'PUBLIC'
  | 'PRIVATE'
  | 'INVITE_ONLY';

export type ChurchSummary = {
  scope_id: string;
  name: string;
  description: string | null;
  denomination: string | null;
  senior_pastor_name: string | null;
  barangay: string | null;
  city_municipality: string | null;
  province: string | null;
  country: string | null;
  visibility: ChurchVisibility;
  scope_status?: string;
  membership_status: string | null;
  membership_source?: string | null;
  is_admin?: boolean;
  member_count: number;
  verification_status?: string | null;
  website?: string | null;
};

export type ChurchVerification = {
  request_id: string;
  denomination: string | null;
  senior_pastor_name: string | null;
  contact_email: string | null;
  contact_mobile: string | null;
  website: string | null;
  address_line: string | null;
  barangay: string | null;
  city_municipality: string | null;
  province: string | null;
  country: string | null;
  authority_role: string;
  proof_reference: string | null;
  submit_note: string | null;
  review_status: string;
  review_note: string | null;
  submitted_at: string;
  reviewed_at: string | null;
};

export type ChurchMember = {
  user_id: string;
  full_name: string;
  is_admin: boolean;
  joined_at: string | null;
};

export type ChurchRequest = {
  user_id: string;
  full_name: string;
  requested_at: string | null;
};

export type ChurchCandidate = {
  user_id: string;
  full_name: string;
};

export type PendingChurchVerification = {
  request_id: string;
  church_scope_id: string;
  church_name: string;
  submitted_by: string;
  submitter_name: string;
  denomination: string | null;
  senior_pastor_name: string | null;
  contact_email: string | null;
  contact_mobile: string | null;
  website: string | null;
  address_line: string | null;
  barangay: string | null;
  city_municipality: string | null;
  province: string | null;
  country: string;
  authority_role: string;
  proof_reference: string | null;
  submit_note: string | null;
  submitted_at: string;
};

function asRows<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data == null) return [];
  return [data as T];
}

async function rpc<T>(
  name: string,
  args: Record<string, unknown> = {}
): Promise<T> {
  const { data, error } = await (supabase as any).rpc(
    name,
    args
  );

  if (error) throw error;
  return data as T;
}

export async function myChurches() {
  return asRows<ChurchSummary>(
    await rpc('buklod_my_churches')
  );
}

export async function discoverChurches(query = '') {
  return asRows<ChurchSummary>(
    await rpc('buklod_discover_churches', {
      _query: query.trim() || null,
      _limit: 60,
    })
  );
}

export async function churchDetails(scopeId: string) {
  return asRows<ChurchSummary>(
    await rpc('buklod_church_details', {
      _scope_id: scopeId,
    })
  )[0] ?? null;
}

export async function createChurch(input: {
  name: string;
  description?: string;
  denomination?: string;
  seniorPastorName?: string;
  contactEmail?: string;
  contactMobile?: string;
  website?: string;
  addressLine?: string;
  barangay?: string;
  cityMunicipality: string;
  province: string;
  country: string;
  authorityRole: string;
  authorityConfirmed: boolean;
  proofReference?: string;
  submitNote?: string;
}) {
  return String(
    await rpc('buklod_create_church', {
      _name: input.name.trim(),
      _description: input.description?.trim() || null,
      _denomination: input.denomination?.trim() || null,
      _senior_pastor_name:
        input.seniorPastorName?.trim() || null,
      _contact_email:
        input.contactEmail?.trim() || null,
      _contact_mobile:
        input.contactMobile?.trim() || null,
      _website: input.website?.trim() || null,
      _address_line:
        input.addressLine?.trim() || null,
      _barangay: input.barangay?.trim() || null,
      _city_municipality:
        input.cityMunicipality.trim(),
      _province: input.province.trim(),
      _country: input.country.trim(),
      _authority_role: input.authorityRole.trim(),
      _authority_confirmed:
        input.authorityConfirmed,
      _proof_reference:
        input.proofReference?.trim() || null,
      _submit_note:
        input.submitNote?.trim() || null,
    })
  );
}

export async function joinChurch(scopeId: string) {
  return String(
    await rpc('buklod_join_church', {
      _scope_id: scopeId,
    })
  );
}

export async function respondChurchInvite(
  scopeId: string,
  accept: boolean
) {
  await rpc('buklod_respond_church_invite', {
    _scope_id: scopeId,
    _accept: accept,
  });
}

export async function leaveChurch(scopeId: string) {
  await rpc('buklod_leave_church', {
    _scope_id: scopeId,
  });
}

export async function getChurchVerification(
  scopeId: string
) {
  return asRows<ChurchVerification>(
    await rpc('buklod_my_church_verification', {
      _scope_id: scopeId,
    })
  )[0] ?? null;
}

export async function resubmitChurchVerification(
  scopeId: string,
  note = ''
) {
  return rpc('buklod_resubmit_church_verification', {
    _scope_id: scopeId,
    _submit_note: note.trim() || null,
  });
}

export async function churchRequests(scopeId: string) {
  return asRows<ChurchRequest>(
    await rpc('buklod_church_pending_requests', {
      _scope_id: scopeId,
    })
  );
}

export async function reviewChurchRequest(
  scopeId: string,
  userId: string,
  approve: boolean
) {
  await rpc('buklod_review_church_request', {
    _scope_id: scopeId,
    _user_id: userId,
    _approve: approve,
  });
}

export async function churchMembers(scopeId: string) {
  return asRows<ChurchMember>(
    await rpc('buklod_church_members', {
      _scope_id: scopeId,
    })
  );
}

export async function churchInviteCandidates(
  scopeId: string,
  query = ''
) {
  return asRows<ChurchCandidate>(
    await rpc(
      'buklod_search_church_invite_candidates',
      {
        _scope_id: scopeId,
        _query: query.trim() || null,
        _limit: 30,
      }
    )
  );
}

export async function inviteChurchMember(
  scopeId: string,
  userId: string
) {
  await rpc('buklod_invite_church_member', {
    _scope_id: scopeId,
    _user_id: userId,
  });
}

export async function removeChurchMember(
  scopeId: string,
  userId: string
) {
  await rpc('buklod_remove_church_member', {
    _scope_id: scopeId,
    _user_id: userId,
  });
}

export async function transferChurchAdmin(
  scopeId: string,
  userId: string
) {
  await rpc('buklod_transfer_church_admin', {
    _scope_id: scopeId,
    _new_admin_user_id: userId,
  });
}

export async function updateChurch(
  scopeId: string,
  input: {
    name: string;
    description?: string;
    visibility: ChurchVisibility;
  }
) {
  await rpc('buklod_update_church', {
    _scope_id: scopeId,
    _name: input.name.trim(),
    _description: input.description?.trim() || null,
    _visibility: input.visibility,
  });
}

export async function pendingChurchVerifications() {
  return asRows<PendingChurchVerification>(
    await rpc('buklod_pending_church_verifications')
  );
}

export async function reviewChurchVerification(
  requestId: string,
  approve: boolean,
  note = ''
) {
  await rpc('buklod_review_church_verification', {
    _request_id: requestId,
    _approve: approve,
    _review_note: note.trim() || null,
  });
}
