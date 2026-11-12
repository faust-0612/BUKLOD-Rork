/**
 * Android BUKLOD passive video allocation ceiling.
 * For already-visible video playback this module is NEVER consulted.
 * One offscreen CommunityVideo warm/preload decoder is allowed at a time.
 * A recently visible paused player has priority over a distant next-row
 * preload, preserving fast scroll-back without multiplying passive decoders.
 */
export type BuklodPassiveVideoPriority = 'preload' | 'warm';
type Slot = { priority: BuklodPassiveVideoPriority; order: number };
const slots = new Map<object, Slot>();
const listeners = new Set<() => void>();
let order = 0;

function selectedSlot(): object | null {
  let winner: object | null = null;
  let highest = -1;
  let firstOrder = Number.POSITIVE_INFINITY;
  for (const [id, slot] of slots) {
    const priority = slot.priority === 'warm' ? 2 : 1;
    if (priority > highest || (priority === highest && slot.order < firstOrder)) {
      winner = id;
      highest = priority;
      firstOrder = slot.order;
    }
  }
  return winner;
}

function publish() {
  for (const listener of [...listeners]) listener();
}

export function subscribeBuklodPassiveVideoSlots(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function isBuklodPassiveVideoSlotAdmitted(slotId: object): boolean {
  return slots.has(slotId) && selectedSlot() === slotId;
}

export function registerBuklodPassiveVideoSlot(
  slotId: object,
  priority: BuklodPassiveVideoPriority,
): () => void {
  const existing = slots.get(slotId);
  slots.set(slotId, { priority, order: existing?.order ?? ++order });
  publish();
  return () => {
    if (slots.delete(slotId)) publish();
  };
}

/** Test-only isolation; never invoked in app code. */
export function __resetBuklodPassiveVideoBudgetForTests(): void {
  slots.clear();
  order = 0;
  publish();
}
