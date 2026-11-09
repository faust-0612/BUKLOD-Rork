import React,{useMemo,useRef,useState} from 'react';
import {PanResponder,Text,View} from 'react-native';

type Props={start:number;length:number;total:number;fixedLength?:number;onChange:(start:number,length:number)=>void};
type Drag={mode:'move'|'start'|'end';start:number;length:number;total:number};
const HEIGHTS=[17,34,42,28,47,19,36,49,31,20,45,25,33,44,16,42,29,39,20,48,37,25,18,41,50,29,35,20,45,26,37,49,23,42,28,34,19,48,31,40,26,47,20,35,49,27,39,18];
const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
export default function BuklodMusicClipTimeline({start,length,total,fixedLength,onChange}:Props){
  const safeTotal=clamp(Math.round(total||120),60,21600);
  const [width,setWidth]=useState(260);
  const data=useRef({start,length,total:safeTotal,width,onChange,fixedLength});
  data.current={start,length,total:safeTotal,width,onChange,fixedLength};
  const drag=useRef<Drag>({mode:'move',start,length,total:safeTotal});
  const apply=(startSeconds:number,durationSeconds:number)=>{
    const n=data.current;
    const duration=n.fixedLength ?? clamp(Math.round(durationSeconds),5,Math.min(60,n.total));
    const startAt=clamp(Math.round(startSeconds),0,Math.max(0,n.total-duration));
    n.onChange(startAt,duration);
  };
  const responder=useMemo(()=>PanResponder.create({
    onStartShouldSetPanResponder:()=>true,
    onMoveShouldSetPanResponder:()=>true,
    onPanResponderTerminationRequest:()=>false,
    onPanResponderGrant:event=>{
      const n=data.current;
      const x=event.nativeEvent.locationX;
      const left=(n.start/n.total)*n.width;
      const right=((n.start+n.length)/n.total)*n.width;
      const mode:Drag['mode']=n.fixedLength?'move':Math.abs(x-left)<21?'start':Math.abs(x-right)<21?'end':'move';
      drag.current={mode,start:n.start,length:n.length,total:n.total};
      if(mode==='move'&&(x<left||x>right)){
        const centered=clamp((x/n.width)*n.total-n.length/2,0,Math.max(0,n.total-n.length));
        drag.current.start=centered;
        apply(centered,n.length);
      }
    },
    onPanResponderMove:(_,gesture)=>{
      const startAt=drag.current.start;
      const duration=drag.current.length;
      const seconds=(gesture.dx/Math.max(1,data.current.width))*drag.current.total;
      if(drag.current.mode==='start'){
        const nextStart=clamp(startAt+seconds,Math.max(0,startAt+duration-60),startAt+duration-5);
        apply(nextStart,startAt+duration-nextStart);
      }else if(drag.current.mode==='end'){
        apply(startAt,clamp(duration+seconds,5,Math.min(60,data.current.total-startAt)));
      }else{
        apply(startAt+seconds,duration);
      }
    },
  }),[]);
  const left=(clamp(start,0,safeTotal)/safeTotal)*100;
  const right=(clamp(start+length,0,safeTotal)/safeTotal)*100;
  return <View>
    <View accessibilityLabel="Music clip waveform timeline. Drag the highlighted selection to choose where the fixed 30-second segment begins."
      onLayout={event=>setWidth(Math.max(120,event.nativeEvent.layout.width))}
      {...responder.panHandlers}
      style={{height:76,backgroundColor:'#E4EDE8',borderRadius:12,overflow:'hidden',
        flexDirection:'row',alignItems:'center',justifyContent:'space-around',paddingHorizontal:3}}>
      {HEIGHTS.map((height,i)=><View key={i} pointerEvents="none"
        style={{width:3,height,backgroundColor:i/HEIGHTS.length*100>=left&&i/HEIGHTS.length*100<=right?'#155F47':'#9CB7A9',borderRadius:3}}/>)}
      <View pointerEvents="none" style={{position:'absolute',left:`${left}%` as const,width:`${Math.max(1,right-left)}%` as const,top:3,bottom:3,
        borderColor:'#155F47',borderWidth:2,borderRadius:9,backgroundColor:'rgba(34,157,104,0.12)',
        flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
        <View style={{width:5,height:34,borderRadius:4,backgroundColor:'#155F47',marginLeft:-2}}/>
        <View style={{width:5,height:34,borderRadius:4,backgroundColor:'#155F47',marginRight:-2}}/>
      </View>
    </View>
    <View style={{flexDirection:'row',justifyContent:'space-between',marginTop:5}}>
      <Text style={{color:'#567567',fontSize:11}}>Start {Math.round(start)}s</Text>
      <Text style={{color:'#1A654D',fontSize:11,fontWeight:'800'}}>Selected {Math.round(length)}s</Text>
      <Text style={{color:'#567567',fontSize:11}}>{Math.round(safeTotal)}s</Text>
    </View>
  </View>;
}
