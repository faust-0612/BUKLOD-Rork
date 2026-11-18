import React,{useMemo,useState} from 'react';
import {Pressable,StyleSheet,Text,View,type DimensionValue} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {SEASON_JOURNEY_TRACKS,
  deriveBuklodSeasonState,manilaCalendarDay,SEASON2_OPENING_TARGET,
  previewSeasonPreparationDates,type SeasonSummary}
  from '@/lib/buklodSeasonJourneyR2';
import {BUKLOD_SEASON2_CAMPAIGN,BUKLOD_SEASON2_ACTS,
  BUKLOD_SEASON2_WEEKLY_BEATS,BUKLOD_SEASON2_CHARACTER_CAST,
  BUKLOD_SEASON2_CAST_ORDER,BUKLOD_SEASON2_REWARDS,
  previewSeason2EditorialWeek,BUKLOD_SEASON2_PROLOGUE_INITIAL,
  nextSeason2Prologue,season2PrologueScene} from '@/lib/buklodSeason2CampaignR1';
import {BUKLOD_CHARACTER_DISPLAY_NAME} from '@/lib/buklodCharacterWorldCatalog';

const C={green:'#0A663B',ink:'#17382A',muted:'#587769',
  pale:'#F2FAF5',line:'#CFE8D8',gold:'#8B6416'};
/**
 * Optional collapsed-by-default Points companion.
 * Uses parent rank data: zero extra RPC, zero grants, zero notifications.
 */
export default function BuklodSeasonJourneyPreview({
  season,verified,
}:{season:SeasonSummary|null;verified:boolean}) {
  const [open,setOpen]=useState(false);
  const [track,setTrack]=useState<string>('explorer');
  const [castIndex,setCastIndex]=useState(0);
  const [prologue,setPrologue]=useState(BUKLOD_SEASON2_PROLOGUE_INITIAL);
  const [roadmapOpen,setRoadmapOpen]=useState(false);
  const [weekDetail,setWeekDetail]=useState<number|null>(null);
  const castId=BUKLOD_SEASON2_CAST_ORDER[castIndex];
  const cast=BUKLOD_SEASON2_CHARACTER_CAST[castId];
  const prologueScene=season2PrologueScene(prologue,castId);
  const state=useMemo(()=>deriveBuklodSeasonState(
    season,manilaCalendarDay(),verified),[season,verified]);
  const journey=SEASON_JOURNEY_TRACKS.find(x=>x.id===track)??SEASON_JOURNEY_TRACKS[0];
  const inProgress=state.phase==='LIVE';
  const preparing=state.phase==='PREPARATION';
  const ended=state.phase==='ENDED_AWAITING_CLOSE';
  const subtitle=ended
    ? 'Season dates ended; final rankings must be reconciled.'
    : preparing?'An adventure is scheduled. Preview the path before launch.'
    : inProgress?'Official dates are in progress. New chapter rewards are not yet activated here.'
    : 'Explore the Season V2 concept while awaiting an official schedule.';

  return (
    <View style={s.wrapper}>
      <Pressable accessibilityRole="button"
        accessibilityLabel={open?'Close Season Journey preview':'Open Season Journey preview'}
        accessibilityState={{expanded:open}}
        onPress={()=>setOpen(x=>!x)} style={s.header}>
        <View style={s.iconCircle}>
          <MaterialCommunityIcons name="compass-outline" color={C.green} size={22}/>
        </View>
        <View style={{flex:1,minWidth:0}}>
          <Text style={s.kicker}>SEASON JOURNEY · PREVIEW</Text>
          <Text style={s.heading} numberOfLines={1}>
            {state.season?.title??'A new BUKLOD adventure'}
          </Text>
          <Text style={s.subheading} numberOfLines={2}>{state.label}</Text>
          <Text style={s.targetLabel}>SEASON 2 TARGET · DEC 6 · NOT PUBLISHED</Text>
        </View>
        <MaterialCommunityIcons name={open?'chevron-up':'chevron-down'}
          color={C.green} size={24}/>
      </Pressable>
      {open?(
        <View style={s.content}>
          <Text style={s.description}>{subtitle}</Text>
          <View style={s.planBox}>
            <Text style={s.planTitle}>SEASON 2 PREPARATION · DECEMBER 6, 2026</Text>
            <Text style={s.planDesc}>Target opening only. Season 1 results and official publication must be verified before these become real announcements.</Text>
            {previewSeasonPreparationDates(SEASON2_OPENING_TARGET.manilaDay).map(item=>(
              <View key={item.stage} style={s.planRow}>
                <Text style={s.planDay}>{item.manilaDay}</Text>
                <Text style={s.planStage}>{item.stage.replace(/_\d+D$/,'').replaceAll('_',' ')}</Text>
              </View>
            ))}
          </View>
          {preparing||inProgress?(
            <View style={{gap:5}}>
              <View style={s.between}>
                <Text style={s.label}>{preparing?'Opening countdown':'Calendar progress'}</Text>
                <Text style={s.label}>{preparing
                  ?String(state.daysUntilStart)+' days until start'
                  :String(state.daysRemaining)+' days scheduled remaining'}</Text>
              </View>
              <View style={s.progressBg}>
                <View style={[s.progressBar,
                  {width:(String(state.progressPercent??0)+'%') as DimensionValue}]}/>
              </View>
            </View>
          ):null}
          <Text style={s.sectionTitle}>CHOOSE YOUR ADVENTURE</Text>
          <View style={s.choices}>
            {SEASON_JOURNEY_TRACKS.map(item=>(
              <Pressable key={item.id} accessibilityRole="button"
                accessibilityLabel={'Preview '+item.title+' journey'}
                accessibilityState={{selected:track===item.id}}
                onPress={()=>setTrack(item.id)}
                style={[s.choice,track===item.id&&s.choiceSelected]}>
                <Text style={[s.choiceText,track===item.id&&s.choiceTextOn]}>
                  {item.title}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={s.pathPreview}>
            <Text style={s.pathTitle}>{journey.title} Path</Text>
            <Text style={s.pathDesc}>{journey.detail}</Text>
            <Text style={s.previewNote}>
              Preview only — not enrolled. No BP, QMP, items or tokens awarded.
            </Text>
          </View>
          <View style={s.storyIntro}>
            <Text style={s.storyTitle}>
              {BUKLOD_SEASON2_CAMPAIGN.title} · {BUKLOD_SEASON2_CAMPAIGN.subtitle}
            </Text>
            <Text style={s.storyText}>
              A fading beacon connects 13 journeys. Members discover stories,
              create something real and build a community worth remembering.
            </Text>
            <Text style={s.previewNote}>
              Concept only · Proposed 12 weeks · End date not published
            </Text>
          </View>
          <View style={s.prologue}>
            <Text style={s.prologueKicker}>PLAYABLE PROLOGUE · OFFLINE PREVIEW</Text>
            <Text style={s.prologueTitle}>{prologueScene.title}</Text>
            <Text style={s.prologueBody}>{prologueScene.text}</Text>
            {prologue.step==='START'?(
              <View style={s.prologueChoices}>
                {SEASON_JOURNEY_TRACKS.map(item=>(
                  <Pressable key={item.id} accessibilityRole="button"
                    accessibilityLabel={'Start '+item.title+' story'}
                    onPress={()=>setPrologue(state=>nextSeason2Prologue(
                      state,item.id as 'explorer'|'creator'|'together'))}
                    style={s.prologueChoice}>
                    <Text style={s.prologueChoiceText}>{item.title}</Text>
                  </Pressable>
                ))}
              </View>
            ):(
              <Pressable accessibilityRole="button"
                accessibilityLabel={prologue.step==='SCENE'?'Finish prologue':'Replay prologue'}
                onPress={()=>setPrologue(state=>nextSeason2Prologue(
                  state,state.step==='SCENE'?'finish':'restart'))}
                style={s.prologueNext}>
                <Text style={s.prologueNextText}>
                  {prologue.step==='SCENE'?'Discover the next scene':'Replay the story'}
                </Text>
                <MaterialCommunityIcons name="arrow-right" size={16} color="#FFFFFF"/>
              </Pressable>
            )}
            <Text style={s.previewNote}>
              Story demo only: no posting, enrollment, rewards or backend changes.
            </Text>
          </View>
          <Text style={s.sectionTitle}>MEET THE 13 GUIDES</Text>
          <View style={s.castRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="Previous Season guide"
              onPress={()=>setCastIndex(i=>(i+BUKLOD_SEASON2_CAST_ORDER.length-1)%BUKLOD_SEASON2_CAST_ORDER.length)}
              style={s.castArrow}>
              <MaterialCommunityIcons name="chevron-left" color={C.green} size={19}/>
            </Pressable>
            <View style={s.castContent}>
              <Text style={s.castName}>
                {BUKLOD_CHARACTER_DISPLAY_NAME[castId]} · {cast.role}
              </Text>
              <Text style={s.castLine}>{cast.line}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Next Season guide"
              onPress={()=>setCastIndex(i=>(i+1)%BUKLOD_SEASON2_CAST_ORDER.length)}
              style={s.castArrow}>
              <MaterialCommunityIcons name="chevron-right" color={C.green} size={19}/>
            </Pressable>
          </View>
          <Text style={s.sectionTitle}>FOUR STORY ARCS · PREVIEW</Text>
          {BUKLOD_SEASON2_ACTS.map((chapter,index)=>(
            <View style={s.chapter} key={chapter.code}>
              <View style={s.chapterDot}>
                <Text style={s.chapterNum}>{index+1}</Text>
              </View>
              <View style={{flex:1}}>
                <Text style={s.chapterTitle}>{chapter.title} · {chapter.localTitle}</Text>
                <Text style={s.chapterDesc}>{chapter.teaser}</Text>
                <Text style={s.weekMeta}>
                  Concept weeks {chapter.weeks[0]}–{chapter.weeks[1]} · {chapter.cosmeticPreview}
                </Text>
              </View>
              <MaterialCommunityIcons name="lock-outline" color="#90AB9A" size={17}/>
            </View>
          ))}
          <Pressable accessibilityRole="button" accessibilityState={{expanded:roadmapOpen}}
            accessibilityLabel={roadmapOpen?'Hide twelve-week story roadmap':'Preview twelve-week story roadmap'}
            onPress={()=>setRoadmapOpen(v=>!v)} style={s.roadmapToggle}>
            <Text style={s.roadmapToggleText}>12-WEEK STORY BOARD · DESIGN ONLY</Text>
            <MaterialCommunityIcons name={roadmapOpen?'chevron-up':'chevron-down'}
              size={19} color={C.green}/>
          </Pressable>
          {roadmapOpen?BUKLOD_SEASON2_WEEKLY_BEATS.map(item=>(
            <View key={item.week} style={s.weekRow}>
              <Pressable accessibilityRole="button"
                accessibilityState={{expanded:weekDetail===item.week}}
                onPress={()=>setWeekDetail(n=>n===item.week?null:item.week)}
                style={s.weekHeader}>
                <Text style={s.weekLabel}>W{item.week} · {item.title}</Text>
                <Text style={s.weekDate}>
                  {previewSeason2EditorialWeek(item.week)?.date??'TBD'}
                </Text>
              </Pressable>
              <Text style={s.chapterDesc}>{item.chapterBeat}</Text>
              {weekDetail===item.week?(
                <View style={s.weekDetail}>
                  <Text style={s.weekDetailText}>
                    Verified source concept: {item.primaryEvidence}
                  </Text>
                  <Text style={s.weekDetailText}>
                    Accessible alternative: {item.alternativePath}
                  </Text>
                  <Text style={s.previewNote}>Not published or reward-eligible</Text>
                </View>
              ):null}
            </View>
          )):null}
          <View style={s.prize}>
            <MaterialCommunityIcons name="star-circle-outline" color={C.gold} size={22}/>
            <View style={{flex:1}}>
              <Text style={s.prizeTitle}>REWARDS SHOWCASE · COMING SOON</Text>
              <Text style={s.prizeText}>
                {BUKLOD_SEASON2_REWARDS.map(item=>item.name).join(' · ')}.
                Locked previews; real grants need verified Character receipts.
              </Text>
            </View>
          </View>
          <Text style={s.footer}>
            Reveal → Choose → Countdown → Chapter drops → Finale → Awards.
            Notifications are not enabled by this preview.
          </Text>
        </View>
      ):null}
    </View>
  );
}
const s=StyleSheet.create({
  wrapper:{marginTop:9,borderRadius:16,borderWidth:1,borderColor:C.line,
    backgroundColor:C.pale,overflow:'hidden'},
  header:{flexDirection:'row',alignItems:'center',gap:9,paddingHorizontal:12,
    paddingVertical:10},
  iconCircle:{height:36,width:36,borderRadius:18,backgroundColor:'#DCF5E6',
    alignItems:'center',justifyContent:'center'},
  kicker:{fontSize:9,color:C.green,fontWeight:'900',letterSpacing:0.5},
  heading:{fontSize:14,fontWeight:'900',color:C.ink,marginTop:1},
  subheading:{fontSize:10.5,color:C.muted,marginTop:1},
  content:{borderTopWidth:1,borderTopColor:C.line,padding:11,gap:9},
  description:{fontSize:11,lineHeight:16,color:C.muted},
  targetLabel:{fontSize:9,lineHeight:14,color:C.green,fontWeight:'800',marginTop:2},
  planBox:{borderRadius:10,backgroundColor:'#E6F5EC',padding:9,gap:5},
  planTitle:{fontSize:10,fontWeight:'900',color:C.green},
  planDesc:{fontSize:10,lineHeight:15,color:C.muted},
  planRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},
  planDay:{fontSize:10,color:C.ink,fontWeight:'800'},
  planStage:{fontSize:10,color:C.muted,fontWeight:'700'},
  between:{flexDirection:'row',justifyContent:'space-between',gap:7},
  label:{fontSize:10,color:C.green,fontWeight:'700'},
  progressBg:{height:7,borderRadius:7,overflow:'hidden',backgroundColor:'#DCEFE2'},
  progressBar:{height:'100%',borderRadius:7,backgroundColor:'#1AA062'},
  sectionTitle:{fontSize:10,fontWeight:'900',letterSpacing:0.4,color:C.ink,marginTop:4},
  choices:{flexDirection:'row',gap:5},
  choice:{flex:1,alignItems:'center',borderRadius:9,borderWidth:1,
    borderColor:'#D4E7D8',paddingVertical:9,backgroundColor:'#FFFFFF'},
  choiceSelected:{borderColor:'#2EA46A',backgroundColor:'#DCF4E5'},
  choiceText:{fontSize:10,color:C.muted,fontWeight:'800'},
  choiceTextOn:{color:C.green},
  pathPreview:{backgroundColor:'#E5F6E9',padding:10,borderRadius:9,gap:3},
  pathTitle:{fontSize:12,fontWeight:'900',color:C.ink},
  pathDesc:{fontSize:11,color:C.muted,lineHeight:16},
  previewNote:{fontSize:9,color:C.green,fontWeight:'700'},
  chapter:{flexDirection:'row',alignItems:'center',gap:9,paddingVertical:7,
    borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#D7E9DD'},
  chapterDot:{width:26,height:26,borderRadius:13,backgroundColor:'#DBEFE3',
    justifyContent:'center',alignItems:'center'},
  chapterNum:{fontSize:11,color:C.green,fontWeight:'900'},
  chapterTitle:{fontSize:12,fontWeight:'900',color:C.ink},
  chapterDesc:{fontSize:10,lineHeight:14,color:C.muted},
  prize:{flexDirection:'row',gap:8,padding:9,borderRadius:9,
    backgroundColor:'#FFF7E5',borderWidth:1,borderColor:'#EEDBAD'},
  prizeTitle:{fontSize:10,fontWeight:'900',color:C.gold},
  prizeText:{fontSize:10,lineHeight:15,color:'#715C31'},
  prologue:{padding:11,borderRadius:11,backgroundColor:'#132E27',gap:8},
  prologueKicker:{fontSize:9,fontWeight:'900',letterSpacing:0.5,color:'#B5ECCB'},
  prologueTitle:{fontSize:16,fontWeight:'900',color:'#FFFFFF'},
  prologueBody:{fontSize:11,lineHeight:17,color:'#DBEFE3'},
  prologueChoices:{flexDirection:'row',gap:5},
  prologueChoice:{flex:1,alignItems:'center',borderRadius:8,borderWidth:1,
    borderColor:'#9BC9AE',paddingVertical:9,paddingHorizontal:4},
  prologueChoiceText:{fontSize:10,fontWeight:'900',color:'#FFFFFF'},
  prologueNext:{flexDirection:'row',alignItems:'center',justifyContent:'center',
    gap:6,borderRadius:8,backgroundColor:'#198A58',padding:9},
  prologueNextText:{fontSize:11,fontWeight:'900',color:'#FFFFFF'},
  storyIntro:{borderRadius:10,padding:10,gap:4,backgroundColor:'#E7F2FF'},
  storyTitle:{fontSize:13,fontWeight:'900',color:'#183F69'},
  storyText:{fontSize:11,lineHeight:16,color:'#395875'},
  castRow:{flexDirection:'row',alignItems:'center',gap:7,padding:8,
    borderRadius:10,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:C.line},
  castArrow:{height:29,width:29,borderRadius:15,backgroundColor:'#DCF4E5',
    justifyContent:'center',alignItems:'center'},
  castContent:{flex:1,gap:2},
  castName:{fontSize:12,color:C.ink,fontWeight:'900'},
  castLine:{fontSize:10,lineHeight:15,color:C.muted},
  weekMeta:{fontSize:9,color:C.green,fontWeight:'700',marginTop:2},
  roadmapToggle:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',
    paddingHorizontal:10,paddingVertical:10,borderRadius:9,backgroundColor:'#E4F3E9'},
  roadmapToggleText:{fontSize:10,color:C.green,fontWeight:'900'},
  weekRow:{borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.line,
    paddingVertical:6,gap:2},
  weekHeader:{flexDirection:'row',justifyContent:'space-between',gap:6},
  weekLabel:{fontSize:11,color:C.ink,fontWeight:'800',flex:1},
  weekDate:{fontSize:9,color:C.muted,fontWeight:'700'},
  weekDetail:{backgroundColor:'#FFFFFF',borderRadius:8,padding:8,gap:3},
  weekDetailText:{fontSize:10,color:C.muted,lineHeight:14},
  footer:{fontSize:9,lineHeight:14,color:C.muted},
});
