import React from 'react';
import { Redirect } from 'expo-router';

export default function ConnectIndexRedirect() {
  return <Redirect href="/messages" />;
}
