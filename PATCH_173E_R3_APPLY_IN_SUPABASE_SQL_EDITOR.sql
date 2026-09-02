BEGIN;

-- ============================================================================
-- PATCH 173E-R3
-- UNIVERSAL BUKLOD INTERNAL POST SHARING
--
-- Receivers:
--   PUBLIC_WALL
--   LOCAL_WALL        -> current verified Local/Church community
--   GROUP_WALL        -> legacy BUKLOD Group / Cluster wall
--   SCOPE_WALL        -> Organization / Sub-organization / Cluster exact wall
--   SCOPE_CONNECT     -> Local / Church / Cluster / Org / Sub-org Connect
--   DIRECT_CONNECT    -> Personal Connect
--
-- This migration is self-contained. It intentionally does NOT depend on the
-- R1-only assumed helpers buklod_connect_can_use_scope_room() or
-- buklod_connect_is_direct_participant().
-- ============================================================================

CREATE TABLE IF NOT EXISTS
public.community_post_internal_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_post_id uuid NOT NULL
    REFERENCES public.community_posts(id)
    ON DELETE CASCADE,
  shared_by uuid NOT NULL
    REFERENCES auth.users(id)
    ON DELETE CASCADE,
  target_kind text NOT NULL,
  target_scope_id uuid
    REFERENCES public.buklod_scopes(id)
    ON DELETE CASCADE,
  target_thread_id uuid
    REFERENCES public.buklod_connect_direct_threads(id)
    ON DELETE CASCADE,
  target_post_id uuid
    REFERENCES public.community_posts(id)
    ON DELETE SET NULL,
  target_message_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.community_post_internal_shares
DROP CONSTRAINT IF EXISTS
community_post_internal_shares_target_kind_check;

ALTER TABLE public.community_post_internal_shares
ADD CONSTRAINT
community_post_internal_shares_target_kind_check
CHECK (
  target_kind IN (
    'PUBLIC_WALL',
    'LOCAL_WALL',
    'GROUP_WALL',
    'SCOPE_WALL',
    'SCOPE_CONNECT',
    'DIRECT_CONNECT'
  )
);

CREATE INDEX IF NOT EXISTS
community_post_internal_shares_source_idx
ON public.community_post_internal_shares(
  source_post_id,
  created_at DESC
);

ALTER TABLE
public.community_post_internal_shares
ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS
community_post_internal_shares_own_read
ON public.community_post_internal_shares;

CREATE POLICY
community_post_internal_shares_own_read
ON public.community_post_internal_shares
FOR SELECT
TO authenticated
USING (
  shared_by = (SELECT auth.uid())
);

REVOKE ALL
ON public.community_post_internal_shares
FROM anon;

GRANT SELECT
ON public.community_post_internal_shares
TO authenticated;

GRANT ALL
ON public.community_post_internal_shares
TO service_role;


-- --------------------------------------------------------------------------
-- COUNT
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION
public.buklod_internal_share_count_v2(
  p_post_id uuid
)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT count(*)::bigint
  FROM public.community_post_internal_shares s
  WHERE s.source_post_id = p_post_id;
$$;

REVOKE ALL
ON FUNCTION
public.buklod_internal_share_count_v2(uuid)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION
public.buklod_internal_share_count_v2(uuid)
TO authenticated, service_role;


-- --------------------------------------------------------------------------
-- UNIVERSAL TARGET LIST
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION
public.buklod_internal_share_targets_v2()
RETURNS TABLE (
  target_key text,
  target_kind text,
  target_id uuid,
  label text,
  detail text,
  sort_order integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid :=
    (SELECT auth.uid());

  v_church_id uuid;
  v_church_name text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION
      'Authentication required';
  END IF;

  SELECT
    p.church_id,
    c.name
  INTO
    v_church_id,
    v_church_name
  FROM public.profiles p
  LEFT JOIN public.churches c
    ON c.id = p.church_id
  WHERE
    p.id = v_user
    AND p.is_active = true;

  IF NOT found THEN
    RAISE EXCEPTION
      'Active BUKLOD account required';
  END IF;

  -- PUBLIC WALL
  RETURN QUERY
  SELECT
    'public-wall'::text,
    'PUBLIC_WALL'::text,
    NULL::uuid,
    'Public Wall'::text,
    'BUKLOD Public Community'::text,
    10;

  -- LOCAL / CHURCH WALL
  IF v_church_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      'local-wall'::text,
      'LOCAL_WALL'::text,
      v_church_id,
      coalesce(
        v_church_name,
        'My Local Church'
      )::text,
      'Local / Church Community Wall'::text,
      20;
  END IF;

  -- LEGACY GROUP / CLUSTER WALLS
  RETURN QUERY
  SELECT
    (
      'group-wall-' ||
      g.id::text
    )::text,
    'GROUP_WALL'::text,
    g.id,
    (
      g.name ||
      ' Wall'
    )::text,
    'BUKLOD Group / Cluster Wall'::text,
    30
  FROM public.group_members gm
  JOIN public.buklod_groups g
    ON g.id = gm.group_id
  WHERE
    gm.user_id = v_user
    AND gm.is_active = true
  ORDER BY
    g.name;

  -- EXACT ORG / SUB-ORG / CLUSTER WALLS
  RETURN QUERY
  SELECT
    (
      'scope-wall-' ||
      s.id::text
    )::text,
    'SCOPE_WALL'::text,
    s.id,
    (
      s.name ||
      ' Wall'
    )::text,
    CASE
      WHEN
        s.scope_type = 'ORGANIZATION'
        AND s.parent_scope_id IS NOT NULL
      THEN 'Sub-organization Wall'
      WHEN s.scope_type = 'ORGANIZATION'
      THEN 'Organization Wall'
      ELSE 'Cluster Wall'
    END::text,
    40
  FROM public.buklod_scope_memberships m
  JOIN public.buklod_scopes s
    ON s.id = m.scope_id
  WHERE
    m.user_id = v_user
    AND m.membership_status = 'ACTIVE'
    AND s.scope_type IN (
      'ORGANIZATION',
      'CLUSTER'
    )
  ORDER BY
    s.name;

  -- ALL COMMUNITY CONNECT ROOMS AVAILABLE BY EXACT ACTIVE MEMBERSHIP
  RETURN QUERY
  SELECT
    (
      'scope-connect-' ||
      s.id::text
    )::text,
    'SCOPE_CONNECT'::text,
    s.id,
    (
      s.name ||
      ' Connect'
    )::text,
    CASE
      WHEN
        s.scope_type = 'ORGANIZATION'
        AND s.parent_scope_id IS NOT NULL
      THEN 'Sub-organization Connect'
      WHEN s.scope_type = 'ORGANIZATION'
      THEN 'Organization Connect'
      WHEN s.scope_type = 'CLUSTER'
      THEN 'Cluster Connect'
      WHEN s.scope_type = 'CHURCH'
      THEN 'Church Connect'
      ELSE 'Location-based Connect'
    END::text,
    50
  FROM public.buklod_scope_memberships m
  JOIN public.buklod_scopes s
    ON s.id = m.scope_id
  WHERE
    m.user_id = v_user
    AND m.membership_status = 'ACTIVE'
    AND s.scope_type IN (
      'LOCAL',
      'CHURCH',
      'CLUSTER',
      'ORGANIZATION'
    )
  ORDER BY
    s.name;

  -- PERSONAL CONNECT
  RETURN QUERY
  SELECT
    (
      'direct-connect-' ||
      t.id::text
    )::text,
    'DIRECT_CONNECT'::text,
    t.id,
    coalesce(
      p.full_name,
      'BUKLOD Member'
    )::text,
    'Personal Connect'::text,
    60
  FROM public.buklod_connect_direct_threads t
  LEFT JOIN public.profiles p
    ON p.id =
      CASE
        WHEN t.user_one = v_user
        THEN t.user_two
        ELSE t.user_one
      END
  WHERE
    t.user_one = v_user
    OR t.user_two = v_user
  ORDER BY
    coalesce(
      p.full_name,
      'BUKLOD Member'
    );
END;
$$;

REVOKE ALL
ON FUNCTION
public.buklod_internal_share_targets_v2()
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION
public.buklod_internal_share_targets_v2()
TO authenticated, service_role;


-- --------------------------------------------------------------------------
-- UNIVERSAL SHARE ENGINE
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION
public.buklod_internal_share_post_v2(
  p_post_id uuid,
  p_target_kind text,
  p_target_id uuid DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid :=
    (SELECT auth.uid());

  v_kind text :=
    upper(
      btrim(
        coalesce(
          p_target_kind,
          ''
        )
      )
    );

  v_source public.community_posts%rowtype;
  v_actor_church uuid;
  v_source_author text;
  v_body text;
  v_target_post uuid;
  v_target_message uuid;
  v_allowed boolean := false;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION
      'Authentication required';
  END IF;

  SELECT p.church_id
  INTO v_actor_church
  FROM public.profiles p
  WHERE
    p.id = v_user
    AND p.is_active = true;

  IF NOT found THEN
    RAISE EXCEPTION
      'Active BUKLOD account required';
  END IF;

  SELECT *
  INTO v_source
  FROM public.community_posts p
  WHERE
    p.id = p_post_id
    AND coalesce(
      p.is_hidden,
      false
    ) = false;

  IF NOT found THEN
    RAISE EXCEPTION
      'Post not found';
  END IF;

  SELECT
    coalesce(
      p.full_name,
      'BUKLOD Member'
    )
  INTO v_source_author
  FROM public.profiles p
  WHERE p.id =
    v_source.user_id;

  v_source_author :=
    coalesce(
      v_source_author,
      'BUKLOD Member'
    );

  -- Verify READ access to source post.
  IF v_source.audience = 'public' THEN
    v_allowed := true;

  ELSIF v_source.audience = 'local' THEN
    v_allowed :=
      v_actor_church IS NOT NULL
      AND v_source.church_id =
        v_actor_church;

  ELSIF v_source.audience = 'group' THEN
    v_allowed :=
      EXISTS (
        SELECT 1
        FROM public.group_members gm
        WHERE
          gm.group_id =
            v_source.group_id
          AND gm.user_id =
            v_user
          AND gm.is_active =
            true
      );

  ELSIF v_source.audience = 'scope' THEN
    v_allowed :=
      v_source.scope_id IS NOT NULL
      AND (
        public.buklod_is_system_admin()
        OR EXISTS (
          SELECT 1
          FROM public.buklod_scope_memberships sm
          WHERE
            sm.scope_id =
              v_source.scope_id
            AND sm.user_id =
              v_user
            AND sm.membership_status =
              'ACTIVE'
        )
      );
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION
      'You do not have access to share this post';
  END IF;

  v_body :=
    left(
      concat(
        'Shared from ',
        v_source_author,
        E'\n\n',
        coalesce(
          v_source.body,
          ''
        )
      ),
      4000
    );

  IF v_kind = 'PUBLIC_WALL' THEN

    INSERT INTO public.community_posts (
      user_id,
      group_id,
      church_id,
      scope_id,
      audience,
      category,
      body,
      media_path,
      media_mime_type,
      media_size_bytes,
      media_duration_seconds,
      is_hidden
    )
    VALUES (
      v_user,
      NULL,
      v_actor_church,
      NULL,
      'public',
      coalesce(
        v_source.category,
        'encouragement'
      ),
      v_body,
      v_source.media_path,
      v_source.media_mime_type,
      v_source.media_size_bytes,
      v_source.media_duration_seconds,
      false
    )
    RETURNING id
    INTO v_target_post;

  ELSIF v_kind = 'LOCAL_WALL' THEN

    IF v_actor_church IS NULL THEN
      RAISE EXCEPTION
        'A Local Church/location is required';
    END IF;

    INSERT INTO public.community_posts (
      user_id,
      group_id,
      church_id,
      scope_id,
      audience,
      category,
      body,
      media_path,
      media_mime_type,
      media_size_bytes,
      media_duration_seconds,
      is_hidden
    )
    VALUES (
      v_user,
      NULL,
      v_actor_church,
      NULL,
      'local',
      coalesce(
        v_source.category,
        'encouragement'
      ),
      v_body,
      v_source.media_path,
      v_source.media_mime_type,
      v_source.media_size_bytes,
      v_source.media_duration_seconds,
      false
    )
    RETURNING id
    INTO v_target_post;

  ELSIF v_kind = 'GROUP_WALL' THEN

    IF
      p_target_id IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM public.group_members gm
        WHERE
          gm.group_id =
            p_target_id
          AND gm.user_id =
            v_user
          AND gm.is_active =
            true
      )
    THEN
      RAISE EXCEPTION
        'Active membership in the target Group/Cluster is required';
    END IF;

    INSERT INTO public.community_posts (
      user_id,
      group_id,
      church_id,
      scope_id,
      audience,
      category,
      body,
      media_path,
      media_mime_type,
      media_size_bytes,
      media_duration_seconds,
      is_hidden
    )
    VALUES (
      v_user,
      p_target_id,
      NULL,
      NULL,
      'group',
      coalesce(
        v_source.category,
        'encouragement'
      ),
      v_body,
      v_source.media_path,
      v_source.media_mime_type,
      v_source.media_size_bytes,
      v_source.media_duration_seconds,
      false
    )
    RETURNING id
    INTO v_target_post;

  ELSIF v_kind = 'SCOPE_WALL' THEN

    IF
      p_target_id IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM public.buklod_scopes s
        WHERE
          s.id = p_target_id
          AND s.scope_type IN (
            'ORGANIZATION',
            'CLUSTER'
          )
      )
      OR NOT (
        public.buklod_is_system_admin()
        OR EXISTS (
          SELECT 1
          FROM public.buklod_scope_memberships sm
          WHERE
            sm.scope_id =
              p_target_id
            AND sm.user_id =
              v_user
            AND sm.membership_status =
              'ACTIVE'
        )
      )
    THEN
      RAISE EXCEPTION
        'Active membership in the target Organization/Sub-organization/Cluster is required';
    END IF;

    INSERT INTO public.community_posts (
      user_id,
      group_id,
      church_id,
      scope_id,
      audience,
      category,
      body,
      media_path,
      media_mime_type,
      media_size_bytes,
      media_duration_seconds,
      is_hidden
    )
    VALUES (
      v_user,
      NULL,
      NULL,
      p_target_id,
      'scope',
      coalesce(
        v_source.category,
        'encouragement'
      ),
      v_body,
      v_source.media_path,
      v_source.media_mime_type,
      v_source.media_size_bytes,
      v_source.media_duration_seconds,
      false
    )
    RETURNING id
    INTO v_target_post;

  ELSIF v_kind = 'SCOPE_CONNECT' THEN

    IF
      p_target_id IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM public.buklod_scopes s
        WHERE
          s.id = p_target_id
          AND s.scope_type IN (
            'LOCAL',
            'CHURCH',
            'CLUSTER',
            'ORGANIZATION'
          )
      )
      OR NOT (
        public.buklod_is_system_admin()
        OR EXISTS (
          SELECT 1
          FROM public.buklod_scope_memberships sm
          WHERE
            sm.scope_id =
              p_target_id
            AND sm.user_id =
              v_user
            AND sm.membership_status =
              'ACTIVE'
        )
      )
    THEN
      RAISE EXCEPTION
        'Active membership in the target Connect room is required';
    END IF;

    INSERT INTO
    public.buklod_connect_scope_messages (
      scope_id,
      sender_id,
      body
    )
    VALUES (
      p_target_id,
      v_user,
      left(
        concat(
          '[[BUKLOD_SHARED_POST:',
          p_post_id::text,
          ']]',
          E'\n',
          'Shared post from ',
          v_source_author,
          E'\n\n',
          coalesce(
            v_source.body,
            ''
          )
        ),
        4000
      )
    )
    RETURNING id
    INTO v_target_message;

  ELSIF v_kind = 'DIRECT_CONNECT' THEN

    IF
      p_target_id IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM public.buklod_connect_direct_threads t
        WHERE
          t.id = p_target_id
          AND (
            t.user_one = v_user
            OR t.user_two = v_user
          )
      )
    THEN
      RAISE EXCEPTION
        'Personal Connect is not available';
    END IF;

    INSERT INTO
    public.buklod_connect_direct_messages (
      thread_id,
      sender_id,
      body
    )
    VALUES (
      p_target_id,
      v_user,
      left(
        concat(
          '[[BUKLOD_SHARED_POST:',
          p_post_id::text,
          ']]',
          E'\n',
          'Shared post from ',
          v_source_author,
          E'\n\n',
          coalesce(
            v_source.body,
            ''
          )
        ),
        4000
      )
    )
    RETURNING id
    INTO v_target_message;

  ELSE
    RAISE EXCEPTION
      'Unsupported share destination';
  END IF;

  INSERT INTO
  public.community_post_internal_shares (
    source_post_id,
    shared_by,
    target_kind,
    target_scope_id,
    target_thread_id,
    target_post_id,
    target_message_id
  )
  VALUES (
    p_post_id,
    v_user,
    v_kind,
    CASE
      WHEN v_kind =
        'SCOPE_WALL'
        OR v_kind =
        'SCOPE_CONNECT'
      THEN p_target_id
      ELSE NULL
    END,
    CASE
      WHEN v_kind =
        'DIRECT_CONNECT'
      THEN p_target_id
      ELSE NULL
    END,
    v_target_post,
    v_target_message
  );

  RETURN (
    SELECT count(*)::bigint
    FROM public.community_post_internal_shares s
    WHERE
      s.source_post_id =
        p_post_id
  );
END;
$$;

REVOKE ALL
ON FUNCTION
public.buklod_internal_share_post_v2(
  uuid,
  text,
  uuid
)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION
public.buklod_internal_share_post_v2(
  uuid,
  text,
  uuid
)
TO authenticated, service_role;


-- --------------------------------------------------------------------------
-- R1 BACKWARD-COMPATIBILITY ALIASES
-- Fixes already-installed R1 UI calling old names.
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION
public.buklod_internal_share_count_v1(
  p_post_id uuid
)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    public.buklod_internal_share_count_v2(
      p_post_id
    );
$$;

CREATE OR REPLACE FUNCTION
public.buklod_internal_share_post_v1(
  p_post_id uuid,
  p_target_kind text,
  p_target_id uuid DEFAULT NULL
)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    public.buklod_internal_share_post_v2(
      p_post_id,
      p_target_kind,
      p_target_id
    );
$$;

CREATE OR REPLACE FUNCTION
public.buklod_internal_share_direct_targets_v1()
RETURNS TABLE (
  thread_id uuid,
  person_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    t.target_id,
    t.label
  FROM
    public.buklod_internal_share_targets_v2() t
  WHERE
    t.target_kind =
      'DIRECT_CONNECT';
$$;

REVOKE ALL
ON FUNCTION
public.buklod_internal_share_count_v1(uuid)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION
public.buklod_internal_share_post_v1(
  uuid,
  text,
  uuid
)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION
public.buklod_internal_share_direct_targets_v1()
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION
public.buklod_internal_share_count_v1(uuid)
TO authenticated, service_role;

GRANT EXECUTE
ON FUNCTION
public.buklod_internal_share_post_v1(
  uuid,
  text,
  uuid
)
TO authenticated, service_role;

GRANT EXECUTE
ON FUNCTION
public.buklod_internal_share_direct_targets_v1()
TO authenticated, service_role;

COMMIT;
