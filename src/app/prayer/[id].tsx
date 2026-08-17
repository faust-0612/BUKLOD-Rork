import {
  useCallback,
  useEffect,
  useState
} from 'react';

import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';

import {
  useLocalSearchParams,
  router
} from 'expo-router';

import {supabase} from '@/lib/supabase';

import {
  Button,
  Card,
  SectionTitle,
  shared
} from '@/components/UI';

import {useAuth} from '@/providers/AuthProvider';
import {colors} from '@/lib/theme';


type PrayerResponder = {
  user_id: string;
  full_name: string;
  prayed_at?: string | null;
};


export default function PrayerDetail() {

  const {id} =
    useLocalSearchParams<{id:string}>();

  const {user} = useAuth();

  const [item,setItem] =
    useState<any>(null);

  const [responders,setResponders] =
    useState<PrayerResponder[]>([]);

  const [showResponders,setShowResponders] =
    useState(false);

  const [answer,setAnswer] =
    useState('');


  const loadResponders =
    useCallback(async()=>{

      if(!id)return;

      /*
       * Preferred path:
       * secure DB RPC which follows canonical
       * Prayer Wall visibility.
       */
      const {
        data:rpcRows,
        error:rpcError
      } = await (supabase as any).rpc(
        'get_prayer_responder_names_v2',
        {
          p_prayer_request_id:id
        }
      );

      if(!rpcError){

        setResponders(
          (rpcRows ?? []).map(
            (row:any)=>({
              user_id:row.user_id,
              full_name:
                row.full_name ||
                'BUKLOD Member',
              prayed_at:
                row.prayed_at
            })
          )
        );

        return;
      }


      /*
       * Graceful fallback while PATCH 153P-1B
       * has not yet been deployed.
       */
      const {
        data:fallbackRows,
        error:fallbackError
      } = await supabase
        .from('prayer_responses')
        .select(
          'user_id,prayed_at,profiles:user_id(full_name)'
        )
        .eq(
          'prayer_request_id',
          id
        )
        .order(
          'prayed_at',
          {ascending:true}
        );

      if(fallbackError){

        console.warn(
          'Prayer responders',
          fallbackError.message
        );

        setResponders([]);
        return;
      }

      setResponders(
        ((fallbackRows ?? []) as any[])
          .map((row:any)=>({
            user_id:row.user_id,

            full_name:
              row.profiles?.full_name ||
              'BUKLOD Member',

            prayed_at:
              row.prayed_at
          }))
      );

    },[id]);


  const load =
    useCallback(async()=>{

      if(!id)return;

      const {
        data:p,
        error
      } = await supabase
        .from('prayer_requests')
        .select(
          '*,profiles:user_id(full_name)'
        )
        .eq('id',id)
        .single();

      if(error){

        console.warn(
          'Prayer detail',
          error.message
        );

        return;
      }

      setItem(p);

      setAnswer(
        p?.answered_text ?? ''
      );

      await loadResponders();

    },[
      id,
      loadResponders
    ]);


  useEffect(()=>{
    void load();
  },[load]);


  /*
   * Keep the responder count/list current
   * while the Prayer Detail screen is open.
   */
  useEffect(()=>{

    if(!id)return;

    const channel =
      supabase
        .channel(
          `prayer-detail:${id}`
        )

        .on(
          'postgres_changes',
          {
            event:'*',
            schema:'public',
            table:'prayer_responses',
            filter:
              `prayer_request_id=eq.${id}`
          },
          ()=>{
            void loadResponders();
          }
        )

        .on(
          'postgres_changes',
          {
            event:'UPDATE',
            schema:'public',
            table:'prayer_requests',
            filter:
              `id=eq.${id}`
          },
          ()=>{
            void load();
          }
        )

        .subscribe();

    return ()=>{
      supabase.removeChannel(channel);
    };

  },[
    id,
    load,
    loadResponders
  ]);


  const prayed=async()=>{
    if(!user||!id)return;

    /* I_PRAYED_DETAIL_FIX2 */

    /*
     * First check whether this member
     * already recorded a prayer.
     *
     * This avoids using UPSERT,
     * because prayer_responses only
     * needs a single INSERT per member
     * and prayer request.
     */
    const {
      data:existing,
      error:checkError
    }=
      await supabase
        .from('prayer_responses')
        .select('prayer_request_id')
        .eq(
          'prayer_request_id',
          id
        )
        .eq(
          'user_id',
          user.id
        )
        .maybeSingle();


    if(checkError){
      Alert.alert(
        'Prayer',
        checkError.message
      );

      return;
    }


    if(existing){

      await load();

      Alert.alert(
        'Prayer',
        'You already prayed for this request.'
      );

      return;
    }


    const {error}=
      await supabase
        .from('prayer_responses')
        .insert([
          {
            prayer_request_id:id,
            user_id:user.id
          }
        ]);


    /*
     * Defensive race-condition handling:
     * if another tap inserted the same
     * response first, treat duplicate
     * key as already prayed.
     */
    if(
      error?.code==='23505'
    ){

      await load();

      Alert.alert(
        'Prayer',
        'You already prayed for this request.'
      );

      return;
    }


    if(error){

      Alert.alert(
        'Prayer',
        error.message
      );

      return;
    }


    await load();


    Alert.alert(
      'Prayer',
      'Prayer recorded. Thank you for praying.'
    );
  };


  const markAnswered=
    async()=>{

      if(
        !user ||
        !item ||
        item.user_id !== user.id
      )return;

      const {error} =
        await supabase
          .from('prayer_requests')
          .update({
            status:'answered',

            answered_text:
              answer.trim() ||
              null,

            answered_at:
              new Date().toISOString()
          })
          .eq(
            'id',
            item.id
          );

      if(error){

        return Alert.alert(
          'Could not update',
          error.message
        );

      }

      Alert.alert(
        'Answered prayer',
        'This prayer has been moved to your answered-prayer journey.'
      );

      router.back();

    };


  if(!item){

    return (
      <View style={shared.screen}/>
    );

  }


  const owner =
    item.user_id === user?.id;


  return(

    <ScrollView
      style={shared.screen}
      contentContainerStyle={shared.content}
    >

      <Text style={shared.h1}>
        Prayer Request
      </Text>


      <Card>

        <Text style={shared.h2}>
          {
            item.profiles?.full_name ||
            'BUKLOD Member'
          }
        </Text>

        <Text style={shared.muted}>
          {item.privacy} • {item.status}
        </Text>


        {!!item.title && (

          <Text
            style={[
              shared.h2,
              {marginTop:10}
            ]}
          >
            {item.title}
          </Text>

        )}


        <Text
          style={[
            shared.body,
            {marginVertical:10}
          ]}
        >
          {item.request_text}
        </Text>


        <Pressable
          onPress={()=>{
            if(responders.length > 0){
              setShowResponders(
                current=>!current
              );
            }
          }}
          style={styles.prayedLink}
          accessibilityRole="button"
        >

          <Text style={styles.prayedText}>
            🙏 {responders.length} prayed
            {
              responders.length > 0
                ? showResponders
                  ? ' ▲'
                  : ' ▼'
                : ''
            }
          </Text>

          {
            responders.length > 0 && (
              <Text style={shared.muted}>
                Tap to see who prayed
              </Text>
            )
          }

        </Pressable>

      </Card>


      {
        showResponders &&
        responders.length > 0 && (

          <>
            <SectionTitle>
              PEOPLE WHO PRAYED
            </SectionTitle>

            <Card>

              {
                responders.map(
                  (person,index)=>(

                    <View
                      key={
                        person.user_id
                      }
                      style={[
                        styles.responderRow,
                        index ===
                          responders.length - 1
                          ? styles.lastResponder
                          : null
                      ]}
                    >

                      <Text
                        style={
                          styles.responderName
                        }
                      >
                        🙏 {person.full_name}
                      </Text>

                    </View>

                  )
                )
              }

            </Card>
          </>

        )
      }


      {!owner && (

        <>
          <Button
            title="🙏 I PRAYED"
            onPress={prayed}
          />

          <Button
            title="⚑ REPORT CONTENT"
            outline
            onPress={()=>
              router.push({
                pathname:
                  '/moderation/report',

                params:{
                  entityType:'prayer',
                  entityId:id
                }
              })
            }
          />
        </>

      )}


      {
        owner &&
        item.status === 'active' && (

          <>
            <SectionTitle>
              MARK AS ANSWERED
            </SectionTitle>

            <Card>

              <Text style={shared.h2}>
                How did God answer?
              </Text>

              <TextInput
                multiline
                value={answer}
                onChangeText={setAnswer}
                style={styles.area}
                placeholder=
                  "Optional testimony or update..."
              />

              <Button
                title="✓ MARK AS ANSWERED"
                onPress={markAnswered}
              />

            </Card>
          </>

        )
      }


      {
        item.status === 'answered' &&
        item.answered_text && (

          <Card>

            <Text style={shared.h2}>
              ✓ Answered Prayer
            </Text>

            <Text style={shared.body}>
              {item.answered_text}
            </Text>

          </Card>

        )
      }

    </ScrollView>

  );

}


const styles =
  StyleSheet.create({

    area:{
      minHeight:120,
      borderWidth:1,
      borderColor:colors.line,
      borderRadius:11,
      padding:12,
      textAlignVertical:'top',
      marginVertical:9
    },

    prayedLink:{
      paddingVertical:7
    },

    prayedText:{
      fontWeight:'900',
      fontSize:15
    },

    responderRow:{
      paddingVertical:11,
      borderBottomWidth:1,
      borderBottomColor:colors.line
    },

    lastResponder:{
      borderBottomWidth:0
    },

    responderName:{
      fontWeight:'800',
      fontSize:15
    }

  });