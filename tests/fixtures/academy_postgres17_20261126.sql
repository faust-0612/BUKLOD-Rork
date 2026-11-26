-- Disposable fictional schema only.
alter table public.daily_bible_submissions add column reviewed_at timestamptz;
alter table public.devotional_reward_submissions add column reviewed_at timestamptz;
alter table public.buklod_abc_growth_progress add column point_ledger_id uuid references public.buklod_points_ledger(id);
alter table public.buklod_points_ledger add column created_at timestamptz default now();
create function auth.role() returns text language sql stable as $role$ select nullif(current_setting('request.jwt.claim.role',true),'') $role$;
