/**
 * Collapsed by default: precise member-facing Season 1 carryover and Season 2
 * target reward guide. Display ONLY. No RPC, no writes, no claim/ad triggers.
 */
import React,{useMemo,useState} from 'react';
import {Pressable,StyleSheet,Text,TextInput,View} from 'react-native';
import {useBuklodI18n} from '@/providers/BuklodI18nProvider';
import BuklodS2AllItemsBadgesGuide from '@/components/points/BuklodS2AllItemsBadgesGuide';
import BuklodS2CompleteRewardIndex from '@/components/points/BuklodS2CompleteRewardIndex';
import BuklodS2RewardTracksGuide from '@/components/points/BuklodS2RewardTracksGuide';
import {BUKLOD_SEASON2_WEEKLY_BEATS} from '@/lib/buklodSeason2CampaignR1';
import {S2_EXCLUSIVE_FEATURES} from '@/lib/season2/buklodSeason2ApprovedScopeR1';
import {
 S2_MEMBER_GUIDE_SNAPSHOT,S2_LEGACY_BP_ACTIVE,S2_LEGACY_BP_INACTIVE,
 S2_GUIDE_BP_GROUPS,S2_QMP_EVENTS,S2_QMP_MISSIONS,S2_QMP_TIERS,S2_QMP_QUALIFICATIONS,
 S2_SOCIAL_MILESTONES_NOT_YET_ACTIVE,S2_OPTIONAL_AD_ENERGY_NOT_BP,
 S2_JOURNEY_TOKEN_SOURCES,S2_WEEKLY_CLASSIFICATIONS,S2_COSMETIC_PRICES_PREVIEW,
 S2_KL_FUTURE_RULES,s2ChapterPotentialBp,S2_WEEKLY_FOUNDATION_FUTURE,
 S2_MOMENTUM_PREVIEW_ONLY,S2_CHARACTER_MASTERY_FUTURE,S2_REFERRAL_FUTURE,
 S2_FINANCE_CARRYOVER,S2_CARRYOVER_POLICY,S2_MEMBER_RELEASE_NOTICE,
 S2_JOURNEY_TOKEN_DAILY_MODELED_MAX,S2_JOURNEY_TOKEN_DAILY_GLOBAL_CEILING,
 type S2BpGroup
} from '@/lib/season2/buklodSeason2MemberRewardMatrixR1';

type Tab='tracks'|'all'|'bp'|'qmp'|'season2'|'assets'|'carryover';
const C={ink:'#173D2B',green:'#126C42',muted:'#526D5E',line:'#D7E8DD',pale:'#F0F9F2',gold:'#946212'};
const chapters=[1,5,10,20,30] as const;
const groupCategories:S2BpGroup[]=['community','learning','service','game_quiz','milestones'];

function Row({name,value,detail}:{name:string;value:string;detail?:string}){
 return <View style={s.row}>
  <View style={{flex:1,minWidth:0}}>
   <Text style={s.name}>{name}</Text>
   {detail?<Text style={s.detail}>{detail}</Text>:null}
  </View>
  <Text style={s.amount}>{value}</Text>
 </View>;
}
function Title({children}:{children:React.ReactNode}){return <Text style={s.heading}>{children}</Text>}
function Note({children}:{children:React.ReactNode}){return <Text style={s.note}>{children}</Text>}

export default function BuklodS2CompleteRewardsReference(){
 const {locale}=useBuklodI18n(),en=locale==='en';
 const t=(fil:string,english:string)=>en?english:fil;
 const [expanded,setExpanded]=useState(false);
 const [tab,setTab]=useState<Tab>('tracks');
 const [bpGroup,setBpGroup]=useState<S2BpGroup>('community');
 const [search,setSearch]=useState('');
 const [showInactive,setShowInactive]=useState(false);
 const active=useMemo(()=>S2_LEGACY_BP_ACTIVE.filter(item=>
   item.group===bpGroup&&item.group!=='admin'&&
   (item.title+' '+item.id+' '+item.condition).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
 ),[bpGroup,search]);
 return <View style={s.shell}>
  <Pressable accessibilityRole="button"
    accessibilityLabel="Full Season 1 and Season 2 rewards and requirements guide"
    accessibilityState={{expanded}}
    onPress={()=>setExpanded(o=>!o)} style={s.header}>
    <View style={s.textBlock}>
     <Text style={s.kicker}>{t('KUMPLETONG PUNTOS AT GANTIMPALA','COMPLETE POINTS & REWARDS')}</Text>
     <Text style={s.title}>{t('Season 1 → Season 2 · Lahat ng rules','Season 1 → Season 2 · Full rules')}</Text>
     <Text style={s.tag}>{t('BP • QMP • Rewards • Requirements • Deductions','BP • QMP • Rewards • Requirements • Deductions')}</Text>
    </View>
    <Text style={s.chevron}>{expanded?'−':'+'}</Text>
  </Pressable>
  {expanded?<View style={s.content}>
   <Text style={s.status}>{t(
    'EXACT GUIDE · Season 1 snapshot '+S2_MEMBER_GUIDE_SNAPSHOT+' · Season 2 target Dec 6; hindi pa live',
    'EXACT GUIDE · Season 1 snapshot '+S2_MEMBER_GUIDE_SNAPSHOT+' · Season 2 Dec 6 target, NOT live'
   )}</Text>
   <View style={s.tabs}>
    {([['tracks',t('2 REWARD TRACKS','2 REWARD TRACKS')],['all',t('LAHAT / GUIDE','ALL / GUIDE')],['bp',t('BUKLOD BP','BUKLOD BP')],['qmp','QMP'],['season2','SEASON 2'],['assets',t('ITEMS / BADGES','ITEMS / BADGES')],['carryover',t('CARRYOVER','CARRYOVER')]] as const).map(([key,label])=>
     <Pressable key={key} accessibilityRole="button" accessibilityState={{selected:tab===key}}
       onPress={()=>setTab(key)} style={[s.tab,tab===key&&s.tabSelected]}>
       <Text style={[s.tabText,tab===key&&s.tabTextSelected]}>{label}</Text>
     </Pressable>)}
   </View>
   {tab==='tracks'?<BuklodS2RewardTracksGuide/>:null}
   {tab==='all'?<BuklodS2CompleteRewardIndex/>:null}
   {tab==='bp'?<>
    <Title>{t('46 active BP catalog rules (may 2 admin-only entries na hindi reward ng user)','46 active BP catalog rules (2 admin-only entries excluded for members)')}</Title>
    <Note>{t(
     'Ang listed amount ay configured BP per qualified event, hindi automatic payout. May mga source na may sariling verification, duplicate protection at claim steps. Hindi lahat ng active catalog row ay confirmed na may live trigger.',
     'Listed amounts are configured BP per qualifying event, not automatic grants. Each source may have separate validation/claim rules. Active catalog status does not prove the trigger is live.'
    )}</Note>
    <View style={s.groupChoices}>
     {S2_GUIDE_BP_GROUPS.filter(x=>groupCategories.includes(x.id)).map(group=>
      <Pressable key={group.id} accessibilityRole="button" accessibilityState={{selected:bpGroup===group.id}}
       onPress={()=>{setBpGroup(group.id);setSearch('')}} style={[s.groupChip,bpGroup===group.id&&s.groupChipActive]}>
       <Text style={[s.groupText,bpGroup===group.id&&s.groupTextActive]}>{group.title}</Text>
      </Pressable>)}
    </View>
    <TextInput accessibilityLabel="Search BUKLOD reward names" value={search} onChangeText={setSearch}
      placeholder={t('Hanapin ang activity…','Search activity…')} placeholderTextColor="#647D6D"
      style={s.input} autoCapitalize="none" autoCorrect={false}/>
    {active.map(item=><Row key={item.id} name={item.title} value={`+${item.bp} BP`}
      detail={item.condition+(item.dayCapBP===null?'':` · ${item.dayCapBP} BP/day catalog cap`)}/>)}
    {!active.length?<Note>{t('Walang tugmang activity.','No matching activity.')}</Note>:null}
    <Title>{t('Proposed social milestone bonuses (NOT LIVE)','Proposed social milestone bonuses (NOT LIVE)')}</Title>
    <Note>{t('Ito ay nasa prior R2 user guide ngunit hindi pa verified bilang active source-authoritative reward; hindi agad na-credit ang additional BP.','These were described in the earlier R2 guide but are not verified as active source-authoritative grants; do not expect credits yet.')}</Note>
    {S2_SOCIAL_MILESTONES_NOT_YET_ACTIVE.helpfulCommentDistinctReactions.map(row=>
      <Row key={row.at} name={`${row.at} distinct reactions to helpful comment`}
        value={`+${row.totalBonusBP} BP total`} detail="NOT LIVE · qualifying real reactions required"/>)}
    <Row name="Mutual Support Chain" value={`+${S2_SOCIAL_MILESTONES_NOT_YET_ACTIVE.mutualSupportChain.eachParticipantBp} BP`}
      detail={`NOT LIVE · ${S2_SOCIAL_MILESTONES_NOT_YET_ACTIVE.mutualSupportChain.distinctMembers} independently qualified members`}/>
    <Note>{S2_SOCIAL_MILESTONES_NOT_YET_ACTIVE.postImpact}</Note>
    <Pressable accessibilityRole="button" accessibilityState={{expanded:showInactive}}
      accessibilityLabel="Show inactive or retired BP catalog rules" onPress={()=>setShowInactive(x=>!x)}
      style={s.disclosure}><Text style={s.disclosureText}>{t('16 inactive/retired BP rules','16 inactive/retired BP rules')} {showInactive?'−':'+'}</Text></Pressable>
    {showInactive?S2_LEGACY_BP_INACTIVE.map(item=>
      <Row key={item.id} name={item.title} value={`+${item.bp} BP`} detail={t('INACTIVE · Hindi bagong automatic reward','INACTIVE · Not an automatic new reward')}/>):null}
    <Note>{t('Mahalaga: ang KL +10/chapter at +50/full series na nasa legacy reading RPC ay hiwalay sa inactive KL catalog rows. Hindi dapat doblehin. Legacy referral rank bonus ay +10 BP; +20 BP ang hinahandang Season 2 target.','Important: legacy KL +10/chapter and +50/series uses a separate reading RPC. Do not duplicate inactive catalog entries. Legacy referral rank bonus is +10 BP; +20 is only the future Season 2 target.')}</Note>
   </>:null}
   {tab==='qmp'?<>
    <Title>{t('QMP — Qualified Monthly Participation','QMP — Qualified Monthly Participation')}</Title>
    <Note>{t('Hiwalay ang QMP sa BP. Ang 30% ay bahagi ng eligible finalized user revenue pool, hinahati ayon sa qualified member weights. Walang fixed piso kada QMP.','QMP is separate from BP. The 30% refers to the eligible finalized member pool, divided by qualified participation weights. No fixed peso per QMP.')}</Note>
    {S2_QMP_EVENTS.map(item=><Row key={item.id} name={item.title} value={`+${item.qmp} QMP`} detail={item.condition}/>)}
    <Title>{t('4 monthly QMP missions','4 monthly QMP missions')}</Title>
    {S2_QMP_MISSIONS.map(item=><Row key={item.id} name={item.id.replaceAll('_',' ')}
      value={`+${item.qmp} QMP`} detail={`${item.required}× ${item.source}`}/>)}
    <Title>{t('Monthly QMP classification','Monthly QMP classification')}</Title>
    {S2_QMP_TIERS.map(item=><Row key={item.id} name={item.title}
      value={`${item.minQmp}–${item.maxQmp===null?'∞':item.maxQmp} QMP`}/>)}
    <Title>{t('Qualification at anti-farming','Qualification & anti-farming')}</Title>
    <Note>{`Original post: ≥${S2_QMP_QUALIFICATIONS.postMinCharacters} chars or accepted media; reply: ≥${S2_QMP_QUALIFICATIONS.replyMinCharacters} chars; repeated reply exclusion: ${S2_QMP_QUALIFICATIONS.duplicateReplyDays} days; qualified engagement bonus caps: ${S2_QMP_QUALIFICATIONS.creatorBonusPerContentCap}/content and ${S2_QMP_QUALIFICATIONS.creatorBonusMonthlyCap}/month. Velocity hold: ${S2_QMP_QUALIFICATIONS.velocityHoldPerHour} events/hour.`}</Note>
    <Note>{t('Ang estimated earnings ay hindi pa withdrawable hanggang na-finalize, may pondo, at naaprubahan ang identity/payout. Sa audited configuration, financial finalization ay hindi pa enabled.','Estimated earnings are not withdrawable until funded and finalized, with verified identity/payout. At audit time, financial finalization was OFF.')}</Note>
   </>:null}
   {tab==='season2'?<>
    <View style={s.futureAlert}><Text style={s.futureTitle}>{S2_MEMBER_RELEASE_NOTICE.status}</Text>
     <Text style={s.futureText}>{t('December 6 ay earliest target lamang. Walang bagong rewards na awtomatikong magbubukas sa petsang iyon.','December 6 is only the earliest target; new rewards will not switch on automatically.')}</Text>
    </View>
    <Title>{t('Eksaktong 10 approved exclusive features','Exactly 10 approved exclusive features')}</Title>
    {S2_EXCLUSIVE_FEATURES.map(item=><Row key={item.id}
      name={`${item.number}. ${item.title}`} value="LOCKED"
      detail={item.explanation}/>)}
    <Title>Journey Tokens</Title>
    {S2_JOURNEY_TOKEN_SOURCES.map(item=><Row key={item.id}
      name={item.id.replaceAll('_',' ')} value={`+${item.amount} tokens`}
      detail={`${item.dailyCount}×/day · ${item.conditions}`}/>)}
    <Note>{t(
     `Kasulukuyang modeled earning: ${S2_JOURNEY_TOKEN_DAILY_MODELED_MAX} tokens/day. Reserved limit: ${S2_JOURNEY_TOKEN_DAILY_GLOBAL_CEILING}/day. Hindi kino-convert sa cash, BP, QMP o Kingdom Shards.`,
     `Modeled earning: ${S2_JOURNEY_TOKEN_DAILY_MODELED_MAX} tokens/day. Reserved ceiling: ${S2_JOURNEY_TOKEN_DAILY_GLOBAL_CEILING}/day. No conversion to cash, BP, QMP or Kingdom Shards.`
    )}</Note>
    <Title>{t('Optional cosmetic prices — panukala pa lamang','Optional cosmetic prices — proposals only')}</Title>
    {S2_COSMETIC_PRICES_PREVIEW.map(item=><Row key={item.id}
      name={item.id.replaceAll('_',' ')} value={`${item.tokens} tokens`}/>)}
    <Title>{t('KL — progressive at delayed BP','KL — progressive and delayed BP')}</Title>
    {chapters.map(chapter=><Row key={chapter}
      name={`Chapter ${chapter}`} value={`+${s2ChapterPotentialBp(chapter)} BP`}
      detail={chapter===30?'PENDING until next series Chapter 1 verified':`PENDING until Chapter ${chapter+1} verified`}/>)}
    <Note>{t(
     `Bawat Chapter n = 5+n BP, accredited lang pag verified ang susunod. Bawal mag-skip. May validated quiz (walang reading-time requirement), +${S2_KL_FUTURE_RULES.chapterCommentBp} BP sa isang valid ≥${S2_KL_FUTURE_RULES.chapterCommentMinCharacters}-character comment bawat chapter, at +${S2_KL_FUTURE_RULES.seriesBonusBp} BP sa 30 chapters at genuine ≥${S2_KL_FUTURE_RULES.finalSeriesReflectionMinCharacters}-character final personal series reflection. Total potential 815 BP na may next-series credit delay; photo optional.`,
     `Chapter n = 5+n BP, credited only after the next verified chapter. No skipping. Verified quiz, no minimum reading duration, +5 BP for one valid ≥20-character comment/chapter, +50 BP for 30 chapters plus genuine ≥50-character personal series reflection. Potential 815 BP including the carry-forward of Chapter 30; photo optional.`
    )}</Note>
    <Title>{t('Weekly Performance — scoring','Weekly Performance — scoring')}</Title>
    <Note>{t('Active day 5×7 max35; learning day 6×5 max30; community impact 7×5 max35; quality creation 6×5 max30; total capped at 100. Scores batay sa verified at claimed na events, hindi raw clicks.','Active day 5×7 max35; learning day 6×5 max30; community impact 7×5 max35; quality creation 6×5 max30; total capped at 100. Verified claimed evidence only, not clicks.')}</Note>
    {S2_WEEKLY_CLASSIFICATIONS.map(item=><Row key={item.name}
      name={item.name} value={`${item.score}+ score`}
      detail={`${item.minActiveDays}+ active days · ${item.minCategories}+ categories · ${item.earnedReward}`}/>)}
    <Title>{t('Weekly Foundation at Momentum','Weekly Foundation & Momentum')}</Title>
    <Note>{`${S2_WEEKLY_FOUNDATION_FUTURE.distinctVerifiedLearning} verified learning + ${S2_WEEKLY_FOUNDATION_FUTURE.distinctVerifiedCommunity} separate community source/week. ${S2_WEEKLY_FOUNDATION_FUTURE.normalDays} days + ${S2_WEEKLY_FOUNDATION_FUTURE.automaticGraceDays} grace days. ${S2_WEEKLY_FOUNDATION_FUTURE.flexCreditsPerSeason} optional Flex credits × ${S2_WEEKLY_FOUNDATION_FUTURE.extraDaysPerFlex} days; select before deadline. Only optional S2 bonuses held if incomplete; BP/QMP/cash/core access continue.`}</Note>
    <Note>{t(`MOMENTUM PREVIEW, HINDI ACTIVE: +${S2_MOMENTUM_PREVIEW_ONLY.verifiedActiveDayPlus} verified active day; −${S2_MOMENTUM_PREVIEW_ONLY.inactivityAfterGraceMinus} post-grace inactive; −${S2_MOMENTUM_PREVIEW_ONLY.missedReadingMinus} assigned reading; −${S2_MOMENTUM_PREVIEW_ONLY.missedCreatorMinus} assigned creator task; maximum −${S2_MOMENTUM_PREVIEW_ONLY.maxPerDayMinus}/day hanggang floor 0. Opt-in, walang lifetime deduction o offline punishment.`,
     `MOMENTUM PREVIEW, NOT ACTIVE: +5 verified active day; −5 inactive after grace; −2 missed assigned reading; −2 missed assigned creator task; max −9/day, floor 0. Opt-in and no lifetime or offline penalty.`)}</Note>
    <Title>{t('1,300 Character item prerequisites','1,300 Character item prerequisites')}</Title>
    <Note>{`${S2_CHARACTER_MASTERY_FUTURE.characterCount} characters × ${S2_CHARACTER_MASTERY_FUTURE.levelsPerCharacter} levels × ${S2_CHARACTER_MASTERY_FUTURE.itemsPerLevel} items. Server must confirm Character, level, distinct evidence, ownership and equip. Art is NOT a grant.`}</Note>
    {S2_CHARACTER_MASTERY_FUTURE.slotSteps.map(step=><Text key={step} style={s.listLine}>• {step}</Text>)}
    <Title>{t('Qualified referral — bagong target','Qualified referral — future target')}</Title>
    <Row name={t('Referrer kapag verified rank advancement','Referrer after verified rank gain')}
      value={`+${S2_REFERRAL_FUTURE.referrerRankUpgradeBp} BP`}
      detail={t('Genuine member, active Cluster, at least one eligible Circle Rank gain, once per referral. Legacy +10 is NOT yet reconciled.','Genuine member, active Cluster, at least one eligible Circle Rank gain, once per referral. Legacy +10 is NOT reconciled.')}/>
    <Row name={t('Qualified referred new member','Qualified referred new member')} value={`+${S2_REFERRAL_FUTURE.referredQualifiedBp} BP`}
     detail={t('Subject to independent eligibility, not mere sign-up','Requires independent eligibility, not mere signup')}/>
    <Title>{t('Optional rewarded ads — hindi BP','Optional rewarded ads — not BP')}</Title>
    <Note>{S2_OPTIONAL_AD_ENERGY_NOT_BP.example}. {t('Demo UI lamang; walang automatic BP, QMP, cash, o Journey Token credits sa panonood ng ad. Kailangan ng tunay na earned event at independent game verification bago ibigay ang energy.','Demo UI only. Watching an ad does not automatically grant BP, QMP, cash or Journey Tokens. An actual earned event and independently verified game grant are required.')}</Note>
    <Title>{t('12-linggong Rise Together missions — lahat ng steps','Rise Together: all 12 weekly mission requirements')}</Title>
    {BUKLOD_SEASON2_WEEKLY_BEATS.map(beat=><Row key={beat.week}
      name={`W${beat.week} · ${beat.title}`} value={beat.act}
      detail={`${beat.chapterBeat} · Primary: ${beat.primaryEvidence}. Alternative: ${beat.alternativePath}. PREVIEW ONLY`}/>)}
    <Title>{t('Four verified seasonal awards','Four verified seasonal awards')}</Title>
    {['The Call → Beacon Trail Frame','The Makers → Maker Ribbon','The Alliance → Alliance Crest','The Legacy → Constellation Finale Scene'].map(name=>
      <Row key={name} name={name} value="LOCKED" detail={t('Verified milestone at server grant required','Verified milestone and server-backed grant required')}/>)}
    <Note>{t('Kingdom at Co-op: tunay na server-verified mastery at per-member team contribution. Dapat may no-cost solo route; hindi sapilitan ang faith o invites. Walang automatic earned badge dahil sa preview.','Kingdom & Co-op: genuine server-verified mastery and individual team contributions. Free solo alternatives, no compulsory faith or invites. Preview does not award badges.')}</Note>
   </>:null}
   {tab==='assets'?<BuklodS2AllItemsBadgesGuide/>:null}
   {tab==='carryover'?<>
    <Title>{t('Magpapatuloy, hindi mabubura','Preserved — not erased')}</Title>
    {S2_CARRYOVER_POLICY.preserved.map(item=><Text style={s.listLine} key={item}>✓ {item}</Text>)}
    <Title>{t('Season-only competition resets','Only seasonal competition resets')}</Title>
    {S2_CARRYOVER_POLICY.resetOnly.map(item=><Text key={item} style={s.listLine}>↻ {item}</Text>)}
    <Title>{t('Cash at withdrawal requirements','Cash and withdrawal requirements')}</Title>
    <Row name={t('Minimum funded withdrawable balance','Minimum funded available cash')}
      value={`₱${S2_FINANCE_CARRYOVER.minFundedWithdrawalPhp}`}
      detail={t('Verified government-ID legal name, approved membership at matching payout beneficiary; estimate is not cash','Government-ID verified legal name, approved membership and matching payout beneficiary; estimate is not cash')}/>
    <Title>{t('Walang permanent deductions','No permanent deductions')}</Title>
    <Note>{t('Ang optional missed Season 2 mission, Flex lapse o proposed Momentum deduction ay hindi puwedeng magbawas ng lifetime BP, earned QMP, Character XP/levels, permanent badges, owned items o finalized pesos. May audit at valid appeal ang mga fraud reversals.','Missed optional Season 2 mission, Flex lapse or proposed Momentum deduction never debits lifetime BP, earned QMP, Character XP/levels, badges, owned items or finalized pesos. Fraud reversals require audit and appeal.')}</Note>
   </>:null}
   <Note>{t('INFORMATIONAL SNAPSHOT ONLY. Hindi ito wallet, cash estimate, registration, claim button, live award, o activation. Official rules at reward settlement ay nakadepende sa verified production backend.','INFORMATIONAL SNAPSHOT ONLY. Not a wallet, cash estimate, claim, grant or activation. Actual settlement requires verified production backend.')}</Note>
  </View>:null}
 </View>;
}
const s=StyleSheet.create({
 shell:{backgroundColor:'#FFFFFF',borderWidth:1,borderColor:C.line,borderRadius:12,overflow:'hidden',marginTop:8},
 header:{flexDirection:'row',alignItems:'center',paddingVertical:10,paddingHorizontal:11,backgroundColor:'#E9F8ED',gap:8},
 textBlock:{flex:1,minWidth:0},kicker:{fontSize:9,fontWeight:'900',color:C.green,letterSpacing:.4},
 title:{fontSize:13,fontWeight:'900',color:C.ink,marginTop:2},
 tag:{fontSize:10,color:C.muted,marginTop:2},
 chevron:{fontSize:22,fontWeight:'700',color:C.green},
 content:{paddingHorizontal:10,paddingVertical:9,gap:7},
 status:{fontSize:10,color:C.gold,fontWeight:'800',lineHeight:15},
 tabs:{flexDirection:'row',flexWrap:'wrap',gap:5,marginTop:2},
 tab:{borderRadius:8,borderColor:C.line,borderWidth:1,paddingHorizontal:8,paddingVertical:7},
 tabSelected:{backgroundColor:C.green,borderColor:C.green},
 tabText:{fontSize:10,fontWeight:'800',color:C.ink},
 tabTextSelected:{color:'#FFFFFF'},
 heading:{fontSize:12,fontWeight:'900',color:C.green,marginTop:5},
 note:{color:C.muted,fontSize:10,lineHeight:16},
 row:{flexDirection:'row',alignItems:'flex-start',gap:7,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.line,paddingVertical:7},
 name:{fontSize:11,fontWeight:'800',color:C.ink,lineHeight:15},
 detail:{fontSize:10,color:C.muted,lineHeight:15,marginTop:2},
 amount:{fontSize:10,color:C.green,fontWeight:'900',minWidth:65,textAlign:'right'},
 groupChoices:{flexDirection:'row',flexWrap:'wrap',gap:5},
 groupChip:{paddingHorizontal:7,paddingVertical:6,backgroundColor:C.pale,borderRadius:7,borderWidth:1,borderColor:C.line},
 groupChipActive:{backgroundColor:'#D3EEDB',borderColor:'#8FBDA0'},
 groupText:{fontSize:10,color:C.muted,fontWeight:'700'},
 groupTextActive:{color:C.green},
 input:{fontSize:11,paddingHorizontal:10,paddingVertical:7,borderWidth:1,borderColor:C.line,borderRadius:8,color:C.ink,backgroundColor:'#F8FCF9'},
 disclosure:{marginTop:4,backgroundColor:C.pale,padding:9,borderRadius:8},
 disclosureText:{fontSize:11,fontWeight:'800',color:C.green},
 futureAlert:{padding:9,borderRadius:8,backgroundColor:'#FFF5DA',borderColor:'#E0C177',borderWidth:1,gap:4},
 futureTitle:{fontSize:10,fontWeight:'900',color:'#7F551A'},futureText:{fontSize:10,color:'#795B2C',lineHeight:15},
 listLine:{fontSize:10,lineHeight:17,color:C.ink},
});
