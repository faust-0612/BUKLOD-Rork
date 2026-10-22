import { Redirect } from 'expo-router';
import React from 'react';

/**
 * BUKLOD_MAIN_PROFIT_FIRST_SCOPE_R1
 * HOME, KINGDOM and IGPAT are outside this BUKLOD MAIN release.
 * Legacy/deep links recover through the canonical root without loading excluded feature code.
 */
export default function BuklodMainExcludedSurfaceRedirect() {
  return <Redirect href="/" />;
}
