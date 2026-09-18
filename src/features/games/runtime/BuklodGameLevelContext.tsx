import React, { createContext, useContext, useMemo } from 'react';

export type BuklodKingdomLevelContextValue = {
  level: number;
  difficulty: number;
  speedMultiplier: number;
  targetMultiplier: number;
  resourceMultiplier: number;
};

const DEFAULT_VALUE: BuklodKingdomLevelContextValue = {
  level: 1,
  difficulty: 1,
  speedMultiplier: 1,
  targetMultiplier: 1,
  resourceMultiplier: 1,
};

const Context = createContext<BuklodKingdomLevelContextValue>(DEFAULT_VALUE);

export function BuklodKingdomLevelProvider({
  value,
  children,
}: {
  value: BuklodKingdomLevelContextValue;
  children: React.ReactNode;
}) {
  const stable = useMemo(
    () => ({
      level: Math.max(1, Math.min(20, Math.floor(value.level || 1))),
      difficulty: Math.max(1, value.difficulty || 1),
      speedMultiplier: Math.max(1, value.speedMultiplier || 1),
      targetMultiplier: Math.max(1, value.targetMultiplier || 1),
      resourceMultiplier: Math.max(0.4, Math.min(1, value.resourceMultiplier || 1)),
    }),
    [
      value.difficulty,
      value.level,
      value.resourceMultiplier,
      value.speedMultiplier,
      value.targetMultiplier,
    ],
  );

  return <Context.Provider value={stable}>{children}</Context.Provider>;
}

export function useBuklodKingdomLevel() {
  return useContext(Context);
}
