import React from 'react';
import { Slot } from 'expo-router';
import { BuklodLifeLanguageProvider } from '@/providers/BuklodLifeLanguageProvider';

/** Hydrate the user's language before rendering any LIFE route. */
export default function BuklodLifeLayout() {
  return (
    <BuklodLifeLanguageProvider>
      <Slot />
    </BuklodLifeLanguageProvider>
  );
}
