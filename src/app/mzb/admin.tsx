import React from 'react';

import {
  Redirect,
} from 'expo-router';

import BuklodMzbLegacyRedirect,
{
  BuklodMzbLegacyRedirectLoading,
} from '@/components/BuklodMzbLegacyRedirect';

import {
  findActiveMzbMemberScope,
} from '@/lib/buklodMzbOrganization';

import {
  organizationScopeManageRoute,
} from '@/lib/buklodOrganization';

import {
  useBuklodScope,
} from '@/providers/BuklodScopeProvider';

export default function MzbAdminRedirect() {
  const {
    scopes,
    loading,
  } = useBuklodScope();

  const mzbScope =
    findActiveMzbMemberScope(scopes);

  if (loading) {
    return (
      <BuklodMzbLegacyRedirectLoading
        label="Opening MZB admin..."
      />
    );
  }

  if (!mzbScope?.scope_id) {
    return <BuklodMzbLegacyRedirect />;
  }

  const target =
    organizationScopeManageRoute(
      mzbScope.scope_id,
      mzbScope.name
    );

  return (
    <Redirect
      href={target as any}
    />
  );
}
