/* BUKLOD_CHARACTER_ART_RIG_2_VECTOR_R1 */
import React, { useMemo } from 'react';

import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient as SvgLinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { BASE_ASPECT } from '@/lib/character-lab-core/assets';
import { equippedLook } from '@/lib/character-lab-core/localLooks';
import type {
  BodyId,
  Equipment,
  SlotId,
} from '@/lib/character-lab-core/types';

type Props = {
  body: BodyId;
  equipment: Equipment;
  width?: number;
  mode?: 'full' | 'face';
  bustCrop?: boolean;
  showBaseOnly?: boolean;
  enabledCategories?: readonly SlotId[] | 'all';
  eyesClosed?: boolean;
};

function slotOn(
  slot: SlotId,
  enabledCategories: readonly SlotId[] | 'all',
  showBaseOnly: boolean,
) {
  if (showBaseOnly) {
    return slot === 'base';
  }

  if (enabledCategories === 'all') {
    return true;
  }

  return enabledCategories.includes(slot);
}

function token(
  value: unknown,
) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function Hair({
  styleId,
  fill,
  shade,
  female,
}: {
  styleId: string;
  fill: string;
  shade: string;
  female: boolean;
}) {
  const style = token(styleId);

  if (
    style.includes('waves') ||
    style.includes('long')
  ) {
    return (
      <G>
        <Path
          d="M63 94 C55 50 75 28 110 27 C151 25 170 51 160 100 C171 124 163 151 145 166 L132 136 L88 136 L74 167 C56 149 50 121 63 94 Z"
          fill={shade}
        />
        <Path
          d="M67 85 C70 48 85 33 110 32 C142 31 156 50 157 84 C145 65 130 58 111 58 C91 58 77 67 67 85 Z"
          fill={fill}
        />
      </G>
    );
  }

  if (style.includes('loc')) {
    return (
      <G>
        <Path
          d="M68 75 C76 43 91 31 111 31 C137 31 151 47 155 76 C140 60 126 54 110 54 C92 54 80 61 68 75 Z"
          fill={fill}
        />
        {[70, 78, 148, 156].map((x, i) => (
          <Rect
            key={x}
            x={x}
            y={78 + (i % 2) * 5}
            width={8}
            height={61 - (i % 2) * 7}
            rx={4}
            fill={i % 2 ? fill : shade}
          />
        ))}
      </G>
    );
  }

  if (
    style.includes('braid') ||
    style.includes('knot')
  ) {
    return (
      <G>
        <Path
          d="M66 78 C72 46 88 31 111 31 C137 31 151 48 155 79 C144 63 129 56 111 56 C91 56 77 64 66 78 Z"
          fill={fill}
        />
        <Circle
          cx={145}
          cy={44}
          r={15}
          fill={shade}
        />
        <Path
          d="M150 54 C163 77 164 104 152 129 C145 143 149 158 157 168"
          stroke={fill}
          strokeWidth={9}
          strokeLinecap="round"
          fill="none"
        />
      </G>
    );
  }

  if (
    style.includes('crest') ||
    style.includes('warden')
  ) {
    return (
      <G>
        <Path
          d="M67 78 C73 45 91 31 111 31 C139 31 152 48 156 79 C144 64 130 56 110 56 C90 56 77 65 67 78 Z"
          fill={shade}
        />
        <Path
          d="M80 54 C96 24 119 19 145 36 C129 37 115 44 105 57 Z"
          fill={fill}
        />
      </G>
    );
  }

  return (
    <G>
      <Path
        d="M68 76 C75 44 90 31 111 31 C136 31 151 47 155 77 C144 63 129 56 111 56 C92 56 78 64 68 76 Z"
        fill={shade}
      />
      <Path
        d="M78 58 C91 39 108 34 128 39 C112 39 99 47 89 61 Z"
        fill={fill}
        opacity={0.88}
      />
      {female ? (
        <Path
          d="M151 65 C161 87 158 109 149 123"
          stroke={shade}
          strokeWidth={9}
          strokeLinecap="round"
          fill="none"
        />
      ) : null}
    </G>
  );
}

function Face({
  skinFill,
  skinShade,
  line,
  hairFill,
  hairShade,
  hairStyle,
  female,
  eyesClosed,
  accessoryToken,
}: {
  skinFill: string;
  skinShade: string;
  line: string;
  hairFill: string;
  hairShade: string;
  hairStyle: string;
  female: boolean;
  eyesClosed: boolean;
  accessoryToken: string;
}) {
  const iris =
    accessoryToken.includes('blue_eye')
      ? '#3D6F91'
      : accessoryToken.includes('green_eye')
        ? '#3D725A'
        : '#49392F';

  return (
    <G>
      <Hair
        styleId={hairStyle}
        fill={hairFill}
        shade={hairShade}
        female={female}
      />

      <Ellipse
        cx={110}
        cy={99}
        rx={42}
        ry={49}
        fill="url(#skinFace)"
        stroke={skinShade}
        strokeWidth={1.6}
      />

      <Ellipse
        cx={71}
        cy={100}
        rx={7}
        ry={12}
        fill={skinFill}
        stroke={skinShade}
        strokeWidth={1}
      />
      <Ellipse
        cx={149}
        cy={100}
        rx={7}
        ry={12}
        fill={skinFill}
        stroke={skinShade}
        strokeWidth={1}
      />

      <Path
        d="M83 84 C91 79 99 79 104 82"
        stroke={line}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
        opacity={0.75}
      />
      <Path
        d="M116 82 C122 78 132 79 138 84"
        stroke={line}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
        opacity={0.75}
      />

      {eyesClosed ? (
        <>
          <Path
            d="M84 96 C90 101 98 101 103 96"
            stroke={line}
            strokeWidth={2.8}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M117 96 C123 101 131 101 137 96"
            stroke={line}
            strokeWidth={2.8}
            strokeLinecap="round"
            fill="none"
          />
        </>
      ) : (
        <>
          <Ellipse
            cx={94}
            cy={97}
            rx={10}
            ry={6.5}
            fill="#FFFDF9"
          />
          <Ellipse
            cx={127}
            cy={97}
            rx={10}
            ry={6.5}
            fill="#FFFDF9"
          />
          <Circle
            cx={95}
            cy={97}
            r={4.3}
            fill={iris}
          />
          <Circle
            cx={126}
            cy={97}
            r={4.3}
            fill={iris}
          />
          <Circle
            cx={95}
            cy={97}
            r={2.1}
            fill="#141816"
          />
          <Circle
            cx={126}
            cy={97}
            r={2.1}
            fill="#141816"
          />
          <Circle
            cx={96.4}
            cy={95.7}
            r={0.9}
            fill="#FFFFFF"
          />
          <Circle
            cx={127.4}
            cy={95.7}
            r={0.9}
            fill="#FFFFFF"
          />
        </>
      )}

      <Path
        d="M110 99 C108 108 105 113 108 116 C111 118 115 117 117 115"
        stroke={skinShade}
        strokeWidth={1.7}
        strokeLinecap="round"
        fill="none"
        opacity={0.82}
      />

      <Path
        d={
          female
            ? 'M94 127 C103 135 119 135 128 127 C120 143 103 143 94 127 Z'
            : 'M95 127 C103 134 118 134 126 127 C119 139 103 139 95 127 Z'
        }
        fill={female ? '#A95858' : '#7C4A45'}
        opacity={0.9}
      />

      <Ellipse
        cx={83}
        cy={117}
        rx={9}
        ry={4}
        fill="#E6958B"
        opacity={0.16}
      />
      <Ellipse
        cx={137}
        cy={117}
        rx={9}
        ry={4}
        fill="#E6958B"
        opacity={0.16}
      />

      {accessoryToken.includes('glass') ? (
        <G
          stroke="#25342C"
          strokeWidth={2.3}
          fill="rgba(255,255,255,0.08)"
        >
          <Rect
            x={78}
            y={88}
            width={30}
            height={19}
            rx={7}
          />
          <Rect
            x={113}
            y={88}
            width={30}
            height={19}
            rx={7}
          />
          <Path d="M108 96 L113 96" />
        </G>
      ) : null}

      {accessoryToken.includes('crown') ? (
        <Path
          d="M82 51 L92 29 L107 48 L121 27 L138 51 L135 63 L85 63 Z"
          fill="#E2B84F"
          stroke="#8B6920"
          strokeWidth={1.4}
        />
      ) : null}
    </G>
  );
}

/**
 * Character Art / Rig 2.0
 *
 * The existing BUKLOD reward system is still authoritative. This renderer
 * only reads the equipped look and turns it into layered vector art.
 */
export default function BuklodLocalCharacterFigure({
  body,
  equipment,
  width,
  mode = 'full',
  bustCrop = false,
  showBaseOnly = false,
  enabledCategories = 'all',
  eyesClosed = false,
}: Props) {
  const look = useMemo(
    () => equippedLook(equipment, body) as any,
    [equipment, body],
  );

  const female = body === 'female';
  const faceOnly = mode === 'face';
  const aspect = BASE_ASPECT[body];

  const show =
    (slot: SlotId) =>
      slotOn(
        slot,
        enabledCategories,
        showBaseOnly,
      );

  const skinFill =
    look?.skin?.fill ?? '#C88762';
  const skinShade =
    look?.skin?.shade ?? '#945C43';
  const skinLine =
    look?.skin?.line ?? '#4B3229';

  const topColor =
    show('top')
      ? look?.topColor?.[1]
      : look?.baseSwatch?.[1];

  const topShade =
    show('top')
      ? look?.topColor?.[0]
      : look?.baseSwatch?.[0];

  const bottomColor =
    show('bottom')
      ? look?.bottomColor?.[1]
      : look?.baseSwatch?.[1];

  const bottomShade =
    show('bottom')
      ? look?.bottomColor?.[0]
      : look?.baseSwatch?.[0];

  const shoeColor =
    show('shoes')
      ? look?.shoesColor?.[0]
      : skinShade;

  const hairFill =
    show('hair')
      ? look?.hairColor ?? '#303733'
      : '#3A4A44';

  const hairShade =
    show('hair')
      ? look?.hairShade ?? '#202723'
      : '#2A3531';

  const hairStyle =
    show('hair')
      ? token(look?.hairStyle)
      : 'crop';

  const topId =
    show('top')
      ? token(look?.topId)
      : 'base';

  const bottomId =
    show('bottom')
      ? token(look?.bottomId)
      : 'base';

  const shoesId =
    show('shoes')
      ? token(look?.shoesId)
      : 'base';

  const accessoryToken = [
    token((equipment as any)?.accessory),
    token((equipment as any)?.accessories),
    token(look?.accessoryId),
    token(look?.accessory),
    token(look?.specialId),
  ].join(' ');

  const specialToken = [
    token((equipment as any)?.special),
    token(look?.effect),
    token(look?.specialId),
  ].join(' ');

  const longBottom =
    bottomId.includes('long') ||
    bottomId.includes('wrap');

  const armored =
    bottomId.includes('greave') ||
    bottomId.includes('armor');

  const jacketed =
    topId.includes('jacket') ||
    topId.includes('mantle') ||
    topId.includes('regalia');

  const viewBox =
    faceOnly
      ? '42 20 136 146'
      : bustCrop
        ? '25 18 170 245'
        : '0 0 220 420';

  const sized =
    width
      ? {
          width,
          height:
            faceOnly || bustCrop
              ? width
              : width / aspect,
        }
      : styles.fill;

  return (
    <View
      style={[
        styles.root,
        sized,
      ]}
      pointerEvents="none"
    >
      <Svg
        width="100%"
        height="100%"
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
      >
        <Defs>
          <SvgLinearGradient
            id="skinFace"
            x1="0"
            y1="0"
            x2="1"
            y2="1"
          >
            <Stop
              offset="0"
              stopColor="#FFFFFF"
              stopOpacity={0.18}
            />
            <Stop
              offset="0.34"
              stopColor={skinFill}
              stopOpacity={1}
            />
            <Stop
              offset="1"
              stopColor={skinShade}
              stopOpacity={0.96}
            />
          </SvgLinearGradient>

          <SvgLinearGradient
            id="topGrad"
            x1="0"
            y1="0"
            x2="1"
            y2="1"
          >
            <Stop
              offset="0"
              stopColor={topColor}
            />
            <Stop
              offset="1"
              stopColor={topShade}
            />
          </SvgLinearGradient>

          <SvgLinearGradient
            id="bottomGrad"
            x1="0"
            y1="0"
            x2="1"
            y2="1"
          >
            <Stop
              offset="0"
              stopColor={bottomColor}
            />
            <Stop
              offset="1"
              stopColor={bottomShade}
            />
          </SvgLinearGradient>

          <RadialGradient
            id="auraGrad"
            cx="50%"
            cy="45%"
            rx="50%"
            ry="55%"
          >
            <Stop
              offset="0"
              stopColor={
                look?.effectColor ??
                '#70C490'
              }
              stopOpacity={0.28}
            />
            <Stop
              offset="1"
              stopColor={
                look?.effectColor ??
                '#70C490'
              }
              stopOpacity={0}
            />
          </RadialGradient>
        </Defs>

        {!faceOnly &&
        show('special') &&
        specialToken.includes('aura') ? (
          <Ellipse
            cx={110}
            cy={207}
            rx={103}
            ry={189}
            fill="url(#auraGrad)"
          />
        ) : null}

        {!faceOnly ? (
          <G>
            <Ellipse
              cx={110}
              cy={405}
              rx={58}
              ry={10}
              fill="#10261A"
              opacity={0.12}
            />

            <Path
              d={
                female
                  ? 'M83 252 C87 237 96 229 110 228 C125 229 134 238 138 252 L145 320 L126 320 L121 389 L99 389 L94 320 L75 320 Z'
                  : 'M77 250 C84 235 95 227 110 227 C126 227 138 236 144 251 L149 320 L128 320 L123 389 L98 389 L93 320 L71 320 Z'
              }
              fill="url(#bottomGrad)"
            />

            {longBottom ? (
              <Path
                d="M75 270 C80 252 93 242 110 242 C128 242 141 253 146 270 L154 357 C139 371 127 377 110 377 C92 377 79 371 65 357 Z"
                fill="url(#bottomGrad)"
                opacity={0.96}
              />
            ) : null}

            {armored ? (
              <>
                <Rect
                  x={82}
                  y={310}
                  width={23}
                  height={76}
                  rx={9}
                  fill={bottomShade}
                  stroke="#FFFFFF"
                  strokeOpacity={0.16}
                />
                <Rect
                  x={116}
                  y={310}
                  width={23}
                  height={76}
                  rx={9}
                  fill={bottomShade}
                  stroke="#FFFFFF"
                  strokeOpacity={0.16}
                />
              </>
            ) : null}

            <Path
              d={
                female
                  ? 'M76 170 C80 151 92 142 110 142 C128 142 140 151 144 170 L137 262 C126 272 94 272 83 262 Z'
                  : 'M69 169 C76 149 91 141 110 141 C130 141 145 150 151 170 L140 260 C126 269 94 269 80 260 Z'
              }
              fill="url(#topGrad)"
              stroke={topShade}
              strokeWidth={1.3}
            />

            <Path
              d="M105 140 L115 140 L119 165 C114 171 106 171 101 165 Z"
              fill={skinFill}
              stroke={skinShade}
              strokeWidth={1}
            />

            <Path
              d={
                female
                  ? 'M76 173 C60 180 56 207 61 246 C63 261 70 268 79 263 L87 211 Z'
                  : 'M70 174 C53 184 50 209 56 248 C58 262 66 269 76 264 L87 210 Z'
              }
              fill={jacketed ? topShade : skinFill}
              stroke={jacketed ? topShade : skinShade}
              strokeWidth={1}
            />
            <Path
              d={
                female
                  ? 'M144 173 C160 180 164 207 159 246 C157 261 150 268 141 263 L133 211 Z'
                  : 'M150 174 C167 184 170 209 164 248 C162 262 154 269 144 264 L133 210 Z'
              }
              fill={jacketed ? topShade : skinFill}
              stroke={jacketed ? topShade : skinShade}
              strokeWidth={1}
            />

            {jacketed ? (
              <G>
                <Path
                  d="M82 157 L105 183 L93 229 L78 172 Z"
                  fill={topShade}
                  opacity={0.92}
                />
                <Path
                  d="M138 157 L115 183 L127 229 L142 172 Z"
                  fill={topShade}
                  opacity={0.92}
                />
                <Path
                  d="M109 182 L111 255"
                  stroke="#FFFFFF"
                  strokeOpacity={0.22}
                  strokeWidth={2}
                />
              </G>
            ) : null}

            {topId.includes('regalia') ? (
              <G>
                <Path
                  d="M76 190 C93 181 127 181 144 190"
                  stroke="#DDBD65"
                  strokeWidth={5}
                  strokeLinecap="round"
                />
                <Circle
                  cx={110}
                  cy={204}
                  r={8}
                  fill="#E6C96F"
                  stroke="#9D7A24"
                  strokeWidth={1.2}
                />
              </G>
            ) : null}

            <Path
              d={
                shoesId.includes('sandal')
                  ? 'M76 385 L102 385 L102 397 L70 397 C70 391 72 387 76 385 Z'
                  : 'M72 382 L103 382 L105 401 L66 401 C66 391 68 386 72 382 Z'
              }
              fill={shoeColor}
            />
            <Path
              d={
                shoesId.includes('sandal')
                  ? 'M118 385 L144 385 C148 387 150 391 150 397 L118 397 Z'
                  : 'M117 382 L148 382 C152 386 154 391 154 401 L115 401 Z'
              }
              fill={shoeColor}
            />
          </G>
        ) : null}

        <Face
          skinFill={skinFill}
          skinShade={skinShade}
          line={skinLine}
          hairFill={hairFill}
          hairShade={hairShade}
          hairStyle={hairStyle}
          female={female}
          eyesClosed={eyesClosed}
          accessoryToken={accessoryToken}
        />

        {!faceOnly &&
        show('accessory') &&
        accessoryToken.includes('badge') ? (
          <Circle
            cx={135}
            cy={192}
            r={7}
            fill="#E1BC58"
            stroke="#7B5B13"
            strokeWidth={1}
          />
        ) : null}
      </Svg>
    </View>
  );
}

const styles =
  StyleSheet.create({
    root: {
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'visible',
    },
    fill: {
      width: '100%',
      height: '100%',
    },
  });