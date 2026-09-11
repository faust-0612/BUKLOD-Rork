revoke all on function public.buklod_review_scope_formation_approval_v2(uuid,boolean,text) from public;
revoke all on function public.buklod_review_scope_formation_approval_v2(uuid,boolean,text) from anon;
revoke all on function public.buklod_review_scope_formation_approval_v2(uuid,boolean,text) from authenticated;
grant execute on function public.buklod_review_scope_formation_approval_v2(uuid,boolean,text) to service_role;
