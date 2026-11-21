/** Read-only artwork gallery. Never grants items, currency, gameplay powers or trades. */
import React,{useMemo,useState} from 'react';
import {Image,Pressable,StyleSheet,Text,View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import {CLASS_ART} from '@/lib/buklodKingdomClassArt';
import {VISUAL_CLASSES,getVisualClassItems,tradeReadiness} from '@/lib/buklodKingdomClassCatalog';

const LEGACY_CLASSES=VISUAL_CLASSES.filter(c=>c.status==='art_supplied');
const C={bg:'#0a2e37',gold:'#e9c98b',light:'#e9f9ed',mint:'#a8e9ba',border:'#658f7c',muted:'#bfdbd0'};
export default function BuklodKingdomClassGallery(){
 const [selected,setSelected]=useState('light');
 const group=useMemo(()=>LEGACY_CLASSES.find(c=>c.id===selected)??LEGACY_CLASSES[0],[selected]);
 const items=useMemo(()=>getVisualClassItems(group.id),[group.id]);
 const images=CLASS_ART[group.id]??[];
 return <View style={s.root}>
   <LinearGradient colors={['#224e47','#0d333c','#112a3d']} style={s.heading}>
     <Text style={s.eyebrow}>BUKLOD KINGDOM • ITEM ATLAS</Text>
     <Text style={s.title}>Classic Kingdom Collections</Text>
     <Text style={s.lead}>Original Library collection designs: 7 classic classes, 42 pieces. Nasa Core Atlas tab ang 20 bagong item classes at 120 artworks.</Text>
     <View style={s.statistics}>
       <View><Text style={s.big}>7</Text><Text style={s.micro}>REFERENCE SHEETS</Text></View>
       <View><Text style={s.big}>42</Text><Text style={s.micro}>EXTRACTED DESIGNS</Text></View>
       <View><Text style={s.big}>20</Text><Text style={s.micro}>CORE CLASSES IN OTHER TAB</Text></View>
     </View>
   </LinearGradient>
   <Text style={s.subheading}>PUMILI NG ITEM CLASS</Text>
   <View style={s.groupGrid}>
     {LEGACY_CLASSES.map(c=><Pressable key={c.id} onPress={()=>setSelected(c.id)}
      accessibilityRole="button" accessibilityState={{selected:c.id===selected}}
      style={[s.groupButton,c.id===selected&&s.groupButtonActive]}>
       <MaterialCommunityIcons name={c.status==='art_supplied'?'check-decagram':'image-outline'}
         color={c.id===selected?'#10362c':c.status==='art_supplied'?C.mint:C.muted} size={15}/>
       <Text numberOfLines={2} style={[s.groupName,c.id===selected&&s.groupNameActive]}>{c.title.replace(' Class','')}</Text>
     </Pressable>)}
   </View>
   <LinearGradient colors={['#234d44','#12383a','#102c3a']} style={s.classHead}>
     <View style={{flex:1}}>
       <Text style={s.eyebrow}>SELECTED CLASS</Text>
       <Text style={s.className}>{group.title}</Text>
       <Text style={s.status}>{group.status==='art_supplied'?'OWNER-SUPPLIED DESIGN ART':group.status==='unverified_eighth_concept'?'PROVISIONAL — REFERENCE NOT CONFIRMED':'NEW DESIGN CONCEPT — ART NOT PRODUCED'}</Text>
     </View>
     <MaterialCommunityIcons name={group.status==='art_supplied'?'diamond-stone':'palette-outline'} color={C.gold} size={36}/>
   </LinearGradient>
   {items.map((item,i)=><View key={item.id} style={s.item}>
     {images[i]? <Image style={s.image} source={images[i]} resizeMode="contain"/>:
       <View style={s.placeholder}><MaterialCommunityIcons name="diamond-outline" size={32} color={C.gold}/></View>}
     <View style={{flex:1,minWidth:0,gap:5}}>
       <Text style={s.name}>{item.name}</Text>
       <Text style={s.description}>TARGET REQUIREMENT • {item.requirement}</Text>
       <Text style={s.description}>PROPOSED USE • {item.usage}</Text>
       <Text style={s.rule}>TRADE POLICY • {item.tradePolicy==='bound'?'PERSONAL / BOUND':item.tradePolicy==='craft_material'?'FUTURE CRAFTING ONLY':'FUTURE SPARE COSMETICS ONLY'} · {tradeReadiness(item)}</Text>
     </View>
   </View>)}
   <View style={s.foot}><MaterialCommunityIcons name="shield-lock-outline" size={20} color={C.mint}/>
    <Text style={s.footText}>Preview only. Walang claim, mint, trade, random paid chest, BUKLOD Points, official XP, real Shards, AdMob income o cash rewards. Ang mga bagong Weapon at iba pang core classes ay nasa Core Atlas tab, gamit ang 30 Library reference images.</Text>
   </View>
 </View>;
}
const s=StyleSheet.create({
 root:{gap:12},heading:{padding:16,borderRadius:18,borderWidth:1,borderColor:C.border,gap:10},
 eyebrow:{fontSize:10,fontWeight:'900',letterSpacing:1.1,color:C.mint},title:{fontSize:21,fontWeight:'900',color:C.light},
 lead:{fontSize:11,lineHeight:17,color:C.muted},statistics:{flexDirection:'row',justifyContent:'space-between',gap:8,marginTop:4},
 big:{fontWeight:'900',fontSize:23,color:C.gold},micro:{fontWeight:'800',fontSize:8,color:C.muted,letterSpacing:.5},
 subheading:{fontWeight:'900',fontSize:12,color:C.gold,letterSpacing:.7},groupGrid:{flexDirection:'row',flexWrap:'wrap',gap:7},
 groupButton:{width:'31.5%',minHeight:41,paddingHorizontal:8,paddingVertical:7,borderRadius:10,
   flexDirection:'row',alignItems:'center',gap:5,borderWidth:1,borderColor:C.border,backgroundColor:C.bg},
 groupButtonActive:{backgroundColor:C.mint,borderColor:C.mint},groupName:{color:C.light,flex:1,fontSize:10,fontWeight:'800'},
 groupNameActive:{color:'#0d342a'},classHead:{borderWidth:1,borderColor:'#adcf9a',borderRadius:15,padding:14,flexDirection:'row',alignItems:'center'},
 className:{fontSize:20,fontWeight:'900',color:C.light},status:{fontSize:9,marginTop:7,fontWeight:'900',color:C.gold},
 item:{flexDirection:'row',alignItems:'flex-start',gap:10,backgroundColor:C.bg,borderWidth:1,borderColor:'#55766c',borderRadius:13,padding:9},
 image:{width:116,height:86,borderRadius:9},placeholder:{width:116,height:86,borderRadius:9,backgroundColor:'#184a42',alignItems:'center',justifyContent:'center'},
 name:{fontSize:14,fontWeight:'900',color:C.light},description:{fontSize:10,lineHeight:15,color:C.muted},
 rule:{fontSize:9,lineHeight:15,fontWeight:'900',color:C.gold},
 foot:{flexDirection:'row',gap:8,padding:12,borderRadius:12,backgroundColor:'#123f38'},footText:{flex:1,color:C.muted,fontSize:10,lineHeight:16}
});
