-- DEV candidate only: install in a disposable test database, never as part of an OTA.
-- Permanent, non-transferable cosmetic entitlements only. No stones, BP, QMP, ranked power,
-- subscriptions, bundles or provider verification. A trusted server must verify Play receipts first.
begin;
create schema empire_commerce;
revoke all on schema empire_commerce from public,anon,authenticated;
grant usage on schema empire_commerce to service_role;
create table empire_commerce.release_gate(
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false
);
insert into empire_commerce.release_gate(singleton) values(true);
create table empire_commerce.product(
 sku text primary key check(sku ~ '^[a-z0-9._-]{1,120}$'),
 cosmetic_id text not null unique check(cosmetic_id ~ '^[a-z0-9._-]{1,120}$'),
 visual_reviewed boolean not null default false,
 enabled boolean not null default false,
 check(not enabled or visual_reviewed)
);
create table empire_commerce.purchase(
 token_digest text primary key check(token_digest ~ '^[a-f0-9]{64}$'),
 user_id uuid not null references auth.users(id) on delete restrict,
 sku text not null references empire_commerce.product(sku) on delete restrict,
 verified_at timestamptz not null default now(),
 revoked_at timestamptz
);
create index on empire_commerce.purchase(user_id,sku) where revoked_at is null;
alter table empire_commerce.release_gate enable row level security;
alter table empire_commerce.product enable row level security;
alter table empire_commerce.purchase enable row level security;
-- No client policies. Only privileged, receipt-verifying application server can invoke these.
create function empire_commerce.record_verified_purchase(u uuid,s text,d text)
returns boolean language plpgsql security definer set search_path='' as $$
declare old empire_commerce.purchase%rowtype;
begin
 if u is null or s is null or d is null or d !~ '^[a-f0-9]{64}$' then raise exception 'Invalid receipt identity'; end if;
 -- Serialize retries and cancellation for the same digest, including previously unknown receipts.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('empire_commerce:'||d,0));
 select * into old from empire_commerce.purchase where token_digest=d;
 if found then
  if old.user_id is distinct from u or old.sku is distinct from s then raise exception 'Receipt ownership conflict'; end if;
  return old.revoked_at is null;
 end if;
 if not exists(select 1 from empire_commerce.release_gate where singleton and enabled)
 or not exists(select 1 from empire_commerce.product where sku=s and enabled and visual_reviewed)
 then raise exception 'Commerce unavailable'; end if;
 if not empire_stones.eligible(u) then raise exception 'Account not eligible'; end if;
 insert into empire_commerce.purchase(token_digest,user_id,sku) values(d,u,s);
 return true;
end $$;
-- Record revocations even if arrival precedes purchase verification. No reversal of revocation.
create table empire_commerce.revocation(
 token_digest text primary key check(token_digest ~ '^[a-f0-9]{64}$'),
 revoked_at timestamptz not null default now()
);
alter table empire_commerce.revocation enable row level security;
create function empire_commerce.revoke_verified_purchase(d text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if d is null or d !~ '^[a-f0-9]{64}$' then raise exception 'Invalid receipt identity'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('empire_commerce:'||d,0));
 insert into empire_commerce.revocation(token_digest) values(d) on conflict do nothing;
 update empire_commerce.purchase set revoked_at=now() where token_digest=d and revoked_at is null;
end $$;
-- A tombstone prevents late verification from recreating a revoked entitlement.
create function empire_commerce.reject_revoked() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from empire_commerce.revocation where token_digest=new.token_digest)
 then raise exception 'Receipt revoked'; end if;
 return new;
end $$;
create trigger reject_revoked before insert on empire_commerce.purchase for each row execute function empire_commerce.reject_revoked();
create function empire_commerce.active_cosmetics(u uuid) returns table(cosmetic_id text)
language sql stable security definer set search_path='' as $$
 select distinct p.cosmetic_id from empire_commerce.purchase x join empire_commerce.product p on p.sku=x.sku
 where x.user_id=u and x.revoked_at is null and p.visual_reviewed and empire_stones.eligible(u)
$$;
revoke all on all tables in schema empire_commerce from public,anon,authenticated,service_role;
revoke all on all functions in schema empire_commerce from public,anon,authenticated,service_role;
grant execute on function empire_commerce.record_verified_purchase(uuid,text,text),empire_commerce.revoke_verified_purchase(text),empire_commerce.active_cosmetics(uuid) to service_role;
commit;
