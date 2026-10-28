-- A personal-settings save used to issue an UPDATE with identity columns in
-- the SET list even if the identity was unchanged. UPDATE OF triggers fire on
-- the SET list alone, so the expensive classroom roster fuzzy matching ran
-- while the user was merely toggling Show Faith and timed out (SQLSTATE 57014).
--
-- Preserve roster reconciliation on profile creation and real identity/status
-- changes. Do not alter the matching algorithm or its identity safeguards.

drop trigger if exists buklod_classroom_roster_profile_arrival_sync_r4
  on public.profiles;

create trigger buklod_classroom_roster_profile_arrival_sync_r4
after insert on public.profiles
for each row
execute function public.buklod_classroom_roster_profile_arrival_sync_v1();

drop trigger if exists buklod_classroom_roster_profile_identity_change_sync_r5
  on public.profiles;

create trigger buklod_classroom_roster_profile_identity_change_sync_r5
after update of username, full_name, first_name, middle_name, surname, suffix, is_active
on public.profiles
for each row
when (
  old.username is distinct from new.username
  or old.full_name is distinct from new.full_name
  or old.first_name is distinct from new.first_name
  or old.middle_name is distinct from new.middle_name
  or old.surname is distinct from new.surname
  or old.suffix is distinct from new.suffix
  or old.is_active is distinct from new.is_active
)
execute function public.buklod_classroom_roster_profile_arrival_sync_v1();
