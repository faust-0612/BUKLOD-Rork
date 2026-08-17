import {
  Fragment,
  createElement,
  type PropsWithChildren,
} from 'react';

export type User = {
  id: string;
  name?: string;
  image?: string;
  [key: string]: unknown;
};

export function useStreamVideoClient(): any {
  return null;
}

export function useCall(): any {
  return null;
}

export function useCalls(): any[] {
  return [];
}

export function useCallStateHooks(): any {
  return new Proxy(
    {},
    {
      get() {
        return () => null;
      },
    }
  );
}

export function StreamVideo({
  children,
}: PropsWithChildren<{
  client?: unknown;
}>) {
  return createElement(
    Fragment,
    null,
    children
  );
}

export function StreamCall({
  children,
}: PropsWithChildren<{
  call?: unknown;
}>) {
  return createElement(
    Fragment,
    null,
    children
  );
}

export function CallContent() {
  return null;
}

export function CallControls() {
  return null;
}

export function ScreenShareToggleButton() {
  return null;
}

export function RingingCallContent() {
  return null;
}

export const OwnCapability =
  new Proxy(
    {},
    {
      get(
        _target,
        property
      ) {
        return String(property);
      },
    }
  ) as any;

export const StreamVideoRN =
  new Proxy(
    {},
    {
      get() {
        return () => undefined;
      },
    }
  ) as any;

export class StreamVideoClient {
  static getOrCreateInstance(): never {
    throw new Error(
      'BUKLOD browser calling is not enabled yet.'
    );
  }
}
