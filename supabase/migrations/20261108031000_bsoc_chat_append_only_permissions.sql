-- BUKLOD BSOC live case chat must be append-only for authenticated clients.
-- PostgreSQL table ACL was broader than RLS policies, including TRUNCATE.
-- Keep authorized SELECT and INSERT; owner/system service roles are untouched.
-- RLS still gates account/agent case access and storage object paths.
REVOKE ALL ON TABLE public.bsoc_case_messages,
  public.bsoc_case_attachments FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.bsoc_case_messages,
  public.bsoc_case_attachments TO authenticated;

DO $acl$ BEGIN
 IF has_table_privilege('authenticated','public.bsoc_case_messages','UPDATE')
  OR has_table_privilege('authenticated','public.bsoc_case_messages','DELETE')
  OR has_table_privilege('authenticated','public.bsoc_case_messages','TRUNCATE')
  OR has_table_privilege('authenticated','public.bsoc_case_attachments','UPDATE')
  OR has_table_privilege('authenticated','public.bsoc_case_attachments','DELETE')
  OR has_table_privilege('authenticated','public.bsoc_case_attachments','TRUNCATE')
 THEN RAISE EXCEPTION 'BUKLOD BSOC case ACL still allows unsafe mutation'; END IF;
 IF NOT has_table_privilege('authenticated','public.bsoc_case_messages','SELECT')
  OR NOT has_table_privilege('authenticated','public.bsoc_case_messages','INSERT')
  OR NOT has_table_privilege('authenticated','public.bsoc_case_attachments','SELECT')
  OR NOT has_table_privilege('authenticated','public.bsoc_case_attachments','INSERT')
 THEN RAISE EXCEPTION 'BUKLOD BSOC live send/read was revoked unexpectedly'; END IF;
END $acl$;
