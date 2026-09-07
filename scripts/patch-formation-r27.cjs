const fs = require('fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, value) {
  fs.writeFileSync(path, value, 'utf8');
}

function replaceOnce(path, from, to, label) {
  const source = read(path);
  const count = source.split(from).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected exactly one match in ${path}, found ${count}`);
  }
  write(path, source.replace(from, to));
}

function replaceRegexOnce(path, pattern, to, label) {
  const source = read(path);
  const matches = source.match(pattern);
  if (!matches || matches.length !== 1) {
    throw new Error(`${label}: expected exactly one regex match in ${path}`);
  }
  write(path, source.replace(pattern, to));
}

// 1) Contextual Edge AI first, existing RPC validator as safe fallback.
{
  const path = 'src/lib/buklodAiResponseValidation.ts';
  const pattern = /export async function validateBuklodResponse\([\s\S]*?\n}\n\nexport async function requestFacultyValidationOverride/;
  const replacement = `export async function validateBuklodResponse(input: {\n  questionContext: BuklodQuestionContext;\n  response: string;\n  attachments?: BuklodValidationAttachment[];\n}): Promise<AIAnswerValidationResult> {\n  // BUKLOD_FORMATION_AI_R27: contextual Edge AI first; existing RPC remains\n  // the no-regression fallback when the AI service is unavailable.\n  try {\n    const { data: edgeData, error: edgeError } = await (supabase as any).functions.invoke(\n      'buklod-ai-validate-response',\n      {\n        body: {\n          question_context: input.questionContext,\n          response: input.response,\n          attachments: input.attachments ?? [],\n        },\n      },\n    );\n\n    if (!edgeError) {\n      const normalizedEdge = normalizeAIAnswerValidationResult(edgeData);\n      if (normalizedEdge) {\n        return normalizedEdge;\n      }\n    }\n  } catch {\n    // Intentional fallback below. Submission is never blocked solely because\n    // the external AI validator is temporarily unavailable.\n  }\n\n  const { data, error } = await (supabase as any).rpc(\n    'validate_buklod_response_v1',\n    {\n      p_question_context: input.questionContext,\n      p_response: input.response,\n      p_attachments: input.attachments ?? [],\n    },\n  );\n\n  if (error) {\n    throw error;\n  }\n\n  const normalized = normalizeAIAnswerValidationResult(data);\n  if (!normalized) {\n    throw new Error('Validation service returned an unexpected response.');\n  }\n\n  return normalized;\n}\n\nexport async function requestFacultyValidationOverride`;
  replaceRegexOnce(path, pattern, replacement, 'AI validator adapter');
}

// 2) Lesson submit result now reflects automatic approval vs exact-scope review.
{
  const path = 'src/components/LearningQuestionResponse.tsx';
  replaceOnce(
    path,
    `      const {\n        error: formationSubmitError,\n      } = await (\n        supabase as any\n      ).rpc(\n        'submit_my_formation_lesson_for_validation_v1',\n        {\n          p_enrollment_id: enrollmentId,\n          p_lesson_id: lesson.id,\n        }\n      );`,
    `      const {\n        data: formationSubmitData,\n        error: formationSubmitError,\n      } = await (\n        supabase as any\n      ).rpc(\n        'submit_my_formation_lesson_for_validation_v1',\n        {\n          p_enrollment_id: enrollmentId,\n          p_lesson_id: lesson.id,\n        }\n      );`,
    'formation submit RPC result',
  );

  replaceOnce(
    path,
    `      Alert.alert(\n        'Submitted for Validation',\n        'Your study was submitted successfully. Your Cluster Admin will review it for final approval. Once approved, your BUKLOD Points will be posted automatically.'\n      );`,
    `      const wasAutoApproved =\n        formationSubmitData?.status === 'approved' ||\n        formationSubmitData?.auto_approved === true;\n\n      Alert.alert(\n        wasAutoApproved ? 'Approved' : 'Submitted for Review',\n        wasAutoApproved\n          ? 'Your response met the BUKLOD quality standard and was approved automatically. Eligible BUKLOD Points are posted by the existing reward flow, and your exact-scope admin has been notified.'\n          : 'Your response was submitted successfully. We will notify you once it has been approved or if it needs improvement.'\n      );`,
    'lesson submit confirmation',
  );
}

// 3) Formation status copy must match exact Cluster / Organization / Sub-org routing.
{
  const path = 'src/app/learn/lesson.tsx';
  const replacements = [
    ["title: 'CLUSTER ADMIN APPROVED',", "title: 'APPROVED',"],
    ["title: 'AWAITING CLUSTER ADMIN',", "title: 'PENDING REVIEW',"],
    ["detail: 'This legacy submission is awaiting final Cluster Admin approval.',", "detail: 'This submission is awaiting review in the exact scope where it was submitted.',"],
    ["'The previous validation was not approved. Please coordinate with your Cluster Admin.',", "'The previous validation needs improvement. Review the feedback and submit again, or coordinate with an approver in the same scope.',"],
    ["? 'Your study progress is saved. Submit it for validation; your Cluster Admin gives the final approval.'", "? 'Your study progress is saved. Submit it for validation. High-confidence responses may be approved automatically; otherwise an approver in the same scope reviews them.'"],
    [": 'Read and study the lesson. Your Cluster Admin gives the final approval after submission.',", ": 'Read and study the lesson, then submit it for validation in the scope where you entered Formation.',"],
    ["BUKLOD Points are posted automatically after final Cluster Admin approval.", "BUKLOD Points are posted automatically after approval. High-confidence responses may be approved automatically; otherwise the exact-scope approver reviews them."],
    ["After studying this lesson, submit it for validation. Your\n                Cluster Admin will review and approve your official completion.\n                Once approved, your BUKLOD Points will be posted automatically.", "After studying this lesson, submit it for validation. A high-confidence\n                response may be approved automatically; otherwise an approver in the\n                exact scope where you submitted will review it. Once approved, your\n                BUKLOD Points will be posted automatically."],
  ];

  for (const [from, to] of replacements) {
    replaceOnce(path, from, to, `lesson scope-aware copy: ${from.slice(0, 40)}`);
  }
}

// 4) Daily Reading should not imply that only a Pastor can approve.
{
  const path = 'src/app/bible/index.tsx';
  replaceOnce(
    path,
    'PENDING PASTOR APPROVAL | No BUKLOD Points awarded yet.',
    'PENDING SCOPE REVIEW | No BUKLOD Points awarded yet.',
    'Daily Reading pending copy',
  );
  replaceOnce(
    path,
    "'SUBMIT FOR PASTOR APPROVAL'",
    "'SUBMIT FOR REVIEW'",
    'Daily Reading submit button copy',
  );
}

console.log('BUKLOD_FORMATION_R27_SOURCE_PATCH=PASS');
