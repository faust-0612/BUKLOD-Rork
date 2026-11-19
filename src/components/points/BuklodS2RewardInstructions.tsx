/** Season 2-only Token/Badge instructions. All values come from the disabled
 * candidate policy. This is not an award, enrollment or wallet UI. */
import React from 'react';
import {StyleSheet,Text,View} from 'react-native';
import {useBuklodI18n} from '@/providers/BuklodI18nProvider';
import {
  S2_RULES,
  S2_WEEKLY_POLICY,
  S2_COSMETIC_PRICE_PREVIEW,
  S2_REWARD_ROLLOUT,
  type S2Source,
} from '@/lib/season2/buklodSeason2RewardContractR1';

const SOURCE_LABELS:readonly {id:S2Source;fil:string;en:string;howFil:string;howEn:string}[]=[
  {id:'today_dugtong',fil:'Today / Dugtong',en:'Today / Dugtong',howFil:'Magpasa ng makabuluhan at aprubadong Dugtong.',howEn:'Submit a substantive, approved Dugtong.'},
  {id:'kl_verified_chapter',fil:'Na-verify na KL chapter',en:'Verified KL chapter',howFil:'Tapusin ang reading at pumasa sa verification quiz.',howEn:'Finish the chapter and pass the verification quiz.'},
  {id:'wall_original_post',fil:'Orihinal na Wall post',en:'Original Wall post',howFil:'Magbahagi ng tunay at makabuluhang orihinal na post.',howEn:'Share a genuine, substantive original post.'},
  {id:'wall_meaningful_comment',fil:'Makabuluhang komento',en:'Meaningful comment',howFil:'Makipag-usap nang maayos sa post ng ibang member, hindi self-reply o spam.',howEn:'Contribute meaningfully on someone else’s post, without self-replies or spam.'},
];

export default function BuklodS2RewardInstructions(){
  const {locale}=useBuklodI18n(),en=locale==='en';
  const text=(fil:string,english:string)=>en?english:fil;
  const disabled=!S2_REWARD_ROLLOUT.journeyTokenMint;
  return <View style={s.card}>
    <Text style={s.kicker}>{text('SEASON 2 · REWARDS GUIDE','SEASON 2 · REWARDS GUIDE')}</Text>
    <Text style={s.title}>{text('Journey Tokens at Achievement Badges','Journey Tokens & Achievement Badges')}</Text>
    <Text style={s.status}>{disabled?text('PREVIEW LANG · WALANG TOKEN NA KASALUKUYANG NAIGAGAWAD','PREVIEW ONLY · NO TOKEN GRANTS ARE ACTIVE'):text('SERVER VERIFIED ONLY','SERVER VERIFIED ONLY')}</Text>
    <Text style={s.sub}>{text('Para saan ang Journey Tokens?','Why earn Journey Tokens?')}</Text>
    <Text style={s.body}>{text(
      'Para lamang sa opsyonal na cosmetic customization gaya ng scene themes, accessories at visual effects. Hindi ito BP, QMP, cash, Kingdom Shards, withdrawal o bayad para sa mga earned Character items.',
      'For optional cosmetics such as scene themes, accessories and visual effects only. Not BP, QMP, cash, Kingdom Shards, withdrawals or payment for earned Character collectibles.')}</Text>
    <Text style={s.sub}>{text('Paano makakakuha?','How to earn them')}</Text>
    {SOURCE_LABELS.map(item=>{
      const rule=S2_RULES[item.id];
      return <View key={item.id} style={s.source}>
        <View style={{flex:1}}>
          <Text style={s.sourceName}>{en?item.en:item.fil}</Text>
          <Text style={s.body}>{en?item.howEn:item.howFil}</Text>
          <Text style={s.note}>{text('Server verification, ownership at anti-farm checks','Server verification, ownership and anti-farm checks')}</Text>
        </View>
        <Text style={s.amount}>+{rule.tokens}{'\n'}{text('limit','cap')} {rule.dailyLimit}/{text('araw','day')}</Text>
      </View>;
    })}
    <Text style={s.note}>{text(
      `May ${S2_WEEKLY_POLICY.dailyTokenCeiling} token/day maximum kapag active na ang system. Ang ibang faith-only at non-faith sources ay walang token reward hangga't hindi nabe-verify ang pantay na earning opportunities. Walang reward sa prayer sincerity o panonood ng ads.`,
      `Maximum ${S2_WEEKLY_POLICY.dailyTokenCeiling} tokens/day once active. Extra faith/nonfaith sources remain disabled until real parity is verified. No rewards for prayer sincerity or watching ads.`
    )}</Text>
    <Text style={s.sub}>{text('Paano makukuha ang Weekly Foundation Badge?','How to earn the Weekly Foundation Badge')}</Text>
    <Text style={s.body}>{text(
      'Sa isang linggo: (1) isang na-verify na learning source at (2) isang HIWALAY na na-verify na community contribution. Pagkatapos ay mag-claim bago ang deadline. Ang isang receipt ay hindi puwedeng gamitin sa dalawang Foundation claim.',
      'In one week: (1) one verified learning source and (2) a DIFFERENT verified community contribution. Then claim before the deadline. One receipt cannot satisfy two Foundation claims.')}</Text>
    <Text style={s.note}>{text(
      `7 regular days + ${S2_WEEKLY_POLICY.automaticGraceDays} automatic grace days; hanggang ${S2_WEEKLY_POLICY.flexCreditsPerSeason} opt-in Flex Credits/season. Walang bawas sa dating BP, Character XP, QMP o cash kapag hindi natapos.`,
      `7 regular days + ${S2_WEEKLY_POLICY.automaticGraceDays} automatic grace days; up to ${S2_WEEKLY_POLICY.flexCreditsPerSeason} opt-in Flex Credits/season. Unfinished tasks do not deduct historical BP, Character XP, QMP or cash.`)}</Text>
    <Text style={s.sub}>{text('Ano ang mabibili kapag active? (Proposed)','Optional cosmetic prices (proposed)')}</Text>
    {Object.entries(S2_COSMETIC_PRICE_PREVIEW).map(([name,price])=><View key={name} style={s.priceRow}>
      <Text style={s.body}>{name.replaceAll('_',' ')}</Text><Text style={s.price}>{price} tokens</Text>
    </View>)}
    <Text style={s.note}>{text('Mga proposed rates lamang ito. Hindi pa ito purchase button, claim, o live wallet. Ang tunay na reward ay manggagaling lamang sa validated Season 2 backend.','These are proposed rates, not purchasing, claiming or a live wallet. Only the validated Season 2 backend can award rewards.')}</Text>
  </View>;
}
const C={gold:'#E8C56B',white:'#F8F3E5',muted:'#A7B7C9',dark:'#162033'};
const s=StyleSheet.create({
  card:{margin:14,padding:13,backgroundColor:C.dark,borderRadius:14,borderColor:'#405066',borderWidth:1,gap:6},
  kicker:{color:C.gold,fontWeight:'900',fontSize:11,letterSpacing:.5},
  title:{color:C.white,fontSize:15,fontWeight:'900'},
  status:{color:C.gold,fontSize:10,fontWeight:'900',marginVertical:5},
  sub:{color:C.white,fontSize:12,fontWeight:'900',marginTop:9},
  body:{color:'#D2DCE9',fontSize:11,lineHeight:17,flex:1},
  note:{color:C.muted,fontSize:10,lineHeight:15,marginTop:4},
  source:{flexDirection:'row',gap:9,borderTopWidth:1,borderTopColor:'#405066',paddingTop:9},
  sourceName:{color:C.white,fontSize:11,fontWeight:'800',marginBottom:3},
  amount:{color:C.gold,textAlign:'right',fontSize:11,fontWeight:'900',minWidth:67},
  priceRow:{flexDirection:'row',justifyContent:'space-between',gap:7},
  price:{color:C.gold,fontWeight:'800',fontSize:11},
});
