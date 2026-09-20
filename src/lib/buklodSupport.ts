import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

export type BuklodSupportCategory =
  | 'SIGN_IN'
  | 'FORGOT_PASSWORD'
  | 'ACCOUNT_LOCKED'
  | 'RECOVERY_CODE'
  | 'APP_NOT_RESPONDING'
  | 'OTHER_ACCOUNT'
  | 'QUIZ'
  | 'CLASSROOM'
  | 'ORGANIZATION'
  | 'REPORTED_CONTENT'
  | 'TECHNICAL'
  | 'FINANCIAL'
  | 'OTHER';

export const BUKLOD_SUPPORT_CATEGORIES: {
  key: BuklodSupportCategory;
  label: string;
  preLogin: boolean;
}[] = [
  { key: 'SIGN_IN', label: "I can't sign in", preLogin: true },
  { key: 'FORGOT_PASSWORD', label: 'I forgot my password', preLogin: true },
  { key: 'ACCOUNT_LOCKED', label: 'My account is locked', preLogin: true },
  { key: 'RECOVERY_CODE', label: 'Recovery code problem', preLogin: true },
  { key: 'APP_NOT_RESPONDING', label: 'App does not respond', preLogin: true },
  { key: 'OTHER_ACCOUNT', label: 'Other account problem', preLogin: true },
  { key: 'QUIZ', label: 'Quiz', preLogin: false },
  { key: 'CLASSROOM', label: 'Classroom', preLogin: false },
  { key: 'ORGANIZATION', label: 'Organization / Cluster / Sub-Org', preLogin: false },
  { key: 'REPORTED_CONTENT', label: 'Report content / moderation', preLogin: false },
  { key: 'TECHNICAL', label: 'Technical problem', preLogin: false },
  { key: 'FINANCIAL', label: 'Financial inquiry', preLogin: false },
  { key: 'OTHER', label: 'Other problem', preLogin: false },
];

const CASE_STORAGE_KEY = '@buklod/support-cases-v1';

type StoredCase = {
  case_code: string;
  access_token: string;
  created_at: string;
};

export type BuklodSupportCaseSummary = {
  case_code: string;
  status: 'OPEN' | 'WAITING_FOR_USER' | 'BEING_REVIEWED' | 'RESOLVED' | string;
  queue_code?: string | null;
  category?: string | null;
  app?: string | null;
  feature?: string | null;
  title?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  resolved_at?: string | null;
  incident?: {
    incident_code?: string | null;
    status?: string | null;
    title?: string | null;
    public_message?: string | null;
    message?: string | null;
  } | null;
  updates?: Array<{
    message?: string | null;
    update_type?: string | null;
    created_at?: string | null;
  }>;
};

export type BuklodSupportResult =
  | {
      outcome: 'FIXED';
      message: string;
    }
  | {
      outcome: 'SELF_SERVICE';
      message: string;
      next_route: string;
    }
  | {
      outcome: 'KNOWN_INCIDENT';
      incident: {
        incident_code: string;
        status: string;
        title: string;
        message: string;
      };
    }
  | {
      outcome: 'CASE_CREATED';
      case: BuklodSupportCaseSummary & { access_token: string };
      incident?: BuklodSupportCaseSummary['incident'];
    };

async function readStoredCases(): Promise<StoredCase[]> {
  try {
    const raw = await AsyncStorage.getItem(CASE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        item =>
          typeof item?.case_code === 'string' &&
          typeof item?.access_token === 'string',
      )
      .slice(0, 30);
  } catch {
    return [];
  }
}

async function rememberCase(item: StoredCase) {
  const current = await readStoredCases();
  const next = [
    item,
    ...current.filter(row => row.case_code !== item.case_code),
  ].slice(0, 30);
  await AsyncStorage.setItem(CASE_STORAGE_KEY, JSON.stringify(next));
}

function networkSummary() {
  if (Platform.OS === 'web') {
    const online =
      typeof navigator !== 'undefined'
        ? navigator.onLine
        : null;
    return { online, source: 'browser' };
  }
  return { online: null, source: 'runtime' };
}

async function attemptLocalSelfHeal(category: BuklodSupportCategory) {
  if (category !== 'SIGN_IN') {
    return false;
  }

  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return false;

    const refreshed = await supabase.auth.refreshSession();
    return !!refreshed.data.session && !refreshed.error;
  } catch {
    return false;
  }
}

export async function runBuklodSupportFlow(input: {
  category: BuklodSupportCategory;
  identifier?: string;
  message?: string;
  app?: string;
  feature?: string;
  route?: string;
  errorCode?: string | null;
  languageCode?: string;
}): Promise<BuklodSupportResult> {
  const fixed = await attemptLocalSelfHeal(input.category);
  if (fixed) {
    return {
      outcome: 'FIXED',
      message: 'Your issue was fixed. Please try again.',
    };
  }

  const requestId =
    'support-' +
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).slice(2, 12);

  const payload = {
    action: 'resolve_or_case',
    request_id: requestId,
    category: input.category,
    identifier: String(input.identifier ?? '').trim(),
    message: String(input.message ?? '').trim(),
    app: input.app ?? 'BUKLOD Main',
    feature: input.feature ?? '',
    route: input.route ?? '',
    error_code: input.errorCode ?? '',
    language_code: input.languageCode ?? 'en',
    platform: Platform.OS,
    os_version: String(Platform.Version ?? ''),
    app_version: Constants.expoConfig?.version ?? '',
    network_summary: networkSummary(),
    diagnostics: {
      support_flow: 'BUKLOD_HELP_V1',
      platform: Platform.OS,
      route: input.route ?? '',
      error_code: input.errorCode ?? '',
      language_code: input.languageCode ?? 'en',
    },
  };

  let response = await supabase.functions.invoke(
    'buklod-support-v1',
    { body: payload },
  );

  if (response.error) {
    await new Promise(resolve => setTimeout(resolve, 450));
    response = await supabase.functions.invoke(
      'buklod-support-v1',
      { body: payload },
    );
  }

  const { data, error } = response;
  if (error) {
    throw new Error(
      error.message || 'BUKLOD Help could not complete diagnostics.',
    );
  }
  if (!data?.ok) {
    throw new Error(
      String(
        data?.message ??
          'BUKLOD Help could not complete diagnostics.',
      ),
    );
  }

  if (data.outcome === 'SELF_SERVICE') {
    return {
      outcome: 'SELF_SERVICE',
      message: String(data.message ?? ''),
      next_route: String(data.next_route ?? '/(auth)/forgot-password'),
    };
  }

  if (data.outcome === 'KNOWN_INCIDENT') {
    return {
      outcome: 'KNOWN_INCIDENT',
      incident: {
        incident_code: String(data.incident?.incident_code ?? ''),
        status: String(data.incident?.status ?? 'INVESTIGATING'),
        title: String(data.incident?.title ?? 'Known BUKLOD incident'),
        message: String(
          data.incident?.message ??
            "We're already working on this issue.",
        ),
      },
    };
  }

  if (data.outcome === 'CASE_CREATED' && data.case?.case_code) {
    const supportCase = {
      ...data.case,
      case_code: String(data.case.case_code),
      status: String(data.case.status ?? 'OPEN'),
      access_token: String(data.case.access_token ?? ''),
    };

    if (supportCase.access_token) {
      await rememberCase({
        case_code: supportCase.case_code,
        access_token: supportCase.access_token,
        created_at:
          String(supportCase.created_at ?? '') ||
          new Date().toISOString(),
      });
    }

    return {
      outcome: 'CASE_CREATED',
      case: supportCase,
      incident: data.incident ?? null,
    };
  }

  throw new Error('BUKLOD Help returned an incomplete response.');
}

export async function loadBuklodSupportCases(): Promise<
  BuklodSupportCaseSummary[]
> {
  const merged = new Map<string, BuklodSupportCaseSummary>();

  try {
    const { data: authData } = await supabase.auth.getSession();
    if (authData.session) {
      const { data, error } = await supabase.functions.invoke(
        'buklod-support-v1',
        { body: { action: 'list_my_cases' } },
      );
      if (!error && data?.ok && Array.isArray(data.cases)) {
        for (const row of data.cases) {
          if (row?.case_code) {
            merged.set(String(row.case_code), row);
          }
        }
      }
    }
  } catch {}

  const stored = await readStoredCases();
  await Promise.all(
    stored.map(async item => {
      try {
        const { data, error } = await supabase.functions.invoke(
          'buklod-support-v1',
          {
            body: {
              action: 'case_status',
              case_code: item.case_code,
              access_token: item.access_token,
            },
          },
        );
        if (!error && data?.ok && data.case?.case_code) {
          merged.set(String(data.case.case_code), data.case);
        }
      } catch {}
    }),
  );

  return Array.from(merged.values()).sort((a, b) =>
    String(b.created_at ?? '').localeCompare(
      String(a.created_at ?? ''),
    ),
  );
}
