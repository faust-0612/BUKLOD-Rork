import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { showBuklodAdOpportunity } from '@/lib/buklodAdOpportunities';

type Question = { id: string; question: string; options: string[] };
type BeginResponse = {
  ok?: boolean; reason?: string; already_completed?: boolean; attempt_id?: string; questions?: Question[];
};
type Completion = { completed?: boolean; new_completion?: boolean; chapter_points?: number; series_points?: number };
type SubmitResponse = {
  ok?: boolean; passed?: boolean; correct?: number; total?: number;
  reason?: string; completion?: Completion; already_submitted?: boolean;
};

const reasons: Record<string, string> = {
  questions_preparing: 'Inihahanda pa ang mga tanong mula sa approved na kabanata. Subukan muli mamaya.',
  retry_later: 'Marami nang pagtatangka. Subukan muli pagkaraan ng ilang minuto.',
  chapter_unavailable: 'Hindi pa available ang kabanatang ito.',
  attempt_expired: 'Nag-expire ang mga tanong. Kumuha ng bagong set.',
  invalid_answers: 'Kumpletuhin muna ang tatlong sagot.',
  attempt_unavailable: 'Hindi na makita ang quiz attempt. Subukan muli.',
};

export default function KlReadingQuiz({
  episodeId, onVerified,
}: { episodeId: string | null; onVerified?: () => void }) {
  const [attemptId, setAttemptId] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);

  const begin = async () => {
    if (!episodeId || busy) return;
    setBusy(true); setMessage('');
    try {
      const { data, error } = await supabase.rpc('kl_quiz_begin_v1', { p_episode_id: episodeId });
      if (error) throw error;
      const result = data as BeginResponse | null;
      if (result?.already_completed) {
        setDone(true); setQuestions([]); setMessage('Naitala na ang pagkumpleto sa kabanatang ito.');
        return;
      }
      if (!result?.ok || !result.attempt_id || !Array.isArray(result.questions) ||
          result.questions.length !== 3 || result.questions.some(q =>
            typeof q.id !== 'string' || typeof q.question !== 'string' ||
            !Array.isArray(q.options) || q.options.length !== 4)) {
        setQuestions([]);
        setMessage(reasons[result?.reason ?? ''] ?? 'Hindi pa available ang reading quiz. Subukan muli.');
        return;
      }
      setAttemptId(result.attempt_id);
      setQuestions(result.questions);
      setAnswers({});
    } catch {
      setMessage('Hindi ma-load ang mga tanong. Suriin ang koneksiyon at subukan muli.');
    } finally { setBusy(false); }
  };

  const submit = async () => {
    if (!attemptId || questions.length !== 3 || busy || done) return;
    if (questions.some(q => answers[q.id] === undefined)) {
      setMessage('Sagutin muna ang lahat ng tatlong tanong.');
      return;
    }
    setBusy(true); setMessage('');
    try {
      const { data, error } = await supabase.rpc('kl_quiz_submit_v1', {
        p_attempt_id: attemptId, p_answers: answers,
      });
      if (error) throw error;
      const result = data as SubmitResponse | null;
      if (!result?.ok) {
        setQuestions([]);
        setMessage(reasons[result?.reason ?? ''] ?? 'Hindi ma-verify ang mga sagot. Subukan muli.');
      } else if (result.passed && result.completion?.completed === true) {
        setDone(true);
        setQuestions([]);
        setMessage('Natapos ang kabanata!' +
          (result.completion.new_completion
            ? ' +' + Number(result.completion.chapter_points ?? 5) + ' BP' +
              (Number(result.completion.series_points ?? 0) > 0
                ? ' · Series bonus +' + result.completion.series_points + ' BP' : '')
            : ' Naitala na ang completion.'));
        onVerified?.();
        if (result.completion.new_completion === true) {
          // Optional natural-break ad, never required to earn the verified reward.
          void showBuklodAdOpportunity('kl_chapter_success').catch(() => undefined);
        }
      } else {
        setQuestions([]); setAttemptId('');
        setMessage('Nakuha mo ang ' + Number(result?.correct ?? 0) +
          '/3. Basahing muli ang kabanata at subukan ulit; walang bawas sa BP.');
      }
    } catch {
      // Preserve the attempt for connectivity errors; server rejects duplicate submissions.
      setMessage('Hindi makumpirma ang sagot. Suriin ang koneksiyon bago subukan muli.');
    } finally { setBusy(false); }
  };

  return (
    <View style={{ gap: 10, paddingVertical: 8 }}>
      {questions.length === 0 && !done ? (
        <Pressable accessibilityRole="button" disabled={!episodeId || busy}
          onPress={() => void begin()}
          style={{ padding: 13, borderRadius: 9, backgroundColor: '#28583f', opacity: busy ? 0.7 : 1 }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>
            {busy ? 'Inihahanda ang mga tanong…' : 'Natapos magbasa? Sagutin ang 3 tanong'}
          </Text>
        </Pressable>
      ) : null}
      {questions.map((q, index) => (
        <View key={q.id} style={{ gap: 7, borderRadius: 10, backgroundColor: '#243849', padding: 13 }}>
          <Text style={{ color: '#f1d39b', fontWeight: '700' }}>Tanong {index + 1} sa 3</Text>
          <Text style={{ color: '#fff', fontSize: 17, lineHeight: 24 }}>{q.question}</Text>
          {q.options.map((option, choice) => {
            const chosen = answers[q.id] === choice;
            return (
              <Pressable key={choice} accessibilityRole="radio"
                accessibilityState={{ checked: chosen, disabled: busy }}
                disabled={busy || done}
                onPress={() => { setAnswers(previous => ({ ...previous, [q.id]: choice })); setMessage(''); }}
                style={{
                  padding: 12, minHeight: 44, borderRadius: 8,
                  backgroundColor: chosen ? '#385f4e' : '#35475a',
                  borderWidth: chosen ? 2 : 1,
                  borderColor: chosen ? '#a6dbbb' : '#627281',
                }}>
                <Text style={{ color: '#fff' }}>{String.fromCharCode(65 + choice)}. {option}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
      {questions.length === 3 && !done ? (
        <Pressable accessibilityRole="button" disabled={busy || Object.keys(answers).length !== 3}
          onPress={() => void submit()}
          style={{
            padding: 13, minHeight: 44, borderRadius: 9,
            backgroundColor: busy || Object.keys(answers).length !== 3 ? '#475b56' : '#28583f',
          }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>
            {busy ? 'Vini-verify…' : 'Isumite ang 3 sagot'}
          </Text>
        </Pressable>
      ) : null}
      {message ? <Text accessibilityRole="alert" style={{ color: '#ecf4e7' }}>{message}</Text> : null}
    </View>
  );
}
