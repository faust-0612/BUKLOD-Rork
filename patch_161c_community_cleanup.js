const fs = require("fs");

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function write(path, src) {
  fs.writeFileSync(path, src, "utf8");
}

function stop(message) {
  console.error("");
  console.error("PATCH 161C STOPPED:");
  console.error(message);
  process.exit(1);
}


/* ============================================================
   A. COMMUNITY SCREEN
   ============================================================ */

{
  const path =
    "./src/app/(tabs)/buklod.tsx";

  let src =
    read(path);


  if (
    src.includes(
      "PATCH_161C_COMMUNITY_TOP_NAV"
    )
  ) {
    stop(
      "PATCH 161C already appears to be applied."
    );
  }


  /* ----------------------------------------------------------
     1. Audience drawer state
     ---------------------------------------------------------- */

  const audienceState =
    /const\s+\[audience,setAudience\]=useState<Audience>\('group'\),\[feedFilter,setFeedFilter\]=useState<FeedFilter>\('all'\);/;


  if (
    !audienceState.test(src)
  ) {
    stop(
      "Community audience state anchor not found."
    );
  }


  src =
    src.replace(
      audienceState,
`const [audience,setAudience]=useState<Audience>('group'),[feedFilter,setFeedFilter]=useState<FeedFilter>('all');

 const [audienceOpen,setAudienceOpen]=useState(false);`
    );


  /* ----------------------------------------------------------
     2. Remove old audience instructions + category selector.
        Keep internal category value for DB compatibility.
     ---------------------------------------------------------- */

  const oldComposerTop =
    /<Text style=\{s\.label\}>WHO CAN SEE THIS\?<\/Text><View style=\{s\.wrap\}>\{\(\['group','local','public'\] as Audience\[\]\)\.map\(a=><Pressable[\s\S]*?\{HELP\[audience\]\}<\/Text>\s*<View style=\{\[s\.wrap,\{marginTop:10\}\]\}>\{CATEGORIES\.map\([\s\S]*?<\/View>/;


  if (
    !oldComposerTop.test(src)
  ) {
    stop(
      "Old Community audience/category UI anchor not found."
    );
  }


  src =
    src.replace(
      oldComposerTop,
`<Text style={s.label}>AUDIENCE</Text>

    <Pressable
      onPress={()=>setAudienceOpen(true)}
      style={s.audiencePicker}
    >
      <View style={s.audiencePickerIcon}>
        <MaterialCommunityIcons
          name={
            audience==='group'
              ? 'account-group-outline'
              : audience==='local'
              ? 'church'
              : 'earth'
          }
          size={19}
          color={colors.greenDark}
        />
      </View>

      <View style={{flex:1}}>
        <Text style={s.audiencePickerTitle}>
          {audience==='group'
            ? 'BUKLOD CLUSTER'
            : audience==='local'
            ? 'LOCAL CHURCH'
            : 'PUBLIC'}
        </Text>

        <Text style={s.audiencePickerSub}>
          Tap to change who can see this post
        </Text>
      </View>

      <MaterialCommunityIcons
        name="chevron-down"
        size={22}
        color={colors.muted}
      />
    </Pressable>`
    );


  /* ----------------------------------------------------------
     3. Top Community / Reels navigation
     ---------------------------------------------------------- */

  const oldHeader =
`<Text style={s.eyebrow}>BUKLOD COMMUNITY</Text><Text style={shared.h1}>Community</Text><Text style={shared.muted}>Encourage, connect and grow together.</Text>`;


  if (
    !src.includes(oldHeader)
  ) {
    stop(
      "Community header anchor not found."
    );
  }


  src =
    src.replace(
      oldHeader,
`{/* PATCH_161C_COMMUNITY_TOP_NAV */}
    <View style={s.buklodModeTabs}>

      <View
        style={[
          s.buklodModeTab,
          s.buklodModeTabOn,
        ]}
      >
        <MaterialCommunityIcons
          name="account-group-outline"
          size={18}
          color="#FFFFFF"
        />

        <Text style={s.buklodModeTextOn}>
          BUKLOD COMMUNITY
        </Text>
      </View>


      <Pressable
        onPress={() =>
          router.push('/reels' as any)
        }
        style={s.buklodModeTab}
      >
        <MaterialCommunityIcons
          name="movie-play-outline"
          size={18}
          color={colors.greenDark}
        />

        <Text style={s.buklodModeText}>
          BUKLOD REELS
        </Text>
      </Pressable>

    </View>

    <Text style={shared.h1}>
      Community
    </Text>

    <Text style={shared.muted}>
      Encourage, connect and grow together.
    </Text>`
    );


  /* ----------------------------------------------------------
     4. Remove old shortcut cards:
        Reels + BUKLOD 106/107
     ---------------------------------------------------------- */

  const shortcuts =
    /\s*\{\/\*\s*PATCH_155BC_COMMUNITY_SHORTCUTS\s*\*\/\}\s*<View style=\{\{flexDirection:'row',gap:8,marginBottom:12\}\}>[\s\S]*?<\/View>\s*(?=<SectionTitle>COMMUNITY POSTS<\/SectionTitle>)/;


  if (
    shortcuts.test(src)
  ) {
    src =
      src.replace(
        shortcuts,
        "\n    "
      );
  }


  /* ----------------------------------------------------------
     5. Remove category labels from feed metadata.
     ---------------------------------------------------------- */

  src =
    src.replace(
`{String(item.audience||'group').toUpperCase()} | {String(item.category||'').replace('_',' ')} | {formatSpecificDateTime(item.created_at)}`,
`{String(item.audience||'group').toUpperCase()}  ?  {formatSpecificDateTime(item.created_at)}`
    );


  /* ----------------------------------------------------------
     6. Community must not show Reels/video posts.
        Reels stay in dedicated BUKLOD Reels.
     ---------------------------------------------------------- */

  src =
    src.replace(
      /data=\{posts\}/,
`data={posts.filter(
    p =>
      String(
        p?.category ?? ''
      ).toLowerCase() !== 'reel'
      &&
      !String(
        p?.media_mime_type ?? ''
      ).toLowerCase().startsWith('video/')
  )}`
    );


  /* ----------------------------------------------------------
     7. Audience drawer modal
     Insert before Mention Members modal.
     ---------------------------------------------------------- */

  const mentionModal =
    /<Modal visible=\{mentionOpen\}/;


  if (
    !mentionModal.test(src)
  ) {
    stop(
      "Mention modal anchor not found."
    );
  }


  const audienceModal =
`{/* PATCH_161C_AUDIENCE_DRAWER */}
 <Modal
  visible={audienceOpen}
  transparent
  animationType="slide"
  onRequestClose={()=>setAudienceOpen(false)}
 >
  <View style={s.overlay}>

   <Pressable
    style={{flex:1}}
    onPress={()=>setAudienceOpen(false)}
   />

   <View style={s.audienceDrawer}>

    <View style={s.drawerHandle}/>

    <Text style={s.drawerTitle}>
     Choose Audience
    </Text>

    {(
     [
      {
       key:'group',
       title:'BUKLOD Cluster',
       sub:'Members of your active BUKLOD Cluster',
       icon:'account-group-outline'
      },
      {
       key:'local',
       title:'Local Church',
       sub:'Verified members of your Local Church',
       icon:'church'
      },
      {
       key:'public',
       title:'Public',
       sub:'All verified BUKLOD app members',
       icon:'earth'
      },
     ] as const
    ).map(item=>{

     const disabled=
      item.key==='group' &&
      !group?.id;

     const active=
      audience===item.key;

     return (
      <Pressable
       key={item.key}
       disabled={disabled}
       onPress={()=>{
        setAudience(
         item.key as Audience
        );
        setMentions([]);
        setAudienceOpen(false);
       }}
       style={[
        s.audienceOption,
        active&&s.audienceOptionOn,
        disabled&&{opacity:.35}
       ]}
      >

       <View
        style={[
         s.audienceOptionIcon,
         active&&s.audienceOptionIconOn
        ]}
       >
        <MaterialCommunityIcons
         name={item.icon}
         size={22}
         color={
          active
           ? '#FFFFFF'
           : colors.greenDark
         }
        />
       </View>

       <View style={{flex:1}}>
        <Text
         style={[
          s.audienceOptionTitle,
          active&&{
           color:colors.greenDark
          }
         ]}
        >
         {item.title}
        </Text>

        <Text style={s.audienceOptionSub}>
         {item.sub}
        </Text>
       </View>

       {active&&(
        <MaterialCommunityIcons
         name="check-circle"
         size={22}
         color={colors.green}
        />
       )}

      </Pressable>
     );
    })}

   </View>
  </View>
 </Modal>

 `;


  src =
    src.replace(
      mentionModal,
      audienceModal +
      "<Modal visible={mentionOpen}"
    );


  /* ----------------------------------------------------------
     8. Wider feed / larger photos
     ---------------------------------------------------------- */

  src =
    src.replace(
      /content:\{padding:16,paddingBottom:50\}/,
      "content:{paddingHorizontal:8,paddingTop:12,paddingBottom:50}"
    );


  src =
    src.replace(
      /postImage:\{width:'100%',height:\d+/,
      "postImage:{width:'100%',height:360"
    );


  /* ----------------------------------------------------------
     9. Add 161C styles before end of stylesheet.
     ---------------------------------------------------------- */

  const styleEnd =
    src.lastIndexOf("});");


  if (
    styleEnd < 0
  ) {
    stop(
      "Community stylesheet end not found."
    );
  }


  const newStyles =
`,

 buklodModeTabs:{
  flexDirection:'row',
  gap:7,
  marginBottom:14,
  padding:4,
  borderRadius:16,
  backgroundColor:'#EDF3EF'
 },

 buklodModeTab:{
  flex:1,
  minHeight:43,
  paddingHorizontal:8,
  borderRadius:13,
  flexDirection:'row',
  alignItems:'center',
  justifyContent:'center',
  gap:6
 },

 buklodModeTabOn:{
  backgroundColor:colors.greenDark
 },

 buklodModeText:{
  fontSize:9.5,
  fontWeight:'900',
  color:colors.greenDark
 },

 buklodModeTextOn:{
  fontSize:9.5,
  fontWeight:'900',
  color:'#FFFFFF'
 },

 audiencePicker:{
  minHeight:58,
  borderRadius:14,
  borderWidth:1,
  borderColor:colors.line,
  backgroundColor:'#F7FAF8',
  paddingHorizontal:11,
  flexDirection:'row',
  alignItems:'center',
  gap:9
 },

 audiencePickerIcon:{
  width:38,
  height:38,
  borderRadius:19,
  backgroundColor:'#E4F0E7',
  alignItems:'center',
  justifyContent:'center'
 },

 audiencePickerTitle:{
  fontSize:11,
  fontWeight:'900',
  color:colors.text
 },

 audiencePickerSub:{
  marginTop:2,
  fontSize:9,
  color:colors.muted
 },

 audienceDrawer:{
  paddingHorizontal:14,
  paddingTop:8,
  paddingBottom:24,
  borderTopLeftRadius:24,
  borderTopRightRadius:24,
  backgroundColor:'#FFFFFF'
 },

 drawerHandle:{
  width:42,
  height:4,
  borderRadius:3,
  alignSelf:'center',
  marginBottom:12,
  backgroundColor:'#CFD8D2'
 },

 audienceOption:{
  minHeight:68,
  padding:10,
  marginTop:8,
  borderRadius:14,
  borderWidth:1,
  borderColor:colors.line,
  flexDirection:'row',
  alignItems:'center',
  gap:10,
  backgroundColor:'#FFFFFF'
 },

 audienceOptionOn:{
  borderColor:'#A8CBB3',
  backgroundColor:'#F0F7F2'
 },

 audienceOptionIcon:{
  width:42,
  height:42,
  borderRadius:21,
  alignItems:'center',
  justifyContent:'center',
  backgroundColor:'#E9F1EB'
 },

 audienceOptionIconOn:{
  backgroundColor:colors.greenDark
 },

 audienceOptionTitle:{
  fontSize:12,
  fontWeight:'900',
  color:colors.text
 },

 audienceOptionSub:{
  marginTop:3,
  fontSize:9.5,
  lineHeight:13,
  color:colors.muted
 }`;


  src =
    src.slice(
      0,
      styleEnd
    ) +
    newStyles +
    "\n" +
    src.slice(
      styleEnd
    );


  write(
    path,
    src
  );


  console.log(
    "COMMUNITY CLEANUP INSTALLED"
  );

  console.log(
    "COMMUNITY / REELS TOP NAV INSTALLED"
  );

  console.log(
    "AUDIENCE DRAWER INSTALLED"
  );

  console.log(
    "OLD COMMUNITY SHORTCUTS REMOVED"
  );

  console.log(
    "VISIBLE CATEGORY SELECTOR REMOVED"
  );

  console.log(
    "REELS REMOVED FROM COMMUNITY WALL"
  );
}


/* ============================================================
   B. POST DETAIL - COMMENTS + REPLIES
   ============================================================ */

{
  const path =
    "./src/app/post/[id].tsx";

  let src =
    read(path);


  /* ----------------------------------------------------------
     1. Use V4 comment loader
     ---------------------------------------------------------- */

  src =
    src.replace(
      /get_buklod_post_comments_v3/g,
      "get_buklod_post_comments_v4"
    );


  /* ----------------------------------------------------------
     2. Reply state
     ---------------------------------------------------------- */

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
`const [comment,setComment]=useState(''),[busy,setBusy]=useState(false);

 const [replyTo,setReplyTo]=
  useState<any>(null);`
    );


  /* ----------------------------------------------------------
     3. Replace old add() with reply-capable V4
     ---------------------------------------------------------- */

  const oldAdd =
    /const add=async\(\)=>\{if\(!comment\.trim\(\)\)return;setBusy\(true\);const \{error\}=await \(supabase as any\)\.rpc\('add_buklod_post_comment_v3',\{p_post_id:id,p_body:comment\.trim\(\)\}\);setBusy\(false\);if\(error\)return Alert\.alert\('Comment',error\.message\);setComment\(''\);await load\(\)\};/;


  if (
    !oldAdd.test(src)
  ) {
    /*
     * It may already have been changed to V4
     * by the global replacement above.
     */
    const afterRename =
      /const add=async\(\)=>\{if\(!comment\.trim\(\)\)return;setBusy\(true\);const \{error\}=await \(supabase as any\)\.rpc\('add_buklod_post_comment_v4',\{p_post_id:id,p_body:comment\.trim\(\)\}\);setBusy\(false\);if\(error\)return Alert\.alert\('Comment',error\.message\);setComment\(''\);await load\(\)\};/;


    if (
      !afterRename.test(src)
    ) {
      stop(
        "Post add-comment function anchor not found."
      );
    }


    src =
      src.replace(
        afterRename,
        "__PATCH_161C_OLD_ADD__"
      );
  }
  else {
    src =
      src.replace(
        oldAdd,
        "__PATCH_161C_OLD_ADD__"
      );
  }


  src =
    src.replace(
      "__PATCH_161C_OLD_ADD__",
`const add=async()=>{
  const clean=
   comment.trim();

  if(!clean)return;

  let finalBody=
   clean;

  if(replyTo){
   const mention=
    '@'+
    String(
     replyTo.commenter_name||
     'BUKLOD Member'
    );

   if(
    !finalBody
     .toLowerCase()
     .startsWith(
      mention.toLowerCase()
     )
   ){
    finalBody=
     mention+
     ' '+
     finalBody;
   }
  }

  setBusy(true);

  const {error}=
   await (
    supabase as any
   ).rpc(
    'add_buklod_post_comment_v4',
    {
     p_post_id:id,
     p_body:finalBody,
     p_parent_id:
      replyTo?.id??null
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


  /* ----------------------------------------------------------
     4. Replace old comments rendering
     ---------------------------------------------------------- */

  const oldComments =
    /<SectionTitle>COMMENTS \(\{comments\.length\}\)<\/SectionTitle>\{comments\.map\(c=><Card key=\{c\.id\}><Text style=\{s\.commentName\}>\{c\.commenter_name\} \| \{formatClusterName\(c\.cluster_name\)\}<\/Text><Text style=\{s\.commentMeta\}>\{formatSpecificDateTime\(c\.created_at\)\}<\/Text><Text style=\{s\.commentBody\}>\{c\.body\}<\/Text><\/Card>\)\}/;


  if (
    !oldComments.test(src)
  ) {
    stop(
      "Old Post comments rendering anchor not found."
    );
  }


  src =
    src.replace(
      oldComments,
`<SectionTitle>
   COMMENTS ({comments.length})
  </SectionTitle>

  {comments.map(c=>
   <View
    key={c.id}
    style={[
     s.commentCard,
     c.parent_id&&
      s.commentReply
    ]}
   >

    <View style={s.commentAuthorRow}>

     <ProfileAvatar
      userId={c.user_id}
      name={
       c.commenter_name||
       'BUKLOD Member'
      }
      size={34}
     />

     <View style={{flex:1}}>
      <Text style={s.commentName}>
       {c.commenter_name}
      </Text>

      <Text style={s.commentMeta}>
       {formatClusterName(c.cluster_name)}
       {' ? '}
       {formatSpecificDateTime(c.created_at)}
      </Text>
     </View>

    </View>


    {!!c.parent_id&&
     !!c.parent_commenter_name&&(
     <Text style={s.replyingTo}>
      Replying to @
      {c.parent_commenter_name}
     </Text>
    )}


    <Text style={s.commentBody}>
     {c.body}
    </Text>


    <Pressable
     onPress={()=>{
      setReplyTo(c);

      setComment(
       '@'+
       String(
        c.commenter_name||
        'BUKLOD Member'
       )+
       ' '
      );
     }}
     style={s.replyButton}
    >
     <MaterialCommunityIcons
      name="reply-outline"
      size={16}
      color={colors.greenDark}
     />

     <Text style={s.replyButtonText}>
      Reply
     </Text>
    </Pressable>

   </View>
  )}`
    );


  /* ----------------------------------------------------------
     5. Replace composer with reply indicator + auto mention
     ---------------------------------------------------------- */

  const oldComposer =
`<Card><Text style={s.commentName}>Add Comment</Text><TextInput value={comment} onChangeText={setComment} multiline placeholder="Write a comment..." style={s.input}/><Button title={busy?'POSTING...':'POST COMMENT'} onPress={add}/></Card>`;


  if (
    !src.includes(
      oldComposer
    )
  ) {
    stop(
      "Post comment composer anchor not found."
    );
  }


  src =
    src.replace(
      oldComposer,
`<Card>

   {!!replyTo&&(
    <View style={s.replyBanner}>
     <View style={{flex:1}}>
      <Text style={s.replyBannerTitle}>
       Replying to
      </Text>

      <Text
       style={s.replyBannerName}
       numberOfLines={1}
      >
       @{replyTo.commenter_name}
      </Text>
     </View>

     <Pressable
      onPress={()=>{
       setReplyTo(null);
       setComment('');
      }}
     >
      <MaterialCommunityIcons
       name="close-circle"
       size={21}
       color={colors.muted}
      />
     </Pressable>
    </View>
   )}


   <Text style={s.commentName}>
    {replyTo
     ? 'Add Reply'
     : 'Add Comment'}
   </Text>


   <TextInput
    value={comment}
    onChangeText={setComment}
    multiline
    placeholder={
     replyTo
      ? 'Write a reply...'
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


  /* ----------------------------------------------------------
     6. Comment/reply styles
     ---------------------------------------------------------- */

  const styleEnd =
    src.lastIndexOf("});");


  if (
    styleEnd < 0
  ) {
    stop(
      "Post stylesheet end not found."
    );
  }


  const styles =
`,

 commentCard:{
  marginBottom:9,
  padding:12,
  borderRadius:14,
  borderWidth:1,
  borderColor:colors.line,
  backgroundColor:'#FFFFFF'
 },

 commentReply:{
  marginLeft:28,
  backgroundColor:'#F2F7F3'
 },

 commentAuthorRow:{
  flexDirection:'row',
  alignItems:'center',
  gap:8
 },

 replyingTo:{
  marginTop:7,
  fontSize:9.5,
  fontWeight:'800',
  color:colors.greenDark
 },

 replyButton:{
  marginTop:8,
  alignSelf:'flex-start',
  flexDirection:'row',
  alignItems:'center',
  gap:4,
  paddingVertical:4,
  paddingRight:8
 },

 replyButtonText:{
  fontSize:9.5,
  fontWeight:'900',
  color:colors.greenDark
 },

 replyBanner:{
  marginBottom:10,
  padding:9,
  borderRadius:11,
  flexDirection:'row',
  alignItems:'center',
  gap:8,
  backgroundColor:'#EDF5EF'
 },

 replyBannerTitle:{
  fontSize:8.5,
  color:colors.muted
 },

 replyBannerName:{
  marginTop:1,
  fontSize:10.5,
  fontWeight:'900',
  color:colors.greenDark
 }`;


  src =
    src.slice(
      0,
      styleEnd
    ) +
    styles +
    "\n" +
    src.slice(
      styleEnd
    );


  write(
    path,
    src
  );


  console.log(
    "POST COMMENTS V4 INSTALLED"
  );

  console.log(
    "COMMENT REPLIES INSTALLED"
  );

  console.log(
    "AUTO-MENTION ON REPLY INSTALLED"
  );
}


console.log("");
console.log(
  "PATCH 161C FRONTEND APPLIED"
);
