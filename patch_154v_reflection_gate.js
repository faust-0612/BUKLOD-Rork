const fs=require('fs');
const path=require('path');

const indexFile=path.resolve('src/app/bible/index.tsx');
const readFile=path.resolve('src/app/bible/read.tsx');

let index=fs.readFileSync(indexFile,'utf8');
let read=fs.readFileSync(readFile,'utf8');

if(!fs.existsSync(indexFile+'.bak154v_reflection_gate')){
  fs.copyFileSync(indexFile,indexFile+'.bak154v_reflection_gate');
}

if(!fs.existsSync(readFile+'.bak154v_reflection_gate')){
  fs.copyFileSync(readFile,readFile+'.bak154v_reflection_gate');
}

/* ============================================================
   1. PASS ASSIGNMENT ID TO BIBLE READER
============================================================ */

const openStart=index.indexOf(
  'const openAssignedReading'
);

if(openStart<0){
  throw new Error('openAssignedReading not found');
}

const openEnd=index.indexOf(
  '};',
  openStart
);

let openBlock=index.slice(
  openStart,
  openEnd+2
);

if(!openBlock.includes('assignment_id:')){
  const sourceAnchor=
`        source:
          'daily_plan',`;

  if(!openBlock.includes(sourceAnchor)){
    throw new Error(
      'daily_plan route source not found'
    );
  }

  openBlock=openBlock.replace(
    sourceAnchor,
`${sourceAnchor}

        assignment_id:
          selected.id,`
  );

  index=
    index.slice(0,openStart)+
    openBlock+
    index.slice(openEnd+2);
}

/* ============================================================
   2. ADD PARAM TO READER
============================================================ */

if(!read.includes('assignment_id?: string;')){
  const paramAnchor=
`    source?: string;`;

  if(!read.includes(paramAnchor)){
    throw new Error(
      'reader source param not found'
    );
  }

  read=read.replace(
    paramAnchor,
`${paramAnchor}
    assignment_id?: string;`
  );
}

/* ============================================================
   3. NORMALIZE ASSIGNMENT ID
============================================================ */

if(!read.includes('const dailyAssignmentId =')){
  const verseAnchor=
`  const requestedVerse =
    Number(paramString(params.verse) ?? 0);`;

  if(!read.includes(verseAnchor)){
    throw new Error(
      'requestedVerse anchor not found'
    );
  }

  read=read.replace(
    verseAnchor,
`${verseAnchor}

  /* PATCH_154V_REFLECTION_BEFORE_MARK_READ */
  const dailyAssignmentId =
    (
      paramString(params.assignment_id) ??
      ''
    ).trim();`
  );
}

/* ============================================================
   4. DENY MARK READ UNTIL REFLECTION SUBMITTED
============================================================ */

if(
  !read.includes(
    'DAILY_BIBLE_REFLECTION_SUBMISSION_GATE'
  )
){
  const markStart=
    read.indexOf('const markRead =');

  if(markStart<0){
    throw new Error(
      'markRead function not found'
    );
  }

  const setMarkingAt=
    read.indexOf(
      'setMarking(true);',
      markStart
    );

  if(setMarkingAt<0){
    throw new Error(
      'setMarking(true) not found'
    );
  }

  const gate=`
      /* DAILY_BIBLE_REFLECTION_SUBMISSION_GATE */
      if (source === 'daily_plan') {

        if (!dailyAssignmentId) {
          Alert.alert(
            'Reflection Required',
            'Return to Daily Bible Reading and submit the questions and Personal Reflection before marking this chapter as read.'
          );

          return;
        }

        const {
          data:authData,
          error:authError
        } = await supabase.auth.getUser();

        if (
          authError ||
          !authData?.user?.id
        ) {
          Alert.alert(
            'Daily Bible Reading',
            'Unable to verify your account. Please try again.'
          );

          return;
        }

        const {
          data:reflectionSubmission,
          error:reflectionError
        } = await (supabase as any)
          .from(
            'daily_bible_submissions'
          )
          .select(
            'id,status,answer_text'
          )
          .eq(
            'assignment_id',
            dailyAssignmentId
          )
          .eq(
            'user_id',
            authData.user.id
          )
          .limit(1)
          .maybeSingle();

        if (reflectionError) {
          Alert.alert(
            'Daily Bible Reading',
            reflectionError.message ??
              'Unable to verify your reflection submission.'
          );

          return;
        }

        const reflectionSubmitted =
          !!reflectionSubmission &&
          String(
            reflectionSubmission.answer_text ??
            ''
          ).trim().length >= 20;

        if (!reflectionSubmitted) {
          Alert.alert(
            'SUBMIT REFLECTION FIRST',
            'This chapter cannot be added to your Bible Reading Report yet. Submit the Daily Bible questions and Personal Reflection first.'
          );

          return;
        }
      }


`;

  read=
    read.slice(0,setMarkingAt)+
    gate+
    read.slice(setMarkingAt);
}

/* ============================================================
   WRITE
============================================================ */

fs.writeFileSync(
  indexFile,
  index,
  'utf8'
);

fs.writeFileSync(
  readFile,
  read,
  'utf8'
);

console.log('');
console.log('PATCH 154V REFLECTION GATE WRITTEN');
console.log('✓ Daily Plan passes assignment ID to Bible reader');
console.log('✓ submitted reflection checked before Mark Chapter Read');
console.log('✓ no reflection = DENIED');
console.log('✓ submitted reflection = chapter may be added to Reading Report');
console.log('✓ Free Reading/Search unaffected');
console.log('✓ no DB migration');
console.log('');

