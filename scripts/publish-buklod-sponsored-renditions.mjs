#!/usr/bin/env node
/**
 * Explicit trusted-operator promotion of already-encoded sponsored MP4 variants.
 * Dry-run is default; --apply requires SUPABASE_SERVICE_ROLE_KEY in trusted
 * local environment (never EXPO_PUBLIC / never mobile client).
 * Preserves video_url, approval state, payment and all existing campaign records.
 */
import { readFileSync, statSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const PROJECT_URL = 'https://yhanxndaqbmuzbdqlblu.supabase.co';
const slug = value => typeof value === 'string' && /^[a-z0-9-]{36}$/i.test(value);
const flags = process.argv.slice(2);
const flag = name => { const i=flags.indexOf(name); return i<0?'':flags[i+1]||''; };
const campaignId=flag('--campaign-id');
const manifestPath=flag('--manifest');
const apply=flags.includes('--apply');

function fail(message) {throw new Error(message);}
function validatedArtifact(item, originalSize) {
  if (!item || item.usable!==true || !item.outputFile ||
      !Number.isFinite(item.bytes) || item.bytes <= 0 ||
      !Number.isFinite(originalSize) || item.bytes >= originalSize) return null;
  const path=resolve(item.outputFile);
  const stat=statSync(path);
  if(stat.size!==item.bytes) fail('Encoded bytes mismatch.');
  const data=readFileSync(path);
  if(createHash('sha256').update(data).digest('hex')!==item.sha256)
    fail('Encoded file SHA mismatch.');
  const header=data.subarray(0,Math.min(data.length,1024*1024)).toString('latin1');
  const moov=header.indexOf('moov'),mdat=header.indexOf('mdat');
  if(moov<0 || mdat<0 || moov>mdat) fail('MP4 faststart missing.');
  return { data, bytes:stat.size };
}

async function main(){
  if(!slug(campaignId) || !manifestPath) fail('Required --campaign-id UUID --manifest PATH');
  const m=JSON.parse(readFileSync(resolve(manifestPath),'utf8'));
  const mobile=validatedArtifact(m.variants?.mobile,m.originalBytes);
  const low=validatedArtifact(m.variants?.low,m.originalBytes);
  if(!mobile && !low) fail('No smaller validated MP4 variants to publish.');
  if(!apply){
    process.stdout.write(JSON.stringify({
      dryRun:true, campaignId, originalBytes:m.originalBytes,
      variants:{mobileBytes:mobile?.bytes??null,lowBytes:low?.bytes??null},
      note:'No files uploaded, no database changes. Use --apply only after approval.',
    })+'\n');
    return;
  }

  const url=process.env.SUPABASE_URL, service=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(url!==PROJECT_URL || !service || service.length<20)
    fail('Trusted BUKLOD MAIN server credentials unavailable.');
  const sb=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:c,error}=await sb.from('buklod_paid_ad_campaigns')
    .select('id,advertiser_user_id,video_url,media_path,creative_type')
    .eq('id',campaignId).maybeSingle();
  if(error||!c||c.creative_type!=='video'||!c.video_url)
    fail('Video campaign not found or ineligible.');
  if(typeof c.media_path!=='string' ||
      !c.media_path.startsWith(c.advertiser_user_id+'/creative/') ||
      !/^[a-f0-9-]{36}\/creative\/[a-z0-9_.-]+\.mp4$/i.test(c.media_path))
    fail('Untrusted campaign storage path.');
  if(!c.video_url.startsWith(PROJECT_URL+'/storage/v1/object/public/paid-ad-media/'))
    fail('Original video URL is not the expected public storage origin.');

  const base=c.media_path.replace(/\.mp4$/i,'');
  const urls={};
  for(const [kind,item] of [['mobile',mobile],['low',low]]){
    if(!item)continue;
    const hash=createHash('sha256').update(item.data).digest('hex').slice(0,12);
    const path=`${base}.${kind}.${hash}.mp4`;
    const {error:uploadError}=await sb.storage.from('paid-ad-media')
      .upload(path,new Uint8Array(item.data),{
        contentType:'video/mp4',cacheControl:'31536000',upsert:false,
      });
    if(uploadError)fail(`Failed to upload verified ${kind} rendition; campaign unchanged.`);
    const {data:link}=sb.storage.from('paid-ad-media').getPublicUrl(path);
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),12000);
    let response;
    try{response=await fetch(link.publicUrl,{method:'HEAD',signal:controller.signal});}
    finally{clearTimeout(timer);}
    if(!response?.ok)fail(`Uploaded ${kind} URL not verifiable; campaign unchanged.`);
    const length=Number(response.headers.get('content-length')||0);
    if(length && length!==item.bytes)fail(`Published ${kind} bytes mismatch; campaign unchanged.`);
    urls[kind]=link.publicUrl;
  }
  // Optimistic check ensures no concurrent campaign URL swap is lost.
  const {data:updated,error:updateError}=await sb.from('buklod_paid_ad_campaigns')
    .update({
      ...(urls.mobile?{video_url_mobile:urls.mobile}:{}),
      ...(urls.low?{video_url_low:urls.low}:{}),
    })
    .eq('id',campaignId).eq('video_url',c.video_url).select('id').maybeSingle();
  if(updateError||!updated)fail('Campaign update rejected; original remains unchanged.');
  process.stdout.write(JSON.stringify({
    verified:true,campaignId,optimized:true,originalPreserved:true,
    published:['mobile','low'].filter(kind=>Boolean(urls[kind])),
  })+'\n');
}
main().catch(error=>{
  // Never log credentials, private API responses, tokens or raw media path.
  process.stderr.write(`Sponsored video promotion blocked: ${String(error?.message??error).slice(0,200)}\n`);
  process.exitCode=1;
});
