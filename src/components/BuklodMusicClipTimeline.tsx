import React,{useMemo,useRef,useState} from 'react';
import {PanResponder,Pressable,Text,View} from 'react-native';

type Props={start:number;length:number;total:number;fixedLength?:number;
 onChange:(start:number,length:number)=>void;
 onScrub?:(start:number,settled:boolean)=>void};
type Drag={mode:'move'|'start'|'end';start:number;length:number;total:number};
const HEIGHTS=[17,34,42,28,47,19,36,49,31,20,45,25,33,44,16,42,29,39,20,48,37,25,18,41,50,29,35,20,45,26,37,49,23,42,28,34,19,48,31,40,26,47,20,35,49,27,39,18];
const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
export default function BuklodMusicClipTimeline({start,length,total,fixedLength,onChange,onScrub}:Props){
 const safeTotal=clamp(Math.round(total||120),30,21600);
 const [width,setWidth]=useState(260);
 const latest=useRef(start);
 const lastSeekAt=useRef(0);
 const data=useRef({start,length,total:safeTotal,width,onChange,onScrub,fixedLength});
 data.current={start,length,total:safeTotal,width,onChange,onScrub,fixedLength};
 const drag=useRef<Drag>({mode:'move',start,length,total:safeTotal});
 const emitPreview=(s:number,settled:boolean)=>{
   const now=Date.now();
   if(settled||now-lastSeekAt.current>=120){
     lastSeekAt.current=now;
     data.current.onScrub?.(s,settled);
   }
 };
 const apply=(s:number,durationSeconds:number)=>{
   const n=data.current;
   const duration=n.fixedLength??clamp(Math.round(durationSeconds),5,Math.min(60,n.total));
   const next=clamp(Math.round(s),0,Math.max(0,n.total-duration));
   latest.current=next;
   n.onChange(next,duration);
   emitPreview(next,false);
 };
 const responder=useMemo(()=>PanResponder.create({
   onStartShouldSetPanResponder:()=>true,
   onMoveShouldSetPanResponder:()=>true,
   // The clip, not the underlying scroll list, owns an active drag.
   onMoveShouldSetPanResponderCapture:()=>true,
   onShouldBlockNativeResponder:()=>true,
   onPanResponderTerminationRequest:()=>false,
   onPanResponderGrant:event=>{
     const n=data.current;
     const x=clamp(Number(event.nativeEvent.locationX)||0,0,n.width);
     const left=(n.start/n.total)*n.width,right=((n.start+n.length)/n.total)*n.width;
     const mode:Drag['mode']=n.fixedLength?'move':Math.abs(x-left)<21?'start':Math.abs(x-right)<21?'end':'move';
     drag.current={mode,start:n.start,length:n.length,total:n.total};
     if(mode==='move'&&(x<left||x>right)){
       const centered=clamp((x/n.width)*n.total-n.length/2,0,Math.max(0,n.total-n.length));
       drag.current.start=centered;
       apply(centered,n.length);
     }else{latest.current=n.start;emitPreview(n.start,true);}
   },
   onPanResponderMove:(_,gesture)=>{
     const s=drag.current.start,d=drag.current.length;
     const seconds=(gesture.dx/Math.max(1,data.current.width))*drag.current.total;
     if(drag.current.mode==='start'){
       const next=clamp(s+seconds,Math.max(0,s+d-60),s+d-5);
       apply(next,s+d-next);
     }else if(drag.current.mode==='end'){
       apply(s,clamp(d+seconds,5,Math.min(60,data.current.total-s)));
     }else{apply(s+seconds,d);}
   },
   onPanResponderRelease:()=>emitPreview(latest.current,true),
   onPanResponderTerminate:()=>emitPreview(latest.current,true),
 }),[]);
 const left=(clamp(start,0,safeTotal)/safeTotal)*100;
 const right=(clamp(start+length,0,safeTotal)/safeTotal)*100;
 const nudge=(seconds:number)=>{
   const n=data.current;
   const next=clamp(n.start+seconds,0,Math.max(0,n.total-n.length));
   apply(next,n.length);
   emitPreview(next,true);
 };
 return <View>
   <View accessibilityLabel="Music clip waveform timeline. Drag to hear the chosen part immediately."
     onLayout={e=>setWidth(Math.max(120,e.nativeEvent.layout.width))}
     {...responder.panHandlers}
     style={{height:76,backgroundColor:'#E4EDE8',borderRadius:12,overflow:'hidden',
       flexDirection:'row',alignItems:'center',justifyContent:'space-around',paddingHorizontal:3}}>
     {HEIGHTS.map((h,i)=><View key={i} pointerEvents="none" style={{width:3,height:h,
       backgroundColor:i/HEIGHTS.length*100>=left&&i/HEIGHTS.length*100<=right?'#155F47':'#9CB7A9',borderRadius:3}}/>)}
     <View pointerEvents="none" style={{position:'absolute',left:`${left}%` as const,
       width:`${Math.max(1,right-left)}%` as const,top:3,bottom:3,
       borderColor:'#155F47',borderWidth:2,borderRadius:9,backgroundColor:'rgba(34,157,104,0.12)',
       flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
       <View style={{width:5,height:34,borderRadius:4,backgroundColor:'#155F47',marginLeft:-2}}/>
       <View style={{width:5,height:34,borderRadius:4,backgroundColor:'#155F47',marginRight:-2}}/>
     </View>
   </View>
   <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:7,gap:7}}>
     <Pressable onPress={()=>nudge(-5)} accessibilityRole="button"
       accessibilityLabel="Move music selection 5 seconds earlier"
       style={{minWidth:42,minHeight:34,paddingHorizontal:8,borderRadius:10,
         backgroundColor:'#D7EEE2',justifyContent:'center',alignItems:'center'}}>
       <Text style={{fontWeight:'900',color:'#185F47'}}>−5s</Text>
     </Pressable>
     <View style={{flex:1,alignItems:'center'}}>
       <Text style={{color:'#175E45',fontSize:12,fontWeight:'900'}}>
         {Math.round(start)}s – {Math.round(start+length)}s
       </Text>
       <Text style={{color:'#567567',fontSize:10}}>Drag bar • {Math.round(safeTotal)}s track</Text>
     </View>
     <Pressable onPress={()=>nudge(5)} accessibilityRole="button"
       accessibilityLabel="Move music selection 5 seconds later"
       style={{minWidth:42,minHeight:34,paddingHorizontal:8,borderRadius:10,
         backgroundColor:'#D7EEE2',justifyContent:'center',alignItems:'center'}}>
       <Text style={{fontWeight:'900',color:'#185F47'}}>+5s</Text>
     </Pressable>
   </View>
 </View>;
}
