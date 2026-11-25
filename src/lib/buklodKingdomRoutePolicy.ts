/** Explicit Genesis MAIN Kingdom-only routes. Unknown or Arena routes fail closed. */
export const GENESIS_KINGDOM_ROUTES: readonly string[] = [
  "/games",
  "/games/ace-rescue-grid",
  "/games/angel-kingdom-treasury",
  "/games/christian-civic-leadership",
  "/games/elesur-village-builder",
  "/games/genesis-collection",
  "/games/jawo-forest-trail",
  "/games/legacy",
  "/games/lhen-rhythm-journey",
  "/games/mitch-restore-mural",
  "/games/niel-mission-trail",
  "/games/phan-enterprise-builder",
  "/games/practice",
  "/games/quin-discovery-expedition",
  "/games/rewards",
  "/games/trudice-playground-memory",
  "/games/van-living-city-dispatch",
  "/games/vhen-farm-to-market"
];
export function isGenesisKingdomRoute(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '');
  return GENESIS_KINGDOM_ROUTES.includes(path);
}
