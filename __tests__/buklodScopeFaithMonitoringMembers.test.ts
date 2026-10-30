jest.mock('@/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));

import { supabase } from '@/lib/supabase';
import {
  fetchFaithMonitoringMembers,
  matchesFaithMonitoringMember,
  memberMonitoringStatus,
  type FaithMonitoringMember,
} from '@/lib/buklodScopeFaithMonitoringMembers';

const member: FaithMonitoringMember = {
  user_id: 'test-member',
  member_name: 'Test Disciple',
  reading: {
    submitted: true, approved: false, checking: false, revision: true,
    weekly: true, latest_at: '2026-10-28T01:00:00Z', latest_reference: '2 Samuel 7',
  },
  devotion: {
    submitted: false, approved: false, checking: false, revision: false,
    weekly: true, latest_at: null, latest_reference: null,
  },
  lesson: {
    has_activity: true,
    stages: [
      { stage_code: 101, stage_title: 'Paghahanda', status: 'IN_PROGRESS', approved_lessons: 2, expected_lessons: 5, verified_requirements: 0, required_requirements: 1 },
      { stage_code: 102, stage_title: 'Pagtatanim', status: 'NOT_STARTED', approved_lessons: 0, expected_lessons: 4, verified_requirements: 0, required_requirements: 0 },
    ],
  },
};

describe('Faith Monitoring member drill-down', () => {
  it('distinguishes submissions, revisions, and weekly activity', () => {
    expect(matchesFaithMonitoringMember(member, 'daily', 'submitted')).toBe(true);
    expect(matchesFaithMonitoringMember(member, 'daily', 'revision')).toBe(true);
    expect(matchesFaithMonitoringMember(member, 'daily', 'approved')).toBe(false);
    expect(matchesFaithMonitoringMember(member, 'daily', 'missing')).toBe(false);
    expect(matchesFaithMonitoringMember(member, 'devotion', 'missing')).toBe(true);
    expect(matchesFaithMonitoringMember(member, 'devotion', 'weekly')).toBe(true);
    expect(memberMonitoringStatus(member, 'daily')).toBe('Needs revision');
  });

  it('filters by exact BUKLOD stage, not merely general lesson activity', () => {
    expect(matchesFaithMonitoringMember(member, 'lesson', 'active')).toBe(true);
    expect(matchesFaithMonitoringMember(member, 'lesson', 'in_progress', 101)).toBe(true);
    expect(matchesFaithMonitoringMember(member, 'lesson', 'in_progress', 102)).toBe(false);
    expect(matchesFaithMonitoringMember(member, 'lesson', 'missing', 102)).toBe(true);
    expect(memberMonitoringStatus(member, 'lesson', 101)).toBe('In progress');
  });

  it('parses the protected RPC response without exposing reflection text', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({
      error: null,
      data: {
        scope_id: 'scope-1', scope_name: 'Mission Worker', report_date: '2026-10-28',
        members: [{ user_id: 'member-1', member_name: 'Member One',
          reading: { submitted: true, approved: true }, lesson: { has_activity: false, stages: [] },
        }],
      },
    });
    const result = await fetchFaithMonitoringMembers('scope-1');
    expect(supabase.rpc).toHaveBeenCalledWith('buklod_scope_faith_monitoring_members_v1', { p_scope_id: 'scope-1' });
    expect(result.members).toHaveLength(1);
    expect(result.members[0].reading.approved).toBe(true);
    expect(result.members[0].devotion.submitted).toBe(false);
  });
});
