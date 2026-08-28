import React from 'react';
import { Redirect } from 'expo-router';

/** Legacy faith path — canonical Word screen is /word on the root stack. */
export default function FaithWordRedirect() {
  return <Redirect href="/word" />;
}
