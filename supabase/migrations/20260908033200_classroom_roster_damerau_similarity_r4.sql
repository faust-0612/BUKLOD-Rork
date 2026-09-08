-- Keep backend profile-arrival synchronization aligned with the Edge matcher.
create or replace function public.buklod_classroom_roster_edit_similarity_v1(p_left text, p_right text)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  a text := replace(public.buklod_classroom_roster_normalize_name_v1(p_left), ' ', '');
  b text := replace(public.buklod_classroom_roster_normalize_name_v1(p_right), ' ', '');
  n integer;
  m integer;
  i integer;
  j integer;
  cost integer;
  prevprev integer[];
  prev integer[];
  curr integer[];
begin
  if a = b then return 1; end if;
  n := length(a); m := length(b);
  if n = 0 or m = 0 then return 0; end if;
  prev := array_fill(0, array[m + 1], array[0]);
  for j in 0..m loop prev[j] := j; end loop;
  prevprev := prev;
  for i in 1..n loop
    curr := array_fill(0, array[m + 1], array[0]);
    curr[0] := i;
    for j in 1..m loop
      cost := case when substring(a from i for 1) = substring(b from j for 1) then 0 else 1 end;
      curr[j] := least(curr[j-1] + 1, prev[j] + 1, prev[j-1] + cost);
      if i > 1 and j > 1
        and substring(a from i for 1) = substring(b from j-1 for 1)
        and substring(a from i-1 for 1) = substring(b from j for 1) then
        curr[j] := least(curr[j], prevprev[j-2] + 1);
      end if;
    end loop;
    prevprev := prev;
    prev := curr;
  end loop;
  return greatest(0, 1 - (prev[m]::numeric / greatest(n,m)));
end;
$$;
