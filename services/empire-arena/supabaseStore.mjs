/**
 * Trusted Supabase boundary for the BUKLOD authoritative Arena server.
 * Reads Auth and canonical Character state using the *verified USER token*;
 * writes Diamond stakes/results only with a private server-side secret key.
 * No secret is ever imported from the React Native app.
 */
import { createClient } from '@supabase/supabase-js';
import { claimEarnedDiamondsThenReadProfile } from './rankedParticipation.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEROES=new Set(['phan','quin','van','christian','lhen','ace','ellusur','jawo','mitch','niel','angel','vhen','trudice']);

function makeUrl(base,path){
  const origin=new URL(base);
  if(origin.protocol!=='https:' && !(origin.hostname==='localhost'&&origin.protocol==='http:'))
    throw Error('supabase_url_must_be_https');
  return new URL(path,origin).toString();
}

export class SupabaseArenaStore {
  constructor({url,publishableKey,secretKey,fetcher=fetch}){
    if(!url||!publishableKey||!secretKey)throw Error('Missing private ranked backend credentials');
    this.url=url;this.publishableKey=publishableKey;this.fetcher=fetcher;
    this.admin=createClient(url,secretKey,{
      auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false},
      global:{fetch:fetcher},
    });
  }
  async authenticated(token){
    if(typeof token!=='string'||token.length<30||token.length>8000)
      throw Error('invalid_auth_token');
    const response=await this.fetcher(makeUrl(this.url,'/auth/v1/user'),{
      headers:{apikey:this.publishableKey,Authorization:'Bearer '+token},
      signal:AbortSignal.timeout(6500),
    });
    if(!response.ok)throw Error('auth_token_not_verified');
    const user=await response.json();
    if(!user||!UUID.test(user.id||''))throw Error('invalid_verified_identity');
    return {id:user.id};
  }
  async selectedCharacter(token){
    const response=await this.fetcher(makeUrl(this.url,'/rest/v1/rpc/get_my_buklod_character_selection_v2'),{
      method:'POST',
      headers:{apikey:this.publishableKey,Authorization:'Bearer '+token,'Content-Type':'application/json'},
      body:'{}',signal:AbortSignal.timeout(6500),
    });
    if(!response.ok)throw Error('canonical_character_verification_failed');
    const selection=await response.json();
    if(!HEROES.has(selection?.active_character_id))throw Error('invalid_account_character');
    const level=Number(selection.character_level);
    return {hero:selection.active_character_id,
      characterLevel:Number.isInteger(level)?Math.min(20,Math.max(1,level)):1};
  }
  async rpc(name,params){
    const {data,error}=await this.admin.rpc(name,params);
    if(error)throw new Error('trusted_rpc_failed:' + error.code);
    return data;
  }
  async profile({userId,hero}){
    if(!UUID.test(userId)||!HEROES.has(hero))throw Error('invalid_profile_lookup');
    // Claim only prior server-verified, legitimately earned participation
    // events. The private RPC is idempotent and daily-capped. No client-supplied
    // BP, Diamond, faith, or match result can create a reward.
    // Fail closed if the trusted claim/ledger schema is not deployed.
    const r=await claimEarnedDiamondsThenReadProfile(
      this.rpc.bind(this),userId,hero);
    const diamonds=Number(r?.diamonds);
    const rating=Number(r?.rating);
    const itemLevel=Number(r?.verified_item_level);
    if(!Number.isSafeInteger(diamonds)||diamonds<0||diamonds>1e7||
      !Number.isSafeInteger(rating)||rating<0||rating>1e7||
      !Number.isInteger(itemLevel)||itemLevel<1||itemLevel>20)
      throw Error('ranked_profile_not_verified');
    return {diamonds,rating,verifiedItemLevel:itemLevel,eligible:diamonds>=1};
  }
  async open({matchId,mode,mapId,players}){
    return await this.rpc('arena_v2_ranked_open',{
      p_match_id:matchId,p_mode:mode,p_map:mapId,p_players:players,
    });
  }
  async settle({matchId,winner,reason}){
    return await this.rpc('arena_v2_ranked_settle',{
      p_match_id:matchId,p_winner:winner,p_reason:reason,
    });
  }
  async abort({matchId,reason}){
    return await this.rpc('arena_v2_ranked_abort',{p_match_id:matchId,p_reason:reason});
  }
  async expire(){
    return await this.rpc('arena_v2_ranked_expire',{});
  }
  async recover(){
    return await this.rpc('arena_v2_ranked_recover_orphans',{});
  }
}

export function deriveVerifiedArenaSnapshot(selection,profile){
  if(!selection||!profile?.eligible)throw Error('not_eligible_for_ranked');
  // All three gates must be earned. Items and BP are never client-reported.
  // Diamonds are held in the separate authoritative nontransferable ledger.
  const bp=Math.min(20,Math.max(1,selection.characterLevel));
  const items=Math.min(20,Math.max(1,profile.verifiedItemLevel));
  const diamonds=Math.max(0,Math.floor(profile.diamonds));
  return {
    characterLevel:Math.min(bp,items,1+Math.floor(diamonds/3)),
    bpEligibleLevel:bp,itemVerifiedLevel:items,diamonds,verifiedItems:[],
  };
}
