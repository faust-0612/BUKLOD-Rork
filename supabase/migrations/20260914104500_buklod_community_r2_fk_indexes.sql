-- BUKLOD Community Living R2 — targeted FK/index hardening.
-- Keep Community-specific relationship lookups bounded without touching unrelated project policies.

begin;

create index if not exists idx_buklod_community_challenge_members_user
  on public.buklod_community_challenge_members(user_id, updated_at desc);

create index if not exists idx_buklod_community_dugtongs_user
  on public.buklod_community_dugtongs(user_id, created_at desc);

create index if not exists idx_buklod_community_moderation_events_user
  on public.buklod_community_moderation_events(user_id, created_at desc);

create index if not exists idx_buklod_community_poll_votes_user
  on public.buklod_community_poll_votes(user_id);

create index if not exists idx_buklod_community_resource_signals_user
  on public.buklod_community_resource_signals(user_id, created_at desc);

create index if not exists idx_buklod_community_resources_post
  on public.buklod_community_resources(post_id);

create index if not exists idx_buklod_community_reward_pot_awards_dugtong
  on public.buklod_community_reward_pot_awards(dugtong_id);

create index if not exists idx_buklod_community_reward_pot_awards_recipient
  on public.buklod_community_reward_pot_awards(recipient_id, created_at desc);

create index if not exists idx_buklod_community_takeaways_owner
  on public.buklod_community_takeaways(owner_id, created_at desc);

commit;
