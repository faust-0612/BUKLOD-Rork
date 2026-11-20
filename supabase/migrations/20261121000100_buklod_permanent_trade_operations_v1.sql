-- Transactional implementation for BUKLOD virtual item trading.
-- Requires 20261121000000 schema. Never unlocks feature flags.
create or replace function public.buklod_trade_build_business_v1(p_business uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_uid uuid:=auth.uid(); v_business public.buklod_trade_businesses%rowtype;
 v_req record; v_stock public.buklod_trade_inventory%rowtype; v_basis bigint; v_cost integer;
begin
 if v_uid is null then raise exception 'Login required'; end if;
 if not exists(select 1 from public.buklod_trade_config where enabled) then raise exception 'Trading is not enabled yet'; end if;
 select * into v_business from public.buklod_trade_businesses
  where id=p_business and owner_id=v_uid and active for update;
 if not found then raise exception 'Business unavailable'; end if;
 if v_business.construction_stage=5 then
   if v_business.level=10 then raise exception 'Maximum business level reached'; end if;
   update public.buklod_trade_businesses set level=level+1,construction_stage=0 where id=p_business;
   return jsonb_build_object('level',v_business.level+1,'stage',0,'new_level',true);
 end if;
 select coalesce(sum(bp_cost),0)::integer into v_cost
 from public.buklod_trade_build_requirements
 where level=v_business.level and stage=v_business.construction_stage+1;
 if not exists(select 1 from public.buklod_trade_build_requirements
  where level=v_business.level and stage=v_business.construction_stage+1) then
  raise exception 'Construction recipe unavailable'; end if;
 for v_req in select item_code,quantity from public.buklod_trade_build_requirements
  where level=v_business.level and stage=v_business.construction_stage+1 order by item_code loop
   select * into v_stock from public.buklod_trade_inventory
    where user_id=v_uid and item_code=v_req.item_code for update;
   if not found or v_stock.quantity<v_req.quantity then
    raise exception 'Missing construction material: %',v_req.item_code; end if;
   v_basis:=floor(v_stock.cost_basis_bp::numeric*v_req.quantity/v_stock.quantity)::bigint;
   update public.buklod_trade_inventory
   set quantity=quantity-v_req.quantity,cost_basis_bp=cost_basis_bp-v_basis
   where user_id=v_uid and item_code=v_req.item_code;
 end loop;
 if v_cost>0 then
  perform 1 from public.buklod_user_points_balances where user_id=v_uid for update;
  if public.buklod_available_points_for(v_uid)<v_cost then raise exception 'Insufficient BP for construction'; end if;
  -- Existing debit trigger applies the debit once; do not subtract manually.
  insert into public.buklod_points_ledger(user_id,direction,points,activity_type,source_key,source_id,description)
   values(v_uid,'debit',v_cost,'trade_construction','trade:build:'||p_business::text||':'||v_business.level::text||':'||(v_business.construction_stage+1)::text,p_business,'Business construction materials');
 end if;
 update public.buklod_trade_businesses set construction_stage=construction_stage+1 where id=p_business;
 insert into public.buklod_trade_build_history(business_id,owner_id,level,stage,bp_spent)
 values(p_business,v_uid,v_business.level,v_business.construction_stage+1,v_cost);
 return jsonb_build_object('level',v_business.level,'stage',v_business.construction_stage+1,'bp_spent',v_cost);
end $$;
revoke all on function public.buklod_trade_build_business_v1(uuid) from public,anon;
grant execute on function public.buklod_trade_build_business_v1(uuid) to authenticated;

-- Listing uses escrow, so no other listing or building can double-spend the same item.
create or replace function public.buklod_trade_list_item_v1(p_business uuid,p_code text,p_qty integer,p_unit_price integer)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_uid uuid:=auth.uid(); v_inv public.buklod_trade_inventory%rowtype;
 v_max integer; v_basis bigint; v_id uuid;
begin
 if v_uid is null then raise exception 'Login required'; end if;
 if not exists(select 1 from public.buklod_trade_config where enabled) then raise exception 'Trading is not enabled yet'; end if;
 if p_qty not between 1 and 100 then raise exception 'Invalid quantity'; end if;
 select max_unit_price into v_max from public.buklod_trade_items where code=p_code and active;
 if v_max is null or p_unit_price not between 1 and v_max then raise exception 'Invalid item or price'; end if;
 perform 1 from public.buklod_trade_businesses
  where id=p_business and owner_id=v_uid and active and construction_stage=5;
 if not found then raise exception 'Complete your current business building first'; end if;
 select * into v_inv from public.buklod_trade_inventory
 where user_id=v_uid and item_code=p_code for update;
 if not found or v_inv.quantity<p_qty then raise exception 'Insufficient verified inventory'; end if;
 v_basis:=floor(v_inv.cost_basis_bp::numeric*p_qty/v_inv.quantity)::bigint;
 update public.buklod_trade_inventory set
 quantity=quantity-p_qty,cost_basis_bp=cost_basis_bp-v_basis
 where user_id=v_uid and item_code=p_code;
 insert into public.buklod_trade_listings
 (business_id,seller_id,item_code,quantity_remaining,cost_basis_remaining,unit_price_bp)
 values(p_business,v_uid,p_code,p_qty,v_basis,p_unit_price) returning id into v_id;
 return jsonb_build_object('listing_id',v_id,'quantity',p_qty);
end $$;
revoke all on function public.buklod_trade_list_item_v1(uuid,text,integer,integer) from public,anon;
grant execute on function public.buklod_trade_list_item_v1(uuid,text,integer,integer) to authenticated;

create or replace function public.buklod_trade_cancel_listing_v1(p_listing uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_uid uuid:=auth.uid(); v_l public.buklod_trade_listings%rowtype;
begin
 if v_uid is null then raise exception 'Login required'; end if;
 if not exists(select 1 from public.buklod_trade_config where enabled) then raise exception 'Trading is not enabled yet'; end if;
 select * into v_l from public.buklod_trade_listings where id=p_listing and seller_id=v_uid for update;
 if not found or v_l.status<>'ACTIVE' then raise exception 'Listing unavailable'; end if;
 update public.buklod_trade_listings set status='CANCELLED',quantity_remaining=0,cost_basis_remaining=0 where id=p_listing;
 insert into public.buklod_trade_inventory(user_id,item_code,quantity,cost_basis_bp)
 values(v_uid,v_l.item_code,v_l.quantity_remaining,v_l.cost_basis_remaining)
 on conflict(user_id,item_code) do update
 set quantity=public.buklod_trade_inventory.quantity+excluded.quantity,
     cost_basis_bp=public.buklod_trade_inventory.cost_basis_bp+excluded.cost_basis_bp;
 return jsonb_build_object('cancelled',true,'restored',v_l.quantity_remaining);
end $$;
revoke all on function public.buklod_trade_cancel_listing_v1(uuid) from public,anon;
grant execute on function public.buklod_trade_cancel_listing_v1(uuid) to authenticated;

-- Buyer BP -> seller BP; seller escrow item -> buyer inventory.
-- Both halves and their audit rows succeed or roll back in one transaction.
create or replace function public.buklod_trade_buy_item_v1(p_listing uuid,p_qty integer,p_request_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_uid uuid:=auth.uid(); v_l public.buklod_trade_listings%rowtype;
 v_prior uuid; v_id uuid; v_price integer; v_basis integer;
 v_buyer_ledger uuid; v_transfer uuid;
begin
 if v_uid is null then raise exception 'Login required'; end if;
 if not exists(select 1 from public.buklod_trade_config where enabled) then raise exception 'Trading is not enabled yet'; end if;
 if p_qty not between 1 and 100 or char_length(coalesce(p_request_key,'')) not between 8 and 100
 then raise exception 'Invalid order request'; end if;
 select id into v_prior from public.buklod_trade_orders
  where buyer_id=v_uid and buyer_request_key=p_request_key;
 if found then return jsonb_build_object('order_id',v_prior,'already_processed',true); end if;
 select * into v_l from public.buklod_trade_listings where id=p_listing for update;
 if not found or v_l.status<>'ACTIVE' or v_l.quantity_remaining<p_qty
 then raise exception 'Item out of stock'; end if;
 if v_l.seller_id=v_uid then raise exception 'Self purchases are forbidden'; end if;
 perform 1 from public.buklod_trade_businesses where id=v_l.business_id and active and construction_stage=5;
 if not found then raise exception 'Seller is not active'; end if;
 perform 1 from public.profiles where id=v_uid and is_active=true;
 if not found or private.buklod_is_platform_official_v1(v_uid) then raise exception 'Active member required'; end if;
 perform 1 from public.profiles where id=v_l.seller_id and is_active=true;
 if not found then raise exception 'Seller unavailable'; end if;
 -- Stable balance-row lock order prevents deadlocks between opposite trades.
 insert into public.buklod_user_points_balances(user_id,lifetime_points,available_points)
 values(v_uid,0,0),(v_l.seller_id,0,0) on conflict(user_id) do nothing;
 perform 1 from public.buklod_user_points_balances
 where user_id in (v_uid,v_l.seller_id) order by user_id for update;
 v_price:=v_l.unit_price_bp*p_qty;
 if public.buklod_available_points_for(v_uid)<v_price then raise exception 'Insufficient BP'; end if;
 v_basis:=floor(v_l.cost_basis_remaining::numeric*p_qty/v_l.quantity_remaining)::integer;
 insert into public.buklod_trade_orders
 (listing_id,buyer_id,seller_id,item_code,quantity,total_bp,cost_basis_bp,gross_profit_bp,buyer_request_key)
 values(p_listing,v_uid,v_l.seller_id,v_l.item_code,p_qty,v_price,v_basis,greatest(0,v_price-v_basis),p_request_key)
 returning id into v_id;
 insert into public.buklod_points_ledger(user_id,direction,points,activity_type,source_key,source_id,description)
 values(v_uid,'debit',v_price,'market_purchase','trade:buyer:'||v_id::text,v_id,'BUKLOD BP item purchase')
 returning id into v_buyer_ledger;
 -- Separate audit transfer receipt: do not write a seller reward-credit ledger row.
 insert into public.buklod_trade_bp_transfers(order_id,buyer_id,seller_id,amount_bp)
 values(v_id,v_uid,v_l.seller_id,v_price) returning id into v_transfer;
 update public.buklod_user_points_balances
 set available_points=available_points+v_price,updated_at=now() where user_id=v_l.seller_id;
 update public.buklod_trade_listings
 set quantity_remaining=quantity_remaining-p_qty,cost_basis_remaining=cost_basis_remaining-v_basis,
 status=case when quantity_remaining=p_qty then 'SOLD_OUT' else status end
 where id=p_listing;
 insert into public.buklod_trade_inventory(user_id,item_code,quantity,cost_basis_bp)
 values(v_uid,v_l.item_code,p_qty,v_price)
 on conflict(user_id,item_code) do update set
  quantity=public.buklod_trade_inventory.quantity+excluded.quantity,
  cost_basis_bp=public.buklod_trade_inventory.cost_basis_bp+excluded.cost_basis_bp;
 update public.buklod_trade_orders
 set buyer_ledger_id=v_buyer_ledger where id=v_id;
 return jsonb_build_object('order_id',v_id,'already_processed',false,
 'total_bp',v_price,'item_code',v_l.item_code,'quantity',p_qty);
end $$;
revoke all on function public.buklod_trade_buy_item_v1(uuid,integer,text) from public,anon;
grant execute on function public.buklod_trade_buy_item_v1(uuid,integer,text) to authenticated;

-- Rank increases only on independently qualified PROFIT after a waiting period.
-- Credits here are RANK-ONLY: lifetime_points changes, available_points does not.
create or replace function public.buklod_trade_settle_rank_v1(p_order uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_uid uuid:=auth.uid(); v_o public.buklod_trade_orders%rowtype;
 v_cfg boolean; v_week bigint; v_prior bigint; v_credit integer; v_ledger uuid;
begin
 if v_uid is null then raise exception 'Login required'; end if;
 select rank_profit_enabled into v_cfg from public.buklod_trade_config where enabled;
 if not coalesce(v_cfg,false) then raise exception 'Rank settlement is not active'; end if;
 select * into v_o from public.buklod_trade_orders
 where id=p_order and seller_id=v_uid for update;
 if not found then raise exception 'Order unavailable'; end if;
 if v_o.rank_state<>'PENDING' then
  return jsonb_build_object('rank_state',v_o.rank_state,'rank_credit_bp',v_o.rank_credit_bp); end if;
 if v_o.created_at>now()-interval '72 hours' then
  raise exception 'Review period not complete'; end if;
 -- Serialize profit settlements per seller so concurrent calls cannot bypass caps.
 perform 1 from public.buklod_user_points_balances where user_id=v_uid for update;
 -- Reject new accounts and repeating the same counterparty within 30 days.
 if not exists(select 1 from public.profiles
  where id=v_o.buyer_id and is_active and created_at<now()-interval '7 days') then
  update public.buklod_trade_orders set rank_state='REVIEW',settled_at=now() where id=p_order;
  return jsonb_build_object('rank_state','REVIEW','rank_credit_bp',0); end if;
 select count(*) into v_prior from public.buklod_trade_orders o
 where o.seller_id=v_uid and o.buyer_id=v_o.buyer_id and o.id<>v_o.id
   and o.rank_state in ('QUALIFIED','REVIEW') and o.created_at>v_o.created_at-interval '30 days'
   and o.created_at<=v_o.created_at;
 select coalesce(sum(rank_credit_bp),0) into v_week from public.buklod_trade_orders
 where seller_id=v_uid and rank_state='QUALIFIED' and settled_at>now()-interval '7 days';
 if v_prior>0 or v_o.gross_profit_bp>200 or v_week+v_o.gross_profit_bp>500 then
  update public.buklod_trade_orders set rank_state='REVIEW',settled_at=now() where id=p_order;
  return jsonb_build_object('rank_state','REVIEW','rank_credit_bp',0); end if;
 v_credit:=v_o.gross_profit_bp;
 if v_credit<=0 then
  update public.buklod_trade_orders set rank_state='EXCLUDED',settled_at=now() where id=p_order;
  return jsonb_build_object('rank_state','EXCLUDED','rank_credit_bp',0); end if;
 insert into public.buklod_points_ledger
 (user_id,direction,points,claim_state,activity_type,source_key,source_id,description)
 values(v_uid,'credit',v_credit,'claimed','market_verified_profit','trade:profit:'||p_order::text,p_order,'Verified net business profit: Rank only')
 returning id into v_ledger;
 update public.buklod_user_points_balances
 set lifetime_points=lifetime_points+v_credit,updated_at=now() where user_id=v_uid;
 update public.buklod_trade_orders set
 rank_state='QUALIFIED',rank_credit_bp=v_credit,rank_ledger_id=v_ledger,settled_at=now()
 where id=p_order;
 return jsonb_build_object('rank_state','QUALIFIED','rank_credit_bp',v_credit);
end $$;
revoke all on function public.buklod_trade_settle_rank_v1(uuid) from public,anon;
grant execute on function public.buklod_trade_settle_rank_v1(uuid) to authenticated;
