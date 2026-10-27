import { withSupabase } from 'npm:@supabase/server@^1'

interface NotificationRecord {
  id: string
  user_id: string
  title: string
  body: string
  kind: string
  data: Record<string, unknown> | null
  push_sent_at?: string | null
  push_last_error?: string | null
}

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  schema: string
  record: NotificationRecord | null
  old_record: NotificationRecord | null
}

type DeviceTokenRow = {
  expo_push_token: string | null
  platform: string | null
  emergency_alert_mode_version: number | null
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

/*
 * PATCH_171C_PUSH_CHANNEL_V2
 * PATCH_171B_TRUE_CLOSED_APP_PUSH
 * BUKLOD_EMERGENCY_ALERT_MODE_R2
 * BUKLOD_EMERGENCY_ALERT_MODE_R2_CAPABILITY_FALLBACK
 *
 * Security / rollout rules:
 * - Webhook payload identifies only the notification row; canonical content is
 *   reloaded with supabaseAdmin and never trusted from request JSON.
 * - push_sent_at keeps normal webhook replays idempotent.
 * - Only canonical community_emergency rows receive emergency treatment.
 * - Android devices are routed to buklod-emergency-v1 ONLY after that exact
 *   Expo token has registered emergency_alert_mode_version >= 2. Older or
 *   unopened clients keep buklod-activity-v2 so an OTA rollout cannot hide SOS.
 * - iOS Emergency SOS uses Time Sensitive delivery. Emergency actions are
 *   attached only after the token has registered the R2 category capability.
 */
export default {
  fetch: withSupabase(
    { auth: 'publishable' },
    async (req, ctx) => {
      let payload: WebhookPayload
      try {
        payload = await req.json()
      } catch {
        return Response.json({ ok: false, error: 'Invalid JSON payload' }, { status: 400 })
      }

      if (
        payload.type !== 'INSERT' ||
        payload.table !== 'notifications' ||
        payload.schema !== 'public' ||
        !payload.record?.id
      ) {
        return Response.json({
          ok: true,
          skipped: true,
          reason: 'Not a public.notifications INSERT',
        })
      }

      const notificationId = payload.record.id
      let notification: NotificationRecord | null = null

      const canonicalWithDispatch = await ctx.supabaseAdmin
        .from('notifications')
        .select('id,user_id,title,body,kind,data,push_sent_at,push_last_error')
        .eq('id', notificationId)
        .maybeSingle()

      if (
        canonicalWithDispatch.error &&
        (
          canonicalWithDispatch.error.code === '42703' ||
          canonicalWithDispatch.error.message.toLowerCase().includes('push_sent_at')
        )
      ) {
        const fallback = await ctx.supabaseAdmin
          .from('notifications')
          .select('id,user_id,title,body,kind,data')
          .eq('id', notificationId)
          .maybeSingle()

        if (fallback.error) {
          console.error('Could not load notification', fallback.error)
          return Response.json({ ok: false, error: fallback.error.message }, { status: 500 })
        }
        notification = fallback.data as NotificationRecord | null
      } else {
        if (canonicalWithDispatch.error) {
          console.error('Could not load notification', canonicalWithDispatch.error)
          return Response.json(
            { ok: false, error: canonicalWithDispatch.error.message },
            { status: 500 },
          )
        }
        notification = canonicalWithDispatch.data as NotificationRecord | null
      }

      if (!notification) {
        return Response.json({ ok: false, error: 'Notification not found' }, { status: 404 })
      }

      if (notification.push_sent_at) {
        return Response.json({
          ok: true,
          skipped: true,
          reason: 'Notification already dispatched',
          notification_id: notification.id,
        })
      }

      const tokenQuery = await ctx.supabaseAdmin
        .from('device_tokens')
        .select('expo_push_token,platform,emergency_alert_mode_version')
        .eq('user_id', notification.user_id)

      let rawTokens: DeviceTokenRow[] = []
      if (
        tokenQuery.error &&
        (
          tokenQuery.error.code === '42703' ||
          tokenQuery.error.message.toLowerCase().includes('emergency_alert_mode_version')
        )
      ) {
        const legacy = await ctx.supabaseAdmin
          .from('device_tokens')
          .select('expo_push_token,platform')
          .eq('user_id', notification.user_id)

        if (legacy.error) {
          console.error('Could not load device tokens', legacy.error)
          return Response.json({ ok: false, error: legacy.error.message }, { status: 500 })
        }
        rawTokens = (legacy.data ?? []).map((row: any) => ({
          expo_push_token: row.expo_push_token,
          platform: row.platform,
          emergency_alert_mode_version: 1,
        }))
      } else {
        if (tokenQuery.error) {
          console.error('Could not load device tokens', tokenQuery.error)
          return Response.json({ ok: false, error: tokenQuery.error.message }, { status: 500 })
        }
        rawTokens = (tokenQuery.data ?? []) as DeviceTokenRow[]
      }

      const byToken = new Map<string, DeviceTokenRow>()
      for (const row of rawTokens) {
        const token = String(row.expo_push_token ?? '').trim()
        if (!token) continue
        const previous = byToken.get(token)
        if (!previous || Number(row.emergency_alert_mode_version ?? 1) > Number(previous.emergency_alert_mode_version ?? 1)) {
          byToken.set(token, { ...row, expo_push_token: token })
        }
      }
      const tokenRows = [...byToken.values()]

      if (!tokenRows.length) {
        await ctx.supabaseAdmin
          .from('notifications')
          .update({ push_last_error: 'NO_DEVICE_TOKEN' })
          .eq('id', notification.id)

        return Response.json(
          {
            ok: false,
            sent: 0,
            attempted: 0,
            notification_id: notification.id,
            error: 'NO_DEVICE_TOKEN',
          },
          { status: 409 },
        )
      }

      const canonicalData = asObject(notification.data)
      const isCommunityEmergency = notification.kind === 'community_emergency'
      const isPttKind = ['ptt_incoming', 'ptt_priority', 'ptt_sos'].includes(
        String(notification.kind || ''),
      )
      const helpRequestId = String(canonicalData.help_request_id ?? '').trim()
      const emergencyCollapseId = isCommunityEmergency && helpRequestId ? `buklod-sos-${helpRequestId}` : undefined
      // Coalesce rapid posts by author and community on the Android tray.
      // Individual notifications remain in the database/Notification Center.
      const postScope = String(canonicalData.scope_id ?? canonicalData.group_id ?? '').trim()
      const postActor = String(canonicalData.actor_id ?? '').trim()
      const postCollapseId = notification.kind === 'community_post' && postScope && postActor
        ? `buklod-post-${postScope}-${postActor}`.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 120)
        : undefined
      const isConnectMessage = ['direct_message', 'connect_message'].includes(String(notification.kind ?? ''))
      const threadId = String(canonicalData.conversation_id ?? canonicalData.thread_id ?? canonicalData.scope_id ?? '').trim()
      const messageCollapseId = isConnectMessage && threadId
        ? `buklod-message-${threadId}`.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 120)
        : undefined
      const normalCollapseId = emergencyCollapseId ?? postCollapseId ?? messageCollapseId
      const pttCollapseId = isPttKind
        ? (
            `buklod-ptt-${String(canonicalData.scope_id ?? '').trim()}-${String(canonicalData.channel ?? '').trim()}-${String(canonicalData.transmission_id ?? notification.id).trim()}`
              .replace(/[^a-zA-Z0-9_-]+/g, '-')
              .replace(/-+/g, '-')
              .slice(0, 48)
          ) || `buklod-ptt-${notification.id}`
        : undefined

      let emergencyChannelReadyCount = 0
      let emergencyFallbackCount = 0

      type ExpoPushMessage = Record<string, unknown> & { to: string }
      const messages: ExpoPushMessage[] = []
      const messageTokenIndex: number[] = []

      tokenRows.forEach((row, tokenIndex) => {
        const expoPushToken = String(row.expo_push_token)
        const platform = String(row.platform ?? '').toLowerCase()
        const r2Ready = Number(row.emergency_alert_mode_version ?? 1) >= 2
        const androidEmergencyReady = isCommunityEmergency && platform === 'android' && r2Ready
        const categoryReady = isCommunityEmergency && r2Ready && (platform === 'android' || platform === 'ios')

        if (isCommunityEmergency) {
          if (androidEmergencyReady || (platform === 'ios' && r2Ready)) {
            emergencyChannelReadyCount += 1
          } else {
            emergencyFallbackCount += 1
          }
        }

        const sharedData = {
          ...canonicalData,
          notification_id: notification.id,
          kind: notification.kind,
          ...(isCommunityEmergency
            ? {
                emergency_alert_mode: r2Ready ? 'R2' : 'R1_FALLBACK',
                emergency_channel_ready: androidEmergencyReady,
              }
            : {}),
        }

        if (isPttKind && pttCollapseId) {
          const visibleCollapseId = `${pttCollapseId}-visible`
          const headlessCollapseId = `${pttCollapseId}-headless`
          const pttChannelId =
            notification.kind === 'ptt_sos'
              ? (androidEmergencyReady ? 'buklod-emergency-v1' : 'buklod-activity-v2')
              : 'buklod-activity-v2'

          // VISIBLE PTT push — must remain distinct from headless collapse identity.
          messages.push({
            to: expoPushToken,
            sound: 'default',
            priority: 'high',
            channelId: pttChannelId,
            collapseId: visibleCollapseId,
            tag: visibleCollapseId,
            title: notification.title,
            body: notification.body,
            data: {
              ...sharedData,
              buklod_ptt_delivery: 'visible',
            },
          })
          messageTokenIndex.push(tokenIndex)

          // HEADLESS / data-only PTT push — short TTL, separate collapseId.
          messages.push({
            to: expoPushToken,
            priority: 'high',
            ttl: 30,
            collapseId: headlessCollapseId,
            data: {
              ...sharedData,
              buklod_ptt_delivery: 'headless',
              _contentAvailable: true,
            },
            _contentAvailable: true,
          })
          messageTokenIndex.push(tokenIndex)
          return
        }

        messages.push({
          to: expoPushToken,
          sound: 'default',
          priority: 'high',
          channelId: androidEmergencyReady ? 'buklod-emergency-v1' : 'buklod-activity-v2',
          categoryId: categoryReady ? 'buklod_emergency' : isConnectMessage ? 'buklod_message_reply' : undefined,
          interruptionLevel: isCommunityEmergency && platform === 'ios' ? 'time-sensitive' : undefined,
          ttl: isCommunityEmergency ? 600 : undefined,
          collapseId: normalCollapseId,
          tag: normalCollapseId,
          title: notification.title,
          body: notification.body,
          data: sharedData,
        })
        messageTokenIndex.push(tokenIndex)
      })

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      }
      const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN')
      if (expoAccessToken) headers.Authorization = `Bearer ${expoAccessToken}`

      let response: Response
      try {
        response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers,
          body: JSON.stringify(messages),
        })
      } catch (error) {
        const message = errorText(error)
        await ctx.supabaseAdmin
          .from('notifications')
          .update({ push_last_error: message.slice(0, 1000) })
          .eq('id', notification.id)
        return Response.json({ ok: false, error: message }, { status: 502 })
      }

      let result: any = null
      try {
        result = await response.json()
      } catch {
        result = { raw: await response.text().catch(() => '') }
      }

      const tickets = Array.isArray(result?.data) ? result.data : []
      const successfulIndexes: number[] = []
      const invalidTokens: string[] = []

      tickets.forEach((ticket: any, index: number) => {
        if (ticket?.status === 'ok') {
          successfulIndexes.push(index)
          return
        }
        if (ticket?.details?.error === 'DeviceNotRegistered') {
          const tokenRowIndex = messageTokenIndex[index]
          const token = String(tokenRows[tokenRowIndex]?.expo_push_token ?? '')
          if (token) invalidTokens.push(token)
        }
      })

      if (invalidTokens.length) {
        await ctx.supabaseAdmin
          .from('device_tokens')
          .delete()
          .in('expo_push_token', invalidTokens)
      }

      const requestSucceeded = response.ok && (successfulIndexes.length > 0 || (tickets.length === 0 && tokenRows.length > 0))

      if (requestSucceeded) {
        await ctx.supabaseAdmin
          .from('notifications')
          .update({ push_sent_at: new Date().toISOString(), push_last_error: null })
          .eq('id', notification.id)
          .is('push_sent_at', null)
      } else {
        const failure = JSON.stringify(result).slice(0, 1000)
        await ctx.supabaseAdmin
          .from('notifications')
          .update({ push_last_error: failure })
          .eq('id', notification.id)
      }

      return Response.json(
        {
          ok: requestSucceeded,
          sent: successfulIndexes.length,
          attempted: messages.length,
          invalid_tokens_removed: invalidTokens.length,
          notification_id: notification.id,
          ptt_dual_delivery: isPttKind,
          ptt_collapse_isolation: isPttKind
            ? { visible: `${pttCollapseId}-visible`, headless: `${pttCollapseId}-headless` }
            : null,
          emergency_alert_mode: isCommunityEmergency ? 'R2_CAPABILITY_ROLLOUT' : null,
          emergency_r2_ready_tokens: emergencyChannelReadyCount,
          emergency_fallback_tokens: emergencyFallbackCount,
          expo: result,
        },
        { status: requestSucceeded ? 200 : 502 },
      )
    },
  ),
}
