alter table public.buklod_recovery_otp_challenges
  drop constraint if exists buklod_recovery_otp_challenges_channel_check;

alter table public.buklod_recovery_otp_challenges
  add constraint buklod_recovery_otp_challenges_channel_check
  check (channel = any (array['sms'::text, 'email'::text, 'in_app'::text]));
