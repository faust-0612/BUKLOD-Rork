/* PATCH_191C_GIF_CATEGORIES_SEARCH_LOADING */
/* PATCH_191D_LIVE_GIPHY_COMPACT_PICKER */
import React,{
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {Image as ExpoImage} from 'expo-image';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useConnectTheme} from '@/providers/ConnectThemeProvider';
import {
  CONNECT_GIF_CATEGORIES,
  searchConnectGifs,
  type ConnectGifCatalogItem,
  type ConnectGifCategory,
  type ConnectGifProvider,
} from '@/lib/buklodConnectGifCatalog';

type PickerTab='emoji'|'gif'|'avatar';
type GifLike=ConnectGifCatalogItem & {
  title?:string;
  name?:string;
  preview_url?:string;
  imageUrl?:string;
  image_url?:string;
  [key:string]:unknown;
};
type AvatarChoice={key:string;label?:string;emoji?:string;[key:string]:unknown};
type Props={
  visible:boolean;
  tab:PickerTab;
  sending?:boolean;
  emojis:readonly string[];
  avatarChoices:readonly AvatarChoice[];
  profileId?:string|null;
  profileName?:string|null;
  gifs:readonly GifLike[];
  onClose:()=>void;
  onTabChange:(tab:PickerTab)=>void;
  onNativeKeyboard:()=>void;
  onSendEmoji:(emoji:string)=>void;
  onSendGif:(gifId:string)=>void;
  onSendAvatar:(key:string)=>void;
};

function gifUri(g:GifLike){
  for(const v of [
    g.previewUri,
    g.preview_url,
    g.url,
    g.imageUrl,
    g.image_url,
  ]){
    if(
      typeof v==='string' &&
      /^(https?:|file:|content:|data:)/i.test(v)
    ) return v;
  }
  return null;
}

function gifLabel(g:GifLike){
  return String(
    g.label??g.title??g.name??'GIF'
  );
}

function GifCard({
  gif,
  disabled,
  onPress,
  onBroken,
}:{
  gif:GifLike;
  disabled:boolean;
  onPress:()=>void;
  onBroken:(id:string)=>void;
}){
  const {theme}=useConnectTheme();
  const s=useMemo(()=>styles(theme),[theme]);
  const [loading,setLoading]=useState(true);
  const uri=gifUri(gif);

  if(!uri){
    return null;
  }

  return <Pressable
    disabled={disabled}
    onPress={onPress}
    style={({pressed})=>[
      s.gifCard,
      pressed&&!disabled?s.pressed:null,
      disabled?s.disabled:null,
    ]}
  >
    <View style={s.gifMedia}>
      <ExpoImage
        source={{uri}}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={80}
        onLoadStart={()=>setLoading(true)}
        onLoad={()=>setLoading(false)}
        onError={()=>{
          setLoading(false);
          onBroken(gif.id);
        }}
      />
      {loading?<View style={s.loading}>
        <ActivityIndicator
          size="small"
          color={theme.accent}
        />
      </View>:null}
      <View style={s.badge}>
        <Text style={s.badgeText}>GIF</Text>
      </View>
    </View>
    <Text numberOfLines={1} style={s.gifLabel}>
      {gifLabel(gif)}
    </Text>
  </Pressable>;
}

export function ConnectComposerPicker(p:Props){
  const {theme}=useConnectTheme();
  const s=useMemo(()=>styles(theme),[theme]);
  const [category,setCategory]=
    useState<ConnectGifCategory>('All');
  const [query,setQuery]=useState('');
  const [gifItems,setGifItems]=
    useState<ConnectGifCatalogItem[]>(
      ()=>Array.from(p.gifs)
    );
  const [gifLoading,setGifLoading]=useState(false);
  const [gifLoadingMore,setGifLoadingMore]=useState(false);
  const [gifProvider,setGifProvider]=
    useState<ConnectGifProvider>('fallback');
  const [gifWarning,setGifWarning]=
    useState<string|null>(null);
  const [gifHasMore,setGifHasMore]=useState(false);
  const [gifNextOffset,setGifNextOffset]=useState(0);
  const [brokenIds,setBrokenIds]=
    useState<Set<string>>(()=>new Set());
  const requestIdRef=useRef(0);

  const loadGifs=useCallback(async({
    append=false,
    offset=0,
  }:{
    append?:boolean;
    offset?:number;
  }={})=>{
    const requestId=++requestIdRef.current;

    if(append){
      setGifLoadingMore(true);
    }else{
      setGifLoading(true);
      setBrokenIds(new Set());
    }

    try{
      const result=await searchConnectGifs({
        query,
        category,
        offset,
        limit:24,
      });

      if(requestId!==requestIdRef.current){
        return;
      }

      setGifProvider(result.provider);
      setGifWarning(result.warning??null);
      setGifHasMore(result.hasMore);
      setGifNextOffset(result.nextOffset);
      setGifItems(current=>{
        if(!append){
          return result.items;
        }

        const merged=[...current];
        const seen=new Set(
          merged.map(item=>item.id)
        );

        for(const item of result.items){
          if(!seen.has(item.id)){
            seen.add(item.id);
            merged.push(item);
          }
        }

        return merged;
      });
    }finally{
      if(requestId===requestIdRef.current){
        setGifLoading(false);
        setGifLoadingMore(false);
      }
    }
  },[category,query]);

  useEffect(()=>{
    if(!p.visible||p.tab!=='gif'){
      return;
    }

    const timer=setTimeout(()=>{
      void loadGifs({append:false,offset:0});
    },query.trim()?300:80);

    return ()=>clearTimeout(timer);
  },[
    category,
    loadGifs,
    p.tab,
    p.visible,
    query,
  ]);

  useEffect(()=>{
    if(!p.visible){
      setQuery('');
      setCategory('All');
      setBrokenIds(new Set());
    }
  },[p.visible]);

  const visibleGifs=useMemo(
    ()=>gifItems.filter(
      item=>!brokenIds.has(item.id)
    ),
    [brokenIds,gifItems]
  );

  const close=()=>{
    requestIdRef.current+=1;
    setQuery('');
    setCategory('All');
    setGifLoading(false);
    setGifLoadingMore(false);
    p.onClose();
  };

  return <Modal
    visible={p.visible}
    transparent
    animationType="slide"
    onRequestClose={close}
  >
    <Pressable style={s.backdrop} onPress={close}>
      <Pressable style={s.sheet} onPress={()=>{}}>
        <View style={s.handle}/>
        <View style={s.header}>
          <Text style={s.title}>Reactions</Text>
          <Pressable
            onPress={close}
            hitSlop={10}
            style={s.close}
          >
            <MaterialCommunityIcons
              name="close"
              size={22}
              color={theme.textPrimary}
            />
          </Pressable>
        </View>

        <View style={s.tabs}>
          {([['emoji','Emoji'],['gif','GIF'],['avatar','Avatar']] as const)
            .map(([k,l])=>
              <Pressable
                key={k}
                onPress={()=>p.onTabChange(k)}
                style={[
                  s.tab,
                  p.tab===k?s.tabActive:null,
                ]}
              >
                <Text style={[
                  s.tabText,
                  p.tab===k?s.tabTextActive:null,
                ]}>
                  {l}
                </Text>
              </Pressable>
            )}
        </View>

        {p.tab==='emoji'?<ScrollView
          style={s.body}
          contentContainerStyle={s.emojiGrid}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            onPress={p.onNativeKeyboard}
            style={s.nativeKeyboard}
          >
            <MaterialCommunityIcons
              name="keyboard-outline"
              size={22}
              color={theme.accent}
            />
            <View style={{flex:1}}>
              <Text style={s.nativeTitle}>
                System keyboard
              </Text>
              <Text style={s.nativeSub}>
                Open your phone emoji keyboard.
              </Text>
            </View>
          </Pressable>
          {p.emojis.map((e,i)=><Pressable
            key={`${e}-${i}`}
            disabled={p.sending}
            onPress={()=>p.onSendEmoji(e)}
            style={s.emojiChoice}
          >
            <Text style={s.emojiText}>{e}</Text>
          </Pressable>)}
        </ScrollView>:null}

        {p.tab==='gif'?<View style={s.gifBody}>
          <View style={s.searchBox}>
            <MaterialCommunityIcons
              name="magnify"
              size={20}
              color={theme.textMuted}
            />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search millions of GIFs"
              placeholderTextColor={theme.textMuted}
              style={s.searchInput}
              returnKeyType="search"
              autoCorrect={false}
            />
            {!!query&&<Pressable
              onPress={()=>setQuery('')}
              hitSlop={8}
            >
              <MaterialCommunityIcons
                name="close-circle"
                size={18}
                color={theme.textMuted}
              />
            </Pressable>}
          </View>

          <ScrollView
            horizontal
            style={s.categoryScroll}
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.categories}
          >
            {CONNECT_GIF_CATEGORIES.map(c=><Pressable
              key={c}
              onPress={()=>setCategory(c)}
              style={[
                s.chip,
                category===c?s.chipActive:null,
              ]}
            >
              <Text style={[
                s.chipText,
                category===c?s.chipTextActive:null,
              ]}>
                {c}
              </Text>
            </Pressable>)}
          </ScrollView>

          {gifLoading?<View style={s.gifLoadingState}>
            <ActivityIndicator
              size="small"
              color={theme.accent}
            />
            <Text style={s.gifLoadingText}>
              Loading GIFs…
            </Text>
          </View>:<ScrollView
            style={s.gifScroll}
            contentContainerStyle={s.gifGrid}
            keyboardShouldPersistTaps="handled"
          >
            {visibleGifs.map(g=><GifCard
              key={g.id}
              gif={g}
              disabled={!!p.sending}
              onPress={()=>p.onSendGif(g.id)}
              onBroken={id=>setBrokenIds(current=>{
                const next=new Set(current);
                next.add(id);
                return next;
              })}
            />)}

            {!visibleGifs.length?<View style={s.empty}>
              <MaterialCommunityIcons
                name="file-gif-box"
                size={42}
                color={theme.textMuted}
              />
              <Text style={s.emptyTitle}>
                No GIF found
              </Text>
              <Text style={s.emptySub}>
                Try another search or category.
              </Text>
              <Pressable
                onPress={()=>void loadGifs({append:false,offset:0})}
                style={s.retry}
              >
                <Text style={s.retryText}>Retry</Text>
              </Pressable>
            </View>:null}

            {gifHasMore&&visibleGifs.length>0?<Pressable
              disabled={gifLoadingMore}
              onPress={()=>void loadGifs({
                append:true,
                offset:gifNextOffset,
              })}
              style={s.more}
            >
              {gifLoadingMore?<ActivityIndicator
                size="small"
                color={theme.accent}
              />:<Text style={s.moreText}>
                Load more GIFs
              </Text>}
            </Pressable>:null}

            {gifProvider==='giphy'?<Text style={s.poweredBy}>
              Powered by GIPHY
            </Text>:null}

            {gifWarning&&gifProvider==='fallback'?<Text
              style={s.providerNote}
            >
              Limited GIFs are available right now.
            </Text>:null}
          </ScrollView>}
        </View>:null}

        {p.tab==='avatar'?<ScrollView
          style={s.body}
          contentContainerStyle={s.avatarGrid}
        >
          <Text style={s.avatarHeading}>
            {p.profileName||'Your avatar'} reactions
          </Text>
          {p.avatarChoices.map(a=><Pressable
            key={a.key}
            disabled={p.sending}
            onPress={()=>p.onSendAvatar(a.key)}
            style={s.avatarChoice}
          >
            <Text style={s.avatarEmoji}>
              {a.emoji||'🙂'}
            </Text>
            <Text
              numberOfLines={1}
              style={s.avatarLabel}
            >
              {a.label||a.key}
            </Text>
          </Pressable>)}
        </ScrollView>:null}
      </Pressable>
    </Pressable>
  </Modal>;
}

function styles(theme:any){
  return StyleSheet.create({
    backdrop:{
      flex:1,
      justifyContent:'flex-end',
      backgroundColor:'rgba(0,0,0,.38)',
    },
    sheet:{
      maxHeight:'82%',
      minHeight:330,
      borderTopLeftRadius:24,
      borderTopRightRadius:24,
      backgroundColor:theme.surface,
      paddingTop:8,
      paddingBottom:14,
      overflow:'hidden',
    },
    handle:{
      width:42,
      height:4,
      alignSelf:'center',
      borderRadius:99,
      backgroundColor:theme.border,
      marginBottom:4,
    },
    header:{
      minHeight:42,
      paddingHorizontal:16,
      flexDirection:'row',
      alignItems:'center',
      justifyContent:'space-between',
    },
    title:{
      color:theme.textPrimary,
      fontSize:18,
      fontWeight:'900',
    },
    close:{
      width:36,
      height:36,
      borderRadius:18,
      alignItems:'center',
      justifyContent:'center',
    },
    tabs:{
      flexDirection:'row',
      paddingHorizontal:12,
      gap:7,
      marginBottom:8,
    },
    tab:{
      flex:1,
      height:38,
      borderRadius:12,
      alignItems:'center',
      justifyContent:'center',
      borderWidth:1,
      borderColor:theme.border,
    },
    tabActive:{
      backgroundColor:theme.accentSoft??'#EAF5EF',
      borderColor:theme.accent,
    },
    tabText:{
      color:theme.textMuted,
      fontSize:12.5,
      fontWeight:'900',
    },
    tabTextActive:{
      color:theme.accent,
    },
    body:{
      flexGrow:0,
      paddingHorizontal:12,
    },
    nativeKeyboard:{
      width:'100%',
      minHeight:54,
      paddingHorizontal:12,
      marginBottom:10,
      borderWidth:1,
      borderColor:theme.border,
      borderRadius:14,
      flexDirection:'row',
      alignItems:'center',
      gap:10,
    },
    nativeTitle:{
      color:theme.textPrimary,
      fontSize:13.5,
      fontWeight:'900',
    },
    nativeSub:{
      marginTop:2,
      color:theme.textMuted,
      fontSize:12,
    },
    emojiGrid:{
      flexDirection:'row',
      flexWrap:'wrap',
      gap:8,
      paddingBottom:18,
    },
    emojiChoice:{
      width:52,
      height:52,
      borderRadius:14,
      alignItems:'center',
      justifyContent:'center',
      backgroundColor:theme.surfaceRaised??'#F5F7F6',
    },
    emojiText:{
      fontSize:26,
      lineHeight:32,
    },
    gifBody:{
      flex:1,
      minHeight:300,
    },
    searchBox:{
      marginHorizontal:12,
      height:42,
      borderWidth:1,
      borderColor:theme.border,
      borderRadius:13,
      paddingHorizontal:10,
      flexDirection:'row',
      alignItems:'center',
      gap:7,
      flexShrink:0,
    },
    searchInput:{
      flex:1,
      color:theme.textPrimary,
      fontSize:13,
      paddingVertical:7,
    },
    categoryScroll:{
      flexGrow:0,
      flexShrink:0,
      height:50,
      maxHeight:50,
    },
    categories:{
      height:50,
      paddingHorizontal:12,
      paddingVertical:8,
      gap:7,
      alignItems:'center',
    },
    chip:{
      height:32,
      minWidth:54,
      paddingHorizontal:12,
      borderRadius:16,
      borderWidth:1,
      borderColor:theme.border,
      alignItems:'center',
      justifyContent:'center',
      flexShrink:0,
    },
    chipActive:{
      borderColor:theme.accent,
      backgroundColor:theme.accentSoft??'#EAF5EF',
    },
    chipText:{
      color:theme.textMuted,
      fontSize:11.5,
      fontWeight:'800',
    },
    chipTextActive:{
      color:theme.accent,
    },
    gifLoadingState:{
      flex:1,
      minHeight:180,
      alignItems:'center',
      justifyContent:'center',
      gap:8,
    },
    gifLoadingText:{
      color:theme.textMuted,
      fontSize:12,
      fontWeight:'700',
    },
    gifScroll:{
      flex:1,
      paddingHorizontal:12,
    },
    gifGrid:{
      flexDirection:'row',
      flexWrap:'wrap',
      gap:8,
      paddingBottom:18,
    },
    gifCard:{
      width:'48.5%',
      height:132,
      borderWidth:1,
      borderColor:theme.border,
      borderRadius:14,
      overflow:'hidden',
      backgroundColor:theme.surface,
    },
    gifMedia:{
      height:104,
      position:'relative',
      backgroundColor:theme.surfaceRaised??'#F0F2F1',
    },
    loading:{
      position:'absolute',
      left:0,
      right:0,
      top:0,
      bottom:0,
      alignItems:'center',
      justifyContent:'center',
      backgroundColor:'rgba(255,255,255,.34)',
    },
    badge:{
      position:'absolute',
      right:6,
      bottom:6,
      minWidth:32,
      height:20,
      paddingHorizontal:5,
      borderRadius:6,
      alignItems:'center',
      justifyContent:'center',
      backgroundColor:'rgba(0,0,0,.66)',
    },
    badgeText:{
      color:'#fff',
      fontSize:10,
      fontWeight:'900',
    },
    gifLabel:{
      height:28,
      paddingHorizontal:8,
      paddingVertical:6,
      color:theme.textPrimary,
      fontSize:11.5,
      fontWeight:'800',
    },
    empty:{
      width:'100%',
      minHeight:190,
      alignItems:'center',
      justifyContent:'center',
      paddingHorizontal:18,
    },
    emptyTitle:{
      marginTop:6,
      color:theme.textPrimary,
      fontSize:15,
      fontWeight:'900',
    },
    emptySub:{
      marginTop:3,
      color:theme.textMuted,
      fontSize:12,
      textAlign:'center',
    },
    retry:{
      marginTop:12,
      minHeight:38,
      paddingHorizontal:18,
      borderRadius:12,
      borderWidth:1,
      borderColor:theme.accent,
      alignItems:'center',
      justifyContent:'center',
    },
    retryText:{
      color:theme.accent,
      fontWeight:'900',
      fontSize:12,
    },
    more:{
      width:'100%',
      height:42,
      marginTop:4,
      borderRadius:13,
      borderWidth:1,
      borderColor:theme.accent,
      alignItems:'center',
      justifyContent:'center',
    },
    moreText:{
      color:theme.accent,
      fontWeight:'900',
      fontSize:12.5,
    },
    poweredBy:{
      width:'100%',
      paddingTop:10,
      paddingBottom:2,
      textAlign:'center',
      color:theme.textMuted,
      fontSize:10.5,
      fontWeight:'800',
      letterSpacing:.2,
    },
    providerNote:{
      width:'100%',
      paddingTop:8,
      textAlign:'center',
      color:theme.textMuted,
      fontSize:10.5,
    },
    avatarHeading:{
      width:'100%',
      marginBottom:10,
      color:theme.textMuted,
      fontSize:12,
      fontWeight:'800',
    },
    avatarGrid:{
      flexDirection:'row',
      flexWrap:'wrap',
      gap:9,
      paddingBottom:18,
    },
    avatarChoice:{
      width:'47%',
      minHeight:98,
      borderRadius:16,
      borderWidth:1,
      borderColor:theme.border,
      alignItems:'center',
      justifyContent:'center',
      padding:8,
    },
    avatarEmoji:{
      fontSize:30,
      lineHeight:36,
    },
    avatarLabel:{
      marginTop:5,
      color:theme.textPrimary,
      fontSize:12,
      fontWeight:'800',
    },
    pressed:{
      opacity:.78,
      transform:[{scale:.99}],
    },
    disabled:{
      opacity:.55,
    },
  });
}

export default ConnectComposerPicker;
