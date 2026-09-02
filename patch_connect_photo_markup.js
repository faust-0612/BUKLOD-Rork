const fs = require("fs");

const path =
  "./src/app/connect/[id].tsx";

let src =
  fs.readFileSync(
    path,
    "utf8"
  );


function stop(message) {
  console.error("");
  console.error(
    "PHOTO MARKUP PATCH STOPPED:"
  );
  console.error(message);
  process.exit(1);
}


if (
  src.includes(
    "CONNECT_PHOTO_MARKUP_EDITOR_20260812"
  )
) {
  console.log(
    "Photo markup editor already installed."
  );
  process.exit(0);
}


/* ============================================================
   1. REACT IMPORT
   Add useMemo
   ============================================================ */

if (
  !src.includes(
    "  useMemo,"
  )
) {

  src =
    src.replace(
`  useEffect,
  useRef,
  useState,`,
`  useEffect,
  useMemo,
  useRef,
  useState,`
    );

}


/* ============================================================
   2. SKIA IMPORTS
   ============================================================ */

const skiaImport =
`
import {
  Canvas,
  Circle as SkiaCircle,
  Image as SkiaImage,
  Path as SkiaPath,
  Text as SkiaText,
  Skia,
  matchFont,
  useCanvasRef,
} from '@shopify/react-native-skia';
`;


if (
  !src.includes(
    "useCanvasRef"
  )
) {

  const anchor =
`import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';
`;

  if (
    !src.includes(anchor)
  ) {
    stop(
      "MaterialCommunityIcons import anchor not found."
    );
  }

  src =
    src.replace(
      anchor,
      anchor +
      skiaImport
    );

}


/* ============================================================
   3. EXTEND PHOTO TYPE
   ============================================================ */

const oldPhotoType =
`type Photo = {
  uri: string;
  base64: string;
  sizeBytes: number;
};`;


const newPhotoType =
`type Photo = {
  uri: string;
  base64: string;
  sizeBytes: number;

  width?: number;
  height?: number;

  mimeType?:
    | 'image/jpeg'
    | 'image/png';

  extension?:
    | 'jpg'
    | 'png';
};`;


if (
  !src.includes(
    oldPhotoType
  )
) {
  stop(
    "Photo type anchor not found."
  );
}


src =
  src.replace(
    oldPhotoType,
    newPhotoType
  );


/* ============================================================
   4. PHOTO EDITOR COMPONENT
   ============================================================ */

const componentAnchor =
  "export default function ConnectThread()";


if (
  !src.includes(
    componentAnchor
  )
) {
  stop(
    "ConnectThread anchor not found."
  );
}


const editorComponent =
`
/* ============================================================
   CONNECT_PHOTO_MARKUP_EDITOR_20260812
   ============================================================ */

type MarkupTool =
  | 'pen'
  | 'highlighter'
  | 'arrow'
  | 'circle'
  | 'text';


type MarkPoint = {
  x: number;
  y: number;
};


type MarkupItem =
  | {
      kind:
        | 'pen'
        | 'highlighter';

      color: string;

      points:
        MarkPoint[];
    }

  | {
      kind:
        | 'arrow'
        | 'circle';

      color: string;

      start:
        MarkPoint;

      end:
        MarkPoint;
    }

  | {
      kind:
        'text';

      color: string;

      point:
        MarkPoint;

      text:
        string;
    };


const MARKUP_COLORS = [
  '#F44336',
  '#FFEB3B',
  '#00C853',
  '#2196F3',
  '#111111',
  '#FFFFFF',
];


const MARKUP_TOOLS: {
  key:
    MarkupTool;

  label:
    string;

  icon:
    any;
}[] = [

  {
    key:
      'pen',

    label:
      'PEN',

    icon:
      'pencil',
  },

  {
    key:
      'highlighter',

    label:
      'HIGHLIGHT',

    icon:
      'marker',
  },

  {
    key:
      'arrow',

    label:
      'ARROW',

    icon:
      'arrow-top-right',
  },

  {
    key:
      'circle',

    label:
      'CIRCLE',

    icon:
      'circle-outline',
  },

  {
    key:
      'text',

    label:
      'TEXT',

    icon:
      'format-text',
  },

];


function markupHexToRgba(
  hex: string,
  alpha: number
) {

  const clean =
    hex.replace(
      '#',
      ''
    );


  if (
    clean.length !== 6
  ) {
    return hex;
  }


  const r =
    parseInt(
      clean.slice(
        0,
        2
      ),
      16
    );


  const g =
    parseInt(
      clean.slice(
        2,
        4
      ),
      16
    );


  const b =
    parseInt(
      clean.slice(
        4,
        6
      ),
      16
    );


  return (
    'rgba(' +
    r +
    ',' +
    g +
    ',' +
    b +
    ',' +
    alpha +
    ')'
  );
}


function markupPathFromPoints(
  points:
    MarkPoint[]
) {

  if (
    points.length === 0
  ) {
    return '';
  }


  let path =
    'M ' +
    points[0].x +
    ' ' +
    points[0].y;


  for (
    let i = 1;
    i < points.length;
    i++
  ) {

    path +=
      ' L ' +
      points[i].x +
      ' ' +
      points[i].y;

  }


  return path;
}


function markupArrowPath(
  start:
    MarkPoint,

  end:
    MarkPoint
) {

  const angle =
    Math.atan2(
      end.y -
        start.y,

      end.x -
        start.x
    );


  const head =
    17;


  const spread =
    Math.PI /
    6;


  const p1 = {
    x:
      end.x -
      head *
        Math.cos(
          angle -
          spread
        ),

    y:
      end.y -
      head *
        Math.sin(
          angle -
          spread
        ),
  };


  const p2 = {
    x:
      end.x -
      head *
        Math.cos(
          angle +
          spread
        ),

    y:
      end.y -
      head *
        Math.sin(
          angle +
          spread
        ),
  };


  return (
    'M ' +
    start.x +
    ' ' +
    start.y +

    ' L ' +
    end.x +
    ' ' +
    end.y +

    ' M ' +
    end.x +
    ' ' +
    end.y +

    ' L ' +
    p1.x +
    ' ' +
    p1.y +

    ' M ' +
    end.x +
    ' ' +
    end.y +

    ' L ' +
    p2.x +
    ' ' +
    p2.y
  );
}


function PhotoMarkupEditor({
  visible,
  photo,
  onCancel,
  onDone,
}: {

  visible:
    boolean;

  photo:
    Photo;

  onCancel:
    () => void;

  onDone:
    (
      photo:
        Photo
    ) => void;

}) {

  const canvasRef =
    useCanvasRef();


  const [
    tool,
    setTool,
  ] =
    useState<
      MarkupTool
    >(
      'pen'
    );


  const [
    color,
    setColor,
  ] =
    useState(
      '#F44336'
    );


  const [
    marks,
    setMarks,
  ] =
    useState<
      MarkupItem[]
    >(
      []
    );


  const [
    redoMarks,
    setRedoMarks,
  ] =
    useState<
      MarkupItem[]
    >(
      []
    );


  const [
    activeMark,
    setActiveMark,
  ] =
    useState<
      MarkupItem
      | null
    >(
      null
    );


  const activeMarkRef =
    useRef<
      MarkupItem
      | null
    >(
      null
    );


  const [
    textDraft,
    setTextDraft,
  ] =
    useState('');


  const [
    textPoint,
    setTextPoint,
  ] =
    useState<
      MarkPoint
      | null
    >(
      null
    );


  const [
    saving,
    setSaving,
  ] =
    useState(false);


  useEffect(
    () => {

      if (!visible) {
        return;
      }


      setMarks(
        []
      );

      setRedoMarks(
        []
      );

      setActiveMark(
        null
      );

      activeMarkRef.current =
        null;

      setTextDraft(
        ''
      );

      setTextPoint(
        null
      );

    },
    [
      visible,
      photo.uri,
    ]
  );


  const baseImage =
    useMemo(
      () => {

        try {

          const data =
            Skia.Data
              .fromBase64(
                photo.base64
              );


          return (
            Skia.Image
              .MakeImageFromEncoded(
                data
              )
          );

        }
        catch {

          return null;

        }

      },
      [
        photo.base64,
      ]
    );


  const editorFont =
    useMemo(
      () => {

        return matchFont({
          fontFamily:
            Platform.OS ===
              'ios'
              ? 'Helvetica'
              : 'sans-serif',

          fontSize:
            24,

          fontWeight:
            'bold',
        });

      },
      []
    );


  const windowSize =
    Dimensions.get(
      'window'
    );


  const maxWidth =
    Math.max(
      260,
      windowSize.width -
        16
    );


  const maxHeight =
    Math.max(
      280,
      windowSize.height *
        0.57
    );


  const originalWidth =
    Math.max(
      1,
      Number(
        photo.width ??
        1080
      )
    );


  const originalHeight =
    Math.max(
      1,
      Number(
        photo.height ??
        1080
      )
    );


  const aspect =
    originalWidth /
    originalHeight;


  let surfaceWidth =
    maxWidth;


  let surfaceHeight =
    surfaceWidth /
    aspect;


  if (
    surfaceHeight >
    maxHeight
  ) {

    surfaceHeight =
      maxHeight;

    surfaceWidth =
      surfaceHeight *
      aspect;

  }


  const setActive =
    (
      item:
        MarkupItem
        | null
    ) => {

      activeMarkRef.current =
        item;

      setActiveMark(
        item
      );

    };


  const commitMark =
    (
      item:
        MarkupItem
    ) => {

      setMarks(
        current => [
          ...current,
          item,
        ]
      );


      setRedoMarks(
        []
      );

    };


  const undo =
    () => {

      setMarks(
        current => {

          if (
            current.length ===
            0
          ) {
            return current;
          }


          const last =
            current[
              current.length -
              1
            ];


          setRedoMarks(
            redo => [
              last,
              ...redo,
            ]
          );


          return current
            .slice(
              0,
              -1
            );

        }
      );

    };


  const redo =
    () => {

      setRedoMarks(
        current => {

          if (
            current.length ===
            0
          ) {
            return current;
          }


          const next =
            current[0];


          setMarks(
            old => [
              ...old,
              next,
            ]
          );


          return current
            .slice(
              1
            );

        }
      );

    };


  const clearAll =
    () => {

      setMarks(
        []
      );

      setRedoMarks(
        []
      );

      setActive(
        null
      );

      setTextDraft(
        ''
      );

      setTextPoint(
        null
      );

    };


  const touchPoint =
    (
      event:
        any
    ): MarkPoint => {

      return {
        x:
          event
            .nativeEvent
            .locationX,

        y:
          event
            .nativeEvent
            .locationY,
      };

    };


  const beginTouch =
    (
      event:
        any
    ) => {

      const point =
        touchPoint(
          event
        );


      if (
        tool ===
        'text'
      ) {

        setTextPoint(
          point
        );

        return;
      }


      if (
        tool ===
          'pen'
        ||
        tool ===
          'highlighter'
      ) {

        setActive({
          kind:
            tool,

          color,

          points: [
            point,
          ],
        });


        return;
      }


      setActive({
        kind:
          tool,

        color,

        start:
          point,

        end:
          point,
      });

    };


  const moveTouch =
    (
      event:
        any
    ) => {

      const current =
        activeMarkRef
          .current;


      if (!current) {
        return;
      }


      const point =
        touchPoint(
          event
        );


      if (
        current.kind ===
          'pen'
        ||
        current.kind ===
          'highlighter'
      ) {

        const points =
          current.points;


        const previous =
          points[
            points.length -
            1
          ];


        const distance =
          Math.hypot(
            point.x -
              previous.x,

            point.y -
              previous.y
          );


        if (
          distance <
          1.5
        ) {
          return;
        }


        setActive({
          ...current,

          points: [
            ...points,
            point,
          ],
        });


        return;
      }


      if (
        current.kind ===
          'arrow'
        ||
        current.kind ===
          'circle'
      ) {

        setActive({
          ...current,

          end:
            point,
        });

      }

    };


  const finishTouch =
    () => {

      const current =
        activeMarkRef
          .current;


      if (!current) {
        return;
      }


      commitMark(
        current
      );


      setActive(
        null
      );

    };


  const addText =
    () => {

      const clean =
        textDraft
          .trim();


      if (!clean) {
        return;
      }


      commitMark({
        kind:
          'text',

        color,

        point:
          textPoint ??
          {
            x:
              surfaceWidth *
              0.1,

            y:
              surfaceHeight *
              0.5,
          },

        text:
          clean,
      });


      setTextDraft(
        ''
      );

      setTextPoint(
        null
      );

    };


  const renderMark =
    (
      mark:
        MarkupItem,

      key:
        string
    ) => {

      if (
        mark.kind ===
          'pen'
        ||
        mark.kind ===
          'highlighter'
      ) {

        return (
          <SkiaPath
            key={key}
            path={
              markupPathFromPoints(
                mark.points
              )
            }
            style="stroke"
            strokeWidth={
              mark.kind ===
                'highlighter'
                ? 16
                : 4
            }
            strokeCap="round"
            strokeJoin="round"
            color={
              mark.kind ===
                'highlighter'
                ? markupHexToRgba(
                    mark.color,
                    0.38
                  )
                : mark.color
            }
          />
        );

      }


      if (
        mark.kind ===
        'arrow'
      ) {

        return (
          <SkiaPath
            key={key}
            path={
              markupArrowPath(
                mark.start,
                mark.end
              )
            }
            style="stroke"
            strokeWidth={5}
            strokeCap="round"
            strokeJoin="round"
            color={
              mark.color
            }
          />
        );

      }


      if (
        mark.kind ===
        'circle'
      ) {

        const centerX =
          (
            mark.start.x +
            mark.end.x
          ) /
          2;


        const centerY =
          (
            mark.start.y +
            mark.end.y
          ) /
          2;


        const radius =
          Math.max(
            3,

            Math.hypot(
              mark.end.x -
                mark.start.x,

              mark.end.y -
                mark.start.y
            ) /
            2
          );


        return (
          <SkiaCircle
            key={key}
            cx={
              centerX
            }
            cy={
              centerY
            }
            r={
              radius
            }
            style="stroke"
            strokeWidth={5}
            color={
              mark.color
            }
          />
        );

      }


      return (
        <SkiaText
          key={key}
          x={
            mark.point.x
          }
          y={
            mark.point.y
          }
          text={
            mark.text
          }
          font={
            editorFont
          }
          color={
            mark.color
          }
        />
      );

    };


  const saveEditedPhoto =
    async () => {

      if (saving) {
        return;
      }


      /*
       * No markup:
       * keep original prepared photo
       * without unnecessary re-encoding.
       */
      if (
        marks.length ===
        0
      ) {

        onDone(
          photo
        );

        return;
      }


      try {

        setSaving(
          true
        );


        const snapshot =
          await canvasRef
            .current
            ?.makeImageSnapshotAsync();


        if (!snapshot) {

          throw new Error(
            'Could not render edited photo.'
          );

        }


        /*
         * Default Skia snapshot encoding
         * is lossless image data.
         * We store edited snapshots as PNG.
         */
        const base64 =
          snapshot
            .encodeToBase64();


        if (!base64) {

          throw new Error(
            'Could not encode edited photo.'
          );

        }


        const sizeBytes =
          Math.ceil(
            base64.length *
            0.75
          );


        if (
          sizeBytes >
          5 *
          1024 *
          1024
        ) {

          throw new Error(
            'Edited photo is too large. Remove some edits or use a smaller photo.'
          );

        }


        onDone({
          ...photo,

          uri:
            'data:image/png;base64,' +
            base64,

          base64,

          sizeBytes,

          mimeType:
            'image/png',

          extension:
            'png',
        });

      }
      catch (
        error:
          any
      ) {

        Alert.alert(
          'Photo Editor',
          error?.message ??
            'Could not save edited photo.'
        );

      }
      finally {

        setSaving(
          false
        );

      }

    };


  return (
    <Modal
      visible={
        visible
      }
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={
        onCancel
      }
    >

      <View
        style={
          photoEditorStyles.screen
        }
      >

        <View
          style={
            photoEditorStyles.header
          }
        >

          <Pressable
            onPress={
              onCancel
            }
            style={
              photoEditorStyles.headerButton
            }
          >
            <MaterialCommunityIcons
              name="close"
              size={23}
              color="#FFFFFF"
            />

            <Text
              style={
                photoEditorStyles.headerButtonText
              }
            >
              BACK
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
                photoEditorStyles.title
              }
            >
              EDIT PHOTO
            </Text>

            <Text
              style={
                photoEditorStyles.subtitle
              }
            >
              Draw, mark or add text
            </Text>
          </View>


          <Pressable
            disabled={
              saving
            }
            onPress={() =>
              void saveEditedPhoto()
            }
            style={
              photoEditorStyles.doneButton
            }
          >
            <MaterialCommunityIcons
              name="check"
              size={20}
              color="#FFFFFF"
            />

            <Text
              style={
                photoEditorStyles.doneText
              }
            >
              DONE
            </Text>
          </Pressable>

        </View>


        <View
          style={
            photoEditorStyles.canvasArea
          }
        >

          <View
            style={[
              photoEditorStyles.canvasShell,
              {
                width:
                  surfaceWidth,

                height:
                  surfaceHeight,
              },
            ]}
          >

            <Canvas
              ref={
                canvasRef
              }
              style={{
                width:
                  surfaceWidth,

                height:
                  surfaceHeight,

                backgroundColor:
                  '#111111',
              }}
            >

              {!!baseImage && (
                <SkiaImage
                  image={
                    baseImage
                  }
                  x={0}
                  y={0}
                  width={
                    surfaceWidth
                  }
                  height={
                    surfaceHeight
                  }
                  fit="fill"
                />
              )}


              {marks.map(
                (
                  mark,
                  index
                ) =>
                  renderMark(
                    mark,
                    'mark-' +
                      index
                  )
              )}


              {!!activeMark &&
                renderMark(
                  activeMark,
                  'active-mark'
                )}

            </Canvas>


            <View
              style={
                StyleSheet.absoluteFill
              }
              onStartShouldSetResponder={() =>
                true
              }
              onMoveShouldSetResponder={() =>
                true
              }
              onResponderGrant={
                beginTouch
              }
              onResponderMove={
                moveTouch
              }
              onResponderRelease={
                finishTouch
              }
              onResponderTerminate={
                finishTouch
              }
            />

          </View>

        </View>


        <View
          style={
            photoEditorStyles.bottomPanel
          }
        >

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={
              false
            }
            contentContainerStyle={
              photoEditorStyles.toolRow
            }
          >

            {MARKUP_TOOLS.map(
              item => {

                const active =
                  tool ===
                  item.key;


                return (
                  <Pressable
                    key={
                      item.key
                    }
                    onPress={() =>
                      setTool(
                        item.key
                      )
                    }
                    style={[
                      photoEditorStyles.toolButton,

                      active &&
                        photoEditorStyles.toolButtonOn,
                    ]}
                  >

                    <MaterialCommunityIcons
                      name={
                        item.icon
                      }
                      size={21}
                      color={
                        active
                          ? '#FFFFFF'
                          : '#DDE7E0'
                      }
                    />

                    <Text
                      style={[
                        photoEditorStyles.toolLabel,

                        active && {
                          color:
                            '#FFFFFF',
                        },
                      ]}
                    >
                      {
                        item.label
                      }
                    </Text>

                  </Pressable>
                );

              }
            )}

          </ScrollView>


          <View
            style={
              photoEditorStyles.controlRow
            }
          >

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={
                false
              }
              contentContainerStyle={
                photoEditorStyles.colorRow
              }
            >

              {MARKUP_COLORS.map(
                item => (

                  <Pressable
                    key={
                      item
                    }
                    onPress={() =>
                      setColor(
                        item
                      )
                    }
                    style={[
                      photoEditorStyles.colorOuter,

                      color ===
                        item &&
                        photoEditorStyles.colorOuterOn,
                    ]}
                  >
                    <View
                      style={[
                        photoEditorStyles.colorDot,
                        {
                          backgroundColor:
                            item,
                        },
                      ]}
                    />
                  </Pressable>

                )
              )}

            </ScrollView>


            <Pressable
              disabled={
                marks.length ===
                0
              }
              onPress={
                undo
              }
              style={
                photoEditorStyles.smallControl
              }
            >
              <MaterialCommunityIcons
                name="undo"
                size={21}
                color="#FFFFFF"
              />
            </Pressable>


            <Pressable
              disabled={
                redoMarks.length ===
                0
              }
              onPress={
                redo
              }
              style={
                photoEditorStyles.smallControl
              }
            >
              <MaterialCommunityIcons
                name="redo"
                size={21}
                color="#FFFFFF"
              />
            </Pressable>


            <Pressable
              onPress={
                clearAll
              }
              style={
                photoEditorStyles.smallControl
              }
            >
              <MaterialCommunityIcons
                name="delete-outline"
                size={21}
                color="#FFFFFF"
              />
            </Pressable>

          </View>


          {tool ===
            'text' && (

            <View
              style={
                photoEditorStyles.textRow
              }
            >

              <TextInput
                value={
                  textDraft
                }
                onChangeText={
                  setTextDraft
                }
                placeholder={
                  textPoint
                    ? 'Type text for selected position...'
                    : 'Tap photo, then type text...'
                }
                placeholderTextColor="#AEB8B2"
                style={
                  photoEditorStyles.textInput
                }
                maxLength={100}
              />


              <Pressable
                disabled={
                  !textDraft
                    .trim()
                }
                onPress={
                  addText
                }
                style={[
                  photoEditorStyles.addTextButton,

                  !textDraft
                    .trim() && {
                    opacity:
                      0.45,
                  },
                ]}
              >
                <Text
                  style={
                    photoEditorStyles.addTextButtonText
                  }
                >
                  ADD
                </Text>
              </Pressable>

            </View>

          )}

        </View>

      </View>

    </Modal>
  );
}


const photoEditorStyles =
  StyleSheet.create({

    screen: {
      flex: 1,
      backgroundColor:
        '#07110B',
    },


    header: {
      paddingTop:
        Platform.OS ===
          'android'
          ? 18
          : 48,

      minHeight:
        Platform.OS ===
          'android'
          ? 68
          : 96,

      paddingHorizontal:
        10,

      paddingBottom:
        9,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap: 8,

      backgroundColor:
        '#0E4F20',
    },


    headerButton: {
      minWidth: 54,
      minHeight: 42,
      alignItems:
        'center',
      justifyContent:
        'center',
    },


    headerButtonText: {
      marginTop: 1,
      fontSize: 8,
      fontWeight:
        '900',
      color:
        '#FFFFFF',
    },


    title: {
      fontSize: 14,
      fontWeight:
        '900',
      color:
        '#FFFFFF',
    },


    subtitle: {
      marginTop: 2,
      fontSize: 9,
      color:
        '#DDE8E0',
    },


    doneButton: {
      minWidth: 62,
      height: 42,
      borderRadius: 13,
      paddingHorizontal: 8,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 4,
      backgroundColor:
        '#2D8B57',
    },


    doneText: {
      fontSize: 9,
      fontWeight:
        '900',
      color:
        '#FFFFFF',
    },


    canvasArea: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
      padding: 8,
      backgroundColor:
        '#030604',
    },


    canvasShell: {
      overflow:
        'hidden',
      backgroundColor:
        '#111111',
    },


    bottomPanel: {
      paddingTop: 8,
      paddingBottom:
        Platform.OS ===
          'ios'
          ? 24
          : 12,

      backgroundColor:
        '#0B1710',
    },


    toolRow: {
      paddingHorizontal: 8,
      gap: 7,
    },


    toolButton: {
      width: 72,
      minHeight: 58,
      paddingVertical: 7,
      borderRadius: 13,
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 4,
      backgroundColor:
        '#18251C',
    },


    toolButtonOn: {
      backgroundColor:
        '#287D54',
    },


    toolLabel: {
      fontSize: 7.5,
      fontWeight:
        '900',
      color:
        '#DDE7E0',
    },


    controlRow: {
      marginTop: 8,
      paddingHorizontal: 9,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 6,
    },


    colorRow: {
      flexGrow: 1,
      gap: 5,
      paddingRight: 5,
    },


    colorOuter: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems:
        'center',
      justifyContent:
        'center',
      borderWidth: 2,
      borderColor:
        'transparent',
    },


    colorOuterOn: {
      borderColor:
        '#FFFFFF',
    },


    colorDot: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 1,
      borderColor:
        '#6E796F',
    },


    smallControl: {
      width: 37,
      height: 37,
      borderRadius: 11,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#26362C',
    },


    textRow: {
      marginTop: 9,
      paddingHorizontal: 9,
      flexDirection:
        'row',
      gap: 7,
      alignItems:
        'center',
    },


    textInput: {
      flex: 1,
      minHeight: 42,
      borderRadius: 12,
      paddingHorizontal: 12,
      color:
        '#FFFFFF',
      backgroundColor:
        '#1B2A20',
    },


    addTextButton: {
      minWidth: 58,
      height: 42,
      borderRadius: 12,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#287D54',
    },


    addTextButtonText: {
      fontSize: 10,
      fontWeight:
        '900',
      color:
        '#FFFFFF',
    },


    previewEditWrap: {
      width: 62,
      height: 62,
      position:
        'relative',
    },


    previewEditBadge: {
      position:
        'absolute',
      right: -3,
      bottom: -3,
      width: 25,
      height: 25,
      borderRadius: 13,
      alignItems:
        'center',
      justifyContent:
        'center',
      borderWidth: 2,
      borderColor:
        '#FFFFFF',
      backgroundColor:
        '#287D54',
    },

  });


`;


src =
  src.replace(
    componentAnchor,
    editorComponent +
    componentAnchor
  );


/* ============================================================
   5. PHOTO EDITOR OPEN STATE
   ============================================================ */

const photoBusyState =
/const\s*\[\s*photoBusy,\s*setPhotoBusy,\s*\]\s*=\s*useState\(false\);/m;


if (
  !photoBusyState.test(
    src
  )
) {
  stop(
    "photoBusy state anchor not found."
  );
}


src =
  src.replace(
    photoBusyState,
match =>
`${match}


  const [
    photoEditorOpen,
    setPhotoEditorOpen,
  ] =
    useState(false);`
  );


/* ============================================================
   6. PREPARED PHOTO
   Add dimensions / MIME + automatically open editor
   ============================================================ */

const preparedPhoto =
/setPhoto\(\{\s*uri:prepared\.uri,\s*base64:prepared\.base64,\s*sizeBytes\s*\}\);/m;


if (
  !preparedPhoto.test(
    src
  )
) {
  stop(
    "prepareMessagePhoto setPhoto anchor not found."
  );
}


src =
  src.replace(
    preparedPhoto,
`setPhoto({
        uri:
          prepared.uri,

        base64:
          prepared.base64,

        sizeBytes,

        width:
          Number(
            (prepared as any)
              .width
            ??
            asset.width
            ??
            1080
          ),

        height:
          Number(
            (prepared as any)
              .height
            ??
            asset.height
            ??
            1080
          ),

        mimeType:
          'image/jpeg',

        extension:
          'jpg',
      });

      setPhotoEditorOpen(
        true
      );`
  );


/* ============================================================
   7. PHOTO PREVIEW -> TAP TO EDIT
   ============================================================ */

const previewImage =
/<Image\s*source=\{\{\s*uri:\s*photo\.uri,\s*\}\}\s*style=\{\s*s\.photoThumb\s*\}\s*\/>/m;


if (
  !previewImage.test(
    src
  )
) {
  stop(
    "Photo preview image anchor not found."
  );
}


src =
  src.replace(
    previewImage,
`<PhotoMarkupEditor
              visible={
                photoEditorOpen
              }
              photo={
                photo
              }
              onCancel={() =>
                setPhotoEditorOpen(
                  false
                )
              }
              onDone={
                nextPhoto => {
                  setPhoto(
                    nextPhoto
                  );

                  setPhotoEditorOpen(
                    false
                  );
                }
              }
            />


            <Pressable
              onPress={() =>
                setPhotoEditorOpen(
                  true
                )
              }
              style={
                photoEditorStyles
                  .previewEditWrap
              }
            >

              <Image
                source={{
                  uri:
                    photo.uri,
                }}
                style={
                  s.photoThumb
                }
              />


              <View
                style={
                  photoEditorStyles
                    .previewEditBadge
                }
              >
                <MaterialCommunityIcons
                  name="pencil"
                  size={13}
                  color="#FFFFFF"
                />
              </View>

            </Pressable>`
  );


src =
  src.replace(
    "Photo ready to send",
    "Photo ready ? tap image to edit"
  );


/* ============================================================
   8. SEND FILE EXTENSION
   jpg for normal photo
   png for marked photo
   ============================================================ */

const pathPattern =
/`\$\{user\.id\}\/\$\{id\}\/\$\{Date\.now\(\)\}-\$\{Math\.random\(\)\s*\.toString\(36\)\s*\.slice\(2\)\}\.jpg`/m;


if (
  !pathPattern.test(
    src
  )
) {
  stop(
    "Message photo storage path anchor not found."
  );
}


src =
  src.replace(
    pathPattern,
`\`\${user.id}/\${id}/\${Date.now()}-\${Math.random()
              .toString(36)
              .slice(2)}.\${photo?.extension ?? 'jpg'}\``
  );


/* ============================================================
   9. SEND CONTENT TYPE
   ============================================================ */

const contentTypePattern =
/contentType:\s*'image\/jpeg',/m;


if (
  !contentTypePattern.test(
    src
  )
) {
  stop(
    "Photo upload contentType anchor not found."
  );
}


src =
  src.replace(
    contentTypePattern,
`contentType:
                    photo?.mimeType
                    ??
                    'image/jpeg',`
  );


/* ============================================================
   10. MESSAGE MIME TYPE
   ============================================================ */

const rpcMimePattern =
/p_media_mime_type:\s*path\s*\?\s*'image\/jpeg'\s*:\s*null,/m;


if (
  !rpcMimePattern.test(
    src
  )
) {
  stop(
    "p_media_mime_type anchor not found."
  );
}


src =
  src.replace(
    rpcMimePattern,
`p_media_mime_type:
                path
                  ? (
                      photo?.mimeType
                      ??
                      'image/jpeg'
                    )
                  : null,`
  );


fs.writeFileSync(
  path,
  src,
  "utf8"
);


console.log(
  "PHOTO MARKUP EDITOR INSTALLED"
);

console.log(
  "PEN INSTALLED"
);

console.log(
  "HIGHLIGHTER INSTALLED"
);

console.log(
  "ARROW INSTALLED"
);

console.log(
  "CIRCLE INSTALLED"
);

console.log(
  "TEXT TOOL INSTALLED"
);

console.log(
  "UNDO / REDO / CLEAR INSTALLED"
);

console.log(
  "PNG FLATTENED EDITED PHOTO SEND INSTALLED"
);
