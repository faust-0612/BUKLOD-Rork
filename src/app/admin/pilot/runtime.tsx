import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { AdminGate } from '@/components/AdminGate';
import { Button, Card, shared } from '@/components/UI';
import { supabase } from '@/lib/supabase';
import { appEnvironment } from '@/lib/environment';
import { colors } from '@/lib/theme';

export default function RuntimeAdmin(){
  const [maintenance,setMaintenance]=useState(false);
  const [maintenanceMessage,setMaintenanceMessage]=useState('');
  const [minVersion,setMinVersion]=useState('1.0.0');
  const [recommendedVersion,setRecommendedVersion]=useState('1.0.0');
  const [updateMessage,setUpdateMessage]=useState('');
  const [pilotRequired,setPilotRequired]=useState(false);
  const [releaseTitle,setReleaseTitle]=useState('');
  const [releaseNotes,setReleaseNotes]=useState('');

  const load=async()=>{
    const {data,error}=await supabase.from('app_runtime_config')
      .select('*').eq('environment',appEnvironment).single();
    if(error)return Alert.alert('Runtime',error.message);
    setMaintenance(data.maintenance_mode);
    setMaintenanceMessage(data.maintenance_message??'');
    setMinVersion(data.minimum_supported_version);
    setRecommendedVersion(data.recommended_version);
    setUpdateMessage(data.update_message??'');
    setPilotRequired(data.pilot_access_required);
    setReleaseTitle(data.release_title??'');
    setReleaseNotes(data.release_notes??'');
  };

  useEffect(()=>{load()},[]);

  const save=async()=>{
    const {error}=await supabase.rpc('set_runtime_config',{
      p_environment:appEnvironment,
      p_maintenance_mode:maintenance,
      p_maintenance_message:maintenanceMessage.trim()||null,
      p_minimum_supported_version:minVersion.trim(),
      p_recommended_version:recommendedVersion.trim(),
      p_update_message:updateMessage.trim()||null,
      p_pilot_access_required:pilotRequired,
      p_release_title:releaseTitle.trim()||null,
      p_release_notes:releaseNotes.trim()||null,
    });
    if(error)return Alert.alert('Could not save runtime configuration',error.message);
    Alert.alert('Saved',`${appEnvironment} runtime controls updated.`);
  };

  return(
    <AdminGate>
      <ScrollView style={shared.screen} contentContainerStyle={shared.content}>
        <Text style={shared.h1}>Runtime Control</Text>
        <Text style={shared.muted}>Environment: {appEnvironment}</Text>

        <Card>
          <View style={shared.row}>
            <View style={{flex:1}}>
              <Text style={shared.h2}>Maintenance Mode</Text>
              <Text style={shared.muted}>System Admin bypass remains available.</Text>
            </View>
            <Switch value={maintenance} onValueChange={setMaintenance}/>
          </View>
          <TextInput style={styles.area} multiline value={maintenanceMessage}
            onChangeText={setMaintenanceMessage} placeholder="Maintenance message"/>
        </Card>

        <Card>
          <Text style={shared.h2}>Version Gate</Text>
          <TextInput style={styles.input} value={minVersion} onChangeText={setMinVersion}
            placeholder="Minimum supported version"/>
          <TextInput style={styles.input} value={recommendedVersion} onChangeText={setRecommendedVersion}
            placeholder="Recommended version"/>
          <TextInput style={styles.area} multiline value={updateMessage}
            onChangeText={setUpdateMessage} placeholder="Update message"/>
        </Card>

        <Card>
          <View style={shared.row}>
            <View style={{flex:1}}>
              <Text style={shared.h2}>Pilot Access Required</Text>
              <Text style={shared.muted}>When enabled, only active cohort participants can enter.</Text>
            </View>
            <Switch value={pilotRequired} onValueChange={setPilotRequired}/>
          </View>
        </Card>

        <Card>
          <Text style={shared.h2}>Release Notes</Text>
          <TextInput style={styles.input} value={releaseTitle} onChangeText={setReleaseTitle}
            placeholder="Release title"/>
          <TextInput style={styles.area} multiline value={releaseNotes} onChangeText={setReleaseNotes}
            placeholder="What's new in this pilot build?"/>
        </Card>

        <Button title="SAVE RUNTIME CONTROLS" onPress={save}/>
      </ScrollView>
    </AdminGate>
  )
}
const styles=StyleSheet.create({
  input:{borderWidth:1,borderColor:colors.line,borderRadius:11,padding:12,marginTop:8},
  area:{minHeight:90,borderWidth:1,borderColor:colors.line,borderRadius:11,padding:12,textAlignVertical:'top',marginTop:8}
});
