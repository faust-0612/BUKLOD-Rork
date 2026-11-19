/**
 * Signed-off Season 2 asset registry. Intentionally EMPTY until original,
 * legally cleared, mastered and checksum-verified media are approved.
 * Never load arbitrary remote Rive/audio merely because it has an HTTPS URL.
 */
export type GenesisRigAsset={
  uri:string;sha256:string;licenseId:string;characterId:string;rigRevision:string;
};
export type GenesisAudioAsset={
  uri:string;sha256:string;licenseId:string;durationMs:number;sampleRateHz:number;
  channelCount:number;mastered:boolean;integratedLufs:number;
};
const APPROVED_RIGS:Readonly<Record<string,GenesisRigAsset>>=Object.freeze({});
const APPROVED_AUDIO:Readonly<Record<string,GenesisAudioAsset>>=Object.freeze({});

function trusted(uri:string,sha256:string,licenseId:string):boolean{
  return /^https:\/\/[A-Za-z0-9.-]+\//.test(uri)&&/^[a-f0-9]{64}$/i.test(sha256)&&licenseId.trim().length>4;
}
export function getGenesisApprovedRig(id:string|null|undefined):GenesisRigAsset|null{
  const item=id?APPROVED_RIGS[id]:undefined;
  if(!item||!trusted(item.uri,item.sha256,item.licenseId)||!/\.riv(?:\?|$)/i.test(item.uri))return null;
  return item;
}
export function getGenesisApprovedAudio(id:string|null|undefined):GenesisAudioAsset|null{
  const item=id?APPROVED_AUDIO[id]:undefined;
  if(!item||!trusted(item.uri,item.sha256,item.licenseId)||!item.mastered||
    item.sampleRateHz<44100||item.channelCount<1||item.durationMs<1000||
    !Number.isFinite(item.integratedLufs))return null;
  return item;
}
