import { getSharedPayloads } from 'expo-sharing';
import { captureBuklodReferralCodeFromPath } from '@/lib/buklodReferralV2';

/* BUKLOD_NATIVE_INCOMING_SHARE_R2 */
export async function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}) {
  try {
    const referralCode=await captureBuklodReferralCodeFromPath(path,'NATIVE_DEEPLINK');
    if(referralCode){
      return `/register?ref=${encodeURIComponent(referralCode)}`;
    }

    if (getSharedPayloads().length > 0) {
      return '/handle-share';
    }
  } catch {
    // Preserve the original system route if native share inspection fails.
  }

  return path;
}
