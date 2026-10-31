/**
 * Native AdMob media is Android-only. Keep new Home/Connect/Profile/Cluster
 * sponsored cards out of the web bundle (which uses a different ad platform).
 */
export default function BuklodNativeSponsoredCard(_props: {
  surface: 'home' | 'profile' | 'connect' | 'cluster_dashboard';
  slotId: string;
}) {
  return null;
}
