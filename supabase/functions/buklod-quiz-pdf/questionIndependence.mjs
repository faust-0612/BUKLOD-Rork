/**
 * Fail-closed for item/page dependencies in randomized and paginated BUKLOD Quiz.
 * Ordinary "Which of the following" MCQs are not considered dependencies.
 * Shared stimuli require a future explicit atomic question-group representation.
 */
const RULES = [
  ['NUMBERED_OTHER_ITEM', /\b(?:question|questions|item|items|problem|problems|tanong)\s*(?:no\.?|number|bilang|blg\.?|#|:|-)?\s*\d{1,4}\b/i],
  ['SHORT_NUMBERED_ITEM', /\b(?:q\s*#\s*\d{1,4}|q\s*\d{1,4}\s*(?:above|below|before|after))\b/i],
  ['RELATIVE_OTHER_ITEM', /\b(?:previous|prior|preceding|earlier|next|subsequent|above|below|last|former|latter)\s+(?:question|item|answer|problem|case|scenario|passage|figure|table|diagram|chart)\b/i],
  ['OTHER_ITEM_POSITION', /\b(?:question|item|answer|case|scenario|passage|figure|table|diagram|chart)\s+(?:above|below|before|after)\b/i],
  ['ANSWER_REFERENCE', /\b(?:(?:your|the|an?)\s+)?(?:answer|response)\s+(?:to|from|in)\s+(?:question|item)\b/i],
  ['REFERENCE_INSTRUCTION', /\b(?:refer(?:ring)? to|see|use|using|based on|according to|as (?:shown|stated|mentioned|answered|described) in)\s+(?:the\s+)?(?:previous|prior|preceding|earlier|next|above|below|following|attached)\s+(?:question|item|answer|case|scenario|passage|figure|table|diagram|chart|text|image)\b/i],
  ['MISSING_STIMULUS', /\b(?:read|refer to|see|use|using|based on)\s+(?:the\s+)?(?:attached|previous|above|below|following)\s+(?:passage|table|figure|diagram|chart|image|case|scenario|text)\b/i],
  ['SOURCE_PAGE_REFERENCE', /\b(?:page|slide|pahina)\s*(?:no\.?|number|bilang|blg\.?|#|:|-)?\s*\d{1,4}\b/i],
  ['SOURCE_PAGE_CONTEXT', /\b(?:on|in|from|at|see|refer to|according to|as shown on)\s+(?:the\s+)?(?:page|slide|pahina)\b/i],
  ['RELATIVE_SOURCE_PAGE', /\b(?:next|previous|prior|above|below|following|preceding)\s+(?:page|slide|pahina)\b/i],
  ['FILIPINO_OTHER_ITEM', /\b(?:naunang|nakaraang|susunod|sumunod|nasa itaas|nasa ibaba)\s+(?:tanong|sagot|sitwasyon|kaso|talata|larawan|talahanayan)\b/i],
  ['FILIPINO_ANSWER_REFERENCE', /\b(?:sagot\s+(?:sa|ng)\s+tanong|batay\s+sa\s+(?:naunang|nakaraang|susunod)\s+(?:tanong|sagot))\b/i],
  ['DOCUMENT_META', /\b(?:as (?:shown|stated|mentioned) in|according to|based on)\s+(?:the\s+)?(?:uploaded (?:file|document)|source document|lecture notes|module|worksheet|activity)\b/i],
];
export function detectQuestionDependency(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  for (const [reason, pattern] of RULES) {
    if (pattern.test(value)) return reason;
  }
  return null;
}
export function detectItemDependency(question) {
  const pieces = [question?.prompt];
  if (Array.isArray(question?.options)) pieces.push(...question.options);
  pieces.push(question?.explanation);
  for (const piece of pieces) {
    const issue = detectQuestionDependency(piece);
    if (issue) return issue;
  }
  return null;
}
