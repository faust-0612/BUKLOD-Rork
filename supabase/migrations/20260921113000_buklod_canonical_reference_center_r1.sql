-- BUKLOD CANONICAL REFERENCE CENTER R1
-- Governance source of truth only. This migration does NOT alter runtime financial,
-- settlement, entitlement, RLS, ad, referral, Community Fund, or security behavior.

begin;

insert into public.buklod_foundation_permissions(permission_key,description,risk_level,is_active)
values
  ('canonical.reference.view','View permitted internal BUKLOD Canonical Reference content and history metadata.','MEDIUM',true),
  ('canonical.reference.restricted_view','View restricted internal financial/security/privacy Canonical Reference sections.','HIGH',true),
  ('canonical.reference.draft','Create and edit Canonical Reference drafts.','HIGH',true),
  ('canonical.reference.review','Submit/reject Canonical Reference reviews.','HIGH',true),
  ('canonical.reference.approve','Approve Canonical Reference versions.','HIGH',true),
  ('canonical.reference.publish','Publish normal-risk Canonical Reference versions.','HIGH',true),
  ('canonical.reference.high_risk_publish','Publish FINANCIAL, SECURITY, or PRIVACY Canonical Reference versions.','HIGH',true),
  ('canonical.reference.implementation','Update implementation linkage/status without rewriting published content.','HIGH',true)
on conflict(permission_key) do update
set description=excluded.description,
    risk_level=excluded.risk_level,
    is_active=true;

create table if not exists public.buklod_canonical_documents(
  id uuid primary key default gen_random_uuid(),
  document_key text not null unique,
  title text not null,
  current_effective_version_id uuid null,
  status text not null default 'ACTIVE'
    check(status in('ACTIVE','ARCHIVED')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.buklod_canonical_document_versions(
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.buklod_canonical_documents(id) on delete restrict,
  version text not null,
  status text not null
    check(status in('DRAFT','REVIEW','APPROVED','EFFECTIVE','SUPERSEDED')),
  effective_at timestamptz null,
  supersedes_version_id uuid null references public.buklod_canonical_document_versions(id) on delete restrict,
  created_by uuid null references auth.users(id) on delete set null,
  approved_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz null,
  diff_reviewed_at timestamptz null,
  diff_reviewed_by uuid null references auth.users(id) on delete set null,
  change_summary text null,
  affected_modules text[] not null default '{}',
  implementation_status text not null default 'DOC_ONLY'
    check(implementation_status in('DOC_ONLY','PLANNED','BUILDING','VERIFIED','LIVE')),
  implementation_ref text null,
  verification_status text not null default 'VERIFICATION_REQUIRED'
    check(verification_status in('MATCHED','PENDING_IMPLEMENTATION','CONFLICT_DETECTED','VERIFICATION_REQUIRED')),
  risk_level text not null default 'NORMAL'
    check(risk_level in('NORMAL','HIGH','FINANCIAL','SECURITY','PRIVACY')),
  notes text null,
  revision integer not null default 1 check(revision >= 1),
  request_idempotency_key text null,
  unique(document_id,version)
);

create unique index if not exists buklod_canonical_version_request_uq
  on public.buklod_canonical_document_versions(document_id,request_idempotency_key)
  where request_idempotency_key is not null;

create unique index if not exists buklod_canonical_one_effective_uq
  on public.buklod_canonical_document_versions(document_id)
  where status='EFFECTIVE';

create index if not exists buklod_canonical_versions_history_idx
  on public.buklod_canonical_document_versions(document_id,created_at desc);

create table if not exists public.buklod_canonical_sections(
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.buklod_canonical_document_versions(id) on delete restrict,
  section_key text not null,
  title text not null,
  sort_order integer not null,
  content_markdown text not null default '',
  visibility_scope text not null default 'INTERNAL'
    check(visibility_scope in('INTERNAL','RESTRICTED_INTERNAL')),
  tags text[] not null default '{}',
  revision integer not null default 1 check(revision >= 1),
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(version_id,section_key)
);

create index if not exists buklod_canonical_sections_order_idx
  on public.buklod_canonical_sections(version_id,sort_order);

create index if not exists buklod_canonical_sections_search_idx
  on public.buklod_canonical_sections
  using gin(to_tsvector('simple',coalesce(title,'')||' '||coalesce(content_markdown,'')));

create table if not exists public.buklod_canonical_implementation_links(
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.buklod_canonical_document_versions(id) on delete restrict,
  module_key text not null,
  verification_status text not null default 'VERIFICATION_REQUIRED'
    check(verification_status in('MATCHED','PENDING_IMPLEMENTATION','CONFLICT_DETECTED','VERIFICATION_REQUIRED')),
  implementation_status text not null default 'PLANNED'
    check(implementation_status in('DOC_ONLY','PLANNED','BUILDING','VERIFIED','LIVE')),
  implementation_ref text null,
  notes text null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(version_id,module_key)
);

create table if not exists public.buklod_canonical_change_log(
  id bigint generated by default as identity primary key,
  document_id uuid not null references public.buklod_canonical_documents(id) on delete restrict,
  version_id uuid null references public.buklod_canonical_document_versions(id) on delete restrict,
  section_key text null,
  change_type text not null,
  before_summary text null,
  after_summary text null,
  reason text null,
  actor_id uuid null references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists buklod_canonical_change_log_idx
  on public.buklod_canonical_change_log(document_id,created_at desc);

alter table public.buklod_canonical_documents
  drop constraint if exists buklod_canonical_documents_current_effective_fk;
alter table public.buklod_canonical_documents
  add constraint buklod_canonical_documents_current_effective_fk
  foreign key(current_effective_version_id)
  references public.buklod_canonical_document_versions(id)
  on delete restrict;

alter table public.buklod_canonical_documents enable row level security;
alter table public.buklod_canonical_document_versions enable row level security;
alter table public.buklod_canonical_sections enable row level security;
alter table public.buklod_canonical_implementation_links enable row level security;
alter table public.buklod_canonical_change_log enable row level security;

create or replace function public.buklod_canonical_has_permission_v1(p_permission text)
returns boolean
language sql stable security definer
set search_path=''
as $$
  select
    public.buklod_actor_is_system_admin_v1()
    or public.buklod_has_permission(
      p_permission,
      'GLOBAL',
      null,
      (select auth.uid())
    );
$$;

create or replace function public.buklod_canonical_assert_permission_v1(p_permission text)
returns void
language plpgsql stable security definer
set search_path=''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not public.buklod_canonical_has_permission_v1(p_permission) then
    raise exception 'Canonical Reference permission required: %',p_permission;
  end if;
end;
$$;

drop policy if exists buklod_canonical_documents_read on public.buklod_canonical_documents;
create policy buklod_canonical_documents_read
on public.buklod_canonical_documents for select to authenticated
using(public.buklod_canonical_has_permission_v1('canonical.reference.view'));

drop policy if exists buklod_canonical_versions_read on public.buklod_canonical_document_versions;
create policy buklod_canonical_versions_read
on public.buklod_canonical_document_versions for select to authenticated
using(public.buklod_canonical_has_permission_v1('canonical.reference.view'));

drop policy if exists buklod_canonical_sections_read on public.buklod_canonical_sections;
create policy buklod_canonical_sections_read
on public.buklod_canonical_sections for select to authenticated
using(
  public.buklod_canonical_has_permission_v1('canonical.reference.view')
  and (
    visibility_scope='INTERNAL'
    or public.buklod_canonical_has_permission_v1('canonical.reference.restricted_view')
  )
);

drop policy if exists buklod_canonical_impl_links_read on public.buklod_canonical_implementation_links;
create policy buklod_canonical_impl_links_read
on public.buklod_canonical_implementation_links for select to authenticated
using(public.buklod_canonical_has_permission_v1('canonical.reference.view'));

drop policy if exists buklod_canonical_change_log_read on public.buklod_canonical_change_log;
create policy buklod_canonical_change_log_read
on public.buklod_canonical_change_log for select to authenticated
using(public.buklod_canonical_has_permission_v1('canonical.reference.restricted_view'));

-- No authenticated direct write policies are created. All privileged writes flow
-- through audited SECURITY DEFINER RPCs below.

create or replace function public.buklod_canonical_audit_v1(
  p_action text,
  p_document_id uuid,
  p_version_id uuid default null,
  p_section_key text default null,
  p_reason text default null,
  p_before text default null,
  p_after text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql security definer
set search_path=''
as $$
begin
  insert into public.buklod_canonical_change_log(
    document_id,version_id,section_key,change_type,
    before_summary,after_summary,reason,actor_id,metadata
  )
  values(
    p_document_id,p_version_id,nullif(trim(coalesce(p_section_key,'')),''),
    p_action,p_before,p_after,p_reason,auth.uid(),
    coalesce(p_metadata,'{}'::jsonb)
      || jsonb_build_object('actor_roles',v_actor_roles,'session',v_session_meta)
  );

  insert into public.audit_logs(
    actor_id,action,entity_type,entity_id,metadata
  )
  values(
    auth.uid(),
    'CANONICAL_REFERENCE_'||upper(trim(p_action)),
    'BUKLOD_CANONICAL_REFERENCE',
    coalesce(p_version_id,p_document_id)::text,
    jsonb_build_object(
      'document_id',p_document_id,
      'version_id',p_version_id,
      'section_key',p_section_key,
      'reason',p_reason,
      'actor_roles',v_actor_roles,
      'session',v_session_meta
    ) || coalesce(p_metadata,'{}'::jsonb)
  );
end;
$$;

create or replace function public.buklod_canonical_current_v1(
  p_document_key text default 'BUKLOD_CANONICAL_MASTER'
)
returns jsonb
language plpgsql stable security definer
set search_path=''
as $$
declare
  v_doc public.buklod_canonical_documents%rowtype;
  v_version public.buklod_canonical_document_versions%rowtype;
begin
  perform public.buklod_canonical_assert_permission_v1('canonical.reference.view');

  select * into v_doc
  from public.buklod_canonical_documents
  where document_key=p_document_key and status='ACTIVE';

  if not found then
    raise exception 'Canonical document not found';
  end if;

  select * into v_version
  from public.buklod_canonical_document_versions
  where id=v_doc.current_effective_version_id;

  return jsonb_build_object(
    'document',jsonb_build_object(
      'id',v_doc.id,'document_key',v_doc.document_key,'title',v_doc.title,
      'status',v_doc.status,'metadata',v_doc.metadata
    ),
    'version',to_jsonb(v_version),
    'sections',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'section_key',s.section_key,
        'title',s.title,
        'sort_order',s.sort_order,
        'visibility_scope',s.visibility_scope,
        'tags',s.tags,
        'revision',s.revision,
        'updated_at',s.updated_at
      ) order by s.sort_order),'[]'::jsonb)
      from public.buklod_canonical_sections s
      where s.version_id=v_version.id
        and (
          s.visibility_scope='INTERNAL'
          or public.buklod_canonical_has_permission_v1('canonical.reference.restricted_view')
        )
    ),
    'permissions',jsonb_build_object(
      'can_view',true,
      'can_restricted_view',public.buklod_canonical_has_permission_v1('canonical.reference.restricted_view'),
      'can_draft',public.buklod_canonical_has_permission_v1('canonical.reference.draft'),
      'can_review',public.buklod_canonical_has_permission_v1('canonical.reference.review'),
      'can_approve',public.buklod_canonical_has_permission_v1('canonical.reference.approve'),
      'can_publish',public.buklod_canonical_has_permission_v1('canonical.reference.publish'),
      'can_high_risk_publish',public.buklod_canonical_has_permission_v1('canonical.reference.high_risk_publish'),
      'can_implementation',public.buklod_canonical_has_permission_v1('canonical.reference.implementation')
    )
  );
end;
$$;

create or replace function public.buklod_canonical_section_v1(
  p_version_id uuid,
  p_section_key text
)
returns jsonb
language plpgsql stable security definer
set search_path=''
as $$
declare
  v_row public.buklod_canonical_sections%rowtype;
begin
  perform public.buklod_canonical_assert_permission_v1('canonical.reference.view');

  select * into v_row
  from public.buklod_canonical_sections
  where version_id=p_version_id
    and section_key=p_section_key
    and (
      visibility_scope='INTERNAL'
      or public.buklod_canonical_has_permission_v1('canonical.reference.restricted_view')
    );

  if not found then raise exception 'Canonical section not found'; end if;
  return to_jsonb(v_row);
end;
$$;

create or replace function public.buklod_canonical_history_v1(
  p_document_key text default 'BUKLOD_CANONICAL_MASTER',
  p_limit integer default 20,
  p_offset integer default 0
)
returns setof public.buklod_canonical_document_versions
language plpgsql stable security definer
set search_path=''
as $$
begin
  perform public.buklod_canonical_assert_permission_v1('canonical.reference.view');
  return query
  select v.*
  from public.buklod_canonical_document_versions v
  join public.buklod_canonical_documents d on d.id=v.document_id
  where d.document_key=p_document_key
  order by v.created_at desc
  limit greatest(1,least(coalesce(p_limit,20),100))
  offset greatest(0,coalesce(p_offset,0));
end;
$$;

create or replace function public.buklod_canonical_create_draft_v1(
  p_document_key text,
  p_version text,
  p_change_summary text,
  p_affected_modules text[] default '{}',
  p_risk_level text default 'NORMAL',
  p_notes text default null,
  p_source_version_id uuid default null,
  p_request_id text default null
)
returns uuid
language plpgsql security definer
set search_path=''
as $$
declare
  v_doc public.buklod_canonical_documents%rowtype;
  v_source uuid;
  v_new uuid;
  v_risk text:=upper(trim(coalesce(p_risk_level,'NORMAL')));
  v_request text:=nullif(trim(coalesce(p_request_id,'')),'');
begin
  perform public.buklod_canonical_assert_permission_v1('canonical.reference.draft');

  if trim(coalesce(p_version,''))='' then raise exception 'Version is required'; end if;
  if trim(coalesce(p_change_summary,''))='' then raise exception 'Change summary is required'; end if;
  if v_risk not in('NORMAL','HIGH','FINANCIAL','SECURITY','PRIVACY') then
    raise exception 'Invalid risk level';
  end if;

  select * into v_doc
  from public.buklod_canonical_documents
  where document_key=p_document_key
  for update;

  if not found then raise exception 'Canonical document not found'; end if;

  if v_request is not null then
    select id into v_new
    from public.buklod_canonical_document_versions
    where document_id=v_doc.id
      and request_idempotency_key=v_request;
    if v_new is not null then return v_new; end if;
  end if;

  v_source:=coalesce(p_source_version_id,v_doc.current_effective_version_id);

  if v_source is null or not exists(
    select 1 from public.buklod_canonical_document_versions
    where id=v_source and document_id=v_doc.id
  ) then
    raise exception 'Source canonical version not found';
  end if;

  insert into public.buklod_canonical_document_versions(
    document_id,version,status,supersedes_version_id,created_by,
    change_summary,affected_modules,implementation_status,
    verification_status,risk_level,notes,request_idempotency_key
  )
  values(
    v_doc.id,trim(p_version),'DRAFT',v_doc.current_effective_version_id,auth.uid(),
    trim(p_change_summary),coalesce(p_affected_modules,'{}'),'PLANNED',
    'VERIFICATION_REQUIRED',v_risk,nullif(trim(coalesce(p_notes,'')),''),
    v_request
  )
  returning id into v_new;

  insert into public.buklod_canonical_sections(
    version_id,section_key,title,sort_order,content_markdown,
    visibility_scope,tags,revision,updated_by
  )
  select
    v_new,section_key,title,sort_order,content_markdown,
    visibility_scope,tags,1,auth.uid()
  from public.buklod_canonical_sections
  where version_id=v_source
  order by sort_order;

  perform public.buklod_canonical_audit_v1(
    'DRAFT_CREATED',v_doc.id,v_new,null,p_change_summary,null,p_version,
    jsonb_build_object('source_version_id',v_source,'risk_level',v_risk)
  );

  return v_new;
end;
$$;

create or replace function public.buklod_canonical_save_section_v1(
  p_version_id uuid,
  p_section_key text,
  p_title text,
  p_content_markdown text,
  p_expected_revision integer,
  p_reason text
)
returns jsonb
language plpgsql security definer
set search_path=''
as $$
declare
  v_doc_id uuid;
  v_status text;
  v_old public.buklod_canonical_sections%rowtype;
  v_new public.buklod_canonical_sections%rowtype;
begin
  perform public.buklod_canonical_assert_permission_v1('canonical.reference.draft');

  select document_id,status into v_doc_id,v_status
  from public.buklod_canonical_document_versions
  where id=p_version_id
  for update;

  if not found then raise exception 'Canonical version not found'; end if;
  if v_status<>'DRAFT' then raise exception 'Only DRAFT versions can be edited'; end if;
  if trim(coalesce(p_reason,''))='' then raise exception 'Edit reason is required'; end if;

  select * into v_old
  from public.buklod_canonical_sections
  where version_id=p_version_id and section_key=p_section_key
  for update;

  if not found then raise exception 'Canonical section not found'; end if;
  if v_old.revision<>p_expected_revision then
    raise exception 'STALE_CANONICAL_SECTION: expected %, current %',p_expected_revision,v_old.revision;
  end if;

  update public.buklod_canonical_sections
  set title=coalesce(nullif(trim(p_title),''),title),
      content_markdown=coalesce(p_content_markdown,''),
      revision=revision+1,
      updated_by=auth.uid(),
      updated_at=now()
  where id=v_old.id
  returning * into v_new;

  update public.buklod_canonical_document_versions
  set updated_at=now(),
      revision=revision+1,
      diff_reviewed_at=null,
      diff_reviewed_by=null
  where id=p_version_id;

  perform public.buklod_canonical_audit_v1(
    'SECTION_EDITED',v_doc_id,p_version_id,p_section_key,p_reason,
    left(v_old.content_markdown,500),left(v_new.content_markdown,500),
    jsonb_build_object('before_revision',v_old.revision,'after_revision',v_new.revision)
  );

  return to_jsonb(v_new);
end;
$$;

create or replace function public.buklod_canonical_update_draft_metadata_v1(
  p_version_id uuid,
  p_change_summary text,
  p_affected_modules text[],
  p_risk_level text,
  p_notes text,
  p_expected_revision integer,
  p_reason text
)
returns jsonb
language plpgsql security definer
set search_path=''
as $
declare
  v public.buklod_canonical_document_versions%rowtype;
  v_risk text:=upper(trim(coalesce(p_risk_level,'NORMAL')));
begin
  perform public.buklod_canonical_assert_permission_v1('canonical.reference.draft');
  if trim(coalesce(p_change_summary,''))='' then raise exception 'Change summary is required'; end if;
  if trim(coalesce(p_reason,''))='' then raise exception 'Reason is required'; end if;
  if v_risk not in('NORMAL','HIGH','FINANCIAL','SECURITY','PRIVACY') then raise exception 'Invalid risk level'; end if;

  select * into v
  from public.buklod_canonical_document_versions
  where id=p_version_id
  for update;

  if not found then raise exception 'Canonical version not found'; end if;
  if v.status<>'DRAFT' then raise exception 'Only DRAFT metadata can be edited'; end if;
  if v.revision<>p_expected_revision then raise exception 'STALE_CANONICAL_VERSION'; end if;

  update public.buklod_canonical_document_versions
  set change_summary=trim(p_change_summary),
      affected_modules=coalesce(p_affected_modules,'{}'),
      risk_level=v_risk,
      notes=nullif(trim(coalesce(p_notes,'')),''),
      diff_reviewed_at=null,
      diff_reviewed_by=null,
      revision=revision+1,
      updated_at=now()
  where id=p_version_id
  returning * into v;

  perform public.buklod_canonical_audit_v1(
    'DRAFT_METADATA_CHANGED',v.document_id,v.id,null,p_reason,null,
    v.change_summary,
    jsonb_build_object('risk_level',v.risk_level,'affected_modules',v.affected_modules,'revision',v.revision)
  );
  return to_jsonb(v);
end;
$;

create or replace function public.buklod_canonical_mark_diff_reviewed_v1(
  p_version_id uuid,
  p_expected_revision integer
)
returns jsonb
language plpgsql security definer
set search_path=''
as $
declare
  v public.buklod_canonical_document_versions%rowtype;
begin
  if not (
    public.buklod_canonical_has_permission_v1('canonical.reference.review')
    or public.buklod_canonical_has_permission_v1('canonical.reference.approve')
  ) then
    raise exception 'Canonical Reference review permission required';
  end if;

  select * into v
  from public.buklod_canonical_document_versions
  where id=p_version_id
  for update;

  if not found then raise exception 'Canonical version not found'; end if;
  if v.status not in('DRAFT','REVIEW') then raise exception 'Diff review is only recorded before approval'; end if;
  if v.revision<>p_expected_revision then raise exception 'STALE_CANONICAL_VERSION'; end if;

  update public.buklod_canonical_document_versions
  set diff_reviewed_at=now(),
      diff_reviewed_by=auth.uid(),
      revision=revision+1,
      updated_at=now()
  where id=p_version_id
  returning * into v;

  perform public.buklod_canonical_audit_v1(
    'DIFF_REVIEWED',v.document_id,v.id,null,'Required diff review completed',null,null,
    jsonb_build_object('revision',v.revision,'risk_level',v.risk_level)
  );
  return to_jsonb(v);
end;
$;

create or replace function public.buklod_canonical_submit_review_v1(
  p_version_id uuid,
  p_expected_revision integer,
  p_review_notes text default null
)
returns jsonb
language plpgsql security definer
set search_path=''
as $$
declare
  v public.buklod_canonical_document_versions%rowtype;
begin
  perform public.buklod_canonical_assert_permission_v1('canonical.reference.review');

  select * into v from public.buklod_canonical_document_versions
  where id=p_version_id for update;

  if not found then raise exception 'Canonical version not found'; end if;
  if v.status<>'DRAFT' then raise exception 'Only DRAFT versions can enter review'; end if;
  if v.revision<>p_expected_revision then raise exception 'STALE_CANONICAL_VERSION'; end if;
  if trim(coalesce(v.change_summary,''))='' then raise exception 'Change summary is required'; end if;

  update public.buklod_canonical_document_versions
  set status='REVIEW',
      notes=coalesce(nullif(trim(coalesce(p_review_notes,'')),''),notes),
      revision=revision+1,
      updated_at=now()
  where id=p_version_id
  returning * into v;

  perform public.buklod_canonical_audit_v1(
    'REVIEW_SUBMITTED',v.document_id,v.id,null,v.change_summary,null,null,
    jsonb_build_object('revision',v.revision)
  );
  return to_jsonb(v);
end;
$$;

create or replace function public.buklod_canonical_review_decision_v1(
  p_version_id uuid,
  p_approve boolean,
  p_expected_revision integer,
  p_notes text
)
returns jsonb
language plpgsql security definer
set search_path=''
as $$
declare
  v public.buklod_canonical_document_versions%rowtype;
begin
  perform public.buklod_canonical_assert_permission_v1('canonical.reference.approve');

  select * into v from public.buklod_canonical_document_versions
  where id=p_version_id for update;

  if not found then raise exception 'Canonical version not found'; end if;
  if v.status<>'REVIEW' then raise exception 'Version is not in REVIEW'; end if;
  if v.revision<>p_expected_revision then raise exception 'STALE_CANONICAL_VERSION'; end if;
  if trim(coalesce(p_notes,''))='' then raise exception 'Review notes are required'; end if;
  if p_approve
     and v.risk_level in('HIGH','FINANCIAL','SECURITY','PRIVACY')
     and v.diff_reviewed_at is null then
    raise exception 'DIFF_REVIEW_REQUIRED';
  end if;

  update public.buklod_canonical_document_versions
  set status=case when p_approve then 'APPROVED' else 'DRAFT' end,
      approved_by=case when p_approve then auth.uid() else null end,
      approved_at=case when p_approve then now() else null end,
      notes=trim(p_notes),
      revision=revision+1,
      updated_at=now()
  where id=p_version_id
  returning * into v;

  perform public.buklod_canonical_audit_v1(
    case when p_approve then 'APPROVED' else 'REVIEW_REJECTED' end,
    v.document_id,v.id,null,p_notes,null,null,
    jsonb_build_object('revision',v.revision,'risk_level',v.risk_level)
  );
  return to_jsonb(v);
end;
$$;

create or replace function public.buklod_canonical_publish_v1(
  p_version_id uuid,
  p_expected_revision integer
)
returns jsonb
language plpgsql security definer
set search_path=''
as $$
declare
  v_doc public.buklod_canonical_documents%rowtype;
  v public.buklod_canonical_document_versions%rowtype;
  v_prior uuid;
  v_user uuid:=auth.uid();
  r record;
begin
  perform public.buklod_canonical_assert_permission_v1('canonical.reference.publish');

  select * into v
  from public.buklod_canonical_document_versions
  where id=p_version_id
  for update;

  if not found then raise exception 'Canonical version not found'; end if;

  select * into v_doc
  from public.buklod_canonical_documents
  where id=v.document_id
  for update;

  if v.status='EFFECTIVE' and v_doc.current_effective_version_id=v.id then
    return to_jsonb(v);
  end if;

  if v.status<>'APPROVED' then raise exception 'Only APPROVED versions can be published'; end if;
  if v.revision<>p_expected_revision then raise exception 'STALE_CANONICAL_VERSION'; end if;
  if v.risk_level in('HIGH','FINANCIAL','SECURITY','PRIVACY')
     and v.diff_reviewed_at is null then
    raise exception 'DIFF_REVIEW_REQUIRED';
  end if;

  if v.risk_level in('FINANCIAL','SECURITY','PRIVACY') then
    perform public.buklod_canonical_assert_permission_v1('canonical.reference.high_risk_publish');
  end if;

  v_prior:=v_doc.current_effective_version_id;

  if v.supersedes_version_id is distinct from v_prior then
    raise exception 'STALE_CANONICAL_BASE: current effective version changed after this draft was created';
  end if;

  if v_prior is not null then
    update public.buklod_canonical_document_versions
    set status='SUPERSEDED',updated_at=now(),revision=revision+1
    where id=v_prior and status='EFFECTIVE';
  end if;

  update public.buklod_canonical_document_versions
  set status='EFFECTIVE',
      effective_at=now(),
      approved_by=coalesce(approved_by,v_user),
      approved_at=coalesce(approved_at,now()),
      revision=revision+1,
      updated_at=now()
  where id=v.id
  returning * into v;

  update public.buklod_canonical_documents
  set current_effective_version_id=v.id,
      updated_at=now()
  where id=v.document_id;

  perform public.buklod_canonical_audit_v1(
    'PUBLISHED',v.document_id,v.id,null,v.change_summary,null,v.version,
    jsonb_build_object(
      'prior_effective_version_id',v_prior,
      'risk_level',v.risk_level,
      'implementation_status',v.implementation_status
    )
  );

  -- Notify only authorized internal users, never ordinary users.
  for r in
    with candidate_users as (
      select ur.user_id
      from public.user_roles ur
      where ur.is_active=true and lower(ur.role)='system_admin'
      union
      select distinct a.user_id
      from public.buklod_foundation_role_assignments a
      join public.buklod_foundation_role_permissions rp
        on rp.role_key=a.role_key
      where a.status='ACTIVE'
        and a.valid_from<=now()
        and (a.valid_until is null or a.valid_until>now())
        and rp.permission_key in(
          'canonical.reference.view',
          'canonical.reference.draft',
          'canonical.reference.review',
          'canonical.reference.approve',
          'canonical.reference.publish'
        )
    )
    select distinct user_id from candidate_users where user_id is not null
  loop
    perform public.buklod_queue_notification_once_v1(
      r.user_id,
      'BUKLOD Canonical Reference updated',
      'Version '||v.version||' is now the current effective internal reference.',
      'canonical_reference_published',
      jsonb_build_object(
        'document_key',v_doc.document_key,
        'version_id',v.id,
        'version',v.version,
        'risk_level',v.risk_level,
        'route','/admin/canonical-reference'
      ),
      'canonical-reference-published:'||v.id::text
    );
  end loop;

  return to_jsonb(v);
end;
$$;

create or replace function public.buklod_canonical_set_implementation_v1(
  p_version_id uuid,
  p_implementation_status text,
  p_verification_status text,
  p_implementation_ref text,
  p_expected_revision integer,
  p_reason text
)
returns jsonb
language plpgsql security definer
set search_path=''
as $$
declare
  v public.buklod_canonical_document_versions%rowtype;
  v_impl text:=upper(trim(coalesce(p_implementation_status,'')));
  v_verify text:=upper(trim(coalesce(p_verification_status,'')));
begin
  perform public.buklod_canonical_assert_permission_v1('canonical.reference.implementation');
  if v_impl not in('DOC_ONLY','PLANNED','BUILDING','VERIFIED','LIVE') then raise exception 'Invalid implementation status'; end if;
  if v_verify not in('MATCHED','PENDING_IMPLEMENTATION','CONFLICT_DETECTED','VERIFICATION_REQUIRED') then raise exception 'Invalid verification status'; end if;
  if trim(coalesce(p_reason,''))='' then raise exception 'Reason is required'; end if;

  select * into v from public.buklod_canonical_document_versions
  where id=p_version_id for update;
  if not found then raise exception 'Canonical version not found'; end if;
  if v.revision<>p_expected_revision then raise exception 'STALE_CANONICAL_VERSION'; end if;

  update public.buklod_canonical_document_versions
  set implementation_status=v_impl,
      verification_status=v_verify,
      implementation_ref=nullif(trim(coalesce(p_implementation_ref,'')),''),
      revision=revision+1,
      updated_at=now()
  where id=p_version_id
  returning * into v;

  perform public.buklod_canonical_audit_v1(
    'IMPLEMENTATION_STATUS_CHANGED',v.document_id,v.id,null,p_reason,null,
    v_impl||' / '||v_verify,
    jsonb_build_object('implementation_ref',v.implementation_ref,'revision',v.revision)
  );
  return to_jsonb(v);
end;
$$;

create or replace function public.buklod_canonical_set_module_link_v1(
  p_version_id uuid,
  p_module_key text,
  p_implementation_status text,
  p_verification_status text,
  p_implementation_ref text,
  p_notes text,
  p_reason text
)
returns jsonb
language plpgsql security definer
set search_path=''
as $$
declare
  v_doc_id uuid;
  v_row public.buklod_canonical_implementation_links%rowtype;
begin
  perform public.buklod_canonical_assert_permission_v1('canonical.reference.implementation');
  if trim(coalesce(p_module_key,''))='' then raise exception 'Module key is required'; end if;
  if trim(coalesce(p_reason,''))='' then raise exception 'Reason is required'; end if;

  select document_id into v_doc_id
  from public.buklod_canonical_document_versions
  where id=p_version_id;
  if v_doc_id is null then raise exception 'Canonical version not found'; end if;

  insert into public.buklod_canonical_implementation_links(
    version_id,module_key,implementation_status,verification_status,
    implementation_ref,notes,updated_by
  )
  values(
    p_version_id,upper(trim(p_module_key)),
    upper(trim(p_implementation_status)),upper(trim(p_verification_status)),
    nullif(trim(coalesce(p_implementation_ref,'')),''),
    nullif(trim(coalesce(p_notes,'')),''),
    auth.uid()
  )
  on conflict(version_id,module_key) do update
  set implementation_status=excluded.implementation_status,
      verification_status=excluded.verification_status,
      implementation_ref=excluded.implementation_ref,
      notes=excluded.notes,
      updated_by=auth.uid(),
      updated_at=now()
  returning * into v_row;

  perform public.buklod_canonical_audit_v1(
    'IMPLEMENTATION_LINK_CHANGED',v_doc_id,p_version_id,null,p_reason,null,
    v_row.module_key||' / '||v_row.implementation_status||' / '||v_row.verification_status,
    jsonb_build_object('module_key',v_row.module_key,'implementation_ref',v_row.implementation_ref)
  );
  return to_jsonb(v_row);
end;
$$;

create or replace function public.buklod_canonical_compare_versions_v1(
  p_before_version_id uuid,
  p_after_version_id uuid
)
returns table(
  section_key text,
  title text,
  sort_order integer,
  change_type text,
  before_content text,
  after_content text
)
language plpgsql stable security definer
set search_path=''
as $$
begin
  perform public.buklod_canonical_assert_permission_v1('canonical.reference.view');
  return query
  with b as (
    select section_key,title,sort_order,content_markdown
    from public.buklod_canonical_sections
    where version_id=p_before_version_id
      and (
        visibility_scope='INTERNAL'
        or public.buklod_canonical_has_permission_v1('canonical.reference.restricted_view')
      )
  ),
  a as (
    select section_key,title,sort_order,content_markdown
    from public.buklod_canonical_sections
    where version_id=p_after_version_id
      and (
        visibility_scope='INTERNAL'
        or public.buklod_canonical_has_permission_v1('canonical.reference.restricted_view')
      )
  )
  select
    coalesce(a.section_key,b.section_key),
    coalesce(a.title,b.title),
    coalesce(a.sort_order,b.sort_order),
    case
      when b.section_key is null then 'ADDED'
      when a.section_key is null then 'REMOVED'
      when b.content_markdown is distinct from a.content_markdown
        or b.title is distinct from a.title then 'CHANGED'
      else 'UNCHANGED'
    end,
    b.content_markdown,
    a.content_markdown
  from b
  full outer join a using(section_key)
  order by coalesce(a.sort_order,b.sort_order),coalesce(a.section_key,b.section_key);
end;
$$;

create or replace function public.buklod_canonical_search_v1(
  p_query text,
  p_include_history boolean default false,
  p_limit integer default 30
)
returns table(
  version_id uuid,
  version text,
  version_status text,
  implementation_status text,
  section_key text,
  section_title text,
  excerpt text,
  sort_order integer
)
language plpgsql stable security definer
set search_path=''
as $$
declare
  q text:=trim(coalesce(p_query,''));
begin
  perform public.buklod_canonical_assert_permission_v1('canonical.reference.view');
  if q='' then return; end if;

  return query
  select
    v.id,
    v.version,
    v.status,
    v.implementation_status,
    s.section_key,
    s.title,
    case
      when position(lower(q) in lower(s.content_markdown))>0 then
        substring(
          s.content_markdown
          from greatest(1,position(lower(q) in lower(s.content_markdown))-90)
          for 280
        )
      else left(s.content_markdown,280)
    end,
    s.sort_order
  from public.buklod_canonical_sections s
  join public.buklod_canonical_document_versions v on v.id=s.version_id
  join public.buklod_canonical_documents d on d.id=v.document_id
  where d.document_key='BUKLOD_CANONICAL_MASTER'
    and (
      p_include_history
      or v.id=d.current_effective_version_id
    )
    and (
      s.visibility_scope='INTERNAL'
      or public.buklod_canonical_has_permission_v1('canonical.reference.restricted_view')
    )
    and (
      to_tsvector('simple',coalesce(s.title,'')||' '||coalesce(s.content_markdown,''))
      @@ plainto_tsquery('simple',q)
      or s.title ilike '%'||q||'%'
      or s.content_markdown ilike '%'||q||'%'
      or s.section_key ilike '%'||q||'%'
    )
  order by
    case when v.id=d.current_effective_version_id then 0 else 1 end,
    v.created_at desc,
    s.sort_order
  limit greatest(1,least(coalesce(p_limit,30),100));
end;
$$;

create or replace function public.buklod_canonical_export_markdown_v1(
  p_document_key text default 'BUKLOD_CANONICAL_MASTER',
  p_version_id uuid default null
)
returns text
language plpgsql stable security definer
set search_path=''
as $$
declare
  v_doc public.buklod_canonical_documents%rowtype;
  v public.buklod_canonical_document_versions%rowtype;
  v_body text;
begin
  perform public.buklod_canonical_assert_permission_v1('canonical.reference.view');

  select * into v_doc
  from public.buklod_canonical_documents
  where document_key=p_document_key;
  if not found then raise exception 'Canonical document not found'; end if;

  select * into v
  from public.buklod_canonical_document_versions
  where id=coalesce(p_version_id,v_doc.current_effective_version_id)
    and document_id=v_doc.id;
  if not found then raise exception 'Canonical version not found'; end if;

  select string_agg(
    '## '||s.sort_order||'. '||s.title||E'\n\n'||s.content_markdown,
    E'\n\n'
    order by s.sort_order
  )
  into v_body
  from public.buklod_canonical_sections s
  where s.version_id=v.id
    and (
      s.visibility_scope='INTERNAL'
      or public.buklod_canonical_has_permission_v1('canonical.reference.restricted_view')
    );

  return '# '||v_doc.title||E'\n\n'
    ||'- Document key: '||v_doc.document_key||E'\n'
    ||'- Version: '||v.version||E'\n'
    ||'- Status: '||v.status||E'\n'
    ||'- Effective: '||coalesce(v.effective_at::text,'Not effective')||E'\n'
    ||'- Implementation: '||v.implementation_status||E'\n'
    ||'- Verification: '||v.verification_status||E'\n\n'
    ||coalesce(v_body,'');
end;
$$;

revoke all on function public.buklod_canonical_audit_v1(text,uuid,uuid,text,text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.buklod_canonical_has_permission_v1(text) from public,anon;
revoke all on function public.buklod_canonical_assert_permission_v1(text) from public,anon;
revoke all on function public.buklod_canonical_current_v1(text) from public,anon;
revoke all on function public.buklod_canonical_section_v1(uuid,text) from public,anon;
revoke all on function public.buklod_canonical_history_v1(text,integer,integer) from public,anon;
revoke all on function public.buklod_canonical_create_draft_v1(text,text,text,text[],text,text,uuid,text) from public,anon;
revoke all on function public.buklod_canonical_save_section_v1(uuid,text,text,text,integer,text) from public,anon;
revoke all on function public.buklod_canonical_update_draft_metadata_v1(uuid,text,text[],text,text,integer,text) from public,anon;
revoke all on function public.buklod_canonical_mark_diff_reviewed_v1(uuid,integer) from public,anon;
revoke all on function public.buklod_canonical_submit_review_v1(uuid,integer,text) from public,anon;
revoke all on function public.buklod_canonical_review_decision_v1(uuid,boolean,integer,text) from public,anon;
revoke all on function public.buklod_canonical_publish_v1(uuid,integer) from public,anon;
revoke all on function public.buklod_canonical_set_implementation_v1(uuid,text,text,text,integer,text) from public,anon;
revoke all on function public.buklod_canonical_set_module_link_v1(uuid,text,text,text,text,text,text) from public,anon;
revoke all on function public.buklod_canonical_compare_versions_v1(uuid,uuid) from public,anon;
revoke all on function public.buklod_canonical_search_v1(text,boolean,integer) from public,anon;
revoke all on function public.buklod_canonical_export_markdown_v1(text,uuid) from public,anon;

grant execute on function public.buklod_canonical_has_permission_v1(text) to authenticated;
grant execute on function public.buklod_canonical_assert_permission_v1(text) to authenticated;
grant execute on function public.buklod_canonical_current_v1(text) to authenticated;
grant execute on function public.buklod_canonical_section_v1(uuid,text) to authenticated;
grant execute on function public.buklod_canonical_history_v1(text,integer,integer) to authenticated;
grant execute on function public.buklod_canonical_create_draft_v1(text,text,text,text[],text,text,uuid,text) to authenticated;
grant execute on function public.buklod_canonical_save_section_v1(uuid,text,text,text,integer,text) to authenticated;
grant execute on function public.buklod_canonical_update_draft_metadata_v1(uuid,text,text[],text,text,integer,text) to authenticated;
grant execute on function public.buklod_canonical_mark_diff_reviewed_v1(uuid,integer) to authenticated;
grant execute on function public.buklod_canonical_submit_review_v1(uuid,integer,text) to authenticated;
grant execute on function public.buklod_canonical_review_decision_v1(uuid,boolean,integer,text) to authenticated;
grant execute on function public.buklod_canonical_publish_v1(uuid,integer) to authenticated;
grant execute on function public.buklod_canonical_set_implementation_v1(uuid,text,text,text,integer,text) to authenticated;
grant execute on function public.buklod_canonical_set_module_link_v1(uuid,text,text,text,text,text,text) to authenticated;
grant execute on function public.buklod_canonical_compare_versions_v1(uuid,uuid) to authenticated;
grant execute on function public.buklod_canonical_search_v1(text,boolean,integer) to authenticated;
grant execute on function public.buklod_canonical_export_markdown_v1(text,uuid) to authenticated;

-- Seed the approved current master reference v1.0.
do $seed$
declare
  v_doc uuid;
  v_ver uuid;
begin
  insert into public.buklod_canonical_documents(
    document_key,title,status,metadata
  )
  values(
    'BUKLOD_CANONICAL_MASTER',
    'BUKLOD CANONICAL MASTER REFERENCE',
    'ACTIVE',
    jsonb_build_object(
      'source','BUKLOD_CANONICAL_MASTER_REFERENCE_v1.0.docx',
      'effective_date','2026-09-21',
      'primary_owner','BUKLOD Product Owner',
      'internal_only',true,
      'precedence',jsonb_build_array(
        'Applicable law / provider policy / binding legal obligation',
        'Current approved BUKLOD Canonical Master Reference',
        'Approved versioned backend configuration / financial rule version',
        'Current verified implementation / release candidate',
        'Older prompts / drafts / historical notes'
      )
    )
  )
  on conflict(document_key) do update
  set title=excluded.title,
      metadata=public.buklod_canonical_documents.metadata||excluded.metadata,
      updated_at=now()
  returning id into v_doc;

  select id into v_ver
  from public.buklod_canonical_document_versions
  where document_id=v_doc and version='1.0';

  if v_ver is null then
    insert into public.buklod_canonical_document_versions(
      document_id,version,status,effective_at,created_by,approved_by,
      approved_at,change_summary,affected_modules,implementation_status,
      verification_status,risk_level,notes
    )
    values(
      v_doc,'1.0','EFFECTIVE','2026-09-21T00:00:00+08'::timestamptz,
      null,null,'2026-09-21T00:00:00+08'::timestamptz,
      'Initial consolidated canonical reference covering institutional workspace, economy, referrals, Community Fund governance, standalone apps, monetization positioning, rewards, BSOC/support, financial safety and release process.',
      array['BUKLOD Main','Organizations','Sub-Organizations','Standalone Apps','Economy','Bayanihan','BSOC','Finance Control Center','Support','Release Engineering'],
      'DOC_ONLY','VERIFICATION_REQUIRED','NORMAL',
      'Imported from the approved BUKLOD_CANONICAL_MASTER_REFERENCE_v1.0 source. Policy status is separate from runtime implementation status.'
    )
    returning id into v_ver;
  end if;

  insert into public.buklod_canonical_sections(
    version_id,section_key,title,sort_order,content_markdown,visibility_scope,tags
  )
  values
  (v_ver,'01_authority_change_control','Canonical Authority and Change Control',1,$s1$
**RULE 1 - ONE SOURCE OF TRUTH**

This Master Reference supersedes older prompts or notes when they conflict with a newer approved rule in this document. Older implementation prompts remain useful only when consistent with the current effective version.

- Every rule has a stable section and should be edited in place when policy changes.
- Do not create a second "final" document for the same rule. Update this document and version it.
- Each approved change must have: version, date, changed section, reason, approver/owner, and implementation status.
- A textual policy update does not by itself alter production calculations. Backend configuration, migrations, tests and release must be updated separately where required.
- Financial, security, permission and data-retention changes are high-risk and require exact implementation verification before becoming operational.

**Rule hierarchy**
1. Applicable law, platform/provider policy and binding legal obligations
2. Approved current BUKLOD Canonical Master Reference
3. Approved versioned backend configuration / financial rule version
4. Current verified implementation and release candidate
5. Older prompts, drafts and historical notes
$s1$,'RESTRICTED_INTERNAL',array['authority','change-control','precedence']),
  (v_ver,'02_product_architecture','BUKLOD Product Architecture',2,$s2$
**CORE PRODUCT RULE**

BUKLOD is one ecosystem. Build shared capabilities once, configure them by scope, and avoid maintaining separate source-code forks for every institution.

- BUKLOD Main is the primary user application.
- Community Wall is the canonical/root user screen. Do not resurrect a legacy Public Home.
- Organization is the generic institutional workspace.
- Sub-Organization is a local operational unit under a Parent Organization.
- BUKLOD Report, Classroom, Quiz and QuickCheck remain specialized standalone apps integrated through authorized context.
- BSOC is the operations/support/admin control plane.
- Finance Control Center is the restricted financial/profitability control plane and is separate from ordinary BSOC access.
- Future standalone/focus apps must register through shared identity, organization context, support, telemetry, monetization and release contracts rather than inventing independent infrastructure.
$s2$,'INTERNAL',array['architecture','main','organization','standalone']),
  (v_ver,'03_organization_institutional_workspace','Organization as the Generic Institutional Workspace',3,$s3$
The existing Organization system is the institutional shell for schools, businesses, churches, NGOs, training centers, associations, cooperatives and other legitimate institutions. Do not build a new institutional architecture unless a future product decision explicitly requires it.

**Reusable institutional capabilities**
- Overview / Organization dashboard
- Members, membership requests and scoped roles
- Sub-Organizations / departments / teams / ministries / branches
- Community and communication
- Announcements
- Events and Attendance
- Files / resources
- Organization settings and discovery/joining
- BUKLOD Report contextual access
- Classroom contextual access
- Quiz / Assessment contextual access
- QuickCheck contextual access where applicable
- Calendar aggregation
- Help & Support routed to the centralized support system

**Institution Setup Wizard**
1. Organization identity: name, type, logo, description and approved theme.
2. Structure: create/import Sub-Organizations or units.
3. Roles: appoint Organization and local/unit admins.
4. Modules: enable appropriate existing capabilities.
5. Specialized apps: connect Report, Classroom, Quiz, QuickCheck and future approved standalones.
6. Member access: configure public/private/invite/approval behavior.
7. Invite: generate link, QR and join code where supported.
8. Review: preview permissions and modules.
9. Launch: activate the workspace.

**SETUP TARGET:** A competent Organization Admin should be able to configure a basic institutional workspace in about 15-30 minutes without developer coding.
$s3$,'INTERNAL',array['organization','sub-org','institution','setup']),
  (v_ver,'04_institutional_partnership','Institutional Adoption and Partnership Model',4,$s4$
BUKLOD should not customize first merely to convince an institution to use the platform. Standard adoption comes first; deeper customization follows proven use or a separate commercial agreement.

- **Standard Organization:** Standard Organization/Sub-Org tools; no custom development. Normal account use under platform rules.
- **Institutional Partner:** Guided setup, branding/configuration, onboarding and agreed support. Formal adoption for agreed use cases and reasonable onboarding/continued use during the term.
- **Strategic / Custom Partner:** Approved custom integration, reports or workflows. Separate written scope / SOW / commercial terms where needed.

- Institutional personalization should primarily mean configuration, not separate code forks.
- A formal MOA/service agreement is advisable for a formal tie-up involving onboarding, customization, support commitments, data responsibilities or institutional adoption.
- No agreement should create an unlimited free customization obligation.
- Institution workspaces may follow lifecycle states such as DRAFT, PILOT, ACTIVE, RESTRICTED, READ_ONLY, ARCHIVED and CLOSED.
- Archive/closure should follow defined notice, security, retention and export rules where applicable; urgent security/legal/abuse cases may require immediate restriction.

**PARTNERSHIP POSITIONING:** Your own institutional workspace, powered by BUKLOD. One core platform, many institutions.
$s4$,'INTERNAL',array['institution','partnership','commercial']),
  (v_ver,'05_standalone_apps','Standalone Apps and Ecosystem Contribution',5,$s5$
Every standalone app should provide real utility first and should be designed to contribute economically to the BUKLOD ecosystem where appropriate. "Profit earner" does not mean intrusive monetization or guaranteed cash per use.

- **BUKLOD Report:** Institutional reporting and scoped workflows. Organization context must be authoritative; do not build a duplicate report engine.
- **BUKLOD Classroom:** Learning / class interaction. Standalone; pass identity, Organization/Sub-Org and entitlement context securely.
- **BUKLOD Quiz:** Secure assessment. Standalone; preserve exam security and route guards.
- **BUKLOD QuickCheck:** Fast checks / assessments. Standalone; integrate with Organization and central telemetry/monetization.
- **Future standalones:** Specialized utility. Register through shared contracts; no isolated architecture.

- More meaningful use can create more eligible monetization opportunities and potentially a larger designated economic base, but no app action guarantees a fixed monetary return.
- Do not reward ordinary ad views, ad clicks or repeated refreshes with points or cash.
- Monetization failure must never block the app's core utility.
- Each cost-bearing app must expose revenue, infrastructure cost, contribution margin, budget and kill/degrade controls to the appropriate internal control center.
- Variable-cost features such as AI/video require Profit Guard behavior and cost-aware degradation.
$s5$,'INTERNAL',array['report','classroom','quiz','quickcheck','standalone']),
  (v_ver,'06_economy_designated_funding','Economy Architecture and Designated Funding',6,$s6$
**ECONOMY PRINCIPLE**

Cash measures economic value. Points measure participation, reputation and progression. Points do not have a fixed peso value.

BUKLOD must remain flexible about where participant benefits, Community Funds and rewards are funded. Public messaging should not define BUKLOD as an "ad app" or imply that every future BUKLOD business revenue source is shared.

**Designated Funding Base**
- BUKLOD may designate eligible funds/revenue for a specific sharing, reward or Community Fund program.
- Only sources explicitly designated for a program are part of that program's funding base.
- Future BUKLOD revenue such as subscriptions, licensing, enterprise services, marketplace fees, integrations, commissions, sponsorships or other business opportunities is NOT automatically subject to User, Referral or Community percentages.
- BUKLOD may separately fund rewards, bonuses or promotions without changing the underlying participant-sharing formula.
- Internal accounting must identify funding_source and program/version even when the public UI does not expose accounting complexity.

**PUBLIC-FACING WORDING**

BUKLOD may allocate designated funds for qualified user rewards, participant benefits and Bayanihan Community Funds according to the applicable BUKLOD program rules. The source, amount, eligibility and availability may vary by program and period.
$s6$,'RESTRICTED_INTERNAL',array['economy','funding','financial']),
  (v_ver,'07_points_participant_benefits','Points and Participant Benefits',7,$s7$
**Two point balances**
- **Lifetime Points:** Rank, character, badges, reputation, progression and unlocks. No monthly reset.
- **Qualified Monthly Points:** Distribution weight for the applicable monthly User Revenue Pool. Monthly program cycle.

- Standard meaningful activities may earn modest points, typically according to a versioned activity table.
- General collectibles and progression must not require ministry reporting, Attendance, Classroom or Reports unless a specific scoped program explicitly requires it.
- User share formula: User Share = (user qualified monthly points / total qualified monthly points) x designated User Revenue Pool.
- Backend is authoritative. Client displays only calculated results.
- User UI should clearly distinguish Qualified Points, Pool Share %, Estimated Earnings, Finalized Earnings and Withdrawable.
- Estimated is not finalized; finalized is not automatically withdrawable until payout requirements are satisfied.
$s7$,'RESTRICTED_INTERNAL',array['points','participant-benefits','economy']),
  (v_ver,'08_referral_program','Referral Program',8,$s8$
- One genuine qualified referred person can generate at most one lifetime one-time referral reward under the applicable program.
- Current working one-time referral reward: PHP 20, subject to qualification and anti-abuse rules.
- First-line referral relationship is permanent for attribution; no second/third/downline MLM structure.
- Current working recurring first-line share: 10% for six months after qualification, with immutable start/end dates.
- After the six-month referral-share period, that 10% returns to BUKLOD unless a future approved rule says otherwise.
- Referral reward states should include Pending, Qualifying, Qualified, Withdrawable, Paid and Rejected.
- A delete/reinstall/re-register/device change must not reset a referral relationship or allow another lifetime one-time reward.
- Shared household/network alone must not automatically be treated as abuse; use layered risk controls.
- Do not market "every share earns PHP 20". Correct concept: a valid referred user completes qualification, then the applicable one-time reward becomes eligible.

**Current qualification working model**
- User with valid referrer: Approximately PHP 40 qualifying platform value before normal participant/referral/community sharing activates.
- User without referrer: Approximately PHP 60 qualifying platform value before normal participant sharing activates.

Qualification values are backend-configurable program rules and should not be hard-coded into marketing assets. Explain this as accelerated qualification with referral versus standard qualification without referral, not as a penalty.
$s8$,'RESTRICTED_INTERNAL',array['referral','economy','anti-abuse']),
  (v_ver,'09_community_fund_rates','Bayanihan Community Fund Qualification and Rates',9,$s9$
**CORE RULE**

Membership does not equal contribution designation. One user may belong to many communities but may have only ONE active Community Contribution Destination at a time.

**Qualified Active Designated Contributors -> Community Fund Rate**
- 1-29 -> 5%
- 30+ -> 7%

- Structural Organization status and fund rate are separate.
- Raw member count alone never unlocks 7%.
- An active designated contributor must satisfy the configured eligibility/activity rules and explicitly designate that community.
- If an Organization has 2,000 members but only 10 valid active designated contributors, its Community Fund rate is 5%.
- If it reaches 30 or more valid active designated contributors, the applicable rate becomes 7%.
- Use a configurable grace period when a 7% Organization temporarily drops below 30; current working model is 30 days. No retroactive clawback.
- Historical allocations remain with the prior community when a user switches destinations. Future eligible allocations go only to the new destination.
- No 5% + 7% stacking and no nested community percentages.
$s9$,'RESTRICTED_INTERNAL',array['community-fund','rates','financial']),
  (v_ver,'10_community_fund_governance','Community Fund Governance Profiles',10,$s10$
Contribution rate and fund governance are separate. Contribution rules determine the applicable allocation rate; governance determines who may authorize legitimate use of the fund.

- **Community Democratic:** Grassroots clusters/member-led communities. Eligible members vote using configured quorum/approval thresholds.
- **Institutional Board:** Schools, businesses, formal churches, NGOs, cooperatives. Authorized approvers / board officers approve using threshold rules.
- **Hybrid:** Institutions that want member participation plus formal authority. Member input/advisory vote + authorized institutional approval.

**Institutional Board safeguards**
- Organization Admin is not automatically a Community Fund Approver.
- Requestor should not be able to single-handedly approve and release their own request.
- Preferred control: one person requests; another authorized person approves; the system releases after all conditions are met.
- Support 2-of-3, 3-of-5, unanimous or other backend-configured approval thresholds.
- Approver roles must be configurable; do not hard-code Principal/Treasurer/BOT names into the core.
- One human/account identity counts once per request even if the person holds multiple roles.
- Revalidate active approver authority before final release.
- Community Fund is not admin-owned money and must not expose unrestricted "Withdraw Fund" behavior.

**Fund request lifecycle**
DRAFT -> SUBMITTED -> UNDER_REVIEW -> AWAITING_MEMBER_VOTE or AWAITING_BOARD_APPROVAL -> APPROVED -> COOLING_PERIOD -> READY_FOR_RELEASE -> RELEASE_PROCESSING -> RELEASED -> LIQUIDATION_PENDING -> COMPLETED. Alternate terminal/exception states: REJECTED, CANCELLED, FLAGGED.

**Fund use and transparency**
- Fund requests should capture purpose, amount, category, beneficiary/vendor where applicable, Organization/Sub-Org origin, supporting documents, expected completion and requester.
- Prefer direct payment to legitimate vendor/beneficiary where practical; reimbursements require stricter documentation.
- Require liquidation/completion evidence appropriate to the project: receipts, invoice, photos, project report, actual spend and unused balance.
- Members may see appropriate transparency - rate, contributors, approved/released/completed projects and summaries - without exposing unnecessary sensitive data.
- Every request, vote, approval, hold, release and liquidation action is audited.
$s10$,'RESTRICTED_INTERNAL',array['community-fund','governance','financial']),
  (v_ver,'11_suborg_finance_governance','Sub-Organization Financial and Governance Rules',11,$s11$
- Sub-Organization requires a valid Parent Organization.
- A user may join/admin a Sub-Org only when authorized under the Parent Organization rules.
- Sub-Org has no automatic separate 5% or 7% wallet.
- If a user designates the Parent Organization, the applicable contribution goes to the Parent Organization fund.
- Sub-Org may originate a fund request tagged with parent_organization_id and originating_suborg_id.
- Sub-Org Admin may create proposals, upload documents, monitor status and submit liquidation if authorized.
- Sub-Org Admin may not automatically withdraw/release Parent funds, change percentages, edit the financial ledger or bypass Parent governance.
- Members of multiple Sub-Orgs count once toward the Parent Organization contributor threshold when the Parent is their selected destination.
$s11$,'RESTRICTED_INTERNAL',array['sub-org','community-fund','governance']),
  (v_ver,'12_rewards_incentives','Rewards, Bonuses and Promotional Incentives',12,$s12$
**FLEXIBILITY RULE**

A BUKLOD reward does not have to come from the same funding source as the User Revenue Pool or Community Fund.

- Rewards may be funded by an approved promotional budget, BUKLOD company budget, sponsor/partner program, launch incentive, referral campaign or other explicitly approved source.
- Each reward transaction must identify its program and funding source internally.
- A temporary reward must not silently alter the permanent 30% / 10% / 5-7% formulas.
- Reward eligibility must be clear, auditable and resistant to duplicate claiming.
- Promotional language must not imply guaranteed profit or fixed earnings when outcomes depend on qualification, usage, program availability or funding.
$s12$,'RESTRICTED_INTERNAL',array['rewards','promotion','economy']),
  (v_ver,'13_monetization_positioning','Monetization, Advertising and Public Positioning',13,$s13$
**MARKETING RULE**

Never market ad consumption as the product. Market useful participation in the BUKLOD ecosystem. Monetization operates in the background.

- BUKLOD may use advertising as an important monetization mechanism, but public promotion should not reduce the brand to "an ads app".
- Do not tell users to watch/click/reload ordinary ads for cash or points.
- Do not promise that every session, app launch, ad request or standalone-app use earns a fixed amount.
- Use central ad control, platform-specific providers and telemetry. Ad failure never blocks the useful workflow.
- Sensitive surfaces should remain ad-free or highly restricted: login/recovery, SOS, active Quiz/Exam, active Classroom interaction, withdrawal, sensitive finance and critical forms while typing.
- Community Wall and eligible browsing/content surfaces can monetize using respectful native/in-feed placements and centralized frequency controls.
- Web and native ad systems remain technically separate where provider requirements differ.
- Future non-ad revenue belongs to BUKLOD unless explicitly designated into a participant, referral, Community Fund or reward program.
$s13$,'RESTRICTED_INTERNAL',array['monetization','ads','positioning']),
  (v_ver,'14_public_messaging','User-Facing Economy and Institutional Messaging',14,$s14$
**INSTITUTIONAL MESSAGE**

Use BUKLOD for the things your organization already does. Meaningful participation can unlock BUKLOD benefits and help build your organization's Bayanihan Community Fund, subject to the applicable program rules.

- No capital investment or separate software subscription may be required for a standard partnership offer where BUKLOD chooses that model.
- Avoid saying "the school earns 7% from every member". Correct: the Organization may qualify for the applicable Community Fund rate based on qualified active designated contributors.
- Avoid calling the Community Fund admin income, school owner income or personal profit.
- Avoid "profit sharing" when the intent is participant benefit/revenue pool/community allocation rather than company equity or shareholder profit.
- Recommended terms: BUKLOD Participant Benefits, User Revenue Pool, Bayanihan Community Fund, BUKLOD Rewards, Institutional Community Benefits.
- When saying "partner", make clear it is a platform/institutional partnership, not equity ownership.

**Standalone promotion examples**
- BUKLOD Report: manage institutional reporting inside the same BUKLOD ecosystem.
- BUKLOD QuickCheck: run fast checks/assessments within the same ecosystem.
- BUKLOD Classroom: teach, communicate and manage learning while staying inside the Organization context.
- BUKLOD Quiz: run secure assessments with authorized Organization/Class context.
- Do not say that using any one app automatically pays a fixed amount. More genuine useful participation may create more eligible platform activity and monetization opportunity.
$s14$,'RESTRICTED_INTERNAL',array['messaging','institution','economy']),
  (v_ver,'15_bsoc_support','BSOC, Support and Operational Control',15,$s15$
**BSOC ROLE**

BSOC observes, consolidates, assists, escalates and audits. BUKLOD Main provides the user-facing experience, self-recovery and support entry.

- Central BUKLOD Help -> automatic diagnostics -> safe self-heal -> support case only when unresolved -> BSOC Support Inbox.
- Permanent pre-login Need Help entry must exist for users who cannot sign in.
- Support cases should include safe diagnostic context: app/version/platform/route/recent safe error/account state/network/known incident/Organization context.
- Multiple user reports of the same systemic issue should correlate to a master incident rather than creating independent engineering investigations.
- Routine recoverable problems should self-heal. Human support should focus on unresolved exceptions.
- Support staff use capability-based roles, least privilege, audit, MFA and break-glass controls where appropriate.
- Normal BSOC roles do not get unrestricted access to platform revenue, user cash, Community Fund balances or payment credentials.
$s15$,'RESTRICTED_INTERNAL',array['bsoc','support','operations']),
  (v_ver,'16_finance_control_center','Finance Control Center Separation',16,$s16$
- Finance Control Center is separate from ordinary BSOC authorization.
- It may contain DAU/WAU/MAU, attributed monetization, user/referral/community liabilities, operating costs, profit by feature, infrastructure cost, profitability and anomaly alerts.
- BSOC may display operational health such as Economy Service HEALTHY/DEGRADED without exposing restricted financial totals to normal staff.
- Standalone app profitability should be evaluated through real revenue/cost/contribution-margin data rather than only user count.
- Future price, tax and accounting decisions should use current legal/accounting guidance and verified actual data.
$s16$,'RESTRICTED_INTERNAL',array['finance','bsoc','separation']),
  (v_ver,'17_reliability_self_heal','Reliability, Self-Heal and User Feedback',17,$s17$
**SUPPORT-SCALING PRINCIPLE**

Prevent -> Detect -> Explain -> Self-Heal -> Verify -> Escalate only if unresolved.

- No silent failure, tap-with-no-response, shake-only error or unexplained navigation.
- Every important action should expose an outcome: Processing, Success, Warning, Error, Next Step, Recovery or Need Support.
- All loading states require timeout/fallback/retry logic appropriate to the operation.
- Critical work must survive weak network, backgrounding, refresh or crash where feasible: Quiz answers, Classroom submissions, forms, reports, referral attribution and financial actions.
- Ad/AI/push/video dependency failure must degrade locally rather than taking down the whole experience.
- Known incidents should produce a useful user notice and reduce duplicate support work.
- Track support cases per 1,000 users, self-heal success, stuck loading, repeated concerns and error-to-ticket conversion.
- A recurring support issue should become a permanent product fix, guardrail or automatic recovery path.
$s17$,'INTERNAL',array['reliability','self-heal','support']),
  (v_ver,'18_security_financial_invariants','Security, Audit and Financial Invariants',18,$s18$
**FINANCIAL SAFETY**

One backend-authoritative settlement engine. No authoritative money formulas independently recreated in frontend components.

- Use integer-safe monetary arithmetic (for example centavos) and define rounding residue behavior.
- Every financial movement is ledgered and reproducible. Corrections use adjustment/reversal records rather than silent edits.
- Strict idempotency for settlement, referral qualification, one-time reward conversion, referral accrual, community allocation, withdrawal and Community Fund release.
- One active Community Contribution Destination per user.
- One lifetime one-time referral reward per genuine referred identity under the program.
- One first-line referral relationship; no downline cascade.
- One final release per Community Fund Request and no duplicate payout.
- Allocated amount must never exceed the finalized source amount.
- The same peso must not be assigned to two recipients.
- Points never create money; they only determine participation/progression or distribution weight under the applicable program.
- Admin cannot silently mutate financial history.
- Cross-Organization private data isolation must be server/database enforced, not frontend-filter only.
$s18$,'RESTRICTED_INTERNAL',array['security','audit','financial']),
  (v_ver,'19_release_engineering','Release Engineering and E2E Rules',19,$s19$
**CANONICAL PROCESS**

P0 CONTAINMENT -> STRUCTURE -> END-TO-END FUNCTION -> 1M SCALE HARDENING -> LOAD/FAILURE TEST -> EXACT RELEASE-CANDIDATE VERIFICATION -> RELEASE.

- TARGETED CHANGE ONLY: one request = one controlled change set. Freeze unrelated stable modules.
- Stability first. Zero white screen, zero uncontrolled endless loading and no routine recoverable issue requiring admin rescue.
- No piecemeal production deployment for interdependent features.
- Inspect current implementation before patching. Do not blindly rewrite a system that is already working.
- Financial/backend changes should be additive and backward-compatible where practical, with backup/reconciliation plans.
- Exact tested source SHA must equal released SHA.
- Any financial/security-critical file changed after verification invalidates the release candidate and requires the relevant E2E/regression suite again.
- Load/failure tests must cover slow/bad network, token/session expiry, API timeout, DB retry, refresh/background, double tap, old versions and dependency outage.
- Test 100, 1,000 and 10,000-member patterns for institutional architecture; use pagination, server filtering, indexes and lazy loading rather than full client-side loads.
$s19$,'RESTRICTED_INTERNAL',array['release','e2e','scale']),
  (v_ver,'20_reference_center_rules','Living Reference Implementation Inside BUKLOD',20,$s20$
This document should become an in-app, admin-editable, versioned reference so future policy changes are made once rather than scattered across chats/prompts.

**Recommended feature name:** BUKLOD CANONICAL REFERENCE CENTER

A controlled internal reference center containing the current approved BUKLOD rules, historical versions, change log and implementation status.

**Recommended access**
- Owner/Superadmin: edit draft, compare, approve/publish, supersede and roll back.
- Authorized Product/Operations Admin: propose edits and add implementation notes.
- Read-only staff: view current approved rules relevant to their role.
- Ordinary users should not see internal operational/financial implementation details unless a public-facing version is separately published.

**Recommended data model**
- document_key: Stable identifier, e.g. BUKLOD_CANONICAL_MASTER
- version: Semantic/version string
- status: DRAFT / REVIEW / APPROVED / EFFECTIVE / SUPERSEDED
- effective_at: When the version becomes canonical
- section_key: Stable section identifier
- title: Human-readable section name
- content: Markdown/rich-text body
- change_summary: What changed and why
- approved_by: Authorized approver
- created_at / updated_at: Audit timestamps
- supersedes_version: Prior effective version
- implementation_status: DOC_ONLY / PLANNED / BUILDING / VERIFIED / LIVE
- implementation_ref: Release/commit/migration reference where applicable

**Editing workflow**
1. Open current effective document.
2. Create a Draft from the current version; never edit the published historical version in place.
3. Edit only the relevant section(s).
4. Enter a change summary and affected modules.
5. Review the visual/text diff.
6. If the change affects logic, create/attach an implementation task and required tests.
7. Approve and publish only after required implementation is verified or explicitly mark the policy as future-effective.
8. Automatically retain the superseded version and change log.
9. Notify affected administrators when a material rule changes.

**CRITICAL**

The Reference Center is a governance source-of-truth, not an unrestricted runtime configuration editor. Financial percentages, permissions, security gates and settlement behavior must change only through controlled backend configuration/migrations plus verification.
$s20$,'RESTRICTED_INTERNAL',array['reference-center','governance','versioning']),
  (v_ver,'21_definitions_wording','Canonical Definitions and Wording Rules',21,$s21$
**Canonical meanings**
- **BUKLOD Organization:** Generic institutional/community workspace inside BUKLOD.
- **Sub-Organization:** Operational unit under a Parent Organization; not an independent automatic fund wallet.
- **Participant Benefits:** Benefits or allocations offered under an applicable BUKLOD program; not equity ownership.
- **User Revenue Pool:** Designated pool distributed using the applicable qualified-points formula.
- **Community Contribution Destination:** The single community selected by a user for future eligible Community Fund allocation.
- **Bayanihan Community Fund:** Governed community/institutional fund; not insurance and not an admin's personal wallet.
- **Institutional Board Mode:** Formal authorized-approver governance for Community Fund requests.
- **Hybrid Mode:** Member participation/advisory input plus formal authorized approval.
- **Designated Funding Base:** Funds/revenue explicitly assigned by BUKLOD to a specific program.
- **Reward:** Program incentive that may be funded separately from the participant-sharing base.
- **BSOC:** BUKLOD System Operations Center - operational support/health/control.
- **Finance Control Center:** Restricted financial/profitability control plane.

**Avoid / do not promise**
- "Every ad earns money."
- "Every share earns PHP 20."
- "All BUKLOD revenue is shared."
- "Every student automatically gives the school 7%."
- "The Organization Admin can withdraw the fund."
- "BUKLOD Bayanihan Insurance" or insurance/premium/guaranteed claim terminology.
- Guaranteed profit, guaranteed return or guaranteed Community Fund amount.
- Any wording that implies Organization membership automatically changes a user's Community Contribution Destination.

**Preferred wording**
- "Use BUKLOD for the things your organization already does."
- "Meaningful participation can unlock BUKLOD benefits and help build your organization's Bayanihan Community Fund, subject to applicable program rules."
- "One ecosystem. Useful tools. Continuous participation. Shared opportunity."
- "Your own institutional workspace, powered by BUKLOD."
- "Revenue or funds are included in a sharing/reward program only when BUKLOD explicitly designates them for that program."
$s21$,'RESTRICTED_INTERNAL',array['definitions','wording','messaging']),
  (v_ver,'22_change_log','Change Log',22,$s22$
**v1.0 - 21 September 2026 - All sections**

Initial consolidated canonical reference covering institutional workspace, economy, referrals, Community Fund governance, standalone apps, monetization positioning, rewards, BSOC/support, financial safety and release process.

Status: **EFFECTIVE**

### Appendix A - Current Working Financial Examples

These examples are implementation checks, not public earnings guarantees.

- Qualified 5% community during active first-line referral period: 30% User Pool + 10% Referral + 5% Community Fund + 55% BUKLOD.
- Qualified 7% Organization during active first-line referral period: 30% User Pool + 10% Referral + 7% Community Fund + 53% BUKLOD.
- Qualified 5% community after referral period: 30% User Pool + 5% Community Fund + 65% BUKLOD.
- Qualified 7% Organization after referral period: 30% User Pool + 7% Community Fund + 63% BUKLOD.
- No community beneficiary during active referral period: 30% User Pool + 10% Referral + 60% BUKLOD.
- No community beneficiary after referral period: 30% User Pool + 70% BUKLOD.

**RECONCILIATION RULE**

For every finalized settlement, source amount = all recipient allocations + BUKLOD retained amount + defined rounding residue. Unexplained difference must be zero.

### Appendix B - Golden E2E Scenarios

- One user belongs to three Organizations but has only one active Community Contribution Destination.
- Organization has 50 active members but 10 valid active designated contributors: 5% rate.
- Organization reaches 30 valid active designated contributors: 7% rate.
- 7% Organization drops below 30: configured grace applies; no retroactive clawback.
- Sub-Org originates a project request but receives no separate automatic 5%/7% wallet.
- Institutional Board 2-of-3 request cannot be released with only the requestor's approval.
- Approver removed before release: revalidate and return to awaiting approval if threshold no longer holds.
- Settlement/release API replayed twice: no duplicate money movement.
- Referral user deletes/recreates account/device session: no second lifetime one-time referral reward.
- Organization switch A -> B: no stale Report/Classroom/Quiz/Files data from A appears in B.
- Report/Quiz/Classroom/ad provider outage: Organization shell and unrelated modules continue where possible.
- Weak network/timeout: user gets clear status, safe retry/self-heal and no duplicate financial action.

### Appendix C - Update Checklist

- Which section changed?
- Is the change product wording only or does it change runtime behavior?
- Does it affect money, permissions, privacy, retention, security or data scope?
- Which apps/modules are affected?
- Is a DB/config/migration change required?
- What E2E/regression tests are required?
- Has the implementation reached VERIFIED/LIVE?
- Was the exact release reference recorded?
- Was the document version and change log updated?
- Were conflicting older prompts/rules explicitly superseded?

**FINAL CANONICAL PRINCIPLE**

BUKLOD should grow by making useful tools worth using, not by making monetization the visible product. Institutions receive a reusable BUKLOD workspace, users retain transparent choices, Community Funds remain governed and auditable, future BUKLOD business opportunities remain company revenue unless explicitly designated, and every important rule is updated in this one living reference.
$s22$,'RESTRICTED_INTERNAL',array['change-log','appendix','e2e'])
  on conflict(version_id,section_key) do nothing;

  update public.buklod_canonical_documents
  set current_effective_version_id=v_ver,
      updated_at=now()
  where id=v_doc
    and current_effective_version_id is null;

  if not exists(
    select 1 from public.buklod_canonical_change_log
    where document_id=v_doc and version_id=v_ver and change_type='SEED_IMPORTED'
  ) then
    insert into public.buklod_canonical_change_log(
      document_id,version_id,change_type,after_summary,reason,metadata
    )
    values(
      v_doc,v_ver,'SEED_IMPORTED',
      'BUKLOD Canonical Master Reference v1.0 imported as 22 stable sections.',
      'Initial approved canonical seed',
      jsonb_build_object(
        'source','BUKLOD_CANONICAL_MASTER_REFERENCE_v1.0.docx',
        'section_count',22,
        'effective_date','2026-09-21'
      )
    );
  end if;
end;
$seed$;

commit;
