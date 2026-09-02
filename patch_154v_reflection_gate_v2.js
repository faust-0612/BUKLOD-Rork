const fs=require('fs');
const path=require('path');

const indexFile=path.resolve(
  'src/app/bible/index.tsx'
);

const readFile=path.resolve(
  'src/app/bible/read.tsx'
);

let index=fs.readFileSync(indexFile,'utf8');
let read=fs.readFileSync(readFile,'utf8');

if(!fs.existsSync(indexFile+'.bak154v_reflection_gate_v2')){
  fs.copyFileSync(
    indexFile,
    indexFile+'.bak154v_reflection_gate_v2'
  );
}

if(!fs.existsSync(readFile+'.bak154v_reflection_gate_v2')){
  fs.copyFileSync(
    readFile,
    readFile+'.bak154v_reflection_gate_v2'
  );
}


/* ============================================================
   1. PASS assignment_id FROM DAILY DASHBOARD -> READER
============================================================ */

const openStart=
  index.indexOf(
    'const openAssignedReading'
  );

if(openStart<0){
  throw new Error(
    'openAssignedReading not found'
  );
}

let openEnd=
  index.indexOf(
    '/* PATCH_153H_4B_AUTO_EVIDENCE */',
    openStart
  );

if(openEnd<0){
  openEnd=
    index.indexOf(
      'const buildAssignedBibleEvidence',
      openStart
    );
}

if(openEnd<0){
  throw new Error(
    'openAssignedReading end anchor not found'
  );
}

let openBlock=
  index.slice(
    openStart,
    openEnd
  );

if(
  !openBlock.includes(
    'assignment_id:'
  )
){

  const sourceRx=
    /source\s*:\s*['"]daily_plan['"]\s*,?/;

  const match=
    openBlock.match(sourceRx);

  if(!match){
    throw new Error(
      'daily_plan source still not found inside openAssignedReading'
    );
  }

  const sourceText=
    match[0].trim().endsWith(',')
      ? match[0]
      : match[0]+',';

  openBlock=
    openBlock.replace(
      sourceRx,
`${sourceText}

        assignment_id:
          selected.id,`
    );

  index=
    index.slice(0,openStart)+
    openBlock+
    index.slice(openEnd);
}


/* ============================================================
   2. ADD assignment_id PARAM TO BIBLE READER
============================================================ */

if(
  !read.includes(
    'assignment_id?: string;'
  )
){

  const sourceParamRx=
    /source\?\s*:\s*string\s*;/;

  if(!sourceParamRx.test(read)){
    throw new Error(
      'source param type not found'
    );
  }

  read=
    read.replace(
      sourceParamRx,
`source?: string;
    assignment_id?: string;`
    );
}


/* ============================================================
   3. NORMALIZE DAILY ASSIGNMENT ID
============================================================ */

if(
  !read.includes(
    'const dailyAssignmentId ='
  )
){

  const sourceAt=
    read.indexOf(
      'const source = useMemo'
    );

  if(sourceAt<0){
    throw new Error(
      'reader source useMemo not found'
    );
  }

  read=
    read.slice(0,sourceAt)+
`/* PATCH_154V_DAILY_ASSIGNMENT_ID */
  const dailyAssignmentId =
    (
      paramString(
        params.assignment_id
      ) ?? ''
    ).trim();


  `+
    read.slice(sourceAt);
}


/* ============================================================
   4. DENY MARK CHAPTER READ UNTIL REFLECTION SUBMITTED
============================================================ */

if(
  !read.includes(
    'DAILY_BIBLE_REFLECTION_SUBMISSION_GATE_V2'
  )
){

  const markStart=
    read.indexOf(
      'const markRead ='
    );

  if(markStart<0){
    throw new Error(
      'markRead not found'
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
      /* DAILY_BIBLE_REFLECTION_SUBMISSION_GATE_V2 */
      if (source === 'daily_plan') {

        if (!dailyAssignmentId) {

          Alert.alert(
            'Reflection Required',
            'Return to Daily Bible Reading and submit the questions and Personal Reflection first.'
          );

          return;
        }

        const {
          data:authData,
          error:authError
        } =
          await supabase.auth.getUser();

        if (
          authError ||
          !authData?.user?.id
        ) {

          Alert.alert(
            'Daily Bible Reading',
            'Unable to verify your account.'
          );

          return;
        }

        const {
          data:dailySubmission,
          error:submissionError
        } =
          await (supabase as any)
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
            .maybeSingle();

        if(submissionError){

          Alert.alert(
            'Daily Bible Reading',
            submissionError.message ??
              'Unable to verify your Daily Bible submission.'
          );

          return;
        }

        const hasSubmittedReflection =
          !!dailySubmission?.id &&
          String(
            dailySubmission?.answer_text ??
            ''
          ).trim().length >= 20;

        if(!hasSubmittedReflection){

          Alert.alert(
            'SUBMIT REFLECTION FIRST',
            'This chapter cannot be added to your Bible Reading Report yet. Answer the Daily Bible questions and submit your Personal Reflection first.'
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
   5. SAFETY
============================================================ */

if(
  !index.includes(
    'assignment_id:'
  )
){
  throw new Error(
    'assignment_id was not added to Daily Bible route'
  );
}

if(
  !read.includes(
    'DAILY_BIBLE_REFLECTION_SUBMISSION_GATE_V2'
  )
){
  throw new Error(
    'reflection gate was not installed'
  );
}


/* ============================================================
   WRITE ONLY AFTER ALL CHECKS PASS
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
console.log('PATCH 154V REFLECTION GATE V2 WRITTEN');
console.log('✓ assignment ID passed to Bible reader');
console.log('✓ Daily Plan chapter checks submitted reflection');
console.log('✓ no submitted reflection = DENIED');
console.log('✓ submitted reflection = MARK CHAPTER READ allowed');
console.log('✓ Free Reading and Search unaffected');
console.log('✓ no DB migration');
console.log('');

