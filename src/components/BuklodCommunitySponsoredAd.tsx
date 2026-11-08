import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {AppState, Dimensions, Image, Linking, Pressable, StyleSheet, Text, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {VideoView, useVideoPlayer} from 'expo-video';
import {useFocusEffect} from 'expo-router';
import {requestBuklodAudioFocus} from '@/lib/buklodAudioFocus';
import {supabase} from '@/lib/supabase';
import {useAuth} from '@/providers/AuthProvider';
import {useBuklodScope} from '@/providers/BuklodScopeProvider';
import {
  paidSponsorshipCanDisplay,
  type PaidSponsorshipCampaign as Campaign,
  type PaidSponsorshipCoverage,
} from '@/lib/advertise/paidSponsorshipDelivery';

type SponsorLocation = 'community' | 'home';
const REFRESH_MS = 60_000;
const ROTATE_MS = 12_000;

// Only the eligible in-view ad plays. Off-screen, app background and
// navigation changes pause immediately; no hidden video streams.
function AdVideo({uri, visible}: {uri: string; visible: boolean}) {
  const player = useVideoPlayer(uri, p => {p.loop = true; p.muted = false;});
  useEffect(() => {
    if (!visible) { try {player.pause();} catch {} return; }
    requestBuklodAudioFocus('sponsor-ad');
    try {player.muted = false; player.play();} catch {
      // Audible browser autoplay may require a user gesture.
    }
    return () => {try {player.pause();} catch {}};
  }, [player, visible]);
  return <View>
    <VideoView player={player} style={s.media} contentFit="contain" nativeControls/>
    <Pressable accessibilityRole="button" accessibilityLabel="Play sponsored video with sound"
      onPress={() => {requestBuklodAudioFocus('sponsor-ad'); player.muted=false; player.play();}}
      style={s.soundAction}>
      <MaterialCommunityIcons name="volume-high" size={16} color="#fff"/>
      <Text style={{color:'#fff',fontSize:11,fontWeight:'800'}}>Play with sound</Text>
    </Pressable>
  </View>;
}

export default function BuklodCommunitySponsoredAd({
  audience,
  placement = 'community',
}: {
  audience: 'public' | 'scope';
  placement?: SponsorLocation;
}) {
  const {profile} = useAuth();
  const {activeScope} = useBuklodScope();
  const shellRef = useRef<View>(null);
  const [rows, setRows] = useState<Campaign[]>([]);
  const [index, setIndex] = useState(0);
  const [atMs, setAtMs] = useState(() => Date.now());
  const [videoVisible, setVideoVisible] = useState(false);
  const [screenFocused, setScreenFocused] = useState(false);
  useFocusEffect(useCallback(() => {
    setScreenFocused(true);
    return () => {setScreenFocused(false); setVideoVisible(false);};
  }, []));

  const scopeCoverage = useMemo<PaidSponsorshipCoverage | null>(() => {
    if (audience === 'public') return null;
    if (activeScope?.scope_type !== 'LOCAL') return null;
    const level = String((activeScope as any)?.geo_level ?? '').toUpperCase();
    return level === 'BARANGAY' ? 'barangay'
      : level === 'MUNICIPALITY_CITY' ? 'city'
      : level === 'PROVINCE' ? 'province'
      : level === 'COUNTRY' ? 'nationwide' : null;
  }, [audience, activeScope]);

  // Do not create a permanent Community post. The slot automatically reads
  // only currently approved/paid/unexpired campaigns, so Pause/expiry removes
  // them, and new approvals appear without needing a new app release.
  useFocusEffect(useCallback(() => {
    let active = true;
    const refresh = async () => {
      if (audience === 'scope' && !scopeCoverage) {
        if (active) setRows([]);
        return;
      }
      const at = Date.now();
      let query = supabase.from('buklod_paid_ad_campaigns')
        .select('id,advertiser_name,headline,short_text,image_url,video_url,destination_url,creative_type,coverage_level,barangay,city_municipality,province,placement,priority,status,payment_status,policy_confirmed,starts_at,ends_at')
        .in('placement', ['all', 'community'])
        .eq('status', 'approved')
        .in('payment_status', ['paid', 'waived'])
        .eq('policy_confirmed', true)
        .lte('starts_at', new Date(at).toISOString())
        .gt('ends_at', new Date(at).toISOString())
        .order('priority', {ascending: false})
        .limit(50);
      // Public Wall accepts ALL coverage levels but shows a local campaign
      // only to matching users. Preserve the existing exact LOCAL scope rule.
      if (audience === 'scope' && scopeCoverage) {
        query = query.eq('coverage_level', scopeCoverage);
      }
      const {data, error} = await query;
      if (!active) return;
      setAtMs(Date.now());
      if (error) {
        console.warn('BUKLOD active sponsorship read failed:', error.message);
        setRows([]); // Fail closed; do not keep paused ads on network errors.
        return;
      }
      setRows(((data ?? []) as unknown as Campaign[]).filter(c =>
        paidSponsorshipCanDisplay(
          c, (profile ?? null) as Record<string, unknown> | null, Date.now(),
          scopeCoverage, audience === 'scope',
        ),
      ));
    };
    void refresh();
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void refresh();
    }, REFRESH_MS);
    const foreground = AppState.addEventListener('change', state => {
      if (state === 'active') void refresh();
    });
    return () => {
      active = false;
      clearInterval(timer);
      foreground.remove();
    };
  }, [audience, profile, scopeCoverage]));

  useEffect(() => {
    if (!rows.length) return;
    const timer = setInterval(() => {
      setAtMs(Date.now()); // Expire a campaign even while the view stays open.
      if (rows.length > 1) setIndex(current => current + 1);
    }, ROTATE_MS);
    return () => clearInterval(timer);
  }, [rows.length]);

  const eligible = useMemo(() => rows.filter(c =>
    paidSponsorshipCanDisplay(
      c, (profile ?? null) as Record<string, unknown> | null, atMs,
      scopeCoverage, audience === 'scope',
    ),
  ), [rows, profile, atMs, scopeCoverage, audience]);

  const campaign = eligible.length ? eligible[index % eligible.length] : null;
  // Feed headers stay mounted while scrolling: measure actual intersection.
  useEffect(() => {
    if (!screenFocused || campaign?.creative_type !== 'video') {
      setVideoVisible(false);
      return;
    }
    let alive = true;
    const check = () => {
      if (AppState.currentState !== 'active') {setVideoVisible(false); return;}
      shellRef.current?.measureInWindow((x,y,w,h) => {
        if (!alive) return;
        const screen=Dimensions.get('window');
        const clipped=Math.max(0,Math.min(y+h,screen.height)-Math.max(y,0));
        const onScreen=w>40&&h>40&&x<screen.width&&x+w>0&&clipped>=Math.min(h*0.5,180);
        setVideoVisible(previous => previous===onScreen ? previous : onScreen);
      });
    };
    const warmup=setTimeout(check,350);
    const watch=setInterval(check,900);
    return () => {alive=false; clearTimeout(warmup); clearInterval(watch);};
  }, [screenFocused,campaign?.id,campaign?.creative_type]);

  // Count an impression only after the active card is physically visible.
  // No impression is recorded for an unmounted or off-screen card.
  useEffect(() => {
    if (!campaign?.id) return;
    let alive = true;
    const timer = setTimeout(() => {
      shellRef.current?.measureInWindow((x, y, w, h) => {
        if (!alive || AppState.currentState !== 'active') return;
        const screen = Dimensions.get('window');
        if (w < 40 || h < 40 || y >= screen.height - 8 || y + h <= 8
            || x >= screen.width || x + w <= 0) return;
        void supabase.from('buklod_paid_ad_events').insert({
          campaign_id: campaign.id,
          event_type: 'impression',
          placement,
        });
      });
    }, 450);
    return () => {alive = false; clearTimeout(timer);};
  }, [campaign?.id, placement]);

  if (!campaign) return null;
  const safeUrl = /^https?:\/\//i.test(campaign.destination_url?.trim() ?? '')
    ? campaign.destination_url!.trim() : null;
  async function open() {
    if (!campaign || !safeUrl) return;
    try {
      await Linking.openURL(safeUrl);
      void supabase.from('buklod_paid_ad_events').insert({
        campaign_id: campaign.id, event_type: 'click', placement,
      });
    } catch (error) {
      console.warn('BUKLOD sponsored link unavailable:', error);
    }
  }

  return <View ref={shellRef} collapsable={false} style={s.shell} testID={`paid-sponsorship-${placement}`}>
    <View style={s.top}>
      <View style={s.badge}>
        <MaterialCommunityIcons name="bullhorn-outline" size={13} color="#25573F"/>
        <Text style={s.badgeText}>PAID SPONSORSHIP</Text>
      </View>
      <Text style={s.scope}>{campaign.coverage_level === 'nationwide' ? 'Public'
        : campaign.coverage_level === 'city' ? 'Town / City' : campaign.coverage_level}</Text>
    </View>
    {campaign.creative_type === 'video' && campaign.video_url
      ? <AdVideo key={campaign.id} uri={campaign.video_url} visible={screenFocused&&videoVisible}/>
      : campaign.image_url
        ? <Image source={{uri: campaign.image_url}} style={s.media} resizeMode="contain"/>
        : null}
    <View style={s.copy}>
      <Text style={s.advertiser}>{campaign.advertiser_name}</Text>
      <Text style={s.headline}>{campaign.headline}</Text>
      {!!campaign.short_text && <Text style={s.body}>{campaign.short_text}</Text>}
      <Text style={s.period}>Sponsored until {new Date(campaign.ends_at).toLocaleDateString()}</Text>
      {safeUrl && <Pressable accessibilityRole="link" onPress={() => void open()} style={s.cta}>
        <Text style={s.ctaText}>Learn more</Text>
        <MaterialCommunityIcons name="arrow-right" size={16} color="#fff"/>
      </Pressable>}
    </View>
  </View>;
}
const s=StyleSheet.create({soundAction:{position:'absolute',right:9,bottom:9,backgroundColor:'rgba(0,0,0,.65)',paddingHorizontal:10,paddingVertical:7,borderRadius:12,flexDirection:'row',alignItems:'center',gap:5},shell:{marginHorizontal:12,marginVertical:10,borderRadius:18,overflow:'hidden',backgroundColor:'#fff',borderWidth:1,borderColor:'#DCE7E0'},top:{minHeight:38,paddingHorizontal:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},badge:{flexDirection:'row',alignItems:'center',gap:5},badgeText:{fontSize:9,fontWeight:'900',letterSpacing:.8,color:'#25573F'},scope:{fontSize:10,fontWeight:'700',color:'#7A877F'},media:{width:'100%',height:220,backgroundColor:'#E7ECE9'},copy:{padding:14},advertiser:{fontSize:11,fontWeight:'800',color:'#557064'},headline:{marginTop:3,fontSize:18,lineHeight:23,fontWeight:'900',color:'#173C2C'},body:{marginTop:6,fontSize:12,lineHeight:18,color:'#617168'},period:{marginTop:7,fontSize:10,color:'#657C6C'},cta:{alignSelf:'flex-start',marginTop:12,minHeight:38,paddingHorizontal:14,borderRadius:12,flexDirection:'row',alignItems:'center',gap:7,backgroundColor:'#1E6B45'},ctaText:{fontSize:12,fontWeight:'900',color:'#fff'}});