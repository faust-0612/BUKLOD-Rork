import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/providers/AuthProvider';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';
import {
  MARKET_CATEGORIES, marketChangeStock, marketCreateListing, marketCreateStore,
  marketDiscover, marketGetListing, marketImageUrl, marketMyListings, marketMyStores,
  marketPrice, marketPublishListing, marketShareToWall, marketUnpublishListing,
  marketUploadPhoto, validMarketListing, validMarketStore,
  type MarketListing, type MarketStore,
} from '@/lib/buklodMarket';

type Panel = 'browse' | 'seller' | 'register' | 'new-listing' | 'detail';
type ShopDraft = { name: string; city: string; province: string; barangay: string; description: string; seller_type: 'individual' | 'business' };
type ListingDraft = { title: string; description: string; price: string; unit: string; kind: 'product' | 'service'; category: string };
const blankShop: ShopDraft = { name: '',city:'',province:'',barangay:'',description:'',seller_type:'individual' };
const blankListing: ListingDraft = { title:'',description:'',price:'',unit:'item',kind:'product',category:'other' };

function MarketButton({ label, onPress, secondary, disabled }: {label:string;onPress:()=>void;secondary?:boolean;disabled?:boolean}) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
    style={[styles.button,secondary && styles.secondaryButton,disabled && {opacity:.5}]}>
    <Text style={[styles.buttonText,secondary && styles.secondaryButtonText]}>{label}</Text>
  </Pressable>;
}
function MarketField({ label, value, onChangeText, multiline, keyboardType, placeholder }: {
  label:string;value:string;onChangeText:(v:string)=>void;multiline?:boolean;
  keyboardType?:'decimal-pad'|'default';placeholder?:string;
}) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text>
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText}
      placeholder={placeholder || label} placeholderTextColor="#78838e" multiline={multiline}
      keyboardType={keyboardType || 'default'} style={[styles.input,multiline && {minHeight:70,textAlignVertical:'top'}]}/></View>;
}
function MarketProduct({ item, onPress }: { item:MarketListing;onPress:()=>void }) {
  const {theme}=useBuklodTheme();
  const uri=marketImageUrl(item.image_path);
  return <Pressable onPress={onPress} style={[styles.productCard,{backgroundColor:theme.surface,borderColor:theme.border}]}
    accessibilityRole="button" accessibilityLabel={'View ' + item.title}>
      {uri ? <Image source={{uri}} resizeMode="cover" style={styles.productPhoto}/> :
        <View style={[styles.productPhoto,styles.emptyPhoto]}><MaterialCommunityIcons name="storefront-outline" size={36} color="#367a4c"/></View>}
      <View style={styles.productBody}>
        <Text numberOfLines={2} style={[styles.productTitle,{color:theme.textPrimary}]}>{item.title}</Text>
        <Text style={styles.price}>{marketPrice(item.price_php,item.unit)}</Text>
        <Text numberOfLines={1} style={[styles.mini,{color:theme.textMuted}]}>{item.store?.name || 'BUKLOD Seller'}</Text>
        <Text numberOfLines={1} style={[styles.mini,{color:theme.textMuted}]}>{item.store?.city || ''}</Text>
        {item.stock_status==='sold_out' ? <Text style={styles.unavailable}>Sold out</Text> : null}
      </View>
    </Pressable>;
}
export default function BuklodMarketScreen() {
  const {user}=useAuth();
  const {theme}=useBuklodTheme();
  const params=useLocalSearchParams<{listing_id?:string|string[]}>();
  const linkId=Array.isArray(params.listing_id) ? params.listing_id[0] : params.listing_id;
  const [panel,setPanel]=useState<Panel>('browse');
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(false);
  const [notice,setNotice]=useState('');
  const [queryText,setQueryText]=useState('');
  const [keyword,setKeyword]=useState('');
  const [cityText,setCityText]=useState('');
  const [city,setCity]=useState('');
  const [category,setCategory]=useState('all');
  const [listings,setListings]=useState<MarketListing[]>([]);
  const [hasMore,setHasMore]=useState(true);
  const [stores,setStores]=useState<MarketStore[]>([]);
  const [myListings,setMyListings]=useState<MarketListing[]>([]);
  const [chosenStore,setChosenStore]=useState<string|null>(null);
  const [shopDraft,setShopDraft]=useState<ShopDraft>(blankShop);
  const [listingDraft,setListingDraft]=useState<ListingDraft>(blankListing);
  const [photoUri,setPhotoUri]=useState<string|null>(null);
  const [selected,setSelected]=useState<MarketListing|null>(null);
  const generation=useRef(0);
  const moreBusy=useRef(false);
  const submitBusy=useRef(false);
  const applyShop=(key:keyof ShopDraft,value:string)=>setShopDraft(s=>({...s,[key]:value}));
  const applyListing=(key:keyof ListingDraft,value:string)=>setListingDraft(s=>({...s,[key]:value}));

  const loadFeed=useCallback(async (append=false) => {
    if (append && (moreBusy.current || !hasMore)) return;
    if (append) moreBusy.current=true;
    const seq=append ? generation.current : ++generation.current;
    if (!append) {setLoading(true);setNotice('');setHasMore(true);}
    try {
      const before=append && listings.length ? listings[listings.length-1].created_at : undefined;
      const rows=await marketDiscover({category,keyword,city,before});
      if (generation.current !== seq) return;
      setListings(old=>append ? [...old,...rows.filter(x=>!old.some(y=>y.id===x.id))] : rows);
      setHasMore(rows.length===24);
    } catch(e:any) {
      if (generation.current===seq) setNotice(
        String(e?.message || 'Hindi ma-load ang Market. Subukan muli.'));
    } finally {
      if (generation.current===seq) setLoading(false);
      moreBusy.current=false;
    }
  },[category,keyword,city,hasMore,listings]);
  // Key by applied filters only; changing the search draft must not hit the API.
  useEffect(()=>{void loadFeed(false);},[category,keyword,city]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{
    if (!linkId) return;
    let mounted=true;
    void marketGetListing(linkId).then(item=>{
      if(mounted){setSelected(item);setPanel('detail');if(!item)setNotice('Hindi na available ang listing.');}
    }).catch((e:any)=>{if(mounted)setNotice(String(e.message));});
    return ()=>{mounted=false;};
  },[linkId]);
  const loadMine=useCallback(async()=>{
    if(!user?.id)return;
    setLoading(true);
    try {
      const [nextStores,nextListings]=await Promise.all([marketMyStores(user.id),marketMyListings(user.id)]);
      setStores(nextStores);setMyListings(nextListings);
      setChosenStore(prev=>nextStores.some(x=>x.id===prev)?prev:(nextStores[0]?.id||null));
      setNotice('');
    }catch(e:any){setNotice(String(e.message||e));}
    finally{setLoading(false);}
  },[user?.id]);
  const openSeller=()=>{
    setPanel('seller');setNotice('');void loadMine();
  };
  const openDetail=(item:MarketListing)=>{setSelected(item);setNotice('');setPanel('detail');};
  const guard=async(work:()=>Promise<void>)=>{
    if(submitBusy.current)return;
    submitBusy.current=true;setBusy(true);setNotice('');
    try{await work();}catch(e:any){setNotice(String(e?.message||e));}
    finally{setBusy(false);submitBusy.current=false;}
  };
  const saveShop=()=>void guard(async()=>{
    if(!user?.id)throw new Error('Mag-sign in muna.');
    const issue=validMarketStore(shopDraft);if(issue)throw new Error(issue);
    const store=await marketCreateStore(user.id,shopDraft);
    setShopDraft(blankShop);setChosenStore(store.id);setPanel('seller');
    await loadMine();setNotice('Bukas na ang tindahan! Magdagdag ng paninda.');
  });
  const choosePhoto=async()=>{
    try {
      const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:true,quality:.8});
      if(!result.canceled && result.assets?.[0]?.uri)setPhotoUri(result.assets[0].uri);
    }catch(e:any){setNotice(String(e.message||e));}
  };
  const saveListing=()=>void guard(async()=>{
    if(!user?.id||!chosenStore)throw new Error('Pumili muna ng tindahan.');
    const price=Number(listingDraft.price);
    const issue=validMarketListing({title:listingDraft.title,price_php:price,unit:listingDraft.unit});
    if(issue || !listingDraft.price.trim())throw new Error(issue||'Ilagay ang presyo.');
    const draft=await marketCreateListing(user.id,chosenStore,{
      title:listingDraft.title,description:listingDraft.description,kind:listingDraft.kind,
      category:listingDraft.kind==='service'?'service':listingDraft.category,
      price_php:price,unit:listingDraft.unit
    });
    // Draft remains recoverable if upload/network fails. Never publish broken media.
    const imagePath=photoUri ? await marketUploadPhoto(user.id,draft.id,photoUri) : null;
    await marketPublishListing(draft.id,user.id,imagePath);
    setListingDraft(blankListing);setPhotoUri(null);setPanel('seller');
    await loadMine();setNotice('Nai-publish na ang paninda.');
  });
  const changeStatus=(item:MarketListing,action:'sold_out'|'available'|'unpublish'|'publish'|'wall')=>
    void guard(async()=>{
      if(action==='wall') {
        await marketShareToWall(item.id);setNotice('Na-share sa Public Wall.');
      } else if(action==='unpublish'){
        await marketUnpublishListing(item);await loadMine();setNotice('Naka-draft na ang listing.');
      } else if(action==='publish'){
        await marketPublishListing(item.id,item.owner_id,item.image_path);await loadMine();
      } else {
        await marketChangeStock(item,action);await loadMine();
      }
    });
  const detail=selected;
  const seller=stores.find(s=>s.id===chosenStore);
  const header=<View style={[styles.header,{backgroundColor:theme.surface,borderColor:theme.border}]}>
    <View style={styles.headerTitle}><MaterialCommunityIcons name="storefront" size={25} color="#268c4a"/>
      <View><Text style={[styles.heading,{color:theme.textPrimary}]}>BUKLOD Market</Text>
        <Text style={[styles.mini,{color:theme.textMuted}]}>Ang Palengke ng Komunidad</Text></View></View>
    <View style={styles.navRow}>
      <MarketButton label="Mamili" secondary={panel!=='browse'} onPress={()=>{setPanel('browse');setNotice('');void loadFeed(false);}}/>
      <MarketButton label="Aking Tindahan" secondary={panel!=='seller'} onPress={openSeller}/>
    </View>
  </View>;
  const unavailable=<Text style={[styles.mini,{color:theme.textMuted}]}>Walang makitang produkto. Subukan ang ibang kategorya o lokasyon.</Text>;
  return <View style={[styles.screen,{backgroundColor:theme.surfaceMuted}]}>
    <Stack.Screen options={{title:'BUKLOD Market'}}/>
    {header}
    {notice ? <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text> : null}
    {panel==='browse' ? <FlatList
      keyboardShouldPersistTaps="handled"
      data={listings} keyExtractor={x=>x.id} numColumns={2}
      columnWrapperStyle={styles.columns} contentContainerStyle={styles.content}
      ListHeaderComponent={<View style={styles.browserHeader}>
        <View style={styles.searchRow}>
          <TextInput accessibilityLabel="Search market products" placeholder="Hanapin ang produkto o serbisyo" placeholderTextColor="#78838e"
            value={queryText} onChangeText={setQueryText} onSubmitEditing={()=>setKeyword(queryText)} style={[styles.input,{flex:1}]}/>
          <MarketButton label="Hanapin" onPress={()=>setKeyword(queryText)}/>
        </View>
        <View style={styles.searchRow}>
          <TextInput accessibilityLabel="Filter city" placeholder="City / Municipality (optional)" placeholderTextColor="#78838e"
            value={cityText} onChangeText={setCityText} onSubmitEditing={()=>setCity(cityText)} style={[styles.input,{flex:1}]}/>
          <MarketButton label="Lugar" secondary onPress={()=>setCity(cityText)}/>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.categoryRow}>{MARKET_CATEGORIES.map(item=><Pressable key={item.value}
            onPress={()=>setCategory(item.value)} style={[styles.categoryPill,category===item.value && styles.categoryActive]}>
            <Text style={{color:category===item.value?'#fff':theme.textPrimary,fontWeight:'700',fontSize:12}}>{item.label}</Text>
          </Pressable>)}</View>
        </ScrollView>
        <Text style={[styles.sectionTitle,{color:theme.textPrimary}]}>Mga bagong paninda</Text>
      </View>}
      renderItem={({item})=><MarketProduct item={item} onPress={()=>openDetail(item)}/>}
      ListEmptyComponent={loading?<ActivityIndicator color="#268c4a"/>:unavailable}
      ListFooterComponent={hasMore&&listings.length>0?<MarketButton label={loading?'Loading...':'Tingnan pa'} secondary disabled={loading}
        onPress={()=>void loadFeed(true)}/>:null}
    /> : null}
    {panel==='seller' ? <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={[styles.sectionTitle,{color:theme.textPrimary}]}>Aking Tindahan</Text>
      <MarketButton label="+ Magrehistro ng tindahan" onPress={()=>{setNotice('');setPanel('register');}}/>
      {stores.map(s=><Pressable key={s.id} style={[styles.storeRow,{borderColor:theme.border,backgroundColor:theme.surface}]}
        onPress={()=>setChosenStore(s.id)}>
        <Text style={[styles.productTitle,{color:theme.textPrimary}]}>{chosenStore===s.id?'✓ ':''}{s.name}</Text>
        <Text style={[styles.mini,{color:theme.textMuted}]}>{s.city} · {s.verification_state==='verified'?'Verified':'Basic seller'}</Text>
      </Pressable>)}
      {seller ? <MarketButton label="+ Magdagdag ng produkto / serbisyo" onPress={()=>{setNotice('');setPanel('new-listing');}}/>:null}
      <Text style={[styles.sectionTitle,{color:theme.textPrimary}]}>Mga paninda ko</Text>
      {myListings.filter(x=>x.store_id===chosenStore).map(item=><View key={item.id}
        style={[styles.manageCard,{backgroundColor:theme.surface,borderColor:theme.border}]}>
          <Text style={[styles.productTitle,{color:theme.textPrimary}]}>{item.title}</Text>
          <Text style={[styles.mini,{color:theme.textMuted}]}>{marketPrice(item.price_php,item.unit)} · {item.publication_state} · {item.stock_status}</Text>
          <View style={styles.wrap}>
            {item.publication_state==='published' ? <>
              <MarketButton label="Public Wall" disabled={busy} onPress={()=>changeStatus(item,'wall')}/>
              <MarketButton label={item.stock_status==='available'?'Sold out':'Available'} secondary disabled={busy}
                onPress={()=>changeStatus(item,item.stock_status==='available'?'sold_out':'available')}/>
              <MarketButton label="Unpublish" secondary disabled={busy} onPress={()=>changeStatus(item,'unpublish')}/>
            </> : <MarketButton label="Publish draft" disabled={busy} onPress={()=>changeStatus(item,'publish')}/>}
          </View>
        </View>)}
      {!myListings.length ? unavailable : null}
    </ScrollView> : null}
    {panel==='register' ? <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={[styles.sectionTitle,{color:theme.textPrimary}]}>Buksan ang Tindahan — 3 Hakbang</Text>
      <Text style={[styles.mini,{color:theme.textMuted}]}>Walang bagong login. Basic seller muna; hindi ito verified business badge.</Text>
      <View style={styles.wrap}>
        <MarketButton label="Personal" secondary={shopDraft.seller_type!=='individual'} onPress={()=>applyShop('seller_type','individual')}/>
        <MarketButton label="Business" secondary={shopDraft.seller_type!=='business'} onPress={()=>applyShop('seller_type','business')}/>
      </View>
      <MarketField label="1. Pangalan ng tindahan" value={shopDraft.name} onChangeText={v=>applyShop('name',v)}/>
      <MarketField label="2. City / Municipality" value={shopDraft.city} onChangeText={v=>applyShop('city',v)}/>
      <MarketField label="Barangay (optional)" value={shopDraft.barangay} onChangeText={v=>applyShop('barangay',v)}/>
      <MarketField label="Province (optional)" value={shopDraft.province} onChangeText={v=>applyShop('province',v)}/>
      <MarketField label="Tungkol sa tindahan (optional)" value={shopDraft.description} onChangeText={v=>applyShop('description',v)} multiline/>
      <MarketButton label={busy?'Sine-save...':'3. Buksan ang Tindahan'} disabled={busy} onPress={saveShop}/>
      <MarketButton label="Bumalik" secondary onPress={openSeller}/>
    </ScrollView> : null}
    {panel==='new-listing' ? <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={[styles.sectionTitle,{color:theme.textPrimary}]}>Bagong Paninda</Text>
      <View style={styles.wrap}>
        <MarketButton label="Produkto" secondary={listingDraft.kind!=='product'} onPress={()=>applyListing('kind','product')}/>
        <MarketButton label="Serbisyo" secondary={listingDraft.kind!=='service'} onPress={()=>applyListing('kind','service')}/>
      </View>
      <MarketField label="Pangalan" value={listingDraft.title} onChangeText={v=>applyListing('title',v)}/>
      <MarketField label="Description" value={listingDraft.description} onChangeText={v=>applyListing('description',v)} multiline/>
      {listingDraft.kind==='product'?<ScrollView horizontal><View style={styles.categoryRow}>{MARKET_CATEGORIES.filter(x=>x.value!=='all').map(item=>
        <Pressable key={item.value} style={[styles.categoryPill,listingDraft.category===item.value&&styles.categoryActive]} onPress={()=>applyListing('category',item.value)}>
          <Text style={{fontSize:12,color:listingDraft.category===item.value?'#fff':theme.textPrimary}}>{item.label}</Text>
        </Pressable>)}</View></ScrollView>:null}
      <MarketField label="Presyo (PHP)" value={listingDraft.price} keyboardType="decimal-pad" onChangeText={v=>applyListing('price',v)}/>
      <MarketField label="Unit: kilo / piraso / serbisyo" value={listingDraft.unit} onChangeText={v=>applyListing('unit',v)}/>
      {photoUri?<Image source={{uri:photoUri}} style={styles.previewPhoto}/>:null}
      <MarketButton label={photoUri?'Palitan ang larawan':'Magdagdag ng larawan (optional)'} secondary onPress={()=>void choosePhoto()}/>
      <Text style={[styles.mini,{color:theme.textMuted}]}>Bawal ang illegal, restricted, scam o misleading listings. Huwag mag-upload ng ID o personal document.</Text>
      <MarketButton label={busy?'Pinoproseso...':'I-publish ang Paninda'} disabled={busy} onPress={saveListing}/>
      <MarketButton label="Bumalik" secondary onPress={openSeller}/>
    </ScrollView> : null}
    {panel==='detail' ? <ScrollView contentContainerStyle={styles.content}>
      {detail ? <>
        {marketImageUrl(detail.image_path)?<Image source={{uri:marketImageUrl(detail.image_path)!}} resizeMode="cover" style={styles.detailPhoto}/>:null}
        <Text style={[styles.sectionTitle,{color:theme.textPrimary}]}>{detail.title}</Text>
        <Text style={styles.detailPrice}>{marketPrice(detail.price_php,detail.unit)}</Text>
        <Text style={[styles.mini,{color:theme.textMuted}]}>{detail.store?.name} · {detail.store?.city}</Text>
        <Text style={styles.description}>{detail.description||'Walang karagdagang description.'}</Text>
        <Text style={[styles.unavailable,{color:detail.stock_status==='available'?'#1c7540':'#b23a34'}]}>
          {detail.stock_status==='available'?'Available':'Sold out'}
        </Text>
        {detail.owner_id!==user?.id && detail.stock_status==='available'?<MarketButton label="Magtanong sa Seller (Connect)"
          onPress={()=>router.push({pathname:'/connect/personal/[threadId]',params:{
            threadId:'new',targetUserId:detail.owner_id,otherUserName:detail.store?.name||'Seller'
          }} as any)}/>:null}
        <Text style={[styles.mini,{color:theme.textMuted}]}>Direktang usapan at arrangement muna. Walang in-app payment o guaranteed delivery sa kasalukuyang Market.</Text>
      </> : <Text style={styles.unavailable}>Hindi na available ang listing.</Text>}
      <MarketButton label="Bumalik sa Palengke" secondary onPress={()=>{setPanel('browse');setSelected(null);}}/>
    </ScrollView> : null}
  </View>;
}
const styles=StyleSheet.create({
  screen:{flex:1},header:{paddingHorizontal:12,paddingTop:8,paddingBottom:8,borderBottomWidth:1,gap:8},
  headerTitle:{flexDirection:'row',alignItems:'center',gap:9},heading:{fontSize:21,fontWeight:'900'},
  navRow:{flexDirection:'row',gap:8},button:{paddingVertical:10,paddingHorizontal:13,backgroundColor:'#176B2C',
    borderRadius:10,alignItems:'center',justifyContent:'center',minHeight:40},
  buttonText:{fontWeight:'800',color:'#fff',fontSize:12},
  secondaryButton:{backgroundColor:'#e5f2e9'},secondaryButtonText:{color:'#155a29'},
  content:{padding:10,gap:10,paddingBottom:28},browserHeader:{gap:10,marginBottom:10},
  searchRow:{flexDirection:'row',gap:6,alignItems:'center'},input:{backgroundColor:'#fff',borderWidth:1,borderColor:'#cbd6d0',
    borderRadius:9,paddingHorizontal:11,paddingVertical:9,color:'#16202A',minHeight:42,flexShrink:1},
  categoryRow:{flexDirection:'row',gap:7},categoryPill:{paddingVertical:8,paddingHorizontal:10,
    backgroundColor:'#e5f2e9',borderRadius:20},categoryActive:{backgroundColor:'#176B2C'},
  sectionTitle:{fontSize:17,fontWeight:'900'},columns:{gap:10},productCard:{flex:1,maxWidth:'49%',
    borderRadius:12,overflow:'hidden',borderWidth:1,marginBottom:10},
  productPhoto:{height:135,width:'100%'},emptyPhoto:{backgroundColor:'#dfeee8',alignItems:'center',justifyContent:'center'},
  productBody:{padding:9,gap:3},productTitle:{fontSize:14,fontWeight:'800'},price:{fontSize:16,fontWeight:'900',color:'#157238'},
  mini:{fontSize:12},unavailable:{fontSize:12,fontWeight:'700'},storeRow:{borderWidth:1,borderRadius:10,padding:12,gap:3},
  manageCard:{padding:11,borderWidth:1,borderRadius:10,gap:7},wrap:{flexDirection:'row',gap:7,flexWrap:'wrap'},
  field:{gap:4},label:{fontSize:12,fontWeight:'800',color:'#486153'},
  previewPhoto:{height:140,width:140,borderRadius:10},detailPhoto:{height:250,width:'100%',borderRadius:12},
  detailPrice:{fontSize:23,fontWeight:'900',color:'#176B2C'},
  description:{color:'#354b40',fontSize:14,lineHeight:21},notice:{backgroundColor:'#fff4d8',color:'#5c4505',padding:10,fontSize:12},
});
