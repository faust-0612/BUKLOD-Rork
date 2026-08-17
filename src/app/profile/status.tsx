import {
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  Stack,
  useRouter,
} from 'expo-router';

import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';


export default function ProfileStatusScreen() {
  const router =
    useRouter();

  const [
    userId,
    setUserId,
  ] =
    useState('');

  const [
    note,
    setNote,
  ] =
    useState('');

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
    loadError,
    setLoadError,
  ] =
    useState('');


  useEffect(() => {
    let active = true;

    void (
      async () => {
        try {
          setLoading(true);
          setLoadError('');

          const {
            data: authData,
            error: authError,
          } =
            await supabase.auth.getUser();

          if (
            !active
          ) {
            return;
          }

          if (
            authError ||
            !authData.user?.id
          ) {
            throw new Error(
              authError?.message ||
              'Please sign in again.'
            );
          }

          const uid =
            authData.user.id;

          setUserId(
            uid
          );

          const {
            data,
            error,
          } =
            await (
              supabase as any
            )
              .from(
                'buklod_profile_status'
              )
              .select(
                'quick_note'
              )
              .eq(
                'user_id',
                uid
              )
              .maybeSingle();

          if (
            !active
          ) {
            return;
          }

          if (error) {
            throw error;
          }

          setNote(
            String(
              data?.quick_note ??
              ''
            )
          );
        } catch (
          error: any
        ) {
          if (active) {
            setLoadError(
              error?.message ||
              'Unable to load your Profile Note.'
            );
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      }
    )();

    return () => {
      active = false;
    };
  }, []);


  const save =
    async () => {
      if (
        !userId ||
        saving
      ) {
        return;
      }

      setSaving(true);

      try {
        const payload = {
          user_id:
            userId,

          quick_note:
            note
              .trim()
              .slice(
                0,
                160
              ) ||
            null,

          // Music feature removed.
          // Clear any old profile-music reference
          // when this user saves the Note.
          music_library_id:
            null,

          music_title:
            null,

          music_path:
            null,

          music_mime_type:
            null,

          updated_at:
            new Date()
              .toISOString(),
        };

        const {
          error,
        } =
          await (
            supabase as any
          )
            .from(
              'buklod_profile_status'
            )
            .upsert(
              payload,
              {
                onConflict:
                  'user_id',
              }
            );

        if (error) {
          throw error;
        }

        router.back();
      } catch (
        error: any
      ) {
        Alert.alert(
          'Could Not Save',
          error?.message ||
          'Unable to save your Profile Note.'
        );
      } finally {
        setSaving(false);
      }
    };


  if (loading) {
    return (
      <SafeAreaView
        style={
          styles.screen
        }
      >
        <Stack.Screen
          options={{
            title:
              'Profile Note',
          }}
        />

        <View
          style={
            styles.center
          }
        >
          <ActivityIndicator />

          <Text
            style={
              styles.muted
            }
          >
            Loading Profile Note...
          </Text>
        </View>
      </SafeAreaView>
    );
  }


  return (
    <SafeAreaView
      style={
        styles.screen
      }
    >
      <Stack.Screen
        options={{
          title:
            'Profile Note',
        }}
      />

      <ScrollView
        contentContainerStyle={
          styles.content
        }
        keyboardShouldPersistTaps="handled"
      >
        <Text
          style={
            styles.heading
          }
        >
          Profile Note
        </Text>

        <Text
          style={
            styles.help
          }
        >
          Write a short note that appears beside your Profile picture.
        </Text>

        <TextInput
          value={note}
          onChangeText={
            setNote
          }
          placeholder="Write a short profile note..."
          multiline
          maxLength={160}
          style={
            styles.noteInput
          }
        />

        <Text
          style={
            styles.counter
          }
        >
          {note.length}/160
        </Text>

        {!!loadError && (
          <Text
            style={
              styles.error
            }
          >
            {loadError}
          </Text>
        )}

        <Pressable
          disabled={
            saving
          }
          onPress={() =>
            void save()
          }
          style={[
            styles.saveButton,
            saving &&
              styles.disabled,
          ]}
        >
          <Text
            style={
              styles.saveText
            }
          >
            {saving
              ? 'Saving...'
              : 'Save Profile Note'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}


const styles =
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor:
        '#F7F9F7',
    },

    content: {
      padding:
        18,
      paddingBottom:
        40,
    },

    center: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
      gap:
        10,
    },

    heading: {
      fontSize:
        18,
      fontWeight:
        '900',
      color:
        colors.text,
    },

    help: {
      marginTop:
        5,
      marginBottom:
        12,
      fontSize:
        12,
      lineHeight:
        17,
      color:
        '#5C675E',
    },

    noteInput: {
      minHeight:
        112,
      borderWidth:
        1,
      borderColor:
        colors.line,
      borderRadius:
        14,
      padding:
        14,
      textAlignVertical:
        'top',
      fontSize:
        15,
      lineHeight:
        21,
      color:
        colors.text,
      backgroundColor:
        '#FFFFFF',
    },

    counter: {
      marginTop:
        5,
      textAlign:
        'right',
      fontSize:
        11,
      color:
        '#718078',
    },

    error: {
      marginTop:
        12,
      padding:
        10,
      borderRadius:
        10,
      fontSize:
        12,
      color:
        '#9B2C2C',
      backgroundColor:
        '#FFF1F1',
    },

    saveButton: {
      marginTop:
        18,
      minHeight:
        48,
      borderRadius:
        14,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.greenDark,
    },

    saveText: {
      fontSize:
        14,
      fontWeight:
        '900',
      color:
        '#FFFFFF',
    },

    disabled: {
      opacity:
        0.55,
    },

    muted: {
      fontSize:
        12,
      color:
        '#68736B',
    },
  });