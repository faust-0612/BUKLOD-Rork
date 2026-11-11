-- Close pre-existing requests on already machine-resolved events.
-- Does not requalify, rescore, or touch Finance/earning ledgers.
update private.buklod_community_qmp_review_requests r
set status=case when e.state in ('QUALIFIED','FINALIZED') then 'APPROVED' else 'REJECTED' end,
    reviewer_note='Auto-closed from immutable QMP event state; manual review retired',
    reviewed_at=coalesce(r.reviewed_at,now())
from private.buklod_community_qmp_events e
where e.id=r.event_id
  and r.status in ('REQUESTED','UNDER_REVIEW')
  and e.state in ('QUALIFIED','FINALIZED','DISQUALIFIED');
