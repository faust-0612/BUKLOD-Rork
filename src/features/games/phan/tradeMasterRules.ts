/** Phan Trade Master: finite market inventory, daily price curves and auditable contracts. */
export type TradeGood=0|1|2;
export type TradeContract={id:string;good:TradeGood;quantity:number;payout:number};
export type TradeRound={
 level:number;day:number;cash:number;initialCash:number;inventory:[number,number,number];
 marketStock:[number,number,number];contracts:TradeContract[];fulfilled:string[];
 spent:number;earned:number;deals:number;status:'playing'|'won'|'lost';score:number;
};
export const GOODS=['WHEAT','CLOTH','LUMBER'] as const;
export const TRADE_SEASONS=[
 {start:510,initial:[2,1,1] as const,targets:2,contracts:[
  {id:'mill',good:0 as TradeGood,quantity:4,payout:184},
  {id:'tailor',good:1 as TradeGood,quantity:3,payout:218},
  {id:'builder',good:2 as TradeGood,quantity:2,payout:172}]},
 {start:555,initial:[1,1,0] as const,targets:3,contracts:[
  {id:'wheat-hall',good:0 as TradeGood,quantity:5,payout:240},
  {id:'festival',good:1 as TradeGood,quantity:4,payout:310},
  {id:'mill-fix',good:2 as TradeGood,quantity:3,payout:283}]},
 {start:620,initial:[0,1,0] as const,targets:3,contracts:[
  {id:'winter-wheat',good:0 as TradeGood,quantity:6,payout:306},
  {id:'hospital-cloth',good:1 as TradeGood,quantity:5,payout:370},
  {id:'bridge-wood',good:2 as TradeGood,quantity:4,payout:395}]},
] as const;
const PRICE_BASE=[24,42,56];
const DAILY_SHIFT=[
 [0,0,0],[3,-2,5],[-1,5,-2],[5,1,3],[2,-3,6],
] as const;
export function tradePrice(level:number,day:number,good:TradeGood,side:'buy'|'sell'):number{
 if(!TRADE_SEASONS[level]||!Number.isInteger(day)||day<0||day>4||good<0||good>2)throw Error('Invalid market tick');
 const shift=DAILY_SHIFT[day][good]+(level*3);
 return PRICE_BASE[good]+shift+(side==='buy'?8:-4);
}
const stock=():[number,number,number]=>[8,7,6];
export function createTradeRound(level:number):TradeRound{
 const cfg=TRADE_SEASONS[level];if(!cfg||!Number.isInteger(level))throw Error('Invalid trade season');
 return {level,day:0,cash:cfg.start,initialCash:cfg.start,
  inventory:[...cfg.initial] as [number,number,number],marketStock:stock(),
  contracts:cfg.contracts.map(c=>({...c})),fulfilled:[],
  spent:0,earned:0,deals:0,status:'playing',score:0};
}
export function tradeBuy(round:TradeRound,good:TradeGood,qty:number):TradeRound{
 if(round.status!=='playing')throw Error('Trade season finished');
 if(!Number.isInteger(qty)||qty<1||qty>5||good<0||good>2)throw Error('Invalid trade order');
 const cost=tradePrice(round.level,round.day,good,'buy')*qty;
 if(cost>round.cash||qty>round.marketStock[good]||
    round.inventory.reduce((a,b)=>a+b,0)+qty>24)return round;
 const inv=[...round.inventory] as [number,number,number],market=[...round.marketStock] as [number,number,number];
 inv[good]+=qty;market[good]-=qty;
 return {...round,inventory:inv,marketStock:market,cash:round.cash-cost,spent:round.spent+cost,deals:round.deals+1};
}
export function tradeSell(round:TradeRound,good:TradeGood,qty:number):TradeRound{
 if(round.status!=='playing')throw Error('Trade season finished');
 if(!Number.isInteger(qty)||qty<1||qty>5||good<0||good>2)throw Error('Invalid trade order');
 if(round.inventory[good]<qty)return round;
 const gain=tradePrice(round.level,round.day,good,'sell')*qty;
 const inv=[...round.inventory] as [number,number,number];inv[good]-=qty;
 return {...round,inventory:inv,cash:round.cash+gain,earned:round.earned+gain,deals:round.deals+1};
}
export function fulfillTrade(round:TradeRound,contractId:string):TradeRound{
 if(round.status!=='playing')throw Error('Trade season finished');
 const job=round.contracts.find(c=>c.id===contractId);
 if(!job||round.fulfilled.includes(contractId)||round.inventory[job.good]<job.quantity)return round;
 const inv=[...round.inventory] as [number,number,number];inv[job.good]-=job.quantity;
 return {...round,cash:round.cash+job.payout,inventory:inv,
  earned:round.earned+job.payout,fulfilled:[...round.fulfilled,contractId],deals:round.deals+1};
}
export function endTradeDay(round:TradeRound):TradeRound{
 if(round.status!=='playing')throw Error('Trade season finished');
 if(round.day<4)return {...round,day:round.day+1,marketStock:stock()};
 const goal=TRADE_SEASONS[round.level].targets;
 const won=round.fulfilled.length>=goal&&round.cash>=150;
 const margin=round.earned-round.spent;
 return {...round,status:won?'won':'lost',
  score:Math.max(0,Math.round((round.cash-round.initialCash)*1.5+round.fulfilled.length*450+Math.max(0,margin)*.2))};
}
