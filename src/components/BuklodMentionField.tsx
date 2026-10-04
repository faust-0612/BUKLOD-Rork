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

import BuklodMentionText from '@/components/BuklodMentionText';
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

  const knownNames = mentions.map(mention => mention.full_name);
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
          .slice(0, 6);

        setRows(next);
      })();
    }, 180);

    return () => clearTimeout(timer);
  }, [audience, dismissed, excludeUserId, groupId, mentions, query]);

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
    <View>
      <View style={styles.field}>
        {!!value && (
          <View pointerEvents="none" style={styles.mirror}>
            <BuklodMentionText
              text={value}
              knownNames={knownNames}
              style={[style, styles.mirrorText]}
            />
          </View>
        )}
        <TextInput
          ref={node => {
            inputRef.current = node;
            if (focusRef) {
              focusRef.current = node;
            }
          }}
          multiline
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
          style={[
            style,
            value ? styles.typing : null,
          ]}
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
  mirror: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 1,
  },
  mirrorText: {
    color: colors.text,
    borderColor: 'transparent',
  },
  typing: {
    color: 'transparent',
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
