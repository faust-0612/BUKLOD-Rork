/* BUKLOD_RIVE_NATIVE_AVATAR_FOUNDATION_R1_4 */
import type {
  BodyId,
  Equipment,
} from '@/lib/character-lab-core/types';

export type BuklodRiveCharacterState = {
  body: BodyId;
  lifetimePoints: number;
  rankOrder: number;
  rankName: string;

  hair: string | null;
  top: string | null;
  bottom: string | null;
  shoes: string | null;
  accessory: string | null;
  special: string | null;

  idle: boolean;
};

export const
BUKLOD_RIVE_BINDINGS = {
  body:
    'Character/Body',
  lifetimePoints:
    'Progress/LifetimePoints',
  rankOrder:
    'Progress/RankOrder',
  rankName:
    'Progress/RankName',

  hair:
    'Look/Hair',
  top:
    'Look/Top',
  bottom:
    'Look/Bottom',
  shoes:
    'Look/Shoes',
  accessory:
    'Look/Accessory',
  special:
    'Look/Special',

  idle:
    'Motion/Idle',
} as const;

function stringOrNull(
  value: unknown,
) {
  const text =
    String(
      value ?? ''
    ).trim();

  return text || null;
}

export function
toBuklodRiveCharacterState({
  body,
  equipment,
  lifetimePoints,
  rankOrder,
  rankName,
}: {
  body: BodyId;
  equipment: Equipment;
  lifetimePoints: number;
  rankOrder: number;
  rankName: string;
}): BuklodRiveCharacterState {
  const e =
    equipment as unknown as
      Record<
        string,
        unknown
      >;

  return {
    body,

    lifetimePoints:
      Math.max(
        0,
        Number(
          lifetimePoints || 0
        ),
      ),

    rankOrder:
      Math.max(
        0,
        Number(
          rankOrder || 0
        ),
      ),

    rankName:
      String(
        rankName ?? ''
      ),

    hair:
      stringOrNull(
        e.hair
      ),

    top:
      stringOrNull(
        e.top
      ),

    bottom:
      stringOrNull(
        e.bottom
      ),

    shoes:
      stringOrNull(
        e.shoes
      ),

    accessory:
      stringOrNull(
        e.accessory ??
          e.accessories
      ),

    special:
      stringOrNull(
        e.special
      ),

    idle: true,
  };
}