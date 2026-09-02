/* PATCH_191C_GIF_CATEGORIES_SEARCH_LOADING */
import React,{useMemo,useState} from 'react';
import {
  ActivityIndicator,Modal,Pressable,ScrollView,StyleSheet,
  Text,TextInput,View
} from 'react-native';
import {Image as ExpoImage} from 'expo-image';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useConnectTheme} from '@/providers/ConnectThemeProvider';

type PickerTab='emoji'|'gif'|'avatar';
type GifLike={
  id:string;label?:string;title?:string;name?:string;category?:string;
  uri?:string;url?:string;previewUri?:string;preview_url?:string;
  imageUrl?:string;image_url?:string;[key:string]:unknown
};
type AvatarChoice={key:string;label?:string;emoji?:string;[key:string]:unknown};
type Props={
  visible:boolean;tab:PickerTab;sending?:boolean;emojis:readonly string[];
  avatarChoices:readonly AvatarChoice[];profileId?:string|null;profileName?:string|null;
  gifs:readonly GifLike[];onClose:()=>void;onTabChange:(tab:PickerTab)=>void;
  onNativeKeyboard:()=>void;onSendEmoji:(emoji:string)=>void;
  onSendGif:(gifId:string)=>void;onSendAvatar:(key:string)=>void;
};

const GIF_CATEGORIES=['All','Happy','Love','Laugh','Sad','Angry','Celebrate','Prayer','Encourage'] as const;
type GifCategory=typeof GIF_CATEGORIES[number];

function gifText(g:GifLike){
  return [g.label,g.title,g.name,g.category,g.id].filter(Boolean).join(' ').toLowerCase();
}
function inferCategory(g:GifLike):GifCategory{
  const t=gifText(g);
  if(/love|heart|kiss|hug|sweet|romance/.test(t))return 'Love';
  if(/laugh|haha|lol|funny|rofl|giggle/.test(t))return 'Laugh';
  if(/sad|cry|tears|lonely|sorry/.test(t))return 'Sad';
  if(/angry|mad|rage|annoy|irritat/.test(t))return 'Angry';
  if(/celebrat|party|congrats|birthday|cheer|victory/.test(t))return 'Celebrate';
  if(/pray|prayer|amen|bless|faith|worship/.test(t))return 'Prayer';
  if(/encour|you can|keep going|strong|hope|support|with you/.test(t))return 'Encourage';
  return 'Happy';
}
function gifUri(g:GifLike){
  for(const v of [g.previewUri,g.preview_url,g.uri,g.url,g.imageUrl,g.image_url]){
    if(typeof v==='string' && /^(https?:|file:|content:|data:)/i.test(v)) return v;
  }
  return null;
}
function gifLabel(g:GifLike){return String(g.label??g.title??g.name??'GIF');}

function GifCard({gif,disabled,onPress}:{gif:GifLike;disabled:boolean;onPress:()=>void}){
  const theme:any=useConnectTheme();
  const s=useMemo(()=>styles(theme),[theme]);
  const [loading,setLoading]=useState(true);
  const [failed,setFailed]=useState(false);
  const uri=gifUri(gif);

  return <Pressable disabled={disabled} onPress={onPress}
    style={({pressed})=>[s.gifCard,pressed&&!disabled?s.pressed:null,disabled?s.disabled:null]}>
    <View style={s.gifMedia}>
      {uri&&!failed?<>
        <ExpoImage source={{uri}} style={StyleSheet.absoluteFill} contentFit="cover"
          cachePolicy="memory-disk" transition={80}
          onLoadStart={()=>setLoading(true)}
          onLoad={()=>{setLoading(false);setFailed(false)}}
          onError={()=>{setLoading(false);setFailed(true)}}/>
        {loading?<View style={s.loading}><ActivityIndicator size="small" color={theme.accent}/></View>:null}
      </>:<View style={s.fallback}>
        <MaterialCommunityIcons name="file-gif-box" size={34} color={theme.accent}/>
        <Text numberOfLines={2} style={s.fallbackText}>{gifLabel(gif)}</Text>
      </View>}
      <View style={s.badge}><Text style={s.badgeText}>GIF</Text></View>
    </View>
    <Text numberOfLines={1} style={s.gifLabel}>{gifLabel(gif)}</Text>
  </Pressable>;
}

export function ConnectComposerPicker(p:Props){
  const theme:any=useConnectTheme();
  const s=useMemo(()=>styles(theme),[theme]);
  const [category,setCategory]=useState<GifCategory>('All');
  const [query,setQuery]=useState('');
  const [limit,setLimit]=useState(24);

  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase();
    return p.gifs.filter(g=>{
      if(category!=='All'&&inferCategory(g)!==category)return false;
      return !q||gifText(g).includes(q);
    });
  },[p.gifs,category,query]);

  const visible=filtered.slice(0,limit);
  const close=()=>{setQuery('');setLimit(24);p.onClose()};

  return <Modal visible={p.visible} transparent animationType="slide" onRequestClose={close}>
    <Pressable style={s.backdrop} onPress={close}>
      <Pressable style={s.sheet} onPress={()=>{}}>
        <View style={s.handle}/>
        <View style={s.header}>
          <Text style={s.title}>Reactions</Text>
          <Pressable onPress={close} hitSlop={10} style={s.close}>
            <MaterialCommunityIcons name="close" size={22} color={theme.textPrimary}/>
          </Pressable>
        </View>

        <View style={s.tabs}>
          {([['emoji','Emoji'],['gif','GIF'],['avatar','Avatar']] as const).map(([k,l])=>
            <Pressable key={k} onPress={()=>p.onTabChange(k)} style={[s.tab,p.tab===k?s.tabActive:null]}>
              <Text style={[s.tabText,p.tab===k?s.tabTextActive:null]}>{l}</Text>
            </Pressable>)}
        </View>

        {p.tab==='emoji'?<ScrollView style={s.body} contentContainerStyle={s.emojiGrid}>
          <Pressable onPress={p.onNativeKeyboard} style={s.nativeKeyboard}>
            <MaterialCommunityIcons name="keyboard-outline" size={22} color={theme.accent}/>
            <View style={{flex:1}}>
              <Text style={s.nativeTitle}>System keyboard</Text>
              <Text style={s.nativeSub}>Open your phone emoji keyboard.</Text>
            </View>
          </Pressable>
          {p.emojis.map((e,i)=><Pressable key={`${e}-${i}`} disabled={p.sending}
            onPress={()=>p.onSendEmoji(e)} style={s.emojiChoice}><Text style={s.emojiText}>{e}</Text></Pressable>)}
        </ScrollView>:null}

        {p.tab==='gif'?<View style={s.gifBody}>
          <View style={s.searchBox}>
            <MaterialCommunityIcons name="magnify" size={20} color={theme.textMuted}/>
            <TextInput value={query} onChangeText={v=>{setQuery(v);setLimit(24)}} placeholder="Search GIF"
              placeholderTextColor={theme.textMuted} style={s.searchInput}/>
            {!!query&&<Pressable onPress={()=>setQuery('')}>
              <MaterialCommunityIcons name="close-circle" size={18} color={theme.textMuted}/>
            </Pressable>}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.categories}>
            {GIF_CATEGORIES.map(c=><Pressable key={c} onPress={()=>{setCategory(c);setLimit(24)}}
              style={[s.chip,category===c?s.chipActive:null]}>
              <Text style={[s.chipText,category===c?s.chipTextActive:null]}>{c}</Text>
            </Pressable>)}
          </ScrollView>

          <ScrollView style={s.gifScroll} contentContainerStyle={s.gifGrid} keyboardShouldPersistTaps="handled">
            {visible.map(g=><GifCard key={g.id} gif={g} disabled={!!p.sending} onPress={()=>p.onSendGif(g.id)}/>)}
            {!visible.length?<View style={s.empty}>
              <MaterialCommunityIcons name="file-gif-box" size={42} color={theme.textMuted}/>
              <Text style={s.emptyTitle}>No GIF found</Text>
              <Text style={s.emptySub}>Try another category.</Text>
            </View>:null}
            {visible.length<filtered.length?<Pressable onPress={()=>setLimit(x=>x+24)} style={s.more}>
              <Text style={s.moreText}>Load more GIFs</Text>
            </Pressable>:null}
          </ScrollView>
        </View>:null}

        {p.tab==='avatar'?<ScrollView style={s.body} contentContainerStyle={s.avatarGrid}>
          <Text style={s.avatarHeading}>{p.profileName||'Your avatar'} reactions</Text>
          {p.avatarChoices.map(a=><Pressable key={a.key} disabled={p.sending}
            onPress={()=>p.onSendAvatar(a.key)} style={s.avatarChoice}>
            <Text style={s.avatarEmoji}>{a.emoji||'🙂'}</Text>
            <Text numberOfLines={1} style={s.avatarLabel}>{a.label||a.key}</Text>
          </Pressable>)}
        </ScrollView>:null}
      </Pressable>
    </Pressable>
  </Modal>;
}

function styles(theme:any){return StyleSheet.create({
  backdrop:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,.38)'},
  sheet:{maxHeight:'84%',minHeight:360,borderTopLeftRadius:24,borderTopRightRadius:24,backgroundColor:theme.surface,paddingTop:8,paddingBottom:16},
  handle:{width:42,height:4,alignSelf:'center',borderRadius:99,backgroundColor:theme.border,marginBottom:6},
  header:{minHeight:46,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  title:{color:theme.textPrimary,fontSize:18,fontWeight:'900'},
  close:{width:36,height:36,borderRadius:18,alignItems:'center',justifyContent:'center'},
  tabs:{flexDirection:'row',paddingHorizontal:12,gap:7,marginBottom:8},
  tab:{flex:1,height:38,borderRadius:12,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:theme.border},
  tabActive:{backgroundColor:theme.accentSoft??'#EAF5EF',borderColor:theme.accent},
  tabText:{color:theme.textMuted,fontSize:12.5,fontWeight:'900'},
  tabTextActive:{color:theme.accent},
  body:{flexGrow:0,paddingHorizontal:12},
  nativeKeyboard:{width:'100%',minHeight:54,paddingHorizontal:12,marginBottom:10,borderWidth:1,borderColor:theme.border,borderRadius:14,flexDirection:'row',alignItems:'center',gap:10},
  nativeTitle:{color:theme.textPrimary,fontSize:13.5,fontWeight:'900'},
  nativeSub:{marginTop:2,color:theme.textMuted,fontSize:12},
  emojiGrid:{flexDirection:'row',flexWrap:'wrap',gap:8,paddingBottom:18},
  emojiChoice:{width:52,height:52,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:theme.surfaceRaised??'#F5F7F6'},
  emojiText:{fontSize:26,lineHeight:32},
  gifBody:{flex:1,minHeight:390},
  searchBox:{marginHorizontal:12,minHeight:42,borderWidth:1,borderColor:theme.border,borderRadius:13,paddingHorizontal:10,flexDirection:'row',alignItems:'center',gap:7},
  searchInput:{flex:1,color:theme.textPrimary,fontSize:13,paddingVertical:7},
  categories:{paddingHorizontal:12,paddingVertical:10,gap:7},
  chip:{minHeight:34,paddingHorizontal:12,borderRadius:17,borderWidth:1,borderColor:theme.border,alignItems:'center',justifyContent:'center'},
  chipActive:{borderColor:theme.accent,backgroundColor:theme.accentSoft??'#EAF5EF'},
  chipText:{color:theme.textMuted,fontSize:11.5,fontWeight:'800'},
  chipTextActive:{color:theme.accent},
  gifScroll:{flex:1,paddingHorizontal:12},
  gifGrid:{flexDirection:'row',flexWrap:'wrap',gap:8,paddingBottom:24},
  gifCard:{width:'48.5%',minHeight:132,borderWidth:1,borderColor:theme.border,borderRadius:14,overflow:'hidden',backgroundColor:theme.surface},
  gifMedia:{height:104,position:'relative',backgroundColor:theme.surfaceRaised??'#F0F2F1'},
  loading:{position:'absolute',left:0,right:0,top:0,bottom:0,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(255,255,255,.42)'},
  fallback:{flex:1,alignItems:'center',justifyContent:'center',paddingHorizontal:8},
  fallbackText:{marginTop:4,color:theme.textMuted,textAlign:'center',fontSize:11,fontWeight:'700'},
  badge:{position:'absolute',right:6,bottom:6,minWidth:32,height:20,paddingHorizontal:5,borderRadius:6,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(0,0,0,.66)'},
  badgeText:{color:'#fff',fontSize:10,fontWeight:'900'},
  gifLabel:{minHeight:28,paddingHorizontal:8,paddingVertical:6,color:theme.textPrimary,fontSize:11.5,fontWeight:'800'},
  empty:{width:'100%',minHeight:190,alignItems:'center',justifyContent:'center',paddingHorizontal:18},
  emptyTitle:{marginTop:6,color:theme.textPrimary,fontSize:15,fontWeight:'900'},
  emptySub:{marginTop:3,color:theme.textMuted,fontSize:12,textAlign:'center'},
  more:{width:'100%',height:42,marginTop:4,borderRadius:13,borderWidth:1,borderColor:theme.accent,alignItems:'center',justifyContent:'center'},
  moreText:{color:theme.accent,fontWeight:'900',fontSize:12.5},
  avatarHeading:{width:'100%',marginBottom:10,color:theme.textMuted,fontSize:12,fontWeight:'800'},
  avatarGrid:{flexDirection:'row',flexWrap:'wrap',gap:9,paddingBottom:18},
  avatarChoice:{width:'47%',minHeight:98,borderRadius:16,borderWidth:1,borderColor:theme.border,alignItems:'center',justifyContent:'center',padding:8},
  avatarEmoji:{fontSize:30,lineHeight:36},
  avatarLabel:{marginTop:5,color:theme.textPrimary,fontSize:12,fontWeight:'800'},
  pressed:{opacity:.78,transform:[{scale:.99}]},
  disabled:{opacity:.55}
})}

export default ConnectComposerPicker;