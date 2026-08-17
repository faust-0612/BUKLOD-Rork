/**
 * PATCH 153D-2
 * DEVOTIONAL SERIES MANAGEMENT
 *
 * - Create series
 * - Edit existing title
 * - Edit existing description
 * - Publish / unpublish
 * - Preserve existing lessons and assignments
 */

import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  Alert,
  FlatList,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AdminGate } from '@/components/AdminGate';

import {
  Button,
  Card,
  SectionTitle,
  shared,
} from '@/components/UI';

import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';


type DevotionalSeries = {
  id: string;
  title: string;
  description: string | null;
  is_published: boolean;
  created_at: string;
  updated_at?: string | null;
};


export default function SeriesManager() {

  const [
    items,
    setItems,
  ] =
    useState<DevotionalSeries[]>([]);


  const [
    editingId,
    setEditingId,
  ] =
    useState<string | null>(
      null
    );


  const [
    title,
    setTitle,
  ] =
    useState('');


  const [
    description,
    setDescription,
  ] =
    useState('');


  const [
    published,
    setPublished,
  ] =
    useState(false);


  const [
    saving,
    setSaving,
  ] =
    useState(false);


  const [
    loading,
    setLoading,
  ] =
    useState(true);


  const load =
    useCallback(
      async () => {

        const {
          data,
          error,
        } =
          await supabase
            .from(
              'devotional_series'
            )
            .select(
              [
                'id',
                'title',
                'description',
                'is_published',
                'created_at',
                'updated_at',
              ].join(',')
            )
            .order(
              'created_at',
              {
                ascending:
                  false,
              }
            );


        if (error) {

          Alert.alert(
            'Devotional Series',
            error.message
          );

          return;
        }


        setItems(
          (
            data ??
            []
          ) as unknown as DevotionalSeries[]
        );
      },
      []
    );


  useEffect(() => {

    load()
      .finally(
        () =>
          setLoading(false)
      );

  }, [load]);


  const clearForm =
    () => {

      setEditingId(null);
      setTitle('');
      setDescription('');
      setPublished(false);
    };


  const beginEdit =
    (
      item: DevotionalSeries
    ) => {

      /*
       * PATCH_153D_2_EDIT_EXISTING
       *
       * Editing metadata does NOT touch:
       * - devotional lessons
       * - lesson order
       * - member assignments
       * - completion history
       */

      setEditingId(
        item.id
      );

      setTitle(
        item.title
      );

      setDescription(
        item.description ??
        ''
      );

      setPublished(
        item.is_published
      );
    };


  const save =
    async () => {

      const cleanTitle =
        title.trim();

      const cleanDescription =
        description.trim();


      if (!cleanTitle) {

        Alert.alert(
          'Devotional Series',
          'Series title is required.'
        );

        return;
      }


      setSaving(true);


      try {

        if (editingId) {

          /*
           * PATCH_153D_2_UPDATE_SERIES
           */

          const {
            error,
          } =
            await supabase
              .from(
                'devotional_series'
              )
              .update({
                title:
                  cleanTitle,

                description:
                  cleanDescription ||
                  null,

                is_published:
                  published,

                updated_at:
                  new Date()
                    .toISOString(),
              })
              .eq(
                'id',
                editingId
              );


          if (error) {
            throw error;
          }


          Alert.alert(
            'Series Updated',
            'The devotional series information has been updated.'
          );

        } else {

          /*
           * PATCH_153D_2_CREATE_SERIES
           */

          const {
            error,
          } =
            await supabase
              .from(
                'devotional_series'
              )
              .insert({
                title:
                  cleanTitle,

                description:
                  cleanDescription ||
                  null,

                is_published:
                  published,
              });


          if (error) {
            throw error;
          }


          Alert.alert(
            'Series Created',
            'The new devotional series has been created.'
          );
        }


        clearForm();

        await load();

      } catch (
        e: any
      ) {

        Alert.alert(
          editingId
            ? 'Could Not Update Series'
            : 'Could Not Create Series',
          e?.message ??
            'Please try again.'
        );

      } finally {

        setSaving(false);
      }
    };


  const toggle =
    async (
      item: DevotionalSeries
    ) => {

      const next =
        !item.is_published;


      const {
        error,
      } =
        await supabase
          .from(
            'devotional_series'
          )
          .update({
            is_published:
              next,

            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            'id',
            item.id
          );


      if (error) {

        Alert.alert(
          'Update Failed',
          error.message
        );

        return;
      }


      /*
       * Keep current edit form synchronized
       * if this same series is being edited.
       */
      if (
        editingId ===
        item.id
      ) {
        setPublished(
          next
        );
      }


      await load();
    };


  return (
    <AdminGate>

      <FlatList
        style={
          shared.screen
        }

        contentContainerStyle={[
          shared.content,
          styles.content,
        ]}

        data={
          items
        }

        keyExtractor={
          item =>
            item.id
        }

        ListHeaderComponent={
          <View>

            <Text style={shared.h1}>
              Devotional Series
            </Text>


            <Text
              style={[
                shared.muted,
                styles.intro,
              ]}
            >
              Create and maintain the title, description, and publication status of each Devotional Series.
            </Text>


            <SectionTitle>
              {
                editingId
                  ? 'EDIT SERIES'
                  : 'NEW SERIES'
              }
            </SectionTitle>


            <Card>

              {!!editingId && (
                <View
                  style={
                    styles.editNotice
                  }
                >
                  <Text
                    style={
                      styles.editNoticeLabel
                    }
                  >
                    EDITING EXISTING SERIES
                  </Text>

                  <Text
                    style={
                      styles.editNoticeText
                    }
                  >
                    Changes here affect series information only. Existing lessons, assignments, and member progress remain intact.
                  </Text>
                </View>
              )}


              <Text
                style={
                  styles.label
                }
              >
                SERIES TITLE
              </Text>

              <TextInput
                style={
                  styles.input
                }
                placeholder="Series title"
                value={title}
                onChangeText={
                  setTitle
                }
              />


              <Text
                style={
                  styles.label
                }
              >
                DESCRIPTION
              </Text>

              <TextInput
                style={[
                  styles.input,
                  styles.descriptionInput,
                ]}
                multiline
                placeholder="Describe the purpose and focus of this devotional series."
                value={
                  description
                }
                onChangeText={
                  setDescription
                }
              />


              <View
                style={
                  styles.publishRow
                }
              >

                <View
                  style={{
                    flex: 1,
                  }}
                >
                  <Text
                    style={
                      styles.publishTitle
                    }
                  >
                    Publish Series
                  </Text>

                  <Text
                    style={
                      shared.muted
                    }
                  >
                    Published series may be assigned to members.
                  </Text>
                </View>


                <Switch
                  value={
                    published
                  }
                  onValueChange={
                    setPublished
                  }
                />

              </View>


              <View
                style={{
                  height: 12,
                }}
              />


              <Button
                title={
                  saving
                    ? 'SAVING...'
                    : editingId
                    ? 'SAVE CHANGES'
                    : 'CREATE SERIES'
                }
                onPress={
                  save
                }
              />


              {!!editingId && (
                <View
                  style={{
                    marginTop: 8,
                  }}
                >
                  <Button
                    title="CANCEL EDITING"
                    outline
                    onPress={
                      clearForm
                    }
                  />
                </View>
              )}

            </Card>


            <SectionTitle>
              ALL SERIES
            </SectionTitle>


            {!loading &&
              items.length ===
                0 && (
              <Card>
                <Text
                  style={
                    shared.muted
                  }
                >
                  No Devotional Series created yet.
                </Text>
              </Card>
            )}

          </View>
        }


        renderItem={({
          item,
        }) => (

          <Card>

            <View
              style={
                styles.seriesHeader
              }
            >

              <View
                style={{
                  flex: 1,
                }}
              >

                <View
                  style={
                    styles.statusRow
                  }
                >

                  <Text
                    style={
                      item.is_published
                        ? styles.published
                        : styles.draft
                    }
                  >
                    {
                      item.is_published
                        ? 'PUBLISHED'
                        : 'DRAFT'
                    }
                  </Text>

                </View>


                <Text
                  style={[
                    shared.h2,
                    {
                      marginTop: 5,
                    },
                  ]}
                >
                  {item.title}
                </Text>


                <Text
                  style={[
                    shared.muted,
                    {
                      marginTop: 5,
                      lineHeight: 18,
                    },
                  ]}
                >
                  {
                    item.description ||
                    'No description'
                  }
                </Text>

              </View>


              <Switch
                value={
                  item.is_published
                }
                onValueChange={
                  () =>
                    toggle(item)
                }
              />

            </View>


            <View
              style={
                styles.actions
              }
            >

              <Button
                title="EDIT SERIES"
                outline
                onPress={
                  () =>
                    beginEdit(item)
                }
              />

            </View>

          </Card>
        )}
      />

    </AdminGate>
  );
}


const styles =
  StyleSheet.create({

    content: {
      paddingBottom: 50,
    },


    intro: {
      marginTop: 5,
      marginBottom: 12,
      lineHeight: 18,
    },


    label: {
      marginBottom: 5,
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0.5,
      color:
        colors.greenDark,
    },


    input: {
      borderWidth: 1,
      borderColor:
        colors.line,
      borderRadius: 12,
      padding: 12,
      backgroundColor:
        colors.white,
      marginBottom: 12,
      color:
        colors.text,
    },


    descriptionInput: {
      minHeight: 95,
      textAlignVertical:
        'top',
    },


    publishRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 4,
    },


    publishTitle: {
      fontSize: 13,
      fontWeight: '900',
      color:
        colors.text,
    },


    editNotice: {
      marginBottom: 14,
      padding: 11,
      borderRadius: 11,
      backgroundColor:
        colors.greenSoft,
    },


    editNoticeLabel: {
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0.6,
      color:
        colors.greenDark,
    },


    editNoticeText: {
      marginTop: 4,
      fontSize: 10,
      lineHeight: 16,
      color:
        colors.muted,
    },


    seriesHeader: {
      flexDirection: 'row',
      alignItems:
        'flex-start',
      gap: 12,
    },


    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },


    published: {
      paddingHorizontal: 7,
      paddingVertical: 4,
      borderRadius: 7,
      overflow: 'hidden',
      backgroundColor:
        colors.greenSoft,
      color:
        colors.greenDark,
      fontSize: 8,
      fontWeight: '900',
    },


    draft: {
      paddingHorizontal: 7,
      paddingVertical: 4,
      borderRadius: 7,
      overflow: 'hidden',
      backgroundColor:
        '#F1F2F1',
      color:
        colors.muted,
      fontSize: 8,
      fontWeight: '900',
    },


    actions: {
      marginTop: 14,
    },
  });