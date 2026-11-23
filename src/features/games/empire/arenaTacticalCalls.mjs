/** Safe local tactical calls for offline BUKLOD Arena practice.
 * Real multiplayer voice/pings require an authenticated, match-isolated server
 * channel and are intentionally NOT sent through unrecognized ranked actions.
 */
export const ARENA_TACTICAL_CALLS=Object.freeze({
  push: Object.freeze({label:'PUSH',speak:'Push together!',order:'push',icon:'sword-cross'}),
  defend: Object.freeze({label:'DEFEND',speak:'Defend our base!',order:'defend',icon:'shield-sword'}),
  retreat: Object.freeze({label:'RETREAT',speak:'Fall back now!',order:'retreat',icon:'arrow-u-left-top'}),
  gather: Object.freeze({label:'GATHER',speak:'Gather resources!',order:'mine',icon:'pickaxe'}),
  escort: Object.freeze({label:'ESCORT',speak:'Help our team!',order:'escort',icon:'account-group'}),
  repair: Object.freeze({label:'REPAIR',speak:'Repair the tower!',order:'repair',icon:'hammer-wrench'}),
});
export function arenaTacticalCall(key){
 return typeof key==='string'&&Object.prototype.hasOwnProperty.call(ARENA_TACTICAL_CALLS,key)
   ? ARENA_TACTICAL_CALLS[key] : null;
}
export function arenaCanSendLocalCall(state,seat,key){
 const call=arenaTacticalCall(key);
 return Boolean(call&&state?.status==='active'&&!state?.solo&&
   state?.players?.[seat]?.alive && state?.kind==='OFFLINE_PRACTICE');
}
export const ARENA_TEAM_COMM_RELEASE_GATE=Object.freeze({
  liveVoice:false,verifiedTeamPings:false,
  reason:'No reviewed match-scoped authenticated team media/signalling channel is deployed.',
});
