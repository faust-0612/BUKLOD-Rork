const fs = require('fs');
const path = require('path');

const file = path.resolve('src/app/connect/[id].tsx');
const backup = file + '.bak154l_v2';

if (!fs.existsSync(file)) {
  throw new Error('connect/[id].tsx not found');
}

let t = fs.readFileSync(file, 'utf8');

if (!fs.existsSync(backup)) {
  fs.copyFileSync(file, backup);
}

/* ============================================================
   PRECHECK
============================================================ */

if (!t.includes('accessibilityLabel="React to message"')) {
  throw new Error('Reaction cue not found');
}

if (!t.includes('{/* MESSAGE LONG-PRESS DRAWER */}')) {
  throw new Error('Long-press drawer not found');
}

if (!t.includes('{/* FORWARD DRAWER */}')) {
  throw new Error('Forward drawer anchor not found');
}

if (!t.includes('s.reactionBadge')) {
  throw new Error('Reaction badge not found');
}

/* ============================================================
   A. ROOT TAP = CLOSE OPEN POPOVERS

   Exact KeyboardAvoidingView anchor only.
============================================================ */

if (!t.includes('PATCH_154L_V2_OUTSIDE_TAP')) {
  const oldRoot =
`<KeyboardAvoidingView
      style={s.screen}`;

  const newRoot =
`<KeyboardAvoidingView
      style={s.screen}
      /* PATCH_154L_V2_OUTSIDE_TAP */
      onTouchStart={() => {
        if (reactionOpen || actionOpen) {
          setReactionOpen(false);
          setActionOpen(false);
          setSelected(null);
        }
      }}`;

  if (!t.includes(oldRoot)) {
    throw new Error('KeyboardAvoidingView exact anchor not found');
  }

  t = t.replace(oldRoot, newRoot);
}

/* ============================================================
   B. SELECTED MESSAGE WRAPPER GETS HIGH Z-INDEX
============================================================ */

if (!t.includes('PATCH_154L_V2_SELECTED_Z')) {
  const mapStart = t.indexOf('{messages.map(');
  const wrapAt = t.indexOf('s.messageWrap,', mapStart);

  if (mapStart < 0 || wrapAt < 0) {
    throw new Error('Message wrapper anchor not found');
  }

  const end = wrapAt + 's.messageWrap,'.length;

  t =
    t.slice(0, end) +
`
                /* PATCH_154L_V2_SELECTED_Z */
                ((actionOpen || reactionOpen) &&
                  selected?.message_id === m.message_id)
                  ? {
                      zIndex: 200,
                      elevation: 20,
                    }
                  : null,
` +
    t.slice(end);
}

/* ============================================================
   C. INLINE LONG-PRESS MESSAGE OPTIONS

   Same existing actions:
   Reply
   Forward
   Edit (own)
   Delete for Me
   Delete for Everyone (own)

   React intentionally NOT here anymore.
============================================================ */

if (!t.includes('PATCH_154L_V2_INLINE_OPTIONS')) {
  const oldCueRx =
    /\{!m\.is_mine\s*&&\s*!m\.is_deleted\s*&&\s*\(\s*<View style=\{s\.reactCue\}>/;

  const match = oldCueRx.exec(t);

  if (!match) {
    throw new Error('Received-only reaction cue anchor not found');
  }

  const menu =
`
              {/* PATCH_154L_V2_INLINE_OPTIONS */}
              {actionOpen &&
                selected?.message_id === m.message_id && (
                  <View
                    onTouchStart={(e) =>
                      e.stopPropagation()
                    }
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left:
                        m.is_mine
                          ? undefined
                          : 0,
                      right:
                        m.is_mine
                          ? 0
                          : undefined,
                      marginTop: 5,
                      width: 218,
                      padding: 7,
                      borderRadius: 15,
                      borderWidth: 1,
                      borderColor: colors.line,
                      backgroundColor: colors.white,
                      zIndex: 250,
                      elevation: 15,
                    }}
                  >
                    <Text
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 5,
                        fontSize: 9,
                        fontWeight: '900',
                        color: colors.greenDark,
                        letterSpacing: 0.7,
                      }}
                    >
                      MESSAGE OPTIONS
                    </Text>

                    <Pressable
                      style={s.action}
                      onPress={(e) => {
                        e.stopPropagation();
                        setActionOpen(false);
                        startReply(m);
                      }}
                    >
                      <MaterialCommunityIcons
                        name="reply-outline"
                        size={20}
                        color={colors.greenDark}
                      />
                      <Text style={s.actionText}>
                        Reply
                      </Text>
                    </Pressable>

                    <Pressable
                      style={s.action}
                      onPress={(e) => {
                        e.stopPropagation();
                        setActionOpen(false);
                        openForward(m);
                      }}
                    >
                      <MaterialCommunityIcons
                        name="share-outline"
                        size={20}
                        color={colors.greenDark}
                      />
                      <Text style={s.actionText}>
                        Forward
                      </Text>
                    </Pressable>

                    {m.is_mine && (
                      <Pressable
                        style={s.action}
                        onPress={(e) => {
                          e.stopPropagation();
                          setActionOpen(false);
                          startEdit(m);
                        }}
                      >
                        <MaterialCommunityIcons
                          name="pencil-outline"
                          size={20}
                          color={colors.greenDark}
                        />
                        <Text style={s.actionText}>
                          Edit
                        </Text>
                      </Pressable>
                    )}

                    <Pressable
                      style={s.action}
                      onPress={(e) => {
                        e.stopPropagation();
                        setActionOpen(false);
                        hideMessage(m);
                      }}
                    >
                      <MaterialCommunityIcons
                        name="eye-off-outline"
                        size={20}
                        color={colors.greenDark}
                      />
                      <Text style={s.actionText}>
                        Delete for Me
                      </Text>
                    </Pressable>

                    {m.is_mine && (
                      <Pressable
                        style={[
                          s.action,
                          s.dangerAction,
                        ]}
                        onPress={(e) => {
                          e.stopPropagation();
                          setActionOpen(false);
                          deleteForEveryone(m);
                        }}
                      >
                        <MaterialCommunityIcons
                          name="delete-outline"
                          size={20}
                          color="#A32626"
                        />
                        <Text style={s.dangerText}>
                          Delete for Everyone
                        </Text>
                      </Pressable>
                    )}
                  </View>
                )}

`;

  t =
    t.slice(0, match.index) +
    menu +
    t.slice(match.index);
}

/* ============================================================
   D. REACTION ICON FOR BOTH OWN + RECEIVED MESSAGES
============================================================ */

const oldCueRx =
  /\{!m\.is_mine\s*&&\s*!m\.is_deleted\s*&&\s*\(\s*<View style=\{s\.reactCue\}>/;

if (oldCueRx.test(t)) {
  t = t.replace(
    oldCueRx,
`{!m.is_deleted && (
                  <View
                    onTouchStart={(e) =>
                      e.stopPropagation()
                    }
                    style={[
                      s.reactCue,
                      m.is_mine && {
                        right: undefined,
                        left: -35,
                      },
                    ]}
                  >`
  );
}

/* ============================================================
   E. KEEP REACTION PICKER INSIDE SCREEN

   Received bubble:
     picker grows LEFT

   Own bubble:
     picker grows RIGHT

   Also wraps if many reaction icons.
============================================================ */

const cueLabel =
  t.indexOf('accessibilityLabel="React to message"');

const badgeAnchor =
  t.indexOf('{!!m.reaction', cueLabel);

if (cueLabel < 0 || badgeAnchor < 0) {
  throw new Error('Reaction picker range not found');
}

let cue =
  t.slice(cueLabel, badgeAnchor);

cue = cue.replace(
  /<View\s*\n\s*style=\{\{\s*\n\s*position:\s*'absolute',/,
`<View
        onTouchStart={(e) =>
          e.stopPropagation()
        }
        style={{
          position: 'absolute',`
);

cue = cue.replace(
  /right:\s*0,\s*bottom:\s*38,\s*flexDirection:\s*'row',/,
`left:
            m.is_mine
              ? 0
              : undefined,
          right:
            m.is_mine
              ? undefined
              : 0,
          bottom: 38,
          width: 190,
          maxWidth: 190,
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',`
);

cue = cue
  .replace(
    /gap:\s*4,/,
    'gap: 2,'
  )
  .replace(
    /paddingHorizontal:\s*7,/,
    'paddingHorizontal: 5,'
  )
  .replace(
    /paddingVertical:\s*6,/,
    'paddingVertical: 5,'
  );

t =
  t.slice(0, cueLabel) +
  cue +
  t.slice(badgeAnchor);

/* ============================================================
   F. DOUBLE-TAP CURRENT REACTION BADGE = REMOVE/TOGGLE

   Existing m.reaction is used.
============================================================ */

if (!t.includes('PATCH_154L_V2_BADGE_TAP_STATE')) {
  const styleAnchor =
    t.lastIndexOf('const s =');

  if (styleAnchor < 0) {
    throw new Error('StyleSheet anchor not found');
  }

  const tapState =
`
/* PATCH_154L_V2_BADGE_TAP_STATE */
const lastReactionBadgeTap = {
  messageId: '',
  at: 0,
};

`;

  t =
    t.slice(0, styleAnchor) +
    tapState +
    t.slice(styleAnchor);
}

if (!t.includes('PATCH_154L_V2_DOUBLE_TAP_BADGE')) {
  const badgeStyle =
    t.indexOf('s.reactionBadge');

  if (badgeStyle < 0) {
    throw new Error('reactionBadge usage missing');
  }

  const openStart =
    t.lastIndexOf('<View', badgeStyle);

  const openEnd =
    t.indexOf('>', badgeStyle) + 1;

  const closeStart =
    t.indexOf('</View>', badgeStyle);

  if (
    openStart < 0 ||
    openEnd <= openStart ||
    closeStart <= openEnd
  ) {
    throw new Error('Could not isolate reaction badge');
  }

  const oldOpening =
    t.slice(openStart, openEnd);

  const newOpening =
    oldOpening.replace(
      '<View',
`<Pressable
                    /* PATCH_154L_V2_DOUBLE_TAP_BADGE */
                    accessibilityLabel="Double tap reaction to remove"
                    onTouchStart={(e) =>
                      e.stopPropagation()
                    }
                    onPress={() => {
                      const now = Date.now();

                      if (
                        lastReactionBadgeTap.messageId ===
                          m.message_id &&
                        now -
                          lastReactionBadgeTap.at <=
                          360
                      ) {
                        lastReactionBadgeTap.messageId =
                          '';
                        lastReactionBadgeTap.at = 0;

                        void (async () => {
                          const {
                            error,
                          } =
                            await (
                              supabase as any
                            ).rpc(
                              'set_direct_message_reaction_v1',
                              {
                                p_message_id:
                                  m.message_id,
                                p_reaction:
                                  m.reaction,
                              }
                            );

                          if (error) {
                            Alert.alert(
                              'Reaction',
                              error.message
                            );
                            return;
                          }

                          await load();
                        })();
                      } else {
                        lastReactionBadgeTap.messageId =
                          m.message_id;
                        lastReactionBadgeTap.at =
                          now;
                      }
                    }}`
    );

  t =
    t.slice(0, openStart) +
    newOpening +
    t.slice(openEnd, closeStart) +
    '</Pressable>' +
    t.slice(
      closeStart +
        '</View>'.length
    );
}

/* ============================================================
   G. REMOVE OLD BOTTOM LONG-PRESS DRAWER ENTIRELY

   Forward drawer remains.
============================================================ */

const beforeRemove = t;

t = t.replace(
  /\s*\{\/\*\s*MESSAGE LONG-PRESS DRAWER\s*\*\/\}[\s\S]*?(?=\s*\{\/\*\s*FORWARD DRAWER\s*\*\/\})/,
  '\n\n'
);

if (t === beforeRemove) {
  throw new Error(
    'Old long-press bottom drawer was not removed'
  );
}

/* ============================================================
   FINAL SAFETY
============================================================ */

if (
  t.includes(
    'MESSAGE LONG-PRESS DRAWER'
  )
) {
  throw new Error(
    'Old long-press drawer still exists'
  );
}

if (
  !t.includes(
    'PATCH_154L_V2_INLINE_OPTIONS'
  )
) {
  throw new Error(
    'Inline message options missing'
  );
}

fs.writeFileSync(file, t, 'utf8');

console.log('');
console.log('PATCH 154L-V2 WRITTEN');
console.log('✓ own + received messages can show React');
console.log('✓ reaction picker constrained/wrapped');
console.log('✓ long-press menu beside message');
console.log('✓ React removed from long-press menu');
console.log('✓ bottom Message Options drawer removed');
console.log('✓ tap outside closes popovers');
console.log('✓ double-tap reaction badge toggles reaction');
console.log('');
