
create index if not exists idx_buklod_pf_cash_referral
  on private.buklod_pf_cash_ledger(referral_id)
  where referral_id is not null;

create index if not exists idx_buklod_pf_cash_source_value
  on private.buklod_pf_cash_ledger(source_value_id)
  where source_value_id is not null;

create index if not exists idx_buklod_pf_community_designation_previous
  on private.buklod_pf_community_designations(previous_designation_id)
  where previous_designation_id is not null;

create index if not exists idx_buklod_pf_community_fund_settlement
  on private.buklod_pf_community_fund_ledger(settlement_id)
  where settlement_id is not null;

create index if not exists idx_buklod_pf_fund_request_originating_suborg
  on private.buklod_pf_community_fund_requests(originating_suborganization_id)
  where originating_suborganization_id is not null;

create index if not exists idx_buklod_pf_fund_votes_person
  on private.buklod_pf_community_fund_votes(person_id);

create index if not exists idx_buklod_pf_community_settlement_scope
  on private.buklod_pf_community_settlements(scope_id);

create index if not exists idx_buklod_pf_qualification_referral
  on private.buklod_pf_qualification_fund_ledger(referral_id)
  where referral_id is not null;

create index if not exists idx_buklod_pf_qualification_source_value
  on private.buklod_pf_qualification_fund_ledger(source_value_id)
  where source_value_id is not null;

create index if not exists idx_buklod_pf_referral_events_actor
  on private.buklod_pf_referral_events(actor_person_id);

create index if not exists idx_buklod_pf_referral_events_referral
  on private.buklod_pf_referral_events(referral_id)
  where referral_id is not null;

create index if not exists idx_buklod_pf_referral_settlements_referral
  on private.buklod_pf_referral_settlements(referral_id);

create index if not exists idx_buklod_pf_referral_settlements_referred
  on private.buklod_pf_referral_settlements(referred_person_id);

create index if not exists idx_buklod_pf_referral_settlements_referrer
  on private.buklod_pf_referral_settlements(referrer_person_id);

create index if not exists idx_buklod_pf_user_settlements_person
  on private.buklod_pf_user_settlements(person_id);
