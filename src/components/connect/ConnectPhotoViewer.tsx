import React, {
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView, FlatList } from 'react-native-gesture-handler';
import {
  BuklodZoomablePhoto,
} from '@/components/BuklodZoomablePhoto';

type Props = {
  visible: boolean;
  uris: string[];
  mediaPaths?: Array<string | null | undefined>;
  initialIndex?: number;
  onClose: () => void;
};

export function ConnectPhotoViewer({
  visible,
  uris,
  mediaPaths,
  initialIndex = 0,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const listRef = useRef<FlatList>(null);
  const [index, setIndex] = useState(initialIndex);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    if (!visible) {
      setZoomed(false);
      return;
    }
    const next = Math.max(
      0,
      Math.min(initialIndex, Math.max(0, uris.length - 1))
    );
    setIndex(next);
    setZoomed(false);
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({
        index: next,
        animated: false,
      });
    });
  }, [visible, initialIndex, uris.length]);

  if (!uris.length) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.screen}>
        <FlatList
          ref={listRef}
          data={uris}
          keyExtractor={(uri, uriIndex) => `${uri}-${uriIndex}`}
          horizontal
          pagingEnabled={!zoomed}
          scrollEnabled={!zoomed}
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={Math.max(
            0,
            Math.min(initialIndex, uris.length - 1)
          )}
          getItemLayout={(_data, itemIndex) => ({
            length: width,
            offset: width * itemIndex,
            index: itemIndex,
          })}
          onMomentumScrollEnd={event => {
            const nextIndex = Math.round(
              event.nativeEvent.contentOffset.x / width
            );
            setIndex(
              Math.max(0, Math.min(nextIndex, uris.length - 1))
            );
            setZoomed(false);
          }}
          renderItem={({ item, index: itemIndex }) => (
            <View
              style={{
                width,
                height,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BuklodZoomablePhoto
                uri={item}
                mediaPath={mediaPaths?.[itemIndex]}
                active={itemIndex === index}
                onZoomedChange={setZoomed}
              />
            </View>
          )}
        />

        <View
          style={[
            styles.top,
            { paddingTop: Math.max(insets.top, 16) },
          ]}
        >
          <Text style={styles.count}>
            {index + 1} / {uris.length}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close photo"
            onPress={onClose}
            style={styles.close}
          >
            <MaterialCommunityIcons
              name="close"
              size={26}
              color="#FFFFFF"
            />
          </Pressable>
        </View>

        {uris.length > 1 && !zoomed ? (
          <Text
            style={[
              styles.hint,
              { bottom: Math.max(insets.bottom + 18, 28) },
            ]}
          >
            Swipe for more photos
          </Text>
        ) : null}
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  count: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  close: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  hint: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    overflow: 'hidden',
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    backgroundColor: 'rgba(0,0,0,0.58)',
  },
});
