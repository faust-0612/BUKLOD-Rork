import { existsSync,readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const path=(p)=>resolve(root,p);
const read=(p)=>existsSync(path(p))?readFileSync(path(p),'utf8'):'';
const checks=[
 ['Pinned Unity editor',/m_EditorVersion:\s*6000\.0\.86f1\s*(?:\r?\n|$)/.test(read('ProjectSettings/ProjectVersion.txt'))],
 ['Package manifest',existsSync(path('Packages/manifest.json'))],
 ['Production visual catalog',existsSync(path('Assets/Production/VisualCatalog.asset'))],
 ['Production battle scene',existsSync(path('Assets/Scenes/GenesisRift.unity'))],
 ['Generated NavMesh',existsSync(path('Assets/Scenes/GenesisRiftNavMesh.asset'))],
 ['Project player settings',existsSync(path('ProjectSettings/ProjectSettings.asset'))],
 ['Graphics settings',existsSync(path('ProjectSettings/GraphicsSettings.asset'))],
 ['Enabled-scene settings',existsSync(path('ProjectSettings/EditorBuildSettings.asset'))],
 ['Gameplay source',existsSync(path('Assets/Scripts/OfflineBattle.cs'))],
 ['Android guard',existsSync(path('Assets/Editor/AndroidBuildGuard.cs'))],
 ['EditMode tests',existsSync(path('Assets/Tests/Editor/OfflineBattleTests.cs'))],
 ['PlayMode tests',existsSync(path('Assets/Tests/PlayMode/RuntimeBattleSmokeTests.cs'))]
];
for(const [name,ok] of checks) console.log((ok?'PRESENT ':'BLOCKED ')+name);
const missing=checks.filter(x=>!x[1]).length;
console.log(missing?'BLOCKED BEFORE APK BUILD: '+missing+' missing/invalid input(s).':'Source inputs present only: actual Unity validation, tests and Android build still required.');
if(missing) process.exitCode=1;
