$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " PATCH 167B - BUKLOD HYBRID TOP ADS V1" -ForegroundColor Cyan
Write-Host " Local paid ads + existing AdMob top rail" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""

function Write-Utf8NoBom {
    param(
        [Parameter(Mandatory=$true)][string]$Path,
        [Parameter(Mandatory=$true)][string]$Text
    )

    $full = Join-Path (Get-Location) $Path
    $dir = Split-Path -Parent $full

    if ($dir -and !(Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }

    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($full, $Text, $utf8)
}

function Backup-Once {
    param(
        [Parameter(Mandatory=$true)][string]$Path,
        [Parameter(Mandatory=$true)][string]$Suffix
    )

    if (!(Test-Path -LiteralPath $Path)) {
        throw "Required file not found: $Path"
    }

    $backup = "$Path.$Suffix.bak"
    if (!(Test-Path -LiteralPath $backup)) {
        Copy-Item -LiteralPath $Path -Destination $backup -Force
    }
}

if (!(Test-Path -LiteralPath "package.json")) {
    throw "Run this patch from the BUKLOD project root. package.json not found."
}

if (!(Test-Path -LiteralPath "src")) {
    throw "src folder not found. Wrong project directory."
}

if (!(Test-Path -LiteralPath "supabase\migrations")) {
    throw "supabase\migrations not found. Wrong project directory."
}

Write-Host "1/7 Auditing existing BUKLOD AdMob integration..." -ForegroundColor Yellow

$package = Get-Content -Raw -LiteralPath "package.json"
if ($package -notmatch '"react-native-google-mobile-ads"\s*:') {
    throw "Existing react-native-google-mobile-ads dependency was not found."
}

$adRailPath = "src\components\BuklodDashboardAdRail.tsx"
if (!(Test-Path -LiteralPath $adRailPath)) {
    throw "Existing BuklodDashboardAdRail.tsx not found."
}

$adRail = Get-Content -Raw -LiteralPath $adRailPath
if ($adRail -notmatch "BuklodTabAdStrip") {
    throw "Existing AdMob dashboard rail is not wired through BuklodTabAdStrip. Patch stopped safely."
}

Write-Host "Existing AdMob rail confirmed. It will NOT be manually refreshed/remounted by this patch." -ForegroundColor Green

Write-Host ""
Write-Host "2/7 Creating commercial local-ad database layer..." -ForegroundColor Yellow

$migrationPath = "supabase\migrations\20260814073000_patch167b_hybrid_local_ads.sql"

$sql = @'
begin;

create table if not exists public.buklod_ad_rate_cards (
  coverage_level text primary key
    check (coverage_level in ('barangay','city','province','nationwide')),
  monthly_price numeric(12,2) not null check (monthly_price >= 0),
  currency text not null default 'PHP',
  is_introductory boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.buklod_ad_rate_cards (
  coverage_level,
  monthly_price,
  currency,
  is_introductory
)
values
  ('barangay',   100.00, 'PHP', true),
  ('city',       250.00, 'PHP', true),
  ('province',   500.00, 'PHP', true),
  ('nationwide', 999.00, 'PHP', true)
on conflict (coverage_level) do update
set
  monthly_price = excluded.monthly_price,
  currency = excluded.currency,
  is_introductory = excluded.is_introductory,
  updated_at = now();

create table if not exists public.buklod_paid_ad_campaigns (
  id uuid primary key default gen_random_uuid(),

  advertiser_name text not null,
  headline text not null,
  short_text text,
  image_url text,
  destination_url text,

  placement text not null default 'all'
    check (placement in ('all','home','messages','learn','community','prayer','me')),

  coverage_level text not null
    check (coverage_level in ('barangay','city','province','nationwide')),

  barangay text,
  city_municipality text,
  province text,
  country_code text not null default 'PH',

  monthly_price numeric(12,2),
  amount_paid numeric(12,2) not null default 0 check (amount_paid >= 0),
  currency text not null default 'PHP',

  payment_status text not null default 'pending'
    check (payment_status in ('pending','paid','refunded','waived')),

  status text not null default 'pending'
    check (status in ('draft','pending','approved','paused','rejected','expired')),

  policy_confirmed boolean not null default false,

  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,

  priority integer not null default 100,
  created_by uuid default auth.uid(),
  approved_by uuid,
  approved_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (ends_at > starts_at),

  check (
    coverage_level <> 'barangay'
    or (
      barangay is not null
      and city_municipality is not null
      and province is not null
    )
  ),

  check (
    coverage_level <> 'city'
    or (
      city_municipality is not null
      and province is not null
    )
  ),

  check (
    coverage_level <> 'province'
    or province is not null
  )
);

create or replace function public.buklod_set_paid_ad_price()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.monthly_price is null then
    select r.monthly_price
      into new.monthly_price
    from public.buklod_ad_rate_cards r
    where r.coverage_level = new.coverage_level;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists buklod_paid_ad_price_trigger
on public.buklod_paid_ad_campaigns;

create trigger buklod_paid_ad_price_trigger
before insert or update
on public.buklod_paid_ad_campaigns
for each row
execute function public.buklod_set_paid_ad_price();

create table if not exists public.buklod_paid_ad_events (
  id bigint generated always as identity primary key,
  campaign_id uuid not null
    references public.buklod_paid_ad_campaigns(id)
    on delete cascade,
  user_id uuid default auth.uid(),
  event_type text not null
    check (event_type in ('impression','click')),
  placement text not null default 'all',
  created_at timestamptz not null default now()
);

create index if not exists buklod_paid_ad_campaigns_live_idx
on public.buklod_paid_ad_campaigns (
  status,
  payment_status,
  starts_at,
  ends_at,
  priority
);

create index if not exists buklod_paid_ad_campaigns_geo_idx
on public.buklod_paid_ad_campaigns (
  coverage_level,
  province,
  city_municipality,
  barangay
);

create index if not exists buklod_paid_ad_events_campaign_idx
on public.buklod_paid_ad_events (
  campaign_id,
  event_type,
  created_at desc
);

alter table public.buklod_ad_rate_cards enable row level security;
alter table public.buklod_paid_ad_campaigns enable row level security;
alter table public.buklod_paid_ad_events enable row level security;

drop policy if exists "buklod_ad_rate_cards_read" on public.buklod_ad_rate_cards;
create policy "buklod_ad_rate_cards_read"
on public.buklod_ad_rate_cards
for select
to authenticated
using (true);

drop policy if exists "buklod_ad_rate_cards_admin" on public.buklod_ad_rate_cards;
create policy "buklod_ad_rate_cards_admin"
on public.buklod_ad_rate_cards
for all
to authenticated
using (public.is_system_admin())
with check (public.is_system_admin());

drop policy if exists "buklod_paid_ads_live_read" on public.buklod_paid_ad_campaigns;
create policy "buklod_paid_ads_live_read"
on public.buklod_paid_ad_campaigns
for select
to authenticated
using (
  status = 'approved'
  and payment_status in ('paid','waived')
  and policy_confirmed = true
  and now() >= starts_at
  and now() < ends_at
);

drop policy if exists "buklod_paid_ads_admin" on public.buklod_paid_ad_campaigns;
create policy "buklod_paid_ads_admin"
on public.buklod_paid_ad_campaigns
for all
to authenticated
using (public.is_system_admin())
with check (public.is_system_admin());

drop policy if exists "buklod_paid_ad_events_insert" on public.buklod_paid_ad_events;
create policy "buklod_paid_ad_events_insert"
on public.buklod_paid_ad_events
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.buklod_paid_ad_campaigns c
    where c.id = campaign_id
      and c.status = 'approved'
      and c.payment_status in ('paid','waived')
      and c.policy_confirmed = true
      and now() >= c.starts_at
      and now() < c.ends_at
  )
);

drop policy if exists "buklod_paid_ad_events_admin_read" on public.buklod_paid_ad_events;
create policy "buklod_paid_ad_events_admin_read"
on public.buklod_paid_ad_events
for select
to authenticated
using (public.is_system_admin());

comment on table public.buklod_paid_ad_campaigns is
'Commercial BUKLOD local advertising inventory. Local paid ads are separate from Google AdMob reporting and are geo-targeted by declared account/community location.';

comment on table public.buklod_paid_ad_events is
'First-party impression/click analytics for BUKLOD local paid advertising. These events are not AdMob impressions.';

commit;
'@

Write-Utf8NoBom -Path $migrationPath -Text $sql
Write-Host "Created: $migrationPath" -ForegroundColor Green

Write-Host ""
Write-Host "3/7 Creating geo-aware paid local banner..." -ForegroundColor Yellow

$paidBannerPath = "src\components\BuklodPaidHeaderAd.tsx"

$paidBanner = @'
import React, {
  ReactNode,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

type Placement =
  | 'home'
  | 'messages'
  | 'learn'
  | 'community'
  | 'prayer'
  | 'me';

type Campaign = {
  id: string;
  advertiser_name: string;
  headline: string;
  short_text: string | null;
  image_url: string | null;
  destination_url: string | null;
  placement:
    | 'all'
    | Placement;
  coverage_level:
    | 'barangay'
    | 'city'
    | 'province'
    | 'nationwide';
  barangay: string | null;
  city_municipality: string | null;
  province: string | null;
  priority: number | null;
};

function norm(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function firstText(
  source: Record<string, any> | null | undefined,
  keys: string[],
) {
  for (const key of keys) {
    const value = source?.[key];
    if (
      typeof value === 'string' &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  return '';
}

function campaignMatchesGeo(
  campaign: Campaign,
  profile: Record<string, any>,
) {
  if (
    campaign.coverage_level ===
    'nationwide'
  ) {
    return true;
  }

  const userProvince =
    firstText(profile, [
      'province',
      'province_name',
      'address_province',
    ]);

  const userCity =
    firstText(profile, [
      'city_municipality',
      'municipality',
      'municipality_name',
      'city',
      'city_name',
      'address_city',
      'address_municipality',
    ]);

  const userBarangay =
    firstText(profile, [
      'barangay',
      'barangay_name',
      'address_barangay',
    ]);

  if (
    campaign.coverage_level ===
    'province'
  ) {
    return (
      !!userProvince &&
      norm(userProvince) ===
        norm(campaign.province)
    );
  }

  if (
    campaign.coverage_level ===
    'city'
  ) {
    return (
      !!userProvince &&
      !!userCity &&
      norm(userProvince) ===
        norm(campaign.province) &&
      norm(userCity) ===
        norm(campaign.city_municipality)
    );
  }

  return (
    !!userProvince &&
    !!userCity &&
    !!userBarangay &&
    norm(userProvince) ===
      norm(campaign.province) &&
    norm(userCity) ===
      norm(campaign.city_municipality) &&
    norm(userBarangay) ===
      norm(campaign.barangay)
  );
}

export default function BuklodPaidHeaderAd({
  placement,
  fallback,
}: {
  placement: Placement;
  fallback?: ReactNode;
}) {
  const { profile } = useAuth();

  const [campaigns, setCampaigns] =
    useState<Campaign[]>([]);

  const [index, setIndex] =
    useState(0);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      const { data, error } =
        await supabase
          .from(
            'buklod_paid_ad_campaigns',
          )
          .select(
            [
              'id',
              'advertiser_name',
              'headline',
              'short_text',
              'image_url',
              'destination_url',
              'placement',
              'coverage_level',
              'barangay',
              'city_municipality',
              'province',
              'priority',
            ].join(','),
          )
          .in(
            'placement',
            ['all', placement],
          )
          .order(
            'priority',
            { ascending: false },
          )
          .limit(50);

      if (!alive) return;

      if (error) {
        console.warn(
          'BUKLOD paid-ad load failed:',
          error.message,
        );
        setCampaigns([]);
        return;
      }

      const profileRecord =
        (profile ?? {}) as Record<
          string,
          any
        >;

      const eligible =
        ((data ?? []) as unknown as Campaign[])
          .filter(
            campaign =>
              campaignMatchesGeo(
                campaign,
                profileRecord,
              ),
          );

      setCampaigns(eligible);
      setIndex(0);
    };

    load();

    return () => {
      alive = false;
    };
  }, [
    placement,
    profile,
  ]);

  useEffect(() => {
    if (campaigns.length <= 1) {
      return;
    }

    const timer = setInterval(
      () => {
        setIndex(
          current =>
            (current + 1) %
            campaigns.length,
        );
      },
      9000,
    );

    return () =>
      clearInterval(timer);
  }, [campaigns.length]);

  const campaign =
    useMemo(
      () =>
        campaigns.length
          ? campaigns[
              index %
                campaigns.length
            ]
          : null,
      [campaigns, index],
    );

  useEffect(() => {
    if (!campaign?.id) return;

    void supabase
      .from(
        'buklod_paid_ad_events',
      )
      .insert({
        campaign_id:
          campaign.id,
        event_type:
          'impression',
        placement,
      });
  }, [
    campaign?.id,
    placement,
  ]);

  if (!campaign) {
    return (
      <>
        {fallback ?? null}
      </>
    );
  }

  const open = async () => {
    void supabase
      .from(
        'buklod_paid_ad_events',
      )
      .insert({
        campaign_id:
          campaign.id,
        event_type:
          'click',
        placement,
      });

    const url =
      campaign.destination_url
        ?.trim();

    if (!url) return;

    try {
      await Linking.openURL(url);
    }
    catch (error) {
      console.warn(
        'BUKLOD paid-ad link failed:',
        error,
      );
    }
  };

  return (
    <Pressable
      accessibilityRole={
        campaign.destination_url
          ? 'link'
          : undefined
      }
      accessibilityLabel={
        `Sponsored: ${campaign.advertiser_name}`
      }
      onPress={
        campaign.destination_url
          ? open
          : undefined
      }
      style={({ pressed }) => [
        styles.shell,
        pressed &&
          campaign.destination_url
          ? styles.pressed
          : null,
      ]}
    >
      {campaign.image_url ? (
        <Image
          source={{
            uri:
              campaign.image_url,
          }}
          resizeMode="cover"
          style={
            styles.image
          }
        />
      ) : (
        <View
          style={
            styles.textOnly
          }
        >
          <Text
            numberOfLines={1}
            style={
              styles.sponsored
            }
          >
            SPONSORED
          </Text>

          <Text
            numberOfLines={1}
            style={
              styles.headline
            }
          >
            {campaign.headline}
          </Text>
        </View>
      )}

      <View
        pointerEvents="none"
        style={
          styles.badge
        }
      >
        <Text
          style={
            styles.badgeText
          }
        >
          LOCAL AD
        </Text>
      </View>
    </Pressable>
  );
}

const styles =
  StyleSheet.create({
    shell: {
      width: 188,
      height: 42,
      marginRight: 8,
      borderRadius: 9,
      overflow: 'hidden',
      backgroundColor:
        '#FFFFFF',
      borderWidth:
        StyleSheet
          .hairlineWidth,
      borderColor:
        'rgba(255,255,255,0.55)',
    },

    pressed: {
      opacity: 0.78,
    },

    image: {
      width: '100%',
      height: '100%',
    },

    textOnly: {
      flex: 1,
      justifyContent:
        'center',
      paddingHorizontal: 9,
      paddingRight: 46,
    },

    sponsored: {
      fontSize: 7,
      fontWeight: '900',
      letterSpacing: 0.7,
      color: '#4D6A5D',
    },

    headline: {
      marginTop: 1,
      fontSize: 11,
      lineHeight: 13,
      fontWeight: '900',
      color: '#12271E',
    },

    badge: {
      position: 'absolute',
      right: 4,
      bottom: 4,
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor:
        'rgba(0,0,0,0.68)',
    },

    badgeText: {
      fontSize: 6,
      fontWeight: '900',
      letterSpacing: 0.4,
      color: '#FFFFFF',
    },
  });
'@

Write-Utf8NoBom -Path $paidBannerPath -Text $paidBanner
Write-Host "Created: $paidBannerPath" -ForegroundColor Green

Write-Host ""
Write-Host "4/7 Upgrading existing header sponsor without deleting legacy behavior..." -ForegroundColor Yellow

$headerPath = "src\components\BuklodHeaderSponsor.tsx"
$legacyHeaderPath = "src\components\BuklodHeaderSponsorLegacy.tsx"

if (!(Test-Path -LiteralPath $headerPath)) {
    throw "Existing BuklodHeaderSponsor.tsx was not found."
}

Backup-Once -Path $headerPath -Suffix "before_167B"

if (!(Test-Path -LiteralPath $legacyHeaderPath)) {
    Copy-Item -LiteralPath $headerPath -Destination $legacyHeaderPath -Force
    Write-Host "Preserved previous header sponsor as BuklodHeaderSponsorLegacy.tsx" -ForegroundColor Green
}
else {
    Write-Host "Legacy header sponsor already preserved." -ForegroundColor DarkGray
}

$newHeader = @'
import React from 'react';

import BuklodHeaderSponsorLegacy
  from '@/components/BuklodHeaderSponsorLegacy';

import BuklodPaidHeaderAd
  from '@/components/BuklodPaidHeaderAd';

type Placement =
  | 'home'
  | 'messages'
  | 'learn'
  | 'community'
  | 'prayer'
  | 'me';

export default function BuklodHeaderSponsor({
  placement,
}: {
  placement: Placement;
}) {
  return (
    <BuklodPaidHeaderAd
      placement={placement}
      fallback={
        <BuklodHeaderSponsorLegacy
          placement={
            placement as any
          }
        />
      }
    />
  );
}
'@

Write-Utf8NoBom -Path $headerPath -Text $newHeader
Write-Host "Header priority is now: PAID LOCAL AD -> legacy sponsor fallback." -ForegroundColor Green
Write-Host "The existing AdMob rail remains mounted separately and continuously." -ForegroundColor Green

Write-Host ""
Write-Host "5/7 Static safety checks..." -ForegroundColor Yellow

$headerNow = Get-Content -Raw -LiteralPath $headerPath
$paidNow = Get-Content -Raw -LiteralPath $paidBannerPath
$railNow = Get-Content -Raw -LiteralPath $adRailPath

foreach ($token in @(
    "BuklodPaidHeaderAd",
    "BuklodHeaderSponsorLegacy"
)) {
    if (!$headerNow.Contains($token)) {
        throw "Header wiring check failed: $token"
    }
}

foreach ($token in @(
    "buklod_paid_ad_campaigns",
    "buklod_paid_ad_events",
    "coverage_level",
    "LOCAL AD"
)) {
    if (!$paidNow.Contains($token)) {
        throw "Paid local ad component check failed: $token"
    }
}

if (!$railNow.Contains("BuklodTabAdStrip")) {
    throw "AdMob rail was unexpectedly changed."
}

Write-Host "Static hybrid-ad checks passed." -ForegroundColor Green

Write-Host ""
Write-Host "6/7 TypeScript / Expo QA..." -ForegroundColor Yellow

npx tsc --noEmit
if ($LASTEXITCODE -ne 0) {
    throw "TypeScript validation failed."
}

npx expo install --check
if ($LASTEXITCODE -ne 0) {
    throw "Expo dependency validation failed."
}

npx expo-doctor
if ($LASTEXITCODE -ne 0) {
    throw "Expo Doctor failed."
}

Write-Host ""
Write-Host "7/7 Complete." -ForegroundColor Yellow
Write-Host ""
Write-Host "====================================================" -ForegroundColor Green
Write-Host " PATCH 167B COMPLETE - HYBRID TOP ADS READY" -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green
Write-Host ""
Write-Host "RATE CARD:" -ForegroundColor Cyan
Write-Host " Barangay    : PHP 100 / month"
Write-Host " Bayan/City  : PHP 250 / month"
Write-Host " Province    : PHP 500 / month"
Write-Host " Nationwide  : PHP 999 / month (introductory)"
Write-Host ""
Write-Host "BEHAVIOR:" -ForegroundColor Cyan
Write-Host " - Paid local ad uses the compact header sponsor area."
Write-Host " - Eligible local campaigns rotate every 9 seconds."
Write-Host " - Barangay/City/Province targeting uses declared profile location when available."
Write-Host " - Nationwide campaigns can display to any authenticated PH user."
Write-Host " - Existing sponsor remains fallback when no paid campaign matches."
Write-Host " - Existing AdMob dashboard banner stays mounted separately."
Write-Host " - AdMob is NOT manually refreshed/remounted by this patch."
Write-Host " - Local impressions/clicks are tracked separately from AdMob."
Write-Host ""
Write-Host "NEXT COMMAND:" -ForegroundColor Yellow
Write-Host "npx supabase db push"
Write-Host ""
Write-Host "NO NEW NATIVE SDK. NO APK BUILD REQUIRED FOR THIS SOURCE/DB PATCH." -ForegroundColor Green
