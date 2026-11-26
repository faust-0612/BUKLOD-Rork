// Source evidence validation for Bible V4 shadow grading; no reward authority.
export function assessInput(source,answer){
 if(!source||!["enumeration","identification"].includes(source.kind)||!Array.isArray(source.groups)||source.groups.length<1||source.groups.length>32||!source.groups.every(g=>Array.isArray(g)&&g.length>0&&g.every(a=>typeof a==="string"&&a.length>0)))return null;
 const answers=source.kind==="identification"?[answer]:answer;
 if(!Array.isArray(answers)||answers.length!==(source.kind==="identification"?1:2)||answers.some(a=>typeof a!=="string"||!a.trim()||a.length>120))return null;
 const normalized=answers.map(a=>a.normalize("NFKC").trim().toLowerCase().replace(/\s+/gu," "));
 if(new Set(normalized).size!==answers.length)return null;
 return {answers,groups:source.groups};
}

export function validateVerdict(input,raw){
 if(!input||!raw||!Array.isArray(raw.items)||raw.items.length!==input.answers.length)return null;
 const concepts=[];
 for(let i=0;i<raw.items.length;i++){
  const v=raw.items[i];
  if(!v||v.index!==i||!Number.isInteger(v.concept)||v.concept< -1||v.concept>=input.groups.length||typeof v.confidence!=="number"||!Number.isFinite(v.confidence)||v.confidence<.90||v.confidence>1||v.contradiction!==false)return null;
  if(v.concept>=0){
   if(typeof v.answer_evidence!=="string"||!v.answer_evidence.trim()||!input.answers[i].includes(v.answer_evidence)||typeof v.rubric_evidence!=="string"||!input.groups[v.concept].includes(v.rubric_evidence))return null;
  }
  concepts.push(v.concept);
 }
 if(new Set(concepts.filter(x=>x>=0)).size!==concepts.filter(x=>x>=0).length)return null;
 return concepts;
}

export function concordant(input,a,b){
 const x=validateVerdict(input,a),y=validateVerdict(input,b);
 if(!x||!y||JSON.stringify(x)!==JSON.stringify(y))return null;
 const units=x.filter(v=>v>=0).length*(input.answers.length===1?2:1);
 return {concepts:x,units};
}
