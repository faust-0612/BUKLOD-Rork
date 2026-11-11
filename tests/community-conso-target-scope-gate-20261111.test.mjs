import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const workflow=readFileSync('.github/workflows/engineering-accountability.yml','utf8');

test('scope selection respects actual PR target without weakening main policy',()=>{
 assert.match(workflow,/PR_BASE: \$\{\{ github\.base_ref \|\| 'main' \}\}/);
 assert.match(workflow,/git branch main refs\/remotes\/origin\/main/);
 assert.match(workflow,/if \[ "\$PR_BASE" != "main" \]; then/);
 assert.match(workflow,/git branch "\$PR_BASE" "refs\/remotes\/origin\/\$PR_BASE"/);
 assert.match(workflow,/git diff --name-only "\$PR_BASE"\.\.\.HEAD -- \.buklod\/scopes\//);
 assert.match(workflow,/BUKLOD_BASE_REF: \$\{\{ github\.base_ref \|\| 'main' \}\}/);
 assert.match(workflow,/node scripts\/engineering-regression-gate\.mjs --run-focused-node-tests/);
 assert.match(workflow,/node scripts\/engineering-accountability-gate\.mjs/);
});

