import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import {
  StyleSheet, type NativeSyntheticEvent, type TextInput, type TextInputProps,
} from 'react-native';
import { requireNativeViewManager } from 'expo-modules-core';

/**
 * Available only in the separately signed Android kingdom-native-lab build.
 * Uses actual focused EditText + IME commitContent instead of ACTION_SEND.
 * GIF is staged into private cache and handed to existing manual comment flow.
 */
type ContentEvent = NativeSyntheticEvent<{ uri: string; mimeType: string }>;
type ChangeEvent = NativeSyntheticEvent<{ text: string }>;
type SelectionEvent = NativeSyntheticEvent<{ start: number; end: number }>;
type ErrorEvent = NativeSyntheticEvent<{ message: string }>;
type NativeMethods = {
  focus: () => Promise<void>;
  blur: () => Promise<void>;
  setSelection: (start: number, end: number) => Promise<void>;
};
type Props = TextInputProps & {
  onGif: (uri: string) => void;
};

const NativeEditor = requireNativeViewManager('BuklodLabNative') as React.ComponentType<any>;

const KeyboardGifInput = forwardRef<TextInput, Props>(function KeyboardGifInput({
  value, placeholder, editable = true, maxLength, style, selection,
  onGif, onChangeText, onSelectionChange,
  ...rest
}, forwardedRef) {
  const nativeRef = useRef<NativeMethods | null>(null);
  const flat = useMemo(() => StyleSheet.flatten(style), [style]);
  useImperativeHandle(forwardedRef, () => ({
    focus: () => { void nativeRef.current?.focus(); },
    blur: () => { void nativeRef.current?.blur(); },
    isFocused: () => false,
    clear: () => { onChangeText?.(''); },
  } as TextInput), [onChangeText]);

  useEffect(() => {
    if (selection) {
      void nativeRef.current?.setSelection(selection.start, selection.end);
    }
  }, [selection?.start, selection?.end]);

  return <NativeEditor
    {...rest}
    ref={nativeRef}
    style={style}
    value={value ?? ''}
    placeholder={placeholder ?? ''}
    editable={editable}
    maxLength={maxLength ?? 2000}
    fontSize={flat?.fontSize ?? 16}
    onChange={(event: ChangeEvent) => onChangeText?.(event.nativeEvent.text)}
    onSelectionChange={(event: SelectionEvent) => onSelectionChange?.({
      nativeEvent: {
        selection: { start: event.nativeEvent.start, end: event.nativeEvent.end },
      },
    } as any)}
    onGif={(event: ContentEvent) => {
      if (event.nativeEvent.mimeType !== 'image/gif') return;
      const uri = event.nativeEvent.uri;
      if (/^file:\/\/\//.test(uri)) onGif(uri);
    }}
    onGifError={(event: ErrorEvent) => {
      // Preserve typed text and active comment. Never publish automatically.
      console.warn('[kingdom-lab] keyboard GIF rejected:', event.nativeEvent.message);
    }}
  />;
});
export default KeyboardGifInput;
