/**
 * Privileged Diamond eligibility pipeline shared by the production Supabase
 * adapter and dependency-free tests. 'rpc' must be a server-only, service-role
 * call supplied after authenticated user verification.
 *
 * Neither this function nor the client can award or fabricate BP or Diamonds.
 */
export async function claimEarnedDiamondsThenReadProfile(rpc, userId, hero){
  if(typeof rpc!=='function')throw Error('trusted_ranked_rpc_required');
  if(typeof userId!=='string'||typeof hero!=='string')
    throw Error('invalid_ranked_profile_parameters');
  await rpc('arena_v2_claim_daily_diamonds',{p_user:userId});
  return rpc('arena_v2_ranked_profile',{p_user:userId,p_hero:hero});
}
