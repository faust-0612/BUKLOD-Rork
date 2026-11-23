/**
 * Authenticated, on-demand Academy completion-only PDF issuance.
 * The signatory PNG must be separately installed by the authorized System Admin
 * into the PRIVATE buklod-university-issuer bucket at academy/signatory.png.
 * No signature file or service key ships with the Android or web app.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.112.2';
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';

const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Content-Type':'application/json; charset=utf-8'};
const respond=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers:cors});
const asText=(s:unknown,max=200)=>String(s??'').replace(/[\u0000-\u001f]+/g,' ').trim().slice(0,max);
const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const colors={green:rgb(0.12,0.32,0.23),gold:rgb(0.76,0.55,0.24),muted:rgb(0.42,0.48,0.42),paper:rgb(0.99,0.99,0.97)};

Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return respond(405,{error:'POST required'});
 try{
  const url=Deno.env.get('SUPABASE_URL')||'';
  const anon=Deno.env.get('SUPABASE_ANON_KEY')||'';
  const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
  const authHeader=req.headers.get('Authorization')||'';
  if(!url||!anon||!serviceKey||!authHeader.startsWith('Bearer '))return respond(401,{error:'Authentication unavailable'});
  const jwt=authHeader.slice(7);
  const client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:authHeader}}});
  const {data:auth,error:authError}=await client.auth.getUser(jwt);
  if(authError||!auth.user)return respond(401,{error:'Authenticated member required'});
  const body=await req.json().catch(()=>({}));
  const awardId=typeof body?.award_id==='string'?body.award_id:'';
  if(!/^[a-f0-9-]{36}$/i.test(awardId))return respond(400,{error:'Invalid award ID'});
  const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:cfg,error:configError}=await admin.from('buklod_university_config').select('enabled').eq('singleton',true).maybeSingle();
  if(configError||cfg?.enabled!==true)return respond(503,{error:'Academy completion issuance is not enabled'});
  const {data:award,error:awardError}=await admin.from('buklod_university_awards')
   .select('id,user_id,credential_code,status,qualifying_uc,issued_at,paper_status,paper_path,paper_sha256')
   .eq('id',awardId).eq('user_id',auth.user.id).maybeSingle();
  if(awardError||!award||award.status!=='ISSUED')return respond(404,{error:'Verified award not found'});
  const {data:credential,error:credentialError}=await admin.from('buklod_university_credentials')
   .select('code,title,tier,min_uc,prerequisites').eq('code',award.credential_code).eq('active',true).maybeSingle();
  if(credentialError||!credential||award.qualifying_uc<credential.min_uc)return respond(409,{error:'Incomplete academic award criteria'});
  const {data:evidence}=await admin.from('buklod_university_credential_evidence')
   .select('status').eq('user_id',auth.user.id).eq('credential_code',award.credential_code).maybeSingle();
  if(evidence?.status!=='VERIFIED')return respond(409,{error:'Source verification incomplete'});
  for(const required of (credential.prerequisites||[]) as string[]){
   const {data:pre}=await admin.from('buklod_university_awards').select('status')
     .eq('user_id',auth.user.id).eq('credential_code',required).maybeSingle();
   if(pre?.status!=='ISSUED')return respond(409,{error:'Academic prerequisite missing'});
  }
  // Once the PDF is registered, return a short-lived authorized URL.
  const objectPath=auth.user.id+'/'+awardId+'.pdf';
  if(award.paper_status==='READY'&&award.paper_path===objectPath&&award.paper_sha256){
   const signed=await admin.storage.from('buklod-university-papers').createSignedUrl(objectPath,90);
   if(signed.error||!signed.data?.signedUrl)return respond(503,{error:'Document temporarily unavailable'});
   return respond(200,{url:signed.data.signedUrl,verified:true,award_id:awardId});
  }
  const {data:profile}=await admin.from('profiles').select('full_name').eq('id',auth.user.id).maybeSingle();
  const memberName=asText(profile?.full_name,100);
  if(!memberName)return respond(409,{error:'Set your verified full name before requesting an academic paper'});
  const sig=await admin.storage.from('buklod-university-issuer').download('academy/signatory.png');
  if(sig.error||!sig.data)return respond(503,{error:'Authorized signature is not yet installed'});
  const signatureBytes=new Uint8Array(await sig.data.arrayBuffer());
  if(signatureBytes.byteLength<200||signatureBytes.byteLength>2_000_000)return respond(503,{error:'Signature asset failed validation'});

  const pdf=await PDFDocument.create();
  const page=pdf.addPage([842,595]);
  const regular=await pdf.embedFont(StandardFonts.Helvetica);
  const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const sigImage=await pdf.embedPng(signatureBytes).catch(()=>null);
  if(!sigImage)return respond(503,{error:'Authorized signature format must be PNG'});
  const {width:W,height:H}=page.getSize();
  page.drawRectangle({x:0,y:0,width:W,height:H,color:colors.paper});
  page.drawRectangle({x:20,y:20,width:W-40,height:H-40,borderColor:colors.gold,borderWidth:2});
  page.drawRectangle({x:31,y:31,width:W-62,height:H-62,borderColor:colors.green,borderWidth:1});
  const drawCentered=(value:string,y:number,size:number,font=regular,color=colors.green)=>{
   const text=asText(value,160);
   const measured=font.widthOfTextAtSize(text,size);
   const fitSize=measured>W-110?size*(W-110)/measured:size;
   page.drawText(text,{x:Math.max(44,(W-font.widthOfTextAtSize(text,fitSize))/2),y,size:fitSize,font,color});
  };
  drawCentered('MZB MINISTRY INC.',525,14,bold);
  drawCentered('BUKLOD ACADEMY OF HIGHER LEARNING',492,22,bold);
  drawCentered('INDEPENDENT LEARNING AND FORMATION PROGRAM',471,10,regular,colors.muted);
  page.drawLine({start:{x:158,y:449},end:{x:684,y:449},thickness:2,color:colors.gold});
  const paperTitle=credential.tier==='certificate'?'CERTIFICATE OF COMPLETION':
   credential.tier==='diploma'?'DIPLOMA OF COMPLETION':
   credential.tier==='bachelors'?"BACHELOR'S-LEVEL PROGRAM COMPLETION":
   "MASTER'S-LEVEL PROGRAM COMPLETION";
  drawCentered(paperTitle,413,17,bold);
  drawCentered('This internal academic recognition is presented to',382,11,regular,colors.muted);
  drawCentered(memberName,347,24,bold);
  const nameText=asText(credential.title,100);
  drawCentered(nameText,309,nameText.length>57?12:16,bold);
  drawCentered('for successfully meeting the verified BUKLOD learning requirements',284,11);
  drawCentered('including the applicable University Credits and prerequisite evidence.',266,11);
  page.drawText('UC at issuance: '+String(award.qualifying_uc),{x:95,y:213,font:bold,size:11,color:colors.green});
  page.drawText('Issued: '+new Date(award.issued_at).toISOString().slice(0,10),{x:95,y:195,font:regular,size:10,color:colors.muted});
  page.drawText('Award ID: '+asText(awardId,50),{x:95,y:177,font:regular,size:9,color:colors.muted});
  // Use the real approved signature image only inside protected issuance service.
  const dims=sigImage.scale(1);
  const scale=Math.min(180/dims.width,65/dims.height);
  const sigWidth=dims.width*scale, sigHeight=dims.height*scale;
  page.drawImage(sigImage,{x:W-285+(180-sigWidth)/2,y:160,width:sigWidth,height:sigHeight});
  page.drawLine({start:{x:W-292,y:155},end:{x:W-98,y:155},color:colors.gold,thickness:1});
  page.drawText('Faustino Jr M Gabut, PhD',{x:W-274,y:138,font:bold,size:11,color:colors.green});
  page.drawText('Authorized Signatory, MZB Ministry Inc.',{x:W-281,y:124,font:regular,size:9,color:colors.muted});
  drawCentered('Internal non-formal religious-learning completion credential. Not a government-recognized academic degree.',61,8,regular,colors.muted);

  const bytes=await pdf.save();
  let digest=hex(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)));
  const put=await admin.storage.from('buklod-university-papers').upload(objectPath,bytes,{contentType:'application/pdf',upsert:false});
  if(put.error) {
   if(!/already exists|duplicate|conflict/i.test(put.error.message))
    return respond(503,{error:'Unable to preserve issued document'});
   // A prior interrupted request may have uploaded the immutable PDF before
   // registering the database receipt. Recover ONLY that existing private
   // object; never overwrite it, and never register the new request's hash.
   const existing=await admin.storage.from('buklod-university-papers').download(objectPath);
   if(existing.error||!existing.data)return respond(503,{error:'Stored academic paper temporarily unavailable'});
   const original=new Uint8Array(await existing.data.arrayBuffer());
   if(original.byteLength<500||original.byteLength>10_000_000||
      new TextDecoder().decode(original.subarray(0,5))!=='%PDF-')
    return respond(503,{error:'Stored academic paper failed integrity checks'});
   digest=hex(new Uint8Array(await crypto.subtle.digest('SHA-256',original)));
  }
  const {error:updateError}=await admin.from('buklod_university_awards')
   .update({paper_status:'READY',paper_path:objectPath,paper_sha256:digest})
   .eq('id',awardId).eq('user_id',auth.user.id).eq('status','ISSUED');
  if(updateError)return respond(503,{error:'Document saved but issuance registration is pending retry'});
  const {data:latest}=await admin.from('buklod_university_awards').select('status,paper_status,paper_path')
   .eq('id',awardId).eq('user_id',auth.user.id).maybeSingle();
  if(latest?.status!=='ISSUED'||latest.paper_status!=='READY'||latest.paper_path!==objectPath)
   return respond(409,{error:'Award state changed; document withheld'});
  const signed=await admin.storage.from('buklod-university-papers').createSignedUrl(objectPath,90);
  if(signed.error||!signed.data?.signedUrl)return respond(503,{error:'Document saved; download temporarily unavailable'});
  return respond(200,{url:signed.data.signedUrl,verified:true,award_id:awardId});
 }catch{
  return respond(503,{error:'Academy paper could not be prepared; safe retry available'});
 }
});
