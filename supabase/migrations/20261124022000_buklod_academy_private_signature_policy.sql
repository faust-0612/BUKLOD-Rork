-- Admin-only private issuer asset controls. No public image URLs.
-- Issuer signature must never ship in mobile assets, web bundle or Git history.
create policy buklod_academy_signature_admin_read on storage.objects
 for select to authenticated using (
  bucket_id='buklod-university-issuer'
  and name='academy/signatory.png'
  and public.is_system_admin()
 );
create policy buklod_academy_signature_admin_upload on storage.objects
 for insert to authenticated with check (
  bucket_id='buklod-university-issuer'
  and name='academy/signatory.png'
  and public.is_system_admin()
 );
create policy buklod_academy_signature_admin_replace on storage.objects
 for update to authenticated using (
  bucket_id='buklod-university-issuer'
  and name='academy/signatory.png'
  and public.is_system_admin()
 ) with check (
  bucket_id='buklod-university-issuer'
  and name='academy/signatory.png'
  and public.is_system_admin()
 );
-- Only trusted service functions generate or fetch completion papers; authenticated
-- callers have no storage.objects policy for the paper bucket.
