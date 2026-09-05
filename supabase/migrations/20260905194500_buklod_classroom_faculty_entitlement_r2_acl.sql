-- Lock new Classroom / Faculty entitlement RPCs to authenticated users.
revoke all on function public.buklod_classroom_my_classes_v2() from public, anon;
grant execute on function public.buklod_classroom_my_classes_v2() to authenticated;

revoke all on function public.buklod_education_faculty_my_classrooms_v1() from public, anon;
grant execute on function public.buklod_education_faculty_my_classrooms_v1() to authenticated;

revoke all on function public.buklod_my_classroom_launcher_access_v1() from public, anon;
grant execute on function public.buklod_my_classroom_launcher_access_v1() to authenticated;

revoke all on function public.buklod_submit_personal_focus_app_payment_v2(text,text,text) from public, anon;
grant execute on function public.buklod_submit_personal_focus_app_payment_v2(text,text,text) to authenticated;

revoke all on function public.buklod_submit_personal_focus_app_payment_v1(text,text) from public, anon;
grant execute on function public.buklod_submit_personal_focus_app_payment_v1(text,text) to authenticated;

revoke all on function public.buklod_education_monetization_policy_v1() from public, anon;
grant execute on function public.buklod_education_monetization_policy_v1() to authenticated;
