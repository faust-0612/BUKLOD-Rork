/**
 * Source-of-truth helpers for BUKLOD outgoing call feedback.
 * A server-side ring request is NOT proof that FCM reached a remote phone.
 * Only a custom event from another authenticated call member confirms that
 * BUKLOD presented the incoming call while their app was in the foreground.
 */
export function isBuklodCallOriginator(
  call: any,
  currentUserId: string | null | undefined,
): boolean {
  const creator = String(
    call?.state?.createdBy?.id ??
      call?.state?.call?.created_by?.id ??
      call?.data?.created_by?.id ??
      '',
  ).trim();
  const current = String(currentUserId ?? '').trim();

  if (creator && current) {
    return creator === current;
  }

  // Stream exposes this for ringing calls even before createdBy is hydrated.
  return call?.isCreatedByMe === true;
}

export function isBuklodRecipientPresentationReceipt(
  call: any,
  event: any,
  currentUserId: string | null | undefined,
): boolean {
  const payload = event?.custom;
  if (payload?.type !== 'buklod.call.presented') return false;

  // A fresh unique call ID prevents receipts from earlier attempts carrying on.
  const cid = String(call?.cid ?? '');
  if (!cid || payload?.call_cid !== cid) return false;

  const sender = String(event?.user?.id ?? '').trim();
  const current = String(currentUserId ?? '').trim();
  if (!sender || !current || sender === current) return false;

  const members = call?.state?.members;
  if (Array.isArray(members) && members.length > 0) {
    const belongs = members.some(
      (member: any) =>
        String(member?.user?.id ?? member?.user_id ?? '') === sender,
    );
    if (!belongs) return false;
  }

  return true;
}
