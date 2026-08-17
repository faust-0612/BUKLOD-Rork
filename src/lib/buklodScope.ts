import { supabase } from '@/lib/supabase';

export type BuklodScopeType =
  | 'PUBLIC'
  | 'LOCAL'
  | 'CLUSTER'
  | 'CHURCH'
  | 'ORGANIZATION'
  | 'SYSTEM';

export type BuklodScope = {
  scope_id: string;
  scope_type: BuklodScopeType;
  name: string;
  parent_scope_id?: string | null;
  scope_status?: string | null;
  visibility?: string | null;
  geo_level?: string | null;
  membership_status?: string | null;
  role_keys: string[];
  is_admin: boolean;
  member_count?: number | null;
  show_faith_content?: boolean | null;
  feature_keys: string[];
  is_active_scope?: boolean;
};

export type ScopeFeedMode =
  | 'for_you'
  | 'latest';

export type ScopePost = {
  id: string;
  scope_id?: string;
  user_id: string;
  category?: string | null;
  body: string;
  created_at: string;
  author_name?: string | null;
  avatar_url?: string | null;

  /*
   * Optional ranking signals.
   * Older scope-feed RPCs may omit these.
   * The algorithm remains backward-compatible.
   */
  feed_score?: number | null;
  feed_priority?: number | null;
  affinity_score?: number | null;
  content_preference_score?: number | null;
  engagement_score?: number | null;
  reaction_count?: number | null;
  comment_count?: number | null;
};

export type ScopePerson = {
  user_id: string;
  full_name: string;
  avatar_url?: string | null;
};


function clampScore(
  value: unknown,
  min: number,
  max: number
) {
  const numeric =
    Number(value ?? 0);

  if (!Number.isFinite(numeric)) {
    return min;
  }

  return Math.min(
    max,
    Math.max(min, numeric)
  );
}

/*
 * BUKLOD FOR YOU v1
 *
 * The ACTIVE SCOPE already limits the content pool.
 * Ranking happens only inside that permitted scope.
 *
 * Weight model:
 * Recency                40
 * Scope relevance        20
 * Interaction affinity   15
 * Content preference     10
 * Engagement             10
 * Priority                5
 *                        ---
 *                        100
 *
 * Older RPCs can omit affinity/engagement/preference fields.
 * In that case those signals safely contribute zero instead
 * of widening the content pool or inventing cross-scope data.
 */
export function rankBuklodScopePosts(
  posts: ScopePost[],
  mode: ScopeFeedMode
): ScopePost[] {
  const copy =
    [...posts];

  if (mode === 'latest') {
    return copy.sort(
      (a, b) =>
        new Date(
          b.created_at
        ).getTime() -
        new Date(
          a.created_at
        ).getTime()
    );
  }

  const now = Date.now();

  const score =
    (post: ScopePost) => {
      const serverScore =
        Number(
          post.feed_score
        );

      if (
        Number.isFinite(
          serverScore
        ) &&
        serverScore > 0
      ) {
        return serverScore;
      }

      const createdAt =
        new Date(
          post.created_at
        ).getTime();

      const ageHours =
        Number.isFinite(
          createdAt
        )
          ? Math.max(
              0,
              (now - createdAt) /
                3_600_000
            )
          : 168;

      const recency =
        40 *
        Math.max(
          0,
          1 -
            ageHours /
              168
        );

      /*
       * All candidates came from
       * getBuklodScopeFeed(activeScope),
       * therefore they already match
       * the active scope.
       */
      const scopeRelevance =
        20;

      const affinity =
        clampScore(
          post.affinity_score,
          0,
          15
        );

      const contentPreference =
        clampScore(
          post.content_preference_score,
          0,
          10
        );

      const directEngagement =
        Number(
          post.engagement_score
        );

      const engagement =
        Number.isFinite(
          directEngagement
        )
          ? clampScore(
              directEngagement,
              0,
              10
            )
          : Math.min(
              10,
              Math.log2(
                1 +
                  Math.max(
                    0,
                    Number(
                      post.reaction_count ??
                        0
                    )
                  ) +
                  Math.max(
                    0,
                    Number(
                      post.comment_count ??
                        0
                    )
                  ) *
                    2
              ) *
                2
            );

      const priority =
        clampScore(
          post.feed_priority,
          0,
          5
        );

      return (
        recency +
        scopeRelevance +
        affinity +
        contentPreference +
        engagement +
        priority
      );
    };

  return copy.sort(
    (a, b) => {
      const delta =
        score(b) -
        score(a);

      if (
        Math.abs(delta) >
        0.0001
      ) {
        return delta;
      }

      return (
        new Date(
          b.created_at
        ).getTime() -
        new Date(
          a.created_at
        ).getTime()
      );
    }
  );
}


function errorMessage(error: any) {
  return String(error?.message ?? error ?? '');
}

function canTryAlternateRpcArgs(error: any) {
  const message = errorMessage(error).toLowerCase();

  return (
    message.includes('schema cache') ||
    message.includes('could not find the function') ||
    (message.includes('function') &&
      message.includes('does not exist')) ||
    message.includes('pgrst202') ||
    message.includes('pgrst203')
  );
}

async function rpcWithArgFallback(
  name: string,
  candidates: Array<Record<string, unknown>>
) {
  let lastError: any = null;

  for (const args of candidates) {
    const result =
      await (supabase as any).rpc(
        name,
        args
      );

    if (!result.error) {
      return result;
    }

    lastError = result.error;

    if (!canTryAlternateRpcArgs(result.error)) {
      return result;
    }
  }

  return {
    data: null,
    error: lastError,
  };
}

export async function getMyBuklodScopes():
  Promise<BuklodScope[]> {
  const { data, error } =
    await (supabase as any).rpc(
      'buklod_my_scopes'
    );

  if (error) {
    throw error;
  }

  const rows =
    Array.isArray(data)
      ? data
      : [];

  return rows.map(
    (row: any): BuklodScope => ({
      scope_id:
        String(row.scope_id),
      scope_type:
        row.scope_type as BuklodScopeType,
      name:
        String(row.name ?? 'BUKLOD'),
      scope_status:
        row.scope_status ?? null,
      visibility:
        row.visibility ?? null,
      geo_level:
        row.geo_level ?? null,
      membership_status:
        row.membership_status ?? null,
      role_keys:
        Array.isArray(row.role_keys)
          ? row.role_keys
          : [],
      is_admin:
        Boolean(row.is_admin),
      member_count:
        row.member_count === null ||
        row.member_count === undefined
          ? null
          : Number(row.member_count),
      show_faith_content:
        row.show_faith_content === null ||
        row.show_faith_content === undefined
          ? null
          : Boolean(
              row.show_faith_content
            ),
      feature_keys:
        Array.isArray(row.feature_keys)
          ? row.feature_keys
          : [],
      is_active_scope:
        Boolean(
          row.is_active_scope
        ),
    })
  );
}

export async function setBuklodActiveScope(
  scopeId: string
): Promise<void> {
  const result =
    await rpcWithArgFallback(
      'buklod_set_active_scope',
      [
        { _scope_id: scopeId },
        { p_scope_id: scopeId },
        { scope_id: scopeId },
      ]
    );

  if (result.error) {
    throw result.error;
  }
}

export async function getBuklodScopeFeed(
  scopeId: string,
  limit = 50
): Promise<ScopePost[]> {
  const result =
    await rpcWithArgFallback(
      'buklod_scope_feed',
      [
        {
          _scope_id: scopeId,
          _limit: limit,
        },
        {
          p_scope_id: scopeId,
          p_limit: limit,
        },
        {
          scope_id: scopeId,
          limit,
        },
      ]
    );

  if (result.error) {
    throw result.error;
  }

  return Array.isArray(result.data)
    ? result.data
    : [];
}

export async function createBuklodScopePost(
  scopeId: string,
  body: string,
  category = 'general'
): Promise<void> {
  const result =
    await rpcWithArgFallback(
      'buklod_create_scope_post',
      [
        {
          _scope_id: scopeId,
          _body: body,
          _category: category,
        },
        {
          p_scope_id: scopeId,
          p_body: body,
          p_category: category,
        },
        {
          scope_id: scopeId,
          body,
          category,
        },
      ]
    );

  if (result.error) {
    throw result.error;
  }
}

export async function getBuklodScopePeople(
  scopeId: string,
  query = '',
  limit = 50
): Promise<ScopePerson[]> {
  const result =
    await rpcWithArgFallback(
      'buklod_scope_people',
      [
        {
          _scope_id: scopeId,
          _query: query,
          _limit: limit,
        },
        {
          p_scope_id: scopeId,
          p_query: query,
          p_limit: limit,
        },
        {
          scope_id: scopeId,
          query,
          limit,
        },
      ]
    );

  if (result.error) {
    throw result.error;
  }

  return Array.isArray(result.data)
    ? result.data
    : [];
}
