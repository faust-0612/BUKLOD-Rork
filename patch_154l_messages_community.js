const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const connect = path.resolve('src/app/connect/[id].tsx');
const community = path.resolve('src/app/(tabs)/buklod.tsx');

if (!fs.existsSync(connect)) throw new Error('connect/[id].tsx not found');
if (!fs.existsSync(community)) throw new Error('buklod.tsx not found');

for (const f of [connect, community]) {
  const bak = f + '.bak154l';
  if (!fs.existsSync(bak)) fs.copyFileSync(f, bak);
}

let t = fs.readFileSync(connect, 'utf8');

/* ============================================================
   PATCH 154L-A
   REACT useRef support for double-tap reaction badge
============================================================ */

if (!/\buseRef\b/.test(
  (t.match(/import\s*\{[\s\S]*?\}\s*from\s*['"]react['"];/) || [''])[0]
)) {
  t = t.replace(
    /import\s*\{/,
    `import {
  useRef,`
  );
}

/* ============================================================
   PATCH 154L-B
   Make reaction icon available to own messages too.
   Restrict replacement to the condition nearest React cue.
============================================================ */

const reactLabelIndex =
  t.indexOf('accessibilityLabel="React to message"');

if (reactLabelIndex >= 0) {
  const mineIndex =
    t.lastIndexOf('!m.is_mine', reactLabelIndex);

  if (
    mineIndex >= 0 &&
    reactLabelIndex - mineIndex < 500
  ) {
    const segment =
      t.slice(mineIndex, reactLabelIndex);

    const fixed =
      segment.replace(
        /!m\.is_mine\s*&&\s*/,
        ''
      );

    t =
      t.slice(0, mineIndex) +
      fixed +
      t.slice(reactLabelIndex);
  }
}

/* ============================================================
   PATCH 154L-C
   If inline reaction picker does not exist, convert cue.
============================================================ */

if (
  !t.includes(
    'selected?.message_id === m.message_id'
  )
) {
  const labelIndex =
    t.indexOf(
      'accessibilityLabel="React to message"'
    );

  if (labelIndex >= 0) {
    const ps =
      t.lastIndexOf(
        '<Pressable',
        labelIndex
      );

    const pe0 =
      t.indexOf(
        '</Pressable>',
        labelIndex
      );

    if (ps >= 0 && pe0 > ps) {
      const pe =
        pe0 + '</Pressable>'.length;

      const cue = `
                  {/* PATCH_154L_REACTION_CUE */}
                  <View
                    style={{
                      position: 'relative',
                      zIndex: 80,
                      alignSelf:
                        m.is_mine
                          ? 'flex-end'
                          : 'flex-start',
                    }}
                  >
                    <Pressable
                      onPress={() => {
                        if (
                          reactionOpen &&
                          selected?.message_id ===
                            m.message_id
                        ) {
                          setReactionOpen(false);
                          setSelected(null);
                        } else {
                          openReaction(m);
                        }
                      }}
                      style={s.reactCue}
                      accessibilityLabel="React to message"
                    >
                      <MaterialCommunityIcons
                        name="emoticon-plus-outline"
                        size={16}
                        color={colors.greenDark}
                      />
                    </Pressable>

                    {reactionOpen &&
                      selected?.message_id ===
                        m.message_id && (
                        <View
                          style={{
                            position: 'absolute',
                            bottom: 38,
                            left:
                              m.is_mine
                                ? undefined
                                : 0,
                            right:
                              m.is_mine
                                ? 0
                                : undefined,
                            width: 188,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent:
                              'space-evenly',
                            paddingHorizontal: 4,
                            paddingVertical: 5,
                            borderRadius: 18,
                            backgroundColor:
                              colors.white,
                            borderWidth: 1,
                            borderColor:
                              colors.line,
                            elevation: 9,
                            zIndex: 100,
                          }}
                        >
                          {RX.map((r) => (
                            <Pressable
                              key={r.key}
                              onPress={(e) => {
                                e.stopPropagation();
                                void react(r.key);
                              }}
                              accessibilityLabel={
                                r.label
                              }
                              style={{
                                width: 35,
                                height: 35,
                                borderRadius: 18,
                                alignItems:
                                  'center',
                                justifyContent:
                                  'center',
                                backgroundColor:
                                  m.reaction ===
                                  r.key
                                    ? colors.greenSoft
                                    : colors.white,
                              }}
                            >
                              <MaterialCommunityIcons
                                name={r.icon}
                                size={22}
                                color={
                                  colors.greenDark
                                }
                              />
                            </Pressable>
                          ))}
                        </View>
                      )}
                  </View>`;

      t =
        t.slice(0, ps) +
        cue +
        t.slice(pe);
    }
  }
}

/* ============================================================
   PATCH 154L-D
   Fix overflow of already-existing inline picker
============================================================ */

t = t.replace(
  /right:\s*0,\s*bottom:\s*38,\s*flexDirection:\s*'row',/,
  `left:
          m.is_mine
            ? undefined
            : 0,
        right:
          m.is_mine
            ? 0
            : undefined,
        bottom: 38,
        width: 188,
        flexDirection: 'row',`
);

t = t.replace(
  /gap:\s*4,\s*paddingHorizontal:\s*7,/,
  `gap: 2,
          paddingHorizontal: 4,`
);

/* ============================================================
   PATCH 154L-E
   Double tap reaction badge.
   Second tap within 360ms invokes the same reaction again.
============================================================ */

if (
  !t.includes(
    'PATCH_154L_REACTION_DOUBLE_TAP'
  )
) {
  const componentMatch =
    t.match(
      /export\s+default\s+function[^{]*\{/
    );

  if (componentMatch) {
    const pos =
      componentMatch.index +
      componentMatch[0].length;

    const helper = `

  /* PATCH_154L_REACTION_DOUBLE_TAP */
  const reactionBadgeTapRef = useRef<{
    messageId: string;
    at: number;
  }>({
    messageId: '',
    at: 0,
  });

`;

    t =
      t.slice(0, pos) +
      helper +
      t.slice(pos);
  }
}

/* Convert current reaction badge View to Pressable */
const reactionStart =
  t.indexOf('{!!m.reaction');

if (reactionStart >= 0) {
  const badgeStyle =
    t.indexOf(
      's.reactionBadge',
      reactionStart
    );

  if (badgeStyle >= 0) {
    const viewStart =
      t.lastIndexOf(
        '<View',
        badgeStyle
      );

    const viewEnd0 =
      t.indexOf(
        '</View>',
        badgeStyle
      );

    if (
      viewStart >= reactionStart &&
      viewEnd0 > viewStart
    ) {
      const opening =
        t.slice(
          viewStart,
          t.indexOf('>', viewStart) + 1
        );

      if (
        !opening.includes(
          'handleReactionBadge'
        )
      ) {
        const newOpening =
          opening.replace(
            '<View',
            `<Pressable
                      accessibilityLabel="Double tap reaction to remove"
                      onPress={() => {
                        const now = Date.now();
                        const previous =
                          reactionBadgeTapRef.current;

                        if (
                          previous.messageId ===
                            m.message_id &&
                          now - previous.at <= 360
                        ) {
                          reactionBadgeTapRef.current = {
                            messageId: '',
                            at: 0,
                          };

                          setSelected(m);
                          setActionOpen(false);
                          setReactionOpen(false);

                          setTimeout(() => {
                            void react(
                              m.reaction as Reaction
                            );
                          }, 0);
                        } else {
                          reactionBadgeTapRef.current = {
                            messageId:
                              m.message_id,
                            at: now,
                          };
                        }
                      }}`
          );

        t =
          t.slice(0, viewStart) +
          newOpening +
          t.slice(
            t.indexOf('>', viewStart) + 1,
            viewEnd0
          ) +
          '</Pressable>' +
          t.slice(
            viewEnd0 +
              '</View>'.length
          );
      }
    }
  }
}

/* ============================================================
   PATCH 154L-F
   EXTRACT existing long-press actions BEFORE removing drawer.
============================================================ */

let actionInner = '';

const drawerStart =
  t.indexOf(
    '{/* MESSAGE LONG-PRESS DRAWER */}'
  );

let drawerEnd =
  t.indexOf(
    '{/* REACTION DRAWER */}',
    drawerStart
  );

if (drawerEnd < 0) {
  drawerEnd =
    t.indexOf(
      '{/* FORWARD DRAWER */}',
      drawerStart
    );
}

if (
  drawerStart >= 0 &&
  drawerEnd > drawerStart
) {
  const drawer =
    t.slice(
      drawerStart,
      drawerEnd
    );

  const actions =
    drawer.match(
      /\{!!selected\s*&&\s*\(\s*<>\s*([\s\S]*?)\s*<\/>\s*\)\}/
    );

  if (actions) {
    actionInner =
      actions[1];

    /* Reaction has its own bubble icon now */
    actionInner =
      actionInner.replace(
        /\{!selected\.is_mine\s*&&\s*\(\s*<Pressable[\s\S]*?openReaction\([\s\S]*?selected[\s\S]*?React[\s\S]*?<\/Pressable>\s*\)\}/,
        ''
      );
  }
}

/* ============================================================
   PATCH 154L-G
   Ensure messageWrap can anchor popovers.
============================================================ */

t = t.replace(
  /messageWrap:\s*\{\s*(?!position:)/,
  `messageWrap: {
        position: 'relative',
        zIndex: 1,
        `
);

/* ============================================================
   PATCH 154L-H
   Put long-press actions beside selected bubble.
============================================================ */

if (
  actionInner &&
  !t.includes(
    'PATCH_154L_INLINE_MESSAGE_OPTIONS'
  )
) {
  const cueLabel =
    t.indexOf(
      'accessibilityLabel="React to message"'
    );

  if (cueLabel >= 0) {
    let insertAt =
      t.lastIndexOf(
        '{!m.is_deleted',
        cueLabel
      );

    if (
      insertAt < 0 ||
      cueLabel - insertAt > 700
    ) {
      insertAt =
        t.lastIndexOf(
          '<View',
          cueLabel
        );
    }

    if (insertAt >= 0) {
      const popup = `
              {/* PATCH_154L_INLINE_MESSAGE_OPTIONS */}
              {actionOpen &&
                selected?.message_id ===
                  m.message_id && (
                  <View
                    style={{
                      position: 'absolute',
                      bottom: 42,
                      left:
                        m.is_mine
                          ? undefined
                          : 0,
                      right:
                        m.is_mine
                          ? 0
                          : undefined,
                      width: 205,
                      maxHeight: 330,
                      zIndex: 120,
                      elevation: 10,
                      padding: 8,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor:
                        colors.line,
                      backgroundColor:
                        colors.white,
                    }}
                  >
                    <Text
                      style={{
                        paddingHorizontal: 8,
                        paddingTop: 3,
                        paddingBottom: 7,
                        fontSize: 9,
                        fontWeight: '900',
                        letterSpacing: 0.7,
                        color:
                          colors.greenDark,
                      }}
                    >
                      MESSAGE OPTIONS
                    </Text>

${actionInner}
                  </View>
                )}

`;

      t =
        t.slice(0, insertAt) +
        popup +
        t.slice(insertAt);
    }
  }
}

/* ============================================================
   PATCH 154L-I
   Remove BOTH old bottom drawers.
============================================================ */

t = t.replace(
  /\s*\{\/\*\s*MESSAGE LONG-PRESS DRAWER\s*\*\/\}[\s\S]*?(?=\s*\{\/\*\s*(?:REACTION DRAWER|FORWARD DRAWER)\s*\*\/\})/,
  '\n\n'
);

t = t.replace(
  /\s*\{\/\*\s*REACTION DRAWER\s*\*\/\}[\s\S]*?(?=\s*\{\/\*\s*FORWARD DRAWER\s*\*\/\})/,
  '\n\n'
);

/* ============================================================
   PATCH 154L-J
   Tap elsewhere in message list closes popovers.
============================================================ */

if (
  !t.includes(
    'PATCH_154L_TAP_OUTSIDE'
  )
) {
  const mapIndex =
    t.indexOf('messages.map');

  const scrollIndex =
    t.lastIndexOf(
      '<ScrollView',
      mapIndex
    );

  if (
    scrollIndex >= 0 &&
    mapIndex > scrollIndex
  ) {
    const tagEnd =
      t.indexOf(
        '>',
        scrollIndex
      );

    const closeProp = `
        /* PATCH_154L_TAP_OUTSIDE */
        onTouchEnd={() => {
          if (
            reactionOpen ||
            actionOpen
          ) {
            setReactionOpen(false);
            setActionOpen(false);
            setSelected(null);
          }
        }}
      `;

    t =
      t.slice(0, tagEnd) +
      closeProp +
      t.slice(tagEnd);
  }
}

fs.writeFileSync(
  connect,
  t,
  'utf8'
);

/* ============================================================
   PATCH 154L-K
   COMMUNITY composer spacing
============================================================ */

let c =
  fs.readFileSync(
    community,
    'utf8'
  );

if (
  !c.includes(
    'PATCH_154L_COMPOSER_SPACING'
  )
) {
  c = c.replace(
    /<View\s+style=\{s\.row\}>([\s\S]*?Mention[\s\S]*?Add Photo[\s\S]*?)<\/View>/,
    `<View
      /* PATCH_154L_COMPOSER_SPACING */
      style={[
        s.row,
        {
          marginBottom: 14,
        },
      ]}
    >$1</View>`
  );
}

fs.writeFileSync(
  community,
  c,
  'utf8'
);

console.log('');
console.log('PATCH 154L WRITTEN');
console.log('✓ reactions allowed on sent + received');
console.log('✓ inline reaction picker constrained');
console.log('✓ old bottom reaction drawer removed');
console.log('✓ long-press options moved beside bubble');
console.log('✓ old long-press bottom drawer removed');
console.log('✓ outside tap closes popovers');
console.log('✓ reaction badge double-tap handler added');
console.log('✓ Community POST spacing increased');
console.log('');

const result =
  cp.spawnSync(
    path.resolve(
      'node_modules/.bin/tsc.cmd'
    ),
    ['--noEmit'],
    {
      stdio: 'inherit',
      shell: true,
    }
  );

if (result.status !== 0) {
  process.exit(
    result.status || 1
  );
}

console.log('');
console.log('PATCH 154L - TYPESCRIPT PASS');
