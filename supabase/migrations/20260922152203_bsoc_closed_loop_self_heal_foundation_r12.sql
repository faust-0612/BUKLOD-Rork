-- BUKLOD BSOC Closed-Loop Self-Heal Foundation R12

-- Source reconstruction of the production foundation.

-- New remote playbooks remain SHADOW and executor_ready=false until full E2E.

begin;

create table if not exists public.bsoc_app_health_contracts (
  app_id text not null,
  contract_version integer default 1 not null,
  display_name text not null,
  enabled boolean default true not null,
  accepted_categories text[] default ARRAY['AUTH'::text, 'SESSION'::text, 'NETWORK'::text, 'SYNC'::text, 'ROUTE'::text, 'LOADING'::text, 'LOCAL_STORAGE'::text, 'SUBMISSION'::text, 'NOTIFICATION'::text, 'PERMISSION'::text, 'API'::text, 'CACHE'::text, 'ENTITLEMENT'::text, 'ORG_CONTEXT'::text, 'DEVICE_CONFLICT'::text, 'SERVICE_DEPENDENCY'::text, 'UNKNOWN'::text] not null,
  privacy_policy text default 'OPERATIONAL_METADATA_ONLY'::text not null,
  max_event_age_seconds integer default 86400 not null,
  dedupe_window_seconds integer default 300 not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  updated_by uuid,
  constraint bsoc_app_health_contracts_contract_version_check CHECK (contract_version > 0),
  constraint bsoc_app_health_contracts_dedupe_window_seconds_check CHECK (dedupe_window_seconds >= 10 AND dedupe_window_seconds <= 3600),
  constraint bsoc_app_health_contracts_max_event_age_seconds_check CHECK (max_event_age_seconds >= 60 AND max_event_age_seconds <= 604800),
  constraint bsoc_app_health_contracts_pkey PRIMARY KEY (app_id),
  constraint bsoc_app_health_contracts_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL
);

create table if not exists public.bsoc_recovery_playbooks (
  playbook_id text not null,
  version integer not null,
  app_id text,
  module_pattern text,
  health_category text not null,
  error_signature text not null,
  risk_level text not null,
  action_kind text not null,
  action_spec jsonb default '{}'::jsonb not null,
  max_attempts integer default 1 not null,
  timeout_seconds integer default 30 not null,
  cooldown_seconds integer default 300 not null,
  verification_type text not null,
  verification_criteria jsonb default '{}'::jsonb not null,
  safe_stop_behavior text not null,
  escalation_target text not null,
  audit_required boolean default true not null,
  mode text default 'SHADOW'::text not null,
  kill_switch boolean default false not null,
  enabled_at timestamp with time zone,
  enabled_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  qa_verified_at timestamp with time zone,
  qa_verified_by uuid,
  executor_ready boolean default false not null,
  constraint bsoc_recovery_playbooks_cooldown_seconds_check CHECK (cooldown_seconds >= 0 AND cooldown_seconds <= 86400),
  constraint bsoc_recovery_playbooks_enabled_by_fkey FOREIGN KEY (enabled_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  constraint bsoc_recovery_playbooks_max_attempts_check CHECK (max_attempts >= 1 AND max_attempts <= 5),
  constraint bsoc_recovery_playbooks_mode_check CHECK (mode = ANY (ARRAY['DISABLED'::text, 'SHADOW'::text, 'ENABLED'::text, 'RESTRICTED'::text])),
  constraint bsoc_recovery_playbooks_pkey PRIMARY KEY (playbook_id, version),
  constraint bsoc_recovery_playbooks_qa_verified_by_fkey FOREIGN KEY (qa_verified_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  constraint bsoc_recovery_playbooks_risk_level_check CHECK (risk_level = ANY (ARRAY['LOW'::text, 'MEDIUM'::text, 'HIGH'::text, 'PROHIBITED'::text])),
  constraint bsoc_recovery_playbooks_timeout_seconds_check CHECK (timeout_seconds >= 1 AND timeout_seconds <= 300),
  constraint bsoc_recovery_playbooks_version_check CHECK (version > 0)
);

create table if not exists public.bsoc_health_events (
  id uuid default gen_random_uuid() not null,
  client_event_id text,
  occurred_at timestamp with time zone not null,
  received_at timestamp with time zone default now() not null,
  user_id uuid not null,
  user_ref text not null,
  device_ref_hash text,
  session_ref_hash text,
  app_id text not null,
  app_version text,
  platform text not null,
  environment text not null,
  route_module text,
  health_category text not null,
  severity text not null,
  safe_error_code text not null,
  error_signature text not null,
  network_state text,
  auth_state text,
  sync_state text,
  local_storage_state text,
  notification_state text,
  last_successful_action text,
  pending_work_count integer default 0 not null,
  known_incident_hint text,
  local_self_heal_attempted boolean default false not null,
  local_self_heal_result text,
  correlation_key text not null,
  privacy_classification text default 'OPERATIONAL'::text not null,
  first_seen_at timestamp with time zone not null,
  last_seen_at timestamp with time zone not null,
  repeat_count integer default 1 not null,
  lifecycle_state text default 'DETECTED'::text not null,
  support_case_id uuid,
  incident_id uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint bsoc_health_events_category_chk CHECK (health_category = ANY (ARRAY['AUTH'::text, 'SESSION'::text, 'NETWORK'::text, 'SYNC'::text, 'ROUTE'::text, 'LOADING'::text, 'LOCAL_STORAGE'::text, 'SUBMISSION'::text, 'NOTIFICATION'::text, 'PERMISSION'::text, 'API'::text, 'CACHE'::text, 'ENTITLEMENT'::text, 'ORG_CONTEXT'::text, 'DEVICE_CONFLICT'::text, 'SERVICE_DEPENDENCY'::text, 'UNKNOWN'::text])),
  constraint bsoc_health_events_env_chk CHECK (environment = ANY (ARRAY['production'::text, 'staging'::text, 'development'::text])),
  constraint bsoc_health_events_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES pilot_incidents(id) ON DELETE SET NULL,
  constraint bsoc_health_events_lifecycle_state_check CHECK (lifecycle_state = ANY (ARRAY['DETECTED'::text, 'DIAGNOSING'::text, 'LOCAL_RECOVERY_ATTEMPTED'::text, 'REMOTE_RECOVERY_ELIGIBLE'::text, 'REMOTE_RECOVERY_RUNNING'::text, 'VERIFYING'::text, 'AUTO_HEALED'::text, 'RECOVERY_FAILED'::text, 'ESCALATED'::text, 'LINKED_TO_INCIDENT'::text])),
  constraint bsoc_health_events_local_result_chk CHECK (local_self_heal_result IS NULL OR (local_self_heal_result = ANY (ARRAY['NOT_ATTEMPTED'::text, 'SUCCESS'::text, 'FAILED'::text, 'INELIGIBLE'::text, 'UNKNOWN'::text]))),
  constraint bsoc_health_events_pending_work_count_check CHECK (pending_work_count >= 0 AND pending_work_count <= 1000000),
  constraint bsoc_health_events_pkey PRIMARY KEY (id),
  constraint bsoc_health_events_platform_chk CHECK (platform = ANY (ARRAY['android'::text, 'ios'::text, 'web'::text, 'desktop'::text, 'server'::text, 'other'::text])),
  constraint bsoc_health_events_privacy_chk CHECK (privacy_classification = ANY (ARRAY['OPERATIONAL'::text, 'MINIMAL'::text, 'SECURITY_REVIEW_REQUIRED'::text])),
  constraint bsoc_health_events_repeat_count_check CHECK (repeat_count >= 1),
  constraint bsoc_health_events_severity_chk CHECK (severity = ANY (ARRAY['INFO'::text, 'WARNING'::text, 'ERROR'::text, 'CRITICAL'::text])),
  constraint bsoc_health_events_support_case_id_fkey FOREIGN KEY (support_case_id) REFERENCES user_feedback(id) ON DELETE SET NULL,
  constraint bsoc_health_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

create table if not exists public.bsoc_recovery_runs (
  id uuid default gen_random_uuid() not null,
  event_id uuid not null,
  playbook_id text not null,
  playbook_version integer not null,
  mode text not null,
  state text not null,
  initiated_by uuid,
  target_user_id uuid not null,
  app_id text not null,
  route_module text,
  attempt_count integer default 0 not null,
  before_state jsonb default '{}'::jsonb not null,
  proposed_actions jsonb default '[]'::jsonb not null,
  after_state jsonb default '{}'::jsonb not null,
  verification_result text,
  failure_reason text,
  incident_id uuid,
  support_case_id uuid,
  started_at timestamp with time zone default now() not null,
  finished_at timestamp with time zone,
  updated_at timestamp with time zone default now() not null,
  constraint bsoc_recovery_runs_attempt_count_check CHECK (attempt_count >= 0),
  constraint bsoc_recovery_runs_event_id_fkey FOREIGN KEY (event_id) REFERENCES bsoc_health_events(id) ON DELETE CASCADE,
  constraint bsoc_recovery_runs_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES pilot_incidents(id) ON DELETE SET NULL,
  constraint bsoc_recovery_runs_initiated_by_fkey FOREIGN KEY (initiated_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  constraint bsoc_recovery_runs_mode_check CHECK (mode = ANY (ARRAY['SHADOW'::text, 'ENABLED'::text])),
  constraint bsoc_recovery_runs_pkey PRIMARY KEY (id),
  constraint bsoc_recovery_runs_state_chk CHECK (state = ANY (ARRAY['DIAGNOSING'::text, 'REMOTE_RECOVERY_ELIGIBLE'::text, 'SHADOW_PROPOSED'::text, 'REMOTE_RECOVERY_RUNNING'::text, 'VERIFYING'::text, 'AUTO_HEALED'::text, 'RECOVERY_FAILED'::text, 'ESCALATED'::text, 'LINKED_TO_INCIDENT'::text])),
  constraint bsoc_recovery_runs_support_case_id_fkey FOREIGN KEY (support_case_id) REFERENCES user_feedback(id) ON DELETE SET NULL,
  constraint bsoc_recovery_runs_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint bsoc_recovery_runs_verify_chk CHECK (verification_result IS NULL OR (verification_result = ANY (ARRAY['PASS'::text, 'FAIL'::text, 'PENDING'::text, 'NOT_RUN'::text])))
);

create table if not exists public.bsoc_recovery_commands (
  id uuid default gen_random_uuid() not null,
  recovery_run_id uuid not null,
  target_user_id uuid not null,
  app_id text not null,
  action_kind text not null,
  action_payload jsonb default '{}'::jsonb not null,
  status text default 'PENDING'::text not null,
  created_at timestamp with time zone default now() not null,
  delivered_at timestamp with time zone,
  acknowledged_at timestamp with time zone,
  expires_at timestamp with time zone not null,
  constraint bsoc_recovery_commands_pkey PRIMARY KEY (id),
  constraint bsoc_recovery_commands_recovery_run_id_action_kind_key UNIQUE (recovery_run_id, action_kind),
  constraint bsoc_recovery_commands_recovery_run_id_fkey FOREIGN KEY (recovery_run_id) REFERENCES bsoc_recovery_runs(id) ON DELETE CASCADE,
  constraint bsoc_recovery_commands_status_check CHECK (status = ANY (ARRAY['PENDING'::text, 'DELIVERED'::text, 'ACKNOWLEDGED'::text, 'EXPIRED'::text, 'CANCELLED'::text])),
  constraint bsoc_recovery_commands_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

create table if not exists public.bsoc_recovery_verifications (
  id uuid default gen_random_uuid() not null,
  recovery_run_id uuid not null,
  reporter_user_id uuid not null,
  verification_type text not null,
  success boolean not null,
  evidence_code text not null,
  safe_metrics jsonb default '{}'::jsonb not null,
  verified_at timestamp with time zone default now() not null,
  constraint bsoc_recovery_verifications_pkey PRIMARY KEY (id),
  constraint bsoc_recovery_verifications_recovery_run_id_fkey FOREIGN KEY (recovery_run_id) REFERENCES bsoc_recovery_runs(id) ON DELETE CASCADE,
  constraint bsoc_recovery_verifications_reporter_user_id_fkey FOREIGN KEY (reporter_user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

create table if not exists public.bsoc_recovery_audit (
  id uuid default gen_random_uuid() not null,
  initiator_id uuid,
  target_user_id uuid,
  app_id text not null,
  route_module text,
  playbook_id text,
  playbook_version integer,
  recovery_run_id uuid,
  event_id uuid,
  reason text not null,
  before_state jsonb default '{}'::jsonb not null,
  actions jsonb default '[]'::jsonb not null,
  after_state jsonb default '{}'::jsonb not null,
  verification_result text,
  duration_ms integer,
  attempt_count integer default 0 not null,
  incident_id uuid,
  support_case_id uuid,
  occurred_at timestamp with time zone default now() not null,
  constraint bsoc_recovery_audit_event_id_fkey FOREIGN KEY (event_id) REFERENCES bsoc_health_events(id) ON DELETE SET NULL,
  constraint bsoc_recovery_audit_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES pilot_incidents(id) ON DELETE SET NULL,
  constraint bsoc_recovery_audit_initiator_id_fkey FOREIGN KEY (initiator_id) REFERENCES auth.users(id) ON DELETE SET NULL,
  constraint bsoc_recovery_audit_pkey PRIMARY KEY (id),
  constraint bsoc_recovery_audit_recovery_run_id_fkey FOREIGN KEY (recovery_run_id) REFERENCES bsoc_recovery_runs(id) ON DELETE SET NULL,
  constraint bsoc_recovery_audit_support_case_id_fkey FOREIGN KEY (support_case_id) REFERENCES user_feedback(id) ON DELETE SET NULL,
  constraint bsoc_recovery_audit_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES auth.users(id) ON DELETE SET NULL
);

create table if not exists public.bsoc_health_incident_clusters (
  id uuid default gen_random_uuid() not null,
  correlation_key text not null,
  app_id text not null,
  app_version text,
  route_module text,
  dependency_key text,
  error_signature text not null,
  first_seen_at timestamp with time zone not null,
  last_seen_at timestamp with time zone not null,
  occurrence_count integer default 1 not null,
  affected_user_count integer default 1 not null,
  incident_id uuid,
  status text default 'OPEN'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  environment text,
  platform text,
  constraint bsoc_health_incident_clusters_affected_user_count_check CHECK (affected_user_count >= 1),
  constraint bsoc_health_incident_clusters_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES pilot_incidents(id) ON DELETE SET NULL,
  constraint bsoc_health_incident_clusters_occurrence_count_check CHECK (occurrence_count >= 1),
  constraint bsoc_health_incident_clusters_pkey PRIMARY KEY (id),
  constraint bsoc_health_incident_clusters_status_check CHECK (status = ANY (ARRAY['OPEN'::text, 'MONITORING'::text, 'CLOSED'::text]))
);

CREATE INDEX IF NOT EXISTS idx_bsoc_health_events_app_state ON public.bsoc_health_events USING btree (app_id, lifecycle_state, last_seen_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bsoc_health_events_client_event ON public.bsoc_health_events USING btree (user_id, app_id, client_event_id) WHERE (client_event_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_bsoc_health_events_correlation_time ON public.bsoc_health_events USING btree (correlation_key, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_bsoc_health_events_signature_time ON public.bsoc_health_events USING btree (error_signature, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_bsoc_health_events_user_time ON public.bsoc_health_events USING btree (user_id, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_bsoc_health_clusters_key_open ON public.bsoc_health_incident_clusters USING btree (correlation_key, status, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_bsoc_recovery_audit_target ON public.bsoc_recovery_audit USING btree (target_user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_bsoc_recovery_audit_time ON public.bsoc_recovery_audit USING btree (occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_bsoc_recovery_commands_user_status ON public.bsoc_recovery_commands USING btree (target_user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bsoc_recovery_runs_event ON public.bsoc_recovery_runs USING btree (event_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_bsoc_recovery_runs_user ON public.bsoc_recovery_runs USING btree (target_user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_bsoc_recovery_verifications_run ON public.bsoc_recovery_verifications USING btree (recovery_run_id, verified_at DESC);

alter table public.bsoc_app_health_contracts enable row level security;

alter table public.bsoc_recovery_playbooks enable row level security;

alter table public.bsoc_health_events enable row level security;

alter table public.bsoc_recovery_runs enable row level security;

alter table public.bsoc_recovery_commands enable row level security;

alter table public.bsoc_recovery_verifications enable row level security;

alter table public.bsoc_recovery_audit enable row level security;

alter table public.bsoc_health_incident_clusters enable row level security;

drop policy if exists "BSOC health contracts read" on public.bsoc_app_health_contracts;
create policy "BSOC health contracts read" on public.bsoc_app_health_contracts
  for select to authenticated
  using ((buklod_bsoc_can('bsoc.observability.read'::text) OR buklod_bsoc_can('bsoc.playbooks.read'::text)));

drop policy if exists "BSOC health events ops read" on public.bsoc_health_events;
create policy "BSOC health events ops read" on public.bsoc_health_events
  for select to authenticated
  using ((buklod_bsoc_can('bsoc.observability.read'::text) OR buklod_bsoc_can('bsoc.user360.read'::text) OR (user_id = ( SELECT auth.uid() AS uid))));

drop policy if exists "BSOC health clusters ops read" on public.bsoc_health_incident_clusters;
create policy "BSOC health clusters ops read" on public.bsoc_health_incident_clusters
  for select to authenticated
  using ((buklod_bsoc_can('bsoc.incidents.read'::text) OR buklod_bsoc_can('bsoc.observability.read'::text)));

drop policy if exists "BSOC recovery audit read" on public.bsoc_recovery_audit;
create policy "BSOC recovery audit read" on public.bsoc_recovery_audit
  for select to authenticated
  using ((buklod_bsoc_can('bsoc.audit.read'::text) OR buklod_is_system_admin()));

drop policy if exists "BSOC recovery commands self read" on public.bsoc_recovery_commands;
create policy "BSOC recovery commands self read" on public.bsoc_recovery_commands
  for select to authenticated
  using ((target_user_id = ( SELECT auth.uid() AS uid)));

drop policy if exists "BSOC playbooks read" on public.bsoc_recovery_playbooks;
create policy "BSOC playbooks read" on public.bsoc_recovery_playbooks
  for select to authenticated
  using ((buklod_bsoc_can('bsoc.playbooks.read'::text) OR buklod_is_system_admin()));

drop policy if exists "BSOC recovery runs ops read" on public.bsoc_recovery_runs;
create policy "BSOC recovery runs ops read" on public.bsoc_recovery_runs
  for select to authenticated
  using ((buklod_bsoc_can('bsoc.observability.read'::text) OR buklod_bsoc_can('bsoc.user360.read'::text) OR (target_user_id = ( SELECT auth.uid() AS uid))));

drop policy if exists "BSOC recovery verifications ops read" on public.bsoc_recovery_verifications;
create policy "BSOC recovery verifications ops read" on public.bsoc_recovery_verifications
  for select to authenticated
  using (((reporter_user_id = ( SELECT auth.uid() AS uid)) OR buklod_bsoc_can('bsoc.observability.read'::text)));


insert into public.bsoc_app_health_contracts(
  app_id,contract_version,display_name,enabled,accepted_categories,
  privacy_policy,max_event_age_seconds,dedupe_window_seconds
) values
  ('BUKLOD_MAIN',1,'BUKLOD Main',true,array['AUTH','SESSION','NETWORK','SYNC','ROUTE','LOADING','LOCAL_STORAGE','SUBMISSION','NOTIFICATION','PERMISSION','API','CACHE','ENTITLEMENT','ORG_CONTEXT','DEVICE_CONFLICT','SERVICE_DEPENDENCY','UNKNOWN']::text[],'OPERATIONAL_METADATA_ONLY',86400,300),
  ('BUKLOD_QUIZ',1,'BUKLOD Quiz',true,array['AUTH','SESSION','NETWORK','SYNC','ROUTE','LOADING','LOCAL_STORAGE','SUBMISSION','NOTIFICATION','PERMISSION','API','CACHE','ENTITLEMENT','ORG_CONTEXT','DEVICE_CONFLICT','SERVICE_DEPENDENCY','UNKNOWN']::text[],'OPERATIONAL_METADATA_ONLY',86400,300),
  ('BUKLOD_CLASSROOM',1,'BUKLOD Classroom',true,array['AUTH','SESSION','NETWORK','SYNC','ROUTE','LOADING','LOCAL_STORAGE','SUBMISSION','NOTIFICATION','PERMISSION','API','CACHE','ENTITLEMENT','ORG_CONTEXT','DEVICE_CONFLICT','SERVICE_DEPENDENCY','UNKNOWN']::text[],'OPERATIONAL_METADATA_ONLY',86400,300),
  ('BUKLOD_QUICKCHECK',1,'BUKLOD QuickCheck',true,array['AUTH','SESSION','NETWORK','SYNC','ROUTE','LOADING','LOCAL_STORAGE','SUBMISSION','NOTIFICATION','PERMISSION','API','CACHE','ENTITLEMENT','ORG_CONTEXT','DEVICE_CONFLICT','SERVICE_DEPENDENCY','UNKNOWN']::text[],'OPERATIONAL_METADATA_ONLY',86400,300),
  ('BUKLOD_REPORT',1,'BUKLOD Report',true,array['AUTH','SESSION','NETWORK','SYNC','ROUTE','LOADING','LOCAL_STORAGE','SUBMISSION','NOTIFICATION','PERMISSION','API','CACHE','ENTITLEMENT','ORG_CONTEXT','DEVICE_CONFLICT','SERVICE_DEPENDENCY','UNKNOWN']::text[],'OPERATIONAL_METADATA_ONLY',86400,300)
on conflict (app_id) do update
set contract_version=excluded.contract_version,
    display_name=excluded.display_name,
    enabled=excluded.enabled,
    accepted_categories=excluded.accepted_categories,
    privacy_policy=excluded.privacy_policy,
    max_event_age_seconds=excluded.max_event_age_seconds,
    dedupe_window_seconds=excluded.dedupe_window_seconds,
    updated_at=now();

insert into public.bsoc_recovery_playbooks(
  playbook_id,version,app_id,module_pattern,health_category,error_signature,
  risk_level,action_kind,action_spec,max_attempts,timeout_seconds,cooldown_seconds,
  verification_type,verification_criteria,safe_stop_behavior,escalation_target,
  audit_required,mode,kill_switch,executor_ready
) values
('AUTH_SESSION_STALE_V1',1,null,null,'AUTH','AUTH_SESSION_STALE','LOW',
 'REQUEST_CLIENT_SESSION_REFRESH','{"scope":"single_user_session","destructive":false}'::jsonb,
 1,30,300,'AUTH_HEARTBEAT','{"requires":["AUTH_OK","PROTECTED_ROUTE_OK","CORRECT_USER_CONTEXT"]}'::jsonb,
 'Do not alter account/roles; stop on security lock or user switch.','SUPPORT_OR_SECURITY',true,'SHADOW',false,false),
('SYNC_QUEUE_STUCK_V1',1,null,null,'SYNC','SYNC_QUEUE_STUCK','LOW',
 'REQUEST_CLIENT_SYNC_RESUME','{"destructive":false,"idempotent_only":true}'::jsonb,
 2,45,300,'SYNC_ACK','{"requires":["PENDING_REDUCED_OR_CLEARED","SERVER_ACK","NO_DUPLICATE"]}'::jsonb,
 'Preserve durable local work; never clear unsynced authoritative data.','APP_OPERATIONS',true,'SHADOW',false,false),
('ROUTE_LOAD_TIMEOUT_V1',1,null,null,'LOADING','ROUTE_LOAD_TIMEOUT','LOW',
 'REQUEST_CLIENT_ROUTE_RECOVERY','{"bounded_retry":true,"fallback_required":true}'::jsonb,
 2,20,180,'ROUTE_RENDER','{"requires":["TARGET_ROUTE_RENDERED","TIMEOUT_SIGNATURE_GONE"]}'::jsonb,
 'No infinite retry; preserve current user/context.','APP_OPERATIONS',true,'SHADOW',false,false),
('PUSH_REGISTRATION_STALE_V1',1,null,null,'NOTIFICATION','PUSH_REGISTRATION_STALE','LOW',
 'REQUEST_CLIENT_PUSH_REFRESH','{"destructive":false,"registration_only":true}'::jsonb,
 1,30,600,'PUSH_REGISTRATION','{"requires":["REGISTRATION_OK","CURRENT_STATE_OK"]}'::jsonb,
 'Never block core app behavior on push failure.','APP_OPERATIONS',true,'SHADOW',false,false),
('ORG_CONTEXT_STALE_V1',1,null,null,'ORG_CONTEXT','ORG_CONTEXT_STALE','LOW',
 'REQUEST_CLIENT_ORG_RERESOLVE','{"destructive":false,"authorized_scope_only":true}'::jsonb,
 1,30,300,'ORG_CONTEXT','{"requires":["AUTHORIZED_SCOPE_OK","NO_CROSS_ORG_LEAK"]}'::jsonb,
 'Never auto-switch to an unauthorized Organization.','ORG_SUPPORT',true,'SHADOW',false,false)
on conflict (playbook_id,version) do nothing;


commit;

