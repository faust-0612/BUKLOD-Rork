import React,{useMemo,useState} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {SEASON_CHAPTER_PREVIEWS,SEASON_JOURNEY_TRACKS,
  deriveBuklodSeasonState,manilaCalendarDay,type SeasonSummary}
  from '@/lib/buklodSeasonJourneyR2';

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
        </View>
        <MaterialCommunityIcons name={open?'chevron-up':'chevron-down'}
          color={C.green} size={24}/>
      </Pressable>
      {open?(
        <View style={s.content}>
          <Text style={s.description}>{subtitle}</Text>
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
                  {width:String(state.progressPercent??0)+'%'}]}/>
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
          <Text style={s.sectionTitle}>FOUR CHAPTERS TO DISCOVER</Text>
          {SEASON_CHAPTER_PREVIEWS.map((chapter,index)=>(
            <View style={s.chapter} key={chapter.code}>
              <View style={s.chapterDot}>
                <Text style={s.chapterNum}>{index+1}</Text>
              </View>
              <View style={{flex:1}}>
                <Text style={s.chapterTitle}>{chapter.title}</Text>
                <Text style={s.chapterDesc}>{chapter.detail}</Text>
              </View>
              <MaterialCommunityIcons name="lock-outline" color="#90AB9A" size={17}/>
            </View>
          ))}
          <View style={s.prize}>
            <MaterialCommunityIcons name="star-circle-outline" color={C.gold} size={22}/>
            <View style={{flex:1}}>
              <Text style={s.prizeTitle}>REWARDS SHOWCASE · COMING SOON</Text>
              <Text style={s.prizeText}>
                Character cosmetics, permanent badges, team celebrations and
                verified trophies need official publication and source proofs.
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
  footer:{fontSize:9,lineHeight:14,color:C.muted},
});
