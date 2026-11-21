import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const m=readFileSync('supabase/migrations/20261121230000_sos_urgent_audible_rescue.sql','utf8');
test('New emergency RPCs are authenticated and direct table writes are revoked',()=>{
 assert.match(m,/REVOKE INSERT, UPDATE, DELETE ON TABLE public\.buklod_help_requests,/);
 assert.match(m,/public\.buklod_help_responses, public\.buklod_help_presence/);
 assert.match(m,/FROM PUBLIC, anon, authenticated/);
 for(const n of ['buklod_help_refresh_opted_in_presence','buklod_help_register_emergency_channel','buklod_help_get_emergency_for_viewer','buklod_help_get_rescue_coordinates']){
  assert.match(m,new RegExp('CREATE OR REPLACE FUNCTION public\\.'+n+'\\('));
  assert.match(m,new RegExp('REVOKE ALL ON FUNCTION public\\.'+n+'\\('));
  assert.match(m,new RegExp('GRANT EXECUTE ON FUNCTION public\\.'+n+'\\('));
 }
 assert.match(m,/SECURITY DEFINER SET search_path = ''/);
});
test('Precisely disclosed rescue destination requires live incident, canonical recipient and on-my-way responder',()=>{
 assert.match(m,/response\.response_type='ON_MY_WAY'/);
 assert.match(m,/response\.updated_at>now\(\)-interval '90 minutes'/);
 assert.match(m,/r\.status='ACTIVE' AND r\.expires_at>now\(\)/);
 assert.match(m,/r\.creator_id<>v_uid/);
 assert.match(m,/n\.data->>'help_request_id'=r\.id::text/);
 assert.match(m,/p\.safety_alerts_enabled=true/);
 assert.match(m,/p\.updated_at>now\(\)-interval '60 minutes'/);
 assert.match(m,/LEAST\(5\.0,r\.radius_km\)/);
});
test('Opted-out users cannot be silently reactivated by global presence refresh',()=>{
 const section=m.split('CREATE OR REPLACE FUNCTION public.buklod_help_refresh_opted_in_presence')[1].split('CREATE OR REPLACE FUNCTION public.buklod_help_register_emergency_channel')[0];
 assert.match(section,/UPDATE public\.buklod_help_presence/);
 assert.match(section,/safety_alerts_enabled=true/);
 assert.doesNotMatch(section,/INSERT INTO/);
});
