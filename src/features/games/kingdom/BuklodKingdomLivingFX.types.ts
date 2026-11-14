/** Shared scene contract. No asset, backend, or point-authority changes. */
export type KingdomFXStation = { x: number; y: number; accent: string };
export type KingdomLivingFXProps = {
  stage: number;
  mapWidth: number;
  mapHeight: number;
  scale: number;
  selected: KingdomFXStation;
  cleared: readonly KingdomFXStation[];
  cinematic: boolean;
};
