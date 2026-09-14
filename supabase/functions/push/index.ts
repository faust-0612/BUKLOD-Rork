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

function asObject(value: unknown): Record<string, unknown> {
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value)
  ) {
    return value as Record<string, unknown>
  }

  return {}
}

/*
 * PATCH_171C_PUSH_CHANNEL_V2
 * PATCH_171B_TRUE_CLOSED_APP_PUSH
 * BUKLOD_EMERGENCY_ALERT_MODE_R2
 *
 * Security:
 * - Database webhook calls this function with the project's publishable key.
 * - The request body is NOT trusted as notification content.
 * - The canonical notification is reloaded through supabaseAdmin.
 * - push_sent_at prevents normal webhook replays from sending the same
 *   notification again after a successful dispatch.
 * - Only canonical community_emergency notifications are promoted to the
 *   dedicated emergency channel / Time Sensitive delivery path.
 */
export default {
  fetch: withSupabase(
    { auth: 'publishable' },
    async (req, ctx) => {
      let payload: WebhookPayload

      try {
        payload = await req.json()
      }
      catch {
        return Response.json(
          {
            ok: false,
            error: 'Invalid JSON payload',
          },
          {
            status: 400,
          }
        )
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

      const notificationId =
        payload.record.id

      /*
       * The fallback keeps deployment safe even if the function is deployed
       * immediately before PATCH 171B's DB migration is pushed.
       */
      let notification:
        NotificationRecord | null =
        null

      const canonicalWithDispatch =
        await ctx.supabaseAdmin
          .from('notifications')
          .select(
            'id,user_id,title,body,kind,data,push_sent_at,push_last_error'
          )
          .eq(
            'id',
            notificationId
          )
          .maybeSingle()

      if (
        canonicalWithDispatch.error &&
        (
          canonicalWithDispatch.error.code === '42703' ||
          canonicalWithDispatch.error.message
            .toLowerCase()
            .includes('push_sent_at')
        )
      ) {
        const fallback =
          await ctx.supabaseAdmin
            .from('notifications')
            .select(
              'id,user_id,title,body,kind,data'
            )
            .eq(
              'id',
              notificationId
            )
            .maybeSingle()

        if (fallback.error) {
          console.error(
            'Could not load notification',
            fallback.error
          )

          return Response.json(
            {
              ok: false,
              error:
                fallback.error.message,
            },
            {
              status: 500,
            }
          )
        }

        notification =
          fallback.data as
            NotificationRecord | null
      }
      else {
        if (canonicalWithDispatch.error) {
          console.error(
            'Could not load notification',
            canonicalWithDispatch.error
          )

          return Response.json(
            {
              ok: false,
              error:
                canonicalWithDispatch
                  .error.message,
            },
            {
              status: 500,
            }
          )
        }

        notification =
          canonicalWithDispatch.data as
            NotificationRecord | null
      }

      if (!notification) {
        return Response.json(
          {
            ok: false,
            error:
              'Notification not found',
          },
          {
            status: 404,
          }
        )
      }

      if (notification.push_sent_at) {
        return Response.json({
          ok: true,
          skipped: true,
          reason:
            'Notification already dispatched',
          notification_id:
            notification.id,
        })
      }

      const {
        data: tokens,
        error: tokenError,
      } =
        await ctx.supabaseAdmin
          .from('device_tokens')
          .select('expo_push_token')
          .eq(
            'user_id',
            notification.user_id
          )

      if (tokenError) {
        console.error(
          'Could not load device tokens',
          tokenError
        )

        return Response.json(
          {
            ok: false,
            error:
              tokenError.message,
          },
          {
            status: 500,
          }
        )
      }

      const uniqueTokens =
        [
          ...new Set(
            (tokens ?? [])
              .map(
                (row) =>
                  (
                    row.expo_push_token
                    ?? ''
                  ).trim()
              )
              .filter(Boolean)
          ),
        ]

      if (!uniqueTokens.length) {
        /*
         * PATCH_171C_NO_FAKE_PUSH_SUCCESS
         *
         * No physical Expo token means nothing was delivered.
         * Keep push_sent_at NULL and record an actionable reason.
         */
        await ctx.supabaseAdmin
          .from('notifications')
          .update({
            push_last_error:
              'NO_DEVICE_TOKEN',
          })
          .eq(
            'id',
            notification.id
          )

        return Response.json(
          {
            ok: false,
            sent: 0,
            attempted: 0,
            notification_id:
              notification.id,
            error:
              'NO_DEVICE_TOKEN',
          },
          {
            status: 409,
          }
        )
      }

      const canonicalData = asObject(notification.data)
      const isCommunityEmergency =
        notification.kind === 'community_emergency'
      const helpRequestId =
        String(canonicalData.help_request_id ?? '').trim()
      const emergencyCollapseId =
        isCommunityEmergency && helpRequestId
          ? `buklod-sos-${helpRequestId}`
          : undefined

      const messages =
        uniqueTokens.map(
          (expoPushToken) => ({
            to:
              expoPushToken,
            sound:
              'default',
            priority:
              'high',
            channelId:
              isCommunityEmergency
                ? 'buklod-emergency-v1'
                : 'buklod-activity-v2',
            categoryId:
              isCommunityEmergency
                ? 'buklod_emergency'
                : undefined,
            interruptionLevel:
              isCommunityEmergency
                ? 'time-sensitive'
                : undefined,
            ttl:
              isCommunityEmergency
                ? 600
                : undefined,
            collapseId:
              emergencyCollapseId,
            tag:
              emergencyCollapseId,
            title:
              notification.title,
            body:
              notification.body,
            data: {
              ...canonicalData,
              notification_id:
                notification.id,
              kind:
                notification.kind,
              ...(isCommunityEmergency
                ? { emergency_alert_mode: 'R2' }
                : {}),
            },
          })
        )

      const headers:
        Record<string, string> = {
          'Content-Type':
            'application/json',
          Accept:
            'application/json',
          'Accept-Encoding':
            'gzip, deflate',
        }

      const expoAccessToken =
        Deno.env.get(
          'EXPO_ACCESS_TOKEN'
        )

      if (expoAccessToken) {
        headers.Authorization =
          `Bearer ${expoAccessToken}`
      }

      let response: Response

      try {
        response =
          await fetch(
            'https://exp.host/--/api/v2/push/send',
            {
              method:
                'POST',
              headers,
              body:
                JSON.stringify(
                  messages
                ),
            }
          )
      }
      catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : String(error)

        await ctx.supabaseAdmin
          .from('notifications')
          .update({
            push_last_error:
              message.slice(
                0,
                1000
              ),
          })
          .eq(
            'id',
            notification.id
          )

        return Response.json(
          {
            ok: false,
            error:
              message,
          },
          {
            status: 502,
          }
        )
      }

      let result: any = null

      try {
        result =
          await response.json()
      }
      catch {
        result = {
          raw:
            await response.text()
              .catch(
                () => ''
              ),
        }
      }

      const tickets =
        Array.isArray(
          result?.data
        )
          ? result.data
          : []

      const successfulIndexes:
        number[] = []

      const invalidTokens:
        string[] = []

      tickets.forEach(
        (
          ticket: any,
          index: number
        ) => {
          if (
            ticket?.status ===
            'ok'
          ) {
            successfulIndexes
              .push(index)

            return
          }

          if (
            ticket?.details
              ?.error ===
            'DeviceNotRegistered'
          ) {
            const token =
              uniqueTokens[index]

            if (token) {
              invalidTokens
                .push(token)
            }
          }
        }
      )

      if (
        invalidTokens.length
      ) {
        await ctx.supabaseAdmin
          .from('device_tokens')
          .delete()
          .in(
            'expo_push_token',
            invalidTokens
          )
      }

      const requestSucceeded =
        response.ok &&
        (
          successfulIndexes.length >
          0 ||
          (
            tickets.length === 0 &&
            uniqueTokens.length > 0
          )
        )

      if (requestSucceeded) {
        await ctx.supabaseAdmin
          .from('notifications')
          .update({
            push_sent_at:
              new Date()
                .toISOString(),
            push_last_error:
              null,
          })
          .eq(
            'id',
            notification.id
          )
          .is(
            'push_sent_at',
            null
          )
      }
      else {
        const failure =
          JSON.stringify(
            result
          ).slice(
            0,
            1000
          )

        await ctx.supabaseAdmin
          .from('notifications')
          .update({
            push_last_error:
              failure,
          })
          .eq(
            'id',
            notification.id
          )
      }

      return Response.json(
        {
          ok:
            requestSucceeded,
          sent:
            successfulIndexes.length,
          attempted:
            messages.length,
          invalid_tokens_removed:
            invalidTokens.length,
          notification_id:
            notification.id,
          emergency_alert_mode:
            isCommunityEmergency
              ? 'R2'
              : null,
          expo:
            result,
        },
        {
          status:
            requestSucceeded
              ? 200
              : 502,
        }
      )
    }
  ),
}
