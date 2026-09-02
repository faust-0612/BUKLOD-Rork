const fs = require('fs');
const path = require('path');

const layoutFile = path.resolve('src/app/(tabs)/_layout.tsx');
const connectFile = path.resolve('src/app/connect/[id].tsx');
const communityFile = path.resolve('src/app/(tabs)/buklod.tsx');
const postFile = path.resolve('src/app/post/[id].tsx');

const files = [
  layoutFile,
  connectFile,
  communityFile,
  postFile,
];

for (const f of files) {
  if (!fs.existsSync(f)) {
    throw new Error(`Missing file: ${f}`);
  }

  const bak = f + '.bak154n';

  if (!fs.existsSync(bak)) {
    fs.copyFileSync(f, bak);
  }
}

function escapeRx(value) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );
}

function ensureNamedImport(
  text,
  moduleName,
  importName
) {
  const safe =
    escapeRx(moduleName);

  const rx =
    new RegExp(
      `import\\s*\\{([\\s\\S]*?)\\}\\s*from\\s*['"]${safe}['"];?`
    );

  const match = rx.exec(text);

  if (!match) {
    return (
      `import { ${importName} } from '${moduleName}';\n` +
      text
    );
  }

  const names =
    match[1]
      .split(',')
      .map(x => x.trim())
      .filter(Boolean);

  if (names.includes(importName)) {
    return text;
  }

  names.push(importName);

  const replacement =
    `import {\n  ${names.join(',\n  ')},\n} from '${moduleName}';`;

  return (
    text.slice(0, match.index) +
    replacement +
    text.slice(
      match.index +
        match[0].length
    )
  );
}

/* ============================================================
   1. MAIN TAB SWIPE NAVIGATION
============================================================ */

{
  let t =
    fs.readFileSync(
      layoutFile,
      'utf8'
    );

  t = ensureNamedImport(
    t,
    'react',
    'useMemo'
  );

  t = ensureNamedImport(
    t,
    'react-native',
    'PanResponder'
  );

  t = ensureNamedImport(
    t,
    'expo-router',
    'usePathname'
  );

  t = ensureNamedImport(
    t,
    'expo-router',
    'router'
  );

  if (
    !t.includes(
      'PATCH_154N_SWIPE_TABS'
    )
  ) {
    const insetsRx =
      /const\s+insets\s*=\s*useSafeAreaInsets\(\);/;

    const insetsMatch =
      insetsRx.exec(t);

    if (!insetsMatch) {
      throw new Error(
        'TabsLayout insets anchor not found'
      );
    }

    const insertAt =
      insetsMatch.index +
      insetsMatch[0].length;

    const swipeCode = `

  /* PATCH_154N_SWIPE_TABS */
  const pathname =
    usePathname();

  const swipeResponder =
    useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponder:
            () => false,

          onMoveShouldSetPanResponder:
            (_, gesture) => {
              const horizontal =
                Math.abs(
                  gesture.dx
                );

              const vertical =
                Math.abs(
                  gesture.dy
                );

              return (
                horizontal > 38 &&
                horizontal >
                  vertical * 1.55
              );
            },

          onPanResponderTerminationRequest:
            () => true,

          onShouldBlockNativeResponder:
            () => false,

          onPanResponderRelease:
            (_, gesture) => {
              const distance =
                Math.abs(
                  gesture.dx
                );

              const velocity =
                Math.abs(
                  gesture.vx
                );

              if (
                distance < 72 &&
                velocity < 0.55
              ) {
                return;
              }

              const routes = [
                '/home',
                '/messages',
                '/learn',
                '/buklod',
                '/prayer',
                '/me',
              ];

              const current =
                routes.indexOf(
                  pathname
                );

              if (current < 0) {
                return;
              }

              const direction =
                gesture.dx < 0
                  ? 1
                  : -1;

              const nextIndex =
                current +
                direction;

              if (
                nextIndex < 0 ||
                nextIndex >=
                  routes.length
              ) {
                return;
              }

              router.navigate(
                routes[
                  nextIndex
                ] as any
              );
            },
        }),
      [pathname]
    );
`;

    t =
      t.slice(0, insertAt) +
      swipeCode +
      t.slice(insertAt);

    const tabsStart =
      t.indexOf(
        '<Tabs',
        insertAt
      );

    if (tabsStart < 0) {
      throw new Error(
        'Tabs opening tag not found'
      );
    }

    t =
      t.slice(
        0,
        tabsStart
      ) +
      `<View
      style={{ flex: 1 }}
      {...swipeResponder.panHandlers}
    >
      ` +
      t.slice(
        tabsStart
      );

    const tabsEnd =
      t.indexOf(
        '</Tabs>',
        tabsStart
      );

    if (tabsEnd < 0) {
      throw new Error(
        'Tabs closing tag not found'
      );
    }

    const afterTabs =
      tabsEnd +
      '</Tabs>'.length;

    t =
      t.slice(
        0,
        afterTabs
      ) +
      `
    </View>` +
      t.slice(
        afterTabs
      );
  }

  fs.writeFileSync(
    layoutFile,
    t,
    'utf8'
  );

  console.log(
    '✓ Main tabs: horizontal swipe enabled'
  );
}

/* ============================================================
   2. MESSAGES
   - stable photo URLs
   - optimistic reactions
   - screen-safe reaction picker
============================================================ */

{
  let t =
    fs.readFileSync(
      connectFile,
      'utf8'
    );

  /* ---------------------------------
     MEDIA URL CACHE
  --------------------------------- */

  if (
    !t.includes(
      'messageMediaUrlCacheRef'
    )
  ) {
    const refRx =
      /const\s+ref\s*=\s*useRef<ScrollView\s*\|\s*null>\([\s\S]*?\);/;

    const refMatch =
      refRx.exec(t);

    if (!refMatch) {
      throw new Error(
        'Messages ScrollView ref anchor not found'
      );
    }

    const at =
      refMatch.index +
      refMatch[0].length;

    const cacheCode = `

  /* PATCH_154N_MESSAGE_MEDIA_CACHE */
  const messageMediaUrlCacheRef =
    useRef<
      Record<
        string,
        {
          url: string;
          at: number;
        }
      >
    >({});
`;

    t =
      t.slice(0, at) +
      cacheCode +
      t.slice(at);
  }

  const loadStart =
    t.indexOf(
      'const load ='
    );

  const loadEnd =
    t.indexOf(
      'const pickPhoto',
      loadStart
    );

  if (
    loadStart >= 0 &&
    loadEnd > loadStart
  ) {
    let block =
      t.slice(
        loadStart,
        loadEnd
      );

    if (
      !block.includes(
        'PATCH_154N_MESSAGE_CACHE_HIT'
      )
    ) {
      const signedRx =
        /const\s*\{\s*data:\s*signed\s*,?\s*\}\s*=\s*await\s+supabase/;

      const signedMatch =
        signedRx.exec(block);

      if (!signedMatch) {
        throw new Error(
          'Messages signed-url load anchor not found'
        );
      }

      const cacheHit = `
                /* PATCH_154N_MESSAGE_CACHE_HIT */
                const cachedMedia =
                  messageMediaUrlCacheRef
                    .current[
                      m.media_path
                    ];

                if (
                  cachedMedia &&
                  Date.now() -
                    cachedMedia.at <
                    50 * 60 * 1000
                ) {
                  return {
                    ...m,
                    media_url:
                      cachedMedia.url,
                  };
                }

                `;

      block =
        block.slice(
          0,
          signedMatch.index
        ) +
        cacheHit +
        block.slice(
          signedMatch.index
        );

      const mediaRx =
        /media_url:\s*signed\?\.signedUrl\s*\?\?\s*null,/;

      if (!mediaRx.test(block)) {
        throw new Error(
          'Messages media_url return anchor not found'
        );
      }

      block =
        block.replace(
          mediaRx,
`media_url: (() => {
                    const url =
                      signed?.signedUrl ??
                      null;

                    if (url) {
                      messageMediaUrlCacheRef
                        .current[
                          m.media_path
                        ] = {
                          url,
                          at: Date.now(),
                        };
                    }

                    return url;
                  })(),`
        );

      t =
        t.slice(
          0,
          loadStart
        ) +
        block +
        t.slice(
          loadEnd
        );
    }
  } else {
    throw new Error(
      'Messages load block not found'
    );
  }

  /* ---------------------------------
     OPTIMISTIC MESSAGE REACTION
  --------------------------------- */

  const reactStart =
    t.indexOf(
      'const react ='
    );

  const reactEnd =
    t.indexOf(
      'const openForward =',
      reactStart
    );

  if (
    reactStart < 0 ||
    reactEnd < 0
  ) {
    throw new Error(
      'Messages react function not found'
    );
  }

  const currentReact =
    t.slice(
      reactStart,
      reactEnd
    );

  if (
    currentReact.includes(
      'set_direct_message_reaction_v1'
    ) &&
    !currentReact.includes(
      'PATCH_154N_OPTIMISTIC_MESSAGE_REACTION'
    )
  ) {
    const newReact = `const react =
    async (
      reaction: Reaction
    ) => {
      if (!selected) {
        return;
      }

      /* PATCH_154N_OPTIMISTIC_MESSAGE_REACTION */
      const messageId =
        selected.message_id;

      const previous =
        (
          selected.reaction ??
          null
        ) as
          | Reaction
          | null;

      const nextReaction =
        previous === reaction
          ? null
          : reaction;

      /* Update UI immediately */
      setMessages(
        current =>
          current.map(
            m =>
              m.message_id ===
              messageId
                ? {
                    ...m,
                    reaction:
                      nextReaction,
                  }
                : m
          )
      );

      setReactionOpen(
        false
      );

      setSelected(
        null
      );

      const {
        error,
      } =
        await (
          supabase as any
        ).rpc(
          'set_direct_message_reaction_v1',
          {
            p_message_id:
              messageId,

            p_reaction:
              reaction,
          }
        );

      if (error) {
        /* Roll back only if DB rejected it */
        setMessages(
          current =>
            current.map(
              m =>
                m.message_id ===
                messageId
                  ? {
                      ...m,
                      reaction:
                        previous,
                    }
                  : m
            )
        );

        Alert.alert(
          'Reaction',
          error.message
        );
      }
    };


  `;

    t =
      t.slice(
        0,
        reactStart
      ) +
      newReact +
      t.slice(
        reactEnd
      );
  }

  /* ---------------------------------
     ADD MESSAGE INDEX
  --------------------------------- */

  if (
    !t.includes(
      'messageIndex: number'
    )
  ) {
    const mapRx =
      /messages\.map\(\s*\(\s*m:\s*any\s*\)\s*=>\s*\(/;

    if (
      !mapRx.test(t)
    ) {
      throw new Error(
        'Messages map callback anchor not found'
      );
    }

    t =
      t.replace(
        mapRx,
        `messages.map(
          (
            m: any,
            messageIndex: number
          ) => (`
      );
  }

  /* ---------------------------------
     SCREEN-SAFE REACTION PICKER
  --------------------------------- */

  const pickerStart =
    t.indexOf(
      'reactionOpen &&'
    );

  const pickerEnd =
    t.indexOf(
      '{RX.map',
      pickerStart
    );

  if (
    pickerStart >= 0 &&
    pickerEnd > pickerStart
  ) {
    let picker =
      t.slice(
        pickerStart,
        pickerEnd
      );

    /* Correct inward alignment:
       mine -> anchor RIGHT
       theirs -> anchor LEFT */
    picker =
      picker.replace(
        /left:\s*m\.is_mine\s*\?\s*0\s*:\s*undefined,\s*right:\s*m\.is_mine\s*\?\s*undefined\s*:\s*0,/s,
`left:
            m.is_mine
              ? undefined
              : 0,
          right:
            m.is_mine
              ? 0
              : undefined,`
      );

    /* Top messages show picker below.
       Rest show it above. */
    if (
      /bottom:\s*38,/.test(
        picker
      )
    ) {
      picker =
        picker.replace(
          /bottom:\s*38,/,
`/* PATCH_154N_SCREEN_SAFE_REACTIONS */
          top:
            messageIndex < 2
              ? '100%'
              : undefined,
          bottom:
            messageIndex < 2
              ? undefined
              : '100%',
          marginTop:
            messageIndex < 2
              ? 5
              : undefined,
          marginBottom:
            messageIndex < 2
              ? undefined
              : 5,`
        );
    }

    t =
      t.slice(
        0,
        pickerStart
      ) +
      picker +
      t.slice(
        pickerEnd
      );
  } else {
    console.log(
      '⚠ Inline reaction picker anchor not found; reaction optimization still applied'
    );
  }

  fs.writeFileSync(
    connectFile,
    t,
    'utf8'
  );

  console.log(
    '✓ Messages: instant reaction + stable photos + screen-safe picker'
  );
}

/* ============================================================
   3. COMMUNITY FEED
   - stable signed photo URLs
   - fetch my current reaction
   - immediate optimistic count
============================================================ */

{
  let t =
    fs.readFileSync(
      communityFile,
      'utf8'
    );

  t = ensureNamedImport(
    t,
    'react',
    'useRef'
  );

  if (
    !t.includes(
      'communityMediaUrlCacheRef'
    )
  ) {
    const componentRx =
      /export\s+default\s+function\s+BuklodScreen\(\)\s*\{/;

    const componentMatch =
      componentRx.exec(t);

    if (!componentMatch) {
      throw new Error(
        'BuklodScreen component anchor not found'
      );
    }

    const at =
      componentMatch.index +
      componentMatch[0].length;

    t =
      t.slice(0, at) +
`
 /* PATCH_154N_COMMUNITY_MEDIA_CACHE */
 const communityMediaUrlCacheRef=
  useRef<Record<string,{url:string;at:number}>>({});
` +
      t.slice(at);
  }

  const loadStart =
    t.indexOf(
      'const load='
    ) >= 0
      ? t.indexOf(
          'const load='
        )
      : t.indexOf(
          'const load ='
        );

  const loadEnd =
    t.indexOf(
      'const pickPhoto',
      loadStart
    );

  if (
    loadStart < 0 ||
    loadEnd < 0
  ) {
    throw new Error(
      'Community load block not found'
    );
  }

  let loadBlock =
    t.slice(
      loadStart,
      loadEnd
    );

  if (
    !loadBlock.includes(
      'PATCH_154N_COMMUNITY_FEED_ROWS'
    )
  ) {
    const nextRx =
      /const\s+next\s*=\s*await\s+Promise\.all\(\s*\(data\s*\?\?\s*\[\]\)\.map\(\s*async\s*\(\s*p\s*:\s*any\s*\)\s*=>\s*\{[\s\S]*?\}\s*\)\s*\);/;

    const nextMatch =
      nextRx.exec(
        loadBlock
      );

    if (!nextMatch) {
      throw new Error(
        'Community feed media mapping anchor not found'
      );
    }

    const replacement = `/* PATCH_154N_COMMUNITY_FEED_ROWS */
  const feedRows=
    (data??[]) as any[];

  const postIds=
    feedRows
      .map((p:any)=>p.id)
      .filter(Boolean);

  const myReactionByPost:
    Record<string,Reaction>={};

  if(postIds.length){
    const {
      data:myReactionRows,
      error:myReactionError
    }=
      await supabase
        .from('reactions')
        .select('post_id,reaction')
        .eq(
          'user_id',
          user.id
        )
        .in(
          'post_id',
          postIds
        );

    if(!myReactionError){
      for(
        const row of
          myReactionRows??[]
      ){
        myReactionByPost[
          row.post_id
        ]=
          row.reaction as Reaction;
      }
    }
  }

  const next=
    await Promise.all(
      feedRows.map(
        async(p:any)=>{
          const base={
            ...p,
            my_reaction:
              myReactionByPost[
                p.id
              ]??null
          };

          if(!p.media_path){
            return{
              ...base,
              media_url:null
            };
          }

          const cached=
            communityMediaUrlCacheRef
              .current[
                p.media_path
              ];

          if(
            cached &&
            Date.now()-cached.at <
              50*60*1000
          ){
            return{
              ...base,
              media_url:
                cached.url
            };
          }

          const {data:s}=
            await supabase
              .storage
              .from(
                'community-media'
              )
              .createSignedUrl(
                p.media_path,
                3600
              );

          const url=
            s?.signedUrl??null;

          if(url){
            communityMediaUrlCacheRef
              .current[
                p.media_path
              ]={
                url,
                at:Date.now()
              };
          }

          return{
            ...base,
            media_url:url
          };
        }
      )
    );`;

    loadBlock =
      loadBlock.slice(
        0,
        nextMatch.index
      ) +
      replacement +
      loadBlock.slice(
        nextMatch.index +
          nextMatch[0].length
      );

    t =
      t.slice(
        0,
        loadStart
      ) +
      loadBlock +
      t.slice(
        loadEnd
      );
  }

  /* ---------------------------------
     OPTIMISTIC COMMUNITY REACTION
  --------------------------------- */

  const reactStart =
    t.indexOf(
      'const react='
    ) >= 0
      ? t.indexOf(
          'const react='
        )
      : t.indexOf(
          'const react ='
        );

  const reactEnd =
    t.indexOf(
      'const shareOutside',
      reactStart
    );

  if (
    reactStart < 0 ||
    reactEnd < 0
  ) {
    throw new Error(
      'Community react function not found'
    );
  }

  const oldReact =
    t.slice(
      reactStart,
      reactEnd
    );

  if (
    oldReact.includes(
      'set_buklod_post_reaction_v3'
    ) &&
    !oldReact.includes(
      'PATCH_154N_OPTIMISTIC_COMMUNITY_REACTION'
    )
  ) {
    const newReact = `const react=async(
  postId:string,
  reaction:Reaction
)=>{
  /* PATCH_154N_OPTIMISTIC_COMMUNITY_REACTION */

  const current=
    posts.find(
      p=>p.id===postId
    );

  const previous=
    (
      current?.my_reaction??
      null
    ) as Reaction|null;

  const nextReaction=
    previous===reaction
      ? null
      : reaction;

  const changeReaction=(
    base:any,
    from:Reaction|null,
    to:Reaction|null
  )=>{
    const counts={
      ...(
        base.reaction_counts||
        {}
      )
    };

    let total=
      Number(
        base.total_reactions??
        Object.values(
          counts
        ).reduce(
          (
            sum:number,
            value:any
          )=>
            sum+
            Number(
              value??0
            ),
          0
        )
      );

    if(from){
      counts[from]=
        Math.max(
          0,
          Number(
            counts[from]??0
          )-1
        );

      total=
        Math.max(
          0,
          total-1
        );
    }

    if(to){
      counts[to]=
        Number(
          counts[to]??0
        )+1;

      total+=1;
    }

    return{
      ...base,
      reaction_counts:
        counts,
      total_reactions:
        total,
      my_reaction:
        to
    };
  };

  /* Count changes NOW */
  setPosts(
    currentPosts=>
      currentPosts.map(
        p=>
          p.id===postId
            ? changeReaction(
                p,
                previous,
                nextReaction
              )
            : p
      )
  );

  const {error}=
    await(
      supabase as any
    ).rpc(
      'set_buklod_post_reaction_v3',
      {
        p_post_id:
          postId,
        p_reaction:
          reaction
      }
    );

  if(error){
    /* DB rejected: restore count */
    setPosts(
      currentPosts=>
        currentPosts.map(
          p=>
            p.id===postId
              ? changeReaction(
                  p,
                  nextReaction,
                  previous
                )
              : p
        )
    );

    Alert.alert(
      'Reaction',
      error.message
    );
  }
};


 `;

    t =
      t.slice(
        0,
        reactStart
      ) +
      newReact +
      t.slice(
        reactEnd
      );
  }

  /* Selected reaction visual */
  if (
    !t.includes(
      'item.my_reaction===r.key'
    )
  ) {
    t =
      t.replace(
        /style=\{s\.rxBtn\}/,
`style={[
  s.rxBtn,
  item.my_reaction===r.key&&{
    backgroundColor:
      colors.greenSoft,
    borderWidth:1,
    borderColor:
      colors.green
  }
]}`
      );
  }

  fs.writeFileSync(
    communityFile,
    t,
    'utf8'
  );

  console.log(
    '✓ Community Feed: reaction counts change immediately'
  );
}

/* ============================================================
   4. COMMUNITY POST DETAIL
   Same instant reaction + stable photo
============================================================ */

{
  let t =
    fs.readFileSync(
      postFile,
      'utf8'
    );

  t = ensureNamedImport(
    t,
    'react',
    'useRef'
  );

  if (
    !t.includes(
      'postMediaUrlCacheRef'
    )
  ) {
    const componentRx =
      /export\s+default\s+function\s+PostDetail\(\)\s*\{/;

    const m =
      componentRx.exec(t);

    if (!m) {
      throw new Error(
        'PostDetail component anchor not found'
      );
    }

    const at =
      m.index +
      m[0].length;

    t =
      t.slice(0, at) +
`
 /* PATCH_154N_POST_MEDIA_CACHE */
 const postMediaUrlCacheRef=
  useRef<{
    path:string;
    url:string;
    at:number;
  }|null>(null);

 const [
  myReaction,
  setMyReaction
 ]=
  useState<Reaction|null>(
    null
  );
` +
      t.slice(at);
  }

  /* Stable post image URL */
  if (
    !t.includes(
      'PATCH_154N_POST_STABLE_URL'
    )
  ) {
    const urlRx =
      /let\s+url:string\|null=null;if\(row\.media_path\)\{const\s+\{data:s\}=await\s+supabase\.storage\.from\('community-media'\)\.createSignedUrl\(row\.media_path,3600\);url=s\?\.signedUrl\?\?null\}/;

    if (
      !urlRx.test(t)
    ) {
      throw new Error(
        'Post detail image URL anchor not found'
      );
    }

    t =
      t.replace(
        urlRx,
`/* PATCH_154N_POST_STABLE_URL */
  let url:string|null=null;

  if(row.media_path){
    const cached=
      postMediaUrlCacheRef
        .current;

    if(
      cached &&
      cached.path===
        row.media_path &&
      Date.now()-cached.at <
        50*60*1000
    ){
      url=
        cached.url;
    }else{
      const {data:s}=
        await supabase
          .storage
          .from(
            'community-media'
          )
          .createSignedUrl(
            row.media_path,
            3600
          );

      url=
        s?.signedUrl??null;

      if(url){
        postMediaUrlCacheRef
          .current={
            path:
              row.media_path,
            url,
            at:Date.now()
          };
      }
    }
  }`
      );
  }

  /* Load current user's reaction */
  if (
    !t.includes(
      'PATCH_154N_LOAD_MY_POST_REACTION'
    )
  ) {
    const marker =
      '// POST_AUTHOR_CIRCLE_RANK';

    const markerAt =
      t.indexOf(marker);

    if (
      markerAt < 0
    ) {
      throw new Error(
        'Post author rank anchor not found'
      );
    }

    const mineCode = `
  /* PATCH_154N_LOAD_MY_POST_REACTION */
  if(user?.id){
    const {
      data:mine
    }=
      await supabase
        .from('reactions')
        .select('reaction')
        .eq(
          'post_id',
          id
        )
        .eq(
          'user_id',
          user.id
        )
        .maybeSingle();

    setMyReaction(
      (
        mine?.reaction??
        null
      ) as Reaction|null
    );
  }

  `;

    t =
      t.slice(
        0,
        markerAt
      ) +
      mineCode +
      t.slice(
        markerAt
      );
  }

  const reactStart =
    t.indexOf(
      'const react='
    ) >= 0
      ? t.indexOf(
          'const react='
        )
      : t.indexOf(
          'const react ='
        );

  const reactEnd =
    t.indexOf(
      'const share=',
      reactStart
    ) >= 0
      ? t.indexOf(
          'const share=',
          reactStart
        )
      : t.indexOf(
          'const share =',
          reactStart
        );

  if (
    reactStart < 0 ||
    reactEnd < 0
  ) {
    throw new Error(
      'Post detail react function not found'
    );
  }

  const reactBlock =
    t.slice(
      reactStart,
      reactEnd
    );

  if (
    reactBlock.includes(
      'set_buklod_post_reaction_v3'
    ) &&
    !reactBlock.includes(
      'PATCH_154N_OPTIMISTIC_POST_REACTION'
    )
  ) {
    const newReact = `const react=async(
  r:Reaction
)=>{
  if(!post)return;

  /* PATCH_154N_OPTIMISTIC_POST_REACTION */

  const previous=
    myReaction;

  const nextReaction=
    previous===r
      ? null
      : r;

  const mutate=(
    base:any,
    from:Reaction|null,
    to:Reaction|null
  )=>{
    const counts={
      ...(
        base.reaction_counts||
        {}
      )
    };

    let total=
      Number(
        base.total_reactions??
        Object.values(
          counts
        ).reduce(
          (
            sum:number,
            value:any
          )=>
            sum+
            Number(
              value??0
            ),
          0
        )
      );

    if(from){
      counts[from]=
        Math.max(
          0,
          Number(
            counts[from]??0
          )-1
        );

      total=
        Math.max(
          0,
          total-1
        );
    }

    if(to){
      counts[to]=
        Number(
          counts[to]??0
        )+1;

      total+=1;
    }

    return{
      ...base,
      reaction_counts:
        counts,
      total_reactions:
        total
    };
  };

  setMyReaction(
    nextReaction
  );

  setPost(
    (current:any)=>
      current
        ? mutate(
            current,
            previous,
            nextReaction
          )
        : current
  );

  const {error}=
    await(
      supabase as any
    ).rpc(
      'set_buklod_post_reaction_v3',
      {
        p_post_id:id,
        p_reaction:r
      }
    );

  if(error){
    setMyReaction(
      previous
    );

    setPost(
      (current:any)=>
        current
          ? mutate(
              current,
              nextReaction,
              previous
            )
          : current
    );

    Alert.alert(
      'Reaction',
      error.message
    );
  }
};


 `;

    t =
      t.slice(
        0,
        reactStart
      ) +
      newReact +
      t.slice(
        reactEnd
      );
  }

  if (
    !t.includes(
      'myReaction===r.key'
    )
  ) {
    t =
      t.replace(
        /style=\{s\.rxBtn\}/,
`style={[
  s.rxBtn,
  myReaction===r.key&&{
    backgroundColor:
      colors.greenSoft,
    borderWidth:1,
    borderColor:
      colors.green
  }
]}`
      );
  }

  fs.writeFileSync(
    postFile,
    t,
    'utf8'
  );

  console.log(
    '✓ Post Detail: instant reaction + stable photo'
  );
}

console.log('');
console.log('======================================');
console.log('PATCH 154N WRITTEN');
console.log('======================================');
console.log('✓ swipe main tabs');
console.log('✓ instant Community reaction counts');
console.log('✓ instant Message reactions');
console.log('✓ reaction picker auto-fits direction');
console.log('✓ top message picker opens downward');
console.log('✓ stable photo URL cache');
console.log('✓ no unnecessary reaction full-load');
console.log('======================================');
