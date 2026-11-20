/* Empire Arena server-side room coordinator.
 * This has no listener/socket transport; adapters inject trusted ticket verification,
 * snapshots and terminal persistence. Run only on a trusted server, never on a client.
 */
export function createRoomCoordinator({initialMatch,verifyTicket,onSnapshot=async()=>{},onTerminal=async()=>{},nowEpochMs=()=>Date.now()}){
  if(!initialMatch||!initialMatch.players||!initialMatch.id)throw Error("invalid_initial_match");
  if(typeof verifyTicket!=="function")throw Error("ticket_verifier_required");
  let state=JSON.parse(JSON.stringify(initialMatch));
  let busy=false,terminalDelivered=false,terminalAttempts=0;
  const sessions=new Map(),pending=[];
  function snapshot(){
    // Intentional no raw tickets/session keys. Replay/log recipients are authorized by adapter.
    return JSON.parse(JSON.stringify(state));
  }
  async function join({userId,ticketToken}){
    if(typeof userId!=="string"||!state.players[userId]||state.status!=="active")return {ok:false,reason:"not_in_active_match"};
    // Must call a real asymmetric/signature/key-rotation validator in the gateway.
    const verified=await verifyTicket(ticketToken,{matchId:state.id,userId});
    if(!verified||verified.matchId!==state.id||verified.userId!==userId||verified.expiresAtMs<=nowEpochMs())return {ok:false,reason:"invalid_signed_ticket"};
    sessions.set(userId,{verified,joinedAtMs:nowEpochMs(),lastSeenMs:nowEpochMs()});
    return {ok:true,matchId:state.id,team:state.players[userId].team,serverTick:state.tick};
  }
  function submit({userId,command}){
    const session=sessions.get(userId);
    if(!session||!validateCommandEnvelope(state,userId,session.verified,command,nowEpochMs()))
      return {accepted:false,reason:"invalid_session_or_command"};
    if(state.status!=="active")return {accepted:false,reason:"closed"};
    // Monotonic processed input; queued duplicates and excessive packets never count.
    if(command.seq<=state.players[userId].lastSeq||pending.some(x=>x.actorId===userId&&x.seq===command.seq))
      return {accepted:false,reason:"replay"};
    if(pending.length>=40||pending.filter(x=>x.actorId===userId).length>=3)
      return {accepted:false,reason:"rate_limited"};
    pending.push({actorId:userId,...command});
    session.lastSeenMs=nowEpochMs();
    return {accepted:true};
  }
  async function tick(){
    if(busy)throw Error("concurrent_tick_forbidden");
    busy=true;
    try{
      if(state.status==="active"){
        const commands=pending.splice(0,40);
        state=stepMatch(state,commands,50);
        if(state.tick%2===0){
          // Snapshot delivery failures must not stop the authoritative simulation.
          try{await onSnapshot(snapshot())}catch{/* network send failure */ }
        }
      }
      if(state.status!=="active"&&!terminalDelivered&&terminalAttempts<3){
        terminalAttempts++;
        try{
          await onTerminal({matchId:state.id,result:publicResult(state),terminalState:snapshot(),attempt:terminalAttempts});
          terminalDelivered=true;
        }catch{
          // Terminal callback must be idempotent; durable settlement service retries
          // separately after process crash or 3 in-memory attempts.
        }
      }
      return {tick:state.tick,status:state.status,pendingInputs:pending.length,terminalDelivered,terminalAttempts};
    }finally{busy=false;}
  }
  function disconnect(userId){
    const joined=sessions.has(userId);
    sessions.delete(userId);
    // A disconnect is not a client-authored defeat or a Diamond debit.
    return joined;
  }
  function inspect(){return {matchId:state.id,status:state.status,serverTick:state.tick,connectedPlayers:sessions.size,terminalDelivered,terminalAttempts};}
  return {join,submit,tick,disconnect,inspect,snapshot};
}
