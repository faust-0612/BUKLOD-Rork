import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { createKlDictionary, parseKlDictionaryRows, type DictionaryEntry } from './dictionary';

/** Chapter-scoped data. No AI invocation or per-paragraph network traffic.
 * Ignore responses from previous chapters; bundled dictionary remains offline. */
export function useKlChapterDictionary(episodeId: string | null, readableText: string | null, active = true) {
  const [remote, setRemote] = useState<{id:string; text:string; rows:DictionaryEntry[]} | null>(null);
  useEffect(() => {
    if (!episodeId || !readableText || !active) return;
    let live = true;
    void supabase.rpc('kl_dictionary_read_v1', {p_episode_id:episodeId}).then(({data,error}) => {
      if(live && !error && Array.isArray(data)) setRemote({id:episodeId,text:readableText,rows:parseKlDictionaryRows(data)});
    }, () => undefined);
    return () => {live=false;};
  }, [episodeId,readableText,active]);
  const entries=remote?.id===episodeId && remote?.text===readableText ? remote.rows : undefined;
  return useMemo(()=>createKlDictionary(entries),[entries]);
}
