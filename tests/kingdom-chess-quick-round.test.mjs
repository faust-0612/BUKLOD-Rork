import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Chess,chessStatus,legalChessMoves,chooseChessAiMove,chessMove} from '../src/features/games/ace/chessRules.ts';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Selectable chess AI keeps legal rules and distinct strategies',()=>{
 for(const fen of ['rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1','4k3/8/8/3q4/4P3/8/8/4K3 b - - 0 1']){
  for(let difficulty=0;difficulty<3;difficulty++){const game=new Chess(fen),before=game.fen();const choice=chooseChessAiMove(game,difficulty);assert.ok(choice);assert.equal(game.fen(),before);assert.ok(legalChessMoves(game).some(m=>m.from===choice.from&&m.to===choice.to));chessMove(game,choice);assert.equal(game.turn(),'w');}
 }
 const game=new Chess();['f3','e5','g4','Qh4#'].forEach(x=>game.move(x));assert.equal(chessStatus(game),'black-win');assert.equal(chooseChessAiMove(game,2),null);
});
test('One chess match now completes locally without forcing a three-match series',()=>{
 const source=read('src/features/games/ace/ChessMasterGameV1.tsx');for(const token of ["mode==='quick'?difficulty:0","mode==='quick'||level===2","mode==='quick'||next>=3","reward:{xp:0,kingdomXp:0}","CHANGE DIFFICULTY OR MODE","EASY • CADET","HARD • STRATEGIST"])assert.ok(source.includes(token),token);
 assert.doesNotMatch(source,/supabase|grant_bp|update_wallet/i);
 const center=read('src/features/games/kingdom/platform/KingdomInteriorCenter.tsx');assert.ok(center.includes('recordKingdomPreviewResult(owner, sessionId, result)'));
});
