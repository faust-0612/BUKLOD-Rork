import {
  CharacterEventType,
  type CharacterEventPayload,
} from '@/lib/buklodCharacterEvents';

/**
 * Production event adapters — prepare-only hooks for later backend integration.
 * Do NOT emit these from fabricated test flows; wire from real domain events only.
 */

export type PointsClaimedPayload = {
  points: number;
  title?: string;
  spokenText?: string;
};

export type ItemUnlockedPayload = {
  itemId: string;
  itemName: string;
};

export type ItemEquippedPayload = {
  itemId: string;
  itemName?: string;
};

export type AttendanceRecordedPayload = {
  dialogue?: string;
};

export type MilestoneReachedPayload = {
  milestoneLabel: string;
};

export function adaptPointsClaimed(
  payload: PointsClaimedPayload
): CharacterEventPayload {
  return {
    type: CharacterEventType.POINTS_CLAIMED,
    success: true,
    points: payload.points,
    dialogue: payload.title,
    spokenText: payload.spokenText,
  };
}

export function adaptItemUnlocked(
  payload: ItemUnlockedPayload
): CharacterEventPayload {
  return {
    type: CharacterEventType.ITEM_UNLOCKED,
    success: true,
    itemId: payload.itemId,
    itemName: payload.itemName,
  };
}

export function adaptItemEquipped(
  payload: ItemEquippedPayload
): CharacterEventPayload {
  return {
    type: CharacterEventType.ITEM_EQUIPPED,
    success: true,
    itemId: payload.itemId,
    itemName: payload.itemName,
  };
}

export function adaptAttendanceRecorded(
  payload: AttendanceRecordedPayload = {}
): CharacterEventPayload {
  return {
    type: CharacterEventType.ATTENDANCE_RECORDED,
    success: true,
    dialogue: payload.dialogue,
  };
}

export function adaptMilestoneReached(
  payload: MilestoneReachedPayload
): CharacterEventPayload {
  return {
    type: CharacterEventType.MILESTONE_REACHED,
    success: true,
    milestoneLabel: payload.milestoneLabel,
  };
}
