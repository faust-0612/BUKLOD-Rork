import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { Button, Card, SectionTitle, shared } from '@/components/UI';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/lib/theme';

export default function HouseholdsScreen() {
  const {profile,user,hasAnyRole}=useAuth();
  const [items,setItems]=useState<any[]>([]);
  const [name,setName]=useState('');

  const canManage=hasAnyRole(['pastor','local_admin','system_admin']);

  const load=async()=>{
    const {data}=await supabase.from('households')
      .select('id,household_name,church_id,household_members(user_id,household_role,profiles:user_id(full_name))')
      .order('household_name');
    setItems(data??[]);
  };

  useEffect(()=>{load()},[]);

  const create=async()=>{
    if(!canManage||!profile?.church_id||!name.trim())return;
    const {error}=await supabase.from('households').insert({
      church_id:profile.church_id,household_name:name.trim(),created_by:user?.id
    });
    if(error)return Alert.alert('Household',error.message);
    setName('');load();
  };

  return(
    <View style={shared.screen}>
      <FlatList contentContainerStyle={shared.content}
        data={items} keyExtractor={i=>i.id}
        ListHeaderComponent={
          <View>
            <Text style={shared.h1}>Households</Text>
            <Text style={shared.muted}>Family/household links for local church care and directory context.</Text>
            {canManage&&<>
              <SectionTitle>CREATE HOUSEHOLD</SectionTitle>
              <Card>
                <TextInput style={styles.input} placeholder="Household name" value={name} onChangeText={setName}/>
                <Button title="CREATE HOUSEHOLD" onPress={create}/>
              </Card>
            </>}
            <SectionTitle>HOUSEHOLDS</SectionTitle>
          </View>
        }
        ListEmptyComponent={<Card><Text style={shared.muted}>No visible household records.</Text></Card>}
        renderItem={({item})=>(
          <Card>
            <Text style={shared.h2}>{item.household_name}</Text>
            {(item.household_members??[]).map((m:any)=>(
              <Text key={m.user_id} style={[shared.body,{marginTop:4}]}>
                {m.profiles?.full_name||'Member'} • {m.household_role}
              </Text>
            ))}
          </Card>
        )}
      />
    </View>
  )
}
const styles=StyleSheet.create({
  input:{borderWidth:1,borderColor:colors.line,borderRadius:11,padding:12,marginBottom:8}
});

