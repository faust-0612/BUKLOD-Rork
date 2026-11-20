import { randomUUID } from 'expo-crypto';
import { supabase } from '@/lib/supabase';

/** BUKLOD Government talks only to server-authorized, RLS-protected endpoints.
 * Neither a focus-app entitlement nor a local UI flag confers government authority.
 */
const db = supabase as any;

export type GovEntityType = 'NATIONAL'|'REGIONAL'|'PROVINCIAL'|'CITY'|'MUNICIPALITY'|'BARANGAY'|'DEPARTMENT';
export type GovPublicationKind = 'ANNOUNCEMENT'|'PROGRAM'|'PROJECT'|'CONSULTATION'|'ADVISORY';
export type GovCaseStatus = 'SUBMITTED'|'ACKNOWLEDGED'|'IN_PROGRESS'|'RESOLVED'|'REOPENED'|'CLOSED'|'ESCALATED';
export type GovStaffRole = 'OWNER'|'ADMIN'|'PUBLISHER'|'CONCERN_HANDLER'|'AUDITOR'|'EMERGENCY_PUBLISHER';

export type GovEntity = {
  id: string; name: string; entity_type: GovEntityType; psgc_code: string|null;
  location_label: string; official_email: string; official_url: string|null;
  status: 'PENDING'|'VERIFIED'|'REJECTED'|'SUSPENDED';
  created_by: string; created_at: string;
};
export type GovStaff = { entity_id:string; user_id:string;role:GovStaffRole;is_active:boolean };
export type GovPublication = { id:string;entity_id:string;body:string;post_kind:GovPublicationKind;
  locality_keys:string[];public_wall_post_id:string|null;created_at:string };
export type GovService = { id:string;entity_id:string;title:string;description:string|null;
  official_url:string;is_published:boolean };
export type GovEvent = { id:string;entity_id:string;title:string;description:string|null;
  starts_at:string;ends_at:string|null;location_label:string|null;is_published:boolean };
export type GovCase = { id:string;reference_code:string;entity_id:string;submitted_by:string;
  subject:string;description:string;locality_key:string|null;status:GovCaseStatus;
  assigned_to:string|null;created_at:string;updated_at:string };
export type GovCaseEvent = { id:string;case_id:string;status:GovCaseStatus|null;
  note:string;created_at:string };

function unwrap<T>(data: T, error: any): T {
  if (error) throw new Error(String(error.message ?? 'Government service unavailable.'));
  return data;
}
export async function governmentCurrentUserId():Promise<string> {
  const {data,error}=await supabase.auth.getUser();
  if(error || !data.user?.id) throw new Error('Please sign in to use BUKLOD Government.');
  return data.user.id;
}
export async function governmentIsSystemAdmin():Promise<boolean> {
  const {data,error}=await db.rpc('buklod_is_system_admin');
  return !error && data===true;
}
export async function governmentDirectory(search=''):Promise<GovEntity[]> {
  let q=db.from('buklod_government_entities').select('id,name,entity_type,psgc_code,location_label,official_email,official_url,status,created_by,created_at')
    .eq('status','VERIFIED').order('name').limit(80);
  const normalized=search.trim().replace(/[%,()]/g,'').slice(0,80);
  if(normalized) q=q.ilike('name',`%${normalized}%`);
  const {data,error}=await q;
  return unwrap(data ?? [],error);
}
export async function governmentMyApplications():Promise<GovEntity[]> {
  const uid=await governmentCurrentUserId();
  const {data,error}=await db.from('buklod_government_entities').select('*')
   .eq('created_by',uid).order('created_at',{ascending:false}).limit(25);
  return unwrap(data??[],error);
}
export async function governmentPendingApplications():Promise<GovEntity[]> {
  const {data,error}=await db.from('buklod_government_entities').select('*')
    .eq('status','PENDING').order('created_at').limit(50);
  return unwrap(data??[],error);
}
export async function governmentApply(input:{
  name:string;entity_type:GovEntityType;psgc_code?:string;location_label:string;
  official_email:string;official_url?:string;application_note?:string;
}):Promise<GovEntity> {
  const uid=await governmentCurrentUserId();
  const {data,error}=await db.from('buklod_government_entities')
    .insert({ ...input,name:input.name.trim(),location_label:input.location_label.trim(),
      official_email:input.official_email.trim(),official_url:input.official_url?.trim()||null,
      psgc_code:input.psgc_code?.trim()||null,application_note:input.application_note?.trim()||null,
      status:'PENDING',created_by:uid })
    .select('*').single();
  return unwrap(data,error);
}
export async function governmentVerifyEntity(id:string):Promise<void> {
  const uid=await governmentCurrentUserId();
  const {data,error}=await db.from('buklod_government_entities').update({
    status:'VERIFIED',reviewed_by:uid,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()
  }).eq('id',id).eq('status','PENDING').select('id').single();
  unwrap(data,error);
}
export async function governmentMyRoles():Promise<GovStaff[]> {
  const uid=await governmentCurrentUserId();
  const {data,error}=await db.from('buklod_government_staff')
    .select('entity_id,user_id,role,is_active').eq('user_id',uid).eq('is_active',true);
  return unwrap(data??[],error);
}
export async function governmentEntityStaff(entityId:string):Promise<GovStaff[]> {
  const {data,error}=await db.from('buklod_government_staff')
    .select('entity_id,user_id,role,is_active').eq('entity_id',entityId).limit(80);
  return unwrap(data??[],error);
}
export async function governmentAssignStaff(entityId:string,userId:string,role:GovStaffRole):Promise<void> {
  const uid=await governmentCurrentUserId();
  const {error}=await db.from('buklod_government_staff').upsert({
    entity_id:entityId,user_id:userId,role,is_active:true,assigned_by:uid
  },{onConflict:'entity_id,user_id'});
  unwrap(null,error);
}
export async function governmentPosts(entityId:string):Promise<GovPublication[]> {
  const {data,error}=await db.from('buklod_government_publications').select('*')
    .eq('entity_id',entityId).order('created_at',{ascending:false}).limit(60);
  return unwrap(data??[],error);
}
export async function governmentPublish(input:{entityId:string;body:string;kind:GovPublicationKind;
 localityKeys?:string[];publishNationalWall?:boolean;requestKey?:string}):Promise<string> {
  const {data,error}=await db.rpc('buklod_government_publish_v1',{
    p_entity_id:input.entityId,p_body:input.body.trim(),p_kind:input.kind,
    p_locality_keys:input.localityKeys??[],p_idempotency_key:input.requestKey??randomUUID(),
    p_public_wall:input.publishNationalWall===true,
  });
  return unwrap(data,error);
}
export async function governmentServices(entityId:string):Promise<GovService[]> {
  const {data,error}=await db.from('buklod_government_services').select('*')
    .eq('entity_id',entityId).order('updated_at',{ascending:false}).limit(80);
  return unwrap(data??[],error);
}
export async function governmentSaveService(input:{entityId:string;title:string;description:string;url:string}):Promise<void> {
  const uid=await governmentCurrentUserId();
  const {error}=await db.from('buklod_government_services').insert({
    entity_id:input.entityId,title:input.title.trim(),description:input.description.trim(),
    official_url:input.url.trim(),updated_by:uid,is_published:true,
  });
  unwrap(null,error);
}
export async function governmentEvents(entityId:string):Promise<GovEvent[]> {
  const {data,error}=await db.from('buklod_government_events').select('*')
    .eq('entity_id',entityId).order('starts_at',{ascending:true}).limit(80);
  return unwrap(data??[],error);
}
export async function governmentSaveEvent(input:{entityId:string;title:string;description:string;
  locationLabel:string;startsAt:string}):Promise<void> {
  const uid=await governmentCurrentUserId();
  const date=new Date(input.startsAt);
  if(Number.isNaN(date.valueOf())) throw new Error('Enter a valid event date.');
  const {error}=await db.from('buklod_government_events').insert({
    entity_id:input.entityId,title:input.title.trim(),description:input.description.trim(),
    location_label:input.locationLabel.trim(),starts_at:date.toISOString(),updated_by:uid,is_published:true,
  });
  unwrap(null,error);
}
export async function governmentFollows():Promise<string[]> {
  const uid=await governmentCurrentUserId();
  const {data,error}=await db.from('buklod_government_follows').select('entity_id')
    .eq('user_id',uid).limit(150);
  return unwrap((data??[]).map((r:any)=>String(r.entity_id)),error);
}
export async function governmentToggleFollow(entityId:string,following:boolean):Promise<void> {
  const uid=await governmentCurrentUserId();
  if(following) {
    const {error}=await db.from('buklod_government_follows').delete().eq('entity_id',entityId).eq('user_id',uid);
    unwrap(null,error);
  } else {
    const {error}=await db.from('buklod_government_follows').upsert({entity_id:entityId,user_id:uid});
    unwrap(null,error);
  }
}
export async function governmentCases(entityId:string):Promise<GovCase[]> {
  const {data,error}=await db.from('buklod_government_cases').select('*')
    .eq('entity_id',entityId).order('created_at',{ascending:false}).limit(80);
  return unwrap(data??[],error);
}
export async function governmentCaseEvents(caseId:string):Promise<GovCaseEvent[]> {
  const {data,error}=await db.from('buklod_government_case_events')
    .select('id,case_id,status,note,created_at').eq('case_id',caseId)
    .order('created_at',{ascending:true}).limit(80);
  return unwrap(data??[],error);
}
export async function governmentSubmitCase(input:{
  entityId:string;subject:string;description:string;localityKey?:string;
}):Promise<GovCase> {
  const uid=await governmentCurrentUserId();
  const {data,error}=await db.from('buklod_government_cases')
    .insert({entity_id:input.entityId,subject:input.subject.trim(),description:input.description.trim(),
      submitted_by:uid,locality_key:input.localityKey?.trim()||null,status:'SUBMITTED'})
    .select('*').single();
  return unwrap(data,error);
}
export async function governmentTransitionCase(input:{
  caseId:string;status:GovCaseStatus;note:string;requestKey?:string;
}):Promise<void> {
  const {error}=await db.rpc('buklod_government_case_transition_v1',{
    p_case_id:input.caseId,p_status:input.status,
    p_note:input.note.trim(),p_client_key:input.requestKey??randomUUID()
  });
  unwrap(null,error);
}
