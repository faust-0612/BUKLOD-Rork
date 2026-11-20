import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/providers/AuthProvider';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';
import {
  WORLD_DESTINATIONS, WORLD_MAP_PINS, WORLD_PURPOSES,
  destinationsForPurpose, worldDestinationById, worldPurposeById,
  type WorldDestination,
} from '@/features/world/worldCatalog';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
const iconName = (name: string): IconName => name as IconName;
const PIN_NAMES: Record<string,string> = {
  cluster:'Cluster', faith:'Faith', kingdom:'Kingdom', connect:'Connect',
  wall:'Wall', myworld:'My Land', market:'Market',
};
const DISTRICTS = [
  { id:'social',label:'Usapan at mga tao' },
  { id:'community',label:'Komunidad at pamilya' },
  { id:'growth',label:'Faith at learning' },
  { id:'world',label:'Kingdom at development' },
  { id:'economy',label:'Market at economy' },
  { id:'services',label:'Services at support' },
] as const;

/**
 * A lightweight native map-inspired entrance, not a 3D engine.
 * First paint and route access remain local/offline. A preview is NEVER a live
 * marketplace, house purchase, property registry, or transfer.
 */
export default function BuklodWorldGateway() {
  const { theme } = useBuklodTheme();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const [purposeId, setPurposeId] = useState('explore');
  const [showAll, setShowAll] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const accountId = user?.id ?? null;
  useEffect(() => {
    let current = true;
    setPurposeId('explore');
    if (!accountId) return () => { current = false; };
    void AsyncStorage.getItem('buklod:world:purpose:v1:' + accountId)
      .then(id => { if (current && id && worldPurposeById(id)) setPurposeId(id); })
      .catch(() => undefined);
    return () => { current = false; };
  }, [accountId]);
  const choice = useMemo(() => worldPurposeById(purposeId), [purposeId]);
  const suggested = useMemo(() => destinationsForPurpose(purposeId), [purposeId]);
  const preview = previewId ? worldDestinationById(previewId) : null;
  const compact = width < 390;

  function choosePurpose(id: string) {
    setPurposeId(id);
    setPreviewId(null);
    if (accountId) void AsyncStorage.setItem('buklod:world:purpose:v1:' + accountId,id)
      .catch(() => undefined);
  }
  function openDestination(item: WorldDestination) {
    if (item.state === 'preview' || !item.route) {
      setPreviewId(item.id);
      return;
    }
    setPreviewId(null);
    router.push(item.route as any);
  }

  return (
    <View accessibilityLabel="BUKLOD World Community Gateway" style={{ gap: 9 }}>
      <LinearGradient
        colors={['#091F3B','#18515B','#478052']}
        start={{ x:0,y:0 }} end={{x:1,y:1}}
        style={{ borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor:'#3F7B81' }}>
        <View style={{paddingHorizontal:13,paddingTop:13,paddingBottom:6,flexDirection:'row',alignItems:'center',gap:9}}>
          <MaterialCommunityIcons name="earth" size={23} color="#B5E7AE" />
          <View style={{ flex:1,minWidth:0 }}>
            <Text style={{color:'#FFFFFF',fontSize:20,fontWeight:'900'}}>BUKLOD World</Text>
            <Text style={{color:'#CBE8D9',fontSize:11}}>Tuklasin • Makibahagi • Bumuo • Lumago</Text>
          </View>
          <View style={{backgroundColor:'#123F4B',borderRadius:30,paddingHorizontal:9,paddingVertical:5}}>
            <Text style={{color:'#D3F8D9',fontSize:10,fontWeight:'700'}}>GENERAL COMMUNITY</Text>
          </View>
        </View>
        <View style={{height:compact?246:266,overflow:'hidden',marginHorizontal:7,marginBottom:6,
          backgroundColor:'#2D644D',borderRadius:14,borderColor:'#5F9775',borderWidth:1}}>
          <View pointerEvents="none" style={{position:'absolute',top:-60,left:-18,width:185,height:150,
            borderRadius:95,backgroundColor:'#517F4A',opacity:0.7}} />
          <View pointerEvents="none" style={{position:'absolute',bottom:-50,right:-24,width:185,height:155,
            borderRadius:95,backgroundColor:'#559264',opacity:0.8}} />
          <View pointerEvents="none" style={{position:'absolute',top:66,left:-75,width:'140%',height:16,
            backgroundColor:'#B4AE8A',borderRadius:12,transform:[{rotate:'19deg'}],opacity:0.88}} />
          <View pointerEvents="none" style={{position:'absolute',top:164,left:-38,width:'125%',height:12,
            backgroundColor:'#D2C7A2',borderRadius:12,transform:[{rotate:'-13deg'}],opacity:0.85}} />
          <View pointerEvents="none" style={{position:'absolute',top:0,left:'52%',width:16,height:'116%',
            backgroundColor:'#A9C6B1',borderRadius:11,transform:[{rotate:'20deg'}],opacity:0.76}} />
          <View pointerEvents="none" style={{position:'absolute',top:102,left:'35%',width:62,height:70,
            borderRadius:28,backgroundColor:'#2B8DAB',borderColor:'#82CFE4',borderWidth:3,opacity:0.9}} />
          {WORLD_MAP_PINS.map(pin => {
            const item = worldDestinationById(pin.id);
            if (!item) return null;
            return (
              <Pressable key={pin.id} accessibilityRole="button"
                accessibilityLabel={item.label + (item.state === 'preview' ? ', planned world experience' : '')}
                onPress={() => openDestination(item)}
                style={({pressed}) => ({
                  position:'absolute',left:(pin.x + '%') as any,top:(pin.y + '%') as any,
                  width: compact ? 97 : 109,minHeight:48,borderRadius:12,
                  backgroundColor:pressed?'#FFFFFF':'#EAF5E5',borderWidth:1,borderColor:'#466950',
                  shadowColor:'#000000',shadowOpacity:0.2,shadowRadius:4,elevation:2,
                  flexDirection:'row',alignItems:'center',justifyContent:'center',gap:4,paddingHorizontal:5,
                })}>
                <MaterialCommunityIcons name={iconName(item.icon)} size={compact?18:20}
                  color={item.state==='preview'?'#7A5D37':'#17664A'} />
                <Text numberOfLines={2} style={{color:'#183C35',fontWeight:'900',fontSize:compact?11:12,
                  textAlign:'center',flexShrink:1}}>{PIN_NAMES[item.id] ?? item.label}</Text>
              </Pressable>
            );
          })}
          <View pointerEvents="none" style={{position:'absolute',bottom:8,left:10,
            backgroundColor:'rgba(7,29,38,0.88)',paddingHorizontal:9,paddingVertical:5,borderRadius:10}}>
            <Text style={{color:'#ECFAEC',fontSize:10}}>Shared World • Lahat ay welcome</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={{borderRadius:15,backgroundColor:theme.cardSurface,
        borderWidth:1,borderColor:theme.border,padding:12,gap:9}}>
        <View style={{flexDirection:'row',gap:9,alignItems:'center'}}>
          <View style={{width:44,height:44,alignItems:'center',justifyContent:'center',
            borderRadius:23,backgroundColor:theme.accentSoft}}>
            <MaterialCommunityIcons name="account-heart-outline" size={26} color={theme.accent} />
          </View>
          <View style={{flex:1,gap:2}}>
            <Text style={{color:theme.textPrimary,fontSize:16,fontWeight:'900'}}>Mabuhay! Ano ang kailangan mo?</Text>
            <Text style={{color:theme.textMuted,fontSize:12}}>Pumili ng layunin. Ihahatid kita sa tamang lugar.</Text>
          </View>
        </View>
        <View style={{flexDirection:'row',flexWrap:'wrap',gap:7}}>
          {WORLD_PURPOSES.map(option => {
            const active = option.id === purposeId;
            return (
              <Pressable key={option.id} accessibilityRole="button"
                accessibilityState={{selected:active}}
                onPress={() => choosePurpose(option.id)}
                style={({pressed})=>({
                  flexBasis:'47%',flexGrow:1,minHeight:48,borderRadius:11,borderWidth:1,
                  borderColor:active?theme.accent:theme.border,
                  backgroundColor:pressed||active?theme.accentSoft:theme.surface,
                  flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:9,paddingVertical:7,
                })}>
                <MaterialCommunityIcons name={iconName(option.icon)} size={19} color={theme.accent}/>
                <Text numberOfLines={2} style={{color:theme.textPrimary,fontSize:12,fontWeight:active?'900':'700',flex:1}}>
                  {option.question}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={{color:theme.textMuted,fontSize:12}}>{choice?.subtitle ?? 'Tuklasin ang BUKLOD.'}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{gap:7,paddingVertical:2}}>
          {suggested.map(item=>(
            <Pressable key={item.id} accessibilityRole="button"
              onPress={()=>openDestination(item)}
              style={({pressed})=>({
                width:132,minHeight:91,backgroundColor:pressed?theme.accentSoft:theme.surface,
                borderColor:theme.border,borderWidth:1,borderRadius:12,padding:10,gap:4,
              })}>
              <MaterialCommunityIcons name={iconName(item.icon)} size={22} color={theme.accent}/>
              <Text numberOfLines={2} style={{color:theme.textPrimary,fontWeight:'800',fontSize:12}}>{item.label}</Text>
              <Text style={{color:theme.textMuted,fontSize:10}}>{item.state==='preview'?'Under development':'Buksan'}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {preview ? (
          <View style={{borderWidth:1,borderColor:theme.border,borderRadius:12,padding:11,gap:5,
            backgroundColor:theme.accentSoft}}>
            <Text style={{color:theme.textPrimary,fontWeight:'800'}}>{preview.label} • World blueprint</Text>
            <Text style={{color:theme.textMuted,fontSize:12}}>
              {preview.description} Nasa design at development stage pa ito. Walang BP, QMP o property purchase na isinasagawa.
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close preview"
              onPress={()=>setPreviewId(null)} style={{alignSelf:'flex-end',padding:5}}>
              <Text style={{color:theme.accent,fontWeight:'800'}}>Isara</Text>
            </Pressable>
          </View>
        ) : null}
        <Pressable accessibilityRole="button" accessibilityState={{expanded:showAll}}
          onPress={()=>setShowAll(v=>!v)}
          style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:6}}>
          <Text style={{color:theme.accent,fontSize:13,fontWeight:'900'}}>
            {showAll?'Itago ang buong map directory':'Tingnan ang lahat ng destinations'}
          </Text>
          <MaterialCommunityIcons name={showAll?'chevron-up':'chevron-down'} size={23} color={theme.accent}/>
        </Pressable>
        {showAll ? DISTRICTS.map(district=>(
          <View key={district.id} style={{gap:5}}>
            <Text style={{color:theme.textPrimary,fontSize:12,fontWeight:'900'}}>{district.label}</Text>
            {WORLD_DESTINATIONS.filter(item=>item.district===district.id).map(item=>(
              <Pressable key={item.id} accessibilityRole="button" onPress={()=>openDestination(item)}
                style={{minHeight:43,flexDirection:'row',alignItems:'center',gap:9,
                  borderBottomWidth:1,borderBottomColor:theme.border}}>
                <MaterialCommunityIcons name={iconName(item.icon)} color={theme.accent} size={20}/>
                <Text style={{color:theme.textPrimary,flex:1,fontSize:13}}>{item.label}</Text>
                <Text style={{color:theme.textMuted,fontSize:10}}>
                  {item.state==='preview'?'Preview':'Open'}
                </Text>
                <MaterialCommunityIcons name="chevron-right" color={theme.textMuted} size={18}/>
              </Pressable>
            ))}
          </View>
        )) : null}
      </View>
    </View>
  );
}
