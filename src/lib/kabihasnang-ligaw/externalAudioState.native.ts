import { peekDzasPlaying } from '@/lib/buklodDzasRadio';
import { getBuklodPttRuntimeState } from '@/ptt/buklodPttRuntime';

export function otherAudioPlaying(): boolean {
  const ptt = getBuklodPttRuntimeState();
  return peekDzasPlaying() || ptt.transmitting || ptt.priorityReceiving;
}
