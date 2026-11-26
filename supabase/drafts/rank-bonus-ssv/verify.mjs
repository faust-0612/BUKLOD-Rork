import { createPublicKey, verify } from 'node:crypto';
import { Buffer } from 'node:buffer';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Preserve the signed raw query order and encoding, per Google's SSV contract. */
export function parseRankBonusCallback(url,expectedUnit){
  if(typeof url!=='string'||url.length>8192||!/^\d{1,24}$/.test(expectedUnit))return null;
  const q=url.indexOf('?');
  if(q<0||url.includes('#'))return null;
  const raw=url.slice(q+1);
  const match=raw.match(/^(.+)&signature=([^&]+)&key_id=(\d{1,12})$/);
  if(!match)return null;
  const [,signed,encodedSignature,keyId]=match;
  const fields=new URLSearchParams(signed),seen=new Set();
  for(const [name] of fields){
    if(seen.has(name)||name==='signature'||name==='key_id')return null;
    seen.add(name);
  }
  const sessionId=fields.get('custom_data')??'';
  const transactionId=fields.get('transaction_id')??'';
  const rawTime=fields.get('timestamp')??'';
  if(!UUID.test(sessionId)||fields.get('user_id')!==sessionId||
    !/^[0-9a-f]{16,128}$/i.test(transactionId)||fields.get('ad_unit')!==expectedUnit||
    fields.get('reward_amount')!=='1'||fields.get('reward_item')!=='rank_cosmetic'||
    !/^(\d{13}|\d{16})$/.test(rawTime))return null;
  const time=Number(rawTime)/(rawTime.length===16?1000:1);
  if(!Number.isFinite(time))return null;
  let signature;
  try{signature=decodeURIComponent(encodedSignature);}catch{return null;}
  if(!/^[A-Za-z0-9_-]{60,150}={0,2}$/.test(signature))return null;
  return {signed,keyId,signature,sessionId,transactionId:transactionId.toLowerCase(),rewardAt:new Date(Math.floor(time)).toISOString()};
}

export function verifyRankBonusSignature(callback,base64Spki){
  if(!callback||typeof base64Spki!=='string'||base64Spki.length>1024)return false;
  try{
    const key=createPublicKey({key:Buffer.from(base64Spki,'base64'),format:'der',type:'spki'});
    if(key.asymmetricKeyType!=='ec'||key.asymmetricKeyDetails?.namedCurve!=='prime256v1')return false;
    return verify('sha256',Buffer.from(callback.signed,'utf8'),key,Buffer.from(callback.signature,'base64url'));
  }catch{return false;}
}
