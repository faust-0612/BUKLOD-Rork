import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(),failures=[];
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
function req(p,t,l){const ok=fs.existsSync(path.join(root,p))&&read(p).includes(t);console.log(`${ok?'PASS':'FAIL'}: ${l}`);if(!ok)failures.push(l)}
function forbid(p,t,l){const ok=!read(p).includes(t);console.log(`${ok?'PASS':'FAIL'}: ${l}`);if(!ok)failures.push(l)}
const dir=path.join(root,'supabase','migrations');
const m=fs.readdirSync(dir).filter(n=>n.endsWith('_buklod_community_qmp_economy_r1.sql')).sort().at(-1);
if(!m){console.log('FAIL: Community QMP migration exists');failures.push('Community QMP migration exists')}else{const p=`supabase/migrations/${m}`;req(p,'BUKLOD_COMMUNITY_QMP_ECONOMY_R1','Canonical migration marker');req(p,"'pool_bps',3000",'30% designated pool target');req(p,'1073741824','1GB Wall video limit');req(p,"'max_duration_seconds',1800",'30-minute Wall video limit');req(p,'monthly_allowance_bytes','Versioned monthly video quota');req(p,'source_event_key text not null unique','Economic event idempotency');req(p,"new.user_id=v_creator then 'SELF_THREAD_EXCLUDED'",'Self-thread exclusion');req(p,'Double-count guard','No duplicate user-pool allocation');req(p,"financial_finalization_enabled',false",'Cash finalization defaults OFF');req(p,'rounding_residue_minor','Deterministic residue accounting');req(p,"e.reconciliation_state='RECONCILED'",'Only reconciled revenue can fund pool');req(p,'user_pool_designated','Explicit revenue designation required');req(p,'ESTIMATE / NOT FINAL / SUBJECT TO QUALIFICATION REVIEW / SUBJECT TO FINALIZED REVENUE','Canonical estimate non-final server copy')}
req('src/lib/buklodCommunityContributionEconomy.ts','get_my_buklod_community_contribution_v1','Private contribution client');
req('src/components/BuklodCommunityContributionCard.tsx','YOUR COMMUNITY CONTRIBUTION','Compact Wall contribution card');
req('src/app/community-contribution.tsx','HOW CAN I INCREASE MY SHARE?','Contribution guidance');
req('src/app/community-contribution.tsx','data.estimate_label','Estimate non-final label rendered from server');
req('src/components/BuklodCommunityEconomyAdminCard.tsx','Video Wall P&L','FBC Video Wall P&L');
req('src/app/(tabs)/home.tsx','<BuklodCommunityContributionCard />','Home card mount');
forbid('src/app/(tabs)/buklod.tsx','<BuklodCommunityContributionCard />','No duplicate Wall card mount');
req('src/app/(tabs)/buklod.tsx','assertCommunityVideoQuotaAvailable','Public monthly quota precheck');
req('src/components/BuklodExclusiveScopeCommunity.tsx','assertCommunityVideoQuotaAvailable','Scoped monthly quota precheck');
forbid('src/app/community-contribution.tsx','â‚± per QMP','No fixed peso-per-QMP copy');
if(failures.length){console.error('\nBUKLOD COMMUNITY CONTRIBUTION ECONOMY CONTRACT FAILED');for(const f of failures)console.error(` - ${f}`);process.exit(1)}
console.log('\nBUKLOD COMMUNITY CONTRIBUTION ECONOMY CONTRACT PASS');
