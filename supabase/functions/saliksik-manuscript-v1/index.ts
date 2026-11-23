import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.112.2';
import { zipSync, strToU8 } from 'npm:fflate@0.8.2';

// Post-completion-only download. The private vault remains inaccessible to members.
const BUCKET = 'saliksik-source-originals';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TTL = 90;
const headers = {
 'Access-Control-Allow-Origin': '*',
 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info',
 'Access-Control-Allow-Methods': 'POST,OPTIONS',
 'Content-Type': 'application/json',
 'Cache-Control': 'no-store',
 'Referrer-Policy': 'no-referrer',
};
const json = (status:number,value:Record<string,unknown>) =>
 new Response(JSON.stringify(value),{status,headers});
type Chapter = {
 sequence:number;title:string;summary:string;lesson_text:string;scripture_refs:unknown;
};
type Entitlement = {
 collection_id:string;title:string;version:number;author_disclosure:string;
 original_available:boolean;original_storage_path:string|null;
 original_file_name:string|null;chapters:Chapter[];
};
const xml = (value:unknown)=>String(value??'').replace(/&/g,'&amp;')
 .replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
 .replace(/'/g,'&apos;').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');
function paragraph(text:string,bold=false):string{
 const props=bold?'<w:rPr><w:b/><w:sz w:val="30"/></w:rPr>':'';
 return text.split(/\r?\n/).map(line=>
  '<w:p><w:pPr><w:spacing w:after="130"/></w:pPr><w:r>'+props+
  '<w:t xml:space="preserve">'+xml(line)+'</w:t></w:r></w:p>'
 ).join('');
}
function buildDocument(data:Entitlement):Uint8Array{
 if(!Array.isArray(data.chapters)||data.chapters.length!==9)throw new Error('manuscript_incomplete');
 let body=paragraph('BUKLOD SALIKSIK — COMPLETE STUDY MANUSCRIPT',true)+
  paragraph(data.title,true)+paragraph('Collection version '+data.version)+
  paragraph('This file compiles all nine published study chapters. It is not the author\'s private original manuscript.')+
  paragraph(data.author_disclosure??'');
 for(const chapter of data.chapters){
  const refs=Array.isArray(chapter.scripture_refs)
   ? chapter.scripture_refs.filter((x):x is string=>typeof x==='string').join('; ') : '';
  body+=paragraph('CHAPTER '+chapter.sequence+': '+chapter.title,true);
  body+=paragraph(chapter.summary);
  if(refs)body+=paragraph('Scripture references: '+refs);
  body+=paragraph(chapter.lesson_text);
 }
 const documentXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
  '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'+
  '<w:body>'+body+
  '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>'+
  '</w:body></w:document>';
 const types='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'+
  '<Default Extension="xml" ContentType="application/xml"/>'+
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'+
  '</Types>';
 const rels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'+
  '</Relationships>';
 return zipSync({
  '[Content_Types].xml':strToU8(types),
  '_rels/.rels':strToU8(rels),
  'word/document.xml':strToU8(documentXml),
 },{level:6});
}
const safeFile=(name:string)=>{
 const filename=name.replace(/[\\/]/g,'_').replace(/[^a-z0-9_. -]/gi,'_').slice(0,130);
 return filename && !/^\.+$/.test(filename)?filename:'SALIKSIK-manuscript.docx';
};
Deno.serve(async request=>{
 if(request.method==='OPTIONS')return new Response('',{headers});
 if(request.method!=='POST')return json(405,{ok:false,reason:'method_not_allowed'});
 const authorization=request.headers.get('authorization')??'';
 if(!/^Bearer\s+\S+$/i.test(authorization))return json(401,{ok:false,reason:'sign_in_required'});
 const url=Deno.env.get('SUPABASE_URL')??'';
 const anon=Deno.env.get('SUPABASE_ANON_KEY')??'';
 if(!url||!anon)return json(503,{ok:false,reason:'service_unavailable'});
 let input:unknown;
 try{input=await request.json();}catch{return json(400,{ok:false,reason:'invalid_request'});}
 const collectionId=String((input as Record<string,unknown> | null)?.collection_id??'');
 if(!UUID.test(collectionId))return json(400,{ok:false,reason:'invalid_collection_id'});
 const userClient=createClient(url,anon,{
  global:{headers:{Authorization:authorization}},
  auth:{persistSession:false,autoRefreshToken:false},
 });
 const {data:identity,error:identityError}=await userClient.auth.getUser();
 if(identityError||!identity.user)return json(401,{ok:false,reason:'sign_in_required'});
 // Authoritative ownership/completion/rollout/rights checks happen in SQL under auth.uid().
 const {data:access,error:accessError}=await userClient.rpc('saliksik_manuscript_access_v1',{
  p_collection_id:collectionId,
 });
 if(accessError||!access?.collection_id){
  return json(403,{ok:false,reason:'complete_collection_first_or_not_available'});
 }
 const data=access as Entitlement;
 if(data.collection_id!==collectionId||data.chapters?.length!==9)
  return json(409,{ok:false,reason:'manuscript_not_verified'});
 const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'';
 if(!serviceKey)return json(503,{ok:false,reason:'private_download_unavailable'});
 const svc=createClient(url,serviceKey,{
  auth:{persistSession:false,autoRefreshToken:false},
 });
 const storage=svc.storage.from(BUCKET);
 // Original is never returned unless the owner/issuer confirmed redistribution rights.
 if(data.original_available && data.original_storage_path &&
    /^originals\/[0-9a-f-]{36}\.(pdf|docx|txt)$/i.test(data.original_storage_path)){
  const name=safeFile(data.original_file_name??'SALIKSIK-original.pdf');
  const signed=await storage.createSignedUrl(data.original_storage_path,TTL,{download:name});
  if(!signed.error&&signed.data?.signedUrl){
   return json(200,{ok:true,kind:'complete_original',name,download_url:signed.data.signedUrl});
  }
  // If original was removed, still provide the authorized derived compilation.
 }
 // Shared immutable cache across members: no per-member extra file or point allocation.
 const directory='compiled/'+collectionId+'/v'+data.version;
 const filename='complete-study-manuscript.docx';
 const path=directory+'/'+filename;
 const listed=await storage.list(directory,{limit:10});
 if(listed.error)return json(503,{ok:false,reason:'manuscript_storage_unavailable'});
 if(!(listed.data??[]).some(f=>f.name===filename)){
  let compiled:Uint8Array;
  try{compiled=buildDocument(data);}catch{return json(409,{ok:false,reason:'manuscript_compile_failed'});}
  if(compiled.byteLength>10*1024*1024)return json(413,{ok:false,reason:'manuscript_too_large'});
  const uploaded=await storage.upload(path,compiled,{
   contentType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
   cacheControl:'3600',upsert:false,
  });
  // 409 is safe if another qualified request created the exact immutable object.
  if(uploaded.error && !/already exists|duplicate|conflict/i.test(uploaded.error.message))
   return json(503,{ok:false,reason:'manuscript_storage_unavailable'});
 }
 const name='BUKLOD-SALIKSIK-'+collectionId.slice(0,8)+'-v'+data.version+'.docx';
 const signed=await storage.createSignedUrl(path,TTL,{download:name});
 if(signed.error||!signed.data?.signedUrl)
  return json(503,{ok:false,reason:'download_link_unavailable'});
 return json(200,{ok:true,kind:'complete_study_manuscript',name,download_url:signed.data.signedUrl});
});
