const fs = require("fs");

function read(path) {
  return fs.readFileSync(
    path,
    "utf8"
  );
}

function write(path, source) {
  fs.writeFileSync(
    path,
    source,
    "utf8"
  );
}

function stop(message) {
  console.error("");
  console.error(
    "PATCH 161A STOPPED:"
  );
  console.error(message);
  process.exit(1);
}


/* ============================================================
   A. COMMUNITY
   ============================================================ */

{
  const path =
    "./src/app/(tabs)/buklod.tsx";

  let src =
    read(path);


  if (
    !src.includes(
      "PATCH_161A_COMMUNITY_COMPACT"
    )
  ) {

    /* --------------------------------------------
       Audience drawer state
       -------------------------------------------- */

    const mentionState =
      /const\s*\[\s*mentionOpen[\s\S]{0,400}?setMentions\]\s*=\s*useState<Mention\[\]>\(\[\]\);/m;

    const stateMatch =
      src.match(
        mentionState
      );

    if (!stateMatch) {
      stop(
        "Community mention state anchor not found."
      );
    }

    src =
      src.replace(
        stateMatch[0],
`${stateMatch[0]}

 const [
   audienceOpen,
   setAudienceOpen
 ] = useState(false);`
      );


    /* --------------------------------------------
       Two main buttons:
       BUKLOD COMMUNITY | BUKLOD REELS
       -------------------------------------------- */

    const intro =
`<Text style={s.eyebrow}>BUKLOD COMMUNITY</Text><Text style={shared.h1}>Community</Text><Text style={shared.muted}>Encourage, connect and grow together.</Text>`;


    if (
      !src.includes(
        intro
      )
    ) {
      stop(
        "Community intro anchor not found."
      );
    }


    src =
      src.replace(
        intro,
`{/* PATCH_161A_COMMUNITY_COMPACT */}
   <Text style={s.eyebrow}>
    BUKLOD
   </Text>

   <View
    style={{
     flexDirection:'row',
     gap:7,
     marginBottom:10
    }}
   >
    <View
     style={{
      flex:1,
      minHeight:42,
      borderRadius:12,
      backgroundColor:colors.green,
      alignItems:'center',
      justifyContent:'center'
     }}
    >
     <Text
      style={{
       fontSize:11,
       fontWeight:'900',
       color:'#FFFFFF'
      }}
     >
      BUKLOD COMMUNITY
     </Text>
    </View>

    <Pressable
     onPress={() =>
      router.push(
       '/reels' as any
      )
     }
     style={{
      flex:1,
      minHeight:42,
      borderRadius:12,
      borderWidth:1,
      borderColor:colors.green,
      backgroundColor:colors.white,
      alignItems:'center',
      justifyContent:'center'
     }}
    >
     <Text
      style={{
       fontSize:11,
       fontWeight:'900',
       color:colors.greenDark
      }}
     >
      BUKLOD REELS
     </Text>
    </Pressable>
   </View>

   <Text style={shared.muted}>
    Encourage, connect and grow together.
   </Text>`
      );


    /* --------------------------------------------
       Replace visible audience + instructions +
       categories with one drawer button.
       -------------------------------------------- */

    const composerOptions =
/<Text style=\{s\.label\}>WHO CAN SEE THIS\?<\/Text><View style=\{s\.wrap\}>\{\(\['group','local','public'\] as Audience\[\]\)\.map\(a=><Pressable[\s\S]*?\{HELP\[audience\]\}<\/Text>\s*<View style=\{\[s\.wrap,\{marginTop:10\}\]\}>\{CATEGORIES\.map\(c=><Pressable[\s\S]*?<\/View>/m;


    if (
      !composerOptions.test(src)
    ) {
      stop(
        "Community audience/category block not found."
      );
    }


    src =
      src.replace(
        composerOptions,
`<Pressable
     onPress={() =>
      setAudienceOpen(true)
     }
     style={{
      minHeight:42,
      flexDirection:'row',
      alignItems:'center',
      paddingHorizontal:12,
      borderWidth:1,
      borderColor:colors.line,
      borderRadius:12,
      backgroundColor:colors.white,
      marginBottom:3
     }}
    >
     <View style={{flex:1}}>
      <Text
       style={{
        fontSize:9,
        fontWeight:'900',
        color:colors.muted
       }}
      >
       WHO CAN SEE THIS?
      </Text>

      <Text
       style={{
        marginTop:2,
        fontSize:12,
        fontWeight:'900',
        color:colors.greenDark
       }}
      >
       {
        audience === 'group'
         ? 'CLUSTER'
         : audience.toUpperCase()
       }
      </Text>
     </View>

     <MaterialCommunityIcons
      name="chevron-down"
      size={22}
      color={colors.greenDark}
     />
    </Pressable>`
      );


    /* --------------------------------------------
       Simplify Post button
       -------------------------------------------- */

    src =
      src.replace(
        /<Button\s+title=\{busy\?'POSTING\.\.\.':`POST \$\{audience\.toUpperCase\(\)\}`\}\s+onPress=\{publish\}\s*\/>/,
`<Button
     title={
      busy
       ? 'POSTING...'
       : 'POST'
     }
     onPress={publish}
    />`
      );


    /* --------------------------------------------
       Remove old BUKLOD Reels + 106/107 shortcut
       Entire shortcut section.
       -------------------------------------------- */

    const shortcutStart =
      src.indexOf(
        "{/* PATCH_155BC_COMMUNITY_SHORTCUTS */}"
      );

    if (
      shortcutStart >= 0
    ) {
      const communityPosts =
        src.indexOf(
          "<SectionTitle>COMMUNITY POSTS</SectionTitle>",
          shortcutStart
        );

      if (
        communityPosts < 0
      ) {
        stop(
          "COMMUNITY POSTS anchor missing after shortcuts."
        );
      }

      src =
        src.slice(
          0,
          shortcutStart
        ) +
        src.slice(
          communityPosts
        );
    }


    /* --------------------------------------------
       Reels MUST NOT appear on Community wall
       -------------------------------------------- */

    src =
      src.replace(
        "data={posts}",
`data={
    posts.filter(
     (p:any) =>
      !String(
       p.media_mime_type || ''
      ).startsWith('video/')
    )
   }`
      );


    /* --------------------------------------------
       Remove category from post metadata.
       -------------------------------------------- */

    src =
      src.replace(
        /\{String\(item\.audience\|\|'group'\)\.toUpperCase\(\)\}\s*\|\s*\{String\(item\.category\|\|''\)\.replace\('_',' '\)\}\s*\|\s*\{formatSpecificDateTime\(item\.created_at\)\}/g,
`{String(
     item.audience ||
     'group'
    ).toUpperCase()}
    {' | '}
    {formatSpecificDateTime(
     item.created_at
    )}`
      );


    /* --------------------------------------------
       Wider screen usage
       -------------------------------------------- */

    src =
      src.replace(
        /content:\{padding:16,paddingBottom:50\}/,
`content:{
 paddingHorizontal:6,
 paddingTop:8,
 paddingBottom:50
}`
      );


    /* --------------------------------------------
       Add Audience Drawer before Mention drawer
       -------------------------------------------- */

    const mentionModal =
      '<Modal visible={mentionOpen}';

    const modalPos =
      src.indexOf(
        mentionModal
      );

    if (
      modalPos < 0
    ) {
      stop(
        "Mention modal anchor not found."
      );
    }


    const audienceModal =
`
 <Modal
  visible={audienceOpen}
  transparent
  animationType="slide"
  onRequestClose={() =>
   setAudienceOpen(false)
  }
 >
  <View style={s.overlay}>
   <Pressable
    style={{flex:1}}
    onPress={() =>
     setAudienceOpen(false)
    }
   />

   <View style={s.drawer}>
    <Text style={s.drawerTitle}>
     Who can see this?
    </Text>

    {(
     [
      'group',
      'local',
      'public'
     ] as Audience[]
    ).map(a => {

     const disabled =
      a === 'group' &&
      !group?.id;

     const active =
      audience === a;

     return (
      <Pressable
       key={a}
       disabled={disabled}
       onPress={() => {
        setAudience(a);
        setMentions([]);
        setAudienceOpen(false);
       }}
       style={[
        s.member,
        active && s.memberOn,
        disabled && {
         opacity:.4
        }
       ]}
      >
       <MaterialCommunityIcons
        name={
         a === 'group'
          ? 'account-group-outline'
          : a === 'local'
           ? 'church'
           : 'earth'
        }
        size={21}
        color={colors.greenDark}
       />

       <Text
        style={[
         s.memberName,
         {
          flex:1
         }
        ]}
       >
        {
         a === 'group'
          ? 'CLUSTER'
          : a.toUpperCase()
        }
       </Text>

       {active && (
        <MaterialCommunityIcons
         name="check-circle"
         size={21}
         color={colors.green}
        />
       )}
      </Pressable>
     );
    })}

    <View style={{marginTop:10}}>
     <Button
      title="CLOSE"
      outline
      onPress={() =>
       setAudienceOpen(false)
      }
     />
    </View>
   </View>
  </View>
 </Modal>


`;

    src =
      src.slice(
        0,
        modalPos
      ) +
      audienceModal +
      src.slice(
        modalPos
      );
  }


  write(
    path,
    src
  );
}


/* ============================================================
   B. COMMENT REPLIES
   ============================================================ */

{
  const path =
    "./src/app/post/[id].tsx";

  let src =
    read(path);


  if (
    !src.includes(
      "PATCH_161A_COMMENT_REPLIES"
    )
  ) {

    src =
      "/* PATCH_161A_COMMENT_REPLIES */\n" +
      src;


    /* RPC v3 -> v4 */
    src =
      src.replace(
        "'get_buklod_post_comments_v3'",
        "'get_buklod_post_comments_v4'"
      );


    /* replyTo state */
    const commentState =
`const [comment,setComment]=useState(''),[busy,setBusy]=useState(false);`;

    if (
      !src.includes(
        commentState
      )
    ) {
      stop(
        "Post comment state anchor not found."
      );
    }

    src =
      src.replace(
        commentState,
`${commentState}
 const [replyTo,setReplyTo]=useState<any>(null);`
      );


    /* Replace add comment function */
    const addRe =
/const add=async\(\)=>\{if\(!comment\.trim\(\)\)return;setBusy\(true\);const \{error\}=await \(supabase as any\)\.rpc\('add_buklod_post_comment_v3',\{p_post_id:id,p_body:comment\.trim\(\)\}\);setBusy\(false\);if\(error\)return Alert\.alert\('Comment',error\.message\);setComment\(''\);await load\(\)\};/;


    if (
      !addRe.test(src)
    ) {
      stop(
        "Post add-comment function anchor not found."
      );
    }


    src =
      src.replace(
        addRe,
`const add=async()=>{
  if(!comment.trim())return;

  setBusy(true);

  const {error}=
   await (supabase as any)
    .rpc(
     'add_buklod_post_comment_v4',
     {
      p_post_id:id,
      p_body:comment.trim(),
      p_parent_id:
       replyTo?.id ?? null
     }
    );

  setBusy(false);

  if(error){
   return Alert.alert(
    'Comment',
    error.message
   );
  }

  setComment('');
  setReplyTo(null);
  await load();
 };`
      );


    /* Comments display */
    const commentsRe =
/<SectionTitle>COMMENTS\s*\(\{comments\.length\}\)<\/SectionTitle>\{comments\.map\(c=><Card key=\{c\.id\}><Text style=\{s\.commentName\}>\{c\.commenter_name\} \| \{formatClusterName\(c\.cluster_name\)\}<\/Text><Text style=\{s\.commentMeta\}>\{(?:new Date\(c\.created_at\)\.toLocaleString\(\)|formatSpecificDateTime\(c\.created_at\))\}<\/Text><Text style=\{s\.commentBody\}>\{c\.body\}<\/Text><\/Card>\)\}/m;


    if (
      !commentsRe.test(src)
    ) {
      stop(
        "Current comments JSX anchor not found."
      );
    }


    src =
      src.replace(
        commentsRe,
`<SectionTitle>
   COMMENTS ({comments.length})
  </SectionTitle>

  {comments.map(c => (
   <View
    key={c.id}
    style={
     c.parent_id
      ? {
         marginLeft:24
        }
      : undefined
    }
   >
    <Card>
     {!!c.parent_id && (
      <Text
       style={{
        marginBottom:5,
        fontSize:9,
        fontWeight:'800',
        color:colors.greenDark
       }}
      >
       Reply to @
       {c.parent_commenter_name ||
        'BUKLOD Member'}
      </Text>
     )}

     <Text style={s.commentName}>
      {c.commenter_name}
      {' | '}
      {formatClusterName(
       c.cluster_name
      )}
     </Text>

     <Text style={s.commentMeta}>
      {formatSpecificDateTime(
       c.created_at
      )}
     </Text>

     <Text style={s.commentBody}>
      {c.body}
     </Text>

     <Pressable
      onPress={() => {
       setReplyTo(c);

       setComment(
        \`@\${c.commenter_name} \`
       );
      }}
      style={{
       alignSelf:'flex-start',
       marginTop:8,
       paddingVertical:4,
       paddingHorizontal:6
      }}
     >
      <Text
       style={{
        fontSize:10,
        fontWeight:'900',
        color:colors.greenDark
       }}
      >
       REPLY
      </Text>
     </Pressable>
    </Card>
   </View>
  ))}`
      );


    /* Composer card */
    const composerRe =
/<Card><Text style=\{s\.commentName\}>Add Comment<\/Text><TextInput value=\{comment\} onChangeText=\{setComment\} multiline placeholder="Write a comment\.\.\." style=\{s\.input\}\/><Button title=\{busy\?'POSTING\.\.\.':'POST COMMENT'\} onPress=\{add\}\/><\/Card>/m;


    if (
      !composerRe.test(src)
    ) {
      stop(
        "Comment composer anchor not found."
      );
    }


    src =
      src.replace(
        composerRe,
`<Card>
   <Text style={s.commentName}>
    {
     replyTo
      ? 'Reply to Comment'
      : 'Add Comment'
    }
   </Text>

   {!!replyTo && (
    <View
     style={{
      marginTop:8,
      padding:9,
      borderRadius:10,
      backgroundColor:colors.greenSoft,
      flexDirection:'row',
      alignItems:'center'
     }}
    >
     <Text
      numberOfLines={1}
      style={{
       flex:1,
       fontSize:10,
       fontWeight:'800',
       color:colors.greenDark
      }}
     >
      Replying to @
      {replyTo.commenter_name}
     </Text>

     <Pressable
      onPress={() => {
       setReplyTo(null);
       setComment('');
      }}
     >
      <MaterialCommunityIcons
       name="close"
       size={20}
       color={colors.greenDark}
      />
     </Pressable>
    </View>
   )}

   <TextInput
    value={comment}
    onChangeText={setComment}
    multiline
    placeholder={
     replyTo
      ? \`Reply to @\${replyTo.commenter_name}...\`
      : 'Write a comment...'
    }
    style={s.input}
   />

   <Button
    title={
     busy
      ? 'POSTING...'
      : replyTo
       ? 'POST REPLY'
       : 'POST COMMENT'
    }
    onPress={add}
   />
  </Card>`
      );
  }


  write(
    path,
    src
  );
}


console.log("");
console.log(
  "PATCH 161A FRONTEND APPLIED"
);
