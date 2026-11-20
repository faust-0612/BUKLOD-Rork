/**
 * World BP wallet contract — DEV-ONLY PURE MODEL.
 *
 * BP cannot be purchased. ONLY verified active app participation may mint
 * original BP. Receiving gifted/traded BP increases AVAILABLE balance, never
 * Lifetime Earned BP, Character XP, rank or the recipient's participation score.
 *
 * Does not write canonical production BP/QMP ledgers. Server must settle
 * paired debits/credits atomically, preserve original earning provenance and
 * prevent re-use of the same earned-BP lot for repeat purchase QMP claims.
 */
export const WORLD_BP_SALES_ENABLED = false as const;
export type WorldBpOrigin = 'earned_origin';
export type WorldBpWallet = {
  lifetimeEarnedBp: number;
  earnedAvailableBp: number;
  receivedEarnedOriginBp: number;
};
export type WorldBpDebitSources = {
  earnedBpDebited: number;
  giftedEarnedBpDebited: number;
};
export type WorldBpWalletChange =
  | {type:'earn_verified';amount:number;receiptId:string}
  | {type:'receive_transfer';amount:number;origin:WorldBpOrigin;reason:'gift'|'peer_trade';receiptId:string}
  | {type:'spend_purchase';amount:number;receiptId:string}
  | {type:'send_transfer';amount:number;reason:'gift'|'peer_trade';receiptId:string};
export type WorldBpWalletOutcome =
  | {ok:true;wallet:WorldBpWallet;debitSources:WorldBpDebitSources|null}
  | {ok:false;reason:string};
export const EMPTY_WORLD_BP_WALLET: Readonly<WorldBpWallet> = {
  lifetimeEarnedBp:0,earnedAvailableBp:0,receivedEarnedOriginBp:0,
};
export function availableBp(wallet:WorldBpWallet):number {
  return wallet.earnedAvailableBp+wallet.receivedEarnedOriginBp;
}
function isPositiveSafe(v:number):boolean{return Number.isSafeInteger(v)&&v>0;}
function validWallet(wallet:WorldBpWallet):boolean{
  return Number.isSafeInteger(wallet.lifetimeEarnedBp)&&wallet.lifetimeEarnedBp>=0&&
    Number.isSafeInteger(wallet.earnedAvailableBp)&&wallet.earnedAvailableBp>=0&&
    Number.isSafeInteger(wallet.receivedEarnedOriginBp)&&wallet.receivedEarnedOriginBp>=0&&
    wallet.earnedAvailableBp<=wallet.lifetimeEarnedBp&&
    Number.isSafeInteger(availableBp(wallet));
}
function validChange(change:WorldBpWalletChange):boolean{
  if(!isPositiveSafe(change.amount)||typeof change.receiptId!=='string'||
     !change.receiptId.trim()||change.receiptId.length>160)return false;
  if(change.type==='receive_transfer')
    return change.origin==='earned_origin'&&['gift','peer_trade'].includes(change.reason);
  if(change.type==='send_transfer')
    return ['gift','peer_trade'].includes(change.reason);
  return change.type==='earn_verified'||change.type==='spend_purchase';
}
function debit(wallet:WorldBpWallet,amount:number):WorldBpWalletOutcome {
  if(availableBp(wallet)<amount)return {ok:false,reason:'Insufficient Available BP.'};
  // Predictable source order; actual server preserves per-earning-lot eligibility.
  const own=Math.min(wallet.earnedAvailableBp,amount);
  const received=amount-own;
  return {ok:true,wallet:{
    ...wallet,
    earnedAvailableBp:wallet.earnedAvailableBp-own,
    receivedEarnedOriginBp:wallet.receivedEarnedOriginBp-received,
  },debitSources:{earnedBpDebited:own,giftedEarnedBpDebited:received}};
}
export function applyWorldBpWalletChange(wallet:WorldBpWallet,change:WorldBpWalletChange):WorldBpWalletOutcome {
  if(!validWallet(wallet))return {ok:false,reason:'Invalid starting wallet.'};
  if(!validChange(change))return {ok:false,reason:'Invalid BP transaction or unsupported origin.'};
  if(change.type==='earn_verified'){
    const lifetime=wallet.lifetimeEarnedBp+change.amount;
    const available=wallet.earnedAvailableBp+change.amount;
    if(!Number.isSafeInteger(lifetime)||!Number.isSafeInteger(available)||
       !Number.isSafeInteger(availableBp(wallet)+change.amount))
      return {ok:false,reason:'BP balance overflow.'};
    return {ok:true,wallet:{...wallet,lifetimeEarnedBp:lifetime,earnedAvailableBp:available},
      debitSources:null};
  }
  if(change.type==='receive_transfer'){
    const available=wallet.receivedEarnedOriginBp+change.amount;
    if(!Number.isSafeInteger(available)||!Number.isSafeInteger(availableBp(wallet)+change.amount))
      return {ok:false,reason:'BP balance overflow.'};
    return {ok:true,wallet:{...wallet,receivedEarnedOriginBp:available},debitSources:null};
  }
  return debit(wallet,change.amount);
}
/**
 * Transferred BP remains originally earned, but not earned by the receiver.
 * A trade payment may have consumed all QMP qualification rights; server must
 * pass provenance of remaining rights separately from money availability.
 */
export function receivedBpFromDebit(source:WorldBpDebitSources):{earnedOriginBp:number}|null {
  if(!Number.isSafeInteger(source.earnedBpDebited)||source.earnedBpDebited<0||
     !Number.isSafeInteger(source.giftedEarnedBpDebited)||source.giftedEarnedBpDebited<0||
     !Number.isSafeInteger(source.earnedBpDebited+source.giftedEarnedBpDebited))return null;
  return {earnedOriginBp:source.earnedBpDebited+source.giftedEarnedBpDebited};
}
