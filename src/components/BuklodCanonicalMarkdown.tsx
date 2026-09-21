import React, { ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors } from '@/lib/theme';

type Props = {
  markdown: string;
  onInternalAnchor?: (anchor: string) => void;
};

function inlineNodes(
  text: string,
  onInternalAnchor?: (anchor: string) => void,
): ReactNode[] {
  const pattern =
    /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\(#[^)]+\)|\x60[^\x60]+\x60)/g;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text))) {
    if (match.index > cursor) {
      nodes.push(
        <Text key={`t-${key++}`}>
          {text.slice(cursor, match.index)}
        </Text>,
      );
    }

    const token = match[0];

    if (token.startsWith('**')) {
      nodes.push(
        <Text
          key={`b-${key++}`}
          style={styles.bold}
        >
          {token.slice(2, -2)}
        </Text>,
      );
    } else if (
      token.startsWith('*') &&
      token.endsWith('*')
    ) {
      nodes.push(
        <Text
          key={`i-${key++}`}
          style={styles.italic}
        >
          {token.slice(1, -1)}
        </Text>,
      );
    } else if (token.charCodeAt(0) === 96) {
      nodes.push(
        <Text
          key={`c-${key++}`}
          style={styles.code}
        >
          {token.slice(1, -1)}
        </Text>,
      );
    } else {
      const anchorMatch = token.match(
        /^\[([^\]]+)\]\(#([^)]+)\)$/,
      );
      const label = anchorMatch?.[1] ?? token;
      const anchor = anchorMatch?.[2] ?? '';
      nodes.push(
        <Text
          key={`a-${key++}`}
          style={styles.anchor}
          onPress={
            anchor && onInternalAnchor
              ? () => onInternalAnchor(anchor)
              : undefined
          }
        >
          {label}
        </Text>,
      );
    }

    cursor = pattern.lastIndex;
  }

  if (cursor < text.length) {
    nodes.push(
      <Text key={`t-${key++}`}>
        {text.slice(cursor)}
      </Text>,
    );
  }

  return nodes;
}

function renderParagraph(
  text: string,
  key: string,
  onInternalAnchor?: (anchor: string) => void,
) {
  return (
    <Text key={key} style={styles.paragraph}>
      {inlineNodes(text, onInternalAnchor)}
    </Text>
  );
}

export default function BuklodCanonicalMarkdown({
  markdown,
  onInternalAnchor,
}: Props) {
  const lines = String(markdown ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n');

  const blocks: ReactNode[] = [];
  let tableRows: string[][] = [];

  const flushTable = () => {
    if (!tableRows.length) return;

    blocks.push(
      <View
        key={`table-${blocks.length}`}
        style={styles.table}
      >
        {tableRows.map((row, rowIndex) => (
          <View
            key={`row-${rowIndex}`}
            style={[
              styles.tableRow,
              rowIndex === 0 && styles.tableHeader,
            ]}
          >
            {row.map((cell, cellIndex) => (
              <Text
                key={`cell-${cellIndex}`}
                style={[
                  styles.tableCell,
                  rowIndex === 0 &&
                    styles.tableHeaderText,
                ]}
              >
                {cell.trim()}
              </Text>
            ))}
          </View>
        ))}
      </View>,
    );

    tableRows = [];
  };

  lines.forEach((raw, index) => {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (
      trimmed.startsWith('|') &&
      trimmed.endsWith('|')
    ) {
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map(cell => cell.trim());

      if (
        cells.every(cell =>
          /^:?-{3,}:?$/.test(cell),
        )
      ) {
        return;
      }

      tableRows.push(cells);
      return;
    }

    flushTable();

    if (!trimmed) {
      blocks.push(
        <View
          key={`space-${index}`}
          style={styles.space}
        />,
      );
      return;
    }

    if (trimmed.startsWith('### ')) {
      blocks.push(
        <Text
          key={`h3-${index}`}
          style={styles.h3}
        >
          {inlineNodes(
            trimmed.slice(4),
            onInternalAnchor,
          )}
        </Text>,
      );
      return;
    }

    if (trimmed.startsWith('## ')) {
      blocks.push(
        <Text
          key={`h2-${index}`}
          style={styles.h2}
        >
          {inlineNodes(
            trimmed.slice(3),
            onInternalAnchor,
          )}
        </Text>,
      );
      return;
    }

    if (trimmed.startsWith('# ')) {
      blocks.push(
        <Text
          key={`h1-${index}`}
          style={styles.h1}
        >
          {inlineNodes(
            trimmed.slice(2),
            onInternalAnchor,
          )}
        </Text>,
      );
      return;
    }

    if (trimmed.startsWith('> ')) {
      blocks.push(
        <View
          key={`quote-${index}`}
          style={styles.callout}
        >
          <Text style={styles.calloutText}>
            {inlineNodes(
              trimmed.slice(2),
              onInternalAnchor,
            )}
          </Text>
        </View>,
      );
      return;
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      blocks.push(
        <View
          key={`bullet-${index}`}
          style={styles.listRow}
        >
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.listText}>
            {inlineNodes(
              bullet[1],
              onInternalAnchor,
            )}
          </Text>
        </View>,
      );
      return;
    }

    const ordered = trimmed.match(
      /^(\d+)\.\s+(.+)$/,
    );
    if (ordered) {
      blocks.push(
        <View
          key={`ordered-${index}`}
          style={styles.listRow}
        >
          <Text style={styles.number}>
            {ordered[1]}.
          </Text>
          <Text style={styles.listText}>
            {inlineNodes(
              ordered[2],
              onInternalAnchor,
            )}
          </Text>
        </View>,
      );
      return;
    }

    blocks.push(
      renderParagraph(
        trimmed,
        `p-${index}`,
        onInternalAnchor,
      ),
    );
  });

  flushTable();

  return <View style={styles.root}>{blocks}</View>;
}

const styles = StyleSheet.create({
  root: {
    gap: 2,
  },
  h1: {
    color: colors.text,
    fontSize: 24,
    lineHeight: 31,
    fontWeight: '900',
    marginBottom: 7,
  },
  h2: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 27,
    fontWeight: '900',
    marginTop: 8,
    marginBottom: 5,
  },
  h3: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '900',
    marginTop: 7,
    marginBottom: 4,
  },
  paragraph: {
    color: '#33463D',
    fontSize: 13.5,
    lineHeight: 21,
  },
  bold: {
    fontWeight: '900',
    color: colors.text,
  },
  italic: {
    fontStyle: 'italic',
  },
  code: {
    fontFamily: 'monospace',
    backgroundColor: '#EEF2EF',
  },
  anchor: {
    color: colors.greenDark,
    textDecorationLine: 'underline',
    fontWeight: '800',
  },
  callout: {
    marginVertical: 6,
    borderLeftWidth: 4,
    borderLeftColor: colors.green,
    borderRadius: 8,
    backgroundColor: '#EDF6F0',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  calloutText: {
    color: colors.greenDark,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 1,
  },
  bullet: {
    width: 16,
    color: colors.greenDark,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '900',
    textAlign: 'center',
  },
  number: {
    minWidth: 24,
    color: colors.greenDark,
    fontSize: 13,
    lineHeight: 21,
    fontWeight: '900',
    textAlign: 'right',
  },
  listText: {
    flex: 1,
    color: '#33463D',
    fontSize: 13.5,
    lineHeight: 21,
  },
  table: {
    marginVertical: 7,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    borderRadius: 10,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth:
      StyleSheet.hairlineWidth,
    borderBottomColor: '#DCE5E0',
  },
  tableHeader: {
    backgroundColor: '#EEF5F0',
  },
  tableCell: {
    flex: 1,
    minWidth: 90,
    paddingHorizontal: 8,
    paddingVertical: 7,
    color: '#33463D',
    fontSize: 11.5,
    lineHeight: 16,
  },
  tableHeaderText: {
    color: colors.greenDark,
    fontWeight: '900',
  },
  space: {
    height: 6,
  },
});
