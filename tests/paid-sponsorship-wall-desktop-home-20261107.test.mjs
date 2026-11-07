import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const helper=await import('data:text/javascript,'+encodeURIComponent(
  stripTypeScriptTypes(read('src/lib/advertise/paidSponsorshipDelivery.ts'))
));
const {paidSponsorshipCanDisplay,paidSponsorshipMatchesGeography}=helper;
const wall=read('src/app/(tabs)/buklod.tsx');
const desktopHome=read('src/app/(tabs)/hub.tsx');
const card=read('src/components/BuklodCommunitySponsoredAd.tsx');
const admin=read('supabase/migrations/20261107222500_buklod_paid_ad_admin_review_v1.sql');
const now=Date.parse('2026-11-07T16:00:00Z');
const campaign={
 id:'test-approved',advertiser_name:'Demo',headline:'Example ad',short_text:null,
 image_url:'https://example.invalid/photo.jpg',video_url:null,destination_url:null,
 creative_type:'photo',coverage_level:'nationwide',barangay:null,
 city_municipality:null,province:null,placement:'all',priority:100,
 status:'approved',payment_status:'paid',policy_confirmed:true,
 starts_at:'2026-11-07T15:30:00Z',ends_at:'2026-12-07T15:30:00Z'
};
const eligible=(partial={},profile=null,at=now,scope=null,requireScope=false)=>
 paidSponsorshipCanDisplay({...campaign,...partial},profile,at,scope,requireScope);

test('approved and paid campaign is live through its paid period only',()=>{
 assert.equal(eligible(),true);
 assert.equal(eligible({},null,Date.parse(campaign.starts_at)),true);
 assert.equal(eligible({},null,Date.parse(campaign.ends_at)),false);
 assert.equal(eligible({},null,Date.parse(campaign.starts_at)-1),false);
 assert.equal(eligible({status:'pending'}),false);
 assert.equal(eligible({status:'paused'}),false);
 assert.equal(eligible({status:'rejected'}),false);
 assert.equal(eligible({payment_status:'pending'}),false);
 assert.equal(eligible({payment_status:'failed'}),false);
 assert.equal(eligible({policy_confirmed:false}),false);
 assert.equal(eligible({starts_at:'invalid'}),false);
 assert.equal(eligible({ends_at:'invalid'}),false);
 assert.equal(eligible({},null,Number.NaN),false);
 assert.equal(eligible({status:'approved',payment_status:'waived'}),true);
});

test('only paid creative placements and correct media can show',()=>{
 assert.equal(eligible({placement:'all'}),true);
 assert.equal(eligible({placement:'community'}),true);
 assert.equal(eligible({placement:'messages'}),false);
 assert.equal(eligible({creative_type:'photo',image_url:null}),false);
 assert.equal(eligible({creative_type:'video',video_url:null}),false);
 assert.equal(eligible({creative_type:'video',video_url:'https://example.invalid/ad.mp4',image_url:null,placement:'community'}),true);
});

test('local sponsorship cannot leak outside province, city or barangay',()=>{
 const profile={province:'Laguna',city_municipality:'Calamba',barangay:'Real'};
 const brgy={coverage_level:'barangay',province:'laguna',city_municipality:'calamba',barangay:'real'};
 assert.equal(paidSponsorshipMatchesGeography(brgy,profile),true);
 assert.equal(eligible(brgy,profile),true);
 assert.equal(eligible(brgy,{...profile,barangay:'Paciano Rizal'}),false);
 assert.equal(eligible({...brgy,coverage_level:'city'},profile),true);
 assert.equal(eligible({...brgy,coverage_level:'city'}, {...profile,city_municipality:'San Pablo'}),false);
 assert.equal(eligible({...brgy,coverage_level:'province'},profile),true);
 assert.equal(eligible({...brgy,coverage_level:'province'}, {...profile,province:'Cavite'}),false);
 assert.equal(eligible(brgy,null),false);
 assert.equal(eligible({coverage_level:'nationwide'},null),true);
});

test('managed LOCAL scope never accidentally shows outside selected scope coverage',()=>{
 const p={province:'Laguna',city:'Calamba',barangay:'Real'};
 assert.equal(eligible({coverage_level:'nationwide'},p,now,'barangay',true),false);
 assert.equal(eligible({coverage_level:'barangay',province:'Laguna',city_municipality:'Calamba',barangay:'Real'},p,now,'barangay',true),true);
 assert.equal(eligible({},p,now,null,true),false);
});

test('Public Community Wall and desktop Home mount one visible paid sponsorship card each',()=>{
 assert.match(wall,/import BuklodCommunitySponsoredAd from '@\/components\/BuklodCommunitySponsoredAd'/);
 assert.match(wall,/<BuklodCommunitySponsoredAd audience="public" placement="community" \/>/);
 assert.ok(wall.indexOf('<BuklodCommunitySponsoredAd audience="public"')>
           wall.indexOf('<BuklodFirstViewAd',wall.indexOf('ListHeaderComponent=')));
 assert.match(desktopHome,/if \(desktopDashboard\)/);
 const branch=desktopHome.slice(desktopHome.indexOf('if (desktopDashboard) {'),desktopHome.indexOf('\n  return (\n    <ScrollView',desktopHome.indexOf('if (desktopDashboard) {')+1));
 assert.match(branch,/<BuklodCommunitySponsoredAd audience="public" placement="home" \/>/);
 assert.equal((wall.match(/<BuklodCommunitySponsoredAd audience="public"/g)||[]).length,1);
 assert.equal((desktopHome.match(/<BuklodCommunitySponsoredAd audience="public"/g)||[]).length,1);
});

test('component refreshes already-open feed after approval, and expires without reopening',()=>{
 assert.match(card,/useFocusEffect\(useCallback/);
 assert.match(card,/REFRESH_MS = 60_000/);
 assert.match(card,/ROTATE_MS = 12_000/);
 assert.match(card,/setAtMs\(Date\.now\(\)\)/);
 assert.match(card,/\.eq\('status', 'approved'\)/);
 assert.match(card,/\.in\('payment_status', \['paid', 'waived'\]\)/);
 assert.match(card,/\.eq\('policy_confirmed', true\)/);
 assert.match(card,/\.lte\('starts_at'/);
 assert.match(card,/\.gt\('ends_at'/);
 assert.match(card,/paidSponsorshipCanDisplay/);
 assert.match(card,/return null;/);
 assert.match(card,/setRows\(\[\]\)/);
 assert.match(card,/AppState\.addEventListener\('change'/);
 assert.match(card,/PAID SPONSORSHIP/);
 assert.match(card,/Sponsored until/);
 assert.match(card,/measureInWindow/);
 assert.match(card,/event_type: 'impression'/);
 assert.match(card,/placement,/);
 assert.match(card,/event_type: 'click'/);
 assert.doesNotMatch(card,/\.insert\(\{[^}]*status:'approved'/);
});

test('approval explicitly resets the 30-day clock and requires separate paid verification',()=>{
 assert.match(admin,/p_action='approve'/);
 assert.match(admin,/v_ad\.payment_status NOT IN \('paid','waived'\)/);
 assert.match(admin,/starts_at=v_now, ends_at=v_now \+ interval '30 days'/);
 assert.match(admin,/public\.is_system_admin\(\)/);
});
