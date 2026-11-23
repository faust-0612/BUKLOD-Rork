-- Source-of-truth Academy learning adapters and explicit readiness gates.
-- Readable in Academy Admin; source READY never bypasses credential evidence gates.
create table if not exists public.buklod_academy_learning_sources (
 source_module text primary key,
 display_label text not null,
 canonical_evidence text not null,
 base_uc integer not null check(base_uc>0 and base_uc<=150),
 readiness text not null check(readiness in ('DEV_VERIFIED','DEV_BRIDGE','PENDING_SOURCE','BLOCKED_CONTENT')),
 blocker_note text not null default '',
 updated_at timestamptz not null default now()
);
insert into public.buklod_academy_learning_sources
(source_module,display_label,canonical_evidence,base_uc,readiness,blocker_note) values
('daily_reading','Daily Reading','daily_bible_submissions + buklod_points_ledger',1,'DEV_VERIFIED','Approved submission and matching credit ledger source_id'),
('word','Word / Devotional','devotional_reward_submissions + buklod_points_ledger',2,'DEV_VERIFIED','Approved reflection and matching credit ledger source_id'),
('bible_reading','Bible Reading','chapter + reflection/rubric completion validator',3,'PENDING_SOURCE','Opening/finishing reading session does not prove evaluated reflection'),
('children_story','Children''s Story','comprehension attempt + evidence of passed questions',3,'PENDING_SOURCE','Narrative completion must include verified comprehension'),
('kl','Kingdom Library','chapter quiz passed + required comment',5,'PENDING_SOURCE','Legacy KL achievement rows need chapter+quiz+comment proof'),
('abaka_foundation','ABaKa foundation','buklod_abc_growth_progress + points ledger',5,'DEV_VERIFIED','Approved 28 canonical prelim/A-Z lesson source IDs'),
('abaka_intermediate','ABaKa intermediate','tiered ABaKa advanced completion policy',8,'PENDING_SOURCE','Needs approved DEV doctrinal tier mapping'),
('abaka_advanced','ABaKa advanced','tiered ABaKa advanced completion policy',12,'PENDING_SOURCE','Needs server-side difficulty validator'),
('abaka_deep','ABaKa deep','tiered ABaKa continuing doctrinal lessons',16,'PENDING_SOURCE','Needs deep-study policy and non-repeat verifications'),
('formation_101_104','BUKLOD formation 101-104','official formation validated lesson completion',8,'PENDING_SOURCE','Reconcile source tables and stage/role gates'),
('formation_105','BUKLOD 105 leadership','official published leadership lesson + requirements',12,'BLOCKED_CONTENT','105 source content slot discrepancy; no premature graduation'),
('formation_106','BUKLOD 106 worker role','published assigned role lesson + validations',16,'BLOCKED_CONTENT','17/18 source versions not published in verified MAIN snapshot'),
('formation_107','BUKLOD 107 mission','published mission lesson + mission readiness',20,'BLOCKED_CONTENT','2/3 source versions not published in verified MAIN snapshot'),
('saliksik_research','SALIKSIK research','evidence-reviewed original writing + citations',40,'DEV_BRIDGE','40/60/80/100/150 vary by research output; merge PR #780 source contract')
on conflict(source_module) do nothing;
alter table public.buklod_academy_learning_sources enable row level security;
revoke all on public.buklod_academy_learning_sources from anon,authenticated;
grant select on public.buklod_academy_learning_sources to authenticated;
create policy academy_source_admin_read on public.buklod_academy_learning_sources
 for select to authenticated using(public.is_system_admin());
