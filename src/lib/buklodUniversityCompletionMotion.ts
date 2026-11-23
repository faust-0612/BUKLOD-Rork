/**
 * Presentation-only policy for academic completion. It never grants credits,
 * verifies authority, or creates a PDF. Only the authenticated Registrar API
 * may supply an ISSUED receipt to its UI caller.
 */
export type BuklodUniversityCredentialTier = 'certificate' | 'diploma' | 'bachelors' | 'masters';

export type BuklodUniversityAwardReceipt = {
  awardId: string;
  credentialCode: string;
  title: string;
  tier: BuklodUniversityCredentialTier;
  status: 'ISSUED' | 'PENDING' | 'ON_HOLD' | 'REVOKED';
  issuedAt: string;
  paperReady: boolean;
};

export type BuklodAcademicMotionPreset = {
  label: string;
  name: string;
  accent: string;
  darkAccent: string;
  glow: string;
  icon: 'certificate' | 'script-text-outline' | 'school' | 'crown';
  burstCount: number;
  durationMs: number;
};

export const BUKLOD_ACADEMIC_MOTION: Record<BuklodUniversityCredentialTier, BuklodAcademicMotionPreset> = {
  certificate: {
    label: 'Certificate of Completion', name: 'Emerald Bloom',
    accent: '#27A971', darkAccent: '#13573D', glow: '#CFEFDD',
    icon: 'certificate', burstCount: 7, durationMs: 1350,
  },
  diploma: {
    label: 'Diploma of Completion', name: 'Golden Unfold',
    accent: '#C69B41', darkAccent: '#73521E', glow: '#FFF0C7',
    icon: 'script-text-outline', burstCount: 9, durationMs: 1600,
  },
  bachelors: {
    label: "Bachelor's Program Completion", name: 'Academic Ascension',
    accent: '#5184C7', darkAccent: '#1F497B', glow: '#DAE9FF',
    icon: 'school', burstCount: 11, durationMs: 1800,
  },
  masters: {
    label: "Master's Program Completion", name: 'Grand Convocation',
    accent: '#A27BD1', darkAccent: '#563585', glow: '#EEDFFF',
    icon: 'crown', burstCount: 13, durationMs: 2100,
  },
};

function codeMatchesTier(code: string, tier: BuklodUniversityCredentialTier): boolean {
  if (tier === 'certificate') return /^C-(?:S|D|F|R)\d{2,3}$/.test(code);
  if (tier === 'diploma') return /^D\d{2,3}$/.test(code);
  if (tier === 'bachelors') return /^B\d{2,3}$/.test(code);
  return /^M\d{2,3}$/.test(code);
}

/** UI gate ONLY. A client-side object is not proof of a server-issued award. */
export function getBuklodAcademicCompletionPresentation(
  receipt: BuklodUniversityAwardReceipt | null | undefined,
  acknowledgedAwardIds: ReadonlySet<string> = new Set(),
): BuklodAcademicMotionPreset | null {
  if (!receipt || receipt.status !== 'ISSUED' || !receipt.paperReady) return null;
  if (!/^[\w-]{8,128}$/.test(receipt.awardId)) return null;
  if (!receipt.title.trim() || receipt.title.length > 180) return null;
  if (!codeMatchesTier(receipt.credentialCode, receipt.tier)) return null;
  if (!Number.isFinite(Date.parse(receipt.issuedAt))) return null;
  if (acknowledgedAwardIds.has(receipt.awardId)) return null;
  return BUKLOD_ACADEMIC_MOTION[receipt.tier] ?? null;
}
