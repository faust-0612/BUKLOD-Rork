import BuklodMzbLegacyRedirect
  from '@/components/BuklodMzbLegacyRedirect';

/**
 * Legacy /mzb entry — opens the canonical scoped workspace home (/scope),
 * not the organization membership settings page (/mzb/organization).
 */
export default function MzbIndexRedirect() {
  return <BuklodMzbLegacyRedirect />;
}
