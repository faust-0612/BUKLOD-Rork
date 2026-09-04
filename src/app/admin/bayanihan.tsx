import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { AdminGate } from '@/components/AdminGate';
import {
  Button,
  Card,
  SectionTitle,
  shared,
} from '@/components/UI';
import { colors } from '@/lib/theme';

function AdminLinkCard({
  icon,
  title,
  subtitle,
  path,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  subtitle: string;
  path: string;
}) {
  return (
    <Card>
      <View style={styles.linkHeader}>
        <MaterialCommunityIcons
          name={icon}
          size={22}
          color={colors.greenDark}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.linkTitle}>{title}</Text>
          <Text style={styles.linkSubtitle}>{subtitle}</Text>
        </View>
      </View>

      <Button
        title="OPEN"
        onPress={() => router.push(path as any)}
      />
    </Card>
  );
}

export default function AdminBayanihanScreen() {
  return (
    <AdminGate>
      <ScrollView
        style={shared.screen}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.eyebrow}>SYSTEM ADMIN</Text>

        <Text style={shared.h1}>BUKLOD Bayanihan</Text>

        <Text style={shared.muted}>
          Participation, recognition and BUKLOD progress. Available
          BUKLOD Points may now be transferred to Bayanihan credit or,
          when System Admin explicitly enables a PHP conversion rate,
          submitted through the audited Cash Reward payout workflow.
        </Text>

        <SectionTitle>OVERVIEW</SectionTitle>

        <Card>
          <Text style={styles.infoTitle}>
            Lifetime points stay permanent
          </Text>
          <Text style={styles.infoText}>
            BUKLOD Bayanihan transfer and Cash Reward are the only
            supported point-spend destinations. Lifetime Points and
            Rank never decrease. Cash requests reserve points first;
            Available Points are deducted only after the real payout is
            recorded as PAID with a transaction/reference.
          </Text>
        </Card>

        <SectionTitle>REDEMPTION CONTROL</SectionTitle>

        <AdminLinkCard
          icon="wallet-giftcard"
          title="Points Redemption Center"
          subtitle="Set Bayanihan conversion, Cash Reward PHP rate, review requests, and mark actual payouts PAID"
          path="/admin/points-redemptions"
        />

        <SectionTitle>RELATED ADMIN TOOLS</SectionTitle>

        <AdminLinkCard
          icon="clipboard-check-outline"
          title="Learning Approvals"
          subtitle="Final System Admin review after Pastor validation"
          path="/admin/learning-approvals"
        />

        <AdminLinkCard
          icon="star-circle-outline"
          title="Member Master Records"
          subtitle="Masterlist, records and member progress export"
          path="/admin/member-master"
        />

        <AdminLinkCard
          icon="school-outline"
          title="Formation Configuration"
          subtitle="Formation curriculum and delivery settings"
          path="/admin/formation/config"
        />
      </ScrollView>
    </AdminGate>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 18,
    paddingBottom: 50,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: colors.greenDark,
    marginBottom: 4,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
  },
  infoText: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
  },
  linkHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  linkTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
  },
  linkSubtitle: {
    marginTop: 4,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.muted,
  },
});
