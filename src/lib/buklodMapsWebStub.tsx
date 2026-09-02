import React from 'react';
import { View, type ViewProps } from 'react-native';

type MapStubProps = ViewProps & {
  children?: React.ReactNode;
};

export const PROVIDER_GOOGLE = 'google';
export const PROVIDER_DEFAULT = undefined;

export function Marker(_props: Record<string, unknown>) {
  return null;
}

export function Circle(_props: Record<string, unknown>) {
  return null;
}

export function Polyline(_props: Record<string, unknown>) {
  return null;
}

export function Polygon(_props: Record<string, unknown>) {
  return null;
}

export function Callout(_props: Record<string, unknown>) {
  return null;
}

function MapView({ children, style, ...rest }: MapStubProps) {
  return (
    <View {...rest} style={style}>
      {children}
    </View>
  );
}

export default MapView;
