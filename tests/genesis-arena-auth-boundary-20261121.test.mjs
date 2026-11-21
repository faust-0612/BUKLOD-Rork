import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Preview Arena performs full auth, privacy, maintenance and mandatory-update gating before mounting any game loop',()=>{
 const file=read('src/app/games/empire-arena.tsx');
 const section=file.slice(file.indexOf('export default function EmpireArenaPreviewGate()'));
 for(const token of ['useAuth()','useCompliance()','useRuntimeConfig()','if (!isGenesisPreviewBuild())','if (!session)','maintenance_mode','update_required','pilot_access_required','requiresAcceptance','!profile']) assert.ok(section.includes(token), token);
 assert.ok(section.indexOf('if (!session)')<section.indexOf('return <EmpireArenaInApp />'),'No offline engine mounting before auth');
 assert.match(section,/if \(!profile\) return <Redirect href="\/onboarding"/);
 assert.match(section,/if \(requiresAcceptance\) return <Redirect href="\/privacy\/consent"/);
 assert.doesNotMatch(section,/supabase\.rpc|awardBp|awardDiamond|claimBp|settleTrade/i);
});
test('Genesis-only Kingdom entry continues to launch inside current authenticated app with original production fallback',()=>{
 const portal=read('src/features/season2/genesis/GenesisKingdomPortal.tsx');
 const entry=read('src/app/games/index.tsx');
 assert.match(portal,/router\.push\('\/games\/empire-arena'/);
 assert.match(entry,/genesisPreview \? <GenesisKingdomPortal \/> : <BuklodKingdomMap \/>/);
 assert.match(entry,/BuklodKingdomAdSlot/);
});
