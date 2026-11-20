import test from "node:test";
import assert from "node:assert/strict";
import {createMatch} from "../src/features/empire-arena/arenaCore.mjs";
import {createRoomCoordinator} from "../src/features/empire-arena/roomCoordinator.mjs";
function setup(){
 const roster=Array.from({length:6},(_,i)=>({id:"u"+i,team:i<3?"A":"B",characterId:"phan",effectiveLevel:7,humanVerified:true}));
 const initialMatch=createMatch({id:"server-room-1",roster,ranked:true});
 let now=1000;
 const verifyTicket=async token=>token==="good"?{matchId:initialMatch.id,userId:"u0",expiresAtMs:9000}:null;
 const room=createRoomCoordinator({initialMatch,verifyTicket,nowEpochMs:()=>now});
 return {room,setNow:n=>{now=n}};
}
test("unsigned ticket cannot enter ranked room",async()=>{
 const {room}=setup();
 assert.equal((await room.join({userId:"u0",ticketToken:"fake"})).ok,false);
});
test("verified ticket binds actor and rejects spoofing",async()=>{
 const {room}=setup();
 assert.equal((await room.join({userId:"u0",ticketToken:"good"})).ok,true);
 assert.equal(room.submit({userId:"u0",command:{actorId:"u1",seq:1,type:"attack",target:"u3"}}).accepted,false);
 assert.equal(room.submit({userId:"u0",command:{actorId:"u0",seq:1,type:"move",dx:1,dy:0}}).accepted,true);
 assert.equal(room.submit({userId:"u0",command:{actorId:"u0",seq:1,type:"move",dx:1,dy:0}}).accepted,false);
 await room.tick();
 assert.equal(room.snapshot().players.u0.lastSeq,1);
});
test("expired ticket cannot keep sending input",async()=>{
 const {room,setNow}=setup();
 await room.join({userId:"u0",ticketToken:"good"});
 setNow(9001);
 assert.equal(room.submit({userId:"u0",command:{actorId:"u0",seq:1,type:"move",dx:1,dy:0}}).accepted,false);
});
test("disconnect does not manufacture a defeat",async()=>{
 const {room}=setup();await room.join({userId:"u0",ticketToken:"good"});
 assert.equal(room.disconnect("u0"),true);
 assert.equal(room.inspect().status,"active");
});
test("terminal persistence retries once and never duplicates successful completion",async()=>{
 const roster=Array.from({length:6},(_,i)=>({id:"u"+i,team:i<3?"A":"B",characterId:"phan",effectiveLevel:7,humanVerified:true}));
 const m=createMatch({id:"server-room-2",roster,ranked:true});
 m.teams.B.coreHp=0;
 let calls=0;
 const room=createRoomCoordinator({initialMatch:m,verifyTicket:async()=>null,onTerminal:async()=>{calls++;if(calls===1)throw Error("transient");}});
 await room.tick();assert.equal(room.inspect().terminalDelivered,false);
 await room.tick();assert.equal(room.inspect().terminalDelivered,true);
 await room.tick();assert.equal(calls,2);
});
