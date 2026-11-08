/* BUKLOD_SCOPE_HOME_ASSETS_R1
 * Private, admin-managed Cluster/Organization files and media. Existing
 * membership storage RLS remains authoritative; client-side admin checks
 * improve UX but cannot grant access.
 */
import {Platform} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import {decode} from 'base64-arraybuffer';
import {supabase} from '@/lib/supabase';
import {ensureImagePickerLibraryAccess} from '@/lib/buklodImagePickerAccess';

export const BUKLOD_SCOPE_HOME_ASSET_BUCKET='buklod-scope-home-assets';
export type BuklodScopeHomeAssetKind='resource'|'event'|'notice'|'profile';
export type BuklodScopeHomeFile={
  uri:string;name:string;mimeType:string;size:number;mediaType:'image'|'video'|'file';
  webFile?:{arrayBuffer:()=>Promise<ArrayBuffer>}|null;
};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MIME_BY_EXT:Record<string,string>={
 jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',
 mp4:'video/mp4',mov:'video/quicktime',webm:'video/webm',
 pdf:'application/pdf',txt:'text/plain',csv:'text/csv',
 docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};
const MIME_ALLOWED=new Set(Object.values(MIME_BY_EXT));
const ext=(name:string)=>String(name).split('.').pop()?.toLowerCase()??'';
const limit=(kind:BuklodScopeHomeAssetKind)=>kind==='resource'?20*1048576:
 kind==='profile'?8*1048576:30*1048576;

export function validateBuklodScopeHomeFile(asset:BuklodScopeHomeFile,kind:BuklodScopeHomeAssetKind){
  const extension=ext(asset.name);
  const expected=MIME_BY_EXT[extension];
  if(!expected||!MIME_ALLOWED.has(expected))throw Error('Unsupported file type. Use PDF, Office, text, photo or MP4/MOV/WEBM.');
  if(kind==='profile'&&!expected.startsWith('image/'))throw Error('Profile photo must be JPG, PNG or WEBP.');
  if((kind==='event'||kind==='notice')&&!(/^(image|video)\//).test(expected))
    throw Error('Please select a photo or video.');
  const mime=asset.mimeType||expected;
  // Some Android document providers report application/octet-stream;
  // do not trust client MIME alone: bucket still restricts upload MIME.
  if(mime!==expected&&mime!=='application/octet-stream')
    throw Error('File extension and content type do not match.');
  if(asset.size>limit(kind))throw Error('File is too large for this section.');
  if(!String(asset.uri).trim())throw Error('Select a valid local file.');
  return {contentType:expected,extension,maxBytes:limit(kind)};
}

export async function pickBuklodScopeHomeMedia(photoOnly=false):Promise<BuklodScopeHomeFile|null>{
  const granted=await ensureImagePickerLibraryAccess(ImagePicker.requestMediaLibraryPermissionsAsync);
  if(!granted)throw Error('Allow media-library access to choose a photo or video.');
  const result=await ImagePicker.launchImageLibraryAsync({
    mediaTypes:(photoOnly?['images']:['images','videos']) as any,
    allowsMultipleSelection:false,quality:0.88,videoMaxDuration:180,
  });
  if(result.canceled||!result.assets?.[0])return null;
  const a=result.assets[0],isVideo=a.type==='video';
  return {
    uri:a.uri,name:a.fileName??(isVideo?'event.mp4':'photo.jpg'),
    mimeType:a.mimeType??(isVideo?'video/mp4':'image/jpeg'),
    size:Number(a.fileSize??0),mediaType:isVideo?'video':'image',
  };
}

export async function pickBuklodScopeHomeResource():Promise<BuklodScopeHomeFile|null>{
  const result=await DocumentPicker.getDocumentAsync({copyToCacheDirectory:true,multiple:false,
    type:['application/pdf','text/plain','text/csv',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/*','video/*']});
  if(result.canceled||!result.assets?.[0])return null;
  const a=result.assets[0];
  const mime=a.mimeType??MIME_BY_EXT[ext(a.name)]??'';
  return {uri:a.uri,name:a.name,mimeType:mime,
    size:Number(a.size??0),mediaType:mime.startsWith('image/')?'image':
      mime.startsWith('video/')?'video':'file',
    webFile:(a as any).file??null};
}

async function readUploadBytes(asset:BuklodScopeHomeFile,kind:BuklodScopeHomeAssetKind){
  if(Platform.OS==='web'){
    const bytes=asset.webFile?await asset.webFile.arrayBuffer():
      await fetch(asset.uri).then(response=>{
        if(!response.ok)throw Error('Selected media cannot be read. Choose the file again.');
        return response.arrayBuffer();
      });
    if(!bytes.byteLength||bytes.byteLength>limit(kind))throw Error('Selected file exceeds the supported size.');
    return bytes;
  }
  // Legacy file-system reads remain supported on existing runtime 1.3.2.
  const base64=await FileSystem.readAsStringAsync(asset.uri,{encoding:FileSystem.EncodingType.Base64});
  const bytes=decode(base64);
  if(!bytes.byteLength||bytes.byteLength>limit(kind))throw Error('Selected file exceeds the supported size.');
  return bytes;
}

export async function uploadBuklodScopeHomeAsset(
 input:{scopeId:string;kind:BuklodScopeHomeAssetKind;asset:BuklodScopeHomeFile}
):Promise<{storagePath:string;mimeType:string}>{
  if(!UUID.test(input.scopeId))throw Error('A valid Cluster/Organization is required.');
  const {contentType,extension}=validateBuklodScopeHomeFile(input.asset,input.kind);
  const {data,error:authError}=await supabase.auth.getUser();
  if(authError||!data.user?.id)throw Error('Please sign in again.');
  const bytes=await readUploadBytes(input.asset,input.kind);
  const unique=Date.now()+'-'+Math.random().toString(36).slice(2,13);
  const storagePath=`${input.scopeId}/${input.kind}/${data.user.id}/${unique}.${extension}`;
  const {error}=await supabase.storage.from(BUKLOD_SCOPE_HOME_ASSET_BUCKET)
    .upload(storagePath,bytes,{contentType,upsert:false});
  if(error)throw error;
  return {storagePath,mimeType:contentType};
}

export async function signedBuklodScopeHomeAsset(path:string|null|undefined){
  if(!path||!/^([0-9a-f-]{36})\/(profile|event|notice|resource)\//i.test(path))return null;
  const {data,error}=await supabase.storage.from(BUKLOD_SCOPE_HOME_ASSET_BUCKET)
    .createSignedUrl(path,1800);
  if(error)return null;
  return data?.signedUrl??null;
}

export async function rollbackBuklodScopeHomeAsset(path:string|null|undefined){
  if(!path)return;
  await supabase.storage.from(BUKLOD_SCOPE_HOME_ASSET_BUCKET).remove([path]);
}
