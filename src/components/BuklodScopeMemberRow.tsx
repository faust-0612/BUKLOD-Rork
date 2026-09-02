import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BuklodTappableAvatar } from '@/components/BuklodTappableAvatar';
import BuklodTappablePersonName from '@/components/BuklodTappablePersonName';
import { resolvePersonDisplayName } from '@/lib/buklodPersonDisplay';
import type { ScopeMemberRow } from '@/lib/buklodScopeMembers';
import { colors } from '@/lib/theme';

type Props = {
  member: ScopeMemberRow;
  compact?: boolean;
};

function statusColor(status: string) {
  const value = status.toUpperCase();

  if (value === 'ACTIVE') return '#166534';
  if (value === 'PENDING' || value === 'INVITED') return '#92400E';
  if (value === 'SUSPENDED') return '#9A3412';
  return colors.muted;
}

export default function BuklodScopeMemberRow({
  member,
  compact = false,
}: Props) {
  const roleLabel = member.functional_roles.map((role) => role.name).join(' · ');

  return (
    <View style={[styles.row, compact && styles.rowCompact]}>
      <BuklodTappableAvatar
        userId={member.user_id}
        uri={member.avatar_url}
        name={resolvePersonDisplayName(member, member.user_id)}
        size={compact ? 38 : 44}
      />

      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <View style={styles.nameWrap}>
            <BuklodTappablePersonName
              userId={member.user_id}
              displayName={resolvePersonDisplayName(member, member.user_id)}
              avatarUrl={member.avatar_url}
              style={styles.name}
              numberOfLines={1}
            >
              {resolvePersonDisplayName(member, member.user_id)}
            </BuklodTappablePersonName>
          </View>
          <View
            style={[
              styles.accessBadge,
              member.is_admin ? styles.accessAdmin : styles.accessMember,
            ]}
          >
            <Text
              style={[
                styles.accessText,
                member.is_admin ? styles.accessTextAdmin : styles.accessTextMember,
              ]}
            >
              {member.is_admin ? 'ADMIN' : 'MEMBER'}
            </Text>
          </View>
        </View>

        {roleLabel ? (
          <Text style={styles.roles} numberOfLines={2}>
            {roleLabel}
          </Text>
        ) : (
          <Text style={styles.rolesMuted}>No functional role assigned</Text>
        )}

        {!compact && member.membership_status !== 'ACTIVE' ? (
          <Text
            style={[
              styles.status,
              { color: statusColor(member.membership_status) },
            ]}
          >
            {member.membership_status}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
  },
  rowCompact: {
    paddingVertical: 6,
  },
  copy: {
    flex: 1,
    gap: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameWrap: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    flex: 1,
    color: '#173B2F',
    fontSize: 14,
    fontWeight: '800',
  },
  roles: {
    color: '#4B5D54',
    fontSize: 12,
    lineHeight: 17,
  },
  rolesMuted: {
    color: colors.muted,
    fontSize: 11,
  },
  status: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  accessBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  accessAdmin: {
    backgroundColor: '#E8F5EE',
  },
  accessMember: {
    backgroundColor: '#F3F4F6',
  },
  accessText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  accessTextAdmin: {
    color: '#176B4A',
  },
  accessTextMember: {
    color: '#6B7280',
  },
});
