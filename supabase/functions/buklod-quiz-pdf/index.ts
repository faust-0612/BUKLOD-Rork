/* BUKLOD_QUIZ_EXAM_LANGUAGE_R8_7_BACKEND */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { unzipSync, strFromU8 } from 'npm:fflate@0.8.2';
import { detectItemDependency } from './questionIndependence.mjs';

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});

const CANONICAL_TYPES=['MCQ','TRUE_FALSE','SHORT_TEXT','NUMERIC','ESSAY','ENUMERATION','MANUAL'] as const;
const DOCX_MIME='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PDF_MIME='application/pdf';
const MAX_SOURCE_BYTES=10*1024*1024;
const MAX_DOCX_TEXT_CHARS=350000;
const MAX_SOURCE_FILES=100;
const BUKLOD_QUIZ_PDF_WORD_MULTI_V7='BUKLOD_QUIZ_PDF_WORD_MULTI_V7';

const schema={
  type:'object',additionalProperties:false,required:['questions'],properties:{
    questions:{type:'array',items:{type:'object',additionalProperties:false,
      required:['question_type','prompt','options','correct_answer','points','explanation','source_pages'],
      properties:{
        question_type:{type:'string',enum:[...CANONICAL_TYPES]},
        prompt:{type:'string'},options:{type:['array','null'],items:{type:'string'}},
        correct_answer:{type:['string','null']},points:{type:'number'},
        explanation:{type:['string','null']},source_pages:{type:['string','null']}
      }
    }}
  }
};

function b64(buffer:ArrayBuffer){
  const bytes=new Uint8Array(buffer); let out=''; const chunk=0x8000;
  for(let i=0;i<bytes.length;i+=chunk) out+=String.fromCharCode(...bytes.subarray(i,Math.min(i+chunk,bytes.length)));
  return btoa(out);
}
function clean(v:unknown){
  const s=v instanceof Error?v.message:String(v??'Document generation failed.');
  return s.replace(/AIza[0-9A-Za-z_-]{20,}/g,'[redacted]').slice(0,1800);
}
function transient(status:number,text:string){return status===429||status>=500||/UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|rate.?limit|temporar|overload|timeout/i.test(text)}
function normPrompt(s:string){return s.toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()}
function fileExt(name:string){const m=String(name??'').toLowerCase().match(/\.([a-z0-9]+)$/); return m?.[1]??''}
function effectiveMime(doc:any){
  const raw=String(doc?.mime_type??'').toLowerCase();
  const ext=fileExt(String(doc?.file_name??''));
  if(raw===PDF_MIME||ext==='pdf') return PDF_MIME;
  if(raw===DOCX_MIME||ext==='docx') return DOCX_MIME;
  return raw;
}

function canonicalType(value:unknown):string|null{
  const raw=String(value??'').trim();
  if(!raw) return null;
  const key=raw.toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'');
  const map:Record<string,string>={
    MCQ:'MCQ', MULTIPLE_CHOICE:'MCQ', MULTIPLE_CHOICE_QUESTION:'MCQ', MULTIPLECHOICE:'MCQ', CHOICE:'MCQ',
    TRUE_FALSE:'TRUE_FALSE', TRUE_OR_FALSE:'TRUE_FALSE', TRUEFALSE:'TRUE_FALSE', TF:'TRUE_FALSE',
    SHORT_TEXT:'SHORT_TEXT', SHORT_ANSWER:'SHORT_TEXT', SHORTANSWER:'SHORT_TEXT', IDENTIFICATION:'SHORT_TEXT', IDENTIFY:'SHORT_TEXT', ID:'SHORT_TEXT',
    NUMERIC:'NUMERIC', NUMBER:'NUMERIC', NUMERICAL:'NUMERIC', COMPUTATION:'NUMERIC',
    ESSAY:'ESSAY', LONG_ANSWER:'ESSAY', LONG_TEXT:'ESSAY',
    ENUMERATION:'ENUMERATION', ENUMERATE:'ENUMERATION', LIST:'ENUMERATION',
    MANUAL:'MANUAL', MANUAL_GRADING:'MANUAL', SUBJECTIVE:'MANUAL'
  };
  if(map[key]) return map[key];
  if(key.includes('MULTIPLE')&&key.includes('CHOICE')) return 'MCQ';
  if(key.includes('TRUE')&&key.includes('FALSE')) return 'TRUE_FALSE';
  if(key.includes('IDENTIF')||key.includes('SHORT_ANSWER')||key.includes('SHORT_TEXT')) return 'SHORT_TEXT';
  if(key.includes('NUMERIC')||key.includes('NUMERICAL')||key.includes('COMPUT')) return 'NUMERIC';
  if(key.includes('ESSAY')||key.includes('LONG_ANSWER')) return 'ESSAY';
  if(key.includes('ENUMER')) return 'ENUMERATION';
  return null;
}

function readRequestedTypes(body:any):string[]{
  const raw=body?.question_types??body?.questionTypes??body?.types??body?.selected_types??body?.selectedTypes??body?.question_type??body?.questionType??body?.type;
  const arr=Array.isArray(raw)?raw:(raw==null?[]:[raw]);
  const mapped=arr.map(canonicalType).filter((x):x is string=>!!x);
  return [...new Set(mapped)];
}
function readQuestionCount(body:any):number{
  const raw=body?.question_count??body?.questionCount??body?.count??body?.number_of_questions??body?.numberOfQuestions??body?.items??50;
  return Math.max(1,Math.min(200,Math.round(Number(raw)||50)));
}
function readDocumentIds(body:any):string[]{
  const raw=body?.document_ids??body?.documentIds??body?.documents??[];
  const arr=Array.isArray(raw)?raw:[];
  const single=body?.document_id??body?.documentId;
  const all=[...arr,...(single?[single]:[])].map(x=>String(x??'').trim()).filter(Boolean);
  return [...new Set(all)].slice(0,MAX_SOURCE_FILES);
}

function normalizeExamLanguage(value:unknown):'ENGLISH'|'TAGLISH'|'FILIPINO'{
  const raw=String(value??'ENGLISH').trim().toUpperCase();
  if(raw==='TAGLISH') return 'TAGLISH';
  if(raw==='FILIPINO'||raw==='TAGALOG'||raw==='TAGALIZE'||raw==='TAGALISED'||raw==='TAGALIZED') return 'FILIPINO';
  return 'ENGLISH';
}
function examLanguageInstruction(language:string){
  if(language==='TAGLISH'){
    return [
      'EXAM LANGUAGE: TAGLISH.',
      'Write EVERY generated question stem, MCQ option, expected-answer wording, and explanation in natural classroom Taglish (Filipino-English mix).',
      'Keep technical, biblical, scientific, medical, legal, and proper terms in English when that is the clearer conventional term.',
      'Do not switch individual questions to pure English or pure Filipino unless an exact source quotation or standard term requires it.',
    ].join(' ');
  }
  if(language==='FILIPINO'){
    return [
      'EXAM LANGUAGE: FILIPINO/TAGALOG.',
      'Write EVERY generated question stem, MCQ option, expected-answer wording, and explanation primarily in natural Filipino/Tagalog.',
      'Keep technical terms, acronyms, proper nouns, Bible book names, exact quotations, or conventional English terms unchanged when translating them would reduce accuracy.',
      'Avoid unnecessary English mixing.',
    ].join(' ');
  }
  return [
    'EXAM LANGUAGE: ENGLISH.',
    'Write EVERY generated question stem, MCQ option, expected-answer wording, and explanation in clear natural academic English.',
    'Preserve exact source quotations and proper nouns when needed.',
  ].join(' ');
}

function decodeXmlEntities(text:string){
  return text
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&')
    .replace(/&quot;/g,'"').replace(/&apos;/g,"'")
    .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)||32))
    .replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)||32));
}
function xmlToText(xml:string){
  return decodeXmlEntities(
    xml
      .replace(/<w:tab\b[^>]*\/>/g,'\t')
      .replace(/<w:br\b[^>]*\/>/g,'\n')
      .replace(/<\/w:p>/g,'\n')
      .replace(/<\/w:tr>/g,'\n')
      .replace(/<[^>]+>/g,'')
  )
    .replace(/\r/g,'')
    .replace(/[ \t]+\n/g,'\n')
    .replace(/\n{3,}/g,'\n\n')
    .replace(/[ \t]{2,}/g,' ')
    .trim();
}
function extractDocxText(buffer:ArrayBuffer){
  let zip:Record<string,Uint8Array>;
  try{zip=unzipSync(new Uint8Array(buffer))}catch{throw new Error('Word .docx could not be opened. Re-save it as a standard .docx file and try again.')}
  const names=Object.keys(zip).filter(name=>
    name==='word/document.xml'||
    /^word\/header\d+\.xml$/i.test(name)||
    /^word\/footer\d+\.xml$/i.test(name)||
    name==='word/footnotes.xml'||
    name==='word/endnotes.xml'
  );
  if(!names.includes('word/document.xml')) throw new Error('Word .docx has no readable document content.');
  const parts:string[]=[];
  for(const name of names){
    const bytes=zip[name];
    if(!bytes) continue;
    const text=xmlToText(strFromU8(bytes));
    if(text) parts.push(text);
  }
  const out=parts.join('\n\n').trim();
  if(!out) throw new Error('Word .docx contains no readable text.');
  return out.slice(0,MAX_DOCX_TEXT_CHARS);
}

function allocateEven(total:number,count:number){
  const base=Math.floor(total/count); const rem=total%count;
  return Array.from({length:count},(_,i)=>base+(i<rem?1:0));
}

async function callModel(args:{apiKey:string,model:string,count:number,batchNo:number,totalBatches:number,difficulty:string,types:string[],sourceName:string,sourcePart:any,pageRule:string,examLanguage:string}){
  const onlyType=args.types.length===1
    ?`Every generated question MUST have question_type exactly ${args.types[0]}. Do not generate any other type.`
    :`Allowed question types are ONLY: ${args.types.join(', ')}. Do not output any type outside this list.`;
  const prompt=[
    'Create editable DRAFT exam questions from the examiner-provided lecture/module source document.',
    `Source file: ${args.sourceName}.`,
    args.pageRule,
    `Diversity partition ${args.batchNo} of ${args.totalBatches}: generate exactly ${args.count} candidate questions and cover a broad, different set of concepts from this source. Avoid near-duplicate stems and avoid repeating the same fact in slightly different wording.`,
    `Difficulty: ${args.difficulty}. ${onlyType}`,
    examLanguageInstruction(args.examLanguage),
    'The selected EXAM LANGUAGE applies to the whole generated exam, not question-by-question. Keep the same language mode across all questions in this request.',
    'Use only facts supported by this source document. Do not invent material.',
    'Every question MUST be completely independently answerable in any shuffle order/page, without referring to a different question or numbered item, an earlier/later answer, source page/slide, or a chart/table/case/passage not present inside the current question stem. Place all necessary data in the same item or omit it.',
    'MCQ: exactly four distinct plausible options and one correct_answer that exactly matches one option.',
    'TRUE_FALSE: correct_answer must be TRUE or FALSE.',
    'SHORT_TEXT/NUMERIC: provide a concise objectively gradable correct_answer.',
    'ESSAY/ENUMERATION/MANUAL may use null correct_answer when no single answer exists; give a short expected-answer rationale in explanation.',
    'source_pages: for PDF use the page/range when confidently identifiable. For Word use a short section/heading reference when identifiable. Otherwise null.',
    'Return only schema-compliant JSON. Never publish; examiner review is required.'
  ].join('\n');
  const endpoint=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(args.model)}:generateContent`;
  const r=await fetch(endpoint,{method:'POST',headers:{'x-goog-api-key':args.apiKey,'Content-Type':'application/json'},body:JSON.stringify({
    contents:[{role:'user',parts:[{text:prompt},args.sourcePart]}],
    generationConfig:{responseMimeType:'application/json',responseJsonSchema:schema,maxOutputTokens:32000}
  })});
  const raw=await r.text();
  if(!r.ok){const e:any=new Error(`${args.model} failed (${r.status}): ${raw}`); e.status=r.status; e.raw=raw; throw e}
  let payload:any; try{payload=JSON.parse(raw)}catch{throw new Error(`${args.model} returned an unreadable API response.`)}
  const finish=payload?.candidates?.[0]?.finishReason??'unknown';
  const text=(payload?.candidates?.[0]?.content?.parts??[]).map((p:any)=>typeof p?.text==='string'?p.text:'').join('').trim();
  if(!text) throw new Error(`${args.model} returned no question JSON. Finish reason: ${finish}.`);
  let parsed:any; try{parsed=JSON.parse(text)}catch{throw new Error(`${args.model} returned incomplete JSON. Finish reason: ${finish}.`)}
  const qs=Array.isArray(parsed?.questions)?parsed.questions:[];
  if(!qs.length) throw new Error(`${args.model} returned zero questions.`);
  return qs;
}

async function generateWithFallback(args:{apiKey:string,count:number,batchNo:number,totalBatches:number,difficulty:string,types:string[],sourceName:string,sourcePart:any,pageRule:string,examLanguage:string}){
  const models=[
    'gemini-3.8-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash'
  ];
  const failures:string[]=[];
  for(const model of models){
    try{return {qs:await callModel({...args,model}),model}}
    catch(e:any){
      const msg=clean(e); failures.push(`${model}: ${msg}`);
      const status=Number(e?.status||0); const raw=String(e?.raw||msg);
      console.error(`[BUKLOD_QUIZ_DOC_MODEL_FAIL] file=${args.sourceName} batch=${args.batchNo} model=${model} :: ${msg}`);
      if(status===401||status===403) throw new Error(msg);
      await new Promise(r=>setTimeout(r,status===429?150:350));
    }
  }
  const allQuota=failures.length>0&&failures.every(x=>/\(429\)|RESOURCE_EXHAUSTED|quota/i.test(x));
  if(allQuota){
    throw new Error('AI_QUOTA_TEMPORARY: All available AI model quotas are temporarily exhausted. No questions were saved by this failed run. Your source files can be retried later.');
  }
  throw new Error(`All Gemini fallback models failed for ${args.sourceName}. ${failures.join(' | ')}`);
}

async function generateSourceCandidates(args:{apiKey:string,count:number,difficulty:string,types:string[],sourceName:string,sourcePart:any,pageRule:string,examLanguage:string}){
  const totalBatches=args.count<=60?1:Math.ceil(args.count/50);
  const perBatch=Math.ceil(args.count/totalBatches);
  const all:any[]=[]; const models:string[]=[];
  for(let batchNo=1;batchNo<=totalBatches;batchNo++){
    const left=args.count-all.length;
    if(left<=0) break;
    const batchCount=Math.min(perBatch,left);
    const {qs,model}=await generateWithFallback({...args,count:batchCount,batchNo,totalBatches});
    all.push(...qs); models.push(model);
  }
  return {questions:all,models};
}

function validateQuestions(raw:any[],args:{types:string[],sourceName:string,sourceDocumentId:string,seen:Set<string>}){
  const requestedTypeSet=new Set(args.types); const valid:any[]=[];
  for(const q of raw){
    const generatedType=canonicalType(q?.question_type);
    if(!generatedType||!requestedTypeSet.has(generatedType)) continue;
    const t=generatedType;
    const prompt=String(q?.prompt??'').trim(); if(!prompt || detectItemDependency(q)) continue;
    const key=normPrompt(prompt); if(!key||args.seen.has(key)) continue;
    const options=t==='MCQ'&&Array.isArray(q?.options)?q.options.map((x:any)=>String(x).trim()).filter(Boolean).slice(0,4):null;
    if(t==='MCQ'&&(!options||options.length!==4||new Set(options).size!==4)) continue;
    let answer=q?.correct_answer==null?null:String(q.correct_answer).trim();
    if(['MCQ','TRUE_FALSE','SHORT_TEXT','NUMERIC'].includes(t)&&!answer) continue;
    if(t==='MCQ'&&!options!.includes(answer!)) continue;
    if(t==='TRUE_FALSE'){answer=String(answer).toUpperCase(); if(!['TRUE','FALSE'].includes(answer)) continue;}
    args.seen.add(key);
    const loc=q?.source_pages?String(q.source_pages).slice(0,100):'';
    valid.push({
      question_type:t,prompt,options,correct_answer:answer,
      points:Math.max(.1,Number(q?.points??1)||1),
      source_pages:(loc?`${args.sourceName} - ${loc}`:args.sourceName).slice(0,240),
      explanation:q?.explanation?String(q.explanation).slice(0,3000):null,
      source_document_id:args.sourceDocumentId,
    });
  }
  return valid;
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
  if(req.method!=='POST') return json({error:'POST required.'},405);

  const url=Deno.env.get('SUPABASE_URL')??'';
  const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'';
  const anon=Deno.env.get('SUPABASE_ANON_KEY')??Deno.env.get('SUPABASE_PUBLISHABLE_KEY')??'';
  const geminiKey=Deno.env.get('GEMINI_API_KEY')??'';
  const authHeader=req.headers.get('Authorization')??'';
  let admin:any=null; let documentIds:string[]=[];

  try{
    if(!url||!service||!anon) throw new Error('Supabase function secrets are incomplete.');
    if(!geminiKey) throw new Error('GEMINI_API_KEY is not configured.');
    if(!authHeader.toLowerCase().startsWith('bearer ')) return json({error:'Authentication required.'},401);

    admin=createClient(url,service,{auth:{persistSession:false}});
    const token=authHeader.replace(/^Bearer\s+/i,'').trim();
    const {data:userData,error:userErr}=await admin.auth.getUser(token);
    if(userErr||!userData?.user) return json({error:'Invalid or expired session.'},401);
    const userId=userData.user.id;

    const body=await req.json();
    const examId=String(body?.exam_id??body?.examId??'');
    documentIds=readDocumentIds(body);
    const requested=readQuestionCount(body);
    const pageStart=Math.max(1,Math.round(Number(body?.page_start??body?.pageStart??1)||1));
    const pageEndRaw=body?.page_end??body?.pageEnd;
    const pageEnd=pageEndRaw?Math.max(pageStart,Math.round(Number(pageEndRaw))):null;
    const difficulty=String(body?.difficulty??'mixed').slice(0,80);
    let types=readRequestedTypes(body);
    if(!types.length){const fallbackType=canonicalType(body?.selectedQuestionType??body?.mode??body?.question_mode); if(fallbackType) types=[fallbackType]}

    if(!examId||!documentIds.length) throw new Error('exam_id and at least one document_id are required.');
    if(!types.length) throw new Error('No recognizable question type was received. Please choose MCQ, True/False, Identification, Numeric, Essay, or Enumeration.');
    if(documentIds.length>requested) throw new Error(`You selected ${documentIds.length} source files but requested only ${requested} questions. Request at least one question per source file.`);

    const {data:exam}=await admin.from('buklod_quiz_exams').select('id,owner_user_id,exam_language').eq('id',examId).single();
    if(!exam||exam.owner_user_id!==userId) return json({error:'Exam not found or unauthorized.'},403);

    const examLanguage=normalizeExamLanguage(
      body?.exam_language??body?.examLanguage??exam.exam_language??'ENGLISH'
    );

    if(String(exam.exam_language??'ENGLISH')!==examLanguage){
      const {error:languageSaveError}=await admin
        .from('buklod_quiz_exams')
        .update({exam_language:examLanguage})
        .eq('id',examId)
        .eq('owner_user_id',userId);
      if(languageSaveError) throw new Error(`Could not save exam language: ${languageSaveError.message}`);
    }

    console.log(`[BUKLOD_QUIZ_DOC_REQUEST] docs=${documentIds.length} requested=${requested} types=${types.join(',')} difficulty=${difficulty} language=${examLanguage}`);

    const {data:docRows,error:docErr}=await admin.from('buklod_quiz_documents').select('*').eq('exam_id',examId).in('id',documentIds);
    if(docErr) throw docErr;
    if(!Array.isArray(docRows)||docRows.length!==documentIds.length) throw new Error('One or more source documents were not found.');
    const byId=new Map(docRows.map((d:any)=>[String(d.id),d]));
    const docs=documentIds.map(id=>byId.get(id));
    if(docs.some((d:any)=>!d||d.owner_user_id!==userId)) return json({error:'Document not found or unauthorized.'},403);

    for(const doc of docs){
      const mime=effectiveMime(doc);
      if(mime!==PDF_MIME&&mime!==DOCX_MIME) throw new Error(`Unsupported source file: ${doc.file_name}. Use PDF or Word .docx.`);
    }

    await admin.from('buklod_quiz_documents').update({status:'PROCESSING',processing_note:`Generating a combined ${requested}-question ${examLanguage} draft from ${docs.length} selected source file(s).`,processed_at:null}).in('id',documentIds);

    const targetCounts=allocateEven(requested,docs.length);
    const seen=new Set<string>();
    const perSourceValid:any[][]=[];
    const modelsUsed:string[]=[];

    for(let i=0;i<docs.length;i++){
      const doc:any=docs[i];
      const target=targetCounts[i];
      const candidateCount=Math.min(200,Math.max(target+2,Math.ceil(target*1.2)));
      await admin.from('buklod_quiz_documents').update({processing_note:`Reading source ${i+1}/${docs.length}: ${String(doc.file_name).slice(0,120)}`}).eq('id',doc.id);

      const {data:blob,error:dlErr}=await admin.storage.from('buklod-quiz-source-docs').download(doc.storage_path);
      if(dlErr||!blob) throw new Error(`Download failed for ${doc.file_name}: ${dlErr?.message??'file unavailable'}`);
      const buffer=await blob.arrayBuffer();
      if(!buffer.byteLength) throw new Error(`${doc.file_name} is empty.`);
      if(buffer.byteLength>MAX_SOURCE_BYTES) throw new Error(`${doc.file_name} is larger than 10 MB. Split that single file into smaller files; you may select multiple files together.`);

      const mime=effectiveMime(doc);
      let sourcePart:any;
      let pageRule='Use the full source document.';
      if(mime===PDF_MIME){
        sourcePart={inline_data:{mime_type:PDF_MIME,data:b64(buffer)}};
        if(docs.length===1){pageRule=pageEnd?`Use only PDF pages ${pageStart} through ${pageEnd}.`:`Use PDF pages starting at page ${pageStart}.`}
      }else{
        const wordText=extractDocxText(buffer);
        sourcePart={text:`WORD DOCUMENT CONTENT (${doc.file_name})\n\n${wordText}`};
        pageRule='Use the full Word document. Refer to a heading/section in source_pages when identifiable.';
      }

      await admin.from('buklod_quiz_documents').update({processing_note:`Generating from source ${i+1}/${docs.length}: ${String(doc.file_name).slice(0,120)}`}).eq('id',doc.id);
      const generated=await generateSourceCandidates({apiKey:geminiKey,count:candidateCount,difficulty,types,sourceName:String(doc.file_name),sourcePart,pageRule,examLanguage});
      modelsUsed.push(...generated.models);
      const valid=validateQuestions(generated.questions,{types,sourceName:String(doc.file_name),sourceDocumentId:String(doc.id),seen});
      perSourceValid.push(valid);
    }

    const selected:any[]=[]; const extras:any[]=[];
    for(let i=0;i<perSourceValid.length;i++){
      const valid=perSourceValid[i]; const target=targetCounts[i];
      selected.push(...valid.slice(0,target)); extras.push(...valid.slice(target));
    }
    if(selected.length<requested) selected.push(...extras.slice(0,requested-selected.length));
    if(selected.length<requested) throw new Error(`Only ${selected.length} unique valid ${types.join('/')} questions were produced out of ${requested} requested from ${docs.length} source file(s). Nothing was saved; retry is safe.`);
    const prepared=selected.slice(0,requested);

    const {data:maxRows,error:maxErr}=await admin.from('buklod_quiz_questions').select('sort_order').eq('exam_id',examId).order('sort_order',{ascending:false}).limit(1);
    if(maxErr) throw maxErr; let sort=Number(maxRows?.[0]?.sort_order??0);
    const rows=prepared.map(q=>({...q,exam_id:examId,sort_order:++sort,is_active:true,created_by:userId}));
    const {error:insErr}=await admin.from('buklod_quiz_questions').insert(rows);
    if(insErr) throw new Error(`Question save failed: ${insErr.message}`);

    const modelSummary=[...new Set(modelsUsed)].join(', ');
    await admin.from('buklod_quiz_documents').update({status:'READY',processed_at:new Date().toISOString(),processing_note:`Generated ${rows.length} ${types.join('/')} ${examLanguage} draft questions from ${docs.length} selected PDF/Word source file(s). Models used: ${modelSummary}.`}).in('id',documentIds);
    console.log(`[BUKLOD_QUIZ_DOC_OK] docs=${docs.length} requested=${requested} saved=${rows.length} types=${types.join(',')} language=${examLanguage} models=${modelSummary}`);
    return json({ok:true,inserted_count:rows.length,document_ids:documentIds,source_count:docs.length,question_types:types,requested_count:requested,exam_language:examLanguage,models_used:[...new Set(modelsUsed)]});
  }catch(e){
    const message=clean(e); console.error(`[BUKLOD_QUIZ_DOC_ERROR] docs=${documentIds.length} :: ${message}`);
    if(admin&&documentIds.length){try{await admin.from('buklod_quiz_documents').update({status:'FAILED',processing_note:message,processed_at:new Date().toISOString()}).in('id',documentIds)}catch{}}
    if(message.startsWith('AI_QUOTA_TEMPORARY:')){
      return json({ok:false,error:message.replace(/^AI_QUOTA_TEMPORARY:\s*/,''),code:'AI_QUOTA_TEMPORARY'},200);
    }
    return json({error:message},500);
  }
});
