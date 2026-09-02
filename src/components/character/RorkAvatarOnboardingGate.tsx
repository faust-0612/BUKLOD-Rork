import React, { useCallback, useEffect, useState } from 'react';

import BuklodCharacterBodyPicker from '@/components/points/BuklodCharacterBodyPicker';
import { useAuth } from '@/providers/AuthProvider';
import {
  DEFAULT_CHARACTER,
  loadBuklodCharacter,
  saveBuklodCharacter,
  setBody,
  type BuklodCharacterState,
} from '@/lib/buklodCharacter';
import {
  isRorkAvatarOnboardingCompleted,
  markRorkAvatarOnboardingCompleted,
  migrateLegacyRorkAvatarOnboardingIfNeeded,
} from '@/lib/buklodRorkAvatarOnboarding';
import type { BodyId } from '@/lib/character-lab-core/types';

/**
 * One-time Rork avatar chooser after authentication.
 * Separate from Profile Picture, nav avatar, and Suggested Login avatar.
 */
export default function RorkAvatarOnboardingGate() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const user = session?.user ?? null;

  const [checking, setChecking] = useState(Boolean(userId));
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [character, setCharacter] =
    useState<BuklodCharacterState>(DEFAULT_CHARACTER);

  useEffect(() => {
    if (!userId) {
      setChecking(false);
      setNeedsOnboarding(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      setChecking(true);

      try {
        await migrateLegacyRorkAvatarOnboardingIfNeeded(userId, user);

        const complete = await isRorkAvatarOnboardingCompleted(
          userId,
          user
        );

        const loaded = await loadBuklodCharacter(userId);

        if (cancelled) return;

        setCharacter(loaded);
        setNeedsOnboarding(!complete);
      } finally {
        if (!cancelled) {
          setChecking(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, user]);

  const handleChoose = useCallback(
    async (body: BodyId) => {
      if (!userId) return;

      const next = setBody(character, body, 0);
      const saved: BuklodCharacterState = {
        ...next,
        bodyChosen: true,
      };

      await saveBuklodCharacter(saved, userId);
      await markRorkAvatarOnboardingCompleted(userId, user);

      setCharacter(saved);
      setNeedsOnboarding(false);
    },
    [character, userId, user]
  );

  if (!userId || checking || !needsOnboarding) {
    return null;
  }

  return (
    <BuklodCharacterBodyPicker visible onChoose={handleChoose} />
  );
}
