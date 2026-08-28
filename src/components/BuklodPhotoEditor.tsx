/* PATCH_186B_PHOTO_EDITOR */
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Image,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  Canvas,
  Path as SkiaPath,
  Skia,
  makeImageFromView,
} from '@shopify/react-native-skia';
import {
  File,
  Paths,
} from 'expo-file-system';
import * as ImageManipulator
  from 'expo-image-manipulator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Tool =
  | 'draw'
  | 'line'
  | 'highlight'
  | 'text'
  | 'emoji';

export type BuklodPhotoEditorTool = Tool;

type Point = {
  x: number;
  y: number;
};

type Stroke = {
  id: string;
  tool:
    | 'draw'
    | 'line'
    | 'highlight';
  points: Point[];
};

type EmojiSticker = {
  id: string;
  emoji: string;
  x: number;
  y: number;
};

const PHOTO_EDITOR_EMOJI = [
  '🙏',
  '❤️',
  '😊',
  '🎉',
  '✨',
  '😂',
  '👏',
  '🕊️',
  '🔥',
  '💯',
  '😍',
  '🙌',
] as const;

export type BuklodEditedPhoto = {
  uri: string;
  base64: string;
  sizeBytes: number;
  mimeType: 'image/jpeg';
};

type Props = {
  visible: boolean;
  sourceUri: string | null;
  initialTool?: BuklodPhotoEditorTool;
  onCancel: () => void;
  onDone: (
    result: BuklodEditedPhoto
  ) => void;
};

function makePath(
  stroke: Stroke
) {
  const path =
    Skia.Path.Make();

  const first =
    stroke.points[0];

  if (!first) {
    return path;
  }

  path.moveTo(
    first.x,
    first.y
  );

  if (
    stroke.tool ===
    'line'
  ) {
    const last =
      stroke.points[
        stroke.points.length -
          1
      ];

    path.lineTo(
      last?.x ??
        first.x,
      last?.y ??
        first.y
    );

    return path;
  }

  for (
    let i = 1;
    i <
    stroke.points.length;
    i++
  ) {
    const point =
      stroke.points[i];

    path.lineTo(
      point.x,
      point.y
    );
  }

  return path;
}

export function BuklodPhotoEditor({
  visible,
  sourceUri,
  initialTool = 'draw',
  onCancel,
  onDone,
}: Props) {
  /* UI_002_R9_R2_PHOTO_SAFE_AREA */
  const insets = useSafeAreaInsets();

  const {
    width:
      windowWidth,
    height:
      windowHeight,
  } =
    useWindowDimensions();

  const captureRef =
    useRef<View>(null);

  const activeStrokeIdRef =
    useRef<string | null>(
      null
    );

  const [
    tool,
    setTool,
  ] =
    useState<Tool>(
      'draw'
    );

  const [
    strokes,
    setStrokes,
  ] =
    useState<Stroke[]>([]);

  const [
    overlayText,
    setOverlayText,
  ] =
    useState('');

  const [
    emojiStickers,
    setEmojiStickers,
  ] =
    useState<EmojiSticker[]>([]);

  const [
    selectedEmoji,
    setSelectedEmoji,
  ] =
    useState<string>(
      PHOTO_EDITOR_EMOJI[0]
    );

  const [
    textPosition,
    setTextPosition,
  ] =
    useState<Point>({
      x: 24,
      y: 70,
    });

  const [
    aspect,
    setAspect,
  ] =
    useState(
      4 / 3
    );

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  useEffect(
    () => {
      if (
        !visible ||
        !sourceUri
      ) {
        return;
      }

      setTool(initialTool);
      setStrokes([]);
      setOverlayText('');
      setEmojiStickers([]);
      setSelectedEmoji(
        PHOTO_EDITOR_EMOJI[0]
      );
      setSaving(false);

      Image.getSize(
        sourceUri,
        (
          width,
          height
        ) => {
          if (
            width > 0 &&
            height > 0
          ) {
            setAspect(
              width /
                height
            );
          }
        },
        () => {
          setAspect(
            4 / 3
          );
        }
      );
    },
    [
      visible,
      sourceUri,
      initialTool,
    ]
  );

  const previewSize =
    useMemo(
      () => {
        const maxWidth =
          Math.min(
            Math.max(
              260,
              windowWidth -
                24
            ),
            720
          );

        const maxHeight =
          Math.max(
            260,
            windowHeight *
              0.58
          );

        let width =
          maxWidth;

        let height =
          width /
          Math.max(
            0.35,
            aspect
          );

        if (
          height >
          maxHeight
        ) {
          height =
            maxHeight;

          width =
            height *
            Math.max(
              0.35,
              aspect
            );
        }

        return {
          width:
            Math.max(
              180,
              width
            ),
          height:
            Math.max(
              180,
              height
            ),
        };
      },
      [
        aspect,
        windowHeight,
        windowWidth,
      ]
    );

  useEffect(
    () => {
      setTextPosition({
        x:
          previewSize
            .width *
          0.12,
        y:
          previewSize
            .height *
          0.25,
      });
    },
    [
      previewSize
        .height,
      previewSize
        .width,
    ]
  );

  const renderedPaths =
    useMemo(
      () =>
        strokes.map(
          stroke => ({
            stroke,
            path:
              makePath(
                stroke
              ),
          })
        ),
      [
        strokes,
      ]
    );

  const panResponder =
    useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponder:
            () =>
              !saving,

          onMoveShouldSetPanResponder:
            () =>
              !saving,

          onPanResponderGrant:
            event => {
              const point = {
                x:
                  event
                    .nativeEvent
                    .locationX,
                y:
                  event
                    .nativeEvent
                    .locationY,
              };

              if (
                tool ===
                'text'
              ) {
                setTextPosition(
                  point
                );

                return;
              }

              if (
                tool ===
                'emoji'
              ) {
                const id =
                  `emoji-${Date.now()}-${Math.random()
                    .toString(36)
                    .slice(2, 7)}`;

                setEmojiStickers(
                  current => [
                    ...current,
                    {
                      id,
                      emoji:
                        selectedEmoji,
                      x: point.x,
                      y: point.y,
                    },
                  ]
                );

                return;
              }

              const id =
                `stroke-${Date.now()}-${Math.random()
                  .toString(
                    36
                  )
                  .slice(
                    2,
                    7
                  )}`;

              activeStrokeIdRef.current =
                id;

              setStrokes(
                current => [
                  ...current,
                  {
                    id,
                    tool,
                    points:
                      tool ===
                      'line'
                        ? [
                            point,
                            point,
                          ]
                        : [
                            point,
                          ],
                  },
                ]
              );
            },

          onPanResponderMove:
            event => {
              const point = {
                x:
                  event
                    .nativeEvent
                    .locationX,
                y:
                  event
                    .nativeEvent
                    .locationY,
              };

              if (
                tool ===
                'text'
              ) {
                setTextPosition(
                  point
                );

                return;
              }

              if (
                tool ===
                'emoji'
              ) {
                return;
              }

              const id =
                activeStrokeIdRef.current;

              if (!id) {
                return;
              }

              setStrokes(
                current =>
                  current.map(
                    stroke => {
                      if (
                        stroke.id !==
                        id
                      ) {
                        return stroke;
                      }

                      if (
                        stroke.tool ===
                        'line'
                      ) {
                        return {
                          ...stroke,
                          points: [
                            stroke
                              .points[0] ??
                              point,
                            point,
                          ],
                        };
                      }

                      return {
                        ...stroke,
                        points: [
                          ...stroke.points,
                          point,
                        ],
                      };
                    }
                  )
              );
            },

          onPanResponderRelease:
            () => {
              activeStrokeIdRef.current =
                null;
            },

          onPanResponderTerminate:
            () => {
              activeStrokeIdRef.current =
                null;
            },
        }),
      [
        saving,
        tool,
        selectedEmoji,
      ]
    );

  const undo =
    () => {
      if (
        strokes.length
      ) {
        setStrokes(
          current =>
            current.slice(
              0,
              -1
            )
        );

        return;
      }

      if (
        emojiStickers.length
      ) {
        setEmojiStickers(
          current =>
            current.slice(
              0,
              -1
            )
        );

        return;
      }

      if (
        overlayText
      ) {
        setOverlayText('');
      }
    };

  const clearAll =
    () => {
      setStrokes([]);
      setOverlayText('');
      setEmojiStickers([]);
    };

  const apply =
    async () => {
      if (
        saving ||
        !sourceUri ||
        !captureRef.current
      ) {
        return;
      }

      setSaving(true);

      try {
        /*
         * Snapshot the exact composed editor view:
         * original photo + Skia drawing layer + RN text overlay.
         */
        const snapshot =
          await makeImageFromView(
            captureRef
          );

        if (!snapshot) {
          throw new Error(
            'Could not render the edited photo.'
          );
        }

        const pngBytes =
          snapshot
            .encodeToBytes();

        const tempPng =
          new File(
            Paths.cache,
            `buklod-photo-editor-${Date.now()}.png`
          );

        tempPng.create({
          overwrite: true,
          intermediates:
            true,
        });

        tempPng.write(
          pngBytes
        );

        /*
         * Normalize to JPEG because the existing BUKLOD Community
         * upload paths already use image/jpeg.
         */
        const context =
          ImageManipulator
            .ImageManipulator
            .manipulate(
              tempPng.uri
            );

        const rendered =
          await context
            .renderAsync();

        const saved =
          await rendered
            .saveAsync({
              format:
                ImageManipulator
                  .SaveFormat
                  .JPEG,
              compress:
                0.9,
              base64:
                true,
            });

        if (
          !saved.base64
        ) {
          throw new Error(
            'Could not encode the edited photo.'
          );
        }

        const outputFile =
          new File(
            saved.uri
          );

        const outputBytes =
          await outputFile
            .bytes();

        onDone({
          uri:
            saved.uri,
          base64:
            saved.base64,
          sizeBytes:
            outputBytes
              .byteLength,
          mimeType:
            'image/jpeg',
        });
      }
      catch (error: any) {
        Alert.alert(
          'Photo Editor',
          error?.message ||
            'Could not save the edited photo.'
        );
      }
      finally {
        setSaving(false);
      }
    };

  if (
    !sourceUri
  ) {
    return null;
  }

  const textLeft =
    Math.max(
      8,
      Math.min(
        textPosition.x,
        previewSize.width -
          90
      )
    );

  const textTop =
    Math.max(
      8,
      Math.min(
        textPosition.y,
        previewSize.height -
          54
      )
    );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={
        onCancel
      }
    >
      <View
        style={
          [
            styles.screen,
            {
              /* UI_002_R9_R2_PHOTO_SAFE_AREA */
              paddingTop: Math.max(insets.top, 8),
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]
        }
      >
        <View
          style={
            styles.header
          }
        >
          <Pressable
            onPress={
              onCancel
            }
            disabled={
              saving
            }
            style={
              styles.headerButton
            }
          >
            <Text
              style={
                styles.headerButtonText
              }
            >
              CANCEL
            </Text>
          </Pressable>

          <View
            style={{
              flex: 1,
              alignItems:
                'center',
            }}
          >
            <Text
              style={
                styles.title
              }
            >
              Edit Photo
            </Text>

            <Text
              style={
                styles.subtitle
              }
            >
              Draw, highlight, add a line, place text, or add emoji before sending.
            </Text>
          </View>

          <Pressable
            onPress={() =>
              void apply()
            }
            disabled={
              saving
            }
            style={[
              styles.headerButton,
              styles.doneButton,
            ]}
          >
            <Text
              style={[
                styles.headerButtonText,
                styles.doneText,
              ]}
            >
              {saving
                ? 'SAVING'
                : 'DONE'}
            </Text>
          </Pressable>
        </View>

        <View
          style={
            styles.previewArea
          }
        >
          <View
            style={
              styles.previewFrame
            }
          >
            <View
              ref={
                captureRef
              }
              collapsable={
                false
              }
              style={{
                width:
                  previewSize
                    .width,
                height:
                  previewSize
                    .height,
                backgroundColor:
                  '#000000',
              }}
            >
              <Image
                source={{
                  uri:
                    sourceUri,
                }}
                resizeMode="cover"
                style={
                  StyleSheet
                    .absoluteFill
                }
              />

              <Canvas
                style={
                  StyleSheet
                    .absoluteFill
                }
              >
                {renderedPaths.map(
                  ({
                    stroke,
                    path,
                  }) => (
                    <SkiaPath
                      key={
                        stroke.id
                      }
                      path={
                        path
                      }
                      style="stroke"
                      strokeWidth={
                        stroke.tool ===
                        'highlight'
                          ? 20
                          : stroke.tool ===
                              'line'
                            ? 5
                            : 4
                      }
                      strokeCap="round"
                      strokeJoin="round"
                      color={
                        stroke.tool ===
                        'highlight'
                          ? 'rgba(255,235,59,0.38)'
                          : 'rgba(255,67,54,0.96)'
                      }
                    />
                  )
                )}
              </Canvas>

              {!!overlayText.trim() && (
                <Text
                  pointerEvents="none"
                  style={[
                    styles.overlayText,
                    {
                      left:
                        textLeft,
                      top:
                        textTop,
                      maxWidth:
                        Math.max(
                          100,
                          previewSize
                            .width -
                            textLeft -
                            8
                        ),
                    },
                  ]}
                >
                  {
                    overlayText.trim()
                  }
                </Text>
              )}

              {emojiStickers.map(
                sticker => (
                  <Text
                    key={sticker.id}
                    pointerEvents="none"
                    style={[
                      styles.emojiSticker,
                      {
                        left: Math.max(
                          4,
                          Math.min(
                            sticker.x,
                            previewSize.width -
                              34
                          )
                        ),
                        top: Math.max(
                          4,
                          Math.min(
                            sticker.y,
                            previewSize.height -
                              34
                          )
                        ),
                      },
                    ]}
                  >
                    {sticker.emoji}
                  </Text>
                )
              )}

              <View
                {...panResponder.panHandlers}
                style={
                  StyleSheet
                    .absoluteFill
                }
              />
            </View>
          </View>
        </View>

        <View
          style={
            styles.controls
          }
        >
          <View
            style={
              styles.toolRow
            }
          >
            {(
              [
                [
                  'draw',
                  'DRAW',
                ],
                [
                  'line',
                  'LINE',
                ],
                [
                  'highlight',
                  'HIGHLIGHT',
                ],
                [
                  'text',
                  'TEXT',
                ],
                [
                  'emoji',
                  'EMOJI',
                ],
              ] as const
            ).map(
              item => (
                <Pressable
                  key={
                    item[0]
                  }
                  onPress={() =>
                    setTool(
                      item[0]
                    )
                  }
                  style={[
                    styles.toolButton,
                    tool ===
                      item[0] &&
                      styles.toolButtonOn,
                  ]}
                >
                  <Text
                    style={[
                      styles.toolText,
                      tool ===
                        item[0] &&
                        styles.toolTextOn,
                    ]}
                  >
                    {
                      item[1]
                    }
                  </Text>
                </Pressable>
              )
            )}
          </View>

          {tool ===
            'text' && (
            <TextInput
              value={
                overlayText
              }
              onChangeText={
                setOverlayText
              }
              placeholder="Type text, then tap the photo to place it"
              placeholderTextColor="#7C817E"
              style={
                styles.textInput
              }
            />
          )}

          {tool ===
            'emoji' && (
            <View
              style={
                styles.emojiRow
              }
            >
              {PHOTO_EDITOR_EMOJI.map(
                emoji => (
                  <Pressable
                    key={emoji}
                    onPress={() =>
                      setSelectedEmoji(
                        emoji
                      )
                    }
                    style={[
                      styles.emojiChip,
                      selectedEmoji ===
                        emoji &&
                        styles.emojiChipOn,
                    ]}
                  >
                    <Text
                      style={
                        styles.emojiChipText
                      }
                    >
                      {emoji}
                    </Text>
                  </Pressable>
                )
              )}
            </View>
          )}

          <View
            style={
              styles.utilityRow
            }
          >
            <Pressable
              onPress={
                undo
              }
              style={
                styles.utilityButton
              }
            >
              <Text
                style={
                  styles.utilityText
                }
              >
                UNDO
              </Text>
            </Pressable>

            <Text
              style={
                styles.hint
              }
            >
              {tool ===
              'text'
                ? 'Tap or drag on the photo to position your text.'
                : tool ===
                  'emoji'
                  ? 'Pick an emoji, then tap the photo to place it.'
                  : 'Drag directly on the photo.'}
            </Text>

            <Pressable
              onPress={
                clearAll
              }
              style={
                styles.utilityButton
              }
            >
              <Text
                style={
                  styles.utilityText
                }
              >
                CLEAR
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles =
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor:
        '#111412',
    },

    header: {
      minHeight: 76,
      paddingTop: 12,
      paddingHorizontal:
        12,
      paddingBottom:
        10,
      flexDirection:
        'row',
      alignItems:
        'center',
      borderBottomWidth:
        StyleSheet
          .hairlineWidth,
      borderBottomColor:
        '#343A36',
    },

    headerButton: {
      minWidth: 66,
      minHeight: 38,
      paddingHorizontal:
        10,
      borderRadius: 12,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    doneButton: {
      backgroundColor:
        '#E8F2EC',
    },

    headerButtonText: {
      color:
        '#E8EDEA',
      fontSize: 11,
      fontWeight:
        '900',
    },

    doneText: {
      color:
        '#214E3A',
    },

    title: {
      color:
        '#FFFFFF',
      fontSize: 17,
      fontWeight:
        '900',
    },

    subtitle: {
      marginTop: 3,
      color:
        '#A8B0AB',
      fontSize: 9,
      textAlign:
        'center',
    },

    previewArea: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal:
        12,
      paddingVertical:
        10,
    },

    previewFrame: {
      borderRadius: 16,
      overflow:
        'hidden',
      borderWidth: 1,
      borderColor:
        '#3A403C',
      backgroundColor:
        '#000000',
    },

    controls: {
      paddingHorizontal:
        12,
      paddingTop: 10,
      paddingBottom:
        18,
      borderTopWidth:
        StyleSheet
          .hairlineWidth,
      borderTopColor:
        '#343A36',
      backgroundColor:
        '#181C19',
    },

    toolRow: {
      flexDirection:
        'row',
      gap: 7,
    },

    toolButton: {
      flex: 1,
      minHeight: 42,
      paddingHorizontal:
        6,
      borderRadius: 12,
      borderWidth: 1,
      borderColor:
        '#3A403C',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    toolButtonOn: {
      borderColor:
        '#B9D7C5',
      backgroundColor:
        '#294B3B',
    },

    toolText: {
      color:
        '#B6BDB9',
      fontSize: 9,
      fontWeight:
        '900',
    },

    toolTextOn: {
      color:
        '#FFFFFF',
    },

    textInput: {
      marginTop: 10,
      minHeight: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor:
        '#3A403C',
      paddingHorizontal:
        12,
      color:
        '#FFFFFF',
      backgroundColor:
        '#101311',
      fontWeight:
        '700',
    },

    utilityRow: {
      marginTop: 10,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 8,
    },

    utilityButton: {
      minWidth: 64,
      minHeight: 34,
      borderRadius: 10,
      borderWidth: 1,
      borderColor:
        '#3A403C',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    utilityText: {
      color:
        '#DCE4DF',
      fontSize: 9,
      fontWeight:
        '900',
    },

    hint: {
      flex: 1,
      color:
        '#929A95',
      fontSize: 9,
      lineHeight: 13,
      textAlign:
        'center',
    },

    overlayText: {
      position:
        'absolute',
      color:
        '#FFFFFF',
      backgroundColor:
        'rgba(0,0,0,0.38)',
      paddingHorizontal:
        8,
      paddingVertical:
        5,
      borderRadius: 7,
      fontSize: 22,
      lineHeight: 27,
      fontWeight:
        '900',
      textShadowColor:
        'rgba(0,0,0,0.8)',
      textShadowOffset: {
        width: 0,
        height: 1,
      },
      textShadowRadius:
        2,
    },

    emojiSticker: {
      position: 'absolute',
      fontSize: 30,
      lineHeight: 34,
      textShadowColor: 'rgba(0,0,0,0.65)',
      textShadowOffset: {
        width: 0,
        height: 1,
      },
      textShadowRadius: 2,
    },

    emojiRow: {
      marginTop: 10,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },

    emojiChip: {
      width: 38,
      height: 38,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#3A403C',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#101311',
    },

    emojiChipOn: {
      borderColor: '#B9D7C5',
      backgroundColor: '#294B3B',
    },

    emojiChipText: {
      fontSize: 20,
      lineHeight: 24,
      textAlign: 'center',
    },
  });

export default BuklodPhotoEditor;