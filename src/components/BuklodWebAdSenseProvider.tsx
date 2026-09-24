import React, { Fragment, type ReactNode } from 'react';

export default function BuklodWebAdSenseProvider({
  children,
}: {
  children: ReactNode;
}) {
  return <Fragment>{children}</Fragment>;
}
