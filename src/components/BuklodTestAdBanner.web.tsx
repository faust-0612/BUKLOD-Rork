export type BuklodTestAdBannerProps = {
  [key: string]: unknown;
};

export function BuklodTestAdBanner(
  _props: BuklodTestAdBannerProps
) {
  // Native AdMob test banner is intentionally disabled on web.
  return null;
}

export default BuklodTestAdBanner;