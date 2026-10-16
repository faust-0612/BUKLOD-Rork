import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Card, shared } from '@/components/UI';
import { useRuntimeConfig } from '@/providers/RuntimeConfigProvider';
import { checkForApprovedBuklodOtaR1 } from '@/components/BuklodClientReleaseNotice';
import { notifyBuklodBsocClientR1 } from '@/lib/buklodBsocClientSafetyR1';

export default function UpdateRequired() {
  const {config,refresh} = useRuntimeConfig();
  const [busy,setBusy] = useState(false);
  const [reported,setReported] = useState(false);

  useEffect(() => {
    void notifyBuklodBsocClientR1('UPGRADE_NOTICE','APP_VERSION_UNSUPPORTED','REPORTED');
  }, []);

  return (
    <View style={[shared.screen,shared.content,{justifyContent:'center'}]}>
      <Card>
        <Text style={shared.h1}>BUKLOD Update Required</Text>
        <Text style={[shared.body,{marginTop:10}]}>
          {config?.update_message ||
           'Hindi na supported ang installed version. I-install ang latest approved BUKLOD build bago magpatuloy.'}
        </Text>
        <Text style={[shared.muted,{marginTop:8}]}>
          Minimum supported version: {config?.minimum_supported_version || '—'}
        </Text>
        <Pressable disabled={busy} onPress={async()=>{
          if(busy)return;
          setBusy(true);
          try { await checkForApprovedBuklodOtaR1(); } finally { setBusy(false); }
        }}>
          <Text style={{fontWeight:'900',marginTop:18,color:'#23623D'}}>
            {busy?'CHECKING...':'CHECK OFFICIAL OTA'}
          </Text>
        </Pressable>
        <Pressable disabled={busy} onPress={async()=>{
          setBusy(true);
          try { await refresh(); router.replace('/'); } finally { setBusy(false); }
        }}>
          <Text style={{fontWeight:'900',marginTop:18}}>CHECK AGAIN</Text>
        </Pressable>
        <Pressable onPress={async () => {
          const sent = await notifyBuklodBsocClientR1('REQUEST_HELP','APP_VERSION_UNSUPPORTED','REPORTED');
          if (sent) setReported(true);
        }}>
          <Text style={{fontWeight:'800',marginTop:16,color:'#23623D'}}>
            {reported ? 'REQUEST SENT TO BSOC' : 'REQUEST BSOC ASSISTANCE'}
          </Text>
        </Pressable>
        <Text style={[shared.muted,{marginTop:14}]}>
          Kung walang compatible OTA, kailangan ng approved native APK mula sa official distributor.
          Walang pagbabago sa iyong account o data.
        </Text>
      </Card>
    </View>
  );
}
