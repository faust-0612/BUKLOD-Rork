/**
 * Local search across conversations the authenticated inbox RPC already
 * returned. Never query another member's private messages just for search.
 */
export type ConnectSearchableConversation = {
  other_user_name?: string | null;
  scope_name?: string | null;
  last_message?: string | null;
};

export function matchesConnectInboxSearch(
  item: ConnectSearchableConversation,
  text: string,
): boolean {
  const query = text.trim().toLocaleLowerCase();
  if (query.length < 2) return true;
  return [item.other_user_name, item.scope_name, item.last_message]
    .some(value => typeof value === 'string' &&
      value.toLocaleLowerCase().includes(query));
}
