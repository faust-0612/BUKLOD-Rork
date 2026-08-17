/* PATCH_161C1_MISSION_BULLETIN_PHOTO */
import {
  decode as decodeBulletinMedia,
} from 'base64-arraybuffer';

import {
  Image as AdminBulletinImage,
} from 'expo-image';

import {
  Pressable as BulletinPhotoPressable,
} from 'react-native';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import {
  Button,
  Card,
  SectionTitle,
  shared,
} from '@/components/UI';

import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/lib/theme';

type Church = {
  church_id: string;
  church_name: string;
  church_code: string | null;
};

type Bulletin = {
  id: string;
  church_id: string | null;
  author_id: string;
  title: string;
  body: string;
  media_path: string | null;
  priority: number;
  is_pinned: boolean;
  is_published: boolean;
  starts_at: string;
  expires_at: string | null;
  created_at: string;
  church?: { name: string } | { name: string }[] | null;
};

function churchName(
  church: Bulletin['church']
) {
  if (!church) return null;

  if (Array.isArray(church)) {
    return church[0]?.name ?? null;
  }

  return church.name ?? null;
}

export default function MissionBulletinsScreen() {

  const [
    bulletinPhoto,
    setBulletinPhoto,
  ] =
    useState<{
      uri: string;
      base64: string;
    } | null>(
      null
    );


  const [
    bulletinPhotoBusy,
    setBulletinPhotoBusy,
  ] =
    useState(false);


  const [
    bulletinRemovePhoto,
    setBulletinRemovePhoto,
  ] =
    useState(false);


  const pickBulletinPhoto =
    async () => {

      try {

        setBulletinPhotoBusy(
          true
        );


        const ImagePicker =
          await import(
            'expo-image-picker'
          );


        const ImageManipulator =
          await import(
            'expo-image-manipulator'
          );


        const permission =
          await ImagePicker
            .requestMediaLibraryPermissionsAsync();


        if (
          !permission.granted
        ) {

          Alert.alert(
            'Photo Permission',
            'Please allow BUKLOD to access your photos.'
          );

          return;
        }


        const result =
          await ImagePicker
            .launchImageLibraryAsync({
              mediaTypes:
                ['images'] as any,
              allowsEditing:
                true,
              quality:
                0.9,
              base64:
                true,
            });


        if (
          result.canceled ||
          !result.assets?.[0]
        ) {
          return;
        }


        const prepared =
          await ImageManipulator
            .manipulateAsync(
              result.assets[0].uri,
              [
                {
                  resize: {
                    width:
                      1600,
                  },
                },
              ],
              {
                compress:
                  0.8,
                format:
                  ImageManipulator
                    .SaveFormat
                    .JPEG,
                base64:
                  true,
              }
            );


        if (
          !prepared.base64
        ) {

          throw new Error(
            'Could not prepare the selected photo.'
          );
        }


        setBulletinPhoto({
          uri:
            prepared.uri,
          base64:
            prepared.base64,
        });


        setBulletinRemovePhoto(
          false
        );

      } catch (
        error: any
      ) {

        Alert.alert(
          'Mission Bulletin Photo',
          error?.message ||
            'Could not select the photo.'
        );

      } finally {

        setBulletinPhotoBusy(
          false
        );

      }

    };


  const {
    profile,
    hasRole,
  } = useAuth();

  const isSystemAdmin =
    hasRole('system_admin');

  const canManage =
    isSystemAdmin ||
    hasRole('pastor') ||
    hasRole('local_admin');

  const db = supabase as any;

  const [churches, setChurches] =
    useState<Church[]>([]);

  const [rows, setRows] =
    useState<Bulletin[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [busy, setBusy] =
    useState(false);

  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [churchId, setChurchId] =
    useState<string | null>(null);

  const [title, setTitle] =
    useState('');

  const [body, setBody] =
    useState('');

  const [priority, setPriority] =
    useState('50');

  const [isPinned, setIsPinned] =
    useState(true);

  const [
    isPublished,
    setIsPublished,
  ] = useState(true);

  const [startsAt, setStartsAt] =
    useState(
      new Date().toISOString()
    );

  const [expiresAt, setExpiresAt] =
    useState('');

  const selectedChurch =
    useMemo(
      () =>
        churches.find(
          (item) =>
            item.church_id === churchId
        ) ?? null,
      [churches, churchId]
    );

  const resetForm = useCallback(() => {
    setEditingId(null);
    setBulletinPhoto(null);
    setBulletinRemovePhoto(false);

    setChurchId(
      isSystemAdmin
        ? null
        : churches[0]?.church_id ??
            null
    );

    setTitle('');
    setBody('');
    setPriority('50');
    setIsPinned(true);
    setIsPublished(true);

    setStartsAt(
      new Date().toISOString()
    );

    setExpiresAt('');
  }, [
    churches,
    isSystemAdmin,
  ]);

  const load = useCallback(
    async () => {
      if (!canManage) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const [
          churchResult,
          bulletinResult,
        ] = await Promise.all([
          db.rpc(
            'get_my_manageable_churches'
          ),

          db
            .from('mission_bulletins')
            .select(
              'id,church_id,author_id,title,body,media_path,priority,is_pinned,is_published,starts_at,expires_at,created_at,church:church_id(name)'
            )
            .order('is_pinned', {
              ascending: false,
            })
            .order('priority', {
              ascending: false,
            })
            .order('created_at', {
              ascending: false,
            }),
        ]);

        if (churchResult.error) {
          throw churchResult.error;
        }

        if (bulletinResult.error) {
          throw bulletinResult.error;
        }

        const loadedChurches =
          (churchResult.data ??
            []) as Church[];

        setChurches(
          loadedChurches
        );

        setRows(
          (bulletinResult.data ??
            []) as Bulletin[]
        );

        if (
          !isSystemAdmin &&
          !churchId &&
          loadedChurches.length > 0
        ) {
          setChurchId(
            loadedChurches[0].church_id
          );
        }
      } catch (error: any) {
        Alert.alert(
          'Mission Bulletin',
          error?.message ||
            'Mission Bulletin database is not available yet. Apply Patch 153A migration when ready.'
        );
      } finally {
        setLoading(false);
      }
    },
    [
      canManage,
      churchId,
      db,
      isSystemAdmin,
    ]
  );

  useEffect(() => {
    load();
  }, [load]);

  if (!canManage) {
    return (
      <View
        style={[
          shared.screen,
          styles.center,
        ]}
      >
        <Card>
          <Text style={shared.h1}>
            Mission Bulletin
          </Text>

          <Text
            style={[
              shared.muted,
              {
                marginTop: 7,
              },
            ]}
          >
            Pastor or Admin access is
            required.
          </Text>

          <View
            style={{
              marginTop: 14,
            }}
          >
            <Button
              title="BACK"
              outline
              onPress={() =>
                router.back()
              }
            />
          </View>
        </Card>
      </View>
    );
  }

  const save = async () => {
    if (!profile?.id) return;

    if (!title.trim()) {
      return Alert.alert(
        'Mission Bulletin',
        'Title is required.'
      );
    }

    if (!body.trim()) {
      return Alert.alert(
        'Mission Bulletin',
        'Bulletin message is required.'
      );
    }

    if (
      !isSystemAdmin &&
      !churchId
    ) {
      return Alert.alert(
        'Mission Bulletin',
        'Select one of your assigned Locals.'
      );
    }

    const priorityNumber =
      Number(priority);

    if (
      !Number.isFinite(
        priorityNumber
      ) ||
      priorityNumber < 0 ||
      priorityNumber > 100
    ) {
      return Alert.alert(
        'Priority',
        'Priority must be from 0 to 100.'
      );
    }

    if (
      Number.isNaN(
        Date.parse(startsAt)
      )
    ) {
      return Alert.alert(
        'Start Date',
        'Use a valid ISO date/time.'
      );
    }

    if (
      expiresAt.trim() &&
      Number.isNaN(
        Date.parse(expiresAt)
      )
    ) {
      return Alert.alert(
        'Expiration Date',
        'Use a valid ISO date/time or leave it blank.'
      );
    }

    if (
      expiresAt.trim() &&
      Date.parse(expiresAt) <=
        Date.parse(startsAt)
    ) {
      return Alert.alert(
        'Expiration Date',
        'Expiration must be after the start date.'
      );
    }

    setBusy(true);

    let previousMediaPath:
      string | null =
      null;

    let uploadedMediaPath:
      string | null =
      null;

    try {

      if (
        editingId
      ) {

        const {
          data:
            currentMedia,
          error:
            currentMediaError,
        } =
          await db
            .from(
              'mission_bulletins'
            )
            .select(
              'media_path'
            )
            .eq(
              'id',
              editingId
            )
            .maybeSingle();


        if (
          currentMediaError
        ) {
          throw currentMediaError;
        }


        previousMediaPath =
          currentMedia
            ?.media_path ??
          null;

      }


      let nextMediaPath:
        string | null =
        bulletinRemovePhoto
          ? null
          : previousMediaPath;


      if (
        bulletinPhoto
      ) {

        if (
          !profile?.id
        ) {
          throw new Error(
            'Your profile is unavailable.'
          );
        }


        uploadedMediaPath =
          'mission/' +
          profile.id +
          '/' +
          Date.now() +
          '-' +
          Math.random()
            .toString(36)
            .slice(2) +
          '.jpg';


        const {
          error:
            uploadError,
        } =
          await supabase
            .storage
            .from(
              'bulletin-media'
            )
            .upload(
              uploadedMediaPath,
              decodeBulletinMedia(
                bulletinPhoto.base64
              ),
              {
                contentType:
                  'image/jpeg',
                cacheControl:
                  '3600',
                upsert:
                  false,
              }
            );


        if (
          uploadError
        ) {
          throw uploadError;
        }


        nextMediaPath =
          uploadedMediaPath;

      }


      const values = {
        media_path:
          nextMediaPath,
        church_id: churchId,
        title: title.trim(),
        body: body.trim(),
        priority: priorityNumber,
        is_pinned: isPinned,
        is_published:
          isPublished,
        starts_at:
          new Date(
            startsAt
          ).toISOString(),
        expires_at:
          expiresAt.trim()
            ? new Date(
                expiresAt
              ).toISOString()
            : null,
      };

      if (editingId) {
        const { error } = await db
          .from(
            'mission_bulletins'
          )
          .update(values)
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const { error } = await db
          .from(
            'mission_bulletins'
          )
          .insert({
            ...values,
            author_id:
              profile.id,
          });

        if (error) throw error;
      }

      if (
        previousMediaPath &&
        previousMediaPath !==
          nextMediaPath
      ) {

        await supabase
          .storage
          .from(
            'bulletin-media'
          )
          .remove([
            previousMediaPath,
          ]);

      }


      Alert.alert(
        'Mission Bulletin',
        editingId
          ? 'Bulletin updated.'
          : 'Bulletin created.'
      );

      resetForm();

      setBulletinPhoto(
        null
      );

      setBulletinRemovePhoto(
        false
      );

      await load();
    } catch (error: any) {

      if (
        uploadedMediaPath
      ) {

        await supabase
          .storage
          .from(
            'bulletin-media'
          )
          .remove([
            uploadedMediaPath,
          ]);

      }


      Alert.alert(
        'Could not save bulletin',
        error?.message ||
          'Please try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  const edit = (
    item: Bulletin
  ) => {
    setEditingId(item.id);
    setBulletinPhoto(null);
    setBulletinRemovePhoto(false);
    setChurchId(item.church_id);
    setTitle(item.title);
    setBody(item.body);

    setPriority(
      String(
        item.priority ?? 0
      )
    );

    setIsPinned(
      item.is_pinned
    );

    setIsPublished(
      item.is_published
    );

    setStartsAt(
      item.starts_at
    );

    setExpiresAt(
      item.expires_at ?? ''
    );
  };

  const remove = (
    item: Bulletin
  ) => {
    Alert.alert(
      'Delete Mission Bulletin?',
      item.title,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } =
              await db
                .from(
                  'mission_bulletins'
                )
                .delete()
                .eq(
                  'id',
                  item.id
                );

            if (error) {
              return Alert.alert(
                'Could not delete',
                error.message
              );
            }

            if (
              editingId ===
              item.id
            ) {
              resetForm();
            }

            await load();
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={shared.screen}
      contentContainerStyle={
        styles.content
      }
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.eyebrow}>
        HOME COMMUNICATION
      </Text>

      <Text style={shared.h1}>
        Mission Bulletin
      </Text>

      <Text
        style={[
          shared.muted,
          {
            marginTop: 5,
          },
        ]}
      >
        Create official updates that
        appear prominently on the BUKLOD
        Home screen.
      </Text>

      <SectionTitle>
        BULLETIN SCOPE
      </SectionTitle>

      <Card>
        {isSystemAdmin && (
          <Pressable
            style={[
              styles.choice,
              churchId === null &&
                styles.choiceOn,
            ]}
            onPress={() =>
              setChurchId(null)
            }
          >
            <View style={{ flex: 1 }}>
              <Text
                style={
                  styles.choiceTitle
                }
              >
                SYSTEM-WIDE
              </Text>

              <Text
                style={
                  shared.muted
                }
              >
                Visible to all BUKLOD
                members.
              </Text>
            </View>

            {churchId === null && (
              <Text
                style={
                  styles.selected
                }
              >
                SELECTED
              </Text>
            )}
          </Pressable>
        )}

        {churches.map(
          (church) => (
            <Pressable
              key={
                church.church_id
              }
              style={[
                styles.choice,
                churchId ===
                  church.church_id &&
                  styles.choiceOn,
              ]}
              onPress={() =>
                setChurchId(
                  church.church_id
                )
              }
            >
              <View
                style={{
                  flex: 1,
                }}
              >
                <Text
                  style={
                    styles.choiceTitle
                  }
                >
                  {
                    church.church_name
                  }
                </Text>

                {!!church.church_code && (
                  <Text
                    style={
                      shared.muted
                    }
                  >
                    {
                      church.church_code
                    }
                  </Text>
                )}
              </View>

              {churchId ===
                church.church_id && (
                <Text
                  style={
                    styles.selected
                  }
                >
                  SELECTED
                </Text>
              )}
            </Pressable>
          )
        )}

        {!loading &&
          churches.length ===
            0 &&
          !isSystemAdmin && (
            <Text
              style={
                shared.muted
              }
            >
              No active Local assignment
              is available for this
              account.
            </Text>
          )}
      </Card>

      <SectionTitle>
        {editingId
          ? 'EDIT BULLETIN'
          : 'CREATE BULLETIN'}
      </SectionTitle>

      <Card>
        <Text style={styles.label}>
          AUDIENCE
        </Text>

        <Text
          style={
            styles.scopeValue
          }
        >
          {churchId === null
            ? 'System-wide'
            : selectedChurch
                ?.church_name ||
              'Local Church'}
        </Text>

        <Text style={styles.label}>
          TITLE
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Mission bulletin title"
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.label}>
          MESSAGE
        </Text>

        <TextInput
          style={[
            styles.input,
            styles.area,
          ]}
          placeholder="Write the official mission update..."
          multiline
          value={body}
          onChangeText={setBody}
        />

            {/* PATCH_161C1_BULLETIN_PHOTO_CONTROLS */}

            <View
              style={{
                marginTop: 12,
                marginBottom: 6,
              }}
            >

              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '900',
                  color: colors.green,
                  marginBottom: 7,
                }}
              >
                BULLETIN PHOTO
              </Text>


              {!!bulletinPhoto && (

                <AdminBulletinImage
                  source={{
                    uri:
                      bulletinPhoto.uri,
                  }}
                  style={{
                    width: '100%',
                    aspectRatio: 16 / 9,
                    borderRadius: 14,
                    marginBottom: 9,
                  }}
                  contentFit="cover"
                />

              )}


              {!bulletinPhoto &&
                editingId &&
                rows.find(
                  (row) =>
                    row.id ===
                    editingId
                )?.media_path &&
                !bulletinRemovePhoto && (

                <View
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    backgroundColor: '#F0FDF4',
                    marginBottom: 8,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      color: colors.greenDark,
                      fontWeight: '700',
                    }}
                  >
                    Current bulletin has a photo attached.
                  </Text>
                </View>

              )}


              {bulletinRemovePhoto && (

                <View
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    backgroundColor: '#FEF2F2',
                    marginBottom: 8,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      color: '#B91C1C',
                      fontWeight: '800',
                    }}
                  >
                    The current photo will be removed when you save.
                  </Text>
                </View>

              )}


              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >

                <BulletinPhotoPressable
                  disabled={
                    bulletinPhotoBusy
                  }
                  onPress={() =>
                    void pickBulletinPhoto()
                  }
                  style={{
                    backgroundColor:
                      colors.green,
                    paddingHorizontal: 13,
                    paddingVertical: 10,
                    borderRadius: 10,
                  }}
                >
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontWeight: '900',
                      fontSize: 12,
                    }}
                  >
                    {bulletinPhotoBusy
                      ? 'PREPARING...'
                      : bulletinPhoto
                        ? 'CHANGE PHOTO'
                        : 'ADD PHOTO'}
                  </Text>
                </BulletinPhotoPressable>


                {(bulletinPhoto ||
                  (
                    editingId &&
                    rows.find(
                      (row) =>
                        row.id ===
                        editingId
                    )?.media_path
                  )) && (

                  <BulletinPhotoPressable
                    onPress={() => {

                      setBulletinPhoto(
                        null
                      );

                      setBulletinRemovePhoto(
                        true
                      );

                    }}
                    style={{
                      borderWidth: 1,
                      borderColor: '#DC2626',
                      paddingHorizontal: 13,
                      paddingVertical: 10,
                      borderRadius: 10,
                    }}
                  >
                    <Text
                      style={{
                        color: '#B91C1C',
                        fontWeight: '900',
                        fontSize: 12,
                      }}
                    >
                      REMOVE PHOTO
                    </Text>
                  </BulletinPhotoPressable>

                )}


                {bulletinRemovePhoto && (

                  <BulletinPhotoPressable
                    onPress={() =>
                      setBulletinRemovePhoto(
                        false
                      )
                    }
                    style={{
                      paddingHorizontal: 13,
                      paddingVertical: 10,
                    }}
                  >
                    <Text
                      style={{
                        color: '#6B7280',
                        fontWeight: '800',
                        fontSize: 12,
                      }}
                    >
                      KEEP CURRENT PHOTO
                    </Text>
                  </BulletinPhotoPressable>

                )}

              </View>

            </View>



        <Text style={styles.label}>
          PRIORITY 0–100
        </Text>

        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          placeholder="50"
          value={priority}
          onChangeText={setPriority}
        />

        <View style={styles.toggle}>
          <View style={{ flex: 1 }}>
            <Text
              style={
                styles.toggleTitle
              }
            >
              Pin Bulletin
            </Text>

            <Text
              style={
                shared.muted
              }
            >
              Pinned bulletins appear
              before ordinary updates.
            </Text>
          </View>

          <Switch
            value={isPinned}
            onValueChange={
              setIsPinned
            }
          />
        </View>

        <View style={styles.toggle}>
          <View style={{ flex: 1 }}>
            <Text
              style={
                styles.toggleTitle
              }
            >
              Published
            </Text>

            <Text
              style={
                shared.muted
              }
            >
              Turn off to keep this as
              a draft.
            </Text>
          </View>

          <Switch
            value={
              isPublished
            }
            onValueChange={
              setIsPublished
            }
          />
        </View>

        <Text style={styles.label}>
          STARTS AT
        </Text>

        <TextInput
          style={styles.input}
          value={startsAt}
          onChangeText={
            setStartsAt
          }
          autoCapitalize="none"
        />

        <Text
          style={[
            shared.muted,
            {
              marginTop: -3,
              marginBottom: 8,
            },
          ]}
        >
          ISO date/time. Current time is
          filled automatically.
        </Text>

        <Text style={styles.label}>
          EXPIRES AT — OPTIONAL
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Leave blank for no expiration"
          value={expiresAt}
          onChangeText={
            setExpiresAt
          }
          autoCapitalize="none"
        />

        <View
          style={{
            marginTop: 8,
          }}
        >
          <Button
            title={
              busy
                ? 'SAVING...'
                : editingId
                ? 'SAVE CHANGES'
                : 'PUBLISH BULLETIN'
            }
            onPress={save}
          />
        </View>

        {editingId && (
          <View
            style={{
              marginTop: 8,
            }}
          >
            <Button
              title="CANCEL EDITING"
              outline
              onPress={resetForm}
            />
          </View>
        )}
      </Card>

      <SectionTitle>
        EXISTING BULLETINS
      </SectionTitle>

      {loading && (
        <ActivityIndicator
          color={colors.green}
        />
      )}

      {!loading &&
        rows.length === 0 && (
          <Card>
            <Text
              style={
                shared.muted
              }
            >
              No Mission Bulletins yet.
            </Text>
          </Card>
        )}

      {rows.map((item) => {
        const localName =
          churchName(
            item.church
          );

        return (
          <Card key={item.id}>
            <Text
              style={
                styles.rowScope
              }
            >
              {item.church_id
                ? localName ||
                  'LOCAL'
                : 'SYSTEM-WIDE'}
            </Text>

            <Text
              style={[
                shared.h2,
                {
                  marginTop: 3,
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
                },
              ]}
              numberOfLines={4}
            >
              {item.body}
            </Text>

            <Text
              style={[
                shared.muted,
                {
                  marginTop: 8,
                },
              ]}
            >
              Priority{' '}
              {item.priority}
              {' • '}
              {item.is_pinned
                ? 'Pinned'
                : 'Normal'}
              {' • '}
              {item.is_published
                ? 'Published'
                : 'Draft'}
            </Text>

            <View
              style={
                styles.actions
              }
            >
              <View
                style={{
                  flex: 1,
                }}
              >
                <Button
                  title="EDIT"
                  outline
                  onPress={() =>
                    edit(item)
                  }
                />
              </View>

              <View
                style={{
                  flex: 1,
                }}
              >
                <Button
                  title="DELETE"
                  outline
                  onPress={() =>
                    remove(item)
                  }
                />
              </View>
            </View>
          </Card>
        );
      })}
    </ScrollView>
  );
}

const styles =
  StyleSheet.create({
    content: {
      padding: 18,
      paddingBottom: 50,
    },

    center: {
      justifyContent: 'center',
      padding: 20,
    },

    eyebrow: {
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1,
      color:
        colors.greenDark,
      marginBottom: 4,
    },

    label: {
      marginTop: 12,
      marginBottom: 5,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.7,
      color: colors.muted,
    },

    scopeValue: {
      fontSize: 16,
      fontWeight: '900',
      color:
        colors.greenDark,
    },

    input: {
      borderWidth: 1,
      borderColor:
        colors.line,
      borderRadius: 12,
      backgroundColor:
        colors.white,
      padding: 12,
      color: colors.text,
    },

    area: {
      minHeight: 130,
      textAlignVertical:
        'top',
    },

    choice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 11,
      borderRadius: 12,
      borderWidth: 1,
      borderColor:
        colors.line,
      marginBottom: 8,
    },

    choiceOn: {
      borderColor:
        colors.green,
      backgroundColor:
        '#F2F7F3',
    },

    choiceTitle: {
      fontWeight: '900',
      color: colors.text,
    },

    selected: {
      fontSize: 9,
      fontWeight: '900',
      color:
        colors.greenDark,
    },

    toggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 14,
      paddingVertical: 8,
    },

    toggleTitle: {
      fontWeight: '900',
      color: colors.text,
    },

    rowScope: {
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.7,
      color:
        colors.greenDark,
    },

    actions: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 12,
    },
  });