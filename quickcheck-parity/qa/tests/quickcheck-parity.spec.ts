import { test, expect, type Page } from '@playwright/test';

const handoff = {
  quickcheckSession: 'e2e-session',
  launchContext: 'profile-accessory',
  classroom: { name: 'BUKLOD Profile' },
  students: [],
  syncedAt: '2026-09-19T00:00:00.000Z',
};

const pages = [
  {
    source: 'demo-1',
    studentName: 'Maria Santos',
    studentId: '2026-001',
    resolvedStudentName: 'Maria Santos',
    resolvedStudentId: '2026-001',
    assessmentGroup: 'A1',
    assessmentTitle: 'Logic Activity',
    assessmentKind: 'Activity',
    pageNumber: 1,
    sequence: 1,
    totalPages: 2,
    questions: [
      { number: '1', question: 'What is a proposition?', answer: 'A declarative statement that is either true or false.' },
      { number: '2', question: 'Give one example of a proposition.', answer: 'Manila is in the Philippines.' },
    ],
    questionSignature: 'logic activity q1 q2 q3',
    imageQuality: 'clear',
    needsRescan: false,
    confidence: 0.98,
    flags: [],
  },
  {
    source: 'demo-2',
    studentName: 'Juan Dela Cruz',
    studentId: '2026-002',
    resolvedStudentName: 'Juan Dela Cruz',
    resolvedStudentId: '2026-002',
    assessmentGroup: 'A1',
    assessmentTitle: 'Logic Activity',
    assessmentKind: 'Activity',
    pageNumber: 1,
    sequence: 1,
    totalPages: 1,
    questions: [
      { number: '1', question: 'What is a proposition?', answer: 'A sentence that can be judged true or false.' },
      { number: '2', question: 'Give one example of a proposition.', answer: 'Close the door.' },
    ],
    questionSignature: 'logic activity q1 q2 q3',
    imageQuality: 'clear',
    needsRescan: false,
    confidence: 0.94,
    flags: [],
  },
  {
    source: 'demo-3',
    studentName: 'Maria Santos',
    studentId: '2026-001',
    resolvedStudentName: 'Maria Santos',
    resolvedStudentId: '2026-001',
    assessmentGroup: 'A1',
    assessmentTitle: 'Logic Activity',
    assessmentKind: 'Activity',
    pageNumber: 2,
    sequence: 2,
    totalPages: 2,
    questions: [
      { number: '3', question: 'Is a command a proposition? Explain.', answer: 'No, because a command has no truth value.' },
    ],
    questionSignature: 'logic activity q1 q2 q3',
    imageQuality: 'clear',
    needsRescan: false,
    confidence: 0.96,
    flags: [],
  },
];

const assessments = [{
  id: 'A1',
  title: 'Logic Activity',
  kind: 'Activity',
  pageCount: 3,
  studentCount: 2,
  confidence: 0.96,
  flags: [],
}];

const answerKey = [
  { assessmentId: 'A1', assessmentTitle: 'Logic Activity', assessmentKind: 'Activity', number: '1', question: 'What is a proposition?', expectedAnswer: 'A declarative statement with a truth value.', maxPoints: 1 },
  { assessmentId: 'A1', assessmentTitle: 'Logic Activity', assessmentKind: 'Activity', number: '2', question: 'Give one example.', expectedAnswer: 'Any declarative proposition.', maxPoints: 1 },
];

async function installMocks(page: Page) {
  let grades: any[] = [];
  let created = false;
  let released = false;

  await page.route('**/functions/v1/quickcheck-handoff-redeem-v2', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(handoff) });
  });

  await page.route('**/functions/v1/quickcheck-process-v1', async route => {
    const body = route.request().postDataJSON() as any;
    if (body.action === 'health') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, service: 'quickcheck-process-v1' }) });
    }
    if (body.action === 'analyze') {
      const source = body.pages?.[0]?.name || 'imported.png';
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ pages: [{
          source,
          studentName: 'Import Student',
          studentId: 'IMP-001',
          pageNumber: 1,
          totalPages: 1,
          assessmentTitle: 'Imported Activity',
          assessmentKind: 'Activity',
          questions: [{ number: '1', question: 'Imported question', answer: 'Imported answer' }],
          questionSignature: 'imported q1',
          imageQuality: 'clear',
          needsRescan: false,
          confidence: 0.99,
          flags: [],
        }] }),
      });
    }
    if (body.action === 'reconcile') {
      const incoming = Array.isArray(body.pages) ? body.pages : [];
      const isDemo = incoming.some((p: any) => p.studentName === 'Maria Santos');
      const reconciled = isDemo ? pages : incoming.map((p: any, i: number) => ({
        ...p,
        resolvedStudentName: p.studentName,
        resolvedStudentId: p.studentId,
        assessmentGroup: 'A1',
        assessmentTitle: p.assessmentTitle || 'Imported Activity',
        assessmentKind: p.assessmentKind || 'Activity',
        sequence: i + 1,
      }));
      const localAssess = isDemo ? assessments : [{
        id: 'A1', title: 'Imported Activity', kind: 'Activity',
        pageCount: reconciled.length, studentCount: 1, confidence: 0.99, flags: [],
      }];
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ pages: reconciled, assessments: localAssess }) });
    }
    if (body.action === 'grade') {
      const nextGrades = [
        {
          assessmentId: 'A1', assessmentTitle: 'Logic Activity', assessmentKind: 'Activity',
          studentName: 'Maria Santos', studentId: '2026-001',
          score: 3, maxScore: 3, percent: 100, confidence: 0.97,
          feedback: 'Strong answers.', flags: [],
          items: [{ number: '1', correct: true, points: 1, maxPoints: 1, note: 'Correct' }],
        },
        {
          assessmentId: 'A1', assessmentTitle: 'Logic Activity', assessmentKind: 'Activity',
          studentName: 'Juan Dela Cruz', studentId: '2026-002',
          score: 1, maxScore: 2, percent: 50, confidence: 0.78,
          feedback: 'Review item 2.', flags: ['Item 2 needs teacher review'],
          items: [{ number: '2', correct: false, points: 0, maxPoints: 1, note: 'Command has no truth value' }],
        },
      ];
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ answerKey, grades: nextGrades, pages, assessments, rubricText: '', rubricSource: '' }),
      });
    }
    return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Unknown test process action' }) });
  });

  await page.route('**/functions/v1/quickcheck-records-v1', async route => {
    const body = route.request().postDataJSON() as any;
    if (body.action === 'list_batches') {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ batches: created ? [{
          id: 'batch-e2e', createdAt: '2026-09-19T00:00:00.000Z',
          status: released ? 'released' : 'suggested',
          pageCount: 3, assessmentCount: 1, studentCount: 2,
          flagCount: 1, approvedCount: grades.filter(g => g.approvalStatus === 'approved').length,
          reviewCount: grades.filter(g => g.reviewStatus === 'needs_review').length,
          criticalCount: 0,
        }] : [] }),
      });
    }
    if (body.action === 'create_batch') {
      created = true;
      grades = (body.grades || []).map((g: any, i: number) => ({
        ...g,
        gradeId: 'grade-' + (i + 1),
        reviewStatus: i === 0 ? 'looks_correct' : 'needs_review',
        approvalStatus: 'pending',
      }));
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ batchId: 'batch-e2e', createdAt: '2026-09-19T00:00:00.000Z', grades, assessments, persisted: true, status: 'suggested' }),
      });
    }
    if (body.action === 'update_grade') {
      grades = grades.map(g => g.gradeId === body.gradeId ? {
        ...g,
        score: Number(body.score),
        percent: Math.round(Number(body.score) / g.maxScore * 1000) / 10,
        feedback: body.feedback || g.feedback,
        reviewStatus: 'needs_review',
        approvalStatus: 'pending',
      } : g);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ grades, status: 'suggested' }) });
    }
    if (body.action === 'approval') {
      const now = '2026-09-19T00:01:00.000Z';
      if (body.approvalAction === 'approve_correct') {
        grades = grades.map(g => g.reviewStatus === 'looks_correct' ? { ...g, approvalStatus: 'approved', approvedAt: now } : g);
      } else if (body.approvalAction === 'approve_grade') {
        grades = grades.map(g => g.gradeId === body.gradeId ? { ...g, approvalStatus: 'approved', approvedAt: now } : g);
      } else if (body.approvalAction === 'release') {
        if (grades.some(g => g.approvalStatus !== 'approved')) {
          return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'Grades remain pending teacher approval.' }) });
        }
        released = true;
      }
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ grades, status: released ? 'released' : (grades.every(g => g.approvalStatus === 'approved') ? 'approved' : 'partially_approved') }),
      });
    }
    if (body.action === 'get_batch') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        id: 'batch-e2e', status: released ? 'released' : 'suggested', pageCount: 3,
        assessments, pages, grades, answerKey, rubricText: '', rubricSource: '',
      }) });
    }
    return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Unknown test records action' }) });
  });
}

test('Profile accessory handoff through review, override, approval and release', async ({ page }) => {
  await installMocks(page);
  await page.goto('/?handoff=E2E-CODE');

  await expect(page).not.toHaveURL(/handoff=/);
  await expect(page.getByText(/opened securely from BUKLOD Profile/i)).toBeVisible();

  await page.getByRole('button', { name: 'Load Demo Data' }).click();
  await expect(page.getByText('END-TO-END BATCH REPORT')).toBeVisible();
  await expect(page.getByText(/2 unique student\(s\)/i)).toBeVisible();

  await page.getByRole('button', { name: 'AUTO-SORT & SUGGEST GRADES' }).click();
  await expect(page.getByText('3. Suggested Grades & Teacher Review')).toBeVisible();

  const reportSummary = page.locator('button').filter({ hasText: 'Overall grade summary' });
  await reportSummary.click();
  await expect(page.getByText('Report Inspector')).toBeVisible();

  await page.getByRole('button', { name: /looks correct.*pending/i }).click();
  await expect(page.getByText('Paper Review')).toBeVisible();
  await expect(page.getByRole('dialog', { name: /Paper review for Maria Santos/i })).toBeVisible();
  await page.getByRole('button', { name: /CLOSE/i }).click();

  await page.getByRole('button', { name: 'REVIEW FLAGS ONLY' }).click();
  const table = page.locator('table');
  await expect(table.getByText('Juan Dela Cruz')).toBeVisible();
  await expect(table.getByText('Maria Santos')).toHaveCount(0);

  const juanRow = table.locator('tr').filter({ hasText: 'Juan Dela Cruz' });
  await juanRow.getByRole('button', { name: /VIEW PAPER/i }).click();
  await expect(page.getByRole('dialog', { name: /Paper review for Juan Dela Cruz/i })).toBeVisible();
  await page.getByRole('button', { name: /EDIT GRADE/i }).click();

  await expect(page.getByText(/Teacher Override/i)).toBeVisible();
  await page.getByRole('spinbutton').fill('1.5');
  await page.getByRole('button', { name: 'SAVE TEACHER GRADE' }).click();

  await page.getByRole('button', { name: 'SHOW ALL GRADES' }).click();
  await page.getByRole('button', { name: 'APPROVE ALL CORRECT' }).click();

  const allTable = page.locator('table');
  const updatedJuan = allTable.locator('tr').filter({ hasText: 'Juan Dela Cruz' });
  await updatedJuan.getByRole('button', { name: 'APPROVE THIS' }).click();

  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'RELEASE ALL GRADES' }).click();
  await expect(page.getByRole('button', { name: /GRADES RELEASED/i })).toBeVisible();
});

test('local file and folder import paths process selected images', async ({ page }) => {
  await installMocks(page);
  await page.goto('/?handoff=E2E-CODE');
  await expect(page.getByText(/opened securely from BUKLOD Profile/i)).toBeVisible();

  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2tQAAAABJRU5ErkJggg==', 'base64');
  const inputs = page.locator('input[type="file"]');

  await inputs.nth(0).setInputFiles({ name: 'paper.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByText(/1\/1 file\(s\) accepted/i)).toBeVisible();
  await expect(page.getByText('END-TO-END BATCH REPORT')).toBeVisible();

  await page.getByRole('button', { name: /Clear/i }).click();

  await inputs.nth(1).setInputFiles({ name: 'folder-paper.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByText(/1\/1 file\(s\) accepted/i)).toBeVisible();
  await expect(page.getByText('END-TO-END BATCH REPORT')).toBeVisible();
});

test('camera path opens and can finish without a white screen', async ({ page, context }) => {
  await context.grantPermissions(['camera'], { origin: 'http://127.0.0.1:4173' });
  await installMocks(page);
  await page.goto('/?handoff=E2E-CODE');

  await page.getByRole('button', { name: 'START CONTINUOUS SCAN' }).click();
  await expect(page.getByRole('button', { name: 'FINISH BATCH' })).toBeVisible();
  await page.getByRole('button', { name: 'FINISH BATCH' }).click();
  await expect(page.getByText('QuickCheck')).toBeVisible();
});
