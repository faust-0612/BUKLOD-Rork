import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { router } from 'expo-router';

import { AdminGate } from '@/components/AdminGate';

import {
  Button,
  Card,
  shared,
} from '@/components/UI';

import { supabase } from '@/lib/supabase';

import { colors } from '@/lib/theme';

import { useAuth } from '@/providers/AuthProvider';


export default function HomeReminderAdminScreen() {

  const {
    profile,
    hasRole,
  } =
    useAuth();


  const [
    loading,
    setLoading,
  ] =
    useState(true);


  const [
    saving,
    setSaving,
  ] =
    useState(false);


  const [
    title,
    setTitle,
  ] =
    useState(
      'IMPORTANT REMINDER'
    );


  const [
    body,
    setBody,
  ] =
    useState('');


  const [
    active,
    setActive,
  ] =
    useState(true);


  const load =
    useCallback(
      async () => {

        setLoading(
          true
        );


        const {
          data,
          error,
        } =
          await supabase
            .from(
              'home_important_reminders'
            )
            .select(
              'slot,title,body,is_active'
            )
            .eq(
              'slot',
              'home_primary'
            )
            .maybeSingle();


        if (error) {

          Alert.alert(
            'Important Reminder',
            error.message
          );

          setLoading(
            false
          );

          return;

        }


        if (data) {

          setTitle(
            String(
              data.title ??
              ''
            )
          );


          setBody(
            String(
              data.body ??
              ''
            )
          );


          setActive(
            !!data.is_active
          );

        }


        setLoading(
          false
        );

      },
      []
    );


  useEffect(
    () => {

      void load();

    },
    [
      load,
    ]
  );


  const save =
    async () => {

      /* HOME_REMINDER_SAVE_GUARD_V1 */

      if (saving) {
        return;
      }

      if (
        !hasRole(
          'system_admin'
        )
      ) {

        Alert.alert(
          'System Admin',
          'Only the System Admin may update the Home Important Reminder.'
        );

        return;

      }


      const cleanTitle =
        title.trim();


      const cleanBody =
        body.trim();


      if (
        !cleanTitle ||
        !cleanBody
      ) {

        Alert.alert(
          'Important Reminder',
          'Enter both a title and reminder message.'
        );

        return;

      }


      setSaving(
        true
      );


      const {
        error,
      } =
        await supabase
          .from(
            'home_important_reminders'
          )
          .upsert(
            {
              slot:
                'home_primary',

              title:
                cleanTitle,

              body:
                cleanBody,

              is_active:
                active,

              starts_at:
                new Date()
                  .toISOString(),

              ends_at:
                null,

              updated_by:
                profile?.id ??
                null,

              updated_at:
                new Date()
                  .toISOString(),
            },
            {
              onConflict:
                'slot',
            }
          );


      setSaving(
        false
      );


      if (error) {

        Alert.alert(
          'Important Reminder',
          error.message
        );

        return;

      }


      Alert.alert(
        'Saved',
        'The Home Important Reminder has been updated.'
      );

    };


  return (

    <AdminGate>

      <ScrollView
        style={
          shared.screen
        }
        contentContainerStyle={
          styles.content
        }
      >

        <Text
          style={
            styles.eyebrow
          }
        >
          HOME CONTENT
        </Text>


        <Text
          style={
            shared.h1
          }
        >
          Important Reminder
        </Text>


        <Text
          style={[
            shared.muted,
            {
              marginTop:
                5,
            },
          ]}
        >
          This message appears on the Home dashboard for members.
        </Text>


        {loading ? (

          <View
            style={{
              paddingVertical:
                30,
            }}
          >

            <ActivityIndicator
              color={
                colors.green
              }
            />

          </View>

        ) : (

          <Card>

            <Text
              style={
                styles.label
              }
            >
              TITLE
            </Text>


            <TextInput
              value={
                title
              }

              onChangeText={
                setTitle
              }

              maxLength={
                150
              }

              placeholder="Important Reminder"

              style={
                styles.input
              }
            />


            <Text
              style={
                styles.label
              }
            >
              MESSAGE
            </Text>


            <TextInput
              value={
                body
              }

              onChangeText={
                setBody
              }

              maxLength={
                3000
              }

              multiline

              textAlignVertical="top"

              placeholder="Write the reminder..."

              style={[
                styles.input,
                styles.bodyInput,
              ]}
            />


            <View
              style={
                styles.switchRow
              }
            >

              <View
                style={{
                  flex:
                    1,
                }}
              >

                <Text
                  style={
                    styles.switchTitle
                  }
                >
                  ACTIVE
                </Text>


                <Text
                  style={
                    shared.muted
                  }
                >
                  Turn off to temporarily hide the reminder.
                </Text>

              </View>


              <Switch
                value={
                  active
                }

                onValueChange={
                  setActive
                }
              />

            </View>


            <View
              style={{
                marginTop:
                  16,

                gap:
                  9,
              }}
            >

              <Button
                title={
                  saving
                    ? 'SAVING...'
                    : 'SAVE IMPORTANT REMINDER'
                }

                onPress={
                  save
                }
              />


              <Button
                title="BACK TO HOME"
                outline

                onPress={() =>
                  router.back()
                }
              />

            </View>

          </Card>

        )}

      </ScrollView>

    </AdminGate>

  );

}


const styles =
  StyleSheet.create({

    content: {

      padding:
        18,

      paddingBottom:
        50,

      paddingLeft: 0,
      marginLeft: 0,
      paddingStart: 0,
      marginStart: 0,
    },


    eyebrow: {

      fontSize:
        10,

      fontWeight:
        '900',

      letterSpacing:
        0.8,

      color:
        colors.greenDark,

      marginBottom:
        4,

    },


    label: {

      marginTop:
        12,

      marginBottom:
        5,

      fontSize:
        9,

      fontWeight:
        '900',

      letterSpacing:
        0.6,

      color:
        colors.greenDark,

    },


    input: {

      borderWidth:
        1,

      borderColor:
        colors.line,

      borderRadius:
        12,

      backgroundColor:
        colors.white,

      paddingHorizontal:
        12,

      paddingVertical:
        11,

      color:
        colors.text,

    },


    bodyInput: {

      minHeight:
        160,

    },


    switchRow: {

      marginTop:
        15,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        12,

      padding:
        12,

      borderRadius:
        12,

      backgroundColor:
        '#F5F7F5',

    },


    switchTitle: {

      fontSize:
        10,

      fontWeight:
        '900',

      color:
        colors.text,

      marginBottom:
        3,

    },

  });
