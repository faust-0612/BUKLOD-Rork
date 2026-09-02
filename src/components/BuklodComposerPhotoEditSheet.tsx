import React, { useMemo } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import {
  type BuklodPhotoEditorTool,
} from '@/components/BuklodPhotoEditor';
import {
  useBuklodPresentation,
} from '@/hooks/useBuklodPresentation';
import { useBuklodDrawerBottomInset } from '@/lib/buklodSafeArea';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelectTool: (tool: BuklodPhotoEditorTool) => void;
  onRemove: () => void;
};

const EDIT_OPTIONS: Array<{
  tool: BuklodPhotoEditorTool;
  label: string;
  icon: React.ComponentProps<
    typeof MaterialCommunityIcons
  >['name'];
}> = [
  {
    tool: 'highlight',
    label: 'Highlight',
    icon: 'marker',
  },
  {
    tool: 'draw',
    label: 'Draw',
    icon: 'draw',
  },
  {
    tool: 'line',
    label: 'Line',
    icon: 'vector-line',
  },
  {
    tool: 'text',
    label: 'Add text',
    icon: 'format-text',
  },
  {
    tool: 'emoji',
    label: 'Add emoji',
    icon: 'emoticon-happy-outline',
  },
];

export function BuklodComposerPhotoEditSheet({
  visible,
  onClose,
  onSelectTool,
  onRemove,
}: Props) {
  const { colors } = useBuklodPresentation();
  const drawerBottomInset = useBuklodDrawerBottomInset();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        backdrop: {
          flex: 1,
          backgroundColor: 'rgba(8, 16, 12, 0.52)',
          justifyContent: 'flex-end',
        },
        sheet: {
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          backgroundColor: colors.white,
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: 24,
        },
        title: {
          fontSize: 13,
          fontWeight: '900',
          color: colors.text,
          marginBottom: 4,
        },
        subtitle: {
          fontSize: 10,
          fontWeight: '600',
          color: colors.muted,
          marginBottom: 12,
          lineHeight: 14,
        },
        option: {
          minHeight: 48,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.line,
          backgroundColor: colors.white,
          paddingHorizontal: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        },
        optionText: {
          flex: 1,
          fontSize: 12,
          fontWeight: '800',
          color: colors.text,
        },
        remove: {
          marginTop: 10,
          borderColor: `${colors.danger}55`,
          backgroundColor: `${colors.danger}10`,
        },
        removeText: {
          color: colors.danger,
        },
        cancel: {
          marginTop: 8,
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 42,
        },
        cancelText: {
          fontSize: 11,
          fontWeight: '800',
          color: colors.muted,
        },
        list: {
          gap: 8,
        },
      }),
    [colors]
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
      >
        <Pressable
          style={[
            styles.sheet,
            { paddingBottom: drawerBottomInset + 12 },
          ]}
          onPress={(event) =>
            event.stopPropagation()
          }
        >
          <Text style={styles.title}>
            Edit photo
          </Text>
          <Text style={styles.subtitle}>
            Choose a tool, then tap or drag on the photo.
          </Text>

          <View style={styles.list}>
            {EDIT_OPTIONS.map((option) => (
              <Pressable
                key={option.tool}
                style={styles.option}
                onPress={() => {
                  onSelectTool(option.tool);
                  onClose();
                }}
              >
                <MaterialCommunityIcons
                  name={option.icon}
                  size={20}
                  color={colors.greenDark}
                />
                <Text style={styles.optionText}>
                  {option.label}
                </Text>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={18}
                  color={colors.muted}
                />
              </Pressable>
            ))}

            <Pressable
              style={[styles.option, styles.remove]}
              onPress={() => {
                onRemove();
                onClose();
              }}
            >
              <MaterialCommunityIcons
                name="trash-can-outline"
                size={20}
                color={colors.danger}
              />
              <Text
                style={[
                  styles.optionText,
                  styles.removeText,
                ]}
              >
                Remove photo
              </Text>
            </Pressable>
          </View>

          <Pressable
            style={styles.cancel}
            onPress={onClose}
          >
            <Text style={styles.cancelText}>
              Cancel
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
