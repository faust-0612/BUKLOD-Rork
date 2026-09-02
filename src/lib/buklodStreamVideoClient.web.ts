type ClientListener = (
  client: any | null
) => void;

export function subscribeBuklodStreamVideoClient(
  listener: ClientListener
) {
  listener(null);

  return () => {
    // No native Stream client on web.
  };
}

export function getCachedBuklodStreamVideoClient():
  null {
  return null;
}

export async function ensureBuklodStreamVideoClient():
  Promise<any> {
  throw new Error(
    'BUKLOD browser calling is not enabled yet.'
  );
}

export function prewarmBuklodStreamVideoClient():
  void {
  // No-op on web.
}

export async function disconnectBuklodStreamVideoClient():
  Promise<void> {
  // No-op on web.
}
