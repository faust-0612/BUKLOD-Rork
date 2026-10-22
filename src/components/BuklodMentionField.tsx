import React, {
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import {
  activeMentionQuery,
  insertMention,
  mentionsStillInText,
  type BuklodMention,
} from '@/lib/buklodMentionCompose';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  mentions: BuklodMention[];
  onMentionsChange: (mentions: BuklodMention[]) => void;
  audience?: string;
  groupId?: string | null;
  scopeId?: string | null;
  editable?: boolean;
  excludeUserId?: string | null;
  placeholder?: string;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  maxLength?: number;
  placeholderTextColor?: string;
  focusRef?: { current: TextInput | null };
};

export default function BuklodMentionField({
  value,
  onChangeText,
  mentions,
  onMentionsChange,
  audience = 'public',
  groupId = null,
  scopeId = null,
  editable = true,
  excludeUserId,
  placeholder,
  style,
  containerStyle,
  maxLength,
  placeholderTextColor = colors.muted,
  focusRef,
}: Props) {
  const inputRef = useRef<TextInput>(null);
  const cursorRef = useRef(value.length);
  const searchSeq = useRef(0);
  const [query, setQuery] = useState<string | null>(null);
  const [rows, setRows] = useState<BuklodMention[]>([]);
  const rowsContextRef = useRef('');
  const contextKey = [audience, groupId, scopeId, excludeUserId].join('|');
  const [dismissed, setDismissed] = useState(false);
  const [selection, setSelection] = useState<
    { start: number; end: number } | undefined
  >();

  const suggestionsOpen = editable && rowsContextRef.current === contextKey && query !== null && !dismissed && rows.length > 0;

  useEffect(() => {
    if (!suggestionsOpen) {
      return;
    }

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        setDismissed(true);
        return true;
      },
    );

    return () => subscription.remove();
  }, [suggestionsOpen]);

  useEffect(() => {
    if (query === null || dismissed || !editable) {
      setRows([]);
      return;
    }

    setRows([]);
    const seq = ++searchSeq.current;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const { data, error } = scopeId
            ? await (supabase as any).rpc('buklod_scope_list_members_v1', {
                p_scope_id: scopeId, p_status: 'ACTIVE', p_query: query,
                p_limit: 8, p_offset: 0,
              })
            : await (supabase as any).rpc('search_post_mention_candidates_v2', {
                p_audience: audience,
                p_group_id: audience === 'group' ? groupId : null,
                p_query: query, p_limit: 8,
              });

          if (seq !== searchSeq.current) {
            return;
          }

          if (error) {
            setRows([]);
            return;
          }

          const taken = new Set(mentions.map(mention => mention.user_id));
          const next = (Array.isArray(data) ? data : [])
            .filter((row: BuklodMention) => {
              const id = String(row?.user_id ?? '');
              return id && id !== excludeUserId && !taken.has(id);
            })
            .slice(0, 6);

          rowsContextRef.current = contextKey;
          setRows(next);
        } catch {
          if (seq === searchSeq.current) setRows([]);
        }
      })();
    }, 180);

    return () => {
      clearTimeout(timer);
      searchSeq.current += 1;
    };
  }, [audience, contextKey, dismissed, editable, excludeUserId, groupId, mentions, query, scopeId]);

  const syncQuery = (text: string, cursor: number) => {
    const active = activeMentionQuery(text, cursor);
    setQuery(active ? active.query : null);
    setDismissed(false);
  };

  const changeText = (text: string) => {
    const delta = text.length - value.length;
    const cursor = Math.max(
      0,
      Math.min(text.length, cursorRef.current + delta),
    );
    cursorRef.current = cursor;
    onChangeText(text);
    onMentionsChange(mentionsStillInText(text, mentions));
    syncQuery(text, cursor);
  };

  const choose = (mention: BuklodMention) => {
    const placed = insertMention(
      value,
      cursorRef.current,
      mention.full_name,
    );
    const nextMentions = mentionsStillInText(placed.text, [
      ...mentions.filter(item => item.user_id !== mention.user_id),
      mention,
    ]);

    onChangeText(placed.text);
    onMentionsChange(nextMentions);
    cursorRef.current = placed.cursor;
    setSelection({
      start: placed.cursor,
      end: placed.cursor,
    });
    setQuery(null);
    setRows([]);
    inputRef.current?.focus();
  };

  return (
    <View style={containerStyle}>
      <View style={styles.field}>
        <TextInput
          ref={node => {
            inputRef.current = node;
            if (focusRef) {
              focusRef.current = node;
            }
          }}
          multiline
          editable={editable}
          value={value}
          maxLength={maxLength}
          placeholder={value ? '' : placeholder}
          placeholderTextColor={placeholderTextColor}
          selection={selection}
          selectionColor={colors.green}
          onChangeText={changeText}
          onSelectionChange={event => {
            const next = event.nativeEvent.selection;
            cursorRef.current = next.start;
            setSelection(undefined);
            syncQuery(value, next.start);
          }}
          style={style}
        />
      </View>

      {suggestionsOpen && (
        <View style={styles.list}>
          {rows.map(row => (
            <Pressable
              key={row.user_id}
              onPress={() => choose(row)}
              style={styles.row}
            >
              <Text style={styles.name}>{row.full_name}</Text>
              {!!(row.church_name || row.group_name) && (
                <Text style={styles.meta} numberOfLines={1}>
                  {[row.church_name, row.group_name]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              )}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    position: 'relative',
  },
  list: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  row: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  name: {
    color: colors.green,
    fontWeight: '800',
    fontSize: 14,
  },
  meta: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 11,
  },
});
