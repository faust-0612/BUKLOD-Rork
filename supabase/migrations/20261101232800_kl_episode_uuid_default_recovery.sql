-- Restore the missing default for KL chapter IDs. Existing IDs, drafts, approval,
-- manuscripts and release state are not modified. gen_random_uuid() is built in.
ALTER TABLE public.kl_episodes
  ALTER COLUMN id SET DEFAULT gen_random_uuid();
