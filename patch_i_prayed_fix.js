const fs = require("fs");


function stop(message) {
  console.error("");
  console.error(
    "I PRAYED FIX STOPPED:"
  );
  console.error(message);
  process.exit(1);
}


function read(path) {
  return fs.readFileSync(
    path,
    "utf8"
  );
}


function write(path, src) {
  fs.writeFileSync(
    path,
    src,
    "utf8"
  );
}


/* ============================================================
   A. PRAYER WALL
   src/app/(tabs)/prayer.tsx
   ============================================================ */

{
  const path =
    "./src/app/(tabs)/prayer.tsx";

  let src =
    read(path);


  /*
   * Replace old upsert implementation.
   */
  const oldPrayed =
/const\s+prayed\s*=\s*async\s*\(\s*id\s*:\s*string\s*\)\s*=>\s*\{\s*if\s*\(\s*!user\s*\)\s*return\s*;\s*const\s*\{\s*error\s*\}\s*=\s*await\s+supabase\.from\(\s*['"]prayer_responses['"]\s*\)\.upsert\(\s*\{\s*prayer_request_id\s*:\s*id\s*,\s*user_id\s*:\s*user\.id\s*\}\s*\)\s*;\s*if\s*\(\s*error\s*\)\s*Alert\.alert\(\s*['"]Prayer['"]\s*,\s*error\.message\s*\)\s*;\s*\};/m;


  if (
    !oldPrayed.test(src) &&
    !src.includes(
      "I_PRAYED_IDEMPOTENT_FIX"
    )
  ) {
    stop(
      "Prayer Wall prayed() anchor not found."
    );
  }


  if (
    !src.includes(
      "I_PRAYED_IDEMPOTENT_FIX"
    )
  ) {

    src =
      src.replace(
        oldPrayed,
`const prayed=async(id:string)=>{
    if(!user)return;

    /* I_PRAYED_IDEMPOTENT_FIX */

    const {error}=
      await supabase
        .from('prayer_responses')
        .insert([
          {
            prayer_request_id:id,
            user_id:user.id
          }
        ]);

    /*
     * 23505 = response already exists.
     *
     * That is not an app error.
     * One prayer response per member/request
     * is intentional.
     */
    if(
      error &&
      error.code!=='23505'
    ){
      Alert.alert(
        'Prayer',
        error.message
      );
      return;
    }

    if(
      error?.code==='23505'
    ){
      Alert.alert(
        'Prayer',
        'You already prayed for this request.'
      );
      return;
    }

    Alert.alert(
      'Prayer',
      'Prayer recorded. Thank you for praying.'
    );

    await load();
  };`
      );
  }


  /*
   * Stop the inner I PRAYED button
   * from triggering the outer card
   * navigation at the same time.
   */
  src =
    src.replace(
      /<Pressable\s+onPress=\{\(\)=>prayed\(item\.id\)\}>/g,
`<Pressable
              onPress={(event)=>{
                event.stopPropagation();
                void prayed(item.id);
              }}
            >`
    );


  write(
    path,
    src
  );

  console.log(
    "PRAYER WALL I PRAYED FIXED"
  );
}


/* ============================================================
   B. PRAYER DETAIL
   src/app/prayer/[id].tsx
   ============================================================ */

{
  const path =
    "./src/app/prayer/[id].tsx";

  let src =
    read(path);


  const oldDetail =
/const\s+prayed\s*=\s*async\s*\(\s*\)\s*=>\s*\{\s*if\s*\(\s*!user\s*\|\|\s*!id\s*\)\s*return\s*;\s*const\s*\{\s*error\s*\}\s*=\s*await\s+supabase\.from\(\s*['"]prayer_responses['"]\s*\)\.upsert\(\s*\{\s*prayer_request_id\s*:\s*id\s*,\s*user_id\s*:\s*user\.id\s*\}\s*\)\s*;\s*if\s*\(\s*error\s*\)\s*return\s+Alert\.alert\(\s*['"]Prayer['"]\s*,\s*error\.message\s*\)\s*;\s*await\s+load\(\s*\)\s*;\s*\};/m;


  if (
    !oldDetail.test(src) &&
    !src.includes(
      "I_PRAYED_DETAIL_IDEMPOTENT_FIX"
    )
  ) {
    stop(
      "Prayer Detail prayed() anchor not found."
    );
  }


  if (
    !src.includes(
      "I_PRAYED_DETAIL_IDEMPOTENT_FIX"
    )
  ) {

    src =
      src.replace(
        oldDetail,
`const prayed=async()=>{
    if(!user||!id)return;

    /* I_PRAYED_DETAIL_IDEMPOTENT_FIX */

    const {error}=
      await supabase
        .from('prayer_responses')
        .insert([
          {
            prayer_request_id:id,
            user_id:user.id
          }
        ]);

    if(
      error &&
      error.code!=='23505'
    ){
      Alert.alert(
        'Prayer',
        error.message
      );
      return;
    }

    /*
     * Whether newly recorded or
     * previously recorded, reload
     * the accurate prayer count.
     */
    await load();

    if(
      error?.code==='23505'
    ){
      Alert.alert(
        'Prayer',
        'You already prayed for this request.'
      );
      return;
    }

    Alert.alert(
      'Prayer',
      'Prayer recorded. Thank you for praying.'
    );
  };`
      );
  }


  write(
    path,
    src
  );

  console.log(
    "PRAYER DETAIL I PRAYED FIXED"
  );
}


console.log("");
console.log(
  "I PRAYED FRONTEND FIX APPLIED"
);
