import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import { withAlpha } from '@/lib/buklodContrast';
import {
  buildBuklodReferralShareUrl,
  ensureBuklodProfitFirstIdentity,
  loadBuklodReferralSummaryV2,
  recordBuklodReferralFunnel,
  type BuklodReferralSummaryV2,
} from '@/lib/buklodReferralV2';
import {
  buildBuklodUserFeedback,
  trackBuklodFeedbackEvent,
} from '@/lib/buklodUserFeedback';

function php(value:unknown){
  return '₱'+Number(value??0).toLocaleString('en-PH',{
    minimumFractionDigits:2,
    maximumFractionDigits:2,
  });
}

export default function BuklodReferralInviteCard(){
  const {theme}=useBuklodPresentation();
  const [summary,setSummary]=useState<BuklodReferralSummaryV2|null>(null);
  const [loading,setLoading]=useState(true);
  const [loadError,setLoadError]=useState('');
  const [supportCode,setSupportCode]=useState<string|null>(null);

  const load=useCallback(async()=>{
    setLoading(true);
    setLoadError('');
    setSupportCode(null);
    try{
      await ensureBuklodProfitFirstIdentity();
      setSummary(await loadBuklodReferralSummaryV2());
    }catch(error){
      console.warn('Referral dashboard could not be loaded.');
      const feedback=buildBuklodUserFeedback(error,{
        context:'general',
        fallbackTitle:'Referral unavailable',
        fallbackMessage:"BUKLOD couldn't load your referral status right now.",
      });
      setSummary(null);
      setLoadError(
        "BUKLOD couldn't load your referral status right now. Your existing referral relationship is unchanged."
      );
      setSupportCode(feedback.supportCode??'SYS-500');
      void trackBuklodFeedbackEvent({
        event:'error_shown',
        category:feedback.category,
        supportCode:feedback.supportCode??'SYS-500',
        route:'/(tabs)/me',
        feature:'Referral',
        outcome:'referral_summary_failed',
      });
    }finally{
      setLoading(false);
    }
  },[]);

  useEffect(()=>{void load()},[load]);

  const code=String(summary?.referral_code??'');
  const link=String(
    summary?.share_url??buildBuklodReferralShareUrl(code)
  );

  const copyCode=async()=>{
    if(!code)return;
    await Clipboard.setStringAsync(code);
    void recordBuklodReferralFunnel('COPY_CODE','PROFILE');
    Alert.alert('Copied','Referral code copied.');
  };

  const copyLink=async()=>{
    if(!link)return;
    await Clipboard.setStringAsync(link);
    void recordBuklodReferralFunnel('COPY_LINK','PROFILE');
    Alert.alert('Copied','Referral link copied.');
  };

  const shareInvite=async()=>{
    if(!code)return;
    void recordBuklodReferralFunnel('SHARE_TAP','PROFILE');
    try{
      await Share.share({
        title:'Join BUKLOD',
        message:
          'Join me on BUKLOD. Open '+link+
          ' or use referral code '+code+
          '. A valid referral shows a ₱20 Pending reward and qualifies only through legitimate finalized platform activity.',
        url:link,
      });
      void recordBuklodReferralFunnel('NATIVE_SHARE_OPEN','PROFILE');
    }catch{
      // User may dismiss the native share sheet.
    }
  };

  const styles=StyleSheet.create({
    card:{
      borderWidth:1,
      borderColor:theme.border,
      borderRadius:16,
      backgroundColor:theme.surface,
      padding:14,
      gap:9,
    },
    eyebrow:{
      fontSize:10,
      fontWeight:'900',
      letterSpacing:1.1,
      color:theme.textMuted,
    },
    title:{
      fontSize:16,
      fontWeight:'900',
      color:theme.textPrimary,
    },
    sub:{
      fontSize:11.5,
      lineHeight:17,
      color:theme.textMuted,
    },
    codeRow:{
      flexDirection:'row',
      alignItems:'center',
      gap:8,
    },
    codePill:{
      flex:1,
      minHeight:40,
      borderRadius:12,
      borderWidth:1,
      borderColor:withAlpha(theme.accent,.35),
      backgroundColor:withAlpha(theme.accentSoft,.65),
      alignItems:'center',
      justifyContent:'center',
      paddingHorizontal:12,
    },
    codeText:{
      fontSize:16,
      fontWeight:'900',
      letterSpacing:2,
      color:theme.accent,
    },
    actions:{
      flexDirection:'row',
      gap:7,
    },
    action:{
      flex:1,
      minHeight:38,
      borderRadius:11,
      alignItems:'center',
      justifyContent:'center',
      flexDirection:'row',
      gap:5,
      backgroundColor:theme.accent,
    },
    outline:{
      backgroundColor:theme.surface,
      borderWidth:1,
      borderColor:theme.border,
    },
    actionText:{
      fontSize:9.5,
      fontWeight:'900',
      color:'#fff',
    },
    outlineText:{
      color:theme.textPrimary,
    },
    stats:{
      flexDirection:'row',
      flexWrap:'wrap',
      gap:6,
    },
    stat:{
      flexGrow:1,
      flexBasis:'30%',
      padding:9,
      borderRadius:11,
      backgroundColor:withAlpha(theme.accentSoft,.45),
    },
    statValue:{
      fontSize:14,
      fontWeight:'900',
      color:theme.textPrimary,
    },
    statLabel:{
      marginTop:2,
      fontSize:8.5,
      fontWeight:'800',
      color:theme.textMuted,
    },
    progress:{
      height:8,
      borderRadius:999,
      overflow:'hidden',
      backgroundColor:withAlpha(theme.border,.7),
    },
    progressFill:{
      height:'100%',
      borderRadius:999,
      backgroundColor:theme.accent,
    },
    item:{
      padding:10,
      borderWidth:1,
      borderColor:theme.border,
      borderRadius:11,
      gap:3,
    },
    itemTitle:{
      fontSize:10.5,
      fontWeight:'900',
      color:theme.textPrimary,
    },
    itemMeta:{
      fontSize:9.5,
      lineHeight:14,
      color:theme.textMuted,
    },
    linkBtn:{
      minHeight:38,
      borderRadius:11,
      borderWidth:1,
      borderColor:theme.border,
      alignItems:'center',
      justifyContent:'center',
      flexDirection:'row',
      gap:6,
    },
    linkText:{
      fontSize:9.5,
      fontWeight:'900',
      color:theme.textPrimary,
    },
  });

  if(loading){
    return (
      <View style={styles.card}>
        <ActivityIndicator color={theme.accent}/>
      </View>
    );
  }

  if(!summary?.identity_ready||!code){
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Referral & Sharing</Text>
        <Text style={styles.sub}>
          {loadError ||
            'Referral identity is preparing. This does not block BUKLOD.'}
        </Text>
        {!!supportCode && (
          <Text style={styles.itemMeta}>Support code: {supportCode}</Text>
        )}
        <View style={styles.actions}>
          <Pressable onPress={()=>void load()} style={styles.linkBtn}>
            <Text style={styles.linkText}>REFRESH</Text>
          </Pressable>
          {!!loadError && (
            <Pressable
              onPress={()=>{
                void trackBuklodFeedbackEvent({
                  event:'support_opened_after_error',
                  supportCode,
                  route:'/(tabs)/me',
                  feature:'Referral',
                  outcome:'need_help',
                });
                router.push({
                  pathname:'/help' as any,
                  params:{
                    category:'OTHER',
                    errorCode:supportCode??'SYS-500',
                    message:loadError,
                    sourceRoute:'/(tabs)/me',
                  },
                });
              }}
              style={styles.linkBtn}
            >
              <Text style={styles.linkText}>NEED HELP?</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  const pct=Math.max(
    0,
    Math.min(100,Number(summary.my_qualification_pct??0)),
  );
  const refs=Array.isArray(summary.referrals)
    ? summary.referrals.slice(0,5)
    : [];
  const pending=refs.reduce(
    (sum,row)=>sum+Number(row.pending_reward_php??0),
    0,
  );
  const qualified=refs.reduce(
    (sum,row)=>sum+Number(row.reward_withdrawable_php??0),
    0,
  );

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>REFERRAL + SHARING</Text>
      <Text style={styles.title}>Share BUKLOD</Text>
      <Text style={styles.sub}>
        One-time {php(summary.one_time_reward_php ?? 20)} per genuinely unique
        qualified first-line referral, plus {Number(summary.first_line_share_pct ?? 10).toFixed(0)}%
        first-line share for {Number(summary.referral_months ?? 6).toFixed(0)} months under the
        active policy. Pending is not withdrawable. There is no downline commission.
      </Text>

      <View style={styles.codeRow}>
        <View style={styles.codePill}>
          <Text style={styles.codeText}>{code}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable onPress={()=>void shareInvite()} style={styles.action}>
          <MaterialCommunityIcons
            name="share-variant-outline"
            size={14}
            color="#fff"
          />
          <Text style={styles.actionText}>SHARE</Text>
        </Pressable>
        <Pressable
          onPress={()=>void copyLink()}
          style={[styles.action,styles.outline]}
        >
          <MaterialCommunityIcons
            name="link-variant"
            size={14}
            color={theme.textPrimary}
          />
          <Text style={[styles.actionText,styles.outlineText]}>
            COPY LINK
          </Text>
        </Pressable>
        <Pressable
          onPress={()=>void copyCode()}
          style={[styles.action,styles.outline]}
        >
          <MaterialCommunityIcons
            name="content-copy"
            size={14}
            color={theme.textPrimary}
          />
          <Text style={[styles.actionText,styles.outlineText]}>
            CODE
          </Text>
        </Pressable>
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{summary.invited_count??0}</Text>
          <Text style={styles.statLabel}>TOTAL REFERRALS</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{php(pending)}</Text>
          <Text style={styles.statLabel}>₱20 PENDING</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{php(qualified)}</Text>
          <Text style={styles.statLabel}>QUALIFIED ₱20</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {php(summary.available_cash_php)}
          </Text>
          <Text style={styles.statLabel}>WITHDRAWABLE</Text>
        </View>
      </View>

      <Text style={styles.sub}>
        Your earning qualification: {pct.toFixed(1)}%
      </Text>
      <View style={styles.progress}>
        <View style={[styles.progressFill,{width:(pct+'%') as any}]}/>
      </View>
      <Text style={styles.sub}>
        {php(summary.my_qualification_value_php)}
        {' / '}
        {php(summary.my_qualification_threshold_php)}
        {summary.my_user_share_active
          ? ' · 30% user allocation active'
          : ' · 30% user allocation not active yet'}
      </Text>

      {refs.map(row=>{
        const rewardText=row.reward_withdrawable_php>0
          ? php(row.reward_withdrawable_php)
          : php(row.pending_reward_php)+' Pending';
        const shareText=row.share_ends_at
          ? 'through '+new Date(row.share_ends_at).toLocaleDateString('en-PH')
          : 'Not yet active';
        return (
          <View key={row.referral_id} style={styles.item}>
            <Text style={styles.itemTitle}>
              {row.referred_label} · {row.status}
            </Text>
            <Text style={styles.itemMeta}>
              Reward: {rewardText}
              {' · Qualification '}
              {Number(row.qualification_pct??0).toFixed(1)}%
            </Text>
            <Text style={styles.itemMeta}>
              {Number(summary.first_line_share_pct ?? 10).toFixed(0)}% first-line share: {shareText}
            </Text>
          </View>
        );
      })}

      <Text style={styles.sub}>
        Artificial usage/ad manipulation is prohibited. Deleting or recreating
        an account does not reset referral eligibility or the original six-month
        period. There is no second-line/third-line commission.
      </Text>

      <Pressable
        onPress={()=>router.push('/bayanihan' as any)}
        style={styles.linkBtn}
      >
        <MaterialCommunityIcons
          name="chart-donut"
          size={15}
          color={theme.textPrimary}
        />
        <Text style={styles.linkText}>VIEW ECONOMY / PAYOUT</Text>
      </Pressable>
    </View>
  );
}
