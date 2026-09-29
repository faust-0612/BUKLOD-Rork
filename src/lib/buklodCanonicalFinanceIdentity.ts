import { supabase } from '@/lib/supabase';

export type BuklodCanonicalFinanceIdentity = {
  ok?: boolean;
  status?: string;
  person_id?: string;
  referral_code?: string;
  recreated?: boolean;
};

let identityInFlight: Promise<BuklodCanonicalFinanceIdentity> | null = null;

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object') {
    const row = error as Record<string, unknown>;
    const message = row.message ?? row.error;
    if (typeof message === 'string' && message.trim()) return message.trim();
  }
  return fallback;
}

async function invokeReferralIdentityService(
  action: 'ensure_identity' | 'attach_referral',
  referralCode?: string,
): Promise<BuklodCanonicalFinanceIdentity & Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke('buklod-referral-v2', {
    body: {
      action,
      ...(referralCode
        ? { referral_code: referralCode.trim().toUpperCase() }
        : {}),
    },
  });

  if (error) {
    throw new Error(
      errorMessage(error, 'Could not initialize the canonical BUKLOD financial identity.'),
    );
  }

  if (data && typeof data === 'object' && typeof (data as any).error === 'string') {
    const next = new Error(String((data as any).error));
    (next as any).code = (data as any).code;
    throw next;
  }

  return (data ?? {}) as BuklodCanonicalFinanceIdentity & Record<string, unknown>;
}

export async function ensureBuklodCanonicalFinanceIdentity() {
  if (identityInFlight) return identityInFlight;

  identityInFlight = invokeReferralIdentityService('ensure_identity')
    .finally(() => {
      identityInFlight = null;
    });

  return identityInFlight;
}

export async function attachBuklodCanonicalReferral(referralCode: string) {
  const code = referralCode.trim().toUpperCase();
  if (!code) throw new Error('Referral code required.');

  return invokeReferralIdentityService('attach_referral', code);
}
