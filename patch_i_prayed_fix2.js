const fs = require("fs");

const path =
  "./src/app/prayer/[id].tsx";

let src =
  fs.readFileSync(
    path,
    "utf8"
  );


if (
  src.includes(
    "I_PRAYED_DETAIL_FIX2"
  )
) {
  console.log(
    "I PRAYED DETAIL FIX 2 already applied."
  );

  process.exit(0);
}


/*
 * Replace the WHOLE prayed()
 * function regardless of its
 * current internal formatting.
 *
 * Stop immediately before
 * const markAnswered.
 */
const pattern =
  /const\s+prayed\s*=\s*async\s*\(\s*\)\s*=>\s*\{[\s\S]*?\n\s*\};\s*\n\s*\n?\s*const\s+markAnswered\s*=/m;


if (!pattern.test(src)) {

  console.error("");
  console.error(
    "I PRAYED FIX 2 STOPPED:"
  );

  console.error(
    "Could not locate prayed() -> markAnswered boundary."
  );

  process.exit(1);
}


const replacement =
`const prayed=async()=>{
    if(!user||!id)return;

    /* I_PRAYED_DETAIL_FIX2 */

    /*
     * First check whether this member
     * already recorded a prayer.
     *
     * This avoids using UPSERT,
     * because prayer_responses only
     * needs a single INSERT per member
     * and prayer request.
     */
    const {
      data:existing,
      error:checkError
    }=
      await supabase
        .from('prayer_responses')
        .select('prayer_request_id')
        .eq(
          'prayer_request_id',
          id
        )
        .eq(
          'user_id',
          user.id
        )
        .maybeSingle();


    if(checkError){
      Alert.alert(
        'Prayer',
        checkError.message
      );

      return;
    }


    if(existing){

      await load();

      Alert.alert(
        'Prayer',
        'You already prayed for this request.'
      );

      return;
    }


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
     * Defensive race-condition handling:
     * if another tap inserted the same
     * response first, treat duplicate
     * key as already prayed.
     */
    if(
      error?.code==='23505'
    ){

      await load();

      Alert.alert(
        'Prayer',
        'You already prayed for this request.'
      );

      return;
    }


    if(error){

      Alert.alert(
        'Prayer',
        error.message
      );

      return;
    }


    await load();


    Alert.alert(
      'Prayer',
      'Prayer recorded. Thank you for praying.'
    );
  };


  const markAnswered=`;


src =
  src.replace(
    pattern,
    replacement
  );


fs.writeFileSync(
  path,
  src,
  "utf8"
);


console.log(
  "PRAYER DETAIL prayed() REPLACED"
);

console.log(
  "UPSERT REMOVED"
);

console.log(
  "DUPLICATE-SAFE INSERT INSTALLED"
);
