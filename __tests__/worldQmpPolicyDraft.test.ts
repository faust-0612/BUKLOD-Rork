import { previewWorldQmp, previewWorldQmpTradeQuote, WORLD_QMP_ACTIVATION_ENABLED, WORLD_QMP_POLICY_DRAFT, type WorldQmpEvent } from '@/features/world/worldQmpPolicyDraft';

function event(overrides: Partial<WorldQmpEvent> = {}): WorldQmpEvent {
  return {
    eventId:'event-1',
    action:'complete_house_upgrade',
    actorId:'user-a',
    period:'2026-12',
    entityId:'house-a-upgrade-1',
    source:'world',
    currencyProvenance:'earned_bp',
    verifiedByServer:true,
    participationOutcome:'fulfilled',
    ...overrides,
  };
}
describe('BUKLOD world purpose-driven QMP: DEV preview only', () => {
  it('has no live financial activation', () => {
    expect(WORLD_QMP_ACTIVATION_ENABLED).toBe(false);
    expect(WORLD_QMP_POLICY_DRAFT.version).toMatch(/^proposal_/);
  });
  it('requires independently verified completed activity', () => {
    expect(previewWorldQmp(event({verifiedByServer:false}),[]).qualifies).toBe(false);
    expect(previewWorldQmp(event({participationOutcome:'pending'}),[]).qualifies).toBe(false);
    expect(previewWorldQmp(event({participationOutcome:'rejected'}),[]).qualifies).toBe(false);
    expect(previewWorldQmp(event(),[]).qualifies).toBe(true);
  });
  it('requires actual meaningful actions rather than logins', () => {
    expect(previewWorldQmp(event({action:'login' as any}),[]).qualifies).toBe(false);
    expect(previewWorldQmp(event({action:'watch_ad' as any}),[]).qualifies).toBe(false);
  });
  it('refuses real-money actions and purchased-BP purchase qualification', () => {
    expect(previewWorldQmp(event({source:'external_paid',action:'purchase_item'}),[]).qualifies).toBe(false);
    expect(previewWorldQmp(event({currencyProvenance:'purchased_bp',action:'acquire_land'}),[]).qualifies).toBe(false);
    expect(previewWorldQmp(event({currencyProvenance:'purchased_bp',action:'complete_eligible_trade'}),[]).qualifies).toBe(false);
    expect(previewWorldQmp(event({currencyProvenance:'purchased_bp',action:'complete_house_upgrade'}),[]).qualifies).toBe(false);
    expect(previewWorldQmp(event({currencyProvenance:'purchased_bp',action:'finish_community_project'}),[]).qualifies).toBe(false);
  });
  it('prevents repeat credit on same event or entity', () => {
    const row={eventId:'event-1',actorId:'user-a',period:'2026-12',entityId:'house-a-upgrade-1',action:'complete_house_upgrade' as const,qualifiedWeight:4};
    expect(previewWorldQmp(event(),[row]).qualifies).toBe(false);
    expect(previewWorldQmp(event({eventId:'event-2'}),[row]).qualifies).toBe(false);
    expect(previewWorldQmp(event({action:'fulfill_service'}),[row]).qualifies).toBe(false);
  });
  it('limits monthly categories without punishing ordinary useful contributions', () => {
    const cap=WORLD_QMP_POLICY_DRAFT.monthlyCategoryCap.complete_house_upgrade;
    const row={eventId:'other',actorId:'user-a',period:'2026-12',entityId:'house-2',action:'complete_house_upgrade' as const,qualifiedWeight:cap};
    expect(previewWorldQmp(event(),[row]).qualifies).toBe(false);
  });
  it('rejects self-dealing and risk flags', () => {
    expect(previewWorldQmp(event({isSelfTrade:true}),[]).qualifies).toBe(false);
    expect(previewWorldQmp(event({isFlagged:true}),[]).qualifies).toBe(false);
    expect(previewWorldQmp(event({counterpartyId:'user-a'}),[]).qualifies).toBe(false);
  });
  it('keeps the outgoing BP transfer deduction separate from qualifying activity credit', () => {
    expect(previewWorldQmpTradeQuote(100,null,3).netQmpChange).toBeNull();
    expect(previewWorldQmpTradeQuote(100,5,2).netQmpChange).toBe(-3);
    expect(previewWorldQmpTradeQuote(100,0,2).netQmpChange).toBe(2);
    expect(previewWorldQmpTradeQuote(0,5,2).netQmpChange).toBeNull();
  });
});
