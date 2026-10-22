import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import type { BuklodMention } from '@/lib/buklodMentionCompose';

type ReplyTarget = { id: string; parent_id?: string | null; user_id?: string; commenter_name?: string | null; body?: string; };
export type CommentDraft = { text: string; mentions: BuklodMention[]; replyTo: ReplyTarget | null };
type Envelope = { active: string; drafts: Record<string, CommentDraft> };
export type SubmittedCommentDraft = { key: string; target: string; draft: CommentDraft };
const memory = new Map<string, Envelope>();
const writes = new Map<string, Promise<void>>();
const empty = (): CommentDraft => ({ text: '', mentions: [], replyTo: null });
const targetKey = (draft: CommentDraft) => draft.replyTo?.id || 'root';
const same = (a: CommentDraft | undefined, b: CommentDraft) => JSON.stringify(a) === JSON.stringify(b);
export const commentDraftStorageKey = (accountId: string, community: string, postId: string) =>
  '@buklod/comment-drafts/v2/' + [accountId, community, postId].map(encodeURIComponent).join('/');

async function read(key: string): Promise<Envelope> {
  const cached = memory.get(key);
  if (cached) return cached;
  let value: Envelope = { active: 'root', drafts: {} };
  try {
    const raw = await AsyncStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed.active === 'string' && parsed.drafts && typeof parsed.drafts === 'object') {
      for (const [id, entry] of Object.entries(parsed.drafts)) {
        const draft = entry as CommentDraft;
        if (typeof draft?.text === 'string' && Array.isArray(draft.mentions)) value.drafts[id] = draft;
      }
      value.active = parsed.active;
    }
  } catch { /* Keep the local draft usable if disk storage is unavailable. */ }
  value = memory.get(key) || value;
  memory.set(key, value);
  return value;
}
function persist(key: string, envelope: Envelope) {
  memory.set(key, envelope);
  const serialized = JSON.stringify(envelope);
  const write = (writes.get(key) || Promise.resolve()).catch(() => undefined)
    .then(() => Object.keys(envelope.drafts).length
      ? AsyncStorage.setItem(key, serialized)
      : AsyncStorage.removeItem(key));
  writes.set(key, write);
  void write.catch(() => console.warn('Comment draft storage unavailable.'));
  return write;
}
function save(key: string, draft: CommentDraft) {
  const envelope = memory.get(key) || { active: 'root', drafts: {} };
  const target = targetKey(draft);
  return persist(key, { active: target, drafts: { ...envelope.drafts, [target]: draft } });
}

type Options = {
  accountId?: string | null; community: string; postId?: string | null; open: boolean;
  text: string; mentions: BuklodMention[]; replyTo: ReplyTarget | null;
  setText: (value: string) => void; setMentions: (value: BuklodMention[]) => void;
  setReplyTo: (value: any) => void;
};
export function useBuklodCommentDraft(options: Options) {
  const { accountId, community, postId, open, text, mentions, replyTo } = options;
  const key = accountId && postId ? commentDraftStorageKey(accountId, community, postId) : '';
  const [hydratedKey, setHydratedKey] = useState('');
  const hydratedRef = useRef('');
  const closingDraft = useRef<{ key: string; draft: CommentDraft } | null>(null);
  const latest = useRef({ key, open, draft: { text, mentions, replyTo }, options });
  latest.current = { key, open, draft: { text, mentions, replyTo }, options };
  if (key && hydratedRef.current === key) closingDraft.current = { key, draft: { text, mentions, replyTo } };
  const ready = Boolean(open && key && hydratedKey === key);
  function apply(draft: CommentDraft) {
    const current = latest.current.options;
    current.setText(draft.text); current.setMentions(draft.mentions); current.setReplyTo(draft.replyTo);
  }
  useEffect(() => {
    if (!open || !key) { setHydratedKey(''); return; }
    let cancelled = false;
    setHydratedKey('');
    void read(key).then(envelope => {
      if (cancelled || latest.current.key !== key || !latest.current.open) return;
      hydratedRef.current = key;
      apply(envelope.drafts[envelope.active] || empty());
      setHydratedKey(key);
    });
    return () => {
      cancelled = true;
      const closing = closingDraft.current;
      if (closing?.key === key) void save(key, closing.draft).catch(() => undefined);
    };
  }, [key, open]);
  useEffect(() => {
    if (ready) void save(key, { text, mentions, replyTo }).catch(() => undefined);
  }, [key, ready, text, mentions, replyTo]);

  function selectReply(target: ReplyTarget | null) {
    if (!ready) return;
    void save(key, latest.current.draft).catch(() => undefined);
    const envelope = memory.get(key)!;
    const id = target?.id || 'root';
    const name = target?.commenter_name || 'BUKLOD Member';
    const draft = envelope.drafts[id] || (target ? {
      text: '@' + name + ' ',
      mentions: target.user_id ? [{ user_id: target.user_id, full_name: name }] : [],
      replyTo: target,
    } : empty());
    apply(draft);
    void save(key, draft).catch(() => undefined);
  }
  function captureSubmission(): SubmittedCommentDraft {
    const draft = latest.current.draft;
    void save(key, draft).catch(() => undefined);
    return { key, target: targetKey(draft), draft };
  }
  async function clearSubmitted(submitted: SubmittedCommentDraft) {
    const current = latest.current;
    if (current.key === submitted.key && ready && !same(current.draft, submitted.draft)) {
      await save(current.key, current.draft).catch(() => undefined);
    }
    const envelope = await read(submitted.key);
    if (!same(envelope.drafts[submitted.target], submitted.draft)) return;
    const drafts = { ...envelope.drafts };
    delete drafts[submitted.target];
    const active = envelope.active === submitted.target ? 'root' : envelope.active;
    await persist(submitted.key, { active, drafts }).catch(() => undefined);
    if (latest.current.key === submitted.key && same(latest.current.draft, submitted.draft)) {
      apply(drafts[active] || empty());
    }
  }
  return { ready, selectReply, captureSubmission, clearSubmitted };
}
