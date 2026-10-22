// Web startup isolation: push ringing is native-only.
// Keep the browser bootstrap free of native Stream push setup.
export async function rememberStreamPushUser(
  _userId: string,
  _userName?: string | null,
) {
  return;
}

export function setPushConfig() {
  // Intentionally no-op on web.
}
