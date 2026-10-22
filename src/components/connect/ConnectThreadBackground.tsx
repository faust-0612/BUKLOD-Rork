import React, {
  useMemo,
} from 'react';
import {
  ImageBackground,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import {
  isDarkHexColor,
  resolveChatBackgroundBaseColor,
  resolveChatBackgroundOverlayColor,
  resolveChatBackgroundPreset,
  type ChatBackgroundConfig,
} from '@/lib/chatBackground';
import {
  useChatBackground,
} from '@/providers/ChatBackgroundProvider';
import {
  useConnectTheme,
} from '@/providers/ConnectThemeProvider';

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
};

function PatternLayer({
  pattern,
  color,
  baseColor,
}: {
  pattern: 'dots' | 'grid' | 'diagonal' | 'waves';
  color: string;
  baseColor: string;
}) {
  const dots = useMemo(() => {
    if (pattern !== 'dots') {
      return null;
    }

    const items = [];

    for (let row = 0; row < 18; row += 1) {
      for (let col = 0; col < 12; col += 1) {
        items.push(
          <View
            key={`${row}-${col}`}
            style={{
              position: 'absolute',
              left: col * 28 + (row % 2) * 14,
              top: row * 28,
              width: 4,
              height: 4,
              borderRadius: 2,
              backgroundColor: color,
            }}
          />
        );
      }
    }

    return items;
  }, [pattern, color]);

  if (pattern === 'dots') {
    return (
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: baseColor },
        ]}
      >
        {dots}
      </View>
    );
  }

  if (pattern === 'grid') {
    const lines = [];

    for (let i = 0; i < 24; i += 1) {
      lines.push(
        <View
          key={`h-${i}`}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: i * 24,
            height: 1,
            backgroundColor: color,
          }}
        />
      );
      lines.push(
        <View
          key={`v-${i}`}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: i * 24,
            width: 1,
            backgroundColor: color,
          }}
        />
      );
    }

    return (
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: baseColor },
        ]}
      >
        {lines}
      </View>
    );
  }

  if (pattern === 'diagonal') {
    const stripes = [];

    for (let i = -8; i < 24; i += 1) {
      stripes.push(
        <View
          key={`d-${i}`}
          style={{
            position: 'absolute',
            left: i * 32 - 40,
            top: -40,
            width: 2,
            height: '160%',
            backgroundColor: color,
            transform: [{ rotate: '32deg' }],
          }}
        />
      );
    }

    return (
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: baseColor, overflow: 'hidden' },
        ]}
      >
        {stripes}
      </View>
    );
  }

  // waves — soft horizontal bands
  const bands = [];

  for (let i = 0; i < 10; i += 1) {
    bands.push(
      <View
        key={`w-${i}`}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: i * 48,
          height: 20,
          borderRadius: 10,
          backgroundColor: color,
          opacity: 0.55,
        }}
      />
    );
  }

  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: baseColor },
      ]}
    >
      {bands}
    </View>
  );
}

function BackgroundLayers({
  config,
  themeCanvas,
}: {
  config: ChatBackgroundConfig;
  themeCanvas: string;
}) {
  const baseColor = resolveChatBackgroundBaseColor(
    config,
    themeCanvas
  );
  const preset = resolveChatBackgroundPreset(config);
  const layerOpacity = config.intensity;
  const isDark = isDarkHexColor(baseColor);
  const overlayColor =
    resolveChatBackgroundOverlayColor(
      config.overlay,
      isDark
    );

  if (config.kind === 'themeDefault') {
    return (
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: themeCanvas },
        ]}
      />
    );
  }

  if (
    config.kind === 'customImage' &&
    config.imageUri
  ) {
    return (
      <>
        <ImageBackground
          source={{ uri: config.imageUri }}
          resizeMode="cover"
          style={[
            StyleSheet.absoluteFill,
            { opacity: layerOpacity },
          ]}
        />
        {overlayColor ? (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: overlayColor },
            ]}
          />
        ) : null}
      </>
    );
  }

  if (
    config.kind === 'gradient' &&
    preset?.gradientColors
  ) {
    return (
      <>
        <LinearGradient
          colors={preset.gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            StyleSheet.absoluteFill,
            { opacity: layerOpacity },
          ]}
        />
        {overlayColor ? (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: overlayColor },
            ]}
          />
        ) : null}
      </>
    );
  }

  if (
    config.kind === 'pattern' &&
    preset?.pattern
  ) {
    return (
      <>
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { opacity: layerOpacity },
          ]}
        >
          <PatternLayer
            pattern={preset.pattern}
            color={
              preset.patternColor ??
              'rgba(0,0,0,0.08)'
            }
            baseColor={
              preset.color ?? baseColor
            }
          />
        </View>
        {overlayColor ? (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: overlayColor },
            ]}
          />
        ) : null}
      </>
    );
  }

  const fillColor =
    config.customColor ??
    preset?.color ??
    baseColor;

  return (
    <>
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: fillColor,
            opacity: layerOpacity,
          },
        ]}
      />
      {overlayColor ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: overlayColor },
          ]}
        />
      ) : null}
    </>
  );
}

export function ConnectThreadBackground({
  children,
  style,
}: Props) {
  const { theme } = useConnectTheme();
  const {
    effectiveBackground,
  } = useChatBackground();

  return (
    <View
      style={[
        { flex: 1, backgroundColor: theme.canvas },
        style,
      ]}
    >
      <BackgroundLayers
        config={effectiveBackground}
        themeCanvas={theme.canvas}
      />
      <View style={{ flex: 1 }}>
        {children}
      </View>
    </View>
  );
}
