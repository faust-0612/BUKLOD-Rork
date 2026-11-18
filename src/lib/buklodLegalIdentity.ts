/** Government ID images are private. Never log ID documents, paths or links. */
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import { decode } from 'base64-arraybuffer';
import { supabase } from '@/lib/supabase';
import { ensureImagePickerLibraryAccess } from '@/lib/buklodImagePickerAccess';

export const IDENTITY_BUCKET = 'buklod-identity-private';
const MAX_BYTES = 5 * 1024 * 1024;
export type BuklodLegalIdType = 'PHILSYS' | 'PASSPORT' | 'DRIVERS_LICENSE' | 'UMID' | 'POSTAL_ID' | 'OTHER_GOV_ID';
export type BuklodLegalIdentityStatus = {
 status: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
 submitted_at: string | null;
 verified_at: string | null;
 legal_full_name: string | null;
 rejected_reason: string | null;
};
export type BuklodIdentityReview = {
 user_id: string; revision: number; legal_full_name: string;
 id_type: BuklodLegalIdType; document_path: string; submitted_at: string;
};

function failure(error: any, message: string): never {
 throw new Error(String(error?.message || message));
}
export async function getMyBuklodLegalIdentityStatus(): Promise<BuklodLegalIdentityStatus> {
 const {data,error}=await (supabase as any).rpc('get_my_buklod_identity_status_v1');
 if(error)failure(error,'Identity verification is unavailable.');
 return data as BuklodLegalIdentityStatus;
}
export async function pickBuklodLegalIdPhoto(): Promise<ImagePicker.ImagePickerAsset|null> {
 const granted=await ensureImagePickerLibraryAccess(ImagePicker.requestMediaLibraryPermissionsAsync);
 if(!granted)throw Error('Allow photo access to select your government ID.');
 const result=await ImagePicker.launchImageLibraryAsync({
  mediaTypes:['images'], allowsEditing:false, allowsMultipleSelection:false, quality:0.85
 });
 if(result.canceled||!result.assets?.[0])return null;
 const photo=result.assets[0];
 if(!['image/jpeg','image/png'].includes(String(photo.mimeType)))
  throw Error('Government ID photo must be JPG or PNG.');
 if(Number(photo.fileSize||0)>MAX_BYTES)throw Error('ID photo must be 5 MB or smaller.');
 return photo;
}
async function readBytes(photo:ImagePicker.ImagePickerAsset):Promise<ArrayBuffer> {
 let bytes:ArrayBuffer;
 if(Platform.OS==='web'){
  const res=await fetch(photo.uri);
  if(!res.ok)throw Error('Selected ID photo cannot be read.');
  bytes=await res.arrayBuffer();
 }else{
  const encoded=await FileSystem.readAsStringAsync(photo.uri,{encoding:FileSystem.EncodingType.Base64});
  bytes=decode(encoded);
 }
 if(!bytes.byteLength||bytes.byteLength>MAX_BYTES)throw Error('ID image must be 5 MB or smaller.');
 return bytes;
}
export async function submitMyBuklodLegalIdentity(input:{
 firstName:string;middleName:string;surname:string;suffix:string;
 idType:BuklodLegalIdType;photo:ImagePicker.ImagePickerAsset;
}) {
 const {data:auth,error:authError}=await supabase.auth.getUser();
 if(authError||!auth.user)throw Error('Log in again before ID verification.');
 const type=String(input.photo.mimeType);
 if(!['image/jpeg','image/png'].includes(type))throw Error('ID must be JPG or PNG.');
 const bytes=await readBytes(input.photo);
 const path=`${auth.user.id}/${Crypto.randomUUID()}.${type==='image/png'?'png':'jpg'}`;
 const uploaded=await supabase.storage.from(IDENTITY_BUCKET).upload(path,bytes,{
  contentType:type,upsert:false,cacheControl:'0'
 });
 if(uploaded.error)failure(uploaded.error,'Private ID upload failed.');
 const {data,error}=await (supabase as any).rpc('submit_my_buklod_identity_v1',{
  p_first_name:input.firstName.trim(),p_middle_name:input.middleName.trim(),
  p_surname:input.surname.trim(),p_suffix:input.suffix.trim(),
  p_id_type:input.idType,p_document_path:path
 });
 // Failed submissions may leave orphan private files: server-side retention must clear them.
 if(error)failure(error,'Government ID submission failed.');
 return data as {status:'PENDING';submitted_at:string};
}
export async function listBuklodIdentityPending():Promise<BuklodIdentityReview[]> {
 const {data,error}=await (supabase as any).rpc('admin_list_buklod_identity_pending_v1',{p_limit:30});
 if(error)failure(error,'Identity review queue unavailable.');
 return Array.isArray(data)?data:[];
}
export async function openBuklodPrivateId(path:string):Promise<string> {
 const {data,error}=await supabase.storage.from(IDENTITY_BUCKET).createSignedUrl(path,60);
 if(error||!data?.signedUrl)failure(error,'Private ID access unavailable.');
 return data.signedUrl;
}
export async function reviewBuklodLegalIdentity(input:{
 userId:string;revision:number;approve:boolean;observedName:string;reason:string;
}) {
 const {data,error}=await (supabase as any).rpc('admin_review_buklod_identity_v1',{
  p_user_id:input.userId,p_revision:input.revision,p_approve:input.approve,
  p_observed_id_name:input.observedName.trim(),p_reason:input.reason.trim()||null
 });
 if(error)failure(error,'Identity review failed.');
 return data as {user_id:string;status:string};
}
