import React from 'react';
import { View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';

/**
 * GENESIS: The Seed of Glory seasonal icon.
 *
 * An illuminated emerald seed with a contained double-helix engraving,
 * three emerging roots and radiant harvest-gold rings. The helix references
 * genetic potential without suggesting a literal biotechnology feature.
 *
 * Deliberately not mounted in production; opt in from authorized Season 2 UI.
 * Static local SVG; no network, loops, images, additional assets or animation.
 */
export default function GenesisGlowingSeedEmblem({
  size = 72,
}: {
  size?: number;
}) {
  const iconSize = Number.isFinite(size)
    ? Math.max(28, Math.min(240, size))
    : 72;

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: iconSize, height: iconSize }}
    >
      <Svg width={iconSize} height={iconSize} viewBox="0 0 160 160">
        <Defs>
          <RadialGradient id="seedGlow" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor="#D8F7B4" stopOpacity="0.45" />
            <Stop offset="0.55" stopColor="#A9E890" stopOpacity="0.21" />
            <Stop offset="1" stopColor="#A9E890" stopOpacity="0" />
          </RadialGradient>
          <LinearGradient id="seedCoat" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#B8F5A1" />
            <Stop offset="0.35" stopColor="#3DCA8C" />
            <Stop offset="0.72" stopColor="#177E5E" />
            <Stop offset="1" stopColor="#0B493E" />
          </LinearGradient>
          <LinearGradient id="seedLine" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFF2B3" />
            <Stop offset="1" stopColor="#C5EAA6" />
          </LinearGradient>
        </Defs>
        <Circle cx="80" cy="77" r="76" fill="url(#seedGlow)" />
        <Circle cx="80" cy="77" r="61" stroke="#EACF7F" strokeWidth="1.5" strokeOpacity="0.62" fill="none" />
        <Circle cx="80" cy="77" r="53" stroke="#EACF7F" strokeWidth="0.7" strokeOpacity="0.4" strokeDasharray="1.5 6" fill="none" />
        <Path d="M80 34 C53 51 47 75 59 96 C69 113 91 115 103 98 C120 75 105 49 80 34Z"
          fill="url(#seedCoat)" stroke="#EAF5B8" strokeWidth="1.8" />
        <Path d="M72 49 C92 62 72 79 94 100 M93 49 C72 63 93 81 71 100"
          stroke="url(#seedLine)" strokeWidth="2.7" strokeLinecap="round" fill="none" />
        <Path d="M74 57 L91 57 M72 68 L93 69 M74 79 L91 80 M73 90 L91 91"
          stroke="#F2E9A8" strokeWidth="1.25" strokeOpacity="0.85" fill="none" />
        <Ellipse cx="74" cy="53" rx="11" ry="4" transform="rotate(-45 74 53)"
          fill="#E9FFD2" fillOpacity="0.43" />
        <Path d="M80 112 C77 126 69 133 56 141 M80 114 C84 129 95 135 108 141 M80 113 L80 144"
          stroke="#E8D18E" strokeWidth="2" strokeLinecap="round" fill="none" />
        <Path d="M80 6 L80 19 M33 29 L42 38 M126 29 L117 38 M18 77 L31 77 M142 77 L129 77"
          stroke="#F8DD8C" strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.9" fill="none" />
        <Circle cx="80" cy="7" r="2.5" fill="#FFE5A2" />
        <Circle cx="126" cy="29" r="2" fill="#FFE5A2" />
        <Circle cx="33" cy="29" r="2" fill="#FFE5A2" />
      </Svg>
    </View>
  );
}
