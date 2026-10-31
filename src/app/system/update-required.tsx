import BuklodUpdateRequiredPanel from '@/components/BuklodUpdateRequiredPanel';

/**
 * Legacy route alias: the root boundary also protects deep links into any
 * scope, so old navigation history cannot bypass the mandatory update.
 */
export default function UpdateRequired() {
  return <BuklodUpdateRequiredPanel />;
}
