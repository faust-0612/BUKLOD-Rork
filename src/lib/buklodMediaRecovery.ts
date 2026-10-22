/** One recovery request per mounted player; buffering never triggers replacement. */
export function createBuklodMediaRecovery(options: {
  canRecover: () => boolean;
  status: () => string;
  freshUri: () => Promise<string | null>;
  replace: (uri: string | null) => Promise<void>;
  reset: () => void;
}) {
  let alive = true;
  let pending: Promise<void> | null = null;
  const retry = (): Promise<void> => {
    if (pending) return pending;
    if (!alive || !options.canRecover() || options.status() !== 'error') return Promise.resolve();
    // Defer work until pending is set, including synchronously firing native events.
    const task = Promise.resolve().then(async () => {
      const uri = await options.freshUri();
      if (!alive || !options.canRecover() || options.status() !== 'error') return;
      options.reset();
      await options.replace(uri);
    });
    pending = task.finally(() => { pending = null; });
    return pending;
  };
  return { retry, dispose: () => { alive = false; } };
}
