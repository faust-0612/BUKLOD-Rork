import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { adminActionArgs, KL_RPC } from '@/lib/kabihasnang-ligaw/rpc';
import {
  findKlAdminChapter, isKlChapterReleased, klReleaseBlockers,
  parseKlAdminChapters, type KlAdminChapterRow,
} from '@/lib/kabihasnang-ligaw/releasePreflight';

type QuizReview = { status?: string };
type QuizContext = { quiz_status?: string };

function Action({ title, disabled, onPress }: {
  title: string; disabled?: boolean; onPress: () => void;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: Boolean(disabled) }}
    disabled={disabled} onPress={onPress}
    style={{ padding: 11, minHeight: 44, backgroundColor: disabled ? '#4f5d5a' : '#345f4d',
      borderRadius: 8, justifyContent: 'center' }}>
    <Text style={{ color: '#fff', fontWeight: '700' }}>{title}</Text>
  </Pressable>;
}

/** Reuse server chapter approval and release RPCs for ALL numbered series.
 * Never replace the existing publication authority or generate a chapter UUID.
 */
export default function KlSeriesReleaseDesk({ episodeId, seasonNumber, episodeNumber, onChanged }: {
  episodeId: string; seasonNumber: number; episodeNumber: number; onChanged?: () => void;
}) {
  const { user } = useAuth();
  const [row, setRow] = useState<KlAdminChapterRow | null>(null);
  const [quiz, setQuiz] = useState<QuizReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [releaseConfirm, setReleaseConfirm] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [message, setMessage] = useState('');
  const request = useRef(0);
  const actionLock = useRef(false);

  const refresh = useCallback(async () => {
    const token = ++request.current;
    setLoading(true);
    try {
      const [chapters, context] = await Promise.all([
        supabase.rpc(KL_RPC.adminList),
        supabase.rpc('kl_quiz_admin_context_v1', { p_episode_id: episodeId }),
      ]);
      if (chapters.error || !Array.isArray(chapters.data))
        throw chapters.error ?? new Error('Hindi ma-load ang admin chapter list.');
      if (token !== request.current) return;
      const latest = findKlAdminChapter(parseKlAdminChapters(chapters.data), seasonNumber, episodeNumber);
      if (!latest || latest.id !== episodeId)
        throw new Error('Hindi tugma ang chapter ID sa kasalukuyang server. I-refresh ang editor.');
      setRow(latest);
      setQuiz({ status: context.error ? 'unavailable' :
        ((context.data as QuizContext | null)?.quiz_status ?? 'pending') });
      setMessage('');
    } catch (error) {
      if (token === request.current) {
        setRow(null);
        setQuiz(null);
        setMessage(error instanceof Error ? error.message : 'Hindi na-load ang release status.');
      }
    } finally {
      if (token === request.current) setLoading(false);
    }
  }, [episodeId, episodeNumber, seasonNumber, user?.id]);

  useEffect(() => {
    setRow(null); setQuiz(null); setReleaseConfirm(false); setReason('');
    void refresh();
    return () => { request.current += 1; };
  }, [refresh]);

  const fresh = async () => {
    const { data, error } = await supabase.rpc(KL_RPC.adminList);
    if (error || !Array.isArray(data))
      throw error ?? new Error('Hindi available ang server preflight.');
    const latest = findKlAdminChapter(parseKlAdminChapters(data), seasonNumber, episodeNumber);
    if (!latest || latest.id !== episodeId) throw new Error('Chapter ID mismatch; action blocked.');
    return latest;
  };

  const seasonTwoReady = async () => {
    if (seasonNumber === 1) return;
    // This is a second client preflight; the production embargo and DB rollout
    // must still be independently verified before a Season 2 release.
    const { data, error } = await supabase.rpc('kl_s2_reader_progress_v1', {
      p_season_number: seasonNumber,
    });
    if (error || (data as { enabled?: boolean } | null)?.enabled !== true ||
        Date.now() < Date.parse('2026-12-06T00:00:00+08:00')) {
      throw new Error('Naka-hold ang Season 2 release hangga’t hindi approved at aktibo ang rollout.');
    }
  };

  const run = (label: string, task: () => Promise<void>) => {
    if (actionLock.current) return;
    actionLock.current = true; setBusy(true); setMessage(label + '…');
    void task().catch(error => {
      setMessage(error instanceof Error ? error.message : 'Hindi nakumpirma ang server action.');
    }).finally(() => { actionLock.current = false; setBusy(false); });
  };

  // Approved manuscript -> prepare its evidence-validated question bank automatically.
  // No administrator answer review or manual quiz approval is required.
  const ensureQuizReady = async () => {
    const { data: before, error: contextError } = await supabase.rpc(
      'kl_quiz_admin_context_v1', { p_episode_id: episodeId },
    );
    if (contextError) throw contextError;
    if ((before as QuizContext | null)?.quiz_status === 'ready') {
      setQuiz({ status: 'ready' });
      return;
    }
    const { data, error } = await supabase.functions.invoke('kl-generate-reading-quiz', {
      body: { episode_id: episodeId },
    });
    if (error || (data as { ok?: boolean; status?: string } | null)?.status !== 'ready') {
      throw error ?? new Error('Automatic question generation is pending. Hindi pa safe mag-release.');
    }
    const { data: verified, error: verifiedError } = await supabase.rpc(
      'kl_quiz_admin_context_v1', { p_episode_id: episodeId },
    );
    if (verifiedError || (verified as QuizContext | null)?.quiz_status !== 'ready') {
      throw verifiedError ?? new Error('Hindi pa verified sa server ang generated questions.');
    }
    setQuiz({ status: 'ready' });
  };

  const decide = (action: 'approve' | 'reject' | 'release' | 'schedule') => {
    run('Sinusuri ang chapter', async () => {
      const latest = await fresh();
      if (action === 'reject' && !reason.trim())
        throw new Error('Kailangan ang dahilan ng rejection.');
      if (action === 'release' || action === 'schedule') {
        await seasonTwoReady();
        if (latest.status !== 'approved' || !latest.approved_at)
          throw new Error('Approve muna ang chapter.');
        if (action === 'release') {
          if (!releaseConfirm) throw new Error('Kailangan ang explicit release confirmation.');
          const blockers = klReleaseBlockers(latest);
          if (blockers.length) throw new Error(blockers.join(' '));
        }
        // Server validates five manuscript-grounded questions; never ask the
        // admin to review or approve individual quiz answers.
        await ensureQuizReady();
        if (action === 'schedule') {
          const at = Date.parse(scheduleDate + 'T06:00:00+08:00');
          if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduleDate) || !Number.isFinite(at) || at < Date.now())
            throw new Error('Maglagay ng future release date: YYYY-MM-DD (6 AM Manila).');
        }
      } else if (action === 'approve') {
        if (!latest.has_manuscript || !latest.preview_ready)
          throw new Error('I-save at ihanda muna ang full manuscript at private preview.');
      }
      const { data, error } = await supabase.rpc(KL_RPC.adminAction, adminActionArgs({
        action, episodeId, notes: action === 'reject' ? reason : '',
        manilaDate: action === 'schedule' ? scheduleDate : null,
      }));
      if (error || (data as { ok?: boolean } | null)?.ok !== true)
        throw error ?? new Error('Server did not confirm chapter action.');

      const updated = await fresh();
      setRow(updated);
      let autoQuizStatus = '';
      if (action === 'approve') {
        try {
          await ensureQuizReady();
          autoQuizStatus = ' Awtomatikong naihanda ang 5 reading questions.';
        } catch {
          setQuiz({ status: 'pending' });
          autoQuizStatus = ' Naka-approve ang manuscript pero pending pa ang auto-generated questions; ire-retry sa release.';
        }
      }
      if (action === 'release') {
        if (!isKlChapterReleased(updated)) throw new Error('Release accepted but not verified; refresh status.');
        const [library, catalog] = await Promise.all([
          supabase.rpc(KL_RPC.listLibrary),
          supabase.rpc('kl_s2_reader_series_catalog_v1'),
        ]);
        if (library.error || !Array.isArray(library.data) ||
            !library.data.some((e: { id?: string }) => e.id === episodeId))
          throw new Error('Release recorded, but public chapter visibility is not yet verified.');
        if (seasonNumber > 1 && (catalog.error || !Array.isArray(catalog.data) ||
            !catalog.data.some((e: { season_number?: number }) => e.season_number === seasonNumber)))
          throw new Error('Release recorded, but series dashboard visibility is not yet verified.');
        setReleaseConfirm(false);
        setMessage('Verified: inilabas ang kabanata at nakalista na sa reader dashboard.');
      } else {
        setMessage(action === 'approve'
          ? 'Approved sa server; walang admin quiz review na kailangan.' + autoQuizStatus
          : action === 'schedule' ? 'Naka-schedule ayon sa server. Suriin ang release status.' :
            'Server confirmed rejection; naibalik para sa revision.');
      }
      onChanged?.();
    });
  };

  const retryQuizPreparation = () => run('Awtomatikong inihahanda ang questions', async () => {
    const latest = await fresh();
    if (latest.status !== 'approved') throw new Error('Approve muna ang manuscript.');
    await ensureQuizReady();
    setMessage('5 manuscript-validated questions ready. Wala nang manual quiz approval.');
  });

  const released = isKlChapterReleased(row);
  return <View style={{ padding: 12, gap: 9, backgroundColor: '#203b40', borderRadius: 10 }}>
    <Text style={{ color: '#f1d39b', fontSize: 17, fontWeight: '800' }}>
      Admin Release · S{seasonNumber} Ch{episodeNumber}
    </Text>
    <Text style={{ color: '#e5ede7' }}>
      {loading ? 'Kinukuha ang live server status…'
        : !row ? 'Walang verified server status.'
        : released ? 'Released · visible to readers'
        : `Status: ${row.status} · Preview: ${row.preview_ready ? 'ready' : 'pending'} · Quiz: ${quiz?.status ?? 'unknown'}`}
    </Text>
    <Action title={loading ? 'Loading…' : 'I-refresh ang server status'}
      disabled={loading || busy} onPress={() => { void refresh(); }} />
    {row && !released ? <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
        <Action title="Approve manuscript" disabled={busy || loading || row.status === 'approved' ||
          !row.has_manuscript || !row.preview_ready} onPress={() => decide('approve')} />
        {quiz?.status !== 'ready' ? <Action title="Retry auto-generate questions"
          disabled={busy || loading || row.status !== 'approved'} onPress={retryQuizPreparation} /> : null}
      </View>
      <TextInput accessibilityLabel="Dahilan ng rejection" placeholder="Dahilan ng rejection"
        placeholderTextColor="#a7bbb7" value={reason} onChangeText={setReason}
        style={{ padding: 10, color: '#fff', borderWidth: 1, borderColor: '#637c78', borderRadius: 8 }} />
      <Action title="Reject / ibalik sa draft" disabled={busy || !reason.trim()}
        onPress={() => decide('reject')} />
      <Text style={{ color: '#d8e9d7' }}>
        Schedule: 6 AM Asia/Manila. Para sa bagong serye, naka-hold ang release
        hanggang aktibo ang Season 2 rollout.
      </Text>
      <TextInput accessibilityLabel="Scheduled release date" value={scheduleDate}
        onChangeText={setScheduleDate} placeholder="YYYY-MM-DD" placeholderTextColor="#a7bbb7"
        style={{ padding: 10, color: '#fff', borderWidth: 1, borderColor: '#637c78', borderRadius: 8 }} />
      <Action title="Schedule release" disabled={busy || row.status !== 'approved'} onPress={() => decide('schedule')} />
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: releaseConfirm }}
        onPress={() => setReleaseConfirm(!releaseConfirm)}
        style={{ padding: 10, minHeight: 44 }}>
        <Text style={{ color: '#fff' }}>
          {releaseConfirm ? '☑' : '☐'} Nakumpleto ang preview at media approvals; ang questions ay awtomatikong ive-verify bago mag-release.
        </Text>
      </Pressable>
      <Action title="Release Now (server verified)" disabled={busy || !releaseConfirm ||
        row.status !== 'approved'}
        onPress={() => decide('release')} />
    </> : null}
    {message ? <Text accessibilityRole="alert" style={{ color: '#ffdda3' }}>{message}</Text> : null}
  </View>;
}
