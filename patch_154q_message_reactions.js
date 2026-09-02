const fs=require('fs');
const path=require('path');

const file=path.resolve('src/app/connect/[id].tsx');
const backup=file+'.bak154q';

if(!fs.existsSync(file)){
  throw new Error('connect/[id].tsx not found');
}

let t=fs.readFileSync(file,'utf8');

if(!fs.existsSync(backup)){
  fs.copyFileSync(file,backup);
}

/* ============================================================
   1. BOTH OWN + RECEIVED MESSAGES MAY SHOW REACT
============================================================ */

t=t.replace(
  /\{!m\.is_mine\s*&&\s*!m\.is_deleted\s*&&\s*\(/g,
  '{!m.is_deleted && ('
);

/* Also support formatted multiline version */
t=t.replace(
  /\{!m\.is_mine\s*\n\s*&&\s*\n?\s*!m\.is_deleted\s*\n\s*&&\s*\(/g,
  '{!m.is_deleted && ('
);

/* ============================================================
   2. CANONICAL REACTION WRAPPER
   lower-left for received
   lower-right for own
============================================================ */

const label='accessibilityLabel="React to message"';
const labelAt=t.indexOf(label);

if(labelAt<0){
  throw new Error('React button not found');
}

const cueAt=t.lastIndexOf(
  's.reactCue',
  labelAt
);

if(cueAt<0){
  throw new Error('s.reactCue not found');
}

const wrapperStart=t.lastIndexOf(
  '<View',
  cueAt
);

const wrapperEnd=t.indexOf(
  '>',
  cueAt
);

if(
  wrapperStart<0 ||
  wrapperEnd<0 ||
  wrapperEnd>labelAt
){
  throw new Error(
    'React wrapper could not be isolated'
  );
}

const canonicalWrapper=`<View
                  /* PATCH_154Q_REACT_LOWER_SIDE */
                  style={[
                    s.reactCue,
                    m.is_mine
                      ? {
                          left: undefined,
                          right: 3,
                        }
                      : {
                          right: undefined,
                          left: 3,
                        },
                  ]}
                >`;

t=
  t.slice(0,wrapperStart)+
  canonicalWrapper+
  t.slice(wrapperEnd+1);

/* ============================================================
   3. MOVE reactCue FROM CENTER TO LOWER PART
============================================================ */

const styleRx=
  /reactCue:\s*\{[\s\S]*?\},\s*(?=reactionBadge:)/;

const styleMatch=styleRx.exec(t);

if(!styleMatch){
  throw new Error(
    'reactCue StyleSheet block not found'
  );
}

const newStyle=`reactCue: {
        position: 'absolute',

        /* PATCH_154Q_LOWER_REACTION_POSITION */
        top: undefined,
        bottom: -11,

        width: 31,
        height: 31,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.line,

        alignItems: 'center',
        justifyContent: 'center',

        backgroundColor: colors.white,

        zIndex: 80,
        elevation: 8,
      },

      `;

t=t.replace(
  styleRx,
  newStyle
);

/* ============================================================
   4. SAME BUTTON BECOMES THE CHOSEN REACTION ICON
============================================================ */

const newLabelAt=t.indexOf(label);

const iconStart=t.indexOf(
  '<MaterialCommunityIcons',
  newLabelAt
);

const iconEnd=t.indexOf(
  '/>',
  iconStart
);

if(
  iconStart<0 ||
  iconEnd<0 ||
  iconStart-newLabelAt>700
){
  throw new Error(
    'Main reaction icon not found'
  );
}

let icon=t.slice(
  iconStart,
  iconEnd+2
);

icon=icon.replace(
  /name\s*=\s*(?:["']emoticon-plus-outline["']|\{\s*["']emoticon-plus-outline["']\s*\})/,
`name={
        m.reaction
          ? reactionIcon(
              m.reaction
            ) as any
          : 'emoticon-plus-outline'
      }`
);

if(
  !icon.includes(
    'reactionIcon('
  )
){
  /* If PATCH 154P already changed it, keep current icon code */
  if(
    !icon.includes(
      'm.reaction'
    )
  ){
    throw new Error(
      'Reaction icon format not recognized'
    );
  }
}

t=
  t.slice(0,iconStart)+
  icon+
  t.slice(iconEnd+2);

/* ============================================================
   5. HIDE OLD DUPLICATE REACTION BADGE
============================================================ */

const badgeStyleAt=t.indexOf(
  'reactionBadge:'
);

if(badgeStyleAt>=0){

  const badgeBrace=t.indexOf(
    '{',
    badgeStyleAt
  );

  if(
    badgeBrace>=0 &&
    !t.slice(
      badgeBrace,
      badgeBrace+180
    ).includes(
      "display: 'none'"
    )
  ){
    t=
      t.slice(
        0,
        badgeBrace+1
      )+
`
        /* PATCH_154Q_NO_DUPLICATE_REACTION_BADGE */
        display: 'none',
`+
      t.slice(
        badgeBrace+1
      );
  }
}

/* ============================================================
   6. PICKER ALWAYS GROWS INWARD
============================================================ */

const reactionOpenAt=t.indexOf(
  'reactionOpen &&',
  newLabelAt
);

const rxMapAt=t.indexOf(
  '{RX.map',
  reactionOpenAt
);

if(
  reactionOpenAt>=0 &&
  rxMapAt>reactionOpenAt
){
  const pickerViewAt=t.indexOf(
    '<View',
    reactionOpenAt
  );

  const pickerStyleAt=t.indexOf(
    'style={{',
    pickerViewAt
  );

  if(
    pickerViewAt>=0 &&
    pickerStyleAt>=0 &&
    pickerStyleAt<rxMapAt
  ){
    let depth=0;
    let i=pickerStyleAt+
      'style={{'.length;

    let end=-1;

    for(
      ;
      i<t.length-1;
      i++
    ){
      if(
        t[i]==='{' &&
        t[i+1]==='{'
      ){
        depth++;
        i++;
        continue;
      }

      if(
        t[i]==='}' &&
        t[i+1]==='}'
      ){
        if(depth===0){
          end=i+2;
          break;
        }

        depth--;
        i++;
      }
    }

    if(
      end>pickerStyleAt &&
      end<rxMapAt
    ){
      const pickerStyle=`style={{
          position: 'absolute',

          left:
            m.is_mine
              ? undefined
              : 0,

          right:
            m.is_mine
              ? 0
              : undefined,

          /* top messages open downward */
          top:
            typeof messageIndex !== 'undefined' &&
            messageIndex < 2
              ? 36
              : undefined,

          bottom:
            typeof messageIndex !== 'undefined' &&
            messageIndex < 2
              ? undefined
              : 36,

          width: 190,
          maxWidth: 190,

          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',

          gap: 2,

          paddingHorizontal: 5,
          paddingVertical: 5,

          borderRadius: 18,

          backgroundColor:
            colors.white,

          borderWidth: 1,
          borderColor:
            colors.line,

          elevation: 12,
          zIndex: 150,
        }}`;

      t=
        t.slice(
          0,
          pickerStyleAt
        )+
        pickerStyle+
        t.slice(end);
    }
  }
}

fs.writeFileSync(
  file,
  t,
  'utf8'
);

/* ============================================================
   7. DATABASE MIGRATION:
   allow either conversation participant to react
============================================================ */

const migration=path.resolve(
  'supabase/migrations/20260812014000_patch154q_any_participant_message_reactions.sql'
);

const sql=`-- PATCH 154Q
-- Any participant may react to any message in their conversation.
-- Same reaction toggles off.

create or replace function
public.set_direct_message_reaction_v1(
  p_message_id uuid,
  p_reaction text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid :=
    (select auth.uid());

  reaction_value text :=
    lower(
      trim(
        coalesce(
          p_reaction,
          ''
        )
      )
    );

  existing_reaction text;
  conversation_id_value uuid;
begin
  if actor is null then
    raise exception
      'Authentication required';
  end if;

  if reaction_value not in (
    'amen',
    'with_you',
    'praying',
    'love',
    'haha',
    'sad'
  ) then
    raise exception
      'Invalid reaction';
  end if;

  select
    dm.conversation_id
  into
    conversation_id_value
  from public.direct_messages dm
  join public.direct_conversations dc
    on dc.id =
      dm.conversation_id
  where dm.id =
      p_message_id
    and (
      dc.user_low =
        actor
      or
      dc.user_high =
        actor
    );

  if conversation_id_value is null then
    raise exception
      'Message not available';
  end if;

  select
    r.reaction
  into
    existing_reaction
  from
    public.direct_message_reactions r
  where
    r.message_id =
      p_message_id
    and
    r.user_id =
      actor
  limit 1;

  if
    existing_reaction =
      reaction_value
  then
    delete from
      public.direct_message_reactions
    where
      message_id =
        p_message_id
      and
      user_id =
        actor;

    return;
  end if;

  delete from
    public.direct_message_reactions
  where
    message_id =
      p_message_id
    and
    user_id =
      actor;

  insert into
    public.direct_message_reactions (
      message_id,
      user_id,
      reaction
    )
  values (
    p_message_id,
    actor,
    reaction_value
  );
end;
$$;

revoke all on function
public.set_direct_message_reaction_v1(
  uuid,
  text
)
from public;

grant execute on function
public.set_direct_message_reaction_v1(
  uuid,
  text
)
to authenticated;

comment on function
public.set_direct_message_reaction_v1(
  uuid,
  text
)
is
'Allows either participant in a BUKLOD Connect conversation to add, change, or toggle their own reaction on any message.';
`;

fs.writeFileSync(
  migration,
  sql,
  'utf8'
);

console.log('');
console.log('PATCH 154Q WRITTEN');
console.log('✓ own messages can show React');
console.log('✓ received messages can show React');
console.log('✓ React icon moved to lower corner');
console.log('✓ left bubble = lower-left');
console.log('✓ right bubble = lower-right');
console.log('✓ selected reaction replaces generic icon');
console.log('✓ duplicate reaction badge hidden');
console.log('✓ DB migration created for own-message reactions');
console.log('');
