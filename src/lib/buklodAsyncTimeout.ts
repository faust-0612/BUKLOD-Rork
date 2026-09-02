/*
 * BUKLOD_GLOBAL_BOOT_R20
 *
 * Bound remote/bootstrap waits so the app shell can recover from
 * requests that never settle on web or weak mobile connections.
 * This does not cancel the underlying request; it only bounds how
 * long UI state is allowed to wait for it.
 */
export class BuklodRequestTimeoutError extends Error {
  constructor(
    label: string,
    timeoutMs: number
  ) {
    super(`${label} timed out after ${timeoutMs}ms.`);
    this.name = 'BuklodRequestTimeoutError';
  }
}

export async function withBuklodTimeout<T>(
  task: PromiseLike<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      Promise.resolve(task),
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(
            new BuklodRequestTimeoutError(
              label,
              timeoutMs
            )
          );
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
