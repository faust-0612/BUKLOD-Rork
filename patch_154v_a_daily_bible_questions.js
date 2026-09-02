const fs=require('fs');
const path=require('path');

const file=path.resolve('src/app/bible/index.tsx');

if(!fs.existsSync(file)){
  throw new Error('bible/index.tsx not found');
}

let t=fs.readFileSync(file,'utf8');

const backup=file+'.bak154v_a';
if(!fs.existsSync(backup)){
  fs.copyFileSync(file,backup);
}

/* ============================================================
   TYPES
============================================================ */

t=t.replace(
`  reflection_question_fil: string;
  reflection_question_en: string;
};`,
`  reflection_question_fil: string;
  reflection_question_en: string;
  chapter_questions_fil?: string[] | null;
  chapter_questions_en?: string[] | null;
};`
);

t=t.replace(
`  admin_note: string | null;
};`,
`  admin_note: string | null;
  question_answers?: string[] | null;
  question_flow_version?: number;
};`
);

/* ============================================================
   STATE
============================================================ */

const stateAnchor=
`  const [answer,setAnswer] = useState('');`;

if(!t.includes(stateAnchor)){
  throw new Error('answer state anchor not found');
}

t=t.replace(
  stateAnchor,
`${stateAnchor}
  const [questionAnswers,setQuestionAnswers] =
    useState<string[]>(['','','']);`
);

/* ============================================================
   SELECT NEW COLUMNS
============================================================ */

t=t.replace(
`id,reading_date,bible_reference,instruction_fil,reflection_question_fil,reflection_question_en`,
`id,reading_date,bible_reference,instruction_fil,reflection_question_fil,reflection_question_en,chapter_questions_fil,chapter_questions_en`
);

t=t.replace(
`id,assignment_id,bible_text,bible_photo_path,answer_text,reflection_photo_path,answer_language,status,submitted_at,submitted_on_time,admin_note`,
`id,assignment_id,bible_text,bible_photo_path,answer_text,reflection_photo_path,answer_language,status,submitted_at,submitted_on_time,admin_note,question_answers,question_flow_version`
);

/* ============================================================
   RESTORE SAVED QUESTION ANSWERS
============================================================ */

const restoreAnchor=
`    setAnswer(submission?.answer_text ?? '');
    setLanguage(submission?.answer_language ?? 'fil');`;

if(!t.includes(restoreAnchor)){
  throw new Error('submission restore anchor not found');
}

t=t.replace(
  restoreAnchor,
`    setAnswer(submission?.answer_text ?? '');

    const savedQuestions =
      Array.isArray(submission?.question_answers)
        ? submission!.question_answers!
        : [];

    setQuestionAnswers([
      String(savedQuestions[0] ?? ''),
      String(savedQuestions[1] ?? ''),
      String(savedQuestions[2] ?? ''),
    ]);

    setLanguage(submission?.answer_language ?? 'fil');`
);

/* ============================================================
   VALIDATION + FALLBACK QUESTIONS
============================================================ */

const validationAnchor=
`  /* DAILY_BIBLE_ANSWER_REQUIRED_20260811 */
  const reflectionEvidenceOkay =
    answer.trim().length >= 20;`;

if(!t.includes(validationAnchor)){
  throw new Error('reflection validation anchor not found');
}

t=t.replace(
  validationAnchor,
`  /* PATCH_154V_CHAPTER_QUESTIONS */

  const storedQuestions =
    language === 'fil'
      ? selected?.chapter_questions_fil
      : selected?.chapter_questions_en;

  const chapterQuestions =
    Array.isArray(storedQuestions) &&
    storedQuestions.length >= 3
      ? storedQuestions.slice(0,3)
      : language === 'fil'
        ? [
            \`Ano ang pangunahing pangyayari o mensahe sa \${selected?.bible_reference ?? 'binasa mong kabanata'}?\`,
            \`Anong bahagi o talata sa \${selected?.bible_reference ?? 'kabanata'} ang pinakamahalaga sa iyo, at bakit?\`,
            \`Ano ang isang konkretong katotohanan o prinsipyo mula sa \${selected?.bible_reference ?? 'kabanata'} na maaari mong isabuhay?\`,
          ]
        : [
            \`What is the main event or message in \${selected?.bible_reference ?? 'the assigned chapter'}?\`,
            \`Which part or verse in \${selected?.bible_reference ?? 'the chapter'} stood out to you most, and why?\`,
            \`What specific truth or principle from \${selected?.bible_reference ?? 'the chapter'} can you apply?\`,
          ];

  const chapterAnswersOkay =
    chapterQuestions.every(
      (_,index) =>
        String(
          questionAnswers[index] ?? ''
        ).trim().length >= 10
    );

  const reflectionEvidenceOkay =
    answer.trim().length >= 20;`
);

/* ============================================================
   SUBMIT VALIDATION
============================================================ */

const submitStart=
`    if (!reflectionEvidenceOkay) {
      Alert.alert(
        'Reflection Required',`;

if(!t.includes(submitStart)){
  throw new Error('submit validation anchor not found');
}

t=t.replace(
  submitStart,
`    if (!chapterAnswersOkay) {
      Alert.alert(
        'Chapter Questions Required',
        'Answer all 3 chapter questions. Each answer must contain at least 10 characters.'
      );
      return;
    }

    if (!reflectionEvidenceOkay) {
      Alert.alert(
        'Reflection Required',`
);

/* ============================================================
   USE V2 RPC + SEND QUESTION ANSWERS
============================================================ */

t=t.replace(
`supabase.rpc('submit_daily_bible_evidence',{`,
`supabase.rpc('submit_daily_bible_evidence_v2',{`
);

const rpcAnchor=
`        p_reflection_photo_path:finalReflectionPath,
      });`;

if(!t.includes(rpcAnchor)){
  throw new Error('submission RPC params anchor not found');
}

t=t.replace(
  rpcAnchor,
`        p_reflection_photo_path:finalReflectionPath,
        p_question_answers:[
          questionAnswers[0].trim(),
          questionAnswers[1].trim(),
          questionAnswers[2].trim(),
        ],
      });`
);

/* ============================================================
   canSubmit
============================================================ */

t=t.replace(
`    !locked &&
    reflectionEvidenceOkay;`,
`    !locked &&
    chapterAnswersOkay &&
    reflectionEvidenceOkay;`
);

/* ============================================================
   REPLACE SINGLE QUESTION AREA
============================================================ */

const questionStart=t.indexOf(
  '<Text style={styles.eyebrow}>REFLECTION QUESTION</Text>'
);

if(questionStart<0){
  throw new Error('old reflection question UI not found');
}

const langStart=t.indexOf(
  '<View style={styles.langRow}>',
  questionStart
);

if(langStart<0){
  throw new Error('language selector not found');
}

/* remove old single question heading/question only */
t=
  t.slice(0,questionStart)+
`<Text style={styles.eyebrow}>
              RESPONSE LANGUAGE
            </Text>
            `+
  t.slice(langStart);

/* Insert 3 questions before end of same card */
const afterLang=t.indexOf(
  '</View>',
  t.indexOf(
    '<View style={styles.langRow}>',
    questionStart
  )
);

if(afterLang<0){
  throw new Error('language row closing View not found');
}

const insertAt=afterLang+'</View>'.length;

const questionUI=`

            <Text
              style={[
                styles.eyebrow,
                {marginTop:16}
              ]}
            >
              CHAPTER QUESTIONS *
            </Text>

            <Text style={styles.help}>
              Answer all three questions based on today’s assigned Scripture.
            </Text>

            {chapterQuestions.map(
              (question,index)=>(
                <View
                  key={index}
                  style={{marginTop:12}}
                >
                  <Text style={styles.question}>
                    {index+1}. {question}
                  </Text>

                  <TextInput
                    value={
                      questionAnswers[index] ?? ''
                    }
                    onChangeText={(value)=>{
                      setQuestionAnswers(
                        current=>{
                          const next=[
                            ...current
                          ];

                          next[index]=value;

                          return next;
                        }
                      );
                    }}
                    multiline
                    textAlignVertical="top"
                    editable={!locked}
                    placeholder={
                      language==='fil'
                        ? 'Isulat ang iyong sagot...'
                        : 'Write your answer...'
                    }
                    placeholderTextColor="#89958E"
                    style={[
                      styles.input,
                      {
                        minHeight:82,
                        marginTop:7
                      }
                    ]}
                  />

                  <Text style={styles.meta}>
                    {
                      String(
                        questionAnswers[index] ?? ''
                      ).trim().length
                    } characters | minimum 10
                  </Text>
                </View>
              )
            )}
`;

t=
  t.slice(0,insertAt)+
  questionUI+
  t.slice(insertAt);

/* ============================================================
   SEPARATE PERSONAL REFLECTION
============================================================ */

t=t.replace(
  '<Text style={styles.eyebrow}>1. REFLECTION *</Text>',
  '<Text style={styles.eyebrow}>PERSONAL REFLECTION *</Text>'
);

t=t.replace(
  'Answer the question in the app. A written answer of at least 20 characters is required. A photo is optional supporting evidence only.',
  'After answering the chapter questions, write a separate personal reflection. Minimum 20 characters. The photo remains optional supporting evidence.'
);

t=t.replace(
  'placeholder="What did you learn, and how will you apply it?"',
  'placeholder="Write your personal reflection and application..."'
);

/* reviewer wording */
t=t.replace(
  /PENDING PASTOR APPROVAL \|/g,
  'PENDING REVIEW |'
);

t=t.replace(
  /SUBMIT FOR PASTOR APPROVAL/g,
  'SUBMIT FOR REVIEW'
);

t=t.replace(
  'Your Daily Bible reflection is awaiting validation by an authorized Local Pastor or System Admin.',
  'Your Daily Bible responses are awaiting validation.'
);

fs.writeFileSync(file,t,'utf8');

/* ============================================================
   DATABASE MIGRATION
============================================================ */

const migration=path.resolve(
  'supabase/migrations/20260812023000_patch154v_daily_bible_questions.sql'
);

const sql=String.raw`
-- ============================================================
-- PATCH 154V
-- DAILY BIBLE CHAPTER QUESTIONS
-- ============================================================

alter table public.daily_bible_assignments
add column if not exists
chapter_questions_fil jsonb
not null
default '[]'::jsonb;

alter table public.daily_bible_assignments
add column if not exists
chapter_questions_en jsonb
not null
default '[]'::jsonb;


alter table public.daily_bible_submissions
add column if not exists
question_answers jsonb
not null
default '[]'::jsonb;

alter table public.daily_bible_submissions
add column if not exists
question_flow_version smallint
not null
default 1;


create or replace function
public.generate_bible_chapter_questions_v1(
  p_reference text
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  ref_text text :=
    trim(coalesce(p_reference,''));
begin

  if ref_text = '' then
    raise exception
      'Bible reference is required';
  end if;

  return jsonb_build_object(

    'fil',
    jsonb_build_array(
      'Ano ang pangunahing pangyayari o mensahe sa ' ||
        ref_text || '?',

      'Anong bahagi o talata sa ' ||
        ref_text ||
        ' ang pinakamahalaga sa iyo, at bakit?',

      'Ano ang isang konkretong katotohanan, utos, o prinsipyo mula sa ' ||
        ref_text ||
        ' na maaari mong isabuhay?'
    ),

    'en',
    jsonb_build_array(
      'What is the main event or message in ' ||
        ref_text || '?',

      'Which part or verse in ' ||
        ref_text ||
        ' stood out to you most, and why?',

      'What specific truth, command, or principle from ' ||
        ref_text ||
        ' can you apply?'
    )

  );

end;
$$;


create or replace function
public.fill_daily_bible_chapter_questions_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  generated jsonb;
begin

  if
    new.bible_reference is null
    or trim(new.bible_reference) = ''
  then
    return new;
  end if;

  generated :=
    public.generate_bible_chapter_questions_v1(
      new.bible_reference
    );

  if
    new.chapter_questions_fil is null
    or jsonb_typeof(
      new.chapter_questions_fil
    ) <> 'array'
    or jsonb_array_length(
      new.chapter_questions_fil
    ) < 3
  then
    new.chapter_questions_fil :=
      generated -> 'fil';
  end if;

  if
    new.chapter_questions_en is null
    or jsonb_typeof(
      new.chapter_questions_en
    ) <> 'array'
    or jsonb_array_length(
      new.chapter_questions_en
    ) < 3
  then
    new.chapter_questions_en :=
      generated -> 'en';
  end if;

  return new;

end;
$$;


drop trigger if exists
fill_daily_bible_chapter_questions_v1
on public.daily_bible_assignments;

create trigger
fill_daily_bible_chapter_questions_v1
before insert or update of bible_reference
on public.daily_bible_assignments
for each row
execute function
public.fill_daily_bible_chapter_questions_v1();


update public.daily_bible_assignments a
set
  chapter_questions_fil =
    (
      public.generate_bible_chapter_questions_v1(
        a.bible_reference
      )
    ) -> 'fil',

  chapter_questions_en =
    (
      public.generate_bible_chapter_questions_v1(
        a.bible_reference
      )
    ) -> 'en'

where
  jsonb_array_length(
    coalesce(
      a.chapter_questions_fil,
      '[]'::jsonb
    )
  ) < 3

  or

  jsonb_array_length(
    coalesce(
      a.chapter_questions_en,
      '[]'::jsonb
    )
  ) < 3;


/*
  Wrapper around the existing proven submission RPC.
  Existing approved/history rows are untouched.
*/
create or replace function
public.submit_daily_bible_evidence_v2(
  p_assignment_id uuid,
  p_bible_text text default null,
  p_reflection_text text default null,
  p_language text default 'fil',
  p_bible_photo_path text default null,
  p_reflection_photo_path text default null,
  p_question_answers jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
  valid_answers integer := 0;
begin

  if
    p_question_answers is null
    or jsonb_typeof(
      p_question_answers
    ) <> 'array'
    or jsonb_array_length(
      p_question_answers
    ) <> 3
  then
    raise exception
      'All three Daily Bible chapter questions must be answered';
  end if;


  select count(*)
  into valid_answers
  from jsonb_array_elements_text(
    p_question_answers
  ) answer
  where char_length(
    trim(answer)
  ) >= 10;


  if valid_answers <> 3 then
    raise exception
      'Each Daily Bible chapter answer must contain at least 10 characters';
  end if;


  new_id :=
    public.submit_daily_bible_evidence(
      p_assignment_id,
      p_bible_text,
      p_reflection_text,
      p_language,
      p_bible_photo_path,
      p_reflection_photo_path
    );


  update public.daily_bible_submissions
  set
    question_answers =
      p_question_answers,

    question_flow_version =
      2
  where id = new_id;


  return new_id;

end;
$$;


revoke all on function
public.submit_daily_bible_evidence_v2(
  uuid,
  text,
  text,
  text,
  text,
  text,
  jsonb
)
from public;

grant execute on function
public.submit_daily_bible_evidence_v2(
  uuid,
  text,
  text,
  text,
  text,
  text,
  jsonb
)
to authenticated;


comment on function
public.submit_daily_bible_evidence_v2(
  uuid,
  text,
  text,
  text,
  text,
  text,
  jsonb
)
is
'Daily Bible submission requiring three written chapter-question answers plus a separate reflection.';
`;

fs.writeFileSync(
  migration,
  sql,
  'utf8'
);

console.log('');
console.log('PATCH 154V-A WRITTEN');
console.log('✓ 3 autogenerated chapter questions');
console.log('✓ all 3 written answers required');
console.log('✓ separate personal reflection retained');
console.log('✓ existing approved/history submissions preserved');
console.log('✓ new V2 submission RPC created');
console.log('✓ migration created');
console.log('');

