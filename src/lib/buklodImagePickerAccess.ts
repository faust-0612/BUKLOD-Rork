import { Platform } from 'react-native';

import type { PermissionResponse } from 'expo-image-picker';

type RequestMediaLibraryPermissions =
  () => Promise<PermissionResponse>;

/**
 * Android Photo Picker does not require broad READ_MEDIA_* grants.
 * iOS still needs the standard photo-library permission prompt.
 */
export async function ensureImagePickerLibraryAccess(
  requestPermission: RequestMediaLibraryPermissions
): Promise<boolean> {
  if (Platform.OS === 'android') {
    return true;
  }

  const permission = await requestPermission();
  return permission.granted;
}
