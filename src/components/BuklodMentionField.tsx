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
  excludeUserId?: string | null;
  placeholder?: string;
  style?: StyleProp<TextStyle>;
  maxLength?: number;
  disabled?: boolean;
  suggestionsAbove?: boolean;
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
  excludeUserId,
  placeholder,
  style,
  maxLength,
  disabled = false,
  suggestionsAbove = false,
  placeholderTextColor = colors.muted,
  focusRef,
}: Props) {
  const inputRef = useRef<TextInput>(null);
  const cursorRef = useRef(value.length);
  const searchSeq = useRef(0);
  const [query, setQuery] = useState<string | null>(null);
  const [rows, setRows] = useState<BuklodMention[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [selection, setSelection] = useState<
    { start: number; end: number } | undefined
  >();

  const suggestionsOpen = query !== null && !dismissed && rows.length > 0;

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
    if (query === null || dismissed) {
      setRows([]);
      return;
    }

    const seq = ++searchSeq.current;
    const timer = setTimeout(() => {
      void (async () => {
        const { data, error } = await (supabase as any).rpc(
          'search_post_mention_candidates_v2',
          {
            p_audience: audience,
            p_group_id: audience === 'group' ? groupId : null,
            p_query: query,
            p_limit: 8,
          },
        );

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
          .slice(0, suggestionsAbove ? 4 : 6);

        setRows(next);
      })();
    }, 180);

    return () => clearTimeout(timer);
  }, [audience, dismissed, excludeUserId, groupId, mentions, query, suggestionsAbove]);

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
    <View style={suggestionsAbove ? styles.aboveWrap : undefined}>
      <View style={styles.field}>
        <TextInput
          ref={node => {
            inputRef.current = node;
            if (focusRef) {
              focusRef.current = node;
            }
          }}
          multiline
          allowFontScaling
          value={value}
          maxLength={maxLength}
          editable={!disabled}
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
          // The native input owns the visible glyphs. A transparent input over
          // an asynchronously painted mirror can hide newly typed captions.
          style={[styles.visibleTyping, style]}
        />
      </View>

      {suggestionsOpen && (
        <View style={[styles.list, suggestionsAbove && styles.listAbove]}>
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
  visibleTyping: {
    color: colors.text,
    fontSize: 16,
  },
  aboveWrap: {
    zIndex: 20,
    elevation: 8,
  },
  list: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  listAbove: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    maxHeight: 240,
    marginTop: 0,
    marginBottom: 6,
    zIndex: 20,
    elevation: 8,
  },
  row: {
    paddingHorizontal: 9,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  name: {
    color: colors.green,
    fontWeight: '800',
    fontSize: 15,
  },
  meta: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 12,
  },
});
