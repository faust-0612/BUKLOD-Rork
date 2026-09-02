const fs=require('fs');
const path=require('path');

const file=path.resolve('src/app/bible/index.tsx');

if(!fs.existsSync(file)){
  throw new Error('bible/index.tsx not found');
}

let t=fs.readFileSync(file,'utf8');

const backup=file+'.bak154v_auto_questions';

if(!fs.existsSync(backup)){
  fs.copyFileSync(file,backup);
}

/* ============================================================
   TYPES
============================================================ */

if(!t.includes('chapter_questions_fil?:')){
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
}

if(!t.includes('question_answers?:')){
  t=t.replace(
`  admin_note: string | null;
};`,
`  admin_note: string | null;
  question_answers?: string[] | null;
};`
  );
}

/* ============================================================
   QUESTION ANSWERS STATE
============================================================ */

if(!t.includes('const [questionAnswers,setQuestionAnswers]')){
  const a=`  const [answer,setAnswer] = useState('');`;

  if(!t.includes(a)){
    throw new Error('answer state not found');
  }

  t=t.replace(
    a,
`${a}
  const [questionAnswers,setQuestionAnswers] =
    useState<string[]>(['','','','']);`
  );
}

/* ============================================================
   REPLACE LOAD FUNCTION
   Source of truth = AUTOMATIC CURRENT WEEK
============================================================ */

const loadStart=
  t.indexOf(
    '  const load = useCallback(async () => {'
  );

const loadEndMarker='  }, [days]);';

const loadEnd=
  t.indexOf(
    loadEndMarker,
    loadStart
  );

if(loadStart<0 || loadEnd<0){
  throw new Error('Daily Bible load function not found');
}

const newLoad=`  const load = useCallback(async () => {

    /*
     * AUTOMATIC DAILY BIBLE IS THE SOURCE OF TRUTH.
     *
     * This RPC materializes the current automatic
     * Monday-Sunday reading plan into daily_bible_assignments
     * and ensures active members are assigned.
     */
    const {
      data:automaticData,
      error:automaticError
    } = await (supabase as any).rpc(
      'ensure_current_automatic_bible_week'
    );

    if(automaticError){
      throw automaticError;
    }

    const automaticRows =
      Array.isArray(automaticData)
        ? automaticData
        : [];

    const automaticIds =
      automaticRows
        .map(
          (row:any)=>
            String(
              row?.assignment_id ?? ''
            )
        )
        .filter(Boolean);

    let databaseRows:any[] = [];

    if(automaticIds.length){
      const {
        data,
        error
      } = await supabase
        .from('daily_bible_assignments')
        .select(
          'id,reading_date,bible_reference,instruction_fil,reflection_question_fil,reflection_question_en,chapter_questions_fil,chapter_questions_en'
        )
        .in(
          'id',
          automaticIds
        );

      if(error){
        console.warn(
          'Daily Bible assignment details:',
          error.message
        );
      }else{
        databaseRows=data ?? [];
      }
    }

    const detailsById=
      new Map(
        databaseRows.map(
          (row:any)=>[
            String(row.id),
            row
          ]
        )
      );

    /*
     * Even if direct table SELECT is restricted by RLS,
     * use the trusted automatic-week RPC result so TODAY
     * never disappears from the dashboard.
     */
    const aa:Assignment[] =
      automaticRows.map(
        (raw:any)=>{
          const id=
            String(
              raw.assignment_id ?? ''
            );

          const detail=
            detailsById.get(id);

          const reference=
            String(
              detail?.bible_reference ??
              raw.bible_reference ??
              ''
            );

          const filQuestions=[
            \`Ano ang pangunahing pangyayari o mensahe sa \${reference}?\`,
            \`Anong talata o bahagi ng \${reference} ang pinaka-napansin mo, at bakit?\`,
            \`Ano ang itinuturo ng \${reference} tungkol sa Diyos, sa tao, o sa pananampalataya?\`,
            \`Ano ang isang konkretong bagay na maaari mong gawin bilang tugon sa \${reference}?\`,
          ];

          const enQuestions=[
            \`What is the main event or message in \${reference}?\`,
            \`Which verse or part of \${reference} stood out to you most, and why?\`,
            \`What does \${reference} teach about God, people, or faith?\`,
            \`What is one concrete action you can take in response to \${reference}?\`,
          ];

          return {
            id,

            reading_date:
              String(
                detail?.reading_date ??
                raw.reading_date ??
                ''
              ).slice(0,10),

            bible_reference:
              reference,

            instruction_fil:
              detail?.instruction_fil ??
              'Basahin ang nakatakdang Scripture bago sagutin ang mga tanong.',

            reflection_question_fil:
              detail?.reflection_question_fil ??
              filQuestions[0],

            reflection_question_en:
              detail?.reflection_question_en ??
              enQuestions[0],

            chapter_questions_fil:
              Array.isArray(
                detail?.chapter_questions_fil
              ) &&
              detail.chapter_questions_fil.length>=4
                ? detail.chapter_questions_fil
                : filQuestions,

            chapter_questions_en:
              Array.isArray(
                detail?.chapter_questions_en
              ) &&
              detail.chapter_questions_en.length>=4
                ? detail.chapter_questions_en
                : enQuestions,
          };
        }
      );

    setAssignments(aa);

    if(aa.length){
      const {
        data:s,
        error:se
      } = await supabase
        .from('daily_bible_submissions')
        .select(
          'id,assignment_id,bible_text,bible_photo_path,answer_text,reflection_photo_path,answer_language,status,submitted_at,submitted_on_time,admin_note,question_answers'
        )
        .in(
          'assignment_id',
          aa.map(x=>x.id)
        );

      if(se) throw se;

      setSubmissions(
        (s ?? []) as Submission[]
      );
    }else{
      setSubmissions([]);
    }

    const {data:r} =
      await supabase
        .from('buklod_point_rules')
        .select('base_points')
        .eq(
          'activity_type',
          'daily_bible'
        )
        .eq(
          'is_active',
          true
        )
        .maybeSingle();

    if(r?.base_points != null){
      setPoints(
        Number(r.base_points)
      );
    }

  }, [days]);`;

t=
  t.slice(0,loadStart)+
  newLoad+
  t.slice(
    loadEnd+
    loadEndMarker.length
  );

/* ============================================================
   RESTORE QUESTION ANSWERS
============================================================ */

if(
  !t.includes(
    'savedQuestionAnswers'
  )
){
  const restore=
`    setAnswer(submission?.answer_text ?? '');
    setLanguage(submission?.answer_language ?? 'fil');`;

  if(t.includes(restore)){
    t=t.replace(
      restore,
`    setAnswer(submission?.answer_text ?? '');

    const savedQuestionAnswers =
      Array.isArray(
        submission?.question_answers
      )
        ? submission!.question_answers!
        : [];

    setQuestionAnswers([
      String(savedQuestionAnswers[0] ?? ''),
      String(savedQuestionAnswers[1] ?? ''),
      String(savedQuestionAnswers[2] ?? ''),
      String(savedQuestionAnswers[3] ?? ''),
    ]);

    setLanguage(
      submission?.answer_language ?? 'fil'
    );`
    );
  }
}

/* ============================================================
   QUESTION LOGIC
============================================================ */

const validationRx=
/\/\* DAILY_BIBLE_ANSWER_REQUIRED_20260811 \*\/[\s\S]*?const reflectionEvidenceOkay\s*=\s*answer\.trim\(\)\.length >= 20;/;

if(validationRx.test(t)){
  t=t.replace(
    validationRx,
`/* PATCH_154V_FOUR_QUESTIONS */

  const chapterQuestions =
    (
      language === 'fil'
        ? selected?.chapter_questions_fil
        : selected?.chapter_questions_en
    ) ?? [];

  const chapterAnswersOkay =
    chapterQuestions.length >= 4 &&
    chapterQuestions
      .slice(0,4)
      .every(
        (_,index)=>
          String(
            questionAnswers[index] ?? ''
          ).trim().length >= 10
      );

  const reflectionEvidenceOkay =
    answer.trim().length >= 20;`
  );
}

/* ============================================================
   REQUIRE QUESTIONS BEFORE SUBMISSION
============================================================ */

if(
  !t.includes(
    "'Chapter Questions Required'"
  )
){
  const submitAnchor=
`    if (!reflectionEvidenceOkay) {`;

  const at=
    t.indexOf(
      submitAnchor
    );

  if(at>=0){
    t=
      t.slice(0,at)+
`    if (!chapterAnswersOkay) {
      Alert.alert(
        'Chapter Questions Required',
        'Answer all four questions before submitting your Daily Bible reflection.'
      );
      return;
    }

`+
      t.slice(at);
  }
}

/* ============================================================
   NEW RPC
============================================================ */

t=t.replace(
  /supabase\.rpc\('submit_daily_bible_evidence',\{/g,
  `supabase.rpc('submit_daily_bible_evidence_v2',{`
);

if(
  !t.includes(
    'p_question_answers:['
  )
){
  const rpcAnchor=
`        p_reflection_photo_path:finalReflectionPath,
      });`;

  if(t.includes(rpcAnchor)){
    t=t.replace(
      rpcAnchor,
`        p_reflection_photo_path:finalReflectionPath,

        p_question_answers:[
          questionAnswers[0].trim(),
          questionAnswers[1].trim(),
          questionAnswers[2].trim(),
          questionAnswers[3].trim(),
        ],
      });`
    );
  }
}

/* canSubmit */
t=t.replace(
`    !locked &&
    reflectionEvidenceOkay;`,
`    !locked &&
    chapterAnswersOkay &&
    reflectionEvidenceOkay;`
);

/* ============================================================
   REPLACE OLD SINGLE QUESTION WITH FOUR QUESTIONS
============================================================ */

const oldQuestionStart=
  t.indexOf(
    '<Text style={styles.eyebrow}>REFLECTION QUESTION</Text>'
  );

if(oldQuestionStart>=0){

  const languageRow=
    t.indexOf(
      '<View style={styles.langRow}>',
      oldQuestionStart
    );

  if(languageRow>=0){

    t=
      t.slice(0,oldQuestionStart)+
`<Text style={styles.eyebrow}>
              RESPONSE LANGUAGE
            </Text>

            `+
      t.slice(languageRow);

    const currentLangRow=
      t.indexOf(
        '<View style={styles.langRow}>',
        oldQuestionStart
      );

    const rowClose=
      t.indexOf(
        '</View>',
        currentLangRow
      );

    if(rowClose>=0){

      const insertAt=
        rowClose+
        '</View>'.length;

      const ui=`

            <Text
              style={[
                styles.eyebrow,
                {marginTop:16}
              ]}
            >
              QUESTIONS ABOUT TODAY'S SCRIPTURE *
            </Text>

            <Text style={styles.help}>
              Answer all four questions before submitting your reflection.
            </Text>

            {chapterQuestions
              .slice(0,4)
              .map(
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
                        questionAnswers[index] ??
                        ''
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
                          ? 'Isulat ang sagot...'
                          : 'Write your answer...'
                      }
                      placeholderTextColor="#89958E"
                      style={[
                        styles.input,
                        {
                          minHeight:76,
                          marginTop:7
                        }
                      ]}
                    />

                    <Text style={styles.meta}>
                      {
                        String(
                          questionAnswers[index] ??
                          ''
                        ).trim().length
                      } characters | minimum 10
                    </Text>
                  </View>
                )
              )}
`;

      t=
        t.slice(0,insertAt)+
        ui+
        t.slice(insertAt);
    }
  }
}

/* Rename reflection field */
t=t.replace(
  '<Text style={styles.eyebrow}>1. REFLECTION *</Text>',
  '<Text style={styles.eyebrow}>PERSONAL REFLECTION *</Text>'
);

t=t.replace(
  'placeholder="What did you learn, and how will you apply it?"',
  'placeholder="Write your personal reflection and application..."'
);

fs.writeFileSync(
  file,
  t,
  'utf8'
);


/* ============================================================
   DATABASE
============================================================ */

const migration=path.resolve(
  'supabase/migrations/20260812024500_patch154v_auto_dashboard_four_questions.sql'
);

const sql=String.raw`
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


create or replace function
public.generate_bible_chapter_questions_v2(
  p_reference text
)
returns jsonb
language plpgsql
immutable
set search_path=''
as $$
declare
  ref_text text :=
    trim(coalesce(p_reference,''));
begin

  if ref_text='' then
    raise exception
      'Bible reference is required';
  end if;

  return jsonb_build_object(

    'fil',
    jsonb_build_array(
      'Ano ang pangunahing pangyayari o mensahe sa ' ||
        ref_text || '?',

      'Anong talata o bahagi ng ' ||
        ref_text ||
        ' ang pinaka-napansin mo, at bakit?',

      'Ano ang itinuturo ng ' ||
        ref_text ||
        ' tungkol sa Diyos, sa tao, o sa pananampalataya?',

      'Ano ang isang konkretong bagay na maaari mong gawin bilang tugon sa ' ||
        ref_text || '?'
    ),

    'en',
    jsonb_build_array(
      'What is the main event or message in ' ||
        ref_text || '?',

      'Which verse or part of ' ||
        ref_text ||
        ' stood out to you most, and why?',

      'What does ' ||
        ref_text ||
        ' teach about God, people, or faith?',

      'What is one concrete action you can take in response to ' ||
        ref_text || '?'
    )

  );

end;
$$;


/* Fill automatic/current assignments */
update public.daily_bible_assignments a
set
  chapter_questions_fil =
    (
      public.generate_bible_chapter_questions_v2(
        a.bible_reference
      )
    )->'fil',

  chapter_questions_en =
    (
      public.generate_bible_chapter_questions_v2(
        a.bible_reference
      )
    )->'en'

where
  jsonb_array_length(
    coalesce(
      a.chapter_questions_fil,
      '[]'::jsonb
    )
  ) < 4
  or
  jsonb_array_length(
    coalesce(
      a.chapter_questions_en,
      '[]'::jsonb
    )
  ) < 4;


/* Preserve original submission behavior */
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
set search_path=''
as $$
declare
  new_id uuid;
  valid_answers integer;
begin

  if
    p_question_answers is null
    or jsonb_typeof(
      p_question_answers
    ) <> 'array'
    or jsonb_array_length(
      p_question_answers
    ) <> 4
  then
    raise exception
      'All four Daily Bible questions must be answered';
  end if;

  select count(*)
  into valid_answers
  from jsonb_array_elements_text(
    p_question_answers
  ) answer_value
  where char_length(
    trim(answer_value)
  ) >= 10;

  if valid_answers <> 4 then
    raise exception
      'Each Daily Bible answer must contain at least 10 characters';
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
  set question_answers =
    p_question_answers
  where id=new_id;

  return new_id;

end;
$$;

revoke all on function
public.submit_daily_bible_evidence_v2(
  uuid,text,text,text,text,text,jsonb
)
from public;

grant execute on function
public.submit_daily_bible_evidence_v2(
  uuid,text,text,text,text,text,jsonb
)
to authenticated;
`;

fs.writeFileSync(
  migration,
  sql,
  'utf8'
);

console.log('');
console.log('PATCH 154V-FIX WRITTEN');
console.log('✓ Dashboard now uses automatic current week');
console.log('✓ Today Genesis 5-6 should no longer disappear');
console.log('✓ 4 generated Scripture questions');
console.log('✓ 4 answers required');
console.log('✓ separate personal reflection retained');
console.log('✓ automatic Bible plan remains source of truth');
console.log('');

