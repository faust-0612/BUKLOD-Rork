begin;

create extension if not exists pgtap with schema extensions;

select plan(36);

-- Fixed isolated identities; all test mutations roll back.
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
  ('90000000-0000-0000-0000-000000000001','authenticated','authenticated','canonical-owner@test.local','',now(),'{}','{}',now(),now()),
  ('90000000-0000-0000-0000-000000000002','authenticated','authenticated','canonical-editor@test.local','',now(),'{}','{}',now(),now()),
  ('90000000-0000-0000-0000-000000000003','authenticated','authenticated','canonical-reader@test.local','',now(),'{}','{}',now(),now()),
  ('90000000-0000-0000-0000-000000000004','authenticated','authenticated','canonical-ordinary@test.local','',now(),'{}','{}',now(),now())
on conflict(id) do nothing;

insert into public.profiles(id,full_name,is_active)
values
  ('90000000-0000-0000-0000-000000000001','Canonical Owner Test',true),
  ('90000000-0000-0000-0000-000000000002','Canonical Editor Test',true),
  ('90000000-0000-0000-0000-000000000003','Canonical Reader Test',true),
  ('90000000-0000-0000-0000-000000000004','Canonical Ordinary Test',true)
on conflict(id) do update set is_active=true;

insert into public.user_roles(user_id,role,is_active)
values('90000000-0000-0000-0000-000000000001','system_admin',true)
on conflict(user_id,role) do update set is_active=true;

insert into public.buklod_foundation_roles(
  role_key,label,description,scope_required,admin_role,is_active
)
values
  ('CANONICAL_TEST_EDITOR','Canonical Test Editor','Test-only product/operations editor',false,true,true),
  ('CANONICAL_TEST_READER','Canonical Test Reader','Test-only read-only canonical staff',false,false,true)
on conflict(role_key) do update
set is_active=true;

insert into public.buklod_foundation_role_permissions(role_key,permission_key)
values
  ('CANONICAL_TEST_EDITOR','canonical.reference.view'),
  ('CANONICAL_TEST_EDITOR','canonical.reference.restricted_view'),
  ('CANONICAL_TEST_EDITOR','canonical.reference.draft'),
  ('CANONICAL_TEST_EDITOR','canonical.reference.review'),
  ('CANONICAL_TEST_EDITOR','canonical.reference.implementation'),
  ('CANONICAL_TEST_READER','canonical.reference.view')
on conflict(role_key,permission_key) do nothing;

insert into public.buklod_foundation_role_assignments(
  user_id,role_key,scope_type,scope_id,status,reason
)
values
  ('90000000-0000-0000-0000-000000000002','CANONICAL_TEST_EDITOR','GLOBAL',null,'ACTIVE','Reference Center pgTAP'),
  ('90000000-0000-0000-0000-000000000003','CANONICAL_TEST_READER','GLOBAL',null,'ACTIVE','Reference Center pgTAP');

create temporary table canonical_test_state(
  key text primary key,
  value_uuid uuid,
  value_int integer
);

select ok(
  exists(
    select 1 from public.buklod_foundation_roles
    where role_key='CANONICAL_REFERENCE_EDITOR'
      and is_active=true
      and scope_required=false
  ),
  'delegated Canonical Reference Editor role is seeded'
);

select ok(
  exists(
    select 1 from public.buklod_foundation_roles
    where role_key='CANONICAL_REFERENCE_READER'
      and is_active=true
      and scope_required=false
  ),
  'read-only Canonical Reference Reader role is seeded'
);

select ok(
  not exists(
    select 1
    from public.buklod_foundation_role_permissions
    where role_key='CANONICAL_REFERENCE_EDITOR'
      and permission_key in(
        'canonical.reference.approve',
        'canonical.reference.publish',
        'canonical.reference.high_risk_publish'
      )
  ),
  'delegated editor has no approve/publish authority by default'
);

select is(
  (select version from public.buklod_canonical_document_versions v
   join public.buklod_canonical_documents d on d.current_effective_version_id=v.id
   where d.document_key='BUKLOD_CANONICAL_MASTER'),
  '1.0',
  'seed v1.0 is the initial effective version'
);

select is(
  (select count(*)::integer
   from public.buklod_canonical_sections s
   join public.buklod_canonical_document_versions v on v.id=s.version_id
   join public.buklod_canonical_documents d on d.id=v.document_id
   where d.document_key='BUKLOD_CANONICAL_MASTER' and v.version='1.0'),
  22,
  'seed has exactly 22 stable sections'
);

select is(
  (select count(*)::integer
   from public.buklod_canonical_document_versions v
   join public.buklod_canonical_documents d on d.id=v.document_id
   where d.document_key='BUKLOD_CANONICAL_MASTER' and v.status='EFFECTIVE'),
  1,
  'exactly one effective version exists'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.buklod_canonical_publish_v1(uuid,integer)',
    'EXECUTE'
  ),
  'anonymous role cannot execute publish'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.buklod_canonical_audit_v1(text,uuid,uuid,text,text,text,text,jsonb)',
    'EXECUTE'
  ),
  'authenticated clients cannot directly execute internal audit helper'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.buklod_canonical_document_versions',
    'INSERT'
  ),
  'authenticated clients cannot directly insert canonical versions'
);

-- Ordinary user: no internal access.
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000004',true);
select set_config('request.jwt.claim.role','authenticated',true);

select throws_ok(
  $$select public.buklod_canonical_current_v1('BUKLOD_CANONICAL_MASTER')$$,
  'P0001',
  'Canonical Reference permission required: canonical.reference.view',
  'ordinary user cannot open internal Canonical Reference'
);

-- Read-only staff: permitted effective INTERNAL content, no restricted financial section, no edits.
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000003',true);

select ok(
  (public.buklod_canonical_current_v1('BUKLOD_CANONICAL_MASTER')->'permissions'->>'can_view')::boolean,
  'read-only staff can view permitted internal canonical content'
);

select ok(
  not (public.buklod_canonical_current_v1('BUKLOD_CANONICAL_MASTER')->'permissions'->>'can_restricted_view')::boolean,
  'read-only staff without restricted permission cannot view restricted sections'
);

set local role authenticated;
select is(
  (select count(*)::integer
   from public.buklod_canonical_sections s
   join public.buklod_canonical_documents d
     on d.current_effective_version_id=s.version_id
   where d.document_key='BUKLOD_CANONICAL_MASTER'),
  5,
  'RLS exposes only INTERNAL sections to basic read-only canonical staff'
);
reset role;

select throws_ok(
  $$select public.buklod_canonical_section_v1(
      (select current_effective_version_id from public.buklod_canonical_documents where document_key='BUKLOD_CANONICAL_MASTER'),
      '08_referral_program'
    )$$,
  'P0001',
  'Canonical section not found',
  'restricted referral section is hidden from basic read-only staff'
);

select throws_ok(
  $$select public.buklod_canonical_create_draft_v1(
      'BUKLOD_CANONICAL_MASTER','99.1','unauthorized draft','{}','NORMAL',null,null,'reader-draft'
    )$$,
  'P0001',
  'Canonical Reference permission required: canonical.reference.draft',
  'read-only staff cannot create drafts'
);

-- Product/operations editor can draft, edit and submit but has no publish authority.
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000002',true);

insert into canonical_test_state(key,value_uuid)
select 'draft1',public.buklod_canonical_create_draft_v1(
  'BUKLOD_CANONICAL_MASTER',
  '99.1',
  'Reference Center normal lifecycle test',
  array['BUKLOD Main'],
  'NORMAL',
  'pgTAP normal lifecycle',
  null,
  'canonical-test-draft-99-1'
);

select ok(
  (select value_uuid is not null from canonical_test_state where key='draft1'),
  'authorized product/operations editor can create draft'
);

select is(
  public.buklod_canonical_create_draft_v1(
    'BUKLOD_CANONICAL_MASTER',
    '99.1',
    'Reference Center normal lifecycle test',
    array['BUKLOD Main'],
    'NORMAL',
    'pgTAP normal lifecycle',
    null,
    'canonical-test-draft-99-1'
  ),
  (select value_uuid from canonical_test_state where key='draft1'),
  'replayed draft request returns the same draft id'
);

insert into canonical_test_state(key,value_int)
select 'section1-rev',
       revision
from public.buklod_canonical_sections
where version_id=(select value_uuid from canonical_test_state where key='draft1')
  and section_key='02_product_architecture';

select ok(
  (public.buklod_canonical_save_section_v1(
    (select value_uuid from canonical_test_state where key='draft1'),
    '02_product_architecture',
    'BUKLOD Product Architecture',
    (select content_markdown||E'\n\npgTAP normal edit.'
     from public.buklod_canonical_sections
     where version_id=(select value_uuid from canonical_test_state where key='draft1')
       and section_key='02_product_architecture'),
    (select value_int from canonical_test_state where key='section1-rev'),
    'pgTAP normal section edit'
  )->>'revision')::integer >
  (select value_int from canonical_test_state where key='section1-rev'),
  'section edit advances section revision'
);

select ok(
  (select revision > 1
   from public.buklod_canonical_document_versions
   where id=(select value_uuid from canonical_test_state where key='draft1')),
  'section edit also advances parent version revision'
);

select throws_like(
  format(
    'select public.buklod_canonical_save_section_v1(%L::uuid,%L,%L,%L,%s,%L)',
    (select value_uuid from canonical_test_state where key='draft1'),
    '02_product_architecture',
    'BUKLOD Product Architecture',
    'stale overwrite attempt',
    (select value_int from canonical_test_state where key='section1-rev'),
    'stale edit'
  ),
  '%STALE_CANONICAL_SECTION%',
  'stale section save is rejected instead of overwriting newer content'
);

select is(
  (public.buklod_canonical_submit_review_v1(
    (select value_uuid from canonical_test_state where key='draft1'),
    (select revision from public.buklod_canonical_document_versions where id=(select value_uuid from canonical_test_state where key='draft1')),
    'ready for normal review'
  )->>'status'),
  'REVIEW',
  'authorized editor can submit draft for review'
);

select throws_ok(
  format(
    'select public.buklod_canonical_review_decision_v1(%L::uuid,true,%s,%L)',
    (select value_uuid from canonical_test_state where key='draft1'),
    (select revision from public.buklod_canonical_document_versions where id=(select value_uuid from canonical_test_state where key='draft1')),
    'editor cannot self-approve'
  ),
  'P0001',
  'Canonical Reference permission required: canonical.reference.approve',
  'editor without approve permission cannot approve'
);

-- Owner/superadmin approves.
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000001',true);

select is(
  (public.buklod_canonical_review_decision_v1(
    (select value_uuid from canonical_test_state where key='draft1'),
    true,
    (select revision from public.buklod_canonical_document_versions where id=(select value_uuid from canonical_test_state where key='draft1')),
    'owner approves normal change'
  )->>'status'),
  'APPROVED',
  'owner can approve normal-risk reviewed version'
);

-- Product editor still cannot publish an approved version.
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000002',true);
select throws_ok(
  format(
    'select public.buklod_canonical_publish_v1(%L::uuid,%s)',
    (select value_uuid from canonical_test_state where key='draft1'),
    (select revision from public.buklod_canonical_document_versions where id=(select value_uuid from canonical_test_state where key='draft1'))
  ),
  'P0001',
  'Canonical Reference permission required: canonical.reference.publish',
  'product/operations editor cannot publish without separate publish authority'
);

select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000001',true);
select is(
  (public.buklod_canonical_publish_v1(
    (select value_uuid from canonical_test_state where key='draft1'),
    (select revision from public.buklod_canonical_document_versions where id=(select value_uuid from canonical_test_state where key='draft1'))
  )->>'status'),
  'EFFECTIVE',
  'owner can publish approved normal-risk version'
);

select is(
  (select status from public.buklod_canonical_document_versions v
   join public.buklod_canonical_documents d on d.id=v.document_id
   where d.document_key='BUKLOD_CANONICAL_MASTER' and v.version='1.0'),
  'SUPERSEDED',
  'prior effective v1.0 remains in immutable history as SUPERSEDED'
);

select is(
  (select count(*)::integer
   from public.buklod_canonical_document_versions v
   join public.buklod_canonical_documents d on d.id=v.document_id
   where d.document_key='BUKLOD_CANONICAL_MASTER' and v.status='EFFECTIVE'),
  1,
  'publish preserves exactly one effective pointer/version'
);

-- High-risk financial change: diff review mandatory; publication still does not touch runtime finance tables.
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000002',true);
insert into canonical_test_state(key,value_uuid)
select 'draft2',public.buklod_canonical_create_draft_v1(
  'BUKLOD_CANONICAL_MASTER',
  '99.2',
  'Reference Center financial guard test',
  array['Economy','Referral'],
  'FINANCIAL',
  'pgTAP financial guard',
  null,
  'canonical-test-draft-99-2'
);

select ok(
  public.buklod_canonical_save_section_v1(
    (select value_uuid from canonical_test_state where key='draft2'),
    '08_referral_program',
    'Referral Program',
    (select content_markdown||E'\n\npgTAP financial wording change.'
     from public.buklod_canonical_sections
     where version_id=(select value_uuid from canonical_test_state where key='draft2')
       and section_key='08_referral_program'),
    (select revision
     from public.buklod_canonical_sections
     where version_id=(select value_uuid from canonical_test_state where key='draft2')
       and section_key='08_referral_program'),
    'pgTAP financial section edit'
  ) is not null,
  'financial draft section can be edited without changing runtime finance'
);

select is(
  (select change_type
   from public.buklod_canonical_compare_versions_v1(
     (select supersedes_version_id from public.buklod_canonical_document_versions where id=(select value_uuid from canonical_test_state where key='draft2')),
     (select value_uuid from canonical_test_state where key='draft2')
   )
   where section_key='08_referral_program'),
  'CHANGED',
  'financial wording diff is visible at section level'
);

select is(
  (public.buklod_canonical_submit_review_v1(
    (select value_uuid from canonical_test_state where key='draft2'),
    (select revision from public.buklod_canonical_document_versions where id=(select value_uuid from canonical_test_state where key='draft2')),
    'financial review'
  )->>'status'),
  'REVIEW',
  'financial draft can enter review'
);

select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000001',true);

select throws_ok(
  format(
    'select public.buklod_canonical_review_decision_v1(%L::uuid,true,%s,%L)',
    (select value_uuid from canonical_test_state where key='draft2'),
    (select revision from public.buklod_canonical_document_versions where id=(select value_uuid from canonical_test_state where key='draft2')),
    'attempt approval before diff review'
  ),
  'P0001',
  'DIFF_REVIEW_REQUIRED',
  'financial approval is blocked until diff review is recorded'
);

select is(
  (public.buklod_canonical_mark_diff_reviewed_v1(
    (select value_uuid from canonical_test_state where key='draft2'),
    (select revision from public.buklod_canonical_document_versions where id=(select value_uuid from canonical_test_state where key='draft2'))
  )->>'risk_level'),
  'FINANCIAL',
  'authorized reviewer can record mandatory financial diff review'
);

select is(
  (public.buklod_canonical_review_decision_v1(
    (select value_uuid from canonical_test_state where key='draft2'),
    true,
    (select revision from public.buklod_canonical_document_versions where id=(select value_uuid from canonical_test_state where key='draft2')),
    'owner approves after financial diff review'
  )->>'status'),
  'APPROVED',
  'financial version can be approved after mandatory diff review'
);

select is(
  (public.buklod_canonical_publish_v1(
    (select value_uuid from canonical_test_state where key='draft2'),
    (select revision from public.buklod_canonical_document_versions where id=(select value_uuid from canonical_test_state where key='draft2'))
  )->>'status'),
  'EFFECTIVE',
  'system owner with elevated authority can publish approved financial policy text'
);

select is(
  (select count(*)::integer
   from public.buklod_canonical_document_versions v
   join public.buklod_canonical_documents d on d.id=v.document_id
   where d.document_key='BUKLOD_CANONICAL_MASTER' and v.status='EFFECTIVE'),
  1,
  'high-risk publish still preserves one effective version'
);

-- Implementation linkage remains independent from policy effective status.
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000002',true);
select is(
  (public.buklod_canonical_set_implementation_v1(
    (select value_uuid from canonical_test_state where key='draft2'),
    'BUILDING',
    'PENDING_IMPLEMENTATION',
    'test-sha-not-live',
    (select revision from public.buklod_canonical_document_versions where id=(select value_uuid from canonical_test_state where key='draft2')),
    'pgTAP implementation linkage'
  )->>'implementation_status'),
  'BUILDING',
  'implementation status can be tracked separately from policy approval'
);

select is(
  (select status from public.buklod_canonical_document_versions where id=(select value_uuid from canonical_test_state where key='draft2')),
  'EFFECTIVE',
  'implementation metadata update does not change effective policy status'
);

select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000001',true);
select ok(
  exists(
    select 1
    from public.buklod_canonical_search_v1('financial wording',false,30)
    where version='99.2' and version_status='EFFECTIVE'
  ),
  'default search resolves against the current effective version'
);

select ok(
  (select content_markdown like '%PHP 20%'
   from public.buklod_canonical_sections
   where version_id=(select id from public.buklod_canonical_document_versions v
                     join public.buklod_canonical_documents d on d.id=v.document_id
                     where d.document_key='BUKLOD_CANONICAL_MASTER' and v.version='1.0')
     and section_key='08_referral_program'),
  'original v1.0 referral wording remains readable and unchanged in history'
);

select * from finish();

rollback;
