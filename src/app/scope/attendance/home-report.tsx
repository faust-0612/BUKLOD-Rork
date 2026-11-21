import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { useAttendanceWorkspaceScope } from '@/hooks/useAttendanceWorkspaceScope';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type Row = {
  member_id: string; member_name: string | null; event_id: string;
  event_title: string; host_scope_name: string;
  checked_in_at: string; attendance_status: string;
};
export default function HomeScopeAttendanceReportScreen() {
  const { workspaceScope } = useAttendanceWorkspaceScope();
  const [rows,setRows] = useState<Row[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const refresh = useCallback(async () => {
    if (!workspaceScope?.scope_id) { setLoading(false); return; }
    setLoading(true); setError('');
    const from = new Date(Date.now()-30*86400000).toISOString().slice(0,10);
    const { data, error: rpcError } = await supabase.rpc('buklod_attendance_home_report_v2',{
      p_scope_id: workspaceScope.scope_id, p_from: from, p_to: null,
    });
    if (rpcError) setError(rpcError.message);
    else setRows((data??[]) as Row[]);
    setLoading(false);
  },[workspaceScope?.scope_id]);
  useFocusEffect(useCallback(()=>{ void refresh(); },[refresh]));
  return (
    <ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={()=>void refresh()}/>}
      contentContainerStyle={{flexGrow:1,backgroundColor:colors.background,padding:14,gap:10}}>
      <Stack.Screen options={{title:'Home-Scope Attendance Report'}}/>
      <Text style={{fontWeight:'900',fontSize:20,color:colors.text}}>Member attendance across organizations</Text>
      <Text style={{fontSize:12,color:colors.muted}}>Last 30 days · {workspaceScope?.name ?? 'Your organization'} · One record per member and event. Rewards are never duplicated across reports.</Text>
      {loading && <ActivityIndicator color={colors.greenDark}/>}
      {!!error && <Text accessibilityRole="alert" style={{color:'#9B2C26'}}>{error}</Text>}
      {!loading && !error && rows.length===0 && <Text style={{color:colors.muted}}>No attendance records in this period.</Text>}
      {rows.map(row=>(
        <View key={row.member_id+':'+row.event_id}
          style={{backgroundColor:'#fff',borderRadius:12,borderColor:colors.line,borderWidth:1,padding:12,gap:4}}>
          <Text style={{fontSize:14,color:colors.text,fontWeight:'900'}}>{row.member_name||'BUKLOD Member'}</Text>
          <Text style={{fontSize:12,color:colors.text}}>{row.event_title} · {row.host_scope_name}</Text>
          <Text style={{fontSize:11,color:colors.muted}}>{row.attendance_status.toUpperCase()} · {new Date(row.checked_in_at).toLocaleString('en-PH',{timeZone:'Asia/Manila'})}</Text>
        </View>
      ))}
    </ScrollView>
  );
}