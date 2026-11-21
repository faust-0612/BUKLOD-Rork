import {
  EMPTY_WORLD_BP_WALLET, applyWorldBpWalletChange,
  availableBp, receivedBpFromDebit, type WorldBpWallet,
} from '@/features/world/worldBpWalletContract';

describe('World BP: received is spendable but not lifetime earned or rank',()=>{
  it('receiving 500 gifted BP only increases Available BP',()=>{
    const first=applyWorldBpWalletChange(EMPTY_WORLD_BP_WALLET,{
      type:'receive_transfer',amount:500,origin:'earned_origin',reason:'gift',receiptId:'gift-1'
    });
    expect(first.ok).toBe(true);
    if(!first.ok)return;
    expect(availableBp(first.wallet)).toBe(500);
    expect(first.wallet.receivedEarnedOriginBp).toBe(500);
    expect(first.wallet.lifetimeEarnedBp).toBe(0);
    expect(first.wallet.earnedAvailableBp).toBe(0);
  });
  it('gifted-earned BP can buy goods without creating earned rank; source stays recognizable',()=>{
    const credited=applyWorldBpWalletChange(EMPTY_WORLD_BP_WALLET,{
      type:'receive_transfer',amount:500,origin:'earned_origin',reason:'gift',receiptId:'gift-2'
    });
    if(!credited.ok)throw Error('Setup failure');
    const spent=applyWorldBpWalletChange(credited.wallet,{
      type:'spend_purchase',amount:300,receiptId:'buy-1'
    });
    expect(spent.ok).toBe(true);
    if(!spent.ok)return;
    expect(availableBp(spent.wallet)).toBe(200);
    expect(spent.wallet.lifetimeEarnedBp).toBe(0);
    expect(spent.debitSources?.giftedEarnedBpDebited).toBe(300);
  });
  it('verified BP earning increases lifetime earned + available, not double-counting gifts',()=>{
    const gifted=applyWorldBpWalletChange(EMPTY_WORLD_BP_WALLET,{
      type:'receive_transfer',amount:300,origin:'earned_origin',reason:'gift',receiptId:'gift-3'});
    if(!gifted.ok)throw Error('Setup failure');
    const earned=applyWorldBpWalletChange(gifted.wallet,{
      type:'earn_verified',amount:120,receiptId:'activity-1'});
    expect(earned.ok).toBe(true);
    if(!earned.ok)return;
    expect(earned.wallet.lifetimeEarnedBp).toBe(120);
    expect(availableBp(earned.wallet)).toBe(420);
  });
  it('re-gifting earned BP never raises Lifetime Earned BP on either receiving account',()=>{
    const first=applyWorldBpWalletChange(EMPTY_WORLD_BP_WALLET,{
      type:'receive_transfer',amount:300,origin:'earned_origin',reason:'gift',receiptId:'gift-4'});
    if(!first.ok)throw Error('Setup failure');
    const sender=applyWorldBpWalletChange(first.wallet,{
      type:'send_transfer',amount:200,reason:'gift',receiptId:'gift-5'});
    expect(sender.ok).toBe(true);
    if(!sender.ok || !sender.debitSources)return;
    const origins=receivedBpFromDebit(sender.debitSources);
    expect(origins).toEqual({earnedOriginBp:200});
    if(!origins)throw Error('Missing transfer source');
    const receiver=applyWorldBpWalletChange(EMPTY_WORLD_BP_WALLET,{
      type:'receive_transfer',amount:origins.earnedOriginBp,origin:'earned_origin',reason:'gift',receiptId:'gift-5'});
    expect(receiver.ok).toBe(true);
    if(!receiver.ok)return;
    expect(receiver.wallet.lifetimeEarnedBp).toBe(0);
    expect(availableBp(receiver.wallet)).toBe(200);
  });
  it('does not expose a paid-BP purchase model in the World wallet',()=>{
    expect(EMPTY_WORLD_BP_WALLET).toEqual({
      lifetimeEarnedBp:0,earnedAvailableBp:0,receivedEarnedOriginBp:0,
    });
  });
  it('rejects zero, negative, unsafe or unaffordable amount',()=>{
    expect(applyWorldBpWalletChange(EMPTY_WORLD_BP_WALLET,{
      type:'receive_transfer',amount:-1,origin:'earned_origin',reason:'gift',receiptId:'invalid'}).ok).toBe(false);
    expect(applyWorldBpWalletChange(EMPTY_WORLD_BP_WALLET,{
      type:'send_transfer',amount:1,reason:'gift',receiptId:'empty'}).ok).toBe(false);
    expect(applyWorldBpWalletChange(EMPTY_WORLD_BP_WALLET,{
      type:'earn_verified',amount:Number.MAX_SAFE_INTEGER+1,receiptId:'overflow'}).ok).toBe(false);
  });
});
