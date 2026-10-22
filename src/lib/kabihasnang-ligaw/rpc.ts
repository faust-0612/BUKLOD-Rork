export const KL_RPC = {
  listLibrary: 'kl_list_library_v1',
  readEpisode: 'kl_read_episode_v1',
  completeEpisode: 'kl_complete_episode_v1',
  completeSeason: 'kl_complete_season_v1',
  saveJourney: 'kl_save_story_journey_v1',
  adminList: 'kl_admin_list_v1',
  adminPreview: 'kl_admin_preview_v1',
  adminAction: 'kl_admin_action_v1',
  reportIssue: 'kl_report_reader_issue_v1',
  // Planned RPC names; do not call before verified backend migration/RLS.
  listComments: 'kl_list_comments_v1',
  postComment: 'kl_post_comment_v1',
  reactToComment: 'kl_react_to_comment_v1',
  removeComment: 'kl_remove_comment_v1',
} as const;

export type AdminAction =
  | 'approve'
  | 'revise'
  | 'schedule'
  | 'pause'
  | 'resume'
  | 'pause_season'
  | 'resume_season'
  | 'emergency_stop'
  | 'emergency_clear';

export function adminActionArgs(input: {
  action: AdminAction;
  episodeId?: string | null;
  notes?: string;
  manilaDate?: string | null;
  expectedUpdatedAt?: string | null;
}) {
  return {
    p_action: input.action,
    p_episode_id: input.episodeId ?? null,
    p_notes: (input.notes ?? '').slice(0, 2000),
    p_manila_date: input.manilaDate ?? null,
    p_expected_updated_at: input.expectedUpdatedAt ?? null,
  };
}
