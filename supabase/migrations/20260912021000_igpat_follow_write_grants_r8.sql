-- IGPAT R8 follow write grants
-- Allows authenticated users to use the existing own-row RLS policies on buklod_user_follows.
-- RLS remains the authorization boundary: users may insert/delete only rows where follower_id = auth.uid().

grant insert, delete on table public.buklod_user_follows to authenticated;
