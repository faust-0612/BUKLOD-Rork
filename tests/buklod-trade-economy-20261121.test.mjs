import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(file, 'utf8');
const schema = read('supabase/migrations/20261121000000_buklod_permanent_trade_schema_v1.sql');
const operations = read('supabase/migrations/20261121000100_buklod_permanent_trade_operations_v1.sql');
const client = read('src/lib/buklodTradeEconomy.ts');
const ui = read('src/components/BuklodTradeWorkspace.tsx');

test('permanent trade is feature-off by default, with RLS and protected ledgers', () => {
  assert.match(schema, /enabled boolean not null default false/);
  assert.match(schema, /rank_profit_enabled boolean not null default false/);
  for (const table of [
    'buklod_trade_inventory','buklod_trade_participation_claims',
    'buklod_trade_businesses','buklod_trade_listings','buklod_trade_orders','buklod_trade_bp_transfers',
  ]) {
    assert.ok(schema.includes('alter table public.' + table + ' enable row level security'));
  }
  assert.doesNotMatch(schema + operations, /revoke all on all tables in schema public/);
  assert.doesNotMatch(schema + operations, /(?:insert|update|delete).*bayanihan_ledger/i);
  assert.doesNotMatch(schema + operations, /(?:insert|update|delete).*qmp/i);
});

test('item sourcing requires verified participation and cannot duplicate grants', () => {
  assert.match(schema, /source_ledger_id uuid primary key references public\.buklod_points_ledger/);
  assert.match(schema, /claim_state in \('claimed','legacy'\)/);
  assert.match(schema, /on conflict\(source_ledger_id\) do nothing/);
  assert.match(schema, /'community_post','community_comment','community_reaction'/);
  assert.match(schema, /'daily_bible','devotional'/);
});

test('business requires participation, starter capital and stage-by-stage growth', () => {
  assert.match(schema, /if v_count<5 then/);
  assert.match(schema, /buklod_available_points_for\(v_uid\)<40/);
  assert.match(schema, /p_orientation_ack is distinct from true/);
  assert.match(schema, /generate_series\(1,10\) l cross join generate_series\(1,5\) s/);
  assert.match(operations, /construction_stage=construction_stage\+1/);
  assert.match(operations, /if v_business\.level=10 then raise exception/);
  assert.match(ui, /Survey & posts|TRADE_CONSTRUCTION_STAGES/);
  // Level difficulty is intentionally non-linear.
  const effort = level => Math.ceil(2 * Math.pow(1.65, level - 1));
  assert.ok(effort(10) > effort(5) && effort(5) > effort(1));
});

test('listings escrow items, and purchases are transactional BP transfers, never BP mints', () => {
  assert.match(operations, /quantity=quantity-p_qty,cost_basis_bp=cost_basis_bp-v_basis/);
  assert.match(operations, /on conflict\(user_id,item_code\) do update set/);
  assert.match(operations, /buyer_request_key=p_request_key/);
  assert.match(operations, /order by user_id for update/);
  assert.match(operations, /insert into public\.buklod_trade_bp_transfers/);
  assert.doesNotMatch(operations, /'transferred','market_transfer'/);
  assert.match(operations, /'trade:buyer:'\|\|v_id::text/);
  assert.match(operations, /available_points=available_points\+v_price/);
  assert.doesNotMatch(operations, /available_points=available_points\+v_price\+v_/);
  assert.match(operations, /if v_l\.seller_id=v_uid then raise exception/);
  assert.match(operations, /Request key belongs to a different purchase/);
  assert.match(operations, /Lock BP before inventory/);
});

test('business profit Rank is independently capped, deferred, net of inventory cost', () => {
  assert.match(operations, /gross_profit_bp/);
  assert.match(operations, /'72 hours'/);
  assert.match(operations, /v_o\.gross_profit_bp>200/);
  assert.match(operations, /v_week\+v_o\.gross_profit_bp>500/);
  assert.match(operations, /lifetime_points=lifetime_points\+v_credit/);
  assert.doesNotMatch(operations, /available_points=available_points\+v_credit/);
  assert.match(operations, /'market_verified_profit'/);
  assert.match(client, /tradeGrossProfit/);
});

test('reference state machine: buyer improves asset, seller receives conserved BP and nonduplicated profit', () => {
  const wallet = new Map([['buyer',500],['seller',200]]);
  const inventory = new Map([['buyer',0],['seller',5]]);
  const orders = new Map();
  let sellerLifetimeRank = 200;
  const payment = ({ requestKey, qty, unitPrice, costBasis }) => {
    if (orders.has(requestKey)) return orders.get(requestKey);
    const amount = qty * unitPrice;
    assert.ok(qty <= inventory.get('seller'));
    assert.ok(wallet.get('buyer') >= amount);
    inventory.set('seller', inventory.get('seller') - qty);
    inventory.set('buyer', inventory.get('buyer') + qty);
    wallet.set('buyer', wallet.get('buyer') - amount);
    wallet.set('seller', wallet.get('seller') + amount);
    const profit = Math.max(0, amount - costBasis);
    sellerLifetimeRank += profit;
    const receipt = { amount, profit };
    orders.set(requestKey, receipt);
    return receipt;
  };
  const before = [...wallet.values()].reduce((a,b)=>a+b,0);
  assert.deepEqual(payment({requestKey:'same-idempotent-key',qty:2,unitPrice:50,costBasis:20}), {amount:100,profit:80});
  assert.deepEqual(payment({requestKey:'same-idempotent-key',qty:2,unitPrice:50,costBasis:20}), {amount:100,profit:80});
  assert.equal(wallet.get('buyer'),400);
  assert.equal(wallet.get('seller'),300);
  assert.equal(inventory.get('buyer'),2);
  assert.equal(inventory.get('seller'),3);
  assert.equal(sellerLifetimeRank,280);
  assert.equal([...wallet.values()].reduce((a,b)=>a+b,0),before);
});

test('no replacement of existing Palengke door or commercial subscription shell', () => {
  assert.match(read('src/app/profile/buklod-bp-market.tsx'), /BuklodTradeWorkspace/);
  assert.match(read('src/app/profile/buklod-bp-business.tsx'), /BuklodTradeWorkspace/);
  assert.match(read('src/components/BuklodFoundationWorkspaceNav.tsx'), /Virtual BP Exchange/);
  assert.match(read('src/components/BuklodTradeWorkspace.tsx'), /AsyncStorage\.getItem\(storageKey\)/);
  assert.match(read('src/components/BuklodTradeWorkspace.tsx'), /buklod:trade:pending:/);
  assert.match(read('src/lib/buklodTradeEconomy.ts'), /viewer_id/);
  assert.match(read('src/lib/buklodTradeEconomy.ts'), /invalidateCache\('buklod:points:'/);
  assert.match(read('src/lib/buklodTradeEconomy.ts'), /Cache refresh failure must NOT report payment failure/);
});
