// Server-only shared grading primitives. Caller must load a trusted, versioned rubric.
export const HYBRID_POLICY="hybrid-learning-v1";
export function normalizeObjective(value){
 if(typeof value!=="string"||value.length>2400)return "";
 return value.normalize("NFKC").toLowerCase().trim().replace(/[.,!?;:]+$/u,"").replace(/\s+/gu," ").trim();
}

export function objectiveGrade({answers,groups,required=1}){
 if(!Array.isArray(answers)||!Array.isArray(groups)||!Number.isInteger(required)||required<1||required>8||groups.length<required||groups.length>32||answers.length!==required)return {status:"invalid",units:0};
 const normalized=answers.map(normalizeObjective);
 if(normalized.some(x=>!x)||new Set(normalized).size!==normalized.length)return {status:"invalid",units:0};
 if(groups.some(g=>!Array.isArray(g)||!g.length||g.length>300||g.some(a=>!normalizeObjective(a))))return {status:"unresolved",units:0};
 const accepted=groups.map(g=>new Set(g.map(normalizeObjective)));
 // One answer can satisfy only one distinct concept. Maximum bipartite matching.
 const assigned=new Map();
 function assign(index,seen){
  for(let j=0;j<accepted.length;j++){
   if(seen.has(j)||!accepted[j].has(normalized[index]))continue;
   seen.add(j);
   if(!assigned.has(j)||assign(assigned.get(j),seen)){assigned.set(j,index);return true;}
  }
  return false;
 }
 let units=0;
 for(let i=0;i<normalized.length;i++)if(assign(i,new Set()))units++;
 return {status:units===required?"resolved":"unresolved",units};
}

export function cacheContext({module,questionContext,authoritativeSource,attachments}){
 if(module!=="lesson"||questionContext?.questionType!=="generated"||!Array.isArray(attachments)||attachments.length!==0||typeof authoritativeSource?.content_hash!=="string"||!authoritativeSource.content_hash.trim()||questionContext.serverVerifiedContentHash!==authoritativeSource.content_hash)return null;
 // Full source + exact server rubric version, not only a client-supplied identifier.
 return JSON.stringify([HYBRID_POLICY,questionContext,authoritativeSource]);
}

export function reusablePositive(row){
 return row?.status==="acceptable"&&row?.fail_open===false&&typeof row.model==="string"&&row.model.startsWith("gemini-")&&row.feedback&&typeof row.feedback.headline==="string"&&row.scores&&["overall","relevance","depth","clarity","effort"].every(k=>typeof row.scores[k]==="number"&&Number.isFinite(row.scores[k])&&row.scores[k]>=0&&row.scores[k]<=1)&&row.scores.overall>=.82&&row.scores.relevance>=.78&&row.scores.depth>=.72;
}
