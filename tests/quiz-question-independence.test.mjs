import test from 'node:test';
import assert from 'node:assert/strict';
import {detectQuestionDependency,detectItemDependency} from '../supabase/functions/buklod-quiz-pdf/questionIndependence.mjs';
const invalid = [
  [
    "Based on Question 35, what should be done?",
    "NUMBERED_OTHER_ITEM"
  ],
  [
    "Refer to item no. 12 before answering.",
    "NUMBERED_OTHER_ITEM"
  ],
  [
    "What was your answer to question 4?",
    "NUMBERED_OTHER_ITEM"
  ],
  [
    "Read Q#11 first.",
    "SHORT_NUMBERED_ITEM"
  ],
  [
    "Based on the previous question, select the intervention.",
    "RELATIVE_OTHER_ITEM"
  ],
  [
    "Consider the case above and choose the priority.",
    "OTHER_ITEM_POSITION"
  ],
  [
    "Use the following chart to identify the trend.",
    "REFERENCE_INSTRUCTION"
  ],
  [
    "According to the table below, which is highest?",
    "OTHER_ITEM_POSITION"
  ],
  [
    "Which questions appear on page 4 of the handout?",
    "SOURCE_PAGE_REFERENCE"
  ],
  [
    "Refer to the next slide for the answer.",
    "RELATIVE_SOURCE_PAGE"
  ],
  [
    "Ano ang sagot sa tanong bilang 12?",
    "NUMBERED_OTHER_ITEM"
  ],
  [
    "Batay sa nakaraang tanong, ano ang gagawin?",
    "FILIPINO_OTHER_ITEM"
  ],
  [
    "Sa pahina 4, ano ang isinulat?",
    "SOURCE_PAGE_REFERENCE"
  ],
  [
    "As shown in the uploaded document, which example is correct?",
    "DOCUMENT_META"
  ]
];
const valid = [
  "Which of the following interventions is the best initial response to a client with fever and dehydration?",
  "A nurse assesses a client with a respiratory rate of 32 breaths/minute. Which action takes priority?",
  "Which of the following questions should the nurse ask to screen for exposure?",
  "Under Republic Act No. 11223, what is the coverage of universal health care?",
  "A student reviews Section VII of a checklist. Which supplies are needed?",
  "A clinical instructor describes a complete case within this question: The patient is unresponsive but breathing. What is the next step?",
  "Alin sa mga sumusunod ang tamang hakbang para sa pasyenteng nahihilo?"
];
for(const [s,expected] of invalid) test('blocks: '+s,()=>assert.equal(detectQuestionDependency(s),expected));
for(const s of valid) test('allows: '+s,()=>assert.equal(detectQuestionDependency(s),null));
test('blocks dependencies in options',()=>assert.equal(detectItemDependency({prompt:valid[0],options:['See question 15','B','C','D'],explanation:'Reason'}),'NUMBERED_OTHER_ITEM'));
test('blocks dependencies in explanations',()=>assert.equal(detectItemDependency({prompt:valid[0],options:['A','B','C','D'],explanation:'As stated on page 4 of the module.'}),'SOURCE_PAGE_REFERENCE'));
test('allows self-contained item',()=>assert.equal(detectItemDependency({prompt:valid[0],options:['A','B','C','D'],explanation:'Assess the immediate clinical risk.'}),null));
