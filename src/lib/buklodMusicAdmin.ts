// Server-enforced, System Admin-only operations for the existing private library.
// All storage/database writes require matching Supabase RLS; no service key on device.
import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import { supabase } from '@/lib/supabase';
import type { BuklodPostMusicTrack } from '@/lib/buklodPostCreatives';

export type BuklodMusicAdminTrack = BuklodPostMusicTrack & {
  sort_order: number; is_active: boolean; created_at: string;
};
const BUCKET='buklod-music-library';
export const BUKLOD_MUSIC_ADMIN_LIMIT_BYTES=25*1024*1024;
const FORMATS:Record<string,string>={
  mp3:'audio/mpeg', m4a:'audio/mp4', mp4:'audio/mp4',
  aac:'audio/aac', wav:'audio/wav', ogg:'audio/ogg',
};
function failure(e:unknown){return e instanceof Error?e.message:String(e);}
async function assertSystemAdmin():Promise<void>{
  const {data,error}=await supabase.rpc('is_system_admin');
  if(error || data!==true)throw new Error('System Admin authorization required.');
}
export function buklodMusicExtension(name:string):string {
  return String(name??'').toLowerCase().split('.').pop()||'';
}
export function validateBuklodMusicFile(name:string, size:number):{extension:string;mime:string}{
  const extension=buklodMusicExtension(name);
  const mime=FORMATS[extension];
  if(!mime)throw new Error('Supported audio: MP3, M4A, MP4 audio, AAC, WAV or OGG.');
  if(!Number.isFinite(size)||size<=0||size>BUKLOD_MUSIC_ADMIN_LIMIT_BYTES)
    throw new Error('Choose a non-empty audio file of at most 25 MB.');
  return {extension,mime};
}
export function buklodMusicStoragePath(raw:string):string|null{
  const path=String(raw??'').trim();
  if(!path||/^https?:\/\//i.test(path))return null;
  const normalized=path.replace(/^\/+/, '').replace(/^buklod-music-library\//i,'');
  return normalized.startsWith('library/') && !normalized.includes('..') ? normalized : null;
}
export async function listBuklodMusicAdminTracks():Promise<BuklodMusicAdminTrack[]>{
  await assertSystemAdmin();
  const {data,error}=await (supabase as any).from('buklod_music_library')
    .select('id,title,artist,audio_path,mime_type,sort_order,is_active,created_at')
    .order('sort_order',{ascending:true}).limit(400);
  if(error)throw error;
  return (data??[]) as BuklodMusicAdminTrack[];
}
export async function uploadBuklodAdminMusic(input:{
  asset:DocumentPicker.DocumentPickerAsset;title:string;artist:string;
}):Promise<BuklodMusicAdminTrack>{
  await assertSystemAdmin();
  const title=input.title.trim().slice(0,160);
  const artist=input.artist.trim().slice(0,160);
  if(!title)throw new Error('Music title is required.');
  const {extension,mime}=validateBuklodMusicFile(input.asset.name,Number(input.asset.size??0));
  const path='library/admin/'+Crypto.randomUUID()+'.'+extension;
  // Avoid native readAsStringAsync (unsupported in Expo SDK 57 web).
  const bytes=Platform.OS==='web' && input.asset.file
    ? await input.asset.file.arrayBuffer()
    : await new File(input.asset.uri).arrayBuffer();
  if(bytes.byteLength>BUKLOD_MUSIC_ADMIN_LIMIT_BYTES || bytes.byteLength===0)
    throw new Error('Music file exceeds the 25 MB limit or is empty.');
  const {error:uploadError}=await supabase.storage.from(BUCKET).upload(path,bytes,{
    contentType:mime,cacheControl:'3600',upsert:false,
  });
  if(uploadError)throw uploadError;
  try{
    // Existing tracks are not touched. Insert is immediate; member pickers
    // refetch catalog on open and do not require an OTA for new audio entries.
    const {data,error}=await (supabase as any).from('buklod_music_library')
      .insert({title,artist:artist||null,audio_path:path,mime_type:mime,
        is_active:true,sort_order:100})
      .select('id,title,artist,audio_path,mime_type,sort_order,is_active,created_at').single();
    if(error)throw error;
    return data as BuklodMusicAdminTrack;
  }catch(error){
    const {error:cleanup}=await supabase.storage.from(BUCKET).remove([path]);
    if(cleanup)throw new Error('Catalog insert failed and uploaded file cleanup also failed: '+failure(error)+'; cleanup: '+failure(cleanup)+'; object='+path);
    throw error;
  }
}
export async function deleteBuklodAdminMusic(track:BuklodMusicAdminTrack):Promise<void>{
  await assertSystemAdmin();
  // Hide from all pickers BEFORE deleting storage bytes. Any interruption
  // leaves a safely retired entry; retrying the delete cleans it up.
  const {error:hideError}=await (supabase as any).from('buklod_music_library')
    .update({is_active:false}).eq('id',track.id);
  if(hideError)throw hideError;
  const path=buklodMusicStoragePath(track.audio_path);
  if(path){
    // Do not delete shared objects while another catalog row still uses them.
    const {data:other,error:otherError}=await (supabase as any).from('buklod_music_library')
      .select('id').eq('audio_path',track.audio_path).neq('id',track.id).limit(1);
    if(otherError)throw new Error('Music was hidden, but file reference check failed: '+failure(otherError));
    if(!(other??[]).length){
      const {error:removeError}=await supabase.storage.from(BUCKET).remove([path]);
      if(removeError)throw new Error('Music was hidden; file deletion needs retry: '+failure(removeError));
    }
  }
  const {error:deleteError}=await (supabase as any).from('buklod_music_library')
    .delete().eq('id',track.id);
  if(deleteError)throw new Error('Music hidden, but row deletion needs retry: '+failure(deleteError));
}
