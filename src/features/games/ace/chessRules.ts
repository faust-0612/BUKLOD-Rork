/**
 * Ace Chess Master wrapper around vendored, BSD-2-Clause chess.js 1.2.0.
 * This verified engine implements castling, en passant, all promotions,
 * checkmate, stalemate, repetition, 50-move and insufficient-material draws.
 * The game remains entirely offline, without any account/economy side effects.
 * See ./vendor/LICENSE and original repo https://github.com/jhlywa/chess.js.
 */
// @ts-expect-error -- Node strip-types test runner requires explicit .ts; Metro resolves the same vendored TypeScript module.
import {Chess,type Square,type Move,type PieceSymbol} from './vendor/chess-js-1.2.0.ts';
export {Chess};
export type ChessSquare=Square;
export type ChessStatus='playing'|'white-win'|'black-win'|'draw';
export type ChessInput={from:Square;to:Square;promotion?:'q'|'r'|'b'|'n'};
export function chessStatus(game:Chess):ChessStatus{
 if(game.isCheckmate())return game.turn()==='w'?'black-win':'white-win';
 if(game.isDraw()||game.isStalemate())return 'draw';
 return 'playing';
}
export function chessMove(game:Chess,input:ChessInput):Move{
 return game.move(input);
}
export function legalChessMoves(game:Chess,from?:Square):Move[]{
 return from?game.moves({square:from,verbose:true}):game.moves({verbose:true});
}
const VALUE:Record<PieceSymbol,number>={p:100,n:320,b:330,r:500,q:900,k:0};
function evaluate(game:Chess):number{
 const status=chessStatus(game);
 if(status==='black-win')return 100_000;
 if(status==='white-win')return -100_000;
 if(status==='draw')return 0;
 let result=0;
 for(const row of game.board())for(const piece of row){
  if(!piece)continue;
  const central=['d4','e4','d5','e5'].includes(piece.square)?18:0;
  result+=(piece.color==='b'?1:-1)*(VALUE[piece.type]+central);
 }
 // Mild king safety bonus; no unsafe off-thread search/remote code.
 if(game.isCheck())result+=game.turn()==='w'?30:-30;
 return result;
}
const input=(move:Move):ChessInput=>({
 from:move.from,to:move.to,
 ...(move.promotion?{promotion:move.promotion as ChessInput['promotion']}:{})
});
/** Deterministic, bounded AI; level 0 beginner, level 1 material, level 2 lookahead. */
export function chooseChessAiMove(game:Chess,level:number):ChessInput|null{
 if(game.turn()!=='b'||chessStatus(game)!=='playing')return null;
 const legal=legalChessMoves(game);
 if(!legal.length)return null;
 if(level<=0){
  const history=game.history().length;
  return input(legal[(history*7+11)%legal.length]);
 }
 const search=new Chess(game.fen());
 let best=-Infinity,bestMove=legal[0];
 for(const candidate of legal){
  search.move(input(candidate));
  let score=evaluate(search);
  if(level>=2&&chessStatus(search)==='playing'){
   // Worst likely human reply. 30×30 <= ~900 evaluated boards.
   const replies=legalChessMoves(search);
   let worst=Infinity;
   for(const reply of replies){
    search.move(input(reply));
    worst=Math.min(worst,evaluate(search));
    search.undo();
   }
   if(replies.length)score=worst;
  }
  score+=candidate.captured?VALUE[candidate.captured]*.02:0;
  search.undo();
  if(score>best){best=score;bestMove=candidate;}
 }
 return input(bestMove);
}
