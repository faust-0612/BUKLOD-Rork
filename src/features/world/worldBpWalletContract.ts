/**
 * World wallet accounting contract — DEV-ONLY PURE MODEL.
 * Do not connect directly to production rewards/ledger writes. The server must
 * enforce atomic dual-entry transfers, provenance and idempotency before launch.
 *
 * Essential invariant: transferred BP increases AVAILABLE (spendable) only,
 * never recipient's Lifetime Earned BP, Character XP or BP rank.
 */
export type WorldBpOrigin = 'earned_origin' | 'purchased_origin';
export type WorldBpWallet = {
  lifetimeEarnedBp: number; // verified participation earned by this account
  earnedAvailableBp: number; // earned here, not yet spent
  receivedEarnedOriginBp: number; // gifted/traded BP traceable to someone else's earned activity
  purchasedAvailableBp: number; // paid BP held by this account
  receivedPurchasedOriginBp: number; // paid BP from another holder
};
export type WorldBpDebitSources = {
  earnedBpDebited: number;
  giftedEarnedBpDebited: number;
  purchasedBpDebited: number;
  giftedPurchasedBpDebited: number;
};
export type WorldBpWalletChange =
  | { type:'earn_verified'; amount:number; receiptId:string }
  | { type:'receive_transfer'; amount:number; origin:WorldBpOrigin; reason:'gift'|'peer_trade'; receiptId:string }
  | { type:'spend_purchase'; amount:number; receiptId:string }
  | { type:'send_transfer'; amount:number; reason:'gift'|'peer_trade'; receiptId:string };
export type WorldBpWalletOutcome =
  | {ok:true; wallet:WorldBpWallet; debitSources:WorldBpDebitSources | null}
  | {ok:false; reason:string};
export const EMPTY_WORLD_BP_WALLET: Readonly<WorldBpWallet> = {
  lifetimeEarnedBp:0,
  earnedAvailableBp:0,
  receivedEarnedOriginBp:0,
  purchasedAvailableBp:0,
  receivedPurchasedOriginBp:0,
};
export function availableBp(world:WorldBpWallet):number {
  return world.earnedAvailableBp+world.receivedEarnedOriginBp+
    world.purchasedAvailableBp+world.receivedPurchasedOriginBp;
}
function validWallet(wallet:WorldBpWallet):boolean {
  return Object.values(wallet).every(v=>Number.isSafeInteger(v)&&v>=0)
    && wallet.earnedAvailableBp<=wallet.lifetimeEarnedBp
    && Number.isSafeInteger(availableBp(wallet));
}
function validChange(change:WorldBpWalletChange):boolean{
  return Number.isSafeInteger(change.amount)&&change.amount>0&&
    change.receiptId.length>0 && change.receiptId.length<=160;
}
function debit(wallet:WorldBpWallet,amount:number):WorldBpWalletOutcome {
  if(availableBp(wallet)<amount)return {ok:false,reason:'Insufficient available BP.'};
  let remaining=amount;
  const take=(value:number)=>{const n=Math.min(value,remaining);remaining-=n;return n;};
  // Deterministic and nonnegatively bounded; actual server records each debit lot.
  const a=take(wallet.earnedAvailableBp);
  const b=take(wallet.receivedEarnedOriginBp);
  const c=take(wallet.purchasedAvailableBp);
  const d=take(wallet.receivedPurchasedOriginBp);
  if(remaining!==0)return {ok:false,reason:'Unbalanced BP funding sources.'};
  return {ok:true,
    wallet:{
      ...wallet,
      earnedAvailableBp:wallet.earnedAvailableBp-a,
      receivedEarnedOriginBp:wallet.receivedEarnedOriginBp-b,
      purchasedAvailableBp:wallet.purchasedAvailableBp-c,
      receivedPurchasedOriginBp:wallet.receivedPurchasedOriginBp-d,
    },
    debitSources:{
      earnedBpDebited:a,giftedEarnedBpDebited:b,
      purchasedBpDebited:c,giftedPurchasedBpDebited:d,
    },
  };
}
export function applyWorldBpWalletChange(wallet:WorldBpWallet,change:WorldBpWalletChange):WorldBpWalletOutcome {
  if(!validWallet(wallet))return {ok:false,reason:'Invalid starting wallet.'};
  if(!validChange(change))return {ok:false,reason:'Invalid BP transaction amount or receipt ID.'};
  if(change.type==='earn_verified'){
    if(!Number.isSafeInteger(wallet.lifetimeEarnedBp+change.amount)||
       !Number.isSafeInteger(wallet.earnedAvailableBp+change.amount))
      return {ok:false,reason:'BP amount overflow.'};
    return {ok:true,
      wallet:{
        ...wallet,lifetimeEarnedBp:wallet.lifetimeEarnedBp+change.amount,
        earnedAvailableBp:wallet.earnedAvailableBp+change.amount,
      },debitSources:null};
  }
  if(change.type==='receive_transfer'){
    const key=change.origin==='earned_origin'?'receivedEarnedOriginBp':'receivedPurchasedOriginBp';
    if(!Number.isSafeInteger(wallet[key]+change.amount)||
       !Number.isSafeInteger(availableBp(wallet)+change.amount))
      return {ok:false,reason:'BP amount overflow.'};
    return {ok:true,wallet:{...wallet,[key]:wallet[key]+change.amount},debitSources:null};
  }
  return debit(wallet,change.amount);
}
/** Never use wallet values to infer QMP, XP or rights.
 * Transfer settlement must supply a matching receipt on the other account.
 * The receiver inherits the source origin when gifted a previously gifted BP. */
export function receivedBpFromDebit(source:WorldBpDebitSources):{
  earnedOriginBp:number;purchasedOriginBp:number;
} {
  return {
    earnedOriginBp:source.earnedBpDebited+source.giftedEarnedBpDebited,
    purchasedOriginBp:source.purchasedBpDebited+source.giftedPurchasedBpDebited,
  };
}
