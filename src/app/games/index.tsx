import React from 'react';

import BuklodKingdomMap from '@/features/games/kingdom/BuklodKingdomMap';
import { setBuklodKingdomProgressOwner } from '@/features/games/kingdom/progress';
import { useAuth } from '@/providers/AuthProvider';

export default function BuklodKingdomScreen() {
  const { user } = useAuth();

  // Set the synchronous local progression namespace before the map mounts so
  // legacy no-argument Kingdom progress calls resolve to this signed-in user.
  setBuklodKingdomProgressOwner(user?.id ?? null);

  return <BuklodKingdomMap />;
}
